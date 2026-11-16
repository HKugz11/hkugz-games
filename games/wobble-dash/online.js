// WOBBLE DASH - online races. One player hosts a room (5-letter code) and up to seven friends join with it. Everybody runs their own bean and sends where it is about
// 15 times a second. The host also runs the bot racers, keeps the race clock, decides when a round is over and relays everything to the others. The courses move by the
// race clock, so every machine shows the same hazards at the same time. Players connect directly (WebRTC); the free PeerJS Cloud service is only used to introduce them.
// For testing, ?net=local links two tabs of one browser through a BroadcastChannel instead.
import { Net, makeCode, cleanCode, MAX_PLAYERS } from './net.js?v=15';
import { NETMODE, angDiff } from './core.js?v=15';

export { cleanCode, MAX_PLAYERS };
export const ON = { active: false, role: 'none', pid: 0, code: '', roster: [], racing: false, cfg: null, status: '', lat: .04 };
let net = null, A = null, sendT = 0, pingT = 0;
export const init = api => { A = api; };
const rd = (n, d = 2) => { const m = Math.pow(10, d); return Math.round(n * m) / m; };
const clean = s => String(s == null ? '' : s).replace(/[^\w \-]/g, '').trim().slice(0, 12);
const num = (x, lim = 4000) => { x = +x; return Number.isFinite(x) ? Math.max(-lim, Math.min(lim, x)) : 0; };
const PAL = [0xff4fa8, 0x2ee6ff, 0xffd31a, 0x8aff3a, 0xb06bff, 0xff7a1a, 0xffffff, 0x4a6aff, 0xff4a4a, 0x40e0b0];

// ---------------------------------------------------------------- a racer on the wire: [id, x, y, z, vx, vz, yaw, flags, finishTime, falls]
export function encode(r) {
  const f = (r.alive ? 1 : 0) | (r.onGround ? 2 : 0) | (r.prone > 0 ? 4 : 0) | (r.stun > 0 ? 8 : 0) | (r.finished ? 16 : 0) | (r.celebrate > 0 ? 32 : 0);
  return [r.id, rd(r.pos.x), rd(r.pos.y), rd(r.pos.z), rd(r.vel.x, 1), rd(r.vel.z, 1), rd(r.yaw), f, rd(r.finishT || 0, 2), r.falls | 0];
}
export function decode(r, a) {
  if (!Array.isArray(a) || a.length < 10) return;
  r.net = { x: num(a[1]), y: num(a[2], 500), z: num(a[3]), vx: num(a[4], 60), vz: num(a[5], 60), yaw: num(a[6], 20), f: a[7] | 0, t: performance.now() };
  r.rawState = [r.id, a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9]]; r.falls = a[9] | 0;
  if ((r.net.f & 16) && !r.finished) { r.finished = true; r.finishT = Math.max(0, num(a[8], 1000)); r.justFinished = true; }
  if (!r.netInit) { r.netInit = true; r.pos.set(r.net.x, r.net.y, r.net.z); r.yaw = r.net.yaw; }
}
// every frame for a racer that somebody else drives: glide it toward where they said it is (a little ahead of the last message)
export function updateRemote(r, dt) {
  const n = r.net; if (!n) return; const f = n.f, age = Math.min(.25, (performance.now() - n.t) / 1000), was = r.alive; r.alive = !!(f & 1);
  const tx = n.x + n.vx * age, tz = n.z + n.vz * age, e = Math.min(1, dt * 14), dx = tx - r.pos.x, dz = tz - r.pos.z;
  if (dx * dx + dz * dz > 36 || Math.abs(n.y - r.pos.y) > 7 || (r.alive && !was)) { r.pos.set(tx, n.y, tz); r.vel.y = 0; }
  else { const oy = r.pos.y; r.pos.x += dx * e; r.pos.z += dz * e; r.pos.y += (n.y - oy) * Math.min(1, dt * 16); r.vel.y = (r.pos.y - oy) / Math.max(dt, 1e-3); }
  r.vel.x = n.vx; r.vel.z = n.vz; r.onGround = !!(f & 2); r.prone = f & 4 ? .3 : 0; r.stun = f & 8 ? .3 : 0; r.celebrate = f & 32 ? 1 : 0; r.yaw += angDiff(n.yaw, r.yaw) * Math.min(1, dt * 14);
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
        net = nt; ON.active = true; ON.role = 'host'; ON.pid = 0; ON.code = code; ON.racing = false; ON.cfg = cfg; ON.roster = [{ pid: 0, name: clean(profile.name) || 'Bean', color: profile.color, tuft: profile.tuft | 0 }];
        net.onmsg = hostMsg; net.onjoin = () => {};
        net.onleave = pid => { ON.roster = ON.roster.filter(r => r.pid !== pid); if (ON.racing) net.hostBroadcast({ t: 'left', id: pid }); if (A) A.playerLeft(pid, ON.racing); if (!ON.racing) sendRoster(); if (A) A.lobbyChanged(); };
        resolve(code);
      }).catch(e => { try { nt.close(); } catch (x) {} if (e && e.type === 'unavailable-id' && n < 4) attempt(n + 1); else reject(e); });
    };
    attempt(0);
  });
}
export function join(code, profile) {
  leave(); const nt = new Net(NETMODE); net = nt; ON.role = 'client'; ON.code = code; ON.active = true; ON.status = 'Connecting...';
  nt.onmsg = (_, m) => clientMsg(m); nt.onclose = () => { if (net === nt) { leave(); if (A) A.disconnected('The host left the room.'); } };
  return nt.join(code).then(() => { nt.clientSend({ t: 'hello', name: clean(profile.name), color: profile.color, tuft: profile.tuft | 0 }); setStatus('Joined. Waiting for the host...'); }).catch(e => { if (net === nt) { try { nt.close(); } catch (x) {} net = null; reset(); } throw e; });
}
function sendRoster() { if (net && ON.role === 'host') net.hostBroadcast({ t: 'roster', roster: ON.roster, cfg: ON.cfg }); }
export function setCfg(cfg) { ON.cfg = cfg; sendRoster(); }
export function hostStart(msg) { if (!net || ON.role !== 'host') return; ON.racing = true; ON.cfg = msg.cfg || ON.cfg; net.hostBroadcast(msg); }
export function hostEnd(msg) { if (net && ON.role === 'host') net.hostBroadcast(msg); }
export function hostLobby() { if (net && ON.role === 'host') { ON.racing = false; net.hostBroadcast({ t: 'lobby', roster: ON.roster, cfg: ON.cfg }); } }
export function humans() { return ON.roster.length; }
function hostMsg(pid, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello') {
    if (ON.racing) { net.hostSend(pid, { t: 'busy' }); setTimeout(() => net && net.kick(pid), 300); return; }
    let name = clean(m.name) || 'Bean', color = +m.color || PAL[pid % PAL.length], k = 2; const base = name;
    while (ON.roster.some(r => r.name === name && r.pid !== pid)) name = base.slice(0, 10) + ' ' + k++;
    if (ON.roster.some(r => r.color === color && r.pid !== pid)) color = PAL.find(c => !ON.roster.some(r => r.color === c)) || color;
    ON.roster = ON.roster.filter(r => r.pid !== pid); ON.roster.push({ pid, name, color, tuft: (m.tuft | 0) & 3 });
    net.hostSend(pid, { t: 'welcome', pid, roster: ON.roster, cfg: ON.cfg }); sendRoster(); if (A) A.lobbyChanged();
  } else if (m.t === 'p') { const race = A && A.getRace(); if (!race || !Array.isArray(m.s)) return; m.s[0] = pid; const r = race.racers.find(r => r.id === pid && r.remote); if (r) decode(r, m.s); }
  else if (m.t === 'ping') net.hostSend(pid, { t: 'pong', c: m.c, ck: A && A.getRace() ? A.getRace().clock : 0 });
}
function clientMsg(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'welcome': ON.pid = m.pid | 0; ON.roster = m.roster || []; ON.cfg = m.cfg; setStatus(''); break;
    case 'roster': ON.roster = m.roster || []; ON.cfg = m.cfg; if (A) A.lobbyChanged(); break;
    case 'lobby': ON.roster = m.roster || ON.roster; ON.cfg = m.cfg || ON.cfg; ON.racing = false; if (A) A.showLobby(); break;
    case 'start': ON.racing = true; ON.cfg = m.cfg || ON.cfg; if (A) A.startNet(m); break;
    case 'end': if (A) A.endNet(m); break;
    case 's': { const race = A && A.getRace(); if (!race) break; for (const a of m.l || []) { if (!Array.isArray(a) || a[0] === ON.pid) continue; const r = race.racers.find(r => r.id === a[0] && r.remote); if (r) decode(r, a); } if (A) A.syncClock(+m.ck || 0); break; }
    case 'pong': { const rtt = (performance.now() - (+m.c || 0)) / 1000; if (rtt > 0 && rtt < 3) ON.lat = ON.lat * .6 + (rtt / 2) * .4; break; }
    case 'left': if (A) A.playerLeft(m.id, true); break;
    case 'busy': leave(); if (A) A.disconnected('That race has already started. Try again in a minute.'); break;
    case 'full': leave(); if (A) A.disconnected('That room is full (' + MAX_PLAYERS + ' players).'); break;
    case 'kick': leave(); if (A) A.disconnected('You were removed from the room.'); break;
  }
}

// ---------------------------------------------------------------- during the race: clients send their own bean, the host sends everybody (so every machine sees the same field)
export function tick(dt, race) {
  if (!ON.active || !net || !race) return; sendT -= dt; pingT -= dt;
  if (ON.role === 'client' && pingT <= 0) { pingT = 1.5; net.clientSend({ t: 'ping', c: performance.now() }); }
  if (sendT > 0) return; sendT = 1 / 15;
  if (ON.role === 'host') net.hostBroadcast({ t: 's', ck: rd(race.clock, 3), l: race.racers.map(r => r.remote ? r.rawState : encode(r)).filter(Boolean) });
  else { const me = race.racers.find(r => !r.remote); if (me) net.clientSend({ t: 'p', s: encode(me) }); }
}
