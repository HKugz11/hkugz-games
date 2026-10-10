// FORT FIGHT - online play for 2 to 4 players: a room code, a lobby, and box fights or a shared build range.
// The host keeps the rules (rounds, building rights, how much health walls have). Every player simulates themselves and
// takes their own damage: when you shoot somebody your game tells them, and their game applies it and reports a knockout.
import { V3, NETMODE, W, tracer, burst, sfx, sfxAt, rnd } from './core.js?v=10';
import { Net, makeCode, cleanCode } from './net.js?v=10';
import * as PC from './pieces.js?v=10';
import { hooks, damageActor, killActor, WEAPONS } from './actors.js?v=10';
import { props, propNet, setPropDead } from './maps.js?v=10';

export { cleanCode };
export const ON = { net: null, role: 'solo', pid: 0, roster: [], code: '', mode: 'box', playing: false };
export const isOnline = () => ON.role !== 'solo';
export const isHost = () => ON.role === 'host';
let ctx = null; export const bind = c => { ctx = c; };
const COLORS = [0x2ee6ff, 0xff4fa8, 0xffd31a, 0x8aff3a];
const actorOf = pid => W.actors.find(a => a.id === pid && !a.isDummy && !a.isBot);
const r2 = v => Math.round(v * 100) / 100;
const send = m => { if (!ON.net) return; if (ON.role === 'host') ON.net.hostBroadcast(Object.assign({ f: 0 }, m)); else ON.net.clientSend(m); };
const relay = (from, m) => ON.net.hostBroadcast(Object.assign({}, m, { f: from }), from);
let seen = new Map(), lastHost = 0, timer = 0, stateT = 0, hpT = 0; const hpQ = new Map();

// ---------------------------------------------------------------- rooms
function startTimers() {
  stopTimers(); lastHost = performance.now(); seen = new Map();
  timer = setInterval(() => {
    if (!ON.net) return; send({ t: 'ka' }); const now = performance.now();
    if (ON.role === 'host') { for (const r of ON.roster) if (r.pid !== 0 && now - (seen.get(r.pid) || now) > 25000) ON.net.kick(r.pid); }
    else if (now - lastHost > 25000) leave('Lost the connection to the host.');
  }, 2000);
}
const stopTimers = () => { clearInterval(timer); timer = 0; };
export async function hostRoom(name, mode) {
  leave(null, true);
  for (let tries = 0; tries < 4; tries++) {
    const n = new Net(NETMODE), code = makeCode(); n.onjoin = () => {}; n.onleave = hostOnLeave; n.onmsg = hostOnMsg;
    try { await n.host(code); ON.net = n; ON.role = 'host'; ON.pid = 0; ON.code = code; ON.mode = mode; ON.roster = [{ pid: 0, name, color: COLORS[0] }]; ON.playing = false; startTimers(); return code; }
    catch (e) { try { n.close(); } catch (_) {} if (!e || e.type !== 'unavailable-id') throw e; }
  }
  throw new Error('Could not set up a room, try again.');
}
export async function joinRoom(code, name) {
  leave(null, true); code = cleanCode(code); if (code.length < 5) throw new Error('Type the 5-letter room code from your friend.');
  const n = new Net(NETMODE); n.onmsg = (_, m) => clientOnMsg(m); n.onclose = () => { if (ON.net === n) leave('The host closed the room.'); };
  try { await n.join(code); } catch (e) { try { n.close(); } catch (_) {} throw e; }
  ON.net = n; ON.role = 'client'; ON.pid = -1; ON.code = code; ON.roster = []; ON.playing = false; startTimers(); n.clientSend({ t: 'hello', name, v: 1 });
}
export function leave(msg, silent) {
  const had = !!ON.net; stopTimers(); if (ON.net) { try { ON.net.close(); } catch (_) {} }
  ON.net = null; ON.role = 'solo'; ON.pid = 0; ON.roster = []; ON.playing = false; PC.NET.on = false; propNet.on = false; hpQ.clear();
  if (!silent && ctx) ctx.onLeave(msg || null); return had;
}
export function setMode(mode) { if (ON.role !== 'host') return; ON.mode = mode; ON.net.hostBroadcast({ t: 'cfg', mode }); if (ctx) ctx.lobbyChanged(); }
export function startMatch() {
  if (ON.role !== 'host' || ON.roster.length < 2) return false; ON.playing = true;
  const m = { t: 'start', mode: ON.mode, roster: ON.roster }; ON.net.hostBroadcast(m); beginMatch(m); return true;
}
function beginMatch(m) {
  ON.playing = true; ON.mode = m.mode; ON.roster = m.roster; wireUp(); ctx.startMatch(m);
  if (isHost() && m.mode === 'box') hostBeginRound();
}
function wireUp() {
  PC.NET.on = true; PC.NET.host = isHost(); PC.NET.onDamage = (p, d) => send({ t: 'pd', i: p.id, d: Math.round(d) });
  PC.NET.onHp = p => hpQ.set(p.id, Math.round(p.hp)); PC.NET.onDestroy = p => { if (ON.net) ON.net.hostBroadcast({ t: 'px', i: p.id }); hpQ.delete(p.id); };
  propNet.on = true; propNet.host = isHost(); propNet.send = (i, d) => { if (ON.net) ON.net.clientSend({ t: 'qh', i, d: Math.round(d) }); }; propNet.state = (i, d) => { if (ON.net) ON.net.hostBroadcast({ t: 'pr', i, d }); };
}

// ---------------------------------------------------------------- the host's side
function uniqueName(n) { let name = n || 'Player', k = 2; while (ON.roster.some(r => r.name === name)) name = (n || 'Player') + k++; return name; }
function hostOnMsg(pid, m) {
  seen.set(pid, performance.now());
  switch (m.t) {
    case 'hello': {
      if (ON.playing) { ON.net.hostSend(pid, { t: 'busy' }); setTimeout(() => ON.net.kick(pid), 300); return; }
      ON.roster.push({ pid, name: uniqueName(String(m.name || 'Player').slice(0, 12)), color: COLORS[pid % 4] });
      ON.net.hostSend(pid, { t: 'welcome', pid, roster: ON.roster, mode: ON.mode }); ON.net.hostBroadcast({ t: 'roster', roster: ON.roster, mode: ON.mode }, pid); if (ctx) ctx.lobbyChanged(); break;
    }
    case 'pl': applyState(pid, m); relay(pid, m); break;
    case 'bp': hostBuild(pid, m); break;
    case 'be': { const p = PC.pieces.get(m.i); if (p) { PC.setMask(p, m.m); relay(pid, m); } break; }
    case 'pd': { const p = PC.pieces.get(m.i); if (p) PC.damagePiece(p, m.d, actorOf(pid), true); break; }
    case 'qh': { const pr = props[m.i]; if (pr) pr.onHit(m.d, actorOf(pid), null, false, true); break; }
    case 'hit': if (m.to === 0) applyHitToMe(pid, m); else ON.net.hostSend(m.to, Object.assign({}, m, { f: pid })); break;
    case 'sh': case 'sw': applyShot(pid, m); relay(pid, m); break;
    case 'die': { relay(pid, { t: 'die', v: pid, k: m.k }); remoteDied(pid, m.k); break; }
  }
}
function hostOnLeave(pid) {
  const r = ON.roster.findIndex(x => x.pid === pid); if (r < 0) return; const name = ON.roster[r].name; ON.roster.splice(r, 1); seen.delete(pid);
  ON.net.hostBroadcast({ t: 'left', pid, roster: ON.roster }); dropPlayer(pid, name);
}
function hostBuild(pid, m) {
  const w = m.p, s = { type: w[1], ix: w[2], iz: w[3], lev: w[4], o: w[5] ? 'z' : 'x', dir: w[6] }, mat = PC.MAT_IDS[w[7]] || 'wood';
  const occ = PC.pieceAtSlot(s); if (occ && occ.id !== w[0]) { ON.net.hostSend(pid, { t: 'bx', i: w[0] }); return; }
  const p = occ || PC.placePiece(s, mat, pid, { id: w[0], mask: w[8] }); if (!p) { ON.net.hostSend(pid, { t: 'bx', i: w[0] }); return; }
  relay(pid, m);
}
function hostBeginRound() {
  const M = ctx.M(), n = ON.roster.length; M.round = (M.round || 0) + 1; const assign = ON.roster.map((_, i) => (i + M.round - 1) % n);
  ON.net.hostBroadcast({ t: 'round', n: M.round, a: assign, sc: M.scores }); applyRound({ n: M.round, a: assign, sc: M.scores });
}
function applyRound(m) {
  const M = ctx.M(); M.round = m.n; M.scores = m.sc; M.phase = 'count'; M.phaseT = 3.2; M.lastCount = 0; M.alive = new Set(ON.roster.map(r => r.pid)); M.target = ON.roster.length === 2 ? 5 : 3; hpQ.clear();
  ctx.rebuildMap(); ON.roster.forEach((r, i) => { const a = actorOf(r.pid); if (a) ctx.spawnAtBox(a, m.a[i]); }); ctx.roundStarted(m.n);
}
function hostEndRound() {
  const M = ctx.M(); if (M.phase !== 'fight') return; const w = M.alive.size === 1 ? [...M.alive][0] : -1; if (w >= 0) M.scores[w] = (M.scores[w] || 0) + 1;
  M.phase = 'end'; M.phaseT = 2.4; ON.net.hostBroadcast({ t: 'rend', w, sc: M.scores }); ctx.roundEnded(w);
}
export function afterKill(v) {   // the host runs this for every knockout, ours or anybody else's
  const M = ctx.M(); if (!M || !M.net || M.mode !== 'box' || M.phase !== 'fight') return; M.alive.delete(v.id); if (M.alive.size <= 1) hostEndRound();
}
function dropPlayer(pid, name) {
  const a = actorOf(pid); if (a) { const i = W.actors.indexOf(a); if (i >= 0) W.actors.splice(i, 1); a.remove(); }
  if (!ctx || !ON.playing) { if (ctx) ctx.lobbyChanged(); return; }
  const M = ctx.M(); ctx.feed(name + ' left the match', 'bad');
  if (M.alive) { M.alive.delete(pid); }
  if (isHost()) { if (ON.roster.length < 2) { const w = ON.pid; ON.net.hostBroadcast({ t: 'over', w, sc: M.scores }); ctx.endOnline(w); } else if (M.mode === 'box' && M.phase === 'fight' && M.alive.size <= 1) hostEndRound(); }
}

// ---------------------------------------------------------------- a client's side
function clientOnMsg(m) {
  lastHost = performance.now();
  switch (m.t) {
    case 'welcome': ON.pid = m.pid; ON.roster = m.roster; ON.mode = m.mode; ctx.lobbyChanged(); break;
    case 'roster': ON.roster = m.roster; ON.mode = m.mode; ctx.lobbyChanged(); break;
    case 'cfg': ON.mode = m.mode; ctx.lobbyChanged(); break;
    case 'busy': leave('That room is already in a match.'); break;
    case 'full': leave('That room is full (4 players max).'); break;
    case 'kick': leave('The host removed you from the room.'); break;
    case 'start': beginMatch(m); break;
    case 'round': applyRound(m); break;
    case 'fight': { const M = ctx.M(); if (M) { M.phase = 'fight'; M.phaseT = 0; ctx.fightStarted(); } break; }
    case 'rend': { const M = ctx.M(); if (M) { M.phase = 'end'; M.phaseT = 2.4; M.scores = m.sc; ctx.roundEnded(m.w); } break; }
    case 'over': { const M = ctx.M(); if (M) M.scores = m.sc; ctx.endOnline(m.w); break; }
    case 'left': { const old = ON.roster.find(r => r.pid === m.pid); ON.roster = m.roster; dropPlayer(m.pid, old ? old.name : 'A player'); break; }
    case 'pl': applyState(m.f, m); break;
    case 'bp': applyRemoteBuild(m.p, m.f); break;
    case 'bx': { const p = PC.pieces.get(m.i); if (p) PC.destroyPiece(p, null, true, true); break; }
    case 'be': { const p = PC.pieces.get(m.i); if (p) PC.setMask(p, m.m); break; }
    case 'hp': for (const [id, hp] of m.l) { const p = PC.pieces.get(id); if (p) PC.setPieceHp(p, hp); } break;
    case 'px': { const p = PC.pieces.get(m.i); if (p) PC.destroyPiece(p, null, false, true); break; }
    case 'hit': applyHitToMe(m.f, m); break;
    case 'sh': case 'sw': applyShot(m.f, m); break;
    case 'die': remoteDied(m.v, m.k); break;
    case 'pr': setPropDead(m.i, m.d); break;
  }
}

// ---------------------------------------------------------------- things both sides do
function applyState(f, m) {
  const a = actorOf(f); if (!a || !a.remote) return;
  a.tpos.set(m.p[0], m.p[1], m.p[2]); a.tyaw = m.r[0]; a.tpitch = m.r[1]; a.tcr = m.c; a.tground = !!m.g; a.hp = m.h; a.shield = m.s;
  if (m.l && !a.alive) { a.spawn(a.tpos, 0); a.tpos.copy(a.pos); a.yaw = a.tyaw; } else if (!m.l && a.alive && !a.dying) { a.alive = false; a.rig.g.visible = false; }
  const mode = m.m ? 'build' : 'gun'; if (a.wi !== m.w || a.mode !== mode) { a.wi = m.w; a.mode = mode; a.refreshHeld(); }
}
function applyRemoteBuild(w, from) {
  const s = { type: w[1], ix: w[2], iz: w[3], lev: w[4], o: w[5] ? 'z' : 'x', dir: w[6] };
  const occ = PC.pieceAtSlot(s); if (occ && occ.id !== w[0]) PC.destroyPiece(occ, null, true, true); PC.pieceFromWire(w, from);
}
function applyShot(f, m) {
  const a = actorOf(f); if (!a || !a.alive) return;
  if (m.t === 'sw') { a.shotT = .25; sfxAt('swing', a.pos); return; }
  const w = WEAPONS[m.w]; if (!w) return; a.shotT = .12; const mz = new V3(m.m[0], m.m[1], m.m[2]);
  for (const e of m.e) { const end = new V3(e[0], e[1], e[2]); tracer(mz, end, w.tracer, .08); burst(end, 0xffffff, 2, 3, .08, .25, 14, 1); } sfxAt(w.sfx, a.pos);
}
function applyHitToMe(from, m) { const me = ctx.P(); if (!me || !me.alive) return; damageActor(me, m.d, actorOf(from), !!m.h, m.v); }
function remoteDied(vp, kp) {
  const v = actorOf(vp), k = kp >= 0 ? actorOf(kp) : null; if (!v || !v.alive || !v.remote) return; v.dying = true; killActor(v, k, 'net'); v.dying = false;
}

// ---------------------------------------------------------------- what our own game sends
hooks.sendHit = (v, dmg, head, via) => { if (!ON.net) return; const m = { t: 'hit', to: v.id, d: Math.round(dmg), h: head ? 1 : 0, v: via || '' }; if (ON.role === 'host') ON.net.hostSend(v.id, Object.assign({ f: 0 }, m)); else ON.net.clientSend(m); };
export function sendBuild(p) { send({ t: 'bp', p: PC.wireOf(p) }); }
export function sendEdit(p, mask) { send({ t: 'be', i: p.id, m: mask }); }
export function sendShot(a, w, mz, ends) { send({ t: 'sh', w: WEAPONS.indexOf(w), m: [r2(mz.x), r2(mz.y), r2(mz.z)], e: ends.map(e => [r2(e.x), r2(e.y), r2(e.z)]) }); }
export function sendSwing() { send({ t: 'sw' }); }
export function sendDeath(attacker) { send({ t: 'die', v: ON.pid, k: attacker && attacker.id !== undefined ? attacker.id : -1 }); }
export function tick(dt) {
  if (!ON.net || !ON.playing || !ctx) return; const P = ctx.P(), M = ctx.M(); if (!P || !M) return;
  stateT -= dt; if (stateT <= 0) { stateT = .05; send({ t: 'pl', p: [r2(P.pos.x), r2(P.pos.y), r2(P.pos.z)], r: [r2(P.yaw), r2(P.pitch)], c: r2(P.crouchK), g: P.onGround ? 1 : 0, l: P.alive ? 1 : 0, w: P.wi, m: P.mode === 'build' ? 1 : 0, h: Math.round(P.hp), s: Math.round(P.shield) }); }
  if (ON.role === 'host') {
    hpT -= dt; if (hpT <= 0 && hpQ.size) { hpT = .12; ON.net.hostBroadcast({ t: 'hp', l: [...hpQ] }); hpQ.clear(); }
    if (M.mode === 'box' && M.phase) {
      M.phaseT -= dt;
      if (M.phase === 'count' && M.phaseT <= 0) { M.phase = 'fight'; ON.net.hostBroadcast({ t: 'fight' }); ctx.fightStarted(); }
      else if (M.phase === 'end' && M.phaseT <= 0) { const top = Math.max(...Object.values(M.scores)); if (top >= M.target) { const w = Number(Object.keys(M.scores).find(k => M.scores[k] === top)); ON.net.hostBroadcast({ t: 'over', w, sc: M.scores }); ctx.endOnline(w); } else hostBeginRound(); }
    }
  } else if (M.mode === 'box' && M.phase && M.phaseT > 0) M.phaseT -= dt;
}
