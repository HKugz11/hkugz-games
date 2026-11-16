// WOBBLE DASH - a wobbly bean obstacle race. Run, jump and dive through three courses against computer racers: the top runners of each round qualify for the next one.
import { THREE, V3, $, DEBUG, S, GFX, GFX_PREF, QL, camera, renderer, scene, W, rnd, clamp, lerp, TAU, angDiff, load, save, hex, followSun, updateFX, clearFX, burst, ring, audioInit, setVolume, sfx, adaptRes, blendSky, rng, NETMODE } from './core.js?v=15';
import * as Online from './online.js?v=15';
const updateRemote = Online.updateRemote;
import { world, pushOut } from './physics.js?v=15';
import { COURSES, THEMES, generateCourse, Course } from './course.js?v=15';
import { MOVE, Racer, cam, updateCamera } from './bean.js?v=15';
import { DIFFS, makeAI, aiStep } from './ai.js?v=15';
import { TOUCH, initTouch } from './touch.js?v=15';

const NAMES = ['Bumble', 'Noodle', 'Pudding', 'Waffles', 'Sprout', 'Pickle', 'Mochi', 'Biscuit', 'Gizmo', 'Zippy', 'Tofu', 'Muffin', 'Nacho', 'Jellybean', 'Wobbles', 'Pretzel'];
const COLORS = [0xff4fa8, 0x2ee6ff, 0xffd31a, 0x8aff3a, 0xb06bff, 0xff7a1a, 0xffffff, 0x4a6aff, 0xff4a4a, 0x40e0b0];
const ROUNDS = [{ field: 12, qualify: 8, title: 'ROUND 1', tier: 1 }, { field: 8, qualify: 4, title: 'ROUND 2', tier: 2 }, { field: 4, qualify: 1, title: 'THE FINAL', tier: 3 }];
const MODES = { showdown: { name: 'Showdown', blurb: 'Three rounds: 12 racers, then 8, then the final 4. Only the fastest runners move on, and every round is a different course. Win the crown!' }, quick: { name: 'Quick Race', blurb: 'Pick any of the ' + COURSES.length + ' courses and race 11 other beans for the best finish.' }, online: { name: 'Online Race', blurb: 'Host a room or join one with a code and race your friends in a Showdown or a Quick Race. Bots fill the empty spots.' } };
const ON = Online.ON;
const CFG = { netMode: load('netmode', 'showdown'), mode: load('mode', 'showdown'), course: load('course', 'candy'), diff: load('diff', 'normal'), name: load('name', ''), mix: load('mix', 'mix') };
if (!MODES[CFG.mode]) CFG.mode = 'showdown'; if (!COURSES.some(c => c.id === CFG.course)) CFG.course = 'candy'; if (!DIFFS[CFG.diff]) CFG.diff = 'normal'; if (CFG.mix !== 'classic') CFG.mix = 'mix'; if (CFG.netMode !== 'quick') CFG.netMode = 'showdown';
// which course each Showdown round uses: a random one per round from that round's tier (easier courses early, the hardest for the final), never the same as last time. 'classic' = the original three.
function pickPlan(mix, last = load('lastPlan', [])) {
  if (mix === 'classic') return ['candy', 'factory', 'cloud'];
  const plan = ROUNDS.map((R, i) => { const all = COURSES.filter(c => c.tier === R.tier), pool = all.filter(c => c.id !== last[i]); const p = pool.length ? pool : all; return p[Math.floor(Math.random() * p.length)].id; });
  save('lastPlan', plan); return plan;
}
const stars = c => '★'.repeat(Math.max(1, Math.round(c.d * 4))) + '☆'.repeat(4 - Math.max(1, Math.round(c.d * 4)));
let state = 'menu', started = false, race = null, show = null, P = null, menuCourse = null;
const keys = {}, courseDef = id => COURSES.find(c => c.id === id);
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0]);
const fmtT = t => { if (t === null || t === undefined) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return (m ? m + ':' : '') + (m && s < 10 ? '0' : '') + s.toFixed(2); };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ================================================================== a race
function makeEntrants(n) {
  const names = shuffle(NAMES.slice()), cols = shuffle(COLORS.filter(c => c !== S.color)); const out = [{ id: 0, name: CFG.name || 'You', color: S.color, tuft: Math.floor(Math.random() * 4), isPlayer: true }];
  for (let i = 0; i < n - 1; i++) out.push({ id: i + 1, name: names[i % names.length], color: cols[i % cols.length], tuft: Math.floor(Math.random() * 4), isPlayer: false });
  return out;
}
function clearRace() { if (race) { race.racers.forEach(r => r.remove()); race.course.dispose(); race = null; } if (menuCourse) { menuCourse.dispose(); menuCourse = null; } clearFX(); P = null; }
function startRace(def, entrants, qualify, meta, net) {   // net = { diff, round } for an online race
  clearRace(); const spec = generateCourse(def), course = new Course(spec); blendSky(spec.theme, spec.theme, 0); scene.fog.color.setHex(spec.theme.fog[0]);
  const racers = entrants.map((e, i) => { const r = new Racer(e.name, e.color, e.tuft, e.isPlayer); r.id = e.id === undefined ? i : e.id; r.human = net ? !e.bot : !!e.isPlayer; r.remote = !!e.remote; if (!e.isPlayer && !e.remote) r.ai = makeAI(net ? net.diff : CFG.diff); return r; });
  const slots = []; for (let row = 0; row < 3; row++) for (let c = 0; c < 6; c++) slots.push([-7.5 + c * 3 + (row % 2) * 1.0, 2.6 + row * 3.2]); const used = racers.length <= 6 ? shuffle(slots.slice(0, 6)) : shuffle(slots.slice(0, Math.ceil(racers.length / 6) * 6));
  racers.forEach((r, i) => { const e = entrants[i], s = e.slot !== undefined && slots[e.slot] ? slots[e.slot] : used[i]; r.spawn(s[0], .05, s[1], 0); r.start = [s[0], s[1]]; });
  P = racers.find(r => r.isPlayer) || null; race = { def, spec, course, racers, player: P, qualify, meta, clock: 0, t: 0, state: 'intro', st: 0, finN: 0, over: false, shownCd: 0, qualified: false, endT: 0, net: !!net, spectate: !P, watch: null, watchT: 0 };
  $('spec').classList.toggle('hide', !!P);
  state = 'intro'; W.state = 'race'; hideScreens(); $('hud').style.visibility = 'visible'; buildProg(); cam.init = false; cam.yaw = 0; cam.pitch = .36; cam.manual = 0;
  $('rname').textContent = meta ? meta.title + ' · ' + def.name : def.name; $('rrule').textContent = meta ? (qualify === 1 ? 'FIRST ACROSS WINS THE CROWN' : 'TOP ' + qualify + ' QUALIFY') : 'RACE TO THE FINISH';
  for (let i = 0; i < 6; i++) course.update(0, 0); setBanner(def.name.toUpperCase(), meta ? (qualify === 1 ? 'First across the line wins the crown!' : 'Only the top ' + qualify + ' of ' + racers.length + ' qualify') : 'Beat 11 other beans to the finish', 0);
}
function setBanner(a, b, ms) { $('bigA').textContent = a; $('bigB').textContent = b || ''; const t = $('big'); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(setBanner.t); if (ms) setBanner.t = setTimeout(() => t.classList.remove('on'), ms); }
function ranking() {
  const rs = race.racers.slice().sort((a, b) => a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.u - a.u); rs.forEach((r, i) => { r.rank = i + 1; if (r.finished) r.place = i + 1; }); return rs;
}
const me = () => P || (race && race.watch);

// ---------------------------------------------------------------- the per-frame simulation
const _v = new V3();
function raceStep(dt) {
  const R = race, C = R.course, spec = R.spec; R.clock += dt;
  if (R.ckT !== undefined && ON.role === 'client') { const diff = R.ckT + (performance.now() - R.ckAt) / 1000 - R.clock, adj = Math.abs(diff) > .6 ? diff : diff * Math.min(1, dt * 2); R.clock += adj; R.st += adj; }   // online: follow the host's race clock
  C.update(R.clock, dt); R.st += dt;
  if (R.state === 'intro') {   // a flight down the course from the finish line, then the countdown
    const k = clamp(R.st / 3.4, 0, 1), e = k * k * (3 - 2 * k), z = lerp(-(spec.length - 12), 18, e); camera.position.set(Math.sin(R.st * .5) * 5, 13 - e * 4, z + 20); camera.lookAt(0, 2, z - 14);
    if (R.st >= 3.6) { R.state = 'count'; R.st = 0; R.shownCd = 0; state = 'count'; cam.init = false; setBanner('', '', 1); }
  } else if (R.state === 'count') {
    const left = 3.2 - R.st, n = Math.ceil(left); if (n !== R.shownCd && n >= 1 && n <= 3) { R.shownCd = n; $('count').textContent = String(n); const c = $('count'); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); sfx('beep'); }
    if (left <= 0) { R.state = 'race'; state = 'race'; R.t = 0; R.st = 0; $('count').textContent = 'GO!'; const c = $('count'); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); sfx('go'); }
  } else if (R.state === 'race' || R.state === 'done') R.t += dt;
  const racing = R.state === 'race' || R.state === 'done';
  for (const r of R.racers) simRacer(r, dt, racing);
  bumpRacers(R.racers, dt);
  const rk = ranking(); if (R.state === 'race') checkEnd(rk, dt); if (ON.active && R.net) Online.tick(dt, R);
  if (P && R.state !== 'intro') { P.animate(dt); }
  for (const r of R.racers) if (r !== P) r.animate(dt);
  if (R.spectate) { R.watchT -= dt; if (!R.watch || (R.watchT <= 0 && R.auto !== false)) { R.watchT = .6; const lead = rk.find(r => !r.finished && r.alive) || rk[0]; if (lead && lead !== R.watch) { R.watch = lead; cam.init = false; } } if (R.watch) { const w = R.watch; $('spec').innerHTML = 'SPECTATING <b>' + w.name + '</b><small>click or ← → to watch someone else</small>'; } }
  const vw = me(); if (R.state !== 'intro' && vw) updateCamera(dt, vw, R.state === 'race' || R.state === 'count');
  if (R.state === 'done') { R.endT += dt; if (R.endT > 3.2 && state === 'done') showResults(); }
}
function simRacer(r, dt, racing) {
  if (r.remote) {   // somebody else's bean (or a bot on the host): follow the messages
    updateRemote(r, dt); r.u = -r.pos.z;
    if (r.justFinished) { r.justFinished = false; r.celebrate = 4; burst(new V3(r.pos.x, r.pos.y + 1.4, r.pos.z), r.color, 16, 8, .2, 1, 10, 4); }
    if (r.alive && r.onGround) { const h = world.raycast(r.pos.x, r.pos.y + .3, r.pos.z, 0, -1, 0, 1); if (h.box && h.box.crumble && h.box.it.cs.phase === 'idle') { h.box.it.cs.phase = 'shake'; h.box.it.cs.t = .45; } }
    return;
  }
  if (!r.alive) { if (r.finished) return; r.respT -= dt; if (r.respT <= 0) respawn(r); return; }
  const inp = r.inp;
  if (r.finished || !racing) { inp.mx = inp.mz = 0; inp.sprint = false; inp.jump = false; inp.dive = false; inp.jumpPressed = false; }
  else if (r.isPlayer && !r.ai) { inp.mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); inp.mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); inp.jump = !!keys.Space; inp.sprint = !!(keys.ShiftLeft || keys.ShiftRight); }
  else if (r.ai) aiStep(r, race.course, dt);
  r.invul = Math.max(0, r.invul - dt); const camYaw = r.isPlayer && !r.ai ? cam.yaw : 0;
  r.carry(dt); const n = Math.max(1, Math.ceil(dt / (1 / 90))), grav = race.spec.def.grav || 1; for (let i = 0; i < n; i++) r.step(dt / n, camYaw, grav); pushOut(r);
  r.u = -r.pos.z; const g = r.ground;
  if (g && r.onGround) {
    if (g.crumble && g.it.cs.phase === 'idle') { g.it.cs.phase = 'shake'; g.it.cs.t = .45; if (r.isPlayer) sfx('crumble'); }
    if (g.safe && r.stun <= 0 && r.prone <= 0) r.safe.copy(r.pos);
  }
  if (racing && !r.finished && r.u >= race.spec.finishU) finishRacer(r);
  if (r.invul <= 0 && !r.finished) {
    const hz = race.course.hazards(r.pos);
    if (hz) { r.vel.x = hz.nx * 13; r.vel.z = hz.nz * 13; r.vel.y = Math.max(r.vel.y, hz.up || 7.5); r.stun = .45; r.prone = 0; r.onGround = false; r.ground = null; r.invul = .4; if (r.isPlayer) { sfx('whack'); cam.shake = .5; } burst(new V3(r.pos.x, r.pos.y + 1, r.pos.z), 0xffffff, 8, 6, .12, .5, 10, 2); }
  }
  if (r.pos.y < r.safe.y - 11) fall(r);
}
function fall(r) {
  r.alive = false; r.av.g.visible = false; r.blob.visible = false; r.respT = 1.05; r.falls++; r.vel.set(0, 0, 0); if (r.isPlayer) { sfx('die'); $('fade').classList.add('on'); }
  burst(new V3(r.pos.x, r.safe.y - 6, r.pos.z), r.color, 10, 6, .2, .8, 12, 3);
}
function respawn(r) { r.spawn(r.safe.x, r.safe.y + .1, r.safe.z + .8, 0); r.invul = 1.3; if (r.isPlayer) { $('fade').classList.remove('on'); cam.init = false; cam.yaw = 0; } if (r.ai) r.ai.wi = 0; }
function finishRacer(r) {
  r.finished = true; r.finishT = race.t; r.place = race.net ? race.racers.filter(x => x.finished && x !== r && x.finishT <= r.finishT).length + 1 : ++race.finN; r.celebrate = 4; r.inp.mx = r.inp.mz = 0; const col = r.color;
  burst(new V3(r.pos.x, r.pos.y + 1.4, r.pos.z), col, 16, 8, .2, 1, 10, 4);
  if (r.isPlayer) {
    const q = race.meta ? r.place <= race.qualify : true; race.qualified = q; sfx(q ? 'qualify' : 'finish');
    setBanner(race.meta ? (q ? (race.qualify === 1 ? 'YOU WIN!' : 'QUALIFIED!') : 'TOO SLOW...') : 'FINISHED!', ord(r.place) + ' place · ' + fmtT(r.finishT), 2600);
    for (let i = 0; i < 3; i++) burst(new V3(r.pos.x, r.pos.y + 2, r.pos.z), [0xffd34e, 0xff4fa8, 0x2ee6ff][i], 14, 9, .24, 1.2, 8, 5);
  }
}
function checkEnd(rk, dt) {
  const R = race; if (R.net && ON.role !== 'host') return;   // online: the host decides when a round is over
  const fin = R.racers.filter(r => r.finished).length, all = fin >= R.racers.length, hum = R.racers.filter(r => r.human), humFin = hum.length > 0 && hum.every(h => h.finished), lastHum = Math.max(0, ...hum.map(h => h.finishT || 0)); let end = false;
  if (R.meta) { if (fin >= R.qualify || all || R.t > 160) end = true; if (humFin && R.t - lastHum > 14) end = true; }
  else { if (all || R.t > 200) end = true; if (humFin && R.t - lastHum > 12) end = true; }
  if (end) { R.endWait = (R.endWait || 0) + dt; if (R.endWait >= (R.net ? .4 : 0)) endRace(); }   // online: a short grace so finishes that are still on the way count
}
function endRace(msg) {   // msg = the host's result when this is an online client
  const R = race; if (R.state === 'done') return; R.state = 'done'; R.endT = 0; state = 'done'; let rk, qIds;
  if (msg) { for (const id in msg.times || {}) { const r = R.racers.find(x => x.id === +id); if (r) { r.finished = true; r.finishT = +msg.times[id]; } } rk = ranking(); const order = (msg.rk || []).map(id => R.racers.find(r => r.id === id)).filter(Boolean); rk = order.concat(rk.filter(r => !order.includes(r))); qIds = msg.q || []; }
  else { rk = ranking(); qIds = (R.meta ? rk.filter((r, i) => r.finished && i < R.qualify) : rk).map(r => r.id); }
  R.qualifiers = qIds; R.rk = rk; rk.forEach((r, i) => { if (r.finished) r.place = i + 1; });
  const pq = R.meta ? !!P && qIds.includes(P.id) : true; R.playerQualified = pq;
  if (R.net && ON.role === 'host') { const times = {}; rk.forEach(r => { if (r.finished) times[r.id] = r.finishT; }); Online.hostEnd({ t: 'end', rk: rk.map(r => r.id), q: qIds, times }); }
  if (!P) setBanner('ROUND OVER', '', 2400);
  else if (R.meta) { if (!P.finished || !pq) { setBanner('ELIMINATED!', 'You did not make the top ' + R.qualify, 3000); sfx('elim'); } else if (R.qualify === 1) { setBanner('CROWN!', 'You are the champion bean!', 3000); sfx('crown'); crownFx(); } else setBanner('ROUND OVER', 'The qualifiers move on', 2400); }
  else setBanner('RACE OVER', '', 2400);
  for (const r of R.racers) if (!r.finished && r.inp) { r.inp.mx = r.inp.mz = 0; }
}
function crownFx() { if (!P) return; const c = new V3(P.pos.x, P.pos.y + 2, P.pos.z); for (let i = 0; i < 6; i++) burst(c, [0xffd34e, 0xff4fa8, 0x2ee6ff, 0x8aff3a][i % 4], 20, 12, .26, 1.8, 8, 6); ring(c, 0xffd34e, 7, .9, false); }
function bumpRacers(rs, dt) {
  for (let i = 0; i < rs.length; i++) { const a = rs[i]; if (!a.alive) continue; for (let j = i + 1; j < rs.length; j++) {
    const b = rs[j]; if (!b.alive || (a.finished && b.finished)) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dy = b.pos.y - a.pos.y; if (Math.abs(dy) > 1.5) continue; const d2 = dx * dx + dz * dz, rr = a.r + b.r; if (d2 >= rr * rr || d2 < 1e-6) continue;
    if (a.remote && b.remote) continue; const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, over = rr - d, ka = a.remote ? 0 : b.remote ? .7 : .35, kb = b.remote ? 0 : a.remote ? .7 : .35;   // online: only my own beans are pushed, the other machine pushes its own
    a.pos.x -= nx * over * ka; a.pos.z -= nz * over * ka; b.pos.x += nx * over * kb; b.pos.z += nz * over * kb;
    const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz; if (rv < 0) { const j2 = -rv * .4, ja = a.remote ? 0 : b.remote ? 2 : 1, jb = b.remote ? 0 : a.remote ? 2 : 1; a.vel.x -= nx * j2 * ja; a.vel.z -= nz * j2 * ja; b.vel.x += nx * j2 * jb; b.vel.z += nz * j2 * jb; if (-rv > 5 && (a.isPlayer || b.isPlayer)) sfx('bump', clamp(-rv / 14, .3, 1)); }
    if (a.prone > 0 && !b.prone && !b.remote) { b.vel.x += nx * 4; b.vel.z += nz * 4; } else if (b.prone > 0 && !a.prone && !a.remote) { a.vel.x -= nx * 4; a.vel.z -= nz * 4; } } }
}

// ================================================================== results and rounds
function showResults() {
  const R = race; if (!show) show = { r: 0, entrants: [], next: false }; state = 'results'; W.state = 'results'; const rk = R.rk, tbl = $('resTable'); tbl.innerHTML = '<tr><th>#</th><th>Racer</th><th>Time</th>' + (R.meta ? '<th></th>' : '') + '</tr>';
  rk.forEach((r, i) => { const tr = document.createElement('tr'); if (r.isPlayer) tr.className = 'me'; const out = R.meta && !(r.finished && r.place <= R.qualify); tr.innerHTML = `<td>${i + 1}</td><td><i style="background:${hex(r.color)}"></i>${r.name}</td><td>${r.finished ? fmtT(r.finishT) : 'DNF'}</td>` + (R.meta ? `<td class="${out ? 'x' : 'ok'}">${out ? '✗' : '✓'}</td>` : ''); tbl.appendChild(tr); });
  const me = P, last = R.meta && R.meta.title === 'THE FINAL';
  if (R.net) { showNetResults(R, last); return; }
  if (R.meta) {
    if (R.playerQualified && !last) { $('resT').textContent = 'QUALIFIED!'; $('resT').style.color = '#6aff9a'; $('resS').textContent = 'You finished ' + ord(me.place) + ' and move on to the next round.'; $('again').textContent = 'NEXT ROUND'; show.next = true; show.entrants = R.racers.filter(r => R.qualifiers.includes(r.id)).map(r => ({ id: r.id, name: r.name, color: r.color, tuft: r.tuft, isPlayer: r.isPlayer })); }
    else if (last && R.playerQualified) { $('resT').textContent = 'YOU WON THE CROWN!'; $('resT').style.color = '#ffd34e'; $('resS').textContent = 'Champion bean of the whole Showdown!'; $('again').textContent = 'PLAY AGAIN'; show.next = false; save('crowns', load('crowns', 0) + 1); }
    else { $('resT').textContent = 'ELIMINATED'; $('resT').style.color = '#ff7a8a'; $('resS').textContent = me.finished ? 'You were ' + ord(me.place) + ', but only the top ' + R.qualify + ' qualified.' : 'You did not reach the finish line in time.'; $('again').textContent = 'TRY AGAIN'; show.next = false; }
    if (!last || !R.playerQualified) save('bestRound', Math.max(load('bestRound', 0), R.playerQualified ? show.r + 1 : show.r));
  } else {
    $('resT').textContent = me.finished ? ord(me.place) + ' PLACE' : 'RACE OVER'; $('resT').style.color = me.place === 1 ? '#ffd34e' : '#fff';
    const key = 'best.' + R.def.id, prev = load(key, 0), nb = me.finished && (!prev || me.finishT < prev); if (nb) save(key, me.finishT); $('resS').innerHTML = me.finished ? 'Your time <b>' + fmtT(me.finishT) + '</b>' + (nb ? ' <span class="nb">New best!</span>' : prev ? ' · best <b>' + fmtT(prev) + '</b>' : '') : 'You did not finish.'; $('again').textContent = 'RACE AGAIN';
  }
  $('results').classList.remove('hide'); document.exitPointerLock && document.pointerLockElement && document.exitPointerLock();
}
function startShowdown() { show = { r: 0, entrants: makeEntrants(ROUNDS[0].field), next: false, plan: pickPlan(CFG.mix) }; beginRound(); }
function beginRound() { const R = ROUNDS[show.r]; startRace(courseDef(show.plan[show.r]), show.entrants, R.qualify, R); }
function nextRoundOrAgain() {
  audioInit();
  if (CFG.mode === 'showdown') { if (show && show.next) { show.r++; beginRound(); } else startShowdown(); }
  else startRace(courseDef(CFG.course), makeEntrants(12), 0, null);
  lockPointer();
}

// ================================================================== HUD
const lastHud = {}; const setT = (id, t) => { if (lastHud[id] !== t) { lastHud[id] = t; $(id).textContent = t; } };
let dots = [], tags = [];
function buildProg() { const t = $('tags'); t.innerHTML = ''; tags = race.racers.map(r => { const d = document.createElement('div'); d.className = 'tag' + (r.isPlayer ? ' me' : ''); d.textContent = r.isPlayer ? 'YOU' : r.name; t.appendChild(d); return d; }); const p = $('prog'); p.innerHTML = ''; dots = race.racers.map(r => { const d = document.createElement('i'); d.style.background = hex(r.color); if (r.isPlayer) d.className = 'me'; p.appendChild(d); return d; }); }
function updateHUD() {
  const R = race; if (!R) return; const rk = R.racers, Pv = me(); if (!Pv) return; setT('timer', R.state === 'intro' || R.state === 'count' ? '0.00' : fmtT(R.state === 'done' && Pv.finished ? Pv.finishT : R.t)); const place = Pv.finished ? Pv.place : Pv.rank || 1;
  setT('rankN', String(place)); setT('rankS', ord(place).replace(/\d+/, '') + ' / ' + rk.length); const qn = R.meta && R.qualify; $('rank').classList.toggle('safe', !!(qn && place <= qn)); $('rank').classList.toggle('danger', !!(qn && place > qn));
  const L = R.spec.finishU; rk.forEach((r, i) => { dots[i].style.left = (clamp(r.u / L, 0, 1) * 100) + '%'; });
  const _p = new V3(); race.racers.forEach((r, i) => { const t = tags[i]; if (!r.alive || R.state === 'intro') { t.style.display = 'none'; return; } _p.set(r.pos.x, r.pos.y + 2.5, r.pos.z); const dist = _p.distanceTo(camera.position); _p.project(camera); if (_p.z > 1 || dist > 46 || Math.abs(_p.x) > 1.1) { t.style.display = 'none'; return; } t.style.display = ''; t.style.transform = 'translate3d(' + ((_p.x * .5 + .5) * innerWidth).toFixed(0) + 'px,' + ((-_p.y * .5 + .5) * innerHeight - 6).toFixed(0) + 'px,0)'; t.style.fontSize = r.isPlayer ? '' : (clamp(14 - dist * .09, 9, 13)) + 'px'; });
  const cd = Pv.diveCD; $('dive').style.opacity = R.spectate || (R.state === 'race' && R.t > 9) ? 0 : cd > 0 ? .35 : 1; $('dive').classList.toggle('hide', false); $('lockhint').classList.toggle('hide', started || DEBUG || TOUCH || (state !== 'race' && state !== 'count'));
}

// ================================================================== loop
let last = performance.now(), fpsN = 0, fpsT = 0, fpsTxt = '', renderTick = 0;
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function step(dt) {
  W.time += dt; updateFX(dt);
  if (race && (state === 'intro' || state === 'count' || state === 'race' || state === 'done' || state === 'results')) { raceStep(dt); if (state !== 'results') updateHUD(); if (QL.shadow && me()) followSun(me().pos.x, me().pos.y, me().pos.z); }
  else if (state === 'menu' || state === 'lobby') { menuCamera(dt); if (menuCourse) menuCourse.update(W.time, dt); }
}
function menuCamera(dt) { if (!menuCourse) return; const sp = menuCourse.spec, t = (W.time * .018) % 1, z = -(t * (sp.length - 20)); camera.position.set(Math.sin(W.time * .15) * 9, 9 + Math.sin(W.time * .1) * 2, z + 16); camera.lookAt(0, 1.5, z - 18); if (camera.fov !== S.fov) { camera.fov = S.fov; camera.updateProjectionMatrix(); } }
function render() { if (QL.skip) renderer.shadowMap.needsUpdate = (renderTick++ & 1) === 0; renderer.render(scene, camera); }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; const hv = (state === 'menu' || state === 'lobby' || state === 'results') ? 'hidden' : 'visible'; if ($('hud').style.visibility !== hv) $('hud').style.visibility = hv; if (state !== 'pause') step(dt); render(); adaptRes(raw, state === 'race'); fpsTick(raw); requestAnimationFrame(loop); }

// ================================================================== input
function lockPointer() { if (DEBUG || TOUCH) { started = true; return; } const el = $('view'); try { const p = el.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => el.requestPointerLock()); } catch (e) { try { el.requestPointerLock(); } catch (e2) {} } }
document.addEventListener('pointerlockchange', () => { const on = document.pointerLockElement === $('view'); started = on; if (!on && (state === 'race' || state === 'count') && !DEBUG) pauseGame(); });
function pauseGame() { if (state !== 'race' && state !== 'count') return; $('restart').classList.toggle('hide', ON.active); if (ON.active) { $('pause').classList.remove('hide'); return; } race.prevState = state; state = 'pause'; W.state = 'pause'; $('pause').classList.remove('hide'); }   // online: the race goes on behind the pause box
function resumeGame() { if (ON.active && (state === 'race' || state === 'count')) { $('pause').classList.add('hide'); audioInit(); lockPointer(); return; } if (state !== 'pause') return; state = race.prevState || 'race'; W.state = 'race'; $('pause').classList.add('hide'); audioInit(); lockPointer(); }
addEventListener('mousemove', e => { if ((state !== 'race' && state !== 'count' && state !== 'done') || (!started && !DEBUG)) return; if (!DEBUG && !TOUCH && document.pointerLockElement !== $('view')) return; const k = .0024 * S.sens; cam.yaw -= e.movementX * k; cam.pitch = clamp(cam.pitch + e.movementY * k, -.1, 1.2); cam.manual = 1.6; });
function watchNext(d) { const R = race; if (!R || !R.spectate) return; const rk = R.racers.filter(r => r.alive || !r.finished); if (!rk.length) return; R.auto = false; const i = rk.indexOf(R.watch); R.watch = rk[(i + d + rk.length) % rk.length]; cam.init = false; }
addEventListener('mousedown', e => { if (race && race.spectate && (state === 'race' || state === 'count' || state === 'done') && !e.target.closest('.screen')) { watchNext(e.button === 2 ? -1 : 1); return; } if ((state === 'race' || state === 'count') && !started && !DEBUG) { lockPointer(); return; } if (state === 'race' && P && e.button === 0) P.inp.dive = true; });
addEventListener('wheel', e => { if (state === 'race') cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * .8, 4, 16); });
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && (state === 'race' || state === 'count')) e.preventDefault();
  if (e.target && e.target.tagName === 'INPUT') return; if (!keys[e.code] || !e.repeat) keys[e.code] = true; if (e.repeat) return;
  if (e.code === 'Escape') { if (ON.active && (state === 'race' || state === 'count') && !$('pause').classList.contains('hide')) resumeGame(); else if (state === 'race' || state === 'count') pauseGame(); else if (state === 'pause') resumeGame(); return; }
  if (race && race.spectate && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { watchNext(e.code === 'ArrowRight' ? 1 : -1); return; }
  if (state !== 'race' || !P || !P.alive) return;
  if (e.code === 'Space') P.inp.jumpPressed = true; if (e.code === 'KeyE' || e.code === 'KeyF') P.inp.dive = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'race' || state === 'count') && !DEBUG && !ON.active) pauseGame(); });

// ================================================================== menus
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function hideScreens() { for (const id of ['menu', 'lobby', 'pause', 'results']) $(id).classList.add('hide'); $('fade').classList.remove('on'); $('count').classList.remove('on'); }
function renderMenu() {
  const root = $('menuPickers'); root.innerHTML = '';
  const gm = mk('div', 'grp'); gm.appendChild(mk('h3', '', 'MODE')); const cards = mk('div', 'modes');
  for (const id of Object.keys(MODES)) { const m = MODES[id], c = mk('button', 'modec' + (id === CFG.mode ? ' sel' : '')); c.appendChild(mk('b', '', m.name)); c.appendChild(mk('span', '', m.blurb)); if (id === 'showdown') { const cr = load('crowns', 0); if (cr) c.appendChild(mk('i', '', '👑 ' + cr + (cr === 1 ? ' crown' : ' crowns'))); } c.onclick = () => { CFG.mode = id; save('mode', id); sfx('click'); renderMenu(); }; cards.appendChild(c); }
  gm.appendChild(cards); root.appendChild(gm);
  if (CFG.mode === 'showdown') { const gx = mk('div', 'grp'); gx.appendChild(mk('h3', '', 'COURSES')); const rx = mk('div', 'row'); for (const [id, nm] of [['mix', 'Random mix (' + COURSES.length + ' courses)'], ['classic', 'Classic three']]) { const b = mk('button', id === CFG.mix ? 'sel' : '', nm); b.onclick = () => { CFG.mix = id; save('mix', id); sfx('click'); renderMenu(); }; rx.appendChild(b); } gx.appendChild(rx); gx.appendChild(mk('p', 'mdesc', CFG.mix === 'mix' ? 'Each round picks a different course: easier ones early, the hardest for the final.' : 'Candy Run, then Factory Frenzy, then the Cloud Rush final.')); root.appendChild(gx); }
  if (CFG.mode === 'quick') { const gc = mk('div', 'grp'); gc.appendChild(mk('h3', '', 'COURSE')); const cc = mk('div', 'modes'); for (const c of COURSES) { const th = THEMES[c.theme], b = mk('button', 'modec' + (c.id === CFG.course ? ' sel' : '')); b.style.background = `linear-gradient(160deg, #${th.sky[0].toString(16).padStart(6, '0')}, #${th.sky[1].toString(16).padStart(6, '0')} 60%, #${th.pal[0].toString(16).padStart(6, '0')})`; b.appendChild(mk('b', '', c.name)); b.appendChild(mk('span', '', c.blurb)); const best = load('best.' + c.id, 0); b.appendChild(mk('i', '', stars(c) + (best ? ' · Best ' + fmtT(best) : ''))); b.onclick = () => { CFG.course = c.id; save('course', c.id); sfx('click'); renderMenu(); setMenuCourse(); }; cc.appendChild(b); } gc.appendChild(cc); root.appendChild(gc); }
  const gd = mk('div', 'grp'); gd.appendChild(mk('h3', '', 'COMPUTER RACERS')); const rd = mk('div', 'row'); for (const id of Object.keys(DIFFS)) { const b = mk('button', id === CFG.diff ? 'sel' : '', DIFFS[id].name); b.onclick = () => { CFG.diff = id; save('diff', id); sfx('click'); renderMenu(); }; rd.appendChild(b); } gd.appendChild(rd); root.appendChild(gd);
  const gb = mk('div', 'grp'); gb.appendChild(mk('h3', '', 'YOUR BEAN')); const rc = mk('div', 'row sw'); for (const c of COLORS) { const b = mk('button', 'swatch' + (c === S.color ? ' sel' : '')); b.style.background = hex(c); b.onclick = () => { S.color = c; save('color', c); sfx('click'); renderMenu(); }; rc.appendChild(b); } gb.appendChild(rc); root.appendChild(gb);
  const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
  for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !new URLSearchParams(location.search).get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' : ''); }; rg.appendChild(b); }
  gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (['low', 'med', 'high'].includes(GFX_PREF) ? '' : ' (picked automatically for this computer)') + '.')); root.appendChild(gg);
  $('play').classList.toggle('hide', CFG.mode === 'online'); $('onlineRow').classList.toggle('hide', CFG.mode !== 'online');
}
let menuRand = '';
function setMenuCourse() { if (state !== 'menu') return; if (menuCourse) { menuCourse.dispose(); menuCourse = null; } if (!menuRand) menuRand = COURSES[Math.floor(Math.random() * COURSES.length)].id; const def = courseDef(CFG.mode === 'quick' ? CFG.course : menuRand), spec = generateCourse(def); menuCourse = new Course(spec); blendSky(spec.theme, spec.theme, 0); scene.fog.color.setHex(spec.theme.fog[0]); menuCourse.update(0, 0); }
function showMenu() { clearRace(); menuRand = ''; state = 'menu'; W.state = 'menu'; hideScreens(); $('menu').classList.remove('hide'); $('hud').style.visibility = 'hidden'; $('rankN').textContent = ''; renderMenu(); setMenuCourse(); }
$('pname').value = CFG.name; $('pname').addEventListener('input', e => { CFG.name = e.target.value.replace(/[^\w \-]/g, '').slice(0, 12); save('name', CFG.name); });
$('play').onclick = () => { audioInit(); CFG.name = $('pname').value.replace(/[^\w \-]/g, '').trim().slice(0, 12); save('name', CFG.name); if (menuCourse) { menuCourse.dispose(); menuCourse = null; } if (CFG.mode === 'showdown') startShowdown(); else startRace(courseDef(CFG.course), makeEntrants(12), 0, null); lockPointer(); };
$('resume').onclick = resumeGame; $('quit').onclick = () => { if (ON.active) Online.leave(); showMenu(); };
$('menuBtn').onclick = () => { if (ON.active) { if (ON.role === 'host') { Online.hostLobby(); showLobby(); } else { Online.leave(); showMenu(); } } else showMenu(); };
$('again').onclick = () => { if (ON.active) { if (ON.role === 'host') hostNext(); return; } nextRoundOrAgain(); };
$('restart').onclick = () => { audioInit(); $('pause').classList.add('hide'); if (CFG.mode === 'showdown') startShowdown(); else startRace(courseDef(CFG.course), makeEntrants(12), 0, null); lockPointer(); };
const sens = $('sens'), fov = $('fov'), vol = $('vol'); sens.value = S.sens; fov.value = S.fov; vol.value = S.vol;
sens.oninput = () => { S.sens = +sens.value; save('sens', S.sens); }; fov.oninput = () => { S.fov = +fov.value; save('fov', S.fov); camera.fov = S.fov; camera.updateProjectionMatrix(); }; vol.oninput = () => { setVolume(+vol.value); save('vol', S.vol); };
if (TOUCH) {
  $('touchWarn').style.display = 'block'; $('touchWarn').textContent = 'Touch controls: left thumb runs (push all the way to sprint), right thumb turns the camera, JUMP and DIVE are the big buttons.';
  initTouch({
    visible: () => state === 'race' || state === 'count', lookScale: 2.1,
    stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprintKey: 'ShiftLeft', sprintAt: .85 },
    buttons: [
      { label: 'JUMP', cls: 'fire', type: 'hold', key: 'Space', look: true, s: 98, r: 26, b: 56 },
      { label: 'DIVE', type: 'tap', key: 'KeyE', s: 62, r: 138, b: 36, cls: 'small', fs: 13 },
      { label: 'II', type: 'tap', action: () => pauseGame(), s: 40, r: 12, t: 40, cls: 'small', fs: 14 },
    ],
    css: `
      html.touch #rinfo { top: 6px; left: 10px; } html.touch #rname { font-size: 12px; } html.touch #rrule { font-size: 10px; } html.touch #timerBox { top: 4px; } html.touch #timer { font-size: 20px; padding: 0 12px; }
      html.touch #rank { top: 6px; right: 62px; } html.touch #rankN { font-size: 34px; } html.touch #rankS { font-size: 12px; } html.touch #progWrap { bottom: 6px; width: 46%; } html.touch #lockhint, html.touch #dive { display: none; }
      html.touch #bigA { font-size: 38px; } html.touch #bigB { font-size: 15px; } html.touch #count { font-size: 80px; }
    `,
  });
} else $('touchWarn').style.display = 'none';
// ================================================================== online: rooms, the lobby and the match
// The host builds the field (everybody in the room + bots up to 12), picks the courses and sends a 'start' message for every round; every machine builds the same race from it.
let noteT = 0; function note(text, ms = 3200) { const n = $('note'); n.textContent = text; n.classList.add('on'); clearTimeout(noteT); noteT = setTimeout(() => n.classList.remove('on'), ms); }
const profile = () => ({ name: ($('pname').value.replace(/[^\w \-]/g, '').trim() || CFG.name || 'Bean').slice(0, 12), color: S.color, tuft: Math.floor(Math.random() * 4) });
const netCfg = () => ({ mode: CFG.netMode, course: CFG.course, mix: CFG.mix, diff: CFG.diff });
const netError = e => (e && e.type === 'peer-unavailable') ? 'No room with that code' : (e && e.type === 'timeout') ? 'Could not connect (timed out)' : (e && e.type === 'unavailable-id') ? 'That room code is taken' : (!window.Peer && NETMODE !== 'local') ? 'Online play could not load' : 'Could not connect';
let match = null, nextT = 0;   // match: host only { cfg, round, plan, ents }
function showLobby() {
  state = 'lobby'; W.state = 'lobby'; clearTimeout(nextT); hideScreens(); clearRace(); $('lobby').classList.remove('hide'); $('hud').style.visibility = 'hidden'; $('spec').classList.add('hide');
  const spec = generateCourse(courseDef('candy')); menuCourse = new Course(spec); blendSky(spec.theme, spec.theme, 0); scene.fog.color.setHex(spec.theme.fog[0]); menuCourse.update(0, 0); renderLobby();
}
function renderLobby() {
  if (!ON.active) return; $('lobCode').textContent = ON.code || '-----'; const ro = $('lobRoster'); ro.innerHTML = '';
  for (const p of ON.roster) { const row = mk('div', 'pl'), dot = mk('i'); dot.style.background = hex(typeof p.color === 'number' ? p.color : 0xff4a4a); row.appendChild(dot); row.appendChild(mk('span', '', p.name + (p.pid === ON.pid ? ' (you)' : ''))); row.appendChild(mk('small', '', p.pid === 0 ? 'HOST' : 'PLAYER')); ro.appendChild(row); }
  const host = ON.role === 'host', cfg = host ? netCfg() : (ON.cfg || netCfg()), cd = $('lobCfg'); cd.innerHTML = '';
  const apply = () => { Online.setCfg(netCfg()); renderLobby(); };
  if (host) {
    const rm = mk('div', 'row'); rm.appendChild(mk('span', 'lbl', 'MODE')); for (const [id, nm] of [['showdown', 'Showdown'], ['quick', 'Quick Race']]) { const b = mk('button', 'small' + (id === CFG.netMode ? ' sel' : ''), nm); b.onclick = () => { CFG.netMode = id; save('netmode', id); apply(); }; rm.appendChild(b); } cd.appendChild(rm);
    if (CFG.netMode === 'quick') { const rt = mk('div', 'row'); rt.appendChild(mk('span', 'lbl', 'COURSE')); const sel = mk('select'); for (const c of COURSES) { const o = mk('option', '', c.name); o.value = c.id; if (c.id === CFG.course) o.selected = true; sel.appendChild(o); } sel.onchange = () => { CFG.course = sel.value; save('course', CFG.course); apply(); }; rt.appendChild(sel); cd.appendChild(rt); }
    else { const rx = mk('div', 'row'); rx.appendChild(mk('span', 'lbl', 'COURSES')); for (const [id, nm] of [['mix', 'Random mix'], ['classic', 'Classic three']]) { const b = mk('button', 'small' + (id === CFG.mix ? ' sel' : ''), nm); b.onclick = () => { CFG.mix = id; save('mix', id); apply(); }; rx.appendChild(b); } cd.appendChild(rx); }
    const rb = mk('div', 'row'); rb.appendChild(mk('span', 'lbl', 'BOTS')); for (const id of Object.keys(DIFFS)) { const b = mk('button', 'small' + (id === CFG.diff ? ' sel' : ''), DIFFS[id].name); b.onclick = () => { CFG.diff = id; save('diff', id); apply(); }; rb.appendChild(b); } cd.appendChild(rb);
  } else { const c = courseDef(cfg.course); cd.appendChild(mk('div', 'txt', (cfg.mode === 'quick' ? 'Quick Race · ' + (c ? c.name : '') : 'Showdown · ' + (cfg.mix === 'classic' ? 'classic three courses' : 'random courses')) + ' · bots: ' + (DIFFS[cfg.diff] ? DIFFS[cfg.diff].name : 'Normal'))); }
  $('lobStart').classList.toggle('hide', !host); $('lobMsg').textContent = ON.status || (host ? (ON.roster.length < 2 ? 'Waiting for friends to join... (you can also start alone with bots)' : ON.roster.length + ' players in the room') : 'Waiting for the host to start the race...');
}
function hostBegin() {   // a new match: everybody in the room plus bots, up to 12 racers
  if (ON.role !== 'host') return; audioInit(); const cfg = netCfg(), ents = ON.roster.map(r => ({ id: r.pid, name: r.name, color: r.color, tuft: r.tuft, bot: false }));
  const names = shuffle(NAMES.filter(n => !ents.some(e => e.name === n))), cols = shuffle(COLORS.filter(c => !ents.some(e => e.color === c)));
  for (let i = 0; ents.length < 12; i++) ents.push({ id: 100 + i, name: names[i % names.length], color: cols[i % cols.length], tuft: Math.floor(Math.random() * 4), bot: true });
  match = { cfg, round: 0, plan: cfg.mode === 'showdown' ? pickPlan(cfg.mix) : [cfg.course], ents }; hostRound();
}
function hostRound() {
  const quick = match.cfg.mode === 'quick', R = quick ? null : ROUNDS[match.round], slots = shuffle(Array.from({ length: Math.ceil(match.ents.length / 6) * 6 }, (_, i) => i));
  const msg = { t: 'start', cfg: match.cfg, round: match.round, course: match.plan[match.round], qualify: R ? R.qualify : 0, title: R ? R.title : null, entrants: match.ents.map((e, i) => ({ id: e.id, name: e.name, color: e.color, tuft: e.tuft, bot: !!e.bot, slot: slots[i] })) };
  Online.hostStart(msg); startNetRace(msg);
}
function hostNext() {   // after the results: the next Showdown round with the qualifiers, or a brand new match
  if (ON.role !== 'host' || !race || !race.net) return; clearTimeout(nextT); const R = race;
  if (match && match.cfg.mode === 'showdown' && R.meta && R.meta.title !== 'THE FINAL' && match.round < 2) { match.ents = match.ents.filter(e => R.qualifiers.includes(e.id)); match.round++; hostRound(); } else hostBegin();
}
function startNetRace(m) {
  const c = m.cfg || {}, meta = m.title ? { title: m.title, qualify: m.qualify } : null, host = ON.role === 'host', course = courseDef(m.course) || COURSES[0];
  const ents = (m.entrants || []).map(e => ({ id: e.id, name: e.name, color: e.color, tuft: e.tuft | 0, bot: !!e.bot, slot: e.slot, isPlayer: !e.bot && e.id === ON.pid, remote: e.bot ? !host : e.id !== ON.pid }));
  clearTimeout(nextT); startRace(course, ents, m.qualify || 0, meta, { diff: DIFFS[c.diff] ? c.diff : 'normal', round: m.round });
  if (race.spectate) setBanner(course.name.toUpperCase(), 'You are out of the race: watch the rest!', 2600); else if (!meta) setBanner(course.name.toUpperCase(), 'Race your friends to the finish!', 0);
  lockPointer();
}
function showNetResults(R, last) {
  const host = ON.role === 'host', me = P, title = $('resT'), sub = $('resS'); let t, c = '#fff', s = '';
  if (R.meta) {
    if (last) { const w = R.rk.find(r => r.finished && R.qualifiers.includes(r.id)); if (w && w === me) { t = 'YOU WON THE CROWN!'; c = '#ffd34e'; s = 'Champion bean of the whole Showdown!'; save('crowns', load('crowns', 0) + 1); } else { t = w ? w.name.toUpperCase() + ' WINS!' : 'NOBODY FINISHED'; c = '#ffd34e'; s = me ? 'Good race! Try again for the crown.' : ''; } }
    else if (!me) { t = 'ROUND OVER'; s = 'You are watching. The top ' + R.qualify + ' move on.'; }
    else if (R.playerQualified) { t = 'QUALIFIED!'; c = '#6aff9a'; s = 'You finished ' + ord(me.place) + ' and move on to the next round.'; }
    else { t = 'ELIMINATED'; c = '#ff7a8a'; s = (me.finished ? 'You were ' + ord(me.place) : 'You did not finish in time') + ', but only the top ' + R.qualify + ' qualified. You can watch the rest.'; }
  } else { t = me && me.finished ? ord(me.place) + ' PLACE' : 'RACE OVER'; c = me && me.place === 1 && me.finished ? '#ffd34e' : '#fff'; s = me && me.finished ? 'Your time ' + fmtT(me.finishT) : (me ? 'You did not finish.' : ''); }
  title.textContent = t; title.style.color = c; sub.textContent = s;
  const more = !!R.meta && !last, ag = $('again'); ag.textContent = host ? (more ? 'NEXT ROUND' : R.meta ? 'PLAY AGAIN' : 'RACE AGAIN') : 'WAITING FOR THE HOST'; ag.disabled = !host; $('menuBtn').textContent = host ? 'Back to lobby' : 'Leave room';
  if (host && more) { sub.textContent += ' Next round starts by itself in a few seconds.'; clearTimeout(nextT); nextT = setTimeout(() => { if (state === 'results' && race === R) hostNext(); }, 12000); }
  $('results').classList.remove('hide'); document.exitPointerLock && document.pointerLockElement && document.exitPointerLock();
}
function removeRacer(id) { const R = race; if (!R) return; const i = R.racers.findIndex(r => r.id === id && r.human); if (i < 0) return; const r = R.racers[i]; if (R.watch === r) R.watch = null; r.remove(); R.racers.splice(i, 1); buildProg(); }
Online.init({
  getRace: () => race, lobbyChanged: () => { if (state === 'lobby') renderLobby(); }, showLobby: () => showLobby(), startNet: m => startNetRace(m),
  endNet: m => { if (race && race.net) endRace(m); }, syncClock: ck => { if (race) { race.ckT = ck + ON.lat; race.ckAt = performance.now(); } },
  playerLeft: (pid, racing) => { if (match) match.ents = match.ents.filter(e => e.id !== pid || e.bot); if (racing) { const r = race && race.racers.find(r => r.id === pid && r.human); if (r) note(r.name + ' left the race'); removeRacer(pid); } },
  disconnected: text => { showMenu(); note(text, 5000); },
});
const needName = () => { CFG.name = $('pname').value.replace(/[^\w \-]/g, '').trim().slice(0, 12); save('name', CFG.name); };
$('hostBtn').onclick = () => { audioInit(); needName(); $('hostBtn').disabled = true; Online.host(profile(), netCfg()).then(() => { $('hostBtn').disabled = false; showLobby(); }).catch(e => { $('hostBtn').disabled = false; note(netError(e), 4200); }); };
$('joinBtn').onclick = () => { audioInit(); const code = Online.cleanCode($('joinCode').value); $('joinCode').value = code; if (code.length !== 5) { note('Type the 5-letter room code first', 2800); return; } needName(); $('joinBtn').disabled = true; Online.join(code, profile()).then(() => { $('joinBtn').disabled = false; showLobby(); }).catch(e => { $('joinBtn').disabled = false; note(netError(e), 4200); }); };
$('lobStart').onclick = hostBegin; $('lobLeave').onclick = () => { Online.leave(); showMenu(); };
$('lobCopy').onclick = () => { const link = location.origin + location.pathname + '?join=' + ON.code; try { navigator.clipboard.writeText(link).then(() => note('Invite link copied!', 2200), () => note(link, 6000)); } catch (e) { note(link, 6000); } };
// an invite link (?join=CODE) from a friend goes straight into that room; the code is also published for the hub's friends panel if Wobble Dash is ever added to it
window.HKRoom = { game: 'wobble-dash', get code() { return ON.active ? ON.code : ''; } };
{ const j = Online.cleanCode(new URLSearchParams(location.search).get('join')); if (j.length === 5) { try { const u = new URL(location.href); u.searchParams.delete('join'); history.replaceState(null, '', u); } catch (e) {} CFG.mode = 'online'; $('joinCode').value = j; setTimeout(() => { renderMenu(); $('joinBtn').click(); }, 0); } }

showMenu(); requestAnimationFrame(loop);

if (DEBUG) window.__wd = { Online, ON, hostBegin, hostNext, startNetRace, showLobby, get match() { return match; }, get race() { return race; }, get state() { return state; }, get P() { return P; }, get show() { return show; }, CFG, ROUNDS, COURSES, DIFFS, W, world, keys, cam, step, render, startRace, startShowdown, beginRound, generateCourse, Course, makeEntrants, makeAI, aiStep, showMenu, endRace, camera, renderer, scene, pauseGame, resumeGame, showResults, ranking, courseDef, fmtT };
