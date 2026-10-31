// Liftoff Labs: the main controller. Home, hangar, flying, money and goals all meet here.
import { V, Q, clamp } from './vec.js?v=2';
import { BODIES, PARTS, G0 } from './data.js?v=2';
import * as S from './sim.js?v=2';
import { FlightView } from './flight3d.js?v=2';
import { Bubble } from './bubble.js?v=2';
import { Sound } from './audio.js?v=2';
import { career, settings, saveSettings, fmt$, loadLast, saveLast } from './career.js?v=2';
import { Icons, Preview } from './icons.js?v=2';
import { Builder } from './build.js?v=2';
import { TOUCH, initTouch } from './touch.js?v=1';
import { Goals } from './goals.js?v=2';
import { MapView } from './map.js?v=2';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const DEBUG = qs.has('debug');
const isCros = /\bCrOS\b/.test(navigator.userAgent);
const quality = qs.get('gfx') === 'low' ? 'low' : qs.get('gfx') === 'high' ? 'high' : (settings.quality || (isCros ? 'low' : 'high'));

const canvas = $('view');
let view;
try { view = new FlightView(canvas, { quality }); }
catch (e) { $('loading').innerHTML = 'Sorry, this game needs WebGL (3D graphics), and your browser could not start it.'; throw e; }
const sound = new Sound(); sound.vol = settings.vol; sound.setVolume(settings.vol);
const icons = new Icons(view.renderer), preview = new Preview(view.renderer);
const bubble = new Bubble(view.renderer, $('bubbleCv'));

// ---------------------------------------------------------------- small helpers
const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
function fmtDist(m) { const a = Math.abs(m); if (!isFinite(m)) return '-'; if (a < 10000) return fmtNum(m) + ' m'; if (a < 1e7) return (m / 1000).toFixed(a < 1e5 ? 1 : 0) + ' km'; return (m / 1e6).toFixed(1) + ' Mm'; }
function fmtSpeed(v) { return (v < 1000 ? v.toFixed(v < 100 ? 1 : 0) : fmtNum(v)) + ' m/s'; }
function fmtTime(s) {
  if (!isFinite(s)) return '-'; s = Math.max(0, s);
  if (s < 60) return s.toFixed(0) + 's'; if (s < 3600) return Math.floor(s / 60) + 'm ' + String(Math.floor(s % 60)).padStart(2, '0') + 's';
  if (s < 86400) return Math.floor(s / 3600) + 'h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + 'm'; return Math.floor(s / 86400) + 'd ' + Math.floor(s % 86400 / 3600) + 'h';
}
function toast(text, cls, small) {
  const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.innerHTML = text + (small ? '<small>' + small + '</small>' : '');
  const box = $('msgs'); box.appendChild(d); while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 5000);
}

// ---------------------------------------------------------------- state
let enc = null, encN = null, nodeInfo = null, encT = 0, warpTarget = null, state = 'loading', W = null, fl = null, paused = false, mapOn = false, warpIdx = 0, acc = 0, checkT = 0, hudT = 0, lastTime = performance.now(), fpsN = 0, fpsT = 0;
const WARPS = [1, 2, 3, 4, 5, 10, 50, 100, 1000, 10000, 100000];
const keys = new Set();
let builder, goals, map;

const showHud = (on) => $('hud').classList.toggle('hide', !on);
const show = (id, on) => $(id).classList.toggle('hide', !on);
function updateMoney() { const t = career.sandbox() ? 'Sandbox' : fmt$(career.funds); $('menuMoney').textContent = t; $('vMoney').textContent = t; }

// ---------------------------------------------------------------- home (the pad is empty until you have built something)
function enterMenu() {
  state = 'menu'; paused = false; mapOn = false; fl = null;
  W = S.createWorld();
  const d = loadLast();
  if (d && d.parts.length) { try { S.addMain(W, d); } catch (e) { /* a broken save just means an empty pad */ } }
  view.clearFx(); view.views.forEach((v) => v.dispose()); view.views.clear(); view.lastMain = null;
  view.mode = 'local'; view.yaw = 0.9; view.pitch = 0.1; view.dist = 15; view.sideShift = innerWidth > 900 ? 0.27 : 0;
  showHud(false); show('vab', false); show('menu', true); show('pause', false); show('result', false); builder && builder.close();
  updateMoney();
}

// ---------------------------------------------------------------- flight
function startFlight(design) {
  state = 'flight'; paused = false; mapOn = false; warpIdx = 0; acc = 0; view.sideShift = 0; enc = null; encN = null; nodeInfo = null; encT = 0;
  W = S.createWorld({ easy: settings.easy, ut: Math.floor(Math.random() * 90000) });
  const v = S.addMain(W, design);
  v.ctl.sas = true; v.ctl.mode = 'hold'; v.ctl.target = v.q.slice();
  fl = { design, rewards: [], visitedBean: false, landedBean: false, wasOrbit: false, ended: false, endT: 0, started: performance.now() };
  view.clearFx(); view.views.forEach((x) => x.dispose()); view.views.clear(); view.lastMain = null;
  const h = Math.max(...v.alive.map((p) => p.pos[1] + p.def.h / 2)) - Math.min(...v.alive.map((p) => p.pos[1] - p.def.h / 2));
  view.mode = 'local'; view.yaw = 0.9; view.pitch = 0.18; view.dist = Math.max(14, h * 1.7 + 8); view.minDist = 3;
  show('menu', false); builder.close(); show('result', false); show('pause', false); showHud(true); map && map.hide();
  $('hud').classList.remove('mapmode'); $('mapLabels').classList.add('hide'); $('mapTools').classList.add('hide'); $('nodeP').classList.add('hide'); for (const id of ['nP', 'nN', 'nR']) $(id).value = 0;
  $('msgs').innerHTML = '';
  warpTarget = null; buildModes(); sound.start();
  saveLast(design); career.stats.flights++; career.save();
}

function endFlight(kind) {
  if (fl.ended) return; fl.ended = true; fl.endT = 0; fl.kind = kind;
  career.save();
}
function showResult() {
  const v = W.main, kind = fl.kind;
  $('rTitle').textContent = kind === 'landed' ? (S.telemetry(v, W).body === 'bean' ? 'Landed on Bean!' : 'Soft landing!') : 'KABOOM!';
  $('rText').innerHTML = kind === 'landed' ? 'The Pip waves hello. Great flying! You went as high as <b>' + fmtDist(v.maxAlt) + '</b> and as fast as <b>' + fmtSpeed(v.maxSpeed) + '</b>.'
    : 'The rocket went boom, but the Pip is fine: it popped out in a bouncy bubble. You got up to <b>' + fmtDist(v.maxAlt) + '</b>.';
  $('rRewards').innerHTML = fl.rewards.length ? fl.rewards.map((r) => '<div><span>' + r.name + '</span><b>+' + fmt$(r.reward) + '</b></div>').join('') : '<p class="fine">No money this time. Open Goals for ideas!</p>';
  show('result', true); show('pause', false);
  career.stats.bestAlt = Math.max(career.stats.bestAlt, v.maxAlt); career.stats.bestSpeed = Math.max(career.stats.bestSpeed, v.maxSpeed);
  if (kind === 'landed') career.stats.landings++; career.save();
}

// ---------------------------------------------------------------- the "next thing" button (what Space does)
function nextAction(v) {
  const s = S.nextStage(v);
  if (s === undefined) return null;
  const items = v.parts.filter((p) => p.alive && p.stage === s);
  const eng = items.filter((p) => p.def.F !== undefined), dec = items.filter((p) => p.def.cat === 'decoupler'), ch = items.filter((p) => p.chute);
  const firstLight = eng.length && !v.engines.some((e) => e.ign);
  const boosters = dec.some((p) => p.def.shape === 'clip');
  let text, sub = '';
  if (firstLight) { text = 'Light the engine!'; sub = 'Space'; }
  else if (dec.length && eng.length) { text = 'Pop it off and light the next engine!'; sub = 'Space'; }
  else if (dec.length) { text = boosters ? 'Drop the boosters!' : 'Drop the empty part!'; sub = 'Space'; }
  else if (eng.length) { text = 'Light the next engine!'; sub = 'Space'; }
  else if (ch.length) { text = 'Open the umbrella!'; sub = 'Space'; }
  else { text = 'Do the next thing!'; sub = 'Space'; }
  return { text, sub, urgent: !!(dec.length && (v.engines.some((e) => e.starved || e.out)) ) };
}
function doStage() {
  const v = W && W.main; if (!v || v.dead || fl.ended) return;
  if (S.stageNow(v, W)) {
    sound.stage();
    if (v.engines.some((e) => e.ign && !e.out && !e.def.solid) && v.ctl.thr < 0.05) v.ctl.thr = 1;      // lighting the engine also gives it power
  } else toast('Nothing left to press!', '');
}
$('nextBtn').onclick = () => doStage();

function buildModes() {
  const box = $('asModes'); if (box.children.length) return;
  for (const [id, label, key, tip] of [['hold', 'Stay', '1', 'Keep pointing the same way'], ['prograde', 'Follow path', '2', 'Point where you are going'], ['retro', 'Backwards', '3', 'Point the other way'], ['node', 'To boost', '8', 'Point where your planned boost goes']]) {
    const b = document.createElement('button'); b.textContent = label; b.dataset.m = id; b.title = tip + ' (' + key + ')'; b.onclick = () => setMode(id); box.appendChild(b);
  }
}
function setMode(id) {
  const v = W && W.main; if (!v || v.dead) return;
  v.ctl.sas = true; v.ctl.mode = id; if (id === 'hold') v.ctl.target = v.q.slice();
  sound.click();
}
$('asOn').onclick = () => { const v = W && W.main; if (v && !v.dead) { v.ctl.sas = !v.ctl.sas; if (v.ctl.sas && v.ctl.mode === 'hold') v.ctl.target = v.q.slice(); sound.click(); } };

// ---------------------------------------------------------------- input
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  sound.start();
  if (e.code === 'Escape') {                                   // Esc closes whatever window is open
    for (const id of ['settings', 'missions']) if (!$(id).classList.contains('hide')) { if (id === 'missions') goals.close(); else show(id, false); return; }
  }
  if (state !== 'flight') return;
  if (e.code === 'Escape') { if (!fl.ended) togglePause(); return; }
  if (paused || fl.ended) return;
  const v = W.main; if (!v || v.dead) return;
  switch (e.code) {
    case 'Space': doStage(); break;
    case 'KeyT': v.ctl.sas = !v.ctl.sas; if (v.ctl.sas && v.ctl.mode === 'hold') v.ctl.target = v.q.slice(); toast('Auto-steer ' + (v.ctl.sas ? 'ON' : 'OFF'), v.ctl.sas ? 'good' : ''); break;
    case 'Digit1': setMode('hold'); break; case 'Digit2': setMode('prograde'); break; case 'Digit3': setMode('retro'); break;
    case 'Digit4': setMode('normal'); break; case 'Digit5': setMode('anti'); break; case 'Digit6': setMode('radial'); break; case 'Digit7': setMode('radialIn'); break; case 'Digit8': setMode('node'); break;
    case 'KeyZ': v.ctl.thr = 1; break; case 'KeyX': v.ctl.thr = 0; break;
    case 'KeyG': { const legs = v.legs; if (!legs.length) { toast('This rocket has no legs', ''); break; } const out = !legs[0].leg.out; legs.forEach((p) => { p.leg.out = out; }); S.rebuild(v); toast('Legs ' + (out ? 'OUT' : 'IN'), ''); break; }
    case 'KeyM': toggleMap(); break;
    case 'KeyV': view.mode = view.mode === 'local' ? 'ship' : 'local'; toast(view.mode === 'local' ? 'Camera stays level' : 'Camera follows the rocket', ''); break;
    case 'Period': changeWarp(1); break; case 'Comma': changeWarp(-1); break;
    case 'Slash': warpIdx = 0; warpTarget = null; break;
  }
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); });
window.addEventListener('blur', () => keys.clear());

let drag = null;
canvas.addEventListener('pointerdown', (e) => { if (state === 'flight' || state === 'menu') { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); sound.start(); } });
window.addEventListener('pointermove', (e) => { if (!drag || (state !== 'flight' && state !== 'menu')) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (mapOn) map.drag(dx, dy); else view.drag(dx, dy); });
window.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { if (state === 'flight' || state === 'menu') { e.preventDefault(); if (mapOn) map.zoom(e.deltaY > 0 ? 1.12 : 0.89); else view.zoom(e.deltaY > 0 ? 1.1 : 0.9); } }, { passive: false });
window.addEventListener('resize', () => { view.resize(); builder.resize(); });

// the power lever
(() => {
  const bar = $('throt'); let on = false;
  const set = (e) => { const r = bar.getBoundingClientRect(); const v = W && W.main; if (v) v.ctl.thr = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); };
  bar.addEventListener('pointerdown', (e) => { on = true; bar.setPointerCapture(e.pointerId); set(e); e.stopPropagation(); });
  bar.addEventListener('pointermove', (e) => { if (on) set(e); }); bar.addEventListener('pointerup', () => { on = false; });
})();

function togglePause() { paused = !paused; show('pause', paused); }
function changeWarp(d) {
  warpTarget = null; const want = clamp(warpIdx + d, 0, WARPS.length - 1);
  if (d > 0 && WARPS[want] > 4 && !S.canRails(W)) { toast('Super-speed time needs space', 'bad', 'Get above the sky (60 km) and turn the engines off.'); return; }
  if (d > 0 && WARPS[want] > 4 && S.timeToAir(W) < 30) { toast('The sky is coming up!', 'bad', 'Too close to the air to skip ahead.'); return; }
  warpIdx = want;
}
function warpTo(kind) {
  if (kind === 'node') { const nb = nodeInfo; if (!nb || nb.dt < 60) { toast('Plan a boost first (move a slider)', ''); return; } if (!S.canRails(W)) { toast('Cannot skip ahead here', 'bad'); return; } warpTarget = W.ut + nb.dt - (isFinite(nb.burnTime) ? nb.burnTime / 2 : 0) - 40; toast('Skipping to your boost', '', 'Stops just before it starts'); return; }
  if (kind === 'enc') { const e = shownEnc(); if (!e) { toast('Your path does not go near Bean', ''); return; } if (!S.canRails(W)) { toast('Cannot skip ahead here', 'bad'); return; } warpTarget = e.tAt - 120; toast('Skipping to Bean', '', 'Stops 2 minutes before you arrive'); return; }
  const v = W.main; if (!v || v.dead) return;
  if (!S.canRails(W)) { toast('Cannot skip ahead here', 'bad', 'Get above the sky and turn the engines off first.'); return; }
  const T = S.telemetry(v, W);
  const t = kind === 'ap' ? orbitTime(T.el, 'ap') : orbitTime(T.el, 'pe');
  if (!isFinite(t) || t < 5) { toast('That point is not coming up soon', ''); return; }
  warpTarget = W.ut + t - 30; toast('Skipping to your ' + (kind === 'ap' ? 'highest' : 'lowest') + ' point', '', 'Stops 30 seconds before');
}
const orbitTime = (el, k) => { if (!el.bound) return k === 'pe' ? -el.M / el.n : Infinity; const w = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return k === 'ap' ? w(Math.PI - el.M) / el.n : (2 * Math.PI - w(el.M)) / el.n; };
function nodeVals() { return [+$('nP').value, +$('nN').value, +$('nR').value]; }
function ensureNode(kind) {
  const v = W && W.main; if (!v || v.dead) return;
  const [p, n, r] = nodeVals();
  if (!W.node || kind) {
    const T = S.telemetry(v, W);
    W.node = S.makeNode(W, kind || (T.el.bound && T.alt > (BODIES[T.body].atm ? BODIES[T.body].atm.top : 0) ? 'ap' : '5'), p, n, r);
  } else { W.node.p = p; W.node.n = n; W.node.r = r; }
  encT = 0; nodeInfo = S.nodeBurn(W, W.node); paintNode();
}
function paintNode() {
  $('nPv').textContent = $('nP').value; $('nNv').textContent = $('nN').value; $('nRv').textContent = $('nR').value;
  const nb = W && W.node ? nodeInfo || S.nodeBurn(W, W.node) : null, sum = $('nSum');
  if (!nb) { sum.textContent = 'Move a slider to plan a boost. The pink path shows where it takes you.'; return; }
  const R = BODIES[W.node.body].R;
  const e = W.node.body === 'cobble' ? encN : null;
  sum.innerHTML = 'Boost of <b>' + fmtNum(nb.mag) + ' m/s</b> in <b>' + (nb.dt > 0 ? fmtTime(nb.dt) : 'now') + '</b>' + (isFinite(nb.burnTime) ? ' (takes about <b>' + fmtTime(nb.burnTime) + '</b>)' : '') + '.<br>New path: highest <b>' + (nb.el.bound ? fmtDist(nb.el.ra - R) : 'forever') + '</b>, lowest <b>' + fmtDist(nb.el.rp - R) + '</b>.' +
    (e ? '<br><b style="color:#1b8fd0">You would reach Bean!</b> in ' + fmtTime(e.tAt - W.ut) + '.' : '');
}
function toggleMap() {
  mapOn = !mapOn; map.show(mapOn);
  $('mapLabels').classList.toggle('hide', !mapOn); $('mapTools').classList.toggle('hide', !mapOn); $('hud').classList.toggle('mapmode', mapOn); if (!mapOn) $('nodeP').classList.add('hide');
  if (mapOn) toast('Map view', '', 'Drag to look around. Wheel to zoom. Press M to go back.');
}

// ---------------------------------------------------------------- flight loop pieces
function applyControls(dt) {
  const v = W.main; if (!v || v.dead) return;
  const c = v.ctl, k = (a) => keys.has(a);
  c.p = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  c.y = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
  c.r = (k('KeyQ') ? 1 : 0) - (k('KeyE') ? 1 : 0);
  if (k('ShiftLeft') || k('ShiftRight')) c.thr = Math.min(1, c.thr + dt * 0.7);
  if (k('ControlLeft') || k('ControlRight')) c.thr = Math.max(0, c.thr - dt * 0.7);
  if (k('ArrowLeft')) view.yaw += dt * 1.6; if (k('ArrowRight')) view.yaw -= dt * 1.6;
  if (k('ArrowUp')) view.pitch = clamp(view.pitch + dt * 1.2, -1.45, 1.5); if (k('ArrowDown')) view.pitch = clamp(view.pitch - dt * 1.2, -1.45, 1.5);
  if (k('PageUp')) (mapOn ? map : view).zoom(0.97); if (k('PageDown')) (mapOn ? map : view).zoom(1.03);
}

function processEvents() {
  const evs = W.events.splice(0), v = W.main;
  const booms = evs.filter((e) => e.t === 'boom').length, bscale = booms > 1 ? 1 / Math.sqrt(booms) : 1; let boomSound = 0;
  for (const e of evs) {
    if (e.t === 'boom') { if (e.body === view.frameBody) { view.boom(e.pos, e.size, bscale); if (boomSound++ < 2) sound.boom(e.size); if (e.main) view.shake = Math.min(1.2, view.shake + 0.35 * e.size); } }
    else if (!e.main) continue;
    else if (e.t === 'flameout') { toast('Out of fuel!', 'bad', S.nextStage(v) !== undefined ? 'Press Space to drop it and keep going' : ''); }
    else if (e.t === 'siphon') { toast('That part is empty!', '', 'Press Space to drop it. Until then it drinks the fuel above it.'); }
    else if (e.t === 'burnout') { toast('Booster is empty!', '', 'Press Space to drop it'); }
    else if (e.t === 'chute') { if (e.what === 'open') { toast('Umbrella open!', 'good'); sound.chute(); } else if (e.what === 'semi') { toast('Umbrella opening', ''); sound.chute(); } else if (e.what === 'auto') toast('Umbrella is ready', '', 'Easy mode helps you land'); else toast('The umbrella ripped: too fast!', 'bad'); }
    else if (e.t === 'crash') { sound.touch(); }
    else if (e.t === 'soi') { warpIdx = 0; fl[e.body === 'bean' ? 'visitedBean' : 'x'] = true; toast(e.body === 'bean' ? 'Hello, moon Bean!' : 'Back near home', 'good'); }
    else if (e.t === 'rest') { sound.touch(); }
  }
  if (!v || fl.ended) return;
  if (v.dead) endFlight('crashed');
}

function flightSummary(v, T) {
  const bean = T.body === 'bean';
  const landed = v.asleep && v.touching > 0 && v.flew;
  const orbit = T.body === 'cobble' && T.el.bound && T.pe > 60000 && T.alt > 60000;
  if (orbit) fl.wasOrbit = true;
  if (bean && landed) fl.landedBean = true;
  const padD = V.len(V.sub(v.r, V.mul([1, 0, 0], BODIES.cobble.R)));
  return {
    alt: T.alt, landed, staged: v.stagedAny, maxAlt: v.maxAlt, maxSpeed: v.maxSpeed, orbit, orbitPe: T.body === 'cobble' && T.el.bound ? T.pe : -1e9,
    body: T.body, flightAlt: v.maxAlt, safe: !v.dead && v.alive.some((p) => p.def.cat === 'pod'), padDist: padD, wasOrbit: fl.wasOrbit, visitedBean: fl.visitedBean || bean,
    beanOrbit: bean && T.el.bound && T.pe > 8000, landedBean: fl.landedBean, flightNo: career.stats.flights,
  };
}

function runCareer(v, T) {
  const got = career.check(flightSummary(v, T));
  for (const g of got) {
    fl.rewards.push(g);
    toast((g.kind === 'contract' ? 'Job done! ' : 'First! ') + g.name, 'good', career.sandbox() ? '' : '+' + fmt$(g.reward));
    sound.good();
  }
}

const shownEnc = () => (W.node ? encN : enc);
function hud(v, T) {
  const c = v.ctl;
  $('met').textContent = fmtTime(v.met);
  const rate = WARPS[warpIdx];
  $('warpTxt').textContent = rate > 1 ? 'x' + fmtNum(rate) : '';
  // the little instruments
  $('throtF').style.height = (c.thr * 100) + '%'; $('throtT').textContent = Math.round(c.thr * 100) + '%';
  let liq = 0, liqMax = 0, sol = 0, solMax = 0;
  for (const p of v.alive) { if (p.def.fuel) { if (p.def.solid) { sol += p.fuel; solMax += p.def.fuel; } else { liq += p.fuel; liqMax += p.def.fuel; } } }
  $('fuelBar').style.height = (liqMax ? liq / liqMax * 100 : 0) + '%'; $('solRow').style.display = solMax ? '' : 'none'; $('solBar').style.height = (solMax ? sol / solMax * 100 : 0) + '%';
  $('asOn').classList.toggle('on', c.sas); $('asOn').textContent = c.sas ? 'Auto-steer: ON' : 'Auto-steer: off';
  for (const b of $('asModes').children) { b.classList.toggle('sel', c.sas && b.dataset.m === c.mode); if (b.dataset.m === 'node') b.disabled = !W.node; }
  // the next thing
  const na = nextAction(v), nb = $('nextBtn');
  if (na) { nb.innerHTML = na.text + '<small>press ' + na.sub + '</small>'; nb.disabled = false; nb.classList.toggle('glow', na.urgent || (v.asleep && !v.flew)); nb.classList.toggle('go', true); }
  else { nb.innerHTML = 'All done pressing!<small>nothing left</small>'; nb.disabled = true; nb.classList.remove('glow'); }
  // numbers, in plain words
  const bn = BODIES[T.body];
  const r = (k, val) => '<div class="r"><span>' + k + '</span><b>' + val + '</b></div>';
  const inSpace = T.alt > 40000, high = T.alt > 1500 || inSpace;
  $('hRight').innerHTML = '<div class="lbl">' + (T.body === 'bean' ? 'HEIGHT ABOVE BEAN' : 'HEIGHT') + '</div><div class="big">' + fmtDist(T.alt) + '</div>' +
    '<div class="lbl">SPEED</div><div class="big" style="font-size:24px">' + fmtSpeed(T.speed) + ' <small>' + (T.vspeed > 2 ? '↑ going up' : T.vspeed < -2 ? '↓ falling' : '') + '</small></div>' +
    (high ? r('Highest point', isFinite(T.ap) ? fmtDist(T.ap) : 'forever') + (T.pe > 0 ? r('Lowest point', fmtDist(T.pe)) : '') : '') +
    (inSpace && isFinite(T.ap) && T.ap > 0 ? r('Time to highest', fmtTime(orbitTime(T.el, 'ap'))) : '') +
    (shownEnc() ? r('Bean ahead in', fmtTime(shownEnc().tAt - W.ut)) : '') +
    (nodeInfo ? r('Boost in', nodeInfo.dt > 0 ? fmtTime(nodeInfo.dt) : 'NOW') + r('Boost left', fmtNum(nodeInfo.remMag) + ' m/s') + (isFinite(nodeInfo.burnTime) ? r('Takes about', fmtTime(nodeInfo.burnTime)) : '') : '');
  $('heat').style.opacity = view.heat || 0;
  // Pip says
  const tip = pipSays(v, T), box = $('pipSays');
  if (tip) { box.textContent = tip; box.classList.remove('hide'); } else box.classList.add('hide');
  void bn;
}
function pipSays(v, T) {
  const c = v.ctl, beginner = career.stats.flights <= 3;
  const chute = v.chutes.find((p) => p.chute.state === 'armed' || p.chute.state === 'semi');
  if (chute) return chute.chute.state === 'armed' ? 'Umbrella ready! It pops open by itself when we fall.' : (T.alt > 4000 ? 'Wheee, floating! Press . to skip ahead.' : 'Almost there! Brace for a soft landing!');
  if (v.asleep && !v.flew) return v.engines.some((e) => e.ign) ? (c.thr > 0 ? '' : 'Hold SHIFT for more power!') : 'Press SPACE to light the engine! 3... 2... 1...';
  if (!beginner) return '';
  if (T.thrust > 0 && T.speed > 60 && T.alt < 20000 && T.pitch > 84 && T.vspeed > 0 && T.body === 'cobble') return 'Nice! Now tap W to tip us over a bit, then press 2 so I follow the path!';
  if (T.thrust <= 0 && T.alt > 60000 && T.pe < 60000 && v.engines.length && T.vspeed > -50 && v.engines.some((e) => !e.out && !e.starved)) return 'We are in SPACE!! Press . to skip ahead, then push forward at the highest point to go around!';
  if (T.alt < 30000 && T.vspeed < -30 && T.thrust <= 0 && v.chutes.length && v.chutes.every((p) => p.chute.state === 'stowed') && v.met > 20) return 'Eeek! Press SPACE to open the umbrella!';
  return '';
}

function drawBubble(v, T) {
  const pathDir = T.speed > 0.5 ? V.mul(v.v, 1 / T.speed) : null;
  const burnDir = nodeInfo && nodeInfo.remMag > 0.05 ? V.mul(nodeInfo.rem, 1 / nodeInfo.remMag) : null;
  bubble.draw(v.q, T.frame, pathDir, burnDir);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000); lastTime = now;
  fpsN++; fpsT += dt; if (fpsT > 0.5) { $('fps').textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsN = 0; fpsT = 0; }
  if (state === 'loading') return;
  if (state === 'menu') { view.yaw += dt * 0.12; view.frame(W, dt); sound.update(0, 0, 0, true); return; }
  if (state === 'build') { builder.render(dt); if (builder.cardId) preview.render(dt); return; }
  // ---- flight
  const v = W.main;
  if (!paused) {
    applyControls(dt);
    if (warpTarget !== null) {
      const rem = warpTarget - W.ut;
      if (rem <= 2 || !S.canRails(W)) { warpTarget = null; warpIdx = 0; if (rem <= 2) toast('Here we are!', 'good'); }
      else { let idx = 5; while (idx + 1 < WARPS.length && WARPS[idx + 1] * dt * 2 < rem) idx++; warpIdx = idx; }
    }
    const rate = WARPS[warpIdx];
    if (rate <= 4) {
      acc += dt * rate;
      let n = 0; while (acc >= S.DT && n < 60) { S.stepWorld(W, S.DT); acc -= S.DT; n++; }
      if (n >= 60) acc = 0;
    } else {
      if (!S.canRails(W)) { warpIdx = 3; toast('Time skip stopped', '', 'The engines or the air stopped it.'); }
      else {
        let total = dt * rate;
        const tair = S.timeToAir(W);
        if (isFinite(tair) && tair < total + 20) { total = Math.max(0, tair - 20); warpIdx = 0; toast('Stopped: the sky is coming up!', 'bad'); }
        const nsub = Math.max(1, Math.ceil(total / 150)), sub = total / nsub;
        for (let i = 0; i < nsub; i++) S.railsStep(W, sub);
        for (const vv of W.vessels) for (const e of vv.events.splice(0)) W.events.push(Object.assign({ vid: vv.id, main: vv === W.main }, e));
      }
    }
    processEvents();
    if (v && !v.dead) {
      checkT += dt; hudT += dt;
      if (checkT > 0.25) { checkT = 0; runCareer(v, S.telemetry(v, W)); }
    } else if (v && v.dead && !fl.ended) endFlight('crashed');
    if (!fl.ended && v && !v.dead && v.asleep && v.flew && v.touching) { fl.restT = (fl.restT || 0) + dt; if (fl.restT > 1.2) { runCareer(v, S.telemetry(v, W)); endFlight('landed'); } } else fl.restT = 0;
    if (fl.ended) { fl.endT += dt; if (fl.endT > (fl.kind === 'crashed' ? 2.6 : 1.4) && $('result').classList.contains('hide')) showResult(); }
  }
  const T = v && !v.dead ? S.telemetry(v, W) : null;
  if (T && !paused) {
    if (W.node && W.node.body !== v.body) W.node = null;
    nodeInfo = W.node ? S.nodeBurn(W, W.node) : null;
    if (nodeInfo && W.ut >= W.node.ut - 2 && nodeInfo.remMag < 1.5) { W.node = null; nodeInfo = null; encN = null; toast('Boost done!', 'good'); sound.good(); paintNode(); }
    else if (nodeInfo && W.ut > W.node.ut + Math.max(180, (isFinite(nodeInfo.burnTime) ? nodeInfo.burnTime : 0) * 2) && nodeInfo.remMag > 5) { W.node = null; nodeInfo = null; encN = null; toast('The planned boost ran out of time', ''); paintNode(); }
    encT -= dt;
    if (encT <= 0) {
      encT = 0.6;
      try { enc = S.predictEncounter(W); } catch (e) { enc = null; }
      try { encN = W.node && v.body === 'cobble' ? S.predictEncounterFrom(W.node.ut, W.node.base.r, nodeInfo.vPost) : null; } catch (e) { encN = null; }
      if (mapOn) paintNode();
    }
  }
  if (T && hudT > 0.06) { hudT = 0; hud(v, T); }
  if (T && !mapOn) drawBubble(v, T);
  sound.update(T ? clamp(T.thrust / Math.max(1, v.engines.reduce((s, e) => s + e.def.F, 0)), 0, 1) : 0, T ? T.q : 0, T ? T.rho : 0, paused);
  if (mapOn && v && !v.dead) map.frame(W, dt, W.node ? encN : enc, nodeInfo);
  else view.frame(W, paused ? 0 : dt);
  if (DEBUG) window.__ll.T = T;
}

// ---------------------------------------------------------------- wiring
function openBuilder(design) {
  state = 'build'; show('menu', false);
  builder.open(design || loadLast() || undefined); updateMoney();
}
builder = new Builder(view, icons, preview, { sound, toast, onBack: () => enterMenu(), onLaunch: (d) => startFlight(d), openGoals: () => goals.open(), moneyChanged: updateMoney });
goals = new Goals({ closed: () => { updateMoney(); if (state === 'build') builder.afterChange(); } });
map = new MapView(view, () => W, $('mapLabels'));

$('mBuild').onclick = () => { sound.start(); sound.click(); openBuilder(); };
$('mGoals').onclick = () => { sound.start(); sound.click(); goals.open(); };
$('mSettings').onclick = () => { sound.start(); openSettings(); };
$('pSet').onclick = () => openSettings();
$('pResume').onclick = () => togglePause();
$('pRevert').onclick = () => { startFlight(fl.design); };
$('pHangar').onclick = () => { show('pause', false); paused = false; showHud(false); openBuilder(fl.design); };
$('rAgain').onclick = () => startFlight(fl.design);
$('rHangar').onclick = () => { show('result', false); showHud(false); openBuilder(fl.design); };
$('bPause').onclick = () => { if (!fl.ended) togglePause(); };
$('bMap').onclick = () => toggleMap();
$('wSlow').onclick = () => changeWarp(-1); $('wFast').onclick = () => changeWarp(1); $('wStop').onclick = () => { warpIdx = 0; warpTarget = null; };
$('nodeBtn').onclick = () => { $('nodeP').classList.toggle('hide'); paintNode(); };
$('wEnc').onclick = () => warpTo('enc'); $('nAp').onclick = () => ensureNode('ap'); $('nPe').onclick = () => ensureNode('pe'); $('n5').onclick = () => ensureNode('5');
for (const id of ['nP', 'nN', 'nR']) { $(id).addEventListener('input', () => ensureNode()); $(id).addEventListener('change', (e) => e.target.blur()); }
$('nDel').onclick = () => { if (W) W.node = null; nodeInfo = null; encN = null; for (const id of ['nP', 'nN', 'nR']) $(id).value = 0; paintNode(); }; $('nWarp').onclick = () => warpTo('node');
$('wAp').onclick = () => warpTo('ap'); $('wPe').onclick = () => warpTo('pe'); $('wBack').onclick = () => toggleMap();
$('bCam').onclick = () => { view.mode = view.mode === 'local' ? 'ship' : 'local'; };

function openSettings() { show('settings', true); paintSettings(); }
function paintSettings() {
  $('setGfx').textContent = view.quality === 'high' ? 'Pretty' : 'Fast (Lite)';
  $('setMode').textContent = settings.mode === 'sandbox' ? 'On' : 'Off';
  $('setEasy').textContent = settings.easy ? 'On' : 'Off'; $('setEasy').classList.toggle('go', settings.easy); $('setVol').value = settings.vol;
  $('setSave').innerHTML = 'You have ' + fmt$(career.funds) + ' and finished ' + career.done.size + ' big firsts in ' + career.stats.flights + ' flights. Everything is saved in this browser. Use Save codes on the HKugz Games home page to take it to another computer.';
}
$('setClose').onclick = () => { show('settings', false); updateMoney(); };
$('setGfx').onclick = () => { const q = view.quality === 'high' ? 'low' : 'high'; view.setQuality(q); view.resize(); settings.quality = q; saveSettings(); paintSettings(); };
$('setMode').onclick = () => { settings.mode = settings.mode === 'sandbox' ? 'career' : 'sandbox'; saveSettings(); paintSettings(); updateMoney(); if (state === 'build') builder.afterChange(); };
$('setEasy').onclick = () => { settings.easy = !settings.easy; saveSettings(); paintSettings(); };
$('setVol').oninput = (e) => { settings.vol = +e.target.value; sound.setVolume(settings.vol); saveSettings(); };

// ---------------------------------------------------------------- go
if (DEBUG) window.__ll = { S, view, career, builder, startFlight, get W() { return W; }, get fl() { return fl; }, keys, openBuilder, enterMenu, goals, toast, settings, setWarp: (i) => { warpIdx = i; }, toggleMap, bubble, get state() { return state; } };
if (TOUCH) {   // tablets and phones: a steering stick, buttons for the keys, and the look pad turns the camera (or the map)
  document.addEventListener('mousemove', (e) => { if (e.isTrusted || state !== 'flight') return; if (mapOn) map.drag(e.movementX, e.movementY); else view.drag(e.movementX, e.movementY); });
  const tb = (label, key, o) => Object.assign({ label, key, type: 'tap', s: 52, cls: 'small', fs: 10 }, o);
  const hold = (label, key, o) => Object.assign({ label, key, s: 52, cls: 'small', fs: 10 }, o);
  initTouch({
    visible: () => state === 'flight' && !paused && !(fl && fl.ended) && ['settings', 'result', 'pause'].every((id) => $(id).classList.contains('hide')),
    pause: () => { if (state === 'flight' && !paused) togglePause(); }, lookScale: 1.4,
    stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
    css: '#hud { z-index: 5; }',   // the flight panels stay tappable above the touch layer
    buttons: [
      { label: 'GO!', cls: 'fire', key: 'Space', type: 'tap', s: 88, r: 24, b: 24 },
      tb('FULL', 'KeyZ', { r: 122, b: 24 }), tb('NONE', 'KeyX', { r: 122, b: 82 }),
      hold('MORE', 'ShiftLeft', { r: 182, b: 24 }), hold('LESS', 'ControlLeft', { r: 182, b: 82 }),
      hold('SPIN L', 'KeyQ', { r: 24, b: 124 }), hold('SPIN R', 'KeyE', { r: 82, b: 124 }),
      tb('AUTO', 'KeyT', { r: 24, b: 182, s: 46 }), tb('LEGS', 'KeyG', { r: 76, b: 182, s: 46 }), tb('CAMERA', 'KeyV', { r: 128, b: 182, s: 46, fs: 8 }),
      hold('ZOOM +', 'PageUp', { r: 24, b: 234, s: 46, fs: 9 }), hold('ZOOM -', 'PageDown', { r: 76, b: 234, s: 46, fs: 9 }),
      tb('SKIP +', 'Period', { r: 128, b: 234, s: 46, fs: 9 }), tb('SKIP -', 'Comma', { r: 180, b: 234, s: 46, fs: 9 }),
    ],
  });
}
$('loading').remove();
enterMenu();
requestAnimationFrame((t) => { lastTime = t; frame(t); });
