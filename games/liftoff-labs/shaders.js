// Shaders: a whole planet (and its sky) drawn as a perfect sphere in the pixel shader, so it looks right from the ground and from orbit.
import * as THREE from './three.module.min.js';

const COMMON = `
precision highp float;
varying vec2 vNdc;
uniform mat3 uCamRot;
uniform vec2 uTan;
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

export const QUAD_VERT = `
varying vec2 vNdc;
void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const STAR_FRAG = COMMON + `
uniform vec3 uSun;
uniform float uStarFade;
void main(){
  vec3 rd = normalize(uCamRot * vec3(vNdc.x * uTan.x, vNdc.y * uTan.y, -1.0));
  vec3 col = vec3(0.004, 0.005, 0.012);
  // stars: one possible star per cell
  vec3 q = rd * 70.0; vec3 c = floor(q); float h = hash13(c);
  if (h > 0.93) {
    vec3 o = vec3(hash13(c + 1.7), hash13(c + 5.3), hash13(c + 9.1)) * 0.6 + 0.2;
    float d = length(q - c - o);
    float s = smoothstep(0.17, 0.0, d) * (0.4 + 0.6 * hash13(c + 3.3));
    col += s * mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.9, 0.7), hash13(c + 8.8)) * uStarFade;
  }
  float band = abs(rd.y * 0.8 + rd.x * 0.3 + rd.z * 0.1);
  col += vec3(0.02, 0.02, 0.035) * smoothstep(0.25, 0.0, band) * uStarFade;
  float sd = dot(rd, uSun);
  col += vec3(1.0, 0.93, 0.78) * smoothstep(0.99985, 0.99992, sd) * 6.0;
  col += vec3(1.0, 0.8, 0.5) * pow(max(sd, 0.0), 220.0) * 0.8 + vec3(1.0, 0.7, 0.4) * pow(max(sd, 0.0), 12.0) * 0.06;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const BODY_FRAG = COMMON + `
uniform vec3 uUp; uniform float uDist, uAlt, uR, uAtm, uC, uC2, uPixel, uHs, uTime;
uniform vec3 uSun; uniform int uKind; uniform int uSteps;
uniform vec3 uColA, uColB; uniform int uOct;
const vec3 BETA = vec3(1.2e-5, 2.7e-5, 6.6e-5);

float detail(vec3 P, float foot){
  float a = 0.0, amp = 0.5, wl = 800.0;
  for (int i = 0; i < 9; i++) {
    if (i >= uOct) break;
    float f = clamp((wl / foot - 2.0) / 5.0, 0.0, 1.0);
    if (f <= 0.0) break;
    a += amp * f * (vnoise(P / wl) - 0.5);
    amp *= 0.55; wl *= 0.5;
  }
  return a;
}
float fbm(vec3 p){ float a = 0.0, amp = 0.5; for (int i = 0; i < 5; i++) { a += amp * vnoise(p); p = p * 2.03 + 11.7; amp *= 0.5; } return a; }

// colour of the ground at unit position n; P is the same point in metres, foot is the size of a pixel on the ground
vec3 terrain(vec3 n, vec3 P, float foot, out float water, out float spec){
  water = 0.0; spec = 0.0;
  if (uKind == 1) {                                   // Bean: pale moon-dust with soft craters
    float m = fbm(n * 5.0 + 3.0);
    vec3 c = mix(vec3(0.62, 0.57, 0.5), vec3(0.86, 0.8, 0.7), smoothstep(0.35, 0.65, m));
    float cr = vnoise(n * 40.0); c *= 0.85 + 0.3 * smoothstep(0.3, 0.7, cr) * (0.6 + 0.4 * vnoise(n * 90.0));
    float d = detail(P, foot); c *= 1.0 + d * 0.9;
    return c;
  }
  float cont = fbm(n * 2.1 + 7.0);
  float padArc = length(vec2(P.y, P.z));
  float nearPad = smoothstep(260000.0, 60000.0, padArc);
  cont = mix(cont, 0.575, nearPad);
  float sea = 0.5;
  float det = detail(P, foot);
  float polar = smoothstep(0.82, 0.92, abs(n.y) + (fbm(n * 6.0) - 0.5) * 0.15);
  vec3 col = vec3(0.0);
  if (cont < sea - 0.005) {
    float depth = clamp((sea - cont) * 5.0, 0.0, 1.0);
    col = mix(vec3(0.16, 0.56, 0.82), vec3(0.03, 0.14, 0.46), depth);
    col += det * 0.08;
    water = 1.0 - polar; spec = 1.0;
  } else {
    float e = cont - sea + det * 0.06 * clamp(foot / 4.0, 0.0, 4.0) * 0.0;
    float lush = fbm(n * 14.0 + 21.0);
    vec3 grass = mix(vec3(0.34, 0.66, 0.24), vec3(0.18, 0.5, 0.2), lush);
    vec3 dry = mix(vec3(0.74, 0.66, 0.38), vec3(0.62, 0.45, 0.3), lush);
    float dryness = smoothstep(0.35, 0.65, fbm(n * 3.3 + 40.0)) * (1.0 - nearPad);
    col = mix(grass, dry, dryness * 0.8);
    col = mix(vec3(0.93, 0.85, 0.6), col, smoothstep(0.0, 0.025, e));     // beach
    col = mix(col, vec3(0.5, 0.46, 0.44), smoothstep(0.16, 0.26, e));       // rock
    col = mix(col, vec3(0.97, 0.98, 1.0), smoothstep(0.27, 0.34, e));       // snow
    col *= 1.0 + det * 1.1;
  }
  col = mix(col, vec3(0.95, 0.97, 1.0), polar);
  // the launch site: bare dirt ring, then grass
  if (uKind == 0) {
    float pad = smoothstep(90.0, 40.0, padArc);
    col = mix(col, vec3(0.62, 0.55, 0.42) * (1.0 + det * 0.8), pad * 0.8);
  }
  return col;
}

void main(){
  vec3 rd = normalize(uCamRot * vec3(vNdc.x * uTan.x, vNdc.y * uTan.y, -1.0));
  float b = uDist * dot(uUp, rd);
  float disc = b * b - uC;
  float tg = -1.0; bool hitG = false;
  if (disc >= 0.0) { float t0 = -b - sqrt(disc); if (t0 > 0.0) { tg = t0; hitG = true; } }
  vec3 oc = uDist * uUp;
  vec3 inscat = vec3(0.0); vec3 T = vec3(1.0);
  float cosS = dot(rd, uSun);
  if (uAtm > 0.0) {
    float disc2 = b * b - uC2;
    if (disc2 > 0.0) {
      float s2 = sqrt(disc2);
      float ta = max(-b - s2, 0.0);
      float tb = hitG ? tg : (-b + s2);
      if (tb > ta) {
        float tmid = clamp(-b, ta, tb);
        float phase = 0.75 * (1.0 + cosS * cosS) + 2.2 * pow(max(cosS, 0.0), 18.0);
        for (int side = 0; side < 2; side++) {
          float tEnd = side == 0 ? ta : tb;
          float len = tEnd - tmid;
          if (abs(len) < 0.5) continue;
          for (int k = 0; k < 8; k++) {
            if (k >= uSteps) break;
            float fn = float(uSteps);
            float u0 = float(k) / fn, u1 = float(k + 1) / fn;
            float t0 = tmid + len * u0 * u0, t1 = tmid + len * u1 * u1;
            float tm = 0.5 * (t0 + t1), w = abs(t1 - t0);
            vec3 p = oc + rd * tm;
            float h = length(p) - uR;
            float dens = exp(-max(h, 0.0) / uHs);
            float mu = dot(normalize(p), uSun);
            vec3 lt = exp(-BETA * (uHs * dens) / max(mu + 0.2, 0.06)) * smoothstep(-0.22, 0.04, mu);
            vec3 seg = BETA * dens * w;
            vec3 Ts = exp(-seg);
            inscat += T * lt * (1.0 - Ts) * phase * 0.9;
            T *= Ts;
          }
        }
      }
    }
  }
  vec3 outCol; float outA;
  if (hitG) {
    vec3 P0 = oc + rd * tg;                     // metres from the centre
    vec3 n = normalize(P0);
    vec3 P = n * uR;
    float cosI = max(abs(dot(n, rd)), 0.06);
    float foot = max(tg * uPixel / cosI, 0.05);
    float water, spec;
    vec3 alb = terrain(n, P, foot, water, spec);
    float mu = dot(n, uSun);
    vec3 lt = vec3(1.0);
    if (uAtm > 0.0) lt = exp(-BETA * uHs / max(mu + 0.2, 0.06)) * smoothstep(-0.22, 0.04, mu);
    float dif = smoothstep(-0.02, 0.35, mu) * 0.9 + 0.1 * max(mu, 0.0);
    float amb = uAtm > 0.0 ? 0.2 : 0.03;
    vec3 col = alb * (dif * lt * 1.18 + amb * vec3(0.7, 0.85, 1.0));
    if (water > 0.5 && mu > 0.0) {
      vec3 hv = normalize(uSun - rd);
      col += lt * pow(max(dot(n, hv), 0.0), 140.0) * 1.2;
    }
    // painted clouds, only seen from high up
    if (uKind == 0 && uAlt > 6000.0) {
      float cl = smoothstep(0.6, 0.8, fbm(n * 5.5 + vec3(uTime * 0.0004, 0.0, 3.0)));
      cl *= smoothstep(6000.0, 40000.0, uAlt);
      col = mix(col, vec3(1.0) * (dif * lt + amb) * 1.1, cl * 0.8);
    }
    outCol = col * T + inscat * 1.25; outA = 0.0;
  } else {
    if (uAtm <= 0.0) discard;
    outCol = pow(inscat * 2.4, vec3(0.62)); outA = (T.r + T.g + T.b) / 3.0;
  }
  gl_FragColor = vec4(outCol, outA);
}
`;

export function makeStarMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: STAR_FRAG, depthTest: false, depthWrite: false,
    uniforms: { uCamRot: { value: new THREE.Matrix3() }, uTan: { value: new THREE.Vector2(1, 1) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uStarFade: { value: 1 } },
  });
}

export function makeBodyMaterial(kind, colA, colB) {
  return new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: BODY_FRAG, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.SrcAlphaFactor,
    uniforms: {
      uCamRot: { value: new THREE.Matrix3() }, uTan: { value: new THREE.Vector2(1, 1) }, uPixel: { value: 0.001 },
      uUp: { value: new THREE.Vector3(0, 1, 0) }, uDist: { value: 1 }, uAlt: { value: 0 }, uR: { value: 1 }, uAtm: { value: 0 },
      uC: { value: 0 }, uC2: { value: 0 }, uHs: { value: 5000 }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) },
      uKind: { value: kind }, uSteps: { value: 8 }, uOct: { value: 9 }, uColA: { value: new THREE.Color(colA || 0xffffff) }, uColB: { value: new THREE.Color(colB || 0xffffff) },
    },
  });
}

// Fill in everything the body shader needs for one body, given the camera position relative to the body centre (metres, doubles)
export function setBodyUniforms(mat, camRel, R, atmH, hs, sun, camRot, tanV, pixel, time, steps, oct = 9) {
  const u = mat.uniforms;
  const dist = Math.hypot(camRel[0], camRel[1], camRel[2]) || 1;
  u.uUp.value.set(camRel[0] / dist, camRel[1] / dist, camRel[2] / dist);
  u.uDist.value = dist;
  const alt = dist - R;
  u.uAlt.value = alt; u.uR.value = R;
  u.uC.value = alt * (alt + 2 * R);
  const Ra = R + atmH, alt2 = dist - Ra;
  u.uC2.value = alt2 * (dist + Ra);
  u.uAtm.value = atmH; u.uHs.value = hs;
  u.uSun.value.set(sun[0], sun[1], sun[2]);
  u.uCamRot.value.copy(camRot); u.uTan.value.copy(tanV); u.uPixel.value = pixel; u.uTime.value = time; u.uSteps.value = steps; u.uOct.value = oct;
}
