// BLASTER ARENA - stylized arena shooter vs bots (Three.js). No blood: robots pop into confetti.
import * as THREE from './three.module.min.js';
const V3 = THREE.Vector3, $ = id => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.floor(Math.random() * a.length)];
const load = (k, d) => { try { const v = localStorage.getItem('ba.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem('ba.' + k, JSON.stringify(v)); } catch (e) {} };
const S = { sens: load('sens', 1), fov: load('fov', 85), vol: load('vol', 0.7), diff: load('diff', 'normal') };
const DIFF = {
  easy:   { bots: 4, hp: 70,  aim: 0.085, react: 0.75, dmg: 5,  speed: 3.6, fire: 0.36, turn: 5 },
  normal: { bots: 5, hp: 100, aim: 0.05,  react: 0.45, dmg: 7,  speed: 4.4, fire: 0.25, turn: 7 },
  hard:   { bots: 6, hp: 120, aim: 0.026, react: 0.25, dmg: 9,  speed: 5.3, fire: 0.18, turn: 10 },
};
const TARGET = 25, G = 22, STEP = 0.6;
const BOT_COLORS = [0xff7a1a, 0xff4fa8, 0x8aff3a, 0xb06bff, 0xffd31a, 0x2ee6ff];
const BOT_NAMES = ['Blip', 'Zorp', 'Chomp', 'Bolt', 'Pixel', 'Waffle'];

// ------------------------------------------------------------------ renderer / scenes
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
renderer.autoClear = false; renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xbfe9ff, 45, 150);
const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 600); camera.rotation.order = 'YXZ'; scene.add(camera);
const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = vmCam.aspect = w / h; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); }
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
  for (let i = FX.blasts.length - 1; i >= 0; i--) { const b = FX.blasts[i]; b.life -= dt; const k = 1 - b.life / b.max; b.m.scale.setScalar(.3 + k * b.r * .8); b.m.material.opacity = .75 * (1 - k); b.ring.scale.setScalar(.5 + k * b.r * 1.3); b.ring.material.opacity = .9 * (1 - k); if (b.life <= 0) { scene.remove(b.m); scene.remove(b.ring); FX.blasts.splice(i, 1); } }
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
const P = { pos: new V3(0, 0, 24), vel: new V3(), r: .35, h: 1.75, yaw: Math.PI, pitch: 0, onGround: true, hp: 100, alive: true, lastHurt: -99, kills: 0, deaths: 0, streak: 0, buffT: 0, respT: 0, shakeT: 0 };
const eyePos = () => new V3(P.pos.x, P.pos.y + 1.6, P.pos.z);
const keys = {}; let mouseL = false, mouseR = false, firedThis = false, cur = 0, wantSwap = -1, swapT = 0, reloadT = 0, adsK = 0, vmKick = 0, vmBob = 0, time = 0, state = 'menu', started = false, killTimes = [], dmgInd = [];
const bots = [], projs = [];
const score = { me: 0, bots: 0 };

// ------------------------------------------------------------------ bots
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
class Bot {
  constructor(i) {
    this.i = i; this.name = BOT_NAMES[i % 6]; this.color = BOT_COLORS[i % 6]; this.m = makeBotModel(this.color); scene.add(this.m.g);
    this.pos = new V3(); this.vel = new V3(); this.r = .38; this.h = 1.75; this.onGround = true; this.kills = 0; this.deaths = 0;
    this.yaw = rnd(0, 6.28); this.wp = null; this.alertT = 0; this.lastSeen = new V3(); this.saw = false; this.reactT = 0; this.cd = 0; this.burst = 0; this.pause = 0; this.strafe = Math.random() < .5 ? 1 : -1; this.strafeT = 0; this.stuckT = 0; this.lastP = new V3(); this.flashT = 0; this.barT = 0; this.invT = 0; this.alive = false; this.respT = rnd(.2, 1.5) + i * .4; this.m.g.visible = false;
  }
  eye() { return new V3(this.pos.x, this.pos.y + 1.55, this.pos.z); }
  respawn() { const D = DIFF[S.diff]; let best = null, bd = -1; for (let k = 0; k < 4; k++) { const s = pick(SPAWNS); const d = s.distanceTo(P.pos) + rnd(0, 12); if (d > bd) { bd = d; best = s; } } this.pos.copy(best); this.vel.set(0, 0, 0); this.hp = D.hp; this.maxHp = D.hp; this.alive = true; this.m.g.visible = true; this.invT = 1.2; this.alertT = 0; this.saw = false; this.wp = null; this.m.mat.emissive?.setHex(0); this.m.bar.visible = false; }
  hurt(dmg, head, byPlayer) {
    if (!this.alive || this.invT > 0) return false;
    this.hp -= dmg; this.flashT = .12; this.barT = 2.5; this.alertT = 5; this.lastSeen.copy(P.pos); this.saw = true;
    if (this.hp <= 0) { this.die(byPlayer); return true; } return false;
  }
  die(byPlayer) {
    this.alive = false; this.deaths++; this.m.g.visible = false; this.respT = 3; const c = this.eye(); burst(c, this.color, 26, 9, .2, 1.1, 12, 4); burst(c, 0xffffff, 12, 7, .14, .8, 12, 3); burst(c, 0xffd34e, 8, 6, .22, 1, 12, 5); blast(new V3(c.x, c.y - .4, c.z), 2.2, this.color);
    sfx('kill'); if (byPlayer) playerKill(this);
  }
  update(dt) {
    const D = DIFF[S.diff];
    if (!this.alive) { this.respT -= dt; if (this.respT <= 0 && state !== 'over') this.respawn(); return; }
    this.invT -= dt; this.flashT -= dt; this.barT -= dt; this.alertT = Math.max(0, this.alertT - dt);
    const eye = this.eye(), pe = eyePos(), to = pe.clone().sub(eye), dist = to.length(); to.divideScalar(Math.max(dist, .001));
    const fwd = new V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), flat = new V3(to.x, 0, to.z).normalize(), dotF = fwd.dot(flat);
    const sees = P.alive && dist < 60 && (dotF > .25 || this.alertT > 0) && worldT(eye, to, dist) >= dist - .3;
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
    let dy = face - this.yaw; while (dy > Math.PI) dy -= 6.2832; while (dy < -Math.PI) dy += 6.2832; this.yaw += dy * clamp(dt * D.turn, 0, 1);
    if (wish.lengthSq() > 0) wish.normalize();
    const ctl = this.onGround ? 14 : 3; this.vel.x += (wish.x * speed - this.vel.x) * clamp(ctl * dt, 0, 1); this.vel.z += (wish.z * speed - this.vel.z) * clamp(ctl * dt, 0, 1);
    this.blocked = false; moveEntity(this, dt);
    this.stuckT += dt; if (this.stuckT > .6) { if (this.pos.distanceTo(this.lastP) < .5 && wish.lengthSq() > 0) { if (this.onGround && Math.random() < .6) this.vel.y = 7; this.wp = null; this.strafe *= -1; } this.lastP.copy(this.pos); this.stuckT = 0; }
    // shooting
    if (sees) { this.reactT -= dt; this.pause -= dt; this.cd -= dt;
      if (this.reactT <= 0 && this.pause <= 0 && this.cd <= 0 && Math.abs(dy) < .35) this.shoot(eye, pe, dist, D); }
    // visuals
    const m = this.m; m.g.position.copy(this.pos); m.body.rotation.y = this.yaw; const sp = Math.hypot(this.vel.x, this.vel.z), ph = time * (6 + sp * 1.4);
    m.legL.rotation.x = Math.sin(ph) * .8 * Math.min(1, sp / 3); m.legR.rotation.x = -Math.sin(ph) * .8 * Math.min(1, sp / 3); m.body.position.y = Math.abs(Math.sin(ph)) * .06 * Math.min(1, sp / 3);
    m.arm.rotation.x = sees ? clamp(Math.atan2(pe.y - eye.y, dist), -.5, .5) : -.15;
    const f = this.flashT > 0; m.torso.material.emissive.setHex(f ? 0xffffff : 0); m.torso.material.emissiveIntensity = f ? 1.2 : 0; m.eyeM.color.setHex(this.alertT > 0 ? 0xff4a4a : 0x2ee6ff);
    m.bar.visible = this.barT > 0; if (m.bar.visible) { m.bar.quaternion.copy(camera.quaternion); m.fg.scale.x = Math.max(.001, this.hp / this.maxHp); m.fg.position.x = -(1 - this.hp / this.maxHp) * .43; }
  }
  shoot(eye, pe, dist, D) {
    if (this.burst <= 0) { this.burst = rint(2, 4); this.pause = rnd(.35, .9); return; }
    this.burst--; this.cd = D.fire;
    const tgt = new V3(P.pos.x, P.pos.y + 1.05, P.pos.z), dir = tgt.sub(eye).normalize(), err = D.aim * (1 + dist / 45);
    dir.x += rnd(-err, err); dir.y += rnd(-err, err) * .7; dir.z += rnd(-err, err); dir.normalize();
    const mz = new V3(eye.x + dir.x * .8 + Math.cos(this.yaw) * .3, eye.y - .35, eye.z + dir.z * .8 - Math.sin(this.yaw) * .3);
    const tw = worldT(eye, dir), hp = P.alive ? hitEntity(eye, dir, P, 1.55) : null, end = hp && hp.t < tw ? hp.t : Math.min(tw, 70);
    tracer(mz, eye.clone().addScaledVector(dir, end), 0xff7a7a, .1); sfx('bot', clamp(1 - dist / 70, .15, 1) * .8);
    if (hp && hp.t < tw) damagePlayer(D.dmg * (hp.head ? 1.4 : 1), this);
  }
}

// ------------------------------------------------------------------ pickups
const pickups = [];
function addPickup(type, x, y, z) {
  const g = new THREE.Group(); const col = type === 'hp' ? 0x4aff8a : 0xff4fe0;
  const core = new THREE.Mesh(type === 'hp' ? new THREE.BoxGeometry(.5, .5, .5) : new THREE.OctahedronGeometry(.45), toon(col, { emissive: col, emissiveIntensity: .5 })); outline(core, 1.12); g.add(core);
  if (type === 'hp') { const a = new THREE.Mesh(new THREE.BoxGeometry(.62, .16, .16), toon(0xffffff)), b = new THREE.Mesh(new THREE.BoxGeometry(.16, .16, .62), toon(0xffffff)); a.position.y = b.position.y = .28; core.add(a, b); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(.7, .85, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -.55; g.add(ring);
  g.position.set(x, y + 1.05, z); scene.add(g); pickups.push({ g, core, type, x, y, z, t: 0, on: true });
}
function buildPickups() { for (const [x, z] of [[-11, -11], [11, 11], [-11, 11], [11, -11]]) addPickup('hp', x, 0, z); addPickup('dmg', 0, 1.4, 4.2); addPickup('dmg', 0, 0, -26); addPickup('hp', 0, 0, 0 - 12); addPickup('hp', -25, 0, 0); }
buildPickups();

// ------------------------------------------------------------------ game logic
function damagePlayer(dmg, from) {
  if (!P.alive) return; P.hp -= dmg; P.lastHurt = time; sfx('hurt'); $('vig').classList.add('on'); setTimeout(() => $('vig').classList.remove('on'), 120); P.shakeT = .25;
  if (from) { const a = Math.atan2(-(from.pos.x - P.pos.x), -(from.pos.z - P.pos.z)); dmgInd.push({ a, t: time }); }
  if (P.hp <= 0) { P.hp = 0; P.alive = false; P.deaths++; P.streak = 0; P.respT = 3; score.bots++; if (from) from.kills++; feed(`<b style="color:#${from ? from.color.toString(16).padStart(6, '0') : 'fff'}">${from ? from.name : 'Bot'}</b> popped <b style="color:#2ee6ff">you</b>`); sfx('bye'); $('medal').textContent = ''; showCenter(`POPPED BY ${from ? from.name.toUpperCase() : 'A BOT'}`, '#ff6a8a'); updScore(); checkEnd(); }
}
function playerKill(bot, label = 'ZAPPED') {
  P.kills++; P.streak++; score.me++; updScore(); const now = time; killTimes = killTimes.filter(t => now - t < 4); killTimes.push(now);
  feed(`<b style="color:#2ee6ff">You</b> popped <b style="color:#${bot.color.toString(16).padStart(6, '0')}">${bot.name}</b>`);
  const multi = ['', '', 'DOUBLE POP!', 'TRIPLE POP!', 'QUAD POP!', 'MEGA POP!'][Math.min(5, killTimes.length)], streak = { 3: 'ON FIRE!', 5: 'UNSTOPPABLE!', 7: 'GODLIKE!', 10: 'LEGENDARY!' }[P.streak];
  if (streak) showCenter(streak, '#ffd34e'); else if (multi) showCenter(multi, '#7cecff'); if (streak || multi) sfx('medal');
  if (P.kills % 3 === 0) P.hp = Math.min(100, P.hp + 15);
  checkEnd();
}
function checkEnd() { if (state !== 'play') return; if (score.me >= TARGET || score.bots >= TARGET) endMatch(score.me >= TARGET); }
function feed(html) { const f = $('feed'), d = document.createElement('div'); d.innerHTML = html; f.appendChild(d); setTimeout(() => d.remove(), 4500); while (f.children.length > 5) f.firstChild.remove(); }
let medalT = 0; function showCenter(t, c) { const m = $('medal'); m.textContent = t; m.style.color = c; m.classList.remove('on'); void m.offsetWidth; m.classList.add('on'); }
function updScore() { $('sMe').textContent = score.me; $('sBots').textContent = score.bots; }
function spawnPlayer() { let best = null, bd = -1; for (const s of SPAWNS) { let md = 1e9; for (const b of bots) if (b.alive) md = Math.min(md, s.distanceTo(b.pos)); if (md > bd) { bd = md; best = s; } } P.pos.copy(best); P.vel.set(0, 0, 0); P.hp = 100; P.alive = true; P.yaw = Math.atan2(-(0 - P.pos.x), -(0 - P.pos.z)); P.pitch = 0; for (const w of W) { w.ammo = w.d.mag; w.cd = 0; } reloadT = 0; P.buffT = 0; }
function startMatch() {
  for (const b of bots) { scene.remove(b.m.g); } bots.length = 0; for (const p of projs) scene.remove(p.m); projs.length = 0;
  const D = DIFF[S.diff]; for (let i = 0; i < D.bots; i++) bots.push(new Bot(i));
  score.me = score.bots = 0; P.kills = P.deaths = P.streak = 0; killTimes = []; $('feed').innerHTML = ''; updScore(); spawnPlayer(); cur = 0; selectWeapon(0, true); state = 'play'; $('over').classList.add('hide'); $('menu').classList.add('hide'); $('pause').classList.add('hide'); for (const pk of pickups) { pk.on = true; pk.g.visible = true; }
}
function endMatch(win) {
  state = 'over'; if (document.pointerLockElement) document.exitPointerLock(); $('over').classList.remove('hide'); $('overT').textContent = win ? 'VICTORY!' : 'DEFEAT'; $('overS').textContent = win ? `You reached ${TARGET} pops first. Nice shooting!` : 'The bots got there first. Rematch?';
  const rows = [{ n: 'YOU', k: P.kills, d: P.deaths, me: true }, ...bots.map(b => ({ n: b.name, k: b.kills, d: b.deaths }))].sort((a, b) => b.k - a.k);
  $('board').innerHTML = '<tr><th></th><th>Pops</th><th>Popped</th></tr>' + rows.map(r => `<tr class="${r.me ? 'me' : ''}"><td>${r.n}</td><td>${r.k}</td><td>${r.d}</td></tr>`).join(''); sfx(win ? 'medal' : 'bye');
}
function boardHTML() { const rows = [{ n: 'YOU', k: P.kills, d: P.deaths, me: true }, ...bots.map(b => ({ n: b.name, k: b.kills, d: b.deaths }))].sort((a, b) => b.k - a.k); return '<tr><th></th><th>Pops</th><th>Popped</th></tr>' + rows.map(r => `<tr class="${r.me ? 'me' : ''}"><td>${r.n}</td><td>${r.k}</td><td>${r.d}</td></tr>`).join(''); }

// weapons / shooting
function selectWeapon(i, instant) { if (i === cur && !instant) return; if (!instant) { wantSwap = i; swapT = .22; sfx('swap'); } else { cur = i; W.forEach((w, k) => w.g.visible = k === i); } reloadT = 0; refreshAmmo(); refreshSlots(); }
function refreshSlots() { const s = $('slots'); if (!s.children.length) WDEF.forEach((d, i) => { const e = document.createElement('div'); e.innerHTML = `<b>${i + 1}</b>${d.name}`; s.appendChild(e); }); [...s.children].forEach((e, i) => e.classList.toggle('on', i === (wantSwap >= 0 ? wantSwap : cur))); }
function refreshAmmo() { const w = W[wantSwap >= 0 ? wantSwap : cur]; $('wName').textContent = w.d.name; $('aMag').textContent = w.ammo; $('rl').textContent = reloadT > 0 ? 'RELOADING...' : (w.ammo === 0 ? 'PRESS R' : ''); }
function startReload() { const w = W[cur]; if (reloadT > 0 || w.ammo >= w.d.mag || swapT > 0) return; reloadT = w.d.reload; sfx('reload'); refreshAmmo(); }
function aimDir(spread) { const d = new V3(0, 0, -1); const e = new THREE.Euler(P.pitch, P.yaw, 0, 'YXZ'); d.applyEuler(e); if (spread) { const r = new V3(1, 0, 0).applyEuler(e), u = new V3(0, 1, 0).applyEuler(e); const a = rnd(0, 6.283), m = Math.sqrt(Math.random()) * spread; d.addScaledVector(r, Math.cos(a) * m).addScaledVector(u, Math.sin(a) * m).normalize(); } return d; }
function muzzleWorld() { const w = W[cur], p = new V3(w.muzzle.x, w.muzzle.y, w.muzzle.z).add(vmBase); p.applyEuler(camera.rotation); return p.add(camera.position); }
let vmBase = new V3(.27, -.25, -.5);
function fire() {
  const w = W[cur], d = w.d; w.ammo--; w.cd = d.rate; vmKick = d.kick * 4; flash.material.opacity = 1; flashLight.intensity = 6; setTimeout(() => flashLight.intensity = 0, 50); sfx(d.id); refreshAmmo();
  const dmgMul = P.buffT > 0 ? 2 : 1; const o = eyePos(); const move = Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 8), sp = (adsK > .5 ? d.spread : (d.hip || d.spread)) * (1 + move * 2.5) * (adsK > .5 ? .5 : 1) * (P.onGround ? 1 : 2);
  P.pitch += rnd(.5, 1) * d.kick * .3 * (adsK > .5 ? .6 : 1); P.yaw += rnd(-.5, .5) * d.kick * .12; P.shakeT = Math.max(P.shakeT, .08);
  for (const b of bots) if (b.alive && b.pos.distanceTo(P.pos) < 38) { b.alertT = Math.max(b.alertT, 3); b.lastSeen.copy(P.pos); }
  const mz = muzzleWorld();
  if (d.proj) { const dir = aimDir(0); const t = worldT(o, dir); const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 1), new THREE.MeshBasicMaterial({ color: 0xff4fe0 })); m.position.copy(mz); scene.add(m); outline(m, 1.3); projs.push({ m, v: dir.multiplyScalar(30), life: 4 }); return; }
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
function explode(pos, byPlayer) {
  blast(pos, 5.5, 0xff8a3a); sfx('explode', clamp(1 - pos.distanceTo(P.pos) / 60, .3, 1)); P.shakeT = Math.max(P.shakeT, .3 * clamp(1 - pos.distanceTo(P.pos) / 20, 0, 1) + .05);
  const R = 5.5; for (const b of bots) { if (!b.alive) continue; const c = new V3(b.pos.x, b.pos.y + 1, b.pos.z), d = c.distanceTo(pos); if (d < R) { const dmg = W[4].d.dmg * (P.buffT > 0 ? 2 : 1) * (1 - d / R * .75); const k = b.hurt(dmg, false, true); showHit(k ? 'kill' : ''); if (!k) sfx('hit'); const push = c.sub(pos).setY(0).normalize().multiplyScalar(6); b.vel.x += push.x; b.vel.z += push.z; } }
  const pc = new V3(P.pos.x, P.pos.y + 1, P.pos.z), d = pc.distanceTo(pos); if (d < R && P.alive) { const dmg = 35 * (1 - d / R); if (dmg > 3) damagePlayer(dmg, null); const push = pc.sub(pos).normalize().multiplyScalar(11 * (1 - d / R)); P.vel.x += push.x; P.vel.z += push.z; P.vel.y = Math.max(P.vel.y, push.y * .8 + 2); }
}

// ------------------------------------------------------------------ main update
function updatePlayer(dt) {
  const D = DIFF[S.diff];
  if (!P.alive) { P.respT -= dt; P.shakeT = 0; if (P.respT <= 0 && state === 'play') spawnPlayer(); return; }
  const fwd = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw)), wish = new V3();
  if (keys.KeyW) wish.add(fwd); if (keys.KeyS) wish.sub(fwd); if (keys.KeyD) wish.add(right); if (keys.KeyA) wish.sub(right); if (wish.lengthSq() > 0) wish.normalize();
  const sprint = keys.ShiftLeft || keys.ShiftRight, spd = (sprint && keys.KeyW ? 10.5 : 7.2) * (adsK > .5 ? .65 : 1), ctl = P.onGround ? 14 : 2.8;
  P.vel.x += (wish.x * spd - P.vel.x) * clamp(ctl * dt, 0, 1); P.vel.z += (wish.z * spd - P.vel.z) * clamp(ctl * dt, 0, 1);
  if (keys.Space && P.onGround) { P.vel.y = 7.6; P.onGround = false; }
  P.onGround && (P.blocked = false); moveEntity(P, dt);
  if (time - P.lastHurt > 5 && P.hp < 100) P.hp = Math.min(100, P.hp + 18 * dt);
  P.buffT = Math.max(0, P.buffT - dt);
  // pickups
  for (const pk of pickups) { if (!pk.on) { pk.t -= dt; if (pk.t <= 0) { pk.on = true; pk.g.visible = true; } continue; } if (Math.hypot(P.pos.x - pk.x, P.pos.z - pk.z) < 1.2 && Math.abs(P.pos.y - pk.y) < 1.8) { if (pk.type === 'hp') { if (P.hp >= 100) continue; P.hp = Math.min(100, P.hp + 50); feed('<b style="color:#4aff8a">+50 health</b>'); } else { P.buffT = 12; feed('<b style="color:#ff8aff">DOUBLE DAMAGE!</b>'); showCenter('DOUBLE DAMAGE!', '#ff8aff'); } pk.on = false; pk.g.visible = false; pk.t = pk.type === 'hp' ? 18 : 30; sfx('pick'); burst(new V3(pk.x, pk.y + 1, pk.z), pk.type === 'hp' ? 0x4aff8a : 0xff4fe0, 14, 5, .12, .7, 8, 2); } }
  // weapon state
  const w = W[cur]; if (w.cd > 0) w.cd -= dt;
  if (swapT > 0) { swapT -= dt; if (swapT <= .11 && wantSwap >= 0) { cur = wantSwap; wantSwap = -1; W.forEach((x, k) => x.g.visible = k === cur); refreshAmmo(); refreshSlots(); } if (swapT <= 0) swapT = 0; }
  if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { w.ammo = w.d.mag; reloadT = 0; refreshAmmo(); } }
  if (mouseL && swapT <= 0 && reloadT <= 0 && w.cd <= 0) { if (w.ammo > 0) { if (w.d.auto || !firedThis) { fire(); firedThis = true; } } else if (!firedThis) { sfx('empty'); startReload(); firedThis = true; } }
  if (!mouseL) firedThis = false;
  // projectiles
  for (let i = projs.length - 1; i >= 0; i--) { const p = projs[i]; p.life -= dt; const step = p.v.clone().multiplyScalar(dt), len = step.length(), dir = step.clone().normalize(); const tw = worldT(p.m.position, dir, len + .3); let hitB = null; for (const b of bots) if (b.alive && b.invT <= 0) { const h = hitEntity(p.m.position, dir, b, 1.62); if (h && h.t < len + .3) hitB = b; } if (tw < len + .3 || hitB || p.life <= 0 || p.m.position.y < .1) { explode(p.m.position.clone().addScaledVector(dir, Math.min(tw, len) * .9), true); scene.remove(p.m); projs.splice(i, 1); } else { p.m.position.add(step); if (Math.random() < .6) burst(p.m.position, 0xff9ad8, 1, 1, .08, .3, 0); } }
}
function updateCamera(dt) {
  const w = W[cur], zoomF = w.d.zoom || 62, tgt = mouseR && P.alive && swapT <= 0 && reloadT <= 0 ? 1 : 0; adsK += (tgt - adsK) * clamp(dt * 12, 0, 1);
  camera.fov += ((S.fov * (1 - adsK) + (w.d.zoom ? zoomF : S.fov * .8) * adsK) - camera.fov) * clamp(dt * 14, 0, 1); camera.updateProjectionMatrix();
  P.pitch = clamp(P.pitch, -1.5, 1.5); const shake = P.shakeT > 0 ? P.shakeT : 0; if (P.shakeT > 0) P.shakeT -= dt;
  let y = P.pos.y + 1.6; if (!P.alive) y = P.pos.y + .35 + Math.max(0, P.respT - 2.2) * 0;
  const bobAmp = P.alive && P.onGround ? Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 7) : 0; vmBob += dt * (6 + Math.hypot(P.vel.x, P.vel.z) * .8) * (bobAmp > 0 ? 1 : 0);
  camera.position.set(P.pos.x + rnd(-1, 1) * shake * .15, y + Math.sin(vmBob * 2) * .025 * bobAmp + rnd(-1, 1) * shake * .12, P.pos.z + rnd(-1, 1) * shake * .15);
  camera.rotation.set(P.pitch + rnd(-1, 1) * shake * .02, P.yaw, !P.alive ? Math.min(.5, (3 - P.respT) * .4) : rnd(-1, 1) * shake * .02);
  // viewmodel
  const g = w.g; vmKick = Math.max(0, vmKick - dt * 14); const sw = swapT > 0 ? Math.sin((swapT / .22) * Math.PI) : 0, rl = reloadT > 0 ? Math.sin((1 - reloadT / w.d.reload) * Math.PI) : 0;
  const base = new V3(.27 * (1 - adsK) + 0 * adsK, -.25 * (1 - adsK) + (-.17) * adsK, -.5 * (1 - adsK) + (-.42) * adsK); vmBase.copy(base);
  g.position.set(base.x + Math.sin(vmBob) * .012 * bobAmp * (1 - adsK), base.y + Math.abs(Math.cos(vmBob)) * .01 * bobAmp * (1 - adsK) - sw * .35 - rl * .1, base.z + vmKick * .08 + rl * .05);
  g.rotation.set(vmKick * .09 - rl * .5 + sw * .6, 0, rl * .25 + Math.sin(vmBob) * .01 * bobAmp);
  flash.position.copy(g.position).add(new V3(w.muzzle.x, w.muzzle.y, w.muzzle.z - .05)); flash.rotation.z += .7; flash.material.opacity = Math.max(0, flash.material.opacity - dt * 16); flash.visible = flash.material.opacity > .02 && adsK < .6;
  flashLight.position.copy(camera.position).add(new V3(0, 0, -1).applyEuler(camera.rotation));
  $('scope').classList.toggle('hide', !(w.d.zoom && adsK > .85)); vmScene.visible = !(w.d.zoom && adsK > .85) && P.alive && (state === 'play' || state === 'pause');
}
function updateHUD() {
  $('hpNum').textContent = Math.ceil(P.hp); const f = $('hpFill'); f.style.width = P.hp + '%'; f.classList.toggle('low', P.hp < 35); $('vig').classList.toggle('low', P.hp < 35 && P.alive);
  const w = W[cur]; $('aMag').textContent = w.ammo; $('rl').textContent = reloadT > 0 ? 'RELOADING...' : (w.ammo === 0 ? 'PRESS R' : '');
  $('buff').textContent = P.buffT > 0 ? `DOUBLE DAMAGE ${Math.ceil(P.buffT)}s` : '';
  const spread = 8 + Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 8) * 10 + (P.onGround ? 0 : 8) + w.d.spread * 500, k = adsK > .5 ? .5 : 1; const c = $('cross'); const ps = { t: [0, -spread * k], b: [0, spread * k], l: [-spread * k, 0], r: [spread * k, 0] };
  for (const key of ['t', 'b', 'l', 'r']) c.querySelector('.' + key).style.transform = `translate(${ps[key][0]}px,${ps[key][1]}px)`; c.style.opacity = w.d.zoom && adsK > .85 ? 0 : 1;
  // direction indicators
  const dir = $('dir'); dir.innerHTML = ''; dmgInd = dmgInd.filter(d => time - d.t < 1.2); for (const d of dmgInd) { const i = document.createElement('i'); i.style.transform = `rotate(${(-(d.a - P.yaw) * 180 / Math.PI) + 180}deg)`; i.style.opacity = Math.max(0, 1 - (time - d.t) / 1.2); i.style.transition = 'none'; dir.appendChild(i); }
  // radar
  const r = $('radar'), x = r.getContext('2d'), R = 132; x.clearRect(0, 0, 264, 264); x.save(); x.translate(R, R); x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(0, 0, R - 4, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, (R - 4) / 2, 0, 7); x.stroke();
  const rr = 40, sc = (R - 10) / rr, cs = Math.cos(P.yaw), sn = Math.sin(P.yaw);
  const dot = (wx, wz, col, rad) => { const dx = wx - P.pos.x, dz = wz - P.pos.z, rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; let px = rx * sc, py = rz * sc; const m = Math.hypot(px, py), lim = R - 10; if (m > lim) { px *= lim / m; py *= lim / m; } x.fillStyle = col; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill(); };
  for (const pk of pickups) if (pk.on) dot(pk.x, pk.z, pk.type === 'hp' ? '#4aff8a' : '#ff8aff', 4);
  for (const b of bots) if (b.alive) dot(b.pos.x, b.pos.z, '#ff5a6a', 6);
  x.fillStyle = '#2ee6ff'; x.beginPath(); x.moveTo(0, -9); x.lineTo(7, 7); x.lineTo(-7, 7); x.closePath(); x.fill(); x.restore();
}
let last = performance.now();
function step(dt) {
  time += dt;
  for (const c of clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 260) c.position.x = -260; } for (const [i, b] of balloons.entries()) b.position.y += Math.sin(time * 1.2 + i) * .004;
  for (const pk of pickups) { pk.core.rotation.y += dt * 2; pk.g.position.y = pk.y + 1.05 + Math.sin(time * 3 + pk.x) * .12; }
  if (state === 'play') { updatePlayer(dt); for (const b of bots) b.update(dt); } else if (state === 'menu' || state === 'over') { const a = time * .12; P.pos.set(Math.cos(a) * 25, 7, Math.sin(a) * 25); P.yaw = Math.atan2(P.pos.x, P.pos.z); P.pitch = -.22; P.alive = true; P.vel.set(0, 0, 0); }
  updateFX(dt); updateCamera(dt); if (state === 'play') updateHUD();
}
function render() { renderer.clear(); renderer.render(scene, camera); if (vmScene.visible) { renderer.clearDepth(); vmCam.fov = 58; renderer.render(vmScene, vmCam); } }
let hudVis = null;
function loop(now) { const hv = state === 'menu' ? 'hidden' : 'visible'; if (hv !== hudVis) { $('hud').style.visibility = hv; hudVis = hv; } const dt = Math.min(.05, (now - last) / 1000); last = now; step(dt); render(); requestAnimationFrame(loop); }

// ------------------------------------------------------------------ input / menus
function lockPointer() { if (DEBUG) { onLock(true); return; } audioInit(); canvas.requestPointerLock && canvas.requestPointerLock(); }
function onLock(locked) { if (locked) { audioInit(); if (!started) { started = true; startMatch(); } else if (state === 'pause') state = 'play'; $('pause').classList.add('hide'); $('menu').classList.add('hide'); } else if (state === 'play') { state = 'pause'; $('pause').classList.remove('hide'); } }
document.addEventListener('pointerlockchange', () => onLock(document.pointerLockElement === canvas));
document.addEventListener('pointerlockerror', () => { if (started && state === 'play') { state = 'pause'; $('pause').classList.remove('hide'); } });
document.addEventListener('mousemove', e => { if (document.pointerLockElement !== canvas && !DEBUG) return; if (state !== 'play' || !P.alive) return; const k = .0022 * S.sens * (adsK > .5 ? (W[cur].d.zoom ? .3 : .7) : 1); P.yaw -= e.movementX * k; P.pitch -= e.movementY * k; });
addEventListener('mousedown', e => { if (state !== 'play') return; if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (state !== 'play') return; selectWeapon((cur + (e.deltaY > 0 ? 1 : 4)) % 5); }, { passive: true });
addEventListener('keydown', e => { keys[e.code] = true; if (state === 'play') { if (e.code === 'KeyR') startReload(); if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 5) selectWeapon(n); } if (e.code === 'Tab') { e.preventDefault(); $('board2').innerHTML = boardHTML(); $('board-screen').classList.remove('hide'); } if (e.code === 'Space') e.preventDefault(); } });
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') $('board-screen').classList.add('hide'); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; });
$('play').onclick = lockPointer; $('resume').onclick = lockPointer; $('again').onclick = () => { $('over').classList.add('hide'); started = true; if (DEBUG) { startMatch(); } else { startMatch(); canvas.requestPointerLock && canvas.requestPointerLock(); } };
$('restart').onclick = () => { startMatch(); lockPointer(); };
for (const b of document.querySelectorAll('#diffRow button')) { b.classList.toggle('sel', b.dataset.d === S.diff); b.onclick = () => { S.diff = b.dataset.d; save('diff', S.diff); document.querySelectorAll('#diffRow button').forEach(x => x.classList.toggle('sel', x === b)); }; }
for (const [id, key, lab] of [['sens', 'sens', 'sensV'], ['fovR', 'fov', 'fovV'], ['vol', 'vol', 'volV']]) { const el = $(id); el.value = S[key]; $(lab).textContent = S[key]; el.oninput = () => { S[key] = +el.value; $(lab).textContent = S[key]; save(key, S[key]); if (key === 'vol' && master) master.gain.value = S.vol; }; }
if ('ontouchstart' in window && !matchMedia('(pointer:fine)').matches) { $('touchWarn').style.display = 'block'; $('play').style.display = 'none'; }
$('sTarget').textContent = TARGET; refreshSlots(); refreshAmmo();
window.__ba = { P, bots, W, S, step, render, startMatch, selectWeapon, fire, get state() { return state; }, set mouse(v) { mouseL = v; }, shot: () => { step(0.001); render(); return canvas.toDataURL('image/png'); }, setState: s => state = s, score, world, hitEntity, pickups, DIFF, keys };
requestAnimationFrame(loop);
