/* HKugz Games Christmas theme switch.
   On by itself from Nov 15 to Jan 2 (any year). ?xmas=1 forces it on (to preview), ?xmas=0 forces it off (both are remembered in this browser).
   Load it in <head> (before the page paints) together with assets/xmas.css. Does nothing outside the season. */
(function () {
  // <script data-mode="game"> = a game page: snow, lights and the santa hat only show while a menu screen is up
  var GAME = !!(document.currentScript && document.currentScript.getAttribute("data-mode") === "game");
  var KEY = "hk-xmas", SNOWKEY = "hk-xmas-snow", root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var m = /[?&]xmas=([01])/.exec(location.search);
  if (m) set(KEY, m[1] === "1" ? "on" : "off");
  var d = new Date(), md = (d.getMonth() + 1) * 100 + d.getDate();
  var season = md >= 1115 || md <= 102;
  var pref = get(KEY);
  var on = pref === "on" ? true : pref === "off" ? false : season;
  if (!on) return;
  root.classList.add("xmas");

  document.addEventListener("DOMContentLoaded", function () {
    // greeting in the hero
    var eb = document.querySelector(".hero2 .eyebrow");
    if (eb) eb.textContent = "Merry Christmas from HKugz!";

    // string of lights under the top bar
    var bar = document.querySelector("header.topnav");
    if (bar) {
      if (getComputedStyle(bar).position === "static") bar.style.position = "relative";
      var wrap = document.createElement("div"); wrap.className = "xl-lights"; wrap.setAttribute("aria-hidden", "true");
      var cols = ["#ff3b3b", "#ffd23f", "#2fd36b", "#3fa7ff"], n = Math.max(10, Math.round(innerWidth / 34));
      for (var i = 0; i < n; i++) { var b = document.createElement("i"); b.style.setProperty("--c", cols[i % 4]); b.style.setProperty("--d", (i % 5) * 0.36 + "s"); wrap.appendChild(b); }
      bar.appendChild(wrap);
    }

    // snow (canvas) + switch. Off for people who asked their device for less motion, unless they switch it on.
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var snowPref = get(SNOWKEY);
    var snowOn = snowPref ? snowPref === "on" : !reduce;
    var cv = document.createElement("canvas"); cv.id = "xl-snow"; cv.setAttribute("aria-hidden", "true");
    var btn = document.createElement("button"); btn.id = "xl-toggle"; btn.type = "button";
    var menuUp = !GAME, lights = null;
    if (GAME) { cv.style.zIndex = "900"; btn.style.zIndex = "901"; }
    var ctx = cv.getContext("2d"), flakes = [], W = 0, H = 0, raf = 0, last = 0;
    function size() { var r = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
      var want = Math.round(Math.min(110, Math.max(40, W / 14))); while (flakes.length < want) flakes.push(mk(true)); flakes.length = want; }
    function mk(any) { return { x: Math.random() * W, y: any ? Math.random() * H : -10, r: 1.2 + Math.random() * 2.8, v: 22 + Math.random() * 38, s: Math.random() * 6.28, w: 0.4 + Math.random() * 0.9 }; }
    function frame(t) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i]; f.y += f.v * dt * (0.6 + f.r / 4); f.s += f.w * dt; f.x += Math.sin(f.s) * 14 * dt;
        if (f.y > H + 6) { flakes[i] = mk(false); f = flakes[i]; }
        if (f.x < -8) f.x = W + 6; else if (f.x > W + 8) f.x = -6;
        ctx.globalAlpha = 0.55 + f.r / 9; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(40,110,150,.35)"; ctx.shadowBlur = 3; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function apply() {
      btn.textContent = snowOn ? "❄ Snow: on" : "❄ Snow: off"; btn.setAttribute("aria-pressed", snowOn ? "true" : "false");
      var show = snowOn && menuUp; cv.style.display = show ? "" : "none"; btn.style.display = menuUp ? "" : "none"; if (lights) lights.style.display = menuUp ? "" : "none";
      cancelAnimationFrame(raf); if (show && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }
    btn.addEventListener("click", function () { snowOn = !snowOn; set(SNOWKEY, snowOn ? "on" : "off"); apply(); });
    document.addEventListener("visibilitychange", apply);
    addEventListener("resize", size);
    document.body.appendChild(cv); document.body.appendChild(btn); size();
    if (GAME) {
      // string of lights along the top of the screen
      lights = document.createElement("div"); lights.className = "xl-lights xl-fixed"; lights.setAttribute("aria-hidden", "true");
      var cols2 = ["#ff3b3b", "#ffd23f", "#2fd36b", "#3fa7ff"], n2 = Math.max(10, Math.round(innerWidth / 34));
      for (var j = 0; j < n2; j++) { var bb = document.createElement("i"); bb.style.setProperty("--c", cols2[j % 4]); bb.style.setProperty("--d", (j % 5) * 0.36 + "s"); lights.appendChild(bb); }
      document.body.appendChild(lights);
      // is a menu / pause / results screen showing? (checked a few times a second)
      var wasUp = null;
      function check() {
        var scr = document.querySelectorAll(".screen:not(.hide):not([hidden]), #menu:not(.hide):not([hidden])"), up = false;
        for (var k = 0; k < scr.length; k++) { var cs = getComputedStyle(scr[k]); if (cs.display !== "none" && cs.visibility !== "hidden" && scr[k].offsetHeight > 0) { up = true; break; } }
        document.querySelectorAll(".screen h1").forEach(function (h) {
          if (h.classList.contains("xl-title")) return;
          var c = getComputedStyle(h); if (c.webkitBackgroundClip === "text" || c.backgroundClip === "text") h.classList.add("xl-title");
        });
        document.querySelectorAll('.screen img[src$="assets/logo.svg"], #menu img[src$="assets/logo.svg"]').forEach(function (im) {
          if (im.parentNode.classList.contains("xl-hatwrap")) return;
          var w = document.createElement("span"); w.className = "xl-hatwrap"; im.parentNode.insertBefore(w, im); w.appendChild(im);
          var hat = document.createElement("span"); hat.className = "xl-hat"; hat.setAttribute("aria-hidden", "true"); w.appendChild(hat);
        });
        if (up !== wasUp) { wasUp = up; menuUp = up; apply(); }
      }
      check(); setInterval(check, 400);
    } else apply();
  });
})();
