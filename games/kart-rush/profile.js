// KART RUSH - your profile: lifetime stats, what you have unlocked (colours, hats, karts) and the secret code. Saved in this browser (keys kr.*, so save codes carry it).
import { load, save, hash32 } from './core.js?v=3';

export const RAINBOW = 1;   // a paint "colour" that cycles through every colour
export const BASE_COLORS = [0xff4a4a, 0xff9a1a, 0xffd31a, 0x6aff4a, 0x2ee6ff, 0x4a6aff, 0xb06bff, 0xff4fa8];
export const PAINTS = [
  ...BASE_COLORS.map((c, i) => ({ key: 'paint:' + i, id: c, name: 'Colour ' + (i + 1) })),
  { key: 'paint:gold', id: 0xffc93a, name: 'Gold', need: { k: 'wins', n: 3, txt: 'Win 3 races' } },
  { key: 'paint:chrome', id: 0xcfd8e6, name: 'Chrome', need: { k: 'cups', n: 1, txt: 'Win a cup' } },
  { key: 'paint:rainbow', id: RAINBOW, name: 'Rainbow', need: { k: 'cups', n: 3, txt: 'Win 3 cups' } },
];
export const HATS = [
  { key: 'hat:none', id: 'none', name: 'No hat' },
  { key: 'hat:cone', id: 'cone', name: 'Party hat' },
  { key: 'hat:ears', id: 'ears', name: 'Cat ears' },
  { key: 'hat:prop', id: 'prop', name: 'Propeller cap', need: { k: 'wins', n: 1, txt: 'Win a race' } },
  { key: 'hat:phones', id: 'phones', name: 'Headphones', need: { k: 'races', n: 10, txt: 'Finish 10 races' } },
  { key: 'hat:tophat', id: 'tophat', name: 'Top hat', need: { k: 'coins', n: 100, txt: 'Collect 100 coins' } },
  { key: 'hat:wizard', id: 'wizard', name: 'Wizard hat', need: { k: 'tricks', n: 20, txt: 'Do 20 jump tricks' } },
  { key: 'hat:crown', id: 'crown', name: 'Crown', need: { k: 'cups', n: 1, txt: 'Win a cup' } },
];

const P0 = { races: 0, wins: 0, podiums: 0, cups: 0, tricks: 0, coins: 0, secret: false, seen: [] };
export const PROFILE = Object.assign({}, P0, load('profile', {})); if (!Array.isArray(PROFILE.seen)) PROFILE.seen = [];
export const saveProfile = () => save('profile', PROFILE);
export const bump = (k, n = 1) => { PROFILE[k] = (PROFILE[k] || 0) + n; };
export const meets = need => !need || (need.secret ? !!PROFILE.secret : (PROFILE[need.k] || 0) >= need.n);
export const needText = need => !need ? '' : need.secret ? 'A secret...' : need.txt + ' (' + Math.min(PROFILE[need.k] || 0, need.n) + '/' + need.n + ')';
// announce things that just became available (each only once); `items` = every unlockable { key, name, need }
export function checkUnlocks(items) { const out = []; for (const it of items) if (it.need && meets(it.need) && !PROFILE.seen.includes(it.key)) { PROFILE.seen.push(it.key); out.push(it); } if (out.length) saveProfile(); return out; }

// the secret code: type it on the main menu. Only a hash of it is stored here.
const SECRET_LEN = 8, SECRET_H = 2460909209;
let typed = '';
export function secretKey(ch) {   // feed it letters; true when the secret was just entered
  if (!/^[A-Za-z]$/.test(ch)) return false; typed = (typed + ch.toUpperCase()).slice(-SECRET_LEN);
  if (typed.length === SECRET_LEN && hash32(typed) === SECRET_H) { typed = ''; if (!PROFILE.secret) { PROFILE.secret = true; saveProfile(); return true; } }
  return false;
}
