// FORT FIGHT - collision world: a spatial hash of boxes, character movement with step-up, and ray casts.
import { V3 } from './core.js?v=9';
export const G_ACC = 28, STEP = .62;
const CS = 8;
const ckey = (ix, iy, iz) => ((ix + 512) * 1024 + (iz + 512)) * 64 + (iy + 4);

class BoxWorld {
  constructor() { this.cells = new Map(); this.stamp = 0; this.out = []; this.bounds = { minX: -80, maxX: 80, minZ: -80, maxZ: 80 }; }
  clear() { this.cells.clear(); }
  add(b) {
    b.cells = []; b.q = 0;
    const x0 = Math.floor(b.minX / CS), x1 = Math.floor(b.maxX / CS), y0 = Math.floor(b.minY / CS), y1 = Math.floor(b.maxY / CS), z0 = Math.floor(b.minZ / CS), z1 = Math.floor(b.maxZ / CS);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const k = ckey(x, y, z); let a = this.cells.get(k); if (!a) { a = []; this.cells.set(k, a); } a.push(b); b.cells.push(a); }
    return b;
  }
  remove(b) { if (!b.cells) return; for (const a of b.cells) { const i = a.indexOf(b); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } } b.cells = null; }
  // every box that touches the given region (the returned array is reused by the next call)
  near(minX, maxX, minY, maxY, minZ, maxZ) {
    const out = this.out; out.length = 0; const st = ++this.stamp;
    const x0 = Math.floor(minX / CS), x1 = Math.floor(maxX / CS), y0 = Math.floor(minY / CS), y1 = Math.floor(maxY / CS), z0 = Math.floor(minZ / CS), z1 = Math.floor(maxZ / CS);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const a = this.cells.get(ckey(x, y, z)); if (a) for (const b of a) if (b.q !== st) { b.q = st; out.push(b); } }
    return out;
  }
  // first box hit by a ray (or the ground plane). Returns { t, box } where box is null for the ground, and t === max when nothing is hit.
  raycast(ox, oy, oz, dx, dy, dz, max = 200) {
    let best = max, hit = null;
    if (dy < -1e-6 && oy > 0) { const tg = -oy / dy; if (tg < best) { best = tg; hit = null; } }
    let ix = Math.floor(ox / CS), iy = Math.floor(oy / CS), iz = Math.floor(oz / CS);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CS / dx) : Infinity, tdy = dy !== 0 ? Math.abs(CS / dy) : Infinity, tdz = dz !== 0 ? Math.abs(CS / dz) : Infinity;
    let tmx = dx > 0 ? ((ix + 1) * CS - ox) / dx : dx < 0 ? (ix * CS - ox) / dx : Infinity;
    let tmy = dy > 0 ? ((iy + 1) * CS - oy) / dy : dy < 0 ? (iy * CS - oy) / dy : Infinity;
    let tmz = dz > 0 ? ((iz + 1) * CS - oz) / dz : dz < 0 ? (iz * CS - oz) / dz : Infinity;
    let t = 0; hit = null; let bestBox = null;
    for (let i = 0; i < 400; i++) {
      if (t > best) break;
      const a = this.cells.get(ckey(ix, iy, iz));
      if (a) for (const b of a) { const tt = rayBoxT(ox, oy, oz, dx, dy, dz, b); if (tt < best) { best = tt; bestBox = b; } }
      if (tmx < tmy && tmx < tmz) { t = tmx; ix += sx; tmx += tdx; } else if (tmy < tmz) { t = tmy; iy += sy; tmy += tdy; } else { t = tmz; iz += sz; tmz += tdz; }
      if (iy < -4 || iy > 59) { if ((iy < -4 && sy < 0) || (iy > 59 && sy > 0)) break; }
    }
    return { t: best, box: bestBox };
  }
  lineClear(ax, ay, az, bx, by, bz) { const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz); if (len < .01) return true; return this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len).t >= len - .06; }
  groundAt(x, z, fromY = 200) { const r = this.raycast(x, fromY, z, 0, -1, 0, fromY + 1); return fromY - r.t; }
}
export const world = new BoxWorld();

export function rayBoxT(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; } else { let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.minY || oy > b.maxY) return Infinity; } else { let t1 = (b.minY - oy) / dy, t2 = (b.maxY - oy) / dy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; } else { let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  return tmin;
}
export function raySphereT(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const px = ox - cx, py = oy - cy, pz = oz - cz, b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - r * r, disc = b * b - c;
  if (disc < 0) return Infinity; const s = Math.sqrt(disc), t = -b - s; return t >= 0 ? t : (-b + s >= 0 ? 0 : Infinity);
}
// ray vs a character: a body box plus a head sphere. Returns { t, head } or null
export function rayActor(ox, oy, oz, dx, dy, dz, a) {
  const hx = a.pos.x, hz = a.pos.z, top = a.pos.y + a.h;
  const tb = rayBoxT(ox, oy, oz, dx, dy, dz, { minX: hx - a.r, maxX: hx + a.r, minY: a.pos.y, maxY: top - .3, minZ: hz - a.r, maxZ: hz + a.r });
  const th = raySphereT(ox, oy, oz, dx, dy, dz, hx, top - .27, hz, .3);
  if (th === Infinity && tb === Infinity) return null; return th <= tb ? { t: th, head: true } : { t: tb, head: false };
}

const ov = (e, b) => e.pos.x + e.r > b.minX && e.pos.x - e.r < b.maxX && e.pos.z + e.r > b.minZ && e.pos.z - e.r < b.maxZ && e.pos.y + e.h > b.minY + .001 && e.pos.y < b.maxY - .001;
function headClear(e, cand, b) {
  const ny = b.maxY;
  for (const c of cand) {
    if (c === b || !(e.pos.x + e.r > c.minX && e.pos.x - e.r < c.maxX && e.pos.z + e.r > c.minZ && e.pos.z - e.r < c.maxZ)) continue;
    if (c.minY < ny + e.h - .02 && c.maxY > ny + .02) return false;   // something would be in the way of the character standing on top of b
  }
  return true;
}
function resolveH(e, cand, axis) {
  const p = e.pos, r = e.r;
  for (const b of cand) {
    if (!ov(e, b)) continue;
    const rise = b.maxY - p.y;
    if (rise <= STEP && e.vel.y <= 3 && headClear(e, cand, b)) { p.y = b.maxY; if (e.vel.y < 0) e.vel.y = 0; e.onGround = true; e.stepped = true; continue; }
    if (axis === 0) { const v = e.vel.x; if (v > 0) p.x = b.minX - r - 1e-3; else if (v < 0) p.x = b.maxX + r + 1e-3; else p.x = p.x < (b.minX + b.maxX) / 2 ? b.minX - r - 1e-3 : b.maxX + r + 1e-3; e.vel.x = 0; }
    else { const v = e.vel.z; if (v > 0) p.z = b.minZ - r - 1e-3; else if (v < 0) p.z = b.maxZ + r + 1e-3; else p.z = p.z < (b.minZ + b.maxZ) / 2 ? b.minZ - r - 1e-3 : b.maxZ + r + 1e-3; e.vel.z = 0; }
    e.blocked = true;
  }
}
export function moveEntity(e, dt) {
  const p = e.pos, v = e.vel; e.blocked = false; e.stepped = false;
  const cand = world.near(p.x - e.r - 2.5, p.x + e.r + 2.5, p.y - 2, p.y + e.h + 2 + Math.max(0, v.y * dt), p.z - e.r - 2.5, p.z + e.r + 2.5);
  p.x += v.x * dt; resolveH(e, cand, 0);
  p.z += v.z * dt; resolveH(e, cand, 1);
  v.y -= G_ACC * dt; p.y += v.y * dt; const wasGround = e.onGround && !e.stepped; e.onGround = e.stepped; void wasGround;
  for (const b of cand) if (ov(e, b)) { if (v.y <= 0) { p.y = b.maxY; v.y = 0; e.onGround = true; } else { p.y = b.minY - e.h - 1e-3; v.y = 0; } }
  if (p.y <= 0) { p.y = 0; if (v.y < 0) v.y = 0; e.onGround = true; }
  const B = world.bounds; p.x = Math.max(B.minX + e.r, Math.min(B.maxX - e.r, p.x)); p.z = Math.max(B.minZ + e.r, Math.min(B.maxZ - e.r, p.z));
}
// when a piece is built on top of somebody, move them out of it
export function unstuck(e) {
  for (let it = 0; it < 4; it++) {
    const cand = world.near(e.pos.x - e.r - 1, e.pos.x + e.r + 1, e.pos.y - 1, e.pos.y + e.h + 1, e.pos.z - e.r - 1, e.pos.z + e.r + 1); let moved = false;
    for (const b of cand) {
      if (!ov(e, b)) continue; const p = e.pos;
      const pl = p.x + e.r - b.minX, pr = b.maxX - (p.x - e.r), pf = p.z + e.r - b.minZ, pb = b.maxZ - (p.z - e.r), pu = (b.maxY - p.y) * .7;
      const m = Math.min(pl, pr, pf, pb, pu);
      if (m === pu) { p.y = b.maxY; if (e.vel.y < 0) e.vel.y = 0; e.onGround = true; } else if (m === pl) p.x = b.minX - e.r - 1e-3; else if (m === pr) p.x = b.maxX + e.r + 1e-3; else if (m === pf) p.z = b.minZ - e.r - 1e-3; else p.z = b.maxZ + e.r + 1e-3;
      moved = true;
    }
    if (!moved) break;
  }
}
export function boxOverlapsAny(minX, maxX, minY, maxY, minZ, maxZ, filter) {
  const c = world.near(minX, maxX, minY, maxY, minZ, maxZ);
  for (const b of c) if (maxX > b.minX && minX < b.maxX && maxY > b.minY && minY < b.maxY && maxZ > b.minZ && minZ < b.maxZ && (!filter || filter(b))) return b;
  return null;
}
