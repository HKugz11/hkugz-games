// KART RUSH - the computer drivers: they follow the track, cut inside corners, slow down for bends, drift, dodge and use items.
import { clamp, lerp, rnd, angDiff } from './core.js?v=2';
import { pointAt, nearest } from './track.js?v=2';

export const DIFFS = {
  easy: { name: 'Easy', top: .86, skill: .5, items: .45, noise: .5 },
  normal: { name: 'Normal', top: .94, skill: .8, items: .8, noise: .25 },
  hard: { name: 'Hard', top: 1.01, skill: 1, items: 1, noise: .1 },
};
export const makeAI = (diff, lane) => ({ diff, lane, wob: Math.random() * 6.28, itemT: 0, stuck: 0, drifting: 0 });

export function aiDrive(k, tr, ctx, dt) {
  const a = k.ai, D = a.diff, speed = Math.max(k.vf, 6), inp = k.in; a.wob += dt * .7;
  const Ld = 9 + speed * .52, sT = k.s + Ld;
  const kap = pointAt(tr, k.s + 42).kappa;                                         // how sharp the bend ahead is (+ = right)
  const room = tr.width - 3.2; let lat = a.lane * room * .72 + clamp(kap * 380, -1, 1) * room * .55 * D.skill + Math.sin(a.wob) * (1 - D.skill) * 3;
  for (const o of ctx.karts) { if (o === k) continue; const ahead = o.dist - k.dist; if (ahead > 3 && ahead < 18 && Math.abs(o.d - k.d) < 3.6) lat += (k.d >= o.d ? 1 : -1) * 4.2; }
  lat = clamp(lat, -room, room); const tp = pointAt(tr, sT, lat);
  const want = Math.atan2(tp.x - k.p.x, tp.z - k.p.z); let steer = clamp(angDiff(want, k.h) * 2.7, -1, 1); steer += (Math.random() - .5) * D.noise * .25; inp.steer = clamp(steer, -1, 1);
  // how fast can we take the corners ahead?
  let safe = 999; for (const off of [20, 45, 75]) { const kk = Math.abs(pointAt(tr, k.s + off).kappa); if (kk > 1e-4) safe = Math.min(safe, Math.sqrt(31 / kk)); }
  const rb = ctx.player ? clamp((ctx.player.dist - k.dist) / 520, -.06, .1) : 0; k.top = D.top * (1 + rb);
  const targetV = Math.min(k.topSpeed(), safe * (.96 + .12 * D.skill)); inp.thr = k.vf < targetV ? 1 : 0; inp.brk = k.vf > targetV * 1.2 && k.vf > 22 ? 1 : 0; if (k.vf < 5) inp.thr = 1;
  // drift through longer bends
  const k0 = pointAt(tr, k.s + 14).kappa; const wantDrift = D.skill > .7 && Math.abs(k0) > .0075 && k.vf > 28 && !k.offroad;
  if (wantDrift) { const dir = Math.sign(k0); inp.drift = true; if (!k.drift.on) inp.steer = dir * Math.max(.6, Math.abs(inp.steer)); else if (Math.sign(inp.steer) !== dir) inp.steer = dir * .3; } else inp.drift = false;
  // items
  inp.itemPressed = false;
  if (k.item) {
    a.itemT += dt; const it = k.item, rank = k.place - 1; let use = false;
    if (it === 'turbo') use = Math.abs(kap) < .006 && a.itemT > .8; else if (it === 'shield') use = a.itemT > 3 + Math.random() * .02;
    else if (it === 'zap') use = rank >= 2 && a.itemT > 1;
    else if (it === 'banana') { for (const o of ctx.karts) { const behind = k.dist - o.dist; if (o !== k && behind > 4 && behind < 34 && Math.abs(o.d - k.d) < 6) use = true; } if (a.itemT > 14) use = true; }
    else if (it === 'rocket') { for (const o of ctx.karts) { const ahead = o.dist - k.dist; if (o !== k && ahead > 14 && ahead < 120 && Math.abs(o.d - k.d) < 14) use = true; } if (a.itemT > 12) use = true; }
    if (use && Math.random() < D.items * 4 * dt + .02) { inp.itemPressed = true; a.itemT = 0; }
  } else a.itemT = 0;
  // stuck against something? put us back on the road
  if (ctx.racing && Math.abs(k.vf) < 2.5 && k.spinT <= 0) a.stuck += dt; else a.stuck = 0; if (a.stuck > 2.2) { k.reset(tr); a.stuck = 0; }
}
