// WOBBLE DASH - the race courses. A course is built from segments (spinning bars, swinging hammers, sliding gates, gaps, belts...)
// laid out along one long lane. Every moving thing is a pure function of the race clock, so everybody sees the same course.
// Coordinates: the lane runs toward -z. u = distance from the start line, v = sideways (x).
import { THREE, V3, scene, toon, INK, QL, rng, clamp, lerp, TAU, W, burst, ring, blendSky } from './core.js?v=12';
import { world, sphereVsObb } from './physics.js?v=12';

export const TH = .9, LANE = 16;
export const THEMES = [
  { name: 'Candy Run', sky: [0x3a9bff, 0x9fdcff, 0xfff2dc], fog: [0xcfeaff, 90, 520], hemi: [0xd8eeff, 0x9ab0a0, 1.1], sun: [0xfff1d0, 2.3], pal: [0xff9ad0, 0x9ae6ff, 0xffe08a, 0xb6ffb0], sea: 0xff6ac8, foam: 0xffd0f0, deco: 'candy' },
  { name: 'Factory Frenzy', sky: [0x3a7aff, 0xa8d0ff, 0xffe8b8], fog: [0xe6ecff, 80, 480], hemi: [0xe8f0ff, 0xa0a080, 1.1], sun: [0xfff2d0, 2.3], pal: [0xff7a3a, 0xffd31a, 0x3a8aff, 0x4acf6a], sea: 0x6a7a9a, foam: 0xc8d0e8, deco: 'factory' },
  { name: 'Cloud Rush', sky: [0x2a3a9a, 0xff7a9a, 0xffd890], fog: [0xffc8a0, 90, 540], hemi: [0xffe0d0, 0x9a7aa0, 1.05], sun: [0xffd9a0, 2.3], stars: .25, pal: [0xffffff, 0xfff0b0, 0xffd6f0, 0xd6e8ff], sea: 0xb08aff, foam: 0xf0e0ff, deco: 'cloud' },
];
export const COURSES = [
  { id: 'candy', name: 'Candy Run', theme: 0, seed: 101, d: .25, blurb: 'Spinning bars, gaps and swinging hammers. A sweet warm-up!', recipe: ['runway:10', 'spinners:3', 'gaps:5', 'runway:8', 'gates:3', 'conveyor:28', 'hammers:3', 'runway:6', 'beams:2', 'spinners:2'] },
  { id: 'factory', name: 'Factory Frenzy', theme: 1, seed: 202, d: .55, blurb: 'Belts, pushers, ferries and crushing gates.', recipe: ['runway:8', 'conveyor:30', 'pistons:3', 'movers:2', 'runway:6', 'stairs:3', 'hammers:3', 'gates:3', 'gaps:4', 'pistons:2'] },
  { id: 'cloud', name: 'Cloud Rush', theme: 2, seed: 303, d: .9, blurb: 'The final! Trampolines, narrow beams and a gauntlet of everything.', recipe: ['runway:6', 'bounce:4', 'beams:2', 'spinners:2', 'movers:1', 'hammers:2', 'gaps:4', 'gates:3', 'conveyor:20', 'spinners:2'] },
];
const tint = (c, f) => { const r = ((c >> 16) & 255) * f, g = ((c >> 8) & 255) * f, b = (c & 255) * f; return (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255); };

// ---------------------------------------------------------------- generator
export function generateCourse(def) {
  const R = rng(def.seed), rr = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rr(a, b + 1)), th = THEMES[def.theme], d = def.d;
  const items = [], wps = [], segs = []; let u = 0, y = 0, fin = null;
  const col = () => tint(th.pal[Math.floor(R() * th.pal.length)], rr(.94, 1.06));
  const wp = (uu, vv, flag) => wps.push({ u: uu, v: vv, flag });
  function plat(u0, u1, v0, v1, yy, ex = {}) { const it = Object.assign({ k: 'plat', x: (v0 + v1) / 2, y: yy, z: -(u0 + u1) / 2, sx: v1 - v0, sz: u1 - u0, th: TH, col: col(), u0, u1, v0, v1 }, ex); items.push(it); return it; }
  const half = LANE / 2;
  const SEG = {
    start() { plat(-18, 6, -11, 11, 0, { big: true, start: true, safe: true }); u = 6; wp(6, 0); },
    runway(len) { plat(u, u + len, -half, half, y, { safe: true }); wp(u + len / 2, 0); u += len; },
    spinners(n) {
      const len = 6 + n * 15; plat(u, u + len, -half, half, y, { safe: true });
      for (let i = 0; i < n; i++) { const uc = u + 6 + 7.5 + i * 15, om = (R() < .5 ? 1 : -1) * rr(1.3, 1.7 + d * .5);
        items.push({ k: 'spin', kind: 'bar', c: [0, y + .85, -uc], len: LANE - 1.4, th: .8, wid: .7, omega: om, phase: R() * TAU, col: 0xff4a5a, u: uc });
        if (d > .6 && i % 2 === 1) items.push({ k: 'spin', kind: 'bar', c: [0, y + .85, -uc], len: LANE - 1.4, th: .8, wid: .7, omega: om, phase: R() * TAU + Math.PI / 2, col: 0xff4a5a, u: uc });
        wp(uc, 0); }
      u += len;
    },
    hammers(n) {
      const len = 8 + n * 14; plat(u, u + len, -half, half, y, { safe: true });
      for (let i = 0; i < n; i++) { const uc = u + 8 + 7 + i * 14, per = rr(3.0, 3.8) - d * .4;
        for (const [vx, ph] of [[-4.2, 0], [4.2, Math.PI]]) items.push({ k: 'spin', kind: 'hammer', c: [vx, y + 8.15, -uc], rod: 6.4, head: 1.7, amp: lerp(.85, 1.0, d), omega: TAU / per, phase: ph + i * 1.3, swing: [0, 0, -1], col: 0xff7a1a, u: uc });
        wp(uc, 0); }
      u += len;
    },
    pistons(n) {
      const len = 8 + n * 12; plat(u, u + len, -half, half, y, { safe: true });
      for (let i = 0; i < n; i++) { const uc = u + 8 + 6 + i * 12; for (const s of [-1, 1]) items.push({ k: 'mover', x: s * (half + .9), y: y + 2.4, z: -uc, sx: 3.0, sz: 2.6, th: 2.4, axis: [-s, 0, 0], amp: 5.2 + d * .8, period: rr(3.4, 4.2) - d * .4, phase: (i % 2) * .5 + (s > 0 ? .25 : 0), col: 0xffd31a, wall: true, u: uc }); wp(uc, 0); }
      u += len;
    },
    gates(n) {
      const len = 8 + n * 15; plat(u, u + len, -half, half, y, { safe: true });
      for (let i = 0; i < n; i++) { const uc = u + 8 + 7.5 + i * 15, per = rr(4.2, 5.0) - d * .5;
        for (let k = 0; k < 3; k++) items.push({ k: 'mover', x: (k - 1) * 5.0, y: y + 3.0, z: -uc, sx: 4.7, sz: 1.5, th: 3.0, axis: [1, 0, 0], amp: 3.0, period: per, phase: (k * .34 + i * .17) % 1, col: tint(th.pal[(k + i) % th.pal.length], 1.0), wall: true, u: uc }); wp(uc, 0); }
      u += len;
    },
    gaps(n) {
      let v = 0; plat(u, u + 4, -half, half, y, { safe: true }); u += 4;
      for (let i = 0; i < n; i++) {
        const gap = rr(2.6, 3.4 + 1.5 * d), len = rr(3.6, 6), wid = rr(5, 9), nv = clamp(v + rr(-4, 4), -half + wid / 2, half - wid / 2), dy = rr(-.25, .35), cr = d > .4 && R() < .08 + d * .1;
        u += gap; const it = plat(u, u + len, nv - wid / 2, nv + wid / 2, y + dy, cr ? { crumble: true } : { safe: true }); wp(u + len / 2, nv, 'hop'); u += len; v = nv; y += dy * .4;
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
        if (d > .8 && i === n - 1) items.push({ k: 'spin', kind: 'bar', c: [0, y + .85, -(u + len / 2)], len: LANE - 1.6, th: .8, wid: .7, omega: (R() < .5 ? 1 : -1) * rr(1.0, 1.25), phase: R() * TAU, col: 0xff4a5a, u: u + len / 2 });
        wp(u + len / 2, vs[ri(0, 2)], 'beam'); u += len;
        plat(u, u + 4, -half, half, y, { safe: true }); wp(u + 2, 0); u += 4;
      }
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
const chevTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#3d3d5c'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#ffd34e'; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(20, 12); x.lineTo(46, 32); x.lineTo(20, 52); x.stroke(); const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; return tx; })();
const platMat = toon(0xffffff); platMat.userData.shared = true;
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); glowMat.userData.shared = true;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class Course {
  constructor(spec) {
    this.spec = spec; this.group = new THREE.Group(); scene.add(this.group); this.movers = []; this.crumbles = []; this.spins = []; this.belts = []; this.boxes = [];
    const items = spec.items, count = k => items.filter(i => i.k === k).length, nS = items.filter(i => i.k === 'plat' && !i.crumble).length, nC = items.filter(i => i.k === 'plat' && i.crumble).length;
    this.bStatic = new Batch(platMat, nS + 8, true); this.bCrumble = new Batch(platMat, nC + 2, true); this.bMover = new Batch(platMat, count('mover') + 2, true); this.bGlow = new Batch(glowMat, nS + nC + 80, false);
    for (const it of items) { if (it.k === 'plat') this.addPlat(it); else if (it.k === 'mover') this.addMover(it); else if (it.k === 'spin') this.addSpin(it); }
    this.ferries = this.movers.filter(m => m.ferry); this.buildDecor();
  }
  addPlat(it) {
    const b = world.add({ minX: it.x - it.sx / 2, maxX: it.x + it.sx / 2, minY: it.y - it.th, maxY: it.y, minZ: it.z - it.sz / 2, maxZ: it.z + it.sz / 2, kind: 'plat', it, conv: it.convDir || null, bounce: it.bounce || 0, crumble: !!it.crumble, fin: !!it.fin, safe: !!it.safe }); it.box = b; this.boxes.push(b);
    const batch = it.crumble ? this.bCrumble : this.bStatic; it.bi = batch.add(it.x, it.y - it.th / 2, it.z, it.sx, it.th, it.sz, it.col); it.batch = batch;
    if (it.crumble) { it.cs = { phase: 'idle', t: 0, y: 0 }; this.crumbles.push(it); }
    if (it.bounce) this.bGlow.add(it.x, it.y + .06, it.z, it.sx - .6, .14, it.sz - .6, 0xffffff);
    if (it.big && !it.start) this.bGlow.add(it.x, it.y + .05, it.z, it.sx - .6, .12, it.sz - .6, it.fin ? 0xffd34e : 0x6affb0);
    if (it.start) { for (let k = 0; k < 6; k++) this.bGlow.add(-8 + k * 3.2 + 1.6, it.y + .05, -2, 1.6, .1, .4, 0xffffff); }
    if (it.beam) this.bGlow.add(it.x, it.y + .03, it.z, .3, .05, it.sz - .5, 0xffffff);
    if (it.convDir) {
      const tex = chevTex.clone(); tex.needsUpdate = true; tex.repeat.set(it.len / 2.2, 1); const g = new THREE.Group(), plane = new THREE.Mesh(new THREE.PlaneGeometry(it.len - .3, it.wid - .3), new THREE.MeshBasicMaterial({ map: tex })), d = it.convDir, mag = Math.hypot(d[0], d[1]) || 1;
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
    for (let i = 0; i < 70; i++) {
      const uu = R() * (L + 40) - 20, side = R() < .5 ? -1 : 1, vv = side * (16 + R() * 70), z = -uu, s = 1 + R() * 2.4, pc = th.pal[Math.floor(R() * th.pal.length)];
      if (style === 'candy') { add(T(new THREE.CylinderGeometry(.35 * s, .35 * s, 7 * s, 8), vv, 3.5 * s - 3, z), 0xffffff); const ball = new THREE.SphereGeometry(2 * s, 14, 10); ball.scale(1, 1, .45); add(T(ball, vv, 7.8 * s - 3, z), pc); }
      else if (style === 'factory') { add(T(new THREE.CylinderGeometry(1.6 * s, 2 * s, 12 * s, 10), vv, 6 * s - 6, z), tint(pc, .85)); add(T(new THREE.CylinderGeometry(1.9 * s, 1.9 * s, 1.2 * s, 10), vv, 12.4 * s - 6, z), 0x3a2f58); }
      else { const cg = new THREE.IcosahedronGeometry(3 * s, 1); cg.scale(1.4, .8, 1); add(T(cg, vv, R() * 18 - 10, z), 0xffffff); const c2 = new THREE.IcosahedronGeometry(2 * s, 1); add(T(c2, vv + 3 * s, R() * 18 - 9, z + 2), 0xffffff); }
    }
    // merge it all into one mesh
    const pos = [], nor = [], colr = [], cc = new THREE.Color();
    for (const [geo, color] of list) { const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position.array, n = g.attributes.normal.array; cc.set(color); for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) colr.push(cc.r, cc.g, cc.b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    const dm = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true })); dm.castShadow = QL.shadow > 0; this.group.add(dm); this.decor = dm;
    // goo sea
    const sea = new THREE.Mesh(new THREE.CircleGeometry(1200, 40), toon(th.sea)); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -13, -L / 2); this.group.add(sea); this.sea = sea;
    this.trophy = new THREE.Group(); const gold = toon(0xffd34e); const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, .5, 16), gold), stem = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, 1.2, 12), gold), cup = new THREE.Mesh(new THREE.CylinderGeometry(1.2, .6, 1.5, 16), gold); base.position.y = .25; stem.position.y = 1.1; cup.position.y = 2.3; this.trophy.add(base, stem, cup); this.trophy.position.set(0, this.fin.y, -(sp.finishU + 14)); this.group.add(this.trophy);
  }
  skyFor() { blendSky(this.spec.theme, this.spec.theme, 0); }
  // t = race clock in seconds
  update(t, dt) {
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
    return null;
  }
  dispose() { scene.remove(this.group); for (const b of [this.bStatic, this.bCrumble, this.bMover, this.bGlow]) { scene.remove(b.im); b.im.dispose(); if (b.hull) { scene.remove(b.hull); b.hull.dispose(); } } this.decor.geometry.dispose(); world.clear(); }
}
