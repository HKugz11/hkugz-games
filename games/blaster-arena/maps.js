// Map definitions for Blaster Arena.
// Each map = a theme (colors/lighting) + a build(b) function that places collidable boxes, plus spawn/loot candidates.
// The game filters spawn/loot candidates that land inside geometry, so they only need to be roughly right.
// Step-ups: the player/bots auto-climb ledges up to 0.6 high, so stairs use 0.55 increments.

const CRATE = [0x2ee6ff, 0xff4fa8, 0xffd31a, 0x8aff3a, 0xb06bff, 0xff7a1a];

export const MAPS = [
  {
    id: 'plaza', name: 'Pastel Plaza', half: 32,
    blurb: 'Colorful crates around a stair-step plateau. A friendly all-rounder.',
    swatch: ['#2f8cff', '#8fd8ff', '#b9f0d8'],
    theme: { sky: [0x2f8cff, 0x8fd8ff, 0xfff0d8], sunStr: 1, fog: [0xbfe9ff, 45, 150], floor: ['#8fe3c0', '#7fc8ff', 'rgba(40,20,90,.28)'], ground: 0x7a5ad0, wall: 0x3a2f78,
      strips: [0x2ee6ff, 0xff4fa8, 0xffd31a, 0x8aff3a], hemi: [0xcfeaff, 0x8a6ad0, 1.05], sun: [0xfff1d0, 2.3], exposure: 1.1, clouds: 0xffffff, deco: 'balloons' },
    build(b) {
      b.box(0, .7, 0, 12, 1.4, 12, 0xf2e6ff);
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (const [off, h] of [[7.4, 1.0], [8.9, .5]]) { const cx = dx * off, cz = dz * off, sx = dx ? 1.5 : 5, sz = dz ? 1.5 : 5; b.box(cx, h / 2, cz, sx, h, sz, h > .7 ? 0xd9c4ff : 0xc4a8ff); }
      b.box(0, 1.4 + 1.6, 0, 3, 3.2, 3, 0xff4fa8);
      for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) b.box(x, 1.4 + .6, z, 2, 1.2, 1, 0xffd31a);
      const crates = [[-15, -10, 3, 2, 3, 0xff6a5a], [-15, 10, 3, 2, 3, 0xffd34e], [15, -10, 3, 2, 3, 0x4adfa0], [15, 10, 3, 2, 3, 0x6ab0ff], [0, -19, 7, 2.2, 2, 0xb06bff], [0, 19, 7, 2.2, 2, 0xff8a3a],
        [-21, 0, 2, 3.5, 7, 0x4a6aff], [21, 0, 2, 3.5, 7, 0xff4fa8], [-9, -25, 3, 1.5, 3, 0x2ee6ff], [9, 25, 3, 1.5, 3, 0xff6a5a], [-24, -19, 3, 3, 3, 0xffd34e], [24, 19, 3, 3, 3, 0x8aff3a],
        [-25, 20, 4, 1.2, 4, 0xb06bff], [25, -20, 4, 1.2, 4, 0x6ab0ff], [-9, 14, 2, 1.4, 2, 0xff8a3a], [9, -14, 2, 1.4, 2, 0x4adfa0], [-13, -3, 1.5, 1.2, 4, 0xff4fa8], [13, 3, 1.5, 1.2, 4, 0xffd34e], [-26, 8, 2, 2, 2, 0x4adfa0], [26, -8, 2, 2, 2, 0xff6a5a]];
      for (const [x, z, sx, sy, sz, c] of crates) b.box(x, sy / 2, z, sx, sy, sz, c);
    },
    spawns: [[-27, -27], [27, -27], [-27, 27], [27, 27], [0, -28], [0, 28], [-28, 0], [28, 0], [-12, -18], [12, 18]],
    loot: [[-11, -11], [11, 11], [-11, 11], [11, -11], [0, -12], [0, 12], [-25, 0], [25, 0], [-24, -26], [24, 26], [-18, 22], [18, -22], [-5, -27], [5, 27], [-22, 12], [22, -12], [0, -26], [0, 26]],
    dmg: [[0, 1.4, 4.2], [0, 1.4, -4.2]],
  },
  {
    id: 'docks', name: 'Neon Docks', half: 34,
    blurb: 'Night-time shipping yard. Long container lanes, a raised crane deck, glowing neon.',
    swatch: ['#0a0620', '#5a2a9a', '#ff4fa8'],
    theme: { sky: [0x0a0620, 0x2a1560, 0xff4fa8], sunStr: 0, fog: [0x2a1455, 30, 120], floor: ['#3a2f78', '#2c2360', 'rgba(46,230,255,.4)'], ground: 0x140c34, wall: 0x1f1850,
      strips: [0x2ee6ff, 0xff4fa8, 0xffd31a, 0x8aff3a], hemi: [0x9a8aff, 0x1a1040, .8], sun: [0xb0a0ff, 1.3], exposure: 1.05, clouds: 0x5a4a98, deco: 'stars' },
    build(b) {
      let ci = 0;
      for (const [z, omit] of [[-22, 0], [-11, 1], [11, -1], [22, 0]]) for (let i = -2; i <= 2; i++) { if (i === omit) continue; b.box(i * 13, 1.3, z, 9, 2.6, 2.6, CRATE[ci++ % 6]); }
      for (const x of [-26, 26]) for (const z of [-22, 22]) b.box(x, 3.9, z, 9, 2.6, 2.6, CRATE[(ci++) % 6]);          // second tier
      b.box(0, .55, 0, 10, 1.1, 10, 0x5a4a9a);                                                                           // crane deck
      for (const [x, z, sx, sz] of [[-6.2, 0, 2.4, 6], [6.2, 0, 2.4, 6], [0, -6.2, 6, 2.4], [0, 6.2, 6, 2.4]]) b.box(x, .275, z, sx, .55, sz, 0x7a6aba);   // deck steps
      b.box(0, 5.1, 0, 2, 8, 2, 0xff4fa8);                                                                             // crane tower
      b.box(-17, .6, 0, 1.2, 1.2, 5, 0x2ee6ff); b.box(17, .6, 0, 1.2, 1.2, 5, 0xffd31a);
      for (const [x, z] of [[-6, -16.5], [6, -16.5], [-6, 16.5], [6, 16.5], [-26, 0], [26, 0]]) b.box(x, .6, z, 4, 1.2, 1, 0xb06bff);
      for (const [x, z, c] of [[-31, -31, 0x2ee6ff], [31, -31, 0xff4fa8], [-31, 31, 0xffd31a], [31, 31, 0x8aff3a], [0, -15, 0xff4fa8], [0, 15, 0x2ee6ff]]) b.glow(x, 4, z, .4, 8, .4, c);
    },
    spawns: [[-30, -30], [30, -30], [-30, 30], [30, 30], [0, -31], [0, 31], [-31, 0], [31, 0], [-20, -16.5], [20, 16.5], [20, -16.5], [-20, 16.5], [-9, 0], [9, 0]],
    loot: [[-26, 16.5], [-16, 16.5], [-4, 16.5], [8, 16.5], [20, 16.5], [-26, -16.5], [-14, -16.5], [0, -16.5], [14, -16.5], [26, -16.5], [-20, 0], [20, 0], [-31, -15], [-31, 15], [31, -15], [31, 15],
      [-20, -28.5], [-6, -28.5], [8, -28.5], [22, -28.5], [-20, 28.5], [-6, 28.5], [8, 28.5], [22, 28.5]],
    dmg: [[0, 1.1, 3.5], [0, 1.1, -3.5]],
  },
  {
    id: 'ruins', name: 'Sunset Ruins', half: 32,
    blurb: 'Crumbling pillars, sandstone arches and a stepped pyramid with a sniper perch.',
    swatch: ['#2a3a8a', '#ff9a5a', '#ffe0a0'],
    theme: { sky: [0x2a3a8a, 0xff9a5a, 0xffe0a0], sunStr: 1.4, fog: [0xffc890, 40, 140], floor: ['#f0d9a0', '#e0c185', 'rgba(120,70,20,.25)'], ground: 0xb98a50, wall: 0xb07a4a,
      strips: [0xffd34e, 0xff7a1a, 0xff4a5a, 0x4adfa0], hemi: [0xffe0b0, 0xb07a4a, 1.0], sun: [0xffd9a0, 2.4], exposure: 1.1, clouds: 0xffe6c8, deco: 'none' },
    build(b) {
      [[16, .55, .275, 0xe8cf9a], [12, .55, .825, 0xdcc088], [8, .55, 1.375, 0xcfb078], [4, .55, 1.925, 0xf5deb0]].forEach(([w, h, y, c]) => b.box(0, y, 0, w, h, w, c));   // stepped pyramid (top at 2.2)
      const heights = [7, 3.5, 7, 5, 7, 3.5, 6, 7, 4, 7];
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + .3, r = 15; b.box(Math.cos(a) * r, heights[i] / 2, Math.sin(a) * r, 2, heights[i], 2, 0xc79a62); }
      const arch = (cx, cz, alongZ) => { const o = 3.5; if (alongZ) { b.box(cx, 3, cz - o, 2, 6, 2, 0xc79a62); b.box(cx, 3, cz + o, 2, 6, 2, 0xc79a62); b.box(cx, 5, cz, 2.4, 1.6, 9, 0xd9b078); } else { b.box(cx - o, 3, cz, 2, 6, 2, 0xc79a62); b.box(cx + o, 3, cz, 2, 6, 2, 0xc79a62); b.box(cx, 5, cz, 9, 1.6, 2.4, 0xd9b078); } };
      arch(-23, 0, true); arch(23, 0, true); arch(0, -23, false); arch(0, 23, false);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.box(sx * 19, .65, sz * 9, 8, 1.3, 1, 0xb88a56); b.box(sx * 9, .65, sz * 19, 1, 1.3, 8, 0xb88a56); }
      for (const [x, z, sx, sy, sz] of [[-9, -22, 3, 2, 3], [9, 22, 3, 2, 3], [-22, 15, 3, 1.6, 3], [22, -15, 3, 1.6, 3], [-27, -10, 2, 2.4, 2], [27, 10, 2, 2.4, 2], [10, -26, 4, 1.4, 2], [-10, 26, 4, 1.4, 2]]) b.box(x, sy / 2, z, sx, sy, sz, 0xcaa06a);
    },
    spawns: [[-28, -28], [28, -28], [-28, 28], [28, 28], [0, -29], [0, 29], [-29, 0], [29, 0], [-14, -22], [14, 22]],
    loot: [[-11, -11], [11, 11], [-11, 11], [11, -11], [0, -12], [0, 12], [-12, 0], [12, 0], [-24, -24], [24, 24], [-24, 24], [24, -24], [-16, -27], [16, 27], [-27, 14], [27, -14], [0, -18], [0, 18], [-18, 0], [18, 0]],
    dmg: [[1.2, 2.2, 1.2], [-1.2, 2.2, -1.2]],
  },
  {
    id: 'frost', name: 'Frost Fort', half: 30,
    blurb: 'A snowy fort with four corner towers you can climb. Fight in the courtyard or snipe from the walls.',
    swatch: ['#6aa8ff', '#c6e6ff', '#ffffff'],
    theme: { sky: [0x6aa8ff, 0xc6e6ff, 0xffffff], sunStr: .6, fog: [0xd2e8f8, 35, 130], floor: ['#f2f9ff', '#d6ebfa', 'rgba(50,90,140,.38)'], ground: 0x9cbcd8, wall: 0x4f78a8,
      strips: [0x2ee6ff, 0x7cc8ff, 0xffffff, 0xb06bff], hemi: [0xe6f4ff, 0x9ab8d8, 1.1], sun: [0xffffff, 2.0], exposure: 1.1, clouds: 0xffffff, deco: 'snow' },
    build(b) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const tx = sx * 21, tz = sz * 21;
        b.box(tx, 1.1, tz, 7, 2.2, 7, 0x6f9cc8);                                                              // tower (deck at 2.2)
        b.box(tx + sx * 3.2, 2.2 + .45, tz, .6, .9, 7, 0x4f78a8); b.box(tx, 2.2 + .45, tz + sz * 3.2, 7, .9, .6, 0x4f78a8);   // parapets on the outer sides
        [[.7, 1.65], [2.1, 1.1], [3.5, .55]].forEach(([d, h]) => { b.box(tx - sx * (3.5 + d), h / 2, tz, 1.4, h, 3, 0xa4c8e8); b.box(tx, h / 2, tz - sz * (3.5 + d), 3, h, 1.4, 0xa4c8e8); });   // stairs from the courtyard side
        b.box(sx * 21, 1.7, sz * 8, 1.4, 3.4, 8, 0x5e8cbb); b.box(sx * 8, 1.7, sz * 21, 8, 3.4, 1.4, 0x5e8cbb);     // fort walls with gates in the middle
      }
      b.box(0, 2, 0, 4, 4, 4, 0x86c0ee);
      for (const [x, z, sx, sz] of [[-9, 0, 1, 5], [9, 0, 1, 5], [0, -9, 5, 1], [0, 9, 5, 1]]) b.box(x, .6, z, sx, 1.2, sz, 0xa4c8e8);
      for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) b.box(x, .8, z, 2, 1.6, 2, 0x6f9cc8);
      for (const [x, z] of [[-27, -5], [27, 5], [5, -27], [-5, 27]]) b.box(x, .9, z, 2.5, 1.8, 2.5, 0x86c0ee);
    },
    spawns: [[-27, -27], [27, -27], [-27, 27], [27, 27], [0, -27], [0, 27], [-27, 0], [27, 0], [-12, 0], [12, 0], [0, -12], [0, 12]],
    loot: [[-6, -6], [6, 6], [-6, 6], [6, -6], [0, -14], [0, 14], [-14, 0], [14, 0], [-15, -15], [15, 15], [-15, 15], [15, -15], [0, -27], [0, 27], [-27, 0], [27, 0], [-27, 15], [27, -15], [-15, 27], [15, -27],
      [21, 21, 2.2], [-21, -21, 2.2], [21, -21, 2.2], [-21, 21, 2.2]],
    dmg: [[21, 2.2, 21], [-21, 2.2, -21]],
  },
];

// ---------------------------------------------------------------------------------------------
// Battle Royale maps: bigger maps built just for Battle Royale (br: true). The four maps above are also
// playable in Battle Royale (the game tiles them into a bigger arena), these four are made big from the start.
// Everything is generated from a seeded random generator, so every player sees exactly the same map.
// ---------------------------------------------------------------------------------------------
const rng = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const ring = (cx, cz, r, n, a0 = 0) => Array.from({ length: n }, (_, i) => [cx + Math.cos(a0 + i / n * Math.PI * 2) * r, cz + Math.sin(a0 + i / n * Math.PI * 2) * r]);
// a stepped block you can walk up from any side (each level is .55 high). Returns the height of its top.
const mesa = (b, cx, cz, w, d, n, cols, step = 1.4) => { for (let i = 0; i < n; i++) b.box(cx, .275 + .55 * i, cz, w - 2 * step * i, .55, d - 2 * step * i, cols[i % cols.length]); return .55 * n; };
// drop things at random spots away from the places listed in `avoid` ([x, z, radius]) and away from each other
function scatter(R, half, n, avoid, spacing, fn) {
  const got = [];
  for (let t = 0; got.length < n && t < n * 60; t++) {
    const x = (R() * 2 - 1) * (half - 7), z = (R() * 2 - 1) * (half - 7);
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar) || got.some(([gx, gz]) => Math.hypot(x - gx, z - gz) < spacing)) continue;
    got.push([x, z]); fn(x, z, R);
  }
  return got;
}
// random loot candidates out in the open (the game drops the ones that land inside a wall)
const wild = (R, half, n, avoid) => { const out = []; for (let t = 0; out.length < n && t < n * 40; t++) { const x = (R() * 2 - 1) * (half - 9), z = (R() * 2 - 1) * (half - 9); if (!avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) out.push([x, z]); } return out; };

// ---- Candy Canyon ----
const CANDY = { half: 72, lane: [-44, -40], town: [42, -38], mallow: [-40, 42], sugar: [40, 40] };
const CANDY_AVOID = [[0, 0, 24], [-44, -40, 17], [42, -38, 19], [-40, 42, 17], [40, 40, 15], [0, 52, 12], [0, -52, 12], [52, 0, 12], [-52, 0, 12]];
const CANDY_HOUSES = [[-8, -7], [8, -7], [-8, 8], [8, 8]].map(([dx, dz]) => [CANDY.town[0] + dx, CANDY.town[1] + dz]);
const CANDY_LANE = (() => { const o = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) o.push([CANDY.lane[0] + i * 8, CANDY.lane[1] + j * 8]); return o; })();

// ---- Jungle Temple ----
const JUNGLE_CAMPS = [[-46, -42], [46, -42], [-46, 42], [46, 42]];
const JUNGLE_CIRCLES = [[-26, 30], [28, -30]];
const JUNGLE_AVOID = [[0, 0, 28], ...JUNGLE_CAMPS.map(([x, z]) => [x, z, 14]), ...JUNGLE_CIRCLES.map(([x, z]) => [x, z, 12])];

// ---- Skyline City ----
const CITY_C = [-60, -36, -12, 12, 36, 60];
const CITY_ST = [-72, -48, -24, 0, 24, 48, 72];

// ---- Moonbase Alpha ----
const MOON_CRATERS = [[-46, -40], [48, -38], [-52, 36], [46, 44], [2, -56], [-4, 58]];
const MOON_AVOID = [[0, 0, 26], ...MOON_CRATERS.map(([x, z]) => [x, z, 14]), [52, -4, 12]];

MAPS.push(
  {
    id: 'candy', name: 'Candy Canyon', half: CANDY.half, br: true,
    blurb: 'Battle Royale only. Sugary cliffs, a gumdrop hill, candy-cane lanes and cookie town. Huge!',
    swatch: ['#ff7ac8', '#ffc4e4', '#fff4d0'],
    theme: { sky: [0xff7ac8, 0xffc4e4, 0xfff4d0], sunStr: 1, fog: [0xffd6ec, 45, 170], floor: ['#ffd9ec', '#ffeaf4', 'rgba(255,90,160,.3)'], ground: 0xe86ab0, wall: 0xb84a90,
      strips: [0xff4fa8, 0x2ee6ff, 0xffd31a, 0x8aff3a], hemi: [0xfff0f8, 0xe86ab0, 1.1], sun: [0xfff1d0, 2.2], exposure: 1.1, clouds: 0xffffff, deco: 'balloons' },
    build(b) {
      const R = rng(7101), H = CANDY.half;
      mesa(b, 0, 0, 28, 28, 4, [0xffe6f2, 0xffc4e4, 0xffa6d4, 0xff8ac4], 3.2);                          // gumdrop hill (top at 2.2)
      b.box(0, 2.2 + 3.6, 0, 2.2, 7.2, 2.2, 0xff4fa8); b.glow(0, 12, 0, .8, 1.6, .8, 0xffd31a);
      for (const [x, z] of CANDY_LANE) { const h = 5 + Math.floor(R() * 5); b.box(x, h / 2, z, 1.6, h, 1.6, CRATE[Math.floor(R() * 6)]); b.box(x, h + .5, z, 2.4, 1, 2.4, 0xffffff); }
      for (const dz of [4, -4]) b.box(CANDY.lane[0], .7, CANDY.lane[1] + dz, 12, 1.4, 1, 0xffeaa0);       // wafer cover
      for (const [x, z] of CANDY_HOUSES) mesa(b, x, z, 10, 9, 3, [0xf2c28a, 0xff8a6a, 0xffe6c8], 1.6);   // cookie houses
      mesa(b, CANDY.mallow[0], CANDY.mallow[1], 20, 16, 3, [0xffffff, 0xffe6f2, 0xffd0e8], 3);          // marshmallow mesa
      for (const [dx, dz] of [[-14, -12], [14, -12], [-14, 12], [14, 12]]) b.box(CANDY.mallow[0] + dx, 1.2, CANDY.mallow[1] + dz, 3, 2.4, 3, CRATE[Math.floor(R() * 6)]);
      for (let i = 0; i < 6; i++) b.box(CANDY.sugar[0] + (i % 3 - 1) * 10, 1.5, CANDY.sugar[1] + (i < 3 ? -4 : 5), 6, 3, 3, CRATE[(i + 2) % 6]);   // sugar docks
      // wafer cliffs with wide gateways between them
      for (const [x, z, sx, sz] of [[-30, -52, 28, 3.5], [30, -52, 28, 3.5], [-30, 52, 28, 3.5], [30, 52, 28, 3.5], [-52, -30, 3.5, 28], [-52, 30, 3.5, 28], [52, -30, 3.5, 28], [52, 30, 3.5, 28]]) {
        b.box(x, 4, z, sx, 8, sz, 0xf2b0d0); b.box(x, 8.3, z, sx - 2, .7, sz - .4, 0xffffff);
      }
      scatter(R, H, 30, CANDY_AVOID, 6, (x, z, r) => { const w = 1.6 + r() * 2.2, h = .9 + r() * 2.2; b.box(x, h / 2, z, w, h, w + r(), CRATE[Math.floor(r() * 6)]); });
      scatter(R, H, 12, CANDY_AVOID, 8, (x, z, r) => { const h = 5 + r() * 3; b.box(x, h / 2, z, 1.3, h, 1.3, 0xff4a5a); b.box(x, h + .4, z, 2, .8, 2, 0xffffff); });
    },
    spawns: ring(0, 0, 58, 12),
    loot: [
      ...ring(0, 0, 20, 8, .2), [4, 4, 2.2], [-4, -4, 2.2], ...ring(0, 0, 33, 6, .5),
      ...CANDY_LANE.filter((_, i) => i % 2 === 0).map(([x, z]) => [x + 3, z + 3]), [CANDY.lane[0], CANDY.lane[1] + 15],
      ...CANDY_HOUSES.flatMap(([x, z]) => [[x, z + 8], [x + 8, z], [x, z, 1.65]]),
      ...ring(CANDY.mallow[0], CANDY.mallow[1], 15, 5), [CANDY.mallow[0], CANDY.mallow[1], 1.65],
      ...ring(CANDY.sugar[0], CANDY.sugar[1], 16, 5, .4), ...wild(rng(7102), CANDY.half, 22, CANDY_AVOID),
    ],
    dmg: [[3.2, 2.2, 3.2], [CANDY.mallow[0], 1.65, CANDY.mallow[1] + 2], [CANDY_HOUSES[1][0], 1.65, CANDY_HOUSES[1][1]]],
  },
  {
    id: 'jungle', name: 'Jungle Temple', half: 76, br: true,
    blurb: 'Battle Royale only. A giant stepped temple, vine camps, stone circles and tall trees to hide under.',
    swatch: ['#3a98e0', '#6ed08a', '#fff6c8'],
    theme: { sky: [0x3a98e0, 0xa0eccc, 0xfff6c8], sunStr: 1.2, fog: [0xc8f0d0, 40, 160], floor: ['#6ed08a', '#58b874', 'rgba(10,70,40,.3)'], ground: 0x2f7a4a, wall: 0x1f5a38,
      strips: [0x8aff3a, 0xffd31a, 0x2ee6ff, 0xff7a1a], hemi: [0xe0ffe8, 0x3a8a5a, 1.05], sun: [0xfff0c0, 2.3], exposure: 1.1, clouds: 0xf0fff0, deco: 'none' },
    build(b) {
      const R = rng(7201), H = 76;
      mesa(b, 0, 0, 34, 34, 6, [0xc9c2a0, 0xb6af8c, 0xa39c7a], 2.4);                                    // the temple (top at 3.3)
      b.box(0, 3.3 + 1.5, 0, 2.4, 3, 2.4, 0xffd31a); b.glow(0, 3.3 + 3.2, 0, 1, .5, 1, 0x8aff3a);
      for (const [cx, cz] of JUNGLE_CAMPS) {
        mesa(b, cx, cz, 7, 7, 2, [0xa39c7a, 0xc9c2a0], 1.2);
        for (const [dx, dz, sx, sz] of [[-8, -4, 1, 7], [-8, 5, 1, 4], [8, -5, 1, 4], [8, 4, 1, 7], [-4, -8, 7, 1], [5, -8, 4, 1], [-5, 8, 4, 1], [4, 8, 7, 1]]) b.box(cx + dx, .65, cz + dz, sx, 1.3, sz, 0x8a8f6a);
        b.box(cx + 4, .8, cz - 4, 1.6, 1.6, 1.6, 0x7a4a2a); b.box(cx - 4, .8, cz + 4, 1.6, 1.6, 1.6, 0x7a4a2a);
      }
      for (const [dx, dz] of JUNGLE_CIRCLES) {                                                          // stone circles
        for (const [x, z] of ring(dx, dz, 6, 8)) b.box(x, 2, z, 1.4, 4, 1.4, 0x9a9a82);
        mesa(b, dx, dz, 4, 4, 1, [0xffd31a]);
      }
      scatter(R, H, 16, JUNGLE_AVOID, 12, (x, z) => { b.box(x, 5.5, z, 2.2, 11, 2.2, 0x7a4a2a); b.box(x, 11.8, z, 9, 1.6, 9, 0x3ab05a); b.box(x, 13, z, 5, 1, 5, 0x58d070); });   // trees: you can walk under the leaves
      scatter(R, H, 16, JUNGLE_AVOID, 7, (x, z, r) => { const alongX = r() < .5, h = 1.6 + r() * 1.4; b.box(x, h / 2, z, alongX ? 8 : 1.3, h, alongX ? 1.3 : 8, 0xa39c7a); if (r() < .6) b.box(x + (alongX ? 3 : 0), (h + 1.2) / 2, z + (alongX ? 0 : 3), 3, h + 1.2, 3, 0x8a8f6a); });
      scatter(R, H, 22, JUNGLE_AVOID, 6, (x, z, r) => { const w = 2.6 + r() * 2.6, h = 1.2 + r() * 1.8; b.box(x, h / 2, z, w, h, w - .6 + r(), r() < .5 ? 0x8a9a8a : 0x6a8a6a); });
    },
    spawns: ring(0, 0, 60, 12),
    loot: [
      ...ring(0, 0, 25, 8, .3), [3.4, 0, 3.3], [-3.4, 0, 3.3], [0, 3.4, 3.3], ...ring(0, 0, 38, 6, .5),
      ...JUNGLE_CAMPS.flatMap(([x, z]) => [[x, z, 1.1], [x + 6, z + 6], [x - 6, z - 6], [x + 6, z - 6]]),
      ...JUNGLE_CIRCLES.flatMap(([x, z]) => [[x, z, .55], ...ring(x, z, 3, 3)]),
      ...wild(rng(7202), 76, 24, JUNGLE_AVOID),
    ],
    dmg: [[0, 3.3, 3.4], [JUNGLE_CAMPS[0][0], 1.1, JUNGLE_CAMPS[0][1] + 1.5], [JUNGLE_CAMPS[3][0], 1.1, JUNGLE_CAMPS[3][1] - 1.5]],
  },
  {
    id: 'city', name: 'Skyline City', half: 72, br: true,
    blurb: 'Battle Royale only. A neon city at dusk: streets, towers, parked cars and a plaza in the middle.',
    swatch: ['#1a1040', '#6a3a9a', '#ff9a6a'],
    theme: { sky: [0x1a1040, 0x6a3a9a, 0xff9a6a], sunStr: .8, fog: [0x6a4a98, 40, 160], floor: ['#6a6aa0', '#5a5a92', 'rgba(255,214,90,.45)'], ground: 0x33306a, wall: 0x3a3a7a,
      strips: [0xff4fa8, 0x2ee6ff, 0xffd31a, 0x8aff3a], hemi: [0xc8baff, 0x4a3a90, 1.1], sun: [0xffc8a8, 1.9], exposure: 1.1, clouds: 0xa88ad8, deco: 'stars' },
    build(b) {
      const R = rng(7301);
      const tones = [0x8a7ad8, 0x6a8ae8, 0xb07ae0, 0x5a9ae0, 0x9a8af8], neon = [0xff4fa8, 0x2ee6ff, 0xffd31a, 0x8aff3a];
      mesa(b, 0, 0, 20, 20, 4, [0xb0a0f0, 0xa090e0, 0x9080d0, 0x8070c0], 2.2);                         // central plaza dais (top at 2.2)
      b.box(0, 2.2 + 7, 0, 3, 14, 3, 0xff4fa8); b.glow(0, 2.2 + 11, 0, 3.2, .6, 3.2, 0x2ee6ff);
      for (const bx of CITY_C) for (const bz of CITY_C) {
        if (Math.abs(bx) < 20 && Math.abs(bz) < 20) continue;
        const kind = R();
        if (kind < .5) {                                                                                 // one tower
          const w = 10 + R() * 5, d = 10 + R() * 5, h = 6 + R() * 18, x = bx + (R() - .5) * 4, z = bz + (R() - .5) * 4;
          b.box(x, h / 2, z, w, h, d, tones[Math.floor(R() * 5)]); b.glow(x, h * .55, z, w + .1, .5, d + .1, neon[Math.floor(R() * 4)]);
        } else if (kind < .8) {                                                                          // two smaller buildings with an alley
          for (const s of [-1, 1]) { const w = 7 + R() * 2, d = 10 + R() * 4, h = 5 + R() * 12, x = bx + s * 6, z = bz + (R() - .5) * 3; b.box(x, h / 2, z, w, h, d, tones[Math.floor(R() * 5)]); if (R() < .6) b.glow(x, h * .6, z, w + .1, .45, d + .1, neon[Math.floor(R() * 4)]); }
        } else {                                                                                         // low shop with a walk-up roof
          mesa(b, bx, bz, 13, 12, 3, [0x9a8ada, 0xb0a0e8, 0xc8baf8], 2.2);
          b.box(bx - 4, 2.2 + .6, bz - 3, 2, 1.2, 2, 0xffd31a);
        }
      }
      // cars and barriers along the streets (the crossroads stay open)
      let n = 0; for (const s of CITY_ST) for (let t = 0; t < 4; t++) {
        const along = (R() * 2 - 1) * 64, side = (R() - .5) * 5, horiz = (n++ & 1) === 0, x = horiz ? along : s + side, z = horiz ? s + side : along;
        if (Math.abs(x) > 66 || Math.abs(z) > 66 || (Math.abs(x) < 24 && Math.abs(z) < 24)) continue;
        if (CITY_ST.some(a => Math.abs(x - a) < 7) && CITY_ST.some(a => Math.abs(z - a) < 7)) continue;
        b.box(x, .65, z, horiz ? 4.2 : 2, 1.3, horiz ? 2 : 4.2, CRATE[Math.floor(R() * 6)]);
      }
    },
    spawns: ring(0, 0, 58, 12),
    loot: [
      ...CITY_ST.flatMap(x => CITY_ST.map(z => [x, z])).filter(([x, z]) => x || z), ...ring(0, 0, 16, 6, .3), [2.6, 2.6, 2.2], [-2.6, -2.6, 2.2],
      ...[-60, -36, 36, 60].flatMap(x => [-60, -36, 36, 60].map(z => [x, z + 8.5])),
    ],
    dmg: [[2.6, 2.2, -2.6], [-2.6, 2.2, 2.6]],
  },
  {
    id: 'moon', name: 'Moonbase Alpha', half: 74, br: true,
    blurb: 'Battle Royale only. A quiet moon base, deep craters and glowing crystals under the stars.',
    swatch: ['#02010a', '#2a1a78', '#7cecff'],
    theme: { sky: [0x02010a, 0x140a3a, 0x4a3aa8], sunStr: .3, fog: [0x1a1038, 40, 170], floor: ['#9aa0c8', '#868cb8', 'rgba(140,180,255,.35)'], ground: 0x40466a, wall: 0x30305a,
      strips: [0x7cecff, 0xb06bff, 0xffffff, 0x8aff3a], hemi: [0xa0b0ff, 0x30306a, .9], sun: [0xdde4ff, 2.2], exposure: 1.1, clouds: 0x2a2a60, deco: 'stars' },
    build(b) {
      const R = rng(7401), H = 74, gray = [0xdfe3f5, 0xc9cfe6, 0xb4bbd8, 0x9fa6c8];
      mesa(b, 0, 0, 24, 24, 4, gray, 3);                                                                // main dome (top at 2.2)
      b.box(0, 2.2 + 6, 0, 1.6, 12, 1.6, 0xffffff); b.glow(0, 2.2 + 12.3, 0, 1.2, 1.2, 1.2, 0xff4fa8);
      for (const [dx, dz] of [[26, 0], [-26, 0], [0, 26], [0, -26]]) {                                  // habitat modules + airlock walls
        mesa(b, dx, dz, 12, 12, 2, [0xc9cfe6, 0xb4bbd8], 2.4);
        const horiz = dx !== 0;
        for (const s of [-8, 8]) b.box(dx + (horiz ? 0 : s), 1.5, dz + (horiz ? s : 0), horiz ? 10 : 1, 3, horiz ? 1 : 10, 0x7a82ae);
      }
      for (const [cx, cz] of MOON_CRATERS) for (const [x, z] of ring(cx, cz, 9, 10, R() * 6)) { if (R() < .15) continue; b.box(x, .7, z, 4.2, 1.4, 2.6, 0x7a82ae); }   // crater rims with gaps to walk through
      mesa(b, 52, -4, 14, 14, 1, [0x4a4a7a]); for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) b.glow(52 + dx, .7, -4 + dz, .6, .3, .6, 0x8aff3a);   // landing pad
      scatter(R, H, 12, MOON_AVOID, 12, (x, z, r) => { const cols = [0x7cecff, 0xb06bff, 0xffffff, 0xff4fa8]; for (let i = 0; i < 4; i++) { const h = 4 + r() * 7; b.box(x + (r() - .5) * 5, h / 2, z + (r() - .5) * 5, 1.2 + r() * .8, h, 1.2 + r() * .8, cols[Math.floor(r() * 4)]); } });
      scatter(R, H, 16, MOON_AVOID, 8, (x, z, r) => { const w = 3 + r() * 4, h = 1.4 + r() * 2.6; b.box(x, h / 2, z, w, h, 2.4 + r() * 2, gray[Math.floor(r() * 4)]); });
      scatter(R, H, 10, MOON_AVOID, 9, (x, z) => { b.box(x, 1.2, z, 3.4, 2.4, 6, 0xff7a1a); b.box(x, 2.9, z, 2.4, 1, 3, 0xffffff); });   // cargo containers
    },
    spawns: ring(0, 0, 60, 12),
    loot: [
      ...ring(0, 0, 19, 8, .2), [2.2, 0, 2.2], [-2.2, 0, 2.2], ...ring(0, 0, 36, 6, .9),
      ...[[26, 0], [-26, 0], [0, 26], [0, -26]].flatMap(([x, z]) => [[x, z, 1.1], [x + 9, z + 9], [x - 9, z - 9]]),
      ...MOON_CRATERS.flatMap(([x, z]) => [[x, z], [x + 3, z + 2]]), [52, -4, .55], ...wild(rng(7402), 74, 20, MOON_AVOID),
    ],
    dmg: [[2.2, 2.2, 1.6], [52, .55, -2], [MOON_CRATERS[2][0], 0, MOON_CRATERS[2][1]]],
  },
);
