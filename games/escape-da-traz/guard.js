// ESCAPE DA TRAZ - guards: they walk a fixed route (kinematic, so they can never get stuck on scenery), pausing to sweep their flashlight at each stop,
// and they can see the player when he's inside their cone, within range, and not behind a wall.
import { THREE, V3, scene, angDiff } from './core.js?v=1';
import { world } from './physics.js?v=1';
import { Guest } from './player.js?v=1';

const EYEH = 1.55;
function sectorGeo(range, half, segs = 18) {
  const pos = [0, .03, 0]; for (let i = 0; i <= segs; i++) { const a = -half + (2 * half) * (i / segs); pos.push(Math.sin(a) * range, .03, -Math.cos(a) * range); }
  const idx = []; for (let i = 1; i < segs + 1; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export class Guard {
  constructor(cfg) {
    this.cfg = cfg; this.actor = new Guest({ body: 0x2448a0, armCol: 0x2448a0, cap: 0x14234a, skin: 0xe8b588 }); this.range = cfg.range; this.half = cfg.half; this.baseSpeed = cfg.speed;
    this.coneGeo = sectorGeo(cfg.range, cfg.half);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(this.coneGeo, this.coneMat); scene.add(this.cone);
    this.light = new THREE.SpotLight(0xffe9a8, 2.2, cfg.range + 2, cfg.half, .5, 1.3); scene.add(this.light); scene.add(this.light.target);
    this.seen = false; this.reset();
  }
  reset() {
    const c = this.cfg; this.idx = 1 % c.path.length; this.dir = 1; this.pause = .3; this.t = 0; this.alertT = 0; this.huntPos = null; this.huntYaw = 0; this.speed = this.baseSpeed;
    this.actor.place(c.start[0], c.start[1], this.yawTo(c.path[this.idx] || c.path[0]));
    this.baseYaw = this.actor.yaw; this.cone.position.set(c.start[0], 0, c.start[1]); this.cone.rotation.y = this.actor.yaw;
  }
  yawTo([x, z]) { const dx = x - this.actor.pos.x, dz = z - this.actor.pos.z; return Math.atan2(-dx, -dz); }
  update(dt, player, detectRateCb) {
    const c = this.cfg, path = c.path;
    this.alertT = Math.max(0, this.alertT - dt);
    const hunting = this.alertT > 0 && this.huntPos;
    this.speed = hunting ? this.baseSpeed * 1.4 : this.baseSpeed;
    if (hunting) {   // spotted you: rush toward where you were last seen, then scan hard before giving up
      const dx = this.huntPos[0] - this.actor.pos.x, dz = this.huntPos[1] - this.actor.pos.z, d = Math.hypot(dx, dz);
      if (d > .3) { const nx = dx / d, nz = dz / d, step = Math.min(d, this.speed * dt); this.actor.pos.x += nx * step; this.actor.pos.z += nz * step; const wantYaw = Math.atan2(-nx, -nz); this.actor.yaw += angDiff(wantYaw, this.actor.yaw) * Math.min(1, dt * 11); this.huntYaw = this.actor.yaw; this.t = 0; }
      else { this.t += dt; this.actor.yaw = this.huntYaw + Math.sin(this.t * 3.4) * 1.05; }
      this.pause = 0;
    } else if (this.pause > 0) {
      this.pause -= dt; this.t += dt; this.actor.yaw = this.baseYaw + Math.sin(this.t * 2.2) * .8;
    } else {
      const target = path[this.idx], dx = target[0] - this.actor.pos.x, dz = target[1] - this.actor.pos.z, d = Math.hypot(dx, dz);
      if (d < .15) {
        if (c.loop === 'loop') this.idx = (this.idx + 1) % path.length;
        else { if (this.idx >= path.length - 1) this.dir = -1; else if (this.idx <= 0) this.dir = 1; this.idx += this.dir; }
        this.pause = c.pause || .8; this.baseYaw = this.actor.yaw; this.t = 0;
      } else {
        const nx = dx / d, nz = dz / d, step = Math.min(d, this.speed * dt); this.actor.pos.x += nx * step; this.actor.pos.z += nz * step;
        const wantYaw = Math.atan2(-nx, -nz); this.actor.yaw += angDiff(wantYaw, this.actor.yaw) * Math.min(1, dt * 8);
      }
    }
    this.actor.fig.g.position.set(this.actor.pos.x, 0, this.actor.pos.z); this.actor.fig.torso.rotation.y = this.actor.yaw;
    this.actor.animate(dt, (this.pause > 0 && !hunting) ? 0 : this.speed);
    this.cone.position.set(this.actor.pos.x, 0, this.actor.pos.z); this.cone.rotation.y = this.actor.yaw;
    this.light.position.set(this.actor.pos.x, EYEH, this.actor.pos.z);
    const fx = -Math.sin(this.actor.yaw), fz = -Math.cos(this.actor.yaw); this.light.target.position.set(this.actor.pos.x + fx * 4, .6, this.actor.pos.z + fz * 4); this.light.target.updateMatrixWorld();
    // ---- can this guard see the player right now?
    const pdx = player.pos.x - this.actor.pos.x, pdz = player.pos.z - this.actor.pos.z, dist = Math.hypot(pdx, pdz);
    let seen = false;
    if (dist < this.range && dist > .01) {
      const ndx = pdx / dist, ndz = pdz / dist, cosA = fx * ndx + fz * ndz;
      if (cosA >= Math.cos(this.half)) { const r = world.raycast(this.actor.pos.x, EYEH, this.actor.pos.z, ndx, 0, ndz, dist); if (r.t >= dist - .3) seen = true; }
    }
    this.seen = seen;
    if (seen) { this.alertT = 2.6; this.huntPos = [player.pos.x, player.pos.z]; }
    this.coneMat.color.setHex(seen ? 0xff4040 : hunting ? 0xff9a40 : 0xffe066); this.coneMat.opacity = seen ? .32 : hunting ? .24 : .15; this.light.color.setHex(seen ? 0xff6050 : hunting ? 0xffb060 : 0xffe9a8);
    if (detectRateCb) detectRateCb(seen, dist);
  }
  dispose() { scene.remove(this.actor.fig.g); scene.remove(this.cone); scene.remove(this.light); scene.remove(this.light.target); this.coneGeo.dispose(); this.coneMat.dispose(); this.light.dispose && this.light.dispose(); }
}
