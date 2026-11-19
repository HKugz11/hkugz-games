// Weapon skins with real themes. Every skin colours the PARTS of a gun on its own (body, barrel, stock, grip + magazine, shiny metal trim, edge highlights, dark details),
// adds a crisp blocky pattern in a small shader (camo, stripes, circuit lines, scales, stars, cracks, carbon, ice, pearl), and the rarer ones glow, shine and sparkle.
import * as THREE from './three.module.min.js?v=322';

// CHRISTMAS SEASON: on by itself Nov 15 - Jan 2 (any year). ?xmas=1 forces it on (to preview), ?xmas=0 forces it off. Same remembered setting ('hk-xmas') as the hub's Christmas theme.
export const XMAS = (() => {
  try { const m = /[?&]xmas=([01])/.exec(location.search); if (m) localStorage.setItem('hk-xmas', m[1] === '1' ? 'on' : 'off'); } catch (e) {}
  let pref = null; try { pref = localStorage.getItem('hk-xmas'); } catch (e) {}
  const d = new Date(), md = (d.getMonth() + 1) * 100 + d.getDate(), season = md >= 1115 || md <= 102;
  const on = pref === 'on' ? true : pref === 'off' ? false : season;
  try { if (on) document.documentElement.classList.add('xmas'); } catch (e) {}   // lets the CSS dress the menu up
  return on;
})();

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
  { id: 'pearl', name: 'Pearl', rule: 'Found in skin crates', rarity: 'legendary', weight: 0.45, theme: th(0xfaf8f4, 0xece9e4, 0xf6f3ee, 0xe2dfd9, 0xd7e6f2, 0xffffff, 0xbcb8b2), fx: { mode: 9, cell: 10, c: [0, 0, 0, 0xb0b8c0], outline: true, glow: 0.4, glowCol: 0xe8ecff, shine: 1, spark: 0xffffff, gloss: true } },
  // ---- more case skins ----
  { id: 'urban', name: 'Urban Camo', rule: 'Found in skin crates', rarity: 'common', theme: th(0x6f737a, 0x2f3236, 0x555a61, 0x25282c, 0x9aa0a8, 0xd0d4d9, 0x16181b), fx: { mode: 1, cell: 7, c: [0x8a9099, 0x5b6068, 0x3a3e44, 0] } },
  { id: 'forest', name: 'Forest Camo', rule: 'Found in skin crates', rarity: 'common', theme: th(0x4f6b3a, 0x2a3a20, 0x6a5232, 0x2a2018, 0x8a8f78, 0xc8d8a8, 0x141c10), fx: { mode: 1, cell: 7, c: [0x6b8a4a, 0x3f5a2c, 0x2a3a1e, 0] } },
  { id: 'sunset', name: 'Sunset Stripes', rule: 'Found in skin crates', rarity: 'common', theme: th(0xff8a3c, 0xffd36a, 0xff5c8a, 0x7a2a55, 0xffe6b0, 0xffffff, 0x4a1a3a), fx: { mode: 2, cell: 7, c: [0xff4f7a, 0, 0, 0] } },
  { id: 'ocean', name: 'Deep Ocean', rule: 'Found in skin crates', rarity: 'common', theme: th(0x1f6fb5, 0x0f3d6e, 0x2f8fd0, 0x0a2a4a, 0x8fd8ff, 0xe0f6ff, 0x061a30), fx: { mode: 2, cell: 9, c: [0x4fb6f0, 0, 0, 0] } },
  { id: 'tiger', name: 'Tiger', rule: 'Found in skin crates', rarity: 'rare', theme: th(0xf08a24, 0x2a1a0a, 0xe07a18, 0x2a1a0a, 0xffd28a, 0xfff0c8, 0x1a0e05), fx: { mode: 2, cell: 8, c: [0x1a0e05, 0, 0, 0xffd28a], rivet: true } },
  { id: 'cobra', name: 'Cobra', rule: 'Found in skin crates', rarity: 'rare', theme: th(0x2a2a2e, 0x16161a, 0x3a3a40, 0x16161a, 0xe8c04a, 0xfff0a0, 0x0c0c0e), fx: { mode: 4, cell: 13, c: [0x0c0c0e, 0x4a4a52, 0, 0xe8c04a], rivet: true } },
  { id: 'plasma', name: 'Plasma', rule: 'Found in skin crates', rarity: 'epic', theme: th(0x1a1030, 0x0c0818, 0x241446, 0x0c0818, 0x6af0ff, 0xd0fbff, 0x07040f), fx: { mode: 3, cell: 12, c: [0xc060ff, 0, 0, 0x6af0ff], glow: 0.9, glowCol: 0x9a50ff, shine: 1 } },
  { id: 'magma', name: 'Magma', rule: 'Found in skin crates', rarity: 'epic', theme: th(0x1a0f0c, 0x0c0705, 0x2a1810, 0x0c0705, 0xff9a3a, 0xffe08a, 0x070302), fx: { mode: 6, cell: 10, c: [0xffc030, 0x8a2008, 0, 0], glow: 0.9, glowCol: 0xff7a10, shine: 1 } },
  { id: 'obsidian', name: 'Obsidian', rule: 'Found in skin crates', rarity: 'epic', theme: th(0x1a1626, 0x0d0a16, 0x241c36, 0x0d0a16, 0xb48cff, 0xe8d8ff, 0x05030a), fx: { mode: 7, cell: 22, c: [0, 0, 0, 0xb48cff], rivet: true, glow: 0.4, glowCol: 0x9a60ff, shine: 1, gloss: true } },
  { id: 'aurora', name: 'Aurora', rule: 'Found in skin crates', rarity: 'legendary', theme: th(0x0a2a2a, 0x061a1a, 0x103a3a, 0x061a1a, 0x7affd0, 0xd8fff0, 0x020c0c), fx: { mode: 5, cell: 16, c: [0x4af0b0, 0x2a8fd0, 0x9a6aff, 0], glow: 0.5, glowCol: 0x40ffc0, shine: 1, spark: 0xb8fff0 } },
  { id: 'borealis', name: 'Borealis', rule: 'Found in the Holiday Case', rarity: 'legendary', holiday: true, theme: th(0x0b1e2e, 0x061018, 0x10304a, 0x061018, 0x7affd0, 0xd8fff0, 0x03080e), fx: { mode: 12, cell: 16, c: [0x3af0a0, 0x7a5aff, 0x40c8ff, 0], glow: 0.8, glowCol: 0x40ffc0, shine: 1, spark: 0xb8fff0 } },
  { id: 'prism', name: 'Prism', rule: 'Found in skin crates', rarity: 'legendary', theme: th(0x70708a, 0x40405a, 0x5a5a76, 0x30304a, 0xe8e8ff, 0xffffff, 0x14141e), fx: { mode: 9, cell: 8, c: [0, 0, 0, 0xffffff], glow: 0.35, glowCol: 0xffffff, shine: 1, spark: 0xffffff, gloss: true } },
  { id: 'diamondice', name: 'Diamond Ice', rule: 'Found in skin crates', rarity: 'legendary', theme: th(0x6fd6f5, 0x2f8fc0, 0x8fe4ff, 0x1f6a94, 0xffffff, 0xffffff, 0x0f3d5a), fx: { mode: 8, cell: 7, c: [0xe8fbff, 0, 0, 0xffffff], glow: 0.4, glowCol: 0x70e0ff, shine: 1, spark: 0xe8fbff, gloss: true } },
  // ---- HOLIDAY CASE (Christmas season) ----
  { id: 'candycane', name: 'Candy Cane', rule: 'Found in the Holiday Case', rarity: 'common', holiday: true, theme: th(0xf6f2ee, 0xd62828, 0xf6f2ee, 0xd62828, 0xffffff, 0xffffff, 0x8a1a1a), fx: { mode: 2, cell: 8, c: [0xd62828, 0, 0, 0], gloss: true } },
  { id: 'gingerbread', name: 'Gingerbread', rule: 'Found in the Holiday Case', rarity: 'common', holiday: true, theme: th(0x9a5b2e, 0x7a4420, 0xa86a38, 0x6a3a1a, 0xfff3e0, 0xfff3e0, 0x4a2610), fx: { mode: 3, cell: 9, c: [0xfff3e0, 0, 0, 0xe53935], rivet: true } },
  { id: 'holly', name: 'Holly Jolly', rule: 'Found in the Holiday Case', rarity: 'rare', holiday: true, theme: th(0x1f6b3a, 0x144d28, 0x2a8048, 0x144d28, 0xd4a82a, 0xffe08a, 0x0a2a14), fx: { mode: 6, cell: 14, c: [0, 0xd7262f, 0, 0], glow: 0 } },
  { id: 'ornament', name: 'Ornament', rule: 'Found in the Holiday Case', rarity: 'rare', holiday: true, theme: th(0xc62828, 0x1f8a4c, 0xe6b422, 0x1f8a4c, 0xffd45a, 0xfff0a0, 0x5a1010), fx: { mode: 1, cell: 6, c: [0xc62828, 0x1f8a4c, 0xe6b422, 0], glow: 0.15, glowCol: 0xffd45a, spark: 0xffe08a, gloss: true } },
  { id: 'snowflake', name: 'Snowflake', rule: 'Found in the Holiday Case', rarity: 'epic', holiday: true, theme: th(0x7fb8e8, 0x3f7fb8, 0x9ad0f2, 0x2f6b9a, 0xe6f8ff, 0xffffff, 0x1c4766), fx: { mode: 10, cell: 18, c: [0xffffff, 0, 0, 0], glow: 0.4, glowCol: 0xa8e0ff, shine: 1, spark: 0xe8fbff, gloss: true } },
  { id: 'northernlights', name: 'Northern Lights', rule: 'Found in the Holiday Case', rarity: 'legendary', holiday: true, theme: th(0x2a6a8a, 0x0c1a2c, 0x2a6a8a, 0xece5cf, 0xefe8d4, 0xfffaf0, 0x14264a), fx: { mode: 11, cell: 16, c: [0x22c48a, 0x7a52e8, 0x2f8fe0, 0x22b8b8], gloss: true, knot: true } },
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
  else if (m > 8.5 && m < 9.5) { vec3 irid = 0.55 + 0.45 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + (vObj.z * 1.4 + vObj.y * 0.9) * 0.7 + uTime * 0.12)); col = mix(col, irid, paint * 0.28); }
  else if (m > 9.5 && m < 10.5) { vec2 fq = fract(vec2(vObj.z, vObj.y) * uCell * 0.5) - 0.5; float ax = min(abs(fq.x), abs(fq.y)), mxv = max(abs(fq.x), abs(fq.y)); float flake = max(step(ax, 0.07) * step(mxv, 0.4), step(abs(abs(fq.x) - abs(fq.y)), 0.07) * step(mxv, 0.28)); vec2 cid = floor(vec2(vObj.z, vObj.y) * uCell * 0.5); flake *= step(0.55, fract(sin(dot(cid, vec2(12.9898, 78.233))) * 43758.5453)); col = mix(col, uC0, paint * flake); }
  else if (m > 10.5 && m < 11.5) {
    // Northern Lights: woven white knotwork on aurora colours. The paint goes green -> teal -> blue -> violet from muzzle to butt; two sets of wavy strands cross over and under each other (white on the paint, aurora-coloured on the cream parts), each with a thin dark outline.
    vec2 kp = vec2(vObj.z, vObj.y + vObj.x * 0.15) * uCell * 1.25;
    float ka = sin(kp.x + sin(kp.y) * 1.4), kb = sin(kp.y + sin(kp.x) * 1.4);
    float la = abs(ka), lb = abs(kb);
    float par = mod(floor(kp.x / 3.14159) + floor(kp.y / 3.14159), 2.0), overA = step(par, 0.5);
    float aIn = step(la, 0.17), bIn = step(lb, 0.17), aOut = step(la, 0.27), bOut = step(lb, 0.27);
    float tg = clamp((vObj.z + 0.285) / 0.71, 0.0, 0.999) * 3.0;
    vec3 pal = tg < 1.0 ? mix(uC0, uC3, tg) : (tg < 2.0 ? mix(uC3, uC2, tg - 1.0) : mix(uC2, uC1, tg - 2.0));
    float cream = step(4.5, vRole) * (1.0 - step(5.5, vRole)), dkr = step(5.5, vRole);
    vec3 base = cream > 0.5 ? col : (dkr > 0.5 ? mix(col, pal * 0.25, 0.6) : pal);
    vec3 cl = cream > 0.5 ? vec3(0.40, 0.38, 0.29) : vec3(0.86, 0.82, 0.68);
    vec3 ol = cream > 0.5 ? vec3(0.72, 0.68, 0.55) : vec3(0.02, 0.05, 0.12);
    vec3 k0 = base;
    float uO = mix(aOut, bOut, overA), uI = mix(aIn, bIn, overA), oO = mix(bOut, aOut, overA), oI = mix(bIn, aIn, overA);
    k0 = mix(k0, ol, uO); k0 = mix(k0, cl, uI); k0 = mix(k0, ol, oO); k0 = mix(k0, cl, oI);
    float butt = step(0.335, vObj.z), zig = step(0.5, fract(vObj.y * 22.0 + abs(fract(vObj.z * 60.0) - 0.5) * 2.2));
    k0 = mix(k0, mix(col, vec3(0.68, 0.64, 0.51), zig * 0.45), butt);   // butt pad: zig-zag bands instead of knots
    col = mix(col, k0, mix(1.0, 0.6, dkr));
  }
  else if (m > 11.5) { float wv = 0.5 + 0.5 * sin(vObj.z * uCell * 0.4 + vObj.y * 5.0 + uTime * 0.9); vec3 au = mix(uC0, uC1, wv); au = mix(au, uC2, step(0.7, 0.5 + 0.5 * sin(vObj.z * uCell * 0.9 - uTime * 0.6))); col = mix(col, au, paint * 0.8); fxE += au * paint * uGlow * 0.5; }
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
function buildThemed(geo, f, kind, gid) {
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
    if (f.fx.knot && gid === 'ranger') {   // the AWP: painted receiver, stock and forend; cream barrel, magazine and butt pad; dark scope tube with cream caps
      if (cz > 0.335) role = 5; else if (cy > 0.088 && cz > -0.34 && cz < 0.22) role = 5;
      else if (cz < -0.285) role = 5; else if (cy < -0.066 && cz > -0.1 && cz < 0.07) role = 5; else if (role >= 4 && cy < 0.09) role = 0;
    }
    if (kind === 'knife') role = cz < -0.015 ? ((lum > 0.75 || sat > 0.3) ? 0 : 5) : ((cz > 0.14 && sat > 0.3) || cz < 0.03) ? 4 : 3;   // knife: blade = painted with the skin, spine + edge = shiny, guard + pommel = metal, grip = painted
    const ny = N.getY(i0), shade = ny > 0.5 ? 1.08 : ny < -0.5 ? 0.72 : 0.92, dst = role >= 4 ? B : A;
    tmp.setHex(roleHex[role]).multiplyScalar(shade);
    for (let k = 0; k < 3; k++) { dst.pos.push(P.getX(i0 + k), P.getY(i0 + k), P.getZ(i0 + k)); dst.nor.push(N.getX(i0 + k), N.getY(i0 + k), N.getZ(i0 + k)); dst.col.push(tmp.r, tmp.g, tmp.b); dst.role.push(role); }
  }
  const build = (s) => { if (!s.pos.length) return null; const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3)); gg.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(s.col, 3)); gg.setAttribute('aRole', new THREE.Float32BufferAttribute(s.role, 1)); return gg; };
  geo.computeBoundingBox();
  return { matte: build(A) || build(B), shiny: A.pos.length ? build(B) : null, box: geo.boundingBox.clone() };
}
function makeSparks(box, hex, sparkN) {
  const n = sparkN || 16, pos = new Float32Array(n * 3), s = box.getSize(new THREE.Vector3());
  for (let i = 0; i < n; i++) { pos[i * 3] = box.min.x + Math.random() * s.x; pos[i * 3 + 1] = box.min.y - 0.02 + Math.random() * (s.y + 0.1); pos[i * 3 + 2] = box.min.z + Math.random() * s.z; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.022, color: hex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  p.userData = { top: box.max.y + 0.08, bot: box.min.y - 0.02 }; p.frustumCulled = false; SPARKS.add(p); return p;
}
export function applyFinish(mesh, finish, kind, gid) {
  if (!mesh) return;
  const ud = mesh.userData; ud.base ??= { geometry: mesh.geometry, material: mesh.material };
  for (const k of ud.fxKids || []) { mesh.remove(k); if (k.geometry && k.geometry !== ud.base.geometry && !k.isPoints) k.geometry.dispose(); }
  ud.fxKids = [];
  if (!finish || !finish.theme) { mesh.geometry = ud.base.geometry; mesh.material = ud.base.material; return; }
  ud.themed ??= {}; const sp = (ud.themed[finish.id + (kind || '') + (finish.fx.knot ? gid || '' : '')] ??= buildThemed(ud.base.geometry, finish, kind, gid));
  mesh.geometry = sp.matte; mesh.material = matFor(finish, false);
  if (sp.shiny) { const k = new THREE.Mesh(sp.shiny, matFor(finish, true)); mesh.add(k); ud.fxKids.push(k); }
  if (finish.fx.spark && fxQuality.shine) { const p = makeSparks(sp.box, finish.fx.spark, finish.fx.sparkN); mesh.add(p); ud.fxKids.push(p); }
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
      if (lum < 0.02 || lum > 0.85) continue;   // black gear stays, and so do the bright eyes + a silver team band   // pure black gear stays
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
    else if (fx.mode === 10) { cx.fillStyle = c(0, '#fff'); for (let yy = y; yy < y + h; yy += 9) for (let xx = x; xx < x + w; xx += 9) if (rnd() > 0.55) { cx.fillRect(xx + 3, yy, 2, 8); cx.fillRect(xx, yy + 3, 8, 2); cx.fillRect(xx + 1, yy + 1, 2, 2); cx.fillRect(xx + 5, yy + 5, 2, 2); } }
    else if (fx.mode === 12) { cx.globalAlpha = 0.65; for (let xx = x; xx < x + w; xx += 5) { cx.fillStyle = [c(0, '#3fa'), c(1, '#75f'), c(2, '#4cf')][Math.floor(xx / 5 + Math.sin(xx * 0.2) * 1.4 + 9) % 3]; cx.fillRect(xx, y, 5, h); } cx.globalAlpha = 1; }
    else if (fx.mode === 11) { drawKnot(cx, x, y, w, h, 7, '#f3f7ff', '#123055'); }
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
  { id: 'karambit', name: 'Karambit', rule: 'Legendary drop from cases', rarity: 'legendary' },
  { id: 'machete', name: 'Machete', rule: 'Legendary drop from cases', rarity: 'legendary' },
  { id: 'dagger', name: 'Dagger', rule: 'Legendary drop from cases', rarity: 'legendary' },
  { id: 'candycane', name: 'Candy Cane Knife', rule: 'Holiday gift', gift: true }
];

// crate drop odds (percent), the colour of each rarity, and the coins you get back for a duplicate
export const rarities = {
  common: { name: 'Common', pct: 55, color: 0xb8c2cc, refund: 25, sell: 35, hrefund: 5, hsell: 15 },
  rare: { name: 'Rare', pct: 30, color: 0x4aa3ff, refund: 50, sell: 80, hrefund: 10, hsell: 35 },
  epic: { name: 'Epic', pct: 12, color: 0xb45cff, refund: 100, sell: 190, hrefund: 20, hsell: 70 },
  legendary: { name: 'Legendary', pct: 3, color: 0xffc247, refund: 200, sell: 525, hrefund: 40, hsell: 120 }
};

// ---------------------------------------------------------------- inventory card: a square of the skin itself, edge to edge, like wrapping paper
// Woven knotwork for the flat pictures (Northern Lights): vertical and horizontal wavy strands that cross over and under, each with a dark outline. Same maths as the 3D shader.
function drawKnot(cx, x0, y0, w, h, sc, line, edge) {
  const P = Math.PI * sc, i0 = Math.floor(x0 / P), i1 = Math.ceil((x0 + w) / P), j0 = Math.floor(y0 / P), j1 = Math.ceil((y0 + h) / P);
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    const cxp = i * P, cyp = j * P, over = (i + j) % 2 === 0 ? 'A' : 'B';
    cx.save(); cx.beginPath(); cx.rect(cxp, cyp, P, P); cx.clip(); cx.lineJoin = 'round'; cx.lineCap = 'round';
    const strands = (vertical) => {
      for (let n = (vertical ? i : j) - 1; n <= (vertical ? i : j) + 2; n++) {
        cx.beginPath();
        for (let t = (vertical ? cyp : cxp) - 2; t <= (vertical ? cyp : cxp) + P + 2; t += 2) { const o = sc * (n * Math.PI - 1.4 * Math.sin(t / sc)); vertical ? (t === cyp - 2 ? cx.moveTo(o, t) : cx.lineTo(o, t)) : (t === cxp - 2 ? cx.moveTo(t, o) : cx.lineTo(t, o)); }
        cx.strokeStyle = edge; cx.lineWidth = sc * 0.62; cx.stroke(); cx.strokeStyle = line; cx.lineWidth = sc * 0.3; cx.stroke();
      }
    };
    if (over === 'A') { strands(false); strands(true); } else { strands(true); strands(false); }
    cx.restore();
  }
}
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
  else if (m === 10) { cx.fillStyle = c(0, '#fff'); for (let y = 0; y < W; y += 22) for (let x = 0; x < W; x += 22) if (rnd() > 0.45) { cx.fillRect(x + 8, y, 5, 20); cx.fillRect(x, y + 8, 20, 5); cx.fillRect(x + 3, y + 3, 4, 4); cx.fillRect(x + 14, y + 14, 4, 4); cx.fillRect(x + 14, y + 3, 4, 4); cx.fillRect(x + 3, y + 14, 4, 4); } }
  else if (m === 12) { cx.globalAlpha = 0.75; for (let x = 0; x < W; x += 6) { const t = Math.sin(x * 0.11) + Math.sin(x * 0.05 + 1); cx.fillStyle = t > 0.7 ? c(2, '#4cf') : t > -0.3 ? c(0, '#3fa') : c(1, '#75f'); cx.fillRect(x, 0, 6, W); } cx.globalAlpha = 1; for (let k = 0; k < 20; k++) { cx.fillStyle = '#fff'; cx.fillRect((rnd() * W) | 0, (rnd() * W) | 0, 2, 2); } }
  else if (m === 11) { const gx = finishes.find((x) => x.id === 'galaxy'); drawSkinSwatch(cx, gx); return; }   // Northern Lights card: the pink / violet blocky tile with the little crosses (Hyrum's pick: the 4th tile)
  else if (m === 9) { const g = cx.createLinearGradient(0, 0, W, W); g.addColorStop(0, '#ffd6f0'); g.addColorStop(0.35, '#d6ecff'); g.addColorStop(0.65, '#fff3d6'); g.addColorStop(1, '#e3d6ff'); cx.fillStyle = g; cx.fillRect(0, 0, W, W); }
  if (fx.outline) { cx.strokeStyle = hx(fx.c[3] || 0x9aa5b0); cx.lineWidth = 2; for (let k = 16; k < W; k += 32) { cx.beginPath(); cx.moveTo(0, k); cx.lineTo(W, k); cx.moveTo(k, 0); cx.lineTo(k, W); cx.stroke(); } }
  if (fx.rivet) { cx.fillStyle = hx(fx.c[3] || 0xcccccc); for (let y = 8; y < W; y += 24) for (let x = 8; x < W; x += 24) cx.fillRect(x, y, 3, 3); }
  // trim strips: metal on top (with a bright edge), barrel colour at the bottom
  cx.fillStyle = hx(T.metal); cx.fillRect(0, 0, W, 9); cx.fillStyle = hx(T.edge); cx.fillRect(0, 0, W, 3); cx.fillStyle = hx(T.barrel); cx.fillRect(0, W - 9, W, 9); cx.fillStyle = hx(T.edge); cx.fillRect(0, W - 9, W, 2);
  if (fx.shine) { const g = cx.createLinearGradient(0, 0, W, W); g.addColorStop(0.35, '#ffffff00'); g.addColorStop(0.5, '#ffffff66'); g.addColorStop(0.65, '#ffffff00'); cx.fillStyle = g; cx.fillRect(0, 0, W, W); }
  if (fx.glow) { const g = cx.createRadialGradient(W / 2, W / 2, 20, W / 2, W / 2, W * 0.75); g.addColorStop(0, '#ffffff00'); g.addColorStop(1, hx(fx.glowCol || 0xffffff) + '55'); cx.fillStyle = g; cx.fillRect(0, 0, W, W); }
  if (fx.spark) { cx.fillStyle = hx(fx.spark); for (const [x, y] of [[22, 30], [96, 24], [60, 70], [104, 98], [28, 100]]) { cx.fillRect(x - 1, y - 6, 3, 13); cx.fillRect(x - 6, y - 1, 13, 3); } }
}

// ================================================================ CASES, STICKER PACKS, STICKERS
// A skin rolled from a case fits ONE random gun (or the knife). Stickers come in packs: each sticker is used once and stays on the gun.
export const cases = [
  { id: 'street', kind: 'skin', name: 'Street Case', price: 100, tint: 0xffffff, sub: '19 skins: camo, carbon, candy, stripes, dragon, tiger, plasma, magma, gold, galaxy, aurora and more. Each one fits one random gun.',
    knives: true, finishes: ['desert', 'carbon', 'candy', 'urban', 'forest', 'sunset', 'ocean', 'dragon', 'tiger', 'cobra', 'toxic', 'plasma', 'magma', 'obsidian', 'gold', 'galaxy', 'aurora', 'prism', 'diamondice'], odds: { common: 55, rare: 30, epic: 12, legendary: 3 } },
  { id: 'white', kind: 'skin', name: 'Whiteout Case', price: 250, tint: 0xe9f2fb, sub: 'Only the white skins: Snow White, Frost, Ivory, Ghost, Polar Camo and Pearl. Each fits one random gun.',
    finishes: ['snow', 'frost', 'ivory', 'ghost', 'polarcamo', 'pearl'], odds: { rare: 62, epic: 30, legendary: 8 } },
  { id: 'camo', kind: 'skin', name: 'Camo Case', price: 80, tint: 0x6d7d4c, sub: 'Camo and stripes: Desert, Urban, Forest, Tiger, Cobra, Polar Camo, Obsidian. Each fits one random gun.',
    finishes: ['desert', 'urban', 'forest', 'tiger', 'cobra', 'polarcamo', 'obsidian'], odds: { common: 60, rare: 30, epic: 10 } },
  { id: 'neon', kind: 'skin', name: 'Neon Case', price: 200, tint: 0x5b34c8, sub: 'Bright and glowing: Candy, Sunset, Ocean, Dragon, Tiger, Toxic, Plasma, Magma, Aurora, Galaxy, Prism.',
    knives: true, finishes: ['candy', 'sunset', 'ocean', 'dragon', 'tiger', 'toxic', 'plasma', 'magma', 'aurora', 'galaxy', 'prism'], odds: { common: 40, rare: 30, epic: 22, legendary: 8 } },
  { id: 'pistol', kind: 'skin', name: 'Pistol Case', price: 80, tint: 0xa2683c, slot: 'sec', sub: 'Skins that only roll for PISTOLS (P-9, Viper, Trio, Peacemaker and the other side arms).',
    finishes: ['desert', 'carbon', 'candy', 'urban', 'forest', 'sunset', 'ocean', 'dragon', 'tiger', 'cobra', 'toxic', 'plasma', 'gold', 'galaxy'], odds: { common: 60, rare: 28, epic: 10, legendary: 2 } },
  { id: 'main', kind: 'skin', name: 'Main Gun Case', price: 150, tint: 0x4d5d4a, slot: 'prim', sub: 'Skins that only roll for MAIN GUNS (rifles, SMGs, shotguns, snipers, the LMG).',
    finishes: ['desert', 'carbon', 'candy', 'urban', 'forest', 'sunset', 'ocean', 'dragon', 'tiger', 'cobra', 'toxic', 'plasma', 'magma', 'obsidian', 'gold', 'galaxy', 'aurora', 'prism'], odds: { common: 50, rare: 30, epic: 15, legendary: 5 } },
  { id: 'goldcase', kind: 'skin', name: 'Gold Case', price: 500, tint: 0xe0b020, sub: 'No common skins! Rare or better only, with a much bigger chance of legendary (a legendary can be a knife).',
    knives: true, finishes: ['dragon', 'tiger', 'cobra', 'toxic', 'plasma', 'magma', 'obsidian', 'gold', 'galaxy', 'aurora', 'prism', 'diamondice'], odds: { rare: 45, epic: 35, legendary: 20 } },
  { id: 'costume', kind: 'costume', name: 'Costume Case', price: 200, tint: 0xb64cd6, sub: 'Silly outfits for your soldier: Bunny Pajamas, Moo Cow, Banana, Shark Hoodie, Dino Onesie and the legendary Unicorn Onesie!',
    pool: ['bunny', 'cow', 'banana', 'shark', 'dino', 'unicorn'], odds: { common: 45, rare: 30, epic: 18, legendary: 7 } },
  { id: 'gloves', kind: 'glove', name: 'Glove Case', price: 400, tint: 0x2f6fb0, sub: 'Twenty pairs of gloves for your hands: Sport, Driver, Hand Wraps, Moto and Specialist gloves, from Desert Dust up to the legendary Blue Steel, Gold Rush, Hyperspace, Moon Weave and Sunset Fade. You see them on your own hands in the game.',
    pool: ['dust', 'convoy', 'cloth', 'jungle', 'woodland', 'arctic', 'racing', 'skullwrap', 'boom', 'emerald', 'vice', 'cobra', 'ruby', 'polygon', 'reddragon', 'hyper', 'moonweave', 'sunsetfade', 'goldrush', 'bluesteel'], odds: { common: 50, rare: 30, epic: 15, legendary: 5 } },
  { id: 'gloves2', kind: 'glove', name: 'Elite Glove Case', price: 900, tint: 0x1b1b22, sub: 'No common gloves! Rare or better only, with a much bigger chance of a legendary pair (Blue Steel, Gold Rush, Hyperspace, Moon Weave or Sunset Fade).',
    pool: ['arctic', 'racing', 'skullwrap', 'boom', 'emerald', 'vice', 'cobra', 'ruby', 'polygon', 'reddragon', 'hyper', 'moonweave', 'sunsetfade', 'goldrush', 'bluesteel'], odds: { rare: 40, epic: 38, legendary: 22 } },
  { id: 'holiday', kind: 'skin', seasonal: true, name: 'Holiday Case', price: 50, tint: 0xc62828, sub: 'Seven holiday skins: Candy Cane, Gingerbread, Holly Jolly, Ornament, Snowflake and the two legendaries, Northern Lights and Borealis. Each fits one random gun. Available Nov 15 through Jan 2.',
    finishes: ['candycane', 'gingerbread', 'holly', 'ornament', 'snowflake', 'northernlights', 'borealis'], odds: { common: 35, rare: 35, epic: 15, legendary: 15 } },
  { id: 'holidaycos', kind: 'costume', holiday: true, name: 'Holiday Costume Case', price: 120, tint: 0x1f8a4c, sub: 'Christmas outfits for your soldier: Elf Suit, Reindeer Suit and the epic Snowman.',
    pool: ['elf', 'reindeer', 'snowman'], odds: { common: 50, rare: 35, epic: 15 } },
  { id: 'stick', kind: 'sticker', name: 'Sticker Pack', price: 50, tint: 0xff8fc4, sub: 'One sticker. You use it once, on one gun, and it stays there.',
    pool: ['star', 'heart', 'smiley', 'lightning', 'flame', 'skull', 'diamond', 'cat', 'crown'], odds: { common: 70, rare: 22, epic: 7, legendary: 1 } },
  { id: 'foil', kind: 'sticker', name: 'Foil Sticker Pack', price: 150, tint: 0x9b7bff, sub: 'One shiny foil sticker: rare or better.',
    pool: ['star', 'heart', 'smiley', 'lightning', 'flame', 'skull', 'diamond', 'cat', 'crown'], odds: { rare: 50, epic: 38, legendary: 12 } }
];
const SP = { R: '#e53935', W: '#ffffff', Y: '#ffd23f', O: '#ff8a2a', K: '#1a1a1f', P: '#ff9ec4', G: '#e8b12c', B: '#3b82f6', C: '#35d6f2', L: '#9a5a2a' };
export const stickers = [
  { id: 'star', name: 'Gold Star', rarity: 'common', art: ['.....Y.....', '.....Y.....', '....YYY....', 'YYYYYYYYYYY', '.YYYYYYYYY.', '..YYYYYYY..', '..YYYYYYY..', '.YYYY.YYYY.', '.YYY...YYY.', 'YY.......YY', '...........'] },
  { id: 'heart', name: 'Pixel Heart', rarity: 'common', art: ['...........', '.RRR...RRR.', 'RRRRR.RRRRR', 'RRWRRRRRRRR', 'RRWRRRRRRRR', 'RRRRRRRRRRR', '.RRRRRRRRR.', '..RRRRRRR..', '...RRRRR...', '....RRR....', '.....R.....'] },
  { id: 'smiley', name: 'Smiley', rarity: 'common', art: ['...YYYYY...', '.YYYYYYYYY.', '.YYKKYKKYY.', 'YYYKKYKKYYY', 'YYYYYYYYYYY', 'YKYYYYYYYKY', 'YYKYYYYYKYY', '.YYKKKKKYY.', '.YYYYYYYYY.', '...YYYYY...', '...........'] },
  { id: 'lightning', name: 'Lightning', rarity: 'rare', art: ['......YYY..', '.....YYY...', '....YYY....', '...YYY.....', '..YYYYYYY..', '.....YYY...', '....YYY....', '...YYY.....', '..YY.......', '.Y.........', '...........'] },
  { id: 'flame', name: 'Flame', rarity: 'rare', art: ['.....O.....', '....OO.....', '....OOO..O.', '...OOOO.OO.', '..OOOYOOOO.', '..OOYYYOOO.', '.OOOYYYYOOO', '.OOYYYYYYOO', '.OOYYYYYYOO', '..OOYYYYOO.', '...OOOOOO..'] },
  { id: 'skull', name: 'Skull', rarity: 'rare', art: ['..WWWWWWW..', '.WWWWWWWWW.', 'WWWWWWWWWWW', 'WWKKWWWKKWW', 'WWKKWWWKKWW', 'WWWWWKWWWWW', '.WWWWKWWWW.', '..WWWWWWW..', '..WKWKWKW..', '..WKWKWKW..', '...........'] },
  { id: 'diamond', name: 'Diamond', rarity: 'epic', art: ['...CCCCC...', '..CCWCCCC..', '.CCWCCCCCC.', 'CCCCCCCCCCC', '.CCCCCCCCC.', '..CCCCCCC..', '...CCCCC...', '....CCC....', '.....C.....', '...........', '...........'] },
  { id: 'cat', name: 'Cool Cat', rarity: 'epic', art: ['O.........O', 'OO.......OO', 'OOOOOOOOOOO', 'OOKOOOOOKOO', 'OOKOOOOOKOO', 'OOOOOPOOOOO', 'OOOOKPKOOOO', '.OOOOOOOOO.', '..OOOOOOO..', '...........', '...........'] },
  { id: 'crown', name: 'Crown', rarity: 'legendary', art: ['...........', 'G....G....G', 'GG..GGG..GG', 'GGGGGGGGGGG', 'GGGGGGGGGGG', 'GGRGGBGGRGG', 'GGGGGGGGGGG', 'GGGGGGGGGGG', '...........', '...........', '...........'] }
];
// draws one sticker (blocky pixel art with a white die-cut border); epic + legendary ones get a foil shine
export function drawSticker(cx, id, size = 128) {
  const s = stickers.find((x) => x.id === id), N = 11, cell = Math.floor(size / (N + 2)), off = Math.floor((size - N * cell) / 2);
  cx.clearRect(0, 0, size, size); if (!s) return;
  const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && s.art[y][x] !== '.';
  cx.fillStyle = '#ffffff';
  for (let y = -1; y <= N; y++) for (let x = -1; x <= N; x++) if (!on(x, y)) { let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (on(x + dx, y + dy)) near = true; if (near) cx.fillRect(off + x * cell, off + y * cell, cell, cell); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ch = s.art[y][x]; if (ch !== '.') { cx.fillStyle = SP[ch] || '#fff'; cx.fillRect(off + x * cell, off + y * cell, cell, cell); } }
  if (s.rarity === 'epic' || s.rarity === 'legendary') {
    cx.save(); cx.globalCompositeOperation = 'source-atop'; const g = cx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0.2, '#ff6ad500'); g.addColorStop(0.38, '#ff6ad566'); g.addColorStop(0.5, '#ffffffaa'); g.addColorStop(0.62, '#6ad8ff66'); g.addColorStop(0.8, '#6ad8ff00'); cx.fillStyle = g; cx.fillRect(0, 0, size, size); cx.restore();
  }
}
const stkTex = new Map();
export function stickerTexture(id) {
  if (stkTex.has(id)) return stkTex.get(id);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; drawSticker(cv.getContext('2d'), id, 128);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; stkTex.set(id, t); return t;
}
// stick the gun's stickers on both sides of it (up to 3, in a row along the body)
export function applyStickers(mesh, list) {
  if (!mesh) return;
  const ud = mesh.userData;
  for (const k of ud.stkKids || []) { mesh.remove(k); k.material.dispose(); k.geometry.dispose(); }
  ud.stkKids = [];
  if (!list || !list.length) return;
  const geo = ud.base ? ud.base.geometry : mesh.geometry; geo.computeBoundingBox(); const bb = geo.boundingBox, L = bb.max.z - bb.min.z, H = bb.max.y - bb.min.y;
  const size = Math.min(0.11, Math.max(0.035, L * 0.1)), y0 = bb.min.y + H * 0.58;
  const put = (id, x, y, z, side) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: stickerTexture(id), transparent: true, alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.position.set(x + side * 0.002, y, z); m.rotation.y = side * Math.PI / 2; mesh.add(m); ud.stkKids.push(m);
  };
  let auto = 0;
  list.slice(0, 4).forEach((it) => {
    if (typeof it === 'string') { const z = bb.max.z - L * (0.34 + 0.15 * auto++); put(it, bb.max.x, y0, z, 1); put(it, bb.min.x, y0, z, -1); }
    else put(it.id, it.x, it.y, it.z, it.s || 1);
  });
}

// ================================================================ COSTUMES (just for fun: they never change how strong you are)
export const costumes = [
  { id: 'bunny', name: 'Bunny Pajamas', rarity: 'common', tint: 0xf0e6ef }, { id: 'cow', name: 'Moo Cow Suit', rarity: 'common', tint: 0xffffff },
  { id: 'banana', name: 'Banana Suit', rarity: 'rare', tint: 0xffe14a }, { id: 'shark', name: 'Shark Hoodie', rarity: 'rare', tint: 0x4a8fd0 },
  { id: 'dino', name: 'Dino Onesie', rarity: 'epic', tint: 0x5cc45e }, { id: 'unicorn', name: 'Unicorn Onesie', rarity: 'legendary', tint: 0xffe8f4 },
  { id: 'elf', name: 'Elf Suit', rarity: 'common', tint: 0x2fa34a, holiday: true }, { id: 'reindeer', name: 'Reindeer Suit', rarity: 'rare', tint: 0xa86a3a, holiday: true }, { id: 'snowman', name: 'Snowman', rarity: 'epic', tint: 0xf6f9fc, holiday: true }
];
export function drawCostumeIcon(cx, id) {
  const c = costumes.find((x) => x.id === id), hx = (n) => '#' + n.toString(16).padStart(6, '0'), t = c ? hx(c.tint) : '#6c7580', dk = '#1b1d22';
  cx.clearRect(0, 0, 128, 128); const bg = cx.createLinearGradient(0, 0, 0, 128); bg.addColorStop(0, '#3c3a46'); bg.addColorStop(1, '#1f1e26'); cx.fillStyle = bg; cx.fillRect(0, 0, 128, 128);
  const R = (x, y, w, h, col) => { cx.fillStyle = col; cx.fillRect(x, y, w, h); };
  R(40, 96, 18, 28, t); R(70, 96, 18, 28, t); R(34, 58, 60, 42, t); R(20, 62, 16, 30, t); R(92, 62, 16, 30, t);   // legs, body, arms
  R(40, 18, 48, 42, t); R(40, 36, 48, 16, dk); R(48, 41, 9, 6, '#fff'); R(71, 41, 9, 6, '#fff');                      // head, mask, eyes
  R(40, 30, 48, 5, '#c9b88a');                                                                                     // team band
  const acc = {
    unicorn: () => { R(60, 2, 8, 12, '#ffd24a'); R(62, 0, 4, 4, '#fff0a0'); R(36, 10, 9, 12, '#ffb6d9'); R(83, 10, 9, 12, '#ffb6d9'); ['#ff5c8a', '#ffa14a', '#ffe14a', '#6bdc7a', '#4ab4ff'].forEach((col, k) => R(88, 22 + k * 8, 8, 8, col)); },
    dino: () => { R(60, 8, 8, 10, '#f2c14a'); R(48, 10, 8, 8, '#f2c14a'); R(72, 10, 8, 8, '#f2c14a'); R(96, 70, 22, 12, '#4aae4c'); R(112, 76, 12, 8, '#3f9a42'); },
    banana: () => { R(60, 8, 7, 10, '#6b4a1e'); R(66, 6, 18, 6, '#4caf50'); R(54, 8, 12, 5, '#4caf50'); },
    bunny: () => { R(46, -16, 11, 34, '#f3e9f1'); R(72, -16, 11, 34, '#f3e9f1'); R(49, -10, 5, 24, '#ffb6c9'); R(75, -10, 5, 24, '#ffb6c9'); R(96, 80, 18, 18, '#fff'); },
    cow: () => { R(38, 8, 7, 12, '#f0e4c0'); R(83, 8, 7, 12, '#f0e4c0'); R(44, 66, 18, 16, '#1a1a1f'); R(66, 80, 14, 12, '#1a1a1f'); R(92, 84, 5, 28, '#1a1a1f'); },
    elf: () => { R(26, 14, 12, 8, '#f2c6a0'); R(90, 14, 12, 8, '#f2c6a0'); R(20, 8, 8, 8, '#f2c6a0'); R(100, 8, 8, 8, '#f2c6a0'); R(34, 80, 60, 7, '#d62828'); R(58, 79, 12, 9, '#e6b422'); },
    reindeer: () => { R(48, 4, 5, 18, '#5a3a1e'); R(75, 4, 5, 18, '#5a3a1e'); R(40, 4, 10, 4, '#5a3a1e'); R(78, 4, 10, 4, '#5a3a1e'); R(56, 46, 16, 12, '#e53935'); R(104, 76, 12, 12, '#f4efe4'); },
    snowman: () => { R(56, 44, 22, 8, '#ff8a2a'); R(60, 70, 8, 8, '#1a1a1f'); R(60, 84, 8, 8, '#1a1a1f'); R(34, 58, 60, 8, '#d62828'); R(36, 66, 10, 22, '#d62828'); },
    shark: () => { R(60, 4, 6, 18, '#3a7fc0'); R(92, 66, 6, 34, '#3a7fc0'); [-12, -4, 4, 12].forEach((x) => R(60 + x, 54, 6, 6, '#fff')); }
  }[id]; if (acc) acc();
}
const cosTex = new Map();
export function costumeTexture(id) {
  if (cosTex.has(id)) return cosTex.get(id);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; drawCostumeIcon(cv.getContext('2d'), id);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; cosTex.set(id, t); return t;
}
