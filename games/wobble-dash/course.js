// WOBBLE DASH - the race courses. A course is built from segments (spinning bars, swinging hammers, sliding gates, gaps, belts...)
// laid out along one long lane. Every moving thing is a pure function of the race clock, so everybody sees the same course.
// Coordinates: the lane runs toward -z. u = distance from the start line, v = sideways (x).
import { THREE, V3, scene, toon, INK, QL, rng, clamp, lerp, TAU, W, burst, ring, blendSky, disposeObj } from './core.js?v=15';
import { world, sphereVsObb } from './physics.js?v=15';

export const TH = .9, LANE = 16;
export const THEMES = [
  { name: 'Candy Run', sky: [0x3a9bff, 0x9fdcff, 0xfff2dc], fog: [0xcfeaff, 90, 520], hemi: [0xd8eeff, 0x9ab0a0, 1.1], sun: [0xfff1d0, 2.3], pal: [0xff9ad0, 0x9ae6ff, 0xffe08a, 0xb6ffb0], sea: 0xff6ac8, foam: 0xffd0f0, deco: 'candy' },
  { name: 'Factory Frenzy', sky: [0x3a7aff, 0xa8d0ff, 0xffe8b8], fog: [0xe6ecff, 80, 480], hemi: [0xe8f0ff, 0xa0a080, 1.1], sun: [0xfff2d0, 2.3], pal: [0xff7a3a, 0xffd31a, 0x3a8aff, 0x4acf6a], sea: 0x6a7a9a, foam: 0xc8d0e8, deco: 'factory' },
  { name: 'Cloud Rush', sky: [0x2a3a9a, 0xff7a9a, 0xffd890], fog: [0xffc8a0, 90, 540], hemi: [0xffe0d0, 0x9a7aa0, 1.05], sun: [0xffd9a0, 2.3], stars: .25, pal: [0xffffff, 0xfff0b0, 0xffd6f0, 0xd6e8ff], sea: 0xb08aff, foam: 0xf0e0ff, deco: 'cloud' },
  { name: 'Spooky Manor', sky: [0x0c0630, 0x34186a, 0x9a4a8a], fog: [0x2a1650, 70, 420], hemi: [0x9a8aff, 0x2a1a3a, 1.0], sun: [0xc8b8ff, 1.7], sunStr: 0, stars: .95, pal: [0x8a5cff, 0xff8a1a, 0x4aff9a, 0xd8c8ff], sea: 0x1a0f3a, foam: 0x6a4aaa, deco: 'spooky' },
  { name: 'Frosty Slopes', sky: [0x4a8aff, 0xbfe4ff, 0xffffff], fog: [0xe4f2ff, 80, 450], hemi: [0xeaf4ff, 0xa8b8d0, 1.15], sun: [0xffffff, 2.2], pal: [0xbfeaff, 0xe6f6ff, 0x9ad0ff, 0xd8ccff], sea: 0x6ac0f8, foam: 0xffffff, deco: 'frost', ice: true },
  { name: 'Jungle Splash', sky: [0x2a8aff, 0x9ae8c0, 0xfff2b0], fog: [0xcff0d0, 80, 480], hemi: [0xe0ffe0, 0x5a7a40, 1.1], sun: [0xfff0b0, 2.3], pal: [0x4acf6a, 0xffc83a, 0xff7a4a, 0x2ab8a0], sea: 0x18a8a0, foam: 0xc8fff0, deco: 'jungle' },
  { name: 'Moon Base', sky: [0x03051a, 0x141446, 0x4a3a8a], fog: [0x1a1a40, 140, 760], hemi: [0xb0b8ff, 0x303050, .95], sun: [0xffffff, 2.4], sunStr: .3, stars: 1, pal: [0xd0d4e8, 0x6af0ff, 0xff6ad0, 0xffe86a], sea: 0x0a0a2a, foam: 0x3a3a8a, deco: 'space', noSea: true },
  { name: 'Lava Fortress', sky: [0x2a0a1a, 0xaa2a1a, 0xff9a3a], fog: [0x5a1a10, 80, 440], hemi: [0xffb090, 0x401008, 1.05], sun: [0xffa860, 2.2], sunStr: .6, pal: [0x7a6a7a, 0x5a4a5a, 0xff7a2a, 0x9a7a6a], sea: 0xff4a0a, foam: 0xffd060, seaGlow: 0xff3000, deco: 'lava' },
];
// tier: which Showdown round a course can show up in (1 = round 1, 2 = round 2, 3 = the final). grav: gravity multiplier for the whole course.
export const COURSES = [
  { id: 'candy', name: 'Candy Run', theme: 0, seed: 101, d: .25, tier: 1, blurb: 'Spinning bars, gaps and swinging hammers. A sweet warm-up!', recipe: ['runway:10', 'spinners:3', 'gaps:5', 'runway:8', 'gates:3', 'conveyor:28', 'hammers:3', 'runway:6', 'beams:2', 'spinners:2'] },
  { id: 'spooky', name: 'Spooky Manor', theme: 3, seed: 404, d: .45, tier: 1, blurb: 'Ghost tiles blink in and out, doors slam and pendulums swing. Nothing scary, just spooky!', recipe: ['runway:10', 'spinners:2', 'phantoms:4', 'runway:6', 'gates:3', 'hammers:3', 'phantoms:4', 'runway:6', 'gaps:4', 'spinners:2'] },
  { id: 'jungle', name: 'Jungle Splash', theme: 5, seed: 606, d: .5, tier: 1, blurb: 'Jump the rolling logs, ride the rafts and bounce on the mushrooms.', recipe: ['runway:8', 'rollers:4', 'beams:1', 'movers:2', 'bounce:3', 'hammers:2', 'gaps:4', 'rollers:3', 'spinners:2'] },
  { id: 'factory', name: 'Factory Frenzy', theme: 1, seed: 202, d: .55, tier: 2, blurb: 'Belts, pushers, ferries and crushing gates.', recipe: ['runway:8', 'conveyor:30', 'pistons:3', 'movers:2', 'runway:6', 'stairs:3', 'hammers:3', 'gates:3', 'gaps:4', 'pistons:2'] },
  { id: 'frost', name: 'Frosty Slopes', theme: 4, seed: 505, d: .6, tier: 2, blurb: 'Slippery ice! Dodge giant rolling snowballs and slide past the pushers.', recipe: ['runway:8', 'rollers:3', 'spinners:3', 'pistons:3', 'stairs:1', 'gaps:4', 'rollers:3', 'hammers:2', 'gates:2'] },
  { id: 'moon', name: 'Moon Base', theme: 6, seed: 707, d: .75, tier: 2, grav: .5, blurb: 'Low gravity! Float across huge gaps, ride the boost strips and watch the lasers.', recipe: ['runway:8', 'leaps:4', 'spinners:2', 'boost:26', 'gates:2', 'leaps:3', 'bounce:3', 'pistons:2', 'leaps:3', 'spinners:2'] },
  { id: 'cloud', name: 'Cloud Rush', theme: 2, seed: 303, d: .9, tier: 3, blurb: 'The final! Trampolines, narrow beams and a gauntlet of everything.', recipe: ['runway:6', 'bounce:4', 'beams:2', 'spinners:2', 'movers:1', 'hammers:2', 'gaps:4', 'gates:3', 'conveyor:20', 'spinners:2'] },
  { id: 'lava', name: 'Lava Fortress', theme: 7, seed: 808, d: 1, tier: 3, blurb: 'The hottest final! Fire jets, crumbling bridges and spinning bars over a sea of lava.', recipe: ['runway:6', 'jets:3', 'bridge:7', 'spinners:2', 'beams:2', 'jets:2', 'movers:1', 'hammers:3', 'bridge:5', 'jets:2'] },
];
const tint = (c, f) => { const r = ((c >> 16) & 255) * f, g = ((c >> 8) & 255) * f, b = (c & 255) * f; return (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255); };

// ---------------------------------------------------------------- generator
export function generateCourse(def) {
  const R = rng(def.seed), rr = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rr(a, b + 1)), th = THEMES[def.theme], d = def.d;
  const items = [], wps = [], segs = []; let u = 0, y = 0, fin = null;
  const col = () => tint(th.pal[Math.floor(R() * th.pal.length)], rr(.94, 1.06));
  const wp = (uu, vv, flag, extra) => wps.push(Object.assign({ u: uu, v: vv, flag }, extra));
  function plat(u0, u1, v0, v1, yy, ex = {}) { const it = Object.assign({ k: 'plat', x: (v0 + v1) / 2, y: yy, z: -(u0 + u1) / 2, sx: v1 - v0, sz: u1 - u0, th: TH, col: col(), u0, u1, v0, v1 }, ex); if (it.ice) it.col = tint(th.pal[Math.floor(R() * 3)], rr(.96, 1.04)); items.push(it); return it; }
  const half = LANE / 2, slick = th.ice ? { ice: true } : {};     // slick: the runway sections of an icy course are ice (slippery)
  const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const SEG = {
    start() { plat(-18, 6, -11, 11, 0, { big: true, start: true, safe: true }); u = 6; wp(6, 0); },
    runway(len) { plat(u, u + len, -half, half, y, { safe: true }); wp(u + len / 2, 0); u += len; },
    spinners(n) {
      const len = 6 + n * 15; plat(u, u + len, -half, half, y, { safe: true, ...slick });
      for (let i = 0; i < n; i++) { const uc = u + 6 + 7.5 + i * 15, om = (R() < .5 ? 1 : -1) * rr(1.3, 1.7 + d * .5);
        items.push({ k: 'spin', kind: 'bar', c: [0, y + .85, -uc], len: LANE - 1.4, th: .8, wid: .7, omega: om, phase: R() * TAU, col: 0xff4a5a, u: uc });
        if (d > .6 && i % 2 === 1) items.push({ k: 'spin', kind: 'bar', c: [0, y + .85, -uc], len: LANE - 1.4, th: .8, wid: .7, omega: om, phase: R() * TAU + Math.PI / 2, col: 0xff4a5a, u: uc });
        wp(uc, 0); }
      u += len;
    },
    hammers(n) {
      const len = 8 + n * 14; plat(u, u + len, -half, half, y, { safe: true, ...slick });
      for (let i = 0; i < n; i++) { const uc = u + 8 + 7 + i * 14, per = rr(3.0, 3.8) - d * .4;
        for (const [vx, ph] of [[-4.2, 0], [4.2, Math.PI]]) items.push({ k: 'spin', kind: 'hammer', c: [vx, y + 8.15, -uc], rod: 6.4, head: 1.7, amp: lerp(.85, 1.0, d), omega: TAU / per, phase: ph + i * 1.3, swing: [0, 0, -1], col: 0xff7a1a, u: uc });
        wp(uc, 0); }
      u += len;
    },
    pistons(n) {
      const len = 8 + n * 12; plat(u, u + len, -half, half, y, { safe: true, ...slick });
      for (let i = 0; i < n; i++) { const uc = u + 8 + 6 + i * 12; for (const s of [-1, 1]) items.push({ k: 'mover', x: s * (half + .9), y: y + 2.4, z: -uc, sx: 3.0, sz: 2.6, th: 2.4, axis: [-s, 0, 0], amp: 5.2 + d * .8, period: rr(3.4, 4.2) - d * .4, phase: (i % 2) * .5 + (s > 0 ? .25 : 0), col: 0xffd31a, wall: true, u: uc }); wp(uc, 0); }
      u += len;
    },
    gates(n) {
      const len = 8 + n * 15; plat(u, u + len, -half, half, y, { safe: true, ...slick });
      for (let i = 0; i < n; i++) { const uc = u + 8 + 7.5 + i * 15, per = rr(4.2, 5.0) - d * .5;
        for (let k = 0; k < 3; k++) items.push({ k: 'mover', x: (k - 1) * 5.0, y: y + 3.0, z: -uc, sx: 4.7, sz: 1.5, th: 3.0, axis: [1, 0, 0], amp: 3.0, period: per, phase: (k * .34 + i * .17) % 1, col: tint(th.pal[(k + i) % th.pal.length], 1.0), wall: true, u: uc }); wp(uc, 0); }
      u += len;
    },
    gaps(n) {
      let v = 0, prevCr = false; plat(u, u + 4, -half, half, y, { safe: true }); u += 4;
      for (let i = 0; i < n; i++) {
        const gap = rr(2.6, 3.4 + 1.5 * d), len = rr(3.6, 6), wid = rr(5, 9), nv = clamp(v + rr(-4, 4), -half + wid / 2, half - wid / 2), dy = rr(-.25, .35), cr = d > .4 && R() < .08 + d * .1 && !prevCr;   // never two crumbling tiles in a row
        u += gap; const it = plat(u, u + len, nv - wid / 2, nv + wid / 2, y + dy, cr ? { crumble: true } : { safe: true }); wp(u + len / 2, nv, 'hop'); u += len; v = nv; y += dy * .4; prevCr = cr;
      }
      const gap = rr(2.4, 3.4); u += gap; plat(u, u + 8, -half, half, y, { safe: true }); wp(u + 4, 0); u += 8;
    },
    movers(n) {
      for (let i = 0; i < n; i++) {
        plat(u, u + 6, -half, half, y, { safe: true }); wp(u + 3, 0); u += 6; const G = rr(12, 14);
        for (const [vx, ph] of [[-4, 0], [4, .5]]) items.push({ k: 'mover', x: vx, y, z: -(u + G / 2), sx: 5.2, sz: 5.2, th: TH, axis: [0, 0, -1], amp: G / 2 - 3.4, period: rr(6, 7) - d * .8, phase: ph, col: tint(th.pal[i % th.pal.length], 1.1), ferry: true, u: u + G / 2 });
        wp(u + G / 2, 0); u += G;
      }
      plat(u, u + 6, -half, half, y, { safe: true }); wp(u + 3, 0); u += 6;
    },
    conveyor(len) {
      const sp = [-3.4, 4.4, -3.4].map(s => s * (.8 + d * .35)), w = LANE / 3;
      for (let k = 0; k < 3; k++) { const it = plat(u, u + len, -half + k * w, -half + (k + 1) * w, y, { conv: sp[k], col: 0x4a4a68 }); it.convDir = [0, -sp[k]]; it.len = len; it.wid = w; it.dz = -1; it.dx = 0; }
      wp(u + len / 2, 0); u += len;
    },
    bounce(n) {
      plat(u, u + 5, -half, half, y, { safe: true }); u += 5; let v = 0;
      for (let i = 0; i < n; i++) { const gap = 3.0; u += gap; const nv = clamp(v + rr(-2.5, 2.5), -5, 5), vv = 12.8; plat(u, u + 4.0, nv - 2.0, nv + 2.0, y, { bounce: vv, col: 0xff4fe0, pad: true }); wp(u + 2.0, nv, 'pad'); u += 4.0; v = nv; }
      u += 3.0; plat(u, u + 9, -half, half, y, { safe: true }); wp(u + 4.5, 0); u += 9;
    },
    stairs(n) {
      const steps = 7; plat(u, u + 4, -half, half, y, { safe: true }); u += 4;
      for (let k = 0; k < steps; k++) { y += .38; plat(u, u + 1.4, -half, half, y, { safe: true }); wp(u + .7, 0); u += 1.4; }
      plat(u, u + 14, -half, half, y, { safe: true }); wp(u + 7, 0); u += 14;
      for (let k = 0; k < steps; k++) { y -= .38; plat(u, u + 1.4, -half, half, y, { safe: true }); wp(u + .7, 0); u += 1.4; }
      plat(u, u + 4, -half, half, y, { safe: true }); u += 4;
    },
    beams(n) {
      plat(u, u + 4, -half, half, y, { safe: true }); u += 4;
      for (let i = 0; i < n; i++) {
        const len = rr(15, 18), vs = [-5, 0, 5]; u += 3.2;
        const bw = lerp(1.6, 1.3, d); for (const vx of vs) plat(u, u + len, vx - bw, vx + bw, y, { beam: true });
        if (d > .8 && d < .95 && i === n - 1) items.push({ k: 'spin', kind: 'bar', c: [0, y + .85, -(u + len / 2)], len: LANE - 1.6, th: .8, wid: .7, omega: (R() < .5 ? 1 : -1) * rr(1.0, 1.25), phase: R() * TAU, col: 0xff4a5a, u: u + len / 2 });
        wp(u + len / 2, vs[ri(0, 2)], 'beam'); u += len;
        plat(u, u + 4, -half, half, y, { safe: true }); wp(u + 2, 0); u += 4;
      }
    },
    // ---- obstacles that only the newer courses use
    phantoms(n) {     // rows of ghost tiles that blink in and out of sight; at least two tiles of every row are solid at any moment
      plat(u, u + 4, -half, half, y, { safe: true }); wp(u + 2, 0); u += 4; const cols = 4, gc = .4, w = (LANE - gc * (cols - 1)) / cols;
      for (let i = 0; i < n; i++) {
        u += rr(2.4, 3.0 + d * .6); const per = rr(3.5, 4.1) - d * .4, depth = rr(4.2, 5.2), ph0 = R(), order = shuf([0, 1, 2, 3]), tiles = [];
        for (let c = 0; c < cols; c++) { const v0 = -half + c * (w + gc); tiles.push(plat(u, u + depth, v0, v0 + w, y, { blink: { per, on: .78, ph: (ph0 + order[c] * .25) % 1 }, col: (c + i) % 2 ? 0xcfe4ff : 0xb8f5d8 })); }
        wp(u + depth / 2, 0, 'ghost', { tiles }); u += depth;
      }
      u += rr(2.4, 3.0); plat(u, u + 6, -half, half, y, { safe: true }); wp(u + 3, 0); u += 6;
    },
    rollers(n) {      // logs (jungle) or snowballs (ice) that roll across the lane: jump them
      const len = 8 + n * 13; plat(u, u + len, -half, half, y, { safe: true, ...slick }); const snow = th.deco === 'frost';
      for (let i = 0; i < n; i++) { const uc = u + 8 + 6.5 + i * 13;
        items.push({ k: 'roll', kind: snow ? 'ball' : 'log', z: -uc, y, rad: snow ? .78 : .7, half: snow ? .78 : 1.5, dir: (i + (R() < .5 ? 1 : 0)) % 2 ? 1 : -1, per: rr(3.5, 4.2) - d * .4, go: .6, ph: R(), col: snow ? 0xffffff : tint(0xa8622c, rr(.9, 1.1)), u: uc });
        wp(uc, 0); }
      u += len;
    },
    jets(n) {         // fire jets: a glowing ring warns you, then a column of flame shoots up and throws you around
      const len = 8 + n * 14; plat(u, u + len, -half, half, y, { safe: true });
      for (let i = 0; i < n; i++) { const uc = u + 8 + 7 + i * 14, per = rr(3.5, 4.1) - d * .35, ph0 = R(), xs = i % 2 ? [-2.8, 2.8] : [-5.6, 0, 5.6];
        xs.forEach((x, k) => items.push({ k: 'jet', x, y, z: -uc, r: 1.5, per, on: .3, ph: (ph0 + k * .13) % 1, u: uc })); wp(uc, 0); }
      u += len;
    },
    bridge(n) {       // a line of planks over the abyss; some of them crumble (never two in a row)
      plat(u, u + 4, -half, half, y, { safe: true }); wp(u + 2, 0); u += 4; let v = 0, prev = false;
      for (let i = 0; i < n; i++) {
        const gap = rr(.5, .9), depth = rr(2.2, 2.8), wid = rr(6, 9), nv = clamp(v + rr(-3, 3), -half + wid / 2, half - wid / 2), cr = !prev && R() < .38; u += gap;
        plat(u, u + depth, nv - wid / 2, nv + wid / 2, y, cr ? { crumble: true } : { safe: true }); wp(u + depth / 2, nv, 'hop'); u += depth; v = nv; prev = cr;
      }
      u += rr(.8, 1.2); plat(u, u + 6, -half, half, y, { safe: true }); wp(u + 3, 0); u += 6;
    },
    leaps(n) {        // big floating rocks with wide gaps: made for low gravity
      plat(u, u + 6, -half, half, y, { safe: true }); wp(u + 3, 0); u += 6; let v = 0;
      for (let i = 0; i < n; i++) {
        const gap = rr(5, 6.8 + 1.4 * d), len = rr(7, 10), wid = rr(8, 12), nv = clamp(v + rr(-4, 4), -half + wid / 2, half - wid / 2), dy = clamp(rr(-1.3, 1.4), -3 - y, 4 - y); u += gap; y += dy;
        plat(u, u + len, nv - wid / 2, nv + wid / 2, y, { safe: true }); wp(u + len / 2, nv, 'hop'); u += len; v = nv;
      }
      u += rr(4.5, 6); plat(u, u + 8, -half, half, y, { safe: true }); wp(u + 4, 0); u += 8;
    },
    boost(len) {      // a full-width boost strip: it carries everybody forward very fast
      const it = plat(u, u + len, -half, half, y, { conv: 7, col: 0x1f5a3a }); it.convDir = [0, -7]; it.len = len; it.wid = LANE; it.belt = 'boost'; wp(u + len / 2, 0); u += len;
    },
    finish() { const it = plat(u + 2, u + 30, -half - 2, half + 2, y, { big: true, fin: true, safe: true }); fin = u + 8; wp(fin, 0); u += 30; },
  };
  SEG.start();
  for (const r of def.recipe) { const [name, arg] = r.split(':'), u0 = u; SEG[name](arg ? +arg : undefined); segs.push({ name, u0, u1: u }); }
  SEG.finish();
  return { def, theme: th, items, wps, segs, finishU: fin, length: u, id: def.id };
}

// ---------------------------------------------------------------- the built course
const unit = new THREE.BoxGeometry(1, 1, 1); unit.userData.shared = true;
const TM = new THREE.Matrix4(), TQ = new THREE.Quaternion(), TP = new V3(), TS = new V3(), TC = new THREE.Color(), YAX = new V3(0, 1, 0);
class Batch {
  constructor(mat, cap, hull) {
    this.im = new THREE.InstancedMesh(unit, mat, Math.max(1, cap)); this.im.count = 0; this.im.frustumCulled = false; this.im.castShadow = QL.shadow > 0 && !mat.isMeshBasicMaterial; this.im.receiveShadow = QL.shadow > 0 && !mat.isMeshBasicMaterial; scene.add(this.im);
    this.hull = hull && QL.hull ? new THREE.InstancedMesh(unit, INK, Math.max(1, cap)) : null; if (this.hull) { this.hull.count = 0; this.hull.frustumCulled = false; scene.add(this.hull); } this.n = 0;
  }
  add(cx, cy, cz, sx, sy, sz, color) { const i = this.n++; this.set(i, cx, cy, cz, sx, sy, sz); TC.setHex(color); this.im.setColorAt(i, TC); if (this.im.instanceColor) this.im.instanceColor.needsUpdate = true; this.im.count = this.n; if (this.hull) this.hull.count = this.n; return i; }
  set(i, cx, cy, cz, sx, sy, sz) {
    TP.set(cx, cy, cz); TS.set(sx, sy, sz); TM.compose(TP, TQ.identity(), TS); this.im.setMatrixAt(i, TM); this.im.instanceMatrix.needsUpdate = true;
    if (this.hull) { TS.set(sx + .14, sy + .14, sz + .14); TM.compose(TP, TQ, TS); this.hull.setMatrixAt(i, TM); this.hull.instanceMatrix.needsUpdate = true; }
  }
}
const makeChev = (bg, fg) => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 64, 64); x.strokeStyle = fg; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(20, 12); x.lineTo(46, 32); x.lineTo(20, 52); x.stroke(); const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; return tx; };
const chevTex = makeChev('#3d3d5c', '#ffd34e'), boostTex = makeChev('#16402c', '#6affb0');
const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }); flameMat.userData.shared = true;
const flameIn = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }); flameIn.userData.shared = true;
const platMat = toon(0xffffff); platMat.userData.shared = true;
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); glowMat.userData.shared = true;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class Course {
  constructor(spec) {
    this.spec = spec; this.group = new THREE.Group(); scene.add(this.group); this.movers = []; this.crumbles = []; this.spins = []; this.belts = []; this.boxes = []; this.blinks = []; this.rolls = []; this.jets = []; this.t = 0;
    const items = spec.items, count = k => items.filter(i => i.k === k).length, nB = items.filter(i => i.k === 'plat' && i.blink).length, nS = items.filter(i => i.k === 'plat' && !i.crumble && !i.blink).length, nC = items.filter(i => i.k === 'plat' && i.crumble).length;
    this.bStatic = new Batch(platMat, nS + 8, true); this.bCrumble = new Batch(platMat, nC + 2, true); this.bBlink = new Batch(platMat, nB + 2, true); this.bMover = new Batch(platMat, count('mover') + 2, true); this.bGlow = new Batch(glowMat, (nS + nC) * 3 + 120, false);
    for (const it of items) { if (it.k === 'plat') this.addPlat(it); else if (it.k === 'mover') this.addMover(it); else if (it.k === 'spin') this.addSpin(it); else if (it.k === 'roll') this.addRoll(it); else if (it.k === 'jet') this.addJet(it); }
    this.ferries = this.movers.filter(m => m.ferry); this.buildDecor();
  }
  addPlat(it) {
    const b = world.add({ minX: it.x - it.sx / 2, maxX: it.x + it.sx / 2, minY: it.y - it.th, maxY: it.y, minZ: it.z - it.sz / 2, maxZ: it.z + it.sz / 2, kind: 'plat', it, conv: it.convDir || null, bounce: it.bounce || 0, crumble: !!it.crumble, fin: !!it.fin, safe: !!it.safe, ice: !!it.ice }); it.box = b; this.boxes.push(b);
    const batch = it.crumble ? this.bCrumble : it.blink ? this.bBlink : this.bStatic; it.bi = batch.add(it.x, it.y - it.th / 2, it.z, it.sx, it.th, it.sz, it.col); it.batch = batch;
    if (it.crumble) { it.cs = { phase: 'idle', t: 0, y: 0 }; this.crumbles.push(it); }
    if (it.blink) { it.bs = { on: true, k: 1 }; this.blinks.push(it); }
    if (it.ice) { for (const s of [-1, 1]) this.bGlow.add(it.x + s * (it.sx / 2 - .2), it.y + .03, it.z, .14, .05, it.sz - .3, 0xffffff); }
    if (it.bounce) this.bGlow.add(it.x, it.y + .06, it.z, it.sx - .6, .14, it.sz - .6, 0xffffff);
    if (it.big && !it.start) this.bGlow.add(it.x, it.y + .05, it.z, it.sx - .6, .12, it.sz - .6, it.fin ? 0xffd34e : 0x6affb0);
    if (it.start) { for (let k = 0; k < 6; k++) this.bGlow.add(-8 + k * 3.2 + 1.6, it.y + .05, -2, 1.6, .1, .4, 0xffffff); }
    if (it.beam) this.bGlow.add(it.x, it.y + .03, it.z, .3, .05, it.sz - .5, 0xffffff);
    if (it.convDir) {
      const tex = (it.belt === 'boost' ? boostTex : chevTex).clone(); tex.needsUpdate = true; tex.repeat.set(it.len / 2.2, 1); const g = new THREE.Group(), plane = new THREE.Mesh(new THREE.PlaneGeometry(it.len - .3, it.wid - .3), new THREE.MeshBasicMaterial({ map: tex })), d = it.convDir, mag = Math.hypot(d[0], d[1]) || 1;
      plane.rotation.x = -Math.PI / 2; g.add(plane); g.rotation.y = Math.atan2(-d[1] / mag, d[0] / mag); g.position.set(it.x, it.y + .03, it.z); this.group.add(g); this.belts.push({ tex, speed: mag / 2.2 });
    }
    if (it.fin) { this.fin = it; }
  }
  addMover(it) {
    const b = world.add({ minX: it.x - it.sx / 2, maxX: it.x + it.sx / 2, minY: it.y - it.th, maxY: it.y, minZ: it.z - it.sz / 2, maxZ: it.z + it.sz / 2, kind: 'mover', it, dx: 0, dy: 0, dz: 0 });
    it.box = b; it.bi = this.bMover.add(it.x, it.y - it.th / 2, it.z, it.sx, it.th, it.sz, it.col); it.base = [it.x, it.y, it.z]; it.last = [it.x, it.y, it.z]; this.movers.push(it);
  }
  addSpin(it) {
    const mat = toon(it.col); const g = new THREE.Group(); this.group.add(g); const s = { it, g, obbs: [], mat };
    if (it.kind === 'bar') {
      const m = new THREE.Mesh(unit, mat); m.scale.set(it.len, it.th, it.wid); m.castShadow = QL.shadow > 0; g.add(m); g.position.set(it.c[0], it.c[1], it.c[2]);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, it.th + .5, 12), toon(0xffd34e))); const post = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, it.th + 1.4, 8), toon(0x3a2f58)); post.position.y = -.5; g.add(post);
      s.obbs.push({ pos: new V3(), quat: new THREE.Quaternion(), inv: new THREE.Quaternion(), half: new V3(it.len / 2, it.th / 2, it.wid / 2) });
    } else {
      g.position.set(it.c[0], it.c[1], it.c[2]); const rod = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, it.rod, 8), toon(0x3a2f58)); rod.position.y = -it.rod / 2; g.add(rod);
      const head = new THREE.Mesh(unit, mat); head.scale.set(it.head, it.head, it.head); head.position.y = -(it.rod + it.head / 2); head.castShadow = QL.shadow > 0; g.add(head); g.add(new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), toon(0xffd34e)));
      s.obbs.push({ pos: new V3(), quat: new THREE.Quaternion(), inv: new THREE.Quaternion(), half: new V3(it.head / 2, it.head / 2, it.head / 2) }, { pos: new V3(), quat: new THREE.Quaternion(), inv: new THREE.Quaternion(), half: new V3(.22, it.rod / 2, .22) });
      s.axis = new V3(it.swing[0], it.swing[1], it.swing[2]).normalize();
      // a frame over the lane the hammers hang from
    }
    this.spins.push(s);
  }
  addRoll(it) {   // a log or a snowball that rolls across the lane (axis along z), with dark marks so you can see it turn
    const g = new THREE.Group(), rot = new THREE.Group(), mat = toon(it.col), dark = toon(it.kind === 'ball' ? 0x9ac8f0 : 0x6a3a18); g.add(rot); this.group.add(g);
    if (it.kind === 'ball') {
      rot.add(new THREE.Mesh(new THREE.SphereGeometry(it.rad, 18, 14), mat));
      for (const [px, py, pz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [.7, .7, 0], [-.7, -.7, 0]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 6), dark); m.position.set(px * it.rad, py * it.rad, pz * it.rad); rot.add(m); }
    } else {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(it.rad, it.rad, it.half * 2, 16), mat); body.rotation.x = Math.PI / 2; rot.add(body);
      for (const sz of [-1, 1]) for (const a of [0, Math.PI / 2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(it.rad * 1.5, .1, .06), dark); m.position.z = sz * (it.half + .02); m.rotation.z = a; rot.add(m); }
      for (const a of [0, 1, 2, 3, 4, 5]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, it.half * 1.6), dark); m.position.set(Math.cos(a * 1.047) * it.rad, Math.sin(a * 1.047) * it.rad, 0); m.rotation.z = a * 1.047; rot.add(m); }
    }
    g.visible = false; this.rolls.push({ it, g, rot, act: false, x: 0 });
  }
  addJet(it) {    // a vent in the floor: dim ring, glowing ring when it is about to fire, then a column of flame
    const g = new THREE.Group(); g.position.set(it.x, it.y, it.z); this.group.add(g);
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(it.r + .2, it.r + .3, .24, 18), toon(0x3a2430)); crater.position.y = .12; g.add(crater);
    const dm = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: .3, depthWrite: false }), disc = new THREE.Mesh(new THREE.CircleGeometry(it.r, 20), dm); disc.rotation.x = -Math.PI / 2; disc.position.y = .26; g.add(disc);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(it.r * .75, it.r * 1.0, 1, 14, 1, true), flameMat), fi = new THREE.Mesh(new THREE.CylinderGeometry(it.r * .4, it.r * .55, 1, 10, 1, true), flameIn); fl.visible = fi.visible = false; g.add(fl, fi);
    this.jets.push({ it, g, dm, fl, fi, act: false });
  }
  buildDecor() {
    const sp = this.spec, th = sp.theme, R = rng(sp.def.seed * 5 + 1), list = [], add = (g, c) => list.push([g, c]);
    const T = (g, x, y, z) => { g.translate(x, y, z); return g; };
    // frames over the lane that the hammers hang from
    const framed = new Set();
    for (const it of sp.items) if (it.k === 'spin' && it.kind === 'hammer') { const z = it.c[2]; if (framed.has(z)) continue; framed.add(z); const hh = it.c[1] + .3; add(T(new THREE.BoxGeometry(LANE + 3, .5, .6), 0, hh, z), 0x3a2f58); for (const sx of [-1, 1]) add(T(new THREE.BoxGeometry(.6, hh, .6), sx * (LANE / 2 + 1.5), hh / 2, z), 0x3a2f58); }
    // start gantry + finish arch
    const sx = LANE / 2 + 2;
    for (const [z, c, w] of [[-.0, 0xffffff, 'start'], [-sp.finishU, 0xffd34e, 'fin']]) { for (const s of [-1, 1]) add(T(new THREE.BoxGeometry(.9, 8, .9), s * sx, 4, z), c); add(T(new THREE.BoxGeometry(sx * 2 + .9, 1.4, 1.0), 0, 8, z), c); if (w === 'fin') for (let i = 0; i < 12; i++) add(T(new THREE.BoxGeometry(2, 1, 1.02), -sx + i * (sx * 2 / 11), 8, z + .02), i % 2 ? 0x2a2140 : 0xffffff); }
    // scenery on both sides, depending on the course style
    const style = th.deco, L = sp.length;
    const SEA = -13, ico = (r, det) => new THREE.IcosahedronGeometry(r, det), fancy = ['spooky', 'frost', 'jungle', 'space', 'lava'].includes(style);
    for (let i = 0; i < 70; i++) {
      const uu = R() * (L + 40) - 20, side = R() < .5 ? -1 : 1, vv = side * (16 + R() * 70), z = -uu, s = 1 + R() * 2.4, pc = th.pal[Math.floor(R() * th.pal.length)], k = fancy ? R() : 0;
      if (style === 'spooky') {
        if (k < .3) { const h = 14 * s; add(T(new THREE.CylinderGeometry(.35 * s, .7 * s, h, 7), vv, SEA + h / 2, z), 0x1a1030); for (const a of [-1, 1]) { const b = new THREE.CylinderGeometry(.12 * s, .26 * s, 3.6 * s, 6); b.rotateZ(a * .75); add(T(b, vv + a * 1.4 * s, SEA + h * .8, z), 0x1a1030); } }
        else if (k < .5) { const h = 10 * s; add(T(new THREE.BoxGeometry(1.8 * s, h, .6 * s), vv, SEA + h / 2, z), 0x8a86a8); add(T(new THREE.CylinderGeometry(.9 * s, .9 * s, .6 * s, 10).rotateX(Math.PI / 2), vv, SEA + h, z), 0x8a86a8); }
        else if (k < .75) { const p = new THREE.SphereGeometry(1.6 * s, 12, 9); p.scale(1.2, 1, 1.2); const yy = R() * 26 - 6; add(T(p, vv, yy, z), 0xff8a1a); add(T(new THREE.BoxGeometry(.4 * s, .7 * s, .4 * s), vv, yy + 1.7 * s, z), 0x3a7a2a); }
        else { const h = 26 * s; add(T(new THREE.CylinderGeometry(2.4 * s, 2.8 * s, h, 8), vv, SEA + h / 2, z), 0x3a2a5a); add(T(new THREE.ConeGeometry(3.4 * s, 6 * s, 8), vv, SEA + h + 3 * s, z), 0x6a2a8a); for (let w = 0; w < 3; w++) add(T(new THREE.BoxGeometry(.9 * s, 1.4 * s, .3 * s), vv - side * 2.4 * s, SEA + h * (.4 + w * .2), z), 0xffd34e); }
      } else if (style === 'frost') {
        if (k < .4) { const h = 4 * s; add(T(new THREE.CylinderGeometry(4.6 * s, 3.4 * s, 12, 12), vv, -1 - 6, z), 0xd8f0ff); add(T(new THREE.CylinderGeometry(.4 * s, .5 * s, h, 6), vv, -1 + h / 2, z), 0x6a4a2a); for (let c = 0; c < 3; c++) add(T(new THREE.ConeGeometry((3.2 - c * .8) * s, 4.4 * s, 9), vv, -1 + h + c * 2.4 * s + 1.4 * s, z), c % 2 ? 0xffffff : 0x3a9a6a); }
        else if (k < .7) { add(T(new THREE.CylinderGeometry(4 * s, 3 * s, 12, 12), vv, -1 - 6, z), 0xd8f0ff); add(T(new THREE.SphereGeometry(1.6 * s, 12, 9), vv, -1 + 1.4 * s, z), 0xffffff); add(T(new THREE.SphereGeometry(1.2 * s, 12, 9), vv, -1 + 3.7 * s, z), 0xffffff); add(T(new THREE.SphereGeometry(.85 * s, 12, 9), vv, -1 + 5.4 * s, z), 0xffffff); add(T(new THREE.ConeGeometry(.16 * s, .9 * s, 6).rotateX(Math.PI / 2), vv, -1 + 5.4 * s, z + .9 * s), 0xff8a1a); add(T(new THREE.CylinderGeometry(.9 * s, .9 * s, .9 * s, 10), vv, -1 + 6.5 * s, z), 0x2a2140); }
        else { const h = 30 * s; add(T(new THREE.ConeGeometry(14 * s, h, 7), vv * 1.5, SEA + h / 2, z), 0x9ac0e8); add(T(new THREE.ConeGeometry(5.4 * s, h * .36, 7), vv * 1.5, SEA + h * .82, z), 0xffffff); }
      } else if (style === 'jungle') {
        if (k < .5) { const h = 24 * s; add(T(new THREE.CylinderGeometry(.9 * s, 1.4 * s, h, 8), vv, SEA + h / 2, z), 0x6a4a2a); add(T(ico(5 * s, 1).scale(1.3, .8, 1.3), vv, SEA + h + 1, z), 0x2a9a4a); add(T(ico(3.4 * s, 1), vv + 3.5 * s, SEA + h - 2, z + 1), 0x3acf6a); }
        else if (k < .75) { const h = 16 * s; const trunk = new THREE.CylinderGeometry(.5 * s, .8 * s, h, 7); add(T(trunk, vv, SEA + h / 2, z), 0x9a7a4a); for (let l = 0; l < 5; l++) { const lf = new THREE.ConeGeometry(.9 * s, 7 * s, 4); lf.rotateZ(Math.PI / 2 + .5); lf.translate(3.2 * s, 0, 0); lf.rotateY(l * 1.2566); add(T(lf, vv, SEA + h, z), 0x3acf6a); } }
        else { const h = 3.4 * s; for (let b = 0; b < 4; b++) add(T(new THREE.BoxGeometry(2.2 * s, h, 2.2 * s), vv, SEA + 14 + h * (b + .5), z), [0xff7a4a, 0xffc83a, 0x2ab8a0, 0xff4fa8][b]); add(T(new THREE.CylinderGeometry(.8 * s, .9 * s, 14, 8), vv, SEA + 7, z), 0x6a4a2a); }
      } else if (style === 'space') {
        const yy = R() * 60 - 24, vv2 = side * (26 + R() * 110);
        if (k < .4) add(T(ico(2.6 * s, 0).scale(1 + R() * .5, .7 + R() * .4, 1), vv2, yy, z), [0x8a8aa8, 0x6a6a88, 0xa8a8c0][Math.floor(R() * 3)]);
        else if (k < .7) { const cr = new THREE.ConeGeometry(1.1 * s, 9 * s, 5); if (R() < .5) cr.rotateZ(Math.PI); add(T(cr, vv2, yy, z), pc); }
        else { add(T(new THREE.SphereGeometry(5 * s, 16, 12), vv2 * 1.4, yy + 12, z), pc); add(T(new THREE.TorusGeometry(8.4 * s, .55 * s, 6, 28).rotateX(1.2), vv2 * 1.4, yy + 12, z), 0xe8e0ff); }
      } else if (style === 'lava') {
        if (k < .3) { const h = 34 * s; add(T(new THREE.ConeGeometry(15 * s, h, 8), vv * 1.5, SEA + h / 2, z), 0x4a3238); add(T(new THREE.ConeGeometry(4.2 * s, 4 * s, 8), vv * 1.5, SEA + h - 1.5 * s, z), 0xff6a1a); }
        else if (k < .7) { const h = (6 + R() * 18) * s; add(T(new THREE.CylinderGeometry(1.5 * s, 1.7 * s, h, 6), vv, SEA + h / 2, z), pc); add(T(new THREE.CylinderGeometry(1.5 * s, 1.5 * s, .4, 6), vv, SEA + h + .1, z), 0xff7a2a); }
        else add(T(new THREE.DodecahedronGeometry(2.4 * s, 0), vv, R() * 24 - 6, z), 0x5a4a52);
      } else if (style === 'candy') { add(T(new THREE.CylinderGeometry(.35 * s, .35 * s, 7 * s, 8), vv, 3.5 * s - 3, z), 0xffffff); const ball = new THREE.SphereGeometry(2 * s, 14, 10); ball.scale(1, 1, .45); add(T(ball, vv, 7.8 * s - 3, z), pc); }
      else if (style === 'factory') { add(T(new THREE.CylinderGeometry(1.6 * s, 2 * s, 12 * s, 10), vv, 6 * s - 6, z), tint(pc, .85)); add(T(new THREE.CylinderGeometry(1.9 * s, 1.9 * s, 1.2 * s, 10), vv, 12.4 * s - 6, z), 0x3a2f58); }
      else { const cg = new THREE.IcosahedronGeometry(3 * s, 1); cg.scale(1.4, .8, 1); add(T(cg, vv, R() * 18 - 10, z), 0xffffff); const c2 = new THREE.IcosahedronGeometry(2 * s, 1); add(T(c2, vv + 3 * s, R() * 18 - 9, z + 2), 0xffffff); }
    }
    // merge it all into one mesh
    const pos = [], nor = [], colr = [], cc = new THREE.Color();
    for (const [geo, color] of list) { const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position.array, n = g.attributes.normal.array; cc.set(color); for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) colr.push(cc.r, cc.g, cc.b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    const dm = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true })); dm.castShadow = QL.shadow > 0; this.group.add(dm); this.decor = dm;
    // goo sea
    if (!th.noSea) { const sea = new THREE.Mesh(new THREE.CircleGeometry(1200, 40), toon(th.sea, th.seaGlow ? { emissive: th.seaGlow, emissiveIntensity: .9 } : {})); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -13, -L / 2); this.group.add(sea); this.sea = sea; }
    // a big moon (spooky) or planet (space) in the sky, far beyond the finish line
    if (style === 'spooky' || style === 'space') {
      const big = style === 'spooky', rad = big ? 80 : 95, body = new THREE.Mesh(new THREE.SphereGeometry(rad, 28, 18), big ? new THREE.MeshBasicMaterial({ color: 0xfff1c0, fog: false }) : toon(0x4a7aff, { fog: false }));
      body.position.set(big ? -150 : -280, big ? 250 : 150, -L / 2 - (big ? 620 : 560)); this.group.add(body);
      if (big) for (const [cx, cy, cr] of [[-14, 8, 14], [18, -14, 10], [12, 26, 8]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(cr, 16), new THREE.MeshBasicMaterial({ color: 0xe8d49a, fog: false })); m.position.set(body.position.x + cx * 1.2, body.position.y + cy * 1.2, body.position.z + rad - 2); this.group.add(m); }
      else { const rg = new THREE.Mesh(new THREE.RingGeometry(120, 150, 48), new THREE.MeshBasicMaterial({ color: 0xc8d4ff, side: THREE.DoubleSide, transparent: true, opacity: .55, fog: false })); rg.position.copy(body.position); rg.rotation.x = 1.25; this.group.add(rg); }
    }
    this.trophy = new THREE.Group(); const gold = toon(0xffd34e); const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, .5, 16), gold), stem = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, 1.2, 12), gold), cup = new THREE.Mesh(new THREE.CylinderGeometry(1.2, .6, 1.5, 16), gold); base.position.y = .25; stem.position.y = 1.1; cup.position.y = 2.3; this.trophy.add(base, stem, cup); this.trophy.position.set(0, this.fin.y, -(sp.finishU + 14)); this.group.add(this.trophy);
  }
  skyFor() { blendSky(this.spec.theme, this.spec.theme, 0); }
  // t = race clock in seconds
  // ---- timing helpers (everything on the course is a function of the race clock, so the bots can look ahead)
  blinkOn(it, t) { const b = it.blink, p = (((t / b.per + b.ph) % 1) + 1) % 1; return p < b.on; }
  blinkRemain(it, t) { const b = it.blink, p = (((t / b.per + b.ph) % 1) + 1) % 1; return p < b.on ? (b.on - p) * b.per : 0; }
  rollX(it, t) { const p = (((t / it.per + it.ph) % 1) + 1) % 1; if (p >= it.go) return null; const s = p / it.go, X = LANE / 2 + 2.2; return it.dir > 0 ? -X + 2 * X * s : X - 2 * X * s; }
  jetPhase(it, t) { return (((t / it.per + it.ph) % 1) + 1) % 1; }
  jetOn(it, t) { return this.jetPhase(it, t) < it.on; }
  jetBetween(it, t0, t1) { for (let t = t0; t <= t1; t += .1) if (this.jetOn(it, t)) return true; return this.jetOn(it, t1); }
  update(t, dt) {
    this.t = t;
    for (const bl of this.blinks) {
      const bs = bl.bs, on = this.blinkOn(bl, t), rem = on ? this.blinkRemain(bl, t) : 0, b = bl.box;
      if (on !== bs.on) { bs.on = on; if (on) world.add(b); else world.remove(b); }
      if (!on) bl.batch.set(bl.bi, bl.x, bl.y - 500, bl.z, .01, .01, .01);
      else { const k = rem < .6 ? (Math.floor(t * 14) & 1 ? .88 : 1) : 1; bl.batch.set(bl.bi, bl.x, bl.y - bl.th / 2, bl.z, bl.sx * k, bl.th * (k > .95 ? 1 : .8), bl.sz * k); }
    }
    for (const s of this.rolls) {
      const it = s.it, x = this.rollX(it, t); s.act = x !== null; s.g.visible = s.act; if (!s.act) continue; s.x = x;
      const fade = clamp((LANE / 2 + 1.6 - Math.abs(x)) / 1.6, 0, 1); s.g.position.set(x, it.y + it.rad * (.3 + .7 * fade), it.z); s.g.scale.setScalar(Math.max(.01, fade)); s.rot.rotation.z = -x / it.rad;
    }
    for (const s of this.jets) {
      const it = s.it, p = this.jetPhase(it, t), tele = .85 / it.per, on = p < it.on, warn = !on && p > 1 - tele, env = on ? Math.pow(Math.sin(Math.PI * p / it.on), .6) : 0;
      s.act = on && env > .25; s.fl.visible = s.fi.visible = env > .03;
      if (env > .03) { const h = 6.5 * env; s.fl.scale.set(1, h, 1); s.fl.position.y = .25 + h / 2; s.fi.scale.set(1, h * .75, 1); s.fi.position.y = .25 + h * .375; s.fl.rotation.y = s.fi.rotation.y = t * 6; }
      s.dm.opacity = on ? .95 : warn ? .35 + .55 * (.5 + .5 * Math.sin(t * 22)) : .28; s.dm.color.setHex(on ? 0xffd040 : warn ? 0xff2a1a : 0xff5a1a);
    }
    for (const m of this.movers) {
      const s = Math.sin(TAU * (t / m.period + m.phase)) * m.amp, a = m.axis, nx = m.base[0] + a[0] * s, ny = m.base[1] + a[1] * s, nz = m.base[2] + a[2] * s, b = m.box;
      b.dx = nx - m.last[0]; b.dy = ny - m.last[1]; b.dz = nz - m.last[2]; m.last[0] = nx; m.last[1] = ny; m.last[2] = nz;
      world.moveBox(b, nx - m.sx / 2, nx + m.sx / 2, ny - m.th, ny, nz - m.sz / 2, nz + m.sz / 2); this.bMover.set(m.bi, nx, ny - m.th / 2, nz, m.sx, m.th, m.sz);
    }
    for (const it of this.crumbles) {
      const cs = it.cs, b = it.box;
      if (cs.phase === 'shake') { cs.t -= dt; const j = (Math.random() - .5) * .16; it.batch.set(it.bi, it.x + j, it.y - it.th / 2, it.z + j, it.sx, it.th, it.sz); if (cs.t <= 0) { cs.phase = 'fall'; cs.t = .7; cs.y = 0; world.remove(b); } }
      else if (cs.phase === 'fall') { cs.t -= dt; cs.y -= (12 + (.7 - cs.t) * 30) * dt; const k = Math.max(.01, cs.t / .7); it.batch.set(it.bi, it.x, it.y - it.th / 2 + cs.y, it.z, it.sx * k, it.th * k, it.sz * k); if (cs.t <= 0) { cs.phase = 'gone'; cs.t = 1.8; it.batch.set(it.bi, it.x, it.y - 500, it.z, .01, .01, .01); } }
      else if (cs.phase === 'gone') { cs.t -= dt; if (cs.t <= 0) { cs.phase = 'idle'; world.add(b); it.batch.set(it.bi, it.x, it.y - it.th / 2, it.z, it.sx, it.th, it.sz); } }
    }
    for (const s of this.spins) {
      const it = s.it;
      if (it.kind === 'bar') { const ang = it.phase + it.omega * t; s.g.rotation.y = ang; const o = s.obbs[0]; o.pos.set(it.c[0], it.c[1], it.c[2]); o.quat.setFromAxisAngle(YAX, ang); o.inv.copy(o.quat).invert(); }
      else {
        const thh = it.amp * Math.sin(it.omega * t + it.phase); s.g.quaternion.setFromAxisAngle(s.axis, thh); const q = s.g.quaternion, head = s.obbs[0], rod = s.obbs[1];
        head.quat.copy(q); head.inv.copy(q).invert(); head.pos.set(0, -(it.rod + it.head / 2), 0).applyQuaternion(q).add(s.g.position); rod.quat.copy(q); rod.inv.copy(q).invert(); rod.pos.set(0, -it.rod / 2, 0).applyQuaternion(q).add(s.g.position);
        s.ang = thh; s.angVel = it.amp * it.omega * Math.cos(it.omega * t + it.phase);
      }
    }
    if (this.trophy) this.trophy.rotation.y += dt * 1.2; for (const b of this.belts) b.tex.offset.x -= b.speed * dt;
    if (this.sea) this.sea.position.y = -13 + Math.sin(W.time * 1.2) * .1;
  }
  // spinning bars and hammers: returns { kind:'whack', nx, nz } when something at pos is touching one
  hazards(pos, r = .42) {
    const x = pos.x, z = pos.z;
    for (const s of this.spins) {
      const it = s.it; if (Math.abs(it.c[2] - z) > (it.kind === 'bar' ? it.len / 2 + 1.5 : it.rod + 3)) continue;
      for (let oi = 0; oi < s.obbs.length; oi++) {
        const o = s.obbs[oi];
        for (let h = 0; h < 3; h++) {
          const hit = sphereVsObb(x, pos.y + .35 + h * .55, z, r + .06, o); if (!hit) continue;
          let nx = hit.nx, nz = hit.nz; const m = Math.hypot(nx, nz); if (m < .2) { nx = x - o.pos.x; nz = z - o.pos.z; const mm = Math.hypot(nx, nz) || 1; nx /= mm; nz /= mm; } else { nx /= m; nz /= m; }
          return { kind: 'whack', nx, nz, pen: hit.pen };
        }
      }
    }
    for (const s of this.rolls) {    // a rolling log or snowball: whacks you the way it is rolling
      if (!s.act) continue; const it = s.it, dz = z - it.z; if (Math.abs(dz) > it.half + r) continue; const cy = it.y + it.rad;
      for (let h = 0; h < 3; h++) { const dy = pos.y + .35 + h * .55 - cy, dx = x - s.x, dd = it.kind === 'ball' ? Math.hypot(dx, dy, dz) : Math.hypot(dx, dy); if (dd < it.rad + r) return { kind: 'whack', nx: it.dir, nz: 0, pen: 0, up: 8.5 }; }
    }
    for (const s of this.jets) {      // a jet of flame: throws you up and away from the vent
      if (!s.act) continue; const it = s.it, dx = x - it.x, dz = z - it.z, m = Math.hypot(dx, dz); if (m > it.r + r || pos.y > it.y + 6) continue;
      return { kind: 'whack', nx: m > .05 ? dx / m : 0, nz: m > .05 ? dz / m : 1, pen: 0, up: 12 };
    }
    return null;
  }
  dispose() { disposeObj(this.group); scene.remove(this.group); for (const b of [this.bStatic, this.bCrumble, this.bBlink, this.bMover, this.bGlow]) { scene.remove(b.im); b.im.dispose(); if (b.hull) { scene.remove(b.hull); b.hull.dispose(); } } this.decor.geometry.dispose(); world.clear(); }
}
