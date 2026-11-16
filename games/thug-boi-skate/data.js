// Everything you can buy: board parts, skaters, trick packs. Plus how parts change the skating.

// ---------------- board parts (4 levels each: level 0 is free)
export const PRICES = [0, 150, 400, 900];
export const PARTS = [
  { id: 'wheels', name: 'Wheels', desc: 'Faster top speed and quicker pushing.',
    levels: ['Stock Wheels', 'Soft Cruisers', 'Street Wheels', 'Rocket Wheels'], effect: ['', '+12% speed', '+24% speed', '+36% speed'] },
  { id: 'bearings', name: 'Bearings', desc: 'You roll for longer and grinds last longer.',
    levels: ['Stock Bearings', 'Smooth Bearings', 'Ceramic Bearings', 'Magnetic Bearings'], effect: ['', 'rolls longer', 'rolls even longer', 'barely slows down'] },
  { id: 'trucks', name: 'Trucks', desc: 'Better control: tighter turns and less sliding.',
    levels: ['Stock Trucks', 'Loose Trucks', 'Pro Trucks', 'Gold Trucks'], effect: ['', 'better turning', 'great turning', 'laser turning'] },
  { id: 'deck', name: 'Deck', desc: 'Higher ollies and faster flips.',
    levels: ['Stock Deck', 'Maple Deck', 'Pro Deck', 'Carbon Deck'], effect: ['', 'higher pop', 'higher + faster flips', 'sky pop'] },
  { id: 'grip', name: 'Grip Tape', desc: 'Sticky landings: you can land a bit crooked and still stay on.',
    levels: ['Stock Grip', 'Sticky Grip', 'Super Grip', 'Glue Grip'], effect: ['', 'forgiving', 'very forgiving', 'super forgiving'] },
];

// turns the levels you bought into numbers the skater uses
// SAFETY ITEMS: one-time buys that make you bail less (shop tab ITEMS)
export const ITEMS = [
  { id: 'wrist', name: 'Wrist Guards', price: 200, desc: 'Crooked landings are forgiven more (+15% yaw).', yaw: 1.15 },
  { id: 'knee', name: 'Knee Pads', price: 300, desc: 'Land flips and shove-its a bit off and still stick it (+15%).', flip: 1.15 },
  { id: 'insoles', name: 'Sticky Insoles', price: 500, desc: 'Both landing checks get easier (+10% each).', yaw: 1.1, flip: 1.1 },
  { id: 'cushion', name: 'Air Cushion', price: 600, desc: 'Big drops hurt less: the "Too high!" limit goes way up.', impact: 12 },
  { id: 'horseshoe', name: 'Lucky Horseshoe', price: 800, desc: 'A bad landing is SAVED once per run (no bail).', saves: 1 },
  { id: 'gopro', name: 'Action Cam', price: 1500, desc: 'You are filming everything: +50% coins from every run. You hold it in your hand (buy the Camera Helmet to clip it on your head!).', coinBonus: 0.5 },
  { id: 'gopro2', name: 'Action Cam + Drone Cam', price: 4000, desc: 'Epic angles go viral: another +100% coins (with the Action Cam that is x2.5!).', coinBonus: 1.0 },
  { id: 'camhelmet', name: 'Camera Helmet', price: 600, desc: 'A tough helmet with a camera mount: your Action Cam clips on it so your hands are free. Crooked landings forgiven more (+10% yaw).', yaw: 1.1 },
  { id: 'angel', name: 'Guardian Angel', price: 1800, desc: '2 MORE saves every run (stacks with the horseshoe).', saves: 2 },
];

// ---------------- BOARDS you buy in the shop (each one has its own look + a perk; perks multiply with the skater's perk)
export const BOARDS = [
  { id: 'classic', name: 'Your Own Board', price: 0, perkText: 'The board that comes with your skater. No perk.', deck: null },
  { id: 'ocean', name: 'Ocean Wave', price: 700, perkText: '+12% control', perk: { control: 1.12 }, deck: 0x1f7ae0, stripe: 0x9be8ff, wheel: 0xffffff, art: 'waves' },
  { id: 'grape', name: 'Sticky Grape', price: 800, perkText: '+20% forgiving landings', perk: { forgive: 1.2 }, deck: 0x8a3ad8, stripe: 0xe8b0ff, wheel: 0xffffff, art: 'dots' },
  { id: 'banana', name: 'Bouncy Banana', price: 900, perkText: '+18% jump height', perk: { pop: 1.18 }, deck: 0xffe14d, stripe: 0x6b4a14, wheel: 0xffffff, art: 'dots' },
  { id: 'redhot', name: 'Red Hot', price: 1200, perkText: '+25% top speed!', perk: { speed: 1.25 }, deck: 0xd9261c, stripe: 0xffb020, wheel: 0xffd23f, art: 'flames' },
  { id: 'frost', name: 'Frostbite', price: 1600, perkText: '+12% speed, +12% control', perk: { speed: 1.12, control: 1.12 }, deck: 0x9fe8ff, stripe: 0xffffff, wheel: 0x3a7bd5, art: 'waves' },
  { id: 'blade', name: 'Shadow Blade', price: 2200, perkText: '+18% speed, +18% control', perk: { speed: 1.18, control: 1.18 }, deck: 0x1b1b24, stripe: 0xff3d6e, wheel: 0xff3d6e, art: 'bolts' },
  { id: 'gold', name: 'Golden Deluxe', price: 4000, perkText: '+12% to everything', perk: { speed: 1.12, control: 1.12, forgive: 1.12, pop: 1.12 }, deck: 0xffd34e, stripe: 0xffffff, wheel: 0xffffff, art: 'bolts' },
  { id: 'rainbow', name: 'Rainbow Rocket', price: 7000, perkText: '+40% speed, +10% control', perk: { speed: 1.4, control: 1.1 }, deck: 0xffffff, stripe: 0xff4d4d, wheel: 0xff8ad8, art: 'rainbow' },
  { id: 'hole', name: 'Black Hole', price: 12000, perkText: '+50% speed, +15% control, +10% forgiving', perk: { speed: 1.5, control: 1.15, forgive: 1.1 }, deck: 0x0a0a16, stripe: 0xa56cff, wheel: 0xa56cff, art: 'stars' },
];

// ---------------- STICKERS: open Sticker Boxes in the shop, stick up to 3 on your board
export const RARITY = {
  common: { name: 'Common', color: '#9fb4d6', w: 60 },
  rare: { name: 'Rare', color: '#4aa8f0', w: 28 },
  epic: { name: 'Epic', color: '#c06cff', w: 10 },
  legendary: { name: 'LEGENDARY', color: '#ffd34e', w: 2 },
};
export const STICKERS = [
  { id: 'flame', e: '🔥', name: 'Flame', r: 'common' }, { id: 'bolt', e: '⚡', name: 'Lightning', r: 'common' },
  { id: 'star', e: '⭐', name: 'Star', r: 'common' }, { id: 'heart', e: '❤️', name: 'Heart', r: 'common' },
  { id: 'cool', e: '😎', name: 'Too Cool', r: 'common' }, { id: 'pizza', e: '🍕', name: 'Pizza', r: 'common' },
  { id: 'cat', e: '🐱', name: 'Skate Cat', r: 'common' }, { id: 'ghost', e: '👻', name: 'Ghost', r: 'common' },
  { id: 'burger', e: '🍔', name: 'Burger', r: 'common' }, { id: 'frog', e: '🐸', name: 'Froggy', r: 'common' },
  { id: 'skull', e: '💀', name: 'Skull', r: 'rare' }, { id: 'rocket', e: '🚀', name: 'Rocket', r: 'rare' },
  { id: 'rainbow', e: '🌈', name: 'Rainbow', r: 'rare' }, { id: 'alien', e: '👽', name: 'Alien', r: 'rare' },
  { id: 'guitar', e: '🎸', name: 'Guitar', r: 'rare' }, { id: 'gem', e: '💎', name: 'Diamond', r: 'rare' },
  { id: 'dragon', e: '🐉', name: 'Dragon', r: 'epic' }, { id: 'unicorn', e: '🦄', name: 'Unicorn', r: 'epic' },
  { id: 'crown', e: '👑', name: 'Golden Crown', r: 'legendary' }, { id: 'trophy', e: '🏆', name: 'Champion', r: 'legendary' },
];
export const STICKER_BOX_PRICE = 250;
export const STICKER_SLOTS = 3;     // (old slot system, no longer used)
export const STICKER_MAX = 8;       // most stickers you can stick on one board
export function rollSticker(rnd = Math.random) {
  const total = Object.values(RARITY).reduce((a, r) => a + r.w, 0);
  let x = rnd() * total, rar = 'common';
  for (const [k, r] of Object.entries(RARITY)) { if (x < r.w) { rar = k; break; } x -= r.w; }
  const pool = STICKERS.filter((s) => s.r === rar);
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

// how many times more coins a run pays (Action Cam items)
export function coinMult(items = []) {
  let m = 1;
  for (const it of ITEMS) if (items.includes(it.id)) m += it.coinBonus || 0;
  return m;
}

export function mergePerks(a = {}, b = {}) {
  const o = {};
  for (const k of ['speed', 'control', 'forgive', 'pop']) o[k] = (a[k] || 1) * (b[k] || 1);
  return o;
}

export function computeStats(parts, perk = {}, items = []) {
  const w = parts.wheels || 0, b = parts.bearings || 0, t = parts.trucks || 0, d = parts.deck || 0, g = parts.grip || 0;
  const sp = perk.speed || 1, ct = perk.control || 1, pp = perk.pop || 1;
  let iy = 1, iflip = 1, impact = 24, saves = 0;
  for (const it of ITEMS) if (items.includes(it.id)) { iy *= it.yaw || 1; iflip *= it.flip || 1; impact += it.impact || 0; saves += it.saves || 0; }
  const fg = (perk.forgive || 1);
  return {
    pushMax: (16 + 1.5 * w) * sp,
    pushAcc: (13 + 1.6 * w) * sp,
    rollDrag: 0.30 - 0.08 * b,
    grindDecay: 0.7 - 0.17 * b,
    turn: (1 + 0.17 * t) * ct,
    grip: (7 + 2 * t) * ct,
    pop: (6.4 + 0.6 * d) * pp,
    flipTime: 0.5 - 0.05 * d,
    yawTol: (0.8 + 0.2 * g) * fg * iy,
    flipTol: (1.1 + 0.2 * g) * fg * iflip,
    impactMax: impact,
    saves,
  };
}

// ---------------- skaters
export const CHARS = [
  { id: 'rookie', name: 'Rookie', price: 0, perkText: 'No perk. A solid start.',
    cfg: { skin: 0xe9b88e, shirt: 0x1fb6a8, shirt2: 0xffffff, pants: 0x2c3e70, shoe: 0xf4f4f4, hat: 'cap', hatColor: 0xffcf3f, hair: 0x5a3a22, deck: 0xff7a2f, wheel: 0xf2f2f2 } },
  { id: 'blaze', name: 'Blaze', price: 250, perkText: '+6% top speed', perk: { speed: 1.06 },
    cfg: { skin: 0xd99a6c, shirt: 0xd9433b, shirt2: 0xffc933, pants: 0x25262e, shoe: 0xffc933, hat: 'beanie', hatColor: 0xd9433b, hair: 0x2a1a10, deck: 0xd9433b, wheel: 0xffc933 } },
  { id: 'frost', name: 'Frost', price: 400, perkText: '+10% control', perk: { control: 1.1 },
    cfg: { skin: 0xf2d2b6, shirt: 0xcfe8ff, shirt2: 0x4a8fd6, pants: 0x6b7587, shoe: 0xffffff, hat: 'beanie', hatColor: 0x4a8fd6, hair: 0xd8d8d8, deck: 0x4a8fd6, wheel: 0xffffff } },
  { id: 'ninja', name: 'Ninja', price: 600, perkText: '+12% forgiving landings', perk: { forgive: 1.12 },
    cfg: { skin: 0xe2b48c, shirt: 0x22232b, shirt2: 0xd9433b, pants: 0x22232b, shoe: 0x22232b, hat: 'headband', hatColor: 0xd9433b, hair: 0x111111, deck: 0x22232b, wheel: 0xd9433b } },
  { id: 'astro', name: 'Astro', price: 900, perkText: '+8% jump height', perk: { pop: 1.08 },
    cfg: { skin: 0xe9b88e, shirt: 0xf4f4f4, shirt2: 0xff7a2f, pants: 0xe6e6e6, shoe: 0xff7a2f, hat: 'helmet', hatColor: 0xf4f4f4, visor: 0xffb340, hair: 0x5a3a22, deck: 0xf4f4f4, wheel: 0xff7a2f } },
  { id: 'robo', name: 'Robo', price: 1300, perkText: '+4% speed, +6% control', perk: { speed: 1.04, control: 1.06 },
    cfg: { skin: 0xaab4c0, shirt: 0x6f7b88, shirt2: 0x35e0ff, pants: 0x4a5360, shoe: 0x35e0ff, hat: 'robot', hatColor: 0x35e0ff, hair: 0x333333, deck: 0x6f7b88, wheel: 0x35e0ff } },
  { id: 'tiger', name: 'Tiger', price: 1800, perkText: '+8% control, +8% forgiving', perk: { control: 1.08, forgive: 1.08 },
    cfg: { skin: 0xf08a24, shirt: 0xf08a24, shirt2: 0x2a1a10, pants: 0x2a1a10, shoe: 0xffffff, hat: 'ears', hatColor: 0xf08a24, hair: 0x2a1a10, deck: 0xf08a24, wheel: 0x2a1a10 } },
  { id: 'royal', name: 'Royal', price: 3000, perkText: '+5% to everything', perk: { speed: 1.05, control: 1.05, forgive: 1.05, pop: 1.05 },
    cfg: { skin: 0xe9b88e, shirt: 0x7a2bd1, shirt2: 0xffd34e, pants: 0x4a1a8a, shoe: 0xffd34e, hat: 'crown', hatColor: 0xffd34e, hair: 0x3a2412, deck: 0xffd34e, wheel: 0x7a2bd1 } },
  // two girl skaters (for the nieces!): pigtails + a big bow, bright quirky outfits
  { id: 'pixie', name: 'Pixie Pop', price: 450, perkText: '+10% control, +5% jump height', perk: { control: 1.1, pop: 1.05 },
    cfg: { skin: 0xf2c9a8, shirt: 0xff6fb5, shirt2: 0xffe14d, pants: 0x7a4de0, shoe: 0xffffff, hat: 'pigtails', hatColor: 0xffe14d, hair: 0xff9a3d, deck: 0xff6fb5, wheel: 0xffe14d, longHair: true } },
  { id: 'zoe', name: 'Zany Zoe', price: 700, perkText: '+12% forgiving landings, +4% speed', perk: { forgive: 1.12, speed: 1.04 },
    cfg: { skin: 0xe9b88e, shirt: 0x35e0b0, shirt2: 0xff3d6e, pants: 0xffd23f, shoe: 0xff3d6e, hat: 'bow', hatColor: 0xff3d6e, hair: 0x3a1a6e, deck: 0x35e0b0, wheel: 0xff3d6e, longHair: true } },
  { id: 'monkey', name: 'Monkey Max', price: 1500, perkText: '+25% jump height. With the Bouncy Banana board: 150% speed!', perk: { pop: 1.25 }, combo: { board: 'banana', perk: { speed: 1.5 }, text: 'MONKEY + BANANA COMBO: 150% speed!' },
    cfg: { skin: 0x8a5a2b, shirt: 0xd9433b, shirt2: 0xffe14d, pants: 0x3a5a8a, shoe: 0x3a2a1a, hat: 'monkey', hatColor: 0xe8c39a, hair: 0x5a3a1a, deck: 0xffe14d, wheel: 0xffffff, tail: true } },
  { id: 'onesie', name: 'Onesie Ollie', price: 700, perkText: '+10% jump height, +4% speed (just a monkey costume: Monkey Max is way better!)', perk: { pop: 1.1, speed: 1.04 },
    cfg: { skin: 0xf0c8a0, shirt: 0x8a5a2b, shirt2: 0xe8c39a, pants: 0x8a5a2b, shoe: 0x5a3a1a, hat: 'monkeyhood', hatColor: 0x8a5a2b, hair: 0x5a3a1a, deck: 0x8a5a2b, wheel: 0xe8c39a, tail: true, tailColor: 0x7a4a24 } },
  { id: 'unicorn', name: 'Mythic Unicorn', price: 8000, perkText: 'MYTHICAL: twice as fast (+100% speed)!', perk: { speed: 2.0 },
    cfg: { skin: 0xf6d2bc, shirt: 0xfff4ff, shirt2: 0xff8ad8, pants: 0xf3e6ff, shoe: 0xffd34e, hat: 'unicorn', hatColor: 0xfff4ff, hair: 0xffffff, deck: 0xffffff, wheel: 0xff8ad8, rainbow: true } },
];

// ---------------- parks
export const PARKS = [
  // (tag = the short "special" line shown on the main menu)
  { id: 'plaza', tag: 'SPECIAL: BOUNCE PADS', name: 'Sunny Plaza', price: 0, desc: 'Where it all started, plus two GIANT bowls and a mega roller out east. Bounce pads on the floor!' },
  { id: 'desert', tag: 'SPECIAL: SAND TRAPS (JUMP THEM!)', name: 'Desert Canyon', price: 400, desc: 'A huge sandy pit, a canyon halfpipe and a 7.5 m mega ramp. Sand traps slow you down: jump them!' },
  { id: 'snow', tag: 'SPECIAL: SNOWBOARD + SLIPPERY ICE', name: 'Snow Peak', price: 900, desc: 'You ride a SNOWBOARD here! Two ice bowls, vert walls, a 9 m ski-jump and slippery ICE patches to jump over.' },
  { id: 'candy', tag: 'SPECIAL: STICKY GOO + GUMMY BOUNCE', name: 'Candy Land', price: 1200, desc: 'Lots of small ramps and mini bowls. Sticky goo slows you down and gummy bounce pads send you flying.' },
  { id: 'volcano', tag: 'SPECIAL: LAVA! DO NOT TOUCH!', name: 'Volcano Rim', price: 2200, desc: 'A huge crater bowl and big vert. LAVA pools on the floor: touch one and you bail, so jump over them!' },
  { id: 'moon', tag: 'SPECIAL: LOW GRAVITY ZONES', name: 'Moon Base', price: 3000, desc: 'Low-gravity zones over a giant crater: you float for ages. Speed strips too.' },
  { id: 'jungle', tag: 'SPECIAL: ACID PITS = -10,000 POINTS!', name: 'Monkey Jungle', price: 2600, desc: 'A steamy jungle made for monkeys: vine rails, log ramps, a stone temple and ACID PITS. Touch the acid and you lose 10,000 points!' },
  { id: 'neon', tag: 'SPECIAL: SPEED STRIPS + BOUNCE PADS', name: 'Neon Night', price: 1600, desc: 'A massive glowing bowl, side bowls, a double mega ramp and a neon halfpipe.' },
];

// ---------------- tricks you can buy
// "can" = names the skater checks. keys are shown in the trick book.
export const PACKS = [
  { id: 'multi', name: 'Double Flips', price: 200, can: ['multi'], desc: 'Tap a flip again for a Double or Triple. Tap shove-it twice for a 360 Shove-it.',
    tricks: [['Double / Triple Kickflip', 'tap Up or I again'], ['Double / Triple Heelflip', 'tap Down or K again'], ['360 Shove-it', 'tap Left or J twice']] },
  { id: 'impossible', name: 'Impossible', price: 300, can: ['impossible'], desc: 'The board wraps around your feet.',
    tricks: [['Impossible', 'M in the air']] },
  { id: 'varial', name: 'Combo Flips', price: 350, can: ['varial'], desc: 'Mix a flip with a shove-it and the game gives you a named trick with bonus points.',
    tricks: [['Varial Kickflip', 'Kickflip + Shove-it'], ['Varial Heelflip', 'Heelflip + Shove-it'], ['Tre Flip', 'Kickflip + 360 Shove-it'], ['Laser Flip', 'Heelflip + 360 Shove-it']] },
  { id: 'grabs1', name: 'Grabs I', price: 250, can: ['method', 'melon'], desc: 'Two more grabs. Hold the key to keep earning.',
    tricks: [['Method', 'O (hold)'], ['Melon', 'U (hold)']] },
  { id: 'grabs2', name: 'Grabs II', price: 450, can: ['stale', 'nose', 'tail'], desc: 'Three more grabs.',
    tricks: [['Stalefish', 'Y (hold)'], ['Nose Grab', 'T (hold)'], ['Tail Grab', 'G (hold)']] },
  { id: 'airs', name: 'Big Airs', price: 600, can: ['superman', 'christ'], desc: 'Show-off poses. Big points, hold them!',
    tricks: [['Superman', 'B (hold)'], ['Christ Air', 'N (hold)']] },
  { id: 'body', name: 'Front Flips', price: 800, can: ['front', 'back'], desc: 'Frontflip with W, and Backflip on S too. (F backflip is already free.) Land it before the ground!',
    tricks: [['Frontflip', 'W in the air'], ['Backflip (also S)', 'F in the air (free!)']] },
  { id: 'grinds', name: 'Grind Pack', price: 500, can: ['grindtricks'], desc: 'Switch your grind while you are on a rail. Each one is a new trick in the combo.',
    tricks: [['Smith Grind', 'Up / I while grinding'], ['Feeble Grind', 'Down / K while grinding'], ['Crooked Grind', 'Left / J while grinding'], ['Tailslide', 'Right / L while grinding'], ['Lipslide', 'O while grinding']] },
  { id: 'manual2', name: 'Nose Manual', price: 150, can: ['nosemanual'], desc: 'Roll on your front wheels.',
    tricks: [['Nose Manual', 'Z (hold, on the ground)']] },
];

export const FREE_TRICKS = [
  ['Kickflip', 'Up / I'], ['Heelflip', 'Down / K'], ['Shove-it', 'Left / J'], ['Indy Grab', 'L (hold)'], ['Backflip', 'F in the air'],
  ['Spins 180 - 1440', 'A / D in the air'], ['50-50, Boardslide, Nosegrind', 'Shift near a rail'], ['Manual', 'Q (hold)'],
];
