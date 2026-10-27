'use strict';
// HKugz Friends core: all the rules for accounts, friends and game invites. No files, no sockets, no web server in here.
// It takes a description of one request and gives back a description of the answer, so the same code runs in Node
// (server.js, for the Ubuntu server or a PC) and on Cloudflare (cloudflare/worker.js). What is stored and what is not protected: docs/FRIENDS-SAFETY.md.
const crypto = require('node:crypto');

const GAMES = { 'blaster-arena': 'Blaster Arena', 'fort-fight': 'Fort Fight', 'core-strike': 'Core Strike' };
const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';           // the letters the games use for 5-letter room codes
const ROOM_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/;
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{2,15}$/;
const REPORT_REASONS = ['bad-name', 'harassment', 'cheating', 'other'];
const LIMITS = { friends: 50, outgoing: 20, incoming: 30, blocked: 100, sessions: 5, invites: 5 };
const ONLINE_MS = 35e3, INVITE_MS = 10 * 60e3, SESSION_MS = 30 * 864e5;
const COMMON_PW = ['password', 'password1', '12345678', '123456789', '1234567890', 'qwertyui', 'qwerty123', '11111111', 'iloveyou', 'letmein1', 'abc12345', 'fortnite1', 'minecraft', 'roblox123'];
const CORE_DEFAULTS = {
  allowedOrigins: ['https://hkugz11.github.io'],   // websites allowed to call the API from a browser (a games site served by server.js itself is always allowed)
  signupCode: '',            // if set, nobody can make an account without it (recommended: a closed group of friends)
  signupsOpen: true, maxUsers: 300, ipSignupsPerHour: 5, allSignupsPerHour: 30,
  requestsPerMinute: 1500,   // per IP address. Behind a plain tunnel every visitor looks like the same address, so this is then one limit for everybody
  adminToken: '',            // the secret for /admin/* (the admin tool). Empty or shorter than 20 characters = the admin part is switched off
  log: false,
  blockedNames: ['admin', 'moderator', 'hkugz', 'staff', 'support', 'official', 'system', 'root', 'owner'],
  ownerNames: []             // exact names (any capitals) that may be taken even though they contain a blocked word, e.g. ["hkugz"] for whoever runs the site. Only the first person to sign up with it gets it
};

class ApiError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra || {}; } }
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const safeEq = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const newCode = () => { let s = ''; for (let i = 0; i < 8; i++) s += CODE_ALPHA[crypto.randomInt(CODE_ALPHA.length)]; return s; };
const fmtCode = c => c.slice(0, 4) + '-' + c.slice(4);
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// raw = the saved data (what snapshot() gave last time) or null for a fresh start.
// core.onDirty (set by whoever hosts the core) is called whenever something worth saving changed; then core.snapshot() has the new data.
function createCore(userCfg, raw) {
  const cfg = Object.assign({}, CORE_DEFAULTS, userCfg || {});
  let skew = 0; const now = () => Date.now() + skew;            // skew only lets the tests move the clock
  const log = (...a) => { if (cfg.log) console.log(new Date().toISOString(), ...a); };
  const adminToken = cfg.adminToken || '';

  // ------------------------------------------------------------------ the data (kept in memory; the host saves snapshot() somewhere)
  const users = new Map();        // lowercase name -> user (a Map, so a name like "__proto__" can't poison anything)
  const byCode = new Map();       // friend code -> user
  const bySession = new Map();    // sha256(session token) -> user
  let requests = [], reports = [], meta = {};
  const seen = new Map(), invites = new Map(), declined = new Map(), fails = new Map();   // not saved: who is online, open invites, ...

  function indexUser(u) { users.set(u.key, u); byCode.set(u.code, u); for (const s of u.sessions) bySession.set(s.h, u); }
  if (raw) {
    for (const r of raw.users || []) indexUser(Object.assign({}, r, { friends: new Set(r.friends), blocked: new Set(r.blocked), sessions: r.sessions || [] }));
    requests = raw.requests || []; reports = raw.reports || []; meta = raw.meta || {};
  }
  let dirty = false;
  function save() { dirty = true; if (core.onDirty) core.onDirty(); }
  function snapshot() { return { v: 1, users: [...users.values()].map(u => Object.assign({}, u, { friends: [...u.friends], blocked: [...u.blocked] })), requests, reports, meta }; }

  // ------------------------------------------------------------------ limits
  const buckets = new Map();
  function hit(key, max, windowMs) {    // fixed window; returns 0 if fine, else the seconds to wait
    const t = now(); let e = buckets.get(key);
    if (!e || e.reset <= t) { e = { n: 0, reset: t + windowMs }; buckets.set(key, e); }
    return ++e.n <= max ? 0 : Math.ceil((e.reset - t) / 1000);
  }
  function limit(key, max, windowMs, what) { const wait = hit(key, max, windowMs); if (wait) throw new ApiError(429, (what || 'Slow down a little') + '. Try again in ' + niceWait(wait) + '.', { retryAfter: wait }); }
  const niceWait = s => s < 90 ? s + ' seconds' : Math.ceil(s / 60) + ' minutes';
  let lastSweep = 0;
  function sweep() {      // tidy up old limit counters, invites and sessions (runs by itself about once a minute while requests come in)
    lastSweep = now(); const t = now();
    for (const [k, e] of buckets) if (e.reset <= t) buckets.delete(k);
    for (const [k, v] of declined) if (v <= t) declined.delete(k);
    for (const [k, f] of fails) if (f.until <= t && t - f.last > 3600e3) fails.delete(k);
    for (const [k, s] of seen) if (t - s.t > 3600e3) seen.delete(k);
    for (const [k, l] of invites) { const keep = l.filter(i => t - i.t < INVITE_MS); if (keep.length) invites.set(k, keep); else invites.delete(k); }
    for (const u of users.values()) { const n = u.sessions.length; u.sessions = u.sessions.filter(s => s.exp > t); if (u.sessions.length !== n) save(); }
  }

  // ------------------------------------------------------------------ passwords (scrypt, a few at a time so the server stays responsive)
  let active = 0; const waiting = [];
  function scrypt(pw, salt) {
    return new Promise((res, rej) => {
      const run = () => { active++; crypto.scrypt(pw, salt, 64, SCRYPT, (e, k) => { active--; const n = waiting.shift(); if (n) n(); e ? rej(e) : res(k); }); };
      if (active < 3) run(); else if (waiting.length < 30) waiting.push(run); else rej(new ApiError(503, 'The server is busy. Try again in a moment.'));
    });
  }
  const hashNew = async pw => { const salt = crypto.randomBytes(16); return { s: salt.toString('hex'), h: (await scrypt(pw, salt)).toString('hex') }; };
  const DUMMY = { s: crypto.randomBytes(16).toString('hex'), h: crypto.randomBytes(64).toString('hex') };   // so a wrong name takes as long as a wrong password
  async function verify(pw, rec) { const k = await scrypt(pw, Buffer.from(rec.s, 'hex')), h = Buffer.from(rec.h, 'hex'); return k.length === h.length && crypto.timingSafeEqual(k, h); }

  // ------------------------------------------------------------------ small helpers
  const bad = msg => new ApiError(400, msg);
  const text = (body, field, min, max, msg) => { const v = body[field]; if (typeof v !== 'string' || v.length < min || v.length > max) throw bad(msg || 'Something is missing or too long.'); return v; };
  const flag = (body, field) => (typeof body[field] === 'boolean' ? body[field] : undefined);
  const signupsOpen = () => (typeof meta.signupsOpen === 'boolean' ? meta.signupsOpen : cfg.signupsOpen);
  function checkName(v) {
    if (typeof v !== 'string' || !NAME_RE.test(v)) throw bad('Pick a name with 3 to 16 letters, numbers or underscores, starting with a letter.');
    const low = v.toLowerCase();
    if (!cfg.ownerNames.some(n => String(n).toLowerCase() === low) && cfg.blockedNames.some(w => low.includes(w))) throw bad('That name is not allowed. Try another one.');
    if (/\d{6,}/.test(v)) throw bad('Please do not put a phone number in your name.');
    return v;
  }
  function checkPassword(v, name) {
    if (typeof v !== 'string' || v.length < 8 || v.length > 100) throw bad('Your password needs 8 to 100 characters.');
    const low = v.toLowerCase();
    if (COMMON_PW.includes(low) || low.includes(name.toLowerCase())) throw bad('That password is too easy to guess. Try a longer one that is not your name.');
    return v;
  }
  function uniqueCode() { for (;;) { const c = newCode(); if (!byCode.has(c)) return c; } }
  function newSession(u) {
    const token = crypto.randomBytes(32).toString('base64url'), h = sha256(token);
    u.sessions.push({ h, exp: now() + SESSION_MS });
    while (u.sessions.length > LIMITS.sessions) { const old = u.sessions.shift(); bySession.delete(old.h); }
    bySession.set(h, u); return token;
  }
  function dropSessions(u) { for (const s of u.sessions) bySession.delete(s.h); u.sessions = []; }
  const meOf = u => ({ name: u.name, friendCode: fmtCode(u.code), appearOffline: !!u.appearOffline, byName: u.byName !== false });
  const lookup = name => (typeof name === 'string' && NAME_RE.test(name) ? users.get(name.toLowerCase()) : undefined);
  const hasReq = (from, to) => requests.some(r => r.from === from && r.to === to);
  const dropReqs = (a, b) => { requests = requests.filter(r => !((r.from === a && r.to === b) || (r.from === b && r.to === a))); };
  const dropInvites = (a, b) => { for (const [x, y] of [[a, b], [b, a]]) { const l = invites.get(x); if (l) invites.set(x, l.filter(i => i.fromKey !== y)); } };
  function unfriend(a, b) { a.friends.delete(b.key); b.friends.delete(a.key); dropInvites(a.key, b.key); }
  function removeUser(u) {
    dropSessions(u); users.delete(u.key); byCode.delete(u.code); seen.delete(u.key); invites.delete(u.key);
    for (const o of users.values()) { o.friends.delete(u.key); o.blocked.delete(u.key); }
    requests = requests.filter(r => r.from !== u.key && r.to !== u.key);
    for (const [k, l] of invites) invites.set(k, l.filter(i => i.fromKey !== u.key));
  }
  const validAt = v => (typeof v === 'string' && (v === 'hub' || GAMES[v]) ? v : '');
  const isOnline = f => { const s = seen.get(f.key); return !!s && !f.appearOffline && now() - s.t < ONLINE_MS; };

  function stateFor(u) {
    const t = now();
    const friends = [...u.friends].map(k => users.get(k)).filter(f => f && !f.banned).map(f => { const on = isOnline(f); return { name: f.name, online: on, at: on ? seen.get(f.key).at : '' }; })
      .sort((a, b) => (b.online - a.online) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    const nameOf = k => (users.get(k) || {}).name;
    return {
      me: meOf(u), friends,
      incoming: requests.filter(r => r.to === u.key && users.get(r.from) && !users.get(r.from).banned).map(r => ({ from: nameOf(r.from), t: r.t })),
      outgoing: requests.filter(r => r.from === u.key && users.get(r.to)).map(r => ({ to: nameOf(r.to), t: r.t })),
      blocked: [...u.blocked].map(nameOf).filter(Boolean),
      invites: (invites.get(u.key) || []).filter(i => t - i.t < INVITE_MS).map(i => ({ id: i.id, from: i.from, game: i.game, gameName: GAMES[i.game], code: i.code, t: i.t })),
      now: t
    };
  }

  // ------------------------------------------------------------------ the API
  const routes = Object.create(null);
  const open = (name, fn) => { routes[name] = { fn, auth: false }; };
  const mine = (name, fn) => { routes[name] = { fn, auth: true }; };

  open('GET /api/info', ctx => ({ app: 'hkugz-friends', v: 1, signupsOpen: signupsOpen() && users.size < cfg.maxUsers, codeRequired: !!cfg.signupCode }));

  open('POST /api/signup', async ({ body, ip }) => {
    limit('signup:ip:' + ip, cfg.ipSignupsPerHour, 3600e3, 'Too many sign-up tries'); limit('signup:all', cfg.allSignupsPerHour, 3600e3, 'Lots of people are signing up');
    if (!signupsOpen() || users.size >= cfg.maxUsers) throw new ApiError(403, 'Sign-ups are closed right now.');
    if (body.agree !== true) throw bad('Please tick the box: you are 13 or older, or a parent or guardian said it is OK.');
    if (cfg.signupCode && !safeEq(String(body.signupCode || '').trim().toLowerCase(), cfg.signupCode.trim().toLowerCase())) throw new ApiError(403, 'That sign-up code is not right. Ask the person who runs the site for it.');
    const name = checkName(body.username), pw = checkPassword(body.password, name), key = name.toLowerCase();
    if (users.has(key)) throw new ApiError(409, 'That name is taken. Try another one.');
    const rec = await hashNew(pw);
    if (users.has(key)) throw new ApiError(409, 'That name is taken. Try another one.');
    const u = { name, key, code: uniqueCode(), pw: rec, created: now(), lastLogin: now(), appearOffline: false, byName: true, banned: false, friends: new Set(), blocked: new Set(), sessions: [] };
    indexUser(u); const token = newSession(u); save(); log('signup', key);
    return { token, me: meOf(u) };
  });

  open('POST /api/login', async ({ body, ip }) => {
    limit('login:ip:' + ip, 40, 600e3, 'Too many log-in tries');
    const name = text(body, 'username', 1, 40), pw = text(body, 'password', 1, 200), key = name.toLowerCase(), u = users.get(key), f = fails.get(key);
    if (f && f.until > now()) throw new ApiError(429, 'Too many wrong passwords. Try again in ' + niceWait(Math.ceil((f.until - now()) / 1000)) + '.', { retryAfter: Math.ceil((f.until - now()) / 1000) });
    const ok = await verify(pw, u ? u.pw : DUMMY);
    if (!u || !ok) {
      if (u) { const n = ((f && f.n) || 0) + 1; fails.set(key, { n, last: now(), until: n >= 5 ? now() + Math.min(15 * 60e3, 30e3 * Math.pow(2, n - 5)) : 0 }); }
      throw new ApiError(401, 'Wrong username or password.');
    }
    if (u.banned) throw new ApiError(403, 'This account has been turned off. Ask the person who runs the site.');
    fails.delete(key); u.lastLogin = now(); const token = newSession(u); save();
    return { token, me: meOf(u) };
  });

  mine('POST /api/logout', ({ user, token }) => { const h = sha256(token); user.sessions = user.sessions.filter(s => s.h !== h); bySession.delete(h); save(); return { ok: true }; });

  mine('POST /api/poll', ({ user, body }) => {
    limit('poll:' + user.key, 40, 60e3, 'Slow down');
    seen.set(user.key, { t: now(), at: validAt(body.at) });
    return stateFor(user);
  });

  mine('POST /api/friend/request', ({ user, body }) => {
    limit('freq:' + user.key, 20, 3600e3, 'You have sent a lot of friend requests');
    const input = text(body, 'to', 1, 40, 'Type a username or a friend code.').trim();
    let target, viaName = false;                                     // "K7Q2-M9XP" is a friend code; a plain word is a username (an 8-letter code with no dash is tried as a name first)
    if (/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(input)) target = byCode.get(normCode(input));
    else { target = lookup(input); viaName = !!target; if (!target && /^[A-Za-z0-9]{8}$/.test(input)) target = byCode.get(normCode(input)); }
    if (!target || target.banned || (viaName && target.byName === false && target !== user)) {
      limit('fnone:' + user.key, 10, 3600e3, 'Too many players not found');
      throw new ApiError(404, 'No player has that name or friend code.');
    }
    if (target === user) throw bad('That is you!');
    if (user.blocked.has(target.key)) throw bad('You blocked this player. Unblock them first if you want to be friends.');
    if (user.friends.has(target.key)) throw bad('You are already friends.');
    if (target.blocked.has(user.key)) return { result: 'sent', name: target.name };       // looks the same, nothing is stored
    if (user.friends.size >= LIMITS.friends) throw bad('Your friends list is full.');
    if (hasReq(target.key, user.key)) {                                                   // they already asked me, so this is a yes
      if (target.friends.size >= LIMITS.friends) throw bad('Their friends list is full.');
      dropReqs(user.key, target.key); user.friends.add(target.key); target.friends.add(user.key); save(); return { result: 'friends', name: target.name };
    }
    if (hasReq(user.key, target.key)) throw bad('You already asked ' + target.name + '. Wait for them to answer.');
    if (requests.filter(r => r.from === user.key).length >= LIMITS.outgoing) throw bad('You have too many requests waiting. Cancel some first.');
    if ((declined.get(user.key + '>' + target.key) || 0) > now()) return { result: 'sent', name: target.name };   // they said no recently: do not pester
    if (requests.filter(r => r.to === target.key).length >= LIMITS.incoming) throw bad('That player has a lot of requests waiting. Try again later.');
    requests.push({ from: user.key, to: target.key, t: now() }); save(); return { result: 'sent', name: target.name };
  });

  mine('POST /api/friend/respond', ({ user, body }) => {
    limit('act:' + user.key, 90, 60e3, 'Slow down');
    const from = lookup(body.from), accept = flag(body, 'accept');
    if (!from || accept === undefined || !hasReq(from.key, user.key)) throw bad('That request is not there any more.');
    dropReqs(from.key, user.key);
    if (accept) {
      if (user.friends.size >= LIMITS.friends || from.friends.size >= LIMITS.friends) throw bad('A friends list is full.');
      user.friends.add(from.key); from.friends.add(user.key);
    } else declined.set(from.key + '>' + user.key, now() + 24 * 3600e3);
    save(); return { ok: true };
  });

  mine('POST /api/friend/cancel', ({ user, body }) => { const to = lookup(body.to); if (to) { requests = requests.filter(r => !(r.from === user.key && r.to === to.key)); save(); } return { ok: true }; });
  mine('POST /api/friend/remove', ({ user, body }) => { limit('act:' + user.key, 90, 60e3, 'Slow down'); const o = lookup(body.who); if (o) { unfriend(user, o); save(); } return { ok: true }; });

  function blockUser(user, o) {
    if (o === user) throw bad('You can not block yourself.');
    if (user.blocked.size >= LIMITS.blocked && !user.blocked.has(o.key)) throw bad('Your block list is full.');
    unfriend(user, o); dropReqs(user.key, o.key); user.blocked.add(o.key);
  }
  mine('POST /api/block', ({ user, body }) => { limit('act:' + user.key, 90, 60e3, 'Slow down'); const o = lookup(body.who); if (!o) throw bad('No player has that name.'); blockUser(user, o); save(); return { ok: true }; });
  mine('POST /api/unblock', ({ user, body }) => { const o = lookup(body.who); if (o) { user.blocked.delete(o.key); save(); } return { ok: true }; });
  mine('POST /api/report', ({ user, body }) => {
    limit('report:' + user.key, 10, 24 * 3600e3, 'You have sent a lot of reports today');
    const o = lookup(body.who), reason = body.reason;
    if (!o || o === user) throw bad('No player has that name.');
    if (!REPORT_REASONS.includes(reason)) throw bad('Pick a reason for the report.');
    reports.push({ t: now(), by: user.name, who: o.name, reason }); if (reports.length > 2000) reports.shift();
    blockUser(user, o); save(); return { ok: true };
  });

  mine('POST /api/invite', ({ user, body }) => {
    limit('invite:' + user.key, 30, 600e3, 'You have sent a lot of invites');
    const to = lookup(body.to), game = body.game, code = String(body.code || '').toUpperCase();
    if (!to || !user.friends.has(to.key) || to.banned) throw bad('You can only invite your friends.');
    if (!GAMES[game]) throw bad('That game can not take invites.');
    if (!ROOM_RE.test(code)) throw bad('Host a game first, then invite your friend.');
    if (!isOnline(to)) throw bad(to.name + ' is not online right now.');     // someone who "appears offline" is not invitable either
    limit('invite:' + user.key + '>' + to.key, 3, 30e3, 'You just invited ' + to.name);
    const list = (invites.get(to.key) || []).filter(i => now() - i.t < INVITE_MS && i.fromKey !== user.key);
    list.push({ id: crypto.randomBytes(6).toString('hex'), from: user.name, fromKey: user.key, game, code, t: now() });
    while (list.length > LIMITS.invites) list.shift();
    invites.set(to.key, list); return { ok: true };
  });
  mine('POST /api/invite/dismiss', ({ user, body }) => { const l = invites.get(user.key); if (l && typeof body.id === 'string') invites.set(user.key, l.filter(i => i.id !== body.id)); return { ok: true }; });

  mine('POST /api/settings', ({ user, body }) => {
    limit('act:' + user.key, 90, 60e3, 'Slow down');
    const a = flag(body, 'appearOffline'), b = flag(body, 'byName');
    if (a !== undefined) user.appearOffline = a; if (b !== undefined) user.byName = b; save(); return { me: meOf(user) };
  });
  mine('POST /api/code/reset', ({ user }) => { limit('code:' + user.key, 5, 3600e3, 'Slow down'); byCode.delete(user.code); user.code = uniqueCode(); byCode.set(user.code, user); save(); return { me: meOf(user) }; });

  mine('POST /api/password', async ({ user, body }) => {
    limit('pw:' + user.key, 10, 3600e3, 'Too many password tries');
    const oldPw = text(body, 'oldPassword', 1, 200), nu = checkPassword(body.newPassword, user.name);
    if (!(await verify(oldPw, user.pw))) throw new ApiError(401, 'Your old password is not right.');
    user.pw = await hashNew(nu); dropSessions(user); const token = newSession(user); save(); return { token };
  });
  mine('POST /api/account/delete', async ({ user, body }) => {
    limit('pw:' + user.key, 10, 3600e3, 'Too many password tries');
    if (!(await verify(text(body, 'password', 1, 200), user.pw))) throw new ApiError(401, 'That password is not right.');
    removeUser(user); save(); return { ok: true };
  });

  // ------------------------------------------------------------------ admin (only with the secret from the settings, used by admin.js)
  const adminRoutes = {
    'GET /admin/users': () => ({ users: [...users.values()].map(u => ({ name: u.name, created: u.created, lastLogin: u.lastLogin, friends: u.friends.size, blocked: u.blocked.size, banned: !!u.banned })), signupsOpen: signupsOpen() }),
    'GET /admin/reports': () => ({ reports }),
    'POST /admin/ban': ({ body }) => { const u = lookup(body.name); if (!u) throw bad('No such user.'); u.banned = true; dropSessions(u); seen.delete(u.key); save(); return { ok: true }; },
    'POST /admin/unban': ({ body }) => { const u = lookup(body.name); if (!u) throw bad('No such user.'); u.banned = false; save(); return { ok: true }; },
    'POST /admin/delete': ({ body }) => { const u = lookup(body.name); if (!u) throw bad('No such user.'); removeUser(u); save(); return { ok: true }; },
    'POST /admin/resetpw': async ({ body }) => {
      const u = lookup(body.name); if (!u) throw bad('No such user.');
      let pw = ''; for (let i = 0; i < 12; i++) pw += CODE_ALPHA[crypto.randomInt(CODE_ALPHA.length)];
      u.pw = await hashNew(pw); dropSessions(u); fails.delete(u.key); save(); return { password: pw };
    },
    'POST /admin/clear-reports': () => { reports = []; save(); return { ok: true }; },
    'POST /admin/signups': ({ body }) => { meta.signupsOpen = !!body.open; save(); return { signupsOpen: signupsOpen() }; },
    // everything that is saved (accounts with their scrambled passwords, friends, blocks, reports), minus the log-in sessions, so it can be moved to another server (admin.js export / import)
    'GET /admin/export': () => { const s = snapshot(); for (const u of s.users) u.sessions = []; return s; }
  };

  // ------------------------------------------------------------------ one request in, one answer out
  // req: { method, path, headers (names in lower case), ip, text (the body as text), tooBig }  ->  { status, headers, body, close }
  const BASE_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  const answer = (status, obj, extra) => ({ status, headers: Object.assign({}, BASE_HEADERS, extra || {}), body: JSON.stringify(obj) });
  function originOk(headers) {
    const o = headers.origin; if (!o) return true;
    if (cfg.allowedOrigins.includes(o)) return true;
    return o === 'http://' + headers.host || o === 'https://' + headers.host;   // the page came from this very server
  }
  function parseBody(req) {
    if (req.tooBig) throw new ApiError(413, 'That request is too big.');
    if (!req.text) return {};
    try { const v = JSON.parse(req.text); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; return v; } catch (e) { throw bad('That request could not be read.'); }
  }
  async function handle(req) {
    const headers = req.headers || {}, pathname = req.path || '/', ip = req.ip || 'unknown', cors = {};
    try {
      if (now() - lastSweep > 60e3) sweep();
      const origin = headers.origin;
      if (!originOk(headers)) throw new ApiError(403, 'This website is not allowed to use the friends server.');
      if (origin) { cors['Access-Control-Allow-Origin'] = origin; cors['Vary'] = 'Origin'; }
      if (req.method === 'OPTIONS') return { status: 204, headers: Object.assign({ 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Max-Age': '600' }, cors), body: '' };
      limit('ip:' + ip, cfg.requestsPerMinute, 60e3, 'Too many requests');
      const isAdmin = pathname.startsWith('/admin/');
      const route = isAdmin ? { fn: adminRoutes[req.method + ' ' + pathname] } : routes[req.method + ' ' + pathname];
      if (!route || !route.fn) throw new ApiError(404, 'Not found.');
      const ctx = { req, ip, body: req.method === 'POST' ? parseBody(req) : {} };
      if (isAdmin) {
        if (origin || adminToken.length < 20 || !safeEq(headers['x-admin-token'] || '', adminToken)) { limit('adminfail:' + ip, 10, 600e3, 'Too many tries'); throw new ApiError(403, 'No.'); }
      } else if (route.auth) {
        const m = /^Bearer ([A-Za-z0-9_-]{20,80})$/.exec(headers.authorization || ''), u = m && bySession.get(sha256(m[1]));
        const s = u && u.sessions.find(x => x.h === sha256(m[1]));
        if (!u || !s || s.exp <= now() || u.banned) throw new ApiError(401, 'Please log in again.');
        if (s.exp - now() < SESSION_MS - 864e5) { s.exp = now() + SESSION_MS; save(); }   // stay logged in while you keep coming back
        ctx.user = u; ctx.token = m[1];
      }
      return answer(200, await route.fn(ctx), cors);
    } catch (e) {
      if (e instanceof ApiError) {
        const out = answer(e.status, Object.assign({ error: e.message }, e.extra), Object.assign(cors, e.status === 429 ? { 'Retry-After': String(e.extra.retryAfter || 30) } : {}));
        if (e.status === 413) out.close = true;
        return out;
      }
      console.error('API error on', req.method, pathname, e && e.stack || e); return answer(500, { error: 'Something went wrong on the server.' }, cors);
    }
  }

  const core = {
    cfg, adminToken, users, onDirty: null, handle, snapshot, sweep,
    get dirty() { return dirty; }, clearDirty() { dirty = false; }, markDirty() { dirty = true; },
    advance(ms) { skew += ms; }
  };
  return core;
}

module.exports = { createCore, CORE_DEFAULTS, GAMES };
