// ESCAPE DA TRAZ - core: renderer, quality settings, toon look, sky, effects, audio and small helpers. (adapted from the shared engine used by Wobble Dash / Sky Tower)
import * as THREE from './three.module.min.js';
export { THREE };
export const V3 = THREE.Vector3;
export const $ = id => document.getElementById(id);
export const QS = new URLSearchParams(location.search), DEBUG = QS.has('debug');
export const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, pick = a => a[Math.floor(Math.random() * a.length)];
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
export const hex = c => '#' + c.toString(16).padStart(6, '0');
export const load = (k, d) => { try { const v = localStorage.getItem('edt.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
export const save = (k, v) => { try { localStorage.setItem('edt.' + k, JSON.stringify(v)); } catch (e) {} };
export const S = { vol: load('vol', .7) };

// ------------------------------------------------------------------ graphics quality (Chromebooks are detected and get lighter settings)
export const IS_CROS = /CrOS/.test(navigator.userAgent || '');
export const GFX_PREF = QS.get('gfx') || load('gfx', 'auto');
export const GFX = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : (IS_CROS ? 'low' : ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) ? 'med' : 'high');
export const QL = {
  high: { aa: true, pr: 1.75, shadow: 1536, fx: 1, start: 1, min: .5 },
  med:  { aa: false, pr: 1.25, shadow: 768, fx: .7, start: 1, min: .5, skip: true },
  low:  { aa: false, pr: 1, shadow: 0, fx: .45, start: .9, min: .4 },
}[GFX];

export const canvas = $('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: QL.aa, powerPreference: 'high-performance' });
const BASE_PR = Math.min(devicePixelRatio, QL.pr);
export const R = { scale: QL.start, ceil: 1 };
renderer.setPixelRatio(BASE_PR); renderer.shadowMap.enabled = QL.shadow > 0; renderer.shadowMap.type = THREE.PCFShadowMap; if (QL.skip) renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
export const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a0e18, 16, 70);
export const camera = new THREE.PerspectiveCamera(68, 1, .1, 400); camera.rotation.order = 'YXZ'; scene.add(camera);
export function resize() { const w = innerWidth, h = innerHeight; renderer.setPixelRatio(BASE_PR * R.scale); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

export const hemi = new THREE.HemisphereLight(0x8aa4d8, 0x30303e, 1.5); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xdfe8ff, 1.2); sun.position.set(14, 30, 10); sun.castShadow = QL.shadow > 0; sun.shadow.mapSize.set(QL.shadow || 512, QL.shadow || 512);
export const playerLight = new THREE.PointLight(0xfff2cf, 1.1, 10, 2); scene.add(playerLight);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .05; scene.add(sun); scene.add(sun.target);
export function followSun(x, y, z) { sun.position.set(x + 10, y + 26, z + 8); sun.target.position.set(x, y, z); sun.target.updateMatrixWorld(); }

// ------------------------------------------------------------------ toon look
export const gradient = (() => { const d = new Uint8Array([70, 130, 195, 255]); const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (c, o = {}) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: gradient }, o));
export function disposeObj(o) { o.traverse(c => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); if (c.material && !c.material.userData.shared) { if (Array.isArray(c.material)) c.material.forEach(m => m.dispose()); else c.material.dispose(); } }); }

// ------------------------------------------------------------------ effects: sparks and rings (used for lock hits and door unlocks)
export const FX = { parts: [], rings: [] };
const pGeo = new THREE.BoxGeometry(1, 1, 1); pGeo.userData.shared = true; const PMAX = 300;
const pim = new THREE.InstancedMesh(pGeo, new THREE.MeshBasicMaterial(), PMAX); pim.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pim.frustumCulled = false; pim.count = 0; pim.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3); scene.add(pim);
const _pc = new THREE.Color(), _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _ps = new THREE.Vector3(), _pp = new THREE.Vector3();
export function burst(pos, color, n = 10, spd = 5, size = .1, life = .6, grav = 12, up = 0) {
  n = Math.max(1, Math.round(n * QL.fx)); _pc.set(color);
  for (let i = 0; i < n && FX.parts.length < PMAX; i++) { const a = rnd(0, TAU), e = rnd(-.2, 1), s = spd * rnd(.4, 1); FX.parts.push({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * s, vy: e * s + up, vz: Math.sin(a) * s, life, grav, s: size * rnd(.6, 1.4), ax: rnd(0, TAU), ay: rnd(0, TAU), rx: rnd(-8, 8), ry: rnd(-8, 8), r: _pc.r, g: _pc.g, b: _pc.b }); }
}
const ringGeo = new THREE.RingGeometry(.7, 1, 24); ringGeo.userData.shared = true;
export function ring(pos, color = 0xffffff, r = 1.2, life = .5, flat = true) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false })); m.position.copy(pos); if (flat) m.rotation.x = -Math.PI / 2; scene.add(m); FX.rings.push({ m, r, life, max: life });
}
export function updateFX(dt) {
  let n = 0;
  for (let i = FX.parts.length - 1; i >= 0; i--) { const p = FX.parts[i]; p.life -= dt; if (p.life <= 0) { FX.parts[i] = FX.parts[FX.parts.length - 1]; FX.parts.pop(); } }
  for (const p of FX.parts) { p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.ax += p.rx * dt; p.ay += p.ry * dt; p.s *= 1 - dt * .5; _pe.set(p.ax, p.ay, 0); _pq.setFromEuler(_pe); _ps.setScalar(p.s); _pp.set(p.x, p.y, p.z); pim.setMatrixAt(n, _pm.compose(_pp, _pq, _ps)); _pc.setRGB(p.r, p.g, p.b); pim.setColorAt(n, _pc); n++; }
  pim.count = n; if (n) { pim.instanceMatrix.needsUpdate = true; pim.instanceColor.needsUpdate = true; }
  for (let i = FX.rings.length - 1; i >= 0; i--) { const b = FX.rings[i]; b.life -= dt; const k = 1 - b.life / b.max; b.m.scale.setScalar(.3 + k * b.r); b.m.material.opacity = .9 * (1 - k); if (b.life <= 0) { scene.remove(b.m); b.m.material.dispose(); FX.rings.splice(i, 1); } }
}
export function clearFX() { FX.parts.length = 0; pim.count = 0; for (const b of FX.rings) { scene.remove(b.m); b.m.material.dispose(); } FX.rings.length = 0; }

// ------------------------------------------------------------------ audio (all synthesized)
let AC = null, master = null, noiseBuf = null;
export function audioInit() { if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = S.vol; master.connect(AC.destination); noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; } }
export function setVolume(v) { S.vol = v; if (master) master.gain.value = v; }
function tone(f1, f2, dur, type = 'square', vol = .3, delay = 0) { if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); }
function noise(dur, vol = .4, f = 3000, q = 1, delay = 0) { if (!AC) return; const t = AC.currentTime + delay, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(Math.max(100, f / 6), t + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * .5, dur + .05); }
const SFX = {
  click: () => tone(900, 700, .04, 'square', .1), step: () => noise(.02, .035, 1400),
  pickOn: () => tone(260, 420, .12, 'triangle', .18), pickHit: () => { tone(700, 1100, .09, 'triangle', .22); tone(1100, 1500, .08, 'triangle', .16, .05); }, pickMiss: () => { noise(.1, .3, 2200); tone(220, 90, .12, 'sawtooth', .18); },
  pickDone: () => { tone(520, 780, .1, 'triangle', .24); tone(780, 1170, .14, 'triangle', .24, .1); tone(1170, 1560, .22, 'triangle', .22, .22); },
  spot: () => { tone(900, 1300, .06, 'square', .07); }, alarm: () => { for (let i = 0; i < 2; i++) tone(500, 1100, .22, 'sawtooth', .22, i * .26); }, caught: () => { tone(500, 70, .5, 'sawtooth', .28); noise(.3, .22, 2200); },
  reset: () => tone(300, 160, .2, 'triangle', .14), win: () => { tone(520, 780, .14, 'triangle', .26); tone(780, 1040, .14, 'triangle', .26, .14); tone(1040, 1560, .3, 'triangle', .24, .28); tone(1560, 2080, .4, 'triangle', .2, .5); },
  door: () => { noise(.18, .3, 1500); tone(180, 90, .22, 'square', .16); }, beep: () => tone(520, 520, .14, 'square', .14), stage: () => { tone(400, 600, .12, 'triangle', .2); tone(600, 900, .16, 'triangle', .2, .1); },
};
export const sfx = (k, v = 1) => { if (AC && SFX[k]) SFX[k](v); };

// ------------------------------------------------------------------ shared state
export const W = { time: 0, state: 'menu' };

let perfT = 0, perfN = 0, lastRaise = -99;
export function adaptRes(raw, active) {
  if (!active) return; perfN++; perfT += raw; if (perfT < .5) return; const fps = perfN / perfT; perfN = 0; perfT = 0;
  if (fps < 42 && R.scale > QL.min) { R.scale = Math.max(QL.min, R.scale - .12); resize(); lastRaise = W.time; }
  else if (fps > 56 && R.scale < R.ceil && W.time - lastRaise > 3) { R.scale = Math.min(R.ceil, R.scale + .08); resize(); }
}
