// Last Stand zombies: built from scratch out of blocks (same blocky Core Strike look, but real zombies).
// Torn clothes, pale green skin, sunken eyes, a slack jaw with teeth, messy hair, arms stretched out, a hunched lean.
// No gore: it is a cartoon zombie. Four kinds: walker (4 outfits), spitter (bloated, gooey), brute (huge), king (crown + cape).
import * as THREE from './three.module.min.js?v=256';

const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
function box(w, h, d, x, y, z, hex, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  if (rx || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
  g.translate(x, y, z);
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}
function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), K = new Float32Array(n * 3); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); K.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.BufferAttribute(N, 3)); m.setAttribute('color', new THREE.BufferAttribute(K, 3)); return m;
}

const SHIRTS = [0x4a6fa5, 0xa8433a, 0x7a7f86, 0xc9a43a], PANTS = [0x5b4a3a, 0x3a4a66, 0x8a7d5a, 0x4a4a52], HAIRS = [0x3a2a20, 0x6a4a2a, 0x222222, 0x8a8a8a], SKINS = [0x8fbf7a, 0x7fb06a, 0x9bc884, 0x86b87e];
const WHITE = 0xf3efd8, DARKMOUTH = 0x2a1215, SOCKET = 0x23361f, BONE = 0xe8e4d4;

// All coordinates are relative to the part's pivot. Pivots: legs at the hip (y .62), "up" group (torso/head/arms) at the hips (y .7, leans forward), head at the neck-top, arms at the shoulders.
function buildParts(kind, v) {
  const K = kind;
  const skin = K === 'spitter' ? 0xb4c862 : K === 'brute' ? 0x6f9f62 : K === 'king' ? 0x5f8f55 : SKINS[v % 4];
  const skinD = K === 'spitter' ? 0x8fa843 : K === 'brute' ? 0x56864a : K === 'king' ? 0x497a44 : 0x6a9a58;
  const shirt = K === 'spitter' ? 0xd9822b : K === 'brute' ? 0x7a6a58 : K === 'king' ? 0x6a2f8f : SHIRTS[v % 4];
  const pants = K === 'king' ? 0x2a2433 : K === 'brute' ? 0x4a4036 : PANTS[(v + 1) % 4];
  const shoe = 0x2b2420, hair = HAIRS[(v + 2) % 4];
  const lw = K === 'brute' ? 1.32 : 1;   // brutes are wide
  const out = {};

  // legs (hip pivot): one leg has torn trousers (bare shin), the other has a ragged cuff
  const leg = (torn) => merge([
    box(0.24 * lw, 0.34, 0.26 * lw, 0, -0.17, 0, pants),
    box((torn ? 0.19 : 0.22) * lw, 0.3, (torn ? 0.21 : 0.24) * lw, 0, -0.49, 0, torn ? skin : pants),
    ...(torn ? [box(0.26 * lw, 0.07, 0.28 * lw, 0, -0.34, 0, pants, 0, 0.12)] : [box(0.07, 0.07, 0.26 * lw, 0.07 * lw, -0.62, 0, skin)]),
    box(0.25 * lw, 0.1, 0.36 * lw, 0, -0.58, -0.05, shoe),
  ]);
  out.legL = leg(true); out.legR = leg(false);

  // torso (up pivot at the hips, y 0 = hips)
  const T = [box(0.5 * lw, 0.14, 0.3 * lw, 0, -0.02, 0, pants)];
  if (K === 'walker') {
    T.push(box(0.52, 0.5, 0.3, 0, 0.33, 0, shirt));
    for (const [x, h] of [[-0.2, 0.09], [-0.07, 0.15], [0.07, 0.06], [0.2, 0.12]]) T.push(box(0.12, h, 0.3, x, 0.08 - h / 2 + 0.06, 0, shirt));   // ragged hem
    T.push(box(0.17, 0.14, 0.02, 0.08, 0.11, -0.155, skin), box(0.15, 0.15, 0.02, -0.1, 0.42, -0.155, skinD), box(0.05, 0.02, 0.02, -0.1, 0.42, -0.17, BONE));
  } else if (K === 'spitter') {
    T.push(box(0.52, 0.5, 0.3, 0, 0.33, 0, shirt), box(0.62, 0.34, 0.44, 0, 0.2, -0.06, shirt));   // a big round belly
    T.push(box(0.3, 0.22, 0.02, 0, 0.2, -0.285, 0x8dff4a), box(0.14, 0.1, 0.02, 0.1, 0.34, -0.285, 0xc9ff7a));   // glowing goo
    for (const [x, h] of [[-0.2, 0.1], [0.05, 0.16], [0.22, 0.07]]) T.push(box(0.14, h, 0.4, x, 0.06 - h / 2 + 0.02, -0.06, shirt));
  } else if (K === 'brute') {
    T.push(box(0.82, 0.62, 0.44, 0, 0.36, 0, skin), box(0.74, 0.3, 0.46, 0, 0.1, -0.02, skin));   // bare chest + big belly
    T.push(box(0.1, 0.64, 0.47, -0.27, 0.36, 0, shirt), box(0.1, 0.64, 0.47, 0.27, 0.36, 0, shirt), box(0.64, 0.1, 0.47, 0, 0.1, 0, shirt));   // torn vest straps
    T.push(box(0.18, 0.14, 0.02, -0.1, 0.42, -0.23, skinD));
  } else {
    T.push(box(0.56, 0.5, 0.32, 0, 0.33, 0, shirt), box(0.62, 0.34, 0.36, 0, 0.0, 0, shirt));   // purple robe
    for (const [x, h] of [[-0.24, 0.16], [-0.08, 0.28], [0.08, 0.12], [0.24, 0.22]]) T.push(box(0.15, h, 0.38, x, -0.14 - h / 2 + 0.1, 0, shirt));   // ragged hem
    T.push(box(0.58, 0.07, 0.34, 0, 0.58, 0, 0xd9a82a), box(0.08, 0.5, 0.34, 0, 0.33, -0.01, 0xd9a82a));   // gold collar + trim
    T.push(box(0.72, 0.95, 0.06, 0, 0.14, 0.2, 0x4a1f66));   // cape
  }
  T.push(box(0.18 * lw, 0.1, 0.18 * lw, 0, 0.66, 0, skin));   // neck
  out.torso = merge(T);

  // head (centre of the head = pivot, like the soldiers' heads)
  const hs = K === 'brute' ? 0.9 : 1;
  const H = [
    box(0.38 * hs, 0.36 * hs, 0.38 * hs, 0, 0, 0, skin),
    box(0.33 * hs, 0.09, 0.34 * hs, 0, -0.2 * hs, -0.015, skinD),                               // slack jaw
    box(K === 'spitter' ? 0.26 : 0.2, K === 'spitter' ? 0.12 : 0.07, 0.02, 0, -0.1 * hs, -0.19 * hs, DARKMOUTH),   // open mouth
    box(0.05, 0.04, 0.02, -0.06, -0.075 * hs, -0.2 * hs, WHITE), box(0.05, 0.04, 0.02, 0.06, -0.075 * hs, -0.2 * hs, WHITE), box(0.04, 0.035, 0.02, 0, -0.13 * hs, -0.2 * hs, WHITE),   // teeth
    box(0.12, 0.11, 0.02, -0.09, 0.05, -0.19 * hs, SOCKET), box(0.12, 0.11, 0.02, 0.09, 0.05, -0.19 * hs, SOCKET),   // sunken eye sockets
    box(0.08, 0.08, 0.02, -0.09, 0.05, -0.2 * hs, 0xf2f0d0), box(0.11, 0.11, 0.02, 0.09, 0.04, -0.2 * hs, 0xf2f0d0),    // one eye bigger than the other
    box(0.03, 0.04, 0.02, -0.075, 0.045, -0.21 * hs, 0x1b1b1b), box(0.035, 0.05, 0.02, 0.105, 0.03, -0.21 * hs, 0x1b1b1b),
    box(0.06, 0.07, 0.05, 0, -0.02, -0.21 * hs, skinD),                                          // nose
    box(0.04, 0.1, 0.07, -0.21 * hs, 0, 0, skin), box(0.04, 0.1, 0.07, 0.21 * hs, 0, 0, skin),    // ears
    box(0.1, 0.02, 0.02, 0.06, 0.13, -0.195 * hs, BONE), box(0.02, 0.07, 0.02, 0.03, 0.13, -0.196 * hs, BONE), box(0.02, 0.07, 0.02, 0.09, 0.13, -0.196 * hs, BONE),   // stitches
  ];
  if (K === 'spitter') H.push(box(0.11, 0.14, 0.1, -0.2, -0.1, -0.1, skin), box(0.11, 0.14, 0.1, 0.2, -0.1, -0.1, skin));   // puffed cheeks
  if (K === 'king') {
    H.push(box(0.42, 0.08, 0.42, 0, 0.22, 0, 0xf0c030), box(0.06, 0.06, 0.02, 0, 0.22, -0.215, 0xe0262f));
    for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17], [0, 0]]) H.push(box(0.08, 0.14, 0.08, x, 0.32, z, 0xf0c030));
    H.push(box(0.14, 0.07, 0.14, -0.1, 0.2, 0.08, hair));   // hair sticking out under the crown
  } else if (K === 'brute') {
    H.push(box(0.08, 0.14, 0.34, 0, 0.24, 0, 0xb33a2a), box(0.06, 0.1, 0.2, 0, 0.3, 0.02, 0xb33a2a));   // red mohawk
  } else {
    H.push(box(0.14, 0.07, 0.14, -0.1, 0.21, 0.04, hair), box(0.12, 0.06, 0.12, 0.08, 0.22, -0.05, hair), box(0.1, 0.08, 0.1, -0.02, 0.2, 0.12, hair), box(0.04, 0.14, 0.1, -0.2, 0.08, 0.06, hair));   // messy tufts
  }
  out.head = merge(H);

  // arms (shoulder pivot, hanging along -y; the rig rotates them forward)
  const aw = K === 'brute' ? 1.6 : 1;
  const arm = (side) => merge([
    box(0.14 * aw, 0.28, 0.14 * aw, 0, -0.14, 0, K === 'brute' ? skin : shirt),
    ...(K === 'brute' ? [] : [box(0.16 * aw, 0.05, 0.16 * aw, 0, -0.29, 0, shirt, 0, side * 0.1)]),   // ragged sleeve end
    box(0.12 * aw, 0.3, 0.12 * aw, 0, -0.44, 0, skin),
    ...(side > 0 ? [box(0.14 * aw, 0.08, 0.14 * aw, 0, -0.4, 0, BONE)] : []),                    // a bandage
    box(0.13 * aw, 0.1, 0.15 * aw, 0, -0.64, 0, skinD),
    box(0.03, 0.07, 0.04, -0.045 * aw, -0.7, -0.03, skinD), box(0.03, 0.07, 0.04, 0.045 * aw, -0.7, -0.03, skinD), box(0.03, 0.07, 0.04, 0, -0.71, -0.04, skinD),   // fingers
    ...(K === 'king' ? [box(0.17, 0.05, 0.17, 0, -0.3, 0, 0xd9a82a)] : []),
  ]);
  out.armL = arm(-1); out.armR = arm(1);
  return out;
}

const cache = {};
export const KINDS = ['walker', 'spitter', 'brute', 'king'];
// returns { g, up, head, legL, legR, armL, armR }; g faces -z like the soldiers; feet at y 0, about 1.75 tall (scale it for brutes and the king)
export function makeZombie(kind, variant = 0) {
  const v = kind === 'walker' ? variant % 4 : 0, key = kind + v, S = (cache[key] ||= buildParts(kind, v));
  const g = new THREE.Group(), mk = (geo, parent) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };
  const mkLeg = (x, geo) => { const p = new THREE.Group(); p.position.set(x, 0.62, 0); g.add(p); mk(geo, p); return p; };
  const lw = kind === 'brute' ? 1.32 : 1, legL = mkLeg(-0.15 * lw, S.legL), legR = mkLeg(0.15 * lw, S.legR);
  const up = new THREE.Group(); up.position.y = 0.7; up.rotation.x = kind === 'king' ? -0.12 : -0.28; g.add(up); mk(S.torso, up);   // a hunched lean
  const head = new THREE.Group(); head.position.y = 0.85; head.rotation.z = 0.12; up.add(head); mk(S.head, head);
  const sx = kind === 'brute' ? 0.56 : 0.36, arm = (x, geo) => { const p = new THREE.Group(); p.position.set(x, 0.58, 0); p.rotation.x = 1.45; up.add(p); mk(geo, p); return p; };
  const armL = arm(-sx, S.armL), armR = arm(sx, S.armR);
  return { g, up, head, legL, legR, armL, armR };
}
