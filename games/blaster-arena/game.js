// BLASTER ARENA - stylized arena shooter (Three.js). No blood: robots pop into confetti.
// Solo, or online co-op for up to 4 friends (WebRTC through PeerJS). The host runs the bots and loot; everyone else simulates themselves.
import * as THREE from './three.module.min.js';
import { MAPS } from './maps.js?v=3.5';
import { Net, makeCode, cleanCode, MAX_PLAYERS } from './net.js?v=3.5';
import { TOUCH, initTouch } from './touch.js?v=3.5';
const tx = s => TOUCH ? s.replace('PRESS F TO THROW', 'TAP ITEM TO THROW').replace('PRESS F TO USE', 'TAP ITEM TO USE').replace('PRESS R', 'TAP RELOAD') : s;
const V3 = THREE.Vector3, $ = id => document.getElementById(id);
const QS = new URLSearchParams(location.search), DEBUG = QS.has('debug'), NETMODE = QS.get('net') === 'local' ? 'local' : 'peerjs';
const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.floor(Math.random() * a.length)];
const load = (k, d) => { try { const v = localStorage.getItem('ba.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem('ba.' + k, JSON.stringify(v)); } catch (e) {} };
const S = { sens: load('sens', 1), fov: load('fov', 85), vol: load('vol', 0.7) };
const CFG = { mode: load('mode', 'tdm'), map: load('map', 'plaza'), diff: load('diff', 'normal'), rarity: load('rarity', 2), fp: load('fp', 'dummy') };
if (CFG.mode !== 'royale' && (MAPS.find(m => m.id === CFG.map) || {}).br) CFG.map = 'plaza';
const MODES = {
  tdm:   { name: 'Team Deathmatch', blurb: 'You (and your friends) vs the bots. First team to the target wins.' },
  horde: { name: 'Horde', blurb: 'Survive waves of bots that get tougher each round. A boss shows up every 5 waves.' },
  free: { name: 'Freeplay', blurb: 'Practice range! Every blaster is free to grab at the rarity you pick, ammo is unlimited, and the targets never stop coming back.' },
  brawl: { name: 'Brawl', blurb: 'Free-for-all! Every player and bot is on their own, so friends can fight each other. First to 15 pops wins.' },
  royale: { name: 'Battle Royale', blurb: 'Loot up, then outlast the shrinking storm. One life. Last one standing wins, and players fight each other and the bots.' },
  blitz: { name: 'Blitz', blurb: 'Five minutes on the clock. Out-pop the bots before time runs out.' },
};
if (!MODES[CFG.mode]) CFG.mode = 'tdm';
const DIFF = {
  easy:   { bots: 4, hp: 70,  aim: 0.085, react: 0.75, dmg: 5,  speed: 3.6, fire: 0.36, turn: 5, nade: 22, nades: ['frag'] },
  normal: { bots: 5, hp: 100, aim: 0.05,  react: 0.45, dmg: 7,  speed: 4.4, fire: 0.25, turn: 7, nade: 13, nades: ['frag', 'frag', 'molly', 'flash'] },
  hard:   { bots: 6, hp: 120, aim: 0.026, react: 0.25, dmg: 9,  speed: 5.3, fire: 0.18, turn: 10, nade: 8, nades: ['frag', 'molly', 'flash', 'flash', 'frag'] },
};
if (!DIFF[CFG.diff]) CFG.diff = 'normal';
const G = 22, STEP = 0.6;
const BOT_COLORS = [0xff7a1a, 0xff4fa8, 0xb06bff, 0xffd31a, 0xff4a4a, 0xa0ff3a];
const BOT_NAMES = ['Blip', 'Zorp', 'Chomp', 'Bolt', 'Pixel', 'Waffle'];
const PLAYER_COLORS = [0x2ee6ff, 0x4aa8ff, 0x4affc8, 0xffffff];

// ------------------------------------------------------------------ renderer / scenes
const canvas = $('view');
// ---- graphics quality: Chromebooks and small laptops are detected and get lighter settings (menu: GRAPHICS to override)
const IS_CROS = /CrOS/.test(navigator.userAgent || '');
const GFX_PREF = QS.get('gfx') || load('gfx', 'auto');
const GFX = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : (IS_CROS ? 'low' : ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) ? 'med' : 'high');
const QL = {
  high: { aa: true, pr: 1.75, shadow: 2048, edges: true, outline: true, fx: 1, clouds: 16, snow: 700, light: true, start: 1, min: .5 },
  med:  { aa: false, pr: 1.25, shadow: 1024, edges: true, outline: true, fx: .7, clouds: 10, snow: 400, light: true, start: 1, min: .5, skip: true },
  low:  { aa: false, pr: 1, shadow: 0, edges: false, outline: false, fx: .45, clouds: 5, snow: 200, light: false, start: .9, min: .4 },
}[GFX];
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QL.aa, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
const BASE_PR = Math.min(devicePixelRatio, QL.pr); let resScale = QL.start, resCeil = 1; renderer.autoClear = false; renderer.setPixelRatio(BASE_PR); renderer.shadowMap.enabled = QL.shadow > 0; renderer.shadowMap.type = THREE.PCFShadowMap; if (QL.skip) renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xbfe9ff, 45, 150);
const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 600); camera.rotation.order = 'YXZ'; scene.add(camera);
const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
function resize() { const w = innerWidth, h = innerHeight; renderer.setPixelRatio(BASE_PR * resScale); renderer.setSize(w, h, false); camera.aspect = vmCam.aspect = w / h; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const hemis = [new THREE.HemisphereLight(0xcfeaff, 0x8a6ad0, 1.05), new THREE.HemisphereLight(0xcfeaff, 0x8a6ad0, 1.05)]; scene.add(hemis[0]); vmScene.add(hemis[1]);
const sun = new THREE.DirectionalLight(0xfff1d0, 2.3); sun.position.set(30, 50, 20); sun.castShadow = QL.shadow > 0; sun.shadow.mapSize.set(QL.shadow || 512, QL.shadow || 512);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 }); sun.shadow.bias = -0.0004; scene.add(sun); scene.add(sun.target);
const vmSun = new THREE.DirectionalLight(0xffffff, 2.2); vmSun.position.set(1, 2, 1); vmScene.add(vmSun);

// toon look
const gradient = (() => { const d = new Uint8Array([90, 150, 210, 255]); const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (c, o = {}) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: gradient }, o));
const INK = new THREE.MeshBasicMaterial({ color: 0x120a24, side: THREE.BackSide });
function outline(mesh, k = 1.06) { if (!QL.outline) return mesh; const o = new THREE.Mesh(mesh.geometry, INK); o.scale.setScalar(k); mesh.add(o); return mesh; }

// sky dome + clouds (colors are driven by the map theme)
const skyU = { top: { value: new THREE.Color(0x2f8cff) }, mid: { value: new THREE.Color(0x8fd8ff) }, bot: { value: new THREE.Color(0xfff0d8) }, sunStr: { value: 1 } };
scene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float sunStr; void main(){ float h = clamp(p.y,-0.1,1.0); vec3 c = h<0.18 ? mix(bot, mid, smoothstep(-0.1,0.18,h)) : mix(mid, top, smoothstep(0.18,0.8,h)); float sun = pow(max(dot(p, normalize(vec3(0.5,0.8,0.35))),0.0), 220.0) * sunStr; gl_FragColor = vec4(c + vec3(1.0,0.9,0.6)*sun, 1.0); }' })));
const clouds = [], balloons = [], cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient, fog: false }), cloudGroup = new THREE.Group(); scene.add(cloudGroup);
for (let i = 0; i < QL.clouds; i++) { const g = new THREE.Group(), n = rint(3, 5); for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(7, 12), 12, 8), cloudMat); m.position.set(k * 9 - n * 4, rnd(-2, 2), rnd(-3, 3)); m.scale.y = .7; g.add(m); } const a = rnd(0, 6.28), r = rnd(120, 240); g.position.set(Math.cos(a) * r, rnd(45, 90), Math.sin(a) * r); g.userData.sp = rnd(.4, 1.2); cloudGroup.add(g); clouds.push(g); }

// ------------------------------------------------------------------ maps (data lives in maps.js)
const world = [];   // static AABBs used for collision + line of sight
const mapGroup = new THREE.Group(); scene.add(mapGroup);
const SPAWNS = [], WAYPOINTS = [], LOOT_SPOTS = [], DMG_SPOTS = [], CHEST_SPOTS = [];
let HALF = 32, curMap = null, snowPts = null;
function addBox(cx, cy, cz, sx, sy, sz, color, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), toon(color)); m.position.set(cx, cy, cz); m.castShadow = true; m.receiveShadow = true; mapGroup.add(m);
  if (QL.edges && o.edges !== false) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x1c1030 })));
  world.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minY: cy - sy / 2, maxY: cy + sy / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 }); return m;
}
function addGlow(cx, cy, cz, sx, sy, sz, color) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color })); m.position.set(cx, cy, cz); mapGroup.add(m); return m; }
const floorCv = document.createElement('canvas'); floorCv.width = floorCv.height = 128;
const floorTex = new THREE.CanvasTexture(floorCv); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.colorSpace = THREE.SRGBColorSpace; floorTex.anisotropy = 4;
function paintFloor(c1, c2, line) { const x = floorCv.getContext('2d'); x.fillStyle = c1; x.fillRect(0, 0, 128, 128); x.fillStyle = c2; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64); x.strokeStyle = line; x.lineWidth = 4; x.strokeRect(0, 0, 128, 128); floorTex.needsUpdate = true; }
const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: gradient })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: 0x7a5ad0, fog: true })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; scene.add(ground);
function applyTheme(t, half) {
  skyU.top.value.setHex(t.sky[0]); skyU.mid.value.setHex(t.sky[1]); skyU.bot.value.setHex(t.sky[2]); skyU.sunStr.value = t.sunStr;
  scene.fog.color.setHex(t.fog[0]); scene.fog.near = t.fog[1]; scene.fog.far = t.fog[2];
  for (const h of hemis) { h.color.setHex(t.hemi[0]); h.groundColor.setHex(t.hemi[1]); h.intensity = t.hemi[2]; }
  sun.color.setHex(t.sun[0]); sun.intensity = t.sun[1]; vmSun.intensity = Math.max(1.2, t.sun[1] * .9); renderer.toneMappingExposure = t.exposure;
  const sh = Math.min(half, 46), sc = sun.shadow.camera; sc.left = -(sh + 13); sc.right = sh + 13; sc.top = sh + 13; sc.bottom = -(sh + 13); sc.updateProjectionMatrix();
  ground.material.color.setHex(t.ground); cloudMat.color.setHex(t.clouds); paintFloor(t.floor[0], t.floor[1], t.floor[2]);
  floor.scale.set(half / 32, half / 32, 1); floorTex.repeat.set(half / 2, half / 2);
}
function clearMap() {
  for (const c of [...mapGroup.children]) { mapGroup.remove(c); disposeObj(c); }
  world.length = 0; balloons.length = 0; snowPts = null;
}
const freeAt = (x, z, rad) => !world.some(b => b.minY < 1.8 && b.maxY > .1 && x + rad > b.minX && x - rad < b.maxX && z + rad > b.minZ && z - rad < b.maxZ);
let curBig = false;
function loadMap(id, big = false) {
  const def = MAPS.find(m => m.id === id) || MAPS[0]; if (curMap === def && curBig === big) return def;
  clearMap(); curMap = def; curBig = big; const H = def.half, tile = big && !def.br; HALF = tile ? H * 2 : H; const t = def.theme; applyTheme(t, HALF);
  sun.position.set(30, 50, 20); sun.target.position.set(0, 0, 0);
  // boundary walls + glowing strips
  for (const [x, z, sx, sz] of [[0, -HALF - 1, 2 * HALF + 4, 2], [0, HALF + 1, 2 * HALF + 4, 2], [-HALF - 1, 0, 2, 2 * HALF], [HALF + 1, 0, 2, 2 * HALF]]) addBox(x, 4, z, sx, 8, sz, t.wall);
  [[0, -HALF + .08, 2 * HALF, .1, t.strips[0]], [0, HALF - .08, 2 * HALF, .1, t.strips[1]], [-HALF + .08, 0, .1, 2 * HALF, t.strips[2]], [HALF - .08, 0, .1, 2 * HALF, t.strips[3]]].forEach(([x, z, sx, sz, c]) => { addGlow(x, .6, z, sx, .35, sz, c); addGlow(x, 5.2, z, sx, .35, sz, c); });
  // battle royale builds the map four times (mirrored) side by side: twice as wide, four times the area
  const copies = tile ? [[-H, -H, 0, 0], [H, -H, 1, 0], [-H, H, 0, 1], [H, H, 1, 1]] : [[0, 0, 0, 0]];
  for (const [ox, oz, mx, mz] of copies) {
    const T = (x, z) => [ox + (mx ? -x : x), oz + (mz ? -z : z)];
    def.build({ box: (cx, cy, cz, sx, sy, sz, c, o) => { const [x, z] = T(cx, cz); return addBox(x, cy, z, sx, sy, sz, c, o); }, glow: (cx, cy, cz, sx, sy, sz, c) => { const [x, z] = T(cx, cz); return addGlow(x, cy, z, sx, sy, sz, c); } });
  }
  if (t.deco === 'balloons') for (let i = 0; i < (big ? 22 : 10); i++) { const a = i / (big ? 22 : 10) * Math.PI * 2, r = HALF - 4; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), toon(BOT_COLORS[i % 6])); m.position.set(Math.cos(a) * r, 8 + (i % 3) * 1.4, Math.sin(a) * r); outline(m, 1.08); mapGroup.add(m); balloons.push(m); }
  if (t.deco === 'stars') { const n = 320, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = rnd(0, 6.283), ph = Math.acos(rnd(.05, 1)), r = 380; a[i * 3] = Math.sin(ph) * Math.cos(th) * r; a[i * 3 + 1] = Math.cos(ph) * r; a[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); mapGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, fog: false, depthWrite: false }))); }
  if (t.deco === 'snow') { const n = QL.snow, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = rnd(-HALF, HALF); a[i * 3 + 1] = rnd(0, 26); a[i * 3 + 2] = rnd(-HALF, HALF); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); snowPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .13, transparent: true, opacity: .9, depthWrite: false })); snowPts.frustumCulled = false; mapGroup.add(snowPts); }
  // spawns / waypoints / loot spots for every copy (candidates inside geometry are dropped)
  const each = (list, fn) => { for (const [ox, oz, mx, mz] of copies) for (const e of list) fn(ox + (mx ? -e[0] : e[0]), oz + (mz ? -e[1] : e[1]), e); };
  SPAWNS.length = 0; each(def.spawns, (x, z) => { if (freeAt(x, z, 1.2)) SPAWNS.push(new V3(x, 0, z)); });
  WAYPOINTS.length = 0; for (let x = -(HALF - 4); x <= HALF - 4; x += 4) for (let z = -(HALF - 4); z <= HALF - 4; z += 4) if (freeAt(x, z, .9)) WAYPOINTS.push(new V3(x, 0, z));
  LOOT_SPOTS.length = 0; each(def.loot, (x, z, e) => { const y = e[2] || 0; if (y > 0 || freeAt(x, z, .8)) LOOT_SPOTS.push([x, z, y]); });
  CHEST_SPOTS.length = 0; { const keep = []; LOOT_SPOTS.forEach((sp, i) => { if (sp[2] === 0 && i % 5 === 2) CHEST_SPOTS.push(sp); else keep.push(sp); }); LOOT_SPOTS.length = 0; keep.forEach(sp => LOOT_SPOTS.push(sp)); }   // every 5th spot becomes a chest
  DMG_SPOTS.length = 0; for (const [ox, oz, mx, mz] of copies) for (const d of def.dmg) DMG_SPOTS.push([ox + (mx ? -d[0] : d[0]), d[1], oz + (mz ? -d[2] : d[2])]);
  return def;
}
function updateSnow(dt) { if (!snowPts) return; const a = snowPts.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * (1.6 + (i % 5) * .35); if (y < 0) { y += 26; } a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(time * .6 + i) * dt * .5); } a.needsUpdate = true; }

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
SFX.ar = v => { tone(1100, 240, .08, 'square', .2 * v); tone(300, 120, .05, 'sawtooth', .12 * v); noise(.06, .3 * v, 5500); };
SFX.rev = v => { tone(500, 90, .16, 'sawtooth', .34 * v); noise(.14, .5 * v, 3200); };
SFX.tac = v => { tone(240, 70, .16, 'sawtooth', .3 * v); noise(.16, .5 * v, 2800); };
SFX.burst = v => { tone(1000, 300, .06, 'square', .2 * v); noise(.05, .25 * v, 5000); };
SFX.glau = v => { tone(200, 60, .22, 'triangle', .35 * v); noise(.16, .4 * v, 1500); tone(900, 300, .1, 'square', .1 * v, .02); };
SFX.mini = v => { tone(700, 300, .04, 'square', .12 * v); noise(.03, .18 * v, 4500); };
const sfx = (k, v = 1) => { if (AC && SFX[k]) SFX[k](v); };


// ------------------------------------------------------------------ effects
const FX = { parts: [], tracers: [], blasts: [], free: [] };
const pGeo = new THREE.BoxGeometry(1, 1, 1);
function burst(pos, color, n = 12, spd = 6, size = .12, life = .8, grav = 14, up = 0) {
  n = Math.max(1, Math.round(n * QL.fx));
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
  ar() { const g = new THREE.Group(); gbox(g, .08, .11, .5, 0x3a86ff, 0, 0, 0); gbox(g, .06, .04, .34, 0x1e2438, 0, .08, -.04); gcyl(g, .022, .26, 0x1e2438, 0, .015, -.38); gbox(g, .05, .025, .07, 0x14151b, 0, .1, -.03); const SY = .21, HC = 0x1f2029, DK = 0x3a3d4a;
    gbox(g, .16, .02, .05, HC, 0, SY + .0525, -.03); gbox(g, .16, .02, .05, HC, 0, SY - .0525, -.03); gbox(g, .02, .085, .05, HC, -.07, SY, -.03); gbox(g, .02, .085, .05, HC, .07, SY, -.03);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(.12, .085), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide })); glass.position.set(0, SY, -.03); g.add(glass);
    const rmat = new THREE.MeshBasicMaterial({ color: 0xff3030, depthWrite: false, side: THREE.DoubleSide }); const ring = new THREE.Mesh(new THREE.RingGeometry(.011, .0145, 28), rmat), dot = new THREE.Mesh(new THREE.CircleGeometry(.0034, 14), rmat); ring.position.set(0, SY, -.028); dot.position.set(0, SY, -.028); g.add(ring, dot);
    for (let i = 0; i < 3; i++) gbox(g, .012, .014, .016, DK, -.082, SY - .012, -.045 + i * .02);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .02, 14), toon(DK)); dial.rotation.z = Math.PI / 2; dial.position.set(.082, SY, -.03); outline(dial, 1.1); g.add(dial); gbox(g, .07, .17, .09, 0x1e2438, 0, -.13, 0, [.12, 0, 0]); gbox(g, .07, .16, .07, 0x1e2438, 0, -.1, .14, [.3, 0, 0]); gbox(g, .08, .1, .22, 0xe8f0ff, 0, -.01, .36); return { g, muzzle: new V3(0, .015, -.52) }; },
  boom() { const g = new THREE.Group(); gcyl(g, .04, .62, 0xb06bff, -.04, .03, -.15); gcyl(g, .04, .62, 0xb06bff, .04, .03, -.15); gbox(g, .14, .09, .16, 0xffd34e, 0, -.03, -.15); gbox(g, .1, .14, .3, 0xff8a3a, 0, -.05, .22); gbox(g, .08, .15, .09, 0x4a3a2a, 0, -.14, .08, [.3, 0, 0]); gbox(g, .11, .08, .22, 0x6a3a8a, 0, -.03, -.3); return { g, muzzle: new V3(0, .04, -.48) }; },
  zap() { const g = new THREE.Group(); gbox(g, .07, .1, .55, 0x8aff3a, 0, 0, .0); gcyl(g, .018, .5, 0x333a50, 0, .02, -.5); gcyl(g, .045, .26, 0x2a2a3a, 0, .12, -.05); gcyl(g, .04, .01, 0x2ee6ff, 0, .12, -.18, true); gbox(g, .09, .13, .3, 0x4a3a6a, 0, -.02, .38); gbox(g, .06, .16, .07, 0x2a2a3a, 0, -.12, .06, [.25, 0, 0]); gbox(g, .015, .04, .015, 0xff4a4a, 0, .06, -.74); return { g, muzzle: new V3(0, .02, -.78) }; },
  kab() { const g = new THREE.Group(); gcyl(g, .09, .55, 0xff4a4a, 0, .02, -.1); gcyl(g, .125, .14, 0xffd34e, 0, .02, -.4); gcyl(g, .06, .02, 0xff4fe0, 0, .02, -.47, true); gbox(g, .08, .15, .1, 0x2a2a3a, 0, -.14, .06, [.2, 0, 0]); gbox(g, .1, .1, .22, 0x2a2a3a, 0, -.01, .26); gbox(g, .07, .11, .14, 0xffd34e, 0, .12, -.05); return { g, muzzle: new V3(0, .02, -.52) }; },
  rev() { const g = new THREE.Group(); gbox(g, .07, .1, .26, 0xc8d0dc, 0, 0, .02); gcyl(g, .05, .1, 0x8a96aa, 0, .02, -.02); gcyl(g, .02, .3, 0x6a7488, 0, .035, -.25); gbox(g, .07, .17, .09, 0x8a5a2a, 0, -.12, .12, [.35, 0, 0]); gbox(g, .02, .035, .03, 0xff4a4a, 0, .075, -.38); return { g, muzzle: new V3(0, .035, -.4) }; },
  tac() { const g = new THREE.Group(); gbox(g, .09, .1, .42, 0x1f9a8a, 0, 0, 0); gcyl(g, .03, .5, 0x1c2a3a, 0, .035, -.42); gcyl(g, .04, .26, 0xffc233, 0, -.045, -.3); gbox(g, .08, .15, .09, 0x1c2a3a, 0, -.12, .08, [.3, 0, 0]); gbox(g, .09, .11, .24, 0x1c2a3a, 0, -.02, .34); return { g, muzzle: new V3(0, .035, -.66) }; },
  burst() { const g = new THREE.Group(); gbox(g, .07, .1, .5, 0xffc233, 0, 0, 0); gbox(g, .05, .035, .3, 0x23242e, 0, .075, -.04); gcyl(g, .02, .24, 0x23242e, 0, .02, -.36); gbox(g, .02, .04, .02, 0xff4a4a, 0, .115, -.22); gbox(g, .02, .04, .02, 0xff4a4a, 0, .115, .08); gbox(g, .065, .16, .08, 0x23242e, 0, -.125, 0, [.1, 0, 0]); gbox(g, .07, .15, .07, 0x23242e, 0, -.1, .14, [.3, 0, 0]); gbox(g, .075, .1, .2, 0x23242e, 0, -.01, .34); return { g, muzzle: new V3(0, .02, -.5) }; },
  glau() { const g = new THREE.Group(); gcyl(g, .075, .5, 0x6a8a3a, 0, .03, -.1); gcyl(g, .09, .14, 0x3a4a22, 0, .03, -.38); gcyl(g, .085, .16, 0x2a2a3a, 0, .03, .05); gbox(g, .07, .15, .09, 0x2a2a3a, 0, -.12, .1, [.25, 0, 0]); gbox(g, .09, .1, .2, 0x2a2a3a, 0, -.02, .3); gbox(g, .03, .06, .05, 0xffc233, 0, .115, -.1); return { g, muzzle: new V3(0, .03, -.5) }; },
  mini() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; gcyl(g, .018, .5, 0x9aa3b5, Math.cos(a) * .035, .03 + Math.sin(a) * .035, -.34); } gcyl(g, .07, .12, 0x6a7488, 0, .03, -.1); gbox(g, .12, .14, .3, 0xb03a3a, 0, 0, .1); gbox(g, .1, .12, .14, 0x2a2a3a, -.11, -.04, .1); gbox(g, .06, .15, .08, 0x2a2a3a, 0, -.14, .12, [.2, 0, 0]); gbox(g, .1, .1, .16, 0x2a2a3a, 0, -.02, .32); return { g, muzzle: new V3(0, .03, -.6) }; },
};
const WDEF = [
  { id: 'pop', at: 'light', name: 'POP-GUN', mag: 12, dmg: 24, rate: .17, auto: false, spread: .003, reload: 1.1, kick: .06, pellets: 1, hs: 1.7, shake: .004 },
  { id: 'zip', at: 'light', name: 'ZIP SMG', mag: 32, dmg: 10, rate: .072, auto: true, spread: .02, reload: 1.5, kick: .02, pellets: 1, hs: 1.5, shake: .002 },
  { id: 'ar', at: 'medium', name: 'STORM AR', mag: 30, dmg: 17, rate: .1, auto: true, spread: .012, reload: 1.9, kick: .04, pellets: 1, hs: 1.6, shake: .003, holo: true, adsFov: 56, adsY: -.152, adsZ: -.35 },
  { id: 'boom', at: 'shells', name: 'BOOMER', mag: 6, dmg: 9, rate: .8, auto: false, spread: .05, reload: 2.0, kick: .15, pellets: 9, hs: 1.4, shake: .012 },
  { id: 'zap', at: 'heavy', name: 'ZAPPER', mag: 5, dmg: 82, rate: .95, auto: false, spread: .0004, hip: .035, reload: 2.1, kick: .13, pellets: 1, hs: 1.5, zoom: 22, shake: .01 },
  { id: 'kab', at: 'rockets', name: 'KABOOM', mag: 4, dmg: 78, rate: .85, auto: false, spread: 0, reload: 2.3, kick: .11, pellets: 1, proj: true, radius: 5.5, hs: 1, shake: .012 },
  { id: 'rev', at: 'light', name: 'HAND CANNON', mag: 6, dmg: 58, rate: .5, auto: false, spread: .002, reload: 2.1, kick: .14, pellets: 1, hs: 1.8, shake: .01 },
  { id: 'tac', at: 'shells', name: 'TAC-12', mag: 8, dmg: 7, rate: .32, auto: false, spread: .04, reload: 2.4, kick: .1, pellets: 8, hs: 1.4, shake: .01 },
  { id: 'burst', at: 'medium', name: 'BURST RIFLE', mag: 24, dmg: 19, rate: .5, burst: 3, burstGap: .075, auto: false, spread: .007, reload: 1.9, kick: .05, pellets: 1, hs: 1.6, shake: .004 },
  { id: 'glau', at: 'rockets', name: 'LAUNCHER', mag: 3, dmg: 90, rate: .9, auto: false, spread: 0, reload: 2.6, kick: .12, pellets: 1, launch: true, hs: 1, shake: .012 },
  { id: 'mini', at: 'medium', name: 'BUZZSAW', mag: 90, dmg: 7, rate: .045, auto: true, spread: .03, reload: 3.4, kick: .012, pellets: 1, hs: 1.3, heavy: true, shake: .002 },
];
const VMS = .72;
// rarity tiers: scale damage / magazine / fire rate / reload / spread
const RARITY = [
  { name: 'COMMON',    col: 0xb8c0cc, dmg: 1,    mag: 1,   rate: 1,   reload: 1,   spread: 1,   w: 50 },
  { name: 'UNCOMMON',  col: 0x4ade80, dmg: 1.1,  mag: 1.1, rate: .97, reload: .95, spread: .95, w: 28 },
  { name: 'RARE',      col: 0x4aa8ff, dmg: 1.2,  mag: 1.2, rate: .94, reload: .9,  spread: .9,  w: 14 },
  { name: 'EPIC',      col: 0xb06bff, dmg: 1.3,  mag: 1.3, rate: .9,  reload: .82, spread: .82, w: 6 },
  { name: 'LEGENDARY', col: 0xffc233, dmg: 1.4,  mag: 1.5, rate: .85, reload: .75, spread: .7,  w: 2 },
];
const W = WDEF.map(d => {
  const o = GUNS[d.id](); const bb = new THREE.Box3().setFromObject(o.g), len = bb.max.z - bb.min.z;
  const gem = new THREE.Mesh(new THREE.BoxGeometry(.012, .026, len * .45), new THREE.MeshBasicMaterial({ color: 0xffffff })); gem.position.set(bb.min.x - .006, (bb.min.y + bb.max.y) / 2 + .01, (bb.min.z + bb.max.z) / 2); o.g.add(gem);   // rarity light strip
  o.g.scale.setScalar(VMS); o.muzzle.multiplyScalar(VMS); o.g.visible = false; vmScene.add(o.g);
  return { d, g: o.g, muzzle: o.muzzle, gem, ammo: d.mag, cd: 0, owned: d.id === 'pop', rar: 0, s: null };
});
function applyRarity(w) { const R = RARITY[w.rar], d = w.d; w.s = { dmg: d.dmg * R.dmg, mag: Math.round(d.mag * R.mag), rate: d.rate * R.rate, reload: d.reload * R.reload, spread: d.spread * R.spread, hip: d.hip ? d.hip * R.spread : 0 }; w.gem.material.color.setHex(R.col); }
for (const w of W) applyRarity(w);
const flash = new THREE.Mesh(new THREE.PlaneGeometry(.34, .34), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); vmScene.add(flash);
const flashLight = new THREE.PointLight(0xffd080, 0, 14); if (QL.light) scene.add(flashLight);


// ------------------------------------------------------------------ player + session state
const STAND_H = 1.75, CROUCH_H = 1.1, STAND_EYE = 1.6, CROUCH_EYE = .95;
const P = { pos: new V3(0, 0, 24), vel: new V3(), r: .35, h: STAND_H, eyeH: STAND_EYE, crouchK: 0, yaw: Math.PI, pitch: 0, onGround: true, hp: 100, shield: 0, alive: true, lastHurt: -99, kills: 0, deaths: 0, streak: 0, buffT: 0, respT: 0, shakeT: 0, blindT: 0, blindMax: 1 };
const eyePos = () => new V3(P.pos.x, P.pos.y + P.eyeH, P.pos.z);
const keys = {}; let mouseL = false, mouseR = false, firedThis = false, cur = 0, wantSwap = -1, swapT = 0, reloadT = 0, adsK = 0, vmKick = 0, vmBob = 0, time = 0, state = 'menu', started = false, killTimes = [], dmgInd = [];
let recP = 0, recY = 0, throwCD = 0, throwAnim = 0, useK = 0, stepOff = 0, lastPY = 0, fullHintT = -9, use = null, held = null;
const bots = [], botById = new Map(), projs = [], nades = [], smokes = [], fires = [], remotes = new Map();
const score = { me: 0, bots: 0 };
const NET = { role: 'solo', me: 0, net: null, roster: [], code: '' };
let M = null;   // the current match (settings + mode state)
const isHost = () => NET.role !== 'client', isMP = () => NET.role !== 'solo';
const hex = c => '#' + c.toString(16).padStart(6, '0');
function disposeObj(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material !== INK) { if (c.material.map && c.material.map.isCanvasTexture) c.material.map.dispose(); c.material.dispose(); } }); }
const cleanName = s => String(s || '').replace(/[^\w \-]/g, '').trim().slice(0, 12);
const SLOTN = 5, slots = [{ gun: 0 }, null, null, null, null];   // the whole inventory: 5 slots, each a gun ({gun: type}) or an item stack ({item: id}) or empty
let selSlot = 0, holdItem = null, adsTog = false;
const AMMO = { light: { name: 'LIGHT', col: 0xffc233, max: 150, box: [30, 60] }, medium: { name: 'MEDIUM', col: 0x4aa8ff, max: 180, box: [30, 60] }, shells: { name: 'SHELLS', col: 0xff6a4a, max: 40, box: [6, 12] }, heavy: { name: 'HEAVY', col: 0x8aff3a, max: 30, box: [5, 10] }, rockets: { name: 'ROCKETS', col: 0xff4fe0, max: 12, box: [2, 4] } };
const reserve = { light: 0, medium: 0, shells: 0, heavy: 0, rockets: 0 };
let burstLeft = 0, burstT = 0;
const FREE = () => !!(M && M.free);
const slotOf = gi => slots.findIndex(e => e && e.gun === gi), itemSlot = id => slots.findIndex(e => e && e.item === id);
function resetReserve() { for (const k in reserve) reserve[k] = 0; reserve.light = 60; for (const w of W) if (w.owned) reserve[w.d.at] = Math.max(reserve[w.d.at], w.s.mag * 2); }

// ------------------------------------------------------------------ items: heals, shields, throwables
const ITEMS = {
  bandage: { name: 'BANDAGE', desc: '+15 HP (up to 75) · 1.3s',     code: 'KeyZ', key: 'Z', max: 8, use: 1.3, col: 0xffffff, kind: 'heal',   amt: 15,  cap: 75,  w: 22 },
  medkit:  { name: 'MEDKIT', desc: 'Heal to full · 3.2s',      code: 'KeyX', key: 'X', max: 2, use: 3.2, col: 0xff4a5a, kind: 'heal',   amt: 100, cap: 100, w: 8 },
  mini:    { name: 'MINI SHIELD', desc: '+25 shield (up to 50) · 1.6s', code: 'KeyV', key: 'V', max: 5, use: 1.6, col: 0x4ad0ff, kind: 'shield', amt: 25,  cap: 50,  w: 20 },
  pot:     { name: 'BIG POT', desc: '+50 shield (up to 100) · 3s',     code: 'KeyB', key: 'B', max: 2, use: 3.0, col: 0x3a62ff, kind: 'shield', amt: 50,  cap: 100, w: 8 },
  chug:    { name: 'CHUG JUG', desc: 'Full health and shield · 5s', code: 'KeyN', key: 'N', max: 1, use: 5, col: 0x9a5aff, kind: 'chug', w: 3 },
  slurp:   { name: 'SLURP JUICE', desc: '+35 HP and +25 shield · 2.5s', code: 'KeyM', key: 'M', max: 3, use: 2.5, col: 0x4aeaa0, kind: 'slurp', w: 7 },
  soda:    { name: 'SPEED SODA', desc: 'Run 35% faster for 20s · 1.2s', code: 'KeyJ', key: 'J', max: 3, use: 1.2, col: 0xffa24a, kind: 'buff', w: 7 },
  frag:    { name: 'FRAG', desc: 'One-shot kill within 3.4m, 2s fuse',        code: 'KeyG', key: 'G', max: 4, col: 0x58c24a, kind: 'nade', w: 14 },
  flash:   { name: 'FLASH', desc: 'Blinds bots (and you!)',       code: 'KeyF', key: 'F', max: 4, col: 0xfff27a, kind: 'nade', w: 10 },
  smoke:   { name: 'SMOKE', desc: 'Blocks vision for everyone',       code: 'KeyQ', key: 'Q', max: 3, col: 0xc8d0dc, kind: 'nade', w: 8 },
  molly:   { name: 'MOLLY', desc: 'Burning fire zone',       code: 'KeyC', key: 'C', max: 3, col: 0xff8a1a, kind: 'nade', w: 10 },
};
const ITEM_IDS = Object.keys(ITEMS), BY_CODE = {}; for (const id of ITEM_IDS) BY_CODE[ITEMS[id].code] = id;
const inv = {};
function putItem(id, n) { const si = slots.indexOf(null); if (si < 0) return; slots[si] = { item: id }; inv[id] = n; }
function resetInv() {
  for (const id of ITEM_IDS) inv[id] = 0; for (let i = 0; i < SLOTN; i++) if (slots[i] && slots[i].item) slots[i] = null;
  if (M && M.mode === 'royale') return;   // battle royale: you land with nothing but your pistol
  if (FREE()) { putItem('bandage', ITEMS.bandage.max); putItem('mini', ITEMS.mini.max); putItem('frag', ITEMS.frag.max); return; }
  putItem('bandage', 1); putItem('frag', 1);
}
resetInv();
const LOOT_TOTAL = ITEM_IDS.reduce((s, id) => s + ITEMS[id].w, 0);
const GUN_W = [8, 20, 18, 12, 12, 8, 12, 14, 14, 8, 6], GUN_TOTAL = GUN_W.reduce((a, b) => a + b, 0), RAR_TOTAL = RARITY.reduce((a, r) => a + r.w, 0);
function rollRarity() { let r = Math.random() * RAR_TOTAL; for (let i = 0; i < RARITY.length; i++) { r -= RARITY[i].w; if (r <= 0) return i; } return 0; }
function rollGun(gi) { if (gi === undefined) { let r = Math.random() * GUN_TOTAL; gi = 0; for (let i = 0; i < GUN_W.length; i++) { r -= GUN_W[i]; if (r <= 0) { gi = i; break; } } } return { id: 'gun', qty: 1, gi, rar: rollRarity() }; }
function rollAmmo() {
  const own = {}; for (const w of W) if (w.owned) own[w.d.at] = (own[w.d.at] || 0) + 3; const types = Object.keys(AMMO), ws = types.map(t => 1 + (own[t] || 0)); let r = Math.random() * ws.reduce((a, b) => a + b, 0), at = types[0];
  for (let i = 0; i < types.length; i++) { r -= ws[i]; if (r <= 0) { at = types[i]; break; } } const b = AMMO[at].box; return { id: 'ammo', at, qty: rint(b[0], b[1]) };
}
function rollLoot() {
  const p = M && M.mode === 'royale' ? .3 : .2, q = Math.random(); if (q < p) return rollGun(); if (q < p + .2) return rollAmmo();
  let r = Math.random() * LOOT_TOTAL; for (const id of ITEM_IDS) { r -= ITEMS[id].w; if (r <= 0) return { id, qty: id === 'bandage' ? rint(1, 3) : (id === 'mini' || id === 'frag') ? rint(1, 2) : 1 }; } return { id: 'bandage', qty: 1 };
}

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
    case 'chug': add(C(.2, .22, .46), 0x9a5aff); add(C(.1, .12, .1), 0x9a5aff, 0, .28, 0); add(C(.11, .11, .06), 0xb87a3a, 0, .36, 0); add(new THREE.TorusGeometry(.1, .025, 6, 12), 0xffd34e, .22, .05, 0, false, [0, 0, 0]); add(B(.18, .02, .02), 0xffffff, 0, .06, .22, true); break;
    case 'slurp': add(C(.14, .1, .36), 0x4aeaa0); add(C(.15, .15, .05), 0xffffff, 0, .21, 0); add(C(.015, .015, .26), 0xff4a8a, .03, .3, 0, false, [0, 0, -.2]); add(Sp(.07), 0xffd34e, 0, .1, .12, true); break;
    case 'soda': add(C(.11, .11, .34), 0xffa24a); add(C(.1, .11, .04), 0xdfe6ee, 0, .19, 0); add(C(.112, .112, .1), 0xffffff, 0, 0, 0); add(B(.1, .02, .02), 0xff4a4a, 0, .02, .115, true); break;
    case 'shell': add(C(.07, .07, .22), 0xff8a3a); add(Sp(.07), 0xffd34e, 0, .11, 0); add(C(.075, .075, .05), 0x2a2a3a, 0, -.12, 0); break;
    default: { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.42), toon(0xff4fe0, { emissive: 0xff4fe0, emissiveIntensity: .5 })); outline(m, 1.12); g.add(m); }
  }
  return g;
}
function ammoModel(at) {
  const g = new THREE.Group(), col = AMMO[at].col;
  const box = new THREE.Mesh(new THREE.BoxGeometry(.6, .34, .4), toon(0x4a4f63)); outline(box, 1.08); g.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(.62, .06, .42), toon(0x2f3345)); lid.position.y = .2; g.add(lid);
  const band = new THREE.Mesh(new THREE.BoxGeometry(.16, .36, .42), new THREE.MeshBasicMaterial({ color: col })); g.add(band);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .2, 8), new THREE.MeshBasicMaterial({ color: col })); b.position.set(-.18 + i * .18, .34, .0); g.add(b); }
  return g;
}


// ------------------------------------------------------------------ pickups (loot spots + bot drops)
// The host owns the list (every pickup has a network id); clients ask the host to claim what they walk over.
const pickups = [], pkById = new Map(); let nextPk = 1;
function addPickup(loot, x, y, z, o = {}) {
  const g = new THREE.Group(), core = new THREE.Group(); g.add(core);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.7, .85, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -.55; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 1.9; beam.visible = false; g.add(beam);
  g.position.set(x, y + 1.05, z); scene.add(g);
  const pk = { g, core, ring, beam, nid: o.nid || nextPk++, id: null, qty: 0, gi: 0, rar: 0, x, y, z, t: 0, on: true, fixed: o.fixed || null, fixedLoot: o.fixedLoot || null, rt: o.rt || 0, temp: !!o.temp, ttl: o.ttl || 0, col: 0xffffff, css: '#fff', claimT: -9 };
  setPickup(pk, loot); pickups.push(pk); pkById.set(pk.nid, pk); return pk;
}
function setPickup(pk, loot) {
  while (pk.core.children.length) { const c = pk.core.children[0]; pk.core.remove(c); disposeObj(c); }
  pk.id = loot.id; pk.qty = loot.qty || 1; pk.gi = loot.gi || 0; pk.rar = loot.rar || 0; pk.at = loot.at || null;
  if (pk.id === 'gun') { pk.col = RARITY[pk.rar].col; const m = GUNS[WDEF[pk.gi].id]().g; m.scale.setScalar(1.7); pk.core.add(m); pk.beam.visible = true; pk.beam.material.color.setHex(pk.col); pk.beam.material.opacity = .14 + pk.rar * .06; }
  else if (pk.id === 'ammo') { pk.col = AMMO[pk.at].col; const m = ammoModel(pk.at); m.scale.setScalar(1.5); pk.core.add(m); pk.beam.visible = false; }
  else { pk.col = pk.id === 'dmg' ? 0xff4fe0 : ITEMS[pk.id].col; const m = itemModel(pk.id); m.scale.setScalar(1.6); pk.core.add(m); pk.beam.visible = false; }
  pk.css = hex(pk.col); pk.ring.material.color.setHex(pk.col); pk.on = true; pk.g.visible = true; pk.claimT = -9;
}
const lootOf = pk => pk.id === 'gun' ? { id: 'gun', qty: 1, gi: pk.gi, rar: pk.rar } : pk.id === 'ammo' ? { id: 'ammo', at: pk.at, qty: pk.qty } : { id: pk.id, qty: pk.qty };
const wirePk = pk => ({ n: pk.nid, id: pk.id, q: pk.qty, gi: pk.gi, ra: pk.rar, at: pk.at, x: pk.x, y: pk.y, z: pk.z, f: pk.fixed ? 1 : 0, tmp: pk.temp ? 1 : 0, on: pk.on ? 1 : 0 });
const lootFromWire = w => ({ id: w.id, qty: w.q, gi: w.gi, rar: w.ra, at: w.at });
function clearPickups() { for (const pk of pickups) { scene.remove(pk.g); disposeObj(pk.g); } pickups.length = 0; pkById.clear(); for (const c of chests) { scene.remove(c.g); disposeObj(c.g); } chests.length = 0; chestById.clear(); }
function buildPickupsFromWire(list) { clearPickups(); for (const w of list) { const pk = addPickup(lootFromWire(w), w.x, w.y, w.z, { nid: w.n, fixed: w.f ? w.id : null, temp: !!w.tmp, ttl: 999 }); if (w.on === 0) { pk.on = false; pk.g.visible = false; } } }
// host: roll a brand new set of loot for the whole map (a few guns are guaranteed so nobody is stuck with just the pistol)
function freeplayLoot() {
  // an armory: every gun at the chosen rarity plus ammo, restocking within seconds
  const spots = LOOT_SPOTS.concat(CHEST_SPOTS); let k = 0;
  for (let gi = 0; gi < WDEF.length && k < spots.length; gi++, k++) { const [x, z, y] = spots[k], l = { id: 'gun', qty: 1, gi, rar: M.rarity }; addPickup(l, x, y, z, { fixedLoot: l, rt: 2.5 }); }
  for (const at of Object.keys(AMMO)) { if (k >= spots.length) break; const [x, z, y] = spots[k++], l = { id: 'ammo', at, qty: AMMO[at].box[1] }; addPickup(l, x, y, z, { fixedLoot: l, rt: 3 }); }
  let wi = 0; for (const id of ITEM_IDS) { const w = WAYPOINTS[(wi++ * 7 + 3) % WAYPOINTS.length], l = { id, qty: ITEMS[id].max }; addPickup(l, w.x, 0, w.z, { fixedLoot: l, rt: 3 }); }   // item racks too
  return pickups.map(wirePk);
}
function hostRollPickups(np) {
  clearPickups(); if (M && M.free) return freeplayLoot(); let forced = 0; const br = M && M.mode === 'royale', nForce = br ? 4 + np : 5 + (np - 1);
  const spots = br ? LOOT_SPOTS.slice().sort(() => Math.random() - .5).slice(0, 14 + 5 * np) : LOOT_SPOTS;   // battle royale: big map, only a little loot
  for (const [x, z, y] of spots) addPickup(forced < nForce ? rollGun(1 + (forced++ % (WDEF.length - 1))) : rollLoot(), x, y, z);
  for (const [x, y, z] of (br ? DMG_SPOTS.slice().sort(() => Math.random() - .5).slice(0, 2) : DMG_SPOTS)) addPickup({ id: 'dmg' }, x, y, z, { fixed: 'dmg' });
  buildChests(); return pickups.map(wirePk);
}
function dropLoot(pos) {
  if (!isHost() || Math.random() > .6 || pickups.filter(p => p.temp).length >= 12) return;
  const pk = addPickup(rollLoot(), pos.x, pos.y, pos.z, { temp: true, ttl: 30 }); if (isMP()) NET.net.hostBroadcast({ t: 'pka', w: wirePk(pk) });
}
function removePickup(pk) { scene.remove(pk.g); disposeObj(pk.g); const i = pickups.indexOf(pk); if (i >= 0) pickups.splice(i, 1); pkById.delete(pk.nid); }
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i]; pk.core.rotation.y += dt * 2; pk.g.position.y = pk.y + 1.05 + Math.sin(time * 3 + pk.x) * .12;
    if (!isHost()) continue;
    if (pk.temp) { pk.ttl -= dt; if (pk.ttl <= 0 || !pk.on) { if (isMP()) NET.net.hostBroadcast({ t: 'pkx', n: pk.nid }); removePickup(pk); } continue; }
    if (!pk.on) { if (M && M.mode === 'royale') continue; pk.t -= dt; if (pk.t <= 0) { setPickup(pk, pk.fixedLoot ? pk.fixedLoot : pk.fixed ? { id: pk.fixed } : rollLoot()); if (isMP()) NET.net.hostBroadcast({ t: 'pks', w: wirePk(pk) }); } }
  }
}
// could the local player make use of this loot right now?
function lootUseful(l) {
  if (l.id === 'gun') { const w = W[l.gi]; return !(w.owned && l.rar <= w.rar); }
  if (l.id === 'dmg') return true;
  if (l.id === 'ammo') return !FREE() && reserve[l.at] < AMMO[l.at].max;
  return itemSlot(l.id) >= 0 ? inv[l.id] < ITEMS[l.id].max : true;   // a new stack needs a free slot, or swaps with the slot in your hand
}
function whyNot(l) {
  if (time - fullHintT < 1.2) return; fullHintT = time;
  if (l.id === 'gun') hint('YOU HAVE A BETTER ' + WDEF[l.gi].name, '#ffd34e'); else if (l.id === 'ammo') hint(FREE() ? 'AMMO IS UNLIMITED HERE' : AMMO[l.at].name + ' AMMO FULL', '#ffd34e'); else hint(ITEMS[l.id].name + ' FULL', '#ffd34e');
}
function lootLabel(l) {
  if (l.id === 'gun') return RARITY[l.rar].name + ' ' + WDEF[l.gi].name; if (l.id === 'ammo') return '+' + l.qty + ' ' + AMMO[l.at].name + ' AMMO'; if (l.id === 'dmg') return 'DOUBLE DAMAGE';
  return (l.qty > 1 ? '+' + l.qty + ' ' : '') + ITEMS[l.id].name;
}
const chests = [], chestById = new Map();
let nextCh = 1;
function makeChest() {
  const g = new THREE.Group(), wood = toon(0x8a5a2a), woodL = toon(0xa06a34), gold = toon(0xffd34e);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, .62, .8), wood); body.position.y = .31; outline(body, 1.05); g.add(body);
  for (const x of [-.42, .42]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.1, .64, .82), gold); b.position.set(x, .31, 0); g.add(b); }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(.18, .2, .06), gold); lock.position.set(0, .5, .42); g.add(lock);
  const pivot = new THREE.Group(); pivot.position.set(0, .62, -.4); g.add(pivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.3, .22, .8), woodL); lid.position.set(0, .11, .4); outline(lid, 1.05); pivot.add(lid);
  for (const x of [-.42, .42]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.1, .24, .82), gold); b.position.set(x, .11, .4); pivot.add(b); }
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 5, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34e, transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide })); glow.position.y = 2.6; g.add(glow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.95, 1.15, 28), new THREE.MeshBasicMaterial({ color: 0xffd34e, transparent: true, opacity: .55, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; g.add(ring);
  return { g, pivot, glow, ring };
}
function addChest(x, z, nid, open) {
  const m = makeChest(); m.g.position.set(x, 0, z); m.g.rotation.y = Math.atan2(-x, -z); scene.add(m.g);
  const ch = Object.assign({ nid, x, z, open: !!open, respT: 0, a: open ? 1 : 0 }, m); chests.push(ch); chestById.set(nid, ch); m.pivot.rotation.x = -ch.a * 1.25; return ch;
}
const chestWire = () => chests.map(c => [c.nid, c.x, c.z, c.open ? 1 : 0]);
function buildChestsFromWire(list) { for (const c of chests) { scene.remove(c.g); disposeObj(c.g); } chests.length = 0; chestById.clear(); for (const [n, x, z, o] of list || []) addChest(x, z, n, o); }
function buildChests() { const spots = M && M.mode === 'royale' ? CHEST_SPOTS.slice().sort(() => Math.random() - .5).slice(0, 4 + (M.np || 1)) : CHEST_SPOTS; for (const [x, z] of spots) addChest(x, z, nextCh++, false); }
function rollConsumable() { let r = Math.random() * LOOT_TOTAL; for (const id of ITEM_IDS) { r -= ITEMS[id].w; if (r <= 0) return { id, qty: id === 'bandage' ? rint(1, 3) : (id === 'mini' || id === 'frag') ? rint(1, 2) : 1 }; } return { id: 'bandage', qty: 1 }; }
function chestLoot() { const gun = rollGun(); gun.rar = Math.min(4, rollRarity() + (Math.random() < .55 ? 1 : 0)); return [gun, rollAmmo(), rollConsumable(), Math.random() < .5 ? rollConsumable() : rollAmmo()]; }
function openChestFx(ch) { ch.open = true; const c = new V3(ch.x, .8, ch.z); burst(c, 0xffd34e, 22, 6, .16, .9, 8, 4); burst(c, 0xffffff, 10, 5, .1, .6, 8, 3); sfxAt('medal', c); }
function hostOpenChest(ch) {
  if (ch.open) return; ch.respT = 75; openChestFx(ch); if (isMP()) NET.net.hostBroadcast({ t: 'cho', n: ch.nid });
  const loots = chestLoot(); loots.forEach((l, i) => { const ang = i / loots.length * 6.283 + .6, px = ch.x + Math.cos(ang) * 1.8, pz = ch.z + Math.sin(ang) * 1.8, pk = addPickup(l, px, groundY(px, pz, 2), pz, { temp: true, ttl: 45 }); if (isMP()) NET.net.hostBroadcast({ t: 'pka', w: wirePk(pk) }); });
}
function openChest(ch) { if (ch.open) return; if (isHost()) hostOpenChest(ch); else if (time - (ch.reqT || -9) > .6) { ch.reqT = time; NET.net.clientSend({ t: 'pl', p: myStateArr() }); NET.net.clientSend({ t: 'copen', n: ch.nid }); } }
function updateChests(dt) {
  for (const ch of chests) {
    ch.a += ((ch.open ? 1 : 0) - ch.a) * Math.min(1, dt * 7); ch.pivot.rotation.x = -ch.a * 1.25; const vis = !ch.open; ch.glow.visible = vis; ch.ring.visible = vis; if (vis) ch.ring.rotation.z += dt;
    if (isHost() && M && !M.over && ch.open && M.mode !== 'royale' && !M.free) { ch.respT -= dt; if (ch.respT <= 0) { ch.open = false; if (isMP()) NET.net.hostBroadcast({ t: 'chc', n: ch.nid }); } }
  }
}
// what you'd press E on right now (nearest pickup, or a chest when one is closer)
function nearestInteract() {
  let best = null, bd = 2.6;
  for (const pk of pickups) { if (!pk.on) continue; const d = Math.hypot(P.pos.x - pk.x, P.pos.z - pk.z); if (d < bd && Math.abs(P.pos.y - pk.y) < 1.9) { bd = d; best = { k: 'pk', o: pk, col: hex(pk.col) }; } }
  for (const ch of chests) { if (ch.open) continue; const d = Math.hypot(P.pos.x - ch.x, P.pos.z - ch.z) - .4; if (d < Math.min(bd, 2.6)) { bd = d; best = { k: 'ch', o: ch, col: '#ffd34e' }; } }
  return best;
}
function promptText(t) {
  if (t.k === 'ch') return 'Open chest';
  const l = lootOf(t.o), lab = lootLabel(l); if (!lootUseful(l)) return lab + '  (cannot carry more)';
  const full = slots.indexOf(null) < 0, drops = ' (drops ' + slotLabel(selSlot) + ')';
  if (l.id === 'gun') return W[l.gi].owned ? 'Upgrade to ' + lab : full ? 'Swap for ' + lab + drops : 'Pick up ' + lab;
  if (l.id === 'ammo' || l.id === 'dmg') return 'Pick up ' + lab;
  return itemSlot(l.id) < 0 && full ? 'Swap for ' + lab + drops : 'Pick up ' + lab;
}
function interact() { const t = nearestInteract(); if (!t || !P.alive) return; if (t.k === 'pk') tryCollect(t.o); else openChest(t.o); }
function tryCollect(pk) {
  const loot = lootOf(pk); if (!lootUseful(loot)) { whyNot(loot); return; }
  if (isHost()) hostGrant(pk, 0);
  else if (time - pk.claimT > .5) { pk.claimT = time; NET.net.clientSend({ t: 'pl', p: myStateArr() }); NET.net.clientSend({ t: 'claim', n: pk.nid }); }
}
// host: hand a pickup to a player (pid 0 = the host itself)
function hostGrant(pk, pid) {
  if (!pk.on) return; const loot = lootOf(pk); takePickupFx(pk); pk.on = false; pk.t = pk.rt || (pk.fixed ? 35 : 24);
  if (isMP()) NET.net.hostBroadcast({ t: 'pkt', n: pk.nid });
  if (pid === 0) applyLoot(loot); else NET.net.hostSend(pid, { t: 'grant', l: loot });
}
function takePickupFx(pk) { pk.g.visible = false; burst(new V3(pk.x, pk.y + 1, pk.z), pk.col, 14, 5, .12, .7, 8, 2); sfxAt('pick', new V3(pk.x, pk.y, pk.z)); }
const slotLabel = si => { const e = slots[si]; return !e ? 'nothing' : e.gun !== undefined ? WDEF[e.gun].name : ITEMS[e.item].name; };
function giveGun(gi, rar) {
  const w = W[gi];
  if (w.owned) { if (rar <= w.rar) return null; w.rar = rar; applyRarity(w); w.ammo = w.s.mag; return 'up'; }
  let si = slots.indexOf(null);
  if (si < 0) { si = selSlot; dropSlot(si); }   // bag full: whatever is in your hand drops
  slots[si] = { gun: gi }; w.owned = true; w.rar = rar; applyRarity(w); w.ammo = w.s.mag; w.cd = 0;
  if (!FREE()) reserve[w.d.at] = Math.min(AMMO[w.d.at].max, reserve[w.d.at] + w.s.mag);
  return 'new';
}
function giveItem(id, qty) {
  const it = ITEMS[id]; let si = itemSlot(id);
  if (si >= 0) { const n = Math.min(it.max - inv[id], qty); inv[id] += n; if (holdItem === id) refreshAmmo(); refreshSlots(); return n; }
  si = slots.indexOf(null); const swapped = si < 0; if (swapped) { si = selSlot; dropSlot(si); }
  slots[si] = { item: id }; inv[id] = Math.min(it.max, qty); if (swapped) selectSlot(si); refreshSlots(); return inv[id];
}
function dropSlot(si) {
  const e = slots[si]; if (!e) return;
  if (e.gun !== undefined) { const w = W[e.gun]; dropGunAt(e.gun, w.rar, P.pos); w.owned = false; }
  else { dropItemAt(e.item, inv[e.item], P.pos); inv[e.item] = 0; if (holdItem === e.item) clearHold(); }
  slots[si] = null;
}
function dropGunAt(gi, rar, pos) {
  const loot = { id: 'gun', qty: 1, gi, rar };
  if (isHost()) { const pk = addPickup(loot, pos.x, pos.y, pos.z, { temp: true, ttl: 40 }); if (isMP()) NET.net.hostBroadcast({ t: 'pka', w: wirePk(pk) }); } else NET.net.clientSend({ t: 'drop', gi, rar });
}
function dropItemAt(id, qty, pos) {
  if (qty <= 0) return; const loot = { id, qty };
  if (isHost()) { const pk = addPickup(loot, pos.x, pos.y, pos.z, { temp: true, ttl: 40 }); if (isMP()) NET.net.hostBroadcast({ t: 'pka', w: wirePk(pk) }); } else NET.net.clientSend({ t: 'drop', id, qty });
}
function applyLoot(l) {
  if (l.id === 'gun') {
    const R = RARITY[l.rar], nm = WDEF[l.gi].name, r = giveGun(l.gi, l.rar); if (!r) return;
    feed(`<b style="color:${hex(R.col)}">${r === 'up' ? 'UPGRADED' : '+'} ${R.name} ${nm}</b>`); if (l.rar >= 3) { showCenter(`${R.name} ${nm}!`, hex(R.col)); sfx('medal'); }
    if (r === 'new') { if (holdItem || !W[cur].owned) selectWeapon(l.gi, !W[cur].owned); else selectWeapon(l.gi); } refreshSlots(); refreshAmmo();
  } else if (l.id === 'ammo') { const A = AMMO[l.at], n = Math.min(A.max - reserve[l.at], l.qty); reserve[l.at] += n; feed(`<b style="color:${hex(A.col)}">+${n} ${A.name} AMMO</b>`); refreshAmmo(); }
  else if (l.id === 'dmg') { P.buffT = 12; feed('<b style="color:#ff8aff">DOUBLE DAMAGE!</b>'); showCenter('DOUBLE DAMAGE!', '#ff8aff'); }
  else { const it = ITEMS[l.id], n = giveItem(l.id, l.qty); feed(`<b style="color:${hex(it.col)}">+${n} ${it.name}</b>`); refreshItems(); }
}

// ------------------------------------------------------------------ robot model (enemies, bosses and teammates)
function makeBotModel(color, opts = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mat = toon(color), dark = toon(0x2a2140), white = toon(opts.player ? 0xdff6ff : 0xf4f0ff);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .45, 4, 12), mat); torso.position.y = 1.0; torso.castShadow = true; outline(torso, 1.07); body.add(torso);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .12, 14), white); belly.position.y = .82; body.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), white); head.position.y = 1.62; head.castShadow = true; outline(head, 1.07); body.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.42, .17, .2), dark); visor.position.set(0, 1.64, -.2); body.add(visor);
  const eyeM = new THREE.MeshBasicMaterial({ color: opts.player ? 0x4aff8a : 0x2ee6ff }); const e1 = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), eyeM), e2 = e1.clone(); e1.position.set(-.1, 1.65, -.3); e2.position.set(.1, 1.65, -.3); body.add(e1, e2);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .22, 6), dark); ant.position.set(0, 2.0, 0); const ball = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), mat); ball.position.set(0, 2.14, 0); body.add(ant, ball);
  if (opts.player) { const d = new THREE.Mesh(new THREE.OctahedronGeometry(.13), new THREE.MeshBasicMaterial({ color })); d.position.set(0, 2.4, 0); body.add(d); }   // teammate marker
  if (opts.boss) for (const sx of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(.1, .4, 8), toon(0xffd34e)); horn.position.set(sx * .22, 1.98, 0); horn.rotation.z = -sx * .45; outline(horn, 1.1); body.add(horn); }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(.18, .5, .2), dark), legR = legL.clone(); legL.position.set(-.15, .25, 0); legR.position.set(.15, .25, 0); outline(legL, 1.08); outline(legR, 1.08); body.add(legL, legR);
  const arm = new THREE.Group(); arm.position.set(.34, 1.12, -.05); const gun = new THREE.Mesh(new THREE.BoxGeometry(.1, .12, .5), dark); gun.position.set(0, 0, -.28); outline(gun, 1.08); const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .22, 3, 8), mat); sleeve.rotation.x = Math.PI / 2; sleeve.position.set(0, 0, -.1); arm.add(gun, sleeve); body.add(arm);
  const bar = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(.9, .1), new THREE.MeshBasicMaterial({ color: 0x120a24, depthTest: false, transparent: true })), fg = new THREE.Mesh(new THREE.PlaneGeometry(.86, .06), new THREE.MeshBasicMaterial({ color: 0x4aff8a, depthTest: false })); fg.position.z = .001; bg.renderOrder = 10; fg.renderOrder = 11; bar.add(bg, fg); bar.position.y = 2.45; g.add(bar);
  if (opts.scale) g.scale.setScalar(opts.scale);
  if (!QL.shadow) { const bs = new THREE.Mesh(new THREE.CircleGeometry(.5, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false })); bs.rotation.x = -Math.PI / 2; bs.position.y = .04; g.add(bs); }   // blob shadow when real shadows are off
  return { g, body, torso, head, legL, legR, arm, mat, bar, fg, eyeM };
}

// ------------------------------------------------------------------ teammates (other human players)
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };
class RemotePlayer {
  constructor(pid, name, color) {
    this.pid = pid; this.name = name; this.color = color; this.m = makeBotModel(color, { player: true }); this.m.g.visible = false; scene.add(this.m.g);
    this.pos = new V3(); this.tpos = new V3(); this.vel = new V3(); this.yaw = 0; this.tyaw = 0; this.pitch = 0; this.alive = false; this.seen = false; this.r = .35; this.h = STAND_H; this.eyeH = STAND_EYE; this.crouch = 0;
    this.hp = 100; this.kills = 0; this.deaths = 0; this.wi = 0; this.rar = 0; this.lastMsg = performance.now();
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d'); x.font = '900 34px "Trebuchet MS", sans-serif'; x.textAlign = 'center'; x.lineWidth = 7; x.strokeStyle = 'rgba(10,6,24,.9)'; x.strokeText(name, 128, 44); x.fillStyle = hex(color); x.fillText(name, 128, 44);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); this.tag.scale.set(2.2, .55, 1); this.tag.position.y = 2.95; this.tag.renderOrder = 12; this.m.g.add(this.tag);
  }
  // a = [x, y, z, yaw, pitch, crouch, alive, weaponIdx, rarity, hp%, kills, deaths]
  setState(a) {
    const was = this.alive; this.tpos.set(a[0], a[1], a[2]); this.tyaw = a[3]; this.pitch = a[4]; this.crouch = a[5]; this.alive = !!a[6]; this.wi = a[7]; this.rar = a[8]; this.hp = a[9]; this.kills = a[10]; this.deaths = a[11];
    this.h = STAND_H - (STAND_H - CROUCH_H) * this.crouch; this.eyeH = STAND_EYE - (STAND_EYE - CROUCH_EYE) * this.crouch;
    if (!this.seen || (this.alive && !was)) { this.pos.copy(this.tpos); this.yaw = this.tyaw; } this.seen = true; this.lastMsg = performance.now();
  }
  update(dt) {
    const m = this.m, vis = this.alive && this.seen; m.g.visible = vis; if (!vis) return;
    const px = this.pos.x, pz = this.pos.z, k = 1 - Math.exp(-dt * 14);
    if (this.pos.distanceTo(this.tpos) > 6) this.pos.copy(this.tpos); else this.pos.lerp(this.tpos, k);
    this.yaw += angDiff(this.tyaw, this.yaw) * k;
    const sp = Math.hypot(this.pos.x - px, this.pos.z - pz) / Math.max(dt, .001), ph = time * (6 + sp * 1.4);
    m.g.position.copy(this.pos); m.body.rotation.y = this.yaw; m.body.scale.y = 1 - .28 * this.crouch;
    m.legL.rotation.x = Math.sin(ph) * .8 * Math.min(1, sp / 3); m.legR.rotation.x = -Math.sin(ph) * .8 * Math.min(1, sp / 3); m.body.position.y = Math.abs(Math.sin(ph)) * .06 * Math.min(1, sp / 3);
    m.arm.rotation.x = clamp(this.pitch, -.9, .9);
    m.bar.visible = !(M && M.pvp); m.bar.quaternion.copy(camera.quaternion); const f = clamp(this.hp / 100, .001, 1); m.fg.scale.x = f; m.fg.position.x = -(1 - f) * .43;
  }
  dispose() { scene.remove(this.m.g); disposeObj(this.m.g); }
}

// ------------------------------------------------------------------ throwables + rockets: frag, flash, smoke, molly
// Every peer simulates every grenade (so everyone sees it). Damage to bots is only applied by the host; each player applies damage to themselves.
// owner: null = me, RemotePlayer = a teammate, Bot = an enemy
const ownerPid = o => o === null ? NET.me : (o instanceof RemotePlayer ? o.pid : -1);
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, v3a = v => [r2(v.x), r2(v.y), r2(v.z)];
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
    if (n.id === 'shell' && impact > 1.5 && n.age > .06) boom = true;
    if (n.id === 'smoke' && n.age > .5 && rolling && Math.hypot(n.vel.x, n.vel.z) < .8) boom = true;
    if (boom) { const p = n.pos.clone(); scene.remove(n.m); disposeObj(n.m); nades.splice(i, 1); detonate(n.id, p, n.owner); }
  }
}
function detonate(id, p, owner) {
  if (id === 'frag') explodeAt(p, 6.5, 120, 75, owner, owner instanceof Bot ? 2.2 : 3.4);
  else if (id === 'flash') flashAt(p, owner);
  else if (id === 'smoke') deploySmoke(p);
  else if (id === 'shell') explodeAt(p, 4.8, 90, 40, owner);
  else ignite(p, owner);
}
// tell everyone else about something I did (clients -> host -> everyone else; the host -> everyone)
function netEvent(msg) { if (!isMP() || !NET.net) return; if (NET.role === 'client') NET.net.clientSend(msg); else NET.net.hostBroadcast(Object.assign({ o: 0 }, msg)); }
function playerThrow(id) {
  if (state !== 'play' || !P.alive) return;
  if (use || throwCD > 0 || swapT > 0) return;
  if (inv[id] <= 0) { hint('NO ' + ITEMS[id].name, '#ff8a8a'); sfx('empty'); return; }
  inv[id]--; throwCD = .6; throwAnim = .35; refreshItems(); sfx('throw');
  const o = eyePos(), d = aimDir(0); let s = o.clone().addScaledVector(d, .7); s.y -= .15;
  if (worldT(o, d, .8) < .8) s = o.clone();
  const v = d.clone().multiplyScalar(19).add(new V3(P.vel.x * .5, 3.8, P.vel.z * .5));
  spawnNade(id, s, v, null); netEvent({ t: 'th', id, p: v3a(s), v: v3a(v) });
}
function botThrow(b, id, tgt) {
  const from = new V3(b.pos.x, b.pos.y + 1.4 * b.sc, b.pos.z), sc = 1.1 + Math.hypot(tgt.x - from.x, tgt.z - from.z) * .07;
  const tx = tgt.x + rnd(-sc, sc), tz = tgt.z + rnd(-sc, sc), d = Math.hypot(tx - from.x, tz - from.z) || 1, dy = tgt.y - from.y;
  const v = clamp(Math.sqrt(G * d * d / Math.max(2, d - dy)), 7, 28), hx = (tx - from.x) / d, hz = (tz - from.z) / d, c = Math.SQRT1_2;
  b.yaw = Math.atan2(-hx, -hz); const s = from.add(new V3(hx * .6, 0, hz * .6)), vel = new V3(hx * v * c, v * c, hz * v * c);
  spawnNade(id, s, vel, b); sfxAt('throw', b.pos); if (isMP()) NET.net.hostBroadcast({ t: 'th', id, p: v3a(s), v: v3a(vel), ob: b.id });
}
function spawnRocket(pos, vel, dmg, owner) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 1), new THREE.MeshBasicMaterial({ color: 0xff4fe0 })); m.position.copy(pos); scene.add(m); outline(m, 1.3);
  projs.push({ m, v: vel.clone(), life: 4, dmg, owner });
}
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.life -= dt; const step = p.v.clone().multiplyScalar(dt), len = step.length(), dir = step.clone().normalize(); const tw = worldT(p.m.position, dir, len + .3);
    let hitB = null; for (const b of bots) if (b.alive && b.invT <= 0) { const h = hitEntity(p.m.position, dir, b, b.headY); if (h && h.t < len + .3) hitB = b; }
    if (tw < len + .3 || hitB || p.life <= 0 || p.m.position.y < .1) { explodeAt(p.m.position.clone().addScaledVector(dir, Math.min(tw, len) * .9), 5.5, p.dmg, 35, p.owner); scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); projs.splice(i, 1); }
    else { p.m.position.add(step); if (Math.random() < .6) burst(p.m.position, 0xff9ad8, 1, 1, .08, .3, 0); }
  }
}
function explodeAt(pos, R, botDmg, selfDmg, owner, lethal = 0) {
  blast(pos, R, 0xff8a3a); const dp = pos.distanceTo(P.pos); sfx('explode', clamp(1 - dp / 60, .3, 1)); P.shakeT = Math.max(P.shakeT, .4 * clamp(1 - dp / 24, 0, 1));
  const src = pos.clone(), op = ownerPid(owner); src.y += .3;
  if (isHost() && op >= 0) {
    const mul = (owner === null && P.buffT > 0) ? 2 : 1;
    for (const b of bots) {
      if (!b.alive) continue; const c = new V3(b.pos.x, b.pos.y + b.sc, b.pos.z), d = c.distanceTo(pos);
      if (d < R + b.r && worldT(src, c.clone().sub(src).normalize(), d) >= d - .5) {
        let dm = botDmg * mul * (1 - Math.min(1, d / R) * .75); if (lethal && d <= lethal + b.r) dm = Math.max(dm, b.boss ? 450 : 9999); const k = b.hurt(dm, false, op); if (op === NET.me) { showHit(k ? 'kill' : ''); if (!k) sfx('hit'); }
        const push = c.sub(pos).setY(0).normalize().multiplyScalar(6 / b.sc); b.vel.x += push.x; b.vel.z += push.z;
      }
    }
  }
  if (P.alive) {
    const pc = new V3(P.pos.x, P.pos.y + 1, P.pos.z), d = pc.distanceTo(pos);
    if (d < R && worldT(src, pc.clone().sub(src).normalize(), d) >= d - .5) {
      const ff = owner instanceof RemotePlayer && !(M && M.pvp); let dmg = selfDmg * (1 - d / R * .85) * (ff ? .4 : 1); if (lethal && d <= lethal && !ff && owner !== null) dmg = 9999; if (dmg > 3) damagePlayer(dmg, owner, owner === null);   // your own frag hurts you but never one-shots you
      const push = pc.sub(pos).normalize().multiplyScalar(11 * (1 - d / R)); P.vel.x += push.x; P.vel.z += push.z; P.vel.y = Math.max(P.vel.y, push.y * .8 + 2);
    }
  }
}
function flashAt(pos, owner) {
  blast(pos, 3.2, 0xffffff); burst(pos, 0xffffff, 20, 9, .12, .5, 4, 1); sfx('flashbang', clamp(1 - pos.distanceTo(P.pos) / 60, .3, 1));
  const lp = pos.clone(), op = ownerPid(owner); lp.y += .3;
  const power = (eye, fwd) => { const to = lp.clone().sub(eye), d = to.length(); if (d > 45) return 0; to.divideScalar(Math.max(d, .01)); if (d > 1 && worldT(eye, to, d) < d - .4) return 0; const f = fwd.dot(to); return (f > 0 ? .35 + .65 * f : .12) * clamp(1.15 - d / 42, .2, 1); };
  if (P.alive) { const p = power(eyePos(), aimDir(0)) * (owner instanceof RemotePlayer && !(M && M.pvp) ? .6 : 1); if (p > .05) { P.blindMax = 4.4 * p + .4; P.blindT = Math.max(P.blindT, P.blindMax); } }
  if (isHost() && op >= 0) {
    let n = 0;
    for (const b of bots) { if (!b.alive) continue; const f = new V3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw)), p = power(b.eye(), f); if (p > .08) { b.blindT = Math.max(b.blindT, 4.2 * p + .5); b.alertT = Math.max(b.alertT, 2); n++; } }
    if (n && op === NET.me) { feed(`<b style="color:#fff27a">Flashed ${n} bot${n > 1 ? 's' : ''}!</b>`); showHit(''); sfx('hit'); }
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
    f.tick += dt; const op = ownerPid(f.owner);
    while (f.tick >= .25) {
      f.tick -= .25;
      if (isHost() && op >= 0) for (const b of bots) { if (!b.alive) continue; if (Math.hypot(b.pos.x - f.pos.x, b.pos.z - f.pos.z) < f.R + b.r * .5 && b.pos.y < f.pos.y + 1.4 && b.pos.y > f.pos.y - .8) { const kd = b.hurt(5, false, op); if (op === NET.me) showHit(kd ? 'kill' : ''); } }
      if (P.alive && Math.hypot(P.pos.x - f.pos.x, P.pos.z - f.pos.z) < f.R && P.pos.y < f.pos.y + 1.4 && P.pos.y > f.pos.y - .8) damagePlayer(5 * (f.owner instanceof RemotePlayer && !(M && M.pvp) ? .4 : 1), f.owner, f.owner === null);
    }
    if (f.t >= f.life) { scene.remove(f.g); for (const m of f.mats) m.dispose(); fires.splice(i, 1); }
  }
}


// ------------------------------------------------------------------ bots
// The host runs the real AI. Everyone else gets "puppet" bots that follow the host's snapshots.
let frameTargets = [];   // alive players the bots can go after this frame (host only)
const tgtEye = t => new V3(t.pos.x, t.pos.y + t.eyeH, t.pos.z);
function hurtTarget(t, dmg, bot) { if (t === P) damagePlayer(dmg, bot); else if (NET.net && t.pid !== undefined) NET.net.hostSend(t.pid, { t: 'dmg', d: r1(dmg), b: bot.id }); }
function botDeathFx(b) {
  const c = b.eye(); burst(c, b.color, 26, 9, .2, 1.1, 12, 4); burst(c, 0xffffff, 12, 7, .14, .8, 12, 3); burst(c, 0xffd34e, 8, 6, .22, 1, 12, 5); blast(new V3(c.x, c.y - .4, c.z), 2.2 * b.sc, b.color); sfxAt('kill', c);
}
class Bot {
  constructor(id, idx, o = {}) {
    this.id = id; this.idx = idx; this.i = id; this.name = o.boss ? 'BOSS' : o.dummy ? 'DUMMY' : BOT_NAMES[idx % 6]; this.dummy = !!o.dummy; this.color = BOT_COLORS[idx % 6]; this.boss = !!o.boss; this.sc = this.boss ? 1.7 : 1; this.puppet = !!o.puppet;
    this.D = o.D || DIFF[CFG.diff]; this.m = makeBotModel(this.color, { boss: this.boss, scale: this.sc }); scene.add(this.m.g);
    this.pos = new V3(); this.tpos = new V3(); this.vel = new V3(); this.r = .38 * this.sc; this.h = 1.75 * this.sc; this.headY = 1.62 * this.sc; this.onGround = true; this.kills = 0; this.deaths = 0; this.tyaw = 0;
    this.yaw = rnd(0, 6.28); this.wp = null; this.alertT = 0; this.lastSeen = new V3(); this.saw = false; this.reactT = 0; this.cd = 0; this.burst = 0; this.pause = 0; this.strafe = Math.random() < .5 ? 1 : -1; this.strafeT = 0; this.stuckT = 0; this.lastP = new V3(); this.flashT = 0; this.barT = 0; this.invT = 0; this.alive = false; this.respT = rnd(.2, 1.5); this.m.g.visible = false;
    this.nadeT = 8; this.blindT = 0; this.hp = this.maxHp = this.D.hp; this.removeT = 0; this.tgt = null; this.blindP = false; this.alertP = false;
    botById.set(id, this);
  }
  eye() { return new V3(this.pos.x, this.pos.y + 1.55 * this.sc, this.pos.z); }
  remove() { scene.remove(this.m.g); disposeObj(this.m.g); botById.delete(this.id); }
  respawn() {
    const D = this.D, tg = frameTargets.length ? frameTargets : [P]; let best = null, bd = -1;
    const roy = M && M.mode === 'royale'; for (let k = 0; k < (roy ? 16 : 4); k++) { const s = pick(M && (roy || (M.free && this.dummy)) ? WAYPOINTS : SPAWNS); let md = 1e9; for (const t of tg) md = Math.min(md, s.distanceTo(t.pos)); const d = md + rnd(0, 12); if (d > bd) { bd = d; best = s; } }
    this.pos.copy(best); this.vel.set(0, 0, 0); this.hp = this.maxHp = D.hp; this.alive = true; this.everAlive = true; this.m.g.visible = true; this.invT = 1.2; this.alertT = 0; this.saw = false; this.wp = null; this.blindT = 0; this.nadeT = rnd(5, D.nade); this.m.bar.visible = false;
  }
  hurt(dmg, head, byPid) {
    if (!this.alive || this.invT > 0) return false;
    this.hp -= dmg; this.flashT = .12; this.barT = 2.5; this.alertT = 5; const src = byPid === 0 ? P : remotes.get(byPid); this.lastSeen.copy(src ? src.pos : P.pos); this.saw = true;
    if (this.hp <= 0) { this.die(byPid); return true; } return false;
  }
  die(byPid) {
    this.alive = false; this.deaths++; this.m.g.visible = false; this.respT = 3; this.removeT = 1.4; botDeathFx(this); dropLoot(this.pos); hostBotKilled(this, byPid);
  }
  pickTarget() {
    let best = null, bd = 1e9; for (const t of frameTargets) { const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z); if (d < bd) { bd = d; best = t; } }
    if (this.tgt && frameTargets.includes(this.tgt)) { const dc = Math.hypot(this.tgt.pos.x - this.pos.x, this.tgt.pos.z - this.pos.z); if (dc < bd * 1.35) best = this.tgt; }
    return this.tgt = best;
  }
  puppetUpdate(dt) {
    const m = this.m; m.g.visible = this.alive; if (!this.alive) return;
    const k = 1 - Math.exp(-dt * 14), px = this.pos.x, pz = this.pos.z;
    if (this.pos.distanceTo(this.tpos) > 8) this.pos.copy(this.tpos); else this.pos.lerp(this.tpos, k);
    this.yaw += angDiff(this.tyaw, this.yaw) * k; this.flashT -= dt; this.barT -= dt;
    const sp = Math.hypot(this.pos.x - px, this.pos.z - pz) / Math.max(dt, .001), ph = time * (6 + sp * 1.4), blind = this.blindP;
    m.g.position.copy(this.pos); m.body.rotation.y = this.yaw;
    m.legL.rotation.x = Math.sin(ph) * .8 * Math.min(1, sp / 3); m.legR.rotation.x = -Math.sin(ph) * .8 * Math.min(1, sp / 3); m.body.position.y = Math.abs(Math.sin(ph)) * .06 * Math.min(1, sp / 3);
    m.arm.rotation.x = this.alertP ? 0 : -.15; m.head.rotation.z = blind ? Math.sin(time * 9) * .3 : 0;
    const f = this.flashT > 0; m.torso.material.emissive.setHex(f ? 0xffffff : 0); m.torso.material.emissiveIntensity = f ? 1.2 : 0; m.eyeM.color.setHex(blind ? 0xffffff : this.alertP ? 0xff4a4a : 0x2ee6ff);
    m.bar.visible = this.boss || this.barT > 0; if (m.bar.visible) { m.bar.quaternion.copy(camera.quaternion); const r = clamp(this.hp / this.maxHp, .001, 1); m.fg.scale.x = r; m.fg.position.x = -(1 - r) * .43; }
  }
  update(dt) {
    if (this.puppet) { this.puppetUpdate(dt); return; }
    const D = this.D;
    if (!this.alive) { if (M && M.norespawn && this.deaths > 0) this.removeT -= dt; else { this.respT -= dt; if (this.respT <= 0 && M && !M.over) this.respawn(); } return; }
    this.invT -= dt; this.flashT -= dt; this.barT -= dt; this.alertT = Math.max(0, this.alertT - dt);
    const blind = this.blindT > 0; if (blind) this.blindT -= dt;
    const eye = this.eye(), T = this.pickTarget(); let sees = false, dist = 999, tEye = null;
    if (T) {
      tEye = tgtEye(T); const to = tEye.clone().sub(eye); dist = to.length(); to.divideScalar(Math.max(dist, .001));
      const fwd0 = new V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), flat = new V3(to.x, 0, to.z).normalize(), dotF = fwd0.dot(flat);
      sees = !blind && dist < 60 && (dotF > .25 || this.alertT > 0) && worldT(eye, to, dist) >= dist - .3 && !smokeBlocks(eye, tEye);
    }
    if (sees) { if (!this.saw) { this.saw = true; this.reactT = D.react * rnd(.8, 1.3); } this.alertT = 4; this.lastSeen.copy(T.pos); } else if (this.alertT <= 0) this.saw = false;
    let wish = new V3(), face = this.yaw, speed = D.speed;
    if (this.alertT > 0 && T) {
      const t = sees ? T.pos : this.lastSeen, dx = t.x - this.pos.x, dz = t.z - this.pos.z, d2 = Math.hypot(dx, dz) || 1;
      face = Math.atan2(-dx, -dz); const dir = new V3(dx / d2, 0, dz / d2), right = new V3(-dir.z, 0, dir.x);
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = Math.random() < .5 ? 1 : -1; this.strafeT = rnd(.7, 1.8); }
      const want = sees ? (d2 > 18 ? 1 : d2 < 8 ? -.7 : 0) : 1; wish.addScaledVector(dir, want).addScaledVector(right, sees ? this.strafe * .9 : 0);
      if (!sees && d2 < 1.5) this.alertT = 0;
    } else {
      if (!this.wp || this.pos.distanceTo(this.wp) < 1.6 || (M && M.storm && stormOutside(this.wp, 1))) this.wp = pickWpIn();
      const dx = this.wp.x - this.pos.x, dz = this.wp.z - this.pos.z, d2 = Math.hypot(dx, dz) || 1; face = Math.atan2(-dx, -dz); wish.set(dx / d2, 0, dz / d2); speed *= .75;
    }
    if (blind) { wish.set(Math.cos(time * 2.3 + this.i), 0, Math.sin(time * 2.9 + this.i)); face = this.yaw + Math.sin(time * 4 + this.i) * .6; speed *= .55; }
    // dodge the players' grenades and fire
    let fx = 0, fz = 0;
    for (const n of nades) if (!(n.owner instanceof Bot) && (n.id === 'frag' || n.id === 'molly')) { const dx = this.pos.x - n.pos.x, dz = this.pos.z - n.pos.z, d = Math.hypot(dx, dz); if (d < 7 && n.fuse > .15) { fx += dx / (d + .2) * (8 - d); fz += dz / (d + .2) * (8 - d); } }
    for (const f of fires) if (!(f.owner instanceof Bot)) { const dx = this.pos.x - f.pos.x, dz = this.pos.z - f.pos.z, d = Math.hypot(dx, dz); if (d < f.R + 1.5) { fx += dx / (d + .2) * 4; fz += dz / (d + .2) * 4; } }
    if (fx * fx + fz * fz > .01) { const m = Math.hypot(fx, fz); wish.set(fx / m, 0, fz / m); face = Math.atan2(-fx, -fz); speed *= 1.3; }
    let dy = angDiff(face, this.yaw); this.yaw += dy * clamp(dt * D.turn, 0, 1);
    if (wish.lengthSq() > 0) wish.normalize();
    const ctl = this.onGround ? 14 : 3; this.vel.x += (wish.x * speed - this.vel.x) * clamp(ctl * dt, 0, 1); this.vel.z += (wish.z * speed - this.vel.z) * clamp(ctl * dt, 0, 1);
    this.blocked = false; moveEntity(this, dt);
    this.stuckT += dt; if (this.stuckT > .6) { if (this.pos.distanceTo(this.lastP) < .5 && wish.lengthSq() > 0) { if (this.onGround && Math.random() < .6) this.vel.y = 7; this.wp = null; this.strafe *= -1; } this.lastP.copy(this.pos); this.stuckT = 0; }
    // shooting
    if (sees) { this.reactT -= dt; this.pause -= dt; this.cd -= dt;
      if (this.reactT <= 0 && this.pause <= 0 && this.cd <= 0 && Math.abs(dy) < .35) this.shoot(eye, dist, D, T); }
    // grenades
    if (this.alertT > 0 && T && !blind) {
      this.nadeT -= dt;
      if (this.nadeT <= 0) { const tp = sees ? T.pos : this.lastSeen, d = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z); if (d > 8 && d < 32) { this.nadeT = rnd(D.nade * .7, D.nade * 1.4); botThrow(this, pick(D.nades), tp); } else this.nadeT = 1; }
    }
    // visuals
    const m = this.m; m.g.position.copy(this.pos); m.body.rotation.y = this.yaw; const sp = Math.hypot(this.vel.x, this.vel.z), ph = time * (6 + sp * 1.4);
    m.legL.rotation.x = Math.sin(ph) * .8 * Math.min(1, sp / 3); m.legR.rotation.x = -Math.sin(ph) * .8 * Math.min(1, sp / 3); m.body.position.y = Math.abs(Math.sin(ph)) * .06 * Math.min(1, sp / 3);
    m.arm.rotation.x = sees ? clamp(Math.atan2(tEye.y - eye.y, dist), -.5, .5) : -.15; m.head.rotation.z = blind ? Math.sin(time * 9) * .3 : 0;
    const f = this.flashT > 0; m.torso.material.emissive.setHex(f ? 0xffffff : 0); m.torso.material.emissiveIntensity = f ? 1.2 : 0; m.eyeM.color.setHex(blind ? 0xffffff : this.alertT > 0 ? 0xff4a4a : 0x2ee6ff);
    m.bar.visible = this.boss || this.barT > 0; if (m.bar.visible) { m.bar.quaternion.copy(camera.quaternion); const r = clamp(this.hp / this.maxHp, .001, 1); m.fg.scale.x = r; m.fg.position.x = -(1 - r) * .43; }
  }
  shoot(eye, dist, D, T) {
    if (this.burst <= 0) { this.burst = rint(2, 4); this.pause = rnd(.35, .9) * (this.boss ? .5 : 1); return; }
    this.burst--; this.cd = D.fire;
    const tgt = new V3(T.pos.x, T.pos.y + T.h * .6, T.pos.z), dir = tgt.sub(eye).normalize(), err = D.aim * (1 + dist / 45);
    dir.x += rnd(-err, err); dir.y += rnd(-err, err) * .7; dir.z += rnd(-err, err); dir.normalize();
    const mz = new V3(eye.x + dir.x * .8 * this.sc + Math.cos(this.yaw) * .3 * this.sc, eye.y - .35 * this.sc, eye.z + dir.z * .8 * this.sc - Math.sin(this.yaw) * .3 * this.sc);
    const tw = worldT(eye, dir), hp = hitEntity(eye, dir, T, T.eyeH - .05), end = hp && hp.t < tw ? hp.t : Math.min(tw, 70), endP = eye.clone().addScaledVector(dir, end);
    tracer(mz, endP, 0xff7a7a, .1); sfxAt('bot', this.pos); if (isMP()) NET.net.hostBroadcast({ t: 'sh', a: v3a(mz), b: v3a(endP), w: -1 });
    if (hp && hp.t < tw) hurtTarget(T, D.dmg * (hp.head ? 1.4 : 1), this);
  }
}


// ------------------------------------------------------------------ match modes + co-op networking
const v3 = a => new V3(+a[0] || 0, +a[1] || 0, +a[2] || 0);
const okVec = a => Array.isArray(a) && a.length >= 3 && a.every(n => Number.isFinite(n) && Math.abs(n) < 500);
const myName = () => cleanName($('pname') ? $('pname').value : load('name', '')) || 'Player';
const nameOf = pid => { const r = NET.roster.find(r => r.pid === pid); return r ? r.name : 'Player'; };
const colorOf = pid => PLAYER_COLORS[(pid | 0) % 4];
const safeCfg = c => ({ mode: MODES[c && c.mode] ? c.mode : 'tdm', map: MAPS.some(m => c && m.id === c.map && (!m.br || c.mode === 'royale')) ? c.map : 'plaza', diff: DIFF[c && c.diff] ? c.diff : 'normal', rarity: clamp((c && c.rarity) | 0, 0, 4), fp: c && c.fp === 'bots' ? 'bots' : 'dummy' });
const wireCfg = () => ({ mode: CFG.mode, map: CFG.map, diff: CFG.diff, rarity: CFG.rarity, fp: CFG.fp });
const botsAlive = () => bots.filter(b => b.alive).length;
function newMatch(cfg, np) {
  return { mode: cfg.mode, map: cfg.map, diff: cfg.diff, np, over: false, pvp: cfg.mode === 'brawl' || cfg.mode === 'royale', free: cfg.mode === 'free', rarity: clamp((cfg.rarity | 0), 0, 4), fp: cfg.fp === 'bots' ? 'bots' : 'dummy', norespawn: cfg.mode === 'horde' || cfg.mode === 'royale', storm: null, target: cfg.mode === 'tdm' ? 25 + 10 * (np - 1) : cfg.mode === 'brawl' ? 15 : 0, timeLeft: cfg.mode === 'blitz' ? 300 : 0,
    wave: 0, phase: '', phaseT: 0, toSpawn: 0, spawnT: 0, maxAlive: 8, lives: 0, left: 0, nextBotId: 1 };
}
function feedText(text, color = '#fff') { const f = $('feed'), d = document.createElement('div'); d.textContent = text; d.style.color = color; f.appendChild(d); setTimeout(() => d.remove(), 4500); while (f.children.length > 5) f.firstChild.remove(); }
function announce(text, color = '#fff') { feedText(text, color); if (isMP() && isHost()) NET.net.hostBroadcast({ t: 'ann', a: text, c: color }); }
function syncRemotes() {
  const want = new Set(NET.roster.filter(r => r.pid !== NET.me).map(r => r.pid));
  for (const [pid, rp] of remotes) if (!want.has(pid)) { rp.dispose(); remotes.delete(pid); }
  for (const r of NET.roster) if (r.pid !== NET.me && !remotes.has(r.pid)) remotes.set(r.pid, new RemotePlayer(r.pid, r.name, r.color));
  renderTeam();
}
const rosterWire = () => NET.roster.map(r => ({ pid: r.pid, name: r.name }));
function setRoster(list) { NET.roster = (list || []).slice(0, MAX_PLAYERS).map(r => ({ pid: r.pid | 0, name: cleanName(r.name) || 'Player', color: colorOf(r.pid) })); syncRemotes(); renderLobby(); }
const myStateArr = () => [r2(P.pos.x), r2(P.pos.y), r2(P.pos.z), r2(P.yaw), r2(P.pitch), r2(P.crouchK), P.alive ? 1 : 0, cur, W[cur].rar, Math.max(0, Math.round(P.hp)), P.kills, P.deaths];

// ---- hosting / joining
async function netHost() {
  setNetMsg('Setting up your room…');
  for (let tries = 0; tries < 4; tries++) {
    const n = new Net(NETMODE); n.onjoin = () => {}; n.onleave = hostOnLeave; n.onmsg = hostOnMsg; const code = makeCode();
    try { await n.host(code); NET.net = n; NET.role = 'host'; NET.me = 0; NET.code = code; setRoster([{ pid: 0, name: myName() }]); showLobby(); setNetMsg(''); return; }
    catch (e) { n.close(); if (!(e && e.type === 'unavailable-id')) { setNetMsg(netErr(e)); return; } }
  }
  setNetMsg('Could not find a free room code. Try again.');
}
async function netJoin(codeIn) {
  const code = cleanCode(codeIn); if (code.length < 5) { setNetMsg('Type the 5-letter room code from your friend.'); return; }
  setNetMsg('Connecting…'); const n = new Net(NETMODE); n.onmsg = clientOnMsg; n.onclose = () => { if (NET.net === n) leaveMatch('Disconnected from the host.'); };
  try { await n.join(code); NET.net = n; NET.role = 'client'; NET.code = code; NET.me = 0; n.clientSend({ t: 'hello', name: myName(), v: 1 }); setNetMsg('Connected, waiting for the host…'); }
  catch (e) { n.close(); NET.net = null; NET.role = 'solo'; setNetMsg(netErr(e)); }
}
const netErr = e => !e ? 'Could not connect.' : e.type === 'peer-unavailable' ? 'No room with that code. Check it and try again.' : e.type === 'timeout' ? 'Timed out connecting. Check your internet and the code.' : e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? 'Could not reach the connection service. Check your internet and try again.' : (e.message || 'Could not connect.');

// ---- host: messages from clients
function hostOnLeave(pid) {
  const nm = nameOf(pid); NET.roster = NET.roster.filter(r => r.pid !== pid); const rp = remotes.get(pid); if (rp) { rp.dispose(); remotes.delete(pid); }
  NET.net.hostBroadcast({ t: 'lobby', roster: rosterWire() }); renderLobby(); if (M && !M.over) { announce(nm + ' left the match', '#ffb0b0'); checkEnd(); }
}
function hostOnMsg(pid, m) {
  if (!m || typeof m.t !== 'string') return; const rp = remotes.get(pid);
  switch (m.t) {
    case 'hello': {
      NET.roster = NET.roster.filter(r => r.pid !== pid); NET.roster.push({ pid, name: cleanName(m.name) || 'Player', color: colorOf(pid) }); NET.roster.sort((a, b) => a.pid - b.pid); syncRemotes();
      NET.net.hostSend(pid, { t: 'welcome', pid, cfg: CFG, roster: rosterWire() }); NET.net.hostBroadcast({ t: 'lobby', roster: rosterWire() }, pid); renderLobby();
      if (M && !M.over) { M.np = NET.roster.length; NET.net.hostSend(pid, { t: 'start', cfg: wireCfg(), pk: pickups.map(wirePk), ch: chestWire(), np: M.np, tg: M.target, late: 1 }); announce(nameOf(pid) + ' joined the match', hex(colorOf(pid))); }
      break;
    }
    case 'pl': if (rp && Array.isArray(m.p) && m.p.length >= 12 && m.p.every(n => Number.isFinite(n))) rp.setState(m.p); break;
    case 'hit': { const b = botById.get(m.b | 0); if (b && b.alive && rp && rp.alive && Number.isFinite(m.d)) b.hurt(clamp(m.d, 0, 200), !!m.h, pid); break; }
    case 'th': if (rp && okVec(m.p) && okVec(m.v) && (m.id === 'shell' || (ITEMS[m.id] && ITEMS[m.id].kind === 'nade'))) { spawnNade(m.id, v3(m.p), v3(m.v), rp); NET.net.hostBroadcast({ t: 'th', id: m.id, p: m.p, v: m.v, o: pid }, pid); } break;
    case 'rk': if (rp && okVec(m.p) && okVec(m.v) && Number.isFinite(m.d)) { spawnRocket(v3(m.p), v3(m.v), clamp(m.d, 0, 200), rp); NET.net.hostBroadcast({ t: 'rk', p: m.p, v: m.v, d: m.d, o: pid }, pid); } break;
    case 'sh': if (rp && okVec(m.a) && okVec(m.b)) { shotFx(m, rp); NET.net.hostBroadcast({ t: 'sh', a: m.a, b: m.b, w: m.w, r: m.r, o: pid }, pid); } break;
    case 'claim': { const pk = pkById.get(m.n | 0); if (pk && pk.on && rp && Math.hypot(rp.tpos.x - pk.x, rp.tpos.z - pk.z) < 6) hostGrant(pk, pid); break; }
    case 'pd': if (M && !M.over) hostPlayerDied(pid, m.by | 0, m.tm | 0, !!m.self, !!m.env); break;
    case 'copen': { const ch = chestById.get(m.n | 0); if (ch && !ch.open && rp && Math.hypot(rp.tpos.x - ch.x, rp.tpos.z - ch.z) < 6) hostOpenChest(ch); break; }
    case 'drop': { if (m.id) { if (rp && ITEMS[m.id] && pickups.filter(p => p.temp).length < 30) { const pk = addPickup({ id: m.id, qty: clamp(m.qty | 0, 1, ITEMS[m.id].max) }, rp.tpos.x, rp.tpos.y, rp.tpos.z, { temp: true, ttl: 40 }); NET.net.hostBroadcast({ t: 'pka', w: wirePk(pk) }); } break; } const gi = m.gi | 0, rar = clamp(m.rar | 0, 0, 4); if (rp && WDEF[gi] && pickups.filter(p => p.temp).length < 30) { const pk = addPickup({ id: 'gun', qty: 1, gi, rar }, rp.tpos.x, rp.tpos.y, rp.tpos.z, { temp: true, ttl: 40 }); NET.net.hostBroadcast({ t: 'pka', w: wirePk(pk) }); } break; }
    case 'phit': if (Number.isFinite(m.d)) hostPlayerHit(pid, m.v | 0, m.d, !!m.h); break;
  }
}
function shotFx(m, rp) {
  const a = v3(m.a), b = v3(m.b); if (m.w < 0) { tracer(a, b, 0xff7a7a, .1); sfxAt('bot', a); return; }
  const wd = WDEF[m.w | 0]; if (!wd) return; tracer(a, b, wd.id === 'zap' ? 0x7cffff : ((m.r | 0) >= 3 ? RARITY[m.r | 0].col : 0xfff2a0), wd.id === 'zap' ? .22 : .08); sfxAt(wd.id, a);
}
function hostPlayerDied(pid, botId, teammate, self, env) {
  const nm = nameOf(pid), b = botById.get(botId), col = hex(colorOf(pid));
  if (env) announce(nm + ' was lost to the storm', col);
  else if (self) { if (!M.pvp) score.me = Math.max(0, score.me - 1); announce(nm + ' popped themselves', col); }
  else if (teammate >= 0) { if (M.pvp) creditPvpKill(teammate, pid); else announce(`${nameOf(teammate)} popped ${nm} (oops!)`, col); }
  else { score.bots++; if (b) b.kills++; announce(`${b ? b.name : 'A bot'} popped ${nm}`, col); }
  let delay = M.free ? 1 : 3; if (M.mode === 'horde') { if (M.lives > 0) { M.lives--; delay = 5; } else delay = -1; } if (M.mode === 'royale') delay = -1;
  if (pid === 0) setLocalRespawn(delay); else NET.net.hostSend(pid, { t: 'rs', d: delay });
  const rp = remotes.get(pid); if (rp) { rp.alive = false; playerDeathFx(rp); } if (isMP()) NET.net.hostBroadcast({ t: 'pdx', pid }, pid);
  updScore(); checkEnd();
}
function playerDeathFx(rp) { const c = new V3(rp.pos.x, rp.pos.y + 1.2, rp.pos.z); burst(c, rp.color, 22, 8, .18, 1, 12, 4); burst(c, 0xffffff, 10, 6, .12, .7, 12, 3); sfxAt('bye', c); }
function setLocalRespawn(delay) { P.respT = delay < 0 ? 1e9 : delay; if (delay < 0) hint(M && M.mode === 'royale' ? 'ELIMINATED - click to spectate' : 'OUT OF LIVES - cheer on your team!', '#ff8a8a'); }
function onLocalDeath(from, self) {
  const botId = from instanceof Bot ? from.id : -1, tm = from instanceof RemotePlayer ? from.pid : -1;
  const env = from === STORM;
  if (NET.role === 'client') NET.net.clientSend({ t: 'pd', by: botId, tm, self: self ? 1 : 0, env: env ? 1 : 0 }); else hostPlayerDied(0, botId, tm, self, env);
}
function hostBotKilled(b, byPid) {
  if (byPid >= 0) score.me++;
  if (byPid === 0) onMyKill(b); else if (byPid > 0) feedText(`${nameOf(byPid)} popped ${b.name}`, hex(colorOf(byPid)));
  if (isMP()) NET.net.hostBroadcast({ t: 'bd', id: b.id, k: byPid, x: r2(b.pos.x), y: r2(b.pos.y), z: r2(b.pos.z) });
  updScore(); checkEnd();
}
function onMyKill(bot) {
  P.kills++; P.streak++; const now = time; killTimes = killTimes.filter(t => now - t < 4); killTimes.push(now);
  feed(`<b style="color:#2ee6ff">You</b> popped <b style="color:${hex(bot.color)}">${bot.name}</b>`);
  const multi = ['', '', 'DOUBLE POP!', 'TRIPLE POP!', 'QUAD POP!', 'MEGA POP!'][Math.min(5, killTimes.length)], streak = { 3: 'ON FIRE!', 5: 'UNSTOPPABLE!', 7: 'THUG LIKE!', 10: 'LEGENDARY!' }[P.streak];
  if (streak) showCenter(streak, '#ffd34e'); else if (multi) showCenter(multi, '#7cecff'); if (streak || multi) sfx('medal');
}

// ---- client: messages from the host
function clientOnMsg(_, m) {
  if (!m || typeof m.t !== 'string') return;
  switch (m.t) {
    case 'welcome': NET.me = m.pid | 0; Object.assign(CFG, safeCfg(m.cfg)); setRoster(m.roster); showLobby(); setNetMsg(''); break;
    case 'lobby': setRoster(m.roster); break;
    case 'cfg': Object.assign(CFG, safeCfg(m.cfg)); renderPickers(); break;
    case 'busy': leaveMatch('That match already started. Ask the host to start a new one.'); break;
    case 'full': leaveMatch('That room is full (4 players max).'); break;
    case 'kick': leaveMatch('The host removed you from the room.'); break;
    case 'start': clientStart(m); break;
    case 's': applySnap(m); break;
    case 'bd': {
      const b = botById.get(m.id | 0); if (b) { b.alive = false; b.m.g.visible = false; b.pos.set(m.x, m.y, m.z); botDeathFx(b); }
      if (m.k === NET.me) { onMyKill(b || { color: 0xffffff, name: 'Bot' }); showHit('kill'); } else if (m.k >= 0) feedText(`${nameOf(m.k)} popped ${b ? b.name : 'a bot'}`, hex(colorOf(m.k))); break;
    }
    case 'dmg': if (Number.isFinite(m.d)) damagePlayer(clamp(m.d, 0, 200), m.p !== undefined ? (remotes.get(m.p | 0) || null) : (botById.get(m.b | 0) || null)); break;
    case 'pk': onMyKill({ color: m.c | 0, name: cleanName(m.n) || 'Player' }); showHit('kill'); break;
    case 'rs': setLocalRespawn(+m.d); break;
    case 'pdx': { const rp = remotes.get(m.pid | 0); if (rp) playerDeathFx(rp); break; }
    case 'th': if (okVec(m.p) && okVec(m.v) && (m.id === 'shell' || (ITEMS[m.id] && ITEMS[m.id].kind === 'nade'))) spawnNade(m.id, v3(m.p), v3(m.v), m.ob !== undefined ? (botById.get(m.ob) || remotes.get(0)) : (remotes.get(m.o | 0) || remotes.get(0))); break;
    case 'rk': if (okVec(m.p) && okVec(m.v)) spawnRocket(v3(m.p), v3(m.v), +m.d || 0, remotes.get(m.o | 0) || remotes.get(0)); break;
    case 'sh': if (okVec(m.a) && okVec(m.b)) shotFx(m, remotes.get(m.o | 0)); break;
    case 'pkt': { const pk = pkById.get(m.n | 0); if (pk && pk.on) { takePickupFx(pk); pk.on = false; } break; }
    case 'pks': { const w = m.w; if (w) { const pk = pkById.get(w.n); if (pk) setPickup(pk, lootFromWire(w)); else addPickup(lootFromWire(w), w.x, w.y, w.z, { nid: w.n, fixed: w.f ? w.id : null }); } break; }
    case 'pka': { const w = m.w; if (w && !pkById.has(w.n)) addPickup(lootFromWire(w), w.x, w.y, w.z, { nid: w.n, temp: true, ttl: 999 }); break; }
    case 'pkx': { const pk = pkById.get(m.n | 0); if (pk) removePickup(pk); break; }
    case 'pkall': if (Array.isArray(m.pk)) { buildPickupsFromWire(m.pk); buildChestsFromWire(m.ch); } break;
    case 'cho': { const ch = chestById.get(m.n | 0); if (ch && !ch.open) openChestFx(ch); break; }
    case 'chc': { const ch = chestById.get(m.n | 0); if (ch) ch.open = false; break; }
    case 'grant': if (m.l && lootUseful(m.l)) applyLoot(m.l); else if (m.l && m.l.id !== 'gun' && m.l.id !== 'dmg') { /* inventory filled up meanwhile: drop it */ } break;
    case 'ann': feedText(String(m.a).slice(0, 80), typeof m.c === 'string' && /^#[0-9a-f]{3,8}$/i.test(m.c) ? m.c : '#fff'); break;
    case 'wv': if (M) { M.wave = m.n | 0; } bannerWave(m.n | 0, !!m.boss); break;
    case 'heal': if (P.alive) { P.hp = Math.min(100, P.hp + (+m.d || 0)); } break;
    case 'end': { if (M) { M.over = true; } const mine = m.w === undefined || m.w === null ? !!m.win : m.w === NET.me; showEnd(mine, String(mine ? m.title : (m.title2 || m.title) || ''), String(mine ? m.sub : (m.sub2 || m.sub) || ''), m.board || []); break; }
  }
}
function clientStart(m) {
  if (state === 'over') $('over').classList.add('hide');
  Object.assign(CFG, safeCfg(m.cfg)); M = newMatch(CFG, Math.max(1, m.np | 0)); M.target = m.tg | 0; loadMap(CFG.map, M.mode === 'royale'); buildPickupsFromWire(m.pk || []); buildChestsFromWire(m.ch); beginLocal();
  if (m.late && M.mode === 'royale') { P.alive = false; P.hp = 0; setLocalRespawn(-1); }
  state = 'pause'; $('lobby').classList.add('hide'); $('menu').classList.add('hide'); $('pause').classList.remove('hide'); $('pauseT').textContent = 'MATCH STARTED!'; $('resume').textContent = 'JUMP IN';
}
function applySnap(m) {
  if (!M || !Array.isArray(m.b) || !Array.isArray(m.p)) return; lastSnapAt = performance.now();
  const seen = new Set();
  for (const a of m.b) {
    const [id, idx, x, y, z, yaw, hpp, fl] = a; seen.add(id); let b = botById.get(id);
    if (!b) { b = new Bot(id, idx, { puppet: true, boss: !!(fl & 8), D: DIFF[M.diff] }); bots.push(b); b.pos.set(x, y, z); b.tpos.set(x, y, z); b.yaw = b.tyaw = yaw; }
    const was = b.alive, old = b.hp; b.tpos.set(x, y, z); b.tyaw = yaw; b.alive = !!(fl & 1); b.blindP = !!(fl & 2); b.alertP = !!(fl & 4); b.maxHp = 100; b.hp = hpp; if (hpp < old && b.alive) b.barT = 2.5; if (b.alive && !was) b.pos.copy(b.tpos);
  }
  for (let i = bots.length - 1; i >= 0; i--) if (!seen.has(bots[i].id)) { bots[i].remove(); bots.splice(i, 1); }
  for (const a of m.p) { const pid = a[0]; if (pid === NET.me) continue; const rp = remotes.get(pid); if (rp) rp.setState(a.slice(1)); }
  score.me = m.s[0]; score.bots = m.s[1]; M.wave = m.m[0]; M.phase = m.m[1] === 1 ? 'break' : m.m[1] === 2 ? 'wave' : ''; M.phaseT = m.m[2]; M.left = m.m[3]; M.lives = m.m[4]; M.timeLeft = m.m[5];
  if (m.st && M.mode === 'royale') { const S = M.storm || (M.storm = { fromR: 0 }); S.cx = m.st[0]; S.cz = m.st[1]; S.r = m.st[2]; S.phase = m.st[3]; S.state = m.st[4] ? 'shrink' : 'wait'; S.t = m.st[5]; S.dmg = m.st[6]; }
  updScore();
}
function buildSnap() {
  const fl = b => (b.alive ? 1 : 0) | (b.blindT > 0 ? 2 : 0) | (b.alertT > 0 ? 4 : 0) | (b.boss ? 8 : 0);
  const pl = [[0, ...myStateArr()]]; for (const [pid, rp] of remotes) pl.push([pid, r2(rp.tpos.x), r2(rp.tpos.y), r2(rp.tpos.z), r2(rp.tyaw), r2(rp.pitch), r2(rp.crouch), rp.alive ? 1 : 0, rp.wi, rp.rar, Math.round(rp.hp), rp.kills, rp.deaths]);
  return { t: 's', b: bots.map(b => [b.id, b.idx, r2(b.pos.x), r2(b.pos.y), r2(b.pos.z), r2(b.yaw), Math.max(0, Math.round(b.hp / b.maxHp * 100)), fl(b)]), p: pl, s: [score.me, score.bots],
    m: [M.wave | 0, M.phase === 'break' ? 1 : M.phase === 'wave' ? 2 : 0, r2(M.phaseT), botsAlive() + M.toSpawn, M.lives | 0, r2(M.timeLeft)],
    st: M.storm ? [r2(M.storm.cx), r2(M.storm.cz), r2(M.storm.r), M.storm.phase, M.storm.state === 'shrink' ? 1 : 0, r2(M.storm.t), M.storm.dmg] : 0 };
}
let netT = 0, lastSnapAt = 0;
// a hidden tab stops animating, but keep the connection alive so alt-tabbing for a bit does not drop anyone
setInterval(() => { if (!isMP() || !NET.net || !document.hidden || !M) return; if (NET.role === 'client') NET.net.clientSend({ t: 'pl', p: myStateArr() }); else NET.net.hostBroadcast(buildSnap()); }, 1500);
function netTick(dt) {
  if (!isMP() || !NET.net) return; netT += dt;
  if (NET.role === 'client') {
    if (netT >= .04) { netT = 0; NET.net.clientSend({ t: 'pl', p: myStateArr() }); }
    if (lastSnapAt && performance.now() - lastSnapAt > 25000) { lastSnapAt = 0; leaveMatch('Lost connection to the host.'); }
  } else if (netT >= .05) {
    netT = 0; NET.net.hostBroadcast(buildSnap());
    for (const [pid, rp] of remotes) if (performance.now() - rp.lastMsg > 25000) NET.net.kick(pid);
  }
}

// ---- starting / ending matches
function beginLocal() {
  for (const b of bots) b.remove(); bots.length = 0; botById.clear(); for (const p of projs) { scene.remove(p.m); } projs.length = 0; clearHazards();
  for (const w of W) { w.owned = w.d.id === 'pop'; w.rar = 0; applyRarity(w); } slots.fill(null); slots[0] = { gun: 0 }; selSlot = 0; clearHold(); adsTog = false;
  score.me = score.bots = 0; P.kills = P.deaths = P.streak = 0; killTimes = []; $('feed').innerHTML = ''; updScore(); spawnPlayer(true); cur = 0; wantSwap = -1; swapT = 0; selectWeapon(0, true);
  clearStormVis(); specI = 0; $('team').style.display = M.pvp ? 'none' : ''; for (const rp of remotes.values()) rp.tag.material.depthTest = !!M.pvp;
  if (isHost()) hostSetupMode(); started = true; state = 'play'; lastSnapAt = 0; $('over').classList.add('hide'); $('menu').classList.add('hide'); $('lobby').classList.add('hide'); $('pause').classList.add('hide'); $('pauseT').textContent = 'PAUSED'; $('resume').textContent = 'RESUME';
}
function hostSetupMode() {
  const D = DIFF[M.diff];
  if (M.mode === 'horde') { M.phase = 'break'; M.phaseT = 6; M.wave = 0; M.lives = 4 + 2 * M.np; showCenter('GET READY!', '#7cecff'); }
  else if (M.mode === 'free') { const bots4 = M.fp === 'bots', n = bots4 ? 4 : 6 + 2 * (M.np - 1), FD = bots4 ? D : Object.assign({}, D, { hp: 120, speed: 0, fire: 99, react: 99, nade: 99999, aim: 1 }); for (let i = 0; i < n; i++) { const b = new Bot(M.nextBotId++, i, { D: FD, dummy: !bots4 }); b.respT = .1 + i * .15; bots.push(b); } showCenter('FREEPLAY - grab any blaster!', '#7cecff'); }
  else if (M.mode === 'royale') { stormInit(); const n = Math.min(22, 14 + 3 * (M.np - 1)); for (let i = 0; i < n; i++) { const b = new Bot(M.nextBotId++, i, { D }); b.respT = .05 + i * .02; bots.push(b); } showCenter('DROP IN!  Find loot, stay out of the storm', '#c58aff'); }
  else if (M.mode === 'brawl') { const n = Math.max(2, 6 - M.np); for (let i = 0; i < n; i++) { const b = new Bot(M.nextBotId++, i, { D }); b.respT = rnd(.2, 1.5) + i * .4; bots.push(b); } showCenter('BRAWL! Everyone is an enemy', '#ff9a4a'); }
  else { const n = Math.min(10, D.bots + 2 * (M.np - 1)); for (let i = 0; i < n; i++) { const b = new Bot(M.nextBotId++, i, { D }); b.respT = rnd(.2, 1.5) + i * .4; bots.push(b); } }
}
function startSolo() { NET.role = 'solo'; NET.me = 0; NET.roster = [{ pid: 0, name: myName(), color: PLAYER_COLORS[0] }]; syncRemotes(); M = newMatch(CFG, 1); loadMap(CFG.map, CFG.mode === 'royale'); hostRollPickups(1); beginLocal(); }
function hostStart() {
  if (NET.role !== 'host') return; const np = NET.roster.length; M = newMatch(CFG, np); loadMap(CFG.map, CFG.mode === 'royale'); const pk = hostRollPickups(np);
  NET.net.hostBroadcast({ t: 'start', cfg: wireCfg(), pk, ch: chestWire(), np, tg: M.target }); beginLocal();
}
function hostTick(dt) {
  if (!M || M.over) return;
  frameTargets = []; if (P.alive) frameTargets.push(P); for (const rp of remotes.values()) if (rp.alive && rp.seen) frameTargets.push(rp);
  for (const b of bots) b.update(dt);
  for (let i = bots.length - 1; i >= 0; i--) { const b = bots[i]; if (!b.alive && M.norespawn && b.deaths > 0 && b.removeT <= 0) { b.remove(); bots.splice(i, 1); } }
  if (M.mode === 'blitz') { M.timeLeft -= dt; if (M.timeLeft <= 0) { M.timeLeft = 0; endHost(score.me > score.bots, score.me > score.bots ? 'TIME! YOU WIN!' : score.me === score.bots ? 'TIME! IT IS A TIE' : 'TIME! BOTS WIN', `Final score ${score.me} to ${score.bots}`); } }
  if (M.mode === 'horde') hordeTick(dt);
  if (M.mode === 'royale') { stormTick(dt); checkEnd(); }
  if (M.mode === 'brawl') checkEnd();
  M.left = botsAlive() + M.toSpawn;
}
function checkEnd() {
  if (!M || M.over || !isHost()) return;
  if (M.mode === 'tdm') { if (score.me >= M.target) endHost(true, 'VICTORY!', `${NET.roster.length > 1 ? 'Your team' : 'You'} reached ${M.target} pops first. Nice shooting!`); else if (score.bots >= M.target) endHost(false, 'DEFEAT', 'The bots got there first. Rematch?'); }
  if (M.mode === 'horde' && M.lives <= 0 && !P.alive && [...remotes.values()].every(r => !r.alive)) endHost(false, 'OVERRUN!', `You made it to wave ${M.wave} with ${score.me} pops.`);
  if (M.mode === 'brawl') {
    const all = [[0, P.kills], ...[...remotes].map(([pid, rp]) => [pid, rp.kills])].sort((a, b) => b[1] - a[1]);
    if (all[0][1] >= M.target) endHost(all[0][0] === 0, `${nameOf(all[0][0]).toUpperCase()} WINS!`, `First to ${M.target} pops. Nice shooting!`, all[0][0], 'DEFEAT', `${nameOf(all[0][0])} got to ${M.target} pops first.`);
  }
  if (M.mode === 'royale' && M.storm) {
    if (bots.some(b => !b.everAlive)) return;   // wait until every bot has dropped in
    const ha = humansAlive(), ba = botsAlive();
    if (ha === 0) endHost(false, 'ELIMINATED', 'Nobody survived the storm this time. Rematch?', -1);
    else if (ba === 0 && ha === 1) { const w = P.alive ? 0 : ([...remotes].find(([, r]) => r.alive && r.seen) || [0])[0]; endHost(w === 0, 'VICTORY ROYALE!', w === NET.me || NET.roster.length < 2 ? 'You are the last one standing!' : `${nameOf(w)} is the last one standing!`, w, 'ELIMINATED', `${nameOf(w)} is the last one standing.`); }
  }
}
function endHost(win, title, sub, w, title2, sub2) {
  if (!M || M.over) return; M.over = true; const board = buildBoard();
  if (isMP()) NET.net.hostBroadcast({ t: 'end', win, title, sub, board, w, title2, sub2 });
  const mine = w === undefined || w === null ? win : w === NET.me; showEnd(mine, mine ? title : (title2 || title), mine ? sub : (sub2 || sub), board);
}
function buildBoard() {
  const rows = [[nameOf(0), P.kills, P.deaths, 0, 0]]; for (const [pid, rp] of remotes) rows.push([rp.name, rp.kills, rp.deaths, pid, 0]);
  if (M && M.mode !== 'horde' && M.mode !== 'royale') for (const b of bots) rows.push([b.name, b.kills, b.deaths, -1, 1]);
  return rows.sort((a, b) => b[1] - a[1]);
}
function showEnd(win, title, sub, board) {
  state = 'over'; endUse(); clearHold(); mouseL = mouseR = false; if (document.pointerLockElement) document.exitPointerLock();
  $('over').classList.remove('hide'); $('overT').textContent = title; $('overS').textContent = sub;
  $('board').innerHTML = '<tr><th></th><th>Pops</th><th>Popped</th></tr>' + board.map(r => `<tr class="${r[3] === NET.me && !r[4] ? 'me' : ''}"><td></td><td>${r[1] | 0}</td><td>${r[2] | 0}</td></tr>`).join('');
  [...$('board').rows].slice(1).forEach((tr, i) => { tr.cells[0].textContent = String(board[i][0]).slice(0, 14) + (board[i][3] === NET.me && !board[i][4] ? ' (you)' : ''); });
  $('again').textContent = NET.role === 'client' ? 'Waiting for the host…' : 'PLAY AGAIN'; $('again').disabled = NET.role === 'client'; $('again').style.opacity = NET.role === 'client' ? .5 : 1; sfx(win ? 'medal' : 'bye');
}
function boardHTML() {
  const rows = [[isMP() ? nameOf(NET.me) : 'YOU', P.kills, P.deaths, true]]; for (const rp of remotes.values()) rows.push([rp.name, rp.kills, rp.deaths, false]);
  if (isHost() && M && M.mode !== 'horde' && M.mode !== 'royale') for (const b of bots) rows.push([b.name, b.kills, b.deaths, false]);
  rows.sort((a, b) => b[1] - a[1]); const t = document.createElement('tbody'); const h = t.insertRow(); for (const x of ['', 'Pops', 'Popped']) { const c = document.createElement('th'); c.textContent = x; h.appendChild(c); }
  for (const r of rows) { const tr = t.insertRow(); if (r[3]) tr.className = 'me'; tr.insertCell().textContent = String(r[0]).slice(0, 14); tr.insertCell().textContent = r[1]; tr.insertCell().textContent = r[2]; } return t.innerHTML;
}

// ---- the storm (battle royale)
const STORM = { name: 'THE STORM', pos: new V3() };
const STORM_PH = [[40, 34, .62, 1.5], [30, 28, .38, 3], [24, 22, .2, 5], [18, 18, .09, 8], [12, 14, .03, 12]];   // [wait s, shrink s, radius fraction, damage per second]
let stormAcc = 0, stormVis = null, specI = 0, specName = '';
const stormOutside = (p, margin = 0) => !!(M && M.storm) && Math.hypot(p.x - M.storm.cx, p.z - M.storm.cz) > M.storm.r - margin;
function pickWpIn() { if (!M || !M.storm) return pick(WAYPOINTS); const S = M.storm, ins = WAYPOINTS.filter(w => !stormOutside(w, S.r * .15)); return ins.length ? pick(ins) : new V3(S.cx, 0, S.cz); }
function stormInit() { const R0 = HALF * 1.5; M.storm = { phase: 0, state: 'wait', t: STORM_PH[0][0], cx: 0, cz: 0, r: R0, fromR: R0, fromCx: 0, fromCz: 0, tr: R0, tcx: 0, tcz: 0, dmg: 0, dur: 1 }; stormPlan(); }
function stormPlan() {
  const S = M.storm, ph = STORM_PH[Math.min(S.phase, STORM_PH.length - 1)], nr = HALF * 1.5 * ph[2], maxOff = Math.max(0, S.r - nr) * .75, a = rnd(0, 6.283), d = rnd(0, maxOff);
  S.tr = nr; S.tcx = S.cx + Math.cos(a) * d; S.tcz = S.cz + Math.sin(a) * d; S.dmg = ph[3]; S.dur = ph[1];
}
function stormTick(dt) {
  const S = M.storm; if (!S) return; S.t -= dt;
  if (S.state === 'wait') { if (S.t <= 0) { S.state = 'shrink'; S.t = S.dur; S.fromR = S.r; S.fromCx = S.cx; S.fromCz = S.cz; announce('The storm is closing in!', '#c58aff'); } }
  else {
    const k = 1 - Math.max(0, S.t) / S.dur; S.r = S.fromR + (S.tr - S.fromR) * k; S.cx = S.fromCx + (S.tcx - S.fromCx) * k; S.cz = S.fromCz + (S.tcz - S.fromCz) * k;
    if (S.t <= 0) { S.r = S.tr; S.cx = S.tcx; S.cz = S.tcz; S.phase++; S.state = 'wait'; if (S.phase >= STORM_PH.length) { S.phase = STORM_PH.length - 1; S.t = 9999; S.tr = S.r; S.tcx = S.cx; S.tcz = S.cz; } else { S.t = STORM_PH[S.phase][0]; stormPlan(); announce('Storm shrinking again soon...', '#c58aff'); } }
  }
  for (const b of bots) if (b.alive && stormOutside(b.pos)) { b.hp -= S.dmg * dt; b.barT = 1; if (b.hp <= 0) b.die(-1); }   // bots feel it too
}
function stormVisual() {
  if (stormVis || !M || !M.storm) return;
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x7a3cff, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 70, 72, 1, true), wallMat); wall.position.y = 30; wall.frustumCulled = false;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc9a0ff, side: THREE.DoubleSide, fog: false, toneMapped: false }); const ring = new THREE.Mesh(new THREE.RingGeometry(.985, 1, 96), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = .09; ring.frustumCulled = false;
  const uni = { c: { value: new THREE.Vector2() }, r: { value: 999 }, t: { value: 0 } };
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: uni, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 w; void main(){ vec4 p = modelMatrix * vec4(position,1.0); w = p.xyz; gl_Position = projectionMatrix * viewMatrix * p; }',
    fragmentShader: 'varying vec3 w; uniform vec2 c; uniform float r; uniform float t; void main(){ float d = distance(w.xz, c); if (d < r) discard; float e = clamp((d - r) / 6.0, 0.0, 1.0); gl_FragColor = vec4(0.45, 0.15, 0.85, 0.22 + 0.12 * e + 0.04 * sin(t * 2.0 + d * 0.15)); }' }));
  veil.rotation.x = -Math.PI / 2; veil.position.y = .1; veil.frustumCulled = false;
  const g = new THREE.Group(); g.add(wall, ring, veil); scene.add(g); stormVis = { g, wall, ring, veil, uni, mats: [wallMat, ringMat] };
}
function clearStormVis() { if (!stormVis) return; scene.remove(stormVis.g); disposeObj(stormVis.g); stormVis = null; stormAcc = 0; $('vig').classList.remove('stm'); }
function updateStormVis(dt) {
  if (!M || !M.storm) { if (stormVis) clearStormVis(); return; } stormVisual(); const S = M.storm, v = stormVis;
  v.wall.position.x = v.ring.position.x = S.cx; v.wall.position.z = v.ring.position.z = S.cz; v.wall.scale.set(S.r, 1, S.r); v.ring.scale.set(S.r, S.r, 1); v.uni.c.value.set(S.cx, S.cz); v.uni.r.value = S.r; v.uni.t.value = time;
  v.mats[0].opacity = .18 + .05 * Math.sin(time * 3); STORM.pos.set(S.cx, 0, S.cz);
  if (P.alive && inMatch()) { const out = stormOutside(P.pos); $('vig').classList.toggle('stm', out); if (out) { stormAcc += dt; if (stormAcc >= .5) { stormAcc = 0; damagePlayer(S.dmg * .5, STORM); } } else stormAcc = 0; } else $('vig').classList.remove('stm');
}
const humansAlive = () => (P.alive ? 1 : 0) + [...remotes.values()].filter(r => r.alive && r.seen).length;
// ---- player vs player hits (brawl + battle royale)
function sendPlayerHit(rp, dmg, head) { if (isHost()) hostPlayerHit(0, rp.pid, dmg, head); else NET.net.clientSend({ t: 'phit', v: rp.pid, d: r1(dmg), h: head ? 1 : 0 }); }
function hostPlayerHit(from, v, dmg, head) {
  if (!M || !M.pvp || M.over || !Number.isFinite(dmg)) return; dmg = clamp(dmg, 0, 200); const sh = from === 0 ? null : remotes.get(from);
  if (from !== 0 && (!sh || !sh.alive)) return;
  if (v === 0) { if (P.alive && sh) damagePlayer(dmg, sh); } else if (remotes.has(v) && NET.net) NET.net.hostSend(v, { t: 'dmg', d: r1(dmg), p: from });
}
function creditPvpKill(k, victim) {
  announce(`${nameOf(k)} popped ${nameOf(victim)}`, hex(colorOf(k)));
  if (k === 0) { onMyKill({ color: colorOf(victim), name: nameOf(victim) }); showHit('kill'); } else if (NET.net) NET.net.hostSend(k, { t: 'pk', n: nameOf(victim), c: colorOf(victim) });
}

// ---- horde waves
function botStats(boss) {
  const base = DIFF[M.diff], k = Math.max(0, M.wave - 1), D = Object.assign({}, base);
  D.hp = Math.round(base.hp * (1 + .1 * k)); D.dmg = base.dmg * (1 + .07 * k); D.speed = Math.min(base.speed * (1 + .02 * k), base.speed * 1.3); D.aim = base.aim * Math.max(.55, 1 - .03 * k);
  if (boss) { D.hp = Math.round(base.hp * 7 * (1 + .25 * (M.np - 1)) * (1 + .12 * (M.wave / 5 - 1))); D.dmg *= 1.5; D.fire *= .8; D.speed *= .85; D.nade = 3.5; D.nades = ['frag', 'molly', 'flash']; D.react *= .6; }
  return D;
}
function spawnHordeBot(boss) { const b = new Bot(M.nextBotId++, rint(0, 5), { D: botStats(boss), boss }); bots.push(b); b.respawn(); return b; }
function bannerWave(n, boss) { showCenter(boss ? `WAVE ${n} - BOSS!` : `WAVE ${n}`, boss ? '#ff6a8a' : '#ffd34e'); sfx('medal'); }
function hordeStartWave(n) {
  M.wave = n; M.phase = 'wave'; const boss = n % 5 === 0; M.toSpawn = 4 + 2 * n + 2 * (M.np - 1); M.maxAlive = Math.min(6 + 2 * M.np + (n >> 1), 16); M.spawnT = 0;
  if (boss) spawnHordeBot(true); bannerWave(n, boss); if (isMP()) NET.net.hostBroadcast({ t: 'wv', n, boss: boss ? 1 : 0 });
}
function hordeTick(dt) {
  if (M.phase === 'break') { M.phaseT -= dt; if (M.phaseT <= 0) hordeStartWave(M.wave + 1); return; }
  if (M.phase !== 'wave') return;
  M.spawnT -= dt; const alive = botsAlive();
  if (M.toSpawn > 0 && alive < M.maxAlive && M.spawnT <= 0) { spawnHordeBot(false); M.toSpawn--; M.spawnT = .6; }
  if (M.toSpawn <= 0 && alive === 0) hordeClear();
}
function hordeClear() {
  M.phase = 'break'; M.phaseT = 9; announce(`Wave ${M.wave} cleared!`, '#7cecff'); showCenter('WAVE CLEARED!', '#7cecff'); sfx('medal');
  if (M.wave >= 15) { endHost(true, 'HORDE DEFEATED!', `You cleared all 15 waves with ${score.me} pops!`); return; }
  if (M.wave % 3 === 0) { M.lives++; announce('+1 team life', '#4aff8a'); }
  const pk = hostRollPickups(M.np); if (isMP()) NET.net.hostBroadcast({ t: 'pkall', pk, ch: chestWire() });
  if (P.alive) P.hp = Math.min(100, P.hp + 30); if (isMP()) NET.net.hostBroadcast({ t: 'heal', d: 30 });
}

// ---- leaving
function leaveMatch(msg) {
  if (NET.net) { try { NET.net.close(); } catch (e) {} } NET.net = null; NET.role = 'solo'; NET.me = 0; NET.roster = []; NET.code = '';
  for (const rp of remotes.values()) rp.dispose(); remotes.clear(); for (const b of bots) b.remove(); bots.length = 0; botById.clear(); for (const p of projs) scene.remove(p.m); projs.length = 0; clearHazards(); clearPickups();
  clearStormVis(); M = null; started = false; state = 'menu'; mouseL = mouseR = false; endUse(); clearHold(); if (document.pointerLockElement) document.exitPointerLock();
  for (const id of ['over', 'pause', 'lobby']) $(id).classList.add('hide'); $('menu').classList.remove('hide'); setNetMsg(msg || ''); loadMap(CFG.map, CFG.mode === 'royale'); buildPickupsPreview(); renderPickers();
}


// ------------------------------------------------------------------ game logic
function damagePlayer(dmg, from, self = false) {
  if (!P.alive || (P.protT > 0 && from !== STORM)) return;
  let rem = dmg, absorbed = 0; if (P.shield > 0) { absorbed = Math.min(P.shield, rem); P.shield -= absorbed; rem -= absorbed; }
  P.hp -= rem; P.lastHurt = time; sfx('hurt'); P.shakeT = Math.max(P.shakeT, .25);
  const v = $('vig'); v.classList.toggle('sh', absorbed > 0 && rem <= 0); v.classList.add('on'); clearTimeout(damagePlayer.t); damagePlayer.t = setTimeout(() => v.classList.remove('on'), 120);
  if (from && from.pos) dmgInd.push({ a: Math.atan2(-(from.pos.x - P.pos.x), -(from.pos.z - P.pos.z)), t: time });
  if (P.hp <= 0) {
    P.hp = 0; P.alive = false; P.deaths++; P.streak = 0; P.respT = 3; endUse(); clearHold(); adsTog = false; mouseL = mouseR = false;
    showCenter(from === STORM ? 'LOST TO THE STORM' : self ? 'OOPS! SELF-POP' : `POPPED BY ${from && from.name ? String(from.name).toUpperCase() : 'A BOT'}`, '#ff6a8a'); sfx('bye'); onLocalDeath(from, self);
  }
}
function feed(html) { const f = $('feed'), d = document.createElement('div'); d.innerHTML = html; f.appendChild(d); setTimeout(() => d.remove(), 4500); while (f.children.length > 5) f.firstChild.remove(); }
function showCenter(t, c) { const m = $('medal'); m.textContent = t; m.style.color = c; m.classList.remove('on'); void m.offsetWidth; m.classList.add('on'); }
function hint(t, c = '#fff') { const h = $('hint'); h.textContent = t; h.style.color = c; h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); }
function updScore() { updateTopBar(); }
function brSpawn(pid) {
  const np = Math.max(3, (M && M.np) || 1), a = (pid / np) * 6.283 + .7, r = HALF * .62, tx = Math.cos(a) * r, tz = Math.sin(a) * r; let best = WAYPOINTS[0], bd = 1e9;
  for (const w of WAYPOINTS) { const d = Math.hypot(w.x - tx, w.z - tz); if (d < bd) { bd = d; best = w; } } return best;
}
function spawnPlayer(initial) {
  let best = null;
  if (initial && M && M.mode === 'royale') best = brSpawn(NET.me); else if (initial) best = SPAWNS[(NET.me * 3) % SPAWNS.length];
  else { let bd = -1; for (const s of SPAWNS) { let md = 1e9; for (const b of bots) if (b.alive) md = Math.min(md, s.distanceTo(b.pos)); for (const rp of remotes.values()) if (rp.alive) md = Math.min(md, s.distanceTo(rp.pos) * 1.6); md += rnd(0, 4); if (md > bd) { bd = md; best = s; } } }
  P.pos.copy(best); P.vel.set(0, 0, 0); P.hp = 100; P.shield = 0; P.alive = true; P.yaw = Math.atan2(P.pos.x, P.pos.z); P.pitch = 0; P.crouchK = 0; P.h = STAND_H; P.eyeH = STAND_EYE; P.blindT = 0; P.buffT = 0;
  for (const w of W) { w.ammo = w.s.mag; w.cd = 0; } if (!W[cur].owned) cur = slots.find(e => e && e.gun !== undefined).gun; W.forEach((w, k) => w.g.visible = k === cur); selSlot = slotOf(cur); reloadT = 0; recP = recY = 0; stepOff = 0; lastPY = P.pos.y; throwCD = 0; endUse(); clearHold(); resetInv(); resetReserve(); adsTog = false; P.speedT = 0; burstLeft = 0; P.protT = 1.5; refreshItems(); refreshAmmo();
}
function clearHazards() {
  for (const n of nades) { scene.remove(n.m); disposeObj(n.m); } nades.length = 0;
  for (const s of smokes) { scene.remove(s.g); s.mat.dispose(); } smokes.length = 0;
  for (const f of fires) { scene.remove(f.g); for (const m of f.mats) m.dispose(); } fires.length = 0;
}

// ---- weapons
function clearHold() { holdItem = null; if (held) { vmScene.remove(held); disposeObj(held); held = null; } }
function equipItem(id, si) {
  clearHold(); holdItem = id; selSlot = si; endUse(); burstLeft = 0; reloadT = 0; wantSwap = -1; swapT = .18; adsTog = false; sfx('swap');
  W.forEach(w => w.g.visible = false); held = itemModel(id); held.scale.setScalar(.6); vmScene.add(held); refreshAmmo(); refreshSlots();
}
function selectWeapon(i, instant) {
  if (!W[i] || !W[i].owned) return; const wasItem = !!holdItem || !W[i].g.visible; if (holdItem) clearHold();   // wasItem: hands were busy or the gun was put away
  if (i === cur && !instant && !wasItem) { selSlot = slotOf(i); refreshSlots(); return; }
  endUse(); burstLeft = 0; adsTog = false; selSlot = slotOf(i);
  if (!instant && !wasItem) { wantSwap = i; swapT = .22; sfx('swap'); } else { cur = i; wantSwap = -1; swapT = wasItem ? .18 : 0; W.forEach((w, k) => w.g.visible = k === i); }
  reloadT = 0; refreshAmmo(); refreshSlots();
}
function selectSlot(n) { const e = slots[n]; if (!e) return; if (e.gun !== undefined) selectWeapon(e.gun); else equipItem(e.item, n); }
function cycleWeapon(dir) { const have = []; slots.forEach((e, i) => { if (e) have.push(i); }); if (have.length < 2) return; const i = have.indexOf(selSlot); selectSlot(have[(i + dir + have.length * 4) % have.length]); }
// F: drink / use / throw whatever is in your hand
function useHeld() {
  if (!holdItem || !P.alive || state !== 'play') return; const id = holdItem, it = ITEMS[id];
  if (it.kind === 'nade') { playerThrow(id); afterSpent(id); return; } startUse(id);
}
function afterSpent(id) {
  if (inv[id] > 0) { refreshAmmo(); refreshSlots(); return; }
  const si = itemSlot(id); if (si >= 0) slots[si] = null;
  if (holdItem === id) { clearHold(); const gi = slots.findIndex(e => e && e.gun !== undefined); if (gi >= 0) selectSlot(gi); }
  refreshSlots(); refreshItems();
}
function refreshSlots() {
  const s = $('slots'); while (s.children.length < SLOTN) s.appendChild(document.createElement('div'));
  [...s.children].forEach((e, i) => {
    const en = slots[i]; let nm = '', col = '#555';
    if (en && en.gun !== undefined) { nm = WDEF[en.gun].name; col = hex(RARITY[W[en.gun].rar].col); } else if (en) { const it = ITEMS[en.item]; nm = it.name + ' x' + inv[en.item]; col = hex(it.col); }
    e.innerHTML = en ? `<b>${i + 1}</b>${nm}` : `<b>${i + 1}</b>&mdash;`; e.className = (en ? '' : 'off ') + (en && i === selSlot ? 'on' : ''); e.style.setProperty('--rc', col);
  });
}
function refreshAmmo() {
  const rs = $('aRes').parentElement; if (rs) rs.style.visibility = holdItem ? 'hidden' : 'visible';
  if (holdItem) { const it = ITEMS[holdItem], c = hex(it.col); $('wName').textContent = it.name; $('wName').style.color = c; $('wRar').textContent = it.kind === 'nade' ? 'THROWABLE' : 'CONSUMABLE'; $('wRar').style.color = c; $('aMag').textContent = inv[holdItem]; $('rl').textContent = tx(it.kind === 'nade' ? 'PRESS F TO THROW' : 'PRESS F TO USE'); return; }
  const w = W[wantSwap >= 0 ? wantSwap : cur], R = RARITY[w.rar], c = hex(R.col);
  $('wName').textContent = w.d.name; $('wName').style.color = c; $('wRar').textContent = R.name; $('wRar').style.color = c; $('aMag').textContent = w.ammo; $('aRes').textContent = FREE() ? '\u221e' : reserve[w.d.at]; $('rl').textContent = tx(reloadT > 0 ? 'RELOADING...' : (w.ammo === 0 ? (!FREE() && reserve[w.d.at] <= 0 ? 'NO AMMO' : 'PRESS R') : ''));
}
function startReload() {
  const w = W[cur]; if (use || reloadT > 0 || w.ammo >= w.s.mag || swapT > 0) return;
  if (!FREE() && reserve[w.d.at] <= 0) { hint('NO ' + AMMO[w.d.at].name + ' AMMO - find an ammo box', '#ff8a8a'); sfx('empty'); return; }
  reloadT = w.s.reload; sfx('reload'); refreshAmmo();
}
function aimDir(spread) { const d = new V3(0, 0, -1); const e = new THREE.Euler(P.pitch, P.yaw, 0, 'YXZ'); d.applyEuler(e); if (spread) { const r = new V3(1, 0, 0).applyEuler(e), u = new V3(0, 1, 0).applyEuler(e); const a = rnd(0, 6.283), m = Math.sqrt(Math.random()) * spread; d.addScaledVector(r, Math.cos(a) * m).addScaledVector(u, Math.sin(a) * m).normalize(); } return d; }
function muzzleWorld() { const w = W[cur], p = new V3(w.muzzle.x, w.muzzle.y, w.muzzle.z).add(vmBase); p.applyEuler(camera.rotation); return p.add(camera.position); }
let vmBase = new V3(.27, -.25, -.5);
function fire(follow = false) {
  const w = W[cur], d = w.d, st = w.s; w.ammo--; if (!follow) { w.cd = st.rate; if (d.burst) { burstLeft = d.burst - 1; burstT = d.burstGap || .075; } } vmKick = d.kick * 4; flash.material.opacity = 1; flashLight.intensity = 6; setTimeout(() => flashLight.intensity = 0, 50); sfx(d.id); refreshAmmo();
  const dmgMul = P.buffT > 0 ? 2 : 1; const o = eyePos(); const move = Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 8), sp = (adsK > .5 ? st.spread : (st.hip || st.spread)) * (1 + move * 2.5) * (adsK > .5 ? .5 : 1) * (P.onGround ? 1 : 2) * (1 - P.crouchK * .4);
  recP += rnd(.5, 1) * d.kick * .3 * (adsK > .5 ? .6 : 1); recY += rnd(-.5, .5) * d.kick * .12; P.shakeT = Math.max(P.shakeT, .08);
  if (isHost()) for (const b of bots) if (b.alive && b.pos.distanceTo(P.pos) < 38) { b.alertT = Math.max(b.alertT, 3); b.lastSeen.copy(P.pos); }
  const mz = muzzleWorld();
  if (d.launch) { const dir = aimDir(0), vel = dir.multiplyScalar(26); vel.y += 2.4; spawnNade('shell', mz, vel, null); netEvent({ t: 'th', id: 'shell', p: v3a(mz), v: v3a(vel) }); return; }
  if (d.proj) { const dir = aimDir(0), vel = dir.multiplyScalar(30); spawnRocket(mz, vel, st.dmg, null); netEvent({ t: 'rk', p: v3a(mz), v: v3a(vel), d: r1(st.dmg) }); return; }
  let shotEnd = null;
  for (let i = 0; i < d.pellets; i++) {
    const dir = aimDir(sp); let tw = worldT(o, dir), hit = null, hb = null;
    for (const b of bots) { if (!b.alive || b.invT > 0) continue; const h = hitEntity(o, dir, b, b.headY); if (h && h.t < tw && (!hit || h.t < hit.t)) { hit = h; hb = b; } }
    if (M && M.pvp) for (const rp of remotes.values()) { if (!rp.alive || !rp.seen) continue; const h = hitEntity(o, dir, rp, rp.eyeH - .05); if (h && h.t < tw && (!hit || h.t < hit.t)) { hit = h; hb = rp; } }
    const end = hit ? hit.t : Math.min(tw, 120), endP = o.clone().addScaledVector(dir, end); if (!shotEnd) shotEnd = endP;
    if (i < 3 || d.pellets === 1) tracer(mz, endP, d.id === 'zap' ? 0x7cffff : (w.rar >= 3 ? RARITY[w.rar].col : 0xfff2a0), d.id === 'zap' ? .22 : .08);
    if (hit) {
      const fall = d.pellets > 1 ? 1 - clamp((hit.t - 7) / 22, 0, .75) : 1; const dmg = st.dmg * dmgMul * fall * (hit.head ? d.hs : 1); let killed = false;
      if (hb instanceof RemotePlayer) sendPlayerHit(hb, dmg, hit.head); else if (isHost()) killed = hb.hurt(dmg, hit.head, NET.me); else { NET.net.clientSend({ t: 'hit', b: hb.id, d: r1(dmg), h: hit.head ? 1 : 0 }); hb.flashT = .1; hb.barT = 2.5; }
      burst(endP, hit.head ? 0xffd34e : 0xffffff, 6, 5, .1, .4, 10); showHit(killed ? 'kill' : hit.head ? 'head' : ''); if (!killed) sfx(hit.head ? 'head' : 'hit');
    } else if (tw < 200) { burst(endP, 0xfff2a0, 4, 3, .08, .3, 8); }
  }
  if (isMP() && shotEnd) netEvent({ t: 'sh', a: v3a(mz), b: v3a(shotEnd), w: cur, r: w.rar });
}
function showHit(kind) { const h = $('hit'); h.className = 'on ' + kind; clearTimeout(showHit.t); showHit.t = setTimeout(() => h.className = '', 90); }

// ---- inventory panel (hold I)
const ITEM_DESC_ORDER = ITEM_IDS;
function invHTML() {
  let o = '<h2>YOUR 5 SLOTS (guns and items share them)</h2><div class="invg">';
  slots.forEach((e, i) => {
    if (!e) { o += `<div class="ig off"><b>${i + 1}</b><span class="nm">\u2014 empty \u2014</span></div>`; return; }
    if (e.gun !== undefined) { const w = W[e.gun], R = RARITY[w.rar]; o += `<div class="ig" style="--rc:${hex(R.col)}"><b>${i + 1}</b><span class="nm">${w.d.name}</span><span class="rr">${R.name}</span><span class="st">DMG ${Math.round(w.s.dmg)}${w.d.pellets > 1 ? '\u00d7' + w.d.pellets : ''} \u00b7 MAG ${w.s.mag} \u00b7 RELOAD ${w.s.reload.toFixed(1)}s \u00b7 ${AMMO[w.d.at].name}</span></div>`; }
    else { const it = ITEMS[e.item]; o += `<div class="ig" style="--rc:${hex(it.col)}"><b>${i + 1}</b><span class="nm">${it.name}</span><span class="rr">x${inv[e.item]}/${it.max}</span><span class="st">${it.desc}</span></div>`; }
  });
  o += '</div><h2>AMMO (not in your slots)</h2><div class="invi">';
  for (const k in AMMO) o += `<div class="ii${reserve[k] || FREE() ? '' : ' off'}"><i class="ic" style="--c:${hex(AMMO[k].col)};width:16px;height:16px;border-radius:3px"></i><span class="nm">${AMMO[k].name}</span><span class="ct">${FREE() ? '\u221e' : reserve[k] + '/' + AMMO[k].max}</span><span class="kk"> </span><span class="ds">for ${WDEF.filter(d => d.at === k).map(d => d.name).join(', ')}</span></div>`;
  return o + '</div><p class="hintline">1-5 or scroll to pick a slot \u00b7 F uses or throws what is in your hand \u00b7 E picks up (a full bag swaps your hand item)</p>';
}

// ---- consumables (heals + shields)
function buildItems() {
  const t = $('items'); t.innerHTML = '';
  ITEM_IDS.forEach((id, i) => { const it = ITEMS[id], c = document.createElement('div'); c.className = 'it' + (it.kind === 'nade' && (i === 0 || ITEMS[ITEM_IDS[i - 1]].kind !== 'nade') ? ' gap' : ''); c.id = 'it_' + id; c.title = it.name; c.innerHTML = `<span class="k">${it.key}</span><i class="ic ic-${id}" style="--c:${hex(it.col)}"></i><span class="n" id="n_${id}">0</span>`; t.appendChild(c); });
}
function refreshItems() { for (const id of ITEM_IDS) { const el = $('it_' + id); if (!el) return; $('n_' + id).textContent = inv[id]; el.classList.toggle('empty', inv[id] <= 0); el.classList.toggle('using', !!use && use.id === id); } }
function startUse(id) {
  if (state !== 'play' || !P.alive) return; const it = ITEMS[id];
  if (use) { const same = use.id === id; endUse(); if (same) return; }
  if (inv[id] <= 0) { hint('NO ' + it.name, '#ff8a8a'); sfx('empty'); return; }
  if (it.kind === 'heal' && P.hp >= it.cap) { hint(P.hp >= 100 ? 'HEALTH FULL' : 'BANDAGES STOP AT 75 - USE A MEDKIT', '#ffd34e'); return; }
  if (it.kind === 'shield' && P.shield >= it.cap) { hint(P.shield >= 100 ? 'SHIELD FULL' : 'MINIS STOP AT 50 - USE A BIG POT', '#ffd34e'); return; }
  if ((it.kind === 'chug' || it.kind === 'slurp') && P.hp >= 100 && P.shield >= 100) { hint('HEALTH AND SHIELD ARE FULL', '#ffd34e'); return; }
  use = { id, t: 0, dur: it.use, tick: .1, pct: -1 }; reloadT = 0; refreshAmmo();
  $('useLbl').textContent = 'USING ' + it.name; $('useFill').style.width = '0%'; $('useBar').classList.remove('hide'); refreshItems();
}
function endUse() { use = null; const b = $('useBar'); if (b) b.classList.add('hide'); refreshItems(); }
function finishUse() {
  const id = use.id, it = ITEMS[id]; inv[id]--;
  if (it.kind === 'heal') { P.hp = Math.max(P.hp, Math.min(it.cap, P.hp + it.amt)); sfx('heal'); feed(`<b style="color:#4aff8a">${it.name} used</b>`); }
  else if (it.kind === 'shield') { P.shield = Math.max(P.shield, Math.min(it.cap, P.shield + it.amt)); sfx('shieldUp'); feed(`<b style="color:#6ad0ff">${it.name} used</b>`); }
  else if (it.kind === 'chug') { P.hp = 100; P.shield = 100; sfx('heal'); sfx('shieldUp'); feed(`<b style="color:#c8a0ff">${it.name}: fully healed!</b>`); }
  else if (it.kind === 'slurp') { P.hp = Math.min(100, P.hp + 35); P.shield = Math.min(100, P.shield + 25); sfx('heal'); feed(`<b style="color:#4aeaa0">${it.name} used</b>`); }
  else if (it.kind === 'buff') { P.speedT = 20; sfx('shieldUp'); feed(`<b style="color:#ffa24a">SPEED SODA: gotta go fast!</b>`); }
  const v = $('vig'); v.classList.add(it.kind === 'heal' || it.kind === 'slurp' || it.kind === 'chug' ? 'heal' : 'shup'); setTimeout(() => v.classList.remove('heal', 'shup'), 260);
  burst(new V3(P.pos.x, P.pos.y + 1, P.pos.z), it.col, 12, 4, .1, .6, 4, 2); endUse(); afterSpent(id);
}

// ---- per-frame updates
function updatePlayer(dt) {
  if (!P.alive) { P.respT -= dt; P.shakeT = 0; if (P.respT <= 0) spawnPlayer(); return; }
  // crouch = Shift; stay low when there's no headroom to stand up
  let wantC = !!(keys.ShiftLeft || keys.ShiftRight);
  if (!wantC && P.crouchK > .02) { const probe = { pos: P.pos, r: P.r, h: STAND_H }; if (world.some(b => overlaps(probe, b))) wantC = true; }
  P.crouchK += ((wantC ? 1 : 0) - P.crouchK) * clamp(dt * 14, 0, 1); if (!wantC && P.crouchK < .02) P.crouchK = 0;
  P.h = STAND_H - (STAND_H - CROUCH_H) * P.crouchK; P.eyeH = STAND_EYE - (STAND_EYE - CROUCH_EYE) * P.crouchK;
  const fwd = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw)), wish = new V3();
  if (keys.KeyW) wish.add(fwd); if (keys.KeyS) wish.sub(fwd); if (keys.KeyD) wish.add(right); if (keys.KeyA) wish.sub(right); if (wish.lengthSq() > 0) wish.normalize();
  const sprint = keys.Tab && keys.KeyW && P.crouchK < .3 && !use;   // sprint = Tab (hold) + W
  const spd = (sprint ? 10.5 : 7.2) * (adsK > .5 ? .65 : 1) * (1 - .5 * P.crouchK) * (use ? .6 : 1) * (P.speedT > 0 ? 1.35 : 1) * (!holdItem && W[cur].d.heavy && mouseL ? .55 : 1), ctl = P.onGround ? 14 : 2.8;
  P.vel.x += (wish.x * spd - P.vel.x) * clamp(ctl * dt, 0, 1); P.vel.z += (wish.z * spd - P.vel.z) * clamp(ctl * dt, 0, 1);
  if (keys.Space && P.onGround && P.crouchK < .6) { P.vel.y = 7.6; P.onGround = false; }
  moveEntity(P, dt);
  P.buffT = Math.max(0, P.buffT - dt); P.speedT = Math.max(0, (P.speedT || 0) - dt); P.protT = Math.max(0, (P.protT || 0) - dt); throwCD = Math.max(0, throwCD - dt); throwAnim = Math.max(0, throwAnim - dt);
  // weapon state
  const w = W[cur]; if (w.cd > 0) w.cd -= dt;
  if (swapT > 0) { swapT -= dt; if (swapT <= .11 && wantSwap >= 0) { cur = wantSwap; wantSwap = -1; W.forEach((x, k) => x.g.visible = k === cur); refreshAmmo(); refreshSlots(); } if (swapT <= 0) swapT = 0; }
  if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { const need = w.s.mag - w.ammo, take = FREE() ? need : Math.min(need, reserve[w.d.at]); w.ammo += take; if (!FREE()) reserve[w.d.at] -= take; reloadT = 0; refreshAmmo(); } }
  if (burstLeft > 0) { burstT -= dt; if (burstT <= 0) { if (w.ammo > 0 && w.d.burst && swapT <= 0 && reloadT <= 0 && !use) { fire(true); burstT = w.d.burstGap || .075; burstLeft--; } else burstLeft = 0; } }
  if (use) { use.t += dt; use.tick -= dt; if (use.tick <= 0) { use.tick = .3; sfx('tick'); } const pct = Math.min(100, Math.floor(use.t / use.dur * 100)); if (pct !== use.pct) { use.pct = pct; $('useFill').style.width = pct + '%'; } if (use.t >= use.dur) finishUse(); }
  if (holdItem) { if (mouseL && !firedThis) { firedThis = true; useHeld(); } }
  else if (mouseL && !use && swapT <= 0 && reloadT <= 0 && w.cd <= 0) { if (w.ammo > 0) { if (w.d.auto || !firedThis) { fire(); firedThis = true; } } else if (!firedThis) { sfx('empty'); startReload(); firedThis = true; } }
  if (!mouseL) firedThis = false;
}
function updateCamera(dt) {
  const w = W[cur], tgt = (mouseR || adsTog) && P.alive && swapT <= 0 && reloadT <= 0 && !use && !holdItem ? 1 : 0; adsK += (tgt - adsK) * clamp(dt * 12, 0, 1);
  const wantFov = S.fov * (1 - adsK) + (w.d.zoom ? w.d.zoom : (w.d.adsFov || S.fov * .8)) * adsK; if (Math.abs(wantFov - camera.fov) > .01) { camera.fov += (wantFov - camera.fov) * clamp(dt * 14, 0, 1); camera.updateProjectionMatrix(); }
  // recoil climbs smoothly instead of snapping
  const ap = recP * clamp(dt * 26, 0, 1), ay = recY * clamp(dt * 26, 0, 1); P.pitch += ap; P.yaw += ay; recP -= ap; recY -= ay; P.pitch = clamp(P.pitch, -1.5, 1.5);
  // step-ups teleport the player up a bit; ease the camera instead of popping
  const dyP = P.pos.y - lastPY; lastPY = P.pos.y; if (inMatch() && P.alive && P.onGround && dyP > .12 && dyP <= STEP + .05) stepOff -= dyP; stepOff *= 1 - clamp(dt * 14, 0, 1);
  const sh = P.shakeT > 0 ? P.shakeT : 0; if (P.shakeT > 0) P.shakeT -= dt;
  const nx = Math.sin(time * 71) + Math.sin(time * 43 + 1), ny = Math.sin(time * 67 + 2) + Math.sin(time * 37), nr = Math.sin(time * 59 + 4);
  const y = P.alive ? P.pos.y + P.eyeH + stepOff : P.pos.y + .35;
  const bobAmp = P.alive && P.onGround ? Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 7) : 0; vmBob += dt * (6 + Math.hypot(P.vel.x, P.vel.z) * .8) * (bobAmp > 0 ? 1 : 0);
  camera.position.set(P.pos.x + nx * sh * .07, y + Math.sin(vmBob * 2) * .025 * bobAmp + ny * sh * .06, P.pos.z + nx * sh * .07);
  camera.rotation.set(P.pitch + ny * sh * .01, P.yaw, !P.alive ? Math.min(.5, (3 - Math.min(3, P.respT)) * .4) : nr * sh * .01);
  // viewmodel
  const g = w.g; vmKick = Math.max(0, vmKick - dt * 14); useK += ((use ? 1 : 0) - useK) * clamp(dt * 10, 0, 1);
  const sw = swapT > 0 ? Math.sin((swapT / .22) * Math.PI) : 0, rl = reloadT > 0 ? Math.sin((1 - reloadT / w.s.reload) * Math.PI) : 0, thr = throwAnim > 0 ? Math.sin((throwAnim / .35) * Math.PI) : 0;
  const adsOffY = w.d.adsY !== undefined ? w.d.adsY : -.17, adsOffZ = w.d.adsZ !== undefined ? w.d.adsZ : -.42; const base = new V3(.27 * (1 - adsK), -.25 * (1 - adsK) + adsOffY * adsK, -.5 * (1 - adsK) + adsOffZ * adsK); vmBase.copy(base);
  g.position.set(base.x + Math.sin(vmBob) * .012 * bobAmp * (1 - adsK), base.y + Math.abs(Math.cos(vmBob)) * .01 * bobAmp * (1 - adsK) - sw * .35 - rl * .1 - useK * .5 - thr * .12, base.z + vmKick * .08 + rl * .05);
  g.rotation.set(vmKick * .09 - rl * .5 + sw * .6 + thr * .5 + useK * .4, 0, rl * .25 + Math.sin(vmBob) * .01 * bobAmp);
  if (held) { const dip = swapT > 0 ? Math.sin((swapT / .22) * Math.PI) * .3 : 0; held.position.set(.12 + Math.sin(vmBob) * .01, -.3 - dip - thr * .1 + (use ? Math.sin(time * 14) * .02 : Math.sin(time * 2) * .006), -.5); held.rotation.y += dt * (use ? 4 : 1.2); held.rotation.x = use ? .35 + Math.sin(time * 10) * .12 : .3; }
  flash.position.copy(g.position).add(new V3(w.muzzle.x, w.muzzle.y, w.muzzle.z - .05)); flash.rotation.z += .7; flash.material.opacity = Math.max(0, flash.material.opacity - dt * 16); flash.visible = flash.material.opacity > .02 && adsK < .6 && !holdItem;
  flashLight.position.copy(camera.position).add(new V3(0, 0, -1).applyEuler(camera.rotation));
  // eliminated in a battle royale: watch a living player (click to switch)
  if (!P.alive && P.respT > 1e8 && M) { const list = [...remotes.values()].filter(r => r.alive && r.seen); if (list.length) { const rp = list[specI % list.length]; camera.position.set(rp.pos.x, rp.pos.y + rp.eyeH, rp.pos.z); camera.rotation.set(rp.pitch, rp.yaw, 0); specName = rp.name.toUpperCase(); } else specName = ''; } else specName = '';
  const scoped = w.d.zoom && adsK > .85; $('scope').classList.toggle('hide', !scoped); vmScene.visible = !scoped && P.alive && inMatch();
}
const hc = {}; const setTxt = (id, v) => { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } }, setSty = (id, k, v) => { const key = id + k; if (hc[key] !== v) { hc[key] = v; $(id).style[k] = v; } };
function updateTopBar() {
  if (!M) return; const solo = !isMP();
  setTxt('lMe', M.mode === 'horde' ? 'POPS' : solo ? 'YOU' : 'TEAM'); setTxt('sMe', score.me);
  if (M.mode === 'tdm') { setTxt('lMid', 'FIRST TO'); setTxt('sMid', M.target); setTxt('lBots', 'BOTS'); setTxt('sBots', score.bots); }
  else if (M.mode === 'blitz') { const t = Math.max(0, Math.ceil(M.timeLeft)); setTxt('lMid', 'TIME'); setTxt('sMid', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')); setTxt('lBots', 'BOTS'); setTxt('sBots', score.bots); }
  else if (M.mode === 'free') { setTxt('lMe', 'POPS'); setTxt('sMe', P.kills); setTxt('lMid', 'FREEPLAY'); setTxt('sMid', '\u221e'); setTxt('lBots', 'ARMORY'); setTxt('sBots', RARITY[M.rarity].name); }
  else if (M.mode === 'brawl') {
    let best = P.kills, bn = 'YOU'; for (const rp of remotes.values()) if (rp.kills > best) { best = rp.kills; bn = rp.name.slice(0, 8); }
    setTxt('lMe', 'YOU'); setTxt('sMe', P.kills); setTxt('lMid', 'FIRST TO'); setTxt('sMid', M.target); setTxt('lBots', 'LEADER'); setTxt('sBots', bn + ' ' + best);
  } else if (M.mode === 'royale') {
    const S = M.storm; setTxt('lMe', 'KILLS'); setTxt('sMe', P.kills); setTxt('lMid', 'ALIVE'); setTxt('sMid', botsAlive() + humansAlive());
    setTxt('lBots', S && S.state === 'shrink' ? 'STORM' : 'STORM IN'); setTxt('sBots', !S ? '-' : S.state === 'shrink' ? 'CLOSING' : S.t > 900 ? 'FINAL' : Math.max(0, Math.ceil(S.t)) + 's');
  } else { const br = M.phase === 'break'; setTxt('lMid', br ? (M.wave ? 'NEXT WAVE IN' : 'STARTING IN') : 'WAVE ' + M.wave); setTxt('sMid', br ? Math.max(0, Math.ceil(M.phaseT)) : (M.left + ' left')); setTxt('lBots', 'LIVES'); setTxt('sBots', M.lives); }
}
function renderTeam() {
  const t = $('team'); t.innerHTML = ''; for (const [pid, rp] of remotes) { const d = document.createElement('div'); d.className = 'tm'; const i = document.createElement('i'); i.style.background = hex(rp.color); const s = document.createElement('span'); s.textContent = rp.name; const bar = document.createElement('div'); bar.className = 'tbar'; const f = document.createElement('b'); f.id = 'tmh_' + pid; bar.appendChild(f); d.append(i, s, bar); t.appendChild(d); }
  for (const k of Object.keys(hc)) if (k.startsWith('tmh_')) delete hc[k];
}
let hudT = 0;
function updateHUD(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 1 / 30;
  updateTopBar();
  setTxt('hpNum', Math.ceil(P.hp)); setSty('hpFill', 'width', P.hp + '%'); $('hpFill').classList.toggle('low', P.hp < 35); $('vig').classList.toggle('low', P.hp < 35 && P.alive);
  setTxt('shNum', P.shield > 0 ? '+' + Math.ceil(P.shield) : ''); setSty('shFill', 'width', P.shield + '%');
  const w = W[cur]; setTxt('aMag', holdItem ? inv[holdItem] : w.ammo); setTxt('aRes', holdItem ? '' : FREE() ? '\u221e' : reserve[w.d.at]);
  { const nt = P.alive ? nearestInteract() : null, pt = nt ? promptText(nt) : ''; setTxt('promptT', pt); setSty('prompt', 'display', pt ? 'flex' : 'none'); if (nt) setSty('promptT', 'color', nt.col); } setTxt('rl', tx(holdItem ? (ITEMS[holdItem].kind === 'nade' ? 'PRESS F TO THROW' : 'PRESS F TO USE') : reloadT > 0 ? 'RELOADING...' : (w.ammo === 0 ? (!FREE() && reserve[w.d.at] <= 0 ? 'NO AMMO' : 'PRESS R') : '')));
  setTxt('buff', !P.alive ? (P.respT < 1e8 ? `RESPAWNING IN ${Math.max(0, Math.ceil(P.respT))}` : M && M.mode === 'royale' ? (specName ? 'SPECTATING ' + specName + ' (click to switch)' : 'ELIMINATED') : 'OUT OF LIVES') : P.buffT > 0 ? `DOUBLE DAMAGE ${Math.ceil(P.buffT)}s` : P.speedT > 0 ? `SPEED SODA ${Math.ceil(P.speedT)}s` : '');
  const spread = (8 + Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 8) * 10 + (P.onGround ? 0 : 8) + w.s.spread * 500) * (1 - P.crouchK * .35) * (adsK > .5 ? .5 : 1), c = $('cross');
  const T = { t: [0, -spread], b: [0, spread], l: [-spread, 0], r: [spread, 0] };
  for (const key in T) setSty('cross_' + key, 'transform', `translate(${T[key][0].toFixed(1)}px,${T[key][1].toFixed(1)}px)`);
  c.style.opacity = (w.d.zoom && adsK > .85) || (w.d.holo && adsK > .4) ? 0 : 1;
  for (const [pid, rp] of remotes) if ($('tmh_' + pid)) setSty('tmh_' + pid, 'width', (rp.alive ? clamp(rp.hp, 0, 100) : 0) + '%');
  const boss = bots.find(b => b.boss && b.alive); $('boss').classList.toggle('hide', !boss); if (boss) setSty('bossFill', 'width', clamp(boss.hp / boss.maxHp * 100, 0, 100) + '%');
  // direction indicators
  dmgInd = dmgInd.filter(d => time - d.t < 1.2); const dir = $('dir');
  if (dmgInd.length || dir.children.length) { dir.innerHTML = ''; for (const d of dmgInd) { const i = document.createElement('i'); i.style.transform = `rotate(${(-(d.a - P.yaw) * 180 / Math.PI) + 180}deg)`; i.style.opacity = Math.max(0, 1 - (time - d.t) / 1.2); i.style.transition = 'none'; dir.appendChild(i); } }
  // radar
  const r = $('radar'), x = r.getContext('2d'), R = 132; x.clearRect(0, 0, 264, 264); x.save(); x.translate(R, R); x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(0, 0, R - 4, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, (R - 4) / 2, 0, 7); x.stroke();
  const rr = curBig ? 62 : 40, sc = (R - 10) / rr, cs = Math.cos(P.yaw), sn = Math.sin(P.yaw);
  const dot = (wx, wz, col, rad) => { const dx = wx - P.pos.x, dz = wz - P.pos.z, rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; let px = rx * sc, py = rz * sc; const m = Math.hypot(px, py), lim = R - 10; if (m > lim) { px *= lim / m; py *= lim / m; } x.fillStyle = col; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill(); };
  if (M && M.storm) { const S = M.storm, dx = S.cx - P.pos.x, dz = S.cz - P.pos.z, rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; x.save(); x.beginPath(); x.arc(0, 0, R - 4, 0, 7); x.clip(); x.strokeStyle = 'rgba(200,130,255,.95)'; x.lineWidth = 3; x.beginPath(); x.arc(rx * sc, rz * sc, S.r * sc, 0, 7); x.stroke(); x.restore(); }
  for (const ch of chests) if (!ch.open) dot(ch.x, ch.z, '#ffc233', 6);
  for (const pk of pickups) if (pk.on) dot(pk.x, pk.z, pk.css, pk.id === 'gun' ? 5 : 4);
  for (const f of fires) dot(f.pos.x, f.pos.z, 'rgba(255,120,30,.8)', 7);
  for (const s of smokes) dot(s.c.x, s.c.z, 'rgba(230,236,246,.8)', 8);
  for (const b of bots) if (b.alive) dot(b.pos.x, b.pos.z, b.boss ? '#ff2a4a' : '#ff5a6a', b.boss ? 9 : 6);
  for (const rp of remotes.values()) if (rp.alive && rp.seen) { if (!(M && M.pvp)) dot(rp.pos.x, rp.pos.z, hex(rp.color), 6); else if (Math.hypot(rp.pos.x - P.pos.x, rp.pos.z - P.pos.z) < 16) dot(rp.pos.x, rp.pos.z, '#ff5a6a', 6); }
  x.fillStyle = '#2ee6ff'; x.beginPath(); x.moveTo(0, -9); x.lineTo(7, 7); x.lineTo(-7, 7); x.closePath(); x.fill(); x.restore();
}

// ---- adaptive resolution: keeps the framerate (and so the mouse look) smooth on slower GPUs
let perfT = 0, perfN = 0, lastRaise = -99, fpsShown = 60, lastFo = -1;
function adaptRes(raw) {
  if (raw > .25) return;   // ignore tab-switch / alt-tab hiccups
  perfT += raw; perfN++; if (perfT < 1.5) return;
  const avg = perfT / perfN; fpsShown = 1 / avg; perfT = perfN = 0;
  const pe = $('perf'); if (pe) pe.textContent = `${Math.round(fpsShown)} fps · ${GFX} graphics \u00b7 render ${Math.round(resScale * 100)}%`;
  if (!inMatch()) return;
  if (avg > .0215 && resScale > QL.min) { resScale = Math.max(QL.min, resScale - .12); if (time - lastRaise < 12) resCeil = resScale; resize(); }
  else if (avg < .0185 && resScale < resCeil) { resScale = Math.min(resCeil, resScale + .06); lastRaise = time; resize(); }
}
const inMatch = () => state === 'play' || state === 'pause';
const simOn = () => !!M && !M.over && (state === 'play' || (isMP() && state === 'pause'));
function step(dt) {
  time += dt; P.blindT = Math.max(0, P.blindT - dt);
  for (const c of clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 260) c.position.x = -260; } for (const [i, b] of balloons.entries()) b.position.y += Math.sin(time * 1.2 + i) * .004; updateSnow(dt);
  updatePickups(dt); updateChests(dt);
  if (curBig) { sun.position.set(P.pos.x + 30, 50, P.pos.z + 20); sun.target.position.set(P.pos.x, 0, P.pos.z); sun.target.updateMatrixWorld(); }
  if (simOn()) {
    updatePlayer(dt);
    if (isHost()) hostTick(dt); else for (const b of bots) b.update(dt);
    for (const rp of remotes.values()) rp.update(dt);
    updateNades(dt); updateSmokes(dt); updateFires(dt); updateProjs(dt); updateStormVis(dt); netTick(dt);
  } else if (state === 'menu' || state === 'lobby' || state === 'over') {
    const a = time * .12, r = HALF * .78; P.pos.set(Math.cos(a) * r, 7, Math.sin(a) * r); P.yaw = Math.atan2(P.pos.x, P.pos.z); P.pitch = -.22; P.alive = true; P.vel.set(0, 0, 0);
    if (M && state === 'over') for (const rp of remotes.values()) rp.update(dt);
  }
  const fo = P.blindT > 0 ? (P.blindT > P.blindMax * .45 ? 1 : P.blindT / (P.blindMax * .45)) : 0; if (fo !== lastFo) { lastFo = fo; $('flashfx').style.opacity = fo; }
  updateFX(dt); updateCamera(dt); if (inMatch()) updateHUD(dt);
}
let renderTick = 0;
function render() { if (QL.skip) renderer.shadowMap.needsUpdate = (renderTick++ & 1) === 0; renderer.clear(); renderer.render(scene, camera); if (vmScene.visible) { renderer.clearDepth(); vmCam.fov = 58; renderer.render(vmScene, vmCam); } }
let last = performance.now(), hudVis = null, fpsN = 0, fpsT = 0, fpsTxt = '';
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function loop(now) {
  const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; const hv = (state === 'menu' || state === 'lobby') ? 'hidden' : 'visible'; if (hv !== hudVis) { $('hud').style.visibility = hv; hudVis = hv; }
  step(dt); render(); adaptRes(raw); fpsTick(raw); requestAnimationFrame(loop);
}


// ------------------------------------------------------------------ menus, lobby, input
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function setNetMsg(t) { for (const id of ['netMsg', 'lobbyMsg']) { const e = $(id); if (e) e.textContent = t || ''; } }
function buildPickupsPreview() { if (!M) hostRollPickups(1); }
function setCfg(k, v) {
  if (NET.role === 'client') return; CFG[k] = v; save(k, v);
  if (k === 'mode' && v !== 'royale' && (MAPS.find(m => m.id === CFG.map) || {}).br) { CFG.map = 'plaza'; save('map', 'plaza'); }
  if ((k === 'map' || k === 'mode') && !M) { loadMap(CFG.map, CFG.mode === 'royale'); hostRollPickups(1); }
  renderPickers(); if (NET.role === 'host') NET.net.hostBroadcast({ t: 'cfg', cfg: wireCfg() });
}
function renderPickers() {
  for (const [root, editable] of [[$('menuPickers'), true], [$('lobbyPickers'), NET.role !== 'client']]) {
    if (!root) continue; root.innerHTML = '';
    const gm = mk('div', 'grp'); gm.appendChild(mk('h3', '', 'MODE')); const rm = mk('div', 'row');
    for (const id of Object.keys(MODES)) { const b = mk('button', id === CFG.mode ? 'sel' : '', MODES[id].name); b.disabled = !editable; b.onclick = () => setCfg('mode', id); rm.appendChild(b); }
    gm.appendChild(rm); gm.appendChild(mk('p', 'mdesc', MODES[CFG.mode].blurb)); root.appendChild(gm);
    const gp = mk('div', 'grp'); gp.appendChild(mk('h3', '', 'MAP')); const maps = mk('div', 'maps');
    for (const m of MAPS.filter(m => !m.br || CFG.mode === 'royale')) { const c = mk('button', 'mapc' + (m.id === CFG.map ? ' sel' : '')); c.disabled = !editable; c.style.background = `linear-gradient(180deg, rgba(10,6,24,0) 15%, rgba(10,6,24,.62)), linear-gradient(180deg, ${m.swatch[0]}, ${m.swatch[1]} 55%, ${m.swatch[2]})`; c.appendChild(mk('b', '', m.name)); c.appendChild(mk('span', '', m.blurb)); c.onclick = () => setCfg('map', m.id); maps.appendChild(c); }
    gp.appendChild(maps); root.appendChild(gp);
    const gd = mk('div', 'grp'); gd.appendChild(mk('h3', '', 'BOTS')); const rd = mk('div', 'row');
    for (const [id, nm] of [['easy', 'Chill bots'], ['normal', 'Normal bots'], ['hard', 'Sweaty bots']]) { const b = mk('button', id === CFG.diff ? 'sel' : '', nm); b.disabled = !editable; b.onclick = () => setCfg('diff', id); rd.appendChild(b); }
    gd.appendChild(rd); root.appendChild(gd);
    if (root.id === 'menuPickers') {
      const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
      for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !QS.get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' + (NETMODE === 'local' ? '&net=local' : '') : ''); }; rg.appendChild(b); }
      gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (GFX_PREF === 'auto' || !['low', 'med', 'high'].includes(GFX_PREF) ? ' (picked automatically for this computer)' : '') + '. On a Chromebook or a slow laptop, Low runs smoothest.')); root.appendChild(gg);
    }
    if (CFG.mode === 'free') {
      const gr = mk('div', 'grp'); gr.appendChild(mk('h3', '', 'ARMORY RARITY')); const rr = mk('div', 'row');
      RARITY.forEach((R, i) => { const b = mk('button', i === CFG.rarity ? 'sel' : '', R.name); b.disabled = !editable; b.style.background = hex(R.col); b.onclick = () => setCfg('rarity', i); rr.appendChild(b); }); gr.appendChild(rr); root.appendChild(gr);
      const gt = mk('div', 'grp'); gt.appendChild(mk('h3', '', 'TARGETS')); const rt = mk('div', 'row');
      for (const [id, nm] of [['dummy', 'Training dummies'], ['bots', 'Bots that fight back']]) { const b = mk('button', id === CFG.fp ? 'sel' : '', nm); b.disabled = !editable; b.onclick = () => setCfg('fp', id); rt.appendChild(b); } gt.appendChild(rt); root.appendChild(gt);
    }
  }
}
function showLobby() {
  state = 'lobby'; $('menu').classList.add('hide'); $('over').classList.add('hide'); $('pause').classList.add('hide'); $('lobby').classList.remove('hide'); renderPickers(); renderLobby();
}
function renderLobby() {
  const code = $('lobbyCode'); if (!code) return; code.textContent = NET.code || '-----';
  const ro = $('roster'); ro.innerHTML = '';
  for (const r of NET.roster) {
    const row = mk('div', 'rost'); const dot = mk('i'); dot.style.background = hex(r.color); row.appendChild(dot); row.appendChild(mk('span', 'rn', r.name + (r.pid === NET.me ? ' (you)' : '')));
    if (r.pid === 0) row.appendChild(mk('em', '', 'HOST')); else if (NET.role === 'host') { const k = mk('button', 'kick', 'Remove'); k.onclick = () => NET.net.kick(r.pid); row.appendChild(k); }
    ro.appendChild(row);
  }
  const host = NET.role === 'host'; $('startBtn').style.display = host ? '' : 'none'; $('lobbyWait').style.display = host ? 'none' : '';
  $('startBtn').textContent = NET.roster.length > 1 ? `START MATCH (${NET.roster.length} players)` : 'START (solo for now)';
}
function lockPointer() {
  if (DEBUG || TOUCH) { audioInit(); onLock(true); return; } audioInit();
  try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { canvas.requestPointerLock(); } catch (e) {} }); } catch (e) { try { canvas.requestPointerLock(); } catch (e2) {} }
}
function onLock(locked) {
  if (locked) { audioInit(); if (state === 'pause') state = 'play'; for (const id of ['pause', 'menu', 'lobby']) $(id).classList.add('hide'); }
  else if (state === 'play') { state = 'pause'; for (const k in keys) keys[k] = false; mouseL = mouseR = false; $('pauseT').textContent = 'PAUSED'; $('resume').textContent = 'RESUME'; $('restart').style.display = isMP() ? 'none' : ''; $('pause').classList.remove('hide'); }
}
document.addEventListener('pointerlockchange', () => onLock(document.pointerLockElement === canvas));
document.addEventListener('pointerlockerror', () => { if (started && state === 'play') { state = 'pause'; $('pause').classList.remove('hide'); } });
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas && !DEBUG && !TOUCH) return; if (state !== 'play' || !P.alive) return;
  if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;   // ignore the occasional bogus spike
  const k = .0022 * S.sens * (adsK > .5 ? (W[cur].d.zoom ? .3 : .7) : 1); P.yaw -= e.movementX * k; P.pitch -= e.movementY * k;
});
addEventListener('mousedown', e => { if (state !== 'play') return; if (!P.alive) specI++; if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (state !== 'play') return; cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
addEventListener('keydown', e => {
  if (e.code === 'Tab' && state === 'play') e.preventDefault();   // Tab is sprint, don't let it move browser focus
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (state !== 'play') return;
  if (e.code === 'KeyR' && !holdItem) startReload();
  if (e.code === 'KeyF' && !e.repeat) useHeld();
  if (e.code === 'KeyZ' && !e.repeat) adsTog = !adsTog;
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; selectSlot(n); }
  if (e.code === 'KeyE' && !e.repeat) interact();
  if (e.code === 'KeyT') { $('board2').innerHTML = boardHTML(); $('board-screen').classList.remove('hide'); }
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyI') { $('invpanel').innerHTML = '<div class="box">' + invHTML() + '</div>'; $('invpanel').classList.remove('hide'); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyT') $('board-screen').classList.add('hide'); if (e.code === 'KeyI') $('invpanel').classList.add('hide'); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; $('invpanel').classList.add('hide'); });
$('pname').value = load('name', ''); $('pname').addEventListener('input', () => save('name', cleanName($('pname').value)));
$('play').onclick = () => { audioInit(); startSolo(); lockPointer(); };
$('hostBtn').onclick = () => { audioInit(); netHost(); };
$('joinBtn').onclick = () => { audioInit(); netJoin($('joinCode').value); };
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
$('joinCode').addEventListener('input', () => { $('joinCode').value = cleanCode($('joinCode').value); });
$('startBtn').onclick = () => { audioInit(); hostStart(); lockPointer(); };
$('leaveLobby').onclick = () => leaveMatch('');
$('copyCode').onclick = () => { const c = NET.code; try { navigator.clipboard.writeText(c); $('copyCode').textContent = 'Copied!'; setTimeout(() => $('copyCode').textContent = 'Copy code', 1500); } catch (e) {} };
$('resume').onclick = lockPointer;
$('leaveBtn').onclick = () => leaveMatch('');
$('toMenu').onclick = () => leaveMatch('');
$('again').onclick = () => { if (NET.role === 'client') return; if (NET.role === 'host') hostStart(); else startSolo(); lockPointer(); };
$('restart').onclick = () => { startSolo(); lockPointer(); };
for (const [id, key, lab] of [['sens', 'sens', 'sensV'], ['fovR', 'fov', 'fovV'], ['vol', 'vol', 'volV']]) { const el = $(id); el.value = S[key]; $(lab).textContent = S[key]; el.oninput = () => { S[key] = +el.value; $(lab).textContent = S[key]; save(key, S[key]); if (key === 'vol' && master) master.gain.value = S.vol; }; }
if (TOUCH) {
  document.querySelector('#prompt kbd').textContent = 'USE'; $('touchWarn').style.display = 'block'; $('touchWarn').textContent = 'Touch controls: left thumb moves (push all the way to sprint), right thumb looks and shoots. Tap a weapon slot to switch.';
  const sl = '#slots > div', pk = (code, label, o) => Object.assign({ key: code, label, type: 'tap', s: 56, cls: 'small' }, o);
  initTouch({
    visible: () => state === 'play', pause: () => onLock(false), lookScale: 2.3,
    stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprintKey: 'Tab', sprintAt: .9 },
    taps: [{ sel: sl, key: (el, i) => 'Digit' + (i + 1) }],
    buttons: [
      { label: 'FIRE', cls: 'fire', mouse: 0, look: true, minHold: 90, s: 92, r: 24, b: 64 },
      { label: 'AIM', type: 'toggle', mouse: 2, isOn: () => mouseR, s: 58, r: 40, b: 168, cls: 'small' },
      pk('Space', 'JUMP', { type: 'hold', s: 64, r: 128, b: 22 }),
      pk('KeyR', 'RELOAD', { s: 58, r: 132, b: 100, fs: 10 }),
      pk('KeyE', 'USE', { s: 58, r: 206, b: 60, glow: () => $('prompt').style.display === 'flex' }),
      pk('KeyF', 'ITEM', { s: 52, r: 206, b: 130 }),
      { label: 'CROUCH', type: 'toggle', key: 'ShiftLeft', s: 52, r: 270, b: 22, cls: 'small', fs: 9 },
      pk('KeyI', 'BAG', { type: 'toggle', s: 40, l: 118, t: 8, fs: 10 }),
      pk('KeyT', 'SCORE', { type: 'toggle', s: 40, l: 164, t: 8, fs: 8 }),
      { label: 'II', s: 40, l: 210, t: 8, cls: 'small', type: 'tap', action: () => onLock(false), fs: 14 },
    ],
    css: `
      html.touch #radar { width: 92px; height: 92px; top: 8px; left: 8px; }
      html.touch #score { top: 6px; font-size: 18px; gap: 8px; } html.touch #score .pill { padding: 2px 10px; min-width: 56px; border-radius: 10px; } html.touch #score small { font-size: 9px; }
      html.touch #hp { left: 10px; bottom: 8px; width: 170px; } html.touch #hp .num { font-size: 22px; margin-bottom: 2px; } html.touch #hp .bar { height: 14px; border-width: 2px; } html.touch #hp .bar.shb { height: 8px; margin-bottom: 3px; }
      html.touch #ammo { right: 12px; top: 26px; bottom: auto; } html.touch #ammo .wname { font-size: 14px; } html.touch #ammo .wrar { font-size: 9px; } html.touch #ammo .cnt { font-size: 36px; } html.touch #ammo .cnt small { font-size: 16px; } html.touch #ammo .rl { font-size: 12px; height: 14px; }
      html.touch #feed { top: 112px; right: 12px; } html.touch #feed div { font-size: 12px; padding: 3px 9px; }
      html.touch #slots { bottom: 8px; gap: 4px; left: 40%; } html.touch #slots div { width: 62px; font-size: 9px; padding: 3px 2px; border-width: 2px; border-radius: 9px; } html.touch #slots div b { font-size: 12px; }
      html.touch #useBar { bottom: 70px; } html.touch #hint { bottom: 96px; font-size: 14px; } html.touch #buff { bottom: 120px; font-size: 14px; } html.touch #team { top: 108px; left: 10px; } html.touch #boss { top: 52px; width: 300px; }
      html.touch #prompt { top: 50%; margin-top: 60px; } html.touch #medal { font-size: 30px; }
    `,
  });
}
if (NETMODE === 'peerjs' && !window.Peer) { $('hostBtn').disabled = $('joinBtn').disabled = true; setNetMsg('Online co-op needs the PeerJS library, which could not load. Solo still works!'); }
for (const key of ['t', 'b', 'l', 'r']) $('cross').querySelector('.' + key).id = 'cross_' + key;
buildItems(); refreshItems(); refreshSlots(); refreshAmmo();
loadMap(CFG.map, CFG.mode === 'royale'); hostRollPickups(1); renderPickers();
window.__ba = { P, bots, W, S, CFG, NET, remotes, step, render, selectWeapon, fire, get state() { return state; }, get M() { return M; }, set mouse(v) { mouseL = v; }, shot: () => { step(0.001); render(); return canvas.toDataURL('image/png'); }, setState: s => state = s, score, world, hitEntity, pickups, pkById, DIFF, keys, inv, ITEMS, nades, smokes, fires, startUse, playerThrow,
  get use() { return use; }, resetInv, spawnNade, detonate, damagePlayer, get resScale() { return resScale; }, camera, humansAlive, stormOutside, slots, reserve, AMMO, giveGun, interact, nearestInteract, selectSlot, lootUseful, chests, promptText, FREE, startReload, hostOpenChest, openChestFx, addChest, nextCh, get curBig() { return curBig; }, giveItem, equipItem, useHeld, dropSlot, itemSlot, afterSpent, GFX, QL, get holdItem() { return holdItem; }, get selSlot() { return selSlot; }, set adsTog(v) { adsTog = v; }, get adsTog() { return adsTog; }, RARITY, applyRarity, rollGun, rollLoot, WDEF, MAPS, MODES, cycleWeapon, invHTML, loadMap, startSolo, hostStart, netHost, netJoin, leaveMatch, buildSnap, applySnap, setCfg, botById, tryCollect, applyLoot, hostGrant, get HALF() { return HALF; }, SPAWNS, WAYPOINTS, LOOT_SPOTS, hostPlayerDied, endHost, checkEnd, hordeStartWave, botsAlive, spawnPlayer, renderer, scene };
requestAnimationFrame(loop);
