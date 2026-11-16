// Draws a skateboard (seen from above, standing up) onto a 2D canvas. Used for the shop cards and the wall rack.
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function drawBoard(g, b, w, h, fallbackDeck = 0xff7a2f) {
  const deck = b.deck == null ? fallbackDeck : b.deck;
  const stripe = b.stripe == null ? 0xffffff : b.stripe;
  g.clearRect(0, 0, w, h);
  const r = w * 0.5, pad = w * 0.06;
  const path = () => {
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2 - pad, Math.PI, 0);
    g.lineTo(w - pad, h - w / 2);
    g.arc(w / 2, h - w / 2, w / 2 - pad, 0, Math.PI);
    g.closePath();
  };
  path(); g.fillStyle = hex(deck); g.fill();
  g.save(); path(); g.clip();
  g.fillStyle = hex(stripe);
  const art = b.art || (b.deck == null ? 'plain' : 'stripe');
  if (art === 'flames') {
    for (let i = 0; i < 5; i++) {
      const x = pad + (w - pad * 2) * (i + 0.5) / 5;
      g.beginPath(); g.moveTo(x - w * 0.1, h); g.quadraticCurveTo(x - w * 0.02, h * (0.68 - (i % 2) * 0.1), x, h * (0.56 - (i % 3) * 0.05)); g.quadraticCurveTo(x + w * 0.05, h * 0.72, x + w * 0.1, h); g.fill();
    }
    g.fillStyle = '#fff3a0'; g.fillRect(w * 0.42, h * 0.9, w * 0.16, h * 0.1);
  } else if (art === 'waves') {
    g.strokeStyle = hex(stripe); g.lineWidth = w * 0.06;
    for (let k = 0; k < 6; k++) { g.beginPath(); for (let y = 0; y <= h; y += 4) { const x = w / 2 + Math.sin(y / (h * 0.07) + k) * w * 0.18 + (k - 2.5) * w * 0.13; if (y === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
  } else if (art === 'dots') {
    for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(w * (0.25 + ((i * 37) % 50) / 100), h * ((i + 0.5) / 18), w * 0.06 + (i % 3) * w * 0.02, 0, 7); g.fill(); }
  } else if (art === 'bolts') {
    g.beginPath(); g.moveTo(w * 0.62, h * 0.12); g.lineTo(w * 0.3, h * 0.52); g.lineTo(w * 0.5, h * 0.52); g.lineTo(w * 0.36, h * 0.88); g.lineTo(w * 0.74, h * 0.42); g.lineTo(w * 0.52, h * 0.42); g.closePath(); g.fill();
  } else if (art === 'rainbow') {
    const rb = ['#ff4d4d', '#ff9a3d', '#ffe14d', '#5be08a', '#4aa8f0', '#a56cff'];
    rb.forEach((k, i) => { g.fillStyle = k; g.fillRect(0, h * (0.08 + i * 0.15), w, h * 0.15); });
  } else if (art === 'stars') {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(((i * 53) % 100) / 100 * w, ((i * 29) % 100) / 100 * h, 1.2 + (i % 3), 0, 7); g.fill(); }
    g.fillStyle = hex(stripe); g.beginPath(); g.arc(w / 2, h / 2, w * 0.2, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.12, 0, 7); g.fill();
  } else if (art === 'stripe') {
    g.fillRect(w * 0.4, 0, w * 0.2, h);
  }
  g.restore();
  g.lineWidth = w * 0.04; g.strokeStyle = 'rgba(0,0,0,.55)'; path(); g.stroke();
  // trucks + wheels
  g.fillStyle = '#9aa0a8';
  for (const y of [h * 0.2, h * 0.8]) {
    g.fillRect(w * 0.12, y - 3, w * 0.76, 6);
    g.fillStyle = hex(b.wheel == null ? 0xf2f2f2 : b.wheel);
    g.fillRect(w * 0.02, y - h * 0.035, w * 0.1, h * 0.07); g.fillRect(w * 0.88, y - h * 0.035, w * 0.1, h * 0.07);
    g.fillStyle = '#9aa0a8';
  }
}

export function boardCanvas(b, w = 56, h = 150, fallbackDeck) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  drawBoard(c.getContext('2d'), b, w, h, fallbackDeck);
  return c;
}
