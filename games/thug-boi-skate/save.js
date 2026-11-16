// Saves coins and everything you bought in the browser (localStorage). Safe if storage is blocked.
const KEY = 'tbs.save';
// Hyrum's cheat: true = coins never run out. Set to false to earn them normally again.
export const INFINITE_COINS = false;
export const MAX_COINS = 999999999;

function fresh() {
  return { coins: 0, parts: { wheels: 0, bearings: 0, trucks: 0, deck: 0, grip: 0 }, chars: ['rookie'], char: 'rookie', packs: [], items: [], boards: ['classic'], board: 'classic', stickers: [], sdeck: [], parks: ['plaza'], park: 'plaza', best: 0, runs: 0, gift1: true, moneyReset1: true };
}

export function loadSave() {
  const s = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      s.coins = Math.max(0, raw.coins | 0);
      Object.assign(s.parts, raw.parts || {});
      if (Array.isArray(raw.chars) && raw.chars.length) s.chars = raw.chars;
      if (typeof raw.char === 'string') s.char = raw.char;
      if (Array.isArray(raw.packs)) s.packs = raw.packs;
      if (Array.isArray(raw.parks) && raw.parks.length) s.parks = raw.parks;
      if (typeof raw.park === 'string') s.park = raw.park;
      if (Array.isArray(raw.items)) s.items = raw.items;
      if (Array.isArray(raw.boards) && raw.boards.length) s.boards = raw.boards;
      if (typeof raw.board === 'string') s.board = raw.board;
      if (Array.isArray(raw.stickers)) s.stickers = raw.stickers.filter((x) => typeof x === 'string');
      if (Array.isArray(raw.sdeck)) {
        // new format: placed stickers {id, side, x, z, rot, s}. Old format: 3 slots of ids (nose / middle / tail) get turned into placed stickers.
        const old = [0.3, 0, -0.3];
        s.sdeck = raw.sdeck.map((p, i) => {
          if (typeof p === 'string') return { id: p, side: 'top', x: 0, z: old[i] || 0, rot: 0, s: 0.2 };
          if (p && typeof p.id === 'string' && isFinite(p.x) && isFinite(p.z)) return { id: p.id, side: p.side === 'bot' ? 'bot' : 'top', x: +p.x, z: +p.z, rot: +p.rot || 0, s: Math.max(0.08, Math.min(0.34, +p.s || 0.2)) };
          return null;
        }).filter(Boolean).slice(0, 8);
      }
      s.best = raw.best | 0; s.runs = raw.runs | 0; s.gift1 = !!raw.gift1; s.moneyReset1 = !!raw.moneyReset1;
    }
  } catch (e) { /* storage blocked: play without saving */ }
  if (INFINITE_COINS) s.coins = MAX_COINS;
  // one time only: start again with 0 coins so you can see how coins are earned (he asked for this after using the infinite-coins cheat)
  if (!s.moneyReset1) { s.moneyReset1 = true; s.coins = 0; writeSave(s); }
  // a one-time present: the Mythic Unicorn is yours (and equipped) the first time this version loads
  if (!s.gift1) {
    s.gift1 = true;
    if (!s.chars.includes('unicorn')) s.chars.push('unicorn');
    s.char = 'unicorn';
    writeSave(s);
  }
  return s;
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

// start again from nothing (open the game with ?reset on the end of the address). gift1 + moneyReset1 stay true so no free skater/coins come back.
export function resetSave() {
  try { localStorage.setItem(KEY, JSON.stringify({ gift1: true, moneyReset1: true })); } catch (e) { /* ignore */ }
}
