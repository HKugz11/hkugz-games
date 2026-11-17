// LAST STAND - 3D zombie wave survival with the same guns and maps as Core Strike (Blockade Ops). The zombies are Core Strike soldiers turned green. No blood: zombies pop into cubes.
import * as THREE from './three.module.min.js?v=256';
import { W, H, CS, hPos, WALKABLE, blocked, groundAt, rayWorld, clearLine, astar, cellOf, cellX, cellZ, MAP, MAP_LIST, loadMap } from './map.js?v=256';
import { buildWorld, disposeWorld, soldierParts, soldierPartsLite, tpArms, TP_MUZ, charMat, buildGun, GFX, santaHat } from './art.js?v=1';
import { initAudio, setListener, SFX } from './audio.js?v=1';
import { WD, TPC } from './weapons.js?v=1';
import { makeZombie } from './zombie.js?v=1';

const $ = (id) => document.getElementById(id), QS = new URLSearchParams(location.search);
const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => (v < a ? a : v > b ? b : v), DEG = Math.PI / 180;
const LITE = /\bCrOS\b/.test(navigator.userAgent) || QS.has('lite');
GFX.lite = LITE; GFX.xmas = document.documentElement.classList.contains('xmas');
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('ls.' + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('ls.' + k, JSON.stringify(v)); } catch { } } };

// ---------------- renderer, scene, view-model scene ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LITE ? 1 : 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xd9dfe5, LITE ? 22 : 28, LITE ? 100 : 170);
const camera = new THREE.PerspectiveCamera(85, 1, 0.05, LITE ? 125 : 700); camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10), vmRoot = new THREE.Group();
vmScene.add(vmCam, new THREE.HemisphereLight(0xeef2f6, 0x8a7060, 2.0)); vmCam.add(vmRoot);
const vmSun = new THREE.DirectionalLight(0xffffff, 1.2); vmSun.position.set(1, 2, 1.5); vmScene.add(vmSun);
scene.add(new THREE.HemisphereLight(0xe6edf4, 0xa98670, 1.9));
const sun = new THREE.DirectionalLight(0xfff6ea, 1.45); scene.add(sun, sun.target);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = vmCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const mkTex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const starTex = mkTex((x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,200,80,.9)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  x.fillStyle = g; x.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 10 : 31, a = i * Math.PI / 8; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill(); });
const flashSprite = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.visible = false; return s; };

let WORLD = null;
function applyWorld(id) {
  loadMap(id); if (WORLD) disposeWorld(WORLD.group);
  WORLD = buildWorld(scene);
  sun.target.position.set(W, 0, H); sun.position.copy(sun.target.position).addScaledVector(WORLD.sunDir, 130);
  const fog = GFX.xmas ? 0xdbe7f3 : MAP.theme.fog; scene.fog.color.setHex(fog); renderer.setClearColor(fog);
}

// ---------------- the player ----------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DIFFS = { easy: { hp: 0.75, dmg: 0.7, cnt: 0.8, acc: 0.7 }, normal: { hp: 1, dmg: 1, cnt: 1, acc: 1 }, hard: { hp: 1.3, dmg: 1.3, cnt: 1.2, acc: 1.25 } };
const G = { state: 'menu', diff: store.get('diff', 'normal'), map: store.get('map', 'courtyard'), wave: 0, kills: 0, t: 0, queue: [], spawnT: 0, shake: 0 };
const P = { pos: V(), vy: 0, yaw: 0, pitch: 0, hp: 100, armor: 0, money: 0, prim: null, sec: 'p9', slot: 'sec', ammo: {}, onGround: true, crouch: 0, nextFire: 0, reloadT: 0, shellT: 0, switchT: 0, burstLeft: 0, spray: 0, sprayT: 0, bloom: 0, ads: 0, vel: V(), kick: 0, bob: 0, flashT: 0, speed: 0, last: 'sec' };
const KEYS = {}; let mouseDown = false, justPressed = false;
const curId = () => P[P.slot], curDef = () => WD[curId()];
const mkAmmo = (id) => (P.ammo[id] = { mag: WD[id].mag, res: WD[id].res });

// ---------------- first-person gun ----------------
const GM = {}; let vmCur = null, vmId = '';
function buildVM(id) {
  const ac = new THREE.Color(WD[id].acc || '#ffb13d'), hsl = {}; ac.getHSL(hsl); ac.setHSL(hsl.h, hsl.s * 0.3, Math.min(hsl.l, 0.3));
  const b = buildGun(id, ac.getHex()); const fl = flashSprite(); fl.scale.setScalar(0.28); b.mz.add(fl); b.g.userData.fl = fl; GM[id] = b; return b.g;
}
function vmSet() { const id = curId(); if (!id || id === vmId) return; if (vmCur) vmRoot.remove(vmCur); vmCur = (GM[id] && GM[id].g) || buildVM(id); vmRoot.add(vmCur); vmId = id; }

// ---------------- enemies (Core Strike soldiers) ----------------
const TYPES = {
  // zombies: walkers shuffle at you and bite, spitters lob goo from far away, brutes are big and tough, the Zombie King comes every 5th wave
  rusher: { cls: 'rifle', hp: 45, hpw: 5, spd: 3.6, spdw: 0.07, dmg: 10, rate: 0.8, sc: 1, rew: 80, tint: 0x4f9a3a },
  shooter: { cls: 'rifle', hp: 60, hpw: 6, spd: 3.0, spdw: 0.04, dmg: 7, rate: 1.4, sc: 1, rew: 100, ranged: true, tint: 0x7f9f1f },
  brute: { cls: 'rifle', hp: 240, hpw: 28, spd: 2.8, spdw: 0.02, dmg: 28, rate: 1.1, sc: 1.3, rew: 240, tint: 0x2f6f3a },
  boss: { cls: 'rifle', hp: 900, hpw: 130, spd: 2.6, spdw: 0.01, dmg: 26, rate: 1.2, sc: 1.7, rew: 1500, ranged: true, volley: 3, tint: 0x8fb82a },
};
const tintMats = {}; const matFor = (t) => (tintMats[t] ||= Object.assign(charMat.clone(), { emissive: new THREE.Color(t) }));   // a green glow in the skin turns the dark soldier colours into zombie green
const enemies = [], bits = [], tracers = [], packs = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 1), barBg = new THREE.SpriteMaterial({ color: 0x000000, opacity: 0.55, transparent: true }), barFg = new THREE.SpriteMaterial({ color: 0x4dff7a });
let hatMat = null;
function makeEnemy(type, n) {
  const T = TYPES[type], D = DIFFS[G.diff], kind = { rusher: 'walker', shooter: 'spitter', brute: 'brute', boss: 'king' }[type];
  const Z = makeZombie(kind, (Math.random() * 4) | 0), g = Z.g, head = Z.head, legL = Z.legL, legR = Z.legR;
  const flash = flashSprite(); flash.material.color.set(0x7dff4a); flash.scale.setScalar(0.5); flash.position.set(0, -0.1, -0.34); head.add(flash);   // a green goo splash at the mouth when a spitter spits
  if (GFX.xmas) { hatMat ||= charMat.clone(); const hm = new THREE.Mesh(santaHat(), hatMat); hm.position.y = -0.05; head.add(hm); }
  const bar = new THREE.Group(); bar.position.set(0, 2.15, 0); const bw = 0.9;
  const bg = new THREE.Sprite(barBg), fg = new THREE.Sprite(barFg); bg.scale.set(bw + 0.06, 0.12, 1); fg.center.set(0, 0.5); fg.position.set(-bw / 2, 0, 0.01); fg.scale.set(bw, 0.08, 1); bg.renderOrder = 10; fg.renderOrder = 11; bar.add(bg, fg); bar.visible = false; g.add(bar);
  g.scale.setScalar(T.sc); scene.add(g);
  const hp = (T.hp + T.hpw * n) * D.hp * (type === 'boss' ? 1 : 1);
  const e = { type, T, g, legL, legR, armL: Z.armL, armR: Z.armR, head, up: Z.up, bar, flash, fg, bw, hp, max: hp, pos: V(), yaw: 0, spd: Math.min(6.2, T.spd + T.spdw * n) * (type === 'rusher' ? 1 : 1), dmg: T.dmg * D.dmg * (1 + n * 0.03), nextAtk: rand(0.5, 1.2), path: [], pathT: rand(0, 0.8), ph: rand(0, 6), slow: 0, flashT: 0, strafe: Math.random() < 0.5 ? 1 : -1 };
  enemies.push(e); return e;
}
function spawnEnemy(type) {
  let best = null, bd = -1;
  for (let k = 0; k < 14; k++) {
    const i = WALKABLE[(Math.random() * WALKABLE.length) | 0], x = cellX(i), z = cellZ(i), d = Math.hypot(x - P.pos.x, z - P.pos.z);
    const seen = d < 90 && !rayWorld({ x, y: 1.5, z }, norm3(P.pos.x - x, P.pos.y + 1.5 - 1.5, P.pos.z - z), d);
    const score = d + (seen ? -1000 : 0) + (d < 20 ? -500 : 0);
    if (score > bd) { bd = score; best = [x, z]; }
  }
  const e = makeEnemy(type, G.wave); e.pos.set(best[0], groundAt(best[0], best[1], 5), best[1]); e.g.position.copy(e.pos);
}
function norm3(x, y, z) { const l = Math.hypot(x, y, z) || 1; return { x: x / l, y: y / l, z: z / l }; }
function moveActor(a, dx, dz) { const nx = a.pos.x + dx, nz = a.pos.z + dz; if (!blocked(nx, a.pos.z, a.pos.y)) a.pos.x = nx; if (!blocked(a.pos.x, nz, a.pos.y)) a.pos.z = nz; }

// ---------------- effects ----------------
const bitMats = [0x6fa85a, 0x9bd37f, 0x4a6fa5, 0xe8e4d4].map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
function pop(pos, big, cols = [0, 1, 2, 3]) {
  const n = big ? 22 : 10;
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(boxGeo, bitMats[cols[i % cols.length]]); const s = rand(0.1, big ? 0.3 : 0.2); m.scale.setScalar(s); m.position.set(pos.x + rand(-0.2, 0.2), pos.y + rand(0.2, 1.4), pos.z + rand(-0.2, 0.2)); scene.add(m);
    bits.push({ m, v: V(rand(-4, 4), rand(2, 7), rand(-4, 4)), life: rand(0.9, 1.6), s }); }
}
function puff(p) { for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(boxGeo, bitMats[3]); m.scale.setScalar(0.07); m.position.copy(p); scene.add(m); bits.push({ m, v: V(rand(-2, 2), rand(0, 2.5), rand(-2, 2)), life: 0.5, s: 0.07 }); } }
const trMat = [new THREE.LineBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.8 }), new THREE.LineBasicMaterial({ color: 0x7dff4a, transparent: true, opacity: 0.85 })];
function tracer(a, b, red) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), trMat[red ? 1 : 0]); scene.add(l); tracers.push({ l, life: 0.07 }); }
function updateFX(dt) {
  for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.life -= dt; b.v.y -= 16 * dt; b.m.position.addScaledVector(b.v, dt); const g = groundAt(b.m.position.x, b.m.position.z, 9) + b.s / 2;
    if (b.m.position.y < g) { b.m.position.y = g; b.v.y *= -0.35; b.v.x *= 0.7; b.v.z *= 0.7; } if (b.life < 0.35) b.m.scale.setScalar(Math.max(0.001, b.s * b.life / 0.35)); if (b.life <= 0) { scene.remove(b.m); bits.splice(i, 1); } }
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.life -= dt; if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); tracers.splice(i, 1); } }
  for (let i = packs.length - 1; i >= 0; i--) { const k = packs[i]; k.m.rotation.y += dt * 2; k.m.position.y = k.y + 0.5 + Math.sin(G.t * 3) * 0.1;
    if (Math.hypot(k.m.position.x - P.pos.x, k.m.position.z - P.pos.z) < 1.2) { P.hp = Math.min(100, P.hp + 30); scene.remove(k.m); packs.splice(i, 1); SFX.swap(); toast('+30 health', 900); } }
}
const packMat = new THREE.MeshLambertMaterial({ color: 0x3ddc84, flatShading: true });
function dropPack(pos) { const m = new THREE.Mesh(boxGeo, packMat); m.scale.set(0.45, 0.45, 0.45); m.position.set(pos.x, pos.y + 0.5, pos.z); scene.add(m); packs.push({ m, y: pos.y }); }

// ---------------- shooting ----------------
function raySphere(o, d, cx, cy, cz, r) { const ox = cx - o.x, oy = cy - o.y, oz = cz - o.z, b = ox * d.x + oy * d.y + oz * d.z; if (b < 0) return -1; const c = ox * ox + oy * oy + oz * oz - b * b; return c > r * r ? -1 : b - Math.sqrt(r * r - c); }
function eyePos(o = V()) { return o.set(P.pos.x, P.pos.y + 1.55 - 0.42 * P.crouch, P.pos.z); }
function shoot(def, id) {
  const eye = eyePos(), t = G.t, sp = P.speed / def.speed, scoped = def.scope && P.ads > 0.8;
  let spread = scoped ? def.scopedInacc : def.inacc; if (!def.scope && P.ads > 0.5) spread *= 0.6;
  spread = spread * (P.spray === 0 && def.first ? def.first : 1) + (def.moveInacc * 0.5) * Math.min(1, sp) + (P.onGround ? 0 : def.airInacc * 0.5) + (def.bloom ? P.bloom : 0);
  const n = def.pellets || 1, cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp2 = Math.sin(P.pitch);
  const f = { x: -sy * cp, y: sp2, z: -cy * cp }, right = { x: cy, y: 0, z: -sy }, up = { x: sy * sp2, y: cp, z: cy * sp2 };
  let hitAny = false, headAny = false; const muz = V();
  const hasMz = vmCur && GM[id] && GM[id].g === vmCur; if (hasMz) GM[id].mz.getWorldPosition(muz);
  for (let p = 0; p < n; p++) {
    const th = Math.sqrt(Math.random()) * Math.hypot(def.cone || 0, spread) * DEG, ph = Math.random() * 6.283, a = Math.tan(th) * Math.cos(ph), b = Math.tan(th) * Math.sin(ph);
    const d = norm3(f.x + right.x * a + up.x * b, f.y + up.y * b, f.z + right.z * a + up.z * b);
    const wall = rayWorld(eye, d, 220), tw = wall ? wall.t : 220; let best = null, bt = tw, bh = false;
    for (const e of enemies) {
      const sc = e.T.sc, fx = -Math.sin(e.yaw) * sc, fz = -Math.cos(e.yaw) * sc, th2 = raySphere(eye, d, e.pos.x + fx * 0.23, e.pos.y + 1.5 * sc, e.pos.z + fz * 0.23, 0.27 * sc); let tb = -1;
      for (const [yy, fo] of [[0.35, 0], [0.75, 0.07], [1.1, 0.15]]) { const q = raySphere(eye, d, e.pos.x + fx * fo, e.pos.y + yy * sc, e.pos.z + fz * fo, 0.4 * sc); if (q >= 0 && (tb < 0 || q < tb)) tb = q; }
      const head = th2 >= 0 && (tb < 0 || th2 <= tb + 0.05), tt = head ? th2 : tb; if (tt >= 0 && tt < bt) { bt = tt; best = e; bh = head; }
    }
    const end = V(eye.x + d.x * bt, eye.y + d.y * bt, eye.z + d.z * bt); if (p < 4 && hasMz) tracer(muz, end, false);
    if (best) { const dist = bt, dmg = def.dmg * (bh ? 4 : 1) * Math.pow(def.range, dist / 10); hurtEnemy(best, dmg, bh, def); hitAny = true; headAny ||= bh; }
    else if (wall) puff(end);
  }
  if (hitAny) { const hm = $('hm'); hm.className = 'on' + (headAny ? ' head' : ''); clearTimeout(hm._t); hm._t = setTimeout(() => (hm.className = ''), 90); headAny ? SFX.head() : SFX.hit(); }
  // sound, recoil, flash
  def.quiet ? SFX.suppressed(P.pos, true) : SFX.shot(def.snd, P.pos, true);
  const pat = def.pat, i = Math.min(P.spray, pat.length - 2), k = (def.scope ? 0.7 : 0.55);
  P.pitch += (pat[i + 1][0] - pat[i][0]) * DEG * k; P.yaw -= (pat[i + 1][1] - pat[i][1]) * DEG * k; P.spray++; P.sprayT = 0.35; if (def.bloom) P.bloom = Math.min(4, P.bloom + def.bloom * 10);
  P.kick = Math.min(1, P.kick + 0.15 + def.recoil * 0.14); P.flashT = 0.05; if (vmCur) vmCur.userData.fl.visible = true; G.shake = Math.max(G.shake, def.recoil * 0.004);
}
function hurtEnemy(e, dmg, head, def) {
  e.hp -= dmg; if (def && def.stagger) e.slow = def.stagger; e.fg.scale.x = Math.max(0.001, e.bw * e.hp / e.max);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  const i = enemies.indexOf(e); if (i < 0) return; enemies.splice(i, 1); scene.remove(e.g);
  pop(e.pos, e.type === 'boss' || e.type === 'brute'); SFX.pop(e.pos); SFX.kill(); P.money += e.T.rew; G.kills++;
  if (Math.random() < (e.type === 'boss' ? 1 : e.type === 'brute' ? 0.4 : 0.12)) dropPack(e.pos); if (e.type === 'boss') toast('BOSS DOWN! +$' + e.T.rew, 2000); hud();
}
function reload() { const id = curId(), def = curDef(), a = P.ammo[id]; if (!def.mag || P.reloadT > 0 || a.mag >= def.mag || a.res <= 0 || P.switchT > 0) return; P.reloadT = def.shell ? 99 : def.reload; P.shellT = def.shell || 0; P.burstLeft = 0; SFX.reload(0); }
function updateWeapon(dt) {
  const id = curId(), def = curDef(), a = P.ammo[id]; P.switchT = Math.max(0, P.switchT - dt); P.nextFire -= 0;
  P.sprayT -= dt; if (P.sprayT <= 0) { P.spray = 0; P.bloom = Math.max(0, P.bloom - dt * 6); }
  if (P.reloadT > 0) {
    if (def.shell) { P.shellT -= dt; if (P.shellT <= 0 && a.res > 0 && a.mag < def.mag) { a.mag++; a.res--; P.shellT = def.shell; SFX.reload(1); } if (a.mag >= def.mag || a.res <= 0) P.reloadT = 0; }
    else { P.reloadT -= dt; if (P.reloadT <= 0) { const take = Math.min(def.mag - a.mag, a.res); a.mag += take; a.res -= take; SFX.reload(1); hud(); } }
  }
  if (justPressed && def.burst && P.burstLeft === 0) P.burstLeft = def.burst;
  const want = (mouseDown && def.auto) || justPressed || P.burstLeft > 0;
  if (want && G.t >= P.nextFire && P.switchT <= 0 && (P.reloadT <= 0 || def.shell)) {
    if (a.mag <= 0) { if (justPressed) SFX.dry(); P.burstLeft = 0; if (a.res > 0) reload(); }
    else {
      if (def.shell) P.reloadT = 0; a.mag--; P.nextFire = G.t + 60 / def.rpm; shoot(def, id);
      if (def.burst) { P.burstLeft = Math.max(0, P.burstLeft - 1); if (P.burstLeft === 0) P.nextFire = G.t + (def.burstGap || 0.2); }
      hud(); if (a.mag === 0 && a.res > 0) setTimeout(reload, 250);
    }
  }
  justPressed = false;
  const scoped = def.scope && P.ads > 0.85; $('scope').classList.toggle('hide', !scoped); if (vmCur) vmRoot.visible = !scoped;
}
function equip(slot) { if (!P[slot] || P.slot === slot) return; P.last = P.slot; P.slot = slot; P.switchT = WD[P[slot]].draw || 0.4; P.reloadT = 0; P.burstLeft = 0; SFX.swap(); vmSet(); hud(); }

// ---------------- enemy brains ----------------
function eyeOf(e) { return { x: e.pos.x, y: e.pos.y + 1.45 * e.T.sc, z: e.pos.z }; }
function canSee(e) { const o = eyeOf(e), tx = P.pos.x, ty = P.pos.y + 1.4, tz = P.pos.z, d = Math.hypot(tx - o.x, ty - o.y, tz - o.z); return !rayWorld(o, norm3(tx - o.x, ty - o.y, tz - o.z), d); }
function hurtPlayer(dmg) {
  if (G.state !== 'play') return; if (P.armor > 0) { const ab = Math.min(P.armor, dmg * 0.5); P.armor -= ab; dmg -= ab; }
  P.hp -= dmg; SFX.hurt(); $('vig').style.opacity = 1; G.shake = Math.max(G.shake, 0.02); hud(); if (P.hp <= 0) die();
}
let pathBudget = 0;
function updateEnemies(dt) {
  pathBudget = 3; const D = DIFFS[G.diff];
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i], T = e.T, dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dist = Math.hypot(dx, dz) || 0.01; e.slow = Math.max(0, e.slow - dt); e.nextAtk -= dt; e.pathT -= dt; e.flashT -= dt; e.flash.visible = e.flashT > 0;
    let spd = e.spd * (e.slow > 0 ? 0.4 : 1), tx = P.pos.x, tz = P.pos.z, stop = false;
    const clear = dist < 30 && clearLine(e.pos.x, e.pos.z, P.pos.x, P.pos.z);
    if (!clear) { // walk round the walls with A*
      if (e.pathT <= 0 && pathBudget > 0) { pathBudget--; e.pathT = rand(0.7, 1.1); e.path = astar(cellOf(e.pos.x, e.pos.z), cellOf(P.pos.x, P.pos.z)); }
      while (e.path.length > 1 && Math.hypot(cellX(e.path[0]) - e.pos.x, cellZ(e.path[0]) - e.pos.z) < 1.1) e.path.shift();
      if (e.path.length) { tx = cellX(e.path[0]); tz = cellZ(e.path[0]); }
    } else e.path.length = 0;
    let sdx = tx - e.pos.x, sdz = tz - e.pos.z, sd = Math.hypot(sdx, sdz) || 1; sdx /= sd; sdz /= sd;
    if (T.ranged && clear) { if (dist < 8) { sdx = -sdx; sdz = -sdz; } else if (dist < 16) { const s = e.strafe; [sdx, sdz] = [-sdz * s, sdx * s]; spd *= 0.6; if (Math.random() < 0.01) e.strafe = -e.strafe; } }
    if (!T.ranged && dist < 1.3 && e.type !== 'boss') stop = true;
    if (!stop) moveActor(e, sdx * spd * dt, sdz * spd * dt);
    for (let j = i + 1; j < enemies.length; j++) { const o = enemies[j], ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = Math.hypot(ox, oz); if (od < 0.9 && od > 0.001) { const pu = (0.9 - od) * 0.5 * Math.min(1, dt * 12); moveActor(e, ox / od * pu, oz / od * pu); moveActor(o, -ox / od * pu, -oz / od * pu); } }
    e.pos.y = groundAt(e.pos.x, e.pos.z, e.pos.y);
    const wantYaw = Math.atan2(-dx, -dz); let dy = wantYaw - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += dy * Math.min(1, dt * 10);
    e.ph += spd * dt * 2.2; const sw = Math.sin(e.ph) * 0.7 * Math.min(1, spd / 3); e.legL.rotation.x = sw; e.legR.rotation.x = -sw; e.armL.rotation.x = 1.45 + Math.sin(e.ph * 0.5) * 0.14; e.armR.rotation.x = 1.45 - Math.sin(e.ph * 0.5) * 0.14; e.head.rotation.z = 0.12 + Math.sin(e.ph * 0.5) * 0.07;
    e.bar.visible = e.hp < e.max && dist > 2.2; if (e.bar.visible) e.bar.scale.setScalar(clamp(dist / 8, 0.35, 1.5) / T.sc);   // health bars only after a hit, and they shrink when the zombie is close
    e.g.position.set(e.pos.x, e.pos.y + Math.abs(Math.sin(e.ph)) * 0.04, e.pos.z); e.g.rotation.set(0, e.yaw, Math.sin(e.ph * 0.5) * 0.03);   // a zombie shuffle: a little sway
    // attacks
    if (e.nextAtk <= 0) {
      if (dist < 1.5 * T.sc + 0.3 && Math.abs(P.pos.y - e.pos.y) < 1.4) { hurtPlayer(e.dmg); e.nextAtk = T.rate; }
      else if (T.ranged && clear && dist < 28 && canSee(e)) {
        e.nextAtk = T.rate * rand(0.9, 1.3) / Math.sqrt(D.acc); e.flashT = 0.07; const n = T.volley || 1, o = eyeOf(e);
        for (let k = 0; k < n; k++) { const hit = Math.random() < clamp(0.7 - dist * 0.02, 0.12, 0.65) * D.acc; const tgt = V(P.pos.x + (hit ? 0 : rand(-1.2, 1.2)), P.pos.y + 1.1, P.pos.z + (hit ? 0 : rand(-1.2, 1.2))); tracer(V(o.x, o.y - 0.2, o.z), tgt, true); if (hit) hurtPlayer(e.dmg * (n > 1 ? 0.45 : 1)); }
        SFX.bounce(e.pos);
      } else e.nextAtk = 0.15;
    }
  }
}

// ---------------- waves ----------------
function startWave(n) {
  G.wave = n; const D = DIFFS[G.diff], total = Math.round(Math.min(44, 5 + 3 * n) * D.cnt), q = [];
  for (let i = 0; i < total; i++) { const r = Math.random(); q.push(n >= 4 && r < Math.min(0.28, (n - 3) * 0.05) ? 'brute' : n >= 2 && r < 0.55 ? 'shooter' : 'rusher'); }
  if (n % 5 === 0) q.unshift('boss'); G.queue = q; G.spawnT = 1.5; G.state = 'play';
  toast('WAVE ' + n, 2200, n % 5 === 0 ? 'The Zombie King is coming!' : ''); hud();
}
function waveClear() {
  const bonus = 300 + 50 * G.wave; P.money += bonus; P.hp = Math.min(100, P.hp + 40); for (const id of [P.prim, P.sec]) if (id) P.ammo[id].res = WD[id].res;
  store.set('best', Math.max(store.get('best', 0), G.wave)); G.state = 'shop'; document.exitPointerLock?.(); openShop(`WAVE ${G.wave} CLEARED`, `+$${bonus} bonus · ammo refilled · +40 health`);
}
function updateWaves(dt) {
  const D = DIFFS[G.diff], maxAlive = Math.min(18, 8 + G.wave); G.spawnT -= dt;
  if (G.queue.length && enemies.length < maxAlive && G.spawnT <= 0) { spawnEnemy(G.queue.shift()); G.spawnT = Math.max(0.4, 1.4 - G.wave * 0.06); hud(); }
  if (!G.queue.length && !enemies.length && G.state === 'play') waveClear();
}

// ---------------- shop ----------------
function statLine(d) { return `${d.dmg}${d.pellets ? '×' + d.pellets : ''} dmg · ${d.mag} rounds · ${d.auto ? 'auto' : d.burst ? 'burst' : d.shell && d.rpm < 100 ? 'pump' : d.scope && d.rpm < 100 ? 'bolt' : 'semi'}`; }
function openShop(title, info) {
  $('shopT').textContent = title; $('shopInfo').textContent = info; $('hud').classList.add('hide'); document.body.classList.remove('playing'); $('scope').classList.add('hide'); show('shop'); renderShop();
}
function renderShop() {
  $('shopMoney').textContent = '$' + Math.floor(P.money); const box = $('items'); box.textContent = '';
  const add = (name, tag, stat, desc, price, owned, fn) => { const have = tag === 'GEAR' ? 'You have it' : 'Equipped'; const d = document.createElement('div'); d.className = 'it' + (owned ? ' own' : '');
    d.innerHTML = `<span class="tag">${tag}</span><h4></h4><span class="st"></span><p></p>`; d.querySelector('h4').textContent = name; d.querySelector('.st').textContent = stat; d.querySelector('p').textContent = desc;
    const b = document.createElement('button'); b.textContent = owned ? have : '$' + price; b.disabled = owned || P.money < price; b.onclick = () => { fn(); renderShop(); }; d.appendChild(b); box.appendChild(d); };
  add('Body armor', 'GEAR', '+100 armor', 'Soaks up half of the damage you take.', 650, P.armor >= 100, () => { P.money -= 650; P.armor = 100; });
  add('Medkit', 'GEAR', 'full health', 'Back to 100 health.', 300, P.hp >= 100, () => { P.money -= 300; P.hp = 100; });
  const ids = Object.keys(WD).filter((k) => WD[k].mag && WD[k].price).sort((a, b) => WD[a].price - WD[b].price);
  for (const id of ids) { const d = WD[id]; add(d.name, d.slot === 'prim' ? 'PRIMARY' : 'PISTOL', statLine(d), d.desc, d.price, P[d.slot] === id, () => { P.money -= d.price; P[d.slot] = id; mkAmmo(id); if (P.slot === d.slot) { vmId = ''; vmSet(); } else equip(d.slot); }); }
}

// ---------------- HUD / screens ----------------
let toastT = 0;
function toast(t, ms = 1500, small = '') { const m = $('msg'); m.innerHTML = t + (small ? `<small>${small}</small>` : ''); m.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => m.classList.remove('on'), ms); }
function hud() {
  const id = curId(), def = curDef(), a = P.ammo[id];
  $('wave').textContent = 'WAVE ' + G.wave; $('left').textContent = (enemies.length + G.queue.length) + ' zombies left'; $('money').textContent = '$' + Math.floor(P.money);
  $('hp').firstChild.style.width = clamp(P.hp, 0, 100) + '%'; $('hpT').textContent = Math.ceil(Math.max(0, P.hp)) + ' health'; $('armor').firstChild.style.width = clamp(P.armor, 0, 100) + '%';
  $('gname').textContent = def.name; $('mag').textContent = a.mag; $('res').textContent = '/ ' + a.res;
  $('slots').textContent = (P.prim ? '[1] ' + WD[P.prim].name + '   ' : '') + '[2] ' + WD[P.sec].name;
}
function show(id) { for (const s of ['menu', 'shop', 'pause', 'dead']) $(s).classList.toggle('hide', s !== id); }
function lock() { try { const r = canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => { }); } catch { } }
function begin() {
  initAudio(0.7); applyWorld(G.map); for (const e of enemies) scene.remove(e.g); enemies.length = 0; for (const b of bits) scene.remove(b.m); bits.length = 0; for (const k of packs) scene.remove(k.m); packs.length = 0;
  Object.assign(P, { hp: 100, armor: 0, money: 1000, prim: null, sec: 'p9', slot: 'sec', last: 'sec', ammo: {}, vy: 0, yaw: 0, pitch: 0, reloadT: 0, burstLeft: 0, spray: 0, ads: 0, switchT: 0.2 }); mkAmmo('p9');
  const c = cellOf(W, H), i = WALKABLE.includes(c) ? c : WALKABLE.reduce((b, k) => (Math.hypot(cellX(k) - W, cellZ(k) - H) < Math.hypot(cellX(b) - W, cellZ(b) - H) ? k : b), WALKABLE[0]);
  P.pos.set(cellX(i), groundAt(cellX(i), cellZ(i), 5), cellZ(i)); G.kills = 0; vmId = ''; vmSet(); startPlay(1);
}
function startPlay(n) { show(''); $('hud').classList.remove('hide'); document.body.classList.add('playing'); lock(); startWave(n); }
function die() {
  G.state = 'dead'; document.exitPointerLock?.(); document.body.classList.remove('playing'); $('hud').classList.add('hide'); $('scope').classList.add('hide');
  const reached = Math.max(0, G.wave - 1), best = Math.max(store.get('best', 0), reached); store.set('best', best);
  $('deadT').textContent = `You reached wave ${G.wave}. ${G.kills} zombies popped. Best: wave ${best}.`; show('dead'); pop(P.pos, false);
}
function pause() { if (G.state !== 'play') return; G.state = 'pause'; document.body.classList.remove('playing'); $('scope').classList.add('hide'); show('pause'); }
function toMenu() { G.state = 'menu'; document.exitPointerLock?.(); document.body.classList.remove('playing'); $('hud').classList.add('hide'); $('scope').classList.add('hide'); $('best').textContent = store.get('best', 0) ? 'Best so far: wave ' + store.get('best', 0) : ''; show('menu'); }

// menu wiring
const sel = $('mapSel'); for (const m of MAP_LIST) sel.add(new Option(m.name + ' - ' + m.blurb, m.id)); if (!MAP_LIST.some((m) => m.id === G.map)) G.map = 'courtyard'; sel.value = G.map; sel.onchange = () => { G.map = sel.value; store.set('map', G.map); };
const dbtn = [...document.querySelectorAll('[data-d]')]; const setD = (d) => { G.diff = d; store.set('diff', d); dbtn.forEach((b) => b.classList.toggle('on', b.dataset.d === d)); }; dbtn.forEach((b) => (b.onclick = () => setD(b.dataset.d))); setD(G.diff);
$('play').onclick = () => begin(); $('again').onclick = () => begin(); $('toMenu').onclick = toMenu; $('quit').onclick = toMenu;
$('next').onclick = () => { G.state = 'play'; startPlay(G.wave + 1); };
$('resume').onclick = () => { G.state = 'play'; show(''); document.body.classList.add('playing'); lock(); };
toMenu();

// ---------------- input ----------------
addEventListener('keydown', (e) => {
  KEYS[e.code] = true; if (G.state !== 'play') return;
  if (e.code === 'KeyR') reload(); else if (e.code === 'Digit1') equip('prim'); else if (e.code === 'Digit2') equip('sec'); else if (e.code === 'KeyQ') equip(P.last === P.slot ? (P.slot === 'sec' ? 'prim' : 'sec') : P.last);
  else if (e.code === 'KeyP') { document.exitPointerLock?.(); pause(); } if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
});
addEventListener('keyup', (e) => (KEYS[e.code] = false));
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; mouseDown = false; });
addEventListener('mousedown', (e) => { if (G.state !== 'play') return; if (document.pointerLockElement !== canvas) { lock(); return; } if (e.button === 0) { mouseDown = true; justPressed = true; } if (e.button === 2) P.adsHold = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) P.adsHold = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (G.state === 'play') equip(P.slot === 'sec' ? 'prim' : 'sec'); });
addEventListener('mousemove', (e) => { if (G.state !== 'play' || document.pointerLockElement !== canvas) return; const k = 0.0022 * (camera.fov / 85); P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.5, 1.5); });
document.addEventListener('pointerlockchange', () => { if (G.state === 'play' && document.pointerLockElement !== canvas) pause(); });

// ---------------- main loop ----------------
function updatePlayer(dt) {
  const def = curDef(), fw = (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0), st = (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0);
  P.crouch += ((KEYS.KeyC || KEYS.ControlLeft ? 1 : 0) - P.crouch) * Math.min(1, dt * 12); P.ads += ((P.adsHold ? 1 : 0) - P.ads) * Math.min(1, dt * 14);
  let sp = (def.speed || 6.5) * (1 - 0.45 * P.crouch) * (1 - 0.3 * P.ads); const l = Math.hypot(fw, st) || 1, cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
  const wx = (-sy * fw + cy * st) / l, wz = (-cy * fw - sy * st) / l;
  P.vel.x += (wx * sp - P.vel.x) * Math.min(1, dt * (P.onGround ? 14 : 3)); P.vel.z += (wz * sp - P.vel.z) * Math.min(1, dt * (P.onGround ? 14 : 3));
  moveActor(P, P.vel.x * dt, P.vel.z * dt); P.speed = Math.hypot(P.vel.x, P.vel.z);
  if (KEYS.Space && P.onGround) { P.vy = 6.4; P.onGround = false; } P.vy -= 20 * dt; P.pos.y += P.vy * dt;
  const g = groundAt(P.pos.x, P.pos.z, P.pos.y); if (P.pos.y <= g) { if (!P.onGround && P.vy < -6) SFX.land(P.pos); P.pos.y = g; P.vy = 0; P.onGround = true; } else if (P.pos.y > g + 0.05) P.onGround = false;
  // keep the player off the soldiers' toes
  for (const e of enemies) { const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz), r = 0.6 * e.T.sc; if (d < r && d > 0.001) moveActor(P, dx / d * (r - d), dz / d * (r - d)); }
}
function updateCamera(dt) {
  const def = curDef(), gm = GM[curId()], A = P.ads;
  camera.position.set(P.pos.x, P.pos.y + 1.55 - 0.42 * P.crouch, P.pos.z);
  G.shake *= Math.exp(-dt * 9); camera.rotation.set(P.pitch + (Math.random() - 0.5) * G.shake, P.yaw + (Math.random() - 0.5) * G.shake, 0);
  const zoom = def.scope ? (def.zoomLv ? 36 : 24) : gm ? 85 / (gm.ads ? gm.ads[1] : 1.2) : 70; const fov = 85 + (zoom - 85) * A; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (WORLD.sky) WORLD.sky.position.copy(camera.position);
  $('vig').style.opacity = Math.max(0, parseFloat($('vig').style.opacity || 0) - dt * 1.4);
  if (!vmCur || !gm) return;
  P.kick = Math.max(0, P.kick - dt * 7); P.bob += P.speed * dt * 1.6; const bobA = P.onGround ? Math.min(1, P.speed / 6) : 0, sec = def.slot === 'sec', sw = clamp(P.switchT / 0.4, 0, 1);
  const rl = P.reloadT > 0 && !def.shell ? Math.sin(clamp(1 - P.reloadT / def.reload, 0, 1) * Math.PI) : 0, bx = sec ? 0.095 : 0.17, by = sec ? -0.12 : -0.16, bz = sec ? -0.36 : -0.42;
  vmRoot.position.set((bx + Math.sin(P.bob) * 0.012 * bobA) * (1 - A), (by - Math.abs(Math.cos(P.bob)) * 0.01 * bobA - sw * 0.25 - rl * 0.08) * (1 - A) + -gm.sy * A, (bz + P.kick * 0.07) * (1 - A) + (gm.ads ? gm.ads[0] : -0.42) * A + P.kick * 0.04 * A);
  vmRoot.rotation.set(P.kick * (def.scope ? 0.25 : 0.1) - rl * 0.6, (sec ? 0.1 : 0.14) * (1 - A), rl * 0.5);
  if (P.flashT > 0) { P.flashT -= dt; if (P.flashT <= 0) vmCur.userData.fl.visible = false; }
}
function step(dt) {
  if (G.state === 'play') { G.t += dt; updatePlayer(dt); updateWeapon(dt); updateEnemies(dt); updateWaves(dt); setListener(P.pos.x, P.pos.y + 1.5, P.pos.z, P.yaw); }
  updateFX(dt); updateCamera(dt);
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (WORLD && (G.state === 'play' || G.state === 'pause' || G.state === 'dead' || G.state === 'shop')) step(dt);
  else if (WORLD) { G.t += dt; camera.rotation.y += dt * 0.1; camera.position.set(W, 12, H); camera.rotation.set(-0.35, G.t * 0.1, 0); if (WORLD.sky) WORLD.sky.position.copy(camera.position); }
  renderer.clear(); renderer.render(scene, camera); if (G.state === 'play' && vmCur && vmRoot.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
applyWorld(G.map); P.pos.set(W, 0, H); requestAnimationFrame(frame);
window.__LS = { G, P, enemies, WD, begin, startWave, killEnemy, press: (v) => { mouseDown = v; if (v) justPressed = true; }, equip, step, vmSet: () => { vmId = ''; vmSet(); } };   // handy for testing in the browser console
