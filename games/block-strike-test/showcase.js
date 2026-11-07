// Small 3D stages that live in their own little canvases: the home-screen soldier + weapon, and the skin-crate opening.
import * as THREE from './three.module.min.js?v=220';
import { soldierParts, tpArms, charMat, buildGun, sleeveMat, setKnifeStyle, KNIFE_STYLE } from './art.js?v=220';
import { applyFinish, tickSkins } from './skins.js?v=220';

function makeStage(canvas, fov, camPos, lookAt) {
  let r;
  try { r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch (e) { return null; }
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 60);
  cam.position.set(...camPos); cam.lookAt(...lookAt);
  scene.add(new THREE.HemisphereLight(0xfff3e0, 0x4a3a30, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(2, 4, 3); scene.add(sun);
  const st = { r, scene, cam, w: 0, h: 0, active: false, last: 0, update() {} };
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return false;
    if (w !== st.w || h !== st.h) { st.w = w; st.h = h; r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    return true;
  };
  let frameId;
  const loop = (now) => {
    if (!st.active) return;
    frameId = requestAnimationFrame(loop);
    if (now - st.last < 33) return;                       // ~30 fps is plenty for a little showcase
    const dt = Math.min(0.1, (now - st.last) / 1000); st.last = now;
    if (!canvas.isConnected || !fit()) return;            // hidden (menu closed, dialog closed): draw nothing
    tickSkins(); st.update(now / 1000, dt); r.render(scene, cam);
  };
  st.start = () => { if (st.active) return; st.active = true; st.last = 0; frameId = requestAnimationFrame(loop); };
  st.stop = () => { st.active = false; cancelAnimationFrame(frameId); };
  return st;
}

const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const glowSprite = (hex, op) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));

// a gun (or knife) model with no arms, ready to show off with a finish on it
export function displayWeapon(item, accent) {
  let b;
  if (item.knife) { const prev = KNIFE_STYLE; setKnifeStyle(item.knife); b = buildGun('knife', accent); setKnifeStyle(prev); }
  else b = buildGun(item.gun, accent);
  for (const c of b.g.children) if (c.material === sleeveMat) c.visible = false;
  if (item.finish) applyFinish(b.finishMesh, item.finish, item.knife ? 'knife' : undefined);
  b.g.userData.grip = new THREE.Vector3(...(b.grip || (item.knife ? [0, -.004, .082] : [0, -.08, .065])));
  b.g.userData.fore = b.fore && new THREE.Vector3(...b.fore);
  b.g.userData.mesh = b.finishMesh;
  return b.g;
}
const freeWeapon = (g) => { if (g && g.userData.mesh) g.userData.mesh.geometry.dispose(); };

// ---------------------------------------------------------------- home screen: my soldier + my weapon
export function createHomeStage(canvas) {
  const st = makeStage(canvas, 32, [0, 1.3, 4.5], [0, 1.02, 0]); if (!st) return null;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.35, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-0.55, 0.01, 0); st.scene.add(floor);
  const halo = glowSprite(0xff8a2a, 0.35); halo.scale.set(4.2, 4.2, 1); halo.position.set(0, 1.1, -1.2); st.scene.add(halo);
  let soldier = null, gun = null, side = -1;
  const buildSoldier = (sd) => {
    const SP = soldierParts(sd), g = new THREE.Group();
    const mk = (geo, parent) => { const m = new THREE.Mesh(geo, charMat); parent.add(m); return m; };
    const hip = (x) => { const h = new THREE.Group(); h.position.set(x, 0.62, 0); g.add(h); mk(x < 0 ? SP.thighL : SP.thighR, h); const k = new THREE.Group(); k.position.y = -0.31; h.add(k); mk(SP.shin, k); };
    hip(-0.145); hip(0.145);
    const up = new THREE.Group(); g.add(up); mk(SP.torso, up);
    const head = new THREE.Group(); head.position.set(0, 1.55, 0); up.add(head); mk(SP.head, head);
    const arms = new THREE.Group(); arms.position.set(0, 1.3, 0); up.add(arms); mk(tpArms(sd, 'knife', false), arms);
    g.position.set(-0.55, 0, 0); return g;
  };
  st.setLook = (sd, gunId, finish, accent) => {
    if (sd !== side) { if (soldier) st.scene.remove(soldier); soldier = buildSoldier(sd); st.scene.add(soldier); side = sd; }
    if (gun) { st.scene.remove(gun); freeWeapon(gun.children[0]); }
    const w = displayWeapon({ gun: gunId, finish }, accent);
    gun = new THREE.Group(); gun.add(w); w.position.z = 0.3; gun.scale.setScalar(1.7); gun.position.set(1.0, 1.15, 0); st.scene.add(gun);
  };
  st.update = (t) => {
    if (soldier) soldier.rotation.y = t * 0.5;
    if (gun) { gun.rotation.y = t * 0.9; gun.position.y = 1.15 + Math.sin(t * 1.6) * 0.05; }
  };
  st.start();
  return st;
}

// ---------------------------------------------------------------- skin crate: shake + glow, lid pop + light burst, the prize floats out and spins
const woodTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#9a6a42'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#8a5a3a' : '#a07048'; x.fillRect(0, i * 16, 64, 15); x.fillStyle = '#5a3820'; x.fillRect(0, i * 16 + 15, 64, 1); }
  for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(60,35,18,.25)'; x.fillRect((Math.random() * 64) | 0, (Math.random() * 64) | 0, 3, 1); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

const rayTex = (() => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const addMat = (hex, map) => { const o = { color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, side: THREE.DoubleSide }; if (map) o.map = map; return new THREE.MeshBasicMaterial(o); };

// inventory preview: one weapon / knife with its finish, slowly turning
export function createPreviewStage(canvas) {
  const st = makeStage(canvas, 30, [0, 0.25, 3.4], [0, 0, 0]); if (!st) return null;
  const halo = glowSprite(0xff8a2a, 0.3); halo.scale.set(3.6, 3.6, 1); halo.position.z = -1; st.scene.add(halo);
  let w = null, grp = null;
  st.setItem = (item, accent, hex) => {
    rot = Math.PI / 2; if (grp) { st.scene.remove(grp); freeWeapon(grp.children[0]); }
    w = displayWeapon(item, accent); grp = new THREE.Group(); grp.add(w); w.position.z = 0.3; grp.scale.setScalar(item.knife ? 2.8 : 1.9); st.scene.add(grp);
    halo.material.color.setHex(hex || 0xff8a2a);
  };
  let rot = Math.PI / 2, holding = false, camZ = 3.4;
  st.drag = (dx) => { rot += dx * 0.012; }; st.hold = (b) => { holding = b; }; st.zoom = (dz) => { camZ = Math.min(5.2, Math.max(2.0, camZ + dz)); st.cam.position.z = camZ; };
  st.update = (t, dt) => { if (grp) { if (!holding) rot += dt * 0.8; grp.rotation.y = rot; grp.rotation.x = Math.sin(t * 0.7) * 0.12; } };
  return st;
}

export function createCrateStage(canvas) {
  const st = makeStage(canvas, 34, [0, 1.7, 5.4], [0, 1.0, 0]); if (!st) return null;
  const wood = new THREE.MeshLambertMaterial({ map: woodTex }), metal = new THREE.MeshLambertMaterial({ color: 0x2b2f35 }), brass = new THREE.MeshLambertMaterial({ color: 0xc9a14a });
  const crate = new THREE.Group(); st.scene.add(crate);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 1.1), wood); body.position.y = 0.375; crate.add(body);
  for (const x of [-0.38, 0.38]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.77, 1.14), metal); band.position.set(x, 0.375, 0); crate.add(band); }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), brass); lock.position.set(0, 0.7, 0.57); crate.add(lock);
  const bolts = [];
  for (const side of [-1, 1]) {
    const bolt = new THREE.Mesh(new THREE.BoxGeometry(.24, .075, .08), brass);
    bolt.position.set(side * .24, .71, .58); crate.add(bolt); bolts.push(bolt);
    for (const y of [.12, .59]) {
      const rivet = new THREE.Mesh(new THREE.BoxGeometry(.045,.045,.03), brass);
      rivet.position.set(side * .38,y,.583); crate.add(rivet);
    }
  }
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.75, -0.55); crate.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.2, 1.16), wood); lid.position.set(0, 0.1, 0.55); lidPivot.add(lid);
  for (const x of [-0.38, 0.38]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 1.18), metal); band.position.set(x, 0.1, 0.55); lidPivot.add(band); }
  const light = new THREE.PointLight(0xffffff, 0, 8); light.position.set(0, 1.0, 0.6); st.scene.add(light);
  const glow = glowSprite(0xffffff, 0); glow.position.set(0, 0.9, -0.2); st.scene.add(glow);
  const burst = glowSprite(0xffffff, 0); burst.position.set(0, 1.0, 0.3); st.scene.add(burst);
  const halo = glowSprite(0xffffff, 0); halo.position.set(0, 1.8, -0.4); st.scene.add(halo);
  const floorGlow = glowSprite(0xffffff, 0); floorGlow.scale.set(5, 2, 1); floorGlow.position.set(0, 0.05, 0); st.scene.add(floorGlow);
  const rings = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), addMat(0xffffff)); m.position.set(0, 1.0, 0.6); m.visible = false; st.scene.add(m); return m; });
  const rays = new THREE.Group(); rays.position.set(0, 1.0, -0.3); st.scene.add(rays);
  const rayMeshes = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22 + (i % 3) * 0.1, 7), addMat(0xffffff, rayTex)); m.geometry.translate(0, 3.5, 0); m.rotation.z = (i / 10) * Math.PI * 2; rays.add(m); rayMeshes.push(m); }
  const bits = [];
  for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.visible = false; st.scene.add(m); bits.push({ m, v: new THREE.Vector3() }); }
  const holder = new THREE.Group(); holder.visible = false; st.scene.add(holder);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; st.scene.add(sh);

  let run = null; const baseFov = st.cam.fov;
  const clear = () => { holder.children.slice().forEach((c) => { holder.remove(c); freeWeapon(c.children[0]); }); holder.visible = false; };
  st.reset = () => {
    bolts.forEach((b,i) => b.position.x = (i ? 1 : -1) * .24); lock.rotation.z = 0; holder.rotation.y = 0; run = null; clear(); lidPivot.rotation.x = 0; lidPivot.position.y = 0.75; crate.rotation.set(0, 0, 0); crate.position.set(0, 0, 0); st.cam.fov = baseFov; st.cam.position.set(0, 1.7, 5.4); st.cam.updateProjectionMatrix();
    light.intensity = 0; glow.material.opacity = 0; burst.material.opacity = 0; halo.material.opacity = 0; floorGlow.material.opacity = 0; bits.forEach((b) => (b.m.visible = false));
    rings.forEach((r) => (r.visible = false)); rayMeshes.forEach((m) => (m.material.opacity = 0));
  };
  // prize = { f: finish } or { k: knife }; hex = rarity colour; rank 0..3 = rarity (bigger show for rarer prizes)
  st.play = (prize, hex, rank, sfx, done) => {
    st.reset();
    for (const s of [glow, burst, halo, floorGlow]) s.material.color.setHex(hex);
    light.color.setHex(hex); bits.forEach((b) => b.m.material.color.setHex(hex)); rings.forEach((r) => r.material.color.setHex(hex)); rayMeshes.forEach((m) => m.material.color.setHex(hex));
    const item = prize.k ? { knife: prize.k.id } : { gun: 'raptor', finish: prize.f };
    const w = displayWeapon(item, 0x3a3f44); const g = new THREE.Group(); g.add(w); w.position.z = 0.3; g.scale.setScalar(prize.k ? 2.6 : 2.0); holder.add(g);
    run = { t: 0, ticks: 0, popped: false, shown: false, sfx, done, rank, build: 1.05 + rank * 0.2 };
  };
  st.update = (time, dt) => {
    if (!run) { crate.rotation.y = Math.sin(time * 0.8) * 0.3; crate.position.y = Math.sin(time * 1.5) * 0.03; return; }
    const t = (run.t += dt), B = run.build, rk = run.rank;
    if (t < B) {                                           // building up: shake, glow, sparks, slow camera push-in
      const k = t / B;
      const release = easeOutCubic(Math.min(1, Math.max(0, (k - .38) / .46)));
      lock.rotation.z = Math.min(1,k / .38) * Math.PI / 2;
      bolts.forEach((bolt,i) => bolt.position.x = (i ? 1 : -1) * (.24 + .19 * release));
      crate.rotation.y = .22 * (1 - release);
      lidPivot.position.y = .75 + .055 * release;
      light.intensity = 3.5 * k * k; glow.material.opacity = 0.15 + 0.7 * k; glow.scale.setScalar(1.6 + 1.6 * k); floorGlow.material.opacity = 0.7 * k;
      st.cam.position.z = 5.4 - 0.9 * k; st.cam.position.y = 1.7 - 0.2 * k;
      rayMeshes.forEach((m) => (m.material.opacity = 0.12 * k * (1 + rk * 0.4))); rays.rotation.z += dt * 0.6;
      const n = Math.floor(k * 4); for (let i = 0; i < n; i++) { const b = bits[(Math.random() * bits.length) | 0]; if (!b.m.visible) { b.m.visible = true; b.m.position.set((Math.random() - 0.5) * 0.9, 0.8, (Math.random() - 0.5) * 0.9); b.v.set((Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6); b.m.material.opacity = 1; b.m.scale.setScalar(0.5); } }
      for (const b of bits) if (b.m.visible) { b.m.position.addScaledVector(b.v, dt); b.m.material.opacity -= dt * 1.2; if (b.m.material.opacity <= 0) b.m.visible = false; }
      const due = [0.05, 0.3, 0.55, 0.75, 0.9, 1.0]; if (run.ticks < due.length && t >= due[run.ticks] * B / 1.05) run.sfx('tick', run.ticks++);
    } else {
      if (!run.popped) {                                   // LID POP: flash, shock rings, beams, confetti
        run.popped = true; run.sfx('pop', rk);
        crate.position.x = 0; crate.rotation.set(0, 0, 0);
        bits.forEach((b) => { b.m.visible = true; b.m.scale.setScalar(1); b.m.position.set((Math.random() - 0.5) * 0.6, 1.0, (Math.random() - 0.3) * 0.5); b.v.set((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.2) * 5); b.m.material.opacity = 1; });
        holder.visible = true; rings.forEach((r, i) => { r.visible = i === 0 || rk >= 2; });
      }
      const p = t - B;
      const open = easeOutCubic(Math.min(1, p / 0.28)); lidPivot.rotation.x = -2.4 * open; lidPivot.position.y = 0.75 + Math.sin(Math.min(1, p / 0.3) * Math.PI) * 0.35;
      burst.material.opacity = Math.max(0, 1 - p / 0.45); burst.scale.setScalar(0.6 + p * 18);
      rings.forEach((r, i) => { const rp = Math.max(0, p - i * 0.18); r.scale.setScalar(1 + rp * 22); r.material.opacity = Math.max(0, 0.9 - rp * 1.8); });
      light.intensity = Math.max(1.8, 10 + rk * 3 - p * 28); glow.material.opacity = Math.max(0.3, 0.9 - p * 1.1); glow.scale.setScalar(3.4 + p); floorGlow.material.opacity = 0.8;
      const rayA = Math.min(1, p / 0.25) * (0.14 + rk * 0.055) * (p > 1.6 ? Math.max(0.5, 1 - (p - 1.6)) : 1); rayMeshes.forEach((m) => (m.material.opacity = rayA)); rays.rotation.z += dt * (0.5 + rk * 0.25);
      for (const b of bits) { b.v.y -= 9 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 6; b.m.rotation.y += dt * 5; b.m.material.opacity = Math.max(0, 1 - p / 1.3); }
      const punch = Math.max(0, 1 - p / 0.35);                                        // camera punch + shake
      st.cam.fov = baseFov - 7 * punch; st.cam.updateProjectionMatrix(); st.cam.position.x = Math.sin(p * 90) * 0.06 * punch; st.cam.position.z = 4.9 + 0.5 * (1 - punch);
      const q = Math.max(0, p - 0.1) / 0.75;                                          // the prize floats out and spins
      holder.position.set(0, 0.5 + 1.1 * easeOutBack(Math.min(1, q)), 0.1); holder.scale.setScalar(Math.max(0.01, easeOutCubic(Math.min(1, q * 1.2))));
      holder.rotation.y = Math.PI * (.5 + 2 * easeOutCubic(Math.min(1, q))) + Math.sin(Math.max(0, q - 1)) * .24;
      halo.material.opacity = 0.7 * Math.min(1, q); halo.scale.setScalar(3 + Math.sin(time * 3) * 0.25); halo.position.set(0, holder.position.y, -0.5);
      if (!run.shown && p >= 0.85) { run.shown = true; run.sfx('reveal', rk); const d = run.done; setTimeout(() => d && d(), 0); }
    }
  };
  return st;
}
