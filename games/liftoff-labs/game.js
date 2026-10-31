// Liftoff Labs: the main controller. Menu, builder, flight, money and missions all meet here.
import { V, Q, clamp } from './vec.js?v=1';
import { BODIES, STARTERS, PARTS, MILESTONE, G0 } from './data.js?v=1';
import * as S from './sim.js?v=1';
import { stagesOf, layout } from './design.js?v=1';
import { FlightView } from './flight3d.js?v=1';
import { Navball } from './navball.js?v=1';
import { Sound } from './audio.js?v=1';
import { career, settings, saveSettings, fmt$, loadLast, saveLast } from './career.js?v=1';
import { Icons, Preview } from './icons.js?v=1';
import { Builder } from './build.js?v=1';
import { Shop, Missions, LoadDlg } from './shop.js?v=1';
import { MapView } from './map.js?v=1';

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
const nav = new Navball($('nav'));
const icons = new Icons(view.renderer), preview = new Preview(view.renderer);

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
const hooks = { toast, sound };

// ---------------------------------------------------------------- state
let enc = null, encN = null, nodeInfo = null, encT = 0, warpTarget = null, state = 'loading', W = null, fl = null, paused = false, mapOn = false, warpIdx = 0, acc = 0, checkT = 0, hudT = 0, menuW = null, lastTime = performance.now(), fpsN = 0, fpsT = 0;
const WARPS = [1, 2, 3, 4, 5, 10, 50, 100, 1000, 10000, 100000];
const keys = new Set();
let builder, shop, missions, loadDlg, map;

function showHud(on) { $('hud').classList.toggle('hide', !on); }
function show(id, on) { $(id).classList.toggle('hide', !on); }
function updateMoney() { const t = career.sandbox() ? 'Sandbox' : fmt$(career.funds); $('menuMoney').textContent = t; $('vMoney').textContent = t; }

// ---------------------------------------------------------------- the space center (menu with the rocket on the pad)
function menuDesign() {
  const d = loadLast();
  if (d && d.parts.length) return d;
  const s = STARTERS[1]; return { name: s.name, v: 1, parts: s.parts, gnext: 99 };
}
function enterMenu() {
  state = 'menu'; paused = false; mapOn = false; fl = null;
  menuW = S.createWorld();
  const d = menuDesign();
  try { S.addMain(menuW, d); } catch (e) { S.addMain(menuW, { name: 'x', v: 1, parts: STARTERS[0].parts, gnext: 9 }); }
  W = menuW; view.clearFx(); view.views.forEach((v) => v.dispose()); view.views.clear();
  view.mode = 'local'; view.yaw = 0.9; view.pitch = 0.1; view.dist = 15; view.sideShift = innerWidth > 900 ? 0.27 : 0;
  showHud(false); show('vab', false); show('menu', true); show('pause', false); show('result', false); builder && builder.close();
  updateMoney();
  $('mShopSub').textContent = career.sandbox() ? 'Sandbox: every part is free' : career.locked().length + ' parts still locked';
}

// ---------------------------------------------------------------- flight
function startFlight(design) {
  state = 'flight'; paused = false; mapOn = false; warpIdx = 0; acc = 0; view.sideShift = 0; enc = null; encN = null; nodeInfo = null; encT = 0;
  W = S.createWorld({ easy: settings.easy, ut: Math.floor(Math.random() * 90000) });
  const v = S.addMain(W, design);
  v.ctl.sas = true; v.ctl.mode = 'hold'; v.ctl.target = v.q.slice();
  fl = { design, rewards: [], staged: false, visitedBean: false, landedBean: false, wasOrbit: false, ended: false, endT: 0, msgSent: {}, started: performance.now() };
  view.clearFx(); view.views.forEach((x) => x.dispose()); view.views.clear(); view.lastMain = null;
  const h = Math.max(...v.alive.map((p) => p.pos[1] + p.def.h / 2)) - Math.min(...v.alive.map((p) => p.pos[1] - p.def.h / 2));
  view.mode = 'local'; view.yaw = 0.9; view.pitch = 0.18; view.dist = Math.max(14, h * 1.7 + 8); view.minDist = 3;
  show('menu', false); builder.close(); show('result', false); show('pause', false); showHud(true); map && map.hide(); $('hud').classList.remove('mapmode'); $('mapLabels').classList.add('hide'); $('mapTools').classList.add('hide'); $('nodeP').classList.add('hide'); for (const id of ['nP', 'nN', 'nR']) $(id).value = 0;
  $('msgs').innerHTML = '';
  warpTarget = null; buildModes(); sound.start();
  toast('Ready on the pad', '', 'Press <b>Shift</b> or <b>Z</b> for throttle, then <b>Space</b> to light the engine!');
  saveLast(design); career.stats.flights++; career.save();
}

function endFlight(kind) {
  if (fl.ended) return; fl.ended = true; fl.endT = 0; fl.kind = kind;
  career.save();
}
function showResult() {
  const v = W.main, kind = fl.kind;
  const t = kind === 'landed' ? (S.telemetry(v, W).body === 'bean' ? 'Landed on Bean!' : 'Safe landing!') : 'Boom!';
  $('rTitle').textContent = t;
  $('rText').innerHTML = kind === 'landed' ? 'The Pip waves hello. Nice flying! Highest point: <b>' + fmtDist(v.maxAlt) + '</b>, top speed <b>' + fmtSpeed(v.maxSpeed) + '</b>.'
    : 'The rocket broke up, but the Pip is fine: it popped out in a bouncy rescue bubble. Highest point: <b>' + fmtDist(v.maxAlt) + '</b>.';
  $('rRewards').innerHTML = fl.rewards.length ? fl.rewards.map((r) => '<div><span>' + r.name + '</span><b>+' + fmt$(r.reward) + '</b></div>').join('') : '<p class="fine">No new rewards this time. Check the Missions list for ideas!</p>';
  show('result', true); show('pause', false);
  career.stats.bestAlt = Math.max(career.stats.bestAlt, v.maxAlt); career.stats.bestSpeed = Math.max(career.stats.bestSpeed, v.maxSpeed);
  if (kind === 'landed') career.stats.landings++; career.save();
}

const stageStr = (v) => { const g = {}; v.parts.forEach((p) => { if (p.alive && p.stage >= 0) (g[p.stage] = g[p.stage] || []).push(p); }); return g; };

function buildModes() {
  const box = $('modes'); if (box.children.length) return;
  const defs = [['hold', 'Hold', '1', 'Hold this direction'], ['prograde', 'Pro', '2', 'Point where you are flying (prograde)'], ['retro', 'Retro', '3', 'Point backwards (retrograde)'], ['normal', 'Nrm', '4', 'Orbit normal'], ['anti', 'Anti', '5', 'Anti-normal'], ['radial', 'Out', '6', 'Radial out'], ['radialIn', 'In', '7', 'Radial in'], ['node', 'Burn', '8', 'Point at your planned burn']];
  for (const [id, label, key, tip] of defs) { const b = document.createElement('button'); b.textContent = label; b.dataset.m = id; b.title = tip + ' (' + key + ')'; b.onclick = () => setMode(id); box.appendChild(b); }
}
function setMode(id) {
  const v = W && W.main; if (!v || v.dead) return;
  v.ctl.sas = true; v.ctl.mode = id; if (id === 'hold') v.ctl.target = v.q.slice();
  sound.click();
}

// ---------------------------------------------------------------- input
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  sound.start();
  if (e.code === 'Escape') {                                   // Esc closes whatever window is open
    for (const id of ['settings', 'loadDlg', 'missions', 'shop']) if (!$(id).classList.contains('hide')) { if (id === 'shop') shop.close(); else if (id === 'missions') { missions.close(); updateMoney(); } else show(id, false); return; }
  }
  if (state !== 'flight') return;
  if (e.code === 'Escape') { if (!$('settings').classList.contains('hide')) { show('settings', false); return; } if (!fl.ended) togglePause(); return; }
  if (paused || fl.ended) return;
  const v = W.main; if (!v || v.dead) return;
  switch (e.code) {
    case 'Space': if (S.stageNow(v, W)) sound.stage(); else toast('No more stages', '', ''); break;
    case 'KeyT': v.ctl.sas = !v.ctl.sas; if (v.ctl.sas && v.ctl.mode === 'hold') v.ctl.target = v.q.slice(); toast('Steering assist ' + (v.ctl.sas ? 'ON' : 'OFF'), v.ctl.sas ? 'good' : ''); break;
    case 'Digit1': setMode('hold'); break; case 'Digit2': setMode('prograde'); break; case 'Digit3': setMode('retro'); break;
    case 'Digit4': setMode('normal'); break; case 'Digit5': setMode('anti'); break; case 'Digit6': setMode('radial'); break; case 'Digit7': setMode('radialIn'); break; case 'Digit8': setMode('node'); break;
    case 'KeyZ': v.ctl.thr = 1; break; case 'KeyX': v.ctl.thr = 0; break;
    case 'KeyG': { const legs = v.legs; if (!legs.length) { toast('No landing legs on this rocket', ''); break; } const out = !legs[0].leg.out; legs.forEach((p) => { p.leg.out = out; }); S.rebuild(v); toast('Landing legs ' + (out ? 'OUT' : 'IN'), ''); break; }
    case 'KeyM': toggleMap(); break;
    case 'KeyV': view.mode = view.mode === 'local' ? 'ship' : 'local'; toast('Camera: ' + (view.mode === 'local' ? 'horizon locked' : 'follows the rocket'), ''); break;
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

// the throttle bar
(() => {
  const bar = $('throt'); let on = false;
  const set = (e) => { const r = bar.getBoundingClientRect(); const v = W && W.main; if (v) v.ctl.thr = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); };
  bar.addEventListener('pointerdown', (e) => { on = true; bar.setPointerCapture(e.pointerId); set(e); e.stopPropagation(); });
  bar.addEventListener('pointermove', (e) => { if (on) set(e); }); bar.addEventListener('pointerup', () => { on = false; });
})();

function togglePause() { paused = !paused; show('pause', paused); }
function changeWarp(d) {
  warpTarget = null; const v = W.main; const want = clamp(warpIdx + d, 0, WARPS.length - 1);
  if (d > 0 && WARPS[want] > 4 && !S.canRails(W)) { toast('Time warp needs space', 'bad', 'Get above the sky (60 km) and turn the engines off.'); return; }
  if (d > 0 && WARPS[want] > 4 && S.timeToAir(W) < 30) { toast('Too close to the air', 'bad', 'The atmosphere is coming up soon.'); return; }
  warpIdx = want; $('warpTxt').textContent = ''; void v;
}
function warpTo(kind) {
  if (kind === 'node') { const nb = nodeInfo; if (!nb || nb.dt < 60) { toast('Plan a burn first (move a slider)', ''); return; } if (!S.canRails(W)) { toast('Cannot warp here', 'bad'); return; } warpTarget = W.ut + nb.dt - (isFinite(nb.burnTime) ? nb.burnTime / 2 : 0) - 40; toast('Warping to your burn', '', 'Stops just before it starts'); return; }
  if (kind === 'enc') { const e = shownEnc(); if (!e) { toast('No encounter with Bean on this path', ''); return; } if (!S.canRails(W)) { toast('Cannot warp here', 'bad'); return; } warpTarget = e.tAt - 120; toast('Warping to Bean', '', 'Stops 2 minutes before you arrive'); return; }
  const v = W.main; if (!v || v.dead) return;
  if (!S.canRails(W)) { toast('Cannot warp here', 'bad', 'Get above the sky and turn the engines off first.'); return; }
  const T = S.telemetry(v, W);
  let t = kind === 'ap' ? orbitTime(T.el, 'ap') : orbitTime(T.el, 'pe');
  if (!isFinite(t) || t < 5) { toast('That point is not coming up on this orbit', ''); return; }
  warpTarget = W.ut + t - 30; toast('Warping to the ' + (kind === 'ap' ? 'high' : 'low') + ' point', '', 'Stops 30 seconds before');
}
const orbitTime = (el, k) => { if (!el.bound) return k === 'pe' ? -el.M / el.n : Infinity; const w = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return k === 'ap' ? w(Math.PI - el.M) / el.n : (2 * Math.PI - w(el.M)) / el.n; };
function nodeVals() { return [+$('nP').value, +$('nN').value, +$('nR').value]; }
function ensureNode(kind) {
  const v = W && W.main; if (!v || v.dead) return;
  const [p, n, r] = nodeVals();
  if (!W.node || kind) {
    const T = S.telemetry(v, W);
    W.node = S.makeNode(W, kind || (T.el.bound && T.alt > BODIES[T.body].atm?.top ? 'ap' : '5'), p, n, r);
  } else { W.node.p = p; W.node.n = n; W.node.r = r; }
  encT = 0; nodeInfo = S.nodeBurn(W, W.node); paintNode();
}
function paintNode() {
  $('nPv').textContent = $('nP').value; $('nNv').textContent = $('nN').value; $('nRv').textContent = $('nR').value;
  const nb = W && W.node ? nodeInfo || S.nodeBurn(W, W.node) : null, sum = $('nSum');
  if (!nb) { sum.textContent = 'Move a slider to plan a burn. The pink path shows where it takes you.'; return; }
  const bean = BODIES[W.node.body === 'cobble' ? 'cobble' : 'bean'], R = bean.R;
  const e = W.node.body === 'cobble' ? encN : null;
  sum.innerHTML = 'Burn <b>' + fmtNum(nb.mag) + ' m/s</b> in <b>' + (nb.dt > 0 ? fmtTime(nb.dt) : 'now') + '</b>' + (isFinite(nb.burnTime) ? ' (takes about <b>' + fmtTime(nb.burnTime) + '</b>)' : '') + '.<br>New orbit: high point <b>' + (nb.el.bound ? fmtDist(nb.el.ra - R) : 'escape') + '</b>, low point <b>' + fmtDist(nb.el.rp - R) + '</b>.' +
    (e ? '<br><b style="color:#5df0ff">Bean encounter!</b> in ' + fmtTime(e.tAt - W.ut) + ', low point ' + fmtDist(e.el.rp - BODIES.bean.R) + '.' : '');
}
function toggleMap() {
  mapOn = !mapOn; map.show(mapOn);
  $('mapLabels').classList.toggle('hide', !mapOn); $('mapTools').classList.toggle('hide', !mapOn); $('hud').classList.toggle('mapmode', mapOn); $('nodeP').classList.toggle('hide', !mapOn); if (mapOn) paintNode();
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
  if (k('PageUp')) view.zoom(0.98); if (k('PageDown')) view.zoom(1.02);
}

function processEvents() {
  const evs = W.events.splice(0), v = W.main;
  const booms = evs.filter((e) => e.t === 'boom').length, bscale = booms > 1 ? 1 / Math.sqrt(booms) : 1; let boomSound = 0;
  for (const e of evs) {
    if (e.t === 'boom') { if (e.body === view.frameBody) { view.boom(e.pos, e.size, bscale); if (boomSound++ < 2) sound.boom(e.size); if (e.main) view.shake = Math.min(1.2, view.shake + 0.35 * e.size); } }
    else if (!e.main) continue;
    else if (e.t === 'stage') { /* sound played at keypress */ }
    else if (e.t === 'flameout') { toast('Out of fuel: ' + e.part, 'bad'); }
    else if (e.t === 'burnout') { toast('Booster burned out', '', 'Press Space to drop it'); }
    else if (e.t === 'chute') { if (e.what === 'open') { toast('Parachute open!', 'good'); sound.chute(); } else if (e.what === 'semi') { toast('Parachute opening', ''); sound.chute(); } else if (e.what === 'auto') toast('Parachute armed by itself', '', 'Easy mode helps you land'); else toast('The parachute tore off: too fast!', 'bad'); }
    else if (e.t === 'crash') { sound.touch(); }
    else if (e.t === 'soi') { warpIdx = 0; fl[e.body === 'bean' ? 'visitedBean' : 'x'] = true; toast(e.body === 'bean' ? 'Now near the moon Bean' : 'Back near Cobble', 'good'); }
    else if (e.t === 'rest') { sound.touch(); }
  }
  if (!v || fl.ended) return;
  if (v.dead) endFlight('crashed');
  else if (v.asleep && v.flew && v.touching) { fl.landedT = (fl.landedT || 0) + 1; }
}

function flightSummary(v, T) {
  const bean = T.body === 'bean';
  const landed = v.asleep && v.touching > 0 && v.flew;
  const orbit = T.body === 'cobble' && T.el.bound && T.pe > 60000 && T.alt > 60000;
  if (orbit) fl.wasOrbit = true;
  if (bean && landed) fl.landedBean = true;
  const padD = V.len(V.sub(v.r, V.mul([1, 0, 0], BODIES.cobble.R)));
  return {
    alt: T.alt, landed, staged: fl.staged || v.stagedAny, maxAlt: v.maxAlt, maxSpeed: v.maxSpeed, orbit, orbitPe: T.body === 'cobble' && T.el.bound ? T.pe : -1e9,
    body: T.body, flightAlt: v.maxAlt, safe: !v.dead && v.alive.some((p) => p.def.cat === 'pod'), padDist: padD, wasOrbit: fl.wasOrbit, visitedBean: fl.visitedBean || bean,
    beanOrbit: bean && T.el.bound && T.pe > 8000, landedBean: fl.landedBean, flightNo: career.stats.flights,
  };
}

function runCareer(v, T) {
  const got = career.check(flightSummary(v, T));
  for (const g of got) {
    fl.rewards.push(g);
    toast((g.kind === 'contract' ? 'Contract done! ' : 'First! ') + g.name, 'good', career.sandbox() ? '' : '+' + fmt$(g.reward));
    sound.good();
  }
}

function hud(v, T) {
  const c = v.ctl;
  $('met').textContent = 'T+ ' + fmtTime(v.met);
  const rate = WARPS[warpIdx];
  $('warpTxt').textContent = rate > 1 ? 'Warp x' + fmtNum(rate) + (rate > 4 ? ' (rails)' : '') : '';
  // speed and height
  $('spdTxt').textContent = fmtSpeed(T.speed);
  $('vsTxt').textContent = 'VERTICAL ' + (T.vspeed >= 0 ? '+' : '') + fmtNum(T.vspeed) + ' m/s';
  // throttle
  $('throtF').style.height = (c.thr * 100) + '%'; $('throtT').textContent = Math.round(c.thr * 100) + '%';
  // fuel
  let liq = 0, liqMax = 0, sol = 0, solMax = 0;
  for (const p of v.alive) { if (p.def.fuel) { if (p.def.solid) { sol += p.fuel; solMax += p.def.fuel; } else { liq += p.fuel; liqMax += p.def.fuel; } } }
  $('fuelBar').style.width = (liqMax ? liq / liqMax * 100 : 0) + '%'; $('solRow').style.display = solMax ? '' : 'none'; $('solBar').style.width = (solMax ? sol / solMax * 100 : 0) + '%';
  $('thrTxt').textContent = Math.round(T.thrust / 1000) + ' kN'; $('twrTxt').textContent = T.twr.toFixed(2); $('gTxt').textContent = T.accelG.toFixed(1);
  // sas
  $('sasT').classList.toggle('sel', c.sas); $('sasT').textContent = c.sas ? 'SAS on' : 'SAS off';
  for (const b of $('modes').children) b.classList.toggle('sel', c.sas && b.dataset.m === c.mode);
  // orbit panel
  const bn = BODIES[T.body];
  const r = (k, val) => '<div class="r"><span>' + k + '</span><b>' + val + '</b></div>';
  $('hOrb').innerHTML = '<div class="bd">' + bn.name.toUpperCase() + ' &middot; ALTITUDE</div><div class="big">' + fmtDist(T.alt) + '</div>' +
    r('Apoapsis (high point)', isFinite(T.ap) ? fmtDist(T.ap) : 'escape') + r('Periapsis (low point)', fmtDist(T.pe)) +
    r('Time to apoapsis', isFinite(T.ap) && T.ap > 0 ? fmtTime(S_timeAp(T)) : '-') + r('Orbit time', isFinite(T.period) ? fmtTime(T.period) : '-') +
    r('Tilt of orbit', T.incl.toFixed(1) + '°') + (shownEnc() ? r('Bean encounter', fmtTime(shownEnc().tAt - W.ut)) + r('Bean low point', fmtDist(shownEnc().el.rp - BODIES.bean.R)) : '') + (nodeInfo ? r('Planned burn in', nodeInfo.dt > 0 ? fmtTime(nodeInfo.dt) : 'NOW') + r('Burn left', fmtNum(nodeInfo.remMag) + ' m/s') + (isFinite(nodeInfo.burnTime) ? r('Burn takes about', fmtTime(nodeInfo.burnTime)) : '') : '') + (T.rho > 1e-5 ? r('Air pressure', (T.q / 1000).toFixed(1) + ' kPa') + r('Mach', T.mach.toFixed(2)) : '');
  // stage list
  const g = stageStr(v), nums = Object.keys(g).map(Number).sort((a, b) => a - b);
  let h = '';
  for (const n of nums) {
    const items = g[n], eng = items.filter((p) => p.def.F !== undefined).length, dec = items.filter((p) => p.def.cat === 'decoupler').length, ch = items.filter((p) => p.chute).length;
    const label = [eng ? eng + ' engine' + (eng > 1 ? 's' : '') : '', dec ? 'let go' : '', ch ? 'parachute' : ''].filter(Boolean).join(' + ');
    h += '<div class="sg ' + (n < v.stageIdx ? 'past' : n === v.stageList.find((s) => s >= v.stageIdx) ? 'next' : '') + '"><i>' + (n + 1) + '</i><span>' + label + '</span></div>';
  }
  $('stageList').innerHTML = h || '<div class="fine">No stages</div>';
  // hint
  $('heat').style.opacity = view.heat || 0;
  const chute = v.chutes.find((p) => p.chute.state === 'armed' || p.chute.state === 'semi');
  const hint = $('hint2');
  const tip = coach(v, T, chute);
  if (tip) { hint.textContent = tip; hint.classList.remove('hide'); } else hint.classList.add('hide');
}
function coach(v, T, chute) {
  const c = v.ctl, beginner = career.stats.flights <= 3;
  if (chute) return chute.chute.state === 'armed' ? 'Parachute armed. It opens by itself once you are falling in thick air.' : (T.alt > 4000 ? 'The parachute is slowing you down. Press the . key to fast-forward the fall.' : 'Parachute opening. It opens fully below 1.4 km.');
  if (v.asleep && !v.flew) return v.engines.some((e) => e.ign) ? (c.thr > 0 ? '' : 'Hold SHIFT (or press Z) to give the engine power!') : 'Press SPACE to light the engine. Then hold SHIFT (or press Z) for power!';
  if (!beginner) return '';
  if (T.thrust > 0 && T.speed > 60 && T.alt < 20000 && T.pitch > 84 && T.vspeed > 0 && T.body === 'cobble') return 'Good! Now tap W a few times to tilt toward the east, then press 2 to follow your path (prograde).';
  if (T.thrust <= 0 && T.alt > 60000 && T.pe < 60000 && v.engines.length && T.vspeed > -50 && v.engines.some((e) => !e.out && !e.starved)) return 'You are in space! Press . to speed time up, then burn at the high point (Ap) toward prograde to make an orbit.';
  if (T.alt < 30000 && T.vspeed < -30 && T.thrust <= 0 && v.chutes.length && v.chutes.every((p) => p.chute.state === 'stowed') && v.met > 20) return 'Falling! Press SPACE to arm the parachute.';
  return '';
}
const shownEnc = () => (W.node ? encN : enc);
const S_timeAp = (T) => { const el = T.el; if (!el.bound) return Infinity; let t = ((Math.PI - el.M) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return t / el.n; };

function drawNav(v, T) {
  const marks = [];
  if (T.speed > 0.5) {
    const pro = V.mul(v.v, 1 / T.speed), h = V.norm(V.cross(v.r, v.v)), rad = V.norm(V.sub(T.up, V.mul(pro, V.dot(T.up, pro))));
    if (nodeInfo && nodeInfo.remMag > 0.05) marks.push({ dir: V.mul(nodeInfo.rem, 1 / nodeInfo.remMag), kind: 'node' });
    marks.push({ dir: pro, kind: 'pro' }, { dir: V.neg(pro), kind: 'retro' }, { dir: h, kind: 'normal' }, { dir: V.neg(h), kind: 'anti' }, { dir: rad, kind: 'rad' });
  }
  nav.draw(v.q, T.frame, marks);
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - lastTime) / 1000); lastTime = now;
  fpsN++; fpsT += dt; if (fpsT > 0.5) { $('fps').textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsN = 0; fpsT = 0; }
  if (state === 'loading') return;
  if (state === 'menu') {
    view.yaw += dt * 0.12;
    view.frame(W, dt); sound.update(0, 0, 0, true);
    if (shop && shop.isOpen) preview.render(dt);
    return;
  }
  if (state === 'build') {
    builder.render(dt); if (shop && shop.isOpen) preview.render(dt); return;
  }
  // ---- flight
  const v = W.main;
  if (!paused) {
    applyControls(dt);
    if (warpTarget !== null) {
      const rem = warpTarget - W.ut;
      if (rem <= 2 || !S.canRails(W)) { warpTarget = null; warpIdx = 0; if (rem <= 2) toast('Warp finished', 'good'); }
      else { let idx = 5; while (idx + 1 < WARPS.length && WARPS[idx + 1] * dt * 2 < rem) idx++; warpIdx = idx; }
    }
    const rate = WARPS[warpIdx];
    if (rate <= 4) {
      acc += dt * rate;
      let n = 0; while (acc >= S.DT && n < 60) { S.stepWorld(W, S.DT); acc -= S.DT; n++; }
      if (n >= 60) acc = 0;
    } else {
      if (!S.canRails(W)) { warpIdx = 3; toast('Warp stopped', '', 'The engines or the air stopped the time warp.'); }
      else {
        let total = dt * rate;
        const tair = S.timeToAir(W);
        if (isFinite(tair) && tair < total + 20) { total = Math.max(0, tair - 20); warpIdx = 0; toast('Warp stopped: air ahead', 'bad'); }
        const nsub = Math.max(1, Math.ceil(total / 150)), sub = total / nsub;
        for (let i = 0; i < nsub; i++) S.railsStep(W, sub);
        for (const vv of W.vessels) for (const e of vv.events.splice(0)) W.events.push(Object.assign({ vid: vv.id, main: vv === W.main }, e));
      }
    }
    processEvents();
    if (v && !v.dead) {
      checkT += dt; hudT += dt;
      if (checkT > 0.25) { checkT = 0; runCareer(v, S.telemetry(v, W)); }
      if (fl.ended === false && v.dead) endFlight('crashed');
    } else if (v && v.dead && !fl.ended) endFlight('crashed');
    if (!fl.ended && v && !v.dead && v.asleep && v.flew && v.touching) { fl.restT = (fl.restT || 0) + dt; if (fl.restT > 1.2) { runCareer(v, S.telemetry(v, W)); endFlight('landed'); } } else fl.restT = 0;
    if (fl.ended) { fl.endT += dt; if (fl.endT > (fl.kind === 'crashed' ? 2.6 : 1.4) && $('result').classList.contains('hide')) { runCareer; showResult(); } }
  }
  const T = v && !v.dead ? S.telemetry(v, W) : null;
  if (T && hudT > 0.06) { hudT = 0; hud(v, T); }
  if (T) drawNav(v, T);
  sound.update(T ? clamp(T.thrust / Math.max(1, v.engines.reduce((s, e) => s + e.def.F, 0)), 0, 1) : 0, T ? T.q : 0, T ? T.rho : 0, paused);
  if (!paused && v && !v.dead) {
    if (W.node && W.node.body !== v.body) W.node = null;
    nodeInfo = W.node ? S.nodeBurn(W, W.node) : null;
    if (nodeInfo && W.ut >= W.node.ut - 2 && nodeInfo.remMag < 1.5) { W.node = null; nodeInfo = null; encN = null; toast('Burn complete!', 'good'); sound.good(); paintNode(); }
    else if (nodeInfo && W.ut > W.node.ut + Math.max(180, (isFinite(nodeInfo.burnTime) ? nodeInfo.burnTime : 0) * 2) && nodeInfo.remMag > 5) { W.node = null; nodeInfo = null; encN = null; toast('The planned burn ran out of time', ''); paintNode(); }
    encT -= dt;
    if (encT <= 0) {
      encT = 0.6;
      try { enc = S.predictEncounter(W); } catch (e) { enc = null; }
      try { encN = W.node && v.body === 'cobble' ? S.predictEncounterFrom(W.node.ut, W.node.base.r, nodeInfo.vPost) : null; } catch (e) { encN = null; }
      if (mapOn) paintNode();
    }
  }
  if (mapOn && v && !v.dead) { map.frame(W, dt, W.node ? encN : enc, nodeInfo); }
  else view.frame(W, paused ? 0 : dt);
  if (DEBUG) window.__ll.T = T;
}

// ---------------------------------------------------------------- menu, builder, shop wiring
function openBuilder(design) {
  state = 'build'; show('menu', false);
  let d = design || loadLast(), first = false;
  if (!d) { const s = STARTERS[0]; d = { name: s.name, v: 1, parts: JSON.parse(JSON.stringify(s.parts)), gnext: 99 }; first = true; }
  builder.open(d); updateMoney();
  if (first) toast('Here is a starter rocket!', 'good', 'Press LAUNCH to fly it, or change it. The glowing dots show where parts can go.');
}
builder = new Builder(view, icons, { sound, toast, onBack: () => enterMenu(), onLaunch: (d) => startFlight(d), openShop: (id) => shop.open(id), openLoad: () => loadDlg.open() });
shop = new Shop(icons, preview, { sound, toast, onChange: () => { updateMoney(); if (state === 'build') builder.afterChange(); }, onClose: () => { updateMoney(); if (state === 'menu') enterMenuMoney(); if (state === 'build') builder.afterChange(); } });
missions = new Missions({});
loadDlg = new LoadDlg(icons, { onPick: (d) => { if (state !== 'build') openBuilder(d); else { builder.commit(); builder.design = d; builder.selIdx = -1; builder.afterChange(); $('vName').value = d.name; } } });
map = new MapView(view, () => W, $('mapLabels'));
function enterMenuMoney() { updateMoney(); $('mShopSub').textContent = career.sandbox() ? 'Sandbox: every part is free' : career.locked().length + ' parts still locked'; }

$('mBuild').onclick = () => { sound.start(); sound.click(); openBuilder(); };
$('mShop').onclick = () => { sound.start(); sound.click(); shop.open(); };
$('mMissions').onclick = () => { sound.start(); sound.click(); missions.open(); };
$('mSettings').onclick = () => { sound.start(); openSettings(); };
$('pSet').onclick = () => openSettings();
$('pResume').onclick = () => togglePause();
$('pRevert').onclick = () => { startFlight(fl.design); };
$('pHangar').onclick = () => { openBuilder(fl.design); showHud(false); show('pause', false); paused = false; };
$('rAgain').onclick = () => startFlight(fl.design);
$('rHangar').onclick = () => { show('result', false); showHud(false); openBuilder(fl.design); };
$('bPause').onclick = () => { if (!fl.ended) togglePause(); };
$('bMap').onclick = () => toggleMap();
$('wSlow').onclick = () => changeWarp(-1); $('wFast').onclick = () => changeWarp(1); $('wStop').onclick = () => { warpIdx = 0; warpTarget = null; };
$('wEnc').onclick = () => warpTo('enc'); $('nAp').onclick = () => ensureNode('ap'); $('nPe').onclick = () => ensureNode('pe'); $('n5').onclick = () => ensureNode('5');
for (const id of ['nP', 'nN', 'nR']) { $(id).addEventListener('input', () => ensureNode()); $(id).addEventListener('change', (e) => e.target.blur()); }
$('nDel').onclick = () => { if (W) W.node = null; nodeInfo = null; encN = null; for (const id of ['nP', 'nN', 'nR']) $(id).value = 0; paintNode(); }; $('nWarp').onclick = () => warpTo('node');
$('wAp').onclick = () => warpTo('ap'); $('wPe').onclick = () => warpTo('pe'); $('wBack').onclick = () => toggleMap();
$('bCam').onclick = () => { view.mode = view.mode === 'local' ? 'ship' : 'local'; };
$('sasT').onclick = () => { const v = W.main; if (v && !v.dead) { v.ctl.sas = !v.ctl.sas; if (v.ctl.sas && v.ctl.mode === 'hold') v.ctl.target = v.q.slice(); } };
$('misClose').addEventListener('click', () => updateMoney());

function openSettings() {
  show('settings', true); paintSettings();
}
function paintSettings() {
  $('setGfx').textContent = view.quality === 'high' ? 'Pretty' : 'Lite (faster)';
  $('setMode').textContent = settings.mode === 'sandbox' ? 'Sandbox (all parts free)' : 'Career (earn money)';
  $('setEasy').textContent = settings.easy ? 'On' : 'Off'; $('setVol').value = settings.vol;
  $('setSave').textContent = 'Career: ' + fmt$(career.funds) + ' &middot; ' + career.done.size + ' firsts done &middot; ' + career.stats.flights + ' flights'.replace('&middot;', '-');
  $('setSave').innerHTML = 'Career: ' + fmt$(career.funds) + ' &middot; ' + career.done.size + ' firsts done &middot; ' + career.stats.flights + ' flights. Your saves live in this browser; use Save codes on the HKugz Games home page to move them.';
}
$('setClose').onclick = () => { show('settings', false); if (state === 'menu') enterMenuMoney(); };
$('setGfx').onclick = () => { const q = view.quality === 'high' ? 'low' : 'high'; view.setQuality(q); view.resize(); settings.quality = q; saveSettings(); paintSettings(); };
$('setMode').onclick = () => { settings.mode = settings.mode === 'sandbox' ? 'career' : 'sandbox'; saveSettings(); paintSettings(); updateMoney(); };
$('setEasy').onclick = () => { settings.easy = !settings.easy; saveSettings(); paintSettings(); };
$('setVol').oninput = (e) => { settings.vol = +e.target.value; sound.setVolume(settings.vol); saveSettings(); };

// ---------------------------------------------------------------- go
if (DEBUG) window.__ll = { S, view, career, builder, startFlight, get W() { return W; }, get fl() { return fl; }, keys, openBuilder, enterMenu, shop, toast, settings, setWarp: (i) => { warpIdx = i; }, toggleMap, get state() { return state; } };
if (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !matchMedia('(any-pointer:fine)').matches) $('touchWarn').classList.remove('hide');
$('loading').remove();
enterMenu();
requestAnimationFrame((t) => { lastTime = t; frame(t); });
