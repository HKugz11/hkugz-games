// shaders.js - the special materials: lit things that wiggle and glow (fish, seaweed), the ocean surface, light rays and floating specks.
import * as THREE from './three.module.min.js';

// One clock shared by every moving material.
export const U = { uTime: { value: 0 } };

// ----------------------------------------------------------------------------------------------- lit material (+ wiggle + glow)
// mode: -1 = still | 0 = body wave (tails, sharks, eels) | 1 = wing flap (rays) | 2 = jelly pulse | 3 = seaweed sway
// Models are built 1 unit long with the nose pointing along +X; the game scales them to the fish's real size.
// Each instance has `aPhase` (where it is in its wiggle cycle). Parts built with glow > 0 shine on their own (see Parts in util.js).
export function litMaterial(o = {}) {
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: o.double === false ? THREE.FrontSide : THREE.DoubleSide,
    transparent: o.alpha !== undefined && o.alpha < 1,
    opacity: o.alpha ?? 1,
    depthWrite: !(o.alpha !== undefined && o.alpha < 1),
  });
  const cfg = { mode: o.mode ?? -1, amp: o.amp ?? 0.15, wave: o.wave ?? 6, pow: o.pow ?? 2, glow: o.glow ?? 1.5 };
  mat.userData.cfg = cfg;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uMode = { value: cfg.mode };
    sh.uniforms.uAmp = { value: cfg.amp };
    sh.uniforms.uWave = { value: cfg.wave };
    sh.uniforms.uPow = { value: cfg.pow };
    sh.uniforms.uGlowK = { value: cfg.glow };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aGlow; attribute float aPhase; varying float vGlow;
        uniform float uTime, uMode, uAmp, uWave, uPow;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGlow = aGlow;
        if (uMode > -0.5) {
          if (uMode < 0.5) {                       // body wave: the tail swings more than the nose
            float k = pow(clamp(0.5 - transformed.x, 0.0, 1.0), uPow);
            transformed.z += sin(aPhase - transformed.x * uWave) * uAmp * k;
          } else if (uMode < 1.5) {                // wing flap: the tips of the wings move most
            transformed.y += sin(aPhase - abs(transformed.z) * 1.6) * uAmp * abs(transformed.z) * 1.4;
          } else if (uMode < 2.5) {                // jelly pulse: the bell squeezes and the arms trail
            float p = sin(aPhase);
            float bell = smoothstep(-0.25, 0.25, transformed.y);
            transformed.xz *= 1.0 + 0.1 * p * bell;
            transformed.y += 0.04 * p * bell;
            transformed.x += sin(aPhase * 0.7 + transformed.y * 7.0) * 0.05 * clamp(-transformed.y, 0.0, 1.0);
            transformed.z += cos(aPhase * 0.6 + transformed.y * 6.0) * 0.05 * clamp(-transformed.y, 0.0, 1.0);
          } else {                                 // plants sway in the current (height 0..1 along y)
            float h = clamp(transformed.y, 0.0, 1.0);
            transformed.x += sin(uTime * 1.2 + aPhase + h * 2.0) * uAmp * h * h;
            transformed.z += cos(uTime * 0.9 + aPhase * 1.3 + h * 1.7) * uAmp * 0.6 * h * h;
          }
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n varying float vGlow; uniform float uGlowK;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * vGlow * uGlowK;');
  };
  mat.customProgramCacheKey = () => 'dsd-lit';
  return mat;
}

// An instanced mesh needs an `aPhase` number for every copy (so they don't all wiggle in step).
export function addPhase(mesh, count, random = Math.random) {
  const arr = new Float32Array(count);
  for (let i = 0; i < count; i++) arr[i] = random() * 6.283;
  const attr = new THREE.InstancedBufferAttribute(arr, 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute('aPhase', attr);
  return attr;
}

// ----------------------------------------------------------------------------------------------- the ocean surface
// Seen from above it is see-through blue with sun sparkles. From underneath you see a bright wobbly "window" to the sky.
export const WATER = {
  uFogColor: { value: new THREE.Color(0x9ad8f0) },
  uFogDensity: { value: 0.003 },
  uSky: { value: new THREE.Color(0xbfe9ff) },
  uSun: { value: new THREE.Vector3(0.35, 0.8, 0.25).normalize() },
  uUnder: { value: new THREE.Color(0x1d8fcf) },
};
export function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: { uTime: U.uTime, ...WATER },
    vertexShader: `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime, uFogDensity; uniform vec3 uFogColor, uSky, uSun, uUnder;
      varying vec3 vW;
      // slope of the waves at a spot (a few sine waves crossing each other)
      vec2 slope(vec2 p) {
        float t = uTime;
        vec2 d = vec2(0.0);
        d += vec2(0.55, 0.25) * cos(dot(p, vec2(0.55, 0.25)) * 1.0 + t * 0.9) * 0.22;
        d += vec2(-0.3, 0.6) * cos(dot(p, vec2(-0.3, 0.6)) * 1.7 + t * 1.3) * 0.16;
        d += vec2(0.9, -0.4) * cos(dot(p, vec2(0.9, -0.4)) * 2.9 + t * 1.9) * 0.1;
        d += vec2(-0.5, -0.8) * cos(dot(p, vec2(-0.5, -0.8)) * 5.3 + t * 2.6) * 0.05;
        return d;
      }
      void main() {
        vec3 V = cameraPosition - vW;
        float dist = length(V); V /= dist;
        vec2 s = slope(vW.xz);
        vec3 N = normalize(vec3(-s.x, 1.0, -s.y));
        bool above = gl_FrontFacing;
        float fogF = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
        vec3 col; float a;
        if (above) {
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
          vec3 deep = mix(vec3(0.05, 0.42, 0.66), vec3(0.18, 0.78, 0.9), 0.5 + 0.5 * N.x);
          vec3 R = reflect(-uSun, N);
          float spec = pow(max(dot(R, V), 0.0), 140.0);
          col = mix(deep, uSky, fres * 0.85) + vec3(1.0, 0.95, 0.8) * spec * 1.6;
          a = clamp(mix(0.55, 0.97, fres) + spec, 0.0, 1.0);
        } else {
          float c = abs(V.y);                                      // looking straight up = 1
          float win = smoothstep(0.58, 0.7, c);                      // inside the bright window
          float rip = 0.5 + 0.5 * sin((vW.x + s.x * 6.0) * 2.0 + uTime * 1.2) * sin((vW.z + s.y * 6.0) * 2.0 - uTime);
          vec3 skyCol = mix(uSky * 0.95, vec3(1.0), rip * 0.35);
          col = mix(uUnder * 0.7, skyCol, win);
          a = 1.0;
        }
        col = mix(col, uFogColor, fogF);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
}

// ----------------------------------------------------------------------------------------------- god rays (light shafts near the surface)
function rayTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const gx = g.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, 256);
  gy.addColorStop(0, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function makeRays(count) {
  const tex = rayTexture();
  const group = new THREE.Group();
  const rays = [];
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xcaf6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.userData = { bx: (Math.random() - 0.5) * 240, bz: (Math.random() - 0.5) * 240, w: 4 + Math.random() * 9, h: 70 + Math.random() * 40, ph: Math.random() * 6.28, sp: 0.2 + Math.random() * 0.4 };
    m.scale.set(m.userData.w, m.userData.h, 1);
    group.add(m); rays.push(m);
  }
  group.userData.rays = rays;
  return group;
}
// Move the rays so they always surround the camera, and fade them out with depth.
export function updateRays(group, cam, t, strength) {
  const rays = group.userData.rays;
  group.visible = strength > 0.01;
  if (!group.visible) return;
  for (const m of rays) {
    const u = m.userData;
    // wrap each ray's home position around the camera so there are always rays nearby
    const x = cam.x + ((((u.bx - cam.x + 120) % 240) + 240) % 240) - 120;
    const z = cam.z + ((((u.bz - cam.z + 120) % 240) + 240) % 240) - 120;
    m.position.set(x + Math.sin(t * u.sp + u.ph) * 2, -u.h * 0.5 + 0.5, z);
    m.rotation.set(0, Math.atan2(cam.x - x, cam.z - z), 0.22, 'YXZ');
    m.material.opacity = strength * (0.1 + 0.07 * Math.sin(t * u.sp * 2 + u.ph));
  }
}

// ----------------------------------------------------------------------------------------------- floating specks ("marine snow") + bubbles
export function makeSpecks(count) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = Math.random() * 50; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = Math.random() * 50; seed[i] = Math.random(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: U.uTime, uCenter: { value: new THREE.Vector3() }, uBright: { value: 1 }, uSize: { value: 60 } },
    vertexShader: `
      uniform float uTime, uSize; uniform vec3 uCenter; attribute float aSeed; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.2 + aSeed * 40.0) * 2.0, -uTime * (0.25 + aSeed * 0.3), cos(uTime * 0.17 + aSeed * 30.0) * 2.0);
        vec3 box = vec3(50.0, 30.0, 50.0);
        p = mod(p - uCenter + box * 0.5, box) - box * 0.5;
        vec4 mv = viewMatrix * vec4(uCenter + p, 1.0);
        float d = length(mv.xyz);
        vA = (1.0 - smoothstep(14.0, 25.0, length(p))) * smoothstep(0.5, 2.0, d);
        gl_PointSize = uSize * (0.5 + aSeed) / d;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uBright; varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vec3(0.8, 0.95, 1.0) * uBright, vA * uBright * 0.6 * (1.0 - r * 1.6)); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Bubbles that rise from the diver's mouth: a small pool of points that we move by hand each frame.
export function makeBubbles(count) {
  const pos = new Float32Array(count * 3), age = new Float32Array(count).fill(99);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAge', new THREE.BufferAttribute(age, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSize: { value: 90 } },
    vertexShader: `
      uniform float uSize; attribute float aAge; varying float vA;
      void main() { vec4 mv = viewMatrix * vec4(position, 1.0); float d = length(mv.xyz); vA = aAge < 90.0 ? 1.0 : 0.0; gl_PointSize = uSize * (0.55 + 0.45 * fract(aAge * 7.31)) / d; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      varying float vA;
      void main() { if (vA < 0.5) discard; vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; float ring = smoothstep(0.32, 0.46, r); float hi = smoothstep(0.2, 0.0, length(c - vec2(-0.14, -0.14))); gl_FragColor = vec4(vec3(0.85, 0.97, 1.0), 0.18 + ring * 0.55 + hi * 0.5); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData = { count, next: 0 };
  return pts;
}
export function emitBubble(pts, x, y, z) {
  const u = pts.userData, i = u.next; u.next = (u.next + 1) % u.count;
  const p = pts.geometry.attributes.position, a = pts.geometry.attributes.aAge;
  p.setXYZ(i, x, y, z); a.array[i] = Math.random() * 0.5; a.needsUpdate = true; p.needsUpdate = true;
}
export function updateBubbles(pts, dt, time) {
  const p = pts.geometry.attributes.position, a = pts.geometry.attributes.aAge;
  for (let i = 0; i < pts.userData.count; i++) {
    if (a.array[i] > 90) continue;
    a.array[i] += dt;
    const y = p.array[i * 3 + 1] + (1.1 + (i % 5) * 0.12) * dt;
    p.array[i * 3] += Math.sin(time * 2 + i) * 0.15 * dt; p.array[i * 3 + 2] += Math.cos(time * 1.7 + i * 2) * 0.15 * dt;
    p.array[i * 3 + 1] = y;
    if (y > 0.05 || a.array[i] > 14) a.array[i] = 99;   // pop at the surface
  }
  a.needsUpdate = true; p.needsUpdate = true;
}
