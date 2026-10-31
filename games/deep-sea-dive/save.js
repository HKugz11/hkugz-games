// save.js - your progress (coins, gear, fish you own, the Fish-dex) is stored in this browser with localStorage.
// Nothing is sent anywhere. Every key starts with "dsd." so it travels in the HKugz Games save codes.
import { TUNE, GEAR } from './data.js?v=2';

const KEY = 'dsd.save', SET = 'dsd.settings';

function fresh() {
  return {
    v: 1,
    coins: TUNE.startCoins,
    gear: { flippers: 0, suit: 0, tank: 0, net: 0, light: 0, bag: 0, gun: 0, quiver: 0 },     // which item of each kind you are USING
    owned: { flippers: [0], suit: [0], tank: [0], net: [0], light: [0], bag: [0], gun: [0], quiver: [0] },   // every item you OWN (swap between them in the shop)
    spears: 0,            // spears in your locker
    repel: 0,             // shark repellents in your locker
    hold: {},             // fish waiting on the boat to be sold: { fishId: howMany }
    dex: {},              // Fish-dex: { fishId: { n: howManyCaught } }
    stats: { dives: 0, deepest: 0, caught: 0, earned: 0, bites: 0, blackouts: 0 },
  };
}

export let save = fresh();
export const settings = { mute: false, vol: 0.8, sens: 1, lite: false, camDist: 1 };

function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }

export function load() {
  const s = read(KEY), base = fresh();
  if (s && typeof s === 'object') {
    // copy what we know, ignore anything strange (a save code from another device might be old or odd)
    base.coins = Math.max(0, Math.floor(+s.coins || 0));
    for (const k of Object.keys(base.gear)) {
      const max = GEAR[k].levels.length - 1;
      base.gear[k] = Math.max(0, Math.min(max, Math.floor(+(s.gear && s.gear[k]) || 0)));
    }
    for (const k of Object.keys(base.owned)) {        // items you own; an old save (that only knew your level) owns everything up to it
      const max = GEAR[k].levels.length - 1, have = s.owned && Array.isArray(s.owned[k]) ? s.owned[k] : null;
      const set = new Set([0, base.gear[k]]);
      if (have) have.forEach(i => { i = Math.floor(+i); if (i >= 0 && i <= max) set.add(i); }); else for (let i = 0; i <= base.gear[k]; i++) set.add(i);
      base.owned[k] = [...set].sort((a, b) => a - b);
    }
    base.spears = Math.max(0, Math.floor(+s.spears || 0));
    base.repel = Math.max(0, Math.floor(+s.repel || 0));
    if (s.hold && typeof s.hold === 'object') for (const k of Object.keys(s.hold)) { const n = Math.floor(+s.hold[k] || 0); if (n > 0) base.hold[k] = n; }
    if (s.dex && typeof s.dex === 'object') for (const k of Object.keys(s.dex)) { const n = Math.floor(+(s.dex[k] && s.dex[k].n) || 0); if (n > 0) base.dex[k] = { n }; }
    if (s.stats && typeof s.stats === 'object') for (const k of Object.keys(base.stats)) base.stats[k] = Math.max(0, +s.stats[k] || 0);
  }
  save = base;
  const st = read(SET);
  if (st && typeof st === 'object') {
    settings.mute = !!st.mute;
    settings.vol = Math.max(0, Math.min(1, +st.vol)) || (st.vol === 0 ? 0 : 0.8);
    settings.sens = Math.max(0.3, Math.min(3, +st.sens || 1));
    settings.lite = !!st.lite;
    settings.camDist = [0, 1, 2].includes(+st.camDist) ? +st.camDist : 1;
  }
  return save;
}

let timer = 0;
export function persist() {                 // saves soon (so many quick changes become one write)
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}
export function flush() {
  clearTimeout(timer);
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode or full: the game still works, it just can't remember */ }
}
export function saveSettings() { try { localStorage.setItem(SET, JSON.stringify(settings)); } catch (e) {} }
export function resetAll() { save = fresh(); flush(); return save; }
addEventListener('pagehide', flush);
addEventListener('beforeunload', flush);
