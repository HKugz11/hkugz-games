// KART RUSH - the garage preview: a small second renderer that shows your kart (colour, hat, type) turning on a stand.
import { THREE } from './core.js?v=3';
import { makeKartModel } from './kart.js?v=3';
import { RAINBOW } from './profile.js?v=3';

export function createPreview(canvas) {
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(canvas.width, canvas.height, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, .1, 60); cam.position.set(6.2, 3.6, 7.2); cam.lookAt(0, 1.15, 0);
  sc.add(new THREE.HemisphereLight(0xcfeaff, 0x8a7a9a, 1.25)); const sun = new THREE.DirectionalLight(0xfff1d0, 2.4); sun.position.set(4, 8, 5); sc.add(sun);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, .3, 36), new THREE.MeshToonMaterial({ color: 0x3a2f78 })); stand.position.y = -.2; sc.add(stand);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.15, .06, 6, 48), new THREE.MeshBasicMaterial({ color: 0x6affe0 })); rim.rotation.x = Math.PI / 2; rim.position.y = -.04; sc.add(rim);
  let model = null, rainbow = false;
  return {
    set(color, cls, hat) { if (model) sc.remove(model.g); model = makeKartModel(color, cls, hat); rainbow = color === RAINBOW; sc.add(model.g); },
    render(t) { if (!model) return; model.g.rotation.y = t * .9 + .6; if (rainbow) model.mat.color.setHSL((t * .45) % 1, .85, .58); if (model.hatSpin) model.hatSpin.rotation.y = t * 26; for (const w of model.wheels) w.w.rotation.x = t * 3; renderer.render(sc, cam); },
  };
}
