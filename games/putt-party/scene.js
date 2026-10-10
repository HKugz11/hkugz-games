// PUTT PARTY - builds one hole as a toon 3D scene from its description: floor, walls, bumpers, windmills, sliders, sand, water, boost strips, pipes, the cup and the scenery around it.
import { THREE, scene, toon, INK, QL, rng, TAU, clamp, lerp } from './core.js?v=8';
import { BALL_R, CUP_R, polyArea } from './golf.js?v=8';
import { THEMES } from './holes.js?v=8';

const unit = new THREE.BoxGeometry(1, 1, 1); unit.userData.shared = true;
const TM = new THREE.Matrix4(), TQ = new THREE.Quaternion(), TE = new THREE.Euler(), TP = new THREE.Vector3(), TS = new THREE.Vector3(), TC = new THREE.Color();
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; };
const stripeTex = (a, b) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#' + a.toString(16).padStart(6, '0'); x.fillRect(0, 0, 64, 32); x.fillStyle = '#' + b.toString(16).padStart(6, '0'); x.fillRect(0, 32, 64, 32); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 8, 1 / 4); return t; };
const sandTex = () => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f2d894'; x.fillRect(0, 0, 64, 64); const R = rng(7); for (let i = 0; i < 90; i++) { x.fillStyle = R() < .5 ? '#e3c274' : '#fff0c0'; x.fillRect(R() * 64, R() * 64, 2, 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
const chevTex = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ff8a1a'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#fff2a0'; x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(14, 44); x.lineTo(32, 18); x.lineTo(50, 44); x.stroke(); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };

class Inst {   // a bunch of boxes drawn in one go
  constructor(mat, n) { this.im = new THREE.InstancedMesh(unit, mat, Math.max(1, n)); this.im.count = 0; this.im.frustumCulled = false; this.im.castShadow = QL.shadow > 0; this.im.receiveShadow = QL.shadow > 0; this.n = 0; }
  add(cx, cy, cz, sx, sy, sz, ry, color) { TP.set(cx, cy, cz); TS.set(sx, sy, sz); TQ.setFromEuler(TE.set(0, ry, 0)); TM.compose(TP, TQ, TS); this.im.setMatrixAt(this.n, TM); TC.setHex(color); this.im.setColorAt(this.n, TC); this.n++; this.im.count = this.n; this.im.instanceMatrix.needsUpdate = true; if (this.im.instanceColor) this.im.instanceColor.needsUpdate = true; }
}

export function buildHole(C, def) {
  const th = THEMES[def.theme], group = new THREE.Group(), anim = []; scene.add(group);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (const p of def.polys) for (const [x, z] of p) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  // floor
  const tex = stripeTex(th.floor[0], th.floor[1]), floorMat = toon(0xffffff, { map: tex });
  for (const p of def.polys) { const sh = new THREE.Shape(); p.forEach(([x, z], i) => i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)); const g = new THREE.ExtrudeGeometry(sh, { depth: .35, bevelEnabled: false }); const m = new THREE.Mesh(g, floorMat); m.rotation.x = -Math.PI / 2; m.position.y = -.35; m.receiveShadow = QL.shadow > 0; group.add(m); }
  // walls: the polygon edges (the wall stands just outside the line the ball bounces off), extra walls and blocks
  const wallI = new Inst(toon(0xffffff), 200), trimI = new Inst(toon(0xffffff), 200), H = .55; group.add(wallI.im, trimI.im);
  const addWall = (x0, z0, x1, z1, off, nx, nz) => { const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ang = -Math.atan2(dz, dx); const cx = (x0 + x1) / 2 + nx * off, cz = (z0 + z1) / 2 + nz * off; wallI.add(cx, H / 2 - .02, cz, len + .42, H, .4, ang, th.wall); trimI.add(cx, H - .02, cz, len + .46, .09, .46, ang, th.trim); };
  for (const p of def.polys) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; let nx = -dz / l, nz = dx / l; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (def.polys.some(q => inPoly(mx + nx * .3, mz + nz * .3, q))) { nx = -nx; nz = -nz; } addWall(a[0], a[1], b[0], b[1], .2, nx, nz); }
  for (const w of def.walls || []) addWall(w[0], w[1], w[2], w[3], 0, 0, 0);
  for (const r of def.blocks || []) { const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2; wallI.add(cx, H / 2 - .02, cz, r[2] - r[0], H, r[3] - r[1], 0, th.wall); trimI.add(cx, H - .02, cz, r[2] - r[0] + .06, .09, r[3] - r[1] + .06, 0, th.trim); }
  // bumpers
  const bumpMat = toon(0xff4fa8), capMat = toon(0xffffff), bumps = [];
  for (const [x, z, r] of def.bumpers || []) { const g = new THREE.Group(); g.position.set(x, 0, z); const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, .7, 20), bumpMat); body.position.y = .33; body.castShadow = QL.shadow > 0; const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * .78, r * .78, .08, 20), capMat); cap.position.y = .72; g.add(body, cap); if (QL.hull) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r + .06, r * 1.05 + .06, .76, 20), INK); o.position.y = .33; g.add(o); } group.add(g); bumps.push({ g, x, z, pulse: 0 }); }
  // windmills
  const bladeMat = toon(0xfff0d0), hubMat = toon(0xff4a5a); const mills = [];
  for (const m of def.mills || []) { const g = new THREE.Group(); g.position.set(m.x, 0, m.z); const hub = new THREE.Mesh(new THREE.CylinderGeometry(m.hub || .6, (m.hub || .6) * 1.1, .9, 16), hubMat); hub.position.y = .42; g.add(hub); const rot = new THREE.Group(); g.add(rot); const n = m.n || 2; for (let i = 0; i < n; i++) { const arm = new THREE.Group(); arm.rotation.y = -i * TAU / n; const bl = new THREE.Mesh(unit, bladeMat); bl.scale.set(m.len, .55, .34); bl.position.set(m.len / 2, .36, 0); bl.castShadow = QL.shadow > 0; arm.add(bl); rot.add(arm); } group.add(g); mills.push({ m, rot }); }
  // sliding walls
  const slideMat = toon(0xffd34e), sliders = [];
  for (const s of def.sliders || []) { const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0), ang = -Math.atan2(s.z1 - s.z0, s.x1 - s.x0), m = new THREE.Mesh(unit, slideMat); m.scale.set(len, H, .3); m.rotation.y = ang; m.castShadow = QL.shadow > 0; group.add(m); sliders.push({ s, m, cx: (s.x0 + s.x1) / 2, cz: (s.z0 + s.z1) / 2 }); }
  // sand, water, boost strips
  const sandM = new THREE.MeshToonMaterial({ map: sandTex(), gradientMap: toon(0).gradientMap });
  for (const r of def.sand || []) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(r[2] - r[0], r[3] - r[1]), sandM); pl.rotation.x = -Math.PI / 2; pl.position.set((r[0] + r[2]) / 2, .02, (r[1] + r[3]) / 2); pl.receiveShadow = QL.shadow > 0; group.add(pl); const edge = new THREE.Mesh(new THREE.PlaneGeometry(r[2] - r[0] + .5, r[3] - r[1] + .5), toon(0xc8a050)); edge.rotation.x = -Math.PI / 2; edge.position.set((r[0] + r[2]) / 2, .012, (r[1] + r[3]) / 2); group.add(edge); }
  const waterMat = new THREE.MeshToonMaterial({ color: 0x35b6ff, transparent: true, opacity: .85, gradientMap: toon(0).gradientMap }); const waters = [];
  for (const w of def.water || []) { const geo = w.length === 4 ? new THREE.PlaneGeometry(w[2] - w[0], w[3] - w[1]) : new THREE.CircleGeometry(w[2], 28), pl = new THREE.Mesh(geo, waterMat); pl.rotation.x = -Math.PI / 2; pl.position.set(w.length === 4 ? (w[0] + w[2]) / 2 : w[0], .03, w.length === 4 ? (w[1] + w[3]) / 2 : w[1]); group.add(pl); if (w.length === 4) { const rim = new THREE.Mesh(new THREE.PlaneGeometry(w[2] - w[0] + .6, w[3] - w[1] + .6), toon(0xffffff)); rim.rotation.x = -Math.PI / 2; rim.position.set((w[0] + w[2]) / 2, .015, (w[1] + w[3]) / 2); group.add(rim); } waters.push(pl); }
  const boostTexs = [];
  for (const b of def.boost || []) { const r = b.rect, w = r[2] - r[0], d = r[3] - r[1], t = chevTex(), pl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: t })); pl.rotation.x = -Math.PI / 2; pl.rotation.z = Math.atan2(-b.dir[0], -b.dir[1]); pl.position.set((r[0] + r[2]) / 2, .025, (r[1] + r[3]) / 2); const len = Math.abs(b.dir[0]) > .5 ? w : d; t.repeat.set(Math.abs(b.dir[0]) > .5 ? (d / 1.8) : (w / 1.8), len / 1.8); group.add(pl); boostTexs.push(t); }
  // pipes
  const pipeCols = [0x2ee6ff, 0xff8a1a], pipes = [];
  (def.tele || []).forEach((p, i) => { for (const e of [p.a, p.b]) { const g = new THREE.Group(); g.position.set(e[0], 0, e[1]); const tube = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .55, 20, 1, true), toon(pipeCols[i % 2], { side: THREE.DoubleSide })); tube.position.y = .27; const rim = new THREE.Mesh(new THREE.TorusGeometry(.62, .1, 8, 20), toon(0xffffff)); rim.rotation.x = Math.PI / 2; rim.position.y = .55; const hole = new THREE.Mesh(new THREE.CircleGeometry(.55, 20), new THREE.MeshBasicMaterial({ color: 0x0a0618 })); hole.rotation.x = -Math.PI / 2; hole.position.y = .04; g.add(tube, rim, hole); group.add(g); pipes.push(g); } });
  // the cup and flag, the tee mat
  const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 24), new THREE.MeshBasicMaterial({ color: 0x07030f })); cup.rotation.x = -Math.PI / 2; cup.position.set(C.cup[0], .035, C.cup[1]); group.add(cup);
  const cupRim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + .12, 24), new THREE.MeshBasicMaterial({ color: 0xffffff })); cupRim.rotation.x = -Math.PI / 2; cupRim.position.set(C.cup[0], .036, C.cup[1]); group.add(cupRim);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.6, 8), toon(0xffffff)); pole.position.set(C.cup[0], 1.3, C.cup[1] - .02); group.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .7), new THREE.MeshBasicMaterial({ color: 0xff4a5a, side: THREE.DoubleSide })); cloth.position.set(C.cup[0] + .55, 2.25, C.cup[1]); group.add(cloth);
  const tee = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .05, 20), toon(0xffffff)); tee.position.set(C.tee[0], .02, C.tee[1]); group.add(tee);
  // the ground and scenery around the course
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, ground = new THREE.Mesh(new THREE.CircleGeometry(700, 36), toon(th.ground)); ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -.4, cz); ground.receiveShadow = QL.shadow > 0; group.add(ground);
  buildDecor(group, th, def, { minX, maxX, minZ, maxZ });
  const bounds = { minX, maxX, minZ, maxZ, cx, cz, w: maxX - minX, d: maxZ - minZ };
  return {
    group, bounds, theme: th, bumps, pipes, cloth,
    bump(i) { const b = bumps[i]; if (b) b.pulse = .25; },
    update(t, dt) {
      for (const m of mills) m.rot.rotation.y = -((m.m.phase || 0) + m.m.omega * t);
      for (const s of sliders) { const k = Math.sin(TAU * (t / s.s.period + (s.s.phase || 0))); s.m.position.set(s.cx + s.s.dx * k, H / 2, s.cz + s.s.dz * k); }
      for (const b of bumps) { if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - dt); b.g.scale.set(1 + b.pulse * .8, 1 - b.pulse * .3, 1 + b.pulse * .8); }
      for (const t2 of boostTexs) t2.offset.y -= dt * 1.2;
      cloth.scale.x = 1 + Math.sin(t * 5) * .1; cloth.rotation.y = Math.sin(t * 3) * .25; for (const p of pipes) p.rotation.y += dt * .8;
    },
    dispose() { scene.remove(group); group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.material.userData.shared) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); },
  };
}

function buildDecor(group, th, def, b) {
  const R = rng(def.name.length * 131 + 7), list = [], T = (g, x, y, z) => { g.translate(x, y, z); return g; };
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, rad = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 6;
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU, d = rad + 3 + R() * 55, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * .9, s = .8 + R() * 1.6;
    // keep the scenery off the course
    if (def.polys.some(p => { for (const [px, pz] of p) if (Math.hypot(px - x, pz - z) < 5) return true; return false; })) continue;
    if (th.deco === 'meadow') { if (R() < .6) { list.push([T(new THREE.CylinderGeometry(.3 * s, .4 * s, 1.6 * s, 8), x, .8 * s, z), 0x8a5a2a]); list.push([T(new THREE.ConeGeometry(1.6 * s, 3 * s, 9), x, 3 * s, z), 0x3fae4a]); list.push([T(new THREE.ConeGeometry(1.2 * s, 2.4 * s, 9), x, 4.6 * s, z), 0x56c85a]); } else { list.push([T(new THREE.SphereGeometry(1.2 * s, 10, 8).scale(1, .7, 1), x, .6 * s, z), 0x4fc060]); } }
    else if (th.deco === 'desert') { if (R() < .55) { list.push([T(new THREE.CylinderGeometry(.5 * s, .5 * s, 3.4 * s, 10), x, 1.7 * s, z), 0x4fa05a]); list.push([T(new THREE.SphereGeometry(.5 * s, 10, 8), x, 3.4 * s, z), 0x4fa05a]); list.push([T(new THREE.CylinderGeometry(.3 * s, .3 * s, 1.4 * s, 8), x + .8 * s, 2 * s, z), 0x4fa05a]); } else { list.push([T(new THREE.DodecahedronGeometry(1.4 * s).scale(1, .7, 1), x, .7 * s, z), 0xc0703a]); } }
    else { const c = [0x2ee6ff, 0xff4fa8, 0xffd31a, 0x8aff3a][Math.floor(R() * 4)]; list.push([T(new THREE.BoxGeometry(.8 * s, 6 * s, .8 * s), x, 3 * s, z), 0x3a2a8a]); list.push([T(new THREE.BoxGeometry(.9 * s, .4 * s, .9 * s), x, 6.1 * s, z), c]); }
  }
  if (!list.length) return; const pos = [], nor = [], colr = [], cc = new THREE.Color();
  for (const [geo, color] of list) { const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position.array, n = g.attributes.normal.array; cc.set(color); for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) colr.push(cc.r, cc.g, cc.b); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  const m = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true })); m.castShadow = QL.shadow > 0; group.add(m);
}
