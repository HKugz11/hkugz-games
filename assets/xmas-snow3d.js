// Christmas snow inside the 3D games: soft flakes drifting down around the camera (a few hundred points, one draw call).
// Only exists during the Christmas season (assets/xmas.js puts class "xmas" on <html>) and can be switched off with the menu's Snow button.
// Usage in a game's core.js:  const XS = makeXmasSnow(THREE, scene, camera, { box: 36, size: .16, fx: QL.fx });  ...  then XS && XS.update(dt) every frame.
export function makeXmasSnow(THREE, scene, camera, o = {}) {
  if (!document.documentElement.classList.contains('xmas')) return null;
  const box = o.box || 36, size = o.size || .16, n = Math.round(380 * Math.min(1, Math.max(.4, o.fx || 1)));
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
  for (let i = 0; i < n; i++) { pos[i * 3] = camera.position.x + (Math.random() - .5) * box * 2; pos[i * 3 + 1] = camera.position.y + (Math.random() - .3) * box; pos[i * 3 + 2] = camera.position.z + (Math.random() - .5) * box * 2; vel[i * 3] = Math.random() * 6.28; vel[i * 3 + 1] = (1.1 + Math.random() * 1.6) * box / 36; vel[i * 3 + 2] = .3 + Math.random() * .8; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: tex, color: 0xffffff, size, sizeAttenuation: true, transparent: true, opacity: .95, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  const wrap = (d, r) => d > r ? d - 2 * r : d < -r ? d + 2 * r : d;
  const off = () => { try { return localStorage.getItem('hk-xmas-snow') === 'off'; } catch (e) { return false; } };
  let t = 0; const dir = new THREE.Vector3();
  return {
    update(dt) {
      if (off()) { pts.visible = false; return; } pts.visible = true;
      t += dt; camera.getWorldDirection(dir); const cx = camera.position.x + dir.x * box * .5, cy = camera.position.y + dir.y * box * .5, cz = camera.position.z + dir.z * box * .5;
      for (let i = 0; i < n; i++) {
        const k = i * 3; vel[k] += dt * vel[k + 2];
        pos[k] += Math.sin(vel[k]) * dt * .6 * box / 36; pos[k + 1] -= vel[k + 1] * dt;
        pos[k] = cx + wrap(pos[k] - cx, box); pos[k + 1] = cy + wrap(pos[k + 1] - cy, box * .6); pos[k + 2] = cz + wrap(pos[k + 2] - cz, box);
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}
