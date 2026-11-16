// The skater: physics (rolling, ollie, air tricks, grinding, landing check, bail) + blocky model.
import * as THREE from './three.module.min.js?v=1';
import { SPIN_POINTS } from './tricks.js?v=1';
import { computeStats, mergePerks, BOARDS } from './data.js?v=1';
import { deckStickerCanvas, drawDeckStickers } from './stickerart.js?v=1';

const G = 20;               // gravity (a bit strong = snappy)
const STEP = 0.3;           // can roll up a curb this high; taller = wall
const BRAKE = 16;
const GRIND_DROP = 0.12;    // board sits this far below the rail top
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const wrapPi = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const RAG_BOX = new THREE.Box3();
const tF = new THREE.Vector3(), tL = new THREE.Vector3(), tN = new THREE.Vector3(), tX = new THREE.Vector3();
const tM = new THREE.Matrix4(), tQ = new THREE.Quaternion(), tP = new THREE.Vector3(), tS = new THREE.Vector3();

const M = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
// a little action camera (lens on the -x side)
function camModel() {
  const g = new THREE.Group();
  g.add(bx(0.13, 0.1, 0.1, 0x222a33));
  g.add(bx(0.04, 0.07, 0.07, 0x0a0a0e, -0.085, 0, 0));
  g.add(bx(0.03, 0.03, 0.03, 0xff3030, 0, 0.065, 0.03));
  return g;
}
const bx = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); return m; };

// how each grab looks: board lift, board tilt/roll, board shove back, arm angles, how low the skater crouches
const GRABVIS = {
  indy:     { lift: 0.42, rx: 0.1,  rz: 0.3,  bz: 0,     al: -0.5, ar: 0.3,  crouch: 0.8 },
  method:   { lift: 0.5,  rx: 0.5,  rz: 0.9,  bz: 0,     al: -0.4, ar: 0.2,  crouch: 0.8 },
  melon:    { lift: 0.38, rx: 0.2,  rz: -0.5, bz: 0,     al: -0.3, ar: 0.5,  crouch: 0.8 },
  stale:    { lift: 0.4,  rx: -0.1, rz: 0.7,  bz: -0.1,  al: -0.7, ar: 0.4,  crouch: 0.9 },
  nose:     { lift: 0.3,  rx: -0.5, rz: 0,    bz: 0.25,  al: -0.2, ar: 0.2,  crouch: 0.8 },
  tail:     { lift: 0.3,  rx: 0.5,  rz: 0,    bz: -0.25, al: -0.2, ar: 0.2,  crouch: 0.8 },
  superman: { lift: 0.5,  rx: 0.45, rz: 0,    bz: -0.65, al: -3.0, ar: 3.0,  crouch: 0.05 },
  christ:   { lift: 0.12, rx: 0,    rz: 0,    bz: 0,     al: -1.57, ar: 1.57, crouch: 0.0 },
};
// name, points for starting it, points per second while held
const GRABS = {
  indy: ['Indy Grab', 100, 60], method: ['Method', 180, 110], melon: ['Melon', 160, 90], stale: ['Stalefish', 200, 100],
  nose: ['Nose Grab', 150, 80], tail: ['Tail Grab', 150, 80], superman: ['Superman', 350, 150], christ: ['Christ Air', 300, 130],
};
// grind switches: name, points, board roll, board pitch
const GRINDS = {
  smith:   ['Smith Grind', 200, 0.5, 0], feeble: ['Feeble Grind', 200, -0.5, 0], crooked: ['Crooked Grind', 260, 0.3, -0.35],
  tail:    ['Tailslide', 220, 0, 0.4], lip: ['Lipslide', 260, 0.3, 0],
};

// the board model: deck, wheels (or snowboard bindings) + the two sticker layers (top and underneath)
export function stickerDims(snow) { return snow ? { len: 1.5, wid: 0.44 } : { len: 1.1, wid: 0.34 }; }
export function refreshStickers(b, list) {
  const st = b.userData.stk; if (!st) return;
  for (const side of ['top', 'bot']) { drawDeckStickers(st[side].canvas, list || [], side); st[side].tex.needsUpdate = true; }
}
export function buildBoard(c) {
  const b = new THREE.Group(); b.rotation.order = 'YXZ';
  if (c.snow) {
    // SNOWBOARD (Snow Peak): wide, no wheels or trucks, two bindings that hold the boots
    b.add(bx(0.5, 0.06, 1.7, c.deck, 0, 0.03, 0));
    for (const sz of [1, -1]) {
      const tip = bx(0.5, 0.05, 0.32, c.deck, 0, 0.09, sz * 0.93); tip.rotation.x = -sz * 0.5; b.add(tip);
      b.add(bx(0.34, 0.12, 0.36, 0x23262e, 0, 0.12, sz * 0.38));          // binding base
      b.add(bx(0.3, 0.05, 0.3, 0x3a3f4a, 0, 0.2, sz * 0.38));             // strap
    }
    if (c.stripe != null) b.add(bx(0.12, 0.062, 1.7, c.stripe, 0, 0.03, 0));
  } else {
  b.add(bx(0.38, 0.06, 1.3, c.deck, 0, 0.2, 0));
  b.add(bx(0.34, 0.012, 1.08, 0x2a2a30, 0, 0.235, 0));        // grip tape stops before the kicked nose/tail so it never sticks out over them
  if (c.stripe != null) {       // a bought board: stripe (or rainbow slices) on the underside colour so you see it from the camera
    if (c.art === 'rainbow') [0xff4d4d, 0xff9a3d, 0xffe14d, 0x5be08a, 0x4aa8f0, 0xa56cff].forEach((k, i) => b.add(bx(0.384, 0.062, 0.2, k, 0, 0.197, -0.5 + i * 0.2)));
    else { b.add(bx(0.1, 0.064, 1.28, c.stripe, 0, 0.196, 0)); b.add(bx(0.384, 0.064, 0.1, c.stripe, 0, 0.196, 0.5)); b.add(bx(0.384, 0.064, 0.1, c.stripe, 0, 0.196, -0.5)); }   // stripes sit flush UNDER the top of the deck (top 0.228 < 0.23) so they never poke through next to the grip tape
  }
  const nose = bx(0.38, 0.05, 0.26, c.deck, 0, 0.245, 0.7); nose.rotation.x = -0.4; b.add(nose);
  const tail = bx(0.38, 0.05, 0.26, c.deck, 0, 0.245, -0.7); tail.rotation.x = 0.4; b.add(tail);
  for (const z of [-0.4, 0.4]) {
    b.add(bx(0.3, 0.04, 0.08, 0x9aa0a8, 0, 0.15, z));
    for (const x of [-0.2, 0.2]) {
      // wheels hang UNDER the deck (top of wheel 0.16 < underside of deck 0.17) so they never poke up through the board
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.09, 10), M(c.wheel));
      w.rotation.z = Math.PI / 2; w.position.set(x * 1.12, 0.08, z); b.add(w);
    }
  }
  }
  // sticker layers: flat planes just above the grip tape and just under the deck (you also see them in flips)
  const { len, wid } = stickerDims(c.snow), yTop = c.snow ? 0.0665 : 0.247, yBot = c.snow ? -0.0045 : 0.16;
  b.userData.stk = {};
  for (const side of ['top', 'bot']) {
    const canvas = deckStickerCanvas([], side, wid, len);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.FrontSide }));
    m.rotation.x = side === 'top' ? -Math.PI / 2 : Math.PI / 2; m.position.y = side === 'top' ? yTop : yBot; b.add(m);
    b.userData.stk[side] = { canvas, tex, mesh: m };
  }
  refreshStickers(b, c.stickers);
  return b;
}

export class Skater {
  constructor(world, scene, hooks) {
    this.world = world; this.scene = scene; this.hooks = hooks;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.n = new THREE.Vector3(0, 1, 0);      // surface normal under the board
    this.steepN = new THREE.Vector3(0, 1, 0); this.steepT = 0;
    this.up = new THREE.Vector3(0, 1, 0);     // smoothed "up" for the model
    this.spawn = { ...world.spawn };
    this.safe = { ...world.spawn };
    this.boostT = 0;
    this.rag = null;
    this.stats = computeStats({});
    // blob shadow on the ground
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
    this.root = null;
    this.setCharacter(null);
    this.reset();
  }

  // switch to another park
  setWorld(world) {
    this.world = world;
    this.spawn = { ...world.spawn };
    this.reset();
  }

  can(id) { return this.hooks.can ? this.hooks.can(id) : true; }

  // pick the skater look + the board stats
  setLoadout(parts, char, items = [], boardId = 'classic', vehicle = 'skate', stickers = []) {
    const board = BOARDS.find((b) => b.id === boardId) || BOARDS[0];
    this.vehicle = vehicle;
    this.stickers = stickers;
    // a skater can have a COMBO with one board (Monkey + Bouncy Banana = 150% speed)
    this.comboOn = !!(char && char.combo && char.combo.board === board.id);
    this.comboText = this.comboOn ? char.combo.text : '';
    this.stats = computeStats(parts, mergePerks(mergePerks(char && char.perk, board.perk), this.comboOn ? char.combo.perk : {}), items);
    this.savesLeft = this.stats.saves;
    this.setCharacter(Skater.look(char, board, vehicle, stickers, items));
  }

  // the skater's look with a bought board swapped in (the "classic" board keeps the skater's own colours).
  // vehicle 'snowboard' (Snow Peak) = no wheels, bindings instead
  static look(char, board, vehicle = 'skate', stickers = [], items = []) {
    const cfg = char ? { ...char.cfg } : null;
    if (cfg && board && board.deck != null) { cfg.deck = board.deck; cfg.wheel = board.wheel; cfg.stripe = board.stripe; cfg.art = board.art; }
    if (cfg && vehicle === 'snowboard') cfg.snow = true;
    if (cfg) cfg.stickers = stickers;
    if (cfg) {                                   // the Action Cam: in your hand, or clipped on the Camera Helmet; Monkey Max holds his on a banana
      const hasCam = items.includes('gopro') || items.includes('gopro2');
      cfg.helmet = items.includes('camhelmet');
      cfg.camera = hasCam ? (cfg.helmet ? 'helmet' : 'hand') : null;
      cfg.bananaCam = !!(char && char.id === 'monkey');
    }
    return cfg;
  }

  // ------------------------------------------------------------ model
  setCharacter(cfg) {
    const c = cfg || { skin: 0xe9b88e, shirt: 0x1fb6a8, shirt2: 0xffffff, pants: 0x2c3e70, shoe: 0xf4f4f4, hat: 'cap', hatColor: 0xffcf3f, hair: 0x5a3a22, deck: 0xff7a2f, wheel: 0xf2f2f2 };
    if (this.root) this.scene.remove(this.root);
    const root = this.root = new THREE.Group();
    this.tilt = new THREE.Group(); root.add(this.tilt);                 // manual pivots at the tail (or nose)
    this.flipG = new THREE.Group(); this.tilt.add(this.flipG);          // body flips spin around the middle of the body
    this.vis = new THREE.Group(); this.flipG.add(this.vis);             // visual yaw (grinds, spins)
    this.tilt.position.set(0, 0, -0.55); this.flipG.position.set(0, 0.9, 0.55); this.vis.position.set(0, -0.9, 0);
    // ---- board (built by buildBoard() so the sticker placer can show the very same board)
    const b = this.boardPivot = buildBoard(c); this.vis.add(b);
    // ---- body. Legs over the board bolts, upper body turned toward the front so you can see more of the skater
    const body = new THREE.Group(); this.vis.add(body);
    this.legMeshes = []; this.shoes = [];
    const mkLeg = (z) => {
      const g = new THREE.Group(); g.position.z = z;
      const leg = bx(0.23, 0.6, 0.25, c.pants); g.add(leg); this.legMeshes.push(leg);
      const shoe = new THREE.Group();
      shoe.add(bx(0.44, 0.12, 0.27, c.shoe, 0, 0, 0));
      shoe.add(bx(0.45, 0.04, 0.28, 0xffffff, 0, -0.07, 0));
      shoe.position.x = -0.08; g.add(shoe); this.shoes.push(shoe);
      body.add(g); return g;
    };
    this.legL = mkLeg(0.32); this.legR = mkLeg(-0.32);
    const up = this.upper = new THREE.Group(); up.position.x = -0.02; up.rotation.y = 0.8; body.add(up);
    this.torso = new THREE.Group(); up.add(this.torso);
    this.torso.add(bx(0.32, 0.6, 0.54, c.shirt));
    this.torso.add(bx(0.335, 0.13, 0.545, c.shirt2, 0, 0.1, 0));        // stripe across the chest and back
    this.torso.add(bx(0.34, 0.12, 0.56, c.pants, 0, -0.3, 0));          // waistband / hips
    if (c.rainbow) {
      const rb = [0xff4d4d, 0xff9a3d, 0xffe14d, 0x5be08a, 0x4aa8f0, 0xa56cff];
      rb.forEach((k, i) => this.torso.add(bx(0.07, 0.1, 0.3, k, 0.19, 0.22 - i * 0.1, 0)));     // mane down the back
      rb.forEach((k, i) => this.torso.add(bx(0.22 - i * 0.02, 0.08, 0.2, k, 0.3 + i * 0.01, -0.34 - i * 0.07, 0)));   // rainbow tail
    }
    if (c.tail) {   // a long curly tail from the back of the hips
      const tl = [[0.2, -0.32, 0.1], [0.3, -0.36, 0.09], [0.4, -0.33, 0.085], [0.46, -0.24, 0.08], [0.47, -0.13, 0.075], [0.42, -0.04, 0.07]];
      for (const [tx, ty, ts] of tl) this.torso.add(bx(ts, ts, ts, c.tailColor != null ? c.tailColor : c.skin, tx, ty, 0));
    }
    this.head = new THREE.Group(); up.add(this.head); this.head.rotation.y = 0.5;
    this.buildHead(this.head, c);
    this.armL = new THREE.Group(); this.armR = new THREE.Group(); up.add(this.armL); up.add(this.armR);
    for (const [g, z] of [[this.armL, 0.38], [this.armR, -0.38]]) {
      g.add(bx(0.16, 0.34, 0.16, c.shirt, 0, -0.17, 0));
      g.add(bx(0.15, 0.2, 0.15, c.skin, 0, -0.44, 0));
      g.position.z = z;
    }
    if (c.camera === 'hand') {                  // holding the camera in your left hand (the one you see from the usual camera)
      if (c.bananaCam) {                        // Monkey Max: the camera is on a BANANA handle
        const P = [[-0.12, -0.46], [-0.25, -0.45], [-0.37, -0.4], [-0.46, -0.31]];
        for (let i = 0; i < 3; i++) {
          const dx = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1];
          const seg = bx(Math.hypot(dx, dy) + 0.02, 0.075, 0.075, 0xffe14d, (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2, 0);
          seg.rotation.z = Math.atan2(dy, dx); this.armL.add(seg);
        }
        this.armL.add(bx(0.05, 0.05, 0.05, 0x5a3a14, -0.095, -0.46, 0));            // brown banana stem at the hand end
        const cm = camModel(); cm.rotation.y = Math.PI; cm.position.set(-0.55, -0.26, 0); this.armL.add(cm);     // lens turned back at the skater (selfie style)
      } else {
        const cm = camModel(); cm.position.set(-0.14, -0.46, 0); this.armL.add(cm);
      }
    }
    this.scene.add(root);
    this.pose(0, null, 0);
  }

  buildHead(h, c) {
    h.add(bx(0.4, 0.4, 0.4, c.skin));
    // face on the -x side
    const hat = c.hat;
    if (hat !== 'robot' && hat !== 'monkey') {          // (the robot and the monkey have their own faces below, the plain face would poke through them)
      h.add(bx(0.03, 0.07, 0.05, 0x1a1a1a, -0.205, 0.04, 0.09));
      h.add(bx(0.03, 0.07, 0.05, 0x1a1a1a, -0.205, 0.04, -0.09));
      h.add(bx(0.03, 0.035, 0.12, 0x7a3a2a, -0.205, -0.1, 0));
    }
    if (c.helmet) {                              // Camera Helmet (stops above the eyes); the camera clips on top if you own one
      h.add(bx(0.56, 0.23, 0.56, 0xd9433b, 0, 0.215, 0));
      h.add(bx(0.14, 0.235, 0.58, 0xffffff, 0, 0.215, 0));
      if (c.camera === 'helmet') { h.add(bx(0.1, 0.04, 0.12, 0x9aa0a8, -0.1, 0.35, 0)); const cm = camModel(); cm.position.set(-0.12, 0.42, 0); h.add(cm); }
    }
    if (c.longHair) h.add(bx(0.1, 0.46, 0.44, c.hair, 0.23, -0.1, 0));     // long hair down the back
    if (hat === 'pigtails') {
      h.add(bx(0.43, 0.12, 0.43, c.hair, 0, 0.2, 0));
      h.add(bx(0.12, 0.2, 0.43, c.hair, -0.18, 0.12, 0));                     // fringe
      for (const z of [0.3, -0.3]) {
        h.add(bx(0.1, 0.1, 0.1, c.hatColor, 0.02, 0.1, z * 0.86));            // hair tie
        h.add(bx(0.14, 0.38, 0.14, c.hair, 0.04, -0.12, z));                  // pigtail
        h.add(bx(0.16, 0.08, 0.16, c.hatColor, 0.04, -0.34, z));              // pigtail end
      }
    } else if (hat === 'bow') {
      h.add(bx(0.43, 0.12, 0.43, c.hair, 0, 0.2, 0));
      h.add(bx(0.12, 0.2, 0.43, c.hair, -0.18, 0.12, 0));
      h.add(bx(0.14, 0.14, 0.14, c.hatColor, 0.02, 0.36, 0.16));            // big bow: knot + two wings
      h.add(bx(0.16, 0.22, 0.2, c.hatColor, 0.02, 0.38, 0.32)); h.add(bx(0.16, 0.22, 0.2, c.hatColor, 0.02, 0.38, 0.0));
      h.add(bx(0.06, 0.06, 0.06, 0xffffff, -0.06, 0.4, 0.16));
    } else if (hat === 'cap') {
      h.add(bx(0.43, 0.14, 0.43, c.hatColor, 0, 0.2, 0));
      h.add(bx(0.24, 0.04, 0.34, c.hatColor, -0.3, 0.14, 0));
      h.add(bx(0.2, 0.1, 0.43, c.hair, 0.12, 0.08, 0));
    } else if (hat === 'beanie') {
      h.add(bx(0.44, 0.2, 0.44, c.hatColor, 0, 0.22, 0));
      h.add(bx(0.46, 0.06, 0.46, 0xffffff, 0, 0.12, 0));
      h.add(bx(0.12, 0.1, 0.12, 0xffffff, 0, 0.37, 0));
    } else if (hat === 'helmet') {
      h.add(bx(0.5, 0.46, 0.5, c.hatColor, 0, 0.06, 0));
      h.add(bx(0.06, 0.24, 0.4, c.visor || 0xffb340, -0.25, 0.04, 0));
      h.add(bx(0.1, 0.1, 0.1, 0xd9433b, 0.28, 0.0, 0));
    } else if (hat === 'headband') {
      h.add(bx(0.43, 0.14, 0.43, c.hair, 0, 0.19, 0));
      h.add(bx(0.435, 0.07, 0.435, c.hatColor, 0, 0.1, 0));
      h.add(bx(0.06, 0.2, 0.08, c.hatColor, 0.26, 0.0, 0.08));
      h.add(bx(0.06, 0.16, 0.08, c.hatColor, 0.26, -0.04, -0.08));
    } else if (hat === 'robot') {
      h.add(bx(0.44, 0.44, 0.44, 0x8d99a6, 0, 0, 0));
      h.add(bx(0.03, 0.08, 0.34, c.hatColor, -0.225, 0.05, 0));
      h.add(bx(0.02, 0.05, 0.06, 0xffffff, -0.245, 0.05, 0.09)); h.add(bx(0.02, 0.05, 0.06, 0xffffff, -0.245, 0.05, -0.09));   // eyes on the visor
      h.add(bx(0.02, 0.04, 0.2, 0x333b44, -0.232, -0.1, 0));                                                              // mouth grille
      h.add(bx(0.04, 0.12, 0.04, 0x555e68, 0, 0.28, 0));       // antenna rod starts inside the head top (0.22) and ends under the ball
      h.add(bx(0.1, 0.1, 0.1, 0xd9433b, 0, 0.39, 0));
      h.add(bx(0.1, 0.16, 0.1, 0x555e68, 0, 0, 0.26)); h.add(bx(0.1, 0.16, 0.1, 0x555e68, 0, 0, -0.26));
    } else if (hat === 'monkey') {
      h.add(bx(0.43, 0.1, 0.43, c.hair, 0, 0.2, 0));                                           // dark fur on top
      h.add(bx(0.03, 0.26, 0.3, c.hatColor, -0.215, -0.02, 0));                                // light face patch
      h.add(bx(0.02, 0.06, 0.05, 0x1a1208, -0.235, 0.05, 0.08)); h.add(bx(0.02, 0.06, 0.05, 0x1a1208, -0.235, 0.05, -0.08));   // eyes
      h.add(bx(0.07, 0.1, 0.2, 0xd8a870, -0.245, -0.08, 0));                                   // muzzle
      h.add(bx(0.02, 0.025, 0.12, 0x4a2a14, -0.282, -0.11, 0));                                // mouth
      for (const z of [0.25, -0.25]) { h.add(bx(0.07, 0.15, 0.15, c.skin, 0.02, 0.04, z)); h.add(bx(0.075, 0.09, 0.02, c.hatColor, 0.0, 0.04, z * 1.27)); }   // round ears with light insides
    } else if (hat === 'monkeyhood') {
      // monkey onesie hood: brown hood round a normal face, round ears with light insides
      h.add(bx(0.47, 0.12, 0.47, c.hatColor, 0, 0.25, 0));
      h.add(bx(0.1, 0.46, 0.47, c.hatColor, 0.23, 0.02, 0));
      h.add(bx(0.3, 0.46, 0.06, c.hatColor, 0.05, 0.02, 0.23)); h.add(bx(0.3, 0.46, 0.06, c.hatColor, 0.05, 0.02, -0.23));
      h.add(bx(0.06, 0.1, 0.4, c.hatColor, -0.2, 0.2, 0));                                      // front rim of the hood above the face
      for (const z of [0.2, -0.2]) { h.add(bx(0.08, 0.15, 0.15, c.hatColor, 0.03, 0.36, z)); h.add(bx(0.085, 0.09, 0.02, 0xe8c39a, 0.0, 0.36, z * 1.4)); }
    } else if (hat === 'ears') {
      h.add(bx(0.43, 0.1, 0.43, c.hatColor, 0, 0.2, 0));
      h.add(bx(0.12, 0.16, 0.12, c.hatColor, 0, 0.32, 0.15)); h.add(bx(0.12, 0.16, 0.12, c.hatColor, 0, 0.32, -0.15));
      h.add(bx(0.03, 0.06, 0.3, c.hair, -0.22, 0.2, 0));
      h.add(bx(0.03, 0.04, 0.1, c.hair, -0.215, 0.1, 0.17)); h.add(bx(0.03, 0.04, 0.1, c.hair, -0.215, 0.1, -0.17));
    } else if (hat === 'crown') {
      h.add(bx(0.43, 0.1, 0.43, c.hair, 0, 0.19, 0));
      h.add(bx(0.44, 0.1, 0.44, c.hatColor, 0, 0.27, 0));
      for (const [x, z] of [[-0.15, 0.15], [-0.15, -0.15], [0.15, 0.15], [0.15, -0.15], [0, 0]]) h.add(bx(0.09, 0.14, 0.09, c.hatColor, x, 0.39, z));
      h.add(bx(0.06, 0.06, 0.06, 0xd9433b, -0.22, 0.27, 0));
    } else if (hat === 'unicorn') {
      // unicorn onesie hood: white hood, gold horn, pink ears, rainbow mane down the back
      h.add(bx(0.47, 0.12, 0.47, c.hatColor, 0, 0.25, 0));
      h.add(bx(0.1, 0.46, 0.47, c.hatColor, 0.23, 0.02, 0));
      h.add(bx(0.3, 0.46, 0.06, c.hatColor, 0.05, 0.02, 0.23)); h.add(bx(0.3, 0.46, 0.06, c.hatColor, 0.05, 0.02, -0.23));
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 6), M(0xffd34e)); horn.position.set(-0.08, 0.52, 0); horn.rotation.z = 0.35; h.add(horn);
      h.add(bx(0.1, 0.16, 0.1, c.hatColor, 0.0, 0.38, 0.17)); h.add(bx(0.1, 0.16, 0.1, c.hatColor, 0.0, 0.38, -0.17));
      h.add(bx(0.05, 0.1, 0.06, 0xff8ad8, -0.03, 0.38, 0.17)); h.add(bx(0.05, 0.1, 0.06, 0xff8ad8, -0.03, 0.38, -0.17));
      const rb = [0xff4d4d, 0xff9a3d, 0xffe14d, 0x5be08a, 0x4aa8f0, 0xa56cff];
      rb.forEach((k, i) => h.add(bx(0.1, 0.09, 0.34, k, 0.3, 0.26 - i * 0.09, 0)));
    } else {
      h.add(bx(0.43, 0.12, 0.43, c.hair, 0, 0.2, 0));
    }
  }

  // crouch 0..1; grab = an entry of GRABVIS (or null), gw = how much of it (0..1)
  pose(crouch, grab, gw) {
    const s = 1 - 0.34 * crouch;
    const hip = 0.3 + 0.62 * s;
    for (const m of this.legMeshes) m.scale.y = s;
    for (const g of [this.legL, this.legR]) { g.position.y = 0.3 + 0.31 * s; g.position.x = -0.02; }
    for (const sh of this.shoes) sh.position.y = -0.31 * s - 0.02;
    this.torso.position.set(-0.05 * crouch, hip + 0.3 - 0.04 * crouch, 0);
    this.head.position.set(-0.08 * crouch, hip + 0.82 - 0.06 * crouch, 0);
    for (const a of [this.armL, this.armR]) a.position.set(0, hip + 0.55 - 0.04 * crouch, a.position.z);
    const al = grab ? -1.15 * (1 - gw) + grab.al * gw : -1.15, ar = grab ? 1.15 * (1 - gw) + grab.ar * gw : 1.15;
    this.armL.rotation.x = al; this.armR.rotation.x = ar;
  }

  // ------------------------------------------------------------ setup state
  reset() {
    this.clearRagdoll();
    this.root.visible = true;
    this.pos.set(this.spawn.x, 0, this.spawn.z);
    this.vel.set(0, 0, 0);
    this.heading = this.spawn.h;
    this.safe = { ...this.spawn };
    this.safeT = 0;
    this.state = 'ground';
    this.n.set(0, 1, 0); this.up.set(0, 1, 0);
    this.jumpBuf = 0; this.jumpHold = 0; this.jumped = false; this.sinceGround = 0;
    this.fakieT = 0; this.visualYaw = 0; this.visualYawTarget = 0;
    this.manual = false; this.manualT = 0; this.manualPitch = 0; this.manualDir = 1; this.manualName = 'Manual';
    this.comboGrace = 0; this.squash = 0; this.steerLean = 0;
    this.grind = null; this.grindCool = 0; this.grab = 0; this.grabType = null; this.lastGrab = 'indy';
    this.gStyle = { roll: 0, pitch: 0 };
    this.resetAir();
    this.bailT = 0; this.bailReason = ''; this.boostT = 0;
    this.savesLeft = this.stats.saves || 0;   // Lucky Horseshoe / Guardian Angel: fresh saves every run
    this.loop = null; this.loopMsgT = 0;
    this.loopUp = new THREE.Vector3(0, 1, 0); this.loopFwd = new THREE.Vector3(1, 0, 0);
  }

  // ------------------------------------------------------------ LOOP-DE-LOOP (a scripted ride around a vertical circle)
  startLoop(def, speed) {
    this.state = 'loop'; this.resetAir(); this.manual = false; this.jumped = false; this.jumpBuf = 0;
    this.loop = { def, th: 0, speed: Math.max(speed, 17) };
    this.hooks.onTrick('Loop-de-loop!', 500);
    if (this.hooks.onLoop) this.hooks.onLoop();
  }

  frameLoop(dt) {
    const L = this.loop, d = L.def, TAU = Math.PI * 2;
    L.th = Math.min(TAU, L.th + (L.speed / d.R) * dt);
    const th = L.th, s = Math.sin(th), c = Math.cos(th), f = th / TAU;
    this.pos.set(d.x + d.dx * d.R * s + d.lx * d.lat * f, d.R * (1 - c), d.z + d.dz * d.R * s + d.lz * d.lat * f);
    this.loopUp.set(-d.dx * s, c, -d.dz * s);
    this.loopFwd.set(d.dx * c + d.lx * d.lat / (TAU * d.R), s, d.dz * c + d.lz * d.lat / (TAU * d.R)).normalize();
    this.vel.copy(this.loopFwd).multiplyScalar(L.speed);
    this.heading = Math.atan2(d.dx, d.dz);
    this.hooks.onPoints('Loop', 60 * dt);
    if (th >= TAU) {                                   // back on the ground, rolling out
      this.pos.y = 0;
      this.vel.set(d.dx * L.speed, 0, d.dz * L.speed);
      this.state = 'ground'; this.n.set(0, 1, 0); this.loop = null; this.comboGrace = 0.6;
      this.grindCool = 0.3;
    }
  }

  // a speed power-up disc: go faster for a few seconds
  boost() {
    this.boostT = 4;
    const sp = this.speed;
    if (sp > 0.5) { const k = (sp + 6) / sp; this.vel.x *= k; this.vel.z *= k; }
    else { this.vel.x += Math.sin(this.heading) * 6; this.vel.z += Math.cos(this.heading) * 6; }
  }

  resetAir() {
    this.flip = 0; this.flipTarget = 0; this.flipN = 0; this.flipDir = 1;
    this.shove = 0; this.shoveTarget = 0; this.shoveN = 0;
    this.imp = 0; this.impTarget = 0;
    this.bodyFlip = 0; this.bodyTarget = 0;
    this.spinVel = 0; this.spinTotal = 0;
    this.airTime = 0; this.airDone = new Set();
    this.grabType = null;
  }

  respawn() {
    this.clearRagdoll();
    this.root.visible = true;
    if (!this.spotSafe(this.safe.x, this.safe.z)) this.safe = { ...this.spawn };         // never come back on a rail / lava / acid
    this.pos.set(this.safe.x, 0, this.safe.z);
    this.heading = this.safe.h;
    this.graceT = 2;                                                                       // 2 s where rails, lava and acid cannot hurt you
    this.vel.set(Math.sin(this.heading) * 5, 0, Math.cos(this.heading) * 5);
    this.state = 'ground'; this.n.set(0, 1, 0); this.up.set(0, 1, 0);
    this.jumpBuf = 0; this.jumped = false; this.manual = false; this.grind = null;
    this.visualYaw = 0; this.visualYawTarget = 0; this.comboGrace = 0;
    this.resetAir();
  }

  // ------------------------------------------------------------ per frame
  update(dt, inp) {
    if (this.state === 'bail') {
      this.bailT -= dt; this.stepRagdoll(dt);
      if (this.bailT <= 0) this.respawn();
      return;
    }
    if (inp.olliePressed) this.jumpBuf = 0.14; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.boostT = Math.max(0, this.boostT - dt);
    this.updateZones(dt);
    if (this.state === 'bail') return;

    if (this.state === 'ground') this.frameGround(dt, inp);
    else if (this.state === 'air') this.frameAir(dt, inp);
    else if (this.state === 'grind') this.frameGrind(dt, inp);
    else if (this.state === 'loop') this.frameLoop(dt);

    this.grindCool = Math.max(0, this.grindCool - dt);
    this.loopMsgT = Math.max(0, this.loopMsgT - dt);
    if (inp.grind && this.state !== 'grind' && this.state !== 'loop' && this.grindCool <= 0) this.tryGrind();

    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n && this.state !== 'bail' && this.state !== 'loop'; i++) {
      if (this.state === 'grind') this.stepGrind(h); else this.step(h, inp);
    }
    this.updateVisual(dt, inp);
  }

  // is this spot a good place to come back after a bail? (not near a rail you can hit, not near lava or acid)
  spotSafe(x, z) {
    const w = this.world;
    for (const q of w.hazards || []) if ((q.type === 'lava' || q.type === 'acid') && Math.abs(x - q.x) < q.w / 2 + 5 && Math.abs(z - q.z) < q.d / 2 + 5) return false;
    for (const ch of w.hurt || []) {
      const dx = x - ch.cx, dz = z - ch.cz, rr = Math.sqrt(ch.rad2) + 7;
      if (dx * dx + dz * dz > rr * rr) continue;
      for (const r of ch.segs) {
        const sx = r.b.x - r.a.x, sz = r.b.z - r.a.z, t = clamp(((x - r.a.x) * sx + (z - r.a.z) * sz) / (sx * sx + sz * sz), 0, 1);
        if (Math.hypot(x - (r.a.x + sx * t), z - (r.a.z + sz * t)) < 6) return false;
      }
    }
    return true;
  }

  // hazards on the floor: ice (slide), sand/goo (slow), lava (bail), acid (-10,000 points), bounce pad, speed strip, low gravity
  updateZones(dt) {
    this.graceT = Math.max(0, (this.graceT || 0) - dt); this.acidCool = Math.max(0, (this.acidCool || 0) - dt);
    this.zIce = 0; this.zSlow = 0; this.zLowG = 0;
    this.padCool = Math.max(0, (this.padCool || 0) - dt); this.hazMsgT = Math.max(0, (this.hazMsgT || 0) - dt);
    const hz = this.world.hazards;
    if (!hz || !hz.length || this.state === 'loop' || this.state === 'grind') return;
    const p = this.pos, onGround = this.state === 'ground';
    for (const q of hz) {
      if (Math.abs(p.x - q.x) > q.w / 2 || Math.abs(p.z - q.z) > q.d / 2) continue;
      const t = q.type;
      if (t === 'lowg') { this.zLowG = 1; if (this.hazMsgT <= 0 && this.lastHaz !== t) this.note(t); }
      else if (!onGround) continue;
      else if (t === 'ice') { this.zIce = 1; this.note(t); }
      else if (t === 'sand') { this.zSlow = 2.2; this.note(t); }
      else if (t === 'goo') { this.zSlow = 3.4; this.note(t); }
      else if (t === 'lava') { if (this.graceT > 0) continue; this.bail('Lava! Jump over it!'); return; }
      else if (t === 'acid') {
        if (this.graceT <= 0 && this.acidCool <= 0 && p.y < q.y && Math.hypot(p.x - q.x, p.z - q.z) < q.r) { this.acidCool = 3; if (this.hooks.onAcid) this.hooks.onAcid(); }
      }
      else if (t === 'bounce' && this.padCool <= 0 && Math.hypot(p.x - q.x, p.z - q.z) < q.w / 2) {
        this.vel.y = 17; this.startAir(); this.padCool = 0.5; this.note(t, true); return;
      } else if (t === 'boost' && this.padCool <= 0 && this.boostT < 0.6) { this.boost(); this.padCool = 1; this.note(t, true); }
    }
    if (!this.zIce && !this.zSlow && !this.zLowG) this.lastHaz = null;
  }
  note(t, force) {
    if (this.hazMsgT > 0 && !force) return;
    if (!force && this.lastHaz === t) return;
    this.lastHaz = t; this.hazMsgT = 2.5;
    if (this.hooks.onHazard) this.hooks.onHazard(t);
  }

  frameGround(dt, inp) {
    this.sinceGround = 0;
    const st = this.stats;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const rate = (speed < 0.5 ? 1.6 : 1.5 + 1.4 * (1 - clamp(speed / 14, 0, 1))) * st.turn;
    this.heading -= inp.x * rate * dt;
    this.steerLean += (inp.x - this.steerLean) * (1 - Math.exp(-10 * dt));
    // rolling backwards for a bit (e.g. after a ramp)? turn around
    const sF = this.vel.x * Math.sin(this.heading) + this.vel.z * Math.cos(this.heading);
    if (sF < -2 && !this.manual) {
      this.fakieT += dt;
      if (this.fakieT > 0.22) { this.heading += Math.PI; this.visualYaw = wrapPi(this.visualYaw - Math.PI); this.fakieT = 0; }
    } else this.fakieT = 0;
    if (this.jumpBuf > 0) { this.ollie(); return; }
    // manual / nose manual
    const wantManual = speed > 3 && (inp.manual || (inp.noseManual && this.can('nosemanual')));
    if (wantManual && !this.manual) {
      this.manual = true; this.manualT = 0;
      this.manualDir = inp.manual ? 1 : -1;
      this.manualName = this.manualDir > 0 ? 'Manual' : 'Nose Manual';
      this.hooks.onTrick(this.manualName, 40);
    }
    if (this.manual) {
      this.manualT += dt;
      this.hooks.onPoints(this.manualName, 70 * dt);
      const held = this.manualDir > 0 ? inp.manual : inp.noseManual;
      if (!held || speed < 2 || this.manualT > 4.5) { this.manual = false; this.comboGrace = 0.25; }
    }
    if (this.comboGrace > 0 && !this.manual) {
      this.comboGrace -= dt;
      if (this.comboGrace <= 0) this.hooks.onBank();
    }
    this.safeT -= dt;
    if (this.safeT <= 0 && Math.abs(this.pos.y) < 0.02 && this.n.y > 0.999 && speed > 1.5
        && this.pos.x > this.world.bounds.minX + 4 && this.pos.x < this.world.bounds.maxX - 4 && this.pos.z > this.world.bounds.minZ + 4 && this.pos.z < this.world.bounds.maxZ - 4) {
      if (this.spotSafe(this.pos.x, this.pos.z)) this.safe = { x: this.pos.x, z: this.pos.z, h: this.heading };
      this.safeT = 0.25;
    }
  }

  frameAir(dt, inp) {
    this.airTime += dt; this.sinceGround += dt;
    if (this.jumpBuf > 0 && this.sinceGround < 0.1 && !this.jumped) { this.ollie(); return; }
    const st = this.stats;
    // spin
    const target = inp.spin * 8.5;
    if (Math.abs(inp.spin) > 0.1) this.spinVel += clamp(target - this.spinVel, -50 * dt, 50 * dt);
    else this.spinVel *= Math.exp(-9 * dt);
    this.heading -= this.spinVel * dt; this.spinTotal += this.spinVel * dt;
    // board tricks
    if (inp.kick) this.pressFlip(1);
    else if (inp.heel) this.pressFlip(-1);
    if (inp.shove) this.pressShove();
    if (inp.imp && this.can('impossible') && Math.abs(this.impTarget - this.imp) < 0.01) { this.impTarget += TAU; this.hooks.onTrick('Impossible', 220); }
    // body flips
    if (Math.abs(this.bodyTarget - this.bodyFlip) < 0.01) {
      if (inp.front && this.can('front')) { this.bodyTarget += TAU; this.hooks.onTrick('Frontflip', 400); }
      else if (inp.backF || (inp.back && this.can('back'))) { this.bodyTarget -= TAU; this.hooks.onTrick('Backflip', 400); }
    }
    const fr = TAU / st.flipTime * dt;
    this.flip += clamp(this.flipTarget - this.flip, -fr, fr);
    this.shove += clamp(this.shoveTarget - this.shove, -dt * Math.PI / 0.4, dt * Math.PI / 0.4);
    this.imp += clamp(this.impTarget - this.imp, -dt * TAU / 0.55, dt * TAU / 0.55);
    this.bodyFlip += clamp(this.bodyTarget - this.bodyFlip, -dt * TAU / 0.6, dt * TAU / 0.6);
    // grabs: need a fresh key press in the air, hold to keep
    if (!this.grabType) {
      for (const id in GRABS) {
        if (inp.grabPressed[id] && this.can(id)) { this.startGrab(id); break; }
      }
    } else if (!inp.grabHeld[this.grabType]) this.grabType = null;
    else this.hooks.onPoints(GRABS[this.grabType][0], GRABS[this.grabType][2] * dt);
  }

  pressFlip(dir) {
    const busy = Math.abs(this.flipTarget - this.flip) > 0.01;
    const multi = this.can('multi');
    if (busy && !(multi && dir === this.flipDir && this.flipN < 3)) return;
    this.flipN++; this.flipDir = dir;
    this.flipTarget += dir * TAU;
    const base = dir > 0 ? 'Kickflip' : 'Heelflip';
    const n = multi ? Math.min(this.flipN, 3) : 1;
    this.hooks.onTrick(n === 1 ? base : (n === 2 ? 'Double ' : 'Triple ') + base, [150, 300, 500][n - 1]);
    this.checkCombos();
  }

  pressShove() {
    const busy = Math.abs(this.shoveTarget - this.shove) > 0.01;
    const multi = this.can('multi');
    if (busy && !(multi && this.shoveN < 2)) return;
    this.shoveN++;
    this.shoveTarget += Math.PI;
    if (this.shoveN >= 2 && multi) this.hooks.onTrick('360 Shove-it', 250); else this.hooks.onTrick('Shove-it', 120);
    this.checkCombos();
  }

  // flip + shove-it together make a named trick
  checkCombos() {
    if (!this.can('varial') || this.flipN < 1 || this.shoveN < 1) return;
    const kick = this.flipDir > 0, big = this.shoveN >= 2;
    const name = kick ? (big ? 'Tre Flip' : 'Varial Kickflip') : (big ? 'Laser Flip' : 'Varial Heelflip');
    if (this.airDone.has(name)) return;
    this.airDone.add(name);
    this.hooks.onTrick(name, big ? 500 : 250);
  }

  startGrab(id) {
    this.grabType = id; this.lastGrab = id;
    if (!this.airDone.has(id)) { this.airDone.add(id); this.hooks.onTrick(GRABS[id][0], GRABS[id][1]); }
  }

  frameGrind(dt, inp) {
    const g = this.grind;
    this.hooks.onPoints(g.name, 220 * dt);
    if (this.jumpBuf > 0) { this.leaveGrind(true); return; }
    if (!inp.grind) { this.leaveGrind(false); return; }
    if (this.can('grindtricks')) {
      let k = null;
      if (inp.kick) k = 'smith'; else if (inp.heel) k = 'feeble'; else if (inp.shove) k = 'crooked';
      else if (inp.grabPressed.indy) k = 'tail'; else if (inp.grabPressed.method) k = 'lip';
      if (k && GRINDS[k][0] !== g.name) {
        g.name = GRINDS[k][0];
        this.hooks.onTrick(g.name, GRINDS[k][1]);
        this.gStyle = { roll: GRINDS[k][2], pitch: GRINDS[k][3] };
        if (k === 'lip') this.visualYawTarget = (this.visualYaw >= 0 ? 1 : -1) * Math.PI / 2; else if (g.base !== 'Boardslide') this.visualYawTarget = 0;
        this.hooks.onGrindStart();
      }
    }
  }

  // ------------------------------------------------------------ actions
  ollie() {
    const wasGrind = this.state === 'grind';
    tN.copy(this.n).multiplyScalar(0.5).addScaledVector(UP, 0.5).normalize();
    if (wasGrind) tN.copy(UP);
    this.vel.addScaledVector(tN, this.stats.pop);
    this.jumpBuf = 0; this.jumped = true; this.jumpHold = 0.26;
    this.manual = false;
    if (this.state !== 'air') { this.state = 'air'; this.resetAir(); this.sinceGround = 0; }
    this.hooks.onOllie();
  }

  startAir() {
    this.state = 'air'; this.resetAir(); this.sinceGround = 0; this.manual = false; this.jumped = false;
  }

  railY(r, s) { return r.a.y + (r.b.y - r.a.y) * (s / r.len); }

  tryGrind() {
    const p = this.pos, v = this.vel;
    const hs = Math.hypot(v.x, v.z);
    if (hs < 2) return;
    let best = null, bt = 0, bd = 1e9;
    // generous: anything within 2.2 m beside you counts, and low things (ledges, boxes) can be hopped onto from the ground
    for (const r of this.world.rails) {
      const dx = r.b.x - r.a.x, dz = r.b.z - r.a.z;
      const t = clamp(((p.x - r.a.x) * dx + (p.z - r.a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const dist = Math.hypot(p.x - (r.a.x + dx * t), p.z - (r.a.z + dz * t));
      const dy = p.y - (this.railY(r, t * r.len) - GRIND_DROP);
      if (dist < 2.2 && dy > -1.7 && dy < 1.1 && dist < bd) {
        const along = v.x * r.dx + v.z * r.dz;
        if (Math.abs(along) < hs * 0.2) continue;
        best = r; bd = dist; bt = t * r.len;
      }
    }
    if (!best) return;
    const r = best;
    const dir = (v.x * r.dx + v.z * r.dz) > 0 ? 1 : -1;
    const railAng = Math.atan2(r.dx * dir, r.dz * dir);
    const diff = Math.abs(wrapPi(this.heading - railAng));
    let name = '50-50 Grind', pts = 150, vis = 0;
    if (diff > 1.0 && diff < 2.1) { name = 'Boardslide'; pts = 250; vis = (wrapPi(this.heading - railAng) > 0 ? 1 : -1) * Math.PI / 2; }
    else if ((diff >= 0.5 && diff <= 1.0) || (diff >= 2.1 && diff < Math.PI - 0.5)) { name = 'Nosegrind'; pts = 200; }
    this.visualYaw = wrapPi(this.heading - railAng + this.visualYaw);
    this.heading = railAng;
    this.visualYawTarget = vis;
    this.grind = { rail: r, s: bt, dir, speed: Math.max(hs, 6), name, base: name };
    this.gStyle = { roll: 0, pitch: 0 };
    this.state = 'grind'; this.manual = false; this.grabType = null;
    this.flip = this.flipTarget = 0; this.shove = this.shoveTarget = 0; this.imp = this.impTarget = 0; this.bodyFlip = this.bodyTarget = 0;
    this.hooks.onTrick(name, pts);
    this.hooks.onGrindStart();
  }

  leaveGrind(jump) {
    const g = this.grind; if (!g) return;
    const r = g.rail;
    this.vel.set(r.dx * g.dir * g.speed, 0, r.dz * g.dir * g.speed);
    this.visualYawTarget = 0;
    this.grind = null; this.grindCool = 0.4;
    this.startAir();
    if (jump) { this.jumpBuf = 0; this.vel.y = this.stats.pop; this.jumped = true; this.jumpHold = 0.2; this.hooks.onOllie(); }
    else this.vel.y = 1.2 + Math.max(0, (r.b.y - r.a.y) / r.len * g.dir * g.speed);
  }

  // ------------------------------------------------------------ physics step
  stepGrind(h) {
    const g = this.grind;
    let r = g.rail;
    g.speed = Math.max(0, g.speed - this.stats.grindDecay * h);
    g.s += g.dir * g.speed * h;
    // curved rails are chains of short rails: carry on onto the next piece (and turn to follow the curve)
    let guard = 0;
    while (g.s > r.len && r.next && guard++ < 6) { g.s -= r.len; r = r.next; }
    while (g.s < 0 && r.prev && guard++ < 6) { r = r.prev; g.s += r.len; }
    if (r !== g.rail) { g.rail = r; this.heading = Math.atan2(r.dx * g.dir, r.dz * g.dir); }
    const y = r.a.y + (r.b.y - r.a.y) * clamp(g.s / r.len, 0, 1) - GRIND_DROP;
    this.pos.set(r.a.x + r.dx * g.s, y, r.a.z + r.dz * g.s);
    if (g.s < -0.1 || g.s > r.len + 0.1 || g.speed < 2.2) { this.leaveGrind(false); return; }
    this.vel.set(r.dx * g.dir * g.speed, 0, r.dz * g.dir * g.speed);
    this.n.set(0, 1, 0);
  }

  step(h, inp) {
    const w = this.world, v = this.vel, p = this.pos, st = this.stats, bd = w.bounds;
    const bm = this.boostT > 0 ? 1.6 : 1;
    const pushMax = st.pushMax * bm;
    // MEGA LAUNCH pad: ride over it and you are fired into the sky
    if (this.state === 'ground' && w.launchers) {
      for (const L of w.launchers) {
        if (Math.hypot(p.x - L.x, p.z - L.z) < L.r && v.x * L.dx + v.z * L.dz > 5) {
          v.set(L.dx * L.speed, L.up, L.dz * L.speed);
          this.heading = Math.atan2(L.dx, L.dz);
          this.startAir();
          this.hooks.onTrick('Mega Launch', 300);
          if (this.hooks.onLaunch) this.hooks.onLaunch();
          break;
        }
      }
    }
    // LOOP entry: roll fast into the start of a loop and you ride all the way around
    if (this.state === 'ground' && w.loops) {
      for (const d of w.loops) {
        if (Math.hypot(p.x - d.x, p.z - d.z) < 3) {
          const fwdSpeed = v.x * d.dx + v.z * d.dz, hs0 = Math.hypot(v.x, v.z);
          if (fwdSpeed >= 11 && fwdSpeed > hs0 * 0.8) { this.startLoop(d, fwdSpeed); return; }
          if (this.loopMsgT <= 0 && hs0 > 2 && this.hooks.onLoopSlow) { this.loopMsgT = 2; this.hooks.onLoopSlow(); }
        }
      }
    }
    if (this.state === 'ground') {
      const n = this.n;
      tF.set(Math.sin(this.heading), 0, Math.cos(this.heading));
      tF.addScaledVector(n, -tF.dot(n)).normalize();
      tL.crossVectors(n, tF).normalize();
      v.addScaledVector(tL, -v.dot(tL) * Math.min(1, st.grip * h * (this.zIce ? 0.04 : 1)));          // wheels grip sideways (almost none on ice)
      const sF = v.dot(tF);
      if (inp.y > 0.1) {
        if (sF < pushMax) v.addScaledVector(tF, st.pushAcc * (bm > 1 ? 2 : 1) * (this.zIce ? 0.9 : this.zSlow ? 0.5 : 1) * inp.y * h * (1 - clamp(sF / pushMax, 0, 1) * 0.6));
      } else if (inp.y < -0.1) {
        const bk = Math.min(Math.abs(sF), BRAKE * -inp.y * h);
        v.addScaledVector(tF, -Math.sign(sF) * bk);
      } else {
        v.multiplyScalar(Math.exp(-st.rollDrag * (bm > 1 ? 0.2 : 1) * (this.zIce ? 0.05 : 1) * h));
      }
      if (this.zSlow) v.multiplyScalar(Math.exp(-this.zSlow * h));           // sand / goo drags you down
      const sp = v.length();
      v.multiplyScalar(Math.exp(-(0.03 + Math.max(0, sp - (pushMax + 3)) * 0.25 + (this.manual ? 0.15 : 0)) * h));
    }
    // gravity (hold ollie to float up a little longer = bigger jump)
    let gr = G;
    if (this.zLowG && this.state === 'air') gr *= 0.42;                     // low gravity zone: floaty
    if (this.state === 'air' && this.jumpHold > 0) {
      this.jumpHold -= h;
      if (inp.ollieHeld && v.y > 0) gr *= 0.5;
    }
    v.y -= gr * h;

    const ox = p.x, oz = p.z;
    let nx = p.x + v.x * h, ny = p.y + v.y * h, nz = p.z + v.z * h;
    if (nx > bd.maxX - 0.5 || nx < bd.minX + 0.5) { nx = clamp(nx, bd.minX + 0.5, bd.maxX - 0.5); v.x *= -0.1; }
    if (nz > bd.maxZ - 0.5 || nz < bd.minZ + 0.5) { nz = clamp(nz, bd.minZ + 0.5, bd.maxZ - 0.5); v.z *= -0.1; }
    // solid walls (boxes and sides of ramps)
    const hg0 = w.height(nx, nz);
    if (hg0 - ny > STEP) {
      const e = 0.2;
      let gx = w.height(nx - e, nz) - w.height(nx + e, nz), gz = w.height(nx, nz - e) - w.height(nx, nz + e);
      let gl = Math.hypot(gx, gz);
      if (gl < 1e-4) { gx = ox - nx; gz = oz - nz; gl = Math.hypot(gx, gz) || 1; }
      gx /= gl; gz /= gl;
      const into = -(v.x * gx + v.z * gz);
      if (into > 0) {
        if (into > Math.max(12, st.pushMax * 0.92) && this.state === 'ground') { this.bail('Slammed into a wall'); return; }
        v.x += gx * into * 1.15; v.z += gz * into * 1.15;
        if (into > 4) this.hooks.onBonk();
      }
      nx = ox; nz = oz;
    }
    // ground contact
    const hg = w.height(nx, nz);
    if (ny <= hg) {
      w.normal(nx, nz, tN);
      if (this.state === 'air') { if (!this.land(tN)) return; }
      ny = hg;
      const vn = v.dot(tN);
      if (vn < 0) v.addScaledVector(tN, -vn);
      this.n.copy(tN);
      this.trackSteep(tN, h);
      this.state = 'ground'; this.sinceGround = 0; this.jumped = false;
    } else if (this.state === 'ground') {
      if (ny - hg < 0.05 && v.y < 0.8) {      // tiny dip: stay stuck to the ground
        w.normal(nx, nz, tN);
        ny = hg;
        const vn = v.dot(tN); if (vn < 0) v.addScaledVector(tN, -vn);
        this.n.copy(tN);
        this.trackSteep(tN, h);
      } else {                                // rolled off a lip -> in the air
        // off a steep quarter-pipe lip: go mostly UP and drift back toward the ramp (air-to-fakie)
        const nl = this.steepN;
        if (nl.y < 0.5 && v.y > 3 && -(v.x * nl.x + v.z * nl.z) / (Math.hypot(nl.x, nl.z) || 1) < 6.5) {
          const hl = Math.hypot(nl.x, nl.z) || 1;
          const dx = nl.x / hl, dz = nl.z / hl;
          const out = v.x * dx + v.z * dz;
          v.x -= dx * out; v.z -= dz * out;
          v.x *= 0.8; v.z *= 0.8;
          v.x += dx * 1.4; v.z += dz * 1.4;
        }
        this.startAir();
        this.n.set(0, 1, 0);
      }
    }
    p.set(nx, ny, nz);
    this.checkRailHit();
  }

  // running into a free-standing rail (not grinding it) hurts: bail
  checkRailHit() {
    const hr = this.world.hurt;
    if (!hr || this.state === 'grind' || this.state === 'bail' || this.state === 'loop' || this.grindCool > 0 || this.graceT > 0) return;
    const p = this.pos;
    if (Math.abs(this.vel.x) + Math.abs(this.vel.z) < 2) return;
    for (let k = 0; k < hr.length; k++) {
      const ch = hr[k], cx = p.x - ch.cx, cz = p.z - ch.cz;
      if (cx * cx + cz * cz > ch.rad2) continue;
      for (const r of ch.segs) {
        const dx = r.b.x - r.a.x, dz = r.b.z - r.a.z;
        const t = clamp(((p.x - r.a.x) * dx + (p.z - r.a.z) * dz) / (dx * dx + dz * dz), 0, 1);
        if (Math.hypot(p.x - (r.a.x + dx * t), p.z - (r.a.z + dz * t)) < 0.42) {
          const dy = r.a.y + (r.b.y - r.a.y) * t - p.y;
          if (dy > 0.3 && dy < 1.5) { this.bail('Ouch! Smacked into a rail'); return; }
        }
      }
    }
  }

  trackSteep(n, h) {
    this.steepT -= h;
    if (this.steepT <= 0 || n.y < this.steepN.y) { this.steepN.copy(n); this.steepT = 0.07; }
  }

  // returns false if the landing was a bail
  land(n) {
    const v = this.vel, st = this.stats;
    const impact = -v.dot(n);
    const hs = Math.hypot(v.x, v.z);
    let yawErr = 0, dirAng = this.heading;
    if (hs > 2.5) { dirAng = Math.atan2(v.x, v.z); yawErr = Math.abs(wrapPi(this.heading - dirAng)); }
    const yawOK = yawErr < st.yawTol || yawErr > Math.PI - st.yawTol;
    const ft = st.flipTol;
    const flipOK = Math.abs(wrapPi(this.flip)) < ft && Math.abs(wrapPi(this.imp)) < ft && Math.abs(wrapPi(this.bodyFlip)) < ft;
    const shoveOK = Math.abs(wrapPi(this.shove * 2)) / 2 < ft;
    // slow or tiny hops (standing still, a little pop) never bail: a half-finished flip just snaps straight
    const gentle = hs < 3.5 || this.airTime < 0.45;
    const bad = gentle ? null : !yawOK ? 'Crooked landing' : (!flipOK || !shoveOK) ? "Didn't land it" : null;
    if (bad) {
      if (this.savesLeft > 0) {
        // saved by an item: snap the board straight and carry on
        this.savesLeft--;
        const oldH = this.heading;
        this.heading = dirAng;
        this.visualYaw = wrapPi(this.visualYaw + wrapPi(oldH - dirAng));
        yawErr = 0;
        if (this.hooks.onSave) this.hooks.onSave(this.savesLeft);
      } else { this.bail(bad); return false; }
    }
    if (impact > st.impactMax) { this.bail('Too high!'); return false; }
    if (yawErr > Math.PI / 2) { this.heading = dirAng; this.visualYaw = wrapPi(this.visualYaw + Math.PI); }
    const k = Math.round(Math.abs(this.spinTotal) / Math.PI);
    if (k >= 1) this.hooks.onTrick(`${k * 180}`, SPIN_POINTS[Math.min(k, 8)] + Math.max(0, k - 8) * 600);
    this.squash = clamp(impact / 16, 0.15, 0.7);
    this.flip = this.flipTarget = 0; this.shove = this.shoveTarget = 0; this.imp = this.impTarget = 0; this.bodyFlip = this.bodyTarget = 0;
    this.grabType = null;
    this.comboGrace = 0.45;
    this.hooks.onLand(impact);
    return true;
  }

  bail(reason) {
    this.state = 'bail'; this.bailT = 1.5; this.bailReason = reason;
    this.grind = null; this.manual = false;
    this.hooks.onBail(reason);
    this.spawnRagdoll();
  }

  // ------------------------------------------------------------ ragdoll (simple falling blocks)
  spawnRagdoll() {
    this.root.updateMatrixWorld(true);
    this.rag = [];
    const parts = [this.legL, this.legR, this.torso, this.head, this.armL, this.armR, this.boardPivot];
    for (const src of parts) {
      const c = src.clone(true);
      src.matrixWorld.decompose(tP, tQ, tS);
      c.position.copy(tP); c.quaternion.copy(tQ); c.scale.copy(tS);
      this.scene.add(c);
      const spread = src === this.boardPivot ? 1.6 : 1.1;
      this.rag.push({
        obj: c,
        v: new THREE.Vector3(this.vel.x * 0.85 + (Math.random() - 0.5) * spread * 2, Math.max(this.vel.y, 0) * 0.5 + 2 + Math.random() * 3, this.vel.z * 0.85 + (Math.random() - 0.5) * spread * 2),
        w: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        r: src === this.boardPivot ? 0.15 : 0.25,
      });
    }
    this.root.visible = false;
    this.shadow.visible = false;
  }

  stepRagdoll(dt) {
    if (!this.rag) return;
    const w = this.world;
    for (const r of this.rag) {
      r.v.y -= G * dt;
      r.obj.position.addScaledVector(r.v, dt);
      const o = r.obj.position;
      o.x = clamp(o.x, w.bounds.minX, w.bounds.maxX); o.z = clamp(o.z, w.bounds.minZ, w.bounds.maxZ);
      // rotate first, then lift the block so its real lowest corner sits on the highest ground under it (no sinking into slopes)
      const a0 = r.w.length();
      if (a0 > 0.01) { tX.copy(r.w).divideScalar(a0); tQ.setFromAxisAngle(tX, a0 * dt); r.obj.quaternion.premultiply(tQ); }
      r.obj.updateMatrixWorld(true);
      RAG_BOX.setFromObject(r.obj);
      let gh = Math.max(w.height(o.x, o.z), w.height(RAG_BOX.min.x, RAG_BOX.min.z), w.height(RAG_BOX.min.x, RAG_BOX.max.z), w.height(RAG_BOX.max.x, RAG_BOX.min.z), w.height(RAG_BOX.max.x, RAG_BOX.max.z));
      gh = o.y + (gh + 0.02 - RAG_BOX.min.y);
      if (o.y < gh) {
        o.y = gh;
        if (r.v.y < -1.5) r.v.y *= -0.3; else r.v.y = 0;
        const f = Math.exp(-5 * dt); r.v.x *= f; r.v.z *= f; r.w.multiplyScalar(Math.exp(-6 * dt));
      }
    }
    this.pos.copy(this.rag[2].obj.position);
  }

  clearRagdoll() {
    if (this.rag) for (const r of this.rag) this.scene.remove(r.obj);
    this.rag = null;
    this.shadow.visible = true;
  }

  // ------------------------------------------------------------ visuals
  updateVisual(dt, inp) {
    const st = this.state;
    const rate = st === 'ground' ? 16 : 4;
    tN.copy(st === 'ground' ? this.n : st === 'loop' ? this.loopUp : UP);
    this.up.lerp(tN, 1 - Math.exp(-(st === 'loop' ? 40 : rate) * dt)).normalize();
    if (st === 'loop') tF.copy(this.loopFwd); else tF.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    tF.addScaledVector(this.up, -tF.dot(this.up)).normalize();
    tX.crossVectors(this.up, tF).normalize();
    tM.makeBasis(tX, this.up, tF);
    this.root.quaternion.setFromRotationMatrix(tM);
    this.root.position.copy(this.pos);

    this.visualYaw += wrapPi(this.visualYawTarget - this.visualYaw) * (1 - Math.exp(-9 * dt));
    this.vis.rotation.y = this.visualYaw;
    // manual: pivot at the tail, nose manual: pivot at the nose
    this.manualPitch += ((this.manual ? 0.42 : 0) - this.manualPitch) * (1 - Math.exp(-12 * dt));
    const md = this.manualDir;
    this.tilt.position.z = -0.55 * md; this.flipG.position.z = 0.55 * md;
    this.tilt.rotation.x = -md * this.manualPitch;
    this.flipG.rotation.x = this.bodyFlip;
    this.root.rotateZ(-this.steerLean * 0.18 * (st === 'ground' ? 1 : 0));

    this.squash = Math.max(0, this.squash - dt * 4);
    const gv = GRABVIS[this.grabType || this.lastGrab];
    this.grab += ((this.grabType ? 1 : 0) - this.grab) * (1 - Math.exp(-18 * dt));
    let crouch = this.squash;
    if (this.manual) crouch = Math.max(crouch, 0.15);
    if (st === 'air') crouch = Math.max(crouch, 0.3 * (1 - this.grab) + gv.crouch * this.grab);
    if (st === 'grind') crouch = 0.55;
    if (this.jumpBuf > 0 && st === 'ground') crouch = 0.6;
    this.pose(crouch, gv, this.grab);
    const b = this.boardPivot, g = this.grab;
    const gs = st === 'grind' ? this.gStyle : { roll: 0, pitch: 0 };
    b.position.set(0, gv.lift * g, gv.bz * g);
    b.rotation.set(gv.rx * g + this.imp + gs.pitch, this.shove, this.flip + gv.rz * g + gs.roll);
    if (st !== 'bail') {
      const gh = this.world.height(this.pos.x, this.pos.z);
      this.shadow.position.set(this.pos.x, gh + 0.04, this.pos.z);
      const hgt = Math.max(0, this.pos.y - gh);
      const s = Math.max(0.5, 1.15 - hgt * 0.12);
      this.shadow.scale.set(s, s, s);
      this.shadow.material.opacity = Math.max(0.1, 0.3 - hgt * 0.03);
      this.shadow.rotation.set(-Math.PI / 2, 0, 0);
      if (st === 'ground' && this.n.y < 0.99) { this.shadow.lookAt(this.shadow.position.clone().add(this.n)); }
    }
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get spinLabel() {
    if (this.state !== 'air') return '';
    const k = Math.round(Math.abs(this.spinTotal) / Math.PI);
    return k >= 1 ? `${k * 180}°` : '';
  }
}
