// data.js - EVERY number and list the game uses lives here, so you can change the game without touching the code.
//   * To ADD A NEW FISH: copy one block in FISH below, give it a new id and name, and change the numbers. That's it!
//   * To change shop prices or what gear does: edit GEAR further down.
//   * To change how scary the sharks are: edit SHARKS.
// Distances are in metres, speeds in metres per second, air in "air units" (a basic tank holds 100).

// ------------------------------------------------------------------------------------------------ rarities
export const RARITY = {
  common:    { name: 'Common',    color: '#d5e2e8', order: 0 },
  uncommon:  { name: 'Uncommon',  color: '#6aff9a', order: 1 },
  rare:      { name: 'Rare',      color: '#5cc8ff', order: 2 },
  epic:      { name: 'Epic',      color: '#c77dff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffd34e', order: 4 },
};

// ------------------------------------------------------------------------------------------------ depth zones
// top/bottom = depth range in metres. needSuit / needLight = the gear level you need to survive there (see GEAR below).
export const ZONES = [
  { id: 0, name: 'Sunlit Reef',   top: 0,   bottom: 40,  needSuit: 0, needLight: 0, sharks: 3, sharkKind: [0],       blurb: 'Warm, bright and full of colourful fish. A good place to start.' },
  { id: 1, name: 'Twilight Zone', top: 40,  bottom: 110, needSuit: 1, needLight: 0, sharks: 6, sharkKind: [0, 1],    blurb: 'The light fades to blue. Rarer fish, and more sharks.' },
  { id: 2, name: 'Midnight Zone', top: 110, bottom: 200, needSuit: 2, needLight: 1, sharks: 7, sharkKind: [1, 2],    blurb: 'Freezing and very dark. Glowing fish. You need a flashlight!' },
  { id: 3, name: 'The Abyss',     top: 200, bottom: 340, needSuit: 3, needLight: 2, sharks: 7, sharkKind: [2, 3],    blurb: 'The deepest place in the ocean. Legendary fish live here.' },
];
export const zoneAt = depth => (depth < 40 ? ZONES[0] : depth < 110 ? ZONES[1] : depth < 200 ? ZONES[2] : ZONES[3]);

// ------------------------------------------------------------------------------------------------ the fish
// id        : a short unique name (no spaces)           name   : what the player sees
// rarity    : common | uncommon | rare | epic | legendary
// zone      : 0 Sunlit Reef, 1 Twilight, 2 Midnight, 3 Abyss
// value     : coins you get when you sell it             size   : length in metres
// speed     : how fast it swims normally (m/s). Fleeing is faster.
// school    : [fewest, most] fish that swim together      schools: how many groups live in the ocean
// ease      : 0..1 how easy it is to catch with the NET (1 = easy). Spears always hit.
// alert     : how close (m) you can get before it gets scared
// needSpear : (optional) the spear gun level needed to catch it (the biggest fish are too strong for a net)
// shape     : which 3D model to use (fish | puffer | ray | jelly | angler | eel | squid). look = its colours and proportions (see fishmodels.js)
export const FISH = [
  // ---------------------------------------------------------------- Sunlit Reef
  { id: 'sunny_damsel', name: 'Sunny Damsel', rarity: 'common', zone: 0, value: 8, size: 0.28, speed: 1.4, school: [9, 14], schools: 3, ease: 0.95, alert: 3,
    shape: 'fish', look: { body: 0xffd23c, belly: 0xfff3b0, fin: 0xffa31a, h: 0.42, w: 0.2 }, blurb: 'A cheerful little yellow fish that swims in big happy groups.' },
  { id: 'clownfish', name: 'Clownfish', rarity: 'common', zone: 0, value: 10, size: 0.3, speed: 1.3, school: [3, 6], schools: 3, ease: 0.9, alert: 3,
    shape: 'fish', look: { body: 0xff7a1a, belly: 0xff9a4a, fin: 0xff7a1a, h: 0.44, w: 0.24, tail: 'fan', stripe: 0xffffff, bands: [[0.14, 0.23], [-0.2, -0.12]] }, blurb: 'Orange with white stripes. Loves to hide near the coral.' },
  { id: 'blue_tang', name: 'Blue Tang', rarity: 'common', zone: 0, value: 12, size: 0.34, speed: 1.6, school: [4, 8], schools: 3, ease: 0.88, alert: 3.5,
    shape: 'fish', look: { body: 0x2f6bff, belly: 0x5a8dff, fin: 0x1a3fd0, tailc: 0xffe14a, h: 0.52, w: 0.18, eyeBand: 0x111133 }, blurb: 'A bright blue fish with a sunny yellow tail.' },
  { id: 'lemon_butterfly', name: 'Lemon Butterflyfish', rarity: 'common', zone: 0, value: 16, size: 0.3, speed: 1.4, school: [2, 4], schools: 3, ease: 0.85, alert: 3.5,
    shape: 'fish', look: { body: 0xfff25a, belly: 0xffffff, fin: 0xfff25a, h: 0.72, w: 0.14, stripe: 0x222233, bands: [[0.2, 0.28]], tail: 'fan' }, blurb: 'Flat as a pancake, yellow as a lemon.' },
  { id: 'zebra_angel', name: 'Zebra Angelfish', rarity: 'uncommon', zone: 0, value: 28, size: 0.46, speed: 1.5, school: [1, 3], schools: 3, ease: 0.8, alert: 4,
    shape: 'fish', look: { body: 0xf4f4f4, belly: 0xffffff, fin: 0x2a2a38, h: 0.95, w: 0.12, stripe: 0x1a1a22, bands: [[0.22, 0.3], [0.04, 0.1], [-0.14, -0.08], [-0.3, -0.24]], dorsal: 0.55, anal: 0.5, tail: 'fan' }, blurb: 'Tall and striped, like a zebra that learned to swim.' },
  { id: 'bubble_puffer', name: 'Bubble Puffer', rarity: 'uncommon', zone: 0, value: 34, size: 0.42, speed: 1.0, school: [1, 2], schools: 3, ease: 0.85, alert: 3.5,
    shape: 'puffer', look: { body: 0xe0c070, belly: 0xfff2c0, spot: 0x6a4a1a }, blurb: 'Round, spiky and a little bit grumpy.' },
  { id: 'rainbow_parrot', name: 'Rainbow Parrotfish', rarity: 'rare', zone: 0, value: 60, size: 0.72, speed: 2.0, school: [2, 3], schools: 3, ease: 0.6, alert: 6,
    shape: 'fish', look: { body: 0x3adfc0, belly: 0xffc0e8, fin: 0xff6ac0, h: 0.46, w: 0.26, rainbow: true, tail: 'lunate' }, blurb: 'Every colour of the rainbow, and a beak for munching coral.' },
  // ---------------------------------------------------------------- Twilight Zone
  { id: 'silver_sardine', name: 'Silver Sardine', rarity: 'common', zone: 1, value: 14, size: 0.26, speed: 2.6, school: [14, 22], schools: 2, ease: 0.8, alert: 4,
    shape: 'fish', look: { body: 0xcfe3f2, belly: 0xffffff, fin: 0x8aa6bd, h: 0.3, w: 0.16 }, blurb: 'Shiny silver. They zoom around in giant swirling clouds.' },
  { id: 'spotted_grouper', name: 'Spotted Grouper', rarity: 'uncommon', zone: 1, value: 45, size: 0.95, speed: 1.2, school: [1, 2], schools: 3, ease: 0.7, alert: 5,
    shape: 'fish', look: { body: 0x8a5a3a, belly: 0xd8b08a, fin: 0x6a3f24, h: 0.5, w: 0.4, spots: { n: 22, color: 0xe8c89a }, tail: 'fan' }, blurb: 'Big, slow and spotty, with a very wide mouth.' },
  { id: 'moonfish', name: 'Mandarin Moonfish', rarity: 'uncommon', zone: 1, value: 52, size: 0.62, speed: 1.6, school: [2, 3], schools: 3, ease: 0.7, alert: 5,
    shape: 'fish', look: { body: 0xffb23a, belly: 0xfff0b0, fin: 0xff6a2a, h: 1.0, w: 0.16, dorsal: 0.5, anal: 0.5, tail: 'fan', stripe: 0xff7a1a, bands: [[0.1, 0.18], [-0.12, -0.04]] }, blurb: 'Round like a golden moon.' },
  { id: 'moon_jelly', name: 'Moon Jelly', rarity: 'uncommon', zone: 1, value: 40, size: 0.7, speed: 0.7, school: [3, 6], schools: 2, ease: 0.85, alert: 2,
    shape: 'jelly', look: { body: 0xd8b8ff, belly: 0xffd0f0, alpha: 0.72, glow: 0.15 }, blurb: 'A soft purple jelly that pulses as it drifts. Harmless!' },
  { id: 'torpedo_tuna', name: 'Torpedo Tuna', rarity: 'rare', zone: 1, value: 100, size: 1.5, speed: 4.2, school: [2, 4], schools: 2, ease: 0.38, alert: 9,
    shape: 'fish', look: { body: 0x2a4a7a, belly: 0xe8f0f8, fin: 0xffd23a, h: 0.3, w: 0.26, tail: 'lunate', finlets: 0xffd23a }, blurb: 'Built like a rocket. Very, very fast.' },
  { id: 'gentle_manta', name: 'Gentle Manta', rarity: 'rare', zone: 1, value: 140, size: 2.4, speed: 2.0, school: [1, 2], schools: 2, ease: 0.55, alert: 7,
    shape: 'ray', look: { body: 0x2a3a5a, belly: 0xf4f8ff, spot: 0xffffff }, blurb: 'A huge, calm ray that flaps like a bird underwater.' },
  { id: 'sail_marlin', name: 'Sail Marlin', rarity: 'epic', zone: 1, value: 260, size: 2.4, speed: 5.0, school: [1, 1], schools: 2, ease: 0.25, alert: 11,
    shape: 'fish', look: { body: 0x2456c8, belly: 0xe8f0ff, fin: 0x2456c8, h: 0.24, w: 0.2, tail: 'lunate', dorsal: 0.4, bill: true, sail: true, stripe: 0x6ab4ff, bands: [[0.15, 0.2], [0.02, 0.07], [-0.12, -0.07]] }, blurb: 'The fastest fish around, with a giant sail on its back.' },
  // ---------------------------------------------------------------- Midnight Zone (glowing!)
  { id: 'lanternfish', name: 'Glow Lanternfish', rarity: 'uncommon', zone: 2, value: 75, size: 0.3, speed: 1.8, school: [8, 14], schools: 2, ease: 0.8, alert: 4,
    shape: 'fish', look: { body: 0x1a2a4a, belly: 0x2a4a7a, fin: 0x1a2a4a, h: 0.4, w: 0.2, photophores: { n: 9, color: 0x55f0ff } }, blurb: 'Tiny lights along its tummy twinkle like stars.' },
  { id: 'lamp_angler', name: 'Lamp Angler', rarity: 'rare', zone: 2, value: 170, size: 1.1, speed: 1.0, school: [1, 1], schools: 3, ease: 0.55, alert: 5,
    shape: 'angler', look: { body: 0x3a2a3a, belly: 0x5a4a5a, lure: 0xfff08a }, blurb: 'It dangles its own lantern to tempt snacks closer.' },
  { id: 'neon_eel', name: 'Neon Eel', rarity: 'rare', zone: 2, value: 190, size: 2.2, speed: 2.0, school: [1, 2], schools: 3, ease: 0.45, alert: 6,
    shape: 'eel', look: { body: 0x201a40, band: 0xff3ad0, h: 0.06, n: 16 }, blurb: 'A long, slinky eel with glowing pink stripes.' },
  { id: 'glow_jelly', name: 'Glow Jelly', rarity: 'epic', zone: 2, value: 280, size: 1.2, speed: 0.8, school: [2, 4], schools: 2, ease: 0.7, alert: 3,
    shape: 'jelly', look: { body: 0x40e8ff, belly: 0x9affff, alpha: 0.8, glow: 0.9 }, blurb: 'A jelly that shines bright cyan. Beautiful!' },
  { id: 'silver_oarfish', name: 'Silver Oarfish', rarity: 'epic', zone: 2, value: 340, size: 3.6, speed: 1.8, school: [1, 1], schools: 2, ease: 0.4, alert: 7,
    shape: 'eel', look: { body: 0xdfe8f2, band: 0xdfe8f2, h: 0.09, n: 18, flat: true, crest: 0xff3a4a }, blurb: 'A shiny ribbon of a fish with a red crown.' },
  // ---------------------------------------------------------------- The Abyss (legendary!)
  { id: 'dragon_viper', name: 'Dragon Viperfish', rarity: 'epic', zone: 3, value: 420, size: 1.0, speed: 2.6, school: [1, 2], schools: 3, ease: 0.4, alert: 7,
    shape: 'fish', look: { body: 0x141a30, belly: 0x2a3a5a, fin: 0x141a30, h: 0.3, w: 0.26, fangs: true, photophores: { n: 8, color: 0x6aff9a }, tail: 'fan', dorsal: 0.5 }, blurb: 'All teeth and glowing dots. Not as scary as it looks!' },
  { id: 'phantom_squid', name: 'Phantom Squid', rarity: 'legendary', zone: 3, value: 900, size: 3.0, speed: 2.8, school: [1, 1], schools: 2, ease: 0.3, alert: 9, needSpear: 3,
    shape: 'squid', look: { body: 0xcfd8ff, belly: 0xeef0ff, glowC: 0x8ab4ff, glow: 0.7 }, blurb: 'A ghostly squid that glows like a spirit.' },
  { id: 'rainbow_coelacanth', name: 'Rainbow Coelacanth', rarity: 'legendary', zone: 3, value: 1100, size: 1.9, speed: 1.4, school: [1, 1], schools: 2, ease: 0.35, alert: 7,
    shape: 'fish', look: { body: 0x4a7aff, belly: 0xc8a0ff, fin: 0x8affd0, h: 0.42, w: 0.34, rainbow: true, lobed: true, tail: 'fan', glow: 0.35 }, blurb: 'A living fossil that shimmers in every colour.' },
  { id: 'golden_leviathan', name: 'Golden Leviathan', rarity: 'legendary', zone: 3, value: 2500, size: 6.5, speed: 2.2, school: [1, 1], schools: 1, ease: 0.15, alert: 12, needSpear: 4,
    shape: 'fish', look: { body: 0xffc21a, belly: 0xfff0a0, fin: 0xff9a1a, h: 0.32, w: 0.3, tail: 'lunate', dorsal: 0.4, crown: true, glow: 0.4 }, blurb: 'A gigantic golden fish. Only the Legendary Harpoon can catch it.' },
  { id: 'titan_squid', name: 'Titan Squid', rarity: 'legendary', zone: 3, value: 3200, size: 9.0, speed: 2.0, school: [1, 1], schools: 1, ease: 0.1, alert: 14, needSpear: 4,
    shape: 'squid', look: { body: 0x8a2a5a, belly: 0xc86a9a, glowC: 0xff6ac0, glow: 0.6, titan: true }, blurb: 'The biggest creature in the Abyss. It needs the Legendary Harpoon.' },
];
export const fishById = id => FISH.find(f => f.id === id);

// ------------------------------------------------------------------------------------------------ sharks (they never get hurt: a spear only STUNS them)
// size: length (m) | patrol/chase: speeds (m/s) | bite: fraction of a full tank of air taken by one bite | sight: how far it can see you
export const SHARKS = [
  { id: 'reef',    name: 'Reef Shark',  size: 2.6, patrol: 2.0, chase: 5.2, bite: 0.20, sight: 24, look: { body: 0x7e95a6, belly: 0xeef3f6 } },
  { id: 'hammer',  name: 'Hammerhead',  size: 3.6, patrol: 2.3, chase: 6.2, bite: 0.26, sight: 28, look: { body: 0x6f7f8c, belly: 0xe8eef2, hammer: true } },
  { id: 'white',   name: 'Pale Shark',  size: 4.8, patrol: 2.6, chase: 7.2, bite: 0.32, sight: 26, look: { body: 0x8896a0, belly: 0xffffff } },
  { id: 'goblin',  name: 'Goblin Shark', size: 5.2, patrol: 2.8, chase: 8.0, bite: 0.38, sight: 34, look: { body: 0xd6a0b0, belly: 0xf8e4ea, goblin: true } },
];

// ------------------------------------------------------------------------------------------------ the shop
// Each item has `levels`. Level 0 is what you START with (it costs nothing). To buy level 2 you must own level 1.
// price = coins for that level. The other numbers are what the gear does (read by game.js).
export const GEAR = {
  flippers: { title: 'Flippers', icon: 'flippers', levels: [
    { name: 'Bare Feet', price: 0, speed: 1.0, text: 'No flippers yet. Swimming is slow.' },
    { name: 'Basic Flippers', price: 60, speed: 1.5, text: 'Swim 50% faster.' },
    { name: 'Pro Flippers', price: 220, speed: 1.85, text: 'Swim 85% faster.' },
    { name: 'Turbo Fins', price: 650, speed: 2.25, text: 'Swim more than twice as fast.' },
    { name: 'Jet Fins', price: 1600, speed: 2.7, text: 'The fastest fins in the sea. Outrun sharks!' },
  ] },
  suit: { title: 'Suit', icon: 'suit', levels: [
    { name: 'Swimsuit', price: 0, maxDepth: 45, bite: 0, text: 'Fine for the sunny reef only (down to 45 m).' },
    { name: 'Wetsuit', price: 150, maxDepth: 115, bite: 0.15, text: 'Warm enough for the Twilight Zone (to 115 m). Shark bites take 15% less air.' },
    { name: 'Thermal Suit', price: 700, maxDepth: 205, bite: 0.3, text: 'Survives the icy Midnight Zone (to 205 m). Shark bites take 30% less air.' },
    { name: 'Deep-Sea Armor Suit', price: 2400, maxDepth: 340, bite: 0.55, text: 'Hard armor that survives The Abyss. Shark bites take 55% less air.' },
  ] },
  tank: { title: 'Air Tank', icon: 'tank', levels: [
    { name: 'Small Tank', price: 0, air: 100, text: 'Holds 100 air. Not much!' },
    { name: 'Standard Tank', price: 90, air: 170, text: 'Holds 170 air.' },
    { name: 'Twin Tanks', price: 260, air: 260, text: 'Two tanks. Holds 260 air.' },
    { name: 'Pro Tanks', price: 800, air: 400, text: 'Holds 400 air.' },
    { name: 'Mega Tanks', price: 2200, air: 620, text: 'Holds 620 air. Long, deep dives.' },
  ] },
  net: { title: 'Net', icon: 'net', levels: [
    { name: 'Hand Net', price: 0, reach: 2.2, power: 1.0, text: 'A small net. Reach 2.2 m.' },
    { name: 'Wide Net', price: 70, reach: 3.0, power: 1.25, text: 'Reach 3 m and catches fish more easily.' },
    { name: 'Pro Net', price: 240, reach: 3.8, power: 1.55, text: 'Reach 3.8 m. Much easier catches.' },
    { name: 'Super Net', price: 700, reach: 4.8, power: 1.9, text: 'Reach 4.8 m. Even fast fish have a hard time.' },
  ] },
  light: { title: 'Flashlight', icon: 'light', levels: [
    { name: 'No Flashlight', price: 0, range: 0, angle: 0.4, power: 0, text: 'You can only see in the sunlight.' },
    { name: 'Pocket Torch', price: 120, range: 32, angle: 0.42, power: 2.6, text: 'Needed for the Midnight Zone. Press F to turn it on.' },
    { name: 'Dive Light', price: 450, range: 50, angle: 0.5, power: 3.4, text: 'A brighter, wider beam.' },
    { name: 'Beam Light', price: 1300, range: 72, angle: 0.58, power: 4.2, text: 'Needed for The Abyss. Shows far into the dark.' },
    { name: 'Deep Beam', price: 3200, range: 100, angle: 0.65, power: 5.2, text: 'The strongest light there is.' },
  ] },
  bag: { title: 'Fish Bag', icon: 'bag', levels: [
    { name: 'Small Bag', price: 0, cap: 5, text: 'Holds 5 fish per dive.' },
    { name: 'Net Bag', price: 60, cap: 10, text: 'Holds 10 fish per dive.' },
    { name: 'Dive Bag', price: 200, cap: 16, text: 'Holds 16 fish per dive.' },
    { name: 'Fish Cooler', price: 600, cap: 24, text: 'Holds 24 fish per dive.' },
    { name: 'Mini Aquarium', price: 1500, cap: 36, text: 'A tank on your back! Holds 36 fish per dive.' },
  ] },
  gun: { title: 'Spear Gun', icon: 'gun', levels: [
    { name: 'No Spear Gun', price: 0, range: 0, reload: 0, ammo: 0, stun: 0, text: 'Buy a spear gun to catch fish from far away.' },
    { name: 'Basic Spear Gun', price: 180, range: 14, reload: 2.4, ammo: 4, stun: 3, text: 'Short range, slow reload. Holds 4 spears.' },
    { name: 'Rubber-Band Pro', price: 650, range: 24, reload: 1.5, ammo: 6, stun: 4, text: 'Longer range, faster reload. Holds 6 spears.' },
    { name: 'Pneumatic Spear Gun', price: 1800, range: 36, reload: 1.0, ammo: 10, stun: 5, text: 'Long range. Holds 10 spears.' },
    { name: 'Legendary Harpoon', price: 5200, range: 52, reload: 0.7, ammo: 14, stun: 6.5, text: 'Very long range. The only way to catch the biggest Abyss fish!' },
  ] },
  quiver: { title: 'Spear Belt', icon: 'quiver', levels: [
    { name: 'No Belt', price: 0, extra: 0, text: 'Carry only what your gun holds.' },
    { name: 'Spear Belt', price: 100, extra: 4, text: 'Carry 4 extra spears each dive.' },
    { name: 'Spear Harness', price: 300, extra: 8, text: 'Carry 8 extra spears each dive.' },
    { name: 'Spear Backpack', price: 800, extra: 14, text: 'Carry 14 extra spears each dive.' },
  ] },
};
export const GEAR_ORDER = ['flippers', 'suit', 'tank', 'net', 'light', 'bag'];
export const SPEAR_ORDER = ['gun', 'quiver'];

// Things you buy again and again
export const CONSUMABLES = {
  spears: { title: 'Spear Pack', icon: 'spears', price: 30, give: 5, max: 60, text: '5 spears. You can only carry as many as your gun and belt hold on each dive.' },
  repel: { title: 'Shark Repellent', icon: 'repel', price: 60, give: 1, max: 5, text: 'One use. Press R to scare every shark nearby away for 20 seconds.' },
};

// ------------------------------------------------------------------------------------------------ other numbers
export const TUNE = {
  baseSpeed: 3.0,          // swimming speed with bare feet (m/s)
  airBase: 0.9,            // air used per second at the surface
  airPerMetre: 0.012,      // extra air per second for every metre of depth
  coldAirMul: 4.5,         // air drains this many times faster when your suit is too thin for the depth
  lowAir: 0.25,            // the meter flashes and beeps below this fraction of your tank
  worldSize: 480,          // the playable ocean is a square this wide (m)
  startCoins: 0,
};
