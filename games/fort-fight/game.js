// FORT FIGHT - build, edit and battle. First-person (or third-person) building shooter: Build Range, Box Fight and Fort Island, solo vs bots or online with friends.
import { THREE, V3, $, DEBUG, S, GFX, GFX_PREF, QL, IS_CROS, camera, renderer, scene, W, R, rnd, clamp, lerp, pick, angDiff, TAU, load, save, hex, followSun, updateClouds, updateFX, burst, ring, audioInit, setVolume, sfx, sfxAt, listener, adaptRes, resize, FX } from './core.js?v=10';
import { world, rayBoxT } from './physics.js?v=10';
import * as PC from './pieces.js?v=10';
import { Actor, WEAPONS, hooks, fireGun, swingPickaxe, damageActor, killActor, raycastAll } from './actors.js?v=10';
import { buildMap, MAPS, updateProps, props } from './maps.js?v=10';
import { makeAI, botUpdate, DIFFS } from './ai.js?v=10';
import { vmScene, vmCam, updateVM, vmKick, vmSwing } from './viewmodel.js?v=10';
import * as NET from './online.js?v=10';
import { TOUCH, initTouch } from './touch.js?v=10';
const tx = s => !TOUCH ? s : s.replace('Press Z/X/C/V to build. Q to switch.', 'Tap BUILD to build.').replace('Z/X/C/V to build.', 'tap BUILD to build.').replace('Press G to confirm, or click tiles to change it', 'Tap OK to save, or tap FIRE on tiles').replace('Click tiles to cut them · 1-4 quick shapes · G to confirm', 'Tap FIRE on tiles to cut them · slots 1-4 = quick shapes · OK to save').replace('Look at a wall or floor and press G', 'Look at a wall or floor and tap EDIT');

const CFG = { mode: load('mode', 'range'), diff: load('diff', 'normal'), name: load('name', '') };
if (!['range', 'box', 'island'].includes(CFG.mode)) CFG.mode = 'range'; if (!DIFFS[CFG.diff]) CFG.diff = 'normal';
const MODES = {
  range: { name: 'Build Range', blurb: 'Practice building and editing with unlimited materials. Break the targets, build up to the golden ring as fast as you can, and mess around. Friends can join you online to build together.' },
  box: { name: 'Box Fight', blurb: 'You and a bot start in little metal boxes. Build, edit and shoot. First to win 5 rounds takes it. Use HOST ONLINE to box fight your friends, 1v1 or up to 4 players.' },
  island: { name: 'Fort Island', blurb: 'Free-for-all on the island with 5 bots. Harvest trees, rocks and crates for materials, build forts and be the first to 15 knockouts.' },
};
const BOT_NAMES = ['Blip', 'Zorp', 'Chomp', 'Bolt', 'Pixel', 'Waffle', 'Nacho', 'Turbo'], BOT_COLORS = [0xff7a1a, 0xff4fa8, 0xb06bff, 0xffd31a, 0xff4a4a, 0xa0ff3a, 0x4affc8, 0xff8ad0];
const dirOf = (yaw, pitch) => new V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

let P = null, M = null, info = null, state = 'menu', started = false, adsTog = false;
const keys = {}, mouse = { l: false, r: false, lp: false, rp: false };
const cam = { shake: 0, adsK: 0, orbit: 0 };

// ================================================================== matches
const newMatch = mode => {
  const m = { mode, over: false, t: 0, infinite: mode !== 'island', kills: 0 };
  if (mode === 'box') Object.assign(m, { rounds: [0, 0], round: 1, phase: 'count', phaseT: 3, target: 5, side: 0 });
  if (mode === 'island') Object.assign(m, { target: 15, limit: 480 });
  if (mode === 'range') Object.assign(m, { ringBest: load('ringBest', 0), ringT: 0, ringOn: false, ringDone: false, spar: null });
  return m;
};
function clearActors() { for (const a of W.actors) a.remove(); W.actors.length = 0; W.dummies.length = 0; }
function mkBot(i, team, diff) {
  const a = new Actor({ name: BOT_NAMES[i % BOT_NAMES.length], color: BOT_COLORS[i % BOT_COLORS.length], isBot: true, team }); a.ai = makeAI(diff); a.dmgMul = { chill: .5, normal: .7, sweaty: .9 }[diff] || .7; return a;
}
function addDummies() { for (const [x, z] of info.dummies) { const d = new Actor({ name: 'Target', color: 0xffd34e, isDummy: true, team: 99, maxShield: 0, maxHp: 250 }); d.spawn(new V3(x, 0, z), 0); d.yaw = Math.atan2(-(0 - x), -(4 - z)); W.actors.push(d); W.dummies.push(d); } }
function startMode(mode, ocfg) {
  clearActors(); PC.cancelEdit(); PC.hideGhost(); info = buildMap(mode, { np: ocfg ? ocfg.roster.length : 2 }); M = newMatch(mode); W.M = M; state = 'play'; W.state = 'play';
  if (ocfg) {   // online: one actor per player, we are the one with our id and the rest are mirrors of what the others send us
    M.net = true; M.scores = {}; M.round = 0; M.phase = mode === 'box' ? 'count' : null; M.phaseT = 99; const me = NET.ON.pid;
    for (const r of ocfg.roster) { const mine = r.pid === me; const a = new Actor({ id: r.pid, name: r.name, color: r.color, team: mode === 'range' ? 1 : r.pid + 1, noTag: mine }); a.remote = !mine; a.infinite = true; a.dmgMul = 1; W.actors.push(a); M.scores[r.pid] = 0; if (mine) { P = a; W.me = a; } }
    PC.setIdBase(me);
    if (mode === 'range') { ocfg.roster.forEach((r, i) => { const a = W.actors.find(x => x.id === r.pid), sp = info.spawns[0]; a.spawn(new V3(sp[0] + (i - (ocfg.roster.length - 1) / 2) * 2.4, 0, sp[1]), 0); if (a.remote) a.tpos.copy(a.pos); }); addDummies(); }
  } else {
    P = new Actor({ id: 0, name: CFG.name || 'Player', color: 0x2ee6ff, team: 1, noTag: true }); P.infinite = M.infinite; if (!M.infinite) P.mats = { wood: 120, stone: 120, metal: 120 }; W.actors.push(P); W.me = P; P.dmgMul = 1;
    const sp = info.spawns[0]; P.spawn(new V3(sp[0], 0, sp[1]), 0); P.yaw = 0; P.selectWeapon(1);
    if (mode === 'range') addDummies();
    if (mode === 'box') { const b = mkBot(0, 2, CFG.diff); b.infinite = true; const s2 = info.spawns[1]; b.spawn(new V3(s2[0], 0, s2[1]), 0); b.yaw = Math.PI / 2; W.actors.push(b); P.yaw = -Math.PI / 2; resetRound(true); }
    if (mode === 'island') {
      for (let i = 0; i < 5; i++) { const b = mkBot(i, 10 + i, CFG.diff); b.infinite = false; b.mats = { wood: 80, stone: 80, metal: 80 }; W.actors.push(b); }
      for (const a of W.actors) respawnAt(a, true);
    }
  }
  for (const id of ['menu', 'over', 'pause', 'lobby']) $(id).classList.add('hide'); $('hud').style.visibility = 'visible'; $('again').classList.remove('hide'); $('overWait').classList.add('hide'); sfx('go');
  if (!(ocfg && mode === 'box')) toast(mode === 'box' ? 'ROUND 1' : mode === 'range' ? 'BUILD RANGE' : 'FORT ISLAND', mode === 'island' ? 'First to ' + M.target + ' knockouts' : mode === 'range' ? (ocfg ? tx('Building with friends. Z/X/C/V to build.') : tx('Press Z/X/C/V to build. Q to switch.')) : 'First to 5 rounds', 2200);
  buildHUDSlots(); hudDirty = true; lastHud = {};
}
function spawnPoint(a) {
  if (!info.botSpawns.length) return info.spawns[0]; let best = null, bd = -1;
  for (let k = 0; k < 8; k++) { const s = pick(info.botSpawns); let md = 1e9; for (const v of W.actors) if (v !== a && v.alive) md = Math.min(md, Math.hypot(v.pos.x - s[0], v.pos.z - s[1])); const d = md + rnd(0, 20); if (d > bd) { bd = d; best = s; } }
  return best;
}
function respawnAt(a, first) {
  const s = M.mode === 'range' ? info.spawns[0] : M.mode === 'box' ? info.spawns[a === P ? M.side : 1 - M.side] : spawnPoint(a); a.spawn(new V3(s[0] + (M.net ? rnd(-2, 2) : 0), 0, s[1]), M.mode === 'box' ? 0 : 1.8);
  if (!M.infinite && !first) a.mats = { wood: 80, stone: 80, metal: 80 }; a.selectWeapon(1); a.respT = 0; if (a.isBot) { a.ai = makeAI(CFG.diff); }
  if (M.mode === 'island') { a.pos.y = world.groundAt(a.pos.x, a.pos.z, 30); }
}
function resetRound(first) {
  PC.clearPieces(false); info.rebuild && info.rebuild(); M.phase = 'count'; M.phaseT = first ? 3 : 3.2; if (!first) M.side = 1 - M.side;
  for (const a of W.actors) { if (a.isDummy) continue; const s = info.spawns[a === P ? M.side : 1 - M.side]; a.spawn(new V3(s[0], 0, s[1]), 0); a.yaw = s[0] < 0 ? -Math.PI / 2 : Math.PI / 2; a.selectWeapon(1); if (a.isBot) a.ai = makeAI(CFG.diff); if (a === P) { P.pitch = 0; P.yaw = s[0] < 0 ? -Math.PI / 2 : Math.PI / 2; P.yaw = s[0] < 0 ? -Math.PI * .5 : Math.PI * .5; } }
  toast('ROUND ' + M.round, `${M.rounds[0]} - ${M.rounds[1]}`, 1600);
}
hooks.onKill = (v, attacker, via) => {
  if (!M) return; const me = W.me;
  feed(attacker && attacker !== v ? `${attacker.name}  >  ${v.name}` : `${v.name} was eliminated`, attacker === me ? 'me' : v === me ? 'bad' : '');
  if (attacker === me && v !== me) { sfx('kill'); showHit('kill'); toast(v.isDummy ? 'TARGET DOWN' : 'ELIMINATED ' + v.name.toUpperCase(), attacker.streak > 1 ? attacker.streak + ' in a row' : '', 1000); }
  if (v === me) { v.respT = M.mode === 'island' ? 3 : 1.6; toast('ELIMINATED', attacker && attacker !== me ? 'by ' + attacker.name : '', 1500); }
  if (v.isDummy) v.respT = 2.5;
  if (M.net) { if (v === me) NET.sendDeath(attacker); if (NET.isHost()) NET.afterKill(v); return; }
  if (M.mode === 'island' && !M.over) { if (!v.isDummy) v.respT = 3; if (attacker && attacker.kills >= M.target) endMatch(attacker === me); }
  if (M.mode === 'box' && M.phase === 'fight') { const winner = v === me ? 1 : 0; M.rounds[winner === 0 ? 0 : 1]++; M.phase = 'end'; M.phaseT = 2.3; if (v === me) sfx('lose'); else sfx('win'); toast(v === me ? 'ROUND LOST' : 'ROUND WON', `${M.rounds[0]} - ${M.rounds[1]}`, 2000); }
};
function endMatch(win) { if (M.over) return; M.over = true; state = 'over'; W.state = 'over'; if (document.pointerLockElement) document.exitPointerLock(); sfx(win ? 'win' : 'lose');
  $('overT').textContent = win ? 'VICTORY!' : 'GAME OVER'; $('overT').style.color = win ? '#ffd34e' : '#ff8a8a';
  $('overS').textContent = M.mode === 'box' ? `Rounds: ${M.rounds[0]} - ${M.rounds[1]}` : `Your knockouts: ${P.kills}   Deaths: ${P.deaths}`; $('over').classList.remove('hide'); $('again').classList.remove('hide'); $('overWait').classList.add('hide'); }

function endOnline(w) {
  if (!M || M.over) return; M.over = true; state = 'over'; W.state = 'over'; if (document.pointerLockElement) document.exitPointerLock(); PC.cancelEdit(); PC.hideGhost();
  const me = NET.ON.pid, win = w === me, wn = (NET.ON.roster.find(r => r.pid === w) || {}).name; sfx(win ? 'win' : 'lose');
  $('overT').textContent = win ? 'VICTORY!' : w >= 0 && wn ? wn + ' WINS' : 'DRAW'; $('overT').style.color = win ? '#ffd34e' : '#ff8a8a';
  $('overS').textContent = M.mode === 'box' ? 'Rounds won: ' + NET.ON.roster.map(r => r.name + ' ' + (M.scores[r.pid] || 0)).join('  ·  ') : '';
  $('again').classList.toggle('hide', !NET.isHost()); $('overWait').classList.toggle('hide', NET.isHost()); $('over').classList.remove('hide');
}

// ================================================================== input
function lockPointer() { if (DEBUG || TOUCH) { started = true; return; } const el = $('view'); try { const p = el.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => el.requestPointerLock()); } catch (e) { try { el.requestPointerLock(); } catch (e2) {} } }
document.addEventListener('pointerlockchange', () => { const on = document.pointerLockElement === $('view'); started = on; if (!on && state === 'play' && !DEBUG) pauseGame(); });
function pauseGame() { if (state !== 'play') return; state = 'pause'; W.state = 'pause'; PC.cancelEdit(); mouse.l = mouse.r = false; $('pause').classList.remove('hide'); }
function resumeGame() { if (state !== 'pause') return; state = 'play'; W.state = 'play'; $('pause').classList.add('hide'); audioInit(); lockPointer(); }
addEventListener('mousemove', e => { if (state !== 'play' || !P || !P.alive || (!started && !DEBUG)) return; if (!DEBUG && !TOUCH && document.pointerLockElement !== $('view')) return; const k = .0022 * S.sens * (P.ads ? Math.min(1, P.weapon.ads * 1.4 + .12) : 1); P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.45, 1.45); });
addEventListener('mousedown', e => { if (state !== 'play') return; if (!started && !DEBUG) { lockPointer(); return; } if (e.button === 0) { mouse.l = true; mouse.lp = true; } if (e.button === 2) { mouse.r = true; mouse.rp = true; } e.preventDefault(); });
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', e => { if (state === 'play') e.preventDefault(); });
addEventListener('wheel', e => { if (state !== 'play' || !P || !P.alive || W.edit) return; const d = Math.sign(e.deltaY); if (P.mode === 'build') { const order = ['w', 'f', 's', 'r']; P.buildType = order[(order.indexOf(P.buildType) + d + 4) % 4]; } else P.selectWeapon((P.wi + d + WEAPONS.length) % WEAPONS.length); hudDirty = true; });
addEventListener('keydown', e => {
  keys[e.code] = true; if (e.code === 'Tab' && state === 'play') e.preventDefault(); if (e.code === 'Space' && state === 'play') e.preventDefault();
  if (e.repeat || state !== 'play' || !P) { if (e.code === 'Escape' && state === 'pause') resumeGame(); return; }
  if (e.code === 'Escape') { pauseGame(); return; }
  if (!P.alive) return; const c = e.code;
  if (W.edit && c >= 'Digit1' && c <= 'Digit4') { const nm = PC.editPreset(+c.slice(5) - 1); if (nm) toast(nm.toUpperCase(), tx('Press G to confirm, or click tiles to change it'), 1100); }
  else if (c >= 'Digit1' && c <= 'Digit5') { leaveBuild(); P.selectWeapon(+c.slice(5) - 1); hudDirty = true; }
  else if (c === 'KeyQ') { if (P.mode === 'build') leaveBuild(); else enterBuild(P.buildType); }
  else if (c === 'KeyZ' || c === 'KeyX' || c === 'KeyC' || c === 'KeyV') { const t = { KeyZ: 'w', KeyX: 'f', KeyC: 's', KeyV: 'r' }[c]; if (P.mode === 'build' && P.buildType === t) leaveBuild(); else enterBuild(t); }
  else if (c === 'KeyG') { if (W.edit) { const r = PC.confirmEdit(); if (r && M.net) NET.sendEdit(r.p, r.mask); } else startEditAtCrosshair(); }
  else if (c === 'KeyR') { if (W.edit) PC.editReset(); else if (P.mode === 'build') { P.rot = (P.rot + 1) & 3; } else P.startReload(); }
  else if (c === 'KeyB') { const ids = PC.MAT_IDS; P.matSel = ids[(ids.indexOf(P.matSel) + 1) % 3]; sfx('swap'); hudDirty = true; }
  else if (c === 'KeyT') { adsTog = !adsTog; }
  else if (c === 'KeyF') { setView(S.view === 'fp' ? 'tp' : 'fp'); toast(S.view === 'fp' ? 'FIRST PERSON' : 'THIRD PERSON', '', 800); }
  else if (c === 'KeyU' && M.mode === 'range') { PC.clearPieces(false); info.rebuild && info.rebuild(); toast('RANGE RESET', '', 900); }
  else if (c === 'KeyK' && M.mode === 'range') toggleSpar();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
function setView(v) { S.view = v; save('view', v); const a = $('viewFp'), b = $('viewTp'); if (a) { a.classList.toggle('sel', v === 'fp'); b.classList.toggle('sel', v === 'tp'); } }
function enterBuild(t) { P.buildType = t; P.mode = 'build'; P.ads = false; adsTog = false; P.refreshHeld(); hudDirty = true; }
function leaveBuild() { if (P.mode !== 'build') return; P.mode = 'gun'; PC.hideGhost(); P.refreshHeld(); hudDirty = true; PC.cancelEdit(); }
function toggleSpar() { if (M.spar && M.spar.alive) { killActor(M.spar, null); M.spar.alive = false; M.spar.rig.g.visible = false; W.actors.splice(W.actors.indexOf(M.spar), 1); M.spar.remove(); M.spar = null; toast('SPARRING BOT OFF', '', 900); return; }
  const b = mkBot(3, 2, 'normal'); b.infinite = true; b.spawn(new V3(rnd(-8, 8), 0, -22), 1); W.actors.push(b); M.spar = b; toast('SPARRING BOT ON', 'It builds, it shoots, it fights back', 1500); }

// ================================================================== camera + aim
const aim = { o: new V3(), d: new V3(), mz: new V3() };
function placeCamera(dt) {
  const eye = P.eye(), fwd = dirOf(P.yaw, P.pitch), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const w = P.weapon, scoped = P.ads && w.scope && P.mode === 'gun'; cam.adsK += ((P.ads ? 1 : 0) - cam.adsK) * clamp(dt * 12, 0, 1);
  const dist = lerp(3.7, 2.2, cam.adsK), shoulder = lerp(.95, .7, cam.adsK), up = .3, fp = S.view === 'fp';
  if (scoped) { camera.position.set(eye.x + fwd.x * .15, eye.y + fwd.y * .15, eye.z + fwd.z * .15); }
  else if (fp) { camera.position.set(eye.x, eye.y, eye.z); }
  else {
    let px = eye.x + rx * shoulder, py = eye.y + up, pz = eye.z + rz * shoulder;   // pivot beside the shoulder (kept out of walls)
    const sd = Math.hypot(px - eye.x, py - eye.y, pz - eye.z), sr = world.raycast(eye.x, eye.y, eye.z, (px - eye.x) / sd, (py - eye.y) / sd, (pz - eye.z) / sd, sd + .3); if (sr.t < sd + .3) { const k = Math.max(0, sr.t - .25) / sd; px = eye.x + (px - eye.x) * k; py = eye.y + (py - eye.y) * k; pz = eye.z + (pz - eye.z) * k; }
    const r = world.raycast(px, py, pz, -fwd.x, -fwd.y, -fwd.z, dist + .3); const t = Math.min(dist, Math.max(.4, r.t - .3));
    camera.position.set(px - fwd.x * t, py - fwd.y * t, pz - fwd.z * t);
  }
  let shx = 0, shy = 0; if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2.5); shx = rnd(-1, 1) * cam.shake * .05; shy = rnd(-1, 1) * cam.shake * .05; }
  camera.rotation.set(P.pitch + shy, P.yaw + shx, 0); if (camera.position.y < .15) camera.position.y = .15;
  const wantFov = scoped ? S.fov * w.ads : lerp(S.fov, S.fov * (w.ads || .85), cam.adsK * (w.scope ? 0 : 1)); if (Math.abs(wantFov - camera.fov) > .05) { camera.fov += (wantFov - camera.fov) * clamp(dt * 14, 0, 1); camera.updateProjectionMatrix(); }
  P.hideSelf = fp || scoped; P.rig.g.visible = P.alive && !P.hideSelf; $('scope').classList.toggle('hide', !scoped); updateVM(dt, P, cam.adsK, scoped);
  // the aim ray: the camera ray, moved forward to where the player stands so our own walls behind us do not block it
  const t0 = Math.max(0, (eye.x - camera.position.x) * fwd.x + (eye.y - camera.position.y) * fwd.y + (eye.z - camera.position.z) * fwd.z);
  aim.d.copy(fwd); aim.o.set(camera.position.x + fwd.x * t0, camera.position.y + fwd.y * t0, camera.position.z + fwd.z * t0);
  const mo = fp ? .2 : .3; aim.mz.set(eye.x + rx * mo + fwd.x * .9, eye.y - .22 + fwd.y * .9, eye.z + rz * mo + fwd.z * .9);
  listener.copy(camera.position);
}
function pickEditPiece() {
  const r = world.raycast(aim.o.x, aim.o.y, aim.o.z, aim.d.x, aim.d.y, aim.d.z, 14); if (r.box && r.box.kind === 'piece' && PC.editable(r.box.piece)) return r.box.piece;
  let best = null, bs = .55;   // otherwise the editable wall or floor closest to where we are looking
  for (const p of PC.pieces.values()) { if (!PC.editable(p)) continue; const dx = p.center.x - aim.o.x, dy = p.center.y - aim.o.y, dz = p.center.z - aim.o.z, d = Math.hypot(dx, dy, dz); if (d > 7 || d < .3) continue; const dot = (dx * aim.d.x + dy * aim.d.y + dz * aim.d.z) / d; if (dot > bs) { bs = dot; best = p; } }
  return best;
}
function startEditAtCrosshair() {
  const p = pickEditPiece(); if (p) { PC.startEdit(p); P.ads = false; adsTog = false; sfx('edit'); toast('EDIT ' + PC.TYPES[p.type].toUpperCase(), tx('Click tiles to cut them · 1-4 quick shapes · G to confirm'), 1800); } else { sfx('empty'); toast('NOTHING TO EDIT', tx('Look at a wall or floor and press G'), 1200); }
}

// ================================================================== the player
let rampStart = 0;
function updatePlayer(dt, idle) {
  if (!P.alive) { if (P.respT > 0) { P.respT -= dt; if (P.respT <= 0 && M.mode !== 'box') respawnAt(P); } return; }
  const frozen = !!idle || (M.mode === 'box' && M.phase !== 'fight');
  const inp = { mx: frozen ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), mz: frozen ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), jump: !frozen && !!keys.Space, crouch: !!(keys.ShiftLeft || keys.ShiftRight) };
  P.ads = (mouse.r || adsTog) && P.mode === 'gun' && !W.edit && !frozen; P.step(dt, inp);
  placeCamera(dt);
  if (frozen) { PC.hideGhost(); mouse.lp = mouse.rp = false; return; }
  if (W.edit) {   // editing: aim at tiles, click to cut / restore
    PC.editHover(aim.o.x, aim.o.y, aim.o.z, aim.d.x, aim.d.y, aim.d.z); if (mouse.lp) PC.editToggle(); if (mouse.rp) { PC.cancelEdit(); sfx('empty'); }
    mouse.lp = mouse.rp = false; return;
  }
  if (P.mode === 'build') {
    const slot = PC.slotFromPose(P.buildType, P.pos, P.yaw, P.pitch, P.rot), ok = PC.canPlace(slot) && P.canAfford(); PC.showGhost(slot, ok);
    if (mouse.l) { P.build(P.buildType, P.rot); hudDirty = true; }
  } else {
    PC.hideGhost(); const w = P.weapon;
    if (w.melee) { if (mouse.l) swingPickaxe(P, aim.o, aim.d); }
    else if (mouse.l && (w.auto || mouse.lp)) { if (fireGun(P, aim.o, aim.d, aim.mz)) { P.pitch = clamp(P.pitch + w.kick * rnd(.6, 1.1), -1.45, 1.45); P.yaw += rnd(-.4, .4) * w.kick; cam.shake += w.kick * 3; hudDirty = true; } }
  }
  mouse.lp = mouse.rp = false;
  // range: the golden ring
  if (M.mode === 'range') {
    const moved = Math.hypot(P.pos.x, P.pos.z - 4) > 3 || P.pos.y > 1; if (!M.ringOn && moved && !M.ringDone) { M.ringOn = true; M.ringT = 0; }
    if (M.ringOn) { M.ringT += dt; if (Math.hypot(P.pos.x, P.pos.z) < 3.6 && Math.abs(P.pos.y + 1 - info.ringY) < 3.2) { const t = M.ringT; M.ringOn = false; M.ringDone = true; const best = M.ringBest ? Math.min(M.ringBest, t) : t; const rec = !M.ringBest || t < M.ringBest; M.ringBest = best; save('ringBest', best); sfx('win'); burst(new V3(0, info.ringY, 0), 0xffd34e, 40, 12, .3, 1.4, 10, 3); toast('RING REACHED!', `${t.toFixed(1)}s${rec ? '  NEW BEST' : '  best ' + best.toFixed(1) + 's'}`, 2600); } }
    if (P.pos.y < 1 && M.ringDone && Math.hypot(P.pos.x, P.pos.z - 4) < 3) { M.ringDone = false; }
    info.ring.rotation.z += dt * 1.2;
  }
}

// ================================================================== simulation
function simulate(dt, idle) {
  updatePlayer(dt, idle);
  const frozen = M.mode === 'box' && M.phase !== 'fight';
  for (const a of W.actors) {
    if (a === P) continue;
    if (a.remote) { a.netStep(dt); continue; }
    if (a.isDummy) { if (!a.alive) { a.respT -= dt; if (a.respT <= 0) { const keep = a.yaw; a.spawn(a.homePos || a.pos, 0); a.yaw = keep; } } else { if (!a.homePos) a.homePos = a.pos.clone(); a.step(dt, { mx: 0, mz: 0 }); } continue; }
    if (!a.alive) { if (M.mode === 'island') { a.respT -= dt; if (a.respT <= 0) respawnAt(a); } continue; }
    if (frozen) a.step(dt, { mx: 0, mz: 0 }); else botUpdate(a, dt);
  }
  // soft pushing so characters do not stand inside each other
  for (let i = 0; i < W.actors.length; i++) { const a = W.actors[i]; if (!a.alive || a.isDummy) continue; for (let j = i + 1; j < W.actors.length; j++) { const b = W.actors[j]; if (!b.alive || b.isDummy || Math.abs(a.pos.y - b.pos.y) > 1.5) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz); if (d < .75 && d > .001) { const k = (.75 - d) * .5 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; } } }
  // slow shield and health regeneration when nobody is shooting at you
  if (M.mode !== 'box') for (const a of W.actors) if (a.alive && !a.isDummy && W.time - a.lastHurt > 5) { if (a.shield < a.maxShield) a.shield = Math.min(a.maxShield, a.shield + 5 * dt); else if (a.hp < a.maxHp && W.time - a.lastHurt > 8) a.hp = Math.min(a.maxHp, a.hp + 3 * dt); }
  if (M.net) NET.tick(dt);
  if (M.mode === 'box' && !M.net) {
    M.phaseT -= dt;
    if (M.phase === 'count') { const s = Math.ceil(M.phaseT); if (s !== M.lastCount && s > 0 && s <= 3) { M.lastCount = s; sfx('tick'); } if (M.phaseT <= 0) { M.phase = 'fight'; M.lastCount = 0; toast('FIGHT!', '', 700); sfx('go'); } }
    else if (M.phase === 'end' && M.phaseT <= 0) { if (M.rounds[0] >= M.target || M.rounds[1] >= M.target) endMatch(M.rounds[1] >= M.target ? false : true); else { M.round++; resetRound(false); } }
  }
  if (M.mode === 'island' && !M.over) { M.t += dt; if (M.t >= M.limit) { const top = [...W.actors].filter(a => !a.isDummy).sort((a, b) => b.kills - a.kills)[0]; endMatch(top === P); } }
  M.t += M.mode === 'island' ? 0 : dt;
}
function idleCamera(dt) {
  cam.orbit += dt * .12; const r = info ? info.half * .5 : 30; camera.position.set(Math.cos(cam.orbit) * r, 14, Math.sin(cam.orbit) * r); camera.lookAt(0, 4, 0); listener.copy(camera.position); if (camera.fov !== S.fov) { camera.fov = S.fov; camera.updateProjectionMatrix(); }
}

// ================================================================== HUD
let hudDirty = true, lastHud = {};
const slotsEl = $('slots'), buildEl = $('buildbar');
function buildHUDSlots() {
  slotsEl.innerHTML = ''; WEAPONS.forEach((w, i) => { const d = document.createElement('div'); d.className = 'slot'; d.innerHTML = `<i>${i + 1}</i><b>${w.name}</b><span></span>`; slotsEl.appendChild(d); });
  buildEl.innerHTML = ''; [['w', 'Z', 'Wall'], ['f', 'X', 'Floor'], ['s', 'C', 'Stairs'], ['r', 'V', 'Roof'], ['edit', 'G', 'Edit']].forEach(([t, k, n]) => { const d = document.createElement('div'); d.className = 'bp'; d.dataset.t = t; d.innerHTML = `<i>${k}</i><b>${n}</b>`; buildEl.appendChild(d); });
}
const dnPool = []; let dnList = [];
hooks.dmgNumber = (pos, dmg, head, shieldOnly, attacker) => {
  if (attacker !== W.me) return; let el = dnPool.pop(); if (!el) { el = document.createElement('div'); el.className = 'dn'; $('hud').appendChild(el); }
  el.textContent = dmg; el.className = 'dn' + (head ? ' head' : shieldOnly ? ' sh' : ''); el.style.display = 'block'; dnList.push({ el, pos: pos.clone().add(new V3(rnd(-.4, .4), 0, rnd(-.4, .4))), life: .85, vy: 1.8 });
  if (dnList.length > 14) { const o = dnList.shift(); o.el.style.display = 'none'; dnPool.push(o.el); }
  const kill = false; void kill; showHit(head ? 'head' : shieldOnly ? 'shield' : ''); sfx(head ? 'head' : shieldOnly ? 'shieldhit' : 'hit');
};
hooks.onFire = (a, w, by, mz, ends) => { if (a === P) { vmKick(w); if (M && M.net) NET.sendShot(a, w, mz, ends); } }; hooks.onSwing = a => { if (a === P) { vmSwing(); if (M && M.net) NET.sendSwing(); } };
hooks.onBuild = (a, p) => { if (a === P && M && M.net) NET.sendBuild(p); };
hooks.onDamage = (v, dmg, attacker, head) => { if (v === W.me) { $('vig').classList.add('on'); clearTimeout(hooks.vt); hooks.vt = setTimeout(() => $('vig').classList.remove('on'), 140); cam.shake += .5; sfx('hurt'); } };
function showHit(kind) { const h = $('hit'); h.className = 'on ' + kind; clearTimeout(showHit.t); showHit.t = setTimeout(() => { h.className = ''; }, 100); }
function feed(t, cls) { const d = document.createElement('div'); d.textContent = t; if (cls) d.className = cls; $('feed').appendChild(d); setTimeout(() => d.remove(), 5200); while ($('feed').children.length > 5) $('feed').firstChild.remove(); }
let toastT = 0;
function toast(a, b, ms = 1500) { $('toastA').textContent = a; $('toastB').textContent = b || ''; const t = $('toast'); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
const setW = (id, pct) => { const e = $(id); const v = Math.round(pct * 10) / 10; if (lastHud[id] !== v) { lastHud[id] = v; e.style.width = v + '%'; } };
const setT = (id, t) => { if (lastHud[id] !== t) { lastHud[id] = t; $(id).textContent = t; } };
function updateHUD(dt) {
  if (!P) return; const w = P.weapon, am = P.ammo[P.wi];
  setW('shfill', P.maxShield ? P.shield / P.maxShield * 100 : 0); setW('hpfill', P.hp / P.maxHp * 100); setT('shnum', Math.ceil(P.shield)); setT('hpnum', Math.ceil(P.hp));
  setT('ammo', w.melee || P.mode !== 'gun' ? '' : (P.reloadT > 0 ? 'RELOAD' : am.mag) + (P.reloadT > 0 ? '' : ' / ∞')); setT('wname', P.mode === 'build' ? 'BUILD: ' + PC.TYPES[P.buildType] : w.name);
  for (let i = 0; i < slotsEl.children.length; i++) { const e = slotsEl.children[i], on = P.mode === 'gun' && P.wi === i, cls = 'slot' + (on ? ' on' : ''); if (e.className !== cls) e.className = cls; const s = e.lastChild, t = WEAPONS[i].melee ? '' : P.ammo[i].mag; if (s.textContent !== String(t)) s.textContent = t; }
  for (const e of buildEl.children) { const on = e.dataset.t === 'edit' ? !!W.edit : P.mode === 'build' && !W.edit && P.buildType === e.dataset.t, cls = 'bp' + (on ? ' on' : ''); if (e.className !== cls) e.className = cls; }
  for (const m of PC.MAT_IDS) { const e = $('m_' + m); const t = P.infinite ? '∞' : String(P.mats[m]); if (e.lastChild.textContent !== t) e.lastChild.textContent = t; const cls = 'mat' + (P.matSel === m ? ' on' : ''); if (e.className !== cls) e.className = cls; }
  $('edithud').classList.toggle('hide', !W.edit); $('cross').classList.toggle('hide', (P.mode === 'build' && !W.edit) || (P.ads && w.scope)); if (W.edit) setT('editShapes', (PC.PRESETS[W.edit.piece.type] || []).map((p, i) => (i + 1) + ' ' + p[0]).join('   ')); $('cross').classList.toggle('ads', P.ads);
  // top bar
  let top = '', sub = '';
  if (M.mode === 'box' && M.net) { const mine = M.scores[P.id] || 0, others = Object.keys(M.scores).filter(k => +k !== P.id).map(k => M.scores[k]); top = [mine, ...others].join('  :  '); sub = M.phase === 'count' ? 'GET READY ' + Math.max(1, Math.ceil(M.phaseT)) : `ROUND ${M.round}  ·  first to ${M.target}`; }
  else if (M.mode === 'box') { top = `${M.rounds[1]}  :  ${M.rounds[0]}`; sub = `ROUND ${M.round}  ·  first to ${M.target}`; if (M.phase === 'count') sub = 'GET READY ' + Math.max(1, Math.ceil(M.phaseT)); }
  else if (M.mode === 'island') { const left = Math.max(0, M.limit - M.t), best = [...W.actors].filter(a => !a.isDummy).sort((a, b) => b.kills - a.kills)[0]; top = `${P.kills} / ${M.target}`; sub = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}  ·  leader ${best.name} ${best.kills}`; }
  else { top = M.ringOn ? M.ringT.toFixed(1) + 's' : (M.ringBest ? 'best ' + M.ringBest.toFixed(1) + 's' : 'RING 39 m'); sub = 'build up to the golden ring  ·  U reset  ·  K sparring bot'; }
  setT('topA', top); setT('topB', sub);
  // floating damage numbers
  for (let i = dnList.length - 1; i >= 0; i--) { const d = dnList[i]; d.life -= dt; d.pos.y += d.vy * dt; if (d.life <= 0) { d.el.style.display = 'none'; dnPool.push(d.el); dnList.splice(i, 1); continue; } const v = d.pos.clone().project(camera); if (v.z > 1) { d.el.style.display = 'none'; continue; } d.el.style.display = 'block'; d.el.style.transform = `translate(${(v.x * .5 + .5) * innerWidth}px, ${(-v.y * .5 + .5) * innerHeight}px) translate(-50%,-50%)`; d.el.style.opacity = Math.min(1, d.life * 2.2); }
  // scoreboard
  const bd = $('board'); bd.classList.toggle('hide', !keys.Tab); if (keys.Tab) { const rows = [...W.actors].filter(a => !a.isDummy).sort((a, b) => b.kills - a.kills); bd.innerHTML = '<h3>SCOREBOARD</h3>' + rows.map(a => `<div class="${a === P ? 'me' : ''}"><span>${a.name}</span><b>${a.kills}</b><em>${a.deaths}</em></div>`).join(''); }
  $('lockhint').classList.toggle('hide', started || DEBUG || state !== 'play'); $('respawn').classList.toggle('hide', P.alive || M.over); if (!P.alive) setT('respT', M.mode === 'box' ? 'Next round soon' : 'Respawning in ' + Math.max(1, Math.ceil(P.respT)));
}

// ================================================================== loop
let last = performance.now(), fpsN = 0, fpsT = 0, fpsTxt = '', renderTick = 0;
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function step(dt) {
  W.time += dt; updateClouds(dt); updateProps(dt); PC.updatePieces(dt); updateFX(dt);
  if (state === 'play') { simulate(dt); }
  else if (state === 'pause' && M && M.net) { simulate(dt, true); }
  else if (state === 'menu' || state === 'over') { idleCamera(dt); for (const a of W.actors) if (a.alive) a.step(dt, { mx: 0, mz: 0 }); }
  if (!P || !P.alive || state === 'menu' || state === 'over') vmScene.visible = false;
  if (state !== 'menu') for (const a of W.actors) a.animate(dt, camera);
  if (state === 'play' || state === 'pause') updateHUD(dt);
  if (QL.shadow) followSun(camera.position.x, camera.position.z);
}
function render() { if (QL.skip) renderer.shadowMap.needsUpdate = (renderTick++ & 1) === 0; renderer.clear(); renderer.render(scene, camera); if (vmScene.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCam); } }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; const hv = (state === 'menu') ? 'hidden' : 'visible'; if ($('hud').style.visibility !== hv) $('hud').style.visibility = hv; step(dt); render(); adaptRes(raw, state === 'play'); fpsTick(raw); requestAnimationFrame(loop); }

// ================================================================== menus
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function renderMenu() {
  const root = $('menuPickers'); root.innerHTML = '';
  const gm = mk('div', 'grp'); gm.appendChild(mk('h3', '', 'MODE')); const cards = mk('div', 'modes');
  for (const id of Object.keys(MODES)) { const c = mk('button', 'modec' + (id === CFG.mode ? ' sel' : '')); c.appendChild(mk('b', '', MODES[id].name)); c.appendChild(mk('span', '', MODES[id].blurb)); c.onclick = () => { CFG.mode = id; save('mode', id); renderMenu(); }; cards.appendChild(c); }
  gm.appendChild(cards); root.appendChild(gm);
  const gd = mk('div', 'grp'); gd.appendChild(mk('h3', '', 'BOTS')); const rd = mk('div', 'row');
  for (const id of Object.keys(DIFFS)) { const b = mk('button', id === CFG.diff ? 'sel' : '', DIFFS[id].name + ' bots'); b.onclick = () => { CFG.diff = id; save('diff', id); renderMenu(); }; rd.appendChild(b); }
  gd.appendChild(rd); root.appendChild(gd);
  const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
  for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !new URLSearchParams(location.search).get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' : ''); }; rg.appendChild(b); }
  gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (['low', 'med', 'high'].includes(GFX_PREF) ? '' : ' (picked automatically for this computer)') + '. On a Chromebook or a slow laptop, Low runs smoothest.')); root.appendChild(gg);
}
$('pname').value = CFG.name; $('pname').addEventListener('input', e => { CFG.name = e.target.value.slice(0, 12); save('name', CFG.name); });
$('play').onclick = () => { audioInit(); startMode(CFG.mode); lockPointer(); };
$('resume').onclick = resumeGame; $('quit').onclick = () => { toMenu(); }; $('again').onclick = () => { audioInit(); if (M && M.net) { if (NET.isHost()) NET.startMatch(); return; } startMode(M.mode); lockPointer(); }; $('menuBtn').onclick = () => toMenu();
function toMenu(msg) { NET.leave(null, true); $('lobby').classList.add('hide'); setNetMsg(msg || ''); state = 'menu'; W.state = 'menu'; PC.cancelEdit(); PC.hideGhost(); if (document.pointerLockElement) document.exitPointerLock(); for (const id of ['over', 'pause']) $(id).classList.add('hide'); $('menu').classList.remove('hide'); clearActors(); P = null; info = buildMap('range'); W.me = null; renderMenu(); }
// ---------------------------------------------------------------- online: host or join a room, the lobby, and the bridge to online.js
const setNetMsg = t => { for (const id of ['netMsg', 'lobbyMsg']) { const e = $(id); if (e) e.textContent = t || ''; } };
const errText = e => (e && (e.message || e.type)) || 'try again';
function showLobby() { for (const id of ['menu', 'over', 'pause']) $(id).classList.add('hide'); $('lobby').classList.remove('hide'); renderLobby(); }
function renderLobby() {
  if (!NET.isOnline()) return; const host = NET.isHost(); $('lobbyCode').textContent = NET.ON.code || '-----';
  const r = $('roster'); r.innerHTML = ''; for (const p of NET.ON.roster) { const d = mk('div', 'rost'), dot = mk('i'); dot.style.background = hex(p.color); d.appendChild(dot); d.appendChild(mk('span', 'rn', p.name + (p.pid === NET.ON.pid ? ' (you)' : ''))); if (p.pid === 0) d.appendChild(mk('em', '', 'HOST')); r.appendChild(d); }
  const mm = $('lobbyMode'); mm.innerHTML = ''; for (const [id, nm] of [['box', 'Box Fight'], ['range', 'Build Range (together)']]) { const b = mk('button', id === NET.ON.mode ? 'sel' : '', nm); b.disabled = !host; b.onclick = () => NET.setMode(id); mm.appendChild(b); }
  $('lobbyDesc').textContent = NET.ON.mode === 'box' ? (NET.ON.roster.length > 2 ? 'Everybody gets a box. Last one standing wins the round. First to 3 round wins takes the match.' : 'You each get a box. First to 5 round wins takes the match.') : 'Build and shoot targets together. Up to 4 players.';
  $('startBtn').classList.toggle('hide', !host); $('startBtn').disabled = NET.ON.roster.length < 2; $('lobbyWait').classList.toggle('hide', host);
  setNetMsg(NET.ON.roster.length < 2 && host ? 'Waiting for a friend to join. Share the code!' : '');
}
$('hostBtn').onclick = async () => { audioInit(); setNetMsg('Setting up your room…'); try { await NET.hostRoom(CFG.name || 'Player', CFG.mode === 'range' ? 'range' : 'box'); showLobby(); } catch (e) { setNetMsg('Could not set up a room: ' + errText(e)); } };
$('joinBtn').onclick = async () => { audioInit(); const code = NET.cleanCode($('joinCode').value); if (code.length < 5) { setNetMsg('Type the 5-letter room code from your friend.'); return; } setNetMsg('Connecting…'); try { await NET.joinRoom(code, CFG.name || 'Player'); showLobby(); } catch (e) { setNetMsg(e && e.type === 'peer-unavailable' ? 'No room with that code.' : 'Could not connect: ' + errText(e)); } };
$('joinCode').addEventListener('input', e => { e.target.value = NET.cleanCode(e.target.value); });
$('startBtn').onclick = () => { audioInit(); NET.startMatch(); }; $('leaveLobby').onclick = () => toMenu(); $('copyCode').onclick = () => { try { navigator.clipboard.writeText(NET.ON.code); setNetMsg('Code copied!'); } catch (e) {} };
NET.bind({
  P: () => P, M: () => M,
  startMatch(cfg) { startMode(cfg.mode, cfg); lockPointer(); },
  rebuildMap() { PC.clearPieces(false); PC.resetIds(); info.rebuild && info.rebuild(); PC.setIdBase(NET.ON.pid); },
  spawnAtBox(a, idx) { const b = info.boxes[idx % info.boxes.length]; a.spawn(new V3(b.x, 0, b.z), 0); a.yaw = b.yaw; a.pitch = 0; a.selectWeapon(1); if (a.remote) { a.tpos.copy(a.pos); a.tyaw = a.yaw; a.tpitch = 0; a.tcr = 0; a.tground = true; } },
  toast, feed, endOnline, lobbyChanged: renderLobby, onLeave: msg => toMenu(msg),
  fightStarted() { toast('FIGHT!', '', 700); sfx('go'); },
  roundStarted(n) { toast('ROUND ' + n, '', 1600); },
  roundEnded(w) { const me = NET.ON.pid; if (w === me) { toast('ROUND WON', '', 1800); sfx('win'); } else if (w < 0) toast('DRAW', '', 1500); else { toast('ROUND LOST', ((NET.ON.roster.find(r => r.pid === w) || {}).name || 'Somebody') + ' wins it', 1800); sfx('lose'); } },
});
$('viewFp').onclick = () => setView('fp'); $('viewTp').onclick = () => setView('tp'); setView(S.view);
const sens = $('sens'), fov = $('fov'), vol = $('vol'); sens.value = S.sens; fov.value = S.fov; vol.value = S.vol;
sens.oninput = () => { S.sens = +sens.value; save('sens', S.sens); }; fov.oninput = () => { S.fov = +fov.value; save('fov', S.fov); camera.fov = S.fov; camera.updateProjectionMatrix(); }; vol.oninput = () => { setVolume(+vol.value); save('vol', S.vol); };
if (TOUCH) {
  $('touchWarn').style.display = 'block'; $('touchWarn').textContent = 'Touch controls: left thumb moves, right thumb looks. FIRE shoots and places builds. Tap BUILD, then pick Wall, Floor, Stairs or Roof at the bottom.';
  $('edithud').innerHTML = 'EDIT: aim at a tile and tap FIRE to cut it or bring it back. Tap OK to save.<div class="shapes">Quick shapes (slots 1-4): <span id="editShapes"></span></div>';
  const gunM = () => !!P && P.mode === 'gun' && !W.edit, bldM = () => !!P && P.mode === 'build' && !W.edit, edM = () => !!W.edit;
  const bt = (label, key, o) => Object.assign({ label, key, type: 'tap', s: 58, cls: 'small', fs: 10 }, o), BP = { w: 'KeyZ', f: 'KeyX', s: 'KeyC', r: 'KeyV', edit: 'KeyG' };
  initTouch({
    visible: () => state === 'play', lookScale: 2.3,
    stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
    taps: [{ sel: '#slots > .slot', key: (el, i) => 'Digit' + (i + 1) }, { sel: '#buildbar > .bp', key: el => BP[el.dataset.t] }],
    buttons: [
      { label: 'FIRE', cls: 'fire', mouse: 0, look: true, minHold: 90, s: 92, r: 24, b: 64 },
      bt('ZOOM', 'KeyT', { isOn: () => adsTog, show: gunM, r: 40, b: 168, fs: 11 }), bt('CANCEL', null, { mouseTap: 2, show: edM, r: 40, b: 168 }),
      bt('JUMP', 'Space', { type: 'hold', s: 64, r: 128, b: 22, fs: 11 }),
      bt('RELOAD', 'KeyR', { show: gunM, r: 132, b: 100 }), bt('ROTATE', 'KeyR', { show: bldM, r: 132, b: 100 }), bt('RESET', 'KeyR', { show: edM, r: 132, b: 100 }),
      bt('BUILD', 'KeyQ', { isOn: () => !!P && P.mode === 'build', show: () => !W.edit, r: 206, b: 60, fs: 11 }),
      bt('EDIT', 'KeyG', { show: gunM, s: 52, r: 206, b: 130, fs: 11 }), bt('MATS', 'KeyB', { show: bldM, s: 52, r: 206, b: 130, fs: 11 }), bt('OK', 'KeyG', { show: edM, glow: () => true, s: 52, r: 206, b: 130, fs: 13 }),
      { label: 'CROUCH', type: 'toggle', key: 'ShiftLeft', s: 52, r: 270, b: 22, cls: 'small', fs: 9 },
      { label: 'SCORE', type: 'toggle', key: 'Tab', s: 40, l: 118, t: 8, cls: 'small', fs: 8 },
      { label: 'II', type: 'tap', action: pauseGame, s: 40, l: 164, t: 8, cls: 'small', fs: 14 },
    ],
    css: `
      html.touch #top { top: 6px; } html.touch #topA { font-size: 20px; padding: 0 14px; min-width: 70px; border-radius: 10px; } html.touch #topB { font-size: 10px; margin-top: 2px; }
      html.touch #hpbox { left: 10px; bottom: 8px; width: 150px; } html.touch .nums { font-size: 16px; gap: 10px; } html.touch .bar { height: 10px; margin-top: 3px; border-width: 2px; }
      html.touch #bottom { left: 40%; bottom: 6px; } html.touch #slots { margin-top: 4px; gap: 4px; } html.touch #buildbar { gap: 4px; }
      html.touch .slot { width: 56px; height: 40px; padding: 2px; border-width: 2px; border-radius: 9px; } html.touch .slot b { font-size: 9px; margin-top: 10px; } html.touch .slot i { font-size: 9px; left: 4px; top: 1px; } html.touch .slot span { font-size: 10px; right: 4px; }
      html.touch .bp { width: 54px; height: 28px; font-size: 10px; padding-top: 4px; border-width: 2px; border-radius: 8px; } html.touch .bp i { display: none; } html.touch .bp b { margin-left: 0; }
      html.touch #right { right: 12px; top: 24px; bottom: auto; } html.touch #ammo { font-size: 30px; margin-bottom: 0; } html.touch #wname { font-size: 10px; } html.touch .mat { font-size: 12px; margin-top: 1px; padding: 1px 6px; } html.touch .mat b { font-size: 9px; } html.touch .mat i { width: 11px; height: 11px; }
      html.touch #feed { top: 138px; right: 12px; } html.touch #feed div { font-size: 12px; padding: 3px 9px; }
      html.touch #edithud { top: 52px; font-size: 12px; padding: 5px 12px; } html.touch #toast { top: 18%; } html.touch #toastA { font-size: 28px; } html.touch #toastB { font-size: 13px; } html.touch #respawn { top: 50%; font-size: 18px; }
    `,
  });
} else $('touchWarn').style.display = 'none';
info = buildMap('range'); renderMenu(); buildHUDSlots(); $('hud').style.visibility = 'hidden';
requestAnimationFrame(loop);

// debug hook for the test runner
if (DEBUG) window.__ff = { get P() { return P; }, get M() { return M; }, get info() { return info; }, get state() { return state; }, W, PC, world, keys, mouse, cam, aim, step, render, startMode, resumeGame, enterBuild, leaveBuild, CFG, renderer, scene, camera, props, WEAPONS, placeCamera, endMatch, toMenu, MODES, hooks, NET, botUpdate, makeAI, Actor, damageActor, killActor, raycastAll, get hudDirty() { return hudDirty; } };
