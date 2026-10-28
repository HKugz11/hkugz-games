// ESCAPE DA TRAZ - the prisoner you control, the simple toon figure builder shared with guards, and the chase camera.
import { THREE, V3, scene, toon, QL, clamp, lerp, angDiff, S, W, camera } from './core.js?v=1';
import { world, moveEntity } from './physics.js?v=1';

const dark = toon(0x1c1c22); dark.userData.shared = true;
let GEO = null;
function geos() {
  if (GEO) return GEO; GEO = {};
  GEO.body = new THREE.CapsuleGeometry(.4, .62, 4, 12); GEO.body.translate(0, .95, 0);
  GEO.head = new THREE.SphereGeometry(.3, 14, 10); GEO.head.translate(0, 1.72, 0);
  GEO.eye = new THREE.SphereGeometry(.045, 6, 6);
  GEO.leg = new THREE.CapsuleGeometry(.12, .5, 3, 8); GEO.leg.translate(0, -.25, 0); GEO.leg.userData.shared = true;
  GEO.arm = new THREE.CapsuleGeometry(.1, .42, 3, 8); GEO.arm.translate(0, -.21, 0); GEO.arm.userData.shared = true;
  return GEO;
}
// a toon humanoid: body color + optional horizontal stripe bands (prisoner look) or a cap (guard look)
export function makeFigure({ body = 0xff8a3a, skin = 0xe8b588, stripes = false, cap = null, armCol = null }) {
  const G = geos(), g = new THREE.Group(), torso = new THREE.Group(); g.add(torso);
  const bodyMat = toon(body), bm = new THREE.Mesh(G.body, bodyMat); bm.castShadow = QL.shadow > 0; torso.add(bm);
  if (stripes) for (const y of [.55, .95, 1.35]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .17, 12, 1, true), toon(0xf4f0e0)); s.position.y = y; torso.add(s); }
  const head = new THREE.Mesh(G.head, toon(skin)); head.castShadow = QL.shadow > 0; torso.add(head);
  for (const sx of [-.12, .12]) { const e = new THREE.Mesh(GEO.eye, toon(0x18141a)); e.position.set(sx, 1.76, -.27); torso.add(e); }
  if (cap) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, .18, 14), toon(cap)); c.position.set(0, 2, -.02); torso.add(c); const brim = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .05, 14), toon(cap)); brim.position.set(0, 1.93, -.16); torso.add(brim); }
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  for (const [lg, x] of [[legL, -.17], [legR, .17]]) { lg.add(new THREE.Mesh(G.leg, dark)); lg.position.set(x, .55, 0); torso.add(lg); }
  const am = toon(armCol || body); for (const [ag, x] of [[armL, -.46], [armR, .46]]) { ag.add(new THREE.Mesh(G.arm, am)); ag.position.set(x, 1.3, 0); torso.add(ag); }
  return { g, torso, legL, legR, armL, armR };
}

const EYE = 1.55;
export class Actor {
  constructor(figure, r = .4, h = 1.7) {
    this.fig = figure; scene.add(figure.g); this.pos = new V3(); this.vel = new V3(); this.r = r; this.h = h; this.onGround = false; this.ground = null; this.yaw = 0; this.walkPh = Math.random() * 6;
  }
  get eye() { return this.pos.y + EYE; }
  place(x, z, yaw) { this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.fig.g.position.set(x, 0, z); this.fig.torso.rotation.y = yaw; }
  animate(dt, moveSpeed) {
    this.fig.g.position.copy(this.pos); const mv = clamp(moveSpeed / 3.4, 0, 1);
    this.walkPh += dt * (5.2 + moveSpeed * 1.6);
    this.fig.legL.rotation.x = Math.sin(this.walkPh) * .85 * mv; this.fig.legR.rotation.x = -Math.sin(this.walkPh) * .85 * mv;
    this.fig.armL.rotation.x = -Math.sin(this.walkPh) * .7 * mv; this.fig.armR.rotation.x = Math.sin(this.walkPh) * .7 * mv;
    this.fig.torso.rotation.y = this.yaw;
  }
}

export class Prisoner extends Actor {
  constructor() { super(makeFigure({ body: 0xff8a3a, stripes: true, armCol: 0xff8a3a })); this.r = .38; this.h = 1.7; this.speed = 3.6; this.inp = { mx: 0, mz: 0 }; this.picking = false; }
  step(dt, camYaw) {
    const inp = this.picking ? { mx: 0, mz: 0 } : this.inp, v = this.vel;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = fx * inp.mz + rx * inp.mx, wz = fz * inp.mz + rz * inp.mx; const m = Math.hypot(wx, wz); if (m > 1) { wx /= m; wz /= m; }
    const tx = wx * this.speed, tz = wz * this.speed, k = Math.min(1, 12 * dt);
    v.x += (tx - v.x) * k; v.z += (tz - v.z) * k;
    const sp = Math.hypot(v.x, v.z); if (sp > .5 && !this.picking) this.yaw += angDiff(Math.atan2(-v.x, -v.z), this.yaw) * Math.min(1, dt * 10);
    moveEntity(this, dt, 24); this.animate(dt, this.picking ? 0 : sp);
    // "moving" for stealth purposes means actually holding a direction right now, not just still coasting from momentum -
    // releasing the keys should make you safe immediately, not a few frames later.
    this.moving = !this.picking && (Math.abs(this.inp.mx) > .05 || Math.abs(this.inp.mz) > .05);
  }
}

export class Guest extends Actor { // a non-colliding humanoid used for guards (kinematic: follows its path exactly, no physics)
  constructor(opts) { super(makeFigure(opts)); }
  animate(dt, moveSpeed) { super.animate(dt, moveSpeed); }
}

// ------------------------------------------------------------------ chase camera: settles in behind the player, drag (mouse/touch) to glance around
export const cam = { yaw: 0, pitch: .3, dist: 10, tx: 0, ty: 0, tz: 0, init: false, manual: 0, shake: 0 };
export function updateCamera(dt, p) {
  const tx = p.pos.x, ty = p.pos.y + 1.3, tz = p.pos.z;
  if (!cam.init) { cam.tx = tx; cam.ty = ty; cam.tz = tz; cam.init = true; }
  cam.tx += (tx - cam.tx) * Math.min(1, 1 - Math.exp(-dt * 16)); cam.tz += (tz - cam.tz) * Math.min(1, 1 - Math.exp(-dt * 16)); cam.ty += (ty - cam.ty) * Math.min(1, 1 - Math.exp(-dt * 10));
  cam.manual = Math.max(0, cam.manual - dt);
  const cp = Math.cos(cam.pitch), dx = Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = Math.cos(cam.yaw) * cp;
  const r = world.raycast(cam.tx, cam.ty, cam.tz, dx, dy, dz, cam.dist + .6), t = Math.min(cam.dist, Math.max(1.1, r.t - .4));
  camera.position.set(cam.tx + dx * t, cam.ty + dy * t, cam.tz + dz * t); camera.lookAt(cam.tx, cam.ty, cam.tz);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2.2); camera.position.x += (Math.random() - .5) * cam.shake * .35; camera.position.y += (Math.random() - .5) * cam.shake * .35; }
}
