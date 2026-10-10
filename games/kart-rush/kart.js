// KART RUSH - the karts: arcade driving (grip, drifting with mini-turbos, boosts, spin-outs), the toon kart model, and the items.
import { THREE, V3, scene, toon, clamp, lerp, rnd, angDiff, burst, ring, sfx, W, QL, TAU, INK } from './core.js?v=2';
import { nearest, pointAt, SHOULDER, KERB } from './track.js?v=2';

export const CLASSES = [
  { id: 'balanced', name: 'Balanced', top: 44, acc: 1.0, turn: 1.0, drift: 1.0, desc: 'Good at everything.' },
  { id: 'speedy', name: 'Speedy', top: 47, acc: .8, turn: .88, drift: .9, desc: 'Fastest on the straights, slower to get going.' },
  { id: 'zippy', name: 'Zippy', top: 41, acc: 1.3, turn: 1.15, drift: 1.2, desc: 'Quick off corners with great drifts.' },
];
export const ITEMS = { turbo: { name: 'TURBO', col: '#ffb02a' }, rocket: { name: 'ROCKET', col: '#ff4a4a' }, banana: { name: 'OIL SLICK', col: '#6a5cff' }, shield: { name: 'SHIELD', col: '#4aa8ff' }, zap: { name: 'ZAP', col: '#ffe14a' } };
const TIERS = [.8, 1.6, 2.5], TIER_BOOST = [.6, 1.1, 1.7], TIER_COL = [0x4aa8ff, 0xffa02a, 0xd44aff];
const dark = toon(0x2a2140), vcol = toon(0xffffff, { vertexColors: true }); dark.userData.shared = vcol.userData.shared = true;

// ---------------------------------------------------------------- the model
function merge(list) {
  const pos = [], nor = [], col = [];
  for (const [geo, color] of list) { const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.userData.shared = true; return out;
}
const T = (g, x, y, z) => g.translate(x, y, z);
let GEO = null;
function geos() {
  if (GEO) return GEO; GEO = {};
  GEO.body = merge([[T(new THREE.BoxGeometry(1.8, .5, 3.1), 0, .62, 0), 0xffffff], [T(new THREE.BoxGeometry(1.4, .36, 1.2), 0, .85, 1.15), 0xffffff], [T(new THREE.BoxGeometry(2.0, .14, .6), 0, 1.45, -1.55), 0xffffff]]);
  GEO.trim = merge([[T(new THREE.BoxGeometry(.14, .7, .14), -.7, 1.1, -1.5), 0x2a2140], [T(new THREE.BoxGeometry(.14, .7, .14), .7, 1.1, -1.5), 0x2a2140], [T(new THREE.BoxGeometry(1.2, .2, .5), 0, .42, 1.75), 0x2a2140], [T(new THREE.BoxGeometry(.9, .45, .8), 0, .95, -.55), 0x2a2140],
    [T(new THREE.SphereGeometry(.4, 14, 10), 0, 1.58, -.55), 0xf4f0ff], [T(new THREE.BoxGeometry(.5, .16, .2), 0, 1.6, -.2), 0x2a2140], [T(new THREE.CylinderGeometry(.02, .02, .3, 6), 0, 2.05, -.55), 0x2a2140]]);
  GEO.hullBody = (() => { const g = GEO.body.clone(); const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * .06, p.getY(i) + n.getY(i) * .06, p.getZ(i) + n.getZ(i) * .06); g.userData.shared = true; return g; })();
  GEO.wheel = new THREE.CylinderGeometry(.46, .46, .42, 14); GEO.wheel.rotateZ(Math.PI / 2); GEO.wheel.userData.shared = true;
  GEO.flame = new THREE.ConeGeometry(.35, 1.6, 8); GEO.flame.rotateX(-Math.PI / 2); GEO.flame.translate(0, 0, -.8); GEO.flame.userData.shared = true;
  GEO.blob = new THREE.CircleGeometry(1.5, 16); GEO.blob.userData.shared = true; GEO.bubble = new THREE.SphereGeometry(2.2, 18, 12); GEO.bubble.userData.shared = true; return GEO;
}
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa02a, transparent: true, opacity: .85 }), bubbleMat = new THREE.MeshBasicMaterial({ color: 0x6ac8ff, transparent: true, opacity: .28, depthWrite: false }), blobMat = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .35, depthWrite: false });
for (const m of [flameMat, bubbleMat, blobMat]) m.userData.shared = true;
export function makeKartModel(color) {
  const G = geos(), g = new THREE.Group(), mat = toon(color), body = new THREE.Mesh(G.body, mat), trim = new THREE.Mesh(G.trim, vcol); body.castShadow = trim.castShadow = QL.shadow > 0; g.add(body, trim);
  if (QL.hull) g.add(new THREE.Mesh(G.hullBody, INK));
  const wheels = []; for (const [x, z, front] of [[-1.0, 1.05, 1], [1.0, 1.05, 1], [-1.0, -1.05, 0], [1.0, -1.05, 0]]) { const piv = new THREE.Group(); piv.position.set(x, .46, z); const w = new THREE.Mesh(G.wheel, dark); piv.add(w); g.add(piv); wheels.push({ piv, w, front }); }
  const flame = new THREE.Mesh(G.flame, flameMat); flame.position.set(0, .8, -1.6); flame.visible = false; g.add(flame);
  const bubble = new THREE.Mesh(G.bubble, bubbleMat); bubble.position.y = 1.1; bubble.visible = false; g.add(bubble);
  const blob = new THREE.Mesh(G.blob, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = .05; g.add(blob);
  return { g, mat, wheels, flame, bubble, body, blob };
}

// ---------------------------------------------------------------- a kart
let nextId = 0;
export class Kart {
  constructor(o) {
    this.id = nextId++; this.name = o.name; this.color = o.color; this.cls = o.cls || CLASSES[0]; this.isPlayer = !!o.isPlayer; this.ai = o.ai || null; this.model = makeKartModel(this.color); scene.add(this.model.g);
    this.p = new V3(); this.h = 0; this.vx = 0; this.vz = 0; this.vf = 0; this.y = 0; this.vy = 0; this.yawVis = 0; this.in = { thr: 0, brk: 0, steer: 0, drift: false, item: false, itemPressed: false };
    this.boostT = 0; this.drift = { on: false, dir: 0, t: 0, tier: 0 }; this.spinT = 0; this.slowT = 0; this.shield = 0; this.invul = 0; this.item = null; this.itemGet = 0; this.offroad = false; this.ice = false; this.hint = -1;
    this.dist = 0; this.prevS = 0; this.lap = 0; this.finished = false; this.finishT = 0; this.place = 1; this.s = 0; this.d = 0; this.wrong = 0; this.stuck = 0; this.bumpCD = 0; this.steerVis = 0; this.wheelRot = 0; this.top = 0; this.lapT = 0; this.bestLap = 0; this.lapTimes = []; this.points = 0; this.auto = false; this.stopped = false; this.rampT = 0;
  }
  place0(tr, s, lat) { const p = pointAt(tr, s, lat); this.p.set(p.x, p.y, p.z); this.y = p.y; this.h = Math.atan2(p.tx, p.tz); this.vx = this.vz = this.vf = 0; this.vy = 0; const q = nearest(tr, p.x, p.z, -1); this.hint = q.i; this.s = q.s; this.prevS = q.s; this.d = q.d; this.dist = s < 0 ? s : q.s; this.lap = Math.floor(this.dist / tr.length); this.boostT = this.spinT = this.slowT = this.shield = 0; this.drift.on = false; this.drift.t = 0; this.yawVis = this.h; }
  reset(tr) { const q = nearest(tr, this.p.x, this.p.z, -1), p = pointAt(tr, q.s, 0); this.p.set(p.x, p.y, p.z); this.h = Math.atan2(p.tx, p.tz); this.vx = this.vz = this.vf = 0; this.hint = q.i; this.spinT = 0; this.drift.on = false; this.invul = 2; this.stuck = 0; this.yawVis = this.h; }
  get progress() { return this.dist; }
  topSpeed() {
    let v = this.cls.top * (this.top || 1); if (this.boostT > 0) v *= 1.3; if (this.offroad) v *= .5; if (this.slowT > 0) v *= .58; return v;
  }
  // one step of driving. tr = the track, karts = everybody (for bumping)
  step(dt, tr) {
    const q = nearest(tr, this.p.x, this.p.z, this.hint); this.hint = q.i; this.d = q.d; const s0 = this.s; this.s = q.s; this.ice = tr.isIce ? false : false;
    this.offroad = Math.abs(q.d) > tr.width + .5; this.onIce = !this.offroad && tr.isIcePt && tr.isIcePt(q.s);
    const fx = Math.sin(this.h), fz = Math.cos(this.h), sx = Math.cos(this.h), sz = -Math.sin(this.h);
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * sx + this.vz * sz; const inp = this.in, ctl = this.spinT <= 0 && !this.stopped;
    this.invul = Math.max(0, this.invul - dt); this.slowT = Math.max(0, this.slowT - dt); this.bumpCD = Math.max(0, this.bumpCD - dt);
    // drifting: hold the drift key while turning to slide, release for a mini-turbo
    const dr = this.drift; const wantDrift = ctl && inp.drift && vf > 14 && !this.offroad;
    if (!dr.on && wantDrift && Math.abs(inp.steer) > .25) { dr.on = true; dr.dir = Math.sign(inp.steer); dr.t = 0; dr.tier = 0; sfx('charge'); vf *= .98; }
    if (dr.on && (!wantDrift || vf < 9 || !ctl)) { this.endDrift(); }
    if (dr.on) { dr.t += dt * (.85 + .5 * Math.max(0, inp.steer * dr.dir)); const tier = dr.t > TIERS[2] ? 3 : dr.t > TIERS[1] ? 2 : dr.t > TIERS[0] ? 1 : 0; if (tier > dr.tier) { dr.tier = tier; sfx('miniTurbo'); } }
    // turning
    let turn = 0;
    if (ctl) { if (dr.on) turn = dr.dir * 1.05 * this.cls.drift + inp.steer * .85 * this.cls.turn; else turn = inp.steer * 2.1 * this.cls.turn * clamp(Math.abs(vf) / 9, 0, 1) * (1 - .36 * clamp(Math.abs(vf) / 52, 0, 1)) * (vf < -.5 ? -1 : 1); if (this.onIce) turn *= .75; }
    if (this.spinT > 0) { this.spinT -= dt; this.yawVis += dt * 13; turn = 0; } else this.yawVis += angDiff(this.h, this.yawVis) * Math.min(1, dt * 14);
    this.h += turn * dt;
    // speed
    const vTop = this.topSpeed(); let acc = 0;
    if (ctl && inp.thr > 0) { acc = (22 * this.cls.acc) * clamp(1 - Math.pow(Math.max(0, vf) / (vTop * 1.02), 2.2), 0, 1); if (this.boostT > 0) acc = Math.max(acc, 38); if (this.offroad) acc *= .6; }
    if (ctl && inp.brk > 0) { acc = vf > 1 ? -46 : -22 * (vf > -11 ? 1 : 0); }
    if (acc === 0 && ctl) acc = -(5 + vf * .12);      // coasting
    if (!ctl) acc = -10;
    if (vf > vTop) acc -= (vf - vTop) * 2.5 + 4;     // over the limit (after a boost, or off-road): bleed speed back
    vf += acc * dt;
    // sideways grip: low when drifting or on ice, which is what makes a kart slide
    const grip = dr.on ? 1.8 : this.onIce ? .75 : this.offroad ? 4.5 : 8.2; vl *= Math.exp(-grip * dt);
    if (dr.on) vl += -dr.dir * 0; // the slide comes from the heading turning faster than the velocity follows
    this.vx = fx * vf + sx * vl; this.vz = fz * vf + sz * vl; this.vf = vf;
    this.p.x += this.vx * dt; this.p.z += this.vz * dt;
    // the walls: slide along them, lose a little speed on a hard hit
    const q2 = nearest(tr, this.p.x, this.p.z, this.hint), lim = tr.width + SHOULDER - .9;
    if (Math.abs(q2.d) > lim) {
      const side = Math.sign(q2.d), over = Math.abs(q2.d) - lim; this.p.x -= q2.rx * side * over; this.p.z -= q2.rz * side * over;
      const vr = (this.vx * q2.rx + this.vz * q2.rz) * side; if (vr > 0) { this.vx -= q2.rx * side * vr * 1.25; this.vz -= q2.rz * side * vr * 1.25; const k = 1 - clamp(vr / (Math.hypot(this.vx, this.vz) + vr + 1) * .55, 0, .3); this.vx *= k; this.vz *= k; if (vr > 5 && this.bumpCD <= 0) { this.bumpCD = .3; burst(new V3(this.p.x + q2.rx * side * 1.2, this.y + .8, this.p.z + q2.rz * side * 1.2), 0xffe28a, 7, 6, .16, .4, 14, 2); if (this.isPlayer) sfx('wall', clamp(vr / 14, .3, 1)); this.shakeHit = clamp(vr / 14, 0, 1); } }
      if (dr.on && vr > 4) this.endDrift(true);
    }
    // height follows the road
    const gy = q2.y; if (this.y < gy - .05 || this.vy === 0) { this.y += (gy - this.y) * Math.min(1, dt * 18); this.vy = 0; } else { this.vy -= 30 * dt; this.y += this.vy * dt; if (this.y <= gy) { this.y = gy; this.vy = 0; } }
    this.p.y = this.y; this.s = q2.s; this.d = q2.d; this.hint = q2.i; this.tx = q2.tx; this.tz = q2.tz;
    // progress, unwrapped so laps count and going backwards counts down
    let ds = this.s - this.prevS; if (ds < -tr.length / 2) ds += tr.length; else if (ds > tr.length / 2) ds -= tr.length; this.dist += ds; this.prevS = this.s; this.lap = Math.floor(this.dist / tr.length + 1e-6);
    this.wrong = (this.vx * q2.tx + this.vz * q2.tz) < -3 && Math.hypot(this.vx, this.vz) > 4 ? this.wrong + dt : Math.max(0, this.wrong - dt * 2);
    this.boostT = Math.max(0, this.boostT - dt); if (this.shield > 0) this.shield -= dt;
  }
  endDrift(cancel) { const dr = this.drift; if (dr.on && !cancel && dr.tier > 0) { this.boostT = Math.max(this.boostT, TIER_BOOST[dr.tier - 1]); if (this.isPlayer) sfx('boost'); this.vf = Math.min(this.vf + 6, 70); const c = TIER_COL[dr.tier - 1]; burst(new V3(this.p.x, this.y + .8, this.p.z), c, 14, 8, .2, .5, 6, 1); } dr.on = false; dr.t = 0; dr.tier = 0; }
  giveBoost(t, kick = 0) { this.boostT = Math.max(this.boostT, t); if (kick) { this.vx += Math.sin(this.h) * kick; this.vz += Math.cos(this.h) * kick; } if (this.isPlayer) sfx('boost'); }
  hit(kind) {   // returns true if it hurt
    if (this.invul > 0 || this.finished && false) return false;
    if (this.shield > 0) { this.shield = 0; if (this.isPlayer || true) sfx('shieldBreak'); ring(new V3(this.p.x, this.y + 1, this.p.z), 0x6ac8ff, 4, .4, false); this.invul = .6; return false; }
    this.spinT = kind === 'oil' ? 1.1 : .95; this.invul = 2.4; this.endDrift(true); this.vx *= .25; this.vz *= .25; this.boostT = 0; if (this.isPlayer) { sfx('hit'); this.shakeHit = 1; } burst(new V3(this.p.x, this.y + 1, this.p.z), 0xffd34e, 16, 8, .22, .7, 12, 3); return true;
  }
  animate(dt) {
    const m = this.model; m.g.position.set(this.p.x, this.y, this.p.z); const lean = this.drift.on ? this.drift.dir * -.32 : clamp(-this.in.steer * Math.abs(this.vf) / 120, -.15, .15);
    m.g.rotation.set(0, this.spinT > 0 ? this.yawVis : this.h + (this.drift.on ? this.drift.dir * .22 : 0), 0, 'YXZ'); m.body.rotation.z = lean * .3; this.steerVis += (this.in.steer * .5 - this.steerVis) * Math.min(1, dt * 12);
    this.wheelRot += this.vf * dt / .46; for (const w of m.wheels) { w.w.rotation.x = this.wheelRot; if (w.front) w.piv.rotation.y = this.steerVis; }
    m.flame.visible = this.boostT > 0; if (m.flame.visible) { m.flame.scale.set(1 + Math.random() * .3, 1 + Math.random() * .3, .8 + Math.random() * .7); } m.bubble.visible = this.shield > 0; m.g.visible = !(this.invul > 0 && this.spinT <= 0 && ((W.time * 14) | 0) % 2 === 0 && this.isPlayer === false && false);
    if (this.invul > 0 && this.spinT <= 0 && this.isPlayer) m.g.visible = ((W.time * 16) | 0) % 2 === 0 || this.invul > 1.4;
    // spark trail while drifting: color shows the mini-turbo you have charged
    if (this.drift.on && !this.model.noFx) { const c = this.drift.tier > 0 ? TIER_COL[this.drift.tier - 1] : 0xfff2a0, bx = this.p.x - Math.sin(this.h) * 1.3, bz = this.p.z - Math.cos(this.h) * 1.3; burst(new V3(bx, this.y + .3, bz), c, 1, 5, .13, .3, 12, 1); }
    if (this.boostT > 0 && Math.random() < .5) burst(new V3(this.p.x - Math.sin(this.h) * 1.8, this.y + .8, this.p.z - Math.cos(this.h) * 1.8), 0xff9a2a, 1, 4, .16, .3, 2, 0);
    if (this.offroad && Math.abs(this.vf) > 8 && Math.random() < .5) burst(new V3(this.p.x, this.y + .3, this.p.z), 0xd8c8a0, 1, 3, .18, .45, 4, 1);
  }
  remove() { scene.remove(this.model.g); }
}

// ---------------------------------------------------------------- items and what they do
const rocketGeo = (() => { const g = new THREE.CylinderGeometry(.22, .3, 1.5, 8); g.rotateX(Math.PI / 2); g.userData.shared = true; return g; })(), rocketMat = toon(0xff4a4a), bananaGeo = new THREE.CylinderGeometry(1.8, 1.8, .08, 16), oilMat = new THREE.MeshBasicMaterial({ color: 0x25175a, transparent: true, opacity: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
bananaGeo.userData.shared = true; rocketMat.userData.shared = oilMat.userData.shared = true;
export class Items {
  constructor() { this.rockets = []; this.oils = []; }
  clear() { for (const r of this.rockets) scene.remove(r.m); for (const o of this.oils) scene.remove(o.m); this.rockets.length = 0; this.oils.length = 0; }
  roll(rank, n) {   // rank 0 = first. The further behind you are, the better the item.
    const f = n > 1 ? rank / (n - 1) : 0, w = { turbo: 3, banana: lerp(4, .7, f), shield: 2.4, rocket: lerp(.6, 3.4, f), zap: f > .6 ? lerp(0, 2.6, (f - .6) / .4) : 0 }; let tot = 0; for (const k in w) tot += w[k]; let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'turbo';
  }
  use(k, karts, tr) {
    const it = k.item; if (!it) return; k.item = null; if (k.isPlayer) sfx('use');
    const fx = Math.sin(k.h), fz = Math.cos(k.h);
    if (it === 'turbo') k.giveBoost(1.9, 4);
    else if (it === 'shield') { k.shield = 9; if (k.isPlayer) sfx('shield'); }
    else if (it === 'banana') { const m = new THREE.Mesh(bananaGeo, oilMat); m.position.set(k.p.x - fx * 3, k.y + .12, k.p.z - fz * 3); scene.add(m); this.oils.push({ m, x: m.position.x, z: m.position.z, owner: k, life: 45 }); sfx('throw'); }
    else if (it === 'rocket') { const m = new THREE.Mesh(rocketGeo, rocketMat); scene.add(m); const tgt = this.pickTarget(k, karts); this.rockets.push({ m, x: k.p.x + fx * 2.5, z: k.p.z + fz * 2.5, y: k.y + .9, h: k.h, owner: k, target: tgt, life: 7, speed: Math.max(70, k.vf + 40) }); if (k.isPlayer) sfx('rocket'); }
    else if (it === 'zap') { sfx('zap'); for (const o of karts) if (o !== k && o.dist > k.dist - 2 && o.dist - k.dist < tr.length) { if (o.shield > 0) { o.shield = 0; if (o.isPlayer) sfx('shieldBreak'); } else { o.slowT = 2.6; if (o.isPlayer) { o.shakeHit = 1; sfx('hit'); } } burst(new V3(o.p.x, o.y + 2, o.p.z), 0xffe14a, 14, 7, .2, .6, 6, 3); } this.zapFlash = 1; }
  }
  pickTarget(k, karts) { let best = null, bd = 1e9; for (const o of karts) { if (o === k || o.finished) continue; const d = o.dist - k.dist; if (d > 0 && d < 160 && d < bd) { bd = d; best = o; } } return best; }
  update(dt, karts, tr) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]; r.life -= dt; let want = r.h;
      if (r.target && !r.target.finished) { const dx = r.target.p.x - r.x, dz = r.target.p.z - r.z; want = Math.atan2(dx, dz); } else { const q = nearest(tr, r.x, r.z, -1); want = Math.atan2(q.tx, q.tz); }
      r.h += clamp(angDiff(want, r.h), -2.8 * dt, 2.8 * dt); r.x += Math.sin(r.h) * r.speed * dt; r.z += Math.cos(r.h) * r.speed * dt; const q = nearest(tr, r.x, r.z, -1); r.y += (q.y + .9 - r.y) * Math.min(1, dt * 10);
      r.m.position.set(r.x, r.y, r.z); r.m.rotation.y = r.h; if (Math.random() < .8) burst(new V3(r.x - Math.sin(r.h) * 1.2, r.y, r.z - Math.cos(r.h) * 1.2), 0xffa02a, 1, 3, .22, .35, 0, 0);
      let dead = r.life <= 0 || Math.abs(q.d) > tr.width + SHOULDER;
      for (const k of karts) { if (k === r.owner && r.life > 6.3) continue; if (Math.hypot(k.p.x - r.x, k.p.z - r.z) < 2.4) { k.hit('rocket'); dead = true; sfx('boom'); burst(new V3(r.x, r.y, r.z), 0xff8a2a, 22, 10, .3, .7, 8, 3); break; } }
      if (dead) { scene.remove(r.m); this.rockets.splice(i, 1); }
    }
    for (let i = this.oils.length - 1; i >= 0; i--) {
      const o = this.oils[i]; o.life -= dt; let dead = o.life <= 0;
      for (const k of karts) { if (k === o.owner && o.life > 43) continue; if (Math.hypot(k.p.x - o.x, k.p.z - o.z) < 2.0 && k.y - o.m.position.y < 1.2) { if (k.hit('oil')) { dead = true; sfx('spin'); } else dead = dead || k.shield <= 0; break; } }
      if (dead) { scene.remove(o.m); this.oils.splice(i, 1); }
    }
    if (this.zapFlash > 0) this.zapFlash = Math.max(0, this.zapFlash - dt * 2);
  }
}

// karts bump each other: push apart and swap a little speed
export function bumpKarts(karts, dt) {
  for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
    const a = karts[i], b = karts[j]; if (a.finished && b.finished) continue; const dx = b.p.x - a.p.x, dz = b.p.z - a.p.z, d2 = dx * dx + dz * dz; if (d2 > 3.4 * 3.4 || d2 < .0001) continue; const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, over = 3.4 - d;
    a.p.x -= nx * over * .5; a.p.z -= nz * over * .5; b.p.x += nx * over * .5; b.p.z += nz * over * .5;
    const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rv < 0) { const j2 = -rv * .6; a.vx -= nx * j2; a.vz -= nz * j2; b.vx += nx * j2; b.vz += nz * j2; if (-rv > 6 && a.bumpCD <= 0 && b.bumpCD <= 0) { a.bumpCD = b.bumpCD = .25; if (a.isPlayer || b.isPlayer) sfx('bump', clamp(-rv / 18, .3, 1)); burst(new V3((a.p.x + b.p.x) / 2, a.y + .9, (a.p.z + b.p.z) / 2), 0xffffff, 5, 5, .14, .3, 10, 1); } }
  }
}
