// HD (non-pixel) vector art for the website version: room, objects, buttons, title, text.
// Everything draws in logical units (264 x 160) on a context that is already scaled x3.
(() => {
'use strict';
const TAU = Math.PI * 2;
const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rad = (c, x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const FONT = '"Fredoka","Baloo 2","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
const HD = {};
HD.FONT = FONT;

// ------------------------------------------------------------------ text (rounded font, laid out in 8-unit cells so the layouts stay tidy)
const TEXT = { gold: ['#ffd95a', '#f0a81c', '#3a1d04'], cyan: ['#7df0ff', '#1fc2e0', '#032a35'], white: ['#ffffff', '#d4d8e6', '#10121c'], red: ['#ff8a80', '#ff4a4a', '#2a0606'] };
HD.text = (g, s, x, y, color = 'gold', align = 'left', k = 1, cell = 8) => {
  s = String(s); const t = TEXT[color] || TEXT.gold, cw = cell * k, size = 10.4 * k;
  if (align === 'center') x -= s.length * cw / 2; else if (align === 'right') x -= s.length * cw;
  g.save(); g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]; if (ch === ' ') continue; const cx = x + i * cw + cw / 2, by = y + 7.6 * k;
    g.lineWidth = 1.5 * k; g.strokeStyle = t[2]; g.strokeText(ch, cx, by);
    g.fillStyle = lin(g, 0, by - 8 * k, 0, by, [[0, t[0]], [1, t[1]]]); g.fillText(ch, cx, by);
  }
  g.restore();
};

// ------------------------------------------------------------------ room (pre-rendered once to an offscreen canvas at display resolution)
// themes describe each area of the tower (colours only, same room shape)
HD.AREAS = [
  { name: 'STONE HALLS', glow: 'rgba(224,112,40,.85)', glow2: 'rgba(224,112,40,.55)', frame: '#c8742e', dark: '#8a4b20', edge: '#e0904a', top: '#17171e', bot: '#101016', ember: 'rgba(210,100,36,.55)', flame: ['#ff4a1a', '#ff9a22', '#ffd34e'], hue: 0 },
  { name: 'FROST CAVERNS', glow: 'rgba(60,170,255,.85)', glow2: 'rgba(60,170,255,.55)', frame: '#3aa8e8', dark: '#1d5f8a', edge: '#9adcff', top: '#14202c', bot: '#0b131b', ember: 'rgba(140,210,255,.6)', flame: ['#3a7aff', '#7ad0ff', '#e8fbff'], hue: 95 },
  { name: 'MOSSY RUINS', glow: 'rgba(70,200,90,.8)', glow2: 'rgba(70,200,90,.5)', frame: '#58b848', dark: '#2c6a28', edge: '#a6e898', top: '#16211a', bot: '#0d150f', ember: 'rgba(130,230,110,.5)', flame: ['#2a9a28', '#8ae04a', '#e6ffa0'], hue: -55 },
  { name: 'VIOLET CRYPT', glow: 'rgba(170,90,255,.85)', glow2: 'rgba(170,90,255,.55)', frame: '#9a5ae0', dark: '#4a2a8a', edge: '#d4aaff', top: '#1c1626', bot: '#110d19', ember: 'rgba(195,140,255,.55)', flame: ['#8a2aff', '#d08aff', '#f6e6ff'], hue: 165 },
  { name: 'EMBER FORGE', glow: 'rgba(255,70,30,.9)', glow2: 'rgba(255,70,30,.6)', frame: '#e84a2a', dark: '#8a2010', edge: '#ff9a6a', top: '#25140f', bot: '#150b08', ember: 'rgba(255,120,50,.65)', flame: ['#e01a0a', '#ff6a1a', '#ffc84e'], hue: -125 },
];
HD.flame = HD.AREAS[0].flame;
HD.makeRoom = (W, H, SC, notches, T = HD.AREAS[0]) => {
  const cv = document.createElement('canvas'); cv.width = W * SC; cv.height = H * SC; const c = cv.getContext('2d'); c.scale(SC, SC);
  c.fillStyle = '#050308'; c.fillRect(0, 0, W, H);
  const IX0 = 8, IX1 = W - 8, IY0 = 32, IY1 = 136;
  const path = () => {
    c.beginPath(); c.moveTo(IX0, IY0);
    for (const [a, b] of notches) { c.lineTo(a, IY0); c.lineTo(a, IY0 - 8); c.lineTo(b, IY0 - 8); c.lineTo(b, IY0); }
    c.lineTo(IX1, IY0); c.lineTo(IX1, IY1); c.lineTo(IX0, IY1); c.closePath();
  };
  // soft orange glow around the frame
  c.save(); c.shadowColor = T.glow; c.shadowBlur = 16; c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = T.dark; path(); c.stroke(); c.restore();
  c.save(); c.shadowColor = T.glow2; c.shadowBlur = 7; c.strokeStyle = T.frame; c.lineWidth = 2.2; c.lineJoin = 'round'; path(); c.stroke(); c.restore();
  // interior: dark stone wall with soft depth
  path(); c.fillStyle = lin(c, 0, IY0, 0, IY1, [[0, T.top], [1, T.bot]]); c.fill();
  c.save(); path(); c.clip();
  // staggered brick lines
  c.strokeStyle = 'rgba(255,255,255,.045)'; c.lineWidth = 0.6;
  for (let y = IY0 - 8, row = 0; y < IY1; y += 16, row++) { c.beginPath(); c.moveTo(IX0, y); c.lineTo(IX1, y); c.stroke(); for (let x = IX0 + (row % 2 ? 16 : 0); x < IX1; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); } }
  // subtle blotches
  for (let i = 0; i < 26; i++) { const x = (i * 97) % (W - 20) + 10, y = IY0 + ((i * 53) % 90), r = 6 + (i % 5) * 3; c.fillStyle = rad(c, x, y, 0, r, [[0, 'rgba(255,255,255,.025)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(x - r, y - r, r * 2, r * 2); }
  // floor strip + inner shadow
  c.fillStyle = lin(c, 0, IY1 - 10, 0, IY1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); c.fillRect(IX0, IY1 - 10, IX1 - IX0, 10);
  c.fillStyle = lin(c, 0, IY0, 0, IY0 + 10, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(IX0, IY0 - 8, IX1 - IX0, 18);
  for (const [x, w] of [[IX0, 9], [IX1 - 9, 9]]) { c.fillStyle = lin(c, x, 0, x + w, 0, x === IX0 ? [[0, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']] : [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); c.fillRect(x, IY0, w, IY1 - IY0); }
  c.restore();
  // crisp inner edge line
  c.save(); c.strokeStyle = T.edge; c.lineWidth = 0.8; c.lineJoin = 'round'; path(); c.stroke(); c.restore();
  // dotted ember specks around the frame
  c.fillStyle = T.ember; for (let i = 0; i < 160; i++) { const a = (i * 2.399) % TAU, rx = (W / 2 + 6) * Math.cos(a), ry = (H / 2 - 20) * Math.sin(a); const x = W / 2 + rx * (1 + ((i * 37) % 11) / 90), y = H / 2 + 4 + ry * (1 + ((i * 29) % 13) / 70); if (y > IY1 + 2 || y < IY0 - 10 || x < IX0 - 2 || x > IX1 + 2) c.fillRect(x, y, 0.9, 0.9); }
  // hanging chains
  const chain = (x, y0, n) => { for (let i = 0; i < n; i++) { const y = y0 + i * 3.2; c.strokeStyle = i % 2 ? '#8e99ad' : '#5a6478'; c.lineWidth = 0.9; if (i % 2) { c.beginPath(); c.ellipse(x, y, 0.9, 2, 0, 0, TAU); c.stroke(); } else { c.beginPath(); c.ellipse(x, y, 1.8, 1.3, 0, 0, TAU); c.stroke(); } } };
  chain(52, IY0 + 1, 6); chain(W - 60, IY0 + 1, 4);
  // cobweb top-right
  c.strokeStyle = 'rgba(210,214,226,.55)'; c.lineWidth = 0.45; const wx = IX1, wy = IY0;
  for (let k = 0; k <= 4; k++) { const a = Math.PI / 2 + (k / 4) * (Math.PI / 2); c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * 26, wy + Math.sin(a) * 22); c.stroke(); }
  for (const r of [7, 13, 19, 25]) { c.beginPath(); for (let k = 0; k <= 8; k++) { const a = Math.PI / 2 + (k / 8) * (Math.PI / 2), rr2 = r * (k % 2 ? 0.9 : 1); const px = wx + Math.cos(a) * rr2, py = wy + Math.sin(a) * rr2 * 0.85; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); }
  return cv;
};

// ------------------------------------------------------------------ small objects. Each draws inside its sprite box with top-left at (x, y).
const D = {};
D.coin = (g, f, x, y) => {
  const sx = [1, 0.72, 0.2, 0.72][f & 3]; g.save(); g.translate(x + 4, y + 4); g.scale(sx, 1);
  g.fillStyle = '#b07a12'; g.beginPath(); g.arc(0, 0.4, 3.6, 0, TAU); g.fill();
  g.fillStyle = lin(g, -3, -3, 3, 3, [[0, '#fff2a8'], [0.5, '#f5c53d'], [1, '#d99a14']]); g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(160,100,10,.7)'; g.lineWidth = 0.5; g.beginPath(); g.arc(0, 0, 2.3, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-1.2, -1.4, 0.9, 0.5, -0.6, 0, TAU); g.fill(); g.restore();
};
D.gem = (g, f, x, y) => {
  g.save(); g.translate(x, y);
  const top = [[4, 0.2], [7.8, 2.8], [4, 3.2], [0.2, 2.8]], l = [[0.2, 2.8], [4, 3.2], [4, 7.8]], r = [[7.8, 2.8], [4, 3.2], [4, 7.8]];
  const poly = (pts, col) => { g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); g.fillStyle = col; g.fill(); };
  poly(l, '#1fb4d4'); poly(r, '#0f7a94'); poly(top, '#a6f4ff');
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(0.2, 2.8); g.lineTo(4, 7.8); g.lineTo(7.8, 2.8); g.lineTo(4, 0.2); g.closePath(); g.stroke();
  if (f & 1) { g.fillStyle = '#fff'; for (const [a, b, s] of [[1.4, 1.2, 0.9], [6.7, 1.8, 0.6]]) { g.beginPath(); g.moveTo(a - s * 1.6, b); g.lineTo(a, b - s); g.lineTo(a + s * 1.6, b); g.lineTo(a, b + s); g.closePath(); g.fill(); } }
  g.restore();
};
const heartPath = (g, w) => { g.beginPath(); g.moveTo(w / 2, w * 0.92); g.bezierCurveTo(-w * 0.15, w * 0.45, w * 0.05, -w * 0.05, w / 2, w * 0.28); g.bezierCurveTo(w * 0.95, -w * 0.05, w * 1.15, w * 0.45, w / 2, w * 0.92); g.closePath(); };
D.heart = (g, f, x, y, t, w = 8) => {
  g.save(); g.translate(x, y + (w === 8 ? 0.4 : 0));
  heartPath(g, w);
  if (f === 0) { g.fillStyle = lin(g, 0, 0, 0, w, [[0, '#ff7a7a'], [1, '#d82a3a']]); g.fill(); g.strokeStyle = '#7a0f1c'; g.lineWidth = 0.55; g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(w * 0.27, w * 0.27, w * 0.1, w * 0.06, -0.6, 0, TAU); g.fill(); }
  else { g.fillStyle = 'rgba(70,16,24,.55)'; g.fill(); g.strokeStyle = '#7a2a34'; g.lineWidth = 0.5; g.stroke(); }
  g.restore();
};
D.bigheart = (g, f, x, y) => D.heart(g, 0, x + 1, y + 1.5, 0, 14);
D.chest = (g, f, x, y) => {
  g.save(); g.translate(x, y);
  if (f) { // open: back lid, glowing treasure
    g.fillStyle = rad(g, 8, 8, 1, 12, [[0, 'rgba(255,220,100,.55)'], [1, 'rgba(255,220,100,0)']]); g.fillRect(-4, -4, 24, 22);
    g.fillStyle = lin(g, 0, 0, 0, 5, [[0, '#9a5a28'], [1, '#6a3414']]); rr(g, 1.5, 0.6, 13, 5.4, 1.6); g.fill(); g.strokeStyle = '#3a1a08'; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = '#f5c53d'; g.beginPath(); g.ellipse(8, 7.2, 6.2, 2.6, 0, Math.PI, 0); g.fill();
    for (const [a, b] of [[4, 6], [7, 4.9], [10, 5.8], [12, 6.8], [6, 7]]) { g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(a, b, 1, 0, TAU); g.fill(); }
  } else { // closed lid
    g.fillStyle = lin(g, 0, 2, 0, 8, [[0, '#a8622c'], [1, '#7a4220']]); g.beginPath(); g.moveTo(1, 8); g.quadraticCurveTo(1, 2, 8, 2); g.quadraticCurveTo(15, 2, 15, 8); g.closePath(); g.fill(); g.strokeStyle = '#3a1a08'; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(5.5, 4.2, 2.4, 0.9, -0.3, 0, TAU); g.fill();
  }
  g.fillStyle = lin(g, 0, 8, 0, 15, [[0, '#8a4b20'], [1, '#5a2d12']]); rr(g, 1, 8, 14, 7, 1.2); g.fill(); g.strokeStyle = '#3a1a08'; g.lineWidth = 0.6; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.4; for (const yy of [10.4, 12.8]) { g.beginPath(); g.moveTo(1.6, yy); g.lineTo(14.4, yy); g.stroke(); }
  g.fillStyle = lin(g, 0, 0, 0, 1, [[0, '#ffe27a'], [1, '#d99a14']]); g.fillRect(3, 2.6, 1.8, 12.4); g.fillRect(11.2, 2.6, 1.8, 12.4); if (f) { g.fillStyle = '#d99a14'; g.fillRect(1, 7.6, 14, 1.2); }
  g.fillStyle = '#f5c53d'; rr(g, 6.2, 7, 3.6, 4.4, 0.8); g.fill(); g.strokeStyle = '#7a4a10'; g.lineWidth = 0.4; g.stroke(); g.fillStyle = '#3a1a08'; g.beginPath(); g.arc(8, 8.8, 0.7, 0, TAU); g.fill(); g.fillRect(7.7, 9, 0.6, 1.6);
  g.restore();
};
D.spike = (g, f, x, y) => {
  g.save(); g.translate(x, y); g.fillStyle = '#3a4252'; rr(g, 0, 6.4, 16, 1.8, 0.6); g.fill();
  for (let i = 0; i < 3; i++) { const a = 0.4 + i * 5.1, b = a + 4.8; g.fillStyle = lin(g, a, 0, b, 0, [[0, '#e4e8f0'], [0.5, '#a9b2c2'], [1, '#6b7486']]); g.beginPath(); g.moveTo(a, 6.6); g.lineTo((a + b) / 2, 0); g.lineTo(b, 6.6); g.closePath(); g.fill(); g.strokeStyle = '#3a4252'; g.lineWidth = 0.4; g.stroke(); }
  g.restore();
};
D.saw = (g, f, x, y, t = 0) => {
  g.save(); g.translate(x + 8, y + 8); g.rotate(t * 0.22);
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 2;
  g.beginPath(); const N = 12; for (let i = 0; i < N * 2; i++) { const a = i / (N * 2) * TAU, r = i % 2 ? 6.1 : 8, a2 = a + (i % 2 ? 0 : 0.05); g.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); } g.closePath();
  g.fillStyle = rad(g, -2, -2, 1, 8, [[0, '#e4e8f0'], [0.6, '#9aa3b4'], [1, '#5a6478']]); g.fill(); g.shadowBlur = 0; g.strokeStyle = '#2a3040'; g.lineWidth = 0.5; g.stroke();
  g.strokeStyle = 'rgba(40,48,64,.55)'; g.lineWidth = 0.6; g.beginPath(); g.arc(0, 0, 4.3, 0, TAU); g.stroke();
  g.fillStyle = '#2a3040'; g.beginPath(); g.arc(0, 0, 1.7, 0, TAU); g.fill(); g.fillStyle = '#b8c0cc'; g.beginPath(); g.arc(-0.4, -0.4, 0.6, 0, TAU); g.fill(); g.restore();
};
D.bat = (g, f, x, y) => {
  g.save(); g.translate(x, y);
  const up = f & 1, wy = up ? 0.3 : 4.6;
  for (const s of [-1, 1]) { g.save(); g.translate(8, 4.4); g.scale(s, 1);
    g.fillStyle = '#2f8f3a'; g.beginPath(); g.moveTo(1.4, 0.4); g.quadraticCurveTo(4.5, wy - 4, 8, wy - 4.2 + 0.5); g.lineTo(6.6, wy - 3 + 1.8); g.quadraticCurveTo(5.4, wy - 1.4, 4.4, wy - 2.2 + 1.6); g.quadraticCurveTo(3.2, wy - 0.6, 1.4, 2.4); g.closePath(); g.fill();
    g.strokeStyle = '#1a5a22'; g.lineWidth = 0.4; g.stroke(); g.restore(); }
  g.fillStyle = lin(g, 0, 1.5, 0, 7.5, [[0, '#6fd45a'], [1, '#2f8f3a']]); g.beginPath(); g.ellipse(8, 4.6, 3.4, 2.9, 0, 0, TAU); g.fill(); g.strokeStyle = '#1a5a22'; g.lineWidth = 0.45; g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(6.6, 4, 0.95, 0, TAU); g.arc(9.4, 4, 0.95, 0, TAU); g.fill(); g.fillStyle = '#e02020'; g.beginPath(); g.arc(6.7, 4.1, 0.5, 0, TAU); g.arc(9.3, 4.1, 0.5, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(7.2, 5.9); g.lineTo(7.6, 6.9); g.lineTo(8, 5.9); g.moveTo(8.2, 5.9); g.lineTo(8.6, 6.9); g.lineTo(9, 5.9); g.fill();
  g.fillStyle = '#2f8f3a'; g.beginPath(); g.moveTo(6, 2.4); g.lineTo(5.6, 0.8); g.lineTo(7.2, 1.9); g.moveTo(10, 2.4); g.lineTo(10.4, 0.8); g.lineTo(8.8, 1.9); g.fill(); g.restore();
};
D.torch = (g, f, x, y, t = 0) => {
  g.save(); g.translate(x, y);
  g.fillStyle = lin(g, 0, 0, 8, 0, [[0, '#4a5260'], [0.5, '#9aa3b4'], [1, '#4a5260']]); rr(g, 3.2, 9, 1.6, 7, 0.5); g.fill(); rr(g, 1.2, 7.2, 5.6, 2.6, 0.9); g.fill();
  const fl = 1 + Math.sin(t * 0.35 + f * 2) * 0.1, sway = Math.sin(t * 0.21 + f) * 0.5;
  g.save(); g.translate(4 + sway * 0.4, 7.4); g.scale(fl, fl + Math.sin(t * 0.5) * 0.08);
  g.fillStyle = lin(g, 0, -8, 0, 0, [[0, HD.flame[0]], [0.5, HD.flame[1]], [1, HD.flame[2]]]); g.beginPath(); g.moveTo(-2.4, 0); g.quadraticCurveTo(-3.2, -3.4, 0 + sway, -7.4); g.quadraticCurveTo(3.2, -3.4, 2.4, 0); g.quadraticCurveTo(0, 1.4, -2.4, 0); g.fill();
  g.fillStyle = lin(g, 0, -5, 0, 0, [[0, '#fffbe0'], [1, HD.flame[2]]]); g.beginPath(); g.moveTo(-1.2, 0); g.quadraticCurveTo(-1.6, -2, sway * 0.5, -4.4); g.quadraticCurveTo(1.6, -2, 1.2, 0); g.fill(); g.restore(); g.restore();
};
D.ladder = (g, f, x, y) => {
  g.save(); g.translate(x, y);
  for (const rx of [2.6, 12.2]) { g.fillStyle = lin(g, rx, 0, rx + 1.6, 0, [[0, '#b8742c'], [1, '#6a3a14']]); g.fillRect(rx, 0, 1.6, 16); g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) g.fillRect(rx, 2 + k * 4, 1.6, 0.5); }
  for (const ry of [3, 11]) { g.fillStyle = lin(g, 0, ry, 0, ry + 2, [[0, '#d8963c'], [1, '#8a4b20']]); rr(g, 2, ry, 12, 2, 0.8); g.fill(); g.strokeStyle = '#4a2410'; g.lineWidth = 0.35; g.stroke(); }
  g.restore();
};
D.crystal = (g, f, x, y, t = 0) => {
  g.save(); g.translate(x, y);
  g.fillStyle = lin(g, 0, 12, 0, 15, [[0, '#6b7486'], [1, '#3a4252']]); rr(g, 3, 11.8, 10, 3.2, 1); g.fill();
  const gl = 0.6 + Math.sin(t * 0.1) * 0.25; g.fillStyle = rad(g, 8, 6, 0, 10, [[0, `rgba(80,230,255,${gl * 0.7})`], [1, 'rgba(80,230,255,0)']]); g.fillRect(-4, -4, 24, 22);
  const P = (pts, col) => { g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); g.fillStyle = col; g.fill(); };
  P([[8, 0.6], [12, 5.4], [8, 11.8], [4, 5.4]], '#38c8e8'); P([[8, 0.6], [12, 5.4], [8, 6.2]], '#a6f4ff'); P([[8, 6.2], [12, 5.4], [8, 11.8]], '#1a8aa8'); P([[4, 5.4], [8, 6.2], [8, 11.8]], '#2aa8c8');
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(8, 0.6); g.lineTo(12, 5.4); g.lineTo(8, 11.8); g.lineTo(4, 5.4); g.closePath(); g.stroke(); g.restore();
};
D.magnet = (g, f, x, y) => {
  g.save(); g.translate(x + 8, y + 8); g.lineCap = 'butt';
  g.lineWidth = 3.6; g.strokeStyle = '#d82a3a'; g.beginPath(); g.arc(0, 0.5, 4.6, Math.PI, Math.PI * 1.5); g.stroke(); g.strokeStyle = '#2f8bd8'; g.beginPath(); g.arc(0, 0.5, 4.6, Math.PI * 1.5, 0); g.stroke();
  g.strokeStyle = '#d82a3a'; g.beginPath(); g.moveTo(-4.6, 0.5); g.lineTo(-4.6, 3.5); g.stroke(); g.strokeStyle = '#2f8bd8'; g.beginPath(); g.moveTo(4.6, 0.5); g.lineTo(4.6, 3.5); g.stroke();
  g.fillStyle = '#e4e8f0'; g.fillRect(-6.4, 3.6, 3.6, 2.4); g.fillRect(2.8, 3.6, 3.6, 2.4);
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 0.7; g.beginPath(); g.arc(0, 0.5, 5.6, Math.PI * 1.05, Math.PI * 1.4); g.stroke(); g.restore();
};
D.shield = (g, f, x, y) => {
  g.save(); g.translate(x + 8, y + 8);
  g.beginPath(); g.moveTo(0, -6.8); g.quadraticCurveTo(3.4, -5.2, 6.2, -5.4); g.quadraticCurveTo(6.4, 2.6, 0, 7); g.quadraticCurveTo(-6.4, 2.6, -6.2, -5.4); g.quadraticCurveTo(-3.4, -5.2, 0, -6.8); g.closePath();
  g.fillStyle = lin(g, -6, -6, 6, 7, [[0, '#7df0ff'], [0.5, '#1fb4d4'], [1, '#0f6a8a']]); g.fill(); g.strokeStyle = '#06344a'; g.lineWidth = 0.6; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(-4.4, -4); g.quadraticCurveTo(-4.8, 0, -3, 2); g.lineTo(-2.4, -3.6); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, -5.4); g.lineTo(0, 5); g.stroke(); g.restore();
};
D.ring = (col, glow) => (g, f, x, y) => {
  g.save(); g.translate(x + 16, y + 16); g.fillStyle = '#0b0b10'; g.beginPath(); g.arc(0, 0, 14.2, 0, TAU); g.fill();
  g.lineWidth = 2.2; g.strokeStyle = col; g.setLineDash([3.2, 1.4]); g.beginPath(); g.arc(0, 0, 14.2, 0, TAU); g.stroke(); g.setLineDash([]);
  g.lineWidth = 0.7; g.strokeStyle = glow; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.stroke(); g.restore();
};
D.ring_gold = D.ring('#e0a020', 'rgba(255,220,100,.5)'); D.ring_cyan = D.ring('#20b8d8', 'rgba(130,240,255,.5)'); D.ring_red = D.ring('#d83a3a', 'rgba(255,150,140,.5)');
D.cursor = (g, f, x, y) => { g.save(); g.translate(x, y); g.fillStyle = '#ffd95a'; g.strokeStyle = '#3a1d04'; g.lineWidth = 0.7; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0.5, 0.5); g.lineTo(7, 4); g.lineTo(3.8, 4.8); g.lineTo(2.6, 7.6); g.closePath(); g.fill(); g.stroke(); g.restore(); };
D.sparkle = (g, f, x, y) => { g.save(); g.translate(x + 4, y + 4); g.fillStyle = '#fff'; const s = [1.2, 3.2, 1.8][f % 3]; g.beginPath(); g.moveTo(-s, 0); g.lineTo(0, -s * 1.6); g.lineTo(s, 0); g.lineTo(0, s * 1.6); g.closePath(); g.fill(); g.restore(); };
D.bubble = (g, f, x, y, t = 0) => { g.save(); g.translate(x + 8, y + 8.5); g.fillStyle = rad(g, -2, -2, 1, 9, [[0, 'rgba(160,240,255,.28)'], [1, 'rgba(60,200,255,.12)']]); g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); g.strokeStyle = 'rgba(130,235,255,.9)'; g.lineWidth = 0.7; g.stroke(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-3.4, -4, 1.8, 1, -0.6, 0, TAU); g.fill(); g.restore(); };
// ---- new enemies
D.slime = (g, f, x, y, t, yo = 0) => {
  const air = yo < -0.5, sx = air ? 0.88 : 1 + Math.sin(t * 0.12) * 0.03, sy = air ? 1.16 : 1 - Math.sin(t * 0.12) * 0.04;
  g.save(); g.translate(x + 8, y + 16); g.scale(sx, sy);
  g.fillStyle = lin(g, 0, -11, 0, 0, [[0, '#9af070'], [1, '#2fae3a']]);
  g.beginPath(); g.moveTo(-7.4, 0); g.bezierCurveTo(-8.4, -9, -3.6, -11.4, 0, -11.4); g.bezierCurveTo(3.6, -11.4, 8.4, -9, 7.4, 0); g.closePath(); g.fill();
  g.strokeStyle = '#17692a'; g.lineWidth = 0.6; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-3.6, -8.2, 2, 1.1, -0.5, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-2.6, -5, 1.9, 2.3, 0, 0, TAU); g.ellipse(2.8, -5, 1.9, 2.3, 0, 0, TAU); g.fill();
  g.fillStyle = '#10201a'; g.beginPath(); g.arc(-2.2, -4.7, 0.95, 0, TAU); g.arc(3.2, -4.7, 0.95, 0, TAU); g.fill();
  g.strokeStyle = '#17692a'; g.lineWidth = 0.6; g.beginPath(); g.arc(0.2, -2.2, 1.6, 0.2, Math.PI - 0.2); g.stroke(); g.restore();
};
D.ghost = (g, f, x, y, t) => {
  g.save(); g.translate(x + 8, y + 8); g.globalAlpha = 0.82 + Math.sin(t * 0.1) * 0.12;
  g.shadowColor = 'rgba(160,200,255,.9)'; g.shadowBlur = 5;
  g.beginPath(); g.moveTo(-6.4, 7); g.lineTo(-6.4, -1); g.bezierCurveTo(-6.4, -9, 6.4, -9, 6.4, -1); g.lineTo(6.4, 7);
  for (let k = 0; k < 4; k++) { const xx = 6.4 - (k + 1) * 3.2; g.quadraticCurveTo(xx + 2.4, 3.8 + Math.sin(t * 0.2 + k) * 1, xx, 7); }
  g.closePath(); g.fillStyle = lin(g, 0, -8, 0, 8, [[0, '#ffffff'], [1, '#b8c4f0']]); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(80,100,190,.6)'; g.lineWidth = 0.5; g.stroke();
  g.fillStyle = '#1a1830'; g.beginPath(); g.ellipse(-2.4, -2, 1.3, 2, 0, 0, TAU); g.ellipse(2.4, -2, 1.3, 2, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, 2.4, 1.2, 1.5, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(-2, -2.7, 0.45, 0, TAU); g.arc(2.8, -2.7, 0.45, 0, TAU); g.fill(); g.restore();
};
D.turret = (g, f, x, y, t, left = true, charge = 0) => {
  g.save(); g.translate(x, y); if (!left) { g.translate(16, 0); g.scale(-1, 1); }
  g.fillStyle = lin(g, 0, 0, 0, 16, [[0, '#7a7e8c'], [1, '#3e4250']]); rr(g, 0, 0, 14, 16, 2); g.fill(); g.strokeStyle = '#22252e'; g.lineWidth = 0.7; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, 5.4); g.lineTo(14, 5.4); g.moveTo(0, 10.8); g.lineTo(14, 10.8); g.stroke();
  g.fillStyle = '#16171d'; rr(g, 8, 4.4, 8, 7.2, 3.4); g.fill();
  g.fillStyle = rad(g, 12.4, 8, 0, 6, [[0, `rgba(255,${160 - charge * 90},40,${0.55 + charge * 0.45})`], [1, 'rgba(255,90,20,0)']]); g.fillRect(6, 2, 14, 12);
  g.fillStyle = charge > 0.6 ? '#ffd34e' : '#ff7a22'; g.beginPath(); g.arc(12.4, 8, 1.7 + charge, 0, TAU); g.fill(); g.restore();
};
D.fireball = (g, f, x, y, t, vx = 1) => {
  g.save(); g.translate(x, y); const s = Math.sign(vx) || 1;
  g.fillStyle = lin(g, -s * 9, 0, 0, 0, [[0, 'rgba(255,60,10,0)'], [1, 'rgba(255,120,20,.85)']]); g.beginPath(); g.moveTo(0, -3.2); g.lineTo(-s * 10, 0); g.lineTo(0, 3.2); g.closePath(); g.fill();
  g.shadowColor = '#ff8a22'; g.shadowBlur = 6; g.fillStyle = rad(g, 0, 0, 0.3, 3.6, [[0, '#fff6c0'], [0.5, '#ffb02a'], [1, '#ff4a10']]); g.beginPath(); g.arc(0, 0, 3.4 + Math.sin(t * 0.5) * 0.3, 0, TAU); g.fill(); g.restore();
};
D.mace = (g, px, py, hx, hy, t) => {
  g.save(); const dx = hx - px, dy = hy - py, n = Math.max(2, Math.floor(Math.hypot(dx, dy) / 3.4));
  for (let i = 1; i < n; i++) { const u = i / n; g.fillStyle = i % 2 ? '#8e99ad' : '#5a6478'; g.beginPath(); g.ellipse(px + dx * u, py + dy * u, 1.1, 1.6, Math.atan2(dy, dx) + Math.PI / 2, 0, TAU); g.fill(); }
  g.fillStyle = '#5a6478'; g.beginPath(); g.arc(px, py, 2.2, 0, TAU); g.fill(); g.fillStyle = '#b8c0cc'; g.beginPath(); g.arc(px - 0.5, py - 0.5, 0.8, 0, TAU); g.fill();
  g.translate(hx, hy); g.rotate(Math.atan2(dy, dx) + t * 0.0);
  g.fillStyle = '#7a8494'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a - 0.2) * 4.6, Math.sin(a - 0.2) * 4.6); g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); g.lineTo(Math.cos(a + 0.2) * 4.6, Math.sin(a + 0.2) * 4.6); g.closePath(); g.fill(); }
  g.fillStyle = rad(g, -1.5, -1.5, 0.5, 6, [[0, '#d8dee8'], [0.6, '#7a8494'], [1, '#3a4252']]); g.beginPath(); g.arc(0, 0, 5.2, 0, TAU); g.fill(); g.strokeStyle = '#22252e'; g.lineWidth = 0.5; g.stroke(); g.restore();
};
// ---- new power-ups (16x16 boxes)
D.p_heart = (g, f, x, y, t) => { g.save(); g.translate(x + 1, y + 1.5); heartPath(g, 14); g.fillStyle = lin(g, 0, 0, 0, 14, [[0, '#ff8a8a'], [1, '#d82a3a']]); g.fill(); g.strokeStyle = '#7a0f1c'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(4, 4, 2, 1.1, -0.6, 0, TAU); g.fill(); g.restore(); };
D.clock = (g, f, x, y, t) => {
  g.save(); g.translate(x + 8, y + 9);
  g.fillStyle = '#e0a020'; g.beginPath(); g.arc(-4.6, -6.4, 2.2, 0, TAU); g.arc(4.6, -6.4, 2.2, 0, TAU); g.fill();
  g.fillStyle = lin(g, -7, -7, 7, 7, [[0, '#9af0ff'], [1, '#1fb4d4']]); g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.strokeStyle = '#0a4a64'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = '#f4fdff'; g.beginPath(); g.arc(0, 0, 5.2, 0, TAU); g.fill();
  g.strokeStyle = '#0a4a64'; g.lineWidth = 0.9; g.lineCap = 'round'; const a = t * 0.05; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -3.8); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 3, Math.sin(a) * 3); g.stroke();
  g.fillStyle = '#0a4a64'; g.beginPath(); g.arc(0, 0, 0.8, 0, TAU); g.fill(); g.restore();
};
D.boots = (g, f, x, y, t) => {
  g.save(); g.translate(x + 8, y + 8);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-5, -3); g.quadraticCurveTo(-10, -8 + Math.sin(t * 0.2) * 1.2, -8, -1); g.quadraticCurveTo(-6.5, -3.5, -4, -1.6); g.closePath(); g.fill(); g.strokeStyle = '#9aa6c8'; g.lineWidth = 0.5; g.stroke();
  g.fillStyle = lin(g, 0, -6, 0, 7, [[0, '#e8503a'], [1, '#a02a1a']]); g.beginPath(); g.moveTo(-3.6, -6.4); g.lineTo(3, -6.4); g.lineTo(3.4, 1.2); g.lineTo(8, 2.4); g.quadraticCurveTo(9.2, 6.2, 5, 6.6); g.lineTo(-4.8, 6.6); g.quadraticCurveTo(-5.4, 3, -3.6, -1); g.closePath(); g.fill(); g.strokeStyle = '#5a1008'; g.lineWidth = 0.6; g.stroke();
  g.fillStyle = '#f4f4f8'; g.fillRect(-4.6, 4.6, 10, 2); g.fillStyle = '#ffd34e'; g.fillRect(-3.6, -6.4, 6.6, 1.8); g.restore();
};
D.star = (g, f, x, y, t) => {
  g.save(); g.translate(x + 8, y + 8.4); g.rotate(Math.sin(t * 0.08) * 0.18);
  g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 3.4 : 8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
  g.fillStyle = lin(g, -6, -8, 6, 8, [[0, '#fff2a0'], [0.5, '#ffcf3d'], [1, '#e0901a']]); g.fill(); g.strokeStyle = '#8a5008'; g.lineWidth = 0.7; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-1.6, -3, 1.2, 0.7, -0.7, 0, TAU); g.fill(); g.restore();
};
// ---- more enemies / hazards
D.spiny = (g, f, x, y, t) => {
  g.save(); g.translate(x + 8, y + 16); const step = Math.sin(t * 0.3) * 1;
  g.fillStyle = '#3a1a1a'; g.beginPath(); g.ellipse(-3.4 + step, -0.6, 2.2, 1.3, 0, 0, TAU); g.ellipse(3.4 - step, -0.6, 2.2, 1.3, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8e4d8'; for (let k = 0; k < 5; k++) { const a = Math.PI + (k + 0.5) / 5 * Math.PI, bx = Math.cos(a) * 6.4, by = -4.4 + Math.sin(a) * 5.6; g.beginPath(); g.moveTo(bx - 1.5 * Math.cos(a + 1.57), by - 1.5 * Math.sin(a + 1.57)); g.lineTo(Math.cos(a) * 9.6, -4.4 + Math.sin(a) * 9); g.lineTo(bx + 1.5 * Math.cos(a + 1.57), by + 1.5 * Math.sin(a + 1.57)); g.closePath(); g.fill(); }
  g.fillStyle = lin(g, 0, -11, 0, 0, [[0, '#ff7a5a'], [1, '#b02a2a']]); g.beginPath(); g.moveTo(-7.4, -1); g.bezierCurveTo(-8.4, -11, 8.4, -11, 7.4, -1); g.closePath(); g.fill(); g.strokeStyle = '#601010'; g.lineWidth = 0.6; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-2.4, -7, 2, 1, -0.5, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(2.2, -4.2, 1.7, 0, TAU); g.arc(5.4, -4.2, 1.5, 0, TAU); g.fill(); g.fillStyle = '#220808'; g.beginPath(); g.arc(2.8, -4, 0.8, 0, TAU); g.arc(5.8, -4, 0.7, 0, TAU); g.fill();
  g.strokeStyle = '#220808'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(1, -6.2); g.lineTo(3.8, -5.4); g.moveTo(7, -6.2); g.lineTo(5, -5.4); g.stroke(); g.restore();
};
D.stal = (g, f, x, y, t, st = 0, tt = 0) => {
  g.save(); g.translate(x, y);
  if (st === 0) { g.fillStyle = lin(g, 0, 0, 0, 5, [[0, '#6b7486'], [1, '#8a93a4']]); g.beginPath(); g.moveTo(5, 0); g.lineTo(11, 0); g.lineTo(8, 5); g.closePath(); g.fill(); }
  else {
    const sh = st === 1 ? Math.sin(tt * 1.6) * 0.9 : 0; g.translate(sh, 0);
    g.fillStyle = lin(g, 3, 0, 13, 0, [[0, '#aab2c2'], [0.5, '#7e889a'], [1, '#4e5668']]); g.beginPath(); g.moveTo(3, -1); g.lineTo(13, -1); g.lineTo(11, 7); g.lineTo(8, 15); g.lineTo(5, 7); g.closePath(); g.fill();
    g.strokeStyle = '#2e3342'; g.lineWidth = 0.5; g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(5, 1, 1.4, 6);
    if (st === 1) { g.fillStyle = 'rgba(190,170,150,.6)'; for (let k = 0; k < 3; k++) g.fillRect(4 + k * 3, 2 + ((tt * 0.3 + k * 4) % 10), 0.9, 0.9); }
  }
  g.restore();
};
D.acid = (g, f, x, y, t, w = 24) => {
  g.save(); g.translate(x, y);
  g.fillStyle = '#07100a'; g.fillRect(-1, 0, w + 2, 6);
  g.shadowColor = 'rgba(120,255,60,.9)'; g.shadowBlur = 5;
  g.beginPath(); g.moveTo(0, 6); g.lineTo(0, 0.6); for (let i = 0; i <= w; i += 2) g.lineTo(i, 0.6 + Math.sin((i + t * 1.6) * 0.5) * 0.9); g.lineTo(w, 6); g.closePath();
  g.fillStyle = lin(g, 0, 0, 0, 6, [[0, '#b6ff5a'], [0.5, '#5fd22a'], [1, '#2a8a14']]); g.fill(); g.shadowBlur = 0;
  g.fillStyle = 'rgba(230,255,170,.85)'; for (let k = 0; k < Math.max(2, Math.floor(w / 12)); k++) { const bx = ((k * 11 + 5) + t * 0.15) % (w - 2) + 1, by = 3.4 - ((t * 0.5 + k * 9) % 6); g.beginPath(); g.arc(bx, by, 0.8 + (k % 2) * 0.3, 0, TAU); g.fill(); }
  g.restore();
};
// green hexagon gem (the pickup in the original); 8x8 box
D.hexgem = (g, f, x, y, t) => {
  g.save(); g.translate(x + 4, y + 4); const pts = k => Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3 + Math.PI / 6) * k, Math.sin(i * Math.PI / 3 + Math.PI / 6) * k]);
  const poly = (p, col) => { g.beginPath(); p.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); g.fillStyle = col; g.fill(); };
  const o = pts(4.1); poly(o, '#1f7a2a'); poly(pts(3.3), lin(g, -3, -3, 3, 3, [[0, '#8af070'], [1, '#2fb040']]));
  g.fillStyle = '#c8ff9a'; g.beginPath(); g.moveTo(-1.8, -2.6); g.lineTo(0.6, -2.9); g.lineTo(-0.8, 0); g.lineTo(-2.4, -0.6); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(10,70,20,.7)'; g.lineWidth = 0.4; g.beginPath(); o.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); g.stroke();
  if ((t >> 5) & 1) { g.fillStyle = '#fff'; g.beginPath(); g.arc(1.8, -2.2, 0.55, 0, TAU); g.fill(); } g.restore();
};
HD.obj = D;

// ------------------------------------------------------------------ title pieces and buttons
HD.titleLogo = (g, cx, y0, t = 0) => {
  const draw = (str, size, y, grad, stroke, sp) => {
    g.save(); g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; if ('letterSpacing' in g) g.letterSpacing = sp + 'px';
    g.lineWidth = stroke; g.strokeStyle = '#3a1604'; g.strokeText(str, cx, y);
    g.fillStyle = lin(g, 0, y - size * 0.78, 0, y, grad); g.fillText(str, cx, y);
    g.lineWidth = 0.5; g.strokeStyle = 'rgba(255,240,170,.7)'; g.strokeText(str, cx, y - 0.25); g.restore();
  };
  g.save(); g.shadowColor = 'rgba(255,140,30,.55)'; g.shadowBlur = 8;
  draw('TOWER', 25, y0 + 24, [[0, '#fff0a0'], [0.35, '#ffcf3d'], [0.75, '#f5922a'], [1, '#d9631a']], 4, 1);
  g.restore();
  draw('DESTINY', 15.5, y0 + 45.5, [[0, '#ffe27a'], [0.45, '#f5b52a'], [1, '#d9631a']], 3.4, 1);
  g.save(); g.font = `700 6px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#f5c53d'; g.strokeStyle = '#3a1604'; g.lineWidth = 1.2; g.strokeText('OF', cx, y0 + 31.5); g.fillText('OF', cx, y0 + 31.5); g.restore();
  g.save(); g.strokeStyle = '#f5a623'; g.lineWidth = 1.2; g.lineCap = 'round'; for (const [a, b] of [[-46, -8], [8, 46]]) { g.beginPath(); g.moveTo(cx + a, y0 + 49.5); g.lineTo(cx + b, y0 + 49.5); g.stroke(); }
  g.fillStyle = '#f5a623'; g.beginPath(); g.moveTo(cx - 3.4, y0 + 48.8); g.lineTo(cx + 3.4, y0 + 48.8); g.lineTo(cx, y0 + 54); g.closePath(); g.fill(); g.restore();
};
HD.playButton = (g, x, y, hover) => {
  g.save(); g.translate(x, y);
  g.shadowColor = hover ? 'rgba(255,180,40,.9)' : 'rgba(255,150,30,.5)'; g.shadowBlur = hover ? 10 : 5;
  rr(g, 0.8, 0.8, 30.4, 30.4, 8); g.fillStyle = lin(g, 0, 0, 0, 32, [[0, '#ffb02a'], [1, '#e0701a']]); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(120,50,0,.55)'; g.lineWidth = 0.6; g.setLineDash([2.6, 2.2]); rr(g, 2, 2, 28, 28, 7); g.stroke(); g.setLineDash([]);
  rr(g, 3.8, 3.8, 24.4, 24.4, 5.4); g.fillStyle = '#0c0b10'; g.fill();
  g.beginPath(); g.moveTo(11, 8); g.lineTo(24.4, 16); g.lineTo(11, 24); g.closePath(); g.fillStyle = lin(g, 11, 8, 24, 24, [[0, '#ffe66a'], [1, '#f5b81a']]); g.fill();
  g.beginPath(); g.moveTo(11, 8); g.lineTo(16.5, 11.3); g.lineTo(11, 24); g.closePath(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); g.restore();
};
HD.soundButton = (g, x, y, on, hover) => {
  g.save(); g.translate(x + 12, y + 12); g.fillStyle = '#0b0a0e'; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill();
  g.lineWidth = 1.8; g.strokeStyle = hover ? '#ffd95a' : '#f0a81c'; g.setLineDash([3, 1.6]); g.beginPath(); g.arc(0, 0, 10.4, 0, TAU); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#ffd95a'; g.beginPath(); g.moveTo(-6, -2.6); g.lineTo(-3, -2.6); g.lineTo(1, -6); g.lineTo(1, 6); g.lineTo(-3, 2.6); g.lineTo(-6, 2.6); g.closePath(); g.fill();
  g.lineCap = 'round'; g.strokeStyle = '#ffd95a'; g.lineWidth = 1.3;
  if (on) { for (const r of [3.2, 6]) { g.beginPath(); g.arc(1, 0, r, -0.9, 0.9); g.stroke(); } } else { g.strokeStyle = '#ff6a5a'; g.beginPath(); g.moveTo(3.4, -3); g.lineTo(8, 3); g.moveTo(8, -3); g.lineTo(3.4, 3); g.stroke(); }
  g.restore();
};
window.HD = HD;
})();
