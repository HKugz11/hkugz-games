// WOBBLE DASH - the racers: wobbly toon beans with a tight platformer controller (run, jump, dive), plus the follow camera.
import { THREE, V3, scene, toon, QL, clamp, lerp, angDiff, sfx, burst, camera, S, TAU, W } from './core.js?v=12';
import { world, moveEntity, pushOut } from './physics.js?v=12';

export const MOVE = { speed: 9, sprint: 1.28, jump: 11.5, g: 32, dive: 12.5 };
const dark = toon(0x2a2140), white = toon(0xffffff); dark.userData.shared = white.userData.shared = true;
const T = (g, x, y, z) => { g.translate(x, y, z); return g; };
let GEO = null;
function geos() {
  if (GEO) return GEO; GEO = {};
  GEO.body = new THREE.CapsuleGeometry(.46, .5, 4, 14); T(GEO.body, 0, .98, 0);
  GEO.eyes = (() => { const a = [], c = new THREE.Color(); const parts = [[new THREE.SphereGeometry(.12, 10, 8), -.17, 1.18, -.4, 0xffffff], [new THREE.SphereGeometry(.12, 10, 8), .17, 1.18, -.4, 0xffffff], [new THREE.SphereGeometry(.065, 8, 6), -.17, 1.18, -.5, 0x1a1030], [new THREE.SphereGeometry(.065, 8, 6), .17, 1.18, -.5, 0x1a1030], [new THREE.BoxGeometry(.2, .05, .06), 0, .98, -.47, 0xff7a8a]]; return parts; })();
  GEO.leg = T(new THREE.CapsuleGeometry(.13, .16, 3, 8), 0, -.14, 0); GEO.arm = T(new THREE.CapsuleGeometry(.1, .3, 3, 8), 0, -.2, 0); GEO.leg.userData.shared = GEO.arm.userData.shared = true;
  GEO.blob = new THREE.CircleGeometry(1, 20); GEO.blob.userData.shared = true; return GEO;
}
function beanGeo(color, tuft) {   // body + face in one mesh: the body color is baked into the vertex colors
  const G = geos(), pos = [], nor = [], col = [], cc = new THREE.Color();
  const push = (geo, c) => { const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position.array, n = g.attributes.normal.array; cc.set(c); for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(cc.r, cc.g, cc.b); };
  push(G.body, color); for (const [geo, x, y, z, c] of G.eyes) push(geo.clone().translate(x, y, z), c);
  if (tuft === 1) push(new THREE.SphereGeometry(.14, 8, 6).translate(0, 1.72, 0), 0xffffff); else if (tuft === 2) push(new THREE.ConeGeometry(.2, .42, 8).translate(0, 1.85, 0), 0xffd34e); else if (tuft === 3) push(new THREE.TorusGeometry(.44, .06, 6, 16).rotateX(Math.PI / 2).translate(0, 1.0, 0), 0xffffff);
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return out;
}
const vcolMat = toon(0xffffff, { vertexColors: true }); vcolMat.userData.shared = true;
export function makeBean(color, tuft = 0) {
  const G = geos(), g = new THREE.Group(), body = new THREE.Group(); g.add(body); const bm = new THREE.Mesh(beanGeo(color, tuft), vcolMat); bm.castShadow = QL.shadow > 0; body.add(bm);
  const armMat = toon(color); const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  for (const [lg, x] of [[legL, -.2], [legR, .2]]) { lg.add(new THREE.Mesh(G.leg, dark)); lg.position.set(x, .46, 0); body.add(lg); }
  for (const [ag, x] of [[armL, -.5], [armR, .5]]) { ag.add(new THREE.Mesh(G.arm, armMat)); ag.position.set(x, 1.15, 0); body.add(ag); }
  return { g, body, bm, legL, legR, armL, armR, armMat };
}

export class Racer {
  constructor(name, color, tuft, isPlayer) {
    this.name = name; this.color = color; this.tuft = tuft; this.isPlayer = !!isPlayer; this.pos = new V3(); this.vel = new V3(); this.r = .42; this.h = 1.7; this.onGround = false; this.ground = null; this.yaw = 0; this.alive = false;
    this.coyote = 0; this.jumpBuf = 0; this.rising = false; this.stun = 0; this.prone = 0; this.diveCD = 0; this.squash = 0; this.walkPh = Math.random() * 6; this.platVel = new V3(); this.safe = new V3(); this.respT = 0; this.invul = 0;
    this.u = 0; this.finished = false; this.finishT = 0; this.place = 0; this.falls = 0; this.out = false; this.ai = null; this.celebrate = 0; this.inp = { mx: 0, mz: 0, jump: false, jumpPressed: false, sprint: false, dive: false };
    this.av = makeBean(color, tuft); this.av.g.visible = false; scene.add(this.av.g);
    this.blob = new THREE.Mesh(geos().blob, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .4, depthWrite: false })); this.blob.rotation.x = -Math.PI / 2; this.blob.visible = false; scene.add(this.blob);
  }
  spawn(x, y, z, yaw) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.alive = true; this.onGround = false; this.ground = null; this.yaw = yaw; this.stun = 0; this.prone = 0; this.coyote = 0; this.jumpBuf = 0; this.platVel.set(0, 0, 0); this.safe.set(x, y, z); this.av.g.visible = true; }
  carry(dt) { const g = this.ground; if (this.onGround && g && g.dx !== undefined && dt > 0) { this.pos.x += g.dx; this.pos.y += g.dy; this.pos.z += g.dz; this.platVel.set(g.dx / dt, g.dy / dt, g.dz / dt); } else if (this.onGround) this.platVel.multiplyScalar(0); }
  // one physics step. Movement is relative to camYaw (bots pass 0 and a world direction)
  step(dt, camYaw, gscale = 1) {
    if (!this.alive) return; const v = this.vel, g = this.ground, inp = this.inp;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = fx * inp.mz + rx * inp.mx, wz = fz * inp.mz + rz * inp.mx; const m = Math.hypot(wx, wz); if (m > 1) { wx /= m; wz /= m; }
    const sp = MOVE.speed * (inp.sprint ? MOVE.sprint : 1); let tx = wx * sp, tz = wz * sp, k = this.onGround ? 14 : 4.2;
    if (this.stun > 0) { this.stun -= dt; tx = tz = 0; k = 1.2; }
    if (this.prone > 0) { this.prone -= dt; tx = tz = 0; k = this.onGround ? 2.4 : .5; }
    this.diveCD = Math.max(0, this.diveCD - dt);
    if (this.onGround && g) { if (g.conv) { tx += g.conv[0]; tz += g.conv[1]; k = 9; } }
    const a = Math.min(1, k * dt); v.x += (tx - v.x) * a; v.z += (tz - v.z) * a;
    this.coyote = this.onGround ? .11 : this.coyote - dt; this.jumpBuf = inp.jumpPressed ? .13 : this.jumpBuf - dt; if (inp.jumpPressed) inp.jumpPressed = false;
    if (this.jumpBuf > 0 && this.coyote > 0 && this.stun <= 0 && this.prone <= 0) { v.y = MOVE.jump; v.x += this.platVel.x; v.z += this.platVel.z; v.y += Math.max(0, this.platVel.y); this.platVel.set(0, 0, 0); this.onGround = false; this.ground = null; this.coyote = 0; this.jumpBuf = 0; this.rising = true; this.squash = -.18; if (this.isPlayer) sfx('jump'); }
    if (inp.dive && this.diveCD <= 0 && this.stun <= 0 && this.prone <= 0) {   // belly flop forward: a burst of speed, then a moment on the ground
      inp.dive = false; const dx = -Math.sin(this.yaw), dz = -Math.cos(this.yaw); v.x = dx * MOVE.dive; v.z = dz * MOVE.dive; v.y = Math.max(v.y, this.onGround ? 3.6 : 1.6); this.onGround = false; this.ground = null; this.prone = .85; this.diveCD = 1.3; this.rising = false; this.squash = .2; if (this.isPlayer) sfx('dive');
    } else inp.dive = false;
    if (this.rising && !inp.jump && v.y > 3.8) { v.y = 3.8; this.rising = false; } if (v.y <= 0) this.rising = false;
    const was = this.onGround, vy0 = v.y; moveEntity(this, dt, MOVE.g * gscale);
    this.bounceT = Math.max(0, (this.bounceT || 0) - dt); if (this.bounced) { this.bounceT = 1.3; if (this.isPlayer) sfx('boing'); this.squash = .3; this.onGround = false; this.rising = false; this.bounced = null; }
    if (this.onGround && !was && vy0 < -5) { this.squash = clamp(-vy0 / 40, .08, .3); if (this.isPlayer) sfx('land', clamp(-vy0 / 25, .3, 1)); burst(new V3(this.pos.x, this.pos.y + .1, this.pos.z), 0xffffff, 5, 3, .09, .4, 8, 1); }
  }
  animate(dt) {
    const av = this.av; av.g.visible = this.alive; if (!this.alive) { this.blob.visible = false; return; }
    const sp = Math.hypot(this.vel.x, this.vel.z); if (sp > .9 && this.celebrate <= 0) this.yaw += angDiff(Math.atan2(-this.vel.x, -this.vel.z), this.yaw) * Math.min(1, dt * 13);
    av.g.position.copy(this.pos); this.squash *= Math.max(0, 1 - dt * 9); av.body.rotation.y = this.yaw;
    const prone = this.prone > 0; av.body.rotation.x = prone ? -1.25 : this.stun > 0 ? Math.sin(W.time * 30) * .12 : 0; av.body.position.y = prone ? .35 : 0; av.body.position.z = 0;
    av.body.scale.set(1 - this.squash * .5, 1 + this.squash, 1 - this.squash * .5);
    this.walkPh += dt * (6 + sp * 1.2); const mv = clamp(sp / 7, 0, 1), air = !this.onGround;
    av.legL.rotation.x = air ? .7 : Math.sin(this.walkPh) * .9 * mv; av.legR.rotation.x = air ? -.35 : -Math.sin(this.walkPh) * .9 * mv;
    if (this.celebrate > 0) { this.celebrate -= dt; av.armL.rotation.x = av.armR.rotation.x = -2.9 + Math.sin(W.time * 12) * .4; av.armL.rotation.z = -.4; av.armR.rotation.z = .4; if (this.onGround && Math.random() < .02) this.vel.y = 6; }
    else { av.armL.rotation.x = prone ? -3 : air ? (this.vel.y > 0 ? -2.5 : -1.4 + Math.sin(this.walkPh * 2) * .5) : -Math.sin(this.walkPh) * .8 * mv; av.armR.rotation.x = prone ? -3 : air ? (this.vel.y > 0 ? -2.5 : -1.4 - Math.sin(this.walkPh * 2) * .5) : Math.sin(this.walkPh) * .8 * mv; av.armL.rotation.z = air ? -.5 : 0; av.armR.rotation.z = air ? .5 : 0; }
    if (!air && !prone) av.body.position.y = Math.abs(Math.sin(this.walkPh)) * .07 * mv;
    // a soft shadow on whatever is below, so jumps are easy to judge
    const r = world.raycast(this.pos.x, this.pos.y + .3, this.pos.z, 0, -1, 0, 40);
    if (r.box) { const h = r.t - .3; this.blob.visible = true; this.blob.position.set(this.pos.x, this.pos.y + .3 - r.t + .03, this.pos.z); const s = .5 + Math.min(h, 20) * .018; this.blob.scale.set(s, s, s); this.blob.material.opacity = clamp(.5 - h * .015, .14, .5); } else this.blob.visible = false;
  }
  remove() { scene.remove(this.av.g); scene.remove(this.blob); this.av.bm.geometry.dispose(); this.av.armMat.dispose(); this.blob.material.dispose(); }
}

// ---------------------------------------------------------------- the camera: orbits the player, never goes through a platform, and drifts back behind you when you stop looking around
export const cam = { yaw: 0, pitch: .36, dist: 8.8, tx: 0, ty: 0, tz: 0, init: false, shake: 0, manual: 0 };
export function updateCamera(dt, p, auto = true) {
  const tx = p.pos.x, ty = p.pos.y + 1.45, tz = p.pos.z; if (!cam.init) { cam.tx = tx; cam.ty = ty; cam.tz = tz; cam.init = true; }
  const k = 1 - Math.exp(-dt * (p.onGround ? 14 : 9)); cam.tx += (tx - cam.tx) * Math.min(1, 1 - Math.exp(-dt * 30)); cam.tz += (tz - cam.tz) * Math.min(1, 1 - Math.exp(-dt * 30)); cam.ty += (ty - cam.ty) * k;
  cam.manual = Math.max(0, cam.manual - dt); if (auto && cam.manual <= 0 && Math.hypot(p.vel.x, p.vel.z) > 3) cam.yaw += angDiff(p.yaw, cam.yaw) * Math.min(1, dt * 1.6);
  const cp = Math.cos(cam.pitch), dx = Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = Math.cos(cam.yaw) * cp;
  const r = world.raycast(cam.tx, cam.ty, cam.tz, dx, dy, dz, cam.dist + .5), t = Math.min(cam.dist, Math.max(1.4, r.t - .45));
  camera.position.set(cam.tx + dx * t, cam.ty + dy * t, cam.tz + dz * t); camera.lookAt(cam.tx, cam.ty, cam.tz);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2); camera.position.x += (Math.random() - .5) * cam.shake * .5; camera.position.y += (Math.random() - .5) * cam.shake * .5; }
  const wantFov = S.fov + clamp(Math.hypot(p.vel.x, p.vel.z) - 9, 0, 8) * .7; if (Math.abs(camera.fov - wantFov) > .05) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
}
