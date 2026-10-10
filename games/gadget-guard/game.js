// GADGET GUARD - a toon tower defense: build gadgets, upgrade them, and stop the robots from reaching your core.
import { THREE, V3, $, DEBUG, S, GFX, GFX_PREF, QL, camera, renderer, scene, W, VIEW, resize, rnd, clamp, lerp, TAU, load, save, hex, burst, ring, beam, updateFX, clearFX, audioInit, setVolume, sfx, adaptRes, setTheme, aimSun, FX, disposeObj } from './core.js?v=10';
import { CELL, MAPS, THEMES, DIFFS, TURRETS, TURRET_IDS, ENEMIES, TOTAL_WAVES, hpMul, waveBonus, waveDef, TUNE } from './data.js?v=10';
import { buildWorld, turretModel, enemyModel, makeCore, makePortal, HEAD_Y } from './models.js?v=10';

const CFG = { map: load('map', 'meadow'), diff: load('diff', 'normal'), mode: load('mode', 'waves'), auto: load('auto', false) };
if (!MAPS.some(m => m.id === CFG.map)) CFG.map = 'meadow'; if (!DIFFS[CFG.diff]) CFG.diff = 'normal'; if (!['waves', 'endless'].includes(CFG.mode)) CFG.mode = 'waves';
const MODE_NAME = { waves: '30 Waves', endless: 'Endless' }, TARGETS = ['first', 'last', 'strong', 'close'], TARGET_NAME = { first: 'FIRST', last: 'LAST', strong: 'STRONGEST', close: 'CLOSEST' };
const SPEEDS = [1, 2, 3], STRIKE_CD = 40, SELL = .7;
let state = 'menu', G = null;
const cam = { zoom: 1, px: 0, pz: 0, pitch: 58 * Math.PI / 180, shake: 0, dist: 100, cx: 0, cz: 0 };
const mapDef = id => MAPS.find(m => m.id === id);

// ================================================================== paths
function makePaths(map) {
  return map.paths.map(p => { const pts = p.map(([c, r]) => ({ x: (c + .5) * CELL, z: (r + .5) * CELL })), cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)); return { pts, cum, len: cum[cum.length - 1] }; });
}
function posAt(path, d, out) {
  d = clamp(d, 0, path.len); let i = 1; while (i < path.cum.length - 1 && path.cum[i] < d) i++;
  const a = path.pts[i - 1], b = path.pts[i], seg = path.cum[i] - path.cum[i - 1], t = seg > 0 ? (d - path.cum[i - 1]) / seg : 0;
  out.x = lerp(a.x, b.x, t); out.z = lerp(a.z, b.z, t); out.dx = seg > 0 ? (b.x - a.x) / seg : 0; out.dz = seg > 0 ? (b.z - a.z) / seg : 1; return out;
}
const _p = { x: 0, z: 0, dx: 0, dz: 1 };

// ================================================================== a game
function newGame(mapId, diffId, mode) {
  endGameCleanup(); const map = mapDef(mapId), th = THEMES[map.theme], D = DIFFS[diffId];
  const world = buildWorld(map); scene.add(world.group); setTheme(th); aimSun(map.cols * CELL / 2, map.rows * CELL / 2, Math.max(map.cols, map.rows) * CELL * .62);
  const paths = makePaths(map), coreCell = world.core, core = makeCore(); core.group.position.set((coreCell[0] + .5) * CELL, 0, (coreCell[1] + .5) * CELL); core.group.scale.setScalar(1.0); scene.add(core.group);
  const portals = map.paths.map(p => { const pt = makePortal(), a = p[0], b = p[1]; pt.group.position.set((a[0] + .5) * CELL, 0, (a[1] + .5) * CELL); pt.group.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2; scene.add(pt.group); return pt; });
  // markers: the selected cell, the hovered cell, range rings and the airstrike target
  const mark = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.9, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xffd34e, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false })); mark.rotation.x = -Math.PI / 2; mark.visible = false; scene.add(mark);
  const hov = new THREE.Mesh(new THREE.PlaneGeometry(CELL - .4, CELL - .4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .28, depthWrite: false })); hov.rotation.x = -Math.PI / 2; hov.position.y = .05; hov.visible = false; scene.add(hov);
  const rng = new THREE.Mesh(new THREE.RingGeometry(.985, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false })); rng.rotation.x = -Math.PI / 2; rng.position.y = .12; rng.visible = false; scene.add(rng);
  const rngFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .1, depthWrite: false })); rngFill.rotation.x = -Math.PI / 2; rngFill.position.y = .1; rngFill.visible = false; scene.add(rngFill);
  const bars = makeBars();
  G = { map, th, D, diffId, mode, world, paths, core, portals, mark, hov, rng, rngFill, bars, turrets: [], grid: new Map(), enemies: [], projs: [], spawnQ: [], live: {}, wave: 0, lives: D.lives, maxLives: D.lives, gold: D.gold, goldEarned: 0, kills: 0, built: 0, leaked: 0, time: 0, speed: 1, over: false, sel: null, hover: null, strikeCD: 0, aiming: false, strikeQ: [], pool: {}, autoT: 0, ended: false, flashCore: 0, killSfx: 0, nextId: 1 };
  fitCamera(true); uiDirty = true; lastHud = {}; clearFloaters(); showPanel();
}
function endGameCleanup() {
  if (!G) return; for (const o of [G.world.group, G.core.group, G.mark, G.hov, G.rng, G.rngFill, G.bars.bg, G.bars.fill, ...G.portals.map(p => p.group), ...G.turrets.map(t => t.model.group), ...G.enemies.map(e => e.m.group), ...G.projs.map(p => p.m)]) { scene.remove(o); }
  disposeObj(G.world.group); for (const t of G.turrets) disposeTurretMesh(t); clearFX(); G = null;
}
function disposeTurretMesh(t) { scene.remove(t.model.group); }

// ---------------------------------------------------------------- camera
function fitCamera(reset) {
  if (!G) return; const w = innerWidth, H = innerHeight; VIEW.top = ($('topbar').offsetHeight || 0) + 4; VIEW.bottom = ($('panel').offsetHeight || 0) + 10; resize();
  const map = G.map, Wd = map.cols * CELL, Dd = map.rows * CELL, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), aspect = w / H, reg = Math.max(60, H - VIEW.top - VIEW.bottom) / H;
  const dW = (Wd / 2 * 1.03) / (tan * aspect), dD = (Dd * Math.sin(cam.pitch) * 1.03 + 2) / (2 * tan * reg);
  cam.dist = Math.max(dW, dD) * 1.05; cam.cx = Wd / 2; cam.cz = Dd / 2; if (reset) { cam.zoom = 1; cam.px = cam.pz = 0; }
}
function placeCamera(dt) {
  if (!G) return; cam.shake = Math.max(0, cam.shake - dt * 3); const d = cam.dist / cam.zoom, tx = cam.cx + cam.px, tz = cam.cz + cam.pz;
  camera.position.set(tx + (Math.random() - .5) * cam.shake, Math.sin(cam.pitch) * d + (Math.random() - .5) * cam.shake, tz + Math.cos(cam.pitch) * d); camera.lookAt(tx, 0, tz);
}
addEventListener('resize', () => { if (G) fitCamera(false); });

// ---------------------------------------------------------------- hp bars: two instanced quads that always face the camera
function makeBars() {
  const geo = new THREE.PlaneGeometry(1, 1), N = 220, bg = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x120a24, depthWrite: false, depthTest: false, transparent: true, opacity: .75 }), N), fill = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, depthTest: false, transparent: true }), N); fill.renderOrder = 6;
  for (const m of [bg, fill]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.renderOrder = m.renderOrder || 5; scene.add(m); } fill.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); return { bg, fill, N };
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _r = new THREE.Vector3(), _c = new THREE.Color();
function updateBars() {
  const b = G.bars; let n = 0; _r.set(1, 0, 0).applyQuaternion(camera.quaternion);
  for (const e of G.enemies) {
    if (n >= b.N) break; if (e.hp >= e.maxhp * .999 && e.type !== 'boss') continue; const f = clamp(e.hp / e.maxhp, 0, 1), w = e.type === 'boss' ? 6 : e.type === 'tank' ? 3.2 : 2.3, h = e.type === 'boss' ? .55 : .36, y = e.y + e.E.bar;
    _q.copy(camera.quaternion); _s.set(w + .12, h + .12, 1); _v.set(e.x, y, e.z); b.bg.setMatrixAt(n, _m.compose(_v, _q, _s));
    _s.set(Math.max(.001, w * f), h, 1); _v.set(e.x, y, e.z).addScaledVector(_r, -w * (1 - f) / 2); b.fill.setMatrixAt(n, _m.compose(_v, _q, _s));
    _c.setHSL(f * .33, .9, .5); b.fill.setColorAt(n, _c); n++;
  }
  b.bg.count = b.fill.count = n; b.bg.instanceMatrix.needsUpdate = b.fill.instanceMatrix.needsUpdate = true; if (n) b.fill.instanceColor.needsUpdate = true;
}

// ================================================================== building, upgrading, selling
const key = (c, r) => c + ',' + r;
const cellOf = (x, z) => ({ c: Math.floor(x / CELL), r: Math.floor(z / CELL) });
const inMap = (c, r) => c >= 0 && r >= 0 && c < G.map.cols && r < G.map.rows;
const buildable = (c, r) => inMap(c, r) && !G.world.path.has(key(c, r)) && !G.world.blocked.has(key(c, r)) && !G.grid.has(key(c, r));
function stats(t) {
  const T = TURRETS[t.id], i = t.level - 1, b = 1 + t.buff; const range = T.range[i] * CELL, o = { range, buffed: t.buff > 0 };
  if (T.dmg) { o.dmg = T.dmg[i] * b; o.rate = T.rate[i] * b; o.dps = o.dmg * o.rate; }
  if (t.id === 'boom') o.splash = T.splash[i] * CELL; if (t.id === 'frost') { o.slow = T.slow[i]; o.slowT = T.slowT[i]; } if (t.id === 'tesla') o.chain = T.chain[i]; if (t.id === 'boost') o.buff = T.buff[i];
  return o;
}
function recomputeBuffs() {
  for (const t of G.turrets) t.buff = 0;
  for (const b of G.turrets) { if (b.id !== 'boost') continue; const T = TURRETS.boost, i = b.level - 1, rg = T.range[i] * CELL + .5; for (const t of G.turrets) { if (t === b || t.id === 'boost') continue; if (Math.hypot(t.x - b.x, t.z - b.z) <= rg) t.buff = Math.min(1.2, t.buff + T.buff[i] * (t.buff > 0 ? .6 : 1)); } }
}
function build(id, c, r) {
  const T = TURRETS[id]; if (!G || G.over || !T) return false; if (!buildable(c, r)) { sfx('error'); return false; }
  if (G.gold < T.cost) { sfx('error'); toast('NOT ENOUGH GOLD', 'You need ' + T.cost, 900); return false; }
  G.gold -= T.cost; const model = turretModel(id, 1), x = (c + .5) * CELL, z = (r + .5) * CELL; model.group.position.set(x, 0, z); model.group.scale.setScalar(.01); scene.add(model.group);
  const t = { id, level: 1, c, r, x, z, cd: .3, target: 'first', spent: T.cost, model, buff: 0, yaw: rnd(0, TAU), grow: 0, id2: G.nextId++ }; if (id === 'rail') t.target = 'strong'; G.turrets.push(t); G.grid.set(key(c, r), t); G.built++;
  recomputeBuffs(); sfx('build'); burst(new V3(x, .6, z), T.col, 10, 5, .2, .5, 12, 2); ring(new V3(x, .15, z), T.col, 3, .35); G.sel = { c, r }; uiDirty = true; showPanel(); return true;
}
function upgrade(t) {
  const T = TURRETS[t.id]; if (!t || t.level >= 4 || G.over) return false; const cost = T.up[t.level - 1]; if (G.gold < cost) { sfx('error'); toast('NOT ENOUGH GOLD', 'Upgrade costs ' + cost, 900); return false; }
  G.gold -= cost; t.spent += cost; t.level++; t.model.setLevel(t.level); t.grow = .4; recomputeBuffs(); sfx('upgrade'); burst(new V3(t.x, 2, t.z), 0xffd34e, 14, 6, .22, .6, 10, 3); ring(new V3(t.x, .15, t.z), 0xffd34e, 3.4, .4); uiDirty = true; showPanel(); return true;
}
function sell(t) {
  if (!t || G.over) return; const g = Math.floor(t.spent * SELL); G.gold += g; G.grid.delete(key(t.c, t.r)); G.turrets.splice(G.turrets.indexOf(t), 1); scene.remove(t.model.group); recomputeBuffs(); sfx('sell');
  burst(new V3(t.x, 1, t.z), 0xffe14a, 12, 5, .2, .6, 12, 3); floater(t.x, 3, t.z, '+' + g, 'gold'); G.sel = { c: t.c, r: t.r }; uiDirty = true; showPanel();
}

// ================================================================== waves
function startWave(early) {
  if (!G || G.over) return false; if (G.mode === 'waves' && G.wave >= TOTAL_WAVES) return false;
  if (early && anyAlive()) { const b = 8 + G.wave; G.gold += b; floater(G.core.group.position.x, 6, G.core.group.position.z, 'EARLY +' + b, 'gold'); }
  G.wave++; const def = waveDef(G.wave); G.live[G.wave] = def.count; G.autoT = 0; let nPath = 0;
  for (const g of def.groups) for (let i = 0; i < g.count; i++) G.spawnQ.push({ at: G.time + g.at + i * g.gap, type: g.type, wave: G.wave, path: ENEMIES[g.type].air ? -1 : (nPath++) % G.paths.length, i });
  G.spawnQ.sort((a, b) => a.at - b.at); sfx(def.boss ? 'boss' : 'wave'); toast(def.label, def.boss ? 'A MEGA BOT is coming!' : def.kinds.filter((k, i, a) => a.indexOf(k) === i).map(k => ENEMIES[k].name + 's').join(', '), 1500); uiDirty = true; return true;
}
const anyAlive = () => G.enemies.length > 0 || G.spawnQ.length > 0;
function airPath(from) { const a = G.paths[from % G.paths.length].pts[0], b = G.core.group.position; const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); return { pts: [{ x: a.x, z: a.z }, { x: b.x, z: b.z }], cum: [0, len], len }; }
function spawnEnemy(type, wave, pathIdx, d0 = 0, from = 0) {
  const E = ENEMIES[type], D = G.D; const path = pathIdx < 0 ? airPath(from) : G.paths[pathIdx];
  let hp = (type === 'boss' ? TUNE.boss * Math.pow(Math.max(1, wave) / 10, 1.35) * D.hp : E.hp * hpMul(wave) * D.hp) * (G.map.tough || 1); const lat = type === 'boss' ? 0 : rnd(-.9, .9);
  const m = (G.pool[type] || (G.pool[type] = [])).pop() || enemyModel(type); scene.add(m.group); m.group.scale.setScalar(E.sc || 1); m.ice.visible = false;
  const e = { type, E, m, path, d: d0, hp, maxhp: hp, slowT: 0, slowK: 0, stunT: 0, wave, lat, flash: 0, x: 0, z: 0, y: 0, dead: false, healT: rnd(0, .5), spawnT: 4, air: !!E.air, ph: rnd(0, TAU), sp: E.speed * (type === 'boss' ? 1 : rnd(.94, 1.06)), id: G.nextId++ };
  G.enemies.push(e); placeEnemy(e, 0); if (type === 'boss') { burst(new V3(e.x, 2, e.z), 0xff4a5a, 24, 9, .3, .8, 8, 3); ring(new V3(e.x, .2, e.z), 0xff4a5a, 7, .6); } return e;
}
function placeEnemy(e, dt) {
  posAt(e.path, e.d, _p); e.x = _p.x - _p.dz * e.lat; e.z = _p.z + _p.dx * e.lat; e.y = e.air ? 2.2 + Math.sin(W.time * 3 + e.ph) * .35 : 0; const g = e.m.group;
  g.position.set(e.x, e.y, e.z); const tgt = Math.atan2(_p.dx, _p.dz); let df = tgt - g.rotation.y; while (df > Math.PI) df -= TAU; while (df < -Math.PI) df += TAU; g.rotation.y += df * Math.min(1, dt * 10 + (dt === 0 ? 1 : 0));
  if (e.type !== 'flyer') g.position.y += Math.abs(Math.sin(W.time * 9 + e.ph)) * .08 * (e.type === 'tank' || e.type === 'boss' ? .3 : 1);
}
function killEnemy(e) {
  if (e.dead) return; e.dead = true; const E = e.E, rw = Math.max(1, Math.round(E.reward * (1 + e.wave * .012) * G.D.reward)); G.gold += rw; G.goldEarned += rw; G.kills++;
  burst(new V3(e.x, 1.4 + e.y, e.z), E.col, e.type === 'boss' ? 36 : e.type === 'tank' ? 16 : 8, e.type === 'boss' ? 11 : 6, e.type === 'boss' ? .4 : .24, .8, 14, 3); burst(new V3(e.x, 1.4 + e.y, e.z), 0xffffff, 3, 5, .16, .6, 12, 3);
  if (e.type === 'boss') { ring(new V3(e.x, .2, e.z), 0xffd34e, 9, .7); sfx('boom'); cam.shake = Math.max(cam.shake, 1.2); toast('MEGA BOT DOWN!', '+' + rw + ' gold', 1500); } else sfx('kill');
  if (e.type !== 'swarm' || Math.random() < .35) floater(e.x, 3.2 + e.y, e.z, '+' + rw, 'gold'); removeEnemy(e); settle(e.wave); uiDirty = true;
}
function removeEnemy(e) { const i = G.enemies.indexOf(e); if (i >= 0) G.enemies.splice(i, 1); scene.remove(e.m.group); e.m.ice.visible = false; (G.pool[e.type] || (G.pool[e.type] = [])).push(e.m); }
function settle(w) {   // one robot of wave w is gone: is the wave finished?
  G.live[w]--; if (G.live[w] > 0) return; delete G.live[w]; if (G.over) return;
  const b = waveBonus(w); G.gold += b; G.goldEarned += b; sfx('clear'); toast('WAVE ' + w + ' CLEARED', '+' + b + ' gold', 1300); floater(G.core.group.position.x, 7, G.core.group.position.z, '+' + b, 'gold');
  if (G.mode === 'waves' && w >= TOTAL_WAVES && !anyAlive()) finish(true);
}
function leak(e) {
  if (e.dead) return; e.dead = true; G.lives = Math.max(0, G.lives - e.E.leak); G.leaked += e.E.leak; G.flashCore = .6; cam.shake = Math.max(cam.shake, .8); sfx('leak');
  burst(new V3(e.x, 2, e.z), 0xff4a5a, 14, 7, .26, .7, 12, 3); toast('-' + e.E.leak + (e.E.leak > 1 ? ' LIVES' : ' LIFE'), '', 700); removeEnemy(e); settle(e.wave); uiDirty = true; if (G.lives <= 0) finish(false);
}

// ================================================================== combat
function damage(e, dmg, o = {}) {
  if (e.dead) return; const eff = Math.max(dmg * .2, dmg - e.E.armor * (1 - (o.pen || 0))); e.hp -= eff; e.flash = .12;
  if (o.slow) { e.slowK = e.slowT > 0 ? Math.max(e.slowK, o.slow) : o.slow; e.slowT = Math.max(e.slowT, o.slowT || 1.5); } if (o.stun) e.stunT = Math.max(e.stunT, o.stun);
  if (e.hp <= 0) killEnemy(e);
}
function pickTarget(t, range, mode) {
  let best = null, bs = -1e9; const T = TURRETS[t.id], r2 = range * range;
  for (const e of G.enemies) {
    if (e.dead || (e.air && !T.air) || (!e.air && false)) continue; const dx = e.x - t.x, dz = e.z - t.z, d2 = dx * dx + dz * dz; if (d2 > (range + e.E.r * .6) * (range + e.E.r * .6)) continue;
    let s = mode === 'first' ? e.d : mode === 'last' ? -e.d : mode === 'strong' ? e.hp : -d2; if (t.id === 'frost') s += e.slowT > .4 ? -5000 : 0; if (s > bs) { bs = s; best = e; }
  }
  return best;
}
function muzzle(t, out) { const f = { pop: 1.9, boom: 2.3, rail: 3.3, frost: 0, tesla: 0 }[t.id] || 0, h = { pop: 1.8, boom: 2.0, rail: 1.85, frost: 2.8, tesla: 3.4 }[t.id] || 2; out.set(t.x + Math.sin(t.yaw) * f, h, t.z + Math.cos(t.yaw) * f); return out; }
const _mz = new V3(), _tg = new V3(), _tg2 = new V3();
function bulletMat(col) { return bulletMats[col] || (bulletMats[col] = new THREE.MeshBasicMaterial({ color: col })); } const bulletMats = {};
const bulletGeo = new THREE.SphereGeometry(.28, 8, 6), shellGeo = new THREE.SphereGeometry(.55, 10, 8), shellMat = new THREE.MeshBasicMaterial({ color: 0x3a2a18 });
function fire(t, e, st) {
  muzzle(t, _mz); const T = TURRETS[t.id];
  if (t.id === 'pop' || t.id === 'frost') {
    const m = new THREE.Mesh(bulletGeo, bulletMat(t.id === 'pop' ? 0xffe14a : 0x8ae8ff)); m.position.copy(_mz); m.scale.setScalar(t.id === 'frost' ? 1.3 : 1); scene.add(m);
    G.projs.push({ m, kind: t.id, x: _mz.x, y: _mz.y, z: _mz.z, tx: e.x, ty: e.y + 1.4, tz: e.z, target: e, speed: t.id === 'pop' ? 44 : 34, dmg: st.dmg, slow: st.slow, slowT: st.slowT, lvl: t.level }); sfx(t.id === 'pop' ? 'pop' : 'frost');
  } else if (t.id === 'boom') {
    const dist = Math.hypot(e.x - t.x, e.z - t.z), tt = clamp(dist / 20, .35, 1.4); let px = e.x, pz = e.z; if (!e.stunT) { const d2 = e.d + e.sp * (1 - (e.slowT > 0 ? e.slowK : 0)) * tt; posAt(e.path, Math.min(d2, e.path.len), _p); px = _p.x - _p.dz * e.lat; pz = _p.z + _p.dx * e.lat; }
    const m = new THREE.Mesh(shellGeo, shellMat); m.position.copy(_mz); scene.add(m); G.projs.push({ m, kind: 'boom', x0: _mz.x, y0: _mz.y, z0: _mz.z, x: _mz.x, y: _mz.y, z: _mz.z, tx: px, tz: pz, t: 0, dur: tt, dmg: st.dmg, splash: st.splash, lvl: t.level }); sfx('shell');
  } else if (t.id === 'rail') {
    _tg.set(e.x, e.y + 1.4, e.z); const dir = _tg2.subVectors(_tg, _mz).normalize(); const far = _tg.clone().addScaledVector(dir, t.level >= 4 ? 18 : 1.5); beam(_mz, far, 0xcfa8ff, .55, .22); beam(_mz, far, 0xffffff, .22, .14); sfx('rail');
    damage(e, st.dmg, { pen: .75 }); if (t.level >= 4) { let n = 0; for (const o of G.enemies.slice()) { if (o === e || o.dead || (o.air && false)) continue; const ax = o.x - _mz.x, az = o.z - _mz.z, bx = _tg.x - _mz.x, bz = _tg.z - _mz.z, len2 = bx * bx + bz * bz, k = (ax * bx + az * bz) / len2; if (k < 0 || k > 4) continue; const px = _mz.x + bx * k - o.x, pz = _mz.z + bz * k - o.z; if (px * px + pz * pz < 2.2) { damage(o, st.dmg * .6, { pen: .75 }); if (++n >= 3) break; } } }
    burst(_tg, 0xcfa8ff, 5, 5, .18, .4, 6, 1);
  } else if (t.id === 'tesla') {
    const hit = new Set([e]); let cur = e, from = _mz.clone(), dmg = st.dmg; const jump = 1.9 * CELL;
    for (let i = 0; i < st.chain && cur; i++) {
      _tg.set(cur.x, cur.y + 1.4, cur.z); lightning(from, _tg); damage(cur, dmg, { pen: .3 }); burst(_tg, 0xffe14a, 3, 4, .16, .35, 6, 1); from = _tg.clone(); dmg *= .85;
      let nx = null, nd = jump * jump; for (const o of G.enemies) { if (hit.has(o) || o.dead) continue; const dx = o.x - cur.x, dz = o.z - cur.z, d2 = dx * dx + dz * dz; if (d2 < nd) { nd = d2; nx = o; } } if (nx) hit.add(nx); cur = nx;
    }
    ring(new V3(t.x, 3.2, t.z), 0xffe14a, 1.6, .2); sfx('zap');
  }
}
function lightning(a, b) {   // a jagged bolt made of a few short beams
  const n = 3; let prev = a.clone(); for (let i = 1; i <= n; i++) { const k = i / n, p = new V3().lerpVectors(a, b, k); if (i < n) { p.x += rnd(-.7, .7); p.y += rnd(-.5, .5); p.z += rnd(-.7, .7); } beam(prev, p, i % 2 ? 0xfff6a0 : 0xffffff, .22, .16); prev = p; }
}
function updateProj(p, dt) {
  if (p.kind === 'boom') {
    p.t += dt; const k = Math.min(1, p.t / p.dur); p.x = lerp(p.x0, p.tx, k); p.z = lerp(p.z0, p.tz, k); p.y = lerp(p.y0, .3, k) + Math.sin(k * Math.PI) * 7; p.m.position.set(p.x, p.y, p.z);
    if (k >= 1) { explode(p.tx, p.tz, p.splash, p.dmg); return true; } return false;
  }
  if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y + 1.4; p.tz = p.target.z; }
  const dx = p.tx - p.x, dy = p.ty - p.y, dz = p.tz - p.z, d = Math.hypot(dx, dy, dz), mv = p.speed * dt;
  if (d <= mv + .5) {
    if (p.target && !p.target.dead) { const st = p.slow ? { slow: p.slow, slowT: p.slowT, stun: p.lvl >= 4 && Math.random() < .18 ? .8 : 0 } : {}; damage(p.target, p.dmg, st); if (p.kind === 'frost') ring(new V3(p.tx, p.ty, p.tz), 0x8ae8ff, 1.6, .25); burst(new V3(p.tx, p.ty, p.tz), p.kind === 'pop' ? 0xffe14a : 0x8ae8ff, 2, 3, .14, .3, 6, 1); } return true;
  }
  p.x += dx / d * mv; p.y += dy / d * mv; p.z += dz / d * mv; p.m.position.set(p.x, p.y, p.z); return false;
}
function explode(x, z, r, dmg) {
  sfx('boom'); burst(new V3(x, .8, z), 0xff8a2a, 14, 8, .3, .6, 12, 4); burst(new V3(x, .8, z), 0xffe14a, 6, 6, .2, .5, 10, 3); ring(new V3(x, .2, z), 0xff8a2a, r * .9, .35); beam(new V3(x, .3, z), new V3(x, 4, z), 0xffe9a0, r * .6, .18);
  for (const e of G.enemies.slice()) { if (e.dead || e.air) continue; const d = Math.hypot(e.x - x, e.z - z); if (d <= r + e.E.r * .5) damage(e, dmg * (1 - .4 * clamp(d / r, 0, 1)), { pen: .4 }); }
}
function updateTurrets(dt) {
  for (const t of G.turrets) {
    t.appear = Math.min(1, (t.appear || 0) + dt * 5); if (t.grow > 0) t.grow = Math.max(0, t.grow - dt); const ap = 1 - Math.pow(1 - t.appear, 3); t.model.group.scale.setScalar(Math.max(.01, 1.15 * ap * (t.grow > 0 ? 1 + Math.sin(t.grow / .4 * Math.PI) * .22 : 1)));
    if (t.id === 'boost') { t.model.head.rotation.y += dt * 1.5; continue; }
    const st = stats(t); t.cd -= dt; const tg = pickTarget(t, st.range, t.target);
    if (tg) { const want = Math.atan2(tg.x - t.x, tg.z - t.z); let df = want - t.yaw; while (df > Math.PI) df -= TAU; while (df < -Math.PI) df += TAU; t.yaw += df * Math.min(1, dt * 14); if (t.id !== 'tesla' && t.id !== 'frost') t.model.head.rotation.y = t.yaw; else t.model.head.rotation.y += dt * 2;
      if (t.cd <= 0 && (Math.abs(df) * (1 - Math.min(1, dt * 14)) < .3 || t.id === 'tesla' || t.id === 'frost')) { fire(t, tg, st); t.cd = 1 / st.rate; t.kick = .12; } }
    else if (t.id === 'tesla' || t.id === 'frost') t.model.head.rotation.y += dt * .6;
    if (t.kick > 0) { t.kick -= dt; t.model.hm.position.z = -Math.max(0, t.kick) * 3; } else t.model.hm.position.z = 0;
  }
}
function updateEnemies(dt) {
  for (const e of G.enemies.slice()) {
    if (e.dead) continue; e.slowT = Math.max(0, e.slowT - dt); e.stunT = Math.max(0, e.stunT - dt); e.flash = Math.max(0, e.flash - dt);
    const sp = e.stunT > 0 ? 0 : e.sp * (e.slowT > 0 ? 1 - e.slowK : 1); e.d += sp * dt; e.m.ice.visible = e.slowT > 0 || e.stunT > 0; if (e.m.rotor) e.m.rotor.rotation.y += dt * 30;
    if (e.d >= e.path.len) { placeEnemy(e, dt); leak(e); continue; }
    placeEnemy(e, dt); e.m.group.scale.setScalar((e.E.sc || 1) * (1 + e.flash * 1.4));
    if (e.type === 'healer') { e.healT -= dt; if (e.healT <= 0) { e.healT = .5; for (const o of G.enemies) if (!o.dead && o !== e && o.hp < o.maxhp && Math.hypot(o.x - e.x, o.z - e.z) < 7) { o.hp = Math.min(o.maxhp, o.hp + o.maxhp * .045); } ring(new V3(e.x, .3, e.z), 0x4aff8a, 3.2, .4); } }
    if (e.type === 'boss') { e.spawnT -= dt; if (e.spawnT <= 0) { e.spawnT = 4.5; G.live[e.wave] += 2; for (let i = 0; i < 2; i++) spawnEnemy('grunt', e.wave, G.paths.indexOf(e.path) >= 0 ? G.paths.indexOf(e.path) : 0, Math.max(0, e.d - 2 - i * 1.6)); burst(new V3(e.x, 2, e.z), 0xff4a5a, 8, 5, .2, .5, 8, 2); } }
  }
}
function updateSpawns() {
  while (G.spawnQ.length && G.spawnQ[0].at <= G.time) { const s = G.spawnQ.shift(); const pidx = s.path; spawnEnemy(s.type, s.wave, pidx, 0, s.i); }
}
function updateStrikes(dt) {
  G.strikeCD = Math.max(0, G.strikeCD - dt);
  for (let i = G.strikeQ.length - 1; i >= 0; i--) { const s = G.strikeQ[i]; s.t -= dt; if (s.t <= 0) { G.strikeQ.splice(i, 1); const dmg = 140 + 14 * Math.max(1, G.wave), r = 2.6 * CELL; explode2(s.x, s.z, r, dmg); } }
}
function explode2(x, z, r, dmg) {
  sfx('boom'); cam.shake = Math.max(cam.shake, .6); burst(new V3(x, .8, z), 0xff8a2a, 26, 11, .36, .8, 12, 5); burst(new V3(x, .8, z), 0xffffff, 10, 8, .24, .6, 10, 4); ring(new V3(x, .2, z), 0xffe14a, r, .5); ring(new V3(x, .2, z), 0xff6a2a, r * .7, .4);
  for (const e of G.enemies.slice()) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.z - z); if (d <= r + e.E.r * .5) damage(e, dmg, { pen: .8 }); }
}
function strike(x, z) {
  if (!G || G.strikeCD > 0 || G.over) return false; G.strikeCD = STRIKE_CD; G.aiming = false; G.strikeQ.push({ x, z, t: .7 }); sfx('strike'); for (let i = 0; i < 3; i++) beam(new V3(x + rnd(-1, 1), 30, z + rnd(-1, 1)), new V3(x, .2, z), 0xffe9a0, .35, .7); G.rng.visible = G.rngFill.visible = false; uiDirty = true; return true;
}

// ================================================================== finishing a game
function finish(win) {
  if (!G || G.over) return; G.over = true; state = 'over'; W.state = 'over'; sfx(win ? 'win' : 'lose'); const frac = G.lives / G.maxLives, stars = win ? (frac >= .85 ? 3 : frac >= .5 ? 2 : 1) : 0, reached = win ? G.wave : Math.max(0, G.wave - 1);
  const k = 'best.' + G.map.id + '.' + G.diffId + '.' + G.mode, prev = load(k, { wave: 0, stars: 0 }), nb = { wave: Math.max(prev.wave, reached), stars: Math.max(prev.stars, stars) }; save(k, nb);
  $('resT').textContent = win ? 'YOU WIN!' : 'CORE DESTROYED'; $('resT').style.color = win ? '#ffd34e' : '#ff7a8a'; $('resStars').textContent = win ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('resS').innerHTML = (win ? 'You held off all <b>' + TOTAL_WAVES + '</b> waves!' : 'You reached <b>wave ' + G.wave + '</b>' + (G.mode === 'endless' ? ' in Endless mode' : ' of ' + TOTAL_WAVES) + '.') + (nb.wave > prev.wave || (win && nb.stars > prev.stars) ? ' <span class="nb">New best!</span>' : '');
  $('resStats').innerHTML = `<div><b>${G.kills}</b>robots stopped</div><div><b>${G.goldEarned}</b>gold earned</div><div><b>${G.built}</b>gadgets built</div><div><b>${G.lives}/${G.maxLives}</b>lives left</div>`;
  setTimeout(() => { if (state === 'over') $('results').classList.remove('hide'); }, win ? 900 : 1200); hidePanel();
}

// ================================================================== the loop
function simStep(dt) {
  G.time += dt; updateSpawns(); updateEnemies(dt); updateTurrets(dt); for (let i = G.projs.length - 1; i >= 0; i--) { if (updateProj(G.projs[i], dt)) { scene.remove(G.projs[i].m); G.projs.splice(i, 1); } } updateStrikes(dt);
  if (CFG.auto && !G.over && !anyAlive() && G.wave < (G.mode === 'waves' ? TOTAL_WAVES : 1e9) && G.wave > 0) { G.autoT += dt; if (G.autoT > 6) startWave(false); }
}
function step(dt) {
  W.time += dt; updateFX(dt);
  if (G && (state === 'play' || state === 'over')) {
    const total = state === 'play' ? dt * G.speed : dt; let n = Math.max(1, Math.ceil(total / .034)); for (let i = 0; i < n; i++) if (state === 'play' || !G.over) simStep(total / n);
    const cp = G.core, g = G.flashCore; G.flashCore = Math.max(0, G.flashCore - dt); cp.glow.scale.setScalar(1 + Math.sin(W.time * 3) * .08 + g * .6); cp.glow.position.y = 6.4 + Math.sin(W.time * 2) * .25; cp.glow.rotation.y += dt * 1.6; cp.glow.material.color.setHex(g > 0 ? 0xff6a6a : 0xfff2a0); cp.halo.scale.setScalar(1 + Math.sin(W.time * 2) * .06); cp.group.rotation.y += dt * .3;
    for (const p of G.portals) { p.ring.rotation.z += dt * 1.2; p.disc.scale.setScalar(1 + Math.sin(W.time * 4) * .05); }
    placeCamera(dt); updateBars(); updateMarkers(dt); updateHud(dt);
  } else if (state === 'menu') { menuCam(dt); }
}
function menuCam(dt) { if (!G) return; const a = W.time * .05, d = cam.dist * .9; camera.position.set(cam.cx + Math.sin(a) * d * .55, d * .62, cam.cz + Math.cos(a) * d * .75); camera.lookAt(cam.cx, 0, cam.cz); }
let last = performance.now(), fpsN = 0, fpsT = 0, fpsTxt = '';
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; if (state !== 'pause') step(dt); renderer.render(scene, camera); adaptRes(raw, state === 'play'); fpsTick(raw); requestAnimationFrame(loop); }

// ================================================================== markers, floaters, toasts
function updateMarkers(dt) {
  const mk = G.mark, s = G.sel; if (s && state === 'play') { mk.visible = true; mk.position.set((s.c + .5) * CELL, .14, (s.r + .5) * CELL); mk.scale.setScalar(1 + Math.sin(W.time * 6) * .06); } else mk.visible = false;
  const h = G.hover; G.hov.visible = !!h && state === 'play' && inMap(h.c, h.r) && !G.aiming; if (G.hov.visible) { G.hov.position.set((h.c + .5) * CELL, .06, (h.r + .5) * CELL); G.hov.material.color.setHex(buildable(h.c, h.r) ? 0xaaffaa : 0xffffff); G.hov.material.opacity = buildable(h.c, h.r) ? .35 : .12; }
  if (G.aiming && h) { showRange(h.c * CELL + CELL / 2, h.r * CELL + CELL / 2, 2.6 * CELL, 0xff8a2a); }
}
function showRange(x, z, r, col = 0xffffff) { for (const m of [G.rng, G.rngFill]) { m.visible = true; m.position.x = x; m.position.z = z; m.scale.set(r, r, 1); m.material.color.setHex(col); } }
function hideRange() { G.rng.visible = G.rngFill.visible = false; }
const floatEl = $('floaters'); let floatN = 0;
function floater(x, y, z, text, cls = '') {
  if (floatN > 26 || !G) return; _v.set(x, y, z).project(camera); if (_v.z > 1) return; const d = document.createElement('div'); d.className = 'fl ' + cls; d.textContent = text; d.style.left = ((_v.x * .5 + .5) * innerWidth) + 'px'; d.style.top = ((-_v.y * .5 + .5) * innerHeight) + 'px'; floatEl.appendChild(d); floatN++; setTimeout(() => { d.remove(); floatN--; }, 950);
}
function clearFloaters() { floatEl.innerHTML = ''; floatN = 0; }
let toastT = 0; function toast(a, b = '', ms = 1200) { $('toastA').textContent = a; $('toastB').textContent = b; const t = $('toast'); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

// ================================================================== HUD + panel
let uiDirty = true, lastHud = {}; const setT = (id, t) => { if (lastHud[id] !== t) { lastHud[id] = t; $(id).textContent = t; } };
function updateHud(dt) {
  setT('lives', String(G.lives)); setT('gold', String(Math.floor(G.gold))); setT('waveN', (G.wave || 0) + (G.mode === 'waves' ? ' / ' + TOTAL_WAVES : '')); setT('foes', String(G.enemies.length + G.spawnQ.length));
  const all = G.mode === 'waves' && G.wave >= TOTAL_WAVES; const lbl = all ? 'LAST WAVE' : G.wave === 0 ? 'START WAVE 1' : 'NEXT WAVE ' + (G.wave + 1); setT('nextT', lbl); $('nextBtn').disabled = all || G.over; $('nextBtn').classList.toggle('pulse', !anyAlive() && !all && state === 'play');
  if (!all && lastHud.preview !== G.wave) { lastHud.preview = G.wave; const nxt = waveDef(G.wave + 1); $('nextInfo').innerHTML = (nxt.boss ? '<em>BOSS</em>' : '') + [...new Set(nxt.kinds)].map(k => `<i class="e e-${k}" title="${ENEMIES[k].name}"></i>`).join('') + `<span>${nxt.count} robots</span>`; }
  const ab = $('abil'), cd = G.strikeCD; setT('abilT', cd > 0 ? Math.ceil(cd) + 's' : 'AIRSTRIKE'); ab.disabled = cd > 0 || G.over; ab.classList.toggle('on', G.aiming);
  if (uiDirty || lastHud.goldC !== Math.floor(G.gold)) { lastHud.goldC = Math.floor(G.gold); uiDirty = false; refreshAfford(); }
  $('speedBtn').textContent = G.speed + 'x'; $('autoBtn').classList.toggle('on', CFG.auto);
}
function showPanel() {
  if (!G) return; const s = G.sel, t = s && G.grid.get(key(s.c, s.r)), pb = $('panelBuild'), pt = $('panelTurret'), ph = $('panelHint'); lastHud.panel = null;
  pb.classList.add('hide'); pt.classList.add('hide'); ph.classList.add('hide'); hideRange();
  if (t) { pt.classList.remove('hide'); fillTurretPanel(t); const st = stats(t); showRange(t.x, t.z, st.range, TURRETS[t.id].col); }
  else if (s && buildable(s.c, s.r)) { pb.classList.remove('hide'); refreshAfford(); }
  else ph.classList.remove('hide');
  setTimeout(() => fitCamera(false), 0);
}
function hidePanel() { if (G) { G.sel = null; showPanel(); } }
function refreshAfford() {
  if (!G) return; for (const b of document.querySelectorAll('#panelBuild .tcard')) b.classList.toggle('poor', G.gold < TURRETS[b.dataset.id].cost);
  const s = G.sel, t = s && G.grid.get(key(s.c, s.r)); if (t) { const T = TURRETS[t.id], up = $('upBtn'); if (t.level < 4) up.classList.toggle('poor', G.gold < T.up[t.level - 1]); }
}
function fillTurretPanel(t) {
  const T = TURRETS[t.id], st = stats(t), up = t.level < 4 ? T.up[t.level - 1] : 0, nx = t.level < 4 ? statsAt(t, t.level + 1) : null;
  $('tpName').innerHTML = `<i style="background:${hex(T.col)}"></i>${T.name} <span class="lv">${'★'.repeat(t.level)}${'☆'.repeat(4 - t.level)}</span>`;
  const row = (k, v, n) => `<div><small>${k}</small><b>${v}</b>${n ? `<u>${n}</u>` : ''}</div>`, f1 = v => (Math.round(v * 10) / 10).toString();
  let h = ''; if (t.id === 'boost') h = row('BOOST', '+' + Math.round(st.buff * 100) + '%', nx ? '+' + Math.round(nx.buff * 100) + '%' : '') + row('RANGE', f1(st.range / CELL), nx ? f1(nx.range / CELL) : '');
  else { h = row('DAMAGE', f1(st.dmg), nx ? f1(nx.dmg) : '') + row('SHOTS/S', f1(st.rate), nx ? f1(nx.rate) : '') + row('RANGE', f1(st.range / CELL), nx ? f1(nx.range / CELL) : '') + row('DPS', Math.round(st.dps), nx ? Math.round(nx.dps) : ''); if (t.id === 'tesla') h += row('CHAIN', st.chain, nx ? nx.chain : ''); if (t.id === 'boom') h += row('SPLASH', f1(st.splash / CELL), nx ? f1(nx.splash / CELL) : ''); if (t.id === 'frost') h += row('SLOW', Math.round(st.slow * 100) + '%', nx ? Math.round(nx.slow * 100) + '%' : ''); }
  $('tpStats').innerHTML = h; $('upBtn').innerHTML = t.level >= 4 ? 'MAX LEVEL' : `UPGRADE <span class="coin"></span>${up}`; $('upBtn').disabled = t.level >= 4; $('upBtn').classList.toggle('poor', t.level < 4 && G.gold < up);
  $('sellBtn').innerHTML = `SELL <span class="coin"></span>${Math.floor(t.spent * SELL)}`; $('tgtBtn').textContent = t.id === 'boost' ? '' : 'TARGET: ' + TARGET_NAME[t.target]; $('tgtBtn').style.display = t.id === 'boost' ? 'none' : '';
}
function statsAt(t, lv) { const o = t.level; t.level = lv; const s = stats(t); t.level = o; return s; }
function buildPanel() {
  const root = $('cards'); root.innerHTML = '';
  for (const id of TURRET_IDS) { const T = TURRETS[id], b = document.createElement('button'); b.className = 'tcard'; b.dataset.id = id; b.innerHTML = `<i style="background:${hex(T.col)}"></i><b>${T.name}</b><span class="price"><span class="coin"></span>${T.cost}</span><em>${T.desc}</em>`;
    b.onclick = () => { audioInit(); if (G.sel) build(id, G.sel.c, G.sel.r); }; b.onmouseenter = () => { if (G && G.sel) showRange((G.sel.c + .5) * CELL, (G.sel.r + .5) * CELL, TURRETS[id].range[0] * CELL, T.col); $('tinfo').textContent = T.name + ': ' + T.desc; }; b.onmouseleave = () => { if (G && G.sel) hideRange(); $('tinfo').textContent = ''; }; root.appendChild(b); }
}

// ================================================================== input: tap to select, drag to pan, pinch / wheel to zoom
const cv = $('view'), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ptrs = new Map(); let drag = null, pinch = null;
function pickCell(cx, cy) { ray.setFromCamera({ x: cx / innerWidth * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, camera); return ray.ray.intersectPlane(plane, hit) ? { c: Math.floor(hit.x / CELL), r: Math.floor(hit.z / CELL), x: hit.x, z: hit.z } : null; }
cv.addEventListener('pointerdown', e => { if (state !== 'play') return; audioInit(); try { cv.setPointerCapture(e.pointerId); } catch (err) {} ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, btn: e.button }; else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom }; if (drag) drag.moved = true; } });
cv.addEventListener('pointermove', e => {
  if (!G) return; if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; cam.zoom = clamp(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, .75, 2.2); clampPan(); return; }
  if (drag && drag.id === e.pointerId) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 9) drag.moved = true; if (drag.moved && state === 'play') { const k = (cam.dist / cam.zoom) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2 / innerHeight; cam.px -= dx * k * 1.05; cam.pz -= dy * k * 1.05 / Math.sin(cam.pitch); clampPan(); } drag.x = e.clientX; drag.y = e.clientY; }
  if (e.pointerType === 'mouse' && state === 'play') G.hover = pickCell(e.clientX, e.clientY);
});
function clampPan() { const mx = G.map.cols * CELL * .45 * (1 - 1 / cam.zoom) + 10, mz = G.map.rows * CELL * .45 * (1 - 1 / cam.zoom) + 10; cam.px = clamp(cam.px, -mx, mx); cam.pz = clamp(cam.pz, -mz, mz); }
const pointerEnd = e => {
  const was = drag && drag.id === e.pointerId ? drag : null; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!was) return; drag = null;
  if (!was.moved && state === 'play' && G) { if (was.btn === 2) { G.aiming = false; G.sel = null; showPanel(); return; } onTap(was.sx, was.sy); }
};
cv.addEventListener('pointerup', pointerEnd); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch = null; drag = null; });
cv.addEventListener('pointerleave', () => { if (G) G.hover = null; });
cv.addEventListener('wheel', e => { if (!G || state !== 'play') return; e.preventDefault(); cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.1 : .91), .75, 2.2); clampPan(); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
function onTap(x, y) {
  const p = pickCell(x, y); if (!p) return; if (G.aiming) { if (inMap(p.c, p.r)) strike(p.x, p.z); return; }
  if (!inMap(p.c, p.r)) { G.sel = null; showPanel(); return; } G.sel = { c: p.c, r: p.r }; sfx('click'); uiDirty = true; showPanel();
}
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return; if (e.code === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); return; } if (state !== 'play' || !G) return;
  const s = G.sel, t = s && G.grid.get(key(s.c, s.r)); const n = e.code.startsWith('Digit') ? +e.code.slice(5) - 1 : -1;
  if (n >= 0 && n < TURRET_IDS.length && s && !t) build(TURRET_IDS[n], s.c, s.r);
  else if (e.code === 'KeyU' && t) upgrade(t); else if ((e.code === 'KeyS' || e.code === 'Delete' || e.code === 'Backspace') && t) sell(t); else if (e.code === 'KeyT' && t) cycleTarget(t);
  else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); startWave(anyAlive()); } else if (e.code === 'KeyF') cycleSpeed(); else if (e.code === 'KeyA') toggleAim(); else if (e.code === 'KeyP') pauseGame();
});
function cycleTarget(t) { t.target = TARGETS[(TARGETS.indexOf(t.target) + 1) % TARGETS.length]; sfx('click'); fillTurretPanel(t); }
function cycleSpeed() { G.speed = SPEEDS[(SPEEDS.indexOf(G.speed) + 1) % SPEEDS.length]; sfx('click'); }
function toggleAim() { if (!G || G.over || G.strikeCD > 0) { sfx('error'); return; } G.aiming = !G.aiming; if (!G.aiming) hideRange(); else { G.sel = null; showPanel(); toast('AIRSTRIKE', 'Tap where it should land', 1200); } sfx('click'); }
function pauseGame() { if (state !== 'play') return; state = 'pause'; W.state = 'pause'; $('pause').classList.remove('hide'); }
function resumeGame() { if (state !== 'pause') return; state = 'play'; W.state = 'play'; $('pause').classList.add('hide'); audioInit(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !DEBUG) pauseGame(); });

// ================================================================== menus
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function previewCanvas(map) {
  const c = document.createElement('canvas'), w = 200, h = Math.round(w * map.rows / map.cols); c.width = w; c.height = h; const g = c.getContext('2d'), th = THEMES[map.theme], s = w / map.cols;
  g.fillStyle = hex(th.ground[0]); g.fillRect(0, 0, w, h); g.fillStyle = hex(th.ground[1]); for (let x = 0; x < map.cols; x++) for (let y = 0; y < map.rows; y++) if ((x + y) & 1) g.fillRect(x * s, y * s, s, s);
  g.strokeStyle = hex(th.path); g.lineWidth = s * .9; g.lineJoin = 'round'; g.lineCap = 'butt'; for (const p of map.paths) { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo((x + .5) * s, (y + .5) * s) : g.moveTo((x + .5) * s, (y + .5) * s)); g.stroke(); }
  const core = map.paths[0][map.paths[0].length - 1]; g.fillStyle = '#2ee6c8'; g.strokeStyle = '#1a1030'; g.lineWidth = 2; g.beginPath(); g.arc((core[0] + .5) * s, (core[1] + .5) * s, s * .8, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#b06bff'; for (const p of map.paths) { g.beginPath(); g.arc((p[0][0] + .5) * s, (p[0][1] + .5) * s, s * .6, 0, TAU); g.fill(); g.stroke(); } return c;
}
function renderMenu() {
  const root = $('menuPickers'); root.innerHTML = '';
  const gm = mk('div', 'grp'); gm.appendChild(mk('h3', '', 'MAP')); const cards = mk('div', 'modes');
  for (const m of MAPS) { const c = mk('button', 'modec map' + (m.id === CFG.map ? ' sel' : '')); c.appendChild(previewCanvas(m)); c.appendChild(mk('b', '', m.name)); c.appendChild(mk('span', '', m.blurb)); const best = load('best.' + m.id + '.' + CFG.diff + '.' + CFG.mode, null); if (best && best.wave) c.appendChild(mk('i', '', 'Best: wave ' + best.wave + (best.stars ? '  ' + '★'.repeat(best.stars) : ''))); c.onclick = () => { CFG.map = m.id; save('map', m.id); sfx('click'); renderMenu(); previewMap(); }; cards.appendChild(c); }
  gm.appendChild(cards); root.appendChild(gm);
  const gd = mk('div', 'grp'); gd.appendChild(mk('h3', '', 'DIFFICULTY')); const rd = mk('div', 'row'); for (const id of Object.keys(DIFFS)) { const D = DIFFS[id], b = mk('button', id === CFG.diff ? 'sel' : '', D.name); b.title = D.lives + ' lives, ' + D.gold + ' starting gold'; b.onclick = () => { CFG.diff = id; save('diff', id); sfx('click'); renderMenu(); }; rd.appendChild(b); } gd.appendChild(rd);
  gd.appendChild(mk('p', 'mdesc', DIFFS[CFG.diff].lives + ' lives, ' + DIFFS[CFG.diff].gold + ' starting gold')); root.appendChild(gd);
  const gmo = mk('div', 'grp'); gmo.appendChild(mk('h3', '', 'MODE')); const rm = mk('div', 'row'); for (const id of ['waves', 'endless']) { const b = mk('button', id === CFG.mode ? 'sel alt' : 'alt', MODE_NAME[id]); b.onclick = () => { CFG.mode = id; save('mode', id); sfx('click'); renderMenu(); }; rm.appendChild(b); } gmo.appendChild(rm); gmo.appendChild(mk('p', 'mdesc', CFG.mode === 'waves' ? 'Survive all ' + TOTAL_WAVES + ' waves (a MEGA BOT shows up at 10, 20 and 30).' : 'The waves never stop. How far can you get?')); root.appendChild(gmo);
  const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
  for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !new URLSearchParams(location.search).get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' : ''); }; rg.appendChild(b); }
  gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (['low', 'med', 'high'].includes(GFX_PREF) ? '' : ' (picked automatically for this computer)') + '.')); root.appendChild(gg);
}
function previewMap() { if (state !== 'menu') return; newGame(CFG.map, CFG.diff, CFG.mode); }   // the menu shows the chosen map slowly spinning behind it
function startGame() {
  audioInit(); newGame(CFG.map, CFG.diff, CFG.mode); for (const id of ['menu', 'pause', 'results']) $(id).classList.add('hide'); $('hud').style.visibility = 'visible'; state = 'play'; W.state = 'play'; hidePanel(); fitCamera(true);
  toast(G.map.name.toUpperCase(), 'Tap a green square to build your first gadget', 2200);
}
function showMenu() { state = 'menu'; W.state = 'menu'; for (const id of ['pause', 'results']) $(id).classList.add('hide'); $('menu').classList.remove('hide'); $('hud').style.visibility = 'hidden'; renderMenu(); newGame(CFG.map, CFG.diff, CFG.mode); }
$('play').onclick = startGame; $('resume').onclick = resumeGame; $('quit').onclick = showMenu; $('menuBtn').onclick = showMenu;
$('restart').onclick = startGame; $('again').onclick = startGame;
$('nextBtn').onclick = () => { audioInit(); if (state === 'play') { if (!startWave(anyAlive())) sfx('error'); } };
$('abil').onclick = () => { audioInit(); if (state === 'play') toggleAim(); };
$('speedBtn').onclick = () => { if (state === 'play' && G) cycleSpeed(); }; $('pauseBtn').onclick = pauseGame;
$('autoBtn').onclick = () => { CFG.auto = !CFG.auto; save('auto', CFG.auto); sfx('click'); };
$('upBtn').onclick = () => { const s = G.sel, t = s && G.grid.get(key(s.c, s.r)); if (t) upgrade(t); }; $('sellBtn').onclick = () => { const s = G.sel, t = s && G.grid.get(key(s.c, s.r)); if (t) sell(t); }; $('tgtBtn').onclick = () => { const s = G.sel, t = s && G.grid.get(key(s.c, s.r)); if (t) cycleTarget(t); };
$('closeBtn').onclick = () => { if (G) { G.sel = null; G.aiming = false; showPanel(); } };
const vol = $('vol'); vol.value = S.vol; vol.oninput = () => { setVolume(+vol.value); save('vol', S.vol); };
buildPanel(); showMenu(); requestAnimationFrame(loop);

if (DEBUG) window.__gg = { TUNE, get G() { return G; }, get state() { return state; }, CFG, cam, step, startGame, newGame, build, upgrade, sell, startWave, strike, spawnEnemy, killEnemy, TURRETS, ENEMIES, MAPS, waveDef, hpMul, stats, buildable, pickCell, camera, renderer, scene, W, onTap, showMenu, finish, key, posAt, fitCamera, anyAlive };
