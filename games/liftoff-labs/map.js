// The map view: float out and look at your orbit, the planet and the moon from far away.
import * as THREE from './three.module.min.js';
import { V, clamp } from './vec.js?v=1';
import { BODIES, beanState } from './data.js?v=1';
import { elements, orbitPoints, positionAtNu, descendingNuAtRadius } from './orbit.js?v=1';

const N = 240;
function lineObj(color, segs) {
  const g = new THREE.BufferGeometry(), a = new Float32Array(segs * 2 * 3);
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }));
  m.frustumCulled = false; m.renderOrder = 5; g.setDrawRange(0, 0);
  return m;
}

export class MapView {
  constructor(view, getW, labelsEl) {
    this.view = view; this.getW = getW; this.labels = labelsEl; this.on = false;
    this.camera = new THREE.PerspectiveCamera(50, 1, 100, 1e10);
    this.scene = new THREE.Scene();
    this.orbit = lineObj(0xffd34e, N); this.moonOrbit = lineObj(0x9aa4c8, 180); this.soi = lineObj(0x6a7298, 90); this.future = lineObj(0x5df0ff, N); this.soi2 = lineObj(0x5df0ff, 90); this.nodeLine = lineObj(0xff6bf0, N);
    this.scene.add(this.orbit, this.moonOrbit, this.soi, this.future, this.soi2, this.nodeLine);
    const dot = (c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false })); m.renderOrder = 8; m.frustumCulled = false; this.scene.add(m); return m; };
    this.nodeDot = dot(0xff6bf0); this.ship = dot(0xffffff); this.apM = dot(0x5df0ff); this.peM = dot(0xff9a3a); this.impact = dot(0xff4d4d);
    this.yaw = 0.6; this.pitch = 0.7; this.dist = 2.4e6; this.minD = 0; this.pool = []; this.tool = null;
    this.focusMain = true; this.t = 0;
  }
  show(on) { this.on = on; if (on) { const W = this.getW(); const v = W.main; this.dist = Math.max(this.dist, BODIES[v.body].R * 3); this.fit(W); } else { this.labels.innerHTML = ''; this.pool = []; } }
  hide() { this.on = false; this.labels.innerHTML = ''; this.pool = []; }
  fit(W) {
    const v = W.main, el = elements(BODIES[v.body].GM, v.r, v.v);
    const far = el.bound ? el.ra : Math.max(V.len(v.r) * 2, BODIES[v.body].R * 3);
    this.dist = clamp(far * 2.6, BODIES[v.body].R * 2.2, 5e7);
  }
  drag(dx, dy) { this.yaw -= dx * 0.006; this.pitch = clamp(this.pitch + dy * 0.006, -1.5, 1.5); }
  zoom(f) { this.dist = clamp(this.dist * f, 2e3, 2e8); }
  label(i, text, pos, color, cam) {
    let d = this.pool[i];
    if (!d) { d = document.createElement('div'); this.labels.appendChild(d); this.pool[i] = d; }
    const p = new THREE.Vector3(pos[0] - cam[0], pos[1] - cam[1], pos[2] - cam[2]).project(this.camera);
    const show = p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
    d.style.display = show ? '' : 'none';
    if (show) { d.textContent = text; d.style.color = color; d.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - p.y) / 2 * innerHeight) + 'px'; }
  }
  // fill a line-segments object with a polyline, leaving gaps where the planet hides it
  polyline(obj, pts, cam, hideBody) {
    const arr = obj.geometry.attributes.position.array; let n = 0;
    const hid = (p) => { if (!hideBody) return false; const o = hideBody; const d = V.sub(p, cam), L = V.len(d); const dn = V.mul(d, 1 / L); const oc = V.sub(cam, o.c); const b = V.dot(oc, dn), c = V.dot(oc, oc) - o.R * o.R; const disc = b * b - c; if (disc < 0) return false; const t = -b - Math.sqrt(disc); return t > 0 && t < L - 1; };
    let prevHid = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (hid(a) || hid(b)) continue;
      arr[n++] = a[0] - cam[0]; arr[n++] = a[1] - cam[1]; arr[n++] = a[2] - cam[2]; arr[n++] = b[0] - cam[0]; arr[n++] = b[1] - cam[1]; arr[n++] = b[2] - cam[2];
    }
    void prevHid;
    obj.geometry.setDrawRange(0, n / 3); obj.geometry.attributes.position.needsUpdate = true;
  }

  frame(W, dt, enc, nb) {
    this.t += dt;
    const v = W.main, body = BODIES[v.body], mu = body.GM, view = this.view;
    const el = elements(mu, v.r, v.v);
    const center = [0, 0, 0];
    const cam = V.add(center, [
      Math.cos(this.pitch) * Math.cos(this.yaw) * this.dist, Math.sin(this.pitch) * this.dist, Math.cos(this.pitch) * Math.sin(this.yaw) * this.dist]);
    this.camera.aspect = innerWidth / innerHeight; this.camera.near = Math.max(50, this.dist * 0.002); this.camera.far = this.dist * 80 + 1e9; this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 0); this.camera.up.set(0, 1, 0);
    this.camera.lookAt(new THREE.Vector3(center[0] - cam[0], center[1] - cam[1], center[2] - cam[2]));
    // orbit of the rocket
    const maxR = this.dist * 6;
    const pts = orbitPoints(el, N, Math.min(maxR, body.soi || maxR), el.nu);
    this.polyline(this.orbit, pts, cam, { c: center, R: body.R });
    // where it is highest and lowest
    const labs = []; let li = 0;
    this.sizeDot(this.ship, v.r, cam, 0.011); this.ship.visible = true;
    labs.push(['Rocket', v.r, '#ffffff']);
    if (el.bound && el.e > 0.002) {
      const ap = positionAtNu(el, Math.PI), pe = positionAtNu(el, 0);
      this.sizeDot(this.apM, ap, cam, 0.008); this.sizeDot(this.peM, pe, cam, 0.008); this.apM.visible = this.peM.visible = true;
      labs.push(['Ap ' + km(el.ra - body.R), ap, '#5df0ff'], ['Pe ' + km(el.rp - body.R), pe, '#ff9a3a']);
    } else { this.apM.visible = this.peM.visible = false; }
    // crash site
    const nuI = el.rp < body.R ? descendingNuAtRadius(el, body.R) : null;
    if (nuI !== null) { const p = positionAtNu(el, nuI); this.sizeDot(this.impact, p, cam, 0.008); this.impact.visible = true; labs.push(['Crash!', p, '#ff6b81']); } else this.impact.visible = false;
    // the moon, its path and its zone of pull
    const bs = beanState(W.ut), cob = BODIES.cobble, bean = BODIES.bean;
    if (v.body === 'cobble') {
      const ring = []; for (let i = 0; i <= 180; i++) { const a = i / 180 * Math.PI * 2; ring.push([bean.orbit.a * Math.cos(a), 0, -bean.orbit.a * Math.sin(a)]); }
      this.polyline(this.moonOrbit, ring, cam, { c: center, R: cob.R });
      const soi = []; const e1 = V.norm(V.cross(bs.r, [0, 1, 0])), e2 = [0, 1, 0]; for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI * 2; soi.push(V.add(bs.r, V.add(V.mul(V.norm(bs.r), Math.cos(a) * bean.soi), V.mul(e2, Math.sin(a) * bean.soi)))); }
      this.polyline(this.soi, soi, cam, null);
      labs.push(['Bean', bs.r, '#d8dcf0'], ['Cobble', center, '#9be0a0']);
    } else {
      this.moonOrbit.geometry.setDrawRange(0, 0);
      const ring = []; for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI * 2; ring.push([bean.soi * Math.cos(a), 0, bean.soi * Math.sin(a)]); }
      this.polyline(this.soi, ring, cam, null);
      labs.push(['Bean', center, '#d8dcf0']);
    }
    this.future.geometry.setDrawRange(0, 0); this.soi2.geometry.setDrawRange(0, 0); this.nodeLine.geometry.setDrawRange(0, 0); this.nodeDot.visible = false;
    if (nb && W.node && W.node.body === v.body) {
      const pts = orbitPoints(nb.el, N, Math.min(maxR, body.soi || maxR), nb.el.nu);
      this.polyline(this.nodeLine, pts, cam, { c: center, R: body.R });
      this.sizeDot(this.nodeDot, nb.pos, cam, 0.009); this.nodeDot.visible = true;
      labs.push(['Burn ' + Math.round(nb.mag) + ' m/s', nb.pos, '#ff9bf6']);
    }
    if (enc && v.body === 'cobble') {
      const bp = enc.beanPos, ptsB = orbitPoints(enc.el, N, bean.soi * 1.02, enc.el.nu).map((p) => V.add(p, bp));
      this.polyline(this.future, ptsB, cam, null);
      const e1 = V.norm(V.cross(bp, [0, 1, 0])), ring2 = []; for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI * 2; ring2.push(V.add(bp, V.add(V.mul(V.norm(bp), Math.cos(a) * bean.soi), V.mul([0, 1, 0], Math.sin(a) * bean.soi)))); } void e1;
      this.polyline(this.soi2, ring2, cam, null);
      labs.push(['Bean encounter', V.add(bp, enc.rel), '#5df0ff'], ['Bean low point ' + km(enc.el.rp - bean.R), V.add(bp, positionAtNu(enc.el, 0)), '#5df0ff']);
    }
    // draw
    const r = view.renderer;
    view.sky.update(this.camera, cam, v.body, W.ut, this.t, view.pixelH, 1);
    r.clear(); view.sky.render(r, this.camera); r.clearDepth(); r.render(this.scene, this.camera);
    labs.forEach((l, i) => this.label(li++, l[0], l[1], l[2], cam));
    for (let i = li; i < this.pool.length; i++) if (this.pool[i]) this.pool[i].style.display = 'none';
  }
  sizeDot(m, pos, cam, k) {
    const d = V.sub(pos, cam), L = V.len(d);
    m.position.set(d[0], d[1], d[2]); m.scale.setScalar(L * k);
  }
}
const km = (m) => (Math.abs(m) < 10000 ? Math.round(m) + ' m' : (m / 1000).toFixed(Math.abs(m) < 1e5 ? 1 : 0) + ' km');
