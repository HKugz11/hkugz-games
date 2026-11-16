// A little Santa hat for the 3D characters (red cone, white brim, white pom-pom). Only exists in the Christmas season (assets/xmas.js sets class "xmas" on <html>).
// Usage:  import { santaHat } from '../../assets/xmas-hat.js';   const hat = santaHat(THREE, toon, headRadius);  if (hat) { hat.position.set(x, headCenterY, z); body.add(hat); }
// `toon` is the game's own material maker (color => material). The hat faces forward = -z like the characters; its tip leans back.
const cache = new Map();
export const xmasOn = () => document.documentElement.classList.contains('xmas');
export function santaHat(THREE, mk, r = .3) {
  if (!xmasOn()) return null;
  let c = cache.get(THREE);
  if (!c) {
    const sh = g => { g.userData.shared = true; return g; }, mat = col => { const m = mk(col); m.userData.shared = true; return m; };
    c = { cone: sh(new THREE.ConeGeometry(1, 1.75, 14)), brim: sh(new THREE.TorusGeometry(1, .24, 8, 20)), pom: sh(new THREE.SphereGeometry(.26, 10, 8)), red: mat(0xd6202c), white: mat(0xffffff) };
    cache.set(THREE, c);
  }
  const g = new THREE.Group(), hat = new THREE.Group();
  const cone = new THREE.Mesh(c.cone, c.red); cone.position.y = .62 + .875;
  const brim = new THREE.Mesh(c.brim, c.white); brim.rotation.x = Math.PI / 2; brim.position.y = .62;
  const pom = new THREE.Mesh(c.pom, c.white); pom.position.y = .62 + 1.75;
  hat.add(cone, brim, pom); hat.rotation.x = .26; hat.rotation.z = -.08; g.add(hat); g.scale.setScalar(r); g.userData.santaHat = true;
  return g;
}
