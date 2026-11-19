// GLOVES (cosmetic only: they never change how strong you are). Five glove styles, four skins each, from Common to Legendary.
// You wear one pair: the first-person hands show them, and so does the soldier in the menu.
// Each pair is a small blocky pattern tile (painted here with plain rectangles, like everything else in the game) plus a cuff colour.
import * as THREE from './three.module.min.js?v=322';

export const gloveTypes = { sport: 'Sport Gloves', driver: 'Driver Gloves', wraps: 'Hand Wraps', moto: 'Moto Gloves', specialist: 'Specialist Gloves' };
// base / alt / acc = the three pattern colours, cuff = the wrist band, mode = which pattern, glow = a soft shine for the legendary ones
export const gloves = [
  { id: 'dust', name: 'Desert Dust', type: 'sport', rarity: 'common', mode: 'camo', base: 0xb89a62, alt: 0x8c7248, acc: 0xd8c08c, cuff: 0x5a4a30 },
  { id: 'convoy', name: 'Night Convoy', type: 'driver', rarity: 'common', mode: 'stripes', base: 0x23262b, alt: 0x3a4a30, acc: 0x6b7a4e, cuff: 0x15171b },
  { id: 'cloth', name: 'Cloth Wraps', type: 'wraps', rarity: 'common', mode: 'plain', base: 0xd8d2c0, alt: 0xb8b09a, acc: 0x8a8470, cuff: 0x6a6454 },
  { id: 'jungle', name: 'Jungle Camo', type: 'moto', rarity: 'common', mode: 'camo', base: 0x3c5a2c, alt: 0x24401c, acc: 0x6e8a3c, cuff: 0x1a1a1a },
  { id: 'woodland', name: 'Woodland', type: 'specialist', rarity: 'common', mode: 'camo', base: 0x6a5a3a, alt: 0x3e4a2a, acc: 0x8a7a50, cuff: 0x2a2a22 },
  { id: 'arctic', name: 'Arctic Stripe', type: 'sport', rarity: 'rare', mode: 'stripes', base: 0xe8f0f8, alt: 0x4aa3ff, acc: 0x1d3a6a, cuff: 0x1d3a6a },
  { id: 'racing', name: 'Racing Plaid', type: 'driver', rarity: 'rare', mode: 'plaid', base: 0xb82020, alt: 0xf4f0e8, acc: 0x181818, cuff: 0x181818 },
  { id: 'skullwrap', name: 'Skull Wraps', type: 'wraps', rarity: 'rare', mode: 'skulls', base: 0x1d2f55, alt: 0xe8eef8, acc: 0x4a7acb, cuff: 0x0f1a30 },
  { id: 'boom', name: 'Comic Boom', type: 'moto', rarity: 'rare', mode: 'comic', base: 0xf0c020, alt: 0xe03030, acc: 0x202020, cuff: 0x202020 },
  { id: 'emerald', name: 'Emerald Net', type: 'specialist', rarity: 'rare', mode: 'net', base: 0x0c2a1c, alt: 0x2fd68a, acc: 0xb8ffd8, cuff: 0x06140e },
  { id: 'vice', name: 'Vice City', type: 'sport', rarity: 'epic', mode: 'fade', base: 0xff4fb8, alt: 0x2fd6d0, acc: 0xffffff, cuff: 0x2a1050 },
  { id: 'cobra', name: 'King Cobra', type: 'driver', rarity: 'epic', mode: 'scales', base: 0x2f8f4a, alt: 0x1d5a30, acc: 0xe8d84a, cuff: 0x0f2a1a },
  { id: 'ruby', name: 'Ruby Weave', type: 'wraps', rarity: 'epic', mode: 'weave', base: 0xa01028, alt: 0x300810, acc: 0xff6070, cuff: 0x180608 },
  { id: 'polygon', name: 'Polygon', type: 'moto', rarity: 'epic', mode: 'poly', base: 0x6a3cc8, alt: 0x2fd6d0, acc: 0xff4fd0, cuff: 0x15102a },
  { id: 'reddragon', name: 'Red Dragon', type: 'specialist', rarity: 'epic', mode: 'dragon', base: 0x8a1018, alt: 0xe8b030, acc: 0xffe27a, cuff: 0x1a0a0a },
  { id: 'hyper', name: 'Hyperspace', type: 'sport', rarity: 'legendary', mode: 'stars', base: 0x120a2e, alt: 0x9a6cff, acc: 0xff4fd0, cuff: 0x05030d, glow: 0x9a50ff },
  { id: 'moonweave', name: 'Moon Weave', type: 'driver', rarity: 'legendary', mode: 'weave', base: 0xe8ecf4, alt: 0xb0b8c8, acc: 0xffffff, cuff: 0x30343c, glow: 0xe8ecff },
  { id: 'sunsetfade', name: 'Sunset Fade', type: 'wraps', rarity: 'legendary', mode: 'fade', base: 0xffa030, alt: 0xe8307a, acc: 0xffe27a, cuff: 0x3a1030, glow: 0xff7a40 },
  { id: 'goldrush', name: 'Gold Rush', type: 'moto', rarity: 'legendary', mode: 'rivet', base: 0xe6b422, alt: 0xc99412, acc: 0xfff3b0, cuff: 0x3a2a08, glow: 0xffc830 },
  { id: 'bluesteel', name: 'Blue Steel', type: 'specialist', rarity: 'legendary', mode: 'hardened', base: 0x2a50d8, alt: 0x7a3cc8, acc: 0xe8bd4a, cuff: 0x15171b, glow: 0x4a70ff }
];
export const gloveById = (id) => gloves.find((g) => g.id === id) || null;
export const gloveLabel = (g) => gloveTypes[g.type] + ' | ' + g.name;

const hx = (n) => '#' + n.toString(16).padStart(6, '0');
const mixHex = (a, b, t) => { const c = (s) => ((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t; return '#' + [16, 8, 0].map((s) => Math.round(c(s)).toString(16).padStart(2, '0')).join(''); };

// ---- the pattern tile (64 x 64): blocky, drawn with rectangles only
const tileCache = new Map();
export function gloveTile(id) {
  if (tileCache.has(id)) return tileCache.get(id);
  const g = gloveById(id), S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; tileCache.set(id, cv);
  const cx = cv.getContext('2d'); if (!g) { cx.fillStyle = '#444'; cx.fillRect(0, 0, S, S); return cv; }
  let seed = id.length * 977 + id.charCodeAt(0) * 31 + id.charCodeAt(id.length - 1) * 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const B = hx(g.base), A = hx(g.alt), C = hx(g.acc), R = (x, y, w, h, col) => { cx.fillStyle = col; cx.fillRect(x, y, w, h); };
  R(0, 0, S, S, B);
  switch (g.mode) {
    case 'stripes': for (let k = -S; k < S * 2; k += 16) { cx.strokeStyle = A; cx.lineWidth = 7; cx.beginPath(); cx.moveTo(k, 0); cx.lineTo(k - S, S); cx.stroke(); cx.strokeStyle = C; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(k + 6, 0); cx.lineTo(k + 6 - S, S); cx.stroke(); } break;
    case 'plaid': cx.globalAlpha = 0.6; for (let k = 0; k < S; k += 32) { R(k + 6, 0, 14, S, A); R(0, k + 6, S, 14, A); } cx.globalAlpha = 1; for (let k = 0; k < S; k += 32) { R(k + 12, 0, 2, S, C); R(0, k + 12, S, 2, C); R(k + 26, 0, 2, S, C); R(0, k + 26, S, 2, C); } break;
    case 'scales': for (let y = 0, row = 0; y < S; y += 8, row++) for (let x = -(row % 2) * 8; x < S; x += 16) { R(x, y, 16, 8, rnd() > 0.5 ? A : B); cx.strokeStyle = C; cx.lineWidth = 1; cx.strokeRect(x + 0.5, y + 0.5, 15, 7); R(x + 4, y + 2, 3, 2, C); } break;
    case 'weave': for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) { R(x, y, 8, 8, ((x + y) / 8) % 2 ? A : B); R(x, y + 3, 8, 2, ((x + y) / 8) % 2 ? B : A); R(x + 3, y, 2, 8, C); } break;
    case 'camo': for (let k = 0; k < 20; k++) { const w = 8 + ((rnd() * 3) | 0) * 4, h = 8 + ((rnd() * 2) | 0) * 4; R(((rnd() * S) / 4 | 0) * 4, ((rnd() * S) / 4 | 0) * 4, w, h, rnd() > 0.45 ? A : C); } break;
    case 'poly': for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) { const r = rnd(); R(x, y, 8, 8, r < 0.34 ? B : r < 0.67 ? A : C); if (r > 0.8) R(x + 2, y + 2, 4, 4, '#ffffff55'); } break;
    case 'fade': for (let y = 0; y < S; y += 4) { R(0, y, S, 4, mixHex(g.base, g.alt, y / (S - 4))); } R(0, 30, S, 3, C); break;
    case 'skulls': { const sk = ['.###.', '#####', '#.#.#', '.###.', '.#.#.']; for (let gy = 0; gy < S; gy += 16) for (let gx = 0; gx < S; gx += 16) for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (sk[j][i] === '#') R(gx + 3 + i * 2, gy + 3 + j * 2, 2, 2, A); for (let k = 0; k < S; k += 16) R(0, k + 15, S, 1, C); } break;
    case 'comic': for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) R(x + ((y / 8) % 2) * 4, y, 3, 3, A); R(26, 4, 12, 20, C); R(20, 22, 24, 8, C); R(30, 30, 10, 22, C); R(26, 52, 8, 8, C); R(30, 8, 4, 14, B); R(24, 24, 16, 3, B); break;
    case 'hardened': for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) { const v = Math.sin(x * 0.21 + y * 0.13) + Math.sin(x * 0.07 - y * 0.19 + 2) + (rnd() - 0.5) * 0.9; R(x, y, 4, 4, v > 1.05 ? C : v > 0.25 ? A : v < -1.1 ? mixHex(g.base, 0, 0.4) : B); } break;
    case 'net': for (let k = 0; k < S; k += 8) { R(k, 0, 1, S, A); R(0, k, S, 1, A); } for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { R(x - 1, y - 1, 3, 3, C); R(x + 7, y + 7, 3, 3, C); } break;
    case 'dragon': for (let x = 0; x < S; x += 2) { const y1 = 22 + Math.round(Math.sin(x * 0.2) * 9), y2 = 46 + Math.round(Math.sin(x * 0.2 + 2) * 9); R(x, y1, 2, 4, A); R(x, y2, 2, 4, C); R(x, y1 - 10, 2, 2, A); } break;
    case 'stars': for (let k = 0; k < 16; k++) R(((rnd() * S) / 4 | 0) * 4, ((rnd() * S) / 4 | 0) * 4, 4, 4, k % 3 ? A : C); for (let k = 0; k < 14; k++) R((rnd() * S) | 0, (rnd() * S) | 0, 2, 2, '#ffffff'); break;
    case 'rivet': for (let k = 0; k < S; k += 16) R(0, k, S, 1, A); for (let y = 4; y < S; y += 8) for (let x = 4; x < S; x += 8) R(x, y, 3, 3, C); break;
    default: for (let k = 0; k < S; k += 16) { for (let y = 0; y < S; y += 6) R(k + 7, y, 1, 3, A); } break;   // 'plain': stitching
  }
  return cv;
}
const tex3 = new Map();
export function gloveTexture(id) {   // the pattern tile for the 3D hands
  if (tex3.has(id)) return tex3.get(id);
  const t = new THREE.CanvasTexture(gloveTile(id)); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; tex3.set(id, t); return t;
}

// ---- the picture of a pair (inventory card, case reveal): the back of a gloved hand, the pattern painted on it
export function drawGloveIcon(cx, id) {
  const g = gloveById(id); cx.clearRect(0, 0, 128, 128);
  const bg = cx.createLinearGradient(0, 0, 0, 128); bg.addColorStop(0, '#3c3a46'); bg.addColorStop(1, '#1f1e26'); cx.fillStyle = bg; cx.fillRect(0, 0, 128, 128);
  const R = (x, y, w, h, col) => { cx.fillStyle = col; cx.fillRect(x, y, w, h); };
  const OUT = '#0d0e11';
  if (!g) { R(34, 52, 60, 48, '#b0704a'); for (let k = 0; k < 4; k++) R(34 + k * 15, 20 + (k === 3 ? 8 : k === 0 ? 4 : 0), 14, 34, '#b0704a'); return; }
  if (g.glow) { const gr = cx.createRadialGradient(64, 64, 8, 64, 64, 70); gr.addColorStop(0, hx(g.glow) + '66'); gr.addColorStop(1, hx(g.glow) + '00'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128); }
  const pat = cx.createPattern(gloveTile(id), 'repeat'), cuff = hx(g.cuff), fing = [[32, 24, 14, 32], [47, 16, 14, 40], [62, 20, 14, 36], [77, 28, 14, 28]];
  const body = (f) => { f(32, 52, 60, 50); fing.forEach(([x, y, w, h]) => f(x, y, w, h)); f(14, 62, 20, 18); f(10, 52, 14, 14); };
  cx.fillStyle = OUT; body((x, y, w, h) => cx.fillRect(x - 2, y - 2, w + 4, h + 4));   // outline
  cx.fillStyle = pat; body((x, y, w, h) => cx.fillRect(x, y, w, h));                     // the pattern
  cx.fillStyle = OUT; for (const x of [46, 61, 76]) cx.fillRect(x, 24, 2, 32);         // finger gaps
  cx.fillStyle = '#00000033'; for (const [x, y, w, h] of fing) cx.fillRect(x, y + h - 6, w, 6);   // knuckle shading
  const t = g.type;
  if (t === 'wraps') { R(32, 22, 60, 0, '#0000'); for (const [x, y, w] of fing.map(([x, y, w]) => [x, y, w])) R(x, y, w, 8, '#e0ac84'); R(32, 62, 60, 4, cuff); R(32, 74, 60, 4, cuff); R(32, 86, 60, 4, cuff); }   // bare fingertips + straps
  if (t === 'moto' || t === 'specialist') for (const [x, y, w] of fing) { R(x + 1, 50, w - 2, 8, cuff); R(x + 1, 50, w - 2, 2, '#ffffff33'); }   // knuckle guards
  cx.fillStyle = OUT; cx.fillRect(28, 100, 68, t === 'driver' ? 14 : t === 'sport' ? 26 : 20);   // cuff outline
  const ch = t === 'driver' ? 10 : t === 'sport' ? 22 : 16; R(30, 102, 64, ch, cuff);
  if (t === 'sport') R(30, 108, 64, 6, hx(g.alt)); if (t === 'driver') { R(58, 104, 8, 6, hx(g.acc)); }
  if (t === 'specialist') { R(30, 108, 64, 3, hx(g.acc)); } if (t === 'moto') { R(30, 106, 64, 3, '#ffffff22'); }
  if (g.glow) { cx.save(); cx.globalCompositeOperation = 'source-atop'; const sh = cx.createLinearGradient(0, 0, 128, 128); sh.addColorStop(0.4, '#ffffff00'); sh.addColorStop(0.52, '#ffffff55'); sh.addColorStop(0.64, '#ffffff00'); cx.fillStyle = sh; cx.fillRect(0, 0, 128, 128); cx.restore(); }
}
const iconTex = new Map();
export function gloveIconTexture(id) {   // for the floating prize when a case opens
  if (iconTex.has(id)) return iconTex.get(id);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; drawGloveIcon(cv.getContext('2d'), id);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; iconTex.set(id, t); return t;
}
