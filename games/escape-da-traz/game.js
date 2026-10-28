// ESCAPE DA TRAZ - sneak past the guards' searchlights, freeze when they look your way, and pick each lock to break out through three wings.
import { THREE, V3, $, DEBUG, S, GFX, GFX_PREF, QL, camera, scene, renderer, W, clamp, lerp, load, save, rnd, updateFX, clearFX, burst, ring, audioInit, setVolume, sfx, adaptRes, playerLight } from './core.js?v=1';
import { world } from './physics.js?v=1';
import { WINGS, Level } from './map.js?v=1';
import { Prisoner, cam, updateCamera } from './player.js?v=1';
import { Guard } from './guard.js?v=1';
import { TOUCH, initTouch } from './touch.js?v=1';

const keys = {};
let state = 'menu', wingN = 0, level = null, guards = [], P = null, detection = 0, grace = 0, hitsLeft = 0, catches = 0, totalT = 0, started = false;
let picking = false, needleT = 0, zoneLo = .4, zoneHi = .6, pickFlash = 0, nearDoor = false, pickSpeedMul = 1;

function fmtT(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
function setBanner(a, b, ms) { $('bigA').textContent = a; $('bigB').textContent = b || ''; const t = $('big'); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(setBanner.t); if (ms) setBanner.t = setTimeout(() => t.classList.remove('on'), ms); }

// ================================================================== wing lifecycle
function clearWing() { if (level) { level.dispose(); level = null; } for (const g of guards) g.dispose(); guards = []; clearFX(); }
function loadWing(n) {
  clearWing(); const spec = WINGS[n]; level = new Level(spec); scene.fog.color.setHex(spec.sky); scene.fog.near = spec.fogNear; scene.fog.far = spec.fogFar;
  if (!P) P = new Prisoner();
  P.place(spec.start.x, spec.start.z, spec.start.yaw); cam.init = false; cam.yaw = spec.start.yaw;
  guards = spec.guards.map(g => new Guard(g)); detection = 0; grace = 1.6; hitsLeft = spec.door.hits; picking = false; nearDoor = false;
  randomizeZone(); wingN = n; setBanner('WING ' + (n + 1), spec.name.toUpperCase(), 2600);
}
function randomizeZone() { const w = WINGS[wingN].needle.zone; zoneLo = rnd(.06, .94 - w); zoneHi = zoneLo + w; }

function startRun() {
  audioInit(); hideScreens(); $('hud').style.visibility = 'visible'; catches = 0; totalT = 0; started = true; state = 'play'; loadWing(0);
}
function respawnInWing() {
  const spec = WINGS[wingN]; P.place(spec.start.x, spec.start.z, spec.start.yaw); detection = 0; grace = 1.6; hitsLeft = spec.door.hits; picking = false;
  for (const g of guards) g.reset(); cam.init = false; sfx('reset');
}

// ================================================================== lockpicking
function tryStartPick() {
  if (picking || level.doorUnlocked || !nearDoor) return; picking = true; P.picking = true; needleT = 0; randomizeZone(); pickSpeedMul = 1; sfx('pickOn');
}
function stopPick() { picking = false; P.picking = false; }
function attemptHit() {
  if (!picking) return; const v = (Math.sin(needleT) + 1) / 2; // triangle-ish via sine, 0..1
  if (v >= zoneLo && v <= zoneHi) {
    hitsLeft--; pickFlash = 1; sfx('pickHit'); burst(new V3(level.door.x, 1.3, level.door.z), 0xffd34e, 10, 4, .1, .5, 8, 1); randomizeZone(); pickSpeedMul *= 1.16;
    if (hitsLeft <= 0) { level.unlockDoor(); stopPick(); sfx('pickDone'); ring(new V3(level.door.x, .05, level.door.z), 0x5fd97a, 4, .6); setBanner('UNLOCKED!', 'Get to the door', 1800); }
  } else { pickFlash = -1; detection = clamp(detection + .12, 0, 1); sfx('pickMiss'); randomizeZone(); }
}

function onCaught() {
  sfx('caught'); catches++; cam.shake = 1; setBanner('CAUGHT!', 'Back to the start of the wing', 1700); respawnInWing();
}
function onWingDone() {
  if (wingN >= WINGS.length - 1) { winGame(); return; }
  sfx('stage'); loadWing(wingN + 1);
}
function winGame() {
  state = 'win'; sfx('win'); const key = 'best', prevScore = load(key, null);
  const score = { t: totalT, catches }; const better = s => !prevScore || s.catches < prevScore.catches || (s.catches === prevScore.catches && s.t < prevScore.t);
  const isBest = better(score); if (isBest) save(key, score);
  $('winTime').textContent = fmtT(totalT); $('winCatches').textContent = catches === 0 ? 'None - clean escape!' : String(catches);
  const stars = catches === 0 ? 3 : catches <= 2 ? 2 : 1; $('winStars').textContent = '⭐'.repeat(stars);
  $('winBest').textContent = prevScore && !isBest ? ('Best run: ' + fmtT(prevScore.t) + ' · ' + prevScore.catches + ' caught') : 'New best run!';
  $('results').classList.remove('hide'); $('hud').style.visibility = 'hidden';
}

// ================================================================== per-frame simulation
function playStep(dt) {
  totalT += dt; grace = Math.max(0, grace - dt);
  const inp = P.inp; inp.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0); inp.mz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  P.step(dt, cam.yaw);
  nearDoor = !level.doorUnlocked && Math.hypot(P.pos.x - level.door.x, P.pos.z - level.door.z) < 2;
  if (picking) { needleT += dt * 2.4 * WINGS[wingN].needle.speed * pickSpeedMul; if (nearDoor === false) stopPick(); }
  pickFlash *= Math.max(0, 1 - dt * 4);
  let sawAny = false, closest = 1e9;
  for (const g of guards) g.update(dt, P, (seen, dist) => { if (seen) { sawAny = true; closest = Math.min(closest, dist); } });
  if (grace <= 0) {
    if (sawAny) {
      const range0 = 9, proxK = clamp(1.3 - closest / range0, .35, 1.3), rate = (P.moving && !picking ? .85 : .18) * proxK, shadowK = level.inShadow(P.pos.x, P.pos.z) ? .32 : 1;
      detection = clamp(detection + rate * shadowK * dt, 0, 1); if (detection > .8 && Math.random() < dt * 1.5) sfx('spot');
    } else detection = clamp(detection - 1.3 * dt, 0, 1);
    if (detection >= 1) onCaught();
  }
  if (level.doorUnlocked && Math.hypot(P.pos.x - level.door.x, P.pos.z - level.door.z) < 1.1) onWingDone();
  playerLight.position.set(P.pos.x, P.pos.y + 2.2, P.pos.z);
  updateCamera(dt, P);
  updateHUD();
}
function updateHUD() {
  $('wingTag').textContent = 'WING ' + (wingN + 1) + ' · ' + WINGS[wingN].name.toUpperCase();
  $('timer').textContent = fmtT(totalT); $('catchCount').textContent = String(catches);
  $('detectFill').style.width = (detection * 100) + '%'; $('detectFill').style.background = detection > .75 ? '#ff4040' : detection > .4 ? '#ffb020' : '#ffe066';
  $('detectWrap').classList.toggle('danger', detection > .75);
  $('hint').textContent = picking ? '' : nearDoor ? 'Press E / tap PICK to work the lock' : (detection > .55 ? 'FREEZE! Someone is looking your way' : '');
  $('pickUI').classList.toggle('hide', !picking);
  if (picking) {
    const v = (Math.sin(needleT) + 1) / 2; $('needle').style.left = (v * 100) + '%'; $('zoneMark').style.left = (zoneLo * 100) + '%'; $('zoneMark').style.width = ((zoneHi - zoneLo) * 100) + '%';
    $('pickHits').textContent = '⭐'.repeat(Math.max(0, WINGS[wingN].door.hits - hitsLeft)) + '☆'.repeat(hitsLeft);
    $('pickBar').classList.toggle('flashGood', pickFlash > .5); $('pickBar').classList.toggle('flashBad', pickFlash < -.5);
  }
}

// ================================================================== loop
let last = performance.now();
function step(dt) { W.time += dt; updateFX(dt); if (state === 'play') playStep(dt); }
function render() { renderer.render(scene, camera); }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; if (state !== 'pause') step(dt); render(); adaptRes(raw, state === 'play'); requestAnimationFrame(loop); }

// ================================================================== input
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return; if (!keys[e.code] || !e.repeat) keys[e.code] = true; if (e.repeat) return;
  if (e.code === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); return; }
  if (state !== 'play') return;
  if (e.code === 'KeyE') { if (picking) attemptHit(); else tryStartPick(); }
  if (e.code === 'Space') { e.preventDefault(); if (picking) attemptHit(); else tryStartPick(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseGame(); });
function pauseGame() { if (state !== 'play') return; state = 'pause'; $('pause').classList.remove('hide'); }
function resumeGame() { if (state !== 'pause') return; state = 'play'; $('pause').classList.add('hide'); audioInit(); }

// drag to look around (desktop: hold left mouse button and move; no pointer lock needed)
let dragging = false, lastMX = 0, lastMY = 0;
$('view').addEventListener('mousedown', e => { if (state !== 'play') return; dragging = true; lastMX = e.clientX; lastMY = e.clientY; });
addEventListener('mousemove', e => { if (!dragging) return; cam.yaw -= (e.clientX - lastMX) * .006; cam.pitch = clamp(cam.pitch + (e.clientY - lastMY) * .004, -.05, .95); cam.manual = 1.4; lastMX = e.clientX; lastMY = e.clientY; });
addEventListener('mouseup', () => dragging = false);

function hideScreens() { for (const id of ['menu', 'pause', 'results']) $(id).classList.add('hide'); }
function showMenu() { state = 'menu'; clearWing(); hideScreens(); $('menu').classList.remove('hide'); $('hud').style.visibility = 'hidden'; const b = load('best', null); $('menuBest').textContent = b ? ('Best escape: ' + fmtT(b.t) + ' · ' + b.catches + ' caught') : 'No escapes yet - you\'ve got this.'; }
$('play').onclick = startRun; $('resume').onclick = resumeGame; $('quitPause').onclick = showMenu; $('again').onclick = startRun; $('menuBtn').onclick = showMenu;
const vol = $('vol'); if (vol) { vol.value = S.vol; vol.oninput = () => { setVolume(+vol.value); save('vol', S.vol); }; }

if (TOUCH) {
  initTouch({
    visible: () => state === 'play',
    stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
    buttons: [
      { label: 'PICK', cls: 'fire', type: 'tap', action: () => { if (picking) attemptHit(); else tryStartPick(); }, s: 92, r: 24, b: 54 },
      { label: 'II', type: 'tap', action: () => pauseGame(), s: 40, r: 12, t: 40, cls: 'small', fs: 14 },
    ],
    css: `html.touch #hint { bottom: 150px; } html.touch #pickUI { bottom: 166px; }`,
  });
}
showMenu(); requestAnimationFrame(loop);
if (DEBUG) window.__edt = {
  get P() { return P; }, get guards() { return guards; }, get level() { return level; }, get wingN() { return wingN; }, get catches() { return catches; }, get hitsLeft() { return hitsLeft; }, get picking() { return picking; }, get needleT() { return needleT; }, get zoneLo() { return zoneLo; }, get zoneHi() { return zoneHi; },
  WINGS, world, state: () => state, startRun, loadWing, keys, detection: () => detection,
  tryStartPick, attemptHit,
  // deterministic sim: advances n virtual steps of dt seconds each, calling inputFn(i) first each step (no real-time wait, no visibility throttling)
  simulate(n, dt, inputFn) { for (let i = 0; i < n; i++) { if (inputFn) inputFn(i); if (state === 'play') playStep(dt); } },
};
