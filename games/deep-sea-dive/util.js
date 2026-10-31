// util.js - small helpers used by every other file: math, a seeded random generator, smooth noise,
// and `Parts`, a tool that glues many little shapes (each with its own colour) into ONE mesh.
import * as THREE from './three.module.min.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length) % arr.length];

// A seeded random number generator: the same seed always gives the same numbers (so the reef looks the same every visit).
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth "value noise": a wobbly number between 0 and 1 that changes slowly as x and y change.
const hash = (x, y) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}
// Several layers of noise added together (big hills + small bumps). Returns about 0..1.
export function fbm(x, y, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * noise2(x * freq, y * freq); norm += amp; freq *= 2; amp *= 0.5; }
  return sum / norm;
}

// Build a Matrix4 from position, scale and rotation in one go.
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
export function mat(px = 0, py = 0, pz = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), _q, new THREE.Vector3(sx, sy, sz));
}

// A flat shape from a list of [x, y, z] corners (a fan of triangles). Used for fins, flags and sails.
export function poly(points) {
  const p = [];
  for (let i = 1; i < points.length - 1; i++) p.push(...points[0], ...points[i], ...points[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

// Parts: add lots of shapes (each moved/scaled by a matrix and painted a colour) and get ONE geometry back.
// One mesh = one draw call, which keeps the game fast. `color` can be a colour, or a function (v, outColor) that paints each corner.
// `glow` (0..1) makes that part shine by itself, even in the dark (used for lanterns, glowing fish and flashlights).
export class Parts {
  constructor() { this.p = []; this.n = []; this.c = []; this.g = []; }
  add(geo, m, color, glow = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pa = g.attributes.position, na = g.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), nv = new THREE.Vector3(), col = new THREE.Color();
    const fn = typeof color === 'function';
    if (!fn) col.set(color);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m);
      nv.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      if (fn) color(v, col);
      this.p.push(v.x, v.y, v.z); this.n.push(nv.x, nv.y, nv.z); this.c.push(col.r, col.g, col.b); this.g.push(glow);
    }
    if (g !== geo) g.dispose();
    return this;
  }
  // flat = true gives the faceted "low-poly" look (every triangle has its own lighting)
  build(flat = true) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.g, 1));
    if (flat) geo.computeVertexNormals();
    return geo;
  }
}
