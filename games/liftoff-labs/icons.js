// Little 3D pictures of every part (for the parts lists) and a spinning big preview for the shop.
import * as THREE from './three.module.min.js';
import { PARTS } from './data.js?v=1';
import { makePart } from './meshes.js?v=1';

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x6a5a7a, 1.15));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, 5, 4); scene.add(d);
}
function framed(def) {
  // part centred, with a bounding sphere so the camera knows how far back to go
  const o = makePart(def, { outlines: true });
  const wrap = new THREE.Group(); wrap.add(o);
  const bb = new THREE.Box3().setFromObject(wrap), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
  o.position.sub(c);
  return { wrap, radius: Math.max(0.5, s.length() / 2) };
}

export class Icons {
  constructor(renderer) {
    this.r = renderer; this.cache = {};
    this.scene = new THREE.Scene(); lights(this.scene);
    this.cam = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
    this.size = 112;
    this.rt = new THREE.WebGLRenderTarget(this.size, this.size, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
    this.buf = new Uint8Array(this.size * this.size * 4);
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = this.size; this.cx = this.cv.getContext('2d');
  }
  get(id) {
    if (this.cache[id]) return this.cache[id];
    const def = PARTS[id], { wrap, radius } = framed(def);
    wrap.rotation.y = def.shape === 'fin' || def.shape === 'leg' || def.shape === 'sidering' ? -0.5 : 0.5;
    this.scene.add(wrap);
    const dist = radius / Math.sin((this.cam.fov * Math.PI / 180) / 2) * 1.12;
    this.cam.position.set(dist * 0.55, dist * 0.2, dist * 0.8); this.cam.lookAt(0, 0, 0);
    const r = this.r, prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear(); r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.buf);
    r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevAlpha);
    this.scene.remove(wrap);
    const img = this.cx.createImageData(this.size, this.size), S = this.size;
    for (let y = 0; y < S; y++) { const src = (S - 1 - y) * S * 4; img.data.set(this.buf.subarray(src, src + S * 4), y * S * 4); }
    this.cx.putImageData(img, 0, 0);
    return (this.cache[id] = this.cv.toDataURL('image/png'));
  }
}

// A part that spins in a box on the page. It is drawn off-screen and copied into a little canvas, so it works inside any panel.
export class Preview {
  constructor(renderer) {
    this.r = renderer; this.scene = new THREE.Scene(); lights(this.scene);
    this.cam = new THREE.PerspectiveCamera(32, 300 / 210, 0.1, 400); this.el = null; this.obj = null; this.t = 0; this.radius = 1;
    this.W = 300; this.H = 210;
    this.rt = new THREE.WebGLRenderTarget(this.W, this.H, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
    this.buf = new Uint8Array(this.W * this.H * 4);
  }
  set(def) {
    if (this.obj) this.scene.remove(this.obj);
    const { wrap, radius } = framed(def); this.obj = wrap; this.radius = radius; this.scene.add(wrap);
  }
  render(dt) {
    if (!this.el || !this.obj) return;
    const c = this.el; if (!this.cx) { c.width = this.W; c.height = this.H; this.cx = c.getContext('2d'); this.img = this.cx.createImageData(this.W, this.H); }
    this.t += dt; this.obj.rotation.y = this.t * 0.8;
    const dist = this.radius / Math.sin((this.cam.fov * Math.PI / 180) / 2) * 1.15;
    this.cam.position.set(0, dist * 0.28, dist * 0.95); this.cam.lookAt(0, 0, 0);
    const r = this.r, prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.rt); r.setClearColor(0x2a2260, 1); r.clear(); r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, this.W, this.H, this.buf);
    r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevAlpha);
    const W = this.W, H = this.H, d = this.img.data;
    for (let y = 0; y < H; y++) { const src = (H - 1 - y) * W * 4; d.set(this.buf.subarray(src, src + W * 4), y * W * 4); }
    this.cx.putImageData(this.img, 0, 0);
  }
}
