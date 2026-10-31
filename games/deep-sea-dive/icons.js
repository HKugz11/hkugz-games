// icons.js - draws a small picture of every fish (from its 3D model) for the "NEW FISH DISCOVERED!" popup, the Fish-dex and the sell list.
// Done once, with the game's own renderer. Returns { fishId: "data:image/png;base64,..." }.
import * as THREE from './three.module.min.js';
import { FISH } from './data.js?v=2';
import { buildSpecies, speciesMaterial } from './fishmodels.js?v=2';

export function renderIcons(renderer) {
  const W = 192, H = 128;
  const rt = new THREE.WebGLRenderTarget(W, H);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9ab0, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(0.5, 1, 1); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 80);
  const prevRT = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(prevColor); renderer.setClearColor(0x000000, 0);
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'), img = g.createImageData(W, H), buf = new Uint8Array(W * H * 4), out = {};
  for (const def of FISH) {
    const built = buildSpecies(def), mesh = new THREE.Mesh(built.geo, speciesMaterial(built));
    scene.add(mesh);
    built.geo.computeBoundingSphere();
    const bs = built.geo.boundingSphere;
    const dir = (def.shape === 'ray' ? new THREE.Vector3(0.1, 1, 0.5) : def.shape === 'jelly' ? new THREE.Vector3(0.1, 0.12, 1) : new THREE.Vector3(0.22, 0.3, 1)).normalize();
    cam.position.copy(bs.center).addScaledVector(dir, bs.radius / Math.sin(cam.fov * Math.PI / 360) * 0.9);
    cam.lookAt(bs.center);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {          // flip upside-down and turn "linear" light into normal screen colours
      const s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) img.data[d + k] = Math.round(255 * Math.pow(buf[s + k] / 255, 1 / 2.2));
      img.data[d + 3] = buf[s + 3];
    }
    g.putImageData(img, 0, 0);
    out[def.id] = canvas.toDataURL('image/png');
    scene.remove(mesh); built.geo.dispose();
  }
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevColor, prevAlpha); rt.dispose();
  return out;
}
