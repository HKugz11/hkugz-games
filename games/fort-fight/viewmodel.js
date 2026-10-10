// FORT FIGHT - first-person viewmodel: the weapon (or a build blueprint) in your hands, drawn in its own scene on top of the world.
import { THREE, V3, toon, S, clamp, lerp, camera, W } from './core.js?v=9';
import { gunGeo } from './actors.js?v=9';
import { geoFor } from './pieces.js?v=9';

export const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(62, 1, .01, 10);
vmScene.add(new THREE.HemisphereLight(0xe4f0ff, 0x8a9a6a, 1.35)); const vsun = new THREE.DirectionalLight(0xffffff, 2.1); vsun.position.set(1, 2, 1.5); vmScene.add(vsun);
const resizeVM = () => { vmCam.aspect = innerWidth / innerHeight; vmCam.updateProjectionMatrix(); }; addEventListener('resize', resizeVM); resizeVM();
const vcol = toon(0xffffff, { vertexColors: true }), armMat = toon(0x2ee6ff);
const root = new THREE.Group(); root.scale.setScalar(.48); vmScene.add(root);
const guns = {}; for (const id of ['pick', 'ar', 'pump', 'smg', 'sniper']) { const m = new THREE.Mesh(gunGeo(id), vcol); m.visible = false; root.add(m); guns[id] = m; }
const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .34, 3, 8), armMat); sleeve.position.set(.04, -.1, .26); sleeve.rotation.x = 1.25; root.add(sleeve);
const bpMat = new THREE.MeshBasicMaterial({ color: 0x4aff8a, transparent: true, opacity: .55, depthWrite: false });
const bp = new THREE.Mesh(geoFor('w'), bpMat); bp.visible = false; root.add(bp);
let kickZ = 0, kickR = 0, swingT = 0, bob = 0, shown = '', lastBuild = '';
export function vmKick(w) { kickZ += .035 + w.kick * 2.2; kickR += w.kick * 5; }
export function vmSwing() { swingT = .3; }
export function updateVM(dt, P, adsK, scoped) {
  const show = S.view === 'fp' && P && P.alive && !scoped && !W.edit; vmScene.visible = show; if (!show) return;
  armMat.color.setHex(P.color);
  const key = P.mode === 'build' ? 'bp' : P.weapon.id; if (key !== shown) { shown = key; for (const k in guns) guns[k].visible = k === key; bp.visible = key === 'bp'; }
  if (key === 'bp') { const sig = P.buildType; if (sig !== lastBuild) { lastBuild = sig; bp.geometry = geoFor(sig); bp.scale.setScalar(sig === 'w' ? .12 : .13); } bp.rotation.y += dt * 1.6; }
  const sp = Math.hypot(P.vel.x, P.vel.z); bob += dt * (P.onGround ? sp * 1.15 : 0); const bobAmt = clamp(sp / 7, 0, 1) * (1 - adsK * .8);
  kickZ += (0 - kickZ) * clamp(dt * 12, 0, 1); kickR += (0 - kickR) * clamp(dt * 11, 0, 1); swingT = Math.max(0, swingT - dt);
  const sw = swingT > 0 ? Math.sin((1 - swingT / .3) * Math.PI) : 0, rel = P.reloadT > 0 && !P.weapon.melee ? Math.sin(clamp(1 - P.reloadT / P.weapon.reload, 0, 1) * Math.PI) : 0, swap = clamp(P.swapT / .2, 0, 1);
  const x = lerp(.2, .0, adsK) + Math.sin(bob) * .012 * bobAmt - sw * .18, y = lerp(-.17, -.11, adsK) + Math.abs(Math.cos(bob)) * .012 * bobAmt - rel * .16 - swap * .22 - sw * .06, z = lerp(-.4, -.34, adsK) + kickZ - sw * .05;
  root.position.set(x, y, z); root.rotation.set(kickR - rel * .55 - sw * 1.3 + swap * .5, -sw * .4 + (key === 'bp' ? 0 : 0), rel * .35);
  // the world camera is the viewmodel camera too, so the gun stays glued to the screen
  vmCam.position.set(0, 0, 0); vmCam.rotation.set(0, 0, 0);
}
