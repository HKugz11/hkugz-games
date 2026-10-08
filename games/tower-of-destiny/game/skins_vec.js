// Smooth, high-resolution skins (vector drawn) - the real game's cartoon cubes.
// Design space: 32 x 32 units centred on (0,0); body front face is about x -12..12, y -10..12.
(() => {
'use strict';
function rr(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
}
const fill = (c, col) => { c.fillStyle = col; c.fill(); };
const poly = (c, pts, col) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); if (col) fill(c, col); };
const circ = (c, x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fill(c, col); };
const line = (c, x1, y1, x2, y2, col, w) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.stroke(); };
// body with a soft cube shading: lighter top, darker right and bottom edges
function body(c, col, shade = 'rgba(0,0,0,.2)', hi = 'rgba(255,255,255,.26)', x = -12, y = -10, w = 24, h = 22, r = 2.6) {
  rr(c, x, y, w, h, r); fill(c, col);
  c.save(); rr(c, x, y, w, h, r); c.clip();
  c.fillStyle = hi; c.fillRect(x, y, w, 2.4);
  c.fillStyle = shade; c.fillRect(x + w - 3, y, 3, h); c.fillRect(x, y + h - 2.6, w, 2.6);
  c.restore();
}

const SKINS = [
  // 0 pink visor cube
  c => {
    for (const [x1, y1, x2, y2] of [[-9, -10, -12.5, -15.5], [-7, -10, -9, -16.5], [-11, -9.5, -15, -13]]) line(c, x1, y1, x2, y2, '#ff86c6', 1.5);
    body(c, '#ff6eb4'); rr(c, -3, -5.5, 15.5, 10, 3.8); fill(c, '#12101a');
    poly(c, [0.5, -2.2, 5, -0.2, 1.8, 1.8], '#38d0ff'); poly(c, [11, -2.2, 6.5, -0.2, 9.7, 1.8], '#38d0ff');
    circ(c, -7.5, 5.6, 1, '#b83a82'); circ(c, -8.2, 4.8, 0.45, '#12101a');
  },
  // 1 mummy
  c => {
    poly(c, [-12, -9, -17, -6, -13, -2.5], '#c8c8d2'); poly(c, [-12, -4, -16, 0, -12, 1], '#b0b0bc');
    body(c, '#ececf2');
    c.save(); rr(c, -12, -10, 24, 22, 2.6); c.clip();
    for (let k = -1; k < 5; k++) line(c, -13, -7 + k * 5.5, 13, -11 + k * 5.5, '#a9a9b8', 1.1);
    for (let k = 0; k < 5; k++) line(c, -13, -11 + k * 5.5, 13, -7 + k * 5.5, '#c9c9d4', 0.8);
    c.restore();
    rr(c, -2, -2, 14, 3.4, 1.6); fill(c, '#14141a'); circ(c, 9, -0.3, 0.9, '#fff');
  },
  // 2 striped bandit
  c => {
    body(c, '#ecedf2');
    c.save(); rr(c, -12, -10, 24, 22, 2.6); c.clip();
    for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#f4f4f8' : '#16121c'; c.fillRect(-12 + k * 3, -10, 3, 9); }
    for (const [x, y] of [[-8, 6], [-4, 9], [-9, 10], [-1, 8], [2, 11], [-5, 5.5], [-11, 7.5]]) circ(c, x, y, 0.7, '#8b8b98');
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(9, -10, 3, 22); c.restore();
    for (const [x1, y1, x2, y2] of [[-12, -1, -15.5, -3], [-12, 0.5, -16, 1], [-12, 2, -15, 4.5]]) line(c, x1, y1, x2, y2, '#a84cf0', 1.4);
    rr(c, 1, -4, 12.5, 10, 4.5); fill(c, '#14101c');
    poly(c, [3.6, -0.5, 7, 1.4, 4.2, 2.6], '#b55cff'); poly(c, [11.6, -0.5, 8.2, 1.4, 11, 2.6], '#b55cff');
  },
  // 3 yellow chick
  c => {
    circ(c, -2, -11.5, 1.6, '#ffe62e'); poly(c, [-3, -10, -5, -14.5, -1.5, -11.5], '#ffe62e'); poly(c, [0, -10, 2, -15, 3, -10.5], '#ffe62e');
    body(c, '#ffe62e', 'rgba(150,110,0,.28)', 'rgba(255,255,255,.35)');
    c.beginPath(); c.ellipse(-13.5, 1.5, 3.4, 4.6, -0.4, 0, Math.PI * 2); fill(c, '#ffe62e');
    c.beginPath(); c.ellipse(-14, 5.5, 2.6, 3.4, 0.5, 0, Math.PI * 2); fill(c, '#e3bf00');
    circ(c, 0.5, -2.2, 2.7, '#fff'); circ(c, 7.6, -2.2, 2.7, '#fff'); circ(c, 1.1, -2, 1.2, '#14101c'); circ(c, 8.2, -2, 1.2, '#14101c');
    poly(c, [11, 0.2, 17, 2.6, 11, 5.2], '#ff9a1e'); poly(c, [11, 3.2, 17, 2.6, 11, 5.2], '#d97800');
  },
  // 4 grey cat
  c => {
    poly(c, [-11, -9, -9.5, -17.5, -3.5, -10], '#d8d8e0'); poly(c, [11, -9, 9.5, -17.5, 3.5, -10], '#d8d8e0');
    poly(c, [-9.5, -10, -9, -14.5, -6, -10], '#f0a0b4'); poly(c, [9.5, -10, 9, -14.5, 6, -10], '#f0a0b4');
    body(c, '#dcdce4', 'rgba(60,60,90,.16)', 'rgba(255,255,255,.4)');
    for (const x of [-3, 0, 3]) line(c, x, -9, x + (x < 0 ? -0.5 : x > 0 ? 0.5 : 0), -6, '#9a9aaa', 1);
    circ(c, -4.8, -0.8, 2.5, '#14101c'); circ(c, 5, -0.8, 2.5, '#14101c'); circ(c, -4, -1.8, 0.8, '#fff'); circ(c, 5.8, -1.8, 0.8, '#fff');
    poly(c, [-1.2, 2.4, 1.6, 2.4, 0.2, 4], '#a0603c');
    c.beginPath(); c.moveTo(0.2, 4); c.lineTo(0.2, 5.2); c.moveTo(-3, 5.2); c.quadraticCurveTo(-1.4, 7.2, 0.2, 5.2); c.quadraticCurveTo(1.8, 7.2, 3.4, 5.2); c.strokeStyle = '#4a3a3a'; c.lineWidth = 0.8; c.stroke();
  },
  // 5 cyborg
  c => {
    body(c, '#2eb0d0', 'rgba(0,40,70,.28)', 'rgba(255,255,255,.28)');
    c.save(); rr(c, -12, -10, 24, 22, 2.6); c.clip();
    poly(c, [-12, -10, 12, -10, 12, -4.5, 9, -6, 6, -4, 3, -6.5, 0, -4.5, -3, -6.5, -6, -4.5, -9, -6.5, -12, -4.5], '#c27a1c');
    poly(c, [-12, -10, -8, -10, -12, -2], '#e0a040');
    c.restore();
    rr(c, 0.5, -3.5, 13, 8.5, 3.4); fill(c, '#12101a'); circ(c, 6.8, 0.6, 2.7, '#ff3030'); circ(c, 6, -0.3, 0.9, '#fff');
    rr(c, -8, 5.5, 9, 3.6, 1); fill(c, '#667080'); for (let k = 0; k < 4; k++) line(c, -7 + k * 2.3, 5.8, -7 + k * 2.3, 8.8, '#b8c0cc', 0.7);
    line(c, -9, -1, -6, 3, '#14506a', 0.9);
  },
  // 6 bee
  c => {
    line(c, -7, -10, -9.5, -16, '#ffe224', 1.2); line(c, -3, -10, -3.5, -16.5, '#ffe224', 1.2); circ(c, -9.8, -16.5, 1.2, '#ffe224'); circ(c, -3.5, -17, 1.2, '#ffe224');
    poly(c, [-12, 2.5, -17, 5, -12, 7.5], '#ff9a1e');
    body(c, '#a8206e', 'rgba(0,0,0,.28)', 'rgba(255,255,255,.18)');
    c.save(); rr(c, -12, -10, 24, 22, 2.6); c.clip();
    for (const x of [-9, -3, 3]) { c.beginPath(); c.moveTo(x, -10); c.quadraticCurveTo(x + 3, 1, x, 12); c.lineTo(x + 3, 12); c.quadraticCurveTo(x + 6, 1, x + 3, -10); c.closePath(); fill(c, '#ffe224'); }
    c.restore();
    rr(c, 4, -6.5, 9, 9.5, 3.4); fill(c, '#ffe224');
    poly(c, [5, -3.5, 8.5, -1.6, 5.6, -0.2], '#14101c'); poly(c, [12.2, -3.5, 8.6, -1.6, 11.6, -0.2], '#14101c'); circ(c, 8.6, 4, 0.9, '#d98f10');
  },
  // 7 red devil
  c => {
    poly(c, [-11, -9, -10, -17.5, -4, -10], '#8a1414'); poly(c, [11, -9, 10, -17.5, 4, -10], '#8a1414');
    body(c, '#e03030', 'rgba(60,0,0,.3)', 'rgba(255,255,255,.22)');
    c.save(); rr(c, -12, -10, 24, 22, 2.6); c.clip();
    for (const [x1, y1, x2, y2] of [[-12, 4, -4, 9], [-12, 9, -2, 12], [-6, 1, 6, 8]]) line(c, x1, y1, x2, y2, '#a01818', 1.2); c.restore();
    c.beginPath(); c.moveTo(-3, -4.5); c.quadraticCurveTo(4, -6, 12.5, -3.5); c.lineTo(11.5, 2.5); c.quadraticCurveTo(4, 3.5, -2, 1); c.closePath(); fill(c, '#14101c');
    poly(c, [0, -2.5, 4.4, -0.8, 0.6, 0.7], '#fff'); poly(c, [11, -2.5, 6.6, -0.8, 10.4, 0.7], '#fff');
    circ(c, -2, 7, 0.9, '#601010');
  },
  // 8 masked hero (yellow over purple)
  c => {
    for (const [x1, y1, x2, y2, col] of [[-2, -10, -5, -16, '#c858e8'], [1, -10, 1, -17, '#b030d8'], [4, -10, 7, -15.5, '#c858e8']]) line(c, x1, y1, x2, y2, col, 1.8);
    body(c, '#ffd81f', 'rgba(120,80,0,.25)', 'rgba(255,255,255,.3)');
    c.save(); rr(c, -12, -10, 24, 22, 2.6); c.clip(); c.fillStyle = '#b224c8'; c.fillRect(-12, 2, 24, 10); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(9, 2, 3, 10); c.fillRect(-12, 9.4, 24, 2.6); c.restore();
    c.beginPath(); c.moveTo(-1, -5); c.quadraticCurveTo(6, -7, 13, -4.5); c.lineTo(13, 2); c.quadraticCurveTo(6, 4, -1, 1); c.closePath(); fill(c, '#14101c');
    poly(c, [1, -3, 5, -1.2, 1.6, 0.4], '#fff'); poly(c, [11.6, -3, 7.6, -1.2, 11, 0.4], '#fff');
    c.beginPath(); c.arc(-5, 6.5, 1.6, 0.2, Math.PI - 0.2); c.strokeStyle = '#7a1a8c'; c.lineWidth = 0.9; c.stroke();
  },
  // 9 frankenstein
  c => {
    rr(c, -15, 2.5, 3.4, 2.6, 0.6); fill(c, '#9aa0a8'); rr(c, 11.6, 2.5, 3.4, 2.6, 0.6); fill(c, '#9aa0a8');
    body(c, '#6cc040', 'rgba(20,70,20,.3)', 'rgba(255,255,255,.2)');
    c.save(); rr(c, -12, -10, 24, 22, 2.6); c.clip();
    poly(c, [-12, -10, 12, -10, 12, -4, 10, -2, 8, -4.5, 5, -2.5, 2, -4.5, -1, -2.5, -4, -4.5, -7, -2.5, -10, -4.5, -12, -3], '#5a3a1a'); c.restore();
    c.beginPath(); c.ellipse(1.5, 1, 3.2, 2.6, 0, 0, Math.PI * 2); fill(c, '#f2f2e2'); c.beginPath(); c.ellipse(8.6, 1, 3, 2.6, 0, 0, Math.PI * 2); fill(c, '#f2f2e2');
    circ(c, 2.4, 1.6, 1.1, '#14101c'); circ(c, 9.2, 1.6, 1.1, '#14101c');
    rr(c, -1.8, -1.9, 7.2, 2.4, 1); fill(c, '#4a7a28'); rr(c, 5.4, -1.9, 7, 2.4, 1); fill(c, '#4a7a28');
    c.beginPath(); c.moveTo(-8, 7); for (let k = 0; k < 6; k++) c.lineTo(-8 + (k + 1) * 3, 7 + (k % 2 ? 0 : 2)); c.strokeStyle = '#2e5a18'; c.lineWidth = 0.9; c.stroke();
    for (const [x, y] of [[-8, 9.5], [-3, 10], [-9, 4]]) circ(c, x, y, 0.8, '#4a8a2a');
  },
  // 10 ghost
  c => {
    c.beginPath(); c.moveTo(-8, -10); c.lineTo(10, -10); c.quadraticCurveTo(12, -10, 12, -8); c.lineTo(12, 12);
    for (let k = 0; k < 6; k++) { const x = 12 - (k + 1) * 4; c.lineTo(x + 2, k % 2 ? 12 : 14.5); c.lineTo(x, k % 2 ? 14.5 : 12); }
    c.lineTo(-12, -3); c.lineTo(-9, -5); c.lineTo(-12, -7.5); c.closePath(); fill(c, '#f4f4fa');
    c.save(); c.clip(); c.fillStyle = 'rgba(80,80,140,.18)'; c.fillRect(9, -10, 3, 26); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-12, -10, 24, 2.4); c.restore();
    poly(c, [-2.2, -1.3, 4, 1.6, -0.6, 3.3], '#14101c'); poly(c, [11, -1.3, 5, 1.6, 9.4, 3.3], '#14101c');
    c.beginPath(); c.moveTo(1, 8.5); c.quadraticCurveTo(4.5, 5, 8, 8.5); c.strokeStyle = '#14101c'; c.lineWidth = 1.2; c.stroke();
  },
  // 11 ice cube
  c => {
    body(c, '#4cd6ea', 'rgba(0,50,90,.28)', 'rgba(255,255,255,.2)');
    c.beginPath(); c.moveTo(-12, -10); c.quadraticCurveTo(-12, -14.5, -6, -14.5); c.lineTo(8, -13); c.quadraticCurveTo(13.5, -12, 12.5, -6.5); c.lineTo(11, -7); c.lineTo(-12, -7); c.closePath(); fill(c, '#b8f8ff');
    c.beginPath(); c.moveTo(-12, -7); c.lineTo(11, -7); c.lineTo(12, -10); c.lineTo(-12, -10); c.closePath(); fill(c, '#82ecf8');
    rr(c, -9, -4, 3, 6, 1.4); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
    line(c, 3, 6.6, 10, 6.6, '#103c58', 1.1); line(c, 2, 8.6, 5, 8.6, '#2a8aa8', 0.8);
  },
];

// draws skin i centred at (0,0) of the current transform, `size` logical px across
window.drawSkinVec = (c, i, size) => {
  c.save(); const k = size / 32; c.scale(k, k); c.lineJoin = 'round'; SKINS[i](c); c.restore();
};
})();
