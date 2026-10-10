// SKY TOWER - the tower generator. A seed always gives the same tower, so everybody can climb (and race) the same one.
// The path winds up around a square ring in stages. Every stage has a theme, a checkpoint and its own mix of obstacles.
import { rng, lerp, clamp, TAU } from './core.js?v=7';

export const JUMP = { speed: 9, v: 11.5, g: 32 };
export const L = 30, H2 = L / 2, TH = .9;
// sky: [top, middle, horizon], fog: [color, near, far], hemi: [sky, ground, strength], sun: [color, strength]
export const THEMES = [
  { name: 'Sugar Start', sky: [0x3a9bff, 0x9fdcff, 0xfff2dc], fog: [0xcfeaff, 90, 460], hemi: [0xd8eeff, 0x9ab0a0, 1.1], sun: [0xfff1d0, 2.3], pal: [0xff9ad0, 0x9ae6ff, 0xffe08a, 0xb6ffb0], core: 0xffc8e4, w: { hops: 5, beam: 1, bounce: 1.3, crumble: .4, rest: .5 } },
  { name: 'Mossy Ruins', sky: [0x2f8f6a, 0x9fe0a8, 0xfff6c8], fog: [0xc8f0d0, 80, 420], hemi: [0xe0ffe8, 0x3a8a5a, 1.05], sun: [0xfff0c0, 2.2], pal: [0x7ac070, 0x9ad08a, 0xc9c29a, 0x6aa860], core: 0x8aa878, w: { hops: 4, beam: 1.2, mover: 1.5, crumble: .8, bounce: .5, lift: .7 } },
  { name: 'Neon Night', sky: [0x0a0630, 0x3a1280, 0xff4fa8], fog: [0x2a1060, 60, 340], hemi: [0x9a8aff, 0x2a2060, .95], sun: [0xb0a0ff, 1.3], stars: .6, pal: [0x2ee6ff, 0xff4fa8, 0xffd31a, 0x8aff3a], core: 0x2a1a6a, w: { hops: 3, mover: 1.5, lift: 1, crumble: 1.2, zapper: 1.3, beam: 1 } },
  { name: 'Frost Peak', sky: [0x6aa8ff, 0xc6e6ff, 0xffffff], fog: [0xe2f0fa, 70, 380], hemi: [0xe6f4ff, 0x9ab8d8, 1.1], sun: [0xffffff, 2.0], pal: [0xdff2ff, 0xaedcf8, 0xffffff, 0xc8e6ff], core: 0xbcd8f0, w: { ice: 3.2, hops: 2, beam: 1, bounce: .6, mover: .8, lift: .6 } },
  { name: 'Lava Lamp', sky: [0x3a0f10, 0xe0562a, 0xffc06a], fog: [0xa04020, 60, 340], hemi: [0xffd0a0, 0x6a2a10, 1.0], sun: [0xffb070, 1.8], pal: [0xffa040, 0xff6a3a, 0xffd070, 0xe04a4a], core: 0x6a2418, w: { spinner: 2, hammer: 1.6, zapper: 1.5, hops: 2, crumble: 1, mover: 1 } },
  { name: 'Cloud Kingdom', sky: [0x5aa0ff, 0xdff0ff, 0xffffff], fog: [0xffffff, 90, 480], hemi: [0xeaf4ff, 0xb0c8e8, 1.15], sun: [0xfff6e0, 2.2], pal: [0xffffff, 0xfff0b0, 0xffd6f0, 0xd6e8ff], core: 0xf4f8ff, w: { mover: 2, lift: 1.5, bounce: 1.5, hops: 2, crumble: 1, beam: .5 } },
  { name: 'Toy Factory', sky: [0x3a7aff, 0xa8d0ff, 0xfff0c0], fog: [0xdfeaff, 80, 420], hemi: [0xe8f0ff, 0xa0a080, 1.1], sun: [0xfff2d0, 2.3], pal: [0xff5a5a, 0xffd31a, 0x3a8aff, 0x4acf6a], core: 0xfff0b0, w: { conveyor: 2.4, piston: 2, spinner: 1, hops: 1.5, mover: 1 } },
  { name: 'Deep Space', sky: [0x02010a, 0x140a3a, 0x4a3aa8], fog: [0x1a1038, 70, 500], hemi: [0xa0b0ff, 0x30306a, .95], sun: [0xdde4ff, 2.0], stars: 1, pal: [0xb0b8e8, 0x8a80d8, 0x7cecff, 0xe0a0ff], core: 0x3a3a78, grav: .6, w: { bounce: 2.2, hops: 3, lift: 1, mover: 1, crumble: .6 } },
  { name: 'Crystal Cave', sky: [0x14084a, 0x5a2aa8, 0x2ee6ff], fog: [0x3a1a80, 60, 340], hemi: [0xcab0ff, 0x3a1a70, 1.0], sun: [0xe0c8ff, 1.6], stars: .3, pal: [0x7cecff, 0xff7aff, 0xb0a0ff, 0x9affd0], core: 0x4a2a90, w: { hammer: 2, piston: 1.5, crumble: 2, zapper: 1.5, ice: 1, beam: 1 } },
  { name: 'Sunset Summit', sky: [0x2a3a9a, 0xff7a5a, 0xffd890], fog: [0xffc890, 80, 460], hemi: [0xffe0b0, 0xb07a4a, 1.05], sun: [0xffd9a0, 2.4], stars: .25, pal: [0xffb070, 0xff8a8a, 0xffd890, 0xff9ad0], core: 0xc08060, w: { hops: 2, mover: 1.4, lift: 1, bounce: 1, crumble: 1.2, spinner: 1.3, hammer: 1.2, piston: 1.2, zapper: 1, ice: .8, conveyor: 1, beam: 1 } },
];

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]], NORM = [[0, 1], [-1, 0], [0, -1], [1, 0]], CORN = [[-H2, -H2], [H2, -H2], [H2, H2], [-H2, H2]];
export function pathAt(s, lat = 0) {
  s = ((s % (4 * L)) + 4 * L) % (4 * L); const side = Math.floor(s / L), u = s - side * L, D = DIRS[side], N = NORM[side], C = CORN[side];
  return { x: C[0] + D[0] * u + N[0] * lat, z: C[1] + D[1] * u + N[1] * lat, dx: D[0], dz: D[1], nx: N[0], nz: N[1], side, u };
}
const tint = (c, f) => { const r = ((c >> 16) & 255) * f, g = ((c >> 8) & 255) * f, b = (c & 255) * f; return (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255); };

// opts: { stages, order: theme indexes, dBase: starting difficulty 0..1 }
export function generate(seed, opts = {}) {
  const R = rng(seed), rr = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rr(a, b + 1));
  const N = opts.stages || 10, order = opts.order || THEMES.map((_, i) => i).slice(0, N), dBase = opts.dBase || 0;
  const items = [], stages = [], hops = [];
  const cur = { s: 0, y: 2, lat: 0 }; let prev = null, theme = THEMES[order[0]], gk = 1, d = 0, si = 0;
  const pal = () => theme.pal[Math.floor(R() * theme.pal.length)];
  const fits = (gap, len) => { const s0 = cur.s + gap; return Math.floor(s0 / L) === Math.floor(cur.s / L) && (s0 - Math.floor(s0 / L) * L) + len <= L - 3.9; };
  const maxG = () => lerp(2.9, 4.1, d) * Math.sqrt(gk), size = () => lerp(5.0, 2.7, d) * rr(.85, 1.15);
  const gapToCorner = () => ((Math.floor(cur.s / L) + 1) * L) - 2.8 - cur.s;
  function put(gap, len, wid, dy, extra = {}, lat) {
    const sC = cur.s + gap + len / 2; cur.y += dy; const la = lat !== undefined ? lat : clamp(cur.lat + rr(-1, 1) * lerp(.7, 1.4, d), -2.2, 2.2), p = pathAt(sC, la);
    const it = Object.assign({ k: 'plat', x: p.x, y: cur.y, z: p.z, sx: Math.abs(p.dx) * len + Math.abs(p.dz) * wid, sz: Math.abs(p.dz) * len + Math.abs(p.dx) * wid, th: TH, col: tint(pal(), rr(.92, 1.06)), stage: si, dx: p.dx, dz: p.dz, len, wid }, extra);
    items.push(it); if (prev && !extra.noHop) hops.push([prev, it]); prev = it; cur.s = sC + len / 2; cur.lat = la; return it;
  }
  function corner(ck) {
    const sC = (Math.floor(cur.s / L) + 1) * L, size = ck ? 7.6 : 5.6, dy = ck ? .4 : rr(.2, .9); cur.y += dy; const p = pathAt(sC, 0);
    const it = { k: 'plat', x: p.x, y: cur.y, z: p.z, sx: size, sz: size, th: TH, col: ck ? 0xffffff : tint(pal(), 1.0), stage: si, len: size, wid: size, dx: p.dx, dz: p.dz, big: ck };
    if (prev) hops.push([prev, it]); items.push(it); prev = it; cur.s = sC + size / 2; cur.lat = 0; return it;
  }
  // a small stepping stone that fills the space left before a corner
  function connector() { const gc = gapToCorner(), len = clamp(gc - 2.4, 2.2, 4.0), gap = clamp((gc - len) / 2, 1.2, maxG() * .98); if (gap + len > gc - .5) return false; put(gap, len, len, rr(.2, .6) * gk); return true; }
  const SEG = {
    hops() { const n = ri(3, 6); for (let i = 0; i < n; i++) { const len = size(), gap = rr(1.5, maxG()); if (!fits(gap, len)) break; put(gap, len, len * rr(.85, 1.15), rr(.25, lerp(1.0, 1.35, d)) * gk, R() < lerp(0, .22, d) * (theme.w.crumble ? 1 : 0) ? { crumble: true } : {}); } },
    rest() { if (fits(2.2, 6.4)) put(2.2, 6.4, 6.4, rr(.2, .6)); },
    beam() { const len = rr(9, 11.5); if (fits(2.4, len)) put(2.4, len, lerp(1.9, 1.15, d), rr(.2, .7) * gk, { beam: true }); },
    crumble() { const n = ri(3, 5); for (let i = 0; i < n; i++) { const len = lerp(3.6, 3.0, d), gap = rr(1.8, 2.4 + d * .7) * Math.sqrt(gk); if (!fits(gap, len)) break; put(gap, len, len, rr(.3, .8) * gk, { crumble: true }); } },
    ice() { const n = ri(3, 5); for (let i = 0; i < n; i++) { const len = lerp(4.8, 3.6, d), gap = rr(1.8, 2.4 + d * .4); if (!fits(gap, len)) break; put(gap, len, len, rr(.2, .7) * gk, { ice: true, col: tint(0xcbeeff, rr(.94, 1.04)) }); } },
    bounce() {
      const rise = rr(6, 9) * gk, pad = 3.4, gap = rr(1.8, 2.6), land = 6.4, gap2 = rr(4.4, 6.0); if (!fits(gap, pad + gap2 + land)) return;
      const g = JUMP.g * (theme.grav || 1), v = Math.sqrt(2 * g * (rise + 1.7)); put(gap, pad, pad, 0, { bounce: v, col: 0xff4fe0, pad: true }); put(gap2, land, land, rise, { noHop: true }, 0);
    },
    mover() {
      const G = rr(9.5, 11.5 + d); if (!fits(0, G + 4.8)) return; const y0 = cur.y, dy = rr(.2, .7), sA = cur.s + 1.2 + 1.8, sB = cur.s + G - 1.2 - 1.8, p = pathAt((sA + sB) / 2, cur.lat);
      items.push({ k: 'mover', x: p.x, y: y0 + dy / 2, z: p.z, sx: Math.abs(p.dx) * 3.6 + Math.abs(p.dz) * 3.8, sz: Math.abs(p.dz) * 3.6 + Math.abs(p.dx) * 3.8, th: TH, axis: [p.dx, 0, p.dz], amp: (sB - sA) / 2, period: rr(5.2, 6.6 - d * 1.2), phase: R(), col: tint(pal(), 1.08), stage: si });
      put(G, 4.8, 4.6, dy, { noHop: true });
    },
    lift() {
      const rise = rr(5.5, 7.5) * gk; if (!fits(0, 1.4 + 3.8 + 1.4 + 4.4)) return; const y0 = cur.y, p = pathAt(cur.s + 1.4 + 1.9, cur.lat);
      items.push({ k: 'mover', x: p.x, y: y0 + rise / 2, z: p.z, sx: 3.8, sz: 3.8, th: TH, axis: [0, 1, 0], amp: rise / 2, period: rr(7, 8.5), phase: R(), col: tint(pal(), 1.1), stage: si, lift: true });
      put(1.4 + 3.8 + 1.4, 4.4, 4.4, rise, { noHop: true });
    },
    conveyor() { const len = rr(8.5, 10); if (!fits(2.2, len)) return; const sp = (R() < .5 ? 1 : -1) * rr(3.8, 4.6) * (.8 + d * .3), it = put(2.2, len, 3.8, rr(.2, .5), { conv: sp, col: 0x4a4a68 }); it.convDir = [it.dx * sp, it.dz * sp]; },
    spinner() {
      const sz = 8.6; if (!fits(2.6, sz)) return; const it = put(2.6, sz, sz, rr(.2, .5)), om = (R() < .5 ? 1 : -1) * rr(1.3, 1.9 + d * .7);
      items.push({ k: 'spin', kind: 'bar', c: [it.x, it.y + .85, it.z], len: 7.8, th: .8, wid: .7, omega: om, phase: R() * TAU, col: 0xff4a5a, stage: si });
      if (d > .55 && R() < .6) items.push({ k: 'spin', kind: 'bar', c: [it.x, it.y + .85, it.z], len: 7.8, th: .8, wid: .7, omega: om, phase: R() * TAU + Math.PI / 2, col: 0xff4a5a, stage: si });
    },
    hammer() {
      const len = 10.8; if (!fits(2.4, len)) return; const it = put(2.4, len, 4.6, rr(.2, .5)), n = d > .5 ? 3 : 2;
      for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 3.7; items.push({ k: 'spin', kind: 'hammer', c: [it.x + it.dx * off, it.y + 8.15, it.z + it.dz * off], rod: 6.4, head: 1.7, amp: lerp(1.0, 1.1, d), omega: TAU / rr(3.0, 3.6 - d * .5), phase: i * 1.7 + R(), swing: [it.dx, 0, it.dz], col: 0xff7a1a, stage: si }); }
    },
    piston() {
      const len = 10.4; if (!fits(2.4, len)) return; const it = put(2.4, len, 4.6, rr(.2, .5)), hgt = d < .45 ? 1.5 : 2.5;
      for (let i = 0; i < 2; i++) { const off = (i - .5) * 4.4; items.push({ k: 'mover', x: it.x + it.dx * off, y: it.y + hgt, z: it.z + it.dz * off, sx: Math.abs(it.dx) * 1.1 + Math.abs(it.dz) * 3.0, sz: Math.abs(it.dz) * 1.1 + Math.abs(it.dx) * 3.0, th: hgt, axis: [-it.dz, 0, it.dx], amp: 3.0, period: rr(3.2, 4.2), phase: i * .5 + R() * .2, col: 0xffd31a, stage: si, wall: true }); }
    },
    zapper() {
      const len = 9.6; if (!fits(2.4, len)) return; const it = put(2.4, len, 4.4, rr(.2, .5)), n = d > .5 ? 3 : 2;
      for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 3.0; items.push({ k: 'kill', x: it.x + it.dx * off, y: it.y + .22, z: it.z + it.dz * off, sx: Math.abs(it.dx) * .8 + Math.abs(it.dz) * 4.4, sy: .44, sz: Math.abs(it.dz) * .8 + Math.abs(it.dx) * 4.4, stage: si }); }
    },
  };
  const pickSeg = () => { const w = theme.w, keys = Object.keys(w); let tot = 0; for (const k of keys) tot += w[k]; let r = R() * tot; for (const k of keys) { r -= w[k]; if (r <= 0) return k; } return keys[0]; };

  // the start platform (checkpoint 0)
  const sp = pathAt(0, 0); const start = { k: 'plat', x: sp.x, y: cur.y, z: sp.z, sx: 9.2, sz: 9.2, th: TH, col: 0xffffff, stage: 0, len: 9.2, wid: 9.2, dx: 1, dz: 0, big: true, ck: 0 }; items.push(start); prev = start; cur.s = 4.6; cur.lat = 0;
  stages.push({ name: THEMES[order[0]].name, theme: order[0], y0: cur.y, ck: [sp.x, cur.y, sp.z], height: 0, d: 0 });
  for (si = 0; si < N; si++) {
    const stage = stages[si]; theme = THEMES[stage.theme]; d = clamp(dBase + (1 - dBase) * si / Math.max(1, N - 1), 0, 1); gk = 1 / (theme.grav || 1); stage.d = d; stage.grav = theme.grav || 1;
    const H = 21 + rr(0, 4) + si * .4; stage.height = H; let guard = 0, idle = 0;
    while (guard++ < 400) {
      const progress = cur.y - stage.y0, gc = gapToCorner();
      let atCorner = gc <= maxG() + .1; if (!atCorner && gc < 8) { if (connector()) continue; atCorner = true; }
      if (atCorner) {                         // close enough to the next corner: finish the stage here if we are high enough, else a plain corner pad
        if (progress >= H) { const it = corner(true); if (si < N - 1) { it.ck = si + 1; stages.push({ name: THEMES[order[si + 1]].name, theme: order[si + 1], y0: cur.y, ck: [it.x, cur.y, it.z], height: 0, d: 0 }); } else { it.fin = true; stage.fin = [it.x, cur.y, it.z]; } break; }
        corner(false); idle = 0; continue;
      }
      const before = cur.s; SEG[pickSeg()]();
      if (cur.s === before) { idle++; if (idle > 1) { if (!connector()) { const len = 3.2, gap = Math.min(maxG() * .85, 2.2); if (fits(gap, len)) put(gap, len, len, rr(.2, .6) * gk); } idle = 0; } } else idle = 0;
    }
  }
  return { seed, N, order, items, stages, hops, top: cur.y, L, H2 };
}
