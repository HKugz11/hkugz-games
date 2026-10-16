// HKugz Games play timer: opt-in, one device at a time. A parent switches it on with a PIN on that device (see /timer/); after the daily
// limit every page of the site shows the "time's up" page until tomorrow, or until the parent adds time with the PIN.
// Everything lives in this browser (localStorage key "hktimer"). Nothing is sent anywhere, and when nobody turned it on it does nothing.
// It is a nudge, not a lock: clearing the site's data or using another browser gets around it, so a device-level limit (Family Link,
// Screen Time, Family Safety) is the stronger option.
(function () {
  'use strict';
  var KEY = 'hktimer', script = document.currentScript, role = (script && script.getAttribute('data-role')) || '';
  var base = script && script.src ? script.src.replace(/assets\/playtimer\.js.*$/, '') : '/';

  function load() { try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) {} return null; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function fresh(s) { if (s && s.day !== today()) { s.day = today(); s.used = 0; s.extra = 0; s.off = false; } return s; }
  function left(s) { return s && s.on && !s.off ? s.limit * 60 + (s.extra || 0) - (s.used || 0) : Infinity; }
  function locked(s) { return !!s && left(s) <= 0; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function hash(pin, salt) {
    var text = salt + ':' + pin;
    if (window.crypto && crypto.subtle && window.TextEncoder) return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(hex);
    var h = 2166136261; for (var i = 0; i < 20000; i++) for (var j = 0; j < text.length; j++) { h ^= text.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; }
    return Promise.resolve('f' + h.toString(16));
  }
  function newSalt() { var a = new Uint8Array(12); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (var i = 0; i < a.length; i++) a[i] = Math.random() * 256; return hex(a); }
  function fmt(sec) {
    if (sec < 60) return 'under 1 minute';
    var m = Math.ceil(sec / 60); return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min';
  }
  function clock(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function go(url) { try { location.replace(url); } catch (e) { location.href = url; } }

  // ---- the part other pages (timer/, timesup/) use
  var API = window.HKTimer = {
    base: base,
    state: function () {
      var s = fresh(load()), wait = s && s.fail && s.fail.until > Date.now() ? Math.ceil((s.fail.until - Date.now()) / 1000) : 0;
      return { exists: !!s, on: !!(s && s.on), off: !!(s && s.off), hasPin: !!(s && s.pin), limit: s ? s.limit : 60, used: s ? s.used || 0 : 0, extra: s ? s.extra || 0 : 0, left: left(s), wait: wait };
    },
    verify: function (pin) {   // -> Promise {ok, wait}; slows down guessing (3 wrong tries = a wait that doubles)
      var s = fresh(load()); if (!s || !s.pin) return Promise.resolve({ ok: false, wait: 0 });
      var w = s.fail && s.fail.until > Date.now() ? Math.ceil((s.fail.until - Date.now()) / 1000) : 0; if (w) return Promise.resolve({ ok: false, wait: w });
      return hash(String(pin), s.pin.s).then(function (h) {
        var t = fresh(load()); if (!t) return { ok: false, wait: 0 };
        if (h === t.pin.h) { t.fail = { n: 0, until: 0 }; save(t); return { ok: true, wait: 0 }; }
        var n = ((t.fail && t.fail.n) || 0) + 1, wait = n >= 3 ? Math.min(600, 30 * Math.pow(2, n - 3)) : 0;
        t.fail = { n: n, until: wait ? Date.now() + wait * 1000 : 0 }; save(t); return { ok: false, wait: wait };
      });
    },
    setup: function (pin, minutes) {   // first time on this device (or a new PIN)
      var salt = newSalt(); return hash(String(pin), salt).then(function (h) {
        var s = fresh(load()) || { v: 1, day: today(), used: 0, extra: 0 };
        s.v = 1; s.pin = { s: salt, h: h }; s.limit = Math.max(5, Math.min(600, Math.round(minutes) || 60)); s.on = true; s.off = false; s.fail = { n: 0, until: 0 }; return save(s);
      });
    },
    changePin: function (pin) { var s = fresh(load()); if (!s) return Promise.resolve(false); var salt = newSalt(); return hash(String(pin), salt).then(function (h) { s.pin = { s: salt, h: h }; return save(s); }); },
    setLimit: function (min) { var s = fresh(load()); if (!s) return false; s.limit = Math.max(5, Math.min(600, Math.round(min) || 60)); return save(s); },
    setOn: function (on) { var s = fresh(load()); if (!s) return false; s.on = !!on; s.off = false; return save(s); },
    addMinutes: function (m) { var s = fresh(load()); if (!s) return false; s.extra = (s.extra || 0) + m * 60; return save(s); },
    offToday: function () { var s = fresh(load()); if (!s) return false; s.off = true; return save(s); },
    resetToday: function () { var s = fresh(load()); if (!s) return false; s.used = 0; s.extra = 0; s.off = false; return save(s); },
    fmt: fmt, clock: clock
  };

  if (role) return;   // the timer and time's-up pages only use the API above

  // ---- every other page: count the time, warn, and send you to the time's-up page when the limit is reached
  function toTimesUp() { go(base + 'timesup/?back=' + encodeURIComponent(location.href)); }
  var s0 = fresh(load()); if (!s0 || !s0.on) return;
  if (locked(s0)) { toTimesUp(); return; }

  var toast = null, chip = null, hideT = 0, warned = {};
  function dom(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function mk(id, css) { var e = document.createElement('div'); e.id = id; e.setAttribute('aria-live', 'polite'); e.style.cssText = css + ';position:fixed;z-index:2147483000;pointer-events:none;font:600 14px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;background:rgba(20,16,28,.9);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:8px 16px;transition:opacity .4s;opacity:0'; document.body.appendChild(e); return e; }
  function say(text, ms) {
    dom(function () {
      if (!toast) toast = mk('hkTimerToast', 'top:12px;left:50%;transform:translateX(-50%);max-width:92vw;text-align:center');
      toast.textContent = text; toast.style.opacity = '1'; clearTimeout(hideT); hideT = setTimeout(function () { toast.style.opacity = '0'; }, ms || 5000);
    });
  }
  function showChip(sec) {
    dom(function () {
      if (!chip) chip = mk('hkTimerChip', 'top:26px;right:8px;font-size:12px;padding:4px 10px;opacity:.78');
      chip.textContent = 'Play time left ' + clock(sec); chip.style.opacity = '.78';
    });
  }
  function badge() {   // the hub shows how much time is left today
    var b = document.getElementById('hkTimerBadge'); if (!b) return; var s = fresh(load());
    if (s && s.on && !s.off) { b.hidden = false; b.textContent = 'Play time left today: ' + fmt(Math.max(0, left(s))); } else b.hidden = true;
  }
  if (isFinite(left(s0))) say('Play time left today: ' + fmt(left(s0)), 5500); dom(badge);

  function tick() {
    var s = fresh(load()); if (!s || !s.on) { if (chip) chip.style.opacity = '0'; return; }
    var now = Date.now();
    if (document.visibilityState === 'visible') {   // only count while you can see the page; another open tab counts the same second only once
      var d = now - (s.beat || 0); if (d >= 900) { s.used = (s.used || 0) + Math.min(d, 2500) / 1000; s.beat = now; save(s); }
    }
    var l = left(s);
    if (l <= 0) { toTimesUp(); return; }
    if (l <= 300) showChip(l); else if (chip) chip.style.opacity = '0';
    if (l <= 300 && !warned[300]) { warned[300] = 1; say('5 minutes of play time left today', 7000); }
    if (l <= 60 && !warned[60]) { warned[60] = 1; say('1 minute of play time left. Time to save and finish up!', 9000); }
    badge();
  }
  setInterval(tick, 1000);
  addEventListener('pageshow', function (e) { if (e.persisted) tick(); });   // coming back to a page from the back button re-checks the clock
})();
