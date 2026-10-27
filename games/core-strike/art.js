// Core Strike art, Krunker-style: crisp pixel textures, clean blocky geometry, bright colours.
import * as THREE from './three.module.min.js';
import { W, H, CS, G, ZONE, HG, hAt, SITES, MAP } from './map.js?v=61';

// Lite mode (Chromebooks): game.js sets GFX.lite before the world is built. No sky dome or skyline, 1-draw-call soldier parts.
export const GFX = { lite: false };

// ------------------------------------------------------------------ helpers
let seed = 4242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
const P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rgb = (c, k = 0) => `rgb(${Math.max(0, Math.min(255, c[0] + k))},${Math.max(0, Math.min(255, c[1] + k))},${Math.max(0, Math.min(255, c[2] + k))})`;
// pixel texture: nearest-filtered so the pixels stay crisp
function pix(size, draw) {
  const c = cv(size), x = c.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = GFX.lite ? 1 : 4;
  return t;
}
const speckle = (x, S, base, amt, x0 = 0, y0 = 0, w = S, h = S) => { for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) { x.fillStyle = rgb(base, Math.round((rnd() - 0.5) * amt)); x.fillRect(i, j, 1, 1); } };

export const TEX = {};
// Krunker look: very soft, low-contrast blotches (big 'pixels'), muted colours
const soft = (size, base, amt, extra) => pix(size, (x, S) => { speckle(x, S, base, amt); if (extra) extra(x, S); });
function makeTextures() {
  if (TEX.wall) return;
  TEX.wall = soft(16, [236, 236, 236], 9, (x, S) => { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, 7, S, 1); x.fillRect(0, 15, S, 1); });
  TEX.wallTop = soft(16, [244, 244, 244], 6);
  TEX.floor = soft(16, [178, 116, 88], 12);
  TEX.floorConcrete = soft(16, [172, 174, 176], 10, (x, S) => { x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(0, 8, S, 1); x.fillRect(8, 0, 1, S); });
  TEX.floorPave = soft(16, [206, 196, 176], 11, (x, S) => { x.fillStyle = 'rgba(70,55,35,.2)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 8, S, 1); x.fillRect(0, 0, 1, 8); x.fillRect(8, 8, 1, 8); });
  TEX.floorAsphalt = soft(16, [118, 124, 132], 10, (x, S) => { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); x.fillStyle = 'rgba(255,214,70,.16)'; x.fillRect(5, 6, 6, 1); });
  TEX.floorSnow = soft(16, [226, 233, 240], 7, (x, S) => { x.fillStyle = 'rgba(120,150,190,.12)'; x.fillRect(0, 8, S, 1); x.fillRect(8, 0, 1, S); });
  TEX.floorDirt = soft(16, [184, 150, 108], 13, (x, S) => { x.fillStyle = 'rgba(80,55,30,.12)'; x.fillRect(3, 5, 3, 1); x.fillRect(10, 12, 4, 1); });
  TEX.floorTile = soft(16, [204, 200, 190], 8, (x, S) => { x.fillStyle = 'rgba(40,40,40,.16)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(0, 8, S, 1); x.fillRect(8, 0, 1, S); });
  TEX.container = soft(16, [238, 238, 238], 5, (x, S) => { x.fillStyle = 'rgba(0,0,0,.16)'; for (let i = 1; i < S; i += 2) x.fillRect(i, 1, 1, S - 2); x.fillStyle = 'rgba(0,0,0,.42)'; x.fillRect(0, 0, S, 1); x.fillRect(0, S - 1, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(S - 1, 0, 1, S); });
  TEX.site = soft(16, [198, 192, 182], 9, (x, S) => { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 15, S, 1); x.fillRect(15, 0, 1, S); });
  TEX.crate = soft(16, [170, 122, 78], 8, (x, S) => {
    x.fillStyle = 'rgba(70,40,15,.25)'; for (let i = 3; i < S; i += 4) x.fillRect(1, i, S - 2, 1);
    x.fillStyle = 'rgba(60,35,12,.45)'; x.fillRect(0, 0, S, 1); x.fillRect(0, S - 1, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(S - 1, 0, 1, S);
  });
  TEX.concrete = soft(16, [206, 204, 198], 8, (x, S) => { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); });
  TEX.bag = soft(16, [200, 182, 140], 9, (x, S) => { x.fillStyle = 'rgba(80,60,30,.18)'; x.fillRect(0, 3, S, 1); x.fillRect(0, 7, S, 1); x.fillRect(0, 11, S, 1); x.fillRect(0, 15, S, 1); });
  TEX.metal = soft(16, [236, 236, 236], 5, (x, S) => { x.fillStyle = 'rgba(0,0,0,.1)'; for (let i = 0; i < S; i += 2) x.fillRect(i, 0, 1, S); });
  TEX.cloth = soft(4, [240, 240, 240], 3);
  TEX.gun = TEX.cloth; TEX.plain = TEX.cloth;
  TEX.grass = soft(8, [120, 150, 90], 14);
  // faces (transparent background; the head colour shows through)
  TEX.face = [0, 1].map((side) => pix(16, (x) => {
    x.clearRect(0, 0, 16, 16);
    x.fillStyle = '#1d1d1f'; x.fillRect(4, 6, 2, 2); x.fillRect(10, 6, 2, 2);
    x.fillStyle = 'rgba(40,25,20,.75)'; x.fillRect(3, 4, 3, 1); x.fillRect(10, 4, 3, 1);
    if (side === 0) { x.fillStyle = '#2d2d30'; x.fillRect(1, 10, 14, 6); x.fillStyle = '#3d3d42'; x.fillRect(1, 10, 14, 1); }
    else { x.fillStyle = 'rgba(90,45,35,.8)'; x.fillRect(6, 12, 4, 1); }
  }));
}

// ------------------------------------------------------------------ geometry
const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), c8: new THREE.CylinderGeometry(1, 1, 1, 8), c12: new THREE.CylinderGeometry(1, 1, 1, 12) };
const coneCache = {};
const coneGeo = (r1, r2) => { const k = r1 + ':' + r2; return coneCache[k] || (coneCache[k] = new THREE.CylinderGeometry(r1, r2, 1, 12)); };
const m4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(P3.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S3.set(sx, sy, sz));
const pt = {
  box: (w, h, d, x, y, z, c, rx = 0, ry = 0, rz = 0) => [GEO.box, m4(x, y, z, w, h, d, rx, ry, rz), c],
  cyl: (r, h, x, y, z, c, rx = 0, ry = 0, rz = 0) => [GEO.cyl, m4(x, y, z, r, h, r, rx, ry, rz), c],
  // cylinder lying along z (barrels, scopes)
  cz: (r, len, x, y, z, c, seg = 12) => [seg === 8 ? GEO.c8 : GEO.c12, m4(x, y, z, r, len, r, Math.PI / 2), c],
  // tapered cylinder along z: r1 at the front (-z), r2 at the back
  tz: (r1, r2, len, x, y, z, c) => [coneGeo(r2, r1), m4(x, y, z, 1, len, 1, Math.PI / 2), c],
  // box stretched between two points
  seg: (a, b, w, d, c) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    return [GEO.box, new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), new THREE.Vector3(w, len, d)), c];
  },
};
export function mergeParts(list) {
  const pos = [], nor = [], uv = [], col = [], c = new THREE.Color(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g0, m, hex] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    nm.getNormalMatrix(m); c.set(hex);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      // cheap baked shading: undersides darker, tops lighter
      const k = v.y < -0.5 ? 0.72 : v.y > 0.5 ? 1.06 : 0.92;
      col.push(c.r * k, c.g * k, c.b * k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere(); return g;
}
class BoxBatch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }
  add(x0, y0, z0, x1, y1, z1, { tile = 2, c0 = [1, 1, 1], c1 = c0, faces = 'xXyzZ', uvMode = 'world' } = {}) {
    const F = {
      x: [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0]], X: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]],
      y: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]], z: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
      Z: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
    };
    for (const f of faces) {
      const [a, b, c, d, n] = F[f];
      const cr = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
      const quad = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0 ? [a, d, c, b] : [a, b, c, d];
      const shade = f === 'y' ? 1.05 : f === 'x' || f === 'X' ? 0.86 : 0.95;
      const uvs = quad.map(([x, y, z]) => {
        if (uvMode === 'face') return (f === 'x' || f === 'X') ? [(z - z0) / (z1 - z0), (y - y0) / (y1 - y0)] : f === 'y' ? [(x - x0) / (x1 - x0), (z - z0) / (z1 - z0)] : [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)];
        if (f === 'y') return [x / tile, z / tile];
        if (f === 'x' || f === 'X') return [z / tile, y / tile];
        return [x / tile, y / tile];
      });
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const [x, y, z] = quad[i]; this.pos.push(x, y, z); this.nor.push(...n); this.uv.push(...uvs[i]);
        const k = (y - y0) / ((y1 - y0) || 1), cc = f === 'y' ? c1 : c0.map((v, j) => v + (c1[j] - v) * k);
        this.col.push(cc[0] * shade, cc[1] * shade, cc[2] * shade);
      }
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere(); return g;
  }
}
const lam = (o) => new THREE.MeshLambertMaterial({ flatShading: true, ...o });
function addMesh(scene, geo, mat, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; scene.add(m); return m; }

// ------------------------------------------------------------------ world
export const ENV = null;
export function buildWorld(root) {
  makeTextures();
  const scene = new THREE.Group(); root.add(scene);
  const TH = MAP.theme; seed = 4242 + MAP.seedOff;
  const sunDir = new THREE.Vector3(0.5, 0.75, -0.42).normalize();
  // sky: clean gradient. Lite uses a small dome (100 m, ~200 triangles) that game.js keeps centred on the camera; it blends into the fog at the horizon.
  const R = GFX.lite ? 100 : 600, skyGeo = new THREE.SphereGeometry(R, GFX.lite ? 12 : 32, GFX.lite ? 8 : 16), col = [], c = new THREE.Color(), p = skyGeo.attributes.position;
  const top = new THREE.Color(TH.skyTop), hor = new THREE.Color(GFX.lite ? TH.fog : TH.skyHor);
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i) / R); c.copy(hor).lerp(top, Math.pow(t, 0.6)); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(W, 0, H); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  for (let i = 0; i < 884; i++) rnd(); // keeps the decor layout the same as before the unused cloud boxes were removed


  const isOpen = (x, z) => x >= 0 && z >= 0 && x < W && z < H && G[z * W + x] !== '#';
  const blk = (cx, cz) => hAt(cx, cz) > 0.3;
  // ---- floor (2 m pixel tiles, darker in corners next to walls) ----
  const fl = new BoxBatch(), st = new BoxBatch();
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (G[z * W + x] === '#') continue;
    const zn = ZONE[z * W + x];
    const cornerAO = (dx, dz) => { let n = 0; for (const [ax, az] of [[dx, 0], [0, dz], [dx, dz]]) if (blk(x + ax, z + az)) n++; return n ? 0.76 : 1; };
    const a00 = cornerAO(-1, -1), a10 = cornerAO(1, -1), a01 = cornerAO(-1, 1), a11 = cornerAO(1, 1);
    const b = zn === 'a' || zn === 'b' ? st : fl, x0 = x * CS, z0 = z * CS;
    const tint = zn === 'T' ? [1.04, 1.0, 0.95] : zn === 'D' ? [0.96, 0.98, 1.02] : [1, 1, 1];
    const verts = [[x0, z0, a00], [x0 + CS, z0, a10], [x0 + CS, z0 + CS, a11], [x0, z0 + CS, a01]];
    for (const i of [0, 2, 1, 0, 3, 2]) {
      const [vx, vz, ao] = verts[i]; b.pos.push(vx, 0, vz); b.nor.push(0, 1, 0); b.uv.push(vx / CS, -vz / CS);
      b.col.push(ao * tint[0], ao * tint[1], ao * tint[2]);
    }
  }
  addMesh(scene, fl.geometry(), lam({ map: TEX[TH.floor], vertexColors: true }), false, true);
  addMesh(scene, st.geometry(), lam({ map: TEX.site, vertexColors: true }), false, true);
  // site letters + hazard borders painted on top
  const PX = 16, pc = cv(W * PX, H * PX), px = pc.getContext('2d');
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = ZONE[z * W + x]; if (ch !== 'a' && ch !== 'b') continue;
    const nb = (dx, dz) => ZONE[(z + dz) * W + x + dx];
    for (const [dx, dz, rx, ry, rw, rh] of [[0, -1, 0, 0, PX, 2], [0, 1, 0, PX - 2, PX, 2], [-1, 0, 0, 0, 2, PX], [1, 0, PX - 2, 0, 2, PX]]) {
      if (nb(dx, dz) === ch) continue;
      for (let i = 0; i < Math.max(rw, rh); i += 2) { px.fillStyle = (i / 2 + x + z) % 2 ? '#ffcf2e' : '#2a2a2a'; px.fillRect(x * PX + rx + (rw > rh ? i : 0), z * PX + ry + (rh > rw ? i : 0), rw > rh ? 2 : rw, rh > rw ? 2 : rh); }
    }
  }
  px.font = 'bold 120px "Arial Black", Impact, Arial'; px.textAlign = 'center'; px.textBaseline = 'middle';
  for (const k of ['a', 'b']) { const s = SITES[k]; px.fillStyle = 'rgba(214,52,40,.8)'; px.fillText(s.name, s.center[0] * PX, (s.center[1] + 0.5) * PX + 26); }
  const paintT = new THREE.CanvasTexture(pc); paintT.colorSpace = THREE.SRGBColorSpace; paintT.magFilter = THREE.NearestFilter;
  const paint = addMesh(scene, new THREE.PlaneGeometry(W * CS, H * CS), lam({ map: paintT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), false, true);
  paint.rotation.x = -Math.PI / 2; paint.position.set(W, 0.01, H);

  // ---- walls, crates, platforms ----
  const wb = new BoxBatch(), tops = new BoxBatch(), crates = new BoxBatch(), conc = new BoxBatch(), bags = new BoxBatch(), trim = new BoxBatch();
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = G[z * W + x], h = HG[z * W + x], x0 = x * CS, z0 = z * CS, x1 = x0 + CS, z1 = z0 + CS;
    if (ch === '#') {
      const side = (dx, dz) => { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) return false; return G[nz * W + nx] !== '#'; };   // faces between two wall cells are never seen from the ground (the rock is at least 5 m tall), so only faces next to open ground are built
      let f = ''; if (side(-1, 0)) f += 'x'; if (side(1, 0)) f += 'X'; if (side(0, -1)) f += 'z'; if (side(0, 1)) f += 'Z';
      const pal = TH.walls[(Math.floor(x / 5) * 7 + Math.floor(z / 4) * 13) % TH.walls.length];
      const t = 0.97 + rnd() * 0.05, T = pal.map((v) => v * t);
      if (f) { wb.add(x0, 0, z0, x1, 0.6, z1, { c0: T.map((v) => v * 0.72), c1: T, faces: f }); wb.add(x0, 0.6, z0, x1, h, z1, { c0: T, faces: f }); }

      if (f) tops.add(x0, h - 0.01, z0, x1, h, z1, { faces: 'y', c0: T });   // wall tops are never seen from the ground, so solid rock deep inside gets none (big maps are mostly rock)
      if (f) { const o = 0.1; trim.add(x0 - (f.includes('x') ? o : 0), h - 0.25, z0 - (f.includes('z') ? o : 0), x1 + (f.includes('X') ? o : 0), h + 0.1, z1 + (f.includes('Z') ? o : 0), { c0: T.map((v) => v * 0.85), faces: f }); }   // the ledge only needs the sides that face open ground
    } else if (ch === 'C') {
      crates.add(x0 + 0.02, 0, z0 + 0.02, x1 - 0.02, 1.96, z1 - 0.02, TH.crates ? { uvMode: 'face', c0: TH.crates[(Math.floor(x / 3) * 7 + z * 13) % TH.crates.length] } : { uvMode: 'face' });   // maps with shipping containers colour them in runs of 3
    } else if (ch === 'c') {
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const t = 0.88 + rnd() * 0.16, pc = TH.crates ? TH.crates[(x * 5 + z * 3) % TH.crates.length] : [1, 1, 1]; crates.add(x0 + a + 0.02, 0, z0 + b + 0.02, x0 + a + 0.98, 0.98, z0 + b + 0.98, { uvMode: 'face', c0: [pc[0] * t, pc[1] * t, pc[2] * t] }); }
    } else if ('P123'.includes(ch)) {
      conc.add(x0, 0, z0, x1, h, z1, { c0: [0.8, 0.8, 0.8], c1: [1, 1, 1] });
      if (ch === 'P') conc.add(x0, h, z0, x1, h + 0.04, z1, { c0: [1, 0.85, 0.3], faces: 'y' });
    } else if (ch === 's') {
      bags.add(x0 + 0.05, 0, z0 + 0.05, x1 - 0.05, 0.9, z1 - 0.05, { tile: 2 });
    }
  }
  addMesh(scene, wb.geometry(), lam({ map: TEX.wall, vertexColors: true }));
  addMesh(scene, tops.geometry(), lam({ map: TEX.wallTop, vertexColors: true }), false, true);
  addMesh(scene, trim.geometry(), lam({ map: TEX.wallTop, vertexColors: true }));
  addMesh(scene, crates.geometry(), lam({ map: TH.crates ? TEX.container : TEX.crate, vertexColors: true }));
  addMesh(scene, conc.geometry(), lam({ map: TEX.concrete, vertexColors: true }));
  addMesh(scene, bags.geometry(), lam({ map: TEX.bag, vertexColors: true }));

  // ---- barrels, decorations ----
  const barrels = [], deco = [], glow = [], plants = [];
  const bcols = [0x9c4a3a, 0x3d5f8c, 0xb8913f, 0x5a6e48];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (G[z * W + x] !== 'o') continue;
    for (const [a, b] of [[0.5, 0.5], [1.5, 0.52], [0.52, 1.5], [1.48, 1.48]]) {
      const cc = bcols[(rnd() * 4) | 0], bx = x * CS + a, bz = z * CS + b;
      barrels.push(pt.cyl(0.42, 1.2, bx, 0.6, bz, cc), pt.cyl(0.43, 0.06, bx, 0.35, bz, 0x2a2a2a), pt.cyl(0.43, 0.06, bx, 0.85, bz, 0x2a2a2a));
    }
  }
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (G[z * W + x] !== '#') continue;
    const h = HG[z * W + x];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!isOpen(x + dx, z + dz)) continue;
      const r = rnd(), fx = x * CS + 1 + dx, fz = z * CS + 1 + dz, ry = Math.atan2(dx, dz);
      const at = (out, side, y) => [fx + dx * out + dz * side, y, fz + dz * out - dx * side];
      if (r < 0.1 && h > 4) { // window
        const [a, b, cc] = at(0.03, 0, 3.4); deco.push([GEO.box, m4(a, b, cc, 1.0, 1.25, 0.1, 0, ry), 0x7a5232]);
        const [a2, b2, c2] = at(0.05, 0, 3.4); deco.push([GEO.box, m4(a2, b2, c2, 0.8, 1.05, 0.1, 0, ry), 0x2d4d6e]);
        const [a3, b3, c3] = at(0.08, 0, 3.4); deco.push([GEO.box, m4(a3, b3, c3, 0.06, 1.05, 0.1, 0, ry), 0x7a5232]);
      } else if (r < 0.16) { // door
        const [a, b, cc] = at(0.03, 0, 1.15); deco.push([GEO.box, m4(a, b, cc, 1.1, 2.3, 0.1, 0, ry), [0x5a8fc7, 0x3f9a4a, 0xb4472f, 0x8a5a32][(rnd() * 4) | 0]]);
        const [a2, b2, c2] = at(0.08, 0.35, 1.1); deco.push([GEO.box, m4(a2, b2, c2, 0.08, 0.08, 0.06, 0, ry), 0xf2c94c]);
      } else if (r < 0.2) { // lamp
        const [a, b, cc] = at(0.16, 0, 2.8); glow.push([GEO.box, m4(a, b, cc, 0.2, 0.26, 0.2, 0, ry), 0xfff1b0]);
        const [a2, b2, c2] = at(0.08, 0, 3.0); deco.push([GEO.box, m4(a2, b2, c2, 0.06, 0.06, 0.16, 0, ry), 0x333333]);
      } else if (r < 0.24) { // striped awning
        const cc = rnd() < 0.5 ? 0xd94f3d : 0x3f86d4;
        const [a, b2, c2] = at(0.5, 0, 3.1); deco.push([GEO.box, new THREE.Matrix4().compose(V(a, b2, c2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, ry, 0, 'YXZ')), new THREE.Vector3(1.8, 0.1, 1.1)), cc]);
        const [a3, b3, c3] = at(1.0, 0, 2.78); deco.push([GEO.box, m4(a3, b3, c3, 1.8, 0.22, 0.05, 0, ry), 0xf4efe6]);
      } else if (r < 0.28 && G[(z + dz) * W + x + dx] === '.') { // planter
        const [a, , cc] = at(0.35, 0.5, 0); deco.push(pt.box(0.6, 0.45, 0.6, a, 0.225, cc, 0x9c5a3a)); plants.push(pt.box(0.5, 0.4, 0.5, a, 0.6, cc, 0xffffff), pt.box(0.3, 0.3, 0.3, a + 0.05, 0.9, cc - 0.05, 0xdfffd0));
      } else if (r < 0.31) { // vent
        const [a, b, cc] = at(0.05, -0.4, 1.4); deco.push([GEO.box, m4(a, b, cc, 0.7, 0.5, 0.12, 0, ry), 0x9aa0a6]);
      }
    }
  }
  addMesh(scene, mergeParts(barrels), lam({ map: TEX.metal, vertexColors: true }));
  addMesh(scene, mergeParts(deco), lam({ map: TEX.plain, vertexColors: true }));
  if (plants.length) addMesh(scene, mergeParts(plants), lam({ map: TEX.grass, vertexColors: true }));
  addMesh(scene, mergeParts(glow), new THREE.MeshBasicMaterial({ vertexColors: true }), false, false);

  // ---- skyline (skipped in Lite) ----
  const sk = new BoxBatch(), roofs = [], palms = [];
  for (let i = 0; i < (GFX.lite ? 0 : 70); i++) {
    const a = rnd() * Math.PI * 2, r = 66 + Math.max(0, Math.max(W, H) - 44) * CS * 0.5 + rnd() * 80, x = W + Math.cos(a) * r * 1.15, z = H + Math.sin(a) * r;
    const w = 6 + rnd() * 12, d = 6 + rnd() * 12, h = 7 + rnd() * 16;
    sk.add(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { c0: [0.85, 0.85, 0.85] });
    if (rnd() < 0.3) roofs.push(pt.box(w * 0.5, 2.5, d * 0.5, x, h + 1.25, z, rnd() < 0.5 ? TH.roofs[0] : TH.roofs[1]));
    if (TH.palms && rnd() < 0.5) {
      const px2 = x + w * 0.6 + rnd() * 3, pz = z + d * 0.6, ph = 7 + rnd() * 5;
      palms.push(pt.box(0.5, ph, 0.5, px2, ph / 2, pz, 0x8a6a45));
      for (let k = 0; k < 4; k++) { const an = k / 4 * Math.PI * 2 + 0.4; palms.push([GEO.box, m4(px2 + Math.cos(an) * 1.4, ph, pz + Math.sin(an) * 1.4, 3, 0.25, 1, 0, -an, -0.35), 0x4fa83c]); }
    }
  }
  if (!GFX.lite) {
    addMesh(scene, sk.geometry(), lam({ map: TEX.wall, vertexColors: true }), false, false);
    addMesh(scene, mergeParts(roofs), lam({ map: TEX.plain, vertexColors: true }), false, false);
    addMesh(scene, mergeParts(palms), lam({ map: TEX.plain, vertexColors: true }), false, false);
  }
  const sand = addMesh(scene, new THREE.PlaneGeometry(1400, 1400), lam({ color: TH.ground }), false, false);
  sand.rotation.x = -Math.PI / 2; sand.position.set(W, -0.03, H);

  // signs
  const sign = (cx, cz, dx, dz, text, bg) => {
    const cc = cv(64, 40), x = cc.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 64, 40); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 36, 64, 4);
    x.font = 'bold 28px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(text, 32, 20);
    const t = new THREE.CanvasTexture(cc); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), lam({ map: t, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(cx * CS + 1 + dx * 1.01, 2.4, cz * CS + 1 + dz * 1.01); m.rotation.y = Math.atan2(dx, dz); m.receiveShadow = true; scene.add(m);
  };
  for (const [cx, cz, dx, dz, text, bg] of MAP.signs) sign(cx, cz, dx, dz, text, bg);
  return { sunDir, group: scene, sky: GFX.lite ? sky : null };
}
export function disposeWorld(group) {
  const keep = new Set(Object.values(TEX).flat());
  group.parent && group.parent.remove(group);
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) { if (m.map && !keep.has(m.map)) m.map.dispose(); m.dispose(); }
  });
}

// ------------------------------------------------------------------ characters (Krunker-like: chunky body, smaller cube head, flat colours)
// based on the Krunker default player: plain skin cube head with a hair top, chunky dark jacket, block arms, skin hands
const SPAL = [
  { // RAIDERS: sand yellow
    shirt: 0xb9a063, pants: 0xa38c55, pantsD: 0x8c7745, vest: 0x8a7745, vestL: 0x9d8a56, pouch: 0x6a5a34, helm: 0xd6b968, helmD: 0xb89a4c,
    boot: 0x4a3a28, glove: 0x2b2620, mask: 0xc9b27a, maskU: 0x6a5a38, lens: 0xe3a52c, skin: 0xc8916a, trim: 0x2a2a2a },
  { // WARDENS: green
    shirt: 0x5b7a3e, pants: 0x4d6633, pantsD: 0x3e5328, vest: 0x3d5229, vestL: 0x4c6636, pouch: 0x2c3b1c, helm: 0x62833f, helmD: 0x48642e,
    boot: 0x2b2822, glove: 0x1f2218, mask: 0x2a2e26, maskU: 0x1a1d17, lens: 0x62d0ff, skin: 0xc8916a, trim: 0x20221e },
];
export const SIDE_SLEEVE = [0xb39a5c, 0x587638];
export const charMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
export const lensMats = [];
const solCache = {};
export function soldierParts(side) {
  if (solCache[side]) return solCache[side];
  makeTextures();
  if (!lensMats.length) for (let s = 0; s < 2; s++) lensMats.push(new THREE.MeshLambertMaterial({ map: TEX.face[s], transparent: true, alphaTest: 0.5 }));
  const p = SPAL[side];
  // legs 0-0.62, body 0.62-1.36, head cube 1.36-1.74 (no neck), helmet on top
  const thigh = (sx) => mergeParts([
    pt.box(0.27, 0.33, 0.28, 0, -0.155, 0, p.pants),
    pt.box(0.045, 0.15, 0.2, sx * 0.155, -0.15, 0.0, p.pantsD), pt.box(0.047, 0.035, 0.2, sx * 0.155, -0.09, 0.0, p.vest),
  ]);
  const shin = mergeParts([
    pt.box(0.26, 0.24, 0.27, 0, -0.12, 0, p.pants),
    pt.box(0.22, 0.13, 0.07, 0, -0.03, -0.16, p.trim),
    pt.box(0.275, 0.06, 0.285, 0, -0.215, 0, p.pantsD),
    pt.box(0.28, 0.11, 0.34, 0, -0.265, -0.035, p.boot), pt.box(0.285, 0.03, 0.35, 0, -0.305, -0.035, 0x151515),
  ]);
  const torso = mergeParts([
    pt.box(0.6, 0.74, 0.34, 0, 0.99, 0, p.shirt),
    // belt, buckle, hip pouch + holster
    pt.box(0.64, 0.07, 0.38, 0, 0.69, 0, p.trim), pt.box(0.08, 0.05, 0.02, 0, 0.69, -0.2, 0x8c8c8c),
    pt.box(0.1, 0.13, 0.1, -0.34, 0.64, 0.02, p.pouch), pt.box(0.07, 0.22, 0.15, 0.34, 0.6, -0.02, p.trim),
    // kevlar vest: ONE solid body block (front + back + sides) with a collar, no separate plates
    pt.box(0.66, 0.5, 0.4, 0, 1.12, 0, p.vest),
    pt.box(0.68, 0.06, 0.42, 0, 0.88, 0, p.vestL),
    pt.box(0.62, 0.06, 0.38, 0, 1.38, 0, p.vestL),
    pt.box(0.03, 0.46, 0.02, 0, 1.12, -0.205, p.trim),
    // shoulder straps
    pt.box(0.13, 0.05, 0.42, 0.2, 1.4, 0, p.vest), pt.box(0.13, 0.05, 0.42, -0.2, 1.4, 0, p.vest),
    // chest pouches sit directly on the vest
    pt.box(0.13, 0.15, 0.07, -0.16, 1.0, -0.235, p.pouch), pt.box(0.13, 0.15, 0.07, 0, 1.0, -0.235, p.pouch), pt.box(0.13, 0.15, 0.07, 0.16, 1.0, -0.235, p.pouch),
    // back pack
    pt.box(0.38, 0.32, 0.14, 0, 1.0, 0.27, p.pouch), pt.box(0.32, 0.06, 0.15, 0, 1.18, 0.27, p.trim),
  ]);
  const head = mergeParts([
    pt.box(0.38, 0.38, 0.38, 0, 0, 0, p.maskU),
    pt.box(0.395, 0.17, 0.395, 0, -0.105, 0, p.mask),
    // helmet
    pt.box(0.46, 0.2, 0.46, 0, 0.17, 0, p.helm), pt.box(0.4, 0.06, 0.4, 0, 0.3, 0, p.helm), pt.box(0.32, 0.03, 0.32, 0, 0.345, 0, p.helmD),
    pt.box(0.47, 0.035, 0.47, 0, 0.075, 0, p.helmD), pt.box(0.44, 0.04, 0.09, 0, 0.1, -0.26, p.helmD),
    pt.box(0.06, 0.22, 0.28, 0.235, 0.0, 0.02, p.helmD), pt.box(0.06, 0.22, 0.28, -0.235, 0.0, 0.02, p.helmD),
    pt.box(0.02, 0.035, 0.24, 0.27, 0.06, 0.0, p.trim), pt.box(0.02, 0.035, 0.24, -0.27, 0.06, 0.0, p.trim),
    pt.box(0.12, 0.09, 0.06, 0, 0.17, 0.26, p.trim),
    pt.box(0.1, 0.07, 0.05, 0, 0.21, -0.255, p.trim),
  ]);
  const arm = (sg, S, E, Hd) => [
    pt.seg(S, E, 0.18, 0.18, p.shirt), pt.box(0.18, 0.18, 0.18, E.x, E.y, E.z, p.shirt), pt.seg(E, Hd, 0.16, 0.16, p.shirt),
    pt.box(0.2, 0.09, 0.26, S.x, S.y + 0.045, S.z, p.vest),
    pt.box(0.045, 0.12, 0.12, E.x + sg * 0.1, E.y, E.z, p.trim),
    pt.box(0.135, 0.135, 0.14, Hd.x, Hd.y, Hd.z, p.glove),
  ];
  const sR = V(0.4, 0, 0), eR = V(0.38, -0.22, -0.04), hR = V(0.14, -0.04, -0.3);
  const sL = V(-0.4, 0, 0), eL = V(-0.27, -0.2, -0.24), hL = V(0.08, 0.0, -0.58);
  const arms = mergeParts([...arm(1, sR, eR, hR), ...arm(-1, sL, eL, hL)]);
  return (solCache[side] = { thighL: thigh(-1), thighR: thigh(1), shin, torso, head, arms, lens: new THREE.PlaneGeometry(0.001, 0.001), lensPos: [0, 0, -0.2] });
}
export const TP_GUNS = {};
export function tpGuns() {
  if (TP_GUNS.prim) return TP_GUNS;
  // rifle shouldered: stock at the right shoulder, sights near the face (arms-group space)
  const x = 0.12, y = 0.06;
  TP_GUNS.prim = mergeParts([
    pt.box(0.05, 0.1, 0.22, x, y - 0.015, -0.06, 0x6b4a32), pt.box(0.055, 0.08, 0.3, x, y, -0.32, 0x2c2e33), pt.box(0.05, 0.03, 0.28, x, y + 0.05, -0.32, 0x4a4d53),
    pt.box(0.058, 0.065, 0.2, x, y, -0.57, 0x6b4a32), pt.cz(0.014, 0.2, x, y + 0.015, -0.76, 0x1e2024, 8), pt.box(0.02, 0.045, 0.02, x, y + 0.05, -0.7, 0x1e2024),
    pt.box(0.04, 0.13, 0.065, x, y - 0.1, -0.36, 0x24262a, 0.25), pt.box(0.04, 0.09, 0.05, x, y - 0.07, -0.22, 0x6b4a32, -0.35),
  ]);
  TP_GUNS.sec = mergeParts([pt.box(0.035, 0.045, 0.19, 0.1, 0.02, -0.5, 0x2c2e33), pt.box(0.032, 0.1, 0.05, 0.1, -0.04, -0.43, 0x1e2024, -0.28)]);
  TP_GUNS.knife = mergeParts([pt.box(0.03, 0.04, 0.1, 0.13, -0.03, -0.3, 0x2a2a2a), pt.box(0.012, 0.05, 0.1, 0.13, -0.03, -0.4, 0xd9e0e8, -0.3), pt.box(0.012, 0.04, 0.08, 0.13, -0.07, -0.47, 0xd9e0e8, -0.9), pt.box(0.012, 0.03, 0.06, 0.13, -0.12, -0.5, 0xd9e0e8, -1.4)]);
  return TP_GUNS;
}

// Lite soldiers: the same look, but glued into 4 meshes (2 legs, body, arms + the held gun) instead of ~9.
// Geometry that is already vertex-coloured (soldierParts / tpGuns) is moved and joined without touching its colours.
function joinGeo(list) {
  const pos = [], nor = [], uv = [], col = [], v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g0, m] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere(); return g;
}
const liteCache = {};
export function soldierPartsLite(side) {
  if (liteCache[side]) return liteCache[side];
  const sp = soldierParts(side), tg = tpGuns(), I = new THREE.Matrix4(), T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  return (liteCache[side] = {
    legL: joinGeo([[sp.thighL, I], [sp.shin, T(0, -0.31, 0)]]), legR: joinGeo([[sp.thighR, I], [sp.shin, T(0, -0.31, 0)]]),
    body: joinGeo([[sp.torso, I], [sp.head, T(0, 1.55, 0)]]),
    armsPrim: joinGeo([[sp.arms, I], [tg.prim, I]]), armsSec: joinGeo([[sp.arms, I], [tg.sec, I]]), armsKnife: joinGeo([[sp.arms, I], [tg.knife, I]]),
  });
}

// ------------------------------------------------------------------ first-person guns (low-poly, round barrels and scopes)
const FPM = {};
export function fpMat(key, acc) {
  const k = key === 'acc' ? 'acc' + acc : key;
  if (FPM[k]) return FPM[k];
  const col = key === 'acc' ? (acc || 0xff8a2a) : 0x34373c;
  return (FPM[k] = new THREE.MeshLambertMaterial({ color: col, flatShading: true }));
}
export const sleeveMat = new THREE.MeshLambertMaterial({ color: 0xd9732e, flatShading: true });
const gunMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const dotMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const glassMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.15, depthWrite: false });
const C = { body: 0x3a3d42, dark: 0x25272b, metal: 0x5c6066, light: 0xa9aeb5, wood: 0x8a5a3a, woodD: 0x6a4228, red: 0xa83a2e, brass: 0xc9a14a, blade: 0xd8dde3, green: 0x7dff8a, lens: 0x3c6d96 };
export function buildGun(id, acc) {
  makeTextures();
  const parts = [], extra = [], A = acc;
  const b = (w, h, d, x, y, z, c, rx = 0) => parts.push(pt.box(w, h, d, x, y, z, c, rx));
  const cz = (r, len, x, y, z, c, seg = 12) => parts.push(pt.cz(r, len, x, y, z, c, seg));
  const tz = (r1, r2, len, x, y, z, c) => parts.push(pt.tz(r1, r2, len, x, y, z, c));
  let spec;
  switch (id) {
    case 'p9': case 'viper': {
      const v = id === 'viper', s = v ? 1.22 : 1;
      const SIL = v ? 0xdde1e6 : 0xc3c8cf, FR = 0x25272c, MD = 0x3d4046, GRIP = v ? A : 0x2a2c31;
      const q = (w, h, d, x, y, z, c, rx = 0) => b(w * s, h * s, d * s, x * s, y * s, z * s, c, rx);
      // slide with serrations, ejection port, muzzle
      q(.034, .04, .19, 0, .05, -.075, SIL); q(.014, .004, .17, 0, .072, -.075, MD);
      for (let i = 0; i < 5; i++) q(.0356, .03, .0035, 0, .05, i * .0075, FR);
      for (let i = 0; i < 3; i++) q(.0356, .03, .0035, 0, .05, -.15 + i * .0075, FR);
      q(.0352, .016, .045, 0, .056, -.06, FR); q(.026, .026, .012, 0, .05, -.18, FR);
      // frame, rail, trigger guard, trigger
      q(.032, .022, .17, 0, .016, -.065, FR);
      for (let i = 0; i < 3; i++) q(.0334, .006, .012, 0, .004, -.13 + i * .02, MD);
      q(.022, .006, .05, 0, -.014, -.037, FR); q(.022, .03, .006, 0, 0, -.062, FR); q(.006, .02, .008, 0, 0, -.03, SIL, .3);
      // angled grip with grooves + base plate
      q(.034, .11, .05, 0, -.045, .026, GRIP, -.28);
      // sights with white dots
      q(.008, .012, .012, .0105, .074, .016, FR); q(.008, .012, .012, -.0105, .074, .016, FR); q(.007, .01, .01, 0, .0745, -.162, FR);
      q(.004, .004, .002, .0105, .0735, .0094, 0xffffff); q(.004, .004, .002, -.0105, .0735, .0094, 0xffffff); q(.004, .004, .002, 0, .0745, -.1675, 0xffffff);
      spec = { sy: 0.08 * s, mz: [0, 0.05 * s, -0.19 * s], grip: [0, -0.045 * s, 0.026 * s], ads: [v ? -0.46 : -0.42, 1.2], pistol: true, hs: s }; break;
    }
    case 'buzz':
      b(.07, .095, .38, 0, 0, -.1, C.body); b(.066, .04, .36, 0, .065, -.1, C.dark); b(.074, .05, .16, 0, 0, -.2, A);
      cz(.026, .18, 0, .02, -.38, C.dark); cz(.02, .08, 0, .02, -.5, C.metal, 8);
      b(.04, .2, .058, 0, -.15, -.13, C.dark, .1); b(.044, .09, .052, 0, -.08, .05, C.dark, -.25); cz(.011, .24, .022, .01, .2, C.metal, 8); cz(.011, .24, -.022, .01, .2, C.metal, 8);
      b(.05, .11, .03, 0, -.03, .32, C.dark); b(.04, .1, .045, 0, -.08, -.3, C.dark);
      b(.012, .04, .02, .018, .12, .04, C.dark); b(.012, .04, .02, -.018, .12, .04, C.dark); b(.01, .036, .012, 0, .12, -.24, C.dark);
      spec = { sy: 0.135, mz: [0, 0.02, -0.55], fore: [0, -0.13, -0.3], ads: [-0.46, 1.3] }; break;
    case 'thumper':
      cz(.025, .74, 0, .035, -.34, C.dark); cz(.022, .52, 0, -.02, -.27, C.metal);
      cz(.042, .2, 0, -.022, -.37, C.wood, 8);
      b(.074, .11, .26, 0, 0, 0, C.body); b(.076, .028, .2, 0, .035, 0, A); b(.04, .01, .08, 0, -.068, .04, C.dark);
      b(.064, .12, .34, 0, -.06, .27, C.wood, .15); b(.066, .14, .03, 0, -.088, .44, C.dark, .15);
      for (let i = 0; i < 4; i++) cz(.012, .05, .043, -.005, -.06 + i * .026, C.red, 8);
      b(.012, .014, .012, 0, .068, -.69, C.light); b(.04, .02, .016, 0, .068, -.02, C.dark);
      spec = { sy: 0.08, mz: [0, 0.035, -0.72], fore: [0, -0.08, -0.37], ads: [-0.44, 1.15] }; break;
    case 'raptor':
      b(.076, .105, .42, 0, 0, -.05, C.body); b(.07, .034, .38, 0, .068, -.05, C.metal);
      b(.08, .07, .24, 0, -.01, -.38, C.wood); cz(.022, .22, 0, .065, -.38, C.wood, 8);
      cz(.016, .32, 0, .03, -.62, C.dark); b(.032, .07, .03, 0, .07, -.66, C.dark); b(.006, .03, .006, 0, .105, -.66, C.dark);
      cz(.024, .08, 0, .03, -.8, C.dark, 8);
      b(.016, .035, .04, .02, .1, -.25, C.dark); b(.016, .035, .04, -.02, .1, -.25, C.dark); b(.056, .012, .04, 0, .085, -.25, C.dark);
      b(.05, .13, .085, 0, -.12, -.13, C.dark, .15); b(.05, .13, .085, 0, -.23, -.08, C.dark, .45); b(.044, .09, .052, 0, -.085, .05, C.wood, -.3); b(.04, .01, .09, 0, -.065, -.02, C.dark);
      b(.056, .11, .26, 0, -.035, .29, C.wood, .1); b(.06, .125, .028, 0, -.05, .42, C.dark, .1);
      spec = { sy: 0.12, mz: [0, 0.03, -0.85], fore: [0, -0.08, -0.4], ads: [-0.42, 1.45] }; break;
    case 'sentinel':
      b(.07, .09, .3, 0, -.01, 0, C.body); b(.068, .07, .34, 0, .06, -.06, C.body); b(.03, .014, .48, 0, .1, -.12, C.dark);
      cz(.045, .3, 0, .03, -.4, C.dark); cz(.03, .3, 0, .04, -.71, C.dark); cz(.032, .03, 0, .04, -.6, A);
      b(.05, .17, .078, 0, -.13, -.09, C.dark, .12); b(.044, .09, .052, 0, -.08, .08, C.dark, -.3); b(.04, .01, .09, 0, -.065, 0, C.dark);
      cz(.018, .18, 0, .03, .22, C.dark, 8); b(.056, .11, .17, 0, 0, .36, C.body); b(.05, .016, .04, 0, .1, .14, C.dark);
      // round red-dot
      b(.05, .026, .08, 0, .12, -.06, C.dark);
      { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.007, 6, 16), gunMat.clone()); ring.material.vertexColors = false; ring.material.color.setHex(C.dark); ring.position.set(0, 0.165, -0.08); extra.push(ring);
        const gl = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glassMat); gl.position.set(0, 0.165, -0.08); extra.push(gl);
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 8), dotMat); d.position.set(0, 0.165, -0.0805); extra.push(d); }
      spec = { sy: 0.165, mz: [0, 0.04, -0.88], fore: [0, -0.07, -0.42], ads: [-0.46, 1.6] }; break;
    case 'longbow':
      // like Krunker's sniper: long round barrel, fat scope with a big front bell
      b(.08, .1, .5, 0, 0, -.06, A); b(.07, .05, .2, 0, .06, .22, A); b(.074, .14, .3, 0, -.03, .32, A, .05); b(.076, .16, .03, 0, -.05, .48, C.dark, .05);
      cz(.021, .62, 0, .025, -.62, C.dark); tz(.032, .024, .1, 0, .025, -.95, C.dark);
      cz(.03, .34, 0, .15, -.1, C.dark); tz(.055, .03, .12, 0, .15, -.32, C.dark); cz(.055, .03, 0, .15, -.395, C.dark);
      tz(.03, .045, .07, 0, .15, .1, C.dark); cz(.045, .02, 0, .15, .145, C.dark);
      { const ln = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: C.lens })); ln.position.set(0, 0.15, -0.411); ln.rotation.y = Math.PI; extra.push(ln); }
      b(.035, .05, .03, 0, .1, -.18, C.metal); b(.035, .05, .03, 0, .1, .0, C.metal); cz(.014, .04, 0, .19, -.1, C.metal, 8); parts[parts.length - 1][1] = m4(0, .19, -.1, .014, .04, .014);
      b(.08, .016, .016, .07, .025, .08, C.light); parts.push([GEO.box, m4(.115, .025, .08, .035, .035, .035), C.light]);
      b(.056, .08, .085, 0, -.09, -.02, C.dark); b(.044, .085, .052, 0, -.08, .11, C.dark, -.3); b(.04, .01, .09, 0, -.06, .05, C.dark);
      spec = { sy: 0.15, mz: [0, 0.025, -1.02], fore: [0, -0.06, -0.36], ads: null }; break;
    case 'tec':
      // Rattler: boxy machine pistol, perforated shroud, long magazine ahead of the grip
      b(.036, .05, .17, 0, .05, -.045, C.body); b(.03, .012, .15, 0, .08, -.045, C.dark); b(.04, .026, .07, 0, .062, 0, C.dark);
      cz(.017, .13, 0, .05, -.17, C.metal); for (let i = 0; i < 4; i++) b(.036, .012, .01, 0, .066, -.125 - i * .026, C.dark);
      cz(.008, .04, 0, .05, -.245, C.dark, 8);
      b(.034, .1, .048, 0, -.036, .024, C.dark, -.25); b(.032, .16, .04, 0, -.072, -.08, A);
      b(.022, .006, .05, 0, -.012, -.04, C.dark); b(.022, .026, .006, 0, 0, -.065, C.dark);
      b(.007, .012, .008, .01, .082, .02, C.dark); b(.007, .012, .008, -.01, .082, .02, C.dark); b(.006, .012, .006, 0, .074, -.2, C.dark);
      spec = { sy: 0.09, mz: [0, 0.05, -0.26], grip: [0, -0.04, 0.024], pistol: true, hs: 1, ads: [-0.42, 1.2] }; break;
    case 'revolver':
      // Peacemaker: six-shooter with a fat cylinder, top rib and wood grip
      cz(.016, .22, 0, .052, -.12, C.metal); cz(.011, .2, 0, .022, -.11, C.dark); b(.014, .014, .2, 0, .075, -.1, C.light);
      cz(.037, .055, 0, .044, -.015, C.light, 12);
      for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; cz(.007, .058, Math.cos(an) * .023, .044 + Math.sin(an) * .023, -.015, C.dark, 8); }
      b(.034, .075, .1, 0, .03, .02, C.light); b(.012, .034, .016, 0, .083, .065, C.dark, .5);
      b(.036, .115, .052, 0, -.045, .03, C.wood, -.3); b(.022, .006, .05, 0, -.015, -.01, C.dark); b(.006, .02, .006, 0, 0, -.02, C.dark, .25);
      b(.006, .014, .008, 0, .082, -.215, C.dark);
      spec = { sy: 0.092, mz: [0, 0.052, -0.235], grip: [0, -0.045, 0.03], pistol: true, hs: 1.08, ads: [-0.44, 1.2] }; break;
    case 'chopper':
      // Chopper: bullpup PDW with a horizontal top magazine and a thumbhole grip
      b(.07, .1, .34, 0, 0, -.06, C.body); b(.062, .07, .16, 0, -.02, .14, C.body); b(.058, .036, .3, 0, .075, -.07, A); b(.05, .04, .1, 0, .07, .12, C.dark);
      cz(.02, .14, 0, .02, -.29, C.dark); cz(.014, .05, 0, .02, -.39, C.metal, 8);
      b(.052, .09, .06, 0, -.06, -.02, C.dark, .1); b(.012, .05, .012, 0, .1, -.22, C.dark); b(.05, .03, .04, 0, .105, 0, C.dark); b(.044, .07, .044, 0, -.075, .1, C.dark, -.2);
      spec = { sy: 0.13, mz: [0, 0.02, -0.4], grip: [0, -0.07, 0.1], fore: [0, -0.085, -0.1], ads: [-0.36, 1.3] }; break;
    case 'scatter':
      // Scatter: semi-auto combat shotgun, vented heat shield, tube magazine
      cz(.03, .56, 0, .04, -.3, C.dark); cz(.024, .5, 0, -.02, -.28, C.metal);
      b(.07, .065, .2, 0, 0, -.36, C.wood); for (let i = 0; i < 4; i++) b(.074, .014, .03, 0, .05, -.26 - i * .05, C.dark);
      b(.074, .1, .26, 0, 0, 0, C.body); b(.07, .026, .2, 0, .04, 0, A);
      b(.062, .12, .3, 0, -.055, .26, C.wood, .12); b(.064, .14, .03, 0, -.075, .41, C.dark, .12); b(.044, .09, .052, 0, -.075, .05, C.wood, -.3);
      b(.012, .014, .012, 0, .07, -.58, C.light); b(.04, .02, .016, 0, .07, -.02, C.dark);
      spec = { sy: 0.085, mz: [0, 0.04, -0.6], fore: [0, -0.075, -0.36], ads: [-0.42, 1.15] }; break;
    case 'carbine':
      // Carbine: short rail rifle with a collapsible stock and flip-up sights
      b(.07, .095, .3, 0, 0, -.02, C.body); b(.066, .03, .34, 0, .062, -.05, C.metal); b(.074, .075, .26, 0, .01, -.3, C.dark);
      cz(.014, .26, 0, .025, -.56, C.dark); cz(.02, .06, 0, .025, -.7, C.dark, 8); b(.01, .04, .01, 0, .078, -.5, C.dark); b(.012, .03, .02, 0, .095, 0, C.dark);
      b(.048, .13, .06, 0, -.12, -.1, A, .12); b(.046, .09, .052, 0, -.08, .08, C.dark, -.3);
      b(.036, .08, .16, 0, 0, .26, C.metal); b(.056, .1, .05, 0, -.01, .37, C.dark);
      spec = { sy: 0.115, mz: [0, 0.03, -0.72], grip: [0, -0.08, 0.075], fore: [0, -0.075, -0.3], ads: [-0.4, 1.4] }; break;
    case 'ranger':
      // Ranger: slim bolt-action scout rifle, wood stock, small scope
      b(.05, .08, .5, 0, 0, -.05, C.wood); b(.05, .1, .26, 0, -.04, .28, C.wood, .05); cz(.014, .6, 0, .03, -.55, C.dark);
      cz(.02, .2, 0, .1, -.1, C.dark); tz(.03, .022, .05, 0, .1, -.22, C.dark); b(.03, .04, .02, 0, .07, -.17, C.metal); b(.03, .04, .02, 0, .07, -.03, C.metal);
      b(.04, .01, .01, .04, .04, .06, C.light); parts.push([GEO.box, m4(.065, .04, .06, .02, .02, .02), C.light]);
      b(.04, .04, .1, 0, -.05, -.06, C.dark); b(.044, .085, .052, 0, -.07, .09, C.wood, -.3);
      spec = { sy: 0.13, mz: [0, 0.03, -0.85], grip: [0, -0.07, 0.06], fore: [0, -0.06, -0.3], ads: null }; break;
    case 'dmr':
      // Marksman: semi-auto sniper, long fluted barrel, 4x scope
      b(.07, .09, .3, 0, -.01, 0, C.body); b(.068, .07, .34, 0, .06, -.06, C.body); b(.03, .014, .48, 0, .1, -.12, C.dark);
      b(.07, .075, .34, 0, .02, -.4, C.dark); cz(.017, .34, 0, .025, -.7, C.dark); b(.034, .034, .06, 0, .025, -.9, C.dark);
      b(.05, .15, .07, 0, -.12, -.09, A, .12); b(.044, .09, .052, 0, -.08, .09, C.dark, -.3); b(.05, .1, .2, 0, -.01, .28, C.dark);
      cz(.025, .3, 0, .15, -.12, C.dark); tz(.045, .028, .08, 0, .15, -.34, C.dark); cz(.045, .02, 0, .15, .05, C.dark); b(.03, .05, .03, 0, .115, -.2, C.metal); b(.03, .05, .03, 0, .115, -.04, C.metal);
      spec = { sy: 0.15, mz: [0, 0.025, -0.92], grip: [0, -0.08, 0.09], fore: [0, -0.075, -0.42], ads: null }; break;
    case 'lmg':
      // Hammer: belt-fed light machine gun with an ammo box, carry handle and folded bipod
      b(.09, .12, .4, 0, 0, -.05, C.body); b(.08, .04, .34, 0, .08, -.06, C.metal); b(.012, .05, .12, 0, .12, -.1, C.dark); b(.06, .014, .12, 0, .15, -.1, C.dark);
      b(.09, .1, .14, 0, -.1, -.06, A); b(.02, .02, .1, .04, -.04, -.15, C.brass); b(.02, .02, .1, .05, -.06, -.12, C.brass);
      cz(.03, .4, 0, .02, -.45, C.dark); cz(.014, .18, 0, .02, -.75, C.metal); b(.04, .04, .06, 0, .02, -.86, C.dark);
      b(.01, .01, .2, .04, -.03, -.55, C.light); b(.01, .01, .2, -.04, -.03, -.55, C.light); b(.012, .045, .012, 0, .065, -.7, C.dark); b(.04, .03, .04, 0, .1, .05, C.dark);
      b(.07, .12, .3, 0, -.03, .32, C.wood, .08); b(.05, .1, .06, 0, -.09, .08, C.dark, -.3);
      spec = { sy: 0.13, mz: [0, 0.02, -0.9], grip: [0, -0.09, 0.08], fore: [0, -0.09, -0.3], ads: [-0.4, 1.35] }; break;
    case 'knife': {
      // KARAMBIT: finger ring at the back, short handle, then a blade that curves down like a claw
      parts.push([new THREE.TorusGeometry(0.03, 0.008, 6, 14), m4(0, -0.005, 0.1, 1, 1, 1, 0, Math.PI / 2), C.dark]);
      b(.03, .04, .11, 0, .0, .035, A); for (let k = 0; k < 3; k++) b(.032, .042, .01, 0, .0, .01 + k * .03, C.dark);
      b(.034, .03, .03, 0, .0, -.032, C.metal);
      const seg = [[-.06, .008, -.15, .058, .06], [-.108, 0, -.45, .05, .06], [-.15, -.02, -.8, .042, .055], [-.178, -.052, -1.12, .034, .05], [-.19, -.088, -1.4, .026, .045], [-.186, -.122, -1.7, .018, .035]];
      for (const [z, y, rx, h, d] of seg) parts.push(pt.box(0.009, h, d, 0, y, z, C.blade, rx));
      parts.push(pt.box(0.011, 0.012, 0.04, 0, -.136, -.18, C.light, -1.9));
      spec = { sy: 0, mz: [0, -0.05, -0.2], fore: null }; break;
    }
    default:
      if (id === 'molly') {
        parts.push(pt.cyl(0.032, 0.12, 0, -0.01, -0.04, 0xa8742e), pt.cyl(0.016, 0.07, 0, 0.085, -0.04, 0xa8742e), pt.cyl(0.02, 0.012, 0, 0.12, -0.04, 0x3a3a3a));
        b(.03, .06, .02, .005, .155, -.04, 0xece4d0, .25); b(.026, .05, .02, .01, .2, -.04, 0xff9a2a, .25); b(.016, .035, .016, .012, .235, -.04, 0xffd44a, .25);
        spec = { sy: 0, mz: [0, 0, -0.1], fore: null };
      } else if (id === 'he') { parts.push([new THREE.IcosahedronGeometry(1, 1), m4(0, 0, -0.04, 0.05, 0.058, 0.05), A]); }
      else { parts.push(pt.cyl(0.036, 0.13, 0, 0, -0.04, A)); parts.push(pt.cyl(0.038, 0.014, 0, 0.045, -0.04, C.dark), pt.cyl(0.038, 0.014, 0, -0.045, -0.04, C.dark)); }
      if (id !== 'molly') { b(.016, .09, .022, .042, .03, -.04, C.metal); parts.push(pt.cyl(0.016, 0.03, 0, 0.075, -0.04, C.metal)); spec = { sy: 0, mz: [0, 0, -0.1], fore: null }; }
  }
  const g = new THREE.Group();
  // each arm is ONE simple rectangle (team-coloured sleeve) that comes up from the bottom of the screen and holds the gun
  const armBox = (from, dir, w, len) => {
    const d = dir.clone().normalize();
    const s2 = pt.seg(from, from.clone().addScaledVector(d, len), w, w, 0), sm = new THREE.Mesh(GEO.box, sleeveMat);
    sm.matrixAutoUpdate = false; sm.matrix.copy(s2[1]); g.add(sm);
  };
  const noHands = ['he', 'flash', 'smoke', 'molly'].includes(id);
  if (id === 'knife') armBox(V(0, -0.005, 0.045), V(0.18, -0.5, 0.5), 0.085, 1.2);
  else if (noHands) armBox(V(0, -0.05, -0.02), V(0.18, -0.5, 0.5), 0.09, 1.2);
  else if (spec.pistol) { armBox(V(0.004 * spec.hs, 0.02 * spec.hs, 0.03 * spec.hs), V(0.12, -0.8, 0.5), 0.092 * spec.hs, 1.3)
    armBox(V(-0.012 * spec.hs, -0.012 * spec.hs, 0.012 * spec.hs), V(-0.32, -0.8, 0.5), 0.09 * spec.hs, 1.3); }
  else {
    const gp = spec.grip || [0, -0.08, 0.065];
    armBox(V(gp[0], gp[1] + 0.02, gp[2]), V(0.15, -0.6, 0.45), 0.1, 1.2);
    if (spec.fore) armBox(V(spec.fore[0], spec.fore[1] - 0.012, spec.fore[2]), V(-0.2, -0.6, 0.42), 0.1, 1.2);
  }

  g.add(new THREE.Mesh(mergeParts(parts), gunMat));
  for (const e of extra) g.add(e);
  const mz = new THREE.Object3D(); mz.position.set(...spec.mz); g.add(mz);
  const k = { raptor: 0.8, sentinel: 0.8, buzz: 0.84, thumper: 0.8, longbow: 0.8, chopper: 0.84, scatter: 0.8, carbine: 0.8, ranger: 0.8, dmr: 0.8, lmg: 0.78 }[id] || 1;
  if (k !== 1) { g.scale.setScalar(k); spec.sy *= k; }
  return { ...spec, g, mz };
}
