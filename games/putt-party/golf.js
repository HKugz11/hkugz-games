// PUTT PARTY - the mini golf physics. Pure maths (no graphics), so the computer players can "try" a shot by simulating it.
// The ball lives on a flat plane (x, z). Walls are line segments, bumpers are circles, windmill blades and sliders are moving segments.
export const BALL_R = .32, CUP_R = .62, FRICTION = 4.0, SAND_FRICTION = 15, MAX_SPEED = 21, SINK_SPEED = 7.2, DT = 1 / 120, MAX_STROKES = 8;

const hyp = Math.hypot;
export function ptSeg(px, pz, ax, az, bx, bz, out) {   // closest point on a segment to p
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; out.x = ax + dx * t; out.z = az + dz * t; out.t = t; return out;
}
const _c = { x: 0, z: 0, t: 0 };
export const polyArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % p.length]; a += x0 * z1 - x1 * z0; } return a / 2; };
const inRect = (x, z, r) => x > r[0] && x < r[2] && z > r[1] && z < r[3];

// A hole built from its description (see holes.js). Everything that moves is a pure function of the clock t.
export class Course {
  constructor(def) {
    this.def = def; this.segs = []; this.circles = []; this.mills = def.mills || []; this.sliders = def.sliders || []; this.sand = def.sand || []; this.water = def.water || []; this.boost = def.boost || []; this.tele = def.tele || [];
    for (const p of def.polys) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; this.segs.push([a[0], a[1], b[0], b[1]]); }
    for (const w of def.walls || []) this.segs.push(w.slice());
    for (const r of def.blocks || []) { const [x0, z0, x1, z1] = r; this.segs.push([x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]); }
    for (const c of def.bumpers || []) this.circles.push({ x: c[0], z: c[1], r: c[2], bump: true });
    for (const m of this.mills) this.circles.push({ x: m.x, z: m.z, r: m.hub || .6, bump: false });
    this.cup = def.cup; this.tee = def.tee;
  }
  // the moving segments at time t: [{ ax, az, bx, bz, vx, vz }] where v is the velocity of the surface (blades also spin)
  movers(t, out = []) {
    out.length = 0;
    for (const m of this.mills) { const n = m.n || 2; for (let i = 0; i < n; i++) { const a = (m.phase || 0) + m.omega * t + i * Math.PI * 2 / n, c = Math.cos(a), s = Math.sin(a); out.push({ ax: m.x, az: m.z, bx: m.x + c * m.len, bz: m.z + s * m.len, om: m.omega, cx: m.x, cz: m.z }); } }
    for (const s of this.sliders) { const k = Math.sin(Math.PI * 2 * (t / s.period + (s.phase || 0))), kv = Math.cos(Math.PI * 2 * (t / s.period + (s.phase || 0))) * Math.PI * 2 / s.period; out.push({ ax: s.x0 + s.dx * k, az: s.z0 + s.dz * k, bx: s.x1 + s.dx * k, bz: s.z1 + s.dz * k, vx: s.dx * kv, vz: s.dz * kv, om: 0 }); }
    return out;
  }
}

export function newBall(x, z) { return { x, z, vx: 0, vz: 0, state: 'rest', rest: 0, lastX: x, lastZ: z, strokes: 0, sink: 0, spd: 0, ev: 0 }; }
// events (bit flags) the caller can turn into sounds and effects
export const EV = { WALL: 1, BUMP: 2, SAND: 4, SINK: 8, WATER: 16, BOOST: 32, TELE: 64 };

// one physics step of the ball. Returns nothing: look at b.state ('roll', 'rest', 'sunk', 'water') and b.ev
const _m = [];
export function stepBall(C, b, t, dt = DT) {
  b.ev = 0; if (b.state === 'sunk' || b.state === 'water') return;
  let spd = hyp(b.vx, b.vz); const insand = C.sand.some(r => inRect(b.x, b.z, r));
  if (insand && spd > .1) b.ev |= EV.SAND;
  // friction (stronger in sand) and speed strips
  const fr = (insand ? SAND_FRICTION : FRICTION) * dt; if (spd > 0) { const ns = Math.max(0, spd - fr); b.vx *= ns / spd; b.vz *= ns / spd; spd = ns; }
  for (const s of C.boost) if (inRect(b.x, b.z, s.rect)) { b.vx += s.dir[0] * 34 * dt; b.vz += s.dir[1] * 34 * dt; b.ev |= EV.BOOST; spd = hyp(b.vx, b.vz); if (spd > 17) { b.vx *= 17 / spd; b.vz *= 17 / spd; } }
  b.x += b.vx * dt; b.z += b.vz * dt;
  const R = BALL_R;
  // static walls
  for (const s of C.segs) { ptSeg(b.x, b.z, s[0], s[1], s[2], s[3], _c); const dx = b.x - _c.x, dz = b.z - _c.z, d2 = dx * dx + dz * dz; if (d2 >= R * R) continue; const d = Math.sqrt(d2) || 1e-6; const nx = dx / d, nz = dz / d; b.x = _c.x + nx * R; b.z = _c.z + nz * R; const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vz -= 1.8 * vn * nz; b.vx *= .985; b.vz *= .985; if (vn < -1.2) b.ev |= EV.WALL; } }
  // bumpers and windmill hubs
  for (const c of C.circles) { const dx = b.x - c.x, dz = b.z - c.z, rr = R + c.r; if (dx * dx + dz * dz >= rr * rr) continue; const d = Math.hypot(dx, dz) || 1e-6, nx = dx / d, nz = dz / d; b.x = c.x + nx * rr; b.z = c.z + nz * rr; const vn = b.vx * nx + b.vz * nz; if (vn < 0) { const k = c.bump ? 2.15 : 1.8; b.vx -= k * vn * nx; b.vz -= k * vn * nz; if (c.bump) { const s2 = hyp(b.vx, b.vz); if (s2 < 5) { b.vx *= 5 / (s2 || 1); b.vz *= 5 / (s2 || 1); } b.ev |= EV.BUMP; } else if (vn < -1.2) b.ev |= EV.WALL; } }
  // blades and sliders (they push the ball with their own speed)
  C.movers(t, _m);
  for (const m of _m) {
    ptSeg(b.x, b.z, m.ax, m.az, m.bx, m.bz, _c); const dx = b.x - _c.x, dz = b.z - _c.z, d2 = dx * dx + dz * dz, rr = R + .12; if (d2 >= rr * rr) continue; const d = Math.sqrt(d2) || 1e-6, nx = dx / d, nz = dz / d; b.x = _c.x + nx * rr; b.z = _c.z + nz * rr;
    let sx = m.vx || 0, sz = m.vz || 0; if (m.om) { sx = -m.om * (_c.z - m.cz); sz = m.om * (_c.x - m.cx); }
    const rvx = b.vx - sx, rvz = b.vz - sz, vn = rvx * nx + rvz * nz; if (vn < 0) { b.vx = sx + rvx - 1.7 * vn * nx; b.vz = sz + rvz - 1.7 * vn * nz; b.ev |= EV.WALL; }
  }
  spd = hyp(b.vx, b.vz); if (spd > 26) { b.vx *= 26 / spd; b.vz *= 26 / spd; spd = 26; } b.spd = spd;
  // the cup
  const cdx = b.x - C.cup[0], cdz = b.z - C.cup[1], cd = Math.hypot(cdx, cdz);
  if (cd < CUP_R && spd < SINK_SPEED) { b.state = 'sunk'; b.sink = 0; b.ev |= EV.SINK; b.vx = b.vz = 0; return; }
  if (cd < CUP_R * 1.5 && spd >= SINK_SPEED * .5) { const k = (1 - cd / (CUP_R * 1.5)) * 6 * dt; b.vx -= cdx / (cd || 1) * k * spd; b.vz -= cdz / (cd || 1) * k * spd; }   // a little pull toward the hole
  // pipes
  for (const p of C.tele) { for (const [a, o] of [[p.a, p.b], [p.b, p.a]]) { if (hyp(b.x - a[0], b.z - a[1]) < .55 && (b.tcool || 0) <= 0) { b.x = o[0]; b.z = o[1]; b.tcool = .6; b.ev |= EV.TELE; const s = hyp(b.vx, b.vz) || 1, ang = o[2] !== undefined ? o[2] : Math.atan2(b.vz, b.vx); b.vx = Math.cos(ang) * Math.max(s, 7); b.vz = Math.sin(ang) * Math.max(s, 7); } } }
  if (b.tcool > 0) b.tcool -= dt;
  // water
  for (const w of C.water) { const inW = w.length === 4 ? inRect(b.x, b.z, w) : hyp(b.x - w[0], b.z - w[1]) < w[2]; if (inW) { b.state = 'water'; b.ev |= EV.WATER; b.vx = b.vz = 0; return; } }
  if (spd < .22) { b.rest += dt; if (b.rest > .3) { b.state = 'rest'; b.vx = b.vz = 0; } else b.state = 'roll'; } else { b.rest = 0; b.state = 'roll'; }
}
export function shoot(b, angle, power) { const v = Math.pow(power, 1.15) * MAX_SPEED; b.vx = Math.cos(angle) * v; b.vz = Math.sin(angle) * v; b.state = 'roll'; b.rest = 0; b.lastX = b.x; b.lastZ = b.z; b.strokes++; }
// a trial run for the computer players: where does a shot end up?
export function simulate(C, x, z, angle, power, t0, maxT = 7) {
  const b = newBall(x, z); shoot(b, angle, power); let t = t0, n = 0, bounces = 0; const lim = Math.floor(maxT / DT);
  while (n++ < lim) { stepBall(C, b, t, DT); t += DT; if (b.ev & (EV.WALL | EV.BUMP)) bounces++; if (b.state !== 'roll') break; }
  return { x: b.x, z: b.z, state: b.state, bounces, ticks: n };
}

// the first wall (or bumper) a ball would meet when rolling from (x,z) along (dx,dz): used for the dotted aim line
export function rayFirstHit(C, x, z, dx, dz, maxD = 40) {
  let best = maxD, nx = 0, nz = 0; const R = BALL_R;
  for (const s of C.segs) { const ex = s[2] - s[0], ez = s[3] - s[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const wx = s[0] - x, wz = s[1] - z, t = (wx * ez - wz * ex) / den, u = (wx * dz - wz * dx) / den; if (t > 0 && t < best && u >= 0 && u <= 1) { const l = Math.hypot(ex, ez), n1x = -ez / l, n1z = ex / l, sg = (dx * n1x + dz * n1z) < 0 ? 1 : -1; const bt = t - R / Math.max(.05, Math.abs(dx * n1x + dz * n1z)); if (bt < best) { best = Math.max(0, bt); nx = n1x * sg; nz = n1z * sg; } } }
  for (const c of C.circles) { const ox = x - c.x, oz = z - c.z, rr = c.r + R, b = ox * dx + oz * dz, cc = ox * ox + oz * oz - rr * rr, disc = b * b - cc; if (disc < 0) continue; const t = -b - Math.sqrt(disc); if (t > 0 && t < best) { best = t; const hx = x + dx * t - c.x, hz = z + dz * t - c.z, hl = Math.hypot(hx, hz) || 1; nx = hx / hl; nz = hz / hl; } }
  return { t: best, nx, nz };
}
