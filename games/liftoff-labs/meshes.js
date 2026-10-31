// 3D models for every part: chunky, bright, outlined shapes made from simple solids (no model files).
import * as THREE from './three.module.min.js';

const TANK_COL = { S: 0xff8a3d, L: 0x34c3cf, X: 0x9a78ff };
const WHITE = 0xf3f5fb, DARK = 0x3a3d4a, METAL = 0x8d95a8, GLASS = 0xbdeeff;

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

// ---- one function per kind of part. They return a list of coloured solids around the part's centre.
const SHAPES = {
  pod(d) {
    const { h, r, rb } = d, L = [];
    const top = h / 2, w = (y) => rb + (r - rb) * ((y + top) / h);
    L.push(cyl(r, rb, h * 0.86, d.col, -h * 0.07, 24));
    L.push(cyl(r * 0.62, r * 0.7, h * 0.16, METAL, top - h * 0.08, 18));
    L.push(cyl(w(0) + 0.015, w(0) + 0.015, h * 0.07, d.acc, h * 0.12, 24));
    L.push(cyl(rb * 1.01, rb * 1.01, 0.06, DARK, -top + 0.03, 24));
    const wy = h * 0.2, wz = w(wy) * 0.78;
    L.push(ball(h * 0.22, GLASS, 0, wy, wz, 1, 1.15, 0.55));
    // a Pip looks out of the window
    L.push(ball(h * 0.115, d.acc, 0, wy - 0.02, wz - 0.03, 1, 1, 0.7));
    L.push(ball(h * 0.02, 0x14122a, -h * 0.045, wy + 0.01, wz + 0.04));
    L.push(ball(h * 0.02, 0x14122a, h * 0.045, wy + 0.01, wz + 0.04));
    return L;
  },
  probe(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 24));
    L.push(cyl(r * 1.02, r * 1.02, h * 0.22, d.acc, 0, 24));
    L.push(cyl(r * 0.5, r * 0.62, h * 0.18, METAL, h / 2 + h * 0.08, 18));
    L.push(ball(h * 0.17, GLASS, 0, 0.02, r * 0.97, 1, 1, 0.45));
    L.push(ball(h * 0.05, 0x14122a, 0, 0.02, r * 0.97 + h * 0.06));
    L.push(bake(new THREE.ConeGeometry(r * 0.28, r * 0.16, 14, 1, true), METAL, { x: r * 0.5, y: h / 2 + 0.14, rz: -0.5 }));
    L.push(cyl(0.015, 0.015, h * 1.1, METAL, h / 2 + h * 0.5, 6, { x: -r * 0.45 }));
    return L;
  },
  tank(d) {
    const { h, r } = d, L = [], col = TANK_COL[d.size] || TANK_COL.S;
    L.push(cyl(r, r, h, col, 0, 26));
    L.push(cyl(r * 1.015, r * 1.015, Math.min(0.1, h * 0.12), WHITE, h / 2 - 0.05 - Math.min(0.1, h * 0.12) * 0.5, 26));
    L.push(cyl(r * 1.015, r * 1.015, Math.min(0.1, h * 0.12), WHITE, -h / 2 + 0.05 + Math.min(0.1, h * 0.12) * 0.5, 26));
    const bands = Math.max(0, Math.floor(h / 2.4));
    for (let i = 1; i <= bands; i++) L.push(cyl(r * 1.012, r * 1.012, 0.12, WHITE, -h / 2 + (h * i) / (bands + 1), 26));
    L.push(cyl(r * 0.99, r * 0.99, 0.03, DARK, h / 2 - 0.015, 26));
    L.push(cyl(r * 0.99, r * 0.99, 0.03, DARK, -h / 2 + 0.015, 26));
    return L;
  },
  rtank(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h * 0.8, TANK_COL.S, 0, 14));
    L.push(bake(new THREE.ConeGeometry(r, h * 0.2, 14), 0xff5a5a, { y: h * 0.4 + h * 0.1 - 0.0 }));
    L.push(bake(new THREE.ConeGeometry(r * 0.7, h * 0.12, 14), METAL, { y: -h * 0.4 - h * 0.04, rx: Math.PI }));
    L.push(cyl(r * 1.03, r * 1.03, 0.07, WHITE, 0, 14));
    return L;
  },
  engine(d) {
    const { h, r } = d, L = [];
    const cluster = d.F > 1.4e6 ? 4 : d.F > 5e5 && d.size === 'X' ? 3 : 1;
    L.push(cyl(r * 0.98, r * 0.98, h * 0.26, d.acc, h / 2 - h * 0.13, 22));
    L.push(cyl(r * 1.0, r * 1.0, 0.05, DARK, h / 2 - h * 0.26, 22));
    if (cluster === 1) {
      L.push(cyl(r * 0.45, r * 0.82, h * 0.62, METAL, -h * 0.09, 22));
      L.push(cyl(r * 0.5, r * 0.5, h * 0.12, DARK, h / 2 - h * 0.31, 16));
      L.push(cyl(r * 0.85, r * 0.85, 0.05, DARK, -h / 2 + 0.025, 22));
      L.push(cyl(r * 0.7, r * 0.7, 0.02, 0x15141f, -h / 2 + 0.05, 22));
    } else {
      const k = cluster === 4 ? 0.5 : 0.52, rr = cluster === 4 ? r * 0.5 : r * 0.55;
      for (let i = 0; i < cluster; i++) {
        const a = (i / cluster) * Math.PI * 2 + (cluster === 3 ? Math.PI / 2 : Math.PI / 4), x = Math.cos(a) * r * k, z = Math.sin(a) * r * k;
        L.push(cyl(rr * 0.5, rr * 0.82, h * 0.6, METAL, -h * 0.1, 16, { x, z }));
        L.push(cyl(rr * 0.85, rr * 0.85, 0.04, DARK, -h * 0.4, 16, { x, z }));
      }
    }
    // pipes and pumps so it looks like an engine, not a stool
    if (cluster === 1) for (const sx of [-1, 1]) {
      L.push(cyl(r * 0.13, r * 0.13, h * 0.34, 0xb9c0d2, h / 2 - h * 0.42, 8, { x: sx * r * 0.55 }));
      L.push(cyl(r * 0.2, r * 0.2, h * 0.1, DARK, h / 2 - h * 0.28, 10, { x: sx * r * 0.55 }));
    }
    if (d.radial) L.push(bake(new THREE.SphereGeometry(r * 0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), d.acc, { y: h / 2 - h * 0.26 }));
    return L;
  },
  srb(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h - 0.4, d.col, 0.06, 20));
    L.push(dome(r, d.col, (h - 0.4) / 2 + 0.06, 0.7));
    L.push(cyl(r * 1.02, r * 1.02, 0.12, d.acc, 0.06 + (h - 0.4) * 0.3, 20));
    L.push(cyl(r * 1.02, r * 1.02, 0.12, d.acc, 0.06 - (h - 0.4) * 0.3, 20));
    L.push(cyl(r * 0.42, r * 0.8, 0.36, DARK, -h / 2 + 0.2, 18));
    L.push(cyl(r * 0.85, r * 0.85, 0.05, METAL, -h / 2 + 0.38, 18));
    return L;
  },
  ring(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 24));
    L.push(cyl(r * 1.015, r * 1.015, h * 0.3, DARK, 0, 24));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; L.push(box(r * 0.2, h * 0.9, 0.04, DARK, Math.cos(a) * r, 0, Math.sin(a) * r, { ry: -a })); }
    return L;
  },
  sidering(d) {
    const { h, rr } = d, L = [];
    L.push(box(rr, h, 0.26, d.col, 0, 0, 0));
    L.push(box(rr * 0.5, h * 0.4, 0.28, DARK, 0, 0, 0));
    return L;
  },
  nose(d) {
    const { h, r } = d, L = [], pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.max(0.002, r * Math.pow(1 - t, 0.85)), t * h)); }
    L.push(bake(new THREE.LatheGeometry(pts, 22), d.col, { y: -h / 2 }));
    L.push(cyl(r * 0.995, r * 0.995, 0.08, WHITE, -h / 2 + h * 0.22, 22));
    L.push(cyl(r * 0.97, r * 0.97, 0.03, DARK, -h / 2 + 0.015, 22));
    return L;
  },
  dome(d) {
    const { h, r } = d, L = [];
    L.push(dome(r, d.col, -h / 2, h / r));
    L.push(cyl(r * 0.995, r * 0.995, 0.06, DARK, -h / 2 + 0.03, 22));
    return L;
  },
  adapter(d) {
    const { h, r, rb } = d, L = [];
    L.push(cyl(r, rb, h, d.col, 0, 24));
    L.push(cyl(r * 1.02, r * 1.02, 0.06, DARK, h / 2 - 0.03, 24));
    L.push(cyl(rb * 1.02, rb * 1.02, 0.06, DARK, -h / 2 + 0.03, 24));
    L.push(cyl((r + rb) / 2 * 1.018, (r + rb) / 2 * 1.018, 0.1, TANK_COL[d.size] || 0xffd23a, 0, 24));
    return L;
  },
  fin(d) {
    const { h, rr } = d, s = new THREE.Shape();
    s.moveTo(-rr / 2, -h / 2); s.lineTo(rr / 2, -h / 2 + h * 0.18); s.lineTo(rr / 2, -h / 2 + h * 0.5); s.lineTo(-rr / 2, h / 2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false });
    g.translate(0, 0, -0.035);
    return [bake(g, d.col)];
  },
  chute(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h * 0.8, d.col, -h * 0.1, 18));
    L.push(dome(r, d.col, h * 0.3, 0.5));
    L.push(cyl(r * 1.02, r * 1.02, h * 0.18, d.acc, -h * 0.1, 18));
    return L;
  },
  wheel(d) {
    const { h, r } = d, L = [];
    L.push(cyl(r, r, h, d.col, 0, 28));
    L.push(cyl(r * 0.7, r * 0.7, h + 0.03, d.acc, 0, 28));
    L.push(cyl(r * 0.25, r * 0.25, h + 0.06, DARK, 0, 12));
    return L;
  },
  flag(d) {
    const L = [];
    L.push(cyl(0.02, 0.02, d.h, METAL, 0, 6));
    L.push(box(0.4, 0.26, 0.015, d.col, 0.2, d.h * 0.32, 0));
    return L;
  },
};

// ---- materials, shared by everything
let TOON = null, OUT = {};
export function toonMaterial() {
  if (TOON) return TOON;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat); tex.needsUpdate = true; tex.minFilter = tex.magFilter = THREE.NearestFilter;
  TOON = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tex });
  return TOON;
}
export function outlineMaterial(thick) {
  const k = Math.round(thick * 1000);
  if (OUT[k]) return OUT[k];
  OUT[k] = new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { uThick: { value: thick } },
    vertexShader: 'uniform float uThick; void main(){ vec4 mv = modelViewMatrix * vec4(position + normal * uThick * (1.0 + 0.0018 * length((modelViewMatrix * vec4(position,1.0)).xyz)), 1.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.06, 0.04, 0.14, 1.0); }',
  });
  return OUT[k];
}
export const litMaterial = () => new THREE.MeshLambertMaterial({ vertexColors: true });

const GEO_CACHE = {};
export function partGeometry(def) {
  if (GEO_CACHE[def.id]) return GEO_CACHE[def.id];
  const fn = SHAPES[def.shape] || SHAPES.tank;
  const geo = merge(fn(def));
  GEO_CACHE[def.id] = geo;
  return geo;
}

// A landing leg is built by hand so it can fold up
function legObject(def, outlines) {
  const g = new THREE.Group();
  const pivot = new THREE.Group(); g.add(pivot);
  const x0 = -def.rr / 2, y0 = def.h / 2, x1 = def.rr / 2, y1 = -def.h / 2 - def.drop;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const list = [];
  list.push(bake(new THREE.CylinderGeometry(0.035, 0.05, len, 8), def.col, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rz: Math.atan2(dx, -dy) }));
  list.push(bake(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), def.acc, { x: x1, y: y1 - 0.02 }));
  list.push(bake(new THREE.BoxGeometry(0.12, 0.12, 0.1), METAL, { x: x0 + 0.03, y: y0 }));
  const geo = merge(list);
  const mesh = new THREE.Mesh(geo, toonMaterial()); pivot.add(mesh);
  if (outlines) pivot.add(new THREE.Mesh(geo, outlineMaterial(0.025)));
  pivot.position.set(x0, y0, 0);
  mesh.position.set(-x0, -y0, 0);
  if (outlines) pivot.children[1].position.set(-x0, -y0, 0);
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
  if (outlines) g.add(new THREE.Mesh(geo, outlineMaterial(def.size === 'X' ? 0.045 : def.size === 'L' ? 0.032 : 0.022)));
  return g;
}

// The parachute canopy: a striped dome that grows when the chute opens
let CANOPY = null;
export function canopyGeometry() {
  if (CANOPY) return CANOPY;
  const g = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
  const n = g.attributes.position.count, col = new Float32Array(n * 3), a = new THREE.Color(0xff8a3d), b = new THREE.Color(0xfff4e6), p = g.attributes.position;
  for (let i = 0; i < n; i++) { const ang = Math.atan2(p.getZ(i), p.getX(i)), k = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 12) % 2 ? a : b; col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b; }
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

export { TANK_COL };
export { bake, cyl, box, ball, dome };
