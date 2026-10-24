// Maps: grid layouts, collision, ray casts and bot pathfinding. All maps are 44 x 40 cells.
// One cell = 2 m. '#' wall, 'C' tall crate (2 m), 'c' short crate (1 m), 'P' platform, '1'-'3' stairs, 'o' barrels, 's' sandbags.
// zones: 'a'/'b' core sites, 'T' attacker spawn, 'D' defender spawn.

export const W = 44, H = 40, CS = 2;
export const C = (x, z) => z * W + x;
export const G = new Array(W * H).fill('#');
export const ZONE = new Array(W * H).fill('#');
export const HG = new Float32Array(W * H);
export const WALKABLE = [];
export const SITES = { a: {}, b: {} };
export const ROUTES = { a: [], b: [] };
export const MID_HOLDS = [];
export let LURK = 0;
export const SPAWN = { T: [], D: [] };
export const MAP = { id: '', name: '', theme: null, signs: [], rangeStart: [43, 61, 0], seedOff: 0 };

// prop heights: crates, platform, stairs, barrel, sandbags
export const PH = { C: 2, c: 1, P: 2, '3': 1.5, '2': 1, '1': 0.5, o: 1.2, s: 0.9 };

const SAND_WALLS = [[0.86, 0.79, 0.68], [0.7, 0.7, 0.7], [0.5, 0.51, 0.55], [0.9, 0.88, 0.84], [0.62, 0.68, 0.78], [0.82, 0.74, 0.64]];
const RED = '#d6342a', BLUE = '#2a6fd6', DARK = '#333333';

const DEFS = {
  // ------------------------------------------------------------------ desert streets
  sandstone: {
    name: 'Sandstone', blurb: 'desert streets · tunnels and long lanes',
    theme: { walls: SAND_WALLS, floor: 'floor', skyTop: 0x9dbad6, skyHor: 0xdde3e8, fog: 0xd9dfe5, ground: 0xa8745c, palms: true, roofs: [0x3d8fa8, 0xd9b56a] },
    carve: [
      [15, 1, 28, 6, 'D'], [2, 2, 13, 12, 'b'], [13, 3, 15, 5], [30, 2, 41, 12, 'a'], [28, 3, 30, 5], [17, 7, 26, 10], [20, 6, 23, 31], [13, 32, 30, 38, 'T'],
      [3, 34, 13, 36], [3, 13, 6, 36], [30, 34, 40, 36], [37, 13, 40, 36], [23, 18, 33, 20], [31, 13, 33, 18], [7, 23, 20, 25], [13, 8, 16, 9], [34, 26, 36, 30],
    ],
    props: [
      [7, 6, 'C'], [8, 6, 'C'], [7, 7, 'C'], [8, 7, 'C'], [9, 7, 'c'], [3, 10, 'C'], [4, 10, 'c'], [11, 3, 'C'], [12, 3, 'C'], [11, 11, 'c'], [2, 6, 'c'],
      [2, 2, 'P'], [3, 2, 'P'], [2, 3, 'P'], [3, 3, 'P'], [4, 3, '3'], [5, 3, '2'], [6, 3, '1'], [12, 9, 's'], [9, 4, 'o'], [12, 11, 'C'], [6, 11, 's'],
      [35, 6, 'C'], [36, 6, 'C'], [35, 7, 'C'], [36, 7, 'C'], [34, 7, 'c'], [41, 2, 'C'], [41, 3, 'c'], [32, 11, 'c'], [33, 11, 'C'],
      [40, 7, 'P'], [41, 7, 'P'], [40, 8, 'P'], [41, 8, 'P'], [41, 9, '3'], [41, 10, '2'], [41, 11, '1'], [31, 9, 's'], [38, 4, 'o'], [33, 2, 'c'], [36, 11, 's'],
      [20, 15, '#'], [21, 15, '#'], [23, 27, 'C'], [22, 27, 'c'], [17, 9, 'c'], [26, 7, 'C'], [20, 28, 'P'], [21, 28, 'P'], [20, 29, '3'], [20, 30, '2'], [20, 31, '1'],
      [23, 12, 'c'], [20, 19, 'o'], [24, 9, 's'], [19, 7, 'o'], [23, 22, 's'],
      [16, 34, 'c'], [27, 34, 'c'], [21, 37, 'C'], [22, 37, 'C'], [14, 33, 'o'], [29, 33, 'o'], [18, 36, 's'], [25, 36, 's'],
      [40, 22, 'C'], [37, 25, 'c'], [35, 28, 'c'], [40, 28, 'o'], [37, 19, 's'], [40, 16, 'o'], [33, 35, 'C'], [36, 34, 'o'], [39, 25, 's'],
      [6, 18, 'C'], [3, 28, 'c'], [10, 35, 'C'], [6, 30, 'o'], [3, 22, 's'], [5, 34, 'c'],
      [27, 20, 'c'], [12, 25, 'c'], [29, 18, 'o'], [25, 20, 's'], [15, 23, 'o'], [9, 25, 's'], [17, 2, 'c'], [26, 2, 'o'], [21, 3, 's'],
    ],
    sites: {
      a: { name: 'A', center: [35.5, 7], plant: [C(33, 4), C(38, 8), C(32, 8)], holdsAtk: [C(36, 10), C(31, 6), C(39, 3), C(34, 4)], holdsDef: [C(33, 9), C(39, 5), C(31, 4)] },
      b: { name: 'B', center: [7.5, 7], plant: [C(5, 4), C(10, 9), C(5, 8)], holdsAtk: [C(9, 10), C(3, 4), C(11, 5), C(6, 10)], holdsDef: [C(4, 5), C(10, 10), C(12, 6)] },
    },
    routes: { a: [[C(38, 31), C(38, 16)], [C(21, 22), C(27, 19), C(32, 15)]], b: [[C(4, 31), C(4, 16)], [C(21, 26), C(12, 24), C(5, 21), C(4, 16)]] },
    mid: [C(21, 8), C(18, 8)], lurk: C(21, 21), rangeStart: [43, 61, 0],
    signs: [[36, 14, 1, 0, 'A', RED], [30, 16, 1, 0, 'A', RED], [2, 15, 1, 0, 'B', RED], [31, 33, -1, 0, 'A ▸', RED], [12, 33, 1, 0, '◂ B', RED], [19, 12, 1, 0, 'MID', DARK], [29, 2, 0, 1, 'A ▸', BLUE], [14, 2, 0, 1, '◂ B', BLUE]],
  },

  // ------------------------------------------------------------------ indoor warehouse
  warehouse: {
    name: 'Warehouse', blurb: 'indoor hall · crate lanes and side wings',
    theme: { walls: [[0.62, 0.66, 0.72], [0.52, 0.56, 0.62], [0.72, 0.72, 0.74], [0.6, 0.5, 0.45], [0.46, 0.5, 0.56]], floor: 'floorConcrete', skyTop: 0x8fa9c4, skyHor: 0xd0d8e0, fog: 0xc9d2da, ground: 0x7a7c7f, palms: false, roofs: [0x5a6a80, 0x8a5a4a] },
    carve: [
      [16, 1, 27, 5, 'D'], [19, 6, 24, 7], [14, 8, 29, 30], [14, 31, 17, 33], [26, 31, 29, 33], [16, 34, 27, 38, 'T'],
      [2, 12, 10, 24, 'b'], [11, 14, 13, 15], [11, 21, 13, 22], [33, 12, 41, 24, 'a'], [30, 14, 32, 15], [30, 21, 32, 22],
      [3, 25, 6, 36], [7, 34, 15, 36], [37, 25, 40, 36], [28, 34, 36, 36],
      [8, 3, 15, 5], [8, 6, 10, 11], [28, 3, 35, 5], [33, 6, 35, 11],
    ],
    props: [
      // hall
      [18, 14, '#'], [18, 24, '#'], [25, 14, '#'], [25, 24, '#'],
      [15, 17, '#'], [16, 17, '#'], [17, 17, '#'], [26, 17, '#'], [27, 17, '#'], [28, 17, '#'], [15, 23, '#'], [16, 23, '#'], [17, 23, '#'], [26, 23, '#'], [27, 23, '#'], [28, 23, '#'],
      [19, 27, '#'], [20, 27, '#'], [21, 27, '#'], [22, 27, '#'], [23, 27, '#'], [24, 27, '#'],
      [15, 11, 'C'], [16, 11, 'C'], [15, 12, 'c'], [27, 11, 'C'], [28, 11, 'C'], [28, 12, 'c'],
      [21, 18, 'C'], [22, 18, 'C'], [21, 19, 'C'], [22, 19, 'C'], [23, 20, 'c'], [20, 17, 'c'],
      [16, 27, 'C'], [17, 27, 'c'], [16, 26, 'c'], [26, 27, 'C'], [27, 27, 'C'], [27, 26, 'c'],
      [19, 12, 's'], [24, 12, 's'], [15, 20, 's'], [28, 20, 's'], [19, 26, 's'], [24, 26, 's'], [14, 18, 'o'], [29, 18, 'o'],
      [14, 9, 'P'], [15, 9, 'P'], [14, 10, 'P'], [15, 10, 'P'], [16, 9, '3'], [17, 9, '2'], [18, 9, '1'],
      [28, 9, 'P'], [29, 9, 'P'], [28, 10, 'P'], [29, 10, 'P'], [27, 9, '3'], [26, 9, '2'], [25, 9, '1'],
      // A site
      [35, 13, 'C'], [36, 13, 'c'], [39, 16, 'C'], [40, 16, 'C'], [40, 17, 'c'], [37, 19, 'C'], [37, 20, 'C'], [34, 18, 's'], [41, 21, 'o'], [34, 23, 'c'], [35, 23, 'C'], [38, 23, 's'], [41, 13, 'o'],
      // B site (mirror)
      [8, 13, 'C'], [7, 13, 'c'], [4, 16, 'C'], [3, 16, 'C'], [3, 17, 'c'], [6, 19, 'C'], [6, 20, 'C'], [9, 18, 's'], [2, 21, 'o'], [9, 23, 'c'], [8, 23, 'C'], [5, 23, 's'], [2, 13, 'o'],
      // lanes + spawns
      [37, 28, 'C'], [37, 29, 'c'], [40, 32, 'C'], [40, 33, 'c'], [40, 26, 'o'], [6, 28, 'C'], [6, 29, 'c'], [3, 32, 'C'], [3, 33, 'c'], [3, 26, 'o'],
      [17, 35, 'c'], [26, 35, 'c'], [21, 37, 'C'], [22, 37, 'C'], [17, 2, 'c'], [26, 2, 'c'], [21, 4, 's'],
    ],
    sites: {
      a: { name: 'A', center: [37.5, 18.5], plant: [C(36, 16), C(39, 19), C(35, 21)], holdsAtk: [C(34, 22), C(38, 22), C(35, 14), C(41, 15)], holdsDef: [C(35, 15), C(39, 14), C(40, 22)] },
      b: { name: 'B', center: [6.5, 18.5], plant: [C(7, 16), C(4, 19), C(8, 21)], holdsAtk: [C(9, 22), C(5, 22), C(8, 14), C(2, 15)], holdsDef: [C(8, 15), C(4, 14), C(3, 22)] },
    },
    routes: { a: [[C(38, 34), C(38, 26)], [C(22, 28), C(27, 22), C(31, 21)]], b: [[C(5, 34), C(5, 26)], [C(21, 28), C(16, 22), C(12, 21)]] },
    mid: [C(21, 11), C(24, 13)], lurk: C(21, 26), rangeStart: [41, 57, 0],
    signs: [[42, 18, -1, 0, 'A', RED], [1, 18, 1, 0, 'B', RED], [25, 32, 1, 0, 'MID', DARK], [30, 37, 0, -1, 'A ▸', RED], [13, 37, 0, -1, '◂ B', RED], [30, 2, 0, 1, 'A ▸', BLUE], [13, 2, 0, 1, '◂ B', BLUE]],
  },

  // ------------------------------------------------------------------ open plaza
  courtyard: {
    name: 'Courtyard', blurb: 'open plaza · fountain, alleys and big sites',
    theme: { walls: [[0.92, 0.88, 0.8], [0.85, 0.8, 0.72], [0.78, 0.82, 0.86], [0.9, 0.85, 0.78], [0.8, 0.7, 0.62]], floor: 'floorPave', skyTop: 0x6fa8e8, skyHor: 0xd6ecff, fog: 0xdbeaf6, ground: 0x7fa860, palms: true, roofs: [0xb8523a, 0x3d8fa8] },
    carve: [
      [2, 15, 8, 25, 'T'], [35, 15, 41, 25, 'D'], [12, 12, 31, 28], [9, 17, 11, 23], [32, 17, 34, 23],
      [14, 2, 29, 9, 'a'], [20, 10, 23, 11], [14, 31, 29, 38, 'b'], [20, 29, 23, 30],
      [3, 3, 6, 14], [7, 3, 13, 5], [3, 26, 6, 37], [7, 34, 13, 36],
      [37, 3, 40, 14], [30, 3, 36, 5], [37, 26, 40, 37], [30, 34, 36, 36],
    ],
    props: [
      // fountain + plaza cover
      [21, 19, 'P'], [22, 19, 'P'], [21, 20, 'P'], [22, 20, 'P'], [19, 18, 's'], [24, 21, 's'],
      [15, 18, '#'], [15, 19, '#'], [15, 21, '#'], [15, 22, '#'], [28, 18, '#'], [28, 19, '#'], [28, 21, '#'], [28, 22, '#'], [19, 17, 'C'], [24, 17, 'C'], [19, 23, 'C'], [24, 23, 'C'],
      [14, 15, 'C'], [14, 16, 'c'], [14, 24, 'C'], [15, 24, 'c'], [28, 15, 'C'], [29, 15, 'c'], [29, 24, 'C'], [28, 24, 'c'],
      [18, 14, 'c'], [25, 14, 'c'], [18, 26, 'c'], [25, 26, 'c'], [17, 20, 'o'], [17, 21, 'o'], [26, 20, 'o'],
      // A site
      [18, 3, 'C'], [18, 4, 'c'], [25, 4, 'C'], [26, 4, 'C'], [25, 5, 'c'], [21, 5, 'C'], [22, 5, 'C'], [21, 6, 'c'], [15, 8, 's'], [29, 3, 'o'], [15, 2, 'o'],
      [28, 8, 'P'], [29, 8, 'P'], [28, 9, 'P'], [29, 9, 'P'], [27, 9, '3'], [26, 9, '2'], [25, 9, '1'],
      // B site (mirror)
      [18, 37, 'C'], [18, 36, 'c'], [25, 36, 'C'], [26, 36, 'C'], [25, 35, 'c'], [21, 35, 'C'], [22, 35, 'C'], [21, 34, 'c'], [15, 32, 's'], [29, 37, 'o'], [15, 38, 'o'],
      [28, 32, 'P'], [29, 32, 'P'], [28, 31, 'P'], [29, 31, 'P'], [27, 31, '3'], [26, 31, '2'], [25, 31, '1'],
      // alleys + spawns
      [3, 8, 'C'], [3, 9, 'c'], [6, 12, 'o'], [3, 31, 'C'], [3, 30, 'c'], [6, 27, 'o'], [40, 8, 'C'], [40, 9, 'c'], [37, 12, 'o'], [40, 31, 'C'], [40, 30, 'c'], [37, 27, 'o'],
      [4, 18, 'c'], [4, 22, 'c'], [6, 20, 'C'], [39, 18, 'c'], [39, 22, 'c'], [37, 20, 'C'],
    ],
    sites: {
      a: { name: 'A', center: [21.5, 5.5], plant: [C(19, 5), C(24, 6), C(22, 3)], holdsAtk: [C(16, 7), C(26, 7), C(21, 8), C(17, 4)], holdsDef: [C(27, 4), C(24, 8), C(28, 6)] },
      b: { name: 'B', center: [21.5, 34.5], plant: [C(19, 35), C(24, 34), C(22, 37)], holdsAtk: [C(16, 33), C(26, 33), C(21, 32), C(17, 36)], holdsDef: [C(27, 36), C(24, 32), C(28, 34)] },
    },
    routes: { a: [[C(4, 10), C(10, 4)], [C(11, 20), C(18, 16), C(21, 12)]], b: [[C(4, 30), C(10, 35)], [C(11, 20), C(18, 24), C(21, 28)]] },
    mid: [C(27, 20), C(27, 24)], lurk: C(14, 20), rangeStart: [25, 51, -Math.PI / 2],
    signs: [[21, 1, 0, 1, 'A', RED], [21, 39, 0, -1, 'B', RED], [11, 15, 1, 0, 'MID', DARK], [8, 14, 0, 1, 'A ▸', RED], [8, 26, 0, -1, 'B ▸', RED], [35, 14, 0, 1, 'A ▸', BLUE], [35, 26, 0, -1, 'B ▸', BLUE]],
  },
};

export const MAP_LIST = Object.keys(DEFS).map((id) => ({ id, name: DEFS[id].name, blurb: DEFS[id].blurb }));

function carve(x0, z0, x1, z1, ch = '.') {
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) G[z * W + x] = ch;
}
export function loadMap(id) {
  const d = DEFS[id] || DEFS.sandstone;
  if (!DEFS[id]) id = 'sandstone';
  G.fill('#');
  for (const [x0, z0, x1, z1, ch] of d.carve) carve(x0, z0, x1, z1, ch);
  for (let i = 0; i < W * H; i++) ZONE[i] = G[i];
  for (const [x, z, ch] of d.props) G[z * W + x] = ch;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = G[z * W + x];
    HG[z * W + x] = ch === '#' ? 5.2 + ((x * 7 + z * 13) % 5) * 0.42 : (PH[ch] || 0);
  }
  WALKABLE.length = 0;
  for (let i = 0; i < W * H; i++) if (HG[i] === 0) WALKABLE.push(i);
  SPAWN.T = WALKABLE.filter((i) => ZONE[i] === 'T');
  SPAWN.D = WALKABLE.filter((i) => ZONE[i] === 'D');
  SITES.a = d.sites.a; SITES.b = d.sites.b;
  ROUTES.a = d.routes.a; ROUTES.b = d.routes.b;
  MID_HOLDS.length = 0; MID_HOLDS.push(...d.mid);
  LURK = d.lurk;
  MAP.id = id; MAP.name = d.name; MAP.theme = d.theme; MAP.signs = d.signs; MAP.rangeStart = d.rangeStart;
  MAP.seedOff = Object.keys(DEFS).indexOf(id) * 977;
}

export const hAt = (cx, cz) => (cx < 0 || cz < 0 || cx >= W || cz >= H) ? 60 : HG[cz * W + cx];
export const hPos = (x, z) => hAt(Math.floor(x / CS), Math.floor(z / CS));
export const zoneAt = (x, z) => {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
  return (cx < 0 || cz < 0 || cx >= W || cz >= H) ? '#' : ZONE[cz * W + cx];
};
export const cellOf = (x, z) => clampI(Math.floor(z / CS), 0, H - 1) * W + clampI(Math.floor(x / CS), 0, W - 1);
export const cellX = (i) => (i % W) * CS + CS / 2;
export const cellZ = (i) => Math.floor(i / W) * CS + CS / 2;
function clampI(v, a, b) { return v < a ? a : v > b ? b : v; }

export const walk = (i) => HG[i] === 0;

// ---- collision for actors (radius r, feet at y) ----
const R = 0.33, STEP = 0.55;
export function blocked(x, z, y) {
  const x0 = Math.floor((x - R) / CS), x1 = Math.floor((x + R) / CS);
  const z0 = Math.floor((z - R) / CS), z1 = Math.floor((z + R) / CS);
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) if (hAt(cx, cz) > y + STEP) return true;
  return false;
}
export function groundAt(x, z, y) {
  const x0 = Math.floor((x - R) / CS), x1 = Math.floor((x + R) / CS);
  const z0 = Math.floor((z - R) / CS), z1 = Math.floor((z + R) / CS);
  let g = 0;
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
    const h = hAt(cx, cz);
    if (h <= y + STEP && h > g) g = h;
  }
  return g;
}

// ---- ray vs world (2D DDA over height columns). o,d = {x,y,z}; d normalised ----
export function rayWorld(o, d, maxT) {
  let cx = Math.floor(o.x / CS), cz = Math.floor(o.z / CS);
  const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
  const tdx = d.x !== 0 ? Math.abs(CS / d.x) : Infinity;
  const tdz = d.z !== 0 ? Math.abs(CS / d.z) : Infinity;
  let tmx = d.x > 0 ? ((cx + 1) * CS - o.x) / d.x : d.x < 0 ? (cx * CS - o.x) / d.x : Infinity;
  let tmz = d.z > 0 ? ((cz + 1) * CS - o.z) / d.z : d.z < 0 ? (cz * CS - o.z) / d.z : Infinity;
  let t0 = 0, nx = 0, nz = 0;
  for (let guard = 0; guard < 400; guard++) {
    const h = hAt(cx, cz);
    const t1 = Math.min(tmx, tmz, maxT);
    const y0 = o.y + d.y * t0;
    if (h > 0) {
      if (y0 <= h) return { t: t0, nx, ny: 0, nz };
      const y1 = o.y + d.y * t1;
      if (y1 <= h) return { t: (o.y - h) / -d.y, nx: 0, ny: 1, nz: 0 };
    } else if (d.y < 0) {
      const tf = o.y / -d.y;
      if (tf <= t1) return { t: tf, nx: 0, ny: 1, nz: 0 };
    }
    if (t1 >= maxT) return null;
    if (tmx < tmz) { cx += sx; t0 = tmx; tmx += tdx; nx = -sx; nz = 0; }
    else { cz += sz; t0 = tmz; tmz += tdz; nz = -sz; nx = 0; }
  }
  return null;
}

// true if a walking line between two points stays on open floor
export function clearLine(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
  const n = Math.ceil(L / 0.45);
  for (let i = 0; i <= n; i++) {
    const x = x0 + dx * i / n, z = z0 + dz * i / n;
    if (hPos(x - 0.42, z - 0.42) || hPos(x + 0.42, z - 0.42) || hPos(x - 0.42, z + 0.42) || hPos(x + 0.42, z + 0.42)) return false;
  }
  return true;
}

// ---- A* over walkable cells (8-way, no corner cutting) ----
const gS = new Float32Array(W * H), from = new Int32Array(W * H), closed = new Uint8Array(W * H);
export function astar(s, g) {
  if (!walk(g)) g = nearestWalk(g);
  if (!walk(s)) s = nearestWalk(s);
  if (s === g) return [g];
  gS.fill(Infinity); closed.fill(0); from.fill(-1);
  const heap = [], gx = g % W, gz = (g / W) | 0;
  const hf = (i) => { const dx = Math.abs(i % W - gx), dz = Math.abs(((i / W) | 0) - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
  gS[s] = 0; push(s, hf(s));
  while (heap.length) {
    const c = pop();
    if (c === g) break;
    if (closed[c]) continue;
    closed[c] = 1;
    const x = c % W, z = (c / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const n = nz * W + nx;
      if (!walk(n) || closed[n]) continue;
      if (dx && dz && (!walk(z * W + nx) || !walk(nz * W + x))) continue;
      const ng = gS[c] + (dx && dz ? 1.414 : 1);
      if (ng < gS[n]) { gS[n] = ng; from[n] = c; push(n, ng + hf(n)); }
    }
  }
  if (from[g] < 0) return [g];
  const path = [];
  for (let c = g; c !== s && c >= 0; c = from[c]) path.push(c);
  return path.reverse();
}
export function nearestWalk(i) {
  const x = i % W, z = (i / W) | 0;
  for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, nz = z + dz;
    if (nx >= 0 && nz >= 0 && nx < W && nz < H && walk(nz * W + nx)) return nz * W + nx;
  }
  return i;
}

loadMap('sandstone');
