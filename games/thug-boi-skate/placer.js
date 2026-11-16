// STICKER PLACER (like the weapon sticker screen in Blockade Ops): your board floats in the shop, you turn the camera
// around it with the mouse and CLICK where each sticker goes. Drag a stuck sticker to move it.
import * as THREE from './three.module.min.js?v=1';
import { buildBoard, refreshStickers, stickerDims } from './skater.js?v=1';
import { STICKERS, RARITY, STICKER_MAX } from './data.js?v=1';
import { stickerCanvas } from './stickerart.js?v=1';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SCALE = 2.6;                 // the board is shown big so it is easy to aim at

export function createPlacer(ctx) {
  // ctx: scene, camera, save, persist, stand ({x,y,z}), getCfg() -> look config, onClose(), sfx(ok)
  const holder = new THREE.Group(); holder.visible = false; holder.scale.setScalar(SCALE); ctx.scene.add(holder);
  let board = null, active = false;
  let stamp = null, sel = -1;
  const view = { yaw: 0.6, pitch: 0.95, dist: 7 };
  let flipT = 0, flipNow = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const imgs = {};
  const img = (id, size) => (imgs[id + size] = imgs[id + size] || stickerCanvas(id, size).toDataURL());

  // hover ghost (shows where the sticker will land)
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, alphaTest: 0.05 }));
  ghost.visible = false; ctx.scene.add(ghost);
  let ghostId = null;

  const list = () => ctx.save.sdeck;
  const owned = () => { const inv = {}; (ctx.save.stickers || []).forEach((id) => { inv[id] = (inv[id] || 0) + 1; }); return inv; };
  const placedCount = (id) => list().filter((p) => p.id === id).length;
  const msg = (t) => { $('plMsg').textContent = t; };

  function rebuild() {
    if (board) holder.remove(board);
    board = buildBoard(ctx.getCfg()); board.position.y = -0.2; holder.add(board);
    refreshStickers(board, list());
  }
  function refresh() { if (board) refreshStickers(board, list()); drawUi(); }

  // ---------------- side panel
  function drawUi() {
    const inv = owned();
    const have = STICKERS.filter((x) => inv[x.id]);
    $('plGrid').innerHTML = have.length ? have.map((x) => {
      const left = inv[x.id] - placedCount(x.id);
      return `<button class="stk ${stamp === x.id ? 'on' : ''} ${left <= 0 ? 'used' : ''}" data-pl-pick="${x.id}" title="${x.name}"><img src="${img(x.id, 48)}" alt=""><em style="color:${RARITY[x.r].color}">${x.name}</em><i>${left}</i></button>`;
    }).join('') : '<div class="ds">No stickers yet. Open a Sticker Box in the shop!</div>';
    $('plCount').textContent = list().length + ' / ' + STICKER_MAX + ' on your board';
    const p = list()[sel];
    $('plSelName').textContent = p ? (STICKERS.find((x) => x.id === p.id) || {}).name + (p.side === 'bot' ? ' (underneath)' : '') : 'none (click a sticker on the board)';
    document.querySelectorAll('#plCtl button[data-pl]').forEach((b) => { if (b.dataset.pl !== 'flip' && b.dataset.pl !== 'clearall') b.disabled = !p; });
  }

  // ---------------- picking points on the deck
  function aim(e) {
    const r = $('placer').getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, ctx.camera);
    const st = board.userData.stk;
    const hit = ray.intersectObjects([st.top.mesh, st.bot.mesh], false)[0];
    if (!hit) return null;
    const side = hit.object === st.top.mesh ? 'top' : 'bot';
    const p = hit.object.worldToLocal(hit.point.clone());       // plane-local: u = x, v = -z (top) / +z (bottom)
    return { side, x: p.x, z: side === 'top' ? -p.y : p.y, point: hit.point, obj: hit.object };
  }
  function stickerAt(h) {
    if (!h) return -1;
    const l = list();
    for (let i = l.length - 1; i >= 0; i--) { const p = l[i]; if (p.side === h.side && Math.hypot(p.x - h.x, p.z - h.z) < p.s * 0.5) return i; }
    return -1;
  }
  function clampToDeck(p) {
    const d = stickerDims(!!ctx.getCfg().snow);
    p.x = clamp(p.x, -d.wid / 2, d.wid / 2); p.z = clamp(p.z, -d.len / 2, d.len / 2);
  }

  // ---------------- mouse
  let drag = null;
  function down(e) {
    if (!active || e.target.closest('.card') || e.button > 0) return;
    const h = aim(e), i = stickerAt(h);
    drag = { x: e.clientX, y: e.clientY, moved: false, mode: i >= 0 ? 'move' : 'orbit' };
    if (i >= 0) { sel = i; drawUi(); }
    try { $('placer').setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  function move(e) {
    if (!active) return;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.mode === 'orbit') {
        view.yaw -= dx * 0.008; view.pitch = clamp(view.pitch + dy * 0.006, -1.1, 1.45);
        drag.x = e.clientX; drag.y = e.clientY;
      } else if (drag.moved) {
        const h = aim(e), p = list()[sel];
        if (h && p && h.side === p.side) { p.x = h.x; p.z = h.z; clampToDeck(p); refreshStickers(board, list()); }
      }
      ghost.visible = false;
      return;
    }
    // hover: show the ghost where the selected sticker would go
    const h = e.target.closest && e.target.closest('.card') ? null : aim(e);
    if (h && stamp && stickerAt(h) < 0) {
      if (ghostId !== stamp) { ghost.material.map = new THREE.CanvasTexture(stickerCanvas(stamp, 128)); ghost.material.map.colorSpace = THREE.SRGBColorSpace; ghost.material.needsUpdate = true; ghostId = stamp; }
      ghost.visible = true;
      ghost.position.copy(h.point);
      h.obj.getWorldQuaternion(ghost.quaternion);
      ghost.translateZ(0.01);
      const sz = 0.2 * SCALE; ghost.scale.set(sz, sz, 1);
    } else ghost.visible = false;
  }
  function up(e) {
    if (!active || !drag) return;
    const d = drag; drag = null;
    try { $('placer').releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (d.mode === 'move') { ctx.persist(); drawUi(); return; }
    if (d.moved) return;
    // a plain click: stick the chosen sticker here
    const h = aim(e);
    if (!h) { sel = -1; drawUi(); return; }
    if (!stamp) { msg('Pick a sticker from your collection first.'); ctx.sfx(false); return; }
    if (list().length >= STICKER_MAX) { msg('Your board is full (' + STICKER_MAX + '). Click a sticker and press REMOVE.'); ctx.sfx(false); return; }
    if (placedCount(stamp) >= (owned()[stamp] || 0)) { msg('All your copies of that sticker are used. Open more boxes!'); ctx.sfx(false); return; }
    const p = { id: stamp, side: h.side, x: h.x, z: h.z, rot: (Math.random() - 0.5) * 0.5, s: 0.2 };
    clampToDeck(p); list().push(p); sel = list().length - 1;
    refresh(); ctx.persist(); ctx.sfx(true); msg('Stuck! Drag it to move it, or use the buttons to resize / turn it.');
  }
  function wheel(e) {
    if (!active || e.target.closest('.card')) return;
    view.dist = clamp(view.dist + Math.sign(e.deltaY) * 0.5, 3.5, 12); e.preventDefault();
  }

  // ---------------- buttons + keys
  function edit(what) {
    const p = list()[sel];
    if (what === 'flip') { flipT = flipT ? 0 : Math.PI; return; }
    if (what === 'clearall') { list().length = 0; sel = -1; refresh(); ctx.persist(); msg('All stickers removed.'); return; }
    if (what === 'done') { close(); return; }
    if (!p) return;
    if (what === 'bigger') p.s = clamp(p.s + 0.02, 0.08, 0.34);
    else if (what === 'smaller') p.s = clamp(p.s - 0.02, 0.08, 0.34);
    else if (what === 'left') p.rot -= 0.2;
    else if (what === 'right') p.rot += 0.2;
    else if (what === 'remove') { list().splice(sel, 1); sel = -1; }
    refresh(); ctx.persist();
  }
  $('placer').addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pl-pick]');
    if (pick) { stamp = pick.dataset.plPick; ghostId = null; msg('Now click on the board where it should go.'); drawUi(); return; }
    const b = e.target.closest('button[data-pl]');
    if (b) edit(b.dataset.pl);
  });
  $('placer').addEventListener('pointerdown', down);
  $('placer').addEventListener('pointermove', move);
  $('placer').addEventListener('pointerup', up);
  $('placer').addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (k === 'q') edit('left'); else if (k === 'e') edit('right');
    else if (k === '=' || k === '+') edit('bigger'); else if (k === '-') edit('smaller');
    else if (k === 'delete' || k === 'backspace') edit('remove');
    else if (k === 'f') edit('flip');
    else if (k === 'escape' || k === 'enter') close();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);

  // ---------------- open / close / per-frame camera
  function open(pickId) {
    active = true; sel = -1; flipT = 0; flipNow = 0; holder.rotation.z = 0;
    { // drop placed stickers you do not own enough copies of (old saves)
      const inv = owned(), seen = {};
      ctx.save.sdeck = ctx.save.sdeck.filter((p) => { seen[p.id] = (seen[p.id] || 0) + 1; return seen[p.id] <= (inv[p.id] || 0); });
    }
    stamp = pickId && (ctx.save.stickers || []).includes(pickId) ? pickId : null;
    holder.position.set(ctx.stand.x, ctx.stand.y + 1.35, ctx.stand.z);
    rebuild(); holder.visible = true;
    msg(stamp ? 'Click on the board where it should go.' : 'Pick a sticker from your collection, then click on the board.');
    drawUi();
  }
  function close() {
    if (!active) return;
    active = false; drag = null; holder.visible = false; ghost.visible = false;
    ctx.persist(); ctx.onClose();
  }
  function update(dt) {
    flipNow += (flipT - flipNow) * (1 - Math.exp(-7 * dt));
    holder.rotation.z = flipNow;
    const c = holder.position, cp = Math.cos(view.pitch);
    ctx.camera.position.set(c.x + Math.sin(view.yaw) * cp * view.dist, Math.max(0.5, c.y + Math.sin(view.pitch) * view.dist), c.z + Math.cos(view.yaw) * cp * view.dist);
    ctx.camera.lookAt(c);
    if (ctx.camera.fov !== 45) { ctx.camera.fov = 45; ctx.camera.updateProjectionMatrix(); }
  }

  return { open, close, update, get active() { return active; } };
}
