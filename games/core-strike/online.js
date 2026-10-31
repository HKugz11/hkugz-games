// Core Strike online play.
//   * The HOST runs the match: bots, rounds, money, the bomb, grenades and all damage.
//   * Everyone else is a CLIENT: they move and aim on their own machine, send what they shoot, and
//     draw the match from the snapshots the host sends 20 times a second.
//   * Data goes peer-to-peer (WebRTC through PeerJS). PeerJS Cloud is only used to introduce players.
import { Net, makeCode, cleanCode, MAX_PLAYERS } from './net.js?v=49';

export function createOnline(X) {
  const { GS, MP, S, WD, $ } = X;
  const WID = Object.keys(WD);
  const SL = ['prim', 'sec', 'knife', 'nade'], NS = ['he', 'flash', 'smoke', 'molly'];
  const STATES = ['menu', 'freeze', 'live', 'end', 'over'], CST = ['none', 'carried', 'dropped', 'planted', 'boom', 'defused'];
  const wi = (id) => WID.indexOf(id);
  const r2 = (v) => Math.round(v * 100) / 100;
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  const cleanName = (s) => String(s || '').replace(/[^A-Za-z0-9 _\-]/g, '').trim().slice(0, 12) || 'Player';
  const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
  const LOCAL = new URLSearchParams(location.search).get('net') === 'local';

  let net = null, L = null, myPid = 0, lastAct = '', accSnap = 0, accMe = 0, lastSnapT = 0, nidCounter = 0, graceUntil = 0;
  const say = (t, bad) => { const el = $('onMsg'); el.textContent = t || ''; el.style.color = bad ? '#ff8a7a' : '#9dffb0'; };
  const bcast = (m, except = -1) => { if (net && MP.role === 'host') net.hostBroadcast(m, except); };
  const actorOfPid = (pid) => GS.actors.find((a) => a.pid === pid && a.human);

  // ======================================================================= lobby UI
  function show(stage) { $('onHome').classList.toggle('hidden', stage !== 'home'); $('onLobby').classList.toggle('hidden', stage !== 'lobby'); }
  function openPanel() { $('onlineP').classList.remove('hidden'); $('onName').value = S.name || ''; show(L ? 'lobby' : 'home'); if (L) renderLobby(); }
  function closePanel() { $('onlineP').classList.add('hidden'); }
  function cfgFromS() { return { map: S.map, mode: S.mode === 'dm' ? 'dm' : 'comp', length: S.length, diff: S.diff, arsenal: S.arsenal === 'simple' ? 'simple' : 'pro', ranked: S.ranked === 'off' ? 'off' : 'on', bomb: S.bomb === 'player' ? 'player' : 'random' }; }
  function summary(c) {
    const mp = X.MAP_LIST.find((m) => m.id === c.map);
    return `${mp ? mp.name : c.map} · ${c.mode === 'dm' ? 'Deathmatch' : 'Competitive'} · ${({ short: 'short', long: 'full', duper: 'duper long (20 rounds)' })[c.length] || 'full'} match · bots: ${({ easy: 'Chill', normal: 'Normal', hard: 'Sweaty', insane: 'Pro' })[c.diff] || c.diff} · ${c.arsenal === 'simple' ? 'simple guns' : 'all guns'}${c.mode === 'dm' ? '' : (c.ranked === 'off' ? ' · unranked' : ' · ranked') + (c.bomb === 'player' ? ' · a real player always carries the bomb' : '')}`;
  }
  // the line under the teams: does this match change your rank, and what is your rank now
  function rankNote() {
    if (!L) return '';
    const c = L.cfg, n = L.players.length;
    const why = c.mode === 'dm' ? 'Deathmatch never counts for rank.'
      : c.ranked === 'off' ? 'Unranked: this match will not change anyone\'s rank.'
        : n < 2 ? 'Ranked matches with friends need 2 or more real players. Share the room code first.'
          : `This match counts for everyone's rank (${n} real players, bots fill the rest). Leaving early counts as a loss.`;
    return `<div id="onRankBadge">${X.rankBadgeHTML()}</div><div>${why}</div>`;
  }
  function renderLobby() {
    if (!L) return;
    const host = MP.role === 'host';
    $('onShow').textContent = L.code;
    for (const sq of [0, 1]) {
      const ps = L.players.filter((p) => p.sq === sq);
      $('teamL' + sq).innerHTML = ps.map((p) => `<div class="pl${p.pid === myPid ? ' me' : ''}">${p.name}${p.pid === 0 ? ' <small>(host)</small>' : ''}${p.pid === myPid ? ' <small>(you)</small>' : ''}</div>`).join('') +
        `<div class="pl bots">+ ${5 - ps.length} bot${5 - ps.length === 1 ? '' : 's'}</div>`;
    }
    $('onCfg').classList.toggle('hidden', !host);
    $('onSummary').classList.toggle('hidden', host);
    $('onSummary').textContent = summary(L.cfg);
    $('onRank').innerHTML = rankNote();
    $('onStart').classList.toggle('hidden', !host);
    $('onStatus').textContent = host ? `${L.players.length} of ${MAX_PLAYERS} players in the room. Share the code with friends, then press START.` : 'Waiting for the host to start…';
  }
  function broadcastLobby() {
    if (!net || MP.role !== 'host') return;
    for (const p of L.players) if (p.pid !== 0) net.hostSend(p.pid, { t: 'lobby', code: L.code, players: L.players, cfg: L.cfg, you: p.pid });
    renderLobby();
  }
  function teamCount(sq) { return L.players.filter((p) => p.sq === sq).length; }

  // ======================================================================= host / join
  // PeerJS (93 KB) is only fetched when someone actually opens online play, so the game itself loads lighter
  let peerLoading = null;
  function loadPeer() {
    if (LOCAL || window.Peer) return Promise.resolve();
    return peerLoading || (peerLoading = new Promise((res, rej) => {
      const el = document.createElement('script'); el.src = 'vendor/peerjs.min.js'; el.onload = res; el.onerror = () => { peerLoading = null; rej(new Error('could not load online play')); }; document.head.appendChild(el);
    }));
  }
  async function host() {
    S.name = cleanName($('onName').value); X.saveS();
    leaveNet(); say('Creating a room…');
    try { await loadPeer(); } catch (e) { say('Could not load online play. Check your internet and try again.', true); return; }
    for (let tries = 0; tries < 4; tries++) {
      const code = makeCode();
      try {
        net = new Net(LOCAL ? 'local' : 'peer');
        await net.host(code);
        MP.role = 'host'; MP.on = false; myPid = 0; MP.pid = 0;
        if (S.mode !== 'dm') S.mode = 'comp';
        L = { code, players: [{ pid: 0, name: S.name, sq: 0 }], cfg: cfgFromS() };
        net.onjoin = () => {}; net.onmsg = hostMsg; net.onleave = hostLeave;
        say(''); show('lobby'); X.syncSeg(); renderLobby(); return;
      } catch (e) { try { net.close(); } catch (x) {} net = null; if (!(e && e.type === 'unavailable-id')) { say('Could not create a room: ' + (e && (e.type || e.message) || 'network error') + '. Try again.', true); return; } }
    }
    say('Could not find a free room code. Try again.', true);
  }
  async function join() {
    const code = cleanCode($('onCode').value);
    if (code.length !== 5) { say('Type the 5 letter room code from your friend.', true); return; }
    S.name = cleanName($('onName').value); X.saveS();
    leaveNet(); say('Connecting…');
    try { await loadPeer(); } catch (e) { say('Could not load online play. Check your internet and try again.', true); return; }
    try {
      net = new Net(LOCAL ? 'local' : 'peer');
      net.onmsg = (pid, d) => clientMsg(d);
      // (when the HOST leaves it is not your fault: no rank change, so rankDone is set before toMenu would count it as you quitting)
      net.onclose = () => { const wasOn = MP.on; leaveNet(); if (wasOn) { GS.rankDone = true; X.toMenu(); } L = null; openPanel(); say(wasOn ? 'The host left the game.' : 'The host closed the room.', true); };
      await net.join(code);
      MP.role = 'client'; MP.on = false;
      net.clientSend({ t: 'hello', name: S.name });
      say(''); show('lobby'); $('onShow').textContent = code;
    } catch (e) {
      try { net && net.close(); } catch (x) {} net = null; MP.role = 'none';
      say(e && e.type === 'peer-unavailable' ? 'No room with that code. Check it and try again.' : 'Could not connect (' + ((e && (e.type || e.message)) || 'network') + ').', true);
    }
  }
  function leaveNet() { try { if (net) { net.onclose = () => {}; net.close(); } } catch (e) {} net = null; L = null; MP.role = 'none'; MP.on = false; MP.idx = -1; lastAct = ''; }
  function leave() { const was = MP.on || !!L; leaveNet(); closePanel(); return was; }

  // ----------------------------------------------------------------------- lobby messages (host side)
  function lobbyMsg(pid, d) {
    if (d.t === 'hello') {
      if (L.players.some((p) => p.pid === pid)) return;
      const sq = teamCount(0) <= teamCount(1) ? 0 : 1;
      if (teamCount(sq) >= 5) { net.hostSend(pid, { t: 'full' }); return; }
      L.players.push({ pid, name: cleanName(d.name), sq }); broadcastLobby();
    } else if (d.t === 'team') {
      const p = L.players.find((q) => q.pid === pid); const sq = d.sq === 1 ? 1 : 0;
      if (p && p.sq !== sq && teamCount(sq) < 5) { p.sq = sq; broadcastLobby(); }
    }
  }
  function hostLeave(pid) {
    if (L) L.players = L.players.filter((p) => p.pid !== pid);
    if (!MP.on) { if (L) broadcastLobby(); return; }
    const a = actorOfPid(pid); if (!a) return;
    // a bot takes over for a player who left
    a.human = false; a.remote = false; a.pid = -1; X.botTakeover(a); a.name = a.name.slice(0, 9) + ' (bot)';
    X.feedText(`${a.name} took over`); X.makeSoldier(a);
  }
  function hostMsg(pid, d) {
    if (!d || typeof d.t !== 'string') return;
    if (!MP.on) { if (L) lobbyMsg(pid, d); return; }
    if (d.t === 'hello') { net.hostSend(pid, { t: 'busy' }); setTimeout(() => net && net.kick(pid), 100); return; }
    const a = actorOfPid(pid); if (!a) return;
    switch (d.t) {
      case 'me': {
        if (!a.alive || !Array.isArray(d.p)) return;
        a.pos.set(clampN(num(d.p[0]), -2, X.worldW + 2), clampN(num(d.p[1]), -1, 30), clampN(num(d.p[2]), -2, X.worldH + 2));   // stay inside THIS map (the big maps are well over 100 m wide)
        a.vel.set(num(d.v && d.v[0]), 0, num(d.v && d.v[1])); a.yaw = num(d.y); a.pitch = clampN(num(d.a), -1.6, 1.6);
        const f = d.f | 0; a.crouch = !!(f & 1); a.sprint = !!(f & 2); a.walk = !!(f & 4); a.onGround = !!(f & 8); a.scoped = (f >> 4) & 3;
        const sl = SL[d.s | 0]; if (sl && X.slotOK(a, sl)) a.slot = sl;
        const ns = NS[d.n | 0]; if (ns && a.nades[ns] > 0) a.nadeSel = ns;
        break;
      }
      case 'shot': {
        const id = WID[d.w | 0], def = WD[id]; if (!def || !a.alive || !Array.isArray(d.o) || !Array.isArray(d.d)) return;
        const o = [num(d.o[0]), num(d.o[1]), num(d.o[2])], dir = [num(d.d[0]), num(d.d[1]), num(d.d[2])];
        X.remoteShotFx(a, id, o, dir);
        net.hostBroadcast({ t: 'shot', i: a.idx, w: d.w | 0, o, d: dir }, pid);
        break;
      }
      case 'hit': hostHit(pid, a, d); break;
      case 'nade': {
        const ty = NS[d.ty | 0]; if (!ty || !a.alive || a.nades[ty] <= 0 || !Array.isArray(d.p) || !Array.isArray(d.v)) return;
        a.nades[ty]--;
        const p = [num(d.p[0]), num(d.p[1]), num(d.p[2])], v = [clampN(num(d.v[0]), -30, 30), clampN(num(d.v[1]), -30, 30), clampN(num(d.v[2]), -30, 30)];
        X.spawnNade(a, ty, p, v, num(d.id), false);
        net.hostBroadcast({ t: 'nade', i: a.idx, ty: d.ty | 0, p, v, id: num(d.id) }, pid);
        break;
      }
      case 'ping': {   // a teammate pinged a spot: check it, show it here (if it is for our team) and pass it on to that player's teammates
        const k = PKINDS.includes(d.k) ? d.k : 'here';
        if (!a.alive || !Array.isArray(d.p) || GS.time - (a.pingT || -9) < 0.7) break;
        const p = [clampN(num(d.p[0]), -2, X.worldW + 2), clampN(num(d.p[1]), -1, 40), clampN(num(d.p[2]), -2, X.worldH + 2)];
        a.pingT = GS.time; X.addPing(a, p, k); relayPing(a, p, k); break;
      }
      case 'undo': { if (a.alive && X.inBuyZone(a) && X.undoBuy(a)) sendLoadout(a); else net.hostSend(pid, loadoutMsg(a)); break; }
      case 'buy': { if (typeof d.id === 'string' && a.alive && X.inBuyZone(a) && X.buy(a, d.id)) sendLoadout(a); else net.hostSend(pid, loadoutMsg(a)); break; }
      case 'act': {
        if (!d.on) { a.act = null; break; }
        const c = GS.core;
        if (d.type === 'plant' && GS.mode === 'comp' && GS.state === 'live' && a.alive && a.side === 0 && c.carrier === a && X.plantSite(a.pos.x, a.pos.z)) a.act = { type: 'plant', t: 0, need: 3.2 };
        else if (d.type === 'defuse' && GS.mode === 'comp' && GS.state === 'live' && a.alive && a.side === 1 && c.state === 'planted' && a.pos.distanceTo(c.pos) < 2) a.act = { type: 'defuse', t: 0, need: a.kit ? 5 : 10 };
        break;
      }
    }
  }
  // a client says "my shot hit X": the host works out the damage itself
  function hostHit(pid, k, d) {
    const v = GS.actors[d.i | 0], wid = typeof d.w === 'string' ? d.w : '', def = WD[wid];
    if (!v || !def || !k.alive || !v.alive || v === k || v.side === k.side) return;
    const cur = X.curW(k); if (!cur || cur.id !== wid) return;
    const now = performance.now() / 1000, pel = def.pellets || 1;
    k.tok = Math.min(pel * 3 + 3, (k.tok === undefined ? pel * 3 + 3 : k.tok) + (now - (k.tokT || now)) * Math.max(def.rpm / 60, 1.5) * pel * 1.6); k.tokT = now;
    if (k.tok < 1) return; k.tok -= 1;
    const e = X.eyePos(k), c = X.chestPos(v), dist = Math.hypot(e.x - c.x, e.y - c.y, e.z - c.z);
    if (dist > (def.melee ? 4 : 260)) return;
    const part = d.p === 'head' ? 'head' : d.p === 'legs' ? 'legs' : 'body';
    let dmg;
    if (def.melee) dmg = clampN(num(d.a), 1, 200);
    else dmg = X.shotDamage(def, part, dist);
    const dir = X.V3(v.pos.x - k.pos.x, 0, v.pos.z - k.pos.z).normalize();
    X.damage(v, dmg, k, part, wid, dir);
  }

  // ======================================================================= start of a match
  function startHost() {
    if (MP.role !== 'host' || !L) return;
    L.cfg = cfgFromS(); X.syncSeg();
    const used = new Set(L.players.map((p) => p.name.toLowerCase()));
    const botNames = X.shuffle(X.NAMES.filter((n) => !used.has(n.toLowerCase())));
    const slots = L.players.map((p) => ({ n: p.name, sq: p.sq, pid: p.pid }));
    for (const sq of [0, 1]) { const need = 5 - L.players.filter((p) => p.sq === sq).length; for (let i = 0; i < need; i++) slots.push({ n: botNames.pop() || 'Bot' + i, sq, bot: true }); }
    const cfg = { ...L.cfg, slots };
    for (const p of L.players) if (p.pid !== 0) net.hostSend(p.pid, { t: 'start', cfg, idx: slots.findIndex((s) => s.pid === p.pid) });
    closePanel();
    X.startMatchMP(cfg, slots.findIndex((s) => s.pid === 0), 'host');
  }
  function backToLobby() {
    if (MP.role === 'host') { if (!net) return; bcast({ t: 'back' }); returnToLobby(); }
  }
  function returnToLobby() {
    MP.on = false; X.resetToMenu();
    if (L) { openPanel(); }
  }

  // ======================================================================= host: things the game tells us about
  function hostTick(dt) {
    accSnap += dt;
    if (accSnap >= 0.05) { accSnap = 0; sendSnapshot(); }
    for (const a of GS.actors) if (a.remote && a.alive && !a.walk) X.footsteps(a, dt);
  }
  function sendSnapshot() {
    const c = GS.core;
    const A = GS.actors.map((a) => [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), r2(a.yaw), r2(a.pitch), Math.round(a.hp), Math.round(a.armor),
      (a.alive ? 1 : 0) | (a.crouch ? 2 : 0) | (a.sprint ? 4 : 0) | (a.helmet ? 8 : 0) | (a.kit ? 16 : 0) | (a.onGround ? 32 : 0) | (a.act && a.act.type === 'plant' ? 64 : 0) | (a.act && a.act.type === 'defuse' ? 128 : 0) | (((a.scoped || 0) & 3) << 8),
      Math.max(0, SL.indexOf(a.slot)), a.prim ? wi(a.prim.id) : -1, a.sec ? wi(a.sec.id) : -1, Math.max(0, NS.indexOf(a.nadeSel)), a.kills, a.deaths, Math.round(a.dmg), a.hs, a.money, a.side]);
    net.hostBroadcast({ t: 's', st: STATES.indexOf(GS.state), pt: r2(GS.phaseT), rt: r2(GS.roundT), bl: r2(GS.buyLeft), r: GS.round, sc: GS.score, ls: GS.loss, ex: GS.execute ? 1 : 0, pl: GS.plan,
      c: [CST.indexOf(c.state), c.carrier ? c.carrier.idx : -1, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), r2(c.timer), c.site || ''], a: A });
  }
  function loadoutMsg(a) {
    return { t: 'load', p: a.prim ? [wi(a.prim.id), a.prim.mag, a.prim.res] : null, s: a.sec ? [wi(a.sec.id), a.sec.mag, a.sec.res] : null,
      n: [a.nades.he, a.nades.flash, a.nades.smoke, a.nades.molly], ar: Math.round(a.armor), hl: a.helmet ? 1 : 0, kt: a.kit ? 1 : 0, sl: Math.max(0, SL.indexOf(a.slot)), ns: Math.max(0, NS.indexOf(a.nadeSel)), mo: a.money };
  }
  function sendLoadout(a) { if (net && a.remote) net.hostSend(a.pid, loadoutMsg(a)); }
  // pings go to the pinger's own teammates only (enemies must not see where your team is looking)
  const PKINDS = ['here', 'enemy', 'bomb'];
  function relayPing(a, p, k) { if (!net) return; for (const r of GS.actors) if (r.remote && r !== a && r.side === a.side) net.hostSend(r.pid, { t: 'pg', i: a.idx, p: [r2(p[0]), r2(p[1]), r2(p[2])], k }); }
  function pingOut(a, pos, k) { relayPing(a, [pos.x, pos.y, pos.z], k); }   // the host's own ping
  function clientPing(pos, k) { if (net) net.clientSend({ t: 'ping', p: [r2(pos.x), r2(pos.y), r2(pos.z)], k }); }
  function roundStart(half) {
    const lastRound = GS.round === GS.maxRounds, match = GS.score[0] === GS.target - 1 || GS.score[1] === GS.target - 1;
    for (const a of GS.actors) if (a.remote) {
      net.hostSend(a.pid, { t: 'rs', r: GS.round, half: half ? 1 : 0, last: lastRound ? 1 : 0, match: match ? 1 : 0, sd: a.side, sp: [r2(a.pos.x), r2(a.pos.z), r2(a.yaw)], core: GS.core.carrier ? GS.core.carrier.idx : -1 });
      sendLoadout(a);
    }
  }
  function spawn(a) { if (net && a.remote) { net.hostSend(a.pid, { t: 'sp', p: [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z)], y: r2(a.yaw), sd: a.side }); sendLoadout(a); } }
  function hurt(v, dmg, att, head) { if (net && v.remote) net.hostSend(v.pid, { t: 'hurt', d: r2(dmg), f: att ? att.idx : -1, h: head ? 1 : 0 }); }
  function killEvent(v, k, wid, hs) { bcast({ t: 'k', v: v.idx, k: k ? k.idx : -1, w: wi(wid), hs: hs ? 1 : 0, rk: k ? k.roundKills : 0 }); }
  function money(a, amt, why) { if (net && a.remote) net.hostSend(a.pid, { t: '$', a: amt, w: why }); }
  function shotFx(a, wid, o, d) { if (net) bcast({ t: 'shot', i: a.idx, w: wi(wid), o: [r2(o.x), r2(o.y), r2(o.z)], d: [r2(d.x), r2(d.y), r2(d.z)] }); }
  function nadeEvent(n) { if (net) bcast({ t: 'nade', i: n.owner.idx, ty: NS.indexOf(n.type), p: [r2(n.x), r2(n.y), r2(n.z)], v: [r2(n.vx), r2(n.vy), r2(n.vz)], id: n.id }); }
  function detEvent(n) { if (net) bcast({ t: 'det', id: n.id, ty: NS.indexOf(n.type), p: [r2(n.x), r2(n.y), r2(n.z)], i: n.owner.idx }); }
  function banner(big, sub, color, ms) { bcast({ t: 'bn', b: big, s: sub, c: color, ms }); }
  function event(e, extra) { bcast({ t: 'ev', e, ...(extra || {}) }); }
  function feedTextEvent(txt) { bcast({ t: 'ft', x: txt }); }
  function roundEnd(winSide, reason) { bcast({ t: 're', w: winSide, y: reason }); }
  function matchEnd() { if (net) { sendSnapshot(); bcast({ t: 'end' }); } }

  // ======================================================================= client side
  function clientMsg(d) {
    if (!d || typeof d.t !== 'string') return;
    switch (d.t) {
      case 'lobby':
        if (d.cfg && !X.MAP_LIST.some((m) => m.id === d.cfg.map)) { say('Your friend picked a map this copy of the game does not have. Refresh the page (Ctrl+Shift+R) and join again.', true); leaveNet(); show('home'); break; }
        L = { code: d.code, players: d.players, cfg: d.cfg }; myPid = d.you; MP.pid = d.you; renderLobby(); break;
      case 'full': say('That room is full.', true); leaveNet(); show('home'); break;
      case 'busy': say('That match already started. Ask your friend to start a new one.', true); leaveNet(); show('home'); break;
      case 'kick': leaveNet(); show('home'); say('You were removed from the room.', true); break;
      case 'start': closePanel(); X.startMatchMP(d.cfg, d.idx | 0, 'client'); break;
      case 'back': returnToLobby(); break;
      case 's': applySnapshot(d); break;
      case 'rs': clientRoundStart(d); break;
      case 'sp': { const P = GS.player; if (!P) break; P.pos.set(num(d.p[0]), num(d.p[1]), num(d.p[2])); P.vel.set(0, 0, 0); P.yaw = num(d.y); P.pitch = 0; P.side = d.sd | 0; X.reviveLocal(); graceUntil = GS.time + 0.7; break; }
      case 'load': applyLoadout(d); break;
      case 'pg': { const a = GS.actors[d.i | 0]; if (a && Array.isArray(d.p)) X.addPing(a, [num(d.p[0]), num(d.p[1]), num(d.p[2])], PKINDS.includes(d.k) ? d.k : 'here'); break; }
      case '$': X.moneyPop(num(d.a), String(d.w || '')); break;
      case 'k': {
        const v = GS.actors[d.v | 0], k = GS.actors[d.k | 0] || null; if (!v) break;
        v.alive = false; v.hp = 0; if (k) k.roundKills = d.rk | 0;
        X.killFx(v, k, WID[d.w | 0] || 'p9', !!d.hs); break;
      }
      case 'hurt': X.hurtLocal(num(d.d), GS.actors[d.f | 0] || null, !!d.h); break;
      case 'shot': { const a = GS.actors[d.i | 0], id = WID[d.w | 0]; if (a && id && a !== GS.player) X.remoteShotFx(a, id, d.o, d.d); break; }
      case 'nade': { const a = GS.actors[d.i | 0], ty = NS[d.ty | 0]; if (a && ty) X.spawnNade(a, ty, d.p, d.v, num(d.id), true); break; }
      case 'det': X.netDetonate(d.id, NS[d.ty | 0] || 'he', d.p, GS.actors[d.i | 0]); break;
      case 'bn': X.banner(String(d.b || ''), String(d.s || ''), String(d.c || '#fff'), num(d.ms, 3000), true); break;
      case 'ft': X.feedText(String(d.x || '')); break;
      case 'ev': X.netEvent(d); break;
      case 're': X.roundEndFx(d.w | 0, String(d.y || '')); break;
      case 'end': X.endMatch(); break;
    }
  }
  function applyLoadout(d) {
    const P = GS.player; if (!P) return;
    P.prim = d.p ? { id: WID[d.p[0]], mag: d.p[1] | 0, res: d.p[2] | 0 } : null;
    P.sec = d.s ? { id: WID[d.s[0]], mag: d.s[1] | 0, res: d.s[2] | 0 } : null;
    if (P.prim && !WD[P.prim.id]) P.prim = null; if (P.sec && !WD[P.sec.id]) P.sec = null;
    P.nades = { he: d.n[0] | 0, flash: d.n[1] | 0, smoke: d.n[2] | 0, molly: d.n[3] | 0 };
    P.armor = num(d.ar); P.helmet = !!d.hl; P.kit = !!d.kt; P.money = num(d.mo, P.money); P.nadeSel = NS[d.ns | 0] || 'he';
    let sl = SL[d.sl | 0] || 'sec'; if (!X.slotOK(P, sl)) sl = P.prim ? 'prim' : P.sec ? 'sec' : 'knife';
    if (P.slot !== sl) { P.slot = sl; P.switchT = 0.35; }
    P.reloadT = 0; X.vmRefresh();
    if (!$('buy').classList.contains('hidden')) X.renderBuy();
  }
  function clientRoundStart(d) {
    const P = GS.player; if (!P) return;
    X.clearWorld(); GS.deathT = 0; GS.round = d.r | 0;
    P.side = d.sd | 0; X.makeSoldier(P);
    P.pos.set(num(d.sp[0]), 0, num(d.sp[1])); P.vel.set(0, 0, 0); P.yaw = num(d.sp[2]); P.pitch = 0;
    X.reviveLocal(); graceUntil = GS.time + 0.7;
    X.roundBannerLocal(!!d.half, !!d.last, !!d.match);
    if (d.core === P.idx) setTimeout(() => X.toast('You carry the BOMB — hold E on a site to plant'), 2500);
  }

  // ----------------------------------------------------------------------- snapshots (client)
  function applySnapshot(m) {
    const P = GS.player; if (!P || !Array.isArray(m.a)) return;
    const now = GS.time, dtS = Math.max(0.03, now - lastSnapT); lastSnapT = now;
    GS.state = STATES[m.st] || GS.state; GS.phaseT = num(m.pt); GS.roundT = num(m.rt); GS.buyLeft = num(m.bl); GS.round = m.r | 0;
    GS.score = [m.sc[0] | 0, m.sc[1] | 0]; GS.loss = [m.ls[0] | 0, m.ls[1] | 0]; GS.execute = !!m.ex; GS.plan = m.pl === 'b' ? 'b' : 'a';
    const c = GS.core; const prevCarrier = c.carrier;
    c.state = CST[m.c[0]] || 'none'; c.carrier = m.c[1] >= 0 ? GS.actors[m.c[1]] || null : null; c.pos.set(num(m.c[2]), num(m.c[3]), num(m.c[4])); c.timer = num(m.c[5]); c.site = m.c[6] || null;
    if (c.carrier === P && prevCarrier !== P) X.toast('You picked up the BOMB');
    for (let i = 0; i < GS.actors.length && i < m.a.length; i++) {
      const a = GS.actors[i], t = m.a[i], f = t[7] | 0, alive = !!(f & 1);
      if (a.side !== (t[17] | 0)) { a.side = t[17] | 0; X.makeSoldier(a); if (a === P) X.sleeveTint(); }
      a.kills = t[12]; a.deaths = t[13]; a.dmg = t[14]; a.hs = t[15]; a.money = t[16];
      a.armor = t[6]; a.helmet = !!(f & 8); a.kit = !!(f & 16);
      if (a === P) {
        P.hp = t[5];
        if (!alive && P.alive && GS.time > graceUntil) { P.alive = false; X.killFx(P, GS.killer || null, 'p9', false, true); }
        continue;
      }
      a.hp = t[5]; a.actVis = (f & 64) ? 'plant' : (f & 128) ? 'defuse' : ''; a.crouch = !!(f & 2); a.sprint = !!(f & 4); a.onGround = !!(f & 32); a.scoped = (f >> 8) & 3;
      const nx = t[0], ny = t[1], nz = t[2];
      if (alive && (!a.alive || a.tx === undefined || Math.hypot(nx - a.pos.x, nz - a.pos.z) > 8)) { a.pos.set(nx, ny, nz); a.tx = nx; a.tz = nz; a.ty = ny; a.vel.set(0, 0, 0); }
      else if (alive) { a.vel.set((nx - a.tx) / dtS, 0, (nz - a.tz) / dtS); a.tx = nx; a.ty = ny; a.tz = nz; }
      a.tyaw = t[3]; a.tpitch = t[4];
      a.alive = alive;
      const pi = t[9], si = t[10];
      if (pi >= 0) { if (!a.prim || a.prim.id !== WID[pi]) a.prim = { id: WID[pi], mag: 30, res: 0 }; } else a.prim = null;
      if (si >= 0) { if (!a.sec || a.sec.id !== WID[si]) a.sec = { id: WID[si], mag: 12, res: 0 }; } else a.sec = null;
      a.nadeSel = NS[t[11]] || 'he'; a.nades = { he: 0, flash: 0, smoke: 0, molly: 0 }; a.nades[a.nadeSel] = 1;
      let sl = SL[t[8]] || 'knife';
      if (sl === 'prim' && !a.prim) sl = 'sec'; if (sl === 'sec' && !a.sec) sl = 'knife';
      a.slot = sl;
    }
  }
  function mirrorTick(dt) {
    const k = 1 - Math.exp(-dt * 18);
    for (const a of GS.actors) {
      if (a === GS.player || !a.alive || a.tx === undefined) continue;
      a.pos.x += (a.tx - a.pos.x) * k; a.pos.z += (a.tz - a.pos.z) * k; a.pos.y += (a.ty - a.pos.y) * k;
      a.yaw += X.angDiff(a.yaw, a.tyaw) * k; a.pitch += (a.tpitch - a.pitch) * k;
      if (!a.sprint || true) X.footsteps(a, dt);
    }
  }
  function clientTick(dt) {
    const P = GS.player; if (!P || !net) return;
    accMe += dt;
    if (accMe >= 0.033) {
      accMe = 0;
      net.clientSend({ t: 'me', p: [r2(P.pos.x), r2(P.pos.y), r2(P.pos.z)], v: [r2(P.vel.x), r2(P.vel.z)], y: r2(P.yaw), a: r2(P.pitch),
        f: (P.crouch ? 1 : 0) | (P.sprint ? 2 : 0) | (P.walk ? 4 : 0) | (P.onGround ? 8 : 0) | (((P.scoped || 0) & 3) << 4), s: Math.max(0, SL.indexOf(P.slot)), n: Math.max(0, NS.indexOf(P.nadeSel)) });
    }
    const cur = P.act ? P.act.type : '';
    if (cur !== lastAct) { lastAct = cur; net.clientSend({ t: 'act', on: !!cur, type: cur }); }
  }
  // ----------------------------------------------------------------------- things the client tells the host
  function claim(v, amt, att, part, wid) {
    if (!net || !att || !att.isPlayer || v === att || !v.alive) return;
    net.clientSend({ t: 'hit', i: v.idx, p: part, w: wid, a: Math.round(amt) });
  }
  function clientShot(a, wid, o, d) { if (net) net.clientSend({ t: 'shot', w: wi(wid), o: [r2(o.x), r2(o.y), r2(o.z)], d: [r2(d.x), r2(d.y), r2(d.z)] }); }
  function clientNade(a, type, x, y, z, vx, vy, vz) { const id = (myPid + 1) * 100000 + (++nidCounter); if (net) net.clientSend({ t: 'nade', id, ty: NS.indexOf(type), p: [r2(x), r2(y), r2(z)], v: [r2(vx), r2(vy), r2(vz)] }); return id; }
  function clientBuy(id) { if (net) net.clientSend({ t: 'buy', id }); }
  function clientUndo() { if (net) net.clientSend({ t: 'undo' }); }
  function clientTeam(sq) { if (MP.role === 'host') { const p = L.players.find((q) => q.pid === 0); if (p && p.sq !== sq && teamCount(sq) < 5) { p.sq = sq; broadcastLobby(); } } else if (net) net.clientSend({ t: 'team', sq }); }

  // ======================================================================= wire up the lobby buttons
  $('onName').addEventListener('input', () => { S.name = cleanName($('onName').value); });
  $('onHost').onclick = () => { X.initAudio(S.vol); host(); };
  $('onJoin').onclick = () => { X.initAudio(S.vol); join(); };
  $('onCode').addEventListener('input', () => { $('onCode').value = cleanCode($('onCode').value); });
  $('onCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); e.stopPropagation(); });
  $('onName').addEventListener('keydown', (e) => e.stopPropagation());
  $('onBack').onclick = () => closePanel();
  $('onLeave').onclick = () => { leaveNet(); L = null; show('home'); say(''); };
  $('onSwitch').onclick = () => { const me = L && L.players.find((p) => p.pid === myPid); if (me) clientTeam(me.sq === 0 ? 1 : 0); };
  $('onStart').onclick = () => startHost();
  $('onCopy').onclick = () => { try { navigator.clipboard.writeText(L.code); $('onCopy').textContent = 'COPIED'; setTimeout(() => ($('onCopy').textContent = 'COPY'), 1200); } catch (e) {} };
  $('onCfg').addEventListener('click', () => { if (MP.role === 'host' && L) { if (S.mode !== 'dm') S.mode = 'comp'; L.cfg = cfgFromS(); broadcastLobby(); } });
  $('playOnline').onclick = () => { X.initAudio(S.vol); openPanel(); };
  $('toLobby').onclick = () => backToLobby();

  // Friends on the HKugz Games hub (assets/hkfriends.js): publish the room code so a friend can be invited, and an invite link (?join=CODE) opens this room.
  window.HKRoom = { game: 'core-strike', get code() { return L ? L.code : ''; } };
  {
    const j = cleanCode(new URLSearchParams(location.search).get('join'));
    if (j.length === 5) {
      try { const u = new URL(location.href); u.searchParams.delete('join'); history.replaceState(null, '', u); } catch (e) {}
      const unlock = () => X.initAudio(S.vol); addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true });
      setTimeout(() => { openPanel(); $('onCode').value = j; join(); }, 300);
    }
  }

  return { openPanel, leave, hostTick, roundStart, spawn, hurt, killEvent, money, shotFx, nadeEvent, detEvent, banner, event, feedTextEvent, roundEnd, matchEnd,
    mirrorTick, clientTick, claim, clientShot, clientNade, clientBuy, clientUndo, clientPing, pingOut, sendLoadout, applySnapshot, isLobbyOpen: () => !$('onlineP').classList.contains('hidden'), L: () => L };
}
