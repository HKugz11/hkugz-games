// GADGET GUARD - the numbers: maps, turrets, robots, difficulties and how the waves are built.
import { rng } from './core.js?v=10';

export const CELL = 4;   // one grid cell is 4 world units wide

// ---------------------------------------------------------------- themes (sky + fog + light)
export const THEMES = {
  meadow: { sky: [0x2f8cff, 0x8fd8ff, 0xfff0d8], fog: [0xbfe9ff, 150, 430], hemi: [0xcfeaff, 0x8a9a6a, 1.05], sun: [0xfff1d0, 2.3], ground: [0x8fd86a, 0x86d062], path: 0xe9d49a, edge: 0x5da843, water: 0x4ab0e8, style: 'meadow' },
  dusk: { sky: [0x4a2f8a, 0xff8a5a, 0xffd89a], fog: [0xffc9a0, 140, 420], hemi: [0xffd9b0, 0x9a6a4a, 1.0], sun: [0xffb070, 2.1], sunStr: .8, ground: [0xe3a36a, 0xdc9a60], path: 0xf8e3b4, edge: 0xb8723c, water: 0x7a4a8a, style: 'desert' },
  frost: { sky: [0x5aa8ff, 0xbfe8ff, 0xffffff], fog: [0xe6f4ff, 130, 400], hemi: [0xdff2ff, 0x9ab4c8, 1.12], sun: [0xffffff, 2.0], ground: [0xf2fbff, 0xe3f3fb], path: 0x9fc4e0, edge: 0xb9d6e8, water: 0x6ab4e0, style: 'frost' },
};

// ---------------------------------------------------------------- maps: paths are lists of cell corners (the walk goes straight between them); the last corner is the core
export const MAPS = [
  { id: 'meadow', name: 'Meadow Run', blurb: 'One winding S-shaped road. A friendly place to learn.', cols: 16, rows: 11, theme: 'meadow', paths: [[[0, 2], [12, 2], [12, 5], [3, 5], [3, 8], [15, 8]]], seed: 11, tough: 1 },
  { id: 'gates', name: 'Twin Gates', blurb: 'Two portals, one core. Robots come from both sides and the roads join up.', cols: 20, rows: 12, theme: 'dusk', paths: [[[0, 1], [16, 1], [16, 4], [6, 4], [6, 7], [19, 7]], [[0, 10], [11, 10], [11, 7], [19, 7]]], seed: 23, tough: 1.06 },
  { id: 'spiral', name: 'Frozen Spiral', blurb: 'A very long road spiralling in. Tight spots between the lanes.', cols: 16, rows: 12, theme: 'frost', paths: [[[0, 1], [14, 1], [14, 10], [2, 10], [2, 3], [11, 3], [11, 8], [5, 8], [5, 5], [8, 5]]], seed: 37, tough: 1.22 },
];

// ---------------------------------------------------------------- difficulties
export const DIFFS = {
  easy: { name: 'Easy', lives: 30, gold: 300, hp: .85, reward: 1.1 },
  normal: { name: 'Normal', lives: 20, gold: 220, hp: 1, reward: 1 },
  hard: { name: 'Hard', lives: 12, gold: 170, hp: 1.3, reward: .95 },
};
export const TOTAL_WAVES = 30;

// ---------------------------------------------------------------- turrets. Arrays are indexed by level - 1 (4 levels). Ranges are in cells.
export const TURRETS = {
  pop: { name: 'Pop Blaster', short: 'POP', cost: 60, col: 0xffb02a, air: true, up: [50, 90, 160], range: [3.4, 3.6, 3.9, 4.3], dmg: [7, 11, 16, 25], rate: [3, 3.4, 3.9, 5], desc: 'Fast and cheap. Great against swarms, weak against armor.' },
  boom: { name: 'Boomer', short: 'BOOM', cost: 120, col: 0xff5a3a, air: false, up: [100, 170, 300], range: [3.8, 4.0, 4.3, 4.7], dmg: [40, 66, 100, 160], rate: [.7, .75, .8, .9], splash: [1.25, 1.45, 1.7, 2.0], desc: 'Lobs shells that splash a crowd. Cannot hit flyers.' },
  frost: { name: 'Frost Zapper', short: 'FROST', cost: 90, col: 0x4ad8ff, air: true, up: [70, 130, 220], range: [3.2, 3.5, 3.8, 4.2], dmg: [8, 12, 18, 26], rate: [1.4, 1.5, 1.7, 2], slow: [.4, .45, .5, .55], slowT: [1.6, 1.8, 2, 2.4], desc: 'Slows robots down. Level 4 can freeze them solid.' },
  rail: { name: 'Rail Sniper', short: 'RAIL', cost: 180, col: 0xb06bff, air: true, up: [150, 260, 450], range: [7, 7.6, 8.3, 9.2], dmg: [110, 190, 300, 480], rate: [.5, .52, .55, .6], desc: 'Huge range and big hits. Armor barely scratches it.' },
  tesla: { name: 'Tesla Coil', short: 'TESLA', cost: 200, col: 0xffe14a, air: true, up: [160, 280, 480], range: [3.0, 3.2, 3.5, 3.9], dmg: [22, 32, 46, 70], rate: [1.1, 1.2, 1.3, 1.5], chain: [3, 4, 5, 7], desc: 'Lightning jumps between robots. Great against groups.' },
  boost: { name: 'Booster', short: 'BOOST', cost: 130, col: 0x6aff9a, air: true, up: [110, 190, 330], range: [1.55, 1.55, 1.85, 1.85], buff: [.2, .3, .42, .6], desc: 'Does not shoot. Makes the turrets around it hit harder and faster.' },
};
export const TURRET_IDS = Object.keys(TURRETS);

// ---------------------------------------------------------------- robots. speed is world units per second (a cell is 4)
export const ENEMIES = {
  scout: { name: 'Scout', hp: 30, speed: 7, armor: 0, reward: 5, leak: 1, threat: 6, gap: .55, from: 1, col: 0x2ee6c8, r: .9, sc: 1.2, bar: 4.2 },
  grunt: { name: 'Grunt', hp: 70, speed: 4.6, armor: 1, reward: 6, leak: 1, threat: 10, gap: .85, from: 1, col: 0xff9a2a, r: 1.0, sc: 1.25, bar: 4.6 },
  swarm: { name: 'Swarmlet', hp: 16, speed: 5.6, armor: 0, reward: 2, leak: 1, threat: 3, gap: .26, from: 3, col: 0xffe14a, r: .6, sc: 1.2, bar: 3.2 },
  tank: { name: 'Tank', hp: 320, speed: 3, armor: 6, reward: 18, leak: 3, threat: 42, gap: 1.7, from: 6, col: 0x8a5cff, r: 1.5, sc: 1.2, bar: 4.8 },
  flyer: { name: 'Copter', hp: 90, speed: 5, armor: 0, reward: 10, leak: 1, threat: 24, gap: 1.1, from: 8, col: 0x6ac8ff, r: 1.0, air: true, sc: 1.2, bar: 6.6 },
  healer: { name: 'Medic', hp: 120, speed: 4, armor: 1, reward: 14, leak: 2, threat: 30, gap: 1.6, from: 12, col: 0x4aff8a, r: 1.0, sc: 1.25, bar: 4.6 },
  boss: { name: 'MEGA BOT', hp: 2200, speed: 2.4, armor: 8, reward: 150, leak: 10, threat: 400, gap: 1, from: 10, col: 0xff4a5a, r: 2.6, sc: 1.55, bar: 9.4 },
};

export const TUNE = { budgetA: 40, budgetK: 16, budgetP: 1.4, hpA: .19, hpB: .010, boss: 3200 };   // the balance knobs
export const hpMul = n => 1 + TUNE.hpA * (n - 1) + TUNE.hpB * (n - 1) * (n - 1);
export const waveBonus = n => 25 + 3 * n;

// what a wave looks like: groups of robots, spawned one after the other (flyers fly in alongside).
const THEME_W = [{ grunt: 3, scout: 2 }, { swarm: 4, grunt: 1, scout: 1 }, { tank: 3, grunt: 2, healer: .7 }, { flyer: 3, scout: 1, swarm: 1 }, { grunt: 2, tank: 1.2, scout: 1.2, healer: .8, flyer: 1 }];
const ORDER = ['swarm', 'scout', 'grunt', 'flyer', 'healer', 'tank'];
export function waveDef(n) {
  const r = rng(n * 7919 + 13), boss = n % 10 === 0; let budget = TUNE.budgetA + TUNE.budgetK * Math.pow(n, TUNE.budgetP); if (boss) budget *= .7;
  const w = Object.assign({}, THEME_W[(n - 1) % 5]); for (const k in w) if (ENEMIES[k].from > n) delete w[k]; if (!Object.keys(w).length) w.grunt = 1;
  const counts = {}; let guard = 0;
  while (budget > 0 && guard++ < 600) {   // keep adding robots until the threat budget for this wave is spent
    const keys = Object.keys(w).filter(k => ENEMIES[k].threat <= budget + 6); if (!keys.length) break;
    const tot = keys.reduce((a, k) => a + w[k], 0); let x = r() * tot, pick = keys[0]; for (const k of keys) { x -= w[k]; if (x <= 0) { pick = k; break; } }
    counts[pick] = (counts[pick] || 0) + 1; budget -= ENEMIES[pick].threat;
  }
  const groups = []; if (boss) groups.push({ type: 'boss', count: 1 + Math.floor((n - 10) / 30), gap: 1, at: 0 });
  let t = boss ? 4 : 0, ground = 0; const flyers = counts.flyer || 0;
  for (const type of ORDER) {
    const c = counts[type]; if (!c) continue; if (type === 'flyer') continue;
    groups.push({ type, count: c, gap: ENEMIES[type].gap, at: t }); t += c * ENEMIES[type].gap + 1.2; ground += c;
  }
  if (flyers) groups.push({ type: 'flyer', count: flyers, gap: ENEMIES.flyer.gap, at: Math.max(2, t * .35) });
  // keep a wave from lasting too long: squeeze the gaps so everyone has spawned within ~30 seconds
  const end = Math.max(...groups.map(g => g.at + g.count * g.gap)); if (end > 30) { const k = 30 / end; for (const g of groups) { g.at *= k; g.gap = Math.max(.12, g.gap * k); } }
  return { n, boss, groups, count: groups.reduce((a, g) => a + g.count, 0), label: boss ? 'BOSS WAVE' : 'WAVE ' + n, kinds: groups.map(g => g.type) };
}
