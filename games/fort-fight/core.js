// FORT FIGHT - core: renderer, quality settings, toon look, sky, effects, audio and small helpers.
import * as THREE from './three.module.min.js';
export { THREE };
export const V3 = THREE.Vector3;
export const $ = id => document.getElementById(id);
export const QS = new URLSearchParams(location.search), DEBUG = QS.has('debug'), NETMODE = QS.get('net') === 'local' ? 'local' : 'peerjs';
export const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, pick = a => a[Math.floor(Math.random() * a.length)];
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
export const hex = c => '#' + c.toString(16).padStart(6, '0');
export const load = (k, d) => { try { const v = localStorage.getItem('ff.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
export const save = (k, v) => { try { localStorage.setItem('ff.' + k, JSON.stringify(v)); } catch (e) {} };
export const S = { sens: load('sens', 1), fov: load('fov', 90), vol: load('vol', .7) };

// ------------------------------------------------------------------ graphics quality (Chromebooks are detected and get lighter settings)
export const IS_CROS = /CrOS/.test(navigator.userAgent || '');
export const GFX_PREF = QS.get('gfx') || load('gfx', 'auto');
export const GFX = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : (IS_CROS ? 'low' : ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) ? 'med' : 'high');
export const QL = {
  high: { aa: true, pr: 1.75, shadow: 2048, edges: true, fx: 1, clouds: 14, start: 1, min: .5, maxPieces: 900 },
  med:  { aa: false, pr: 1.25, shadow: 1024, edges: false, fx: .7, clouds: 8, start: 1, min: .5, skip: true, maxPieces: 700 },
  low:  { aa: false, pr: 1, shadow: 0, edges: false, fx: .45, clouds: 4, start: .9, min: .4, maxPieces: 500 },
}[GFX];

export const canvas = $('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: QL.aa, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
const BASE_PR = Math.min(devicePixelRatio, QL.pr);
export const R = { scale: QL.start, ceil: 1 };
renderer.setPixelRatio(BASE_PR); renderer.shadowMap.enabled = QL.shadow > 0; renderer.shadowMap.type = THREE.PCFShadowMap; if (QL.skip) renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
export const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xbfe9ff, 60, 220);
export const camera = new THREE.PerspectiveCamera(S.fov, 1, .1, 700); camera.rotation.order = 'YXZ'; scene.add(camera);
export function resize() { const w = innerWidth, h = innerHeight; renderer.setPixelRatio(BASE_PR * R.scale); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

export const hemi = new THREE.HemisphereLight(0xcfeaff, 0x8a9a6a, 1.05); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff1d0, 2.3); sun.position.set(30, 50, 20); sun.castShadow = QL.shadow > 0; sun.shadow.mapSize.set(QL.shadow || 512, QL.shadow || 512);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 160 }); sun.shadow.bias = -.0004; scene.add(sun); scene.add(sun.target);
export function followSun(x, z) { sun.position.set(x + 30, 60, z + 20); sun.target.position.set(x, 0, z); sun.target.updateMatrixWorld(); }

// ------------------------------------------------------------------ toon look
export const gradient = (() => { const d = new Uint8Array([90, 150, 210, 255]); const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (c, o = {}) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: gradient }, o));
export const INK = new THREE.MeshBasicMaterial({ color: 0x120a24, side: THREE.BackSide });
export const OUTLINE_ON = GFX !== 'low';
export function outline(mesh, k = 1.06) { if (!OUTLINE_ON) return mesh; const o = new THREE.Mesh(mesh.geometry, INK); o.scale.setScalar(k); mesh.add(o); return mesh; }
export function disposeObj(o) { o.traverse(c => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); if (c.material && c.material !== INK && !c.material.userData.shared) { if (c.material.map && c.material.map.isCanvasTexture) c.material.map.dispose(); c.material.dispose(); } }); }

// ------------------------------------------------------------------ sky + themes
export const skyU = { top: { value: new THREE.Color(0x2f8cff) }, mid: { value: new THREE.Color(0x8fd8ff) }, bot: { value: new THREE.Color(0xfff0d8) }, sunStr: { value: 1 } };
scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float sunStr; void main(){ float h = clamp(p.y,-0.1,1.0); vec3 c = h<0.18 ? mix(bot, mid, smoothstep(-0.1,0.18,h)) : mix(mid, top, smoothstep(0.18,0.8,h)); float sun = pow(max(dot(p, normalize(vec3(0.5,0.8,0.35))),0.0), 220.0) * sunStr; gl_FragColor = vec4(c + vec3(1.0,0.9,0.6)*sun, 1.0); }' })));
export const clouds = [], cloudGroup = new THREE.Group(), cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient, fog: false }); scene.add(cloudGroup);
for (let i = 0; i < QL.clouds; i++) { const g = new THREE.Group(), n = rint(3, 5); for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(8, 13), 12, 8), cloudMat); m.position.set(k * 10 - n * 5, rnd(-2, 2), rnd(-3, 3)); m.scale.y = .7; g.add(m); } const a = rnd(0, TAU), r = rnd(160, 320); g.position.set(Math.cos(a) * r, rnd(70, 120), Math.sin(a) * r); g.userData.sp = rnd(.5, 1.4); cloudGroup.add(g); clouds.push(g); }
export function applyTheme(t) {
  skyU.top.value.setHex(t.sky[0]); skyU.mid.value.setHex(t.sky[1]); skyU.bot.value.setHex(t.sky[2]); skyU.sunStr.value = t.sunStr;
  scene.fog.color.setHex(t.fog[0]); scene.fog.near = t.fog[1]; scene.fog.far = t.fog[2];
  hemi.color.setHex(t.hemi[0]); hemi.groundColor.setHex(t.hemi[1]); hemi.intensity = t.hemi[2]; sun.color.setHex(t.sun[0]); sun.intensity = t.sun[1]; renderer.toneMappingExposure = t.exposure; cloudMat.color.setHex(t.clouds);
}
export function updateClouds(dt) { for (const c of clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 340) c.position.x = -340; } }

// ------------------------------------------------------------------ effects: confetti bursts, tracers, rings
export const FX = { parts: [], tracers: [], rings: [], free: [] };
const pGeo = new THREE.BoxGeometry(1, 1, 1); pGeo.userData.shared = true;
export function burst(pos, color, n = 12, spd = 6, size = .12, life = .8, grav = 14, up = 0) {
  n = Math.max(1, Math.round(n * QL.fx));
  for (let i = 0; i < n; i++) {
    let p = FX.free.pop(); if (!p) { p = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color })); scene.add(p); p.userData = {}; }
    p.material.color.set(color); p.visible = true; p.position.copy(pos); p.scale.setScalar(size * rnd(.6, 1.4));
    const a = rnd(0, TAU), e = rnd(-.2, 1), s = spd * rnd(.4, 1); Object.assign(p.userData, { vx: Math.cos(a) * s * (1 - Math.abs(e) * .3), vy: e * s + up, vz: Math.sin(a) * s * (1 - Math.abs(e) * .3), life, max: life, grav, rx: rnd(-8, 8), ry: rnd(-8, 8) });
    FX.parts.push(p);
  }
}
export function tracer(a, b, color = 0xfff2a0, life = .09) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true })); l.frustumCulled = false; scene.add(l); FX.tracers.push({ l, life, max: life });
}
export function ring(pos, color = 0xffffff, r = 1.2, life = .4) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.7, 1, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false })); m.position.copy(pos); m.lookAt(camera.position); scene.add(m); FX.rings.push({ m, r, life, max: life });
}
export function updateFX(dt) {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i], u = p.userData; u.life -= dt; if (u.life <= 0) { p.visible = false; FX.free.push(p); FX.parts.splice(i, 1); continue; }
    u.vy -= u.grav * dt; p.position.x += u.vx * dt; p.position.y += u.vy * dt; p.position.z += u.vz * dt; if (p.position.y < .05) { p.position.y = .05; u.vy *= -.35; u.vx *= .7; u.vz *= .7; } p.rotation.x += u.rx * dt; p.rotation.y += u.ry * dt; p.scale.multiplyScalar(1 - dt * .5);
  }
  for (let i = FX.tracers.length - 1; i >= 0; i--) { const t = FX.tracers[i]; t.life -= dt; t.l.material.opacity = Math.max(0, t.life / t.max); if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); FX.tracers.splice(i, 1); } }
  for (let i = FX.rings.length - 1; i >= 0; i--) { const b = FX.rings[i]; b.life -= dt; const k = 1 - b.life / b.max; b.m.scale.setScalar(.3 + k * b.r); b.m.material.opacity = .9 * (1 - k); if (b.life <= 0) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); FX.rings.splice(i, 1); } }
}

// ------------------------------------------------------------------ audio (all synthesized)
let AC = null, master = null, noiseBuf = null;
export function audioInit() { if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = S.vol; master.connect(AC.destination); noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; } }
export function setVolume(v) { S.vol = v; if (master) master.gain.value = v; }
function tone(f1, f2, dur, type = 'square', vol = .3, delay = 0) { if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); }
function noise(dur, vol = .4, f = 3000, q = 1, delay = 0) { if (!AC) return; const t = AC.currentTime + delay, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(Math.max(100, f / 6), t + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * .5, dur + .05); }
const SFX = {
  ar: v => { tone(1100, 240, .08, 'square', .2 * v); tone(300, 120, .05, 'sawtooth', .12 * v); noise(.06, .3 * v, 5500); },
  smg: v => { tone(1500, 380, .05, 'square', .15 * v); noise(.04, .24 * v, 6000); },
  pump: v => { tone(200, 50, .24, 'sawtooth', .36 * v); noise(.22, .6 * v, 2500); tone(520, 300, .08, 'square', .1 * v, .3); },
  sniper: v => { tone(2200, 90, .35, 'sawtooth', .28 * v); noise(.34, .5 * v, 7000); tone(300, 40, .5, 'sine', .3 * v); },
  swing: v => noise(.1, .18 * v, 2600), pickhit: v => { tone(900, 500, .05, 'square', .16 * v); noise(.05, .22 * v, 4000); },
  build: v => { tone(180, 120, .09, 'triangle', .26 * v); noise(.06, .22 * v, 1800); }, buildDone: v => tone(520, 760, .07, 'triangle', .1 * v),
  breakp: v => { noise(.25, .5 * v, 3200); tone(140, 60, .2, 'sawtooth', .22 * v); }, harvest: v => { tone(700, 1100, .08, 'triangle', .2 * v); noise(.05, .18 * v, 3000); },
  edit: () => tone(900, 1100, .05, 'square', .1), confirm: () => { tone(600, 900, .08, 'triangle', .2); tone(900, 1300, .08, 'triangle', .18, .07); },
  hit: () => tone(1200, 1000, .05, 'square', .14), head: () => { tone(1800, 1500, .06, 'square', .18); tone(2400, 2000, .08, 'square', .14, .05); },
  shieldhit: () => tone(1400, 1700, .05, 'sine', .16), kill: () => { tone(500, 900, .1, 'square', .2); tone(800, 1400, .14, 'square', .2, .08); noise(.18, .25, 4000); },
  hurt: () => tone(200, 90, .18, 'sawtooth', .28), jump: () => tone(280, 520, .08, 'triangle', .1), land: v => noise(.06, .12 * v, 900),
  empty: () => tone(180, 140, .05, 'square', .1), reload: v => { tone(300, 600, .08, 'square', .12 * v); tone(500, 800, .06, 'square', .12 * v, .35); }, swap: () => noise(.05, .12, 2000),
  pick: () => { tone(600, 1200, .12, 'triangle', .26); tone(900, 1800, .12, 'triangle', .22, .08); }, bye: () => tone(400, 70, .6, 'sawtooth', .3),
  win: () => { tone(520, 780, .14, 'triangle', .25); tone(780, 1040, .14, 'triangle', .25, .14); tone(1040, 1560, .3, 'triangle', .25, .28); }, lose: () => { tone(400, 260, .25, 'triangle', .22); tone(300, 180, .4, 'triangle', .22, .22); },
  tick: () => tone(1400, 1400, .03, 'square', .05), go: () => { tone(700, 1400, .15, 'square', .2); },
};
export const listener = new V3();
export const sfx = (k, v = 1) => { if (AC && SFX[k]) SFX[k](v); };
export const sfxAt = (k, pos) => sfx(k, clamp(1 - pos.distanceTo(listener) / 70, .1, 1));

// ------------------------------------------------------------------ world state shared by the other modules
export const W = { time: 0, state: 'menu', M: null, me: null, actors: [], dummies: [] };

// adaptive resolution keeps the framerate smooth on slower GPUs
let perfT = 0, perfN = 0, lastRaise = -99;
export function adaptRes(raw, active) {
  if (raw > .25) return; perfT += raw; perfN++; if (perfT < 1.5) return;
  const avg = perfT / perfN; perfT = perfN = 0; if (!active) return;
  if (avg > .0215 && R.scale > QL.min) { R.scale = Math.max(QL.min, R.scale - .12); if (W.time - lastRaise < 12) R.ceil = R.scale; resize(); }
  else if (avg < .0185 && R.scale < R.ceil) { R.scale = Math.min(R.ceil, R.scale + .06); lastRaise = W.time; resize(); }
}
