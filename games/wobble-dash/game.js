// WOBBLE DASH - a wobbly bean obstacle race. Run, jump and dive through three courses against computer racers: the top runners of each round qualify for the next one.
import { THREE, V3, $, DEBUG, S, GFX, GFX_PREF, QL, camera, renderer, scene, W, rnd, clamp, lerp, TAU, angDiff, load, save, hex, followSun, updateFX, clearFX, burst, ring, audioInit, setVolume, sfx, adaptRes, blendSky, rng } from './core.js?v=12';
import { world, pushOut } from './physics.js?v=12';
import { COURSES, THEMES, generateCourse, Course } from './course.js?v=12';
import { MOVE, Racer, cam, updateCamera } from './bean.js?v=12';
import { DIFFS, makeAI, aiStep } from './ai.js?v=12';
import { TOUCH, initTouch } from './touch.js?v=12';

const NAMES = ['Bumble', 'Noodle', 'Pudding', 'Waffles', 'Sprout', 'Pickle', 'Mochi', 'Biscuit', 'Gizmo', 'Zippy', 'Tofu', 'Muffin', 'Nacho', 'Jellybean', 'Wobbles', 'Pretzel'];
const COLORS = [0xff4fa8, 0x2ee6ff, 0xffd31a, 0x8aff3a, 0xb06bff, 0xff7a1a, 0xffffff, 0x4a6aff, 0xff4a4a, 0x40e0b0];
const ROUNDS = [{ course: 'candy', field: 12, qualify: 8, title: 'ROUND 1' }, { course: 'factory', field: 8, qualify: 4, title: 'ROUND 2' }, { course: 'cloud', field: 4, qualify: 1, title: 'THE FINAL' }];
const MODES = { showdown: { name: 'Showdown', blurb: 'Three rounds: 12 racers, then 8, then the final 4. Only the fastest runners move on. Win the crown!' }, quick: { name: 'Quick Race', blurb: 'Pick any course and race 11 other beans for the best finish.' } };
const CFG = { mode: load('mode', 'showdown'), course: load('course', 'candy'), diff: load('diff', 'normal'), name: load('name', '') };
if (!MODES[CFG.mode]) CFG.mode = 'showdown'; if (!COURSES.some(c => c.id === CFG.course)) CFG.course = 'candy'; if (!DIFFS[CFG.diff]) CFG.diff = 'normal';
let state = 'menu', started = false, race = null, show = null, P = null, menuCourse = null;
const keys = {}, courseDef = id => COURSES.find(c => c.id === id);
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0]);
const fmtT = t => { if (t === null || t === undefined) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return (m ? m + ':' : '') + (m && s < 10 ? '0' : '') + s.toFixed(2); };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ================================================================== a race
function makeEntrants(n) {
  const names = shuffle(NAMES.slice()), cols = shuffle(COLORS.filter(c => c !== S.color)); const out = [{ name: CFG.name || 'You', color: S.color, tuft: Math.floor(Math.random() * 4), isPlayer: true }];
  for (let i = 0; i < n - 1; i++) out.push({ name: names[i % names.length], color: cols[i % cols.length], tuft: Math.floor(Math.random() * 4), isPlayer: false });
  return out;
}
function clearRace() { if (race) { race.racers.forEach(r => r.remove()); race.course.dispose(); race = null; } if (menuCourse) { menuCourse.dispose(); menuCourse = null; } clearFX(); P = null; }
function startRace(def, entrants, qualify, meta) {
  clearRace(); const spec = generateCourse(def), course = new Course(spec); blendSky(spec.theme, spec.theme, 0); scene.fog.color.setHex(spec.theme.fog[0]);
  const racers = entrants.map(e => { const r = new Racer(e.name, e.color, e.tuft, e.isPlayer); if (!e.isPlayer) r.ai = makeAI(CFG.diff); return r; });
  const slots = []; for (let row = 0; row < 3; row++) for (let c = 0; c < 6; c++) slots.push([-7.5 + c * 3 + (row % 2) * 1.0, 2.6 + row * 3.2]); const used = racers.length <= 6 ? shuffle(slots.slice(0, 6)) : shuffle(slots.slice(0, Math.ceil(racers.length / 6) * 6));
  racers.forEach((r, i) => { const s = used[i]; r.spawn(s[0], .05, s[1], 0); r.start = [s[0], s[1]]; });
  P = racers.find(r => r.isPlayer); race = { def, spec, course, racers, player: P, qualify, meta, clock: 0, t: 0, state: 'intro', st: 0, finN: 0, over: false, shownCd: 0, qualified: false, endT: 0 };
  state = 'intro'; W.state = 'race'; hideScreens(); $('hud').style.visibility = 'visible'; buildProg(); cam.init = false; cam.yaw = 0; cam.pitch = .36; cam.manual = 0;
  $('rname').textContent = meta ? meta.title + ' · ' + def.name : def.name; $('rrule').textContent = meta ? (qualify === 1 ? 'FIRST ACROSS WINS THE CROWN' : 'TOP ' + qualify + ' QUALIFY') : 'RACE TO THE FINISH';
  for (let i = 0; i < 6; i++) course.update(0, 0); setBanner(def.name.toUpperCase(), meta ? (qualify === 1 ? 'First across the line wins the crown!' : 'Only the top ' + qualify + ' of ' + racers.length + ' qualify') : 'Beat 11 other beans to the finish', 0);
}
function setBanner(a, b, ms) { $('bigA').textContent = a; $('bigB').textContent = b || ''; const t = $('big'); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(setBanner.t); if (ms) setBanner.t = setTimeout(() => t.classList.remove('on'), ms); }
function ranking() {
  const rs = race.racers.slice().sort((a, b) => a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.u - a.u); rs.forEach((r, i) => { r.rank = i + 1; }); return rs;
}

// ---------------------------------------------------------------- the per-frame simulation
const _v = new V3();
function raceStep(dt) {
  const R = race, C = R.course, spec = R.spec; R.clock += dt; C.update(R.clock, dt); R.st += dt;
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
  const rk = ranking(); if (R.state === 'race') checkEnd(rk, dt);
  if (P && R.state !== 'intro') { P.animate(dt); }
  for (const r of R.racers) if (r !== P) r.animate(dt);
  if (R.state !== 'intro' && P) updateCamera(dt, P, R.state === 'race' || R.state === 'count');
  if (R.state === 'done') { R.endT += dt; if (R.endT > 3.2 && state === 'done') showResults(); }
}
function simRacer(r, dt, racing) {
  if (!r.alive) { if (r.finished) return; r.respT -= dt; if (r.respT <= 0) respawn(r); return; }
  const inp = r.inp;
  if (r.finished || !racing) { inp.mx = inp.mz = 0; inp.sprint = false; inp.jump = false; inp.dive = false; inp.jumpPressed = false; }
  else if (r.isPlayer && !r.ai) { inp.mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); inp.mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); inp.jump = !!keys.Space; inp.sprint = !!(keys.ShiftLeft || keys.ShiftRight); }
  else if (r.ai) aiStep(r, race.course, dt);
  r.invul = Math.max(0, r.invul - dt); const camYaw = r.isPlayer && !r.ai ? cam.yaw : 0;
  r.carry(dt); const n = Math.max(1, Math.ceil(dt / (1 / 90))); for (let i = 0; i < n; i++) r.step(dt / n, camYaw, 1); pushOut(r);
  r.u = -r.pos.z; const g = r.ground;
  if (g && r.onGround) {
    if (g.crumble && g.it.cs.phase === 'idle') { g.it.cs.phase = 'shake'; g.it.cs.t = .45; if (r.isPlayer) sfx('crumble'); }
    if (g.safe && r.stun <= 0 && r.prone <= 0) r.safe.copy(r.pos);
  }
  if (racing && !r.finished && r.u >= race.spec.finishU) finishRacer(r);
  if (r.invul <= 0 && !r.finished) {
    const hz = race.course.hazards(r.pos);
    if (hz) { r.vel.x = hz.nx * 13; r.vel.z = hz.nz * 13; r.vel.y = Math.max(r.vel.y, 7.5); r.stun = .45; r.prone = 0; r.onGround = false; r.ground = null; r.invul = .4; if (r.isPlayer) { sfx('whack'); cam.shake = .5; } burst(new V3(r.pos.x, r.pos.y + 1, r.pos.z), 0xffffff, 8, 6, .12, .5, 10, 2); }
  }
  if (r.pos.y < r.safe.y - 11) fall(r);
}
function fall(r) {
  r.alive = false; r.av.g.visible = false; r.blob.visible = false; r.respT = 1.05; r.falls++; r.vel.set(0, 0, 0); if (r.isPlayer) { sfx('die'); $('fade').classList.add('on'); }
  burst(new V3(r.pos.x, r.safe.y - 6, r.pos.z), r.color, 10, 6, .2, .8, 12, 3);
}
function respawn(r) { r.spawn(r.safe.x, r.safe.y + .1, r.safe.z + .8, 0); r.invul = 1.3; if (r.isPlayer) { $('fade').classList.remove('on'); cam.init = false; cam.yaw = 0; } if (r.ai) r.ai.wi = 0; }
function finishRacer(r) {
  r.finished = true; r.finishT = race.t; r.place = ++race.finN; r.celebrate = 4; r.inp.mx = r.inp.mz = 0; const col = r.color;
  burst(new V3(r.pos.x, r.pos.y + 1.4, r.pos.z), col, 16, 8, .2, 1, 10, 4);
  if (r.isPlayer) {
    const q = race.meta ? r.place <= race.qualify : true; race.qualified = q; sfx(q ? 'qualify' : 'finish');
    setBanner(race.meta ? (q ? (race.qualify === 1 ? 'YOU WIN!' : 'QUALIFIED!') : 'TOO SLOW...') : 'FINISHED!', ord(r.place) + ' place · ' + fmtT(r.finishT), 2600);
    for (let i = 0; i < 3; i++) burst(new V3(r.pos.x, r.pos.y + 2, r.pos.z), [0xffd34e, 0xff4fa8, 0x2ee6ff][i], 14, 9, .24, 1.2, 8, 5);
  }
}
function checkEnd(rk, dt) {
  const R = race, fin = R.racers.filter(r => r.finished).length, all = fin >= R.racers.length; let end = false;
  if (R.meta) { if (fin >= R.qualify || all || R.t > 160) end = true; if (P.finished && R.t - P.finishT > 14) end = true; }
  else { if (all || R.t > 200) end = true; if (P.finished && R.t - P.finishT > 12) end = true; }
  if (end) endRace();
}
function endRace() {
  const R = race; R.state = 'done'; R.endT = 0; state = 'done'; const rk = ranking(); const q = R.meta ? rk.filter(r => r.finished && r.place <= R.qualify) : rk; R.qualifiers = q.map(r => r.name);
  const pq = R.meta ? q.includes(P) : true; R.playerQualified = pq; R.rk = rk;
  if (R.meta) { if (!P.finished || !pq) { setBanner('ELIMINATED!', 'You did not make the top ' + R.qualify, 3000); sfx('elim'); } else if (R.qualify === 1) { setBanner('CROWN!', 'You are the champion bean!', 3000); sfx('crown'); crownFx(); } else if (!P.finished || P.place > R.qualify) { /* handled above */ } else setBanner('ROUND OVER', 'The qualifiers move on', 2400); }
  else setBanner('RACE OVER', '', 2400);
  for (const r of R.racers) if (!r.finished) { r.inp.mx = r.inp.mz = 0; }
}
function crownFx() { const c = new V3(P.pos.x, P.pos.y + 2, P.pos.z); for (let i = 0; i < 6; i++) burst(c, [0xffd34e, 0xff4fa8, 0x2ee6ff, 0x8aff3a][i % 4], 20, 12, .26, 1.8, 8, 6); ring(c, 0xffd34e, 7, .9, false); }
function bumpRacers(rs, dt) {
  for (let i = 0; i < rs.length; i++) { const a = rs[i]; if (!a.alive) continue; for (let j = i + 1; j < rs.length; j++) {
    const b = rs[j]; if (!b.alive || (a.finished && b.finished)) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dy = b.pos.y - a.pos.y; if (Math.abs(dy) > 1.5) continue; const d2 = dx * dx + dz * dz, rr = a.r + b.r; if (d2 >= rr * rr || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, over = rr - d; a.pos.x -= nx * over * .35; a.pos.z -= nz * over * .35; b.pos.x += nx * over * .35; b.pos.z += nz * over * .35;
    const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz; if (rv < 0) { const j2 = -rv * .4; a.vel.x -= nx * j2; a.vel.z -= nz * j2; b.vel.x += nx * j2; b.vel.z += nz * j2; if (-rv > 5 && (a.isPlayer || b.isPlayer)) sfx('bump', clamp(-rv / 14, .3, 1)); }
    if (a.prone > 0 && !b.prone) { b.vel.x += nx * 4; b.vel.z += nz * 4; } else if (b.prone > 0 && !a.prone) { a.vel.x -= nx * 4; a.vel.z -= nz * 4; } } }
}

// ================================================================== results and rounds
function showResults() {
  const R = race; state = 'results'; W.state = 'results'; const rk = R.rk, tbl = $('resTable'); tbl.innerHTML = '<tr><th>#</th><th>Racer</th><th>Time</th>' + (R.meta ? '<th></th>' : '') + '</tr>';
  rk.forEach((r, i) => { const tr = document.createElement('tr'); if (r.isPlayer) tr.className = 'me'; const out = R.meta && !(r.finished && r.place <= R.qualify); tr.innerHTML = `<td>${i + 1}</td><td><i style="background:${hex(r.color)}"></i>${r.name}</td><td>${r.finished ? fmtT(r.finishT) : 'DNF'}</td>` + (R.meta ? `<td class="${out ? 'x' : 'ok'}">${out ? '✗' : '✓'}</td>` : ''); tbl.appendChild(tr); });
  const me = P, last = R.meta && R.meta.title === 'THE FINAL';
  if (R.meta) {
    if (R.playerQualified && !last) { $('resT').textContent = 'QUALIFIED!'; $('resT').style.color = '#6aff9a'; $('resS').textContent = 'You finished ' + ord(me.place) + ' and move on to the next round.'; $('again').textContent = 'NEXT ROUND'; show.next = true; show.entrants = R.racers.filter(r => R.qualifiers.includes(r.name)).map(r => ({ name: r.name, color: r.color, tuft: r.tuft, isPlayer: r.isPlayer })); }
    else if (last && R.playerQualified) { $('resT').textContent = 'YOU WON THE CROWN!'; $('resT').style.color = '#ffd34e'; $('resS').textContent = 'Champion bean of the whole Showdown!'; $('again').textContent = 'PLAY AGAIN'; show.next = false; save('crowns', load('crowns', 0) + 1); }
    else { $('resT').textContent = 'ELIMINATED'; $('resT').style.color = '#ff7a8a'; $('resS').textContent = me.finished ? 'You were ' + ord(me.place) + ', but only the top ' + R.qualify + ' qualified.' : 'You did not reach the finish line in time.'; $('again').textContent = 'TRY AGAIN'; show.next = false; }
    if (!last || !R.playerQualified) save('bestRound', Math.max(load('bestRound', 0), R.playerQualified ? show.r + 1 : show.r));
  } else {
    $('resT').textContent = me.finished ? ord(me.place) + ' PLACE' : 'RACE OVER'; $('resT').style.color = me.place === 1 ? '#ffd34e' : '#fff';
    const key = 'best.' + R.def.id, prev = load(key, 0), nb = me.finished && (!prev || me.finishT < prev); if (nb) save(key, me.finishT); $('resS').innerHTML = me.finished ? 'Your time <b>' + fmtT(me.finishT) + '</b>' + (nb ? ' <span class="nb">New best!</span>' : prev ? ' · best <b>' + fmtT(prev) + '</b>' : '') : 'You did not finish.'; $('again').textContent = 'RACE AGAIN';
  }
  $('results').classList.remove('hide'); document.exitPointerLock && document.pointerLockElement && document.exitPointerLock();
}
function startShowdown() { show = { r: 0, entrants: makeEntrants(ROUNDS[0].field), next: false }; beginRound(); }
function beginRound() { const R = ROUNDS[show.r]; startRace(courseDef(R.course), show.entrants, R.qualify, R); }
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
  const R = race; if (!R) return; const rk = R.racers; setT('timer', R.state === 'intro' || R.state === 'count' ? '0.00' : fmtT(R.state === 'done' && P.finished ? P.finishT : R.t)); const place = P.finished ? P.place : P.rank || 1;
  setT('rankN', String(place)); setT('rankS', ord(place).replace(/\d+/, '') + ' / ' + rk.length); const qn = R.meta && R.qualify; $('rank').classList.toggle('safe', !!(qn && place <= qn)); $('rank').classList.toggle('danger', !!(qn && place > qn));
  const L = R.spec.finishU; rk.forEach((r, i) => { dots[i].style.left = (clamp(r.u / L, 0, 1) * 100) + '%'; });
  const _p = new V3(); race.racers.forEach((r, i) => { const t = tags[i]; if (!r.alive || R.state === 'intro') { t.style.display = 'none'; return; } _p.set(r.pos.x, r.pos.y + 2.5, r.pos.z); const dist = _p.distanceTo(camera.position); _p.project(camera); if (_p.z > 1 || dist > 46 || Math.abs(_p.x) > 1.1) { t.style.display = 'none'; return; } t.style.display = ''; t.style.transform = 'translate3d(' + ((_p.x * .5 + .5) * innerWidth).toFixed(0) + 'px,' + ((-_p.y * .5 + .5) * innerHeight - 6).toFixed(0) + 'px,0)'; t.style.fontSize = r.isPlayer ? '' : (clamp(14 - dist * .09, 9, 13)) + 'px'; });
  const cd = P.diveCD; $('dive').style.opacity = R.state === 'race' && R.t > 9 ? 0 : cd > 0 ? .35 : 1; $('dive').classList.toggle('hide', false); $('lockhint').classList.toggle('hide', started || DEBUG || TOUCH || (state !== 'race' && state !== 'count'));
}

// ================================================================== loop
let last = performance.now(), fpsN = 0, fpsT = 0, fpsTxt = '', renderTick = 0;
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function step(dt) {
  W.time += dt; updateFX(dt);
  if (race && (state === 'intro' || state === 'count' || state === 'race' || state === 'done' || state === 'results')) { raceStep(dt); if (state !== 'results') updateHUD(); if (QL.shadow && P) followSun(P.pos.x, P.pos.y, P.pos.z); }
  else if (state === 'menu') { menuCamera(dt); if (menuCourse) menuCourse.update(W.time, dt); }
}
function menuCamera(dt) { if (!menuCourse) return; const sp = menuCourse.spec, t = (W.time * .018) % 1, z = -(t * (sp.length - 20)); camera.position.set(Math.sin(W.time * .15) * 9, 9 + Math.sin(W.time * .1) * 2, z + 16); camera.lookAt(0, 1.5, z - 18); if (camera.fov !== S.fov) { camera.fov = S.fov; camera.updateProjectionMatrix(); } }
function render() { if (QL.skip) renderer.shadowMap.needsUpdate = (renderTick++ & 1) === 0; renderer.render(scene, camera); }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; const hv = (state === 'menu' || state === 'results') ? 'hidden' : 'visible'; if ($('hud').style.visibility !== hv) $('hud').style.visibility = hv; if (state !== 'pause') step(dt); render(); adaptRes(raw, state === 'race'); fpsTick(raw); requestAnimationFrame(loop); }

// ================================================================== input
function lockPointer() { if (DEBUG || TOUCH) { started = true; return; } const el = $('view'); try { const p = el.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => el.requestPointerLock()); } catch (e) { try { el.requestPointerLock(); } catch (e2) {} } }
document.addEventListener('pointerlockchange', () => { const on = document.pointerLockElement === $('view'); started = on; if (!on && (state === 'race' || state === 'count') && !DEBUG) pauseGame(); });
function pauseGame() { if (state !== 'race' && state !== 'count') return; race.prevState = state; state = 'pause'; W.state = 'pause'; $('pause').classList.remove('hide'); }
function resumeGame() { if (state !== 'pause') return; state = race.prevState || 'race'; W.state = 'race'; $('pause').classList.add('hide'); audioInit(); lockPointer(); }
addEventListener('mousemove', e => { if ((state !== 'race' && state !== 'count' && state !== 'done') || (!started && !DEBUG)) return; if (!DEBUG && !TOUCH && document.pointerLockElement !== $('view')) return; const k = .0024 * S.sens; cam.yaw -= e.movementX * k; cam.pitch = clamp(cam.pitch + e.movementY * k, -.1, 1.2); cam.manual = 1.6; });
addEventListener('mousedown', e => { if ((state === 'race' || state === 'count') && !started && !DEBUG) { lockPointer(); return; } if (state === 'race' && P && e.button === 0) P.inp.dive = true; });
addEventListener('wheel', e => { if (state === 'race') cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * .8, 4, 16); });
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && (state === 'race' || state === 'count')) e.preventDefault();
  if (e.target && e.target.tagName === 'INPUT') return; if (!keys[e.code] || !e.repeat) keys[e.code] = true; if (e.repeat) return;
  if (e.code === 'Escape') { if (state === 'race' || state === 'count') pauseGame(); else if (state === 'pause') resumeGame(); return; }
  if (state !== 'race' || !P || !P.alive) return;
  if (e.code === 'Space') P.inp.jumpPressed = true; if (e.code === 'KeyE' || e.code === 'KeyF') P.inp.dive = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'race' || state === 'count') && !DEBUG) pauseGame(); });

// ================================================================== menus
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function hideScreens() { for (const id of ['menu', 'pause', 'results']) $(id).classList.add('hide'); $('fade').classList.remove('on'); $('count').classList.remove('on'); }
function renderMenu() {
  const root = $('menuPickers'); root.innerHTML = '';
  const gm = mk('div', 'grp'); gm.appendChild(mk('h3', '', 'MODE')); const cards = mk('div', 'modes');
  for (const id of Object.keys(MODES)) { const m = MODES[id], c = mk('button', 'modec' + (id === CFG.mode ? ' sel' : '')); c.appendChild(mk('b', '', m.name)); c.appendChild(mk('span', '', m.blurb)); if (id === 'showdown') { const cr = load('crowns', 0); if (cr) c.appendChild(mk('i', '', '👑 ' + cr + (cr === 1 ? ' crown' : ' crowns'))); } c.onclick = () => { CFG.mode = id; save('mode', id); sfx('click'); renderMenu(); }; cards.appendChild(c); }
  gm.appendChild(cards); root.appendChild(gm);
  if (CFG.mode === 'quick') { const gc = mk('div', 'grp'); gc.appendChild(mk('h3', '', 'COURSE')); const cc = mk('div', 'modes'); for (const c of COURSES) { const th = THEMES[c.theme], b = mk('button', 'modec' + (c.id === CFG.course ? ' sel' : '')); b.style.background = `linear-gradient(160deg, #${th.sky[0].toString(16).padStart(6, '0')}, #${th.sky[1].toString(16).padStart(6, '0')} 60%, #${th.pal[0].toString(16).padStart(6, '0')})`; b.appendChild(mk('b', '', c.name)); b.appendChild(mk('span', '', c.blurb)); const best = load('best.' + c.id, 0); if (best) b.appendChild(mk('i', '', 'Best ' + fmtT(best))); b.onclick = () => { CFG.course = c.id; save('course', c.id); sfx('click'); renderMenu(); setMenuCourse(); }; cc.appendChild(b); } gc.appendChild(cc); root.appendChild(gc); }
  const gd = mk('div', 'grp'); gd.appendChild(mk('h3', '', 'COMPUTER RACERS')); const rd = mk('div', 'row'); for (const id of Object.keys(DIFFS)) { const b = mk('button', id === CFG.diff ? 'sel' : '', DIFFS[id].name); b.onclick = () => { CFG.diff = id; save('diff', id); sfx('click'); renderMenu(); }; rd.appendChild(b); } gd.appendChild(rd); root.appendChild(gd);
  const gb = mk('div', 'grp'); gb.appendChild(mk('h3', '', 'YOUR BEAN')); const rc = mk('div', 'row sw'); for (const c of COLORS) { const b = mk('button', 'swatch' + (c === S.color ? ' sel' : '')); b.style.background = hex(c); b.onclick = () => { S.color = c; save('color', c); sfx('click'); renderMenu(); }; rc.appendChild(b); } gb.appendChild(rc); root.appendChild(gb);
  const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
  for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !new URLSearchParams(location.search).get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' : ''); }; rg.appendChild(b); }
  gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (['low', 'med', 'high'].includes(GFX_PREF) ? '' : ' (picked automatically for this computer)') + '.')); root.appendChild(gg);
}
function setMenuCourse() { if (state !== 'menu') return; if (menuCourse) { menuCourse.dispose(); menuCourse = null; } const def = courseDef(CFG.mode === 'quick' ? CFG.course : 'candy'), spec = generateCourse(def); menuCourse = new Course(spec); blendSky(spec.theme, spec.theme, 0); scene.fog.color.setHex(spec.theme.fog[0]); menuCourse.update(0, 0); }
function showMenu() { clearRace(); state = 'menu'; W.state = 'menu'; hideScreens(); $('menu').classList.remove('hide'); $('hud').style.visibility = 'hidden'; $('rankN').textContent = ''; renderMenu(); setMenuCourse(); }
$('pname').value = CFG.name; $('pname').addEventListener('input', e => { CFG.name = e.target.value.replace(/[^\w \-]/g, '').slice(0, 12); save('name', CFG.name); });
$('play').onclick = () => { audioInit(); CFG.name = $('pname').value.replace(/[^\w \-]/g, '').trim().slice(0, 12); save('name', CFG.name); if (menuCourse) { menuCourse.dispose(); menuCourse = null; } if (CFG.mode === 'showdown') startShowdown(); else startRace(courseDef(CFG.course), makeEntrants(12), 0, null); lockPointer(); };
$('resume').onclick = resumeGame; $('quit').onclick = showMenu; $('menuBtn').onclick = showMenu; $('again').onclick = nextRoundOrAgain;
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
showMenu(); requestAnimationFrame(loop);

if (DEBUG) window.__wd = { get race() { return race; }, get state() { return state; }, get P() { return P; }, get show() { return show; }, CFG, ROUNDS, COURSES, DIFFS, W, world, keys, cam, step, render, startRace, startShowdown, beginRound, generateCourse, Course, makeEntrants, makeAI, aiStep, showMenu, endRace, camera, renderer, scene, pauseGame, resumeGame, showResults, ranking, courseDef, fmtT };
