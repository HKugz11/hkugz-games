// FORT FIGHT - the building system: walls, floors, stairs and roofs on a grid, with HP, build-up time and editing.
import { THREE, V3, scene, QL, burst, ring, sfxAt, sfx, rnd, clamp, W, toon, INK } from './core.js?v=10';
import { world, boxOverlapsAny } from './physics.js?v=10';

export const CELL = 4, H = 3, WT = .25, FT = .3, STEP_H = H / 5, LEV_BIAS = 1.2, BUILD_T = 2.4, COST = 10, MAX_LEV = 36;
export const MATS = { wood: { name: 'Wood', color: 0xe3a759, hp: 1 }, stone: { name: 'Stone', color: 0xb3a99e, hp: 2 }, metal: { name: 'Metal', color: 0x86c0f4, hp: 3 } };
export const MAT_IDS = ['wood', 'stone', 'metal'];
export const TYPES = { w: 'Wall', f: 'Floor', s: 'Stairs', r: 'Roof' };
const BASE_HP = 150;
// online play: when NET.on, the host owns piece health and destruction, clients send their damage to the host
export const NET = { on: false, host: true, onDamage: null, onHp: null, onDestroy: null };

export const pieces = new Map();        // id -> piece
const occ = new Map();                  // slot key -> piece
const building = new Set();
let nextId = 1;
export function resetIds() { nextId = 1; }
export function setIdBase(pid) { if (pid > 0) nextId = pid * 1000000 + 1; }   // everybody builds with ids from their own range
export const sk = {
  w: (o, ix, iz, lev) => `w${o}:${ix},${iz},${lev}`, f: (ix, iz, lev) => `f:${ix},${iz},${lev}`, s: (ix, iz, lev) => `s:${ix},${iz},${lev}`, r: (ix, iz, lev) => `r:${ix},${iz},${lev}`,
};
export const slotKey = s => s.type === 'w' ? sk.w(s.o, s.ix, s.iz, s.lev) : sk[s.type](s.ix, s.iz, s.lev);

// ---------------------------------------------------------------- geometry
function mergeBoxes(list) {
  const pos = [], nor = [], idx = []; let base = 0;
  for (const [cx, cy, cz, sx, sy, sz] of list) {
    const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(cx, cy, cz);
    const p = g.attributes.position.array, n = g.attributes.normal.array, ix = g.index.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base); base += p.length / 3; g.dispose();
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx); out.userData.shared = true; return out;
}
const LOCAL = {
  stairs: [0, 1, 2, 3, 4].map(k => { const h = STEP_H * (k + 1); return [0, h / 2, CELL / 2 - (k + .5) * CELL / 5, CELL, h, CELL / 5]; }),
  roof: [[0, .3, 0, CELL, .6, CELL], [0, .9, 0, CELL - 1.6, .6, CELL - 1.6], [0, 1.5, 0, CELL - 3.2, .6, CELL - 3.2]],
};
const geoCache = new Map();
function maskBoxes(type, mask) {   // local boxes (centered on the piece) for the tiles that are left
  const out = [], t = CELL / 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (mask & (1 << (r * 3 + c))) {
    if (type === 'w') out.push([(c - 1) * t, (r - 1) * (H / 3), 0, t, H / 3, WT]); else out.push([(c - 1) * t, 0, (r - 1) * t, t, FT, t]);
  }
  return out;
}
export function geoFor(type, mask = 511) {
  const key = type + ':' + (type === 'w' || type === 'f' ? mask : 0); let g = geoCache.get(key); if (g) return g;
  if (type === 'w' || type === 'f') g = mask === 511 ? (() => { const b = type === 'w' ? new THREE.BoxGeometry(CELL, H, WT) : new THREE.BoxGeometry(CELL, FT, CELL); b.userData.shared = true; return b; })() : mergeBoxes(maskBoxes(type, mask));
  else g = mergeBoxes(type === 's' ? LOCAL.stairs : LOCAL.roof);
  geoCache.set(key, g); return g;
}
const MATSET = {};
for (const id of MAT_IDS) {
  const c = new THREE.Color(MATS[id].color);
  const normal = toon(MATS[id].color), hurt = toon(c.clone().multiplyScalar(.62).getHex()), bld = toon(c.clone().lerp(new THREE.Color(0xffffff), .5).getHex(), { transparent: true, opacity: .62 });
  for (const m of [normal, hurt, bld]) m.userData.shared = true; MATSET[id] = { normal, hurt, build: bld };
}

// ---------------------------------------------------------------- where a slot is in the world
const ROT = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // dir 0 = -z, 1 = +x, 2 = +z, 3 = -x
export const dirVec = d => ROT[d & 3];
function rotXZ(x, z, d) { d &= 3; return d === 0 ? [x, z] : d === 1 ? [-z, x] : d === 2 ? [-x, -z] : [z, -x]; }
export function slotPose(s) {   // mesh position + rotation
  const x0 = s.ix * CELL, z0 = s.iz * CELL;
  if (s.type === 'w') return s.o === 'x' ? { x: x0 + CELL / 2, y: s.lev * H + H / 2, z: z0, ry: 0 } : { x: x0, y: s.lev * H + H / 2, z: z0 + CELL / 2, ry: Math.PI / 2 };
  if (s.type === 'f') { const top = s.lev * H + (s.lev === 0 ? FT : 0); return { x: x0 + CELL / 2, y: top - FT / 2, z: z0 + CELL / 2, ry: 0 }; }
  if (s.type === 's') return { x: x0 + CELL / 2, y: s.lev * H, z: z0 + CELL / 2, ry: -(s.dir & 3) * Math.PI / 2 };
  return { x: x0 + CELL / 2, y: (s.lev + 1) * H, z: z0 + CELL / 2, ry: 0 };
}
function worldBoxes(s, mask) {   // [minX,maxX,minY,maxY,minZ,maxZ] list
  const p = slotPose(s), out = [];
  const add = (cx, cy, cz, sx, sy, sz) => out.push([cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, cz - sz / 2, cz + sz / 2]);
  if (s.type === 'w' || s.type === 'f') {
    const horiz = s.type === 'w' && s.o === 'z';
    if (mask === 511) { if (s.type === 'w') add(p.x, p.y, p.z, horiz ? WT : CELL, H, horiz ? CELL : WT); else add(p.x, p.y, p.z, CELL, FT, CELL); }
    else {
      const t = CELL / 3;   // merge each row into runs of tiles
      for (let r = 0; r < 3; r++) { let c = 0; while (c < 3) { if (!(mask & (1 << (r * 3 + c)))) { c++; continue; } let e = c; while (e + 1 < 3 && (mask & (1 << (r * 3 + e + 1)))) e++; const n = e - c + 1, mid = (c + e) / 2 - 1;
        if (s.type === 'w') { const lx = mid * t, ly = (r - 1) * (H / 3); if (horiz) add(p.x, p.y + ly, p.z + lx, WT, H / 3, n * t); else add(p.x + lx, p.y + ly, p.z, n * t, H / 3, WT); }
        else add(p.x + mid * t, p.y, p.z + (r - 1) * t, n * t, FT, t);
        c = e + 1; } }
    }
  } else for (const [lx, ly, lz, sx, sy, sz] of (s.type === 's' ? LOCAL.stairs : LOCAL.roof)) { const [rx, rz] = s.type === 's' ? rotXZ(lx, lz, s.dir) : [lx, lz], sw = s.type === 's' && (s.dir & 1); add(p.x + rx, p.y + ly, p.z + rz, sw ? sz : sx, sy, sw ? sx : sz); }
  return out;
}

// ---------------------------------------------------------------- the pieces
// Pieces are drawn with instancing: one draw call per kind of piece (shape + material + condition), however many there are.
export function pieceMaxHp(type, mat) { return BASE_HP * MATS[mat].hp; }
const pstate = p => p.age < BUILD_T ? 'build' : (p.hp < p.maxHp * .5 ? 'hurt' : 'normal');
const batchKey = p => `${p.type}:${p.mask}:${p.mat}:${pstate(p)}`;
const batches = new Map(), TM = new THREE.Matrix4(), TQ = new THREE.Quaternion(), TP = new V3(), TS = new V3(), YAX = new V3(0, 1, 0), TC = new V3();
const HULL_K = 1.04;
class Batch {
  constructor(key, geo, mat) { this.key = key; this.geo = geo; this.mat = mat; this.cap = 0; this.n = 0; this.items = []; this.im = null; this.hull = null; geo.computeBoundingBox(); const b = geo.boundingBox; this.c = new V3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2); this.grow(32); }
  grow(cap) {
    const old = this.im, oh = this.hull;
    this.im = new THREE.InstancedMesh(this.geo, this.mat, cap); this.im.frustumCulled = false; this.im.castShadow = QL.shadow > 0; this.im.receiveShadow = QL.shadow > 0; scene.add(this.im);
    if (QL.edges) { this.hull = new THREE.InstancedMesh(this.geo, INK, cap); this.hull.frustumCulled = false; scene.add(this.hull); }
    if (old) { for (let i = 0; i < this.n; i++) { old.getMatrixAt(i, TM); this.im.setMatrixAt(i, TM); if (oh) { oh.getMatrixAt(i, TM); this.hull.setMatrixAt(i, TM); } } scene.remove(old); old.dispose(); if (oh) { scene.remove(oh); oh.dispose(); } }
    this.cap = cap; this.im.count = this.n; if (this.hull) this.hull.count = this.n; this.im.instanceMatrix.needsUpdate = true; if (this.hull) this.hull.instanceMatrix.needsUpdate = true;
  }
  put(i, p) {
    TQ.setFromAxisAngle(YAX, p.ry); TS.setScalar(p.scale); TM.compose(p.center, TQ, TS); this.im.setMatrixAt(i, TM); this.im.instanceMatrix.needsUpdate = true;
    if (this.hull) { TC.copy(this.c).multiplyScalar(p.scale * (1 - HULL_K)).applyQuaternion(TQ); TP.copy(p.center).add(TC); TS.setScalar(p.scale * HULL_K); TM.compose(TP, TQ, TS); this.hull.setMatrixAt(i, TM); this.hull.instanceMatrix.needsUpdate = true; }
  }
  add(p) { if (this.n >= this.cap) this.grow(this.cap * 2); const i = this.n++; this.items[i] = p; p.bi = i; p.batch = this; this.put(i, p); this.im.count = this.n; if (this.hull) this.hull.count = this.n; }
  remove(p) { const i = p.bi, last = --this.n; if (i !== last) { const q = this.items[last]; this.items[i] = q; q.bi = i; this.put(i, q); } this.items[last] = null; this.im.count = this.n; if (this.hull) this.hull.count = this.n; p.batch = null; }
}
function attach(p) { const k = batchKey(p); let b = batches.get(k); if (!b) { b = new Batch(k, geoFor(p.type, p.mask), MATSET[p.mat][pstate(p)]); batches.set(k, b); } b.add(p); }
function restate(p) { if (p.batch && p.batch.key !== batchKey(p)) { p.batch.remove(p); attach(p); } }
const refresh = p => { if (p.batch) p.batch.put(p.bi, p); };
export function slotFree(s) {
  const { ix, iz, lev } = s;
  switch (s.type) {
    case 'w': return !occ.has(sk.w(s.o, ix, iz, lev));
    case 'f': return !occ.has(sk.f(ix, iz, lev)) && !occ.has(sk.r(ix, iz, lev - 1)) && !occ.has(sk.s(ix, iz, lev - 1));
    case 's': return !occ.has(sk.s(ix, iz, lev)) && !occ.has(sk.r(ix, iz, lev - 1));
    default: return !occ.has(sk.r(ix, iz, lev)) && !occ.has(sk.f(ix, iz, lev + 1)) && !occ.has(sk.s(ix, iz, lev + 1));
  }
}
export function canPlace(s) {
  if (s.lev < 0 || s.lev > MAX_LEV) return false;
  const b = world.bounds, p = slotPose(s); if (p.x < b.minX + 1 || p.x > b.maxX - 1 || p.z < b.minZ + 1 || p.z > b.maxZ - 1) return false;
  if (!slotFree(s)) return false;
  for (const [a, c, d, e, f, g] of worldBoxes(s, 511)) if (boxOverlapsAny(a + .06, c - .06, d + .06, e - .06, f + .06, g - .06, bx => bx.kind === 'prop')) return false;
  return true;
}
export function placePiece(s, mat, owner, opts = {}) {
  if (!opts.force && !canPlace(s)) return null; if (opts.force && !slotFree(s)) return null;
  if (pieces.size >= QL.maxPieces) { for (const q of pieces.values()) if (q.owner !== 'map') { destroyPiece(q, null, true); break; } }
  const mask = opts.mask === undefined ? 511 : opts.mask, pose = slotPose(s);
  const p = { id: opts.id || nextId++, type: s.type, ix: s.ix, iz: s.iz, lev: s.lev, o: s.o || 'x', dir: s.dir | 0, mat, mask, owner, age: opts.instant ? BUILD_T : 0, maxHp: pieceMaxHp(s.type, mat), hp: 0, boxes: [], hitT: 0, center: new V3(pose.x, pose.y, pose.z), ry: pose.ry, scale: 1, batch: null, bi: 0 };
  p.hp = opts.instant ? p.maxHp : p.maxHp * .34; p.key = slotKey(p); if (!opts.instant) p.scale = .86;
  attach(p); addBoxes(p); pieces.set(p.id, p); occ.set(p.key, p); if (!opts.instant) building.add(p);
  if (!opts.silent) sfxAt('build', p.center);
  return p;
}
function addBoxes(p) { for (const [a, c, d, e, f, g] of worldBoxes(p, p.mask)) { const b = world.add({ minX: a, maxX: c, minY: d, maxY: e, minZ: f, maxZ: g, kind: 'piece', piece: p }); p.boxes.push(b); } }
function dropBoxes(p) { for (const b of p.boxes) world.remove(b); p.boxes.length = 0; }
export function destroyPiece(p, attacker, quiet, remote) {
  if (!pieces.has(p.id)) return; if (NET.on && NET.host && !quiet && !remote && NET.onDestroy) NET.onDestroy(p); dropBoxes(p); pieces.delete(p.id); occ.delete(p.key); building.delete(p); if (p.batch) p.batch.remove(p);
  if (W.edit && W.edit.piece === p) W.edit = null;
  if (!quiet) { burst(p.center, MATS[p.mat].color, p.type === 'w' ? 14 : 10, 7, .2, .9, 16, 2); sfxAt('breakp', p.center); }
  if (onDestroy) onDestroy(p, attacker);
}
let onDestroy = null; export const hookDestroy = f => { onDestroy = f; };
export function damagePiece(p, dmg, attacker, fromNet) {
  if (!pieces.has(p.id) || p.owner === 'map-solid') return 0;
  if (NET.on && !NET.host && !fromNet) { if (NET.onDamage) NET.onDamage(p, dmg); p.hitT = .12; p.scale = .965; refresh(p); return dmg; }
  p.hp -= dmg; p.hitT = .12;
  if (p.hp <= 0) { destroyPiece(p, attacker); return dmg; }
  restate(p); p.scale = .965; refresh(p); if (NET.on && NET.host && NET.onHp) NET.onHp(p); return dmg;
}
export function setPieceHp(p, hp) { p.hp = Math.min(p.maxHp, hp); p.hitT = .12; restate(p); p.scale = .965; refresh(p); }
export const pieceAtSlot = s => occ.get(slotKey(s));
export function updatePieces(dt) {
  for (const p of building) {
    p.age += dt; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .66 / BUILD_T * dt);
    if (p.age >= BUILD_T) { building.delete(p); p.scale = 1; restate(p); refresh(p); sfxAt('buildDone', p.center); }
    else { p.scale = .86 + .14 * Math.min(1, p.age / .25); refresh(p); }
  }
  for (const p of pieces.values()) if (p.hitT > 0) { p.hitT -= dt; if (p.hitT <= 0 && !building.has(p)) { p.scale = 1; refresh(p); } }
}
export function clearPieces(keepMap) { for (const p of [...pieces.values()]) if (!keepMap || p.owner !== 'map') destroyPiece(p, null, true); }
export function pieceCount() { return pieces.size; }
export function setMask(p, mask) {
  if (!pieces.has(p.id)) return; if (mask === 0) { destroyPiece(p, null, false); return; } if (mask === p.mask) return;
  dropBoxes(p); p.batch.remove(p); p.mask = mask; attach(p); addBoxes(p); sfxAt('edit', p.center);
}
export const slotOf = p => ({ type: p.type, ix: p.ix, iz: p.iz, lev: p.lev, o: p.o, dir: p.dir });
export const wireOf = p => [p.id, p.type, p.ix, p.iz, p.lev, p.o === 'z' ? 1 : 0, p.dir, MAT_IDS.indexOf(p.mat), p.mask, Math.round(p.hp)];
export function pieceFromWire(a, owner) {   // [id, type, ix, iz, lev, o, dir, mat, mask, hp]
  const s = { type: a[1], ix: a[2], iz: a[3], lev: a[4], o: a[5] ? 'z' : 'x', dir: a[6] };
  const old = pieces.get(a[0]); if (old) return old;
  const p = placePiece(s, MAT_IDS[a[7]] || 'wood', owner, { id: a[0], mask: a[8], force: true, instant: false, silent: false }); if (p && a[9] > 0) p.hp = Math.min(p.maxHp, a[9]); return p;
}

// ---------------------------------------------------------------- picking a slot from where somebody stands and looks
export const levelAt = y => Math.floor((y + LEV_BIAS) / H);
export function cardinal(yaw) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 3) : (fz < 0 ? 0 : 2); }
export function slotFromPose(type, pos, yaw, pitch, rot = 0) {
  const cx = Math.floor(pos.x / CELL), cz = Math.floor(pos.z / CELL), lev = levelAt(pos.y), d = cardinal(yaw), [dx, dz] = ROT[d];
  if (type === 'w') { const edge = d === 0 ? { o: 'x', ix: cx, iz: cz } : d === 2 ? { o: 'x', ix: cx, iz: cz + 1 } : d === 3 ? { o: 'z', ix: cx, iz: cz } : { o: 'z', ix: cx + 1, iz: cz }; return { type: 'w', lev, ...edge }; }
  if (type === 'f') { if (pitch > .55) return { type: 'f', ix: cx, iz: cz, lev: lev + 1 }; if (pitch < -.5) return { type: 'f', ix: cx, iz: cz, lev }; return { type: 'f', ix: cx + dx, iz: cz + dz, lev }; }
  if (type === 's') return { type: 's', ix: cx + dx, iz: cz + dz, lev, dir: (d + rot) & 3 };
  return { type: 'r', ix: cx, iz: cz, lev };
}

// ---------------------------------------------------------------- ghost preview
const GHOST_OK = new THREE.MeshBasicMaterial({ color: 0x4aff8a, transparent: true, opacity: .2, depthWrite: false }), GHOST_BAD = new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: .2, depthWrite: false });
const LINE_OK = new THREE.LineBasicMaterial({ color: 0x9dffc0 }), LINE_BAD = new THREE.LineBasicMaterial({ color: 0xff8a8a });
const ghostEdges = new Map(); let ghost = null, ghostLines = null;
export function showGhost(s, ok) {
  if (!ghost) { ghost = new THREE.Mesh(geoFor('w'), GHOST_OK); ghost.renderOrder = 5; scene.add(ghost); ghostLines = new THREE.LineSegments(new THREE.BufferGeometry(), LINE_OK); ghostLines.renderOrder = 6; ghost.add(ghostLines); }
  const pose = slotPose(s), g = geoFor(s.type, 511); ghost.geometry = g; ghost.material = ok ? GHOST_OK : GHOST_BAD;
  let e = ghostEdges.get(g); if (!e) { e = new THREE.EdgesGeometry(g, 20); ghostEdges.set(g, e); } ghostLines.geometry = e; ghostLines.material = ok ? LINE_OK : LINE_BAD;
  ghost.position.set(pose.x, pose.y, pose.z); ghost.rotation.y = pose.ry; ghost.visible = true;
}
export function hideGhost() { if (ghost) ghost.visible = false; }

// ---------------------------------------------------------------- editing (walls and floors): 9 tiles, toggle them and confirm
const TILE_KEEP = new THREE.MeshBasicMaterial({ color: 0x4aff8a, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide }), TILE_CUT = new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide }), TILE_HOT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6, depthWrite: false, side: THREE.DoubleSide });
export const editable = p => p.type === 'w' || p.type === 'f';
function tileBox(p, i) {   // world-space box of tile i
  const t = CELL / 3, c = i % 3, r = (i / 3) | 0, pose = slotPose(p), e = .06;
  if (p.type === 'w') { const hz = p.o === 'z', lx = (c - 1) * t, ly = (r - 1) * (H / 3); return { cx: pose.x + (hz ? 0 : lx), cy: pose.y + ly, cz: pose.z + (hz ? lx : 0), sx: hz ? WT + e : t, sy: H / 3, sz: hz ? t : WT + e }; }
  return { cx: pose.x + (c - 1) * t, cy: pose.y, cz: pose.z + (r - 1) * t, sx: t, sy: FT + e, sz: t };
}
export function startEdit(p) {
  if (!editable(p) || !pieces.has(p.id)) return null; cancelEdit();
  const g = new THREE.Group(), tiles = [];
  for (let i = 0; i < 9; i++) { const b = tileBox(p, i), m = new THREE.Mesh(new THREE.BoxGeometry(b.sx * .94, b.sy * .94, b.sz), TILE_KEEP); m.position.set(b.cx, b.cy, b.cz); m.renderOrder = 6; g.add(m); tiles.push({ m, box: { minX: b.cx - b.sx / 2, maxX: b.cx + b.sx / 2, minY: b.cy - b.sy / 2, maxY: b.cy + b.sy / 2, minZ: b.cz - b.sz / 2, maxZ: b.cz + b.sz / 2 } }); }
  scene.add(g); W.edit = { piece: p, mask: p.mask, group: g, tiles, hot: -1 }; paintEdit(); return W.edit;
}
function paintEdit() { const E = W.edit; if (!E) return; E.tiles.forEach((t, i) => { t.m.material = i === E.hot ? TILE_HOT : (E.mask & (1 << i)) ? TILE_KEEP : TILE_CUT; }); }
export function editHover(ox, oy, oz, dx, dy, dz) {
  const E = W.edit; if (!E) return -1; let best = Infinity, bi = -1;
  E.tiles.forEach((t, i) => { const b = t.box; let tmin = 0, tmax = Infinity, ok = true; for (const [o, d, mn, mx] of [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]]) { if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } } else { let t1 = (mn - o) / d, t2 = (mx - o) / d; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) { ok = false; break; } } } if (ok && tmin < best) { best = tmin; bi = i; } });
  if (bi !== E.hot) { E.hot = bi; paintEdit(); } return bi;
}
export function editToggle() { const E = W.edit; if (!E || E.hot < 0) return false; E.mask ^= (1 << E.hot); paintEdit(); sfx('edit'); return true; }
export const PRESETS = {
  w: [['Door', [1, 4]], ['Window', [4]], ['Gate', [1, 4, 7]], ['Half wall', [6, 7, 8]]],
  f: [['Hole', [4]], ['Half floor', [0, 1, 2]], ['Corner cut', [8]], ['Trench', [3, 4, 5]]],
};
export function editPreset(n) { const E = W.edit; if (!E) return null; const pr = (PRESETS[E.piece.type] || [])[n]; if (!pr) return null; let mask = 511; for (const b of pr[1]) mask &= ~(1 << b); E.mask = mask; paintEdit(); sfx('edit'); return pr[0]; }
export function editReset() { const E = W.edit; if (!E) return; E.mask = 511; paintEdit(); sfx('edit'); }
export function cancelEdit() { const E = W.edit; if (!E) return; scene.remove(E.group); E.group.traverse(c => { if (c.geometry) c.geometry.dispose(); }); W.edit = null; }
export function confirmEdit() { const E = W.edit; if (!E) return null; const p = E.piece, mask = E.mask; cancelEdit(); if (mask !== p.mask) setMask(p, mask); sfx('confirm'); return { p, mask }; }
