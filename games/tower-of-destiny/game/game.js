// Tower of Destiny - HTML5 version (port of the GBA game, with smooth motion, glow, particles, mouse/touch and WebAudio)
(() => {
'use strict';
const A = window.ASSETS, W = A.W, H = 160, SC = 3;               // logical size, display scale
const XMIN = 2, XMAX = W - 19, FLOORY = 115, GROUND = FLOORY - 15, IX0 = 5, IX1 = W - 6, IY0 = 47, LADDER_TOP = 16, LADDER_LEN = 80, SAVE_EVERY = 25, MAX_LIVES = 6;
const NSKIN = A.skins.length;

// ------------------------------------------------------------------ canvases
const screen = document.getElementById('screen');
screen.width = W * SC; screen.height = H * SC;
const sctx = screen.getContext('2d');
const g = sctx;               // everything is drawn straight onto the full-resolution canvas (logical units x3)
const rrect = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// ------------------------------------------------------------------ pixel art (environment, text) - characters are smooth vectors
function fromHex(px, w, h, pal) {
  const c = mk(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
  const cols = pal.map(p => { const n = parseInt(p.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
  for (let i = 0; i < w * h; i++) { const k = parseInt(px[i], 16); if (k) { const o = i * 4, q = cols[k]; id.data[o] = q[0]; id.data[o + 1] = q[1]; id.data[o + 2] = q[2]; id.data[o + 3] = 255; } }
  x.putImageData(id, 0, 0); return c;
}
const IMG = { obj: {} };
for (const [n, o] of Object.entries(A.obj)) IMG.obj[n] = o.frames.map(f => fromHex(f, o.w, o.h, o.bank === 13 ? A.batPal : A.objPal));
IMG.room = fromHex(A.room.px, A.room.w, A.room.h, A.room.pal);
IMG.menuRoom = fromHex(A.menuRoom.px, A.menuRoom.w, A.menuRoom.h, A.menuRoom.pal);
IMG.tower = fromHex(A.titleTower.px, A.titleTower.w, A.titleTower.h, A.titleTower.pal);
IMG.destiny = fromHex(A.titleDestiny.px, A.titleDestiny.w, A.titleDestiny.h, A.titleDestiny.pal);
IMG.play = fromHex(A.play.px, A.play.w, A.play.h, A.play.pal);
IMG.sndOn = fromHex(A.sndOn.px, A.sndOn.w, A.sndOn.h, A.sndOn.pal);
IMG.sndOff = fromHex(A.sndOff.px, A.sndOff.w, A.sndOff.h, A.sndOff.pal);
const glyph5 = ch => (A.font[ch] || A.font[' ']).split(' ').map(r => [...r].map(c => c === '1'));
function fontCanvas(ch, pal) {
  const gl = glyph5(ch), v = new Array(6 * 8).fill(0);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (gl[y][x]) v[y * 6 + x] = 1;
  for (let y = 1; y < 8; y++) for (let x = 0; x < 5; x++) if (!v[y * 6 + x] && gl[y - 1] && gl[y - 1][x]) v[y * 6 + x] = 2;
  return fromHex(v.map(n => n.toString(16)).join(''), 6, 8, pal);
}
const FONTS = {};
function glyphFor(color, ch) { const f = FONTS[color] || (FONTS[color] = {}); ch = ch.toUpperCase(); return f[ch] || (f[ch] = fontCanvas(ch, A.fontPal[color])); }
const FS = 4 / 3;   // k = 1 -> 8 logical px per letter (4 screen px per font pixel); the HUD uses k = 0.75 like the original
function text(s, x, y, color = 'gold', align = 'left', k = 1) {
  s = String(s); const sc = FS * k, cw = 6 * sc; if (align === 'center') x -= s.length * cw / 2; else if (align === 'right') x -= s.length * cw;
  for (let i = 0; i < s.length; i++) if (s[i] !== ' ') g.drawImage(glyphFor(color, s[i]), x + i * cw, y, 6 * sc, 8 * sc);
}

// ------------------------------------------------------------------ save data
const KEY = 'towerOfDestinyWeb.v1';
let sv = { coins: 0, gems: 0, best: 0, owned: 1, equipped: 0, magnetLv: 0, shieldLv: 0, extraLives: 0, cpStage: 0, cpScore: 0, sound: true, points: 0, lucky: 0, coinB: 0, headStart: 0, wind: 0 };
try { Object.assign(sv, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) {} };
const livesMax = () => Math.min(MAX_LIVES, 3 + sv.extraLives);
const magnetSecs = () => 10 + 2 * sv.magnetLv, shieldSecs = () => 10 + 2 * sv.shieldLv;
const ownedCount = () => { let n = 0; for (let k = 1; k < NSKIN; k++) if (sv.owned >> k & 1) n++; return n; };
const skinPrice = () => 100 + 50 * ownedCount();            // all locked skins: 100, +50 per skin you own

// ------------------------------------------------------------------ audio (WebAudio chiptune)
let ac = null, master = null, musicOn = false;
function audioInit() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.18; master.connect(ac.destination); startMusic(); } catch (e) { ac = null; }
}
function tone(f, dur, type = 'square', vol = 0.5, slide = 0, delay = 0) {
  if (!ac || !sv.sound) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), gn = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.5) {
  if (!ac || !sv.sound) return;
  const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(), gn = ac.createGain(); s.buffer = b; gn.gain.value = vol; s.connect(gn); gn.connect(master); s.start();
}
const sfx = {
  jump: () => tone(380, 0.14, 'square', 0.35, 520),
  coin: () => { tone(988, 0.07, 'square', 0.3); tone(1319, 0.12, 'square', 0.3, 0, 0.06); },
  gem: () => { tone(1175, 0.08, 'square', 0.3); tone(1568, 0.08, 'square', 0.3, 0, 0.07); tone(2093, 0.14, 'square', 0.3, 0, 0.14); },
  hit: () => { noise(0.25, 0.7); tone(220, 0.25, 'sawtooth', 0.4, -150); },
  chest: () => { tone(440, 0.12, 'square', 0.35, 440); tone(880, 0.2, 'square', 0.35, 440, 0.1); },
  buy: () => { tone(784, 0.08, 'square', 0.3); tone(1047, 0.16, 'square', 0.3, 0, 0.08); },
  bad: () => tone(160, 0.18, 'square', 0.35, -40),
  step: () => tone(700, 0.04, 'square', 0.15),
  land: () => noise(0.05, 0.12),
};
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = n => { if (n === '.') return 0; const m = /^([A-G])(#?)([0-9])$/.exec(n); const semis = NOTE[m[1]] + (m[2] ? 1 : 0) + 12 * (+m[3] + 1); return 440 * Math.pow(2, (semis - 69) / 12); };
const LEAD = ['A4 . C5 . E5 . C5 . A4 . C5 . E5 . D5 C5', 'A4 . C5 . F5 . C5 . A4 . C5 . F5 . E5 D5', 'G4 . C5 . E5 . C5 . G4 . C5 . E5 . D5 C5', 'G4 . B4 . D5 . B4 . G4 . B4 . D5 . C5 B4'].join(' ').split(' ').map(hz);
const BASS = ['A2 . . . A2 . E3 . A2 . . . A2 . E3 .', 'F2 . . . F2 . C3 . F2 . . . F2 . C3 .', 'C3 . . . C3 . G3 . C3 . . . C3 . G3 .', 'G2 . . . G2 . D3 . G2 . . . G2 . D3 .'].join(' ').split(' ').map(hz);
function startMusic() {
  if (musicOn || !ac) return; musicOn = true;
  const STEP = 7 / 60; let step = 0, next = ac.currentTime + 0.1;
  const note = (f, t, d, type, vol) => { const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.value = f; gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(gn); gn.connect(master); o.start(t); o.stop(t + d + 0.02); };
  setInterval(() => {
    while (next < ac.currentTime + 0.25) {
      if (sv.sound) { const i = step & 63; if (LEAD[i]) note(LEAD[i], next, STEP * 1.6, 'square', 0.16); if (BASS[i]) note(BASS[i], next, STEP * 3, 'triangle', 0.5); }
      next += STEP; step++;
    }
  }, 40);
}

// ------------------------------------------------------------------ input
let state = 'title';
const hot = [];                 // clickable regions registered each frame {x,y,w,h,fn,id}
const pressed = new Set(), down = new Set();
// controls: mouse for everything (menus, shops, buttons). Jump = mouse click or Space. Esc / P = pause or back, M = sound.
const KEYMAP = { Space: 'a', Escape: 'b', KeyP: 'start', KeyM: 'sel' };   // F = fullscreen
function toggleFullscreen() {
  const el = document.getElementById('wrap') || document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
}
function keyEvent(code, isDown) {
  if (isDown && code === 'KeyF') { toggleFullscreen(); return true; }
  const k = KEYMAP[code]; if (!k) return false;
  if (isDown) { audioInit(); if (!down.has(k)) pressed.add(k); down.add(k); } else down.delete(k);
  return true;
}
addEventListener('keydown', e => { if (keyEvent(e.code, true)) e.preventDefault(); });
addEventListener('keyup', e => { keyEvent(e.code, false); });
// the host page can forward keys here (postMessage), so the keyboard works even if the iframe is not focused
addEventListener('message', e => { const d = e.data; if (d && d.tod === 'key' && typeof d.code === 'string') keyEvent(d.code, !!d.down); });
const fsBtn = document.getElementById('fs'); if (fsBtn) fsBtn.addEventListener('click', e => { e.stopPropagation(); audioInit(); toggleFullscreen(); });
function toLogical(e) { const r = screen.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
let pointer = [-1, -1];
let pointerMoved = false;
screen.addEventListener('pointermove', e => { pointer = toLogical(e); pointerMoved = true; });
screen.addEventListener('pointerdown', e => {
  e.preventDefault(); audioInit(); try { window.focus(); screen.focus(); } catch (err) {} const [x, y] = toLogical(e); pointer = [x, y];
  for (let i = hot.length - 1; i >= 0; i--) { const h = hot[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return; } }
  if (state === 'play') pressed.add('a');
});
addEventListener('gamepadconnected', () => {});
const padPrev = {};
function pollPad() {
  let gp = null; try { gp = navigator.getGamepads && navigator.getGamepads()[0]; } catch (e) { return; }   // blocked inside file:// iframes
  if (!gp) return;
  const m = { a: gp.buttons[0] && gp.buttons[0].pressed, b: gp.buttons[1] && gp.buttons[1].pressed, start: gp.buttons[9] && gp.buttons[9].pressed, sel: gp.buttons[8] && gp.buttons[8].pressed,
    up: (gp.buttons[12] && gp.buttons[12].pressed) || gp.axes[1] < -0.6, down: (gp.buttons[13] && gp.buttons[13].pressed) || gp.axes[1] > 0.6,
    left: (gp.buttons[14] && gp.buttons[14].pressed) || gp.axes[0] < -0.6, right: (gp.buttons[15] && gp.buttons[15].pressed) || gp.axes[0] > 0.6 };
  for (const k in m) { if (m[k] && !padPrev[k]) { pressed.add(k); audioInit(); } padPrev[k] = m[k]; }
}
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ------------------------------------------------------------------ game state
let stage = 1, score = 0, lives = 3, hitTimer = 0, frame = 0;
let magnetT = 0, shieldT = 0, clockT = 0, bootsT = 0, starT = 0;
let hx = 0, hy = GROUND, vy = 0, dir = 1, onGround = true, spinA = 0, squash = 0, jumpBuf = 0, climbing = false;
let chestX = 0, chestOpen = false, ladderX = 0, ladderLen = 0, ladderOn = false, crystalX = 0, crystalOn = false, crystalSaved = false, restStage = false;
let picks = [], mobs = [], spikes = [], parts = [], texts = [], fireballs = [];
let bannerT = 0, bannerTxt = '', shake = 0, flash = 0, fade = 1, fadeDir = -1, fadeNext = null;
let menuSel = 0, wardSel = 0, upgSel = 0, ptsSel = 0, pauseSel = 0, prevScreen = 'title', overT = 0;
let combo = 0, hitsStage = 0, goldChest = false, usedWind = false, tutStep = 0, modal = 0;
const tutorial = () => stage <= 2 && sv.best < 3;
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
const circleHit = (cx, cy, r, x, y, w, h) => { const nx = Math.max(x, Math.min(cx, x + w)), ny = Math.max(y, Math.min(cy, y + h)); return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r; };
const pick = a => a[rnd(0, a.length - 1)];

// the tower is split into areas of 10 stages, each with its own look (these areas are my own design)
const AREAS = HD.AREAS;
const areaIdx = st => Math.floor((st - 1) / 10) % AREAS.length;
const areaNum = st => Math.floor((st - 1) / 10) + 1;
const roomCache = {};
const ROOM_HUE = [0, 185, 100, 255, -22];
const roomFor = st => { const i = areaIdx(st); return roomCache[i] || (roomCache[i] = (() => { const c = mk(W * SC, H * SC), x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.filter = 'hue-rotate(' + ROOM_HUE[i] + 'deg)'; x.drawImage(IMG.room, 0, 0, W * SC, H * SC); return c; })()); };

// power-ups: unlock stage, spawn weight
const POWER = { magnet: [4, 3], shield: [4, 3], heart: [6, 2], clock: [12, 2], boots: [18, 2], star: [24, 2] };
const POWER_SECS = { clock: 8, boots: 10, star: 15 };

function addScore(n) { const v = starT > 0 ? n * 2 : n; score += v; sv.points += v; }
function addPart(x, y, n, colors, spread = 1.6, up = 1.2, life = 28, size = 1) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * spread * 2, vy: -Math.random() * up - 0.3, life: life * (0.6 + Math.random() * 0.6), max: life, c: colors[rnd(0, colors.length - 1)], s: size });
}
function floatText(x, y, s, color = 'gold') { texts.push({ x, y, s, color, t: 40 }); }
function addPick(x, y, type, fall) { picks.push({ x, y, type, fall, vy: fall ? -(0.6 + Math.random() * 1.3) : 0, vx: fall ? (Math.random() - 0.5) * 1.6 : 0, ph: Math.random() * 6 }); }

function stageSetup() {
  picks = []; mobs = []; spikes = []; parts = []; texts = []; fireballs = []; chestOpen = false; ladderOn = false; ladderLen = 0; crystalOn = false; crystalSaved = false;
  restStage = stage % SAVE_EVERY === 0; dir = stage & 1 ? -1 : 1;
  const T = AREAS[areaIdx(stage)]; HD.flame = T.flame;
  hx = dir < 0 ? XMAX - 10 : XMIN + 10; hy = GROUND; vy = 0; onGround = true; spinA = 0; climbing = false; hitTimer = 0; jumpBuf = 0; squash = 0;
  tutStep = 0; modal = (stage === 2 && tutorial()) ? 1 : 0;
  hitsStage = 0; goldChest = stage >= 3 && !restStage && Math.random() < 0.12;
  const zone = Math.random() < 0.5; ladderX = zone ? 150 : 73;
  do { chestX = rnd(24, XMAX - 24); } while (chestX > ladderX - 30 && chestX < ladderX + 46);
  if (stage === 1) chestX = dir < 0 ? 70 : 170;
  const spawnLo = dir < 0 ? XMAX - 60 : XMIN - 4, spawnHi = dir < 0 ? XMAX + 24 : XMIN + 64;
  const clear = (x, w) => !(x < spawnHi && x + w > spawnLo) && !(x < chestX + 30 && x + w > chestX - 26) && !(x < ladderX + 34 && x + w > ladderX - 26) && spikes.every(s => x > s.x + s.w + 46 || x + w < s.x - 46);

  // ----- floor traps: a different mix every time (single, wide, triple), clustered toward a random part of the room
  const easy = !restStage && stage > 3 && stage % 5 === 0;           // every 5th stage is a breather
  let ns = restStage ? 0 : stage <= 1 ? 0 : stage < 4 ? 1 : stage < 10 ? 2 : 3;
  if (stage >= 2 && !restStage) { ns = Math.max(1, Math.min(3, ns + pick([-1, 0, 0, 1])) - (easy ? 1 : 0)); }
  const bias = rnd(40, XMAX - 40), widths = stage < 6 ? [1] : stage < 14 ? [1, 1, 2] : stage < 28 ? [1, 2, 2] : [1, 2, 2, 3];
  for (let k = 0; k < ns; k++) for (let t = 0; t < 60; t++) {
    const acid = stage >= 8 && Math.random() < 0.3, w = acid ? pick([24, 32, 40]) : 16 * pick(widths), x = Math.round(Math.random() < 0.6 ? bias + (Math.random() + Math.random() + Math.random() - 1.5) * 90 : rnd(24, XMAX - 24));
    if (x < 22 || x + w > XMAX + 6) continue;
    if (clear(x, w)) { spikes.push({ x, w, acid }); break; }
  }
  // ----- enemies: every stage picks a few of the kinds unlocked so far, so no two stages feel the same
  if (!restStage) {
    const UNLOCK = [['bat', 2], ['saw', 5], ['slime', 6], ['spiny', 9], ['ghost', 11], ['stal', 13], ['turret', 16], ['mace', 22]].filter(([, from]) => stage >= from).map(([n]) => n);
    let chosen;
    if (stage === 2) chosen = ['bat'];
    else {
      const k = easy ? 1 : stage < 12 ? 1 : stage < 30 ? 2 : 3, pool = UNLOCK.slice().sort(() => Math.random() - 0.5);
      chosen = pool.slice(0, k);
      const newest = UNLOCK[UNLOCK.length - 1];
      if (stage > 2 && !chosen.includes(newest) && Math.random() < 0.65) chosen[chosen.length - 1] = newest;
    }
    const n = base => Math.max(1, base + pick([-1, 0, 0, 1]));
    const lvl = stage < 16 ? 1 : stage < 36 ? 2 : 3;
    for (const kind of chosen) {
      if (kind === 'saw') for (let k = 0, c = n(lvl); k < c; k++) { const lo = rnd(16, 120), hi = Math.min(XMAX - 8, lo + rnd(80, 170)); mobs.push({ kind, x: rnd(lo, hi), lo, hi, dir: pick([-1, 1]), v: Math.min(1.6, (rnd(110, 150) + stage * 2) / 256 * 1.2) }); }
      else if (kind === 'bat') for (let k = 0, c = stage === 2 ? 1 : n(lvl); k < c; k++) mobs.push({ kind, x: rnd(50, XMAX - 40), y: FLOORY - rnd(40, 64), amp: rnd(3, 8), dir: pick([-1, 1]), v: rnd(80, 140) / 256 * 1.2, ph: Math.random() * 6 });
      else if (kind === 'slime') for (let k = 0, c = n(lvl); k < c; k++) mobs.push({ kind, x: rnd(40, XMAX - 30), dir: pick([-1, 1]), v: rnd(30, 60) / 100, t: rnd(0, 80), yo: 0, vy: 0 });
      else if (kind === 'ghost') for (let k = 0, c = n(lvl > 1 ? 2 : 1); k < c; k++) mobs.push({ kind, x: rnd(40, XMAX - 40), y: FLOORY - rnd(38, 56), dir: pick([-1, 1]), v: rnd(30, 52) / 100, ph: Math.random() * 6 });
      else if (kind === 'turret') for (let k = 0, c = stage < 30 ? 1 : 2; k < c; k++) { const left = k === 0 ? Math.random() < 0.5 : !mobs.find(m => m.kind === 'turret').left; mobs.push({ kind, left, y: FLOORY - pick([18, 12, 28, 40]), t: rnd(30, 120), every: rnd(150, 230), spd: rnd(120, 170) / 100 }); }
      else if (kind === 'mace') for (let k = 0, c = stage < 36 ? 1 : 2; k < c; k++) mobs.push({ kind, px: rnd(70, XMAX - 50), len: rnd(50, 62), amp: rnd(80, 105) / 100, period: rnd(110, 170), t: rnd(0, 100) });
      else if (kind === 'spiny') for (let k = 0, c = n(lvl); k < c; k++) mobs.push({ kind, x: rnd(40, XMAX - 30), dir: pick([-1, 1]), v: rnd(55, 95) / 100 });
      else if (kind === 'stal') for (let k = 0, c = n(lvl); k < c; k++) mobs.push({ kind, x: rnd(40, XMAX - 24), st: 0, t: 0, wait: rnd(40, 200), y: IY0 - 2, vy: 0 });
    }
    const cap = easy ? 2 : stage < 20 ? 3 : stage < 45 ? 4 : 5;
    while (mobs.filter(m => m.kind !== 'turret').length > cap) { const i = mobs.findIndex(m => m.kind !== 'turret'); mobs.splice(i, 1); }
  }
  // ----- pickups
  const nc = tutorial() ? 0 : rnd(3, 6);
  for (let k = 0; k < nc; k++) addPick(rnd(24, XMAX - 6), rnd(0, 2) === 0 ? FLOORY - 14 : FLOORY - rnd(22, 50), 'coin', false);
  const ng = (stage === 1 && tutorial()) ? 0 : rnd(1, 2);
  for (let k = 0; k < ng; k++) addPick(rnd(30, XMAX - 6), FLOORY - rnd(24, 50), 'gem', false);
  if (!restStage && stage >= 4) {
    const chance = Math.min(0.24, 0.10 + (stage - 4) * 0.004 + 0.03 * (sv.lucky | 0)), tries = stage >= 30 ? 2 : 1;
    for (let k = 0; k < tries; k++) if (Math.random() < chance) {
      const pool = Object.entries(POWER).filter(([n, [from]]) => stage >= from && (n !== 'heart' || lives < livesMax())), total = pool.reduce((a, [, [, w]]) => a + w, 0);
      let r = Math.random() * total, type = pool[0][0]; for (const [n, [, w]] of pool) { if ((r -= w) < 0) { type = n; break; } }
      addPick(rnd(40, XMAX - 10), FLOORY - rnd(26, 46), type, false);
    }
  }
  if (restStage) { crystalOn = true; crystalX = W / 2 - 8 + (Math.random() < 0.5 ? 24 : -32); }
  bannerT = 0;
  if ((stage - 1) % 10 === 0 && stage > 1) { bannerT = 190; bannerTxt = 'AREA ' + areaNum(stage) + ': ' + T.name; }
}
function newRun(fromCp) {
  lives = livesMax(); magnetT = shieldT = clockT = bootsT = starT = 0; usedWind = false; combo = 0; shieldT = (sv.headStart | 0) * 5 * 60;
  if (fromCp && sv.cpStage > 0) { stage = sv.cpStage; score = sv.cpScore; } else { stage = 1; score = 0; }
  stageSetup(); state = 'play'; fade = 1; fadeDir = -1;
}
function go(s) { state = s; sfx.step(); }

// ------------------------------------------------------------------ gameplay update (fixed 60Hz)
function hurt() {
  if (hitTimer > 0 || shieldT > 0 || window.__god) return;
  lives--; hitTimer = 100; vy = -1.5; onGround = false; sfx.hit(); shake = 10; flash = 0.35; combo = 0; hitsStage++;
  addPart(hx + 8, hy + 8, 14, ['#ff5050', '#ffb0a0', '#ffffff'], 2.2, 2);
  if (lives <= 0 && sv.wind > 0 && !usedWind) { usedWind = true; lives = 1; hitTimer = 160; floatText(hx + 8, hy - 4, 'SECOND WIND', 'cyan'); sfx.gem(); }
  else if (lives <= 0) { if (stage > sv.best) sv.best = stage; save(); state = 'over'; overT = 0; }
}
function collect(p) {
  p.dead = true;
  const burst = (cols, n = 8) => addPart(p.x, p.y, n, cols, 1.4, 1.6, 26);
  if (p.type === 'coin') { sv.coins += 1 + (sv.coinB | 0); addScore(10); sfx.coin(); addPart(p.x, p.y, 6, ['#F5C53D', '#FFF2A8', '#fff'], 1.2, 1.4, 22); floatText(p.x, p.y - 8, '+' + (1 + (sv.coinB | 0)), 'gold'); }
  else if (p.type === 'gem') { if (stage === 1 && tutorial() && tutStep >= 1 && tutStep < 3) { tutStep++; if (tutStep === 2) addPick(rnd(40, XMAX - 20), FLOORY - rnd(28, 44), 'gem', false); } sv.gems++; addScore(50); sfx.gem(); burst(['#2FD4EA', '#A6F4FF', '#fff']); floatText(p.x, p.y - 8, '+1', 'cyan'); }
  else {
    addScore(25); sfx.gem(); burst(['#ffffff', '#ffe27a', '#7df0ff'], 12);
    if (p.type === 'magnet') { magnetT = magnetSecs() * 60; floatText(p.x, p.y - 10, 'MAGNET', 'white'); }
    else if (p.type === 'shield') { shieldT = shieldSecs() * 60; floatText(p.x, p.y - 10, 'SHIELD', 'cyan'); }
    else if (p.type === 'heart') { if (lives < livesMax()) lives++; else addScore(100); floatText(p.x, p.y - 10, '+1 LIFE', 'red'); }
    else if (p.type === 'clock') { clockT = POWER_SECS.clock * 60; floatText(p.x, p.y - 10, 'SLOW TIME', 'cyan'); }
    else if (p.type === 'boots') { bootsT = POWER_SECS.boots * 60; floatText(p.x, p.y - 10, 'SUPER JUMP', 'white'); }
    else if (p.type === 'star') { starT = POWER_SECS.star * 60; floatText(p.x, p.y - 10, 'DOUBLE SCORE', 'gold'); }
  }
  save();
}
function stomp(m, cx, cy, pts, cols) {
  combo++; const mult = Math.min(4, combo); pts *= mult;
  m.dead = true; vy = bootsT > 0 ? -4.1 : -3.2; onGround = false; spinA = 0; addScore(pts); sfx.chest(); shake = 4;
  addPart(cx, cy, 14, cols, 2, 1.8, 26); floatText(cx, cy - 6, '+' + pts + (mult > 1 ? ' x' + mult : ''), mult > 1 ? 'gold' : 'cyan'); for (let q = 0; q < 2; q++) addPick(cx, cy, 'coin', true);
}
function playUpdate() {
  if (modal) { if (pressed.has('a')) { modal = 0; sfx.step(); } pressed.delete('start'); pressed.delete('b'); return; }
  if (pressed.has('a')) jumpBuf = 6;
  if (pressed.has('start') || pressed.has('b')) { prevScreen = 'play'; state = 'pause'; pauseSel = 0; return; }
  if (jumpBuf > 0) jumpBuf--; if (hitTimer > 0) hitTimer--; if (bannerT > 0) bannerT--;
  if (magnetT > 0) magnetT--; if (shieldT > 0) shieldT--; if (clockT > 0) clockT--; if (bootsT > 0) bootsT--; if (starT > 0) starT--;
  if (climbing) {                                   // climbing the rope ladder out of the room
    hy -= 1.5; hx += (ladderX - hx) * 0.3; spinA = 0;
    if (hy < 4 && fadeDir === 0) { fadeDir = 1; fadeNext = () => { stage++; stageSetup(); }; }
    return;
  }
  const ts = clockT > 0 ? 0.5 : 1;                  // slow-time power-up halves enemy speed
  const spd = Math.min(470, 350 + stage * 2) / 256;
  hx += dir * spd;
  if (hx < XMIN) { hx = XMIN; dir = 1; } if (hx > XMAX) { hx = XMAX; dir = -1; }
  if (onGround && jumpBuf > 0) { vy = bootsT > 0 ? -4.7 : -3.83; onGround = false; jumpBuf = 0; spinA = 0; sfx.jump(); if (stage === 1 && tutorial() && tutStep === 0) { tutStep = 1; addPick(W / 2 + rnd(-30, 30), FLOORY - 36, 'gem', false); } squash = -4; addPart(hx + 8, hy + 15, 4, ['#8a8a96', '#b4b4bc'], 0.8, 0.4, 14); }
  if (!onGround) {
    vy += 0.172; hy += vy; spinA += 0.0224 * Math.PI * 2 * 0.99 * (bootsT > 0 ? 0.8 : 1);
    if (hy >= GROUND) { hy = GROUND; vy = 0; onGround = true; spinA = 0; squash = 5; combo = 0; sfx.land(); addPart(hx + 8, hy + 15, 5, ['#8a8a96', '#b4b4bc', '#55280F'], 1, 0.5, 16); }
    if (hy < 30) { hy = 30; vy = 0; }
  }
  if (squash > 0) squash--; else if (squash < 0) squash++;
  const bx = hx + 4, by = hy + 6, bw = 8, bh = 9;
  if (!chestOpen && overlap(bx, by, bw, bh, chestX + 2, GROUND + 4, 12, 12)) {
    chestOpen = true; ladderOn = true; ladderLen = 0; sfx.chest(); if (stage === 1 && tutorial()) tutStep = 4; addScore(50); flash = 0.2;
    for (let i = 0; i < 4; i++) addPick(chestX + 8, GROUND, 'coin', true); addPick(chestX + 8, GROUND, 'gem', true);
    if (goldChest) { for (let i = 0; i < 3; i++) addPick(chestX + 8, GROUND, 'gem', true); for (let i = 0; i < 4; i++) addPick(chestX + 8, GROUND, 'coin', true); addScore(200); floatText(chestX + 8, GROUND - 10, 'GOLDEN CHEST!', 'gold'); }
    addPart(chestX + 8, GROUND + 4, 18, ['#F5C53D', '#FFF2A8', '#fff'], 2, 2.2, 34);
  }
  if (ladderOn && ladderLen < LADDER_LEN) ladderLen = Math.min(LADDER_LEN, ladderLen + 3);
  if (ladderOn && ladderLen >= LADDER_LEN - 4 && overlap(bx, by, bw, bh, ladderX, LADDER_TOP + 24, 16, LADDER_LEN - 28)) {
    climbing = true; if (hitsStage === 0 && stage > 1) { addScore(50); floatText(hx + 8, hy - 14, 'PERFECT +50', 'cyan'); } addScore(100 + stage * 5); if (stage + 1 > sv.best) sv.best = stage + 1; sfx.buy(); save();
    floatText(hx + 8, hy - 6, '+' + (100 + stage * 5), 'gold');
  }
  if (crystalOn && !crystalSaved && overlap(bx, by, bw, bh, crystalX, GROUND, 16, 16)) {
    crystalSaved = true; sv.cpStage = stage + 1; sv.cpScore = score; save(); sfx.buy(); bannerT = 150; bannerTxt = 'PROGRESS SAVED!';
    addPart(crystalX + 8, GROUND + 4, 16, ['#2FD4EA', '#A6F4FF', '#fff'], 1.8, 2, 36);
  }
  for (const s of spikes) if (overlap(bx, by, bw, bh, s.x + 1, FLOORY - 6, s.w - 2, 6)) hurt();
  for (const m of mobs) {
    if (m.kind === 'saw') {
      m.x += m.dir * m.v * ts; if (m.x < m.lo) { m.x = m.lo; m.dir = 1; } if (m.x > m.hi) { m.x = m.hi; m.dir = -1; }
      if (overlap(bx, by, bw, bh, m.x + 2, GROUND + 3, 12, 12)) hurt();
    } else if (m.kind === 'bat') {
      m.x += m.dir * m.v * ts; if (m.x < 14) { m.x = 14; m.dir = 1; } if (m.x > XMAX - 8) { m.x = XMAX - 8; m.dir = -1; }
      m.ph += 0.05 * ts; m.sy = m.y + Math.sin(m.ph * 3) * m.amp;
      if (overlap(bx, by, bw, bh, m.x + 2, m.sy + 1, 12, 6)) { if (vy > 0.4 && by + bh < m.sy + 7) stomp(m, m.x + 8, m.sy + 4, 75, ['#58c24a', '#9be36a', '#fff']); else hurt(); }
    } else if (m.kind === 'slime') {
      m.x += m.dir * m.v * ts * (m.yo < -0.5 ? 1.8 : 0.5); if (m.x < 14) { m.x = 14; m.dir = 1; } if (m.x > XMAX - 8) { m.x = XMAX - 8; m.dir = -1; }
      m.t += ts; if (m.yo >= 0 && m.t > 70) { m.t = 0; m.vy = -2.7; }
      if (m.vy !== 0 || m.yo < 0) { m.vy += 0.13 * ts; m.yo += m.vy * ts; if (m.yo >= 0) { m.yo = 0; m.vy = 0; } }
      const top = GROUND + 6 + m.yo;
      if (overlap(bx, by, bw, bh, m.x + 2, top, 12, 10)) { if (vy > 0.4 && by + bh < top + 6) stomp(m, m.x + 8, top + 4, 100, ['#6ae06a', '#b8ffa0', '#fff']); else hurt(); }
    } else if (m.kind === 'ghost') {
      m.x += m.dir * m.v * ts; if (m.x < 14) { m.x = 14; m.dir = 1; } if (m.x > XMAX - 10) { m.x = XMAX - 10; m.dir = -1; }
      m.ph += 0.04 * ts; m.sy = m.y + Math.sin(m.ph * 2) * 10;
      if (overlap(bx, by, bw, bh, m.x + 3, m.sy + 3, 10, 11)) { if (vy > 0.4 && by + bh < m.sy + 10) stomp(m, m.x + 8, m.sy + 8, 150, ['#e8ecff', '#b8c0ff', '#fff']); else hurt(); }
    } else if (m.kind === 'spiny') {
      m.x += m.dir * m.v * ts; if (m.x < 14) { m.x = 14; m.dir = 1; } if (m.x > XMAX - 8) { m.x = XMAX - 8; m.dir = -1; }
      if (overlap(bx, by, bw, bh, m.x + 2, GROUND + 5, 12, 11)) hurt();
    } else if (m.kind === 'stal') {
      m.t += ts;
      if (m.st === 0 && m.t > m.wait) { m.st = 1; m.t = 0; sfx.step(); }
      else if (m.st === 1 && m.t > 42) { m.st = 2; m.t = 0; m.y = IY0 - 2; m.vy = 0; }
      else if (m.st === 2) {
        m.vy += 0.14 * ts; m.y += m.vy * ts;
        if (overlap(bx, by, bw, bh, m.x + 4, m.y, 8, 14)) { hurt(); m.st = 3; m.t = 0; addPart(m.x + 8, m.y + 10, 8, ['#9aa3b4', '#6b7486', '#fff'], 1.6, 1.4, 20); }
        else if (m.y >= FLOORY - 14) { m.st = 3; m.t = 0; addPart(m.x + 8, FLOORY - 3, 10, ['#9aa3b4', '#6b7486', '#fff'], 1.8, 1.6, 22); sfx.land(); }
      } else if (m.st === 3 && m.t > 90) { m.st = 0; m.t = 0; m.wait = rnd(90, 260); m.x = rnd(40, XMAX - 24); }
    } else if (m.kind === 'turret') {
      m.t += ts; if (m.t >= m.every) { m.t = 0; sfx.step(); fireballs.push({ x: m.left ? IX0 + 12 : IX1 - 12, y: m.y, vx: (m.left ? 1 : -1) * m.spd }); }
    } else if (m.kind === 'mace') {
      m.t += ts; const a = m.amp * Math.sin(m.t / m.period * Math.PI * 2); m.hx = m.px + Math.sin(a) * m.len; m.hy = IY0 + Math.cos(a) * m.len;
      if (circleHit(m.hx, m.hy, 5.2, bx, by, bw, bh)) hurt();
    }
  }
  mobs = mobs.filter(m => !m.dead);
  for (const f of fireballs) { f.x += f.vx * ts; f.life = (f.life || 0) + 1; if (circleHit(f.x, f.y, 3.2, bx, by, bw, bh)) { hurt(); f.dead = true; addPart(f.x, f.y, 6, ['#ff9a22', '#ffd34e'], 1.2, 1, 16); } if (f.x < IX0 || f.x > IX1) f.dead = true; }
  fireballs = fireballs.filter(f => !f.dead);
  for (const p of picks) {
    if (p.dead) continue;
    if (p.fall) { p.vy += 0.09; p.y += p.vy; p.x += p.vx; p.vx *= 0.99; if (p.x < 14) p.x = 14; if (p.x > XMAX + 2) p.x = XMAX + 2; if (p.y >= FLOORY - 10) { p.y = FLOORY - 10; p.fall = false; } }
    else if (magnetT > 0 && (p.type === 'coin' || p.type === 'gem')) {
      const dx = hx + 8 - p.x, dy = hy + 10 - p.y, d = Math.hypot(dx, dy);
      if (d < 74 && d > 0.5) { const s = Math.min(2.4, 0.6 + (74 - d) / 30); p.x += dx / d * s; p.y += dy / d * s; }
    }
    const big = p.type !== 'coin' && p.type !== 'gem';
    if (overlap(bx - 1, by - 1, bw + 2, bh + 2, p.x - 4, p.y - 4, 8, 8) || (big && overlap(bx - 1, by - 1, bw + 2, bh + 2, p.x - 7, p.y - 7, 14, 14))) collect(p);
  }
  picks = picks.filter(p => !p.dead);
}

// ------------------------------------------------------------------ drawing helpers
// crisp vector boxes (thin dotted outlines, rounded corners) like the real game
function box(x, y, w, h, o = {}) {
  g.save(); rrect(g, x, y, w, h, o.r === undefined ? 3 : o.r);
  if (o.fill) { g.fillStyle = o.fill; g.fill(); }
  if (o.stroke) { g.lineWidth = o.lw || 0.7; g.strokeStyle = o.stroke; g.setLineDash(o.dash ? [1.4, 1.4] : []); g.stroke(); }
  g.restore();
}
const panel = (x, y, w, h, border = '#5a6478', fill = '#07070c') => box(x, y, w, h, { r: 1.5, fill, stroke: border, dash: true, lw: 0.8 });
const PIXEL = new Set(['coin', 'gem', 'heart', 'chest', 'spike', 'torch', 'ladder', 'crystal', 'magnet', 'shield', 'bigheart', 'ring_gold', 'ring_cyan', 'ring_red', 'cursor', 'sparkle', 'bubble']);
const spr = (name, f, x, y, ...ex) => {
  if (PIXEL.has(name)) { const fr = IMG.obj[name], im = fr[f % fr.length]; g.drawImage(im, Math.round(x), Math.round(y)); }
  else { const d = HD.obj[name]; if (d) d(g, f, x, y, frame, ...ex); }
};
const hexA = h => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',A)'; };
const TAU = Math.PI * 2;
function region(x, y, w, h, fn, id) { hot.push({ x, y, w, h, fn, id }); }
const hovered = (x, y, w, h) => pointerMoved && pointer[0] >= x && pointer[0] < x + w && pointer[1] >= y && pointer[1] < y + h;

function drawHUD(showLives = true) {
  const k = 0.75, ty = 3.5;
  text('STAGE', 7, ty, 'gold', 'left', k); text(stage, 40, ty, 'cyan', 'left', k);
  text('SCORE', 66, ty, 'gold', 'left', k); text(score, 101, ty, starT > 0 ? 'gold' : 'cyan', 'left', k);
  g.fillStyle = '#b2a121'; g.beginPath(); g.arc(146, 7.6, 3.5, 0, TAU); g.fill(); g.lineWidth = 1.3; g.strokeStyle = '#fee530'; g.beginPath(); g.arc(146, 7.6, 3.4, 0, TAU); g.stroke();
  text(sv.coins, 153, ty, 'gold', 'left', k);
  spr('gem', (frame >> 4) & 1, 181, 3.6); text(sv.gems, 195, ty, 'cyan', 'left', k);
  if (showLives) { const mx = livesMax(); for (let i = 0; i < mx; i++) spr('heart', i < lives ? 0 : 1, 255 - (mx - i) * 9.3, 3.6); }
  if (state === 'play') { // pause button (bottom right, like the original)
    const bx = W - 22, by = H - 19, hv = hovered(bx, by, 14, 14); box(bx, by, 14, 14, { r: 3, fill: '#090c0e', stroke: hv ? '#ffc23a' : '#fba31a', lw: 1.2 });
    g.fillStyle = '#fbca33'; g.fillRect(bx + 4.3, by + 3.6, 2, 6.8); g.fillRect(bx + 7.7, by + 3.6, 2, 6.8); region(bx - 3, by - 3, 20, 20, () => { prevScreen = 'play'; state = 'pause'; pauseSel = 0; });
  }
}
function drawRoom(st = stage) { g.drawImage(roomFor(st), 0, 0, W, H); }
function drawMenuRoom() { g.drawImage(IMG.menuRoom, 0, 0, W, H); }
function drawBackdrop() { if (prevScreen === 'title') drawMenuRoom(); else drawRoom(); }
function drawTorches() { const hue = ROOM_HUE[areaIdx(state === 'title' ? 1 : stage)]; g.save(); if (hue) g.filter = 'hue-rotate(' + hue + 'deg)'; for (const x of [66, W - 74]) spr('torch', [0, 1, 2, 1][(frame >> 3) & 3], x, 47); g.restore(); }
const torchSpots = () => [[66 + 4, 50], [W - 74 + 4, 50]];

function withHue(deg, fn) { if (deg) { g.save(); g.filter = 'hue-rotate(' + deg + 'deg)'; fn(); g.restore(); } else fn(); }
function drawWorld() {
  drawRoom();
  const T = AREAS[areaIdx(stage)];
  for (const m of mobs) if (m.kind === 'turret') HD.obj.turret(g, 0, m.left ? IX0 + 0.5 : IX1 - 15.5, m.y - 8, frame, m.left, Math.max(0, (m.t - (m.every - 36)) / 36));
  for (const m of mobs) if (m.kind === 'mace') HD.obj.mace(g, m.px, IY0, m.hx === undefined ? m.px : m.hx, m.hy === undefined ? IY0 + m.len : m.hy, frame);
  for (const sp of spikes) { if (sp.acid) spr('acid', 0, sp.x, FLOORY - 3, sp.w); else for (let i = 0; i < sp.w / 16; i++) spr('spike', 0, sp.x + i * 16, FLOORY - 8); }
  g.save(); if (goldChest) g.filter = 'hue-rotate(38deg) saturate(2.4) brightness(1.35)'; spr('chest', chestOpen ? 1 : 0, chestX, GROUND); g.restore();
  if (ladderOn) { const n = Math.ceil(ladderLen / 16); for (let i = 0; i < n; i++) { const vis = Math.min(16, ladderLen - i * 16); const sw = Math.sin(frame / 20 + i * 0.4) * 0.8 * (i + 1) / 5; g.save(); g.beginPath(); g.rect(ladderX + sw - 1, LADDER_TOP + i * 16, 18, vis); g.clip(); spr('ladder', 0, ladderX + sw, LADDER_TOP + i * 16); g.restore(); } }
  if (crystalOn) spr('crystal', crystalSaved || (frame & 32) ? 1 : 0, crystalX, GROUND);
  for (const m of mobs) {
    if (m.kind === 'saw') spr('saw', 0, m.x, GROUND);
    else if (m.kind === 'bat') withHue(T.hue, () => spr('bat', (frame >> 3) & 1, m.x, m.sy || m.y));
    else if (m.kind === 'slime') withHue(T.hue, () => spr('slime', 0, m.x, GROUND - 1 + m.yo, m.yo));
    else if (m.kind === 'ghost') spr('ghost', 0, m.x, m.sy || m.y);
    else if (m.kind === 'spiny') spr('spiny', 0, m.x, GROUND);
    else if (m.kind === 'stal' && m.st < 3) spr('stal', 0, m.x, m.st === 2 ? m.y : IY0 - 1, m.st, m.t);
  }
  for (const f of fireballs) spr('fireball', 0, f.x, f.y, f.vx);
  for (const p of picks) {
    const bob = Math.sin(frame / 10 + p.ph) * 1.5;
    if (p.type === 'coin') spr('coin', ((frame >> 3) + Math.floor(p.ph)) & 3, p.x - 4, p.y - 4 + bob);
    else if (p.type === 'gem') spr('hexgem', 0, p.x - 4, p.y - 4 + bob);
    else { // power-ups pulse with a soft halo so they stand out
      const r = 11 + Math.sin(frame / 8) * 1.5; const gr = g.createRadialGradient(p.x, p.y + bob, 1, p.x, p.y + bob, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y + bob, r, 0, TAU); g.fill();
      spr(p.type === 'heart' ? 'p_heart' : p.type, 0, p.x - 8, p.y - 8 + bob);
    }
  }
  if (!(hitTimer > 0 && (hitTimer & 4) && shieldT === 0)) {
    g.save(); g.translate(hx + 8, hy + 8.5); g.rotate(spinA * dir);
    const sq = squash > 0 ? 1 - squash * 0.04 : (squash < 0 ? 1 + -squash * 0.03 : 1); g.scale(dir * (2 - sq), sq);
    if (bootsT > 0) { g.shadowColor = 'rgba(255,140,60,.9)'; g.shadowBlur = 5; }
    g.imageSmoothingEnabled = true; drawSkinVec(g, sv.equipped, 17.5); g.imageSmoothingEnabled = false; g.restore();
  }
  if (shieldT > 0 && (shieldT > 90 || (shieldT & 8))) spr('bubble', 0, hx, hy);
  for (const p of parts) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 0.7 + p.s * 0.45, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  for (const t of texts) { g.globalAlpha = Math.min(1, t.t / 20); text(t.s, t.x, t.y - (40 - t.t) * 0.4, t.color, 'center'); } g.globalAlpha = 1;
  // power-up timers along the bottom
  const tm = [['magnet', magnetT, magnetSecs() * 60, '#7df0ff'], ['shield', shieldT, shieldSecs() * 60, '#4ab8ff'], ['clock', clockT, POWER_SECS.clock * 60, '#8ae0ff'], ['boots', bootsT, POWER_SECS.boots * 60, '#ff9a5a'], ['star', starT, POWER_SECS.star * 60, '#ffd34e']].filter(a => a[1] > 0);
  tm.forEach((a, i) => { const x = 8 + i * 52, y = 142; g.save(); g.translate(x, y); g.scale(0.78, 0.78); spr(a[0], 0, 0, 0); g.restore();
    g.fillStyle = 'rgba(255,255,255,.14)'; rrect(g, x + 14, y + 4, 34, 4.4, 2.2); g.fill(); g.fillStyle = a[3]; rrect(g, x + 14, y + 4, Math.max(1, 34 * a[1] / a[2]), 4.4, 2.2); g.fill(); });
}
function drawArrows(cx, cy) {
  g.save(); g.strokeStyle = '#fbb92a'; g.fillStyle = '#fbb92a'; g.lineWidth = 1.2; g.lineCap = 'round';
  for (const d of [-1, 1]) { const x0 = cx + d * 26, x1 = cx + d * 11; g.beginPath(); g.moveTo(x0, cy); g.lineTo(x1, cy); g.stroke(); g.beginPath(); g.moveTo(x1, cy); g.lineTo(x1 + d * 4, cy - 2.6); g.lineTo(x1 + d * 4, cy + 2.6); g.closePath(); g.fill(); }
  g.restore();
}
function drawMouseHint() {
  const x = W / 2 - 38, y = 58;
  g.save(); g.fillStyle = '#c8c8cc'; rrect(g, x, y, 13, 18, 4); g.fill(); g.strokeStyle = '#7a7a82'; g.lineWidth = 0.6; g.stroke();
  g.fillStyle = (frame >> 4) & 1 ? '#5fd05a' : '#3fa03a'; g.beginPath(); g.moveTo(x + 6.5, y + 0.4); g.lineTo(x + 6.5, y + 8); g.lineTo(x + 0.4, y + 8); g.lineTo(x + 0.4, y + 4.6); g.quadraticCurveTo(x + 0.6, y + 0.8, x + 6.5, y + 0.4); g.fill();
  g.strokeStyle = '#7a7a82'; g.beginPath(); g.moveTo(x + 6.5, y); g.lineTo(x + 6.5, y + 8); g.moveTo(x, y + 8); g.lineTo(x + 13, y + 8); g.stroke();
  g.strokeStyle = '#d8d8dc'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 19, y + 17); g.lineTo(x + 25, y + 2); g.stroke();
  g.fillStyle = '#b8b8bc'; rrect(g, x + 29, y + 4, 40, 10, 2); g.fill(); g.fillStyle = '#8c8c92'; g.fillRect(x + 29, y + 12, 40, 2); text('SPACE', x + 49, y + 5.2, 'white', 'center', 0.75);
  g.restore();
}
function drawModal() {
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, H);
  const lines = ['CONGRATULATIONS!', '', 'YOU\'RE DOING GREAT!', 'BUT FROM NOW YOU WILL GO ALONE.', 'HERE IS A HINT FOR YOU:', 'JUMP ON AN ENEMY TO DEFEAT IT!', 'GOOD LUCK!!!'];
  panel(30, 36, W - 60, 82); lines.forEach((l, i) => text(l, W / 2, 43 + i * 9, i === 5 ? 'white' : 'gold', 'center', 0.85));
  text('CLICK OR SPACE TO CONTINUE', W / 2, 124, 'gold', 'center', 0.85);
}
function playBanner() {
  if (modal) { drawModal(); return; }
  if (stage === 1 && tutorial() && !bannerT && !restStage) {
    const gem = picks.find(p => p.type === 'gem');
    if (tutStep === 0) { drawMouseHint(); return; }
    if (tutStep === 1 && gem) { text('EXCELLENT! NOW PICK UP THAT GEM', W / 2, IY0 + 8, 'gold', 'center', 0.85); drawArrows(gem.x, gem.y); return; }
    if (tutStep === 2 && gem) { text('AND ONCE MORE :)', W / 2, IY0 + 8, 'gold', 'center', 0.85); drawArrows(gem.x, gem.y); return; }
    if (tutStep === 3) { text('NOW OPEN THAT CHEST!', W / 2, IY0 + 8, 'gold', 'center', 0.85); return; }
    if (tutStep === 4) { text('AWESOME! NOW JUMP ON THAT LADDER!', W / 2, IY0 + 8, 'gold', 'center', 0.85); return; }
  }
  let s = null, c = 'white';
  if (bannerT > 0) { s = bannerTxt; c = 'cyan'; }
  else if (restStage) { s = crystalSaved ? 'SAVED!' : 'TOUCH THE CRYSTAL TO SAVE'; c = crystalSaved ? 'cyan' : 'white'; }
  if (s) text(s, W / 2, IY0 + 8, c, 'center', 0.85);
}

// ------------------------------------------------------------------ screens
function titleOpen(id) { prevScreen = 'title'; state = id; wardSel = sv.equipped; upgSel = 0; ptsSel = 0; sfx.step(); }
function iconButton(x, y, sz, hover) {
  g.save(); rrect(g, x, y, sz, sz, sz * 0.24); g.fillStyle = '#090c0e'; g.fill();
  g.lineWidth = sz * 0.1; g.strokeStyle = hover ? '#ffbd2e' : '#fba31a'; rrect(g, x + sz * 0.05, y + sz * 0.05, sz * 0.9, sz * 0.9, sz * 0.2); g.stroke();
  g.lineWidth = 0.4; g.strokeStyle = '#825714'; g.beginPath();
  for (const [a, b, c, d] of [[.30, .03, .40, .12], [.72, .88, .66, .97], [.04, .62, .13, .55], [.96, .30, .88, .38], [.55, .04, .5, .13]]) { g.moveTo(x + sz * a, y + sz * b); g.lineTo(x + sz * c, y + sz * d); }
  g.stroke(); g.restore();
}
function drawCart(x, y) {
  g.save(); g.translate(x, y); g.strokeStyle = '#fbca33'; g.fillStyle = '#fbca33'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(5, 6.5); g.lineTo(8.2, 6.5); g.lineTo(10.6, 15.4); g.lineTo(18.8, 15.4); g.stroke();
  g.beginPath(); g.moveTo(8.9, 8.8); g.lineTo(20, 8.8); g.lineTo(18.6, 13.4); g.lineTo(10.2, 13.4); g.closePath(); g.fill();
  g.beginPath(); g.arc(11.8, 18.2, 1.5, 0, TAU); g.arc(17.6, 18.2, 1.5, 0, TAU); g.fill(); g.restore();
}
function drawTitle() {
  drawMenuRoom(); drawTorches();
  g.drawImage(IMG.tower, Math.round(W / 2 - IMG.tower.width / 2), 35 + Math.round(Math.sin(frame / 40) * 0.6));
  text('OF', W / 2, 52.4, 'gold', 'center', 0.5);
  g.drawImage(IMG.destiny, Math.round(W / 2 - IMG.destiny.width / 2), 57);
  g.fillStyle = '#eea11d'; g.fillRect(99, 68.4, 31, 1.2); g.fillRect(135, 68.4, 31, 1.2); g.fillStyle = '#fbcd3a'; g.fillRect(99, 68.4, 31, 0.6); g.fillRect(135, 68.4, 31, 0.6);
  g.fillStyle = '#eea11d'; g.beginPath(); g.moveTo(130.4, 68.4); g.lineTo(134.6, 68.4); g.lineTo(132.5, 73.6); g.fill();
  // play button (centre)
  const px = 113, py = 78 + Math.round(Math.sin(frame / 25) * 0.6), hp = hovered(px, py, 38, 38);
  iconButton(px - (hp ? 1 : 0), py - (hp ? 1 : 0), 38 + (hp ? 2 : 0), hp);
  g.save(); g.translate(px + 19, py + 19); g.fillStyle = '#ffce34'; g.beginPath(); g.moveTo(-6.6, -10); g.lineTo(10.6, 0); g.lineTo(-6.6, 10); g.closePath(); g.fill(); g.fillStyle = '#fbe75d'; g.beginPath(); g.moveTo(-6.6, -10); g.lineTo(-1.2, -6.7); g.lineTo(-6.6, 10); g.closePath(); g.fill(); g.restore();
  region(px, py, 38, 38, () => { newRun(false); sfx.buy(); }, 'play');
  // corner buttons: wardrobe (equipped skin), upgrade shop (cart), point shop (star) - like the original's two corner buttons
  const B = [[26, 33, 'ward'], [214, 30, 'upg'], [214, 62, 'pts']];
  for (const [bx, by, id] of B) {
    const hv = hovered(bx, by, 24, 24); iconButton(bx, by, 24, hv);
    if (id === 'ward') { g.save(); g.translate(bx + 12, by + 12.6); drawSkinVec(g, sv.equipped, 17); g.restore(); }
    else if (id === 'upg') drawCart(bx, by);
    else spr('star', 0, bx + 4, by + 4);
    region(bx, by, 24, 24, () => titleOpen(id), 'b' + id);
  }
  text('SHOP', 226, 55.4, 'gold', 'center', 0.5); text('POINTS', 226, 87.4, 'gold', 'center', 0.5); text('WARDROBE', 38, 58.4, 'gold', 'center', 0.5);
  if (sv.cpStage > 0) { const lab = 'CONTINUE ' + sv.cpStage, wv = lab.length * 8 + 8, cx = W / 2 - wv / 2, cy = 120, hv = hovered(cx, cy, wv, 11); box(cx, cy, wv, 11, { r: 4.5, fill: '#090c0e', stroke: hv ? '#ffbd2e' : '#fba31a', lw: 1 }); text(lab, W / 2, cy + 2.3, hv ? 'white' : 'gold', 'center'); region(cx, cy, wv, 11, () => { newRun(true); sfx.buy(); }, 'cont'); }
  const sx = 214, sy = 101, sh = hovered(sx, sy, 24, 24); g.save(); g.translate(sx + 12, sy + 12); g.fillStyle = '#090c0e'; g.beginPath(); g.arc(0, 0, 11.4, 0, TAU); g.fill(); g.lineWidth = 2.1; g.strokeStyle = sh ? '#ffbd2e' : '#fba31a'; g.beginPath(); g.arc(0, 0, 10.4, 0, TAU); g.stroke();
  g.fillStyle = '#fbca33'; g.beginPath(); g.moveTo(-6, -2.6); g.lineTo(-3, -2.6); g.lineTo(1, -6); g.lineTo(1, 6); g.lineTo(-3, 2.6); g.lineTo(-6, 2.6); g.closePath(); g.fill(); g.lineCap = 'round'; g.lineWidth = 1.3; g.strokeStyle = sv.sound ? '#fbca33' : '#ff6a5a';
  if (sv.sound) { for (const r of [3.2, 6]) { g.beginPath(); g.arc(1, 0, r, -0.9, 0.9); g.stroke(); } } else { g.beginPath(); g.moveTo(3.4, -3); g.lineTo(8, 3); g.moveTo(8, -3); g.lineTo(3.4, 3); g.stroke(); } g.restore();
  region(sx, sy, 24, 24, () => { sv.sound = !sv.sound; save(); sfx.coin(); }, 'snd');
  g.globalAlpha = 0.85; text('FAN REMAKE - ORIGINAL BY ITS CREATORS', W / 2, 150, 'white', 'center', 0.85); g.globalAlpha = 1;
}
function titleUpdate() {
  if (pressed.has('sel')) { sv.sound = !sv.sound; save(); sfx.coin(); }
  if (pressed.has('a')) { newRun(false); sfx.buy(); }
}

function closeBtn() {
  const cx = W - 22, cy = 24, hv = hovered(W - 34, 12, 24, 24) || (pointer[0] >= W - 34 && pointer[0] < W - 10 && pointer[1] >= 12 && pointer[1] < 36);
  g.save(); g.fillStyle = '#0a0a10'; g.beginPath(); g.arc(cx, cy, 9.6, 0, Math.PI * 2); g.fill();
  g.lineWidth = 1.2; g.strokeStyle = hv ? '#ffe27a' : '#F5A623'; g.setLineDash([2, 1.2]); g.beginPath(); g.arc(cx, cy, 9.6, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.lineWidth = 2.4; g.lineCap = 'round'; g.strokeStyle = '#ffcf3d'; g.beginPath(); g.moveTo(cx - 4, cy - 4); g.lineTo(cx + 4, cy + 4); g.moveTo(cx + 4, cy - 4); g.lineTo(cx - 4, cy + 4); g.stroke(); g.restore();
  region(W - 34, 12, 24, 24, leaveShop, 'close');
}
function leaveShop() { state = prevScreen; sfx.step(); }
const cardX = i => 24 + (i % 6) * 36, cardY = i => 34 + Math.floor(i / 6) * 56;
function buySkin(i) {
  if (sv.owned >> i & 1) { sv.equipped = i; sfx.buy(); save(); return; }
  const price = skinPrice();
  if (sv.coins >= price) { sv.coins -= price; sv.owned |= 1 << i; sv.equipped = i; sfx.buy(); save(); } else sfx.bad();
}
function drawWard() {
  drawBackdrop(); drawHUD(false); panel(8, 16, W - 16, 136); text('WARDROBE', W / 2, 21, 'cyan', 'center'); closeBtn();
  for (let i = 0; i < NSKIN; i++) {
    const x = cardX(i), y = cardY(i), owned = sv.owned >> i & 1, sel = i === wardSel;
    box(x, y, 32, 32, { r: 4, fill: sel ? '#15262c' : '#1a1316', stroke: sel ? '#2FD4EA' : owned ? '#F5C53D' : null, dash: true, lw: 0.9 });
    g.save(); g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.ellipse(x + 16, y + 26, 12, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.translate(x + 16, y + 14 + (sel ? Math.sin(frame / 12) : 0)); g.imageSmoothingEnabled = true; drawSkinVec(g, i, 26); g.restore(); g.imageSmoothingEnabled = false;
    if (!owned) { const price = skinPrice(); box(x + 0.5, y + 34.5, 31, 11, { r: 4.5, fill: '#0a090d', stroke: '#F5C53D', lw: 1 }); g.fillStyle = '#F5C53D'; g.beginPath(); g.arc(x + 6.5, y + 40, 3.2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0a090d'; g.beginPath(); g.arc(x + 6.5, y + 40, 1.4, 0, Math.PI * 2); g.fill(); text(price, x + 11.5, y + 37, sv.coins >= price ? 'gold' : 'red', 'left', 0.75); }
    else { box(x + 4.5, y + 34.5, 23, 11, { r: 4.5, fill: '#0a090d', stroke: sv.equipped === i ? '#2FD4EA' : '#6a7080', lw: 0.9 }); text(sv.equipped === i ? 'ON' : 'OWN', x + 16, y + 37, sv.equipped === i ? 'cyan' : 'white', 'center', 0.75); }
    region(x, y, 32, 44, () => { wardSel = i; buySkin(i); }, 'c' + i);
    if (hovered(x, y, 32, 44)) wardSel = i;
  }
}
function wardUpdate() {
  if (pressed.has('b') || pressed.has('start')) leaveShop();
}
function buyUpgrade(i) {
  if (i < 2) { const lv = i === 0 ? sv.magnetLv : sv.shieldLv; if (sv.coins >= 50 && lv < 30) { sv.coins -= 50; if (i === 0) sv.magnetLv++; else sv.shieldLv++; sfx.buy(); save(); } else sfx.bad(); }
  else if (sv.gems >= 50 && livesMax() < MAX_LIVES) { sv.gems -= 50; sv.extraLives++; lives = livesMax(); sfx.buy(); save(); } else sfx.bad();
}
function drawUpg() {
  drawBackdrop(); drawHUD(false); panel(8, 16, W - 16, 136); text('SHOP OF UPGRADES', W / 2, 21, 'cyan', 'center'); closeBtn();
  const names = ["MONK'S MAGNET", "WARLOCK'S SHIELD", 'LIVES'], icons = ['magnet', 'shield', 'bigheart'], rings = ['ring_gold', 'ring_cyan', 'ring_red'];
  for (let i = 0; i < 3; i++) {
    const y = 38 + i * 36;
    spr(rings[i], 0, 14, y); spr(icons[i], 0, 22, y + 8);
    text(names[i], 52, y + 4, 'gold', 'left', 0.9);
    if (i < 2) { text('TIME:', 52, y + 14, 'white'); text(i === 0 ? magnetSecs() : shieldSecs(), 92, y + 14, 'cyan'); text('SECS', 116, y + 14, 'white'); }
    else { text('AMOUNT:', 52, y + 14, 'white'); text(livesMax(), 116, y + 14, 'cyan'); }
    const bx = W - 82, sel = upgSel === i, afford = i < 2 ? sv.coins >= 50 : (sv.gems >= 50 && livesMax() < MAX_LIVES);
    box(bx, y, 64, 32, { r: 5, fill: sel ? '#0b161a' : '#0c0b09', stroke: sel ? '#2FD4EA' : '#F5C53D', dash: true, lw: 1.1 });
    text(i < 2 ? '+2 SEC' : '+1 UP', bx + 32, y + 6, 'gold', 'center'); spr(i < 2 ? 'coin' : 'gem', i < 2 ? (frame >> 3) & 3 : (frame >> 4) & 1, bx + 14, y + 19); text('50', bx + 26, y + 18, afford ? (i < 2 ? 'gold' : 'cyan') : 'red');
    region(bx, y, 64, 32, () => { upgSel = i; buyUpgrade(i); }, 'u' + i);
    if (hovered(bx, y, 64, 32)) upgSel = i;
  }
}
function upgUpdate() {
  if (pressed.has('b') || pressed.has('start')) leaveShop();
}

// ------------------------------------------------------------------ point shop (spend the score points you earn)
const PERKS = [
  { id: 'lucky', name: 'LUCKY CHARM', max: 5, cost: l => 300 * (l + 1), desc: l => 'POWER-UPS +' + 3 * l + '%', icon: 'star' },
  { id: 'coinB', name: 'COIN BOOST', max: 3, cost: l => 500 * (l + 1), desc: l => 'COINS WORTH ' + (1 + l), icon: 'coin' },
  { id: 'headStart', name: 'HEAD START', max: 4, cost: l => 300 * (l + 1), desc: l => 'SHIELD ' + 5 * l + 'S', icon: 'shield' },
  { id: 'wind', name: 'SECOND WIND', max: 1, cost: () => 1500, desc: l => 'REVIVE ONCE', icon: 'bigheart' },
];
function buyPerk(i) {
  const p = PERKS[i], l = sv[p.id] | 0;
  if (l >= p.max) { sfx.bad(); return; }
  const c = p.cost(l);
  if (sv.points >= c) { sv.points -= c; sv[p.id] = l + 1; sfx.buy(); save(); } else sfx.bad();
}
function drawPts() {
  drawBackdrop(); drawHUD(false); panel(8, 16, W - 16, 136); text('POINT SHOP', W / 2, 20, 'cyan', 'center'); closeBtn();
  text('YOUR POINTS ' + sv.points, W / 2, 30, 'gold', 'center', 0.9);
  PERKS.forEach((p, i) => {
    const y = 42 + i * 27, l = sv[p.id] | 0, maxed = l >= p.max, c = maxed ? 0 : p.cost(l), afford = !maxed && sv.points >= c, sel = ptsSel === i;
    g.save(); g.fillStyle = '#0b0b10'; g.beginPath(); g.arc(28, y + 11, 11.5, 0, TAU); g.fill(); g.lineWidth = 1.3; g.strokeStyle = '#F5C53D'; g.setLineDash([2.4, 1.2]); g.beginPath(); g.arc(28, y + 11, 11.5, 0, TAU); g.stroke(); g.restore();
    g.save(); g.translate(28, y + 11); if (p.icon === 'coin') { g.scale(1.5, 1.5); spr('coin', 0, -4, -4); } else { g.scale(0.8, 0.8); spr(p.icon, 0, -8, -8); } g.restore();
    text(p.name, 46, y + 2, 'gold'); text(l + '/' + p.max + ' ' + p.desc(l), 46, y + 12, 'white', 'left', 0.75);
    const bx = W - 86; box(bx, y, 70, 23, { r: 5, fill: sel ? '#0b161a' : '#0c0b09', stroke: sel ? '#2FD4EA' : maxed ? '#6a7080' : '#F5C53D', dash: true, lw: 1.1 });
    if (maxed) text('MAX', bx + 35, y + 8, 'cyan', 'center'); else { spr('star', 0, bx + 4, y + 3); g.save(); g.translate(bx + 4, y + 3); g.restore(); text(c, bx + 22, y + 8, afford ? 'gold' : 'red', 'left', 0.9); }
    region(bx, y, 70, 23, () => { ptsSel = i; buyPerk(i); }, 'k' + i); if (hovered(bx, y, 70, 23)) ptsSel = i;
  });
}
function ptsUpdate() { if (pressed.has('b') || pressed.has('start')) leaveShop(); }
const pauseItems = ['RESUME', 'WARDROBE', 'UPGRADES', 'POINT SHOP', 'QUIT'];
function pauseAccept() {
  if (pauseSel === 0) state = 'play';
  else if (pauseSel === 1) { prevScreen = 'pause'; state = 'ward'; wardSel = sv.equipped; }
  else if (pauseSel === 2) { prevScreen = 'pause'; state = 'upg'; upgSel = 0; }
  else if (pauseSel === 3) { prevScreen = 'pause'; state = 'pts'; ptsSel = 0; }
  else { save(); state = 'title'; menuSel = 0; }
  sfx.step();
}
function drawPause() {
  drawWorld(); drawHUD(); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, W, H);
  const px = W / 2 - 64; panel(px, 28, 128, 106); text('PAUSED', W / 2, 35, 'cyan', 'center');
  pauseItems.forEach((it, i) => { const y = 51 + i * 15; text(it, px + 36, y, pauseSel === i ? 'white' : 'gold'); if (pauseSel === i) text('>', px + 22 + ((frame >> 4) & 1), y, 'red');
    region(px + 16, y - 3, 96, 14, () => { pauseSel = i; pauseAccept(); }, 'p' + i); if (hovered(px + 16, y - 3, 96, 14)) pauseSel = i; });
}
function pauseUpdate() {
  if (pressed.has('start') || pressed.has('b')) state = 'play';
}
function drawOver() {
  drawWorld(); drawHUD(); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, H);
  const px = W / 2 - 80; panel(px, 34, 160, 94);
  text('GAME OVER', W / 2, 42, 'red', 'center');
  text('STAGE', px + 16, 62, 'white'); text(stage, px + 144, 62, 'cyan', 'right');
  text('SCORE', px + 16, 72, 'white'); text(score, px + 144, 72, 'cyan', 'right');
  text('BEST', px + 16, 82, 'white'); text(sv.best, px + 144, 82, 'cyan', 'right');
  text('A: TRY AGAIN', px + 16, 100, 'gold'); text('B: MAIN MENU', px + 16, 110, 'gold');
  region(px + 8, 97, 144, 11, () => newRun(false)); region(px + 8, 108, 144, 11, () => { state = 'title'; menuSel = 0; });
}
function overUpdate() { overT++; if (overT > 20) { if (pressed.has('a')) newRun(false); if (pressed.has('b')) { state = 'title'; menuSel = 0; } } }

// ------------------------------------------------------------------ loop
function glow(x, y, r, color, a) {
  const gr = sctx.createRadialGradient(x * SC, y * SC, 0, x * SC, y * SC, r * SC); gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0));
  sctx.fillStyle = gr; sctx.fillRect(0, 0, W * SC, H * SC);
}
function render() {
  hot.length = 0;
  const sx = shake > 0 ? (Math.random() - 0.5) * shake / SC : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake / SC : 0;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#050308'; g.fillRect(0, 0, W * SC, H * SC);
  g.setTransform(SC, 0, 0, SC, sx * SC, sy * SC); g.imageSmoothingEnabled = false;
  if (state === 'title') { drawTitle(); drawHUD(false); }
  else if (state === 'play') { drawWorld(); drawHUD(); playBanner(); }
  else if (state === 'pause') drawPause();
  else if (state === 'ward') drawWard();
  else if (state === 'upg') drawUpg();
  else if (state === 'pts') drawPts();
  else if (state === 'over') drawOver();
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (flash > 0) { sctx.fillStyle = 'rgba(255,255,255,' + flash + ')'; sctx.fillRect(0, 0, W * SC, H * SC); }
  if (fade > 0) { sctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, fade) + ')'; sctx.fillRect(0, 0, W * SC, H * SC); }
}
function tick() {
  frame++; try { pollPad(); } catch (e) {}
  if (document.hidden && state === 'play') { prevScreen = 'play'; state = 'pause'; }
  if (state === 'title') titleUpdate(); else if (state === 'play') playUpdate(); else if (state === 'pause') pauseUpdate(); else if (state === 'ward') wardUpdate(); else if (state === 'upg') upgUpdate(); else if (state === 'pts') ptsUpdate(); else if (state === 'over') overUpdate();
  if (pressed.has('sel') && state !== 'title') { sv.sound = !sv.sound; save(); }
  if (state !== 'play' && state !== 'pause') { /* keep world alive for backdrops */ }
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.life--; } parts = parts.filter(p => p.life > 0);
  for (const t of texts) t.t--; texts = texts.filter(t => t.t > 0);
  if (shake > 0) shake -= 1; if (flash > 0) flash = Math.max(0, flash - 0.03);
  if (fadeDir < 0) { fade -= 0.06; if (fade <= 0) { fade = 0; fadeDir = 0; } }
  else if (fadeDir > 0) { fade += 0.06; if (fade >= 1) { fade = 1; fadeDir = -1; if (fadeNext) { fadeNext(); fadeNext = null; } } }
  pressed.clear();
}
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  requestAnimationFrame(loop);                     // schedule first so one bad frame can never freeze the game
  try { while (acc >= 1000 / 60) { tick(); acc -= 1000 / 60; } render(); } catch (e) { acc = 0; console.error('Tower of Destiny error:', e); }
  pointerMoved = false;
}
fade = 0; fadeDir = 0; stageSetup();
requestAnimationFrame(loop);
window.__game = { get state() { return state; }, get stage() { return stage; }, sv, newRun, debugStage(n) { stage = n; stageSetup(); state = 'play'; fade = 0; fadeDir = 0; }, give(type, x, y) { addPick(x, y, type, false); }, get mobs() { return mobs.map(m => m.kind); }, get picks() { return picks.map(p => p.type); } };
})();
