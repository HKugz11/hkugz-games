// KART RUSH - tracks: closed loops made from smooth curves, sampled every ~3 m. Everything about a kart's place on the track (how far along,
// how far from the middle, how high) comes from these samples, so walls, off-road and laps need no general collision at all.
import { THREE, V3, scene, toon, rng, TAU, clamp, lerp, QL, disposeObj, W } from './core.js?v=2';

export const TRACKS = [
  { id: 'sunny', name: 'Sunny Loop', blurb: 'Wide, friendly curves through green hills. A good first race.', seed: 11, R0: 290, sx: 1.28, sz: .95, width: 12, harm: [[2, 52, .4], [3, 36, 1.7], [5, 15, 2.5]], hills: [[1, 4.5, .5], [2, 2.5, 1.8]], decor: 'trees',
    theme: { sky: [0x3a9bff, 0x9fdcff, 0xfff2dc], fog: [0xcfeaff, 140, 760], hemi: [0xd8eeff, 0x8fb070, 1.1], sun: [0xfff1d0, 2.3], ground: 0x6fcf6a, shoulder: 0x7ae070, wallA: 0xff6a5a, wallB: 0xffffff, kerbA: 0xff4a4a, kerbB: 0xffffff, road: 0x55556a, swatch: ['#3a9bff', '#9fdcff', '#6fcf6a'] } },
  { id: 'neon', name: 'Neon City', blurb: 'A night-time circuit between glowing towers, with a few sharp turns.', seed: 23, R0: 300, sx: 1.05, sz: 1.0, width: 11, harm: [[2, 48, 2.2], [3, 44, .3], [4, 24, 1.0], [7, 9, .5]], hills: [[3, 3, .2], [1, 3, 2]], decor: 'city', boosts: 7,
    theme: { sky: [0x0a0630, 0x3a1280, 0xff4fa8], fog: [0x2a1060, 90, 640], hemi: [0x9a8aff, 0x2a2060, .95], sun: [0xb0a0ff, 1.3], stars: .6, ground: 0x1a1040, shoulder: 0x2c2468, wallA: 0x2ee6ff, wallB: 0xff4fa8, kerbA: 0x2ee6ff, kerbB: 0xff4fa8, road: 0x2e2e48, swatch: ['#0a0630', '#3a1280', '#ff4fa8'] } },
  { id: 'frost', name: 'Frosty Peaks', blurb: 'Winding mountain roads with slippery ice patches. Watch your drifts.', seed: 37, R0: 310, sx: 1.12, sz: 1.0, width: 11.5, harm: [[2, 44, 1.0], [3, 56, 2.7], [5, 24, .2], [6, 11, 2.0]], hills: [[1, 8, .9], [2, 6, .3], [4, 3, 2]], decor: 'pines', ice: [[.18, .26], [.5, .58], [.8, .87]],
    theme: { sky: [0x6aa8ff, 0xc6e6ff, 0xffffff], fog: [0xe2f0fa, 110, 700], hemi: [0xe6f4ff, 0x9ab8d8, 1.1], sun: [0xffffff, 2.0], ground: 0xeef6ff, shoulder: 0xffffff, wallA: 0x7cc8ff, wallB: 0xffffff, kerbA: 0x4a8aff, kerbB: 0xffffff, road: 0x6a7288, swatch: ['#6aa8ff', '#c6e6ff', '#ffffff'] } },
];
export const SHOULDER = 6;   // grass beside the kerb before the wall
export const KERB = 1.6;

// ---------------------------------------------------------------- sampling
export function sampleTrack(def) {
  const M = 4000, raw = [], twy = th => { let y = 0; for (const [k, a, ph] of def.hills) y += a * Math.sin(k * th + ph); return y; };
  for (let i = 0; i < M; i++) { const th = i / M * TAU; let r = def.R0; for (const [k, a, ph] of def.harm) r += a * Math.sin(k * th + ph); raw.push([r * Math.cos(th) * def.sx, twy(th), r * Math.sin(th) * def.sz]); }
  let total = 0; const cum = [0]; for (let i = 0; i < M; i++) { const a = raw[i], b = raw[(i + 1) % M]; total += Math.hypot(b[0] - a[0], b[2] - a[2]); cum.push(total); }
  const N = Math.round(total / 3), ds = total / N, x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N); let j = 0;
  for (let i = 0; i < N; i++) { const target = i * ds; while (cum[j + 1] < target) j++; const f = (target - cum[j]) / (cum[j + 1] - cum[j]), a = raw[j], b = raw[(j + 1) % M]; x[i] = lerp(a[0], b[0], f); y[i] = lerp(a[1], b[1], f); z[i] = lerp(a[2], b[2], f); }
  const tx = new Float32Array(N), tz = new Float32Array(N), rx = new Float32Array(N), rz = new Float32Array(N), s = new Float32Array(N), kappa = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = (i + N - 1) % N, b = (i + 1) % N; let dx = x[b] - x[a], dz = z[b] - z[a]; const m = Math.hypot(dx, dz); tx[i] = dx / m; tz[i] = dz / m; rx[i] = tz[i]; rz[i] = -tx[i]; s[i] = i * ds; }
  for (let i = 0; i < N; i++) { const a = (i + N - 3) % N, b = (i + 3) % N, cr = tx[a] * tz[b] - tz[a] * tx[b]; kappa[i] = Math.asin(clamp(-cr, -1, 1)) / (6 * ds); }   // + = turning right
  let minR = 1e9; for (let i = 0; i < N; i++) if (Math.abs(kappa[i]) > 1e-5) minR = Math.min(minR, 1 / Math.abs(kappa[i]));
  let minY = 1e9, maxY = -1e9; for (let i = 0; i < N; i++) { minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]); }
  return { def, N, ds, length: total, x, y, z, tx, tz, rx, rz, s, kappa, width: def.width, minR, minY, maxY, groundY: minY - 1.2 };
}
const _o = { i: 0, f: 0, s: 0, d: 0, y: 0, tx: 0, tz: 0, rx: 0, rz: 0, x: 0, z: 0 };
// where on the track is this point? hint = a sample index near it (or -1 to search everywhere). Fills and returns `out`.
export function nearest(tr, px, pz, hint, out = _o) {
  const N = tr.N, full = hint < 0, span = full ? N : 44, start = full ? 0 : hint - 22; let bi = 0, bd = 1e18;
  for (let k = 0; k < span; k++) { let i = (start + k) % N; if (i < 0) i += N; const dx = px - tr.x[i], dz = pz - tr.z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
  let best = 1e18, bj = bi, bt = 0;
  for (const j of [(bi + N - 1) % N, bi]) { const k = (j + 1) % N, ex = tr.x[k] - tr.x[j], ez = tr.z[k] - tr.z[j], l2 = ex * ex + ez * ez, t = clamp(((px - tr.x[j]) * ex + (pz - tr.z[j]) * ez) / l2, 0, 1), cx = tr.x[j] + ex * t, cz = tr.z[j] + ez * t, d = (px - cx) ** 2 + (pz - cz) ** 2; if (d < best) { best = d; bj = j; bt = t; } }
  const k = (bj + 1) % N, tx = lerp(tr.tx[bj], tr.tx[k], bt), tz = lerp(tr.tz[bj], tr.tz[k], bt), m = Math.hypot(tx, tz) || 1;
  out.i = bj; out.f = bt; out.s = (tr.s[bj] + bt * tr.ds) % tr.length; out.y = lerp(tr.y[bj], tr.y[k], bt); out.tx = tx / m; out.tz = tz / m; out.rx = out.tz; out.rz = -out.tx;
  const cx = lerp(tr.x[bj], tr.x[k], bt), cz = lerp(tr.z[bj], tr.z[k], bt); out.x = cx; out.z = cz; out.d = (px - cx) * out.rx + (pz - cz) * out.rz; return out;
}
// a point at distance s along the track, lat to the right of the middle
export function pointAt(tr, s, lat = 0, out = { x: 0, y: 0, z: 0, tx: 0, tz: 0, kappa: 0 }) {
  s = ((s % tr.length) + tr.length) % tr.length; const f = s / tr.ds, i = Math.floor(f) % tr.N, k = (i + 1) % tr.N, t = f - Math.floor(f);
  const tx = lerp(tr.tx[i], tr.tx[k], t), tz = lerp(tr.tz[i], tr.tz[k], t), m = Math.hypot(tx, tz) || 1; out.tx = tx / m; out.tz = tz / m;
  out.x = lerp(tr.x[i], tr.x[k], t) + out.tz * lat; out.z = lerp(tr.z[i], tr.z[k], t) - out.tx * lat; out.y = lerp(tr.y[i], tr.y[k], t); out.kappa = lerp(tr.kappa[i], tr.kappa[k], t); return out;
}

// ---------------------------------------------------------------- textures
const cvTex = (w, h, draw, rep = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const hexs = c => '#' + c.toString(16).padStart(6, '0');
function roadTex(th) { return cvTex(256, 256, (x, w, h) => { x.fillStyle = hexs(th.road); x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},.03)`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(w * .03, 0, w * .02, h); x.fillRect(w * .95, 0, w * .02, h); x.fillStyle = 'rgba(255,214,90,.8)'; x.fillRect(w * .49, 0, w * .02, h * .5); }); }
function kerbTex(th) { return cvTex(32, 64, (x, w, h) => { x.fillStyle = hexs(th.kerbA); x.fillRect(0, 0, w, h / 2); x.fillStyle = hexs(th.kerbB); x.fillRect(0, h / 2, w, h / 2); }); }
const checkTex = () => cvTex(64, 16, (x, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 8, j * 8, 8, 8); } });
const chevTex = () => cvTex(64, 64, (x, w, h) => { x.fillStyle = '#12306a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6affe0'; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(14, 46); x.lineTo(32, 18); x.lineTo(50, 46); x.stroke(); });
export const qTex = () => cvTex(64, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ff8ad0'); g.addColorStop(.5, '#8ad0ff'); g.addColorStop(1, '#ffe08a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '900 52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6; x.strokeText('?', 32, 36); x.fillText('?', 32, 36); }, false);

// ---------------------------------------------------------------- the meshes
function ribbon(tr, off0, off1, dy, uvv, mat, opts = {}) {
  const N = tr.N, pos = [], uv = [], idx = [], col = [];
  for (let i = 0; i <= N; i++) { const k = i % N, w0 = off0, w1 = off1, y = tr.y[k] + dy; pos.push(tr.x[k] + tr.rx[k] * w0, y, tr.z[k] + tr.rz[k] * w0, tr.x[k] + tr.rx[k] * w1, y, tr.z[k] + tr.rz[k] * w1); uv.push(0, i * tr.ds / uvv, 1, i * tr.ds / uvv); if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = QL.shadow > 0; return m;
}
function wallMesh(tr, off, height, th, side) {   // a wall strip with alternating colors (vertex colors)
  const N = tr.N, pos = [], col = [], idx = [], A = new THREE.Color(th.wallA), B = new THREE.Color(th.wallB);
  for (let i = 0; i <= N; i++) { const k = i % N, o = off * side, y = tr.y[k], c = (Math.floor(i * tr.ds / 8) % 2) ? A : B; pos.push(tr.x[k] + tr.rx[k] * o, y - .2, tr.z[k] + tr.rz[k] * o, tr.x[k] + tr.rx[k] * o, y + height, tr.z[k] + tr.rz[k] * o); col.push(c.r, c.g, c.b, c.r, c.g, c.b); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide })); m.castShadow = QL.shadow > 0; return m;
}
function mergeColored(list) {
  const pos = [], nor = [], col = [];
  for (const [geo, color] of list) { const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return out;
}
const T3 = (g, x, y, z) => g.translate(x, y, z);

export class Track {
  constructor(def) {
    this.def = def; this.tr = sampleTrack(def); const tr = this.tr, th = def.theme; this.group = new THREE.Group(); scene.add(this.group); this.anim = []; this.boxes = []; this.pads = []; this.iceZones = [];
    const R = rng(def.seed * 13 + 5);
    // road, kerbs, grass shoulder, walls, embankment
    const road = ribbon(tr, -tr.width, tr.width, .02, 18, new THREE.MeshToonMaterial({ map: roadTex(th), gradientMap: toon(0).gradientMap })); this.group.add(road);
    const kt = kerbTex(th), km = new THREE.MeshToonMaterial({ map: kt, gradientMap: toon(0).gradientMap }); for (const sd of [-1, 1]) { const a = sd < 0 ? -tr.width - KERB : tr.width, b = sd < 0 ? -tr.width : tr.width + KERB; const k = ribbon(tr, a, b, .04, 3, km); this.group.add(k); }
    const sm = toon(th.shoulder); for (const sd of [-1, 1]) { const a = sd < 0 ? -tr.width - SHOULDER : tr.width + KERB, b = sd < 0 ? -tr.width - KERB : tr.width + SHOULDER; this.group.add(ribbon(tr, a, b, .0, 10, sm)); }
    for (const sd of [-1, 1]) this.group.add(wallMesh(tr, tr.width + SHOULDER + .3, 1.5, th, sd));
    const emb = toon(th.ground, { side: THREE.DoubleSide }); for (const sd of [-1, 1]) { const mesh = ribbon(tr, 0, 1, 0, 10, emb); const pos = mesh.geometry.attributes.position, N = tr.N; for (let i = 0; i <= N; i++) { const k = i % N, inner = (tr.width + SHOULDER + .6) * sd, outer = (tr.width + SHOULDER + 26) * sd; pos.setXYZ(i * 2, tr.x[k] + tr.rx[k] * inner, tr.y[k] - .1, tr.z[k] + tr.rz[k] * inner); pos.setXYZ(i * 2 + 1, tr.x[k] + tr.rx[k] * outer, tr.groundY, tr.z[k] + tr.rz[k] * outer); } pos.needsUpdate = true; mesh.geometry.computeVertexNormals(); this.group.add(mesh); }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2200, 32), toon(th.ground)); ground.rotation.x = -Math.PI / 2; ground.position.y = tr.groundY; ground.receiveShadow = QL.shadow > 0; this.group.add(ground);
    // ice patches (a light overlay on the road that also lowers grip)
    if (def.ice) for (const [a, b] of def.ice) { const s0 = a * tr.length, s1 = b * tr.length; this.iceZones.push([s0, s1]); const n0 = Math.floor(s0 / tr.ds), n1 = Math.floor(s1 / tr.ds), pos = [], idx = []; for (let i = n0; i <= n1; i++) { const k = i % tr.N, y = tr.y[k] + .06, w = tr.width * .96; pos.push(tr.x[k] - tr.rx[k] * w, y, tr.z[k] - tr.rz[k] * w, tr.x[k] + tr.rx[k] * w, y, tr.z[k] + tr.rz[k] * w); if (i < n1) { const q = (i - n0) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); this.group.add(m); }
    this.tr.isIcePt = s => this.isIce(s); this.buildStart(); this.buildPads(R); this.buildBoxes(R); this.buildDecor(R);
    this.mini = this.minimapPath();
  }
  isIce(s) { for (const [a, b] of this.iceZones) if (s >= a && s <= b) return true; return false; }
  buildStart() {
    const tr = this.tr, p = pointAt(tr, 0), g = new THREE.Group(), ct = checkTex(); ct.repeat.set(1, 1);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(tr.width * 2, 3), new THREE.MeshBasicMaterial({ map: ct, polygonOffset: true, polygonOffsetFactor: -3 })); line.rotation.order = 'YXZ'; line.rotation.x = -Math.PI / 2; line.rotation.y = Math.atan2(p.tx, p.tz); line.position.y = .08; g.add(line);
    const pm = toon(0xffffff), ym = toon(0xffd34e);
    for (const sd of [-1, 1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 12, 10), pm); pl.position.set(sd * (tr.width + 2.5) * p.tz, 6, -sd * (tr.width + 2.5) * p.tx); g.add(pl); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(tr.width * 2 + 7, 2.8, 1.2), new THREE.MeshToonMaterial({ map: (() => { const t = checkTex(); t.repeat.set(5, 1); return t; })(), gradientMap: toon(0).gradientMap })); beam.position.y = 11.5; beam.rotation.y = Math.atan2(p.tx, p.tz); g.add(beam);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(tr.width * 2 + 6, .5, .5), ym); lamp.position.y = 10; lamp.rotation.y = beam.rotation.y; g.add(lamp);
    g.position.set(p.x, p.y, p.z); this.group.add(g); this.startPoint = p;
  }
  buildPads(R) {
    const tr = this.tr, ct = chevTex(), count = this.def.boosts || 6; ct.repeat.set(1, 1); this.padTex = ct; const list = [];
    for (let i = 0; i < count; i++) { let s = (i + .5) / count * tr.length + R() * 40 - 20; list.push([s, (R() < .5 ? -1 : 1) * R() * (tr.width * .45)]); }
    for (const [s, lat] of list) { const p = pointAt(tr, s, lat), m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 9), new THREE.MeshBasicMaterial({ map: ct, polygonOffset: true, polygonOffsetFactor: -3 })); m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; m.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI; m.position.set(p.x, p.y + .09, p.z); this.group.add(m); this.pads.push({ s, lat, x: p.x, y: p.y, z: p.z }); }
  }
  buildBoxes(R) {
    const tr = this.tr, tex = qTex(), mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .92 }), geo = new THREE.BoxGeometry(1.7, 1.7, 1.7), spots = 7; this.boxMat = mat;
    for (let i = 0; i < spots; i++) { const s = ((i + .15) / spots + .02) * tr.length; for (const lat of [-tr.width * .62, -tr.width * .21, tr.width * .21, tr.width * .62]) { const p = pointAt(tr, s, lat), m = new THREE.Mesh(geo, mat); m.position.set(p.x, p.y + 1.6, p.z); this.group.add(m); this.boxes.push({ m, x: p.x, y: p.y + 1.6, z: p.z, s, lat, cd: 0 }); } }
  }
  buildDecor(R) {
    const tr = this.tr, th = this.def.theme, kind = this.def.decor, far = tr.width + SHOULDER + 24; const spots = [];
    const free = (x, z) => { const q = nearest(tr, x, z, -1); return Math.abs(q.d) > far - 6 || false; };
    const n = QL.clouds * 4;   // scenery count scales with quality
    for (let t = 0; t < n * 8 && spots.length < n; t++) { const s = R() * tr.length, side = R() < .5 ? -1 : 1, off = far + R() * 90, p = pointAt(tr, s, side * off); const q = nearest(tr, p.x, p.z, -1); if (Math.abs(q.d) < far - 4) continue; spots.push([p.x, p.z, R()]); }
    const gy = tr.groundY;
    if (kind === 'trees' || kind === 'pines') {
      const pine = kind === 'pines', geo = mergeColored([[T3(new THREE.CylinderGeometry(.5, .7, 5, 7), 0, 2.5, 0), 0x8a5a2a], ...(pine ? [[T3(new THREE.ConeGeometry(4, 6, 8), 0, 7, 0), 0x2f8f5a], [T3(new THREE.ConeGeometry(3, 5, 8), 0, 10.5, 0), 0x3aa86a], [T3(new THREE.ConeGeometry(2, 4, 8), 0, 13.5, 0), 0xffffff]] : [[T3(new THREE.IcosahedronGeometry(4, 1), 0, 8, 0), 0x3fbf5a], [T3(new THREE.IcosahedronGeometry(3, 1), 1.5, 11, 1), 0x58d070]])]);
      const im = new THREE.InstancedMesh(geo, toon(0xffffff, { vertexColors: true }), spots.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new V3(), sc = new V3();
      spots.forEach(([x, z, r], i) => { const s = .8 + r * 1.0; pos.set(x, gy, z); sc.set(s, s, s); q.setFromAxisAngle(new V3(0, 1, 0), r * 6); M.compose(pos, q, sc); im.setMatrixAt(i, M); }); im.frustumCulled = false; im.castShadow = false; this.group.add(im);
    } else {   // city: towers with lit windows
      const wt = cvTex(64, 128, (x, w, h) => { x.fillStyle = '#1b1744'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) for (let j = 0; j < 14; j++) { if (Math.random() < .55) { x.fillStyle = ['#ffd34e', '#2ee6ff', '#ff4fa8', '#fff'][Math.floor(Math.random() * 4)]; x.fillRect(4 + i * 10, 4 + j * 9, 6, 5); } } });
      const variants = [[14, 60, 14], [18, 90, 18], [12, 120, 12], [22, 50, 16], [16, 150, 16]]; variants.forEach(([sx, sy, sz], vi) => {
        const g = new THREE.BoxGeometry(sx, sy, sz); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx / 14, uv.getY(i) * sy / 28); const mine = spots.filter((_, i) => i % variants.length === vi);
        const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: wt, fog: true }), mine.length), M = new THREE.Matrix4(); mine.forEach(([x, z], i) => { M.makeTranslation(x, gy + sy / 2, z); im.setMatrixAt(i, M); }); im.frustumCulled = false; this.group.add(im);
      });
    }
  }
  minimapPath() { const tr = this.tr, pts = []; for (let i = 0; i < tr.N; i += 4) pts.push([tr.x[i], tr.z[i]]); return pts; }
  update(dt, t) {
    for (const b of this.boxes) { b.m.rotation.y += dt * 1.8; b.m.rotation.x = Math.sin(t * 2 + b.s) * .25; b.m.position.y = b.y + Math.sin(t * 3 + b.lat) * .18; if (b.cd > 0) { b.cd -= dt; b.m.visible = b.cd <= 0; } }
    if (this.padTex) this.padTex.offset.y -= dt * 1.2;
  }
  dispose() { scene.remove(this.group); disposeObj(this.group); }
}
