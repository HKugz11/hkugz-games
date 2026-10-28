// KART RUSH - tracks: closed loops made from smooth curves, sampled every ~3 m. Everything about a kart's place on the track (how far along,
// how far from the middle, how high) comes from these samples, so walls, off-road and laps need no general collision at all.
import { THREE, V3, scene, toon, rng, TAU, clamp, lerp, QL, disposeObj, W } from './core.js?v=3';

export const TRACKS = [
  { id: 'sunny', name: 'Sunny Loop', blurb: 'Wide, friendly curves through green hills. A good first race.', seed: 11, R0: 290, sx: 1.28, sz: .95, width: 12, harm: [[2, 52, .4], [3, 36, 1.7], [5, 15, 2.5]], hills: [[1, 4.5, .5], [2, 2.5, 1.8]], decor: 'trees',
    theme: { sky: [0x3a9bff, 0x9fdcff, 0xfff2dc], fog: [0xcfeaff, 140, 760], hemi: [0xd8eeff, 0x8fb070, 1.1], sun: [0xfff1d0, 2.3], ground: 0x6fcf6a, shoulder: 0x7ae070, wallA: 0xff6a5a, wallB: 0xffffff, kerbA: 0xff4a4a, kerbB: 0xffffff, road: 0x55556a, swatch: ['#3a9bff', '#9fdcff', '#6fcf6a'] } },
  { id: 'neon', name: 'Neon City', blurb: 'A night-time circuit between glowing towers, with a few sharp turns.', seed: 23, R0: 300, sx: 1.05, sz: 1.0, width: 11, harm: [[2, 48, 2.2], [3, 44, .3], [4, 24, 1.0], [7, 9, .5]], hills: [[3, 3, .2], [1, 3, 2]], decor: 'city', boosts: 7,
    theme: { sky: [0x0a0630, 0x3a1280, 0xff4fa8], fog: [0x2a1060, 90, 640], hemi: [0x9a8aff, 0x2a2060, .95], sun: [0xb0a0ff, 1.3], stars: .6, ground: 0x1a1040, shoulder: 0x2c2468, wallA: 0x2ee6ff, wallB: 0xff4fa8, kerbA: 0x2ee6ff, kerbB: 0xff4fa8, road: 0x2e2e48, swatch: ['#0a0630', '#3a1280', '#ff4fa8'] } },
  { id: 'frost', name: 'Frosty Peaks', blurb: 'Winding mountain roads with slippery ice patches. Watch your drifts.', seed: 37, R0: 310, sx: 1.12, sz: 1.0, width: 11.5, harm: [[2, 44, 1.0], [3, 56, 2.7], [5, 24, .2], [6, 11, 2.0]], hills: [[1, 8, .9], [2, 6, .3], [4, 3, 2]], decor: 'pines', ice: [[.18, .26], [.5, .58], [.8, .87]],
    theme: { sky: [0x6aa8ff, 0xc6e6ff, 0xffffff], fog: [0xe2f0fa, 110, 700], hemi: [0xe6f4ff, 0x9ab8d8, 1.1], sun: [0xffffff, 2.0], ground: 0xeef6ff, shoulder: 0xffffff, wallA: 0x7cc8ff, wallB: 0xffffff, kerbA: 0x4a8aff, kerbB: 0xffffff, road: 0x6a7288, swatch: ['#6aa8ff', '#c6e6ff', '#ffffff'] } },
  { id: 'canyon', name: 'Dusty Canyon', blurb: 'A sun-baked canyon with jump ramps and quicksand. Fly over the sand!', seed: 51, R0: 305, sx: 1.34, sz: .9, width: 12.5, harm: [[2, 54, .6], [3, 34, 2.0], [4, 22, .3], [5, 12, 1.1]], hills: [[1, 8, .2], [2, 5, 1.4], [3, 3, 2.6]], decor: 'cacti', boosts: 6, mud: [[.3, .345], [.73, .775]], ramps: [.275, .715],
    theme: { sky: [0xff8a3a, 0xffc27a, 0xfff0c8], fog: [0xffd9a8, 130, 740], hemi: [0xffe6c4, 0xb07a4a, 1.1], sun: [0xfff0c0, 2.4], ground: 0xe0a85a, shoulder: 0xf0c070, wallA: 0xc8582a, wallB: 0xffe0b0, kerbA: 0xd8552a, kerbB: 0xffffff, road: 0x5a4a52, swatch: ['#ff8a3a', '#ffc27a', '#e0a85a'] } },
  { id: 'lava', name: 'Lava Lair', blurb: 'A narrow road around a volcano. Hot lava, sharp turns and lots of boost pads.', seed: 67, R0: 285, sx: 1.12, sz: 1.04, width: 10.5, harm: [[2, 38, 1.2], [3, 46, .2], [5, 24, 2.4], [7, 11, .9]], hills: [[2, 4, .5], [3, 5, 1.9]], decor: 'lava', boosts: 9, ramps: [.52],
    theme: { sky: [0x1a0608, 0x6a1a0a, 0xff6a1a], fog: [0x4a1408, 80, 600], hemi: [0xff9a6a, 0x3a0c08, .95], sun: [0xff8a4a, 1.5], stars: .25, ground: 0x2a0c08, glow: 0xff3a00, shoulder: 0x3a1a10, wallA: 0xff5a1a, wallB: 0x2a1a1a, kerbA: 0xff7a1a, kerbB: 0x2a1a1a, road: 0x3a3340, swatch: ['#1a0608', '#6a1a0a', '#ff6a1a'] } },
  { id: 'cosmic', name: 'Cosmic Ribbon', blurb: 'A road floating in space: huge hills, crystals, and ramps between the stars.', seed: 83, R0: 322, sx: 1.22, sz: 1.0, width: 11, drop: 80, harm: [[2, 58, 2.1], [3, 38, .7], [4, 18, 1.9], [6, 9, .2]], hills: [[1, 12, 0], [2, 9, 1.2], [3, 5, 2.5]], decor: 'cosmic', boosts: 10, ramps: [.16, .59, .88],
    theme: { sky: [0x05031a, 0x1a1060, 0x8a2ad0], fog: [0x1a1060, 120, 800], hemi: [0xb8a0ff, 0x1a1050, 1.0], sun: [0xc0b0ff, 1.4], stars: 1, ground: 0x120a40, shoulder: 0x2a1a78, wallA: 0x2ee6ff, wallB: 0xb04aff, kerbA: 0xff4fa8, kerbB: 0x2ee6ff, road: 0x2c2650, swatch: ['#05031a', '#1a1060', '#8a2ad0'], glowArch: 1 } },
];
export const CUPS = [
  { id: 'sun', name: 'Sunshine Cup', blurb: 'Sunny Loop, Neon City and Frosty Peaks.', tracks: ['sunny', 'neon', 'frost'] },
  { id: 'thunder', name: 'Thunder Cup', blurb: 'Dusty Canyon, Lava Lair and Cosmic Ribbon. Harder!', tracks: ['canyon', 'lava', 'cosmic'] },
];
export const SHOULDER = 6;   // grass beside the kerb before the wall
export const KERB = 1.6;

// ---------------------------------------------------------------- sampling
export function sampleTrack(def, mirror = false) {
  const M = 4000, raw = [], twy = th => { let y = 0; for (const [k, a, ph] of def.hills) y += a * Math.sin(k * th + ph); return y; };
  for (let i = 0; i < M; i++) { const th = i / M * TAU; let r = def.R0; for (const [k, a, ph] of def.harm) r += a * Math.sin(k * th + ph); raw.push([r * Math.cos(th) * def.sx * (mirror ? -1 : 1), twy(th), r * Math.sin(th) * def.sz]); }
  let total = 0; const cum = [0]; for (let i = 0; i < M; i++) { const a = raw[i], b = raw[(i + 1) % M]; total += Math.hypot(b[0] - a[0], b[2] - a[2]); cum.push(total); }
  const N = Math.round(total / 3), ds = total / N, x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N); let j = 0;
  for (let i = 0; i < N; i++) { const target = i * ds; while (cum[j + 1] < target) j++; const f = (target - cum[j]) / (cum[j + 1] - cum[j]), a = raw[j], b = raw[(j + 1) % M]; x[i] = lerp(a[0], b[0], f); y[i] = lerp(a[1], b[1], f); z[i] = lerp(a[2], b[2], f); }
  const tx = new Float32Array(N), tz = new Float32Array(N), rx = new Float32Array(N), rz = new Float32Array(N), s = new Float32Array(N), kappa = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = (i + N - 1) % N, b = (i + 1) % N; let dx = x[b] - x[a], dz = z[b] - z[a]; const m = Math.hypot(dx, dz); tx[i] = dx / m; tz[i] = dz / m; rx[i] = tz[i]; rz[i] = -tx[i]; s[i] = i * ds; }
  for (let i = 0; i < N; i++) { const a = (i + N - 3) % N, b = (i + 3) % N, cr = tx[a] * tz[b] - tz[a] * tx[b]; kappa[i] = Math.asin(clamp(-cr, -1, 1)) / (6 * ds); }   // + = turning right
  let minR = 1e9; for (let i = 0; i < N; i++) if (Math.abs(kappa[i]) > 1e-5) minR = Math.min(minR, 1 / Math.abs(kappa[i]));
  let minY = 1e9, maxY = -1e9; for (let i = 0; i < N; i++) { minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]); }
  return { def, N, ds, length: total, x, y, z, tx, tz, rx, rz, s, kappa, width: def.width, minR, minY, maxY, groundY: minY - (def.drop || 1.2) };
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
const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _cp = new V3(), _cs = new V3(), _cY = new V3(0, 1, 0);

export class Track {
  constructor(def, mirror = false) {
    this.def = def; this.mirror = mirror; this.tr = sampleTrack(def, mirror); const tr = this.tr, th = def.theme; this.group = new THREE.Group(); scene.add(this.group); this.anim = []; this.boxes = []; this.pads = []; this.iceZones = []; this.mudZones = []; this.ramps = []; this.coins = [];
    const R = rng(def.seed * 13 + 5);
    // road, kerbs, grass shoulder, walls, embankment
    const road = ribbon(tr, -tr.width, tr.width, .02, 18, new THREE.MeshToonMaterial({ map: roadTex(th), gradientMap: toon(0).gradientMap })); this.group.add(road);
    const kt = kerbTex(th), km = new THREE.MeshToonMaterial({ map: kt, gradientMap: toon(0).gradientMap }); for (const sd of [-1, 1]) { const a = sd < 0 ? -tr.width - KERB : tr.width, b = sd < 0 ? -tr.width : tr.width + KERB; const k = ribbon(tr, a, b, .04, 3, km); this.group.add(k); }
    const sm = toon(th.shoulder); for (const sd of [-1, 1]) { const a = sd < 0 ? -tr.width - SHOULDER : tr.width + KERB, b = sd < 0 ? -tr.width - KERB : tr.width + SHOULDER; this.group.add(ribbon(tr, a, b, .0, 10, sm)); }
    for (const sd of [-1, 1]) this.group.add(wallMesh(tr, tr.width + SHOULDER + .3, 1.5, th, sd));
    const emb = toon(th.ground, th.glow ? { side: THREE.DoubleSide, emissive: th.glow, emissiveIntensity: .7 } : { side: THREE.DoubleSide }); for (const sd of [-1, 1]) { const mesh = ribbon(tr, 0, 1, 0, 10, emb); const pos = mesh.geometry.attributes.position, N = tr.N; for (let i = 0; i <= N; i++) { const k = i % N, inner = (tr.width + SHOULDER + .6) * sd, outer = (tr.width + SHOULDER + 26) * sd; pos.setXYZ(i * 2, tr.x[k] + tr.rx[k] * inner, tr.y[k] - .1, tr.z[k] + tr.rz[k] * inner); pos.setXYZ(i * 2 + 1, tr.x[k] + tr.rx[k] * outer, tr.groundY, tr.z[k] + tr.rz[k] * outer); } pos.needsUpdate = true; mesh.geometry.computeVertexNormals(); this.group.add(mesh); }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2200, 32), toon(th.ground, th.glow ? { emissive: th.glow, emissiveIntensity: .9 } : {})); ground.rotation.x = -Math.PI / 2; ground.position.y = tr.groundY; ground.receiveShadow = QL.shadow > 0; this.group.add(ground);
    // ice and mud patches: a coloured overlay on the road that also changes the grip (ice) or slows you down (mud)
    for (const [list, kind] of [[def.ice, 'ice'], [def.mud, 'mud']]) if (list) for (const [a, b] of list) { const s0 = a * tr.length, s1 = b * tr.length; (kind === 'ice' ? this.iceZones : this.mudZones).push([s0, s1]); const n0 = Math.floor(s0 / tr.ds), n1 = Math.floor(s1 / tr.ds), pos = [], idx = []; for (let i = n0; i <= n1; i++) { const k = i % tr.N, y = tr.y[k] + (kind === 'ice' ? .06 : .07), w = tr.width * .96; pos.push(tr.x[k] - tr.rx[k] * w, y, tr.z[k] - tr.rz[k] * w, tr.x[k] + tr.rx[k] * w, y, tr.z[k] + tr.rz[k] * w); if (i < n1) { const q = (i - n0) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: kind === 'ice' ? 0xbfeaff : 0x6b4524, transparent: true, opacity: kind === 'ice' ? .55 : .88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); this.group.add(m); }
    this.tr.isIcePt = s => this.isIce(s); this.tr.isMudPt = s => this.isMud(s); this.buildStart(); this.buildPads(R); this.buildBoxes(R); this.buildRamps(R); this.buildCoins(R); this.buildArches(R); this.buildDecor(R);
    this.mini = this.minimapPath();
  }
  isIce(s) { for (const [a, b] of this.iceZones) if (s >= a && s <= b) return true; return false; }
  isMud(s) { for (const [a, b] of this.mudZones) if (s >= a && s <= b) return true; return false; }
  // jump ramps: hit one fast and the kart flies (press drift in the air for a trick, which gives a boost when you land)
  buildRamps() {
    const tr = this.tr, hw = tr.width * .36, hz = cvTex(64, 64, (x, w, h) => { x.fillStyle = '#ffc01a'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a2140'; for (let i = -h; i < w; i += 22) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 11, h); x.lineTo(i + 11 + h, 0); x.lineTo(i + h, 0); x.closePath(); x.fill(); } });
    hz.repeat.set(hw * 2 / 6, 1.6);
    for (const fr of this.def.ramps || []) {
      const sc = fr * tr.length, p = pointAt(tr, sc, 0), g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, .6, 9), new THREE.MeshToonMaterial({ map: hz, gradientMap: toon(0).gradientMap })); m.rotation.x = -.27; m.position.y = 1.0; g.add(m);
      for (const sd of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 4.2, 6), toon(0xffffff)); post.position.set(sd * (hw + .5), 2.1, 3.2); g.add(post); const flag = new THREE.Mesh(new THREE.BoxGeometry(.1, .8, 1.3), toon(sd < 0 ? 0xff4fa8 : 0x2ee6ff)); flag.position.set(sd * (hw + .5), 3.8, 2.6); g.add(flag); }
      g.position.set(p.x, p.y, p.z); g.rotation.y = Math.atan2(p.tx, p.tz); this.group.add(g); this.ramps.push({ s: sc, hw, x: p.x, z: p.z });
    }
  }
  // coins: short lines along the road, and an arc of them above every ramp. Each one you collect nudges your top speed up (10 at most).
  buildCoins(R) {
    const tr = this.tr, groups = 9 + Math.round(tr.length / 260), spots = [];
    for (let i = 0; i < groups; i++) { const s0 = (i + .35) / groups * tr.length, lat = (R() * 2 - 1) * tr.width * .62; for (let j = 0; j < 5; j++) spots.push([s0 + j * 4.5, lat, 1.2]); }
    for (const rp of this.ramps) for (let j = 0; j < 7; j++) { const t = (j + .5) / 7; spots.push([rp.s + 8 + t * 30, 0, 2.2 + 2.8 * 4 * t * (1 - t)]); }
    const geo = new THREE.CylinderGeometry(.62, .62, .14, 16); geo.rotateX(Math.PI / 2); const mat = new THREE.MeshToonMaterial({ color: 0xffd23a, gradientMap: toon(0).gradientMap, emissive: 0x7a5200, emissiveIntensity: .9 });
    const im = new THREE.InstancedMesh(geo, mat, spots.length); im.frustumCulled = false; this.coinMesh = im; this.group.add(im);
    for (const [sc, lat, h] of spots) { const p = pointAt(tr, sc, lat); this.coins.push({ x: p.x, y: p.y + h, z: p.z, s: ((sc % tr.length) + tr.length) % tr.length, cd: 0 }); }
  }
  // arches over the road every quarter lap
  buildArches() {
    const tr = this.tr, th = this.def.theme, glow = !!th.glowArch || this.def.decor === 'city', W2 = tr.width + SHOULDER * .55, mk = c => glow ? new THREE.MeshBasicMaterial({ color: c }) : toon(c);
    for (let i = 0; i < 4; i++) {
      const p = pointAt(tr, (i + .5) / 4 * tr.length + 10, 0), g = new THREE.Group();
      for (const sd of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 11, 1.1), mk(sd < 0 ? th.wallA : th.wallB)); pl.position.set(sd * W2, 5.5, 0); g.add(pl); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(W2 * 2 + 1.1, 1.3, 1.1), mk(th.kerbA)); beam.position.y = 11; g.add(beam);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(W2 * 2 + 1.1, .35, 1.25), new THREE.MeshBasicMaterial({ color: th.kerbB })); strip.position.y = 11.85; g.add(strip);
      g.position.set(p.x, p.y, p.z); g.rotation.y = Math.atan2(p.tx, p.tz); this.group.add(g);
    }
  }
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
    } else if (kind === 'cacti' || kind === 'lava' || kind === 'cosmic') { this.buildDecorX(kind, spots, gy, R);
    } else {   // city: towers with lit windows
      const wt = cvTex(64, 128, (x, w, h) => { x.fillStyle = '#1b1744'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) for (let j = 0; j < 14; j++) { if (Math.random() < .55) { x.fillStyle = ['#ffd34e', '#2ee6ff', '#ff4fa8', '#fff'][Math.floor(Math.random() * 4)]; x.fillRect(4 + i * 10, 4 + j * 9, 6, 5); } } });
      const variants = [[14, 60, 14], [18, 90, 18], [12, 120, 12], [22, 50, 16], [16, 150, 16]]; variants.forEach(([sx, sy, sz], vi) => {
        const g = new THREE.BoxGeometry(sx, sy, sz); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx / 14, uv.getY(i) * sy / 28); const mine = spots.filter((_, i) => i % variants.length === vi);
        const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: wt, fog: true }), mine.length), M = new THREE.Matrix4(); mine.forEach(([x, z], i) => { M.makeTranslation(x, gy + sy / 2, z); im.setMatrixAt(i, M); }); im.frustumCulled = false; this.group.add(im);
      });
    }
  }
  buildDecorX(kind, spots, gy, R) {
    const tr = this.tr, M = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new V3(), sc = new V3(), Y = new V3(0, 1, 0), place = (im, i, x, y, z, s, r) => { pos.set(x, y, z); sc.set(s, s, s); q.setFromAxisAngle(Y, r * 6.28); M.compose(pos, q, sc); im.setMatrixAt(i, M); };
    const inst = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; this.group.add(im); return im; };
    if (kind === 'cacti') {
      const cactus = mergeColored([[T3(new THREE.CylinderGeometry(.55, .65, 5, 8), 0, 2.5, 0), 0x3a9a4a], [T3(new THREE.SphereGeometry(.55, 8, 6), 0, 5, 0), 0x3a9a4a], [T3(new THREE.CylinderGeometry(.35, .35, 2, 7).rotateZ(Math.PI / 2), 1, 3, 0), 0x46aa54], [T3(new THREE.CylinderGeometry(.3, .3, 2, 7), 1.9, 4, 0), 0x46aa54], [T3(new THREE.CylinderGeometry(.35, .35, 1.6, 7).rotateZ(Math.PI / 2), -.8, 2.2, 0), 0x46aa54], [T3(new THREE.CylinderGeometry(.3, .3, 1.8, 7), -1.6, 3.1, 0), 0x46aa54]]);
      const mesa = mergeColored([[T3(new THREE.CylinderGeometry(13, 17, 24, 7), 0, 12, 0), 0xc0623a], [T3(new THREE.CylinderGeometry(13.4, 13.4, 3, 7), 0, 25, 0), 0xe0884a], [T3(new THREE.CylinderGeometry(15.2, 15.6, 2.2, 7), 0, 9, 0), 0xd8784a]]);
      const mesas = [], cacti = []; for (const sp of spots) (Math.abs(nearest(tr, sp[0], sp[1], -1).d) > 78 && mesas.length < 14 && sp[2] > .6 ? mesas : cacti).push(sp);
      const ci = inst(cactus, toon(0xffffff, { vertexColors: true }), cacti.length), mi = inst(mesa, toon(0xffffff, { vertexColors: true }), mesas.length);
      cacti.forEach(([x, z, r], i) => place(ci, i, x, gy, z, .8 + r * 1.1, r)); mesas.forEach(([x, z, r], i) => place(mi, i, x, gy, z, .7 + r * .9, r));
    } else if (kind === 'lava') {
      const spire = mergeColored([[T3(new THREE.ConeGeometry(3, 15, 6), 0, 7.5, 0), 0x2a1a22], [T3(new THREE.ConeGeometry(1.2, 4, 6), 0, 14.5, 0), 0xff7a1a], [T3(new THREE.IcosahedronGeometry(2.2, 0), 3.4, 1.1, 1), 0x3a2430]]);
      const pool = new THREE.CircleGeometry(1, 14); pool.rotateX(-Math.PI / 2); pool.userData.shared = true;
      const si = inst(spire, toon(0xffffff, { vertexColors: true }), spots.length), pi = inst(pool, new THREE.MeshBasicMaterial({ color: 0xff6a1a, polygonOffset: true, polygonOffsetFactor: -1 }), spots.length);
      spots.forEach(([x, z, r], i) => { place(si, i, x, gy, z, .8 + r * 1.2, r); place(pi, i, x + 9 + r * 6, gy + .2, z - 7, 5 + r * 8, r); });
      const n = 260, pts = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const p = pointAt(tr, R() * tr.length, (R() * 2 - 1) * 70); pts[i * 3] = p.x; pts[i * 3 + 1] = tr.minY + R() * 60; pts[i * 3 + 2] = p.z; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pts, 3)); this.embers = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa040, size: 3.2, sizeAttenuation: false, transparent: true, opacity: .85, depthWrite: false })); this.embers.frustumCulled = false; this.embers.userData.base = tr.minY; this.group.add(this.embers);
    } else {   // cosmic: floating crystals and two ringed planets
      const cr = new THREE.OctahedronGeometry(3, 0); cr.scale(1, 2.6, 1); cr.userData.shared = true; const n = spots.length * 2, im = inst(cr, toon(0xffffff), n), cols = [0x2ee6ff, 0xff4fa8, 0xb04aff, 0x6affe0].map(c => new THREE.Color(c));
      for (let i = 0; i < n; i++) { const sp = spots[i % spots.length], r = R(); place(im, i, sp[0] + (R() - .5) * 30, tr.minY - 40 + R() * (tr.maxY - tr.minY + 130), sp[1] + (R() - .5) * 30, .5 + r * 1.3, r); im.setColorAt(i, cols[i % 4]); }
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      for (const [x, y, z, rad, col] of [[-520, 150, -380, 90, 0x7a3ad0], [480, 230, 420, 60, 0x2ab8c8]]) { const pl = new THREE.Mesh(new THREE.SphereGeometry(rad, 24, 16), new THREE.MeshBasicMaterial({ color: col, fog: false })); pl.position.set(x, y, z); const rg = new THREE.Mesh(new THREE.TorusGeometry(rad * 1.5, 3, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffd8ff, fog: false })); rg.rotation.x = 1.25; pl.add(rg); this.group.add(pl); }
    }
  }
  minimapPath() { const tr = this.tr, pts = []; for (let i = 0; i < tr.N; i += 4) pts.push([tr.x[i], tr.z[i]]); return pts; }
  update(dt, t) {
    for (const b of this.boxes) { b.m.rotation.y += dt * 1.8; b.m.rotation.x = Math.sin(t * 2 + b.s) * .25; b.m.position.y = b.y + Math.sin(t * 3 + b.lat) * .18; if (b.cd > 0) { b.cd -= dt; b.m.visible = b.cd <= 0; } }
    if (this.padTex) this.padTex.offset.y -= dt * 1.2;
    if (this.coinMesh) { const n = this.coins.length; for (let i = 0; i < n; i++) { const c = this.coins[i]; if (c.cd > 0) c.cd -= dt; _cq.setFromAxisAngle(_cY, t * 3 + c.s); _cp.set(c.x, c.y + Math.sin(t * 2 + c.s) * .12, c.z); _cs.setScalar(c.cd > 0 ? .0001 : 1); _cm.compose(_cp, _cq, _cs); this.coinMesh.setMatrixAt(i, _cm); } this.coinMesh.instanceMatrix.needsUpdate = true; }
    if (this.embers) { const a = this.embers.geometry.attributes.position, base = this.embers.userData.base; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 5; if (y > base + 70) y = base - 5; a.setY(i, y); } a.needsUpdate = true; }
  }
  dispose() { scene.remove(this.group); disposeObj(this.group); }
}
