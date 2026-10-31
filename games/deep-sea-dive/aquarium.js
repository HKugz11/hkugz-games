// aquarium.js - the glass tank on the boat's deck. Every kind of fish you have discovered swims around inside it (up to 10 at a time).
import * as THREE from './three.module.min.js';
import { FISH } from './data.js?v=2';
import { buildSpecies, speciesMaterial } from './fishmodels.js?v=2';
import { addPhase } from './shaders.js?v=2';
import { clamp } from './util.js?v=2';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX'), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export class Aquarium {
  constructor(boat) { this.boat = boat; this.fish = []; this.built = new Map(); this.key = ''; }

  // Show the species in `dex` ({ id: {n} }). Does nothing if the list has not changed.
  refresh(dex) {
    const ids = FISH.filter(f => dex[f.id]).slice(0, 10).map(f => f.id);
    const key = ids.join(',');
    if (key === this.key) return;
    this.key = key; this.fish.length = 0;
    const meshes = [];
    ids.forEach((id, i) => {
      const def = FISH.find(f => f.id === id);
      if (!this.built.has(id)) { const b = buildSpecies(def); const mesh = new THREE.InstancedMesh(b.geo, speciesMaterial(b), 1); mesh.frustumCulled = false; this.built.set(id, { mesh, phase: addPhase(mesh, 1) }); }
      const rec = this.built.get(id);
      meshes.push(rec.mesh);
      this.fish.push({ def, rec, s: clamp(0.12 + def.size * 0.1, 0.14, 0.4), ph: i * 2.1, sp: 0.35 + (i % 4) * 0.08, ax: 0.5 + (i % 3) * 0.14, az: 0.18 + (i % 2) * 0.08, y0: 0.35 + (i % 5) * 0.1 });
    });
    this.boat.setAquariumFish(meshes);
  }

  update(dt, t) {
    for (const f of this.fish) {
      const a = t * f.sp + f.ph, dx = -Math.sin(a) * f.ax, dz = Math.cos(a) * f.az;
      _p.set(Math.cos(a) * f.ax, f.y0 + Math.sin(a * 1.7 + f.ph) * 0.1, Math.sin(a) * f.az);
      _e.set(0, Math.atan2(-dz, dx), 0, 'YZX'); _q.setFromEuler(_e);
      _m.compose(_p, _q, _s.setScalar(f.s));
      f.rec.mesh.setMatrixAt(0, _m); f.rec.mesh.instanceMatrix.needsUpdate = true;
      f.rec.phase.array[0] += dt * 6; f.rec.phase.needsUpdate = true;
    }
  }
}
