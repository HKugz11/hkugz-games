// KART RUSH - the karts: arcade driving (grip, drifting with mini-turbos, boosts, jumps and tricks, spin-outs), the toon kart models with hats, and the items.
import { THREE, V3, scene, toon, clamp, lerp, rnd, angDiff, burst, ring, sfx, skid, W, QL, TAU, INK } from './core.js?v=3';
import { nearest, pointAt, SHOULDER, KERB } from './track.js?v=3';
import { RAINBOW } from './profile.js?v=3';

export const CLASSES = [
  { key: 'kart:balanced', id: 'balanced', name: 'Balanced', top: 44, acc: 1.0, turn: 1.0, drift: 1.0, mass: 1, trick: 1, desc: 'Good at everything.' },
  { key: 'kart:speedy', id: 'speedy', name: 'Speedy', top: 47, acc: .8, turn: .88, drift: .9, mass: 1, trick: .9, desc: 'Fastest on the straights, slower to get going.' },
  { key: 'kart:zippy', id: 'zippy', name: 'Zippy', top: 41, acc: 1.3, turn: 1.15, drift: 1.2, mass: .8, trick: 1, desc: 'Quick off corners with great drifts.' },
  { key: 'kart:heavy', id: 'heavy', name: 'Heavy', top: 45.5, acc: .7, turn: .82, drift: .85, mass: 1.7, trick: .8, need: { k: 'podiums', n: 5, txt: 'Finish on the podium 5 times' }, desc: 'A big bruiser. Shoves everyone around.' },
  { key: 'kart:trick', id: 'trick', name: 'Trickster', top: 42.5, acc: 1.1, turn: 1.05, drift: 1.05, mass: 1, trick: 1.7, need: { k: 'tricks', n: 15, txt: 'Do 15 jump tricks' }, desc: 'Huge boosts from jump tricks.' },
  { key: 'kart:proto', id: 'proto', name: 'Prototype', top: 50, acc: 1.4, turn: 1.18, drift: 1.3, mass: 1.1, trick: 1.5, need: { secret: true }, secret: true, desc: 'Not for sale.' },
];
export const ITEMS = {
  turbo: { name: 'TURBO', col: '#ffb02a' }, rocket: { name: 'ROCKET', col: '#ff4a4a' }, banana: { name: 'OIL SLICK', col: '#6a5cff' }, shield: { name: 'SHIELD', col: '#4aa8ff' }, zap: { name: 'ZAP', col: '#ffe14a' },
  star: { name: 'STAR', col: '#ffe14a' }, rocket3: { name: '3 ROCKETS', col: '#ff4a4a' }, seeker: { name: 'SEEKER', col: '#b04aff' }, mine: { name: 'BOMB', col: '#ff6a3a' }, turbo3: { name: '3 TURBOS', col: '#ffb02a' },
};
export const ITEM_KEYS = Object.keys(ITEMS);
const TIERS = [.8, 1.6, 2.5], TIER_BOOST = [.6, 1.1, 1.7], TIER_COL = [0x4aa8ff, 0xffa02a, 0xd44aff];
const dark = toon(0x2a2140), vcol = toon(0xffffff, { vertexColors: true }), gcol = new THREE.MeshBasicMaterial({ vertexColors: true }); dark.userData.shared = vcol.userData.shared = gcol.userData.shared = true;

// ---------------------------------------------------------------- the model
function merge(list) {
  const pos = [], nor = [], col = [];
  for (const [geo, color] of list) { const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.userData.shared = true; return out;
}
const T = (g, x, y, z) => g.translate(x, y, z);
const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// every kart type has its own shape: chassis size, hood, rear wing, wheels, and a few extra pieces (b = box, c = upright cylinder, s = sphere)
const SHAPES = {
  balanced: { w: 1.8, h: .5, len: 3.1, hood: [1.4, .36, 1.2, 1.15], wing: [2.0, .14, .6, 1.45, -1.55], post: .7, ws: 1, ww: 1, wx: 1.0, wz: 1.05, extra: [] },
  speedy: { w: 1.7, h: .45, len: 3.6, hood: [1.1, .3, 1.7, 1.55], wing: [2.3, .14, .7, 1.75, -1.75], post: .95, ws: .95, ww: .9, wx: .98, wz: 1.25, extra: [['b', .12, .5, 1.3, -.95, .9, -.5, 'body'], ['b', .12, .5, 1.3, .95, .9, -.5, 'body']] },
  zippy: { w: 1.7, h: .55, len: 2.7, hood: [1.3, .4, 1.0, 1.0], wing: [1.7, .14, .5, 1.35, -1.3], post: .6, ws: 1.15, ww: 1, wx: .98, wz: .92, extra: [['s', .5, 0, 1.0, 1.3, 'body']] },
  heavy: { w: 2.2, h: .65, len: 3.2, hood: [1.7, .45, 1.2, 1.2], wing: [2.3, .16, .7, 1.7, -1.55], post: .9, ws: 1.3, ww: 1.4, wx: 1.2, wz: 1.1, extra: [['c', .16, 1.1, -.75, 1.25, -1.75, 'trim'], ['c', .16, 1.1, .75, 1.25, -1.75, 'trim'], ['b', 1.4, .12, .12, 0, 1.75, -.55, 'trim']] },
  trick: { w: 1.8, h: .42, len: 3.2, hood: [1.5, .3, 1.3, 1.2], wing: [2.0, .12, .5, 1.3, -1.5], post: .5, ws: 1.05, ww: 1, wx: 1.02, wz: 1.08, extra: [['b', 2.5, .1, .6, 0, .5, 2.0, 'body'], ['b', .12, .95, .9, 0, 1.55, -1.6, 'body']] },
  proto: { w: 1.9, h: .42, len: 3.6, hood: [1.3, .3, 1.5, 1.4], wing: [2.4, .12, .7, 1.7, -1.8], post: .9, ws: 1.05, ww: 1.05, wx: 1.02, wz: 1.2, extra: [['b', .1, .12, 3.2, -.97, .75, 0, 'gold'], ['b', .1, .12, 3.2, .97, .75, 0, 'gold'], ['b', 1.3, .1, .5, 0, .68, 1.9, 'gold']] },
};
const GEO = {};
function geos(id) {
  if (GEO[id]) return GEO[id]; const sh = SHAPES[id] || SHAPES.balanced, G = GEO[id] = {}, [hw, hh, hd, hz] = sh.hood, [ww, wh, wd, wy, wz] = sh.wing, body = [[T(Bx(sh.w, sh.h, sh.len), 0, .62, 0), 0xffffff], [T(Bx(hw, hh, hd), 0, .85, hz), 0xffffff], [T(Bx(ww, wh, wd), 0, wy, wz), 0xffffff]], gold = [];
  const trim = [[T(Bx(.14, sh.post, .14), -.7, .75 + sh.post / 2, wz + .05), 0x2a2140], [T(Bx(.14, sh.post, .14), .7, .75 + sh.post / 2, wz + .05), 0x2a2140], [T(Bx(1.2, .2, .5), 0, .42, sh.len / 2 + .2), 0x2a2140], [T(Bx(.9, .45, .8), 0, .95, -.55), 0x2a2140],
    [T(new THREE.SphereGeometry(.4, 14, 10), 0, 1.58, -.55), 0xf4f0ff], [T(Bx(.5, .16, .2), 0, 1.6, -.2), 0x2a2140]];
  if (!sh.noAntenna) trim.push([T(new THREE.CylinderGeometry(.02, .02, .3, 6), 0, 2.05, -.55), 0x2a2140]);
  for (const e of sh.extra) { const t = e[0], list = e[e.length - 1] === 'body' ? body : e[e.length - 1] === 'gold' ? gold : trim; let g, col = list === body ? 0xffffff : list === gold ? 0xffc93a : 0x2a2140;
    if (t === 'b') g = T(Bx(e[1], e[2], e[3]), e[4], e[5], e[6]); else if (t === 'c') g = T(new THREE.CylinderGeometry(e[1], e[1], e[2], 8), e[3], e[4], e[5]); else g = T(new THREE.SphereGeometry(e[1], 10, 8), e[2], e[3], e[4]); list.push([g, col]); }
  G.body = merge(body); G.trim = merge(trim); if (gold.length) G.gold = merge(gold);
  G.hullBody = (() => { const g = G.body.clone(); const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * .06, p.getY(i) + n.getY(i) * .06, p.getZ(i) + n.getZ(i) * .06); g.userData.shared = true; return g; })();
  G.wheel = new THREE.CylinderGeometry(.46 * sh.ws, .46 * sh.ws, .42 * sh.ww, 14); G.wheel.rotateZ(Math.PI / 2); G.wheel.userData.shared = true;
  G.flame = new THREE.ConeGeometry(.35, 1.6, 8); G.flame.rotateX(-Math.PI / 2); G.flame.translate(0, 0, -.8); G.flame.userData.shared = true;
  G.blob = new THREE.CircleGeometry(1.5, 16); G.blob.userData.shared = true; G.bubble = new THREE.SphereGeometry(2.2, 18, 12); G.bubble.userData.shared = true; return G;
}
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa02a, transparent: true, opacity: .85 }), bubbleMat = new THREE.MeshBasicMaterial({ color: 0x6ac8ff, transparent: true, opacity: .28, depthWrite: false }), blobMat = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .35, depthWrite: false }), starMat2 = new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: .22, depthWrite: false });
for (const m of [flameMat, bubbleMat, blobMat, starMat2]) m.userData.shared = true;

// ---- hats (built around the driver's head; the origin is the middle of the head)
const HM = new Map(); const hm = c => { let m = HM.get(c); if (!m) { m = toon(c); m.userData.shared = true; HM.set(c, m); } return m; };
const hp = (g, geo, c, x, y, z, rot) => { const m = new THREE.Mesh(geo, hm(c)); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); g.add(m); return m; };
export function makeHat(id) {
  if (!id || id === 'none') return null; const g = new THREE.Group(); g.position.set(0, 1.58, -.55);
  if (id === 'cone') { hp(g, new THREE.ConeGeometry(.32, .75, 10), 0xff4fa8, 0, .72, 0); hp(g, new THREE.SphereGeometry(.1, 8, 6), 0xffd34e, 0, 1.12, 0); hp(g, new THREE.TorusGeometry(.27, .04, 6, 14), 0xffd34e, 0, .5, 0, [Math.PI / 2, 0, 0]); }
  else if (id === 'ears') { for (const sd of [-1, 1]) { hp(g, new THREE.ConeGeometry(.16, .36, 4), 0x2a2140, sd * .24, .52, 0, [0, 0, -sd * .25]); hp(g, new THREE.ConeGeometry(.09, .22, 4), 0xff8ad0, sd * .24, .5, .06, [0, 0, -sd * .25]); } }
  else if (id === 'prop') { hp(g, new THREE.CylinderGeometry(.3, .34, .16, 12), 0x4a6aff, 0, .42, 0); hp(g, new THREE.CylinderGeometry(.03, .03, .26, 6), 0xdddddd, 0, .6, 0); const bl = new THREE.Group(); bl.position.y = .74; for (const c of [0xff4a4a, 0xffd31a]) { const b = hp(bl, Bx(.95, .03, .15), c, 0, 0, 0); if (c === 0xffd31a) b.rotation.y = Math.PI / 2; } g.add(bl); g.userData.spin = bl; }
  else if (id === 'phones') { hp(g, new THREE.TorusGeometry(.44, .045, 6, 18, Math.PI), 0x2a2140, 0, .02, 0); for (const sd of [-1, 1]) { hp(g, new THREE.CylinderGeometry(.19, .19, .13, 12), 0xff4fa8, sd * .44, 0, 0, [0, 0, Math.PI / 2]); } }
  else if (id === 'tophat') { hp(g, new THREE.CylinderGeometry(.3, .3, .6, 12), 0x241c38, 0, .72, 0); hp(g, new THREE.CylinderGeometry(.52, .52, .06, 14), 0x241c38, 0, .4, 0); hp(g, new THREE.CylinderGeometry(.31, .31, .12, 12), 0xff4a4a, 0, .5, 0); }
  else if (id === 'wizard') { const c = hp(g, new THREE.ConeGeometry(.46, 1.05, 10), 0x5a2ad0, 0, .95, 0, [-.18, 0, 0]); hp(g, new THREE.CylinderGeometry(.62, .62, .05, 14), 0x4a1ab0, 0, .4, 0); hp(g, new THREE.SphereGeometry(.09, 8, 6), 0xffe14a, 0, 1.5, -.2); hp(g, new THREE.SphereGeometry(.06, 6, 5), 0xffe14a, .22, .85, .3); }
  else if (id === 'crown') { hp(g, new THREE.CylinderGeometry(.36, .32, .24, 8), 0xffc93a, 0, .5, 0); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; hp(g, new THREE.ConeGeometry(.08, .22, 4), 0xffc93a, Math.cos(a) * .32, .74, Math.sin(a) * .32); } hp(g, new THREE.SphereGeometry(.07, 6, 5), 0xff4a4a, 0, .52, .34); hp(g, new THREE.SphereGeometry(.07, 6, 5), 0x2ee6ff, .3, .52, -.16); }
  return g;
}
export function makeKartModel(color, clsId = 'balanced', hatId = 'none') {
  const G = geos(clsId), sh = SHAPES[clsId] || SHAPES.balanced, g = new THREE.Group(), mat = toon(color === RAINBOW ? 0xff4a4a : color), body = new THREE.Mesh(G.body, mat), trim = new THREE.Mesh(G.trim, vcol); body.castShadow = trim.castShadow = QL.shadow > 0; g.add(body, trim);
  if (G.gold) g.add(new THREE.Mesh(G.gold, gcol));
  if (QL.hull) g.add(new THREE.Mesh(G.hullBody, INK));
  const wheels = []; for (const [x, z, front] of [[-sh.wx, sh.wz, 1], [sh.wx, sh.wz, 1], [-sh.wx, -sh.wz, 0], [sh.wx, -sh.wz, 0]]) { const piv = new THREE.Group(); piv.position.set(x, .46 * sh.ws, z); const w = new THREE.Mesh(G.wheel, dark); piv.add(w); g.add(piv); wheels.push({ piv, w, front }); }
  const flame = new THREE.Mesh(G.flame, flameMat); flame.position.set(0, .8, -sh.len / 2 - .05); flame.visible = false; g.add(flame);
  const bubble = new THREE.Mesh(G.bubble, bubbleMat); bubble.position.y = 1.1; bubble.visible = false; g.add(bubble);
  const aura = new THREE.Mesh(G.bubble, starMat2); aura.position.y = 1.1; aura.scale.setScalar(.95); aura.visible = false; g.add(aura);
  const blob = new THREE.Mesh(G.blob, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = .05; g.add(blob);
  const hat = makeHat(hatId); if (hat) g.add(hat);
  return { g, mat, wheels, flame, bubble, aura, body, blob, hat, hatSpin: hat && hat.userData.spin };
}

// ---------------------------------------------------------------- a kart
let nextId = 0;
export class Kart {
  constructor(o) {
    this.id = nextId++; this.name = o.name; this.color = o.color; this.cls = o.cls || CLASSES[0]; this.isPlayer = !!o.isPlayer; this.ai = o.ai || null; this.cc = o.cc || 1; this.rainbow = o.color === RAINBOW;
    this.model = makeKartModel(this.color, this.cls.id, o.hat || 'none'); scene.add(this.model.g);
    this.p = new V3(); this.h = 0; this.vx = 0; this.vz = 0; this.vf = 0; this.y = 0; this.vy = 0; this.yawVis = 0; this.in = { thr: 0, brk: 0, steer: 0, drift: false, item: false, itemPressed: false };
    this.boostT = 0; this.drift = { on: false, dir: 0, t: 0, tier: 0 }; this.spinT = 0; this.slowT = 0; this.shield = 0; this.invul = 0; this.item = null; this.itemQty = 0; this.itemGet = 0; this.offroad = false; this.ice = false; this.onMud = false; this.hint = -1;
    this.dist = 0; this.prevS = 0; this.lap = 0; this.finished = false; this.finishT = 0; this.place = 1; this.s = 0; this.d = 0; this.wrong = 0; this.stuck = 0; this.bumpCD = 0; this.steerVis = 0; this.wheelRot = 0; this.top = 0; this.lapT = 0; this.bestLap = 0; this.lapTimes = []; this.points = 0; this.auto = false; this.stopped = false;
    this.netId = o.netId || 0; this.net = null; this.sup = 1; this.coins = 0; this.star = 0; this.air = false; this.airT = 0; this.tricked = false; this.trickA = 0; this.rampCD = 0; this.skidT = 0; this.tricks = 0; this.remote = !!o.remote;
  }
  place0(tr, s, lat) { const p = pointAt(tr, s, lat); this.p.set(p.x, p.y, p.z); this.y = p.y; this.h = Math.atan2(p.tx, p.tz); this.vx = this.vz = this.vf = 0; this.vy = 0; const q = nearest(tr, p.x, p.z, -1); this.hint = q.i; this.s = q.s; this.prevS = q.s; this.d = q.d; this.dist = s < 0 ? s : q.s; this.lap = Math.floor(this.dist / tr.length); this.boostT = this.spinT = this.slowT = this.shield = this.star = 0; this.drift.on = false; this.drift.t = 0; this.yawVis = this.h; }
  reset(tr) { const q = nearest(tr, this.p.x, this.p.z, -1), p = pointAt(tr, q.s, 0); this.p.set(p.x, p.y, p.z); this.y = p.y; this.vy = 0; this.air = false; this.tricked = false; this.h = Math.atan2(p.tx, p.tz); this.vx = this.vz = this.vf = 0; this.hint = q.i; this.spinT = 0; this.drift.on = false; this.invul = 2; this.stuck = 0; this.yawVis = this.h; }
  get progress() { return this.dist; }
  topSpeed() {
    let v = this.cls.top * (this.top || 1) * this.cc * this.sup * (1 + this.coins * .005); if (this.boostT > 0 && this.sup <= 1) v *= 1.3; if (this.star > 0) v *= 1.14; if (this.offroad) v *= .5; if (this.onMud) v *= .66; if (this.slowT > 0) v *= .58; return v;
  }
  giveItem(key) { this.item = key; this.itemQty = key === 'turbo3' ? 3 : 0; }
  launch(vy) { this.vy = vy; this.y += .25; this.air = true; this.airT = 0; this.tricked = false; this.trickA = 0; this.rampCD = 1.5; this.endDrift(true); if (this.isPlayer) sfx('jump'); burst(new V3(this.p.x, this.y + .3, this.p.z), 0xffffff, 8, 6, .16, .4, 10, 2); }
  land(t) {
    if (this.tricked && t > .25) { this.giveBoost(.6 + .5 * this.cls.trick, 2); this.tricks++; burst(new V3(this.p.x, this.y + .6, this.p.z), 0x6affe0, 16, 8, .2, .6, 6, 2); if (this.isPlayer) { sfx('trick'); if (this.onTrick) this.onTrick(); } }
    else if (t > .3) burst(new V3(this.p.x, this.y + .3, this.p.z), 0xd8c8a0, 6, 5, .16, .4, 6, 1);
    this.tricked = false; this.trickA = 0;
  }
  // one step of driving. tr = the track, karts = everybody (for bumping)
  step(dt, tr) {
    const q = nearest(tr, this.p.x, this.p.z, this.hint); this.hint = q.i; this.d = q.d; const s0 = this.s; this.s = q.s; this.ice = tr.isIce ? false : false;
    this.offroad = Math.abs(q.d) > tr.width + .5; this.onIce = !this.offroad && tr.isIcePt && tr.isIcePt(q.s); this.onMud = !this.offroad && tr.isMudPt && tr.isMudPt(q.s);
    if (this.air) { this.offroad = false; this.onIce = false; this.onMud = false; }   // in the air nothing on the ground matters
    const fx = Math.sin(this.h), fz = Math.cos(this.h), sx = Math.cos(this.h), sz = -Math.sin(this.h);
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * sx + this.vz * sz; const inp = this.in, ctl = this.spinT <= 0 && !this.stopped;
    this.invul = Math.max(0, this.invul - dt); this.slowT = Math.max(0, this.slowT - dt); this.bumpCD = Math.max(0, this.bumpCD - dt); this.rampCD = Math.max(0, this.rampCD - dt); if (this.star > 0) this.star = Math.max(0, this.star - dt);
    if (this.air && ctl && inp.drift && this.airT > .08) this.tricked = true;   // press drift in the air: a trick (a boost when you land)
    // drifting: hold the drift key while turning to slide, release for a mini-turbo
    const dr = this.drift; const wantDrift = ctl && inp.drift && vf > 14 && !this.offroad && !this.air;
    if (!dr.on && wantDrift && Math.abs(inp.steer) > .25) { dr.on = true; dr.dir = Math.sign(inp.steer); dr.t = 0; dr.tier = 0; sfx('charge'); vf *= .98; }
    if (dr.on && (!wantDrift || vf < 9 || !ctl)) { this.endDrift(); }
    if (dr.on) { dr.t += dt * (.85 + .5 * Math.max(0, inp.steer * dr.dir)); const tier = dr.t > TIERS[2] ? 3 : dr.t > TIERS[1] ? 2 : dr.t > TIERS[0] ? 1 : 0; if (tier > dr.tier) { dr.tier = tier; sfx('miniTurbo'); } }
    // turning
    let turn = 0;
    if (ctl) { if (dr.on) turn = dr.dir * 1.05 * this.cls.drift + inp.steer * .85 * this.cls.turn; else turn = inp.steer * 2.1 * this.cls.turn * clamp(Math.abs(vf) / 9, 0, 1) * (1 - .36 * clamp(Math.abs(vf) / 52, 0, 1)) * (vf < -.5 ? -1 : 1); if (this.onIce) turn *= .75; if (this.air) turn *= .55; turn *= 1 + (this.sup - 1) * .35; }   // (super speed also steers a little sharper)
    if (this.spinT > 0) { this.spinT -= dt; this.yawVis += dt * 13; turn = 0; } else this.yawVis += angDiff(this.h, this.yawVis) * Math.min(1, dt * 14);
    this.h += turn * dt;
    // speed
    const vTop = this.topSpeed(); let acc = 0;
    if (this.sup > 1 && ctl && inp.thr > 0 && !this.air && vf < vTop * .985) vf = vTop * .985;   // super speed: no building up, you are at full speed the moment you press gas
    if (ctl && inp.thr > 0) { acc = (22 * this.cls.acc * (.5 + this.cc * .5) * (1 + (this.sup - 1) * 1.2)) * clamp(1 - Math.pow(Math.max(0, vf) / (vTop * 1.02), 2.2), 0, 1); if (this.boostT > 0) acc = Math.max(acc, 38); if (this.offroad) acc *= .6; if (this.onMud) acc *= .7; if (this.air) acc *= .3; }
    if (ctl && inp.brk > 0) { acc = vf > 1 ? -46 : -22 * (vf > -11 ? 1 : 0); }
    if (acc === 0 && ctl) acc = -(5 + vf * .12);      // coasting
    if (!ctl) acc = -10;
    if (vf > vTop) acc -= (vf - vTop) * 2.5 + 4;     // over the limit (after a boost, or off-road): bleed speed back
    vf += acc * dt;
    // sideways grip: low when drifting or on ice, which is what makes a kart slide
    const grip = this.air ? .5 : dr.on ? 1.8 : this.onIce ? .75 : this.offroad ? 4.5 : 8.2; vl *= Math.exp(-grip * dt);
    this.vx = fx * vf + sx * vl; this.vz = fz * vf + sz * vl; this.vf = vf;
    this.p.x += this.vx * dt; this.p.z += this.vz * dt;
    // the walls: slide along them, lose a little speed on a hard hit
    const q2 = nearest(tr, this.p.x, this.p.z, this.hint), lim = tr.width + SHOULDER - .9;
    if (Math.abs(q2.d) > lim) {
      const side = Math.sign(q2.d), over = Math.abs(q2.d) - lim; this.p.x -= q2.rx * side * over; this.p.z -= q2.rz * side * over;
      const vr = (this.vx * q2.rx + this.vz * q2.rz) * side; if (vr > 0) { this.vx -= q2.rx * side * vr * 1.25; this.vz -= q2.rz * side * vr * 1.25; const k = 1 - clamp(vr / (Math.hypot(this.vx, this.vz) + vr + 1) * .55, 0, .3); this.vx *= k; this.vz *= k; if (vr > 5 && this.bumpCD <= 0) { this.bumpCD = .3; burst(new V3(this.p.x + q2.rx * side * 1.2, this.y + .8, this.p.z + q2.rz * side * 1.2), 0xffe28a, 7, 6, .16, .4, 14, 2); if (this.isPlayer) sfx('wall', clamp(vr / 14, .3, 1)); this.shakeHit = clamp(vr / 14, 0, 1); } }
      if (dr.on && vr > 4) this.endDrift(true);
    }
    // height follows the road (or flies: a ramp or a crest sets vy)
    const gy = q2.y; if (this.vy === 0) { this.y += (gy - this.y) * Math.min(1, dt * 18); } else { this.vy -= 30 * dt; this.y += this.vy * dt; if (this.y <= gy) { this.y = gy; if (this.vy <= 0) this.vy = 0; } }   // a rising road can catch a rising kart, but it only lands once it is falling
    this.air = this.vy !== 0 && this.y - gy > .35; if (this.air) this.airT += dt; else { if (this.airT > 0) this.land(this.airT); this.airT = 0; }
    this.p.y = this.y; this.s = q2.s; this.d = q2.d; this.hint = q2.i; this.tx = q2.tx; this.tz = q2.tz;
    // progress, unwrapped so laps count and going backwards counts down
    let ds = this.s - this.prevS; if (ds < -tr.length / 2) ds += tr.length; else if (ds > tr.length / 2) ds -= tr.length; this.dist += ds; this.prevS = this.s; this.lap = Math.floor(this.dist / tr.length + 1e-6);
    this.wrong = (this.vx * q2.tx + this.vz * q2.tz) < -3 && Math.hypot(this.vx, this.vz) > 4 ? this.wrong + dt : Math.max(0, this.wrong - dt * 2);
    this.boostT = Math.max(0, this.boostT - dt); if (this.shield > 0) this.shield -= dt;
  }
  endDrift(cancel) { const dr = this.drift; if (dr.on && !cancel && dr.tier > 0) { this.boostT = Math.max(this.boostT, TIER_BOOST[dr.tier - 1]); if (this.isPlayer) sfx('boost'); this.vf = Math.min(this.vf + 6, 70); const c = TIER_COL[dr.tier - 1]; burst(new V3(this.p.x, this.y + .8, this.p.z), c, 14, 8, .2, .5, 6, 1); } dr.on = false; dr.t = 0; dr.tier = 0; }
  giveBoost(t, kick = 0) { this.boostT = Math.max(this.boostT, t); if (kick) { this.vx += Math.sin(this.h) * kick; this.vz += Math.cos(this.h) * kick; } if (this.isPlayer) sfx('boost'); }
  addCoin(n = 1) { const before = this.coins; this.coins = Math.min(10, this.coins + n); return this.coins > before; }
  hit(kind) {   // returns true if it hurt (a kart that somebody else drives online is hurt on their machine, not here)
    if (this.remote || this.invul > 0 || this.star > 0) return false;
    if (this.shield > 0) { this.shield = 0; sfx('shieldBreak'); ring(new V3(this.p.x, this.y + 1, this.p.z), 0x6ac8ff, 4, .4, false); this.invul = .6; return false; }
    this.spinT = kind === 'oil' ? 1.1 : .95; this.invul = 2.4; this.endDrift(true); this.vx *= .25; this.vz *= .25; this.boostT = 0; this.tricked = false;
    if (this.coins > 0) { const lost = Math.min(this.coins, 3); this.coins -= lost; burst(new V3(this.p.x, this.y + 1.2, this.p.z), 0xffd23a, 6 + lost * 2, 9, .2, .8, 14, 5); }
    if (this.isPlayer) { sfx('hit'); this.shakeHit = 1; } burst(new V3(this.p.x, this.y + 1, this.p.z), 0xffd34e, 16, 8, .22, .7, 12, 3); return true;
  }
  animate(dt) {
    const m = this.model; m.g.position.set(this.p.x, this.y, this.p.z); const lean = this.drift.on ? this.drift.dir * -.32 : clamp(-this.in.steer * Math.abs(this.vf) / 120, -.15, .15);
    if (this.tricked) this.trickA = Math.min(TAU, this.trickA + dt * 11);
    m.g.rotation.set(this.air ? clamp(-this.vy * .025, -.4, .4) : 0, this.spinT > 0 ? this.yawVis : this.h + (this.drift.on ? this.drift.dir * .22 : 0), this.tricked ? this.trickA : 0, 'YXZ'); m.body.rotation.z = lean * .3; this.steerVis += (this.in.steer * .5 - this.steerVis) * Math.min(1, dt * 12);
    this.wheelRot += this.vf * dt / .46; for (const w of m.wheels) { w.w.rotation.x = this.wheelRot; if (w.front) w.piv.rotation.y = this.steerVis; }
    m.flame.visible = this.boostT > 0; if (m.flame.visible) { m.flame.scale.set(1 + Math.random() * .3, 1 + Math.random() * .3, .8 + Math.random() * .7); } m.bubble.visible = this.shield > 0; m.g.visible = !(this.invul > 0 && this.spinT <= 0 && ((W.time * 14) | 0) % 2 === 0 && this.isPlayer === false && false);
    if (this.invul > 0 && this.spinT <= 0 && this.isPlayer && this.star <= 0) m.g.visible = ((W.time * 16) | 0) % 2 === 0 || this.invul > 1.4;
    if (this.rainbow) m.mat.color.setHSL((W.time * .45) % 1, .85, .58);
    if (this.star > 0) { m.aura.visible = true; m.mat.emissive.setHSL((W.time * 2.2) % 1, 1, .42); if (Math.random() < .6) burst(new V3(this.p.x + rnd(-1, 1), this.y + rnd(.4, 2), this.p.z + rnd(-1, 1)), [0xffe14a, 0xff4fa8, 0x2ee6ff][(Math.random() * 3) | 0], 1, 3, .16, .5, -2, 1); this._starFx = true; }
    else if (this._starFx) { this._starFx = false; m.aura.visible = false; m.mat.emissive.setHex(0); }
    if (m.hatSpin) m.hatSpin.rotation.y += dt * 26;
    // spark trail while drifting: color shows the mini-turbo you have charged
    if (this.drift.on && !this.model.noFx) { const c = this.drift.tier > 0 ? TIER_COL[this.drift.tier - 1] : 0xfff2a0, bx = this.p.x - Math.sin(this.h) * 1.3, bz = this.p.z - Math.cos(this.h) * 1.3; burst(new V3(bx, this.y + .3, bz), c, 1, 5, .13, .3, 12, 1); }
    if (this.boostT > 0 && Math.random() < .5) burst(new V3(this.p.x - Math.sin(this.h) * 1.8, this.y + .8, this.p.z - Math.cos(this.h) * 1.8), 0xff9a2a, 1, 4, .16, .3, 2, 0);
    if (this.offroad && Math.abs(this.vf) > 8 && Math.random() < .5) burst(new V3(this.p.x, this.y + .3, this.p.z), 0xd8c8a0, 1, 3, .18, .45, 4, 1);
    if (this.onMud && Math.abs(this.vf) > 8 && Math.random() < .6) burst(new V3(this.p.x, this.y + .3, this.p.z), 0x6b4524, 1, 4, .2, .5, 8, 2);
    // skid marks under the back wheels while sliding
    this.skidT -= dt; if (this.skidT <= 0 && !this.air && (this.drift.on || (this.spinT > 0 && Math.abs(this.vf) > 6))) { this.skidT = .04; const fx = Math.sin(this.h), fz = Math.cos(this.h), sx = Math.cos(this.h), sz = -Math.sin(this.h); for (const sd of [-1, 1]) skid(this.p.x - fx * 1.05 + sx * sd * 1.0, this.y, this.p.z - fz * 1.05 + sz * sd * 1.0, this.h + (this.drift.on ? this.drift.dir * .22 : 0)); }
  }
  remove() { scene.remove(this.model.g); }
}

// ---------------------------------------------------------------- items and what they do
const rocketGeo = (() => { const g = new THREE.CylinderGeometry(.22, .3, 1.5, 8); g.rotateX(Math.PI / 2); g.userData.shared = true; return g; })(), rocketMat = toon(0xff4a4a), seekerMat = toon(0xb04aff), bananaGeo = new THREE.CylinderGeometry(1.8, 1.8, .08, 16), oilMat = new THREE.MeshBasicMaterial({ color: 0x25175a, transparent: true, opacity: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const mineGeo = new THREE.SphereGeometry(.85, 12, 10), mineMat = toon(0x2a2140), mineLight = new THREE.MeshBasicMaterial({ color: 0xff3a3a }), mineLightGeo = new THREE.SphereGeometry(.28, 8, 6);
bananaGeo.userData.shared = mineGeo.userData.shared = mineLightGeo.userData.shared = true; rocketMat.userData.shared = seekerMat.userData.shared = oilMat.userData.shared = mineMat.userData.shared = mineLight.userData.shared = true;
export class Items {
  constructor() { this.rockets = []; this.oils = []; this.mines = []; this.onFire = null; }
  clear() { for (const r of this.rockets) scene.remove(r.m); for (const o of this.oils) scene.remove(o.m); for (const o of this.mines) scene.remove(o.m); this.rockets.length = 0; this.oils.length = 0; this.mines.length = 0; }
  roll(rank, n) {   // rank 0 = first. The further behind you are, the better the item.
    const f = n > 1 ? rank / (n - 1) : 0, w = { turbo: 3, turbo3: lerp(.5, 1.7, f), banana: lerp(3.2, .7, f), mine: lerp(2.2, .6, f), shield: 2.2, rocket: lerp(.8, 3, f), rocket3: f > .4 ? lerp(0, 2.1, (f - .4) / .6) : 0, seeker: f > .5 ? lerp(0, 2.4, (f - .5) / .5) : 0, zap: f > .6 ? lerp(0, 2.4, (f - .6) / .4) : 0, star: f > .3 ? lerp(0, 2.7, (f - .3) / .7) : 0 };
    let tot = 0; for (const k in w) tot += w[k]; let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'turbo';
  }
  use(k, karts, tr, tg) {   // tg: the targets (kart ids) when this is another player's item being replayed here
    const it = k.item; if (!it) return; const replay = Array.isArray(tg), ids = [], byId = id => karts.find(o => o.netId === id) || null;
    if (it === 'turbo3') { k.itemQty = (k.itemQty || 3) - 1; if (k.itemQty <= 0) { k.item = null; k.itemQty = 0; } } else k.item = null;
    if (k.isPlayer) sfx('use');
    const fx = Math.sin(k.h), fz = Math.cos(k.h);
    if (it === 'turbo' || it === 'turbo3') k.giveBoost(1.9, 4);
    else if (it === 'shield') { k.shield = 9; if (k.isPlayer) sfx('shield'); }
    else if (it === 'star') { k.star = 7.5; k.giveBoost(1.1, 2); sfx('star'); ring(new V3(k.p.x, k.y + 1, k.p.z), 0xffe14a, 5, .5, false); }
    else if (it === 'banana') { const m = new THREE.Mesh(bananaGeo, oilMat); m.position.set(k.p.x - fx * 3, k.y + .12, k.p.z - fz * 3); scene.add(m); this.oils.push({ m, x: m.position.x, z: m.position.z, owner: k, life: 45 }); sfx('throw'); }
    else if (it === 'mine') { const m = new THREE.Group(); m.add(new THREE.Mesh(mineGeo, mineMat)); const lt = new THREE.Mesh(mineLightGeo, mineLight); lt.position.y = .85; m.add(lt); m.position.set(k.p.x - fx * 3.2, k.y + .9, k.p.z - fz * 3.2); scene.add(m); this.mines.push({ m, lt, x: m.position.x, z: m.position.z, y: k.y, owner: k, arm: 1.0, life: 40 }); sfx('throw'); }
    else if (it === 'rocket') { const t = replay ? byId(tg[0]) : this.pickTarget(k, karts); if (t) ids.push(t.netId); this.fire(k, 0, t, 'rocket'); }
    else if (it === 'rocket3') { const ts = replay ? tg.map(byId).filter(Boolean) : this.pickTargets(k, karts, 3); ts.forEach(t => ids.push(t.netId)); [-.3, 0, .3].forEach((da, i) => this.fire(k, da, ts.length ? ts[i % ts.length] : null, 'rocket')); }
    else if (it === 'seeker') { let lead = null; for (const o of karts) if (o !== k && !o.finished && (!lead || o.dist > lead.dist)) lead = o; const t = replay ? byId(tg[0]) : (lead && lead.dist > k.dist ? lead : this.pickTarget(k, karts)); if (t) ids.push(t.netId); this.fire(k, 0, t, 'seeker'); sfx('seeker'); }
    else if (it === 'zap') { sfx('zap'); for (const o of karts) if (o !== k && o.dist > k.dist - 2 && o.dist - k.dist < tr.length) { if (o.star > 0) continue; if (o.shield > 0) { o.shield = 0; if (o.isPlayer) sfx('shieldBreak'); } else { o.slowT = 2.6; if (o.isPlayer) { o.shakeHit = 1; sfx('hit'); } } burst(new V3(o.p.x, o.y + 2, o.p.z), 0xffe14a, 14, 7, .2, .6, 6, 3); } this.zapFlash = 1; }
    if (this.onUse && !replay) this.onUse(k, it, ids);
  }
  fire(k, da, tgt, type) {
    const h = k.h + da, fx = Math.sin(h), fz = Math.cos(h), seeker = type === 'seeker', m = new THREE.Mesh(rocketGeo, seeker ? seekerMat : rocketMat); if (seeker) m.scale.setScalar(1.5); scene.add(m);
    this.rockets.push({ m, x: k.p.x + fx * 2.5, z: k.p.z + fz * 2.5, y: k.y + .9, h, owner: k, target: tgt, life: seeker ? 14 : 7, full: seeker ? 14 : 7, speed: seeker ? Math.max(95, k.vf + 50) : Math.max(70, k.vf + 40), type });
    if (k.isPlayer && !seeker) sfx('rocket');
  }
  pickTarget(k, karts) { let best = null, bd = 1e9; for (const o of karts) { if (o === k || o.finished) continue; const d = o.dist - k.dist; if (d > 0 && d < 160 && d < bd) { bd = d; best = o; } } return best; }
  pickTargets(k, karts, n) { return karts.filter(o => o !== k && !o.finished && o.dist > k.dist && o.dist - k.dist < 170).sort((a, b) => a.dist - b.dist).slice(0, n); }
  update(dt, karts, tr) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]; r.life -= dt; let want = r.h; const seeker = r.type === 'seeker', tgt = r.target && !r.target.finished ? r.target : null;
      if (tgt) {
        const dx = tgt.p.x - r.x, dz = tgt.p.z - r.z;
        if (seeker && Math.hypot(dx, dz) > 55) { const qs = nearest(tr, r.x, r.z, -1), lp = pointAt(tr, qs.s + 30, clamp(tgt.d, -tr.width * .6, tr.width * .6)); want = Math.atan2(lp.x - r.x, lp.z - r.z); }   // a seeker follows the road until it is close, then dives at its target
        else want = Math.atan2(dx, dz);
      } else { const q = nearest(tr, r.x, r.z, -1); want = Math.atan2(q.tx, q.tz); }
      const turnRate = seeker ? 4.2 : 2.8; r.h += clamp(angDiff(want, r.h), -turnRate * dt, turnRate * dt); r.x += Math.sin(r.h) * r.speed * dt; r.z += Math.cos(r.h) * r.speed * dt; const q = nearest(tr, r.x, r.z, -1); r.y += (q.y + .9 - r.y) * Math.min(1, dt * 10);
      r.m.position.set(r.x, r.y, r.z); r.m.rotation.y = r.h; if (Math.random() < .8) burst(new V3(r.x - Math.sin(r.h) * 1.2, r.y, r.z - Math.cos(r.h) * 1.2), seeker ? 0xc07aff : 0xffa02a, 1, 3, .22, .35, 0, 0);
      let dead = r.life <= 0 || Math.abs(q.d) > tr.width + SHOULDER;
      for (const k of karts) { if (k === r.owner && r.life > r.full - .7) continue; if (seeker && tgt && k !== tgt) continue; if (Math.hypot(k.p.x - r.x, k.p.z - r.z) < 2.4 && k.y - r.y < 3) { dead = true; sfx('boom'); if (seeker) { for (const o of karts) if (o !== r.owner && Math.hypot(o.p.x - r.x, o.p.z - r.z) < 6) o.hit('rocket'); ring(new V3(r.x, r.y, r.z), 0xc07aff, 8, .5, false); } else k.hit('rocket'); burst(new V3(r.x, r.y, r.z), seeker ? 0xc07aff : 0xff8a2a, 22, 10, .3, .7, 8, 3); break; } }
      if (dead) { scene.remove(r.m); this.rockets.splice(i, 1); }
    }
    for (let i = this.oils.length - 1; i >= 0; i--) {
      const o = this.oils[i]; o.life -= dt; let dead = o.life <= 0;
      for (const k of karts) { if (k === o.owner && o.life > 43) continue; if (Math.hypot(k.p.x - o.x, k.p.z - o.z) < 2.0 && k.y - o.m.position.y < 1.2) { if (k.hit('oil')) { dead = true; sfx('spin'); } else dead = dead || k.shield <= 0; break; } }
      if (dead) { scene.remove(o.m); this.oils.splice(i, 1); }
    }
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const o = this.mines[i]; o.life -= dt; o.arm -= dt; o.lt.visible = ((W.time * (o.arm > 0 ? 3 : 7)) | 0) % 2 === 0; let boom = o.life <= 0;
      if (o.arm <= 0) for (const k of karts) if (Math.hypot(k.p.x - o.x, k.p.z - o.z) < 3.1 && k.y - o.y < 1.6) { boom = true; break; }
      if (boom) { sfx('mine'); sfx('boom'); const c = new V3(o.x, o.y + .8, o.z); ring(c, 0xff8a2a, 9, .5, false); burst(c, 0xff8a2a, 26, 12, .32, .8, 8, 3); for (const k of karts) if (Math.hypot(k.p.x - o.x, k.p.z - o.z) < 7.5 && k.y - o.y < 4) k.hit('rocket'); scene.remove(o.m); this.mines.splice(i, 1); }
    }
    if (this.zapFlash > 0) this.zapFlash = Math.max(0, this.zapFlash - dt * 2);
  }
}

// karts bump each other: push apart and swap a little speed (heavier karts get pushed less; a star kart spins out whoever it touches)
export function bumpKarts(karts, dt) {
  for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
    const a = karts[i], b = karts[j]; if (a.finished && b.finished) continue; const dx = b.p.x - a.p.x, dz = b.p.z - a.p.z, d2 = dx * dx + dz * dz; if (d2 > 3.4 * 3.4 || d2 < .0001) continue; if (Math.abs(a.y - b.y) > 2.2) continue;
    const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, over = 3.4 - d, ma = a.cls.mass, mb = b.cls.mass, tot = ma + mb;
    a.p.x -= nx * over * (mb / tot); a.p.z -= nz * over * (mb / tot); b.p.x += nx * over * (ma / tot); b.p.z += nz * over * (ma / tot);
    const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rv < 0) { const j2 = -rv * .6; a.vx -= nx * j2 * 2 * mb / tot; a.vz -= nz * j2 * 2 * mb / tot; b.vx += nx * j2 * 2 * ma / tot; b.vz += nz * j2 * 2 * ma / tot; if (-rv > 6 && a.bumpCD <= 0 && b.bumpCD <= 0) { a.bumpCD = b.bumpCD = .25; if (a.isPlayer || b.isPlayer) sfx('bump', clamp(-rv / 18, .3, 1)); burst(new V3((a.p.x + b.p.x) / 2, a.y + .9, (a.p.z + b.p.z) / 2), 0xffffff, 5, 5, .14, .3, 10, 1); } }
    if (a.star > 0 && b.star <= 0) { if (b.hit('star') && (b.isPlayer || a.isPlayer)) sfx('boom'); } else if (b.star > 0 && a.star <= 0) { if (a.hit('star') && (b.isPlayer || a.isPlayer)) sfx('boom'); }
  }
}
