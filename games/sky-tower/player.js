// SKY TOWER - the climber: a toon robot with a tight platformer controller, plus the orbit camera.
import { THREE, V3, scene, toon, QL, clamp, lerp, angDiff, sfx, burst, camera, S, TAU } from './core.js?v=6';
import { world, moveEntity, pushOut } from './physics.js?v=6';
import { JUMP } from './gen.js?v=6';

// ---------------------------------------------------------------- the avatar (merged parts with shared geometry)
const dark = toon(0x2a2140), vcol = toon(0xffffff, { vertexColors: true }); dark.userData.shared = vcol.userData.shared = true;
function merge(list) {
  const pos = [], nor = [], col = [];
  for (const [geo, color] of list) { const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.userData.shared = true; return out;
}
const T = (g, x, y, z) => g.translate(x, y, z);
let GEO = null;
function geos() {
  if (GEO) return GEO; GEO = {};
  GEO.shellA = merge([[T(new THREE.CapsuleGeometry(.3, .42, 4, 12), 0, .98, 0), 0xffffff], [T(new THREE.SphereGeometry(.065, 8, 6), 0, 2.09, 0), 0xffffff]]);
  GEO.shellB = merge([[T(new THREE.CylinderGeometry(.31, .31, .12, 14), 0, .8, 0), 0xf4f0ff], [T(new THREE.SphereGeometry(.29, 16, 12), 0, 1.58, 0), 0xf4f0ff], [T(new THREE.BoxGeometry(.42, .17, .2), 0, 1.6, -.19), 0x2a2140], [T(new THREE.CylinderGeometry(.015, .015, .22, 6), 0, 1.95, 0), 0x2a2140]]);
  GEO.eyes = merge([[T(new THREE.SphereGeometry(.05, 8, 6), -.1, 1.61, -.29), 0xffffff], [T(new THREE.SphereGeometry(.05, 8, 6), .1, 1.61, -.29), 0xffffff]]);
  GEO.leg = T(new THREE.BoxGeometry(.18, .5, .2), 0, -.25, 0); GEO.arm = T(new THREE.CapsuleGeometry(.07, .3, 3, 8), 0, -.2, 0); GEO.leg.userData.shared = GEO.arm.userData.shared = true;
  GEO.blob = new THREE.CircleGeometry(1, 20); GEO.blob.userData.shared = true; return GEO;
}
export function makeAvatar(color) {
  const G = geos(), g = new THREE.Group(), body = new THREE.Group(); g.add(body); const mat = toon(color), eyeM = new THREE.MeshBasicMaterial({ color: 0x4aff8a });
  const a = new THREE.Mesh(G.shellA, mat), b = new THREE.Mesh(G.shellB, vcol); a.castShadow = b.castShadow = QL.shadow > 0; body.add(a, b, new THREE.Mesh(G.eyes, eyeM));
  const legL = new THREE.Group(), legR = new THREE.Group(); for (const [lg, x] of [[legL, -.15], [legR, .15]]) { lg.add(new THREE.Mesh(G.leg, dark)); lg.position.set(x, .5, 0); body.add(lg); }
  const armL = new THREE.Group(), armR = new THREE.Group(); for (const [ag, x] of [[armL, -.36], [armR, .36]]) { ag.add(new THREE.Mesh(G.arm, mat)); ag.position.set(x, 1.12, 0); body.add(ag); }
  return { g, body, legL, legR, armL, armR, mat, eyeM };
}

// ---------------------------------------------------------------- the controller
export class Player {
  constructor(color) {
    this.pos = new V3(); this.vel = new V3(); this.r = .4; this.h = 1.8; this.onGround = false; this.ground = null; this.yaw = 0; this.alive = false;
    this.coyote = 0; this.jumpBuf = 0; this.rising = false; this.stun = 0; this.squash = 0; this.walkPh = 0; this.platVel = new V3(); this.air = 0; this.lastGround = null;
    this.av = makeAvatar(color); this.av.g.visible = false; scene.add(this.av.g);
    this.blob = new THREE.Mesh(geos().blob, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .4, depthWrite: false })); this.blob.rotation.x = -Math.PI / 2; this.blob.visible = false; scene.add(this.blob);
  }
  setColor(c) { this.av.mat.color.setHex(c); }
  spawn(x, y, z, yaw) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.alive = true; this.onGround = false; this.ground = null; this.yaw = yaw; this.stun = 0; this.coyote = 0; this.jumpBuf = 0; this.platVel.set(0, 0, 0); this.av.g.visible = true; this.air = 0; }
  // ride whatever we stand on (called once per frame, after the tower has moved)
  carry(dt) {
    const g = this.ground; if (this.onGround && g && g.dx !== undefined && dt > 0) { this.pos.x += g.dx; this.pos.y += g.dy; this.pos.z += g.dz; this.platVel.set(g.dx / dt, g.dy / dt, g.dz / dt); } else if (this.onGround) this.platVel.multiplyScalar(0);
  }
  // one physics step. inp: { mx, mz, jump (held), sprint }, camYaw, gscale
  step(dt, inp, camYaw, gscale) {
    if (!this.alive) return; const v = this.vel, g = this.ground;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = fx * inp.mz + rx * inp.mx, wz = fz * inp.mz + rz * inp.mx; const m = Math.hypot(wx, wz); if (m > 1) { wx /= m; wz /= m; }
    const sp = JUMP.speed * (inp.sprint ? 1.28 : 1); let tx = wx * sp, tz = wz * sp, k = this.onGround ? 14 : 4.2;
    if (this.stun > 0) { this.stun -= dt; tx = tz = 0; k = 1.2; }
    if (this.onGround && g) { if (g.conv) { tx += g.conv[0]; tz += g.conv[1]; k = 9; } if (g.ice) k = 1.5; }
    const a = Math.min(1, k * dt); v.x += (tx - v.x) * a; v.z += (tz - v.z) * a;
    this.coyote = this.onGround ? .11 : this.coyote - dt; this.jumpBuf = inp.jumpPressed ? .13 : this.jumpBuf - dt; if (inp.jumpPressed) inp.jumpPressed = false;
    if (this.jumpBuf > 0 && this.coyote > 0 && this.stun <= 0) { v.y = JUMP.v; v.x += this.platVel.x; v.z += this.platVel.z; v.y += Math.max(0, this.platVel.y); this.platVel.set(0, 0, 0); this.onGround = false; this.ground = null; this.coyote = 0; this.jumpBuf = 0; this.rising = true; this.squash = -.18; sfx('jump'); }
    if (this.rising && !inp.jump && v.y > 3.8) { v.y = 3.8; this.rising = false; } if (v.y <= 0) this.rising = false;
    const was = this.onGround, vy0 = v.y; moveEntity(this, dt, JUMP.g * gscale);
    if (this.bounced) { sfx('bounce'); this.squash = .3; this.onGround = false; this.rising = false; const b = this.bounced; this.bounced = null; this.pulse = b; }
    if (this.onGround && !was && vy0 < -5) { this.squash = clamp(-vy0 / 40, .08, .3); sfx('land', clamp(-vy0 / 25, .3, 1)); burst(new V3(this.pos.x, this.pos.y + .1, this.pos.z), 0xffffff, 6, 3, .09, .4, 8, 1); }
  }
  // face the way we run and animate the avatar
  animate(dt) {
    const av = this.av; av.g.visible = this.alive; if (!this.alive) { this.blob.visible = false; return; }
    const sp = Math.hypot(this.vel.x, this.vel.z); if (sp > .9) this.yaw += angDiff(Math.atan2(-this.vel.x, -this.vel.z), this.yaw) * Math.min(1, dt * 13);
    av.g.position.copy(this.pos); av.body.rotation.y = this.yaw; this.squash *= Math.max(0, 1 - dt * 9); av.body.scale.set(1 - this.squash * .5, 1 + this.squash, 1 - this.squash * .5);
    this.walkPh += dt * (6 + sp * 1.2); const mv = clamp(sp / 7, 0, 1), air = !this.onGround;
    av.legL.rotation.x = air ? .7 : Math.sin(this.walkPh) * .9 * mv; av.legR.rotation.x = air ? -.35 : -Math.sin(this.walkPh) * .9 * mv;
    av.armL.rotation.x = air ? (this.vel.y > 0 ? -2.5 : -1.4 + Math.sin(this.walkPh * 2) * .5) : -Math.sin(this.walkPh) * .8 * mv; av.armR.rotation.x = air ? (this.vel.y > 0 ? -2.5 : -1.4 - Math.sin(this.walkPh * 2) * .5) : Math.sin(this.walkPh) * .8 * mv;
    av.armL.rotation.z = air ? -.5 : 0; av.armR.rotation.z = air ? .5 : 0; av.body.position.y = air ? 0 : Math.abs(Math.sin(this.walkPh)) * .06 * mv;
    // a soft shadow on whatever is below us, so jumps are easy to judge
    const r = world.raycast(this.pos.x, this.pos.y + .3, this.pos.z, 0, -1, 0, 60);
    if (r.box) { const h = r.t - .3; this.blob.visible = true; this.blob.position.set(this.pos.x, this.pos.y + .3 - r.t + .03, this.pos.z); const s = .5 + Math.min(h, 20) * .018; this.blob.scale.set(s, s, s); this.blob.material.opacity = clamp(.5 - h * .015, .14, .5); } else this.blob.visible = false;
  }
  remove() { scene.remove(this.av.g); scene.remove(this.blob); }
}

// ---------------------------------------------------------------- the camera: orbits the climber, never goes through a platform
export const cam = { yaw: 0, pitch: .38, dist: 8.5, tx: 0, ty: 0, tz: 0, init: false, shake: 0 };
export function updateCamera(dt, p) {
  const tx = p.pos.x, ty = p.pos.y + 1.45, tz = p.pos.z; if (!cam.init) { cam.tx = tx; cam.ty = ty; cam.tz = tz; cam.init = true; }
  const k = 1 - Math.exp(-dt * (p.onGround ? 14 : 9)); cam.tx += (tx - cam.tx) * Math.min(1, 1 - Math.exp(-dt * 30)); cam.tz += (tz - cam.tz) * Math.min(1, 1 - Math.exp(-dt * 30)); cam.ty += (ty - cam.ty) * k;
  const cp = Math.cos(cam.pitch), dx = Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = Math.cos(cam.yaw) * cp;   // direction from the target back to the camera
  const r = world.raycast(cam.tx, cam.ty, cam.tz, dx, dy, dz, cam.dist + .5), t = Math.min(cam.dist, Math.max(1.4, r.t - .45));
  camera.position.set(cam.tx + dx * t, cam.ty + dy * t, cam.tz + dz * t); camera.lookAt(cam.tx, cam.ty, cam.tz);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2); camera.position.x += (Math.random() - .5) * cam.shake * .5; camera.position.y += (Math.random() - .5) * cam.shake * .5; }
  const wantFov = S.fov + clamp(Math.hypot(p.vel.x, p.vel.z) - 9, 0, 6) * .6; if (Math.abs(camera.fov - wantFov) > .05) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
}
