// diver.js - the little diver you play. The gear you buy shows up on the model: flippers on the feet, bigger tanks, a wetsuit,
// a thermal suit, then a full suit of deep-sea armour. Built from simple shapes.
// The model is "lying flat", swimming: it looks along +Z, its back (and tank) is +Y, its left/right is X.
import * as THREE from './three.module.min.js';
import { mat, poly } from './util.js?v=2';

const m = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone2 = (r, len) => new THREE.ConeGeometry(r, len, 5);
const caps = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 8).rotateX(Math.PI / 2);   // a capsule lying along Z

export class Diver {
  constructor() {
    this.group = new THREE.Group();
    this.pose = new THREE.Group();            // rotated to lie flat (swim) or stand up (on the boat)
    this.group.add(this.pose);
    this.t = 0; this.kick = 0; this.swingT = 1; this.recoil = 0; this.mode = 'swim';

    // materials we recolour when the suit changes
    this.skin = m(0xf0b48a); this.torsoM = m(0xe8453c); this.limbM = this.skin; this.accent = m(0x39d6ee);
    this.shortsM = m(0xe8453c);
    const dark = m(0x23262e), glass = m(0x6fd8ff, { transparent: true, opacity: 0.55 });
    const P = this.pose;
    const add = (geo, material, x, y, z, parent = P) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); parent.add(o); return o; };

    // ---- body
    this.torso = add(box(0.46, 0.24, 0.58), this.torsoM, 0, 0, 0.02);
    this.hips = add(box(0.4, 0.22, 0.2), this.shortsM, 0, 0, -0.34);
    this.head = new THREE.Group(); this.head.position.set(0, 0.0, 0.46); P.add(this.head);
    add(new THREE.SphereGeometry(0.15, 12, 10), this.skin, 0, 0, 0, this.head);
    this.hair = add(new THREE.SphereGeometry(0.158, 12, 8, 0, 6.283, 0, 1.45), m(0x3a2a1e), 0, 0.01, -0.01, this.head);
    this.hood = add(new THREE.SphereGeometry(0.165, 12, 10), m(0x1d6a73), 0, 0, -0.01, this.head);
    add(box(0.24, 0.1, 0.07), dark, 0, -0.02, 0.13, this.head);                  // mask frame
    add(box(0.2, 0.07, 0.075), glass, 0, -0.02, 0.135, this.head);                // mask glass
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.07, 6).rotateX(Math.PI / 2), dark, 0, -0.1, 0.12, this.head);   // mouthpiece
    this.lamp = add(new THREE.CylinderGeometry(0.035, 0.045, 0.1, 8).rotateX(Math.PI / 2), m(0x333b48), 0, 0.13, 0.1, this.head);
    this.lampLens = add(new THREE.CircleGeometry(0.035, 8), new THREE.MeshBasicMaterial({ color: 0xfff7c0 }), 0, 0.13, 0.152, this.head);
    this.helmet = add(new THREE.SphereGeometry(0.27, 14, 10), m(0x9fe4ff, { transparent: true, opacity: 0.32, depthWrite: false }), 0, 0, 0.02, this.head);
    this.collar = add(new THREE.TorusGeometry(0.2, 0.05, 6, 14).rotateX(Math.PI / 2), m(0xaab6c4), 0, -0.04, -0.12, this.head);

    // ---- arms (pivot at the shoulder)
    const arm = (side, forward) => {
      const g = new THREE.Group(); g.position.set(side * 0.3, 0, 0.2); P.add(g);
      const len = 0.4;
      const a = add(caps(0.07, len), this.limbM, 0, 0, forward ? len / 2 : -len / 2, g);
      const hand = add(new THREE.SphereGeometry(0.085, 8, 6), this.skin, 0, 0, forward ? len + 0.07 : -len - 0.07, g);
      const glove = add(new THREE.SphereGeometry(0.1, 8, 6), m(0xff8a3a), 0, 0, forward ? len + 0.07 : -len - 0.07, g);
      return { g, a, hand, glove };
    };
    this.armL = arm(-1, false); this.armR = arm(1, true);
    this.armR.g.rotation.y = -0.12;

    // ---- legs (pivot at the hip) with flippers
    const leg = side => {
      const g = new THREE.Group(); g.position.set(side * 0.11, 0, -0.44); P.add(g);
      const a = add(caps(0.085, 0.5), this.limbM, 0, 0, -0.3, g);
      const foot = add(box(0.13, 0.07, 0.2), this.skin, 0, 0, -0.66, g);
      const boot = add(box(0.15, 0.09, 0.22), dark, 0, 0, -0.66, g);
      const fin = new THREE.Group(); fin.position.set(0, 0, -0.68); g.add(fin);
      const finM = m(0x2a8cff, { side: THREE.DoubleSide });
      add(poly([[-0.07, 0, 0], [0.07, 0, 0], [0.18, 0, -0.52], [0, 0, -0.58], [-0.18, 0, -0.52]]), finM, 0, 0, 0, fin);
      const jet = add(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 6).rotateX(Math.PI / 2), m(0xffb03a, { emissive: 0xff7a1a }), 0, 0.05, -0.3, fin);
      return { g, a, foot, boot, fin, finM, jet };
    };
    this.legL = leg(-1); this.legR = leg(1);

    // ---- stripes for the wetsuit, armour plates for the deep-sea suit
    this.stripes = new THREE.Group(); P.add(this.stripes);
    for (const s of [-1, 1]) {
      add(box(0.025, 0.255, 0.5), this.accent, s * 0.14, 0, 0.02, this.stripes);
      add(box(0.02, 0.18, 0.5), this.accent, s * 0.115, 0, -0.55, this.stripes);
    }
    this.armor = new THREE.Group(); P.add(this.armor);
    const steel = m(0x93a0b0), steel2 = m(0x6c7888), glowM = new THREE.MeshBasicMaterial({ color: 0xff9a3a });
    add(box(0.5, 0.1, 0.46), steel, 0, 0.16, 0.05, this.armor);                  // back plate
    add(box(0.5, 0.06, 0.42), steel, 0, -0.14, 0.05, this.armor);                // chest plate
    add(new THREE.SphereGeometry(0.13, 8, 6), steel, -0.3, 0.02, 0.2, this.armor);
    add(new THREE.SphereGeometry(0.13, 8, 6), steel, 0.3, 0.02, 0.2, this.armor);   // shoulders
    add(box(0.12, 0.03, 0.12), glowM, 0, -0.18, 0.15, this.armor);               // glowing core
    add(box(0.14, 0.12, 0.26), steel2, -0.11, 0.0, -0.64, this.armor);
    add(box(0.14, 0.12, 0.26), steel2, 0.11, 0.0, -0.64, this.armor);            // knee guards

    // ---- the air tank, on the back
    this.tank = new THREE.Group(); this.tank.position.set(0, 0.22, 0.0); P.add(this.tank);
    this.tankMat = m(0xb8c0c8);
    this.tankBody = [];
    for (const x of [-0.1, 0.1]) { const t = add(new THREE.CylinderGeometry(0.1, 0.1, 0.62, 10).rotateX(Math.PI / 2), this.tankMat, x, 0, -0.02, this.tank); this.tankBody.push(t);
      add(new THREE.SphereGeometry(0.1, 10, 6, 0, 6.283, 0, 1.57).rotateX(Math.PI / 2), this.tankMat, x, 0, 0.29, this.tank);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), dark, x, 0, 0.35, this.tank); }
    this.tankBody[1].userData.second = true;
    this.strap = add(box(0.46, 0.02, 0.06), dark, 0, -0.08, 0.05, this.tank);

    // ---- the fish bag on the hip
    this.bag = new THREE.Group(); this.bag.position.set(0.27, -0.03, -0.2); P.add(this.bag);
    this.bagM = m(0xff9a3a, { transparent: true, opacity: 0.9 });
    this.bagBox = add(box(0.16, 0.16, 0.2), this.bagM, 0, -0.1, 0, this.bag);

    // ---- the spear belt around the hips (more spears for each belt)
    this.belt = new THREE.Group(); this.belt.position.set(0, 0, -0.36); P.add(this.belt);
    add(box(0.5, 0.26, 0.07), m(0x3a3028), 0, 0, 0, this.belt);
    for (let i = 0; i < 8; i++) { const a = -0.19 + i * 0.054; add(cone2(0.02, 0.14), m(0xe8eef4), a, 0.17, 0.0, this.belt); }

    // ---- what you hold: the net, or the spear gun (both fixed to the right hand)
    this.hold = new THREE.Group(); this.hold.position.set(0.3, 0, 0.67); this.pose.add(this.hold);
    this.netG = new THREE.Group(); this.hold.add(this.netG);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6).rotateX(Math.PI / 2), m(0x8a5a3a), 0, 0, 0.35, this.netG);
    this.hoop = add(new THREE.TorusGeometry(0.28, 0.025, 6, 20), m(0xd0d8e0), 0, 0, 0.85, this.netG);
    this.hoopM = this.hoop.material;
    this.netCone = add(new THREE.ConeGeometry(0.28, 0.5, 10, 1, true).rotateX(-Math.PI / 2), m(0xffffff, { transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0.6, this.netG);
    this.gunG = new THREE.Group(); this.gunG.visible = false; this.hold.add(this.gunG);
    this.gunM = m(0x8c96a0);
    add(box(0.09, 0.12, 0.5), this.gunM, 0, 0, 0.18, this.gunG);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8).rotateX(Math.PI / 2), this.gunM, 0, 0.06, 0.5, this.gunG);
    add(box(0.07, 0.16, 0.08), m(0x3a3028), 0, -0.12, 0.0, this.gunG);
    this.spearTip = add(new THREE.ConeGeometry(0.035, 0.22, 6).rotateX(Math.PI / 2), m(0xe8eef4), 0, 0.06, 1.0, this.gunG);
    this.spearShaft = add(new THREE.CylinderGeometry(0.013, 0.013, 0.7, 5).rotateX(Math.PI / 2), m(0xb0b8c0), 0, 0.06, 0.64, this.gunG);

    this.gear = { suit: 0, flippers: 0, tank: 0, light: 0, bag: 0, gun: 0, net: 0 };
    this.setGear(this.gear);
    this.setPose('swim');
    this.group.scale.setScalar(0.8);              // about 1.8 m from nose to flipper tips
  }

  // Dress the diver in what the player owns. g = { suit, flippers, tank, light, bag, gun, net } (all levels)
  setGear(g) {
    this.gear = { ...g };
    const s = g.suit;
    const SUITS = [
      { torso: 0xe8453c, limb: null, shorts: 0xe8453c },
      { torso: 0x20232c, limb: 0x20232c, shorts: 0x20232c },
      { torso: 0x1d6a73, limb: 0x1d6a73, shorts: 0x15555d },
      { torso: 0x7e8a9a, limb: 0x8d99a8, shorts: 0x6c7888 },
    ][s];
    this.torsoM.color.set(SUITS.torso);
    this.shortsM.color.set(SUITS.shorts);
    const limbColor = SUITS.limb === null ? 0xf0b48a : SUITS.limb;
    for (const a of [this.armL.a, this.armR.a, this.legL.a, this.legR.a]) {
      if (!a.userData.own) { a.material = a.material.clone(); a.userData.own = 1; }
      a.material.color.set(limbColor);
      a.scale.setScalar(s === 3 ? 1.28 : 1);
    }
    this.hood.visible = s === 2; this.hair.visible = s < 2;
    this.stripes.visible = s === 1;
    this.armor.visible = s === 3; this.helmet.visible = s === 3; this.collar.visible = s === 3;
    for (const a of [this.armL, this.armR]) { a.glove.visible = s === 2; a.hand.visible = s < 2; }
    if (s === 3) { for (const a of [this.armL, this.armR]) { a.glove.visible = true; a.glove.material.color.set(0x5c6674); } }
    else for (const a of [this.armL, this.armR]) a.glove.material.color.set(0xff8a3a);
    this.torso.scale.setScalar(s === 3 ? 1.15 : 1);

    // flippers: none at first (bare feet); each level has its own colour
    const f = g.flippers;
    const FIN = [0, 0x2a8cff, 0x28c76a, 0xff8a2a, 0xffd23c];
    for (const l of [this.legL, this.legR]) {
      l.fin.visible = f > 0; l.foot.visible = f === 0 && s < 3; l.boot.visible = f > 0 || s === 3;
      if (f > 0) l.finM.color.set(FIN[f]);
      l.jet.visible = f === 4;
      l.fin.scale.set(1, 1, 1 + 0.08 * f);
    }
    // the tank gets bigger and changes colour
    const TANK = [{ c: 0xb8c0c8, r: 0.78, l: 0.7, twin: false }, { c: 0xffd23c, r: 1.0, l: 0.9, twin: false }, { c: 0xffd23c, r: 1.0, l: 1.0, twin: true },
      { c: 0xff8a2a, r: 1.1, l: 1.08, twin: true }, { c: 0xe8453c, r: 1.3, l: 1.2, twin: true }][g.tank];
    this.tankMat.color.set(TANK.c);
    this.tank.scale.set(TANK.r, TANK.r, TANK.l);
    this.tankBody[1].visible = TANK.twin;
    this.tank.children.forEach(c => { if (c.position.x > 0.05 && !TANK.twin) c.visible = false; else c.visible = true; });
    this.tank.position.y = 0.2 + 0.03 * g.tank;
    this.tank.position.x = TANK.twin ? 0 : 0.1;
    // flashlight on the head
    this.lamp.visible = this.lampLens.visible = g.light > 0;
    // bag grows with each level
    const bs = [0.8, 1.0, 1.25, 1.55, 1.9][g.bag];
    this.bag.scale.setScalar(bs); this.bagM.color.set([0xff9a3a, 0xff7a4a, 0x59c26a, 0x4ea8e8, 0x9ae8ff][g.bag]);
    // spear gun colour
    this.gunM.color.set([0x8c96a0, 0x8c96a0, 0x8a5a3a, 0x4a8ccf, 0xffc21a][g.gun]);
    // the net grows and changes colour with each item; the flashlight gets bigger; the spear belt gets more spears
    this.netG.scale.setScalar([0.85, 1.0, 1.15, 1.4][g.net]); this.hoopM.color.set([0xd0d8e0, 0x6ac8ff, 0x7dff9a, 0xffd34e][g.net]);
    this.lamp.scale.setScalar(0.8 + 0.2 * g.light); this.lampLens.material.color.set([0xfff7c0, 0xfff7c0, 0xdff4ff, 0xbfe8ff, 0xffffff][g.light]);
    this.belt.visible = (g.quiver || 0) > 0; this.belt.children.forEach((c, i) => { if (i > 0) c.visible = i <= [0, 3, 5, 8][g.quiver || 0]; });
    this.setTool(this.tool || 'net');
    this._mats = null;
  }

  // In the dark the diver would be a black shape. This lets the suit glow a little by itself (k = 0..1).
  setGlow(k) {
    if (!this._mats) { const set = new Set(); this.group.traverse(o => { if (o.isMesh && o.material.isMeshLambertMaterial) set.add(o.material); }); this._mats = [...set]; }
    for (const m of this._mats) { if (!m.userData.base) m.userData.base = m.color.clone(); m.emissive.copy(m.userData.base).multiplyScalar(k); }
  }

  setTool(t) {
    this.tool = t;
    this.netG.visible = t === 'net';
    this.gunG.visible = t === 'spear' && this.gear.gun > 0;
  }
  swing() { this.swingT = 0; }
  fire() { this.recoil = 1; }
  setLoaded(v) { this.spearTip.visible = this.spearShaft.visible = v; }

  setPose(p) {
    this.mode = p;
    this.pose.rotation.set(p === 'stand' ? -Math.PI / 2 : 0, 0, 0);
    this.pose.position.set(0, p === 'stand' ? 0.9 : 0, 0);
  }

  // speed01: 0 (floating) .. 1 (full speed)
  update(dt, speed01) {
    this.t += dt;
    const k = Math.min(1, dt * 8);
    this.kick += (speed01 - this.kick) * k;
    const rate = 5 + this.kick * 6, ph = this.t * rate;
    const amp = this.mode === 'stand' ? 0.05 : 0.08 + 0.34 * this.kick;
    this.legL.g.rotation.x = Math.sin(ph) * amp;
    this.legR.g.rotation.x = Math.sin(ph + Math.PI) * amp;
    // arms sway a little; the right arm lifts when swinging the net
    this.armL.g.rotation.x = -0.15 + Math.sin(ph * 0.5) * 0.06;
    this.swingT = Math.min(1, this.swingT + dt * 3.2);
    const sw = Math.sin(this.swingT * Math.PI);                 // 0 -> 1 -> 0
    this.hold.rotation.set(0.25 * sw - 0.05, (this.swingT < 1 ? (0.9 - 1.8 * this.swingT) : 0), 0);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.hold.position.z = 0.67 - this.recoil * 0.12;
    this.pose.position.y = (this.mode === 'stand' ? 0.9 : 0) + Math.sin(this.t * 1.6) * 0.02;
    this.torso.position.y = Math.sin(ph * 0.5) * 0.01 * this.kick;
  }
}
