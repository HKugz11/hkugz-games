// CORE STRIKE - 5v5 tactical toy-soldier shooter. No blood: eliminated players pop into cubes.
import * as THREE from './three.module.min.js';
import { W, H, CS, G, ZONE, HG, hAt, hPos, zoneAt, cellOf, cellX, cellZ, WALKABLE, blocked, groundAt, rayWorld, clearLine, astar, SITES, ROUTES, MID_HOLDS, LURK, SPAWN, walk, nearestWalk, MAP, MAP_LIST, loadMap } from './map.js?v=46';
import { initAudio, setVolume, setListener, SFX } from './audio.js';
import { createOnline } from './online.js?v=46';
import { buildWorld, soldierParts, tpGuns, charMat, lensMats, buildGun, fpMat, sleeveMat, SIDE_SLEEVE, ENV, disposeWorld } from './art.js?v=46';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const DEG = Math.PI / 180;
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const V = () => new THREE.Vector3();

// ---------------- settings ----------------
const DEFAULTS = { sens: 1, fov: 85, vol: 0.7, xhColor: '#4dff7a', xhSize: 6, xhGap: 4, xhDot: '0', diff: 'normal', length: 'short', side: 'random', mode: 'comp', gfx: 'high', map: 'sandstone', name: '' };
const S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem('cs.settings') || localStorage.getItem('coreStrike') || '{}')); } catch { }
const saveS = () => { try { localStorage.setItem('cs.settings', JSON.stringify(S)); } catch { } };
let STATS = { wins: 0, losses: 0, range: 0 };
try { Object.assign(STATS, JSON.parse(localStorage.getItem('cs.stats') || localStorage.getItem('coreStrikeStats') || '{}')); } catch { }
const saveStats = () => { try { localStorage.setItem('cs.stats', JSON.stringify(STATS)); } catch { } };
const LOW = S.gfx === 'low';
// online play: role is 'none' (single player), 'host' (runs the match) or 'client' (draws what the host sends)
const MP = { on: false, role: 'none', idx: -1, pid: 0, cfg: null, nid: 0 };
let MPH = null;
const mySq = () => (GS.player ? GS.player.squad : 0);

// ---------------- renderer ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 0.85 : 1.25));
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd9dfe5, 28, 175);
const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.05, 700);
camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
vmScene.add(vmCam);
vmScene.add(new THREE.HemisphereLight(0xeef2f6, 0x8a7060, 2.0));
const vmSun = new THREE.DirectionalLight(0xffffff, 1.2); vmSun.position.set(1, 2, 1.5); vmScene.add(vmSun);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  vmCam.aspect = w / h; vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xe6edf4, 0xa98670, 1.9));
const sun = new THREE.DirectionalLight(0xfff6ea, 1.45);
sun.position.set(W + 40, 90, H - 30);
sun.target.position.set(W, 0, H);
sun.castShadow = !LOW;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 220 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// ---------------- textures ----------------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const softTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const starTex = canvasTex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,200,80,.9)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  x.fillStyle = g; x.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 10 : 31, a = i * Math.PI / 8; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill();
});
const holeTex = canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(20,14,8,1)'); g.addColorStop(0.45, 'rgba(40,28,16,.9)'); g.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });

const geoBox = new THREE.BoxGeometry(1, 1, 1);
if (!MAP_LIST.some((m) => m.id === S.map)) S.map = 'sandstone';
loadMap(S.map);
const holdLookCache = new Map();
let WORLD = null;
const radarImg = document.createElement('canvas'); radarImg.width = W * 4; radarImg.height = H * 4;
function drawRadarImg() {
  const x = radarImg.getContext('2d'); x.clearRect(0, 0, radarImg.width, radarImg.height);
  for (let z = 0; z < H; z++) for (let cx = 0; cx < W; cx++) {
    const ch = G[z * W + cx], zn = ZONE[z * W + cx];
    x.fillStyle = ch === '#' ? 'rgba(0,0,0,0)' : 'Cc'.includes(ch) ? '#6d6253' : 'P123'.includes(ch) ? '#8f8a80' : ch === 'o' || ch === 's' ? '#7a6d55' : zn === 'a' || zn === 'b' ? '#b06a5a' : '#c9b48e';
    x.fillRect(cx * 4, z * 4, 4, 4);
  }
  x.fillStyle = '#fff'; x.font = 'bold 22px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const k of ['a', 'b']) x.fillText(SITES[k].name, SITES[k].center[0] * 4, SITES[k].center[1] * 4 + 2);
}
function applyWorld() {
  if (WORLD) disposeWorld(WORLD.group);
  WORLD = buildWorld(scene);
  sun.position.copy(sun.target.position).addScaledVector(WORLD.sunDir, 130);
  scene.fog.color.setHex(MAP.theme.fog);
  drawRadarImg(); holdLookCache.clear();
  renderer.shadowMap.needsUpdate = true;
}
function setMap(id) { if (id === MAP.id) return; loadMap(id); applyWorld(); }
applyWorld();

// ---------------- FX ----------------
const PMAX = 1400;
const pMesh = new THREE.InstancedMesh(geoBox, new THREE.MeshBasicMaterial(), PMAX);
pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pMesh.frustumCulled = false;
pMesh.setColorAt(0, new THREE.Color()); pMesh.count = 0; scene.add(pMesh);
const parts = [];
const dummy = new THREE.Object3D();
const colCache = {};
const colOf = (hex) => colCache[hex] || (colCache[hex] = new THREE.Color(hex));
function spawnP(x, y, z, vx, vy, vz, life, size, hex, grav = 16) {
  if (parts.length >= PMAX) parts.shift();
  parts.push({ x, y, z, vx, vy, vz, life, max: life, size, c: colOf(hex), grav, rx: Math.random() * 6, ry: Math.random() * 6, spin: rand(-12, 12) });
}
function burst(x, y, z, n, speed, cols, size = 0.08, life = 0.5, grav = 16, up = 0) {
  if (LOW) n = Math.ceil(n * 0.5);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = speed * rand(0.3, 1), r = Math.sqrt(1 - e * e);
    spawnP(x, y, z, Math.cos(a) * r * s, e * s + up, Math.sin(a) * r * s, life * rand(0.6, 1.2), size * rand(0.6, 1.3), pick(cols), grav);
  }
}
function updateParts(dt) {
  let n = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const g = hPos(p.x, p.z);
    if (g > 40) { p.life = 0; continue; }
    if (p.y < g + p.size / 2) { p.y = g + p.size / 2; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; p.spin *= 0.6; }
    p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
  }
  for (const p of parts) {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, 0);
    dummy.scale.setScalar(p.size * Math.min(1, (p.life / p.max) * 3));
    dummy.updateMatrix(); pMesh.setMatrixAt(n, dummy.matrix); pMesh.setColorAt(n, p.c); n++;
  }
  pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
}
// tracers
const tracers = [];
const trMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(geoBox, trMat); m.visible = false; scene.add(m); tracers.push({ m, t: 0 }); }
let trI = 0;
function tracer(a, b) {
  const tr = tracers[trI++ % tracers.length], len = a.distanceTo(b);
  if (len < 0.5) return;
  tr.m.position.copy(a).add(b).multiplyScalar(0.5); tr.m.scale.set(0.022, 0.022, len); tr.m.lookAt(b); tr.m.visible = true; tr.t = 0.05;
}
// decals
const DMAX = 220;
const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), DMAX);
decals.count = 0; decals.frustumCulled = false; scene.add(decals);
let dI = 0;
const _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
function decal(p, n) {
  dummy.position.copy(p).addScaledVector(n, 0.01); dummy.quaternion.copy(_q.setFromUnitVectors(_z, n)); dummy.rotation.z += Math.random() * 6; dummy.scale.setScalar(rand(0.8, 1.2));
  dummy.updateMatrix(); decals.setMatrixAt(dI % DMAX, dummy.matrix); dI++; decals.count = Math.min(dI, DMAX); decals.instanceMatrix.needsUpdate = true;
}
// explosions
const booms = [];
function explosionFx(p, big, hex = 0xffa040) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(p); scene.add(m); booms.push({ m, t: 0, max: big ? 1.1 : 0.45, size: big ? 16 : 4 });
  boomLight.color.setHex(hex); boomLight.position.copy(p).y += 1; boomLight.intensity = big ? 120 : 40; boomLight.distance = big ? 60 : 18; booms.push({ l: boomLight, t: 0, max: big ? 0.8 : 0.3 });
  burst(p.x, p.y + 0.3, p.z, big ? 160 : 40, big ? 22 : 11, ['#ffcf4a', '#ff8a2a', '#fff3c0', '#ff5a3d', '#555'], big ? 0.28 : 0.12, big ? 1.6 : 0.8, 12, 4);
}
function updateBooms(dt) {
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i]; b.t += dt; const k = b.t / b.max;
    if (k >= 1) { if (b.m) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); } if (b.l) b.l.intensity = 0; booms.splice(i, 1); continue; }
    if (b.m) { b.m.scale.setScalar(0.3 + b.size * Math.sqrt(k)); b.m.material.opacity = 0.9 * (1 - k); }
    if (b.l) b.l.intensity *= Math.pow(0.02, dt / b.max);
  }
}
const muzzleLight = new THREE.PointLight(0xffc060, 0, 9); scene.add(muzzleLight);
const boomLight = new THREE.PointLight(0xffa040, 0, 20); scene.add(boomLight);

// ---------------- weapons ----------------
function pattern(n, climb, sway) {
  const out = [[0, 0]]; let p = 0, y = 0;
  for (let i = 1; i < n + 2; i++) {
    if (i < 10) { p += climb * (1 - i * 0.045); y += Math.sin(i * 1.7) * 0.06 * sway; }
    else { p += climb * 0.06; y += ((Math.floor((i - 10) / 7) % 2) ? 1 : -1) * sway * 0.38; }
    out.push([p, y]);
  }
  return out;
}
const WD = {
  knife: { name: 'Karambit', slot: 'knife', melee: true, speed: 7.0, reward: 1500 },
  p9: { name: 'P-9 Classic', slot: 'sec', price: 200, dmg: 30, rpm: 400, mag: 12, res: 120, reload: 2.1, speed: 6.8, inacc: 0.55, moveInacc: 2.2, airInacc: 7, pen: 0.47, range: 0.9, recoil: 1.2, rec: 6, reward: 300, tier: 0, snd: [2900, 0.11, 0.9], acc: '#2f7f9e', desc: 'Free starter pistol. Fast taps.' },
  viper: { name: 'Viper .50', slot: 'sec', price: 700, dmg: 53, rpm: 267, mag: 7, res: 35, reload: 2.2, speed: 6.6, inacc: 0.7, moveInacc: 4, airInacc: 9, pen: 0.93, range: 0.93, recoil: 3.2, rec: 3.5, reward: 300, tier: 1, snd: [1700, 0.26, 1.5], acc: '#ffd04a', desc: 'Hand cannon. Headshot = one tap.' },
  buzz: { name: 'Buzz SMG', slot: 'prim', price: 1250, dmg: 26, rpm: 857, auto: true, mag: 30, res: 120, reload: 2.3, speed: 6.6, inacc: 0.9, moveInacc: 1.8, airInacc: 6, pen: 0.6, range: 0.85, recoil: 0.5, rec: 10, reward: 600, tier: 2, snd: [3400, 0.08, 0.7], acc: '#6f7f3a', desc: 'Runs fast, shoots fast. $600 per kill.' },
  thumper: { name: 'Thumper', slot: 'prim', price: 1100, dmg: 22, pellets: 9, cone: 3.8, rpm: 70, mag: 7, res: 32, reload: 2.8, speed: 6.3, inacc: 0.4, moveInacc: 1.2, airInacc: 4, pen: 0.75, range: 0.6, recoil: 4, rec: 2.5, reward: 900, tier: 2, snd: [1300, 0.34, 1.7], acc: '#7a3340', desc: 'Shotgun. Deadly up close. $900 per kill.' },
  raptor: { name: 'Raptor AR', slot: 'prim', price: 2700, dmg: 36, rpm: 600, auto: true, mag: 30, res: 90, reload: 2.5, speed: 6.0, inacc: 0.3, moveInacc: 5.5, airInacc: 10, pen: 0.775, range: 0.98, recoil: 1.0, rec: 7, reward: 300, tier: 3, snd: [2000, 0.17, 1.2], acc: '#b0662e', desc: 'Hard hitter. Headshot = one tap.' },
  sentinel: { name: 'Sentinel AR', slot: 'prim', price: 2900, dmg: 33, rpm: 666, auto: true, mag: 25, res: 75, reload: 3.0, speed: 6.1, inacc: 0.24, moveInacc: 4.8, airInacc: 10, pen: 0.7, range: 0.97, recoil: 0.8, rec: 7.5, reward: 300, tier: 3, snd: [1300, 0.1, 0.8], acc: '#3b6fa8', desc: 'Accurate, easy spray, quiet.', quiet: true },
  longbow: { name: 'Longbow', slot: 'prim', price: 4750, dmg: 115, rpm: 41, mag: 5, res: 30, reload: 3.6, speed: 5.2, inacc: 6, scopedInacc: 0.03, moveInacc: 9, airInacc: 15, pen: 0.975, range: 0.995, recoil: 5, rec: 2, scope: true, reward: 100, tier: 4, snd: [1100, 0.5, 2.1], acc: '#4f5b3c', desc: 'Sniper. One shot to the body. Right-click to scope.' },
  tec: { name: 'Rattler', slot: 'sec', price: 500, dmg: 27, rpm: 520, mag: 24, res: 120, reload: 2.2, speed: 6.7, inacc: 0.8, moveInacc: 1.3, airInacc: 6, pen: 0.5, range: 0.85, recoil: 0.9, rec: 8, reward: 300, tier: 1, snd: [3000, 0.1, 0.8], acc: '#a8793a', desc: 'Machine pistol. Fast, loose, great on the move.' },
  revolver: { name: 'Peacemaker', slot: 'sec', price: 650, dmg: 86, rpm: 115, mag: 6, res: 24, reload: 3.2, speed: 6.5, inacc: 0.5, moveInacc: 6, airInacc: 10, pen: 0.95, range: 0.96, recoil: 5.2, rec: 2.2, reward: 300, tier: 1, snd: [1500, 0.32, 1.9], acc: '#b8913f', desc: 'Slow six-shooter. Two body shots kill.' },
  chopper: { name: 'Chopper', slot: 'prim', price: 1400, dmg: 24, rpm: 800, auto: true, mag: 50, res: 100, reload: 3.4, speed: 6.3, inacc: 0.75, moveInacc: 2.4, airInacc: 7, pen: 0.7, range: 0.88, recoil: 0.55, rec: 9, reward: 300, tier: 2, snd: [3100, 0.09, 0.8], acc: '#556b8a', desc: '50-round SMG. Strong while moving.' },
  scatter: { name: 'Scatter', slot: 'prim', price: 1800, dmg: 18, pellets: 6, cone: 3.2, rpm: 210, mag: 8, res: 32, reload: 3.2, speed: 6.2, inacc: 0.4, moveInacc: 1.2, airInacc: 4, pen: 0.7, range: 0.62, recoil: 2.8, rec: 3, reward: 900, tier: 2, snd: [1400, 0.3, 1.5], acc: '#6a7a3a', desc: 'Semi-auto shotgun. Fires fast up close.' },
  carbine: { name: 'Carbine', slot: 'prim', price: 2050, dmg: 29, rpm: 666, auto: true, mag: 25, res: 90, reload: 2.4, speed: 6.2, inacc: 0.28, moveInacc: 4.6, airInacc: 10, pen: 0.68, range: 0.96, recoil: 0.8, rec: 7, reward: 300, tier: 3, snd: [2300, 0.12, 0.9], acc: '#6a6e75', desc: 'Budget rifle. Easy spray.' },
  ranger: { name: 'Ranger', slot: 'prim', price: 1750, dmg: 88, rpm: 48, mag: 10, res: 30, reload: 2.6, speed: 6.4, inacc: 4, scopedInacc: 0.05, moveInacc: 7, airInacc: 12, pen: 0.9, range: 0.995, recoil: 3.2, rec: 2.5, scope: true, zoomLv: 1, reward: 300, tier: 3, snd: [1400, 0.3, 1.6], acc: '#7a5a34', desc: 'Light bolt sniper. Fast to move. Right-click to scope.' },
  dmr: { name: 'Marksman', slot: 'prim', price: 3000, dmg: 68, rpm: 190, mag: 12, res: 36, reload: 3.1, speed: 5.8, inacc: 3, scopedInacc: 0.06, moveInacc: 8, airInacc: 13, pen: 0.88, range: 0.99, recoil: 2.4, rec: 4, scope: true, zoomLv: 1, reward: 300, tier: 4, snd: [1500, 0.25, 1.5], acc: '#4e5f43', desc: 'Semi-auto sniper. Two body shots kill.' },
  lmg: { name: 'Hammer LMG', slot: 'prim', price: 5200, dmg: 32, rpm: 750, auto: true, mag: 100, res: 200, reload: 5.8, speed: 4.9, inacc: 0.5, moveInacc: 7, airInacc: 12, pen: 0.8, range: 0.95, recoil: 1.1, rec: 4, reward: 300, tier: 4, snd: [1700, 0.2, 1.4], acc: '#4a4f3a', desc: '100 rounds. Slow and heavy. Suppresses.' },
  he: { name: 'HE Grenade', nade: true, price: 300, speed: 6.9, reward: 300, max: 1, col: '#4caf50', desc: 'Boom. Big damage in a small area.' },
  flash: { name: 'Flashbang', nade: true, price: 200, speed: 6.9, max: 2, col: '#e6f0ff', desc: 'Blinds anyone looking at it.' },
  smoke: { name: 'Smoke', nade: true, price: 300, speed: 6.9, max: 1, col: '#9aa0a6', desc: 'Wall of smoke for 18 s.' },
  molly: { name: 'Molotov', nade: true, price: 400, speed: 6.9, max: 1, reward: 300, col: '#e0742a', desc: 'Bursts into flames. Burns an area for 7 s.' },
};
for (const k in WD) if (WD[k].mag) WD[k].pat = pattern(WD[k].mag, WD[k].recoil * 0.5, WD[k].recoil);
const GEAR = {
  kevlar: { name: 'Kevlar Vest', price: 650, desc: '100 armor (body)' },
  helm: { name: 'Vest + Helmet', price: 1000, desc: 'Armor + head protection' },
  kit: { name: 'Defuse Kit', price: 400, desc: 'Defuse in 5 s (Wardens only)' },
};
const KNIFE = { id: 'knife' };
const NADEW = { he: { id: 'he' }, flash: { id: 'flash' }, smoke: { id: 'smoke' }, molly: { id: 'molly' } };
const newGun = (id) => ({ id, mag: WD[id].mag, res: WD[id].res });
function recoilAt(def, f) {
  const p = def.pat; const i = Math.min(Math.floor(f), p.length - 2), k = Math.min(f - i, 1);
  return [p[i][0] + (p[i + 1][0] - p[i][0]) * k, p[i][1] + (p[i + 1][1] - p[i][1]) * k];
}

// ---------------- actors ----------------
const SIDE = [
  { name: 'RAIDERS', role: 'attack', css: '#ff9a3d', main: 0xff8a2a, vest: 0x5b3a22, pants: 0x6b4a2f, visor: 0xffd04a },
  { name: 'WARDENS', role: 'defend', css: '#4aa3ff', main: 0x2f8cff, vest: 0x1d2b48, pants: 0x2a3550, visor: 0x40e0ff },
];
const sideMats = SIDE.map((s) => ({
  main: new THREE.MeshLambertMaterial({ color: s.main }), vest: new THREE.MeshLambertMaterial({ color: s.vest }),
  pants: new THREE.MeshLambertMaterial({ color: s.pants }), visor: new THREE.MeshLambertMaterial({ color: 0x111118, emissive: s.visor, emissiveIntensity: 0.9 }),
  boot: new THREE.MeshLambertMaterial({ color: 0x222226 }), gun: new THREE.MeshLambertMaterial({ color: 0x2a2d35 }), skin: new THREE.MeshLambertMaterial({ color: 0xf0c8a0 }),
}));
function mbox(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(geoBox, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
function makeSoldier(a) {
  const SP = soldierParts(a.side), TG = tpGuns(), g = new THREE.Group();
  const mk = (geo, parent) => { const m = new THREE.Mesh(geo, charMat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const hip = (x) => { const h = new THREE.Group(); h.position.set(x, 0.62, 0); g.add(h); mk(x < 0 ? SP.thighL : SP.thighR, h); const k = new THREE.Group(); k.position.y = -0.31; h.add(k); mk(SP.shin, k); return [h, k]; };
  const [legL, kneeL] = hip(-0.145), [legR, kneeR] = hip(0.145);
  const up = new THREE.Group(); g.add(up); mk(SP.torso, up);
  const head = new THREE.Group(); head.position.set(0, 1.55, 0); up.add(head); mk(SP.head, head);
  const lens = new THREE.Mesh(SP.lens, lensMats[a.side]); lens.position.set(...SP.lensPos); lens.rotation.y = Math.PI; head.add(lens);
  const arms = new THREE.Group(); arms.position.set(0, 1.3, 0); up.add(arms); mk(SP.arms, arms);
  const gunP = mk(TG.prim, arms), gunS = mk(TG.sec, arms), gunK = mk(TG.knife, arms);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flash.scale.setScalar(0.5); flash.visible = false; arms.add(flash);
  if (GS.player && a.squad === GS.player.squad && !a.isPlayer) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = 'bold 34px "Chakra Petch",Arial'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.8)'; x.strokeText(a.name, 128, 44); x.fillStyle = '#9dffb0'; x.fillText(a.name, 128, 44);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }));
    tag.scale.set(1.3, 0.33, 1); tag.position.y = 2.2; tag.renderOrder = 999; g.add(tag);
  }
  if (a.mesh) scene.remove(a.mesh.g);
  a.mesh = { g, legL, legR, kneeL, kneeR, up, head, arms, gunP, gunS, gunK, flash, phase: 0, flashT: 0 };
  g.visible = a.alive && !a.isPlayer;
  scene.add(g);
}

const NAMES = ['Pixel', 'Noodle', 'Turbo', 'Waffles', 'Gizmo', 'Biscuit', 'Sprocket', 'Mango', 'Rocket', 'Pickles', 'Nugget', 'Zappy', 'Bolt', 'Taco', 'Nova', 'Scooter'];
let aidN = 0;
class Actor {
  constructor(name, squad, isPlayer) {
    Object.assign(this, {
      id: aidN++, name, squad, isPlayer, side: 0, pos: V(), vel: V(), yaw: 0, pitch: 0, hp: 100, armor: 0, helmet: false, kit: false, alive: false,
      money: 800, prim: null, sec: null, nades: { he: 0, flash: 0, smoke: 0, molly: 0 }, slot: 'sec', lastSlot: 'knife', nadeSel: 'he', crouch: false, crouchAmt: 0, walk: false,
      onGround: true, rc: 0, lastShot: -9, nextFire: 0, reloadT: 0, switchT: 0, scoped: 0, rescope: 0, blindT: 0, act: null, kills: 0, deaths: 0, hs: 0, dmg: 0,
      roundKills: 0, stepAcc: 0, mesh: null, brain: null, respawnT: 0, protT: 0, spawnT: 0, spotT: -99, tagT: 0, fullReset: true, shots: 0, hits: 0, idx: -1, human: !!isPlayer, remote: false, pid: -1,
    });
  }
}
const curW = (a) => a.slot === 'prim' ? a.prim : a.slot === 'sec' ? a.sec : a.slot === 'knife' ? KNIFE : NADEW[a.nadeSel];
const curDef = (a) => WD[curW(a).id];
const eyeY = (a) => a.pos.y + 1.55 - 0.42 * a.crouchAmt;
const eyePos = (a, o = V()) => o.set(a.pos.x, eyeY(a), a.pos.z);
const headPos = (a, o = V()) => o.set(a.pos.x, a.pos.y + 1.55 - 0.25 * a.crouchAmt, a.pos.z);
const chestPos = (a, o = V()) => o.set(a.pos.x, a.pos.y + 1.05 - 0.25 * a.crouchAmt, a.pos.z);
const fwd = (yaw, pitch, o = V()) => o.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
const hasNade = (a) => a.nades.he + a.nades.flash + a.nades.smoke + a.nades.molly > 0;
function slotOK(a, s) { return s === 'prim' ? !!a.prim : s === 'sec' ? !!a.sec : s === 'knife' ? true : hasNade(a); }
function equip(a, s) {
  if (!slotOK(a, s)) return;
  if (s === 'nade' && a.slot === 'nade') { cycleNade(a); return; }
  if (a.slot === s) return;
  if (s === 'nade' && !a.nades[a.nadeSel]) cycleNade(a);
  a.lastSlot = a.slot; a.slot = s; a.switchT = s === 'knife' ? 0.25 : 0.4; a.reloadT = 0; a.scoped = 0; a.rescope = 0; a.act = a.act && a.act.type === 'plant' ? null : a.act;
  if (a.isPlayer) { SFX.swap(); vmSet(); }
}
function cycleNade(a) {
  const order = ['he', 'flash', 'smoke', 'molly']; let i = order.indexOf(a.nadeSel);
  for (let k = 1; k <= 4; k++) { const n = order[(i + k) % 4]; if (a.nades[n]) { a.nadeSel = n; break; } }
  if (a.isPlayer) vmSet();
}
const bestSlot = (a) => a.prim ? 'prim' : a.sec ? 'sec' : 'knife';

// ---------------- viewmodel ----------------
const vmRoot = new THREE.Group(); vmCam.add(vmRoot);
vmScene.environment = ENV;
const GM = {};
const vmModels = {};
const vmMat = (key, hex) => fpMat(key === 'body' ? 'poly' : key, hex);
function buildVM(id) {
  const b = buildGun(id, new THREE.Color(WD[id].acc || WD[id].col || '#ffb13d').getHex());
  GM[id] = b;
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.scale.setScalar(0.28); fl.visible = false; b.mz.add(fl);
  b.g.userData = { mz: b.mz, fl };
  return b.g;
}
let vmCur = null, vmId = '';
const VMS = { ads: 0, spr: 0, kick: 0, bob: 0, swayX: 0, swayY: 0, inspect: 0, slash: 0, flashT: 0, land: 0 };
function vmSet() {
  const P = GS.player; if (!P) return;
  const id = curW(P).id;
  if (id === vmId) return;
  if (vmCur) vmRoot.remove(vmCur);
  vmCur = vmModels[id] || (vmModels[id] = buildVM(id));
  vmRoot.add(vmCur); vmId = id; VMS.inspect = 0;
}

// ---------------- game state ----------------
const DIFF = {
  easy: { react: 0.65, turn: 5, err: 6, settle: 1.6, head: 0.1, spread: 1.5, comp: 0.2, see: 32, nade: 0.2, team: 0.15, lead: 0 },
  normal: { react: 0.42, turn: 8, err: 3.6, settle: 2.4, head: 0.22, spread: 1.15, comp: 0.5, see: 42, nade: 0.45, team: 0.5, lead: 0.04 },
  hard: { react: 0.28, turn: 12, err: 2.1, settle: 3.5, head: 0.36, spread: 1.0, comp: 0.7, see: 50, nade: 0.7, team: 0.8, lead: 0.09 },
  insane: { react: 0.19, turn: 18, err: 1.2, settle: 5, head: 0.52, spread: 0.9, comp: 0.85, see: 58, nade: 0.9, team: 1, lead: 0.14 },
};
const GS = {
  state: 'menu', mode: 'comp', actors: [], player: null, round: 0, score: [0, 0], loss: [0, 0], target: 5, halfAt: 4, maxRounds: 8,
  phaseT: 0, roundT: 0, buyLeft: 0, time: 0, core: null, nades: [], smokes: [], fires: [], drops: [], plan: 'a', execute: false, execT: 0, fetcher: null,
  paused: false, deathT: 0, spec: 0, shake: 0, roundStart: 0, rangeHits: 0, rangeShots: 0, rangeHS: 0, killer: null,
};
const D = () => DIFF[S.diff] || DIFF.normal;
const alive = (side) => GS.actors.filter((a) => a.alive && a.side === side);
const enemies = (a) => GS.actors.filter((e) => e.alive && e.side !== a.side);

// core (the "bomb")
const coreMesh = new THREE.Group();
{
  mbox(coreMesh, 0.36, 0.24, 0.24, new THREE.MeshLambertMaterial({ color: 0x22252e }), 0, 0.12, 0);
  const glow = new THREE.Mesh(geoBox, new THREE.MeshBasicMaterial({ color: 0xffa030 })); glow.scale.set(0.2, 0.12, 0.26); glow.position.y = 0.16; coreMesh.add(glow);
  mbox(coreMesh, 0.38, 0.04, 0.26, new THREE.MeshLambertMaterial({ color: 0xffb13d }), 0, 0.03, 0);
  coreMesh.userData.glow = glow;
  const l = new THREE.PointLight(0xff8a2a, 6, 6); l.position.y = 0.5; coreMesh.add(l); coreMesh.userData.light = l;
}
scene.add(coreMesh);
function coreBeep(c, dt) {
  c.beepT -= dt;
  const rate = clamp(c.timer / 40, 0.08, 1);
  if (c.beepT <= 0) { c.beepT = 0.12 + rate * 0.9; SFX.beep(c.pos); coreMesh.userData.light.intensity = 30; }
  coreMesh.userData.light.intensity *= Math.pow(0.02, dt * 3);
}
function resetCore(carrier) {
  GS.core = { state: carrier ? 'carried' : 'none', carrier, pos: V(), timer: 40, site: null, beepT: 0, smoked: false, mollied: false };
}

// ---------------- combat ----------------
const _v1 = V(), _v2 = V(), _v3 = V();
function rayActor(o, d, e, maxT) {
  const x = e.pos.x, z = e.pos.z, y = e.pos.y, c = e.crouchAmt;
  let best = null;
  // head sphere
  const hy = y + 1.55 - 0.25 * c, ox = o.x - x, oy = o.y - hy, oz = o.z - z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - 0.22 * 0.22, disc = b * b - cc;
  if (disc > 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) best = { t, part: 'head' }; }
  const boxT = (x0, y0, z0, x1, y1, z1) => {
    let tmin = 0, tmax = maxT;
    for (const [oo, dd, lo, hi] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
      let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd; if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return -1;
    }
    return tmin;
  };
  const bt = boxT(x - 0.3, y + 0.62 - 0.25 * c, z - 0.3, x + 0.3, y + 1.36 - 0.25 * c, z + 0.3);
  if (bt >= 0 && (!best || bt < best.t)) best = { t: bt, part: 'body' };
  const lt = boxT(x - 0.26, y, z - 0.26, x + 0.26, y + 0.62 - 0.25 * c, z + 0.26);
  if (lt >= 0 && (!best || lt < best.t)) best = { t: lt, part: 'legs' };
  return best;
}
function smokeBlocks(p, q) {
  for (const s of GS.smokes) {
    if (s.r < 1.5) continue;
    const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, L2 = dx * dx + dy * dy + dz * dz;
    let t = ((s.x - p.x) * dx + (s.y - p.y) * dy + (s.z - p.z) * dz) / (L2 || 1); t = clamp(t, 0, 1);
    const cx = p.x + dx * t - s.x, cy = p.y + dy * t - s.y, cz = p.z + dz * t - s.z;
    if (cx * cx + cy * cy * 1.6 + cz * cz < s.r * s.r * 0.85) return true;
  }
  return false;
}
function losClear(p, q, smoke = true) {
  const d = _v3.subVectors(q, p), L = d.length(); if (L < 0.01) return true; d.divideScalar(L);
  const h = rayWorld(p, d, L);
  if (h && h.t < L - 0.05) return false;
  return !(smoke && smokeBlocks(p, q));
}
function computeSpread(a, def) {
  let s = def.scope ? (a.scoped ? def.scopedInacc : def.inacc) : def.inacc;
  const sp = Math.hypot(a.vel.x, a.vel.z), mx = def.speed;
  s += def.moveInacc * clamp((sp - mx * 0.34) / (mx * 0.6), 0, 1);
  if (!a.onGround) s += def.airInacc;
  if (a.crouch && a.onGround) s *= 0.72;
  if (a.ads) s *= 0.5;
  if (a.sprint) s += def.moveInacc * 0.6;
  s += Math.min(a.rc, 10) * def.recoil * (def.auto ? 0.05 : 0.2);
  return s;
}
function noiseEvent(pos, radius, src) {
  for (const b of GS.actors) if (b.brain && b.alive && b.side !== src.side && b.pos.distanceTo(pos) < radius) { b.brain.heardPos = pos.clone(); b.brain.heardT = GS.time; }
}
function fireWeapon(a) {
  const w = curW(a), def = WD[w.id];
  if (w.mag <= 0) { if (a.isPlayer) SFX.dry(); startReload(a); a.nextFire = GS.time + 0.25; return; }
  w.mag--; a.shots++;
  a.nextFire = GS.time + 60 / def.rpm;
  const spread = computeSpread(a, def) * (a.brain ? D().spread : 1);
  const [rp, ry] = recoilAt(def, a.rc);
  const comp = a.brain ? D().comp : 0;
  const baseP = a.pitch + rp * DEG * (a.isPlayer ? 1 : 1 - comp), baseY = a.yaw + ry * DEG * (a.isPlayer ? 1 : 1 - comp);
  a.rc += 1; a.lastShot = GS.time;
  const o = eyePos(a);
  const n = def.pellets || 1;
  let anyHit = false, d0 = null;
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(Math.random()) * (def.pellets ? def.cone : spread) * DEG + (def.pellets ? Math.random() * spread * 0.3 * DEG : 0);
    const th = Math.random() * Math.PI * 2;
    const d = fwd(baseY + Math.cos(th) * r, baseP + Math.sin(th) * r);
    if (i === 0) d0 = d.clone();
    if (traceShot(a, o, d, def, w.id, i === 0)) anyHit = true;
  }
  if (MP.on && d0) { if (MP.role === 'host') MPH.shotFx(a, w.id, o, d0); else if (a.isPlayer) MPH.clientShot(a, w.id, o, d0); }
  if (anyHit) a.hits++;
  if (def.quiet) SFX.suppressed(a.pos, a.isPlayer); else SFX.shot(def.snd, a.pos, a.isPlayer);
  noiseEvent(a.pos, def.quiet ? 22 : 45, a);
  if (a.isPlayer) {
    VMS.kick = Math.min(1, VMS.kick + (def.scope ? 1 : def.pellets ? 0.9 : 0.45));
    if (vmCur) { vmCur.userData.fl.visible = true; vmCur.userData.fl.material.rotation = Math.random() * 6; VMS.flashT = 0.045; }
    muzzleLight.position.copy(o).addScaledVector(fwd(a.yaw, a.pitch), 1); muzzleLight.intensity = 6;
    if (def.scope && a.scoped) { a.rescope = a.scoped; a.scoped = 0; }
    GS.rangeShots++;
  } else if (a.mesh) { a.mesh.flash.visible = true; a.mesh.flashT = 0.05; a.mesh.flash.material.rotation = Math.random() * 6; }
  if (w.mag === 0 && w.res > 0) setTimeout(() => { if (a.alive && curW(a) === w && w.mag === 0) startReload(a); }, 250);
}
function traceShot(a, o, d, def, wid, showTracer) {
  const hw = rayWorld(o, d, 220), tW = hw ? hw.t : 220;
  let best = null;
  for (const e of GS.actors) {
    if (!e.alive || e === a || (e.side === a.side && GS.mode !== 'range')) continue;
    if (Math.abs(e.pos.x - o.x) > tW + 2 && Math.abs(e.pos.z - o.z) > tW + 2) continue;
    const h = rayActor(o, d, e, tW);
    if (h && (!best || h.t < best.t)) best = { ...h, e };
  }
  const end = _v1.copy(o).addScaledVector(d, best ? best.t : tW);
  if (showTracer) {
    const start = a.isPlayer ? _v2.copy(o).addScaledVector(fwd(a.yaw, a.pitch), 0.6).add(_v3.set(Math.cos(a.yaw) * 0.12, -0.12, -Math.sin(a.yaw) * 0.12)) : _v2.copy(o).addScaledVector(d, 0.8);
    if (!a.isPlayer || Math.random() < 0.5) tracer(start, end);
  }
  if (best) {
    const e = best.e, sc = SIDE[e.side];
    const mult = best.part === 'head' ? 4 : best.part === 'legs' ? 0.75 : 1;
    const dmg = best.part === 'head' ? Math.max(def.dmg * mult, 400) : def.dmg * Math.pow(def.range, best.t / 10) * mult;   // headshot = always a kill
    burst(end.x, end.y, end.z, best.part === 'head' ? 14 : 7, 4, ['#ffffff', '#' + sc.main.toString(16).padStart(6, '0'), '#ffe27a'], 0.06, 0.35, 10);
    damage(e, dmg, a, best.part, wid, d);
    return true;
  }
  if (hw) {
    const n = _v3.set(hw.nx, hw.ny, hw.nz);
    decal(end, n);
    burst(end.x + n.x * 0.05, end.y + n.y * 0.05, end.z + n.z * 0.05, 5, 3.5, ['#e8d2a8', '#c9a676', '#fff2c0'], 0.06, 0.4, 12);
  }
  return false;
}
function damage(v, amt, att, part, wid, dir) {
  if (MP.role === 'client') {   // clients only report what they hit; the host works out the damage
    if (att && att.isPlayer && v !== att && v.alive && att.side !== v.side) { showHit(part === 'head' ? 'hs' : '', false); if (part === 'head') SFX.head(); else SFX.hit(); MPH.claim(v, amt, att, part, wid); }
    return;
  }
  if (!v.alive || v.protT > 0) return;
  if (att && att !== v && att.side === v.side && GS.mode !== 'range') return;
  let dmg = amt;
  const armored = v.armor > 0 && part !== 'legs' && (part !== 'head' || v.helmet) && wid !== 'core';
  if (armored) { const pen = (WD[wid] && WD[wid].pen) || 0.5; const real = dmg * pen; v.armor = Math.max(0, v.armor - (dmg - real) * 0.5); dmg = real; }
  dmg = Math.min(dmg, v.hp);
  v.hp -= dmg; v.tagT = 0.35;
  if (att && att !== v) att.dmg += dmg;
  if (att && att.isPlayer && att !== v) {
    showHit(part === 'head' ? 'hs' : '', v.hp <= 0);
    if (part === 'head') SFX.head(); else SFX.hit();
    if (GS.mode === 'range') { GS.rangeHits++; if (part === 'head') GS.rangeHS++; }
  }
  if (v.isPlayer) {
    hurtFx(dmg, att, dir);
    if (part === 'head' && v.helmet) SFX.armorHit(); else SFX.hurt();
    v.pitch += 0.6 * DEG * Math.min(3, dmg / 20);
  } else if (v.remote && MPH) MPH.hurt(v, dmg, att, part === 'head');
  if (v.brain && att && att !== v) { v.brain.hurtT = GS.time; v.brain.hurtBy = att; v.brain.heardPos = att.pos.clone(); v.brain.heardT = GS.time; }
  if (v.hp <= 0.5) kill(v, att, wid, part === 'head');
}
// everything you see and hear when someone is eliminated (runs on every player's machine)
function killFx(v, k, wid, hs, quiet) {
  if (v.mesh) v.mesh.g.visible = false;
  const c = SIDE[v.side], hx = (n) => '#' + n.toString(16).padStart(6, '0');
  const p = v.pos;
  if (!quiet) {
    for (let i = 0; i < (LOW ? 22 : 46); i++) {
      const y = p.y + rand(0.1, 1.8);
      spawnP(p.x + rand(-0.3, 0.3), y, p.z + rand(-0.3, 0.3), rand(-4, 4), rand(2, 7), rand(-4, 4), rand(1.2, 2.4), rand(0.08, 0.2), pick([hx(c.main), hx(c.main), hx(c.vest), hx(c.pants), '#222226', hx(c.visor)]), 16);
    }
    burst(p.x, p.y + 1.1, p.z, 24, 7, ['#ffffff', '#ffe27a', '#9dffb0', '#ff9ad5', '#7ad7ff'], 0.06, 0.9, 6, 2);
    SFX.pop(p);
  }
  feed(k, v, wid, hs);
  if (v.isPlayer) { v.act = null; v.scoped = 0; GS.deathT = GS.time; GS.killer = k; vmRoot.visible = false; $('scope').classList.add('hidden'); }
  if (k && k.isPlayer && k !== v) {
    SFX.kill();
    const msg = $('killmsg'); const st = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL', 'ACE!'][Math.min(k.roundKills, 5)];
    const pts = GS.mode === 'comp' ? ((WD[wid] && WD[wid].reward) || 300) : 100;
    msg.innerHTML = `<div class="kbig">${hs ? 'HEADSHOT' : wid === 'knife' ? 'STABBED' : 'ELIMINATED'}</div><div class="kpts">+${pts}</div><div class="k">${v.name}</div>` + (st && GS.mode === 'comp' ? `<div class="streak">${st}</div>` : '');
    if (st && GS.mode === 'comp') SFX.streak();
    clearTimeout(msg._t); msg._t = setTimeout(() => (msg.innerHTML = ''), 1800);
  }
}
function kill(v, k, wid, hs) {
  v.alive = false; v.hp = 0; v.deaths++; v.act = null; v.scoped = 0;
  if (k && k !== v && k.side !== v.side) {
    k.kills++; if (hs) k.hs++; k.roundKills++;
    if (GS.mode === 'comp') addMoney(k, (WD[wid] && WD[wid].reward) || 300, 'elimination');
    if (GS.mode === 'dm') { GS.score[k.squad]++; if (GS.score[k.squad] >= GS.target) endMatch(); }
  }
  if (GS.mode === 'comp') {
    const drop = v.prim || (v.sec && v.sec.id !== 'p9' ? v.sec : null);
    if (drop && !MP.on) addDrop(drop, v.pos);
    if (GS.core.carrier === v) dropCore(v);
  }
  if (v.brain && k && k !== v && k.side !== v.side && GS.mode === 'comp' && GS.state === 'live') teamCall(v, k.pos, 32, 4, 0.9);
  killFx(v, k, wid, hs);
  if (MP.role === 'host') MPH.killEvent(v, k, wid, hs);
  if (GS.mode === 'range') { GS.score[0]++; setTimeout(() => { if (GS.mode === 'range' && GS.state === 'live') spawnDummy(v); }, 400); }
  if (GS.mode === 'dm') v.respawnT = (v.isPlayer || v.remote) ? 3 : rand(2, 3.5);
}
function moneyPop(amt, why) {
  const d = document.createElement('div'); d.textContent = `+$${amt} ${why}`; d.style.color = '#7dff9a';
  $('moneyPop').appendChild(d); setTimeout(() => d.remove(), 2600);
}
function addMoney(a, amt, why) {
  if (GS.mode !== 'comp') return;
  const before = a.money; a.money = clamp(a.money + amt, 0, 16000);
  if (a.money === before) return;
  if (a.isPlayer) moneyPop(a.money - before, why);
  else if (a.remote && MPH) MPH.money(a, a.money - before, why);
}
function startReload(a) {
  const w = curW(a); if (!w || !WD[w.id].mag || a.reloadT > 0 || w.res <= 0 || w.mag >= WD[w.id].mag) return;
  a.reloadT = WD[w.id].reload; a.scoped = 0; a.rescope = 0;
  if (a.isPlayer) { SFX.reload(0); setTimeout(() => a.reloadT > 0 && SFX.reload(1), WD[w.id].reload * 600); }
}
function finishReload(a) {
  const w = curW(a); const need = WD[w.id].mag - w.mag, take = Math.min(need, w.res);
  w.mag += take; w.res -= take;
}
function melee(a, heavy) {
  a.nextFire = GS.time + (heavy ? 1.0 : 0.45);
  if (a.isPlayer) { VMS.slash = 1; SFX.knife(a.pos, true); }
  const o = eyePos(a), d = fwd(a.yaw, a.pitch);
  let best = null;
  for (const e of GS.actors) {
    if (!e.alive || e === a || (e.side === a.side && GS.mode !== 'range')) continue;
    const h = rayActor(o, d, e, 2.1);
    if (h && (!best || h.t < best.t)) best = { ...h, e };
  }
  if (best) {
    const behind = Math.cos(angDiff(best.e.yaw, a.yaw)) > 0.5;
    damage(best.e, heavy ? (behind ? 180 : 65) : (behind ? 90 : 40), a, 'body', 'knife', d);
    burst(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t, 8, 3, ['#fff', '#ffe27a'], 0.06, 0.3);
  } else {
    const hw = rayWorld(o, d, 2.0);
    if (hw) { const p = _v1.copy(o).addScaledVector(d, hw.t); burst(p.x, p.y, p.z, 5, 3, ['#e8d2a8', '#fff'], 0.05, 0.3); SFX.tick(p); }
  }
}

// grenades
const nadeMeshes = {};
function spawnNade(a, type, p, v, id, fake) {
  const m = new THREE.Mesh(geoBox, new THREE.MeshLambertMaterial({ color: WD[type].col })); m.scale.set(0.12, 0.15, 0.12); m.castShadow = true; scene.add(m);
  const n = { type, x: p[0], y: p[1], z: p[2], vx: v[0], vy: v[1], vz: v[2], t: 0, owner: a, m, still: 0, id, fake: !!fake };
  GS.nades.push(n); return n;
}
function throwNade(a, type, dir, speed) {
  if (!a.nades[type]) return;
  a.nades[type]--;
  const o = eyePos(a).addScaledVector(dir, 0.4);
  const tv = [dir.x * speed + a.vel.x * 0.6, dir.y * speed + 1.5, dir.z * speed + a.vel.z * 0.6];
  if (MP.role === 'client') { const id = MPH.clientNade(a, type, o.x, o.y, o.z, tv[0], tv[1], tv[2]); spawnNade(a, type, [o.x, o.y, o.z], tv, id, true); }
  else { const n = spawnNade(a, type, [o.x, o.y, o.z], tv, ++MP.nid, false); if (MP.role === 'host') MPH.nadeEvent(n); }
  a.nextFire = GS.time + 0.8;
  if (a.isPlayer) { SFX.pin(); VMS.slash = 0.7; }
  if (!hasNade(a)) { if (a.slot === 'nade') { a.slot = a.lastSlot !== 'nade' && slotOK(a, a.lastSlot) ? a.lastSlot : bestSlot(a); a.switchT = 0.4; if (a.isPlayer) vmSet(); } }
  else if (!a.nades[a.nadeSel]) cycleNade(a);
}
function updateNades(dt) {
  for (let i = GS.nades.length - 1; i >= 0; i--) {
    const n = GS.nades[i]; n.t += dt;
    const sub = 4, h = dt / sub;
    for (let s = 0; s < sub; s++) {
      n.vy -= 15 * h;
      let nx = n.x + n.vx * h, nz = n.z + n.vz * h;
      if (hPos(nx, n.z) > n.y) { n.vx = -n.vx * 0.45; nx = n.x; if (Math.abs(n.vx) > 1) SFX.bounce(n); }
      if (hPos(n.x, nz) > n.y) { n.vz = -n.vz * 0.45; nz = n.z; if (Math.abs(n.vz) > 1) SFX.bounce(n); }
      if (hPos(nx, nz) > n.y) { nx = n.x; nz = n.z; n.vx *= -0.4; n.vz *= -0.4; }
      n.x = nx; n.z = nz; n.y += n.vy * h;
      const g = hPos(n.x, n.z);
      if (n.y < g + 0.07) { if (n.type === 'molly' && n.vy < -1.5) n.landed = true; n.y = g + 0.07; if (n.vy < -2) SFX.bounce(n); n.vy = -n.vy * 0.35; n.vx *= 0.7; n.vz *= 0.7; if (Math.abs(n.vy) < 1) n.vy = 0; }
    }
    n.m.position.set(n.x, n.y, n.z); n.m.rotation.x += dt * 8; n.m.rotation.z += dt * 5;
    const spd = Math.hypot(n.vx, n.vy, n.vz);
    if (spd < 0.3) n.still += dt;
    const go = n.fake ? n.t > 7 : n.type === 'smoke' ? (n.still > 0.4 && n.t > 1) || n.t > 3.5 : n.type === 'molly' ? (n.landed && n.t > 0.3) || n.t > 2.8 : n.t > 1.6;
    if (go) { if (!n.fake) { detonate(n); if (MP.role === 'host') MPH.detEvent(n); } scene.remove(n.m); n.m.material.dispose(); GS.nades.splice(i, 1); }
  }
}
function detonate(n, fxOnly) {
  const p = V().set(n.x, n.y + 0.2, n.z);
  if (n.type === 'he') {
    explosionFx(p, false); SFX.boom(p, false); GS.shake = Math.max(GS.shake, 0.4 / (1 + GS.player.pos.distanceTo(p) / 6));
    for (const e of GS.actors) {
      if (!e.alive || fxOnly) continue;
      const c = chestPos(e), d = c.distanceTo(p);
      if (d > 7.8 || !losClear(p, c, false)) continue;
      if (e !== n.owner && e.side === n.owner.side && GS.mode !== 'range') continue;
      const lethal = 4.4, hit = d <= lethal ? 500 : 100 * Math.pow(1 - (d - lethal) / 3.4, 1.2);   // inside 4.4 m = one shot
      damage(e, hit * (e === n.owner ? 0.5 : 1), n.owner, 'body', 'he', c.clone().sub(p).normalize());
    }
    if (!fxOnly) noiseEvent(p, 50, n.owner);
  } else if (n.type === 'flash') {
    SFX.flashbang(p);
    burst(p.x, p.y, p.z, 30, 10, ['#ffffff', '#e8f4ff'], 0.05, 0.5, 4);
    explosionFx(p, false, 0xffffff);
    for (const e of GS.actors) {
      if (!e.alive || (fxOnly && !e.isPlayer)) continue;
      const ep = eyePos(e), d = ep.distanceTo(p);
      if (d > 32 || !losClear(p, ep)) continue;
      const to = _v1.subVectors(p, ep).normalize(), dot = to.dot(fwd(e.yaw, e.pitch));
      let t = (dot > 0.35 ? 3.4 : dot > -0.2 ? 1.4 : 0.45) * (1 - d / 40);
      if (e.side === n.owner.side && e !== n.owner && e.brain) t *= 0.5;
      if (t > e.blindT) e.blindT = t;
      if (e.isPlayer && t > 0.8) SFX.ring(Math.min(t, 2.5));
    }
    if (!fxOnly && n.owner.brain && GS.mode === 'comp') teamCall(n.owner, p, 32, 2.6, 0.8);
  } else if (n.type === 'molly') {
    SFX.boom(p, false); explosionFx(p, false, 0xff7a1a); if (!fxOnly) noiseEvent(p, 30, n.owner);
    const f = { x: n.x, y: hPos(n.x, n.z), z: n.z, r: 2.7, t: 7, tick: 0.1, owner: n.owner, disc: null };
    f.disc = new THREE.Mesh(new THREE.CircleGeometry(f.r, 24), new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.disc.rotation.x = -Math.PI / 2; f.disc.position.set(f.x, f.y + 0.05, f.z); scene.add(f.disc); GS.fires.push(f);
  } else {
    SFX.smoke(p);
    const s = { x: n.x, y: n.y + 1.2, z: n.z, r: 0, t: 18, sprites: [] };
    const k = LOW ? 16 : 30;
    for (let i = 0; i < k; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xcfd3d9, transparent: true, opacity: 0, depthWrite: false }));
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 2.6;
      sp.userData = { ox: Math.cos(a) * r, oy: rand(-0.9, 1.4), oz: Math.sin(a) * r, sz: rand(2.6, 3.8) };
      scene.add(sp); s.sprites.push(sp);
    }
    GS.smokes.push(s);
  }
}
function updateFires(dt) {
  for (let i = GS.fires.length - 1; i >= 0; i--) {
    const f = GS.fires[i]; f.t -= dt; f.tick -= dt;
    if (Math.random() < dt * 45) spawnP(f.x + rand(-f.r, f.r) * 0.8, f.y + 0.1, f.z + rand(-f.r, f.r) * 0.8, rand(-0.3, 0.3), rand(1.6, 3.4), rand(-0.3, 0.3), rand(0.3, 0.7), rand(0.1, 0.24), pick(['#ffcf4a', '#ff8a2a', '#ff5a1a']), -2);
    f.disc.material.opacity = (0.32 + 0.16 * Math.sin(GS.time * 13 + i)) * Math.min(1, f.t / 1.2);
    if (f.tick <= 0 && MP.role !== 'client') {
      f.tick = 0.4;
      for (const e of GS.actors) {
        if (!e.alive || Math.hypot(e.pos.x - f.x, e.pos.z - f.z) > f.r || e.pos.y > f.y + 0.9) continue;
        if (e !== f.owner && e.side === f.owner.side && GS.mode !== 'range') continue;
        damage(e, 9, f.owner, 'legs', 'molly', null);
      }
    }
    if (f.t <= 0) { scene.remove(f.disc); f.disc.geometry.dispose(); f.disc.material.dispose(); GS.fires.splice(i, 1); }
  }
}
function updateSmokes(dt) {
  for (let i = GS.smokes.length - 1; i >= 0; i--) {
    const s = GS.smokes[i]; s.t -= dt;
    s.r = Math.min(3.6, s.r + dt * 3.5);
    const k = s.r / 3.6, fade = clamp(s.t / 2, 0, 1);
    for (const sp of s.sprites) {
      const u = sp.userData;
      sp.position.set(s.x + u.ox * k, s.y + u.oy * k, s.z + u.oz * k);
      sp.scale.setScalar(u.sz * (0.4 + 0.6 * k));
      sp.material.opacity = 0.92 * fade;
    }
    if (s.t <= 0) { for (const sp of s.sprites) { scene.remove(sp); sp.material.dispose(); } GS.smokes.splice(i, 1); }
  }
}

// dropped weapons
function addDrop(w, p) {
  const id = w.id, def = WD[id];
  const g = new THREE.Group();
  mbox(g, 0.1, 0.12, def.slot === 'prim' ? 0.8 : 0.35, vmMat('body'), 0, 0, 0);
  mbox(g, 0.11, 0.04, def.slot === 'prim' ? 0.5 : 0.25, vmMat('acc', new THREE.Color(def.acc).getHex()), 0, 0.07, 0);
  g.position.set(p.x + rand(-0.4, 0.4), hPos(p.x, p.z) + 0.1, p.z + rand(-0.4, 0.4)); g.rotation.y = Math.random() * 6;
  scene.add(g);
  GS.drops.push({ w: { id, mag: w.mag, res: w.res }, g, t: 0 });
}
function clearDrops() { for (const d of GS.drops) scene.remove(d.g); GS.drops = []; }
function takeDrop(a, d) {
  const def = WD[d.w.id], slot = def.slot;
  if (a[slot]) addDrop(a[slot], a.pos);
  a[slot] = d.w; scene.remove(d.g); GS.drops.splice(GS.drops.indexOf(d), 1);
  if (a.isPlayer) { SFX.swap(); equip(a, slot); vmSet(); }
  else a.slot = slot;
}
function dropCurrent(a) {
  const s = a.slot; if (s !== 'prim' && s !== 'sec') return;
  addDrop(a[s], _v1.copy(a.pos).addScaledVector(fwd(a.yaw, 0), 1.2));
  a[s] = null; a.slot = bestSlot(a); a.switchT = 0.3; if (a.isPlayer) vmSet();
}
function dropCore(a) {
  const c = GS.core; c.state = 'dropped'; c.carrier = null; c.pos.set(a.pos.x, hPos(a.pos.x, a.pos.z), a.pos.z);
  if (a.isPlayer && a.alive) { c.pos.addScaledVector(fwd(a.yaw, 0), 1.5); c.pos.y = hPos(c.pos.x, c.pos.z); if (c.pos.y > 2.5) c.pos.set(a.pos.x, a.pos.y, a.pos.z); }
  const bots = alive(0).filter((b) => b.brain);
  GS.fetcher = bots.sort((x, y) => x.pos.distanceTo(c.pos) - y.pos.distanceTo(c.pos))[0] || null;
}

// ---------------- match / round flow ----------------
function clearWorld() {
  for (const n of GS.nades) scene.remove(n.m);
  for (const s of GS.smokes) for (const sp of s.sprites) scene.remove(sp);
  for (const f of GS.fires) scene.remove(f.disc); GS.nades = []; GS.smokes = []; GS.fires = []; clearDrops(); parts.length = 0;
  decals.count = 0; dI = 0;
}
function startMatch() {
  setMap(S.map);
  for (const a of GS.actors) if (a.mesh) scene.remove(a.mesh.g);
  GS.actors = []; clearWorld();
  GS.mode = S.mode; GS.score = [0, 0]; GS.loss = [0, 0]; GS.round = 0;
  GS.target = GS.mode === 'dm' ? (S.length === 'short' ? 40 : 75) : S.length === 'short' ? 5 : 9;
  GS.halfAt = GS.target - 1; GS.maxRounds = 2 * (GS.target - 1);
  const pSide = S.side === 'atk' ? 0 : S.side === 'def' ? 1 : (Math.random() < 0.5 ? 0 : 1);
  const names = shuffle(NAMES.slice());
  const P = new Actor('You', 0, true); P.side = pSide; GS.player = P; GS.actors.push(P);
  if (GS.mode !== 'range') {
    for (let i = 0; i < 4; i++) { const a = new Actor(names.pop(), 0, false); a.side = pSide; a.brain = newBrain(a, i); GS.actors.push(a); }
    for (let i = 0; i < 5; i++) { const a = new Actor(names.pop(), 1, false); a.side = 1 - pSide; a.brain = newBrain(a, i); GS.actors.push(a); }
  }
  for (const a of GS.actors) { makeSoldier(a); a.money = 800; }
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing');
  GS.paused = false; resetCore(null);
  if (GS.mode === 'comp') startRound();
  else if (GS.mode === 'dm') { GS.state = 'live'; GS.roundT = S.length === 'short' ? 300 : 480; for (const a of GS.actors) dmSpawn(a); banner('DEATHMATCH', `First squad to ${GS.target} eliminations · B = free guns for 10 s after spawn`); }
  else startRange();
  lock();
}
function spawnAt(a, cells, used) {
  let c = null;
  for (let k = 0; k < 40; k++) {
    const t = pick(cells), x = cellX(t) + rand(-0.4, 0.4), z = cellZ(t) + rand(-0.4, 0.4);
    if (used.every((u) => Math.hypot(u[0] - x, u[1] - z) > 2.4)) { c = [x, z]; break; }
  }
  if (!c) { const t = pick(cells); c = [cellX(t), cellZ(t)]; }
  used.push(c);
  a.pos.set(c[0], 0, c[1]); a.vel.set(0, 0, 0);
  a.yaw = Math.atan2(-(W - a.pos.x), -(H - a.pos.z)); a.pitch = 0;
}
function resetActorForRound(a) {
  if (a.fullReset || !a.alive) {
    a.prim = null; a.sec = newGun('p9'); a.nades = { he: 0, flash: 0, smoke: 0, molly: 0 }; a.armor = 0; a.helmet = false; a.kit = false;
  } else if (a.prim) { /* survivors keep gear */ }
  a.fullReset = false;
  a.hp = 100; a.alive = true; a.act = null; a.blindT = 0; a.reloadT = 0; a.switchT = 0; a.rc = 0; a.scoped = 0; a.rescope = 0; a.roundKills = 0; a.crouch = false; a.crouchAmt = 0; a.tagT = 0;
  a.slot = bestSlot(a); a.onGround = true;
  if (a.mesh) a.mesh.g.visible = !a.isPlayer;
}
function startRound() {
  const half = GS.round === GS.halfAt;
  if (half) {
    for (const a of GS.actors) { a.side = 1 - a.side; a.fullReset = true; a.money = 800; makeSoldier(a); }
    GS.loss = [0, 0];
  }
  GS.round++;
  GS.rushAt = Math.random() < 0.15 ? rand(14, 28) : 999;
  clearWorld();
  GS.state = 'freeze';
  GS.phaseT = GS.round === 1 || half ? 12 : 8;
  GS.roundT = 105; GS.buyLeft = 20; GS.execute = false; GS.execT = 0; GS.fetcher = null; GS.roundStart = GS.time; GS.deathT = 0;
  const used = [[], []];
  for (const a of GS.actors) { resetActorForRound(a); spawnAt(a, a.side === 0 ? SPAWN.T : SPAWN.D, used[a.side]); a.mesh.g.visible = !a.isPlayer; }
  { let pl = Math.random() < 0.5 ? 'a' : 'b'; if (pl === GS.lastPlan && Math.random() < 0.6) pl = pl === 'a' ? 'b' : 'a'; GS.plan = GS.lastPlan = pl; }
  const atk = alive(0);
  resetCore(pick(atk));
  setupBrains();
  GS.buyMode = [teamBuyMode(0), teamBuyMode(1)];
  for (const a of GS.actors) if (a.brain) botBuy(a);
  assignRoles();
  vmRoot.visible = true; vmId = ''; vmSet();
  const P = GS.player;
  sleeveMat.color.setHex(SIDE_SLEEVE[P.side]);
  const lastRound = GS.round === GS.maxRounds, match = GS.score[0] === GS.target - 1 || GS.score[1] === GS.target - 1;
  roundBannerLocal(half, lastRound, match);
  if (GS.core.carrier === P) setTimeout(() => toast('You carry the CORE — hold E on a site to plant'), 2500);
  if (MP.role === 'host') MPH.roundStart(half);
}
function roundBannerLocal(half, lastRound, match) {
  const P = GS.player; sleeveMat.color.setHex(SIDE_SLEEVE[P.side]);
  banner(half ? 'SWITCHING SIDES' : `ROUND ${GS.round}`, `You are ${SIDE[P.side].name} — ${P.side === 0 ? 'plant the core at A or B' : 'stop the core from being planted'}${match ? ' · MATCH POINT' : lastRound ? ' · LAST ROUND' : ''}`, '#fff', 3000, true);
}
function roundEndFx(winSide, reason) {
  const why = { elim: `${SIDE[1 - winSide].name} eliminated`, time: 'Time ran out', boom: 'The core detonated!', defuse: 'The core was defused!' }[reason] || '';
  const w = GS.actors.find((a) => a.side === winSide);
  banner(`${SIDE[winSide].name} WIN`, why, SIDE[winSide].css, 3000, true);
  SFX.fanfare(!!w && w.squad === mySq());
}
function endRound(winSide, reason) {
  if (GS.state !== 'live') return;
  GS.state = 'end'; GS.phaseT = 5.5;
  const sq = GS.actors.find((a) => a.side === winSide).squad, lq = 1 - sq;
  GS.score[sq]++; GS.loss[sq] = 0; GS.loss[lq] = Math.min(GS.loss[lq] + 1, 5);
  const winAmt = reason === 'boom' || reason === 'defuse' ? 3500 : 3250;
  const lossAmt = Math.min(3400, 1400 + 500 * (GS.loss[lq] - 1));
  for (const a of GS.actors) {
    if (a.squad === sq) addMoney(a, winAmt, 'round win');
    else addMoney(a, lossAmt + (a.side === 0 && GS.core.state === 'planted' ? 800 : 0), 'round loss');
  }
  roundEndFx(winSide, reason);
  if (MP.role === 'host') MPH.roundEnd(winSide, reason);
}
function updateRound(dt) {
  if (GS.mode === 'dm') {
    GS.roundT -= dt;
    if (GS.roundT <= 0 && GS.state === 'live') endMatch();
    for (const a of GS.actors) if (!a.alive) { a.respawnT -= dt; if (a.respawnT <= 0) dmSpawn(a); }
    return;
  }
  if (GS.mode === 'range') {
    GS.roundT -= dt;
    if (GS.roundT <= 0 && GS.state === 'live') endMatch();
    return;
  }
  const c = GS.core;
  if (GS.state === 'freeze') {
    const before = Math.ceil(GS.phaseT);
    GS.phaseT -= dt;
    if (Math.ceil(GS.phaseT) !== before && before <= 3 && before > 0) SFX.countdown(false);
    if (GS.phaseT <= 0) { GS.state = 'live'; SFX.countdown(true); banner('GO!', '', '#ffd04a', 900); if (MP.role === 'host') MPH.event('go'); }
  } else if (GS.state === 'live') {
    GS.buyLeft -= dt;
    if (c.state !== 'planted') GS.roundT -= dt;
    const A = alive(0).length, Dd = alive(1).length;
    if (Dd === 0) endRound(0, 'elim');
    else if (c.state !== 'planted' && A === 0) endRound(1, 'elim');
    else if (c.state !== 'planted' && GS.roundT <= 0) endRound(1, 'time');
  } else if (GS.state === 'end') {
    GS.phaseT -= dt;
    if (GS.phaseT <= 0) {
      if (GS.score[0] >= GS.target || GS.score[1] >= GS.target || GS.round >= GS.maxRounds) endMatch();
      else startRound();
    }
  }
  if (c.state === 'planted' && (GS.state === 'live' || GS.state === 'end')) {
    c.timer -= dt; coreBeep(c, dt);
    if (c.timer <= 0) {
      c.state = 'boom';
      const p = c.pos.clone().setY(c.pos.y + 0.5);
      explosionFx(p, true); SFX.boom(p, true); GS.shake = 1.2;
      coreMesh.visible = false;
      if (MP.role === 'host') MPH.event('boom');
      for (const e of GS.actors) if (e.alive) { const d = e.pos.distanceTo(c.pos); const dmg = 500 * Math.exp(-(d * d) / (2 * 7 * 7)); if (dmg > 1) damage(e, dmg, null, 'body', 'core', null); }
      if (GS.state === 'live') endRound(0, 'boom');
    }
  }
}
function endMatch() {
  if (GS.state === 'over' && !$('end').classList.contains('hidden')) return;
  GS.state = 'over'; document.exitPointerLock && document.exitPointerLock();
  if (MP.role === 'host') MPH.matchEnd();
  const P = GS.player, hsP = P.kills ? Math.round(P.hs / P.kills * 100) : 0;
  let title, sc;
  if (GS.mode === 'range') {
    const acc = GS.rangeShots ? Math.round(GS.rangeHits / GS.rangeShots * 100) : 0;
    const pts = GS.score[0] * 100 + GS.rangeHS * 25;
    const best = pts > STATS.range; if (best) { STATS.range = pts; saveStats(); }
    title = best ? 'NEW BEST!' : 'TIME!'; sc = `${pts} points`;
    $('endStats').innerHTML = stat(GS.score[0], 'POPPED') + stat(acc + '%', 'ACCURACY') + stat(GS.rangeHS, 'HEADSHOTS') + stat(STATS.range, 'BEST');
    $('endMvp').textContent = '';
  } else {
    const ms = mySq(), win = GS.score[ms] > GS.score[1 - ms], draw = GS.score[0] === GS.score[1];
    title = draw ? 'DRAW' : win ? 'VICTORY' : 'DEFEAT';
    if (!draw) { win ? STATS.wins++ : STATS.losses++; saveStats(); }
    sc = `${GS.score[mySq()]} — ${GS.score[1 - mySq()]}`;
    $('endStats').innerHTML = stat(P.kills, 'ELIMS') + stat(P.deaths, 'DEATHS') + stat(hsP + '%', 'HEADSHOT %') + stat(Math.round(P.dmg), 'DAMAGE');
    const mvp = GS.actors.slice().sort((a, b) => b.kills * 100 + b.dmg / 10 - (a.kills * 100 + a.dmg / 10))[0];
    $('endMvp').textContent = `MVP: ${mvp.name} (${mvp.kills} elims)`;
    SFX.fanfare(win);
  }
  $('endTitle').textContent = title; $('endTitle').style.color = title === 'DEFEAT' ? '#ff6a5a' : title === 'DRAW' ? '#ddd' : '#ffd04a';
  $('endScore').textContent = sc;
  $('end').classList.remove('hidden');
}
const stat = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;

// deathmatch
function dmSpawn(a) {
  let bestC = null, bestS = -1;
  for (let k = 0; k < 30; k++) {
    const c = pick(WALKABLE); const p = _v1.set(cellX(c), 1.6, cellZ(c));
    let s = 999;
    for (const e of GS.actors) if (e.alive && e.side !== a.side) { let d = e.pos.distanceTo(p); if (losClear(eyePos(e), p, false)) d *= 0.3; s = Math.min(s, d); }
    if (s > bestS) { bestS = s; bestC = c; }
  }
  a.pos.set(cellX(bestC), 0, cellZ(bestC)); a.vel.set(0, 0, 0); a.yaw = Math.random() * 6.28; a.pitch = 0;
  a.hp = 100; a.armor = 100; a.helmet = true; a.alive = true; a.protT = 1.5; a.spawnT = GS.time; a.act = null; a.blindT = 0; a.reloadT = 0; a.rc = 0; a.scoped = 0;
  a.sec = newGun('p9');
  a.prim = newGun((a.isPlayer || a.remote) ? (a.dmPick || 'raptor') : pick(['raptor', 'raptor', 'sentinel', 'sentinel', 'carbine', 'buzz', 'chopper', 'thumper', 'scatter', 'lmg', 'dmr', 'ranger', 'longbow']));
  a.nades = { he: 1, flash: 1, smoke: 0, molly: 0 };
  a.slot = 'prim';
  if (a.brain) { a.brain.path = []; a.brain.goal = -1; a.brain.target = null; a.brain.roam = -1; }
  if (a.mesh) a.mesh.g.visible = !a.isPlayer;
  if (a.isPlayer) { vmRoot.visible = true; vmId = ''; vmSet(); sleeveMat.color.setHex(SIDE_SLEEVE[a.side]); }
  if (a.remote && MPH) MPH.spawn(a);
}
// aim range
function startRange() {
  const P = GS.player; P.side = 0; GS.state = 'live'; GS.roundT = 60; GS.rangeHits = 0; GS.rangeShots = 0; GS.rangeHS = 0;
  resetActorForRound(P); P.prim = newGun('raptor'); P.slot = 'prim'; P.prim.res = 999; P.armor = 100;
  P.pos.set(MAP.rangeStart[0], 0, MAP.rangeStart[1]); P.yaw = MAP.rangeStart[2]; P.pitch = 0;
  vmRoot.visible = true; vmId = ''; vmSet(); sleeveMat.color.setHex(SIDE_SLEEVE[0]);
  for (let i = 0; i < 3; i++) { const d = new Actor('Target', 1, false); d.side = 1; d.dummy = true; d.sec = newGun('p9'); makeSoldier(d); GS.actors.push(d); spawnDummy(d); }
  banner('AIM RANGE', '60 seconds · pop as many as you can · B = pick any gun');
}
function spawnDummy(d) {
  const P = GS.player, eye = eyePos(P), fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let ok = false;
  for (let k = 0; k < 160 && !ok; k++) {
    const c = pick(WALKABLE), x = cellX(c), z = cellZ(c), dist = Math.hypot(x - P.pos.x, z - P.pos.z), ahead = (x - P.pos.x) * fx + (z - P.pos.z) * fz;
    const near = k < 100 ? 8 : 5, far = k < 100 ? 45 : 70;
    if (dist < near || dist > far || ahead < (k < 100 ? 4 : -999)) continue;
    if (!losClear(eye, _v2.set(x, 1.4, z), false)) continue;
    d.pos.set(x, 0, z); ok = true;
  }
  if (!ok) d.pos.set(P.pos.x + fx * 6, 0, P.pos.z + fz * 6);
  d.hp = 100; d.armor = 0; d.alive = true; d.mesh.g.visible = true; d.strafe = Math.random() < 0.5 ? 1 : -1; d.strafeT = rand(0.4, 1.2);
  d.yaw = Math.atan2(-(P.pos.x - d.pos.x), -(P.pos.z - d.pos.z));
}

// ---------------- buying ----------------
function inBuyZone(a) {
  if (GS.mode !== 'comp') return GS.mode === 'range' || GS.time - a.spawnT < 10;
  return (GS.state === 'freeze' || (GS.state === 'live' && GS.buyLeft > 0)) && zoneAt(a.pos.x, a.pos.z) === (a.side === 0 ? 'T' : 'D');
}
function priceOf(a, id) {
  if (GS.mode !== 'comp') return 0;
  if (id === 'helm') return a.armor >= 100 && !a.helmet ? 350 : 1000;
  return (WD[id] || GEAR[id]).price;
}
function canBuy(a, id) {
  if (!a.alive) return false;
  const p = priceOf(a, id); if (a.money < p) return false;
  if (WD[id] && WD[id].nade) { const tot = a.nades.he + a.nades.flash + a.nades.smoke + a.nades.molly; return a.nades[id] < WD[id].max && tot < 4; }
  if (id === 'kevlar') return a.armor < 100;
  if (id === 'helm') return !(a.armor >= 100 && a.helmet);
  if (id === 'kit') return a.side === 1 && !a.kit && GS.mode === 'comp';
  const def = WD[id]; const cur = a[def.slot];
  return !(cur && cur.id === id && cur.mag === def.mag && cur.res === def.res);
}
function buy(a, id) {
  if (!canBuy(a, id)) return false;
  a.money -= priceOf(a, id);
  if (WD[id] && WD[id].nade) a.nades[id]++;
  else if (id === 'kevlar') a.armor = 100;
  else if (id === 'helm') { a.armor = 100; a.helmet = true; }
  else if (id === 'kit') a.kit = true;
  else {
    const def = WD[id];
    if (a[def.slot] && a[def.slot].id !== id && GS.mode === 'comp') addDrop(a[def.slot], a.pos);
    a[def.slot] = newGun(id);
    if (GS.mode === 'range') a[def.slot].res = 999;
    if ((a.isPlayer || a.remote) && def.slot === 'prim') a.dmPick = id;
    a.slot = def.slot; a.switchT = 0.4;
  }
  if (a.isPlayer) { vmSet(); }
  return true;
}
function teamBuyMode(side) {
  const t = GS.actors.filter((x) => x.side === side && x.brain);
  if (!t.length) return 'full';
  const avg = t.reduce((s, x) => s + x.money + (x.prim ? 2000 : 0), 0) / t.length, streak = GS.loss[t[0].squad] || 0;
  if (avg >= 3600) return 'full';
  if (avg >= 2300) return 'half';
  if (streak >= 2 && avg >= 1500) return 'force';
  return avg >= 1500 ? 'half' : 'eco';
}
function botBuy(a) {
  const m = () => a.money, mode = (GS.buyMode && GS.buyMode[a.side]) || 'full';
  const pistolRound = GS.round === 1 || GS.round === GS.halfAt + 1;
  if (pistolRound) {
    const r = Math.random();
    if (r < 0.3) buy(a, 'kevlar'); else if (r < 0.55) buy(a, pick(['viper', 'revolver', 'tec'])); else { buy(a, 'flash'); buy(a, pick(['smoke', 'molly'])); }
    return;
  }
  const teamHas = (id) => GS.actors.some((t) => t.side === a.side && t !== a && t.prim && t.prim.id === id);
  if (!a.prim && mode !== 'eco') {
    const reserve = mode === 'full' ? 700 : 350;
    let list;
    if (mode === 'full') {
      list = a.side === 0 ? ['raptor', 'raptor', 'raptor', 'sentinel', 'carbine'] : ['sentinel', 'sentinel', 'sentinel', 'raptor', 'carbine'];
      if (m() >= 5400 && !teamHas('lmg') && Math.random() < 0.18) list = ['lmg'];
      else if (m() >= 5000 && !teamHas('longbow') && Math.random() < 0.3) list = ['longbow'];
      else if (m() >= 3900 && !teamHas('dmr') && Math.random() < 0.2) list = ['dmr'];
    } else if (mode === 'half') list = ['chopper', 'buzz', 'carbine', 'scatter', 'thumper', 'ranger', 'chopper', 'buzz'];
    else list = ['buzz', 'chopper', 'thumper', 'scatter', 'ranger', 'buzz', 'chopper'];
    const ok = list.filter((id) => WD[id].price + reserve <= m());
    const pickId = ok.length ? pick(ok) : list.filter((id) => WD[id].price <= m()).sort((p, q) => WD[q].price - WD[p].price)[0];
    if (pickId) buy(a, pickId);
    else if (m() >= 650 && a.sec.id === 'p9') buy(a, pick(['revolver', 'viper', 'tec']));
  } else if (!a.prim && mode === 'eco' && a.sec.id === 'p9' && m() >= 900 && Math.random() < 0.35) buy(a, pick(['tec', 'revolver']));
  if (mode === 'full') { if (m() >= 1000 && !a.helmet) buy(a, 'helm'); else if (m() >= 650 && a.armor < 60) buy(a, 'kevlar'); }
  else if (mode === 'half' || mode === 'force') { if (m() >= 650 && a.armor < 60 && Math.random() < 0.8) buy(a, 'kevlar'); }
  if (a.prim && mode !== 'eco') {
    if (mode === 'full') {
      if (m() >= 300 && Math.random() < 0.8) buy(a, 'smoke');
      if (m() >= 200) buy(a, 'flash');
      if (m() >= 400 && Math.random() < 0.55) buy(a, 'molly');
      if (m() >= 300 && Math.random() < 0.55) buy(a, 'he');
      if (m() >= 200 && Math.random() < 0.4) buy(a, 'flash');
      if (a.side === 1 && m() >= 400 && Math.random() < 0.7) buy(a, 'kit');
    } else if (mode === 'half') {
      if (m() >= 200 && Math.random() < 0.6) buy(a, 'flash');
      if (m() >= 300 && Math.random() < 0.4) buy(a, 'smoke');
    }
  }
  a.slot = bestSlot(a);
}

// ---------------- bots ----------------
function holdLook(cell, enemySide) {
  const key = cell * 2 + enemySide;
  if (holdLookCache.has(key)) return holdLookCache.get(key);
  const target = (enemySide === 0 ? SPAWN.T : SPAWN.D)[0];
  const path = astar(cell, target);
  const eye = V().set(cellX(cell), 1.6, cellZ(cell));
  let look = path[Math.min(4, path.length - 1)];
  for (let i = 0; i < Math.min(18, path.length); i++) if (losClear(eye, _v2.set(cellX(path[i]), 1.6, cellZ(path[i])), false)) look = path[i];
  const r = V().set(cellX(look), 1.4, cellZ(look));
  holdLookCache.set(key, r); return r;
}
// every bot gets its own spot near a shared goal (nobody stacks on one cell)
function spreadCell(a, b, base) {
  if (b.claimBase === base && b.claimCell >= 0) return b.claimCell;
  const taken = [];
  for (const o of GS.actors) if (o !== a && o.alive && o.brain && o.side === a.side && o.brain.claimCell >= 0) taken.push(o.brain.claimCell);
  const bx = base % W, bz = (base / W) | 0, cand = [];
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const x = bx + dx, z = bz + dz; if (x < 0 || z < 0 || x >= W || z >= H) continue;
    const c = z * W + x; if (!walk(c) || taken.includes(c)) continue;
    const touching = taken.some((t) => Math.abs((t % W) - x) <= 1 && Math.abs(((t / W) | 0) - z) <= 1);
    cand.push([Math.hypot(dx, dz) + Math.random() * 1.2 + (touching ? 3 : 0), c]);
  }
  cand.sort((p, q) => p[0] - q[0]);
  b.claimBase = base; b.claimCell = cand.length ? cand[0][1] : base;
  return b.claimCell;
}
// team communication: tell nearby teammates where an enemy is / where a teammate died
function teamCall(src, pos, radius, dur, strength) {
  const st = (GS.stat ||= {}); st.calls = (st.calls || 0) + 1;
  for (const o of GS.actors) {
    if (o === src || !o.alive || !o.brain || o.side !== src.side || o.dummy) continue;
    const b = o.brain, d = o.pos.distanceTo(pos);
    if (d > radius) continue;
    b.heardPos = pos.clone(); b.heardT = GS.time;
    if (!b.vis && !o.act && GS.time > b.invCool - 6 && Math.random() < strength * D().team) { b.invCell = cellOf(pos.x, pos.z); b.invT = GS.time + dur; b.invCool = GS.time + dur + 4; st.responses = (st.responses || 0) + 1; }
  }
}
// roles that depend on the gun a bot bought: snipers hold long angles, shotguns stay close
function assignRoles() {
  for (const a of GS.actors) {
    const b = a.brain; if (!b || !a.prim) continue;
    const d = WD[a.prim.id];
    if (d.scope) {
      if (a.side === 1) { b.home = pick(MID_HOLDS); b.homeSite = null; }
      else if (!b.lurk && Math.random() < 0.6) { b.lurk = true; b.lurkSpot = pick([LURK, ...MID_HOLDS]); }
    } else if (d.pellets && a.side === 1) { b.home = pick([...SITES.a.holdsDef, ...SITES.b.holdsDef]); b.homeSite = SITES.a.holdsDef.includes(b.home) ? 'a' : 'b'; }
  }
}
function jitterCell(c, r) {
  const x = clamp((c % W) + ((Math.random() * (2 * r + 1)) | 0) - r, 1, W - 2), z = clamp(((c / W) | 0) + ((Math.random() * (2 * r + 1)) | 0) - r, 1, H - 2);
  return nearestWalk(z * W + x);
}
function setupBrains() {
  const atk = GS.actors.filter((a) => a.brain && a.side === 0), def = GS.actors.filter((a) => a.brain && a.side === 1);
  const plan = GS.plan, other = plan === 'a' ? 'b' : 'a', rs = ROUTES[plan], ro = ROUTES[other];
  const lurkSpots = [LURK, ro[0][ro[0].length - 1], ro[1][ro[1].length - 1], MID_HOLDS[0], rs[1][0]];
  atk.forEach((a, i) => {
    const b = a.brain = newBrain(a, i);
    if (i >= 2 && atk.length >= 3 && Math.random() < (i === 3 ? 0.5 : 0.25)) { b.lurk = true; b.lurkSpot = pick(lurkSpots); }
    b.route = (Math.random() < 0.5 ? rs[0] : rs[1]).slice();
    b.plantCell = pick(SITES[plan].plant);
  });
  // defenders: a different setup every round (2-2-1, 3-1-1, 1-3-1 ...) and different spots
  const aH = shuffle(SITES.a.holdsDef.slice()), bH = shuffle(SITES.b.holdsDef.slice()), mH = shuffle(MID_HOLDS.slice());
  const lay = pick([[2, 2, 1], [3, 1, 1], [1, 3, 1], [2, 1, 2], [1, 2, 2], [2, 2, 1]]);
  const homes = shuffle([...aH.slice(0, lay[0]).map((c) => [c, 'a']), ...bH.slice(0, lay[1]).map((c) => [c, 'b']), ...mH.slice(0, lay[2]).map((c) => [c, null])]);
  def.forEach((a, i) => { const b = a.brain = newBrain(a, i); const h = homes[i % homes.length]; b.home = h[0]; b.homeSite = h[1]; });
}
function newBrain(a, idx) {
  return { idx, path: [], pi: 0, goal: -1, think: Math.random() * 0.1, target: null, vis: false, react: 0, errY: 0, errP: 0, aimHead: false, lastSeen: null, lastSeenT: -99, heardPos: null, heardT: -99, hurtT: -99, hurtBy: null, burst: 0, pauseT: 0, strafe: 1, startDelay: rand(0, 1.2), ri: 0, route: [], stuckT: 0, lastPos: a.pos.clone(), rotate: null, roam: -1, roamT: 0, nadeDone: false, unstuck: 0, lookPos: null, claimBase: -1, claimCell: -1, lurkSpot: -1, off: [rand(-0.55, 0.55), rand(-0.55, 0.55)],
    reposT: GS.time + rand(2, 6), homeT: GS.time + rand(9, 22), invT: 0, invCell: -1, invCool: GS.time + 6, jumpT: GS.time + rand(1, 4), retreatT: 0, retreatCool: 0, callCool: 0, saveCell: null };
}
function canSee(a, e, fov = 1.25) {
  if (a.blindT > 0.3) return false;
  const ep = eyePos(a), dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z, dist = Math.hypot(dx, dz);
  if (dist > (a.brain ? D().see : 120)) return false;
  if (dist > 2.5) { const ang = Math.atan2(-dx, -dz); if (Math.abs(angDiff(a.yaw, ang)) > fov) return false; }
  if (losClear(ep, headPos(e, _v1))) return true;
  return losClear(ep, chestPos(e, _v1));
}
function reached(a, cell, r = 1.3) { return Math.hypot(a.pos.x - cellX(cell), a.pos.z - cellZ(cell)) < r; }
function compGoal(a, b) {
  const c = GS.core, site = SITES[GS.plan];
  if (a.side === 0 && GS.state === 'live' && c.state !== 'planted' && c.state !== 'dropped' && GS.roundT < 12 && a.prim && alive(0).length <= 2 && c.carrier !== a) {
    if (b.saveCell == null) { b.saveCell = pick(SPAWN.T); const st = (GS.stat ||= {}); st.saves = (st.saves || 0) + 1; }
    return { cell: b.saveCell, hold: true, save: true };
  }
  if (a.side === 0) {
    if (c.state === 'dropped' && (!GS.fetcher || !GS.fetcher.alive)) GS.fetcher = alive(0).filter((x) => x.brain).sort((x, y) => x.pos.distanceTo(c.pos) - y.pos.distanceTo(c.pos))[0] || null;
    if (c.state === 'dropped' && GS.fetcher === a) return { cell: cellOf(c.pos.x, c.pos.z), pos: c.pos };
    if (c.state === 'planted' || c.state === 'boom') return { cell: SITES[c.site].holdsAtk[b.idx % 4], hold: true };
    if (b.lurk && !GS.execute) return { cell: b.lurkSpot >= 0 ? b.lurkSpot : LURK, hold: true };
    while (b.ri < b.route.length) {
      const last = b.ri === b.route.length - 1;
      if (last ? (GS.execute && reached(a, b.route[b.ri], 3.2)) : reached(a, b.route[b.ri], 1.8)) b.ri++; else break;
    }
    if (b.ri < b.route.length) {
      const stage = b.ri === b.route.length - 1;
      if (stage && !GS.execute && GS.roundT > 0) return { cell: b.route[b.ri], hold: true, stage: true };
      return { cell: b.route[b.ri] };
    }
    if (c.carrier === a) return { cell: b.plantCell, plant: true };
    return { cell: site.holdsAtk[b.idx % 4], hold: true };
  }
  if (c.state === 'planted') {
    const near = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z);
    if (a.prim && !a.act && near > 5 && c.timer < (a.kit ? 5.5 : 10.5) + near / 6) { if (b.saveCell == null) { b.saveCell = pick(SPAWN.D); const st = (GS.stat ||= {}); st.saves = (st.saves || 0) + 1; } return { cell: b.saveCell, hold: true, save: true }; }
    return { cell: cellOf(c.pos.x, c.pos.z), pos: c.pos, defuse: true };
  }
  if (b.rotate) return { cell: SITES[b.rotate].holdsDef[b.idx % 3], hold: true };
  return { cell: b.home, hold: true };
}
function dmGoal(a, b) {
  if (b.roam < 0 || reached(a, b.roam) || GS.time > b.roamT) {
    let best = null, bd = 1e9;
    for (const e of GS.actors) if (e.alive && e.side !== a.side && GS.time - e.spotT < 5) { const d = e.pos.distanceTo(a.pos); if (d < bd) { bd = d; best = e; } }
    b.roam = best && Math.random() < 0.55 ? jitterCell(cellOf(best.pos.x, best.pos.z), 3) : pick(WALKABLE);
    b.roamT = GS.time + rand(5, 11);
  }
  return { cell: b.roam };
}
function botThink(a, b) {
  const dd = D();
  // perception
  let best = null, bd = 1e9;
  for (const e of GS.actors) {
    if (!e.alive || e.side === a.side) continue;
    const dist = e.pos.distanceTo(a.pos);
    const recent = GS.time - b.lastSeenT < 1 && b.target === e;
    if (dist < bd && canSee(a, e, recent || GS.time - b.hurtT < 1 ? Math.PI : 1.25)) { best = e; bd = dist; }
  }
  if (best) {
    if (best !== b.target || !b.vis) {
      if (best !== b.target || GS.time - b.lastSeenT > 1.2) {
        const holding = Math.hypot(a.vel.x, a.vel.z) < 1 && Math.abs(angDiff(a.yaw, Math.atan2(-(best.pos.x - a.pos.x), -(best.pos.z - a.pos.z)))) < 0.4;
        b.react = dd.react * rand(0.8, 1.3) * (a.blindT > 0 ? 2 : 1) * (GS.time - b.hurtT < 0.5 ? 0.7 : 1) * (holding ? 0.55 : 1) * (Math.hypot(best.vel.x, best.vel.z) > 4 ? 0.85 : 1);
        const s = Math.random() < 0.5 ? -1 : 1;
        b.errY = s * dd.err * DEG * rand(0.6, 1.3); b.errP = (Math.random() - 0.3) * dd.err * DEG * 0.7;
        b.aimHead = Math.random() < dd.head; b.burst = 0;
        a.crouch = bd > 18 && Math.random() < 0.35 && !!a.prim;
      }
    }
    b.target = best; b.vis = true; b.lastSeen = best.pos.clone(); b.lastSeenT = GS.time;
    if (a.hp < 45 && GS.time > b.retreatCool && Math.random() < 0.3) { b.retreatT = GS.time + rand(0.8, 1.8); b.retreatCool = GS.time + 6; }
    best.spotT = GS.time;
    if (GS.time > b.callCool) { b.callCool = GS.time + 3; teamCall(a, best.pos, 40, 3, 0.25); }
  } else { b.vis = false; if (GS.time - b.lastSeenT > 3) { b.target = null; a.crouch = false; } }

  // goals (comp)
  if (GS.mode === 'comp') {
    const c = GS.core;
    if (a.side === 1 && c.state !== 'planted' && !b.rotate) {
      for (const k of ['a', 'b']) {
        const ctr = SITES[k].center, n = GS.actors.filter((e) => e.alive && e.side === 0 && GS.time - e.spotT < 4 && Math.hypot(e.pos.x - ctr[0] * CS, e.pos.z - ctr[1] * CS) < 22).length;
        const lost = GS.actors.some((e) => !e.alive && e.side === 1 && Math.hypot(e.pos.x - ctr[0] * CS, e.pos.z - ctr[1] * CS) < 22);
        if ((n >= 2 || (n >= 1 && lost)) && b.homeSite !== k && Math.random() < 0.8) b.rotate = k;
      }
    }
  }
  let goal = GS.mode === 'dm' ? dmGoal(a, b) : compGoal(a, b);
  // ---- act like a real player, not a statue ----
  if (GS.state === 'live' && GS.mode !== 'range' && !a.act) {
    const calm = !b.vis && GS.time - b.lastSeenT > 4;
    // heard something? go and check it out
    if (!b.vis && b.heardPos && (a.side === 1 || b.lurk) && GS.time - b.heardT < 1.2 && GS.time > b.invCool && Math.random() < 0.3) { b.invCell = cellOf(b.heardPos.x, b.heardPos.z); b.invT = GS.time + rand(4, 7); b.invCool = GS.time + 9; }
    if (GS.time < b.invT && !b.vis && b.invCell >= 0 && !goal.plant && !goal.defuse && !goal.pos) goal = { cell: jitterCell(b.invCell, 1) };
    // every so often move to a different spot (defenders re-position, lurkers change lanes)
    if (GS.mode === 'comp' && calm && GS.time > b.homeT) {
      b.homeT = GS.time + rand(10, 24);
      if (a.side === 1 && GS.core.state !== 'planted') {
        const stage = [ROUTES.a, ROUTES.b].flatMap((rs) => rs.map((r) => r[r.length - 1]));
        const pool = [...SITES.a.holdsDef, ...SITES.b.holdsDef, ...MID_HOLDS, ...SITES.a.holdsAtk, ...SITES.b.holdsAtk];
        if (Math.random() < 0.1) pool.push(pick(stage));
        b.home = pick(pool); b.homeSite = SITES.a.holdsDef.includes(b.home) ? 'a' : SITES.b.holdsDef.includes(b.home) ? 'b' : null; b.rotate = null;
        b.claimBase = -1; b.claimCell = -1; goal = compGoal(a, b);
      } else if (a.side === 0 && b.lurk && !GS.execute) {
        b.lurkSpot = pick([LURK, ...MID_HOLDS, ...SITES.a.holdsAtk, ...SITES.b.holdsAtk]); b.claimBase = -1; b.claimCell = -1; goal = compGoal(a, b);
      }
    }
    // standing at a hold: shuffle around, peek, crouch
    if ((goal.hold || goal.stage) && calm && GS.time > b.reposT && b.claimCell >= 0 && reached(a, b.claimCell, 1.6)) {
      b.reposT = GS.time + rand(2.5, 7); b.claimBase = -1; b.claimCell = -1; a.crouch = Math.random() < 0.2 && !!a.prim; b.off = [rand(-0.6, 0.6), rand(-0.6, 0.6)];
    }
  }
  if (goal.hold || goal.stage) goal.cell = spreadCell(a, b, goal.cell); else b.claimBase = -1;
  b.cur = goal;
  if (goal.cell !== b.goal) { b.goal = goal.cell; b.path = astar(cellOf(a.pos.x, a.pos.z), goal.cell); b.pi = 0; }
  if (b.pi + 1 < b.path.length && clearLine(a.pos.x, a.pos.z, cellX(b.path[b.pi + 1]), cellZ(b.path[b.pi + 1]))) b.pi++;
  // stuck
  const moved = Math.hypot(a.pos.x - b.lastPos.x, a.pos.z - b.lastPos.z);
  b.lastPos.copy(a.pos);
  if (b.wantMove && moved < 0.04) { b.stuckT += 0.1; if (b.stuckT > 0.8) { b.stuckT = 0; b.goal = -1; b.unstuck = 0.5; b.unYaw = Math.random() * 6.28; } } else b.stuckT = 0;
  // plant / defuse
  const c = GS.core;
  if (GS.mode === 'comp' && GS.state === 'live' && !a.act) {
    if (goal.plant && c.carrier === a && reached(a, b.plantCell, 0.9) && 'ab'.includes(zoneAt(a.pos.x, a.pos.z)) && !b.vis) a.act = { type: 'plant', t: 0, need: 3.2 };
    if (goal.defuse && c.state === 'planted' && Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) < 1.3 && (!b.vis || c.timer < (a.kit ? 6 : 11))) a.act = { type: 'defuse', t: 0, need: a.kit ? 5 : 10 };
    const dc = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z);
    if (goal.defuse && a.nades.smoke && !c.smoked && !a.act && dc > 3 && dc < 11 && Math.random() < 0.15 + 0.5 * dd.team) { c.smoked = true; lob(a, c.pos, 'smoke'); }
    if (c.state === 'planted' && a.side === 0 && a.nades.molly && !c.mollied && !b.vis && dc > 5 && dc < 22 && Math.random() < 0.04 + 0.05 * dd.team) { c.mollied = true; lob(a, c.pos.clone().add(V().set(rand(-1, 1), 0, rand(-1, 1))), 'molly'); }
  }
  // grenades: execute utility + HE at last known
  if (GS.state === 'live' && !b.vis && !a.act && Math.random() < dd.nade * 0.08) {
    const ld = b.target && b.lastSeen ? b.lastSeen.distanceTo(a.pos) : 0, fresh = b.target && GS.time - b.lastSeenT < 3;
    if (fresh && a.nades.he && ld > 7) lob(a, b.lastSeen, 'he');
    else if (fresh && a.nades.molly && ld > 8 && ld < 28) lob(a, b.lastSeen, 'molly');
    else if (fresh && a.nades.flash && ld > 7 && ld < 30 && (a.side === 1 || GS.execute)) lob(a, b.lastSeen, 'flash');
    else if (GS.mode === 'comp' && a.side === 0 && GS.execute && !b.nadeDone && b.ri >= b.route.length - 1) {
      b.nadeDone = true;
      const ctr = SITES[GS.plan].center, tp = V().set(ctr[0] * CS, 0.5, ctr[1] * CS);
      if (a.nades.smoke) lob(a, tp.clone().add(V().set(rand(-4, 4), 0, -6)), 'smoke');
      else if (a.nades.flash) lob(a, tp, 'flash');
    }
  }
}
function lob(a, tp, type) {
  const st = (GS.stat ||= {}); st['throw_' + type] = (st['throw_' + type] || 0) + 1;
  const dx = tp.x - a.pos.x, dz = tp.z - a.pos.z, d = Math.hypot(dx, dz);
  const th = 52 * DEG, v = clamp(Math.sqrt(d * 15 / Math.sin(2 * th)) * 0.9, 6, 21);
  const prevSlot = a.slot;
  a.yaw = Math.atan2(-dx, -dz);
  throwNade(a, type, fwd(a.yaw, th), v);
  a.slot = slotOK(a, prevSlot) ? prevSlot : bestSlot(a);
}
function botUpdate(a, dt) {
  const b = a.brain, dd = D();
  if (a.dummy) {
    a.strafeT -= dt; if (a.strafeT <= 0) { a.strafe *= -1; a.strafeT = rand(0.5, 1.4); }
    const sx = Math.cos(a.yaw) * a.strafe, sz = -Math.sin(a.yaw) * a.strafe;
    physics(a, dt, sx, sz, 3.2, false);
    return;
  }
  b.think -= dt;
  if (b.think <= 0) { b.think = 0.1; botThink(a, b); }
  b.react -= dt; b.pauseT -= dt; b.unstuck -= dt;
  const decay = Math.exp(-dt * dd.settle); b.errY *= decay; b.errP *= decay;
  const frozen = GS.state === 'freeze' || (GS.state === 'live' && GS.time - GS.roundStart < b.startDelay + (GS.phaseT > 0 ? GS.phaseT : 0));
  const w = curW(a), def = WD[w.id];
  // weapon housekeeping
  if (a.switchT <= 0 && a.reloadT <= 0) {
    if (a.slot === 'nade') equip(a, bestSlot(a));
    else if (a.prim && a.slot !== 'prim' && (a.prim.mag > 0 || a.prim.res > 0) && !b.vis) equip(a, 'prim');
    else if (w.mag === 0 && w.res === 0) equip(a, a.slot === 'prim' && a.sec ? 'sec' : 'knife');
    else if (def.mag && (w.mag === 0 || (!b.vis && GS.time - b.lastSeenT > 2 && w.mag < def.mag * 0.4))) startReload(a);
  }
  // aim
  let wantY = a.yaw, wantP = 0, tgtYaw = null, tol = 0;
  const T = b.target;
  if (T && b.vis && T.alive) {
    const tp = b.aimHead ? headPos(T, _v1) : chestPos(T, _v1);
    if (dd.lead) { tp.x += T.vel.x * dd.lead; tp.z += T.vel.z * dd.lead; }
    const ep = eyePos(a, _v2), dx = tp.x - ep.x, dy = tp.y - ep.y, dz = tp.z - ep.z, hd = Math.hypot(dx, dz);
    tgtYaw = Math.atan2(-dx, -dz); const tgtP = Math.atan2(dy, hd);
    wantY = tgtYaw + b.errY; wantP = tgtP + b.errP;
    tol = Math.atan2(b.aimHead ? 0.16 : 0.26, hd) + 0.4 * DEG;
    b.tgtP = tgtP;
  } else if (T && GS.time - b.lastSeenT < 3 && b.lastSeen) {
    wantY = Math.atan2(-(b.lastSeen.x - a.pos.x), -(b.lastSeen.z - a.pos.z));
  } else if (GS.time - b.heardT < 1.6 && b.heardPos) {
    wantY = Math.atan2(-(b.heardPos.x - a.pos.x), -(b.heardPos.z - a.pos.z));
  } else if (b.cur && b.cur.hold && b.path.length && b.pi >= b.path.length - 1 && reached(a, b.cur.cell, 1.2)) {
    const lp = GS.mode === 'comp' && GS.core.state === 'planted' && a.side === 0 ? holdLook(b.cur.cell, 1) : holdLook(b.cur.cell, 1 - a.side);
    wantY = Math.atan2(-(lp.x - a.pos.x), -(lp.z - a.pos.z)) + Math.sin(GS.time * 0.5 + b.idx) * 0.25;
  } else if (Math.hypot(a.vel.x, a.vel.z) > 1) wantY = Math.atan2(-a.vel.x, -a.vel.z);
  const turn = dd.turn * dt * (a.blindT > 0 ? 0.3 : 1);
  const dy = angDiff(a.yaw, wantY);
  a.yaw += clamp(dy * Math.min(1, dt * 14), -turn, turn);
  a.pitch += clamp((wantP - a.pitch) * Math.min(1, dt * 12), -turn, turn);
  // movement
  let wx = 0, wz = 0, spd = def.speed;
  a.sprint = false;
  b.wantMove = false;
  if (!frozen && !a.act) {
    const engaged = T && b.vis && T.alive;
    if (b.unstuck > 0) { wx = -Math.sin(b.unYaw); wz = -Math.cos(b.unYaw); b.wantMove = true; }
    else if (engaged) {
      const dist = T.pos.distanceTo(a.pos);
      if (GS.time < b.retreatT && !def.melee) { const d = _v1.subVectors(a.pos, T.pos).setY(0).normalize(); wx = d.x; wz = d.z; b.wantMove = true; }
      else if (def.melee || (def.pellets && dist > 6)) { const d = _v1.subVectors(T.pos, a.pos).setY(0).normalize(); wx = d.x; wz = d.z; b.wantMove = true; }
      else if (b.pauseT > 0 && dist > 5) { b.strafe = Math.sin(GS.time * 2 + b.idx) > 0 ? 1 : -1; wx = Math.cos(a.yaw) * b.strafe; wz = -Math.sin(a.yaw) * b.strafe; spd *= 0.75; }
    } else if (b.path.length && b.pi < b.path.length) {
      const last = b.pi === b.path.length - 1;
      const tx = last && b.cur && b.cur.pos ? b.cur.pos.x : cellX(b.path[b.pi]) + b.off[0], tz = last && b.cur && b.cur.pos ? b.cur.pos.z : cellZ(b.path[b.pi]) + b.off[1];
      const dx = tx - a.pos.x, dz = tz - a.pos.z, dl = Math.hypot(dx, dz);
      if (dl < (last ? 0.25 : 0.7)) { if (!last) b.pi++; }
      else { wx = dx / dl; wz = dz / dl; b.wantMove = true; if (last && dl < 1.2) spd *= 0.5; }
      if (b.cur && b.cur.stage && dl < 3) { wx = 0; wz = 0; b.wantMove = false; }
      if (T && GS.time - b.lastSeenT < 2) spd *= 0.5; // walk carefully after contact
      else if (GS.time - b.lastSeenT > 4 && b.path.length - b.pi > 6 && !(b.cur && b.cur.stage)) { spd *= 1.3; a.sprint = true; }
    }
  }
  for (const f of GS.fires) { const fx = a.pos.x - f.x, fz = a.pos.z - f.z, fd = Math.hypot(fx, fz); if (fd < f.r + 0.9) { const kk = fd || 1; wx = fx / kk; wz = fz / kk; b.wantMove = true; a.sprint = true; spd = def.speed * 1.3; } }
  // separation
  for (const o of GS.actors) {
    if (o === a || !o.alive) continue;
    const dx = a.pos.x - o.pos.x, dz = a.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.5 && d2 > 1e-4) { const d = Math.sqrt(d2); tryMove(a, dx / d * (0.71 - d) * 0.5, dz / d * (0.71 - d) * 0.5); }
  }
  const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  let hop = false;
  if (a.sprint && a.onGround && GS.time > b.jumpT) { hop = Math.random() < 0.45; b.jumpT = GS.time + rand(1.4, 4); }
  physics(a, dt, wx, wz, spd * (a.crouch ? 0.34 : 1) * (a.tagT > 0 ? 0.55 : 1), hop);
  footsteps(a, dt);
  // fire
  if (T && b.vis && T.alive && b.react <= 0 && !frozen && !a.act && a.switchT <= 0 && a.reloadT <= 0 && a.blindT <= 0.3 && GS.time >= a.nextFire && GS.state !== 'freeze') {
    const aimErr = Math.abs(angDiff(a.yaw, tgtYaw)) + Math.abs(a.pitch - b.tgtP);
    const dist = T.pos.distanceTo(a.pos);
    const slowEnough = Math.hypot(a.vel.x, a.vel.z) < def.speed * 0.4 || def.melee || def.pellets || dist < 6;
    if (def.melee) { if (dist < 1.9 && aimErr < 0.5) melee(a, Math.random() < 0.3); }
    else if (w.mag > 0 && aimErr < tol * (S.diff === 'easy' ? 2.5 : 1.6) && (slowEnough || b.pauseT <= -1.5) && b.pauseT <= 0) {
      if (def.scope) a.scoped = 1;
      fireWeapon(a);
      if (!def.auto) a.nextFire += rand(0.06, 0.25) * (S.diff === 'easy' ? 2 : 1);
      b.burst++;
      const burstLen = !def.auto ? 1 : dist > 22 ? 3 : dist > 11 ? 6 : 30;
      if (b.burst >= burstLen) { b.burst = 0; b.pauseT = def.auto ? rand(0.22, 0.45) : 0; }
    }
  }
}

// ---------------- physics ----------------
function tryMove(a, dx, dz) {
  const nx = a.pos.x + dx; if (!blocked(nx, a.pos.z, a.pos.y)) a.pos.x = nx; else a.vel.x = 0;
  const nz = a.pos.z + dz; if (!blocked(a.pos.x, nz, a.pos.y)) a.pos.z = nz; else a.vel.z = 0;
}
function physics(a, dt, wx, wz, maxSpd, jump) {
  const accel = a.onGround ? 46 : 9;
  let dvx = wx * maxSpd - a.vel.x, dvz = wz * maxSpd - a.vel.z;
  if (!a.onGround && !wx && !wz) { dvx = 0; dvz = 0; }
  const dl = Math.hypot(dvx, dvz), mx = accel * dt;
  if (dl > mx) { dvx *= mx / dl; dvz *= mx / dl; }
  a.vel.x += dvx; a.vel.z += dvz;
  if (jump && a.onGround) { a.vel.y = 5.6; a.onGround = false; }
  a.vel.y -= 16 * dt;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(a.vel.x), Math.abs(a.vel.z)) * dt / 0.2));
  for (let i = 0; i < n; i++) tryMove(a, a.vel.x * dt / n, a.vel.z * dt / n);
  a.pos.y += a.vel.y * dt;
  const g = groundAt(a.pos.x, a.pos.z, a.pos.y);
  if (a.pos.y <= g) {
    if (!a.onGround && a.vel.y < -4) { SFX.land(a.pos); if (a.isPlayer) VMS.land = 1; }
    a.pos.y = g; a.vel.y = 0; a.onGround = true;
  } else if (a.pos.y - g > 0.06) a.onGround = false;
}
function footsteps(a, dt) {
  const sp = Math.hypot(a.vel.x, a.vel.z);
  if (!a.onGround || sp < 3.6 || a.crouch) return;
  a.stepAcc += sp * dt;
  if (a.stepAcc > 2.3) {
    a.stepAcc = 0;
    SFX.step(a.pos, a.isPlayer ? 0.35 : 1, a.pos.y > 0.5 ? 1 : 0);
    noiseEvent(a.pos, a.sprint ? 28 : 20, a);
  }
}

// ---------------- player ----------------
const keys = {};
const mouse = [false, false, false];
let pressed = new Set();
let locked = false, softLock = false;
const mouseXY = [innerWidth / 2, innerHeight / 2];
let ignoreMouseUntil = 0, lastMag = 0;
document.addEventListener('pointerlockerror', () => { softLock = true; $('clickLock').classList.add('hidden'); $('pause').classList.add('hidden'); GS.paused = false; });
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { mouseXY[0] = e.clientX <= 2 ? 0 : e.clientX >= innerWidth - 3 ? innerWidth : mouseXY[0]; } });
function lock() {
  if (DEBUG) { locked = true; return; }
  const plain = () => { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => { }); } catch { } };
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch((err) => { if (err && err.name === 'NotSupportedError') plain(); });
  } catch { plain(); }
}
const uiOpen = () => !$('buy').classList.contains('hidden') || !$('end').classList.contains('hidden') || GS.state === 'menu' || GS.state === 'over';
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { softLock = false; ignoreMouseUntil = GS.time + 0.08; lastMag = 0; }
  if (!locked && softLock) return;
  if (locked) { $('clickLock').classList.add('hidden'); $('pause').classList.add('hidden'); GS.paused = false; }
  else if (!uiOpen() && !DEBUG) pauseGame();
});
function pauseGame() { GS.paused = true; $('pause').classList.remove('hidden'); for (const k in keys) keys[k] = false; mouse.fill(false); }
$('clickLock').onclick = () => lock();
canvas.addEventListener('mousedown', (e) => {
  if (GS.state === 'menu' || GS.state === 'over') return;
  if (!locked && !uiOpen()) lock();
  mouse[e.button] = true; pressed.add('M' + e.button);
});
addEventListener('mouseup', (e) => { mouse[e.button] = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  const P = GS.player; if (!P || !P.alive || GS.paused || uiOpen()) return;
  const order = ['prim', 'sec', 'knife', 'nade'].filter((s) => slotOK(P, s));
  const i = order.indexOf(P.slot); equip(P, order[(i + (e.deltaY > 0 ? 1 : -1) + order.length) % order.length]);
});
document.addEventListener('mousemove', (e) => {
  mouseXY[0] = e.clientX; mouseXY[1] = e.clientY;
  const P = GS.player; if (!P || GS.paused || uiOpen()) return;
  if (!P.alive) return;
  if (document.pointerLockElement === canvas) {
    if (GS.time < ignoreMouseUntil) return;
    const mag = Math.abs(e.movementX) + Math.abs(e.movementY);
    if (mag > 220 && mag > 4 * lastMag + 60) { lastMag = Math.min(lastMag, 60); return; }
    lastMag = mag;
  } else if (!softLock && !DEBUG) return;
  const zoom = camera.fov / S.fov;
  const s = S.sens * 0.0022 * zoom;
  P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s, -1.52, 1.52);
  VMS.swayX = clamp(VMS.swayX - e.movementX * 0.00012, -0.03, 0.03); VMS.swayY = clamp(VMS.swayY + e.movementY * 0.00012, -0.03, 0.03);
});
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (GS.state === 'menu') return;
  if (e.code === 'KeyB' || (e.code === 'Escape' && !$('buy').classList.contains('hidden'))) { e.preventDefault(); toggleBuy(); return; }
  if (e.code === 'Escape' && softLock && GS.state !== 'over') { if (GS.paused) { GS.paused = false; $('pause').classList.add('hidden'); } else pauseGame(); return; }
  if (e.repeat) return;
  keys[e.code] = true; pressed.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Tab') $('board').classList.remove('hidden');
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') $('board').classList.add('hidden'); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.fill(false); $('board').classList.add('hidden'); });

function updatePlayer(dt) {
  const P = GS.player;
  if (!P.alive) { pressed.clear(); return; }
  const w = curW(P), def = WD[w.id];
  const frozen = GS.state === 'freeze' || GS.paused;
  // slots
  if (pressed.has('Digit1')) equip(P, 'prim');
  if (pressed.has('Digit2')) equip(P, 'sec');
  if (pressed.has('Digit3')) equip(P, 'knife');
  if (pressed.has('Digit4')) equip(P, 'nade');
  if (pressed.has('KeyQ') && slotOK(P, P.lastSlot)) equip(P, P.lastSlot);
  if (pressed.has('KeyR') && def.mag) startReload(P);
  if (pressed.has('KeyG') && GS.mode === 'comp' && !MP.on) { if (GS.core.carrier === P && P.slot === 'knife') dropCore(P); else dropCurrent(P); }
  if (pressed.has('KeyF')) VMS.inspect = 1.6;
  const wasSprint = P.sprint;
  P.crouch = !!keys.KeyC; P.walk = !!keys.KeyX;
  P.ads = !!mouse[2] && !!def.mag && !def.scope && P.reloadT <= 0 && P.switchT <= 0 && !frozen;
  P.sprint = !!(keys.ShiftLeft || keys.ShiftRight) && !!keys.KeyW && !P.crouch && !P.ads && !mouse[0] && !P.act;
  if (P.sprint) P.sprintT = GS.time;
  // Krunker-style slide: press C while sprinting
  if (pressed.has('KeyC') && wasSprint && P.onGround && !(P.slideT > 0) && !frozen) {
    const sp0 = Math.hypot(P.vel.x, P.vel.z) || 1;
    P.slideT = 0.85; P.slideDir = [P.vel.x / sp0, P.vel.z / sp0]; P.slideV = Math.max(sp0, def.speed * 1.3) * 1.4; SFX.land(P.pos);
  }
  if (P.slideT > 0) { P.slideT -= dt; P.crouch = true; P.sprint = false; }
  // edge turning when the browser won't capture the mouse
  if (document.pointerLockElement !== canvas && !DEBUG && !uiOpen()) {
    const ex = mouseXY[0] / innerWidth, ey = mouseXY[1] / innerHeight, zone = 0.16, k = S.sens * 3.4 * dt * (camera.fov / S.fov);
    if (ex < zone) P.yaw += k * (zone - ex) / zone; else if (ex > 1 - zone) P.yaw -= k * (ex - 1 + zone) / zone;
    if (ey < zone) P.pitch = clamp(P.pitch + k * 0.6 * (zone - ey) / zone, -1.52, 1.52); else if (ey > 1 - zone) P.pitch = clamp(P.pitch - k * 0.6 * (ey - 1 + zone) / zone, -1.52, 1.52);
  }
  // E: plant / defuse / pickup
  const c = GS.core;
  const site = zoneAt(P.pos.x, P.pos.z);
  let hint = '';
  if (GS.mode === 'comp' && (GS.state === 'live')) {
    if (P.side === 0 && c.carrier === P && (site === 'a' || site === 'b') && P.onGround) {
      hint = 'Hold E to plant the core';
      if (keys.KeyE && !P.act) P.act = { type: 'plant', t: 0, need: 3.2 };
    }
    if (P.side === 1 && c.state === 'planted' && P.pos.distanceTo(c.pos) < 1.8) {
      hint = `Hold E to defuse (${P.kit ? 5 : 10} s)`;
      if (keys.KeyE && !P.act) P.act = { type: 'defuse', t: 0, need: P.kit ? 5 : 10 };
    }
  }
  if (P.act && !keys.KeyE) P.act = null;
  if (!hint && !P.act) {
    let near = null, nd = 1.8;
    for (const d of GS.drops) { const dd = Math.hypot(d.g.position.x - P.pos.x, d.g.position.z - P.pos.z); if (dd < nd) { nd = dd; near = d; } }
    if (near) {
      const slot = WD[near.w.id].slot;
      if (!P[slot]) takeDrop(P, near);
      else { hint = `E: swap for ${WD[near.w.id].name}`; if (pressed.has('KeyE')) takeDrop(P, near); }
    }
  }
  if (!hint && document.pointerLockElement !== canvas && !DEBUG && GS.time % 8 < 4) hint = 'Mouse not captured: click the game (best in Chrome) · or push the cursor to the screen edge to keep turning';
  setHint(hint);
  // movement
  let fx = 0, fz = 0;
  if (!frozen && !P.act) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    fx = -Math.sin(P.yaw) * f + Math.cos(P.yaw) * r; fz = -Math.cos(P.yaw) * f - Math.sin(P.yaw) * r;
    const l = Math.hypot(fx, fz); if (l > 0) { fx /= l; fz /= l; }
  }
  let maxSpd = def.speed * (P.sprint ? 1.32 : 1) * (P.walk ? 0.52 : 1) * (P.crouch ? 0.34 : 1) * (P.scoped || P.ads ? 0.62 : 1) * (P.tagT > 0 ? 0.55 : 1);
  if (P.slideT > 0 && !frozen) { fx = P.slideDir[0]; fz = P.slideDir[1]; maxSpd = P.slideV * (0.35 + 0.65 * P.slideT / 0.85); }
  physics(P, dt, fx, fz, maxSpd, keys.Space && !frozen && !P.act);
  if (!P.walk) footsteps(P, dt);
  // firing
  const can = !frozen && P.switchT <= 0 && !P.act && GS.state !== 'over' && GS.time - (P.sprintT || -9) > 0.12;
  if (can && def.nade) {
    if (pressed.has('M0') && GS.time >= P.nextFire) throwNade(P, w.id, fwd(P.yaw, P.pitch + 0.08), 19);
    else if (pressed.has('M2') && GS.time >= P.nextFire) throwNade(P, w.id, fwd(P.yaw, P.pitch + 0.15), 9);
  } else if (can && def.melee) {
    if (mouse[0] && GS.time >= P.nextFire) melee(P, false);
    else if (mouse[2] && GS.time >= P.nextFire) melee(P, true);
  } else if (can && P.reloadT <= 0) {
    if (mouse[0] && GS.time >= P.nextFire && (def.auto || pressed.has('M0'))) fireWeapon(P);
    if (pressed.has('M2') && def.scope) { P.scoped = (P.scoped + 1) % ((def.zoomLv || 2) + 1); P.rescope = 0; SFX.ui(); }
  }
  if (P.rescope && GS.time >= P.nextFire && P.reloadT <= 0) { P.scoped = P.rescope; P.rescope = 0; }
  pressed.clear();
}
function updateActorTimers(a, dt) {
  a.blindT = Math.max(0, a.blindT - dt); a.protT = Math.max(0, a.protT - dt); a.tagT = Math.max(0, a.tagT - dt);
  a.crouchAmt += ((a.crouch ? 1 : 0) - a.crouchAmt) * Math.min(1, dt * 12);
  if (a.switchT > 0) a.switchT -= dt;
  if (a.reloadT > 0) { a.reloadT -= dt; if (a.reloadT <= 0) { a.reloadT = 0; finishReload(a); } }
  const def = curDef(a);
  if (def.pat && GS.time - a.lastShot > 60 / def.rpm + 0.06) a.rc = Math.max(0, a.rc - def.rec * dt * (1 + a.rc * 0.08));
  // plant / defuse progress
  if (a.act) {
    const c = GS.core;
    a.act.t += dt;
    if (a.act.type === 'plant' && (c.carrier !== a || GS.state !== 'live')) a.act = null;
    else if (a.act.type === 'defuse' && (c.state !== 'planted' || a.pos.distanceTo(c.pos) > 2)) a.act = null;
    if (a.act && a.act.t >= a.act.need && MP.role !== 'client') {
      if (a.act.type === 'plant') {
        c.state = 'planted'; c.carrier = null; c.pos.set(a.pos.x, a.pos.y, a.pos.z); c.site = zoneAt(a.pos.x, a.pos.z); c.timer = 40; c.beepT = 0;
        addMoney(a, 300, 'plant'); SFX.plant(); if (MP.role === 'host') MPH.event('plant'); banner('CORE PLANTED', `Site ${c.site.toUpperCase()} · 40 seconds`, '#ff9a3d', 2200);
        for (const b of GS.actors) if (b.brain) b.brain.goal = -1;
        feedText(`${a.name} planted the core at ${c.site.toUpperCase()}`);
      } else {
        c.state = 'defused'; SFX.defused(); addMoney(a, 300, 'defuse'); if (MP.role === 'host') MPH.event('defused');
        feedText(`${a.name} defused the core!`);
        if (GS.state === 'live') endRound(1, 'defuse');
      }
      a.act = null;
    }
  }
}
function updateCore(dt) {
  const c = GS.core; if (!c || GS.mode !== 'comp') { coreMesh.visible = false; return; }
  const P = GS.player;
  if (c.state === 'dropped' && MP.role !== 'client') {
    for (const a of GS.actors) if (a.alive && a.side === 0 && Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) < 1.1 && Math.abs(a.pos.y - c.pos.y) < 1.2) {
      c.state = 'carried'; c.carrier = a; GS.fetcher = null; if (a.isPlayer) toast('You picked up the CORE'); break;
    }
  }
  if (c.state === 'carried' && c.carrier) {
    const a = c.carrier;
    coreMesh.visible = !a.isPlayer && a.alive;
    coreMesh.position.set(a.pos.x + Math.sin(a.yaw) * 0.25, a.pos.y + 1.05 - 0.36 * a.crouchAmt, a.pos.z + Math.cos(a.yaw) * 0.25); coreMesh.rotation.y = a.yaw;
    coreMesh.userData.light.intensity = 2;
  } else if (c.state === 'dropped' || c.state === 'planted') {
    coreMesh.visible = true; coreMesh.position.copy(c.pos); coreMesh.rotation.y = 0;
    if (c.state === 'dropped') coreMesh.userData.light.intensity = 3 + Math.sin(GS.time * 6) * 2;
  } else coreMesh.visible = false;
  coreMesh.userData.glow.material.color.setHex(c.state === 'planted' && c.beepT > 0.05 + clamp(c.timer / 40, 0.08, 1) * 0.8 ? 0xff2a2a : 0xffa030);
  // execute decision for attackers
  if (GS.state === 'live' && !GS.execute && MP.role !== 'client') {
    const atk = GS.actors.filter((a) => a.alive && a.side === 0 && a.brain && !a.brain.lurk);
    const waiting = atk.filter((a) => a.brain.cur && a.brain.cur.stage && reached(a, a.brain.cur.cell, 3.2)).length;
    const elapsed = GS.time - GS.roundStart - GS.phaseT;
    if ((waiting >= Math.min(3, atk.length) && waiting > 0) || GS.roundT < 62 || (c.carrier && c.carrier.human && c.carrier.alive && 'ab'.includes(zoneAt(c.carrier.pos.x, c.carrier.pos.z))) || elapsed > 70 || elapsed > GS.rushAt) {
      GS.execute = true; for (const a of atk) a.brain.goal = -1;
    }
  }
}
function setHint(t) { const h = $('hint'); if (h._t !== t) { h._t = t; h.textContent = t; } }

// ---------------- HUD ----------------
function banner(big, sub = '', color = '#fff', ms = 3000, local = false) {
  if (MP.role === 'host' && !local) MPH.banner(big, sub, color, ms);
  const b = $('banner');
  b.innerHTML = `<div class="big" style="color:${color}">${big}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
  clearTimeout(b._t); b._t = setTimeout(() => (b.innerHTML = ''), ms);
}
function toast(t) { const k = $('killmsg'); k.innerHTML = `<div class="k" style="color:#ffb13d">${t}</div>`; clearTimeout(k._t); k._t = setTimeout(() => (k.innerHTML = ''), 2600); }
function feed(k, v, wid, hs) {
  const f = $('feed'), d = document.createElement('div');
  const nm = (a) => `<span style="color:${SIDE[a.side].css}">${a.isPlayer ? 'You' : a.name}</span>`;
  const wn = wid === 'core' ? 'CORE BLAST' : WD[wid] ? WD[wid].name : '';
  d.innerHTML = (k && k !== v ? nm(k) : '') + `<span class="w">${wn}</span>` + (hs ? '<span class="hs">◎</span>' : '') + nm(v);
  if ((k && k.isPlayer) || v.isPlayer) d.className = 'me';
  f.prepend(d); while (f.children.length > 6) f.lastChild.remove();
  setTimeout(() => d.remove(), 7000);
}
function feedText(t) { if (MP.role === 'host') MPH.feedTextEvent(t); const f = $('feed'), d = document.createElement('div'); d.textContent = t; d.style.color = '#ffb13d'; f.prepend(d); setTimeout(() => d.remove(), 6000); }
function showHit(cls, killed) {
  const h = $('hitm'); h.className = killed ? 'kill' : cls; h.style.transition = 'none'; h.style.opacity = 1;
  requestAnimationFrame(() => { h.style.transition = 'opacity .35s'; h.style.opacity = 0; });
}
function hurtFx(dmg, att, dir) {
  const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = Math.min(1, 0.35 + dmg / 60);
  requestAnimationFrame(() => { h.style.transition = 'opacity .7s'; h.style.opacity = 0; });
  if (att && att !== GS.player) {
    const P = GS.player, ang = Math.atan2(-(att.pos.x - P.pos.x), -(att.pos.z - P.pos.z));
    const rel = angDiff(P.yaw, ang);
    const i = document.createElement('i'); i.style.transform = `rotate(${-rel}rad)`; $('dmgDir').appendChild(i);
    setTimeout(() => (i.style.opacity = 0), 600); setTimeout(() => i.remove(), 900);
  }
}
const fmtT = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const hudCache = {};
function setText(id, t) { if (hudCache[id] !== t) { hudCache[id] = t; $(id).textContent = t; } }
function setHTML(id, t) { if (hudCache[id] !== t) { hudCache[id] = t; $(id).innerHTML = t; } }
const radar = $('radar'), rc = radar.getContext('2d');
function updateHUD() {
  const P = GS.player, c = GS.core;
  const specA = !P.alive ? specTarget() : null;
  const viewA = specA || P;
  // top bar
  if (GS.mode === 'range') {
    setText('scL', GS.score[0]); setText('scR', ''); setHTML('pipL', ''); setHTML('pipR', '');
    setText('timer', fmtT(GS.roundT)); setText('sideTag', `AIM RANGE · ${GS.rangeHS} headshots`);
  } else {
    const ms = mySq(); setText('scL', GS.score[ms]); setText('scR', GS.score[1 - ms]);
    const pip = (sq) => GS.actors.filter((a) => a.squad === sq).map((a) => `<i class="${a.alive ? '' : 'dead'}"></i>`).join('');
    setHTML('pipL', pip(ms)); setHTML('pipR', pip(1 - ms));
    $('sqL').style.color = SIDE[P.side].css; $('sqR').style.color = SIDE[1 - P.side].css;
    $('sqL').style.borderBottomColor = SIDE[P.side].css; $('sqR').style.borderBottomColor = SIDE[1 - P.side].css;
    let tt = GS.mode === 'dm' ? GS.roundT : GS.state === 'freeze' ? GS.phaseT : c.state === 'planted' ? c.timer : GS.roundT;
    if (GS.state === 'end') tt = GS.phaseT;
    setText('timer', fmtT(tt));
    $('timer').classList.toggle('red', GS.mode === 'comp' && c.state === 'planted');
    setText('sideTag', GS.mode === 'dm' ? `DEATHMATCH · first to ${GS.target}` : `${SIDE[P.side].name} (${SIDE[P.side].role.toUpperCase()}) · ROUND ${GS.round} · FIRST TO ${GS.target}${GS.state === 'freeze' ? ' · BUY TIME (B)' : ''}`);
  }
  // money / buy hint
  setText('money', GS.mode === 'comp' ? `$${P.money}` : '');
  setText('buyHint', P.alive && inBuyZone(P) ? 'Press B to buy' : '');
  setText('coreIcon', c && c.carrier === P ? '◆ YOU HAVE THE CORE' : '');
  // vitals
  setText('hp', Math.ceil(viewA.hp)); setText('ar', Math.ceil(viewA.armor) + (viewA.helmet ? '+H' : ''));
  $('hpBox').classList.toggle('low', viewA.hp <= 25);
  const w = curW(viewA), def = WD[w.id];
  setText('wname', def.name.toUpperCase());
  if (def.mag) { setText('mag', w.mag); setText('res', `/ ${w.res > 900 ? '∞' : w.res}`); $('ammo').classList.toggle('low', w.mag <= Math.ceil(def.mag * 0.25)); }
  else if (def.nade) { setText('mag', viewA.nades[w.id]); setText('res', ''); $('ammo').classList.remove('low'); }
  else { setText('mag', '—'); setText('res', ''); $('ammo').classList.remove('low'); }
  const inv = [['1', viewA.prim && WD[viewA.prim.id].name, 'prim'], ['2', viewA.sec && WD[viewA.sec.id].name, 'sec'], ['3', 'Karambit', 'knife'],
  ['4', hasNade(viewA) ? ['he', 'flash', 'smoke', 'molly'].filter((n) => viewA.nades[n]).map((n) => WD[n].name + (viewA.nades[n] > 1 ? ' x' + viewA.nades[n] : '')).join(' · ') : '', 'nade']];
  setHTML('inv', inv.filter((r) => r[1]).map((r) => `<div class="${viewA.slot === r[2] ? 'on' : ''}"><b>${r[0]}</b>${r[1]}</div>`).join('') + (viewA.kit ? '<div>Defuse kit</div>' : ''));
  // action bar
  const act = viewA.act;
  $('prog').classList.toggle('hidden', !act);
  if (act) { setText('progLbl', act.type === 'plant' ? 'PLANTING CORE…' : 'DEFUSING CORE…'); $('progFill').style.width = (act.t / act.need * 100) + '%'; }
  // spectate
  if (!P.alive && GS.mode === 'comp') setText('spec', specA ? `Spectating ${specA.name} · ${Math.ceil(specA.hp)} HP · click to switch` : 'Waiting for next round…');
  else if (!P.alive && GS.mode === 'dm') setText('spec', `Respawning in ${Math.max(0, P.respawnT).toFixed(1)}…`);
  else setText('spec', '');
  // crosshair
  const xh = $('xh'); const sp = P.alive ? computeSpread(P, def.mag ? def : WD.p9) : 0;
  const gap = S.xhGap + (def.mag && !def.pellets ? Math.min(40, sp * 4) : def.pellets ? 18 : 0), L = S.xhSize;
  const hideX = !P.alive || (P.scoped && def.scope) || (def.scope && !P.scoped) || (P.ads && VMS.ads > 0.7);
  xh.style.display = hideX ? 'none' : '';
  xh.style.setProperty('--xc', S.xhColor);
  const ch = xh.children;
  const key = `${Math.round(gap)}|${L}|${S.xhDot}`;
  if (xh._k !== key) {
    xh._k = key;
    const set = (el, x, y, w2, h2) => { el.style.cssText = `left:${x}px;top:${y}px;width:${w2}px;height:${h2}px`; };
    set(ch[0], -1, -gap - L, 2, L); set(ch[1], -1, gap, 2, L); set(ch[2], -gap - L, -1, L, 2); set(ch[3], gap, -1, L, 2);
    set(ch[4], -1, -1, 2, 2); ch[4].style.display = S.xhDot === '1' ? '' : 'none';
  }
  // scope + flash + smoke
  $('scope').classList.toggle('hidden', !(P.alive && P.scoped && def.scope));
  $('flash').style.opacity = P.alive ? Math.min(1, P.blindT / 1.2) : 0;
  let sv = 0; const cp = camera.position;
  for (const s of GS.smokes) { const d = Math.hypot(cp.x - s.x, (cp.y - s.y) * 1.2, cp.z - s.z); if (d < s.r) sv = Math.max(sv, clamp((s.r - d) / 1.2, 0, 1) * clamp(s.t / 2, 0, 1)); }
  $('smokeV').style.opacity = sv * 0.95;
  drawRadar(viewA);
}
function drawRadar(viewA) {
  const P = GS.player, s = 2.3;
  rc.clearRect(0, 0, 200, 200);
  rc.save(); rc.beginPath(); rc.arc(100, 100, 98, 0, 7); rc.clip();
  rc.translate(100, 100); rc.rotate(viewA.yaw); rc.scale(s, s); rc.translate(-viewA.pos.x, -viewA.pos.z);
  rc.globalAlpha = 0.9; rc.drawImage(radarImg, 0, 0, W * CS, H * CS); rc.globalAlpha = 1;
  const dot = (x, z, col, r = 1.6) => { rc.fillStyle = col; rc.beginPath(); rc.arc(x, z, r, 0, 7); rc.fill(); rc.strokeStyle = '#000'; rc.lineWidth = 0.4; rc.stroke(); };
  for (const a of GS.actors) {
    if (!a.alive || a === viewA) continue;
    if (a.side === P.side) dot(a.pos.x, a.pos.z, SIDE[a.side].css);
    else if (GS.time - a.spotT < 0.6 || a.dummy) dot(a.pos.x, a.pos.z, '#ff3b3b');
  }
  for (const s2 of GS.smokes) { rc.fillStyle = 'rgba(220,220,225,.6)'; rc.beginPath(); rc.arc(s2.x, s2.z, s2.r, 0, 7); rc.fill(); }
  const c = GS.core;
  if (c && GS.mode === 'comp' && (P.side === 0 || c.state === 'planted')) {
    const cp = c.state === 'carried' && c.carrier ? c.carrier.pos : c.pos;
    if (c.state !== 'none' && c.state !== 'boom' && c.state !== 'defused') { rc.fillStyle = c.state === 'planted' ? '#ff3b3b' : '#ffb13d'; rc.fillRect(cp.x - 1.4, cp.z - 1.4, 2.8, 2.8); }
  }
  rc.restore();
  rc.fillStyle = '#fff'; rc.beginPath(); rc.moveTo(100, 92); rc.lineTo(106, 106); rc.lineTo(100, 103); rc.lineTo(94, 106); rc.closePath(); rc.fill();
}
function specTarget() {
  const mates = GS.actors.filter((a) => a.alive && a.side === GS.player.side && !a.isPlayer);
  if (!mates.length) return null;
  return mates[((GS.spec % mates.length) + mates.length) % mates.length];
}
canvas.addEventListener('click', () => { if (GS.player && !GS.player.alive) GS.spec++; });

// scoreboard
function updateBoard() {
  if ($('board').classList.contains('hidden')) return;
  const P = GS.player;
  const rows = (sq) => GS.actors.filter((a) => a.squad === sq).sort((a, b) => b.kills - a.kills).map((a) =>
    `<tr class="${a.isPlayer ? 'me' : ''} ${a.alive ? '' : 'dead'}"><td>${a.isPlayer ? 'You' : a.name}${GS.core && GS.core.carrier === a && sq === mySq() ? ' ◆' : ''}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.kills ? Math.round(a.hs / a.kills * 100) : 0}%</td><td>${Math.round(a.dmg)}</td><td>${sq === mySq() && GS.mode === 'comp' ? '$' + a.money : ''}</td></tr>`).join('');
  const head = '<tr><th>NAME</th><th>K</th><th>D</th><th>HS</th><th>DMG</th><th></th></tr>';
  setHTML('boardCard', `<div class="tn" style="color:${SIDE[P.side].css}">YOUR SQUAD · ${SIDE[P.side].name} · ${GS.score[mySq()]}</div><table>${head}${rows(mySq())}</table>` +
    (GS.mode !== 'range' ? `<div class="tn" style="color:${SIDE[1 - P.side].css}">ENEMY · ${SIDE[1 - P.side].name} · ${GS.score[1 - mySq()]}</div><table>${head}${rows(1 - mySq())}</table>` : ''));
}

// buy menu
const BUY = [['PISTOLS', ['p9', 'tec', 'viper', 'revolver']], ['SMG / SHOTGUN', ['buzz', 'chopper', 'thumper', 'scatter']], ['RIFLES', ['carbine', 'raptor', 'sentinel', 'lmg']], ['SNIPERS', ['ranger', 'dmr', 'longbow']], ['GEAR', ['kevlar', 'helm', 'kit']], ['GRENADES', ['he', 'flash', 'smoke', 'molly']]];
function renderBuy() {
  const P = GS.player;
  $('buyMoney').textContent = GS.mode === 'comp' ? `$${P.money}` : 'FREE';
  $('buyTime').textContent = GS.mode === 'comp' ? (GS.state === 'freeze' ? `buy time ${Math.ceil(GS.phaseT + 20)}s` : `buy time ${Math.max(0, Math.ceil(GS.buyLeft))}s`) : '';
  $('buyGrid').innerHTML = BUY.map(([cat, ids]) => `<div class="cat"><h3>${cat}</h3>${ids.map((id) => {
    const d = WD[id] || GEAR[id];
    const own = (WD[id] && !d.nade && P[d.slot] && P[d.slot].id === id) || (id === 'kit' && P.kit) || (id === 'helm' && P.helmet) || (id === 'kevlar' && P.armor >= 100);
    const bars = WD[id] && d.dmg ? `<div class="bars"><span>Damage</span><i style="width:${Math.min(100, d.dmg * (d.pellets || 1) / 1.6)}%"></i><span>Fire rate</span><i style="width:${Math.min(100, d.rpm / 9)}%"></i><span>Mobility</span><i style="width:${Math.max(6, Math.min(100, (d.speed - 4.6) / 2.4 * 100))}%"></i></div>` : '';
    return `<button class="item ${own ? 'own' : ''}" data-id="${id}" ${canBuy(P, id) ? '' : 'disabled'}><span class="p">${GS.mode === 'comp' ? '$' + priceOf(P, id) : 'FREE'}</span><div class="n">${d.name}</div><div class="d">${d.desc || ''}</div>${bars}</button>`;
  }).join('')}</div>`).join('');
}
$('buyGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.item'); if (!b) return;
  if (MP.role === 'client') { if (canBuy(GS.player, b.dataset.id)) { SFX.buy(); MPH.clientBuy(b.dataset.id); } else SFX.deny(); }
  else if (buy(GS.player, b.dataset.id)) SFX.buy(); else SFX.deny();
  renderBuy();
});
function toggleBuy() {
  const el = $('buy'), P = GS.player;
  if (el.classList.contains('hidden')) {
    if (!P || !P.alive || !inBuyZone(P) || GS.state === 'over' || GS.paused) { if (P && P.alive && GS.mode === 'comp') toast(GS.state === 'live' && GS.buyLeft <= 0 ? 'Buy time is over' : 'Go back to your spawn to buy'); return; }
    renderBuy(); el.classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock();
  } else { el.classList.add('hidden'); lock(); setTimeout(() => { if (!locked && !DEBUG && !softLock && GS.state !== 'menu') $('clickLock').classList.remove('hidden'); }, 300); }
}

// ---------------- camera + viewmodel animation ----------------
const _camT = V();
function updateCamera(dt) {
  const P = GS.player;
  let view = P;
  if (!P.alive) {
    if (GS.mode === 'comp' && GS.time - GS.deathT > 2.2) view = specTarget() || null;
    else view = null;
  }
  for (const a of GS.actors) if (a.mesh) a.mesh.g.visible = a.alive && a !== view && !a.isPlayer;
  if (view) {
    const def = curDef(view);
    let rp = 0, ry = 0;
    if (view === P && def.pat) { const r = recoilAt(def, P.rc); rp = r[0] * DEG * 0.55; ry = r[1] * DEG * 0.55; }
    camera.position.set(view.pos.x, eyeY(view), view.pos.z);
    camera.rotation.set(view.pitch + rp, view.yaw + ry, 0);
    const zf = view.scoped && def.scope ? (view.scoped === 1 ? 40 : 15) : view.ads && GM[curW(view).id] && GM[curW(view).id].ads ? S.fov / GM[curW(view).id].ads[1] : S.fov;
    camera.fov += (zf - camera.fov) * Math.min(1, dt * 20);
  } else {
    // death cam: float above and look at killer
    const k = GS.killer && GS.killer.alive ? GS.killer.pos : P.pos;
    _camT.set(P.pos.x, P.pos.y + 3.2, P.pos.z);
    camera.position.lerp(_camT, Math.min(1, dt * 3));
    camera.lookAt(k.x, k.y + 1.2, k.z);
    camera.fov += (S.fov - camera.fov) * Math.min(1, dt * 8);
  }
  if (GS.shake > 0) { camera.position.x += rand(-1, 1) * GS.shake * 0.15; camera.position.y += rand(-1, 1) * GS.shake * 0.15; GS.shake = Math.max(0, GS.shake - dt * 1.5); }
  camera.updateProjectionMatrix();
  setListener(camera.position.x, camera.position.y, camera.position.z, view ? view.yaw : P.yaw);
  // viewmodel
  vmRoot.visible = P.alive && !(P.scoped && curDef(P).scope);
  if (!vmCur) return;
  const sp = Math.hypot(P.vel.x, P.vel.z), def = curDef(P);
  VMS.bob += sp * dt * 1.6;
  const bobA = P.onGround ? Math.min(1, sp / 6) : 0;
  VMS.kick = Math.max(0, VMS.kick - dt * 7);
  VMS.swayX *= Math.exp(-dt * 8); VMS.swayY *= Math.exp(-dt * 8);
  VMS.land = Math.max(0, VMS.land - dt * 4); VMS.slash = Math.max(0, VMS.slash - dt * 3.2);
  if (VMS.flashT > 0) { VMS.flashT -= dt; if (VMS.flashT <= 0) vmCur.userData.fl.visible = false; }
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 120);
  const sw = clamp(P.switchT / 0.4, 0, 1);
  const rl = P.reloadT > 0 ? Math.sin(clamp(1 - P.reloadT / def.reload, 0, 1) * Math.PI) : 0;
  let insp = 0; if (VMS.inspect > 0 && P.reloadT <= 0) { VMS.inspect -= dt; insp = 1 - VMS.inspect / 1.6; if (sp > 1 || mouse[0]) VMS.inspect = 0; }
  const knife = def.melee, nade = def.nade, gm = GM[curW(P).id];
  // base pose [x, y, z, yaw, roll, pitch]: pistols angled in toward the crosshair like Krunker, rifles low so you only see barrel + sights
  const POSE = nade ? [0.2, -0.19, -0.38, 0.07, 0, 0] : knife ? [0.12, -0.085, -0.3, 0.2, 0.0, 0.12] : def.slot === 'sec' ? [0.095, -0.12, -0.36, 0.1, 0.04, 0.04] : [0.17, -0.16, -0.42, 0.14, 0, 0.0];
  const bx = POSE[0], by = POSE[1], bz = POSE[2];
  VMS.ads += ((P.ads ? 1 : 0) - VMS.ads) * Math.min(1, dt * 14);
  VMS.spr += ((P.sprint && sp > 3 ? 1 : 0) - VMS.spr) * Math.min(1, dt * 9);
  const A = VMS.ads, Rr = VMS.spr;
  vmRoot.position.set(bx + VMS.swayX + Math.sin(VMS.bob) * 0.012 * bobA + (knife ? 0.04 : 0), by + VMS.swayY - Math.abs(Math.cos(VMS.bob)) * 0.01 * bobA - sw * 0.25 - rl * 0.08 - VMS.land * 0.03 + (P.crouch ? 0.01 : 0), bz + VMS.kick * 0.07);
  vmRoot.rotation.set(POSE[5] + VMS.kick * (def.scope ? 0.25 : 0.1) - rl * 0.6 + (knife || nade ? -VMS.slash * 0.9 : 0), POSE[3] + (insp > 0 ? Math.sin(insp * Math.PI) * 1.1 : 0) + (knife ? VMS.slash * 0.8 : 0), POSE[4] + rl * 0.5 + (insp > 0 ? Math.sin(insp * Math.PI * 2) * 0.35 : 0));
  if (A > 0.001 && gm && gm.ads) {
    vmRoot.position.x += (0 - vmRoot.position.x) * A;
    vmRoot.position.y += (-gm.sy - vmRoot.position.y) * A;
    vmRoot.position.z += (gm.ads[0] + VMS.kick * 0.04 - vmRoot.position.z) * A;
    vmRoot.rotation.y *= 1 - A; vmRoot.rotation.x *= 1 - A * 0.7; vmRoot.rotation.z *= 1 - A;
  }
  if (Rr > 0.001) { vmRoot.position.x += 0.04 * Rr; vmRoot.position.y -= 0.06 * Rr - Math.sin(VMS.bob * 2) * 0.012 * Rr; vmRoot.rotation.y += 0.7 * Rr; vmRoot.rotation.x -= 0.25 * Rr; vmRoot.rotation.z += 0.2 * Rr; }
}

// ---------------- third-person animation ----------------
function animateActors(dt) {
  for (const a of GS.actors) {
    const m = a.mesh; if (!m || !a.alive) continue;
    m.g.position.copy(a.pos); m.g.rotation.y = a.yaw;
    const sp = Math.hypot(a.vel.x, a.vel.z);
    m.phase += sp * dt * 1.9;
    const mv = Math.min(1, sp / 5), sw = Math.sin(m.phase) * 0.55 * mv;
    const th = 0.95 * a.crouchAmt, drop = 0.6 * (1 - Math.cos(th));
    m.legL.position.y = m.legR.position.y = 0.62 - drop; m.up.position.y = -drop;
    m.legL.rotation.x = th + sw; m.legR.rotation.x = th - sw;
    m.kneeL.rotation.x = -2 * th - Math.max(0, Math.sin(m.phase + 1.3)) * 0.9 * mv;
    m.kneeR.rotation.x = -2 * th - Math.max(0, Math.sin(m.phase + 1.3 + Math.PI)) * 0.9 * mv;
    m.arms.rotation.x = a.pitch * 0.8; m.head.rotation.x = a.pitch * 0.5;
    const w = curW(a), sl = WD[w.id].slot;
    m.gunP.visible = sl === 'prim'; m.gunS.visible = sl === 'sec' || !!WD[w.id].nade; m.gunK.visible = !!WD[w.id].melee;
    m.flash.position.set(sl === 'prim' ? 0.12 : 0.1, sl === 'prim' ? 0.075 : 0.02, sl === 'prim' ? -0.88 : -0.62);
    if (m.flashT > 0) { m.flashT -= dt; if (m.flashT <= 0) m.flash.visible = false; }
    if (a.protT > 0) m.up.visible = Math.floor(GS.time * 12) % 2 === 0; else m.up.visible = true;
  }
  for (const d of GS.drops) { d.t += dt; d.g.rotation.y += dt * 0.8; }
}

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function clientStep(dt) {
  if (GS.state === 'freeze') { const b = Math.ceil(GS.phaseT); GS.phaseT -= dt; if (Math.ceil(GS.phaseT) !== b && b <= 3 && b > 0) SFX.countdown(false); }
  else if (GS.state === 'live') { GS.buyLeft -= dt; if (GS.core.state !== 'planted') GS.roundT -= dt; }
  else if (GS.state === 'end') GS.phaseT -= dt;
  const c = GS.core; if (c.state === 'planted' && GS.state !== 'over') { c.timer -= dt; coreBeep(c, dt); }
  if (GS.state === 'over') return;
  for (const a of GS.actors) if (a.alive) updateActorTimers(a, dt);
  updatePlayer(dt);
  MPH.mirrorTick(dt);
  const P = GS.player;
  if (P.alive && Math.floor(GS.time * 10) !== Math.floor((GS.time - dt) * 10)) for (const e of GS.actors) if (e.alive && e.side !== P.side && canSee(P, e, 0.9)) e.spotT = GS.time;
  updateNades(dt); updateSmokes(dt); updateFires(dt); updateCore(dt);
  MPH.clientTick(dt);
}
function step(dt) {
  GS.time += dt;
  if (MP.role === 'client') { clientStep(dt); return; }
  updateRound(dt);
  if (GS.state === 'over') return;
  for (const a of GS.actors) if (a.alive) updateActorTimers(a, dt);
  updatePlayer(dt);
  for (const a of GS.actors) if (a.alive && a.brain) botUpdate(a, dt);
  for (const a of GS.actors) if (a.alive && a.dummy) botUpdate(a, dt);
  // spotting by the player (for radar)
  const P = GS.player;
  if (P.alive && Math.floor(GS.time * 10) !== Math.floor((GS.time - dt) * 10)) for (const e of GS.actors) if (e.alive && e.side !== P.side && canSee(P, e, 0.9)) e.spotT = GS.time;
  updateNades(dt); updateSmokes(dt); updateFires(dt); updateCore(dt);
  if (MP.role === 'host') MPH.hostTick(dt);
}
// adaptive quality: if the game runs slow, lower resolution, then turn shadows off
const QL = { shadows: renderer.shadowMap.enabled, t: 0, n: 0, cool: 2, frame: 0 };
renderer.shadowMap.needsUpdate = true;
function degrade() {
  const dpr = renderer.getPixelRatio();
  if (dpr > 1.01) renderer.setPixelRatio(1);
  else if (QL.shadows) {
    QL.shadows = false; renderer.shadowMap.enabled = false; sun.castShadow = false;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  } else if (dpr > 0.7) renderer.setPixelRatio(dpr - 0.15);
  else return;
  resize(); QL.cool = 1;
}
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000; last = now;
  const dt = Math.min(0.05, rawDt);
  fpsAcc += rawDt; fpsN++;
  if (fpsAcc > 0.5) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  if (GS.state === 'menu') {
    const t = now / 1000 * 0.06;
    camera.position.set(W + Math.cos(t) * 34, 30, H + Math.sin(t) * 30); camera.lookAt(W, 0, H);
    camera.fov = 60; camera.updateProjectionMatrix();
    if (QL.shadows && (QL.frame++ % 30) === 0) renderer.shadowMap.needsUpdate = true;
    renderer.clear(); renderer.render(scene, camera);
    return;
  }
  if ((!GS.paused || MP.on) && GS.state !== 'over') {
    const n = dt > 0.025 ? 2 : 1;
    for (let i = 0; i < n; i++) step(dt / n);
  }
  updateParts(dt); updateBooms(dt);
  for (const t of tracers) if (t.t > 0) { t.t -= dt; if (t.t <= 0) t.m.visible = false; }
  animateActors(dt);
  updateCamera(dt);
  updateHUD(); updateBoard();
  if (!$('buy').classList.contains('hidden') && Math.random() < 0.1) $('buyTime').textContent = GS.mode === 'comp' ? `buy time ${Math.max(0, Math.ceil((GS.state === 'freeze' ? GS.phaseT : 0) + GS.buyLeft))}s` : '';
  if (!$('buy').classList.contains('hidden') && !inBuyZone(GS.player)) toggleBuy();
  if (QL.shadows && (QL.frame++ & 1) === 0) renderer.shadowMap.needsUpdate = true;
  if (!GS.paused && document.visibilityState === 'visible') {
    QL.t += rawDt; QL.n++;
    if (QL.t >= 2) { const fps = QL.n / QL.t; QL.t = 0; QL.n = 0; if (QL.cool > 0) QL.cool--; else if (fps < 48) degrade(); }
  }
  renderer.clear(); renderer.render(scene, camera);
  if (vmRoot.visible && GS.player.alive) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
requestAnimationFrame(frame);

// ---------------- online play helpers ----------------
function startMatchMP(cfg, myIdx, role) {
  MP.on = true; MP.role = role; MP.idx = myIdx; MP.cfg = cfg; MP.nid = 0;
  setMap(cfg.map);
  for (const a of GS.actors) if (a.mesh) scene.remove(a.mesh.g);
  GS.actors = []; clearWorld();
  GS.mode = cfg.mode; GS.score = [0, 0]; GS.loss = [0, 0]; GS.round = 0; GS.lastPlan = null;
  GS.target = GS.mode === 'dm' ? (cfg.length === 'short' ? 40 : 75) : cfg.length === 'short' ? 5 : 9;
  GS.halfAt = GS.target - 1; GS.maxRounds = 2 * (GS.target - 1);
  const botN = [0, 0];
  cfg.slots.forEach((s, i) => {
    const a = new Actor(String(s.n).slice(0, 12), s.sq, i === myIdx);
    a.idx = i; a.side = s.sq; a.human = !s.bot; a.pid = s.bot ? -1 : (s.pid | 0); a.remote = a.human && i !== myIdx;
    if (s.bot && role === 'host') a.brain = newBrain(a, botN[s.sq]++ % 5);
    GS.actors.push(a);
  });
  GS.player = GS.actors[myIdx];
  for (const a of GS.actors) { makeSoldier(a); a.money = 800; }
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing');
  $('again').classList.add('hidden'); $('toLobby').classList.toggle('hidden', role !== 'host');
  GS.paused = false; resetCore(null);
  const P = GS.player; P.alive = false; vmRoot.visible = false;
  if (role === 'host') {
    if (GS.mode === 'comp') startRound();
    else { GS.state = 'live'; GS.roundT = cfg.length === 'short' ? 300 : 480; for (const a of GS.actors) dmSpawn(a); banner('DEATHMATCH', `First squad to ${GS.target} eliminations · B = free guns for 10 s after spawn`); }
  } else GS.state = 'freeze';
  lock();
}
function reviveLocal() {
  const P = GS.player;
  P.hp = 100; P.alive = true; P.act = null; P.blindT = 0; P.reloadT = 0; P.switchT = 0; P.rc = 0; P.scoped = 0; P.rescope = 0; P.roundKills = 0; P.crouch = false; P.crouchAmt = 0; P.tagT = 0; P.onGround = true; P.protT = 0;
  if (P.mesh) P.mesh.g.visible = false;
  vmRoot.visible = true; vmRefresh(); sleeveMat.color.setHex(SIDE_SLEEVE[P.side]); GS.deathT = 0; $('scope').classList.add('hidden');
}
function vmRefresh() { vmId = ''; vmSet(); }
function sleeveTint() { sleeveMat.color.setHex(SIDE_SLEEVE[GS.player.side]); }
function hurtLocal(dmg, att, head) {
  const P = GS.player; if (!P || !P.alive) return;
  hurtFx(dmg, att, null);
  if (head && P.helmet) SFX.armorHit(); else SFX.hurt();
  P.pitch += 0.6 * DEG * Math.min(3, dmg / 20);
}
function remoteShotFx(a, wid, o, d) {
  const def = WD[wid]; if (!def) return;
  const oo = Array.isArray(o) ? V().set(+o[0] || 0, +o[1] || 0, +o[2] || 0) : o.clone();
  const dd = Array.isArray(d) ? V().set(+d[0] || 0, +d[1] || 0, +d[2] || 0) : d.clone();
  if (dd.lengthSq() < 0.01) return; dd.normalize();
  const hw = rayWorld(oo, dd, 220), len = hw ? hw.t : 140;
  if (!def.melee) tracer(oo.clone().addScaledVector(dd, 0.8), oo.clone().addScaledVector(dd, len));
  a.lastShot = GS.time;
  if (a.mesh) { a.mesh.flash.visible = true; a.mesh.flashT = 0.05; a.mesh.flash.material.rotation = Math.random() * 6; }
  if (def.melee) SFX.knife(a.pos, false); else if (def.quiet) SFX.suppressed(a.pos, false); else SFX.shot(def.snd, a.pos, false);
  if (MP.role === 'host' && !def.melee) noiseEvent(a.pos, def.quiet ? 22 : 45, a);
}
function netDetonate(id, type, p, owner) {
  for (let i = GS.nades.length - 1; i >= 0; i--) { const n = GS.nades[i]; if (n.id === id) { scene.remove(n.m); n.m.material.dispose(); GS.nades.splice(i, 1); } }
  detonate({ type, x: +p[0] || 0, y: +p[1] || 0, z: +p[2] || 0, owner: owner || GS.player }, true);
}
function netEvent(d) {
  if (d.e === 'boom') { const c = GS.core, p = c.pos.clone().setY(c.pos.y + 0.5); explosionFx(p, true); SFX.boom(p, true); GS.shake = 1.2; coreMesh.visible = false; }
  else if (d.e === 'go') SFX.countdown(true);
  else if (d.e === 'plant') SFX.plant();
  else if (d.e === 'defused') SFX.defused();
}
function botTakeover(a) {
  a.brain = newBrain(a, a.idx % 5); const b = a.brain;
  if (GS.mode === 'comp') {
    b.home = pick(a.side === 1 ? [...SITES.a.holdsDef, ...SITES.b.holdsDef, ...MID_HOLDS] : SITES[GS.plan].holdsAtk); b.homeSite = null;
    b.route = ROUTES[GS.plan][0].slice(); b.plantCell = pick(SITES[GS.plan].plant);
  }
}

// ---------------- menus ----------------
$('mapSeg').innerHTML = $('onMapSeg').innerHTML = MAP_LIST.map((m) => `<button data-v="${m.id}">${m.name}<small>${m.blurb}</small></button>`).join('');
function syncSeg() {
  document.querySelectorAll('.seg').forEach((seg) => {
    const k = seg.dataset.k; seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(S[k]) === b.dataset.v));
  });
  const comp = S.mode === 'comp';
  $('optSide').style.display = comp ? '' : 'none';
  $('optDiff').style.display = S.mode === 'range' ? 'none' : '';
  $('optLen').style.display = S.mode === 'range' ? 'none' : '';
  $('optLen').querySelectorAll('small')[0].textContent = S.mode === 'dm' ? 'first to 40' : 'first to 5';
  $('optLen').querySelectorAll('small')[1].textContent = S.mode === 'dm' ? 'first to 75' : 'first to 9';
  $('best').textContent = `Record: ${STATS.wins} wins · ${STATS.losses} losses · Aim Range best ${STATS.range}`;
}
document.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  S[seg.dataset.k] = b.dataset.v; saveS(); syncSeg(); initAudio(S.vol); SFX.ui();
  if (seg.dataset.k === 'map') setMap(S.map);
}));
const sliders = [['sSens', 'sens', 'vSens', (v) => v.toFixed(2)], ['sFov', 'fov', 'vFov', (v) => v], ['sVol', 'vol', 'vVol', (v) => Math.round(v * 100) + '%'], ['sXs', 'xhSize', 'vXs', (v) => v], ['sXg', 'xhGap', 'vXg', (v) => v]];
for (const [id, k, vid, f] of sliders) {
  const el = $(id); el.value = S[k]; $(vid).textContent = f(+S[k]);
  el.oninput = () => { S[k] = +el.value; $(vid).textContent = f(S[k]); saveS(); if (k === 'vol') setVolume(S.vol); if (k === 'fov') camera.fov = S.fov; };
}
const XC = ['#4dff7a', '#3df2ff', '#ffe03d', '#ffffff', '#ff5ad1', '#ff4d4d'];
$('sXc').innerHTML = XC.map((c) => `<i style="background:${c}" data-c="${c}" class="${S.xhColor === c ? 'on' : ''}"></i>`).join('');
$('sXc').onclick = (e) => { const c = e.target.dataset.c; if (!c) return; S.xhColor = c; saveS(); [...$('sXc').children].forEach((i) => i.classList.toggle('on', i.dataset.c === c)); };
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('.panel').classList.add('hidden')));
$('openSet').onclick = () => $('setP').classList.remove('hidden');
$('openKeys').onclick = () => $('keysP').classList.remove('hidden');
$('pSet').onclick = () => $('setP').classList.remove('hidden');
$('pKeys').onclick = () => $('keysP').classList.remove('hidden');
$('play').onclick = () => { initAudio(S.vol); startMatch(); };
$('again').onclick = () => { initAudio(S.vol); startMatch(); };
$('resume').onclick = () => { lock(); if (DEBUG || softLock) { GS.paused = false; $('pause').classList.add('hidden'); } };
function toMenu() { if (MPH) MPH.leave(); resetToMenu(); }
function resetToMenu() {
  GS.state = 'menu'; GS.paused = false;
  for (const a of GS.actors) if (a.mesh) scene.remove(a.mesh.g);
  GS.actors = []; clearWorld(); coreMesh.visible = false;
  ['hud', 'pause', 'end', 'buy', 'board', 'clickLock'].forEach((id) => $(id).classList.add('hidden'));
  $('scope').classList.add('hidden'); $('flash').style.opacity = 0; $('smokeV').style.opacity = 0;
  $('menu').classList.remove('hidden'); syncSeg(); document.body.classList.remove('playing'); $('again').classList.remove('hidden'); $('toLobby').classList.add('hidden');
  document.exitPointerLock && document.exitPointerLock();
}
$('quit').onclick = toMenu; $('toMenu').onclick = toMenu;
syncSeg();
coreMesh.visible = false;
$('loading').remove();

if (DEBUG) window.__cs = { MP, get MPH() { return MPH; }, renderer, scene, vmScene, vmCam, GS, S, step, startMatch, keys, mouse, pressed, WD, buy, camera, THREE, D, kill, toMenu, throwNade, damage, eyePos, SITES, zoneAt, cellX, cellZ };

MPH = createOnline({ GS, MP, S, WD, $, MAP_LIST, NAMES, shuffle, pick, angDiff, V3: (x, y, z) => new THREE.Vector3(x, y, z), saveS, syncSeg, initAudio,
  makeSoldier, botTakeover, feedText, banner, toast, slotOK, zoneAt, curW, eyePos, chestPos, damage, footsteps, inBuyZone, buy, startMatchMP, resetToMenu, toMenu,
  spawnNade, netDetonate, remoteShotFx, killFx, hurtLocal, roundEndFx, roundBannerLocal, netEvent, endMatch, moneyPop, reviveLocal, vmRefresh, renderBuy, clearWorld, sleeveTint });
