// The background pass: stars, the sun, the home planet with its sky, and the moon. Shared by the flight view and the map view.
import * as THREE from './three.module.min.js';
import { QUAD_VERT, makeStarMaterial, makeBodyMaterial, setBodyUniforms } from './shaders.js?v=1';
import { BODIES, SUN_DIR, beanState } from './data.js?v=1';

export class Sky {
  constructor() {
    this.scene = new THREE.Scene();
    const quad = new THREE.PlaneGeometry(2, 2);
    this.starMat = makeStarMaterial();
    this.stars = new THREE.Mesh(quad, this.starMat); this.stars.frustumCulled = false; this.stars.renderOrder = 0;
    this.cobbleMat = makeBodyMaterial(0); this.beanMat = makeBodyMaterial(1);
    this.cobble = new THREE.Mesh(quad, this.cobbleMat); this.bean = new THREE.Mesh(quad, this.beanMat);
    this.cobble.frustumCulled = this.bean.frustumCulled = false;
    this.scene.add(this.stars, this.cobble, this.bean);
    this.rot = new THREE.Matrix3(); this.tan = new THREE.Vector2();
    this.steps = 8; this.oct = 9;
  }
  // camPos: camera position (doubles) in the frame of `frame` ('cobble' or 'bean'), at universal time ut
  update(camera, camPos, frame, ut, time, pixelH, starFade) {
    camera.updateMatrixWorld();
    this.rot.setFromMatrix4(camera.matrixWorld);
    const th = Math.tan(camera.fov * Math.PI / 360);
    this.tan.set(th * camera.aspect, th);
    const pixel = 2 * th / pixelH;
    const bp = beanState(ut).r;
    const cPos = frame === 'cobble' ? [0, 0, 0] : [-bp[0], -bp[1], -bp[2]];
    const bPos = frame === 'cobble' ? bp : [0, 0, 0];
    const sun = SUN_DIR;
    const rel = (c) => [camPos[0] - c[0], camPos[1] - c[1], camPos[2] - c[2]];
    const cb = BODIES.cobble, bn = BODIES.bean;
    setBodyUniforms(this.cobbleMat, rel(cPos), cb.R, 70000, cb.atm.H, sun, this.rot, this.tan, pixel, time, this.steps, this.oct);
    setBodyUniforms(this.beanMat, rel(bPos), bn.R, 0, 1000, sun, this.rot, this.tan, pixel, time, 1, this.oct);
    // draw far things first
    const dC = Math.hypot(...rel(cPos)), dB = Math.hypot(...rel(bPos));
    this.cobble.renderOrder = dC > dB ? 1 : 2; this.bean.renderOrder = dC > dB ? 2 : 1;
    // skip bodies that are nowhere near the screen
    const fwd = new THREE.Vector3(0, 0, -1).applyMatrix3(this.rot);
    const vis = (relv, R, d) => {
      const dir = new THREE.Vector3(-relv[0], -relv[1], -relv[2]).normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, dir.dot(fwd)))), size = Math.asin(Math.min(1, R / Math.max(d, R * 1.0001)));
      return d <= R * 1.0001 || ang < Math.hypot(th, th * camera.aspect) + size + 0.1 || (d - R) < 90000;
    };
    this.cobble.visible = vis(rel(cPos), cb.R + 70000, dC);
    this.bean.visible = vis(rel(bPos), bn.R, dB);
    this.starMat.uniforms.uCamRot.value.copy(this.rot); this.starMat.uniforms.uTan.value.copy(this.tan);
    this.starMat.uniforms.uSun.value.set(sun[0], sun[1], sun[2]); this.starMat.uniforms.uStarFade.value = starFade;
  }
  render(renderer, camera) { renderer.render(this.scene, camera); }
}
