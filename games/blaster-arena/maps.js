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
