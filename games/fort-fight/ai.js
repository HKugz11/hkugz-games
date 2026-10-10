// FORT FIGHT - bot brains: they fight, strafe, build walls to hide behind, ramp up to you, shoot through your walls and harvest.
import { V3, rnd, clamp, angDiff, pick, W, TAU } from './core.js?v=10';
import { world } from './physics.js?v=10';
import { WEAPONS, fireGun, swingPickaxe, raycastAll } from './actors.js?v=10';
import { levelAt, cardinal, pieces } from './pieces.js?v=10';
import { props } from './maps.js?v=10';

export const DIFFS = {
  chill: { name: 'Chill', react: .8, noise: .075, turn: 3.6, burst: [.5, 1.1], pause: [.7, 1.5], build: .15, ramp: false, box: false, speed: .78, head: .05, view: 55 },
  normal: { name: 'Normal', react: .5, noise: .04, turn: 5.5, burst: [.7, 1.5], pause: [.4, 1], build: .5, ramp: true, box: false, speed: .92, head: .15, view: 70 },
  sweaty: { name: 'Sweaty', react: .28, noise: .02, turn: 8.5, burst: [.9, 2], pause: [.25, .6], build: .95, ramp: true, box: true, speed: 1, head: .3, view: 90 },
};
const dirOf = (yaw, pitch) => new V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
export function makeAI(diffId) { const d = DIFFS[diffId] || DIFFS.normal; return { d, target: null, seen: 0, lost: 99, last: new V3(), react: 0, strafe: Math.random() < .5 ? 1 : -1, strafeT: 0, burstT: 0, pauseT: 0, wp: null, nx: 0, ny: 0, noiseT: 0, focus: 0, stuckT: 0, lastP: new V3(), wallCD: 0, rampCD: 0, rampN: 0, boxed: 0, harvest: null, swapCD: 0, jumpT: rnd(1, 3) }; }

export function botUpdate(a, dt) {
  if (!a.alive) return; const ai = a.ai, d = ai.d, M = W.M; ai.wallCD -= dt; ai.rampCD -= dt; ai.swapCD -= dt; ai.noiseT -= dt; ai.strafeT -= dt; ai.jumpT -= dt;
  const eye = a.eye();
  // --- who to fight: the closest visible enemy, or the one we saw a moment ago
  let best = null, bd = 1e9;
  for (const v of W.actors) { if (v === a || !v.alive || v.team === a.team || v.spawnProt > 0 || v.isDummy && M && M.noDummyTargets) continue; const dd = Math.hypot(v.pos.x - a.pos.x, v.pos.z - a.pos.z, (v.pos.y - a.pos.y) * .5); if (dd < bd && dd < d.view && (M && M.mode === 'box' || world.lineClear(eye.x, eye.y, eye.z, v.pos.x, v.pos.y + v.h * .6, v.pos.z))) { bd = dd; best = v; } }
  if (best) { if (ai.target !== best) { ai.react = d.react; ai.focus = 0; } ai.target = best; ai.lost = 0; ai.last.copy(best.pos); } else { ai.lost += dt; if (ai.lost > 4) ai.target = null; }
  const t = ai.target, hurt = W.time - a.lastHurt < 1; if (hurt && !t && a.lastHitBy && a.lastHitBy.alive) { ai.target = a.lastHitBy; ai.last.copy(a.lastHitBy.pos); ai.lost = 1.5; ai.react = d.react * .6; }
  let mx = 0, mz = 0, jump = false, crouch = false, fire = false, tp = null;
  if (ai.target && ai.target.alive) {
    tp = ai.lost < 1.2 ? ai.target.pos : ai.last; const tv = ai.target, dx = tp.x - a.pos.x, dz = tp.z - a.pos.z, dist = Math.hypot(dx, dz), vis = ai.lost < .3;
    ai.react -= dt; ai.focus = Math.min(2, ai.focus + dt);
    // aim
    if (ai.noiseT <= 0) { const k = (1 - ai.focus / 4); ai.nx = rnd(-d.noise, d.noise) * k; ai.ny = rnd(-d.noise, d.noise) * k; ai.noiseT = .25; }
    const aimY = tp.y + (tv.h || 1.8) * (Math.random() < d.head * .02 ? .92 : .62), want = Math.atan2(-dx, -dz) + ai.nx, wp = Math.atan2(aimY - eye.y, dist) + ai.ny;
    a.yaw += clamp(angDiff(want, a.yaw), -d.turn * dt, d.turn * dt); a.pitch += clamp(wp - a.pitch, -d.turn * dt * .8, d.turn * dt * .8);
    const err = Math.abs(angDiff(want, a.yaw)) + Math.abs(wp - a.pitch);
    // pick a weapon for the distance
    if (ai.swapCD <= 0 && a.reloadT <= 0) { const wi = dist < 8 ? 2 : dist < 22 ? (Math.random() < .5 ? 3 : 1) : dist > 52 ? (Math.random() < .35 ? 4 : 1) : 1; if (wi !== a.wi || a.mode !== 'gun') { a.selectWeapon(wi); } ai.swapCD = 1.5; }
    // movement: keep a fighting distance and strafe
    const want_d = a.wi === 2 ? 5 : a.wi === 4 ? 40 : 14; if (ai.strafeT <= 0) { ai.strafe = Math.random() < .5 ? 1 : -1; ai.strafeT = rnd(.6, 1.6); }
    mz = dist > want_d + 4 ? 1 : dist < want_d - 4 ? -.8 : .2; mx = ai.strafe * .85; if (a.blocked) { jump = true; mx = ai.strafe; }
    if (ai.jumpT <= 0 && (hurt || dist < 14)) { jump = true; ai.jumpT = rnd(1.2, 3); }
    // building: walls between us when we are being shot, and ramps to climb up to a higher enemy
    const high = tp.y - a.pos.y;
    if (d.ramp && high > 2.6 && dist < 34 && ai.rampCD <= 0 && (a.onGround || a.stepped)) { ai.rampCD = .38; ai.rampN++; if (ai.rampN < 14) { a.yaw = Math.atan2(-dx, -dz); a.build('s'); mz = 1; mx = 0; } }
    else if (high < 2) ai.rampN = 0;
    if (ai.rampN > 0 && high > 2.6) { mz = 1; mx = 0; }
    if (hurt && ai.wallCD <= 0 && Math.random() < d.build * .06 + (a.shield <= 0 ? .02 : 0) && dist > 3) { ai.wallCD = rnd(1.2, 2.6); const sy = a.yaw; a.yaw = Math.atan2(-dx, -dz); a.build('w'); a.yaw = sy; if (d.box && a.hp < 45 && Math.random() < .5) boxUp(a); }
    // shoot (also through walls the enemy built: the bullets break them)
    const w = a.weapon; if (!w.melee && ai.react <= 0 && err < (a.wi === 4 ? .02 : .09)) {
      if (ai.burstT > 0) { ai.burstT -= dt; fire = true; } else { ai.pauseT -= dt; if (ai.pauseT <= 0) { ai.burstT = rnd(...d.burst) * (a.wi === 2 || a.wi === 4 ? .1 : 1); ai.pauseT = rnd(...d.pause); } }
    }
    if (fire) { const o = eye, dir = dirOf(a.yaw, a.pitch); if (a.mode !== 'gun') { a.mode = 'gun'; a.refreshHeld(); } fireGun(a, o, dir, new V3(o.x + dir.x * .8, o.y - .2, o.z + dir.z * .8)); }
    if (dist < 2.8 && a.wi === 0) swingPickaxe(a, eye, dirOf(a.yaw, a.pitch));
    if (a.ammo[a.wi].mag === 0 && !w.melee) a.startReload();
  } else {
    // roam (and harvest when we are running low on materials)
    ai.rampN = 0; if (a.mode !== 'gun') { a.mode = 'gun'; a.refreshHeld(); }
    const low = !a.infinite && a.mats.wood + a.mats.stone + a.mats.metal < 90;
    if (low && !ai.harvest) { let bp = null, bdd = 1e9; for (const p of props) if (!p.dead) { const dd = Math.hypot(p.x - a.pos.x, p.z - a.pos.z); if (dd < bdd && dd < 60) { bdd = dd; bp = p; } } ai.harvest = bp; }
    if (ai.harvest && (ai.harvest.dead > 0 || !low)) ai.harvest = null;
    if (ai.harvest) {
      const p = ai.harvest, dx = p.x - a.pos.x, dz = p.z - a.pos.z, dist = Math.hypot(dx, dz); a.yaw += clamp(angDiff(Math.atan2(-dx, -dz), a.yaw), -6 * dt, 6 * dt); a.pitch += (-.1 - a.pitch) * clamp(dt * 6, 0, 1);
      if (a.wi !== 0 || a.mode !== 'gun') a.selectWeapon(0);
      if (dist > 2.2) mz = 1; else if (a.cd <= 0) swingPickaxe(a, eye, dirOf(a.yaw, a.pitch));
      a.matSel = a.mats.wood <= a.mats.stone && a.mats.wood <= a.mats.metal ? 'wood' : a.mats.stone <= a.mats.metal ? 'stone' : 'metal'; if (p.mat) a.matSel = p.mat;
    } else {
      if (!ai.wp || Math.hypot(ai.wp.x - a.pos.x, ai.wp.z - a.pos.z) < 2.5) { const B = world.bounds; ai.wp = new V3(rnd(B.minX + 6, B.maxX - 6), 0, rnd(B.minZ + 6, B.maxZ - 6)); }
      const dx = ai.wp.x - a.pos.x, dz = ai.wp.z - a.pos.z; a.yaw += clamp(angDiff(Math.atan2(-dx, -dz), a.yaw), -4 * dt, 4 * dt); a.pitch += (0 - a.pitch) * clamp(dt * 4, 0, 1); mz = .85;
      if (a.blocked && Math.random() < .08) jump = true;
      if (a.wi === 0 || a.wi > 4) a.selectWeapon(1); if (a.ammo[a.wi].mag < WEAPONS[a.wi].mag * .5 && !a.weapon.melee) a.startReload();
    }
  }
  // stuck? pick somewhere else
  ai.stuckT += dt; if (ai.stuckT > .8) { if (a.pos.distanceTo(ai.lastP) < .5 && (mz !== 0 || mx !== 0)) { ai.wp = null; if (!ai.target) { jump = true; if (a.blocked && ai.harvest) ai.harvest = null; } } ai.lastP.copy(a.pos); ai.stuckT = 0; }
  a.step(dt, { mx, mz, jump, crouch, speedMul: d.speed });
}
// build four walls and a roof around yourself
export function boxUp(a) {
  const y = a.yaw; for (let i = 0; i < 4; i++) { a.yaw = i * Math.PI / 2; a.buildCD = 0; a.build('w'); } a.yaw = y; a.buildCD = 0; a.build('r');
}
