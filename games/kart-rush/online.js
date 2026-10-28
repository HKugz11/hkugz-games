// KART RUSH - online races. One player hosts a room (5-letter code) and up to five friends join with it. Everybody drives their own kart and sends where it is about
// 15 times a second; the host also drives the robots. Items are replayed on every machine, and each machine decides what hits its own kart (the host decides for the robots).
// Players connect directly (WebRTC); the free PeerJS Cloud service is only used to introduce them. For testing, ?net=local links two tabs of one browser.
import { Net, makeCode, cleanCode, MAX_PLAYERS } from './net.js?v=3';
import { NETMODE, angDiff } from './core.js?v=3';

export { cleanCode, MAX_PLAYERS };
export const ON = { active: false, role: 'none', pid: 0, code: '', roster: [], racing: false, cfg: null, status: '' };
let net = null, A = null, sendT = 0;
export const init = api => { A = api; };
const rd = (n, d = 2) => { const m = Math.pow(10, d); return Math.round(n * m) / m; };
const clean = s => String(s == null ? '' : s).replace(/[^\w .\-!?]/g, '').slice(0, 12) || 'Racer';

// ---------------------------------------------------------------- a kart on the wire
export function encode(k) {
  const f = (k.boostT > 0 ? 1 : 0) | (k.spinT > 0 ? 2 : 0) | (k.shield > 0 ? 4 : 0) | (k.star > 0 ? 8 : 0) | (k.air ? 16 : 0) | (k.tricked ? 32 : 0) | (k.finished ? 64 : 0);
  return [k.netId, rd(k.p.x), rd(k.y), rd(k.p.z), rd(k.h, 3), rd(k.vx, 1), rd(k.vz, 1), rd(k.vf, 1), f, k.drift.on ? k.drift.dir : 0, k.drift.tier, rd(k.in.steer, 1), rd(k.dist, 1), rd(k.finishT || 0, 2), k.coins | 0];
}
function decode(k, a) {
  if (!Array.isArray(a) || a.length < 15) return;
  k.net = { x: +a[1], y: +a[2], z: +a[3], h: +a[4], vx: +a[5], vz: +a[6], vf: +a[7], f: a[8] | 0, dd: a[9] | 0, tier: a[10] | 0, steer: +a[11], dist: +a[12], t: performance.now() };
  if ((a[8] & 64) && !k.finished) { k.finished = true; k.finishT = +a[13] || 0; } k.coins = a[14] | 0;
  if (!k.netInit) { k.netInit = true; k.p.set(k.net.x, k.net.y, k.net.z); k.y = k.net.y; k.h = k.net.h; k.yawVis = k.net.h; }
}
// every frame for a kart that somebody else drives: glide it toward where they said it is (a little ahead of the last message)
export function updateRemote(k, dt, tr) {
  const n = k.net; if (!n) return; const age = Math.min(.3, (performance.now() - n.t) / 1000), tx = n.x + n.vx * age, tz = n.z + n.vz * age, e = Math.min(1, dt * 12), dx = tx - k.p.x, dz = tz - k.p.z;
  if (dx * dx + dz * dz > 900) { k.p.x = tx; k.p.z = tz; } else { k.p.x += dx * e; k.p.z += dz * e; }
  k.y += (n.y - k.y) * Math.min(1, dt * 14); k.p.y = k.y; k.h += angDiff(n.h, k.h) * Math.min(1, dt * 14); k.vx = n.vx; k.vz = n.vz; k.vf = n.vf;
  const f = n.f; k.boostT = f & 1 ? .3 : 0; k.spinT = f & 2 ? .5 : 0; k.shield = f & 4 ? 1 : 0; k.star = f & 8 ? 1 : 0; k.air = !!(f & 16); k.tricked = !!(f & 32); k.drift.on = n.dd !== 0; k.drift.dir = n.dd; k.drift.tier = n.tier; k.in.steer = n.steer; k.dist = n.dist; k.lap = Math.floor(n.dist / tr.length + 1e-6);
  if (k.spinT > 0) k.yawVis += dt * 13; else k.yawVis += angDiff(k.h, k.yawVis) * Math.min(1, dt * 14);
}

// ---------------------------------------------------------------- the room
const setStatus = s => { ON.status = s; if (A) A.lobbyChanged(); };
function reset() { ON.active = false; ON.role = 'none'; ON.pid = 0; ON.code = ''; ON.roster = []; ON.racing = false; ON.cfg = null; ON.status = ''; }
export function leave() { try { if (net) net.close(); } catch (e) {} net = null; reset(); }
export function host(profile, cfg) {
  leave();
  return new Promise((resolve, reject) => {
    const attempt = n => {
      const nt = new Net(NETMODE), code = makeCode();
      nt.host(code).then(() => {
        net = nt; ON.active = true; ON.role = 'host'; ON.pid = 0; ON.code = code; ON.racing = false; ON.cfg = cfg; ON.roster = [{ pid: 0, name: clean(profile.name), color: profile.color, cls: profile.cls, hat: profile.hat }];
        net.onmsg = hostMsg; net.onjoin = () => {}; net.onleave = pid => { ON.roster = ON.roster.filter(r => r.pid !== pid); if (ON.racing) { net.hostBroadcast({ t: 'left', id: pid }); if (A) A.removeKart(pid); } else sendRoster(); if (A) A.lobbyChanged(); };
        resolve(code);
      }).catch(e => { try { nt.close(); } catch (x) {} if (e && e.type === 'unavailable-id' && n < 4) attempt(n + 1); else reject(e); });
    };
    attempt(0);
  });
}
export function join(code, profile) {
  leave(); const nt = new Net(NETMODE); net = nt; ON.role = 'client'; ON.code = code; ON.active = true; ON.status = 'Connecting...';
  nt.onmsg = (_, m) => clientMsg(m); nt.onclose = () => { if (net === nt) { const wasRacing = ON.racing; leave(); if (A) A.disconnected('The host left the room.'); } };
  return nt.join(code).then(() => { nt.clientSend({ t: 'hello', name: clean(profile.name), color: profile.color, cls: profile.cls, hat: profile.hat }); setStatus('Joined. Waiting for the host...'); }).catch(e => { if (net === nt) { try { nt.close(); } catch (x) {} net = null; reset(); } throw e; });
}
function sendRoster() { if (net && ON.role === 'host') net.hostBroadcast({ t: 'roster', roster: ON.roster, cfg: ON.cfg }); }
export function setCfg(cfg) { ON.cfg = cfg; sendRoster(); }
export function hostStart(cfg, bots) {   // bots = [{ id, name, color, cls, hat, lane }] already chosen by the game
  if (!net || ON.role !== 'host') return null; ON.cfg = cfg; ON.racing = true;
  const grid = ON.roster.map(r => ({ id: r.pid, name: r.name, color: r.color, cls: r.cls, hat: r.hat, bot: false })).concat(bots.map(b => ({ id: b.id, name: b.name, color: b.color, cls: b.cls, hat: b.hat, bot: true, lane: b.lane })));
  for (let i = grid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [grid[i], grid[j]] = [grid[j], grid[i]]; }
  const msg = { t: 'start', grid, cfg }; net.hostBroadcast(msg); return msg;
}
export function hostLobby() { if (net && ON.role === 'host') { ON.racing = false; net.hostBroadcast({ t: 'lobby', roster: ON.roster, cfg: ON.cfg }); } }
function hostMsg(pid, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello') {
    if (ON.racing) { net.hostSend(pid, { t: 'busy' }); setTimeout(() => net && net.kick(pid), 300); return; }
    ON.roster = ON.roster.filter(r => r.pid !== pid); ON.roster.push({ pid, name: clean(m.name), color: +m.color || 0xff4a4a, cls: String(m.cls || 'balanced').slice(0, 12), hat: String(m.hat || 'none').slice(0, 12) });
    net.hostSend(pid, { t: 'welcome', pid, roster: ON.roster, cfg: ON.cfg }); sendRoster(); if (A) A.lobbyChanged();
  } else if (m.t === 'k' || m.t === 'use') { net.hostBroadcast(m, pid); common(m); }
}
function clientMsg(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'welcome': ON.pid = m.pid; ON.roster = m.roster || []; ON.cfg = m.cfg; setStatus(''); break;
    case 'roster': ON.roster = m.roster || []; ON.cfg = m.cfg; if (A) A.lobbyChanged(); break;
    case 'lobby': ON.roster = m.roster || ON.roster; ON.cfg = m.cfg || ON.cfg; ON.racing = false; if (A) A.showLobby(); break;
    case 'start': ON.racing = true; ON.cfg = m.cfg; if (A) A.startNet(m); break;
    case 'k': case 'use': common(m); break;
    case 'left': if (A) A.removeKart(m.id); break;
    case 'busy': leave(); if (A) A.disconnected('That race has already started. Try again in a minute.'); break;
    case 'full': leave(); if (A) A.disconnected('That room is full (6 players).'); break;
    case 'kick': leave(); if (A) A.disconnected('You were removed from the room.'); break;
  }
}
function common(m) {
  if (!A) return; const race = A.getRace(); if (!race) return;
  if (m.t === 'k') { for (const a of m.l || []) { const k = Array.isArray(a) ? race.karts.find(k => k.netId === a[0]) : null; if (k && k.remote) decode(k, a); } } else if (m.t === 'use') A.applyUse(m);
}

// ---------------------------------------------------------------- during the race
export function tick(dt, race) {
  if (!ON.active || !net || !race) return; sendT -= dt; if (sendT > 0) return; sendT = 1 / 15;
  const mine = race.karts.filter(k => !k.remote); if (!mine.length) return; const msg = { t: 'k', l: mine.map(encode) };
  if (ON.role === 'host') net.hostBroadcast(msg); else net.clientSend(msg);
}
export function sendUse(k, it, tg) {
  if (!ON.active || !net) return; const m = { t: 'use', id: k.netId, it, x: rd(k.p.x), z: rd(k.p.z), y: rd(k.y), h: rd(k.h, 3), vf: rd(k.vf, 1), tg: tg || [] };
  if (ON.role === 'host') net.hostBroadcast(m); else net.clientSend(m);
}
