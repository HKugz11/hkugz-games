// FORT FIGHT - maps: a build range, a box-fight arena and an island. Everything is generated from a seeded random generator.
import { THREE, V3, scene, toon, outline, QL, applyTheme, burst, sfxAt, rnd, clamp, W, TAU, disposeObj, gradient } from './core.js?v=8';
import { world } from './physics.js?v=8';
import { CELL, H, placePiece, clearPieces, MATS, resetIds } from './pieces.js?v=8';
import { addMats } from './actors.js?v=8';

export const mapGroup = new THREE.Group(); scene.add(mapGroup);
export const props = [];
export const propNet = { on: false, host: true, send: null, state: null };
const rng = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// ground texture: 8 m tiles = 2x2 building cells, so the grid is easy to read
const floorCv = document.createElement('canvas'); floorCv.width = floorCv.height = 128;
const floorTex = new THREE.CanvasTexture(floorCv); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.colorSpace = THREE.SRGBColorSpace; floorTex.anisotropy = 4;
function paintFloor(c1, c2, line) { const x = floorCv.getContext('2d'); x.fillStyle = c1; x.fillRect(0, 0, 128, 128); x.fillStyle = c2; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64); x.strokeStyle = line; x.lineWidth = 3; x.strokeRect(0, 0, 128, 128); x.strokeRect(0, 0, 64, 64); x.strokeRect(64, 64, 64, 64); floorTex.needsUpdate = true; }
const groundMat = new THREE.MeshToonMaterial({ map: floorTex, gradientMap: gradient });

const THEMES = {
  range: { sky: [0x3a8cff, 0x9fd8ff, 0xfff3d8], sunStr: 1, fog: [0xcfeaff, 80, 280], floor: ['#8fe0a8', '#7fcf98', 'rgba(30,90,50,.28)'], hemi: [0xd8eeff, 0x7a9a6a, 1.05], sun: [0xfff1d0, 2.3], exposure: 1.1, clouds: 0xffffff },
  box: { sky: [0x2a1a6a, 0x8a4ac8, 0xff9ac8], sunStr: .6, fog: [0x7a5ab8, 70, 230], floor: ['#8a7ae6', '#7a6ad6', 'rgba(255,255,255,.35)'], hemi: [0xc8baff, 0x4a3a90, 1.0], sun: [0xffd0c0, 1.9], exposure: 1.1, clouds: 0xd8c0ff },
  island: { sky: [0x2aa0ff, 0x8fe8ff, 0xfff0c0], sunStr: 1.1, fog: [0xd0f0ff, 90, 320], floor: ['#86e08a', '#74d27a', 'rgba(20,100,40,.28)'], hemi: [0xdcf4ff, 0x8a9a5a, 1.05], sun: [0xfff2d0, 2.4], exposure: 1.1, clouds: 0xffffff },
};
export const MAPS = {
  range: { name: 'Build Range', half: 64, theme: 'range' },
  box: { name: 'Box Fight', half: 36, theme: 'box' },
  island: { name: 'Fort Island', half: 96, theme: 'island' },
};

// ---------------------------------------------------------------- props: trees, rocks and metal crates you can harvest (instanced: one draw call per kind)
function mergeColored(list) {
  const pos = [], nor = [], col = [];
  for (const [geo, color] of list) {
    const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.userData.shared = true; return out;
}
const T = (g, x, y, z) => g.translate(x, y, z);
const PROP_GEO = {
  tree: () => mergeColored([[T(new THREE.CylinderGeometry(.32, .42, 5, 8), 0, 2.5, 0), 0x9a6a3a], [T(new THREE.ConeGeometry(2.3, 2.6, 8), 0, 4.6, 0), 0x3fbf5a], [T(new THREE.ConeGeometry(1.75, 2.6, 8), 0, 6.1, 0), 0x58d070], [T(new THREE.ConeGeometry(1.2, 2.6, 8), 0, 7.6, 0), 0x2fae52]]),
  rock: () => { const g = new THREE.DodecahedronGeometry(1.5, 0); g.scale(1.15, .85, 1); return mergeColored([[T(g, 0, .85, 0), 0xffffff]]); },
  crate: () => mergeColored([[T(new THREE.BoxGeometry(2, 1.7, 2), 0, .85, 0), 0xffffff], [T(new THREE.BoxGeometry(2.04, .18, 2.04), 0, .94, 0), 0x6a6a80]]),
};
const PROP_COL = { tree: [0xffffff], rock: [0xc8d0dc, 0xaab2c0, 0xdde2ec], crate: [0x6aa8e8, 0xff9a3a, 0x8a96b8] };
const PK = {}, propMat = toon(0xffffff, { vertexColors: true }); propMat.userData.shared = true;
const PM = new THREE.Matrix4(), PQ = new THREE.Quaternion(), PQ2 = new THREE.Quaternion(), PP = new V3(), PS = new V3(), ZAX = new V3(0, 0, 1), YAX = new V3(0, 1, 0);
function propBatch(kind) {
  let b = PK[kind]; if (b) return b; const geo = PROP_GEO[kind](); const im = new THREE.InstancedMesh(geo, propMat, 160); im.count = 0; im.frustumCulled = false; im.castShadow = QL.shadow > 0; im.receiveShadow = QL.shadow > 0; mapGroup.add(im);
  b = PK[kind] = { im, n: 0, items: [] }; return b;
}
function putProp(p, k = 1) {
  PQ.setFromAxisAngle(YAX, p.ry); if (p.shake > 0) { PQ2.setFromAxisAngle(ZAX, Math.sin(W.time * 50) * p.shake * .12); PQ.multiply(PQ2); }
  PS.setScalar(Math.max(.001, p.s * k)); PP.set(p.x, 0, p.z); PM.compose(PP, PQ, PS); p.batch.im.setMatrixAt(p.idx, PM); p.batch.im.instanceMatrix.needsUpdate = true;
}
export function makeProp(kind, x, z, s = 1) {
  const b = propBatch(kind), pr = { kind, hp: 0, maxHp: 0, mat: 'wood', shake: 0, dead: 0, box: null, x, z, s, ry: kind === 'tree' ? rnd(0, TAU) : rnd(0, TAU), batch: b, idx: b.n++ };
  let w = 1, hgt = 1;
  if (kind === 'tree') { w = .85 * s; hgt = 5 * s; pr.maxHp = 140; pr.mat = 'wood'; }
  else if (kind === 'rock') { pr.maxHp = 220; pr.mat = 'stone'; w = 2.6 * s; hgt = 1.8 * s; }
  else { pr.maxHp = 260; pr.mat = 'metal'; w = 2 * s; hgt = 1.7 * s; pr.ry = Math.round(rnd(0, 4)) * Math.PI / 2; }
  pr.hp = pr.maxHp; b.items[pr.idx] = pr; b.im.count = b.n;
  const cols = PROP_COL[kind]; if (cols.length > 1) b.im.setColorAt(pr.idx, new THREE.Color(cols[Math.floor(rnd(0, cols.length))])); else b.im.setColorAt(pr.idx, new THREE.Color(0xffffff)); if (b.im.instanceColor) b.im.instanceColor.needsUpdate = true;
  putProp(pr);
  pr.box = world.add({ minX: x - w / 2, maxX: x + w / 2, minY: 0, maxY: hgt, minZ: z - w / 2, maxZ: z + w / 2, kind: 'prop', prop: pr });
  pr.i = props.length;
  pr.onHit = (dmg, a, pos, melee, fromNet) => {
    if (pr.dead > 0) return; if (propNet.on && !propNet.host && !fromNet) { if (propNet.send) propNet.send(pr.i, dmg); pr.shake = .28; sfxAt('harvest', PP.set(x, 1, z)); if (melee && a && !a.infinite) addMats(a, pr.mat, Math.round(clamp(dmg / 2.75, 6, 20))); return; }
    pr.hp -= dmg; pr.shake = .28; sfxAt('harvest', PP.set(x, 1, z));
    burst(pos || new V3(x, 1.5, z), kind === 'tree' ? 0x58d070 : kind === 'rock' ? 0xb8c0cc : 0x86c0f4, 4, 4, .12, .4, 14, 1);
    if (melee && a && !a.infinite) addMats(a, pr.mat, Math.round(clamp(dmg / 2.75, 6, 20)));
    if (pr.hp <= 0) { pr.dead = 35; world.remove(pr.box); if (propNet.on && propNet.host && propNet.state) propNet.state(pr.i, 1); burst(new V3(x, 1.5, z), kind === 'tree' ? 0x3fbf5a : kind === 'rock' ? 0xa8b0bc : 0x86c0f4, 18, 7, .25, 1, 16, 3); }
  };
  props.push(pr); return pr;
}
export function updateProps(dt) {
  for (const p of props) {
    if (p.dead > 0) { p.dead -= dt; if (p.dead > 34.6) putProp(p, clamp((p.dead - 34.6) / .4, 0, 1)); else if (p.dead > 0 && p.dead < 34.6 && p.shake !== -1) { p.shake = -1; putProp(p, 0); } if (p.dead <= 0) { p.dead = 0; p.hp = p.maxHp; p.shake = 0; world.add(p.box); putProp(p, 1); if (propNet.on && propNet.host && propNet.state) propNet.state(p.i, 0); } continue; }
    if (p.shake > 0) { p.shake -= dt; putProp(p); }
  }
}
export function setPropDead(i, dead) {   // from the host
  const p = props[i]; if (!p) return; if (dead && !(p.dead > 0)) { p.dead = 35; world.remove(p.box); } else if (!dead && p.dead > 0) { p.dead = .0001; }
}
export function disposeProps() { for (const k in PK) { PK[k].im.dispose(); delete PK[k]; } }

// ---------------------------------------------------------------- houses (made of real pieces, so they can be shot to bits)
const DOOR = 511 & ~(2 | 16), WINDOW = 511 & ~(8 | 16 | 32);
function house(ix, iz, cw, cd, mat) {
  const put = (type, o, x, z, mask) => placePiece({ type, o, ix: x, iz: z, lev: 0, dir: 0 }, mat, 'map', { instant: true, silent: true, force: true, mask });
  for (let i = 0; i < cw; i++) { put('w', 'x', ix + i, iz, i === (cw >> 1) ? DOOR : (i % 2 ? WINDOW : 511)); put('w', 'x', ix + i, iz + cd, i % 2 ? 511 : WINDOW); }
  for (let j = 0; j < cd; j++) { put('w', 'z', ix, iz + j, j % 2 ? WINDOW : 511); put('w', 'z', ix + cw, iz + j, j === (cd >> 1) ? DOOR : 511); }
  for (let i = 0; i < cw; i++) for (let j = 0; j < cd; j++) { put('f', 'x', ix + i, iz + j, 511); }
  for (let i = 0; i < cw; i++) for (let j = 0; j < cd; j++) placePiece({ type: 'r', ix: ix + i, iz: iz + j, lev: 0, o: 'x', dir: 0 }, mat === 'wood' ? 'stone' : 'wood', 'map', { instant: true, silent: true, force: true });
}

// ---------------------------------------------------------------- building the maps
function clearMap() {
  for (const c of [...mapGroup.children]) { mapGroup.remove(c); disposeObj(c); } disposeProps(); props.length = 0; world.clear(); clearPieces(false);
}
function ground(half, theme, island) {
  const T = THEMES[theme]; paintFloor(...T.floor);
  const size = (island ? half * 3.2 : half + 90) * 2; floorTex.repeat.set(size / 8, size / 8);
  const g = new THREE.Mesh(island ? new THREE.CircleGeometry(half * 1.55, 64) : new THREE.PlaneGeometry(size, size), groundMat); g.rotation.x = -Math.PI / 2; g.receiveShadow = QL.shadow > 0; mapGroup.add(g);
  if (island) { floorTex.repeat.set(half * 3.1 / 8, half * 3.1 / 8);
    const sand = new THREE.Mesh(new THREE.RingGeometry(half * 1.55, half * 1.75, 64), toon(0xf4dea0)); sand.rotation.x = -Math.PI / 2; sand.position.y = .01; mapGroup.add(sand);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(900, 32), new THREE.MeshToonMaterial({ color: 0x2aa8e8, gradientMap: gradient })); sea.rotation.x = -Math.PI / 2; sea.position.y = -.4; mapGroup.add(sea); }
}
function scatterProps(R, half, n, kind, avoid, minGap = 6) {
  const got = [];
  for (let t = 0; got.length < n && t < n * 50; t++) {
    const x = (R() * 2 - 1) * (half - 4), z = (R() * 2 - 1) * (half - 4);
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar) || got.some(([gx, gz]) => Math.hypot(x - gx, z - gz) < minGap)) continue;
    got.push([x, z]); makeProp(kind, x, z, .85 + R() * .5);
  }
  return got;
}
const marker = (x, y, z, col, h = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, h, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x, y + h / 2, z); mapGroup.add(m); return m; };

const BOX_CELLS = [[[-4, -1], [3, -1]], [[-5, -5], [4, -5], [-5, 4], [4, 4]]];
export function buildMap(id, opts = {}) {
  clearMap(); resetIds(); const def = MAPS[id], T = THEMES[def.theme], half = def.half; applyTheme(T); world.bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };
  ground(half, def.theme, id === 'island'); const info = { id, half, spawns: [], dummies: [], botSpawns: [], rebuild: null, ringY: 0 };
  if (id === 'range') {
    const R = rng(11); info.spawns = [[0, 4]]; info.dummies = [[-10, -20], [0, -26], [10, -20], [-18, -36], [18, -36], [0, -46]];
    const avoid = [[0, 0, 22], ...info.dummies.map(([x, z]) => [x, z, 6])];
    scatterProps(R, half, 16, 'tree', avoid, 8); scatterProps(R, half, 9, 'rock', avoid, 7); scatterProps(R, half, 5, 'crate', avoid, 7);
    // the sky ring: build up to it
    info.ringY = 39; const ringM = new THREE.Mesh(new THREE.TorusGeometry(3, .35, 10, 28), new THREE.MeshBasicMaterial({ color: 0xffd34e })); ringM.position.set(0, 39, 0); ringM.rotation.x = Math.PI / 2; mapGroup.add(ringM); info.ring = ringM;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), new THREE.MeshBasicMaterial({ color: 0x4aff8a, transparent: true, opacity: .45 })); pad.rotation.x = -Math.PI / 2; pad.position.set(0, .03, 4); mapGroup.add(pad);
    marker(0, 0, 0, 0xffd34e, 38);
    // a few ready-made walls to practice breaking and editing
    info.rebuild = () => { for (const [ix, iz] of [[-6, -3], [-5, -3], [4, -3], [5, -3]]) placePiece({ type: 'w', o: 'x', ix, iz, lev: 0 }, 'wood', 'map', { instant: true, silent: true, force: true }); };
  } else if (id === 'box') {
    const np = opts.np || 2, cells = np <= 2 ? BOX_CELLS[0] : BOX_CELLS[1];
    info.boxes = cells.slice(0, Math.max(2, np)).map(([cx, cz]) => { const x = cx * CELL + CELL / 2, z = cz * CELL + CELL / 2; return { cx, cz, x, z, yaw: Math.atan2(x, z) }; });
    info.spawns = info.boxes.map(b => [b.x, b.z]); info.botSpawns = info.spawns;
    info.rebuild = () => {
      for (const { cx, cz } of info.boxes) {   // one 1x1 metal room each: walls on every side and a ceiling
        const put = (type, o, ix, iz, lev) => placePiece({ type, o, ix, iz, lev, dir: 0 }, 'metal', 'map', { instant: true, silent: true, force: true });
        put('w', 'x', cx, cz, 0); put('w', 'x', cx, cz + 1, 0); put('w', 'z', cx, cz, 0); put('w', 'z', cx + 1, cz, 0); put('f', 'x', cx, cz, 1);
      }
    };
    scatterProps(rng(5), half - 4, 6, 'tree', [[0, 0, 30]], 10);
  } else {
    const R = rng(23); info.spawns = [[0, 6]];
    const avoid = [[0, 0, 14]];
    // houses on the grid, away from the middle
    const spots = [[-5, -5, 3, 3, 'wood'], [3, -5, 2, 3, 'stone'], [-5, 4, 3, 2, 'stone'], [4, 3, 3, 3, 'wood'], [-14, -2, 3, 3, 'wood'], [12, -14, 3, 2, 'stone'], [-12, 12, 2, 3, 'wood'], [10, 16, 3, 3, 'stone']];
    info.rebuild = () => { for (const [ix, iz, cw, cd, mat] of spots) house(ix, iz, cw, cd, mat); };
    for (const [ix, iz, cw, cd] of spots) avoid.push([(ix + cw / 2) * CELL, (iz + cd / 2) * CELL, Math.max(cw, cd) * CELL * .8 + 3]);
    scatterProps(R, half - 4, 46, 'tree', avoid, 6); scatterProps(R, half - 4, 22, 'rock', avoid, 7); scatterProps(R, half - 4, 14, 'crate', avoid, 7);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + .2, r = half * .72 * (.7 + R() * .3); info.botSpawns.push([Math.cos(a) * r, Math.sin(a) * r]); }
  }
  if (info.rebuild) info.rebuild();
  return info;
}
