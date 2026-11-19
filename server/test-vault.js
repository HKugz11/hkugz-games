'use strict';
// Tests for the vault (coins, skins, case opening, gifts). Run with:  node --test test-vault.js   (npm test runs this and test.js)
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { createApp } = require('./server.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hkv-'));
async function boot(extra) {
  const dir = tmp(), app = createApp(Object.assign({ port: 0, host: '127.0.0.1', dataDir: dir, signupCode: '', ipSignupsPerHour: 500, allSignupsPerHour: 500, requestsPerMinute: 100000 }, extra || {}));
  const port = await app.start(), base = 'http://127.0.0.1:' + port;
  async function post(url, body, token) {
    const r = await fetch(base + url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body || {}) });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, json: j };
  }
  async function user(name, pw = 'purple-giraffe-77') { const r = await post('/api/signup', { username: name, password: pw, agree: true }); assert.equal(r.status, 200, name + ': ' + JSON.stringify(r.json)); return { name, token: r.json.token }; }
  const poll = (u, at) => post('/api/poll', { at }, u.token).then(r => r.json);
  async function befriend(a, b) { await post('/api/friend/request', { to: b.name }, a.token); const r = await post('/api/friend/respond', { from: a.name, accept: true }, b.token); assert.equal(r.status, 200); }
  return { app, dir, post, user, poll, befriend, close: () => app.close() };
}

test('vault: starts small, coins only come from matches and have limits', async () => {
  const s = await boot({ earnMinMatchMs: 0, dailyEarnCap: 1000, maxEarn: 600, xmas: false });
  try {
    const a = await s.user('Vera');
    assert.equal((await s.post('/api/vault', {})).status, 401, 'log in first');
    const v0 = (await s.post('/api/vault', {}, a.token)).json; assert.equal(v0.coins, 150); assert.deepEqual(v0.items, {}); assert.equal(v0.migrated, false);
    assert.equal((await s.post('/api/vault/earn', { amount: 100 }, a.token)).status, 400, 'no match was started');
    assert.equal((await s.post('/api/vault/start', {}, a.token)).status, 200);
    for (const amount of [0, -5, 1.5, '50', 601, null]) assert.equal((await s.post('/api/vault/earn', { amount }, a.token)).status, 400, 'amount ' + amount);
    const e1 = await s.post('/api/vault/earn', { amount: 500 }, a.token); assert.equal(e1.status, 200); assert.equal(e1.json.coins, 650);
    assert.equal((await s.post('/api/vault/earn', { amount: 100 }, a.token)).status, 400, 'a start is needed for every match');
    await s.post('/api/vault/start', {}, a.token); const e2 = await s.post('/api/vault/earn', { amount: 600 }, a.token); assert.equal(e2.json.got, 500, 'cut to what is left of the daily limit'); assert.equal(e2.json.earnLeft, 0);
    await s.post('/api/vault/start', {}, a.token); assert.equal((await s.post('/api/vault/earn', { amount: 10 }, a.token)).status, 400, 'daily limit reached');
  } finally { await s.close(); }
});

test('vault: a match has to last before it pays', async () => {
  const s = await boot({ xmas: false });
  try {
    const a = await s.user('Wendy'); await s.post('/api/vault/start', {}, a.token);
    assert.equal((await s.post('/api/vault/earn', { amount: 100 }, a.token)).status, 400, 'too fast');
    s.app.advance(95e3);
    assert.equal((await s.post('/api/vault/earn', { amount: 100 }, a.token)).status, 200, 'after a real match');
  } finally { await s.close(); }
});

test('vault: migrate once, open cases, duplicates refund, holiday case is seasonal', async () => {
  const s = await boot({ xmas: false });
  try {
    const a = await s.user('Mina');
    const items = ['skin:desert@raptor', 'skin:desert@raptor', 'skin:desert@raptor', 'knife:karambit', 'costume:unicorn', 'knife:combat', 'knife:candycane', 'skin:rift@raptor', 'skin:factory@raptor', 'skin:desert@jingle', 'gun:raptor', 'junk', 5, null];
    const m = await s.post('/api/vault/migrate', { coins: 99999, items }, a.token); assert.equal(m.status, 200);
    assert.equal(m.json.coins, 150 + 6000, 'coins are capped'); assert.equal(m.json.items['skin:desert@raptor'], 2, 'at most 2 of the same'); assert.equal(m.json.items['knife:karambit'], 1); assert.equal(m.json.items['costume:unicorn'], 1);
    for (const bad of ['knife:combat', 'knife:candycane', 'skin:rift@raptor', 'skin:factory@raptor', 'skin:desert@jingle', 'gun:raptor', 'junk']) assert.equal(m.json.items[bad], undefined, bad + ' is not an item');
    assert.equal((await s.post('/api/vault/migrate', { coins: 10, items: [] }, a.token)).status, 400, 'only once');
    assert.equal((await s.post('/api/vault/open', { case: 'nope' }, a.token)).status, 400, 'no such case');
    assert.equal((await s.post('/api/vault/open', { case: 'holiday' }, a.token)).status, 400, 'holiday cases are only sold in the season');
    let coins = 6150;
    for (let i = 0; i < 20; i++) {
      const r = await s.post('/api/vault/open', { case: i % 2 ? 'main' : 'street' }, a.token); assert.equal(r.status, 200, JSON.stringify(r.json));
      const p = r.json.prize; assert.ok(['common', 'rare', 'epic', 'legendary'].includes(p.rarity)); assert.match(p.item, /^(skin:[a-z]+@[a-z0-9]+|knife:[a-z]+)$/);
      coins += -(i % 2 ? 150 : 100) + p.refund; assert.equal(r.json.coins, coins, 'the price is paid, duplicates are refunded');
      assert.ok(!/@(jingle|frosty)$/.test(p.item), 'holiday guns never get case skins');
    }
    assert.equal((await s.post('/api/vault', {}, a.token)).json.coins, coins);
    assert.equal((await s.post('/api/vault/open', { case: 'goldcase' }, (await s.user('Pauper')).token)).status, 400, 'not enough coins');
  } finally { await s.close(); }
});

test('vault: glove cases only roll gloves (Elite = rare or better), a pair is kept, sold, gifted and listed like the other items', async () => {
  const s = await boot({ xmas: true });
  try {
    const a = await s.user('Gwen'); await s.post('/api/vault/migrate', { coins: 6000, items: ['glove:bluesteel', 'glove:nope', 'glove:dust'] }, a.token);
    const cat = require('./vault-catalog.json'), ids = new Set(cat.gloves.map(g => g.id)), rar = Object.fromEntries(cat.gloves.map(g => [g.id, g.rarity]));
    assert.equal(cat.gloves.length, 20); assert.equal(cat.gloves.filter(g => g.rarity === 'legendary').length, 5);
    const v0 = (await s.post('/api/vault', {}, a.token)).json.items; assert.equal(v0['glove:bluesteel'], 1); assert.equal(v0['glove:dust'], 1); assert.equal(v0['glove:nope'], undefined, 'an unknown pair is refused');
    for (let i = 0; i < 8; i++) { const r = await s.post('/api/vault/open', { case: 'gloves' }, a.token); assert.equal(r.status, 200); const p = r.json.prize; assert.equal(p.kind, 'glove'); assert.ok(ids.has(p.id), p.id); assert.equal(p.item, 'glove:' + p.id); assert.equal(p.rarity, rar[p.id]); }
    for (let i = 0; i < 3; i++) { const p = (await s.post('/api/vault/open', { case: 'gloves2' }, a.token)).json.prize; assert.equal(p.kind, 'glove'); assert.notEqual(rar[p.id], 'common', 'the Elite case has no commons'); }
    const v = (await s.post('/api/vault', {}, a.token)).json; assert.ok(Object.keys(v.items).some(k => k.startsWith('glove:')));
    const sold = await s.post('/api/vault/sell', { item: 'glove:bluesteel' }, a.token); assert.equal(sold.status, 200); assert.equal(sold.json.got, 525, 'a legendary pair sells like any legendary');
    const lst = await s.post('/api/market/list', { item: 'glove:dust', price: 40 }, a.token); assert.equal(lst.status, 200);
    const br = await s.post('/api/market/browse', { kind: 'glove' }, a.token); assert.ok(br.json.listings.every(l => l.item.startsWith('glove:')) && br.json.listings.length >= 1);
  } finally { await s.close(); }
});

test('vault: pistol cases only roll pistols, costume cases only costumes, sticker packs keep nothing', async () => {
  const s = await boot({ xmas: true });
  try {
    const a = await s.user('Nora'); await s.post('/api/vault/migrate', { coins: 6000, items: [] }, a.token);
    const P = new Set(['p9', 'viper', 'tec', 'revolver', 'trio', 'duster']);
    for (let i = 0; i < 15; i++) { const p = (await s.post('/api/vault/open', { case: 'pistol' }, a.token)).json.prize; if (p.kind === 'skin') assert.ok(P.has(p.item.split('@')[1]), p.item); }
    for (let i = 0; i < 10; i++) { const p = (await s.post('/api/vault/open', { case: 'holidaycos' }, a.token)).json.prize; assert.equal(p.kind, 'costume'); assert.ok(['elf', 'reindeer', 'snowman'].includes(p.id), p.id); }
    for (let i = 0; i < 6; i++) { const r = await s.post('/api/vault/open', { case: 'stick' }, a.token); assert.equal(r.json.prize.kind, 'sticker'); assert.equal(r.json.prize.item, undefined, 'stickers stay in the browser'); }
    assert.equal((await s.post('/api/vault/open', { case: 'holiday' }, a.token)).status, 200, 'the holiday case works in the season');
    const items = (await s.post('/api/vault', {}, a.token)).json.items; assert.ok(Object.keys(items).every(k => !/@(jingle|frosty)$/.test(k)));
  } finally { await s.close(); }
});

test('vault: gifts go to friends only and move the item', async () => {
  const s = await boot({ xmas: false });
  try {
    const a = await s.user('Gina'), b = await s.user('Hank'); await s.user('Stranger');
    await s.post('/api/vault/migrate', { coins: 0, items: ['skin:desert@raptor', 'knife:karambit', 'costume:cow'] }, a.token);
    assert.equal((await s.post('/api/vault/gift', { to: 'Hank', item: 'knife:karambit' }, a.token)).status, 400, 'not friends yet');
    await s.befriend(a, b);
    assert.equal((await s.post('/api/vault/gift', { to: 'Stranger', item: 'knife:karambit' }, a.token)).status, 400, 'not a friend');
    assert.equal((await s.post('/api/vault/gift', { to: 'Hank', item: 'skin:gold@raptor' }, a.token)).status, 400, 'you do not own it');
    assert.equal((await s.post('/api/vault/gift', { to: 'Hank', item: 'gun:jingle' }, a.token)).status, 400, 'not giftable');
    assert.equal((await s.post('/api/vault/gift', { to: 'Gina', item: 'knife:karambit' }, a.token)).status, 400, 'not to yourself');
    const g = await s.post('/api/vault/gift', { to: 'hank', item: 'knife:karambit' }, a.token); assert.equal(g.status, 200); assert.equal(g.json.items['knife:karambit'], undefined);
    assert.equal((await s.post('/api/vault', {}, b.token)).json.items['knife:karambit'], 1);
    assert.equal((await s.post('/api/vault', {}, b.token)).json.gifts.length, 1, 'the vault answer lists waiting gifts too');
    const st = await s.poll(b, 'hub'); assert.equal(st.gifts.length, 1); assert.equal(st.gifts[0].from, 'Gina'); assert.equal(st.gifts[0].item, 'knife:karambit');
    assert.equal((await s.poll(a, 'hub')).gifts.length, 0, 'the sender gets nothing');
    assert.equal((await s.post('/api/vault/gift', { to: 'Hank', item: 'knife:karambit' }, a.token)).status, 400, 'it is gone from her vault now');
    assert.equal((await s.post('/api/vault/gift/dismiss', { id: st.gifts[0].id }, b.token)).status, 200); assert.equal((await s.poll(b, 'hub')).gifts.length, 0);
    await s.post('/api/block', { who: 'Gina' }, b.token);
    assert.equal((await s.post('/api/vault/gift', { to: 'Hank', item: 'costume:cow' }, a.token)).status, 400, 'blocked / unfriended');
  } finally { await s.close(); }
});

test('vault: gift limits and it is saved to disk', async () => {
  const s = await boot({ xmas: false });
  try {
    const a = await s.user('Ivy'), b = await s.user('Jon'); await s.befriend(a, b);
    const items = []; for (const f of ['desert', 'carbon', 'candy', 'urban', 'forest', 'sunset']) items.push('skin:' + f + '@raptor', 'skin:' + f + '@buzz');
    await s.post('/api/vault/migrate', { coins: 0, items }, a.token);
    for (let i = 0; i < 3; i++) assert.equal((await s.post('/api/vault/gift', { to: 'Jon', item: items[i] }, a.token)).status, 200);
    assert.equal((await s.post('/api/vault/gift', { to: 'Jon', item: items[3] }, a.token)).status, 429, 'at most 3 gifts every 10 minutes');
    s.app.flush(); const snap = JSON.parse(fs.readFileSync(path.join(s.dir, fs.readdirSync(s.dir).find(f => /\.json$/.test(f))), 'utf8')); const jon = snap.users.find(u => u.key === 'jon'); assert.equal(Object.keys(jon.vault.items).length, 3, 'part of the saved data');
  } finally { await s.close(); }
});
