// The rocket builder (the hangar): a 3D room where you pick parts and click them onto glowing spots.
import * as THREE from './three.module.min.js';
import { PARTS, PART_LIST, CATS, STARTERS, isEngine, isChute } from './data.js?v=1';
import { newDesign, cloneDesign, layout, addPart, removePart, whyNot, stagesOf, stageGroups, missingParts, costOf } from './design.js?v=1';
import { analyze } from './sim.js?v=1';
import { makePart } from './meshes.js?v=1';
import { career, fmt$, saveShip, loadShips, deleteShip, saveLast } from './career.js?v=1';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class Builder {
  constructor(view, icons, hooks) {
    this.view = view; this.icons = icons; this.hooks = hooks;
    this.renderer = view.renderer;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x15103a);
    this.scene.fog = new THREE.Fog(0x15103a, 40, 110);
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a3a6a, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3); sun.position.set(8, 14, 9); this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xa0b8ff, 0.7); fill.position.set(-9, 5, -6); this.scene.add(fill);
    this.buildRoom();
    this.rocket = new THREE.Group(); this.scene.add(this.rocket);
    this.markers = new THREE.Group(); this.rocket.add(this.markers);
    this.ghost = new THREE.Group(); this.rocket.add(this.ghost);
    this.sel = new THREE.Box3Helper(new THREE.Box3(), 0xffd34e); this.sel.visible = false; this.scene.add(this.sel);
    this.design = newDesign(); this.undo = []; this.redo = []; this.palette = null; this.selIdx = -1; this.sym = 1; this.base = 0; this.cat = 'pod'; this.hover = null;
    this.yaw = 0.7; this.pitch = 0.22; this.dist = 14; this.target = new THREE.Vector3(0, 2, 0); this.tgt = this.target.clone(); this.tDist = 14;
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this.open_ = false; this.t = 0; this.stats = null;
    this.wire();
  }

  buildRoom() {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(18, 64), new THREE.MeshStandardMaterial({ color: 0x2a2360, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 4.9, 64), new THREE.MeshBasicMaterial({ color: 0xff8fc8, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; this.scene.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(9.5, 9.6, 64), new THREE.MeshBasicMaterial({ color: 0x5a50a8, side: THREE.DoubleSide })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.02; this.scene.add(ring2);
    const grid = new THREE.GridHelper(36, 36, 0x4a40a0, 0x2f2870); grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.5; this.scene.add(grid);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.35, 40), new THREE.MeshStandardMaterial({ color: 0x8a90a8, roughness: 0.6, metalness: 0.2 })); pad.position.y = -0.17; this.scene.add(pad);
    // big girder columns in the corners of the hangar
    const gm = new THREE.MeshStandardMaterial({ color: 0x3a3490, roughness: 0.8 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5, c = new THREE.Mesh(new THREE.BoxGeometry(1.2, 60, 1.2), gm); c.position.set(Math.cos(a) * 22, 30, Math.sin(a) * 22); this.scene.add(c); }
  }

  // ---------------------------------------------------------------- page wiring
  wire() {
    this.sym1 = $('vSym');
    for (const n of [1, 2, 3, 4, 6]) { const b = el('button', 'small ghost', n + 'x'); b.dataset.n = n; b.onclick = () => { this.sym = n; this.paintSym(); this.updateMarkers(); }; this.sym1.appendChild(b); }
    this.paintSym();
    const cats = $('vCats');
    for (const [id, name] of CATS) { const b = el('button', '', name); b.dataset.c = id; b.onclick = () => { this.cat = id; this.renderList(); }; cats.appendChild(b); }
    $('vBack').onclick = () => { saveLast(this.design); this.hooks.onBack(); };
    $('vNew').onclick = () => { this.commit(); this.design = newDesign($('vName').value || 'My Rocket'); this.afterChange(); };
    $('vSave').onclick = () => { this.design.name = $('vName').value || 'My Rocket'; saveShip(this.design); this.hooks.toast('Saved "' + this.design.name + '"', 'good'); };
    $('vLoad').onclick = () => this.hooks.openLoad();
    $('vShop').onclick = () => this.hooks.openShop();
    $('vUndo').onclick = () => this.doUndo(); $('vRedo').onclick = () => this.doRedo();
    $('vLaunch').onclick = () => this.launch();
    $('vName').addEventListener('input', () => { this.design.name = $('vName').value; });
    const cv = this.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    cv.addEventListener('wheel', (e) => { if (!this.open_) return; e.preventDefault(); this.tDist = Math.max(3, Math.min(70, this.tDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => { if (this.open_) e.preventDefault(); });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }
  paintSym() { for (const b of this.sym1.children) b.classList.toggle('on', +b.dataset.n === this.sym); }

  open(design) {
    this.open_ = true;
    this.design = cloneDesign(design || this.design || newDesign());
    this.undo = []; this.redo = []; this.palette = null; this.selIdx = -1;
    $('vab').classList.remove('hide');
    $('vName').value = this.design.name || 'My Rocket';
    this.cat = this.design.parts.length ? this.cat : 'pod';
    this.afterChange(true);
    this.resize();
  }
  close() { this.open_ = false; $('vab').classList.add('hide'); }
  resize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }

  // ---------------------------------------------------------------- editing
  commit() { this.undo.push(JSON.stringify(this.design)); if (this.undo.length > 60) this.undo.shift(); this.redo = []; }
  doUndo() { if (!this.undo.length) return; this.redo.push(JSON.stringify(this.design)); this.design = JSON.parse(this.undo.pop()); this.selIdx = -1; this.afterChange(); }
  doRedo() { if (!this.redo.length) return; this.undo.push(JSON.stringify(this.design)); this.design = JSON.parse(this.redo.pop()); this.selIdx = -1; this.afterChange(); }
  place(parent, node, slot) {
    const id = this.palette; if (!id) return;
    if (!career.unlocked(id)) { this.hooks.toast('Unlock this part in the shop first.', 'bad'); return; }
    const res = addPart(this.design, parent, node, slot, id, this.sym, this.base);
    if (res.err) { this.hooks.toast(res.err, 'bad'); return; }
    this.commit(); this.design = res.design; this.hooks.sound.click();
    // pods and rings are one-offs: carry on picking; keep the same part selected so you can add more
    if (PARTS[id].cat === 'pod' || !this.openSpots(id)) this.palette = null;
    this.afterChange();
  }
  remove(idx) {
    if (idx < 0 || idx >= this.design.parts.length) return;
    this.commit(); this.design = removePart(this.design, idx); this.selIdx = -1; this.afterChange();
  }
  openSpots(id) {
    const d = this.design;
    if (!d.parts.length) return PARTS[id].cat === 'pod';
    for (let i = 0; i < d.parts.length; i++) for (const n of ['t', 'b', 's']) if (!whyNot(d, i, n, id)) return true;
    return false;
  }

  afterChange(fit) {
    this.lay = layout(this.design);
    this.stats = analyze(this.design);
    this.rebuildRocket();
    this.updateMarkers();
    this.paintStats();
    this.renderList();
    $('vUndo').disabled = !this.undo.length; $('vRedo').disabled = !this.redo.length;
    $('vMoney').textContent = career.sandbox() ? 'Sandbox' : fmt$(career.funds);
    this.hint();
    saveLast(this.design);
  }

  rebuildRocket() {
    for (const c of [...this.rocket.children]) if (c !== this.markers && c !== this.ghost) { this.rocket.remove(c); }
    this.pickables = [];
    let minY = 0, maxY = 0;
    if (!this.design.parts.length) { minY = -0.5; maxY = 0.5; }
    this.lay.forEach((L) => {
      const o = makePart(L.def, { outlines: true });
      o.position.set(L.pos[0], L.pos[1], L.pos[2]); o.rotation.y = L.rotY;
      o.userData.idx = L.i;
      o.traverse((m) => { if (m.isMesh) { m.userData.idx = L.i; this.pickables.push(m); } });
      this.rocket.add(o);
      minY = Math.min(minY, L.pos[1] - L.def.h / 2 - (L.def.drop || 0)); maxY = Math.max(maxY, L.pos[1] + L.def.h / 2);
    });
    this.rocket.position.y = -minY + 0.05;
    this.top = maxY - minY;
    this.tgt.set(0, (maxY - minY) / 2 + 0.05, 0);
    this.tDist = Math.max(11, this.top * 1.25 + 4);
    // maybe a highlight on the selected part
    this.sel.visible = false;
    if (this.selIdx >= 0 && this.lay[this.selIdx]) {
      const L = this.lay[this.selIdx], r = Math.max(L.def.r, L.def.rr || 0, 0.3);
      this.sel.box.set(new THREE.Vector3(L.pos[0] - r, L.pos[1] - L.def.h / 2, L.pos[2] - r), new THREE.Vector3(L.pos[0] + r, L.pos[1] + L.def.h / 2, L.pos[2] + r));
      this.sel.position.set(0, this.rocket.position.y, 0); this.sel.visible = true;
    }
  }

  updateMarkers() {
    for (const c of [...this.markers.children]) { this.markers.remove(c); }
    this.clearGhost(); this.hover = null;
    const id = this.palette;
    if (!id) return;
    const def = PARTS[id], d = this.design;
    const add = (pos, info) => {
      const g = new THREE.Group();
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshBasicMaterial({ color: 0x37ffe0, depthTest: false, transparent: true, opacity: 0.95 }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ color: 0x37ffe0, depthTest: false, transparent: true, opacity: 0.2 }));
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      dot.renderOrder = halo.renderOrder = 20; hit.userData.marker = info; g.add(dot, halo, hit); g.position.set(pos[0], pos[1], pos[2]); g.userData.pulse = Math.random() * 6;
      this.markers.add(g);
    };
    if (!d.parts.length) { if (def.cat === 'pod') add([0, 0, 0], { parent: -1, node: 'b' }); return; }
    const seenGroups = new Set();
    this.lay.forEach((L) => {
      const q = L.q;
      if (q.g) { const key = q.g + ':' + q.t; if (seenGroups.has(key)) return; seenGroups.add(key); }
      if (!whyNot(d, L.i, 't', id)) add([L.pos[0], L.pos[1] + L.def.h / 2, L.pos[2]], { parent: L.i, node: 't' });
      if (!whyNot(d, L.i, 'b', id)) add([L.pos[0], L.pos[1] - L.def.h / 2, L.pos[2]], { parent: L.i, node: 'b' });
      if (!whyNot(d, L.i, 's', id)) {
        const a = (L.q.n === 's' ? L.q.a || 0 : this.base) * Math.PI / 180, ext = L.def.radialOnly ? L.def.rr / 2 : L.def.r;
        const dirx = Math.cos(a), dirz = Math.sin(a);
        for (const slot of ['top', 'mid', 'bot']) {
          if (L.def.radialOnly && slot !== 'mid') continue;
          const y = slot === 'top' ? L.pos[1] + L.def.h / 2 - 0.25 : slot === 'bot' ? L.pos[1] - L.def.h / 2 + 0.25 : L.pos[1];
          add([L.pos[0] + dirx * (ext + 0.05), y, L.pos[2] + dirz * (ext + 0.05)], { parent: L.i, node: 's', slot });
        }
      }
    });
  }

  clearGhost() { for (const c of [...this.ghost.children]) this.ghost.remove(c); this.ghostKey = ''; }
  showGhost(info) {
    const key = JSON.stringify(info) + this.sym + this.base + this.palette;
    if (key === this.ghostKey) return; this.clearGhost(); this.ghostKey = key;
    const res = addPart(this.design, info.parent, info.node, info.slot, this.palette, this.sym, this.base);
    if (res.err) return;
    const lay = layout(res.design);
    const mat = new THREE.MeshBasicMaterial({ color: 0x37ffe0, transparent: true, opacity: 0.45, depthWrite: false });
    for (const i of res.added) {
      const L = lay[i], o = makePart(L.def, { outlines: false });
      o.traverse((m) => { if (m.isMesh) m.material = mat; });
      o.position.set(L.pos[0], L.pos[1], L.pos[2]); o.rotation.y = L.rotY; this.ghost.add(o);
    }
    if (!this.design.parts.length) this.ghost.position.y = 0; // root ghost sits at the origin
  }

  // ---------------------------------------------------------------- panels
  hint() {
    const h = $('vhint'), d = this.design;
    if (this.palette) h.textContent = this.markers.children.length ? 'Click a glowing dot to attach: ' + PARTS[this.palette].name + (PARTS[this.palette].radial && d.parts.length ? '   (Q / E turn it around the rocket)' : '') : 'There is no open spot for that part. Pick another part, or remove something.';
    else if (!d.parts.length) h.textContent = 'Start here: pick a POD from the list, then click the glowing dot.';
    else h.textContent = 'Click a part to select it (Delete removes it). Drag to look around. Pick any part in the list to add more.';
  }

  renderList() {
    for (const b of $('vCats').children) b.classList.toggle('sel', b.dataset.c === this.cat);
    const list = $('vList'); list.innerHTML = '';
    for (const p of PART_LIST.filter((x) => x.cat === this.cat)) {
      const owned = career.unlocked(p.id);
      const t = el('div', 'tile' + (owned ? '' : ' locked') + (this.palette === p.id ? ' sel' : ''));
      t.innerHTML = '<img alt="">' + '<div class="nm">' + p.name + '</div><div class="pr">' + (owned ? 'Owned' : fmt$(p.price)) + '</div>';
      t.firstChild.src = this.icons.get(p.id);
      t.onclick = () => {
        this.hooks.sound.click();
        if (!owned) { this.hooks.openShop(p.id); return; }
        this.palette = this.palette === p.id ? null : p.id; this.selIdx = -1; this.updateMarkers(); this.renderList(); this.hint(); this.rebuildRocket();
      };
      t.onmouseenter = () => this.info(p); t.onmouseleave = () => this.info(null);
      list.appendChild(t);
    }
  }
  info(p) {
    const box = $('pinfo');
    if (!p) { box.classList.add('hide'); return; }
    box.classList.remove('hide'); box.innerHTML = '<b>' + p.name + '</b><br>' + p.desc + '<div class="st">' + partFacts(p) + '</div>';
  }

  paintStats() {
    const s = this.stats, box = $('vStats'), d = this.design;
    const row = (k, v, cls) => '<div class="stat ' + (cls || '') + '"><span>' + k + '</span><b>' + v + '</b></div>';
    if (!d.parts.length) { box.innerHTML = '<h3>YOUR ROCKET</h3><p style="opacity:.8;font-size:14px;line-height:1.4">Nothing here yet. Pick a <b>pod</b> from the list on the left to start, then add a fuel tank and an engine below it.</p><h3>NEED IDEAS?</h3><button class="small alt" id="vIdeas">Load a starter rocket</button>'; $('vIdeas').onclick = () => this.hooks.openLoad(); return; }
    let h = '<h3>YOUR ROCKET</h3>';
    h += row('Parts', d.parts.length) + row('Mass', fmtMass(s.mass)) + row('Fuel', fmtMass(s.fuel)) + row('Height', s.height.toFixed(1) + ' m');
    h += row('Thrust (ground)', s.thrustAsl ? (s.thrustAsl / 1000).toFixed(0) + ' kN' : '-');
    h += row('Lift-off power (TWR)', s.thrustAsl ? s.twrAsl.toFixed(2) : '-', s.twrAsl < 1 ? 'bad' : s.twrAsl > 1.3 ? 'good' : '');
    h += row('Total speed boost (delta-v)', Math.round(s.dv).toLocaleString('en-US') + ' m/s', s.dv > 3400 ? 'good' : '');
    if (!career.sandbox()) h += row('Parts value', fmt$(costOf(d)));
    h += '<h3>ONE STAGE AT A TIME</h3>';
    for (const st of s.stages) h += '<div class="stat"><span>Press ' + (st.stage + 1) + ': ' + Math.round(st.dv).toLocaleString('en-US') + ' m/s</span><b>' + st.twr.toFixed(1) + ' TWR</b></div>';
    if (!s.stages.length) h += '<div style="font-size:13px;opacity:.7">Add an engine to see this.</div>';
    const miss = missingParts(d, career.unlockedSet());
    const w = s.warnings.slice();
    if (miss.length) w.unshift('Locked parts: ' + miss.map((m) => PARTS[m].name).join(', ') + '. Unlock them in the shop.');
    if (w.length) h += w.map((x) => '<div class="warnbox">' + x + '</div>').join('');
    else if (s.ok) h += '<div class="warnbox okay">Looks ready to fly! Press LAUNCH.</div>';
    h += '<h3>STAGING</h3><div style="font-size:12px;opacity:.7;margin-bottom:4px">What happens each time you press Space.</div>';
    const st = stagesOf(d, this.lay), groups = stageGroups(d, this.lay);
    if (!groups.length) h += '<div style="font-size:13px;opacity:.7">Nothing to stage yet.</div>';
    for (const g of groups) {
      h += '<div class="stg"><div class="hd"><span>Press ' + (g.stage + 1) + '</span></div>';
      const done = new Set();
      for (const i of g.parts) {
        const q = d.parts[i], key = q.g ? q.g + ':' + q.t : 'i' + i;
        if (done.has(key)) continue; done.add(key);
        const n = q.g ? d.parts.filter((x) => x.g === q.g && x.t === q.t).length : 1;
        h += '<div class="it"><img src="' + this.icons.get(q.t) + '"><span>' + (n > 1 ? n + ' x ' : '') + PARTS[q.t].name + '<small style="opacity:.6"> ' + verb(PARTS[q.t]) + '</small></span><button data-m="' + i + '" data-d="-1">&#9650;</button><button data-m="' + i + '" data-d="1">&#9660;</button></div>';
      }
      h += '</div>';
    }
    if (d.parts.some((x) => x.st !== undefined)) h += '<button class="small ghost" id="vAuto">Back to automatic staging</button>';
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

  launch() {
    const s = this.stats, d = this.design;
    const miss = missingParts(d, career.unlockedSet());
    if (!d.parts.length || !s.hasPod) { this.hooks.toast('Start with a pod!', 'bad'); return; }
    if (miss.length) { this.hooks.toast('Unlock first: ' + miss.map((m) => PARTS[m].name).join(', '), 'bad'); return; }
    if (!s.ok) { this.hooks.toast(s.warnings[0] || 'This rocket cannot lift off yet.', 'bad'); return; }
    d.name = $('vName').value || d.name; saveLast(d);
    this.hooks.onLaunch(cloneDesign(d));
  }

  // ---------------------------------------------------------------- mouse and keys
  pointer(e) { const r = this.renderer.domElement.getBoundingClientRect(); this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.mouse, this.camera); }
  onDown(e) { if (!this.open_) return; this.drag = { x: e.clientX, y: e.clientY, moved: 0, btn: e.button }; }
  onMove(e) {
    if (!this.open_) return;
    if (this.drag) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.moved > 4) { this.yaw -= dx * 0.008; this.pitch = Math.max(-0.2, Math.min(1.45, this.pitch + dy * 0.008)); }
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      return;
    }
    this.pointer(e);
    if (this.palette) {
      const hits = this.ray.intersectObjects(this.markers.children.map((g) => g.children[2]), false);
      if (hits.length) { this.hover = hits[0].object.userData.marker; this.showGhost(this.hover); } else { this.hover = null; this.clearGhost(); }
      this.renderer.domElement.style.cursor = hits.length ? 'pointer' : 'default';
    }
  }
  onUp(e) {
    if (!this.open_ || !this.drag) return;
    const moved = this.drag.moved; this.drag = null;
    if (moved > 5 || e.target !== this.renderer.domElement) return;
    this.pointer(e);
    if (this.palette) {
      const hits = this.ray.intersectObjects(this.markers.children.map((g) => g.children[2]), false);
      if (hits.length) { const m = hits[0].object.userData.marker; this.place(m.parent, m.node, m.slot); }
      else { this.palette = null; this.updateMarkers(); this.renderList(); this.hint(); }
      return;
    }
    const hits = this.ray.intersectObjects(this.pickables || [], false);
    this.selIdx = hits.length ? hits[0].object.userData.idx : -1;
    this.rebuildRocket();
    if (this.selIdx >= 0) { const L = this.lay[this.selIdx]; this.info(L.def); this.hooks.toast(L.def.name + ' selected. Press Delete to remove it.', ''); }
    else this.info(null);
  }
  onKey(e) {
    if (!this.open_ || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'delete' || k === 'backspace') { if (this.selIdx >= 0) { e.preventDefault(); this.remove(this.selIdx); } }
    else if (k === 'escape') { this.palette = null; this.selIdx = -1; this.updateMarkers(); this.rebuildRocket(); this.renderList(); this.hint(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); this.doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.doRedo(); }
    else if (k === 'q' || k === 'e') { this.base = (this.base + (k === 'q' ? -15 : 15) + 360) % 360; this.updateMarkers(); }
  }

  // ---------------------------------------------------------------- drawing
  render(dt) {
    this.t += dt;
    const k = Math.min(1, dt * 6);
    this.target.lerp(this.tgt, k); this.dist += (this.tDist - this.dist) * k;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + Math.sin(this.pitch) * this.dist + 0.5, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.camera.lookAt(this.target);
    for (const g of this.markers.children) {
      const s = 1 + 0.18 * Math.sin(this.t * 5 + g.userData.pulse);
      const sc = Math.max(0.5, this.camera.position.distanceTo(g.getWorldPosition(new THREE.Vector3())) * 0.07) * s;
      g.children[0].scale.setScalar(sc); g.children[1].scale.setScalar(sc * 1.1); g.children[2].scale.setScalar(Math.max(1, sc * 1.2));
    }
    const r = this.renderer;
    r.setClearColor(0x15103a, 1); r.clear(); r.render(this.scene, this.camera);
  }
}

// ---- small text helpers shared with the shop
export function fmtMass(kg) { return kg >= 10000 ? (kg / 1000).toFixed(1) + ' t' : kg >= 1000 ? (kg / 1000).toFixed(2) + ' t' : Math.round(kg) + ' kg'; }
function verb(p) { return isEngine(p) ? 'lights up' : p.cat === 'decoupler' ? 'lets go' : isChute(p) ? 'arms' : ''; }
export function partFacts(p) {
  const bits = [fmtMass(p.mass) + (p.fuel ? ' + ' + fmtMass(p.fuel) + ' fuel' : '')];
  if (p.F) bits.push((p.F / 1000).toFixed(0) + ' kN, Isp ' + p.ispAsl + '/' + p.ispVac + ' s' + (p.solid ? ', solid' : ''));
  if (p.torque) bits.push('turning ' + (p.torque / 1000).toFixed(0) + ' kNm');
  if (p.chuteArea) bits.push('drag area ' + p.chuteArea + ' m2');
  if (p.crew) bits.push(p.crew + ' Pip' + (p.crew > 1 ? 's' : ''));
  bits.push((p.size === 'X' ? '3.75' : p.size === 'L' ? '2.5' : '1.25') + ' m');
  return bits.join(' &middot; ');
}
