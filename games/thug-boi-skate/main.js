// Skater prototype: scene, camera, HUD, run timer, menus, coins and the shop.
import * as THREE from './three.module.min.js?v=1';
import { buildPark } from './park.js?v=1';
import { Skater } from './skater.js?v=1';
import { Scorer } from './tricks.js?v=1';
import { Input } from './input.js?v=1';
import { Sfx } from './audio.js?v=1';
import { CHARS, PACKS, PARKS, BOARDS, coinMult } from './data.js?v=1';
import { loadSave, writeSave, resetSave } from './save.js?v=1';
import { createShop } from './shop.js?v=1';
import { drawBoard } from './boardart.js?v=1';
import { createShopRoom } from './shoproom.js?v=1';
import { createPlacer } from './placer.js?v=1';
import { TOUCH, initTouch } from './touch.js?v=1';

const params = new URLSearchParams(location.search);
const RUN_TIME = Math.max(5, parseFloat(params.get('time')) || 120);
const COIN_RATE = 12;                       // timed run: 1 coin for every 12 points
const COIN_RATE_FREE = 60;                  // free skate: only 1 coin for every 60 points
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => { const T = Math.PI * 2; a %= T; if (a > Math.PI) a -= T; if (a < -Math.PI) a += T; return a; };

// ---------------------------------------------------------------- 3D setup
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const room = createShopRoom(scene);          // the skate shop (hidden until you open the shop)
let inShopScene = false, prevBg = null, prevFog = null;
const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 1500);
let sideView = false;
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  applyView();
}
function applyView() {
  // shop/menu: slide the picture to the right so the skater is not behind the panel
  if (sideView && window.innerWidth > 900) camera.setViewOffset(window.innerWidth, window.innerHeight, -window.innerWidth * 0.2, 0, window.innerWidth, window.innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

if (params.has('reset')) { resetSave(); try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ } }   // ?reset = wipe this browser's save
const save = loadSave();
if (!save.parks.includes(save.park)) save.park = 'plaza';
let world = buildPark(scene, save.park);
let skater = null;
const scorer = new Scorer();
const input = new Input();
const sfx = new Sfx();
resize();

// ---------------------------------------------------------------- unlocks
let unlocked = new Set();
function rebuildUnlocks() {
  unlocked = new Set();
  for (const p of PACKS) if (save.packs.includes(p.id)) p.can.forEach((c) => unlocked.add(c));
}
const charObj = () => CHARS.find((c) => c.id === save.char) || CHARS[0];

// ---------------------------------------------------------------- game state
const game = { mode: 'menu', time: RUN_TIME, timeUp: false, timeUpT: 0, ignoreT: 0, free: false };
let msgTimer = 0;

function showMsg(text, cls, secs = 1.4) {
  const m = $('msg'); m.textContent = text; m.className = 'show ' + (cls || '');
  msgTimer = secs;
}

const hooks = {
  can(id) { return unlocked.has(id); },
  onOllie() { sfx.ollie(); },
  onTrick(name, pts) { scorer.add(name, pts); sfx.trick(); },
  onPoints(name, pts) { scorer.addPoints(name, pts); },
  onLand() { sfx.land(); },
  onGrindStart() { sfx.grindStart(); },
  onBonk() { sfx.land(); },
  onBank() {
    const t = scorer.bank();
    if (t > 0) { showMsg('+' + fmt(t), 'good', 1.6); sfx.bank(); }
  },
  onSave(left) { showMsg('SAVED! ' + (left > 0 ? left + ' save' + (left > 1 ? 's' : '') + ' left' : 'no saves left'), 'good', 1.6); sfx.bank(); },
  onAcid() {            // acid pit: -10,000 points (never below 0)
    const lost = Math.min(scorer.score, 10000);
    scorer.score -= lost;
    showMsg('ACID! -10,000 points' + (lost < 10000 ? ' (all you had)' : ''), 'bad', 2);
    sfx.bail();
  },
  onHazard(t) {
    const m = { ice: ['ICE! Super slippery: jump over it!', 'bad'], sand: ['SAND TRAP! Jump over it!', 'bad'], goo: ['STICKY GOO! Jump over it!', 'bad'], boost: ['SPEED STRIP!', 'good'], bounce: ['BOING!', 'good'] }[t];
    if (m) { showMsg(m[0], m[1], 1.4); if (t === 'bounce' || t === 'boost') sfx.bank(); }
  },
  onLoop() { showMsg('LOOP-DE-LOOP!!', 'good', 2); sfx.bank(); },
  onLoopSlow() { showMsg('Roll in FASTER to do the loop!', 'bad', 1.6); },
  onLaunch() { showMsg('MEGA LAUNCH!!', 'good', 2); sfx.bank(); },
  onBail(reason) {
    const lost = scorer.total;
    scorer.bail();
    showMsg('BAIL! ' + reason + (lost > 0 ? '  (lost ' + fmt(lost) + ')' : ''), 'bad', 1.6);
    sfx.bail();
  },
};
skater = new Skater(world, scene, hooks);

function loadPark(id) {
  if (id === world.id) return;
  world.dispose();
  world = buildPark(scene, id);
  skater.setWorld(world);
  cam.snap();
  if (inShopScene) { prevBg = scene.background; prevFog = scene.fog; world.root.visible = false; scene.background = room.bg; scene.fog = null; placeInShop(); }
  refreshVehicle();
}

function applyLoadout() {
  rebuildUnlocks();
  skater.setLoadout(save.parts, charObj(), save.items, save.board, currentVehicle(), save.sdeck);
}
// Snow Peak = snowboard (no wheels); the skate shop always shows a skateboard
const currentVehicle = () => (inShopScene ? 'skate' : world.vehicle);
function refreshVehicle() { if (skater.vehicle !== currentVehicle()) applyLoadout(); }
const boardObj = () => BOARDS.find((b) => b.id === save.board) || BOARDS[0];

// ---- the skate shop room: hide the park, show the room, put the skater on the display stand
function placeInShop() {
  skater.pos.set(room.stand.x, room.stand.y, room.stand.z); skater.vel.set(0, 0, 0);
  skater.heading = 0.3; skater.shadow.visible = false;
}
function enterShopScene() {
  if (!inShopScene) { inShopScene = true; prevBg = scene.background; prevFog = scene.fog; }
  world.root.visible = false; world.pickGroup.visible = false;
  room.show(); scene.background = room.bg; scene.fog = null;
  refreshVehicle();
  skater.reset(); placeInShop();
  cam.shopT = 0;
}
function leaveShopScene() {
  if (!inShopScene) return;
  inShopScene = false; room.hide();
  world.root.visible = true; scene.background = prevBg; scene.fog = prevFog;
  refreshVehicle();
  skater.shadow.visible = true;
}
applyLoadout();

// ---------------------------------------------------------------- camera
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
const cam = {
  yaw: Math.PI, pos: new THREE.Vector3(0, 3, 24), fov: 65, orbit: Math.PI - 0.7,
  snap() {
    this.yaw = skater.heading;
    this.pos.set(skater.pos.x - Math.sin(this.yaw) * 6.5, 3, skater.pos.z - Math.cos(this.yaw) * 6.5);
    this.fov = 65; camera.fov = 65; camera.updateProjectionMatrix();
  },
  // slow turn around the skater (menu / shop)
  shopT: 0,
  // the skate shop: walk in through the door, then slowly swing around the skater on the stand
  doShop(dt) {
    this.shopT += dt;
    const a = Math.sin(this.shopT * 0.35) * 0.9, sx = skater.pos.x, sy = skater.pos.y, sz = skater.pos.z;
    const fx = sx + Math.sin(a) * 3.8, fy = sy + 1.5, fz = sz + Math.cos(a) * 3.8;
    const k = clamp(this.shopT / 2.8, 0, 1), e = k * k * (3 - 2 * k);
    camera.position.set(room.door.x + (fx - room.door.x) * e, 1.7 + (fy - 1.7) * e, room.door.z + (fz - room.door.z) * e);
    camera.lookAt(sx, sy + 0.95 + (1 - e) * 0.7, sz - (1 - e) * 6);
    if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  },
  doOrbit(dt) {
    this.orbit += dt * 0.4;
    const f = tmpA.set(skater.pos.x, skater.pos.y + 0.95, skater.pos.z);
    camera.position.set(f.x + Math.sin(this.orbit) * 3.8, f.y + 0.55, f.z + Math.cos(this.orbit) * 3.8);
    camera.lookAt(f);
    if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
  },
  update(dt) {
    const sk = skater;
    let target = this.yaw;
    const hs = sk.speed;
    if (sk.state === 'air') { if (hs > 2.5) target = Math.atan2(sk.vel.x, sk.vel.z); }
    else if (sk.state !== 'bail') target = sk.heading;
    this.yaw += wrapPi(target - this.yaw) * (1 - Math.exp(-4 * dt));
    const dist = 6.2 + clamp(hs / 14, 0, 1.2) * 1.3;
    const focus = tmpA.set(sk.pos.x, sk.pos.y + 1.0, sk.pos.z);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const want = tmpB.set(focus.x - fx * dist, focus.y + 1.9, focus.z - fz * dist);
    // do not let the camera sink into ramps/boxes: walk from the skater to the wanted spot and stop at the first block
    let tt = 1;
    for (let i = 1; i <= 12; i++) {
      const f = i / 12;
      const qx = focus.x + (want.x - focus.x) * f, qy = focus.y + (want.y - focus.y) * f, qz = focus.z + (want.z - focus.z) * f;
      if (qy < world.height(qx, qz) + 0.5) { tt = (i - 1) / 12; break; }
    }
    tt = Math.max(tt, 0.2);
    want.set(focus.x + (want.x - focus.x) * tt, focus.y + (want.y - focus.y) * tt, focus.z + (want.z - focus.z) * tt);
    this.pos.lerp(want, 1 - Math.exp(-11 * dt));
    this.pos.y = Math.max(this.pos.y, world.height(this.pos.x, this.pos.z) + 0.6);
    camera.position.copy(this.pos);
    camera.lookAt(focus.x + fx * 2.2, focus.y + 0.2, focus.z + fz * 2.2);
    const fov = 65 + clamp(hs / 20, 0, 1) * 8 + (sk.boostT > 0 ? 7 : 0);
    this.fov += (fov - this.fov) * (1 - Math.exp(-3 * dt));
    if (Math.abs(camera.fov - this.fov) > 0.05) { camera.fov = this.fov; camera.updateProjectionMatrix(); }
  },
};

// ---------------------------------------------------------------- screens
const SCREENS = ['menu', 'shop', 'placer', 'how', 'over', 'pause'];
function showScreen(name) {
  for (const s of SCREENS) $(s).classList.toggle('hide', s !== name);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function toMenu() {
  game.mode = 'menu';
  leaveShopScene();
  if (world.id !== save.park) loadPark(save.park);
  world.pickGroup.visible = false;
  skater.reset(); scorer.reset(); cam.snap(); cam.orbit = Math.PI - 0.7;
  menuInfo(); menuT = 0;
  sideView = true; applyView();
  showScreen('menu');
}
let menuT = 0;
function menuInfo() {
  const pk = PARKS.find((p) => p.id === save.park) || PARKS[0];
  $('parkName').textContent = pk.name;
  $('parkSpecial').textContent = pk.tag || '';
  $('menuCoins').textContent = fmt(save.coins);
  $('menuBest').textContent = fmt(save.best);
  $('menuWho').textContent = charObj().name;
  $('menuBoardName').textContent = boardObj().name + ' board';
  const bc = $('menuBoard'), bg = bc.getContext('2d');
  drawBoard(bg, boardObj(), bc.width, bc.height, 0xff7a2f);
}
// the skater on the main menu does a little ollie + kickflip over and over (alternating flip direction)
function menuDemo(dt) {
  menuT += dt;
  const T = 2.8, HOP = 0.95, k = Math.floor(menuT / T), t = menuT - k * T;
  if (t < HOP) {
    const u = t / HOP;
    skater.pos.y = Math.sin(Math.PI * u) * 1.7;
    skater.flip = (k % 2 ? -1 : 1) * Math.min(1, u * 1.15) * Math.PI * 2;
    skater.squash = u < 0.1 ? 0.55 : 0;
  } else {
    if (t < HOP + 0.2) skater.squash = 0.5;
    skater.pos.y = 0; skater.flip = 0;
  }
}
function toShop() {
  game.mode = 'shop';
  enterShopScene();
  sideView = true; applyView();
  shop.render();
  showScreen('shop');
}
function toHow() { game.mode = 'how'; sideView = false; applyView(); showScreen('how'); }

const shop = createShop({
  save,
  persist: () => writeSave(save),
  apply: applyLoadout,
  setPark: (id) => { loadPark(id); skater.reset(); if (inShopScene) placeInShop(); },
  preview: (c) => skater.setCharacter(Skater.look(c || charObj(), boardObj(), currentVehicle(), save.sdeck, save.items)),
  previewBoard: (b) => skater.setCharacter(Skater.look(charObj(), b || boardObj(), currentVehicle(), save.sdeck, save.items)),
  sfx: (ok) => { sfx.init(); if (ok) sfx.bank(); else sfx.tone(200, 90, 0.2, 'square', 0.08); },
  openPlacer: (id) => placer.open(id) || openPlacerScreen(),
});

// the sticker placer: your board floats in front of you, you turn the camera and click where each sticker goes
const placer = createPlacer({
  scene, camera, save,
  stand: room.stand,
  persist: () => writeSave(save),
  getCfg: () => Skater.look(charObj(), boardObj(), 'skate', save.sdeck),
  sfx: (ok) => { sfx.init(); if (ok) sfx.bank(); else sfx.tone(200, 90, 0.2, 'square', 0.08); },
  onClose: () => {
    skater.root.visible = true; applyLoadout();
    game.mode = 'shop'; shop.render(); showScreen('shop');
  },
});
function openPlacerScreen() {
  skater.root.visible = false;
  game.mode = 'placer';
  showScreen('placer');
}

function startRun(free = false) {
  scorer.reset(); skater.reset(); cam.snap();
  game.free = !!free;
  world.pickGroup.visible = game.free;
  for (const pk of world.pickups) { pk.active = true; pk.obj.visible = true; }
  if (skater.comboOn) showMsg(skater.comboText, 'good', 2.4);
  game.mode = 'playing'; game.time = RUN_TIME; game.timeUp = false; game.timeUpT = 0; game.ignoreT = 0.25;
  sideView = false; applyView();
  showScreen(null);
  $('msg').className = '';
}

function endRun() {
  game.mode = 'over';
  sfx.silence();
  const cm = coinMult(save.items || []);
  const earned = Math.floor((scorer.score / (game.free ? COIN_RATE_FREE : COIN_RATE)) * cm);
  $('oTitle').textContent = game.free ? 'SESSION OVER' : "TIME'S UP!";
  const prev = save.best;
  const isBest = scorer.score > prev;
  save.coins += earned; save.runs++; if (isBest) save.best = scorer.score;
  writeSave(save);
  $('oScore').textContent = fmt(scorer.score);
  $('oCombo').textContent = fmt(scorer.bestCombo);
  $('oTricks').textContent = scorer.tricksLanded;
  $('oBails').textContent = scorer.bails;
  $('oBest').textContent = isBest ? 'NEW BEST!' : 'Best: ' + fmt(prev);
  $('oBest').className = isBest ? 'new' : '';
  $('oCoins').textContent = '+' + fmt(earned) + ' coins!' + (cm > 1 ? '  (Action Cam x' + cm + ')' : '') + '  (you have ' + fmt(save.coins) + ')';
  sideView = false; applyView();
  showScreen('over');
}

function setPaused(p) {
  if (game.mode === 'playing' && p) { game.mode = 'paused'; showScreen('pause'); sfx.silence(); }
  else if (game.mode === 'paused' && !p) { game.mode = 'playing'; showScreen(null); game.ignoreT = 0.15; }
}
window.addEventListener('blur', () => setPaused(true));

// ---------------------------------------------------------------- HUD
const hud = { score: '', combo: '', names: '', time: '', spin: '', best: '' };
function setText(id, key, val) { if (hud[key] !== val) { hud[key] = val; $(id).textContent = val; } }
function updateHud() {
  setText('score', 'score', fmt(scorer.score));
  setText('best', 'best', 'Best combo ' + fmt(scorer.bestCombo));
  const t = Math.max(0, game.time);
  setText('time', 'time', game.free ? 'FREE' : Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'));
  $('time').classList.toggle('low', !game.free && t <= 10 && game.mode === 'playing');
  $('boostBox').style.display = skater.boostT > 0 ? '' : 'none';
  $('boost').style.width = Math.round(clamp(skater.boostT / 4, 0, 1) * 100) + '%';
  const combo = $('combo');
  if (scorer.active && skater.state !== 'bail') {
    combo.classList.remove('hide');
    setText('cnames', 'names', scorer.list.slice(-5).join('  +  '));
    setText('cpts', 'combo', fmt(Math.round(scorer.points)) + '  ×  ' + scorer.mult);
  } else combo.classList.add('hide');
  setText('spin', 'spin', skater.spinLabel);
  $('speed').style.width = Math.round(clamp(skater.speed / 22, 0, 1) * 100) + '%';
}
const hudEls = document.querySelector('.hud');

// ---------------------------------------------------------------- power-up discs (free skate)
let pickClock = 0;
function updatePickups(dt) {
  pickClock += dt;
  for (const pk of world.pickups) {
    if (pk.active) {
      pk.obj.rotation.y += dt * 2;
      pk.obj.position.y = 0.9 + Math.sin(pickClock * 3 + pk.x) * 0.12;
      if (skater.state !== 'bail' && skater.pos.y < 2.2 && Math.hypot(skater.pos.x - pk.x, skater.pos.z - pk.z) < 1.9) {
        pk.active = false; pk.obj.visible = false; pk.t = 12;
        skater.boost(); sfx.bank(); showMsg('SPEED BOOST!', 'good', 1.2);
      }
    } else { pk.t -= dt; if (pk.t <= 0) { pk.active = true; pk.obj.visible = true; } }
  }
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
  tick(dt);
}
function tick(dt) {
  const inp = input.read();
  if (inp.start || inp.pause || inp.restart || inp.olliePressed) sfx.init();
  const inGame = game.mode === 'playing' || game.mode === 'paused';
  hudEls.style.display = inGame || game.mode === 'over' ? '' : 'none';

  if (game.mode === 'menu') { if (inp.start) startRun(); }
  else if (game.mode === 'shop') { if (inp.pause) toMenu(); }
  else if (game.mode === 'how') { if (inp.pause || inp.start) toMenu(); }
  else if (game.mode === 'over') { if (inp.start || inp.restart) startRun(game.free); }
  else if (game.mode === 'paused') { if (inp.pause || inp.start) setPaused(false); }
  else if (game.mode === 'playing') {
    if (inp.pause) setPaused(true);
    if (game.ignoreT > 0) { game.ignoreT -= dt; inp.olliePressed = false; inp.start = false; }
    if (inp.restart && skater.state !== 'bail') skater.bail('Reset');
    if (!game.free) game.time -= dt;
    if (game.free) updatePickups(dt);
    if (!game.free && game.time <= 0 && !game.timeUp) { game.timeUp = true; game.timeUpT = 0; showMsg('TIME!', 'good', 2.5); }
    if (game.timeUp) {
      game.timeUpT += dt;
      // let a trick in progress finish (up to 4 seconds), then the run ends
      const settled = skater.state === 'ground' && !scorer.active && !skater.manual;
      if (settled || game.timeUpT > 4) {
        if (scorer.active && skater.state === 'ground') hooks.onBank(); else scorer.cancel();
        endRun();
      }
    }
    skater.update(dt, inp);
    sfx.update(skater.speed, skater.state === 'ground', skater.state === 'grind');
  }
  if (game.mode === 'menu') menuDemo(dt);
  if (game.mode === 'menu' || game.mode === 'over' || game.mode === 'shop' || game.mode === 'how') skater.updateVisual(dt, inp);

  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('msg').className = ''; }
  if (game.mode === 'placer') placer.update(dt);
  else if (game.mode === 'shop') cam.doShop(dt);
  else if (game.mode === 'menu' || game.mode === 'how') cam.doOrbit(dt);
  else if (game.mode !== 'paused') cam.update(dt);
  updateHud();
  renderer.render(scene, camera);
}

$('go').addEventListener('click', () => { sfx.init(); startRun(false); });
$('goFree').addEventListener('click', () => { sfx.init(); startRun(true); });
function cyclePark(d) {
  const list = PARKS.filter((p) => save.parks.includes(p.id));
  const i = list.findIndex((p) => p.id === save.park);
  save.park = list[(i + d + list.length) % list.length].id;
  writeSave(save);
  loadPark(save.park);
  menuInfo();
  skater.reset();
}
$('parkPrev').addEventListener('click', () => cyclePark(-1));
$('parkNext').addEventListener('click', () => cyclePark(1));
$('goShop').addEventListener('click', () => { sfx.init(); toShop(); });
$('goHow').addEventListener('click', toHow);
$('howBack').addEventListener('click', toMenu);
$('shopBack').addEventListener('click', toMenu);
$('again').addEventListener('click', () => { sfx.init(); startRun(game.free); });
$('overShop').addEventListener('click', () => { sfx.init(); toShop(); });
$('pResume').addEventListener('click', () => setPaused(false));
$('pFinish').addEventListener('click', () => { game.mode = 'playing'; game.timeUp = true; endRun(); });
$('pMenu').addEventListener('click', toMenu);
toMenu();
requestAnimationFrame(frame);

// ---- phones and tablets: on-screen stick + buttons (they send the same keys the keyboard does)
if (TOUCH) initTouch({
  visible: () => game.mode === 'playing', lookScale: 1, stickZone: .45,
  stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  buttons: [
    { label: 'OLLIE', type: 'hold', key: 'Space', s: 88, r: 18, b: 26, cls: 'fire' },
    { label: 'FLIP', sub: 'kick', type: 'tap', key: 'KeyI', s: 58, r: 18, b: 122 },
    { label: 'GRIND', type: 'hold', key: 'ShiftLeft', s: 64, r: 114, b: 16 },
    { label: 'HEEL', type: 'tap', key: 'KeyK', s: 54, r: 114, b: 88 },
    { label: 'MANUAL', type: 'hold', key: 'KeyQ', s: 52, r: 180, b: 20, cls: 'small', fs: 10 },
    { label: 'SHOVE', type: 'tap', key: 'KeyJ', s: 52, r: 180, b: 80, cls: 'small', fs: 10 },
    { label: 'GRAB', type: 'hold', key: 'KeyL', s: 52, r: 180, b: 140, cls: 'small', fs: 10 },
    { label: 'II', type: 'tap', key: 'KeyP', s: 40, l: 150, t: 8, cls: 'small', fs: 14 },
  ],
});

// handy for testing in the console
window.__sk = { loadPark, cyclePark, camera, renderer, scene, tick, skater, scorer, game, world, cam, input, save, startRun, toShop, getWorld: () => world, toMenu, applyLoadout, THREE };
