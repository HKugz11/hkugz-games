// KART RUSH - a toon kart racer: drift, grab item boxes, and beat seven robots around three tracks.
import { THREE, V3, $, DEBUG, S, GFX, GFX_PREF, QL, camera, renderer, scene, W, R, rnd, clamp, lerp, angDiff, TAU, load, save, hex, followSun, updateFX, burst, ring, audioInit, setVolume, sfx, adaptRes, blendSky, engineStart, engineSet, engineStop, FX, starMat } from './core.js?v=2';
import { TRACKS, Track, nearest, pointAt } from './track.js?v=2';
import { Kart, CLASSES, ITEMS, Items, bumpKarts } from './kart.js?v=2';
import { DIFFS, makeAI, aiDrive } from './ai.js?v=2';
import { TOUCH, initTouch } from './touch.js?v=2';
let tAxis = 0;   // analog steering from the touch stick (-1 left .. 1 right)

const MODES = {
  gp: { name: 'Grand Prix', blurb: 'Race all three tracks for points. Win the cup!' },
  single: { name: 'Single Race', blurb: 'Pick a track and race seven robots.' },
  trial: { name: 'Time Trial', blurb: 'Just you and the clock. Chase your best lap.' },
};
const COLORS = [0xff4a4a, 0xff9a1a, 0xffd31a, 0x6aff4a, 0x2ee6ff, 0x4a6aff, 0xb06bff, 0xff4fa8];
const BOT_NAMES = ['Blip', 'Zorp', 'Chomp', 'Bolt', 'Pixel', 'Waffle', 'Nacho', 'Turbo'];
const PTS = [10, 7, 5, 4, 3, 2, 1, 0];
const CFG = { mode: load('mode', 'single'), track: load('track', 'sunny'), diff: load('diff', 'normal'), cls: load('cls', 'balanced'), laps: load('laps', 3), name: load('name', '') };
if (!MODES[CFG.mode]) CFG.mode = 'single'; if (!TRACKS.some(t => t.id === CFG.track)) CFG.track = 'sunny'; if (!DIFFS[CFG.diff]) CFG.diff = 'normal'; if (!CLASSES.some(c => c.id === CFG.cls)) CFG.cls = 'balanced';

let state = 'menu', started = false, track = null, race = null, gp = null, menuTrack = null;
const keys = {}, cam = { h: 0, y: 0, shake: 0, init: false, fov: S.fov };
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0]);
const fmtT = t => { if (!t && t !== 0) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const trackDef = id => TRACKS.find(t => t.id === id);

// ================================================================== a race
function startRace(def, laps) {
  clearRace(); if (menuTrack) { menuTrack.dispose(); menuTrack = null; }
  track = new Track(def); const tr = track.tr; blendSky(def.theme, def.theme, 0); scene.fog.color.setHex(def.theme.fog[0]);
  const trial = CFG.mode === 'trial', n = trial ? 1 : 8, karts = [], D = DIFFS[CFG.diff];
  const cls = CLASSES.find(c => c.id === CFG.cls), player = new Kart({ name: CFG.name || 'You', color: S.color, cls, isPlayer: true }); player.model.noFx = false;
  const used = new Set([S.color]), others = []; for (let i = 0; i < n - 1; i++) { let c = COLORS[(i * 3 + 1) % COLORS.length], g = 0; while (used.has(c) && g++ < 8) c = COLORS[(COLORS.indexOf(c) + 1) % COLORS.length]; used.add(c); others.push(new Kart({ name: BOT_NAMES[i], color: c, cls: CLASSES[i % 3], ai: makeAI(D, (i % 5 - 2) / 2.2 + (Math.random() - .5) * .3) })); }
  // grid: best of the last race in front; a fresh race puts you near the back
  let order = [player, ...others]; if (gp && gp.standings) order.sort((a, b) => (gp.pts[b.name] || 0) - (gp.pts[a.name] || 0)); else if (!trial) { order = others.slice(); order.splice(Math.min(5, order.length), 0, player); }
  order.forEach((k, i) => { k.place0(tr, -9 - Math.floor(i / 2) * 8.5 - (i % 2) * 3.6, (i % 2 ? 4.8 : -4.8)); k.place = i + 1; karts.push(k); });
  race = { def, tr, karts, player, items: new Items(), laps, t: 0, cd: 3.4, thrAt: null, state: 'count', trial, shown: 0, finishWait: 0, ended: false, boxes: track.boxes, pads: track.pads, lastLapMsg: -9, best: load('best.' + def.id, 0), bestRace: load('bestrace.' + def.id + '.' + laps, 0) };
  for (const k of karts) { k.lapStart = 0; k.prevLap = k.lap; } cam.init = false;
  state = 'race'; W.state = 'race'; hideScreens(); $('hud').style.visibility = 'visible'; $('mini').classList.toggle('hide', false); buildMini(); engineStart(); msg('', ''); $('bestLap').textContent = race.best ? 'BEST LAP ' + fmtT(race.best) : '';
}
function clearRace() { if (race) { race.karts.forEach(k => k.remove()); race.items.clear(); race = null; } if (track) { track.dispose(); track = null; } engineStop(); FX.parts.forEach(p => { p.visible = false; FX.free.push(p); }); FX.parts.length = 0; }
function rankKarts() {
  const ks = race.karts.slice().sort((a, b) => (a.finished && b.finished) ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.dist - a.dist);
  ks.forEach((k, i) => { k.place = i + 1; }); return ks;
}
function raceStep(dt) {
  const r = race, tr = r.tr, P = r.player; track.update(dt, W.time); const thr = !!(keys.KeyW || keys.ArrowUp);
  if (r.state === 'count') {
    r.cd -= dt; const n = Math.ceil(r.cd); if (n !== r.shown && n >= 1 && n <= 3) { r.shown = n; msg(String(n), '', 900); sfx('beep'); }
    if (thr) { if (r.thrAt === null) r.thrAt = r.cd; } else r.thrAt = null;
    if (r.cd <= 0) {
      r.state = 'race'; msg('GO!', '', 900); sfx('go'); r.cd = 0;
      if (r.thrAt !== null && r.thrAt <= .6) { P.giveBoost(1.2, 5); msg('ROCKET START!', '', 1300); }   // pressed the pedal just before GO
      for (const k of r.karts) if (k.ai && Math.random() < .5) k.giveBoost(.5 + Math.random() * .5, 2);
    }
    for (const k of r.karts) k.animate(dt); return;
  }
  r.t += dt;
  // drivers: the player reads the keys, everybody else (and the player after finishing) is the computer
  const ctx = { karts: r.karts, player: P.finished ? null : P, racing: true };
  for (const k of r.karts) {
    if (k.ai) aiDrive(k, tr, ctx, dt);
    else { const i = k.in; i.thr = thr ? 1 : 0; i.brk = (keys.KeyS || keys.ArrowDown) ? 1 : 0; i.steer = Math.abs(tAxis) > .14 ? clamp((Math.abs(tAxis) - .14) / .72, 0, 1) * Math.sign(tAxis) : ((keys.KeyA || keys.ArrowLeft) ? -1 : 0) + ((keys.KeyD || keys.ArrowRight) ? 1 : 0); i.drift = !!(keys.ShiftLeft || keys.ShiftRight || keys.Space); }
    if (k.in.itemPressed) { k.in.itemPressed = false; if (k.item && !k.itemRoll) r.items.use(k, r.karts, tr); }
  }
  const n = Math.max(1, Math.ceil(dt / (1 / 60))); for (let s = 0; s < n; s++) { for (const k of r.karts) k.step(dt / n, tr); bumpKarts(r.karts, dt / n); }
  r.items.update(dt, r.karts, tr);
  for (const k of r.karts) {
    // item boxes
    if (!k.item && !k.itemRoll) for (const b of r.boxes) if (b.cd <= 0 && Math.hypot(k.p.x - b.x, k.p.z - b.z) < 2.6 && Math.abs(k.y + 1 - b.y) < 3.5) { b.cd = 4.5; b.m.visible = false; burst(new V3(b.x, b.y, b.z), 0xffe08a, 10, 6, .18, .5, 4, 2); if (k.isPlayer) { sfx('pickup'); k.itemRoll = 1.1; } else k.item = r.items.roll(k.place - 1, r.karts.length); break; }
    if (k.itemRoll > 0) { k.itemRoll -= dt; if (k.itemRoll <= 0) { k.itemRoll = 0; k.item = r.items.roll(k.place - 1, r.karts.length); sfx('use'); } }
    // boost pads
    for (const pd of r.pads) { const ds = ((k.s - pd.s + tr.length * 1.5) % tr.length) - tr.length / 2; if (Math.abs(ds) < 4.6 && Math.abs(k.d - pd.lat) < 4.4 && k.boostT < .9) { k.giveBoost(1.3, 3); if (k.isPlayer) burst(new V3(k.p.x, k.y + .5, k.p.z), 0x6affe0, 10, 7, .2, .5, 6, 1); } }
    // laps: lap -1 is the grid, lap 0 starts when we cross the line
    if (k.prevLap === undefined) k.prevLap = k.lap;
    while (k.lap > k.prevLap) {
      k.prevLap++; const L = k.prevLap; if (L === 0) { k.lapStart = r.t; continue; }
      const lt = r.t - k.lapStart; k.lapTimes.push(lt); if (!k.bestLap || lt < k.bestLap) k.bestLap = lt; k.lapStart = r.t;
      if (L >= r.laps) { if (!k.finished) { k.finished = true; k.finishT = r.t; if (k.isPlayer) { k.ai = makeAI(DIFFS.normal, 0); sfx('finish'); msg('FINISH!', '', 2200); r.finishWait = 3; } } }
      else if (k.isPlayer) { msg(L + 1 === r.laps ? 'FINAL LAP!' : 'LAP ' + (L + 1), fmtT(lt), 1600); sfx('lap'); }
    }
    if (k.shakeHit) { if (k.isPlayer) cam.shake = Math.max(cam.shake, k.shakeHit); k.shakeHit = 0; }
    k.animate(dt);
  }
  const ranked = rankKarts();
  if (P.finished) { r.finishWait -= dt; if (r.finishWait <= 0 && !r.ended) endRace(ranked); }
  engineSet(clamp(Math.abs(P.vf) / 50, 0, 1.3), P.boostT > 0, P.drift.on || P.spinT > 0 ? 1 : (P.offroad ? .4 : 0), 1);
  if (P.wrong > 1.5 && !r.wrongShown) { r.wrongShown = true; msg('WRONG WAY!', 'Turn around', 1500); sfx('wrong'); } else if (P.wrong < .3) r.wrongShown = false;
  r.resetCD = Math.max(0, (r.resetCD || 0) - dt); if (!P.finished && keys.KeyR && r.resetCD <= 0) { P.reset(tr); r.resetCD = 1.2; }
}
function endRace(ranked) {
  const r = race; r.ended = true; state = 'results'; W.state = 'results'; if (document.pointerLockElement) document.exitPointerLock(); engineStop();
  const trial = r.trial, def = r.def, P = r.player;
  // places for karts that have not finished yet follow their progress
  const rows = ranked.map((k, i) => ({ k, place: i + 1, time: k.finished ? k.finishT : null }));
  const pts = {}; if (CFG.mode === 'gp' && gp) { rows.forEach(rw => { pts[rw.k.name] = PTS[rw.place - 1] || 0; gp.pts[rw.k.name] = (gp.pts[rw.k.name] || 0) + pts[rw.k.name]; }); gp.standings = true; }
  let newBest = false; if (P.bestLap && (!r.best || P.bestLap < r.best)) { save('best.' + def.id, P.bestLap); newBest = true; }
  const myPlace = rows.find(rw => rw.k === P).place; let title = trial ? 'TIME TRIAL DONE' : myPlace === 1 ? 'YOU WON!' : myPlace <= 3 ? 'ON THE PODIUM!' : 'RACE OVER';
  $('resT').textContent = title; $('resT').style.color = myPlace === 1 && !trial ? '#ffd34e' : '#fff'; if (!trial && myPlace <= 3) sfx('finish');
  const tbl = $('resTable'); tbl.innerHTML = ''; for (const rw of rows) { const tr = document.createElement('tr'); if (rw.k === P) tr.className = 'me'; tr.innerHTML = `<td>${rw.place}</td><td><i style="background:${hex(rw.k.color)}"></i>${rw.k.name}</td><td>${rw.time !== null ? fmtT(rw.time) : '—'}</td><td>${rw.k.bestLap ? fmtT(rw.k.bestLap) : '—'}</td>${CFG.mode === 'gp' ? `<td>+${pts[rw.k.name] || 0}</td>` : ''}`; tbl.appendChild(tr); }
  const head = CFG.mode === 'gp' ? '<tr><th>#</th><th>Racer</th><th>Time</th><th>Best lap</th><th>Pts</th></tr>' : '<tr><th>#</th><th>Racer</th><th>Time</th><th>Best lap</th></tr>'; tbl.insertAdjacentHTML('afterbegin', head);
  $('resS').textContent = newBest ? `New best lap on ${def.name}: ${fmtT(P.bestLap)}!` : (P.bestLap ? `Your best lap: ${fmtT(P.bestLap)}` : '');
  let next = 'RACE AGAIN'; if (CFG.mode === 'gp') { if (gp.i < gp.tracks.length - 1) next = 'NEXT TRACK'; else { next = 'PLAY AGAIN'; const tot = Object.entries(gp.pts).sort((a, b) => b[1] - a[1]); $('resT').textContent = tot[0][0] === (CFG.name || 'You') ? 'YOU WON THE CUP!' : 'CUP OVER: ' + tot[0][0] + ' wins'; $('resS').innerHTML = 'Cup standings: ' + tot.map(([n, p], i) => `${i + 1}. ${n} ${p}`).join(' &nbsp; '); } }
  $('again').textContent = next; $('results').classList.remove('hide');
}

// ================================================================== camera + HUD
function updateCamera(dt) {
  const P = race ? race.player : null; if (!P) return;
  const sp = Math.hypot(P.vx, P.vz), target = P.spinT > 0 ? cam.h : (P.drift.on ? P.h + P.drift.dir * .12 : (sp > 8 ? lerpAng(P.h, Math.atan2(P.vx, P.vz), .35) : P.h));
  if (!cam.init) { cam.h = P.h; cam.y = P.y + 3.6; cam.init = true; } cam.h += angDiff(target, cam.h) * Math.min(1, dt * (P.drift.on ? 2.6 : 7));
  const back = 8.4 + clamp(sp / 60, 0, 1) * 1.8 + (P.boostT > 0 ? 1.2 : 0); cam.y += (P.y + 3.7 - cam.y) * Math.min(1, dt * 7);
  const px = P.p.x - Math.sin(cam.h) * back, pz = P.p.z - Math.cos(cam.h) * back; camera.position.set(px, Math.max(cam.y, P.y + 2.2), pz);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2.5); camera.position.x += (Math.random() - .5) * cam.shake * .8; camera.position.y += (Math.random() - .5) * cam.shake * .6; }
  camera.lookAt(P.p.x + Math.sin(cam.h) * 7, P.y + 1.5, P.p.z + Math.cos(cam.h) * 7);
  const wf = S.fov + clamp(sp / 60, 0, 1) * 9 + (P.boostT > 0 ? 9 : 0); cam.fov += (wf - cam.fov) * Math.min(1, dt * 5); if (Math.abs(camera.fov - cam.fov) > .05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}
const lerpAng = (a, b, t) => a + angDiff(b, a) * t;
let msgT = 0; function msg(a, b, ms = 1200) { $('msgA').textContent = a; $('msgB').textContent = b || ''; const m = $('msg'); m.classList.remove('on'); void m.offsetWidth; if (a) m.classList.add('on'); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('on'), ms); }
const lastHud = {}; const setT = (id, t) => { if (lastHud[id] !== t) { lastHud[id] = t; $(id).textContent = t; } };
const itemCv = $('itemCv').getContext('2d');
function drawItem(id, spin) {
  const c = itemCv; c.clearRect(0, 0, 64, 64); if (!id) return; c.save(); c.translate(32, 32); c.lineWidth = 4; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = '#1a1030';
  const fill = ITEMS[id] ? ITEMS[id].col : '#fff';
  if (id === 'turbo') { c.fillStyle = fill; c.beginPath(); c.moveTo(-6, -22); c.lineTo(14, -22); c.lineTo(2, -4); c.lineTo(16, -4); c.lineTo(-10, 24); c.lineTo(-2, 4); c.lineTo(-14, 4); c.closePath(); c.fill(); c.stroke(); }
  else if (id === 'rocket') { c.rotate(-.7); c.fillStyle = '#e8eefc'; c.beginPath(); c.roundRect(-8, -22, 16, 38, 8); c.fill(); c.stroke(); c.fillStyle = fill; c.beginPath(); c.moveTo(-8, -10); c.lineTo(0, -26); c.lineTo(8, -10); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-8, 8); c.lineTo(-18, 20); c.lineTo(-8, 16); c.moveTo(8, 8); c.lineTo(18, 20); c.lineTo(8, 16); c.fillStyle = fill; c.fill(); c.stroke(); }
  else if (id === 'banana') { c.fillStyle = fill; c.beginPath(); c.ellipse(0, 4, 22, 14, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#9a8aff'; c.beginPath(); c.ellipse(-6, 0, 8, 5, .3, 0, TAU); c.fill(); }
  else if (id === 'shield') { c.fillStyle = fill; c.beginPath(); c.moveTo(0, -24); c.lineTo(20, -14); c.lineTo(16, 10); c.lineTo(0, 24); c.lineTo(-16, 10); c.lineTo(-20, -14); c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(0, -16); c.lineTo(11, -10); c.lineTo(0, 14); c.closePath(); c.fill(); }
  else if (id === 'zap') { c.fillStyle = fill; c.beginPath(); c.moveTo(4, -26); c.lineTo(-14, 4); c.lineTo(-2, 4); c.lineTo(-6, 26); c.lineTo(16, -6); c.lineTo(3, -6); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
let miniBox = null;
function buildMini() { const pts = race.tr; let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9; for (let i = 0; i < pts.N; i++) { mnx = Math.min(mnx, pts.x[i]); mxx = Math.max(mxx, pts.x[i]); mnz = Math.min(mnz, pts.z[i]); mxz = Math.max(mxz, pts.z[i]); } const sc = 150 / Math.max(mxx - mnx, mxz - mnz); miniBox = { mnx, mnz, sc, ox: (170 - (mxx - mnx) * sc) / 2, oz: (170 - (mxz - mnz) * sc) / 2 }; }
const miniCtx = $('mini').getContext('2d');
function drawMini() {
  const c = miniCtx, b = miniBox, tr = race.tr; c.clearRect(0, 0, 170, 170); c.lineJoin = 'round'; c.lineCap = 'round'; const X = x => b.ox + (x - b.mnx) * b.sc, Z = z => b.oz + (z - b.mnz) * b.sc;
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 9; c.beginPath(); for (let i = 0; i <= tr.N; i += 4) { const k = i % tr.N; i ? c.lineTo(X(tr.x[k]), Z(tr.z[k])) : c.moveTo(X(tr.x[k]), Z(tr.z[k])); } c.closePath(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.stroke();
  for (const k of race.karts) { if (k.isPlayer) continue; c.fillStyle = hex(k.color); c.beginPath(); c.arc(X(k.p.x), Z(k.p.z), 3.4, 0, TAU); c.fill(); }
  const P = race.player; c.fillStyle = '#fff'; c.strokeStyle = hex(P.color); c.lineWidth = 3; c.beginPath(); c.arc(X(P.p.x), Z(P.p.z), 5.5, 0, TAU); c.fill(); c.stroke();
}
function updateHUD(dt) {
  const r = race, P = r.player; if (!r) return; setT('posN', String(P.place)); setT('posS', ord(P.place).replace(/\d+/, '') + (r.trial ? '' : ' / ' + r.karts.length)); $('pos').classList.toggle('hide', r.trial);
  setT('lapN', Math.min(Math.max(P.lap + 1, 1), r.laps) + ' / ' + r.laps); setT('speed', String(Math.round(Math.abs(P.vf) * 3.2))); const lt = P.lap >= 0 ? r.t - P.lapStart : 0; setT('lapT', fmtT(P.finished ? P.lapTimes[P.lapTimes.length - 1] || 0 : lt)); if (P.bestLap) setT('bestLap', 'BEST LAP ' + fmtT(Math.min(P.bestLap, r.best || 9999)));
  const show = P.itemRoll > 0 ? Object.keys(ITEMS)[(Math.floor(W.time * 14)) % 5] : P.item; if (lastHud.item !== show || P.itemRoll > 0) { lastHud.item = show; drawItem(show); } $('itemBox').classList.toggle('has', !!show); $('itemBox').classList.toggle('roll', P.itemRoll > 0); setT('itemN', P.itemRoll > 0 ? '' : show ? ITEMS[show].name : '');
  // drift charge bar
  const dr = P.drift; $('driftBar').classList.toggle('hide', !dr.on); if (dr.on) { const f = Math.min(1, dr.t / 2.5); $('driftF').style.width = (f * 100) + '%'; $('driftF').style.background = ['#9ab0ff', '#4aa8ff', '#ffa02a', '#d44aff'][dr.tier]; }
  $('boostBar').classList.toggle('hide', P.boostT <= 0);
  drawMini(); $('zap').style.opacity = r.items.zapFlash || 0; $('hit').style.opacity = P.spinT > 0 ? .35 : 0;
}

// ================================================================== loop
let last = performance.now(), fpsN = 0, fpsT = 0, fpsTxt = '', renderTick = 0;
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function step(dt) {
  W.time += dt; updateFX(dt);
  if (state === 'race') { raceStep(dt); updateCamera(dt); updateHUD(dt); if (QL.shadow) followSun(race.player.p.x, race.player.y, race.player.p.z); }
  else if (state === 'pause') { updateHUD(dt); }
  else if (state === 'results') { for (const k of race.karts) { aiDriveAuto(k, dt); k.animate(dt); } race.items.update(dt, race.karts, race.tr); track.update(dt, W.time); updateCamera(dt); }
  else if (state === 'menu') { menuCamera(dt); if (menuTrack) menuTrack.update(dt, W.time); }
}
function aiDriveAuto(k, dt) { if (!k.ai) k.ai = makeAI(DIFFS.normal, 0); aiDrive(k, race.tr, { karts: race.karts, player: null, racing: true }, dt); const n = Math.max(1, Math.ceil(dt / (1 / 60))); for (let i = 0; i < n; i++) k.step(dt / n, race.tr); }
function menuCamera(dt) { if (!menuTrack) return; const tr = menuTrack.tr, t = W.time * .035, i = Math.floor((t * tr.N) % tr.N), p = pointAt(tr, i * tr.ds, 0), q = pointAt(tr, i * tr.ds + 60, 0); camera.position.set(p.x - p.tx * 10, p.y + 9, p.z - p.tz * 10); camera.lookAt(q.x, q.y + 1, q.z); }
function render() { if (QL.skip) renderer.shadowMap.needsUpdate = (renderTick++ & 1) === 0; renderer.render(scene, camera); }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; const hv = (state === 'menu' || state === 'results') ? 'hidden' : 'visible'; if ($('hud').style.visibility !== hv) $('hud').style.visibility = hv; step(dt); render(); adaptRes(raw, state === 'race'); fpsTick(raw); requestAnimationFrame(loop); }

// ================================================================== input
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && (state === 'race' || state === 'pause')) e.preventDefault();
  if (e.repeat) return; keys[e.code] = true;
  if (e.code === 'Escape') { if (state === 'race') pauseGame(); else if (state === 'pause') resumeGame(); return; }
  if (state !== 'race' || !race) return; const P = race.player;
  if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyQ') && P.item && !P.itemRoll) P.in.itemPressed = true;
});
addEventListener('mousedown', e => { if (state === 'race' && race && e.button === 0 && race.player.item && !race.player.itemRoll) race.player.in.itemPressed = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function pauseGame() { if (state !== 'race') return; state = 'pause'; W.state = 'pause'; engineSet(0, false, 0, 0); $('pause').classList.remove('hide'); }
function resumeGame() { if (state !== 'pause') return; state = 'race'; W.state = 'race'; $('pause').classList.add('hide'); audioInit(); engineStart(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'race') pauseGame(); });

// ================================================================== menus
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function hideScreens() { for (const id of ['menu', 'pause', 'results']) $(id).classList.add('hide'); }
function renderMenu() {
  const root = $('menuPickers'); root.innerHTML = '';
  const gm = mk('div', 'grp'); gm.appendChild(mk('h3', '', 'MODE')); const cards = mk('div', 'modes');
  for (const id of Object.keys(MODES)) { const c = mk('button', 'modec' + (id === CFG.mode ? ' sel' : '')); c.appendChild(mk('b', '', MODES[id].name)); c.appendChild(mk('span', '', MODES[id].blurb)); c.onclick = () => { CFG.mode = id; save('mode', id); sfx('click'); renderMenu(); }; cards.appendChild(c); }
  gm.appendChild(cards); root.appendChild(gm);
  if (CFG.mode !== 'gp') { const gt = mk('div', 'grp'); gt.appendChild(mk('h3', '', 'TRACK')); const tc = mk('div', 'modes'); for (const t of TRACKS) { const c = mk('button', 'modec track' + (t.id === CFG.track ? ' sel' : '')); c.style.background = `linear-gradient(160deg, ${t.theme.swatch[0]}, ${t.theme.swatch[1]} 60%, ${t.theme.swatch[2]})`; c.appendChild(mk('b', '', t.name)); c.appendChild(mk('span', '', t.blurb)); const best = load('best.' + t.id, 0); if (best) c.appendChild(mk('i', '', 'Best lap ' + fmtT(best))); c.onclick = () => { CFG.track = t.id; save('track', t.id); sfx('click'); renderMenu(); }; tc.appendChild(c); } gt.appendChild(tc);
    const rl = mk('div', 'row'); rl.appendChild(mk('span', 'lbl', 'LAPS')); for (const n of [1, 3, 5]) { const b = mk('button', 'small' + (n === CFG.laps ? ' sel' : ''), String(n)); b.onclick = () => { CFG.laps = n; save('laps', n); renderMenu(); }; rl.appendChild(b); } gt.appendChild(rl); root.appendChild(gt); }
  if (CFG.mode !== 'trial') { const gd = mk('div', 'grp'); gd.appendChild(mk('h3', '', 'ROBOT RIVALS')); const rd = mk('div', 'row'); for (const id of Object.keys(DIFFS)) { const b = mk('button', id === CFG.diff ? 'sel' : '', DIFFS[id].name); b.onclick = () => { CFG.diff = id; save('diff', id); renderMenu(); }; rd.appendChild(b); } gd.appendChild(rd); root.appendChild(gd); }
  const gk = mk('div', 'grp'); gk.appendChild(mk('h3', '', 'YOUR KART')); const kc = mk('div', 'modes'); for (const c of CLASSES) { const b = mk('button', 'modec small' + (c.id === CFG.cls ? ' sel' : '')); b.appendChild(mk('b', '', c.name)); b.appendChild(mk('span', '', c.desc)); b.onclick = () => { CFG.cls = c.id; save('cls', c.id); sfx('click'); renderMenu(); }; kc.appendChild(b); } gk.appendChild(kc);
  const rc = mk('div', 'row sw'); for (const c of COLORS) { const b = mk('button', 'swatch' + (c === S.color ? ' sel' : '')); b.style.background = hex(c); b.onclick = () => { S.color = c; save('color', c); sfx('click'); renderMenu(); }; rc.appendChild(b); } gk.appendChild(rc); root.appendChild(gk);
  const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
  for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !new URLSearchParams(location.search).get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' : ''); }; rg.appendChild(b); }
  gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (['low', 'med', 'high'].includes(GFX_PREF) ? '' : ' (picked automatically for this computer)') + '. On a Chromebook or a slow laptop, Low runs smoothest.')); root.appendChild(gg);
}
function showMenu() {
  state = 'menu'; W.state = 'menu'; hideScreens(); $('menu').classList.remove('hide'); clearRace(); gp = null; $('hud').style.visibility = 'hidden';
  if (!menuTrack) { menuTrack = new Track(trackDef(CFG.track)); const d = menuTrack.def.theme; blendSky(d, d, 0); scene.fog.color.setHex(d.fog[0]); }
  renderMenu();
}
function beginMode() {
  audioInit(); const pn = $('pname').value.trim().slice(0, 12); CFG.name = pn; save('name', pn);
  if (CFG.mode === 'gp') { gp = { tracks: TRACKS.map(t => t.id), i: 0, pts: {}, standings: false }; startRace(trackDef(gp.tracks[0]), 3); }
  else { gp = null; startRace(trackDef(CFG.track), CFG.laps); }
}
$('pname').value = CFG.name; $('pname').addEventListener('input', e => { CFG.name = e.target.value.slice(0, 12); save('name', CFG.name); });
$('play').onclick = beginMode;
$('resume').onclick = resumeGame; $('quit').onclick = showMenu;
$('restart').onclick = () => { audioInit(); const d = race.def, l = race.laps; $('pause').classList.add('hide'); if (gp) gp.standings = gp.i > 0; startRace(d, l); };
$('again').onclick = () => { audioInit(); if (CFG.mode === 'gp') { if (gp.i < gp.tracks.length - 1) { gp.i++; startRace(trackDef(gp.tracks[gp.i]), 3); } else beginMode(); } else startRace(race.def, race.laps); };
$('menuBtn').onclick = showMenu;
const fov = $('fov'), vol = $('vol'); fov.value = S.fov; vol.value = S.vol;
fov.oninput = () => { S.fov = +fov.value; save('fov', S.fov); cam.fov = S.fov; }; vol.oninput = () => { setVolume(+vol.value); save('vol', S.vol); };
showMenu(); requestAnimationFrame(loop);
if (TOUCH) initTouch({
  visible: () => state === 'race', lookScale: 1, autoKeys: ['KeyW'], stickZone: .5, onStick: nx => { tAxis = nx; },
  stick: {},
  buttons: [
    { label: 'DRIFT', cls: 'fire', type: 'hold', key: 'Space', s: 96, r: 26, b: 56 },
    { label: 'ITEM', type: 'tap', key: 'KeyE', s: 70, r: 140, b: 130, cls: 'small', fs: 13, glow: () => !!(race && race.player.item && !race.player.itemRoll) },
    { label: 'BRAKE', type: 'hold', key: 'KeyS', s: 62, r: 146, b: 34, cls: 'small', fs: 11 },
    { label: 'BACK', type: 'tap', key: 'KeyR', s: 44, r: 40, b: 168, cls: 'small', fs: 9 },
    { label: 'II', type: 'tap', action: () => pauseGame(), s: 40, l: 150, t: 8, cls: 'small', fs: 14 },
  ],
  css: `
    html.touch #pos { top: 6px; left: 12px; } html.touch #posN { font-size: 48px; } html.touch #posS { font-size: 18px; }
    html.touch #lapBox { top: 6px; } html.touch #lapN { font-size: 17px; padding: 0 12px; min-width: 80px; } html.touch #lapT { font-size: 14px; margin-top: 2px; } html.touch #bestLap { font-size: 9px; }
    html.touch #itemBox { top: 62px; left: 12px; width: 62px; } html.touch #itemBox canvas { width: 56px; height: 56px; border-radius: 14px; } html.touch #itemN { font-size: 10px; margin-top: 2px; }
    html.touch #mini { top: 24px; right: 10px; width: 104px; height: 104px; }
    html.touch #speedBox { right: auto; left: 12px; bottom: 8px; } html.touch #speed { font-size: 30px; } html.touch #speedBox small { font-size: 11px; }
    html.touch #driftBar, html.touch #boostBar { width: 180px; font-size: 9px; } html.touch #driftBar { bottom: 12px; } html.touch #boostBar { bottom: 44px; } html.touch .trk { height: 8px; border-width: 2px; }
    html.touch #msg { top: 18%; } html.touch #msgA { font-size: 44px; } html.touch #msgB { font-size: 16px; }
  `,
});


if (DEBUG) window.__kr = { get race() { return race; }, get track() { return track; }, get state() { return state; }, get gp() { return gp; }, W, keys, CFG, step, render, startRace, showMenu, TRACKS, CLASSES, DIFFS, camera, renderer, scene, cam, trackDef, Track, Kart, nearest, pointAt, endRace, rankKarts, msg, beginMode };
