// The rocket bubble: a little round window with a tiny rocket in it. The rocket tilts like the real one, so you can SEE where it points.
// A green arrow shows the way you are really flying; a pink arrow shows where a planned boost goes.
import * as THREE from './three.module.min.js';
import { V, Q } from './vec.js?v=2';

const S = 200;
function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, '#8be07a'); gr.addColorStop(1, '#4fb85a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3;
  for (const r of [40, 80, 118]) { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); }
  g.beginPath(); g.moveTo(128, 8); g.lineTo(128, 248); g.moveTo(8, 128); g.lineTo(248, 128); g.stroke();
  g.fillStyle = '#ffffff'; g.font = '900 30px Trebuchet MS, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', 128, 24); g.fillText('S', 128, 232); g.fillText('E', 232, 128); g.fillText('W', 24, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Bubble {
  constructor(renderer, canvas) {
    this.r = renderer; this.cv = canvas; canvas.width = canvas.height = S; this.cx = canvas.getContext('2d'); this.img = this.cx.createImageData(S, S);
    this.rt = new THREE.WebGLRenderTarget(S, S, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
    this.buf = new Uint8Array(S * S * 4); this.skip = 0;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xa6e4ff);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(2, 4, 3); this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(3.6, 40), new THREE.MeshBasicMaterial({ map: groundTexture() }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; this.scene.add(ground);
    // the little rocket (nose = +Y, window faces +Z)
    const rk = new THREE.Group();
    const mat = (c) => new THREE.MeshToonMaterial({ color: c });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 20), mat(0xffffff)); rk.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 20), mat(0xff5a7a)); nose.position.y = 1.1; rk.add(nose);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.3, 16), mat(0xffc34a)); bell.position.y = -0.9; rk.add(bell);
    const win = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat(0x7ad8ff)); win.position.set(0, 0.35, 0.27); rk.add(win);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05), mat(0xff7eb6)); const a = i / 3 * Math.PI * 2; f.position.set(Math.sin(a) * 0.4, -0.55, Math.cos(a) * 0.4); f.rotation.y = a; rk.add(f); }
    this.rocket = rk; this.scene.add(rk);
    this.pathArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 2.1, 0x2cf06a, 0.5, 0.36); this.scene.add(this.pathArrow);
    this.burnArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 2.1, 0xff4fd8, 0.5, 0.36); this.scene.add(this.burnArrow);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50); this.camera.position.set(0, 1.5, 6.4); this.camera.lookAt(0, -0.2, 0);
  }
  // world direction -> bubble direction (east is right, up is up, north is away from you)
  map(v, f) { return new THREE.Vector3(V.dot(v, f.east), V.dot(v, f.up), -V.dot(v, f.north)); }
  draw(q, f, pathDir, burnDir, force) {
    if (!force && (this.skip++ % 2)) return;
    const x = this.map(Q.rot(q, [1, 0, 0]), f), y = this.map(Q.rot(q, [0, 1, 0]), f), z = this.map(Q.rot(q, [0, 0, 1]), f);
    this.rocket.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.pathArrow.visible = !!pathDir; if (pathDir) this.pathArrow.setDirection(this.map(pathDir, f).normalize());
    this.burnArrow.visible = !!burnDir; if (burnDir) this.burnArrow.setDirection(this.map(burnDir, f).normalize());
    const r = this.r, prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.rt); r.setClearColor(0xa6e4ff, 1); r.clear(); r.render(this.scene, this.camera);
    r.readRenderTargetPixels(this.rt, 0, 0, S, S, this.buf);
    r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevAlpha);
    const d = this.img.data;
    for (let row = 0; row < S; row++) { const src = (S - 1 - row) * S * 4; d.set(this.buf.subarray(src, src + S * 4), row * S * 4); }
    this.cx.putImageData(this.img, 0, 0);
  }
}
