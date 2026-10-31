// Liftoff Labs game data: the world (Cobble and its moon Bean), ~65 parts, missions and starter rockets.
import { V } from './vec.js?v=1';

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
export const CATS = [
  ['pod', 'Pods'], ['tank', 'Fuel tanks'], ['engine', 'Engines'], ['srb', 'Boosters'], ['decoupler', 'Stage rings'],
  ['nose', 'Nose & adapters'], ['fin', 'Fins'], ['chute', 'Parachutes'], ['leg', 'Landing legs'], ['wheel', 'Spin wheels'], ['misc', 'Extras'],
];

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

// ---- pods and probe cores
add('pod_pip', { name: 'Pip Pod', cat: 'pod', shape: 'pod', h: 1.3, r: 0.38, rb: 0.625, mass: 800, torque: 7000, tol: 12, cdTop: 0.35, crew: 1, col: 0xf2f4fa, acc: 0xff5fa8, price: 0, desc: 'A snug pod for one Pip. Has its own spin wheel so it can turn the rocket.' });
add('pod_brain', { name: 'Brain Box', cat: 'pod', shape: 'probe', h: 0.45, r: 0.625, mass: 110, torque: 1800, tol: 10, cdTop: 0.7, crew: 0, col: 0xdfe4ee, acc: 0x37d6e8, price: 600, desc: 'A tiny robot brain. Flies by itself, so no Pip needs to ride along. Very light.' });
add('pod_duo', { name: 'Duo Pod', cat: 'pod', shape: 'pod', h: 1.7, r: 0.45, rb: 0.625, mass: 1900, torque: 14000, tol: 12, cdTop: 0.35, crew: 2, col: 0xf2f4fa, acc: 0x37d6e8, price: 4200, desc: 'Room for two Pips and a stronger spin wheel.' });
add('pod_cab', { name: 'Cabin Pod', cat: 'pod', shape: 'pod', size: 'L', h: 2.6, r: 0.8, rb: 1.25, mass: 4200, torque: 26000, tol: 12, cdTop: 0.35, crew: 3, col: 0xf2f4fa, acc: 0xffc83a, req: 'space', price: 9800, desc: 'A big 2.5 m cabin for three Pips. Heavy, but it turns big rockets.' });
add('pod_brainL', { name: 'Brain Box Big', cat: 'pod', shape: 'probe', size: 'L', h: 0.6, r: 1.25, mass: 520, torque: 6000, tol: 10, cdTop: 0.7, crew: 0, col: 0xdfe4ee, acc: 0xa77bff, req: 'space', price: 5200, desc: 'The 2.5 m robot brain for big rockets with no passengers.' });

// ---- fuel tanks. Fuel weighs 8 times the empty tank.
function tank(id, name, size, L, price, req, desc) {
  const D = SIZE_D[size], r = D / 2, fuel = 1000 * L * (D / 1.25) * (D / 1.25);
  add(id, { name, cat: 'tank', shape: 'tank', size, h: L, r, mass: fuel / 8, fuel, price, req, cdTop: 0.8, tol: size === 'S' ? 10 : 8, desc });
}
tank('tk_s05', 'Thimble Tank', 'S', 0.5, 300, null, 'A small 0.5 m tank, holds 0.5 t of fuel.');
tank('tk_s1', 'Cup Tank', 'S', 1, 0, null, 'A 1 m tank, holds 1 t of fuel.');
tank('tk_s2', 'Jug Tank', 'S', 2, 0, null, 'A 2 m tank, holds 2 t of fuel.');
tank('tk_s4', 'Barrel Tank', 'S', 4, 1200, null, 'A tall 4 m tank, holds 4 t of fuel.');
tank('tk_l1', 'Bucket Tank', 'L', 1, 1500, 'space', 'A wide 2.5 m tank, holds 4 t of fuel.');
tank('tk_l2', 'Silo Tank', 'L', 2, 3000, 'space', 'A wide tank, holds 8 t of fuel.');
tank('tk_l4', 'Tower Tank', 'L', 4, 5500, 'space', 'A wide tank, holds 16 t of fuel.');
tank('tk_l8', 'Giant Tank', 'L', 8, 9500, 'space', 'A very tall wide tank, holds 32 t of fuel.');
tank('tk_x25', 'Jumbo Tank', 'X', 2.5, 14000, 'orbit', 'A 3.75 m monster, holds 22 t of fuel.');
tank('tk_x5', 'Jumbo Tank XL', 'X', 5, 25000, 'orbit', 'Holds 45 t of fuel.');
tank('tk_x10', 'Jumbo Tank XXL', 'X', 10, 45000, 'orbit', 'Holds 90 t of fuel. Huge!');
function rtank(id, name, L, price, desc) {
  const r = 0.3, fuel = 1000 * L * (r * 2 / 1.25) * (r * 2 / 1.25);
  add(id, { name, cat: 'tank', shape: 'rtank', h: L, r, mass: fuel / 8 + 12, fuel, radial: true, top: false, bottom: false, side: true, price, cdTop: 0.35, tol: 6, desc });
}
rtank('rt_a', 'Hip Tank', 1.2, 600, 'A skinny tank that bolts to the side of the rocket.');
rtank('rt_b', 'Hip Tank Long', 2.4, 1000, 'A longer side tank.');

// ---- liquid engines (thrust in newtons, in a vacuum)
function engine(id, name, size, o) {
  const D = SIZE_D[size], r = D / 2;
  add(id, Object.assign({ name, cat: 'engine', shape: 'engine', size, h: size === 'S' ? 1.0 : size === 'L' ? 1.9 : 2.8, r, bottomOnly: 'decoupler', tol: 9, cdTop: 0.8, cdBot: 0.9,
    col: 0x7d8597, acc: 0xff8a3d, gimbal: 0, thrustCurve: false }, o));
}
engine('en_pop', 'Pop', 'S', { mass: 1000, F: 200e3, ispAsl: 265, ispVac: 300, gimbal: 2, price: 0, acc: 0xff8a3d, desc: 'The starter engine. Steady and cheap. A little bit of steering.' });
engine('en_swish', 'Swish', 'S', { mass: 1300, F: 215e3, ispAsl: 250, ispVac: 320, gimbal: 3, price: 2400, acc: 0xff5fa8, desc: 'Steers well and is good with fuel.' });
engine('en_hum', 'Hum', 'S', { mass: 450, F: 60e3, ispAsl: 85, ispVac: 350, gimbal: 3, h: 0.9, price: 3200, acc: 0x37d6e8, desc: 'Made for space: weak in the air, very good with fuel in a vacuum.' });
engine('en_spritz', 'Spritz', 'S', { mass: 130, F: 20e3, ispAsl: 265, ispVac: 320, gimbal: 1, h: 0.6, r: 0.4, price: 1000, acc: 0xffc83a, desc: 'Tiny engine for little rockets and landers.' });
engine('en_dot', 'Dot', 'S', { mass: 20, F: 2e3, ispAsl: 110, ispVac: 300, gimbal: 0, h: 0.35, r: 0.2, price: 450, acc: 0xffffff, desc: 'A micro thruster. Perfect for soft touchdowns on Bean.' });
engine('en_thud', 'Thud', 'S', { mass: 900, F: 120e3, ispAsl: 275, ispVac: 305, gimbal: 6, h: 0.9, r: 0.35, radial: true, price: 1900, acc: 0xb07bff, desc: 'A side engine you can bolt on the outside. Steers a lot.' });
engine('en_atom', 'Atom Drive', 'S', { mass: 3000, F: 60e3, ispAsl: 185, ispVac: 800, gimbal: 1, h: 1.6, price: 18000, req: 'orbit', acc: 0x5dff9a, desc: 'A nuclear-powered engine. Slow push, but it sips fuel. Great for far trips.' });
engine('en_boomer', 'Boomer', 'L', { mass: 3000, F: 650e3, ispAsl: 280, ispVac: 320, gimbal: 2, price: 6500, req: 'space', acc: 0xff4d4d, desc: 'Strong all-round 2.5 m engine.' });
engine('en_roar', 'Roar', 'L', { mass: 6000, F: 1500e3, ispAsl: 285, ispVac: 310, gimbal: 1.5, h: 2.2, price: 11000, req: 'space', acc: 0xff8a3d, desc: 'Very strong engine for heavy rockets.' });
engine('en_twist', 'Twist', 'L', { mass: 4000, F: 1000e3, ispAsl: 295, ispVac: 315, gimbal: 10, h: 2.0, price: 16000, req: 'space', acc: 0xa77bff, desc: 'Strong and swivels a lot, so it steers big rockets.' });
engine('en_whistle', 'Whistle', 'L', { mass: 1750, F: 250e3, ispAsl: 90, ispVac: 350, gimbal: 4.5, h: 1.5, price: 7500, req: 'space', acc: 0x37d6e8, desc: 'A big vacuum engine for upper stages.' });
engine('en_mastodon', 'Mastodon', 'X', { mass: 9000, F: 2000e3, ispAsl: 255, ispVac: 340, gimbal: 4, price: 28000, req: 'orbit', acc: 0xff5fa8, desc: 'A 3.75 m engine for giant first stages.' });
engine('en_colossus', 'Colossus', 'X', { mass: 15000, F: 4000e3, ispAsl: 295, ispVac: 315, gimbal: 2, h: 3.4, price: 55000, req: 'orbit', acc: 0xffc83a, desc: 'The biggest engine there is.' });

// ---- solid boosters: no throttle, no off switch, burn until empty
function srb(id, name, size, L, fuel, F, isp0, isp1, price, req, col, desc) {
  const D = SIZE_D[size], r = D / 2;
  add(id, { name, cat: 'srb', shape: 'srb', size, h: L, r, mass: Math.round(fuel * 0.2), fuel, F, ispAsl: isp0, ispVac: isp1, solid: true, radial: true, bottomOnly: 'decoupler', price, req, cdTop: 0.8, cdBot: 0.9, tol: 8, col, acc: 0xff4d4d, desc });
}
srb('sr_flick', 'Flicker', 'S', 1.0, 900, 150e3, 180, 200, 0, null, 0xf2f4fa, 'A little solid booster. Starts and cannot be stopped, but it is cheap.');
srb('sr_crack', 'Crackle', 'S', 2.0, 2800, 240e3, 195, 220, 1500, null, 0xf2f4fa, 'A medium solid booster.');
srb('sr_thump', 'Thumper', 'S', 3.0, 7000, 400e3, 195, 225, 3500, null, 0xf2f4fa, 'A long, strong solid booster.');
srb('sr_kick', 'Kickstart', 'L', 4.2, 21000, 670e3, 195, 220, 6000, 'space', 0xffe9b8, 'A fat 2.5 m booster. Great for lifting heavy rockets.');
srb('sr_sledge', 'Sledgehammer', 'X', 6.5, 68000, 1500e3, 200, 230, 22000, 'orbit', 0xffe9b8, 'The biggest solid booster. Hang on!');

// ---- stage rings (decouplers): fire to let go of everything below (or outside for the side one)
add('dc_s', { name: 'Stage Ring', cat: 'decoupler', shape: 'ring', h: 0.22, r: 0.625, mass: 60, price: 0, sep: 2.5, tol: 8, col: 0xffd23a, desc: 'Press space and the part below it floats away.' });
add('dc_slim', { name: 'Slim Ring', cat: 'decoupler', shape: 'ring', h: 0.1, r: 0.625, mass: 25, price: 700, sep: 2.5, tol: 8, col: 0xffd23a, desc: 'A skinny stage ring that weighs almost nothing.' });
add('dc_l', { name: 'Stage Ring L', cat: 'decoupler', shape: 'ring', size: 'L', h: 0.28, r: 1.25, mass: 200, price: 1200, req: 'space', sep: 2.5, tol: 8, col: 0xffd23a, desc: 'A stage ring for 2.5 m rockets.' });
add('dc_x', { name: 'Stage Ring XL', cat: 'decoupler', shape: 'ring', size: 'X', h: 0.34, r: 1.875, mass: 600, price: 4000, req: 'orbit', sep: 2.5, tol: 8, col: 0xffd23a, desc: 'A stage ring for 3.75 m rockets.' });
add('dc_rad', { name: 'Side Pop', cat: 'decoupler', shape: 'sidering', h: 0.5, r: 0.12, rr: 0.26, mass: 50, radial: true, radialOnly: true, top: false, bottom: false, side: true, price: 800, sep: 3.5, tol: 8, col: 0xffd23a, desc: 'Bolt it on the side, then bolt a booster to it. Press space to drop the booster.' });

// ---- nose cones and adapters
add('nc_s', { name: 'Nose Cone', cat: 'nose', shape: 'nose', h: 0.9, r: 0.625, mass: 50, top: false, price: 0, cdTop: 0.2, tol: 8, col: 0xff5a5a, desc: 'Makes the front slippery in the air.' });
add('nc_round', { name: 'Bubble Nose', cat: 'nose', shape: 'dome', h: 0.45, r: 0.625, mass: 40, top: false, price: 300, cdTop: 0.35, tol: 8, col: 0xffc83a, desc: 'A rounded nose. Good enough, and cute.' });
add('nc_l', { name: 'Nose Cone L', cat: 'nose', shape: 'nose', size: 'L', h: 1.6, r: 1.25, mass: 160, top: false, price: 900, req: 'space', cdTop: 0.2, tol: 8, col: 0xff5a5a, desc: 'A nose cone for 2.5 m rockets.' });
add('nc_x', { name: 'Nose Cone XL', cat: 'nose', shape: 'nose', size: 'X', h: 2.3, r: 1.875, mass: 480, top: false, price: 2500, req: 'orbit', cdTop: 0.2, tol: 8, col: 0xff5a5a, desc: 'A nose cone for 3.75 m rockets.' });
add('ad_ls', { name: 'Taper S-L', cat: 'nose', shape: 'adapter', size: 'L', h: 1.0, r: 0.625, rb: 1.25, mass: 320, price: 1000, req: 'space', cdTop: 0.7, tol: 8, col: 0xdfe4ee, desc: 'Skinny on top, wide on the bottom. Put the small stage above the big one.' });
add('ad_xl', { name: 'Taper L-XL', cat: 'nose', shape: 'adapter', size: 'X', h: 1.5, r: 1.25, rb: 1.875, mass: 900, price: 3000, req: 'orbit', cdTop: 0.7, tol: 8, col: 0xdfe4ee, desc: 'Narrows a 3.75 m stage down to 2.5 m.' });
add('ad_sl', { name: 'Flare L-S', cat: 'nose', shape: 'adapter', size: 'L', h: 1.0, r: 1.25, rb: 0.625, mass: 320, price: 1000, req: 'space', cdTop: 0.8, tol: 8, col: 0xdfe4ee, desc: 'Wide on top, skinny on the bottom. Good for a lander.' });

// ---- fins and wings (these keep a rocket pointing the right way in the air)
function fin(id, name, span, chord, mass, price, lift, col, desc, req) {
  add(id, { name, cat: 'fin', shape: 'fin', h: chord, r: 0.05, rr: span, mass, radial: true, radialOnly: true, top: false, bottom: false, side: false, price, req: req || null, finArea: span * chord * 0.6, finLift: lift, cdTop: 0.2, tol: 5, col, desc });
}
fin('fn_a', 'Sprig Fin', 0.45, 0.8, 15, 0, 3.0, 0xff5fa8, 'A little fin.');
fin('fn_b', 'Fin', 0.8, 1.2, 40, 400, 4.0, 0xff5fa8, 'A bigger fin. Put three or four on the bottom to fly straight.');
fin('fn_c', 'Big Fin', 1.3, 2.0, 100, 900, 4.5, 0x37d6e8, 'A large fin for tall rockets.');
fin('fn_d', 'Swept Wing', 1.8, 2.6, 130, 1600, 6.0, 0xffc83a, 'The strongest fin there is.', 'space');

// ---- parachutes (full-open area in square metres, times drag)
function chute(id, name, size, h, r, mass, cda, price, desc, req) {
  add(id, { name, cat: 'chute', shape: 'chute', size, h, r, mass, bottom: true, top: false, radial: true, side: false, chuteArea: cda, price, req: req || null, cdTop: 0.4, tol: 8, col: 0xf2f4fa, acc: 0xff8a3d, desc });
}
chute('ch_mini', 'Mini Chute', 'S', 0.3, 0.3, 50, 220, 400, 'A small parachute for light probes.');
chute('ch_cloud', 'Cloud Chute', 'S', 0.4, 0.4, 100, 750, 0, 'The standard parachute. Press space to arm it, it opens by itself.');
chute('ch_drogue', 'Drogue Chute', 'S', 0.3, 0.3, 50, 120, 900, 'Opens at very high speed to slow you down first.');
chute('ch_big', 'Big Cloud Chute', 'L', 0.6, 0.8, 300, 2600, 2800, 'A giant parachute for heavy capsules.', 'space');

// ---- landing legs. They hold the rocket up. G folds them away.
function leg(id, name, h, rr, drop, mass, price, tol, desc, req) {
  add(id, { name, cat: 'leg', shape: 'leg', h, r: 0.08, rr, drop, mass, radial: true, radialOnly: true, top: false, bottom: false, side: false, price, req: req || null, cdTop: 0.2, tol, col: 0xdfe4ee, acc: 0xffc83a, desc });
}
leg('lg_a', 'Little Legs', 0.9, 0.7, 1.5, 30, 900, 12, 'Short legs for small rockets. Use three or four.');
leg('lg_b', 'Landing Legs', 1.3, 1.0, 2.1, 90, 2000, 14, 'Strong legs for a medium rocket.');
leg('lg_c', 'Heavy Landers', 1.9, 1.6, 3.2, 260, 5500, 16, 'Big legs for a big lander.', 'orbit');

// ---- spin wheels add turning power
function wheel(id, name, size, h, mass, torque, price, req, desc) {
  const D = SIZE_D[size];
  add(id, { name, cat: 'wheel', shape: 'wheel', size, h, r: D / 2, mass, torque, price, req, cdTop: 0.8, tol: 8, col: 0xb8c0d4, acc: 0xa77bff, desc });
}
wheel('rw_s', 'Spin Wheel', 'S', 0.35, 100, 15000, 1200, null, 'A flywheel that helps turn the rocket.');
wheel('rw_l', 'Spin Wheel L', 'L', 0.5, 450, 70000, 4500, 'space', 'Big wheel for big rockets.');
wheel('rw_x', 'Spin Wheel XL', 'X', 0.7, 1600, 250000, 14000, 'orbit', 'Giant wheel. Turns anything.');

// ---- extras
add('mi_flag', { name: 'Pennant', cat: 'misc', shape: 'flag', h: 0.7, r: 0.04, mass: 1, bottom: true, top: false, radial: true, side: false, price: 100, cdTop: 0.2, tol: 99, col: 0xff5fa8, desc: 'A little flag for the top of your rocket. Weighs nothing. Looks great.' });

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
  ['liftoff', 'First liftoff', 'Rise 10 m off the pad.', 300],
  ['stage', 'Stage separation', 'Press space to drop a spent stage.', 300],
  ['k1', 'One kilometre up', 'Reach 1,000 m.', 700],
  ['fast', 'Faster than sound', 'Fly faster than 340 m/s.', 1000],
  ['k10', 'Ten kilometres up', 'Reach 10,000 m.', 1500],
  ['landed', 'Safe landing', 'Land softly after a flight that went above 500 m.', 1500],
  ['pin', 'Pinpoint landing', 'Land within 2 km of the launch pad after a flight above 5 km.', 1500],
  ['space', 'Reach space', 'Get above the sky: 60,000 m.', 6000],
  ['orbit', 'Reach orbit', 'Get an orbit that stays above the sky (Pe above 60 km).', 20000],
  ['orbitHome', 'Orbit and back down', 'Land safely after reaching orbit.', 15000],
  ['moonSoi', 'Reach Bean', 'Fly into the moon Bean\'s pull.', 25000],
  ['moonOrbit', 'Orbit Bean', 'Circle the moon Bean.', 30000],
  ['moonLand', 'Land on Bean', 'Touch down on Bean.', 50000],
  ['moonHome', 'Home from Bean', 'Land safely back on Cobble after visiting Bean.', 80000],
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
    name: 'Orbit Pioneer', blurb: 'Two stages built to reach orbit. Needs the Swish engine and Barrel tank from the shop.',
    parts: [
      { t: 'pod_pip', p: -1 }, { t: 'ch_cloud', p: 0, n: 't' }, { t: 'tk_s1', p: 0, n: 'b' }, { t: 'en_hum', p: 2, n: 'b' }, { t: 'dc_s', p: 3, n: 'b' },
      { t: 'tk_s4', p: 4, n: 'b' }, { t: 'tk_s4', p: 5, n: 'b' }, { t: 'en_swish', p: 6, n: 'b' },
      { t: 'fn_b', p: 6, n: 's', s: 'bot', a: 0, g: 1 }, { t: 'fn_b', p: 6, n: 's', s: 'bot', a: 90, g: 1 }, { t: 'fn_b', p: 6, n: 's', s: 'bot', a: 180, g: 1 }, { t: 'fn_b', p: 6, n: 's', s: 'bot', a: 270, g: 1 },
    ],
  },
];
