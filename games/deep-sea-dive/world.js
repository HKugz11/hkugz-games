// world.js - the ocean itself: the seabed, seaweed, kelp forests, coral, rocks and caves, the sky, and the light/colour that
// gets darker and bluer the deeper you go. Everything is made from code (no picture files).
import * as THREE from './three.module.min.js';
import { clamp, lerp, smooth, rng, noise2, fbm, mat, Parts } from './util.js?v=2';
import { litMaterial, addPhase, waterMaterial, makeRays, updateRays, makeSpecks, WATER } from './shaders.js?v=2';
import { TUNE } from './data.js?v=2';

export const SIZE = TUNE.worldSize, HALF = SIZE / 2;
const N = 161, CELL = SIZE / (N - 1);

// ------------------------------------------------------------------------------------------------ the shape of the seabed
// depth (in metres below the surface) at a spot. Near the boat it's a shallow sandy shelf; toward +Z it slopes down into the dark.
function rawDepth(x, z) {
  const e = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);        // "distance from the middle" of a rounded square
  const shelf = 16 + 12 * fbm(x * 0.018 + 5, z * 0.018 + 9, 3);                          // 16-28 m: the sandy reef shelf
  const s1 = smooth(10, 110, z) * 100;                                                    // first slope: down to the Twilight/Midnight zones
  const s2 = smooth(80, 190, z) * 205;                                                    // second slope: down into the Abyss
  const valley = Math.exp(-Math.pow(x / 120, 2)) * smooth(20, 150, z) * 50;              // a canyon down the middle
  let d = shelf + s1 + s2 + valley;
  d += (fbm(x * 0.035, z * 0.035, 4) - 0.5) * 2 * (2 + d * 0.07);                         // bumps (bigger when deeper)
  d -= Math.max(0, noise2(x * 0.045 + 31, z * 0.045 + 7) - 0.6) * 36 * (1 - smooth(25, 60, d));   // coral mounds on the shelf
  const near = 1 - smooth(8, 24, Math.hypot(x, z));                                       // keep clear water right under the boat
  d = d * (1 - near) + Math.max(d, 15) * near;
  d = Math.max(3.5, Math.min(d, 322));
  d -= smooth(205, 236, e) * (d + 10);                                                    // the edge of the world rises into rocky islands
  return d;
}

// The heights are worked out once on a grid; the mesh and the collisions both use the same grid so they always agree.
const grid = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) grid[j * N + i] = -rawDepth(-HALF + i * CELL, -HALF + j * CELL);

// Height of the seabed (negative = underwater) at x, z.
export function heightAt(x, z) {
  const fx = clamp((x + HALF) / CELL, 0, N - 1.001), fz = clamp((z + HALF) / CELL, 0, N - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = grid[j * N + i], b = grid[j * N + i + 1], c = grid[(j + 1) * N + i], d = grid[(j + 1) * N + i + 1];
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export const depthAt = (x, z) => -heightAt(x, z);
export function normalAt(x, z, out = new THREE.Vector3()) {
  const e = CELL;
  out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e));
  return out.normalize();
}
// "How far from the middle" - the world is a rounded square, this is its edge test.
export const edgeDist = (x, z) => Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
export const WORLD_EDGE = 232;

// ------------------------------------------------------------------------------------------------ colours at each depth
// [depth m, water colour, how much light is left (1 = bright), fog thickness]
const STOPS = [
  [0, 0x35b8e0, 1.0, 0.0085], [25, 0x1d8fcf, 0.86, 0.0115], [60, 0x1167ac, 0.56, 0.017], [110, 0x0a3466, 0.26, 0.023],
  [160, 0x051d42, 0.12, 0.029], [220, 0x020b20, 0.045, 0.034], [300, 0x010309, 0.015, 0.038],
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
export function envAt(depth, out = {}) {
  let i = 0;
  while (i < STOPS.length - 2 && depth > STOPS[i + 1][0]) i++;
  const a = STOPS[i], b = STOPS[i + 1], t = clamp((depth - a[0]) / (b[0] - a[0]), 0, 1);
  out.color = (out.color || new THREE.Color()).copy(_c1.set(a[1])).lerp(_c2.set(b[1]), t);
  out.light = lerp(a[2], b[2], t);
  out.fog = lerp(a[3], b[3], t);
  return out;
}

// ------------------------------------------------------------------------------------------------ the World
export class World {
  constructor(scene, lite) {
    this.scene = scene; this.lite = lite;
    this.colliders = [];     // solid balls (big rocks, cave boulders): { x, y, z, r }
    this.hides = [];         // places a shark can't see you: kelp forests and caves
    this.kelpSpots = []; this.caves = [];
    this.env = {}; this.env2 = {};
    const R = rng(20241031);
    this.root = new THREE.Group(); scene.add(this.root);

    this._lights();
    this._sky();
    this._water();
    this._terrain();
    this._plants(R);
    this._rocksAndCaves(R);
    this._coral(R);
    this._finish();
    this.rays = makeRays(lite ? 8 : 16); scene.add(this.rays);
    this.specks = makeSpecks(lite ? 260 : 520); scene.add(this.specks);
    this.bubbleRef = null;
  }

  // ---------------------------------------------------------------- lights
  _lights() {
    this.hemi = new THREE.HemisphereLight(0xaee8ff, 0x1a5a7a, 1.1);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    this.sun.position.set(0.35, 0.8, 0.25);
    this.scene.add(this.hemi, this.sun);
  }

  // ---------------------------------------------------------------- sky (only seen from above the water)
  _sky() {
    const geo = new THREE.SphereGeometry(1100, 24, 14);
    const col = new Float32Array(geo.attributes.position.count * 3), top = new THREE.Color(0x4aa6ee), hor = new THREE.Color(0xdff4ff), c = new THREE.Color();
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const y = geo.attributes.position.getY(i) / 1100;
      c.copy(hor).lerp(top, smooth(0.0, 0.7, y));
      if (y < 0) c.copy(hor);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10;
    // a friendly sun and a few low-poly clouds
    const sun = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false, depthWrite: false }));
    sun.position.copy(this.sun.position).normalize().multiplyScalar(1000); sun.lookAt(0, 0, 0);
    this.sky.add(sun);
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
    const R = rng(77);
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group(), a = R() * 6.28, r = 500 + R() * 400, y = 120 + R() * 140;
      for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(30 + R() * 22, 1), cm); s.scale.set(1.5, 0.55, 1); s.position.set((k - 1.5) * 38, R() * 8, R() * 14); g.add(s); }
      g.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.rotation.y = -a;
      this.sky.add(g);
    }
    this.scene.add(this.sky);
  }

  // ---------------------------------------------------------------- the water surface
  _water() {
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), waterMaterial());
    this.water.rotation.x = -Math.PI / 2;
    this.water.renderOrder = 5;
    this.scene.add(this.water);
  }

  // ---------------------------------------------------------------- the seabed mesh
  _terrain() {
    const tris = [], cols = [];
    const R = rng(5), c = new THREE.Color();
    const colorAt = (x, z, h) => {
      const d = -h, n = fbm(x * 0.05, z * 0.05, 3), n2 = noise2(x * 0.3, z * 0.3);
      if (d < 0.5) { c.set(0x7a8a5a).lerp(_c2.set(0xa09a84), n); if (d < -3) c.lerp(_c1.set(0x4f7a46), 0.6 * n2); else c.lerp(_c1.set(0xf0dca0), 0.5); }
      else if (d < 50) { c.set(0xefdaa0).lerp(_c1.set(0xcdb27a), smooth(0.35, 0.7, n)); c.lerp(_c2.set(0xffeec0), smooth(0, 8, d) < 1 ? 0.35 * (1 - smooth(0.5, 7, d)) : 0); }
      else if (d < 115) { c.set(0xb2a88c).lerp(_c1.set(0x8f8a7c), n); }
      else if (d < 205) { c.set(0x7c8496).lerp(_c1.set(0x5b6577), n); }
      else { c.set(0x5a5870).lerp(_c1.set(0x39384a), n); }
      c.multiplyScalar(0.9 + 0.2 * n2);
      return c;
    };
    const P = new Float32Array((N - 1) * (N - 1) * 6 * 3), C = new Float32Array(P.length);
    let k = 0;
    const put = (i, j) => {
      const x = -HALF + i * CELL, z = -HALF + j * CELL, h = grid[j * N + i], cc = colorAt(x, z, h);
      P[k] = x; P[k + 1] = h; P[k + 2] = z; C[k] = cc.r; C[k + 1] = cc.g; C[k + 2] = cc.b; k += 3;
    };
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      // two triangles per square; flip the split now and then so the facets don't all lean the same way
      if ((i + j) & 1) { put(i, j); put(i, j + 1); put(i + 1, j); put(i + 1, j); put(i, j + 1); put(i + 1, j + 1); }
      else { put(i, j); put(i, j + 1); put(i + 1, j + 1); put(i, j); put(i + 1, j + 1); put(i + 1, j); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.root.add(this.terrain);
  }

  // ---------------------------------------------------------------- batches of instanced things, split into chunks so far-away ones are skipped
  // items: [{ x, y, z, ry, sx, sy, sz, color }]
  _batch(geo, material, items, chunk = 80, name = '') {
    const groups = new Map();
    for (const it of items) {
      const key = Math.floor((it.x + HALF) / chunk) + ',' + Math.floor((it.z + HALF) / chunk);
      (groups.get(key) || groups.set(key, []).get(key)).push(it);
    }
    const o = new THREE.Object3D(), col = new THREE.Color(), R = rng(items.length + 11);
    for (const list of groups.values()) {
      const m = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((it, i) => {
        o.position.set(it.x, it.y, it.z); o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); o.scale.set(it.sx, it.sy ?? it.sx, it.sz ?? it.sx); o.updateMatrix();
        m.setMatrixAt(i, o.matrix); m.setColorAt(i, col.set(it.color ?? 0xffffff));
      });
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      if (material.userData.cfg.mode === 3) {   // plants: give each one its own sway phase
        const arr = new Float32Array(list.length); for (let i = 0; i < arr.length; i++) arr[i] = R() * 6.283;
        m.geometry = geo.clone(); m.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(arr, 1));
      }
      m.computeBoundingSphere(); m.name = name;
      this.root.add(m);
    }
  }

  // ---------------------------------------------------------------- seaweed and kelp
  _plants(R) {
    const blade = (segs, widthTop) => {
      const pos = [], col = [], idx = [];
      for (let k = 0; k <= segs; k++) {
        const t = k / segs, w = 0.09 * (1 - t * (1 - widthTop)), z = 0.05 * Math.sin(t * 3.2);
        pos.push(-w, t, z, w, t, z);
        const b = 0.45 + 0.55 * t; col.push(b, b, b, b, b, b);
        if (k < segs) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const weedMat = litMaterial({ mode: 3, amp: 0.3 });
    const greens = [0x2f9e4a, 0x49b85a, 0x78c850, 0x2a8a62, 0x8aa83a, 0x3aa89a, 0xa0603a, 0x9a3a5a];
    const items = [];
    const step = this.lite ? 6 : 4.5;
    for (let gz = -200; gz < 200; gz += step) for (let gx = -200; gx < 200; gx += step) {
      const x = gx + R() * step, z = gz + R() * step, h = heightAt(x, z), d = -h;
      if (d < 3.5 || d > 58) continue;
      const dens = smooth(0.32, 0.72, noise2(x * 0.05 + 3, z * 0.05)) * 0.95 + 0.07;
      if (R() > dens) continue;
      const base = greens[Math.floor(R() * greens.length)];
      const n = 3 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        const px = x + (R() - 0.5) * 2.4, pz = z + (R() - 0.5) * 2.4;
        items.push({ x: px, y: heightAt(px, pz) - 0.1, z: pz, ry: R() * 6.28, sx: 0.8 + R() * 0.7, sy: 0.8 + R() * 1.7, color: R() < 0.8 ? base : greens[Math.floor(R() * greens.length)] });
      }
    }
    this._batch(blade(6, 0.25), weedMat, items, 80, 'weed');

    // kelp forests: tall strands in thick groups. Sharks can't see you inside one!
    const kelpMat = litMaterial({ mode: 3, amp: 0.55 }), ghostMat = litMaterial({ mode: 3, amp: 0.55, glow: 1.3 });
    const gGeo = blade(10, 0.35); const ghostGeo = gGeo.clone();
    ghostGeo.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(ghostGeo.attributes.position.count).fill(0.5), 1));
    const kelp = [], ghost = [];
    const spots = [];
    const tryFind = (dmin, dmax, tries = 600) => {
      for (let t = 0; t < tries; t++) {
        const x = (R() * 2 - 1) * 185, z = (R() * 2 - 1) * 185, d = depthAt(x, z);
        if (d < dmin || d > dmax || Math.hypot(x, z) < 26) continue;
        if (spots.some(s => Math.hypot(s.x - x, s.z - z) < 38)) continue;
        const n = normalAt(x, z); if (n.y < 0.9) continue;
        return { x, z };
      }
      return null;
    };
    const plan = [[16, 30, 0], [16, 30, 0], [22, 45, 0], [30, 55, 0], [50, 80, 0], [62, 100, 0], [118, 170, 1], [130, 190, 1], [215, 280, 1]];
    for (const [dmin, dmax, ghostly] of plan) {
      const sp = tryFind(dmin, dmax); if (!sp) continue;
      spots.push(sp);
      const r = 8 + R() * 3, count = this.lite ? 34 : 56, hmax = Math.min(14, depthAt(sp.x, sp.z) - 2);
      for (let k = 0; k < count; k++) {
        const a = R() * 6.283, rr = Math.sqrt(R()) * r, px = sp.x + Math.cos(a) * rr, pz = sp.z + Math.sin(a) * rr;
        const it = { x: px, y: heightAt(px, pz) - 0.1, z: pz, ry: R() * 6.28, sx: 1.7 + R() * 1.2, sy: Math.max(5, hmax * (0.6 + R() * 0.4)),
          color: ghostly ? [0x7ad8ff, 0xa8f0ff, 0x6ab0ff][Math.floor(R() * 3)] : [0x6a8a2a, 0x8a9a3a, 0xb09a3a, 0x4f8a3a][Math.floor(R() * 4)] };
        (ghostly ? ghost : kelp).push(it);
      }
      this.hides.push({ kind: 'kelp', x: sp.x, z: sp.z, r: r * 0.85, y0: heightAt(sp.x, sp.z) - 2, y1: heightAt(sp.x, sp.z) + hmax });
    }
    this._batch(gGeo, kelpMat, kelp, 80, 'kelp');
    this._batch(ghostGeo, ghostMat, ghost, 80, 'ghostkelp');
    this.kelpSpots = spots;
  }

  // ---------------------------------------------------------------- rocks, boulders and caves
  _rocksAndCaves(R) {
    const ico = new THREE.IcosahedronGeometry(1, 1);
    const p = ico.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.34 * Math.abs(Math.sin(p.getX(i) * 9.1 + p.getY(i) * 5.7 + p.getZ(i) * 7.3)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
    const g = ico; g.computeVertexNormals();
    const cc = new Float32Array(g.attributes.position.count * 3).fill(1);
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const rockMat = litMaterial({ mode: -1, double: false });
    const items = [];
    const shade = d => (d < 50 ? 0x8f8a80 : d < 115 ? 0x77746f : d < 205 ? 0x5b5f6b : 0x403e50);
    const addRock = (x, z, s, lift = 0.3, tint) => {
      const y = heightAt(x, z), d = -y;
      const c = new THREE.Color(tint ?? shade(d)).multiplyScalar(0.85 + R() * 0.3);
      items.push({ x, y: y + s * (0.5 - lift) * 0.4 + 0.0, z, rx: R() * 0.5, ry: R() * 6.28, rz: R() * 0.5, sx: s * (0.9 + R() * 0.5), sy: s * (0.6 + R() * 0.5), sz: s * (0.9 + R() * 0.5), color: c.getHex() });
      if (s >= 1.6) this.colliders.push({ x, y: y + s * 0.3, z, r: s * 0.8 });
    };
    const count = this.lite ? 220 : 380;
    for (let i = 0; i < count; i++) {
      const x = (R() * 2 - 1) * 210, z = (R() * 2 - 1) * 210;
      if (depthAt(x, z) < 1.5 || Math.hypot(x, z) < 9) continue;
      addRock(x, z, R() < 0.12 ? 2.6 + R() * 3.4 : 0.5 + R() * 1.6);
    }
    // caves: a horseshoe of boulders with a roof. Swim inside to hide from sharks.
    const spots = [];
    const find = (dmin, dmax) => {
      for (let t = 0; t < 800; t++) {
        const x = (R() * 2 - 1) * 190, z = (R() * 2 - 1) * 190, d = depthAt(x, z);
        if (d < dmin || d > dmax || Math.hypot(x, z) < 28) continue;
        if (spots.concat(this.kelpSpots).some(s => Math.hypot(s.x - x, s.z - z) < 34)) continue;
        if (normalAt(x, z).y < 0.93) continue;
        return { x, z };
      }
      return null;
    };
    for (const [dmin, dmax] of [[18, 32], [24, 40], [55, 85], [70, 105], [125, 175], [140, 190], [230, 290]]) {
      const sp = find(dmin, dmax); if (!sp) continue;
      spots.push(sp);
      const open = R() * 6.283, fl = heightAt(sp.x, sp.z);
      for (let k = 0; k < 7; k++) {
        const a = open + 0.9 + (k / 6) * (6.283 - 1.8), r = 4.6, s = 2.4 + R() * 0.7;
        addRock(sp.x + Math.cos(a) * r, sp.z + Math.sin(a) * r, s, 0.1);
      }
      // the roof, held up by the walls
      const rx = sp.x - Math.cos(open) * 1.2, rz = sp.z - Math.sin(open) * 1.2;
      items.push({ x: rx, y: fl + 4.6, z: rz, ry: R() * 6, sx: 4.4, sy: 1.5, sz: 4.4, color: shade(-fl) });
      for (const [ox, oz] of [[0, 0], [2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]) this.colliders.push({ x: rx + ox, y: fl + 4.6, z: rz + oz, r: ox || oz ? 2.1 : 2.5 });
      this.hides.push({ kind: 'cave', x: sp.x, z: sp.z, r: 4.2, y0: fl - 1, y1: fl + 3.3 });
      this.caves.push({ x: sp.x, y: fl + 1.6, z: sp.z });
    }
    this._batch(g, rockMat, items, 80, 'rock');
    // sort colliders into a quick lookup grid
    this.cgrid = new Map();
    for (const c of this.colliders) {
      const key = Math.floor((c.x + HALF) / 24) + ',' + Math.floor((c.z + HALF) / 24);
      (this.cgrid.get(key) || this.cgrid.set(key, []).get(key)).push(c);
    }
  }

  // ---------------------------------------------------------------- coral (several shapes, painted by tinting each copy)
  _coral(R) {
    const white = new THREE.Color(0xffffff);
    const branch = (P, bx, by, bz, a, t, len, r0, r1, color = 0xffffff) => {
      const dx = Math.sin(t) * Math.cos(a), dy = Math.cos(t), dz = -Math.sin(t) * Math.sin(a);
      P.add(new THREE.CylinderGeometry(r1, r0, len, 5), mat(bx + dx * len / 2, by + dy * len / 2, bz + dz * len / 2, 1, 1, 1, 0, a, -t), color);
      return [bx + dx * len, by + dy * len, bz + dz * len];
    };
    const variety = (v, c) => { const k = 0.88 + 0.12 * Math.sin(v.x * 17 + v.y * 11 + v.z * 13); c.setRGB(k, k, k); };
    // 1 branching (staghorn)
    let P = new Parts();
    P.add(new THREE.CylinderGeometry(0.1, 0.16, 0.5, 6), mat(0, 0.25, 0), variety);
    for (let k = 0; k < 6; k++) {
      const a = k * 1.047 + 0.3, tip = branch(P, 0, 0.45, 0, a, 0.55 + 0.1 * (k % 2), 0.6, 0.07, 0.11, variety);
      branch(P, tip[0], tip[1], tip[2], a + 0.7, 0.5, 0.35, 0.04, 0.07, variety);
      branch(P, tip[0], tip[1], tip[2], a - 0.7, 0.45, 0.32, 0.04, 0.07, variety);
    }
    const staghorn = P.build();
    // 2 brain coral
    const bs = new THREE.SphereGeometry(0.5, 9, 6); const bp = bs.attributes.position;
    for (let i = 0; i < bp.count; i++) { const k = 0.9 + 0.2 * Math.abs(Math.sin(bp.getX(i) * 14 + bp.getZ(i) * 9)); bp.setXYZ(i, bp.getX(i) * k, bp.getY(i) * k, bp.getZ(i) * k); }
    const brain = new Parts().add(bs, mat(0, 0.1, 0, 1, 0.65, 1), variety).build();
    // 3 fan coral
    P = new Parts();
    P.add(new THREE.CylinderGeometry(0.04, 0.07, 0.5, 5), mat(0, 0.25, 0), variety);
    P.add(new THREE.CircleGeometry(0.55, 10), mat(0, 0.85, 0, 1, 0.9, 1), (v, c) => { const a = Math.atan2(v.y - 0.85, v.x); const k = Math.sin(a * 9) > 0 ? 0.82 : 1; c.setRGB(k, k, k); });
    const fan = P.build(false);
    // 4 tube coral
    P = new Parts();
    [[0, 0, 0.9, 0.12], [0.2, 0.1, 0.6, 0.1], [-0.18, 0.12, 0.7, 0.11], [0.05, -0.2, 0.45, 0.09], [-0.1, -0.15, 0.8, 0.1], [0.25, -0.12, 0.4, 0.08]].forEach(([x, z, h, r]) => {
      P.add(new THREE.CylinderGeometry(r, r * 1.15, h, 7, 1, true), mat(x, h / 2, z), variety);
      P.add(new THREE.CircleGeometry(r * 0.9, 7), mat(x, h * 0.92, z, 1, 1, 1, -Math.PI / 2), (v, c) => c.setRGB(0.3, 0.3, 0.3));
    });
    const tube = P.build();
    // 5 sea anemone (a ring of soft fingers)
    P = new Parts();
    P.add(new THREE.CylinderGeometry(0.22, 0.28, 0.2, 8), mat(0, 0.1, 0), variety);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283, rr = 0.1 + 0.08 * (k % 2); P.add(new THREE.ConeGeometry(0.05, 0.5, 5), mat(Math.cos(a) * rr, 0.42, Math.sin(a) * rr, 1, 1, 1, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35), (v, c) => { const k2 = 0.7 + 0.3 * smooth(0.2, 0.6, v.y); c.setRGB(k2, k2, k2); }); }
    const anemone = P.build();

    const mats = litMaterial({ mode: -1 });
    const types = [[staghorn, 0.34], [brain, 0.24], [fan, 0.16], [tube, 0.16], [anemone, 0.1]];
    const palettes = [[0xff6aa8, 0xff8fc0, 0xe0407a], [0xff8a3a, 0xffa860, 0xe0601a], [0xa070ff, 0xc09aff, 0x7a4ae0], [0xffd23c, 0xffe270, 0xe0b020], [0x3adfc0, 0x70f0d8, 0x20b0a0], [0xff5a4a, 0xff8070, 0xc03a30]];
    const buckets = types.map(() => []);
    const patches = this.lite ? 38 : 64;
    for (let pI = 0; pI < patches; pI++) {
      // a patch of reef: look for a good sandy spot, a bit more often near the boat
      let x = 0, z = 0, ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        const rr = Math.pow(R(), 1.4) * 190, a = R() * 6.283; x = Math.cos(a) * rr; z = Math.sin(a) * rr;
        const d = depthAt(x, z); ok = d > 4 && d < 46 && normalAt(x, z).y > 0.85 && Math.hypot(x, z) > 7;
      }
      if (!ok) continue;
      const pal = palettes[Math.floor(R() * palettes.length)], n = 8 + Math.floor(R() * 8), spread = 3.5 + R() * 4;
      for (let k = 0; k < n; k++) {
        const a = R() * 6.283, rr = Math.sqrt(R()) * spread, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, d = depthAt(px, pz);
        if (d < 2.5 || d > 50) continue;
        let r = R(), ti = 0; for (; ti < types.length - 1; ti++) { if (r < types[ti][1]) break; r -= types[ti][1]; }
        const s = 0.7 + R() * 1.4;
        buckets[ti].push({ x: px, y: heightAt(px, pz) - 0.05, z: pz, ry: R() * 6.28, sx: s, sy: s * (0.85 + R() * 0.4), color: ti === 4 ? [0xff7ac0, 0xffc060, 0xb090ff][Math.floor(R() * 3)] : pal[Math.floor(R() * pal.length)] });
      }
    }
    types.forEach(([geo], i) => this._batch(geo, mats, buckets[i], 80, 'coral' + i));
  }

  _finish() {
    // nothing else to add yet; the boat and anchor are made in boat.js and put in by game.js
  }

  // ---------------------------------------------------------------- collisions
  // Push a ball (position pos, radius r) out of the seabed, rocks and the world's edge. vel is cancelled where we hit something.
  collide(pos, r, vel) {
    // world edge (invisible wall, but the rocky islands are already there)
    const e = edgeDist(pos.x, pos.z);
    if (e > WORLD_EDGE) { const k = WORLD_EDGE / e; pos.x *= k; pos.z *= k; }
    // seabed
    const h = heightAt(pos.x, pos.z);
    if (pos.y - h < r + 1.5) {
      const n = normalAt(pos.x, pos.z, _n);
      const pen = r - (pos.y - h) * n.y;
      if (pen > 0) { pos.addScaledVector(n, pen); if (vel) { const vn = vel.dot(n); if (vn < 0) vel.addScaledVector(n, -vn); } }
    }
    // boulders
    const cx = Math.floor((pos.x + HALF) / 24), cz = Math.floor((pos.z + HALF) / 24);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const list = this.cgrid.get((cx + dx) + ',' + (cz + dz)); if (!list) continue;
      for (const c of list) {
        _n.set(pos.x - c.x, pos.y - c.y, pos.z - c.z);
        const d = _n.length(), min = c.r + r;
        if (d < min && d > 1e-4) { _n.multiplyScalar(1 / d); pos.addScaledVector(_n, min - d); if (vel) { const vn = vel.dot(_n); if (vn < 0) vel.addScaledVector(_n, -vn); } }
      }
    }
  }

  // Is this spot hidden from sharks (inside a kelp forest or a cave)?
  hiddenAt(p) {
    for (const h of this.hides) {
      if (p.y < h.y0 || p.y > h.y1) continue;
      const dx = p.x - h.x, dz = p.z - h.z;
      if (dx * dx + dz * dz < h.r * h.r) return h.kind;
    }
    return null;
  }

  // ---------------------------------------------------------------- every frame: light, fog and colour for the camera's depth
  // camera = the camera position; flashlightOn = player's light is on (makes specks visible)
  updateEnvironment(camera, t, flashlightOn) {
    const under = camera.position.y < 0;
    const depth = Math.max(0, -camera.position.y);
    const e = envAt(depth, this.env);
    const scene = this.scene;
    if (under) {
      scene.background = e.color;
      scene.fog.color.copy(e.color); scene.fog.density = e.fog;
      this.hemi.color.copy(e.color).lerp(_c1.set(0xbff3ff), 0.45 * e.light); this.hemi.groundColor.copy(e.color).multiplyScalar(0.5);
      this.hemi.intensity = 1.25 * e.light + 0.02;
      this.sun.intensity = 1.7 * Math.exp(-depth / 40);
      this.sun.color.set(0xd8f4ff);
      this.sky.visible = false;
      WATER.uFogColor.value.copy(e.color); WATER.uFogDensity.value = e.fog; WATER.uUnder.value.copy(e.color);
    } else {
      scene.background = null;
      scene.fog.color.set(0xcdeaf6); scene.fog.density = 0.0016;
      this.hemi.color.set(0xdff3ff); this.hemi.groundColor.set(0x3a7a8a); this.hemi.intensity = 1.25;
      this.sun.intensity = 1.9; this.sun.color.set(0xfff2d8);
      this.sky.visible = true;
      WATER.uFogColor.value.set(0xcdeaf6); WATER.uFogDensity.value = 0.0016;
      WATER.uUnder.value.copy(envAt(8, this.env2).color);
    }
    // the sea beneath us shows through the surface more when we look at it from above, so tint the "from above" colour with depth
    this.sky.position.copy(camera.position);
    updateRays(this.rays, camera.position, t, under ? Math.max(0, 1 - depth / 70) : 0);
    this.specks.material.uniforms.uCenter.value.copy(camera.position);
    this.specks.material.uniforms.uBright.value = under ? clamp(e.light * 1.2 + (flashlightOn ? 0.5 : 0), 0.08, 1) : 0;
    this.specks.visible = under;
  }
}
const _n = new THREE.Vector3();
