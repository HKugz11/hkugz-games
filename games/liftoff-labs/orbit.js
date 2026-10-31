// Orbit maths (pure, no rendering): Kepler propagation with universal variables, orbital elements, prediction points.
import { V } from './vec.js?v=1';

const TAU = Math.PI * 2;

function stumpC(z) {
  if (z > 1e-6) return (1 - Math.cos(Math.sqrt(z))) / z;
  if (z < -1e-6) return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
  return 0.5 - z / 24 + z * z / 720;
}
function stumpS(z) {
  if (z > 1e-6) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); }
  if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); }
  return 1 / 6 - z / 120 + z * z / 5040;
}

// Move a state (r, v) forward (or backward) by dt seconds around a body with gravitational parameter mu.
export function propagate(mu, r0, v0, dt) {
  if (dt === 0) return { r: r0.slice(), v: v0.slice() };
  const r0n = V.len(r0), v0n2 = V.dot(v0, v0);
  const alpha = 2 / r0n - v0n2 / mu;
  if (alpha > 1e-14) {                                   // ellipse: skip whole revolutions so the maths stays accurate
    const a = 1 / alpha, period = TAU * Math.sqrt(a * a * a / mu);
    dt = dt % period;
    if (dt === 0) return { r: r0.slice(), v: v0.slice() };
  }
  const sm = Math.sqrt(mu), vr0 = V.dot(r0, v0) / r0n, sg = dt < 0 ? -1 : 1;
  let chi = sg * Math.max(sm * Math.abs(alpha) * Math.abs(dt), 1e-3 * sm * Math.abs(dt) / r0n);
  let z = 0, C = 0.5, S = 1 / 6;
  for (let i = 0; i < 100; i++) {
    z = alpha * chi * chi; C = stumpC(z); S = stumpS(z);
    const F = (r0n * vr0 / sm) * chi * chi * C + (1 - alpha * r0n) * chi * chi * chi * S + r0n * chi - sm * dt;
    const dF = (r0n * vr0 / sm) * chi * (1 - z * S) + (1 - alpha * r0n) * chi * chi * C + r0n;
    if (!isFinite(F) || !isFinite(dF) || dF === 0) break;
    const d = F / dF;
    chi -= d;
    if (Math.abs(d) < 1e-10 * Math.max(1, Math.abs(chi))) break;
  }
  z = alpha * chi * chi; C = stumpC(z); S = stumpS(z);
  const f = 1 - chi * chi / r0n * C, g = dt - chi * chi * chi / sm * S;
  const r = V.add(V.mul(r0, f), V.mul(v0, g)), rn = V.len(r);
  const fd = sm / (rn * r0n) * (z * S - 1) * chi, gd = 1 - chi * chi / rn * C;
  return { r, v: V.add(V.mul(r0, fd), V.mul(v0, gd)) };
}

// Orbital elements in a form that never breaks for circular or flat orbits: P points to periapsis, Q is 90 degrees ahead of it.
export function elements(mu, r, v) {
  const rn = V.len(r), v2 = V.dot(v, v);
  const h = V.cross(r, v), hn = V.len(h);
  const hh = hn > 1e-12 ? V.mul(h, 1 / hn) : [0, 1, 0];
  const rv = V.dot(r, v);
  const ev = V.mul(V.sub(V.mul(r, v2 - mu / rn), V.mul(v, rv)), 1 / mu);
  const e = V.len(ev);
  let P = e > 1e-9 ? V.mul(ev, 1 / e) : V.mul(r, 1 / rn);
  const Qv = V.cross(hh, P);
  const p = hn * hn / mu;
  const energy = v2 / 2 - mu / rn;
  const nu = Math.atan2(V.dot(r, Qv), V.dot(r, P));
  const el = { mu, e, p, h: hh, hn, P, Q: Qv, nu, energy, r: rn, rv, incl: Math.acos(Math.max(-1, Math.min(1, hh[1]))) };
  if (energy < 0) {                                         // bound: stays around the planet (straight up-and-down shots count too)
    const a = -mu / (2 * energy), ee = Math.min(e, 1);
    el.a = a; el.ra = a * (1 + ee); el.rp = a * (1 - ee); el.b = a * Math.sqrt(Math.max(0, 1 - ee * ee));
    el.n = Math.sqrt(mu / (a * a * a)); el.period = TAU / el.n;
    const E = 2 * Math.atan2(Math.sqrt(Math.max(0, 1 - ee)) * Math.sin(nu / 2), Math.sqrt(1 + ee) * Math.cos(nu / 2));
    el.E = E; el.M = E - ee * Math.sin(E);
    el.bound = true;
  } else {
    el.rp = p / (1 + e);
    el.a = e === 1 ? Infinity : p / (1 - e * e); el.ra = Infinity; el.period = Infinity; el.bound = false;
    el.n = Math.sqrt(mu / Math.abs(el.a * el.a * el.a)) || 0;
    const th = Math.atanh(Math.max(-0.999999, Math.min(0.999999, Math.sqrt(Math.max(0, (e - 1) / (e + 1))) * Math.tan(nu / 2))));
    el.E = 2 * th; el.M = e * Math.sinh(el.E) - el.E;
  }
  return el;
}

const wrap = (x) => { x = x % TAU; return x < 0 ? x + TAU : x; };

// Seconds until the ship is next at periapsis / apoapsis (ellipse). Hyperbolas only have a periapsis (negative once passed).
export function timeToPeriapsis(el) {
  if (el.bound) return (TAU - wrap(el.M)) / el.n;
  return -el.M / el.n;
}
export function timeToApoapsis(el) {
  if (!el.bound) return Infinity;
  return wrap(Math.PI - el.M) / el.n;
}

// Seconds until the ship reaches true anomaly nuT (going forward in its orbit); null if never.
export function timeToTrueAnomaly(el, nuT) {
  const e = el.e;
  if (el.bound) {
    const ET = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nuT / 2), Math.sqrt(1 + e) * Math.cos(nuT / 2));
    const MT = ET - e * Math.sin(ET);
    return wrap(MT - el.M) / el.n;
  }
  const numax = Math.acos(-1 / e);
  let n = nuT; while (n > Math.PI) n -= TAU; while (n < -Math.PI) n += TAU;
  if (Math.abs(n) >= numax) return null;
  const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(n / 2));
  const MT = e * Math.sinh(H) - H;
  const t = (MT - el.M) / el.n;
  return t >= 0 ? t : null;
}

// True anomaly where the orbit crosses radius rr on its way down (the entry / impact point), or null.
export function descendingNuAtRadius(el, rr) {
  if (el.e < 1e-9) return null;
  const c = (el.p / rr - 1) / el.e;
  if (c > 1 || c < -1) return null;
  return -Math.acos(c);                                       // negative nu = after apoapsis, heading down
}
// Same on the way up
export function ascendingNuAtRadius(el, rr) {
  if (el.e < 1e-9) return null;
  const c = (el.p / rr - 1) / el.e;
  if (c > 1 || c < -1) return null;
  return Math.acos(c);
}

// Position (relative to the body) at true anomaly nu
export function positionAtNu(el, nu) {
  const r = el.p / (1 + el.e * Math.cos(nu));
  return V.add(V.mul(el.P, r * Math.cos(nu)), V.mul(el.Q, r * Math.sin(nu)));
}

// Points along the orbit for drawing. Starts at nu0 and goes forward; stops at maxR for open orbits and at `stopR` (impact) if given.
export function orbitPoints(el, n, maxR, nuStart) {
  const pts = [];
  if (el.bound) {
    // sample by eccentric anomaly: even spacing along the curve
    const E0 = el.E;
    for (let i = 0; i <= n; i++) {
      const E = E0 + TAU * i / n;
      pts.push(V.add(V.mul(el.P, el.a * (Math.cos(E) - el.e)), V.mul(el.Q, el.b * Math.sin(E))));
    }
  } else {
    const numax = Math.acos(Math.max(-1, Math.min(1, (el.p / maxR - 1) / el.e)));
    const lim = Math.min(numax, Math.acos(-1 / el.e) - 0.02);
    const start = nuStart === undefined ? el.nu : nuStart;
    const s = Math.max(-lim, Math.min(lim, start));
    for (let i = 0; i <= n; i++) pts.push(positionAtNu(el, s + (lim - s) * i / n));
  }
  return pts;
}

// Speed of a circular orbit and escape speed at radius r
export const circularSpeed = (mu, r) => Math.sqrt(mu / r);
export const escapeSpeed = (mu, r) => Math.sqrt(2 * mu / r);
