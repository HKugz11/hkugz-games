// Wiggle Wars: an original worm-arena game for HKugz Games. Canvas 2D, bots only (no online yet).
// Everything is saved in this browser only (localStorage keys start with "ww.").
"use strict";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const ARENA = 3200;            // radius of the playable circle
const CAP = 720;               // most body dots a worm can have
const CELL = 96;               // collision grid cell size
const GW = Math.ceil((ARENA * 2 + 200) / CELL);
const FCELL = 256;             // food grid cell size
const FW = Math.ceil((ARENA * 2 + 200) / FCELL);
const BASE_SPEED = 170, BOOST_SPEED = 305, TURN = 4.1;

// ---------- saved settings
const store = {
  get(k, d) { try { const v = localStorage.getItem("ww." + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("ww." + k, String(v)); } catch (e) {} },
};
const isCros = /CrOS/.test(navigator.userAgent);
let lite = store.get("lite", isCros ? "1" : "0") === "1";
let skinPick = Math.max(0, Math.min(11, parseInt(store.get("skin", "0"), 10) || 0));
let best = parseInt(store.get("best", "0"), 10) || 0;
let playerName = store.get("name", "");

// ---------- skins (colors repeat along the body; "run" = how many dots per color)
const rainbow = []; for (let i = 0; i < 12; i++) rainbow.push(`hsl(${i * 30}, 90%, 58%)`);
const SKINS = [
  { n: "Lime", cols: ["#7be04a", "#68d23a"], run: 3 },
  { n: "Sunny", cols: ["#ffd34e", "#ff9a2a"], run: 3 },
  { n: "Rainbow", cols: rainbow, run: 2 },
  { n: "Candy Cane", cols: ["#e8283a", "#ffffff"], run: 3 },
  { n: "Ocean", cols: ["#2ee6ff", "#2aa8f0", "#3b6cf0", "#2aa8f0"], run: 3 },
  { n: "Bubblegum", cols: ["#ff6fb5", "#ffb3da"], run: 3 },
  { n: "Grape", cols: ["#9a5cff", "#c7a2ff"], run: 3 },
  { n: "Fire", cols: ["#ff3b2a", "#ff6a1a", "#ffa51a", "#ffd34e", "#ffa51a", "#ff6a1a"], run: 2 },
  { n: "Mint", cols: ["#3ee0b0", "#ffffff", "#3ee0b0", "#9af0d8"], run: 2 },
  { n: "Panda", cols: ["#2a2a35", "#2a2a35", "#f4f4f4", "#f4f4f4"], run: 3 },
  { n: "Galaxy", cols: ["#2a2a7a", "#3a3aa0", "#2a2a7a", "#ffd34e"], run: 3 },
  { n: "Holly", cols: ["#d6202c", "#1fa84a"], run: 4 },
];
const skinCol = (sk, i) => { const k = SKINS[sk]; return k.cols[Math.floor(i / k.run) % k.cols.length]; };

// body dot and glow pictures, made once per color
const spriteCache = new Map(), glowCache = new Map();
function sprite(color) {
  let c = spriteCache.get(color);
  if (c) return c;
  c = document.createElement("canvas"); c.width = c.height = 56;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(10,5,40,.55)"; g.beginPath(); g.arc(28, 28, 26, 0, TAU); g.fill();       // dark outline
  g.fillStyle = color; g.beginPath(); g.arc(28, 28, 22.5, 0, TAU); g.fill();
  const hl = g.createRadialGradient(21, 19, 1, 21, 19, 18);                                    // shiny spot
  hl.addColorStop(0, "rgba(255,255,255,.65)"); hl.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hl; g.beginPath(); g.arc(28, 28, 22.5, 0, TAU); g.fill();
  const sh = g.createRadialGradient(34, 38, 4, 30, 32, 26);                                    // soft shade
  sh.addColorStop(0, "rgba(0,0,40,0)"); sh.addColorStop(1, "rgba(0,0,40,.28)");
  g.fillStyle = sh; g.beginPath(); g.arc(28, 28, 22.5, 0, TAU); g.fill();
  spriteCache.set(color, c); return c;
}
function glow(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const rg = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  rg.addColorStop(0, "#fff"); rg.addColorStop(0.25, color); rg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c); return c;
}
const FOOD_COLS = ["#ff5a7a", "#ffd34e", "#5af08a", "#4ad8ff", "#c07aff", "#ff9a3a", "#ffffff", "#8aff3a"];

// ---------- names for the computer worms
const NAMES = ["Noodle", "Zigzag", "Pickles", "Cosmo", "Luna", "Bandit", "DinoDan", "Waffle", "Mr Wiggles", "Pixel", "Turbo", "Sunny", "Jelly", "Captain Sock", "Ziggy", "Biscuit", "Maya", "Taco Tim", "Bubbles", "Blitz", "Sir Squirm", "Ollie", "Comet", "Nacho", "Peanut", "Fuzzy", "Zoom", "Ava_Plays", "Gizmo", "Pogo", "Mochi", "Rocket", "Banjo", "Snickers", "Tilly", "Jax", "Wobbles", "Skye", "Ninja Bean", "Cookie", "Dash", "Pumpkin", "Zane", "Lola", "Frosty", "Moose", "Glitch", "Poppy", "Orbit", "Sparky", "Max", "Daisy", "Hopper", "Kiwi", "Rex", "Echo", "Penny", "Boba", "Tank"];

// ---------- game objects
class Snake {
  constructor(idx) { this.idx = idx; this.xs = new Float32Array(CAP); this.ys = new Float32Array(CAP); this.alive = false; this.n = 0; this.ai = null; this.name = ""; }
  init(name, skin, x, y, ang, mass, ai) {
    this.name = name; this.skin = skin; this.ai = ai; this.ang = ang; this.target = ang; this.mass = mass; this.kills = 0;
    this.alive = true; this.boost = false; this.drop = 0; this.deadT = 0; this.respawn = 0; this.turnIn = 0; this.born = 0;
    this.fixDims(); this.n = this.want();
    for (let i = 0; i < this.n; i++) { this.xs[i] = x - Math.cos(ang) * this.sp * i; this.ys[i] = y - Math.sin(ang) * this.sp * i; }
  }
  fixDims() { this.r = 10 + Math.min(18, Math.sqrt(this.mass) * 0.5); this.sp = this.r * 0.85; }
  want() { return Math.max(8, Math.min(CAP, Math.round((70 + 4 * Math.min(this.mass, 3000)) / this.sp))); }
  get x() { return this.xs[0]; }
  get y() { return this.ys[0]; }
}

let W = 0, H = 0, dpr = 1, sc = 1;
const view = $("view"), ctx = view.getContext("2d");
const mini = $("mini"), mctx = mini.getContext("2d");
let snakes = [], me = null, state = "menu", clock = 0, shake = 0;
let botCount = 22, foodTarget = 1500;
const cells = []; let foodCount = 0;
const cam = { x: 0, y: 0, z: 1, follow: null };
let menuFollowT = 0, lastKiller = null, deathTimer = 0, toastLast = "";

// collision grid for worm bodies (rebuilt each frame)
const MAXN = 40 * CAP;
const gHead = new Int32Array(GW * GW), gNext = new Int32Array(MAXN);
const gS = new Int16Array(MAXN), gX = new Float32Array(MAXN), gY = new Float32Array(MAXN), gR = new Float32Array(MAXN), gHeadFlag = new Uint8Array(MAXN);
let gCount = 0;

function setup() {
  for (let i = 0; i < FW * FW; i++) cells.push([]);
  snakes = [];
  for (let i = 0; i < 40; i++) snakes.push(new Snake(i));
}
const fcell = (x, y) => { const cx = Math.max(0, Math.min(FW - 1, Math.floor((x + ARENA + 100) / FCELL))), cy = Math.max(0, Math.min(FW - 1, Math.floor((y + ARENA + 100) / FCELL))); return cy * FW + cx; };
function addFood(x, y, v, ci, r) {
  const f = { x, y, v, ci, r, ph: Math.random() * TAU, k: 0, i: 0 };
  f.k = fcell(x, y); f.i = cells[f.k].length; cells[f.k].push(f); foodCount++;
}
function removeFood(f) { const a = cells[f.k], last = a.pop(); if (last !== f) { a[f.i] = last; last.i = f.i; } foodCount--; }
function randInArena(m) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * (ARENA - m); return [Math.cos(a) * d, Math.sin(a) * d]; }
function spawnFoodRandom() {          // food comes in little glowing clumps
  const [x, y] = randInArena(80), big = Math.random() < 0.07, ci = (Math.random() * FOOD_COLS.length) | 0, n = big ? 1 : 3 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, d = big ? 0 : Math.random() * 46;
    addFood(x + Math.cos(a) * d, y + Math.sin(a) * d, big ? 3 : 1, big ? ci : (Math.random() < 0.8 ? ci : (Math.random() * FOOD_COLS.length) | 0), big ? 11 : 6 + Math.random() * 2.5);
  }
}

// ---------- worms: spawn, bots
const rnd = (a, b) => a + Math.random() * (b - a);
function newAI() {
  const t = Math.random(), type = t < 0.36 ? "forager" : t < 0.56 ? "hunter" : t < 0.72 ? "circler" : "coward";
  const skill = rnd(0.35, 1);
  return { type, skill, iv: 0.3 - 0.2 * skill, look: 0.7 + 0.5 * skill, aggr: type === "hunter" ? rnd(0.6, 1) : rnd(0.2, 0.5), t: Math.random() * 0.3, wa: Math.random() * TAU, circ: 0, side: Math.random() < 0.5 ? 1 : -1, tgt: null };
}
function freeSpot() {
  let bx = 0, by = 0, bd = -1;
  for (let k = 0; k < 6; k++) {
    const [x, y] = randInArena(300); let md = 1e9;
    for (const s of snakes) if (s.alive) { const d = Math.hypot(s.x - x, s.y - y); if (d < md) md = d; }
    if (md > bd) { bd = md; bx = x; by = y; }
  }
  return [bx, by];
}
function usedNames() { return new Set(snakes.filter((s) => s.alive || s.respawn > 0).map((s) => s.name)); }
function spawnBot(s) {
  const used = usedNames(); let name = NAMES[(Math.random() * NAMES.length) | 0], tries = 0;
  while (used.has(name) && tries++ < 20) name = NAMES[(Math.random() * NAMES.length) | 0];
  const [x, y] = freeSpot(), mass = Math.random() < 0.2 ? rnd(40, 160) : rnd(10, 40);
  s.init(name, (Math.random() * SKINS.length) | 0, x, y, Math.random() * TAU, mass, newAI());
}
function fillBots() {
  let alive = 0;
  for (let i = 1; i < snakes.length; i++) { const s = snakes[i]; if (i <= botCount) { if (s.alive) alive++; } else if (s.alive) { s.alive = false; } }
  for (let i = 1; i <= botCount; i++) { const s = snakes[i]; if (!s.alive && s.respawn <= 0) spawnBot(s); }
}
function startGame() {
  playerName = ($("pname").value || "").replace(/[<>&"]/g, "").trim().slice(0, 14) || "You";
  store.set("name", playerName === "You" ? "" : playerName);
  store.set("skin", skinPick);
  lite = $("lite").checked; store.set("lite", lite ? "1" : "0");
  applyMode();
  for (const s of snakes) { s.alive = false; s.respawn = 0; }
  for (let k = 0; k < FW * FW; k++) cells[k].length = 0;
  foodCount = 0; while (foodCount < foodTarget) spawnFoodRandom();
  me = snakes[0]; const [x, y] = freeSpot();
  me.init(playerName, skinPick, x, y, Math.random() * TAU, 10, null);
  me.born = clock; me.milestone = 0; me.startClock = clock;
  fillBots();
  cam.x = me.x; cam.y = me.y; cam.follow = me; mouse.has = false; keys.l = keys.r = 0; inputMode = "mouse";
  state = "play"; lastKiller = null; deathTimer = 0;
  $("menu").classList.add("hide"); $("dead").classList.add("hide"); $("pause").classList.add("hide"); $("hud").classList.remove("hide");
  $("boostBtn").classList.toggle("hide", !touchMode);
  say(touchMode ? "Drag to steer. Hold BOOST to zoom!" : "Move the mouse to steer. Hold click to boost!", true);
}
function toMenu() {
  state = "menu"; me = null;
  $("menu").classList.remove("hide"); $("dead").classList.add("hide"); $("pause").classList.add("hide"); $("hud").classList.add("hide");
  $("bestN").textContent = best; drawSkinPreviews();
  menuFollowT = 0;
}
function applyMode() {
  botCount = lite ? 14 : 22; foodTarget = lite ? 900 : 1500;
  dpr = lite ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  resize();
  if (state !== "menu" || foodCount === 0) { /* food is topped up in update() */ }
}

// ---------- food and death
function dropFood(s) {
  const n = s.n, step = Math.max(1, Math.ceil(n / 70)), count = Math.ceil(n / step), per = Math.max(1, (s.mass * 0.75) / count);
  for (let i = 0; i < n; i += step) {
    const a = Math.random() * TAU, d = Math.random() * s.r * 0.8;
    addFood(s.xs[i] + Math.cos(a) * d, s.ys[i] + Math.sin(a) * d, per, (Math.random() * 6) | 0, Math.min(15, 6 + per * 1.8));
  }
}
function die(s, killer) {
  if (!s.alive) return;
  s.alive = false; dropFood(s);
  if (killer && killer !== s) { killer.kills++; }
  if (s === me) {
    lastKiller = killer; deathTimer = 1.1; state = "dying"; shake = 0.4;
  } else {
    s.respawn = rnd(2, 5);
    if (killer === me) { say("You got " + s.name + "!", false); }
  }
}

// ---------- input
const mouse = { x: 0, y: 0, has: false, down: false };
const keys = { l: 0, r: 0, boost: false };
let inputMode = "mouse", touchMode = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
let stick = null, boostTouch = false;
function boostWanted() { return mouse.down || keys.boost || boostTouch; }
window.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; if (inputMode !== "mouse") inputMode = "mouse";
});
view.addEventListener("pointerdown", (e) => {
  if (state !== "play") return;
  if (e.pointerType === "touch") {
    touchMode = true; $("boostBtn").classList.remove("hide");
    if (!stick) { stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, a: null }; const el = $("stick"); el.style.left = e.clientX + "px"; el.style.top = e.clientY + "px"; el.classList.remove("hide"); el.firstElementChild.style.transform = ""; inputMode = "touch"; }
  } else if (e.button === 0) { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; inputMode = "mouse"; }
});
view.addEventListener("pointermove", (e) => {
  if (stick && e.pointerId === stick.id) {
    const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, d = Math.hypot(dx, dy);
    if (d > 8) stick.a = Math.atan2(dy, dx);
    const k = Math.min(d, 46) / (d || 1); $("stick").firstElementChild.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  }
});
function endPointer(e) {
  if (stick && e.pointerId === stick.id) { stick = null; $("stick").classList.add("hide"); }
  if (e.pointerType !== "touch" && e.button === 0) mouse.down = false;
}
window.addEventListener("pointerup", endPointer); window.addEventListener("pointercancel", endPointer);
const bb = $("boostBtn");
bb.addEventListener("pointerdown", (e) => { boostTouch = true; bb.classList.add("down"); try { bb.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault(); });
const bbUp = () => { boostTouch = false; bb.classList.remove("down"); };
bb.addEventListener("pointerup", bbUp); bb.addEventListener("pointercancel", bbUp);
bb.addEventListener("contextmenu", (e) => e.preventDefault());
view.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  if (e.target && e.target.tagName === "INPUT" && e.target.type === "text") { if (e.key === "Enter" && state === "menu") startGame(); return; }
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") { keys.l = 1; inputMode = "keys"; e.preventDefault(); }
  else if (k === "arrowright" || k === "d") { keys.r = 1; inputMode = "keys"; e.preventDefault(); }
  else if (k === " " || k === "shift" || k === "w" || k === "arrowup") { keys.boost = true; e.preventDefault(); }
  else if (k === "p" || k === "escape") { if (state === "play") pause(); else if (state === "pause") resume(); }
  else if (k === "enter" && state === "dead") startGame();
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") keys.l = 0; else if (k === "arrowright" || k === "d") keys.r = 0;
  else if (k === " " || k === "shift" || k === "w" || k === "arrowup") keys.boost = false;
});
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") pause(); });
window.addEventListener("blur", () => { keys.l = keys.r = 0; keys.boost = false; mouse.down = false; });
function pause() { state = "pause"; $("pause").classList.remove("hide"); }
function resume() { state = "play"; $("pause").classList.add("hide"); }

// ---------- collision grid
const gcell = (x, y) => { const cx = Math.max(0, Math.min(GW - 1, Math.floor((x + ARENA + 100) / CELL))), cy = Math.max(0, Math.min(GW - 1, Math.floor((y + ARENA + 100) / CELL))); return cy * GW + cx; };
function buildGrid() {
  gHead.fill(-1); gCount = 0;
  for (const s of snakes) {
    if (!s.alive) continue;
    for (let i = 0; i < s.n && gCount < MAXN; i++) {
      const id = gCount++, x = s.xs[i], y = s.ys[i], c = gcell(x, y);
      gS[id] = s.idx; gX[id] = x; gY[id] = y; gR[id] = s.r; gHeadFlag[id] = i === 0 ? 1 : 0;
      gNext[id] = gHead[c]; gHead[c] = id;
    }
  }
}
// is there a worm body (not worm `self`) close to this point? thr = extra room
function blockedAt(x, y, self, myR, extra) {
  if (x * x + y * y > (ARENA - 60) * (ARENA - 60)) return true;
  const cx = Math.floor((x + ARENA + 100) / CELL), cy = Math.floor((y + ARENA + 100) / CELL);
  for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
    if (i < 0 || j < 0 || i >= GW || j >= GW) continue;
    for (let id = gHead[j * GW + i]; id >= 0; id = gNext[id]) {
      if (gS[id] === self) continue;
      const lim = gR[id] * 0.9 + myR * 0.5 + extra, dx = gX[id] - x, dy = gY[id] - y;
      if (dx * dx + dy * dy < lim * lim) return true;
    }
  }
  return false;
}

// ---------- bot brain
function bestFood(s) {
  const cx = Math.floor((s.x + ARENA + 100) / FCELL), cy = Math.floor((s.y + ARENA + 100) / FCELL);
  let best = null, bs = 0;
  for (let j = cy - 3; j <= cy + 3; j++) for (let i = cx - 3; i <= cx + 3; i++) {
    if (i < 0 || j < 0 || i >= FW || j >= FW) continue;
    const a = cells[j * FW + i];
    for (let k = 0; k < a.length; k++) {
      const f = a[k], dx = f.x - s.x, dy = f.y - s.y, d = Math.hypot(dx, dy);
      let diff = Math.atan2(dy, dx) - s.ang; diff = Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff)));
      const sc2 = (f.v * f.v) / (d + 70) * (1.5 - diff / Math.PI);
      if (sc2 > bs) { bs = sc2; best = f; }
    }
  }
  return best;
}
function pickSafe(s, goal, ai) {
  const L = (120 + 6 * s.r) * ai.look, offs = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2, 3.1];
  const ds = [L * 0.3, L * 0.62, L];
  const flip = ai.side;
  for (let o = 0; o < offs.length; o++) {
    const a = goal + offs[o] * flip; let bad = false;
    for (let d = 0; d < 3 && !bad; d++) if (blockedAt(s.x + Math.cos(a) * ds[d], s.y + Math.sin(a) * ds[d], s.idx, s.r, 10)) bad = true;
    if (!bad) return a;
  }
  return goal + 3.1;
}
const angDiff = (a, b) => { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
function think(s, dt) {
  const ai = s.ai; ai.t -= dt; if (ai.t > 0) return;
  ai.t = ai.iv * rnd(0.7, 1.3);
  let goal = s.ang, boost = false, threat = null, td = 1e9, prey = null, pd = 1e9;
  for (const o of snakes) {
    if (o === s || !o.alive) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (o.mass > s.mass * 1.15 && d < td) { td = d; threat = o; }
    if (o.mass < s.mass * 1.5 && d < pd && d < 1100) { pd = d; prey = o; }
  }
  const f = bestFood(s);
  if (f) goal = Math.atan2(f.y - s.y, f.x - s.x);
  else { ai.wa += rnd(-0.5, 0.5); goal = ai.wa; }
  if (Math.hypot(s.x, s.y) > ARENA - 350) goal = Math.atan2(-s.y, -s.x);    // stay away from the wall
  let busy = false;
  if (ai.type === "coward" && threat && td < 650) { goal = Math.atan2(s.y - threat.y, s.x - threat.x) + 0.25 * ai.side; boost = td < 300 && s.mass > 30; busy = true; }
  else if (threat && td < 240 && Math.random() < 0.7) { goal = Math.atan2(s.y - threat.y, s.x - threat.x) + 0.3 * ai.side; busy = true; }
  if (!busy && prey && ai.type === "hunter" && Math.random() < ai.aggr) {
    const dir = Math.atan2(prey.ys[0] - prey.ys[Math.min(3, prey.n - 1)], prey.xs[0] - prey.xs[Math.min(3, prey.n - 1)]);
    const lead = Math.min(pd, 520) * 0.6 + 70;
    goal = Math.atan2(prey.y + Math.sin(dir) * lead - s.y, prey.x + Math.cos(dir) * lead - s.x);
    boost = pd < 520 && Math.abs(angDiff(goal, s.ang)) < 0.5 && s.mass > 30;
  } else if (!busy && ai.type === "circler") {
    let tg = (me && me.alive && me.mass < s.mass * 1.6 && Math.hypot(me.x - s.x, me.y - s.y) < 1500) ? me : (prey && pd < 900 ? prey : null);
    if (tg) {
      if (ai.tgt !== tg) { ai.tgt = tg; ai.circ = 0; }
      ai.circ += ai.t;
      const rad = Math.max(95, 430 - ai.circ * 38), a0 = Math.atan2(s.y - tg.y, s.x - tg.x) + 0.55 * ai.side;
      goal = Math.atan2(tg.y + Math.sin(a0) * rad - s.y, tg.x + Math.cos(a0) * rad - s.x);
      boost = ai.circ < 3 && Math.hypot(tg.x - s.x, tg.y - s.y) > 600 && s.mass > 40;
    } else ai.tgt = null;
  }
  const safe = pickSafe(s, goal, ai);
  if (Math.abs(angDiff(safe, goal)) > 0.2) boost = false;
  if (Math.random() < (1 - ai.skill) * 0.012) s.target = goal; else s.target = safe;   // low skill bots sometimes slip up
  s.boost = boost && s.mass > 25;
  if (s.mass > 2500) s.mass -= 20 * dt;      // very big bots slowly slim down
}

// ---------- simulation
function updateSnake(s, dt) {
  if (s.ai) think(s, dt);
  else {
    if (inputMode === "keys") s.target = s.ang + (keys.r - keys.l) * 1.3;
    else if (inputMode === "touch" && stick && stick.a !== null) s.target = stick.a;
    else if (inputMode === "mouse" && mouse.has) { const hx = W / 2 + (s.x - cam.x) * sc, hy = H / 2 + (s.y - cam.y) * sc; s.target = Math.atan2(mouse.y - hy, mouse.x - hx); }
    s.boost = boostWanted() && s.mass > 12;
  }
  s.fixDims();
  const tr = TURN * (s.ai ? 0.8 + 0.2 * s.ai.skill : 1) / (1 + (s.r - 10) * 0.035);
  const d = angDiff(s.target, s.ang);
  s.ang += Math.max(-tr * dt, Math.min(tr * dt, d));
  let speed = BASE_SPEED * (1 - Math.min(0.14, s.mass / 22000));
  if (s.boost) {
    speed = BOOST_SPEED; s.mass -= 6.5 * dt; s.drop += dt;
    if (s.drop > 0.13) {
      s.drop = 0; const i = s.n - 1;
      addFood(s.xs[i], s.ys[i], 0.8, (Math.random() * 6) | 0, 5.5);
    }
  }
  let x = s.xs[0] + Math.cos(s.ang) * speed * dt, y = s.ys[0] + Math.sin(s.ang) * speed * dt;
  const dist = Math.hypot(x, y), lim = ARENA - s.r;                         // soft wall: slide along the edge
  s.atEdge = false;
  if (dist > lim) {
    const nx = x / dist, ny = y / dist; x = nx * lim; y = ny * lim; s.atEdge = true;
    const out = Math.cos(s.ang) * nx + Math.sin(s.ang) * ny;
    if (out > 0) { const tx = -ny, ty = nx, side = Math.cos(s.ang) * tx + Math.sin(s.ang) * ty >= 0 ? 1 : -1; s.ang = Math.atan2(ty * side, tx * side); }
  }
  s.xs[0] = x; s.ys[0] = y;
  const want = s.want(); if (want > s.n) { for (let i = s.n; i < want; i++) { s.xs[i] = s.xs[s.n - 1]; s.ys[i] = s.ys[s.n - 1]; } } s.n = want;
  const sp = s.sp;
  for (let i = 1; i < s.n; i++) {
    const dx = s.xs[i - 1] - s.xs[i], dy = s.ys[i - 1] - s.ys[i], dd = Math.hypot(dx, dy);
    if (dd > sp) { const k = (dd - sp) / dd; s.xs[i] += dx * k; s.ys[i] += dy * k; }
  }
  // eat food
  const er = s.r * 1.5 + 22, cx = Math.floor((x + ARENA + 100) / FCELL), cy = Math.floor((y + ARENA + 100) / FCELL);
  for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
    if (i < 0 || j < 0 || i >= FW || j >= FW) continue;
    const a = cells[j * FW + i];
    for (let k = a.length - 1; k >= 0; k--) {
      const f = a[k], dx = f.x - x, dy = f.y - y;
      if (dx * dx + dy * dy < er * er) { s.mass += f.v; removeFood(f); if (s === me) eatPop = 1; }
    }
  }
}
let eatPop = 0;

function collisions() {
  const dead = [];
  for (const s of snakes) {
    if (!s.alive || s.born > clock) continue;
    if (s === me && clock - me.startClock < 1.2) continue;                  // tiny safe start
    const x = s.xs[0], y = s.ys[0], cx = Math.floor((x + ARENA + 100) / CELL), cy = Math.floor((y + ARENA + 100) / CELL);
    let hit = -1;
    for (let j = cy - 1; j <= cy + 1 && hit < 0; j++) for (let i = cx - 1; i <= cx + 1 && hit < 0; i++) {
      if (i < 0 || j < 0 || i >= GW || j >= GW) continue;
      for (let id = gHead[j * GW + i]; id >= 0; id = gNext[id]) {
        if (gS[id] === s.idx) continue;
        const o = snakes[gS[id]];
        if (gHeadFlag[id]) {   // head against head: the smaller one pops
          const dx = gX[id] - x, dy = gY[id] - y, lim = (gR[id] + s.r) * 0.75;
          if (dx * dx + dy * dy < lim * lim && s.mass <= o.mass) { hit = gS[id]; break; }
          continue;
        }
        const lim = gR[id] * 0.85 + s.r * 0.45, dx = gX[id] - x, dy = gY[id] - y;
        if (dx * dx + dy * dy < lim * lim) { hit = gS[id]; break; }
      }
    }
    if (hit >= 0) dead.push([s, snakes[hit]]);
  }
  for (const [s, k] of dead) die(s, k);
}

function say(text, big) {
  const d = document.createElement("div"); d.className = "toast" + (big ? " big" : ""); d.textContent = text;
  const box = $("toasts"); box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 2300);
}

function update(dt) {
  clock += dt;
  buildGrid();
  for (const s of snakes) {
    if (s.alive) updateSnake(s, dt);
    else if (s.idx > 0 && s.idx <= botCount && s.respawn > 0) { s.respawn -= dt; if (s.respawn <= 0) spawnBot(s); }
  }
  collisions();
  let n = 0; while (foodCount < foodTarget && n++ < 2) spawnFoodRandom();
  if (me && me.alive) {
    const sc2 = Math.floor(me.mass);
    for (const m of [50, 100, 250, 500, 1000, 2000, 4000]) if (sc2 >= m && me.milestone < m) { me.milestone = m; say("Length " + m + "!", true); }
  }
  if (state === "dying") { deathTimer -= dt; if (deathTimer <= 0) showDead(); }
}
function showDead() {
  state = "dead";
  const len = Math.floor(me.mass), nb = len > best; if (nb) { best = len; store.set("best", best); }
  $("deadBy").innerHTML = ""; const by = document.createElement("span"); by.textContent = "You were eaten by "; const b = document.createElement("b"); b.textContent = lastKiller ? lastKiller.name : "a worm"; $("deadBy").append(by, b);
  $("deadStats").innerHTML = "Your length: <b>" + len + "</b>" + (nb ? ' <span class="nb">NEW BEST!</span>' : "") + "<br>Best length: <b>" + best + "</b><br>Worms popped: <b>" + me.kills + "</b>";
  $("dead").classList.remove("hide"); $("hud").classList.add("hide"); $("bestN").textContent = best;
}

// ---------- drawing
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  view.width = Math.round(W * dpr); view.height = Math.round(H * dpr);
}
function drawWorm(g, s, t) {
  const n = s.n, r = s.r, step = lite ? (r >= 18 ? 3 : 2) : (r >= 18 ? 2 : 1), size = Math.max(r * 2.3, s.sp * step * 1.32);
  const x0 = cam.x - W / 2 / sc - r * 2, x1 = cam.x + W / 2 / sc + r * 2, y0 = cam.y - H / 2 / sc - r * 2, y1 = cam.y + H / 2 / sc + r * 2;
  if (s.boost && !lite) {
    g.globalAlpha = 0.28; const gl = glow(skinCol(s.skin, 0));
    for (let i = 0; i < n; i += 3) { const x = s.xs[i], y = s.ys[i]; if (x < x0 || x > x1 || y < y0 || y > y1) continue; g.drawImage(gl, x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); }
    g.globalAlpha = 1;
  }
  for (let i = n - 1; i >= 1; i -= step) {
    const x = s.xs[i], y = s.ys[i]; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    g.drawImage(sprite(skinCol(s.skin, i)), x - size / 2, y - size / 2, size, size);
  }
  const hx = s.xs[0], hy = s.ys[0], hs = r * 2.45;
  g.drawImage(sprite(skinCol(s.skin, 0)), hx - hs / 2, hy - hs / 2, hs, hs);
  const ca = Math.cos(s.ang), sa = Math.sin(s.ang), ex = r * 0.38, ey = r * 0.5;
  for (const sd of [-1, 1]) {
    const px = hx + ca * ex - sa * ey * sd, py = hy + sa * ex + ca * ey * sd;
    g.fillStyle = "#fff"; g.beginPath(); g.arc(px, py, r * 0.4, 0, TAU); g.fill();
    g.fillStyle = "#1a1030"; g.beginPath(); g.arc(px + ca * r * 0.14, py + sa * r * 0.14, r * 0.21, 0, TAU); g.fill();
  }
  if (hx > x0 && hx < x1 && hy > y0 && hy < y1) {
    g.font = `800 ${Math.max(13, 15 / sc)}px "Trebuchet MS", system-ui, sans-serif`; g.textAlign = "center";
    g.lineWidth = 3 / sc; g.strokeStyle = "rgba(10,5,30,.7)"; g.fillStyle = s === me ? "#ffd34e" : "#fff";
    const ny = hy + r * 1.7 + 8 / sc; g.strokeText(s.name, hx, ny); g.fillText(s.name, hx, ny);
  }
}
function render(t) {
  const g = ctx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#0b0720"; g.fillRect(0, 0, W, H);
  let ox = 0, oy = 0; if (shake > 0) { ox = (Math.random() - 0.5) * 14 * shake; oy = (Math.random() - 0.5) * 14 * shake; }
  g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (W / 2 - cam.x * sc + ox), dpr * (H / 2 - cam.y * sc + oy));
  const x0 = cam.x - W / 2 / sc, x1 = cam.x + W / 2 / sc, y0 = cam.y - H / 2 / sc, y1 = cam.y + H / 2 / sc;
  // floor: a big round arena
  g.fillStyle = "#20166a"; g.beginPath(); g.arc(0, 0, ARENA, 0, TAU); g.fill();
  if (!lite) {
    g.save(); g.beginPath(); g.arc(0, 0, ARENA, 0, TAU); g.clip();
    g.strokeStyle = "rgba(160,140,255,.13)"; g.lineWidth = 2 / sc; g.beginPath();
    const gs = 140;
    for (let x = Math.floor(x0 / gs) * gs; x < x1; x += gs) { g.moveTo(x, y0); g.lineTo(x, y1); }
    for (let y = Math.floor(y0 / gs) * gs; y < y1; y += gs) { g.moveTo(x0, y); g.lineTo(x1, y); }
    g.stroke(); g.restore();
  }
  // candy-cane wall ring just outside the playable circle
  if (Math.hypot(cam.x, cam.y) + Math.hypot(W, H) / 2 / sc > ARENA - 100) {
    g.lineWidth = 34; g.strokeStyle = "#e8283a"; g.beginPath(); g.arc(0, 0, ARENA + 17, 0, TAU); g.stroke();
    g.setLineDash([46, 46]); g.strokeStyle = "#fff"; g.beginPath(); g.arc(0, 0, ARENA + 17, 0, TAU); g.stroke(); g.setLineDash([]);
    if (!lite) { g.lineWidth = 60; g.strokeStyle = "rgba(255,90,120,.18)"; g.beginPath(); g.arc(0, 0, ARENA - 30, 0, TAU); g.stroke(); }
  }
  // food
  const fx0 = Math.max(0, Math.floor((x0 + ARENA + 100) / FCELL) - 1), fx1 = Math.min(FW - 1, Math.floor((x1 + ARENA + 100) / FCELL) + 1);
  const fy0 = Math.max(0, Math.floor((y0 + ARENA + 100) / FCELL) - 1), fy1 = Math.min(FW - 1, Math.floor((y1 + ARENA + 100) / FCELL) + 1);
  for (let j = fy0; j <= fy1; j++) for (let i = fx0; i <= fx1; i++) {
    const a = cells[j * FW + i];
    for (let k = 0; k < a.length; k++) {
      const f = a[k], col = FOOD_COLS[f.ci] || "#fff";
      if (lite) { g.fillStyle = col; g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill(); }
      else { const p = 1 + 0.15 * Math.sin(t * 0.004 + f.ph), sz = f.r * 5.2 * p; g.drawImage(glow(col), f.x - sz / 2, f.y - sz / 2, sz, sz); }
    }
  }
  // worms: small ones first, you on top
  const order = snakes.filter((s) => s.alive).sort((a, b) => a.mass - b.mass);
  for (const s of order) if (s !== me) drawWorm(g, s, t);
  if (me && me.alive) drawWorm(g, me, t);
  // everything outside the arena fades dark
  g.fillStyle = "rgba(6,3,22,.78)"; g.beginPath(); g.rect(x0 - 50, y0 - 50, x1 - x0 + 100, y1 - y0 + 100); g.moveTo(ARENA + 36, 0); g.arc(0, 0, ARENA + 36, 0, TAU, true); g.fill("evenodd");
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function drawMini() {
  const m = mctx, S = mini.width, c = S / 2, k = (S / 2 - 6) / ARENA;
  m.clearRect(0, 0, S, S);
  m.fillStyle = "rgba(60,40,140,.55)"; m.beginPath(); m.arc(c, c, S / 2 - 4, 0, TAU); m.fill();
  for (const s of snakes) {
    if (!s.alive || s === me) continue;
    m.fillStyle = skinCol(s.skin, 0); m.beginPath(); m.arc(c + s.x * k, c + s.y * k, 2 + Math.min(5, Math.sqrt(s.mass) * 0.15), 0, TAU); m.fill();
  }
  if (me && me.alive) {
    m.fillStyle = "#fff"; m.strokeStyle = "#ffd34e"; m.lineWidth = 3; m.beginPath(); m.arc(c + me.x * k, c + me.y * k, 6, 0, TAU); m.fill(); m.stroke();
  }
}
let lbT = 0;
function updateHud() {
  const list = snakes.filter((s) => s.alive).sort((a, b) => b.mass - a.mass);
  let h = "<h4>LEADERBOARD</h4>"; const esc = (s) => s.replace(/[<>&"]/g, "");
  let meRank = -1; list.forEach((s, i) => { if (s === me) meRank = i; });
  for (let i = 0; i < Math.min(10, list.length); i++) { const s = list[i]; h += `<div class="${s === me ? "me" : ""}"><i>${i + 1}</i><span>${esc(s.name)}</span><em>${Math.floor(s.mass)}</em></div>`; }
  if (me && meRank >= 10) h += `<div class="gap">...</div><div class="me"><i>${meRank + 1}</i><span>${esc(me.name)}</span><em>${Math.floor(me.mass)}</em></div>`;
  $("lb").innerHTML = h;
  if (me && me.alive) $("rankT").textContent = "Rank " + (meRank + 1) + " of " + list.length;
}

// ---------- main loop
let last = 0, slow = 0, miniT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (t - last) / 1000); last = t; if (!(dt > 0)) dt = 0.016;
  if (state !== "pause") { update(dt); }
  // camera
  if (state === "menu") {
    menuFollowT -= dt;
    if (menuFollowT <= 0 || !cam.follow || !cam.follow.alive) { const al = snakes.filter((s) => s.alive); cam.follow = al[(Math.random() * al.length) | 0] || null; menuFollowT = 9; }
  } else if (state === "dead" || state === "dying") {
    if (lastKiller && lastKiller.alive) cam.follow = lastKiller; else if (!cam.follow || !cam.follow.alive) { cam.follow = snakes.filter((s) => s.alive).sort((a, b) => b.mass - a.mass)[0] || null; }
  }
  if (cam.follow && cam.follow.alive) {
    const f = cam.follow, k = 1 - Math.pow(0.0005, dt);
    cam.x += (f.x - cam.x) * k * (state === "play" ? 1.6 : 1); cam.y += (f.y - cam.y) * k * (state === "play" ? 1.6 : 1);
    const baseZ = Math.sqrt(W * H) / 800, tz = baseZ * Math.pow(1 + f.mass / 500, -0.3);
    cam.z += (tz - cam.z) * (1 - Math.pow(0.05, dt));
  }
  sc = cam.z || 1;
  shake = Math.max(0, shake - dt);
  render(t);
  if (state === "play" || state === "dying") {
    miniT += dt; if (miniT > 0.05) { miniT = 0; drawMini(); }
    lbT += dt; if (lbT > 0.4) { lbT = 0; updateHud(); }
    if (me) { $("scoreN").textContent = Math.floor(me.mass); $("edge").classList.toggle("on", me.alive && Math.hypot(me.x, me.y) > ARENA - 260); }
  }
  // speed check: switch on Lite graphics by itself when it is too slow
  if (state === "play" && !document.hidden) {
    slow = dt > 1 / 36 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 150 && !lite) { lite = true; $("lite").checked = true; store.set("lite", "1"); applyMode(); say("Lite graphics turned on to keep things smooth", false); slow = 0; }
  }
}

// ---------- menu
function drawSkinPreviews() {
  document.querySelectorAll(".skin").forEach((b, idx) => {
    const c = b.firstElementChild, g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
    const n = 9, r = 11, sp = 11, x0 = 13;
    for (let i = n - 1; i >= 0; i--) g.drawImage(sprite(skinCol(idx, i)), x0 + (n - 1 - i) * sp - r, 15 - r, r * 2.3, r * 2.3);
    const hx = x0 + (n - 1) * sp + 3;
    g.drawImage(sprite(skinCol(idx, 0)), hx - r * 1.2, 15 - r * 1.2 + 0, r * 2.5, r * 2.5);
    for (const sd of [-1, 1]) { g.fillStyle = "#fff"; g.beginPath(); g.arc(hx + 4, 15 + sd * 5.5 + 1, 4, 0, TAU); g.fill(); g.fillStyle = "#1a1030"; g.beginPath(); g.arc(hx + 5.5, 15 + sd * 5.5 + 1, 2.2, 0, TAU); g.fill(); }
    b.classList.toggle("sel", idx === skinPick);
  });
}
function buildMenu() {
  const box = $("skins");
  SKINS.forEach((k, i) => {
    const b = document.createElement("button"); b.className = "skin"; b.type = "button";
    const c = document.createElement("canvas"); c.width = 124; c.height = 30; b.appendChild(c);
    b.appendChild(document.createTextNode(k.n));
    b.addEventListener("click", () => { skinPick = i; store.set("skin", i); drawSkinPreviews(); });
    box.appendChild(b);
  });
  $("pname").value = playerName; $("lite").checked = lite; $("bestN").textContent = best;
  $("play").addEventListener("click", startGame); $("again").addEventListener("click", startGame);
  $("toMenu").addEventListener("click", toMenu); $("resume").addEventListener("click", resume);
  $("quit").addEventListener("click", toMenu);
  $("lite").addEventListener("change", () => { lite = $("lite").checked; store.set("lite", lite ? "1" : "0"); applyMode(); });
  drawSkinPreviews();
}

// ---------- start
setup(); applyMode(); buildMenu();
while (foodCount < foodTarget) spawnFoodRandom();
fillBots();
cam.follow = snakes[1]; cam.x = snakes[1].x; cam.y = snakes[1].y;
window.addEventListener("resize", resize);
window.WW = { get snakes() { return snakes; }, get me() { return me; }, get state() { return state; }, get food() { return foodCount; }, get cam() { return cam; }, get lite() { return lite; }, step(dt) { update(dt); }, render(t) { render(t); }, inp: { mouse, keys } };
requestAnimationFrame((t) => { last = t; frame(t); });
