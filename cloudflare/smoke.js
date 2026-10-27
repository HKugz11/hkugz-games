'use strict';
// A quick end-to-end check of the Cloudflare version, run against `npm run dev` (Cloudflare's own runtime on this computer):
//   terminal 1:  cd cloudflare && npm run dev
//   terminal 2:  cd cloudflare && npm test
// It reads the local test secrets from .dev.vars (never used for the real site) and makes throw-away accounts with random names.
// Against the REAL server:   node smoke.js https://hkugz-friends.YOURNAME.workers.dev
//   It asks for the sign-up code at a prompt that shows nothing while you type (the code goes only to that server), uses the admin secret from .admin-token, makes 2 throw-away
//   accounts (the server allows 5 sign-up tries an hour from one address, so do not run it more than once an hour) and deletes them again.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const BASE = (process.argv[2] || process.env.BASE || 'http://127.0.0.1:8788').replace(/\/+$/, '');
const LIVE = process.env.SMOKE_LIVE === '1' || !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(BASE + '/');   // SMOKE_LIVE=1 forces the careful real-server mode (for trying it locally)
const vars = {}; try { for (const l of fs.readFileSync(path.join(__dirname, '.dev.vars'), 'utf8').split('\n')) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m) vars[m[1]] = m[2]; } } catch (e) {}
let CODE = process.env.SIGNUP_CODE || (LIVE ? '' : vars.SIGNUP_CODE) || '', ADMIN = process.env.ADMIN_TOKEN || '';
if (!ADMIN) { try { ADMIN = fs.readFileSync(path.join(__dirname, LIVE ? '.admin-token' : '.dev.vars'), 'utf8').trim(); if (!LIVE) ADMIN = vars.ADMIN_TOKEN || ''; } catch (e) {} }
function askHidden(q) {   // nothing is echoed while typing (the output goes into a stream that throws it away)
  return new Promise(res => {
    process.stdout.write(q);
    const rl = require('readline').createInterface({ input: process.stdin, output: new (require('stream').Writable)({ write(chunk, enc, cb) { cb(); } }), terminal: true });
    rl.question('', a => { rl.close(); console.log(''); res(a); });
  });
}
const SUFFIX = Math.random().toString(36).slice(2, 7), PW = 'purple-giraffe-77';

async function call(method, url, body, token, headers) {
  const r = await fetch(BASE + url, { method, headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}, headers || {}), body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch (e) {}
  return { status: r.status, json, headers: r.headers };
}
const post = (u, b, t, h) => call('POST', u, b || {}, t, h);
const adm = (m, u, b) => call(m, u, b, null, { 'x-admin-token': ADMIN });
let passed = 0; const step = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('  FAIL  ' + name + '\n        ' + (e && e.message || e)); process.exitCode = 1; } };

(async () => {
  console.log('Smoke test against ' + BASE + (LIVE ? '  (the REAL server)' : ''));
  if (LIVE && !CODE) CODE = (await askHidden('Sign-up code (nothing shows while you type, just press Enter): ')).trim();
  if (LIVE && !ADMIN) console.log('(no admin secret found, so the admin checks are skipped)');
  const A = 'Al' + SUFFIX, B = 'Bo' + SUFFIX, C = 'Cy' + SUFFIX; let ta, tb, tc, codeB;
  await step('info says a sign-up code is needed', async () => { const r = await call('GET', '/api/info'); assert.equal(r.status, 200); assert.equal(r.json.app, 'hkugz-friends'); assert.equal(r.json.codeRequired, !!CODE); });
  await step('sign-up is refused without the code, and without ticking the box', async () => {
    if (CODE) assert.equal((await post('/api/signup', { username: A, password: PW, agree: true, signupCode: 'definitely-not-the-code' })).status, 403);
    if (!LIVE) { if (CODE) assert.equal((await post('/api/signup', { username: A, password: PW, agree: true })).status, 403); assert.equal((await post('/api/signup', { username: A, password: PW, signupCode: CODE })).status, 400); }
  });
  await step(LIVE ? 'two accounts sign up' : 'three accounts sign up', async () => {
    for (const [n, k] of (LIVE ? [[A, 'a'], [B, 'b']] : [[A, 'a'], [B, 'b'], [C, 'c']])) { const r = await post('/api/signup', { username: n, password: PW, agree: true, signupCode: CODE }); assert.equal(r.status, 200, JSON.stringify(r.json)); if (k === 'a') ta = r.json.token; if (k === 'b') { tb = r.json.token; codeB = r.json.me.friendCode; } if (k === 'c') tc = r.json.token; }
    if (!LIVE) assert.equal((await post('/api/signup', { username: A.toUpperCase(), password: PW, agree: true, signupCode: CODE })).status, 409);
  });
  await step('log in: wrong password 401, right password 200', async () => { assert.equal((await post('/api/login', { username: A, password: 'wrong-wrong-1' })).status, 401); const r = await post('/api/login', { username: A.toLowerCase(), password: PW }); assert.equal(r.status, 200); assert.equal(r.json.me.name, A); });
  await step('friends: request, accept, both online', async () => {
    assert.equal((await post('/api/friend/request', { to: B }, ta)).json.result, 'sent');
    assert.equal((await post('/api/poll', { at: 'hub' }, tb)).json.incoming[0].from, A);
    assert.equal((await post('/api/friend/respond', { from: A, accept: true }, tb)).status, 200);
    const sa = (await post('/api/poll', { at: 'hub' }, ta)).json; assert.deepEqual(sa.friends.map(f => f.name + ':' + f.online), [B + ':true']);
    assert.equal((await post('/api/poll', { at: 'blaster-arena' }, tb)).json.friends[0].online, true);
  });
  if (!LIVE) await step('add by friend code', async () => { assert.equal((await post('/api/friend/request', { to: codeB.toLowerCase() }, tc)).json.result, 'sent'); assert.equal((await post('/api/friend/cancel', { to: B }, tc)).status, 200); });
  await step('invite: sent, seen by the friend, dismissed; bad ones refused', async () => {
    assert.equal((await post('/api/invite', { to: B, game: 'blaster-arena', code: 'ABCDE' }, ta)).status, 200);
    const inv = (await post('/api/poll', {}, tb)).json.invites; assert.deepEqual([inv.length, inv[0].from, inv[0].game, inv[0].code], [1, A, 'blaster-arena', 'ABCDE']);
    await post('/api/invite/dismiss', { id: inv[0].id }, tb); assert.equal((await post('/api/poll', {}, tb)).json.invites.length, 0);
    assert.equal((await post('/api/invite', { to: B, game: 'snake', code: 'ABCDE' }, ta)).status, 400); assert.equal((await post('/api/invite', { to: B, game: 'core-strike', code: 'ABCD1' }, ta)).status, 400); assert.equal((await post('/api/invite', { to: C, game: 'core-strike', code: 'ABCDE' }, ta)).status, 400);
  });
  if (!LIVE) await step('block and report', async () => {
    assert.equal((await post('/api/report', { who: C, reason: 'bad-name' }, ta)).status, 200); assert.deepEqual((await post('/api/poll', {}, ta)).json.blocked, [C]);
    assert.equal((await post('/api/report', { who: B, reason: 'free text' }, ta)).status, 400);
    if (ADMIN) { const rep = (await adm('GET', '/admin/reports')).json.reports.filter(r => r.by === A); assert.deepEqual([rep[0].who, rep[0].reason], [C, 'bad-name']); }
  });
  if (!LIVE) await step('settings, new code, change password', async () => {
    assert.equal((await post('/api/settings', { byName: false }, tb)).json.me.byName, false); assert.equal((await post('/api/friend/request', { to: B }, tc)).status, 404);
    const old = codeB; const n = (await post('/api/code/reset', {}, tb)).json.me.friendCode; assert.notEqual(n, old);
    const p = await post('/api/password', { oldPassword: PW, newPassword: 'brand-new-pass-99' }, tb); assert.equal(p.status, 200); tb = p.json.token; assert.equal((await post('/api/login', { username: B, password: PW })).status, 401);
  });
  await step('only the right websites may call from a browser', async () => {
    const ok = await call('GET', '/api/info', undefined, null, { origin: 'https://hkugz11.github.io' }); assert.equal(ok.headers.get('access-control-allow-origin'), 'https://hkugz11.github.io');
    const pre = await fetch(BASE + '/api/poll', { method: 'OPTIONS', headers: { origin: 'https://hkugz11.github.io', 'access-control-request-method': 'POST' } }); assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-headers'), /authorization/);
    assert.equal((await call('POST', '/api/login', { username: A, password: PW }, null, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await fetch(BASE + '/api/poll', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })).status, 403);
  });
  await step('junk is refused politely, nothing crashes', async () => {
    assert.equal((await call('POST', '/api/poll', 'x'.repeat(5000), ta)).status, 413);
    for (const b of ['null', '[]', '{', '"s"']) assert.ok((await call('POST', '/api/friend/request', b, ta)).status < 500, b);
    for (const to of ['__proto__', 'constructor', 'toString']) assert.ok((await post('/api/friend/request', { to }, ta)).status < 500, to);
    assert.equal((await call('GET', '/api/nothing')).status, 404); assert.equal((await post('/api/poll', {})).status, 401);
    const root = await fetch(BASE + '/'); assert.equal(root.status, 404); assert.equal((await post('/api/poll', {}, ta)).status, 200);
  });
  await step('admin: closed without the secret, works with it', async () => {
    assert.equal((await call('GET', '/admin/users')).status, 403); assert.equal((await call('GET', '/admin/users', undefined, null, { 'x-admin-token': 'wrong' })).status, 403);
    if (!ADMIN) return;
    assert.equal((await call('GET', '/admin/users', undefined, null, { 'x-admin-token': ADMIN, origin: 'https://hkugz11.github.io' })).status, 403, 'a web page can never use admin');
    const users = (await adm('GET', '/admin/users')).json.users.map(u => u.name); for (const n of (LIVE ? [A, B] : [A, B, C])) assert.ok(users.includes(n), n);
    assert.equal((await adm('POST', '/admin/ban', { name: B })).status, 200); assert.equal((await post('/api/poll', {}, tb)).status, 401);
    await adm('POST', '/admin/unban', { name: B }); const rp = await adm('POST', '/admin/resetpw', { name: B }); assert.match(rp.json.password, /^[A-Z0-9]{12}$/); assert.equal((await post('/api/login', { username: B, password: rp.json.password })).status, 200);
  });
  await step('delete account removes it, tidy up', async () => {
    assert.equal((await post('/api/account/delete', { password: PW }, ta)).status, 200); assert.equal((await post('/api/poll', {}, ta)).status, 401);
    if (ADMIN) { await adm('POST', '/admin/delete', { name: B }); if (!LIVE) { await adm('POST', '/admin/delete', { name: C }); await adm('POST', '/admin/clear-reports'); } }
    else if (LIVE) console.log('        (no admin secret: the test account ' + B + ' was left behind; delete it with the admin tool)');
  });
  console.log(process.exitCode ? '\nSome steps FAILED.' : '\nAll ' + passed + ' steps passed.');
})().catch(e => { console.error(e); process.exit(1); });
