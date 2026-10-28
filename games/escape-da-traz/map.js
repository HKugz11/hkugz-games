// ESCAPE DA TRAZ - the three wings: wall/pillar layout, patrol routes, shadow hiding spots and the lock at the end of each.
import { THREE, V3, scene, toon, QL, rnd } from './core.js?v=1';
import { world } from './physics.js?v=1';

const WALLH = 3.4;

// ------------------------------------------------------------------ wing layouts (hand-placed boxes in meters; +Z is "forward" at yaw 0)
// Every wing (except the finale) is TWO zones split by a partition wall with a narrow doorway gap, each zone patrolled on its own -
// so you can't just skirt around the edge of one big empty room; you have to actually cross guarded chokepoints.
export const WINGS = [
  { // WING 1 - Cell Block: a cell row, then a guarded doorway into the lock room
    name: 'Cell Block', sky: 0x242c42, fogNear: 26, fogFar: 95, floor: 0x343c58, wallCol: 0x586ba0,
    size: [24, 32], start: { x: -9, z: -13.5, yaw: Math.PI },
    walls: [[0, -16, 24, .6], [0, 16, 24, .6], [-12, 0, .6, 32], [12, 0, .6, 32], [-7.1, 0, 9.8, .6], [7.1, 0, 9.8, .6]],
    pillars: [[-8, -10, .6, 5], [-3, -10, .6, 5], [3, -10, .6, 5], [8, -10, .6, 5], [-4, -4, 1.2, 1.2], [4, -4, 1.2, 1.2], [-5, 8, 1.3, 1.3], [5, 8, 1.3, 1.3]],
    shadows: [[0, -1.5, 1.4], [8, 13, 1.3]],
    door: { x: 8, z: 14, w: .5, d: 2, hits: 6 },
    needle: { speed: 1.4, zone: .2 },
    guards: [
      { start: [-9, -6], path: [[-9, -6], [9, -6]], loop: 'pingpong', speed: 2, range: 9, half: .6, pause: .7 },
      { start: [7, -2.5], path: [[7, -2.5], [-7, -2.5]], loop: 'pingpong', speed: 2.2, range: 8.5, half: .55, pause: .6 },
      { start: [-8, 3], path: [[-8, 3], [8, 3], [8, 13], [-8, 13]], loop: 'loop', speed: 2.2, range: 9.5, half: .48, pause: .5 },
    ],
  },
  { // WING 2 - Hallways: two parallel corridors behind a doorway, then a guarded lock room
    name: 'Hallways', sky: 0x222a40, fogNear: 24, fogFar: 90, floor: 0x303850, wallCol: 0x52628e,
    size: [30, 26], start: { x: -12, z: -10, yaw: Math.PI },
    walls: [[0, -13, 30, .6], [0, 13, 30, .6], [-15, 0, .6, 26], [15, 0, .6, 26], [6, -7.65, .6, 10.7], [6, 7.65, .6, 10.7]],
    pillars: [[-9, -4, 1, 1], [-9, 4, 1, 1], [-2, -4, 1, 1], [-2, 4, 1, 1], [10, -6, 1.3, 1.3], [10, 6, 1.3, 1.3]],
    shadows: [[-13, 6, 1.3], [2, 0, 1.3], [12, 9, 1.3]],
    door: { x: 12, z: 9, w: 2, d: .5, hits: 8 },
    needle: { speed: 1.5, zone: .2 },
    guards: [
      { start: [-13, -7], path: [[-13, -7], [4, -7]], loop: 'pingpong', speed: 2.3, range: 9, half: .5, pause: .6 },
      { start: [4, 7], path: [[4, 7], [-13, 7]], loop: 'pingpong', speed: 2.1, range: 9, half: .5, pause: .6 },
      { start: [-4, -9], path: [[-4, -9], [-4, 9]], loop: 'pingpong', speed: 2.4, range: 9.5, half: .45, pause: .5 },
      { start: [8, -9], path: [[8, -9], [13, -9], [13, 9], [8, 9]], loop: 'loop', speed: 2.2, range: 9, half: .48, pause: .5 },
    ],
  },
  { // WING 3 - The Yard: the open yard behind a gate, then the cell block leading to the hardest lock
    name: 'The Yard', sky: 0x1c2438, fogNear: 26, fogFar: 105, floor: 0x2a3250, wallCol: 0x4a5a86,
    size: [34, 30], start: { x: -9, z: -12, yaw: Math.PI },
    walls: [[0, -15, 34, .6], [0, 15, 34, .6], [-17, 0, .6, 30], [17, 0, .6, 30], [-10, 0, 14, .6], [10, 0, 14, .6]],
    pillars: [[-11, -8, 1.6, 1.6], [-11, -2, 1.6, 1.6], [2, -9, 1.4, 1.4], [2, -3, 1.4, 1.4], [11, -7, 1.4, 1.4], [-6, 5, 1.5, 1.5], [-6, 10, 1.5, 1.5], [6, 5, 1.5, 1.5], [6, 10, 1.5, 1.5], [-2, 12, 1.4, 1.4]],
    shadows: [[-14, -5, 1.4], [0, -1, 1.4], [13, 12, 1.4]],
    door: { x: 14, z: 12.5, w: 2.2, d: .5, hits: 9 },
    needle: { speed: 1.9, zone: .15 },
    guards: [
      { start: [-14, -13], path: [[-14, -13], [14, -13], [14, -4], [-14, -4]], loop: 'loop', speed: 2.6, range: 9.5, half: .44, pause: .5 },
      { start: [-3, -10], path: [[-3, -10], [3, -7], [-3, -4], [-7, -7]], loop: 'loop', speed: 2.8, range: 10, half: .4, pause: .4 },
      { start: [-13, 3], path: [[-13, 3], [13, 3], [13, 13], [-13, 13]], loop: 'loop', speed: 2.5, range: 9.5, half: .46, pause: .5 },
      { start: [0, 2], path: [[0, 2], [0, 13]], loop: 'pingpong', speed: 2.7, range: 10, half: .42, pause: .5 },
    ],
  },
  { // WING 4 - Death Row: two guarded cell wings either side of a central gate, the toughest lock
    name: 'Death Row', sky: 0x161c30, fogNear: 28, fogFar: 115, floor: 0x262e4a, wallCol: 0x3e4e78,
    size: [38, 28], start: { x: -15, z: -11, yaw: Math.PI },
    walls: [[0, -13.5, 38, .6], [0, 13.5, 38, .6], [-19, 0, .6, 27], [19, 0, .6, 27], [0, -8.25, .6, 10.5], [0, 8.25, .6, 10.5]],
    pillars: [[-9, -7, 1.6, 1.6], [-9, 7, 1.6, 1.6], [-14, 0, 1.4, 1.4], [-4, -9, 1.3, 1.3], [-4, 9, 1.3, 1.3], [9, -7, 1.6, 1.6], [9, 7, 1.6, 1.6], [14, 0, 1.4, 1.4], [4, -9, 1.3, 1.3], [4, 9, 1.3, 1.3]],
    shadows: [[-16, -9, 1.3], [16, 9, 1.3], [0, -10, 1.3]],
    door: { x: 17, z: 12, w: 2, d: .5, hits: 10 },
    needle: { speed: 2.4, zone: .1 },
    guards: [
      { start: [-17, -12], path: [[-17, -12], [-2.5, -12], [-2.5, -1], [-17, -1]], loop: 'loop', speed: 2.6, range: 9.5, half: .42, pause: .5 },
      { start: [-17, 12], path: [[-17, 12], [-2.5, 12], [-2.5, 1], [-17, 1]], loop: 'loop', speed: 2.5, range: 9.5, half: .42, pause: .5 },
      { start: [-1, -6], path: [[-1, -6], [-1, 6]], loop: 'pingpong', speed: 2.4, range: 9.5, half: .5, pause: .5 },
      { start: [2.5, -12], path: [[2.5, -12], [17, -12], [17, -1], [2.5, -1]], loop: 'loop', speed: 2.6, range: 9.5, half: .42, pause: .5 },
      { start: [1, -6], path: [[1, -6], [1, 6]], loop: 'pingpong', speed: 2.5, range: 9.5, half: .5, pause: .5 },
    ],
  },
  { // WING 5 - Over The Wall: no lock here. Sneak across the big yard under the sweeping tower lights and roaming patrols, then through the fence gap.
    name: 'Over The Wall', sky: 0x0e1424, fogNear: 28, fogFar: 125, floor: 0x222a44, wallCol: 0x38456c,
    size: [36, 26], start: { x: -15, z: -10, yaw: Math.PI },
    walls: [[0, -13, 36, .6], [0, 13, 36, .6], [-18, 0, .6, 26], [18, 0, .6, 26]],
    pillars: [[-8, -4, 1.6, 1.6], [-8, 4, 1.6, 1.6], [0, -6, 1.4, 1.4], [0, 6, 1.4, 1.4], [8, -3, 1.4, 1.4], [8, 3, 1.4, 1.4], [-13, -2.5, 1.3, 1.3], [13, 2.5, 1.3, 1.3]],
    shadows: [[-12, -7, 1.3], [6, 8, 1.3], [12, -8, 1.3], [-6, 8, 1.3]],
    door: { x: 15.5, z: 10.5, w: 2.6, d: .5, hits: 0 },
    needle: { speed: 1, zone: .15 },
    guards: [
      { start: [-9, -8], path: [[-9, -8]], loop: 'loop', speed: 0, range: 12, half: .85, pause: 1.6 },
      { start: [9, -8], path: [[9, -8]], loop: 'loop', speed: 0, range: 12, half: .85, pause: 1.6 },
      { start: [-9, 8], path: [[-9, 8]], loop: 'loop', speed: 0, range: 12, half: .85, pause: 1.6 },
      { start: [9, 8], path: [[9, 8]], loop: 'loop', speed: 0, range: 12, half: .85, pause: 1.6 },
      { start: [-14, 0], path: [[-14, 0], [14, 0]], loop: 'pingpong', speed: 2.4, range: 10, half: .44, pause: .6 },
      { start: [-13, -9], path: [[-13, -9], [13, 9]], loop: 'pingpong', speed: 2.6, range: 10, half: .4, pause: .5 },
    ],
  },
];

// ------------------------------------------------------------------ building a wing
export class Level {
  constructor(spec) {
    this.spec = spec; this.group = new THREE.Group(); scene.add(this.group); this.boxes = []; this.doorBox = null; this.doorUnlocked = false;
    const wallMat = toon(spec.wallCol), pillarMat = toon(spec.wallCol + 0x070707), floorMat = toon(spec.floor);
    const [fw, fd] = spec.size;
    this.group.add(this.mesh(new THREE.BoxGeometry(fw, 1, fd), floorMat, 0, -.5, 0));
    this.addBox(-fw / 2, fw / 2, -1, 0, -fd / 2, fd / 2); // floor collider
    for (const [x, z, w, d] of spec.walls) this.wall(x, z, w, d, wallMat);
    for (const [x, z, w, d] of spec.pillars) this.wall(x, z, w, d, pillarMat, true);
    // shadow patches: dark decals on the floor, and remembered for the detection check
    this.shadowZones = spec.shadows.map(([x, z, r]) => ({ x, z, r }));
    for (const s of this.shadowZones) { const m = new THREE.Mesh(new THREE.CircleGeometry(s.r, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .45, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(s.x, -.47, s.z); this.group.add(m); }
    // the door / lock at the end of the wing - or, when hits is 0, an unguarded fence gap: the real way out, no pick needed
    const d = spec.door; this.door = d; const isFence = !d.hits;
    this.doorMesh = new THREE.Group(); this.doorMesh.position.set(d.x, 0, d.z);
    if (isFence) {
      const postMat = toon(0x8a8f9a), wireMat = new THREE.MeshBasicMaterial({ color: 0xc8ccd4, transparent: true, opacity: .55, wireframe: true });
      for (const sx of [-1, 1]) this.doorMesh.add(this.mesh(new THREE.BoxGeometry(.18, WALLH * .9, .18), postMat, sx * (d.w / 2 + .3), WALLH * .45, 0));
      this.doorPanel = this.mesh(new THREE.BoxGeometry(d.w, WALLH * .9, .06), wireMat, 0, WALLH * .45, 0); this.doorMesh.add(this.doorPanel);
      this.lockMesh = null; this.group.add(this.doorMesh); this.doorBox = null; this.doorUnlocked = true;
    } else {
      const frameMat = toon(0x6a5a3a), panelMat = toon(0xb0382c);
      this.doorMesh.add(this.mesh(new THREE.BoxGeometry(d.w + .3, WALLH, d.d + .3), frameMat, 0, WALLH / 2, 0));
      this.doorPanel = this.mesh(new THREE.BoxGeometry(d.w, WALLH - .4, d.d), panelMat, 0, (WALLH - .4) / 2, 0); this.doorMesh.add(this.doorPanel);
      const lockGeo = new THREE.SphereGeometry(.22, 10, 8); this.lockMesh = this.mesh(lockGeo, toon(0xffd34e), 0, 1.3, d.d / 2 + .05); this.doorMesh.add(this.lockMesh);
      this.group.add(this.doorMesh);
      this.doorBox = this.addBox(d.x - d.w / 2, d.x + d.w / 2, 0, WALLH, d.z - d.d / 2, d.z + d.d / 2);
    }
  }
  mesh(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = QL.shadow > 0; return m; }
  addBox(minX, maxX, minY, maxY, minZ, maxZ) { const b = { minX, maxX, minY, maxY, minZ, maxZ }; world.add(b); this.boxes.push(b); return b; }
  wall(x, z, w, d, mat, pillar) { const h = pillar ? WALLH * 1.15 : WALLH; this.group.add(this.mesh(new THREE.BoxGeometry(w, h, d), mat, x, h / 2, z)); this.addBox(x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2); }
  inShadow(x, z) { for (const s of this.shadowZones) { const dx = x - s.x, dz = z - s.z; if (dx * dx + dz * dz < s.r * s.r) return true; } return false; }
  unlockDoor() { if (this.doorUnlocked) return; this.doorUnlocked = true; world.remove(this.doorBox); this.doorPanel.material.color.setHex(0x3fae5a); this.lockMesh.material.color.setHex(0x8affa0); }
  dispose() { for (const b of this.boxes) world.remove(b); scene.remove(this.group); this.group.traverse(c => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); if (c.material && !c.material.userData.shared) c.material.dispose(); }); }
}
