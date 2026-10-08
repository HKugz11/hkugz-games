// BLASTER ARENA - stylized arena shooter vs bots (Three.js). No blood: robots pop into confetti.
import * as THREE from './three.module.min.js';
const V3 = THREE.Vector3, $ = id => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.floor(Math.random() * a.length)];
const load = (k, d) => { try { const v = localStorage.getItem('ba.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem('ba.' + k, JSON.stringify(v)); } catch (e) {} };
const S = { sens: load('sens', 1), fov: load('fov', 85), vol: load('vol', 0.7), diff: load('diff', 'normal') };
const DIFF = {
  easy:   { bots: 4, hp: 70,  aim: 0.085, react: 0.75, dmg: 5,  speed: 3.6, fire: 0.36, turn: 5, nade: 22, nades: ['frag'] },
  normal: { bots: 5, hp: 100, aim: 0.05,  react: 0.45, dmg: 7,  speed: 4.4, fire: 0.25, turn: 7, nade: 13, nades: ['frag', 'frag', 'molly', 'flash'] },
  hard:   { bots: 6, hp: 120, aim: 0.026, react: 0.25, dmg: 9,  speed: 5.3, fire: 0.18, turn: 10, nade: 8, nades: ['frag', 'molly', 'flash', 'flash', 'frag'] },
};
const TARGET = 25, G = 22, STEP = 0.6;
const BOT_COLORS = [0xff7a1a, 0xff4fa8, 0x8aff3a, 0xb06bff, 0xffd31a, 0x2ee6ff];
const BOT_NAMES = ['Blip', 'Zorp', 'Chomp', 'Bolt', 'Pixel', 'Waffle'];

// ------------------------------------------------------------------ renderer / scenes
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
const BASE_PR = Math.min(devicePixelRatio, 1.75); let resScale = 1, resCeil = 1; renderer.autoClear = false; renderer.setPixelRatio(BASE_PR); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xbfe9ff, 45, 150);
const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 600); camera.rotation.order = 'YXZ'; scene.add(camera);
const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
function resize() { const w = innerWidth, h = innerHeight; renderer.setPixelRatio(BASE_PR * resScale); renderer.setSize(w, h, false); camera.aspect = vmCam.aspect = w / h; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
for (const sc of [scene, vmScene]) { sc.add(new THREE.HemisphereLight(0xcfeaff, 0x8a6ad0, 1.05)); }
const sun = new THREE.DirectionalLight(0xfff1d0, 2.3); sun.position.set(30, 50, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 }); sun.shadow.bias = -0.0004; scene.add(sun);
const vmSun = new THREE.DirectionalLight(0xffffff, 2.2); vmSun.position.set(1, 2, 1); vmScene.add(vmSun);

// toon look
const gradient = (() => { const d = new Uint8Array([90, 150, 210, 255]); const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (c, o = {}) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: gradient }, o));
const INK = new THREE.MeshBasicMaterial({ color: 0x120a24, side: THREE.BackSide });
function outline(mesh, k = 1.06) { const o = new THREE.Mesh(mesh.geometry, INK); o.scale.setScalar(k); mesh.add(o); return mesh; }

// sky dome + clouds
const clouds = [], balloons = [];
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f8cff) }, mid: { value: new THREE.Color(0x8fd8ff) }, bot: { value: new THREE.Color(0xfff0d8) } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h = clamp(p.y,-0.1,1.0); vec3 c = h<0.18 ? mix(bot, mid, smoothstep(-0.1,0.18,h)) : mix(mid, top, smoothstep(0.18,0.8,h)); float sun = pow(max(dot(p, normalize(vec3(0.5,0.8,0.35))),0.0), 220.0); gl_FragColor = vec4(c + vec3(1.0,0.9,0.6)*sun, 1.0); }' }));
  scene.add(sky);
  const cm = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient, fog: false });
  for (let i = 0; i < 16; i++) { const g = new THREE.Group(), n = rint(3, 5); for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(7, 12), 12, 8), cm); m.position.set(k * 9 - n * 4, rnd(-2, 2), rnd(-3, 3)); m.scale.y = .7; g.add(m); } const a = rnd(0, 6.28), r = rnd(120, 240); g.position.set(Math.cos(a) * r, rnd(45, 90), Math.sin(a) * r); g.userData.sp = rnd(.4, 1.2); scene.add(g); clouds.push(g); }
}

// ------------------------------------------------------------------ arena
const world = [];   // static AABBs used for collision + line of sight
function addBox(cx, cy, cz, sx, sy, sz, color, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), toon(color)); m.position.set(cx, cy, cz); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  if (o.edges !== false) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x1c1030 })));
  world.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minY: cy - sy / 2, maxY: cy + sy / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 }); return m;
}
const floorTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#8fe3c0'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#7fc8ff'; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64); x.strokeStyle = 'rgba(40,20,90,.28)'; x.lineWidth = 4; x.strokeRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: gradient })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: 0x7a5ad0, fog: true })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; scene.add(ground);
const HALF = 32;
function buildArena() {
  for (const [x, z, sx, sz] of [[0, -HALF - 1, 2 * HALF + 4, 2], [0, HALF + 1, 2 * HALF + 4, 2], [-HALF - 1, 0, 2, 2 * HALF], [HALF + 1, 0, 2, 2 * HALF]]) addBox(x, 4, z, sx, 8, sz, 0x3a2f78);
  for (const [x, z, sx, sz, c] of [[0, -HALF + .08, 2 * HALF, .1, 0x2ee6ff], [0, HALF - .08, 2 * HALF, .1, 0xff4fa8], [-HALF + .08, 0, .1, 2 * HALF, 0xffd31a], [HALF - .08, 0, .1, 2 * HALF, 0x8aff3a]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, .35, sz), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, .6, z); scene.add(m); const t = new THREE.Mesh(new THREE.BoxGeometry(sx, .35, sz), new THREE.MeshBasicMaterial({ color: c })); t.position.set(x, 5.2, z); scene.add(t); }
  addBox(0, .7, 0, 12, 1.4, 12, 0xf2e6ff);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (const [off, h] of [[7.4, 1.0], [8.9, .5]]) { const cx = dx * off, cz = dz * off, sx = dx ? 1.5 : 5, sz = dz ? 1.5 : 5; addBox(cx, h / 2, cz, sx, h, sz, h > .7 ? 0xd9c4ff : 0xc4a8ff); }
  addBox(0, 1.4 + 1.6, 0, 3, 3.2, 3, 0xff4fa8);
  for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) addBox(x, 1.4 + .6, z, 2, 1.2, 1, 0xffd31a);
  const crates = [[-15, -10, 3, 2, 3, 0xff6a5a], [-15, 10, 3, 2, 3, 0xffd34e], [15, -10, 3, 2, 3, 0x4adfa0], [15, 10, 3, 2, 3, 0x6ab0ff], [0, -19, 7, 2.2, 2, 0xb06bff], [0, 19, 7, 2.2, 2, 0xff8a3a],
    [-21, 0, 2, 3.5, 7, 0x4a6aff], [21, 0, 2, 3.5, 7, 0xff4fa8], [-9, -25, 3, 1.5, 3, 0x2ee6ff], [9, 25, 3, 1.5, 3, 0xff6a5a], [-24, -19, 3, 3, 3, 0xffd34e], [24, 19, 3, 3, 3, 0x8aff3a],
    [-25, 20, 4, 1.2, 4, 0xb06bff], [25, -20, 4, 1.2, 4, 0x6ab0ff], [-9, 14, 2, 1.4, 2, 0xff8a3a], [9, -14, 2, 1.4, 2, 0x4adfa0], [-13, -3, 1.5, 1.2, 4, 0xff4fa8], [13, 3, 1.5, 1.2, 4, 0xffd34e], [-26, 8, 2, 2, 2, 0x4adfa0], [26, -8, 2, 2, 2, 0xff6a5a]];
  for (const [x, z, sx, sy, sz, c] of crates) addBox(x, sy / 2, z, sx, sy, sz, c);
  // decorative floating balloons / pillars (no collision)
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = 28; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), toon(BOT_COLORS[i % 6])); m.position.set(Math.cos(a) * r, 8 + (i % 3) * 1.4, Math.sin(a) * r); outline(m, 1.08); scene.add(m); balloons.push(m); }
}
buildArena();
const SPAWNS = [[-27, -27], [27, -27], [-27, 27], [27, 27], [0, -28], [0, 28], [-28, 0], [28, 0], [-12, -18], [12, 18]].map(([x, z]) => new V3(x, 0, z));
const WAYPOINTS = []; for (let x = -28; x <= 28; x += 4) for (let z = -28; z <= 28; z += 4) { const c = { pos: { x, y: 0, z }, r: .9, h: 1.7 }; if (!world.some(b => x + .9 > b.minX && x - .9 < b.maxX && z + .9 > b.minZ && z - .9 < b.maxZ && b.minY < 1.7)) WAYPOINTS.push(new V3(x, 0, z)); }

// ------------------------------------------------------------------ physics + rays
const overlaps = (e, b) => e.pos.x + e.r > b.minX && e.pos.x - e.r < b.maxX && e.pos.z + e.r > b.minZ && e.pos.z - e.r < b.maxZ && e.pos.y + e.h > b.minY && e.pos.y < b.maxY;
function moveEntity(e, dt) {
  e.pos.x += e.vel.x * dt;
  for (const b of world) if (overlaps(e, b)) { if (b.maxY - e.pos.y <= STEP && e.onGround) e.pos.y = b.maxY; else { e.pos.x = e.vel.x > 0 ? b.minX - e.r - 1e-3 : b.maxX + e.r + 1e-3; e.vel.x = 0; e.blocked = true; } }
  e.pos.z += e.vel.z * dt;
  for (const b of world) if (overlaps(e, b)) { if (b.maxY - e.pos.y <= STEP && e.onGround) e.pos.y = b.maxY; else { e.pos.z = e.vel.z > 0 ? b.minZ - e.r - 1e-3 : b.maxZ + e.r + 1e-3; e.vel.z = 0; e.blocked = true; } }
  e.vel.y -= G * dt; e.pos.y += e.vel.y * dt; e.onGround = false;
  for (const b of world) if (overlaps(e, b)) { if (e.vel.y <= 0) { e.pos.y = b.maxY; e.vel.y = 0; e.onGround = true; } else { e.pos.y = b.minY - e.h - 1e-3; e.vel.y = 0; } }
  if (e.pos.y <= 0) { e.pos.y = 0; if (e.vel.y < 0) e.vel.y = 0; e.onGround = true; }
}
function rayBox(o, d, b) {
  let tmin = 0, tmax = Infinity;
  for (const [oa, da, mn, mx] of [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.minY, b.maxY], [o.z, d.z, b.minZ, b.maxZ]]) {
    if (Math.abs(da) < 1e-9) { if (oa < mn || oa > mx) return Infinity; } else { let t1 = (mn - oa) / da, t2 = (mx - oa) / da; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  }
  return tmin;
}
const worldT = (o, d, max = 220) => { let best = max; for (const b of world) { const t = rayBox(o, d, b); if (t < best) best = t; } return best; };
function raySphere(o, d, c, r) { const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc; if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t >= 0 ? t : (-b + Math.sqrt(disc) >= 0 ? 0 : Infinity); }
function hitEntity(o, d, e, headY) { const bb = { minX: e.pos.x - e.r, maxX: e.pos.x + e.r, minY: e.pos.y, maxY: e.pos.y + headY - .25, minZ: e.pos.z - e.r, maxZ: e.pos.z + e.r }; const tb = rayBox(o, d, bb), th = raySphere(o, d, new V3(e.pos.x, e.pos.y + headY, e.pos.z), .3); if (th === Infinity && tb === Infinity) return null; return th <= tb ? { t: th, head: true } : { t: tb, head: false }; }

// ------------------------------------------------------------------ audio (all synthesized)
let AC = null, master = null, noiseBuf = null;
function audioInit() { if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = S.vol; master.connect(AC.destination); noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; } }
function tone(f1, f2, dur, type = 'square', vol = .3, delay = 0) { if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); }
function noise(dur, vol = .4, f = 3000, q = 1, delay = 0) { if (!AC) return; const t = AC.currentTime + delay, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(Math.max(100, f / 6), t + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * .5, dur + .05); }
const SFX = {
  pop: v => { tone(900, 160, .13, 'square', .26 * v); noise(.08, .3 * v, 5000); }, zip: v => { tone(700, 220, .07, 'square', .17 * v); noise(.05, .22 * v, 6000); },
  boom: v => { tone(180, 50, .3, 'sawtooth', .35 * v); noise(.28, .6 * v, 2500); }, zap: v => { tone(2200, 90, .35, 'sawtooth', .28 * v); noise(.3, .4 * v, 7000); tone(300, 40, .5, 'sine', .3 * v); },
  kab: v => { tone(260, 70, .25, 'triangle', .35 * v); noise(.2, .4 * v, 1800); }, explode: v => { noise(.7, .8 * v, 1500); tone(110, 30, .6, 'sawtooth', .4 * v); },
  bot: v => { tone(520, 200, .09, 'square', .1 * v); noise(.05, .12 * v, 3000); }, reload: v => { tone(300, 600, .08, 'square', .12 * v); tone(500, 800, .06, 'square', .12 * v, .35); },
  hit: () => tone(1200, 1000, .05, 'square', .14), head: () => { tone(1800, 1500, .06, 'square', .18); tone(2400, 2000, .08, 'square', .14, .05); },
  kill: () => { tone(500, 900, .1, 'square', .2); tone(800, 1400, .14, 'square', .2, .08); noise(.18, .25, 4000); }, hurt: () => { tone(200, 90, .18, 'sawtooth', .28); },
  pick: () => { tone(600, 1200, .12, 'triangle', .26); tone(900, 1800, .12, 'triangle', .22, .08); }, swap: () => noise(.05, .12, 2000), empty: () => tone(180, 140, .05, 'square', .1),
  medal: () => { tone(660, 990, .12, 'triangle', .22); tone(990, 1480, .2, 'triangle', .22, .1); }, bye: () => { tone(400, 70, .6, 'sawtooth', .3); },
};
Object.assign(SFX, {
  throw: v => noise(.14, .2 * v, 2600), clink: v => tone(1900, 1300, .05, 'square', .08 * v), tick: () => tone(1400, 1400, .03, 'square', .05),
  heal: () => { tone(500, 900, .14, 'triangle', .24); tone(750, 1300, .2, 'triangle', .22, .1); }, shieldUp: () => { tone(300, 1200, .3, 'sine', .26); tone(600, 1800, .25, 'triangle', .16, .1); },
  flashbang: v => { noise(.3, .7 * v, 9000); tone(4800, 4300, 1.6, 'sine', .07 * v); }, smokePop: v => { noise(.5, .35 * v, 2200); tone(160, 80, .3, 'sine', .2 * v); }, glass: v => { noise(.2, .45 * v, 7000); tone(2600, 900, .12, 'square', .1 * v); }, sizzle: v => noise(.3, .09 * v, 1400),
});
const sfx = (k, v = 1) => { if (AC && SFX[k]) SFX[k](v); };

// ------------------------------------------------------------------ effects
const FX = { parts: [], tracers: [], blasts: [], free: [] };
const pGeo = new THREE.BoxGeometry(1, 1, 1);
function burst(pos, color, n = 12, spd = 6, size = .12, life = .8, grav = 14, up = 0) {
  for (let i = 0; i < n; i++) {
    let p = FX.free.pop(); if (!p) { p = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color })); scene.add(p); p.userData = {}; }
    p.material.color.set(color); p.visible = true; p.position.copy(pos); p.scale.setScalar(size * rnd(.6, 1.4));
    const a = rnd(0, 6.283), e = rnd(-.2, 1), s = spd * rnd(.4, 1); Object.assign(p.userData, { vx: Math.cos(a) * s * (1 - Math.abs(e) * .3), vy: e * s + up, vz: Math.sin(a) * s * (1 - Math.abs(e) * .3), life, max: life, grav, rx: rnd(-8, 8), ry: rnd(-8, 8) });
    FX.parts.push(p);
  }
}
function tracer(a, b, color = 0xfff2a0, life = .09) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true })); l.frustumCulled = false; scene.add(l); FX.tracers.push({ l, life, max: life });
}
function blast(pos, r, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .75 })); m.position.copy(pos); scene.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, side: THREE.DoubleSide })); ring.position.copy(pos); ring.rotation.x = -Math.PI / 2; ring.position.y = Math.max(.1, pos.y); scene.add(ring);
  FX.blasts.push({ m, ring, r, life: .45, max: .45 }); burst(pos, color, 26, 11, .2, .9, 12, 3); burst(pos, 0xffffff, 12, 8, .14, .6, 10, 2);
}
function updateFX(dt) {
  for (let i = FX.parts.length - 1; i >= 0; i--) { const p = FX.parts[i], u = p.userData; u.life -= dt; if (u.life <= 0) { p.visible = false; FX.free.push(p); FX.parts.splice(i, 1); continue; } u.vy -= u.grav * dt; p.position.x += u.vx * dt; p.position.y += u.vy * dt; p.position.z += u.vz * dt; if (p.position.y < .05) { p.position.y = .05; u.vy *= -.35; u.vx *= .7; u.vz *= .7; } p.rotation.x += u.rx * dt; p.rotation.y += u.ry * dt; p.scale.multiplyScalar(1 - dt * .5); }
  for (let i = FX.tracers.length - 1; i >= 0; i--) { const t = FX.tracers[i]; t.life -= dt; t.l.material.opacity = Math.max(0, t.life / t.max); if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); FX.tracers.splice(i, 1); } }
  for (let i = FX.blasts.length - 1; i >= 0; i--) { const b = FX.blasts[i]; b.life -= dt; const k = 1 - b.life / b.max; b.m.scale.setScalar(.3 + k * b.r * .8); b.m.material.opacity = .75 * (1 - k); b.ring.scale.setScalar(.5 + k * b.r * 1.3); b.ring.material.opacity = .9 * (1 - k); if (b.life <= 0) { scene.remove(b.m); scene.remove(b.ring); b.m.geometry.dispose(); b.m.material.dispose(); b.ring.geometry.dispose(); b.ring.material.dispose(); FX.blasts.splice(i, 1); } }
}

// ------------------------------------------------------------------ guns (viewmodels built from simple toon shapes)
function gbox(g, w, h, d, c, x, y, z, rot) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(c)); m.position.set(x, y, z); if (rot) m.rotation.set(...rot); outline(m, 1.0 + .03 / Math.max(.05, Math.min(w, h, d)) * .6); g.add(m); return m; }
function gcyl(g, r, len, c, x, y, z, glow) { const geo = new THREE.CylinderGeometry(r, r, len, 14); geo.rotateX(Math.PI / 2); const m = new THREE.Mesh(geo, glow ? new THREE.MeshBasicMaterial({ color: c }) : toon(c)); m.position.set(x, y, z); if (!glow) outline(m, 1.0 + .018 / r); g.add(m); return m; }
const GUNS = {
  pop() { const g = new THREE.Group(); gbox(g, .075, .1, .32, 0x23c4c4, 0, 0, 0); gbox(g, .07, .05, .3, 0xffffff, 0, .07, -.01); gcyl(g, .022, .12, 0x333a50, 0, .02, -.2); gbox(g, .07, .16, .08, 0xffd34e, 0, -.12, .08, [.25, 0, 0]); gbox(g, .02, .02, .02, 0xff4a4a, 0, .12, -.1); return { g, muzzle: new V3(0, .03, -.28) }; },
  zip() { const g = new THREE.Group(); gbox(g, .09, .12, .42, 0xff7a1a, 0, 0, 0); gbox(g, .08, .05, .3, 0x2a2a3a, 0, .085, -.02); gcyl(g, .025, .18, 0x2a2a3a, 0, .01, -.3); gbox(g, .07, .2, .1, 0x2a2a3a, 0, -.14, -.02, [.15, 0, 0]); gbox(g, .08, .15, .07, 0x2a2a3a, 0, -.1, .12, [.3, 0, 0]); gbox(g, .09, .1, .2, 0xffd34e, 0, -.01, .3); return { g, muzzle: new V3(0, .02, -.4) }; },
  boom() { const g = new THREE.Group(); gcyl(g, .04, .62, 0xb06bff, -.04, .03, -.15); gcyl(g, .04, .62, 0xb06bff, .04, .03, -.15); gbox(g, .14, .09, .16, 0xffd34e, 0, -.03, -.15); gbox(g, .1, .14, .3, 0xff8a3a, 0, -.05, .22); gbox(g, .08, .15, .09, 0x4a3a2a, 0, -.14, .08, [.3, 0, 0]); gbox(g, .11, .08, .22, 0x6a3a8a, 0, -.03, -.3); return { g, muzzle: new V3(0, .04, -.48) }; },
  zap() { const g = new THREE.Group(); gbox(g, .07, .1, .55, 0x8aff3a, 0, 0, .0); gcyl(g, .018, .5, 0x333a50, 0, .02, -.5); gcyl(g, .045, .26, 0x2a2a3a, 0, .12, -.05); gcyl(g, .04, .01, 0x2ee6ff, 0, .12, -.18, true); gbox(g, .09, .13, .3, 0x4a3a6a, 0, -.02, .38); gbox(g, .06, .16, .07, 0x2a2a3a, 0, -.12, .06, [.25, 0, 0]); gbox(g, .015, .04, .015, 0xff4a4a, 0, .06, -.74); return { g, muzzle: new V3(0, .02, -.78) }; },
  kab() { const g = new THREE.Group(); gcyl(g, .09, .55, 0xff4a4a, 0, .02, -.1); gcyl(g, .125, .14, 0xffd34e, 0, .02, -.4); gcyl(g, .06, .02, 0xff4fe0, 0, .02, -.47, true); gbox(g, .08, .15, .1, 0x2a2a3a, 0, -.14, .06, [.2, 0, 0]); gbox(g, .1, .1, .22, 0x2a2a3a, 0, -.01, .26); gbox(g, .07, .11, .14, 0xffd34e, 0, .12, -.05); return { g, muzzle: new V3(0, .02, -.52) }; },
};
const WDEF = [
  { id: 'pop', name: 'POP-GUN', mag: 12, dmg: 24, rate: .17, auto: false, spread: .003, reload: 1.1, kick: .06, pellets: 1, hs: 1.7, shake: .004 },
  { id: 'zip', name: 'ZIP SMG', mag: 32, dmg: 10, rate: .072, auto: true, spread: .02, reload: 1.5, kick: .02, pellets: 1, hs: 1.5, shake: .002 },
  { id: 'boom', name: 'BOOMER', mag: 6, dmg: 9, rate: .8, auto: false, spread: .05, reload: 2.0, kick: .15, pellets: 9, hs: 1.4, shake: .012 },
  { id: 'zap', name: 'ZAPPER', mag: 5, dmg: 82, rate: .95, auto: false, spread: .0004, hip: .035, reload: 2.1, kick: .13, pellets: 1, hs: 1.5, zoom: 22, shake: .01 },
  { id: 'kab', name: 'KABOOM', mag: 4, dmg: 78, rate: .85, auto: false, spread: 0, reload: 2.3, kick: .11, pellets: 1, proj: true, radius: 5.5, hs: 1, shake: .012 },
];
const VMS = .72;
const W = WDEF.map(d => { const o = GUNS[d.id](); o.g.scale.setScalar(VMS); o.muzzle.multiplyScalar(VMS); o.g.visible = false; vmScene.add(o.g); return { d, g: o.g, muzzle: o.muzzle, ammo: d.mag, cd: 0 }; });
const flash = new THREE.Mesh(new THREE.PlaneGeometry(.34, .34), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); vmScene.add(flash);
const flashLight = new THREE.PointLight(0xffd080, 0, 14); scene.add(flashLight);

// ------------------------------------------------------------------ player
const STAND_H = 1.75, CROUCH_H = 1.1, STAND_EYE = 1.6, CROUCH_EYE = .95;
const P = { pos: new V3(0, 0, 24), vel: new V3(), r: .35, h: STAND_H, eyeH: STAND_EYE, crouchK: 0, yaw: Math.PI, pitch: 0, onGround: true, hp: 100, shield: 0, alive: true, lastHurt: -99, kills: 0, deaths: 0, streak: 0, buffT: 0, respT: 0, shakeT: 0, blindT: 0, blindMax: 1 };
const eyePos = () => new V3(P.pos.x, P.pos.y + P.eyeH, P.pos.z);
const keys = {}; let mouseL = false, mouseR = false, firedThis = false, cur = 0, wantSwap = -1, swapT = 0, reloadT = 0, adsK = 0, vmKick = 0, vmBob = 0, time = 0, state = 'menu', started = false, killTimes = [], dmgInd = [];
let recP = 0, recY = 0, throwCD = 0, throwAnim = 0, useK = 0, stepOff = 0, lastPY = 0, fullHintT = -9, use = null, held = null;
const bots = [], projs = [], nades = [], smokes = [], fires = [];
const score = { me: 0, bots: 0 };
const hex = c => '#' + c.toString(16).padStart(6, '0');
function disposeObj(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material !== INK) c.material.dispose(); }); }

// ------------------------------------------------------------------ items: heals, shields, throwables
const ITEMS = {
  bandage: { name: 'BANDAGE',     code: 'KeyZ', key: 'Z', max: 8, use: 1.3, col: 0xffffff, kind: 'heal',   amt: 15,  cap: 75,  w: 22 },
  medkit:  { name: 'MEDKIT',      code: 'KeyX', key: 'X', max: 2, use: 3.2, col: 0xff4a5a, kind: 'heal',   amt: 100, cap: 100, w: 8 },
  mini:    { name: 'MINI SHIELD', code: 'KeyV', key: 'V', max: 5, use: 1.6, col: 0x4ad0ff, kind: 'shield', amt: 25,  cap: 50,  w: 20 },
  pot:     { name: 'BIG POT',     code: 'KeyB', key: 'B', max: 2, use: 3.0, col: 0x3a62ff, kind: 'shield', amt: 50,  cap: 100, w: 8 },
  frag:    { name: 'FRAG',        code: 'KeyG', key: 'G', max: 4, col: 0x58c24a, kind: 'nade', w: 14 },
  flash:   { name: 'FLASH',       code: 'KeyF', key: 'F', max: 4, col: 0xfff27a, kind: 'nade', w: 10 },
  smoke:   { name: 'SMOKE',       code: 'KeyQ', key: 'Q', max: 3, col: 0xc8d0dc, kind: 'nade', w: 8 },
  molly:   { name: 'MOLLY',       code: 'KeyE', key: 'E', max: 3, col: 0xff8a1a, kind: 'nade', w: 10 },
};
const ITEM_IDS = Object.keys(ITEMS), BY_CODE = {}; for (const id of ITEM_IDS) BY_CODE[ITEMS[id].code] = id;
const inv = {};
function resetInv() { for (const id of ITEM_IDS) inv[id] = 0; inv.bandage = 1; inv.frag = 1; inv.flash = 1; }
resetInv();
const LOOT_TOTAL = ITEM_IDS.reduce((s, id) => s + ITEMS[id].w, 0);
function rollLoot() { let r = Math.random() * LOOT_TOTAL; for (const id of ITEM_IDS) { r -= ITEMS[id].w; if (r <= 0) return { id, qty: id === 'bandage' ? rint(1, 3) : (id === 'mini' || id === 'frag') ? rint(1, 2) : 1 }; } return { id: 'bandage', qty: 1 }; }

function itemModel(id) {
  const g = new THREE.Group();
  const add = (geo, col, x = 0, y = 0, z = 0, glow = false, rot = null) => { const m = new THREE.Mesh(geo, glow ? new THREE.MeshBasicMaterial({ color: col }) : toon(col)); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); if (!glow) outline(m, 1.12); g.add(m); return m; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), C = (a, b, h, s = 14) => new THREE.CylinderGeometry(a, b, h, s), Sp = r => new THREE.SphereGeometry(r, 14, 10);
  switch (id) {
    case 'bandage': add(B(.5, .16, .34), 0xffffff); add(B(.3, .02, .09), 0xff4a5a, 0, .09, 0, true); add(B(.09, .02, .3), 0xff4a5a, 0, .09, 0, true); break;
    case 'medkit': add(B(.56, .38, .4), 0xff4a5a); add(B(.3, .02, .1), 0xffffff, 0, .2, 0, true); add(B(.1, .02, .3), 0xffffff, 0, .2, 0, true); break;
    case 'mini': add(Sp(.2), 0x4ad0ff); add(C(.06, .08, .16), 0xbfefff, 0, .25, 0); add(C(.07, .07, .06), 0xb87a3a, 0, .36, 0); break;
    case 'pot': add(Sp(.32), 0x3a62ff); add(C(.1, .13, .22), 0x9fc0ff, 0, .4, 0); add(C(.11, .11, .07), 0xb87a3a, 0, .55, 0); add(Sp(.09), 0xffffff, -.12, .14, .26, true); break;
    case 'frag': add(Sp(.2), 0x58c24a); add(C(.07, .07, .08), 0x9aa3b5, 0, .22, 0); add(B(.05, .2, .04), 0x9aa3b5, .06, .24, 0); add(new THREE.TorusGeometry(.07, .018, 6, 12), 0xffd34e, -.09, .27, 0, false, [0, Math.PI / 2, 0]); break;
    case 'flash': add(C(.15, .15, .42), 0xfff27a); add(C(.16, .16, .06), 0x2a2a3a, 0, .22, 0); add(C(.16, .16, .06), 0x2a2a3a, 0, -.22, 0); add(C(.155, .155, .05), 0x2a2a3a); break;
    case 'smoke': add(C(.17, .17, .5), 0xc8d0dc); add(C(.12, .17, .08), 0x2a2a3a, 0, .29, 0); add(C(.175, .175, .1), 0x7a869a, 0, -.05, 0); break;
    case 'molly': add(C(.17, .21, .34), 0xff8a1a); add(C(.06, .1, .2), 0xffb04a, 0, .26, 0); add(B(.06, .16, .02), 0xffffff, .02, .42, 0); add(Sp(.08), 0xffd34e, 0, .54, 0, true); break;
    default: { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.42), toon(0xff4fe0, { emissive: 0xff4fe0, emissiveIntensity: .5 })); outline(m, 1.12); g.add(m); }
  }
  return g;
}

// ------------------------------------------------------------------ pickups (loot spots + bot drops)
const pickups = [];
function addPickup(id, qty, x, y, z, o = {}) {
  const g = new THREE.Group(), core = new THREE.Group(); g.add(core);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.7, .85, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -.55; g.add(ring);
  g.position.set(x, y + 1.05, z); scene.add(g);
  const pk = { g, core, ring, id: null, qty: 0, x, y, z, t: 0, on: true, fixed: o.fixed || null, temp: !!o.temp, ttl: o.ttl || 0, col: 0xffffff, css: '#fff' };
  setPickup(pk, id, qty); pickups.push(pk); return pk;
}
function setPickup(pk, id, qty) {
  while (pk.core.children.length) { const c = pk.core.children[0]; pk.core.remove(c); disposeObj(c); }
  pk.id = id; pk.qty = qty; pk.col = id === 'dmg' ? 0xff4fe0 : ITEMS[id].col; pk.css = hex(pk.col);
  const m = itemModel(id); m.scale.setScalar(1.6); pk.core.add(m); pk.ring.material.color.setHex(pk.col); pk.on = true; pk.g.visible = true;
}
const LOOT_SPOTS = [[-11, -11], [11, 11], [-11, 11], [11, -11], [0, -12], [0, 12], [-25, 0], [25, 0], [-24, -26], [24, 26], [-18, 22], [18, -22], [-5, -27], [5, 27], [-22, 12], [22, -12], [0, -26], [0, 26]];
function buildPickups() {
  for (const [x, z] of LOOT_SPOTS) { if (world.some(b => b.minY < 1 && x > b.minX - .8 && x < b.maxX + .8 && z > b.minZ - .8 && z < b.maxZ + .8)) continue; const l = rollLoot(); addPickup(l.id, l.qty, x, 0, z); }
  addPickup('dmg', 1, 0, 1.4, 4.2, { fixed: 'dmg' }); addPickup('dmg', 1, 0, 1.4, -4.2, { fixed: 'dmg' });
}
buildPickups();
function dropLoot(pos) { if (Math.random() > .6 || pickups.filter(p => p.temp).length >= 12) return; const l = rollLoot(); addPickup(l.id, l.qty, pos.x, pos.y, pos.z, { temp: true, ttl: 30 }); }
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i]; pk.core.rotation.y += dt * 2; pk.g.position.y = pk.y + 1.05 + Math.sin(time * 3 + pk.x) * .12;
    if (pk.temp) { pk.ttl -= dt; if (pk.ttl < 5 && pk.on) pk.g.visible = Math.floor(pk.ttl * 6) % 2 === 0; if (pk.ttl <= 0 || !pk.on) { scene.remove(pk.g); disposeObj(pk.g); pickups.splice(i, 1); } continue; }
    if (!pk.on) { pk.t -= dt; if (pk.t <= 0) { if (pk.fixed) setPickup(pk, pk.fixed, 1); else { const l = rollLoot(); setPickup(pk, l.id, l.qty); } } }
  }
}
function collect(pk) {
  if (pk.id === 'dmg') { P.buffT = 12; feed('<b style="color:#ff8aff">DOUBLE DAMAGE!</b>'); showCenter('DOUBLE DAMAGE!', '#ff8aff'); }
  else {
    const it = ITEMS[pk.id], room = it.max - inv[pk.id];
    if (room <= 0) { if (time - fullHintT > 1.2) { fullHintT = time; hint(it.name + ' FULL', '#ffd34e'); } return; }
    const n = Math.min(room, pk.qty); inv[pk.id] += n; pk.qty -= n; feed(`<b style="color:${hex(it.col)}">+${n} ${it.name}</b>`); refreshItems();
    if (pk.qty > 0) { sfx('pick'); return; }
  }
  pk.on = false; pk.g.visible = false; pk.t = pk.fixed ? 35 : 24; sfx('pick'); burst(new V3(pk.x, pk.y + 1, pk.z), pk.col, 14, 5, .12, .7, 8, 2);
}

// ------------------------------------------------------------------ bot model
function makeBotModel(color) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mat = toon(color), dark = toon(0x2a2140), white = toon(0xf4f0ff);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .45, 4, 12), mat); torso.position.y = 1.0; torso.castShadow = true; outline(torso, 1.07); body.add(torso);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .12, 14), white); belly.position.y = .82; body.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), white); head.position.y = 1.62; head.castShadow = true; outline(head, 1.07); body.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.42, .17, .2), dark); visor.position.set(0, 1.64, -.2); body.add(visor);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x2ee6ff }); const e1 = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), eyeM), e2 = e1.clone(); e1.position.set(-.1, 1.65, -.3); e2.position.set(.1, 1.65, -.3); body.add(e1, e2);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .22, 6), dark); ant.position.set(0, 2.0, 0); const ball = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), mat); ball.position.set(0, 2.14, 0); body.add(ant, ball);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(.18, .5, .2), dark), legR = legL.clone(); legL.position.set(-.15, .25, 0); legR.position.set(.15, .25, 0); outline(legL, 1.08); outline(legR, 1.08); body.add(legL, legR);
  const arm = new THREE.Group(); arm.position.set(.34, 1.12, -.05); const gun = new THREE.Mesh(new THREE.BoxGeometry(.1, .12, .5), dark); gun.position.set(0, 0, -.28); outline(gun, 1.08); const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .22, 3, 8), mat); sleeve.rotation.x = Math.PI / 2; sleeve.position.set(0, 0, -.1); arm.add(gun, sleeve); body.add(arm);
  const bar = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(.9, .1), new THREE.MeshBasicMaterial({ color: 0x120a24, depthTest: false, transparent: true })), fg = new THREE.Mesh(new THREE.PlaneGeometry(.86, .06), new THREE.MeshBasicMaterial({ color: 0x4aff8a, depthTest: false })); fg.position.z = .001; bg.renderOrder = 10; fg.renderOrder = 11; bar.add(bg, fg); bar.position.y = 2.45; g.add(bar);
  return { g, body, torso, head, legL, legR, arm, mat, bar, fg, eyeM };
}

// ------------------------------------------------------------------ throwables: frag, flash, smoke, molly
const sfxAt = (k, pos) => sfx(k, clamp(1 - pos.distanceTo(P.pos) / 55, .12, 1));
function groundY(x, z, ymax) { let y = 0; for (const b of world) if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && b.maxY <= ymax + .3 && b.maxY > y) y = b.maxY; return y; }
function spawnNade(id, pos, vel, owner) {
  const m = itemModel(id); m.scale.setScalar(1.1); m.position.copy(pos); scene.add(m);
  nades.push({ id, m, pos: pos.clone(), vel: vel.clone(), owner, r: .17, age: 0, fuse: id === 'frag' ? 2.1 : id === 'flash' ? 1.3 : id === 'smoke' ? 1.7 : 3, spin: new V3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)) });
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i]; n.fuse -= dt; n.age += dt; let impact = 0; n.vel.y -= G * dt;
    for (const ax of ['x', 'y', 'z']) {
      const old = n.pos[ax]; n.pos[ax] += n.vel[ax] * dt;
      for (const b of world) if (n.pos.x > b.minX - n.r && n.pos.x < b.maxX + n.r && n.pos.y > b.minY - n.r && n.pos.y < b.maxY + n.r && n.pos.z > b.minZ - n.r && n.pos.z < b.maxZ + n.r) {
        impact = Math.max(impact, Math.abs(n.vel[ax])); n.pos[ax] = old; n.vel[ax] *= -.42; if (ax === 'y') { n.vel.x *= .75; n.vel.z *= .75; } break;
      }
    }
    let rolling = false;
    if (n.pos.y < n.r) { n.pos.y = n.r; if (n.vel.y < 0) { impact = Math.max(impact, -n.vel.y); n.vel.y *= -.38; n.vel.x *= .72; n.vel.z *= .72; if (n.vel.y < 1.2) n.vel.y = 0; } rolling = n.vel.y === 0; }
    if (rolling) { const f = Math.max(0, 1 - 2.4 * dt); n.vel.x *= f; n.vel.z *= f; }
    const sp = n.vel.length(), sk = Math.min(1, sp / 6); n.m.position.copy(n.pos); n.m.rotation.x += n.spin.x * dt * sk; n.m.rotation.y += n.spin.y * dt * sk; n.m.rotation.z += n.spin.z * dt * sk;
    if (impact > 3 && n.age > .05) sfxAt('clink', n.pos);
    let boom = n.fuse <= 0;
    if (n.id === 'molly' && impact > 2.5 && n.age > .08) boom = true;
    if (n.id === 'smoke' && n.age > .5 && rolling && Math.hypot(n.vel.x, n.vel.z) < .8) boom = true;
    if (boom) { const p = n.pos.clone(); scene.remove(n.m); disposeObj(n.m); nades.splice(i, 1); detonate(n.id, p, n.owner); }
  }
}
function detonate(id, p, owner) {
  if (id === 'frag') explodeAt(p, 6.5, 100, 75, owner);
  else if (id === 'flash') flashAt(p, owner);
  else if (id === 'smoke') deploySmoke(p);
  else ignite(p, owner);
}
function playerThrow(id) {
  if (state !== 'play' || !P.alive) return;
  if (use || throwCD > 0 || swapT > 0) return;
  if (inv[id] <= 0) { hint('NO ' + ITEMS[id].name, '#ff8a8a'); sfx('empty'); return; }
  inv[id]--; throwCD = .6; throwAnim = .35; refreshItems(); sfx('throw');
  const o = eyePos(), d = aimDir(0); let s = o.clone().addScaledVector(d, .7); s.y -= .15;
  if (worldT(o, d, .8) < .8) s = o.clone();
  const v = d.clone().multiplyScalar(19).add(new V3(P.vel.x * .5, 3.8, P.vel.z * .5));
  spawnNade(id, s, v, null);
}
function botThrow(b, id, tgt) {
  const from = new V3(b.pos.x, b.pos.y + 1.4, b.pos.z), sc = 1.1 + Math.hypot(tgt.x - from.x, tgt.z - from.z) * .07;
  const tx = tgt.x + rnd(-sc, sc), tz = tgt.z + rnd(-sc, sc), d = Math.hypot(tx - from.x, tz - from.z) || 1, dy = tgt.y - from.y;
  const v = clamp(Math.sqrt(G * d * d / Math.max(2, d - dy)), 7, 28), hx = (tx - from.x) / d, hz = (tz - from.z) / d, c = Math.SQRT1_2;
  b.yaw = Math.atan2(-hx, -hz);
  spawnNade(id, from.add(new V3(hx * .6, 0, hz * .6)), new V3(hx * v * c, v * c, hz * v * c), b); sfxAt('throw', b.pos);
}
function explodeAt(pos, R, botDmg, selfDmg, owner) {
  blast(pos, R, 0xff8a3a); const dp = pos.distanceTo(P.pos); sfx('explode', clamp(1 - dp / 60, .3, 1)); P.shakeT = Math.max(P.shakeT, .4 * clamp(1 - dp / 24, 0, 1));
  const src = pos.clone(); src.y += .3;
  if (!owner) {
    const mul = P.buffT > 0 ? 2 : 1;
    for (const b of bots) {
      if (!b.alive) continue; const c = new V3(b.pos.x, b.pos.y + 1, b.pos.z), d = c.distanceTo(pos);
      if (d < R && worldT(src, c.clone().sub(src).normalize(), d) >= d - .5) { const k = b.hurt(botDmg * mul * (1 - d / R * .75), false, true); showHit(k ? 'kill' : ''); if (!k) sfx('hit'); const push = c.sub(pos).setY(0).normalize().multiplyScalar(6); b.vel.x += push.x; b.vel.z += push.z; }
    }
  }
  if (P.alive) {
    const pc = new V3(P.pos.x, P.pos.y + 1, P.pos.z), d = pc.distanceTo(pos);
    if (d < R && worldT(src, pc.clone().sub(src).normalize(), d) >= d - .5) {
      const dmg = selfDmg * (1 - d / R * .85); if (dmg > 3) damagePlayer(dmg, owner, !owner);
      const push = pc.sub(pos).normalize().multiplyScalar(11 * (1 - d / R)); P.vel.x += push.x; P.vel.z += push.z; P.vel.y = Math.max(P.vel.y, push.y * .8 + 2);
    }
  }
}
function flashAt(pos, owner) {
  blast(pos, 3.2, 0xffffff); burst(pos, 0xffffff, 20, 9, .12, .5, 4, 1); sfx('flashbang', clamp(1 - pos.distanceTo(P.pos) / 60, .3, 1));
  const lp = pos.clone(); lp.y += .3;
  const power = (eye, fwd) => { const to = lp.clone().sub(eye), d = to.length(); if (d > 45) return 0; to.divideScalar(Math.max(d, .01)); if (d > 1 && worldT(eye, to, d) < d - .4) return 0; const f = fwd.dot(to); return (f > 0 ? .35 + .65 * f : .12) * clamp(1.15 - d / 42, .2, 1); };
  if (P.alive) { const p = power(eyePos(), aimDir(0)); if (p > .05) { P.blindMax = 4.4 * p + .4; P.blindT = Math.max(P.blindT, P.blindMax); } }
  if (!owner) {
    let n = 0;
    for (const b of bots) { if (!b.alive) continue; const f = new V3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw)), p = power(b.eye(), f); if (p > .08) { b.blindT = Math.max(b.blindT, 4.2 * p + .5); b.alertT = Math.max(b.alertT, 2); n++; } }
    if (n) { feed(`<b style="color:#fff27a">Flashed ${n} bot${n > 1 ? 's' : ''}!</b>`); showHit(''); sfx('hit'); }
  }
}
const puffGeo = new THREE.SphereGeometry(1, 14, 10);
function deploySmoke(pos) {
  const y = groundY(pos.x, pos.z, pos.y + .4), g = new THREE.Group(), puffs = [];
  const mat = new THREE.MeshToonMaterial({ color: 0xeaeef7, gradientMap: gradient, transparent: true, opacity: .94, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(puffGeo, mat), a = rnd(0, 6.283), r = Math.sqrt(Math.random()) * 2.6; m.position.set(Math.cos(a) * r, rnd(.4, 3.4), Math.sin(a) * r); m.userData = { s: rnd(1.5, 2.5), ph: rnd(0, 6.28) }; puffs.push(m); g.add(m); }
  g.position.set(pos.x, y, pos.z); scene.add(g); smokes.push({ g, mat, puffs, c: new V3(pos.x, y + 1.7, pos.z), R: 4.0, t: 0, life: 14 });
  sfxAt('smokePop', pos);
}
function updateSmokes(dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i]; s.t += dt; const grow = 1 - Math.pow(1 - Math.min(1, s.t / 1.1), 3), fade = s.t > s.life - 3 ? Math.max(0, (s.life - s.t) / 3) : 1;
    s.mat.opacity = .94 * fade; for (const p of s.puffs) p.scale.setScalar(p.userData.s * grow * (.9 + .1 * Math.sin(time * 1.6 + p.userData.ph)) * (.7 + .3 * fade));
    if (s.t >= s.life) { scene.remove(s.g); s.mat.dispose(); smokes.splice(i, 1); }
  }
}
function smokeBlocks(a, b) {
  if (!smokes.length) return false; const d = b.clone().sub(a), len = d.length(); d.divideScalar(len || 1);
  for (const s of smokes) { if (s.t < .5 || s.t > s.life - .8) continue; if (raySphere(a, d, s.c, s.R) < len) return true; }
  return false;
}
const discGeo = new THREE.CircleGeometry(1, 28), coneGeo = new THREE.ConeGeometry(.32, 1, 7);
function ignite(pos, owner) {
  const y = groundY(pos.x, pos.z, pos.y + .4), R = 3.3, g = new THREE.Group(); g.position.set(pos.x, y, pos.z);
  const mk = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
  const m1 = mk(0xff5a14, .5), m2 = mk(0xffb02a, .4), f1 = mk(0xff5a14, .92), f2 = mk(0xffb02a, .92), f3 = mk(0xffe46a, .92);
  const d1 = new THREE.Mesh(discGeo, m1), d2 = new THREE.Mesh(discGeo, m2); d1.rotation.x = d2.rotation.x = -Math.PI / 2; d1.scale.set(R, R, 1); d2.scale.set(R * .62, R * .62, 1); d1.position.y = .04; d2.position.y = .05; g.add(d1, d2);
  const flames = []; for (let i = 0; i < 18; i++) { const c = new THREE.Mesh(coneGeo, [f1, f2, f3][i % 3]), a = rnd(0, 6.283), r = Math.sqrt(Math.random()) * R * .92; c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); c.userData = { ph: rnd(0, 6.28), h: rnd(.9, 1.8) }; flames.push(c); g.add(c); }
  scene.add(g); fires.push({ g, pos: new V3(pos.x, y, pos.z), R, t: 0, life: 7.5, owner, tick: 0, ember: 0, snd: 0, flames, mats: [m1, m2, f1, f2, f3], d: [m1, m2] });
  burst(new V3(pos.x, y + .4, pos.z), 0xffa030, 16, 6, .16, .7, 6, 3); sfxAt('glass', pos);
}
function updateFires(dt) {
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i]; f.t += dt; const k = f.t > f.life - 1 ? Math.max(0, f.life - f.t) : Math.min(1, f.t / .25);
    f.d[0].opacity = .5 * k; f.d[1].opacity = .4 * k;
    for (const c of f.flames) { const u = c.userData, h = u.h * (.75 + .5 * Math.sin(time * 12 + u.ph)) * k + .001; c.scale.set(1, h, 1); c.position.y = h * .5; c.rotation.y += dt * 3; }
    f.ember -= dt; if (f.ember <= 0) { f.ember = .12; const a = rnd(0, 6.283), r = Math.sqrt(Math.random()) * f.R * .8; burst(new V3(f.pos.x + Math.cos(a) * r, f.pos.y + .4, f.pos.z + Math.sin(a) * r), 0xffa030, 1, 1.5, .1, .8, -3, 2.5); }
    f.snd -= dt; if (f.snd <= 0) { f.snd = .5; sfxAt('sizzle', f.pos); }
    f.tick += dt;
    while (f.tick >= .25) {
      f.tick -= .25;
      if (!f.owner) for (const b of bots) { if (!b.alive) continue; if (Math.hypot(b.pos.x - f.pos.x, b.pos.z - f.pos.z) < f.R && b.pos.y < f.pos.y + 1.4 && b.pos.y > f.pos.y - .8) { const kd = b.hurt(5, false, true); if (!kd) showHit(''); else showHit('kill'); } }
      if (P.alive && Math.hypot(P.pos.x - f.pos.x, P.pos.z - f.pos.z) < f.R && P.pos.y < f.pos.y + 1.4 && P.pos.y > f.pos.y - .8) damagePlayer(5, f.owner, !f.owner);
    }
    if (f.t >= f.life) { scene.remove(f.g); for (const m of f.mats) m.dispose(); fires.splice(i, 1); }
  }
}

// ------------------------------------------------------------------ bots
class Bot {
  constructor(i) {
    this.i = i; this.name = BOT_NAMES[i % 6]; this.color = BOT_COLORS[i % 6]; this.m = makeBotModel(this.color); scene.add(this.m.g);
    this.pos = new V3(); this.vel = new V3(); this.r = .38; this.h = 1.75; this.onGround = true; this.kills = 0; this.deaths = 0;
    this.yaw = rnd(0, 6.28); this.wp = null; this.alertT = 0; this.lastSeen = new V3(); this.saw = false; this.reactT = 0; this.cd = 0; this.burst = 0; this.pause = 0; this.strafe = Math.random() < .5 ? 1 : -1; this.strafeT = 0; this.stuckT = 0; this.lastP = new V3(); this.flashT = 0; this.barT = 0; this.invT = 0; this.alive = false; this.respT = rnd(.2, 1.5) + i * .4; this.m.g.visible = false;
    this.nadeT = 8; this.blindT = 0; this.hp = 100; this.maxHp = 100;
  }
  eye() { return new V3(this.pos.x, this.pos.y + 1.55, this.pos.z); }
  respawn() { const D = DIFF[S.diff]; let best = null, bd = -1; for (let k = 0; k < 4; k++) { const s = pick(SPAWNS); const d = s.distanceTo(P.pos) + rnd(0, 12); if (d > bd) { bd = d; best = s; } } this.pos.copy(best); this.vel.set(0, 0, 0); this.hp = D.hp; this.maxHp = D.hp; this.alive = true; this.m.g.visible = true; this.invT = 1.2; this.alertT = 0; this.saw = false; this.wp = null; this.blindT = 0; this.nadeT = rnd(5, D.nade); this.m.bar.visible = false; }
  hurt(dmg, head, byPlayer) {
    if (!this.alive || this.invT > 0) return false;
    this.hp -= dmg; this.flashT = .12; this.barT = 2.5; this.alertT = 5; this.lastSeen.copy(P.pos); this.saw = true;
    if (this.hp <= 0) { this.die(byPlayer); return true; } return false;
  }
  die(byPlayer) {
    this.alive = false; this.deaths++; this.m.g.visible = false; this.respT = 3; const c = this.eye(); burst(c, this.color, 26, 9, .2, 1.1, 12, 4); burst(c, 0xffffff, 12, 7, .14, .8, 12, 3); burst(c, 0xffd34e, 8, 6, .22, 1, 12, 5); blast(new V3(c.x, c.y - .4, c.z), 2.2, this.color);
    dropLoot(this.pos); sfx('kill'); if (byPlayer) playerKill(this);
  }
  update(dt) {
    const D = DIFF[S.diff];
    if (!this.alive) { this.respT -= dt; if (this.respT <= 0 && state !== 'over') this.respawn(); return; }
    this.invT -= dt; this.flashT -= dt; this.barT -= dt; this.alertT = Math.max(0, this.alertT - dt);
    const blind = this.blindT > 0; if (blind) this.blindT -= dt;
    const eye = this.eye(), pe = eyePos(), to = pe.clone().sub(eye), dist = to.length(); to.divideScalar(Math.max(dist, .001));
    const fwd = new V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), flat = new V3(to.x, 0, to.z).normalize(), dotF = fwd.dot(flat);
    const sees = P.alive && !blind && dist < 60 && (dotF > .25 || this.alertT > 0) && worldT(eye, to, dist) >= dist - .3 && !smokeBlocks(eye, pe);
    if (sees) { if (!this.saw) { this.saw = true; this.reactT = D.react * rnd(.8, 1.3); } this.alertT = 4; this.lastSeen.copy(P.pos); } else if (this.alertT <= 0) this.saw = false;
    let wish = new V3(), face = this.yaw, speed = D.speed;
    if (this.alertT > 0 && P.alive) {
      const t = sees ? P.pos : this.lastSeen, dx = t.x - this.pos.x, dz = t.z - this.pos.z, d2 = Math.hypot(dx, dz) || 1;
      face = Math.atan2(-dx, -dz); const dir = new V3(dx / d2, 0, dz / d2), right = new V3(-dir.z, 0, dir.x);
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = Math.random() < .5 ? 1 : -1; this.strafeT = rnd(.7, 1.8); }
      const want = sees ? (d2 > 18 ? 1 : d2 < 8 ? -.7 : 0) : 1; wish.addScaledVector(dir, want).addScaledVector(right, sees ? this.strafe * .9 : 0);
      if (!sees && d2 < 1.5) this.alertT = 0;
    } else {
      if (!this.wp || this.pos.distanceTo(this.wp) < 1.6) this.wp = pick(WAYPOINTS);
      const dx = this.wp.x - this.pos.x, dz = this.wp.z - this.pos.z, d2 = Math.hypot(dx, dz) || 1; face = Math.atan2(-dx, -dz); wish.set(dx / d2, 0, dz / d2); speed *= .75;
    }
    if (blind) { wish.set(Math.cos(time * 2.3 + this.i), 0, Math.sin(time * 2.9 + this.i)); face = this.yaw + Math.sin(time * 4 + this.i) * .6; speed *= .55; }
    // dodge the player's grenades and fire
    let fx = 0, fz = 0;
    for (const n of nades) if (!n.owner && (n.id === 'frag' || n.id === 'molly')) { const dx = this.pos.x - n.pos.x, dz = this.pos.z - n.pos.z, d = Math.hypot(dx, dz); if (d < 7 && n.fuse > .15) { fx += dx / (d + .2) * (8 - d); fz += dz / (d + .2) * (8 - d); } }
    for (const f of fires) if (!f.owner) { const dx = this.pos.x - f.pos.x, dz = this.pos.z - f.pos.z, d = Math.hypot(dx, dz); if (d < f.R + 1.5) { fx += dx / (d + .2) * 4; fz += dz / (d + .2) * 4; } }
    if (fx * fx + fz * fz > .01) { const m = Math.hypot(fx, fz); wish.set(fx / m, 0, fz / m); face = Math.atan2(-fx, -fz); speed *= 1.3; }
    let dy = face - this.yaw; while (dy > Math.PI) dy -= 6.2832; while (dy < -Math.PI) dy += 6.2832; this.yaw += dy * clamp(dt * D.turn, 0, 1);
    if (wish.lengthSq() > 0) wish.normalize();
    const ctl = this.onGround ? 14 : 3; this.vel.x += (wish.x * speed - this.vel.x) * clamp(ctl * dt, 0, 1); this.vel.z += (wish.z * speed - this.vel.z) * clamp(ctl * dt, 0, 1);
    this.blocked = false; moveEntity(this, dt);
    this.stuckT += dt; if (this.stuckT > .6) { if (this.pos.distanceTo(this.lastP) < .5 && wish.lengthSq() > 0) { if (this.onGround && Math.random() < .6) this.vel.y = 7; this.wp = null; this.strafe *= -1; } this.lastP.copy(this.pos); this.stuckT = 0; }
    // shooting
    if (sees) { this.reactT -= dt; this.pause -= dt; this.cd -= dt;
      if (this.reactT <= 0 && this.pause <= 0 && this.cd <= 0 && Math.abs(dy) < .35) this.shoot(eye, pe, dist, D); }
    // grenades
    if (this.alertT > 0 && P.alive && !blind) {
      this.nadeT -= dt;
      if (this.nadeT <= 0) { const tp = sees ? P.pos : this.lastSeen, d = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z); if (d > 8 && d < 32) { this.nadeT = rnd(D.nade * .7, D.nade * 1.4); botThrow(this, pick(D.nades), tp); } else this.nadeT = 1; }
    }
    // visuals
    const m = this.m; m.g.position.copy(this.pos); m.body.rotation.y = this.yaw; const sp = Math.hypot(this.vel.x, this.vel.z), ph = time * (6 + sp * 1.4);
    m.legL.rotation.x = Math.sin(ph) * .8 * Math.min(1, sp / 3); m.legR.rotation.x = -Math.sin(ph) * .8 * Math.min(1, sp / 3); m.body.position.y = Math.abs(Math.sin(ph)) * .06 * Math.min(1, sp / 3);
    m.arm.rotation.x = sees ? clamp(Math.atan2(pe.y - eye.y, dist), -.5, .5) : -.15; m.head.rotation.z = blind ? Math.sin(time * 9) * .3 : 0;
    const f = this.flashT > 0; m.torso.material.emissive.setHex(f ? 0xffffff : 0); m.torso.material.emissiveIntensity = f ? 1.2 : 0; m.eyeM.color.setHex(blind ? 0xffffff : this.alertT > 0 ? 0xff4a4a : 0x2ee6ff);
    m.bar.visible = this.barT > 0; if (m.bar.visible) { m.bar.quaternion.copy(camera.quaternion); m.fg.scale.x = Math.max(.001, this.hp / this.maxHp); m.fg.position.x = -(1 - this.hp / this.maxHp) * .43; }
  }
  shoot(eye, pe, dist, D) {
    if (this.burst <= 0) { this.burst = rint(2, 4); this.pause = rnd(.35, .9); return; }
    this.burst--; this.cd = D.fire;
    const tgt = new V3(P.pos.x, P.pos.y + P.h * .6, P.pos.z), dir = tgt.sub(eye).normalize(), err = D.aim * (1 + dist / 45);
    dir.x += rnd(-err, err); dir.y += rnd(-err, err) * .7; dir.z += rnd(-err, err); dir.normalize();
    const mz = new V3(eye.x + dir.x * .8 + Math.cos(this.yaw) * .3, eye.y - .35, eye.z + dir.z * .8 - Math.sin(this.yaw) * .3);
    const tw = worldT(eye, dir), hp = P.alive ? hitEntity(eye, dir, P, P.eyeH - .05) : null, end = hp && hp.t < tw ? hp.t : Math.min(tw, 70);
    tracer(mz, eye.clone().addScaledVector(dir, end), 0xff7a7a, .1); sfx('bot', clamp(1 - dist / 70, .15, 1) * .8);
    if (hp && hp.t < tw) damagePlayer(D.dmg * (hp.head ? 1.4 : 1), this);
  }
}

// ------------------------------------------------------------------ game logic
function damagePlayer(dmg, from, self = false) {
  if (!P.alive) return;
  let rem = dmg, absorbed = 0; if (P.shield > 0) { absorbed = Math.min(P.shield, rem); P.shield -= absorbed; rem -= absorbed; }
  P.hp -= rem; P.lastHurt = time; sfx('hurt'); P.shakeT = Math.max(P.shakeT, .25);
  const v = $('vig'); v.classList.toggle('sh', absorbed > 0 && rem <= 0); v.classList.add('on'); clearTimeout(damagePlayer.t); damagePlayer.t = setTimeout(() => v.classList.remove('on'), 120);
  if (from) dmgInd.push({ a: Math.atan2(-(from.pos.x - P.pos.x), -(from.pos.z - P.pos.z)), t: time });
  if (P.hp <= 0) {
    P.hp = 0; P.alive = false; P.deaths++; P.streak = 0; P.respT = 3; endUse(); mouseL = mouseR = false;
    if (self) { score.me = Math.max(0, score.me - 1); feed('<b style="color:#2ee6ff">You</b> popped <b>yourself</b>'); showCenter('OOPS! SELF-POP', '#ff6a8a'); }
    else { score.bots++; if (from) from.kills++; feed(`<b style="color:${from ? hex(from.color) : '#fff'}">${from ? from.name : 'Bot'}</b> popped <b style="color:#2ee6ff">you</b>`); showCenter(`POPPED BY ${from ? from.name.toUpperCase() : 'A BOT'}`, '#ff6a8a'); }
    sfx('bye'); updScore(); checkEnd();
  }
}
function playerKill(bot) {
  P.kills++; P.streak++; score.me++; updScore(); const now = time; killTimes = killTimes.filter(t => now - t < 4); killTimes.push(now);
  feed(`<b style="color:#2ee6ff">You</b> popped <b style="color:${hex(bot.color)}">${bot.name}</b>`);
  const multi = ['', '', 'DOUBLE POP!', 'TRIPLE POP!', 'QUAD POP!', 'MEGA POP!'][Math.min(5, killTimes.length)], streak = { 3: 'ON FIRE!', 5: 'UNSTOPPABLE!', 7: 'GODLIKE!', 10: 'LEGENDARY!' }[P.streak];
  if (streak) showCenter(streak, '#ffd34e'); else if (multi) showCenter(multi, '#7cecff'); if (streak || multi) sfx('medal');
  checkEnd();
}
function checkEnd() { if (state !== 'play') return; if (score.me >= TARGET || score.bots >= TARGET) endMatch(score.me >= TARGET); }
function feed(html) { const f = $('feed'), d = document.createElement('div'); d.innerHTML = html; f.appendChild(d); setTimeout(() => d.remove(), 4500); while (f.children.length > 5) f.firstChild.remove(); }
function showCenter(t, c) { const m = $('medal'); m.textContent = t; m.style.color = c; m.classList.remove('on'); void m.offsetWidth; m.classList.add('on'); }
function hint(t, c = '#fff') { const h = $('hint'); h.textContent = t; h.style.color = c; h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); }
function updScore() { $('sMe').textContent = score.me; $('sBots').textContent = score.bots; }
function spawnPlayer() {
  let best = null, bd = -1; for (const s of SPAWNS) { let md = 1e9; for (const b of bots) if (b.alive) md = Math.min(md, s.distanceTo(b.pos)); if (md > bd) { bd = md; best = s; } }
  P.pos.copy(best); P.vel.set(0, 0, 0); P.hp = 100; P.shield = 0; P.alive = true; P.yaw = Math.atan2(P.pos.x, P.pos.z); P.pitch = 0; P.crouchK = 0; P.h = STAND_H; P.eyeH = STAND_EYE; P.blindT = 0; P.buffT = 0;
  for (const w of W) { w.ammo = w.d.mag; w.cd = 0; } reloadT = 0; recP = recY = 0; stepOff = 0; lastPY = P.pos.y; throwCD = 0; endUse(); resetInv(); refreshItems(); refreshAmmo();
}
function clearHazards() {
  for (const n of nades) { scene.remove(n.m); disposeObj(n.m); } nades.length = 0;
  for (const s of smokes) { scene.remove(s.g); s.mat.dispose(); } smokes.length = 0;
  for (const f of fires) { scene.remove(f.g); for (const m of f.mats) m.dispose(); } fires.length = 0;
  for (let i = pickups.length - 1; i >= 0; i--) if (pickups[i].temp) { scene.remove(pickups[i].g); disposeObj(pickups[i].g); pickups.splice(i, 1); }
}
function startMatch() {
  for (const b of bots) scene.remove(b.m.g); bots.length = 0; for (const p of projs) scene.remove(p.m); projs.length = 0; clearHazards();
  const D = DIFF[S.diff]; for (let i = 0; i < D.bots; i++) bots.push(new Bot(i));
  score.me = score.bots = 0; P.kills = P.deaths = P.streak = 0; killTimes = []; $('feed').innerHTML = ''; updScore(); spawnPlayer(); cur = 0; wantSwap = -1; swapT = 0; selectWeapon(0, true);
  for (const pk of pickups) { if (pk.fixed) setPickup(pk, pk.fixed, 1); else { const l = rollLoot(); setPickup(pk, l.id, l.qty); } }
  state = 'play'; $('over').classList.add('hide'); $('menu').classList.add('hide'); $('pause').classList.add('hide');
}
function endMatch(win) {
  state = 'over'; endUse(); mouseL = mouseR = false; if (document.pointerLockElement) document.exitPointerLock(); $('over').classList.remove('hide'); $('overT').textContent = win ? 'VICTORY!' : 'DEFEAT'; $('overS').textContent = win ? `You reached ${TARGET} pops first. Nice shooting!` : 'The bots got there first. Rematch?';
  $('board').innerHTML = boardHTML(); sfx(win ? 'medal' : 'bye');
}
function boardHTML() { const rows = [{ n: 'YOU', k: P.kills, d: P.deaths, me: true }, ...bots.map(b => ({ n: b.name, k: b.kills, d: b.deaths }))].sort((a, b) => b.k - a.k); return '<tr><th></th><th>Pops</th><th>Popped</th></tr>' + rows.map(r => `<tr class="${r.me ? 'me' : ''}"><td>${r.n}</td><td>${r.k}</td><td>${r.d}</td></tr>`).join(''); }

// ---- weapons
function selectWeapon(i, instant) { if (i === cur && !instant) return; endUse(); if (!instant) { wantSwap = i; swapT = .22; sfx('swap'); } else { cur = i; W.forEach((w, k) => w.g.visible = k === i); } reloadT = 0; refreshAmmo(); refreshSlots(); }
function refreshSlots() { const s = $('slots'); if (!s.children.length) WDEF.forEach((d, i) => { const e = document.createElement('div'); e.innerHTML = `<b>${i + 1}</b>${d.name}`; s.appendChild(e); }); [...s.children].forEach((e, i) => e.classList.toggle('on', i === (wantSwap >= 0 ? wantSwap : cur))); }
function refreshAmmo() { const w = W[wantSwap >= 0 ? wantSwap : cur]; $('wName').textContent = w.d.name; $('aMag').textContent = w.ammo; $('rl').textContent = reloadT > 0 ? 'RELOADING...' : (w.ammo === 0 ? 'PRESS R' : ''); }
function startReload() { const w = W[cur]; if (use || reloadT > 0 || w.ammo >= w.d.mag || swapT > 0) return; reloadT = w.d.reload; sfx('reload'); refreshAmmo(); }
function aimDir(spread) { const d = new V3(0, 0, -1); const e = new THREE.Euler(P.pitch, P.yaw, 0, 'YXZ'); d.applyEuler(e); if (spread) { const r = new V3(1, 0, 0).applyEuler(e), u = new V3(0, 1, 0).applyEuler(e); const a = rnd(0, 6.283), m = Math.sqrt(Math.random()) * spread; d.addScaledVector(r, Math.cos(a) * m).addScaledVector(u, Math.sin(a) * m).normalize(); } return d; }
function muzzleWorld() { const w = W[cur], p = new V3(w.muzzle.x, w.muzzle.y, w.muzzle.z).add(vmBase); p.applyEuler(camera.rotation); return p.add(camera.position); }
let vmBase = new V3(.27, -.25, -.5);
function fire() {
  const w = W[cur], d = w.d; w.ammo--; w.cd = d.rate; vmKick = d.kick * 4; flash.material.opacity = 1; flashLight.intensity = 6; setTimeout(() => flashLight.intensity = 0, 50); sfx(d.id); refreshAmmo();
  const dmgMul = P.buffT > 0 ? 2 : 1; const o = eyePos(); const move = Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 8), sp = (adsK > .5 ? d.spread : (d.hip || d.spread)) * (1 + move * 2.5) * (adsK > .5 ? .5 : 1) * (P.onGround ? 1 : 2) * (1 - P.crouchK * .4);
  recP += rnd(.5, 1) * d.kick * .3 * (adsK > .5 ? .6 : 1); recY += rnd(-.5, .5) * d.kick * .12; P.shakeT = Math.max(P.shakeT, .08);
  for (const b of bots) if (b.alive && b.pos.distanceTo(P.pos) < 38) { b.alertT = Math.max(b.alertT, 3); b.lastSeen.copy(P.pos); }
  const mz = muzzleWorld();
  if (d.proj) { const dir = aimDir(0); const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 1), new THREE.MeshBasicMaterial({ color: 0xff4fe0 })); m.position.copy(mz); scene.add(m); outline(m, 1.3); projs.push({ m, v: dir.multiplyScalar(30), life: 4 }); return; }
  for (let i = 0; i < d.pellets; i++) {
    const dir = aimDir(sp); let tw = worldT(o, dir), hit = null, hb = null;
    for (const b of bots) { if (!b.alive || b.invT > 0) continue; const h = hitEntity(o, dir, b, 1.62); if (h && h.t < tw && (!hit || h.t < hit.t)) { hit = h; hb = b; } }
    const end = hit ? hit.t : Math.min(tw, 120), endP = o.clone().addScaledVector(dir, end);
    if (i < 3 || d.pellets === 1) tracer(mz, endP, d.id === 'zap' ? 0x7cffff : 0xfff2a0, d.id === 'zap' ? .22 : .08);
    if (hit) { const fall = d.pellets > 1 ? 1 - clamp((hit.t - 7) / 22, 0, .75) : 1; const dmg = d.dmg * dmgMul * fall * (hit.head ? d.hs : 1); const killed = hb.hurt(dmg, hit.head, true); burst(endP, hit.head ? 0xffd34e : 0xffffff, 6, 5, .1, .4, 10); showHit(killed ? 'kill' : hit.head ? 'head' : ''); if (!killed) sfx(hit.head ? 'head' : 'hit'); }
    else if (tw < 200) { burst(endP, 0xfff2a0, 4, 3, .08, .3, 8); }
  }
}
function showHit(kind) { const h = $('hit'); h.className = 'on ' + kind; clearTimeout(showHit.t); showHit.t = setTimeout(() => h.className = '', 90); }

// ---- consumables (heals + shields)
function buildItems() {
  const t = $('items'); t.innerHTML = '';
  ITEM_IDS.forEach((id, i) => { const it = ITEMS[id], c = document.createElement('div'); c.className = 'it' + (i === 4 ? ' gap' : ''); c.id = 'it_' + id; c.title = it.name; c.innerHTML = `<span class="k">${it.key}</span><i class="ic ic-${id}" style="--c:${hex(it.col)}"></i><span class="n" id="n_${id}">0</span>`; t.appendChild(c); });
}
function refreshItems() { for (const id of ITEM_IDS) { const el = $('it_' + id); if (!el) return; $('n_' + id).textContent = inv[id]; el.classList.toggle('empty', inv[id] <= 0); el.classList.toggle('using', !!use && use.id === id); } }
function startUse(id) {
  if (state !== 'play' || !P.alive) return; const it = ITEMS[id];
  if (use) { const same = use.id === id; endUse(); if (same) return; }
  if (inv[id] <= 0) { hint('NO ' + it.name, '#ff8a8a'); sfx('empty'); return; }
  if (it.kind === 'heal' && P.hp >= it.cap) { hint(P.hp >= 100 ? 'HEALTH FULL' : 'BANDAGES STOP AT 75 - USE A MEDKIT', '#ffd34e'); return; }
  if (it.kind === 'shield' && P.shield >= it.cap) { hint(P.shield >= 100 ? 'SHIELD FULL' : 'MINIS STOP AT 50 - USE A BIG POT', '#ffd34e'); return; }
  use = { id, t: 0, dur: it.use, tick: .1, pct: -1 }; reloadT = 0; refreshAmmo();
  held = itemModel(id); held.scale.setScalar(.6); vmScene.add(held);
  $('useLbl').textContent = 'USING ' + it.name; $('useFill').style.width = '0%'; $('useBar').classList.remove('hide'); refreshItems();
}
function endUse() { use = null; if (held) { vmScene.remove(held); disposeObj(held); held = null; } const b = $('useBar'); if (b) b.classList.add('hide'); refreshItems(); }
function finishUse() {
  const id = use.id, it = ITEMS[id]; inv[id]--;
  if (it.kind === 'heal') { P.hp = Math.max(P.hp, Math.min(it.cap, P.hp + it.amt)); sfx('heal'); feed(`<b style="color:#4aff8a">${it.name} used</b>`); }
  else { P.shield = Math.max(P.shield, Math.min(it.cap, P.shield + it.amt)); sfx('shieldUp'); feed(`<b style="color:#6ad0ff">${it.name} used</b>`); }
  const v = $('vig'); v.classList.add(it.kind === 'heal' ? 'heal' : 'shup'); setTimeout(() => v.classList.remove('heal', 'shup'), 260);
  burst(new V3(P.pos.x, P.pos.y + 1, P.pos.z), it.col, 12, 4, .1, .6, 4, 2); endUse();
}

// ---- per-frame updates
function updatePlayer(dt) {
  if (!P.alive) { P.respT -= dt; P.shakeT = 0; if (P.respT <= 0 && state === 'play') spawnPlayer(); return; }
  // crouch = Shift; stay low when there's no headroom to stand up
  let wantC = !!(keys.ShiftLeft || keys.ShiftRight);
  if (!wantC && P.crouchK > .02) { const probe = { pos: P.pos, r: P.r, h: STAND_H }; if (world.some(b => overlaps(probe, b))) wantC = true; }
  P.crouchK += ((wantC ? 1 : 0) - P.crouchK) * clamp(dt * 14, 0, 1); if (!wantC && P.crouchK < .02) P.crouchK = 0;
  P.h = STAND_H - (STAND_H - CROUCH_H) * P.crouchK; P.eyeH = STAND_EYE - (STAND_EYE - CROUCH_EYE) * P.crouchK;
  const fwd = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw)), wish = new V3();
  if (keys.KeyW) wish.add(fwd); if (keys.KeyS) wish.sub(fwd); if (keys.KeyD) wish.add(right); if (keys.KeyA) wish.sub(right); if (wish.lengthSq() > 0) wish.normalize();
  const sprint = keys.Tab && keys.KeyW && P.crouchK < .3 && !use;   // sprint = Tab (hold) + W
  const spd = (sprint ? 10.5 : 7.2) * (adsK > .5 ? .65 : 1) * (1 - .5 * P.crouchK) * (use ? .6 : 1), ctl = P.onGround ? 14 : 2.8;
  P.vel.x += (wish.x * spd - P.vel.x) * clamp(ctl * dt, 0, 1); P.vel.z += (wish.z * spd - P.vel.z) * clamp(ctl * dt, 0, 1);
  if (keys.Space && P.onGround && P.crouchK < .6) { P.vel.y = 7.6; P.onGround = false; }
  moveEntity(P, dt);
  P.buffT = Math.max(0, P.buffT - dt); throwCD = Math.max(0, throwCD - dt); throwAnim = Math.max(0, throwAnim - dt);
  for (const pk of pickups) { if (pk.on && Math.hypot(P.pos.x - pk.x, P.pos.z - pk.z) < 1.25 && Math.abs(P.pos.y - pk.y) < 1.8) collect(pk); }
  // weapon state
  const w = W[cur]; if (w.cd > 0) w.cd -= dt;
  if (swapT > 0) { swapT -= dt; if (swapT <= .11 && wantSwap >= 0) { cur = wantSwap; wantSwap = -1; W.forEach((x, k) => x.g.visible = k === cur); refreshAmmo(); refreshSlots(); } if (swapT <= 0) swapT = 0; }
  if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { w.ammo = w.d.mag; reloadT = 0; refreshAmmo(); } }
  if (use) { use.t += dt; use.tick -= dt; if (use.tick <= 0) { use.tick = .3; sfx('tick'); } const pct = Math.min(100, Math.floor(use.t / use.dur * 100)); if (pct !== use.pct) { use.pct = pct; $('useFill').style.width = pct + '%'; } if (use.t >= use.dur) finishUse(); }
  if (mouseL && !use && swapT <= 0 && reloadT <= 0 && w.cd <= 0) { if (w.ammo > 0) { if (w.d.auto || !firedThis) { fire(); firedThis = true; } } else if (!firedThis) { sfx('empty'); startReload(); firedThis = true; } }
  if (!mouseL) firedThis = false;
  // rockets
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.life -= dt; const step = p.v.clone().multiplyScalar(dt), len = step.length(), dir = step.clone().normalize(); const tw = worldT(p.m.position, dir, len + .3);
    let hitB = null; for (const b of bots) if (b.alive && b.invT <= 0) { const h = hitEntity(p.m.position, dir, b, 1.62); if (h && h.t < len + .3) hitB = b; }
    if (tw < len + .3 || hitB || p.life <= 0 || p.m.position.y < .1) { explodeAt(p.m.position.clone().addScaledVector(dir, Math.min(tw, len) * .9), 5.5, 78, 35, null); scene.remove(p.m); projs.splice(i, 1); }
    else { p.m.position.add(step); if (Math.random() < .6) burst(p.m.position, 0xff9ad8, 1, 1, .08, .3, 0); }
  }
}
function updateCamera(dt) {
  const w = W[cur], tgt = mouseR && P.alive && swapT <= 0 && reloadT <= 0 && !use ? 1 : 0; adsK += (tgt - adsK) * clamp(dt * 12, 0, 1);
  const wantFov = S.fov * (1 - adsK) + (w.d.zoom ? w.d.zoom : S.fov * .8) * adsK; if (Math.abs(wantFov - camera.fov) > .01) { camera.fov += (wantFov - camera.fov) * clamp(dt * 14, 0, 1); camera.updateProjectionMatrix(); }
  // recoil climbs smoothly instead of snapping
  const ap = recP * clamp(dt * 26, 0, 1), ay = recY * clamp(dt * 26, 0, 1); P.pitch += ap; P.yaw += ay; recP -= ap; recY -= ay; P.pitch = clamp(P.pitch, -1.5, 1.5);
  // step-ups teleport the player up a bit; ease the camera instead of popping
  const dyP = P.pos.y - lastPY; lastPY = P.pos.y; if (state === 'play' && P.alive && P.onGround && dyP > .12 && dyP <= STEP + .05) stepOff -= dyP; stepOff *= 1 - clamp(dt * 14, 0, 1);
  const sh = P.shakeT > 0 ? P.shakeT : 0; if (P.shakeT > 0) P.shakeT -= dt;
  const nx = Math.sin(time * 71) + Math.sin(time * 43 + 1), ny = Math.sin(time * 67 + 2) + Math.sin(time * 37), nr = Math.sin(time * 59 + 4);
  const y = P.alive ? P.pos.y + P.eyeH + stepOff : P.pos.y + .35;
  const bobAmp = P.alive && P.onGround ? Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 7) : 0; vmBob += dt * (6 + Math.hypot(P.vel.x, P.vel.z) * .8) * (bobAmp > 0 ? 1 : 0);
  camera.position.set(P.pos.x + nx * sh * .07, y + Math.sin(vmBob * 2) * .025 * bobAmp + ny * sh * .06, P.pos.z + nx * sh * .07);
  camera.rotation.set(P.pitch + ny * sh * .01, P.yaw, !P.alive ? Math.min(.5, (3 - P.respT) * .4) : nr * sh * .01);
  // viewmodel
  const g = w.g; vmKick = Math.max(0, vmKick - dt * 14); useK += ((use ? 1 : 0) - useK) * clamp(dt * 10, 0, 1);
  const sw = swapT > 0 ? Math.sin((swapT / .22) * Math.PI) : 0, rl = reloadT > 0 ? Math.sin((1 - reloadT / w.d.reload) * Math.PI) : 0, thr = throwAnim > 0 ? Math.sin((throwAnim / .35) * Math.PI) : 0;
  const base = new V3(.27 * (1 - adsK), -.25 * (1 - adsK) + (-.17) * adsK, -.5 * (1 - adsK) + (-.42) * adsK); vmBase.copy(base);
  g.position.set(base.x + Math.sin(vmBob) * .012 * bobAmp * (1 - adsK), base.y + Math.abs(Math.cos(vmBob)) * .01 * bobAmp * (1 - adsK) - sw * .35 - rl * .1 - useK * .5 - thr * .12, base.z + vmKick * .08 + rl * .05);
  g.rotation.set(vmKick * .09 - rl * .5 + sw * .6 + thr * .5 + useK * .4, 0, rl * .25 + Math.sin(vmBob) * .01 * bobAmp);
  if (held) { held.position.set(.04 + Math.sin(vmBob) * .01, -.62 + useK * .38 + Math.sin(time * 8) * .006, -.55); held.rotation.y += dt * 1.6; held.rotation.x = .3; }
  flash.position.copy(g.position).add(new V3(w.muzzle.x, w.muzzle.y, w.muzzle.z - .05)); flash.rotation.z += .7; flash.material.opacity = Math.max(0, flash.material.opacity - dt * 16); flash.visible = flash.material.opacity > .02 && adsK < .6;
  flashLight.position.copy(camera.position).add(new V3(0, 0, -1).applyEuler(camera.rotation));
  const scoped = w.d.zoom && adsK > .85; $('scope').classList.toggle('hide', !scoped); vmScene.visible = !scoped && P.alive && (state === 'play' || state === 'pause');
}
const hc = {}; const setTxt = (id, v) => { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } }, setSty = (id, k, v) => { const key = id + k; if (hc[key] !== v) { hc[key] = v; $(id).style[k] = v; } };
let hudT = 0;
function updateHUD(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 1 / 30;
  setTxt('hpNum', Math.ceil(P.hp)); setSty('hpFill', 'width', P.hp + '%'); $('hpFill').classList.toggle('low', P.hp < 35); $('vig').classList.toggle('low', P.hp < 35 && P.alive);
  setTxt('shNum', P.shield > 0 ? '+' + Math.ceil(P.shield) : ''); setSty('shFill', 'width', P.shield + '%');
  const w = W[cur]; setTxt('aMag', w.ammo); setTxt('rl', reloadT > 0 ? 'RELOADING...' : (w.ammo === 0 ? 'PRESS R' : ''));
  setTxt('buff', P.buffT > 0 ? `DOUBLE DAMAGE ${Math.ceil(P.buffT)}s` : '');
  const spread = (8 + Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 8) * 10 + (P.onGround ? 0 : 8) + w.d.spread * 500) * (1 - P.crouchK * .35) * (adsK > .5 ? .5 : 1), c = $('cross');
  const T = { t: [0, -spread], b: [0, spread], l: [-spread, 0], r: [spread, 0] };
  for (const key in T) setSty('cross_' + key, 'transform', `translate(${T[key][0].toFixed(1)}px,${T[key][1].toFixed(1)}px)`);
  c.style.opacity = w.d.zoom && adsK > .85 ? 0 : 1;
  // direction indicators
  dmgInd = dmgInd.filter(d => time - d.t < 1.2); const dir = $('dir');
  if (dmgInd.length || dir.children.length) { dir.innerHTML = ''; for (const d of dmgInd) { const i = document.createElement('i'); i.style.transform = `rotate(${(-(d.a - P.yaw) * 180 / Math.PI) + 180}deg)`; i.style.opacity = Math.max(0, 1 - (time - d.t) / 1.2); i.style.transition = 'none'; dir.appendChild(i); } }
  // radar
  const r = $('radar'), x = r.getContext('2d'), R = 132; x.clearRect(0, 0, 264, 264); x.save(); x.translate(R, R); x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(0, 0, R - 4, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, (R - 4) / 2, 0, 7); x.stroke();
  const rr = 40, sc = (R - 10) / rr, cs = Math.cos(P.yaw), sn = Math.sin(P.yaw);
  const dot = (wx, wz, col, rad) => { const dx = wx - P.pos.x, dz = wz - P.pos.z, rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; let px = rx * sc, py = rz * sc; const m = Math.hypot(px, py), lim = R - 10; if (m > lim) { px *= lim / m; py *= lim / m; } x.fillStyle = col; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill(); };
  for (const pk of pickups) if (pk.on) dot(pk.x, pk.z, pk.css, 4);
  for (const f of fires) dot(f.pos.x, f.pos.z, 'rgba(255,120,30,.8)', 7);
  for (const s of smokes) dot(s.c.x, s.c.z, 'rgba(230,236,246,.8)', 8);
  for (const b of bots) if (b.alive) dot(b.pos.x, b.pos.z, '#ff5a6a', 6);
  x.fillStyle = '#2ee6ff'; x.beginPath(); x.moveTo(0, -9); x.lineTo(7, 7); x.lineTo(-7, 7); x.closePath(); x.fill(); x.restore();
}

// ---- adaptive resolution: keeps the framerate (and so the mouse look) smooth on slower GPUs
let perfT = 0, perfN = 0, lastRaise = -99, fpsShown = 60, lastFo = -1;
function adaptRes(raw) {
  if (raw > .25) return;   // ignore tab-switch / alt-tab hiccups
  perfT += raw; perfN++; if (perfT < 1.5) return;
  const avg = perfT / perfN; fpsShown = 1 / avg; perfT = perfN = 0;
  const pe = $('perf'); if (pe) pe.textContent = `${Math.round(fpsShown)} fps · render quality ${Math.round(resScale * 100)}%`;
  if (state !== 'play') return;
  if (avg > .0215 && resScale > .5) { resScale = Math.max(.5, resScale - .12); if (time - lastRaise < 12) resCeil = resScale; resize(); }
  else if (avg < .0185 && resScale < resCeil) { resScale = Math.min(resCeil, resScale + .06); lastRaise = time; resize(); }
}
function step(dt) {
  time += dt; P.blindT = Math.max(0, P.blindT - dt);
  for (const c of clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 260) c.position.x = -260; } for (const [i, b] of balloons.entries()) b.position.y += Math.sin(time * 1.2 + i) * .004;
  updatePickups(dt);
  if (state === 'play') { updatePlayer(dt); for (const b of bots) b.update(dt); updateNades(dt); updateSmokes(dt); updateFires(dt); }
  else if (state === 'menu' || state === 'over') { const a = time * .12; P.pos.set(Math.cos(a) * 25, 7, Math.sin(a) * 25); P.yaw = Math.atan2(P.pos.x, P.pos.z); P.pitch = -.22; P.alive = true; P.vel.set(0, 0, 0); }
  const fo = P.blindT > 0 ? (P.blindT > P.blindMax * .45 ? 1 : P.blindT / (P.blindMax * .45)) : 0; if (fo !== lastFo) { lastFo = fo; $('flashfx').style.opacity = fo; }
  updateFX(dt); updateCamera(dt); if (state === 'play') updateHUD(dt);
}
function render() { renderer.clear(); renderer.render(scene, camera); if (vmScene.visible) { renderer.clearDepth(); vmCam.fov = 58; renderer.render(vmScene, vmCam); } }
let last = performance.now(), hudVis = null;
function loop(now) {
  const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; const hv = state === 'menu' ? 'hidden' : 'visible'; if (hv !== hudVis) { $('hud').style.visibility = hv; hudVis = hv; }
  step(dt); render(); adaptRes(raw); requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ input / menus
function lockPointer() {
  if (DEBUG) { onLock(true); return; } audioInit();
  try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { canvas.requestPointerLock(); } catch (e) {} }); } catch (e) { try { canvas.requestPointerLock(); } catch (e2) {} }
}
function onLock(locked) { if (locked) { audioInit(); if (!started) { started = true; startMatch(); } else if (state === 'pause') state = 'play'; $('pause').classList.add('hide'); $('menu').classList.add('hide'); } else if (state === 'play') { state = 'pause'; for (const k in keys) keys[k] = false; mouseL = mouseR = false; $('pause').classList.remove('hide'); } }
document.addEventListener('pointerlockchange', () => onLock(document.pointerLockElement === canvas));
document.addEventListener('pointerlockerror', () => { if (started && state === 'play') { state = 'pause'; $('pause').classList.remove('hide'); } });
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas && !DEBUG) return; if (state !== 'play' || !P.alive) return;
  if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;   // ignore the occasional bogus spike
  const k = .0022 * S.sens * (adsK > .5 ? (W[cur].d.zoom ? .3 : .7) : 1); P.yaw -= e.movementX * k; P.pitch -= e.movementY * k;
});
addEventListener('mousedown', e => { if (state !== 'play') return; if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (state !== 'play') return; selectWeapon((cur + (e.deltaY > 0 ? 1 : 4)) % 5); }, { passive: true });
addEventListener('keydown', e => {
  if (e.code === 'Tab' && state === 'play') e.preventDefault();   // Tab is sprint, don't let it move browser focus
  keys[e.code] = true;
  if (state !== 'play') return;
  if (e.code === 'KeyR') startReload();
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 5) selectWeapon(n); }
  if (e.code === 'KeyT') { $('board2').innerHTML = boardHTML(); $('board-screen').classList.remove('hide'); }
  if (e.code === 'Space') e.preventDefault();
  const id = BY_CODE[e.code]; if (id && !e.repeat) { if (ITEMS[id].kind === 'nade') playerThrow(id); else startUse(id); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyT') $('board-screen').classList.add('hide'); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; });
$('play').onclick = lockPointer; $('resume').onclick = lockPointer;
$('again').onclick = () => { $('over').classList.add('hide'); started = true; startMatch(); if (!DEBUG) lockPointer(); };
$('restart').onclick = () => { startMatch(); lockPointer(); };
for (const b of document.querySelectorAll('#diffRow button')) { b.classList.toggle('sel', b.dataset.d === S.diff); b.onclick = () => { S.diff = b.dataset.d; save('diff', S.diff); document.querySelectorAll('#diffRow button').forEach(x => x.classList.toggle('sel', x === b)); }; }
for (const [id, key, lab] of [['sens', 'sens', 'sensV'], ['fovR', 'fov', 'fovV'], ['vol', 'vol', 'volV']]) { const el = $(id); el.value = S[key]; $(lab).textContent = S[key]; el.oninput = () => { S[key] = +el.value; $(lab).textContent = S[key]; save(key, S[key]); if (key === 'vol' && master) master.gain.value = S.vol; }; }
if ('ontouchstart' in window && !matchMedia('(pointer:fine)').matches) { $('touchWarn').style.display = 'block'; $('play').style.display = 'none'; }
$('sTarget').textContent = TARGET; for (const key of ['t', 'b', 'l', 'r']) $('cross').querySelector('.' + key).id = 'cross_' + key; buildItems(); refreshItems(); refreshSlots(); refreshAmmo();
window.__ba = { P, bots, W, S, step, render, startMatch, selectWeapon, fire, get state() { return state; }, set mouse(v) { mouseL = v; }, shot: () => { step(0.001); render(); return canvas.toDataURL('image/png'); }, setState: s => state = s, score, world, hitEntity, pickups, DIFF, keys, inv, ITEMS, nades, smokes, fires, startUse, playerThrow, get use() { return use; }, resetInv, spawnNade, detonate, damagePlayer, get resScale() { return resScale; } };
requestAnimationFrame(loop);
