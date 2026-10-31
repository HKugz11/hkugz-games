// preview.js - the little spinning 3D picture of an item in the shop. It has its own small canvas and renderer, used only while the shop is open.
// Gear is shown ON a diver (so you can see the flippers on the feet, the tank on the back...). Supplies are shown on their own.
import * as THREE from './three.module.min.js';
import { Diver } from './diver.js?v=2';

const m = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });

// where to look for each kind of item, in the diver's own coordinates (the diver is swimming, nose along +Z)
const FOCUS = {
  suit: { at: [0, 0, -0.1], dist: 3.7 }, flippers: { at: [0, 0, -1.25], dist: 2.7 }, tank: { at: [0, 0.2, 0.05], dist: 2.5 }, net: { at: [0.3, 0, 1.15], dist: 3.0 },
  light: { at: [0, 0.15, 0.55], dist: 1.9 }, bag: { at: [0.3, -0.05, -0.2], dist: 2.2 }, gun: { at: [0.3, 0, 0.9], dist: 2.9 }, quiver: { at: [0, 0.05, -0.35], dist: 2.4 },
};

export class ItemPreview {
  constructor(canvas) { this.canvas = canvas; this.renderer = null; this.running = false; this.last = 0; }

  init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xdff4ff, 0x5a7a90, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(2, 3, 3); this.scene.add(sun);
    this.cam = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    this.spin = new THREE.Group(); this.offset = new THREE.Group(); this.spin.add(this.offset); this.scene.add(this.spin);
    this.diver = new Diver(); this.diver.setPose('swim'); this.offset.add(this.diver.group);
    this.extra = null;
  }

  // show item `i` of category `cat` ('suit', 'tank'... or 'spears' / 'repel' for supplies)
  show(cat, i) {
    if (!this.renderer) this.init();
    if (this.extra) { this.offset.remove(this.extra); this.extra = null; }
    this.spin.rotation.set(0, 0.6, 0);
    if (FOCUS[cat]) {
      const g = { suit: 0, flippers: 0, tank: 0, light: 0, bag: 0, gun: 0, net: 0, quiver: 0, [cat]: i };
      this.diver.group.visible = true;
      this.diver.setGear(g); this.diver.setTool(cat === 'gun' && i > 0 ? 'spear' : 'net');
      const f = FOCUS[cat];
      this.offset.position.set(-f.at[0] * 0.8, -f.at[1] * 0.8, -f.at[2] * 0.8); this.dist = f.dist * 0.8;
    } else {
      this.diver.group.visible = false;
      this.extra = cat === 'spears' ? spearBundle() : repelBottle();
      this.offset.add(this.extra); this.offset.position.set(0, 0, 0); this.dist = 3.2;
    }
    this.cam.position.set(0, this.dist * 0.22, this.dist); this.cam.lookAt(0, 0, 0);
    this.resize();
  }
  resize() {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || 280, h = this.canvas.clientHeight || 280;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = now => { if (!this.running) return; requestAnimationFrame(loop); this.tick((now - this.last) / 1000); this.last = now; }; requestAnimationFrame(loop); }
  stop() { this.running = false; }
  tick(dt) {
    if (!this.renderer) return;
    dt = Math.min(dt, 0.05);
    this.spin.rotation.y += dt * 0.9;
    this.diver.update(dt, 0.15);
    this.renderer.render(this.scene, this.cam);
  }
}

function spearBundle() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), m(0xc8d0d8)));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), m(0xffffff)); tip.position.y = 0.9; s.add(tip);
    s.position.set((i - 2) * 0.13, 0, ((i % 2) - 0.5) * 0.12); s.rotation.z = (i - 2) * 0.05; g.add(s);
  }
  g.rotation.z = 0.5; return g;
}
function repelBottle() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 1.1, 14), m(0x2fb8c8)));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.4, 14), m(0xffffff)); band.position.y = 0.05; g.add(band);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.3, 12), m(0x2fb8c8)); neck.position.y = 0.7; g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 12), m(0xe8453c)); cap.position.y = 0.96; g.add(cap);
  g.rotation.z = -0.15; return g;
}
