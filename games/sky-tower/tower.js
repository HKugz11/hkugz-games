// SKY TOWER - builds the tower from a generated layout and keeps everything in it moving. Every moving thing is a pure function
// of the run clock, so two players with the same seed and the same clock see exactly the same tower.
import { THREE, V3, scene, toon, INK, QL, rng, clamp, lerp, TAU, W, sfx, burst, ring, blendSky } from './core.js?v=7';
import { world, sphereVsObb } from './physics.js?v=7';
import { THEMES, TH } from './gen.js?v=7';

const YAX = new V3(0, 1, 0);
const unit = new THREE.BoxGeometry(1, 1, 1); unit.userData.shared = true;
const TM = new THREE.Matrix4(), TQ = new THREE.Quaternion(), TP = new V3(), TS = new V3(), TC = new THREE.Color();
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class Batch {
  constructor(mat, cap, hull) {
    this.im = new THREE.InstancedMesh(unit, mat, Math.max(1, cap)); this.im.count = 0; this.im.frustumCulled = false; this.im.castShadow = QL.shadow > 0 && !mat.isMeshBasicMaterial; this.im.receiveShadow = QL.shadow > 0 && !mat.isMeshBasicMaterial; scene.add(this.im);
    this.hull = hull && QL.hull ? new THREE.InstancedMesh(unit, INK, Math.max(1, cap)) : null; if (this.hull) { this.hull.count = 0; this.hull.frustumCulled = false; scene.add(this.hull); } this.n = 0;
  }
  add(cx, cy, cz, sx, sy, sz, color) { const i = this.n++; this.set(i, cx, cy, cz, sx, sy, sz); TC.setHex(color); this.im.setColorAt(i, TC); if (this.im.instanceColor) this.im.instanceColor.needsUpdate = true; this.im.count = this.n; if (this.hull) this.hull.count = this.n; return i; }
  set(i, cx, cy, cz, sx, sy, sz) {
    TP.set(cx, cy, cz); TS.set(sx, sy, sz); TM.compose(TP, TQ.identity(), TS); this.im.setMatrixAt(i, TM); this.im.instanceMatrix.needsUpdate = true;
    if (this.hull) { TS.set(sx + .14, sy + .14, sz + .14); TM.compose(TP, TQ, TS); this.hull.setMatrixAt(i, TM); this.hull.instanceMatrix.needsUpdate = true; }
  }
}
const chevTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#3d3d5c'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#ffd34e'; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(20, 12); x.lineTo(46, 32); x.lineTo(20, 52); x.stroke(); const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; return tx; })();
const platMat = toon(0xffffff); platMat.userData.shared = true;
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); glowMat.userData.shared = true;

export class Tower {
  constructor(spec) {
    this.spec = spec; this.group = new THREE.Group(); scene.add(this.group); this.boxes = []; this.movers = []; this.crumbles = []; this.spins = []; this.kills = []; this.belts = []; this.cks = []; this.fin = null; this.anim = [];
    const items = spec.items, count = k => items.filter(i => i.k === k).length;
    const nStatic = items.filter(i => i.k === 'plat' && !i.crumble).length, nCr = items.filter(i => i.k === 'plat' && i.crumble).length;
    this.bStatic = new Batch(platMat, nStatic + 8, true); this.bCrumble = new Batch(platMat, nCr + 2, true); this.bMover = new Batch(platMat, count('mover') + 2, true); this.bGlow = new Batch(glowMat, nStatic + nCr + count('kill') + 60, false);
    for (const it of items) {
      if (it.k === 'plat') this.addPlat(it); else if (it.k === 'mover') this.addMover(it); else if (it.k === 'spin') this.addSpin(it); else if (it.k === 'kill') this.addKill(it);
    }
    this.buildDecor();
  }
  addPlat(it) {
    const b = world.add({ minX: it.x - it.sx / 2, maxX: it.x + it.sx / 2, minY: it.y - it.th, maxY: it.y, minZ: it.z - it.sz / 2, maxZ: it.z + it.sz / 2, kind: 'plat', it, ice: !!it.ice, conv: it.convDir || null, bounce: it.bounce || 0, crumble: !!it.crumble, ck: it.ck, fin: !!it.fin });
    this.boxes.push(b); it.box = b;
    const batch = it.crumble ? this.bCrumble : this.bStatic; it.bi = batch.add(it.x, it.y - it.th / 2, it.z, it.sx, it.th, it.sz, it.col); it.batch = batch;
    if (it.crumble) { it.cs = { phase: 'idle', t: 0, y: 0 }; this.crumbles.push(it); }
    if (it.bounce) this.bGlow.add(it.x, it.y + .06, it.z, it.sx - .8, .14, it.sz - .8, 0xffffff);
    if (it.big) { this.bGlow.add(it.x, it.y + .05, it.z, it.sx - .6, .12, it.sz - .6, it.fin ? 0xffd34e : 0x6affb0); }
    if (it.convDir) {   // a conveyor belt: chevrons slide along it in the direction it carries you
      const tex = chevTex.clone(); tex.needsUpdate = true; tex.repeat.set(it.len / 2.2, 1); const g = new THREE.Group(), plane = new THREE.Mesh(new THREE.PlaneGeometry(it.len - .3, it.wid - .3), new THREE.MeshBasicMaterial({ map: tex })), d = it.convDir, mag = Math.hypot(d[0], d[1]) || 1;
      plane.rotation.x = -Math.PI / 2; g.add(plane); g.rotation.y = Math.atan2(-d[1] / mag, d[0] / mag); g.position.set(it.x, it.y + .03, it.z); this.group.add(g); this.belts.push({ tex, speed: mag / 2.2 });
    }
    if (it.ck !== undefined || it.fin) this.cks.push(it);
    if (it.ice) this.bGlow.add(it.x, it.y + .03, it.z, it.sx - .5, .06, it.sz - .5, 0xeafaff);
    if (it.beam) { /* narrow beam: a colored stripe down the middle */ this.bGlow.add(it.x, it.y + .03, it.z, Math.abs(it.dx) * (it.len - .4) + Math.abs(it.dz) * .18, .05, Math.abs(it.dz) * (it.len - .4) + Math.abs(it.dx) * .18, 0xffffff); }
    if (it.fin) this.fin = it;
  }
  addMover(it) {
    const b = world.add({ minX: it.x - it.sx / 2, maxX: it.x + it.sx / 2, minY: it.y - it.th, maxY: it.y, minZ: it.z - it.sz / 2, maxZ: it.z + it.sz / 2, kind: 'mover', it, dx: 0, dy: 0, dz: 0 });
    it.box = b; it.bi = this.bMover.add(it.x, it.y - it.th / 2, it.z, it.sx, it.th, it.sz, it.col); it.base = [it.x, it.y, it.z]; it.last = [it.x, it.y, it.z]; this.movers.push(it);
  }
  addKill(it) {
    this.kills.push({ minX: it.x - it.sx / 2, maxX: it.x + it.sx / 2, minY: it.y - it.sy / 2, maxY: it.y + it.sy / 2, minZ: it.z - it.sz / 2, maxZ: it.z + it.sz / 2 });
    it.gi = this.bGlow.add(it.x, it.y, it.z, it.sx, it.sy, it.sz, 0xff2a4a); this.killItems = this.killItems || []; this.killItems.push(it);
  }
  addSpin(it) {
    const mat = toon(it.col); mat.userData.shared = false; const g = new THREE.Group(); this.group.add(g); const s = { it, g, obbs: [], mat };
    if (it.kind === 'bar') {
      const m = new THREE.Mesh(unit, mat); m.scale.set(it.len, it.th, it.wid); m.castShadow = QL.shadow > 0; g.add(m); g.position.set(it.c[0], it.c[1], it.c[2]);
      const hubm = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, it.th + .5, 12), toon(0xffd34e)); g.add(hubm); const post = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, it.th + 1.4, 8), toon(0x3a2f58)); post.position.y = -.5; g.add(post);
      s.obbs.push({ pos: new V3(), quat: new THREE.Quaternion(), inv: new THREE.Quaternion(), half: new V3(it.len / 2, it.th / 2, it.wid / 2) });
    } else {
      g.position.set(it.c[0], it.c[1], it.c[2]); const rod = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, it.rod, 8), toon(0x3a2f58)); rod.position.y = -it.rod / 2; g.add(rod);
      const head = new THREE.Mesh(unit, mat); head.scale.set(it.head, it.head, it.head); head.position.y = -(it.rod + it.head / 2); head.castShadow = QL.shadow > 0; g.add(head);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), toon(0xffd34e)); g.add(cap);
      s.obbs.push({ pos: new V3(), quat: new THREE.Quaternion(), inv: new THREE.Quaternion(), half: new V3(it.head / 2, it.head / 2, it.head / 2) }, { pos: new V3(), quat: new THREE.Quaternion(), inv: new THREE.Quaternion(), half: new V3(.22, it.rod / 2, .22) });
      s.axis = new V3(it.swing[0], it.swing[1], it.swing[2]).normalize();
    }
    this.spins.push(s);
  }
  buildDecor() {
    const spec = this.spec, top = spec.top, R = rng(spec.seed * 7 + 3);
    // the central column, colored per stage
    spec.stages.forEach((st, i) => {
      const y1 = (spec.stages[i + 1] ? spec.stages[i + 1].y0 : top + 3), y0 = i === 0 ? 0 : st.y0 - .5, th = THEMES[st.theme];
      const m = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.6, Math.max(2, y1 - y0 + .4), 28), toon(th.core)); m.position.set(0, (y0 + y1) / 2, 0); m.castShadow = QL.shadow > 0; m.receiveShadow = QL.shadow > 0; this.group.add(m);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(9.8, 9.8, .5, 28), toon(th.pal[0])); band.position.set(0, y1 - .1, 0); this.group.add(band);
    });
    // checkpoint flags and the finish trophy
    this.flags = [];
    for (const it of this.cks) {
      if (it.fin) continue; const th = THEMES[this.spec.stages[Math.min(it.ck, this.spec.stages.length - 1)].theme];
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 4.2, 8), toon(0xffffff)); pole.position.set(it.x - it.sx / 2 + .7, it.y + 2.1, it.z - it.sz / 2 + .7); this.group.add(pole);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ color: th.pal[1], side: THREE.DoubleSide })); cloth.position.set(pole.position.x + .9, it.y + 3.6, pole.position.z); this.group.add(cloth); this.flags.push({ cloth, phase: R() * 6 });
    }
    if (this.fin) {
      const f = this.fin, g = new THREE.Group(), gold = toon(0xffd34e); g.position.set(f.x, f.y, f.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, .5, 16), gold), stem = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, 1.2, 12), gold), cup = new THREE.Mesh(new THREE.CylinderGeometry(1.2, .6, 1.5, 16), gold);
      base.position.y = .25; stem.position.y = 1.1; cup.position.y = 2.3; g.add(base, stem, cup); this.trophy = g; this.group.add(g);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 140, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false })); beam.position.set(f.x, f.y + 70, f.z); this.group.add(beam);
    }
    // goo sea at the bottom
    const sea = new THREE.Mesh(new THREE.CircleGeometry(900, 40), new THREE.MeshToonMaterial({ color: 0xff6ac8, gradientMap: toon(0).gradientMap })); sea.rotation.x = -Math.PI / 2; sea.position.y = .15; this.group.add(sea); this.sea = sea;
    const foam = new THREE.Mesh(new THREE.RingGeometry(11, 15, 40), new THREE.MeshBasicMaterial({ color: 0xffd0f0, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false })); foam.rotation.x = -Math.PI / 2; foam.position.y = .22; this.group.add(foam); this.foam = foam;
    // clouds
    const cg = new THREE.IcosahedronGeometry(1, 1), cm = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toon(0).gradientMap, fog: true }), n = QL.clouds, cl = new THREE.InstancedMesh(cg, cm, n * 3); cl.frustumCulled = false; let k = 0;
    for (let i = 0; i < n; i++) { const a = R() * TAU, r = 48 + R() * 90, y = R() * (top + 70) - 8, s = 6 + R() * 10; for (let j = 0; j < 3; j++) { TP.set(Math.cos(a) * r + (j - 1) * s * .9, y + R() * 2, Math.sin(a) * r + R() * 4); TS.set(s * (.8 + R() * .5), s * .55, s * (.8 + R() * .5)); TM.compose(TP, TQ.identity(), TS); cl.setMatrixAt(k++, TM); } }
    this.group.add(cl); this.clouds = cl;
  }
  // the stage the player is in, and the sky for that height
  stageAt(y) { const st = this.spec.stages; let i = 0; for (let k = 0; k < st.length; k++) if (y >= st[k].y0 - 1.5) i = k; return i; }
  skyFor(y) {
    const st = this.spec.stages, i = this.stageAt(y), A = THEMES[st[i].theme], nxt = st[i + 1], B = nxt ? THEMES[nxt.theme] : A;
    const f = nxt ? (y - st[i].y0) / (nxt.y0 - st[i].y0) : 0; blendSky(A, B, smooth(.72, 1.0, f));
  }
  gravityAt(y) { const st = this.spec.stages, i = this.stageAt(y); return st[i].grav || 1; }
  // t = run clock in seconds
  update(t, dt) {
    for (const m of this.movers) {
      const s = Math.sin(TAU * (t / m.period + m.phase)) * m.amp, a = m.axis, nx = m.base[0] + a[0] * s, ny = m.base[1] + a[1] * s, nz = m.base[2] + a[2] * s, b = m.box;
      b.dx = nx - m.last[0]; b.dy = ny - m.last[1]; b.dz = nz - m.last[2]; m.last[0] = nx; m.last[1] = ny; m.last[2] = nz;
      world.moveBox(b, nx - m.sx / 2, nx + m.sx / 2, ny - m.th, ny, nz - m.sz / 2, nz + m.sz / 2); this.bMover.set(m.bi, nx, ny - m.th / 2, nz, m.sx, m.th, m.sz);
    }
    for (const it of this.crumbles) {
      const cs = it.cs, b = it.box;
      if (cs.phase === 'shake') { cs.t -= dt; const j = (Math.random() - .5) * .16; it.batch.set(it.bi, it.x + j, it.y - it.th / 2, it.z + j, it.sx, it.th, it.sz); if (cs.t <= 0) { cs.phase = 'fall'; cs.t = .7; cs.y = 0; world.remove(b); } }
      else if (cs.phase === 'fall') { cs.t -= dt; cs.y -= (12 + (.7 - cs.t) * 30) * dt; const k = Math.max(.01, cs.t / .7); it.batch.set(it.bi, it.x, it.y - it.th / 2 + cs.y, it.z, it.sx * k, it.th * k, it.sz * k); if (cs.t <= 0) { cs.phase = 'gone'; cs.t = 2.6; it.batch.set(it.bi, it.x, it.y - 500, it.z, .01, .01, .01); } }
      else if (cs.phase === 'gone') { cs.t -= dt; if (cs.t <= 0) { cs.phase = 'idle'; world.add(b); it.batch.set(it.bi, it.x, it.y - it.th / 2, it.z, it.sx, it.th, it.sz); } }
    }
    for (const s of this.spins) {
      const it = s.it;
      if (it.kind === 'bar') { const ang = it.phase + it.omega * t; s.g.rotation.y = ang; const o = s.obbs[0]; o.pos.set(it.c[0], it.c[1], it.c[2]); o.quat.setFromAxisAngle(YAX, ang); o.inv.copy(o.quat).invert(); }
      else {
        const th = it.amp * Math.sin(it.omega * t + it.phase); s.g.quaternion.setFromAxisAngle(s.axis, th); const q = s.g.quaternion, head = s.obbs[0], rod = s.obbs[1];
        head.quat.copy(q); head.inv.copy(q).invert(); head.pos.set(0, -(it.rod + it.head / 2), 0).applyQuaternion(q).add(s.g.position); rod.quat.copy(q); rod.inv.copy(q).invert(); rod.pos.set(0, -it.rod / 2, 0).applyQuaternion(q).add(s.g.position);
        s.ang = th; s.angVel = it.amp * it.omega * Math.cos(it.omega * t + it.phase);
      }
    }
    for (const f of this.flags) f.cloth.scale.x = 1 + Math.sin(W.time * 5 + f.phase) * .12;
    if (this.trophy) this.trophy.rotation.y += dt * 1.2;
    for (const b of this.belts) b.tex.offset.x -= b.speed * dt;
    if (this.sea) { this.sea.position.y = .15 + Math.sin(W.time * 1.2) * .08; }
    if (this.clouds) { this.clouds.position.x = Math.sin(W.time * .02) * 6; }
  }
  // spinners and kill strips: returns { kind, nx, nz, vx, vz } when the player is touching one
  hazards(pos, r = .4) {
    const x = pos.x, z = pos.z;
    for (const k of this.kills) if (x + r > k.minX && x - r < k.maxX && z + r > k.minZ && z - r < k.maxZ && pos.y + 1.7 > k.minY && pos.y < k.maxY) return { kind: 'zap' };
    for (const s of this.spins) {
      for (let oi = 0; oi < s.obbs.length; oi++) {
        const o = s.obbs[oi];
        for (let h = 0; h < 3; h++) {
          const hit = sphereVsObb(x, pos.y + .35 + h * .55, z, r + .06, o); if (!hit) continue;
          let nx = hit.nx, nz = hit.nz; const m = Math.hypot(nx, nz); if (m < .2) { nx = x - o.pos.x; nz = z - o.pos.z; const mm = Math.hypot(nx, nz) || 1; nx /= mm; nz /= mm; } else { nx /= m; nz /= m; }
          return { kind: 'whack', nx, nz, pen: hit.pen };
        }
      }
    }
    return null;
  }
  pad(i) { return this.cks.find(c => c.ck === i); }
  dispose() { scene.remove(this.group); for (const b of [this.bStatic, this.bCrumble, this.bMover, this.bGlow]) { scene.remove(b.im); b.im.dispose(); if (b.hull) { scene.remove(b.hull); b.hull.dispose(); } } world.clear(); }
}
