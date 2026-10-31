// Liftoff Labs game data: the world (Cobble and its moon Bean), ~65 parts, missions and starter rockets.
import { V } from './vec.js?v=2';

export const G0 = 9.81;
export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ worlds
const COBBLE_R = 500e3;
export const BODIES = {
  cobble: {
    id: 'cobble', name: 'Cobble', R: COBBLE_R, GM: 9.81 * COBBLE_R * COBBLE_R, parent: null,
    atm: { rho0: 1.225, H: 5000, top: 60e3 },
    seaLevelPressure: 101.3,
  },
  bean: {
    id: 'bean', name: 'Bean', R: 100e3, GM: 1.5 * 100e3 * 100e3, parent: 'cobble',
    orbit: { a: 8e6, phase0: 0.6 }, atm: null,
  },
};
BODIES.bean.orbit.n = Math.sqrt(BODIES.cobble.GM / Math.pow(BODIES.bean.orbit.a, 3));
BODIES.bean.soi = BODIES.bean.orbit.a * Math.pow(BODIES.bean.GM / BODIES.cobble.GM, 0.4);
BODIES.bean.orbit.period = TAU / BODIES.bean.orbit.n;

// where Bean is (relative to Cobble) and how fast it moves, at universal time ut
export function beanState(ut) {
  const o = BODIES.bean.orbit, th = o.phase0 + o.n * ut;
  return {
    r: [o.a * Math.cos(th), 0, -o.a * Math.sin(th)],
    v: [-o.a * o.n * Math.sin(th), 0, -o.a * o.n * Math.cos(th)],
  };
}

// The launch pad sits on Cobble's equator. "up" at the pad is +X, east (the way orbits go) is -Z, north is +Y.
export const PAD = { up: [1, 0, 0], east: [0, 0, -1], north: [0, 1, 0] };
export const SUN_DIR = V.norm([0.62, 0.40, 0.68]);

// ------------------------------------------------------------------ parts
// Sizes: S = 1.25 m wide, L = 2.5 m, X = 3.75 m
export const SIZE_D = { S: 1.25, L: 2.5, X: 3.75 };
export const PARTS = {};
// The six tabs in the hangar. Each part belongs to one tab through its `cat`.
export const GROUPS = [
  ['pilot', '\u{1F600}', 'Pilots', ['pod']],
  ['fuel', '\u{1F96B}', 'Fuel', ['tank']],
  ['engine', '\u{1F4EF}', 'Engines', ['engine']],
  ['boost', '\u{1F32D}', 'Boosters', ['srb']],
  ['hat', '\u{1F3A9}', 'Hats', ['nose']],
  ['help', '\u{1F6E0}', 'Helpers', ['decoupler', 'fin', 'chute', 'leg', 'wheel', 'misc']],
];
export const CATS = GROUPS.map((g) => [g[0], g[2]]);
export const groupOf = (p) => (GROUPS.find((g) => g[3].includes(p.cat)) || GROUPS[5])[0];

const PINK = 0xff7eb6, YEL = 0xffd84a, MINT = 0x6fe0b0, SKY = 0x6ec3ff, ORG = 0xff9a3c, PUR = 0xa98bff, RED = 0xff5a5a, CREAM = 0xfff3d6, TEAL = 0x2fc1c9, BRASS = 0xf2c14e;

function add(id, o) {
  const p = Object.assign({
    id, cat: 'misc', size: 'S', h: 1, r: 0.625, mass: 100, fuel: 0, price: 0, req: null,
    top: true, bottom: true,                          // stack nodes (top = where something can sit above, bottom = below)
    radial: false, radialOnly: false, side: true,     // can be bolted to the side of other parts / has a side to bolt to
    cdTop: 0.8, cdBot: 0.8, lift: 0.15, tol: 8,       // drag at each end, body lift slope, crash speed (m/s)
    torque: 0, desc: '',
  }, o);
  if (p.rb === undefined) p.rb = p.r;
  p.id = id;
  PARTS[id] = p;
  return p;
}

// ---- pilots
add('pod_pip', { name: 'Teapot', cat: 'pod', shape: 'teapot', h: 1.3, r: 0.38, rb: 0.625, mass: 800, torque: 7000, tol: 12, cdTop: 0.35, crew: 1, col: 0xfff3f8, acc: PINK, price: 0, desc: 'A teapot with a Pip inside. Yes, really. Spout and handle included.' });
add('pod_brain', { name: 'Bonk Bot', cat: 'pod', shape: 'bonk', h: 0.45, r: 0.625, mass: 110, torque: 1800, tol: 10, cdTop: 0.7, crew: 0, col: 0xdfe8f2, acc: SKY, price: 600, desc: 'A tiny robot who flies all by himself. No Pip needed. Very light!' });
add('pod_duo', { name: 'Fishbowl', cat: 'pod', shape: 'bowl', h: 1.7, r: 0.45, rb: 0.625, mass: 1900, torque: 14000, tol: 12, cdTop: 0.35, crew: 2, col: 0xd8f4ff, acc: ORG, price: 4200, desc: 'Room for two Pips and one very confused fish.' });
add('pod_cab', { name: 'Bathtub Bus', cat: 'pod', shape: 'tub', size: 'L', h: 2.6, r: 0.8, rb: 1.25, mass: 4200, torque: 26000, tol: 12, cdTop: 0.35, crew: 3, col: 0xffffff, acc: YEL, req: 'space', price: 9800, desc: 'A big bathtub with room for three Pips and a rubber duck. Splashy.' });
add('pod_brainL', { name: 'Big Bonk Bot', cat: 'pod', shape: 'bonk', size: 'L', h: 0.6, r: 1.25, mass: 520, torque: 6000, tol: 10, cdTop: 0.7, crew: 0, col: 0xdfe8f2, acc: PUR, req: 'space', price: 5200, desc: 'Bonk Bot has a big brother. He is also very polite.' });

// ---- fuel (food containers). Fuel weighs 8 times the empty can.
function tank(id, name, shape, size, L, price, req, col, acc, desc) {
  const D = SIZE_D[size], r = D / 2, fuel = 1000 * L * (D / 1.25) * (D / 1.25);
  add(id, { name, cat: 'tank', shape, size, h: L, r, mass: fuel / 8, fuel, price, req, cdTop: 0.8, tol: size === 'S' ? 10 : 8, col, acc, desc });
}
tank('tk_s05', 'Tuna Tin', 'tin', 'S', 0.5, 300, null, 0xbfc8d8, PINK, 'A flat little tin. Holds half a ton of fuel. Smells a bit fishy.');
tank('tk_s1', 'Soup Can', 'soup', 'S', 1, 0, null, RED, CREAM, 'A can of rocket soup. Holds 1 ton of fuel.');
tank('tk_s2', 'Juice Jug', 'jug', 'S', 2, 0, null, ORG, CREAM, 'A jug with a handle. Holds 2 tons of fuel.');
tank('tk_s4', 'Wobbly Barrel', 'barrel', 'S', 4, 1200, null, 0xb9794a, 0x7a4a2a, 'A tall wooden barrel. Holds 4 tons of fuel.');
tank('tk_l1', 'Cookie Jar', 'jar', 'L', 1, 1500, 'space', 0xffe2a8, RED, 'A big cookie jar. Holds 4 tons of fuel. No cookies inside. Sorry.');
tank('tk_l2', 'Trash Can', 'bin', 'L', 2, 3000, 'space', 0x9aa5b8, 0x6a7488, 'A shiny trash can. Holds 8 tons of fuel. Fuel is basically space trash.');
tank('tk_l4', 'Giant Thermos', 'thermos', 'L', 4, 5500, 'space', TEAL, 0xffffff, 'Keeps your fuel hot. Holds 16 tons.');
tank('tk_l8', 'Lava Lamp', 'lamp', 'L', 8, 9500, 'space', PUR, PINK, 'A very tall lava lamp. Holds 32 tons of fuel and looks groovy.');
tank('tk_x25', 'Pasta Pot', 'pot', 'X', 2.5, 14000, 'orbit', 0xc8cfdc, ORG, 'A giant pot with two handles. Holds 22 tons of fuel.');
tank('tk_x5', 'Mega Bucket', 'bucket', 'X', 5, 25000, 'orbit', SKY, YEL, 'A bucket the size of a house. Holds 45 tons.');
tank('tk_x10', 'Pickle Jar of Doom', 'bigjar', 'X', 10, 45000, 'orbit', MINT, YEL, 'The biggest jar ever. Holds 90 tons of fuel. Do not open.');
function rtank(id, name, L, price, desc) {
  const r = 0.3, fuel = 1000 * L * (r * 2 / 1.25) * (r * 2 / 1.25);
  add(id, { name, cat: 'tank', shape: 'pickle', h: L, r, mass: fuel / 8 + 12, fuel, radial: true, top: false, bottom: false, side: true, price, cdTop: 0.35, tol: 6, col: 0x6fc24a, acc: 0x4a9a32, desc });
}
rtank('rt_a', 'Pickle', 1.2, 600, 'A skinny pickle full of fuel. Stick it on the side of your rocket.');
rtank('rt_b', 'Big Pickle', 2.4, 1000, 'A longer pickle. More fuel, more crunch.');

// ---- engines (all of them are musical instruments, of course). Thrust in newtons, in a vacuum.
function engine(id, name, shape, size, o) {
  const D = SIZE_D[size], r = D / 2;
  add(id, Object.assign({ name, cat: 'engine', shape, size, h: size === 'S' ? 1.0 : size === 'L' ? 1.9 : 2.8, r, bottomOnly: 'decoupler', tol: 9, cdTop: 0.8, cdBot: 0.9,
    col: BRASS, acc: ORG, gimbal: 0 }, o));
}
engine('en_pop', 'Kazoo', 'kazoo', 'S', { mass: 1000, F: 200e3, ispAsl: 265, ispVac: 300, gimbal: 2, price: 0, col: TEAL, acc: PINK, desc: 'Your first engine. Goes BZZZ and pushes a lot. A little bit of steering.' });
engine('en_swish', 'Trumpet', 'trumpet', 'S', { mass: 1300, F: 215e3, ispAsl: 250, ispVac: 320, gimbal: 3, price: 2400, desc: 'Toot toot! Steers well and sips fuel.' });
engine('en_hum', 'Party Horn', 'partyhorn', 'S', { mass: 450, F: 60e3, ispAsl: 85, ispVac: 350, gimbal: 3, h: 0.9, price: 3200, desc: 'Made for space: weak in the air, super thrifty with fuel up there.' });
engine('en_spritz', 'Whistle', 'whistle', 'S', { mass: 130, F: 20e3, ispAsl: 265, ispVac: 320, gimbal: 1, h: 0.6, r: 0.4, price: 1000, desc: 'A tiny whistle engine for tiny rockets.' });
engine('en_dot', 'Squeaker', 'squeaker', 'S', { mass: 20, F: 2e3, ispAsl: 110, ispVac: 300, gimbal: 0, h: 0.35, r: 0.2, price: 450, desc: 'A rubber squeaker. Tiny push. Great for gentle landings on Bean.' });
engine('en_thud', 'Bullhorn', 'bullhorn', 'S', { mass: 900, F: 120e3, ispAsl: 275, ispVac: 305, gimbal: 6, h: 0.9, r: 0.35, radial: true, price: 1900, desc: 'A megaphone you can stick on the side. Steers a LOT.' });
engine('en_atom', 'Glow Bulb', 'bulb', 'S', { mass: 3000, F: 60e3, ispAsl: 185, ispVac: 800, gimbal: 1, h: 1.6, price: 18000, req: 'orbit', desc: 'A glowing science bulb. Slow push, but it sips fuel. Perfect for far trips.' });
engine('en_boomer', 'Tuba', 'tuba', 'L', { mass: 3000, F: 650e3, ispAsl: 280, ispVac: 320, gimbal: 2, price: 6500, req: 'space', desc: 'OOMPAH! A strong all-round engine.' });
engine('en_roar', 'Foghorn', 'foghorn', 'L', { mass: 6000, F: 1500e3, ispAsl: 285, ispVac: 310, gimbal: 1.5, h: 2.2, price: 11000, req: 'space', desc: 'The loudest engine. Very strong. Wake the neighbours.' });
engine('en_twist', 'French Horn', 'frenchhorn', 'L', { mass: 4000, F: 1000e3, ispAsl: 295, ispVac: 315, gimbal: 10, h: 2.0, price: 16000, req: 'space', desc: 'Strong, curly and wiggly. Steers big rockets.' });
engine('en_whistle', 'Saxophone', 'sax', 'L', { mass: 1750, F: 250e3, ispAsl: 90, ispVac: 350, gimbal: 4.5, h: 1.5, price: 7500, req: 'space', desc: 'Smooth. Best up in space, not in the air.' });
engine('en_mastodon', 'Trombone', 'trombone', 'X', { mass: 9000, F: 2000e3, ispAsl: 255, ispVac: 340, gimbal: 4, price: 28000, req: 'orbit', desc: 'Wah-wah-WAAAH. For giant rockets.' });
engine('en_colossus', 'Mega Foghorn', 'megahorn', 'X', { mass: 15000, F: 4000e3, ispAsl: 295, ispVac: 315, gimbal: 2, h: 3.4, price: 55000, req: 'orbit', desc: 'The biggest engine there is. Warn your mom.' });

// ---- boosters: yummy, but they cannot be turned off. They drop off by themselves when you press Space again.
function srb(id, name, shape, size, L, fuel, F, isp0, isp1, price, req, col, acc, desc) {
  const D = SIZE_D[size], r = D / 2;
  add(id, { name, cat: 'srb', shape, size, h: L, r, mass: Math.round(fuel * 0.2), fuel, F, ispAsl: isp0, ispVac: isp1, solid: true, radial: true, bottomOnly: 'decoupler', price, req, cdTop: 0.8, cdBot: 0.9, tol: 8, col, acc, desc });
}
srb('sr_flick', 'Firecracker', 'cracker', 'S', 1.0, 900, 150e3, 180, 200, 0, null, RED, YEL, 'Light the fuse! A small booster. It cannot be turned off, but it is cheap.');
srb('sr_crack', 'Sausage', 'sausage', 'S', 2.0, 2800, 240e3, 195, 220, 1500, null, 0xf08a6a, 0xc0533a, 'A sizzling booster. Medium push.');
srb('sr_thump', 'Baguette', 'baguette', 'S', 3.0, 7000, 400e3, 195, 225, 3500, null, 0xe8b66a, 0xc98a3a, 'A long, crusty booster with a strong push.');
srb('sr_kick', 'Salami Log', 'salami', 'L', 4.2, 21000, 670e3, 195, 220, 6000, 'space', 0xd0505a, 0xf6d3c0, 'A fat booster. Great for lifting heavy rockets.');
srb('sr_sledge', 'Giant Burrito', 'burrito', 'X', 6.5, 68000, 1500e3, 200, 230, 22000, 'orbit', 0xf2d9a0, 0x7fc15a, 'The biggest booster there is. Hold on to your hat!');

// ---- pop rings: press Space and everything below the ring floats away. (Side clips are added by themselves under boosters.)
add('dc_s', { name: 'Donut Ring', cat: 'decoupler', shape: 'donut', h: 0.22, r: 0.625, mass: 60, price: 0, sep: 2.5, tol: 8, col: PINK, acc: YEL, desc: 'A pink donut. Press Space and everything under it pops off!' });
add('dc_slim', { name: 'Thin Donut', cat: 'decoupler', shape: 'donut', h: 0.1, r: 0.625, mass: 25, price: 700, sep: 2.5, tol: 8, col: MINT, acc: YEL, desc: 'A skinny donut that weighs almost nothing.' });
add('dc_l', { name: 'Big Donut', cat: 'decoupler', shape: 'donut', size: 'L', h: 0.28, r: 1.25, mass: 200, price: 1200, req: 'space', sep: 2.5, tol: 8, col: PINK, acc: YEL, desc: 'A big donut for fat rockets.' });
add('dc_x', { name: 'Giant Donut', cat: 'decoupler', shape: 'donut', size: 'X', h: 0.34, r: 1.875, mass: 600, price: 4000, req: 'orbit', sep: 2.5, tol: 8, col: PINK, acc: YEL, desc: 'A donut the size of a bus.' });
add('dc_rad', { name: 'Side Clip', cat: 'decoupler', shape: 'clip', h: 0.5, r: 0.12, rr: 0.26, mass: 50, radial: true, radialOnly: true, top: false, bottom: false, side: true, price: 800, sep: 3.5, tol: 8, col: YEL, acc: 0x8a6a2a, desc: 'A clothes-pin that holds a booster on the side.' });

// ---- hats (nose cones) and adapters
add('nc_s', { name: 'Party Hat', cat: 'nose', shape: 'partyhat', h: 0.9, r: 0.625, mass: 50, top: false, price: 0, cdTop: 0.2, tol: 8, col: PINK, acc: YEL, desc: 'Parties are better with a pointy hat. It also makes your front slippery.' });
add('nc_round', { name: 'Beanie', cat: 'nose', shape: 'beanie', h: 0.45, r: 0.625, mass: 40, top: false, price: 300, cdTop: 0.35, tol: 8, col: SKY, acc: YEL, desc: 'A cozy knitted beanie with a pom-pom.' });
add('nc_l', { name: 'Wizard Hat', cat: 'nose', shape: 'wizard', size: 'L', h: 1.6, r: 1.25, mass: 160, top: false, price: 900, req: 'space', cdTop: 0.2, tol: 8, col: PUR, acc: YEL, desc: 'A big starry wizard hat for wide rockets.' });
add('nc_x', { name: 'Witch Hat', cat: 'nose', shape: 'witch', size: 'X', h: 2.3, r: 1.875, mass: 480, top: false, price: 2500, req: 'orbit', cdTop: 0.2, tol: 8, col: 0x4a3a6a, acc: ORG, desc: 'A giant witch hat. Cackle!' });
add('ad_ls', { name: 'Traffic Cone', cat: 'nose', shape: 'trafficcone', size: 'L', h: 1.0, r: 0.625, rb: 1.25, mass: 320, price: 1000, req: 'space', cdTop: 0.7, tol: 8, col: ORG, acc: 0xffffff, desc: 'Skinny on top, wide at the bottom. Put a small rocket on a big one.' });
add('ad_xl', { name: 'Big Traffic Cone', cat: 'nose', shape: 'trafficcone', size: 'X', h: 1.5, r: 1.25, rb: 1.875, mass: 900, price: 3000, req: 'orbit', cdTop: 0.7, tol: 8, col: ORG, acc: 0xffffff, desc: 'A giant cone to go from a huge rocket to a big one.' });
add('ad_sl', { name: 'Funnel', cat: 'nose', shape: 'funnel', size: 'L', h: 1.0, r: 1.25, rb: 0.625, mass: 320, price: 1000, req: 'space', cdTop: 0.8, tol: 8, col: 0xc8cfdc, acc: TEAL, desc: 'Wide on top, skinny at the bottom. Good for landers.' });

// ---- fins and wings (these keep a rocket pointing the right way in the air)
function fin(id, name, shape, span, chord, mass, price, lift, col, desc, req) {
  add(id, { name, cat: 'fin', shape, h: chord, r: 0.05, rr: span, mass, radial: true, radialOnly: true, top: false, bottom: false, side: false, finArea: span * chord * 0.6, finLift: lift, price, req: req || null, cdTop: 0.2, tol: 5, col, desc });
}
fin('fn_a', 'Flipper', 'flipper', 0.45, 0.8, 15, 0, 3.0, PINK, 'A little rubber flipper. Helps your rocket fly straight.');
fin('fn_b', 'Shark Fin', 'sharkfin', 0.8, 1.2, 40, 400, 4.0, SKY, 'Doo doo doo doo. A bigger fin. Put three on the bottom.');
fin('fn_c', 'Big Shark Fin', 'sharkfin', 1.3, 2.0, 100, 900, 4.5, TEAL, 'A really big shark fin for tall rockets.');
fin('fn_d', 'Pizza Wing', 'pizza', 1.8, 2.6, 130, 1600, 6.0, 0xffd27a, 'A slice of pizza with pepperoni. Surprisingly good wing.', 'space');

// ---- umbrellas (parachutes). Numbers are how much air they catch.
function chute(id, name, size, h, r, mass, cda, price, desc, req) {
  add(id, { name, cat: 'chute', shape: 'umbrella', size, h, r, mass, bottom: true, top: false, radial: true, side: false, chuteArea: cda, price, req: req || null, cdTop: 0.4, tol: 8, col: PINK, acc: YEL, desc });
}
chute('ch_mini', 'Cocktail Umbrella', 'S', 0.3, 0.3, 50, 220, 400, 'A tiny paper umbrella for tiny rockets.');
chute('ch_cloud', 'Umbrella', 'S', 0.4, 0.4, 100, 750, 0, 'Press Space to get it ready. It opens by itself when you fall.');
chute('ch_drogue', 'Brolly', 'S', 0.3, 0.3, 50, 120, 900, 'A small umbrella that opens even when you are zooming.');
chute('ch_big', 'Beach Umbrella', 'L', 0.6, 0.8, 300, 2600, 2800, 'A giant beach umbrella for heavy rockets.', 'space');

// ---- legs. They hold the rocket up. G folds them away.
function leg(id, name, shape, h, rr, drop, mass, price, tol, desc, req) {
  add(id, { name, cat: 'leg', shape: 'leg', variant: shape, h, r: 0.08, rr, drop, mass, radial: true, radialOnly: true, top: false, bottom: false, side: false, price, req: req || null, cdTop: 0.2, tol, col: 0xdfe4ee, acc: PINK, desc });
}
leg('lg_a', 'Bunny Feet', 'bunny', 0.9, 0.7, 1.5, 30, 900, 12, 'Fluffy bunny feet. Land softly on small rockets. Use three or four.');
leg('lg_b', 'Spider Legs', 'spider', 1.3, 1.0, 2.1, 90, 2000, 14, 'Long spindly legs for a medium rocket. A bit creepy.');
leg('lg_c', 'Elephant Feet', 'elephant', 1.9, 1.6, 3.2, 260, 5500, 16, 'Big heavy elephant feet for a big lander.', 'orbit');

// ---- hamster wheels add turning power
function wheel(id, name, size, h, mass, torque, price, req, desc) {
  const D = SIZE_D[size];
  add(id, { name, cat: 'wheel', shape: 'hamster', size, h, r: D / 2, mass, torque, price, req, cdTop: 0.8, tol: 8, col: 0xdfe4ee, acc: ORG, desc });
}
wheel('rw_s', 'Hamster Wheel', 'S', 0.35, 100, 15000, 1200, null, 'A hamster runs inside it and helps turn the rocket.');
wheel('rw_l', 'Big Hamster Wheel', 'L', 0.5, 450, 70000, 4500, 'space', 'A bigger wheel with a bigger, stronger hamster.');
wheel('rw_x', 'Giant Hamster Wheel', 'X', 0.7, 1600, 250000, 14000, 'orbit', 'This hamster has been working out. Turns anything.');

// ---- extras
add('mi_flag', { name: 'Silly Flag', cat: 'misc', shape: 'flag', h: 0.7, r: 0.04, mass: 1, bottom: true, top: false, radial: true, side: false, price: 100, cdTop: 0.2, tol: 99, col: PINK, acc: YEL, desc: 'A flag with a smiley face. Weighs nothing. Looks great.' });

export const PART_LIST = Object.values(PARTS);

// What a part contributes: helpers used by lots of other code
export const isEngine = (p) => p.F !== undefined;
export const isDecoupler = (p) => p.cat === 'decoupler';
export const isChute = (p) => p.chuteArea !== undefined;
export const isLeg = (p) => p.cat === 'leg';
export const isFuelTank = (p) => p.fuel > 0 && !p.solid;
export const radialExtent = (p) => (p.radialOnly ? p.rr / 2 : p.r);

// ------------------------------------------------------------------ missions
// Milestones pay once. Contracts are made up fresh and pay when done.
export const MILESTONES = [
  ['liftoff', 'Liftoff!', 'Rise 10 m off the pad.', 300],
  ['stage', 'Pop-off!', 'Drop an empty part by pressing Space.', 300],
  ['k1', '1 km up', 'Reach 1,000 m.', 700],
  ['fast', 'Faster than sound', 'Fly faster than 340 m/s.', 1000],
  ['k10', '10 km up', 'Reach 10,000 m.', 1500],
  ['landed', 'Soft landing', 'Land softly after a flight above 500 m.', 1500],
  ['pin', 'Bullseye landing', 'Land within 2 km of the launch pad after a flight above 5 km.', 1500],
  ['space', 'Reach space!', 'Get above the sky: 60,000 m.', 6000],
  ['orbit', 'Go around the planet!', 'Zoom sideways so fast you keep missing the ground (lowest point above 60 km).', 20000],
  ['orbitHome', 'Orbit and back', 'Land safely after going around the planet.', 15000],
  ['moonSoi', 'Say hi to Bean', 'Fly close enough to feel the moon Bean.', 25000],
  ['moonOrbit', 'Circle Bean', 'Go around the moon Bean.', 30000],
  ['moonLand', 'Land on Bean', 'Touch down on Bean.', 50000],
  ['moonHome', 'Home from Bean', 'Land back on Cobble after visiting Bean.', 80000],
];
export const MILESTONE = Object.fromEntries(MILESTONES.map((m) => [m[0], { id: m[0], name: m[1], desc: m[2], reward: m[3] }]));

// ------------------------------------------------------------------ starter rockets
// A design is a list of parts. {t: part id, p: parent index, n: node ('b' below, 't' above, 's' side), s: slot on the parent ('top','mid','bot'), a: angle for side parts, g: group}
export const STARTERS = [
  {
    name: 'Pip Hopper', blurb: 'A tiny hop: up a few kilometres and back down with the parachute.',
    parts: [
      { t: 'pod_pip', p: -1 }, { t: 'ch_cloud', p: 0, n: 't' }, { t: 'tk_s1', p: 0, n: 'b' }, { t: 'en_pop', p: 2, n: 'b' },
      { t: 'fn_a', p: 2, n: 's', s: 'bot', a: 0, g: 1 }, { t: 'fn_a', p: 2, n: 's', s: 'bot', a: 120, g: 1 }, { t: 'fn_a', p: 2, n: 's', s: 'bot', a: 240, g: 1 },
    ],
  },
  {
    name: 'Sky Sounder', blurb: 'Up past the sky and back. Drop the engine stack, then open the parachute. Earns your first big money.',
    parts: [
      { t: 'pod_pip', p: -1 }, { t: 'ch_cloud', p: 0, n: 't' }, { t: 'dc_s', p: 0, n: 'b' }, { t: 'tk_s2', p: 2, n: 'b' }, { t: 'en_pop', p: 3, n: 'b' },
      { t: 'fn_a', p: 3, n: 's', s: 'bot', a: 0, g: 1 }, { t: 'fn_a', p: 3, n: 's', s: 'bot', a: 90, g: 1 }, { t: 'fn_a', p: 3, n: 's', s: 'bot', a: 180, g: 1 }, { t: 'fn_a', p: 3, n: 's', s: 'bot', a: 270, g: 1 },
    ],
  },
  {
    name: 'Twin Booster', blurb: 'Two solid boosters strapped to the sides. Drop them when they run dry.',
    parts: [
      { t: 'pod_pip', p: -1 }, { t: 'ch_cloud', p: 0, n: 't' }, { t: 'tk_s2', p: 0, n: 'b' }, { t: 'en_pop', p: 2, n: 'b' },
      { t: 'dc_rad', p: 2, n: 's', s: 'mid', a: 0, g: 1 }, { t: 'dc_rad', p: 2, n: 's', s: 'mid', a: 180, g: 1 },
      { t: 'sr_flick', p: 4, n: 's', s: 'mid', a: 0, g: 2 }, { t: 'sr_flick', p: 5, n: 's', s: 'mid', a: 180, g: 2 },
      { t: 'nc_s', p: 6, n: 't', g: 3 }, { t: 'nc_s', p: 7, n: 't', g: 3 },
      { t: 'fn_b', p: 2, n: 's', s: 'bot', a: 90, g: 4 }, { t: 'fn_b', p: 2, n: 's', s: 'bot', a: 270, g: 4 },
    ],
  },
  {
    name: 'Orbit Pioneer', blurb: 'Two stages built to reach orbit. Needs the Trumpet engine and Wobbly Barrel tank.',
    parts: [
      { t: 'pod_pip', p: -1 }, { t: 'ch_cloud', p: 0, n: 't' }, { t: 'tk_s1', p: 0, n: 'b' }, { t: 'en_hum', p: 2, n: 'b' }, { t: 'dc_s', p: 3, n: 'b' },
      { t: 'tk_s4', p: 4, n: 'b' }, { t: 'tk_s4', p: 5, n: 'b' }, { t: 'en_swish', p: 6, n: 'b' },
      { t: 'fn_b', p: 6, n: 's', s: 'bot', a: 0, g: 1 }, { t: 'fn_b', p: 6, n: 's', s: 'bot', a: 90, g: 1 }, { t: 'fn_b', p: 6, n: 's', s: 'bot', a: 180, g: 1 }, { t: 'fn_b', p: 6, n: 's', s: 'bot', a: 270, g: 1 },
    ],
  },
];
