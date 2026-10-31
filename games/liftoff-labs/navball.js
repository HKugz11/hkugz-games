// The navball: a little round instrument that shows which way the rocket is pointing compared to the horizon, and where it is flying.
import { V, Q } from './vec.js?v=1';

const RES = 140;
export class Navball {
  constructor(canvas) {
    this.cv = canvas; canvas.width = canvas.height = RES * 2;
    this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas'); this.off.width = this.off.height = RES; this.octx = this.off.getContext('2d');
    this.img = this.octx.createImageData(RES, RES);
  }
  // q: ship orientation, frame: {up,east,north}, marks: [{dir, kind}]
  draw(q, frame, marks) {
    const xb = Q.rot(q, [1, 0, 0]), yb = Q.rot(q, [0, 1, 0]), zb = Q.rot(q, [0, 0, 1]);
    const sx = V.neg(xb), sy = zb, sz = yb;                  // screen right, screen up, towards the viewer
    const { up, east, north } = frame;
    const px = this.img.data, R = RES / 2;
    // the three screen axes measured against up / east / north, so each pixel is just three multiplies
    const du = [V.dot(sx, up), V.dot(sy, up), V.dot(sz, up)], de = [V.dot(sx, east), V.dot(sy, east), V.dot(sz, east)], dn = [V.dot(sx, north), V.dot(sy, north), V.dot(sz, north)];
    let i = 0;
    for (let y = 0; y < RES; y++) {
      const v = (R - y - 0.5) / R;
      for (let x = 0; x < RES; x++, i += 4) {
        const u = (x + 0.5 - R) / R, r2 = u * u + v * v;
        if (r2 > 1) { px[i + 3] = 0; continue; }
        const w = Math.sqrt(1 - r2);
        const a = u * du[0] + v * du[1] + w * du[2];             // d . up  = sin(pitch)
        const e = u * de[0] + v * de[1] + w * de[2], n = u * dn[0] + v * dn[1] + w * dn[2];
        const pitch = Math.asin(a < -1 ? -1 : a > 1 ? 1 : a) * 57.29578;
        let hd = Math.atan2(e, n) * 57.29578; if (hd < 0) hd += 360;
        let r, g, b;
        if (pitch >= 0) { const t = Math.min(1, pitch / 90); r = 70 + 20 * (1 - t); g = 150 + 30 * (1 - t); b = 235 - 30 * t; }
        else { const t = Math.min(1, -pitch / 90); r = 150 - 50 * t; g = 100 - 40 * t; b = 60 - 20 * t; }
        const ap = Math.abs(pitch);
        let line = 0;
        if (ap < 0.9) line = 1;
        else if (ap < 88) {
          const m = Math.abs(((ap + 5) % 10) - 5);
          if (m < 0.55 && ap > 1.5) line = ap % 30 < 0.6 || ap % 30 > 29.4 ? 0.95 : 0.55;
          const hm = Math.abs(((hd + 15) % 30) - 15);
          if (hm < 0.7 / Math.max(0.25, Math.cos(pitch * 0.01745)) && ap < 60) line = Math.max(line, 0.5);
        }
        if (line) { r += (255 - r) * line; g += (255 - g) * line; b += (255 - b) * line; }
        const shade = 0.5 + 0.5 * w;
        px[i] = r * shade; px[i + 1] = g * shade; px[i + 2] = b * shade; px[i + 3] = 255;
      }
    }
    this.octx.putImageData(this.img, 0, 0);
    const c = this.ctx, S = RES * 2, cx = S / 2;
    c.clearRect(0, 0, S, S);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.off, 0, 0, S, S);
    c.lineWidth = 6; c.strokeStyle = '#2b2150'; c.beginPath(); c.arc(cx, cx, cx - 3, 0, 7); c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx, cx, cx - 7, 0, 7); c.stroke();
    const proj = (d) => ({ x: cx + V.dot(d, sx) * (cx - 6), y: cx - V.dot(d, sy) * (cx - 6), w: V.dot(d, sz) });
    c.font = '700 20px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const [lab, hdg] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const h = hdg * 0.01745329, d = V.add(V.mul(north, Math.cos(h)), V.mul(east, Math.sin(h))), p = proj(d);
      if (p.w > 0.2) { c.fillStyle = lab === 'N' ? '#ff6b6b' : '#fff'; c.globalAlpha = Math.min(1, p.w * 1.6); c.fillText(lab, p.x, p.y - 12); c.globalAlpha = 1; }
    }
    for (const m of marks) {
      const p = proj(m.dir); if (p.w < -0.05) continue;
      c.globalAlpha = p.w > 0 ? 1 : 0.25; c.lineWidth = 3.2;
      const k = m.kind;
      if (k === 'node') {
        c.strokeStyle = '#ff6bf0'; c.fillStyle = '#ff6bf0'; c.lineWidth = 3.4;
        c.beginPath(); c.arc(p.x, p.y, 11, 0, 7); c.stroke(); c.beginPath(); c.moveTo(p.x - 6, p.y); c.lineTo(p.x + 6, p.y); c.moveTo(p.x, p.y - 6); c.lineTo(p.x, p.y + 6); c.stroke();
      } else if (k === 'pro' || k === 'retro') {
        c.strokeStyle = k === 'pro' ? '#ffe14a' : '#ff9a3a'; c.fillStyle = c.strokeStyle;
        c.beginPath(); c.arc(p.x, p.y, 12, 0, 7); c.stroke();
        if (k === 'pro') { c.beginPath(); c.arc(p.x, p.y, 2.6, 0, 7); c.fill(); for (let a = 0; a < 4; a++) { const aa = a * Math.PI / 2 + 0.78; c.beginPath(); c.moveTo(p.x + Math.cos(aa) * 12, p.y + Math.sin(aa) * 12); c.lineTo(p.x + Math.cos(aa) * 19, p.y + Math.sin(aa) * 19); c.stroke(); } }
        else { c.beginPath(); c.moveTo(p.x - 8, p.y - 8); c.lineTo(p.x + 8, p.y + 8); c.moveTo(p.x + 8, p.y - 8); c.lineTo(p.x - 8, p.y + 8); c.stroke(); }
      } else {
        c.strokeStyle = k === 'normal' || k === 'anti' ? '#c28bff' : '#5df0ff'; c.fillStyle = c.strokeStyle;
        c.beginPath(); const s = 10;
        if (k === 'normal' || k === 'anti') { c.moveTo(p.x, p.y - s); c.lineTo(p.x + s, p.y + s); c.lineTo(p.x - s, p.y + s); c.closePath(); if (k === 'anti') { c.moveTo(p.x - 5, p.y + 3); c.lineTo(p.x + 5, p.y + 3); } }
        else { c.arc(p.x, p.y, s, 0, 7); c.moveTo(p.x - s - 5, p.y); c.lineTo(p.x + s + 5, p.y); c.moveTo(p.x, p.y - s - 5); c.lineTo(p.x, p.y + s + 5); }
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    // the ship marker in the middle
    for (const pass of [0, 1]) {
      c.lineWidth = pass === 0 ? 5.5 : 2.8; c.strokeStyle = pass === 0 ? '#1b1130' : '#ff8a3d';
      c.beginPath(); c.arc(cx, cx, 8, 0, 7); c.moveTo(cx - 34, cx + 4); c.lineTo(cx - 14, cx + 4); c.lineTo(cx - 8, cx - 3); c.moveTo(cx + 34, cx + 4); c.lineTo(cx + 14, cx + 4); c.lineTo(cx + 8, cx - 3);
      c.stroke();
    }
  }
}
