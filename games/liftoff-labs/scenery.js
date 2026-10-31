// The launch site: pad, tower, hangar, fuel tanks, trees and rocks. Built in "pad space": y is up, the rocket stands at the origin.
import * as THREE from './three.module.min.js';
import { bake, cyl, box, ball, merge, toonMaterial, outlineMaterial } from './meshes.js?v=1';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#12304a'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#ff8fc8'; g.fillRect(0, 100, 512, 14);
  g.fillStyle = '#ffffff'; g.font = '900 64px "Trebuchet MS", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LIFTOFF LABS', 256, 54);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makePad(R, opts = {}) {
  const root = new THREE.Group();
  const drop = (x, z) => -(x * x + z * z) / (2 * R);
  const add = (geo, x, z, y = 0) => { const m = new THREE.Mesh(geo, toonMaterial()); m.position.set(x, y + drop(x, z), z); root.add(m); return m; };
  const outlined = (geo, x, z, y = 0, thick = 0.05) => { const m = add(geo, x, z, y); const o = new THREE.Mesh(geo, outlineMaterial(thick)); o.position.copy(m.position); root.add(o); return m; };

  // slab and painted ring
  outlined(merge([box(34, 0.8, 34, 0x9aa0ae, 0, -0.4, 0), box(22, 0.84, 22, 0x80879a, 0, -0.42, 0), cyl(9.5, 9.5, 0.06, 0xf4f4f4, -0.005, 40), cyl(8.7, 8.7, 0.08, 0x6e7588, 0, 40)]), 0, 0, 0, 0.04);
  // corner posts with lights
  const posts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { posts.push(cyl(0.25, 0.25, 3, 0xffd23a, 1.5, 8, { x: sx * 16, z: sz * 16 })); posts.push(ball(0.55, 0xfff1a8, sx * 16, 3.2, sz * 16)); }
  outlined(merge(posts), 0, 0, 0, 0.03);

  // launch tower (lattice)
  const tw = [];
  const H = 46, S = 1.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tw.push(box(0.35, H, 0.35, 0xe8503c, sx * S, H / 2, sz * S));
  for (let y = 4; y < H; y += 5) { tw.push(box(S * 2 + 0.35, 0.25, 0.25, 0xe8503c, 0, y, S)); tw.push(box(S * 2 + 0.35, 0.25, 0.25, 0xe8503c, 0, y, -S)); tw.push(box(0.25, 0.25, S * 2 + 0.35, 0xe8503c, S, y, 0)); tw.push(box(0.25, 0.25, S * 2 + 0.35, 0xe8503c, -S, y, 0));
    tw.push(box(0.2, 5.4, 0.2, 0xcfd3dd, 0, y + 2.4, S, { rz: 0.5 })); }
  tw.push(box(2, 0.4, 2, 0xffffff, 0, H + 0.2, 0)); tw.push(ball(0.5, 0xff4d4d, 0, H + 0.9, 0));
  tw.push(box(9, 0.5, 0.8, 0xcfd3dd, -5, 22, 0));              // swing arm toward the rocket
  tw.push(box(0.6, 1.2, 1.4, 0xffd23a, -9.2, 22, 0));
  outlined(merge(tw), 14, -3, 0, 0.05);

  // hangar with sign
  const hg = merge([box(46, 26, 34, 0xdce3ee, 0, 13, 0), box(46.6, 3, 34.6, 0x2a8fbd, 0, 27, 0), box(20, 20, 0.6, 0x39465c, 0, 10, 17.1), box(20.6, 1, 0.8, 0xffd23a, 0, 20.5, 17.2),
    box(46.4, 1, 34.4, 0xff8fc8, 0, 24, 0)]);
  outlined(hg, -10, -90, 0, 0.1);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshBasicMaterial({ map: signTexture() }));
  sign.position.set(-10, 22.5 + drop(-10, -73), -72.6); root.add(sign);

  // control building + dish
  const cb = merge([box(16, 7, 10, 0xe9edf5, 0, 3.5, 0), box(16.4, 1, 10.4, 0x2a8fbd, 0, 7.4, 0), box(5, 2.4, 0.4, 0x2f6f95, -3, 4.2, 5.1), box(3, 3, 0.3, 0x39465c, 4, 1.5, 5.1),
    cyl(0.25, 0.25, 8, 0xcfd3dd, 11, 8), bake(new THREE.ConeGeometry(2.4, 1.2, 14, 1, true), 0xffffff, { x: 0, y: 9, z: -1, rx: 0.6 })]);
  outlined(cb, -46, 26, 0, 0.06);

  // fuel tanks
  const ft = merge([cyl(5, 5, 14, 0xeef1f7, 7, 24), bake(new THREE.SphereGeometry(5, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xeef1f7, { y: 14 }), cyl(5.05, 5.05, 1.2, 0xff5fa8, 4, 24),
    cyl(4, 4, 11, 0xeef1f7, 5.5, 20, { x: 10.5 }), cyl(4.05, 4.05, 1, 0x34c3cf, 4, 20, { x: 10.5 }), bake(new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xeef1f7, { x: 10.5, y: 11 })]);
  outlined(ft, 52, -22, 0, 0.06);

  // road and flag
  add(merge([box(5, 0.12, 120, 0x4b5062, 0, -0.04, 0)]), 0, -35, 0).rotation.y = 0;
  outlined(merge([cyl(0.1, 0.1, 12, 0xcfd3dd, 6, 8), box(3.2, 2, 0.08, 0xff5fa8, 1.7, 10.5, 0)]), 22, 18, 0, 0.03);

  // trees and rocks
  const rnd = rng(7);
  const tree = merge([cyl(0.35, 0.5, 2.6, 0x7a5230, 1.3, 7), bake(new THREE.ConeGeometry(2.2, 4.4, 9), 0x2f9a4a, { y: 4.5 }), bake(new THREE.ConeGeometry(1.6, 3.2, 9), 0x3cbb5a, { y: 6.6 })]);
  const N = opts.trees ?? 260, trees = new THREE.InstancedMesh(tree, toonMaterial(), N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  let k = 0;
  for (let tries = 0; tries < N * 4 && k < N; tries++) {
    const a = rnd() * Math.PI * 2, d = 70 + Math.pow(rnd(), 1.5) * 1100, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x + 10) < 40 && z < -50 && z > -140) continue;              // not inside the hangar
    if (Math.abs(x) < 14 && z < 50 && z > -130) continue;                   // keep the road clear
    if (Math.hypot(x + 46, z - 26) < 16 || Math.hypot(x - 52, z + 22) < 18) continue;
    const sc = 0.8 + rnd() * 1.4; s.set(sc, sc * (0.9 + rnd() * 0.4), sc); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    p.set(x, drop(x, z), z); m4.compose(p, q, s); trees.setMatrixAt(k, m4);
    col.setHSL(0.27 + rnd() * 0.08, 0.55, 0.38 + rnd() * 0.16); trees.setColorAt(k, col); k++;
  }
  trees.count = k; trees.instanceMatrix.needsUpdate = true; if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  root.add(trees);
  const rock = merge([bake(new THREE.DodecahedronGeometry(1.2, 0), 0x9a9aa6, { sy: 0.7 })]);
  const rocks = new THREE.InstancedMesh(rock, toonMaterial(), 120);
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2, d = 40 + rnd() * 900, x = Math.cos(a) * d, z = Math.sin(a) * d, sc = 0.5 + rnd() * 2.4;
    s.set(sc, sc, sc); q.setFromAxisAngle(new THREE.Vector3(rnd(), rnd(), rnd()).normalize(), rnd() * 6); p.set(x, drop(x, z) + 0.2 * sc, z); m4.compose(p, q, s); rocks.setMatrixAt(i, m4);
  }
  root.add(rocks);
  root.userData.size = 1200;
  return root;
}
