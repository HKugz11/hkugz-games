// Makes server/vault-catalog.json: the list of skins, knives, costumes, stickers, cases and guns that the friends server needs to open cases and check gifts.
// It reads the game's own lists (skins.js and the gun list in game.js) so the server and the game always agree.
// Run it again whenever a skin, case, costume or gun is added:   node server/make-catalog.mjs
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const GAME = process.env.GAME_DIR || 'C:/Users/hyrum/core-strike-crazygames/game';
const skins = await import(pathToFileURL(path.join(GAME, 'skins.js')).href);
const src = fs.readFileSync(path.join(GAME, 'game.js'), 'utf8');
const guns = [];
for (const m of src.matchAll(/^  (\w+): \{ name: '[^']*', slot: '(prim|sec)'[^\n]*$/gm)) {
  if (!/\bmag: \d+/.test(m[0])) continue;
  guns.push({ id: m[1], slot: m[2], holiday: m[1] === 'jingle' || m[1] === 'frosty' });
}
if (guns.length < 15) throw new Error('Found only ' + guns.length + ' guns in game.js: the gun list format changed.');
const cat = {
  v: 1,
  rarities: Object.fromEntries(Object.entries(skins.rarities).map(([k, r]) => [k, { refund: r.refund, sell: r.sell, hrefund: r.hrefund, hsell: r.hsell }])),
  finishes: skins.finishes.map(f => ({ id: f.id, rarity: f.rarity || null, weight: f.weight || 1, rp: f.rp === undefined ? undefined : f.rp, holiday: !!f.holiday, weapon: f.weapon || undefined })),
  knives: skins.knives.map(k => ({ id: k.id, rarity: k.rarity || null, gift: !!k.gift })),
  costumes: skins.costumes.map(c => ({ id: c.id, rarity: c.rarity, holiday: !!c.holiday })),
  stickers: skins.stickers.map(s => ({ id: s.id, rarity: s.rarity })),
  cases: skins.cases.map(c => ({ id: c.id, kind: c.kind, price: c.price, odds: c.odds, finishes: c.finishes, pool: c.pool, knives: !!c.knives, slot: c.slot || null, holiday: !!(c.holiday || c.seasonal) })),
  guns
};
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'vault-catalog.json'), JSON.stringify(cat, null, 1));
console.log('vault-catalog.json written:', cat.finishes.length, 'finishes,', cat.knives.length, 'knives,', cat.costumes.length, 'costumes,', cat.stickers.length, 'stickers,', cat.cases.length, 'cases,', guns.length, 'guns');
