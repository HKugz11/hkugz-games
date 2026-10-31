// The 3D flight view: draws the sky and planets, the launch site, every rocket piece, flames, smoke, parachutes and explosions.
import * as THREE from './three.module.min.js';
import { V, Q, clamp } from './vec.js?v=1';
import { BODIES, SUN_DIR, PAD } from './data.js?v=1';
import { Sky } from './sky.js?v=1';
import { makePart, makeCanopy, toonMaterial } from './meshes.js?v=1';
import { makePad } from './scenery.js?v=1';
import { localFrame, density, worldPoint } from './sim.js?v=1';

// ------------------------------------------------------------------ particles (smoke, dust, fire, sparks)
const P_VS = `attribute vec4 aCol; attribute float aSize; varying vec4 vCol; uniform float uScale;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.2), 0.0, 400.0); }`;
const P_FS = `varying vec4 vCol; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = vCol.a * smoothstep(1.0, 0.25, r); gl_FragColor = vec4(vCol.rgb, a); }`;

class Pool {
  constructor(n, additive) {
    this.n = n; this.next = 0;
    this.p = new Float64Array(n * 3); this.v = new Float32Array(n * 3); this.age = new Float32Array(n).fill(1e9); this.life = new Float32Array(n).fill(1);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.c0 = new Float32Array(n * 4); this.c1 = new Float32Array(n * 4); this.drag = new Float32Array(n);
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4)); this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 500 } } });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false;
  }
  emit(pos, vel, life, s0, s1, c0, c1, drag) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.p[i * 3] = pos[0]; this.p[i * 3 + 1] = pos[1]; this.p[i * 3 + 2] = pos[2];
    this.v[i * 3] = vel[0]; this.v[i * 3 + 1] = vel[1]; this.v[i * 3 + 2] = vel[2];
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.drag[i] = drag;
    for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = c0[k]; this.c1[i * 4 + k] = c1[k]; }
  }
  update(dt, origin) {
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) { this.size[i] = 0; continue; }
      this.age[i] += dt;
      const t = Math.min(1, this.age[i] / this.life[i]), k = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= k; this.v[i * 3 + 1] *= k; this.v[i * 3 + 2] *= k;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.pos[i * 3] = this.p[i * 3] - origin[0]; this.pos[i * 3 + 1] = this.p[i * 3 + 1] - origin[1]; this.pos[i * 3 + 2] = this.p[i * 3 + 2] - origin[2];
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      for (let c = 0; c < 4; c++) this.col[i * 4 + c] = this.c0[i * 4 + c] + (this.c1[i * 4 + c] - this.c0[i * 4 + c]) * t;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
  clear() { this.age.fill(1e9); this.size.fill(0); }
}

// ------------------------------------------------------------------ engine flames
const FLAME_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLAME_FS = `uniform float uTime; uniform float uPow; uniform vec3 uTint; varying vec2 vUv;
void main(){ float h = vUv.y; float flick = 0.85 + 0.15 * sin(uTime * 55.0 + vUv.x * 40.0 + h * 12.0);
  float a = pow(1.0 - h, 1.1) * flick * uPow;
  vec3 c = mix(vec3(1.0, 0.98, 0.85), uTint, smoothstep(0.0, 0.7, h));
  gl_FragColor = vec4(c, a); }`;
let FLAME_GEO = null;
function flameMesh() {
  if (!FLAME_GEO) { FLAME_GEO = new THREE.ConeGeometry(0.5, 1, 16, 1, true); FLAME_GEO.rotateX(Math.PI); }
  const m = new THREE.Mesh(FLAME_GEO, new THREE.ShaderMaterial({ vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uPow: { value: 1 }, uTint: { value: new THREE.Color(1.0, 0.45, 0.1) } } }));
  m.visible = false; m.frustumCulled = false;
  return m;
}

// ------------------------------------------------------------------ one rocket (or piece of one) as a 3D object
class VesselView {
  constructor(v, outlines) {
    this.v = v; this.ver = v.ver; this.outlines = outlines;
    this.group = new THREE.Group();
    this.parts = new Map();
    for (const p of v.alive) this.addPart(p);
  }
  addPart(p) {
    const o = makePart(p.def, { outlines: this.outlines });
    o.position.set(p.pos[0], p.pos[1], p.pos[2]); o.rotation.y = p.rotY;
    this.group.add(o);
    const rec = { p, obj: o };
    if (p.chute) { rec.canopy = makeCanopy(this.outlines); rec.canopy.visible = false; this.group.add(rec.canopy); }
    if (p.def.F !== undefined) { rec.flame = flameMesh(); this.group.add(rec.flame); }
    this.parts.set(p.i, rec);
  }
  sync() {
    const v = this.v;
    if (v.ver !== this.ver) {
      this.ver = v.ver;
      const alive = new Set(v.alive.map((p) => p.i));
      for (const [i, rec] of this.parts) if (!alive.has(i)) { this.group.remove(rec.obj); if (rec.canopy) this.group.remove(rec.canopy); if (rec.flame) this.group.remove(rec.flame); this.parts.delete(i); }
    }
  }
  dispose() { this.group.parent && this.group.parent.remove(this.group); }
}

// ------------------------------------------------------------------ the whole flight view
export class FlightView {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.quality = opts.quality || 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality === 'high', powerPreference: 'high-performance', alpha: false });
    this.renderer.autoClear = false;
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.12, 60000);
    this.sky = new Sky();
    this.sky.steps = this.quality === 'high' ? 8 : 3; this.sky.oct = this.quality === 'high' ? 9 : 5;
    this.scene = new THREE.Scene();
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    this.hemi = new THREE.HemisphereLight(0xaad4ff, 0x6a7a5a, 1.0);
    this.scene.add(this.sunLight, this.sunLight.target, this.hemi);
    this.views = new Map();
    this.pad = makePad(BODIES.cobble.R, { trees: this.quality === 'high' ? 280 : 90 });
    this.scene.add(this.pad);
    this.padPos = V.mul(PAD.up, BODIES.cobble.R);
    this.padQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...PAD.up));
    this.smoke = new Pool(this.quality === 'high' ? 2200 : 700, false); this.fire = new Pool(this.quality === 'high' ? 900 : 300, true);
    this.scene.add(this.smoke.points, this.fire.points);
    const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    this.blob.visible = false; this.scene.add(this.blob);
    // camera state
    this.yaw = 0.7; this.pitch = 0.25; this.dist = 16; this.minDist = 3; this.maxDist = 3000; this.mode = 'local';
    this.origin = [BODIES.cobble.R, 0, 0]; this.frameBody = 'cobble'; this.lastMain = null; this.time = 0; this.focusOff = [0, 0, 0];
    this.starFade = 1; this.shake = 0;
    this.resize();
  }
  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    for (const vw of this.views.values()) vw.dispose();
    this.views.clear();
    this.renderer.setPixelRatio(this.pixelRatio());
    this.sky.steps = q === 'high' ? 8 : 3; this.sky.oct = q === 'high' ? 9 : 5;
  }
  pixelRatio() { const dpr = window.devicePixelRatio || 1; return this.quality === 'high' ? Math.min(dpr, 1.6) : Math.min(dpr, 1) * 0.62; }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
    const pr = this.renderer.getPixelRatio();
    this.pixelH = h * pr;
    const sc = this.pixelH / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    this.smoke.mat.uniforms.uScale.value = sc; this.fire.mat.uniforms.uScale.value = sc;
  }
  drag(dx, dy) { this.yaw -= dx * 0.006; this.pitch = clamp(this.pitch + dy * 0.006, -1.45, 1.5); }
  zoom(f) { this.dist = clamp(this.dist * f, this.minDist, this.maxDist); }
  clearFx() { this.smoke.clear(); this.fire.clear(); }

  // --- effects
  boom(pos, size, scale = 1) {
    const n = Math.max(4, Math.min(34, Math.round((10 + size * 5) * scale)));
    for (let i = 0; i < n; i++) {
      const d = V.norm([Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5]), sp = (5 + Math.random() * 24) * Math.min(2.2, 0.6 + size * 0.22);
      this.fire.emit(pos, V.mul(d, sp), 0.45 + Math.random() * 0.8, size * (0.8 + Math.random() * 1.2), size * 2.6, [1, 0.6, 0.2, 0.5], [0.8, 0.12, 0.03, 0], 1.6);
    }
    for (let i = 0; i < n; i++) {
      const d = V.norm([Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5]), sp = 3 + Math.random() * 14;
      this.smoke.emit(pos, V.mul(d, sp), 2.5 + Math.random() * 3.5, size * 1.4, size * 5, [0.16, 0.15, 0.18, 0.7], [0.32, 0.31, 0.35, 0], 1.0);
    }
    for (let i = 0; i < Math.round(12 * scale) + 3; i++) { const d = V.norm([Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5]); this.fire.emit(pos, V.mul(d, 40 + Math.random() * 60), 0.4 + Math.random() * 0.7, 0.3, 0.08, [1, 0.9, 0.5, 0.9], [1, 0.4, 0.1, 0], 0.4); }
  }
  puff(pos, vel, size, life, rgb, a) { this.smoke.emit(pos, vel, life, size, size * 4, [rgb[0], rgb[1], rgb[2], a], [rgb[0] * 1.1, rgb[1] * 1.1, rgb[2] * 1.1, 0], 0.7); }

  // --- every frame
  frame(W, dt, ui) {
    this.time += dt;
    const main = W.main;
    let focus = main && !main.dead ? main : null;
    if (focus) { this.lastMain = { r: focus.r.slice(), body: focus.body, v: focus.v.slice() }; }
    const lm = this.lastMain || { r: [BODIES.cobble.R + 2, 0, 0], body: 'cobble', v: [0, 0, 0] };
    // looking at the vessel's middle of mass
    const target = focus ? focus.r : lm.r;
    this.frameBody = lm.body;
    this.origin = target;
    const body = BODIES[this.frameBody];

    // vessels
    const seen = new Set();
    const outlines = this.quality === 'high';
    for (const v of W.vessels) {
      if (v.dead || v.body !== this.frameBody) continue;
      seen.add(v.id);
      let vw = this.views.get(v.id);
      if (!vw) { vw = new VesselView(v, outlines); this.views.set(v.id, vw); this.scene.add(vw.group); }
      vw.sync();
    }
    for (const [id, vw] of this.views) if (!seen.has(id)) { vw.dispose(); this.views.delete(id); }

    // camera
    const f = localFrame(target);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    let ex = f.east, no = f.north, up = f.up;
    if (this.mode === 'ship' && focus) { ex = Q.rot(focus.q, [0, 0, 1]); no = Q.rot(focus.q, [1, 0, 0]); up = Q.rot(focus.q, [0, 1, 0]); }
    const off = V.add(V.add(V.mul(ex, Math.cos(this.yaw) * cp * this.dist), V.mul(no, Math.sin(this.yaw) * cp * this.dist)), V.mul(up, sp * this.dist));
    let camW = V.add(target, off);
    const camAlt = V.len(camW) - body.R;
    if (camAlt < 1.5) camW = V.add(camW, V.mul(f.up, 1.5 - camAlt));
    const camOff = V.sub(camW, target);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.camera.position.set(camOff[0] + sx, camOff[1] + sx, camOff[2] + sx);
    this.camera.up.set(f.up[0], f.up[1], f.up[2]);
    this.camera.lookAt(0, 0, 0);
    if (this.sideShift) this.camera.translateX(-this.sideShift * this.dist);
    this.shake = Math.max(0, this.shake - dt * 3);

    // vessels' transforms
    for (const [id, vw] of this.views) {
      const v = vw.v;
      const o = V.sub(v.r, Q.rot(v.q, v.com));
      vw.group.position.set(o[0] - target[0], o[1] - target[1], o[2] - target[2]);
      vw.group.quaternion.set(v.q[0], v.q[1], v.q[2], v.q[3]);
      const pf = body.atm ? clamp(density(body, V.len(v.r) - body.R) / body.atm.rho0, 0, 1) : 0;
      for (const rec of vw.parts.values()) {
        const p = rec.p;
        if (rec.flame) {
          const fl = rec.flame, on = p.thrust > 0 && p.ign;
          fl.visible = on;
          if (on) {
            const frac = p.thrust / p.def.F, big = Math.sqrt(p.def.F / 1e5);
            const len = (1.6 + 5.5 * Math.sqrt(frac) * Math.min(3.2, big)) * (1 + 1.8 * (1 - pf)) * (p.def.solid ? 1.1 : 1);
            const wid = p.def.r * 1.6 * (1 + 0.7 * (1 - pf)) * (0.6 + 0.4 * frac);
            fl.scale.set(wid, len, wid);
            fl.position.set(p.pos[0], p.pos[1] - p.def.h / 2 - len / 2 + 0.1, p.pos[2]);
            fl.material.uniforms.uTime.value = this.time; fl.material.uniforms.uPow.value = 0.9;
            fl.material.uniforms.uTint.value.setRGB(p.def.solid ? 1.0 : 0.4, p.def.solid ? 0.5 : 0.55, p.def.solid ? 0.15 : 1.0);
            if (p.def.solid) fl.material.uniforms.uTint.value.setRGB(1, 0.5, 0.12);
            else if (p.def.ispVac > 500) fl.material.uniforms.uTint.value.setRGB(0.5, 1, 0.6);
            else fl.material.uniforms.uTint.value.setRGB(1, 0.55 + 0.25 * (1 - pf), 0.2 + 0.7 * (1 - pf));
          }
        }
        if (rec.canopy) {
          const c = p.chute, cn = rec.canopy;
          cn.visible = c.open > 0.02;
          if (cn.visible) {
            const Rc = Math.sqrt(p.def.chuteArea / 3.5) * (0.45 + 0.55 * c.open), hgt = Rc * 0.8 * c.open + 0.01;
            cn.scale.set(Rc, hgt, Rc);
            cn.position.set(p.pos[0], p.pos[1] + p.def.h / 2 + hgt * 1.0 + 0.8, p.pos[2]);
          }
        }
        if (p.leg) {
          const piv = rec.obj.userData.pivot;
          if (piv) { const tgt = p.leg.out ? 0 : -rec.obj.userData.angle; piv.rotation.z += (tgt - piv.rotation.z) * Math.min(1, dt * 6); }
        }
      }
    }

    // pad
    const padRel = V.sub(this.padPos, target);
    const onPadFrame = this.frameBody === 'cobble' && V.len(padRel) < 4500;
    this.pad.visible = onPadFrame;
    if (onPadFrame) { this.pad.position.set(padRel[0], padRel[1], padRel[2]); this.pad.quaternion.copy(this.padQuat); }

    // sun, sky colours, day and night
    const camAltNow = V.len(camW) - body.R;
    const sun = SUN_DIR, upCam = V.norm(camW);
    let day = 1;
    const mu = V.dot(upCam, sun);
    if (body.atm && camAltNow < 90000) day = clamp((mu + 0.1) / 0.3, 0, 1);
    else if (this.frameBody === 'cobble') {
      const s = V.dot(camW, sun);
      if (s < 0) { const perp = V.len(V.sub(camW, V.mul(sun, s))); day = clamp((perp - body.R * 0.985) / (body.R * 0.03), 0, 1); }
    }
    const atmo = body.atm ? clamp(1 - camAltNow / 70000, 0, 1) : 0;
    this.sunLight.intensity = 2.3 * day * (0.82 + 0.18 * (1 - atmo));
    this.sunLight.color.setRGB(1, 0.95 - 0.3 * (1 - clamp(mu * 3 + 0.3, 0, 1)) * atmo, 0.86 - 0.5 * (1 - clamp(mu * 3 + 0.3, 0, 1)) * atmo);
    this.sunLight.position.set(sun[0] * 100, sun[1] * 100, sun[2] * 100); this.sunLight.target.position.set(0, 0, 0);
    this.hemi.intensity = 0.55 + 0.75 * day * atmo + 0.35 * (1 - atmo) * (0.3 + 0.7 * day) + 0.12;
    this.hemi.color.setRGB(0.55 * atmo + 0.5 * (1 - atmo), 0.74 * atmo + 0.55 * (1 - atmo), 1.0);
    this.hemi.groundColor.setRGB(0.35 * atmo + 0.18, 0.42 * atmo + 0.18, 0.28 * atmo + 0.2);
    this.hemi.position.set(f.up[0], f.up[1], f.up[2]);
    this.starFade = clamp(1 - day * atmo * 1.6, 0, 1);

    // shadow blob on the ground
    if (focus) {
      const alt = V.len(focus.r) - body.R;
      const showBlob = alt < 260 && !focus.dead;
      this.blob.visible = showBlob;
      if (showBlob) {
        const gnd = V.mul(V.norm(focus.r), body.R + 0.05);
        const g = V.sub(gnd, target);
        this.blob.position.set(g[0], g[1], g[2]);
        this.blob.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(f.up[0], f.up[1], f.up[2]));
        const size = 2.6 + Math.sqrt(Math.max(alt, 0)) * 0.12;
        this.blob.scale.set(size, size, 1);
        this.blob.material.opacity = clamp(1 - alt / 260, 0, 1) * day;
      }
    } else this.blob.visible = false;

    // smoke, dust and fire from engines
    this.heat = Math.max(0, (this.heat || 0) - dt * 0.8);
    this.emitExhaust(W, dt, target, body);
    this.smoke.update(dt, target); this.fire.update(dt, target);

    // draw
    const r = this.renderer;
    r.clear();
    this.sky.update(this.camera, camW, this.frameBody, W.ut, this.time, this.pixelH, this.starFade);
    this.sky.render(r, this.camera);
    r.clearDepth();
    r.render(this.scene, this.camera);
    return { camAlt: camAltNow, day };
  }

  emitExhaust(W, dt, target, body) {
    const em = this.emit || (this.emit = new Map());
    for (const v of W.vessels) {
      if (v.dead || v.body !== this.frameBody) continue;
      const alt = V.len(v.r) - body.R, rho = body.atm ? density(body, alt) : 0;
      for (const e of v.engines) {
        if (!(e.thrust > 0)) { em.delete(v.id + ':' + e.i); continue; }
        const key = v.id + ':' + e.i;
        const nozzle = worldPoint(v, [e.pos[0], e.pos[1] - e.def.h / 2, e.pos[2]]);
        const prev = em.get(key) || nozzle;
        em.set(key, nozzle);
        const down = Q.rot(v.q, [0, -1, 0]);
        const frac = e.thrust / e.def.F, size0 = e.def.r * 1.3 * (0.5 + 0.5 * frac);
        const dist = V.len(V.sub(nozzle, prev)), steps = Math.min(8, 1 + Math.floor(dist / Math.max(1.2, size0)));
        const smokeAmt = clamp(rho / 0.35, 0, 1);
        for (let k = 0; k < steps; k++) {
          const t = (k + Math.random()) / steps, pos = V.lerp(prev, nozzle, t);
          const jitter = [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3];
          const vel = V.add(V.add(v.v, V.mul(down, 18 + Math.random() * 22 * Math.min(2, Math.sqrt(e.def.F / 2e5)))), jitter);
          if (smokeAmt > 0.03) this.smoke.emit(pos, vel, 2.6 + 2.5 * smokeAmt + Math.random(), size0 * 1.2, size0 * (4 + 5 * smokeAmt) , [0.92, 0.9, 0.88, 0.42 * smokeAmt], [0.8, 0.82, 0.9, 0], 0.5);
          if (Math.random() < 0.55) this.fire.emit(pos, V.add(vel, V.mul(down, 20)), 0.18 + Math.random() * 0.14, size0 * 1.1, size0 * 0.3, [1, 0.8, 0.35, 0.55], [1, 0.3, 0.1, 0], 0.5);
        }
        // dust blown across the ground near the pad
        if (alt < 45 && rho > 0.2) {
          const gnd = V.mul(V.norm(v.r), body.R);
          const f = localFrame(v.r);
          const cnt = Math.min(3, 1 + Math.floor(frac * 3));
          for (let k = 0; k < cnt; k++) {
            const a = Math.random() * Math.PI * 2, sp = 14 + Math.random() * 30 * (1 - alt / 60);
            const dir = V.add(V.mul(f.east, Math.cos(a)), V.mul(f.north, Math.sin(a)));
            this.smoke.emit(V.add(gnd, V.mul(dir, 2 + Math.random() * 3)), V.add(V.mul(dir, sp), V.mul(f.up, 1 + Math.random() * 3)), 2.5 + Math.random() * 2, 2.2, 9 + 4 * frac, [0.72, 0.66, 0.55, 0.5 * (1 - alt / 55)], [0.7, 0.66, 0.6, 0], 1.3);
          }
        }
      }
    }
    // fiery glow on the front of anything coming down very fast
    for (const v of W.vessels) {
      if (v.dead || v.body !== this.frameBody || v.asleep) continue;
      const alt = V.len(v.r) - body.R, rho = body.atm ? density(body, alt) : 0;
      if (rho < 1e-5) continue;
      const sp = V.len(v.v), flux = 0.5 * rho * sp * sp * sp;
      if (flux < 2.5e6) continue;
      const vb = Q.rotInv(v.q, v.v), lead = vb[1] > 0 ? v.topY : v.botY;
      const n = Math.min(6, Math.ceil(flux / 6e6)), pos = worldPoint(v, [0, lead, 0]);
      for (let k = 0; k < n; k++) {
        const jit = [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4];
        this.fire.emit(pos, V.add(V.mul(v.v, 0.92), jit), 0.25 + Math.random() * 0.4, 2.2, 6, [1, 0.65, 0.25, 0.7], [1, 0.25, 0.05, 0], 0.6);
      }
      if (v === W.main) this.heat = Math.max(this.heat || 0, Math.min(1, (flux - 2.5e6) / 3e7));
    }
    // forget engines that are gone
    if (em.size > 80) em.clear();
  }

  dispose() { this.renderer.dispose(); }
}
