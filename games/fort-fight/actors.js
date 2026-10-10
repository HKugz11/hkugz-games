// FORT FIGHT - characters (the player, bots and dummies), weapons and combat.
import { THREE, V3, scene, toon, outline, INK, QL, GFX, burst, tracer, ring, sfx, sfxAt, rnd, clamp, pick, W, TAU, hex, disposeObj, camera, angDiff } from './core.js?v=10';
import { world, moveEntity, unstuck, rayActor, rayBoxT } from './physics.js?v=10';
import { MATS, MAT_IDS, COST, placePiece, slotFromPose, canPlace, damagePiece, pieces, slotPose } from './pieces.js?v=10';

export const WEAPONS = [
  { id: 'pick', name: 'Pickaxe', melee: true, dmg: 22, sdmg: 55, rate: .5, reach: 3.3 },
  { id: 'ar', name: 'Assault Rifle', dmg: 30, pellets: 1, rate: .15, mag: 30, reload: 2.3, spread: .005, bloom: .0035, maxBloom: .032, head: 1.5, sdmg: 20, auto: true, sfx: 'ar', ads: .8, kick: .012, tracer: 0xfff2a0 },
  { id: 'pump', name: 'Pump Shotgun', dmg: 11, pellets: 9, rate: .95, mag: 5, reload: 3.3, spread: .05, bloom: 0, maxBloom: 0, head: 1.5, sdmg: 7, auto: false, sfx: 'pump', ads: .92, kick: .05, tracer: 0xffc88a, falloff: [7, 32] },
  { id: 'smg', name: 'SMG', dmg: 17, pellets: 1, rate: .075, mag: 30, reload: 1.9, spread: .011, bloom: .0045, maxBloom: .05, head: 1.4, sdmg: 11, auto: true, sfx: 'smg', ads: .86, kick: .008, tracer: 0xa0f0ff },
  { id: 'sniper', name: 'Sniper', dmg: 105, pellets: 1, rate: 1.35, mag: 1, reload: 2.5, spread: .06, bloom: 0, maxBloom: 0, head: 2.4, sdmg: 100, auto: false, sfx: 'sniper', ads: .26, kick: .07, tracer: 0xff9ad8, scope: true },
];
export const SLOT_KEYS = ['1', '2', '3', '4', '5'];
export const hooks = { onKill: null, onDamage: null, onFire: null, onBuild: null, dmgNumber: null, onHarvest: null };

// ---------------------------------------------------------------- character model
// Each character is only about a dozen draw calls: the body is merged into a few meshes with vertex colors, and the geometry is shared.
const dark = toon(0x2a2140); dark.userData.shared = true;
const vcol = toon(0xffffff, { vertexColors: true }); vcol.userData.shared = true;
function mergeParts(list) {   // [[geometry already in place, color]]
  const pos = [], nor = [], col = [];
  for (const [geo, color] of list) {
    const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.userData.shared = true; return out;
}
function inflate(geo, d) { const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d); g.userData.shared = true; return g; }
const tr = (g, x, y, z, rx = 0) => { if (rx) g.rotateX(rx); return g.translate(x, y, z); };
const RG = {};
function rigGeos() {
  if (RG.shellA) return RG;
  RG.shellA = mergeParts([[tr(new THREE.CapsuleGeometry(.3, .42, 4, 12), 0, .98, 0), 0xffffff], [tr(new THREE.SphereGeometry(.065, 8, 6), 0, 2.09, 0), 0xffffff]]);
  RG.shellB = mergeParts([[tr(new THREE.CylinderGeometry(.31, .31, .12, 14), 0, .8, 0), 0xf4f0ff], [tr(new THREE.SphereGeometry(.29, 16, 12), 0, 1.58, 0), 0xf4f0ff], [tr(new THREE.BoxGeometry(.42, .17, .2), 0, 1.6, -.19), 0x2a2140], [tr(new THREE.CylinderGeometry(.015, .015, .22, 6), 0, 1.95, 0), 0x2a2140]]);
  RG.eyes = mergeParts([[tr(new THREE.SphereGeometry(.05, 8, 6), -.1, 1.61, -.29), 0xffffff], [tr(new THREE.SphereGeometry(.05, 8, 6), .1, 1.61, -.29), 0xffffff]]);
  RG.hullA = inflate(RG.shellA, .022); RG.hullB = inflate(RG.shellB, .022);
  RG.leg = tr(new THREE.BoxGeometry(.18, .5, .2), 0, -.25, 0); RG.leg.userData.shared = true;
  RG.armL = tr(new THREE.CapsuleGeometry(.07, .3, 3, 8), 0, -.2, 0); RG.armL.userData.shared = true;
  RG.sleeve = tr(new THREE.CapsuleGeometry(.07, .22, 3, 8), 0, 0, -.1, Math.PI / 2); RG.sleeve.userData.shared = true;
  const B = (sx, sy, sz, x, y, z, c) => [tr(new THREE.BoxGeometry(sx, sy, sz), x, y, z), c], body = 0x3a3358, dk = 0x2a2140;
  RG.gun = {
    pick: mergeParts([[tr(new THREE.CylinderGeometry(.03, .03, .8, 6), 0, 0, -.25, Math.PI / 2), 0xa36a3a], B(.07, .08, .5, 0, .02, -.62, 0xc8d2e0), B(.2, .05, .07, 0, .02, -.7, 0xc8d2e0)]),
    ar: mergeParts([B(.1, .14, .5, 0, 0, -.25, body), B(.06, .06, .3, 0, .02, -.65, dk), B(.09, .2, .09, 0, -.15, -.2, 0x5a6cff), B(.1, .12, .2, 0, -.02, .05, 0x5a6cff)]),
    pump: mergeParts([B(.1, .12, .35, 0, 0, -.1, 0x8a5a2a), B(.07, .07, .6, 0, .03, -.55, dk), B(.09, .09, .22, 0, -.08, -.45, 0xff8a3a)]),
    smg: mergeParts([B(.09, .13, .36, 0, 0, -.18, body), B(.05, .05, .2, 0, .02, -.46, dk), B(.07, .22, .08, 0, -.17, -.12, 0x20b8e8)]),
    sniper: mergeParts([B(.09, .12, .75, 0, 0, -.35, body), B(.05, .05, .5, 0, .02, -.95, dk), [tr(new THREE.CylinderGeometry(.04, .04, .3, 8), 0, .12, -.3, Math.PI / 2), 0xff4fa8], B(.1, .15, .22, 0, -.02, .12, 0xff4fa8)]),
  };
  return RG;
}
export function makeRig(color, opts = {}) {
  const G = rigGeos(), g = new THREE.Group(), body = new THREE.Group(); g.add(body); const cast = QL.shadow > 0;
  const mat = toon(color), eyeM = new THREE.MeshBasicMaterial({ color: opts.eye || 0x2ee6ff });
  const shellA = new THREE.Mesh(G.shellA, mat), shellB = new THREE.Mesh(G.shellB, vcol); shellA.castShadow = shellB.castShadow = cast; body.add(shellA, shellB, new THREE.Mesh(G.eyes, eyeM));
  if (QL.edges) { body.add(new THREE.Mesh(G.hullA, INK), new THREE.Mesh(G.hullB, INK)); }
  const legL = new THREE.Group(), legR = new THREE.Group(); for (const [lg, x] of [[legL, -.15], [legR, .15]]) { lg.add(new THREE.Mesh(G.leg, dark)); lg.position.set(x, .5, 0); body.add(lg); }
  const armL = new THREE.Group(); armL.position.set(-.36, 1.12, 0); armL.add(new THREE.Mesh(G.armL, mat)); body.add(armL);
  const arm = new THREE.Group(); arm.position.set(.36, 1.12, -.02); arm.add(new THREE.Mesh(G.sleeve, mat)); const hold = new THREE.Group(); hold.position.set(0, 0, -.1); arm.add(hold); body.add(arm);
  const held = {}; for (const w of WEAPONS) { const m = new THREE.Mesh(G.gun[w.id], vcol); m.visible = false; hold.add(m); held[w.id] = m; }
  const bar = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(.9, .1), BAR_BG), fg = new THREE.Mesh(new THREE.PlaneGeometry(.86, .06), BAR_HP), sh = new THREE.Mesh(new THREE.PlaneGeometry(.86, .03), BAR_SH);
  fg.position.z = .001; sh.position.set(0, .04, .002); bg.renderOrder = 10; fg.renderOrder = 11; sh.renderOrder = 12; bar.add(bg, fg, sh); bar.position.y = 2.5; g.add(bar);
  if (opts.tag) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d'); x.font = '900 34px "Trebuchet MS", sans-serif'; x.textAlign = 'center'; x.lineWidth = 7; x.strokeStyle = 'rgba(10,6,24,.9)'; x.strokeText(opts.tag, 128, 44); x.fillStyle = hex(color); x.fillText(opts.tag, 128, 44);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const tg = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); tg.scale.set(2.2, .55, 1); tg.position.y = 2.85; tg.renderOrder = 12; g.add(tg); }
  if (!QL.shadow) { const bs = new THREE.Mesh(BLOB_GEO, BLOB_MAT); bs.rotation.x = -Math.PI / 2; bs.position.y = .04; g.add(bs); }
  return { g, body, legL, legR, arm, armL, mat, bar, fg, sh, held, eyeM };
}
const BAR_BG = new THREE.MeshBasicMaterial({ color: 0x120a24, depthTest: false, transparent: true }), BAR_HP = new THREE.MeshBasicMaterial({ color: 0x4aff8a, depthTest: false }), BAR_SH = new THREE.MeshBasicMaterial({ color: 0x4aa8ff, depthTest: false });
const BLOB_GEO = new THREE.CircleGeometry(.5, 14), BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .3, depthWrite: false });
for (const m of [BAR_BG, BAR_HP, BAR_SH, BLOB_MAT]) m.userData.shared = true; BLOB_GEO.userData.shared = true;
export function gunGeo(id) { return rigGeos().gun[id]; }
export function setHeld(rig, id) { for (const k in rig.held) rig.held[k].visible = k === id; rig.arm.visible = true; }

// ---------------------------------------------------------------- actor
let nextActorId = 1;
export class Actor {
  constructor(o) {
    this.id = o.id !== undefined ? o.id : nextActorId++; this.name = o.name || 'Player'; this.color = o.color || 0x2ee6ff; this.isBot = !!o.isBot; this.isDummy = !!o.isDummy; this.team = o.team !== undefined ? o.team : this.id;
    this.pos = new V3(); this.vel = new V3(); this.r = .38; this.h = 1.8; this.yaw = 0; this.pitch = 0; this.onGround = true; this.crouchK = 0; this.coyote = 0; this.jumpBuf = 0;
    this.maxHp = o.maxHp || 100; this.maxShield = o.maxShield !== undefined ? o.maxShield : 100; this.hp = this.maxHp; this.shield = this.maxShield; this.alive = false; this.respT = 0; this.spawnProt = 0;
    this.kills = 0; this.deaths = 0; this.streak = 0; this.wi = 1; this.ammo = WEAPONS.map(w => ({ mag: w.mag || 0 })); this.cd = 0; this.reloadT = 0; this.bloom = 0; this.swapT = 0; this.pickT = 0; this.lastHurt = -99; this.lastHitBy = null;
    this.mats = { wood: 0, stone: 0, metal: 0 }; this.matSel = 'wood'; this.infinite = true; this.buildCD = 0; this.mode = 'gun'; this.buildType = 'w'; this.rot = 0; this.ads = false;
    this.rig = makeRig(this.color, { tag: this.isDummy || o.noTag ? null : this.name, eye: this.isBot ? 0xff6a8a : 0x4aff8a }); this.rig.g.visible = false; scene.add(this.rig.g);
    this.remote = false; this.tpos = new V3(); this.tyaw = 0; this.tpitch = 0; this.tcr = 0; this.tground = true; this.hideSelf = false;
    this.rig.bar.visible = this.isBot || this.isDummy; setHeld(this.rig, 'ar'); this.walkPh = 0; this.landT = 0; this.shotT = 0; this.ai = null;
  }
  get eyeY() { return this.pos.y + this.h - .2; }
  eye(out = new V3()) { return out.set(this.pos.x, this.eyeY, this.pos.z); }
  get weapon() { return WEAPONS[this.wi]; }
  spawn(p, prot = 1.6) { this.pos.copy(p); this.vel.set(0, 0, 0); this.hp = this.maxHp; this.shield = this.maxShield; this.alive = true; this.spawnProt = prot; this.reloadT = 0; this.cd = .3; this.bloom = 0; this.crouchK = 0; this.h = 1.8; this.rig.g.visible = true; this.ads = false; this.mode = 'gun'; for (let i = 0; i < WEAPONS.length; i++) this.ammo[i].mag = WEAPONS[i].mag || 0; this.refreshHeld(); }
  refreshHeld() { setHeld(this.rig, this.mode === 'gun' || this.mode === 'build' ? (this.mode === 'build' ? null : this.weapon.id) : null); if (this.mode === 'build') for (const k in this.rig.held) this.rig.held[k].visible = false; }
  selectWeapon(i) { if (i < 0 || i >= WEAPONS.length) return; if (this.mode === 'gun' && i === this.wi) return; this.wi = i; this.mode = 'gun'; this.reloadT = 0; this.cd = Math.max(this.cd, .22); this.swapT = .2; this.ads = false; this.refreshHeld(); if (this === W.me) sfx('swap'); }
  startReload() { const w = this.weapon; if (w.melee || this.reloadT > 0 || this.ammo[this.wi].mag >= w.mag || this.mode !== 'gun') return; this.reloadT = w.reload; if (this === W.me) sfx('reload'); else sfxAt('reload', this.pos); }
  // physics + timers. inp: { mx, mz, jump, crouch, speedMul }
  step(dt, inp) {
    if (!this.alive) return;
    this.crouchK += ((inp.crouch ? 1 : 0) - this.crouchK) * clamp(dt * 14, 0, 1); this.h = 1.8 - .55 * this.crouchK;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), fx = -sy, fz = -cy, rx = cy, rz = -sy;
    let wx = fx * inp.mz + rx * inp.mx, wz = fz * inp.mz + rz * inp.mx; const m = Math.hypot(wx, wz); if (m > 1) { wx /= m; wz /= m; }
    const sp = 7.4 * (inp.crouch ? .5 : 1) * (inp.speedMul || 1) * (this.ads ? .72 : 1);
    const k = clamp(dt * (this.onGround ? 13 : 2.4), 0, 1); this.vel.x += (wx * sp - this.vel.x) * k; this.vel.z += (wz * sp - this.vel.z) * k;
    this.coyote = this.onGround ? .1 : this.coyote - dt; this.jumpBuf = inp.jump ? .12 : this.jumpBuf - dt;
    if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) { this.vel.y = 9.3; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; if (this === W.me) sfx('jump'); }
    const vyBefore = this.vel.y; const was = this.onGround; moveEntity(this, dt); unstuck(this);
    if (this.onGround && !was && vyBefore < -9) { this.landT = .2; if (this === W.me) sfx('land', clamp(-vyBefore / 20, .2, 1)); }
    this.spawnProt = Math.max(0, this.spawnProt - dt); this.buildCD = Math.max(0, this.buildCD - dt); this.swapT = Math.max(0, this.swapT - dt); this.landT = Math.max(0, this.landT - dt);
    this.cd -= dt; this.bloom = Math.max(0, this.bloom - dt * .06); this.shotT = Math.max(0, this.shotT - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.ammo[this.wi].mag = this.weapon.mag; this.reloadT = 0; } }
  }
  // a remote player: ease towards the last position we were sent
  netStep(dt) {
    if (!this.alive) return; const k = 1 - Math.exp(-dt * 14), px = this.pos.x, pz = this.pos.z, py = this.pos.y;
    if (this.pos.distanceTo(this.tpos) > 7) this.pos.copy(this.tpos); else this.pos.lerp(this.tpos, k);
    this.vel.set((this.pos.x - px) / Math.max(dt, .001), (this.pos.y - py) / Math.max(dt, .001), (this.pos.z - pz) / Math.max(dt, .001));
    this.yaw += angDiff(this.tyaw, this.yaw) * k; this.pitch += (this.tpitch - this.pitch) * k; this.crouchK += (this.tcr - this.crouchK) * k; this.h = 1.8 - .55 * this.crouchK; this.onGround = this.tground;
    this.shotT = Math.max(0, this.shotT - dt); this.landT = Math.max(0, this.landT - dt);
  }
  // spend materials; the player and bots in the box fight have unlimited
  canAfford() { return this.infinite || this.mats[this.matSel] >= COST; }
  build(type, rot = 0) {
    if (!this.alive || this.buildCD > 0) return null; const slot = slotFromPose(type, this.pos, this.yaw, this.pitch, rot);
    if (!this.canAfford()) { if (this === W.me) sfx('empty'); return null; }
    const p = placePiece(slot, this.matSel, this.id); if (!p) return null; this.buildCD = .085; if (!this.infinite) this.mats[this.matSel] -= COST;
    if (hooks.onBuild) hooks.onBuild(this, p); return p;
  }
  // draw the character (called every frame)
  animate(dt, cam) {
    const g = this.rig.g; g.visible = this.alive && !this.hideSelf; if (!this.alive) return; const rg = this.rig;
    g.position.copy(this.pos); const sp = Math.hypot(this.vel.x, this.vel.z), mv = clamp(sp / 6, 0, 1); this.walkPh += dt * (6 + sp * 1.3);
    let ry = this.yaw; if (this.isBot || this.isDummy) ry = this.yaw; rg.body.rotation.y = ry; rg.body.scale.y = 1 - .26 * this.crouchK;
    // move the legs against the facing direction
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), back = (this.vel.x * fx + this.vel.z * fz) < -.5 ? -1 : 1;
    const air = !this.onGround; rg.legL.rotation.x = air ? .5 : Math.sin(this.walkPh) * .85 * mv * back; rg.legR.rotation.x = air ? -.3 : -Math.sin(this.walkPh) * .85 * mv * back;
    rg.armL.rotation.x = air ? -.9 : -Math.sin(this.walkPh) * .6 * mv; rg.body.position.y = air ? .02 : Math.abs(Math.sin(this.walkPh)) * .06 * mv - this.landT * .35;
    rg.arm.rotation.x = this.mode === 'build' ? -.5 : clamp(this.pitch, -.9, .9) * (this.weapon.melee && this.mode === 'gun' ? .3 : 1) + (this.weapon.melee && this.shotT > 0 ? -1.3 * (this.shotT / .25) : 0);
    if (rg.bar.visible) { rg.bar.quaternion.copy(cam.quaternion); const f = clamp(this.hp / this.maxHp, .001, 1), s = clamp(this.shield / Math.max(1, this.maxShield), 0, 1); rg.fg.scale.x = f; rg.fg.position.x = -(1 - f) * .43; rg.sh.visible = this.maxShield > 0 && s > 0; rg.sh.scale.x = Math.max(.001, s); rg.sh.position.x = -(1 - s) * .43; }
  }
  remove() { scene.remove(this.rig.g); disposeObj(this.rig.g); }
}

// ---------------------------------------------------------------- combat
const tmpO = new V3(), tmpD = new V3();
export function damageActor(v, dmg, attacker, head, via) {
  if (v.remote) {   // online: the player being hit is the one who applies the damage, we just show our hit
    if (!v.alive || dmg <= 0) return 0; const sh = Math.min(v.shield, dmg); v.shield -= sh; v.hp = Math.max(1, v.hp - (dmg - sh));
    if (hooks.dmgNumber) hooks.dmgNumber(new V3(v.pos.x, v.pos.y + v.h + .3, v.pos.z), Math.round(dmg), head, sh > 0 && dmg - sh <= 0, attacker); if (hooks.sendHit) hooks.sendHit(v, dmg, head, via); return dmg;
  }
  if (!v.alive || v.spawnProt > 0 || dmg <= 0) return 0;
  let rem = dmg, sh = 0; if (v.shield > 0) { sh = Math.min(v.shield, rem); v.shield -= sh; rem -= sh; } v.hp -= rem; v.lastHurt = W.time; v.lastHitBy = attacker || null;
  if (hooks.dmgNumber) hooks.dmgNumber(new V3(v.pos.x, v.pos.y + v.h + .3, v.pos.z), Math.round(dmg), head, sh > 0 && rem <= 0, attacker);
  if (hooks.onDamage) hooks.onDamage(v, dmg, attacker, head);
  if (v.hp <= 0) { v.hp = 0; killActor(v, attacker, via); }
  return dmg;
}
export function killActor(v, attacker, via) {
  if (!v.alive) return; v.alive = false; v.deaths++; v.streak = 0; v.rig.g.visible = false; v.ads = false;
  burst(new V3(v.pos.x, v.pos.y + 1, v.pos.z), v.color, 22, 8, .2, 1, 14, 3); burst(new V3(v.pos.x, v.pos.y + 1, v.pos.z), 0xffffff, 10, 6, .14, .8, 12, 2); ring(new V3(v.pos.x, v.pos.y + .3, v.pos.z), v.color, 3, .5);
  if (attacker && attacker !== v) { attacker.kills++; attacker.streak++; }
  sfxAt(v === W.me ? 'bye' : 'kill', v.pos);
  if (hooks.onKill) hooks.onKill(v, attacker, via);
}
function nearestHit(o, d, a, maxT, skip) {   // closest thing a ray hits: { t, kind: 'actor'|'box'|'ground'|null, who, head, box }
  const wr = world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxT); let best = { t: wr.t, kind: wr.box ? 'box' : (wr.t < maxT ? 'ground' : null), box: wr.box };
  for (const v of W.actors) { if (v === a || !v.alive || (skip && skip(v))) continue; const h = rayActor(o.x, o.y, o.z, d.x, d.y, d.z, v); if (h && h.t < best.t) best = { t: h.t, kind: 'actor', who: v, head: h.head, box: null }; }
  return best;
}
export const raycastAll = nearestHit;
// shoot the current weapon from `origin` along `dir` (unit vector). Returns true if a shot was fired.
export function fireGun(a, origin, dir, muzzle) {
  const w = a.weapon; if (w.melee || a.cd > 0 || a.reloadT > 0 || !a.alive || a.mode !== 'gun' || a.swapT > 0) return false;
  const am = a.ammo[a.wi]; if (am.mag <= 0) { a.startReload(); if (a === W.me) sfx('empty'); return false; }
  am.mag--; a.cd = w.rate; a.shotT = .12; const spreadK = (a.ads ? (w.scope ? 0 : .5) : 1) * (a.crouchK > .5 ? .75 : 1) * (a.onGround ? 1 : 1.5), sp = (w.spread + a.bloom) * spreadK; a.bloom = Math.min(w.maxBloom, a.bloom + w.bloom);
  const mz = muzzle || origin; const n = w.pellets || 1, hits = [], ends = [];
  for (let i = 0; i < n; i++) {
    tmpD.copy(dir); if (sp > 0) { tmpD.x += rnd(-sp, sp); tmpD.y += rnd(-sp, sp); tmpD.z += rnd(-sp, sp); tmpD.normalize(); }
    const hit = nearestHit(origin, tmpD, a, 300, v => v.team === a.team); const hp = new V3().copy(origin).addScaledVector(tmpD, hit.t);
    if (i < (n > 3 ? 4 : n)) { tracer(mz, hp, w.tracer, .08); ends.push(hp); }
    if (hit.kind === 'actor') { let dm = w.dmg * (hit.head ? w.head : 1); if (w.falloff) { const t = clamp((hit.t - w.falloff[0]) / (w.falloff[1] - w.falloff[0]), 0, 1); dm *= 1 - .7 * t; } hits.push([hit.who, dm * (a.dmgMul || 1), hit.head]); }
    else if (hit.kind === 'box') { const b = hit.box; if (b.kind === 'piece') { damagePiece(b.piece, w.sdmg * (a.isBot ? .8 : 1), a); burst(hp, MATS[b.piece.mat].color, 3, 3, .1, .35, 14, 1); } else if (b.prop && b.prop.onHit) { b.prop.onHit(w.sdmg * .4, a, hp); } else burst(hp, 0xffffff, 3, 3, .08, .3, 14, 1); }
    else if (hit.kind === 'ground') burst(hp, 0xd8e8c8, 3, 3, .08, .3, 14, 1);
  }
  // pellets that hit the same target add up into one damage number
  const by = new Map(); for (const [v, dm, hd] of hits) { const e = by.get(v) || { dm: 0, head: false }; e.dm += dm; e.head = e.head || hd; by.set(v, e); }
  for (const [v, e] of by) damageActor(v, e.dm, a, e.head, w.id);
  if (a === W.me) sfx(w.sfx); else sfxAt(w.sfx, a.pos);
  if (hooks.onFire) hooks.onFire(a, w, by, mz, ends);
  if (am.mag <= 0 && !w.scope && w.mag > 1) a.startReload();
  return true;
}
export function swingPickaxe(a, origin, dir) {
  const w = WEAPONS[0]; if (a.cd > 0 || !a.alive || a.swapT > 0) return false; a.cd = w.rate; a.shotT = .25; sfx('swing', .5); if (hooks.onSwing) hooks.onSwing(a);
  const hit = nearestHit(origin, dir, a, w.reach + .8, v => v.team === a.team); if (hit.t > w.reach + (hit.kind === 'actor' ? .6 : 0)) return true;
  const hp = new V3().copy(origin).addScaledVector(dir, hit.t);
  if (hit.kind === 'actor') { damageActor(hit.who, w.dmg * (hit.head ? 1.5 : 1), a, hit.head, 'pick'); sfxAt('pickhit', hp); burst(hp, 0xffffff, 4, 3, .1, .3, 12, 1); }
  else if (hit.kind === 'box') {
    const b = hit.box; sfxAt('pickhit', hp);
    if (b.kind === 'piece') { const p = b.piece; damagePiece(p, w.sdmg, a); burst(hp, MATS[p.mat].color, 5, 4, .12, .4, 14, 1); if (!a.infinite) { const gain = 8; a.mats[p.mat] = Math.min(999, a.mats[p.mat] + gain); if (hooks.onHarvest) hooks.onHarvest(a, p.mat, gain); } }
    else if (b.prop && b.prop.onHit) b.prop.onHit(w.sdmg, a, hp, true);
  }
  return true;
}
export function addMats(a, mat, n) { a.mats[mat] = Math.min(999, a.mats[mat] + n); if (hooks.onHarvest) hooks.onHarvest(a, mat, n); }
