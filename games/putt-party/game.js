// PUTT PARTY - toon mini golf: nine holes with windmills, bumpers, sand, water, boost strips, sliding walls and pipes. Everybody plays at the same time against computer golfers.
import { THREE, V3, $, DEBUG, S, GFX, GFX_PREF, QL, camera, renderer, scene, W, VIEW, resize, rnd, clamp, lerp, TAU, load, save, hex, burst, ring, updateFX, clearFX, audioInit, setVolume, sfx, adaptRes, setTheme, aimSun, disposeObj } from './core.js?v=8';
import { Course, newBall, stepBall, shoot, simulate, rayFirstHit, DT, BALL_R, CUP_R, MAX_STROKES, EV } from './golf.js?v=8';
import { HOLES, THEMES } from './holes.js?v=8';
import { planShot, DIFFS } from './ai.js?v=8';
import { buildHole } from './scene.js?v=8';

const COLORS = [0xff4fa8, 0x2ee6ff, 0xffd31a, 0x8aff3a, 0xb06bff, 0xff7a1a, 0xffffff, 0x4a6aff];
const BOT_NAMES = ['Birdie', 'Chip', 'Mulligan', 'Putter', 'Eagle', 'Divot', 'Fairway', 'Sandy', 'Tee-Rex', 'Par-ty'];
const CFG = { holes: load('holes', 9), bots: load('bots', 3), diff: load('diff', 'normal'), name: load('name', '') };
if (![3, 6, 9].includes(CFG.holes)) CFG.holes = 9; if (!(CFG.bots >= 0 && CFG.bots <= 3)) CFG.bots = 3; if (!DIFFS[CFG.diff]) CFG.diff = 'normal';
const MAXDRAG = 9, PITCH = 61 * Math.PI / 180;
let state = 'menu', G = null, H3 = null, cam = { dist: 40, cx: 0, cz: 0, zoom: 1, shake: 0, yaw: 0 };
const keys = {}, ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0]);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const scoreName = (strokes, par) => strokes === 1 ? 'HOLE IN ONE!' : strokes - par <= -3 ? 'ALBATROSS!' : strokes - par === -2 ? 'EAGLE!' : strokes - par === -1 ? 'BIRDIE!' : strokes === par ? 'PAR' : strokes - par === 1 ? 'BOGEY' : strokes - par === 2 ? 'DOUBLE BOGEY' : '+' + (strokes - par);

// ================================================================== a round of golf
const ballGeo = new THREE.SphereGeometry(BALL_R, 18, 14); ballGeo.userData.shared = true; const blobGeo = new THREE.CircleGeometry(1, 16); blobGeo.userData.shared = true;
function makePlayer(name, color, human) {
  const mesh = new THREE.Mesh(ballGeo, toonM(color)); mesh.castShadow = QL.shadow > 0; mesh.scale.setScalar(1.35); const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .35, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.scale.setScalar(BALL_R * 1.25);
  const mark = new THREE.Mesh(new THREE.RingGeometry(.55, .72, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false })); mark.rotation.x = -Math.PI / 2; mark.visible = false;
  scene.add(mesh, blob, mark); return { name, color, human, ball: newBall(0, 0), mesh, blob, mark, done: false, score: 0, total: 0, card: [], think: 0, sunkT: 0, waterT: 0, aces: 0 };
}
const toonCache = {}; function toonM(c) { return toonCache[c] || (toonCache[c] = new THREE.MeshToonMaterial({ color: c, gradientMap: gradMap() })); }
let _gm = null; function gradMap() { if (_gm) return _gm; const d = new Uint8Array([90, 150, 210, 255]); _gm = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat); _gm.minFilter = _gm.magFilter = THREE.NearestFilter; _gm.needsUpdate = true; return _gm; }
function startRound() {
  clearRound(); const names = shuffle(BOT_NAMES.slice()), cols = shuffle(COLORS.filter(c => c !== S.color)), players = [makePlayer(CFG.name || 'You', S.color, true)];
  for (let i = 0; i < CFG.bots; i++) { const p = makePlayer(names[i], cols[i], false); p.bot = CFG.diff; players.push(p); }
  G = { players, idx: -1, C: null, t: 0, acc: 0, state: 'play', holes: HOLES.slice(0, CFG.holes), holeT: 0, doneT: 0, me: players[0], over: false };
  buildScoreboard(); $('hud').style.visibility = 'visible'; hideScreens(); state = 'play'; W.state = 'play'; nextHole();
}
function clearRound() { if (G) { for (const p of G.players) { scene.remove(p.mesh, p.blob, p.mark); } G = null; } if (H3) { H3.dispose(); H3 = null; } clearFX(); }
function nextHole() {
  G.idx++; if (G.idx >= G.holes.length) { finishRound(); return; }
  const def = G.holes[G.idx]; if (H3) H3.dispose(); G.C = new Course(def); H3 = buildHole(G.C, def); setTheme(H3.theme); G.t = rnd(0, 6); G.acc = 0; G.state = 'play'; G.holeT = 0; G.doneT = 0; $('card').classList.add('hide');
  for (const p of G.players) { const b = p.ball; Object.assign(b, newBall(def.tee[0], def.tee[1])); p.done = false; p.score = 0; p.sunkT = 0; p.waterT = 0; p.think = rnd(1.2, 3.4); p.mesh.visible = p.blob.visible = true; p.mesh.scale.setScalar(1.35); }
  // little offsets so the balls on the tee do not sit exactly on top of each other
  G.players.forEach((p, i) => { const a = i * 1.7; p.ball.x = def.tee[0] + Math.cos(a) * .28 * (i ? 1 : 0); p.ball.z = def.tee[1] + Math.sin(a) * .28 * (i ? 1 : 0); p.ball.lastX = p.ball.x; p.ball.lastZ = p.ball.z; });
  fitCamera(); cam.cur = null; aimReset(); setT('holeN', 'HOLE ' + (G.idx + 1) + ' / ' + G.holes.length); setT('holeName', def.name); setT('par', 'PAR ' + def.par); toast(def.name.toUpperCase(), 'Par ' + def.par + (G.idx === 0 ? '  ·  drag back from the ball and let go to putt' : ''), 2200); uiDirty = true;
}
function holeEnd() {
  G.state = 'between'; G.doneT = 0; const def = G.C.def, rows = G.players.map(p => { p.total += p.score; p.card.push(p.score); return p; }); sfx('cheer');
  const me = G.me; if (me.score === 1) { sfx('ace'); toast('HOLE IN ONE!', '', 2000); } showCard(def, rows); uiDirty = true;
}
function showCard(def, rows) {
  const last = G.idx >= G.holes.length - 1, t = $('cardT'); t.textContent = 'HOLE ' + (G.idx + 1) + ': ' + def.name; $('cardPar').textContent = 'Par ' + def.par;
  const body = $('cardBody'); body.innerHTML = ''; for (const p of rows.slice().sort((a, b) => a.total - b.total)) { const tr = document.createElement('tr'); if (p.human) tr.className = 'me'; const d = p.score - def.par; tr.innerHTML = `<td><i style="background:${hex(p.color)}"></i>${p.name}</td><td class="sc ${d < 0 ? 'under' : d > 0 ? 'over' : ''}">${p.score}</td><td class="nm">${scoreName(p.score, def.par)}</td><td>${p.total}</td>`; body.appendChild(tr); }
  $('cardNext').textContent = last ? 'SEE RESULTS' : 'NEXT HOLE'; $('card').classList.remove('hide');
}
function finishRound() {
  state = 'results'; W.state = 'results'; G.over = true; $('hud').style.visibility = 'hidden'; const rows = G.players.slice().sort((a, b) => a.total - b.total), par = G.holes.reduce((a, h) => a + h.par, 0), tbl = $('resTable'); tbl.innerHTML = '<tr><th>#</th><th>Golfer</th><th>Strokes</th><th>vs par</th></tr>';
  let rank = 0, prev = -1; rows.forEach((p, i) => { if (p.total !== prev) { rank = i + 1; prev = p.total; } p.rank = rank; const tr = document.createElement('tr'); if (p.human) tr.className = 'me'; const d = p.total - par; tr.innerHTML = `<td>${rank}</td><td><i style="background:${hex(p.color)}"></i>${p.name}</td><td>${p.total}</td><td class="${d < 0 ? 'under' : d > 0 ? 'over' : ''}">${d > 0 ? '+' : ''}${d}</td>`; tbl.appendChild(tr); });
  const me = G.me, win = me.rank === 1, key = 'best.' + G.holes.length, prevBest = load(key, 0), nb = !prevBest || me.total < prevBest; if (nb) save(key, me.total);
  $('resT').textContent = G.players.length === 1 ? 'ROUND COMPLETE' : win ? (rows.filter(p => p.total === me.total).length > 1 ? 'IT IS A TIE!' : 'YOU WIN!') : ord(me.rank) + ' PLACE'; $('resT').style.color = win ? '#ffd34e' : '#fff';
  $('resS').innerHTML = `You took <b>${me.total}</b> strokes (par ${par})` + (nb ? ' <span class="nb">New best!</span>' : ' · best <b>' + prevBest + '</b>') + (me.aces ? ` · ${me.aces} hole-in-one${me.aces > 1 ? 's' : ''}!` : ''); $('results').classList.remove('hide'); sfx(win ? 'win' : 'cheer');
  if (win) for (let i = 0; i < 5; i++) burst(new V3(cam.cx, 4, cam.cz), [0xffd34e, 0xff4fa8, 0x2ee6ff][i % 3], 14, 10, .24, 1.4, 8, 5);
}

// ================================================================== the simulation
function simStep(dt) {
  const C = G.C, def = C.def; G.holeT += dt; G.acc += dt; let n = 0;
  while (G.acc >= DT && n++ < 20) { G.acc -= DT; G.t += DT; for (const p of G.players) stepPlayer(p, C, def); }
  if (G.state === 'play') {
    if (G.players.every(p => p.done)) { G.doneT += dt; if (G.doneT > .9) holeEnd(); }
    else if (G.me.done) { G.doneT += dt; if (G.doneT > 14 || G.holeT > 150) for (const p of G.players) if (!p.done) finish(p, p.ball.strokes < MAX_STROKES ? Math.min(MAX_STROKES, p.ball.strokes + 2) : MAX_STROKES); }
    else if (G.holeT > 170) for (const p of G.players) if (!p.done) finish(p, MAX_STROKES);
  } else if (G.state === 'between') { G.doneT += dt; if (G.doneT > 9) nextHole(); }
  // everyone's ball on screen
  for (const p of G.players) {
    const b = p.ball; if (p.sunkT > 0) { p.sunkT -= dt; const k = clamp(p.sunkT / .5, 0, 1); p.mesh.scale.setScalar(Math.max(.01, k) * 1.35); p.mesh.position.set(def.cup[0], BALL_R * k - (1 - k) * .3, def.cup[1]); p.blob.visible = false; if (p.sunkT <= 0) p.mesh.visible = false; continue; }
    if (p.done) continue; p.mesh.position.set(b.x, BALL_R, b.z); p.blob.position.set(b.x, .045, b.z); p.mark.visible = p.human && b.state === 'rest' && G.state === 'play'; if (p.mark.visible) { p.mark.position.set(b.x, .05, b.z); p.mark.scale.setScalar(1 + Math.sin(W.time * 5) * .08); }
    if (b.state === 'roll') { const sp = Math.hypot(b.vx, b.vz); p.mesh.rotation.x += b.vz * dt / BALL_R * .6; p.mesh.rotation.z -= b.vx * dt / BALL_R * .6; }
  }
}
function finish(p, score) { if (p.done) return; p.done = true; p.score = score; if (score === 1) p.aces++; }
function stepPlayer(p, C, def) {
  const b = p.ball; if (p.done) return;
  if (b.state === 'sunk') { if (!p.sunkT) { p.sunkT = .5; finish(p, b.strokes); burst(new V3(def.cup[0], .4, def.cup[1]), p.color, 12, 5, .18, .8, 12, 3); ring(new V3(def.cup[0], .08, def.cup[1]), p.color, 2.6, .5); if (p.human) { sfx('sink'); if (b.strokes === 1) sfx('ace'); toast(scoreName(b.strokes, def.par), b.strokes + (b.strokes === 1 ? ' stroke' : ' strokes'), 1600); } else sfx('sink', .4); } return; }
  if (b.state === 'water') { p.waterT += DT; if (p.waterT === DT) { sfx('splash'); burst(new V3(b.x, .3, b.z), 0x66ccff, 14, 5, .16, .8, 12, 3); ring(new V3(b.x, .08, b.z), 0x66ccff, 2, .5); } if (p.waterT > .9) { b.x = b.lastX; b.z = b.lastZ; b.vx = b.vz = 0; b.state = 'rest'; b.strokes++; p.waterT = 0; if (p.human) toast('SPLASH!', '+1 stroke', 1200); } return; }
  if (b.state === 'roll') {
    stepBall(C, b, G.t, DT); const ev = b.ev;
    if (ev) { const near = p.human; if (ev & EV.WALL) { if (near) sfx('wall', clamp(b.spd / 12, .3, 1)); } if (ev & EV.BUMP) { sfx('bump'); const bi = (def.bumpers || []).findIndex(c => Math.hypot(b.x - c[0], b.z - c[1]) < c[2] + BALL_R + .3); if (bi >= 0) H3.bump(bi); } if (ev & EV.SAND && near) sfx('sand'); if (ev & EV.BOOST && near && Math.random() < .03) sfx('boost'); if (ev & EV.TELE) { sfx('tele'); burst(new V3(b.x, .5, b.z), 0x66ffff, 10, 5, .15, .6, 6, 2); } }
  }
  if (b.state === 'rest' && b.strokes >= MAX_STROKES) finish(p, MAX_STROKES);
}
function putt(p, angle, power) { const b = p.ball; if (b.state !== 'rest' || p.done) return; shoot(b, angle, power); sfx('putt', p.human ? power : power * .5); const pos = new V3(b.x, .4, b.z); burst(pos, 0xffffff, 3, 2.5, .1, .35, 6, 1); p.think = rnd(1.4, 3.2); uiDirty = true; }
function botTurn(p, dt) {
  const b = p.ball; if (p.done || b.state !== 'rest' || G.state !== 'play') return; p.think -= dt; if (p.think > 0) return;
  const s = planShot(G.C, b, G.t, p.bot, GFX === 'low'); putt(p, s.angle, s.power);
}

// ================================================================== camera + aiming
// how far back the camera must be to see a region of ex by ez metres (ex runs across the screen, ez up the screen)
function distFor(ex, ez) { const w = innerWidth, h = innerHeight, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), aspect = w / h, reg = Math.max(80, h - VIEW.top) / h; return Math.max((ex / 2) / (tan * aspect), (ez * Math.sin(PITCH) + 4) / (2 * tan * reg)) * 1.1 + 4; }
function fitCamera() {
  if (!G || !H3) return; VIEW.top = ($('topbar').offsetHeight || 0) + 6; VIEW.bottom = 0; resize(); const B = H3.bounds;
  const dN = distFor(B.w + 6, B.d + 3), dR = distFor(B.d + 6, B.w + 3);   // the usual view, or turned a quarter so a long hole runs across a wide screen
  if (dR < dN * .9) { cam.yaw = Math.PI / 2; cam.dist = dR; } else { cam.yaw = 0; cam.dist = dN; } cam.cx = B.cx; cam.cz = B.cz; cam.zoom = 1;
  aimSun(B.cx, B.cz, Math.max(B.w, B.d) * .75 + 8);
}
function placeCamera(dt) {
  if (!G || !H3) return; cam.shake = Math.max(0, cam.shake - dt * 3);
  // the camera frames your ball and the cup, and eases in as you get closer
  const B = H3.bounds, me = G.me, b = me.ball, cup = G.C.cup, rot = cam.yaw > 1; let tx = B.cx, tz = B.cz, d = cam.dist;
  if (G.state === 'play' && state !== 'results') { const bx = me.done ? cup[0] : b.x, bz = me.done ? cup[1] : b.z; tx = (bx + cup[0]) / 2; tz = (bz + cup[1]) / 2; const dx = Math.abs(bx - cup[0]) + 11, dz = Math.abs(bz - cup[1]) + 11; d = Math.max(17, Math.min(cam.dist, rot ? distFor(dz, dx) : distFor(dx, dz))); tx = clamp(tx, B.minX + 2, B.maxX - 2); tz = clamp(tz, B.minZ + 2, B.maxZ - 2); }
  const k = 1 - Math.exp(-dt * 3.2); cam.cur = cam.cur || { x: tx, z: tz, d }; cam.cur.x += (tx - cam.cur.x) * k; cam.cur.z += (tz - cam.cur.z) * k; cam.cur.d += (d - cam.cur.d) * k; const dd = cam.cur.d / cam.zoom, cp = Math.cos(PITCH) * dd;
  camera.position.set(cam.cur.x + Math.sin(cam.yaw) * cp + (Math.random() - .5) * cam.shake, Math.sin(PITCH) * dd, cam.cur.z + Math.cos(cam.yaw) * cp); camera.lookAt(cam.cur.x, 0, cam.cur.z);
}
addEventListener('resize', () => { if (G) fitCamera(); });
const aim = { on: false, drag: false, angle: -Math.PI / 2, power: 0, charge: false, show: 0, ptr: null };
function aimReset() { aim.on = aim.drag = aim.charge = false; aim.power = 0; aim.show = 0; if (G) aim.angle = Math.atan2(G.C.cup[1] - G.me.ball.z, G.C.cup[0] - G.me.ball.x); }
const arrow = new THREE.Group(), shaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x6aff9a, transparent: true, opacity: .92, depthWrite: false })), head = new THREE.Mesh(new THREE.CircleGeometry(1, 3), shaft.material), dots = [];
shaft.rotation.x = -Math.PI / 2; shaft.position.y = .06; head.rotation.x = -Math.PI / 2; head.position.y = .061; head.rotation.z = -Math.PI / 2; arrow.add(shaft, head); arrow.visible = false; scene.add(arrow);
const dotGeo = new THREE.CircleGeometry(.11, 8), dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75, depthWrite: false }); for (let i = 0; i < 28; i++) { const d = new THREE.Mesh(dotGeo, dotMat); d.rotation.x = -Math.PI / 2; d.position.y = .07; d.visible = false; scene.add(d); dots.push(d); }
const hitRing = new THREE.Mesh(new THREE.RingGeometry(.3, .4, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false })); hitRing.rotation.x = -Math.PI / 2; hitRing.position.y = .07; hitRing.visible = false; scene.add(hitRing);
function updateAim(dt) {
  const me = G.me, b = me.ball, can = state === 'play' && G.state === 'play' && !me.done && b.state === 'rest';
  if (aim.charge && can) { aim.power = Math.min(1, aim.power + dt / 1.4); } if (can && !aim.drag) { if (keys.ArrowLeft || keys.KeyA) { aim.angle -= dt * (keys.ShiftLeft ? .4 : 1.3); aim.show = 2.5; } if (keys.ArrowRight || keys.KeyD) { aim.angle += dt * (keys.ShiftLeft ? .4 : 1.3); aim.show = 2.5; } }
  aim.show = Math.max(0, aim.show - dt); const vis = can && (aim.drag ? aim.power > .03 : (aim.charge || aim.show > 0));
  arrow.visible = vis; for (const d of dots) d.visible = false; hitRing.visible = false; if (!vis) return;
  const pw = aim.drag || aim.charge ? aim.power : .45, len = 1.2 + pw * 8, dx = Math.cos(aim.angle), dz = Math.sin(aim.angle);
  shaft.scale.set(len, .34 + pw * .16, 1); shaft.position.x = len / 2 + .5; head.scale.set(.62 + pw * .25, .62 + pw * .25, 1); head.position.x = len + .5 + .4; arrow.position.set(b.x, 0, b.z); arrow.rotation.y = -aim.angle;
  shaft.material.color.setHSL(.36 - .36 * pw, .9, .55);
  const r = rayFirstHit(G.C, b.x, b.z, dx, dz, 30); const nd = Math.min(28, Math.floor(r.t / .9)); for (let i = 0; i < nd; i++) { const d = dots[i]; d.visible = true; d.position.set(b.x + dx * (1.4 + i * .9), .07, b.z + dz * (1.4 + i * .9)); if (1.4 + i * .9 > r.t) d.visible = false; } if (r.t < 30) { hitRing.visible = true; hitRing.position.set(b.x + dx * r.t, .07, b.z + dz * r.t); }
}
const cv = $('view'), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BALL_R), hit = new THREE.Vector3(), ptrs = new Map();
function pointerWorld(cx, cy) { ray.setFromCamera({ x: cx / innerWidth * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, camera); return ray.ray.intersectPlane(plane, hit) ? hit : null; }
function dragAim(e) { const p = pointerWorld(e.clientX, e.clientY); if (!p) return; const b = G.me.ball, vx = b.x - p.x, vz = b.z - p.z, d = Math.hypot(vx, vz); aim.angle = Math.atan2(vz, vx); aim.power = clamp((d - .6) / MAXDRAG, 0, 1); }
cv.addEventListener('pointerdown', e => { if (state !== 'play' || !G) return; audioInit(); try { cv.setPointerCapture(e.pointerId); } catch (err) {} ptrs.set(e.pointerId, 1); if (e.button === 2) { aim.drag = false; aim.power = 0; return; } const me = G.me; if (G.state === 'play' && !me.done && me.ball.state === 'rest' && ptrs.size === 1) { aim.drag = true; aim.on = true; aim.charge = false; dragAim(e); } });
cv.addEventListener('pointermove', e => { if (aim.drag && ptrs.has(e.pointerId)) dragAim(e); });
const endPtr = e => { ptrs.delete(e.pointerId); if (!aim.drag) return; aim.drag = false; if (G && G.state === 'play' && aim.power > .07 && !G.me.done) { const pw = aim.power; aim.power = 0; putt(G.me, aim.angle, pw); } else aim.power = 0; };
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); aim.drag = false; aim.power = 0; }); cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { if (G) { e.preventDefault(); cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.08 : .93), .8, 2); } }, { passive: false });
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return; if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && state === 'play') e.preventDefault(); if (!keys[e.code]) keys[e.code] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); return; }
  if (state !== 'play' || !G) return; if (G.state === 'between' && (e.code === 'Space' || e.code === 'Enter')) { nextHole(); return; }
  const me = G.me; if (e.code === 'Space' && G.state === 'play' && !me.done && me.ball.state === 'rest' && !aim.charge && !aim.drag) { aim.charge = true; aim.power = 0; aim.show = 3; }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space' && aim.charge) { aim.charge = false; const pw = aim.power; aim.power = 0; if (G && G.state === 'play' && !G.me.done && pw > .05) putt(G.me, aim.angle, pw); } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; aim.charge = false; aim.drag = false; });
function pauseGame() { if (state !== 'play') return; state = 'pause'; W.state = 'pause'; $('pause').classList.remove('hide'); }
function resumeGame() { if (state !== 'pause') return; state = 'play'; W.state = 'play'; $('pause').classList.add('hide'); audioInit(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !DEBUG) pauseGame(); });

// ================================================================== HUD
const lastHud = {}; const setT = (id, t) => { if (lastHud[id] !== t) { lastHud[id] = t; $(id).textContent = t; } }; let uiDirty = true;
let toastT = 0; function toast(a, b = '', ms = 1400) { $('toastA').textContent = a; $('toastB').textContent = b; const t = $('toast'); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
let rows = [];
function buildScoreboard() { const sb = $('board'); sb.innerHTML = ''; rows = G.players.map(p => { const d = document.createElement('div'); d.className = 'brow' + (p.human ? ' me' : ''); d.innerHTML = `<i style="background:${hex(p.color)}"></i><span class="bn">${p.name}</span><span class="bs"></span><span class="bt"></span>`; sb.appendChild(d); return d; }); }
function updateHUD() {
  const me = G.me; setT('strokes', String(me.done ? me.score : me.ball.strokes)); $('strokeLbl').textContent = me.done ? 'DONE' : 'STROKES';
  G.players.forEach((p, i) => { const r = rows[i], s = r.querySelector('.bs'), t = r.querySelector('.bt'); const cur = p.done ? p.score : p.ball.strokes; const txt = (p.done ? '✓' : '') + cur; if (s.textContent !== txt) s.textContent = txt; const tt = String(p.total); if (t.textContent !== tt) t.textContent = tt; });
  const pw = aim.drag || aim.charge ? aim.power : 0; $('power').style.opacity = pw > 0 ? 1 : 0; $('powerF').style.width = (pw * 100) + '%'; $('powerF').style.background = `hsl(${(1 - pw) * 120}, 85%, 52%)`;
  const hint = G.state === 'play' && !me.done && me.ball.state === 'rest' ? (G.idx === 0 && me.ball.strokes === 0 ? 'Drag back from your ball, aim the arrow, then let go!' : '') : ''; setT('hint', hint);
}
const cardEl = $('card'); $('cardNext').onclick = () => { if (G && G.state === 'between') nextHole(); };

// ================================================================== loop
let last = performance.now(), fpsN = 0, fpsT = 0, fpsTxt = '', renderTick = 0;
function fpsTick(raw) { fpsN++; fpsT += raw; if (fpsT >= .5) { const t = String(Math.round(fpsN / fpsT)); if (t !== fpsTxt) { $('fps').textContent = t + ' FPS'; fpsTxt = t; } fpsN = 0; fpsT = 0; } }
function step(dt) {
  W.time += dt; updateFX(dt);
  if (G && (state === 'play' || state === 'results')) { if (state === 'play') { simStep(dt); for (const p of G.players) if (!p.human) botTurn(p, dt); updateAim(dt); updateHUD(); } H3 && H3.update(G.t, dt); placeCamera(dt); }
  else if (state === 'menu') { if (menuH) menuH.update(W.time, dt); menuCam(dt); }
}
let menuH = null, menuC = null;
function menuCam(dt) { if (!menuH) return; const B = menuH.bounds, a = W.time * .1; camera.position.set(B.cx + Math.sin(a) * 18, 22, B.cz + Math.cos(a) * 18 + 8); camera.lookAt(B.cx, 0, B.cz); }
function render() { if (QL.skip) renderer.shadowMap.needsUpdate = (renderTick++ & 1) === 0; renderer.render(scene, camera); }
function loop(now) { const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; if (state !== 'pause') step(dt); render(); adaptRes(raw, state === 'play'); fpsTick(raw); requestAnimationFrame(loop); }

// ================================================================== menus
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function hideScreens() { for (const id of ['menu', 'pause', 'results']) $(id).classList.add('hide'); $('card').classList.add('hide'); }
function renderMenu() {
  const root = $('menuPickers'); root.innerHTML = '';
  const g1 = mk('div', 'grp'); g1.appendChild(mk('h3', '', 'HOLES')); const r1 = mk('div', 'row'); for (const n of [3, 6, 9]) { const b = mk('button', n === CFG.holes ? 'sel' : '', n + ' holes'); b.onclick = () => { CFG.holes = n; save('holes', n); sfx('click'); renderMenu(); }; r1.appendChild(b); } g1.appendChild(r1); const best = load('best.' + CFG.holes, 0); if (best) g1.appendChild(mk('p', 'mdesc', 'Your best: ' + best + ' strokes')); root.appendChild(g1);
  const g2 = mk('div', 'grp'); g2.appendChild(mk('h3', '', 'COMPUTER GOLFERS')); const r2 = mk('div', 'row'); for (const n of [0, 1, 2, 3]) { const b = mk('button', 'alt' + (n === CFG.bots ? ' sel' : ''), n === 0 ? 'Solo' : String(n)); b.onclick = () => { CFG.bots = n; save('bots', n); sfx('click'); renderMenu(); }; r2.appendChild(b); } g2.appendChild(r2);
  const r3 = mk('div', 'row'); for (const id of Object.keys(DIFFS)) { const b = mk('button', id === CFG.diff ? 'sel' : '', DIFFS[id].name); b.onclick = () => { CFG.diff = id; save('diff', id); sfx('click'); renderMenu(); }; r3.appendChild(b); } if (CFG.bots) g2.appendChild(r3); root.appendChild(g2);
  const g3 = mk('div', 'grp'); g3.appendChild(mk('h3', '', 'YOUR BALL')); const rc = mk('div', 'row sw'); for (const c of COLORS) { const b = mk('button', 'swatch' + (c === S.color ? ' sel' : '')); b.style.background = hex(c); b.onclick = () => { S.color = c; save('color', c); sfx('click'); renderMenu(); }; rc.appendChild(b); } g3.appendChild(rc); root.appendChild(g3);
  const gg = mk('div', 'grp'); gg.appendChild(mk('h3', '', 'GRAPHICS')); const rg = mk('div', 'row');
  for (const [id, nm] of [['auto', 'Auto'], ['low', 'Low (Chromebook)'], ['med', 'Medium'], ['high', 'High']]) { const cur = ['low', 'med', 'high'].includes(GFX_PREF) ? GFX_PREF : 'auto'; const b = mk('button', id === cur ? 'sel' : '', nm); b.onclick = () => { if (id === cur && !new URLSearchParams(location.search).get('gfx')) return; save('gfx', id); location.href = location.pathname + (DEBUG ? '?debug' : ''); }; rg.appendChild(b); }
  gg.appendChild(rg); gg.appendChild(mk('p', 'mdesc', 'Using ' + GFX.toUpperCase() + ' graphics' + (['low', 'med', 'high'].includes(GFX_PREF) ? '' : ' (picked automatically for this computer)') + '.')); root.appendChild(gg);
}
function showMenu() {
  clearRound(); state = 'menu'; W.state = 'menu'; hideScreens(); $('menu').classList.remove('hide'); $('hud').style.visibility = 'hidden'; renderMenu(); arrow.visible = false; for (const d of dots) d.visible = false; hitRing.visible = false;
  if (!menuH) { const def = HOLES[3]; menuC = new Course(def); menuH = buildHole(menuC, def); setTheme(menuH.theme); }
}
function startGame() { audioInit(); CFG.name = $('pname').value.replace(/[^\w \-]/g, '').trim().slice(0, 12); save('name', CFG.name); if (menuH) { menuH.dispose(); menuH = null; } startRound(); }
$('pname').value = CFG.name; $('play').onclick = startGame; $('resume').onclick = resumeGame; $('restart').onclick = () => { $('pause').classList.add('hide'); audioInit(); startRound(); }; $('quit').onclick = showMenu; $('menuBtn').onclick = showMenu; $('again').onclick = () => { audioInit(); startRound(); };
const vol = $('vol'); vol.value = S.vol; vol.oninput = () => { setVolume(+vol.value); save('vol', S.vol); };
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) { $('touchWarn').style.display = 'block'; $('touchWarn').textContent = 'Touch: put your finger anywhere, drag it back away from the ball, aim the arrow and let go. Pull further for a harder putt.'; }
showMenu(); requestAnimationFrame(loop);

if (DEBUG) window.__pp = { get G() { return G; }, get state() { return state; }, CFG, HOLES, aim, cam, step, startRound, nextHole, putt, planShot, Course, stepBall, simulate, camera, renderer, scene, showMenu, holeEnd, finish, pointerWorld, W, THEMES, get H3() { return H3; }, fitCamera };
$('pauseBtn').onclick = pauseGame;
