// GADGET GUARD - everything you see: the ground, scenery, turrets, robots and the core. All built from a few boxes and cylinders with vertex colors.
import { THREE, toon, INK, QL, rng, TAU } from './core.js?v=10';
import { CELL, THEMES, TURRETS, ENEMIES } from './data.js?v=10';

// ---------------------------------------------------------------- tiny geometry kit: every helper returns [geometry, color] for merge()
const tr = (g, x = 0, y = 0, z = 0) => { g.translate(x, y, z); return g; };
const box = (w, h, d, x, y, z, c) => [tr(new THREE.BoxGeometry(w, h, d), x, y, z), c];
const sph = (r, x, y, z, c, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 14, 10); g.scale(sx, sy, sz); return [tr(g, x, y, z), c]; };
const cylY = (r, h, x, y, z, c, seg = 14, r2 = r) => [tr(new THREE.CylinderGeometry(r2, r, h, seg), x, y, z), c];
const cylX = (r, len, x, y, z, c) => { const g = new THREE.CylinderGeometry(r, r, len, 12); g.rotateZ(Math.PI / 2); return [tr(g, x, y, z), c]; };
const cylZ = (r, len, x, y, z, c, r2 = r) => { const g = new THREE.CylinderGeometry(r2, r, len, 12); g.rotateX(Math.PI / 2); return [tr(g, x, y, z), c]; };
const cone = (r, h, x, y, z, c, seg = 10) => [tr(new THREE.ConeGeometry(r, h, seg), x, y, z), c];
const octa = (r, x, y, z, c, sy = 1) => { const g = new THREE.OctahedronGeometry(r); g.scale(1, sy, 1); return [tr(g, x, y, z), c]; };
const rock = (r, x, y, z, c, sy = .7, rot = 0) => { const g = new THREE.DodecahedronGeometry(r); g.scale(1, sy, 1); g.rotateY(rot); return [tr(g, x, y, z), c]; };
export function merge(list) {
  const pos = [], nor = [], col = [], cc = new THREE.Color();
  for (const [geo, color] of list) { const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position.array, n = g.attributes.normal.array; cc.set(color); for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(cc.r, cc.g, cc.b); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.userData.shared = true; return out;
}
// the same shape, puffed up a little: drawn in dark ink behind the real mesh to give the toon outline
function inflate(g, k = .07) { const o = g.clone(), p = o.attributes.position, n = o.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * k, p.getY(i) + n.getY(i) * k, p.getZ(i) + n.getZ(i) * k); o.userData.shared = true; return o; }
export const VMAT = toon(0xffffff, { vertexColors: true }); VMAT.userData.shared = true;
const DARK = 0x2a2140;

// ---------------------------------------------------------------- ground, path, scenery
// returns { group, blocked: Set('c,r'), cells } for a map
export function pathCells(map) {
  const set = new Set(), dirs = [];
  for (const path of map.paths) for (let i = 1; i < path.length; i++) { const [x0, y0] = path[i - 1], [x1, y1] = path[i], dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0); let x = x0, y = y0; for (;;) { set.add(x + ',' + y); if (x === x1 && y === y1) break; x += dx; y += dy; } }
  return set;
}
export function buildWorld(map) {
  const th = THEMES[map.theme], r = rng(map.seed), path = pathCells(map), group = new THREE.Group(), blocked = new Set(), ground = [], deco = [];
  const core = map.paths[0][map.paths[0].length - 1], coreKey = core.join(',');
  for (let c = 0; c < map.cols; c++) for (let rr = 0; rr < map.rows; rr++) {
    const key = c + ',' + rr, onPath = path.has(key), x = (c + .5) * CELL, z = (rr + .5) * CELL;
    if (onPath) ground.push(box(CELL - .12, .5, CELL - .12, x, -.37, z, th.path)); else ground.push(box(CELL - .12, .6, CELL - .12, x, -.3, z, th.ground[(c + rr) & 1]));
  }
  // chevrons on the road show which way the robots walk
  for (const p of map.paths) for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0), len = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    for (let s = 1; s < len; s += 2) { const cx = (x0 + dx * s + .5) * CELL, cz = (y0 + dy * s + .5) * CELL, g = new THREE.BufferGeometry(), ang = Math.atan2(dx, dy); const v = [[0, .72], [-.9, -.5], [0, -.1], [.9, -.5]], tri = [0, 1, 2, 0, 2, 3], pos = [], nor = []; for (const i2 of tri) { const [vx, vz] = v[i2]; pos.push(vx * Math.cos(ang) + vz * Math.sin(ang), -.1, -vx * Math.sin(ang) + vz * Math.cos(ang)); nor.push(0, 1, 0); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.translate(cx, 0, cz); deco.push([g, th.edge]); }
  }
  // scenery sits on cells that are not next to the road, so the best building spots stay free
  const near = (c, rr) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (path.has((c + dx) + ',' + (rr + dy))) return true; return false; };
  for (let c = 0; c < map.cols; c++) for (let rr = 0; rr < map.rows; rr++) {
    const key = c + ',' + rr; if (path.has(key) || near(c, rr)) continue; const edge = c < 1 || rr < 1 || c > map.cols - 2 || rr > map.rows - 2;
    if (r() < (edge ? .5 : .24)) { blocked.add(key); const x = (c + .5) * CELL + (r() - .5) * 1.2, z = (rr + .5) * CELL + (r() - .5) * 1.2; scenery(th.style, r, x, z, deco); }
  }
  for (const m of [ground, deco]) if (m.length) { const geo = merge(m); geo.userData.shared = false; const mesh = new THREE.Mesh(geo, VMAT); mesh.receiveShadow = QL.shadow > 0; mesh.castShadow = m === deco && QL.shadow > 0; group.add(mesh); }
  // the world beyond the board: water or snow, plus a ring of hills
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), toon(th.water)); wm.rotation.x = -Math.PI / 2; wm.position.set(map.cols * 2, -.9, map.rows * 2); group.add(wm);
  const hills = [], rr2 = rng(map.seed + 5), cx = map.cols * 2, cz = map.rows * 2, rad = Math.hypot(cx, cz);
  for (let i = 0; i < 26; i++) { const a = i / 26 * TAU + rr2() * .2, d = rad * 1.45 + 70 + rr2() * 110, h = 14 + rr2() * 34, w = 22 + rr2() * 26; hills.push(cone(w, h, cx + Math.cos(a) * d * 1.15, h / 2 - 1.5, cz + Math.sin(a) * d, th.style === 'frost' ? 0xe6f2fb : th.style === 'desert' ? 0xc98650 : 0x6ec05a, 7)); }
  const hg = merge(hills); hg.userData.shared = false; group.add(new THREE.Mesh(hg, VMAT));
  return { group, blocked, path, core };
}
function scenery(style, r, x, z, out) {
  const s = .8 + r() * .6, rot = r() * TAU;
  if (style === 'meadow') {
    if (r() < .65) { out.push(cylY(.28 * s, 1.1 * s, x, .55 * s, z, 0x8a5a2a, 8)); out.push(cone(1.25 * s, 2.0 * s, x, 1.9 * s, z, 0x3fae4a, 8)); out.push(cone(.95 * s, 1.6 * s, x, 3.0 * s, z, 0x56c85a, 8)); }
    else if (r() < .6) { out.push(rock(.9 * s, x, .45 * s, z, 0x9aa3ad, .7, rot)); out.push(rock(.5 * s, x + .9, .25 * s, z + .3, 0xb4bcc6, .7, rot)); }
    else { out.push(sph(.9 * s, x, .6 * s, z, 0x4fc060, 1, .8, 1)); for (let i = 0; i < 3; i++) out.push(sph(.17, x + (r() - .5) * 1.2, 1.15 * s, z + (r() - .5) * 1.2, [0xff6a9a, 0xffe14a, 0xffffff][i])); }
  } else if (style === 'desert') {
    if (r() < .5) { out.push(cylY(.42 * s, 2.4 * s, x, 1.2 * s, z, 0x4fa05a, 10)); out.push(cylY(.26 * s, 1.0 * s, x + .6 * s, 1.5 * s, z, 0x4fa05a, 8)); out.push(sph(.27 * s, x + .6 * s, 2.05 * s, z, 0x4fa05a)); out.push(sph(.42 * s, x, 2.4 * s, z, 0x4fa05a)); }
    else { out.push(rock(1.2 * s, x, .6 * s, z, 0xc0703a, .8, rot)); out.push(rock(.7 * s, x + 1.1, .35 * s, z - .4, 0xd88a4c, .8, rot)); }
  } else {
    if (r() < .55) { out.push(cylY(.22 * s, .8 * s, x, .4 * s, z, 0x6a4a30, 8)); out.push(cone(1.2 * s, 1.7 * s, x, 1.6 * s, z, 0x2f8a6a, 8)); out.push(cone(.9 * s, 1.5 * s, x, 2.7 * s, z, 0x3fa882, 8)); out.push(cone(.5 * s, .8 * s, x, 3.6 * s, z, 0xffffff, 8)); }
    else { out.push(octa(.8 * s, x, 1.0 * s, z, 0x9ae6ff, 1.9)); out.push(octa(.5 * s, x + .9, .7 * s, z + .4, 0xd0f4ff, 1.6)); }
  }
}

// ---------------------------------------------------------------- turrets: a fixed base and a head that turns toward its target
export const HEAD_Y = 1.0;
const baseGeos = {}, headGeos = {};
export function turretBase(id) {
  if (baseGeos[id]) return baseGeos[id]; const c = TURRETS[id].col;
  return baseGeos[id] = merge([cylY(1.55, .5, 0, .25, 0, DARK, 16), cylY(1.3, .3, 0, .62, 0, c, 16), cylY(.7, .35, 0, .95, 0, 0x4a3f6a, 12)]);
}
export function turretHead(id) {
  if (headGeos[id]) return headGeos[id]; const c = TURRETS[id].col; let list;
  switch (id) {
    case 'pop': list = [sph(.85, 0, .7, 0, c, 1, .9, 1), cylZ(.26, 1.6, 0, .8, 1.0, 0x3a3158), cylZ(.34, .3, 0, .8, 1.8, 0xffe9a0), sph(.3, 0, 1.3, -.3, 0xfff2c0)]; break;
    case 'boom': list = [cylY(1.0, .9, 0, .55, 0, c, 14), cylZ(.5, 1.9, 0, 1.0, .9, 0x3a3158, .42), cylZ(.62, .4, 0, 1.0, 1.9, 0x222034, .5), box(.5, .5, .5, 0, 1.3, -.7, 0xffc04a)]; break;
    case 'frost': list = [cylY(.7, .6, 0, .3, 0, 0x2a5a78, 10), octa(.85, 0, 1.35, 0, c, 1.5), octa(.4, -.95, .9, .1, 0xbff4ff, 1.4), octa(.4, .95, .9, .1, 0xbff4ff, 1.4)]; break;
    case 'rail': list = [box(1.2, .9, 1.8, 0, .6, -.1, c), cylZ(.22, 3.0, 0, .85, 1.6, 0x3a3158), box(.5, .35, .7, 0, 1.25, .1, 0x4ad8ff), cylZ(.34, .5, 0, .85, 3.0, 0xcfa8ff)]; break;
    case 'tesla': list = [cylY(.55, 1.0, 0, .5, 0, 0x4a3f6a, 12), cylY(.78, .22, 0, 1.05, 0, c, 14), cylY(.62, .22, 0, 1.4, 0, c, 14), cylY(.46, .22, 0, 1.75, 0, c, 14), sph(.5, 0, 2.3, 0, 0xfff6b0)]; break;
    default: list = [cylY(.25, 1.7, 0, .85, 0, 0x4a3f6a, 8), cylY(.9, .16, 0, .5, 0, c, 14), cylY(.65, .16, 0, 1.0, 0, c, 14), cylY(.4, .16, 0, 1.5, 0, c, 14), sph(.38, 0, 2.0, 0, 0xd8ffe4)];
  }
  return headGeos[id] = merge(list);
}
const pipGeos = {};
export function turretPips(level) {   // little gold studs on the front of the base: level 2 = one, 3 = two, 4 = three
  if (level < 2) return null; if (pipGeos[level]) return pipGeos[level]; const l = [];
  for (let i = 0; i < level - 1; i++) l.push(box(.36, .36, .36, (i - (level - 2) / 2) * .62, .6, 1.62, 0xffd34e));
  return pipGeos[level] = merge(l);
}
export function turretModel(id, level) {
  const g = new THREE.Group(), base = new THREE.Mesh(turretBase(id), VMAT), head = new THREE.Group(), hm = new THREE.Mesh(turretHead(id), VMAT);
  base.castShadow = hm.castShadow = QL.shadow > 0; head.add(hm); head.position.y = HEAD_Y; g.add(base, head);
  if (QL.hull) { const o = new THREE.Mesh(inflateCache(turretHead(id)), INK); head.add(o); const ob = new THREE.Mesh(inflateCache(turretBase(id)), INK); g.add(ob); }
  let pips = null; setLevel();
  function setLevel(l = level) { if (pips) { g.remove(pips); pips = null; } const pg = turretPips(l); if (pg) { pips = new THREE.Mesh(pg, VMAT); g.add(pips); } head.scale.setScalar(1 + .07 * (l - 1)); level = l; }
  return { group: g, head, base, setLevel, hm };
}
const infl = new Map(); const inflateCache = g => { let o = infl.get(g); if (!o) { o = inflate(g, .08); infl.set(g, o); } return o; };

// ---------------------------------------------------------------- robots
const enemyGeos = {};
export function enemyGeo(type) {
  if (enemyGeos[type]) return enemyGeos[type]; let list;
  switch (type) {
    case 'scout': list = [box(.9, .7, 1.8, 0, .9, 0, 0x2ee6c8), box(.7, .35, .8, 0, 1.4, -.1, 0xbffff2), cylX(.38, 1.5, 0, .4, .65, DARK), cylX(.38, 1.5, 0, .4, -.65, DARK), cylY(.05, 1.0, .3, 1.8, -.6, DARK, 6), sph(.14, .3, 2.3, -.6, 0xff4a6a)]; break;
    case 'swarm': list = [sph(.55, 0, .75, 0, 0xffe14a), sph(.1, -.2, .9, .5, DARK), sph(.1, .2, .9, .5, DARK), cylX(.25, 1.0, 0, .25, 0, DARK)]; break;
    case 'tank': list = [box(.9, .95, 3.2, -1.25, .55, 0, DARK), box(.9, .95, 3.2, 1.25, .55, 0, DARK), box(2.3, 1.0, 2.9, 0, 1.2, 0, 0x8a5cff), box(1.5, .8, 1.5, 0, 2.1, -.1, 0xb18cff), cylZ(.26, 1.9, 0, 2.15, 1.3, DARK), box(2.4, .2, 2.6, 0, 1.78, 0, 0x6a42d0)]; break;
    case 'flyer': list = [sph(.9, 0, 3.4, 0, 0x6ac8ff, 1, .85, 1.3), box(.3, .3, 1.8, 0, 3.5, -1.7, 0xbfeaff), box(.9, .12, .5, 0, 3.7, -2.5, 0xbfeaff), sph(.38, 0, 3.55, .95, 0xdff6ff), cylY(.08, .9, 0, 4.35, 0, DARK, 6), cylY(.1, .4, -.5, 2.55, .2, DARK, 6), cylY(.1, .4, .5, 2.55, .2, DARK, 6)]; break;
    case 'healer': list = [cylY(.72, 1.5, 0, 1.0, 0, 0x4aff8a, 14), sph(.72, 0, 1.75, 0, 0x7affaa), box(.95, .3, .1, 0, 1.2, .72, 0xffffff), box(.3, .95, .1, 0, 1.2, .72, 0xffffff), cylX(.4, 1.5, 0, .4, 0, DARK), sph(.12, -.25, 1.95, .6, DARK), sph(.12, .25, 1.95, .6, DARK)]; break;
    case 'boss': list = [box(.9, 1.1, 3.6, -1.7, .65, 0, DARK), box(.9, 1.1, 3.6, 1.7, .65, 0, DARK), box(3.6, 2.4, 3.6, 0, 2.2, 0, 0xff4a5a), box(2.4, 1.5, 2.2, 0, 4.0, .1, 0xc4283c), box(.55, .4, .15, -.55, 4.15, 1.2, 0xffe14a), box(.55, .4, .15, .55, 4.15, 1.2, 0xffe14a), cone(.35, 1.4, -1.0, 5.4, 0, 0xffd34e, 8), cone(.35, 1.4, 1.0, 5.4, 0, 0xffd34e, 8), box(.8, 2.0, .8, -2.35, 2.4, .2, 0xc4283c), box(.8, 2.0, .8, 2.35, 2.4, .2, 0xc4283c), box(1.6, .5, .2, 0, 2.3, 1.85, 0xffe14a)]; break;
    default: list = [box(1.5, 1.2, 1.5, 0, 1.0, 0, 0xff9a2a), sph(.58, 0, 2.0, .05, 0xffc46a), box(.95, .2, .3, 0, 2.05, .56, DARK), cylX(.4, 1.9, 0, .4, 0, DARK), cylY(.05, .7, 0, 2.8, 0, DARK, 6), sph(.12, 0, 3.2, 0, 0xff4a6a)];
  }
  const g = merge(list); g.userData.outline = inflate(g, type === 'boss' ? .14 : .08); return enemyGeos[type] = g;
}
const rotorGeo = (() => { const g = new THREE.CylinderGeometry(1.9, 1.9, .06, 3); g.userData.shared = true; return g; })(), rotorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 }); rotorMat.userData.shared = true;
const iceGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 0); g.userData.shared = true; return g; })(), iceMat = new THREE.MeshBasicMaterial({ color: 0x8ae8ff, transparent: true, opacity: .4, depthWrite: false }); iceMat.userData.shared = true;
export function enemyModel(type) {
  const E = ENEMIES[type], g = new THREE.Group(), m = new THREE.Mesh(enemyGeo(type), VMAT); m.castShadow = QL.shadow > 0; g.add(m);
  if (QL.hull) g.add(new THREE.Mesh(enemyGeo(type).userData.outline, INK));
  let rotor = null; if (type === 'flyer') { rotor = new THREE.Mesh(rotorGeo, rotorMat); rotor.position.y = 4.4; g.add(rotor); }
  const ice = new THREE.Mesh(iceGeo, iceMat); ice.scale.setScalar(E.r * 1.5); ice.position.y = E.r * 1.1 + (type === 'flyer' ? 2.4 : 0); ice.visible = false; g.add(ice);
  const sc = ENEMIES[type].sc || 1; g.scale.setScalar(sc); g.userData.sc = sc;
  return { group: g, body: m, rotor, ice };
}

// ---------------------------------------------------------------- the core (what you protect) and spawn portals
export function makeCore() {
  const g = new THREE.Group(), b = new THREE.Mesh(merge([cylY(2.9, .6, 0, .3, 0, DARK, 20), cylY(2.4, .5, 0, .85, 0, 0x2a5a78, 20), cylY(1.5, 2.8, 0, 2.5, 0, 0x2ee6c8, 20), cylY(1.58, .28, 0, 1.6, 0, DARK, 20), cylY(1.58, .28, 0, 2.6, 0, DARK, 20), cylY(1.9, .4, 0, 4.0, 0, 0xffd34e, 20), cylY(.5, 1.0, 0, 4.5, 0, 0x2a5a78, 12)]), VMAT); b.castShadow = QL.shadow > 0; g.add(b);
  const og = new THREE.OctahedronGeometry(1.35); og.scale(1, 1.55, 1); const glow = new THREE.Mesh(og, new THREE.MeshBasicMaterial({ color: 0xfff2a0 })); glow.position.y = 6.4; g.add(glow);
  const halo = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 32), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = .12; g.add(halo);
  return { group: g, glow, halo, body: b };
}
export function makePortal(color = 0xb06bff) {
  const g = new THREE.Group(), r1 = new THREE.Mesh(new THREE.TorusGeometry(2.3, .35, 10, 24), new THREE.MeshBasicMaterial({ color })), d = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24), new THREE.MeshBasicMaterial({ color: 0x1a0a3a, transparent: true, opacity: .8 }));
  r1.position.y = 2.6; d.position.y = 2.6; g.add(r1, d); return { group: g, ring: r1, disc: d };
}
