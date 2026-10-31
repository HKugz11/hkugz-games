// HKugz Games "All games" settings: master volume, brightness, contrast, colour, FPS counter and touch controls for every page (see /settings/).
// Everything lives in this browser (localStorage key "hkset") and travels in save codes. Nothing is sent anywhere.
// Each game keeps its own settings under its own keys; /settings/ edits those directly, so the games and their in-game menus stay in step.
(function () {
  'use strict';
  var KEY = 'hkset', outs = [], chip = null, frames = 0, last = 0, ticking = false;
  var S = window.HKSET = read();

  function read() { try { var o = JSON.parse(localStorage.getItem(KEY)); if (o && typeof o === 'object') return o; } catch (e) {} return {}; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function level() { return S.mute ? 0 : Math.max(0, Math.min(1, num(S.vol, 1))); }

  // every sound in every game ends at ctx.destination, so a gain node put in front of it is one volume knob for the whole site
  (function () {
    var AC = window.AudioContext || window.webkitAudioContext, base = window.BaseAudioContext ? BaseAudioContext.prototype : AC && AC.prototype;
    var d = base && Object.getOwnPropertyDescriptor(base, 'destination');
    if (!AC || !d || !d.get) return;
    Object.defineProperty(AC.prototype, 'destination', { configurable: true, get: function () {
      if (!this.__hkOut) { var g = this.createGain(); g.gain.value = level(); g.connect(d.get.call(this)); this.__hkOut = g; outs.push(g); }
      return this.__hkOut;
    } });
  })();

  function applyLook() {
    if (window.self !== window.top) return;   // Tower of Destiny runs in a frame: the outer page already covers it
    var b = num(S.bright, 1), c = num(S.contrast, 1), s = num(S.sat, 1);
    document.documentElement.style.filter = b === 1 && c === 1 && s === 1 ? '' : 'brightness(' + b + ') contrast(' + c + ') saturate(' + s + ')';
  }
  function tick(t) {
    if (!S.fps) { ticking = false; if (chip) chip.hidden = true; return; }
    frames++;
    if (t - last >= 500) { if (chip) { chip.textContent = Math.round(frames * 1000 / (t - last)) + ' FPS'; chip.hidden = false; } frames = 0; last = t; }
    requestAnimationFrame(tick);
  }
  function applyFps() {
    if (!S.fps || !/\/games\//.test(location.pathname) || window.self !== window.top) { if (chip) chip.hidden = true; return; }
    if (!chip) {
      if (!document.body) { addEventListener('DOMContentLoaded', applyFps); return; }
      chip = document.createElement('div'); chip.id = 'hkFps'; chip.hidden = true;
      chip.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483600;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font:700 12px system-ui,sans-serif;pointer-events:none';
      document.body.appendChild(chip);
    }
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }
  function applyAll() { applyLook(); applyFps(); outs.forEach(function (g) { g.gain.value = level(); }); }

  window.HKSETapply = function () { window.HKSET = S = read(); applyAll(); };
  addEventListener('storage', function (e) { if (e.key === KEY) window.HKSETapply(); });   // a game open in another tab follows the settings page
  applyAll();
})();
