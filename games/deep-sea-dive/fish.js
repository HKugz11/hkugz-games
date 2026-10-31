// fish.js - the living ocean: schools of fish that wander, get scared when you come close, and can be caught.
// Each kind of fish is ONE instanced mesh (so hundreds of fish cost only a few draw calls).
// The fish themselves come from the FISH list in data.js - add a fish there and it shows up here automatically.
import * as THREE from './three.module.min.js';
import { FISH, RARITY, ZONES } from './data.js?v=2';
import { buildSpecies, speciesMaterial } from './fishmodels.js?v=2';
import { clamp, rng } from './util.js?v=2';
import { addPhase } from './shaders.js?v=2';
import { depthAt, heightAt, edgeDist } from './world.js?v=2';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX'), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _z = new THREE.Matrix4().makeScale(0, 0, 0);
const wrap = a => { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; };

export class FishField {
  constructor(scene, lite) {
    this.scene = scene; this.lite = lite;
    this.species = []; this.fish = []; this.schools = [];
    this.R = rng((Math.random() * 1e9) | 0);
    for (const def of FISH) {
      const built = buildSpecies(def);
      const nSchools = lite ? Math.max(1, Math.ceil(def.schools * 0.7)) : def.schools;
      const maxN = nSchools * def.school[1];
      const mesh = new THREE.InstancedMesh(built.geo, speciesMaterial(built), maxN);
      mesh.frustumCulled = false; mesh.count = 0; mesh.name = 'fish:' + def.id;
      mesh.renderOrder = built.alpha ? 2 : 0;
      const phase = addPhase(mesh, maxN, this.R);
      scene.add(mesh);
      const rec = { def, mesh, phase, n: 0, nSchools };
      this.species.push(rec);
    }
    this.respawnAll();
  }

  // Fill the ocean with fish (called once, and again if you want a fresh ocean)
  respawnAll() {
    this.fish.length = 0; this.schools.length = 0;
    for (const sp of this.species) {
      sp.n = 0;
      for (let i = 0; i < sp.nSchools; i++) this.addSchool(sp, i === 0 && sp.def.zone === 0);
      sp.mesh.count = sp.n;
    }
  }

  // where may a school of this species live? A spot with enough water for its depth zone.
  findSpot(def, nearBoat, out) {
    const z = ZONES[def.zone], top = Math.max(z.top, 3) + 1.5, bot = z.bottom - 2, R = this.R;
    for (let t = 0; t < 120; t++) {
      const r = nearBoat ? 15 + R() * 70 : 0;
      const a = R() * 6.283, x = nearBoat ? Math.cos(a) * r : (R() * 2 - 1) * 195, zz = nearBoat ? Math.sin(a) * r : (R() * 2 - 1) * 195;
      const D = depthAt(x, zz);
      if (D < top + 4 || edgeDist(x, zz) > 205) continue;
      const lo = top, hi = Math.min(bot, D - 2.5);
      if (hi - lo < 1.5) continue;
      return out.set(x, -(lo + (hi - lo) * R()), zz);
    }
    return null;
  }

  addSchool(sp, nearBoat) {
    const def = sp.def, R = this.R;
    const c = new THREE.Vector3();
    if (!this.findSpot(def, nearBoat, c)) return;
    const z = ZONES[def.zone];
    const school = { sp, def, c, wp: c.clone(), vel: new THREE.Vector3(), t: 0, top: Math.max(z.top, 3) + 1.5, bot: z.bottom - 2, panic: 0, members: [] };
    const n = def.school[0] + Math.floor(R() * (def.school[1] - def.school[0] + 1));
    const spread = def.size * 2.2 + Math.sqrt(n) * def.size * 1.6 + 0.8;
    for (let i = 0; i < n && sp.n < sp.mesh.instanceMatrix.count; i++) {
      const f = {
        def, sp, school, slot: sp.n++, size: def.size * (0.88 + R() * 0.24), alive: true, respawn: 0, fear: 0, ph: R() * 6.28,
        off: new THREE.Vector3((R() - 0.5) * 2 * spread, (R() - 0.5) * spread * 0.7, (R() - 0.5) * 2 * spread),
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: R() * 6.28, pitch: 0, cruise: def.speed * (0.85 + R() * 0.3),
      };
      f.pos.copy(c).add(f.off);
      school.members.push(f); this.fish.push(f);
    }
    this.schools.push(school);
  }

  newWaypoint(s) {
    const R = this.R, def = s.def;
    for (let t = 0; t < 12; t++) {
      const a = R() * 6.283, r = 18 + R() * 45, x = s.c.x + Math.cos(a) * r, z = s.c.z + Math.sin(a) * r;
      const D = depthAt(x, z);
      if (edgeDist(x, z) > 208 || D < s.top + 4) continue;
      const hi = Math.min(s.bot, D - 2.5);
      s.wp.set(x, -(s.top + (hi - s.top) * R()), z);
      s.t = 9 + R() * 14; return;
    }
    s.t = 3;
  }

  // every frame. player = { pos, speed01 }
  update(dt, t, player) {
    for (const s of this.schools) {
      s.t -= dt;
      if (s.t <= 0 || s.c.distanceToSquared(s.wp) < 16) this.newWaypoint(s);
      _v.copy(s.wp).sub(s.c); const len = _v.length() || 1;
      _v.multiplyScalar(s.def.speed * 0.55 / len);
      s.vel.lerp(_v, 1 - Math.exp(-dt * 1.2));
      s.c.addScaledVector(s.vel, dt);
      const sb = depthAt(s.c.x, s.c.z), depth = clamp(-s.c.y, s.top, Math.max(s.top, Math.min(s.bot, sb - 2.5)));
      s.c.y = -depth;
      if (s.panic > 0) s.panic -= dt;
    }
    const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
    for (const f of this.fish) {
      if (!f.alive) {
        f.respawn -= dt;
        if (f.respawn <= 0) { f.alive = true; f.pos.copy(f.school.c).add(f.off); f.vel.set(0, 0, 0); f.fear = 0; }
        else continue;
      }
      const def = f.def, s = f.school;
      // scared of the diver? sneaking up slowly lets you get closer than rushing in
      const dx = f.pos.x - px, dy = f.pos.y - py, dz = f.pos.z - pz, d2 = dx * dx + dy * dy + dz * dz;
      const alert = def.alert * (0.55 + 0.6 * player.speed01) * (def.shape === 'jelly' ? 0.5 : 1);
      if (f.fear <= 0 && d2 < alert * alert) this.scare(f, 0.9 + this.R() * 0.8);
      let sp = f.cruise;
      if (f.fear > 0) {
        f.fear -= dt;
        const d = Math.sqrt(d2) || 1;
        const flee = def.speed * (1.7 + 0.25 * RARITY[def.rarity].order);
        _v.set(dx / d + (Math.sin(f.ph * 3 + t) * 0.35), dy / d * 0.5 + 0.1, dz / d + Math.cos(f.ph * 2 + t) * 0.35).normalize().multiplyScalar(flee);
        f.vel.lerp(_v, 1 - Math.exp(-dt * 6));
        sp = flee;
      } else {
        // head for my place in the school
        _v.copy(s.c).add(f.off);
        _v.x += Math.sin(t * 0.4 + f.ph) * 0.5; _v.y += Math.sin(t * 0.31 + f.ph * 1.7) * 0.3; _v.z += Math.cos(t * 0.37 + f.ph) * 0.5;
        _v.sub(f.pos).multiplyScalar(1.3).add(s.vel);
        const m = _v.length();
        if (m > f.cruise * 1.3) _v.multiplyScalar(f.cruise * 1.3 / m);
        f.vel.lerp(_v, 1 - Math.exp(-dt * 2.2));
      }
      f.pos.addScaledVector(f.vel, dt);
      // stay in the water: above the seabed, below the surface
      const sb = heightAt(f.pos.x, f.pos.z) + f.size * 0.4 + 0.3;
      if (f.pos.y < sb) { f.pos.y = sb; if (f.vel.y < 0) f.vel.y *= -0.3; }
      if (f.pos.y > -f.size * 0.5 - 0.6) { f.pos.y = -f.size * 0.5 - 0.6; if (f.vel.y > 0) f.vel.y = 0; }
      // turn smoothly to face where we're going
      const spd = Math.hypot(f.vel.x, f.vel.z);
      if (def.shape === 'jelly') { f.yaw += dt * 0.15; f.pitch = 0; }
      else if (spd > 0.08) {
        const want = Math.atan2(-f.vel.z, f.vel.x);
        f.yaw += wrap(want - f.yaw) * Math.min(1, dt * (f.fear > 0 ? 9 : 3.2));
        f.pitch += (clamp(Math.atan2(f.vel.y, spd), -0.7, 0.7) - f.pitch) * Math.min(1, dt * 3);
      }
      _e.set(0, f.yaw, f.pitch, 'YZX'); _q.setFromEuler(_e);
      _s.setScalar(f.size);
      _m.compose(f.pos, _q, _s);
      f.sp.mesh.setMatrixAt(f.slot, _m);
      const sw = f.vel.length() / Math.max(0.3, f.size);       // fish swing their tails faster when they swim faster
      f.sp.phase.array[f.slot] += dt * (def.shape === 'jelly' ? 2.2 : 4 + Math.min(10, 2 + sw * 2.2));
    }
    for (const sp of this.species) { sp.mesh.instanceMatrix.needsUpdate = true; sp.phase.needsUpdate = true; }
  }

  // Make a fish (and its school mates) bolt away.
  scare(f, secs) {
    f.fear = secs;
    f.school.panic = 1.5;
    for (const m of f.school.members) if (m.alive && m !== f && m.fear <= 0 && m.pos.distanceToSquared(f.pos) < 100) m.fear = 0.4 + this.R() * secs;
  }

  // ---------------------------------------------------------------- finding fish for the net and spear
  // all fish within `reach` of `origin` roughly in front of `dir`, nearest first
  query(origin, dir, reach, minDot = 0.25) {
    const out = [];
    for (const f of this.fish) {
      if (!f.alive) continue;
      _v.copy(f.pos).sub(origin);
      const d = _v.length(), edge = d - f.size * 0.35;
      if (edge > reach) continue;
      if (d > 0.05 && _v.dot(dir) / d < minDot && d > f.size * 0.6) continue;
      out.push({ f, dist: Math.max(0, edge) });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }
  // first fish touched by the line from a to b (for spears); `pad` makes the target a bit fatter
  segmentHit(a, b, pad = 0.25) {
    let best = null, bt = 2;
    const ab = _s.copy(b).sub(a), len2 = ab.lengthSq() || 1;
    for (const f of this.fish) {
      if (!f.alive) continue;
      _v.copy(f.pos).sub(a);
      const t = clamp(_v.dot(ab) / len2, 0, 1);
      _v.addScaledVector(ab, -t);
      const r = f.size * (f.def.shape === 'ray' ? 0.6 : 0.42) + pad;
      if (_v.lengthSq() < r * r && t < bt) { bt = t; best = f; }
    }
    return best ? { f: best, t: bt } : null;
  }
  // The fish is caught: hide it, and put a new one in the school a while later.
  remove(f) {
    f.alive = false; f.respawn = 35 + this.R() * 40;
    f.sp.mesh.setMatrixAt(f.slot, _z); f.sp.mesh.instanceMatrix.needsUpdate = true;
  }
}
