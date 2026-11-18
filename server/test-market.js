'use strict';
// Tests for quick sell and the player market. Run with:  node --test test-market.js   (npm test runs it too)
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { createApp } = require('./server.js');
const CAT = require('./vault-catalog.json');

async function boot(extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkm-')), app = createApp(Object.assign({ port: 0, host: '127.0.0.1', dataDir: dir, signupCode: '', ipSignupsPerHour: 500, allSignupsPerHour: 500, requestsPerMinute: 100000, xmas: false }, extra || {}));
  const port = await app.start(), base = 'http://127.0.0.1:' + port;
  async function post(url, body, token) {
    const r = await fetch(base + url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body || {}) });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, json: j };
  }
  async function user(name, items, coins) { const r = await post('/api/signup', { username: name, password: 'purple-giraffe-77', agree: true }); assert.equal(r.status, 200); const u = { name, token: r.json.token }; if (items) await post('/api/vault/migrate', { coins: coins || 0, items }, u.token); return u; }
  return { app, dir, post, user, close: () => app.close() };
}
const vault = (s, u) => s.post('/api/vault', {}, u.token).then(r => r.json);

test('economy: quick selling what a case gives is always worth LESS than the case cost (no coin printing)', () => {
  const sell = (r, c) => (c.id === 'holiday' ? CAT.rarities[r].hsell : CAT.rarities[r].sell);   // holiday skins sell for less
  for (const c of CAT.cases) {
    if (c.kind === 'sticker') continue;   // stickers can not be sold
    const total = Object.values(c.odds).reduce((a, b) => a + b, 0); let ev = 0;
    for (const [r, p] of Object.entries(c.odds)) ev += (p / total) * Math.max(sell(r, c), c.id === 'holiday' ? CAT.rarities[r].hrefund : 0);
    assert.ok(ev < c.price, c.id + ': quick-sell value ' + ev.toFixed(1) + ' must be below the price ' + c.price);
  }
  const plain = {}; assert.ok(sell('common', plain) < sell('rare', plain) && sell('rare', plain) < sell('epic', plain) && sell('epic', plain) < sell('legendary', plain), 'the rarer, the more');
});

test('quick sell: the rarer the more, only your own items, many at once', async () => {
  const s = await boot();
  try {
    const a = await s.user('Sally', ['skin:desert@raptor', 'skin:dragon@p9', 'skin:gold@buzz', 'knife:karambit', 'costume:cow', 'costume:unicorn'], 0);
    const c0 = (await vault(s, a)).coins; assert.equal(c0, 150);
    const one = await s.post('/api/vault/sell', { item: 'skin:desert@raptor' }, a.token); assert.equal(one.status, 200); assert.equal(one.json.got, 35, 'common'); assert.equal(one.json.coins, 185); assert.equal(one.json.items['skin:desert@raptor'], undefined);
    assert.equal((await s.post('/api/vault/sell', { item: 'skin:desert@raptor' }, a.token)).status, 400, 'already sold');
    assert.equal((await s.post('/api/vault/sell', { item: 'skin:diamondice@raptor' }, a.token)).status, 400, 'not yours');
    assert.equal((await s.post('/api/vault/sell', { item: 'gun:jingle' }, a.token)).status, 400, 'not sellable');
    const bulk = await s.post('/api/vault/sell', { items: ['skin:dragon@p9', 'skin:gold@buzz', 'knife:karambit', 'costume:cow', 'costume:unicorn'] }, a.token);
    assert.equal(bulk.status, 200); assert.equal(bulk.json.sold, 5); assert.equal(bulk.json.got, 80 + 525 + 525 + 35 + 525, 'rare 45 + three legendaries 300 + common 20: wait, gold and karambit and unicorn are legendary');
    assert.deepEqual(bulk.json.items, {});
    const dup = await s.user('Dupe', ['skin:desert@raptor']);
    assert.equal((await s.post('/api/vault/sell', { items: ['skin:desert@raptor', 'skin:desert@raptor'] }, dup.token)).status, 400, 'all or nothing: you only have one');
    assert.equal((await vault(s, dup)).items['skin:desert@raptor'], 1, 'nothing was sold');
    assert.equal((await s.post('/api/vault/sell', { items: [] }, dup.token)).status, 400);
  } finally { await s.close(); }
});

test('market: list, browse, buy with a fee, cancel, and the price band', async () => {
  const s = await boot();
  try {
    const a = await s.user('Seller1', ['skin:gold@buzz', 'skin:desert@raptor', 'knife:karambit'], 0), b = await s.user('Buyer1', [], 6000);
    const bad = (price, item = 'skin:gold@buzz') => s.post('/api/market/list', { item, price }, a.token);
    assert.equal((await bad(524)).status, 400, 'below the lowest price for a legendary (525)'); assert.equal((await bad(10501)).status, 400, 'above 20x'); assert.equal((await bad(1.5)).status, 400); assert.equal((await bad('500')).status, 400);
    assert.equal((await bad(500, 'skin:diamondice@raptor')).status, 400, 'you do not own it'); assert.equal((await bad(500, 'gun:jingle')).status, 400);
    const l = await bad(1000); assert.equal(l.status, 200); assert.equal(l.json.items['skin:gold@buzz'], undefined, 'the item is held by the market now');
    assert.equal((await s.post('/api/market/list', { item: 'skin:desert@raptor', price: 100 }, a.token)).status, 200);
    const br = await s.post('/api/market/browse', {}, b.token).then(r => r.json); assert.equal(br.total, 2); assert.equal(br.listings[0].price, 100, 'cheapest first'); assert.equal(br.listings[0].mine, false);
    assert.ok(!JSON.stringify(br).includes('Seller1'), 'listings never show the seller');
    assert.equal((await s.post('/api/market/browse', { kind: 'skin', rarity: 'legendary' }, b.token).then(r => r.json)).total, 1, 'filter');
    const mineList = await s.post('/api/market/browse', {}, a.token).then(r => r.json); assert.equal(mineList.mine.length, 2); assert.equal(mineList.listings.find(x => x.price === 1000).mine, true);
    assert.equal((await s.post('/api/market/buy', { id: mineList.listings[0].id }, a.token)).status, 400, 'not your own');
    const gold = br.listings.find(x => x.price === 1000), buy = await s.post('/api/market/buy', { id: gold.id }, b.token); assert.equal(buy.status, 200); assert.equal(buy.json.coins, 6150 - 1000); assert.equal(buy.json.items['skin:gold@buzz'], 1);
    assert.equal((await s.post('/api/market/buy', { id: gold.id }, b.token)).status, 404, 'gone');
    const sv = await vault(s, a); assert.equal(sv.coins, 150 + 950, 'seller gets the price minus a 5% fee'); assert.equal(sv.sales.length, 1); assert.equal(sv.sales[0].net, 950);
    assert.equal((await s.post('/api/market/sales/dismiss', { id: sv.sales[0].id }, a.token)).status, 200); assert.equal((await vault(s, a)).sales.length, 0);
    await s.post('/api/market/list', { item: 'knife:karambit', price: 2000 }, a.token); const big = (await s.post('/api/market/browse', {}, b.token).then(r => r.json)).listings.find(x => x.price === 2000);
    const poor = await s.user('Poor1', [], 0); assert.equal((await s.post('/api/market/buy', { id: big.id }, poor.token)).status, 400, 'not enough coins (150)');
    await s.post('/api/market/cancel', { id: big.id }, a.token);
    const cx = await s.post('/api/market/cancel', { id: br.listings.find(x => x.price === 100).id }, a.token); assert.equal(cx.status, 200); assert.equal(cx.json.items['skin:desert@raptor'], 1, 'back in the vault');
    assert.equal((await s.post('/api/market/cancel', { id: gold.id }, a.token)).status, 400);
  } finally { await s.close(); }
});

test('market: limits, expiry, banned sellers and deleted accounts', async () => {
  const s = await boot({ marketDays: 1 });
  try {
    const items = []; for (const f of ['desert', 'carbon', 'candy', 'urban', 'forest', 'sunset', 'ocean']) items.push('skin:' + f + '@raptor', 'skin:' + f + '@buzz');
    const a = await s.user('Lister', items, 0);
    let ok = 0, last = 0; for (const it of items) { last = (await s.post('/api/market/list', { item: it, price: 50 }, a.token)).status; if (last === 200) ok++; }
    assert.equal(ok, 12, 'at most 12 listings at once'); assert.equal(last, 400);
    const b = await s.user('Looker', [], 0);
    assert.equal((await s.post('/api/market/browse', {}, b.token).then(r => r.json)).total, 12);
    s.app.advance(2 * 864e5 + 61e3);    // two days later: nobody bought them, so they go home (the sweep runs with the next requests)
    await s.post('/api/market/browse', {}, b.token);
    assert.equal((await s.post('/api/market/browse', {}, b.token).then(r => r.json)).total, 0, 'expired listings are gone');
    assert.equal(Object.keys((await vault(s, a)).items).length, 14, 'and the items are back with their owner');
  } finally { await s.close(); }
});

test('market: a banned seller disappears from the market and deleting an account removes its listings', async () => {
  const s = await boot();
  try {
    const a = await s.user('Badguy', ['skin:gold@buzz'], 0), b = await s.user('Watcher', [], 0), c = await s.user('Leaver', ['skin:dragon@p9'], 0);
    await s.post('/api/market/list', { item: 'skin:gold@buzz', price: 600 }, a.token); await s.post('/api/market/list', { item: 'skin:dragon@p9', price: 100 }, c.token);
    assert.equal((await s.post('/api/market/browse', {}, b.token).then(r => r.json)).total, 2);
    const adm = (p, body) => fetch('http://127.0.0.1:' + s.app.server.address().port + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': s.app.adminToken }, body: JSON.stringify(body) });
    assert.equal((await adm('/admin/ban', { name: 'Badguy' })).status, 200);
    assert.equal((await s.post('/api/market/browse', {}, b.token).then(r => r.json)).total, 1, 'banned seller hidden');
    assert.equal((await s.post('/api/account/delete', { password: 'purple-giraffe-77' }, c.token)).status, 200);
    assert.equal((await s.post('/api/market/browse', {}, b.token).then(r => r.json)).total, 0, 'deleted account listings are removed');
  } finally { await s.close(); }
});

test('Northern Lights fits every gun (and the knife) and a skin made for one gun would fit only that gun', async () => {
  const s = await boot({ xmas: true });
  try {
    const ch = await s.user('Collector'); await s.post('/api/vault/migrate', { coins: 0, items: ['skin:northernlights@raptor', 'skin:northernlights@ranger', 'skin:northernlights@knife'] }, ch.token);
    const v = await vault(s, ch); assert.equal(v.items['skin:northernlights@raptor'], 1); assert.equal(v.items['skin:northernlights@ranger'], 1); assert.equal(v.items['skin:northernlights@knife'], 1);
  } finally { await s.close(); }
});

test('admin give: the operator can put one valid item in a vault (and nothing invalid)', async () => {
  const s = await boot();
  try {
    const u = await s.user('Winner');
    const adm = (body) => fetch('http://127.0.0.1:' + s.app.server.address().port + '/admin/give', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': s.app.adminToken }, body: JSON.stringify(body) });
    assert.equal((await adm({ name: 'Winner', item: 'skin:northernlights@ranger' })).status, 200);
    assert.equal((await adm({ name: 'Winner', item: 'skin:factory@raptor' })).status, 400, 'not a real item');
    assert.equal((await adm({ name: 'Nobody', item: 'skin:northernlights@ranger' })).status, 400);
    assert.equal((await vault(s, u)).items['skin:northernlights@ranger'], 1);
    assert.equal((await fetch('http://127.0.0.1:' + s.app.server.address().port + '/admin/give', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Winner', item: 'skin:northernlights@ranger' }) })).status >= 400, true, 'no secret, no item');
  } finally { await s.close(); }
});
