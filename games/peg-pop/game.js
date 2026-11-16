// Peg Pop: aim, fire, bounce off the pegs, clear every orange peg. Everything is drawn with canvas, sounds are WebAudio.
(function () {
  'use strict';
  var W = 800, H = 640;
  var R = 8, PR = 11, WALL = 6;                 // ball radius, peg radius, side rail thickness
  var G = 980, DT = 1 / 240, SPEED = 640, E_PEG = 0.72, E_WALL = 0.82, MAXV = 1200;
  var LX = W / 2, LY = 30;                       // launcher
  var BTOP = H - 50;                              // top of the bucket
  var START_BALLS = 12;
  var LEVELS = window.PP_LEVELS;

  var $ = function (id) { return document.getElementById(id); };
  var cv = $('c'), g = cv.getContext('2d'), wrap = $('wrap'), menuEl = $('menu'), resEl = $('res');
  var DEBUG = /[?&]debug/.test(location.search);

  // ---------- saved progress ----------
  var SKEY = 'pegpop.save', save = loadSave();
  function loadSave() { try { var o = JSON.parse(localStorage.getItem(SKEY)); if (o && o.done) return o; } catch (e) {} return { done: {} }; }
  function storeSave() { try { localStorage.setItem(SKEY, JSON.stringify(save)); } catch (e) {} }
  function unlocked(i) { return i === 0 || !!save.done[i - 1] || !!(window.HKSET && window.HKSET.unlockAll); }

  // ---------- sound ----------
  var A = null, muted = false;
  try { muted = localStorage.getItem('pegpop.mute') === '1'; } catch (e) {}
  function audio() {
    if (!A) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { A = new C(); } catch (e) { return null; } }
    if (A.state === 'suspended') A.resume();
    return A;
  }
  var toneCount = 0, toneWin = 0;
  function tone(f, d, type, v, slideTo, delay) {
    if (muted) return;
    var a = audio(); if (!a) return;
    var now = performance.now(); if (now - toneWin > 60) { toneWin = now; toneCount = 0; } if (++toneCount > 7) return;   // never a wall of noise
    var t = a.currentTime + (delay || 0), o = a.createOscillator(), gn = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + d);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v || 0.18, t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(a.destination); o.start(t); o.stop(t + d + 0.03);
  }
  var PENT = [0, 2, 4, 7, 9];
  function popSound(n, kind) {   // notes climb a happy scale the more pegs one shot hits
    var i = Math.min(n, 30), semi = PENT[i % 5] + 12 * Math.floor(i / 5), f = 440 * Math.pow(2, semi / 12);
    tone(f, 0.18, 'triangle', 0.2);
    if (kind === 'o') tone(f * 2, 0.14, 'sine', 0.07);
    if (kind === 'p') { tone(f * 1.5, 0.3, 'sine', 0.1); tone(f * 2, 0.3, 'sine', 0.08, 0, 0.05); }
  }
  var sfx = {
    shoot: function () { tone(220, 0.16, 'square', 0.07, 520); },
    bucket: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.16, 0, i * 0.07); }); },
    power: function () { [392, 523, 659, 784].forEach(function (f, i) { tone(f, 0.25, 'sawtooth', 0.07, 0, i * 0.06); }); },
    win: function () { [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.17, 0, i * 0.11); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.35, 'triangle', 0.15, 0, i * 0.17); }); },
    click: function () { tone(660, 0.07, 'square', 0.05); },
    nice: function () { tone(784, 0.12, 'triangle', 0.14); tone(1175, 0.2, 'triangle', 0.14, 0, 0.09); },
    fizz: function () { tone(900, 0.2, 'sawtooth', 0.04, 150); }
  };
  function updateSoundButton() { var b = $('bSound'); b.textContent = 'Sound: ' + (muted ? 'off' : 'on'); b.setAttribute('aria-pressed', muted ? 'true' : 'false'); }
  function toggleMute() { muted = !muted; try { localStorage.setItem('pegpop.mute', muted ? '1' : '0'); } catch (e) {} updateSoundButton(); if (!muted) sfx.click(); }

  // ---------- game state ----------
  var lvl = 0, pegs = [], balls = [], parts = [], texts = [], banner = null, trails = [];
  var state = 'menu';            // menu | aim | shot | result
  var ballsLeft = 0, score = 0, shotHits = 0, orangeLeft = 0, ang = Math.PI / 2, wideShots = 0, cleared = false, winT = 0, resultShown = false;
  var bucket = { x: W / 2, w: 110, dir: 1, flash: 0 };
  var slow = 1, slowT = 0, slowUsed = false, cam = { z: 1, x: W / 2, y: H / 2 }, focus = null;
  var acc = 0, time = 0, stuckFixes = 0, longestShot = 0, shotTime = 0;
  var keys = { left: false, right: false };

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function setupLevel(i) {
    lvl = i; var def = LEVELS[i], rand = rng(i * 977 + 13), idx = def.pegs.map(function (_, k) { return k; });
    for (var k = idx.length - 1; k > 0; k--) { var j = Math.floor(rand() * (k + 1)), t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
    pegs = def.pegs.map(function (p) { return { x: p[0], y: p[1], t: 'b', lit: false, gone: false, dieT: 0 }; });
    var n = 0, greens = i === 0 ? 1 : 2;
    for (k = 0; k < def.orange; k++) pegs[idx[n++]].t = 'o';
    pegs[idx[n++]].t = 'p';
    for (k = 0; k < greens; k++) pegs[idx[n++]].t = 'g';
    orangeLeft = def.orange; balls = []; parts = []; texts = []; trails = [];
    ballsLeft = START_BALLS; score = 0; shotHits = 0; wideShots = 0; bucket.w = 110; bucket.x = W / 2; bucket.flash = 0;
    cleared = false; winT = 0; resultShown = false; slow = 1; slowT = 0; slowUsed = false; cam.z = 1; cam.x = W / 2; cam.y = H / 2; focus = null; acc = 0; ang = Math.PI / 2;
    banner = { s: 'Level ' + (i + 1) + ': ' + def.name, life: 2.2, max: 2.2, col: '#fff' };
  }

  function startLevel(i) {
    setupLevel(i); state = 'aim'; menuEl.classList.add('hide'); resEl.classList.add('hide'); sfx.click();
    try { cv.focus({ preventScroll: true }); } catch (e) {}
  }

  // ---------- firing ----------
  function fire() {
    if (state !== 'aim' || ballsLeft <= 0) return;
    audio(); ballsLeft--; shotHits = 0; shotTime = 0; state = 'shot';
    var c = Math.cos(ang), s = Math.sin(ang);
    balls.push(newBall(LX + c * 30, LY + s * 30, c * SPEED, s * SPEED));
    sfx.shoot();
  }
  function newBall(x, y, vx, vy) { return { x: x, y: y, vx: vx, vy: vy, age: 0, ax: x, ay: y, st: 0, fire: 0, tr: 0 }; }

  // ---------- physics ----------
  function clampSpeed(b) { var v = Math.hypot(b.vx, b.vy); if (v > MAXV) { b.vx *= MAXV / v; b.vy *= MAXV / v; } }
  function bounceOff(b, cx, cy, rad, e) {
    var dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) || 0.0001, nx = dx / d, ny = dy / d, pen = rad + R - d;
    if (pen > 0) { b.x += nx * pen; b.y += ny * pen; }
    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      var j = (Math.random() - 0.5) * 16; b.vx += -ny * j; b.vy += nx * j;   // tiny wobble so a ball can never balance forever
      clampSpeed(b);
    }
  }
  function walls(b) {
    if (b.x < R + WALL) { b.x = R + WALL; b.vx = Math.abs(b.vx) * E_WALL; }
    if (b.x > W - R - WALL) { b.x = W - R - WALL; b.vx = -Math.abs(b.vx) * E_WALL; }
    if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * E_WALL; }
  }

  function physics(dt) {
    // bucket glides side to side
    var half = bucket.w / 2 + WALL + 2;
    bucket.x += bucket.dir * 115 * dt;
    if (bucket.x > W - half) { bucket.x = W - half; bucket.dir = -1; } else if (bucket.x < half) { bucket.x = half; bucket.dir = 1; }
    for (var bi = balls.length - 1; bi >= 0; bi--) {
      var b = balls[bi], dead = false;
      b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
      if (b.fire > 0) b.fire -= dt;
      walls(b);
      for (var i = 0; i < pegs.length; i++) {
        var p = pegs[i]; if (p.gone) continue;
        var dx = b.x - p.x, dy = b.y - p.y, rr = R + PR;
        if (dx * dx + dy * dy < rr * rr) {
          hitPeg(p, b);
          if (b.fire <= 0) bounceOff(b, p.x, p.y, PR, E_PEG);
        }
      }
      // bucket rims bounce the ball, the inside catches it
      if (b.y > BTOP - 14) {
        var bx = bucket.x, hw = bucket.w / 2;
        bounceOff(b, bx - hw, BTOP + 2, 7, 0.6); bounceOff(b, bx + hw, BTOP + 2, 7, 0.6);
        if (b.y > BTOP + 10 && Math.abs(b.x - bx) < hw - 3 && b.vy > 0) { caught(b); dead = true; }
      }
      if (b.y > H + 30) dead = true;
      // stuck check: barely moved for a second -> pop the pegs it is touching and give it a shove
      if (!dead) {
        if (Math.hypot(b.x - b.ax, b.y - b.ay) > 16) { b.ax = b.x; b.ay = b.y; b.st = 0; }
        else if ((b.st += dt) > 0.9) { unstick(b); b.st = 0; }
        if (b.age > 22) { dead = true; stuckFixes++; }   // safety net: no ball lives forever
      }
      if (dead) balls.splice(bi, 1);
      else if (++b.tr % 4 === 0) { trails.push({ x: b.x, y: b.y, l: 0.22, fire: b.fire > 0 }); }
    }
    if (state === 'shot' && balls.length === 0) { if (cleared) retireLit(); else endShot(); }
  }

  function unstick(b) {
    stuckFixes++;
    for (var i = 0; i < pegs.length; i++) {
      var p = pegs[i]; if (p.gone) continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) < R + PR + 5) { if (!p.lit) hitPeg(p, b); p.gone = true; p.dieT = 0; }
    }
    b.vx += (Math.random() - 0.5) * 260; b.vy = Math.min(b.vy, 0) - 140;
  }

  // ---------- scoring ----------
  var BASE = { b: 10, g: 10, o: 100, p: 500 };
  var HIT_COL = { b: '#9cc6ff', o: '#ffb061', p: '#e2bcff', g: '#a8f5c2' };
  function multiplier() { return Math.min(8, 1 + Math.floor(shotHits / 7)); }
  function hitPeg(p, b) {
    if (p.lit) return;
    p.lit = true; shotHits++;
    var mult = multiplier(), pts = BASE[p.t] * mult;
    score += pts;
    texts.push({ x: p.x, y: p.y - 14, s: '+' + pts, life: 0.9, max: 0.9, col: p.t === 'o' ? '#ffd34e' : '#fff', size: p.t === 'b' ? 15 : 20 });
    for (var i = 0; i < 6; i++) { var a = Math.random() * 6.283, v = 60 + Math.random() * 120; parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5, max: 0.5, col: HIT_COL[p.t], size: 3 }); }
    popSound(shotHits, p.t);
    if (shotHits === 10) say('Nice!'); else if (shotHits === 20) say('Great!'); else if (shotHits === 35) say('AMAZING!'); else if (shotHits === 50) say('UNREAL!');
    if (p.t === 'o') { orangeLeft--; if (orangeLeft === 0) levelCleared(p); }
    if (p.t === 'g') power(b);
    if (p.t === 'p') say('Bonus peg! +' + pts);
  }
  function say(s) { sfx.nice(); banner = { s: s, life: 1.1, max: 1.1, col: '#ffd34e' }; }

  function power(b) {
    sfx.power();
    var kinds = ['multi', 'wide', 'fire'], k = kinds[Math.floor(Math.random() * 3)];
    if (k === 'multi') {
      for (var i = 0; i < 2; i++) { var nb = newBall(b.x, b.y, (i ? 1 : -1) * (130 + Math.random() * 120), -170 + Math.random() * 60); balls.push(nb); }
      banner = { s: 'MULTIBALL!', life: 1.6, max: 1.6, col: '#8dffb0' };
    } else if (k === 'wide') {
      wideShots = 3; banner = { s: 'WIDE BUCKET!', life: 1.6, max: 1.6, col: '#8dffb0' };
    } else {
      b.fire = 4; banner = { s: 'FIREBALL!', life: 1.6, max: 1.6, col: '#ff9a4a' };
    }
  }

  function caught(b) {
    ballsLeft++; bucket.flash = 0.5; sfx.bucket();
    texts.push({ x: bucket.x, y: BTOP - 20, s: 'FREE BALL!', life: 1.3, max: 1.3, col: '#8dffb0', size: 24 });
    for (var i = 0; i < 14; i++) parts.push({ x: bucket.x + (Math.random() - 0.5) * bucket.w, y: BTOP, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 200, life: 0.7, max: 0.7, col: '#ffe36a', size: 3.5 });
  }

  function retireLit() {
    var lit = pegs.filter(function (p) { return p.lit && !p.gone; }).sort(function (a, b) { return a.y - b.y; });
    lit.forEach(function (p, i) { p.gone = true; p.dieT = -i * 0.035; });
  }
  function endShot() {
    retireLit();
    if (wideShots > 0) { wideShots--; } bucket.w = wideShots > 0 ? 180 : 110;
    // the purple bonus peg hops to a new blue peg after every shot
    var purple = pegs.filter(function (p) { return !p.gone && p.t === 'p'; })[0], blues = pegs.filter(function (p) { return !p.gone && p.t === 'b'; });
    if (blues.length && (purple || !pegs.some(function (p) { return !p.gone && p.t === 'p'; }))) { if (purple) purple.t = 'b'; blues[Math.floor(Math.random() * blues.length)].t = 'p'; }
    longestShot = Math.max(longestShot, shotTime);
    if (ballsLeft <= 0) { state = 'result'; showResult(false); return; }
    state = 'aim';
  }

  function levelCleared(p) {
    cleared = true; winT = 0; focus = { x: p.x, y: p.y }; sfx.win();
    banner = { s: 'LEVEL CLEAR!', life: 2.2, max: 2.2, col: '#ffd34e' };
    burst();
  }
  function burst() {
    var cx = 100 + Math.random() * 600, cy = 160 + Math.random() * 220, cols = ['#ff5a7a', '#ffd34e', '#4de6ff', '#9bff6a', '#c07bff'], col = cols[Math.floor(Math.random() * cols.length)];
    for (var i = 0; i < 36; i++) { var a = i / 36 * 6.283, v = 120 + Math.random() * 130; parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2, max: 1.2, col: col, size: 3.5, grav: 120 }); }
  }

  function starsFor(left) { return left >= 5 ? 3 : left >= 2 ? 2 : 1; }

  // ---------- result + menu screens ----------
  function showResult(won) {
    resultShown = true; state = 'result';
    var html;
    if (won) {
      var bonus = ballsLeft * 500, total = score + bonus, st = starsFor(ballsLeft), prev = save.done[lvl], best = Math.max(prev ? prev.best : 0, total), isBest = !prev || total > prev.best;
      save.done[lvl] = { stars: Math.max(st, prev ? prev.stars : 0), best: best }; storeSave();
      var starHtml = ''; for (var i = 0; i < 3; i++) starHtml += i < st ? '★' : '<s>★</s>';
      html = '<h2>Level Clear!</h2><div class="stars">' + starHtml + '</div><p>Score ' + score + ' + ' + ballsLeft + ' balls left x 500 = <b>' + total + '</b>' + (isBest ? '<br>New best!' : '<br>Best ' + best) + '</p><div class="btns">' +
        (lvl + 1 < LEVELS.length ? '<button class="big" data-a="next">Next level</button>' : '') + '<button class="big alt" data-a="again">Play again</button><button class="big alt" data-a="menu">Levels</button></div>' +
        (lvl + 1 >= LEVELS.length ? '<p>You cleared the whole game. Great shooting!</p>' : '');
      sfx.click();
    } else {
      sfx.lose();
      html = '<h2>Out of balls</h2><p>' + orangeLeft + ' orange peg' + (orangeLeft === 1 ? '' : 's') + ' left. Score ' + score + '.<br>Tip: catch the ball in the bucket for a free ball.</p><div class="btns"><button class="big" data-a="again">Try again</button><button class="big alt" data-a="menu">Levels</button></div>';
    }
    resEl.innerHTML = html; resEl.classList.remove('hide');
  }
  resEl.addEventListener('click', function (e) {
    var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
    if (a === 'next') startLevel(lvl + 1); else if (a === 'again') startLevel(lvl); else openMenu();
  });

  function openMenu() {
    state = 'menu'; balls = []; resEl.classList.add('hide');
    var h = '<h1>Peg Pop</h1><p>Aim with the mouse or your finger, then click or tap to fire. Clear every <b style="color:#ffb061">orange peg</b> to win. Catch the ball in the bucket for a free ball. Green pegs give power-ups!</p><div class="lv">';
    for (var i = 0; i < LEVELS.length; i++) {
      var d = save.done[i], ok = unlocked(i), st = d ? d.stars : 0, s = '';
      for (var k = 0; k < 3; k++) s += k < st ? '★' : '☆';
      h += '<button data-l="' + i + '"' + (ok ? '' : ' disabled') + '><b>' + (i + 1) + '</b><span>' + (ok ? LEVELS[i].name : 'Locked') + '</span><i>' + (ok ? s : '') + '</i></button>';
    }
    h += '</div><div class="tiny">Arrow keys also aim, Space fires.<span class="rot"> Tip: turn your phone sideways for a bigger board.</span> <button id="bReset" type="button">Reset progress</button></div>';
    menuEl.innerHTML = h; menuEl.classList.remove('hide');
    var r = $('bReset'); if (r) r.onclick = function () { if (confirm('Erase all stars and best scores?')) { save = { done: {} }; storeSave(); openMenu(); } };
  }
  menuEl.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-l]') : null; if (!b || b.disabled) return;
    startLevel(+b.getAttribute('data-l'));
  });
  $('bLevels').addEventListener('click', function () { sfx.click(); openMenu(); });
  $('bSound').addEventListener('click', toggleMute);

  // ---------- input ----------
  function logical(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
  function aimAt(p) {
    var a = Math.atan2(p.y - LY, p.x - LX);
    if (a < 0) a = a < -Math.PI / 2 ? Math.PI : 0;
    ang = Math.max(0.16, Math.min(Math.PI - 0.16, a));
  }
  var touching = false;
  cv.addEventListener('pointermove', function (e) { if (state === 'aim' && (e.pointerType === 'mouse' || touching)) aimAt(logical(e)); });
  cv.addEventListener('pointerdown', function (e) {
    audio();
    if (state !== 'aim') return;
    aimAt(logical(e));
    if (e.pointerType === 'mouse') { if (e.button === 0) fire(); }
    else { touching = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} }
  });
  cv.addEventListener('pointerup', function (e) { if (touching && e.pointerType !== 'mouse') { touching = false; if (state === 'aim') { aimAt(logical(e)); fire(); } } });
  cv.addEventListener('pointercancel', function () { touching = false; });
  addEventListener('keydown', function (e) {
    var c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') { keys.left = true; e.preventDefault(); }
    else if (c === 'ArrowRight' || c === 'KeyD') { keys.right = true; e.preventDefault(); }
    else if (c === 'Space' || c === 'Enter' || c === 'ArrowDown' || c === 'KeyS') { if (state === 'aim') { e.preventDefault(); fire(); } }
    else if (c === 'KeyM') toggleMute();
    else if (c === 'Escape') { if (state !== 'menu') openMenu(); }
    else if (c === 'KeyR') { if (state === 'aim' || state === 'shot' || state === 'result') startLevel(lvl); }
  });
  addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });
  addEventListener('blur', function () { keys.left = keys.right = false; });

  // ---------- sizing ----------
  var scale = 1;
  function fit() {
    var st = document.querySelector('.stage'), aw = st.clientWidth - 12, ah = st.clientHeight - 12;
    scale = Math.max(0.2, Math.min(aw / W, ah / H));
    wrap.style.width = Math.floor(W * scale) + 'px'; wrap.style.height = Math.floor(H * scale) + 'px'; wrap.style.setProperty('--u', scale + 'px');
    var k = Math.max(1, Math.min(2, scale * (window.devicePixelRatio || 1)));
    cv.width = Math.round(W * k); cv.height = Math.round(H * k); cv._k = k;
  }
  addEventListener('resize', fit);

  // ---------- update ----------
  function update(real) {
    time += real;
    if (state === 'aim') {
      if (keys.left) ang = Math.min(Math.PI - 0.16, ang + 1.6 * real);
      if (keys.right) ang = Math.max(0.16, ang - 1.6 * real);
    }
    if (state === 'shot' || (state === 'result' && cleared)) {
      // slow motion: only for the very last orange peg, or just after clearing the level
      var goal = 1, zgoal = 1;
      if (cleared) {
        winT += real;
        goal = winT < 1.0 ? 0.3 : 1; zgoal = winT < 1.0 ? 1.5 : 1;
        if (Math.random() < real * 3 && winT < 2.2) burst();
        if (winT > 2.6 && !resultShown) showResult(true);
      } else if (orangeLeft === 1 && !slowUsed) {
        var last = pegs.filter(function (p) { return !p.gone && p.t === 'o'; })[0], near = false;
        if (last) { balls.forEach(function (b) { if (Math.hypot(b.x - last.x, b.y - last.y) < 105 && b.y < last.y + 45) near = true; }); if (near) { focus = { x: last.x, y: last.y }; goal = 0.22; zgoal = 1.8; slowT += real; if (slowT > 3.2) { slowUsed = true; } } }
      }
      slow += (goal - slow) * Math.min(1, real * 9);
      cam.z += (zgoal - cam.z) * Math.min(1, real * 6);
      shotTime += real;
      if (state === 'shot') {
        acc += Math.min(real, 0.05) * slow; var n = 0;
        while (acc >= DT && n < 60) { physics(DT); acc -= DT; n++; if (state !== 'shot') break; }
        if (n >= 60) acc = 0;
      }
    } else { slow = 1; cam.z += (1 - cam.z) * Math.min(1, real * 6); }
    // camera follows the focus point while zoomed
    var fx = focus ? focus.x : W / 2, fy = focus ? focus.y : H / 2, hz = cam.z;
    var tx = Math.max(W / (2 * hz), Math.min(W - W / (2 * hz), cam.z > 1.02 ? fx : W / 2)), ty = Math.max(H / (2 * hz), Math.min(H - H / (2 * hz), cam.z > 1.02 ? fy : H / 2));
    cam.x += (tx - cam.x) * Math.min(1, real * 8); cam.y += (ty - cam.y) * Math.min(1, real * 8);
    // bucket also drifts around on the menu and between shots
    if (state !== 'shot') { var half = bucket.w / 2 + WALL + 2; bucket.x += bucket.dir * 115 * real; if (bucket.x > W - half) { bucket.x = W - half; bucket.dir = -1; } else if (bucket.x < half) { bucket.x = half; bucket.dir = 1; } }
    if (bucket.flash > 0) bucket.flash -= real;
    // dying pegs + effects (real time)
    pegs.forEach(function (p) { if (p.gone) { var before = p.dieT; p.dieT += real; if (before < 0 && p.dieT >= 0) { popSoundLite(); for (var i = 0; i < 5; i++) { var a = Math.random() * 6.283; parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 30, life: 0.4, max: 0.4, col: HIT_COL[p.t] || '#fff', size: 2.6 }); } } } });
    pegs = pegs.filter(function (p) { return !(p.gone && p.dieT > 0.3); });
    parts.forEach(function (p) { p.x += p.vx * real; p.y += p.vy * real; p.vy += (p.grav || 300) * real; p.life -= real; });
    parts = parts.filter(function (p) { return p.life > 0; });
    texts.forEach(function (t) { t.y -= 30 * real; t.life -= real; }); texts = texts.filter(function (t) { return t.life > 0; });
    trails.forEach(function (t) { t.l -= real; }); trails = trails.filter(function (t) { return t.l > 0; });
    if (banner) { banner.life -= real; if (banner.life <= 0) banner = null; }
  }
  var lastPop = 0;
  function popSoundLite() { var n = performance.now(); if (n - lastPop > 70) { lastPop = n; tone(500 + Math.random() * 500, 0.08, 'sine', 0.05); } }

  // ---------- drawing ----------
  var bgCanvas = null;
  function makeBg() {
    bgCanvas = document.createElement('canvas'); bgCanvas.width = W; bgCanvas.height = H;
    var c = bgCanvas.getContext('2d'), gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#6fd8ff'); gr.addColorStop(0.55, '#4aa7ff'); gr.addColorStop(1, '#6a5be6');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.13)';
    var r = rng(5); for (var i = 0; i < 9; i++) { var x = r() * W, y = 120 + r() * 420, s = 26 + r() * 40; c.beginPath(); c.arc(x, y, s, 0, 6.283); c.arc(x + s * 0.9, y + 6, s * 0.75, 0, 6.283); c.arc(x - s * 0.9, y + 8, s * 0.65, 0, 6.283); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.07)'; for (i = 0; i < 40; i++) { c.beginPath(); c.arc(r() * W, r() * H, 3 + r() * 7, 0, 6.283); c.fill(); }
  }
  var COL = { b: ['#3d8bff', '#17408f', '#a9d0ff'], o: ['#ff8a1e', '#a8420a', '#ffe0b0'], p: ['#b35bff', '#5d1aa8', '#eacbff'], g: ['#3fdc72', '#0f7a37', '#c4fbd7'] };
  function drawPeg(p) {
    var c = COL[p.t], sc = 1, a = 1;
    if (p.gone && p.dieT > 0) { sc = Math.max(0, 1 - p.dieT / 0.3) * 1.15; a = sc; }
    var r = PR * sc;
    if (r <= 0.3) return;
    g.save(); g.globalAlpha = Math.min(1, a);
    if (p.lit) { var hg = g.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 2.6); hg.addColorStop(0, 'rgba(255,255,255,.75)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hg; g.beginPath(); g.arc(p.x, p.y, r * 2.6, 0, 6.283); g.fill(); }
    g.fillStyle = p.lit ? c[2] : c[0]; g.strokeStyle = c[1]; g.lineWidth = 2.5;
    g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.fill(); g.stroke();
    if (p.t === 'o' && !p.lit) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.6; g.beginPath(); g.arc(p.x, p.y, r * 0.5, 0, 6.283); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(p.x - r * 0.35, p.y - r * 0.42, r * 0.34, r * 0.2, -0.6, 0, 6.283); g.fill();
    g.restore();
  }
  function drawBall(b) {
    if (b.fire > 0) { var fg = g.createRadialGradient(b.x, b.y, 2, b.x, b.y, R * 2.6); fg.addColorStop(0, 'rgba(255,220,100,.9)'); fg.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = fg; g.beginPath(); g.arc(b.x, b.y, R * 2.6, 0, 6.283); g.fill(); }
    var gr = g.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, R);
    if (b.fire > 0) { gr.addColorStop(0, '#fff3a8'); gr.addColorStop(1, '#ff6a1a'); } else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#b8c4dc'); }
    g.fillStyle = gr; g.strokeStyle = '#1b2a4a'; g.lineWidth = 2.2; g.beginPath(); g.arc(b.x, b.y, R, 0, 6.283); g.fill(); g.stroke();
  }
  function drawBucket() {
    var x = bucket.x, hw = bucket.w / 2, y = BTOP;
    g.save(); g.lineJoin = 'round';
    g.fillStyle = bucket.flash > 0 ? '#fff29a' : '#ffc93c'; g.strokeStyle = '#7a3f0c'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - hw - 4, y - 2); g.lineTo(x + hw + 4, y - 2); g.lineTo(x + hw - 12, y + 44); g.lineTo(x - hw + 12, y + 44); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; for (var k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * hw * 0.38 - 7, y + 4); g.lineTo(x + k * hw * 0.38 + 7, y + 4); g.lineTo(x + k * hw * 0.3 + 5, y + 40); g.lineTo(x + k * hw * 0.3 - 5, y + 40); g.fill(); }
    g.fillStyle = '#ff5a7a'; g.strokeStyle = '#7a1f3a'; g.beginPath(); g.roundRect ? g.roundRect(x - hw - 7, y - 9, bucket.w + 14, 12, 6) : g.rect(x - hw - 7, y - 9, bucket.w + 14, 12); g.fill(); g.stroke();
    g.restore();
  }
  function drawLauncher() {
    g.save(); g.translate(LX, LY - 12); g.rotate(ang - Math.PI / 2); g.translate(0, 12);
    g.lineJoin = 'round'; g.fillStyle = '#c07bff'; g.strokeStyle = '#3a1478'; g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(-13, 0, 26, 40, 8) : g.rect(-13, 0, 26, 40); g.fill(); g.stroke();
    g.fillStyle = '#e9cdff'; g.fillRect(-9, 8, 5, 24);
    g.restore();
    g.fillStyle = '#ff7fb8'; g.strokeStyle = '#7a1f52'; g.lineWidth = 3; g.beginPath(); g.arc(LX, LY - 12, 30, 0, 6.283); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(LX - 11, LY - 24, 10, 6, -0.6, 0, 6.283); g.fill();
  }
  function aimDots() {
    var b = newBall(LX + Math.cos(ang) * 30, LY + Math.sin(ang) * 30, Math.cos(ang) * SPEED, Math.sin(ang) * SPEED), d = 1 / 180, out = [];
    for (var s = 0; s < 330; s++) {
      b.vy += G * d; b.x += b.vx * d; b.y += b.vy * d; walls(b);
      var hit = false;
      for (var i = 0; i < pegs.length; i++) { var p = pegs[i]; if (p.gone) continue; if (Math.hypot(b.x - p.x, b.y - p.y) < R + PR) { hit = true; break; } }
      if (s % 9 === 4) out.push([b.x, b.y]);
      if (hit || b.y > H) break;
    }
    return out;
  }

  function hudText(s, x, y, size, col, align) {
    g.font = '800 ' + size + 'px "Trebuchet MS", "Segoe UI", system-ui, sans-serif'; g.textAlign = align || 'left'; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = 'rgba(12,24,70,.85)'; g.lineJoin = 'round'; g.strokeText(s, x, y); g.fillStyle = col || '#fff'; g.fillText(s, x, y);
  }

  function draw() {
    var k = cv._k || 1; g.setTransform(k, 0, 0, k, 0, 0);
    if (!bgCanvas) makeBg();
    g.drawImage(bgCanvas, 0, 0);
    g.save();
    g.translate(W / 2, H / 2); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y);
    // side rails
    g.fillStyle = '#2b2f8f'; g.fillRect(0, 0, WALL, H); g.fillRect(W - WALL, 0, WALL, H);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(WALL, 0, 2, H); g.fillRect(W - WALL - 2, 0, 2, H);
    pegs.forEach(drawPeg);
    trails.forEach(function (t) { g.globalAlpha = Math.max(0, t.l / 0.22) * 0.5; g.fillStyle = t.fire ? '#ffb347' : '#fff'; g.beginPath(); g.arc(t.x, t.y, R * 0.6 * (t.l / 0.22 + 0.3), 0, 6.283); g.fill(); }); g.globalAlpha = 1;
    drawBucket();
    if (state === 'aim' || state === 'menu') {
      if (state === 'aim' && ballsLeft > 0) {
        var dots = aimDots();
        dots.forEach(function (d, i) { g.globalAlpha = Math.max(0.2, 1 - i / dots.length); g.fillStyle = '#fff'; g.strokeStyle = 'rgba(20,35,90,.7)'; g.lineWidth = 1.5; g.beginPath(); g.arc(d[0], d[1], 3.6 - i * 0.03, 0, 6.283); g.fill(); g.stroke(); });
        g.globalAlpha = 1;
      }
    }
    drawLauncher();
    if (state === 'aim' && ballsLeft > 0) drawBall({ x: LX + Math.cos(ang) * 22, y: LY - 12 + Math.sin(ang) * 22, fire: 0 });
    balls.forEach(drawBall);
    parts.forEach(function (p) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.283); g.fill(); }); g.globalAlpha = 1;
    texts.forEach(function (t) { g.globalAlpha = Math.min(1, t.life / (t.max * 0.5)); hudText(t.s, t.x, t.y, t.size, t.col, 'center'); }); g.globalAlpha = 1;
    g.restore();
    // slow-mo vignette
    if (slow < 0.8) { var vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,0,50,' + (0.5 * (1 - slow)) + ')'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
    // HUD
    hudText('Score ' + score, 16, 20, 22, '#fff');
    hudText(LEVELS[lvl].name, 16, 46, 14, '#cfe7ff');
    for (var i = 0; i < Math.min(ballsLeft, 12); i++) { g.fillStyle = '#fff'; g.strokeStyle = '#1b2a4a'; g.lineWidth = 2; g.beginPath(); g.arc(24 + i * 18, 72, 6.5, 0, 6.283); g.fill(); g.stroke(); }
    if (ballsLeft > 12) hudText('+' + (ballsLeft - 12), 24 + 12 * 18, 72, 13, '#fff');
    g.fillStyle = COL.o[0]; g.strokeStyle = COL.o[1]; g.lineWidth = 2.5; g.beginPath(); g.arc(W - 120, 20, 10, 0, 6.283); g.fill(); g.stroke();
    hudText('x ' + orangeLeft, W - 102, 20, 22, '#ffd9a8');
    if (shotHits >= 7 && state === 'shot') hudText('x' + multiplier() + ' combo', W - 16, 48, 18, '#ffd34e', 'right');
    if (wideShots > 0) hudText('Wide bucket: ' + wideShots, W - 16, 72, 14, '#8dffb0', 'right');
    if (banner) { var t = banner.life / banner.max, sc = 1 + 0.25 * Math.max(0, t - 0.8) * 5; g.save(); g.globalAlpha = Math.min(1, banner.life * 2.5); g.translate(W / 2, H * 0.4); g.scale(sc, sc); hudText(banner.s, 0, 0, 48, banner.col, 'center'); g.restore(); }
  }

  // ---------- main loop ----------
  var lastTs = 0;
  function frame(ts) {
    var real = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
    update(real); draw(); requestAnimationFrame(frame);
  }

  // ---------- start ----------
  updateSoundButton(); fit(); setupLevel(0); state = 'menu'; banner = null; openMenu();
  requestAnimationFrame(frame);

  // test hooks (only used by me when checking the game: add ?debug to the address)
  if (DEBUG) window.PegPop = {
    get: function () { return { state: state, lvl: lvl, ballsLeft: ballsLeft, score: score, orangeLeft: orangeLeft, balls: balls.length, pegs: pegs.length, stuckFixes: stuckFixes, longestShot: longestShot, cleared: cleared, slow: slow }; },
    start: startLevel, fire: function (a) { if (a != null) ang = a; fire(); }, pegs: function () { return pegs; },
    // run many shots without drawing: returns how long the slowest one took (a ball stuck for ever would show up here)
    sim: function (level, shots) {
      var wasMuted = muted; muted = true; setupLevel(level); state = 'aim'; var worst = 0, fixes0 = stuckFixes;
      for (var s = 0; s < shots; s++) {
        ballsLeft = Math.max(ballsLeft, 2); ang = 0.2 + Math.random() * (Math.PI - 0.4); fire(); var t = 0;
        while (state === 'shot' && t < 60) { physics(DT); t += DT; if (cleared) break; }
        worst = Math.max(worst, t); if (cleared) break; if (state === 'result') { setupLevel(level); state = 'aim'; }
      }
      var res = { level: level, worst: worst, stuckFixes: stuckFixes - fixes0, cleared: cleared, orangeLeft: orangeLeft };
      state = 'menu'; muted = wasMuted; return res;
    },
    leaveOrange: function (n) { var o = pegs.filter(function (p) { return !p.gone && p.t === 'o'; }); while (o.length > n) { var p = o.pop(); p.t = 'b'; orangeLeft--; } },
    tick: function (sec) { var n = Math.round(sec * 60), m = 1; for (var i = 0; i < n; i++) { update(1 / 60); if (slow < m) m = slow; } draw(); return m; },
    sizes: function () { return LEVELS.map(function (l) { return l.pegs.length; }); },
    minGap: function () { return LEVELS.map(function (l) { var m = 1e9; for (var i = 0; i < l.pegs.length; i++) for (var j = i + 1; j < l.pegs.length; j++) m = Math.min(m, Math.hypot(l.pegs[i][0] - l.pegs[j][0], l.pegs[i][1] - l.pegs[j][1])); return Math.round(m); }); }
  };
})();
