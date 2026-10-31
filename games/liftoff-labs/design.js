// A rocket design is a list of parts hanging off each other like a tree. This file turns that list into positions, stages and edits.
// part: {t: part id, p: parent index (-1 for the first part), n: 'b' below the parent | 't' above it | 's' on its side, s: 'top'|'mid'|'bot' (side parts), a: angle in degrees (side parts), g: group id (symmetry copies), st: stage override}
import { PARTS, radialExtent, isEngine, isDecoupler, isChute, isLeg } from './data.js?v=2';

export const newDesign = (name = 'My Rocket') => ({ name, v: 1, parts: [], gnext: 1 });
export const cloneDesign = (d) => JSON.parse(JSON.stringify(d));
const DEG = Math.PI / 180;

// Where every part sits, in metres, with the first part at the origin. y is up.
export function layout(design) {
  const out = [];
  design.parts.forEach((q, i) => {
    const def = PARTS[q.t];
    const L = { i, def, q, pos: [0, 0, 0], rotY: 0, ang: q.a || 0, parent: q.p, kids: [], side: q.n === 's' };
    out.push(L);
    if (q.p < 0) return;
    const P = out[q.p];
    P.kids.push(i);
    if (q.n === 'b') { L.pos = [P.pos[0], P.pos[1] - P.def.h / 2 - def.h / 2, P.pos[2]]; L.rotY = P.rotY; L.ang = P.ang; }
    else if (q.n === 't') { L.pos = [P.pos[0], P.pos[1] + P.def.h / 2 + def.h / 2, P.pos[2]]; L.rotY = P.rotY; L.ang = P.ang; }
    else {
      const a = (q.a || 0) * DEG, d = radialExtent(P.def) + radialExtent(def);
      const y = q.s === 'top' ? P.pos[1] + P.def.h / 2 - def.h / 2 : q.s === 'bot' ? P.pos[1] - P.def.h / 2 + def.h / 2 : P.pos[1];
      L.pos = [P.pos[0] + Math.cos(a) * d, y, P.pos[2] + Math.sin(a) * d];
      L.rotY = -a;
    }
  });
  return out;
}

// Can `partId` go on `parent` at `node`? Returns '' when fine, otherwise a short reason.
export function whyNot(design, parent, node, partId) {
  const def = PARTS[partId];
  if (!def) return 'Unknown part';
  if (parent < 0) return design.parts.length ? 'The rocket already has a first part' : (def.cat === 'pod' ? '' : 'Start with a pilot first!');
  const P = design.parts[parent], pd = PARTS[P.t];
  if (node === 'b') {
    if (pd.bottom === false) return 'Nothing goes under that';
    if (pd.bottomOnly && def.cat !== pd.bottomOnly) return 'Only a stage ring goes under that';
    if (def.top === false || def.radialOnly) return 'That part has no top to attach';
    if (P.n === 't' || design.parts.some((x) => x.p === parent && x.n === 'b')) return 'That spot is taken';
  } else if (node === 't') {
    if (pd.top === false) return 'Nothing goes on top of that';
    if (def.bottom === false || def.radialOnly) return 'That part has no bottom to attach';
    if (P.n === 'b' || design.parts.some((x) => x.p === parent && x.n === 't')) return 'That spot is taken';
  } else {
    if (!def.radial) return 'That part is not made for the side';
    if (pd.side === false) return 'Nothing can bolt to the side of that';
  }
  return '';
}

// Add a part (with symmetry). Returns {design, added: [indices]} or {err}
// A booster stuck on the side comes with its own little clip, so it lets go on the next Space press without any extra work.
export function addPart(design, parent, node, slot, partId, sym = 1, baseAngle = 0) {
  const err = whyNot(design, parent, node, partId);
  if (err) return { err };
  const d = cloneDesign(design), added = [], def = PARTS[partId];
  const mk = (p, extra) => { d.parts.push(Object.assign({ t: partId, p, n: node }, extra)); added.push(d.parts.length - 1); };
  const needsClip = (p) => node === 's' && def.cat === 'srb' && PARTS[d.parts[p].t].cat !== 'decoupler';
  const mkSide = (p, sl, ang, g, gc) => {
    if (!needsClip(p)) { mk(p, { s: sl, a: ang, g }); return; }
    d.parts.push({ t: 'dc_rad', p, n: 's', s: sl, a: ang, g: gc, auto: true }); added.push(d.parts.length - 1);
    d.parts.push({ t: partId, p: d.parts.length - 1, n: 's', s: 'mid', a: ang, g }); added.push(d.parts.length - 1);
  };
  if (parent < 0) { d.parts.push({ t: partId, p: -1 }); return { design: d, added: [0] }; }
  const P = d.parts[parent];
  const members = P.g ? d.parts.map((x, i) => (x.g === P.g && x.t === P.t ? i : -1)).filter((i) => i >= 0) : [parent];
  const g = d.gnext++, gc = d.gnext++;
  if (members.length > 1) {
    for (const m of members) { if (node === 's') mkSide(m, slot, d.parts[m].a || 0, g, gc); else mk(m, { g }); }
  } else if (node === 's') {
    const parentIsSide = P.n === 's';
    if (parentIsSide) mk(parent, { s: slot, a: P.a || 0, g: sym > 1 ? g : undefined });
    else for (let k = 0; k < sym; k++) mkSide(parent, slot, (baseAngle + (360 / sym) * k) % 360, sym > 1 ? g : undefined, sym > 1 ? gc : undefined);
  } else mk(parent, {});
  // a single copy needs no group tag
  if (sym <= 1 && members.length <= 1) for (const i of added) delete d.parts[i].g;
  return { design: d, added };
}

// Remove a part, everything attached to it, and any symmetry copies of it (and clips that are left holding nothing).
export function removePart(design, idx) {
  const n = design.parts.length, kill = new Set();
  const mark = (i) => { if (kill.has(i)) return; kill.add(i); design.parts.forEach((x, j) => { if (x.p === i) mark(j); }); };
  const g = design.parts[idx].g, t = design.parts[idx].t;
  mark(idx);
  if (g) design.parts.forEach((x, j) => { if (x.g === g && x.t === t) mark(j); });
  for (let again = true; again;) {                         // an automatic clip with nothing left on it goes too
    again = false;
    design.parts.forEach((x, j) => { if (x.auto && !kill.has(j) && design.parts.some((y) => y.p === j) && design.parts.filter((y) => y.p === j).every((y, k) => kill.has(design.parts.indexOf(y)))) { mark(j); again = true; } });
  }
  const map = new Array(n).fill(-1);
  let k = 0;
  for (let i = 0; i < n; i++) if (!kill.has(i)) map[i] = k++;
  const out = cloneDesign(design);
  out.parts = design.parts.filter((x, i) => !kill.has(i)).map((x) => { const y = Object.assign({}, x); y.p = x.p < 0 ? -1 : map[x.p]; return y; });
  return out;
}

// ------------------------------------------------------------------ segments and stages
// Fuel only flows inside one segment. Stage rings split segments: everything on the far side of a ring is a new segment.
export function segments(lay) {
  const seg = new Array(lay.length).fill(0), parent = [-1];
  let count = 1;
  lay.forEach((L, i) => {
    if (L.parent < 0) return;
    const P = lay[L.parent];
    if (isDecoupler(P.def)) { seg[i] = count++; parent.push(seg[L.parent]); }
    else seg[i] = seg[L.parent];
  });
  return { seg, count, parent };
}

// Auto staging. Returns an array stage[i] (or -1 for parts that are never staged). Stage 0 happens at the first press of Space.
export function autoStages(lay) {
  const n = lay.length, stage = new Array(n).fill(-1);
  const anc = (i) => { const out = []; for (let p = lay[i].parent; p >= 0; p = lay[p].parent) out.push(p); return out; };
  const decs = [];
  lay.forEach((L, i) => { if (isDecoupler(L.def)) decs.push(i); });
  const depth = {};
  decs.forEach((i) => { depth[i] = anc(i).filter((a) => isDecoupler(lay[a].def)).length; });
  const maxDepth = decs.length ? Math.max(...decs.map((i) => depth[i])) : 0;
  decs.forEach((i) => { stage[i] = maxDepth - depth[i] + 1; });
  lay.forEach((L, i) => {
    if (!isEngine(L.def)) return;
    // a stage ring under this engine (anywhere below it in the stack)? then it lights up when that ring above-it fires
    let below = -1;
    const dive = (j) => { for (const k of lay[j].kids) { if (lay[k].side) continue; if (isDecoupler(lay[k].def)) { if (below < 0) below = k; } else dive(k); } };
    dive(i);
    if (below >= 0) { stage[i] = stage[below]; return; }
    const ad = anc(i).find((a) => isDecoupler(lay[a].def));
    stage[i] = ad !== undefined ? Math.max(0, stage[ad] - 1) : 0;
  });
  const top = Math.max(0, ...stage);
  lay.forEach((L, i) => { if (isChute(L.def)) stage[i] = top + 1; });
  return stage;
}

// Apply any manual stage numbers on top of the automatic ones
export function stagesOf(design, lay) {
  const st = autoStages(lay);
  design.parts.forEach((q, i) => { if (q.st !== undefined && q.st !== null && st[i] >= 0) st[i] = q.st; });
  return st;
}

export function stageGroups(design, lay) {
  const st = stagesOf(design, lay), groups = {};
  st.forEach((s, i) => { if (s >= 0) (groups[s] = groups[s] || []).push(i); });
  return Object.keys(groups).map(Number).sort((a, b) => a - b).map((s) => ({ stage: s, parts: groups[s] }));
}

export function partCount(design) { return design.parts.length; }
export function costOf(design) { return design.parts.reduce((s, q) => s + (q.auto ? 0 : PARTS[q.t].price), 0); }
export const usesPart = (design, id) => design.parts.some((q) => q.t === id);
export function missingParts(design, unlocked) { const m = new Set(); design.parts.forEach((q) => { if (!q.auto && !unlocked.has(q.t)) m.add(q.t); }); return [...m]; }   // the clips that come with boosters are free
export const hasLegs = (design) => design.parts.some((q) => isLeg(PARTS[q.t]));

// Is this saved design safe to open? (old saves, hand-edited save codes...)
export function validDesign(d) {
  if (!d || !Array.isArray(d.parts) || d.parts.length > 200) return false;
  for (let i = 0; i < d.parts.length; i++) {
    const q = d.parts[i];
    if (!q || !PARTS[q.t] || !(q.p === -1 ? i === 0 : Number.isInteger(q.p) && q.p >= 0 && q.p < i)) return false;
    if (i > 0 && !['b', 't', 's'].includes(q.n)) return false;
    if (q.a !== undefined && !Number.isFinite(q.a)) return false;
  }
  return true;
}

// ------------------------------------------------------------------ "just add it": where a part goes when you click it
// Stack parts go under the pilot but above the engine, hats and umbrellas go on top, boosters / fins / legs go around the side of the lowest tank.
function insertBefore(design, idx, part) {            // put a new part in the list at idx (everything after it moves along)
  const out = cloneDesign(design);
  for (const q of out.parts) if (q.p >= idx) q.p++;
  out.parts.splice(idx, 0, part);
  return out;
}
export function autoPlace(design, partId, copies = 1, angle = 0) {
  const def = PARTS[partId];
  if (!def) return { err: 'Unknown part' };
  if (!design.parts.length) return addPart(design, -1, 'b', null, partId);
  if (def.cat === 'pod') return { err: 'You already have a pilot!' };
  const P = design.parts;
  const chain = [0];                                                         // the main stack from the pilot down
  for (;;) { const nx = P.findIndex((q) => q.p === chain[chain.length - 1] && q.n === 'b'); if (nx < 0) break; chain.push(nx); }
  const top = (() => { let t = 0; for (;;) { const nx = P.findIndex((q) => q.p === t && q.n === 't'); if (nx < 0) return t; t = nx; } })();
  const lowest = chain[chain.length - 1], lowestDef = PARTS[P[lowest].t];
  const tanks = chain.filter((i) => PARTS[P[i].t].cat === 'tank'), sideHost = tanks.length ? tanks[tanks.length - 1] : chain.find((i) => PARTS[P[i].t].cat !== 'engine') ?? 0;
  const side = (host, slot) => addPart(design, host, 's', slot, partId, copies, angle);
  const isStackPart = def.top !== false && def.bottom !== false && !def.radialOnly && !def.radial || (def.cat === 'nose' && def.top !== false) || def.cat === 'decoupler' || def.cat === 'wheel';
  // hats, umbrellas and flags
  if ((def.cat === 'nose' && def.top === false) || def.chuteArea || def.cat === 'misc') {
    const r = addPart(design, top, 't', null, partId);
    if (!r.err) return r;
    if (def.radial) { const s = addPart(design, 0, 's', 'top', partId, 1, angle); if (!s.err) return s; }
    return { err: 'The top is taken. Take the hat off first, or drag this to another spot.' };
  }
  // fins, legs, boosters, pickles, side engines
  if (def.cat === 'fin' || def.cat === 'leg') return side(sideHost, 'bot');
  if (def.cat === 'srb' || def.shape === 'pickle' || (def.cat === 'engine' && def.radial)) return side(sideHost, 'mid');
  // an engine goes at the very bottom
  if (def.cat === 'engine') {
    if (lowestDef.bottom === false || lowestDef.bottomOnly) return { err: 'There is already an engine at the bottom.' };
    return addPart(design, lowest, 'b', null, partId);
  }
  // fuel, rings, wheels, cones: under everything but above the engine
  if (isStackPart) {
    const endsWithEngine = lowestDef.bottom === false || (lowestDef.bottomOnly && lowestDef.cat !== 'decoupler');
    if (!endsWithEngine) return addPart(design, lowest, 'b', null, partId);
    const e = lowest, host = P[e].p;
    if (host < 0 || P[e].g) return { err: 'Take the engine off first, or drag this to another spot.' };
    const probe = { ...design, parts: design.parts.map((q, i) => (i === e ? { ...q, n: 'x' } : q)) };      // pretend the spot is free so the part can be checked
    const err = whyNot(probe, host, 'b', partId);
    if (err) return { err };
    const out = insertBefore(design, e, { t: partId, p: host, n: 'b' });
    out.parts[e + 1].p = e;                                                  // the engine now hangs under the new part
    return { design: out, added: [e] };
  }
  return { err: 'That does not fit anywhere right now. Try dragging it.' };
}
