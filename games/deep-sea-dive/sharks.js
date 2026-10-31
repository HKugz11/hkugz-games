// sharks.js - the sharks. They patrol, notice you when you're close and in sight, chase, and bite (a big bite of your AIR, nothing gory).
// You can escape by: swimming away fast, hiding in kelp or a cave, swimming up to the surface, a shark repellent (R), or by STUNNING the shark with a spear.
// Numbers for each kind of shark are in the SHARKS list in data.js; how many live in each zone is in ZONES.
import * as THREE from './three.module.min.js';
import { SHARKS, ZONES } from './data.js?v=2';
import { sharkGeo } from './fishmodels.js?v=2';
import { litMaterial, addPhase } from './shaders.js?v=2';
import { depthAt, heightAt, edgeDist } from './world.js?v=2';
import { clamp, rng } from './util.js?v=2';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const wrap = a => { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; };

export class Sharks {
  // events = { onSpot(shark), onBite(shark) }
  constructor(scene, lite, events) {
    this.events = events; this.R = rng((Math.random() * 1e9) | 0);
    this.list = []; this.kinds = [];
    const total = ZONES.reduce((a, z) => a + z.sharks, 0);
    for (const def of SHARKS) {
      const g = sharkGeo(def.look);
      const mesh = new THREE.InstancedMesh(g.geo, litMaterial({ mode: 0, amp: g.wig.amp, wave: g.wig.wave, pow: g.wig.pow }), total);
      mesh.frustumCulled = false; mesh.count = 0; mesh.name = 'shark:' + def.id;
      const phase = addPhase(mesh, total, this.R);
      scene.add(mesh);
      this.kinds.push({ def, mesh, phase, n: 0 });
    }
    for (const z of ZONES) {
      const count = lite ? Math.ceil(z.sharks * 0.7) : z.sharks;
      for (let i = 0; i < count; i++) this.spawn(z, z.sharkKind[Math.floor(this.R() * z.sharkKind.length)]);
    }
  }

  spawn(zone, kind) {
    const R = this.R, k = this.kinds[kind], def = k.def, top = Math.max(zone.top, 3) + 2, bot = zone.bottom - 3, p = new THREE.Vector3();
    for (let t = 0; t < 150; t++) {
      const x = (R() * 2 - 1) * 190, z = (R() * 2 - 1) * 190, D = depthAt(x, z);
      if (D < top + 5 || Math.hypot(x, z) < 40 || edgeDist(x, z) > 205) continue;
      const hi = Math.min(bot, D - 3);
      if (hi - top < 2) continue;
      p.set(x, -(top + (hi - top) * R()), z); break;
    }
    if (!p.x && !p.z) return;
    const s = {
      def, kind, k, zone, slot: k.n++, pos: p, vel: new THREE.Vector3(), yaw: R() * 6.28, pitch: 0, state: 'patrol', t: 0, wp: p.clone(), top, bot,
      biteCD: 0, stunT: 0, fleeT: 0, lost: 0, seen: false, size: def.size * (0.95 + R() * 0.12), roll: 0,
    };
    this.newWaypoint(s);
    this.list.push(s);
    k.mesh.count = k.n;
  }

  newWaypoint(s) {
    const R = this.R;
    for (let t = 0; t < 12; t++) {
      const a = R() * 6.283, r = 30 + R() * 60, x = s.pos.x + Math.cos(a) * r, z = s.pos.z + Math.sin(a) * r, D = depthAt(x, z);
      if (edgeDist(x, z) > 208 || D < s.top + 5) continue;
      const hi = Math.min(s.bot, D - 3);
      s.wp.set(x, -(s.top + (hi - s.top) * R()), z); s.t = 12 + R() * 14; return;
    }
    s.t = 3;
  }

  // player = { pos, speed01 }. hidden = true while you are inside kelp or a cave. Returns what the HUD needs.
  update(dt, t, player, hidden) {
    let nearest = 1e9, chasing = false;
    const px = player.pos.x, py = player.pos.y, pz = player.pos.z, surface = py > -2.4;
    for (const s of this.list) {
      const def = s.def;
      s.biteCD = Math.max(0, s.biteCD - dt);
      const dx = px - s.pos.x, dy = py - s.pos.y, dz = pz - s.pos.z, dist = Math.hypot(dx, dy, dz);
      let speed = def.patrol, tx = s.wp.x, ty = s.wp.y, tz = s.wp.z, turn = 1.4;
      const sight = hidden ? 5 : def.sight * (0.8 + 0.4 * player.speed01);       // swimming hard makes noise: they notice you from further away
      if (s.state === 'stun') {
        s.stunT -= dt; speed = 0.4; tx = s.pos.x; ty = s.pos.y - 3; tz = s.pos.z; s.roll += (Math.PI * 0.85 - s.roll) * Math.min(1, dt * 3);
        if (s.stunT <= 0) { s.state = 'patrol'; s.t = 0; }
      } else {
        s.roll += (0 - s.roll) * Math.min(1, dt * 3);
        if (s.state === 'flee') {      // scared by repellent: swim away
          s.fleeT -= dt; speed = def.chase; turn = 2.5;
          _v.set(-dx, -dy * 0.3, -dz).normalize().multiplyScalar(30); tx = s.pos.x + _v.x; ty = s.pos.y + _v.y; tz = s.pos.z + _v.z;
          if (s.fleeT <= 0) { s.state = 'patrol'; s.t = 0; }
        } else if (s.state === 'patrol') {
          if (s.t <= 0 || s.pos.distanceToSquared(s.wp) < 36) this.newWaypoint(s); s.t -= dt;
          if (dist < sight && !surface && s.biteCD <= 0.01) {
            s.state = 'chase'; s.lost = 0;
            if (this.events.onSpot) this.events.onSpot(s);
          }
        }
        if (s.state === 'chase') {
          chasing = true; speed = def.chase; turn = 2.6;
          tx = px; ty = py; tz = pz;
          // lose interest if you hide, surface, or get far away
          if (hidden && dist > 6) s.lost += dt * 1.2; else if (dist > sight * 1.9) s.lost += dt; else s.lost = Math.max(0, s.lost - dt);
          if (surface) s.lost += dt * 3;
          if (s.lost > 2.5) { s.state = 'patrol'; s.t = 0; s.biteCD = 2; }
          else if (dist < 2.2 + s.size * 0.25 && s.biteCD <= 0) {
            s.biteCD = 2.6; s.state = 'retreat'; s.t = 1.6;
            if (this.events.onBite) this.events.onBite(s);
          }
        } else if (s.state === 'retreat') {
          s.t -= dt; speed = def.chase * 0.8; turn = 3;
          _v.set(-dx, -dy * 0.2 + 0.4, -dz).normalize().multiplyScalar(20); tx = s.pos.x + _v.x; ty = s.pos.y + _v.y; tz = s.pos.z + _v.z;
          if (s.t <= 0) { s.state = (dist < sight && !surface) ? 'chase' : 'patrol'; s.lost = 0; }
        }
      }
      // steer
      _v.set(tx - s.pos.x, ty - s.pos.y, tz - s.pos.z);
      const d = _v.length() || 1;
      const wantYaw = Math.atan2(-_v.z, _v.x), wantPitch = clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.6, 0.6);
      s.yaw += clamp(wrap(wantYaw - s.yaw), -turn * dt, turn * dt);
      s.pitch += (wantPitch - s.pitch) * Math.min(1, dt * 2);
      const cp = Math.cos(s.pitch);
      s.vel.set(Math.cos(s.yaw) * cp * speed, Math.sin(s.pitch) * speed, -Math.sin(s.yaw) * cp * speed);
      s.pos.addScaledVector(s.vel, dt);
      // stay in the water: off the seabed, below the surface
      const floor = heightAt(s.pos.x, s.pos.z) + 1.4 + s.size * 0.1;
      if (s.pos.y < floor) { s.pos.y = floor; if (s.pitch < 0) s.pitch *= 0.5; }
      if (s.pos.y > -2.6) s.pos.y = -2.6;
      const e = edgeDist(s.pos.x, s.pos.z); if (e > 215) { s.pos.x *= 215 / e; s.pos.z *= 215 / e; }
      // draw it
      _e.set(s.roll, s.yaw, s.pitch, 'YZX'); _q.setFromEuler(_e);
      _m.compose(s.pos, _q, _s.setScalar(s.size));
      s.k.mesh.setMatrixAt(s.slot, _m);
      s.k.phase.array[s.slot] += dt * (s.state === 'stun' ? 1.2 : 2.5 + speed * 1.1);
      if (dist < nearest) nearest = dist;
    }
    for (const k of this.kinds) { k.mesh.instanceMatrix.needsUpdate = true; k.phase.needsUpdate = true; }
    return { nearest, chasing };
  }

  // the spear: did it touch a shark? (sharks are big, so the spear gets a generous target)
  segmentHit(a, b, pad = 0.35) {
    const ab = _s.copy(b).sub(a), len2 = ab.lengthSq() || 1;
    let best = null, bt = 2;
    for (const s of this.list) {
      _v.copy(s.pos).sub(a);
      const t = clamp(_v.dot(ab) / len2, 0, 1); _v.addScaledVector(ab, -t);
      const r = s.size * 0.32 + pad;
      if (_v.lengthSq() < r * r && t < bt) { bt = t; best = s; }
    }
    return best;
  }
  stun(s, secs) { s.state = 'stun'; s.stunT = secs; }
  // shark repellent: every shark within `radius` swims away for a while
  repel(pos, radius, secs) {
    let n = 0;
    for (const s of this.list) if (s.pos.distanceTo(pos) < radius) { s.state = 'flee'; s.fleeT = secs; n++; }
    return n;
  }
}
