'use strict';
// Tests for the friends server. Run with:  node --test test.js   (each test starts its own copy of the server in a temp folder)
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { createApp } = require('./server.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hkf-'));
async function boot(extra) {
  const dir = tmp(), app = createApp(Object.assign({ port: 0, host: '127.0.0.1', dataDir: dir, signupCode: '', ipSignupsPerHour: 500, allSignupsPerHour: 500, allowedOrigins: ['http://allowed.test'] }, extra || {}));
  const port = await app.start(), base = 'http://127.0.0.1:' + port;
  async function raw(method, url, body, token, headers) {
    const r = await fetch(base + url, { method, headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}, headers || {}), body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, json: j, headers: r.headers };
  }
  const post = (url, body, token, headers) => raw('POST', url, body || {}, token, headers);
  async function user(name, pw = 'purple-giraffe-77') { const r = await post('/api/signup', { username: name, password: pw, agree: true }); assert.equal(r.status, 200, name + ': ' + JSON.stringify(r.json)); return { name, token: r.json.token, code: r.json.me.friendCode }; }
  const poll = (u, at) => post('/api/poll', { at }, u.token).then(r => r.json);
  async function befriend(a, b) { await post('/api/friend/request', { to: b.name }, a.token); const r = await post('/api/friend/respond', { from: a.name, accept: true }, b.token); assert.equal(r.status, 200); }
  return { app, dir, base, raw, post, user, poll, befriend, close: () => app.close() };
}

test('sign up, log in, log out, bad input', async () => {
  const s = await boot();
  try {
    assert.equal((await s.raw('GET', '/api/info')).json.codeRequired, false);
    const a = await s.user('Alice');
    assert.equal((await s.post('/api/signup', { username: 'Zed', password: 'purple-giraffe-77' })).status, 400, 'the 13+ / parent tick box is required');
    assert.equal((await s.post('/api/signup', { agree: true, username: 'alice', password: 'whatever-it-is-123' })).status, 409, 'names are not case sensitive');
    for (const bad of [{ username: 'ab', password: 'long-enough-1' }, { username: '9lives', password: 'long-enough-1' }, { username: 'has space', password: 'long-enough-1' }, { username: 'adminbob', password: 'long-enough-1' }, { username: 'call5551234567', password: 'long-enough-1' }, { username: 'goodname', password: 'short' }, { username: 'goodname', password: 'password' }, { username: 'goodname', password: 'xx-goodname-xx' }, { username: 5, password: 'long-enough-1' }, {}]) {
      assert.equal((await s.post('/api/signup', Object.assign({ agree: true }, bad))).status, 400, JSON.stringify(bad));
    }
    const l = await s.post('/api/login', { username: 'ALICE', password: 'purple-giraffe-77' });
    assert.equal(l.status, 200); assert.equal(l.json.me.name, 'Alice'); assert.match(l.json.me.friendCode, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal((await s.post('/api/poll', {}, l.json.token)).status, 200);
    assert.equal((await s.post('/api/logout', {}, l.json.token)).status, 200);
    assert.equal((await s.post('/api/poll', {}, l.json.token)).status, 401, 'logged-out token is dead');
    assert.equal((await s.post('/api/poll', {}, a.token)).status, 200, 'other session still works');
    assert.equal((await s.post('/api/poll', {})).status, 401);
    assert.equal((await s.post('/api/poll', {}, 'not-a-real-token-not-a-real-token')).status, 401);
  } finally { await s.close(); }
});

test('passwords are hashed, not stored', async () => {
  const s = await boot();
  try {
    await s.user('Alice', 'my-very-secret-pw-42'); s.app.flush();
    const db = fs.readFileSync(path.join(s.dir, 'db.json'), 'utf8');
    assert.ok(!db.includes('my-very-secret-pw-42')); assert.match(db, /"pw":\{"s":"[0-9a-f]{32}","h":"[0-9a-f]{128}"\}/);
    assert.ok(!/"token"/.test(db), 'session tokens are stored only as hashes');
  } finally { await s.close(); }
});

test('wrong passwords back off, and a right one clears it', async () => {
  const s = await boot();
  try {
    await s.user('Alice');
    for (let i = 0; i < 5; i++) assert.equal((await s.post('/api/login', { username: 'alice', password: 'nope-nope-nope' })).status, 401);
    const locked = await s.post('/api/login', { username: 'alice', password: 'purple-giraffe-77' });
    assert.equal(locked.status, 429, 'even the right password waits'); assert.ok(locked.json.retryAfter > 0);
    s.app.advance(40e3);
    assert.equal((await s.post('/api/login', { username: 'alice', password: 'purple-giraffe-77' })).status, 200);
    assert.equal((await s.post('/api/login', { username: 'nobody', password: 'x' })).status, 401, 'unknown name looks like a wrong password');
  } finally { await s.close(); }
});

test('sign-up code, closing sign-ups', async () => {
  const s = await boot({ signupCode: 'Secret Word' });
  try {
    assert.equal((await s.raw('GET', '/api/info')).json.codeRequired, true);
    assert.equal((await s.post('/api/signup', { agree: true, username: 'Bob', password: 'purple-giraffe-77' })).status, 403);
    assert.equal((await s.post('/api/signup', { agree: true, username: 'Bob', password: 'purple-giraffe-77', signupCode: 'nope' })).status, 403);
    assert.equal((await s.post('/api/signup', { agree: true, username: 'Bob', password: 'purple-giraffe-77', signupCode: ' secret word ' })).status, 200);
    const r = await fetch(s.base + '/admin/signups', { method: 'POST', headers: { 'x-admin-token': s.app.adminToken }, body: JSON.stringify({ open: false }) });
    assert.equal(r.status, 200);
    assert.equal((await s.post('/api/signup', { agree: true, username: 'Cara', password: 'purple-giraffe-77', signupCode: 'secret word' })).status, 403);
    assert.equal((await s.raw('GET', '/admin/users')).status, 403, 'no admin without the secret');
    assert.equal((await s.raw('GET', '/admin/users', undefined, null, { 'x-admin-token': 'wrong' })).status, 403);
    assert.equal((await s.raw('GET', '/admin/users', undefined, null, { 'x-admin-token': s.app.adminToken, origin: 'http://allowed.test' })).status, 403, 'a web page can never use admin');
  } finally { await s.close(); }
});

test('friends: request by name, by code, accept, decline, remove', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice'), b = await s.user('Bob'), c = await s.user('Cara'), d = await s.user('Dan');
    assert.equal((await s.post('/api/friend/request', { to: 'bob' }, a.token)).json.result, 'sent');
    assert.equal((await s.poll(b)).incoming[0].from, 'Alice');
    assert.equal((await s.poll(a)).outgoing[0].to, 'Bob');
    assert.equal((await s.post('/api/friend/request', { to: 'bob' }, a.token)).status, 400, 'no double requests');
    assert.equal((await s.post('/api/friend/respond', { from: 'Alice', accept: true }, b.token)).status, 200);
    assert.deepEqual((await s.poll(a)).friends.map(f => f.name), ['Bob']); assert.deepEqual((await s.poll(b)).friends.map(f => f.name), ['Alice']);
    assert.equal((await s.post('/api/friend/request', { to: 'Bob' }, a.token)).status, 400, 'already friends');
    // by friend code (with and without the dash, any case)
    assert.equal((await s.post('/api/friend/request', { to: c.code.toLowerCase() }, a.token)).json.result, 'sent');
    assert.equal((await s.post('/api/friend/request', { to: d.code.replace('-', '') }, a.token)).json.result, 'sent');
    assert.equal((await s.post('/api/friend/respond', { from: 'Alice', accept: false }, c.token)).status, 200);
    assert.equal((await s.poll(a)).friends.length, 1, 'declined means no friendship');
    assert.equal((await s.post('/api/friend/request', { to: 'Alice' }, c.token)).json.result, 'sent', 'Cara can still ask Alice');
    // a request in both directions just makes them friends
    assert.equal((await s.post('/api/friend/request', { to: 'Cara' }, a.token)).json.result, 'friends');
    // cancel and remove
    assert.equal((await s.post('/api/friend/cancel', { to: 'Dan' }, a.token)).status, 200); assert.equal((await s.poll(d)).incoming.length, 0);
    assert.equal((await s.post('/api/friend/remove', { who: 'Bob' }, a.token)).status, 200);
    assert.deepEqual((await s.poll(a)).friends.map(f => f.name), ['Cara']); assert.deepEqual((await s.poll(b)).friends, []);
    // not found, self
    assert.equal((await s.post('/api/friend/request', { to: 'nobodyhere' }, a.token)).status, 404);
    assert.equal((await s.post('/api/friend/request', { to: 'Alice' }, a.token)).status, 400);
    assert.equal((await s.post('/api/friend/request', { to: 'ZZZZ-ZZZZ' }, a.token)).status, 404);
    assert.equal((await s.post('/api/friend/request', { to: { x: 1 } }, a.token)).status, 400);
  } finally { await s.close(); }
});

test('"only by friend code" hides a player from name searches', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice'), b = await s.user('Bob');
    await s.post('/api/settings', { byName: false }, b.token);
    assert.equal((await s.post('/api/friend/request', { to: 'Bob' }, a.token)).status, 404, 'looks exactly like a name that does not exist');
    assert.equal((await s.post('/api/friend/request', { to: b.code }, a.token)).json.result, 'sent');
  } finally { await s.close(); }
});

test('online, appear offline, and invites', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice'), b = await s.user('Bob'), c = await s.user('Cara');
    await s.befriend(a, b);
    assert.equal((await s.poll(a)).friends[0].online, false, 'Bob has not polled yet');
    await s.poll(b, 'blaster-arena');
    const st = await s.poll(a, 'hub'); assert.deepEqual([st.friends[0].online, st.friends[0].at], [true, 'blaster-arena']);
    const inv = (to, game, code, who = a) => s.post('/api/invite', { to, game, code }, who.token);
    assert.equal((await inv('Bob', 'blaster-arena', 'ABCDE')).status, 200);
    const got = (await s.poll(b)).invites; assert.equal(got.length, 1);
    assert.deepEqual([got[0].from, got[0].game, got[0].code, got[0].gameName], ['Alice', 'blaster-arena', 'ABCDE', 'Blaster Arena']);
    // bad invites
    assert.equal((await inv('Bob', 'snake', 'ABCDE')).status, 400, 'only the online games');
    assert.equal((await inv('Bob', 'blaster-arena', 'ABCD1')).status, 400, 'letters the games never use');
    assert.equal((await inv('Bob', 'blaster-arena', 'ABCDEF')).status, 400);
    assert.equal((await inv('Bob', 'blaster-arena', '<img src=x>')).status, 400);
    assert.equal((await inv('Cara', 'blaster-arena', 'ABCDE')).status, 400, 'not a friend');
    // invite replaced, not stacked, and it can be dismissed
    s.app.advance(31e3); await s.poll(a); await s.poll(b);
    assert.equal((await inv('Bob', 'core-strike', 'FGHJK')).status, 200);
    const two = (await s.poll(b)).invites; assert.equal(two.length, 1); assert.equal(two[0].game, 'core-strike');
    await s.post('/api/invite/dismiss', { id: two[0].id }, b.token); assert.equal((await s.poll(b)).invites.length, 0);
    // appear offline
    await s.post('/api/settings', { appearOffline: true }, b.token);
    assert.equal((await s.poll(a)).friends[0].online, false);
    assert.equal((await inv('Bob', 'fort-fight', 'ABCDE')).status, 400);
    await s.post('/api/settings', { appearOffline: false }, b.token); await s.poll(b);
    assert.equal((await s.poll(a)).friends[0].online, true);
    // goes offline when it stops polling; invites run out after 10 minutes
    s.app.advance(40e3); assert.equal((await s.poll(a)).friends[0].online, false);
    await s.poll(b); s.app.advance(1e3); assert.equal((await inv('Bob', 'fort-fight', 'ABCDE')).status, 200);
    s.app.advance(11 * 60e3); assert.equal((await s.poll(b)).invites.length, 0);
  } finally { await s.close(); }
});

test('block, report, and being blocked', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice'), b = await s.user('Bob');
    await s.befriend(a, b); await s.poll(a); await s.poll(b);
    assert.equal((await s.post('/api/block', { who: 'Bob' }, a.token)).status, 200);
    let st = await s.poll(a); assert.deepEqual([st.friends.length, st.blocked], [0, ['Bob']]);
    assert.equal((await s.poll(b)).friends.length, 0, 'the friendship is gone for both');
    assert.equal((await s.post('/api/friend/request', { to: 'Alice' }, b.token)).json.result, 'sent', 'Bob is not told he is blocked');
    assert.equal((await s.poll(a)).incoming.length, 0, 'and nothing reaches Alice');
    assert.equal((await s.post('/api/friend/request', { to: 'Bob' }, a.token)).status, 400, 'Alice has to unblock first');
    await s.post('/api/unblock', { who: 'Bob' }, a.token); assert.deepEqual((await s.poll(a)).blocked, []);
    // report = a note for the person who runs the site + an automatic block
    const c = await s.user('Cara'); await s.befriend(a, c);
    assert.equal((await s.post('/api/report', { who: 'Cara', reason: 'free text is not allowed' }, a.token)).status, 400);
    assert.equal((await s.post('/api/report', { who: 'Cara', reason: 'bad-name' }, a.token)).status, 200);
    assert.deepEqual((await s.poll(a)).blocked, ['Cara']);
    const rep = await (await fetch(s.base + '/admin/reports', { headers: { 'x-admin-token': s.app.adminToken } })).json();
    assert.deepEqual([rep.reports[0].by, rep.reports[0].who, rep.reports[0].reason], ['Alice', 'Cara', 'bad-name']);
  } finally { await s.close(); }
});

test('settings, new friend code, change password, delete account', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice'), b = await s.user('Bob'); await s.befriend(a, b);
    const old = a.code, r = await s.post('/api/code/reset', {}, a.token); assert.notEqual(r.json.me.friendCode, old);
    const c = await s.user('Cara');
    assert.equal((await s.post('/api/friend/request', { to: old }, c.token)).status, 404, 'the old code stops working');
    // change password: old password needed, other sessions end
    assert.equal((await s.post('/api/password', { oldPassword: 'wrong-wrong-wrong', newPassword: 'brand-new-pass-99' }, a.token)).status, 401);
    assert.equal((await s.post('/api/password', { oldPassword: 'purple-giraffe-77', newPassword: 'abc' }, a.token)).status, 400);
    const p = await s.post('/api/password', { oldPassword: 'purple-giraffe-77', newPassword: 'brand-new-pass-99' }, a.token);
    assert.equal(p.status, 200); assert.equal((await s.post('/api/poll', {}, a.token)).status, 401); assert.equal((await s.post('/api/poll', {}, p.json.token)).status, 200);
    assert.equal((await s.post('/api/login', { username: 'Alice', password: 'purple-giraffe-77' })).status, 401);
    // delete account
    assert.equal((await s.post('/api/account/delete', { password: 'nope-nope-nope' }, p.json.token)).status, 401);
    assert.equal((await s.post('/api/account/delete', { password: 'brand-new-pass-99' }, p.json.token)).status, 200);
    assert.equal((await s.post('/api/poll', {}, p.json.token)).status, 401); assert.deepEqual((await s.poll(b)).friends, []);
    assert.equal((await s.post('/api/signup', { agree: true, username: 'Alice', password: 'purple-giraffe-77' })).status, 200, 'the name is free again');
    s.app.flush(); assert.ok(!fs.readFileSync(path.join(s.dir, 'db.json'), 'utf8').includes('brand-new-pass-99'));
  } finally { await s.close(); }
});

test('admin: ban, unban, reset password, delete', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice'), b = await s.user('Bob'); await s.befriend(a, b); await s.poll(b);
    const adm = (m, u, body) => fetch(s.base + u, { method: m, headers: { 'x-admin-token': s.app.adminToken }, body: body && JSON.stringify(body) }).then(async r => ({ status: r.status, json: await r.json() }));
    assert.equal((await adm('POST', '/admin/ban', { name: 'bob' })).status, 200);
    assert.equal((await s.post('/api/poll', {}, b.token)).status, 401); assert.equal((await s.post('/api/login', { username: 'Bob', password: 'purple-giraffe-77' })).status, 403);
    assert.deepEqual((await s.poll(a)).friends, [], 'a banned friend disappears from lists');
    await adm('POST', '/admin/unban', { name: 'bob' }); assert.equal((await s.post('/api/login', { username: 'Bob', password: 'purple-giraffe-77' })).status, 200);
    const rp = await adm('POST', '/admin/resetpw', { name: 'Bob' }); assert.match(rp.json.password, /^[A-Z0-9]{12}$/);
    assert.equal((await s.post('/api/login', { username: 'Bob', password: rp.json.password })).status, 200);
    assert.equal((await adm('GET', '/admin/users')).json.users.length, 2);
    await adm('POST', '/admin/delete', { name: 'Bob' }); assert.equal((await adm('GET', '/admin/users')).json.users.length, 1);
  } finally { await s.close(); }
});

test('names like __proto__ and constructor can not break anything', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice'), k = await s.user('constructor');
    for (const to of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const r = await s.post('/api/friend/request', { to }, a.token); assert.ok([404, 200].includes(r.status), to + ' -> ' + r.status);
    }
    for (const bad of ['__proto__', '__proto__"', 'prototype']) for (const url of ['/api/friend/respond', '/api/block', '/api/report', '/api/invite', '/api/friend/remove', '/api/unblock', '/api/friend/cancel']) {
      const r = await s.post(url, { from: bad, who: bad, to: bad, accept: true, reason: 'bad-name', game: 'core-strike', code: 'ABCDE' }, a.token); assert.ok(r.status < 500, url + ' ' + bad + ' -> ' + r.status);
    }
    assert.equal(Object.prototype.polluted, undefined); assert.equal((await s.poll(k)).me.name, 'constructor');
  } finally { await s.close(); }
});

test('junk requests never crash the server', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice');
    const urls = ['/api/signup', '/api/login', '/api/poll', '/api/friend/request', '/api/friend/respond', '/api/friend/cancel', '/api/friend/remove', '/api/block', '/api/unblock', '/api/report', '/api/invite', '/api/invite/dismiss', '/api/settings', '/api/code/reset', '/api/password', '/api/account/delete'];
    for (const body of ['null', '[]', '"str"', '123', '{', '{"a":', '', '{"to":null,"from":null,"who":null,"username":null,"password":null,"at":{}}', '{"id":{}, "reason":[], "accept":"yes", "appearOffline":"x"}'])
      for (const u of urls) { const r = await s.raw('POST', u, body, u.includes('login') || u.includes('signup') ? null : a.token); assert.ok(r.status < 500, u + ' ' + body + ' -> ' + r.status); }
    assert.equal((await s.raw('POST', '/api/poll', 'x'.repeat(5000), a.token)).status, 413);
    assert.equal((await s.raw('GET', '/api/nothing')).status, 404);
    assert.equal((await s.raw('GET', '/api/poll')).status, 404);
    assert.equal((await s.post('/api/poll', {}, a.token)).status, 200, 'still alive');
  } finally { await s.close(); }
});

test('limits: friend requests per hour, and only the games site may call from a browser', async () => {
  const s = await boot();
  try {
    const a = await s.user('Alice'); const names = [];
    for (let i = 0; i < 21; i++) names.push((await s.user('Friend' + i)).name);
    let last;
    for (let i = 0; i < 21; i++) last = await s.post('/api/friend/request', { to: names[i] }, a.token);
    assert.ok([400, 429].includes(last.status), 'the 21st request is refused: ' + last.status);
    const g = await s.user('Guesser'); let st = 0; for (let i = 0; i < 12; i++) st = (await s.post('/api/friend/request', { to: 'ghost' + i }, g.token)).status; assert.equal(st, 429, 'guessing names/codes is slowed down');
    // CORS
    const ok = await s.raw('GET', '/api/info', undefined, null, { origin: 'http://allowed.test' }); assert.equal(ok.headers.get('access-control-allow-origin'), 'http://allowed.test');
    const evil = await s.raw('POST', '/api/login', { username: 'Alice', password: 'x' }, null, { origin: 'http://evil.test' }); assert.equal(evil.status, 403); assert.equal(evil.headers.get('access-control-allow-origin'), null);
    const pre = await fetch(s.base + '/api/poll', { method: 'OPTIONS', headers: { origin: 'http://allowed.test', 'access-control-request-method': 'POST' } }); assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-headers'), /authorization/);
    assert.equal((await fetch(s.base + '/api/poll', { method: 'OPTIONS', headers: { origin: 'http://evil.test' } })).status, 403);
  } finally { await s.close(); }
});

test('data survives a restart, and a damaged file is not overwritten', async () => {
  const dir = tmp(), mk = () => createApp({ port: 0, host: '127.0.0.1', dataDir: dir });
  let app = mk(), port = await app.start();
  const post = (u, b, t) => fetch('http://127.0.0.1:' + port + u, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) }).then(async r => ({ status: r.status, json: await r.json() }));
  const a = await post('/api/signup', { agree: true, username: 'Alice', password: 'purple-giraffe-77' }); await post('/api/signup', { agree: true, username: 'Bob', password: 'purple-giraffe-77' });
  await post('/api/friend/request', { to: 'Bob' }, a.json.token); await app.close();
  app = mk(); port = await app.start();
  assert.equal((await post('/api/poll', {}, a.json.token)).json.outgoing[0].to, 'Bob', 'same session, same pending request');
  assert.equal((await post('/api/login', { username: 'bob', password: 'purple-giraffe-77' })).status, 200);
  await app.close();
  fs.writeFileSync(path.join(dir, 'db.json'), '{ broken'); fs.rmSync(path.join(dir, 'db.json.bak'), { force: true });
  assert.throws(() => mk(), /damaged/);
  assert.equal(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'), '{ broken', 'left alone for a person to look at');
});

test('serving the site: files yes, server folder and dotfiles no', async () => {
  const site = tmp(); fs.mkdirSync(path.join(site, 'games', 'x'), { recursive: true }); fs.mkdirSync(path.join(site, 'server', 'data'), { recursive: true }); fs.mkdirSync(path.join(site, '.git'));
  fs.writeFileSync(path.join(site, 'index.html'), '<h1>hub</h1>'.repeat(200)); fs.writeFileSync(path.join(site, 'games', 'x', 'index.html'), 'game x'); fs.writeFileSync(path.join(site, 'games', 'x', 'a.js'), 'let a = 1;');
  fs.writeFileSync(path.join(site, 'server', 'config.json'), 'SECRET'); fs.writeFileSync(path.join(site, 'server', 'data', 'db.json'), 'SECRET'); fs.writeFileSync(path.join(site, '.git', 'config'), 'SECRET'); fs.writeFileSync(path.join(site, '.env'), 'SECRET');
  const s = await boot({ siteDir: site });
  try {
    const get = (u, h) => new Promise((res, rej) => http.get(s.base + u, { headers: h || {} }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(c).toString() })); }).on('error', rej));
    assert.equal((await get('/')).status, 200); assert.match((await get('/')).body, /hub/);
    assert.equal((await get('/games/x/')).body, 'game x'); assert.equal((await get('/games/x')).status, 301);
    const js = await get('/games/x/a.js'); assert.equal(js.body, 'let a = 1;'); assert.match(js.headers['content-type'], /javascript/); assert.equal(js.headers['x-content-type-options'], 'nosniff');
    const gz = await new Promise(res => http.get(s.base + '/', { headers: { 'accept-encoding': 'gzip' } }, r => res(r.headers['content-encoding'])));
    assert.equal(gz, 'gzip');
    assert.equal((await get('/', { 'if-none-match': (await get('/')).headers.etag })).status, 304);
    for (const bad of ['/server/config.json', '/server/data/db.json', '/SERVER/config.json', '/.git/config', '/.env', '/%2e%2e/etc/passwd', '/games/%2e%2e/%2e%2e/x', '/..%2f..%2fx', '/games/x/%00', '/server/', '/server'])
      assert.ok([400, 404].includes((await get(bad)).status), bad);
    // fetch() and http.get tidy ".." and backslashes out of a path before sending it, so use a bare socket to send them exactly as written
    const bare = p => new Promise(res => { const c = require('net').connect(+s.base.split(':')[2], '127.0.0.1', () => c.write('GET ' + p + ' HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n')); let d = ''; c.on('data', x => (d += x)); c.on('end', () => res(d)); });
    for (const bad of ['/../server/config.json', '/games/../server/config.json', '/games/x/../../server/config.json', '/games/x\\..\\..\\server\\config.json', '/%2e%2e/%2e%2e/etc/passwd']) {
      const out = await bare(bad); assert.match(out, /^HTTP\/1\.1 (400|404)/, bad); assert.ok(!out.includes('SECRET'), bad);
    }
    assert.equal((await get('/nope')).status, 404);
    const r = await fetch(s.base + '/'); assert.equal((await fetch(s.base + '/', { method: 'POST' })).status, 405);
    assert.equal((await s.raw('GET', '/api/info')).status, 200, 'the API still works next to the site');
  } finally { await s.close(); }
});

test('the core alone: admin is off without a secret, and a snapshot brings everything back', async () => {
  const { createCore } = require('./core.js');
  const mk = (cfg, raw) => createCore(Object.assign({ ipSignupsPerHour: 500, allSignupsPerHour: 500 }, cfg), raw);
  const call = (c, method, path, body, token, headers) => c.handle({ method, path, headers: Object.assign(token ? { authorization: 'Bearer ' + token } : {}, headers || {}), ip: '1.2.3.4', text: body === undefined ? '' : JSON.stringify(body) }).then(r => ({ status: r.status, json: r.body ? JSON.parse(r.body) : null }));
  const a = mk({});
  assert.equal((await call(a, 'GET', '/admin/users', undefined, null, { 'x-admin-token': '' })).status, 403, 'no secret set = admin is off, even for an empty header');
  assert.equal((await call(mk({ adminToken: 'short' }), 'GET', '/admin/users', undefined, null, { 'x-admin-token': 'short' })).status, 403, 'a short secret is refused');
  const s = await call(a, 'POST', '/api/signup', { username: 'Alice', password: 'purple-giraffe-77', agree: true }); assert.equal(s.status, 200);
  await call(a, 'POST', '/api/signup', { username: 'Bob', password: 'purple-giraffe-77', agree: true });
  await call(a, 'POST', '/api/friend/request', { to: 'Bob' }, s.json.token);
  assert.equal(a.dirty, true); a.clearDirty(); assert.equal(a.dirty, false);
  const b = mk({}, JSON.parse(JSON.stringify(a.snapshot())));   // "restart": a new core from the saved data
  assert.equal((await call(b, 'POST', '/api/poll', {}, s.json.token)).json.outgoing[0].to, 'Bob');
  assert.equal((await call(b, 'POST', '/api/login', { username: 'bob', password: 'purple-giraffe-77' })).status, 200);
  const big2 = await a.handle({ method: 'POST', path: '/api/login', headers: {}, ip: 'x', text: '', tooBig: true }); assert.equal(big2.status, 413); assert.equal(big2.close, true);
});
