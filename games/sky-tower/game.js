// SKY TOWER - a 3D tower climber. Jump up a colorful tower of platforms, moving lifts, crumbling tiles and spinning bars.
import { THREE, V3, $, DEBUG, S, GFX, GFX_PREF, QL, IS_CROS, camera, renderer, scene, W, R, rnd, clamp, lerp, TAU, load, save, hex, followSun, updateFX, burst, ring, audioInit, setVolume, sfx, adaptRes, rng } from './core.js?v=7';
import { world, pushOut } from './physics.js?v=7';
import { generate, THEMES, JUMP } from './gen.js?v=7';
import { Tower } from './tower.js?v=7';
import { Player, cam, updateCamera } from './player.js?v=7';
import { TOUCH, initTouch } from './touch.js?v=7';

const MODES = {
  classic: { name: 'Classic Tower', blurb: 'The same ten-stage tower every time, with a checkpoint at the top of each stage. Beat your best time!', seed: 20261009, stages: 10, ck: true },
  random: { name: 'Random Tower', blurb: 'A brand new eight-stage tower every run (or type a seed to climb the same one as your friends).', stages: 8, ck: true, rand: true },
  hardcore: { name: 'Hardcore', blurb: 'A shorter, harder random tower with NO checkpoints. Fall and you start over from the bottom.', stages: 5, ck: false, rand: true, dBase: .5 },
};
const COLORS = [0x2ee6ff, 0xff4fa8, 0xffd31a, 0x8aff3a, 0xb06bff, 0xff7a1a, 0xffffff, 0x4a6aff];
const CFG = { mode: load('mode', 'classic'), seed: load('seed', '') }; if (!MODES[CFG.mode]) CFG.mode = 'classic';
let state = 'menu', started = false, tower = null, P = null, run = null, menuTower = null;
const keys = {}, inp = { mx: 0, mz: 0, jump: false, jumpPressed: false, sprint: false };

const fmtT = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const shuffle = (a, R) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ================================================================== runs
function makeSpec(modeId, seed) {
  const m = MODES[modeId], opts = { stages: m.stages, dBase: m.dBase || 0 };
  if (m.rand) { const r = rng(seed ^ 0x9e3779b9), idx = shuffle(THEMES.map((_, i) => i), r).slice(0, m.stages); opts.order = idx; }
  return generate(seed, opts);
}
function clearRun() { if (tower) { tower.dispose(); tower = null; } if (P) { P.remove(); P = null; } run = null; }
function startRun(modeId, fromCk = 0, resumeData = null) {
  clearRun(); if (menuTower) { menuTower.dispose(); menuTower = null; }
  const m = MODES[modeId]; let seed = m.seed;
  if (m.rand) { const typed = parseInt(String(CFG.seed).replace(/\D/g, ''), 10); seed = resumeData && resumeData.seed ? resumeData.seed : (typed > 0 ? typed : Math.floor(Math.random() * 900000000) + 1000); }
  const spec = makeSpec(modeId, seed); tower = new Tower(spec); W.time = 0;
  P = new Player(S.color); run = { mode: modeId, seed, spec, t: 0, time: resumeData ? resumeData.time : 0, started: !!resumeData, ck: fromCk, deaths: resumeData ? resumeData.deaths : 0, finished: false, shown: -1, respT: 0, invul: 0, practice: fromCk > 0 && !resumeData, hint: 9, maxCk: fromCk };
  spawnAt(run.ck); cam.init = false; state = 'play'; W.state = 'play'; hideScreens(); $('hud').style.visibility = 'visible'; sfx('go'); $('timer').classList.toggle('prac', run.practice);
  for (let i = 0; i < 8; i++) tower.update(0, 0);
  stageBanner(true);
}
function ckPos(i) { const st = run.spec.stages[Math.min(i, run.spec.stages.length - 1)], pad = tower.pad(i) || null; return { x: st.ck[0], y: st.ck[1], z: st.ck[2], dx: pad ? pad.dx : 1, dz: pad ? pad.dz : 0 }; }
function spawnAt(i) {
  const c = ckPos(i), yaw = Math.atan2(-c.dx, -c.dz); P.spawn(c.x, c.y + .05, c.z, yaw); cam.yaw = yaw; cam.pitch = .38; run.invul = .6; P.pop = false;
}
function die(why) {
  if (!P.alive || run.finished) return; P.alive = false; P.av.g.visible = false; P.blob.visible = false; run.deaths++; run.respT = .85; sfx(why === 'zap' ? 'zap' : 'die');
  const c = new V3(P.pos.x, Math.max(P.pos.y, 1) + 1, P.pos.z); burst(c, S.color, 22, 9, .22, 1, 14, 3); burst(c, 0xffffff, 10, 6, .14, .8, 12, 2); cam.shake = .6; $('fade').classList.add('on');
}
function stageBanner(first) {
  const si = tower.stageAt(P.pos.y); if (si === run.shown) return; run.shown = si; const st = run.spec.stages[si];
  toast('STAGE ' + (si + 1) + ' of ' + run.spec.N, st.name, first ? 2600 : 2200); if (!first) sfx('stage');
}
function win() {
  run.finished = true; state = 'win'; W.state = 'win'; if (document.pointerLockElement) document.exitPointerLock(); sfx('win');
  const c = new V3(P.pos.x, P.pos.y + 2, P.pos.z); for (let i = 0; i < 6; i++) burst(c, [0xffd34e, 0xff4fa8, 0x2ee6ff, 0x8aff3a][i % 4], 18, 12, .26, 1.6, 8, 5); ring(c, 0xffd34e, 6, .9, false);
  const key = 'best.' + run.mode + (MODES[run.mode].rand ? '' : ''), prevBest = load(key, 0), isBest = !run.practice && run.time > 20 && (!prevBest || run.time < prevBest);
  if (!run.practice && !MODES[run.mode].rand) { if (isBest) save(key, run.time); save('run.' + run.mode, null); }
  else if (!run.practice && isBest) save(key, run.time);
  save('max.' + run.mode, Math.max(load('max.' + run.mode, 0), run.spec.N - 1));
  $('winT').textContent = run.practice ? 'YOU MADE IT!' : isBest ? 'NEW BEST TIME!' : 'YOU MADE IT!'; $('winS').innerHTML = `Time <b>${fmtT(run.time)}</b> &nbsp;·&nbsp; Falls <b>${run.deaths}</b>` + (MODES[run.mode].rand ? ` &nbsp;·&nbsp; Seed <b>${run.seed}</b>` : '') + (!run.practice && prevBest ? `<br>Best <b>${fmtT(isBest ? run.time : prevBest)}</b>` : '') + (run.practice ? '<br>(practice run: not saved as a record)' : '');
  $('win').classList.remove('hide'); toast('', '', 1);
}

// ================================================================== input
function lockPointer() { if (DEBUG || TOUCH) { started = true; return; } const el = $('view'); try { const p = el.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => el.requestPointerLock()); } catch (e) { try { el.requestPointerLock(); } catch (e2) {} } }
document.addEventListener('pointerlockchange', () => { const on = document.pointerLockElement === $('view'); started = on; if (!on && state === 'play' && !DEBUG) pauseGame(); });
function pauseGame() { if (state !== 'play') return; state = 'pause'; W.state = 'pause'; $('pause').classList.remove('hide'); $('pauseSeed').textContent = run && MODES[run.mode].rand ? 'Seed ' + run.seed : ''; }
function resumeGame() { if (state !== 'pause') return; state = 'play'; W.state = 'play'; $('pause').classList.add('hide'); audioInit(); lockPointer(); }
addEventListener('mousemove', e => { if (state !== 'play' || (!started && !DEBUG)) return; if (!DEBUG && !TOUCH && document.pointerLockElement !== $('view')) return; const k = .0024 * S.sens; cam.yaw -= e.movementX * k; cam.pitch = clamp(cam.pitch + e.movementY * k, -.25, 1.35); });
addEventListener('mousedown', e => { if (state === 'play' && !started && !DEBUG) lockPointer(); });
addEventListener('wheel', e => { if (state !== 'play') return; cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * .8, 3.5, 15); });
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && state === 'play') e.preventDefault();
  if (!keys[e.code] || !e.repeat) keys[e.code] = true; if (e.repeat) return;
  if (e.code === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); return; }
  if (state !== 'play' || !P) return;
  if (e.code === 'Space') { inp.jumpPressed = true; run.started = true; }
  if (e.code === 'KeyR' && P.alive) { run.deaths += 0; P.alive = false; spawnAt(run.ck); toast('BACK TO CHECKPOINT', '', 900); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ================================================================== simulation
function simulate(dt) {
  run.t += dt; if (run.hint > 0) run.hint -= dt;
  tower.update(run.t, dt);
  if (!P.alive) { run.respT -= dt; if (run.respT <= 0) { spawnAt(run.ck); $('fade').classList.remove('on'); } return; }
  // camera keys (for trackpads and Chromebooks)
  if (keys.ArrowLeft) cam.yaw += 2.2 * dt; if (keys.ArrowRight) cam.yaw -= 2.2 * dt; if (keys.ArrowUp) cam.pitch = clamp(cam.pitch - 1.4 * dt, -.25, 1.35); if (keys.ArrowDown) cam.pitch = clamp(cam.pitch + 1.4 * dt, -.25, 1.35);
  inp.mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); inp.mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); inp.jump = !!keys.Space; inp.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
  if (!run.started && (inp.mx || inp.mz)) run.started = true; if (run.started && !run.finished) run.time += dt;
  run.invul = Math.max(0, run.invul - dt);
  P.carry(dt); const gs = tower.gravityAt(P.pos.y), n = Math.max(1, Math.ceil(dt / (1 / 90)));
  for (let i = 0; i < n; i++) P.step(dt / n, inp, cam.yaw, gs);
  pushOut(P);
  // what are we standing on?
  const g = P.ground;
  if (g && P.onGround) {
    if (g.crumble && g.it.cs.phase === 'idle') { g.it.cs.phase = 'shake'; g.it.cs.t = .42; sfx('crumble'); }
    if (g.ck !== undefined && g.ck > run.ck && MODES[run.mode].ck) { run.ck = g.ck; run.maxCk = Math.max(run.maxCk, g.ck); toast('CHECKPOINT', 'Stage ' + (g.ck + 1) + ' of ' + run.spec.N, 1500); sfx('checkpoint'); ring(new V3(P.pos.x, P.pos.y + .1, P.pos.z), 0x6affb0, 5, .7); burst(new V3(P.pos.x, P.pos.y + 1, P.pos.z), 0x6affb0, 16, 7, .16, .9, 10, 3); if (!run.practice) save('run.' + run.mode, { ck: run.ck, time: run.time, deaths: run.deaths, seed: run.seed }); const mx = load('max.' + run.mode, 0); if (g.ck > mx) save('max.' + run.mode, g.ck); }
    if (g.fin && !run.finished) { win(); return; }
  }
  if (run.invul <= 0) {
    const hz = tower.hazards(P.pos);
    if (hz && hz.kind === 'zap') { die('zap'); return; }
    if (hz && hz.kind === 'whack') { P.vel.x = hz.nx * 13; P.vel.z = hz.nz * 13; P.vel.y = Math.max(P.vel.y, 7.5); P.stun = .4; P.onGround = false; P.ground = null; run.invul = .35; sfx('whack'); cam.shake = .5; burst(new V3(P.pos.x, P.pos.y + 1, P.pos.z), 0xffffff, 8, 6, .12, .5, 10, 2); }
  }
  if (P.pos.y < .9) { die('goo'); return; }
  if (P.pos.y < run.spec.stages[run.ck].ck[1] - 70) { die('far'); return; }
  stageBanner(false);
}

// ================================================================== HUD
const lastHud = {}; const setT = (id, t) => { if (lastHud[id] !== t) { lastHud[id] = t; $(id).textContent = t; } };
let toastT = 0;
function toast(a, b, ms = 1500) { $('toastA').textContent = a; $('toastB').textContent = b || ''; const t = $('toast'); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function updateHUD() {
  if (!run) return; const si = tower.stageAt(P.pos.y), st = run.spec.stages[si];
  setT('stageT', 'STAGE ' + (si + 1) + ' / ' + run.spec.N); setT('stageN', st.name); const h = clamp((P.pos.y - 2) / (run.spec.top - 2), 0, 1); $('progF').style.width = (h * 100).toFixed(1) + '%';
  setT('timer', fmtT(run.time)); setT('deaths', 'FALLS ' + run.deaths); const best = load('best.' + run.mode, 0); setT('bestT', run.practice ? 'PRACTICE RUN' : best ? 'BEST ' + fmtT(best) : (MODES[run.mode].rand ? 'SEED ' + run.seed : 'NO RECORD YET'));
  $('hint').classList.toggle('hide', run.hint <= 0); $('lockhint').classList.toggle('hide', started || DEBUG || state !== 'play');
}

// ================================================================== loop
let last = performance.now(), fpsN = 0, fpsT = 0, fpsTxt = '', renderTick = 0;
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function step(dt) {
  W.time += dt; updateFX(dt);
  if (state === 'play') simulate(dt);
  else if (state === 'menu') { idleCamera(dt); if (menuTower) menuTower.update(W.time, dt); }
  else if (state === 'win') { run.t += dt; tower.update(run.t, dt); }
  if (P && (state === 'play' || state === 'pause' || state === 'win')) { P.animate(dt); if (state !== 'pause') updateCamera(dt, P); }
  const y = state === 'menu' ? camera.position.y : P ? Math.max(P.pos.y, 0) : 0; const tw = state === 'menu' ? menuTower : tower; if (tw) tw.skyFor(y);
  if (state === 'play' || state === 'pause' || state === 'win') updateHUD();
  if (QL.shadow) followSun(camera.position.x * .3 + (P ? P.pos.x * .7 : 0), P ? P.pos.y : camera.position.y - 4, camera.position.z * .3 + (P ? P.pos.z * .7 : 0));
}
function idleCamera(dt) { cam.yaw += dt * .08; const r = 54; camera.position.set(Math.sin(cam.yaw) * r, 26 + Math.sin(W.time * .1) * 6, Math.cos(cam.yaw) * r); camera.lookAt(0, 18, 0); if (camera.fov !== S.fov) { camera.fov = S.fov; camera.updateProjectionMatrix(); } }
function render() { if (QL.skip) renderer.shadowMap.needsUpdate = (renderTick++ & 1) === 0; renderer.render(scene, camera); }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; const hv = state === 'menu' ? 'hidden' : 'visible'; if ($('hud').style.visibility !== hv) $('hud').style.visibility = hv; step(dt); render(); adaptRes(raw, state === 'play'); fpsTick(raw); requestAnimationFrame(loop); }

// ================================================================== menus
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function hideScreens() { for (const id of ['menu', 'pause', 'win']) $(id).classList.add('hide'); $('fade').classList.remove('on'); }
function renderMenu() {
  const root = $('menuPickers'); root.innerHTML = '';
  const gm = mk('div', 'grp'); gm.appendChild(mk('h3', '', 'MODE')); const cards = mk('div', 'modes');
  for (const id of Object.keys(MODES)) { const m = MODES[id], c = mk('button', 'modec' + (id === CFG.mode ? ' sel' : '')); c.appendChild(mk('b', '', m.name)); c.appendChild(mk('span', '', m.blurb)); const best = load('best.' + id, 0); if (best) c.appendChild(mk('i', '', 'Best ' + fmtT(best))); c.onclick = () => { CFG.mode = id; save('mode', id); sfx('click'); renderMenu(); }; cards.appendChild(c); }
  gm.appendChild(cards); root.appendChild(gm);
  const m = MODES[CFG.mode], saved = load('run.' + CFG.mode, null), mx = load('max.' + CFG.mode, 0);
  const gs = mk('div', 'grp');
  if (m.rand) { gs.appendChild(mk('h3', '', 'SEED (OPTIONAL)')); const inpEl = mk('input'); inpEl.type = 'text'; inpEl.maxLength = 10; inpEl.placeholder = 'random'; inpEl.value = CFG.seed; inpEl.oninput = () => { CFG.seed = inpEl.value.replace(/\D/g, ''); inpEl.value = CFG.seed; save('seed', CFG.seed); }; gs.appendChild(inpEl); gs.appendChild(mk('p', 'mdesc', 'Type the same number as a friend to climb the exact same tower.')); }
  else if (m.ck && mx > 0) { gs.appendChild(mk('h3', '', 'PRACTICE: START FROM A STAGE')); const row = mk('div', 'row'); for (let i = 0; i <= mx; i++) { const b = mk('button', 'alt small', String(i + 1)); b.onclick = () => { audioInit(); startRun(CFG.mode, i); lockPointer(); }; row.appendChild(b); } gs.appendChild(row); gs.appendChild(mk('p', 'mdesc', 'Stages you have reached. Practice runs do not count for records.')); }
  root.appendChild(gs);
  const gc = mk('div', 'grp'); gc.appendChild(mk('h3', '', 'YOUR ROBOT')); const rc = mk('div', 'row sw');
  for (const c of COLORS) { const b = mk('button', 'swatch' + (c === S.color ? ' sel' : '')); b.style.background = hex(c); b.onclick = () => { S.color = c; save('color', c); sfx('click'); renderMenu(); }; rc.appendChild(b); } gc.appendChild(rc); root.appendChild(gc);
  const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
  for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !new URLSearchParams(location.search).get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' : ''); }; rg.appendChild(b); }
  gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (['low', 'med', 'high'].includes(GFX_PREF) ? '' : ' (picked automatically for this computer)') + '. On a Chromebook or a slow laptop, Low runs smoothest.')); root.appendChild(gg);
  $('play').textContent = saved && saved.ck > 0 && m.ck && !m.rand ? 'NEW RUN' : 'CLIMB!'; const cont = $('cont'); cont.classList.toggle('hide', !(saved && saved.ck > 0 && m.ck)); if (saved) cont.textContent = 'CONTINUE (STAGE ' + (saved.ck + 1) + ', ' + fmtT(saved.time) + ')';
}
function showMenu() {
  state = 'menu'; W.state = 'menu'; if (document.pointerLockElement) document.exitPointerLock(); hideScreens(); $('menu').classList.remove('hide'); clearRun();
  if (!menuTower) { menuTower = new Tower(generate(20261009, { stages: 10 })); menuTower.update(0, 0); } renderMenu(); $('hud').style.visibility = 'hidden';
}
$('play').onclick = () => { audioInit(); const m = MODES[CFG.mode]; if (!m.rand) save('run.' + CFG.mode, null); startRun(CFG.mode, 0); lockPointer(); };
$('cont').onclick = () => { audioInit(); const saved = load('run.' + CFG.mode, null); if (!saved) return; startRun(CFG.mode, saved.ck, saved); lockPointer(); };
$('resume').onclick = resumeGame; $('quit').onclick = showMenu; $('again').onclick = () => { audioInit(); const m = MODES[CFG.mode]; if (!m.rand) save('run.' + CFG.mode, null); startRun(run.mode, 0); lockPointer(); }; $('menuBtn').onclick = showMenu;
const sens = $('sens'), fov = $('fov'), vol = $('vol'); sens.value = S.sens; fov.value = S.fov; vol.value = S.vol;
sens.oninput = () => { S.sens = +sens.value; save('sens', S.sens); }; fov.oninput = () => { S.fov = +fov.value; save('fov', S.fov); camera.fov = S.fov; camera.updateProjectionMatrix(); }; vol.oninput = () => { setVolume(+vol.value); save('vol', S.vol); };
if (TOUCH) {
  $('touchWarn').style.display = 'block'; $('touchWarn').textContent = 'Touch controls: left thumb runs (push all the way to run faster), right thumb turns the camera, JUMP is the big button.';
  initTouch({
    visible: () => state === 'play', lookScale: 2.1,
    stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprintKey: 'ShiftLeft', sprintAt: .9 },
    buttons: [
      { label: 'JUMP', cls: 'fire', type: 'hold', key: 'Space', look: true, s: 98, r: 26, b: 56 },
      { label: 'BACK', type: 'tap', key: 'KeyR', s: 52, r: 140, b: 24, cls: 'small', fs: 11 },
      { label: 'II', type: 'tap', action: () => pauseGame(), s: 40, r: 12, t: 38, cls: 'small', fs: 14 },
    ],
    css: `
      html.touch #stage { top: 6px; left: 10px; min-width: 150px; padding: 4px 10px 6px; border-radius: 10px; } html.touch #stageT { font-size: 9px; } html.touch #stageN { font-size: 15px; margin: 0 0 4px; } html.touch #prog { height: 7px; }
      html.touch #timerBox { top: 6px; } html.touch #timer { font-size: 22px; padding: 0 14px; border-radius: 10px; min-width: 100px; } html.touch #bestT { font-size: 10px; }
      html.touch #deaths { top: 6px; right: 12px; font-size: 12px; padding: 2px 8px; } html.touch #hint, html.touch #lockhint { display: none; } html.touch #toast { top: 18%; } html.touch #toastA { font-size: 30px; } html.touch #toastB { font-size: 15px; }
    `,
  });
} else $('touchWarn').style.display = 'none';
showMenu(); requestAnimationFrame(loop);

if (DEBUG) window.__st = { get P() { return P; }, get run() { return run; }, get tower() { return tower; }, get state() { return state; }, W, world, keys, inp, cam, step, render, startRun, die, generate, makeSpec, MODES, THEMES, JUMP, camera, renderer, scene, showMenu, simulate, pauseGame, resumeGame, win };
