// KART RUSH - a toon kart racer: drift, jump, grab items and coins, and beat seven robots around six tracks in two cups.
import { THREE, V3, $, DEBUG, S, S2, GFX, GFX_PREF, QL, camera, renderer, scene, W, R, rnd, clamp, lerp, angDiff, TAU, load, save, hex, followSun, updateFX, burst, ring, audioInit, setVolume, sfx, adaptRes, blendSky, engineStart, engineSet, engineStop, FX, starMat, skidClear } from './core.js?v=3';
import { TRACKS, CUPS, Track, nearest, pointAt } from './track.js?v=3';
import { Kart, CLASSES, ITEMS, ITEM_KEYS, Items, bumpKarts, makeKartModel } from './kart.js?v=3';
import { DIFFS, makeAI, aiDrive } from './ai.js?v=3';
import { PROFILE, saveProfile, bump, meets, needText, checkUnlocks, secretKey, PAINTS, HATS, BASE_COLORS, RAINBOW } from './profile.js?v=3';
import { startMusic, stopMusic, setMusicVol } from './music.js?v=3';
import { createPreview } from './preview.js?v=3';
import * as Online from './online.js?v=3';
import { NETMODE } from './core.js?v=3';
const ON = Online.ON;
import { TOUCH, initTouch } from './touch.js?v=3';
let tAxis = 0;   // analog steering from the touch stick (-1 left .. 1 right)

const MODES = {
  gp: { name: 'Grand Prix', blurb: 'Race a whole cup of three tracks for points. Win the cup!' },
  single: { name: 'Single Race', blurb: 'Pick any track and race seven robots.' },
  trial: { name: 'Time Trial', blurb: 'Just you and the clock. Race your own ghost!' },
  online: { name: 'Online Race', blurb: 'Host a room or join one with a code and race your friends. Robots fill the empty spots.' },
};
const CCS = [{ id: 1, name: '100cc' }, { id: 1.12, name: '150cc' }, { id: 1.25, name: '200cc' }];
const COLORS = BASE_COLORS;
const BOT_NAMES = ['Blip', 'Zorp', 'Chomp', 'Bolt', 'Pixel', 'Waffle', 'Nacho', 'Turbo'];
const BOT_HATS = ['none', 'cone', 'ears', 'tophat', 'prop', 'phones', 'wizard', 'none'];
const PTS = [10, 7, 5, 4, 3, 2, 1, 0];
const CFG = { mode: load('mode', 'single'), track: load('track', 'sunny'), cup: load('cup', 'sun'), diff: load('diff', 'normal'), cls: load('cls', 'balanced'), hat: load('hat', 'none'), laps: load('laps', 3), name: load('name', ''), cc: load('cc', 1), mirror: !!load('mirror', false), bots: load('bots', true) !== false };
if (!MODES[CFG.mode]) CFG.mode = 'single'; if (!TRACKS.some(t => t.id === CFG.track)) CFG.track = 'sunny'; if (!CUPS.some(c => c.id === CFG.cup)) CFG.cup = 'sun'; if (!DIFFS[CFG.diff]) CFG.diff = 'normal'; if (!CCS.some(c => c.id === CFG.cc)) CFG.cc = 1;
// things you have not unlocked (for example from a save code of somebody else's) fall back to the free ones
const clsOK = c => meets(c.need), hatOK = h => meets(h.need), paintOK = p => meets(p.need);
{ const c = CLASSES.find(c => c.id === CFG.cls); if (!c || !clsOK(c)) CFG.cls = 'balanced'; const h = HATS.find(h => h.id === CFG.hat); if (!h || !hatOK(h)) CFG.hat = 'none'; const p = PAINTS.find(p => p.id === S.color); if (!p || !paintOK(p)) S.color = BASE_COLORS[0]; }
const UNLOCKABLES = [...PAINTS, ...HATS, ...CLASSES];

let state = 'menu', started = false, track = null, race = null, gp = null, menuTrack = null;
const keys = {}, cam = { h: 0, y: 0, shake: 0, init: false, fov: S.fov, roll: 0 };
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0]);
const fmtT = t => { if (!t && t !== 0) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const trackDef = id => TRACKS.find(t => t.id === id);
const colHex = c => c === RAINBOW ? '#ff8ad0' : hex(c);
const suffix = () => (CFG.cc !== 1 ? '.c' + CFG.cc : '') + (CFG.mirror ? '.m' : '');
const bestKey = id => 'best.' + id + suffix();
// the secret: Up, Down, Left, Left switches super speed ON for your races, Down, Right switches it OFF (on the menu, during the countdown, or in the pause box)
let SUPER = false; const SUPER_KMH = 250, superMul = k => Math.max(1.5, SUPER_KMH / 3.2 / (k.cls.top * k.cc));   // super speed aims for a top speed of about 250 km/h whatever kart you drive

// ================================================================== a race
function startRace(def, laps, net) {
  clearRace(); if (menuTrack) { menuTrack.dispose(); menuTrack = null; }
  track = new Track(def, net ? net.mirror : CFG.mirror); const tr = track.tr; blendSky(def.theme, def.theme, 0); scene.fog.color.setHex(def.theme.fog[0]);
  const trial = !net && CFG.mode === 'trial', n = trial ? 1 : 8, karts = [], D = DIFFS[net ? net.diff : CFG.diff] || DIFFS.normal, cc = net ? net.cc : CFG.cc, botCls = CLASSES.filter(c => !c.secret);
  let player;
  if (net) {   // online: every machine builds the same grid; my kart is the one with my id, the rest are driven by other players (or, on the host, by robots)
    net.grid.forEach((e, i) => {
      const mine = e.id === ON.pid, hostBot = !!e.bot && ON.role === 'host', ecls = CLASSES.find(c => c.id === e.cls) || CLASSES[0];
      const k = new Kart({ name: String(e.name || 'Racer').slice(0, 12), color: typeof e.color === 'number' ? e.color : 0xff4a4a, cls: ecls, hat: String(e.hat || 'none'), cc, isPlayer: mine, netId: e.id, remote: !mine && !hostBot, ai: hostBot ? makeAI(D, +e.lane || 0) : null });
      if (mine) { player = k; k.model.noFx = false; k.onTrick = () => { bump('tricks'); msg('TRICK!', 'Boost!', 900); }; }
      k.place0(tr, -9 - Math.floor(i / 2) * 8.5 - (i % 2) * 3.6, (i % 2 ? 4.8 : -4.8)); k.place = i + 1; karts.push(k);
    });
    if (!player) { player = karts[0]; }
  } else {
  const cls = CLASSES.find(c => c.id === CFG.cls); player = new Kart({ name: CFG.name || 'You', color: S.color, cls, hat: CFG.hat, cc, isPlayer: true }); player.model.noFx = false; player.sup = SUPER ? superMul(player) : 1;
  player.onTrick = () => { bump('tricks'); msg('TRICK!', 'Boost!', 900); };
  const used = new Set([S.color]), others = []; for (let i = 0; i < n - 1; i++) { let c = COLORS[(i * 3 + 1) % COLORS.length], g = 0; while (used.has(c) && g++ < 8) c = COLORS[(COLORS.indexOf(c) + 1) % COLORS.length]; used.add(c); others.push(new Kart({ name: BOT_NAMES[i], color: c, cls: botCls[i % botCls.length], cc, hat: BOT_HATS[i % BOT_HATS.length], ai: makeAI(D, (i % 5 - 2) / 2.2 + (Math.random() - .5) * .3) })); }
  // grid: best of the last race in front; a fresh race puts you near the back
  let order = [player, ...others]; if (gp && gp.standings) order.sort((a, b) => (gp.pts[b.name] || 0) - (gp.pts[a.name] || 0)); else if (!trial) { order = others.slice(); order.splice(Math.min(5, order.length), 0, player); }
  order.forEach((k, i) => { k.place0(tr, -9 - Math.floor(i / 2) * 8.5 - (i % 2) * 3.6, (i % 2 ? 4.8 : -4.8)); k.place = i + 1; karts.push(k); });
  }
  const best = net ? 0 : load(bestKey(def.id), 0);
  race = { net: !!net, def, tr, karts, player, items: new Items(), laps, t: 0, cd: 3.4, thrAt: null, state: 'count', trial, shown: 0, finishWait: 0, ended: false, boxes: track.boxes, pads: track.pads, coins: track.coins, ramps: track.ramps, lastLapMsg: -9, best, rec: [], recT: 0, ghostBest: 1e9, ghostKey: 'ghost.' + bestKey(def.id) + '.' + laps, ghostData: null, ghostK: null };
  if (trial) { const gd = load(race.ghostKey, null); if (gd && gd.d && gd.d.length > 30) { race.ghostData = gd; race.ghostBest = gd.t || 1e9; race.ghostK = makeGhost(); } }   // your best run is your ghost
  for (const k of karts) { k.lapStart = 0; k.prevLap = k.lap; } cam.init = false; cam.roll = 0;
  race.items.onUse = (k, it, ids) => { if (ON.active && !k.remote) Online.sendUse(k, it, ids); };   // online: tell everybody what I (or a robot I drive) just used
  state = 'race'; W.state = 'race'; hideScreens(); $('hud').style.visibility = 'visible'; $('mini').classList.toggle('hide', false); buildMini(); engineStart(); msg('', ''); $('bestLap').textContent = race.best ? 'BEST LAP ' + fmtT(race.best) : '';
  startMusic(def.id); skidClear();
}
function makeGhost() {
  const P = CLASSES.find(c => c.id === CFG.cls), m = makeKartModel(S.color, P.id, CFG.hat); m.g.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .38; o.material.depthWrite = false; } }); m.g.visible = false; scene.add(m.g); return m;
}
function ghostUpdate() {
  const r = race, g = r.ghostK, d = r.ghostData; if (!g || !d) return; const P = r.player, t = r.t, f = Math.max(0, t) / .1, i = Math.floor(f), n = d.d.length / 3;
  if (i + 1 >= n || P.finished) { g.g.visible = false; return; } g.g.visible = true; const a = f - i, L = r.tr.length, a0 = d.d[i * 3] / 10; let a1 = d.d[i * 3 + 3] / 10; if (a1 < a0 - L / 2) a1 += L;
  const lat = lerp(d.d[i * 3 + 1] / 10, d.d[i * 3 + 4] / 10, a), h0 = d.d[i * 3 + 2] / 100, h1 = d.d[i * 3 + 5] / 100, h = h0 + angDiff(h1, h0) * a, p = pointAt(r.tr, lerp(a0, a1, a), lat);
  g.g.position.set(p.x, p.y, p.z); g.g.rotation.y = h;
}
function clearRace() { if (race) { race.karts.forEach(k => k.remove()); race.items.clear(); if (race.ghostK) { scene.remove(race.ghostK.g); } race = null; } if (track) { track.dispose(); track = null; } engineStop(); FX.parts.forEach(p => { p.visible = false; FX.free.push(p); }); FX.parts.length = 0; }
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
    if (k.remote) continue;   // somebody else drives this one
    if (k.ai) aiDrive(k, tr, ctx, dt);
    else { const i = k.in; i.thr = thr ? 1 : 0; i.brk = (keys.KeyS || keys.ArrowDown) ? 1 : 0; i.steer = Math.abs(tAxis) > .14 ? clamp((Math.abs(tAxis) - .14) / .72, 0, 1) * Math.sign(tAxis) : ((keys.KeyA || keys.ArrowLeft) ? -1 : 0) + ((keys.KeyD || keys.ArrowRight) ? 1 : 0); i.drift = !!(keys.ShiftLeft || keys.ShiftRight || keys.Space); }
    if (k.in.itemPressed) { k.in.itemPressed = false; if (k.item && !k.itemRoll) r.items.use(k, r.karts, tr); }
  }
  const n = Math.max(1, Math.ceil(dt / (1 / 60))); for (let s = 0; s < n; s++) { for (const k of r.karts) if (!k.remote) k.step(dt / n, tr); bumpKarts(r.karts, dt / n); }
  r.items.update(dt, r.karts, tr);
  for (const k of r.karts) {
    if (k.remote) { Online.updateRemote(k, dt, tr); k.animate(dt); continue; }
    // item boxes
    if (!k.item && !k.itemRoll) for (const b of r.boxes) if (b.cd <= 0 && Math.hypot(k.p.x - b.x, k.p.z - b.z) < 2.6 && Math.abs(k.y + 1 - b.y) < 3.5) { b.cd = 4.5; b.m.visible = false; burst(new V3(b.x, b.y, b.z), 0xffe08a, 10, 6, .18, .5, 4, 2); if (k.isPlayer) { sfx('pickup'); k.itemRoll = 1.1; } else k.giveItem(r.items.roll(k.place - 1, r.karts.length)); break; }
    if (k.itemRoll > 0) { k.itemRoll -= dt; if (k.itemRoll <= 0) { k.itemRoll = 0; k.giveItem(r.items.roll(k.place - 1, r.karts.length)); sfx('use'); } }
    // boost pads
    for (const pd of r.pads) { const ds = ((k.s - pd.s + tr.length * 1.5) % tr.length) - tr.length / 2; if (Math.abs(ds) < 4.6 && Math.abs(k.d - pd.lat) < 4.4 && k.boostT < .9) { k.giveBoost(1.3, 3); if (k.isPlayer) burst(new V3(k.p.x, k.y + .5, k.p.z), 0x6affe0, 10, 7, .2, .5, 6, 1); } }
    // jump ramps: hit one fast and you fly
    for (const rp of r.ramps) { const ds = ((k.s - rp.s + tr.length * 1.5) % tr.length) - tr.length / 2; if (k.rampCD <= 0 && !k.air && ds > -2.5 && ds < 4 && Math.abs(k.d) < rp.hw + .6 && k.vf > 16) k.launch(7 + k.vf * .15); }
    // coins
    for (const c of r.coins) { if (c.cd > 0) continue; const dc = Math.abs(((k.s - c.s + tr.length * 1.5) % tr.length) - tr.length / 2); if (dc < 5 && Math.hypot(k.p.x - c.x, k.p.z - c.z) < 2.1 && Math.abs(k.y + 1.1 - c.y) < 2.4) { c.cd = 8; k.addCoin(); if (k.isPlayer) { bump('coins'); sfx('coin', k.coins); burst(new V3(c.x, c.y, c.z), 0xffd23a, 5, 5, .14, .4, 6, 2); } } }
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
  // record the whole run for the ghost (ten samples a second: where along the road, how far to the side, which way it points)
  if (r.trial && !P.finished) { r.recT += dt; while (r.recT >= .1) { r.recT -= .1; r.rec.push(Math.round(P.s * 10), Math.round(P.d * 10), Math.round((((P.h % TAU) + TAU) % TAU) * 100)); } }
  if (r.ghostK) ghostUpdate();
  if (ON.active) Online.tick(dt, r);
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
  if (trial && P.finished && r.rec.length > 30 && P.finishT < r.ghostBest) save(r.ghostKey, { t: Math.round(P.finishT * 1000) / 1000, d: r.rec.slice() });
  let newBest = false; if (!r.net && P.bestLap && (!r.best || P.bestLap < r.best)) { save(bestKey(def.id), P.bestLap); newBest = true; }
  const myPlace = rows.find(rw => rw.k === P).place; let title = trial ? 'TIME TRIAL DONE' : myPlace === 1 ? 'YOU WON!' : myPlace <= 3 ? 'ON THE PODIUM!' : 'RACE OVER';
  if (!trial) { bump('races'); if (myPlace === 1) bump('wins'); if (myPlace <= 3) bump('podiums'); }
  $('resT').textContent = title; $('resT').style.color = myPlace === 1 && !trial ? '#ffd34e' : '#fff'; if (!trial && myPlace <= 3) sfx('finish');
  if (!trial && myPlace === 1) for (let i = 0; i < 6; i++) setTimeout(() => { if (race && state === 'results') burst(new V3(P.p.x + rnd(-6, 6), P.y + rnd(2, 8), P.p.z + rnd(-6, 6)), [0xffd34e, 0xff4fa8, 0x2ee6ff, 0x6aff4a][i % 4], 22, 12, .3, 1.4, 6, 4); }, i * 260);
  const tbl = $('resTable'); tbl.innerHTML = ''; for (const rw of rows) { const tr = document.createElement('tr'); if (rw.k === P) tr.className = 'me'; tr.innerHTML = `<td>${rw.place}</td><td><i style="background:${colHex(rw.k.color)}"></i>${rw.k.name}</td><td>${rw.time !== null ? fmtT(rw.time) : '—'}</td><td>${rw.k.bestLap ? fmtT(rw.k.bestLap) : '—'}</td>${CFG.mode === 'gp' ? `<td>+${pts[rw.k.name] || 0}</td>` : ''}`; tbl.appendChild(tr); }
  const head = CFG.mode === 'gp' ? '<tr><th>#</th><th>Racer</th><th>Time</th><th>Best lap</th><th>Pts</th></tr>' : '<tr><th>#</th><th>Racer</th><th>Time</th><th>Best lap</th></tr>'; tbl.insertAdjacentHTML('afterbegin', head);
  $('resS').textContent = newBest ? `New best lap on ${def.name}: ${fmtT(P.bestLap)}!` : (P.bestLap ? `Your best lap: ${fmtT(P.bestLap)}` : '');
  let next = 'RACE AGAIN'; if (CFG.mode === 'gp') { if (gp.i < gp.tracks.length - 1) next = 'NEXT TRACK'; else { next = 'PLAY AGAIN'; const tot = Object.entries(gp.pts).sort((a, b) => b[1] - a[1]), won = tot[0][0] === (CFG.name || 'You'); if (won) bump('cups'); $('resT').textContent = won ? 'YOU WON THE ' + gp.cup.name.toUpperCase() + '!' : 'CUP OVER: ' + tot[0][0] + ' wins'; $('resT').style.fontSize = '40px'; $('resS').innerHTML = 'Cup standings: ' + tot.map(([n, p], i) => `${i + 1}. ${n} ${p}`).join(' &nbsp; '); } }
  const got = checkUnlocks(UNLOCKABLES).filter(u => !u.secret); saveProfile(); $('resU').textContent = got.length ? 'UNLOCKED: ' + got.map(u => u.name).join(', ') + '!' : ''; if (got.length) setTimeout(() => sfx('unlock'), 700);
  if (r.net) { next = ON.role === 'host' ? 'RACE AGAIN' : 'WAITING FOR THE HOST'; $('again').disabled = ON.role !== 'host'; $('menuBtn').textContent = ON.role === 'host' ? 'Back to lobby' : 'Leave room'; } else { $('again').disabled = false; $('menuBtn').textContent = 'Menu'; }
  $('again').textContent = next; $('results').classList.remove('hide');
}

// ================================================================== camera + HUD
function updateCamera(dt) {
  const P = race ? race.player : null; if (!P) return;
  const sp = Math.hypot(P.vx, P.vz), target = P.spinT > 0 ? cam.h : (P.drift.on ? P.h + P.drift.dir * .12 : (sp > 8 ? lerpAng(P.h, Math.atan2(P.vx, P.vz), .35) : P.h));
  if (!cam.init) { cam.h = P.h; cam.y = P.y + 3.6; cam.init = true; } cam.h += angDiff(target, cam.h) * Math.min(1, dt * (P.drift.on ? 2.6 : 7));
  const back = 8.4 + clamp(sp / 60, 0, 1) * 1.8 + (P.boostT > 0 ? 1.2 : 0); cam.y += (P.y + 3.7 - cam.y) * Math.min(1, dt * (P.air ? 3 : 7));
  const px = P.p.x - Math.sin(cam.h) * back, pz = P.p.z - Math.cos(cam.h) * back; camera.position.set(px, Math.max(cam.y, P.y + 2.2), pz);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2.5); camera.position.x += (Math.random() - .5) * cam.shake * .8; camera.position.y += (Math.random() - .5) * cam.shake * .6; }
  camera.lookAt(P.p.x + Math.sin(cam.h) * 7, P.y + 1.5, P.p.z + Math.cos(cam.h) * 7);
  cam.roll += ((P.drift.on ? -P.drift.dir * .05 : 0) - cam.roll) * Math.min(1, dt * 5); if (Math.abs(cam.roll) > .001) camera.rotateZ(cam.roll);   // the camera leans into a drift
  const wf = S.fov + clamp(sp / 60, 0, 1) * 9 + (P.boostT > 0 ? 9 : 0) + (P.star > 0 ? 4 : 0); cam.fov += (wf - cam.fov) * Math.min(1, dt * 5); if (Math.abs(camera.fov - cam.fov) > .05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}
const lerpAng = (a, b, t) => a + angDiff(b, a) * t;
let msgT = 0; function msg(a, b, ms = 1200) { $('msgA').textContent = a; $('msgB').textContent = b || ''; const m = $('msg'); m.classList.remove('on'); void m.offsetWidth; if (a) m.classList.add('on'); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('on'), ms); }
let noteT = 0; function note(text, ms = 3200) { const n = $('note'); n.textContent = text; n.classList.add('on'); clearTimeout(noteT); noteT = setTimeout(() => n.classList.remove('on'), ms); }
const lastHud = {}; const setT = (id, t) => { if (lastHud[id] !== t) { lastHud[id] = t; $(id).textContent = t; } };
const itemCv = $('itemCv').getContext('2d');
function rocketIcon(c, fill, s = 1) { c.save(); c.scale(s, s); c.fillStyle = '#e8eefc'; c.beginPath(); c.roundRect(-8, -22, 16, 38, 8); c.fill(); c.stroke(); c.fillStyle = fill; c.beginPath(); c.moveTo(-8, -10); c.lineTo(0, -26); c.lineTo(8, -10); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-8, 8); c.lineTo(-18, 20); c.lineTo(-8, 16); c.moveTo(8, 8); c.lineTo(18, 20); c.lineTo(8, 16); c.fillStyle = fill; c.fill(); c.stroke(); c.restore(); }
function boltIcon(c, fill) { c.fillStyle = fill; c.beginPath(); c.moveTo(-6, -22); c.lineTo(14, -22); c.lineTo(2, -4); c.lineTo(16, -4); c.lineTo(-10, 24); c.lineTo(-2, 4); c.lineTo(-14, 4); c.closePath(); c.fill(); c.stroke(); }
function drawItem(id, qty) {
  const c = itemCv; c.clearRect(0, 0, 64, 64); if (!id) return; c.save(); c.translate(32, 32); c.lineWidth = 4; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = '#1a1030';
  const fill = ITEMS[id] ? ITEMS[id].col : '#fff';
  if (id === 'turbo') boltIcon(c, fill);
  else if (id === 'turbo3') { c.save(); c.scale(.8, .8); c.translate(-3, -2); boltIcon(c, fill); c.restore(); c.fillStyle = '#fff'; c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.lineWidth = 5; c.strokeText('x' + (qty || 3), 17, 24); c.fillText('x' + (qty || 3), 17, 24); }
  else if (id === 'rocket') { c.rotate(-.7); rocketIcon(c, fill); }
  else if (id === 'rocket3') { for (const [dx, dy, rot] of [[-15, 4, -1.0], [0, -2, -.7], [15, 4, -.4]]) { c.save(); c.translate(dx, dy); c.rotate(rot); rocketIcon(c, fill, .55); c.restore(); } }
  else if (id === 'seeker') { c.rotate(-.7); rocketIcon(c, fill); c.rotate(.7); c.fillStyle = '#fff'; c.beginPath(); c.arc(-1, 1, 7, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#1a1030'; c.beginPath(); c.arc(0, 1, 3, 0, TAU); c.fill(); }
  else if (id === 'banana') { c.fillStyle = fill; c.beginPath(); c.ellipse(0, 4, 22, 14, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#9a8aff'; c.beginPath(); c.ellipse(-6, 0, 8, 5, .3, 0, TAU); c.fill(); }
  else if (id === 'mine') { c.fillStyle = '#2a2140'; c.beginPath(); c.arc(0, 5, 17, 0, TAU); c.fill(); c.stroke(); c.strokeStyle = '#ff6a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, -11); c.quadraticCurveTo(14, -18, 9, -25); c.stroke(); c.fillStyle = '#ffd34e'; c.beginPath(); c.arc(9, -25, 4, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(-6, 0, 4, 0, TAU); c.fill(); }
  else if (id === 'shield') { c.fillStyle = fill; c.beginPath(); c.moveTo(0, -24); c.lineTo(20, -14); c.lineTo(16, 10); c.lineTo(0, 24); c.lineTo(-16, 10); c.lineTo(-20, -14); c.closePath(); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(0, -16); c.lineTo(11, -10); c.lineTo(0, 14); c.closePath(); c.fill(); }
  else if (id === 'zap') { c.fillStyle = fill; c.beginPath(); c.moveTo(4, -26); c.lineTo(-14, 4); c.lineTo(-2, 4); c.lineTo(-6, 26); c.lineTo(16, -6); c.lineTo(3, -6); c.closePath(); c.fill(); c.stroke(); }
  else if (id === 'star') { c.fillStyle = fill; c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? 11 : 25, a = -Math.PI / 2 + i * Math.PI / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr + 1); } c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
let miniBox = null;
function buildMini() { const pts = race.tr; let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9; for (let i = 0; i < pts.N; i++) { mnx = Math.min(mnx, pts.x[i]); mxx = Math.max(mxx, pts.x[i]); mnz = Math.min(mnz, pts.z[i]); mxz = Math.max(mxz, pts.z[i]); } const sc = 150 / Math.max(mxx - mnx, mxz - mnz); miniBox = { mnx, mnz, sc, ox: (170 - (mxx - mnx) * sc) / 2, oz: (170 - (mxz - mnz) * sc) / 2 }; }
const miniCtx = $('mini').getContext('2d');
function drawMini() {
  const c = miniCtx, b = miniBox, tr = race.tr; c.clearRect(0, 0, 170, 170); c.lineJoin = 'round'; c.lineCap = 'round'; const X = x => b.ox + (x - b.mnx) * b.sc, Z = z => b.oz + (z - b.mnz) * b.sc;
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 9; c.beginPath(); for (let i = 0; i <= tr.N; i += 4) { const k = i % tr.N; i ? c.lineTo(X(tr.x[k]), Z(tr.z[k])) : c.moveTo(X(tr.x[k]), Z(tr.z[k])); } c.closePath(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.stroke();
  for (const rp of race.ramps) { c.fillStyle = '#ffc01a'; c.fillRect(X(rp.x) - 3, Z(rp.z) - 3, 6, 6); }
  for (const k of race.karts) { if (k.isPlayer) continue; c.fillStyle = colHex(k.color); c.beginPath(); c.arc(X(k.p.x), Z(k.p.z), 3.4, 0, TAU); c.fill(); }
  const P = race.player; c.fillStyle = '#fff'; c.strokeStyle = colHex(P.color); c.lineWidth = 3; c.beginPath(); c.arc(X(P.p.x), Z(P.p.z), 5.5, 0, TAU); c.fill(); c.stroke();
}
let fxLast = -1;
function updateHUD(dt) {
  const r = race, P = r.player; if (!r) return; setT('posN', String(P.place)); setT('posS', ord(P.place).replace(/\d+/, '') + (r.trial ? '' : ' / ' + r.karts.length)); $('pos').classList.toggle('hide', r.trial);
  setT('lapN', Math.min(Math.max(P.lap + 1, 1), r.laps) + ' / ' + r.laps); setT('speed', String(Math.round(Math.abs(P.vf) * 3.2))); const lt = P.lap >= 0 ? r.t - P.lapStart : 0; setT('lapT', fmtT(P.finished ? P.lapTimes[P.lapTimes.length - 1] || 0 : lt)); if (P.bestLap) setT('bestLap', 'BEST LAP ' + fmtT(Math.min(P.bestLap, r.best || 9999)));
  const show = P.itemRoll > 0 ? ITEM_KEYS[(Math.floor(W.time * 14)) % ITEM_KEYS.length] : P.item, qk = show + ':' + P.itemQty; if (lastHud.item !== qk || P.itemRoll > 0) { lastHud.item = qk; drawItem(show, P.itemQty); } $('itemBox').classList.toggle('has', !!show); $('itemBox').classList.toggle('roll', P.itemRoll > 0); setT('itemN', P.itemRoll > 0 ? '' : show ? ITEMS[show].name : '');
  setT('coinN', String(P.coins)); $('coinBox').classList.toggle('max', P.coins >= 10); $('starBox').classList.toggle('hide', P.star <= 0); if (P.star > 0) setT('starBox', 'STAR ' + P.star.toFixed(1));
  // drift charge bar
  const dr = P.drift; $('driftBar').classList.toggle('hide', !dr.on); if (dr.on) { const f = Math.min(1, dr.t / 2.5); $('driftF').style.width = (f * 100) + '%'; $('driftF').style.background = ['#9ab0ff', '#4aa8ff', '#ffa02a', '#d44aff'][dr.tier]; }
  $('boostBar').classList.toggle('hide', P.boostT <= 0);
  const sp = Math.hypot(P.vx, P.vz), fx = Math.round(clamp((sp - 36) / 44, 0, .5) * 50 + (P.boostT > 0 ? 14 : 0)) / 50; if (fx !== fxLast) { fxLast = fx; $('speedfx').style.opacity = fx; }   // speed lines
  drawMini(); $('zap').style.opacity = r.items.zapFlash || 0; $('hit').style.opacity = P.spinT > 0 ? .35 : 0;
}

// ================================================================== loop
let last = performance.now(), fpsN = 0, fpsT = 0, fpsTxt = '', renderTick = 0, preview = null;
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function step(dt) {
  W.time += dt; updateFX(dt);
  if (state === 'race') { raceStep(dt); updateCamera(dt); updateHUD(dt); if (QL.shadow) followSun(race.player.p.x, race.player.y, race.player.p.z); }
  else if (state === 'pause') { updateHUD(dt); }
  else if (state === 'results') { for (const k of race.karts) { aiDriveAuto(k, dt); k.animate(dt); } race.items.update(dt, race.karts, race.tr); track.update(dt, W.time); updateCamera(dt); }
  else if (state === 'menu' || state === 'lobby') { menuCamera(dt); if (menuTrack) menuTrack.update(dt, W.time); if (preview && state === 'menu') preview.render(W.time); }
}
function aiDriveAuto(k, dt) { if (!k.ai) k.ai = makeAI(DIFFS.normal, 0); aiDrive(k, race.tr, { karts: race.karts, player: null, racing: true }, dt); const n = Math.max(1, Math.ceil(dt / (1 / 60))); for (let i = 0; i < n; i++) k.step(dt / n, race.tr); }
function menuCamera(dt) { if (!menuTrack) return; const tr = menuTrack.tr, t = W.time * .035, i = Math.floor((t * tr.N) % tr.N), p = pointAt(tr, i * tr.ds, 0), q = pointAt(tr, i * tr.ds + 60, 0); camera.position.set(p.x - p.tx * 10, p.y + 9, p.z - p.tz * 10); camera.lookAt(q.x, q.y + 1, q.z); }
function render() { if (QL.skip) renderer.shadowMap.needsUpdate = (renderTick++ & 1) === 0; renderer.render(scene, camera); }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; const hv = (state === 'menu' || state === 'lobby' || state === 'results') ? 'hidden' : 'visible'; if ($('hud').style.visibility !== hv) $('hud').style.visibility = hv; step(dt); render(); adaptRes(raw, state === 'race'); fpsTick(raw); requestAnimationFrame(loop); }

// ================================================================== input
let arrowSeq = [];
const SUPER_SEQ = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowLeft'];
function superKey(code) {   // Up, Down, Left, Left within three seconds = on; Down, Right = off. Never while racing, where those are just driving keys.
  if (!code.startsWith('Arrow') || !(state === 'menu' || state === 'pause' || state === 'results' || (state === 'race' && race && race.state === 'count'))) { arrowSeq = []; return; }
  const now = performance.now(); arrowSeq.push([code, now]); arrowSeq = arrowSeq.filter(x => now - x[1] < 3000).slice(-4);
  const last = arrowSeq.map(x => x[0]);
  if (last.length === 4 && last.every((c, i) => c === SUPER_SEQ[i])) { arrowSeq = []; if (!SUPER) setSuper(true); }
  else if (last.length >= 2 && last[last.length - 2] === 'ArrowDown' && last[last.length - 1] === 'ArrowRight') { arrowSeq = []; if (SUPER) setSuper(false); }
}
function setSuper(on) {
  SUPER = on; if (race && race.player && !race.ended) race.player.sup = on ? superMul(race.player) : 1; sfx(on ? 'star' : 'tick'); const m = on ? 'SUPER SPEED ON' : 'SUPER SPEED OFF';
  if (state === 'race') msg(m, '', 1100); else note(m, 1800);
}
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && (state === 'race' || state === 'pause')) e.preventDefault();
  if (e.repeat) return; keys[e.code] = true; superKey(e.code);
  if (state === 'menu' && e.target.tagName !== 'INPUT' && e.key.length === 1 && secretKey(e.key)) { sfx('unlock'); checkUnlocks(UNLOCKABLES); note('SECRET KART UNLOCKED: PROTOTYPE!', 4200); renderMenu(); }
  if (e.code === 'Escape') { if (state === 'race') { if (ON.active && !$('pause').classList.contains('hide')) resumeGame(); else pauseGame(); } else if (state === 'pause') resumeGame(); return; }
  if (state !== 'race' || !race) return; const P = race.player;
  if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyQ') && P.item && !P.itemRoll) P.in.itemPressed = true;
});
addEventListener('mousedown', e => { if (state === 'race' && race && e.button === 0 && race.player.item && !race.player.itemRoll) race.player.in.itemPressed = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let gestured = false; const onGesture = () => { if (gestured) return; gestured = true; audioInit(); if (state === 'menu') startMusic('menu'); }; addEventListener('pointerdown', onGesture); addEventListener('keydown', onGesture);
function pauseGame() { if (state !== 'race') return; $('restart').classList.toggle('hide', ON.active); if (ON.active) { $('pause').classList.remove('hide'); return; } state = 'pause'; W.state = 'pause'; engineSet(0, false, 0, 0); $('pause').classList.remove('hide'); }
function resumeGame() { if (ON.active && state === 'race') { $('pause').classList.add('hide'); return; } if (state !== 'pause') return; state = 'race'; W.state = 'race'; $('pause').classList.add('hide'); audioInit(); engineStart(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'race' && !ON.active) pauseGame(); });

// ================================================================== menus
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function hideScreens() { for (const id of ['menu', 'pause', 'results', 'lobby']) $(id).classList.add('hide'); }
const prevCv = document.createElement('canvas'); prevCv.width = 300; prevCv.height = 190; prevCv.id = 'kartPrev'; let previewTried = false;
function refreshPreview() { if (!previewTried) { previewTried = true; preview = createPreview(prevCv); } if (preview) preview.set(S.color, CFG.cls, CFG.hat); }
function pickLocked(note2, need) { sfx('wrong'); note2.textContent = 'LOCKED: ' + needText(need); }
function renderMenu() {
  const root = $('menuPickers'); root.innerHTML = '';
  const gm = mk('div', 'grp'); gm.appendChild(mk('h3', '', 'MODE')); const cards = mk('div', 'modes');
  for (const id of Object.keys(MODES)) { const c = mk('button', 'modec' + (id === CFG.mode ? ' sel' : '')); c.appendChild(mk('b', '', MODES[id].name)); c.appendChild(mk('span', '', MODES[id].blurb)); c.onclick = () => { CFG.mode = id; save('mode', id); sfx('click'); renderMenu(); }; cards.appendChild(c); }
  gm.appendChild(cards); root.appendChild(gm);
  if (CFG.mode === 'gp') {
    const gc = mk('div', 'grp'); gc.appendChild(mk('h3', '', 'CUP')); const cc = mk('div', 'modes');
    for (const cup of CUPS) { const t0 = trackDef(cup.tracks[0]).theme.swatch, t2 = trackDef(cup.tracks[2]).theme.swatch, c = mk('button', 'modec track' + (cup.id === CFG.cup ? ' sel' : '')); c.style.background = `linear-gradient(160deg, ${t0[0]}, ${t0[1]} 45%, ${t2[2]})`; c.appendChild(mk('b', '', cup.name)); c.appendChild(mk('span', '', cup.blurb)); c.onclick = () => { CFG.cup = cup.id; save('cup', cup.id); sfx('click'); renderMenu(); }; cc.appendChild(c); }
    gc.appendChild(cc); root.appendChild(gc);
  } else {
    const gt = mk('div', 'grp'); gt.appendChild(mk('h3', '', 'TRACK')); const tc = mk('div', 'modes'); for (const t of TRACKS) { const c = mk('button', 'modec track' + (t.id === CFG.track ? ' sel' : '')); c.style.background = `linear-gradient(160deg, ${t.theme.swatch[0]}, ${t.theme.swatch[1]} 60%, ${t.theme.swatch[2]})`; c.appendChild(mk('b', '', t.name)); c.appendChild(mk('span', '', t.blurb)); const best = load(bestKey(t.id), 0); if (best) c.appendChild(mk('i', '', 'Best lap ' + fmtT(best))); c.onclick = () => { CFG.track = t.id; save('track', t.id); sfx('click'); renderMenu(); }; tc.appendChild(c); } gt.appendChild(tc);
    const rl = mk('div', 'row'); rl.appendChild(mk('span', 'lbl', 'LAPS')); for (const n of [1, 3, 5]) { const b = mk('button', 'small' + (n === CFG.laps ? ' sel' : ''), String(n)); b.onclick = () => { CFG.laps = n; save('laps', n); renderMenu(); }; rl.appendChild(b); } gt.appendChild(rl); root.appendChild(gt);
  }
  const gs = mk('div', 'grp'); gs.appendChild(mk('h3', '', 'SPEED')); const rs = mk('div', 'row');
  for (const c of CCS) { const b = mk('button', c.id === CFG.cc ? 'sel' : '', c.name); b.onclick = () => { CFG.cc = c.id; save('cc', c.id); sfx('click'); renderMenu(); }; rs.appendChild(b); }
  const mb = mk('button', CFG.mirror ? 'sel alt' : 'alt', 'Mirror: ' + (CFG.mirror ? 'ON' : 'off')); mb.onclick = () => { CFG.mirror = !CFG.mirror; save('mirror', CFG.mirror); sfx('click'); renderMenu(); }; rs.appendChild(mb); gs.appendChild(rs);
  gs.appendChild(mk('p', 'mdesc', 'Faster classes are harder. Mirror flips every track. Best laps are saved for each setting.')); root.appendChild(gs);
  if (CFG.mode !== 'trial') { const gd = mk('div', 'grp'); gd.appendChild(mk('h3', '', 'ROBOT RIVALS')); const rd = mk('div', 'row'); for (const id of Object.keys(DIFFS)) { const b = mk('button', id === CFG.diff ? 'sel' : '', DIFFS[id].name); b.onclick = () => { CFG.diff = id; save('diff', id); renderMenu(); }; rd.appendChild(b); } gd.appendChild(rd); if (CFG.mode === 'online') { const tb = mk('button', CFG.bots ? 'sel alt' : 'alt', 'Robots fill empty spots: ' + (CFG.bots ? 'ON' : 'off')); tb.onclick = () => { CFG.bots = !CFG.bots; save('bots', CFG.bots); sfx('click'); renderMenu(); }; const rb = mk('div', 'row'); rb.appendChild(tb); gd.appendChild(rb); } root.appendChild(gd); }
  // the garage: your kart, paint and hat. Locked ones show what to do to get them.
  const gk = mk('div', 'grp'); gk.appendChild(mk('h3', '', 'GARAGE')); const gar = mk('div', 'garage'), col = mk('div', 'col'), lockNote = mk('div', 'lockNote', ''); gar.appendChild(prevCv); gar.appendChild(col);
  col.appendChild(mk('h4', '', 'KART')); const kc = mk('div', 'modes');
  for (const c of CLASSES) { if (c.secret && !PROFILE.secret) continue; const ok = clsOK(c), b = mk('button', 'modec small' + (c.id === CFG.cls ? ' sel' : '') + (ok ? '' : ' locked')); b.appendChild(mk('b', '', c.name)); b.appendChild(mk('span', '', c.desc)); b.onclick = () => { if (!ok) { pickLocked(lockNote, c.need); return; } CFG.cls = c.id; save('cls', c.id); sfx('click'); renderMenu(); }; kc.appendChild(b); }
  col.appendChild(kc);
  col.appendChild(mk('h4', '', 'PAINT')); const rc = mk('div', 'row sw');
  for (const p of PAINTS) { const ok = paintOK(p), b = mk('button', 'swatch' + (p.id === S.color ? ' sel' : '') + (ok ? '' : ' locked')); b.title = p.name; b.style.background = p.id === RAINBOW ? 'conic-gradient(#ff4a4a, #ffd31a, #6aff4a, #2ee6ff, #b06bff, #ff4a4a)' : hex(p.id); b.onclick = () => { if (!ok) { pickLocked(lockNote, p.need); return; } S.color = p.id; save('color', p.id); sfx('click'); renderMenu(); }; rc.appendChild(b); }
  col.appendChild(rc);
  col.appendChild(mk('h4', '', 'HAT')); const rh = mk('div', 'hats');
  for (const h of HATS) { const ok = hatOK(h), b = mk('button', 'hat small' + (h.id === CFG.hat ? ' sel' : '') + (ok ? '' : ' locked'), h.name); b.onclick = () => { if (!ok) { pickLocked(lockNote, h.need); return; } CFG.hat = h.id; save('hat', h.id); sfx('click'); renderMenu(); }; rh.appendChild(b); }
  col.appendChild(rh); col.appendChild(lockNote); col.appendChild(mk('p', 'stats', `${PROFILE.wins} wins · ${PROFILE.cups} cups · ${PROFILE.coins} coins · ${PROFILE.tricks} tricks`));
  gk.appendChild(gar); root.appendChild(gk); refreshPreview();
  const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
  for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !new URLSearchParams(location.search).get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' : ''); }; rg.appendChild(b); }
  gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (['low', 'med', 'high'].includes(GFX_PREF) ? '' : ' (picked automatically for this computer)') + '. On a Chromebook or a slow laptop, Low runs smoothest.')); root.appendChild(gg);
  $('play').classList.toggle('hide', CFG.mode === 'online'); $('onlineRow').classList.toggle('hide', CFG.mode !== 'online');
}
function showMenu() {
  saveProfile(); state = 'menu'; W.state = 'menu'; hideScreens(); $('menu').classList.remove('hide'); clearRace(); gp = null; $('hud').style.visibility = 'hidden'; $('speedfx').style.opacity = 0; fxLast = 0;
  if (!menuTrack) { menuTrack = new Track(trackDef(CFG.track)); const d = menuTrack.def.theme; blendSky(d, d, 0); scene.fog.color.setHex(d.fog[0]); }
  renderMenu(); startMusic('menu');
}
function beginMode() {
  audioInit(); const pn = $('pname').value.trim().slice(0, 12); CFG.name = pn; save('name', pn);
  if (CFG.mode === 'gp') { const cup = CUPS.find(c => c.id === CFG.cup); gp = { cup, tracks: cup.tracks.slice(), i: 0, pts: {}, standings: false }; startRace(trackDef(gp.tracks[0]), 3); }
  else { gp = null; startRace(trackDef(CFG.track), CFG.laps); }
}
$('pname').value = CFG.name; $('pname').addEventListener('input', e => { CFG.name = e.target.value.slice(0, 12); save('name', CFG.name); });
$('play').onclick = beginMode;
$('resume').onclick = resumeGame; $('quit').onclick = () => { if (ON.active) Online.leave(); showMenu(); };
$('restart').onclick = () => { audioInit(); const d = race.def, l = race.laps; $('pause').classList.add('hide'); if (gp) gp.standings = gp.i > 0; startRace(d, l); };
$('again').onclick = () => { audioInit(); if (ON.active) { if (ON.role === 'host') startOnlineRace(); return; } if (CFG.mode === 'gp') { if (gp.i < gp.tracks.length - 1) { gp.i++; startRace(trackDef(gp.tracks[gp.i]), 3); } else beginMode(); } else startRace(race.def, race.laps); };
$('menuBtn').onclick = () => { if (ON.active) { if (ON.role === 'host') { Online.hostLobby(); showLobby(); } else { Online.leave(); showMenu(); } } else showMenu(); };
const fov = $('fov'), vol = $('vol'), mus = $('music'); fov.value = S.fov; vol.value = S.vol; mus.value = S2.music;
fov.oninput = () => { S.fov = +fov.value; save('fov', S.fov); cam.fov = S.fov; }; vol.oninput = () => { setVolume(+vol.value); save('vol', S.vol); }; mus.oninput = () => setMusicVol(+mus.value);
// ================================================================== online: rooms and the lobby
const profile = () => ({ name: ($('pname').value.trim() || CFG.name || 'Racer').slice(0, 12), color: S.color, cls: CFG.cls, hat: CFG.hat });
const netCfg = () => ({ track: CFG.track, laps: CFG.laps, cc: CFG.cc, mirror: CFG.mirror, diff: CFG.diff, bots: CFG.bots });
const netError = e => (e && e.type === 'peer-unavailable') ? 'No room with that code' : (e && e.type === 'timeout') ? 'Could not connect (timed out)' : (e && e.type === 'unavailable-id') ? 'That room code is taken' : (!window.Peer && NETMODE !== 'local') ? 'Online play could not load' : 'Could not connect';
function showLobby() {
  state = 'lobby'; W.state = 'lobby'; hideScreens(); clearRace(); $('lobby').classList.remove('hide'); $('hud').style.visibility = 'hidden';
  if (!menuTrack) { menuTrack = new Track(trackDef(CFG.track)); const d = menuTrack.def.theme; blendSky(d, d, 0); scene.fog.color.setHex(d.fog[0]); }
  renderLobby();
}
function renderLobby() {
  if (!ON.active) return; $('lobCode').textContent = ON.code || '-----'; const ro = $('lobRoster'); ro.innerHTML = '';
  for (const p of ON.roster) { const row = mk('div', 'pl'), dot = mk('i'); dot.style.background = colHex(typeof p.color === 'number' ? p.color : 0xff4a4a); row.appendChild(dot); row.appendChild(mk('span', '', p.name + (p.pid === ON.pid ? ' (you)' : ''))); row.appendChild(mk('small', '', (p.pid === 0 ? 'HOST · ' : '') + (CLASSES.find(c => c.id === p.cls) || CLASSES[0]).name.toUpperCase())); ro.appendChild(row); }
  const host = ON.role === 'host', cfg = host ? netCfg() : (ON.cfg || netCfg()), cd = $('lobCfg'); cd.innerHTML = '';
  if (host) {
    const rt = mk('div', 'row'); rt.appendChild(mk('span', 'lbl', 'TRACK')); const sel = mk('select'); for (const t of TRACKS) { const o = mk('option', '', t.name); o.value = t.id; if (t.id === CFG.track) o.selected = true; sel.appendChild(o); } sel.onchange = () => { CFG.track = sel.value; save('track', CFG.track); Online.setCfg(netCfg()); renderLobby(); }; rt.appendChild(sel); cd.appendChild(rt);
    const rl = mk('div', 'row'); rl.appendChild(mk('span', 'lbl', 'LAPS')); for (const n of [1, 3, 5]) { const b = mk('button', 'small' + (n === CFG.laps ? ' sel' : ''), String(n)); b.onclick = () => { CFG.laps = n; save('laps', n); Online.setCfg(netCfg()); renderLobby(); }; rl.appendChild(b); } cd.appendChild(rl);
    const rc = mk('div', 'row'); rc.appendChild(mk('span', 'lbl', 'SPEED')); for (const c of CCS) { const b = mk('button', 'small' + (c.id === CFG.cc ? ' sel' : ''), c.name); b.onclick = () => { CFG.cc = c.id; save('cc', c.id); Online.setCfg(netCfg()); renderLobby(); }; rc.appendChild(b); }
    const mb = mk('button', 'small alt' + (CFG.mirror ? ' sel' : ''), 'Mirror: ' + (CFG.mirror ? 'ON' : 'off')); mb.onclick = () => { CFG.mirror = !CFG.mirror; save('mirror', CFG.mirror); Online.setCfg(netCfg()); renderLobby(); }; rc.appendChild(mb);
    const bb = mk('button', 'small alt' + (CFG.bots ? ' sel' : ''), 'Robots: ' + (CFG.bots ? 'ON' : 'off')); bb.onclick = () => { CFG.bots = !CFG.bots; save('bots', CFG.bots); Online.setCfg(netCfg()); renderLobby(); }; rc.appendChild(bb); cd.appendChild(rc);
  } else { const t = trackDef(cfg.track) || TRACKS[0], cc = CCS.find(c => c.id === cfg.cc) || CCS[0]; cd.appendChild(mk('div', 'txt', t.name + ' · ' + cfg.laps + ' lap' + (cfg.laps === 1 ? '' : 's') + ' · ' + cc.name + (cfg.mirror ? ' · mirror' : '') + (cfg.bots ? ' · robots fill the empty spots' : ' · no robots'))); }
  $('lobStart').classList.toggle('hide', !host); $('lobMsg').textContent = ON.status || (host ? (ON.roster.length < 2 ? 'Waiting for friends to join... (you can also start alone with robots)' : ON.roster.length + ' players in the room') : 'Waiting for the host to start the race...');
}
function startOnlineRace() {
  if (ON.role !== 'host') return; audioInit(); const cfg = netCfg(), nb = cfg.bots ? Math.max(0, 8 - ON.roster.length) : 0, botCls = CLASSES.filter(c => !c.secret), bots = [];
  for (let i = 0; i < nb; i++) bots.push({ id: 100 + i, name: BOT_NAMES[i], color: COLORS[(i * 3 + 1) % COLORS.length], cls: botCls[i % botCls.length].id, hat: BOT_HATS[i % BOT_HATS.length], lane: (i % 5 - 2) / 2.2 });
  const m = Online.hostStart(cfg, bots); if (m) startNetRace(m);
}
function startNetRace(m) { const c = m.cfg || {}; hideScreens(); startRace(trackDef(c.track) || TRACKS[0], [1, 3, 5].includes(c.laps) ? c.laps : 3, { grid: m.grid || [], cc: CCS.some(x => x.id === c.cc) ? c.cc : 1, mirror: !!c.mirror, diff: DIFFS[c.diff] ? c.diff : 'normal' }); }
function replayUse(m) {   // another player used an item: do the same thing here (rockets, oil, bombs...); what hits MY kart is decided here
  const r = race; if (!r) return; const k = r.karts.find(k => k.netId === m.id); if (!k || !k.remote || !ITEMS[m.it]) return;
  const sv = [k.p.x, k.p.z, k.y, k.h, k.vf, k.item, k.itemQty]; k.item = m.it; k.p.x = +m.x || 0; k.p.z = +m.z || 0; k.y = +m.y || 0; k.h = +m.h || 0; k.vf = +m.vf || 0;
  r.items.use(k, r.karts, r.tr, Array.isArray(m.tg) ? m.tg : []); [k.p.x, k.p.z, k.y, k.h, k.vf, k.item, k.itemQty] = sv; k.p.y = k.y;
}
Online.init({
  getRace: () => race, lobbyChanged: () => { if (state === 'lobby') renderLobby(); }, showLobby: () => showLobby(), startNet: m => startNetRace(m), applyUse: m => replayUse(m),
  removeKart: id => { if (!race) return; const i = race.karts.findIndex(k => k.netId === id); if (i >= 0) { race.karts[i].remove(); race.karts.splice(i, 1); } },
  disconnected: text => { showMenu(); note(text, 5000); },
});
$('hostBtn').onclick = () => { audioInit(); CFG.name = $('pname').value.trim().slice(0, 12); save('name', CFG.name); $('hostBtn').disabled = true; Online.host(profile(), netCfg()).then(() => { $('hostBtn').disabled = false; showLobby(); }).catch(e => { $('hostBtn').disabled = false; note(netError(e), 4200); }); };
$('joinBtn').onclick = () => { audioInit(); const code = Online.cleanCode($('joinCode').value); $('joinCode').value = code; if (code.length !== 5) { note('Type the 5-letter room code first', 2800); return; } CFG.name = $('pname').value.trim().slice(0, 12); save('name', CFG.name); $('joinBtn').disabled = true; Online.join(code, profile()).then(() => { $('joinBtn').disabled = false; showLobby(); }).catch(e => { $('joinBtn').disabled = false; note(netError(e), 4200); }); };
$('lobStart').onclick = startOnlineRace; $('lobLeave').onclick = () => { Online.leave(); showMenu(); };

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
    html.touch #coinBox { left: auto; right: 12px; bottom: auto; top: 132px; font-size: 20px; } html.touch .coinIc { width: 20px; height: 20px; border-width: 2px; } html.touch #coinBox small { font-size: 11px; } html.touch #starBox { top: 56px; font-size: 12px; }
    html.touch #driftBar, html.touch #boostBar { width: 180px; font-size: 9px; } html.touch #driftBar { bottom: 12px; } html.touch #boostBar { bottom: 44px; } html.touch .trk { height: 8px; border-width: 2px; }
    html.touch #msg { top: 18%; } html.touch #msgA { font-size: 44px; } html.touch #msgB { font-size: 16px; }
  `,
});


if (DEBUG) window.__kr = { Online, ON, startNetRace, showLobby, startOnlineRace, get race() { return race; }, get track() { return track; }, get state() { return state; }, get gp() { return gp; }, get SUPER() { return SUPER; }, setSuper, W, keys, CFG, step, render, startRace, showMenu, TRACKS, CUPS, CLASSES, DIFFS, camera, renderer, scene, cam, trackDef, Track, Kart, nearest, pointAt, endRace, rankKarts, msg, beginMode, PROFILE, saveProfile, bump, checkUnlocks, UNLOCKABLES, renderMenu, ITEMS, ITEM_KEYS, secretKey, superKey, startMusic, stopMusic, S };
