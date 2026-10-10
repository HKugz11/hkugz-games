// SKY TOWER - collision world: a spatial hash of boxes (some of them moving), character movement with step-up, and ray casts.
import { V3, THREE } from './core.js?v=12';
export const STEP = .42;
const CS = 8;
const ckey = (ix, iy, iz) => ((ix + 512) * 1024 + (iz + 512)) * 256 + (iy + 8);

class BoxWorld {
  constructor() { this.cells = new Map(); this.stamp = 0; this.out = []; }
  clear() { this.cells.clear(); }
  add(b) {
    b.cells = []; b.q = 0;
    const x0 = Math.floor(b.minX / CS), x1 = Math.floor(b.maxX / CS), y0 = Math.floor(b.minY / CS), y1 = Math.floor(b.maxY / CS), z0 = Math.floor(b.minZ / CS), z1 = Math.floor(b.maxZ / CS);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const k = ckey(x, y, z); let a = this.cells.get(k); if (!a) { a = []; this.cells.set(k, a); } a.push(b); b.cells.push(a); }
    return b;
  }
  remove(b) { if (!b.cells) return; for (const a of b.cells) { const i = a.indexOf(b); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } } b.cells = null; }
  moveBox(b, minX, maxX, minY, maxY, minZ, maxZ) { const was = !!b.cells; if (was) this.remove(b); b.minX = minX; b.maxX = maxX; b.minY = minY; b.maxY = maxY; b.minZ = minZ; b.maxZ = maxZ; if (was) this.add(b); }
  near(minX, maxX, minY, maxY, minZ, maxZ) {
    const out = this.out; out.length = 0; const st = ++this.stamp;
    const x0 = Math.floor(minX / CS), x1 = Math.floor(maxX / CS), y0 = Math.floor(minY / CS), y1 = Math.floor(maxY / CS), z0 = Math.floor(minZ / CS), z1 = Math.floor(maxZ / CS);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const a = this.cells.get(ckey(x, y, z)); if (a) for (const b of a) if (b.q !== st) { b.q = st; out.push(b); } }
    return out;
  }
  // first box hit by a ray. Returns { t, box }, t === max when nothing is hit
  raycast(ox, oy, oz, dx, dy, dz, max = 200) {
    let best = max, bestBox = null;
    let ix = Math.floor(ox / CS), iy = Math.floor(oy / CS), iz = Math.floor(oz / CS);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CS / dx) : Infinity, tdy = dy !== 0 ? Math.abs(CS / dy) : Infinity, tdz = dz !== 0 ? Math.abs(CS / dz) : Infinity;
    let tmx = dx > 0 ? ((ix + 1) * CS - ox) / dx : dx < 0 ? (ix * CS - ox) / dx : Infinity;
    let tmy = dy > 0 ? ((iy + 1) * CS - oy) / dy : dy < 0 ? (iy * CS - oy) / dy : Infinity;
    let tmz = dz > 0 ? ((iz + 1) * CS - oz) / dz : dz < 0 ? (iz * CS - oz) / dz : Infinity;
    let t = 0;
    for (let i = 0; i < 600; i++) {
      if (t > best) break;
      const a = this.cells.get(ckey(ix, iy, iz));
      if (a) for (const b of a) { const tt = rayBoxT(ox, oy, oz, dx, dy, dz, b); if (tt < best) { best = tt; bestBox = b; } }
      if (tmx < tmy && tmx < tmz) { t = tmx; ix += sx; tmx += tdx; } else if (tmy < tmz) { t = tmy; iy += sy; tmy += tdy; } else { t = tmz; iz += sz; tmz += tdz; }
    }
    return { t: best, box: bestBox };
  }
}
export const world = new BoxWorld();

export function rayBoxT(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; } else { let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.minY || oy > b.maxY) return Infinity; } else { let t1 = (b.minY - oy) / dy, t2 = (b.maxY - oy) / dy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; } else { let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  return tmin;
}

const ov = (e, b) => e.pos.x + e.r > b.minX && e.pos.x - e.r < b.maxX && e.pos.z + e.r > b.minZ && e.pos.z - e.r < b.maxZ && e.pos.y + e.h > b.minY + .001 && e.pos.y < b.maxY - .001;
function headClear(e, cand, b) {
  const ny = b.maxY;
  for (const c of cand) {
    if (c === b || !(e.pos.x + e.r > c.minX && e.pos.x - e.r < c.maxX && e.pos.z + e.r > c.minZ && e.pos.z - e.r < c.maxZ)) continue;
    if (c.minY < ny + e.h - .02 && c.maxY > ny + .02) return false;
  }
  return true;
}
function resolveH(e, cand, axis, canStep) {
  const p = e.pos, r = e.r;
  for (const b of cand) {
    if (!ov(e, b)) continue;
    const rise = b.maxY - p.y;
    if (canStep && rise <= STEP && e.vel.y <= 1 && headClear(e, cand, b)) { p.y = b.maxY; if (e.vel.y < 0) e.vel.y = 0; e.onGround = true; e.ground = b; e.stepped = true; continue; }
    if (axis === 0) { const v = e.vel.x; if (v > 0) p.x = b.minX - r - 1e-3; else if (v < 0) p.x = b.maxX + r + 1e-3; else p.x = p.x < (b.minX + b.maxX) / 2 ? b.minX - r - 1e-3 : b.maxX + r + 1e-3; e.vel.x = 0; }
    else { const v = e.vel.z; if (v > 0) p.z = b.minZ - r - 1e-3; else if (v < 0) p.z = b.maxZ + r + 1e-3; else p.z = p.z < (b.minZ + b.maxZ) / 2 ? b.minZ - r - 1e-3 : b.maxZ + r + 1e-3; e.vel.z = 0; }
    e.blocked = true;
  }
}
export function moveEntity(e, dt, gravity) {
  const p = e.pos, v = e.vel; e.blocked = false; e.stepped = false; e.landed = null; const wasGround = e.onGround;
  const cand = world.near(p.x - e.r - 2, p.x + e.r + 2, p.y - 2.5, p.y + e.h + 2 + Math.max(0, v.y * dt), p.z - e.r - 2, p.z + e.r + 2);
  p.x += v.x * dt; resolveH(e, cand, 0, wasGround);
  p.z += v.z * dt; resolveH(e, cand, 1, wasGround);
  v.y -= gravity * dt; if (v.y < -46) v.y = -46; p.y += v.y * dt; e.onGround = e.stepped; if (!e.stepped) e.ground = null;
  for (const b of cand) if (ov(e, b)) {
    if (v.y <= 0) { p.y = b.maxY; e.landed = b; if (b.bounce) { v.y = b.bounce; e.bounced = b; } else { v.y = 0; e.onGround = true; e.ground = b; } }
    else { p.y = b.minY - e.h - 1e-3; v.y = 0; }
  }
}
// push somebody out of a box that moved into them (a piston, a lift)
export function pushOut(e) {
  for (let it = 0; it < 3; it++) {
    const cand = world.near(e.pos.x - e.r - 1, e.pos.x + e.r + 1, e.pos.y - 1, e.pos.y + e.h + 1, e.pos.z - e.r - 1, e.pos.z + e.r + 1); let moved = false;
    for (const b of cand) {
      if (!ov(e, b)) continue; const p = e.pos;
      const pl = p.x + e.r - b.minX, pr = b.maxX - (p.x - e.r), pf = p.z + e.r - b.minZ, pb = b.maxZ - (p.z - e.r), pu = b.maxY - p.y, pd = p.y + e.h - b.minY;
      const m = Math.min(pl, pr, pf, pb, pu * .6, pd);
      if (m === pu * .6) { p.y = b.maxY; if (e.vel.y < 0) e.vel.y = 0; e.onGround = true; e.ground = b; } else if (m === pd) { p.y = b.minY - e.h - 1e-3; if (e.vel.y > 0) e.vel.y = 0; }
      else if (m === pl) { p.x = b.minX - e.r - 1e-3; if (e.vel.x > 0) e.vel.x = 0; } else if (m === pr) { p.x = b.maxX + e.r + 1e-3; if (e.vel.x < 0) e.vel.x = 0; } else if (m === pf) { p.z = b.minZ - e.r - 1e-3; if (e.vel.z > 0) e.vel.z = 0; } else { p.z = b.maxZ + e.r + 1e-3; if (e.vel.z < 0) e.vel.z = 0; }
      moved = true;
    }
    if (!moved) break;
  }
}
// a sphere against an oriented box. obb = { pos: V3 center, inv: Quaternion (world -> local), half: V3 }. Returns penetration info or null.
const _l = new V3(), _c = new V3(), _n = new V3();
export function sphereVsObb(cx, cy, cz, r, obb) {
  _l.set(cx - obb.pos.x, cy - obb.pos.y, cz - obb.pos.z).applyQuaternion(obb.inv);
  _c.set(Math.max(-obb.half.x, Math.min(obb.half.x, _l.x)), Math.max(-obb.half.y, Math.min(obb.half.y, _l.y)), Math.max(-obb.half.z, Math.min(obb.half.z, _l.z)));
  _n.copy(_l).sub(_c); const d2 = _n.lengthSq(); if (d2 >= r * r) return null;
  let d = Math.sqrt(d2); if (d < 1e-5) { _n.set(1, 0, 0); d = 0; } else _n.divideScalar(d);
  _n.applyQuaternion(obb.quat); return { pen: r - d, nx: _n.x, ny: _n.y, nz: _n.z };
}
