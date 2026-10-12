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
  {
    id: 'toys', name: 'Toy Box', half: 30,
    blurb: 'A giant playroom: stepped block castles, an alphabet tower and cover everywhere. Quick and colorful.',
    swatch: ['#3a8aff', '#ffd34e', '#ff6a4a'],
    theme: { sky: [0x3a8aff, 0x9fd8ff, 0xfff4cc], sunStr: 1, fog: [0xd8f0ff, 45, 150], floor: ['#ffe9b0', '#ffd88a', 'rgba(255,90,60,.35)'], ground: 0xff9a5a, wall: 0xd04a3a,
      strips: [0xff4a4a, 0xffd31a, 0x2e8bff, 0x4adf6a], hemi: [0xe0f0ff, 0xc08a60, 1.1], sun: [0xfff1d0, 2.3], exposure: 1.1, clouds: 0xffffff, deco: 'balloons' },
    build(b) {
      const C = [0xff4a4a, 0xffd31a, 0x2e8bff, 0x4adf6a, 0xff7a1a, 0xb06bff];
      [[-19, -19], [19, -19], [-19, 19], [19, 19]].forEach(([x, z], i) => { b.box(x, .275, z, 9, .55, 9, C[i]); b.box(x, .825, z, 7, .55, 7, C[(i + 1) % 6]); b.box(x, 1.375, z, 5, .55, 5, C[(i + 2) % 6]); b.box(x, 1.925, z, 3, .55, 3, C[(i + 3) % 6]); });   // four stepped castles (top at 2.2)
      b.box(0, 1.1, 0, 4, 2.2, 4, 0xffd31a); b.box(0, 2.9, 0, 2.4, 1.4, 2.4, 0xff4a4a);                                  // the alphabet tower
      [[-6, 0, 0], [6, 0, 1], [0, -6, 2], [0, 6, 3]].forEach(([x, z, c]) => b.box(x, .8, z, 2.4, 1.6, 2.4, C[c]));
      [[-10, -4, 0], [10, 4, 0], [-4, 10, 1], [4, -10, 1], [-24, 0, 1], [24, 0, 1], [0, -26, 0], [0, 26, 0]].forEach(([x, z, rot], i) => rot ? b.box(x, 2, z, 6, 4, 1.2, C[i % 6]) : b.box(x, 2, z, 1.2, 4, 6, C[i % 6]));   // dominoes
      [[-13, 12, 2.4, 0], [13, -12, 2.4, 2], [-25, -10, 2, 4], [25, 10, 2, 1], [-8, -22, 2, 3], [8, 22, 2, 5], [-26, 21, 3, 0], [26, -21, 3, 2], [-14, -9, 1.6, 1], [14, 9, 1.6, 3]].forEach(([x, z, s, c]) => b.box(x, s / 2, z, s, s, s, C[c]));
    },
    spawns: [[-27, -27], [27, -27], [-27, 27], [27, 27], [0, -28], [0, 28], [-28, 0], [28, 0], [-10, -14], [10, 14], [-14, 8], [14, -8]],
    loot: [[-9, -9], [9, 9], [-9, 9], [9, -9], [0, -14], [0, 14], [-14, 0], [14, 0], [-24, -24], [24, 24], [-24, 24], [24, -24], [-19, -19, 2.2], [19, -19, 2.2], [-19, 19, 2.2], [19, 19, 2.2], [0, -22], [0, 22], [-22, 0], [22, 0]],
    dmg: [[-19, 2.2, -19], [19, 2.2, 19]],
  },
  {
    id: 'cove', name: 'Pirate Cove', half: 32,
    blurb: 'A wrecked pirate ship on a sunny beach. Climb aboard, hide behind barrels, or sneak around the palm trees.',
    swatch: ['#1a5a9a', '#6ad0e8', '#f0dca8'],
    theme: { sky: [0x1a5a9a, 0x6ad0e8, 0xffe8b0], sunStr: 1.2, fog: [0xbfeaf0, 45, 160], floor: ['#f0dca8', '#e2c88c', 'rgba(110,70,30,.3)'], ground: 0x2a8ab8, wall: 0x6a4a2a,
      strips: [0xffd34e, 0xff6a3a, 0x4adfa0, 0xffffff], hemi: [0xd8f4ff, 0xc09a60, 1.1], sun: [0xfff0c0, 2.4], exposure: 1.1, clouds: 0xffffff, deco: 'none' },
    build(b) {
      const WOOD = 0x8a5a2a, DARK = 0x6a4420, LIGHT = 0xb07a3a;
      b.box(0, .825, 0, 7, 1.65, 24, WOOD);                                                                                  // the ship's hull: the deck is at 1.65
      b.box(0, 1.65 + .9, 7.5, 5, 1.8, 4, DARK); b.box(0, 1.65 + .45, -9, 5, .9, 3, LIGHT);                                 // cabin and a cargo hatch on deck
      b.box(0, 5.8, 0, .8, 8.3, .8, 0xe8dcc0); b.box(0, 10.2, 0, 3.2, .5, 3.2, DARK);                                      // the mast and the crow's nest
      for (const s of [-1, 1]) for (const zz of [-6, 6]) { b.box(s * 5.6, .275, zz, 1.5, .55, 4, LIGHT); b.box(s * 4.2, .55, zz, 1.4, 1.1, 4, LIGHT); }   // gangways up to the deck
      b.box(-23, .15, 0, 7, .3, 22, 0x9a7440); b.box(-23, .6, -9, .8, 1.2, .8, DARK); b.box(-23, .6, 9, .8, 1.2, .8, DARK);   // a wooden dock
      [[-14, 14], [15, -14], [-16, -15], [17, 15], [-5, 20], [5, -20], [26, 3], [-27, -22]].forEach(([x, z], i) => { b.box(x, .7, z, 1.4, 1.4, 1.4, i % 2 ? 0x9a6a30 : 0x7a4a1c); b.box(x + 1.6, .6, z + .4, 1.2, 1.2, 1.2, 0x9a6a30); });   // barrels
      [[-12, -6, 3, 2.4, 3], [13, 8, 3.4, 2.8, 3], [22, -22, 4, 3.2, 4], [-22, 22, 4, 2.6, 4], [-6, 25, 5, 2, 2.4], [8, -26, 5, 2, 2.4], [26, 14, 2.4, 2, 2.4], [-27, -10, 2.4, 2.2, 2.4]].forEach(([x, z, sx, sy, sz]) => b.box(x, sy / 2, z, sx, sy, sz, 0x9aa0a8));   // rocks
      [[-9, 10], [11, -8], [-20, -24], [21, 22], [-25, 8], [25, -2]].forEach(([x, z]) => { b.box(x, 2.5, z, .6, 5, .6, 0x8a5a2a); b.box(x, 5.4, z, 3.6, .5, 3.6, 0x2aa84a); });   // palm trees
    },
    spawns: [[-28, -28], [28, -28], [-28, 28], [28, 28], [0, -29], [0, 29], [-12, 0], [12, 0], [-29, 0], [29, 0], [-16, 20], [16, -20]],
    loot: [[-10, -10], [10, 10], [-10, 10], [10, -10], [0, -16], [0, 16], [-18, 0], [18, 0], [-24, -24], [24, 24], [-24, 24], [24, -24], [0, 0, 1.65], [0, 9, 1.65], [0, -9, 1.65], [-14, 25], [14, -25], [-27, 12], [27, -12], [-6, -26]],
    dmg: [[0, 1.65, 4], [0, 1.65, -4]],
  },
  {
    id: 'lava', name: 'Lava Lair', half: 30,
    blurb: 'A volcano crater: a glowing stepped cone in the middle, black rock pillars and rivers of lava all around.',
    swatch: ['#2a0a0a', '#ff5a2a', '#ffc060'],
    theme: { sky: [0x2a0a0a, 0xff5a2a, 0xffc060], sunStr: .5, fog: [0x7a2a1a, 30, 120], floor: ['#3a2a30', '#2e2026', 'rgba(255,100,40,.5)'], ground: 0x1a0a0a, wall: 0x5a2a2a,
      strips: [0xff5a1a, 0xffd31a, 0xff2a4a, 0xffffff], hemi: [0xffb080, 0x4a1a10, .95], sun: [0xffa060, 1.8], exposure: 1.1, clouds: 0x5a2a20, deco: 'stars' },
    build(b) {
      [[16, .55, .275, 0x4a3038], [12, .55, .825, 0x5a3a40], [8, .55, 1.375, 0x6a4048], [4, .55, 1.925, 0x7a4a50]].forEach(([w, h, y, c]) => b.box(0, y, 0, w, h, w, c));   // the cone (top at 2.2)
      b.glow(0, 2.22, 0, 3.4, .08, 3.4, 0xff5a1a);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2, r = 17; b.box(Math.cos(a) * r, 3.5, Math.sin(a) * r, 2.2, 7, 2.2, 0x1c1018); b.glow(Math.cos(a) * r, 7.1, Math.sin(a) * r, 1.4, .3, 1.4, 0xff7a2a); }   // obsidian pillars with glowing tips
      for (const [x, z, sx, sz] of [[-22, 0, 1.6, 9], [22, 0, 1.6, 9], [0, -22, 9, 1.6], [0, 22, 9, 1.6]]) b.box(x, 1.2, z, sx, 2.4, sz, 0x3a2028);              // low rock walls to duck behind
      for (const [x, z, sx, sy, sz] of [[-10, -10, 3, 1.5, 3], [10, 10, 3, 1.5, 3], [-10, 10, 3, 1.5, 3], [10, -10, 3, 1.5, 3], [-26, -22, 4, 2.4, 3], [26, 22, 4, 2.4, 3], [-26, 22, 3, 2, 4], [26, -22, 3, 2, 4]]) b.box(x, sy / 2, z, sx, sy, sz, 0x4a2c34);
      for (const [x, z, sx, sz] of [[-13, 0, 3, 26], [13, 0, 3, 26], [0, -13, 26, 3], [0, 13, 26, 3]]) b.glow(x, .035, z, sx, .07, sz, 0xff5a1a);                    // rivers of lava (just for looks)
    },
    spawns: [[-27, -27], [27, -27], [-27, 27], [27, 27], [0, -28], [0, 28], [-28, 0], [28, 0], [-18, -8], [18, 8], [-8, 18], [8, -18]],
    loot: [[-6, -6], [6, 6], [-6, 6], [6, -6], [0, -9], [0, 9], [-9, 0], [9, 0], [-22, -22], [22, 22], [-22, 22], [22, -22], [0, -24], [0, 24], [-24, 0], [24, 0], [0, 0, 2.2], [3, -3, 2.2]],
    dmg: [[0, 2.2, 1.5], [0, 2.2, -1.5]],
  },
  {
    id: 'orbit', name: 'Orbit Station', half: 34,
    blurb: 'A space station: four pods with doorways, a glowing reactor in the middle and crates in the corridors.',
    swatch: ['#02010a', '#2a4a9a', '#2ee6ff'],
    theme: { sky: [0x02010a, 0x140a3a, 0x2a4a9a], sunStr: 0, fog: [0x10143a, 35, 140], floor: ['#2a3050', '#222844', 'rgba(46,230,255,.45)'], ground: 0x0a0c1a, wall: 0x2f3a68,
      strips: [0x2ee6ff, 0x8aff3a, 0xff4fa8, 0xffffff], hemi: [0xa0b0ff, 0x20244a, .95], sun: [0xdde4ff, 1.6], exposure: 1.05, clouds: 0x3a4a8a, deco: 'stars' },
    build(b) {
      const room = (cx, cz, s, c) => { const hw = s / 2, gap = 2, len = hw - gap, off = gap + len / 2; for (const sg of [-1, 1]) for (const sd of [-1, 1]) { b.box(cx + sd * off, 1.8, cz + sg * hw, len, 3.6, 1, c); b.box(cx + sg * hw, 1.8, cz + sd * off, 1, 3.6, len, c); } };
      room(-18, -18, 14, 0x4a5a98); room(18, -18, 14, 0x4a5a98); room(-18, 18, 14, 0x4a5a98); room(18, 18, 14, 0x4a5a98);
      for (const [x, z, c] of [[-18, -18, 0x2ee6ff], [18, -18, 0x8aff3a], [-18, 18, 0xff4fa8], [18, 18, 0xffd31a]]) { b.box(x, .6, z, 3, 1.2, 3, 0x6a7ab8); b.glow(x, 1.3, z, 1.6, .15, 1.6, c); }   // a console in every pod
      b.box(0, .55, 0, 12, 1.1, 12, 0x5a6aa8); b.box(0, 1.1 + 1.4, 0, 5, 2.8, 5, 0x3a4a88); b.glow(0, 4.3, 0, 2.2, 3, 2.2, 0x2ee6ff);                 // the reactor on a platform
      for (const [x, z] of [[-7.4, 0], [7.4, 0], [0, -7.4], [0, 7.4]]) b.box(x, .275, z, x ? 2.4 : 6, .55, z ? 2.4 : 6, 0x7a8ac0);                      // its steps
      for (const [x, z, sx, sy, sz, c] of [[-30, -8, 3, 2, 3, 0x6a7ab8], [30, 8, 3, 2, 3, 0x6a7ab8], [-8, -30, 3, 2, 3, 0x6a7ab8], [8, 30, 3, 2, 3, 0x6a7ab8], [-30, 12, 2, 1.4, 4, 0x8a9ad0], [30, -12, 2, 1.4, 4, 0x8a9ad0], [-12, 30, 4, 1.4, 2, 0x8a9ad0], [12, -30, 4, 1.4, 2, 0x8a9ad0], [0, -19, 8, 1.2, 1.4, 0x6a7ab8], [0, 19, 8, 1.2, 1.4, 0x6a7ab8], [-19, 0, 1.4, 1.2, 8, 0x6a7ab8], [19, 0, 1.4, 1.2, 8, 0x6a7ab8]]) b.box(x, sy / 2, z, sx, sy, sz, c);
      for (const [x, z, c] of [[-32, -32, 0x2ee6ff], [32, -32, 0xff4fa8], [-32, 32, 0xffd31a], [32, 32, 0x8aff3a]]) b.glow(x, 4, z, .4, 8, .4, c);
    },
    spawns: [[-30, -30], [30, -30], [-30, 30], [30, 30], [0, -31], [0, 31], [-31, 0], [31, 0], [-9, -9], [9, 9], [-9, 9], [9, -9], [-18, -18], [18, 18]],
    loot: [[-18, -18], [18, 18], [-18, 18], [18, -18], [0, -25], [0, 25], [-25, 0], [25, 0], [-9, 0], [9, 0], [0, -9], [0, 9], [-30, -20], [30, 20], [-30, 20], [30, -20], [-20, -30], [20, 30], [-20, 30], [20, -30], [0, 0, 1.1]],
    dmg: [[0, 1.1, 8], [0, 1.1, -8]],
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

// ---------------------------------------------------------------------------------------------
// Sniper's Alley map (sn: true, only offered in Sniper's Alley): Highline Peaks.
// Two teams start at opposite ends (south = spawnsA, north = spawnsB). The map is the same after a half turn,
// so both sides get the same cover. Every peak is a stepped mountain you can walk up from any side, and jump
// pads (pads: x, z, then where they throw you: x, height, z, seconds in the air) shoot you up onto the high ground.
// `perches` are spots on top of the peaks (x, z, height) where sniper bots like to set up.
// ---------------------------------------------------------------------------------------------
const hexMix = (a, b, t) => { const ch = s => (a >> s & 255) + ((b >> s & 255) - (a >> s & 255)) * t; return (Math.round(ch(16)) << 16) | (Math.round(ch(8)) << 8) | Math.round(ch(0)); };
const shades = (n, c0, c1) => Array.from({ length: n }, (_, i) => hexMix(c0, c1, n > 1 ? Math.pow(i / (n - 1), 1.9) : 0));   // mostly stone, with snow only near the top
const turn = ([x, z, ...rest]) => [-x, -z, ...rest];   // the same spot after a half turn of the map
const PEAK = {
  center: [0, 0, 6.6],
  flank: [[-28, 14, 4.4]],            // + their half-turn twins
  fwd: [[30, 30, 3.3]],
  ridge: [[0, 31, 1.65]],
  terr: [[44.5, 0, 3.3]],
  bunk: [[-28, 44, 1.65], [28, 44, 1.65]],
};
const PK_ROCKS = [[-8, 21, 4, 2.4, 3], [9, 22, 3, 1.8, 3], [-24, 31, 3, 2, 3], [34, 10, 3, 2, 3], [-36, 0, 3, 2.2, 3], [18, 40, 3, 2.2, 3], [-18, 40, 3, 2.4, 3], [38, 40, 3, 1.8, 3]];
const PK_WALLS = [[16, 21, 6, 1.2], [-8, 38, 8, 1.2], [8, 38, 8, 1.2], [-39, 28, 1.2, 6]];
const PK_SPIRES = [[-14, 22], [20, 10]];
const PK_PADS = [[0, 19.5, 0, 6.6, .8, 1.5], [-22, 27.5, -28, 4.4, 14, 1.5], [20, 30.5, 30, 3.3, 30, 1.2], [37.5, 12, 44.5, 3.3, 12, 1.05]];
const PK_WOODS = [[28.5, 9.5, 11, 16], [-27.5, 31.5, 11, 14]];
// watchtowers in the four corners: climb the yellow ladder column (hold jump toward it), jump on the pad, or walk up from a perch. Platform top is at 9 m.
const PK_TOWERS = [[44, 33], [-44, -33], [-44, 33], [44, -33]];
const PK_TPADS = [[44, 25, 44, 9, 33, 1.7], [-44, -25, -44, 9, -33, 1.7], [-44, 25, -44, 9, 33, 1.7], [44, -25, 44, 9, -33, 1.7]];   // pads in front of each tower
const tower = (b, cx, cz) => {
  const s = Math.sign(cz), H = 9, STONE = 0x7a6a58, DECK = 0xa8b4cc, RAIL = 0x8896b4;
  for (const dx of [-3.4, 3.4]) for (const dz of [-3.4, 3.4]) b.box(cx + dx, H / 2, cz + dz, 1.2, H, 1.2, STONE);   // legs
  b.box(cx, H - .3, cz, 8, .6, 8, DECK);                                                                           // the deck
  b.box(cx, H + .5, cz - s * 3.85, 8, 1, .3, RAIL); b.box(cx - 3.85, H + .5, cz, .3, 1, 8, RAIL); b.box(cx + 3.85, H + .5, cz, .3, 1, 8, RAIL);   // low walls to hide behind
  for (const dx of [-2.4, 2.4]) b.box(cx + dx, H + .5, cz + s * 3.85, 3.2, 1, .3, RAIL);                           // outer wall with a gap in the middle
  b.box(cx, H / 2, cz + s * 4.6, 1, H, 1, 0xf0c040);                                                              // the ladder column
  for (const dx of [-3.4, 3.4]) b.glow(cx + dx, H + 2.4, cz - s * 3.4, .25, 2.8, .25, 0x2ee6ff);                  // beacons
};   // forests: x, z, radius, trees (each one has a twin after a half turn)
const padTurn = ([x, z, tx, ty, tz, T]) => [-x, -z, -tx, ty, -tz, T];
// the footprints of the peaks, ridges, terraces and bunkers: [x, z, width, depth] (both halves)
const PK_RECTS = (() => { const o = [], both = (x, z, w, d) => o.push([x, z, w, d], [-x, -z, w, d]); both(0, 0, 30, 30); both(-28, 14, 20, 20); both(30, 30, 16, 16); both(0, 31, 30, 8); both(44.5, 0, 9, 46); both(-28, 44, 12, 8); both(28, 44, 12, 8); both(44, 33, 10, 10); both(-44, 33, 10, 10); return o; })();
const inRects = (x, z, m) => PK_RECTS.some(([cx, cz, w, d]) => Math.abs(x - cx) < w / 2 + m && Math.abs(z - cz) < d / 2 + m);
// everything else that is already standing somewhere: [x, z, radius] (both halves), so new rocks and trees stay out of the way
const PK_OCC = (() => {
  const o = [], both = (x, z, r) => o.push([x, z, r], [-x, -z, r]);
  PK_ROCKS.forEach(([x, z, sx, , sz]) => both(x, z, Math.max(sx, sz) / 2 + 2.5));
  PK_WALLS.forEach(([x, z, sx, sz]) => both(x, z, Math.max(sx, sz) / 2 + 2.2));
  PK_SPIRES.forEach(([x, z]) => both(x, z, 5));
  PK_PADS.forEach(([x, z]) => both(x, z, 4.2)); for (const [x, z] of PK_TPADS) o.push([x, z, 4.2]);
  for (const x of [-20, -10, 0, 10, 20]) both(x, 46, 5.5); both(0, 42, 6); both(-38, 47, 5); both(38, 45, 5);
  return o;
})();
// the trees of both forests (and their twins), picked once so every player gets the same map
const PK_TREES = (() => {
  const R = rng(8801), out = [];
  for (const [cx, cz, rad, n] of PK_WOODS) {
    const mine = [];
    for (let t = 0; mine.length < n && t < n * 80; t++) {
      const a = R() * 6.283, r = Math.sqrt(R()) * rad, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = .85 + R() * .4, c = Math.floor(R() * 3);
      if (inRects(x, z, 2.6) || PK_OCC.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar) || mine.some(([px, pz]) => Math.hypot(x - px, z - pz) < 3.7)) continue;
      mine.push([x, z, s, c]);
    }
    for (const [x, z, s, c] of mine) out.push([x, z, s, c], [-x, -z, s, c]);
  }
  return out;
})();
PK_WOODS.forEach(([x, z, r]) => PK_OCC.push([x, z, r + 1.5], [-x, -z, r + 1.5]));
// extra boulders in the open (one half is picked, the other half is its twin)
const PK_BOULDERS = (() => {
  const R = rng(8802), out = [];
  for (let t = 0; out.length < 18 && t < 1500; t++) {
    const x = (R() * 2 - 1) * 46, z = R() * 46 + 2, bw = 2.2 + R() * 2.2, bh = 1.2 + R() * 2, bd = 2 + R() * 2.2, c = Math.floor(R() * 4), st = R() < .35;
    if (Math.hypot(2 * x, 2 * z) < 16 || inRects(x, z, Math.max(bw, bd) / 2 + .8) || PK_OCC.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + Math.max(bw, bd) / 2 - 1) || out.some(([px, pz]) => Math.hypot(x - px, z - pz) < 6.5 || Math.hypot(x + px, z + pz) < 6.5)) continue;
    out.push([x, z, bw, bh, bd, c, st]);
  }
  return out;
})();
const PK_TREE_COL = [0x2f8a3e, 0x3a9a4a, 0x2a7a52], PK_TREE_TOP = [0x3aa84a, 0x4ab85a, 0x34986a], PK_ROCK_COL = [0x7a88a6, 0x6f7d9a, 0x8794b0, 0x93a0ba];
MAPS.push({
  id: 'peaks', name: 'Highline Peaks', half: 52, sn: true, radar: 62,
  blurb: "Sniper's Alley only. Snowy peaks you can climb or jump-pad up, two forests, watchtowers in the corners, long ledges, spires and boulders to hide behind. Climb high, stay low, line it up.",
  swatch: ['#2a78ff', '#9fd0ff', '#86c874'],
  theme: { sky: [0x2a78ff, 0x9fd0ff, 0xf4faff], sunStr: 1.2, fog: [0xd6ebff, 80, 250], floor: ['#86c874', '#78bc68', 'rgba(30,80,50,.3)'], ground: 0x6aa86a, wall: 0x4a6288,
    strips: [0x2ee6ff, 0xffffff, 0x4aa8ff, 0x8aa8ff], hemi: [0xe8f4ff, 0x9ab4d8, 1.1], sun: [0xfff6e0, 2.4], exposure: 1.1, clouds: 0xffffff, deco: 'none' },
  build(b) {
    const STONE = 0x6a7a9a, SNOW = 0xffffff, DARK = 0x46557a;
    mesa(b, 0, 0, 30, 30, 12, shades(12, STONE, SNOW), 1.2);                                          // the big middle peak (top at 6.6)
    for (const sg of [1, -1]) {
      mesa(b, sg * -28, sg * 14, 20, 20, 8, shades(8, 0x7585a5, SNOW), 1.1);                          // flank peaks (top at 4.4)
      mesa(b, sg * 30, sg * 30, 16, 16, 6, shades(6, 0x7585a5, SNOW), 1.2);                           // forward peaks (top at 3.3)
      mesa(b, 0, sg * 31, 30, 8, 3, shades(3, 0x8090b0, 0xdfe8f4), 1.3);                              // long low ridges (top at 1.65)
      mesa(b, sg * 44.5, 0, 9, 46, 6, shades(6, 0x8896b4, 0xd8e2f0), .7);                             // terraces along the edges: long ledges to run along (top at 3.3)
      for (const dx of [-28, 28]) mesa(b, dx, sg * 44, 12, 8, 3, shades(3, 0x8090b0, 0xdfe8f4), 1.3);   // base bunkers
      for (const [x, z] of PK_SPIRES) { mesa(b, sg * x, sg * z, 6, 6, 16, shades(16, DARK, 0xb8c6e0), .14); b.glow(sg * x, 8.95, sg * z, 1, .3, 1, 0x2ee6ff); }   // needle spires: a thin staircase you can climb (top at 8.8)
      for (const [x, z, sx, sy, sz] of PK_ROCKS) b.box(sg * x, sy / 2, sg * z, sx, sy, sz, PK_ROCK_COL[0]);   // rocks to stand behind
      for (const [x, z, sx, sz] of PK_WALLS) b.box(sg * x, .6, sg * z, sx, 1.2, sz, 0xa6b2cc);         // low walls to crouch behind
    }
    for (const [x, z, bw, bh, bd, c, st] of PK_BOULDERS) for (const sg of [1, -1]) {                  // more boulders, some with a smaller rock on top
      b.box(sg * x, bh / 2, sg * z, bw, bh, bd, PK_ROCK_COL[c]);
      if (st) b.box(sg * (x + bw * .12), bh + bh * .28, sg * (z - bd * .1), bw * .6, bh * .56, bd * .6, PK_ROCK_COL[(c + 1) % 4]);
    }
    for (const [x, z, s, c] of PK_TREES) {                                                            // the forests: you can hide behind a trunk, and the low leaves block the view from above
      b.box(x, 1.6, z, .9, 3.2, .9, 0x7a5230);
      b.box(x, 3.9, z, 4 * s, 1.4, 4 * s, PK_TREE_COL[c]);
      b.box(x, 5.2, z, 2.8 * s, 1.2, 2.8 * s, PK_TREE_TOP[c], { solid: false });
      b.box(x, 6.3, z, 1.6 * s, 1.1, 1.6 * s, PK_TREE_TOP[(c + 1) % 3], { solid: false });
    }
    for (const [cx, cz] of PK_TOWERS) tower(b, cx, cz);   // watchtowers in the corners
  },
  spawnsA: [[-18, 46], [-9, 46], [0, 46], [9, 46], [18, 46], [-4, 42], [4, 42], [-38, 47], [38, 45]],
  spawnsB: [[18, -46], [9, -46], [0, -46], [-9, -46], [-18, -46], [4, -42], [-4, -42], [38, -47], [-38, -45]],
  spawns: [[-18, 46], [-9, 46], [0, 46], [9, 46], [18, 46], [-4, 42], [4, 42], [18, -46], [9, -46], [0, -46], [-9, -46], [-18, -46], [4, -42], [-4, -42]],
  perches: [PEAK.center, ...PEAK.flank, ...PEAK.flank.map(turn), ...PEAK.fwd, ...PEAK.fwd.map(turn), ...PEAK.ridge, ...PEAK.ridge.map(turn), ...PEAK.terr, ...PEAK.terr.map(turn), [44.5, 15, 3.3], [-44.5, -15, 3.3], [44.5, -15, 3.3], [-44.5, 15, 3.3], ...PEAK.bunk, ...PEAK.bunk.map(turn), ...PK_SPIRES.map(([x, z]) => [x, z, 8.8]), ...PK_SPIRES.map(([x, z]) => [-x, -z, 8.8]), ...PK_TOWERS.map(([x, z]) => [x, z, 9])],
  pads: [...PK_PADS, ...PK_PADS.map(padTurn), ...PK_TPADS],
  trees: PK_TREES.map(([x, z, s]) => [x, z, s]),
  loot: [...PK_TOWERS.flatMap(([x, z]) => [[x, z, 9], [x + 2, z + 2, 9]]), [-14, 22, 8.8], [20, 10, 8.8], [14, -22, 8.8], [-20, -10, 8.8], [-8, 24.5], [9, 25.5], [-24, 28], [24, 18], [0, 42], [-18, 43], [18, 43], [-34, 34], [36, 43], [-30, 0], [28, 6], [26, 6], [32, 14], [-30, 30], [-26, 38], [34, 4], [-34, 42],
    ...[[-8, 24.5], [9, 25.5], [-24, 28], [24, 18], [0, 42], [-18, 43], [18, 43], [-34, 34], [36, 43], [-30, 0], [28, 6], [26, 6], [32, 14], [-30, 30], [-26, 38], [34, 4], [-34, 42]].map(turn),
    [0, 0, 6.6], [-28, 14, 4.4], [28, -14, 4.4], [30, 30, 3.3], [-30, -30, 3.3], [44.5, 0, 3.3], [-44.5, 0, 3.3], [0, 31, 1.65], [0, -31, 1.65]],
  dmg: [[0, 6.6, 1.2], [0, 6.6, -1.2]],
});
