// The hangar: pick a part from the list, drag it onto the rocket, let go. Locked parts are unlocked right here with money.
import * as THREE from './three.module.min.js';
import { PARTS, PART_LIST, GROUPS, groupOf, isEngine, G0, MILESTONE } from './data.js?v=2';
import { newDesign, cloneDesign, layout, addPart, removePart, whyNot, stagesOf, stageGroups, missingParts, autoPlace } from './design.js?v=2';
import { analyze } from './sim.js?v=2';
import { makePart, setHighlight } from './meshes.js?v=2';
import { career, fmt$, saveShip, loadShips, deleteShip, saveLast } from './career.js?v=2';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- plain-words facts about a part
export const fmtMass = (kg) => (kg >= 10000 ? (kg / 1000).toFixed(1) + ' tons' : kg >= 1000 ? (kg / 1000).toFixed(1) + ' tons' : Math.round(kg) + ' kg');
const dots = (n) => '●'.repeat(n) + '○'.repeat(5 - n);
const bucket = (x, cuts) => { let n = 1; for (const c of cuts) if (x >= c) n++; return Math.min(5, n); };
export function kidFacts(p) {
  const rows = [['Weighs', fmtMass(p.mass)]];
  if (p.fuel && !p.solid) rows.push(['Holds', fmtMass(p.fuel) + ' of fuel']);
  if (p.F) {
    rows.push(['Push', dots(bucket(p.F, [10e3, 100e3, 300e3, 800e3]))]);
    if (p.solid) rows.push(['Burns for', Math.round(p.fuel / (p.F / (p.ispVac * G0))) + ' seconds'], ['Switch off?', 'Nope!']);
    else rows.push(['Saves fuel', dots(bucket(p.ispVac, [260, 290, 315, 340]))]);
    if (p.gimbal >= 4) rows.push(['Steers', dots(bucket(p.gimbal, [4, 6, 9, 12]))]);
  }
  if (p.cat === 'pod') { rows.push(['Pips', p.crew ? String(p.crew) : 'none (a robot)'], ['Turns the rocket', dots(bucket(p.torque, [3000, 8000, 16000, 30000]))]); }
  if (p.chuteArea) rows.push(['Slows you down', dots(bucket(p.chuteArea, [200, 400, 900, 2000]))]);
  if (p.finLift) rows.push(['Keeps it straight', dots(bucket(p.finArea, [0.5, 1, 2, 3]))]);
  if (p.cat === 'wheel') rows.push(['Turns the rocket', dots(bucket(p.torque, [20000, 60000, 150000, 400000]))]);
  if (p.cat === 'leg') rows.push(['Stands it up', dots(bucket(p.tol, [12, 14, 16, 18]))]);
  if (p.cat === 'decoupler') rows.push(['Press Space', 'everything under it pops off']);
  rows.push(['Width', p.size === 'X' ? 'huge' : p.size === 'L' ? 'wide' : 'normal']);
  return rows;
}

// how far a rocket can go, in kid words
const REACH = [[0, 'Just a hop', '🦘'], [600, 'Up in the sky', '☁️'], [1500, 'SPACE!', '✨'], [3300, 'Around the planet!', '🌍'], [5200, 'The Moon!', '🌙']];
const reachOf = (dv) => { let r = 0; REACH.forEach((x, i) => { if (dv >= x[0]) r = i; }); return r; };

export class Builder {
  constructor(view, icons, preview, hooks) {
    this.view = view; this.icons = icons; this.preview = preview; this.hooks = hooks;
    this.renderer = view.renderer;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd8ff);
    this.scene.fog = new THREE.Fog(0xbfeaff, 45, 130);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9ad07a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2d0, 2.4); sun.position.set(8, 14, 9); this.scene.add(sun);
    this.buildRoom();
    this.rocket = new THREE.Group(); this.scene.add(this.rocket);
    this.dots = new THREE.Group(); this.rocket.add(this.dots);
    this.ghost = new THREE.Group(); this.rocket.add(this.ghost);
    this.design = newDesign(); this.undo = []; this.redo = []; this.lay = [];
    this.palette = null; this.selIdx = -1; this.hoverIdx = -1; this.tab = 'pilot'; this.cardId = null; this.copies = 1; this.copiesPref = null; this.placedOnce = false; this.spots = []; this.near = null;
    this.yaw = 0.7; this.pitch = 0.2; this.dist = 14; this.target = new THREE.Vector3(0, 2, 0); this.tgt = this.target.clone(); this.tDist = 14;
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this.open_ = false; this.t = 0; this.stats = null; this.partObjs = []; this.pickables = [];
    this.wire();
  }

  buildRoom() {
    // a sunny toy yard: grass, a round pad, clouds and balloons
    const grass = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshToonMaterial({ color: 0x74d66a }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -0.08; this.scene.add(grass);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.4, 40), new THREE.MeshToonMaterial({ color: 0xc9d0de })); pad.position.y = -0.15; this.scene.add(pad);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.6, 48), new THREE.MeshBasicMaterial({ color: 0xff7eb6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; this.scene.add(ring);
    const cloudM = new THREE.MeshToonMaterial({ color: 0xffffff });
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + 0.4, d = 38 + (i % 3) * 8, c = new THREE.Group();
      for (const [x, y, s] of [[0, 0, 4], [3.5, -0.5, 3], [-3.5, -0.5, 3.2], [1.5, 1.5, 2.6]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), cloudM); m.position.set(x, y, 0); c.add(m); }
      c.position.set(Math.cos(a) * d, 14 + (i % 4) * 4, Math.sin(a) * d); this.scene.add(c);
    }
    const cols = [0xff5a5a, 0xffd84a, 0x6ec3ff, 0xff7eb6, 0xa98bff];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, d = 12 + (i % 3) * 4, g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshToonMaterial({ color: cols[i % 5] })); b.scale.set(1, 1.2, 1); b.position.y = 6;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6, 4), new THREE.MeshBasicMaterial({ color: 0x555555 })); s.position.y = 3;
      g.add(b, s); g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); this.scene.add(g);
    }
  }

  // ---------------------------------------------------------------- page wiring
  wire() {
    const tabs = $('vTabs');
    for (const [id, emoji, name] of GROUPS) {
      const b = el('button', 'tab', '<span>' + emoji + '</span><small>' + name + '</small>'); b.dataset.t = id;
      b.onclick = () => { this.tab = id; this.renderList(); this.paintCopies(); this.hooks.sound.click(); };
      tabs.appendChild(b);
    }
    $('vBack').onclick = () => { saveLast(this.design); this.hooks.onBack(); };
    $('vUndo').onclick = () => this.doUndo();
    $('vLaunch').onclick = () => this.launch();
    $('vGoals').onclick = () => this.hooks.openGoals();
    $('vName').addEventListener('input', () => { this.design.name = $('vName').value; });
    $('vMine').onclick = (e) => { e.stopPropagation(); this.paintMine(); $('vMenu').classList.toggle('hide'); };
    window.addEventListener('pointerdown', (e) => { if (!$('vMenu').contains(e.target) && e.target !== $('vMine')) $('vMenu').classList.add('hide'); });
    $('vNew').onclick = () => { this.commit(); this.design = newDesign('My Rocket'); this.selIdx = -1; this.palette = null; $('vName').value = 'My Rocket'; this.afterChange(); $('vMenu').classList.add('hide'); };
    $('vSave').onclick = () => { this.design.name = $('vName').value || 'My Rocket'; saveShip(this.design); this.hooks.toast('Saved!', 'good', this.design.name); this.paintMine(); };
    for (const n of ['auto', 1, 2, 3, 4, 6]) { const bt = el('button', 'small', n === 'auto' ? 'Auto' : String(n)); bt.dataset.n = n; bt.onclick = () => { this.copiesPref = n === 'auto' ? null : n; this.paintCopies(); }; $('vCopyBtns').appendChild(bt); }
    $('ptTrash').onclick = () => { if (this.selIdx >= 0) this.remove(this.selIdx); };
    const cv = this.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    cv.addEventListener('wheel', (e) => { if (!this.open_) return; e.preventDefault(); this.tDist = Math.max(4, Math.min(80, this.tDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => { if (this.open_) e.preventDefault(); });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  open(design) {
    this.open_ = true;
    this.design = cloneDesign(design || this.design || newDesign());
    this.undo = []; this.redo = []; this.palette = null; this.selIdx = -1; this.cardId = null; this.placedOnce = false;
    $('vab').classList.remove('hide');
    $('vName').value = this.design.name || 'My Rocket';
    this.afterChange();
    this.showCard(null);
    this.resize();
  }
  close() { this.open_ = false; $('vab').classList.add('hide'); $('partTag').classList.add('hide'); $('dragChip').classList.add('hide'); }
  resize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }

  // ---------------------------------------------------------------- editing
  commit() { this.undo.push(JSON.stringify(this.design)); if (this.undo.length > 60) this.undo.shift(); this.redo = []; }
  doUndo() { if (!this.undo.length) return; this.redo.push(JSON.stringify(this.design)); this.design = JSON.parse(this.undo.pop()); this.selIdx = -1; this.afterChange(); }
  doRedo() { if (!this.redo.length) return; this.undo.push(JSON.stringify(this.design)); this.design = JSON.parse(this.redo.pop()); this.selIdx = -1; this.afterChange(); }
  place(spot) {
    const id = this.palette; if (!id) return false;
    if (!career.unlocked(id)) return false;
    const res = addPart(this.design, spot.parent, spot.node, spot.slot, id, this.copies, spot.angle || 0);
    if (res.err) { this.hooks.toast(res.err, 'bad'); return false; }
    this.commit(); this.design = res.design; this.hooks.sound.click();
    this.palette = null; this.afterChange();
    this.selIdx = res.added[res.added.length - 1]; this.rebuildRocket();
    return true;
  }
  // click a part in the list: it goes where it makes sense (tanks under the pilot, engine stays last, hats on top, fins on the side)
  autoAdd(p) {
    this.palette = null; this.rebuildSpots();
    const res = autoPlace(this.design, p.id, this.defaultCopies(p), this.facingAngle());
    this.hooks.sound.click();
    if (res.err) { this.hooks.toast(res.err, 'bad'); return; }
    this.commit(); this.design = res.design; this.afterChange();
    this.selIdx = res.added[res.added.length - 1]; this.rebuildRocket(); this.showCard(p.id, true); this.hint();
  }
  remove(idx) {
    if (idx < 0 || idx >= this.design.parts.length) return;
    this.commit(); this.design = removePart(this.design, idx); this.selIdx = -1; this.afterChange();
  }

  afterChange() {
    this.lay = layout(this.design);
    this.stats = analyze(this.design);
    this.rebuildRocket();
    this.rebuildSpots();
    this.paintStats();
    this.renderList();
    $('vUndo').disabled = !this.undo.length; this.paintCopies();
    $('vMoney').textContent = career.sandbox() ? 'Sandbox' : fmt$(career.funds);
    this.hint();
    saveLast(this.design);
  }

  rebuildRocket() {
    for (const c of [...this.rocket.children]) if (c !== this.dots && c !== this.ghost) this.rocket.remove(c);
    this.pickables = []; this.partObjs = [];
    let minY = 0, maxY = 0;
    if (!this.design.parts.length) { minY = -0.5; maxY = 0.5; }
    this.lay.forEach((L) => {
      const o = makePart(L.def, { outlines: true });
      o.position.set(L.pos[0], L.pos[1], L.pos[2]); o.rotation.y = L.rotY;
      o.traverse((m) => { if (m.isMesh && !m.userData.outline) { m.userData.idx = L.i; this.pickables.push(m); } });
      this.rocket.add(o); this.partObjs[L.i] = o;
      minY = Math.min(minY, L.pos[1] - L.def.h / 2 - (L.def.drop || 0)); maxY = Math.max(maxY, L.pos[1] + L.def.h / 2);
    });
    this.rocketY = -minY + 0.05;
    if (!this.placedOnce) { this.rocket.position.y = this.rocketY; this.placedOnce = true; }
    this.top = maxY - minY;
    this.tgt.set(0, (maxY - minY) / 2 + 0.05, 0);
    this.tDist = Math.max(11, this.top * 1.25 + 5);
    this.applyHighlights();
  }
  groupMembers(idx) {
    const q = this.design.parts[idx]; if (!q) return [];
    return q.g ? this.design.parts.map((x, i) => (x.g === q.g && x.t === q.t ? i : -1)).filter((i) => i >= 0) : [idx];
  }
  applyHighlights() {
    this.partObjs.forEach((o) => o && setHighlight(o, 0));
    if (this.hoverIdx >= 0 && this.hoverIdx !== this.selIdx) for (const i of this.groupMembers(this.hoverIdx)) { if (this.partObjs[i]) setHighlight(this.partObjs[i], 1); }
    if (this.selIdx >= 0) for (const i of this.groupMembers(this.selIdx)) { if (this.partObjs[i]) setHighlight(this.partObjs[i], 2); }
    const q = this.design.parts[this.selIdx];
    $('partTag').classList.toggle('hide', !q);
    if (q) $('ptName').textContent = PARTS[q.t].name;
  }
  select(idx) { this.selIdx = idx; this.applyHighlights(); if (idx >= 0) this.showCard(this.design.parts[idx].t, true); this.hint(); }

  // ---- the open spots a dragged part can snap to
  facingAngle() {                                               // side parts go on the side that faces you
    return Math.round((Math.atan2(this.camera.position.z - this.target.z, this.camera.position.x - this.target.x) / DEG) / 15) * 15;
  }
  defaultCopies(def) { return this.copiesPref || (def.cat === 'fin' || def.cat === 'leg' ? 3 : def.cat === 'srb' || def.cat === 'engine' ? 2 : 1); }
  rebuildSpots() {
    for (const c of [...this.dots.children]) this.dots.remove(c);
    this.clearGhost(); this.spots = []; this.near = null;
    const id = this.palette, def = id && PARTS[id], d = this.design;
    this.paintCopies();
    if (!def) return;
    if (!d.parts.length) { if (def.cat === 'pod') this.spots.push({ parent: -1, node: 'b', pos: new THREE.Vector3(0, 0, 0) }); }
    else {
      const seen = new Set(), ang = this.facingAngle();
      this.lay.forEach((L) => {
        const q = L.q;
        if (q.g) { const key = q.g + ':' + q.t; if (seen.has(key)) return; seen.add(key); }
        if (!whyNot(d, L.i, 't', id)) this.spots.push({ parent: L.i, node: 't', pos: new THREE.Vector3(L.pos[0], L.pos[1] + L.def.h / 2, L.pos[2]) });
        if (!whyNot(d, L.i, 'b', id)) this.spots.push({ parent: L.i, node: 'b', pos: new THREE.Vector3(L.pos[0], L.pos[1] - L.def.h / 2, L.pos[2]) });
        if (!whyNot(d, L.i, 's', id)) {
          const a = (L.q.n === 's' ? L.q.a || 0 : ang), ext = L.def.radialOnly ? L.def.rr / 2 : L.def.r;
          const slot = def.cat === 'fin' || def.cat === 'leg' ? 'bot' : def.cat === 'misc' ? 'top' : 'mid';
          const y = L.def.radialOnly ? L.pos[1] : slot === 'top' ? L.pos[1] + L.def.h / 2 - 0.25 : slot === 'bot' ? L.pos[1] - L.def.h / 2 + 0.25 : L.pos[1];
          this.spots.push({ parent: L.i, node: 's', slot: L.def.radialOnly ? 'mid' : slot, angle: a, pos: new THREE.Vector3(L.pos[0] + Math.cos(a * DEG) * (ext + 0.05), y, L.pos[2] + Math.sin(a * DEG) * (ext + 0.05)) });
        }
      });
    }
    for (const s of this.spots) {
      const g = new THREE.Group();
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), new THREE.MeshBasicMaterial({ color: 0x2cf0b8, depthTest: false, transparent: true, opacity: 0.95 }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2cf0b8, depthTest: false, transparent: true, opacity: 0.22 }));
      dot.renderOrder = halo.renderOrder = 20; g.add(dot, halo); g.position.copy(s.pos); g.userData.pulse = Math.random() * 6; s.obj = g;
      this.dots.add(g);
    }
  }
  paintCopies() {
    $('vCopies').classList.toggle('hide', !['boost', 'help', 'fuel'].includes(this.tab));
    for (const bt of $('vCopyBtns').children) bt.classList.toggle('on', bt.dataset.n === (this.copiesPref ? String(this.copiesPref) : 'auto'));
  }
  clearGhost() { for (const c of [...this.ghost.children]) this.ghost.remove(c); this.ghostKey = ''; }
  showGhost(spot) {
    const key = spot.parent + spot.node + (spot.slot || '') + (spot.angle || 0) + this.copies + this.palette;
    if (key === this.ghostKey) return; this.clearGhost(); this.ghostKey = key;
    const res = addPart(this.design, spot.parent, spot.node, spot.slot, this.palette, this.copies, spot.angle || 0);
    if (res.err) return;
    const lay = layout(res.design), mat = new THREE.MeshBasicMaterial({ color: 0x2cf0b8, transparent: true, opacity: 0.5, depthWrite: false });
    for (const i of res.added) {
      const L = lay[i], o = makePart(L.def, { outlines: false });
      o.traverse((m) => { if (m.isMesh) m.material = mat; });
      o.position.set(L.pos[0], L.pos[1], L.pos[2]); o.rotation.y = L.rotY; this.ghost.add(o);
    }
  }
  // the spot closest to a screen position (within a generous reach)
  nearestSpot(x, y, reach = 130) {
    if (!this.spots.length) return null;
    if (this.spots.length === 1 && this.spots[0].parent < 0) return this.spots[0];
    this.camera.updateMatrixWorld(); this.rocket.updateMatrixWorld(true); let best = null, bd = reach;
    const v = new THREE.Vector3();
    for (const s of this.spots) {
      v.copy(s.pos).applyMatrix4(this.rocket.matrixWorld).project(this.camera);
      const dx = (v.x + 1) / 2 * innerWidth - x, dy = (1 - v.y) / 2 * innerHeight - y, dd = Math.hypot(dx, dy);
      if (dd < bd) { bd = dd; best = s; }
    }
    return best;
  }
  setNear(s) {
    if (s === this.near) return;
    this.near = s;
    for (const sp of this.spots) if (sp.obj) sp.obj.userData.big = sp === s;
    if (s) this.showGhost(s); else this.clearGhost();
  }

  // ---------------------------------------------------------------- the lists and cards
  renderList() {
    for (const b of $('vTabs').children) b.classList.toggle('sel', b.dataset.t === this.tab);
    const list = $('vList'); list.innerHTML = '';
    for (const p of PART_LIST.filter((x) => groupOf(x) === this.tab)) {
      const owned = career.unlocked(p.id), gated = !career.reqMet(p);
      const t = el('div', 'tile' + (owned ? '' : ' locked') + (this.palette === p.id || this.cardId === p.id ? ' sel' : ''));
      t.innerHTML = '<img alt="" draggable="false"><div class="nm">' + p.name + '</div><div class="pr">' + (owned ? '' : gated ? '🔒 locked' : '🔒 ' + fmt$(p.price)) + '</div>';
      t.firstChild.src = this.icons.get(p.id);
      t.onpointerdown = (e) => { if (e.button !== 0) return; e.preventDefault(); this.tileDown(e, p, owned); };
      t.onmouseenter = () => { if (!this.palette && !this.dragging) this.showCard(p.id); };
      list.appendChild(t);
    }
  }
  showCard(id, fromPart) {
    this.cardId = id;
    const card = $('vCard');
    if (!id) { card.innerHTML = '<div class="cardEmpty">Drag a part from the list onto your rocket!</div>'; this.preview.el = null; return; }
    const p = PARTS[id], owned = career.unlocked(id), why = owned ? '' : career.whyNotBuy(id);
    card.innerHTML = '<canvas id="cardPrev" width="300" height="210"></canvas><div class="cardBody"><b class="cn">' + p.name + '</b><p>' + p.desc + '</p><div class="facts">' +
      kidFacts(p).map((r) => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div>' +
      (owned ? (fromPart ? '' : '<div class="own">You have this one! Drag it onto the rocket.</div>') : '<div class="buyrow"><span class="money">' + fmt$(p.price) + '</span><button id="cardBuy" class="go small"' + (why ? ' disabled' : '') + '>Unlock it!</button></div>' + (why ? '<div class="why">' + why + '</div>' : '')) + '</div>';
    this.preview.el = $('cardPrev'); this.preview.set(p);
    const b = $('cardBuy'); if (b) b.onclick = () => { if (career.buy(id)) { this.hooks.sound.good(); this.hooks.toast('You unlocked the ' + p.name + '!', 'good'); this.afterChange(); this.showCard(id); this.hooks.moneyChanged(); } };
  }

  // ---------------------------------------------------------------- stats in kid words
  paintStats() {
    const s = this.stats, box = $('vStats'), d = this.design;
    if (!d.parts.length) { box.innerHTML = '<h3>Your rocket</h3><div class="empty">Nothing here yet!<br><br>1. Click a <b>pilot</b>.<br>2. Click some <b>fuel</b>.<br>3. Click an <b>engine</b>.<br>4. Press <b>LAUNCH</b>!<br><br>Want it exactly your way? <b>Drag</b> a part onto the rocket instead.</div>'; return; }
    const row = (ok, text) => '<div class="chk ' + ok + '"><i>' + (ok === 'yes' ? '✅' : ok === 'meh' ? '⚠️' : '❌') + '</i><span>' + text + '</span></div>';
    const eng = this.lay.some((L) => isEngine(L.def)), pil = s.hasPod, fuel = s.fuel > 0, chute = this.lay.some((L) => L.def.chuteArea);
    let h = '<h3>Your rocket</h3>';
    h += row(pil ? 'yes' : 'no', pil ? 'A pilot is on board' : 'Put a <b>pilot</b> on top');
    h += row(eng ? 'yes' : 'no', eng ? 'It has an engine' : 'Needs an <b>engine</b> at the bottom');
    h += row(fuel ? 'yes' : 'no', fuel ? 'It has fuel' : 'Needs some <b>fuel</b>');
    h += row(!eng ? 'no' : s.twrAsl >= 1.25 ? 'yes' : s.twrAsl >= 1 ? 'meh' : 'no', !eng ? 'Needs power to lift off' : s.twrAsl >= 1.25 ? 'Strong enough to lift off!' : s.twrAsl >= 1 ? 'Barely lifts off' : 'Too heavy! Add a stronger engine');
    h += row(chute ? 'yes' : 'meh', chute ? 'It has an umbrella for landing' : 'No umbrella: landing will hurt');
    const r = reachOf(s.dv || 0);
    h += '<h3>How far can it go?</h3><div class="reach"><div class="rbar">' + REACH.map((x, i) => '<i class="' + (i <= r && s.ok ? 'on' : '') + '"></i>').join('') + '</div><div class="rname">' + (s.ok ? REACH[r][2] + ' ' + REACH[r][1] : 'It cannot lift off yet') + '</div></div>';
    h += '<div class="small">Weighs ' + fmtMass(s.mass) + '</div>';
    const miss = missingParts(d, career.unlockedSet());
    if (miss.length) h += '<div class="warnbox">You need to unlock: ' + miss.map((m) => PARTS[m].name).join(', ') + '</div>';
    h += '<details><summary>Launch order</summary><div class="small">What happens each time you press Space:</div>';
    const groups = stageGroups(d, this.lay);
    if (!groups.length) h += '<div class="small">Nothing yet.</div>';
    for (const g of groups) {
      h += '<div class="stg"><div class="hd">Space press ' + (g.stage + 1) + '</div>';
      const done = new Set();
      for (const i of g.parts) {
        const q = d.parts[i]; if (q.auto) continue;
        const key = q.g ? q.g + ':' + q.t : 'i' + i; if (done.has(key)) continue; done.add(key);
        const n = q.g ? d.parts.filter((x) => x.g === q.g && x.t === q.t).length : 1;
        h += '<div class="it"><img src="' + this.icons.get(q.t) + '"><span>' + (n > 1 ? n + ' x ' : '') + PARTS[q.t].name + '</span><button data-m="' + i + '" data-d="-1">▲</button><button data-m="' + i + '" data-d="1">▼</button></div>';
      }
      h += '</div>';
    }
    if (d.parts.some((x) => x.st !== undefined)) h += '<button class="small ghost" id="vAuto">Back to automatic</button>';
    h += '</details>';
    h += '<details><summary>Nerd stats</summary><div class="nerd">' + nerdRows(s, this.stats) + '</div></details>';
    box.innerHTML = h;
    box.querySelectorAll('button[data-m]').forEach((b) => { b.onclick = () => this.moveStage(+b.dataset.m, +b.dataset.d); });
    const au = $('vAuto'); if (au) au.onclick = () => { this.commit(); for (const q of this.design.parts) delete q.st; this.afterChange(); };
  }
  moveStage(i, dir) {
    const q = this.design.parts[i], st = stagesOf(this.design, this.lay), cur = st[i], max = Math.max(...st) + 1;
    const to = Math.max(0, Math.min(max, cur + dir)); if (to === cur) return;
    this.commit();
    for (const x of this.design.parts) if ((q.g && x.g === q.g && x.t === q.t) || x === q) x.st = to;
    this.afterChange();
  }
  hint() {
    const h = $('vHint'), d = this.design, s = this.stats;
    let t;
    if (this.dragging) t = 'Drop it near a glowing dot!';
    else if (!d.parts.length) t = 'Start by clicking a pilot (try the Teapot!)';
    else if (!s || !s.hasPod) t = 'Put a pilot on top';
    else if (!(s.fuel > 0)) t = 'Next: click some fuel (the Fuel tab)';
    else if (!this.lay.some((L) => isEngine(L.def))) t = 'Next: click an engine (the Engines tab)';
    else if (s.twrAsl < 1) t = 'Too heavy to lift off! Try a stronger engine or less fuel';
    else if (this.selIdx >= 0) t = 'Looking good! The glowing part is picked. Press Remove to take it off.';
    else t = 'Ready? Press LAUNCH! (An umbrella helps you land.)';
    h.textContent = t;
  }

  paintMine() {
    const box = $('vSaved'); box.innerHTML = '';
    const mine = Object.values(loadShips()), un = career.unlockedSet();
    if (!mine.length) box.appendChild(el('div', 'small', 'No saved rockets yet. Press Save!'));
    for (const r of mine) {
      const row = el('div', 'saved', '<span>' + r.name + '</span>');
      const o = el('button', 'small go', 'Open'); o.onclick = () => { this.commit(); this.design = cloneDesign(r); this.selIdx = -1; $('vName').value = r.name; this.afterChange(); $('vMenu').classList.add('hide'); };
      const x = el('button', 'small warn', '🗑'); x.onclick = () => { deleteShip(r.name); this.paintMine(); };
      row.append(o, x); box.appendChild(row);
    }
    void un;
  }

  launch() {
    const s = this.stats, d = this.design;
    const miss = missingParts(d, career.unlockedSet());
    if (!d.parts.length || !s.hasPod) { this.hooks.toast('Put a pilot on first!', 'bad'); return; }
    if (miss.length) { this.hooks.toast('Unlock these first', 'bad', miss.map((m) => PARTS[m].name).join(', ')); return; }
    if (!s.ok) { this.hooks.toast(s.twrAsl < 1 && s.twrAsl > 0 ? 'Too heavy to lift off!' : 'It needs an engine!', 'bad', 'Check the list on the right'); return; }
    d.name = $('vName').value || d.name; saveLast(d);
    this.hooks.onLaunch(cloneDesign(d));
  }

  // ---------------------------------------------------------------- mouse and keys
  pointer(x, y) { const r = this.renderer.domElement.getBoundingClientRect(); this.mouse.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.mouse, this.camera); }
  tileDown(e, p, owned) {
    this.hooks.sound.start();
    this.showCard(p.id);
    this.tile = { p, owned, x: e.clientX, y: e.clientY, moved: false };
  }
  onDown(e) { if (!this.open_) return; this.drag = { x: e.clientX, y: e.clientY, moved: 0 }; }
  onMove(e) {
    if (!this.open_) return;
    if (this.tile) {
      const t = this.tile;
      if (!t.moved && t.owned && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 7) {
        t.moved = true; this.dragging = true; this.palette = t.p.id; this.copies = this.defaultCopies(t.p); this.selIdx = -1;
        this.rebuildSpots(); this.applyHighlights(); this.renderList(); this.hint();
        const chip = $('dragChip'); chip.querySelector('img').src = this.icons.get(t.p.id); chip.classList.remove('hide');
      }
      if (t.moved) {
        const chip = $('dragChip'); chip.style.left = e.clientX + 'px'; chip.style.top = e.clientY + 'px';
        const over = document.elementFromPoint(e.clientX, e.clientY) === this.renderer.domElement;
        this.setNear(over ? this.nearestSpot(e.clientX, e.clientY) : null);
      }
      return;
    }
    if (this.drag) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.moved > 4) { this.yaw -= dx * 0.008; this.pitch = Math.max(-0.2, Math.min(1.45, this.pitch + dy * 0.008)); }
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      return;
    }
    if (document.elementFromPoint(e.clientX, e.clientY) !== this.renderer.domElement) { if (this.hoverIdx >= 0) { this.hoverIdx = -1; this.applyHighlights(); } return; }
    if (this.palette) { this.setNear(this.nearestSpot(e.clientX, e.clientY, 90)); return; }
    this.pointer(e.clientX, e.clientY);
    const hit = this.ray.intersectObjects(this.pickables, false)[0], idx = hit ? hit.object.userData.idx : -1;
    if (idx !== this.hoverIdx) { this.hoverIdx = idx; this.applyHighlights(); this.renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : 'default'; }
  }
  onUp(e) {
    if (!this.open_) return;
    if (this.tile) {
      const t = this.tile; this.tile = null;
      $('dragChip').classList.add('hide');
      if (t.moved) {                                           // dropped
        this.dragging = false;
        if (this.near) this.place(this.near); else { this.palette = null; this.hooks.toast('Drop it near a glowing dot!', ''); this.rebuildSpots(); this.renderList(); this.hint(); }
        return;
      }
      if (t.owned) this.autoAdd(t.p);                          // a click adds it in the sensible place
      return;
    }
    if (!this.drag) return;
    const moved = this.drag.moved; this.drag = null;
    if (moved > 5 || document.elementFromPoint(e.clientX, e.clientY) !== this.renderer.domElement) return;
    if (this.palette) {
      const s = this.nearestSpot(e.clientX, e.clientY, 90);
      if (s) this.place(s); else { this.palette = null; this.rebuildSpots(); this.renderList(); this.hint(); }
      return;
    }
    this.pointer(e.clientX, e.clientY);
    const hit = this.ray.intersectObjects(this.pickables, false)[0];
    this.select(hit ? hit.object.userData.idx : -1);
    if (!hit) this.showCard(null);
  }
  onKey(e) {
    if (!this.open_ || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'delete' || k === 'backspace') { if (this.selIdx >= 0) { e.preventDefault(); this.remove(this.selIdx); } }
    else if (k === 'escape') { this.palette = null; this.selIdx = -1; this.rebuildSpots(); this.applyHighlights(); this.renderList(); this.hint(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); this.doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.doRedo(); }
    else if ('12346'.includes(k) && k.length === 1 && !$('vCopies').classList.contains('hide')) { this.copiesPref = +k; this.paintCopies(); }
  }

  // ---------------------------------------------------------------- drawing
  render(dt) {
    this.t += dt;
    const k = Math.min(1, dt * 6);
    this.target.lerp(this.tgt, k); this.dist += (this.tDist - this.dist) * k;
    this.rocket.position.y += (this.rocketY - this.rocket.position.y) * Math.min(1, dt * 8);
    const cp = Math.cos(this.pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + Math.sin(this.pitch) * this.dist + 0.5, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.camera.lookAt(this.target);
    for (const s of this.spots) {
      const g = s.obj; if (!g) continue;
      const pul = 1 + 0.15 * Math.sin(this.t * 5 + g.userData.pulse);
      const sc = Math.max(0.5, this.camera.position.distanceTo(g.getWorldPosition(new THREE.Vector3())) * 0.06) * pul * (g.userData.big ? 1.9 : 1);
      g.children[0].scale.setScalar(sc); g.children[1].scale.setScalar(sc * 1.15);
      g.children[0].material.color.setHex(g.userData.big ? 0xffe14a : 0x2cf0b8); g.children[1].material.color.setHex(g.userData.big ? 0xffe14a : 0x2cf0b8);
    }
    // the name tag with the trash can floats over the picked part
    if (this.selIdx >= 0 && this.partObjs[this.selIdx]) {
      const L = this.lay[this.selIdx], v = new THREE.Vector3(L.pos[0], L.pos[1] + L.def.h / 2 + 0.2, L.pos[2]).applyMatrix4(this.rocket.matrixWorld).project(this.camera);
      const tag = $('partTag'); tag.style.left = Math.max(80, Math.min(innerWidth - 220, (v.x + 1) / 2 * innerWidth)) + 'px'; tag.style.top = Math.max(70, (1 - v.y) / 2 * innerHeight - 10) + 'px';
    }
    const r = this.renderer;
    r.setClearColor(0x8fd8ff, 1); r.clear(); r.render(this.scene, this.camera);
  }
}

function nerdRows(s) {
  const row = (k, v) => '<div class="stat"><span>' + k + '</span><b>' + v + '</b></div>';
  let h = row('Mass', fmtMass(s.mass)) + row('Fuel', fmtMass(s.fuel)) + row('Height', s.height.toFixed(1) + ' m');
  h += row('Push at the ground', s.thrustAsl ? (s.thrustAsl / 1000).toFixed(0) + ' kN' : '-') + row('Lift-off power', s.thrustAsl ? s.twrAsl.toFixed(2) : '-');
  h += row('Total boost', Math.round(s.dv).toLocaleString('en-US') + ' m/s');
  for (const st of s.stages) h += row('Step ' + (st.stage + 1) + ' boost', Math.round(st.dv).toLocaleString('en-US') + ' m/s');
  return h;
}
