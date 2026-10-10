// PUTT PARTY - the computer golfers: they try lots of shots in the physics simulation, pick the best one, and then miss a little (less on Hard).
import { simulate, CUP_R } from './golf.js?v=8';

export const DIFFS = { easy: { name: 'Easy', skill: .12, top: 6, maxB: 1 }, normal: { name: 'Normal', skill: .36, top: 3, maxB: 2 }, hard: { name: 'Hard', skill: .62, top: 1, maxB: 4 } };
const hyp = Math.hypot, gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / .5;
// how far is a spot from the cup along the way the ball has to travel (so a shot around a corner scores better than one stuck against the wall)
export function routeRemain(route, x, z) {
  let best = 1e9, remain = 0, total = 0; const len = [];
  for (let i = 1; i < route.length; i++) { len.push(hyp(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1])); total += len[i - 1]; }
  let before = 0;
  for (let i = 1; i < route.length; i++) {
    const ax = route[i - 1][0], az = route[i - 1][1], bx = route[i][0], bz = route[i][1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t, pz = az + dz * t, d = hyp(x - px, z - pz); if (d < best - .01) { best = d; remain = total - (before + len[i - 1] * t); } before += len[i - 1];
  }
  return remain + best * 1.2;
}
export function planShot(C, b, t, diff = 'normal', fast = false) {
  const D = DIFFS[diff], route = C.def.route, cands = [], NA = fast ? 36 : 60, PW = fast ? [.25, .42, .62, .82, 1] : [.2, .3, .42, .56, .72, .88, 1];
  for (let k = 0; k < NA; k++) {
    const a = (k / NA) * Math.PI * 2 - Math.PI;
    for (const p of PW) {
      const r = simulate(C, b.x, b.z, a, p, t); let score;
      if (r.state === 'sunk') score = -1000 + r.bounces * 1.5;
      else if (r.state === 'water') score = 500; else score = routeRemain(route, r.x, r.z) + r.bounces * .12;
      if (r.bounces > D.maxB) score += 400; cands.push({ a, p, score, sunk: r.state === 'sunk' });
    }
  }
  cands.sort((u, v) => u.score - v.score); const pick = cands[Math.min(cands.length - 1, Math.floor(Math.random() * D.top * (D.top > 1 ? 1 : 0)))] || cands[0];
  // refine around the pick, then add the human error
  let best = pick; for (let da = -3; da <= 3; da += 1.5) for (const dp of [-.05, 0, .05]) { const a = pick.a + da * Math.PI / 180, p = Math.max(.12, Math.min(1, pick.p + dp)), r = simulate(C, b.x, b.z, a, p, t); let score = r.state === 'sunk' ? -1000 + r.bounces * 1.5 : r.state === 'water' ? 500 : routeRemain(route, r.x, r.z) + r.bounces * .12; if (r.bounces > D.maxB) score += 400; if (score < best.score) best = { a, p, score }; }
  const err = 1 - D.skill, slip = Math.random() < err * .28;   // now and then a golfer just mishits it
  return { angle: best.a + gauss() * err * 9 * Math.PI / 180 + (slip ? (Math.random() - .5) * .5 : 0), power: Math.max(.1, Math.min(1, best.p * (1 + gauss() * err * .2) * (slip ? .6 + Math.random() * .8 : 1))), score: best.score };
}
