// Weapon skins with real themes. Every skin colours the PARTS of a gun on its own (body, barrel, stock, grip + magazine, shiny metal trim, edge highlights, dark details),
// adds a crisp blocky pattern in a small shader (camo, stripes, circuit lines, scales, stars, cracks, carbon, ice, pearl), and the rarer ones glow, shine and sparkle.
import * as THREE from './three.module.min.js?v=220';

const th = (body, barrel, stock, grip, metal, edge, dark) => ({ body, barrel, stock, grip, metal, edge, dark });
// fx: mode (pattern), cell (pattern size), c: 4 pattern colours, glow, glowCol, shine (moving shine), spark (sparkle colour), rivet, outline, gloss (shiny paint too)
export const finishes = [
  { id: 'factory', name: 'Factory', rule: 'Standard issue' },
  // ---- rank rewards ----
  { id: 'rift', name: 'Violet Rift', rule: 'Finish 3 ranked placements', rp: 0, theme: th(0x3b1f5e, 0x1c1030, 0x4a2a78, 0x2a1646, 0xb89cff, 0xff9cf6, 0x140a22), fx: { mode: 3, cell: 9, c: [0xe460ff, 0, 0, 0xc9a8ff], glow: 0.45, glowCol: 0xc050ff } },
  { id: 'tidal', name: 'Neon Circuit', rule: 'Reach Bronze II', rp: 100, theme: th(0x0d1a22, 0x071016, 0x13262f, 0x071016, 0x4fe8ff, 0xb8fbff, 0x04090c), fx: { mode: 3, cell: 11, c: [0x37e6ff, 0, 0, 0x37e6ff], glow: 0.9, glowCol: 0x20d0ff, rivet: true } },
  { id: 'ember', name: 'Lava', rule: 'Reach Silver I', rp: 300, theme: th(0x241512, 0x120a08, 0x2e1a14, 0x120a08, 0xd96a2a, 0xffc060, 0x0a0504), fx: { mode: 6, cell: 12, c: [0xff7a1a, 0x6a1a08, 0, 0], glow: 0.8, glowCol: 0xff5a10 } },
  { id: 'polar', name: 'Frozen', rule: 'Reach Gold I', rp: 600, theme: th(0x7fc4e8, 0x3f7fa8, 0x9ad6f2, 0x2f6b92, 0xe6f8ff, 0xffffff, 0x1c4766), fx: { mode: 8, cell: 8, c: [0xeaf8ff, 0, 0, 0], shine: 0, gloss: true } },
  // ---- skin crates: common (simple, clean) ----
  { id: 'desert', name: 'Desert Camo', rule: 'Found in skin crates', rarity: 'common', theme: th(0xb89a62, 0x5b4a30, 0x8a6f44, 0x4a3b28, 0x6a6256, 0xe6d3a3, 0x2a2418), fx: { mode: 1, cell: 7, c: [0xcdb27a, 0x8a7040, 0x5a4a2a, 0] } },
  { id: 'carbon', name: 'Carbon Fiber', rule: 'Found in skin crates', rarity: 'common', theme: th(0x23262b, 0x15171a, 0x1d2024, 0x15171a, 0x9aa1a9, 0xe1e5e9, 0x0c0d0f), fx: { mode: 7, cell: 26, c: [0, 0, 0, 0xb8bec6], rivet: true } },
  { id: 'candy', name: 'Candy', rule: 'Found in skin crates', rarity: 'common', theme: th(0xff7fb0, 0xfff2f8, 0xff7fb0, 0x7fd8ff, 0xffffff, 0xffffff, 0x8a3a5c), fx: { mode: 2, cell: 6, c: [0xffffff, 0, 0, 0] } },
  // ---- rare (extra details) ----
  { id: 'dragon', name: 'Dragon', rule: 'Found in skin crates', rarity: 'rare', theme: th(0x1f6b3a, 0x123d22, 0x8a1f1f, 0x2a1a10, 0xe0b040, 0xffd45a, 0x0c1f12), fx: { mode: 4, cell: 14, c: [0x0b2a16, 0x2f9b57, 0, 0xffd45a], rivet: true } },
  { id: 'snow', name: 'Snow White', rule: 'Found in skin crates', rarity: 'rare', weight: 0.45, theme: th(0xf2f6f9, 0xe6eef4, 0xe9eef2, 0xc4cdd5, 0x7fd0f5, 0xffffff, 0x9aa6b2), fx: { mode: 0, cell: 10, c: [0, 0, 0, 0xc7d9e4], outline: true, gloss: true } },
  { id: 'frost', name: 'Frost', rule: 'Found in skin crates', rarity: 'rare', weight: 0.45, theme: th(0xcfe8f6, 0xa9d2ea, 0xcfe8f6, 0x8fc0dc, 0x6cc4f2, 0xffffff, 0x7fa3ba), fx: { mode: 8, cell: 9, c: [0xffffff, 0, 0, 0x6f93aa], outline: true, gloss: true } },
  { id: 'ivory', name: 'Ivory', rule: 'Found in skin crates', rarity: 'rare', weight: 0.45, theme: th(0xf3e8cf, 0xd9cdb0, 0xeadfc6, 0xc9bb9a, 0xb8c2cc, 0xfffdf6, 0x9a8f78), fx: { mode: 0, cell: 10, c: [0, 0, 0, 0xc7b99c], outline: true, rivet: true, gloss: true } },
  // ---- epic (glowing parts + a moving shine) ----
  { id: 'toxic', name: 'Toxic Waste', rule: 'Found in skin crates', rarity: 'epic', theme: th(0x2a2f1e, 0x141808, 0x3a4222, 0x141808, 0xa8ff3c, 0xd8ff8a, 0x080a04), fx: { mode: 3, cell: 10, c: [0xb6ff3c, 0, 0, 0xb6ff3c], glow: 0.8, glowCol: 0x9aff20, shine: 1 } },
  { id: 'ghost', name: 'Ghost', rule: 'Found in skin crates', rarity: 'epic', weight: 0.45, theme: th(0xf8fafc, 0xe8eef3, 0xf2f6f9, 0xe0e7ee, 0xcfe8f7, 0xffffff, 0xc3ccd4), fx: { mode: 0, cell: 10, c: [0, 0, 0, 0xd5e6ef], outline: true, glow: 0.3, glowCol: 0xbfe6ff, shine: 1, gloss: true } },
  { id: 'polarcamo', name: 'Polar Camo', rule: 'Found in skin crates', rarity: 'epic', weight: 0.45, theme: th(0x6a7a89, 0x3c4853, 0x56646f, 0x1f272e, 0xaab7c2, 0xffffff, 0x12181d), fx: { mode: 1, cell: 5, c: [0xe6edf2, 0x56667a, 0x1f2b36, 0], glow: 0.25, glowCol: 0xbfe0ff, shine: 1, spark: 0xdff4ff } },
  // ---- legendary (clearly special: glow + shine + sparkles) ----
  { id: 'gold', name: 'Gold Plated', rule: 'Found in skin crates', rarity: 'legendary', theme: th(0xe6b422, 0xc99412, 0xf0c53a, 0x8a6410, 0xffe27a, 0xfff3b0, 0x5a3f08), fx: { mode: 0, cell: 10, c: [0, 0, 0, 0xfff0a0], rivet: true, glow: 0.35, glowCol: 0xffc830, shine: 1, spark: 0xffe27a, gloss: true } },
  { id: 'galaxy', name: 'Galaxy', rule: 'Found in skin crates', rarity: 'legendary', theme: th(0x120a2e, 0x0a0618, 0x1c1046, 0x0a0618, 0x8a7cff, 0xff9cf6, 0x05030d), fx: { mode: 5, cell: 18, c: [0x9a6cff, 0x5b2bd6, 0xff4fd0, 0], glow: 0.45, glowCol: 0x9a50ff, shine: 1, spark: 0xd6b8ff } },
  { id: 'pearl', name: 'Pearl', rule: 'Found in skin crates', rarity: 'legendary', weight: 0.45, theme: th(0xfaf8f4, 0xece9e4, 0xf6f3ee, 0xe2dfd9, 0xd7e6f2, 0xffffff, 0xbcb8b2), fx: { mode: 9, cell: 10, c: [0, 0, 0, 0xb0b8c0], outline: true, glow: 0.4, glowCol: 0xe8ecff, shine: 1, spark: 0xffffff, gloss: true } }
];

// the whiteout set also changes the soldier's uniform on the menu
const OUTFIT = { snow: [0xf4f7fa], frost: [0xe0f0fa], ivory: [0xf3ecdc], ghost: [0xf8fafc], polarcamo: [0xeef2f5], pearl: [0xfbf9f5] };
for (const f of finishes) if (OUTFIT[f.id]) f.outfit = OUTFIT[f.id][0];

// ---------------------------------------------------------------- the shader pattern + glow + moving shine
const TIME = { value: 0 }, SPARKS = new Set(); let lastT = 0;
export const fxQuality = { shine: false };   // the moving shine + sparkles are on Fast and High, never Lite (game.js sets this before any skin is drawn)
export function tickSkins() {
  const now = performance.now() / 1000, dt = Math.min(0.1, now - lastT || 0.016); lastT = now; TIME.value = now;
  for (const p of SPARKS) {
    if (!p.parent) { SPARKS.delete(p); continue; }
    const a = p.geometry.attributes.position, top = p.userData.top, bot = p.userData.bot;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 0.05; if (y > top) y = bot; a.setY(i, y); }
    a.needsUpdate = true; p.material.opacity = 0.65 + 0.35 * Math.sin(now * 5);
  }
}
const FX_FRAG = `
vec3 fxE = vec3(0.0);
{
  vec3 fxCell = floor(vObj * uCell); float fxH = h3(fxCell);
  float paint = 1.0 - step(3.5, vRole); float shinyRole = step(3.5, vRole) * (1.0 - step(5.5, vRole));
  vec3 col = diffuseColor.rgb; float m = uMode;
  if (m > 0.5 && m < 1.5) { vec3 c = fxH < 0.34 ? uC0 : (fxH < 0.67 ? uC1 : uC2); col = mix(col, c, paint * 0.9); }
  else if (m > 1.5 && m < 2.5) { float s = step(0.5, fract((vObj.z + vObj.y * 0.7) * uCell)); col = mix(col, uC0, paint * s); }
  else if (m > 2.5 && m < 3.5) { float ln = max(step(0.9, fract(vObj.z * uCell)), step(0.92, fract(vObj.y * uCell * 1.3)) * step(0.45, fxH)); fxE += uC0 * ln * paint * uGlow * 1.6; col = mix(col, uC0, ln * paint * 0.7); }
  else if (m > 3.5 && m < 4.5) { float row = floor(vObj.y * uCell); float off = 0.5 * mod(row, 2.0); vec2 sc = vec2(vObj.z * uCell + off, vObj.y * uCell); float e = max(step(fract(sc.x), 0.14), step(fract(sc.y), 0.14)); float alt = step(0.5, h3(vec3(floor(sc), 1.0))); col = mix(col, uC1, paint * alt * 0.8); col = mix(col, uC0, paint * e); }
  else if (m > 4.5 && m < 5.5) { vec3 big = floor(vObj * uCell * 0.45); float neb = h3(big); col = mix(col, mix(uC1, uC2, h3(big + 3.0)), paint * 0.6 * step(0.3, neb)); float star = step(0.955, h3(fxCell + 7.0)); float tw = step(0.6, h3(fxCell + floor(uTime * 1.5))); fxE += vec3(0.8, 0.75, 1.0) * star * tw * 0.9 * paint; col = mix(col, vec3(1.0), star * paint * 0.5); }
  else if (m > 5.5 && m < 6.5) { float cr = step(0.8, fxH); fxE += uC0 * cr * paint * (0.9 + 0.3 * sin(uTime * 3.0 + fxH * 6.0)) * uGlow; col = mix(col, uC1, cr * paint); }
  else if (m > 6.5 && m < 7.5) { float ck = mod(fxCell.x + fxCell.y + fxCell.z, 2.0); col *= mix(1.0, mix(0.78, 1.18, ck), paint); }
  else if (m > 7.5 && m < 8.5) { float ice = step(0.72, fxH); col = mix(col, uC0, paint * ice * 0.85); }
  else if (m > 8.5) { vec3 irid = 0.55 + 0.45 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + (vObj.z * 1.4 + vObj.y * 0.9) * 0.7 + uTime * 0.12)); col = mix(col, irid, paint * 0.28); }
  if (uOutline > 0.5) { float ol = max(step(fract(vObj.y * uCell * 0.5), 0.07), step(fract(vObj.z * uCell * 0.5), 0.06)); col = mix(col, uC3, ol * paint * 0.75); }
  if (uRivet > 0.5) { float dt2 = step(0.86, fract(vObj.x * 18.0)) * step(0.86, fract(vObj.z * 18.0)); col = mix(col, uC3, dt2 * paint); }
  diffuseColor.rgb = col;
  fxE += uGlowCol * uGlow * (0.30 + 0.12 * sin(uTime * 2.0)) * (paint * 0.25 + shinyRole);
  float band = smoothstep(0.86, 1.0, 1.0 - abs(fract(vObj.z * 1.1 - vObj.y * 0.9 - uTime * 0.4) - 0.5) * 2.0); fxE += vec3(1.0) * band * uShine * 0.6;
}`;
const matCache = new Map();
function matFor(f, shiny) {
  const key = f.id + (shiny ? 'S' : 'M'); if (matCache.has(key)) return matCache.get(key);
  const fx = f.fx, col = (h) => new THREE.Color(h || 0);
  const m = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: shiny ? 60 : fx.gloss ? 40 : 12, specular: shiny ? 0x6a6a6a : fx.gloss ? 0x554433 : 0x151515 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uTime: TIME, uMode: { value: fx.mode || 0 }, uCell: { value: fx.cell || 10 }, uGlow: { value: fx.glow || 0 }, uShine: { value: fxQuality.shine ? fx.shine || 0 : 0 }, uOutline: { value: fx.outline ? 1 : 0 }, uRivet: { value: fx.rivet ? 1 : 0 },
      uC0: { value: col(fx.c && fx.c[0]) }, uC1: { value: col(fx.c && fx.c[1]) }, uC2: { value: col(fx.c && fx.c[2]) }, uC3: { value: col(fx.c && fx.c[3]) }, uGlowCol: { value: col(fx.glowCol) },
    });
    sh.vertexShader = 'attribute float aRole; varying vec3 vObj; varying float vRole;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vObj = position; vRole = aRole;');
    sh.fragmentShader = 'uniform float uTime, uMode, uCell, uGlow, uShine, uOutline, uRivet; uniform vec3 uC0, uC1, uC2, uC3, uGlowCol; varying vec3 vObj; varying float vRole;\nfloat h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' +
      sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + FX_FRAG).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += fxE;');
  };
  m.customProgramCacheKey = () => 'skinfx';
  matCache.set(key, m); return m;
}

// ---------------------------------------------------------------- split a gun into themed parts (by colour + where the triangle sits on the gun)
function buildThemed(geo, f, kind) {
  const P = geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, T = f.theme, tri = P.count / 3;
  const roleHex = [T.body, T.barrel, T.stock, T.grip, T.metal, T.edge, T.dark], tmp = new THREE.Color();
  const mk = () => ({ pos: [], nor: [], col: [], role: [] }), A = mk(), B = mk();   // A = painted (matte), B = shiny metal + edges
  for (let t = 0; t < tri; t++) {
    const i0 = t * 3; let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cx += P.getX(i0 + k); cy += P.getY(i0 + k); cz += P.getZ(i0 + k); }
    cx /= 3; cy /= 3; cz /= 3;
    const r = C.getX(i0), g = C.getY(i0), b = C.getZ(i0), lum = 0.299 * r + 0.587 * g + 0.114 * b, mx = Math.max(r, g, b), sat = (mx - Math.min(r, g, b)) / (mx || 1);
    let role;
    if (lum > 0.55) role = 5; else if (sat > 0.28 && r > b) role = 2; else if (lum > 0.3) role = 4; else if (lum < 0.12) role = 6;
    else role = (cy < -0.05 && Math.abs(cz) < 0.22) ? 3 : cz < -0.26 ? 1 : cz > 0.16 ? 2 : 0;
    if (role === 6 && cy < -0.05 && Math.abs(cz) < 0.22) role = 3;   // dark bits low on the gun = grip / magazine
    if (kind === 'knife') role = cz < -0.015 ? (lum > 0.75 ? 0 : 5) : ((cz > 0.14 && sat > 0.3) || cz < 0.03) ? 4 : 3;   // knife: blade = painted with the skin, spine + edge = shiny, guard + pommel = metal, grip = painted
    const ny = N.getY(i0), shade = ny > 0.5 ? 1.08 : ny < -0.5 ? 0.72 : 0.92, dst = role >= 4 ? B : A;
    tmp.setHex(roleHex[role]).multiplyScalar(shade);
    for (let k = 0; k < 3; k++) { dst.pos.push(P.getX(i0 + k), P.getY(i0 + k), P.getZ(i0 + k)); dst.nor.push(N.getX(i0 + k), N.getY(i0 + k), N.getZ(i0 + k)); dst.col.push(tmp.r, tmp.g, tmp.b); dst.role.push(role); }
  }
  const build = (s) => { if (!s.pos.length) return null; const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3)); gg.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(s.col, 3)); gg.setAttribute('aRole', new THREE.Float32BufferAttribute(s.role, 1)); return gg; };
  geo.computeBoundingBox();
  return { matte: build(A) || build(B), shiny: A.pos.length ? build(B) : null, box: geo.boundingBox.clone() };
}
function makeSparks(box, hex) {
  const n = 16, pos = new Float32Array(n * 3), s = box.getSize(new THREE.Vector3());
  for (let i = 0; i < n; i++) { pos[i * 3] = box.min.x + Math.random() * s.x; pos[i * 3 + 1] = box.min.y - 0.02 + Math.random() * (s.y + 0.1); pos[i * 3 + 2] = box.min.z + Math.random() * s.z; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.022, color: hex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  p.userData = { top: box.max.y + 0.08, bot: box.min.y - 0.02 }; p.frustumCulled = false; SPARKS.add(p); return p;
}
export function applyFinish(mesh, finish, kind) {
  if (!mesh) return;
  const ud = mesh.userData; ud.base ??= { geometry: mesh.geometry, material: mesh.material };
  for (const k of ud.fxKids || []) { mesh.remove(k); if (k.geometry && k.geometry !== ud.base.geometry && !k.isPoints) k.geometry.dispose(); }
  ud.fxKids = [];
  if (!finish || !finish.theme) { mesh.geometry = ud.base.geometry; mesh.material = ud.base.material; return; }
  ud.themed ??= {}; const sp = (ud.themed[finish.id + (kind || '')] ??= buildThemed(ud.base.geometry, finish, kind));
  mesh.geometry = sp.matte; mesh.material = matFor(finish, false);
  if (sp.shiny) { const k = new THREE.Mesh(sp.shiny, matFor(finish, true)); mesh.add(k); ud.fxKids.push(k); }
  if (finish.fx.spark && fxQuality.shine) { const p = makeSparks(sp.box, finish.fx.spark); mesh.add(p); ud.fxKids.push(p); }
}

// ---------------------------------------------------------------- the soldier's uniform on the menu (whiteout skins turn it white)
export function outfitSoldier(group, finish, charMat) {
  group.traverse((o) => {
    if (!o.isMesh || o.material !== charMat) return;
    const ud = o.userData; ud.origGeo ??= o.geometry;
    if (!finish || !finish.outfit) { o.geometry = ud.origGeo; return; }
    const g = ud.origGeo.clone(), c = g.attributes.color, base = new THREE.Color(finish.outfit);
    for (let i = 0; i < c.count; i++) {
      const r = c.getX(i), gg = c.getY(i), b = c.getZ(i), lum = 0.299 * r + 0.587 * gg + 0.114 * b;
      if (lum < 0.02) continue;   // pure black gear stays
      const k = 0.55 + Math.min(1, lum * 2.2) * 0.5, a = lum < 0.06 ? 0.45 : 0.85;
      c.setXYZ(i, r + (base.r * k - r) * a, gg + (base.g * k - gg) * a, b + (base.b * k - b) * a);
    }
    c.needsUpdate = true; o.geometry = g;
  });
}

// ---------------------------------------------------------------- a flat 2D icon of the skin (blocky, part by part) for the inventory cards
export function drawSkinIcon(cx, f) {
  const T = f.theme || th(0x525c64, 0x3d4046, 0x6a4228, 0x2a2c31, 0x818c92, 0xdbe1df, 0x22292e), fx = f.fx || { mode: 0, c: [] }, hx = (n) => '#' + n.toString(16).padStart(6, '0');
  cx.clearRect(0, 0, 128, 128);
  const bg = cx.createLinearGradient(0, 0, 0, 128); bg.addColorStop(0, '#39342e'); bg.addColorStop(1, '#1d1a17'); cx.fillStyle = bg; cx.fillRect(0, 0, 128, 128);
  let seed = f.id.length * 97 + 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const part = (x, y, w, h, color) => {
    cx.save(); if (fx.glow) { cx.shadowColor = hx(fx.glowCol || fx.c[0] || 0xffffff); cx.shadowBlur = 10 * fx.glow; }
    cx.fillStyle = hx(color); cx.fillRect(x, y, w, h); cx.restore();
    cx.save(); cx.beginPath(); cx.rect(x, y, w, h); cx.clip();
    const c = (i, d) => hx(fx.c && fx.c[i] ? fx.c[i] : d);
    if (fx.mode === 1) for (let yy = y; yy < y + h; yy += 6) for (let xx = x; xx < x + w; xx += 6) { const r = rnd(); cx.fillStyle = r < 0.34 ? c(0, '#fff') : r < 0.67 ? c(1, '#999') : c(2, '#555'); if (r > 0.1) cx.fillRect(xx, yy, 6, 6); }
    else if (fx.mode === 2) { cx.strokeStyle = c(0, '#fff'); cx.lineWidth = 4; for (let k = -40; k < w + h; k += 12) { cx.beginPath(); cx.moveTo(x + k, y); cx.lineTo(x + k - h, y + h); cx.stroke(); } }
    else if (fx.mode === 3) { cx.fillStyle = c(0, '#0ff'); for (let xx = x + 3; xx < x + w; xx += 9) cx.fillRect(xx, y, 2, h); for (let yy = y + 4; yy < y + h; yy += 9) if (rnd() > 0.5) cx.fillRect(x, yy, w, 2); }
    else if (fx.mode === 4) { cx.strokeStyle = c(0, '#042'); cx.fillStyle = c(1, '#3a7'); cx.lineWidth = 1.5; for (let yy = y, row = 0; yy < y + h; yy += 7, row++) for (let xx = x - (row % 2) * 4; xx < x + w; xx += 8) { if (rnd() > 0.5) cx.fillRect(xx, yy, 8, 7); cx.strokeRect(xx, yy, 8, 7); } }
    else if (fx.mode === 5) { for (let yy = y; yy < y + h; yy += 8) for (let xx = x; xx < x + w; xx += 8) { const r = rnd(); if (r < 0.3) { cx.fillStyle = c(1, '#52d'); cx.fillRect(xx, yy, 8, 8); } else if (r < 0.45) { cx.fillStyle = c(2, '#f4d'); cx.fillRect(xx, yy, 8, 8); } } cx.fillStyle = '#fff'; for (let k = 0; k < 8; k++) cx.fillRect(x + rnd() * w, y + rnd() * h, 2, 2); }
    else if (fx.mode === 6) { cx.fillStyle = c(0, '#f80'); for (let yy = y; yy < y + h; yy += 6) for (let xx = x; xx < x + w; xx += 6) if (rnd() > 0.78) cx.fillRect(xx, yy, 6, 6); }
    else if (fx.mode === 7) { for (let yy = y; yy < y + h; yy += 5) for (let xx = x; xx < x + w; xx += 5) if (((xx - x) / 5 + (yy - y) / 5) % 2 === 0) { cx.fillStyle = '#ffffff14'; cx.fillRect(xx, yy, 5, 5); } }
    else if (fx.mode === 8) { cx.fillStyle = c(0, '#fff'); for (let yy = y; yy < y + h; yy += 6) for (let xx = x; xx < x + w; xx += 6) if (rnd() > 0.7) cx.fillRect(xx, yy, 6, 6); }
    else if (fx.mode === 9) { const gr = cx.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#ffd6f0aa'); gr.addColorStop(0.5, '#d6f0ffaa'); gr.addColorStop(1, '#fff6d6aa'); cx.fillStyle = gr; cx.fillRect(x, y, w, h); }
    if (fx.outline) { cx.strokeStyle = hx(fx.c[3] || 0x9aa5b0); cx.lineWidth = 1; cx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
    if (fx.rivet) { cx.fillStyle = hx(fx.c[3] || 0xcccccc); for (let xx = x + 4; xx < x + w - 2; xx += 10) cx.fillRect(xx, y + 3, 2, 2); }
    cx.restore();
  };
  part(6, 52, 26, 22, T.stock); part(30, 48, 44, 22, T.body); part(72, 54, 46, 9, T.barrel); part(40, 68, 12, 26, T.grip); part(58, 68, 11, 28, T.dark);
  cx.fillStyle = hx(T.metal); cx.fillRect(72, 63, 46, 3); cx.fillRect(30, 70, 44, 3);
  cx.fillStyle = hx(T.edge); cx.fillRect(30, 46, 44, 3); cx.fillRect(72, 51, 46, 3); cx.fillRect(112, 46, 4, 8);
  if (fx.spark) { cx.fillStyle = hx(fx.spark); for (const [x, y] of [[20, 30], [96, 36], [60, 24], [108, 80], [14, 84]]) { cx.fillRect(x, y - 3, 2, 8); cx.fillRect(x - 3, y, 8, 2); } }
}

export const knives = [
  { id: 'combat', name: 'Combat Knife', rule: 'Standard issue' },
  { id: 'karambit', name: 'Karambit', rule: 'Found in skin crates', rarity: 'legendary' },
  { id: 'machete', name: 'Machete', rule: 'Found in skin crates', rarity: 'epic' },
  { id: 'dagger', name: 'Dagger', rule: 'Found in skin crates', rarity: 'rare' }
];

// crate drop odds (percent), the colour of each rarity, and the coins you get back for a duplicate
export const rarities = {
  common: { name: 'Common', pct: 55, color: 0xb8c2cc, refund: 25 },
  rare: { name: 'Rare', pct: 30, color: 0x4aa3ff, refund: 50 },
  epic: { name: 'Epic', pct: 12, color: 0xb45cff, refund: 100 },
  legendary: { name: 'Legendary', pct: 3, color: 0xffc247, refund: 200 }
};

// ---------------------------------------------------------------- inventory card: a square of the skin itself, edge to edge, like wrapping paper
export function drawSkinSwatch(cx, f) {
  const W = 128, hx = (n) => '#' + (typeof n === 'number' ? n.toString(16).padStart(6, '0') : n.slice(1)), T = f.theme, fx = f.fx || { mode: 0, c: [] }, c = (i, d) => hx(fx.c && fx.c[i] ? fx.c[i] : d);
  cx.clearRect(0, 0, W, W);
  if (!T) { cx.fillStyle = '#41454c'; cx.fillRect(0, 0, W, W); cx.fillStyle = '#2d3036'; for (let i = 0; i < W; i += 16) { cx.fillRect(i, 0, 2, W); cx.fillRect(0, i, W, 2); } cx.fillStyle = '#b4b9c0'; cx.fillRect(0, 0, W, 5); return; }
  let seed = f.id.length * 131 + f.id.charCodeAt(0) * 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  cx.fillStyle = hx(T.body); cx.fillRect(0, 0, W, W);
  const m = fx.mode;
  if (m === 1) for (let y = 0; y < W; y += 8) for (let x = 0; x < W; x += 8) { const r = rnd(); cx.fillStyle = r < 0.34 ? c(0, '#fff') : r < 0.67 ? c(1, '#999') : c(2, '#555'); cx.fillRect(x, y, 8, 8); }
  else if (m === 2) { cx.strokeStyle = c(0, '#fff'); cx.lineWidth = 10; for (let k = -W; k < W * 2; k += 28) { cx.beginPath(); cx.moveTo(k, 0); cx.lineTo(k - W, W); cx.stroke(); } }
  else if (m === 3) { cx.save(); cx.shadowColor = c(0, '#0ff'); cx.shadowBlur = 8; cx.fillStyle = c(0, '#0ff'); for (let x = 6; x < W; x += 16) cx.fillRect(x, 0, 3, W); for (let y = 10; y < W; y += 16) for (let x = 0; x < W; x += 32) if (rnd() > 0.4) cx.fillRect(x, y, 30, 3); cx.restore(); }
  else if (m === 4) { for (let y = 0, row = 0; y < W; y += 12, row++) for (let x = -(row % 2) * 8; x < W; x += 16) { cx.fillStyle = rnd() > 0.5 ? c(1, '#3a7') : hx(T.body); cx.fillRect(x, y, 16, 12); cx.strokeStyle = c(0, '#042'); cx.lineWidth = 2; cx.strokeRect(x + 1, y + 1, 16, 12); } }
  else if (m === 5) { for (let y = 0; y < W; y += 16) for (let x = 0; x < W; x += 16) { const r = rnd(); if (r < 0.34) { cx.fillStyle = c(1, '#52d'); cx.fillRect(x, y, 16, 16); } else if (r < 0.52) { cx.fillStyle = c(2, '#f4d'); cx.fillRect(x, y, 16, 16); } } cx.fillStyle = '#fff'; for (let k = 0; k < 26; k++) { const sz = rnd() > 0.8 ? 3 : 2; cx.fillRect((rnd() * W) | 0, (rnd() * W) | 0, sz, sz); } }
  else if (m === 6) { cx.save(); cx.shadowColor = c(0, '#f80'); cx.shadowBlur = 8; for (let y = 0; y < W; y += 8) for (let x = 0; x < W; x += 8) { const r = rnd(); if (r > 0.8) { cx.fillStyle = c(0, '#f80'); cx.fillRect(x, y, 8, 8); } else if (r > 0.7) { cx.fillStyle = c(1, '#611'); cx.fillRect(x, y, 8, 8); } } cx.restore(); }
  else if (m === 7) { for (let y = 0; y < W; y += 8) for (let x = 0; x < W; x += 8) { cx.fillStyle = ((x + y) / 8) % 2 ? '#ffffff16' : '#00000030'; cx.fillRect(x, y, 8, 8); } }
  else if (m === 8) { for (let y = 0; y < W; y += 8) for (let x = 0; x < W; x += 8) if (rnd() > 0.68) { cx.fillStyle = c(0, '#fff'); cx.fillRect(x, y, 8, 8); } }
  else if (m === 9) { const g = cx.createLinearGradient(0, 0, W, W); g.addColorStop(0, '#ffd6f0'); g.addColorStop(0.35, '#d6ecff'); g.addColorStop(0.65, '#fff3d6'); g.addColorStop(1, '#e3d6ff'); cx.fillStyle = g; cx.fillRect(0, 0, W, W); }
  if (fx.outline) { cx.strokeStyle = hx(fx.c[3] || 0x9aa5b0); cx.lineWidth = 2; for (let k = 16; k < W; k += 32) { cx.beginPath(); cx.moveTo(0, k); cx.lineTo(W, k); cx.moveTo(k, 0); cx.lineTo(k, W); cx.stroke(); } }
  if (fx.rivet) { cx.fillStyle = hx(fx.c[3] || 0xcccccc); for (let y = 8; y < W; y += 24) for (let x = 8; x < W; x += 24) cx.fillRect(x, y, 3, 3); }
  // trim strips: metal on top (with a bright edge), barrel colour at the bottom
  cx.fillStyle = hx(T.metal); cx.fillRect(0, 0, W, 9); cx.fillStyle = hx(T.edge); cx.fillRect(0, 0, W, 3); cx.fillStyle = hx(T.barrel); cx.fillRect(0, W - 9, W, 9); cx.fillStyle = hx(T.edge); cx.fillRect(0, W - 9, W, 2);
  if (fx.shine) { const g = cx.createLinearGradient(0, 0, W, W); g.addColorStop(0.35, '#ffffff00'); g.addColorStop(0.5, '#ffffff66'); g.addColorStop(0.65, '#ffffff00'); cx.fillStyle = g; cx.fillRect(0, 0, W, W); }
  if (fx.glow) { const g = cx.createRadialGradient(W / 2, W / 2, 20, W / 2, W / 2, W * 0.75); g.addColorStop(0, '#ffffff00'); g.addColorStop(1, hx(fx.glowCol || 0xffffff) + '55'); cx.fillStyle = g; cx.fillRect(0, 0, W, W); }
  if (fx.spark) { cx.fillStyle = hx(fx.spark); for (const [x, y] of [[22, 30], [96, 24], [60, 70], [104, 98], [28, 100]]) { cx.fillRect(x - 1, y - 6, 3, 13); cx.fillRect(x - 6, y - 1, 13, 3); } }
}
