// The SKATE SHOP: a little 3D room (brick wall, wood floor, neon sign, a wall of boards, a counter) far away from the parks.
// While you are in the shop screen the parks are hidden and the camera "walks in" through the door.
import * as THREE from './three.module.min.js?v=1';
import { BOARDS } from './data.js?v=1';
import { drawBoard } from './boardart.js?v=1';

export const SHOP_X = 3000;                       // the room lives far east of every park
const W = 20, D = 15, HGT = 5.6;                  // width (x), depth (z), height

const tex = (w, h, draw, rep) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};
const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const bas = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
const box = (g, w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };

export function createShopRoom(scene) {
  const g = new THREE.Group();
  g.position.set(SHOP_X, 0, 0);
  g.visible = false;
  scene.add(g);

  // ---- floor (wood planks), ceiling, walls
  const wood = tex(256, 256, (c, w, h) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = ['#b9824d', '#a9743f', '#c28d57', '#b07a45'][i % 4]; c.fillRect(0, i * h / 8, w, h / 8); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, i * h / 8, w, 2); for (let k = 0; k < 3; k++) c.fillRect(((i * 97 + k * 83) % w), i * h / 8, 2, h / 8); }
  }, [W / 4, D / 4]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lam(0xffffff, { map: wood })); floor.rotation.x = -Math.PI / 2; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lam(0x2a2438)); ceil.rotation.x = Math.PI / 2; ceil.position.y = HGT; g.add(ceil);
  const brick = tex(256, 128, (c, w, h) => {
    c.fillStyle = '#5a2a22'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 5; k++) {
      c.fillStyle = ['#b5523f', '#a64a38', '#c25f48', '#9c4435'][(r * 3 + k) % 4];
      c.fillRect(k * 52 - (r % 2 ? 26 : 0) + 2, r * 16 + 2, 48, 12);
    }
  }, [W / 3.2, HGT / 1.6]);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, HGT), lam(0xffffff, { map: brick })); back.position.set(0, HGT / 2, -D / 2); g.add(back);
  const paint = lam(0x253a5e);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(D, HGT), paint); w.position.set(sx * W / 2, HGT / 2, 0); w.rotation.y = -sx * Math.PI / 2; g.add(w);
    box(g, 0.12, 0.35, D, bas(0xff7a2f), sx * (W / 2 - 0.05), 1.3, 0);               // orange stripe round the room
    box(g, 0.12, 0.12, D, bas(0xffd34e), sx * (W / 2 - 0.05), 1.62, 0);
  }
  // front wall with a doorway (the camera walks in through it)
  const fw = lam(0x253a5e);
  box(g, (W - 5) / 2, HGT, 0.3, fw, -(W / 2 + 2.5) / 2, HGT / 2, D / 2); box(g, (W - 5) / 2, HGT, 0.3, fw, (W / 2 + 2.5) / 2, HGT / 2, D / 2);
  box(g, 5, HGT - 3.4, 0.3, fw, 0, 3.4 + (HGT - 3.4) / 2, D / 2);
  box(g, 0.3, 3.4, 0.5, lam(0xffd34e), -2.5, 1.7, D / 2); box(g, 0.3, 3.4, 0.5, lam(0xffd34e), 2.5, 1.7, D / 2);
  const open = tex(128, 48, (c, w, h) => { c.fillStyle = '#10151f'; c.fillRect(0, 0, w, h); c.font = '900 34px Trebuchet MS, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#35ff9a'; c.shadowColor = '#35ff9a'; c.shadowBlur = 12; c.fillText('OPEN', w / 2, 36); });
  const os = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), bas(0xffffff, { map: open })); os.position.set(0, 3.7, D / 2 - 0.2); os.rotation.y = Math.PI; g.add(os);

  // ---- neon sign on the brick wall
  const sign = tex(1024, 192, (c, w, h) => {
    c.fillStyle = '#120d1f'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.font = '900 120px Trebuchet MS, sans-serif';
    c.shadowColor = '#ff3df0'; c.shadowBlur = 26; c.fillStyle = '#ffd1fa'; c.fillText('SKATE SHOP', w / 2, 132);
    c.shadowBlur = 0; c.strokeStyle = '#00e5ff'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
  });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), bas(0xffffff, { map: sign })); sg.position.set(0, HGT - 1.05, -D / 2 + 0.05); g.add(sg);

  // ---- wall of boards (the real boards from the shop, standing on the wall)
  // two rows. Each board stands ON its shelf bar (bar top = board bottom) and a little IN FRONT of it, so nothing overlaps.
  const rackY = [1.2, 2.85], BH = 1.3;
  for (const y of rackY) box(g, 8.6, 0.12, 0.3, lam(0x6b4423), 0, y - BH / 2 - 0.07, -D / 2 + 0.36);              // shelves (same width as the sign area)
  const per = 5;
  BOARDS.forEach((b, i) => {
    const row = Math.floor(i / per), col = i % per;
    const t = tex(128, 384, (c, w, h) => drawBoard(c, b, w, h, 0xff7a2f));
    t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.anisotropy = 1;           // no dark halo round the cut-out edge
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, BH), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 }));
    m.position.set((col - (per - 1) / 2) * 1.55, rackY[row], -D / 2 + 0.58); g.add(m);        // centred under the sign
  });
  // wheels + shoe boxes on the left wall shelf
  box(g, 0.4, 0.1, 9, lam(0x6b4423), -W / 2 + 0.3, 2.2, -1);
  box(g, 0.7, 0.1, 9, lam(0x6b4423), -W / 2 + 0.45, 1.37, -1);              // lower shelf so the shoe boxes do not float
  const cols = [0xff4d4d, 0xffd34e, 0x35e0b0, 0x4aa8f0, 0xa56cff, 0xff8ad8];
  for (let i = 0; i < 12; i++) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 14), lam(cols[i % 6])); wh.rotation.x = Math.PI / 2; wh.rotation.z = Math.PI / 2;
    wh.position.set(-W / 2 + 0.5, 2.5, -5 + i * 0.7); g.add(wh);
    box(g, 0.5, 0.35, 0.55, lam(cols[(i + 2) % 6]), -W / 2 + 0.5, 1.6, -5 + i * 0.7);
  }
  // posters on the left + right walls
  const poster = (txt, a, b2, x, z, ry) => {
    const t = tex(128, 192, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b2); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 30px Trebuchet MS, sans-serif'; c.textAlign = 'center'; txt.split(' ').forEach((wd, i) => c.fillText(wd, w / 2, 70 + i * 36)); c.lineWidth = 6; c.strokeStyle = '#fff'; c.strokeRect(6, 6, w - 12, h - 12); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.2), bas(0xffffff, { map: t })); m.position.set(x, 3.2, z); m.rotation.y = ry; g.add(m);
  };
  poster('DROP IN', '#ff7a2f', '#7a2bd1', W / 2 - 0.18, -3, -Math.PI / 2);
  poster('NO BAILS', '#35e0b0', '#1f4ea8', W / 2 - 0.18, 0.2, -Math.PI / 2);
  poster('SK8 OR DIE', '#ff3d6e', '#2a1a4a', W / 2 - 0.18, 3.4, -Math.PI / 2);

  // ---- counter with a till (right side, in front of the poster wall)
  box(g, 1.6, 1.1, 7, lam(0x2f4f8f), W / 2 - 1.6, 0.55, 2.5);
  box(g, 1.9, 0.12, 7.3, lam(0xf0e4c8), W / 2 - 1.6, 1.14, 2.5);
  box(g, 0.7, 0.45, 0.7, lam(0x3a3f4a), W / 2 - 1.6, 1.43, 0.8); box(g, 0.5, 0.3, 0.05, bas(0x35ff9a), W / 2 - 2.0, 1.55, 0.8);
  const sale = tex(128, 64, (c, w, h) => { c.fillStyle = '#ffd000'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0172b'; c.font = '900 44px Trebuchet MS, sans-serif'; c.textAlign = 'center'; c.fillText('SALE!', w / 2, 46); });
  box(g, 0.05, 0.5, 0.9, bas(0xffffff, { map: sale }), W / 2 - 2.6, 1.55, 3.8);

  // ---- round display stand in the middle: your skater stands here
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.2, 28), lam(0xd9261c)); stand.position.set(0, 0.1, -1); g.add(stand);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.215, 28), lam(0xffffff)); ring.position.set(0, 0.1, -1); g.add(ring);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.23, 28), lam(0x2b2f3a)); top.position.set(0, 0.1, -1); g.add(top);

  // ---- lights: warm lamps
  g.add(new THREE.HemisphereLight(0xfff0dc, 0x6a5a4a, 1.5));
  for (const [x, z] of [[-5, -3], [5, -3], [0, 3]]) {
    const p = new THREE.PointLight(0xffe2b0, 24, 14, 1.4); p.position.set(x, HGT - 0.8, z); g.add(p);
    box(g, 1.4, 0.12, 0.5, bas(0xfff3c4), x, HGT - 0.1, z);
  }

  const bg = new THREE.Color(0x120d1f);
  return {
    group: g, bg,
    stand: { x: SHOP_X, y: 0.225, z: -1 },
    door: { x: SHOP_X, z: D / 2 + 3 },
    show() { g.visible = true; },
    hide() { g.visible = false; },
  };
}
