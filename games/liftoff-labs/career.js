// Money, unlocked parts, missions and saved rockets. Everything lives in this browser (localStorage), keys start with "ll.".
import { PARTS, PART_LIST, MILESTONES, MILESTONE, BODIES } from './data.js?v=1';
import { V } from './vec.js?v=1';
import { validDesign } from './design.js?v=1';

const K_CAREER = 'll.career', K_SHIPS = 'll.ships', K_SET = 'll.settings', K_LAST = 'll.last';
const get = (k) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

export const START_FUNDS = 3000;
export const fmt$ = (n) => '$' + Math.round(n).toLocaleString('en-US');

export const settings = Object.assign({ quality: null, easy: false, vol: 0.7, mode: 'career' }, get(K_SET) || {});
export const saveSettings = () => put(K_SET, settings);

class Career {
  constructor() {
    const d = get(K_CAREER) || {};
    this.funds = typeof d.funds === 'number' ? d.funds : START_FUNDS;
    this.bought = new Set(d.bought || []);
    this.done = new Set(d.done || []);
    this.contracts = Array.isArray(d.contracts) ? d.contracts : [];
    this.seed = d.seed || 1;
    this.stats = Object.assign({ flights: 0, bestAlt: 0, bestSpeed: 0, landings: 0 }, d.stats || {});
    if (!this.contracts.length) this.makeContracts();
  }
  save() { put(K_CAREER, { funds: this.funds, bought: [...this.bought], done: [...this.done], contracts: this.contracts, seed: this.seed, stats: this.stats }); }
  reset() { this.funds = START_FUNDS; this.bought = new Set(); this.done = new Set(); this.contracts = []; this.stats = { flights: 0, bestAlt: 0, bestSpeed: 0, landings: 0 }; this.seed = 1; this.makeContracts(); this.save(); }

  sandbox() { return settings.mode === 'sandbox'; }
  reqMet(p) { return !p.req || this.sandbox() || this.done.has(p.req); }
  unlocked(id) { const p = PARTS[id]; return !!p && (this.sandbox() || p.price === 0 && !p.req || this.bought.has(id)); }
  // why you cannot buy it right now ('' = you can)
  whyNotBuy(id) {
    const p = PARTS[id];
    if (this.unlocked(id)) return 'You already own this part.';
    if (!this.reqMet(p)) return 'First: ' + MILESTONE[p.req].name + '.';
    if (this.funds < p.price) return 'You need ' + fmt$(p.price - this.funds) + ' more.';
    return '';
  }
  buy(id) { if (this.whyNotBuy(id)) return false; this.funds -= PARTS[id].price; this.bought.add(id); this.save(); return true; }
  earn(n) { if (this.sandbox()) return; this.funds += n; this.save(); }
  unlockedSet() { return new Set(PART_LIST.filter((p) => this.unlocked(p.id)).map((p) => p.id)); }
  locked() { return PART_LIST.filter((p) => !this.unlocked(p.id)); }

  // ---- contracts: little jobs that pay money, made up fresh as you get better
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  makeContracts() {
    const d = this.done, tier = (d.has('space') ? 3 : d.has('k10') ? 2 : d.has('k1') ? 1 : 0) + (d.has('orbit') ? 2 : 0) + (d.has('moonSoi') ? 1 : 0);
    const pick = (a) => a[Math.min(a.length - 1, Math.floor(this.rnd() * a.length))];
    const list = [];
    const alts = [[1500, 2500, 3500], [4000, 6000, 8000], [15000, 25000, 40000], [70000, 90000, 120000], [150000, 220000, 300000], [300000, 400000, 500000], [500000, 700000, 900000]][Math.min(tier, 6)];
    const have = () => new Set(list.map((c) => c.type));
    const alt = pick(alts); list.push({ id: 'c' + Math.floor(this.rnd() * 1e9), type: 'alt', target: alt, reward: Math.round(alt * 0.35 / 100) * 100 + 600, text: 'Fly up to ' + alt.toLocaleString('en-US') + ' m.' });
    const spd = pick([[300, 400], [500, 700], [900, 1200], [1500, 2000], [2200, 2600]][Math.min(Math.floor(tier * 0.8), 4)]);
    if (tier >= 1) list.push({ id: 'c' + Math.floor(this.rnd() * 1e9), type: 'speed', target: spd, reward: Math.round(spd * 2.2 / 100) * 100 + 500, text: 'Reach a speed of ' + spd.toLocaleString('en-US') + ' m/s.' });
    const lh = pick([[600, 1500], [3000, 6000], [10000, 30000], [60000, 80000]][Math.min(tier, 3)]), lr = pick([5, 3, 2]);
    list.push({ id: 'c' + Math.floor(this.rnd() * 1e9), type: 'land', target: lh, radius: lr, reward: 900 + Math.round(lh * 0.12 / 100) * 100 + (lr <= 2 ? 1500 : lr <= 3 ? 900 : 300), text: 'Go above ' + lh.toLocaleString('en-US') + ' m, then land safely within ' + lr + ' km of the pad.' });
    if (d.has('orbit')) { const pe = pick([75, 90, 120, 200]); list.push({ id: 'c' + Math.floor(this.rnd() * 1e9), type: 'orbit', target: pe * 1000, reward: 9000 + pe * 120, text: 'Get an orbit with the low point (Pe) above ' + pe + ' km.' }); }
    void have;
    for (const x of list) x.after = this.stats.flights;           // only a flight that starts after the contract appears can finish it
    this.contracts = list.slice(0, 4);
  }

  // ---- the check that runs while you fly. `s` is a summary of the flight so far; returns newly earned things.
  check(s) {
    const out = [];
    const mile = (id, cond) => { if (cond && !this.done.has(id)) { this.done.add(id); const m = MILESTONE[id]; this.earn(m.reward); out.push({ kind: 'milestone', name: m.name, reward: m.reward, id }); } };
    mile('liftoff', s.alt > 10 && !s.landed);
    mile('stage', s.staged);
    mile('k1', s.maxAlt >= 1000);
    mile('fast', s.maxSpeed >= 340);
    mile('k10', s.maxAlt >= 10000);
    mile('space', s.maxAlt >= 60000);
    mile('orbit', s.orbit);
    mile('moonSoi', s.visitedBean);
    mile('moonOrbit', s.beanOrbit);
    mile('moonLand', s.landed && s.body === 'bean' && s.maxAlt > 0);
    mile('landed', s.landed && s.body === 'cobble' && s.flightAlt > 500 && s.safe);
    mile('pin', s.landed && s.body === 'cobble' && s.flightAlt > 5000 && s.safe && s.padDist < 2000);
    mile('orbitHome', s.landed && s.body === 'cobble' && s.wasOrbit && s.safe);
    mile('moonHome', s.landed && s.body === 'cobble' && s.visitedBean && s.landedBean && s.safe);
    // contracts
    for (const c of this.contracts.slice()) {
      if ((s.flightNo || 0) <= (c.after || 0)) continue;
      let ok = false;
      if (c.type === 'alt') ok = s.maxAlt >= c.target;
      else if (c.type === 'speed') ok = s.maxSpeed >= c.target;
      else if (c.type === 'land') ok = s.landed && s.body === 'cobble' && s.safe && s.flightAlt >= c.target && s.padDist <= c.radius * 1000;
      else if (c.type === 'orbit') ok = s.orbitPe >= c.target;
      if (ok) { this.contracts = this.contracts.filter((x) => x !== c); this.earn(c.reward); out.push({ kind: 'contract', name: c.text, reward: c.reward, id: c.id }); this.stats.contracts = (this.stats.contracts || 0) + 1; }
    }
    if (out.length) { if (this.contracts.length < 3) this.makeContracts(); this.save(); }
    return out;
  }
}

export const career = new Career();

// ---- saved rockets
export const loadShips = () => { const all = get(K_SHIPS) || {}, out = {}; for (const k of Object.keys(all)) if (validDesign(all[k])) out[k] = all[k]; return out; };
export function saveShip(design) {
  const all = loadShips(); all[design.name || 'My Rocket'] = design; return put(K_SHIPS, all);
}
export function deleteShip(name) { const all = loadShips(); delete all[name]; return put(K_SHIPS, all); }
export const saveLast = (design) => put(K_LAST, design);
export const loadLast = () => { const d = get(K_LAST); return validDesign(d) ? d : null; };
export { BODIES, V };
