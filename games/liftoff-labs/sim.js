// The flight simulation (pure maths, no graphics): rockets as rigid bodies with fuel, engines, air, parachutes, legs and crashes.
import { V, Q, clamp, lerp } from './vec.js?v=1';
import { PARTS, BODIES, G0, PAD, beanState, isEngine, isDecoupler, isChute, isLeg } from './data.js?v=1';
import { layout, segments, stagesOf } from './design.js?v=1';
import { propagate, elements } from './orbit.js?v=1';

export const DT = 1 / 120;
const DEG = Math.PI / 180;
const SOUND = 320;

// ------------------------------------------------------------------ world helpers
export function density(body, alt) {
  const a = body.atm;
  if (!a || alt > a.top || alt < -200) return 0;
  return a.rho0 * Math.exp(-Math.max(alt, 0) / a.H);
}
// up / east / north at a position (planet spins around +Y)
export function localFrame(r) {
  const up = V.norm(r);
  let east = V.cross([0, 1, 0], up);
  if (V.len(east) < 1e-6) east = [0, 0, -1];
  east = V.norm(east);
  return { up, east, north: V.cross(up, east) };
}
// body orientation for "nose pitch above the horizon, heading from north toward east, roll about the nose"
export function attitude(r, pitchDeg, headingDeg, rollDeg = 0) {
  const f = localFrame(r), p = pitchDeg * DEG, h = headingDeg * DEG;
  const H = V.add(V.mul(f.north, Math.cos(h)), V.mul(f.east, Math.sin(h)));
  const y = V.add(V.mul(H, Math.cos(p)), V.mul(f.up, Math.sin(p)));
  let z = V.sub(V.mul(H, Math.sin(p)), V.mul(f.up, Math.cos(p)));
  let x = V.cross(y, z);
  let q = Q.fromAxes(x, y, z);
  if (rollDeg) q = Q.mul(q, Q.axisAngle([0, 1, 0], rollDeg * DEG));
  return q;
}

// ------------------------------------------------------------------ building a flying rocket out of a design
function newPart(L, st, seg) {
  const def = L.def;
  return {
    i: L.i, def, q: L.q, pos: L.pos.slice(), rotY: L.rotY, ang: L.ang * DEG, parent: L.parent, kids: L.kids.slice(), side: L.side,
    seg, stage: st, fuel: def.fuel || 0, alive: true,
    ign: false, out: false, thrust: 0,
    chute: isChute(def) ? { state: 'stowed', open: 0 } : null,
    leg: isLeg(def) ? { out: true } : null,
  };
}

let VID = 1;
export function createVessel(design, opts = {}) {
  const lay = layout(design), sg = segments(lay), st = stagesOf(design, lay);
  const v = {
    id: VID++, main: opts.main !== false, body: opts.body || 'cobble', parts: lay.map((L, i) => newPart(L, st[i], sg.seg[i])),
    r: [0, 0, 0], v: [0, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0],
    ctl: { thr: 0, p: 0, y: 0, r: 0, sas: true, mode: 'hold', target: null, wheel: true, wasInput: false },
    stageIdx: 0, stageList: [], asleep: false, dead: false, met: 0, sleepT: 0, events: [], maxAlt: 0, maxSpeed: 0, touchedDown: false,
    easy: !!opts.easy, name: design.name,
  };
  v.stageList = [...new Set(v.parts.filter((p) => p.stage >= 0).map((p) => p.stage))].sort((a, b) => a - b);
  rebuild(v);
  return v;
}

// recompute everything that depends on which parts are still attached
export function rebuild(v) {
  v.ver = (v.ver || 0) + 1;
  const P = v.parts, alive = P.filter((p) => p.alive);
  v.alive = alive;
  v.engines = alive.filter((p) => isEngine(p.def));
  v.chutes = alive.filter((p) => p.chute);
  v.legs = alive.filter((p) => p.leg);
  v.nSeg = 1 + Math.max(0, ...alive.map((p) => p.seg));
  // exposed ends, lateral surfaces, contact points
  let aTop = 0, aBot = 0, aLat = 0;
  const lat = [], contacts = [];
  for (const p of alive) {
    const d = p.def, kidsAlive = p.kids.filter((k) => P[k].alive);
    if (d.finLift) {
      const a = p.ang, n = [-Math.sin(a), 0, Math.cos(a)];
      lat.push({ p, fin: true, S: d.finArea, la: d.finLift, n });
      const out = [Math.cos(a), 0, Math.sin(a)], tip = [p.pos[0] + out[0] * d.rr * 0.5, 0, p.pos[2] + out[2] * d.rr * 0.5];
      contacts.push({ p, c: [tip[0], p.pos[1] - d.h / 2, tip[2]], tol: d.tol });
      continue;
    }
    if (p.leg) {
      const a = p.ang, out = [Math.cos(a), 0, Math.sin(a)];
      lat.push({ p, A: 0.25 * d.rr * d.h, cd: 0.6, la: 0.05 });
      if (p.leg.out) contacts.push({ p, c: [p.pos[0] + out[0] * d.rr * 0.5, p.pos[1] - d.h / 2 - d.drop, p.pos[2] + out[2] * d.rr * 0.5], tol: d.tol });
      continue;
    }
    if (d.radialOnly) { lat.push({ p, A: 0.3 * d.rr * d.h, cd: 0.8, la: 0.05 }); continue; }
    const cover = (r) => r;
    const above = kidsAlive.find((k) => P[k].q.n === 't'), below = kidsAlive.find((k) => P[k].q.n === 'b');
    let topCover = above !== undefined ? P[above].def.rb : 0, botCover = below !== undefined ? P[below].def.r : 0;
    if (p.q.n === 'b' && p.parent >= 0) topCover = Math.max(topCover, P[p.parent].def.rb);
    if (p.q.n === 't' && p.parent >= 0) botCover = Math.max(botCover, P[p.parent].def.r);
    aTop += d.cdTop * Math.PI * Math.max(0, d.r * d.r - cover(topCover) ** 2);
    aBot += d.cdBot * Math.PI * Math.max(0, d.rb * d.rb - cover(botCover) ** 2);
    const A = (d.r + d.rb) * d.h;
    aLat += A;
    lat.push({ p, A, cd: 1.0, la: d.lift });
    const rr1 = d.r * 0.92, rr2 = d.rb * 0.92;
    for (let k = 0; k < 4; k++) {
      const th = k * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
      contacts.push({ p, c: [p.pos[0] + c * rr1, p.pos[1] + d.h / 2, p.pos[2] + s * rr1], tol: d.tol });
      contacts.push({ p, c: [p.pos[0] + c * rr2, p.pos[1] - d.h / 2, p.pos[2] + s * rr2], tol: d.tol });
    }
  }
  v.topY = Math.max(...alive.map((p) => p.pos[1] + p.def.h / 2), 0); v.botY = Math.min(...alive.map((p) => p.pos[1] - p.def.h / 2), 0);
  v.aTop = aTop + 0.012 * aLat; v.aBot = aBot + 0.012 * aLat;
  v.lat = lat; v.contacts = contacts;
  massProps(v);
}

export function massProps(v) {
  let M = 0, cy = [0, 0, 0];
  for (const p of v.alive) { const m = p.def.mass + p.fuel; M += m; cy[0] += m * p.pos[0]; cy[1] += m * p.pos[1]; cy[2] += m * p.pos[2]; }
  if (M <= 0) M = 1;
  const com = [cy[0] / M, cy[1] / M, cy[2] / M];
  let Ix = 0, Iy = 0, Iz = 0, torque = 0;
  for (const p of v.alive) {
    const m = p.def.mass + p.fuel, d = p.def, r2 = ((d.r + d.rb) / 2) ** 2, h = d.radialOnly ? d.rr : d.h;
    const dx = p.pos[0] - com[0], dy = p.pos[1] - com[1], dz = p.pos[2] - com[2];
    const lat = m * ((3 * r2 + h * h) / 12), roll = m * r2 / 2;
    Ix += lat + m * (dy * dy + dz * dz); Iz += lat + m * (dy * dy + dx * dx); Iy += roll + m * (dx * dx + dz * dz);
    torque += d.torque || 0;
  }
  v.mass = M; v.com = com; v.I = [Math.max(Ix, 1), Math.max(Iy, 1), Math.max(Iz, 1)];
  v.wheelTorque = torque;
  v.controllable = v.alive.some((p) => p.def.cat === 'pod');
}

// lowest point along the nose axis, used to stand the rocket on the pad
export function lowestY(v) {
  let m = Infinity;
  for (const c of v.contacts) m = Math.min(m, c.c[1] - v.com[1]);
  return m;
}

// put the vessel on the launch pad, standing up, facing east
export function placeOnPad(v, body = BODIES.cobble, headingDeg = 90) {
  const lowest = lowestY(v), up = PAD.up;
  v.r = V.mul(up, body.R + 0.03 - lowest);
  v.v = [0, 0, 0]; v.w = [0, 0, 0];
  v.q = attitude(v.r, 90, headingDeg);
  v.asleep = true; v.body = body.id;
  v.ctl.target = v.q.slice();
  v.padPos = V.mul(up, body.R);
}

// ------------------------------------------------------------------ staging
export function nextStage(v) { return v.stageList.find((s) => s >= v.stageIdx); }

export function stageNow(v, W) {
  const s = nextStage(v);
  if (s === undefined) return false;
  v.stageIdx = s + 1;
  v.events.push({ t: 'stage', n: s });
  const todo = v.parts.filter((p) => p.alive && p.stage === s);
  for (const p of todo) {
    if (!p.alive) continue;
    if (isEngine(p.def)) { p.ign = true; }
    else if (isDecoupler(p.def)) fireDecoupler(v, p, W);
    else if (p.chute) { if (p.chute.state === 'stowed') p.chute.state = 'armed'; }
  }
  return true;
}

function subtree(v, root) {
  const out = [], stack = [root];
  while (stack.length) { const i = stack.pop(); if (!v.parts[i].alive) continue; out.push(i); for (const k of v.parts[i].kids) stack.push(k); }
  return out;
}

// Cut everything hanging off `p` free as new floating pieces
function fireDecoupler(v, p, W) {
  v.stagedAny = true;
  const sep = p.def.sep || 2.5;
  const kids = p.kids.filter((k) => v.parts[k].alive);
  const oldCom = v.com.slice(), wW = Q.rot(v.q, v.w);
  const pieces = [];
  for (const k of kids) {
    const members = subtree(v, k);
    const nv = splitOff(v, members);
    // a side ring pushes its booster outward; an in-line ring pushes the lower part away
    const out = p.def.shape === 'sidering' ? [Math.cos(p.ang), 0, Math.sin(p.ang)] : (p.parent !== undefined && v.parts[k].q.n === 'b' ? [0, -1, 0] : [0, 1, 0]);
    pieces.push({ nv, dir: out, p });
  }
  rebuild(v);
  for (const pc of pieces) {
    const a = v, b = pc.nv, mA = a.mass, mB = b.mass;
    const dirW = Q.rot(v.q, pc.dir);
    const setState = (x, delta) => {
      const rel = Q.rot(v.q, V.sub(x.com, oldCom));
      x.r = V.add(v.r, rel); x.v = V.add(V.add(v.v, V.cross(wW, rel)), delta); x.q = v.q.slice(); x.w = v.w.slice(); x.body = v.body;
    };
    setState(b, V.mul(dirW, sep * mA / (mA + mB)));
    b.dRel = V.mul(dirW, -sep * mB / (mA + mB));
    b.main = false; b.ctl.sas = false; b.ctl.thr = 0; b.asleep = false;
    W.vessels.push(b);
  }
  // the part that stays gets nudged the other way and keeps its own centre of mass
  const relA = Q.rot(v.q, V.sub(v.com, oldCom));
  v.r = V.add(v.r, relA); v.v = V.add(v.v, V.cross(wW, relA));
  for (const pc of pieces) v.v = V.add(v.v, pc.nv.dRel);
  v.asleep = false;
}

// move the given parts into a brand-new vessel
function splitOff(v, memberIdx) {
  const set = new Set(memberIdx);
  const nv = {
    id: VID++, main: false, body: v.body, parts: v.parts.map((p) => (set.has(p.i) ? Object.assign({}, p, { pos: p.pos.slice(), chute: p.chute && Object.assign({}, p.chute), leg: p.leg && Object.assign({}, p.leg) }) : Object.assign({}, p, { alive: false }))),
    r: [0, 0, 0], v: [0, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0], ctl: { thr: 0, p: 0, y: 0, r: 0, sas: false, mode: 'hold', target: null, wheel: true },
    stageIdx: 99, stageList: [], asleep: false, dead: false, met: 0, sleepT: 0, events: [], maxAlt: 0, maxSpeed: 0, debris: true, easy: v.easy, name: 'Spent stage', born: 0,
  };
  for (const i of memberIdx) v.parts[i].alive = false;
  // the new piece is its own tree: the first member becomes its root (kids of dead parts stay linked by index, which is fine)
  rebuild(nv);
  return nv;
}

// a part is destroyed: boom, and whatever hung off it floats free
export function destroyPart(v, p, W, why) {
  if (!p.alive) return;
  const wp = worldPoint(v, p.pos);
  v.events.push({ t: 'boom', pos: wp, body: v.body, size: Math.max(1, Math.cbrt(p.def.mass + p.fuel) * 0.35), why, part: p.def.name });
  const kids = p.kids.filter((k) => v.parts[k].alive);
  p.alive = false;
  const isPod = p.def.cat === 'pod';
  const oldCom = v.com.slice(), wW = Q.rot(v.q, v.w);
  const pieces = kids.map((k) => splitOff(v, subtree(v, k)));
  p.fuel = 0;
  rebuild(v);
  for (const nv of pieces) {
    const rel = Q.rot(v.q, V.sub(nv.com, oldCom));
    nv.r = V.add(v.r, rel); nv.v = V.add(V.add(v.v, V.cross(wW, rel)), V.mul(V.norm(rel), 1.5)); nv.q = v.q.slice(); nv.w = v.w.slice(); nv.body = v.body; nv.debris = true; nv.main = false;
    W.vessels.push(nv);
  }
  if (isPod || !v.alive.length) { killVessel(v, W, why); return; }
  const relA = Q.rot(v.q, V.sub(v.com, oldCom));
  v.r = V.add(v.r, relA); v.v = V.add(v.v, V.cross(wW, relA));
  v.asleep = false;
}
export function killVessel(v, W, why) {
  if (v.dead) return;
  for (const p of v.alive) { if (p.alive) { v.events.push({ t: 'boom', pos: worldPoint(v, p.pos), body: v.body, size: Math.max(0.8, Math.cbrt(p.def.mass + p.fuel) * 0.3), why, part: p.def.name }); } }
  v.dead = true; v.deadWhy = why;
  for (const p of v.parts) p.alive = false;
  v.alive = []; v.engines = []; v.chutes = []; v.contacts = []; v.lat = []; v.legs = [];
}

export function worldPoint(v, bodyPt) { return V.add(v.r, Q.rot(v.q, V.sub(bodyPt, v.com))); }

// ------------------------------------------------------------------ controls
function sasDirection(v, W) {
  const r = v.r, vel = v.v, sp = V.len(vel), rn = V.norm(r);
  const pro = sp > 0.5 ? V.mul(vel, 1 / sp) : rn;
  const hh = V.norm(V.cross(r, vel.some((x) => x !== 0) ? vel : [0, 0, -1]));
  switch (v.ctl.mode) {
    case 'prograde': return pro;
    case 'retro': return V.neg(pro);
    case 'normal': return hh;
    case 'anti': return V.neg(hh);
    case 'radial': return V.norm(V.sub(rn, V.mul(pro, V.dot(rn, pro))));
    case 'radialIn': return V.neg(V.norm(V.sub(rn, V.mul(pro, V.dot(rn, pro)))));
    case 'up': return rn;
    case 'node': { const nb = W && W.node && W.node.body === v.body ? nodeBurn(W, W.node, v) : null; return nb && nb.remMag > 0.05 ? V.mul(nb.rem, 1 / nb.remMag) : null; }
    default: return null;
  }
}

function engineAuthority(v) {
  // gimbal turning power from running engines
  let tx = 0, tz = 0;
  for (const e of v.engines) {
    if (!e.ign || e.thrust <= 0 || !e.def.gimbal) continue;
    const lever = Math.abs(e.pos[1] - v.com[1]) + 0.3, s = Math.sin(e.def.gimbal * DEG);
    tx += e.thrust * lever * s; tz += e.thrust * lever * s;
  }
  return [tx, tz];
}

function controlTorque(v, dt, easy, W) {
  const c = v.ctl, I = v.I;
  if (!v.controllable) return [0, 0, 0];
  const [gx, gz] = engineAuthority(v);
  const boost = easy ? 2.2 : 1;
  const wt = (c.wheel ? v.wheelTorque : 0) * boost * 1.8;
  const tmax = [wt + gx * (easy ? 1.5 : 1), wt * 0.8, wt + gz * (easy ? 1.5 : 1)];
  const hasIn = c.p !== 0 || c.y !== 0 || c.r !== 0;
  if (!c.sas) {
    // raw torque: x pitch (W = nose toward front), z yaw (D = nose right), y roll
    return [c.p * tmax[0], c.r * tmax[1], c.y * tmax[2]];
  }
  const w = v.w, out = [0, 0, 0];
  let e = [0, 0, 0];                       // rotation error in body axes (radians)
  const dirW = sasDirection(v, W);
  if (hasIn) {
    c.target = v.q.slice();                // follow the player's inputs, hold wherever they let go
  } else if (dirW) {
    const db = Q.rotInv(v.q, dirW), ang = Math.acos(clamp(db[1], -1, 1));
    const ax = V.cross([0, 1, 0], db), al = V.len(ax);
    if (al > 1e-9) e = V.mul(ax, ang / al);
  } else if (c.target) {
    const qe = Q.mul(Q.conj(v.q), c.target);
    const s = qe[3] < 0 ? -1 : 1, sn = Math.hypot(qe[0], qe[1], qe[2]);
    const ang = 2 * Math.atan2(sn, Math.abs(qe[3]));
    if (sn > 1e-9) e = [s * qe[0] / sn * ang, s * qe[1] / sn * ang, s * qe[2] / sn * ang];
  }
  const rate = [0.55, 0.9, 0.55];
  for (let k = 0; k < 3; k++) {
    const am = tmax[k] / I[k];                                     // angular acceleration we can make
    let want;
    if (hasIn) { const input = k === 0 ? c.p : k === 1 ? c.r : c.y; want = input * rate[k]; }
    else { const mag = Math.abs(e[k]); want = Math.sign(e[k]) * Math.min(1.6 * mag, Math.sqrt(2 * 0.55 * am * mag), 1.2); }
    const t = I[k] * (want - w[k]) / 0.25;
    out[k] = clamp(t, -tmax[k], tmax[k]);
  }
  return out;
}

// ------------------------------------------------------------------ one physics step for one vessel
export function stepVessel(v, W, dt) {
  if (v.dead) return;
  const body = BODIES[v.body], mu = body.GM;
  v.met += dt;
  massProps(v);
  const rn = V.len(v.r), up = V.mul(v.r, 1 / rn), alt = rn - body.R;
  const rho = density(body, alt), pFrac = body.atm ? clamp(rho / body.atm.rho0, 0, 1) : 0;
  const M = v.mass, com = v.com, g = mu / (rn * rn);
  const easy = v.easy;
  const ctl = v.ctl;

  // ---- engines
  const pool = new Array(v.nSeg).fill(0), need = new Array(v.nSeg).fill(0);
  for (const p of v.alive) if (p.def.fuel && !p.def.solid) pool[p.seg] += p.fuel;
  for (const e of v.engines) {
    e.thrust = 0; e.want = 0;
    if (!e.ign || e.out) continue;
    const d = e.def, thr = d.solid ? 1 : ctl.thr;
    if (thr <= 0) continue;
    e.want = d.F / (d.ispVac * G0) * thr * dt; e.thr = thr;
    if (!d.solid) need[e.seg] += e.want;
  }
  const Fb = [0, 0, 0], Tb = [0, 0, 0];
  let thrustTot = 0;
  for (const e of v.engines) {
    if (e.want <= 0) continue;
    const d = e.def;
    let scale;
    if (d.solid) { scale = Math.min(1, e.fuel / e.want); e.fuel -= e.want * scale; if (e.fuel <= 1e-6) { e.fuel = 0; e.out = true; v.events.push({ t: 'burnout', part: d.name }); } }
    else { scale = need[e.seg] > 0 ? Math.min(1, pool[e.seg] / need[e.seg]) : 0; if (scale <= 1e-9 && !e.starved) { e.starved = true; v.events.push({ t: 'flameout', part: d.name }); } }
    if (scale <= 0) continue;
    const isp = lerp(d.ispVac, d.ispAsl, pFrac);
    const F = e.thr * d.F * (isp / d.ispVac) * scale;
    e.thrust = F; thrustTot += F;
    Fb[1] += F;
    const rel = [e.pos[0] - com[0], e.pos[1] - com[1], e.pos[2] - com[2]];
    Tb[0] += rel[1] * 0 - rel[2] * F; Tb[2] += rel[0] * F;          // r x (0,F,0)
  }
  // take the burned fuel out of the tanks of each segment
  for (let s = 0; s < v.nSeg; s++) {
    if (need[s] <= 0 || pool[s] <= 0) continue;
    const burn = Math.min(need[s], pool[s]), ratio = burn / pool[s];
    for (const p of v.alive) if (p.seg === s && p.def.fuel && !p.def.solid) p.fuel -= p.fuel * ratio;
  }

  // ---- air
  const vRel = v.v;                                              // the planet does not spin, the air is still
  const speed = V.len(vRel);
  const vb = Q.rotInv(v.q, vRel);
  if (rho > 1e-7 && speed > 0.01) {
    const mach = speed / SOUND, mf = 1 + 0.9 * Math.exp(-(((mach - 1.05) / 0.28) ** 2)) + (mach > 1.3 ? 0.15 : 0);
    const dyn = 0.5 * rho;
    const A = vb[1] > 0 ? v.aTop : v.aBot;
    Fb[1] += -Math.sign(vb[1]) * dyn * vb[1] * vb[1] * A * mf;
    const aeroScale = easy ? 0.6 : 1;
    for (const L of v.lat) {
      if (!L.p.alive) continue;
      const rel = [L.p.pos[0] - com[0], L.p.pos[1] - com[1], L.p.pos[2] - com[2]];
      // local air speed includes the spin
      const vi = [vb[0] + v.w[1] * rel[2] - v.w[2] * rel[1], vb[1] + v.w[2] * rel[0] - v.w[0] * rel[2], vb[2] + v.w[0] * rel[1] - v.w[1] * rel[0]];
      let fx, fz;
      if (L.fin) {
        const u = vi[0] * L.n[0] + vi[2] * L.n[2];
        const fm = -dyn * L.S * (L.la * Math.abs(vi[1]) + 1.2 * Math.abs(u)) * u * (easy ? 1.3 : 1);
        fx = L.n[0] * fm; fz = L.n[2] * fm;
      } else {
        const vl = Math.hypot(vi[0], vi[2]);
        const k = -dyn * (L.cd * L.A * vl + L.la * L.A * Math.abs(vi[1])) * aeroScale;
        fx = k * vi[0]; fz = k * vi[2];
      }
      Fb[0] += fx; Fb[2] += fz;
      Tb[0] += rel[1] * fz; Tb[1] += rel[2] * fx - rel[0] * fz; Tb[2] -= rel[1] * fx;
    }
  }

  // ---- parachutes
  for (const c of v.chutes) {
    const ch = c.chute, d = c.def;
    const agl = alt;
    if (easy && ch.state === 'stowed' && v.flew && alt < 30000 && V.dot(v.v, up) < -3 && thrustTot <= 0) { ch.state = 'armed'; v.events.push({ t: 'chute', what: 'auto' }); }
    if (ch.state === 'stowed' || ch.state === 'cut') { ch.open = ch.state === 'cut' ? 0 : ch.open; continue; }
    const qn = 0.5 * rho * speed * speed;
    if (ch.state === 'armed') { if (rho > 0.02 && V.dot(v.v, up) < 2 && (speed < 330 || qn < 20000)) { ch.state = 'semi'; v.events.push({ t: 'chute', what: 'semi' }); } else continue; }
    if (ch.state === 'semi' && agl < (easy ? 2600 : 1400) && speed < 300) {
      ch.state = 'full'; v.events.push({ t: 'chute', what: 'open' });
    }
    if ((ch.state === 'full' || ch.state === 'semi') && qn > 60000 && !easy) { ch.state = 'cut'; ch.open = 0; v.events.push({ t: 'chute', what: 'tear' }); continue; }
    const target = ch.state === 'semi' ? 0.22 : 1;
    ch.open += clamp(target - ch.open, -dt * 0.6, dt * (ch.state === 'full' ? 0.35 : 0.5));
    const area = d.chuteArea * ch.open * ch.open;
    if (area > 0 && rho > 1e-7 && speed > 0.01) {
      let k = -0.5 * rho * area * speed;
      const kmax = 14 * M * g / speed;                            // a parachute can only pull so hard
      if (-k > kmax) k = -kmax;
      const fvec = [k * vb[0], k * vb[1], k * vb[2]];
      // pulls from above the pod so the rocket hangs nose-up
      const att = [c.pos[0] - com[0], c.pos[1] - com[1] + 1.2, c.pos[2] - com[2]];
      Fb[0] += fvec[0]; Fb[1] += fvec[1]; Fb[2] += fvec[2];
      const cr = V.cross(att, fvec);
      Tb[0] += cr[0]; Tb[1] += cr[1]; Tb[2] += cr[2];
    }
  }
  // ---- control
  const ct = controlTorque(v, dt, easy, W);

  // ---- ground
  const Fcw = [0, 0, 0], Tcw = [0, 0, 0];
  let touching = 0, worstImpact = 0, worstPart = null;
  if (alt < 60) {
    const wW = Q.rot(v.q, v.w);
    const tolMul = easy ? 1.8 : 1;
    const crashed = [], hit = [];
    for (const cp of v.contacts) {
      if (!cp.p.alive) continue;
      const rb = [cp.c[0] - com[0], cp.c[1] - com[1], cp.c[2] - com[2]];
      const rw = Q.rot(v.q, rb), pw = V.add(v.r, rw), pl = V.len(pw), depth = body.R - pl;
      if (depth > 0) hit.push({ cp, rw, pl, depth, pw });
    }
    const cnt = hit.length;
    if (cnt) {
      const w0 = 2 * Math.PI * 7, mp = M / cnt, k = mp * w0 * w0, cdamp = 2 * 0.8 * mp * w0;
      for (const h of hit) {
        const { cp, rw, pl, depth, pw } = h;
        const nrm = V.mul(pw, 1 / pl);
        const vp = V.add(v.v, V.cross(wW, rw)), vn = V.dot(vp, nrm);
        touching++;
        if (-vn > cp.tol * tolMul && -vn > worstImpact) { worstImpact = -vn; worstPart = cp.p; crashed.push(cp.p); }
        let N = k * depth - cdamp * vn; if (N < 0) N = 0; N = Math.min(N, mp * 3000);
        const vt = V.sub(vp, V.mul(nrm, vn)), vtl = V.len(vt);
        let F = V.mul(nrm, N);
        if (vtl > 1e-5) {
          const fmax = 0.9 * N, fneed = mp * vtl / dt * 0.5, fm = Math.min(fmax, fneed);
          F = V.add(F, V.mul(vt, -fm / vtl));
        }
        Fcw[0] += F[0]; Fcw[1] += F[1]; Fcw[2] += F[2];
        const cr = V.cross(rw, F); Tcw[0] += cr[0]; Tcw[1] += cr[1]; Tcw[2] += cr[2];
      }
    }
    if (crashed.length) { const seen = new Set(); for (const p of crashed) seen.add(p.i); v.pendingBreaks = [...seen]; }
  }
  v.touching = touching;

  // ---- wake / sleep on the ground
  const thrustUp = Q.rot(v.q, [0, Fb[1], 0]);
  if (v.asleep) {
    if (V.dot(thrustUp, up) >= M * g * 0.98 && thrustTot > 0) { v.asleep = false; v.sleepT = 0; }
    else { v.v = [0, 0, 0]; v.w = [0, 0, 0]; return; }
  }

  // ---- integrate
  const Fw = Q.rot(v.q, Fb);
  const ax = (Fw[0] + Fcw[0]) / M - mu * v.r[0] / (rn * rn * rn), ay = (Fw[1] + Fcw[1]) / M - mu * v.r[1] / (rn * rn * rn), az = (Fw[2] + Fcw[2]) / M - mu * v.r[2] / (rn * rn * rn);
  v.v[0] += ax * dt; v.v[1] += ay * dt; v.v[2] += az * dt;
  v.r[0] += v.v[0] * dt; v.r[1] += v.v[1] * dt; v.r[2] += v.v[2] * dt;
  v.lastAccel = [ax, ay, az];
  const Tc = Q.rotInv(v.q, Tcw);
  const I = v.I, w = v.w;
  const tx = Tb[0] + ct[0] + Tc[0], ty = Tb[1] + ct[1] + Tc[1], tz = Tb[2] + ct[2] + Tc[2];
  w[0] += ((tx - (I[2] - I[1]) * w[1] * w[2]) / I[0]) * dt;
  w[1] += ((ty - (I[0] - I[2]) * w[2] * w[0]) / I[1]) * dt;
  w[2] += ((tz - (I[1] - I[0]) * w[0] * w[1]) / I[2]) * dt;
  const wl = Math.hypot(w[0], w[1], w[2]);
  if (wl > 12) { w[0] *= 12 / wl; w[1] *= 12 / wl; w[2] *= 12 / wl; }
  v.q = Q.integrate(v.q, w, dt);

  // ---- resting on the ground? go to sleep so it doesn't jitter
  if (touching && speed < 0.12 && wl < 0.06 && thrustTot < M * g * 0.6) {
    v.sleepT += dt;
    if (v.sleepT > 0.6) { v.asleep = true; v.v = [0, 0, 0]; v.w = [0, 0, 0]; v.events.push({ t: 'rest' }); }
  } else v.sleepT = 0;

  if (alt > v.maxAlt && !v.debris) v.maxAlt = alt;
  if (speed > v.maxSpeed) v.maxSpeed = speed;
  if (!v.debris && alt > 15 && !v.touchedDown) v.flew = true;

  // ---- hard landing breaks the part that hit
  if (v.pendingBreaks) {
    const list = v.pendingBreaks; v.pendingBreaks = null;
    v.events.push({ t: 'crash', speed: worstImpact });
    for (const i of list) { const p = v.parts[i]; if (p.alive && !v.dead) destroyPart(v, p, W, 'crash'); }
  }
}

// Orbit numbers for the heads-up display
export function telemetry(v, W) {
  const body = BODIES[v.body], mu = body.GM, rn = V.len(v.r), speed = V.len(v.v);
  const up = V.mul(v.r, 1 / rn), alt = rn - body.R, vr = V.dot(v.v, up);
  const el = elements(mu, v.r, v.v);
  const f = localFrame(v.r);
  const noseW = Q.rot(v.q, [0, 1, 0]), frontW = Q.rot(v.q, [0, 0, 1]);
  const pitch = Math.asin(clamp(V.dot(noseW, up), -1, 1)) / DEG;
  let heading = Math.atan2(V.dot(noseW, f.east), V.dot(noseW, f.north)) / DEG; if (heading < 0) heading += 360;
  const rho = density(body, alt), thrust = v.engines.reduce((s, e) => s + e.thrust, 0);
  return {
    body: body.id, alt, speed, vspeed: vr, hspeed: Math.sqrt(Math.max(0, speed * speed - vr * vr)), mass: v.mass, thrust, twr: thrust / (v.mass * mu / (rn * rn)),
    ap: el.bound ? el.ra - body.R : Infinity, pe: el.rp - body.R, ecc: el.e, period: el.period, incl: el.incl / DEG, el,
    pitch, heading, rho, q: 0.5 * rho * speed * speed, mach: speed / SOUND, thr: v.ctl.thr, met: v.met,
    accelG: v.lastAccel ? V.len(v.lastAccel) / G0 : 0, nose: noseW, front: frontW, up, frame: f,
  };
}

// ------------------------------------------------------------------ the world: all vessels + clock
export function createWorld(opts = {}) {
  return { ut: opts.ut || 0, vessels: [], main: null, easy: !!opts.easy, events: [], time: 0 };
}

export function addMain(W, design, opts = {}) {
  const v = createVessel(design, { easy: W.easy, main: true });
  placeOnPad(v);
  W.vessels = [v]; W.main = v;
  return v;
}

// Which planet's pull is the vessel under? Switch when it crosses the moon's edge.
function checkSOI(v, W) {
  const bean = BODIES.bean, bs = beanState(W.ut);
  if (v.body === 'cobble') {
    const d = V.len(V.sub(v.r, bs.r));
    if (d < bean.soi * 0.995) { v.r = V.sub(v.r, bs.r); v.v = V.sub(v.v, bs.v); v.body = 'bean'; v.events.push({ t: 'soi', body: 'bean' }); }
  } else if (v.body === 'bean') {
    if (V.len(v.r) > bean.soi * 1.005) { v.r = V.add(v.r, bs.r); v.v = V.add(v.v, bs.v); v.body = 'cobble'; v.events.push({ t: 'soi', body: 'cobble' }); }
  }
}

export function stepWorld(W, dt) {
  W.ut += dt;
  for (const v of W.vessels) {
    stepVessel(v, W, dt);
    if (!v.dead) checkSOI(v, W);
  }
  // collect events, drop dead / far debris
  for (const v of W.vessels) { if (v.events.length) { for (const e of v.events) W.events.push(Object.assign({ vid: v.id, main: v === W.main }, e)); v.events.length = 0; } }
  if (W.vessels.length > 14) { let drop = W.vessels.length - 14; W.vessels = W.vessels.filter((v) => { if (v === W.main || drop <= 0 || !v.debris) return true; drop--; return false; }); }
  W.vessels = W.vessels.filter((v, i) => {
    if (v === W.main) return true;
    if (v.dead) return false;
    if (v.debris && v.asleep && v.met > 5) { if (v.parts.length) return v.keepTimer === undefined ? (v.keepTimer = 20, true) : (v.keepTimer -= dt) > 0; }
    return true;
  });
}

// Time warp on rails: only when nothing is pushing the ship and it is outside the air (or sitting still on the ground)
export function canRails(W) {
  const v = W.main;
  if (!v || v.dead) return false;
  if (v.asleep) return true;
  const body = BODIES[v.body], alt = V.len(v.r) - body.R;
  const air = body.atm ? body.atm.top : 0;
  if (alt < air + 1000 || v.touching) return false;
  if (v.engines.some((e) => e.thrust > 0)) return false;
  return true;
}

export function railsStep(W, dt) {
  W.ut += dt;
  for (const v of W.vessels) {
    if (v.dead) continue;
    v.met += dt;
    if (v.asleep) continue;
    const body = BODIES[v.body];
    const s = propagate(body.GM, v.r, v.v, dt);
    v.r = s.r; v.v = s.v;
    // keep pointing where SAS wants
    const d = sasDirection(v, W);
    if (d && v.ctl.sas && v.controllable) { const nose = Q.rot(v.q, [0, 1, 0]); v.q = Q.norm(Q.mul(Q.fromTo(nose, d), v.q)); v.w = [0, 0, 0]; }
    else v.w = [0, 0, 0];
    checkSOI(v, W);
    if (v.debris) continue;
  }
}

// seconds until the main vessel hits the atmosphere or the ground, or Infinity (used to stop time warp)
export function timeToAir(W) {
  const v = W.main, body = BODIES[v.body];
  const el = elements(body.GM, v.r, v.v);
  if (!body.atm) return Infinity;
  const target = body.R + body.atm.top + 1500;
  if (el.rp >= target) return Infinity;
  if (V.len(v.r) <= target) return 0;
  // true anomaly where the orbit comes down to `target`
  const c = (el.p / target - 1) / el.e;
  if (!(Math.abs(c) <= 1) || el.e < 1e-9) return Infinity;
  const nuT = -Math.acos(c);
  const E = el.bound ? 2 * Math.atan2(Math.sqrt(1 - el.e) * Math.sin(nuT / 2), Math.sqrt(1 + el.e) * Math.cos(nuT / 2)) : 0;
  if (!el.bound) return Infinity;
  const MT = E - el.e * Math.sin(E);
  let dM = MT - el.M; dM = ((dM % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return dM / el.n;
}

// ------------------------------------------------------------------ builder numbers: mass, thrust, delta-v per stage
export function analyze(design) {
  const out = { ok: false, warnings: [], stages: [], mass: 0, dry: 0, fuel: 0, thrustAsl: 0, thrustVac: 0, twrAsl: 0, twrVac: 0, dv: 0, parts: design.parts.length };
  if (!design.parts.length) return out;
  const v = createVessel(design);
  const hasPod = v.alive.some((p) => p.def.cat === 'pod');
  out.hasPod = hasPod;
  out.mass = v.mass;
  out.fuel = v.alive.reduce((s, p) => s + p.fuel, 0);
  out.dry = out.mass - out.fuel;
  out.com = v.com; out.height = Math.max(...v.alive.map((p) => p.pos[1] + p.def.h / 2)) - Math.min(...v.alive.map((p) => p.pos[1] - p.def.h / 2));
  const g0 = BODIES.cobble.GM / (BODIES.cobble.R ** 2);
  // first-stage engines: those lit at stage 0 (or with no stage rings, all engines)
  const first = v.engines.filter((e) => e.stage === (v.stageList[0] ?? 0) || e.stage === 0);
  const f0 = first.length ? first : v.engines;
  out.thrustVac = f0.reduce((s, e) => s + e.def.F, 0);
  out.thrustAsl = f0.reduce((s, e) => s + e.def.F * e.def.ispAsl / e.def.ispVac, 0);
  out.twrAsl = out.thrustAsl / (out.mass * g0);
  out.twrVac = out.thrustVac / (out.mass * g0);
  // walk through the stages, burning each in a vacuum
  const alive = new Set(v.alive.map((p) => p.i));
  const fuel = v.parts.map((p) => p.fuel);
  const ign = new Set();
  const stageNums = v.stageList.slice();
  const massNow = () => { let m = 0; for (const i of alive) m += v.parts[i].def.mass + fuel[i]; return m; };
  const sub = (root) => { const o = [], st = [root]; while (st.length) { const i = st.pop(); if (!alive.has(i)) continue; o.push(i); st.push(...v.parts[i].kids); } return o; };
  let total = 0;
  for (let si = 0; si < stageNums.length; si++) {
    const s = stageNums[si];
    for (const i of [...alive]) {
      const p = v.parts[i];
      if (!alive.has(i) || p.stage !== s) continue;
      if (isEngine(p.def)) ign.add(i);
      else if (isDecoupler(p.def)) for (const k of p.kids) for (const j of sub(k)) { alive.delete(j); ign.delete(j); }
    }
    let dvS = 0, twr0 = 0, burn = 0, first = true, m0s = massNow();
    // what the next stage ring will let go of: this stage ends when the engines in it have run dry
    const dropSet = (() => { const ns = stageNums[si + 1]; if (ns === undefined) return null; const set = new Set(); for (const i of alive) { const p = v.parts[i]; if (p.stage === ns && isDecoupler(p.def)) for (const k of p.kids) for (const j of sub(k)) set.add(j); } return [...set].some((j) => isEngine(v.parts[j].def)) ? set : null; })();
    for (let guard = 0; guard < 40; guard++) {
      const act = [...ign].filter((i) => alive.has(i) && (v.parts[i].def.solid ? fuel[i] > 1e-6 : true));
      const pools = {}; for (const i of alive) { const p = v.parts[i]; if (p.def.fuel && !p.def.solid) pools[p.seg] = (pools[p.seg] || 0) + fuel[i]; }
      const live = act.filter((i) => v.parts[i].def.solid || (pools[v.parts[i].seg] || 0) > 1e-6);
      if (!live.length) break;
      if (dropSet && !live.some((i) => dropSet.has(i))) break;
      let Fv = 0, mdot = 0; const segMdot = {};
      for (const i of live) { const d = v.parts[i].def; const md = d.F / (d.ispVac * G0); Fv += d.F; mdot += md; if (!d.solid) segMdot[v.parts[i].seg] = (segMdot[v.parts[i].seg] || 0) + md; }
      let dt = Infinity;
      for (const i of live) { const p = v.parts[i]; const d = p.def; if (d.solid) dt = Math.min(dt, fuel[i] / (d.F / (d.ispVac * G0))); }
      for (const sg of Object.keys(segMdot)) dt = Math.min(dt, pools[sg] / segMdot[sg]);
      const m0 = massNow(), dm = mdot * dt, m1 = m0 - dm;
      if (!(dt > 0) || !isFinite(dt) || m1 <= 0) break;
      const ispEff = Fv / (mdot * G0);
      dvS += ispEff * G0 * Math.log(m0 / m1);
      if (first) {
        twr0 = live.reduce((x, i) => x + v.parts[i].def.F * v.parts[i].def.ispAsl / v.parts[i].def.ispVac, 0) / (m0 * g0); first = false;
      }
      burn += dt;
      for (const i of live) { const p = v.parts[i]; if (p.def.solid) fuel[i] -= (p.def.F / (p.def.ispVac * G0)) * dt; }
      for (const sg of Object.keys(segMdot)) { const tot = pools[sg], take = segMdot[sg] * dt; for (const i of alive) { const p = v.parts[i]; if (String(p.seg) === sg && p.def.fuel && !p.def.solid) fuel[i] -= fuel[i] * take / tot; } }
    }
    if (dvS > 0.5) out.stages.push({ stage: s, dv: dvS, twr: twr0, burn, mass: m0s });
    total += dvS;
  }
  out.dv = total;
  // warnings
  if (!hasPod) out.warnings.push('Add a pod or a Brain Box so someone can steer.');
  if (!v.engines.length) out.warnings.push('Add an engine to the bottom.');
  else if (out.twrAsl < 1) out.warnings.push('Too heavy to lift off! Add power or take weight off.');
  else if (out.twrAsl < 1.25) out.warnings.push('Barely lifts off. More thrust is better.');
  if (v.engines.length && !v.chutes.length) out.warnings.push('No parachute: you will not be able to land softly.');
  if (v.engines.length && !v.alive.some((p) => p.def.finLift) && out.height > 6) out.warnings.push('Tall rocket with no fins can wobble in the air.');
  out.ok = hasPod && v.engines.length > 0 && out.twrAsl >= 1;
  return out;
}

// Will a path (starting at time ut0 with state r0, v0 around Cobble) fly into the moon's pull? Returns the entry point (relative to the moon) or null.
export function predictEncounterFrom(ut0, r0, v0) {
  const cob = BODIES.cobble, bean = BODIES.bean, mu = cob.GM, soi = bean.soi;
  const el = elements(mu, r0, v0);
  const span = el.bound ? Math.min(el.period * 2, 3e6) : 3e6;
  let t = 0, prev = 0;
  for (let it = 0; it < 2500 && t < span; it++) {
    const s = propagate(mu, r0, v0, t), b = beanState(ut0 + t), d = V.len(V.sub(s.r, b.r));
    if (d < soi) {
      let lo = prev, hi = t;
      for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2, sm = propagate(mu, r0, v0, mid), bm = beanState(ut0 + mid); if (V.len(V.sub(sm.r, bm.r)) < soi) hi = mid; else lo = mid; }
      const s2 = propagate(mu, r0, v0, hi), b2 = beanState(ut0 + hi);
      const rel = V.sub(s2.r, b2.r), relV = V.sub(s2.v, b2.v);
      return { t: hi, tAt: ut0 + hi, rel, relV, el: elements(bean.GM, rel, relV), beanPos: b2.r, shipPos: s2.r };
    }
    prev = t; t += Math.max(20, Math.min(1500, (d - soi) / (V.len(s.v) + 700) * 0.7));
  }
  return null;
}
export function predictEncounter(W) {
  const v = W.main;
  if (!v || v.dead || v.body !== 'cobble' || v.asleep) return null;
  if (V.len(v.r) - BODIES.cobble.R < BODIES.cobble.atm.top) return null;
  const e = predictEncounterFrom(W.ut, v.r, v.v);
  return e;
}

// A planned burn ("node"): where it happens and how much to push prograde / sideways (normal) / outward (radial)
export function makeNode(W, kind, p = 0, n = 0, r = 0) {
  const v = W.main, body = BODIES[v.body], el = elements(body.GM, v.r, v.v);
  let t = 300;
  if (kind === 'ap' && el.bound) t = timeToApoapsis(el); else if (kind === 'pe') t = timeToPeriapsis(el);
  if (!isFinite(t) || t < 20) t = 300;
  const base = propagate(body.GM, v.r, v.v, t);
  return { ut: W.ut + t, p, n, r, body: v.body, base: { r: base.r, v: base.v } };
}
function timeToApoapsis(el) { const M = ((Math.PI - el.M) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return M / el.n; }
function timeToPeriapsis(el) { if (!el.bound) return -el.M / el.n; return (2 * Math.PI - (((el.M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))) / el.n; }
export function nodeBurn(W, node, v) {
  v = v || W.main;
  const body = BODIES[node.body], mu = body.GM, b = node.base;
  const pro = V.norm(b.v), h = V.norm(V.cross(b.r, b.v)), rn = V.norm(b.r);
  const rad = V.norm(V.sub(rn, V.mul(pro, V.dot(rn, pro))));
  const dv = V.add(V.add(V.mul(pro, node.p), V.mul(h, node.n)), V.mul(rad, node.r));
  const vPost = V.add(b.v, dv), mag = V.len(dv);
  const now = propagate(mu, b.r, vPost, W.ut - node.ut);
  const pre = W.ut < node.ut, rem = pre ? dv : V.sub(now.v, v.v), remMag = pre ? mag : V.len(rem);
  const F = v.engines.filter((e) => e.ign && !e.out && !e.starved).reduce((s, e) => s + e.def.F, 0) || v.engines.reduce((s, e) => s + e.def.F, 0);
  return { dt: node.ut - W.ut, dv, mag, rem, remMag, el: elements(mu, b.r, vPost), burnTime: F > 0 ? mag / (F / v.mass) : Infinity, vPost, pos: b.r };
}
