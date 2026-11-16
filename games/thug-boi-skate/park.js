// The skateparks: builds the 3D blocks AND the numbers the skater uses to roll on them.
// Every ramp/box is a "solid" with a height function h(x,z) (-1 = not here). height(x,z) = the highest solid.
// Bowls are a solid too: a flat floor, curved walls all around and a flat deck on top (so no digging needed).
import * as THREE from './three.module.min.js?v=1';

const FLAT = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

class Solid {
  constructor(o) {
    Object.assign(this, o);
    this.ux = Math.cos(o.a); this.uz = Math.sin(o.a);   // direction the ramp rises
    this.vx = -this.uz; this.vz = this.ux;              // sideways
    this.cx = o.x + this.ux * o.L / 2; this.cz = o.z + this.uz * o.L / 2;       // bounding circle (so height() can skip far away solids quickly)
    this.r2 = Math.pow(Math.hypot(o.L / 2, o.W / 2) + 1, 2);
  }
  h(x, z) {
    const dx = x - this.x, dz = z - this.z;
    const u = dx * this.ux + dz * this.uz;
    if (u < 0 || u > this.L) return -1;
    const v = dx * this.vx + dz * this.vz;
    if (Math.abs(v) > this.W / 2) return -1;
    return this.prof(u, v);
  }
  pt(u, v, y) { return new THREE.Vector3(this.x + this.ux * u + this.vx * v, y, this.z + this.uz * u + this.vz * v); }
}

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function windowTexture(cols, rows, lit, dark) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
  const cw = 128 / cols, rh = 128 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    g.fillStyle = (i * 7 + j * 3) % 5 === 0 ? lit[(i + j) % lit.length] : dark;
    g.fillRect(i * cw + cw * 0.22, j * rh + rh * 0.2, cw * 0.56, rh * 0.55);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}

// ------------------------------------------------------------------ themes
const THEMES = {
  plaza: {
    name: 'Sunny Plaza', sky: [0x5db6ff, 0xcfe9ff], ground: 0x6fb35a, floor: ['#cdc7ba', '#c2bcae', '#a9a396'], scenery: 'city',
    ramp: [0xe8833a, 0x3f7cc4, 0x1fb6a8, 0xf2c230, 0x7a5bd1, 0xd9433b], wall: 0x9a8f80, boxTop: 0xd7d1c3, boxSide: 0xa59f92,
    bowl: 0x4a8fd6, bowlFloor: 0xb9b3a6, deck: 0xdcd6c8, hemi: [0xffffff, 0xcdbf9f, 1.5],
  },
  desert: {
    name: 'Desert Canyon', sky: [0x4aa8f0, 0xffe6b8], ground: 0xe0bd7e, floor: ['#ecd3a0', '#e2c78e', '#c9a96e'], scenery: 'desert',
    ramp: [0xd9602b, 0xf2a33a, 0xb8472a, 0x3aa6a0, 0xf2d36b, 0x8a4a2a], wall: 0xa86b3c, boxTop: 0xf0dcae, boxSide: 0xc29a5c,
    bowl: 0xd9602b, bowlFloor: 0xe2c78e, deck: 0xf0dcae, hemi: [0xfff4e0, 0xe0bd7e, 1.5],
  },
  snow: {
    name: 'Snow Peak', vehicle: 'snowboard', sky: [0x5fb8ff, 0xeaf7ff], ground: 0xf4f8ff, floor: ['#dfe9f5', '#d1deee', '#9db8d6'], scenery: 'snow',
    ramp: [0x4aa8f0, 0x7fd3ff, 0xd94a4a, 0x2f7fd0, 0x9ad8ff, 0xf2a33a], wall: 0x8fa7c0, boxTop: 0xe9f2fb, boxSide: 0xaec3da,
    bowl: 0x7fd3ff, bowlFloor: 0xdbe7f3, deck: 0xf3f8fd, hemi: [0xffffff, 0xcfdceb, 1.45],
  },
  neon: {
    name: 'Neon Night', sky: [0x2c1880, 0xff9a70], ground: 0x2a2a52, floor: ['#6a6da0', '#5e6193', '#00e5ff'], scenery: 'neon',
    ramp: [0x00e5ff, 0xff3df0, 0xb6ff00, 0xffd000, 0x8a6cff, 0xff6a3d], wall: 0x4a4c80, boxTop: 0x8a8dc0, boxSide: 0x5a5c90,
    bowl: 0xff3df0, bowlFloor: 0x7a7db0, deck: 0x9a9dd0, hemi: [0xffffff, 0xb9b4ff, 1.55],
  },
  candy: {
    name: 'Candy Land', sky: [0xff9fd8, 0xfff2fa], ground: 0xffd6ea, floor: ['#fff0f7', '#ffe0ef', '#ff9ccc'], scenery: 'candy', cloud: 0xffe0f3,
    ramp: [0xff6fb5, 0x6fd8ff, 0xffe14d, 0x9a6cff, 0x5be08a, 0xff9a3d], wall: 0xe48ac0, boxTop: 0xfff5fa, boxSide: 0xf0a8d0,
    bowl: 0x6fd8ff, bowlFloor: 0xffe0ef, deck: 0xfff0f7, hemi: [0xffffff, 0xffc0e0, 1.6],
  },
  volcano: {
    name: 'Volcano Rim', sky: [0x2a0e14, 0xff7a3a], ground: 0x2a1612, floor: ['#4a3a38', '#3f302e', '#ff6a1a'], scenery: 'volcano', cloud: 0x6a4a44,
    ramp: [0xff5a1a, 0xffb020, 0x5a5a6a, 0xd9261c, 0xffd34e, 0x8a6a6a], wall: 0x4a3a38, boxTop: 0x7a6866, boxSide: 0x3f302e,
    bowl: 0xff5a1a, bowlFloor: 0x4a3a38, deck: 0x6a5654, hemi: [0xffd9b0, 0x7a4a3a, 1.55],
  },
  jungle: {
    name: 'Monkey Jungle', sky: [0x2f8f9a, 0xcdf2b4], ground: 0x2f7a3a, floor: ['#6b8a4c', '#5f7f43', '#3d5a2a'], scenery: 'jungle', cloud: 0xeaffdc,
    ramp: [0x8a5a2b, 0x3f9a4a, 0xd9a441, 0xb5532a, 0x6bbf59, 0x5a3a1a], wall: 0x4a3a28, boxTop: 0x9a7a4a, boxSide: 0x5a4226,
    bowl: 0x3f9a4a, bowlFloor: 0x56753a, deck: 0xa08050, hemi: [0xe6ffd8, 0x4a6a35, 1.5],
  },
  moon: {
    name: 'Moon Base', sky: [0x02030a, 0x2a3470], ground: 0x8a8e9a, floor: ['#9a9eaa', '#8c909c', '#5a6078'], scenery: 'moon', noClouds: true,
    ramp: [0xe8e8f0, 0x4aa8f0, 0xff7a3a, 0xffd34e, 0x35e0b0, 0xff3d6e], wall: 0x6a6e7c, boxTop: 0xc8ccd8, boxSide: 0x8a8e9c,
    bowl: 0x4aa8f0, bowlFloor: 0xaab0c0, deck: 0xc8ccd8, hemi: [0xdfe6ff, 0x70788c, 1.5],
  },
};

export const PARK_IDS = Object.keys(THEMES);

export function buildPark(scene, parkId = 'plaza') {
  const T = THEMES[parkId] || THEMES.plaza;
  const solids = [];
  const rails = [];
  const occ = [];            // circles {x,z,r} that new pieces must stay away from
  const hurtChains = [];     // rails that hurt when you run into them: {cx,cz,rad2,segs:[rail,...]}
  const root = new THREE.Group();
  scene.add(root);
  const col = (i) => T.ramp[i % T.ramp.length];

  // ---------- helpers to make things ----------
  function group(o) {
    const grp = new THREE.Group();
    grp.position.set(o.x, 0, o.z); grp.rotation.y = -o.a;
    root.add(grp);
    return grp;
  }

  function addRail(A, B) {
    const dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz);
    const r = { a: A, b: B, len, dx: dx / len, dz: dz / len };
    rails.push(r);
    return r;
  }

  function box(o) {
    const s = new Solid({ ...o, prof: () => o.H });
    solids.push(s);
    const grp = group(o);
    const side = FLAT(o.side || T.boxSide), top = FLAT(o.top || T.boxTop);
    const m = new THREE.Mesh(new THREE.BoxGeometry(o.L, o.H, o.W), [side, side, top, side, side, side]);
    m.position.set(o.L / 2, o.H / 2, 0);
    grp.add(m);
    if (o.edge !== undefined) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(o.L + 0.02, 0.06, o.W + 0.02), FLAT(o.edge));
      e.position.set(o.L / 2, o.H - 0.01, 0);
      grp.add(e);
    }
    if (o.grind !== false) {          // every box / ledge can be ground (set grind: false to switch off)
      const c = [[0, -o.W / 2], [o.L, -o.W / 2], [o.L, o.W / 2], [0, o.W / 2]];
      for (let i = 0; i < 4; i++) addRail(s.pt(c[i][0], c[i][1], o.H), s.pt(c[(i + 1) % 4][0], c[(i + 1) % 4][1], o.H));
    }
  }

  function ramp(o, prof, pts) {
    const s = new Solid({ ...o, prof });
    solids.push(s);
    const grp = group(o);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    pts.forEach((p) => shape.lineTo(p[0], p[1]));
    const last = pts[pts.length - 1];
    if (!(Math.abs(last[0] - o.L) < 1e-6 && last[1] === 0)) shape.lineTo(o.L, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: o.W, bevelEnabled: false, curveSegments: 1, steps: 1 });
    geo.translate(0, 0, -o.W / 2);
    grp.add(new THREE.Mesh(geo, [FLAT(o.wall || T.wall), FLAT(o.color)]));
    return { s, grp };
  }

  function quarterPipe(o) {
    const { R, H } = o;
    const uTop = Math.sqrt(R * R - (R - H) * (R - H));
    const L = uTop + o.deck;
    const prof = (u) => (u <= uTop ? R - Math.sqrt(Math.max(0, R * R - u * u)) : H);
    const pts = [];
    const N = 24;
    for (let i = 1; i <= N; i++) { const u = uTop * i / N; pts.push([u, prof(u)]); }
    pts.push([L, H]);
    const { s, grp } = ramp({ ...o, L }, prof, pts);
    const cop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, o.W + 0.02), FLAT(0xe9e9e9));
    cop.position.set(uTop, H, 0); grp.add(cop);
    addRail(s.pt(uTop, -o.W / 2 + 0.4, H), s.pt(uTop, o.W / 2 - 0.4, H));      // grind the coping
    const st = new THREE.Mesh(new THREE.BoxGeometry(o.deck, 0.02, o.W - 0.6), FLAT(o.stripe || col(4)));
    st.position.set(uTop + o.deck / 2, H + 0.011, 0); grp.add(st);
  }

  function kicker(o) {
    const slope = o.H / o.L;
    ramp(o, (u) => u * slope, [[o.L, o.H]]);
  }

  function bank(o) {
    const run = o.H / Math.tan(o.angle);
    const L = run + o.deck;
    ramp({ ...o, L }, (u) => Math.min(u * Math.tan(o.angle), o.H), [[run, o.H], [L, o.H]]);
  }

  function spine(o) {
    const half = o.L / 2, slope = o.H / half;
    const { s, grp } = ramp(o, (u) => (u < half ? u * slope : (o.L - u) * slope), [[half, o.H], [o.L, 0]]);
    const cop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, o.W + 0.02), FLAT(0xe9e9e9));
    cop.position.set(half, o.H, 0); grp.add(cop);
    addRail(s.pt(half, -o.W / 2 + 0.4, o.H), s.pt(half, o.W / 2 - 0.4, o.H));    // grind the spine peak
  }

  function pyramid(o) {
    const half = o.S / 2, th = o.T / 2, slope = o.H / (half - th);
    solids.push(new Solid({ x: o.x - half, z: o.z, a: 0, L: o.S, W: o.S,
      prof: (u, v) => Math.min(o.H, (half - Math.max(Math.abs(u - half), Math.abs(v))) * slope) }));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(th * Math.SQRT2, half * Math.SQRT2, o.H, 4, 1), FLAT(o.color || col(4)));
    m.rotation.y = Math.PI / 4; m.position.set(o.x, o.H / 2, o.z);
    root.add(m);
  }

  // A BOWL: flat floor L x W (centre x,z), curved walls all round, flat deck on top.
  // gate: 'N' | 'S' | 'E' | 'W' = a side where the wall is open so you can roll in and out.
  function bowl(o) {
    const { R, H } = o;
    const uTop = Math.sqrt(R * R - (R - H) * (R - H));
    const reach = uTop + o.deck;
    const hl = o.L / 2, hw = o.W / 2, gw = o.gateW || 0, gate = o.gate || null;
    const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const dist = (px, pz) => Math.hypot(Math.max(Math.abs(px) - hl, 0), Math.max(Math.abs(pz) - hw, 0));
    function hAt(px, pz) {
      const d = dist(px, pz);
      if (d > reach) return -1;
      let h = d <= uTop ? R - Math.sqrt(Math.max(0, R * R - d * d)) : H;
      if (gate) {
        let lat, out;
        if (gate === 'N') { out = -pz - hw; lat = px; } else if (gate === 'S') { out = pz - hw; lat = px; }
        else if (gate === 'W') { out = -px - hl; lat = pz; } else { out = px - hl; lat = pz; }
        if (out > -0.01) h *= smooth(gw / 2, gw / 2 + 4, Math.abs(lat));
      }
      return h;
    }
    solids.push({ h: (x, z) => hAt(x - o.x, z - o.z) });
    // coping rails round the rim (skip the open gate side) so you can grind the edge of a bowl
    {
      const cx0 = hl + uTop, cz0 = hw + uTop, V = (x, z) => new THREE.Vector3(o.x + x, H, o.z + z);
      if (gate !== 'N') addRail(V(-hl, -cz0), V(hl, -cz0));
      if (gate !== 'S') addRail(V(-hl, cz0), V(hl, cz0));
      if (gate !== 'W') addRail(V(-cx0, -hw), V(-cx0, hw));
      if (gate !== 'E') addRail(V(cx0, -hw), V(cx0, hw));
    }
    // mesh: a grid of heights
    const step = 0.5, ex = hl + reach + 1, ez = hw + reach + 1;
    const nx = Math.ceil(2 * ex / step), nz = Math.ceil(2 * ez / step);
    const pos = [], colr = [], idx = [];
    const cFloor = new THREE.Color(T.bowlFloor), cWall = new THREE.Color(o.color || T.bowl), cCop = new THREE.Color(0xf4f4f4), cDeck = new THREE.Color(T.deck), cSide = new THREE.Color(T.wall);
    const tc = new THREE.Color();
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const px = -ex + i * step, pz = -ez + j * step;
      const h = hAt(px, pz), d = dist(px, pz);
      pos.push(o.x + px, h < 0 ? 0 : h, o.z + pz);
      if (h < 0) tc.copy(cSide);
      else if (d < 0.25 && h < 0.2) tc.copy(cFloor);
      else if (d < uTop - 0.5) tc.copy(cWall);
      else if (d < uTop + 0.5) tc.copy(cCop);
      else tc.copy(cDeck);
      if (h >= 0 && h < 0.2 && d >= 0.25) tc.copy(cFloor);
      colr.push(tc.r, tc.g, tc.b);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1;
      // skip cells that are completely outside the bowl: they would lie flat on the floor and flicker (z-fight) with it
      if (pos[a * 3 + 1] <= 0 && pos[b * 3 + 1] <= 0 && pos[c * 3 + 1] <= 0 && pos[d * 3 + 1] <= 0
        && hAt(-ex + i * step, -ez + j * step) < 0 && hAt(-ex + (i + 1) * step, -ez + (j + 1) * step) < 0) continue;
      idx.push(a, d, b, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    geo.setIndex(idx);
    // polygonOffset: the flat bowl floor sits exactly at floor height, so push it slightly toward the camera (no flicker)
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    root.add(m);
  }

  // ---------- SUNKEN PITS: bowls dug INTO the ground (deep, curved walls, any shape).
  // A pit is a shape made of circles / rings / snake paths ("signed distance"): inside = flat floor at -H, then a curved wall rises to ground level.
  // gates = ramps you can roll in and out by. The floor mesh below is built from groundAt() so the hole is real.
  const pits = [];
  const smooth01 = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  function pit(o) {
    const H = o.H, R = o.R || H * 1.12;
    const uTop = Math.sqrt(R * R - (R - H) * (R - H));
    const shapes = o.shapes;
    const sd = (x, z) => {
      let m = 1e9;
      for (let k = 0; k < shapes.length; k++) {
        const s = shapes[k];
        let d;
        if (s.t === 'c') d = Math.hypot(x - s.x, z - s.z) - s.r;
        else if (s.t === 'ring') d = Math.abs(Math.hypot(x - s.x, z - s.z) - s.R) - s.hw;
        else {                                                    // 'cap' = a snake path of points with half-width hw
          d = 1e9;
          for (let i = 0; i < s.pts.length - 1; i++) {
            const ax = s.pts[i][0], az = s.pts[i][1], vx = s.pts[i + 1][0] - ax, vz = s.pts[i + 1][1] - az;
            const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
            const dd = Math.hypot(x - (ax + vx * t), z - (az + vz * t)) - s.hw;
            if (dd < d) d = dd;
          }
        }
        if (d < m) m = d;
      }
      return m;
    };
    const gates = [];
    for (const g0 of o.gates || []) {
      const ca = Math.cos(g0.a), sa = Math.sin(g0.a);
      if (sd(g0.x, g0.z) >= 0) continue;
      let t = 0; while (sd(g0.x + ca * t, g0.z + sa * t) < 0 && t < 300) t += 0.1;
      gates.push({ bx: g0.x + ca * t, bz: g0.z + sa * t, ca, sa, w: g0.w || 8, len: g0.len || Math.max(uTop * 1.3, H * 2.7) });
    }
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    const ext = (x, z, r) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); z0 = Math.min(z0, z - r); z1 = Math.max(z1, z + r); };
    for (const s of shapes) { if (s.t === 'c') ext(s.x, s.z, s.r); else if (s.t === 'ring') ext(s.x, s.z, s.R + s.hw); else for (const p of s.pts) ext(p[0], p[1], s.hw); }
    const pad = uTop + 2 + gates.reduce((m, g) => Math.max(m, g.len + g.w), 0);
    const bb = { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad };
    const g = (x, z) => {
      if (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) return 0;
      const d = sd(x, z);
      let gh = d >= uTop ? 0 : -H + R - Math.sqrt(Math.max(0, R * R - Math.max(d, 0) * Math.max(d, 0)));
      for (let i = 0; i < gates.length; i++) {
        const gt = gates[i], px = x - gt.bx, pz = z - gt.bz, sA = px * gt.ca + pz * gt.sa, lat = Math.abs(-px * gt.sa + pz * gt.ca);
        const ramp = -H * (1 - Math.max(0, Math.min(1, sA / gt.len))) + 40 * smooth01(gt.w / 2, gt.w / 2 + 2.4, lat) + 40 * smooth01(0.5, 2.5, -sA);
        if (ramp < gh) gh = ramp;
      }
      return gh;
    };
    // coping: grindable rails all round the rim (except across the gates)
    if (o.coping !== false) {
      const curves = [];
      const circ = (cx, cz, r) => { const n = Math.max(16, Math.ceil(Math.PI * 2 * r / 1.2)); const a = []; for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2; a.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]); } return a; };
      for (const s of shapes) {
        if (s.t === 'c') curves.push(circ(s.x, s.z, s.r + uTop));
        else if (s.t === 'ring') { curves.push(circ(s.x, s.z, s.R + s.hw + uTop)); if (s.R - s.hw - uTop > 1) curves.push(circ(s.x, s.z, s.R - s.hw - uTop)); }
        else {
          for (const p of s.pts) curves.push(circ(p[0], p[1], s.hw + uTop));
          for (let i = 0; i < s.pts.length - 1; i++) {
            const ax = s.pts[i][0], az = s.pts[i][1], bx = s.pts[i + 1][0], bz = s.pts[i + 1][1], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len, off = s.hw + uTop;
            for (const sg of [1, -1]) { const a = []; const n = Math.ceil(len / 1.2); for (let k = 0; k <= n; k++) { const t = k / n; a.push([ax + (bx - ax) * t + nx * off * sg, az + (bz - az) * t + nz * off * sg]); } curves.push(a); }
          }
        }
      }
      const keep = (p) => {
        if (Math.abs(sd(p[0], p[1]) - uTop) > 0.12) return false;
        return !gates.some((gt) => { const px = p[0] - gt.bx, pz = p[1] - gt.bz, sA = px * gt.ca + pz * gt.sa, lat = Math.abs(-px * gt.sa + pz * gt.ca); return sA > -2 && sA < gt.len + 2 && lat < gt.w / 2 + 1.6; });
      };
      for (const cv of curves) {
        let run = [];
        const flush = () => { for (let i = 0; i + 1 < run.length; i += 3) { const a = run[i], b = run[Math.min(i + 3, run.length - 1)]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.5) addRail(new THREE.Vector3(a[0], 0.12, a[1]), new THREE.Vector3(b[0], 0.12, b[1])); } run = []; };
        for (const p of cv) { if (keep(p)) run.push(p); else flush(); }
        flush();
      }
    }
    pits.push({ g, sd, bb, uTop, H, color: o.color });
  }
  function groundAt(x, z) {
    let h = 0;
    for (let i = 0; i < pits.length; i++) { const v = pits[i].g(x, z); if (v < h) h = v; }
    return h;
  }

  // a metal rail on posts. y1 and y2 can differ (a rail down some stairs)
  function railBar(x1, z1, x2, z2, y1, y2 = y1) {
    const A = new THREE.Vector3(x1, y1, z1), B = new THREE.Vector3(x2, y2, z2);
    const rr = addRail(A, B);
    const len = A.distanceTo(B);
    hurtChains.push({ cx: (x1 + x2) / 2, cz: (z1 + z2) / 2, rad2: (len / 2 + 1.5) * (len / 2 + 1.5), segs: [rr] });
    occ.push({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, r: len / 2 + 1.5 });
    const hold = new THREE.Group();
    hold.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 8), FLAT(0xe3e8ee));
    bar.rotation.x = Math.PI / 2;
    hold.add(bar); root.add(hold);
    hold.lookAt(B);
    const n = Math.max(2, Math.round(len / 3) + 1);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t, py = y1 + (y2 - y1) * t;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, py, 0.12), FLAT(col(0)));
      post.position.set(px, py / 2, pz); root.add(post);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), FLAT(0x4a4f5a));
      plate.position.set(px, 0.025, pz); root.add(plate);
    }
  }

  // ---------- HAZARDS & FLOOR PADS (each park has its own): ice / sand / goo / lava patches, bounce pads, speed strips, low-gravity zones
  const hazards = [];
  const hzr = seeded(901 + parkId.length * 17);
  function patchTexture(type) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), R = hzr;
    const fill = { ice: '#bff1ff', sand: '#9a7440', goo: '#ff6fb8', lava: '#ff4a12', boost: '#12a35a', lowg: '#8fb8ff' }[type] || '#888';
    g.fillStyle = fill; g.fillRect(0, 0, 64, 64);
    if (type === 'ice') { g.strokeStyle = '#ffffff'; g.lineWidth = 2; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(R() * 64, R() * 64); g.lineTo(R() * 64, R() * 64); g.stroke(); } g.strokeStyle = '#7fd0ee'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(R() * 64, R() * 64); g.lineTo(R() * 64, R() * 64); g.stroke(); } }
    else if (type === 'sand') { g.strokeStyle = '#d9b676'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(32, 32, 6 + i * 8, 0, 6.3); g.stroke(); } }
    else if (type === 'goo') { g.fillStyle = '#ffc2e2'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(R() * 64, R() * 64, 3 + R() * 6, 0, 6.3); g.fill(); } }
    else if (type === 'lava') { g.fillStyle = '#b32a08'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(R() * 64, R() * 64, 6 + R() * 8, 0, 6.3); g.fill(); } g.strokeStyle = '#ffd23a'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(R() * 64, R() * 64); g.lineTo(R() * 64, R() * 64); g.stroke(); } }
    else if (type === 'boost') { g.strokeStyle = '#eafff4'; g.lineWidth = 7; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(8, 12 + i * 32); g.lineTo(32, 30 + i * 32 - 16); g.lineTo(56, 12 + i * 32); g.stroke(); } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    return t;
  }
  function hazard(o) {
    const { type, x, z, w, d } = o;
    hazards.push({ type, x, z, w, d });
    if (type === 'bounce') {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 + 0.2, 0.3, 16), new THREE.MeshLambertMaterial({ color: 0xffd000, flatShading: true })); base.position.y = 0.15; g.add(base);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - 0.35, w / 2 - 0.35, 0.34, 16), new THREE.MeshBasicMaterial({ color: 0xff3d6e })); ring.position.y = 0.16; g.add(ring);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); arrow.position.y = 0.8; g.add(arrow);
      root.add(g);
      return;
    }
    const tex = patchTexture(type);
    tex.repeat.set(Math.max(1, w / 4), Math.max(1, d / 4));
    const mat = (type === 'lava' || type === 'boost' || type === 'lowg') ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ map: tex });
    if (type !== 'lowg') { const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat); slab.position.set(x, 0.04, z); root.add(slab); }   // (low gravity zones are just pillars + a see-through volume, so they never roof over a pit)
    if (type === 'lava') { const glow = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.05, d + 0.5), new THREE.MeshBasicMaterial({ color: 0x5a1405 })); glow.position.set(x, 0.025, z); root.add(glow); }
    if (type === 'lowg') {
      // little wooden signs with dripping acid-green letters stand just OUTSIDE the zone (no popup in your face any more)
      const signTex = (() => {
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
        const g = cv.getContext('2d');
        g.fillStyle = '#8a5a2b'; g.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#7a4d22' : '#96622f'; g.fillRect(0, i * 64, 512, 62); }     // planks
        g.strokeStyle = 'rgba(60,34,12,.55)'; g.lineWidth = 2;
        for (let i = 0; i < 26; i++) { const y = 6 + (i * 53) % 250, x = (i * 97) % 440; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + (i % 5) * 18, y + ((i % 3) - 1) * 2); g.stroke(); }
        g.lineWidth = 12; g.strokeStyle = '#4a2c10'; g.strokeRect(6, 6, 500, 244);
        g.font = '900 78px Arial Black, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#1d3300';
        g.strokeText('LOW', 256, 112); g.strokeText('GRAVITY', 256, 196);
        g.fillStyle = '#b6ff00'; g.fillText('LOW', 256, 112); g.fillText('GRAVITY', 256, 196);
        // acid drips running down from the letters
        const dr = [[88, 118, 34], [150, 118, 58], [214, 118, 26], [300, 116, 46], [352, 118, 30], [418, 202, 38], [72, 202, 52], [140, 204, 30], [206, 202, 62], [276, 204, 34], [340, 202, 48], [398, 118, 26]];
        for (const [x, y, len] of dr) {
          g.fillStyle = '#b6ff00'; g.fillRect(x - 4, y, 8, len); g.beginPath(); g.arc(x, y + len, 7, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 2, y, 2, len);
        }
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
      })();
      const wood = new THREE.MeshLambertMaterial({ color: 0x7a4d22, flatShading: true });
      const face = new THREE.MeshBasicMaterial({ map: signTex });
      const sign = (sx, sz, ry) => {
        const gy = groundAt(sx, sz);
        if (gy < -0.2) return;                                           // never on a pit wall
        const grp = new THREE.Group(); grp.position.set(sx, Math.max(0, gy), sz); grp.rotation.y = ry;
        for (const px of [-1.3, 1.3]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.9, 0.18), wood); post.position.set(px, 0.95, 0); grp.add(post); }
        const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.12), [wood, wood, wood, wood, face, face]); board.position.set(0, 1.55, 0); grp.add(board);
        root.add(grp);
      };
      const gap = 26;
      for (const [nx, nz, len, cxs, czs, ry] of [[0, 1, w, x, z + d / 2 + 2.5, 0], [0, -1, w, x, z - d / 2 - 2.5, Math.PI], [1, 0, d, x + w / 2 + 2.5, z, Math.PI / 2], [-1, 0, d, x - w / 2 - 2.5, z, -Math.PI / 2]]) {
        const cnt = Math.max(1, Math.round(len / gap));
        for (let i = 0; i < cnt; i++) {
          const f = (i + 0.5) / cnt - 0.5;
          sign(cxs + (nz !== 0 ? f * len : 0), czs + (nx !== 0 ? f * len : 0), ry);
        }
      }
      const vol = new THREE.Mesh(new THREE.BoxGeometry(w, 16, d), new THREE.MeshBasicMaterial({ color: 0x7fb0ff, transparent: true, opacity: 0.1, depthWrite: false })); vol.position.set(x, 8, z); root.add(vol);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 16, 0.5), new THREE.MeshBasicMaterial({ color: 0x9fd0ff })); p.position.set(x + sx * w / 2, 8, z + sz * d / 2); root.add(p); }
    }
  }
  // drop n hazards of one type on random FLAT free ground inside region (never on ramps, never near the spawn or each other)
  function scatter(type, n, w, d, region, spawn) {
    let placed = 0, tries = 0;
    while (placed < n && tries < 3000) {
      tries++;
      const ww = hzr() < 0.5 ? w : d, dd = ww === w ? d : w;
      const x = region.minX + ww / 2 + 3 + hzr() * (region.maxX - region.minX - ww - 6), z = region.minZ + dd / 2 + 3 + hzr() * (region.maxZ - region.minZ - dd - 6);
      let ok = Math.hypot(x - spawn.x, z - spawn.z) > Math.max(ww, dd) / 2 + 14;
      for (let i = 0; ok && i <= 6; i++) for (let j = 0; ok && j <= 6; j++) { if (Math.abs(height(x - ww / 2 - 2 + (ww + 4) * i / 6, z - dd / 2 - 2 + (dd + 4) * j / 6)) > 0.001) ok = false; }
      if (ok && hazards.some((q) => Math.abs(q.x - x) < (q.w + ww) / 2 + 6 && Math.abs(q.z - z) < (q.d + dd) / 2 + 6)) ok = false;
      if (ok && occ.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + Math.max(ww, dd) / 2)) ok = false;
      if (!ok) continue;
      hazard({ type, x, z, w: ww, d: dd }); placed++;
    }
  }

  // ---------- CURVY RAILS: circles, swirls, figure-eights, hearts, stars, waves, zig-zags. All grindable (chains of short rails), and they hurt if you run into them.
  const TAUP = Math.PI * 2;
  function curveRail(o) {
    const pts = o.pts, n = pts.length, closed = !!o.closed;
    const segs = [];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01) continue;
      segs.push(addRail(new THREE.Vector3(p[0], p[2], p[1]), new THREE.Vector3(q[0], q[2], q[1])));
    }
    for (let i = 0; i + 1 < segs.length; i++) { segs[i].next = segs[i + 1]; segs[i + 1].prev = segs[i]; }
    if (closed && segs.length > 2) { segs[segs.length - 1].next = segs[0]; segs[0].prev = segs[segs.length - 1]; }
    let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= n; cz /= n;
    let rad = 0; for (const p of pts) rad = Math.max(rad, Math.hypot(p[0] - cx, p[1] - cz));
    hurtChains.push({ cx, cz, rad2: (rad + 1.5) * (rad + 1.5), segs });
    occ.push({ x: cx, z: cz, r: rad + 2.5 });
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[2], p[1])), closed, 'centripetal');
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(10, n * 2), 0.07, 6, closed), new THREE.MeshLambertMaterial({ color: o.color || 0xe3e8ee, flatShading: true })));
    let acc = 99;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      acc += Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (acc > 3.5 && p[2] > 0.35) { acc = 0; const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, p[2], 0.12), FLAT(col(0))); post.position.set(p[0], p[2] / 2, p[1]); root.add(post); }
    }
  }
  // make a polyline dense (a point every ~1 m) so grinding follows it smoothly
  function dense(verts, closed) {
    const out = [];
    const m = verts.length;
    for (let i = 0; i < (closed ? m : m - 1); i++) {
      const a = verts[i], b = verts[(i + 1) % m], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.0));
      for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k, a[2] + (b[2] - a[2]) * j / k]);
    }
    if (!closed) out.push(verts[m - 1]);
    return out;
  }
  const CURVES = {
    circle: (cx, cz, r, y) => { const n = Math.max(24, Math.ceil(TAUP * r)); return { closed: true, pts: Array.from({ length: n }, (_, i) => { const t = i / n * TAUP; return [cx + Math.cos(t) * r, cz + Math.sin(t) * r, y]; }) }; },
    spiral: (cx, cz, r0, r1, turns, y0, y1) => { const n = Math.ceil(turns * TAUP * Math.max(r0, r1)); return { closed: false, pts: Array.from({ length: n + 1 }, (_, i) => { const f = i / n, t = f * turns * TAUP, r = r0 + (r1 - r0) * f; return [cx + Math.cos(t) * r, cz + Math.sin(t) * r, y0 + (y1 - y0) * f]; }) }; },
    sine: (x, z, len, amp, waves, y, ang) => { const n = Math.ceil(len * 1.2), ca = Math.cos(ang), sa = Math.sin(ang); return { closed: false, pts: Array.from({ length: n + 1 }, (_, i) => { const u = i / n * len, v = Math.sin(i / n * waves * TAUP) * amp; return [x + ca * u - sa * v, z + sa * u + ca * v, y]; }) }; },
    eight: (cx, cz, r, y, ang) => { const n = Math.ceil(TAUP * r * 1.7), ca = Math.cos(ang), sa = Math.sin(ang); return { closed: true, pts: Array.from({ length: n }, (_, i) => { const t = i / n * TAUP, u = r * Math.sin(t) * 1.4, v = r * Math.sin(t) * Math.cos(t) * 1.4; return [cx + ca * u - sa * v, cz + sa * u + ca * v, y]; }) }; },
    heart: (cx, cz, r, y) => { const n = Math.ceil(r * 5.2); return { closed: true, pts: Array.from({ length: n }, (_, i) => { const t = i / n * TAUP, hx = 16 * Math.pow(Math.sin(t), 3), hz = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); return [cx + hx * r / 17, cz + hz * r / 17, y]; }) }; },
    star: (cx, cz, r, y) => { const v = []; for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; v.push([cx + Math.cos(t) * rr, cz + Math.sin(t) * rr, y]); } return { closed: true, pts: dense(v, true) }; },
    zigzag: (x, z, len, amp, teeth, y, ang) => { const ca = Math.cos(ang), sa = Math.sin(ang), v = []; for (let i = 0; i <= teeth * 2; i++) { const u = i / (teeth * 2) * len, w = (i % 2 ? amp : -amp); v.push([x + ca * u - sa * w, z + sa * u + ca * w, y]); } return { closed: false, pts: dense(v, false) }; },
  };

  // ---------- PUMP TRACK (a row of rollers) and MOGULS (a field of round bumps)
  function rollers(o) {                       // x,z = start, a = direction, L length, W width, H crest height, n waves
    const s = new Solid({ x: o.x, z: o.z, a: o.a, L: o.L, W: o.W, prof: (u, v) => o.H * (0.5 - 0.5 * Math.cos(TAUP * o.n * u / o.L)) * smooth01(o.W / 2, o.W / 2 - 2, Math.abs(v)) });
    solids.push(s);
    const step = 0.5, nu = Math.ceil(o.L / step), nv = Math.ceil(o.W / step), pos = [], colr = [], idx = [];
    const c1 = new THREE.Color(o.color || col(1)), c2 = new THREE.Color(o.color2 || col(3)), cc = new THREE.Color();
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const u = Math.min(o.L, i * step), v = -o.W / 2 + Math.min(o.W, j * step), y = s.prof(u, v);
      const p = s.pt(u, v, y + 0.02); pos.push(p.x, p.y, p.z);
      cc.copy(Math.floor(u / (o.L / o.n / 2)) % 2 ? c1 : c2); colr.push(cc.r, cc.g, cc.b);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    root.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  }
  function moguls(o) {                        // a field of round bumps in a w x d area
    const r = seeded(o.seed || 1), bumps = [];
    const cnt = o.n || 14;
    for (let tries = 0; bumps.length < cnt && tries < 200; tries++) {
      const bx = o.x + (r() - 0.5) * (o.w - 6), bz = o.z + (r() - 0.5) * (o.d - 6), br = o.r0 + r() * o.r1, bh = o.h0 + r() * o.h1;
      if (bumps.some((q) => Math.hypot(q.x - bx, q.z - bz) < q.r + br + 0.5)) continue;
      bumps.push({ x: bx, z: bz, r: br, h: bh });
    }
    const mr = Math.hypot(o.w, o.d) / 2 + 4;
    solids.push({ cx: o.x, cz: o.z, r2: mr * mr, h: (x, z) => { let m = -1; for (let i = 0; i < bumps.length; i++) { const q = bumps[i], d2 = ((x - q.x) * (x - q.x) + (z - q.z) * (z - q.z)) / (q.r * q.r); if (d2 < 1) { const v = q.h * (1 - d2); if (v > m) m = v; } } return m; } });
    const mat = FLAT(o.color || 0xf2f6ff);
    for (const q of bumps) {
      const pts = []; for (let k = 0; k <= 8; k++) { const d = q.r * k / 8; pts.push(new THREE.Vector2(d, q.h * (1 - (d * d) / (q.r * q.r)) + 0.01)); }
      pts.reverse();
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), mat); m.position.set(q.x, 0, q.z); root.add(m);
    }
    occ.push({ x: o.x, z: o.z, r: Math.max(o.w, o.d) / 2 + 2 });
  }

  // an ACID PIT: a sunken round pit with glowing green acid on the floor. Touching the acid costs 10,000 points (Skater.updateZones 'acid').
  function acidPit(x, z, r, Hh, gateAng) {
    pit({ H: Hh, color: 0x9be000, shapes: [{ t: 'c', x, z, r }], gates: [{ x, z, a: gateAng, w: 10 }] });
    const acid = new THREE.Mesh(new THREE.CircleGeometry(r - 0.1, 28), new THREE.MeshBasicMaterial({ color: 0xb6ff00 })); acid.rotation.x = -Math.PI / 2; acid.position.set(x, -Hh + 0.06, z); root.add(acid);
    for (let i = 0; i < 7; i++) { const a = i * 2.4, rr = (0.2 + 0.7 * ((i * 37) % 10) / 10) * r; const bub = new THREE.Mesh(new THREE.SphereGeometry(0.45 + (i % 3) * 0.2, 7, 5), new THREE.MeshBasicMaterial({ color: 0xe6ff7a })); bub.position.set(x + Math.cos(a) * rr, -Hh + 0.25, z + Math.sin(a) * rr); bub.scale.y = 0.6; root.add(bub); }
    hazards.push({ type: 'acid', x, z, w: r * 2, d: r * 2, r: r * 0.92, y: -Hh + 1.6 });
    occ.push({ x, z, r: r + 8 });
  }
  const H = { box, ramp, quarterPipe, kicker, bank, spine, pyramid, bowl, pit, acidPit, curveRail, CURVES, railBar, hazard, scatter, N: -Math.PI / 2, S: Math.PI / 2, E: 0, W: Math.PI, c: col };
  const layout = LAYOUTS[parkId] ? LAYOUTS[parkId](H) : LAYOUTS.plaza(H);
  // ---- THE BIG PARK: the old park stays in the south-middle; the park grows to twice the width and twice the depth (4x the area)
  const OB = { ...layout.bounds };
  {
    const w0 = OB.maxX - OB.minX, d0 = OB.maxZ - OB.minZ;
    layout.bounds = { minX: OB.minX - w0 / 2, maxX: OB.maxX + w0 / 2, minZ: OB.minZ - d0, maxZ: OB.maxZ };
    fillPark();
  }
  function fillPark() {
    const B2 = layout.bounds, sp = layout.spawn;
    const rnd = seeded(4242 + parkId.length * 977 + parkId.charCodeAt(0) * 13);
    const ri = (a, b) => a + rnd() * (b - a);
    const DIRS = [-Math.PI / 2, Math.PI / 2, 0, Math.PI];
    const dirp = () => DIRS[Math.floor(rnd() * 4)];
    const ci = () => Math.floor(rnd() * 6);
    for (const ch of hurtChains) occ.push({ x: ch.cx, z: ch.cz, r: Math.sqrt(ch.rad2) });
    const free = (x, z, r) => {
      if (x - r < B2.minX + 6 || x + r > B2.maxX - 6 || z - r < B2.minZ + 6 || z + r > B2.maxZ - 6) return false;
      if (Math.hypot(x - sp.x, z - sp.z) < r + 14) return false;
      for (const o of occ) if (Math.hypot(o.x - x, o.z - z) < (o.r + r) * 1.2) return false;
      const n = 2;
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (Math.abs(height(x + i * r * 1.5 / n, z + j * r * 1.5 / n)) > 0.001) return false;
      return !hazards.some((q) => Math.abs(q.x - x) < q.w / 2 + r && Math.abs(q.z - z) < q.d / 2 + r);
    };
    const along = (a) => [Math.cos(a), Math.sin(a)];
    const P = {
      kickerSmall: { r: 7, make: (x, z) => kicker({ x, z, a: dirp(), W: ri(5, 8), L: ri(3, 5), H: ri(0.8, 1.6), color: col(ci()) }) },
      kickerBig: { r: 14, make: (x, z) => kicker({ x, z, a: dirp(), W: ri(9, 14), L: ri(10, 14), H: ri(3, 5.5), color: col(ci()) }) },
      kickerHuge: { r: 22, make: (x, z) => kicker({ x, z, a: dirp(), W: ri(12, 18), L: ri(16, 22), H: ri(7, 11), color: col(ci()) }) },
      funbox: { r: 13, make: (x, z) => { const a = dirp(), [dx, dz] = along(a), hh = ri(0.8, 1.2), k = ci(); box({ x, z, a, L: 8, W: 5, H: hh, top: col(k), side: 0xb89a2a, edge: col(k + 2), grind: true }); kicker({ x: x - dx * 3.2, z: z - dz * 3.2, a, W: 5, L: 3.2, H: hh, color: col(k + 1) }); kicker({ x: x + dx * 11.2, z: z + dz * 11.2, a: a + Math.PI, W: 5, L: 3.2, H: hh, color: col(k + 1) }); } },
      gap: { r: 22, make: (x, z) => { const a = dirp(), [dx, dz] = along(a), Hh = ri(2.2, 3.6), L = ri(8, 10), gp = ri(9, 14), k = ci(), run = Hh / Math.tan(0.46), tot = L + gp + run + 3, x0 = x - dx * tot / 2, z0 = z - dz * tot / 2; kicker({ x: x0, z: z0, a, W: 9, L, H: Hh, color: col(k) }); bank({ x: x0 + dx * tot, z: z0 + dz * tot, a: a + Math.PI, W: 11, H: Hh, angle: 0.46, deck: 3, color: col(k + 2) }); } },
      ledge: { r: 15, make: (x, z) => { const a = rnd() < 0.5 ? 0 : -Math.PI / 2, [dx, dz] = along(a), L = ri(12, 26); box({ x: x - dx * L / 2, z: z - dz * L / 2, a, L, W: ri(1.2, 2), H: ri(0.5, 0.9), edge: col(ci()), grind: true }); } },
      manualPad: { r: 6, make: (x, z) => box({ x: x - 3, z, a: 0, L: 6, W: 3, H: 0.25, edge: col(ci()), grind: true }) },
      stairs: { r: 14, make: (x, z) => { const up = rnd() < 0.5 ? -Math.PI / 2 : Math.PI / 2, sg = up < 0 ? -1 : 1; for (let i = 0; i < 4; i++) box({ x: x - 5, z: z - sg * 6 + sg * i * 4, a: up, L: 4, W: 10, H: 0.6 + i * 0.6, edge: col(ci()), grind: true }); railBar(x + 6.5, z - sg * 6, x + 6.5, z + sg * 10, 1.3, 3.1); } },
      railFlat: { r: 12, make: (x, z) => { const a = rnd() < 0.5 ? 0 : Math.PI / 2, [dx, dz] = along(a), L = ri(10, 22), y = ri(0.6, 1.0); railBar(x - dx * L / 2, z - dz * L / 2, x + dx * L / 2, z + dz * L / 2, y); } },
      pyramid: { r: 11, make: (x, z) => pyramid({ x, z, S: ri(8, 14), T: ri(2.5, 4), H: ri(1.4, 3.4), color: col(ci()) }) },
      pyramidBig: { r: 18, make: (x, z) => pyramid({ x, z, S: ri(16, 24), T: ri(4, 6), H: ri(3.5, 6), color: col(ci()) }) },
      bank: { r: 10, make: (x, z) => bank({ x, z, a: dirp(), W: ri(8, 12), H: ri(1.4, 2.6), angle: 0.46, deck: 3, color: col(ci()) }) },
      bankBig: { r: 16, make: (x, z) => bank({ x, z, a: dirp(), W: ri(14, 22), H: ri(3, 5), angle: 0.5, deck: 5, color: col(ci()) }) },
      halfpipe: { r: 20, make: (x, z) => { const W = ri(10, 16), R = ri(3, 4.5), Hh = ri(2.6, 4.2), k = ci(); quarterPipe({ x, z: z - 5, a: -Math.PI / 2, W, R, H: Hh, deck: 3.2, color: col(k), stripe: col(k + 3) }); quarterPipe({ x, z: z + 5, a: Math.PI / 2, W, R, H: Hh, deck: 3.2, color: col(k), stripe: col(k + 3) }); } },
      vertpipe: { r: 24, make: (x, z) => { const W = ri(14, 20), R = ri(5, 7), Hh = ri(5, 7.5), k = ci(); quarterPipe({ x: x - 6, z, a: Math.PI, W, R, H: Hh, deck: 4, color: col(k), stripe: col(k + 3) }); quarterPipe({ x: x + 6, z, a: 0, W, R, H: Hh, deck: 4, color: col(k), stripe: col(k + 3) }); } },
      spine: { r: 12, make: (x, z) => { const a = rnd() < 0.5 ? 0 : -Math.PI / 2, [dx, dz] = along(a), L = ri(12, 18); spine({ x: x - dx * L / 2, z: z - dz * L / 2, a, W: ri(6, 9), L, H: ri(2, 3.4), color: col(ci()) }); } },
      rollers: { r: 24, make: (x, z) => { const a = rnd() < 0.5 ? 0 : -Math.PI / 2, [dx, dz] = along(a), n = 8; rollers({ x: x - dx * 20, z: z - dz * 20, a, L: 40, W: 8, H: 1.1, n, color: col(1), color2: col(3) }); } },
      moguls: { r: 19, make: (x, z) => moguls({ x, z, w: 34, d: 34, n: 16, r0: 2.2, r1: 1.6, h0: 0.5, h1: 0.7, seed: Math.floor(rnd() * 99999), color: T.mogul || 0xf2f6ff }) },
      dunes: { r: 21, make: (x, z) => moguls({ x, z, w: 40, d: 40, n: 8, r0: 5, r1: 3, h0: 0.9, h1: 1.1, seed: Math.floor(rnd() * 99999), color: 0xe9c88a }) },
      pitSmall: { r: 46, make: (x, z) => { const Hh = ri(6, 10), r = ri(8, 12), a = dirp(); pit({ H: Hh, color: col(ci()), shapes: [{ t: 'c', x, z, r }], gates: [{ x, z, a, w: 10 }] }); } },
      acidPit: { r: 30, make: (x, z) => acidPit(x, z, ri(6, 9), ri(3, 4.5), dirp()) },
      curveCircle: { r: 15, make: (x, z) => { const r = ri(7, 12), c = CURVES.circle(x, z, r, ri(0.6, 0.9)); curveRail({ ...c, color: T.railColor }); } },
      curveCircleBig: { r: 24, make: (x, z) => { const r = ri(14, 20), c = CURVES.circle(x, z, r, ri(0.7, 1.0)); curveRail({ ...c, color: T.railColor }); } },
      curveSpiral: { r: 15, make: (x, z) => { const c = CURVES.spiral(x, z, ri(9, 12), ri(2.5, 4), ri(1.5, 2.2), 0.7, ri(2.4, 3.4)); curveRail({ ...c, color: T.railColor }); } },
      curveSine: { r: 20, make: (x, z) => { const len = ri(24, 38), ang = rnd() < 0.5 ? 0 : Math.PI / 2, [dx, dz] = along(ang), c = CURVES.sine(x - dx * len / 2, z - dz * len / 2, len, ri(2.5, 4), ri(2, 3.5), ri(0.6, 0.9), ang); curveRail({ ...c, color: T.railColor }); } },
      curveEight: { r: 18, make: (x, z) => { const c = CURVES.eight(x, z, ri(7, 10), ri(0.6, 0.9), rnd() * 3); curveRail({ ...c, color: T.railColor }); } },
      curveHeart: { r: 14, make: (x, z) => { const c = CURVES.heart(x, z, ri(8, 11), 0.7); curveRail({ ...c, color: 0xff6fb0 }); } },
      curveStar: { r: 14, make: (x, z) => { const c = CURVES.star(x, z, ri(9, 12), 0.7); curveRail({ ...c, color: 0xffd34e }); } },
      curveZig: { r: 18, make: (x, z) => { const len = ri(22, 34), ang = rnd() < 0.5 ? 0 : Math.PI / 2, [dx, dz] = along(ang), c = CURVES.zigzag(x - dx * len / 2, z - dz * len / 2, len, ri(2, 3), Math.floor(ri(4, 7)), ri(0.6, 0.9), ang); curveRail({ ...c, color: T.railColor }); } },
    };
    // what each park is made of (weights): this is what makes the parks feel different
    const PAL = {
      plaza: { gap: 8, ledge: 14, stairs: 7, funbox: 6, railFlat: 8, curveSine: 6, curveCircle: 5, curveEight: 3, kickerSmall: 8, manualPad: 6, pyramid: 2, bank: 3, halfpipe: 2, pitSmall: 2 },
      desert: { kickerSmall: 9, funbox: 4, manualPad: 4, gap: 8, pyramidBig: 6, pyramid: 5, bankBig: 6, bank: 3, kickerBig: 6, ledge: 5, spine: 5, halfpipe: 3, dunes: 8, curveSine: 3, curveSpiral: 3, stairs: 3, pitSmall: 3 },
      snow: { gap: 8, moguls: 14, kickerBig: 8, kickerSmall: 5, spine: 8, bank: 5, halfpipe: 4, curveZig: 7, curveCircle: 3, ledge: 3, pitSmall: 2 },
      neon: { gap: 6, curveEight: 8, curveSine: 8, curveSpiral: 8, curveStar: 4, curveCircle: 6, railFlat: 8, ledge: 5, funbox: 4, kickerSmall: 5, stairs: 4, halfpipe: 2, curveZig: 5 },
      candy: { gap: 8, rollers: 8, funbox: 8, kickerSmall: 8, curveHeart: 7, curveStar: 5, curveSine: 5, bank: 4, spine: 3, curveCircle: 3, moguls: 3, pitSmall: 2 },
      volcano: { kickerSmall: 7, funbox: 4, railFlat: 5, manualPad: 3, gap: 8, vertpipe: 6, halfpipe: 4, kickerBig: 8, bank: 5, spine: 5, curveSpiral: 6, curveEight: 3, pyramid: 4, stairs: 4, ledge: 4, pitSmall: 2 },
      jungle: { kickerSmall: 8, kickerBig: 5, bank: 6, ledge: 8, funbox: 5, curveSpiral: 7, curveSine: 6, curveCircle: 4, curveEight: 2, halfpipe: 4, spine: 4, moguls: 6, pyramid: 4, acidPit: 8, gap: 6 },
      moon: { kickerBig: 9, halfpipe: 5, bank: 5, ledge: 4, funbox: 4, railFlat: 3, manualPad: 3, kickerSmall: 5, gap: 6, kickerHuge: 6, bankBig: 8, pyramidBig: 5, vertpipe: 5, curveCircleBig: 9, curveSpiral: 4, spine: 4, pitSmall: 4 },
    };
    const pal = PAL[parkId] || PAL.plaza, keys = Object.keys(pal), tot = keys.reduce((m, k) => m + pal[k], 0);
    const LIMIT = { acidPit: 8, pitSmall: 8, rollers: 12, moguls: 14, dunes: 14, kickerHuge: 14 };
    const count = {};
    let placed = 0, tries = 0;
    while (placed < 85 && tries < 16000) {
      tries++;
      let t = rnd() * tot, key = keys[0];
      for (const k of keys) { if (t < pal[k]) { key = k; break; } t -= pal[k]; }
      if (LIMIT[key] && (count[key] || 0) >= LIMIT[key]) continue;
      const pc = P[key];
      const x = ri(B2.minX + 12, B2.maxX - 12), z = ri(B2.minZ + 12, B2.maxZ - 12);
      if (!free(x, z, pc.r)) continue;
      pc.make(x, z);
      occ.push({ x, z, r: pc.r });
      count[key] = (count[key] || 0) + 1; placed++;
    }
    // more special floor stuff for the bigger park
    const sx = { x: sp.x, z: sp.z };
    const SP = {
      plaza: [['bounce', 12, 4, 4]], desert: [['sand', 14, 8, 12], ['boost', 6, 4, 14]], snow: [['ice', 22, 8, 12]], neon: [['boost', 14, 4, 16], ['bounce', 6, 4, 4]],
      candy: [['goo', 12, 8, 12], ['bounce', 14, 4, 4]], jungle: [['bounce', 12, 4, 4], ['boost', 6, 4, 14]], volcano: [['lava', 16, 6, 10], ['bounce', 8, 4, 4], ['boost', 5, 4, 14]], moon: [['boost', 10, 4, 14], ['lowg', 3, 40, 40]],
    };
    for (const a of SP[parkId] || []) scatter(a[0], a[1], a[2], a[3], B2, sx);
    layout.info = { placed, count };
  }
  // ---- THE MEGA JUMP: a long strip added on the south side of EVERY park.
  // Roll up the small ramp, ride over the gold launch stripes and you are fired ~19 m into the air, 70 m down the landing slope.
  const launchers = [], loops = [];
  {
    const b = layout.bounds, zc = b.maxZ + 30, x0 = OB.minX + 25, LIP = x0 + 30;
    kicker({ x: x0, z: zc, a: 0, W: 20, L: 30, H: 5, color: col(0) });
    kicker({ x: LIP + 90, z: zc, a: Math.PI, W: 20, L: 70, H: 12, color: col(0) });
    launchers.push({ x: LIP - 3, z: zc, r: 4, dx: 1, dz: 0, speed: 28, up: 24 });
    const g = group({ x: x0, z: zc, a: 0 }), th = Math.atan(5 / 30);
    const gold = new THREE.MeshBasicMaterial({ color: 0xffd000 }), pink = new THREE.MeshBasicMaterial({ color: 0xff3df0 });
    [21, 23.5, 26, 28.5].forEach((u, i) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 19.4), i % 2 ? pink : gold);
      s.position.set(u, u * (5 / 30) + 0.06, 0); s.rotation.z = th; g.add(s);
    });
    for (const sz of [-11.2, 11.2]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1, 15, 1), gold); p.position.set(31, 7.5, sz); g.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 23.4), pink); beam.position.set(31, 15, 0); g.add(beam);
    // ---- THE LOOP-DE-LOOP: roll east along the lane just south of the park (needs speed 11+) and ride the whole circle
    {
      const R = 7.5, lat = 7, lx0 = OB.minX + 42, lz0 = b.maxZ + 9, TAU = Math.PI * 2, N = 56;
      loops.push({ x: lx0, z: lz0, dx: 1, dz: 0, lx: 0, lz: 1, R, lat });
      const mA = new THREE.MeshLambertMaterial({ color: col(0), flatShading: true }), mB = new THREE.MeshLambertMaterial({ color: 0xf4f4f4, flatShading: true });
      const vU = new THREE.Vector3(), vF = new THREE.Vector3(), vX = new THREE.Vector3(), mm = new THREE.Matrix4();
      for (let i = 0; i < N; i++) {
        const th = ((i + 0.5) / N) * TAU, s = Math.sin(th), c = Math.cos(th), f = th / TAU;
        vU.set(-s, c, 0); vF.set(c, s, lat / (TAU * R)).normalize(); vX.crossVectors(vU, vF).normalize();
        const seg = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, ((TAU * R) / N) * 1.1), i % 2 ? mA : mB);
        mm.makeBasis(vX, vU, vF); seg.quaternion.setFromRotationMatrix(mm);
        seg.position.set(lx0 + R * s - vU.x * 0.22, R * (1 - c) - vU.y * 0.22, lz0 + lat * f - vU.z * 0.22);   // slab top sits 3 cm above the riding line (no flicker with the floor)
        root.add(seg);
      }
      // entry gate + gold arrows on the ground so you know where to roll in
      const gold2 = new THREE.MeshBasicMaterial({ color: 0xffd000 }), pink2 = new THREE.MeshBasicMaterial({ color: 0xff3df0 });
      for (const sz of [-3.2, 3.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), gold2); p.position.set(lx0 - 9, 2.5, lz0 + sz); root.add(p); }
      const bm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 7.4), pink2); bm.position.set(lx0 - 9, 5.2, lz0); root.add(bm);
      for (const dxa of [-6, -4, -2]) { const a = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 3.2), gold2); a.position.set(lx0 + dxa, 0.05, lz0); root.add(a); }
    }
    b.maxZ = zc + 22;
  }
  const B = layout.bounds;
  const cx = (B.minX + B.maxX) / 2, cz = (B.minZ + B.maxZ) / 2, FW = B.maxX - B.minX, FD = B.maxZ - B.minZ;

  // ---------- sky, light, ground ----------
  scene.background = new THREE.Color(T.sky[1]);
  scene.fog = new THREE.Fog(T.sky[1], 200, 900);
  root.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
  root.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(30, 55, 22);
  root.add(sun);
  {
    const geo = new THREE.SphereGeometry(800, 24, 12);
    const pos = geo.attributes.position, colors = [];
    const top = new THREE.Color(T.sky[0]), low = new THREE.Color(T.sky[1]), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / 800);
      const band = Math.round(t * 5) / 5;
      c.copy(low).lerp(top, Math.pow(band, 0.8));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -1; dome.position.set(cx, 0, cz); root.add(dome);
  }
  // grass: four big pieces AROUND the park (one huge plane would roof over the pits)
  {
    const gm = FLAT(T.ground), BIG = 1500;
    const piece = (xa, xb, za, zb) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, zb - za), gm); m.rotation.x = -Math.PI / 2; m.position.set((xa + xb) / 2, -0.3, (za + zb) / 2); root.add(m); };
    piece(cx - BIG, B.minX, cz - BIG, cz + BIG); piece(B.maxX, cx + BIG, cz - BIG, cz + BIG);
    piece(B.minX, B.maxX, cz - BIG, B.minZ); piece(B.minX, B.maxX, B.maxZ, cz + BIG);
  }
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = T.floor[0]; g.fillRect(0, 0, 64, 64);
    g.fillStyle = T.floor[1]; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
    g.fillStyle = T.floor[2]; g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8; // keeps the grid lines clean at shallow angles
    // the floor is a mesh built from groundAt(): flat 2 m tiles, and 0.5 m tiles wherever a pit is dug (so the walls are smooth)
    const pos = [], uv = [], colr = [], idx = [];
    const white = new THREE.Color(1, 1, 1), tintF = new THREE.Color(T.bowlFloor), tintW = new THREE.Color(T.bowl);
    tintF.lerp(white, 0.35); tintW.lerp(white, 0.3);
    const inBB = (p, x, z) => x >= p.bb.x0 && x <= p.bb.x1 && z >= p.bb.z0 && z <= p.bb.z1;
    const smooth = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const tmpC = new THREE.Color();
    const vert = (x, z) => {
      const y = groundAt(x, z);
      let r = 1, g = 1, bl = 1, k = 1, best = null, bd = 1e9;
      for (const p of pits) { if (!inBB(p, x, z)) continue; const d = p.sd(x, z); if (d < bd) { bd = d; best = p; } }
      if (best) {
        // smooth colours (no hard edges): paler at the rim, wall tint going down, floor tint at the bottom
        if (!best.wc) best.wc = best.color != null ? new THREE.Color(best.color).lerp(white, 0.2) : tintW;
        const f = Math.min(1, Math.max(0, -y / best.H));
        tmpC.copy(white).lerp(best.wc, smooth(0.02, 0.3, f)).lerp(tintF, smooth(0.9, 1, f));
        r = tmpC.r; g = tmpC.g; bl = tmpC.b;
        k = 1 + 0.25 * Math.max(0, 1 - Math.abs(bd - (best.uTop - 0.2)) / 0.6);                // white coping band round the rim
        k *= 1 - 0.4 * f;                                                                         // deeper = darker, so you can read the depth
      }
      pos.push(x, y, z); uv.push(x / 4, z / 4); colr.push(Math.min(1, r * k), Math.min(1, g * k), Math.min(1, bl * k));
      return pos.length / 3 - 1;
    };
    const touches = (xa, za, xb, zb) => pits.some((p) => xb > p.bb.x0 && xa < p.bb.x1 && zb > p.bb.z0 && za < p.bb.z1);
    const quad = (xa, za, xb, zb) => { const a = vert(xa, za), b = vert(xb, za), c = vert(xb, zb), d = vert(xa, zb); idx.push(a, d, b, b, d, c); };
    for (let x = B.minX; x < B.maxX - 1e-6; x += 2) for (let z = B.minZ; z < B.maxZ - 1e-6; z += 2) {
      const xe = Math.min(x + 2, B.maxX), ze = Math.min(z + 2, B.maxZ);
      if (!touches(x, z, xe, ze)) { quad(x, z, xe, ze); continue; }
      const nx = Math.max(1, Math.round((xe - x) / 0.5)), nz = Math.max(1, Math.round((ze - z) / 0.5));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) quad(x + (xe - x) * i / nx, z + (ze - z) * j / nz, x + (xe - x) * (i + 1) / nx, z + (ze - z) * (j + 1) / nz);
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fgeo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    fgeo.setIndex(idx);
    fgeo.computeVertexNormals();
    root.add(new THREE.Mesh(fgeo, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, flatShading: true })));
  }
  // low wall around the park
  {
    const wallMat = FLAT(T.deck), capMat = FLAT(col(0));
    const wall = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), wallMat); m.position.set(x, 0.5, z); root.add(m);
      const c = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), capMat); c.position.set(x, 1.03, z); root.add(c);
    };
    wall(cx, B.minZ - 0.3, FW + 1.2, 0.6); wall(cx, B.maxZ + 0.3, FW + 1.2, 0.6);
    wall(B.minX - 0.3, cz, 0.6, FD + 1.2); wall(B.maxX + 0.3, cz, 0.6, FD + 1.2);
  }

  // ---------- scenery ----------
  const rnd = seeded(parkId.length * 131 + 7);
  const halfW = FW / 2, halfD = FD / 2;
  const R0 = Math.hypot(halfW, halfD) + 70;
  const outside = (x, z, m) => x > B.minX - m && x < B.maxX + m && z > B.minZ - m && z < B.maxZ + m;
  const SCEN = {
    city() {
      const wt = [windowTexture(4, 8, ['#ffe9a8'], '#6b7a8f'), windowTexture(6, 12, ['#ffe9a8'], '#6b7a8f'), windowTexture(3, 6, ['#ffe9a8'], '#6b7a8f')];
      const bc = [0xd8b48a, 0xa6b8d0, 0xc9726a, 0xe3d48b, 0x9bc29a, 0xb8a4cf, 0xe0e0e0];
      const bld = (x, z, w, h, d, c, tx) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c, map: tx }));
        m.position.set(x, h / 2, z); root.add(m);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.8, d * 0.96), FLAT(0x4a4f5a)); roof.position.set(x, h + 0.4, z); root.add(roof);
      };
      for (let i = 0; i < 52; i++) {
        const ang = (i / 52) * Math.PI * 2 + rnd() * 0.1, r = R0 + (i % 2 ? 0 : 40) + rnd() * 20;
        bld(cx + Math.cos(ang) * r * 1.1, cz + Math.sin(ang) * r * 0.9, 14 + rnd() * 14, 18 + rnd() * 46, 14 + rnd() * 14, bc[Math.floor(rnd() * bc.length)], wt[Math.floor(rnd() * 3)]);
      }
      hills(0x5aa35a, 22); trees(110, 0x3d8f4a, 0x46a055);
    },
    desert() {
      const mesaC = [0xd9763a, 0xc9622c, 0xe08a4a];
      for (let i = 0; i < 26; i++) {
        const ang = (i / 26) * Math.PI * 2 + rnd() * 0.2, r = R0 + 20 + rnd() * 130;
        const w = 22 + rnd() * 30, h = 20 + rnd() * 40;
        const mesa = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.75, w, h, 7), FLAT(mesaC[i % 3]));
        mesa.position.set(cx + Math.cos(ang) * r, h / 2, cz + Math.sin(ang) * r);
        root.add(mesa);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.7, w * 0.76, 4, 7), FLAT(0xf0c890)); cap.position.set(mesa.position.x, h + 2, mesa.position.z); root.add(cap);
      }
      hills(0xe6c58a, 18);
      for (let i = 0; i < 90; i++) {
        const x = cx + (rnd() - 0.5) * (FW + 220), z = cz + (rnd() - 0.5) * (FD + 220);
        if (outside(x, z, 8)) continue;
        const s = 0.9 + rnd() * 0.7;
        const g = FLAT(0x4f9a4a);
        const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 4 * s, 0.9 * s), g); tr.position.set(x, 2 * s, z); root.add(tr);
        const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 1.8 * s, 0.6 * s), g); a1.position.set(x - 1 * s, 2.6 * s, z); root.add(a1);
        const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 1.4 * s, 0.6 * s), g); a2.position.set(x + 1 * s, 2.2 * s, z); root.add(a2);
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, 0.5 * s, 0.6 * s), g); h1.position.set(x - 0.5 * s, 1.9 * s, z); root.add(h1);
        const h2 = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, 0.5 * s, 0.6 * s), g); h2.position.set(x + 0.5 * s, 1.7 * s, z); root.add(h2);
      }
    },
    snow() {
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + rnd() * 0.2, r = R0 + 60 + rnd() * 140;
        const h = 60 + rnd() * 80, w = 70 + rnd() * 60;
        const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), FLAT(0x7f93b0));
        m.position.set(cx + Math.cos(ang) * r, h / 2 - 1, cz + Math.sin(ang) * r); m.rotation.y = rnd() * 3; root.add(m);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.45, h * 0.435, 6), FLAT(0xffffff)); cap.position.set(m.position.x, h * 0.79 - 1 + h * 0.004, m.position.z); cap.rotation.y = m.rotation.y; root.add(cap);
      }
      trees(150, 0x2f7a4a, 0x3d8f5a, true);
    },
    neon() {
      const lit = ['#00e5ff', '#ff3df0', '#ffd000', '#b6ff00'];
      const wt = [windowTexture(4, 10, lit, '#1b1747'), windowTexture(6, 14, lit, '#1b1747'), windowTexture(3, 8, lit, '#1b1747')];
      const tints = [0x8a6cff, 0x6c8aff, 0xff6cd0, 0x6cd0ff, 0xffffff];
      for (let i = 0; i < 60; i++) {
        const ang = (i / 60) * Math.PI * 2 + rnd() * 0.1, r = R0 + (i % 2 ? 0 : 40) + rnd() * 20;
        const w = 14 + rnd() * 14, d = 14 + rnd() * 14, h = 30 + rnd() * 80;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: tints[i % 5], map: wt[i % 3] }));
        const x = cx + Math.cos(ang) * r * 1.1, z = cz + Math.sin(ang) * r * 0.9;
        m.position.set(x, h / 2, z); root.add(m);
        const neon = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 1.2, d * 1.02), new THREE.MeshBasicMaterial({ color: [0x00e5ff, 0xff3df0, 0xffd000][i % 3] }));
        neon.position.set(x, h + 0.6, z); root.add(neon);
      }
      // glowing light posts around the park
      for (let i = 0; i < 40; i++) {
        const x = cx + (rnd() - 0.5) * (FW + 80), z = cz + (rnd() - 0.5) * (FD + 80);
        if (outside(x, z, 6)) continue;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), FLAT(0x30305a)); p.position.set(x, 4.5, z); root.add(p);
        const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.4), new THREE.MeshBasicMaterial({ color: [0x00e5ff, 0xff3df0, 0xffd000][i % 3] })); l.position.set(x, 9.4, z); root.add(l);
      }
    },
    candy() {
      const pastel = [0xff6fb5, 0x6fd8ff, 0xffe14d, 0x9a6cff, 0x5be08a, 0xff9a3d];
      for (let i = 0; i < 70; i++) {                      // giant lollipops
        const ang = rnd() * Math.PI * 2, r = R0 + 10 + rnd() * 190, s = 0.8 + rnd() * 1.2;
        const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * s, 0.45 * s, 12 * s, 8), FLAT(0xffffff)); stick.position.set(x, 6 * s, z); root.add(stick);
        const c1 = pastel[i % 6];
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.2 * s, 4.2 * s, 0.9 * s, 20), FLAT(0xffffff)); disc.rotation.x = Math.PI / 2; disc.position.set(x, 14 * s, z); root.add(disc);
        const inner = new THREE.Mesh(new THREE.CylinderGeometry(3.4 * s, 3.4 * s, 1.0 * s, 20), FLAT(c1)); inner.rotation.x = Math.PI / 2; inner.position.set(x, 14 * s, z); root.add(inner);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(1.6 * s, 1.6 * s, 1.1 * s, 20), FLAT(pastel[(i + 3) % 6])); core.rotation.x = Math.PI / 2; core.position.set(x, 14 * s, z); root.add(core);
      }
      for (let i = 0; i < 40; i++) {                      // gumdrop hills
        const ang = (i / 40) * Math.PI * 2 + rnd() * 0.2, r = R0 + 120 + rnd() * 100, rad = 22 + rnd() * 26;
        const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), FLAT(pastel[i % 6]));
        m.position.set(cx + Math.cos(ang) * r, -1, cz + Math.sin(ang) * r); m.scale.y = 0.8; root.add(m);
      }
    },
    volcano() {
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + rnd() * 0.2, r = R0 + 50 + rnd() * 130;
        const h = 50 + rnd() * 70, w = 55 + rnd() * 45;
        const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 7), FLAT(i % 2 ? 0x3a2a28 : 0x4a3432));
        m.position.set(cx + Math.cos(ang) * r, h / 2 - 1, cz + Math.sin(ang) * r); m.rotation.y = rnd() * 3; root.add(m);
        const glow = new THREE.Mesh(new THREE.ConeGeometry(w * 0.2, h * 0.17, 7), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
        glow.position.set(m.position.x, h * 0.915 - 1, m.position.z); glow.rotation.y = m.rotation.y; root.add(glow);
      }
      for (let i = 0; i < 70; i++) {                       // black rock spikes
        const x = cx + (rnd() - 0.5) * (FW + 240), z = cz + (rnd() - 0.5) * (FD + 240);
        if (outside(x, z, 8)) continue;
        const s = 1 + rnd() * 2.2;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(1.4 * s, 6 * s, 5), FLAT(0x2a1c1a)); sp.position.set(x, 3 * s, z); root.add(sp);
      }
      hills(0x2a1c1a, 14);
    },
    jungle() {
      hills(0x2f7a3a, 20);
      const leaf = [0x2f8f3a, 0x3fae4a, 0x1f7a34, 0x56c05a];
      for (let i = 0; i < 150; i++) {                                // big jungle trees all round the park
        const ang = rnd() * Math.PI * 2, r = R0 - 20 + rnd() * 170, s2 = 0.9 + rnd() * 1.3;
        const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
        if (outside(x, z, 10)) continue;
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s2, 1.4 * s2, 16 * s2, 7), FLAT(0x6a4526)); tr.position.set(x, 8 * s2, z); root.add(tr);
        for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry((5 + rnd() * 2.5) * s2, 8, 6), FLAT(leaf[(i + k) % 4])); c.position.set(x + (rnd() - 0.5) * 5 * s2, (16 + k * 1.6) * s2, z + (rnd() - 0.5) * 5 * s2); c.scale.y = 0.65; root.add(c); }
        if (i % 3 === 0) for (let k = 0; k < 3; k++) { const vn = new THREE.Mesh(new THREE.BoxGeometry(0.18, (6 + rnd() * 5) * s2, 0.18), FLAT(0x2f7a2a)); vn.position.set(x + (rnd() - 0.5) * 6 * s2, 12 * s2, z + (rnd() - 0.5) * 6 * s2); root.add(vn); }   // hanging vines
      }
      for (let i = 0; i < 90; i++) {                                 // ferns + bushes
        const x = cx + (rnd() - 0.5) * (FW + 260), z = cz + (rnd() - 0.5) * (FD + 260);
        if (outside(x, z, 8)) continue;
        const b = new THREE.Mesh(new THREE.SphereGeometry(1.4 + rnd() * 1.4, 7, 5), FLAT(leaf[i % 4])); b.position.set(x, 0.7, z); b.scale.y = 0.6; root.add(b);
      }
      for (let i = 0; i < 8; i++) {                                  // stone temples far away
        const ang = rnd() * Math.PI * 2, r = R0 + 60 + rnd() * 120;
        const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
        for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(34 - k * 7, 5, 34 - k * 7), FLAT(k % 2 ? 0x9a9a82 : 0x8a8a72)); st.position.set(x, 2.5 + k * 5, z); root.add(st); }
      }
    },
    moon() {
      hills(0x777b8a, 22);
      for (let i = 0; i < 90; i++) {                       // rocks
        const x = cx + (rnd() - 0.5) * (FW + 260), z = cz + (rnd() - 0.5) * (FD + 260);
        if (outside(x, z, 8)) continue;
        const s = 0.8 + rnd() * 2.4;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * s, 0), FLAT(0x6a6e7c)); rock.position.set(x, 0.8 * s, z); rock.scale.y = 0.7; root.add(rock);
      }
      for (let i = 0; i < 10; i++) {                       // base towers with red lights
        const ang = (i / 10) * Math.PI * 2 + rnd() * 0.3, r = R0 + 30 + rnd() * 60, h = 25 + rnd() * 30;
        const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, h, 8), FLAT(0xc8ccd8)); t.position.set(x, h / 2, z); root.add(t);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), FLAT(0x9fb0d0)); dome.position.set(x, h, z); root.add(dome);
        const lt = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff3d3d })); lt.position.set(x, h + 7, z); root.add(lt);
      }
      // stars + a big blue Earth in the sky
      const sg = new THREE.BufferGeometry(), sp = [];
      for (let i = 0; i < 700; i++) { const a = rnd() * Math.PI * 2, e = Math.acos(rnd() * 0.95 + 0.05), rr = 700; sp.push(cx + Math.cos(a) * Math.sin(e) * rr, Math.cos(e) * rr, cz + Math.sin(a) * Math.sin(e) * rr); }
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, fog: false })));
      const earth = new THREE.Mesh(new THREE.SphereGeometry(70, 20, 14), new THREE.MeshBasicMaterial({ color: 0x3a7ee0, fog: false }));
      earth.position.set(cx + 320, 260, cz - 560); root.add(earth);
      for (let i = 0; i < 5; i++) { const land = new THREE.Mesh(new THREE.SphereGeometry(70.5, 10, 8, rnd() * 6, 0.9, 0.9 + rnd(), 0.9), new THREE.MeshBasicMaterial({ color: 0x4ec26a, fog: false })); land.position.copy(earth.position); root.add(land); }
    },
  };
  function hills(color, n) {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rnd() * 0.2, r = R0 + 180 + rnd() * 90;
      const h = 30 + rnd() * 45, w = 70 + rnd() * 60;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), FLAT(color));
      hill.position.set(cx + Math.cos(ang) * r, h / 2 - 1, cz + Math.sin(ang) * r); hill.rotation.y = rnd() * 3; root.add(hill);
    }
  }
  function trees(n, c1, c2, snowy) {
    for (let i = 0; i < n; i++) {
      const x = cx + (rnd() - 0.5) * (FW + 260), z = cz + (rnd() - 0.5) * (FD + 260);
      if (outside(x, z, 9)) continue;
      const s = 0.9 + rnd() * 0.8;
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 2 * s, 0.6 * s), FLAT(0x7a5230)); tr.position.set(x, s, z); root.add(tr);
      const a = new THREE.Mesh(new THREE.ConeGeometry(1.9 * s, 3.2 * s, 6), FLAT(c1)); a.position.set(x, 3.0 * s, z); root.add(a);
      const b = new THREE.Mesh(new THREE.ConeGeometry(1.4 * s, 2.6 * s, 6), FLAT(snowy ? 0xffffff : c2)); b.position.set(x, 4.8 * s, z); root.add(b);
    }
  }
  SCEN[T.scenery]();
  const cloudMat = new THREE.MeshBasicMaterial({ color: T.cloud || (parkId === 'neon' ? 0xffb0e0 : 0xffffff), fog: false });
  for (let i = 0; i < (T.noClouds ? 0 : 14); i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(16 + j * 5, 4, 9), cloudMat); b.position.set(j * 10 - 10, (j % 2) * 2.2, (j - 1) * 2); c.add(b); }
    const ang = rnd() * Math.PI * 2, r = 120 + rnd() * 260;
    c.position.set(cx + Math.cos(ang) * r, 90 + rnd() * 40, cz + Math.sin(ang) * r);
    c.scale.setScalar(1.2 + rnd());
    root.add(c);
  }

  // ---------- physics numbers ----------
  function height(x, z) {
    let h = groundAt(x, z);
    for (let i = 0; i < solids.length; i++) { const so = solids[i]; if (so.r2 !== undefined) { const ddx = x - so.cx, ddz = z - so.cz; if (ddx * ddx + ddz * ddz > so.r2) continue; } const v = so.h(x, z); if (v >= 0 && v > h) h = v; }
    return h;
  }
  const E_ = 0.06;
  const pick = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);
  function normal(x, z, out) {
    const h0 = height(x, z);
    const gx = pick((height(x + E_, z) - h0) / E_, (h0 - height(x - E_, z)) / E_);
    const gz = pick((height(x, z + E_) - h0) / E_, (h0 - height(x, z - E_)) / E_);
    const cl = (v) => Math.max(-4.5, Math.min(4.5, v));
    return out.set(-cl(gx), 1, -cl(gz)).normalize();
  }

  // ---------- power-up discs (only shown in free skate) ----------
  const pickups = [];
  const pickGroup = new THREE.Group(); pickGroup.visible = false; root.add(pickGroup);
  {
    const pr = seeded(555 + parkId.length);
    const clear = (x, z) => {
      for (let k = 0; k < 9; k++) {
        const a = k * 0.7, r = k === 0 ? 0 : 2.4;
        if (Math.abs(height(x + Math.cos(a) * r, z + Math.sin(a) * r)) > 0.001) return false;
      }
      if (hazards.some((q) => Math.abs(q.x - x) < q.w / 2 + 3 && Math.abs(q.z - z) < q.d / 2 + 3)) return false;
      return true;
    };
    let tries = 0;
    while (pickups.length < Math.min(80, Math.round(26 * FW * FD / 20000)) && tries < 9000) {
      tries++;
      const x = B.minX + 5 + pr() * (FW - 10), z = B.minZ + 5 + pr() * (FD - 10);
      if (!clear(x, z)) continue;
      if (Math.hypot(x - layout.spawn.x, z - layout.spawn.z) < 8) continue;
      if (pickups.some((p) => Math.hypot(p.x - x, p.z - z) < 11)) continue;
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0x35ffb0 }));
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      rim.position.y = -0.05;
      const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.34), new THREE.MeshBasicMaterial({ color: 0x0a3a2a }));
      arrow.position.y = 0.12;
      const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: 0x0a3a2a }));
      a2.position.set(0.35, 0.12, 0.0); a2.rotation.y = 0.8;
      g.add(rim, disc, arrow);
      g.position.set(x, 0.9, z);
      pickGroup.add(g);
      pickups.push({ x, z, obj: g, active: true, t: 0 });
    }
  }

  function dispose() {
    scene.remove(root);
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); }); }
    });
  }

  return { id: parkId, name: T.name, vehicle: T.vehicle || 'skate', root, solids, rails, hurt: hurtChains, info: layout.info, launchers, loops, hazards, height, groundAt, normal, bounds: B, spawn: layout.spawn, pickups, pickGroup, dispose };
}

// ------------------------------------------------------------------ the park layouts
const LAYOUTS = {
  // ---------------- SUNNY PLAZA: the original park + two giant bowls and a mega roller out east
  plaza(h) {
    const { box, kicker, bank, spine, pyramid, bowl, railBar, quarterPipe, N, S, E, W, c } = h;
    // centre plaza
    quarterPipe({ x: 0, z: -18, a: N, W: 16, R: 2.9, H: 2.2, deck: 3.4, color: c(0), stripe: c(4) });
    quarterPipe({ x: 22, z: 4, a: E, W: 12, R: 2.4, H: 1.8, deck: 3, color: c(1), stripe: c(3) });
    kicker({ x: -8, z: 7, a: N, W: 4, L: 2.6, H: 1.0, color: c(2) });
    box({ x: -8, z: -1, a: N, L: 6, W: 4, H: 0.7, top: c(3), side: 0xb89a2a, edge: c(4), grind: true });
    railBar(-22, 14, -22, 0, 0.7);
    box({ x: 2, z: 11, a: E, L: 12, W: 1.0, H: 0.5, edge: c(0), grind: true });
    box({ x: 10, z: -5, a: N, L: 3.5, W: 5, H: 0.4, top: c(4), side: 0x5b45a0, grind: true });
    box({ x: 10, z: -8.5, a: N, L: 3.5, W: 5, H: 0.8, top: c(4), side: 0x5b45a0, grind: true });
    box({ x: 10, z: -12, a: N, L: 3.5, W: 5, H: 1.2, top: c(4), side: 0x5b45a0, grind: true });
    bank({ x: -19, z: -16, a: W, W: 8, H: 1.6, angle: 0.49, deck: 3, color: c(5) });
    box({ x: -9, z: 24, a: E, L: 8, W: 2, H: 0.25, edge: c(2), grind: true });
    box({ x: 3, z: 22, a: E, L: 8, W: 2, H: 0.25, edge: c(0), grind: true });
    quarterPipe({ x: 40, z: -33, a: N, W: 12, R: 2.9, H: 2.2, deck: 3.4, color: 0x3fae6a, stripe: 0xffffff });
    quarterPipe({ x: 40, z: -23, a: S, W: 12, R: 2.9, H: 2.2, deck: 3.4, color: 0x3fae6a, stripe: 0xffffff });
    kicker({ x: -46, z: 14, a: N, W: 8, L: 7, H: 3.2, color: c(3) });
    kicker({ x: -46, z: -8, a: S, W: 8, L: 7, H: 2.4, color: c(3) });
    spine({ x: -32, z: -30, a: S, W: 8, L: 8, H: 1.8, color: c(2) });
    pyramid({ x: -12, z: -36, S: 9, T: 3, H: 1.3, color: c(4) });
    pyramid({ x: 14, z: -37, S: 8, T: 2.5, H: 1.1, color: c(0) });
    box({ x: 32, z: 24, a: E, L: 6, W: 6, H: 1.0, edge: c(1) });
    box({ x: 38, z: 24, a: E, L: 1.5, W: 6, H: 0.8 }); box({ x: 39.5, z: 24, a: E, L: 1.5, W: 6, H: 0.6 });
    box({ x: 41, z: 24, a: E, L: 1.5, W: 6, H: 0.4 }); box({ x: 42.5, z: 24, a: E, L: 1.5, W: 6, H: 0.2 });
    railBar(36, 20.6, 44, 20.6, 1.75, 0.95);
    kicker({ x: 24, z: 34, a: E, W: 3, L: 2.4, H: 0.8, color: c(2) });
    box({ x: 34, z: 34, a: E, L: 14, W: 1.2, H: 0.7, edge: c(5), grind: true });
    railBar(34, 40, 46, 40, 0.55); railBar(34, 43, 46, 43, 0.8);
    box({ x: 36, z: 28.5, a: E, L: 10, W: 1.4, H: 0.45, top: c(3), side: 0xb89a2a, grind: true });
    quarterPipe({ x: -34, z: 36, a: W, W: 10, R: 1.7, H: 1.2, deck: 2, color: c(1), stripe: c(3) });
    quarterPipe({ x: -24, z: 36, a: E, W: 10, R: 1.7, H: 1.2, deck: 2, color: c(1), stripe: c(3) });
    kicker({ x: -16.4, z: 36, a: E, W: 5, L: 2.4, H: 0.6, color: c(0) });
    box({ x: -14, z: 36, a: E, L: 6, W: 5, H: 0.6, top: c(3), side: 0xb89a2a, edge: c(1), grind: true });
    kicker({ x: -5.6, z: 36, a: W, W: 5, L: 2.4, H: 0.6, color: c(0) });
    pyramid({ x: 18, z: 16, S: 7, T: 2.4, H: 1.0, color: c(2) });
    box({ x: -36, z: -6, a: S, L: 12, W: 1.2, H: 0.6, edge: c(4), grind: true });
    railBar(-30, -6, -30, 8, 0.8);
    bank({ x: 44, z: -6, a: E, W: 8, H: 1.4, angle: 0.5, deck: 3, color: c(0) });
    railBar(12, 30, 24, 30, 0.7);
    box({ x: -30, z: 20, a: E, L: 7, W: 4, H: 0.5, top: c(4), side: 0x5b45a0, edge: c(3), grind: true });
    // --- EAST DISTRICT: a deep KIDNEY POOL and a winding SNAKE RUN dug into the ground + mega roller ---
    h.pit({ H: 9, shapes: [{ t: 'c', x: 88, z: -6, r: 9 }, { t: 'c', x: 104, z: -3, r: 11 }], gates: [{ x: 82, z: -6, a: Math.PI, w: 11 }] });
    h.pit({ H: 7.5, color: 0x3fae6a, shapes: [{ t: 'cap', hw: 4.5, pts: [[70, 22], [82, 30], [94, 24], [106, 32]] }], gates: [{ x: 70, z: 22, a: Math.atan2(-8, -12), w: 10 }] });
    kicker({ x: 62, z: -42, a: E, W: 12, L: 14, H: 6.5, color: c(3) });
    kicker({ x: 100, z: -42, a: W, W: 12, L: 14, H: 5, color: c(3) });
    const bd = { minX: -62, maxX: 134, minZ: -50, maxZ: 50 }, sp = { x: 0, z: 30, h: Math.PI };
    h.scatter('bounce', 6, 4, 4, bd, sp);            // PLAZA SPECIAL: bounce pads (BOING!)
    return { bounds: bd, spawn: sp };
  },

  // ---------------- DESERT CANYON
  desert(h) {
    const { box, kicker, bank, spine, pyramid, bowl, railBar, quarterPipe, N, S, E, W, c } = h;
    // a big CLOVER pit (a middle + four lobes) and a winding CANYON RUN
    h.pit({ H: 11, shapes: [{ t: 'c', x: 0, z: -5, r: 6 }, { t: 'c', x: 11, z: -5, r: 8 }, { t: 'c', x: -11, z: -5, r: 8 }, { t: 'c', x: 0, z: 6, r: 8 }, { t: 'c', x: 0, z: -16, r: 8 }], gates: [{ x: 0, z: 8, a: Math.PI / 2, w: 12 }, { x: 0, z: -18, a: -Math.PI / 2, w: 12 }] });
    h.pit({ H: 9, color: c(2), shapes: [{ t: 'cap', hw: 5, pts: [[-32, -10], [-22, 10], [-32, 30], [-18, 48]] }], gates: [{ x: -32, z: -10, a: Math.PI, w: 11 }] });
    quarterPipe({ x: 58, z: -26, a: N, W: 20, R: 6.4, H: 5.6, deck: 4, color: c(0), stripe: c(3) });
    quarterPipe({ x: 58, z: -6, a: S, W: 20, R: 6.4, H: 5.6, deck: 4, color: c(0), stripe: c(3) });
    kicker({ x: -62, z: 60, a: N, W: 14, L: 16, H: 7.5, color: c(1) });
    kicker({ x: -62, z: 18, a: S, W: 14, L: 14, H: 6, color: c(1) });
    railBar(34, 56, 60, 56, 1.0); railBar(34, 62, 60, 62, 0.7);
    box({ x: 14, z: 46, a: N, L: 4, W: 10, H: 0.6, edge: c(3), grind: true });
    box({ x: 14, z: 42, a: N, L: 4, W: 10, H: 1.2, edge: c(3), grind: true });
    box({ x: 14, z: 38, a: N, L: 4, W: 10, H: 1.8, edge: c(3), grind: true });
    box({ x: 14, z: 34, a: N, L: 4, W: 10, H: 2.4, edge: c(3), grind: true });
    railBar(21, 46, 21, 34, 1.3, 3.1);
    pyramid({ x: -45, z: -35, S: 14, T: 4, H: 2.8, color: c(2) });
    pyramid({ x: 45, z: 45, S: 10, T: 3, H: 2, color: c(4) });
    spine({ x: -75, z: -40, a: S, W: 14, L: 16, H: 4, color: c(4) });
    bank({ x: 30, z: 30, a: W, W: 10, H: 2, angle: 0.45, deck: 4, color: c(2) });
    const bd = { minX: -85, maxX: 85, minZ: -72, maxZ: 72 }, sp = { x: 0, z: 56, h: Math.PI };
    h.scatter('sand', 9, 8, 12, bd, sp);             // DESERT SPECIAL: sand traps (slow you down: jump them!)
    h.scatter('boost', 3, 4, 14, bd, sp);
    return { bounds: bd, spawn: sp };
  },

  // ---------------- SNOW PEAK
  snow(h) {
    const { box, kicker, spine, pyramid, bowl, railBar, quarterPipe, E, W, S, c } = h;
    // a DONUT MOAT (a deep ring round an island with a spine on it) and a PEANUT lake pit
    h.pit({ H: 10, shapes: [{ t: 'ring', x: -30, z: -10, R: 22, hw: 5 }], gates: [{ x: -30, z: 12, a: Math.PI / 2, w: 11 }, { x: -52, z: -10, a: Math.PI, w: 11, len: 22 }] });
    spine({ x: -35, z: -10, a: E, L: 10, W: 6, H: 2.4, color: c(2) });
    h.pit({ H: 11, shapes: [{ t: 'c', x: 38, z: -10, r: 9 }, { t: 'c', x: 62, z: -10, r: 9 }, { t: 'cap', hw: 5, pts: [[38, -10], [62, -10]] }], gates: [{ x: 50, z: -10, a: Math.PI / 2, w: 11 }] });
    kicker({ x: 18, z: 66, a: -Math.PI / 2, W: 16, L: 18, H: 9, color: c(0) });
    kicker({ x: 18, z: 20, a: S, W: 16, L: 14, H: 7, color: c(0) });
    quarterPipe({ x: 60, z: 46, a: W, W: 20, R: 7.4, H: 7, deck: 4, color: c(1), stripe: c(2) });
    quarterPipe({ x: 78, z: 46, a: E, W: 20, R: 7.4, H: 7, deck: 4, color: c(1), stripe: c(2) });
    railBar(-70, 30, -40, 30, 1.0); railBar(-70, 36, -40, 36, 0.7);
    box({ x: -70, z: 44, a: E, L: 30, W: 1.4, H: 0.8, edge: c(2), grind: true });
    pyramid({ x: -62, z: 52, S: 14, T: 4, H: 3, color: c(4) });
    pyramid({ x: -30, z: 52, S: 10, T: 3, H: 2, color: c(3) });
    spine({ x: 52, z: -52, a: E, W: 12, L: 20, H: 3.5, color: c(5) });
    const bd = { minX: -80, maxX: 92, minZ: -72, maxZ: 72 }, sp = { x: 0, z: 58, h: Math.PI };
    h.scatter('ice', 10, 8, 12, bd, sp);             // SNOW SPECIAL: slippery ice (you lose all grip: jump over it!)
    return { bounds: bd, spawn: sp };
  },

  // ---------------- NEON NIGHT
  neon(h) {
    const { box, kicker, spine, pyramid, bowl, railBar, quarterPipe, E, W, S, c } = h;
    // a long S-SHAPED SNAKE RUN plus two round lagoons
    h.pit({ H: 12, shapes: [{ t: 'cap', hw: 6, pts: [[-50, -30], [-20, -12], [10, -30], [40, -12], [60, -28]] }], gates: [{ x: -50, z: -30, a: -Math.PI / 2, w: 11, len: 30 }, { x: 60, z: -28, a: -Math.PI / 2, w: 11, len: 30 }] });
    h.pit({ H: 9, color: c(2), shapes: [{ t: 'c', x: -62, z: 6, r: 7 }], gates: [{ x: -57, z: 6, a: 0, w: 9 }] });
    h.pit({ H: 9, color: c(2), shapes: [{ t: 'c', x: 62, z: 14, r: 8 }], gates: [{ x: 57, z: 14, a: Math.PI, w: 9 }] });
    kicker({ x: 0, z: 66, a: -Math.PI / 2, W: 14, L: 16, H: 8, color: c(0) });
    kicker({ x: 0, z: 22, a: S, W: 14, L: 14, H: 6.5, color: c(0) });
    quarterPipe({ x: 30, z: 46, a: W, W: 18, R: 6.4, H: 5.6, deck: 4, color: c(1), stripe: c(0) });
    quarterPipe({ x: 50, z: 46, a: E, W: 18, R: 6.4, H: 5.6, deck: 4, color: c(1), stripe: c(0) });
    railBar(-70, 28, -35, 28, 1.0); railBar(-70, 34, -35, 34, 0.75);
    box({ x: -70, z: 42, a: E, L: 30, W: 1.4, H: 0.8, edge: c(3), grind: true });
    pyramid({ x: -55, z: 55, S: 12, T: 4, H: 2.6, color: c(4) });
    pyramid({ x: 20, z: -60, S: 12, T: 4, H: 2.6, color: c(5) });
    const bd = { minX: -84, maxX: 84, minZ: -72, maxZ: 72 }, sp = { x: -45, z: 50, h: Math.PI };
    h.scatter('boost', 7, 4, 16, bd, sp);            // NEON SPECIAL: speed strips + bounce pads
    h.scatter('bounce', 4, 4, 4, bd, sp);
    return { bounds: bd, spawn: sp };
  },

  // ---------------- CANDY LAND: lots of small playful stuff, sticky goo and gummy bounce pads
  candy(h) {
    const { box, kicker, bank, spine, pyramid, bowl, railBar, quarterPipe, N, S, E, W, c } = h;
    // a FLOWER pit (six petals round a middle) and two round pits
    const petals = [{ t: 'c', x: 0, z: -36, r: 6 }];
    for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3 + Math.PI / 6; petals.push({ t: 'c', x: Math.cos(an) * 11, z: -36 + Math.sin(an) * 11, r: 7 }); }
    h.pit({ H: 11, color: c(0), shapes: petals, gates: [{ x: 0, z: -25, a: Math.PI / 2, w: 11 }] });
    h.pit({ H: 9, color: c(1), shapes: [{ t: 'c', x: -44, z: -5, r: 9 }], gates: [{ x: -38, z: -5, a: 0, w: 10 }] });
    h.pit({ H: 9, color: c(2), shapes: [{ t: 'c', x: 44, z: -5, r: 9 }], gates: [{ x: 38, z: -5, a: Math.PI, w: 10 }] });
    // two rainbow halfpipes
    quarterPipe({ x: -62, z: 34, a: N, W: 14, R: 4.2, H: 3.6, deck: 3, color: c(0), stripe: c(2) });
    quarterPipe({ x: -62, z: 50, a: S, W: 14, R: 4.2, H: 3.6, deck: 3, color: c(1), stripe: c(3) });
    quarterPipe({ x: 62, z: 34, a: N, W: 14, R: 4.2, H: 3.6, deck: 3, color: c(4), stripe: c(5) });
    quarterPipe({ x: 62, z: 50, a: S, W: 14, R: 4.2, H: 3.6, deck: 3, color: c(5), stripe: c(1) });
    // kicker pairs to hop across gaps, funboxes and rails in the middle
    kicker({ x: -24, z: 20, a: E, W: 8, L: 8, H: 2.6, color: c(2) });
    kicker({ x: -2, z: 20, a: W, W: 8, L: 8, H: 2.6, color: c(2) });
    kicker({ x: 14, z: 20, a: E, W: 8, L: 8, H: 3.2, color: c(4) });
    kicker({ x: 40, z: 20, a: W, W: 8, L: 8, H: 3.2, color: c(4) });
    box({ x: -6, z: 36, a: E, L: 12, W: 6, H: 1.1, edge: c(0) });
    kicker({ x: -13, z: 36, a: E, W: 6, L: 7, H: 1.1, color: c(3) });
    kicker({ x: 13, z: 36, a: W, W: 6, L: 7, H: 1.1, color: c(3) });
    railBar(-30, 52, -8, 52, 1.0); railBar(8, 52, 30, 52, 1.0);
    box({ x: -4, z: 60, a: E, L: 24, W: 1.4, H: 0.8, edge: c(5) });
    pyramid({ x: -70, z: 12, S: 9, T: 3, H: 1.6, color: c(4) });
    pyramid({ x: 70, z: 12, S: 9, T: 3, H: 1.6, color: c(0) });
    spine({ x: 22, z: 32, a: E, W: 8, L: 12, H: 2.4, color: c(5) });
    bank({ x: -64, z: -40, a: E, W: 9, H: 2, angle: 0.5, deck: 3, color: c(3) });
    bank({ x: 64, z: -40, a: W, W: 9, H: 2, angle: 0.5, deck: 3, color: c(2) });
    const bd = { minX: -80, maxX: 80, minZ: -70, maxZ: 70 }, sp = { x: 0, z: 56, h: Math.PI };
    h.scatter('goo', 7, 8, 12, bd, sp);              // CANDY SPECIAL: sticky goo (slows you: jump over it) + gummy bounce pads
    h.scatter('bounce', 8, 4, 4, bd, sp);
    return { bounds: bd, spawn: sp };
  },

  // ---------------- VOLCANO RIM: a crater bowl, big vert, and LAVA you must jump over
  volcano(h) {
    const { box, kicker, bank, spine, pyramid, bowl, railBar, quarterPipe, N, S, E, W, c } = h;
    // the CRATER: a deep ring-shaped moat round an island with a pyramid on it
    h.pit({ H: 13, color: c(0), shapes: [{ t: 'ring', x: 0, z: -14, R: 30, hw: 8 }], gates: [{ x: 0, z: 16, a: Math.PI / 2, w: 14, len: 28 }] });
    pyramid({ x: 0, z: -14, S: 9, T: 3, H: 2.4, color: c(2) });
    quarterPipe({ x: 68, z: -30, a: N, W: 18, R: 6.4, H: 5.6, deck: 4, color: c(0), stripe: c(1) });
    quarterPipe({ x: 68, z: -10, a: S, W: 18, R: 6.4, H: 5.6, deck: 4, color: c(3), stripe: c(1) });
    quarterPipe({ x: -68, z: -30, a: N, W: 18, R: 5.2, H: 4.4, deck: 4, color: c(3), stripe: c(4) });
    quarterPipe({ x: -68, z: -10, a: S, W: 18, R: 5.2, H: 4.4, deck: 4, color: c(0), stripe: c(4) });
    kicker({ x: -62, z: 62, a: N, W: 14, L: 16, H: 7, color: c(1) });
    kicker({ x: -62, z: 22, a: S, W: 14, L: 14, H: 5.6, color: c(1) });
    box({ x: 40, z: 40, a: N, L: 4, W: 10, H: 0.6, edge: c(4) });
    box({ x: 40, z: 36, a: N, L: 4, W: 10, H: 1.2, edge: c(4) });
    box({ x: 40, z: 32, a: N, L: 4, W: 10, H: 1.8, edge: c(4) });
    railBar(46, 40, 46, 32, 1.0, 2.2);
    railBar(20, 52, 44, 52, 1.0); railBar(20, 58, 44, 58, 0.7);
    box({ x: 14, z: 44, a: E, L: 22, W: 1.4, H: 0.8, edge: c(1), grind: true });
    pyramid({ x: -58, z: 8, S: 10, T: 3, H: 2, color: c(5) });
    pyramid({ x: -30, z: 40, S: 10, T: 3, H: 2, color: c(5) });
    bank({ x: 70, z: 24, a: W, W: 10, H: 2, angle: 0.45, deck: 4, color: c(2) });
    const bd = { minX: -80, maxX: 80, minZ: -70, maxZ: 70 }, sp = { x: 0, z: 56, h: Math.PI };
    h.scatter('lava', 9, 6, 10, bd, sp);             // VOLCANO SPECIAL: lava pools (touch one = bail, jump them!) + bounce pads to help
    h.scatter('bounce', 5, 4, 4, bd, sp);
    h.scatter('boost', 3, 4, 14, bd, sp);
    return { bounds: bd, spawn: sp };
  },

  // ---------------- MONKEY JUNGLE: vine rails, log ramps, a stone temple and ACID PITS
  jungle(h) {
    const { box, kicker, bank, spine, pyramid, railBar, quarterPipe, acidPit, curveRail, CURVES, N, S, E, W, c } = h;
    pyramid({ x: 0, z: -14, S: 22, T: 7, H: 5, color: c(5) });                       // the stone temple
    pyramid({ x: 0, z: -14, S: 12, T: 3, H: 7.5, color: c(2) });
    box({ x: -24, z: -14, a: E, L: 14, W: 1.6, H: 0.8, edge: c(2), grind: true });     // log ledges
    box({ x: 12, z: -14, a: E, L: 14, W: 1.6, H: 0.8, edge: c(2), grind: true });
    kicker({ x: -14, z: 22, a: N, W: 8, L: 6, H: 2.2, color: c(0) });                  // log ramps
    kicker({ x: 14, z: 22, a: N, W: 8, L: 6, H: 2.2, color: c(0) });
    kicker({ x: -50, z: 10, a: E, W: 10, L: 10, H: 3.4, color: c(0) });
    kicker({ x: 60, z: 10, a: W, W: 10, L: 10, H: 3.4, color: c(0) });
    quarterPipe({ x: -18, z: -52, a: N, W: 14, R: 3.4, H: 3, deck: 3, color: c(3), stripe: c(2) });
    quarterPipe({ x: -18, z: -42, a: S, W: 14, R: 3.4, H: 3, deck: 3, color: c(3), stripe: c(2) });
    bank({ x: 40, z: -48, a: S, W: 12, H: 2.2, angle: 0.46, deck: 3, color: c(1) });
    box({ x: -8, z: 36, a: E, L: 16, W: 1.4, H: 0.6, edge: c(4), grind: true });
    railBar(-30, 40, -30, 28, 0.8);
    // vine rails (curvy)
    let cv = CURVES.spiral(-38, -2, 9, 3, 2, 0.7, 2.8); curveRail({ ...cv, color: 0x6bbf59 });
    cv = CURVES.sine(10, 34, 34, 3, 2, 0.8, 0); curveRail({ ...cv, color: 0x6bbf59 });
    cv = CURVES.circle(44, 30, 8, 0.8); curveRail({ ...cv, color: 0x6bbf59 });
    // ACID PITS: do not fall in!
    acidPit(-44, -30, 8, 3.5, 0);
    acidPit(46, -24, 8, 3.2, Math.PI);
    acidPit(30, 12, 6.5, 3, Math.PI / 2);
    const bd = { minX: -70, maxX: 70, minZ: -62, maxZ: 58 }, sp = { x: 0, z: 46, h: Math.PI };
    h.scatter('bounce', 6, 4, 4, bd, sp);
    return { bounds: bd, spawn: sp };
  },

  // ---------------- MOON BASE: LOW GRAVITY zones = enormous air
  moon(h) {
    const { box, kicker, bank, spine, pyramid, bowl, railBar, quarterPipe, hazard, N, S, E, W, c } = h;
    // a CRATER FIELD: three overlapping craters (a big one, a medium one and a small one), very deep
    h.pit({ H: 16, color: c(1), shapes: [{ t: 'c', x: -6, z: -18, r: 16 }, { t: 'c', x: 20, z: -8, r: 11 }, { t: 'c', x: -28, z: -4, r: 8 }], gates: [{ x: -6, z: -6, a: Math.PI / 2, w: 14, len: 40 }, { x: -6, z: -30, a: -Math.PI / 2, w: 12, len: 30 }] });
    hazard({ type: 'lowg', x: 0, z: -15, w: 92, d: 78 });        // MOON SPECIAL: low-gravity zone over the crater
    quarterPipe({ x: 62, z: -30, a: N, W: 18, R: 7, H: 6.5, deck: 4, color: c(0), stripe: c(3) });
    quarterPipe({ x: 62, z: -10, a: S, W: 18, R: 7, H: 6.5, deck: 4, color: c(0), stripe: c(3) });
    hazard({ type: 'lowg', x: 64, z: -20, w: 28, d: 56 });
    kicker({ x: -66, z: 60, a: N, W: 14, L: 18, H: 7, color: c(3) });
    kicker({ x: -66, z: 20, a: S, W: 14, L: 14, H: 6, color: c(3) });
    hazard({ type: 'lowg', x: -66, z: 40, w: 24, d: 56 });
    box({ x: 30, z: 44, a: N, L: 4, W: 10, H: 0.6, edge: c(5) });
    box({ x: 30, z: 40, a: N, L: 4, W: 10, H: 1.2, edge: c(5) });
    box({ x: 30, z: 36, a: N, L: 4, W: 10, H: 1.8, edge: c(5) });
    railBar(37, 44, 37, 36, 1.0, 2.2);
    railBar(0, 58, 24, 58, 1.0); railBar(0, 52, 24, 52, 0.7);
    box({ x: -24, z: 44, a: E, L: 24, W: 1.4, H: 0.8, edge: c(1), grind: true });
    pyramid({ x: 50, z: 34, S: 10, T: 3, H: 2, color: c(4) });
    pyramid({ x: -46, z: 34, S: 10, T: 3, H: 2, color: c(4) });
    bank({ x: -80, z: -4, a: E, W: 10, H: 2, angle: 0.45, deck: 4, color: c(2) });
    const bd = { minX: -85, maxX: 85, minZ: -70, maxZ: 70 }, sp = { x: 0, z: 56, h: Math.PI };
    h.scatter('boost', 5, 4, 14, bd, sp);
    return { bounds: bd, spawn: sp };
  },
};
