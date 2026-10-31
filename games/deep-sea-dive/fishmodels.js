// fishmodels.js - how each kind of fish and shark LOOKS. Each is built from simple shapes (balls, cones, flat fins).
// Every model is 1 unit long with its nose pointing along +X; the game scales it to the fish's real size (see `size` in data.js).
// To make a new fish look different you usually only need to change its `look` colours in data.js. To invent a new SHAPE, add a builder below.
import * as THREE from './three.module.min.js';
import { Parts, mat, poly, rng, smooth, clamp } from './util.js?v=2';
import { litMaterial } from './shaders.js?v=2';

const C = hex => new THREE.Color(hex);
const sphere = (r = 0.5, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const cone = (r, len, seg = 6) => new THREE.ConeGeometry(r, len, seg);
const Y = new THREE.Vector3(0, 1, 0);
// a matrix that moves a shape to `pos`, points its +Y axis along `dir`, and scales it
const aim = (pos, dir, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize()), new THREE.Vector3(sx, sy, sz));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const eyes = (P, x, y, z, r = 0.035) => {
  for (const s of [-1, 1]) { P.add(sphere(r, 8, 6), mat(x, y, s * z), 0xffffff); P.add(sphere(r * 0.58, 6, 5), mat(x + r * 0.28, y, s * (z + r * 0.62)), 0x10121c); }
};

// ----------------------------------------------------------------------------------------------- the common fish
function fishGeo(L) {
  const h = L.h ?? 0.4, w = L.w ?? 0.2, P = new Parts(), glow = L.glow ?? 0;
  const body = C(L.body), belly = C(L.belly ?? L.body), stripe = L.stripe ? C(L.stripe) : null, fin = C(L.fin ?? L.body), tailC = C(L.tailc ?? L.fin ?? L.body);
  const inBand = x => L.bands && L.bands.some(b => x > b[0] && x < b[1]);
  const eyeBand = L.eyeBand ? C(L.eyeBand) : null;
  P.add(sphere(0.5, 14, 9), mat(0, 0, 0, 1, h, w), (v, c) => {
    if (L.rainbow) { c.setHSL(smooth(-0.45, 0.45, v.x) * 0.8 + 0.02, 0.8, v.y > 0 ? 0.55 : 0.68); return; }
    c.copy(belly).lerp(body, smooth(-h * 0.22, h * 0.12, v.y));
    if (stripe && inBand(v.x)) c.copy(stripe);
    if (eyeBand && v.x > 0.2 && v.x < 0.3) c.copy(eyeBand);
  }, glow);
  // a slim tail stalk joins the body to the tail
  P.add(cone(h * 0.3, 0.26, 6).rotateZ(Math.PI / 2), mat(-0.46, 0, 0, 1, 1, w / h * 0.7), (v, c) => c.copy(body).lerp(tailC, 0.3), glow * 0.5);
  const th = h * (L.tailH ?? 0.75), t = L.tail || 'fork';
  const tail = t === 'fan' ? [[-0.52, 0, 0], [-0.7, th, 0], [-0.78, 0, 0], [-0.7, -th, 0]]
    : t === 'lunate' ? [[-0.52, 0, 0], [-0.78, th * 1.5, 0], [-0.66, 0, 0], [-0.78, -th * 1.5, 0]]
      : [[-0.52, 0, 0], [-0.74, th, 0], [-0.64, 0, 0], [-0.74, -th, 0]];
  P.add(poly(tail), mat(), tailC, glow);
  const D = h * (L.dorsal ?? 0.45), A = h * (L.anal ?? 0.3);
  if (L.sail) P.add(poly([[0.32, h * 0.38, 0], [0.12, h * 0.38 + D * 1.7, 0], [-0.4, h * 0.3 + D * 1.0, 0], [-0.4, h * 0.3, 0]]), mat(), fin, glow);
  else P.add(poly([[0.2, h * 0.42, 0], [0.0, h * 0.42 + D, 0], [-0.3, h * 0.36, 0]]), mat(), fin, glow);
  P.add(poly([[0.02, -h * 0.42, 0], [-0.14, -h * 0.42 - A, 0], [-0.3, -h * 0.34, 0]]), mat(), fin, glow);
  for (const s of [-1, 1]) {
    if (L.lobed) P.add(sphere(0.5, 8, 6), mat(0.12, -h * 0.28, s * w * 0.62, 0.18, 0.05, 0.1, 0, 0, s * 0.3), fin, glow);
    else P.add(poly([[0.2, -h * 0.1, s * w * 0.42], [0.08, -h * 0.4, s * w * 1.1], [0.02, -h * 0.05, s * w * 0.42]]), mat(), fin, glow);
  }
  eyes(P, 0.31, h * 0.12, w * 0.42, Math.max(0.03, h * 0.09));
  if (L.spots) { const R = rng(7); for (let i = 0; i < L.spots.n; i++) { const x = (R() - 0.5) * 0.6, y = (R() - 0.5) * h * 0.6, q = Math.sqrt(Math.max(0, 1 - (x / 0.5) ** 2 - (y / (h / 2)) ** 2)); P.add(sphere(0.026, 5, 4), mat(x, y, (R() < 0.5 ? -1 : 1) * w * 0.5 * q * 0.97), L.spots.color); } }
  if (L.photophores) { for (let i = 0; i < L.photophores.n; i++) for (const s of [-1, 1]) { const x = 0.3 - i * (0.6 / L.photophores.n); P.add(sphere(0.022, 5, 4), mat(x, -h * 0.28, s * w * 0.46), L.photophores.color, 1); } }
  if (L.fangs) for (let i = 0; i < 6; i++) { const z = (i - 2.5) * 0.026; P.add(cone(0.011, 0.09, 4).rotateX(Math.PI), mat(0.47, -h * 0.12, z), 0xffffff); P.add(cone(0.011, 0.08, 4), mat(0.46, -h * 0.02, z), 0xffffff); }
  if (L.bill) P.add(cone(h * 0.07, 0.5, 5).rotateZ(-Math.PI / 2), mat(0.7, 0, 0), L.body);
  if (L.finlets) for (let i = 0; i < 5; i++) P.add(poly([[-0.1 - i * 0.07, h * 0.3, 0], [-0.14 - i * 0.07, h * 0.3 + h * 0.2, 0], [-0.17 - i * 0.07, h * 0.28, 0]]), mat(), L.finlets);
  if (L.crown) for (let i = 0; i < 6; i++) P.add(cone(0.02, 0.1 + i * 0.01, 4), mat(0.4 - i * 0.07, h * 0.5 - i * 0.012, 0), 0xffe680, 1);
  return { geo: P.build(), wig: { mode: 0, amp: L.tail === 'lunate' ? 0.11 : 0.17, wave: 6, pow: 2 } };
}

// ----------------------------------------------------------------------------------------------- puffer
function pufferGeo(L) {
  const P = new Parts(), body = C(L.body), belly = C(L.belly);
  P.add(sphere(0.5, 14, 10), mat(0.04, 0, 0, 0.88, 0.9, 0.88), (v, c) => c.copy(belly).lerp(body, smooth(-0.15, 0.1, v.y)));
  const N = 34;
  for (let i = 0; i < N; i++) {      // spikes spread evenly over the ball
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    const d = V(Math.cos(a) * r * 0.88, y * 0.9, Math.sin(a) * r * 0.88);
    P.add(cone(0.016, 0.075, 4), aim(V(0.04 + d.x * 0.48, d.y * 0.48, d.z * 0.48), d), 0xf2e6c8);
  }
  P.add(poly([[-0.4, 0, 0], [-0.58, 0.12, 0], [-0.62, 0, 0], [-0.58, -0.12, 0]]), mat(), L.body);
  for (const s of [-1, 1]) P.add(sphere(0.5, 8, 6), mat(0.12, -0.08, s * 0.4, 0.12, 0.03, 0.09, 0, 0, s * 0.3), L.belly);
  eyes(P, 0.3, 0.13, 0.27, 0.06);
  P.add(sphere(0.5, 6, 5), mat(0.47, -0.04, 0, 0.06, 0.04, 0.12), 0xf0a0a0);
  const R = rng(3); for (let i = 0; i < 9; i++) { const a = R() * 6.28, x = (R() - 0.5) * 0.5; P.add(sphere(0.03, 5, 4), mat(x, 0.34 + R() * 0.05, Math.sin(a) * 0.2), L.spot); }
  return { geo: P.build(), wig: { mode: 0, amp: 0.12, wave: 6, pow: 2 } };
}

// ----------------------------------------------------------------------------------------------- manta ray
function rayGeo(L) {
  const P = new Parts(), body = C(L.body), belly = C(L.belly);
  const wing = [[0.42, 0, 0], [0.12, 0, 0.98], [-0.2, 0, 0.56], [-0.34, 0, 0], [-0.2, 0, -0.56], [0.12, 0, -0.98]];
  P.add(poly(wing.map(p => [p[0], p[1] + 0.012, p[2]])), mat(), (v, c) => c.copy(body).lerp(C(0x4a5a7a), smooth(0.4, 1.0, Math.abs(v.z)) * 0.4));
  P.add(poly(wing.map(p => [p[0], p[1] - 0.012, p[2]])), mat(), belly);
  P.add(sphere(0.5, 10, 7), mat(0.02, 0, 0, 0.7, 0.2, 0.3), (v, c) => c.copy(belly).lerp(body, smooth(-0.02, 0.04, v.y)));
  for (const s of [-1, 1]) {
    P.add(cone(0.035, 0.2, 5).rotateZ(-Math.PI / 2), mat(0.52, 0, s * 0.11), L.body);       // the two head "horns"
    P.add(sphere(0.03, 6, 5), mat(0.34, 0.05, s * 0.2), 0x10121c);
    P.add(sphere(0.5, 6, 5), mat(0.08, 0.025, s * 0.2, 0.08, 0.02, 0.05), L.spot);          // white shoulder marks
  }
  P.add(cone(0.03, 0.62, 5).rotateZ(Math.PI / 2), mat(-0.62, 0, 0), L.body);                // long whip tail
  return { geo: P.build(), wig: { mode: 1, amp: 0.22, wave: 3, pow: 1 } };
}

// ----------------------------------------------------------------------------------------------- jellyfish
function jellyGeo(L) {
  const P = new Parts(), body = C(L.body), belly = C(L.belly), g = L.glow ?? 0;
  P.add(new THREE.SphereGeometry(0.5, 14, 7, 0, 6.283, 0, 1.5708), mat(0, 0.08, 0, 1, 0.7, 1), (v, c) => c.copy(belly).lerp(body, smooth(0.08, 0.4, v.y)), g);
  P.add(new THREE.TorusGeometry(0.5, 0.025, 5, 16).rotateX(Math.PI / 2), mat(0, 0.08, 0), belly, g + 0.2);
  for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.4; P.add(sphere(0.07, 6, 5), mat(Math.cos(a) * 0.15, 0.18, Math.sin(a) * 0.15, 1, 0.4, 1), belly, g + 0.25); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, r = 0.42; P.add(cone(0.014, 0.85, 4).rotateX(Math.PI), mat(Math.cos(a) * r, -0.35, Math.sin(a) * r), belly, g); }
  for (let i = 0; i < 4; i++) { const a = i * 1.5708; P.add(cone(0.05, 0.6, 4).rotateX(Math.PI), mat(Math.cos(a) * 0.14, -0.22, Math.sin(a) * 0.14), body, g + 0.1); }
  return { geo: P.build(), wig: { mode: 2, amp: 0.1, wave: 1, pow: 1 }, alpha: L.alpha ?? 0.75 };
}

// ----------------------------------------------------------------------------------------------- anglerfish
function anglerGeo(L) {
  const P = new Parts(), body = C(L.body), belly = C(L.belly);
  P.add(sphere(0.5, 12, 9), mat(0.08, 0, 0, 1.0, 1.0, 0.92), (v, c) => c.copy(belly).lerp(body, smooth(-0.2, 0.1, v.y)));
  P.add(sphere(0.5, 8, 6), mat(0.18, -0.22, 0, 0.66, 0.2, 0.7), belly);                                  // the big lower jaw
  for (let i = -4; i <= 4; i++) { const z = i * 0.058, x = 0.5 - Math.abs(i) * 0.012; P.add(cone(0.013, 0.1, 4), mat(x, -0.14, z), 0xf4f0e0); P.add(cone(0.013, 0.09, 4).rotateX(Math.PI), mat(x - 0.02, -0.02, z), 0xf4f0e0); }
  for (const s of [-1, 1]) { P.add(sphere(0.05, 7, 5), mat(0.3, 0.17, s * 0.3), 0xfff0a0, 0.6); P.add(sphere(0.026, 6, 5), mat(0.34, 0.17, s * 0.33), 0x10121c); }
  P.add(sphere(0.5, 8, 6), mat(-0.36, 0, 0, 0.46, 0.34, 0.3), body);
  P.add(poly([[-0.52, 0, 0], [-0.72, 0.2, 0], [-0.78, 0, 0], [-0.72, -0.2, 0]]), mat(), body);
  for (const s of [-1, 1]) P.add(poly([[0.05, -0.15, s * 0.28], [-0.05, -0.38, s * 0.5], [-0.2, -0.12, s * 0.3]]), mat(), belly);
  // the lantern: a thin stalk with a glowing bulb
  const a = V(0.25, 0.4, 0), b = V(0.66, 0.6, 0), mid = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a);
  P.add(new THREE.CylinderGeometry(0.008, 0.012, dir.length(), 4), aim(mid, dir), 0x2a2030);
  P.add(sphere(0.07, 8, 6), mat(b.x, b.y, b.z), L.lure, 1);
  P.add(sphere(0.11, 8, 6), mat(b.x, b.y, b.z), L.lure, 0.5);
  return { geo: P.build(), wig: { mode: 0, amp: 0.12, wave: 6, pow: 2 } };
}

// ----------------------------------------------------------------------------------------------- eels and ribbonfish
function eelGeo(L) {
  const P = new Parts(), n = L.n ?? 14, body = C(L.body), band = C(L.band), h = L.h ?? 0.06;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = 0.5 - t * 1.0, taper = 1 - 0.7 * t * t, seg = 1.05 / n;
    const isBand = !L.flat && i % 3 === 1;
    P.add(sphere(0.5, 8, 6), mat(x, 0, 0, seg, h * taper * (L.flat ? 3.2 : 1), h * taper * (L.flat ? 0.75 : 1)), isBand ? band : body, isBand ? 1 : 0);
    if (L.crest) P.add(cone(0.014, 0.07 * (1.2 - t), 4), mat(x, h * taper * 3.2 * 0.5 + 0.015, 0), L.crest);
  }
  P.add(sphere(0.5, 8, 6), mat(0.5, 0, 0, 0.1, h * (L.flat ? 3.4 : 1.5), h * (L.flat ? 1 : 1.4)), body);
  eyes(P, 0.52, h * (L.flat ? 0.7 : 0.4), h * (L.flat ? 0.55 : 0.6), L.flat ? 0.028 : 0.022);
  if (L.flat) for (const s of [-1, 1]) P.add(cone(0.008, 0.25, 4).rotateX(Math.PI), mat(0.4, -0.12, s * 0.02), L.crest);
  else for (const s of [-1, 1]) P.add(poly([[0.38, 0, s * h * 0.6], [0.3, -h * 1.6, s * h * 1.8], [0.26, 0, s * h * 0.6]]), mat(), band, 0.5);
  return { geo: P.build(), wig: { mode: 0, amp: L.flat ? 0.07 : 0.09, wave: L.flat ? 9 : 11, pow: 0.6 } };
}

// ----------------------------------------------------------------------------------------------- squid
function squidGeo(L) {
  const P = new Parts(), body = C(L.body), belly = C(L.belly), gc = C(L.glowC), g = L.glow ?? 0.4, big = L.titan;
  P.add(sphere(0.5, 12, 8), mat(-0.28, 0, 0, 0.62, 0.2, 0.2), (v, c) => c.copy(belly).lerp(body, smooth(-0.04, 0.05, v.y)), g * 0.4);
  P.add(sphere(0.5, 8, 6), mat(0.04, 0, 0, 0.22, 0.17, 0.17), body, g * 0.4);
  for (const s of [-1, 1]) {
    P.add(poly([[-0.42, 0, s * 0.08], [-0.62, 0, s * 0.34], [-0.7, 0, s * 0.06]]), mat(), belly, g);
    eyes(P, 0.08, 0.04, 0.15, 0.05);
  }
  P.add(cone(0.05, 0.18, 5).rotateZ(Math.PI / 2), mat(-0.62, 0, 0), body, g * 0.4);
  for (let i = 0; i < 8; i++) {   // eight arms
    const a = (i / 8) * 6.283, d = V(1, Math.sin(a) * 0.12, Math.cos(a) * 0.12);
    P.add(cone(0.026, 0.42, 5), aim(V(0.3, Math.sin(a) * 0.05, Math.cos(a) * 0.05).add(d.clone().multiplyScalar(0.0)), d), body, g * 0.3);
  }
  for (const z of [-0.035, 0.035]) { P.add(cone(0.012, 0.62, 4), aim(V(0.4, 0.0, z), V(1, 0, 0)), belly, g * 0.3); P.add(sphere(0.03, 6, 5), mat(0.72, 0, z), gc, 1); }
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) P.add(sphere(0.016, 5, 4), mat(-0.12 - i * 0.07, 0.07, s * 0.06), gc, 1);
  if (big) for (let i = 0; i < 6; i++) P.add(cone(0.014, 0.1, 4), mat(0.05, -0.1, (i - 2.5) * 0.04), 0xffe0f0);
  return { geo: P.build(), wig: { mode: 0, amp: 0.1, wave: 5, pow: 1.5 } };
}

// ----------------------------------------------------------------------------------------------- sharks
export function sharkGeo(L) {
  const P = new Parts(), body = C(L.body), belly = C(L.belly);
  const shade = (v, c) => c.copy(belly).lerp(body, smooth(-0.025, 0.02, v.y));
  P.add(sphere(0.5, 14, 9), mat(-0.02, 0, 0, 1.0, 0.24, 0.22), shade);
  if (L.hammer) {
    P.add(new THREE.BoxGeometry(0.1, 0.05, 0.66), mat(0.42, 0.0, 0), shade);
    for (const s of [-1, 1]) P.add(sphere(0.026, 6, 5), mat(0.46, 0.0, s * 0.33), 0x10121c);
  } else if (L.goblin) {
    P.add(poly([[0.4, 0.03, 0], [0.84, 0.0, 0.0], [0.62, 0.0, 0.08], [0.62, 0.0, -0.08]]).clone(), mat(), 0xf2b8c4);
    P.add(sphere(0.5, 8, 6), mat(0.34, 0, 0, 0.3, 0.2, 0.24), shade);
    for (const s of [-1, 1]) P.add(sphere(0.022, 6, 5), mat(0.32, 0.05, s * 0.1), 0x10121c);
    for (let i = -3; i <= 3; i++) P.add(cone(0.011, 0.07, 4).rotateX(Math.PI), mat(0.42, -0.06, i * 0.028), 0xffffff);
  } else {
    P.add(cone(0.1, 0.22, 7).rotateZ(-Math.PI / 2), mat(0.5, 0, 0, 1, 1, 0.95), shade);
    for (const s of [-1, 1]) P.add(sphere(0.022, 6, 5), mat(0.34, 0.045, s * 0.1), 0x10121c);
  }
  for (let i = -2; i <= 2; i++) P.add(cone(0.011, 0.065, 4).rotateX(Math.PI), mat(L.hammer ? 0.46 : 0.4, -0.085, i * 0.026), 0xffffff);
  P.add(poly([[0.14, 0.1, 0], [-0.02, 0.4, 0], [-0.16, 0.1, 0]]), mat(), body);                                      // the big dorsal fin
  P.add(poly([[-0.28, 0.08, 0], [-0.34, 0.17, 0], [-0.4, 0.07, 0]]), mat(), body);
  for (const s of [-1, 1]) P.add(poly([[0.18, -0.08, s * 0.1], [-0.02, -0.28, s * 0.5], [-0.12, -0.1, s * 0.1]]), mat(), body);
  P.add(poly([[-0.44, 0, 0], [-0.74, 0.34, 0], [-0.62, 0.02, 0], [-0.68, -0.18, 0]]), mat(), body);                  // tail: the top lobe is longer
  for (let i = 0; i < 3; i++) P.add(new THREE.BoxGeometry(0.012, 0.09, 0.005), mat(0.17 - i * 0.025, 0, 0.098 - i * 0.003), 0x40505c);
  return { geo: P.build(), wig: { mode: 0, amp: 0.14, wave: 5, pow: 1.5 } };
}

// ----------------------------------------------------------------------------------------------- the front door
// Give it a species from data.js and get back the geometry, how it wiggles, and its see-through level.
export function buildSpecies(sp) {
  const L = sp.look;
  const r = sp.shape === 'puffer' ? pufferGeo(L) : sp.shape === 'ray' ? rayGeo(L) : sp.shape === 'jelly' ? jellyGeo(L)
    : sp.shape === 'angler' ? anglerGeo(L) : sp.shape === 'eel' ? eelGeo(L) : sp.shape === 'squid' ? squidGeo(L) : fishGeo(L);
  return r;
}
export function speciesMaterial(built) {
  const w = built.wig;
  return litMaterial({ mode: w.mode, amp: w.amp, wave: w.wave, pow: w.pow, alpha: built.alpha, glow: 1.6 });
}
