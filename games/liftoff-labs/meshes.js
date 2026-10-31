// 3D models for every part: silly toy things (a teapot, soup cans, horns, sausages, party hats...) made from simple solids. No model files.
import * as THREE from './three.module.min.js';

const WHITE = 0xf8f6ff, DARK = 0x2e2a40, METAL = 0xaab3c6, GLASS = 0xc4f0ff, BRASS = 0xf2c14e, BRASS2 = 0xd9a032;
const RAINBOW = [0xff5a5a, 0xff9a3c, 0xffd84a, 0x6fe0b0, 0x6ec3ff, 0xa98bff, 0xff7eb6, 0xffffff];

// ---- tiny geometry baker: every solid gets a colour and a place, then they merge into one mesh
function bake(geo, hex, o = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0)),
    new THREE.Vector3(o.sx || 1, o.sy || 1, o.sz || 1));
  g.applyMatrix4(m);
  const n = g.attributes.position.count, c = new THREE.Color(hex), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
export function merge(list) {
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
const cyl = (rt, rb, h, hex, y = 0, seg = 22, o = {}) => bake(new THREE.CylinderGeometry(rt, rb, h, seg, 1), hex, Object.assign({ y }, o));
const ball = (r, hex, x, y, z, sx = 1, sy = 1, sz = 1) => bake(new THREE.SphereGeometry(r, 14, 10), hex, { x, y, z, sx, sy, sz });
const box = (w, h, d, hex, x = 0, y = 0, z = 0, o = {}) => bake(new THREE.BoxGeometry(w, h, d), hex, Object.assign({ x, y, z }, o));
const dome = (r, hex, y, sy = 1) => bake(new THREE.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), hex, { y, sy });
const flatRing = (R, t, hex, y) => bake(new THREE.TorusGeometry(R, t, 8, 28), hex, { y, rx: Math.PI / 2 });          // a donut lying flat
const upRing = (R, t, hex, x, y, z, sx = 1, sy = 1) => bake(new THREE.TorusGeometry(R, t, 8, 24), hex, { x, y, z, sx, sy });   // a ring you see from the front
// a cone made of coloured slices
function stripes(rTop, rBot, h, y0, colors, n, seg = 20) {
  const L = [];
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    L.push(cyl(rBot + (rTop - rBot) * b, rBot + (rTop - rBot) * a, h / n, colors[i % colors.length], y0 + h * (a + b) / 2, seg));
  }
  return L;
}
// two googly eyes on the front (+Z) of something round
function eyes(r, y, s) {
  const z = r * 0.93, dx = Math.min(r * 0.42, s * 1.5);
  return [ball(s, 0xffffff, -dx, y, z), ball(s, 0xffffff, dx, y, z), ball(s * 0.5, 0x14122a, -dx + s * 0.12, y, z + s * 0.72), ball(s * 0.5, 0x14122a, dx - s * 0.12, y, z + s * 0.72)];
}
const eyeSize = (r) => Math.max(0.07, Math.min(0.2, r * 0.26));

// ---- the nozzle every engine and booster shares: a dark cone at the bottom
const nozzle = (r, h, y) => [cyl(r * 0.45, r * 0.8, h, DARK, y, 16)];

// ---- one function per kind of part. They return a list of coloured solids around the part's centre.
const SHAPES = {
  // ---------------- pilots
  teapot(d) {
    const { h, r, rb } = d, L = [], top = h / 2;
    L.push(cyl(r, rb, h * 0.86, d.col, -h * 0.07, 24));
    L.push(ball(rb * 1.02, d.col, 0, -h * 0.17, 0, 1, 0.78, 1));                       // round belly
    L.push(cyl(rb * 1.02, rb * 1.02, 0.07, d.acc, -h * 0.34, 24));
    L.push(cyl(r * 1.02, r * 1.02, 0.06, d.acc, h * 0.22, 24));                        // pink stripe
    L.push(dome(r * 0.92, 0xffffff, top - 0.19, 0.55));                                // lid
    L.push(ball(0.09, d.acc, 0, top + 0.02, 0));                                       // lid knob
    L.push(bake(new THREE.ConeGeometry(0.15, 0.6, 12), d.acc, { x: rb * 1.12, y: -h * 0.03, rz: -1.0 }));   // spout
    L.push(upRing(0.3, 0.06, d.acc, -rb * 1.1, -h * 0.12, 0, 0.8, 1.1));               // handle
    L.push(cyl(rb * 1.01, rb * 1.01, 0.05, DARK, -top + 0.03, 24));
    L.push(ball(0.19, GLASS, 0, h * 0.04, rb * 0.82, 1, 1.1, 0.5));                    // the Pip's window
    L.push(ball(0.1, PIPCOL, 0, h * 0.03, rb * 0.82 - 0.03, 1, 1, 0.7));
    L.push(ball(0.022, 0x14122a, -0.05, h * 0.05, rb * 0.82 + 0.05), ball(0.022, 0x14122a, 0.05, h * 0.05, rb * 0.82 + 0.05));
    return L;
  },
  bonk(d) {
    const { h, r } = d, L = [], big = r > 1;
    L.push(cyl(r, r, h, d.col, 0, 24));
    L.push(cyl(r * 1.03, r * 1.03, h * 0.18, d.acc, -h * 0.34, 24));
    for (const s of [-1, 1]) {                                                          // ear bolts
      L.push(cyl(r * 0.12, r * 0.12, r * 0.3, METAL, 0, 10, { x: s * r * 1.02, rz: Math.PI / 2 }));
    }
    L.push(ball(r * 0.27, 0xffffff, -r * 0.34, h * 0.06, r * 0.8, 1, 1.1, 0.55), ball(r * 0.27, 0xffffff, r * 0.34, h * 0.06, r * 0.8, 1, 1.1, 0.55));
    L.push(ball(r * 0.12, 0x14122a, -r * 0.3, h * 0.04, r * 0.99), ball(r * 0.12, 0x14122a, r * 0.38, h * 0.08, r * 0.99));   // one eye looks the wrong way
    L.push(box(r * 0.7, h * 0.12, 0.06, DARK, 0, -h * 0.22, r * 0.97));                // mouth
    L.push(cyl(0.02 * (big ? 2 : 1), 0.02 * (big ? 2 : 1), r * 0.7, METAL, h / 2 + r * 0.33, 6, { x: -r * 0.3 }));
    L.push(ball(r * 0.09, 0xff5a5a, -r * 0.3, h / 2 + r * 0.7, 0));
    return L;
  },
  bowl(d) {
    const { h, r, rb } = d, L = [];
    L.push(ball(0.82, d.col, 0, 0, 0, 1, 0.95, 1));
    L.push(cyl(rb, rb, 0.14, d.acc, -h / 2 + 0.07, 24));
    L.push(cyl(r, r * 0.9, 0.16, d.acc, h / 2 - 0.08, 24));
    for (const [x, c] of [[-0.3, PIPCOL], [0.3, 0x7ad0c4]]) L.push(ball(0.27, c, x, 0.12, 0.6, 1, 1, 0.7), ball(0.06, 0xffffff, x - 0.08, 0.17, 0.82), ball(0.06, 0xffffff, x + 0.08, 0.17, 0.82), ball(0.03, 0x14122a, x - 0.08, 0.17, 0.87), ball(0.03, 0x14122a, x + 0.08, 0.17, 0.87));
    L.push(ball(0.2, d.acc, 0, -0.42, 0.62, 1.5, 0.8, 0.6), bake(new THREE.ConeGeometry(0.14, 0.26, 8), d.acc, { x: 0.36, y: -0.42, z: 0.62, rz: -1.5708 }), ball(0.035, 0x14122a, -0.12, -0.38, 0.72));   // the fish
    return L;
  },
  tub(d) {
    const { h, r, rb } = d, L = [];
    L.push(cyl(rb * 0.8, rb, h * 0.72, d.col, -h * 0.12, 28));
    L.push(flatRing(rb * 0.86, 0.12, d.acc, h * 0.2));                                  // rim
    L.push(cyl(r, rb * 0.82, h * 0.24, 0xfff2a8, h * 0.31, 28));                        // sudsy top
    for (const [x, c] of [[-0.45, PIPCOL], [0.0, 0x7ad0c4], [0.45, 0xffc34a]]) L.push(ball(0.26, c, x, h * 0.1, rb * 0.62, 1, 1, 0.7), ball(0.06, 0xffffff, x - 0.08, h * 0.13, rb * 0.62 + 0.18), ball(0.06, 0xffffff, x + 0.08, h * 0.13, rb * 0.62 + 0.18), ball(0.03, 0x14122a, x - 0.08, h * 0.13, rb * 0.62 + 0.23), ball(0.03, 0x14122a, x + 0.08, h * 0.13, rb * 0.62 + 0.23));
    L.push(cyl(0.07, 0.07, 0.5, METAL, h * 0.18, 8, { z: -rb * 0.82 }), cyl(0.05, 0.05, 0.3, METAL, h * 0.43, 8, { z: -rb * 0.82 + 0.1, rx: Math.PI / 2 }));   // tap
    L.push(ball(0.2, 0xffe14a, rb * 0.5, h * 0.42, 0, 1.1, 0.9, 1), ball(0.04, 0x14122a, rb * 0.5 + 0.1, h * 0.46, 0.14));   // rubber duck
    L.push(cyl(rb, rb, 0.08, DARK, -h / 2 + 0.04, 28));
    return L;
  },
  // ---------------- fuel: things from the kitchen
  tin(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 26), cyl(r * 1.03, r * 1.03, h * 0.12, METAL, h * 0.44, 26), cyl(r * 1.03, r * 1.03, h * 0.12, METAL, -h * 0.44, 26));
    L.push(cyl(r * 1.012, r * 1.012, h * 0.3, d.acc, 0, 26));
    L.push(ball(0.18, 0xfff0f4, 0, 0, r * 0.99, 1.4, 0.8, 0.3), bake(new THREE.ConeGeometry(0.1, 0.2, 8), 0xfff0f4, { x: 0.28, z: r * 0.99, rz: -1.5708 }), ball(0.025, 0x14122a, -0.1, 0.02, r * 0.99 + 0.07));   // a little fish picture
    return L;
  },
  soup(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 26), cyl(r * 1.04, r * 1.04, 0.07, METAL, h / 2 - 0.035, 26), cyl(r * 1.04, r * 1.04, 0.07, METAL, -h / 2 + 0.035, 26));
    L.push(cyl(r * 1.012, r * 1.012, h * 0.46, d.acc, 0, 26));
    L.push(...eyes(r, h * 0.05, eyeSize(r)), box(r * 0.5, 0.05, 0.05, 0x14122a, 0, -h * 0.12, r * 1.01));
    return L;
  },
  jug(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 26), cyl(r * 1.03, r * 1.03, 0.1, d.acc, h / 2 - 0.05, 26), cyl(r * 1.03, r * 1.03, 0.1, d.acc, -h / 2 + 0.05, 26));
    L.push(cyl(r * 1.012, r * 1.012, h * 0.26, d.acc, -h * 0.1, 26));
    L.push(upRing(h * 0.2, 0.06, METAL, r + 0.08, h * 0.05, 0, 0.5, 1));            // the handle
    L.push(...eyes(r, h * 0.2, eyeSize(r)));
    return L;
  },
  barrel(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.97, r * 1.04, h * 0.34, d.col, h * 0.3, 24), cyl(r * 1.04, r * 1.04, h * 0.32, d.col, 0, 24), cyl(r * 1.04, r * 0.97, h * 0.34, d.col, -h * 0.3, 24));
    for (const y of [-0.42, -0.2, 0.2, 0.42]) L.push(cyl(r * 1.07, r * 1.07, 0.1, d.acc, h * y, 24));
    L.push(...eyes(r * 1.04, h * 0.06, eyeSize(r)), box(r * 0.35, 0.06, 0.06, 0x14122a, 0, -h * 0.06, r * 1.06));
    return L;
  },
  jar(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 28), cyl(r * 1.04, r * 1.04, h * 0.16, d.acc, h / 2 - h * 0.08, 28), cyl(r * 1.02, r * 1.02, h * 0.08, d.acc, -h / 2 + h * 0.04, 28));
    for (const [x, y] of [[-0.45, 0.1], [0.4, 0.22], [0.0, -0.2]]) L.push(ball(0.28, 0xb56a32, x * r, h * y, r * 0.96, 1, 1, 0.3), ball(0.04, 0x4a2a14, x * r + 0.06, h * y + 0.05, r * 0.96 + 0.08), ball(0.04, 0x4a2a14, x * r - 0.07, h * y - 0.04, r * 0.96 + 0.08));   // cookies
    return L;
  },
  bin(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r * 0.97, h, d.col, 0, 24), cyl(r * 1.05, r * 1.05, h * 0.1, d.acc, h / 2 - h * 0.05, 24), cyl(r * 1.02, r * 1.02, h * 0.06, d.acc, -h / 2 + h * 0.03, 24));
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; L.push(box(0.09, h * 0.7, 0.07, d.acc, Math.cos(a) * r, -h * 0.02, Math.sin(a) * r, { ry: -a })); }
    L.push(...eyes(r, h * 0.28, eyeSize(r)), bake(new THREE.ConeGeometry(0.1, 0.2, 6), 0xffe14a, { x: r * 0.4, y: -h * 0.18, z: r * 0.99, rx: Math.PI }));   // banana peel
    return L;
  },
  thermos(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 26), cyl(r * 1.03, r * 1.03, h * 0.16, DARK, h / 2 - h * 0.08, 26), cyl(r * 1.02, r * 1.02, h * 0.05, DARK, -h / 2 + h * 0.025, 26));
    for (const y of [0.18, -0.15, -0.3]) L.push(cyl(r * 1.015, r * 1.015, 0.14, d.acc, h * y, 26));
    L.push(...eyes(r, h * 0.3, eyeSize(r)));
    return L;
  },
  lamp(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 26), cyl(r * 1.05, r * 1.05, h * 0.05, BRASS, h / 2 - h * 0.025, 26), cyl(r * 1.05, r * 1.05, h * 0.05, BRASS, -h / 2 + h * 0.025, 26));
    const blobs = Math.max(4, Math.round(h * 0.8));
    for (let i = 0; i < blobs; i++) { const a = i * 2.4, y = (-0.42 + 0.84 * ((i * 0.618) % 1)) * h; L.push(ball(r * 0.34, d.acc, Math.sin(a) * r * 0.78, y, Math.cos(a) * r * 0.78, 1, 1.5, 1)); }
    L.push(...eyes(r, h * 0.3, eyeSize(r)));
    return L;
  },
  pot(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 28), cyl(r * 1.04, r * 1.04, h * 0.1, d.acc, h / 2 - h * 0.05, 28), cyl(r * 1.02, r * 1.02, h * 0.06, METAL, -h / 2 + h * 0.03, 28));
    for (const s of [-1, 1]) L.push(upRing(h * 0.16, 0.07, d.acc, s * (r + 0.12), h * 0.1, 0, 1.2, 1));
    L.push(...eyes(r, h * 0.15, eyeSize(r)));
    return L;
  },
  bucket(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r * 0.97, h, d.col, 0, 28), cyl(r * 1.06, r * 1.06, h * 0.07, d.acc, h / 2 - h * 0.035, 28), cyl(r * 1.02, r * 1.02, h * 0.05, d.acc, -h / 2 + h * 0.025, 28));
    for (const y of [0.2, -0.2]) L.push(cyl(r * 1.012, r * 1.012, 0.16, d.acc, h * y, 28));
    L.push(...eyes(r, h * 0.05, eyeSize(r) * 1.3));
    return L;
  },
  bigjar(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 30), cyl(r * 1.04, r * 1.04, h * 0.07, d.acc, h / 2 - h * 0.035, 30), cyl(r * 1.02, r * 1.02, h * 0.05, d.acc, -h / 2 + h * 0.025, 30));
    for (const [x, y] of [[-0.35, 0.05], [0.3, -0.15], [0.05, 0.28]]) L.push(ball(0.5, 0x3e8f2a, x * r, h * y, r * 0.9, 1, 2.2, 0.4));   // pickles inside
    L.push(...eyes(r, h * 0.38, eyeSize(r) * 1.5));
    return L;
  },
  pickle(d) {
    const { h, r } = d, L = [], n = Math.max(1, Math.floor(h / 0.5));
    L.push(cyl(r, r, h - r * 1.6, d.col, 0, 14), ball(r, d.col, 0, (h - r * 1.6) / 2, 0), ball(r * 0.9, d.col, 0, -(h - r * 1.6) / 2, 0));
    for (let i = 0; i < n * 3; i++) { const a = i * 2.1, y = (-0.4 + 0.8 * ((i * 0.37) % 1)) * (h - r * 1.4); L.push(ball(r * 0.14, d.acc, Math.sin(a) * r, y, Math.cos(a) * r)); }
    L.push(...eyes(r, h * 0.2, r * 0.28));
    return L;
  },
  // ---------------- engines: they are all musical instruments
  kazoo(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.22, d.acc, h / 2 - h * 0.11, 22));
    L.push(cyl(r * 0.42, r * 0.5, h * 0.35, d.col, h / 2 - h * 0.4, 18));
    L.push(cyl(r * 0.5, r * 0.88, h * 0.5, d.col, -h * 0.2, 22), cyl(r * 0.9, r * 0.9, 0.06, BRASS, -h / 2 + 0.03, 22), cyl(r * 0.7, r * 0.7, 0.02, 0x15141f, -h / 2 + 0.05, 22));
    L.push(ball(r * 0.18, d.acc, r * 0.46, h * 0.25, 0, 1, 0.5, 1), ball(r * 0.14, 0xffffff, 0, h * 0.5, 0));   // the humming bit
    return L;
  },
  trumpet(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.2, DARK, h / 2 - h * 0.1, 22));
    L.push(cyl(r * 0.3, r * 0.3, h * 0.45, BRASS, h * 0.17, 14));
    L.push(cyl(r * 0.3, r * 0.9, h * 0.52, BRASS, -h * 0.24, 24), cyl(r * 0.93, r * 0.93, 0.07, BRASS2, -h / 2 + 0.035, 24), cyl(r * 0.7, r * 0.7, 0.02, 0x15141f, -h / 2 + 0.05, 24));
    for (const x of [-0.5, 0, 0.5]) L.push(cyl(r * 0.11, r * 0.11, h * 0.3, BRASS2, h * 0.2, 8, { x: x * r * 0.9, z: r * 0.38 }), ball(r * 0.14, d.acc, x * r * 0.9, h * 0.38, r * 0.38));
    return L;
  },
  partyhorn(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.18, d.acc, h / 2 - h * 0.09, 22));
    L.push(...stripes(r * 0.12, r * 0.95, h * 0.75, -h / 2 + 0.03, RAINBOW, 7));
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; L.push(box(0.08, 0.2, 0.02, RAINBOW[i % 8], Math.cos(a) * r * 0.95, -h / 2 - 0.02, Math.sin(a) * r * 0.95, { ry: -a })); }   // paper fringe
    L.push(cyl(r * 0.12, r * 0.12, 0.1, 0xff5a5a, h / 2 - h * 0.2, 8));
    return L;
  },
  whistle(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.25, d.acc, h / 2 - h * 0.12, 20));
    L.push(cyl(r * 0.8, r * 0.8, h * 0.62, METAL, -h * 0.12, 20), box(r * 0.9, h * 0.14, r * 0.5, 0x15141f, 0, -h * 0.1, r * 0.6), ball(r * 0.25, 0xffffff, 0, -h / 2 + 0.02, 0));
    return L;
  },
  squeaker(d) {
    const { h, r } = d, L = [];
    L.push(ball(r * 1.05, 0xffe14a, 0, h * 0.05, 0, 1, 0.8, 1), bake(new THREE.ConeGeometry(r * 0.4, h * 0.4, 12), 0xffb02a, { y: -h * 0.38, rx: Math.PI }));
    L.push(...eyes(r * 0.9, h * 0.08, r * 0.2));
    return L;
  },
  bullhorn(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.4, r * 0.4, h * 0.25, d.acc, h / 2 - h * 0.12, 16));
    L.push(cyl(r * 0.4, r * 1.4, h * 0.75, 0xc8d0de, -h * 0.13, 22), cyl(r * 1.43, r * 1.43, 0.06, 0xff5a5a, -h / 2 + 0.03, 22), cyl(r * 1.1, r * 1.1, 0.02, 0x15141f, -h / 2 + 0.05, 22));
    L.push(box(0.12, h * 0.35, 0.1, DARK, r * 0.9, h * 0.1, 0));
    return L;
  },
  bulb(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.5, r * 0.5, h * 0.2, METAL, h / 2 - h * 0.1, 16), cyl(r * 0.52, r * 0.52, 0.05, METAL, h / 2 - h * 0.05, 16));
    L.push(ball(r * 0.95, 0x9cffc0, 0, -h * 0.05, 0, 1, 1.1, 1));
    L.push(cyl(0.02, 0.02, h * 0.3, 0xffffff, -h * 0.05, 6), cyl(r * 0.45, r * 0.8, h * 0.18, DARK, -h / 2 + h * 0.09, 18));
    return L;
  },
  tuba(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.18, DARK, h / 2 - h * 0.09, 24));
    L.push(cyl(r * 0.3, r * 0.3, h * 0.3, BRASS, h * 0.25, 14));
    L.push(cyl(r * 0.3, r * 0.95, h * 0.6, BRASS, -h * 0.2, 26), cyl(r * 0.98, r * 0.98, 0.08, BRASS2, -h / 2 + 0.04, 26), cyl(r * 0.75, r * 0.75, 0.02, 0x15141f, -h / 2 + 0.06, 26));
    L.push(upRing(r * 0.55, 0.1, BRASS2, 0, h * 0.02, r * 0.5, 1.3, 1), upRing(r * 0.35, 0.1, BRASS2, 0, h * 0.02, r * 0.5, 1.3, 1));
    for (const x of [-0.4, 0, 0.4]) L.push(cyl(r * 0.1, r * 0.1, h * 0.2, METAL, h * 0.25, 8, { x: x * r, z: r * 0.5 }));
    return L;
  },
  foghorn(d) {
    const { h, r } = d, L = [];
    L.push(box(r * 1.3, h * 0.22, r * 1.1, d.acc, 0, h / 2 - h * 0.11, 0), cyl(r * 0.16, r * 0.16, h * 0.2, METAL, h * 0.3, 8, { x: r * 0.4 }));
    L.push(cyl(r * 0.45, r * 1.0, h * 0.72, BRASS, -h * 0.14, 28), cyl(r * 1.02, r * 1.02, 0.09, BRASS2, -h / 2 + 0.045, 28), cyl(r * 0.8, r * 0.8, 0.02, 0x15141f, -h / 2 + 0.07, 28));
    for (const y of [-0.05, -0.25]) L.push(cyl(r * (0.62 + (y + 0.05) * -0.9), r * (0.62 + (y + 0.05) * -0.9) + 0.02, 0.07, BRASS2, h * y, 28));
    return L;
  },
  frenchhorn(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.14, DARK, h / 2 - h * 0.07, 24));
    L.push(cyl(r * 0.3, r * 0.95, h * 0.55, BRASS, -h * 0.25, 26), cyl(r * 0.98, r * 0.98, 0.08, BRASS2, -h / 2 + 0.04, 26), cyl(r * 0.75, r * 0.75, 0.02, 0x15141f, -h / 2 + 0.06, 26));
    for (const [R, z] of [[r * 0.8, r * 0.6], [r * 0.6, r * 0.6], [r * 0.4, r * 0.6]]) L.push(upRing(R, 0.09, BRASS, 0, h * 0.12, z, 1, 1));
    return L;
  },
  sax(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.18, DARK, h / 2 - h * 0.09, 22));
    L.push(cyl(r * 0.28, r * 0.42, h * 0.55, BRASS, h * 0.07, 16), cyl(r * 0.42, r * 0.95, h * 0.28, BRASS, -h * 0.34, 24), cyl(r * 0.98, r * 0.98, 0.07, BRASS2, -h / 2 + 0.035, 24), cyl(r * 0.75, r * 0.75, 0.02, 0x15141f, -h / 2 + 0.05, 24));
    for (let i = 0; i < 5; i++) L.push(ball(r * 0.1, METAL, 0, h * (0.28 - i * 0.12), r * 0.42));
    return L;
  },
  trombone(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.14, DARK, h / 2 - h * 0.07, 26));
    L.push(cyl(r * 0.35, r * 0.95, h * 0.6, BRASS, -h * 0.22, 28), cyl(r * 1.0, r * 1.0, 0.09, BRASS2, -h / 2 + 0.045, 28), cyl(r * 0.78, r * 0.78, 0.02, 0x15141f, -h / 2 + 0.07, 28));
    for (const x of [-0.55, 0.55]) L.push(cyl(r * 0.1, r * 0.1, h * 0.55, BRASS2, h * 0.04, 8, { x: x * r, z: r * 0.5 }));
    L.push(box(r * 1.2, 0.08, 0.1, METAL, 0, h * 0.3, r * 0.5));
    return L;
  },
  megahorn(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r * 0.98, r * 0.98, h * 0.14, d.acc, h / 2 - h * 0.07, 26));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2, x = Math.cos(a) * r * 0.52, z = Math.sin(a) * r * 0.52;
      L.push(cyl(r * 0.18, r * 0.52, h * 0.78, BRASS, -h * 0.1, 18, { x, z }), cyl(r * 0.54, r * 0.54, 0.05, BRASS2, -h / 2 + 0.03, 18, { x, z }), cyl(r * 0.4, r * 0.4, 0.02, 0x15141f, -h / 2 + 0.05, 18, { x, z })); }
    return L;
  },
  // ---------------- boosters: lunch
  cracker(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h - 0.4, d.col, 0.06, 20), dome(r, d.col, (h - 0.4) / 2 + 0.06, 0.5));
    for (let i = 0; i < 4; i++) L.push(cyl(r * 1.02, r * 1.02, 0.1, d.acc, 0.06 + (h - 0.4) * (i / 3 - 0.5) * 0.9, 20));
    L.push(cyl(0.02, 0.02, 0.22, 0x14122a, (h - 0.4) / 2 + r * 0.5 + 0.12, 6), ball(0.05, 0xffb02a, 0, (h - 0.4) / 2 + r * 0.5 + 0.25, 0));
    L.push(...nozzle(r, 0.36, -h / 2 + 0.2));
    return L;
  },
  sausage(d) {
    const { h, r } = d, L = [], b = h - 0.4;
    L.push(cyl(r, r, b, d.col, 0.06, 20), dome(r, d.col, b / 2 + 0.06, 0.8));
    for (let i = 0; i < 5; i++) L.push(cyl(r * 1.015, r * 1.015, 0.05, d.acc, 0.06 + b * (i / 4 - 0.5) * 0.85, 20));
    L.push(...eyes(r, b * 0.1, r * 0.2));
    L.push(...nozzle(r, 0.36, -h / 2 + 0.2));
    return L;
  },
  baguette(d) {
    const { h, r } = d, L = [], b = h - 0.4;
    L.push(cyl(r, r, b, d.col, 0.06, 20), dome(r, d.col, b / 2 + 0.06, 0.8));
    for (let i = 0; i < 6; i++) L.push(box(r * 0.9, 0.06, 0.1, d.acc, 0, 0.06 + b * (i / 5 - 0.5) * 0.85, r * 0.98, { rz: 0.5 }));
    L.push(...nozzle(r, 0.36, -h / 2 + 0.2));
    return L;
  },
  salami(d) {
    const { h, r } = d, L = [], b = h - 0.4;
    L.push(cyl(r, r, b, d.col, 0.06, 24), dome(r, d.col, b / 2 + 0.06, 0.7));
    for (let i = 0; i < 26; i++) { const a = i * 2.39, y = (-0.45 + 0.9 * ((i * 0.618) % 1)) * b; L.push(ball(0.1, d.acc, Math.sin(a) * r, y, Math.cos(a) * r, 1, 1, 0.5)); }
    for (const y of [0.35, -0.35]) L.push(cyl(r * 1.03, r * 1.03, 0.06, 0xbca070, 0.06 + b * y, 24));
    L.push(...eyes(r, b * 0.15, eyeSize(r) * 0.8));
    L.push(...nozzle(r, 0.4, -h / 2 + 0.2));
    return L;
  },
  burrito(d) {
    const { h, r } = d, L = [], b = h - 0.5;
    L.push(cyl(r, r, b, d.col, 0.08, 26), dome(r, d.col, b / 2 + 0.08, 0.5));
    L.push(cyl(r * 1.04, r * 1.04, 0.22, METAL, 0.08 - b * 0.18, 26), cyl(r * 1.04, r * 1.04, 0.22, METAL, 0.08 + b * 0.22, 26));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; L.push(ball(r * 0.22, d.acc, Math.cos(a) * r * 0.82, b / 2 + 0.12, Math.sin(a) * r * 0.82, 1, 0.6, 1)); }   // lettuce
    L.push(...eyes(r, b * 0.02, eyeSize(r) * 1.4));
    L.push(...nozzle(r, 0.46, -h / 2 + 0.25));
    return L;
  },
  // ---------------- rings
  donut(d) {
    const { h, r } = d, L = [], t = Math.max(0.05, h * 0.62);
    L.push(cyl(r * 0.62, r * 0.62, h, DARK, 0, 20));
    L.push(flatRing(r - t * 0.9, t, 0xe8b66a, -h * 0.1), flatRing(r - t * 0.9, t * 0.92, d.col, h * 0.12));
    const n = Math.round(r * 18);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + i * 0.3; L.push(box(0.05, 0.02, 0.014, RAINBOW[i % 7], Math.cos(a) * (r - t * 0.9), h * 0.12 + t * 0.9, Math.sin(a) * (r - t * 0.9), { ry: -a * 3 }));}
    return L;
  },
  clip(d) {
    const { h, rr } = d, L = [];
    L.push(box(rr, h * 0.5, 0.15, d.col, 0, h * 0.25, -0.07, { rz: 0.05 }), box(rr, h * 0.5, 0.15, d.col, 0, h * 0.25, 0.07, { rz: -0.05 }), box(rr * 0.7, h * 0.5, 0.3, d.col, 0, -h * 0.25, 0));
    L.push(cyl(0.06, 0.06, 0.34, d.acc, 0, 0, 8, { rx: Math.PI / 2 }));
    return L;
  },
  // ---------------- hats
  partyhat(d) {
    const { h, r } = d, L = [];
    L.push(...stripes(0.03, r, h, -h / 2, [d.col, d.acc], 6));
    L.push(cyl(r * 1.02, r * 1.02, 0.05, d.acc, -h / 2 + 0.025, 22), ball(0.1, 0xffffff, 0, h / 2 + 0.03, 0));
    return L;
  },
  beanie(d) {
    const { h, r } = d, L = [];
    L.push(dome(r, d.col, -h / 2 + 0.12, (h - 0.12) / r), cyl(r * 1.03, r * 1.03, 0.14, d.acc, -h / 2 + 0.07, 22), ball(0.12, 0xffffff, 0, h / 2 + 0.05, 0));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; L.push(box(0.03, 0.12, 0.03, d.acc, Math.cos(a) * r * 1.04, -h / 2 + 0.07, Math.sin(a) * r * 1.04, { ry: -a })); }
    return L;
  },
  wizard(d) {
    const { h, r } = d, L = [];
    L.push(...stripes(0.04, r * 0.96, h * 0.92, -h / 2 + 0.06, [d.col, 0x7a5ad0], 5));
    L.push(cyl(r * 1.04, r * 1.04, 0.07, d.col, -h / 2 + 0.035, 28), cyl(r * 0.98, r * 0.98, 0.1, d.acc, -h / 2 + 0.2, 28));
    for (const [x, y] of [[-0.3, 0.25], [0.35, 0.1], [0, 0.45]]) L.push(box(0.16, 0.16, 0.04, d.acc, x * r * (1 - y * 0.8), -h / 2 + h * y + 0.2, r * (0.72 - y * 0.6), { rz: 0.78 }));
    return L;
  },
  witch(d) {
    const { h, r } = d, L = [];
    L.push(...stripes(0.05, r * 0.96, h * 0.92, -h / 2 + 0.06, [d.col], 4));
    L.push(cyl(r * 1.04, r * 1.04, 0.08, d.col, -h / 2 + 0.04, 28), cyl(r * 0.97, r * 0.97, 0.18, d.acc, -h / 2 + 0.2, 28), box(0.22, 0.2, 0.05, 0xffd84a, 0, -h / 2 + 0.2, r * 0.97));
    return L;
  },
  trafficcone(d) {
    const { h, r, rb } = d, L = [];
    L.push(cyl(r, rb, h, d.col, 0, 24), cyl(r + (rb - r) * 0.64, r + (rb - r) * 0.86, h * 0.2, 0xffffff, -h * 0.22, 24), cyl(r + (rb - r) * 0.28, r + (rb - r) * 0.48, h * 0.16, 0xffffff, h * 0.12, 24));
    L.push(cyl(rb * 1.03, rb * 1.03, 0.07, DARK, -h / 2 + 0.035, 24));
    L.push(...eyes(rb * 0.8, h * 0.0, Math.max(0.09, rb * 0.13)));
    return L;
  },
  funnel(d) {
    const { h, r, rb } = d, L = [];
    L.push(cyl(r, rb, h, d.col, 0, 26), flatRing(r * 0.98, 0.05, d.acc, h / 2), cyl(rb * 1.03, rb * 1.03, 0.07, DARK, -h / 2 + 0.035, 26));
    L.push(...eyes(r * 0.85, h * 0.2, Math.max(0.1, r * 0.1)));
    return L;
  },
  // ---------------- fins
  flipper(d) {
    const { h, rr } = d, s = new THREE.Shape();
    s.moveTo(-rr / 2, -h / 2); s.quadraticCurveTo(rr * 0.2, -h * 0.7, rr * 0.55, -h * 0.1); s.quadraticCurveTo(rr * 0.6, h * 0.3, -rr / 2, h / 2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false }); g.translate(0, 0, -0.035);
    return [bake(g, d.col)];
  },
  sharkfin(d) {
    const { h, rr } = d, s = new THREE.Shape();
    s.moveTo(-rr / 2, -h / 2); s.quadraticCurveTo(rr * 0.1, -h * 0.05, rr / 2, h * 0.34); s.quadraticCurveTo(rr * 0.1, h * 0.18, -rr / 2, h / 2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }); g.translate(0, 0, -0.04);
    return [bake(g, d.col), box(rr * 0.5, 0.05, 0.1, 0xffffff, -rr * 0.1, -h * 0.05, 0, { rz: 0.5 })];
  },
  pizza(d) {
    const { h, rr } = d, s = new THREE.Shape();
    s.moveTo(-rr / 2, -h / 2); s.lineTo(rr / 2, 0); s.lineTo(-rr / 2, h / 2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false }); g.translate(0, 0, -0.035);
    const L = [bake(g, d.col), box(0.09, h, 0.1, 0xd08a3a, -rr / 2, 0, 0)];
    for (const [x, y, rad] of [[-0.15, 0.25, 0.16], [0.1, -0.2, 0.14], [-0.1, -0.1, 0.12], [0.3, 0.05, 0.09]]) for (const z of [0.045, -0.045]) L.push(cyl(rad * rr * 0.4, rad * rr * 0.4, 0.03, 0xd03a3a, 0, 12, { x: x * rr, y: y * h, z, rx: Math.PI / 2 }));
    return L;
  },
  // ---------------- umbrella (stowed), wheel, flag
  umbrella(d) {
    const { h, r } = d, L = [];
    L.push(...stripes(0.03, r, h * 0.9, -h / 2, [d.col, d.acc, 0xffffff], 6, 12), cyl(r * 0.5, r * 0.5, 0.06, 0x14122a, -h * 0.3, 10), ball(0.05, d.acc, 0, h / 2 + 0.03, 0));
    return L;
  },
  hamster(d) {
    const { h, r } = d, L = [];
    L.push(flatRing(r * 0.9, Math.max(0.05, h * 0.18), d.col, 0), cyl(r * 0.18, r * 0.18, h * 0.6, d.acc, 0, 12));
    for (let i = 0; i < 4; i++) L.push(box(r * 1.7, h * 0.1, 0.05, METAL, 0, 0, 0, { ry: i * Math.PI / 4 }));
    L.push(ball(r * 0.22, d.acc, r * 0.5, h * 0.2, r * 0.4), ball(r * 0.06, 0xffffff, r * 0.55, h * 0.3, r * 0.58), ball(r * 0.03, 0x14122a, r * 0.57, h * 0.3, r * 0.63));
    L.push(cyl(r * 0.95, r * 0.95, h * 0.08, 0xc8d0de, -h / 2 + h * 0.04, 24));
    return L;
  },
  flag(d) {
    const L = [];
    L.push(cyl(0.02, 0.02, d.h, METAL, 0, 6));
    L.push(box(0.42, 0.28, 0.015, d.col, 0.21, d.h * 0.32, 0), ball(0.07, d.acc, 0.2, d.h * 0.32, 0.01, 1, 1, 0.2));
    L.push(ball(0.016, 0x14122a, 0.17, d.h * 0.34, 0.02), ball(0.016, 0x14122a, 0.23, d.h * 0.34, 0.02));
    return L;
  },
};
const PIPCOL = 0xff7eb6;

// ---- materials, shared by everything
let TOON = null, OUT = {}, GLOW = {};
export function toonMaterial() {
  if (TOON) return TOON;
  const data = new Uint8Array([100, 100, 100, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat); tex.needsUpdate = true; tex.minFilter = tex.magFilter = THREE.NearestFilter;
  TOON = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tex });
  return TOON;
}
function outlineShader(thick, color) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { uThick: { value: thick }, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'uniform float uThick; void main(){ vec4 mv = modelViewMatrix * vec4(position + normal * uThick * (1.0 + 0.0018 * length((modelViewMatrix * vec4(position,1.0)).xyz)), 1.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }',
  });
}
export function outlineMaterial(thick) {
  const k = Math.round(thick * 1000);
  return OUT[k] || (OUT[k] = outlineShader(thick, 0x140e2a));
}
// a bright glowing outline for "this is the one you clicked" (and a softer one for "you are pointing at it")
export function glowMaterial(mode) {
  return GLOW[mode] || (GLOW[mode] = outlineShader(mode === 2 ? 0.085 : 0.05, mode === 2 ? 0xffe14a : 0x7af0ff));
}
export function setHighlight(obj, mode) {          // 0 = normal, 1 = pointing at it, 2 = selected
  obj.traverse((o) => { if (o.userData && o.userData.outline) o.userData.outline.material = mode ? glowMaterial(mode) : o.userData.outlineBase; });
}
export const litMaterial = () => new THREE.MeshLambertMaterial({ vertexColors: true });

const GEO_CACHE = {};
export function partGeometry(def) {
  if (GEO_CACHE[def.id]) return GEO_CACHE[def.id];
  const fn = SHAPES[def.shape] || SHAPES.soup;
  const geo = merge(fn(def));
  GEO_CACHE[def.id] = geo;
  return geo;
}

// A landing leg is built by hand so it can fold up
function legObject(def, outlines) {
  const g = new THREE.Group();
  const pivot = new THREE.Group(); g.add(pivot);
  const x0 = -def.rr / 2, y0 = def.h / 2, x1 = def.rr / 2, y1 = -def.h / 2 - def.drop;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), v = def.variant || 'spider';
  const list = [], thick = v === 'elephant' ? 0.1 : v === 'spider' ? 0.03 : 0.05;
  list.push(bake(new THREE.CylinderGeometry(thick * 0.7, thick, len, 8), v === 'elephant' ? 0x9aa5b8 : def.col, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rz: Math.atan2(dx, -dy) }));
  if (v === 'bunny') list.push(ball(0.26, 0xffd0e4, x1, y1 + 0.03, 0, 1.3, 0.55, 1.9), ball(0.07, 0xff7eb6, x1 + 0.12, y1 + 0.1, 0.12), ball(0.07, 0xff7eb6, x1 + 0.12, y1 + 0.1, -0.12));
  else if (v === 'elephant') list.push(cyl(0.4, 0.44, 0.24, 0x9aa5b8, y1 + 0.04, 16, { x: x1 }), ball(0.06, 0xffffff, x1 + 0.3, y1 + 0.08, 0.16), ball(0.06, 0xffffff, x1 + 0.34, y1 + 0.08, 0), ball(0.06, 0xffffff, x1 + 0.3, y1 + 0.08, -0.16));
  else list.push(ball(0.07, def.acc, x1, y1, 0), ball(0.09, def.acc, (x0 + x1) / 2, (y0 + y1) / 2 + 0.1, 0), cyl(0.012, 0.012, len * 0.6, def.col, (y0 + y1) / 2, 6, { x: (x0 + x1) / 2, z: 0.1, rz: Math.atan2(dx, -dy) }));
  list.push(box(0.12, 0.12, 0.1, METAL, x0 + 0.03, y0, 0));
  const geo = merge(list);
  const mesh = new THREE.Mesh(geo, toonMaterial()); pivot.add(mesh);
  mesh.position.set(-x0, -y0, 0);
  if (outlines) { const o = new THREE.Mesh(geo, outlineMaterial(0.025)); pivot.add(o); o.position.set(-x0, -y0, 0); o.userData.outline = o; o.userData.outlineBase = o.material; }
  pivot.position.set(x0, y0, 0);
  g.userData.pivot = pivot;
  g.userData.angle = Math.atan2(dx, -dy);
  return g;
}

// Build the 3D object for one part, centred on the part's middle.
export function makePart(def, opts = {}) {
  const outlines = opts.outlines !== false;
  if (def.shape === 'leg') return legObject(def, outlines);
  const geo = partGeometry(def);
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geo, opts.lit ? litMaterial() : toonMaterial());
  g.add(mesh);
  if (outlines) {
    const base = outlineMaterial(def.size === 'X' ? 0.045 : def.size === 'L' ? 0.032 : 0.022), o = new THREE.Mesh(geo, base);
    o.userData.outline = o; o.userData.outlineBase = base; g.add(o);
  }
  return g;
}

// The umbrella canopy: a rainbow dome that grows when the umbrella opens
let CANOPY = null;
export function canopyGeometry() {
  if (CANOPY) return CANOPY;
  const g = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
  const n = g.attributes.position.count, col = new Float32Array(n * 3), p = g.attributes.position, tmp = new THREE.Color();
  for (let i = 0; i < n; i++) { const ang = Math.atan2(p.getZ(i), p.getX(i)), k = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 8) % 8; tmp.setHex(RAINBOW[k]); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv');
  CANOPY = g; return g;
}
export function makeCanopy(outlines) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(canopyGeometry(), new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: toonMaterial().gradientMap }));
  g.add(m);
  if (outlines) { const o = new THREE.Mesh(canopyGeometry(), outlineMaterial(0.01)); g.add(o); }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfff4e6 }));
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pts.push(Math.cos(a), 0, Math.sin(a), 0, -1, 0); }
  lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(lines);
  g.userData.lines = lines;
  return g;
}

export { bake, cyl, box, ball, dome };
