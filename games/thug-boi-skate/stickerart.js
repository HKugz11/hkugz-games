// Draws stickers: a round sticker with a white edge, a coloured ring for the rarity and a hand-drawn picture (no emojis).
import { STICKERS, RARITY } from './data.js?v=1';

const INK = '#0c1230';
const P = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); };
const C = (g, x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, 7); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); };
const E = (g, x, y, rx, ry, fill, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); };
const B = (g, fn, fill) => { g.beginPath(); fn(); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); };
const line = (g, x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };

// every picture is drawn in a -1..1 box (g is already scaled so 1 = the box radius)
const ART = {
  flame(g) {
    B(g, () => { g.moveTo(0, -0.9); g.bezierCurveTo(0.2, -0.5, 0.7, -0.2, 0.65, 0.3); g.bezierCurveTo(0.6, 0.75, 0.2, 0.85, 0, 0.85); g.bezierCurveTo(-0.2, 0.85, -0.65, 0.75, -0.65, 0.3); g.bezierCurveTo(-0.65, -0.05, -0.4, -0.2, -0.3, -0.45); g.bezierCurveTo(-0.2, -0.3, -0.15, -0.2, -0.05, -0.15); g.bezierCurveTo(-0.1, -0.5, -0.05, -0.7, 0, -0.9); }, '#ff6a1f');
    B(g, () => { g.moveTo(0, -0.05); g.bezierCurveTo(0.25, 0.2, 0.4, 0.4, 0.3, 0.6); g.bezierCurveTo(0.2, 0.8, -0.2, 0.8, -0.3, 0.6); g.bezierCurveTo(-0.4, 0.4, -0.15, 0.2, 0, -0.05); }, '#ffd34e');
  },
  bolt(g) { P(g, [[0.15, -0.9], [-0.5, 0.1], [-0.05, 0.1], [-0.2, 0.9], [0.5, -0.15], [0.05, -0.15], [0.4, -0.9]], '#ffe14d'); },
  star(g) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.4 : 0.9; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.05]); }
    P(g, pts, '#ffd34e'); P(g, [[0, -0.4], [0.12, -0.1], [-0.12, -0.1]], '#fff3a8');
  },
  heart(g) {
    B(g, () => { g.moveTo(0, 0.8); g.bezierCurveTo(-1, 0.1, -0.85, -0.7, -0.4, -0.7); g.bezierCurveTo(-0.15, -0.7, 0, -0.5, 0, -0.3); g.bezierCurveTo(0, -0.5, 0.15, -0.7, 0.4, -0.7); g.bezierCurveTo(0.85, -0.7, 1, 0.1, 0, 0.8); }, '#ff3d5a');
    E(g, -0.4, -0.3, 0.12, 0.08, '#ffb0bd', -0.6);
  },
  cool(g) {
    C(g, 0, 0, 0.82, '#ffd34e');
    P(g, [[-0.68, -0.22], [0.68, -0.22], [0.58, 0.14], [0.12, 0.14], [0, -0.02], [-0.12, 0.14], [-0.58, 0.14]], '#15151f');
    g.beginPath(); g.arc(0, 0.12, 0.42, 0.25, Math.PI - 0.25); g.stroke();
    E(g, -0.4, -0.15, 0.1, 0.05, '#7aa8ff', -0.4);
  },
  pizza(g) {
    P(g, [[-0.78, -0.55], [0.78, -0.55], [0, 0.9]], '#ffcc4d');
    P(g, [[-0.85, -0.78], [0.85, -0.78], [0.8, -0.45], [-0.8, -0.45]], '#d9923a');
    C(g, -0.25, -0.15, 0.17, '#d6322e'); C(g, 0.3, -0.2, 0.15, '#d6322e'); C(g, 0.02, 0.35, 0.14, '#d6322e');
  },
  cat(g) {
    P(g, [[-0.7, -0.1], [-0.62, -0.9], [-0.12, -0.5]], '#ff9a3d'); P(g, [[0.7, -0.1], [0.62, -0.9], [0.12, -0.5]], '#ff9a3d');
    E(g, 0, 0.12, 0.75, 0.62, '#ff9a3d');
    C(g, -0.28, 0.02, 0.1, '#15151f'); C(g, 0.28, 0.02, 0.1, '#15151f');
    P(g, [[-0.08, 0.2], [0.08, 0.2], [0, 0.3]], '#ff7fa0');
    g.beginPath(); g.arc(-0.07, 0.3, 0.09, 0, Math.PI * 0.8); g.arc(0.07, 0.3, 0.09, Math.PI * 0.2, Math.PI); g.stroke();
    line(g, -0.45, 0.28, -0.85, 0.2); line(g, -0.45, 0.38, -0.85, 0.42); line(g, 0.45, 0.28, 0.85, 0.2); line(g, 0.45, 0.38, 0.85, 0.42);
  },
  ghost(g) {
    B(g, () => { g.moveTo(-0.6, 0.85); g.lineTo(-0.6, -0.1); g.bezierCurveTo(-0.6, -0.95, 0.6, -0.95, 0.6, -0.1); g.lineTo(0.6, 0.85); g.lineTo(0.4, 0.62); g.lineTo(0.2, 0.85); g.lineTo(0, 0.62); g.lineTo(-0.2, 0.85); g.lineTo(-0.4, 0.62); }, '#f4f6ff');
    E(g, -0.22, -0.2, 0.1, 0.15, '#15151f'); E(g, 0.22, -0.2, 0.1, 0.15, '#15151f'); E(g, 0, 0.18, 0.1, 0.13, '#15151f');
  },
  burger(g) {
    B(g, () => { g.arc(0, -0.05, 0.8, Math.PI, 0); }, '#e0963a');
    for (const [x, y] of [[-0.4, -0.4], [0, -0.55], [0.4, -0.4], [-0.15, -0.25], [0.25, -0.2]]) E(g, x, y, 0.08, 0.04, '#fff3c0', 0.5);
    P(g, [[-0.85, -0.05], [-0.65, 0.12], [-0.45, -0.05], [-0.25, 0.12], [-0.05, -0.05], [0.15, 0.12], [0.35, -0.05], [0.55, 0.12], [0.75, -0.05], [0.85, 0.05], [0.85, 0.15], [-0.85, 0.15]], '#5ad24a');
    P(g, [[-0.85, 0.15], [0.85, 0.15], [0.85, 0.42], [-0.85, 0.42]], '#6b3a1e');
    P(g, [[-0.75, 0.42], [0.75, 0.42], [0.65, 0.78], [-0.65, 0.78]], '#e0963a');
  },
  frog(g) {
    C(g, -0.42, -0.5, 0.3, '#5ad24a'); C(g, 0.42, -0.5, 0.3, '#5ad24a');
    E(g, 0, 0.1, 0.85, 0.62, '#5ad24a');
    C(g, -0.42, -0.5, 0.18, '#ffffff'); C(g, 0.42, -0.5, 0.18, '#ffffff'); C(g, -0.42, -0.48, 0.08, '#15151f'); C(g, 0.42, -0.48, 0.08, '#15151f');
    g.beginPath(); g.arc(0, 0.05, 0.5, 0.2, Math.PI - 0.2); g.stroke();
    C(g, -0.1, -0.08, 0.04, '#15151f'); C(g, 0.1, -0.08, 0.04, '#15151f');
  },
  skull(g) {
    P(g, [[-0.38, 0.3], [0.38, 0.3], [0.38, 0.85], [-0.38, 0.85]], '#f2f2f2');
    C(g, 0, -0.15, 0.68, '#f2f2f2');
    C(g, -0.26, -0.1, 0.2, '#15151f'); C(g, 0.26, -0.1, 0.2, '#15151f');
    P(g, [[-0.08, 0.15], [0.08, 0.15], [0, 0.3]], '#15151f');
    line(g, -0.15, 0.5, -0.15, 0.85); line(g, 0, 0.5, 0, 0.85); line(g, 0.15, 0.5, 0.15, 0.85);
  },
  rocket(g) {
    g.save(); g.rotate(0.7);
    P(g, [[-0.2, 0.62], [0.2, 0.62], [0, 1.0]], '#ffb020');
    P(g, [[-0.3, 0.1], [-0.72, 0.72], [-0.3, 0.6]], '#e8343c'); P(g, [[0.3, 0.1], [0.72, 0.72], [0.3, 0.6]], '#e8343c');
    B(g, () => { g.moveTo(0, -0.95); g.bezierCurveTo(0.55, -0.45, 0.45, 0.3, 0.3, 0.62); g.lineTo(-0.3, 0.62); g.bezierCurveTo(-0.45, 0.3, -0.55, -0.45, 0, -0.95); }, '#f2f4ff');
    P(g, [[-0.27, -0.45], [0.27, -0.45], [0.13, -0.78], [-0.13, -0.78]], '#e8343c');
    C(g, 0, -0.1, 0.17, '#4aa8f0');
    g.restore();
  },
  rainbow(g) {
    g.lineCap = 'butt';
    ['#e8343c', '#ff9a3d', '#ffe14d', '#5be08a', '#4aa8f0', '#a56cff'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 0.15; g.beginPath(); g.arc(0, 0.45, 0.78 - i * 0.13, Math.PI, 0); g.stroke(); });
    g.strokeStyle = INK; g.lineWidth = 0.07;
    for (const x of [-0.7, 0.7]) { C(g, x - 0.1, 0.5, 0.18, '#ffffff'); C(g, x + 0.1, 0.52, 0.16, '#ffffff'); }
  },
  alien(g) {
    B(g, () => { g.moveTo(0, -0.9); g.bezierCurveTo(0.85, -0.9, 0.85, 0.2, 0.2, 0.82); g.bezierCurveTo(0.08, 0.92, -0.08, 0.92, -0.2, 0.82); g.bezierCurveTo(-0.85, 0.2, -0.85, -0.9, 0, -0.9); }, '#6be06b');
    E(g, -0.35, -0.1, 0.28, 0.14, '#15151f', 0.55); E(g, 0.35, -0.1, 0.28, 0.14, '#15151f', -0.55);
    E(g, -0.42, -0.15, 0.06, 0.03, '#ffffff', 0.55); E(g, 0.28, -0.15, 0.06, 0.03, '#ffffff', -0.55);
    line(g, -0.1, 0.5, 0.1, 0.5);
  },
  guitar(g) {
    g.save(); g.rotate(0.65); g.scale(0.95, 0.95); g.translate(0, 0.05);
    P(g, [[-0.07, -0.2], [0.07, -0.2], [0.07, -0.72], [-0.07, -0.72]], '#6b3a1e');
    P(g, [[-0.13, -0.72], [0.13, -0.72], [0.13, -0.95], [-0.13, -0.95]], '#222a44');
    C(g, 0, 0.55, 0.42, '#c0602c'); C(g, 0, 0.08, 0.3, '#c0602c'); C(g, 0, 0.55, 0.38, '#c0602c');
    C(g, 0, 0.33, 0.12, '#15151f'); P(g, [[-0.16, 0.62], [0.16, 0.62], [0.16, 0.7], [-0.16, 0.7]], '#2a1a10');
    g.restore();
  },
  gem(g) {
    P(g, [[-0.42, -0.7], [0.42, -0.7], [0.82, -0.2], [0, 0.88], [-0.82, -0.2]], '#4de1ff');
    P(g, [[-0.42, -0.7], [-0.2, -0.2], [0.2, -0.2], [0.42, -0.7]], '#a9f1ff');
    g.lineWidth = 0.04; line(g, -0.82, -0.2, 0.82, -0.2); line(g, -0.2, -0.2, 0, 0.88); line(g, 0.2, -0.2, 0, 0.88);
  },
  dragon(g) {
    P(g, [[-0.5, -0.35], [-0.78, -0.95], [-0.2, -0.6]], '#ffd34e'); P(g, [[0.5, -0.35], [0.78, -0.95], [0.2, -0.6]], '#ffd34e');
    P(g, [[-0.9, 0.05], [-0.65, -0.1], [-0.7, 0.2]], '#3fa83f'); P(g, [[0.9, 0.05], [0.65, -0.1], [0.7, 0.2]], '#3fa83f');
    E(g, 0, -0.05, 0.7, 0.6, '#4cc64c');
    P(g, [[-0.1, -0.62], [0, -0.85], [0.1, -0.62]], '#3fa83f');
    E(g, -0.32, -0.12, 0.17, 0.11, '#ffe14d', 0.45); E(g, 0.32, -0.12, 0.17, 0.11, '#ffe14d', -0.45);
    E(g, -0.32, -0.12, 0.04, 0.09, '#15151f', 0.45); E(g, 0.32, -0.12, 0.04, 0.09, '#15151f', -0.45);
    line(g, -0.55, -0.35, -0.12, -0.22); line(g, 0.55, -0.35, 0.12, -0.22);
    C(g, -0.1, 0.12, 0.04, '#15151f'); C(g, 0.1, 0.12, 0.04, '#15151f');
    B(g, () => { g.moveTo(-0.4, 0.3); g.quadraticCurveTo(0, 0.6, 0.4, 0.3); g.quadraticCurveTo(0, 0.5, -0.4, 0.3); }, '#7a1f1f');
    P(g, [[-0.3, 0.36], [-0.22, 0.56], [-0.14, 0.42]], '#ffffff'); P(g, [[0.3, 0.36], [0.22, 0.56], [0.14, 0.42]], '#ffffff');
  },
  unicorn(g) {
    E(g, -0.5, 0.0, 0.3, 0.7, '#ff6fd0', 0.2);
    P(g, [[0.02, -0.98], [-0.16, -0.4], [0.2, -0.4]], '#ffd34e');
    P(g, [[-0.42, -0.35], [-0.38, -0.7], [-0.1, -0.45]], '#ffffff');
    E(g, 0.05, 0.12, 0.55, 0.62, '#ffffff');
    E(g, 0.1, 0.45, 0.4, 0.28, '#ffe6f6');
    C(g, 0.12, -0.02, 0.08, '#15151f'); C(g, 0.0, 0.5, 0.04, '#ff6fa0'); C(g, 0.28, 0.5, 0.04, '#ff6fa0');
    E(g, -0.18, 0.2, 0.1, 0.07, '#ffb0d6');
  },
  crown(g) {
    P(g, [[-0.8, 0.45], [-0.85, -0.45], [-0.4, 0.0], [0, -0.7], [0.4, 0.0], [0.85, -0.45], [0.8, 0.45]], '#ffd34e');
    P(g, [[-0.8, 0.45], [0.8, 0.45], [0.8, 0.78], [-0.8, 0.78]], '#ffb020');
    C(g, -0.85, -0.5, 0.1, '#ff3d5a'); C(g, 0, -0.75, 0.1, '#4de1ff'); C(g, 0.85, -0.5, 0.1, '#ff3d5a');
    C(g, -0.4, 0.62, 0.09, '#ff3d5a'); C(g, 0, 0.62, 0.09, '#4de1ff'); C(g, 0.4, 0.62, 0.09, '#5be08a');
  },
  trophy(g) {
    g.strokeStyle = INK; g.lineWidth = 0.2; g.beginPath(); g.arc(-0.5, -0.35, 0.26, Math.PI * 0.5, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(0.5, -0.35, 0.26, Math.PI * 1.5, Math.PI * 0.5); g.stroke();
    g.strokeStyle = '#ffd34e'; g.lineWidth = 0.09; g.beginPath(); g.arc(-0.5, -0.35, 0.26, Math.PI * 0.5, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(0.5, -0.35, 0.26, Math.PI * 1.5, Math.PI * 0.5); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 0.07;
    B(g, () => { g.moveTo(-0.55, -0.75); g.lineTo(0.55, -0.75); g.bezierCurveTo(0.55, 0.0, 0.32, 0.3, 0, 0.35); g.bezierCurveTo(-0.32, 0.3, -0.55, 0.0, -0.55, -0.75); }, '#ffd34e');
    P(g, [[-0.1, 0.35], [0.1, 0.35], [0.13, 0.62], [-0.13, 0.62]], '#e0a020');
    P(g, [[-0.42, 0.62], [0.42, 0.62], [0.42, 0.88], [-0.42, 0.88]], '#b97a20');
    P(g, [[0, -0.55], [0.08, -0.35], [0.28, -0.35], [0.12, -0.22], [0.18, -0.02], [0, -0.14], [-0.18, -0.02], [-0.12, -0.22], [-0.28, -0.35], [-0.08, -0.35]], '#fff3a8');
  },
};

// ---- REAL die-cut stickers: the sticker is the picture itself with a thick white border that follows its outline
//      (flame-shaped, heart-shaped, skull-shaped...) plus a thin outer line in the rarity colour. Built once per sticker, then reused.
const CUT = new Map();
const CUT_N = 256;
function dilate(A, rad, color) {         // a solid-colour copy of A's outline, grown by `rad` pixels
  const S = document.createElement('canvas'); S.width = S.height = CUT_N;
  const sg = S.getContext('2d');
  for (const r of [rad * 0.5, rad]) for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; sg.drawImage(A, Math.cos(a) * r, Math.sin(a) * r); }
  sg.globalCompositeOperation = 'source-in'; sg.fillStyle = color; sg.fillRect(0, 0, CUT_N, CUT_N);
  return S;
}
function dieCut(id) {
  if (CUT.has(id)) return CUT.get(id);
  const st = STICKERS.find((x) => x.id === id), art = ART[id];
  if (!st || !art) return null;
  const A = document.createElement('canvas'); A.width = A.height = CUT_N;
  const ag = A.getContext('2d');
  const k = CUT_N / 2 * 0.74;
  ag.translate(CUT_N / 2, CUT_N / 2); ag.scale(k, k);
  ag.lineWidth = 0.07; ag.lineJoin = 'round'; ag.lineCap = 'round'; ag.strokeStyle = INK;
  art(ag);
  const c = document.createElement('canvas'); c.width = c.height = CUT_N;
  const g = c.getContext('2d');
  g.drawImage(dilate(A, CUT_N / 2 * 0.135, RARITY[st.r].color), 0, 0);   // thin rarity-coloured edge
  g.drawImage(dilate(A, CUT_N / 2 * 0.085, '#ffffff'), 0, 0);              // thick white sticker border
  g.drawImage(A, 0, 0);
  CUT.set(id, c);
  return c;
}

export function drawSticker(g, id, cx, cy, size, rot = 0) {
  const c = dieCut(id);
  if (!c) return;
  g.save(); g.translate(cx, cy); g.rotate(rot);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(c, -size / 2, -size / 2, size, size);
  g.restore();
}

export function stickerCanvas(id, size = 56) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  drawSticker(c.getContext('2d'), id, size / 2, size / 2, size - 2);
  return c;
}

// ---- the sticker layer on the deck. Stickers are placed by you: {id, side:'top'|'bot', x, z, rot, s}
//      x/z = metres from the middle of the deck (z+ = nose), s = sticker size in metres, rot = turn.
//      The layer is a flat plane on top (and one underneath); plane u = x, plane v = -z on top / +z underneath.
export const DECK_PX = 600;   // canvas pixels per metre
export function drawDeckStickers(c, list, side) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  for (const p of list || []) {
    if (!p || p.side !== side) continue;
    const v = side === 'top' ? -p.z : p.z;
    drawSticker(g, p.id, c.width / 2 + p.x * DECK_PX, c.height / 2 - v * DECK_PX, p.s * DECK_PX, p.rot || 0);
  }
}
export function deckStickerCanvas(list, side, wid, len) {
  const c = document.createElement('canvas'); c.width = Math.round(wid * DECK_PX); c.height = Math.round(len * DECK_PX);
  drawDeckStickers(c, list, side);
  return c;
}
