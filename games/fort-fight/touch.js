// TOUCH CONTROLS - an on-screen joystick, a look pad and buttons for phones and tablets.
// They send the same keyboard and mouse events the games already listen to, so the games barely need to know about touch.
const q = new URLSearchParams(location.search);
export const TOUCH = q.has('touch') ? q.get('touch') !== '0' : (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && !matchMedia('(any-pointer:fine)').matches;
window.__TOUCH = TOUCH;
if (TOUCH) document.documentElement.classList.add('touch');

const CSS = `
html.touch, html.touch body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
#touchUI { position: fixed; inset: 0; z-index: 4; display: none; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
#touchUI.on { display: block; }
#tLook { position: absolute; inset: 0; touch-action: none; }
.tb { position: absolute; border-radius: 50%; background: rgba(255,255,255,.17); border: 3px solid rgba(255,255,255,.55); color: #fff; font: 900 13px "Trebuchet MS", "Segoe UI", sans-serif; display: grid; place-items: center; text-align: center; line-height: 1.05; text-shadow: 0 2px 0 rgba(0,0,0,.65); touch-action: none; letter-spacing: .03em; box-shadow: 0 3px 10px rgba(0,0,0,.3); }
.tb small { display: block; font-size: 9px; opacity: .8; font-weight: 800; }
.tb.fire { background: rgba(255,70,70,.32); border-color: rgba(255,150,150,.95); font-size: 16px; }
.tb.on, .tb.down { background: rgba(255,255,255,.5); transform: scale(.93); }
.tb.fire.down { background: rgba(255,90,90,.6); }
.tb.small { font-size: 11px; background: rgba(10,6,24,.4); }
.tb.glow { border-color: #ffd34e; box-shadow: 0 0 16px rgba(255,211,78,.9); background: rgba(255,211,78,.3); }
html.tplay a.back { display: none; }
#tBase { position: absolute; width: 132px; height: 132px; margin: -66px 0 0 -66px; border-radius: 50%; background: rgba(255,255,255,.12); border: 3px solid rgba(255,255,255,.45); display: none; pointer-events: none; }
#tKnob { position: absolute; width: 58px; height: 58px; margin: -29px 0 0 -29px; border-radius: 50%; background: rgba(255,255,255,.55); border: 3px solid #fff; display: none; pointer-events: none; }
#tRot { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); background: rgba(10,6,24,.82); border: 2px solid #ffd34e; border-radius: 14px; padding: 8px 16px; color: #fff; font: 800 14px "Trebuchet MS", sans-serif; display: none; pointer-events: none; text-align: center; }
@media (orientation: portrait) { #touchUI.on #tRot { display: block; } }
`;
const kd = (code, down) => { const e = new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code.replace(/^Key/, '').replace(/^Digit/, '').toLowerCase(), bubbles: true, cancelable: true }); window.dispatchEvent(e); };
const mouse = (button, down) => window.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button, bubbles: true, cancelable: true }));
const look = (dx, dy) => { const e = new MouseEvent('mousemove', { bubbles: true }); Object.defineProperty(e, 'movementX', { value: dx }); Object.defineProperty(e, 'movementY', { value: dy }); document.dispatchEvent(e); };

// cfg: { visible: () => bool, stick: { up, down, left, right, sprintKey, sprintAt }, lookScale, buttons: [...], taps: [{ sel, key(el, index) }], pause: () => void }
export function initTouch(cfg) {
  if (!TOUCH) return null;
  const st = document.createElement('style'); st.textContent = CSS + (cfg.css || ''); document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'touchUI'; root.innerHTML = '<div id="tLook"></div><div id="tBase"></div><div id="tKnob"></div><div id="tRot">Turn your phone sideways to play</div>'; document.body.appendChild(root);
  const lookEl = root.querySelector('#tLook'), base = root.querySelector('#tBase'), knob = root.querySelector('#tKnob'), scale = cfg.lookScale || 2.2, S = cfg.stick, zone = cfg.stickZone || .45;
  // ---- the stick (left side) and the look pad (everywhere else)
  let stickP = null, lookP = null; const on = { up: false, down: false, left: false, right: false, sprint: false };
  const setKey = (name, code, v) => { if (on[name] !== v) { on[name] = v; if (code) kd(code, v); } };
  const stickUpdate = (x, y) => {
    let dx = x - stickP.x0, dy = y - stickP.y0; const m = Math.hypot(dx, dy), R = 56; if (m > R) { dx = dx / m * R; dy = dy / m * R; }
    knob.style.left = (stickP.x0 + dx) + 'px'; knob.style.top = (stickP.y0 + dy) + 'px'; const nx = dx / R, ny = dy / R, T = .32; if (cfg.onStick) cfg.onStick(nx, ny);
    setKey('up', S.up, ny < -T); setKey('down', S.down, ny > T); setKey('left', S.left, nx < -T); setKey('right', S.right, nx > T); setKey('sprint', S.sprintKey, S.sprintKey && Math.hypot(nx, ny) > (S.sprintAt || .93));
  };
  const stickEnd = () => { stickP = null; if (cfg.onStick) cfg.onStick(0, 0); base.style.display = knob.style.display = 'none'; setKey('up', S.up, false); setKey('down', S.down, false); setKey('left', S.left, false); setKey('right', S.right, false); setKey('sprint', S.sprintKey, false); };
  const tapAt = e => {   // did we touch something on the HUD (a weapon slot, a build button)? The HUD ignores pointers, so test the rectangles ourselves.
    if (!cfg.taps) return false;
    for (const spec of cfg.taps) {
      const list = [...document.querySelectorAll(spec.sel)];
      for (let idx = 0; idx < list.length; idx++) {
        const el = list[idx], r = el.getBoundingClientRect(); if (!r.width || e.clientX < r.left - 4 || e.clientX > r.right + 4 || e.clientY < r.top - 8 || e.clientY > r.bottom + 4) continue;
        const code = spec.key(el, idx); if (code) { kd(code, true); setTimeout(() => kd(code, false), 60); } return true;
      }
    }
    return false;
  };
  lookEl.addEventListener('pointerdown', e => {
    e.preventDefault(); try { lookEl.setPointerCapture(e.pointerId); } catch (err) {} if (tapAt(e)) return;
    if (S && e.clientX < innerWidth * zone && !stickP) { stickP = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; base.style.left = knob.style.left = e.clientX + 'px'; base.style.top = knob.style.top = e.clientY + 'px'; base.style.display = knob.style.display = 'block'; }
    else if (!lookP) lookP = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  lookEl.addEventListener('pointermove', e => {
    if (stickP && e.pointerId === stickP.id) stickUpdate(e.clientX, e.clientY);
    else if (lookP && e.pointerId === lookP.id) { look((e.clientX - lookP.x) * scale, (e.clientY - lookP.y) * scale); lookP.x = e.clientX; lookP.y = e.clientY; }
  });
  const up = e => { if (stickP && e.pointerId === stickP.id) stickEnd(); if (lookP && e.pointerId === lookP.id) lookP = null; };
  lookEl.addEventListener('pointerup', up); lookEl.addEventListener('pointercancel', up);
  // ---- the buttons
  const btns = [];
  for (const b of cfg.buttons || []) {
    const el = document.createElement('div'); el.className = 'tb ' + (b.cls || ''); el.innerHTML = b.label + (b.sub ? '<small>' + b.sub + '</small>' : ''); el.style.width = el.style.height = (b.s || 64) + 'px'; el.style.fontSize = b.fs ? b.fs + 'px' : '';
    if (b.r !== undefined) el.style.right = b.r + 'px'; if (b.l !== undefined) el.style.left = b.l + 'px'; if (b.b !== undefined) el.style.bottom = b.b + 'px'; if (b.t !== undefined) el.style.top = b.t + 'px'; root.appendChild(el);
    const s = { b, el, down: false, ptr: null, state: false, lx: 0, ly: 0 }; btns.push(s);
    const press = () => {
      if (b.type === 'toggle') { s.state = !s.state; el.classList.toggle('on', s.state); if (b.key) kd(b.key, s.state); if (b.mouse !== undefined) mouse(b.mouse, s.state); if (b.onToggle) b.onToggle(s.state); return; }
      el.classList.add('down'); if (b.key) kd(b.key, true); if (b.mouse !== undefined) mouse(b.mouse, true); if (b.action) b.action(); if (b.mouseTap !== undefined) { mouse(b.mouseTap, true); setTimeout(() => mouse(b.mouseTap, false), 90); }
      if (b.type === 'tap') setTimeout(() => { if (b.key) kd(b.key, false); el.classList.remove('down'); }, 70);
    };
    const release = () => { if (b.type === 'toggle' || b.type === 'tap') return; const wait = (b.minHold || 0) - (performance.now() - s.t0); if (wait > 0) { setTimeout(release, wait + 1); return; } el.classList.remove('down'); if (b.key) kd(b.key, false); if (b.mouse !== undefined) mouse(b.mouse, false); };
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (err) {} s.ptr = e.pointerId; s.t0 = performance.now(); s.lx = e.clientX; s.ly = e.clientY; press(); });
    el.addEventListener('pointermove', e => { if (b.look && s.ptr === e.pointerId) { look((e.clientX - s.lx) * scale, (e.clientY - s.ly) * scale); s.lx = e.clientX; s.ly = e.clientY; } });
    const end = e => { if (s.ptr === e.pointerId) { s.ptr = null; release(); } }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    s.reset = () => { s.state = false; el.classList.remove('on', 'down'); };
  }
  // ---- show the controls only while playing; keep the screen from sleeping and go fullscreen on the first tap
  let shown = false;
  setInterval(() => {
    const v = !!cfg.visible();
    if (v) for (const s of btns) {   // keep toggles in step with the game (it can switch aiming off itself) and light up helpful buttons
      if (s.b.isOn) { const o = !!s.b.isOn(); if (o !== s.state) { s.state = o; s.el.classList.toggle('on', o); } }
      if (s.b.glow) s.el.classList.toggle('glow', !!s.b.glow());
      if (s.b.show) { const d = s.b.show() ? '' : 'none'; if (s.el.style.display !== d) s.el.style.display = d; }
    }
    if (v !== shown) { shown = v; for (const c of cfg.autoKeys || []) kd(c, v); root.classList.toggle('on', v); document.documentElement.classList.toggle('tplay', v); if (!v) { stickEnd(); lookP = null; for (const s of btns) { if (s.state && s.b.key) kd(s.b.key, false); if (s.state && s.b.mouse !== undefined) mouse(s.b.mouse, false); s.reset(); } } }
  }, 120);
  document.addEventListener('click', function once() { document.removeEventListener('click', once); try { const d = document.documentElement; if (d.requestFullscreen && !document.fullscreenElement) d.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {} });
  return { root, elements: btns };
}
