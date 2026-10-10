// PUTT PARTY - core: renderer, quality settings, toon look, sky, effects, audio and small helpers.
import * as THREE from './three.module.min.js';
export { THREE };
export const V3 = THREE.Vector3;
export const $ = id => document.getElementById(id);
export const QS = new URLSearchParams(location.search), DEBUG = QS.has('debug');
export const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, pick = a => a[Math.floor(Math.random() * a.length)];
export const hex = c => '#' + c.toString(16).padStart(6, '0');
export const load = (k, d) => { try { const v = localStorage.getItem('pp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
export const save = (k, v) => { try { localStorage.setItem('pp.' + k, JSON.stringify(v)); } catch (e) {} };
export const S = { vol: load('vol', .7), color: load('color', 0xff4fa8) };
export const rng = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// ------------------------------------------------------------------ graphics quality (Chromebooks are detected and get lighter settings)
export const IS_CROS = /CrOS/.test(navigator.userAgent || '');
export const GFX_PREF = QS.get('gfx') || load('gfx', 'auto');
export const GFX = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : (IS_CROS ? 'low' : ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) ? 'med' : 'high');
export const QL = {
  high: { aa: true, pr: 1.75, shadow: 2048, hull: true, fx: 1, start: 1, min: .5 },
  med:  { aa: false, pr: 1.25, shadow: 1024, hull: false, fx: .7, start: 1, min: .5 },
  low:  { aa: false, pr: 1, shadow: 0, hull: false, fx: .45, start: .9, min: .4 },
}[GFX];

export const canvas = $('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: QL.aa, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
const BASE_PR = Math.min(devicePixelRatio, QL.pr);
export const R = { scale: QL.start, ceil: 1 };
renderer.setPixelRatio(BASE_PR); renderer.shadowMap.enabled = QL.shadow > 0; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
export const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xbfe9ff, 120, 420);
export const camera = new THREE.PerspectiveCamera(42, 1, .5, 1400); scene.add(camera);
export const VIEW = { top: 0, bottom: 0 };   // screen space the HUD takes at the top and bottom: the map is centred in what is left
export function resize() {
  const w = innerWidth, h = innerHeight; renderer.setPixelRatio(BASE_PR * R.scale); renderer.setSize(w, h, false); camera.aspect = w / h;
  const shift = (VIEW.bottom - VIEW.top) / 2; if (Math.abs(shift) > .5) camera.setViewOffset(w, h, 0, shift, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

export const hemi = new THREE.HemisphereLight(0xcfeaff, 0x8a9a6a, 1.05); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff1d0, 2.3); sun.position.set(40, 90, 30); sun.castShadow = QL.shadow > 0; sun.shadow.mapSize.set(QL.shadow || 512, QL.shadow || 512);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 300 }); sun.shadow.bias = -.0005; sun.shadow.normalBias = .05; scene.add(sun); scene.add(sun.target);
export function aimSun(x, z, ext) { sun.position.set(x + 40, 90, z + 30); sun.target.position.set(x, 0, z); sun.target.updateMatrixWorld(); const c = sun.shadow.camera; c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.updateProjectionMatrix(); }

// ------------------------------------------------------------------ toon look
export const gradient = (() => { const d = new Uint8Array([90, 150, 210, 255]); const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (c, o = {}) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: gradient }, o));
export const INK = new THREE.MeshBasicMaterial({ color: 0x120a24, side: THREE.BackSide });
export function disposeObj(o) { o.traverse(c => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); if (c.material && c.material !== INK && !c.material.userData.shared) { if (Array.isArray(c.material)) c.material.forEach(m => m.dispose()); else c.material.dispose(); } }); }

// ------------------------------------------------------------------ sky
export const skyU = { top: { value: new THREE.Color(0x2f8cff) }, mid: { value: new THREE.Color(0x8fd8ff) }, bot: { value: new THREE.Color(0xfff0d8) }, sunStr: { value: 1 } };
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float sunStr; void main(){ float h = clamp(p.y,-0.3,1.0); vec3 c = h<0.12 ? mix(bot, mid, smoothstep(-0.3,0.12,h)) : mix(mid, top, smoothstep(0.12,0.75,h)); float sun = pow(max(dot(p, normalize(vec3(0.5,0.8,0.35))),0.0), 220.0) * sunStr; gl_FragColor = vec4(c + vec3(1.0,0.9,0.6)*sun, 1.0); }' })));
const starGeo = (() => { const n = 500, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = rnd(0, TAU), ph = Math.acos(rnd(.02, 1)), r = 900; a[i * 3] = Math.sin(ph) * Math.cos(th) * r; a[i * 3 + 1] = Math.cos(ph) * r; a[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return g; })();
export const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.6, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0 });
scene.add(new THREE.Points(starGeo, starMat));
const _b = new THREE.Color();
// theme: { sky:[top,mid,bot], fog:[color,near,far], hemi:[sky,ground,intensity], sun:[color,intensity], stars }
export function setTheme(A) {
  skyU.top.value.setHex(A.sky[0]); skyU.mid.value.setHex(A.sky[1]); skyU.bot.value.setHex(A.sky[2]);
  scene.fog.color.setHex(A.fog[0]); scene.fog.near = A.fog[1]; scene.fog.far = A.fog[2];
  hemi.color.setHex(A.hemi[0]); hemi.groundColor.setHex(A.hemi[1]); hemi.intensity = A.hemi[2];
  sun.color.setHex(A.sun[0]); sun.intensity = A.sun[1]; skyU.sunStr.value = A.sunStr === undefined ? 1 : A.sunStr; starMat.opacity = A.stars || 0;
}

// ------------------------------------------------------------------ effects: confetti bursts, rings and beams
export const FX = { parts: [], rings: [], beams: [], beamFree: [] };
// confetti is one instanced mesh (a single draw call, however many bits are flying)
const pGeo = new THREE.BoxGeometry(1, 1, 1); pGeo.userData.shared = true; const PMAX = 800;
const pim = new THREE.InstancedMesh(pGeo, new THREE.MeshBasicMaterial(), PMAX); pim.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pim.frustumCulled = false; pim.count = 0; pim.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3); pim.renderOrder = 4; scene.add(pim);
const _pc = new THREE.Color(), _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _ps = new THREE.Vector3(), _pp = new THREE.Vector3();
export function burst(pos, color, n = 12, spd = 6, size = .22, life = .8, grav = 14, up = 0) {
  n = Math.max(1, Math.round(n * QL.fx)); _pc.set(color);
  for (let i = 0; i < n && FX.parts.length < PMAX; i++) {
    const a = rnd(0, TAU), e = rnd(-.2, 1), s = spd * rnd(.4, 1);
    FX.parts.push({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * s * (1 - Math.abs(e) * .3), vy: e * s + up, vz: Math.sin(a) * s * (1 - Math.abs(e) * .3), life, max: life, grav, s: size * rnd(.6, 1.4), ax: rnd(0, TAU), ay: rnd(0, TAU), rx: rnd(-8, 8), ry: rnd(-8, 8), r: _pc.r, g: _pc.g, b: _pc.b });
  }
}
const ringGeo = new THREE.RingGeometry(.7, 1, 28); ringGeo.userData.shared = true;
export function ring(pos, color = 0xffffff, r = 1.2, life = .4) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false })); m.position.copy(pos); m.rotation.x = -Math.PI / 2; scene.add(m); FX.rings.push({ m, r, life, max: life });
}
// a beam between two points: a thin box that fades out (rail shots, lightning, airstrike lines)
const beamGeo = new THREE.BoxGeometry(1, 1, 1); beamGeo.translate(0, 0, .5); beamGeo.userData.shared = true;
const _d = new THREE.Vector3();
export function beam(a, b, color = 0xffffff, w = .25, life = .18) {
  let m = FX.beamFree.pop(); if (!m) { m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false })); scene.add(m); }
  m.material.color.set(color); m.material.opacity = 1; m.visible = true; m.position.copy(a); _d.subVectors(b, a); const len = Math.max(.01, _d.length()); m.lookAt(b); m.scale.set(w, w, len); FX.beams.push({ m, life, max: life, w });
}
export function updateFX(dt) {
  let n = 0;
  for (let i = FX.parts.length - 1; i >= 0; i--) { const p = FX.parts[i]; p.life -= dt; if (p.life <= 0) { FX.parts[i] = FX.parts[FX.parts.length - 1]; FX.parts.pop(); } }
  for (const p of FX.parts) {
    p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.ax += p.rx * dt; p.ay += p.ry * dt; p.s *= 1 - dt * .5;
    _pe.set(p.ax, p.ay, 0); _pq.setFromEuler(_pe); _ps.setScalar(p.s); _pp.set(p.x, p.y, p.z); pim.setMatrixAt(n, _pm.compose(_pp, _pq, _ps)); _pc.setRGB(p.r, p.g, p.b); pim.setColorAt(n, _pc); n++;
  }
  pim.count = n; if (n) { pim.instanceMatrix.needsUpdate = true; pim.instanceColor.needsUpdate = true; }
  for (let i = FX.rings.length - 1; i >= 0; i--) { const b = FX.rings[i]; b.life -= dt; const k = 1 - b.life / b.max; b.m.scale.setScalar(.3 + k * b.r); b.m.material.opacity = .9 * (1 - k); if (b.life <= 0) { scene.remove(b.m); b.m.material.dispose(); FX.rings.splice(i, 1); } }
  for (let i = FX.beams.length - 1; i >= 0; i--) { const b = FX.beams[i]; b.life -= dt; const k = Math.max(0, b.life / b.max); b.m.material.opacity = k; b.m.scale.x = b.m.scale.y = b.w * (.4 + .6 * k); if (b.life <= 0) { b.m.visible = false; FX.beamFree.push(b.m); FX.beams.splice(i, 1); } }
}
export function clearFX() { FX.parts.length = 0; pim.count = 0; for (const b of FX.rings) { scene.remove(b.m); b.m.material.dispose(); } FX.rings.length = 0; for (const b of FX.beams) { b.m.visible = false; FX.beamFree.push(b.m); } FX.beams.length = 0; }

// ------------------------------------------------------------------ audio (all synthesized)
let AC = null, master = null, noiseBuf = null;
export function audioInit() { if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = S.vol; master.connect(AC.destination); noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; } }
export function setVolume(v) { S.vol = v; if (master) master.gain.value = v; }
function tone(f1, f2, dur, type = 'square', vol = .3, delay = 0) { if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); }
function noise(dur, vol = .4, f = 3000, q = 1, delay = 0) { if (!AC) return; const t = AC.currentTime + delay, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(Math.max(100, f / 6), t + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * .5, dur + .05); }
const SFX = {
  putt: v => { noise(.08, .35 * v + .1, 2600); tone(300 + 400 * v, 120, .09, 'triangle', .25 * v + .1); }, wall: v => { tone(520, 300, .06, 'square', .1 * v); noise(.05, .15 * v, 3000); }, bump: () => { tone(300, 900, .12, 'sine', .22); tone(600, 1200, .1, 'triangle', .12, .04); },
  sand: () => noise(.18, .1, 900), sink: () => { tone(900, 300, .22, 'triangle', .25); tone(300, 110, .3, 'sine', .3, .12); noise(.12, .2, 1500, 1, .1); }, splash: () => { noise(.5, .4, 1800); tone(500, 100, .4, 'sine', .2); },
  boost: () => { noise(.3, .18, 3200); tone(200, 700, .25, 'sawtooth', .1); }, tele: () => { tone(300, 1500, .25, 'sine', .22); tone(1500, 300, .25, 'sine', .22, .22); },
  cheer: () => { for (let i = 0; i < 5; i++) tone(500 * Math.pow(1.25, i), 500 * Math.pow(1.25, i) * 1.4, .18, 'triangle', .2, i * .09); noise(.6, .12, 4000, 1, .3); }, ace: () => { for (let i = 0; i < 8; i++) tone(520 * Math.pow(1.19, i), 520 * Math.pow(1.19, i) * 1.5, .2, 'triangle', .22, i * .08); noise(.9, .16, 5000, 1, .4); },
  error: () => tone(200, 150, .15, 'square', .14), click: () => tone(900, 700, .04, 'square', .07), tick: () => tone(1400, 1400, .03, 'square', .05), aim: v => tone(300 + 500 * v, 300 + 500 * v, .03, 'square', .03), win: () => { for (let i = 0; i < 5; i++) tone(520 * Math.pow(1.26, i), 520 * Math.pow(1.26, i) * 1.5, .22, 'triangle', .24, i * .14); },
};
const lastSfx = {};
export const sfx = (k, v = 1) => { if (!AC || !SFX[k]) return; const now = performance.now(); const gap = { wall: 45, sand: 90, aim: 40 }[k] || 0; if (gap && lastSfx[k] && now - lastSfx[k] < gap) return; lastSfx[k] = now; SFX[k](v); };

// ------------------------------------------------------------------ shared state
export const W = { time: 0, state: 'menu' };

// adaptive resolution keeps the framerate smooth on slower GPUs
let perfT = 0, perfN = 0, lastRaise = -99;
export function adaptRes(raw, active) {
  if (raw > .25) return; perfT += raw; perfN++; if (perfT < 1.5) return;
  const avg = perfT / perfN; perfT = perfN = 0; if (!active) return;
  if (avg > .0215 && R.scale > QL.min) { R.scale = Math.max(QL.min, R.scale - .12); if (W.time - lastRaise < 12) R.ceil = R.scale; resize(); }
  else if (avg < .0185 && R.scale < R.ceil) { R.scale = Math.min(R.ceil, R.scale + .06); lastRaise = W.time; resize(); }
}
