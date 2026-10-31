// boat.js - your home base: a little dive boat floating on the ocean. It bobs on the waves and has a ladder, a dive flag,
// an aquarium on the deck, and an anchor line down to the seabed.
import * as THREE from './three.module.min.js';
import { mat } from './util.js?v=2';
import { heightAt } from './world.js?v=2';

const m = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });

// The boat is 10 m long: the bow (front) points to +X, the stern (back, with the ladder) to -X.
export class Boat {
  constructor() {
    this.group = new THREE.Group();
    const G = this.group;
    const add = (geo, material, x, y, z, parent = G) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); parent.add(o); return o; };

    // ---- the hull: an outline (seen from above) pushed up into a solid shape
    const outline = (k = 1) => {
      const s = new THREE.Shape();
      s.moveTo(-4.5 * k, -1.5 * k); s.lineTo(-4.5 * k, 1.5 * k); s.lineTo(2.2 * k, 1.75 * k);
      s.quadraticCurveTo(4.6 * k, 1.3 * k, 5.6 * k, 0); s.quadraticCurveTo(4.6 * k, -1.3 * k, 2.2 * k, -1.75 * k); s.lineTo(-4.5 * k, -1.5 * k);
      return s;
    };
    const slab = (k, y0, h, color) => {
      const geo = new THREE.ExtrudeGeometry(outline(k), { depth: h, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2).translate(0, y0, 0);
      return add(geo, m(color), 0, 0, 0);
    };
    slab(1, -0.95, 0.85, 0xc0392b);              // under the water: red
    slab(1.002, -0.1, 1.02, 0xf6f8fa);          // above the water: white
    slab(1.012, 0.38, 0.14, 0x2a8cff);           // blue stripe
    slab(0.95, 0.86, 0.07, 0xc99a62);            // the wooden deck (slightly smaller, sits inside the hull walls)
    const deckY = 0.93;

    // ---- cabin with windows and a red roof
    add(new THREE.BoxGeometry(2.4, 1.5, 2.3), m(0xf6f8fa), 2.0, deckY + 0.75, 0);
    add(new THREE.BoxGeometry(2.8, 0.14, 2.7), m(0xe8453c), 2.0, deckY + 1.57, 0);
    const win = m(0x2b4a6a);
    add(new THREE.BoxGeometry(0.05, 0.55, 1.5), win, 3.22, deckY + 0.95, 0);
    for (const z of [-1.16, 1.16]) add(new THREE.BoxGeometry(1.4, 0.5, 0.05), win, 2.0, deckY + 0.95, z);
    add(new THREE.BoxGeometry(0.05, 1.1, 0.7), m(0x8a5a3a), 0.78, deckY + 0.55, 0);      // door
    // mast, flag and a radar dome
    add(new THREE.CylinderGeometry(0.05, 0.07, 3.0, 6), m(0xc8d0d8), 2.2, deckY + 3.0, 0);
    add(new THREE.SphereGeometry(0.22, 8, 6), m(0xf6f8fa), 1.4, deckY + 1.8, 0);
    const fc = document.createElement('canvas'); fc.width = 128; fc.height = 86;
    const fg = fc.getContext('2d'); fg.fillStyle = '#e8352c'; fg.fillRect(0, 0, 128, 86);
    fg.strokeStyle = '#fff'; fg.lineWidth = 16; fg.beginPath(); fg.moveTo(-10, 96); fg.lineTo(138, -10); fg.stroke();
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
    this.flag = add(new THREE.PlaneGeometry(1.1, 0.74), new THREE.MeshLambertMaterial({ map: ft, side: THREE.DoubleSide }), 2.2 - 0.55, deckY + 4.2, 0);
    this.flag.geometry.translate(0.55, 0, 0);
    this.flag.position.x = 2.2;

    // ---- the aquarium (a glass tank of water on the deck; the fish inside are added in setAquarium)
    this.tankG = new THREE.Group(); this.tankG.position.set(-2.0, deckY, 0); G.add(this.tankG);
    add(new THREE.BoxGeometry(2.0, 0.08, 1.0), m(0x4a5568), 0, 0.04, 0, this.tankG);
    this.tankWater = add(new THREE.BoxGeometry(1.9, 0.95, 0.9), new THREE.MeshLambertMaterial({ color: 0x4ad0ee, transparent: true, opacity: 0.34, depthWrite: false }), 0, 0.57, 0, this.tankG);
    add(new THREE.BoxGeometry(1.9, 0.12, 0.9), m(0xe8d49a), 0, 0.14, 0, this.tankG);
    const frame = m(0xdfe6ee);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.06, 1.08, 0.06), frame, sx * 0.97, 0.58, sz * 0.47, this.tankG);
    add(new THREE.BoxGeometry(2.0, 0.05, 1.0), frame, 0, 1.12, 0, this.tankG);
    this.aqFish = new THREE.Group(); this.tankG.add(this.aqFish);

    // ---- stuff on deck: crates, barrels, dive tanks, a life ring, a rope coil
    add(new THREE.BoxGeometry(0.8, 0.6, 0.8), m(0xb07a44), -3.8, deckY + 0.3, 0.85);
    add(new THREE.BoxGeometry(0.6, 0.5, 0.6), m(0xc99a62), -3.7, deckY + 0.85, 0.85);
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.75, 10), m(0x2a8cff), -3.8, deckY + 0.38, -0.95);
    for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), m([0xffd23c, 0xffffff, 0xffd23c][i]), -0.9 + i * 0.28, deckY + 0.4, -1.3).rotation.z = 0.12;
    const ring = add(new THREE.TorusGeometry(0.3, 0.09, 8, 16), m(0xff6a2a), 2.9, deckY + 0.9, 1.19); ring.rotation.y = 0;
    add(new THREE.TorusGeometry(0.2, 0.07, 6, 12).rotateX(Math.PI / 2), m(0xe8e0c8), -1.3, deckY + 0.07, 1.05);

    // ---- railings around the back deck
    const rail = m(0xdfe6ee);
    for (const z of [-1.42, 1.42]) {
      for (let x = -4.2; x <= 0.5; x += 1.175) add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), rail, x, deckY + 0.35, z);
      add(new THREE.BoxGeometry(4.8, 0.04, 0.04), rail, -1.85, deckY + 0.7, z);
    }
    add(new THREE.BoxGeometry(0.04, 0.04, 2.8), rail, -4.3, deckY + 0.7, 0);
    for (const z of [-0.9, 0, 0.9]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), rail, -4.3, deckY + 0.35, z);

    // ---- the stern: a swim platform and a ladder into the water
    add(new THREE.BoxGeometry(1.0, 0.08, 2.4), m(0xc99a62), -5.0, -0.12, 0);
    this.ladder = new THREE.Group(); this.ladder.position.set(-5.35, 0, 0.85); G.add(this.ladder);
    for (const z of [-0.25, 0.25]) add(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), m(0xc8d0d8), 0, -0.2, z, this.ladder);
    for (let y = 0.8; y > -1.3; y -= 0.38) add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5).rotateX(Math.PI / 2), m(0xc8d0d8), 0, y, 0, this.ladder);

    // ---- anchor line (lives in the world, not on the bobbing boat)
    this.anchor = new THREE.Group();
    const ax = 6.5, az = 0.4, ay = heightAt(ax, az);
    const a = new THREE.Vector3(5.2, 0.3, 0), b = new THREE.Vector3(ax, ay + 0.3, az);
    const len = a.distanceTo(b);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), m(0xcdb78a));
    rope.position.copy(a).add(b).multiplyScalar(0.5);
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.anchor.add(rope);
    const anc = new THREE.Group(); anc.position.set(ax, ay, az); this.anchor.add(anc);
    const steel = m(0x5a6674);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), steel, 0, 0.6, 0, anc);
    add(new THREE.BoxGeometry(0.9, 0.08, 0.08), steel, 0, 1.0, 0, anc);
    add(new THREE.TorusGeometry(0.5, 0.06, 6, 12, 3.14).rotateZ(3.14), steel, 0, 0.15, 0, anc);
    add(new THREE.TorusGeometry(0.1, 0.03, 6, 8), steel, 0, 1.25, 0, anc);

    this.t = 0;
  }

  // Show the fish you have discovered swimming in the deck aquarium. kinds = [{ mesh }] already built (instanced, 1 each); see game.js.
  setAquariumFish(list) {
    this.aqFish.clear();
    for (const f of list) this.aqFish.add(f);
  }

  update(dt, t) {
    this.t = t;
    this.group.position.y = Math.sin(t * 0.9) * 0.05;
    this.group.rotation.z = Math.sin(t * 0.7) * 0.014;
    this.group.rotation.x = Math.sin(t * 0.6 + 1) * 0.01;
    this.flag.rotation.y = Math.sin(t * 2.4) * 0.35;
  }

  // Where the player can climb back aboard (the stern ladder), in world coordinates
  get ladderPos() { return new THREE.Vector3(-5.9, 0, 0.85); }
  // Where the diver stands on deck in the boat menu
  get deckSpot() { return new THREE.Vector3(-0.2, this.group.position.y + 0.95, -0.55); }

  // The hull is solid: swimmers bump into it instead of passing through. Pushes pos out; returns true if it did.
  hullCollide(pos, r, vel) {
    const x = pos.x, y = pos.y, z = pos.z;
    if (y > 1.2 + r || y < -1.05 - r || x < -4.6 - r || x > 5.7 + r) return false;
    const hw = x > 2.2 ? Math.max(0, 1.75 * (1 - (x - 2.2) / 3.5)) : 1.7;
    const side = hw + r - Math.abs(z);
    if (side <= 0) return false;
    // choose the shortest way out: sideways, or down (when we come up from below)
    const down = y - (-1.05 - r);
    if (down < side && y < 0) { pos.y = -1.05 - r; if (vel && vel.y > 0) vel.y = 0; }
    else { pos.z += Math.sign(z || 1) * side; if (vel) vel.z = Math.sign(z || 1) * Math.max(0, vel.z * Math.sign(z || 1)); }
    return true;
  }
}
