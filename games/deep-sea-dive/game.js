// game.js - the main program. It builds the 3D scene, reads the keyboard and mouse, moves the diver, runs the air meter and
// depth zones, and switches between the screens (boat menu, shop, Fish-dex, sell, summary).
// Other files: data.js (fish + shop numbers), world.js (the ocean), diver.js, boat.js, audio.js, save.js.
import * as THREE from './three.module.min.js';
import { TOUCH, initTouch } from './touch.js?v=2';
import { clamp, lerp, smooth } from './util.js?v=2';
import { RARITY, ZONES, zoneAt, FISH, fishById, GEAR, TUNE } from './data.js?v=2';
import { save, settings, load, persist, flush, saveSettings } from './save.js?v=2';
import { World, heightAt, depthAt, WORLD_EDGE } from './world.js?v=2';
import { Diver } from './diver.js?v=2';
import { Boat } from './boat.js?v=2';
import { FishField } from './fish.js?v=2';
import { renderIcons } from './icons.js?v=2';
import { createUI } from './ui.js?v=2';
import { Sharks } from './sharks.js?v=2';
import { Aquarium } from './aquarium.js?v=2';
import { icon, fillIcons } from './symbols.js?v=2';
import { Sound } from './audio.js?v=2';
import { makeBubbles, emitBubble, updateBubbles, U } from './shaders.js?v=2';

fillIcons();                       // draw the icons in the page (see symbols.js)
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug');
load();                       // read the saved game and settings first
const LITE = Q.has('lite') || /CrOS/.test(navigator.userAgent) || settings.lite;   // Lite graphics: for Chromebooks and slow computers
const $ = id => document.getElementById(id);
const sound = new Sound();

// ================================================================================================ scene
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LITE ? 1 : 1.75));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1d8fcf, 0.01);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1800);
const world = new World(scene, LITE);
const boat = new Boat(); scene.add(boat.group, boat.anchor);
const diver = new Diver(); scene.add(diver.group);
const bubbles = makeBubbles(60); scene.add(bubbles);
const fish = new FishField(scene, LITE);                       // all the fish in the ocean (see fish.js and the FISH list in data.js)
const aquarium = new Aquarium(boat);                               // the fish tank on the boat deck
const sharks = new Sharks(scene, LITE, {                         // the sharks (see sharks.js). They tell us when they spot or bite the diver.
  onSpot: s => { if (!run || state !== 'dive') return; banner('SHARK!', s.def.name + ' is coming for you!', '#ff5a5a'); sound.warnSting(); },
  onBite: s => biteDiver(s),
});
let sharkInfo = { nearest: 1e9, chasing: false }, hiddenKind = null, lastHide = null;
let icons = null;                                               // little pictures of every fish, drawn the first time they're needed
const getIcons = () => icons || (icons = renderIcons(renderer));

// The flashlight (a spotlight that follows where you look)
const spot = new THREE.SpotLight(0xdff4ff, 0, 40, 0.45, 0.55, 1);
const spotTarget = new THREE.Object3D(); scene.add(spot, spotTarget); spot.target = spotTarget;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 85 : 70; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ================================================================================================ game state
let state = 'title';          // title | boat | plan | shop | dex | sell | summary | settings | dive | pause
let run = null;               // the dive in progress (air, fish in the bag...)
const P = {                   // the player
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, r: 0.45,
  mYaw: 0, mPitch: 0,         // the diver model's smoothed facing
  speed01: 0, surface: false,
};
const cam = { yaw: 0.9, pitch: 0.28, auto: true, drag: false, dist: [3.4, 5.2, 8][settings.camDist], view: 'third' };
const keys = {};
let locked = false, started = false, timeNow = 0, torch = true, tool = 'net';   // tool: 'net' or 'spear'

// the gear you own, as numbers
const lvl = k => save.gear[k];
const suitInfo = () => GEAR.suit.levels[lvl('suit')];
const tankAir = () => GEAR.tank.levels[lvl('tank')].air;
const dirFrom = (yaw, pitch, out = new THREE.Vector3()) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

// ================================================================================================ small UI helpers
function toast(text, color) {
  const d = document.createElement('div'); d.className = 'msg'; d.textContent = text; if (color) d.style.color = color;
  $('msgs').appendChild(d); setTimeout(() => d.remove(), 2900);
  while ($('msgs').children.length > 4) $('msgs').firstChild.remove();
}
function banner(text, sub, color) {
  const b = $('banner'); b.innerHTML = text + (sub ? '<small>' + sub + '</small>' : ''); b.style.color = color || '';
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
}
const SCREENS = ['title', 'boatMenu', 'plan', 'shop', 'dex', 'sell', 'summary', 'settings', 'pause'];
function show(id) { for (const s of SCREENS) $(s).classList.toggle('hide', s !== id); }
function fadeTo(fn) {   // a quick fade to dark, run fn while it's dark, fade back
  const f = $('fade'); f.style.opacity = 1;
  setTimeout(() => { fn(); setTimeout(() => { f.style.opacity = 0; }, 80); }, 360);
}
const money = n => Math.floor(n).toLocaleString();

// ================================================================================================ boat menu
function goBoat() {
  state = 'boat'; aquarium.refresh(save.dex);
  show('boatMenu'); $('hud').classList.add('hide');
  diver.setPose('stand'); diver.setTool('net'); diver.group.rotation.set(0, 0.5, 0);
  refreshBoatMenu();
}
function refreshBoatMenu() {
  $('bmCoins').textContent = money(save.coins);
  const fishInHold = Object.values(save.hold).reduce((a, b) => a + b, 0);
  $('bmSellInfo').textContent = fishInHold ? fishInHold + ' fish' : '';
  $('bmDiveInfo').textContent = '';
  const found = FISH.filter(f => save.dex[f.id]).length;
  $('bmDexInfo').textContent = found + ' / ' + FISH.length;
  $('bmShopInfo').textContent = '';
  $('bmSellInfo').textContent = fishInHold ? fishInHold + ' fish · $' + money(Object.keys(save.hold).reduce((a, id) => a + (fishById(id) ? fishById(id).value * save.hold[id] : 0), 0)) : '';
}

// ================================================================================================ the dive plan screen
function zoneStatus(z) {
  const needs = [];
  if (z.needSuit > lvl('suit')) needs.push('a ' + GEAR.suit.levels[z.needSuit].name);
  if (z.needLight > lvl('light')) needs.push('a ' + GEAR.light.levels[z.needLight].name + ' (or better)');
  return needs;
}
function openPlan() {
  state = 'plan'; show('plan');
  $('planZones').innerHTML = ZONES.map(z => {
    const needs = zoneStatus(z);
    const col = ['#43e0ff', '#2a8cff', '#5a46d8', '#a020a0'][z.id];
    return `<div class="zone"><div class="zc" style="background:${col}"></div><div><b>${z.name}</b> <span style="opacity:.7;font-size:13px">${z.top}-${z.bottom} m</span><small>${z.blurb}</small>` +
      (needs.length ? `<span class="need">Needs ${needs.join(' and ')}</span>` : `<span class="need ok">You are ready for this zone</span>`) +
      `</div><div class="st ${needs.length ? 'no' : 'ok'}">${needs.length ? 'NOT YET' : 'READY'}</div></div>`;
  }).join('');
  const air = tankAir();
  $('planGear').innerHTML = `<b>Your gear:</b> ${GEAR.suit.levels[lvl('suit')].name} · ${GEAR.flippers.levels[lvl('flippers')].name} · ${GEAR.tank.levels[lvl('tank')].name} (${air} air) · ${GEAR.net.levels[lvl('net')].name}` +
    (lvl('light') ? ' · ' + GEAR.light.levels[lvl('light')].name : '') + (lvl('gun') ? ' · ' + GEAR.gun.levels[lvl('gun')].name : '') +
    `<br><span class="fine">Bag holds ${GEAR.bag.levels[lvl('bag')].cap} fish. If you run out of air you black out and lose the fish from this dive (not your coins or gear).</span>`;
}

// ================================================================================================ starting and ending a dive
function startDive() {
  sound.start();
  lockPointer();
  fadeTo(() => {
    state = 'dive'; started = true;
    show(null); $('hud').classList.remove('hide'); $('title').classList.add('hide');
    run = { air: tankAir(), airMax: tankAir(), netCD: 0, spearCD: 0, repelT: 0, bites: 0, ammo: Math.min(save.spears, GEAR.gun.levels[lvl('gun')].ammo + GEAR.quiver.levels[lvl('quiver')].extra), bag: [], t: 0, deepest: 0, lostAir: 0, zone: 0, coldT: 0, bites: 0, warned: {} };
    P.pos.set(-6.2, -0.15, 3.0); P.vel.set(0, 0, 0); P.yaw = 0.2; P.pitch = -0.1; P.mYaw = P.yaw; P.mPitch = 0;
    cam.dist = [3.4, 5.2, 8][settings.camDist];
    diver.setGear(save.gear); diver.setPose('swim'); setTool('net');
    save.stats.dives++; persist();
    sound.splash();
    if (!locked && !DEBUG && !TOUCH) $('lockhint').classList.remove('hide');
    banner('DIVE!', 'Swim down to find fish. Watch your air!', '#37d6e8');
    if (save.stats.dives <= 2) setTimeout(() => { if (state === 'dive') toast(TOUCH ? 'Stick = swim · UP / DOWN · USE catches fish' : 'WASD swim · Space up · Shift down · Click catches fish', '#ffd34e'); }, 1800);
  });
}
function endDive(kind) {
  if (!run) return;
  const r = run; run = null;
  state = 'summary';
  unlockPointer();
  $('hud').classList.add('hide'); $('lockhint').classList.add('hide');
  let title, sub = '', list = '';
  if (kind === 'blackout') {
    title = 'You blacked out!'; sub = 'Your air ran out. A lifeguard rescued you and took you back to the boat. The fish you caught on this dive are gone, but you keep your coins and gear.';
    save.stats.blackouts++;
  } else {
    title = kind === 'quit' ? 'Dive cancelled' : 'Dive complete!';
    sub = r.bag.length ? 'You swam back to the boat with ' + r.bag.length + ' fish. Sell them to earn coins!' : 'You came back with no fish this time.';
    const counts = {};
    for (const id of r.bag) { save.hold[id] = (save.hold[id] || 0) + 1; counts[id] = (counts[id] || 0) + 1; }
    list = ui.fishRows(counts);
  }
  save.stats.deepest = Math.max(save.stats.deepest, Math.floor(r.deepest));
  sub += ` Deepest point: ${Math.floor(r.deepest)} m.`;
  persist(); flush();
  $('smTitle').textContent = title; $('smSub').textContent = sub; $('smList').innerHTML = list;
  show('summary');
  $('black').style.opacity = 0;
  diver.setPose('stand');
  state = 'summary';
}

// ================================================================================================ pointer lock + input
function lockPointer() {
  if (DEBUG || TOUCH) { locked = true; return; }
  try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { canvas.requestPointerLock(); } catch (e) {} }); } catch (e) { try { canvas.requestPointerLock(); } catch (e2) {} }
}
function unlockPointer() { locked = false; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  $('lockhint').classList.toggle('hide', locked || state !== 'dive');
  if (!locked && state === 'dive' && !DEBUG && !TOUCH) pauseGame();
});
function pauseGame() { if (state !== 'dive') return; state = 'pause'; show('pause'); }
function resumeGame() { show(null); state = 'dive'; lockPointer(); }

addEventListener('keydown', e => {
  if (e.repeat) { if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
  keys[e.code] = true;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') toggleMute();
  if (state !== 'dive') return;
  if (e.code === 'KeyE') { if (nearBoat()) climbAboard(); else useNet(); }
  if (e.code === 'KeyC') cycleView();
  if (e.code === 'Digit1') setTool('net');
  if (e.code === 'Digit2') setTool('spear');
  if (e.code === 'KeyQ') setTool(tool === 'net' ? 'spear' : 'net');
  if (e.code === 'KeyR') useRepel();
  if (e.code === 'KeyF' && lvl('light') > 0) { torch = !torch; toast(torch ? 'Flashlight on' : 'Flashlight off'); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('mousemove', e => {
  if (state === 'dive') {
    if (!locked && !DEBUG) return;
    const k = 0.0024 * settings.sens;
    P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.45, 1.45);
  } else if (cam.drag && (state === 'boat' || state === 'title')) {
    cam.yaw -= e.movementX * 0.006; cam.pitch = clamp(cam.pitch + e.movementY * 0.004, 0.02, 1.1); cam.auto = false; cam.idle = 0;
  }
});
canvas.addEventListener('mousedown', e => {
  if (state === 'dive') {
    if (!locked && !DEBUG && !TOUCH) { lockPointer(); return; }
    if (e.button === 0) useTool();
  } else cam.drag = true;
});
addEventListener('mouseup', () => { cam.drag = false; });
addEventListener('wheel', e => { if (state === 'dive') setTool(tool === 'net' ? 'spear' : 'net'); }, { passive: true });
canvas.addEventListener('touchstart', () => { if (state === 'boat') cam.auto = false; }, { passive: true });

function toggleMute() { settings.mute = !settings.mute; sound.setMuted(settings.mute); showMute(); saveSettings(); }
function showMute() { $('muteIc').innerHTML = icon(settings.mute ? 'mute' : 'sound', 24); }
$('muteBtn').addEventListener('click', toggleMute);
showMute();
document.addEventListener('pointerover', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled && e.pointerType === 'mouse') sound.tick(); });   // a soft tick when you point at a button
function cycleView() { cam.view = cam.view === 'third' ? 'far' : cam.view === 'far' ? 'first' : 'third'; cam.dist = cam.view === 'far' ? 9 : [3.4, 5.2, 8][settings.camDist]; }

// ================================================================================================ catching fish with the net
const _o = new THREE.Vector3();
function useNet() {
  if (state !== 'dive' || !run || run.netCD > 0) return;
  run.netCD = 0.55; diver.swing(); sound.net();
  setTimeout(netHit, 130);                                      // the net reaches its target in the middle of the swing
}
function netHit() {
  if (state !== 'dive' || !run) return;
  const net = GEAR.net.levels[lvl('net')], cap = GEAR.bag.levels[lvl('bag')].cap;
  dirFrom(P.yaw, P.pitch, _f); _o.copy(P.pos).addScaledVector(_f, 0.4);
  const list = fish.query(_o, _f, net.reach, 0.2);
  if (!list.length) { sound.netMiss(); return; }
  const c = list[0], def = c.f.def;
  if (def.needSpear) { toast(def.name + ' is too big for a net! You need a spear gun.', '#ffb070'); fish.scare(c.f, 1.5); sound.deny(); return; }
  if (run.bag.length >= cap) { toast('Your bag is full! Swim back to the boat.', '#ff9a9a'); sound.deny(); return; }
  // rarer and faster fish are harder; a better net and getting really close both help
  const chance = clamp(def.ease * net.power * (1.1 - 0.35 * c.dist / net.reach), 0.05, 0.98);
  if (Math.random() < chance) catchFish(c.f);
  else { fish.scare(c.f, 1.8); toast('It wriggled free!', '#ffd0a0'); sound.netMiss(); }
}
// Put a fish in the bag (used by the net and, later, the spear gun). Shows the popup the first time you meet a new kind.
function catchFish(f) {
  const def = f.def, rar = RARITY[def.rarity];
  run.bag.push(def.id); save.stats.caught++;
  const first = !save.dex[def.id];
  save.dex[def.id] = { n: (save.dex[def.id] ? save.dex[def.id].n : 0) + 1 };
  for (let i = 0; i < 7; i++) emitBubble(bubbles, f.pos.x + (Math.random() - 0.5) * 0.6, f.pos.y + (Math.random() - 0.5) * 0.4, f.pos.z + (Math.random() - 0.5) * 0.6);
  fish.remove(f);
  sound.catchFish(rar.order);
  toast('Caught ' + def.name + '!  +$' + def.value + ' when sold', rar.color);
  if (first) discover(def);
  persist();
}
function discover(def) {
  const rar = RARITY[def.rarity];
  $('dcIcon').src = getIcons()[def.id]; $('dcName').textContent = def.name;
  $('dcRar').textContent = rar.name; $('dcRar').style.color = rar.color; $('dcVal').textContent = '$' + def.value + ' each';
  const d = $('discover'); d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
  setTimeout(() => sound.discover(), 120);
}
// ================================================================================================ the spear gun
function setTool(t) {
  if (t === 'spear' && lvl('gun') === 0) { if (state === 'dive') toast('You need to buy a spear gun in the shop first.', '#ffd34e'); t = 'net'; }
  tool = t; diver.setTool(t);
  $('cross').classList.toggle('spear', t === 'spear');
}
const useTool = () => (tool === 'spear' ? fireSpear() : useNet());
const spears = [];                                                     // spears flying through the water
const spearPool = [];
function makeSpearMesh() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8dee6 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })); tip.position.z = 0.6;
  g.add(shaft, tip); return g;
}
const _Z = new THREE.Vector3(0, 0, 1), _a = new THREE.Vector3();
function fireSpear() {
  if (state !== 'dive' || !run || run.spearCD > 0) return;
  const gun = GEAR.gun.levels[lvl('gun')];
  if (!gun.range) { toast('Buy a spear gun in the shop first.', '#ffd34e'); return; }
  if (run.ammo <= 0) { toast('Out of spears!', '#ff9a9a'); sound.deny(); run.spearCD = 0.5; return; }
  run.ammo--; save.spears = Math.max(0, save.spears - 1); persist();
  run.spearCD = gun.reload; diver.fire(); sound.spear();
  setTimeout(() => { if (state === 'dive' && run && run.ammo > 0) sound.reload(); }, gun.reload * 1000);
  // the spear leaves the gun and flies to wherever the crosshair points
  dirFrom(P.yaw, P.pitch, _f);
  const muzzle = P.pos.clone().addScaledVector(_f, 0.9); muzzle.y += 0.1;
  const aim = _o.copy(camera.position).addScaledVector(_f, 45);
  const dir = aim.sub(muzzle).normalize();
  const mesh = spearPool.pop() || makeSpearMesh(); scene.add(mesh);
  spears.push({ mesh, pos: muzzle, dir, left: gun.range, gun });
}
function updateSpears(dt) {
  for (let i = spears.length - 1; i >= 0; i--) {
    const s = spears[i], step = 42 * dt;
    _a.copy(s.pos); s.pos.addScaledVector(s.dir, step); s.left -= step;
    let done = false;
    const sh = sharks.segmentHit(_a, s.pos, 0.35);
    if (sh) { sharks.stun(sh, s.gun.stun); sound.stun(); toast(sh.def.name + ' stunned! Swim away!', '#8affb0'); done = true; }
    const hit = !done && fish.segmentHit(_a, s.pos, 0.3);
    if (hit) {
      const def = hit.f.def, cap = GEAR.bag.levels[lvl('bag')].cap;
      if (def.needSpear && lvl('gun') < def.needSpear) { toast(def.name + ' is too strong! You need the ' + GEAR.gun.levels[def.needSpear].name + '.', '#ffb070'); fish.scare(hit.f, 2); sound.deny(); }
      else if (run && run.bag.length >= cap) { toast('Your bag is full! The fish got away.', '#ff9a9a'); fish.scare(hit.f, 2); sound.deny(); }
      else catchFish(hit.f);
      done = true;
    }
    if (!done && (s.pos.y < heightAt(s.pos.x, s.pos.z) + 0.05 || s.pos.y > -0.05 || s.left <= 0)) done = true;
    if (done) { scene.remove(s.mesh); spearPool.push(s.mesh); spears.splice(i, 1); continue; }
    s.mesh.position.copy(s.pos); s.mesh.quaternion.setFromUnitVectors(_Z, s.dir);
    if (Math.random() < dt * 30) emitBubble(bubbles, s.pos.x, s.pos.y, s.pos.z);
  }
}

// ================================================================================================ shark bites, shark repellent
let shake = 0;
function biteDiver(s) {
  if (!run || state !== 'dive') return;
  const dmg = Math.max(8, s.def.bite * run.airMax * (1 - suitInfo().bite));    // a better suit means a smaller bite
  run.air = Math.max(0, run.air - dmg); run.bites++; save.stats.bites++;
  dirFrom(P.yaw, P.pitch, _f); _o.copy(P.pos).sub(s.pos).setY(0.2).normalize(); P.vel.addScaledVector(_o, 7);
  shake = 1; sound.bite(); toast('CHOMP! The shark took ' + Math.round(dmg) + ' air!', '#ff7a7a');
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.6; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }));
  persist();
}
function useRepel() {
  if (state !== 'dive' || !run) return;
  if (save.repel <= 0) { toast('You have no shark repellent. Buy some in the shop.', '#ffd34e'); sound.deny(); return; }
  if (run.repelT > 0) return;
  save.repel--; run.repelT = 20; persist(); sound.repel();
  const n = sharks.repel(P.pos, 55, 20);
  toast(n ? 'Repellent! ' + n + ' shark' + (n > 1 ? 's' : '') + ' swam away.' : 'Repellent used. No sharks nearby.', '#8affb0');
}

function nearBoat() { return P.pos.y > -3.5 && Math.hypot(P.pos.x, P.pos.z) < 8.5; }
function climbAboard() { endDive('boat'); }

// ================================================================================================ the player each frame
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
function updatePlayer(dt) {
  const fl = GEAR.flippers.levels[lvl('flippers')];
  dirFrom(P.yaw, P.pitch, _f); _r.set(-_f.z, 0, _f.x).normalize();
  // what direction do the keys ask for?
  _w.set(0, 0, 0);
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const up = (keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0);
  _w.addScaledVector(_f, fwd).addScaledVector(_r, side); _w.y += up;
  const asking = _w.lengthSq() > 0.001;
  if (asking) _w.normalize();
  const surf = P.pos.y > -0.6;
  const speed = TUNE.baseSpeed * fl.speed * (surf ? 0.75 : 1);
  const k = 1 - Math.exp(-(asking ? 3.2 : 1.7) * dt);
  P.vel.x += (_w.x * speed - P.vel.x) * k; P.vel.y += (_w.y * speed - P.vel.y) * k; P.vel.z += (_w.z * speed - P.vel.z) * k;
  P.pos.addScaledVector(P.vel, dt);
  // the sea surface: you float with your back out of the water
  P.surface = false;
  if (P.pos.y > -0.15) { P.pos.y = -0.15 + Math.sin(timeNow * 1.4) * 0.03; if (P.vel.y > 0) P.vel.y = 0; P.surface = true; }
  world.collide(P.pos, P.r, P.vel);
  boat.hullCollide(P.pos, P.r, P.vel);
  P.speed01 = clamp(P.vel.length() / (TUNE.baseSpeed * 2.2), 0, 1);
  // the model turns to face where you look
  P.mYaw += angDiff(P.yaw, P.mYaw) * Math.min(1, dt * 7);
  const wantPitch = P.surface ? 0 : clamp(P.pitch, -1.2, 1.2) * (0.35 + 0.65 * P.speed01);
  P.mPitch += (wantPitch - P.mPitch) * Math.min(1, dt * 5);
}
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };

// ================================================================================================ air, depth and zones
function updateRun(dt) {
  run.t += dt; run.netCD = Math.max(0, run.netCD - dt); run.spearCD = Math.max(0, run.spearCD - dt); run.repelT = Math.max(0, run.repelT - dt);
  const depth = Math.max(0, -P.pos.y), suit = suitInfo();
  run.deepest = Math.max(run.deepest, depth);
  const zone = zoneAt(depth);
  if (zone.id !== run.zone) {
    run.zone = zone.id;
    banner(zone.name.toUpperCase(), 'Depth ' + zone.top + ' m', '#ffd34e'); sound.zone();
    if (zone.needLight > lvl('light') && !run.warned['l' + zone.id]) { run.warned['l' + zone.id] = 1; toast('It is pitch black here. You need a flashlight!', '#ffd34e'); }
  }
  // air: more at depth, a lot more if your suit is too thin for the cold
  const tooCold = depth > suit.maxDepth;
  let rate = (TUNE.airBase + depth * TUNE.airPerMetre) * (1 + 0.25 * P.speed01);
  if (depth < 1) rate *= 0.12;
  if (tooCold) rate *= TUNE.coldAirMul;
  run.air = Math.max(0, run.air - rate * dt);
  run.cold = tooCold;
  if (tooCold && !run.warned.cold) { run.warned.cold = 1; banner('TOO COLD!', 'Your suit can\'t handle this depth. Swim up!', '#8ee8ff'); sound.cold(); }
  if (!tooCold) run.warned.cold = 0;
  if (run.air <= 0) blackout();
}
function blackout() {
  if (state !== 'dive') return;
  state = 'blackingout';
  sound.blackout();
  $('black').style.opacity = 1;
  setTimeout(() => endDive('blackout'), 1500);
}

// ================================================================================================ camera
const _cam = new THREE.Vector3(), _head = new THREE.Vector3(), _look = new THREE.Vector3();
function updateCamera(dt) {
  if (DEBUG && window.__camLock) return;      // (testing only) lets a test put the camera wherever it likes
  if (state === 'dive' || state === 'pause' || state === 'blackingout') {
    dirFrom(P.yaw, P.pitch, _f); _r.set(-_f.z, 0, _f.x).normalize();
    _head.copy(P.pos); _head.y += 0.2;
    let d = cam.view === 'first' ? 0 : cam.dist;
    if (d === 0) _cam.copy(_head).addScaledVector(_f, 0.25);
    else {
      // behind and a little to the right, so the crosshair isn't hidden by the diver. Shorten the arm until it fits (not inside the seabed).
      for (let i = 0; i < 12; i++) {
        const k = Math.min(1, d / 4);
        _cam.copy(_head).addScaledVector(_f, -d).addScaledVector(_r, 0.6 * k); _cam.y += 0.35 * k;
        if (_cam.y > heightAt(_cam.x, _cam.z) + 0.45) break;
        d *= 0.85;
      }
    }
    camera.position.lerp(_cam, 1 - Math.exp(-20 * dt)); if (camera.position.distanceToSquared(_cam) > 16) camera.position.copy(_cam);
    if (shake > 0) { shake = Math.max(0, shake - dt * 1.8); camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; }
    camera.rotation.set(P.pitch, P.yaw + Math.PI, 0, 'YXZ');
    diver.group.visible = d > 0.8;
  } else {
    // the boat view: slowly circle the boat (drag to look around yourself)
    if (cam.auto) cam.yaw += dt * 0.07; else { cam.idle = (cam.idle || 0) + dt; if (cam.idle > 8) cam.auto = true; }
    const R = 15;
    camera.position.set(Math.cos(cam.yaw) * R * Math.cos(cam.pitch * 0.5), 1.8 + cam.pitch * 14, Math.sin(cam.yaw) * R * Math.cos(cam.pitch * 0.5));
    _look.set(0, 1.6, 0); camera.lookAt(_look);
    diver.group.visible = true;
  }
}

// ================================================================================================ HUD
function updateHud(dt) {
  if (!run) return;
  const f = run.air / run.airMax;
  $('airFill').style.width = (f * 100).toFixed(1) + '%';
  $('airTxt').textContent = Math.ceil(run.air);
  const ab = $('airBox'); ab.classList.toggle('low', f < TUNE.lowAir); ab.classList.toggle('mid', f >= TUNE.lowAir && f < 0.5);
  const depth = Math.max(0, -P.pos.y);
  $('depthTxt').innerHTML = Math.floor(depth) + '<small> m</small>';
  $('zoneTxt').textContent = zoneAt(depth).name;
  $('coinTxt').textContent = money(save.coins);
  const cap = GEAR.bag.levels[lvl('bag')].cap;
  $('bagTxt').textContent = run.bag.length + ' / ' + cap; $('bagTxt').classList.toggle('full', run.bag.length >= cap);
  // the tool bar at the bottom
  $('toolNet').classList.toggle('on', tool === 'net');
  $('toolSpear').classList.toggle('hide', lvl('gun') === 0); $('toolSpear').classList.toggle('on', tool === 'spear'); $('toolSpear').classList.toggle('dim', run.spearCD > 0 || run.ammo <= 0); $('spearN').textContent = run.ammo;
  $('toolLight').classList.toggle('hide', lvl('light') === 0); $('toolLight').classList.toggle('on', torch);
  $('toolRepel').classList.toggle('hide', save.repel === 0 && !(run.repelT > 0)); $('repelN').textContent = save.repel;
  // the crosshair turns green when a fish is in reach of the net
  if (tool === 'net') { const net = GEAR.net.levels[lvl('net')]; dirFrom(P.yaw, P.pitch, _f); _o.copy(P.pos).addScaledVector(_f, 0.4); $('cross').classList.toggle('hot', fish.query(_o, _f, net.reach, 0.2).length > 0); } else $('cross').classList.remove('hot');
  // the arrow that points back to the boat
  dirFrom(P.yaw, 0, _f); _r.set(-_f.z, 0, _f.x).normalize();
  const dx = -P.pos.x, dz = -P.pos.z, dist = Math.hypot(dx, dz, P.pos.y);
  const ang = Math.atan2(dx * _r.x + dz * _r.z, dx * _f.x + dz * _f.z);
  $('arrowG').setAttribute('transform', `rotate(${(ang * 57.2958).toFixed(0)} 20 20)`);
  $('boatDist').textContent = Math.round(dist) + ' m';
  $('boatPtr').classList.toggle('hide', dist < 12);
  const nb = nearBoat() && state === 'dive';
  $('prompt').classList.toggle('hide', !nb);
  const near = sharkInfo.nearest < 55;
  $('sharkIcon').classList.toggle('hide', !near || !!hiddenKind && !sharkInfo.chasing); $('sharkIcon').classList.toggle('near', !sharkInfo.chasing);
  $('sharkTxt').textContent = sharkInfo.chasing ? 'SHARK CHASING YOU!' : 'SHARK NEARBY!';
  $('hideIcon').classList.toggle('hide', !hiddenKind); if (hiddenKind !== lastHide) { lastHide = hiddenKind; $('hideIc').innerHTML = hiddenKind ? icon(hiddenKind === 'cave' ? 'cave' : 'hide', 24) : ''; $('hideTxt').textContent = hiddenKind === 'cave' ? 'HIDING IN A CAVE' : 'HIDDEN IN THE KELP'; }
  $('vigShark').style.opacity = sharkInfo.chasing ? clamp(1.1 - sharkInfo.nearest / 40, 0.18, 0.95) * (0.8 + 0.2 * Math.sin(timeNow * 9)) : 0;
  $('vigCold').style.opacity = run.cold ? 0.55 + 0.25 * Math.sin(timeNow * 6) : 0;
}

// ================================================================================================ light + diver model each frame
function updateVisuals(dt) {
  const diving = state === 'dive' || state === 'pause' || state === 'blackingout';
  if (diving) {
    diver.group.position.copy(P.pos);
    diver.group.rotation.set(-P.mPitch, P.mYaw, 0, 'YXZ');
    diver.update(dt, P.speed01);
    diver.setGlow(clamp(0.5 - world.env.light * 0.6, 0, 0.45));
  } else {
    diver.group.position.copy(boat.deckSpot);
    diver.update(dt, 0); diver.setGlow(0);
  }
  // breath bubbles
  if (diving && run && P.pos.y < -0.6) {
    run.bubT = (run.bubT || 0) - dt;
    if (run.bubT <= 0) { run.bubT = 2.8 - P.speed01 * 1.2; for (let i = 0; i < 3; i++) emitBubble(bubbles, P.pos.x + (Math.random() - 0.5) * 0.3, P.pos.y + 0.4, P.pos.z + (Math.random() - 0.5) * 0.3); }
  }
  updateBubbles(bubbles, dt, timeNow);
  // flashlight
  const L = GEAR.light.levels[lvl('light')];
  const lightOn = diving && L.power > 0 && torch;
  spot.intensity = lightOn ? L.power * 150 : 0; spot.distance = L.range; spot.angle = L.angle;
  if (lightOn) { dirFrom(P.yaw, P.pitch, _f); spot.position.copy(P.pos).addScaledVector(_f, 0.4); spot.position.y += 0.35; spotTarget.position.copy(spot.position).addScaledVector(_f, 20); }
  return lightOn;
}

// ================================================================================================ main loop
const AWAY = { pos: new THREE.Vector3(0, 500, 0), speed01: 0 };   // where the fish think the diver is while you're on the boat
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  renderer.render(scene, camera);
}
function step(dt) {
  timeNow += dt; U.uTime.value = timeNow;
  document.documentElement.classList.toggle('playing', state === 'dive' || state === 'blackingout');
  if (state === 'dive') { updatePlayer(dt); updateRun(dt); }
  else if (state === 'blackingout') { P.vel.multiplyScalar(0.9); }
  boat.update(dt, timeNow);
  if (state !== 'dive' && state !== 'pause') aquarium.update(dt, timeNow);
  if (spears.length) updateSpears(dt);
  hiddenKind = state === 'dive' ? world.hiddenAt(P.pos) : null;
  sharkInfo = sharks.update(dt, timeNow, state === 'dive' || state === 'pause' || state === 'blackingout' ? P : AWAY, !!hiddenKind);
  fish.update(dt, timeNow, state === 'dive' || state === 'pause' || state === 'blackingout' ? P : AWAY);
  updateCamera(dt);
  const lightOn = updateVisuals(dt);
  world.updateEnvironment(camera, timeNow, lightOn);
  if (state === 'dive' || state === 'pause') updateHud(dt);
  sound.update(dt, { active: state === 'dive' || state === 'boat', under: camera.position.y < 0, depth: Math.max(0, -camera.position.y), speed01: P.speed01, diving: state === 'dive', air01: run ? run.air / run.airMax : 1, lowAir: run ? run.air / run.airMax < TUNE.lowAir : false, sharkNear: sharkInfo.chasing ? clamp(1 - sharkInfo.nearest / 45, 0.3, 1) : clamp((32 - sharkInfo.nearest) / 70, 0, 0.4), sharkChase: sharkInfo.chasing });
}
requestAnimationFrame(frame);

// ================================================================================================ buttons
$('ttPlay').addEventListener('click', () => { sound.start(); sound.setMuted(settings.mute); sound.setVolume(settings.vol); showMute(); goBoat(); });
$('bmDive').addEventListener('click', () => { sound.click(); openPlan(); });
$('planBack').addEventListener('click', () => { sound.click(); goBoat(); });
$('planGo').addEventListener('click', startDive);
$('smOk').addEventListener('click', () => { sound.click(); goBoat(); });
$('psResume').addEventListener('click', resumeGame);
$('psQuit').addEventListener('click', () => endDive('quit'));
// the menu screens (sell, shop, Fish-dex, settings) live in ui.js
const ui = createUI({ $, show, setState: v => { state = v; }, sound, getIcons, goBoat, toast, diver, toggleMute });
$('bmShop').addEventListener('click', () => { sound.click(); ui.openShop(); });
$('bmDex').addEventListener('click', () => { sound.click(); ui.openDex(); });
$('bmSell').addEventListener('click', () => { sound.click(); ui.openSell(); });
$('bmSet').addEventListener('click', () => { sound.click(); ui.openSettings(); });

// ================================================================================================ touch controls (phones and tablets): a stick to swim, buttons for the rest
if (TOUCH) {
  initTouch({
    visible: () => state === 'dive', lookScale: 2.2, pause: () => pauseGame(),
    stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
    buttons: [
      { label: 'USE', sub: 'net / spear', cls: 'fire', type: 'tap', action: () => useTool(), s: 96, r: 22, b: 44 },
      { label: 'UP', type: 'hold', key: 'Space', s: 62, r: 132, b: 40 },
      { label: 'DOWN', type: 'hold', key: 'ShiftLeft', s: 62, r: 22, b: 156 },
      { label: 'TOOL', type: 'tap', action: () => setTool(tool === 'net' ? 'spear' : 'net'), s: 56, cls: 'small', r: 132, b: 112 },
      { label: 'LIGHT', type: 'tap', key: 'KeyF', s: 52, cls: 'small', r: 200, b: 40, show: () => lvl('light') > 0 },
      { label: 'REPEL', type: 'tap', key: 'KeyR', s: 52, cls: 'small', r: 200, b: 100, show: () => save.repel > 0 },
      { label: 'BOARD', sub: 'climb in', type: 'tap', key: 'KeyE', s: 70, cls: 'small', l: 24, b: 190, show: () => nearBoat(), glow: () => nearBoat() },
      { label: 'II', type: 'tap', action: () => pauseGame(), s: 40, cls: 'small', r: 12, t: 150 },
    ],
  });
}

// everything the tests (and curious people) can reach: add ?debug to the address
window.__dsd = { aquarium, sharks, biteDiver, useRepel, spears, fireSpear, setTool, ui, fish, catchFish, getIcons, useNet, depthAt, heightAt, THREE, scene, camera, renderer, world, boat, diver, P, keys, step, save, settings, get state() { return state; }, get run() { return run; }, startDive, endDive, goBoat, openPlan, sound, cam, toast, banner };
if (DEBUG) { $('title').classList.add('hide'); sound.ready = false; goBoat(); }
goBoat(); show('title');
setTimeout(() => { try { getIcons(); } catch (e) { console.warn('fish pictures failed', e); } }, 1200);
if (DEBUG) { show('boatMenu'); }
