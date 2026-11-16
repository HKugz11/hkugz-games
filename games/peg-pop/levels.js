// Peg Pop levels: ten hand-designed peg layouts. Each level only lists WHERE pegs are; game.js picks which ones are
// orange / purple / green with a fixed seed, so a level always looks the same when you retry it.
// Play field is 800 x 640. Pegs live between y = 125 and y = 520 (the launcher is on top, the bucket at the bottom).
(function () {
  'use strict';
  var TAU = Math.PI * 2, SP = 46;   // SP = normal gap between pegs along a shape

  // points along a circle or an arc, about `sp` pixels apart
  function arc(cx, cy, r, a0, a1, sp) {
    var full = Math.abs(a1 - a0 - TAU) < 1e-6, n = Math.max(1, Math.round(Math.abs(a1 - a0) * r / (sp || SP))), out = [];
    for (var k = 0; k < (full ? n : n + 1); k++) { var a = a0 + (a1 - a0) * k / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return out;
  }
  function circle(cx, cy, r, sp) { return arc(cx, cy, r, 0, TAU, sp); }
  function line(x0, y0, x1, y1, sp) {
    var n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / (sp || SP))), out = [];
    for (var k = 0; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
    return out;
  }
  // keep pegs inside the field and never closer than 38px to each other (so the ball can always squeeze through)
  function clean(pts) {
    var out = [];
    pts.forEach(function (p) {
      var x = Math.round(p[0]), y = Math.round(p[1]);
      if (x < 40 || x > 760 || y < 128 || y > 522) return;
      for (var i = 0; i < out.length; i++) if (Math.hypot(out[i][0] - x, out[i][1] - y) < 38) return;
      out.push([x, y]);
    });
    return out;
  }
  function cat() { return [].concat.apply([], arguments); }

  var L = [];

  // 1 Warm Up: a friendly staggered grid
  (function () {
    var p = [];
    for (var r = 0; r < 5; r++) { var n = r % 2 ? 9 : 10, x0 = r % 2 ? 76 : 40; for (var c = 0; c < n; c++) p.push([x0 + c * 72, 172 + r * 68]); }
    L.push({ name: 'Warm Up', orange: 14, pegs: clean(p) });
  })();

  // 2 Rainbow: arcs inside arcs
  (function () {
    var p = [];
    [110, 160, 210, 260, 310].forEach(function (r) { p = p.concat(arc(400, 520, r, Math.PI, TAU, 44)); });
    L.push({ name: 'Rainbow', orange: 18, pegs: clean(p) });
  })();

  // 3 Wavy Waves
  (function () {
    var p = [];
    for (var i = 0; i < 4; i++) for (var x = 50; x <= 750; x += 46) p.push([x, 190 + i * 82 + 28 * Math.sin(x / 55 + i * 1.3)]);
    L.push({ name: 'Wavy Waves', orange: 17, pegs: clean(p) });
  })();

  // 4 Bullseye plus two little targets
  (function () {
    var p = [];
    [45, 90, 135, 180].forEach(function (r) { p = p.concat(circle(400, 325, r, 46)); });
    p = p.concat(circle(120, 330, 50, 46), circle(680, 330, 50, 46), [[120, 330], [680, 330]]);
    L.push({ name: 'Bullseye', orange: 20, pegs: clean(p) });
  })();

  // 5 Diamonds
  (function () {
    var p = [], rows = [3, 4, 5, 6, 7, 6, 5, 4, 3];
    rows.forEach(function (n, r) { for (var k = 0; k < n; k++) p.push([400 + (k - (n - 1) / 2) * 60, 160 + r * 44]); });
    for (var y = 190; y <= 470; y += 70) { p.push([84, y], [716, y]); }
    L.push({ name: 'Diamonds', orange: 17, pegs: clean(p) });
  })();

  // 6 Smiley
  (function () {
    var p = circle(400, 322, 175, 52);
    p = p.concat([[338, 262], [338, 300], [462, 262], [462, 300]], arc(400, 322, 100, Math.PI * 0.22, Math.PI * 0.78, 40), [[400, 330]]);
    L.push({ name: 'Smiley', orange: 13, pegs: clean(p) });
  })();

  // 7 Snail: one long spiral
  (function () {
    var p = [], th = 0;
    while (30 + 7 * th < 192) { var r = 30 + 7 * th; p.push([400 + Math.cos(th) * r, 325 + Math.sin(th) * r]); th += 46 / r; }
    L.push({ name: 'Snail', orange: 18, pegs: clean(p) });
  })();

  // 8 Zig Zag
  (function () {
    var p = [];
    for (var i = 0; i < 4; i++) for (var x = 44; x <= 756; x += 45) {
      var t = ((x + (i % 2 ? 90 : 0)) % 180) / 90; t = t > 1 ? 2 - t : t;   // triangle wave 0..1
      p.push([x, 168 + i * 100 + (t - .5) * 56]);
    }
    L.push({ name: 'Zig Zag', orange: 21, pegs: clean(p) });
  })();

  // 9 Tall Pillars: columns with gaps to drop through
  (function () {
    var p = [], gaps = [260, 400, 300, 430, 240], xs = [100, 250, 400, 550, 700];
    xs.forEach(function (x, i) { for (var y = 150; y <= 500; y += 46) if (Math.abs(y - gaps[i]) > 46) p.push([x, y]); });
    for (var i = 0; i < 4; i++) for (var k = 0; k < 4; k++) p.push([175 + i * 150, 200 + k * 80 + (i % 2) * 40]);
    L.push({ name: 'Tall Pillars', orange: 17, pegs: clean(p) });
  })();

  // 10 Big Heart
  (function () {
    function heart(s, cx, cy) {
      var pts = [];
      for (var t = 0; t < TAU; t += 0.01) pts.push([cx + s * 16 * Math.pow(Math.sin(t), 3), cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]);
      var out = [pts[0]];
      pts.forEach(function (q) { var l = out[out.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= 46) out.push(q); });
      return out;
    }
    var p = cat(heart(12.5, 400, 292), heart(7.5, 400, 288), [[400, 285]]);
    L.push({ name: 'Big Heart', orange: 15, pegs: clean(p) });
  })();

  window.PP_LEVELS = L;
})();
