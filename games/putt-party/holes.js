// PUTT PARTY - the nine holes. The tee is at the bottom (big z), the cup at the top (small z); everything is in metres.
// polys = the floor outlines, blocks = solid boxes [x0,z0,x1,z1], bumpers = [x,z,r], mills = windmills, sliders = walls that slide,
// sand = slow patches, water = ponds ([x0,z0,x1,z1] or [x,z,r]), boost = speed strips, tele = pipes, route = the way to the cup (for the bots).
const R = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
export const THEMES = {
  meadow: { name: 'Sunny Meadow', floor: [0x6ad46a, 0x5cc85c], wall: 0xfff0d0, trim: 0xffffff, ground: 0x4fb04f, sky: [0x3a9bff, 0x9fdcff, 0xfff2dc], fog: [0xcfeaff, 90, 360], hemi: [0xd8eeff, 0x9ab0a0, 1.1], sun: [0xfff1d0, 2.3], deco: 'meadow' },
  desert: { name: 'Desert Dunes', floor: [0xf0c070, 0xe6b45e], wall: 0xc87a4a, trim: 0xffe0a0, ground: 0xd89a5a, sky: [0x3a7aff, 0xffc890, 0xfff0c0], fog: [0xffe0b0, 80, 340], hemi: [0xfff0d8, 0xb08a60, 1.1], sun: [0xfff0c0, 2.4], deco: 'desert' },
  neon: { name: 'Neon Night', floor: [0x4a3aa8, 0x3f3294], wall: 0xff4fa8, trim: 0x2ee6ff, ground: 0x1a1240, sky: [0x0a0630, 0x3a1280, 0xff4fa8], fog: [0x2a1060, 60, 260], hemi: [0x9a8aff, 0x2a2060, 1.0], sun: [0xb0a0ff, 1.5], stars: .6, deco: 'neon' },
};
export const HOLES = [
  { name: 'First Putt', theme: 'meadow', par: 2, polys: [R(-3.5, -22, 3.5, 3)], tee: [0, 0], cup: [0, -18], route: [[0, 0], [0, -18]] },
  { name: 'Dogleg', theme: 'meadow', par: 3, polys: [[[-3.5, 3], [3.5, 3], [3.5, -12], [15, -12], [15, -19], [-3.5, -19]]], tee: [0, 0], cup: [12, -15.5], route: [[0, 0], [0, -15.5], [12, -15.5]] },
  { name: 'Bumper Park', theme: 'meadow', par: 3, polys: [R(-6.5, -24, 6.5, 3)], bumpers: [[-3, -6, .9], [3, -10, .9], [-2.5, -14, .9], [2.5, -18, .9]], tee: [0, 0], cup: [0, -21], route: [[0, 0], [0, -21]] },
  { name: 'Windmill', theme: 'desert', par: 3, polys: [R(-4, -26, 4, 3)], mills: [{ x: 0, z: -12, len: 3.4, n: 2, omega: 1.5, phase: 0, hub: .6 }], tee: [0, 0], cup: [0, -22.5], route: [[0, 0], [0, -22.5]] },
  { name: 'Sand and Pond', theme: 'desert', par: 3, polys: [R(-7, -24, 7, 3)], water: [[-7, -17, 1.5, -10]], sand: [[2.5, -9.5, 7, -4]], bumpers: [[4.5, -14, .7]], tee: [0, 0], cup: [-3, -21], route: [[0, 0], [4, -4], [4.5, -17.5], [-3, -21]] },
  { name: 'Boost Lane', theme: 'desert', par: 3, polys: [[[-3, 3], [-3, -15], [9, -15], [9, -27], [15, -27], [15, -9], [3, -9], [3, 3]]], boost: [{ rect: [0, -14.4, 6, -9.6], dir: [1, 0] }, { rect: [9.6, -22, 14.4, -17], dir: [0, -1] }], tee: [0, 0], cup: [12, -24.5], route: [[0, 0], [0, -12], [12, -12], [12, -24.5]] },
  { name: 'Sliding Doors', theme: 'neon', par: 3, polys: [R(-5, -28, 5, 3)], sliders: [{ x0: -5, z0: -9, x1: 1.5, z1: -9, dx: 3.5, dz: 0, period: 5, phase: 0 }, { x0: -1.5, z0: -17, x1: 5, z1: -17, dx: -3.5, dz: 0, period: 5, phase: .2 }], tee: [0, 0], cup: [0, -25], route: [[0, 0], [0, -25]] },
  { name: 'Pipe Dream', theme: 'neon', par: 3, polys: [R(-6, -9, 6, 3), R(-6, -26, 6, -13)], bumpers: [[0, -3, .8], [0, -19.5, .8]], tele: [{ a: [3.5, -6], b: [-3.5, -16, Math.atan2(-6.5, 3)] }], tee: [0, 0], cup: [0, -23], route: [[0, 0], [3.5, -6], [-3.5, -16], [0, -23]] },
  { name: 'The Gauntlet', theme: 'neon', par: 4, polys: [[[-4.5, 3], [4.5, 3], [4.5, -20], [-10, -20], [-10, -34], [-18, -34], [-18, -12], [-4.5, -12]]], mills: [{ x: 0, z: -5, len: 3.9, n: 2, omega: 1.6, phase: 1, hub: .6 }], bumpers: [[-4, -16, .9]], sliders: [{ x0: -18, z0: -26, x1: -12.5, z1: -26, dx: 2.5, dz: 0, period: 4.4, phase: 0 }], sand: [[-18, -22.5, -10, -20.5]], tee: [0, 0], cup: [-14, -31], route: [[0, 0], [0, -16], [-14, -16], [-14, -31]] },
];
