// WOBBLE DASH - the computer racers: they follow the course waypoints, hop gaps, ride ferries, balance on beams, jump spinning bars,
// dive at the finish and, like everybody else, get knocked around by the obstacles.
import { world } from './physics.js?v=15';
import { clamp, rnd } from './core.js?v=15';

export const DIFFS = {
  easy: { name: 'Easy', pace: [.8, .98], skill: .5 },
  normal: { name: 'Normal', pace: [.9, 1.12], skill: .78 },
  hard: { name: 'Hard', pace: [1.0, 1.2], skill: .95 },
};
export const makeAI = (diff) => { const D = DIFFS[diff]; return { D, pace: rnd(D.pace[0], D.pace[1]), skill: clamp(D.skill * rnd(.85, 1.05), .3, 1), bias: rnd(-1.6, 1.6), wi: 0, hold: 0, jumpCD: 0, wait: 0, stuck: 0, side: 0, sideT: 0, diveDone: false, ferryT: 0, ferryX: 0 }; };

function groundTop(x, y, z) { const r = world.raycast(x, y + .7, z, 0, -1, 0, 4.4); return r.box ? { y: y + .7 - r.t, box: r.box } : null; }

export function aiStep(b, C, dt) {
  const a = b.ai, inp = b.inp, spec = C.spec, wps = spec.wps; inp.mx = inp.mz = 0; inp.sprint = false; inp.jump = a.hold > 0; a.hold = Math.max(0, a.hold - dt); a.jumpCD = Math.max(0, a.jumpCD - dt);
  if (!b.alive || b.respT > 0) return;
  const u = -b.pos.z, v = b.pos.x, sp = Math.hypot(b.vel.x, b.vel.z); let wi = a.wi; if (wi > 0 && wps[wi - 1].u > u + 2) wi = Math.max(0, wi - 3);
  while (wi < wps.length - 1 && wps[wi].u < u + 1.5 + sp * .1) wi++; a.wi = wi; const w = wps[wi];
  const narrow = w.flag === 'beam' || w.flag === 'pad' || w.flag === 'hop'; let tv = clamp(w.v + (narrow || w.u - u < 6 ? 0 : a.bias), -7.2, 7.2); if (a.sideT > 0) { a.sideT -= dt; tv = clamp(v + a.side * 3, -7.2, 7.2); }
  const grounded = b.onGround && b.stun <= 0 && b.prone <= 0, jump = (hold = .3) => { if (grounded && a.jumpCD <= 0) { inp.jumpPressed = true; inp.jump = true; a.hold = hold; a.jumpCD = .55; return true; } return false; };
  const onMover = !!(b.ground && b.ground.kind === 'mover'), onBeam = !!(b.ground && b.ground.it && b.ground.it.beam);
  let wait = false, slow = a.ferryT > 0 ? .5 : 1, fast = b.bounceT > 0 || w.flag === 'pad';
  if (onBeam) { tv = b.ground.it.x; slow = .72; }            // balance on the middle of the beam
  if (a.ferryT > 0) { a.ferryT -= dt; tv = a.ferryX; }          // stay over the ferry's lane while hopping onto it
  let lineUp = false;
  if (!onBeam) for (let k = wi; k < wps.length && k < wi + 4; k++) { const q = wps[k]; if (q.flag === 'beam') { if (q.u - u < 26) { tv = q.v; lineUp = Math.abs(q.v - v) > .6; } break; } }   // line up with the beam I am going to cross, well before the jump
  const now = C.t || 0, onBlink = !!(b.ground && b.ground.it && b.ground.it.blink); let ghostOK = true;
  if (w.tiles) {                                                  // ghost tiles: aim for the tile that will still be solid when we get there
    const eta = Math.max(.15, (w.u - u) / Math.max(sp, 6)); let pick = w.tiles[0], bs = -1e9;
    for (const it of w.tiles) { const sc = Math.min(C.blinkRemain(it, now + eta + .1), 3) - Math.abs(it.x - v) * .08; if (sc > bs) { bs = sc; pick = it; } }
    tv = clamp(pick.x, -7.2, 7.2); ghostOK = C.blinkRemain(pick, now + .55) > .5;
  }
  if (onBlink && C.blinkRemain(b.ground.it, now) < .9) { fast = true; ghostOK = true; }   // my own tile is about to vanish: go
  const fu = lineUp ? Math.max(3, Math.min(6.5, w.u - u)) : Math.max(onBeam ? 5 : 3, w.u - u); let dx = tv - v, dz = -fu; const m = Math.hypot(dx, dz); dx /= m; dz /= m;
  if ((grounded && !onBeam) || onMover) {
    if (onMover) {                                                // riding a ferry: stand still until the far platform is close, then run to the edge and jump
      let near = false; for (const d of [3, 4.5, 6, 7.5]) { const g = groundTop(b.pos.x + dx * d, b.pos.y, b.pos.z + dz * d); if (g && g.box !== b.ground && g.box.kind !== 'mover' && Math.abs(g.y - b.pos.y) < 1.3) { near = true; break; } }
      if (!near) wait = true; else fast = true;
    }
    if (!wait) {
      let g1 = groundTop(b.pos.x + dx * 1.15, b.pos.y, b.pos.z + dz * 1.15);
      if (!g1 && (w.tiles || onBlink)) g1 = groundTop(b.pos.x + dx * 1.15 - .45, b.pos.y, b.pos.z + dz * 1.15) || groundTop(b.pos.x + dx * 1.15 + .45, b.pos.y, b.pos.z + dz * 1.15);   // ghost tiles have thin gaps between them: they are not an edge
      if (!g1) {                                                  // an edge: wait for a ferry to swing by, or jump the gap
        let best = null, bl = 1e9; if (!onMover) for (const f of C.ferries) { const bx = f.box; if (Math.abs(bx.maxY - b.pos.y) > 1.4) continue; const dzf = b.pos.z - bx.maxZ; if (dzf < -2 || dzf > 16) continue; const l = Math.abs((bx.minX + bx.maxX) / 2 - v); if (l < bl) { bl = l; best = f; } }
        if (best) { const bx = best.box, cx = (bx.minX + bx.maxX) / 2, gap = b.pos.z - bx.maxZ; if (Math.abs(cx - v) > 1.6) { dx = Math.sign(cx - v) * .6; dz = 0; a.ferryX = cx; } else if (gap < 2.8 && gap > -.5 && bx.dz > .004) { if (jump(.45)) { a.ferryX = cx; a.ferryT = 1.1; } } else { wait = true; a.wait += dt; if (a.wait > 12) jump(.45); } }
        else if (!ghostOK) wait = true;                           // the ghost tile I want to land on is not solid yet
        else if (Math.random() < .4 + a.skill * .55) { jump(.42 + a.skill * .1); fast = true; } else { dx *= .4; }
      } else if (g1.y > b.pos.y + .55) jump(.4);                 // something to climb
    }
  }
  if (grounded && !onMover && !wait) {
    for (const s of C.rolls) {                                    // a rolling log or snowball is about to cross my path: jump it
      const it = s.it, dz = b.pos.z - it.z; if (dz < .3 || dz > 3.2 + sp * .12) continue; const rx = C.rollX(it, now + dz / Math.max(sp, 5));
      if (rx !== null && Math.abs(rx - v) < it.rad + 1.0 && jump(it.kind === 'ball' ? .55 : .42)) fast = true;
    }
    for (const s of C.jets) {                                     // fire jets: wait at the edge of the glow until the flame is done
      const it = s.it, dz = b.pos.z - it.z; if (dz < it.r + .6 || dz > it.r + 4.5 || Math.abs(it.x - v) > it.r + 1.5) continue; const ttc = (dz - it.r - .3) / Math.max(sp, 4);
      if (C.jetBetween(it, now + ttc - .1, now + ttc + .6)) { wait = true; break; }
    }
  }
  if (grounded && !onMover) for (const s of C.spins) { const it = s.it; if (it.kind !== 'bar') continue; const d = b.pos.z - it.c[2]; if (d > 1.0 && d < 4.2 && Math.abs(b.pos.y - (it.c[1] - .85)) < 1) { if (a.jumpCD <= 0 && Math.random() < .05 + a.skill * .12) jump(.38); } }
  if (!onMover) a.wait = 0;
  if (!a.diveDone && grounded && u > spec.finishU - 6 - a.skill * 2 && u < spec.finishU + 1) { inp.dive = true; a.diveDone = true; }
  if (!wait && sp < 1.2 && grounded && !onBeam) { a.stuck += dt; if (a.stuck > .8) { a.stuck = 0; a.side = Math.random() < .5 ? -1 : 1; a.sideT = .7; jump(.4); } } else a.stuck = Math.max(0, a.stuck - dt);
  if (wait) return;
  const onPads = b.bounceT > 0 || w.flag === 'pad'; let pace = onPads ? 1.0 : fast ? Math.max(a.pace, 1.14) : a.pace; pace *= slow; if ((spec.def.grav || 1) < 1 && w.flag === 'hop') pace = Math.min(pace, .98);   // low gravity: a sprinting jump flies right over a small rock
  if (pace > 1) { inp.sprint = true; inp.mz = -dz * (pace / 1.28); inp.mx = dx * (pace / 1.28); } else { inp.mz = -dz * pace; inp.mx = dx * pace; }
}
