import { displayWeapon } from './showcase.js?v=215';
// CORE STRIKE - 5v5 tactical toy-soldier shooter. No blood: eliminated players pop into cubes.
import { createCrateStage, createPreviewStage } from './showcase.js?v=215';
import { finishes, knives, rarities, applyFinish, drawSkinSwatch, tickSkins, outfitSoldier } from './skins.js?v=215';
import { platform } from './platform.js?v=215';
import * as THREE from './three.module.min.js?v=215';
import { W, H, CS, G, ZONE, HG, hAt, hPos, zoneAt, cellOf, cellX, cellZ, WALKABLE, blocked, groundAt, rayWorld, clearLine, astar, SITES, ROUTES, MID_HOLDS, LURK, SPAWN, walk, nearestWalk, MAP, MAP_LIST, loadMap } from './map.js?v=215';
import { initAudio, setVolume, setListener, setPlatformMuted, setFastForward, setMusic, SFX } from './audio.js?v=215';
import { createOnline } from './online.js?v=215';
import { TOUCH, initTouch } from './touch.js?v=215';
import { buildWorld, setKnifeStyle, tpGunGeo, tpMenuArms, tpGunMenu, soldierParts, soldierPartsLite, tpArms, TP_MUZ, charMat, buildBomb, buildGun, fpMat, sleeveMat, SIDE_SLEEVE, ENV, disposeWorld, GFX } from './art.js?v=215';

platform.onMute(setPlatformMuted);
const $ = (id) => document.getElementById(id);
const gameplayPanels = ['buy', 'bigMap', 'keysP', 'setP', 'onlineP', 'rankUp'].map($);
function platformPlaying() {
  if ((GS.state !== 'live' && GS.state !== 'freeze') || GS.paused || !GS.player?.alive) return false;
  for (const panel of gameplayPanels) if (!panel.classList.contains('hidden')) return false;
  return true;
}
const QS = new URLSearchParams(location.search);
const DEBUG = false;   // the CrazyGames build has no debug tools
// The game's name lives in ONE place: GAME_TITLE (set in index.html's first <script>). Rename it there.
const GAME_TITLE = window.GAME_TITLE || 'Core Strike';
const IS_CROS = /\bCrOS\b/.test(navigator.userAgent); // Chromebook
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const DEG = Math.PI / 180;
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const V = () => new THREE.Vector3();

// ---------------- settings ----------------
const DEFAULTS = { sens: 1, fov: 85, vol: 0.7, xhColor: '#4dff7a', xhSize: 6, xhGap: 4, xhDot: '0', diff: 'normal', length: 'short', side: 'random', mode: 'comp', gfx: 'high', gfxSet: false, ads: IS_CROS ? 'toggle' : 'hold', aimStyle: 'cross', map: 'sandstone', arsenal: 'pro', ranked: 'on', bomb: 'random', speed: 'on', tMine: 5, tFoe: 5, name: '' };
const S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem('cs.settings') || localStorage.getItem('coreStrike') || '{}')); } catch { }
// team sizes (you count as one of your team): 1 to 10 each, so 10 v 2 or 1 v 5 are possible. Only a 5 v 5 match counts for rank.
const TEAM_MAX = 10, teamN = (v) => Math.max(1, Math.min(TEAM_MAX, Math.round(+v) || 5));
S.tMine = teamN(S.tMine); S.tFoe = teamN(S.tFoe);
const evenTeams = (a, b) => teamN(a) === 5 && teamN(b) === 5;
const saveS = () => { try { localStorage.setItem('cs.settings', JSON.stringify(S)); } catch { } };
// graphics: 'lite' (super minimized, for Chromebooks), 'low' (Fast) or 'high' (Pretty). A Chromebook starts in Lite until the player picks something.
// ?lite / ?pretty in the address forces one.
if (QS.has('lite')) { S.gfx = 'lite'; S.gfxSet = true; saveS(); } else if (QS.has('pretty')) { S.gfx = 'high'; S.gfxSet = true; saveS(); } else if ((IS_CROS || TOUCH) && !S.gfxSet) S.gfx = 'lite';
let STATS = { wins: 0, losses: 0, range: 0 };
try { Object.assign(STATS, JSON.parse(localStorage.getItem('cs.stats') || localStorage.getItem('coreStrikeStats') || '{}')); } catch { }
const saveStats = () => { try { localStorage.setItem('cs.stats', JSON.stringify(STATS)); } catch { } };
// ---- ranks, like Counter-Strike: win Competitive matches against bots to earn rank points (RP) and climb the leagues
// Bronze, Silver, Gold, Platinum, Diamond and Master each have 3 divisions (III, II, I) of 100 RP; above that is Elite. Your first 3 ranked matches are placement matches.
// Easier bots can only take you so far: Chill up to Silver I, Normal up to Platinum I, Sweaty up to Master I, Pro all the way to Elite.
const LEAGUES = [['Bronze', '#cd7f32'], ['Silver', '#c3c9d1'], ['Gold', '#ffd34a'], ['Platinum', '#7fe8d6'], ['Diamond', '#6fb4ff'], ['Master', '#d58bff'], ['Elite', '#ff6a6a']];
const DIVS = ['III', 'II', 'I'];
const RANK_CAP = { easy: 599, normal: 1199, hard: 1799, insane: 999999 };
const RANK = { rp: 0, m: 0, w: 0, l: 0, d: 0, peak: 0, last: null };
try { Object.assign(RANK, JSON.parse(localStorage.getItem('cs.rank') || '{}')); } catch { }
const saveRank = () => { try { localStorage.setItem('cs.rank', JSON.stringify(RANK)); } catch { } };
function rankInfo(rp) {
  const li = Math.min(6, Math.floor(rp / 300)), L = LEAGUES[li];
  if (li === 6) return { li, step: 18, name: 'Elite', col: L[1], div: -1, lo: 1800, pct: Math.min(1, (rp - 1800) / 400) };
  const di = Math.min(2, Math.floor((rp - li * 300) / 100)), lo = li * 300 + di * 100;
  return { li, step: li * 3 + di, name: L[0] + ' ' + DIVS[di], col: L[1], div: di, lo, pct: (rp - lo) / 100 };
}
const rankCfg = () => (MP.on && MP.cfg ? MP.cfg : S);   // an online match counts with the HOST's bot skill and match length, not the guest's own menu
// How well YOU played (about 1 = an average human, 0 = AFK): damage, kills, rounds you contributed to and plants / defuses, per round. A win your team carried gives little or nothing.
function rankPerf(P) {
  if (!P) return 1;
  const r = Math.max(1, GS.round), n = (v, k) => Math.min(1.6, v / k);
  return 0.35 * n((P.dmg || 0) / r, 70) + 0.3 * n(P.kills / r, 0.65) + 0.35 * n((P.contrib || 0) / r, 0.6) + Math.min(0.2, 0.07 * (P.obj || 0));
}
function rankDelta(res, margin, mvp, perf = 1) {
  const rc = rankCfg(), W = { easy: 12, normal: 20, hard: 28, insane: 36 }[rc.diff] || 20, Lz = { easy: 20, normal: 14, hard: 10, insane: 8 }[rc.diff] || 14;
  let d = res === 'win' ? W + Math.min(5, margin) * 2 + (mvp ? 4 : 0) : res === 'loss' ? -(Lz + (margin >= 4 ? 4 : 0)) : 0;
  if (res === 'win') d *= Math.max(0, Math.min(1.3, (perf - 0.2) / 0.7));   // carried to a win: 0 RP below perf 0.2, full RP at 0.9, a bonus for a big game
  else if (res === 'loss') d *= perf < 0.3 ? 1.25 : perf < 0.8 ? 1 : perf < 1.2 ? 0.8 : 0.6;   // a good game softens a loss, doing nothing makes it hurt more
  else d = Math.round(Math.max(-6, Math.min(8, (perf - 0.8) * 10)));
  if (RANK.m < 3) d = d > 0 ? d * 2 : d * 0.5;   // placement matches: wins count double, losses half
  if (d > 0 && GS.rankMates > 0) d *= 0.8;   // friends on your own team make winning easier, so a win is worth a bit less
  return Math.round(d * (rc.length === 'duper' ? 1.5 : rc.length === 'long' ? 1.25 : 1));
}
function settleRank(res, margin, mvp, perf = 1) {
  const before = RANK.rp, d = rankDelta(res, margin, mvp, perf), cap = RANK_CAP[rankCfg().diff] ?? 999999;
  let after = before + d; if (d > 0) after = Math.min(after, Math.max(before, cap)); after = Math.max(0, after);
  RANK.rp = after; RANK.m++; if (res === 'win') RANK.w++; else if (res === 'loss') RANK.l++; else RANK.d++; RANK.peak = Math.max(RANK.peak, after);
  const out = { delta: after - before, before, after, capped: d > 0 && after < before + d, perf, res, diff: rankCfg().diff, m: RANK.m, online: MP.on };
  RANK.last = out; saveRank(); return out;
}
const rankPlacing = () => RANK.m < 3;
// match lengths: Short (first to 5), Full (first to 9), Duper long (first to 11 = 20 rounds: 10 before the side swap, 10 after). Deathmatch: kills / minutes.
const LEN = { short: { target: 5, dm: 40, dmTime: 300 }, long: { target: 9, dm: 75, dmTime: 480 }, duper: { target: 11, dm: 120, dmTime: 720 } };
const lenOf = (k) => LEN[k] || LEN.long;
const rankShield = (info, txt) => `<span class="shield" style="--rc:${info.col}">${txt}</span>`;
function rankBadgeHTML() {
  if (rankPlacing()) return `<span class="shield" style="--rc:#8a90a0">?</span><span><b>UNRANKED</b> · ${3 - RANK.m} ranked match${3 - RANK.m === 1 ? '' : 'es'} to go</span>`;
  const r = rankInfo(RANK.rp);
  return `${rankShield(r, r.div < 0 ? 'E' : DIVS[r.div])}<span><b style="color:${r.col}">${r.name.toUpperCase()}</b> · ${RANK.rp} RP</span><span class="bar"><i style="width:${Math.round(r.pct * 100)}%;background:${r.col}"></i></span>`;
}
function renderRank() {
  const el = $('rankBadge'); if (!el) return;
  const placement = '<span class="placement-meter" aria-hidden="true">' + [0,1,2].map(i => '<i class="'+(i < RANK.m ? 'filled' : '')+'"></i>').join('') + '</span><b>Placements</b><span class="placement-count">'+RANK.m+'/3</span>';
  el.innerHTML = (rankPlacing() ? placement : rankBadgeHTML()) + (S.mode === 'comp' && S.ranked === 'off' ? '<span class="rank-mode" title="This match does not count toward your rank">Unranked play</span>' : '') + (GS.menuMsg ? `<span class="warn">${GS.menuMsg}</span>` : '');
}
function rankListHTML() {
  const me = rankInfo(RANK.rp), placing = rankPlacing();
  let rows = '';
  for (let li = 0; li < 7; li++) {
    const L = LEAGUES[li], here = !placing && me.li === li, lo = li * 300;
    rows += `<div class="rl ${here ? 'here' : ''}" style="--rc:${L[1]}">${rankShield({ col: L[1] }, li === 6 ? 'E' : 'I')}<b>${L[0]}</b><span>${li === 6 ? '1800+ RP' : DIVS.map((d, i) => `${d} ${lo + i * 100}`).join(' · ')}</span>${here ? `<em>${me.name} · ${RANK.rp} RP</em>` : ''}</div>`;
  }
  return rows + `<p class="fine">Win Competitive matches against bots to earn rank points (RP); lose and you drop a little. Your first 3 ranked matches are placement matches (wins count double). Chill bots can only take you up to Silver I, Normal up to Platinum I, Sweaty up to Master I, and Pro bots all the way to Elite. Leaving a match early counts as a loss. Pick Unranked in the menu for matches that do not count. Competitive matches online with friends count too when 2 or more real players are in the room (bots fill the rest): the host's bot skill and match length decide the points, and a win is worth a little less when friends play on your team. Deathmatch never counts.</p>
  <p class="fine">Your record: ${RANK.w} wins · ${RANK.l} losses · ${RANK.d} draws · best ${rankInfo(RANK.peak).name} (${RANK.peak} RP)</p>`;
}
function rankEndHTML(r) {
  const a = rankInfo(r.before), b = rankInfo(r.after), placing = RANK.m < 3, sign = r.delta > 0 ? '+' : '';
  if (placing) return `<div class="rk"><div class="rkt">PLACEMENT MATCH ${RANK.m} OF 3</div><div class="rkd" style="color:${r.delta >= 0 ? '#7dff9a' : '#ff8a7a'}">${sign}${r.delta} RP</div><div class="rkn">${3 - RANK.m ? 'Your rank is revealed after ' + (3 - RANK.m) + ' more ranked match' + (3 - RANK.m === 1 ? '' : 'es') : ''}</div></div>`;
  const up = b.step > a.step, down = b.step < a.step, reveal = RANK.m === 3;
  const title = reveal ? 'YOUR RANK' : up ? 'RANK UP!' : down ? 'RANK DOWN' : 'RANK';
  const cap = r.capped ? `<div class="rkn">${({ easy: 'Chill bots only take you up to Silver I', normal: 'Normal bots only take you up to Platinum I', hard: 'Sweaty bots only take you up to Master I' })[r.diff] || ''}: pick a harder bot skill to keep climbing</div>` : '';
  const weak = r.res === 'win' && r.perf < 0.5 ? `<div class="rkn">${r.perf < 0.2 ? 'Your team carried this win, so it gave no RP' : 'Your team carried most of this win, so it gave fewer RP'}: get kills, damage and plants to earn more</div>` : '';
  const friends = r.online ? '<div class="rkn">Friend match: it counted toward your rank</div>' : '';
  return `<div class="rk"><div class="rkt" style="color:${up || reveal ? '#ffd04a' : down ? '#ff8a7a' : '#fff'}">${title}</div><div class="rkr">${rankShield(b, b.div < 0 ? 'E' : DIVS[b.div])}<b style="color:${b.col}">${b.name.toUpperCase()}</b></div>
    <div class="rkd" style="color:${r.delta >= 0 ? '#7dff9a' : '#ff8a7a'}">${sign}${r.delta} RP <small>(${RANK.rp} total)</small></div><div class="rkbar"><i style="width:${Math.round(b.pct * 100)}%;background:${b.col}"></i></div>${cap}${weak}${friends}</div>`;
}
// why a Competitive match did not count (shown on the end screen)
const unrankedHTML = (why) => `<div class="rk"><div class="rkt">${why === 'solo' ? 'NOT RANKED' : 'UNRANKED MATCH'}</div><div class="rkn">${why === 'solo' ? 'Friend matches need 2 or more real players to count for rank' : why === 'sizes' ? 'Only 5 v 5 matches count for rank' : 'No rank points were won or lost'}</div></div>`;
// the RANK UP screen: old rank -> new rank with a shield, rays and confetti, and a Continue button (also shown for the reveal after the 3 placement matches)
function showRankUp(r) {
  const a = rankInfo(r.before), b = rankInfo(r.after), reveal = r.m === 3, league = !reveal && b.li > a.li;
  const sh = (i) => rankShield(i, i.div < 0 ? 'E' : DIVS[i.div]);
  const ru = $('rankUp'); ru.style.setProperty('--rc', b.col);
  $('ruTitle').textContent = reveal ? 'YOUR RANK' : league ? 'PROMOTED!' : 'RANK UP!';
  $('ruSub').textContent = reveal ? 'Your 3 placement matches are done' : league ? `Welcome to ${LEAGUES[b.li][0]}` : 'You moved up a division';
  $('ruOld').innerHTML = reveal ? '<span class="shield" style="--rc:#8a90a0">?</span><small>UNRANKED</small>' : `${sh(a)}<small>${a.name.toUpperCase()}</small>`;
  $('ruNew').innerHTML = `${sh(b)}<b style="color:${b.col}">${b.name.toUpperCase()}</b>`;
  $('ruRP').innerHTML = `${r.delta > 0 ? '+' : ''}${r.delta} RP <small>(${RANK.rp} total)</small>`;
  const newSkins = finishes.filter(f=>f.rp!==undefined && (reveal ? f.rp<=r.after : r.before<f.rp && r.after>=f.rp));
  if(newSkins.length) $('ruSub').textContent += ' · Skin available: '+newSkins.map(f=>f.name).join(', ');
  const bar = $('ruBar'); bar.style.background = b.col; bar.style.width = (reveal || league || b.step > a.step ? 0 : Math.round(b.pct * 100)) + '%';
  const cf = $('ruConf'), n = LITE ? 0 : LOW ? 14 : 36, cols = [b.col, '#ffd04a', '#ffffff', b.col];
  cf.innerHTML = Array.from({ length: n }, (_, i) => `<i style="left:${Math.round(Math.random() * 100)}%;background:${cols[i % 4]};animation-duration:${(2.2 + Math.random() * 2.2).toFixed(2)}s;animation-delay:${(Math.random() * 1.4).toFixed(2)}s;--sw:${Math.round(Math.random() * 120 - 60)}px"></i>`).join('');
  ru.classList.remove('hidden'); ru.classList.remove('go'); void ru.offsetWidth; ru.classList.add('go');
  setTimeout(() => { bar.style.width = Math.round(b.pct * 100) + '%'; }, 450);
  SFX.streak(); setTimeout(() => SFX.fanfare(true), 350);
  if (padMode) padFocus($('ruGo'));
}
const LITE = S.gfx === 'lite', LOW = S.gfx !== 'high';
GFX.lite = LITE;
const GFX_AT_LOAD = S.gfx;   // what this page started with: a different choice only takes effect after a reload
document.body.classList.toggle('lite', LITE); document.body.classList.toggle('low', LOW);
// online play: role is 'none' (single player), 'host' (runs the match) or 'client' (draws what the host sends)
const MP = { on: false, role: 'none', idx: -1, pid: 0, cfg: null, nid: 0 };
const MARKS = [];   // your marker on the M map (world x / z, at most one); cleared every round
let mapOpen = false;
const PINGS = { list: [], life: 6, cd: 0.9 };   // Z pings (see "pings" further down); declared here because clearWorld() can run very early
let MPH = null;
const mySq = () => (GS.player ? GS.player.squad : 0);

// ---------------- renderer ----------------
const canvas = $('c');
// The picture is drawn into an off-screen target and copied to the screen (see "picture quality" below), so the canvas itself needs no edge smoothing of its own.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
renderer.debug.checkShaderErrors = DEBUG;   // reading the shader log makes the page wait for every shader to finish; only needed while developing
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.BasicShadowMap;   // one look-up per pixel: hard-edged shadows cost far less than soft ones on laptop graphics (and suit the blocky look)
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.fog = LITE ? new THREE.Fog(0xd9dfe5, 22, 105) : new THREE.Fog(0xd9dfe5, 28, 175);
const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.05, LITE ? 125 : 700);
camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
vmScene.add(vmCam);
vmScene.add(new THREE.HemisphereLight(0xeef2f6, 0x8a7060, 2.0));
const vmSun = new THREE.DirectionalLight(0xffffff, 1.2); vmSun.position.set(1, 2, 1.5); vmScene.add(vmSun);

// ---------------- picture quality ----------------
// The scene is drawn into an off-screen picture and then copied to the screen. That lets the game change resolution, edge smoothing and shadows at any moment without a hitch
// (resizing the real canvas stalls the game for a long time on laptop graphics chips), and the screen itself needs no 4x smoothing, which was the biggest single cost on those chips.
let GPU_NAME = '';
try { const g = renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); if (e) GPU_NAME = String(g.getParameter(e.UNMASKED_RENDERER_WEBGL) || ''); } catch (err) { }
const WEAK_GPU = (/Intel/i.test(GPU_NAME) && /\b(HD|UHD)\b/i.test(GPU_NAME)) || /Mali|Adreno|PowerVR|VideoCore|SwiftShader|llvmpipe|Basic Render|VirGL/i.test(GPU_NAME);   // old Intel chips (HD / UHD Graphics) and phone / software graphics start one step lower
// The steps, best picture first. s = size of the picture (1 = as many pixels as the screen), sh = shadows, fx = cheap edge smoothing (FXAA; the browser's own 4x smoothing is far too slow through an off-screen picture on laptop graphics).
const RUNGS = LITE ? [{ s: 0.85, sh: 0, fx: 0 }, { s: 0.72, sh: 0, fx: 0 }, { s: 0.6, sh: 0, fx: 0 }, { s: 0.5, sh: 0, fx: 0 }]
  : LOW ? [{ s: 1, sh: 0, fx: 0 }, { s: 0.85, sh: 0, fx: 0 }, { s: 0.72, sh: 0, fx: 0 }, { s: 0.6, sh: 0, fx: 0 }]
    : [{ s: 1, sh: 1, fx: 1 }, { s: 1, sh: 0, fx: 1 }, { s: 0.85, sh: 0, fx: 1 }, { s: 0.72, sh: 0, fx: 1 }, { s: 0.6, sh: 0, fx: 1 }];
const QC = { rung: LITE || LOW ? 0 : WEAK_GPU ? 1 : 0, t: 0, n: 0, slow: 0, smooth: 0, cool: 3, since: 0, climbed: -1, failed: new Set(), menu: false };
const QL = { shadows: renderer.shadowMap.enabled, nextShadow: 0 };   // shadows are drawn only while a step with shadows is in use (sun.castShadow); the shadow picture is refreshed about 20 times a second
const blitMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2(1, 1) }, fxaa: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 texel; uniform float fxaa; varying vec2 vUv;
    float lu(vec3 c) { return dot(sqrt(c), vec3(0.299, 0.587, 0.114)); }   // the picture is stored as sRGB and read back as linear: the square root is about the brightness the eye sees
    void main() {
      vec4 m = texture2D(tDiffuse, vUv);
      if (fxaa > 0.5) {   // FXAA: blur only along visible edges
        vec3 nw = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel).rgb, ne = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * texel).rgb;
        vec3 sw = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * texel).rgb, se = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * texel).rgb;
        float lNW = lu(nw), lNE = lu(ne), lSW = lu(sw), lSE = lu(se), lM = lu(m.rgb);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        if (lMax - lMin > max(0.08, lMax * 0.2)) {
          vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
          float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
          dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2(-2.5), vec2(2.5)) * texel;
          vec3 a = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
          vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv + dir * -0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
          float lB = lu(b);
          m.rgb = (lB < lMin || lB > lMax) ? a : b;
        }
      }
      gl_FragColor = vec4(m.rgb, 1.0);
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false, toneMapped: false,
});
const blitScene = new THREE.Scene(), blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
{ const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat); q.frustumCulled = false; blitScene.add(q); }
let rt = null;
function setRT(scale) {
  const cw = renderer.domElement.width, ch = renderer.domElement.height;
  if (rt && rt.userData.s === scale && rt.userData.cw === cw && rt.userData.ch === ch) return;
  if (rt) rt.dispose();
  const w = Math.max(2, Math.round(cw * scale)), h = Math.max(2, Math.round(ch * scale));
  rt = new THREE.WebGLRenderTarget(w, h, { colorSpace: THREE.SRGBColorSpace, depthBuffer: true, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  rt.userData = { s: scale, cw, ch };
  blitMat.uniforms.texel.value.set(1 / w, 1 / h);
}
// how long the graphics chip really spends on a picture (where the browser allows timing it): tells "the chip is too slow" from "the processor is too slow"
const GPUQ = (() => { try { const g = renderer.getContext(), ext = g.getExtension('EXT_disjoint_timer_query_webgl2'); return ext ? { g, ext, q: null, ema: -1 } : null; } catch (err) { return null; } })();
function gpuBegin() { if (!GPUQ || GPUQ.q) return false; GPUQ.q = GPUQ.g.createQuery(); GPUQ.g.beginQuery(GPUQ.ext.TIME_ELAPSED_EXT, GPUQ.q); return true; }
function gpuEnd(started) { if (started) GPUQ.g.endQuery(GPUQ.ext.TIME_ELAPSED_EXT); }
function gpuPoll() {
  if (!GPUQ || !GPUQ.q) return;
  const g = GPUQ.g; if (!g.getQueryParameter(GPUQ.q, g.QUERY_RESULT_AVAILABLE)) return;
  if (!g.getParameter(GPUQ.ext.GPU_DISJOINT_EXT)) { const ms = g.getQueryParameter(GPUQ.q, g.QUERY_RESULT) / 1e6; GPUQ.ema = GPUQ.ema < 0 ? ms : GPUQ.ema * 0.9 + ms * 0.1; }
  g.deleteQuery(GPUQ.q); GPUQ.q = null;
}
// draw one picture: the world (and the weapon in your hands) into the off-screen target, then copy it to the screen
function drawFrame(withVM) {
  gpuPoll();
  const timed = gpuBegin();
  renderer.setRenderTarget(rt);
  renderer.clear(); renderer.render(scene, camera);
  if (withVM) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
  renderer.setRenderTarget(null);
  blitMat.uniforms.tDiffuse.value = rt.texture;
  renderer.render(blitScene, blitCam);
  gpuEnd(timed);
}
let lobbyDirty = true;
function resize() {
  lobbyDirty = true;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  setRT(QC.menu ? 1 : RUNGS[QC.rung].s);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  vmCam.aspect = w / h; vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xe6edf4, 0xa98670, 1.9));
const sun = new THREE.DirectionalLight(0xfff6ea, 1.45);
sun.position.set(W + 40, 90, H - 30);
sun.target.position.set(W, 0, H);
sun.castShadow = !LOW;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 220 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// ---------------- textures ----------------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = LITE ? 1 : 4;
  return t;
}
const softTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const starTex = canvasTex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,200,80,.9)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  x.fillStyle = g; x.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 10 : 31, a = i * Math.PI / 8; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill();
});
const holeTex = canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(20,14,8,1)'); g.addColorStop(0.45, 'rgba(40,28,16,.9)'); g.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });

const geoBox = new THREE.BoxGeometry(1, 1, 1);
if (!MAP_LIST.some((m) => m.id === S.map)) S.map = 'sandstone';
loadMap(S.map);
const holdLookCache = new Map();
let WORLD = null;
const radarImg = document.createElement('canvas');
function drawRadarImg() {
  // Cache a detailed floor plan once per map, not a four-pixel-per-cell thumbnail.
  const unit = 32;
  radarImg.width = W * unit; radarImg.height = H * unit;
  const x = radarImg.getContext('2d', {willReadFrequently:true});
  for (let z=0;z<H;z++) for(let cx=0;cx<W;cx++) {
    const ch=G[z*W+cx], zn=ZONE[z*W+cx]; if(ch==='#')continue;
    const px=cx*unit,pz=z*unit;
    x.fillStyle=zn==='a'||zn==='b'?'#a86657':'#c9b48e';x.fillRect(px,pz,unit,unit);
    // Wall boundaries and recognizable cover footprints, drawn with fine edges.
    x.strokeStyle='#ead8b4';x.lineWidth=1.5;
    for(const [dx,dz,x0,z0,x1,z1] of [[-1,0,0,0,0,32],[1,0,32,0,32,32],[0,-1,0,0,32,0],[0,1,0,32,32,32]]) {
      const nx=cx+dx,nz=z+dz;if(nx<0||nz<0||nx>=W||nz>=H||G[nz*W+nx]==='#'){x.beginPath();x.moveTo(px+x0,pz+z0);x.lineTo(px+x1,pz+z1);x.stroke();}
    }
    if('CcP123os'.includes(ch)) {
      x.fillStyle='Cc'.includes(ch)?'#827052':'P123'.includes(ch)?'#9a9486':'#887957';
      x.strokeStyle='#574f40';x.lineWidth=1;
      if(ch==='o'){for(const dx of [8,24])for(const dz of [8,24]){x.beginPath();x.arc(px+dx,pz+dz,6,0,Math.PI*2);x.fill();x.stroke();}}
      else {x.fillRect(px+2,pz+2,unit-4,unit-4);x.strokeRect(px+2.5,pz+2.5,unit-5,unit-5);if('Cc'.includes(ch)){x.beginPath();x.moveTo(px+4,pz+4);x.lineTo(px+28,pz+28);x.moveTo(px+28,pz+4);x.lineTo(px+4,pz+28);x.stroke();}}
    }
  }
  x.fillStyle='#fff';x.font='bold '+(unit*5.5)+'px Arial';x.textAlign='center';x.textBaseline='middle';
  for(const k of ['a','b'])x.fillText(SITES[k].name,SITES[k].center[0]*unit,(SITES[k].center[1]+.5)*unit);
}
function applyWorld() {
  if (WORLD) disposeWorld(WORLD.group);
  WORLD = buildWorld(scene);
  // texture sharpening at slanted angles (anisotropy) costs a lot of texture reads on laptop graphics for very little to see: 2 on good graphics, 1 on weak ones
  { const an = LITE || WEAK_GPU ? 1 : 2, seen = new Set(); scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m.map && !seen.has(m.map)) { seen.add(m.map); m.map.anisotropy = an; } }); }); }
  // the sun and its shadow box follow the size of the map (bigger maps have a wider shadow box)
  const sb = Math.max(60, Math.max(W, H) * CS * 0.68), ex = sb / 60;
  sun.target.position.set(W, 0, H); sun.position.copy(sun.target.position).addScaledVector(WORLD.sunDir, 130 * ex);
  Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, far: 220 * ex }); sun.shadow.camera.updateProjectionMatrix();
  scene.fog.color.setHex(MAP.theme.fog); renderer.setClearColor(MAP.theme.fog); // Lite has no sky dome: the fog colour is the sky
  drawRadarImg(); holdLookCache.clear();
  renderer.shadowMap.needsUpdate = true;
}
// A lost browser graphics context can also invalidate cached canvas pictures.
canvas.addEventListener('webglcontextrestored', () => {
 drawRadarImg();
 scene.traverse(o => { for(const m of o.material ? [].concat(o.material) : []) if(m.map)m.map.needsUpdate=true; });
 renderer.shadowMap.needsUpdate=true;
});
function setMap(id) { if (id === MAP.id) return; loadMap(id); applyWorld(); }
applyWorld();
startQuality();

// ---------------- FX ----------------
const PMAX = LITE ? 450 : 1400;
const pMesh = new THREE.InstancedMesh(geoBox, new THREE.MeshBasicMaterial(), PMAX);
pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pMesh.frustumCulled = false;
pMesh.setColorAt(0, new THREE.Color()); pMesh.count = 0; scene.add(pMesh);
const parts = [];
const dummy = new THREE.Object3D();
const colCache = {};
const colOf = (hex) => colCache[hex] || (colCache[hex] = new THREE.Color(hex));
function spawnP(x, y, z, vx, vy, vz, life, size, hex, grav = 16) {
  if (parts.length >= PMAX) parts.shift();
  parts.push({ x, y, z, vx, vy, vz, life, max: life, size, c: colOf(hex), grav, rx: Math.random() * 6, ry: Math.random() * 6, spin: rand(-12, 12) });
}
function burst(x, y, z, n, speed, cols, size = 0.08, life = 0.5, grav = 16, up = 0) {
  if (LOW) n = Math.ceil(n * (LITE ? 0.35 : 0.5));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = speed * rand(0.3, 1), r = Math.sqrt(1 - e * e);
    spawnP(x, y, z, Math.cos(a) * r * s, e * s + up, Math.sin(a) * r * s, life * rand(0.6, 1.2), size * rand(0.6, 1.3), pick(cols), grav);
  }
}
function updateParts(dt) {
  let n = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const g = hPos(p.x, p.z);
    if (g > 40) { p.life = 0; continue; }
    if (p.y < g + p.size / 2) { p.y = g + p.size / 2; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; p.spin *= 0.6; }
    p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
  }
  for (const p of parts) {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, 0);
    dummy.scale.setScalar(p.size * Math.min(1, (p.life / p.max) * 3));
    dummy.updateMatrix(); pMesh.setMatrixAt(n, dummy.matrix); pMesh.setColorAt(n, p.c); n++;
  }
  pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
}
// tracers
const tracers = [];
const trMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(geoBox, trMat); m.visible = false; scene.add(m); tracers.push({ m, t: 0 }); }
let trI = 0;
function tracer(a, b) {
  const tr = tracers[trI++ % tracers.length], len = a.distanceTo(b);
  if (len < 0.5) return;
  tr.m.position.copy(a).add(b).multiplyScalar(0.5); tr.m.scale.set(0.022, 0.022, len); tr.m.lookAt(b); tr.m.visible = true; tr.t = 0.05;
}
// decals
const DMAX = 220;
const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), DMAX);
decals.count = 0; decals.frustumCulled = false; scene.add(decals);
let dI = 0;
const _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
function decal(p, n) {
  dummy.position.copy(p).addScaledVector(n, 0.01); dummy.quaternion.copy(_q.setFromUnitVectors(_z, n)); dummy.rotation.z += Math.random() * 6; dummy.scale.setScalar(rand(0.8, 1.2));
  dummy.updateMatrix(); decals.setMatrixAt(dI % DMAX, dummy.matrix); dI++; decals.count = Math.min(dI, DMAX); decals.instanceMatrix.needsUpdate = true;
}
// explosions
const booms = [];
function explosionFx(p, big, hex = 0xffa040) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(p); scene.add(m); booms.push({ m, t: 0, max: big ? 1.1 : 0.45, size: big ? 16 : 4 });
  boomLight.color.setHex(hex); boomLight.position.copy(p).y += 1; boomLight.intensity = big ? 120 : 40; boomLight.distance = big ? 60 : 18; booms.push({ l: boomLight, t: 0, max: big ? 0.8 : 0.3 });
  burst(p.x, p.y + 0.3, p.z, big ? 160 : 40, big ? 22 : 11, ['#ffcf4a', '#ff8a2a', '#fff3c0', '#ff5a3d', '#555'], big ? 0.28 : 0.12, big ? 1.6 : 0.8, 12, 4);
}
function updateBooms(dt) {
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i]; b.t += dt; const k = b.t / b.max;
    if (k >= 1) { if (b.m) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); } if (b.l) b.l.intensity = 0; booms.splice(i, 1); continue; }
    if (b.m) { b.m.scale.setScalar(0.3 + b.size * Math.sqrt(k)); b.m.material.opacity = 0.9 * (1 - k); }
    if (b.l) b.l.intensity *= Math.pow(0.02, dt / b.max);
  }
}
const muzzleLight = new THREE.PointLight(0xffc060, 0, 9); scene.add(muzzleLight);
const boomLight = new THREE.PointLight(0xffa040, 0, 20); scene.add(boomLight);

// ---------------- weapons ----------------
// Every gun has its OWN spray pattern, the same every time, so you can learn it: [pitch up, yaw] in degrees for the Nth bullet of a spray.
function seeded(id) { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
const PATK = {
  ak: (i, c, s) => [c * Math.min(i, 10) * (1 - 0.04 * Math.min(i, 10)) + 0.05 * c * Math.max(0, i - 10), s * 1.2 * Math.sin((i - 2) * 0.45) * clamp((i - 2) / 4, 0, 1)],   // hard climb, then it snakes
  m4: (i, c, s) => [c * Math.min(i, 7) * (1 - 0.05 * Math.min(i, 7)) + 0.03 * c * Math.max(0, i - 7), s * (0.07 * Math.min(i, 12) + 0.35 * Math.sin(i * 0.33))],   // short climb, drifts right a little
  burst: (i, c, s) => [c * (Math.floor(i / 3) * 1.1 + (i % 3) * 0.35), s * 0.7 * Math.sin(Math.floor(i / 3) * 1.3 + (i % 3) * 0.4)],   // every burst kicks up and swings
  smg: (i, c, s, r) => [c * Math.min(i, 12) * 0.7, s * 3 * (r() - 0.5)],   // low kick, jittery sideways
  sweep: (i, c, s) => [c * Math.min(i, 15) * 0.5, s * 2.4 * Math.sin(i * 0.3) * clamp(i / 8, 0, 1)],   // wide sweeping left and right
  jitter: (i, c, s, r) => [c * Math.min(i, 10) * 0.6, s * 5 * (r() - 0.5)],   // loose and random
  lmg: (i, c, s) => [c * Math.min(i, 25) * (0.5 - 0.008 * Math.min(i, 25)), s * (0.4 + 0.05 * i) * Math.sin(i * 0.18)],   // calm at first, then it wanders more and more
  tap: (i, c) => [c * i * 0.8, 0],   // pistols: a little kick per shot
  cannon: (i, c, s) => [c * i, s * 0.4 * (i % 2 ? 1 : -1)],
  ghost: (i, c, s) => [c * Math.min(i, 8) * 0.6, s * 0.35 * Math.sin(i * 0.9)],   // light and quiet: a small climb and a gentle weave   // big single kicks
};
function pattern(def, id) {
  const n = def.mag, r = seeded(id), f = PATK[def.patk] || PATK.tap, out = [[0, 0]];
  for (let i = 1; i < n + 2; i++) out.push(f(i, def.recoil * 0.5, def.recoil, r));
  return out;
}
// new fields: auto (hold to fire) · burst + burstGap (bullets per trigger pull) · shell (pump guns load one shell at a time and can fire mid-reload) · spin (LMG winds up) · bloom (spread grows the longer you spray)
// first (first bullet of a spray is extra accurate) · runGun (can shoot straight out of a sprint) · stagger (seconds the target is slowed) · suppress (bullets that miss still rattle enemies) · draw (seconds to take it out) · settle (scope wobble time)
const WD = {
  knife: { name: 'Combat Knife', slot: 'knife', melee: true, speed: 7.0, reward: 1500 },
  p9: { name: 'P-9 Classic', slot: 'sec', price: 200, dmg: 30, rpm: 400, mag: 12, res: 120, reload: 2.1, speed: 6.8, inacc: 0.55, moveInacc: 2.2, airInacc: 7, pen: 0.47, range: 0.9, recoil: 1.2, rec: 7, reward: 300, tier: 0, snd: [2900, 0.11, 0.9], acc: '#2f7f9e', patk: 'tap', first: 0.5, draw: 0.22, desc: 'Free starter. Accurate quick taps, pulls out fast.' },
  viper: { name: 'Viper .50', slot: 'sec', price: 700, dmg: 53, rpm: 240, mag: 7, res: 35, reload: 2.2, speed: 6.6, inacc: 0.7, moveInacc: 4, airInacc: 9, pen: 0.93, range: 0.93, recoil: 3.2, rec: 3, reward: 300, tier: 1, snd: [1700, 0.26, 1.5], acc: '#ffd04a', patk: 'cannon', stagger: 0.55, draw: 0.38, desc: 'Hand cannon. Huge kick, shoves who it hits. Headshot = one tap.' },
  buzz: { name: 'Buzz SMG', slot: 'prim', price: 1250, dmg: 26, rpm: 857, auto: true, mag: 30, res: 120, reload: 2.3, speed: 6.6, inacc: 0.9, moveInacc: 1.8, airInacc: 6, pen: 0.6, range: 0.85, recoil: 0.5, rec: 10, reward: 600, tier: 2, snd: [3400, 0.08, 0.7], acc: '#6f7f3a', patk: 'smg', runGun: true, draw: 0.25, stagger: 0.2, desc: 'Fastest fire, shoots straight out of a sprint. $600 per kill.' },
  thumper: { name: 'Thumper', slot: 'prim', price: 1100, dmg: 22, pellets: 9, cone: 2.6, rpm: 70, mag: 7, res: 32, reload: 2.8, shell: 0.55, speed: 6.3, inacc: 0.4, moveInacc: 1.2, airInacc: 4, pen: 0.75, range: 0.7, recoil: 4, rec: 2.5, reward: 900, tier: 2, snd: [1300, 0.34, 1.7], acc: '#7a3340', patk: 'cannon', stagger: 0.6, draw: 0.5, desc: 'Pump shotgun, tight spread. Loads one shell at a time. $900 per kill.' },
  raptor: { name: 'Raptor AR', slot: 'prim', price: 2700, dmg: 36, rpm: 600, auto: true, mag: 30, res: 90, reload: 2.5, speed: 6.0, inacc: 0.3, moveInacc: 5.5, airInacc: 10, pen: 0.775, range: 0.98, recoil: 1.0, rec: 7, reward: 300, tier: 3, snd: [2000, 0.17, 1.2], acc: '#b0662e', patk: 'ak', draw: 0.5, desc: 'Hard hitter that kicks and snakes. Headshot = one tap.' },
  sentinel: { name: 'Sentinel AR', slot: 'prim', price: 2900, dmg: 33, rpm: 666, auto: true, mag: 25, res: 75, reload: 3.0, speed: 6.1, inacc: 0.24, moveInacc: 4.8, airInacc: 10, pen: 0.7, range: 0.97, recoil: 0.8, rec: 7.5, reward: 300, tier: 3, snd: [1300, 0.1, 0.8], acc: '#3b6fa8', patk: 'm4', first: 0.3, draw: 0.5, desc: 'Quiet and laser accurate, easy to control.', quiet: true },
  longbow: { name: 'Longbow', slot: 'prim', price: 4750, dmg: 115, rpm: 41, mag: 5, res: 30, reload: 3.6, speed: 5.2, inacc: 6, scopedInacc: 0.03, moveInacc: 9, airInacc: 15, pen: 0.975, range: 0.995, recoil: 5, rec: 2, scope: true, settle: 0.4, reward: 100, tier: 4, snd: [1100, 0.5, 2.1], acc: '#4f5b3c', patk: 'cannon', stagger: 0.5, draw: 0.8, desc: 'Heavy sniper: one shot to the body. The scope wobbles a moment after you aim.' },
  tec: { name: 'Rattler', slot: 'sec', price: 500, dmg: 24, rpm: 600, auto: true, mag: 30, res: 120, reload: 2.2, speed: 6.7, inacc: 0.9, moveInacc: 1.0, airInacc: 6, pen: 0.42, range: 0.8, recoil: 0.9, rec: 8, reward: 300, tier: 1, snd: [3000, 0.1, 0.8], acc: '#a8793a', patk: 'jitter', bloom: 0.09, runGun: true, draw: 0.22, desc: 'Full-auto machine pistol. Sprays wild, great on the move.' },
  revolver: { name: 'Peacemaker', slot: 'sec', price: 650, dmg: 88, rpm: 110, mag: 6, res: 24, reload: 3.2, speed: 6.5, inacc: 0.5, moveInacc: 6, airInacc: 10, pen: 0.95, range: 0.96, recoil: 5.2, rec: 2.2, reward: 300, tier: 1, snd: [1500, 0.32, 1.9], acc: '#b8913f', patk: 'cannon', stagger: 0.7, draw: 0.45, desc: 'Slow six-shooter that shoves hard. Two body shots kill.' },
  chopper: { name: 'Chopper', slot: 'prim', price: 1400, dmg: 24, rpm: 800, auto: true, mag: 50, res: 100, reload: 3.4, speed: 6.3, inacc: 0.75, moveInacc: 2.4, airInacc: 7, pen: 0.7, range: 0.88, recoil: 0.55, rec: 9, reward: 300, tier: 2, snd: [3100, 0.09, 0.8], acc: '#556b8a', patk: 'sweep', bloom: 0.06, draw: 0.4, desc: '50 rounds, sweeps wide when you hold it down. Strong while moving.' },
  scatter: { name: 'Scatter', slot: 'prim', price: 1800, dmg: 18, pellets: 6, cone: 4.8, rpm: 240, mag: 8, res: 32, reload: 3.2, shell: 0.4, speed: 6.2, inacc: 0.4, moveInacc: 1.2, airInacc: 4, pen: 0.7, range: 0.55, recoil: 2.8, rec: 3.5, reward: 900, tier: 2, snd: [1400, 0.3, 1.5], acc: '#6a7a3a', patk: 'cannon', stagger: 0.35, draw: 0.45, desc: 'Semi-auto shotgun, wide spread. Fires fast up close, loads shell by shell.' },
  carbine: { name: 'Carbine', slot: 'prim', price: 2050, dmg: 31, rpm: 900, burst: 3, burstGap: 0.2, mag: 25, res: 90, reload: 2.4, speed: 6.2, inacc: 0.28, moveInacc: 4.6, airInacc: 10, pen: 0.68, range: 0.96, recoil: 0.9, rec: 6, reward: 300, tier: 3, snd: [2300, 0.12, 0.9], acc: '#6a6e75', patk: 'burst', first: 0.6, draw: 0.4, desc: 'Three-round bursts. Cheap, accurate, great at range.' },
  ranger: { name: 'Ranger', slot: 'prim', price: 1750, dmg: 88, rpm: 48, mag: 10, res: 30, reload: 2.6, speed: 6.4, inacc: 4, scopedInacc: 0.05, moveInacc: 7, airInacc: 12, pen: 0.9, range: 0.995, recoil: 3.2, rec: 2.5, scope: true, zoomLv: 1, settle: 0.15, reward: 300, tier: 3, snd: [1400, 0.3, 1.6], acc: '#7a5a34', patk: 'cannon', stagger: 0.35, draw: 0.45, desc: 'Light bolt sniper: fast to move, fast to scope.' },
  dmr: { name: 'Marksman', slot: 'prim', price: 3000, dmg: 68, rpm: 190, mag: 12, res: 36, reload: 3.1, speed: 5.8, inacc: 3, scopedInacc: 0.06, moveInacc: 8, airInacc: 13, pen: 0.88, range: 0.99, recoil: 2.4, rec: 4, scope: true, zoomLv: 1, settle: 0.22, reward: 300, tier: 4, snd: [1500, 0.25, 1.5], acc: '#4e5f43', patk: 'cannon', stagger: 0.3, draw: 0.6, desc: 'Semi-auto sniper: two body shots kill, quick follow-up.' },
  lmg: { name: 'Hammer LMG', slot: 'prim', price: 5200, dmg: 32, rpm: 750, auto: true, spin: 0.28, mag: 100, res: 200, reload: 5.8, speed: 4.9, inacc: 0.5, moveInacc: 7, airInacc: 12, pen: 0.8, range: 0.95, recoil: 1.1, rec: 4, bloom: 0.04, suppress: true, reward: 300, tier: 4, snd: [1700, 0.2, 1.4], acc: '#4a4f3a', patk: 'lmg', draw: 0.9, desc: 'Winds up before it roars, 100 rounds. Misses still rattle enemies.' },
  he: { name: 'HE Grenade', nade: true, price: 300, speed: 6.9, reward: 300, max: 1, col: '#4caf50', desc: 'Boom. Big damage in a small area.' },
  flash: { name: 'Flashbang', nade: true, price: 200, speed: 6.9, max: 2, col: '#e6f0ff', desc: 'Blinds anyone looking at it.' },
  smoke: { name: 'Smoke', nade: true, price: 300, speed: 6.9, max: 1, col: '#9aa0a6', desc: 'Wall of smoke for 18 s.' },
  molly: { name: 'Molotov', nade: true, price: 400, speed: 6.9, max: 1, reward: 300, col: '#e0742a', desc: 'Bursts into flames. Burns an area for 7 s.' },
  // ---- five more guns (they sit before 'bomb' so the old guns keep their numbers in online play)
  trio: { name: 'Trio', slot: 'sec', price: 450, dmg: 24, rpm: 780, burst: 3, burstGap: 0.26, mag: 15, res: 90, reload: 2.1, speed: 6.7, inacc: 0.6, moveInacc: 2.4, airInacc: 7, pen: 0.5, range: 0.88, recoil: 1.1, rec: 7, reward: 300, tier: 1, snd: [2800, 0.11, 0.9], acc: '#d96a4a', patk: 'burst', first: 0.5, draw: 0.24, desc: 'Burst pistol: three quick shots per click. Cheap and accurate.' },
  duster: { name: 'Duster', slot: 'sec', price: 600, dmg: 24, pellets: 10, cone: 5.5, rpm: 140, mag: 2, res: 20, reload: 2.3, speed: 6.6, inacc: 0.5, moveInacc: 1.5, airInacc: 4, pen: 0.55, range: 0.5, recoil: 4.2, rec: 2.5, reward: 600, tier: 1, snd: [1200, 0.32, 1.7], acc: '#8a5a3a', patk: 'cannon', stagger: 0.6, draw: 0.35, desc: 'Sawed-off double barrel. Two shots, huge spread, deadly up close. $600 per kill.' },
  brute: { name: 'Brute', slot: 'prim', price: 1650, dmg: 31, rpm: 660, auto: true, mag: 40, res: 120, reload: 3.0, speed: 6.2, inacc: 0.8, moveInacc: 2.2, airInacc: 7, pen: 0.72, range: 0.87, recoil: 0.85, rec: 8, reward: 600, tier: 2, snd: [2400, 0.14, 1.1], acc: '#a8472e', patk: 'smg', draw: 0.4, stagger: 0.25, desc: 'Heavy SMG: slower than the Buzz but hits harder. 40 rounds. $600 per kill.' },
  ghost: { name: 'Ghost', slot: 'prim', price: 3100, dmg: 30, rpm: 700, auto: true, mag: 30, res: 90, reload: 2.4, speed: 6.4, inacc: 0.26, moveInacc: 4.2, airInacc: 10, pen: 0.66, range: 0.96, recoil: 0.7, rec: 8, reward: 300, tier: 3, snd: [1200, 0.1, 0.7], acc: '#7a5aa8', quiet: true, patk: 'ghost', first: 0.25, draw: 0.35, desc: 'Suppressed rifle: does not give your position away. Light and quick, less damage than the Raptor.' },
  breaker: { name: 'Breaker', slot: 'prim', price: 2300, dmg: 17, pellets: 8, cone: 4.2, rpm: 300, mag: 8, res: 32, reload: 3.2, shell: 0.38, speed: 6.1, inacc: 0.4, moveInacc: 1.2, airInacc: 4, pen: 0.7, range: 0.6, recoil: 2.6, rec: 4, reward: 900, tier: 3, snd: [1350, 0.28, 1.5], acc: '#d4a02a', patk: 'cannon', stagger: 0.4, draw: 0.45, desc: 'Fast semi-auto shotgun: 8 pellets, quick follow-up shots. $900 per kill.' },
  bomb: { name: 'BOMB BLAST', hidden: true },   // not a gun: only so a bomb kill has a name (keep it LAST: online play numbers the guns by their place in this list)
};
for (const k in WD) if (WD[k].mag) WD[k].pat = pattern(WD[k], k);
const fireMode = (d) => (d.burst ? 'BURST' : d.shell && d.rpm < 100 ? 'PUMP' : d.scope && d.rpm < 100 ? 'BOLT' : d.auto ? (d.spin ? 'AUTO · SPIN-UP' : 'AUTO') : 'SEMI');
// Simple mode keeps 8 guns (a pistol upgrade, an SMG, a shotgun, three rifles, a sniper); Pro mode has all of them
const SIMPLE_GUNS = new Set(['p9', 'viper', 'buzz', 'thumper', 'carbine', 'raptor', 'longbow', 'lmg']);
function gunOK(id) {
  const d = WD[id]; if (!d || !d.mag) return true;   // grenades, gear and the knife are always there
  const ar = MP.on && MP.cfg && MP.cfg.arsenal ? MP.cfg.arsenal : S.arsenal;
  return ar !== 'simple' || SIMPLE_GUNS.has(id);
}
const pickGun = (list) => { const l = list.filter(gunOK); return l.length ? pick(l) : null; };
const GEAR = {
  kevlar: { name: 'Kevlar Vest', price: 650, desc: '100 armor: soaks about a third of body damage' },
  helm: { name: 'Vest + Helmet', price: 1000, desc: 'Armor + a helmet: most headshots no longer kill in one hit (Raptor, Hammer, Viper and snipers still do)' },
  kit: { name: 'Defuse Kit', price: 400, desc: 'Defuse in 5 s (Ops only)' },
  shield: { name: 'Ballistic Shield', price: 1800, desc: 'Select with 5 or the mouse wheel. Left hand holds the shield; right hand holds your pistol. Select another weapon to put it away. It stops every bullet from the front, but you move slower. A rifle or grenade lowers it.' },
};
// the ballistic shield (key 5, Fortnite style) works while it is raised; it stops bullets and stabs that come from inside a 120 degree cone in front
const shieldUp = (v) => !!v.shield && v.alive && !!v.shieldOn;
function shieldFaces(v, from) {
  const dx = from.x - v.pos.x, dz = from.z - v.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) return true;
  return (dx * -Math.sin(v.yaw) + dz * -Math.cos(v.yaw)) / d > 0.5;
}
const KNIFE = { id: 'knife' };
const NADEW = { he: { id: 'he' }, flash: { id: 'flash' }, smoke: { id: 'smoke' }, molly: { id: 'molly' } };
const newGun = (id) => ({ id, mag: WD[id].mag, res: WD[id].res });
function recoilAt(def, f) {
  const p = def.pat; const i = Math.min(Math.floor(f), p.length - 2), k = Math.min(f - i, 1);
  return [p[i][0] + (p[i + 1][0] - p[i][0]) * k, p[i][1] + (p[i + 1][1] - p[i][1]) * k];
}

// ---------------- actors ----------------
const SIDE = [
  { name: 'THUGS', role: 'attack', css: '#edbd72', main: 0xa28d5f, vest: 0xa28d5f, pants: 0x4d4b48, visor: 0xc9b27a },
  { name: 'OPS', role: 'defend', css: '#dfe5ea', main: 0xdfe5ea, vest: 0x22252c, pants: 0x2e3238, visor: 0xf2f5f8 },
];
const sideMats = SIDE.map((s) => ({
  main: new THREE.MeshLambertMaterial({ color: s.main }), vest: new THREE.MeshLambertMaterial({ color: s.vest }),
  pants: new THREE.MeshLambertMaterial({ color: s.pants }), visor: new THREE.MeshLambertMaterial({ color: 0x111118, emissive: s.visor, emissiveIntensity: 0.9 }),
  boot: new THREE.MeshLambertMaterial({ color: 0x222226 }), gun: new THREE.MeshLambertMaterial({ color: 0x2a2d35 }), skin: new THREE.MeshLambertMaterial({ color: 0xf0c8a0 }),
}));
function mbox(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(geoBox, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
function nameTag(a, g) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 34px "Chakra Petch",Arial'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.8)'; x.strokeText(a.name, 128, 44); x.fillStyle = '#9dffb0'; x.fillText(a.name, 128, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }));
  tag.scale.set(1.3, 0.33, 1); tag.position.y = 2.2; tag.renderOrder = 999; g.add(tag); g.userData.nameTag = tag;
}
// What each gun looks like in a soldier's hands (the arms pose and the gun shape come from this class, see tpArms in art.js)
const TPC = { p9: 'pistol', viper: 'pistol', revolver: 'revolver', tec: 'mpistol', buzz: 'smg', chopper: 'smg', thumper: 'shotgun', scatter: 'shotgun', raptor: 'rifle', sentinel: 'rifle', carbine: 'rifle', longbow: 'sniper', ranger: 'sniper', dmr: 'sniper', lmg: 'lmg', trio: 'pistol', duster: 'sawed', brute: 'smg', ghost: 'suppressed', breaker: 'shotgun', knife: 'knife', he: 'nade', flash: 'nade', smoke: 'nade', molly: 'nade' };
// A soldier is a few merged meshes: 2 legs (+2 shins in Pretty/Fast), body, head (Pretty/Fast) and ONE arms+gun mesh whose shape changes with the gun in hand.
// Lite uses straight legs and a body that already includes the head; the knees are empty groups there.
const shieldMats = { body: new THREE.MeshLambertMaterial({ color: 0x2c3a52, flatShading: true }), rim: new THREE.MeshLambertMaterial({ color: 0x14181f, flatShading: true }), glass: new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.3 }) };
function shieldModel() {   // a tall riot shield: dark plate, black frame, a little see-through window near the top
  const g = new THREE.Group(), part = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(geoBox, m); b.scale.set(w, h, d); b.position.set(x, y, z); g.add(b); };
  part(0.78, 0.86, 0.05, 0, -0.145, 0, shieldMats.body); part(0.78, 0.14, 0.05, 0, 0.505, 0, shieldMats.body); part(0.16, 0.15, 0.05, -0.31, 0.36, 0, shieldMats.body); part(0.16, 0.15, 0.05, 0.31, 0.36, 0, shieldMats.body);   // the plate has a real window cut out (so you can see out of it)
  part(0.84, 0.05, 0.08, 0, 0.6, 0, shieldMats.rim); part(0.84, 0.05, 0.08, 0, -0.6, 0, shieldMats.rim);
  part(0.05, 1.25, 0.08, -0.4, 0, 0, shieldMats.rim); part(0.05, 1.25, 0.08, 0.4, 0, 0, shieldMats.rim);
  part(0.46, 0.15, 0.02, 0, 0.36, 0, shieldMats.glass); part(0.5, 0.018, 0.07, 0, 0.44, 0, shieldMats.rim); part(0.5, 0.018, 0.07, 0, 0.28, 0, shieldMats.rim);
  return g;
}
function removeSoldier(a) {
  const m = a.mesh; if (!m) return;
  scene.remove(m.g);
  // Soldier geometry, shield materials and muzzle texture are shared caches.
  // Only the label texture and these two sprite materials belong to this actor.
  const tag = m.g.userData.nameTag;
  if (tag) { tag.material.map.dispose(); tag.material.dispose(); }
  m.flash.material.dispose();
  a.mesh = null;
}
function makeSoldier(a) {
  const lite = LITE, SP = lite ? soldierPartsLite(a.side) : soldierParts(a.side), g = new THREE.Group();
  const mk = (geo, parent) => { const m = new THREE.Mesh(geo, charMat); if (!lite) { m.castShadow = true; m.receiveShadow = true; } parent.add(m); return m; };
  const hip = (x, geo, shin) => { const h = new THREE.Group(); h.position.set(x, 0.62, 0); g.add(h); mk(geo, h); const k = new THREE.Group(); if (shin) { k.position.y = -0.31; h.add(k); mk(shin, k); } return [h, k]; };
  const [legL, kneeL] = lite ? hip(-0.145, SP.legL) : hip(-0.145, SP.thighL, SP.shin), [legR, kneeR] = lite ? hip(0.145, SP.legR) : hip(0.145, SP.thighR, SP.shin);
  const up = new THREE.Group(); g.add(up); mk(lite ? SP.body : SP.torso, up);
  const head = new THREE.Group(); if (!lite) { head.position.set(0, 1.55, 0); up.add(head); mk(SP.head, head); }
  const arms = new THREE.Group(); arms.position.set(0, 1.3, 0); up.add(arms); const armsMesh = mk(tpArms(a.side, 'rifle', lite), arms);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flash.scale.setScalar(0.5); flash.visible = false; arms.add(flash);
  const sh = shieldModel(); sh.position.set(-0.3, 0.95, -0.42); sh.rotation.y = -0.4; sh.scale.setScalar(0.82); sh.visible = false; up.add(sh);   // the ballistic shield, carried on the left arm out in front (the head and gun stay visible)
  if (GS.player && a.squad === GS.player.squad && !a.isPlayer && (!lite || a.human)) nameTag(a, g);   // Lite only labels real players
  removeSoldier(a);
  a.mesh = { g, legL, legR, kneeL, kneeR, up, head, arms, flash, phase: 0, flashT: 0, lite, armsMesh, armsKey: '', sh };
  g.visible = a.alive && !a.isPlayer;
  scene.add(g);
}

const NAMES = ['Pixel', 'Noodle', 'Turbo', 'Waffles', 'Gizmo', 'Biscuit', 'Sprocket', 'Mango', 'Rocket', 'Pickles', 'Nugget', 'Zappy', 'Bolt', 'Taco', 'Nova', 'Scooter',
  'Muffin', 'Zigzag', 'Pepper', 'Cosmo', 'Doodle', 'Fizz', 'Giga', 'Jelly', 'Kiwi', 'Lemon', 'Marble', 'Ninja', 'Orbit', 'Peanut', 'Quark', 'Ripple', 'Sunny', 'Tater', 'Ziggy', 'Bean'];   // (a 10 v 10 match needs 19 bot names)
let aidN = 0;
class Actor {
  constructor(name, squad, isPlayer) {
    Object.assign(this, {
      id: aidN++, name, squad, isPlayer, side: 0, pos: V(), vel: V(), yaw: 0, pitch: 0, hp: 100, armor: 0, helmet: false, kit: false, alive: false,
      money: 800, prim: null, sec: null, nades: { he: 0, flash: 0, smoke: 0, molly: 0 }, slot: 'sec', lastSlot: 'knife', nadeSel: 'he', crouch: false, crouchAmt: 0, walk: false,
      onGround: true, rc: 0, lastShot: -9, nextFire: 0, reloadT: 0, switchT: 0, scoped: 0, rescope: 0, blindT: 0, act: null, kills: 0, deaths: 0, hs: 0, dmg: 0,
      roundKills: 0, stepAcc: 0, mesh: null, brain: null, respawnT: 0, protT: 0, spawnT: 0, spotT: -99, tagT: 0, fullReset: true, shots: 0, hits: 0, idx: -1, human: !!isPlayer, remote: false, pid: -1,
    });
  }
}
const curW = (a) => a.slot === 'prim' ? a.prim : a.slot === 'sec' ? a.sec : a.slot === 'knife' ? KNIFE : NADEW[a.nadeSel];
const curDef = (a) => WD[curW(a).id];
const eyeY = (a) => a.pos.y + 1.55 - 0.42 * a.crouchAmt;
const eyePos = (a, o = V()) => o.set(a.pos.x, eyeY(a), a.pos.z);
const headPos = (a, o = V()) => o.set(a.pos.x, a.pos.y + 1.55 - 0.25 * a.crouchAmt, a.pos.z);
const chestPos = (a, o = V()) => o.set(a.pos.x, a.pos.y + 1.05 - 0.25 * a.crouchAmt, a.pos.z);
const fwd = (yaw, pitch, o = V()) => o.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
const hasNade = (a) => a.nades.he + a.nades.flash + a.nades.smoke + a.nades.molly > 0;
function slotOK(a, s) { return s === 'shield' ? !!a.shield : s === 'prim' ? !!a.prim : s === 'sec' ? !!a.sec : s === 'knife' ? true : hasNade(a); }
function equip(a, s) {
  if (!slotOK(a, s)) return;
  if (s === 'shield') {
    if (a.shieldOn) return;
    equip(a, a.sec ? 'sec' : 'knife'); a.shieldOn = true;
    a.switchT = Math.max(a.switchT, 0.35); a.scoped = 0; a.ads = false;
    if(a.isPlayer) SFX.swap(); return;
  }
  if (a.shieldOn) { a.shieldOn = false; if (a.isPlayer) SFX.swap(); }   // a two-handed gun or a grenade needs both hands: the shield comes down
  if (s === 'nade' && a.slot === 'nade') { cycleNade(a); return; }
  if (a.slot === s) return;
  if (s === 'nade' && !a.nades[a.nadeSel]) cycleNade(a);
  a.lastSlot = a.slot; a.slot = s; a.switchT = s === 'knife' ? 0.25 : (a[s] && WD[a[s].id] && WD[a[s].id].draw) || 0.4; a.reloadT = 0; a.burstLeft = 0; a.scoped = 0; a.rescope = 0; a.act = a.act && a.act.type === 'plant' ? null : a.act;
  if (a.isPlayer) { SFX.swap(); vmSet(); }
}
function cycleNade(a) {
  const order = ['he', 'flash', 'smoke', 'molly']; let i = order.indexOf(a.nadeSel);
  for (let k = 1; k <= 4; k++) { const n = order[(i + k) % 4]; if (a.nades[n]) { a.nadeSel = n; break; } }
  if (a.isPlayer) vmSet();
}
const bestSlot = (a) => a.prim ? 'prim' : a.sec ? 'sec' : 'knife';

// ---------------- viewmodel ----------------
const vmRoot = new THREE.Group(); vmCam.add(vmRoot);
vmScene.environment = ENV;
const skinSaveKey = 'cs.finishes1';
let skinState = {selected:'factory',rewarded:[]};
try { const saved=JSON.parse(localStorage.getItem(skinSaveKey)); if(saved && Array.isArray(saved.rewarded)) skinState=saved; } catch {}
if (skinState.coins === undefined) skinState.coins = 150 + 100 * (skinState.crates | 0);   // start with 150 coins
const CRATE_PRICE = 100;
const knifeOwned = (k) => k.id === 'combat' || skinState.rewarded.includes('knife:' + k.id);
if (!knives.find((k) => k.id === skinState.knife && knifeOwned(k))) skinState.knife = 'combat';
const syncKnifeName = () => { WD.knife.name = (knives.find((k) => k.id === skinState.knife) || knives[0]).name; };
setKnifeStyle(skinState.knife); syncKnifeName();
const COIN = '<span class="coin" role="img" aria-label="coins"></span>';
function refreshCoins() { for (const e of document.querySelectorAll('.coin-n')) e.textContent = skinState.coins | 0; }
function addCoins(n) { skinState.coins = Math.max(0, (skinState.coins | 0) + n); saveFinish(); refreshCoins(); }
const unlocked = f => f.id==='factory' || skinState.rewarded.includes(f.id) || (RANK.m>=3 && RANK.peak>=f.rp);
const equipped = () => finishes.find(f=>f.id===skinState.selected && unlocked(f)) || finishes[0];
function saveFinish() { try {localStorage.setItem(skinSaveKey,JSON.stringify(skinState));} catch {} }
const GM = {};
const vmModels = {};
const vmMat = (key, hex) => fpMat(key === 'body' ? 'poly' : key, hex);
function buildVM(id) {
  const ac = new THREE.Color(WD[id].acc || WD[id].col || '#ffb13d'), hsl = {}; ac.getHSL(hsl); ac.setHSL(hsl.h, hsl.s * 0.3, Math.min(hsl.l, 0.3));   // standard issue is dull gunmetal, never bright
  const b = buildGun(id, ac.getHex());
  if (WD[id].mag || id === 'knife') applyFinish(b.finishMesh, equipped(), id === 'knife' ? 'knife' : undefined);
  GM[id] = b;
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.scale.setScalar(0.28); fl.visible = false; b.mz.add(fl);
  b.g.userData = { mz: b.mz, fl };
  return b.g;
}
let vmCur = null, vmId = '';
const VMS = { sh: 0, ads: 0, spr: 0, kick: 0, bob: 0, swayX: 0, swayY: 0, inspect: 0, slash: 0, flashT: 0, land: 0 };
function vmSet() {
  const P = GS.player; if (!P) return;
  const id = curW(P).id;
  if (id === vmId) return;
  if (vmCur) vmRoot.remove(vmCur);
  vmCur = vmModels[id] || (vmModels[id] = buildVM(id));
  vmRoot.add(vmCur); vmId = id; VMS.inspect = 0;
}

// ---------------- game state ----------------
const DIFF = {
  easy: { react: 0.65, turn: 5, err: 6, settle: 1.6, head: 0.08, spread: 1.5, comp: 0.2, see: 32, nade: 0.2, team: 0.15, lead: 0, peek: 0, rotDelay: 4.5 },
  normal: { react: 0.42, turn: 8, err: 3.6, settle: 2.4, head: 0.15, spread: 1.15, comp: 0.5, see: 42, nade: 0.45, team: 0.5, lead: 0.04, peek: 0.35, rotDelay: 2.4 },
  hard: { react: 0.28, turn: 12, err: 2.1, settle: 3.5, head: 0.25, spread: 1.0, comp: 0.7, see: 50, nade: 0.7, team: 0.8, lead: 0.09, peek: 0.6, rotDelay: 1.3 },
  insane: { react: 0.19, turn: 18, err: 1.2, settle: 5, head: 0.35, spread: 0.9, comp: 0.85, see: 58, nade: 0.9, team: 1, lead: 0.14, peek: 0.85, rotDelay: 0.6 },
};
const GS = {
  state: 'menu', mode: 'comp', actors: [], player: null, round: 0, score: [0, 0], loss: [0, 0], target: 5, halfAt: 4, maxRounds: 8,
  phaseT: 0, roundT: 0, buyLeft: 0, time: 0, core: null, nades: [], smokes: [], fires: [], drops: [], plan: 'a', execute: false, execT: 0, fetcher: null,
  paused: false, deathT: 0, spec: 0, shake: 0, roundStart: 0, rangeHits: 0, rangeShots: 0, rangeHS: 0, killer: null,
};
const D = () => DIFF[S.diff] || DIFF.normal;
const alive = (side) => GS.actors.filter((a) => a.alive && a.side === side);
const enemies = (a) => GS.actors.filter((e) => e.alive && e.side !== a.side);

// the bomb: a C4 (four charge bricks round a keypad and a red timer). On a carrier's back, on the floor when dropped, planted at a site.
// (The game state is still called GS.core so the online messages keep their names.)
const BOMB = buildBomb(), bombMesh = BOMB.group;
const bombLight = new THREE.PointLight(0xff3a2a, 0, 8); bombLight.position.y = 0.5; bombMesh.add(bombLight);
bombMesh.visible = false; scene.add(bombMesh);
const vmShield = shieldModel(); vmShield.scale.setScalar(0.32); vmShield.position.set(-0.18, -0.13, -0.5); vmShield.rotation.set(0, 0.5, 0.04); vmShield.visible = false; vmCam.add(vmShield);
{ // your left hand gripping the handle on the back of the shield, with the sleeve coming in from the bottom corner
  const gl = new THREE.MeshLambertMaterial({ color: 0x1d1a17, flatShading: true });
  const hand = new THREE.Mesh(geoBox, gl); hand.scale.set(0.2, 0.26, 0.16); hand.position.set(0.0, 0.0, 0.13); vmShield.add(hand);
  const grip = new THREE.Mesh(geoBox, shieldMats.rim); grip.scale.set(0.06, 0.34, 0.06); grip.position.set(0.0, 0.0, 0.05); vmShield.add(grip);
  const wrist = new THREE.Vector3(-0.02,-0.08,0.18), elbow = new THREE.Vector3(-1.05,-1.05,1.45);
  const arm = new THREE.Mesh(geoBox, sleeveMat), direction=elbow.clone().sub(wrist);
  arm.scale.set(0.23,direction.length(),0.23);arm.position.copy(wrist).add(elbow).multiplyScalar(.5);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());vmShield.add(arm);
  const thumb = new THREE.Mesh(geoBox,gl);thumb.scale.set(.09,.14,.12);thumb.position.set(.11,.06,.17);vmShield.add(thumb);
}   // your own shield (key 5): on your left arm while the pistol stays in your right hand
const vmBomb = buildBomb(), vmHand = new THREE.Group();   // the bomb in your hands while you plant or defuse (first person)
{
  const glove = new THREE.MeshLambertMaterial({ color: 0x1d1a17, flatShading: true });
  const g1 = new THREE.Mesh(geoBox, glove); g1.scale.set(0.05, 0.05, 0.09); vmHand.add(g1);
  const sl = new THREE.Mesh(geoBox, sleeveMat); sl.scale.set(0.085, 0.085, 0.5); sl.position.set(0, 0.012, 0.3); vmHand.add(sl);
  vmBomb.group.add(vmHand); vmBomb.group.visible = false; vmCam.add(vmBomb.group);
}
const BOMB_TIME = 40;
// beeps get faster as the timer runs down (and a little higher)
function bombBeep(c, dt) {
  c.beepT -= dt;
  const k = clamp(c.timer / BOMB_TIME, 0, 1);
  if (c.beepT <= 0) { c.beepI = 0.1 + 0.9 * Math.pow(k, 1.3); c.beepT = c.beepI; SFX.beep(c.pos, 1 - k); bombLight.intensity = 7; }
  bombLight.intensity *= Math.pow(0.02, dt * 3);
}
function resetCore(carrier) {
  GS.core = { state: carrier ? 'carried' : 'none', carrier, pos: V(), timer: BOMB_TIME, site: null, beepT: 0, beepI: 1, rot: 0, smoked: false, mollied: false };
}

// ---------------- combat ----------------
const _v1 = V(), _v2 = V(), _v3 = V();
function rayActor(o, d, e, maxT) {
  const x = e.pos.x, z = e.pos.z, y = e.pos.y, c = e.crouchAmt;
  let best = null;
  // head sphere
  const hy = y + 1.55 - 0.25 * c, ox = o.x - x, oy = o.y - hy, oz = o.z - z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - 0.22 * 0.22, disc = b * b - cc;
  if (disc > 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) best = { t, part: 'head' }; }
  const boxT = (x0, y0, z0, x1, y1, z1) => {
    let tmin = 0, tmax = maxT;
    for (const [oo, dd, lo, hi] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
      let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd; if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return -1;
    }
    return tmin;
  };
  const bt = boxT(x - 0.3, y + 0.62 - 0.25 * c, z - 0.3, x + 0.3, y + 1.36 - 0.25 * c, z + 0.3);
  if (bt >= 0 && (!best || bt < best.t)) best = { t: bt, part: 'body' };
  const lt = boxT(x - 0.26, y, z - 0.26, x + 0.26, y + 0.62 - 0.25 * c, z + 0.26);
  if (lt >= 0 && (!best || lt < best.t)) best = { t: lt, part: 'legs' };
  return best;
}
function smokeBlocks(p, q) {
  for (const s of GS.smokes) {
    if (s.r < 1.5) continue;
    const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, L2 = dx * dx + dy * dy + dz * dz;
    let t = ((s.x - p.x) * dx + (s.y - p.y) * dy + (s.z - p.z) * dz) / (L2 || 1); t = clamp(t, 0, 1);
    const cx = p.x + dx * t - s.x, cy = p.y + dy * t - s.y, cz = p.z + dz * t - s.z;
    if (cx * cx + cy * cy * 1.6 + cz * cz < s.r * s.r * 0.85) return true;
  }
  return false;
}
function losClear(p, q, smoke = true) {
  const d = _v3.subVectors(q, p), L = d.length(); if (L < 0.01) return true; d.divideScalar(L);
  const h = rayWorld(p, d, L);
  if (h && h.t < L - 0.05) return false;
  return !(smoke && smokeBlocks(p, q));
}
function computeSpread(a, def) {
  let s = def.scope ? (a.scoped ? def.scopedInacc : def.inacc) : def.inacc;
  if (def.scope && a.scoped && def.settle) s += def.inacc * 0.5 * Math.max(0, 1 - (a.scopeAge || 0) / def.settle);   // a scope that was just raised still wobbles
  const sp = Math.hypot(a.vel.x, a.vel.z), mx = def.speed;
  s += def.moveInacc * clamp((sp - mx * 0.34) / (mx * 0.6), 0, 1);
  if (!a.onGround) s += def.airInacc;
  if (a.crouch && a.onGround) s *= 0.72;
  if (a.ads) s *= 0.5;
  if (a.sprint) s += def.moveInacc * (def.runGun ? 0.15 : 0.6);
  s += Math.min(a.rc, 10) * def.recoil * (def.auto ? 0.05 : 0.2);
  if (def.bloom) s += Math.min(a.rc, 30) * def.bloom;   // the longer you hold it down, the wilder it gets
  if (def.first && a.rc < 0.5) s *= def.first;           // the first bullet of a spray is extra accurate
  if ((a.suppT || 0) > GS.time) s *= 1.4;                // somebody is shooting past your head
  return s;
}
function noiseEvent(pos, radius, src) {
  for (const b of GS.actors) if (b.brain && b.alive && b.side !== src.side && b.pos.distanceTo(pos) < radius) { const dh = b.pos.distanceTo(pos), j = Math.min(6, dh * 0.1); b.brain.heardPos = pos.clone(); b.brain.heardPos.x += rand(-j, j); b.brain.heardPos.z += rand(-j, j); b.brain.heardT = GS.time; }   // you hear roughly where, not exactly
}
function fireWeapon(a, cont) {   // cont: this is the 2nd / 3rd bullet of a burst
  const w = curW(a), def = WD[w.id];
  if (w.mag <= 0) { if (a.isPlayer) SFX.dry(); startReload(a); a.nextFire = GS.time + 0.25; a.burstLeft = 0; return; }
  if (a.reloadT > 0 && def.shell) { a.reloadT = 0; a.reloadMax = 0; }   // pump guns: shooting cancels the shell-by-shell reload
  w.mag--; a.shots++;
  let gap = 60 / def.rpm;
  if (def.spin) { a.spinN = GS.time - a.lastShot < def.spin * 1.8 ? (a.spinN || 0) + 1 : 0; gap = Math.max(gap, def.spin * Math.pow(0.76, a.spinN)); }   // the LMG winds up: slow, then faster and faster
  if (def.burst) { if (!cont) a.burstLeft = Math.min(def.burst - 1, w.mag); else a.burstLeft--; if (a.burstLeft <= 0) { a.burstLeft = 0; gap += def.burstGap; } }
  a.nextFire = GS.time + gap;
  const spread = computeSpread(a, def) * (a.brain ? D().spread : 1);
  const [rp, ry] = recoilAt(def, a.rc);
  const comp = a.brain ? Math.min(0.9, D().comp * clamp(1.2 - 0.065 * a.rc, 0.25, 1) / Math.sqrt(a.brain.aimSk || 1)) : 0;   // spray control gets worse the longer the burst
  const baseP = a.pitch + rp * DEG * (a.isPlayer ? 1 : 1 - comp), baseY = a.yaw + ry * DEG * (a.isPlayer ? 1 : 1 - comp);
  a.rc += 1; a.lastShot = GS.time;
  const o = eyePos(a);
  const n = def.pellets || 1;
  let anyHit = false, d0 = null;
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(Math.random()) * (def.pellets ? def.cone : spread) * DEG + (def.pellets ? Math.random() * spread * 0.3 * DEG : 0);
    const th = Math.random() * Math.PI * 2;
    const d = fwd(baseY + Math.cos(th) * r, baseP + Math.sin(th) * r);
    if (i === 0) d0 = d.clone();
    if (traceShot(a, o, d, def, w.id, i === 0)) anyHit = true;
  }
  if (MP.on && d0) { if (MP.role === 'host') MPH.shotFx(a, w.id, o, d0); else if (a.isPlayer) MPH.clientShot(a, w.id, o, d0); }
  if (anyHit) a.hits++;
  if (def.quiet) SFX.suppressed(a.pos, a.isPlayer); else SFX.shot(def.snd, a.pos, a.isPlayer);
  noiseEvent(a.pos, def.quiet ? 22 : 45, a);
  if (a.isPlayer) {
    VMS.kick = Math.min(1, VMS.kick + 0.15 + def.recoil * 0.14);
    padRumble(0.2, def.scope || def.pellets ? 0.7 : 0.3, def.scope ? 120 : 60);
    if (vmCur) { vmCur.userData.fl.visible = true; vmCur.userData.fl.material.rotation = Math.random() * 6; VMS.flashT = 0.045; }
    muzzleLight.position.copy(o).addScaledVector(fwd(a.yaw, a.pitch), 1); muzzleLight.intensity = 6;
    if (def.scope && a.scoped) { a.rescope = a.scoped; a.scoped = 0; }
    GS.rangeShots++;
  } else if (a.mesh) { a.mesh.flash.visible = true; a.mesh.flashT = 0.05; a.mesh.flash.material.rotation = Math.random() * 6; }
  if (w.mag === 0 && w.res > 0) setTimeout(() => { if (a.alive && curW(a) === w && w.mag === 0) startReload(a); }, 250);
}
function shotDamage(def, part, dist) {
  if (part === 'head') return Math.max(def.dmg * 4, 100);   // a headshot with no helmet is always a kill; a helmet takes some of it back (see damage())
  return def.dmg * Math.pow(def.range, dist / 10) * (part === 'legs' ? 0.75 : 1);
}
// a LMG bullet that misses still shakes enemies it passes close to
function suppressNear(a, o, d, tEnd) {
  for (const e of GS.actors) {
    if (!e.alive || e.side === a.side) continue;
    const dx = e.pos.x - o.x, dy = e.pos.y + 1.1 - o.y, dz = e.pos.z - o.z, t = dx * d.x + dy * d.y + dz * d.z;
    if (t < 1 || t > tEnd) continue;
    const px = dx - d.x * t, py = dy - d.y * t, pz = dz - d.z * t;
    if (px * px + py * py + pz * pz < 2.6 * 2.6) {
      e.suppT = GS.time + 0.7;
      if (e.isPlayer) GS.shake = Math.max(GS.shake, 0.1);
      else if (e.brain) e.brain.react = Math.max(e.brain.react, 0.1);
    }
  }
}
function traceShot(a, o, d, def, wid, showTracer) {
  const hw = rayWorld(o, d, 220), tW = hw ? hw.t : 220;
  let best = null;
  for (const e of GS.actors) {
    if (!e.alive || e === a || (e.side === a.side && GS.mode !== 'range')) continue;
    if (Math.abs(e.pos.x - o.x) > tW + 2 && Math.abs(e.pos.z - o.z) > tW + 2) continue;
    const h = rayActor(o, d, e, tW);
    if (h && (!best || h.t < best.t)) best = { ...h, e };
  }
  const end = _v1.copy(o).addScaledVector(d, best ? best.t : tW);
  if (showTracer) {
    const start = a.isPlayer ? _v2.copy(o).addScaledVector(fwd(a.yaw, a.pitch), 0.6).add(_v3.set(Math.cos(a.yaw) * 0.12, -0.12, -Math.sin(a.yaw) * 0.12)) : _v2.copy(o).addScaledVector(d, 0.8);
    if (!a.isPlayer || Math.random() < 0.5) tracer(start, end);
  }
  if (best) {
    const e = best.e, sc = SIDE[e.side];
    const dmg = shotDamage(def, best.part, best.t);
    if (shieldUp(e) && shieldFaces(e, a.pos) && wid !== 'bomb') burst(end.x, end.y, end.z, 5, 3, ['#ffffff', '#ffe27a', '#bcd7ff'], 0.04, 0.25, 10);   // the shield catches it: bright sparks, not the dark team-coloured chips (those looked like black bugs floating in front of the shield)
    else burst(end.x, end.y, end.z, best.part === 'head' ? 14 : 7, 4, ['#ffffff', '#' + sc.main.toString(16).padStart(6, '0'), '#ffe27a'], 0.06, 0.35, 10);
    damage(e, dmg, a, best.part, wid, d);
    return true;
  }
  if (def.suppress) suppressNear(a, o, d, tW);
  if (hw) {
    const n = _v3.set(hw.nx, hw.ny, hw.nz);
    decal(end, n);
    burst(end.x + n.x * 0.05, end.y + n.y * 0.05, end.z + n.z * 0.05, 5, 3.5, ['#e8d2a8', '#c9a676', '#fff2c0'], 0.06, 0.4, 12);
  }
  return false;
}
function damage(v, amt, att, part, wid, dir) {
  if (MP.role === 'client') {   // clients only report what they hit; the host works out the damage
    if (att && att.isPlayer && v !== att && v.alive && att.side !== v.side) { showHit(part === 'head' ? 'hs' : '', false); if (part === 'head') SFX.head(); else SFX.hit(); MPH.claim(v, amt, att, part, wid); }
    return;
  }
  if (!v.alive || v.protT > 0) return;
  if (att && att !== v && att.side === v.side && GS.mode !== 'range') return;
  if (att && att !== v && wid !== 'bomb' && wid !== 'he' && wid !== 'molly' && shieldUp(v) && shieldFaces(v, att.pos)) {   // the ballistic shield catches it
    if (v.isPlayer || att.isPlayer) SFX.armorHit();
    v.tagT = Math.max(v.tagT, 0.1); return;
  }
  if (att && att !== v && GS.mode === 'comp' && GS.state === 'live' && wid !== 'bomb' && wid !== 'he' && wid !== 'molly') {   // no shooting out of your own spawn room
    const z = zoneAt(att.pos.x, att.pos.z);
    if (z === (att.side === 0 ? 'T' : 'D') && zoneAt(v.pos.x, v.pos.z) !== z) { if (att.isPlayer && GS.time - (GS.spawnMsgT || -9) > 4) { GS.spawnMsgT = GS.time; toast('Move out of your spawn to fight'); } return; }
  }
  let dmg = amt;
  const armored = part !== 'legs' && wid !== 'bomb' && (part === 'head' ? v.helmet : v.armor > 0);   // the helmet guards the head even once the vest is worn out
  if (armored) {   // the vest soaks bullet damage; rifles, SMGs and LMGs (pen 0.6 to 0.87) lose another 12% to a vest on the body, while snipers and hand cannons (0.87+) punch through and pistols were already weak against it
    let pen = (WD[wid] && WD[wid].pen) || 0.5; if (part !== 'head' && pen >= 0.6 && pen < 0.87) pen -= 0.12;
    const real = dmg * pen; v.armor = Math.max(0, v.armor - (dmg - real) * 0.5); dmg = real;
  }
  dmg = Math.min(dmg, v.hp);
  v.hp -= dmg; v.tagT = Math.max(v.tagT, (WD[wid] && WD[wid].stagger) || 0.3);
  if (att && att !== v) att.dmg += dmg;
  if (att && att.isPlayer && att !== v) {
    showHit(part === 'head' ? 'hs' : '', v.hp <= 0);
    if (part === 'head') SFX.head(); else SFX.hit();
    if (GS.mode === 'range') { GS.rangeHits++; if (part === 'head') GS.rangeHS++; }
  }
  if (v.isPlayer) {
    hurtFx(dmg, att, dir);
    if ((part === 'head' && v.helmet) || (armored && dmg < amt * 0.9)) SFX.armorHit(); else SFX.hurt();   // the vest clanks when it takes a hit
    v.pitch += 0.6 * DEG * Math.min(3, dmg / 20);
  } else if (v.remote && MPH) MPH.hurt(v, dmg, att, part === 'head');
  if (v.brain && att && att !== v) { v.brain.hurtT = GS.time; v.brain.hurtBy = att; v.brain.heardPos = att.pos.clone(); v.brain.heardT = GS.time; }
  if (v.hp <= 0.5) kill(v, att, wid, part === 'head');
}
// everything you see and hear when someone is eliminated (runs on every player's machine)
function killFx(v, k, wid, hs, quiet) {
  if (v.mesh) v.mesh.g.visible = false;
  const c = SIDE[v.side], hx = (n) => '#' + n.toString(16).padStart(6, '0');
  const p = v.pos;
  if (!quiet) {
    for (let i = 0; i < (LITE ? 14 : LOW ? 22 : 46); i++) {
      const y = p.y + rand(0.1, 1.8);
      spawnP(p.x + rand(-0.3, 0.3), y, p.z + rand(-0.3, 0.3), rand(-4, 4), rand(2, 7), rand(-4, 4), rand(1.2, 2.4), rand(0.08, 0.2), pick([hx(c.main), hx(c.main), hx(c.vest), hx(c.pants), '#222226', hx(c.visor)]), 16);
    }
    burst(p.x, p.y + 1.1, p.z, 24, 7, ['#ffffff', '#ffe27a', '#9dffb0', '#ff9ad5', '#7ad7ff'], 0.06, 0.9, 6, 2);
    SFX.pop(p);
  }
  feed(k, v, wid, hs);
  if (v.isPlayer) { v.act = null; v.scoped = 0; GS.deathT = GS.time; GS.killer = k; vmRoot.visible = false; $('scope').classList.add('hidden'); }
  if (k && k.isPlayer && k !== v) {
    SFX.kill();
    const msg = $('killmsg'); const st = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL', 'ACE!'][Math.min(k.roundKills, 5)];
    const pts = GS.mode === 'comp' ? ((WD[wid] && WD[wid].reward) || 300) : 100;
    msg.innerHTML = `<div class="kbig">${hs ? 'HEADSHOT' : wid === 'knife' ? 'STABBED' : 'ELIMINATED'}</div><div class="kpts">+${pts}</div><div class="k">${v.name}</div>` + (st && GS.mode === 'comp' ? `<div class="streak">${st}</div>` : '');
    if (st && GS.mode === 'comp') SFX.streak();
    clearTimeout(msg._t); msg._t = setTimeout(() => (msg.innerHTML = ''), 1800);
  }
}
function kill(v, k, wid, hs) {
  v.alive = false; v.hp = 0; v.deaths++; v.act = null; v.scoped = 0;
  if (k && k !== v && k.side !== v.side) {
    k.kills++; if (hs) k.hs++; k.roundKills++;
    if (GS.mode === 'comp') addMoney(k, (WD[wid] && WD[wid].reward) || 300, 'elimination');
    if (GS.mode === 'dm') { GS.score[k.squad]++; if (GS.score[k.squad] >= GS.target) endMatch(); }
  }
  if (GS.mode === 'comp') {
    const drop = v.prim || (v.sec && v.sec.id !== 'p9' ? v.sec : null);
    if (drop && !MP.on) addDrop(drop, v.pos);
    if (GS.core.carrier === v) dropCore(v);
  }
  if (v.brain && k && k !== v && k.side !== v.side && GS.mode === 'comp' && GS.state === 'live') { teamCall(v, k.pos, 32, 4, 0.9); if (NB) noteEnemy(v.side, k.pos, 'k' + k.id, 1); }
  killFx(v, k, wid, hs);
  if (MP.role === 'host') MPH.killEvent(v, k, wid, hs);
  if (GS.mode === 'range') { GS.score[0]++; setTimeout(() => { if (GS.mode === 'range' && GS.state === 'live') spawnDummy(v); }, 400); }
  if (GS.mode === 'dm') v.respawnT = (v.isPlayer || v.remote) ? 3 : rand(2, 3.5);
}
function moneyPop(amt, why) {
  const d = document.createElement('div'); d.textContent = `+$${amt} ${why}`; d.style.color = '#7dff9a';
  $('moneyPop').appendChild(d); setTimeout(() => d.remove(), 2600);
}
function addMoney(a, amt, why) {
  if (GS.mode !== 'comp') return;
  const before = a.money; a.money = clamp(a.money + amt, 0, 16000);
  if (a.money === before) return;
  if (a.isPlayer) moneyPop(a.money - before, why);
  else if (a.remote && MPH) MPH.money(a, a.money - before, why);
}
function startReload(a) {
  const w = curW(a); if (!w || !WD[w.id].mag || a.reloadT > 0 || w.res <= 0 || w.mag >= WD[w.id].mag) return;
  const def = WD[w.id];
  a.reloadT = a.reloadMax = def.shell ? def.shell + 0.2 : def.reload; a.scoped = 0; a.rescope = 0; a.burstLeft = 0;
  if (a.isPlayer) { SFX.reload(0); if (!def.shell) setTimeout(() => a.reloadT > 0 && SFX.reload(1), def.reload * 600); }
}
function finishReload(a) {
  const w = curW(a), def = WD[w.id];
  if (def.shell) {   // one shell per step; keeps going until full (or you shoot)
    w.mag++; w.res--;
    if (a.isPlayer) SFX.reload(1);
    if (w.mag < def.mag && w.res > 0) { a.reloadT = a.reloadMax = def.shell; if (a.isPlayer) SFX.reload(0); }
    return;
  }
  const need = def.mag - w.mag, take = Math.min(need, w.res);
  w.mag += take; w.res -= take;
}
function melee(a, heavy) {
  a.nextFire = GS.time + (heavy ? 1.0 : 0.45);
  if (a.isPlayer) { VMS.slash = 1; SFX.knife(a.pos, true); }
  const o = eyePos(a), d = fwd(a.yaw, a.pitch);
  let best = null;
  for (const e of GS.actors) {
    if (!e.alive || e === a || (e.side === a.side && GS.mode !== 'range')) continue;
    const h = rayActor(o, d, e, 2.1);
    if (h && (!best || h.t < best.t)) best = { ...h, e };
  }
  if (best) {
    const behind = Math.cos(angDiff(best.e.yaw, a.yaw)) > 0.5;
    damage(best.e, heavy ? (behind ? 180 : 65) : (behind ? 90 : 40), a, 'body', 'knife', d);
    burst(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t, 8, 3, ['#fff', '#ffe27a'], 0.06, 0.3);
  } else {
    const hw = rayWorld(o, d, 2.0);
    if (hw) { const p = _v1.copy(o).addScaledVector(d, hw.t); burst(p.x, p.y, p.z, 5, 3, ['#e8d2a8', '#fff'], 0.05, 0.3); SFX.tick(p); }
  }
}

// grenades
const nadeMeshes = {};
function spawnNade(a, type, p, v, id, fake) {
  const m = new THREE.Mesh(geoBox, new THREE.MeshLambertMaterial({ color: WD[type].col })); m.scale.set(0.12, 0.15, 0.12); m.castShadow = true; scene.add(m);
  const n = { type, x: p[0], y: p[1], z: p[2], vx: v[0], vy: v[1], vz: v[2], t: 0, owner: a, m, still: 0, id, fake: !!fake };
  GS.nades.push(n); return n;
}
function throwNade(a, type, dir, speed) {
  if (!a.nades[type]) return;
  a.nades[type]--;
  const o = eyePos(a).addScaledVector(dir, 0.4);
  const tv = [dir.x * speed + a.vel.x * 0.6, dir.y * speed + 1.5, dir.z * speed + a.vel.z * 0.6];
  if (MP.role === 'client') { const id = MPH.clientNade(a, type, o.x, o.y, o.z, tv[0], tv[1], tv[2]); spawnNade(a, type, [o.x, o.y, o.z], tv, id, true); }
  else { const n = spawnNade(a, type, [o.x, o.y, o.z], tv, ++MP.nid, false); if (MP.role === 'host') MPH.nadeEvent(n); }
  a.nextFire = GS.time + 0.8;
  if (a.isPlayer) { SFX.pin(); VMS.slash = 0.7; }
  if (!hasNade(a)) { if (a.slot === 'nade') { a.slot = a.lastSlot !== 'nade' && slotOK(a, a.lastSlot) ? a.lastSlot : bestSlot(a); a.switchT = 0.4; if (a.isPlayer) vmSet(); } }
  else if (!a.nades[a.nadeSel]) cycleNade(a);
}
function updateNades(dt) {
  for (let i = GS.nades.length - 1; i >= 0; i--) {
    const n = GS.nades[i]; n.t += dt;
    const sub = 4, h = dt / sub;
    for (let s = 0; s < sub; s++) {
      n.vy -= 15 * h;
      let nx = n.x + n.vx * h, nz = n.z + n.vz * h;
      if (hPos(nx, n.z) > n.y) { n.vx = -n.vx * 0.45; nx = n.x; if (Math.abs(n.vx) > 1) SFX.bounce(n); }
      if (hPos(n.x, nz) > n.y) { n.vz = -n.vz * 0.45; nz = n.z; if (Math.abs(n.vz) > 1) SFX.bounce(n); }
      if (hPos(nx, nz) > n.y) { nx = n.x; nz = n.z; n.vx *= -0.4; n.vz *= -0.4; }
      n.x = nx; n.z = nz; n.y += n.vy * h;
      const g = hPos(n.x, n.z);
      if (n.y < g + 0.07) { if (n.type === 'molly' && n.vy < -1.5) n.landed = true; n.y = g + 0.07; if (n.vy < -2) SFX.bounce(n); n.vy = -n.vy * 0.35; n.vx *= 0.7; n.vz *= 0.7; if (Math.abs(n.vy) < 1) n.vy = 0; }
    }
    n.m.position.set(n.x, n.y, n.z); n.m.rotation.x += dt * 8; n.m.rotation.z += dt * 5;
    const spd = Math.hypot(n.vx, n.vy, n.vz);
    if (spd < 0.3) n.still += dt;
    const go = n.fake ? n.t > 7 : n.type === 'smoke' ? (n.still > 0.4 && n.t > 1) || n.t > 3.5 : n.type === 'molly' ? (n.landed && n.t > 0.3) || n.t > 2.8 : n.t > 1.6;
    if (go) { if (!n.fake) { detonate(n); if (MP.role === 'host') MPH.detEvent(n); } scene.remove(n.m); n.m.material.dispose(); GS.nades.splice(i, 1); }
  }
}
function detonate(n, fxOnly) {
  const p = V().set(n.x, n.y + 0.2, n.z);
  if (n.type === 'he') {
    explosionFx(p, false); SFX.boom(p, false); GS.shake = Math.max(GS.shake, 0.4 / (1 + GS.player.pos.distanceTo(p) / 6));
    for (const e of GS.actors) {
      if (!e.alive || fxOnly) continue;
      const c = chestPos(e), d = c.distanceTo(p);
      if (d > 7.8 || !losClear(p, c, false)) continue;
      if (e !== n.owner && e.side === n.owner.side && GS.mode !== 'range') continue;
      const lethal = 4.4, hit = d <= lethal ? 500 : 100 * Math.pow(1 - (d - lethal) / 3.4, 1.2);   // inside 4.4 m = one shot
      damage(e, hit * (e === n.owner ? 0.5 : 1), n.owner, 'body', 'he', c.clone().sub(p).normalize());
    }
    if (!fxOnly) noiseEvent(p, 50, n.owner);
  } else if (n.type === 'flash') {
    SFX.flashbang(p);
    burst(p.x, p.y, p.z, 30, 10, ['#ffffff', '#e8f4ff'], 0.05, 0.5, 4);
    explosionFx(p, false, 0xffffff);
    for (const e of GS.actors) {
      if (!e.alive || (fxOnly && !e.isPlayer)) continue;
      const ep = eyePos(e), d = ep.distanceTo(p);
      if (d > 32 || !losClear(p, ep)) continue;
      const to = _v1.subVectors(p, ep).normalize(), dot = to.dot(fwd(e.yaw, e.pitch));
      let t = (dot > 0.35 ? 3.4 : dot > -0.2 ? 1.4 : 0.45) * (1 - d / 40);
      if (e.side === n.owner.side && e !== n.owner && e.brain) t *= 0.5;
      if (t > e.blindT) e.blindT = t;
      if (e.isPlayer && t > 0.8) SFX.ring(Math.min(t, 2.5));
    }
    if (!fxOnly && n.owner.brain && GS.mode === 'comp') teamCall(n.owner, p, 32, 2.6, 0.8);
  } else if (n.type === 'molly') {
    SFX.boom(p, false); explosionFx(p, false, 0xff7a1a); if (!fxOnly) noiseEvent(p, 30, n.owner);
    const f = { x: n.x, y: hPos(n.x, n.z), z: n.z, r: 2.7, t: 7, tick: 0.1, owner: n.owner, disc: null };
    f.disc = new THREE.Mesh(new THREE.CircleGeometry(f.r, 24), new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.disc.rotation.x = -Math.PI / 2; f.disc.position.set(f.x, f.y + 0.05, f.z); scene.add(f.disc); GS.fires.push(f);
  } else {
    SFX.smoke(p);
    const s = { x: n.x, y: n.y + 1.2, z: n.z, r: 0, t: 18, sprites: [] };
    const k = LITE ? 10 : LOW ? 16 : 30;
    for (let i = 0; i < k; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xcfd3d9, transparent: true, opacity: 0, depthWrite: false }));
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 2.6;
      sp.userData = { ox: Math.cos(a) * r, oy: rand(-0.9, 1.4), oz: Math.sin(a) * r, sz: rand(2.6, 3.8) };
      scene.add(sp); s.sprites.push(sp);
    }
    GS.smokes.push(s);
  }
}
function updateFires(dt) {
  for (let i = GS.fires.length - 1; i >= 0; i--) {
    const f = GS.fires[i]; f.t -= dt; f.tick -= dt;
    if (Math.random() < dt * (LITE ? 18 : 45)) spawnP(f.x + rand(-f.r, f.r) * 0.8, f.y + 0.1, f.z + rand(-f.r, f.r) * 0.8, rand(-0.3, 0.3), rand(1.6, 3.4), rand(-0.3, 0.3), rand(0.3, 0.7), rand(0.1, 0.24), pick(['#ffcf4a', '#ff8a2a', '#ff5a1a']), -2);
    f.disc.material.opacity = (0.32 + 0.16 * Math.sin(GS.time * 13 + i)) * Math.min(1, f.t / 1.2);
    if (f.tick <= 0 && MP.role !== 'client') {
      f.tick = 0.4;
      for (const e of GS.actors) {
        if (!e.alive || Math.hypot(e.pos.x - f.x, e.pos.z - f.z) > f.r || e.pos.y > f.y + 0.9) continue;
        if (e !== f.owner && e.side === f.owner.side && GS.mode !== 'range') continue;
        damage(e, 9, f.owner, 'legs', 'molly', null);
      }
    }
    if (f.t <= 0) { scene.remove(f.disc); f.disc.geometry.dispose(); f.disc.material.dispose(); GS.fires.splice(i, 1); }
  }
}
function updateSmokes(dt) {
  for (let i = GS.smokes.length - 1; i >= 0; i--) {
    const s = GS.smokes[i]; s.t -= dt;
    s.r = Math.min(3.6, s.r + dt * 3.5);
    const k = s.r / 3.6, fade = clamp(s.t / 2, 0, 1);
    for (const sp of s.sprites) {
      const u = sp.userData;
      sp.position.set(s.x + u.ox * k, s.y + u.oy * k, s.z + u.oz * k);
      sp.scale.setScalar(u.sz * (0.4 + 0.6 * k));
      sp.material.opacity = 0.92 * fade;
    }
    if (s.t <= 0) { for (const sp of s.sprites) { scene.remove(sp); sp.material.dispose(); } GS.smokes.splice(i, 1); }
  }
}

// dropped weapons
function addDrop(w, p) {
  const id = w.id, def = WD[id];
  const g = new THREE.Group();
  mbox(g, 0.1, 0.12, def.slot === 'prim' ? 0.8 : 0.35, vmMat('body'), 0, 0, 0);
  mbox(g, 0.11, 0.04, def.slot === 'prim' ? 0.5 : 0.25, vmMat('acc', new THREE.Color(def.acc).getHex()), 0, 0.07, 0);
  g.position.set(p.x + rand(-0.4, 0.4), hPos(p.x, p.z) + 0.1, p.z + rand(-0.4, 0.4)); g.rotation.y = Math.random() * 6;
  scene.add(g);
  const d = { w: { id, mag: w.mag, res: w.res }, g, t: 0 }; GS.drops.push(d); return d;
}
function clearDrops() { for (const d of GS.drops) scene.remove(d.g); GS.drops = []; }
function takeDrop(a, d) {
  a.buyLog = [];
  const def = WD[d.w.id], slot = def.slot;
  if (a[slot]) addDrop(a[slot], a.pos);
  a[slot] = d.w; scene.remove(d.g); GS.drops.splice(GS.drops.indexOf(d), 1);
  if (a.isPlayer) { SFX.swap(); equip(a, slot); vmSet(); }
  else a.slot = slot;
}
function dropCurrent(a) {
  a.buyLog = [];
  const s = a.slot; if (s !== 'prim' && s !== 'sec') return;
  addDrop(a[s], _v1.copy(a.pos).addScaledVector(fwd(a.yaw, 0), 1.2));
  a[s] = null; a.slot = bestSlot(a); a.switchT = 0.3; if (a.isPlayer) vmSet();
}
function dropCore(a) {
  const c = GS.core; c.state = 'dropped'; c.carrier = null; c.rot = Math.random() * 6.28; c.pos.set(a.pos.x, hPos(a.pos.x, a.pos.z), a.pos.z);
  if (a.isPlayer && a.alive) { c.pos.addScaledVector(fwd(a.yaw, 0), 1.5); c.pos.y = hPos(c.pos.x, c.pos.z); if (c.pos.y > 2.5) c.pos.set(a.pos.x, a.pos.y, a.pos.z); }
  const bots = alive(0).filter((b) => b.brain);
  GS.fetcher = bots.sort((x, y) => x.pos.distanceTo(c.pos) - y.pos.distanceTo(c.pos))[0] || null;
}

// ---------------- match / round flow ----------------
function clearWorld() {
  for (const n of GS.nades) { scene.remove(n.m); n.m.material.dispose(); }
  for (const s of GS.smokes) for (const sp of s.sprites) { scene.remove(sp); sp.material.dispose(); }
  for (const f of GS.fires) { scene.remove(f.disc); f.disc.geometry.dispose(); f.disc.material.dispose(); } GS.nades = []; GS.smokes = []; GS.fires = []; clearDrops(); parts.length = 0; pMesh.count = 0;
  for (const tr of tracers) { tr.t = 0; tr.m.visible = false; }
  decals.count = 0; dI = 0; clearPings(); MARKS.length = 0;
  for (const b of booms) { if (b.m) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); } if (b.l) b.l.intensity = 0; } booms.length = 0;   // leftover explosion spheres (the render loop normally removes them; a headless simulation never runs it)
}
function startMatch() {
  setMusic(false); GS.tutorial = false; if (menuLights) for (const l of menuLights) l.visible = false; if (menuActor && menuActor.mesh) menuActor.mesh.g.visible = false;
  setMap(S.map);
  for (const a of GS.actors) removeSoldier(a);
  GS.actors = []; clearWorld();
  GS.mode = S.mode; GS.score = [0, 0]; GS.loss = [0, 0]; GS.round = 0;
  GS.target = GS.mode === 'dm' ? lenOf(S.length).dm : lenOf(S.length).target;
  GS.halfAt = GS.target - 1; GS.maxRounds = 2 * (GS.target - 1);
  const pSide = S.side === 'atk' ? 0 : S.side === 'def' ? 1 : (Math.random() < 0.5 ? 0 : 1);
  const names = shuffle(NAMES.slice());
  const P = new Actor('You', 0, true); P.side = pSide; GS.player = P; GS.actors.push(P);
  if (GS.mode !== 'range') {
    for (let i = 0; i < S.tMine - 1; i++) { const a = new Actor(names.pop(), 0, false); a.side = pSide; a.brain = newBrain(a, i); GS.actors.push(a); }
    for (let i = 0; i < S.tFoe; i++) { const a = new Actor(names.pop(), 1, false); a.side = 1 - pSide; a.brain = newBrain(a, i); GS.actors.push(a); }
  }
  for (const a of GS.actors) { makeSoldier(a); a.money = 800; }
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing');
  nextHUD = nextBoard = 0;
  GS.paused = false; resetCore(null); GS.rankWhy = GS.mode !== 'comp' ? '' : S.ranked === 'off' ? 'off' : !evenTeams(S.tMine, S.tFoe) ? 'sizes' : ''; GS.rankDone = GS.mode !== 'comp' || !!GS.rankWhy; GS.rankMates = 0; GS.menuMsg = '';   // an Unranked match never changes your rank
  if (GS.mode === 'comp') startRound();
  else if (GS.mode === 'dm') { GS.state = 'live'; GS.roundT = lenOf(S.length).dmTime; for (const a of GS.actors) dmSpawn(a); banner('DEATHMATCH', `First squad to ${GS.target} eliminations · B = free guns for 10 s after spawn`); }
  else startRange();
  lock();
}
function spawnAt(a, cells, used) {
  let c = null;
  for (let k = 0; k < 120 && !c; k++) {
    const gap = k < 40 ? 2.4 : k < 80 ? 1.6 : 1.0;   // a big team squeezes closer together once the spawn room fills up
    const t = pick(cells), x = cellX(t) + rand(-0.4, 0.4), z = cellZ(t) + rand(-0.4, 0.4);
    if (used.every((u) => Math.hypot(u[0] - x, u[1] - z) > gap)) c = [x, z];
  }
  if (!c) { const t = pick(cells); c = [cellX(t), cellZ(t)]; }
  used.push(c);
  a.pos.set(c[0], 0, c[1]); a.vel.set(0, 0, 0);
  a.yaw = Math.atan2(-(W - a.pos.x), -(H - a.pos.z)); a.pitch = 0;
}
function resetActorForRound(a) {
  if (a.fullReset || !a.alive) {
    a.prim = null; a.sec = newGun('p9'); a.nades = { he: 0, flash: 0, smoke: 0, molly: 0 }; a.armor = 0; a.helmet = false; a.kit = false; a.shield = false; a.shieldOn = false;
  } else if (a.prim) { /* survivors keep gear */ }
  a.fullReset = false; a.buyLog = [];
  a.hp = 100; a.alive = true; a.act = null; a.blindT = 0; a.reloadT = 0; a.switchT = 0; a.rc = 0; a.scoped = 0; a.rescope = 0; a.roundKills = 0; a.crouch = false; a.crouchAmt = 0; a.tagT = 0;
  a.slot = bestSlot(a); a.onGround = true;
  if (a.mesh) a.mesh.g.visible = !a.isPlayer;
}
function startRound() {
  const half = GS.round === GS.halfAt;
  if (half) {
    for (const a of GS.actors) { a.side = 1 - a.side; a.fullReset = true; a.money = 800; makeSoldier(a); }
    GS.loss = [0, 0];
  }
  GS.round++; ffOff = false;
  GS.rushAt = Math.random() < 0.15 ? rand(14, 28) : 999;
  clearWorld();
  GS.state = 'freeze';
  GS.phaseT = 5;
  GS.roundT = 105 + MAP.roundBonus; GS.buyLeft = 20; GS.execute = false; GS.execT = 0; GS.fetcher = null; GS.roundStart = GS.time; GS.deathT = 0;
  const used = [[], []];
  for (const a of GS.actors) { resetActorForRound(a); spawnAt(a, a.side === 0 ? SPAWN.T : SPAWN.D, used[a.side]); a.mesh.g.visible = !a.isPlayer; }
  { let pl = Math.random() < 0.5 ? 'a' : 'b'; if (pl === GS.lastPlan && Math.random() < 0.6) pl = pl === 'a' ? 'b' : 'a'; GS.plan = GS.lastPlan = pl; }
  const atk = alive(0);
  const humanAtk = atk.filter((a) => a.human), mustHuman = (MP.on && MP.cfg ? MP.cfg.bomb : S.bomb) === 'player';   // setting: a real player (you or a friend) always gets the bomb
  resetCore(pick(mustHuman && humanAtk.length ? humanAtk : atk));
  if (NB) setupBrains2(); else setupBrains();
  GS.buyMode = [teamBuyMode(0), teamBuyMode(1)];
  for (const a of GS.actors) if (a.brain) botBuy(a);
  if (NB) assignRoles2(); else assignRoles();
  vmRoot.visible = true; vmId = ''; vmSet();
  const P = GS.player;
  sleeveMat.color.setHex(SIDE_SLEEVE[P.side]);
  const lastRound = GS.round === GS.maxRounds, match = GS.score[0] === GS.target - 1 || GS.score[1] === GS.target - 1;
  roundBannerLocal(half, lastRound, match);
  if (GS.core.carrier === P) setTimeout(() => toast('You carry the BOMB — hold E on a site to plant'), 2500);
  if (MP.role === 'host') MPH.roundStart(half);
}
function roundBannerLocal(half, lastRound, match) {
  const P = GS.player; sleeveMat.color.setHex(SIDE_SLEEVE[P.side]);
  banner(half ? 'SWITCHING SIDES' : `ROUND ${GS.round}`, `You are ${SIDE[P.side].name} — ${P.side === 0 ? 'plant the bomb at A or B' : 'stop the bomb from being planted'}${match ? ' · MATCH POINT' : lastRound ? ' · LAST ROUND' : ''}`, '#fff', 3000, true);
}
function roundEndFx(winSide, reason) {
  const why = { elim: `${SIDE[1 - winSide].name} eliminated`, time: 'Time ran out', boom: 'The bomb exploded!', defuse: 'The bomb was defused!' }[reason] || '';
  const w = GS.actors.find((a) => a.side === winSide);
  banner(`${SIDE[winSide].name} WIN`, why, SIDE[winSide].css, 3000, true);
  SFX.fanfare(!!w && w.squad === mySq());
}
function endRound(winSide, reason) {
  if (GS.state !== 'live') return;
  if (DEBUG && window.__csOnEnd) window.__csOnEnd(winSide, reason);   // ?debug only: lets the bot simulations see how every round ended
  GS.state = 'end'; GS.phaseT = 5.5;
  const sq = GS.actors.find((a) => a.side === winSide).squad, lq = 1 - sq;
  GS.score[sq]++; GS.loss[sq] = 0; GS.loss[lq] = Math.min(GS.loss[lq] + 1, 5);
  const winAmt = reason === 'boom' || reason === 'defuse' ? 3500 : 3250;
  const lossAmt = Math.min(3400, 1400 + 500 * (GS.loss[lq] - 1));
  for (const a of GS.actors) {
    if (a.roundKills > 0 || a.dmg - (a.dmgRd || 0) >= 40 || (a.obj || 0) > (a.objRd || 0)) a.contrib = (a.contrib || 0) + 1;   // this round counted for rank: a kill, 40+ damage or a plant / defuse
    a.dmgRd = a.dmg; a.objRd = a.obj || 0;
    if (a.squad === sq) addMoney(a, winAmt, 'round win');
    else addMoney(a, lossAmt + (a.side === 0 && GS.core.state === 'planted' ? 800 : 0), 'round loss');
  }
  roundEndFx(winSide, reason);
  if (MP.role === 'host') MPH.roundEnd(winSide, reason);
}
function updateRound(dt) {
  if (GS.mode === 'dm') {
    if (!GS.tutorial) GS.roundT -= dt;   // training has no clock
    if (GS.roundT <= 0 && GS.state === 'live') endMatch();
    for (const a of GS.actors) if (!a.alive) { a.respawnT -= dt; if (a.respawnT <= 0) dmSpawn(a); }
    return;
  }
  if (GS.mode === 'range') {
    GS.roundT -= dt;
    if (GS.roundT <= 0 && GS.state === 'live') endMatch();
    return;
  }
  const c = GS.core;
  if (GS.state === 'freeze') {
    const before = Math.ceil(GS.phaseT);
    GS.phaseT -= dt;
    if (Math.ceil(GS.phaseT) !== before && before <= 3 && before > 0) SFX.countdown(false);
    if (GS.phaseT <= 0) { GS.state = 'live'; GS.liveAt = GS.time; SFX.countdown(true); banner('GO!', '', '#ffd04a', 900); if (MP.role === 'host') MPH.event('go'); }
  } else if (GS.state === 'live') {
    GS.buyLeft -= dt;
    if (c.state !== 'planted') GS.roundT -= dt;
    const A = alive(0).length, Dd = alive(1).length;
    if (Dd === 0) endRound(0, 'elim');
    else if (c.state !== 'planted' && A === 0) endRound(1, 'elim');
    else if (c.state !== 'planted' && GS.roundT <= 0) endRound(1, 'time');
  } else if (GS.state === 'end') {
    GS.phaseT -= dt;
    if (GS.phaseT <= 0) {
      if (GS.score[0] >= GS.target || GS.score[1] >= GS.target || GS.round >= GS.maxRounds) endMatch();
      else startRound();
    }
  }
  if (c.state === 'planted' && (GS.state === 'live' || GS.state === 'end')) {
    c.timer -= dt; bombBeep(c, dt);
    if (c.timer <= 0) {
      c.state = 'boom';
      const p = c.pos.clone().setY(c.pos.y + 0.5);
      explosionFx(p, true); SFX.boom(p, true); GS.shake = 1.2;
      bombMesh.visible = false;
      if (MP.role === 'host') MPH.event('boom');
      for (const e of GS.actors) if (e.alive) { const d = e.pos.distanceTo(c.pos); const dmg = 500 * Math.exp(-(d * d) / (2 * 7 * 7)); if (dmg > 1) damage(e, dmg, null, 'body', 'bomb', null); }
      if (GS.state === 'live') endRound(0, 'boom');
    }
  }
}
function endMatch() {
  if (GS.state === 'over' && !$('end').classList.contains('hidden')) return;
  $('endRank').innerHTML = '';
  GS.state = 'over'; document.exitPointerLock && document.exitPointerLock(); mapOpen = false; $('bigMap').classList.add('hidden');
  if (MP.role === 'host') MPH.matchEnd();
  const P = GS.player, hsP = P.kills ? Math.round(P.hs / P.kills * 100) : 0;
  let title, sc;
  if (GS.mode === 'range') {
    const acc = GS.rangeShots ? Math.round(GS.rangeHits / GS.rangeShots * 100) : 0;
    const pts = GS.score[0] * 100 + GS.rangeHS * 25;
    const best = pts > STATS.range; if (best) { STATS.range = pts; saveStats(); }
    title = best ? 'NEW BEST!' : 'TIME!'; sc = `${pts} points`;
    $('endStats').innerHTML = stat(GS.score[0], 'POPPED') + stat(acc + '%', 'ACCURACY') + stat(GS.rangeHS, 'HEADSHOTS') + stat(STATS.range, 'BEST');
    $('endMvp').textContent = '';
  } else {
    const ms = mySq(), win = GS.score[ms] > GS.score[1 - ms], draw = GS.score[0] === GS.score[1];
    title = draw ? 'DRAW' : win ? 'VICTORY' : 'DEFEAT';
    if (!draw) { win ? STATS.wins++ : STATS.losses++; saveStats(); }
    sc = `${GS.score[mySq()]} — ${GS.score[1 - mySq()]}`;
    $('endStats').innerHTML = stat(P.kills, 'ELIMS') + stat(P.deaths, 'DEATHS') + stat(hsP + '%', 'HEADSHOT %') + stat(Math.round(P.dmg), 'DAMAGE');
    const mvp = GS.actors.slice().sort((a, b) => b.kills * 100 + b.dmg / 10 - (a.kills * 100 + a.dmg / 10))[0];
    $('endMvp').textContent = `MVP: ${mvp.name} (${mvp.kills} elims)`;
    if (GS.mode === 'comp' && GS.rankWhy) $('endRank').innerHTML = unrankedHTML(GS.rankWhy);
    if (GS.mode === 'comp' && !GS.rankDone) {   // a ranked match (solo, or online with friends): every player settles their OWN rank in their own browser
      GS.rankDone = true; const r = settleRank(draw ? 'draw' : win ? 'win' : 'loss', Math.abs(GS.score[ms] - GS.score[1 - ms]), mvp === P, rankPerf(P));
      $('endRank').innerHTML = rankEndHTML(r);
      if (r.m === 3 || (r.m > 3 && rankInfo(r.after).step > rankInfo(r.before).step)) setTimeout(() => showRankUp(r), 900);   // moved up (or just finished the placements): the RANK UP screen
    }
    if (GS.mode === 'comp') { const n = (win ? 120 : draw ? 80 : 60) + P.kills * 3; addCoins(n); $('endRank').innerHTML += '<div style="margin-top:10px;font-weight:700;color:#fff">+' + n + ' ' + COIN + ' &middot; spend them on skin crates (SKINS &amp; CRATES on the menu)</div>'; }
    SFX.fanfare(win);
  }
  $('endTitle').textContent = title; $('endTitle').style.color = title === 'DEFEAT' ? '#ff6a5a' : title === 'DRAW' ? '#ddd' : '#ffd04a';
  $('endScore').textContent = sc;
  $('end').classList.remove('hidden');
}
const stat = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;

// deathmatch
function dmSpawn(a) {
  let bestC = null, bestS = -1;
  for (let k = 0; k < 30; k++) {
    const c = pick(WALKABLE); const p = _v1.set(cellX(c), 1.6, cellZ(c));
    let s = 999;
    for (const e of GS.actors) if (e.alive && e.side !== a.side) { let d = e.pos.distanceTo(p); if (losClear(eyePos(e), p, false)) d *= 0.3; s = Math.min(s, d); }
    if (s > bestS) { bestS = s; bestC = c; }
  }
  a.pos.set(cellX(bestC), 0, cellZ(bestC)); a.vel.set(0, 0, 0); a.yaw = Math.random() * 6.28; a.pitch = 0;
  a.hp = 100; a.armor = 100; a.helmet = true; a.shield = false; a.shieldOn = false; a.alive = true; a.protT = 1.5; a.spawnT = GS.time; a.act = null; a.blindT = 0; a.reloadT = 0; a.rc = 0; a.scoped = 0;
  a.sec = newGun('p9');
  a.prim = newGun((a.isPlayer || a.remote) ? (a.dmPick || 'raptor') : pick(['raptor', 'raptor', 'sentinel', 'sentinel', 'carbine', 'buzz', 'chopper', 'thumper', 'scatter', 'lmg', 'dmr', 'ranger', 'longbow', 'brute', 'ghost', 'breaker'].filter(gunOK)));
  a.nades = { he: 1, flash: 1, smoke: 0, molly: 0 };
  a.slot = 'prim';
  if (a.brain) { a.brain.path = []; a.brain.goal = -1; a.brain.target = null; a.brain.roam = -1; }
  if (a.mesh) a.mesh.g.visible = !a.isPlayer;
  if (a.isPlayer) { vmRoot.visible = true; vmId = ''; vmSet(); sleeveMat.color.setHex(SIDE_SLEEVE[a.side]); }
  if (a.remote && MPH) MPH.spawn(a);
}
// aim range
function startRange() {
  const P = GS.player; P.side = 0; GS.state = 'live'; GS.roundT = 60; GS.rangeHits = 0; GS.rangeShots = 0; GS.rangeHS = 0;
  resetActorForRound(P); P.prim = newGun('raptor'); P.slot = 'prim'; P.prim.res = 999; P.armor = 100;
  P.pos.set(MAP.rangeStart[0], 0, MAP.rangeStart[1]); P.yaw = MAP.rangeStart[2]; P.pitch = 0;
  vmRoot.visible = true; vmId = ''; vmSet(); sleeveMat.color.setHex(SIDE_SLEEVE[0]);
  for (let i = 0; i < 3; i++) { const d = new Actor('Target', 1, false); d.side = 1; d.dummy = true; d.sec = newGun('p9'); makeSoldier(d); GS.actors.push(d); spawnDummy(d); }
  banner('AIM RANGE', '60 seconds · pop as many as you can · B = pick any gun');
}
function spawnDummy(d) {
  const P = GS.player, eye = eyePos(P), fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let ok = false;
  for (let k = 0; k < 160 && !ok; k++) {
    const c = pick(WALKABLE), x = cellX(c), z = cellZ(c), dist = Math.hypot(x - P.pos.x, z - P.pos.z), ahead = (x - P.pos.x) * fx + (z - P.pos.z) * fz;
    const near = k < 100 ? 8 : 5, far = k < 100 ? 45 : 70;
    if (dist < near || dist > far || ahead < (k < 100 ? 4 : -999)) continue;
    if (!losClear(eye, _v2.set(x, 1.4, z), false)) continue;
    d.pos.set(x, 0, z); ok = true;
  }
  if (!ok) d.pos.set(P.pos.x + fx * 6, 0, P.pos.z + fz * 6);
  d.hp = 100; d.armor = 0; d.alive = true; d.mesh.g.visible = true; d.strafe = Math.random() < 0.5 ? 1 : -1; d.strafeT = rand(0.4, 1.2);
  d.yaw = Math.atan2(-(P.pos.x - d.pos.x), -(P.pos.z - d.pos.z));
}

// ---------------- buying ----------------
function inBuyZone(a) {
  if (GS.mode !== 'comp') return GS.mode === 'range' || GS.time - a.spawnT < 10;
  return (GS.state === 'freeze' || (GS.state === 'live' && GS.buyLeft > 0)) && zoneAt(a.pos.x, a.pos.z) === (a.side === 0 ? 'T' : 'D');
}
function priceOf(a, id) {
  if (GS.mode !== 'comp') return 0;
  if (id === 'helm') return a.armor >= 100 && !a.helmet ? 350 : 1000;
  return (WD[id] || GEAR[id]).price;
}
function canBuy(a, id) {
  if (!a.alive || !gunOK(id)) return false;
  const p = priceOf(a, id); if (a.money < p) return false;
  if (WD[id] && WD[id].nade) { const tot = a.nades.he + a.nades.flash + a.nades.smoke + a.nades.molly; return a.nades[id] < WD[id].max && tot < 4; }
  if (id === 'shield') return !a.shield;
  if (id === 'kevlar') return a.armor < 100;
  if (id === 'helm') return !(a.armor >= 100 && a.helmet);
  if (id === 'kit') return a.side === 1 && !a.kit && GS.mode === 'comp';
  const def = WD[id]; const cur = a[def.slot];
  return !(cur && cur.id === id && cur.mag === def.mag && cur.res === def.res);
}
function buy(a, id) {
  if (!canBuy(a, id)) return false;
  const snap = { money: a.money, armor: a.armor, helmet: a.helmet, kit: a.kit, shield: !!a.shield, nades: { ...a.nades }, prim: a.prim, sec: a.sec, slot: a.slot };   // so the purchase can be undone
  let dropped = null;
  a.money -= priceOf(a, id);
  if (WD[id] && WD[id].nade) a.nades[id]++;
  else if (id === 'kevlar') a.armor = 100;
  else if (id === 'helm') { a.armor = 100; a.helmet = true; }
  else if (id === 'kit') a.kit = true;
  else if (id === 'shield') a.shield = true;   // (it comes up as soon as a pistol or the knife is out)
  else {
    const def = WD[id];
    if (a[def.slot] && a[def.slot].id !== id && GS.mode === 'comp') dropped = addDrop(a[def.slot], a.pos);
    a[def.slot] = newGun(id);
    if (GS.mode === 'range') a[def.slot].res = 999;
    if ((a.isPlayer || a.remote) && def.slot === 'prim') a.dmPick = id;
    a.slot = def.slot; a.switchT = def.draw || 0.4;
  }
  if (GS.mode === 'comp') (a.buyLog ||= []).push({ id, snap, dropped, spent: snap.money - a.money });
  if (a.isPlayer) { vmSet(); }
  return true;
}
// UNDO: take back the last thing you bought (only while you can still buy): you get the money back and the gun you swapped out comes back
function undoBuy(a) {
  const log = a.buyLog;
  if (!a.alive || !log || !log.length || GS.mode !== 'comp' || !inBuyZone(a)) return false;
  const { snap, dropped, spent } = log.pop();
  if (dropped) { const i = GS.drops.indexOf(dropped); if (i >= 0) { scene.remove(dropped.g); GS.drops.splice(i, 1); } }
  a.money += spent; a.armor = snap.armor; a.helmet = snap.helmet; a.kit = snap.kit; a.shield = snap.shield; a.nades = snap.nades; a.prim = snap.prim; a.sec = snap.sec; a.slot = snap.slot; a.switchT = 0.3;
  if (a.isPlayer) { vmSet(); } else if (a.remote && MPH) MPH.sendLoadout(a);
  return true;
}
function teamBuyMode(side) {
  const t = GS.actors.filter((x) => x.side === side && x.brain);
  if (!t.length) return 'full';
  const avg = t.reduce((s, x) => s + x.money + (x.prim ? 2000 : 0), 0) / t.length, streak = GS.loss[t[0].squad] || 0;
  if (avg >= 3600) return 'full';
  if (avg >= 2300) return 'half';
  if (streak >= 2 && avg >= 1500) return 'force';
  return avg >= 1500 ? 'half' : 'eco';
}
function botBuy(a) {
  const m = () => a.money, mode = (GS.buyMode && GS.buyMode[a.side]) || 'full';
  const pistolRound = GS.round === 1 || GS.round === GS.halfAt + 1;
  if (pistolRound) {
    const r = Math.random();
    if (r < 0.3) buy(a, 'kevlar'); else if (r < 0.55) { const gn = pickGun(['viper', 'revolver', 'tec', 'trio', 'duster']); if (gn) buy(a, gn); } else { buy(a, 'flash'); buy(a, pick(['smoke', 'molly'])); }
    return;
  }
  const teamHas = (id) => GS.actors.some((t) => t.side === a.side && t !== a && t.prim && t.prim.id === id);
  if (!a.prim && mode !== 'eco') {
    const reserve = mode === 'full' ? 700 : 350;
    let list;
    if (mode === 'full') {   // (every list below is cut down to the guns of the chosen gun set a few lines further on)
      list = a.side === 0 ? ['raptor', 'raptor', 'raptor', 'sentinel', 'carbine', 'ghost', 'ghost'] : ['sentinel', 'sentinel', 'sentinel', 'raptor', 'carbine', 'ghost'];
      if (m() >= 5400 && !teamHas('lmg') && Math.random() < 0.18) list = ['lmg'];
      else if (m() >= 5000 && !teamHas('longbow') && Math.random() < 0.3) list = ['longbow'];
      else if (m() >= 3900 && !teamHas('dmr') && Math.random() < 0.2) list = ['dmr'];
    } else if (mode === 'half') list = ['chopper', 'buzz', 'carbine', 'scatter', 'thumper', 'ranger', 'chopper', 'buzz', 'brute', 'breaker'];
    else list = ['buzz', 'chopper', 'thumper', 'scatter', 'ranger', 'buzz', 'chopper', 'brute', 'breaker'];
    list = list.filter(gunOK); if (!list.length) list = ['raptor'];
    const ok = list.filter((id) => WD[id].price + reserve <= m());
    const pickId = ok.length ? pick(ok) : list.filter((id) => WD[id].price <= m()).sort((p, q) => WD[q].price - WD[p].price)[0];
    if (pickId) buy(a, pickId);
    else if (m() >= 650 && a.sec.id === 'p9') { const gn = pickGun(['revolver', 'viper', 'tec', 'trio', 'duster']); if (gn) buy(a, gn); }
  } else if (!a.prim && mode === 'eco' && a.sec.id === 'p9' && m() >= 900 && Math.random() < 0.35) { const gn = pickGun(['tec', 'revolver', 'trio', 'duster']); if (gn) buy(a, gn); }
  if (mode === 'full') { if (!a.helmet && m() >= priceOf(a, 'helm')) buy(a, 'helm'); else if (m() >= 650 && a.armor < 60) buy(a, 'kevlar'); }
  else if (mode === 'half' || mode === 'force') { if (m() >= 650 && a.armor < 60 && Math.random() < 0.8) buy(a, 'kevlar'); }
  if (a.prim && mode !== 'eco') {
    if (mode === 'full') {
      if (m() >= 300 && Math.random() < 0.8) buy(a, 'smoke');
      if (m() >= 200) buy(a, 'flash');
      if (m() >= 400 && Math.random() < 0.55) buy(a, 'molly');
      if (m() >= 300 && Math.random() < 0.55) buy(a, 'he');
      if (m() >= 200 && Math.random() < 0.4) buy(a, 'flash');
      if (a.side === 1 && m() >= 400 && Math.random() < 0.7) buy(a, 'kit');
    } else if (mode === 'half') {
      if (m() >= 200 && Math.random() < 0.6) buy(a, 'flash');
      if (m() >= 300 && Math.random() < 0.4) buy(a, 'smoke');
    }
  }
  a.slot = bestSlot(a);
}

// which bomb site is this spot in? The A / B floor zone, or very close to a site's middle or one of its plant spots (so the edge of a zone can never stop a plant)
function plantSite(x, z) {
  const zn = zoneAt(x, z); if (zn === 'a' || zn === 'b') return zn;
  for (const k of ['a', 'b']) {
    const s = SITES[k]; if (Math.hypot(x - s.center[0] * CS, z - s.center[1] * CS) < 7) return k;
    for (const c of s.plant) if (Math.hypot(x - cellX(c), z - cellZ(c)) < 4) return k;
  }
  return null;
}
const plantCellFor = (k) => { const l = SITES[k].plant.filter((c) => plantSite(cellX(c), cellZ(c)) === k); return l.length ? pick(l) : SITES[k].plant[0]; };
// ---------------- bots ----------------
// =====================================================================================================
// SMART BOTS. Add ?oldbots to the address to play against the old brains (used to compare them in the dev simulations).
// What changed: the bots now KNOW the map (distance fields, cover, who can see what), every round gets a fresh plan
// (hit a site / rush / split / fake / slow mid control), every bot gets its own lane and its own spot (never the same
// ones twice in a row), they rotate when they hear or see the enemy, peek and hide behind cover in fights, use
// grenades with a purpose and retake the bomb together.
// =====================================================================================================
let NB = !QS.has('oldbots');   // (a let only so the dev simulations can switch between the old and new brains in one page)
let NAV = null, NAV_ID = '';
const cheb = (c1, c2) => Math.max(Math.abs((c1 % W) - (c2 % W)), Math.abs(((c1 / W) | 0) - ((c2 / W) | 0)));
const isSpawnZ = (c) => ZONE[c] === 'T' || ZONE[c] === 'D';
const dv = (arr, c) => (arr[c] < 0 ? 999 : arr[c]);
function bfs(starts) {   // walking distance (in cells) from a set of cells to everywhere
  const d = new Int16Array(W * H).fill(-1), q = [];
  for (const s of starts) if (walk(s) && d[s] < 0) { d[s] = 0; q.push(s); }
  for (let i = 0; i < q.length; i++) {
    const c = q[i], x = c % W, z = (c / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const n = nz * W + nx; if (d[n] >= 0 || !walk(n)) continue;
      if (dx && dz && (!walk(z * W + nx) || !walk(nz * W + x))) continue;
      d[n] = d[c] + 1; q.push(n);
    }
  }
  return d;
}
const _e1 = V(), _e2 = V();
const at = (c, y, o) => o.set(cellX(c), y, cellZ(c));
function navFor() {
  if (NAV && NAV_ID === MAP.id && NAV.w === W && NAV.h === H) return NAV;
  const tNav = performance.now();
  const N = { w: W, h: H }, n = W * H;
  N.dT = bfs(SPAWN.T); N.dD = bfs(SPAWN.D);
  const sc = (k) => { const s = SITES[k].center; return nearestWalk(Math.floor(s[1]) * W + Math.floor(s[0])); };
  N.site = { a: sc('a'), b: sc('b') };
  N.d = { a: bfs([N.site.a]), b: bfs([N.site.b]) };
  N.edge = new Uint8Array(n);
  for (const c of WALKABLE) {   // how many of the 8 neighbours are walls / props = how much cover is here
    const x = c % W, z = (c / W) | 0; let k = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H || !walk(nz * W + nx)) k++; }
    N.edge[c] = k;
  }
  const t0 = SPAWN.T[(SPAWN.T.length / 2) | 0], d0 = SPAWN.D[(SPAWN.D.length / 2) | 0];
  N.hold = { a: [], b: [] }; N.post = { a: [], b: [] }; N.stage = { a: [], b: [] }; N.lane = { a: [], b: [] }; N.mid = []; N.lurk = []; N.fwd = [];
  for (const k of ['a', 'b']) {
    const path = astar(t0, N.site[k]), dk = N.d[k], ctr = at(N.site[k], 1.5, V());
    N.lane[k] = path.filter((c, i) => i % 3 === 0 && dk[c] > 4).slice(-12);   // where the attackers walk on their way in
    const lanePts = N.lane[k].map((c) => at(c, 1.5, V()));
    for (const c of WALKABLE) {
      const d = dk[c]; if (d < 2 || d > 30 || isSpawnZ(c)) continue;
      at(c, 1.6, _e1); const sees = losClear(_e1, ctr, false), ed = N.edge[c];
      if (ed >= 1 && d <= 26) {   // defenders: next to a wall or crate, can see the lane or the middle of the site
        let seen = 0; for (const p of lanePts) if (Math.hypot(p.x - _e1.x, p.z - _e1.z) <= 30 && losClear(_e1, p, false)) seen++;   // the part of the lane it covers from 30 m or closer
        if (seen || sees) N.hold[k].push([c, (1 + seen) * (sees ? 2 : 1) * (d < 14 ? 1.5 : 1) * (ed >= 3 ? 1.3 : 1)]);
      }
      if (sees && d >= 3 && d <= 15 && ed >= 1) N.post[k].push([c, (ed >= 3 ? 1.6 : 1) * (d < 8 ? 1.3 : 1)]);   // attackers: spots with a view of the site (entry + after the plant)
      if (!sees && d >= 7 && d <= 15 && ed >= 1 && dv(N.dT, c) <= dv(N.dT, N.site[k]) + 4) N.stage[k].push([c, ed >= 3 ? 2 : 1]);   // where attackers wait: close, but hidden from the site
    }
  }
  for (const c of WALKABLE) {
    if (isSpawnZ(c) || N.edge[c] < 1) continue;
    const a = dv(N.dT, c), b = dv(N.dD, c); if (a > 900 || b > 900) continue;
    const r = a / (a + b), da = dv(N.d.a, c), db = dv(N.d.b, c);
    if (Math.abs(r - 0.5) <= 0.14 && da > 9 && db > 9) N.mid.push([c, 1]);
    if (r >= 0.28 && r <= 0.5 && da > 8 && db > 8) N.lurk.push([c, 1]);
    if (r >= 0.56 && r <= 0.72 && (da > 7 || db > 7)) N.fwd.push([c, 1]);
  }
  NAV = N; NAV_ID = MAP.id; N.ms = Math.round(performance.now() - tNav);
  return N;
}
// pick a spot from a pool of [cell, weight]: not near the 'avoid' cells, and (mostly) not where this bot stood in its last rounds
function pickSpot(pool, avoid = [], sep = 4, recent = null) {
  if (!pool || !pool.length) return -1;
  let tot = 0; const w = pool.map(([c, wt]) => {
    let m = wt; for (const o of avoid) if (o >= 0 && cheb(c, o) < sep) { m = 0; break; }
    if (m && recent) for (const o of recent) if (cheb(c, o) < 4) m *= 0.1;
    tot += m; return m;
  });
  if (tot <= 0) return pool[(Math.random() * pool.length) | 0][0];
  let r = Math.random() * tot; for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i][0]; }
  return pool[pool.length - 1][0];
}
function remember(a, c) { const m = (GS.mem ||= new Map()), l = m.get(a.id) || []; l.push(c); if (l.length > 6) l.shift(); m.set(a.id, l); }
const recentOf = (a) => (GS.mem && GS.mem.get(a.id)) || null;
// A* that also adds a cost per cell (so every bot can get a different lane)
const wG = new Float32Array(96 * 96), wFrom = new Int32Array(96 * 96), wClosed = new Uint8Array(96 * 96);
function astarW(s, g, extra) {
  if (!walk(g)) g = nearestWalk(g); if (!walk(s)) s = nearestWalk(s);
  if (s === g) return [g];
  const n = W * H; wG.fill(1e9, 0, n); wClosed.fill(0, 0, n); wFrom.fill(-1, 0, n);
  const heap = [], gx = g % W, gz = (g / W) | 0;
  const hf = (i) => { const dx = Math.abs(i % W - gx), dz = Math.abs(((i / W) | 0) - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
  wG[s] = 0; push(s, hf(s));
  while (heap.length) {
    const c = pop(); if (c === g) break; if (wClosed[c]) continue; wClosed[c] = 1;
    const x = c % W, z = (c / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const nn = nz * W + nx; if (!walk(nn) || wClosed[nn]) continue;
      if (dx && dz && (!walk(z * W + nx) || !walk(nz * W + x))) continue;
      const ng = wG[c] + (dx && dz ? 1.414 : 1) * (1 + (extra ? extra[nn] : 0));
      if (ng < wG[nn]) { wG[nn] = ng; wFrom[nn] = c; push(nn, ng + hf(nn)); }
    }
  }
  if (wFrom[g] < 0) return [g];
  const path = []; for (let c = g; c !== s && c >= 0; c = wFrom[c]) path.push(c);
  return path.reverse();
}
// a route for one bot: waypoints every ~5 cells to 'to'. 'cost' makes lanes differ (random blocky noise + cells earlier bots used)
function routeFor(a, to, cost, spread) {
  const path = astarW(cellOf(a.pos.x, a.pos.z), to, cost), wp = [];
  for (let i = 4; i < path.length - 1; i += 5) wp.push(path[i]);
  wp.push(path[path.length - 1]);
  if (spread) for (const c of path) { const x = c % W, z = (c / W) | 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if (nx >= 0 && nz >= 0 && nx < W && nz < H) cost[nz * W + nx] += 0.9; } }
  return wp;
}
function newCost(amount = 1.2) {   // random cost per 3x3 block of cells
  const cost = new Float32Array(W * H), bw = Math.ceil(W / 3), blk = new Float32Array(bw * Math.ceil(H / 3));
  for (let i = 0; i < blk.length; i++) blk[i] = Math.random() * amount;
  for (let c = 0; c < W * H; c++) cost[c] = blk[(((c / W) | 0) / 3 | 0) * bw + (((c % W) / 3) | 0)];
  return cost;
}
const siteOf = (c) => { const N = NAV; if (!N) return null; const da = dv(N.d.a, c), db = dv(N.d.b, c); return Math.min(da, db) > 30 ? 'mid' : da <= db ? 'a' : 'b'; };
// what each side knows about where the enemy is: enemies seen / heard at each site in the last few seconds
function noteEnemy(side, pos, id, w = 1) {
  if (!NAV) return;
  const k = siteOf(cellOf(pos.x, pos.z)); if (!k) return;
  const I = ((GS.intel ||= [{}, {}])[side]); const r = (I[k] ||= new Map()); r.set(id, [GS.time, w]);
}
function intelCount(side, k, win = 7) {
  const r = GS.intel && GS.intel[side] && GS.intel[side][k]; if (!r) return 0;
  let n = 0; for (const [id, [t, w]] of r) if (GS.time - t < win) n += w; return n;
}
const rtNow = () => (GS.state === 'live' ? GS.time - (GS.liveAt || GS.time) : 0);

// ---------------- the plan for a round ----------------
const STRAT_W = {
  easy: { hit: 50, rush: 30, split: 4, fake: 0, slow: 16 }, normal: { hit: 34, rush: 16, split: 18, fake: 10, slow: 22 },
  hard: { hit: 24, rush: 14, split: 24, fake: 18, slow: 20 }, insane: { hit: 18, rush: 12, split: 28, fake: 26, slow: 16 },
};
function chooseStrat(eco) {
  const w = { ...(STRAT_W[S.diff] || STRAT_W.normal) };
  if (eco) { w.rush *= 2.2; w.slow *= 0.4; w.fake *= 0.5; }
  const last = GS.lastStrat && GS.lastStrat[0]; if (last && w[last]) w[last] *= 0.3;
  let tot = 0; for (const k in w) tot += w[k];
  let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'hit';
}
function setupBrains2() {
  const N = navFor(), dd = D();
  GS.liveAt = 0; GS.intel = [{}, {}]; GS.allIn = false; GS.rtGo = false; GS.defuser = null; GS.rotCount = { a: 0, b: 0 };
  const atk = GS.actors.filter((a) => a.brain && a.side === 0 && a.alive), def = GS.actors.filter((a) => a.brain && a.side === 1 && a.alive);
  for (const a of GS.actors) if (a.brain) a.brain = newBrain(a, a.brain.idx);
  planAttack(atk, N, dd); planDefense(def, N, dd);
}
function planAttack(atk, N, dd) {
  if (!atk.length) { GS.strat = { kind: 'none' }; return; }
  const eco = atk.reduce((s, x) => s + x.money, 0) / atk.length < 2000 && !atk.some((x) => x.prim);
  const kind = chooseStrat(eco);
  GS.lastStrat = [kind, ...(GS.lastStrat || []).slice(0, 2)];
  let X = Math.random() < 0.5 ? 'a' : 'b'; if (X === GS.lastPlan && Math.random() < 0.6) X = X === 'a' ? 'b' : 'a';
  const Y = X === 'a' ? 'b' : 'a';
  const carrier = GS.core.carrier, bots = shuffle(atk.slice()), n = bots.length;
  const cost = newCost(1.4);
  const lane = (k, avoid) => { const s = pickSpot(N.stage[k].length ? N.stage[k] : N.post[k], avoid, 7); return s >= 0 ? s : N.site[k]; };
  const lurkSpot = (avoid) => { const s = pickSpot(N.lurk.length ? N.lurk : N.mid, avoid, 6); return s >= 0 ? s : LURK; };
  const G = rand(30, 52) * (0.9 + 0.2 * (1 - dd.team));
  const spec = { kind, X, Y, goAt: G };
  const give = (b, o) => Object.assign(b, o);
  let groupX = bots.slice(), groupY = [], lurker = null, fakeGo = 0;
  if (kind === 'hit' || kind === 'rush' || kind === 'slow') {
    if (n >= 4 && Math.random() < 0.3 + 0.5 * dd.team && kind !== 'rush' && !(carrier && carrier === bots[0])) lurker = bots[0];
    if (lurker) groupX = bots.slice(1);
  } else if (kind === 'split') {
    const k = n >= 4 ? (Math.random() < 0.5 ? 2 : 3) : Math.max(1, n >> 1); const cg = carrier && bots.includes(carrier) ? carrier : null;
    const rest = bots.filter((b) => b !== cg); groupX = (cg ? [cg] : []).concat(rest.slice(0, Math.max(0, k - (cg ? 1 : 0)))); groupY = bots.filter((b) => !groupX.includes(b));
  } else if (kind === 'fake') {
    const k = n >= 5 ? 2 : 1; const nc = bots.filter((b) => b !== carrier); groupY = nc.slice(0, k); groupX = bots.filter((b) => !groupY.includes(b)); fakeGo = rand(18, 28);
  }
  spec.lanes = []; const used = [];
  const stages = { X: [lane(X, used)] }; used.push(stages.X[0]); if (groupX.length >= 3 || kind === 'rush') { stages.X.push(lane(X, used)); used.push(stages.X[1]); }
  let go = kind === 'rush' ? rand(6, 11) : kind === 'slow' ? rand(48, 62) : G;
  if (kind === 'fake') go = fakeGo + rand(9, 15);
  spec.goAt = go;
  const order = ['entry', 'support', 'trade', 'post', 'post'];
  groupX.forEach((b, i) => {
    const br = b.brain, role = b === carrier ? 'carrier' : order[Math.min(i, order.length - 1)];
    const st = kind === 'slow' ? lurkSpot(used) : stages.X[i % stages.X.length];
    used.push(st);
    give(br, { site: X, role, goAt: go + (role === 'entry' ? 0 : role === 'support' ? 0.8 : role === 'trade' ? 1.6 : role === 'carrier' ? 2.8 : 2.2), stage: st, lurk: false, plantCell: plantCellFor(X) });
    br.route = routeFor(b, st, cost, kind !== 'rush');
  });
  groupY.forEach((b, i) => {
    const br = b.brain, st = lane(Y, used); used.push(st);
    const fake = kind === 'fake';
    give(br, { site: Y, role: fake ? 'fake' : 'support', goAt: fake ? fakeGo : go, stage: st, lurk: false, plantCell: plantCellFor(Y), swapAt: fake ? fakeGo + rand(10, 16) : 0, swapTo: X });
    br.route = routeFor(b, st, cost, true);
  });
  if (lurker) {
    const br = lurker.brain, st = lurkSpot(used); used.push(st);
    give(br, { site: X, role: 'lurk', lurk: true, goAt: go + rand(8, 20), stage: st, plantCell: plantCellFor(X), lurkSite: Math.random() < 0.5 ? X : Y });
    br.route = routeFor(lurker, st, cost, true);
  }
  // exact entry / support spots in the site for the people who hit it
  const spots = [];
  for (const b of bots) { const br = b.brain; if (!br.site) continue; const pool = N.post[br.site]; const far = br.role === 'entry' ? pool.filter(([c]) => dv(N.d[br.site], c) <= 9) : pool; const sp = pickSpot(far.length ? far : pool, spots, 4, recentOf(b)); br.entry = sp >= 0 ? sp : N.site[br.site]; spots.push(br.entry); br.leader = null; }
  const entry = bots.find((b) => b.brain.role === 'entry');
  for (const b of bots) if (b !== entry && b.brain.role !== 'lurk' && entry && b.brain.site === entry.brain.site) b.brain.leader = entry;
  GS.plan = GS.lastPlan = X; GS.strat = spec; GS.firstGo = Math.min(...bots.map((b) => b.brain.goAt)) - 0.1;
  for (const b of bots) remember(b, b.brain.stage);
}
const LAYOUTS = [[2, 2, 1], [3, 1, 1], [1, 3, 1], [2, 1, 2], [1, 2, 2], [1, 1, 3], [2, 2, 1], [2, 1, 1]];
function planDefense(def, N, dd) {
  if (!def.length) return;
  const bots = shuffle(def.slice()), n = bots.length;
  let lay = pick(dd.team < 0.3 ? [[2, 2, 1], [2, 2, 1], [3, 1, 1], [1, 3, 1]] : LAYOUTS).slice();
  while (lay[0] + lay[1] + lay[2] > n) { const i = lay.indexOf(Math.max(...lay)); lay[i]--; }
  while (lay[0] + lay[1] + lay[2] < n) lay[(Math.random() * 3) | 0]++;
  const sites = []; lay.forEach((cnt, i) => { for (let k = 0; k < cnt; k++) sites.push(i === 0 ? 'a' : i === 1 ? 'b' : 'm'); });
  const avoid = [];
  bots.forEach((b, i) => {
    const br = b.brain, k = sites[i] || 'a';
    let spot;
    if (k === 'm') { spot = pickSpot(N.mid.length ? N.mid : N.hold.a, avoid, 6, recentOf(b)); br.role = 'rotator'; br.site = null; }
    else { const pool = N.hold[k].length ? N.hold[k] : N.hold[k === 'a' ? 'b' : 'a']; spot = pickSpot(pool, avoid, 5, recentOf(b)); br.role = 'anchor'; br.site = k; }
    if (spot < 0) spot = pick(WALKABLE);
    br.hold = spot; avoid.push(spot); remember(b, spot);
    // some defenders push forward early to get information, then fall back
    if (N.fwd.length && Math.random() < 0.12 + 0.3 * dd.team * (br.role === 'rotator' ? 1.6 : 0.8)) { br.fwd = pickSpot(N.fwd, avoid, 5); br.fwdUntil = rand(14, 30); if (br.fwd >= 0) { br.role = 'aggro'; avoid.push(br.fwd); } }
    const wp = N.lane[k === 'm' ? 'a' : k]; br.watch = [];
    at(spot, 1.6, _e1); for (const lc of shuffle(wp.slice())) { if (losClear(_e1, at(lc, 1.5, _e2), false)) { br.watch.push(lc); if (br.watch.length >= 2) break; } }
    if (b.prim && WD[b.prim.id].scope && br.site) {   // snipers take the spot with the longest view
      const far = N.hold[br.site].filter(([c]) => dv(N.d[br.site], c) >= 9); const sp = pickSpot(far.length ? far : N.hold[br.site], avoid, 5, recentOf(b)); if (sp >= 0) { br.hold = sp; br.role = 'sniper'; }
    }
    br.peekDir = Math.random() < 0.5 ? 1 : -1;
  });
}
function adoptBot(a) {   // a human left the match: this bot steps in with a simple role
  const N = navFor(), b = a.brain;
  if (a.side === 1) { const k = Math.random() < 0.5 ? 'a' : 'b'; b.site = k; b.role = 'anchor'; b.hold = pickSpot(N.hold[k], [], 5) ; if (b.hold < 0) b.hold = pick(WALKABLE); b.watch = []; }
  else { const X = GS.plan || 'a'; b.site = X; b.role = 'support'; b.goAt = Math.max(rtNow() + 4, GS.strat ? GS.strat.goAt : 30); b.stage = pickSpot(N.stage[X], [], 5); if (b.stage < 0) b.stage = N.site[X]; b.route = routeFor(a, b.stage, newCost(1), true); b.entry = pickSpot(N.post[X], [], 4); b.plantCell = plantCellFor(X); }
}
// guns decide a few roles after the buy phase
function assignRoles2() {
  const N = navFor();
  for (const a of GS.actors) {
    const b = a.brain; if (!b || !a.prim || !b.site) continue;
    const d = WD[a.prim.id];
    if (a.side === 0 && d.scope && b.role !== 'lurk' && b.role !== 'carrier') { b.role = 'sniper'; const far = N.post[b.site].filter(([c]) => dv(N.d[b.site], c) >= 9); const sp = pickSpot(far.length ? far : N.post[b.site], [], 4); if (sp >= 0) b.entry = sp; }
    if (a.side === 1 && d.pellets && b.site) { const near = N.hold[b.site].filter(([c]) => dv(N.d[b.site], c) <= 8); const sp = pickSpot(near.length ? near : N.hold[b.site], [], 4, recentOf(a)); if (sp >= 0) b.hold = sp; }
  }
}

// holders do not stand like statues: now and then they shuffle to another bit of cover next to their spot, and calm defenders sometimes change angle on the same site
function microMove(a, b, base) {
  if (GS.time < b.microUntil && b.microCell >= 0) return b.microCell;
  if (base < 0 || b.vis || GS.time - b.lastSeenT < 3 || GS.time < b.microAt || a.act) return base;
  b.microAt = GS.time + rand(4, 9);
  const N = navFor(), x = base % W, z = (base / W) | 0, opts = [];
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, nz = z + dz; if (nx < 1 || nz < 1 || nx >= W - 1 || nz >= H - 1) continue; const c = nz * W + nx; if (c !== base && walk(c) && N.edge[c] >= 1 && !isSpawnZ(c)) opts.push(c); }
  if (!opts.length || Math.random() < 0.25) return base;
  b.microCell = pick(opts); b.microUntil = GS.time + rand(2.2, 4.2);
  return b.microCell;
}
function saveGoal(a, b, side) { if (b.saveCell == null) { b.saveCell = pick(side === 0 ? SPAWN.T : SPAWN.D); const st = (GS.stat ||= {}); st.saves = (st.saves || 0) + 1; } return { cell: b.saveCell, hold: true, save: true, exact: true }; }
function compGoal2(a, b) {
  const c = GS.core, N = navFor(), rt = rtNow();
  if (a.side === 0) {
    if (GS.state === 'live' && c.state !== 'planted' && c.state !== 'dropped' && GS.roundT < 12 && a.prim && alive(0).length <= 2 && c.carrier !== a) return saveGoal(a, b, 0);
    if (c.state === 'dropped') { if (!GS.fetcher || !GS.fetcher.alive) GS.fetcher = alive(0).filter((x) => x.brain).sort((x, y) => x.pos.distanceTo(c.pos) - y.pos.distanceTo(c.pos))[0] || null; if (GS.fetcher === a) return { cell: cellOf(c.pos.x, c.pos.z), pos: c.pos }; }
    if (c.state === 'planted' || c.state === 'boom') {   // after the plant: everybody finds an angle on the bomb, spread out
      if (b.postAt !== c.plantedAt) {
        b.postAt = c.plantedAt;
        const taken = GS.actors.filter((o) => o !== a && o.alive && o.brain && o.side === 0 && o.brain.postSpot >= 0).map((o) => o.brain.postSpot);
        const k = c.site || GS.plan; let sp = pickSpot(N.post[k], taken, 5, recentOf(a)); if (sp < 0) sp = SITES[k].holdsAtk[b.idx % 4]; b.postSpot = sp;
      }
      return { cell: b.postSpot, hold: true, exact: true, post: true };
    }
    // swap sites (the fake group, or a lurker who changes lanes)
    if (b.swapAt && rt >= b.swapAt && b.site !== b.swapTo) { b.site = b.swapTo; b.role = 'support'; b.goAt = rt + 5; b.stage = pickSpot(N.stage[b.site], [], 5); if (b.stage < 0) b.stage = N.site[b.site]; b.route = routeFor(a, b.stage, newCost(0.8), false); b.ri = 0; b.entry = pickSpot(N.post[b.site], [], 4); b.plantCell = plantCellFor(b.site); b.swapAt = 0; }
    if (b.role === 'lurk' && !b.lurkDone && rt >= b.goAt) { b.lurkDone = true; b.site = b.lurkSite || b.site; b.stage = pickSpot(N.stage[b.site], [], 5); if (b.stage < 0) b.stage = N.site[b.site]; b.route = routeFor(a, b.stage, newCost(1.4), true); b.ri = 0; b.entry = pickSpot(N.post[b.site], [], 4); b.goAt = rt + 6; b.role = 'support'; }
    while (b.ri < b.route.length - 1 && reached(a, b.route[b.ri], 1.8)) b.ri++;
    const last = b.route.length ? b.route[b.route.length - 1] : b.stage;
    if (b.ri < b.route.length - 1) return { cell: b.route[b.ri] };
    if (!GS.allIn && rt < b.goAt) return { cell: microMove(a, b, last >= 0 ? last : N.site[b.site || 'a']), hold: true, stage: true, exact: true };   // wait at the staging spot until the plan says go
    // execute
    if (b.role === 'carrier' || c.carrier === a) {
      const mates = GS.actors.filter((o) => o !== a && o.alive && o.side === 0 && o.brain && o.brain.site === b.site && reached(o, o.brain.entry >= 0 ? o.brain.entry : N.site[b.site], 4.5)).length;
      if (mates > 0 || rt >= b.goAt + 7 || GS.allIn || alive(0).length <= 2) return { cell: b.plantCell, plant: true };
      return { cell: b.entry >= 0 ? b.entry : last, hold: true, exact: true };
    }
    if (c.carrier === null && c.state === 'carried') { /* nothing */ }
    if (b.entry >= 0 && !(b.cleared)) { if (reached(a, b.entry, 1.6) && GS.time - b.lastSeenT > 2.5) b.cleared = true; return { cell: b.entry, hold: true, exact: true, entry: true }; }
    return { cell: b.postSpot >= 0 ? b.postSpot : (b.entry >= 0 ? b.entry : SITES[b.site].holdsAtk[b.idx % 4]), hold: true, exact: true };
  }
  // ---- defenders
  if (c.state === 'planted') return retakeGoal(a, b, c, N);
  if (b.fwd >= 0 && rt < b.fwdUntil && !b.rotate) return { cell: b.fwd, hold: true, exact: true };
  if (b.rotate && GS.time >= b.rotAt) return { cell: b.rotSpot, hold: true, exact: true };
  return { cell: microMove(a, b, b.hold >= 0 ? b.hold : SITES.a.holdsDef[0]), hold: true, exact: true };
}
function retakeGoal(a, b, c, N) {
  const near = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z), bombCell = cellOf(c.pos.x, c.pos.z), k = c.site;
  if (a.prim && !a.act && near > 5 && c.timer < (a.kit ? 5.5 : 10.5) + near / 6) return saveGoal(a, b, 1);
  if (b.rtAt !== c.plantedAt) {   // each defender gets a different place to gather round the bomb
    b.rtAt = c.plantedAt;
    const taken = GS.actors.filter((o) => o !== a && o.alive && o.brain && o.side === 1 && o.brain.rtStage >= 0).map((o) => o.brain.rtStage);
    const pool = N.stage[k].length ? N.stage[k] : N.hold[k]; b.rtStage = pickSpot(pool, taken, 5); if (b.rtStage < 0) b.rtStage = bombCell;
    const cov = N.post[k]; b.rtCover = pickSpot(cov, taken, 3); if (b.rtCover < 0) b.rtCover = bombCell;
  }
  const mates = GS.actors.filter((o) => o.alive && o.side === 1 && o.brain);
  if (!GS.rtGo) {
    const staged = mates.filter((o) => o.brain.rtStage >= 0 && Math.hypot(o.pos.x - cellX(o.brain.rtStage), o.pos.z - cellZ(o.brain.rtStage)) < 5).length;
    if (staged >= Math.min(2, mates.length) || c.timer < (a.kit ? 10 : 17) + 9 || mates.length === 1) GS.rtGo = true;
  }
  if (!GS.rtGo) return { cell: b.rtStage, hold: true, exact: true, stage: true };
  if (!GS.defuser || !GS.defuser.alive) GS.defuser = mates.filter((o) => o.kit).concat(mates).sort((x, y) => x.pos.distanceTo(c.pos) - y.pos.distanceTo(c.pos))[0] || null;
  if (GS.defuser === a) return { cell: bombCell, pos: c.pos, defuse: true };
  return { cell: b.rtCover, hold: true, exact: true };
}
// something to hide behind, sideways of the line to the enemy? (-1 / 1 = which way to step, 0 = nothing)
function coverSideOf(a, T, px, pz) {
  const tp = chestPos(T, _v1), ok = [];
  for (const s of [-1, 1]) {
    const x = a.pos.x + px * s * 1.15, z = a.pos.z + pz * s * 1.15;
    if (blocked(x, z, a.pos.y)) continue;
    if (!losClear(_v2.set(x, a.pos.y + 1.45, z), tp)) ok.push(s);
  }
  return ok.length ? pick(ok) : 0;
}
// how a bot moves while it has an enemy in sight: peek out, shoot, step back behind cover; or strafe and stop to shoot
function fightMove(a, b, T, dist, def, out) {
  const dd = D(), now = GS.time;
  const dx = T.pos.x - a.pos.x, dz = T.pos.z - a.pos.z, L = Math.hypot(dx, dz) || 1, px = -dz / L, pz = dx / L;
  if (now > b.coverT) { b.coverT = now + 0.4; b.coverSide = coverSideOf(a, T, px, pz); }
  if (!(now < b.fightUntil)) {   // choose what to do next
    const prev = b.fightMode; let mode, dur;
    const wantPeek = b.coverSide !== 0 && dist > 5 && (b.peeker === undefined ? (b.peeker = Math.random() < dd.peek) : b.peeker);
    if (a.hp < 45 && b.coverSide !== 0 && prev !== 'hide') { mode = 'hide'; dur = rand(0.7, 1.3); }
    else if (wantPeek) { if (prev === 'expose') { mode = 'hide'; dur = rand(0.35, 0.8); } else { mode = 'expose'; dur = rand(0.55, 1.4); } }
    else if (dist < 5) { mode = 'strafe'; dur = rand(0.5, 1.0); }
    else if (dist > 16 || Math.random() < 0.4) { mode = 'expose'; dur = rand(0.5, 1.2); }
    else { mode = 'strafe'; dur = rand(0.6, 1.2); }
    b.fightMode = mode; b.fightUntil = now + dur; b.strafeDir = Math.random() < 0.5 ? 1 : -1; b.sT = 0;
    const st = (GS.stat ||= {}); st['fight_' + mode] = (st['fight_' + mode] || 0) + 1;
    if (mode === 'expose') a.crouch = (dist > 13 || b.coverSide !== 0) && Math.random() < 0.55 && !!a.prim; else a.crouch = false;
  }
  if (b.fightMode === 'hide') {
    if (b.coverSide !== 0) { out.wx = px * b.coverSide; out.wz = pz * b.coverSide; } else { out.wx = -dx / L; out.wz = -dz / L; }
    out.spd *= 0.95; b.waitUntil = now + rand(0.25, 0.8); a.crouch = false;
  } else if (b.fightMode === 'strafe') {
    b.sT -= out.dt; if (b.sT <= -0.2) b.sT = rand(0.25, 0.4);   // move ... then stop for a moment (the shots go out while you stand still)
    if (b.sT > 0) {
      if (blocked(a.pos.x + px * b.strafeDir * 0.8, a.pos.z + pz * b.strafeDir * 0.8, a.pos.y)) b.strafeDir *= -1;
      out.wx = px * b.strafeDir; out.wz = pz * b.strafeDir; out.spd *= 0.85;
    }
  }
}

// per-tick thinking of the smart bots: sounds, intel, rotations, switching sites
function smartThink(a, b) {
  const N = navFor(), dd = D(), c = GS.core, rt = rtNow();
  // a new sound (footsteps / shots nearby)?
  if (b.heardPos && b.heardT > b.heardSeen) {
    b.heardSeen = b.heardT;
    if (!b.vis) {
      const d = a.pos.distanceTo(b.heardPos);
      noteEnemy(a.side, b.heardPos, 'h' + ((b.heardPos.x / 4) | 0) + ':' + ((b.heardPos.z / 4) | 0), 0.5);
      if (a.side === 1 && c.state !== 'planted') {
        if ((b.role === 'aggro' || b.role === 'rotator') && d < 30 && Math.random() < 0.45 + 0.3 * dd.team && GS.time > b.invCool) { b.invCell = cellOf(b.heardPos.x, b.heardPos.z); b.invT = GS.time + rand(4, 7); b.invCool = GS.time + 9; }
        else if (d < 20) { b.freezeUntil = GS.time + rand(0.7, 1.7); if (b.role !== 'aggro' && Math.random() < 0.4) a.crouch = !!a.prim; }   // listen, crouch, wait at the angle
      } else if (a.side === 0 && GS.state === 'live' && d < 22 && GS.strat && GS.strat.kind !== 'rush' && !GS.allIn && b.role !== 'carrier') b.freezeUntil = GS.time + rand(0.5, 1.2);   // stop, take cover, pre-aim
    }
  }
  if (GS.state !== 'live') return;
  if (a.side === 1 && c.state !== 'planted') {
    // finished rotating?
    if (b.rotate && GS.time >= b.rotAt) { b.hold = b.rotSpot; b.site = b.rotate; b.rotate = null; b.fwd = -1; remember(a, b.hold); b.watch = []; at(b.hold, 1.6, _e1); for (const lc of shuffle(N.lane[b.site].slice())) { if (losClear(_e1, at(lc, 1.5, _e2), false)) { b.watch.push(lc); if (b.watch.length >= 2) break; } } }
    // calm for a while: some defenders swap to another angle on the same site
    if (!b.rotate && b.site && GS.time > b.homeT && !b.vis && GS.time - b.lastSeenT > 6 && intelCount(1, b.site, 10) < 0.5 && b.role !== 'sniper' && !(b.role === 'aggro' && rt < b.fwdUntil)) {
      b.homeT = GS.time + rand(16, 32);
      if (Math.random() < 0.3 + 0.4 * dd.team) {
        const taken = GS.actors.filter((o) => o !== a && o.alive && o.brain && o.side === 1).map((o) => o.brain.hold);
        const sp = pickSpot(N.hold[b.site], taken, 5, [b.hold]);
        if (sp >= 0) { b.hold = sp; remember(a, sp); b.watch = []; at(sp, 1.6, _e1); for (const lc of shuffle(N.lane[b.site].slice())) { if (losClear(_e1, at(lc, 1.5, _e2), false)) { b.watch.push(lc); if (b.watch.length >= 2) break; } } b.microUntil = 0; }
      }
    }
    // the enemy shows up at the OTHER site: rotate there (slower on easy levels, only a couple of people leave)
    if (!b.rotate && GS.time > b.rotCool && !(b.role === 'aggro' && rt < b.fwdUntil)) {
      for (const k of ['a', 'b']) {
        if (b.site === k) continue;
        const n = intelCount(1, k), home = b.site ? intelCount(1, b.site) : 0;
        if (n >= (b.role === 'rotator' ? 1.4 : 2.0) && home < 1 && GS.rotCount[k] < 2) {
          const taken = GS.actors.filter((o) => o !== a && o.alive && o.brain && o.side === 1).map((o) => o.brain.hold);
          b.rotate = k; b.rotSpot = pickSpot(N.hold[k], taken, 5, recentOf(a)); if (b.rotSpot < 0) { b.rotate = null; continue; }
          b.rotAt = GS.time + dd.rotDelay * rand(0.5, 1.4); b.rotCool = GS.time + 12; GS.rotCount[k]++;
          const st = (GS.stat ||= {}); st.rotations = (st.rotations || 0) + 1; break;
        }
      }
    }
  }
  // attackers read the defence: a stacked site gets abandoned for the other one (once per round, only on hit / slow plans)
  if (a.side === 0 && !GS.switched && GS.strat && (GS.strat.kind === 'hit' || GS.strat.kind === 'slow') && rt > 10 && rt < (b.goAt || 0) - 3 && b.site && b.role !== 'lurk' && b.role !== 'carrier') {
    const X = b.site, Y = X === 'a' ? 'b' : 'a';
    if (intelCount(0, X) >= 3 && intelCount(0, Y) < 1 && Math.random() < 0.06 + 0.1 * dd.team) {
      GS.switched = true; const cost = newCost(1);
      for (const o of GS.actors) if (o.alive && o.brain && o.side === 0 && o.brain.site === X && o.brain.role !== 'lurk') {
        const ob = o.brain; ob.site = Y; ob.stage = pickSpot(N.stage[Y], [], 6); if (ob.stage < 0) ob.stage = N.site[Y];
        ob.route = routeFor(o, ob.stage, cost, true); ob.ri = 0; ob.entry = pickSpot(N.post[Y], [], 4); ob.plantCell = plantCellFor(Y); ob.goAt = Math.max(ob.goAt, rt + 8 + (ob.goAt - GS.strat.goAt));
      }
      GS.plan = Y; GS.firstGo = Math.min(...GS.actors.filter((o) => o.alive && o.brain && o.side === 0 && o.brain.site).map((o) => o.brain.goAt)) - 0.1;
      const st = (GS.stat ||= {}); st.switches = (st.switches || 0) + 1;
    }
  }
}
// grenades with a purpose: smoke the long angle and flash the entrance before a hit, smoke off the entrance when you are being hit, flash and smoke on a retake
function smartUtil(a, b, dd) {
  if (GS.state !== 'live' || a.act || b.vis || a.blindT > 0.3 || GS.time < b.utilT) return;
  const N = navFor(), rt = rtNow(), c = GS.core;
  const throwAt = (cell, type) => { const tp = V().set(cellX(cell), 0.4, cellZ(cell)); if (tp.distanceTo(a.pos) > 27 || tp.distanceTo(a.pos) < 5) return false; lob(a, tp, type); b.utilT = GS.time + rand(0.9, 1.6); return true; };
  if (a.side === 0 && b.site && c.state !== 'planted' && ['support', 'entry', 'fake', 'trade'].includes(b.role) && Math.random() < 0.25 + 0.7 * dd.nade) {
    const sg = rt - b.goAt;   // seconds relative to the moment this bot goes in
    if (sg > -3 && sg < 2.5) {
      if (a.nades.smoke && !b.smk && sg < -0.8 && (b.role === 'support' || b.role === 'fake')) { const sp = pickSpot(N.hold[b.site], [], 3); if (sp >= 0 && throwAt(sp, 'smoke')) b.smk = 1; return; }
      if (a.nades.molly && !b.mol && sg < 0 && b.role === 'support') { const sp = pickSpot(N.hold[b.site], [], 3); if (sp >= 0 && throwAt(sp, 'molly')) b.mol = 1; return; }
      if (a.nades.flash && (b.fl || 0) < 2 && sg > -1.2 && b.entry >= 0) { if (throwAt(b.entry, 'flash')) b.fl = (b.fl || 0) + 1; return; }
      if (a.nades.he && !b.hePop && sg > -1 && b.role !== 'entry' && b.entry >= 0 && Math.random() < 0.5) { if (throwAt(N.site[b.site], 'he')) b.hePop = 1; return; }
    }
  }
  if (a.side === 1 && GS.strat) {
    if (c.state !== 'planted' && b.site && intelCount(1, b.site) >= 2) {   // they are hitting my site: smoke the entrance, molly the lane
      if (a.nades.smoke && !b.smk) { const sp = pickSpot(N.stage[b.site], [], 3); if (sp >= 0 && throwAt(sp, 'smoke')) b.smk = 1; return; }
      if (a.nades.molly && !b.mol && N.lane[b.site].length) { if (throwAt(pick(N.lane[b.site]), 'molly')) b.mol = 1; return; }
    }
    if (c.state === 'planted' && GS.rtGo) {   // retake: smoke and flash the bomb before going in
      const bc = cellOf(c.pos.x, c.pos.z);
      if (a.nades.smoke && !c.smoked && a.pos.distanceTo(c.pos) < 24) { if (throwAt(bc, 'smoke')) c.smoked = true; return; }
      if (a.nades.flash && !b.rtFl && GS.defuser && GS.defuser !== a) { if (throwAt(bc, 'flash')) b.rtFl = 1; return; }
    }
  }
}

function holdLook(cell, enemySide) {
  const key = cell * 2 + enemySide;
  if (holdLookCache.has(key)) return holdLookCache.get(key);
  const target = (enemySide === 0 ? SPAWN.T : SPAWN.D)[0];
  const path = astar(cell, target);
  const eye = V().set(cellX(cell), 1.6, cellZ(cell));
  let look = path[Math.min(4, path.length - 1)];
  for (let i = 0; i < Math.min(18, path.length); i++) if (losClear(eye, _v2.set(cellX(path[i]), 1.6, cellZ(path[i])), false)) look = path[i];
  const r = V().set(cellX(look), 1.4, cellZ(look));
  holdLookCache.set(key, r); return r;
}
// every bot gets its own spot near a shared goal (nobody stacks on one cell)
function spreadCell(a, b, base) {
  if (b.claimBase === base && b.claimCell >= 0) return b.claimCell;
  const taken = [];
  for (const o of GS.actors) if (o !== a && o.alive && o.brain && o.side === a.side && o.brain.claimCell >= 0) taken.push(o.brain.claimCell);
  const bx = base % W, bz = (base / W) | 0, cand = [];
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const x = bx + dx, z = bz + dz; if (x < 0 || z < 0 || x >= W || z >= H) continue;
    const c = z * W + x; if (!walk(c) || taken.includes(c)) continue;
    const touching = taken.some((t) => Math.abs((t % W) - x) <= 1 && Math.abs(((t / W) | 0) - z) <= 1);
    cand.push([Math.hypot(dx, dz) + Math.random() * 1.2 + (touching ? 3 : 0), c]);
  }
  cand.sort((p, q) => p[0] - q[0]);
  b.claimBase = base; b.claimCell = cand.length ? cand[0][1] : base;
  return b.claimCell;
}
// team communication: tell nearby teammates where an enemy is / where a teammate died
function teamCall(src, pos, radius, dur, strength) {
  const st = (GS.stat ||= {}); st.calls = (st.calls || 0) + 1;
  for (const o of GS.actors) {
    if (o === src || !o.alive || !o.brain || o.side !== src.side || o.dummy) continue;
    const b = o.brain, d = o.pos.distanceTo(pos);
    if (d > radius) continue;
    b.heardPos = pos.clone(); b.heardT = GS.time;
    if (!b.vis && !o.act && GS.time > b.invCool - 6 && Math.random() < strength * D().team) { b.invCell = cellOf(pos.x, pos.z); b.invT = GS.time + dur; b.invCool = GS.time + dur + 4; st.responses = (st.responses || 0) + 1; if (NB && strength >= 0.9) b.tradeT = GS.time + dur; }
  }
}
// roles that depend on the gun a bot bought: snipers hold long angles, shotguns stay close
function assignRoles() {
  for (const a of GS.actors) {
    const b = a.brain; if (!b || !a.prim) continue;
    const d = WD[a.prim.id];
    if (d.scope) {
      if (a.side === 1) { b.home = pick(MID_HOLDS); b.homeSite = null; }
      else if (!b.lurk && Math.random() < 0.6) { b.lurk = true; b.lurkSpot = pick([LURK, ...MID_HOLDS]); }
    } else if (d.pellets && a.side === 1) { b.home = pick([...SITES.a.holdsDef, ...SITES.b.holdsDef]); b.homeSite = SITES.a.holdsDef.includes(b.home) ? 'a' : 'b'; }
  }
}
function jitterCell(c, r) {
  const x = clamp((c % W) + ((Math.random() * (2 * r + 1)) | 0) - r, 1, W - 2), z = clamp(((c / W) | 0) + ((Math.random() * (2 * r + 1)) | 0) - r, 1, H - 2);
  return nearestWalk(z * W + x);
}
function setupBrains() {
  const atk = GS.actors.filter((a) => a.brain && a.side === 0), def = GS.actors.filter((a) => a.brain && a.side === 1);
  const plan = GS.plan, other = plan === 'a' ? 'b' : 'a', rs = ROUTES[plan], ro = ROUTES[other];
  const lurkSpots = [LURK, ro[0][ro[0].length - 1], ro[1][ro[1].length - 1], MID_HOLDS[0], rs[1][0]];
  atk.forEach((a, i) => {
    const b = a.brain = newBrain(a, i);
    if (i >= 2 && atk.length >= 3 && Math.random() < (i === 3 ? 0.5 : 0.25)) { b.lurk = true; b.lurkSpot = pick(lurkSpots); }
    b.route = (Math.random() < 0.5 ? rs[0] : rs[1]).slice();
    b.plantCell = plantCellFor(plan);
  });
  // defenders: a different setup every round (2-2-1, 3-1-1, 1-3-1 ...) and different spots
  const aH = shuffle(SITES.a.holdsDef.slice()), bH = shuffle(SITES.b.holdsDef.slice()), mH = shuffle(MID_HOLDS.slice());
  const lay = pick([[2, 2, 1], [3, 1, 1], [1, 3, 1], [2, 1, 2], [1, 2, 2], [2, 2, 1]]);
  const homes = shuffle([...aH.slice(0, lay[0]).map((c) => [c, 'a']), ...bH.slice(0, lay[1]).map((c) => [c, 'b']), ...mH.slice(0, lay[2]).map((c) => [c, null])]);
  def.forEach((a, i) => { const b = a.brain = newBrain(a, i); const h = homes[i % homes.length]; b.home = h[0]; b.homeSite = h[1]; });
}
function newBrain(a, idx) {
  return { idx, path: [], pi: 0, goal: -1, think: Math.random() * 0.1, target: null, vis: false, react: 0, errY: 0, errP: 0, aimHead: false, lastSeen: null, lastSeenT: -99, heardPos: null, heardT: -99, hurtT: -99, hurtBy: null, burst: 0, pauseT: 0, strafe: 1, startDelay: rand(0, 1.2), ri: 0, route: [], stuckT: 0, lastPos: a.pos.clone(), rotate: null, roam: -1, roamT: 0, nadeDone: false, unstuck: 0, lookPos: null, claimBase: -1, claimCell: -1, lurkSpot: -1, off: [rand(-0.55, 0.55), rand(-0.55, 0.55)],
    reposT: GS.time + rand(2, 6), homeT: GS.time + rand(9, 22), invT: 0, invCell: -1, invCool: GS.time + 6, jumpT: GS.time + rand(1, 4), retreatT: 0, retreatCool: 0, callCool: 0, saveCell: null,
    // smart bots
    role: '', site: null, hold: -1, fwd: -1, fwdUntil: 0, rotSpot: -1, rotAt: 0, rotCool: GS.time + 6, stage: -1, entry: -1, postSpot: -1, postAt: -1, rtStage: -1, rtCover: -1, rtAt: -1, goAt: 9999, swapAt: 0, leader: null, watch: [], plantCell: -1,
    pers: pick(['rusher', 'aggro', 'steady', 'steady', 'careful', 'careful']), rt: rand(0.74, 1.12), aimSk: rand(0.8, 1.28), nerve: rand(0.7, 1.2),   // personality: how quick to react, how steady the aim, how calm under fire
    heardSeen: 0, microAt: GS.time + rand(3, 8), microUntil: 0, microCell: -1, freezeUntil: 0, waitUntil: 0, tradeT: 0, coverT: 0, coverSide: 0, fightUntil: 0, fightMode: null, strafeDir: 1, sT: 0, utilT: 0, cleared: false };
}
function canSee(a, e, fov = 1.25) {
  if (a.blindT > 0.3) return false;
  const ep = eyePos(a), dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z, dist = Math.hypot(dx, dz);
  if (dist > (a.brain ? D().see : 120)) return false;
  if (dist > 2.5) { const ang = Math.atan2(-dx, -dz); if (Math.abs(angDiff(a.yaw, ang)) > fov) return false; }
  if (losClear(ep, headPos(e, _v1))) return true;
  return losClear(ep, chestPos(e, _v1));
}
function reached(a, cell, r = 1.3) { return Math.hypot(a.pos.x - cellX(cell), a.pos.z - cellZ(cell)) < r; }
function compGoal(a, b) {
  const c = GS.core, site = SITES[GS.plan];
  if (a.side === 0 && GS.state === 'live' && c.state !== 'planted' && c.state !== 'dropped' && GS.roundT < 12 && a.prim && alive(0).length <= 2 && c.carrier !== a) {
    if (b.saveCell == null) { b.saveCell = pick(SPAWN.T); const st = (GS.stat ||= {}); st.saves = (st.saves || 0) + 1; }
    return { cell: b.saveCell, hold: true, save: true };
  }
  if (a.side === 0) {
    if (c.state === 'dropped' && (!GS.fetcher || !GS.fetcher.alive)) GS.fetcher = alive(0).filter((x) => x.brain).sort((x, y) => x.pos.distanceTo(c.pos) - y.pos.distanceTo(c.pos))[0] || null;
    if (c.state === 'dropped' && GS.fetcher === a) return { cell: cellOf(c.pos.x, c.pos.z), pos: c.pos };
    if (c.state === 'planted' || c.state === 'boom') return { cell: SITES[c.site].holdsAtk[b.idx % 4], hold: true };
    if (b.lurk && !GS.execute) return { cell: b.lurkSpot >= 0 ? b.lurkSpot : LURK, hold: true };
    while (b.ri < b.route.length) {
      const last = b.ri === b.route.length - 1;
      if (last ? (GS.execute && reached(a, b.route[b.ri], 3.2)) : reached(a, b.route[b.ri], 1.8)) b.ri++; else break;
    }
    if (b.ri < b.route.length) {
      const stage = b.ri === b.route.length - 1;
      if (stage && !GS.execute && GS.roundT > 0) return { cell: b.route[b.ri], hold: true, stage: true };
      return { cell: b.route[b.ri] };
    }
    if (c.carrier === a) return { cell: b.plantCell, plant: true };
    return { cell: site.holdsAtk[b.idx % 4], hold: true };
  }
  if (c.state === 'planted') {
    const near = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z);
    if (a.prim && !a.act && near > 5 && c.timer < (a.kit ? 5.5 : 10.5) + near / 6) { if (b.saveCell == null) { b.saveCell = pick(SPAWN.D); const st = (GS.stat ||= {}); st.saves = (st.saves || 0) + 1; } return { cell: b.saveCell, hold: true, save: true }; }
    return { cell: cellOf(c.pos.x, c.pos.z), pos: c.pos, defuse: true };
  }
  if (b.rotate) return { cell: SITES[b.rotate].holdsDef[b.idx % 3], hold: true };
  return { cell: b.home, hold: true };
}
function dmGoal(a, b) {
  if (b.roam < 0 || reached(a, b.roam) || GS.time > b.roamT) {
    let best = null, bd = 1e9;
    for (const e of GS.actors) if (e.alive && e.side !== a.side && GS.time - e.spotT < 5) { const d = e.pos.distanceTo(a.pos); if (d < bd) { bd = d; best = e; } }
    b.roam = best && Math.random() < 0.55 ? jitterCell(cellOf(best.pos.x, best.pos.z), 3) : pick(WALKABLE);
    b.roamT = GS.time + rand(5, 11);
  }
  return { cell: b.roam };
}
function botThink(a, b) {
  const dd = D();
  // perception
  let best = null, bd = 1e9;
  for (const e of GS.actors) {
    if (!e.alive || e.side === a.side) continue;
    const dist = e.pos.distanceTo(a.pos);
    const recent = GS.time - b.lastSeenT < 1 && b.target === e;
    if (dist < bd && canSee(a, e, recent || GS.time - b.hurtT < 1 ? Math.PI : 1.25)) { best = e; bd = dist; }
  }
  if (best) {
    if (best !== b.target || !b.vis) {
      if (best !== b.target || GS.time - b.lastSeenT > 1.2) {
        const holding = Math.hypot(a.vel.x, a.vel.z) < 1 && Math.abs(angDiff(a.yaw, Math.atan2(-(best.pos.x - a.pos.x), -(best.pos.z - a.pos.z)))) < 0.4;
        // a person needs about 0.2 - 0.35 s to see, decide and aim, a bit longer when surprised from the side or behind
        const off = Math.abs(angDiff(a.yaw, Math.atan2(-(best.pos.x - a.pos.x), -(best.pos.z - a.pos.z))));
        const panic = (a.hp < 45 || GS.time - b.hurtT < 0.6) && Math.random() < 0.3 * (1.35 - b.nerve);   // rattled: fires fast and wild
        let rt = dd.react * b.rt * rand(0.85, 1.2) * (a.blindT > 0 ? 2 : 1) * (GS.time - b.hurtT < 0.5 ? 0.85 : 1) * (GS.time < b.tradeT ? 0.8 : 1) * (holding ? 0.85 : 1) * (b.pers === 'rusher' ? 0.92 : b.pers === 'careful' ? 1.06 : 1) + (off > 1 ? 0.16 : off > 0.5 ? 0.07 : 0);
        b.react = clamp(panic ? rt * 0.8 : rt, 0.17, 0.6);
        const s = Math.random() < 0.5 ? -1 : 1, sk = b.aimSk * (panic ? 2.4 : 1);
        b.errY = s * dd.err * DEG * rand(0.6, 1.3) * sk; b.errP = (Math.random() - 0.3) * dd.err * DEG * 0.7 * sk;
        if (off > 0.35) { const sw = angDiff(a.yaw, Math.atan2(-(best.pos.x - a.pos.x), -(best.pos.z - a.pos.z))); b.errY += Math.sign(sw) * Math.min(12 * DEG, off * rand(0.04, 0.13)); b.errP += (Math.random() - 0.5) * off * 0.06; }   // a flick overshoots, then corrects and settles
        b.aimHead = Math.random() < dd.head; b.burst = 0;
        a.crouch = bd > 18 && Math.random() < 0.35 && !!a.prim;
      }
    }
    b.target = best; b.vis = true; b.lastSeen = best.pos.clone(); b.lastSeenT = GS.time;
    if (a.hp < 45 && GS.time > b.retreatCool && Math.random() < 0.3) { b.retreatT = GS.time + rand(0.8, 1.8); b.retreatCool = GS.time + 6; }
    best.spotT = GS.time; if (NB) noteEnemy(a.side, best.pos, best.id);
    if (GS.time > b.callCool) { b.callCool = GS.time + 3; teamCall(a, best.pos, 40, 3, 0.25); }
  } else { b.vis = false; if (GS.time - b.lastSeenT > 3) { b.target = null; a.crouch = false; } }

  // goals (comp)
  if (GS.mode === 'comp' && NB) smartThink(a, b);
  if (GS.mode === 'comp' && !NB) {
    const c = GS.core;
    if (a.side === 1 && c.state !== 'planted' && !b.rotate) {
      for (const k of ['a', 'b']) {
        const ctr = SITES[k].center, n = GS.actors.filter((e) => e.alive && e.side === 0 && GS.time - e.spotT < 4 && Math.hypot(e.pos.x - ctr[0] * CS, e.pos.z - ctr[1] * CS) < 22).length;
        const lost = GS.actors.some((e) => !e.alive && e.side === 1 && Math.hypot(e.pos.x - ctr[0] * CS, e.pos.z - ctr[1] * CS) < 22);
        if ((n >= 2 || (n >= 1 && lost)) && b.homeSite !== k && Math.random() < 0.8) b.rotate = k;
      }
    }
  }
  let goal = GS.mode === 'dm' ? dmGoal(a, b) : NB ? compGoal2(a, b) : compGoal(a, b);
  // ---- act like a real player, not a statue ----
  if (GS.state === 'live' && GS.mode !== 'range' && !a.act) {
    const calm = !b.vis && GS.time - b.lastSeenT > 4;
    // heard something? go and check it out
    if (!NB && !b.vis && b.heardPos && (a.side === 1 || b.lurk) && GS.time - b.heardT < 1.2 && GS.time > b.invCool && Math.random() < 0.3) { b.invCell = cellOf(b.heardPos.x, b.heardPos.z); b.invT = GS.time + rand(4, 7); b.invCool = GS.time + 9; }
    if (GS.time < b.invT && !b.vis && b.invCell >= 0 && !goal.plant && !goal.defuse && !goal.pos) goal = { cell: jitterCell(b.invCell, 1) };
    // every so often move to a different spot (defenders re-position, lurkers change lanes)
    if (!NB && GS.mode === 'comp' && calm && GS.time > b.homeT) {
      b.homeT = GS.time + rand(10, 24);
      if (a.side === 1 && GS.core.state !== 'planted') {
        const stage = [ROUTES.a, ROUTES.b].flatMap((rs) => rs.map((r) => r[r.length - 1]));
        const pool = [...SITES.a.holdsDef, ...SITES.b.holdsDef, ...MID_HOLDS, ...SITES.a.holdsAtk, ...SITES.b.holdsAtk];
        if (Math.random() < 0.1) pool.push(pick(stage));
        b.home = pick(pool); b.homeSite = SITES.a.holdsDef.includes(b.home) ? 'a' : SITES.b.holdsDef.includes(b.home) ? 'b' : null; b.rotate = null;
        b.claimBase = -1; b.claimCell = -1; goal = compGoal(a, b);
      } else if (a.side === 0 && b.lurk && !GS.execute) {
        b.lurkSpot = pick([LURK, ...MID_HOLDS, ...SITES.a.holdsAtk, ...SITES.b.holdsAtk]); b.claimBase = -1; b.claimCell = -1; goal = compGoal(a, b);
      }
    }
    // standing at a hold: shuffle around, crouch a little
    if (NB && goal.exact && goal.hold && calm && GS.time > b.reposT && reached(a, goal.cell, 1.6)) { b.reposT = GS.time + rand(3, 8); a.crouch = Math.random() < 0.3 && !!a.prim; b.off = [rand(-0.45, 0.45), rand(-0.45, 0.45)]; }
    if ((goal.hold || goal.stage) && calm && GS.time > b.reposT && b.claimCell >= 0 && reached(a, b.claimCell, 1.6)) {
      b.reposT = GS.time + rand(2.5, 7); b.claimBase = -1; b.claimCell = -1; a.crouch = Math.random() < 0.2 && !!a.prim; b.off = [rand(-0.6, 0.6), rand(-0.6, 0.6)];
    }
  }
  if ((goal.hold || goal.stage) && !goal.exact) goal.cell = spreadCell(a, b, goal.cell); else b.claimBase = -1;
  b.cur = goal;
  if (goal.cell !== b.goal) { b.goal = goal.cell; b.path = astar(cellOf(a.pos.x, a.pos.z), goal.cell); b.pi = 0; }
  if (b.pi + 1 < b.path.length && clearLine(a.pos.x, a.pos.z, cellX(b.path[b.pi + 1]), cellZ(b.path[b.pi + 1]))) b.pi++;
  // stuck
  const moved = Math.hypot(a.pos.x - b.lastPos.x, a.pos.z - b.lastPos.z);
  b.lastPos.copy(a.pos);
  if (b.wantMove && moved < 0.04) {
    b.stuckT += 0.1;
    if (b.stuckT > 0.8) {
      b.stuckT = 0; b.goal = -1; b.unstuck = 0.5; b.unYaw = Math.random() * 6.28;
      b.stuckN = GS.time - (b.stuckLast || -99) < 10 ? (b.stuckN || 0) + 1 : 1; b.stuckLast = GS.time;
      if (b.stuckN >= 3) { const c0 = nearestWalk(cellOf(a.pos.x, a.pos.z)); a.pos.x = cellX(c0); a.pos.z = cellZ(c0); b.stuckN = 0; const st = (GS.stat ||= {}); st.unwedged = (st.unwedged || 0) + 1; }   // wedged in a corner again and again: put it back in the middle of the cell
    }
  } else b.stuckT = 0;
  // plant / defuse
  const c = GS.core;
  if (GS.mode === 'comp' && GS.state === 'live' && !a.act) {
    if (goal.plant && c.carrier === a && reached(a, b.plantCell, 0.9) && plantSite(a.pos.x, a.pos.z) && !b.vis) a.act = { type: 'plant', t: 0, need: 3.2 };
    if (goal.defuse && c.state === 'planted' && Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) < 1.3 && (!b.vis || c.timer < (a.kit ? 6 : 11))) a.act = { type: 'defuse', t: 0, need: a.kit ? 5 : 10 };
    const dc = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z);
    if (goal.defuse && a.nades.smoke && !c.smoked && !a.act && dc > 3 && dc < 11 && Math.random() < 0.15 + 0.5 * dd.team) { c.smoked = true; lob(a, c.pos, 'smoke'); }
    if (c.state === 'planted' && a.side === 0 && a.nades.molly && !c.mollied && !b.vis && dc > 5 && dc < 22 && Math.random() < 0.04 + 0.05 * dd.team) { c.mollied = true; lob(a, c.pos.clone().add(V().set(rand(-1, 1), 0, rand(-1, 1))), 'molly'); }
  }
  // grenades: execute utility + HE at last known
  if (NB) smartUtil(a, b, dd);
  if (GS.state === 'live' && !b.vis && !a.act && Math.random() < dd.nade * 0.08) {
    const ld = b.target && b.lastSeen ? b.lastSeen.distanceTo(a.pos) : 0, fresh = b.target && GS.time - b.lastSeenT < 3;
    if (fresh && a.nades.he && ld > 7) lob(a, b.lastSeen, 'he');
    else if (fresh && a.nades.molly && ld > 8 && ld < 28) lob(a, b.lastSeen, 'molly');
    else if (fresh && a.nades.flash && ld > 7 && ld < 30 && (a.side === 1 || GS.execute)) lob(a, b.lastSeen, 'flash');
    else if (!NB && GS.mode === 'comp' && a.side === 0 && GS.execute && !b.nadeDone && b.ri >= b.route.length - 1) {
      b.nadeDone = true;
      const ctr = SITES[GS.plan].center, tp = V().set(ctr[0] * CS, 0.5, ctr[1] * CS);
      if (a.nades.smoke) lob(a, tp.clone().add(V().set(rand(-4, 4), 0, -6)), 'smoke');
      else if (a.nades.flash) lob(a, tp, 'flash');
    }
  }
}
function lob(a, tp, type) {
  const st = (GS.stat ||= {}); st['throw_' + type] = (st['throw_' + type] || 0) + 1;
  const dx = tp.x - a.pos.x, dz = tp.z - a.pos.z, d = Math.hypot(dx, dz);
  const th = 52 * DEG, v = clamp(Math.sqrt(d * 15 / Math.sin(2 * th)) * 0.9, 6, 21);
  const prevSlot = a.slot;
  a.yaw = Math.atan2(-dx, -dz);
  throwNade(a, type, fwd(a.yaw, th), v);
  a.slot = slotOK(a, prevSlot) ? prevSlot : bestSlot(a);
}
function botUpdate(a, dt) {
  const b = a.brain, dd = D();
  if (a.dummy) {
    a.strafeT -= dt; if (a.strafeT <= 0) { a.strafe *= -1; a.strafeT = rand(0.5, 1.4); }
    const sx = Math.cos(a.yaw) * a.strafe, sz = -Math.sin(a.yaw) * a.strafe;
    physics(a, dt, sx, sz, 3.2, false);
    return;
  }
  b.think -= dt;
  if (b.think <= 0) { b.think = 0.1; botThink(a, b); }
  b.react -= dt; b.pauseT -= dt; b.unstuck -= dt;
  const decay = Math.exp(-dt * dd.settle); b.errY *= decay; b.errP *= decay;
  const frozen = GS.state === 'freeze' || (GS.state === 'live' && GS.time - GS.roundStart < b.startDelay + (GS.phaseT > 0 ? GS.phaseT : 0));
  const w = curW(a), def = WD[w.id];
  // weapon housekeeping
  if (a.switchT <= 0 && a.reloadT <= 0) {
    if (a.slot === 'nade') equip(a, bestSlot(a));
    else if (a.prim && a.slot !== 'prim' && (a.prim.mag > 0 || a.prim.res > 0) && !b.vis) equip(a, 'prim');
    else if (w.mag === 0 && w.res === 0) equip(a, a.slot === 'prim' && a.sec ? 'sec' : 'knife');
    else if (def.mag && (w.mag === 0 || (!b.vis && GS.time - b.lastSeenT > 2 && w.mag < def.mag * 0.4))) startReload(a);
    else if (def.mag && b.vis && w.mag > 0 && w.mag < def.mag * 0.25 && !def.shell && Math.random() < dt * 0.3 * (1.35 - b.nerve)) startReload(a);   // a nervous player reloads in the middle of a fight
  }
  // aim
  let wantY = a.yaw, wantP = 0, tgtYaw = null, tol = 0;
  const T = b.target;
  if (T && b.vis && T.alive) {
    const tp = b.aimHead ? headPos(T, _v1) : chestPos(T, _v1);
    if (dd.lead) { tp.x += T.vel.x * dd.lead; tp.z += T.vel.z * dd.lead; }
    const ep = eyePos(a, _v2), dx = tp.x - ep.x, dy = tp.y - ep.y, dz = tp.z - ep.z, hd = Math.hypot(dx, dz);
    tgtYaw = Math.atan2(-dx, -dz); const tgtP = Math.atan2(dy, hd);
    wantY = tgtYaw + b.errY; wantP = tgtP + b.errP;
    tol = Math.atan2(b.aimHead ? 0.16 : 0.26, hd) + 0.4 * DEG;
    b.tgtP = tgtP;
  } else if (T && GS.time - b.lastSeenT < 3 && b.lastSeen) {
    wantY = Math.atan2(-(b.lastSeen.x - a.pos.x), -(b.lastSeen.z - a.pos.z));
  } else if (GS.time - b.heardT < 1.6 && b.heardPos) {
    wantY = Math.atan2(-(b.heardPos.x - a.pos.x), -(b.heardPos.z - a.pos.z));
  } else if (b.cur && b.cur.hold && b.path.length && b.pi >= b.path.length - 1 && reached(a, b.cur.cell, 1.2)) {
    let lp;
    if (NB && a.side === 1 && b.watch.length && b.cur.cell === b.hold) { const wc = b.watch[Math.floor(GS.time / 3.4 + b.idx) % b.watch.length]; lp = _v1.set(cellX(wc), 1.4, cellZ(wc)); }   // scan the lanes they will come down
    else lp = GS.mode === 'comp' && GS.core.state === 'planted' && a.side === 0 ? holdLook(b.cur.cell, 1) : holdLook(b.cur.cell, 1 - a.side);
    wantY = Math.atan2(-(lp.x - a.pos.x), -(lp.z - a.pos.z)) + Math.sin(GS.time * 0.5 + b.idx) * 0.25;
  } else if (NB && b.path.length && b.pi < b.path.length - 1 && Math.hypot(a.vel.x, a.vel.z) > 1) {   // look round the corner BEFORE walking round it
    const la = b.path[Math.min(b.pi + 4, b.path.length - 1)]; wantY = Math.atan2(-(cellX(la) - a.pos.x), -(cellZ(la) - a.pos.z));
  } else if (Math.hypot(a.vel.x, a.vel.z) > 1) wantY = Math.atan2(-a.vel.x, -a.vel.z);
  const turn = dd.turn * dt * (a.blindT > 0 ? 0.3 : 1);
  const dy = angDiff(a.yaw, wantY);
  a.yaw += clamp(dy * Math.min(1, dt * 14), -turn, turn);
  a.pitch += clamp((wantP - a.pitch) * Math.min(1, dt * 12), -turn, turn);
  // movement
  let wx = 0, wz = 0, spd = def.speed;
  a.sprint = false;
  b.wantMove = false;
  if (!frozen && !a.act) {
    const engaged = T && b.vis && T.alive;
    if (b.unstuck > 0) { wx = -Math.sin(b.unYaw); wz = -Math.cos(b.unYaw); b.wantMove = true; }
    else if (engaged) {
      const dist = T.pos.distanceTo(a.pos);
      if (GS.time < b.retreatT && !def.melee) { const d = _v1.subVectors(a.pos, T.pos).setY(0).normalize(); wx = d.x; wz = d.z; b.wantMove = true; }
      else if (def.melee || (def.pellets && dist > 6)) { const d = _v1.subVectors(T.pos, a.pos).setY(0).normalize(); wx = d.x; wz = d.z; b.wantMove = true; }
      else if (NB) { const o = { wx: 0, wz: 0, spd, dt }; fightMove(a, b, T, dist, def, o); wx = o.wx; wz = o.wz; spd = o.spd; b.wantMove = !!(wx || wz); }
      else if (b.pauseT > 0 && dist > 5) { b.strafe = Math.sin(GS.time * 2 + b.idx) > 0 ? 1 : -1; wx = Math.cos(a.yaw) * b.strafe; wz = -Math.sin(a.yaw) * b.strafe; spd *= 0.75; }
    } else if (NB && (GS.time < b.freezeUntil || GS.time < b.waitUntil)) { /* listening / waiting for the next peek: stand still */ }
    else if (b.path.length && b.pi < b.path.length) {
      const last = b.pi === b.path.length - 1;
      const tx = last && b.cur && b.cur.pos ? b.cur.pos.x : cellX(b.path[b.pi]) + b.off[0], tz = last && b.cur && b.cur.pos ? b.cur.pos.z : cellZ(b.path[b.pi]) + b.off[1];
      const dx = tx - a.pos.x, dz = tz - a.pos.z, dl = Math.hypot(dx, dz);
      if (dl < (last ? 0.25 : 0.7)) { if (!last) b.pi++; }
      else { wx = dx / dl; wz = dz / dl; b.wantMove = true; if (last && dl < 1.2) spd *= 0.5; }
      if (b.cur && b.cur.stage && dl < 3) { wx = 0; wz = 0; b.wantMove = false; }
      if (T && GS.time - b.lastSeenT < 2) spd *= 0.5; // walk carefully after contact
      else if (GS.time - b.lastSeenT > 4 && b.path.length - b.pi > 6 && !(b.cur && b.cur.stage)) { spd *= 1.3; a.sprint = true; }
      if (NB) {
        const sd = b.site && NAV ? dv(NAV.d[b.site], cellOf(a.pos.x, a.pos.z)) : 99;
        if (a.side === 0 && sd < 13 && GS.strat && GS.strat.kind !== 'rush' && !GS.allIn && GS.time - b.lastSeenT > 1) { spd *= 0.55; a.sprint = false; }   // near the site: walk (a walk makes no noise)
        if (b.leader && b.leader.alive && rtNow() >= b.goAt - 1) { const dl = a.pos.distanceTo(b.leader.pos); if (dl < 4.5) spd *= 0.8; else if (dl > 13) { spd *= 1.25; a.sprint = true; } }   // go in together
      }
    }
  }
  for (const f of GS.fires) { const fx = a.pos.x - f.x, fz = a.pos.z - f.z, fd = Math.hypot(fx, fz); if (fd < f.r + 0.9) { const kk = fd || 1; wx = fx / kk; wz = fz / kk; b.wantMove = true; a.sprint = true; spd = def.speed * 1.3; } }
  // separation
  for (const o of GS.actors) {
    if (o === a || !o.alive) continue;
    const dx = a.pos.x - o.pos.x, dz = a.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.5 && d2 > 1e-4) { const d = Math.sqrt(d2); tryMove(a, dx / d * (0.71 - d) * 0.5, dz / d * (0.71 - d) * 0.5); }
  }
  const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  let hop = false;
  if (a.sprint && a.onGround && GS.time > b.jumpT) { hop = Math.random() < 0.45; b.jumpT = GS.time + rand(1.4, 4); }
  physics(a, dt, wx, wz, spd * (a.crouch ? 0.34 : 1) * (a.tagT > 0 ? 0.55 : 1), hop);
  footsteps(a, dt);
  // fire
  if (T && b.vis && T.alive && b.react <= 0 && !frozen && !a.act && a.switchT <= 0 && (a.reloadT <= 0 || (def.shell && w.mag > 0)) && a.blindT <= 0.3 && GS.time >= a.nextFire && GS.state !== 'freeze') {
    const aimErr = Math.abs(angDiff(a.yaw, tgtYaw)) + Math.abs(a.pitch - b.tgtP);
    const dist = T.pos.distanceTo(a.pos);
    const slowEnough = Math.hypot(a.vel.x, a.vel.z) < def.speed * 0.4 || def.melee || def.pellets || dist < 6;
    if (def.melee) { if (dist < 1.9 && aimErr < 0.5) melee(a, Math.random() < 0.3); }
    else if (w.mag > 0 && aimErr < tol * (S.diff === 'easy' ? 2.5 : b.pers === 'rusher' ? 2.3 : 1.9) && (slowEnough || b.pauseT <= -1.5) && b.pauseT <= 0) {
      if (def.scope) a.scoped = 1;
      fireWeapon(a);
      if (!def.auto) a.nextFire += rand(0.06, 0.25) * (S.diff === 'easy' ? 2 : 1);
      b.burst++;
      const burstLen = !def.auto ? 1 : dist > 22 ? 2 + Math.floor(Math.random() * 3) : dist > 11 ? 4 + Math.floor(Math.random() * 5) : 10 + Math.floor(Math.random() * 21);   // taps and bursts at range, a longer spray up close
      if (b.burst >= burstLen) { b.burst = 0; b.pauseT = def.auto ? rand(0.22, 0.45) : 0; }
    }
  }
}

// ---------------- physics ----------------
function tryMove(a, dx, dz) {
  const nx = a.pos.x + dx; if (!blocked(nx, a.pos.z, a.pos.y)) a.pos.x = nx; else a.vel.x = 0;
  const nz = a.pos.z + dz; if (!blocked(a.pos.x, nz, a.pos.y)) a.pos.z = nz; else a.vel.z = 0;
}
function physics(a, dt, wx, wz, maxSpd, jump) {
  const accel = a.onGround ? 46 : 9;
  let dvx = wx * maxSpd - a.vel.x, dvz = wz * maxSpd - a.vel.z;
  if (!a.onGround && !wx && !wz) { dvx = 0; dvz = 0; }
  const dl = Math.hypot(dvx, dvz), mx = accel * dt;
  if (dl > mx) { dvx *= mx / dl; dvz *= mx / dl; }
  a.vel.x += dvx; a.vel.z += dvz;
  if (jump && a.onGround) { a.vel.y = 5.6; a.onGround = false; }
  a.vel.y -= 16 * dt;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(a.vel.x), Math.abs(a.vel.z)) * dt / 0.2));
  for (let i = 0; i < n; i++) tryMove(a, a.vel.x * dt / n, a.vel.z * dt / n);
  a.pos.y += a.vel.y * dt;
  const g = groundAt(a.pos.x, a.pos.z, a.pos.y);
  if (a.pos.y <= g) {
    if (!a.onGround && a.vel.y < -4) { SFX.land(a.pos); if (a.isPlayer) VMS.land = 1; }
    a.pos.y = g; a.vel.y = 0; a.onGround = true;
  } else if (a.pos.y - g > 0.06) a.onGround = false;
}
function footsteps(a, dt) {
  const sp = Math.hypot(a.vel.x, a.vel.z);
  if (!a.onGround || sp < 3.6 || a.crouch) return;
  a.stepAcc += sp * dt;
  if (a.stepAcc > 2.3) {
    a.stepAcc = 0;
    SFX.step(a.pos, a.isPlayer ? 0.35 : 1, a.pos.y > 0.5 ? 1 : 0);
    noiseEvent(a.pos, a.sprint ? 28 : 20, a);
  }
}

// ---------------- player ----------------
const keys = {};
const mouse = [false, false, false];
let pressed = new Set();
let locked = false, softLock = false, adsLatch = false;
let padMode = false, useHere = false;   // padMode: the last thing the player used was the controller · useHere: something to plant / defuse / pick up is right here (X uses it instead of reloading)
const mouseXY = [innerWidth / 2, innerHeight / 2];
let ignoreMouseUntil = 0, lastMag = 0;
document.addEventListener('pointerlockerror', () => { softLock = true; $('clickLock').classList.add('hidden'); $('pause').classList.add('hidden'); GS.paused = false; });
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { mouseXY[0] = e.clientX <= 2 ? 0 : e.clientX >= innerWidth - 3 ? innerWidth : mouseXY[0]; } });
function lock() {
  if (DEBUG) { locked = true; return; }
  const plain = () => { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => { }); } catch { } };
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch((err) => { if (err && err.name === 'NotSupportedError') plain(); });
  } catch { plain(); }
}
const uiOpen = () => mapOpen || !$('buy').classList.contains('hidden') || !$('end').classList.contains('hidden') || GS.state === 'menu' || GS.state === 'over';
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { softLock = false; ignoreMouseUntil = GS.time + 0.08; lastMag = 0; }
  if (!locked && softLock) return;
  if (locked) { $('clickLock').classList.add('hidden'); $('pause').classList.add('hidden'); GS.paused = false; }
  else if (!uiOpen() && !DEBUG) pauseGame();
});
function pauseGame() { GS.paused = true; $('board').classList.add('hidden'); $('pause').classList.remove('hidden'); for (const k in keys) keys[k] = false; mouse.fill(false); }
$('clickLock').onclick = () => lock();
canvas.addEventListener('mousedown', (e) => {
  padMode = false;
  if (GS.state === 'menu' || GS.state === 'over') return;
  if (!locked && !uiOpen()) lock();
  mouse[e.button] = true; pressed.add('M' + e.button);
});
addEventListener('mouseup', (e) => { mouse[e.button] = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
function cycleWeapon(dir) {
  const P = GS.player; if (!P || !P.alive || GS.paused || uiOpen()) return;
  const order = ['prim', 'sec', 'knife', 'nade', 'shield'].filter((s) => slotOK(P, s));
  const i = order.indexOf(P.shieldOn ? 'shield' : P.slot); equip(P, order[(i + dir + order.length) % order.length]);
}
addEventListener('wheel', (e) => cycleWeapon(e.deltaY > 0 ? 1 : -1));
document.addEventListener('mousemove', (e) => {
  mouseXY[0] = e.clientX; mouseXY[1] = e.clientY;
  const P = GS.player; if (!P || GS.paused || uiOpen()) return;
  if (!P.alive) return;
  if (document.pointerLockElement === canvas) {
    if (GS.time < ignoreMouseUntil) return;
    const mag = Math.abs(e.movementX) + Math.abs(e.movementY);
    if (mag > 220 && mag > 4 * lastMag + 60) { lastMag = Math.min(lastMag, 60); return; }
    lastMag = mag;
  } else if (!softLock && !DEBUG) return;
  if (padMode && document.pointerLockElement !== canvas) return;   // using the controller: a loose mouse doesn't turn the view until it is clicked
  const zoom = camera.fov / S.fov;
  const s = S.sens * 0.0022 * zoom;
  P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s, -1.52, 1.52);
  VMS.swayX = clamp(VMS.swayX - e.movementX * 0.00012, -0.03, 0.03); VMS.swayY = clamp(VMS.swayY + e.movementY * 0.00012, -0.03, 0.03);
});
addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && GS.state !== 'menu' && !GS.paused) e.preventDefault();
  padMode = false; document.querySelectorAll('.padf').forEach((el) => el.classList.remove('padf'));
  if (e.code === 'Escape') { const sp = ['setP', 'keysP'].find((id) => !$(id).classList.contains('hidden')); if (sp) { $(sp).classList.add('hidden'); e.preventDefault(); return; } }   // Esc closes Settings / Controls first
  if (GS.state === 'menu') return;
  if (e.code === 'KeyU' && !$('buy').classList.contains('hidden')) { e.preventDefault(); undoClick(); return; }   // U undoes the last buy while the buy menu is open
  if (e.code === 'KeyB' || (e.code === 'Escape' && !$('buy').classList.contains('hidden'))) { e.preventDefault(); if (mapOpen) toggleMap(); toggleBuy(); return; }
  if (e.code === 'KeyM' || (e.code === 'Escape' && mapOpen)) { e.preventDefault(); toggleMap(); return; }   // M = the big map: click it to put a marker your team can see
  if (e.code === 'Escape' && GS.state !== 'over') {
    e.preventDefault();
    // Native pointer-lock release may pause before this keydown arrives.
    // Escape only pauses; resuming requires the explicit Resume gesture.
    if (!GS.paused) pauseGame();
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }
  if (e.repeat) return;
  keys[e.code] = true; pressed.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && !MP.on && GS.mode === 'comp' && GS.state === 'live' && GS.player && !GS.player.alive) { if (S.speed !== 'on') { S.speed = 'on'; ffOff = false; saveS(); } else ffOff = !ffOff; } }   // Space while you are out: speed up / slow down
  if (e.code === 'Backquote') $('board').classList.remove('hidden');   // scoreboard (Tab is crouch now)
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Backquote') $('board').classList.add('hidden'); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.fill(false); $('board').classList.add('hidden'); });

// ---------------- touch controls (tablets / phones): a stick, a look pad and buttons that send the same keys and mouse clicks
if (TOUCH) {
  softLock = true;   // a tablet has no pointer lock: the look pad turns the view directly
  addEventListener('mousedown', (e) => { if (e.isTrusted) return; padMode = false; if (GS.state === 'menu' || GS.state === 'over') return; mouse[e.button] = true; pressed.add('M' + e.button); });   // the on-screen FIRE / AIM buttons
  const done = document.createElement('button'); done.className = 'btn'; done.textContent = 'DONE'; done.style.cssText = 'padding:5px 14px;font-size:13px;margin-right:10px'; done.onclick = () => toggleBuy(); $('buyUndo').before(done);   // closes the buy menu (B / Esc on a keyboard)
  const tb = (label, key, o) => Object.assign({ label, key, type: 'tap', s: 54, cls: 'small', fs: 10 }, o);
  const slotW = (label, code, i) => tb(label, code, { s: 50, fs: 9, l: Math.round(innerWidth / 2 - 105 + i * 54), b: 8 });
  initTouch({
    visible: () => GS.state !== 'menu' && GS.state !== 'over' && !GS.paused && ['buy', 'end', 'keysP', 'setP', 'onlineP', 'rankUp'].every((id) => $(id).classList.contains('hidden')),
    pause: () => { if (!GS.paused) padPause(); }, lookScale: 2.0,
    stick: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprintKey: 'ShiftLeft', sprintAt: .92 },
    css: 'html.touch #inv{right:14px;bottom:auto;top:96px} html.touch #br{right:14px;bottom:auto;top:12px}',   /* the gun list and ammo move up, out from under the buttons */
    buttons: [
      { label: 'FIRE', cls: 'fire', mouse: 0, look: true, minHold: 90, s: 92, r: 24, b: 64 },
      tb('AIM', 'KeyV', { mouseTap: 2, s: 58, r: 40, b: 168, fs: 11 }),
      { label: 'JUMP', key: 'Space', s: 64, r: 128, b: 22, cls: 'small', fs: 11 },
      tb('RELOAD', 'KeyR', { s: 58, r: 132, b: 100 }),
      { label: 'USE', key: 'KeyE', s: 58, r: 206, b: 60, cls: 'small', fs: 11, glow: () => useHere },
      tb('BUY', 'KeyB', { s: 52, r: 206, b: 130, fs: 11 }),
      { label: 'CROUCH', type: 'toggle', key: 'KeyC', s: 52, r: 270, b: 22, cls: 'small', fs: 9 },
      slotW('GUN', 'Digit1', 0), slotW('PISTOL', 'Digit2', 1), slotW('KNIFE', 'Digit3', 2), slotW('NADE', 'Digit4', 3),
      tb('DROP', 'KeyG', { s: 44, r: 270, b: 84, fs: 9 }),
      tb('PING', 'KeyZ', { s: 44, r: 270, b: 134, fs: 9 }),
      { label: 'SCORE', type: 'toggle', key: 'Backquote', s: 40, l: 150, t: 8, cls: 'small', fs: 8 },
      { label: 'II', s: 40, l: 196, t: 8, cls: 'small', type: 'tap', action: () => padPause(), fs: 14 },
    ],
  });
}


// ---------------- controller (gamepad) support ----------------
// Left stick: move (a light push walks silently, click it to sprint) · right stick: look · RT: shoot · LT: aim / scope · A: jump · B: crouch (+ slide)
// X: reload, or hold it to plant / defuse / pick up · Y: buy menu · LB / RB: switch weapon · D-pad: rifle / pistol / knife / grenade · R3: inspect · Back: scoreboard (hold) · Start: pause
// In menus: stick or D-pad moves, A picks, B goes back, Start plays / resumes. The controller needs no pointer lock, so a match started with it runs in "softLock" (the same fallback as a mouse that can't be captured).
const pad = { on: false, gp: null, prev: [], held: {}, sprint: false, fire: false, aim: false, board: false, ui: null, mode: '', armed: false, navKey: '', navT: 0, rum: 0, t: 0 };
function padRumble(w, s, ms) {
  const gp = pad.on && padMode && pad.gp; if (!gp || !gp.vibrationActuator || performance.now() < pad.rum) return;
  pad.rum = performance.now() + 40; try { gp.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: w, strongMagnitude: s }); } catch { }
}
function padKey(code, on) {   // hold a keyboard key from the controller (the key-down edge is also reported, like a real key press)
  if (on) { if (!keys[code]) pressed.add(code); keys[code] = true; pad.held[code] = true; }
  else if (pad.held[code]) { pad.held[code] = false; keys[code] = false; }
}
function padRelease() {
  for (const c in pad.held) if (pad.held[c]) { keys[c] = false; pad.held[c] = false; }
  if (pad.fire) { mouse[0] = false; pad.fire = false; }
  if (pad.aim) { mouse[2] = false; pad.aim = false; }
  if (pad.board) { $('board').classList.add('hidden'); pad.board = false; }
  pad.sprint = false;
}
const PAD_LAYERS = ['keysP', 'setP', 'rankUp', 'onlineP', 'buy', 'pause', 'end'];
const padShown = (el) => !!el && el.getClientRects().length > 0;
function padLayer() {
  for (const id of PAD_LAYERS) if (!$(id).classList.contains('hidden')) return $(id);
  return GS.state === 'menu' && !$('menu').classList.contains('hidden') ? $('menu') : null;
}
const padItems = (root) => [...root.querySelectorAll('button, summary, #sXc i, input[type=range]')].filter(padShown);
function padFocus(el) {
  if (pad.ui) pad.ui.classList.remove('padf');
  pad.ui = el;
  if (el) { el.classList.add('padf'); try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { } }
}
function padDefault(root, items) {
  for (const id of { menu: ['play'], pause: ['resume'], end: ['again', 'toLobby', 'toMenu'], rankUp: ['ruGo'], onlineP: ['onHost', 'onStart'] }[root.id] || []) if (items.includes($(id))) return $(id);
  return items.find((el) => el.matches('.item:not([disabled])')) || items[0] || null;
}
function padNav(items, dx, dy) {   // move the highlight to the nearest button in that direction
  const cur = pad.ui; if (!cur) return;
  if (dx && cur.matches('input[type=range]')) {   // sliders: left / right changes the value
    const st = (+cur.max - +cur.min) / 20; cur.value = clamp(+cur.value + dx * st, +cur.min, +cur.max); cur.dispatchEvent(new Event('input')); SFX.ui(); return;
  }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const gap = (a0, a1, b0, b1) => Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));   // 0 when the two buttons overlap on that axis (a wide slider and the buttons under it)
  let best = null, bs = 1e9;
  for (const el of items) {
    if (el === cur) continue;
    const q = el.getBoundingClientRect();
    const edge = dx > 0 ? q.left - r.right : dx < 0 ? r.left - q.right : dy > 0 ? q.top - r.bottom : r.top - q.bottom;   // it has to be past the edge of this button, in that direction
    if (edge < -6) continue;
    const across = dx ? gap(r.top, r.bottom, q.top, q.bottom) : gap(r.left, r.right, q.left, q.right);
    const off = Math.abs(dx ? q.top + q.height / 2 - cy : q.left + q.width / 2 - cx);
    const s = Math.max(0, edge) + across * 3 + off * 0.08;
    if (s < bs) { bs = s; best = el; }
  }
  if (best) { padFocus(best); SFX.ui(); }
}
function padPause() {
  if (GS.paused) { GS.paused = false; $('pause').classList.add('hidden'); return; }
  softLock = true; if (document.pointerLockElement) document.exitPointerLock();
  pauseGame();
}
function padBack(layer) {
  const id = layer.id;
  if (id === 'keysP' || id === 'setP') layer.classList.add('hidden');
  else if (id === 'onlineP') { if (padShown($('onBack'))) $('onBack').click(); }
  else if (id === 'buy') toggleBuy();
  else if (id === 'pause') padPause();
  else if (id === 'end') $('toMenu').click();
  else if (id === 'rankUp') $('ruGo').click();
}
function padClick(el) { if (!document.pointerLockElement) softLock = true; el.click(); }
function padStep(now) {
  const dt = Math.min(0.05, (now - pad.t) / 1000 || 0.016); pad.t = now;
  let gp = null;
  try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) if (g && g.connected && g.buttons.length >= 10 && g.axes.length >= 4) { gp = g; break; } } catch { }
  if (!gp) { if (pad.on) { pad.on = false; padMode = false; padRelease(); padFocus(null); } return; }
  pad.gp = gp;
  const bt = [];
  for (let i = 0; i < 17; i++) bt[i] = !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
  bt[6] = !!(gp.buttons[6] && gp.buttons[6].value > 0.35); bt[7] = !!(gp.buttons[7] && gp.buttons[7].value > 0.35);   // triggers: a light squeeze is enough
  const stick = (x, y) => { x = x || 0; y = y || 0; const m = Math.hypot(x, y); if (m < 0.18) return [0, 0]; const k = (Math.min(1, m) - 0.18) / 0.82 / m; return [x * k, y * k]; };
  const [lx, ly] = stick(gp.axes[0], gp.axes[1]), [rx, ry] = stick(gp.axes[2], gp.axes[3]);
  const held = bt.some(Boolean) || !!(lx || ly || rx || ry);
  if (!pad.on) { pad.on = true; const n = $('padNote'); if (n) n.textContent = 'Controller found: D-pad or stick to pick, A to select (see CONTROLS for the buttons)'; }
  if (held) padMode = true;
  const hit = (i) => bt[i] && !pad.prev[i], up = (i) => !bt[i] && pad.prev[i];
  const layer = padLayer(), P = GS.player;
  const playing = !layer && GS.state !== 'menu' && GS.state !== 'over' && !GS.paused && !!P;
  const mode = layer ? layer.id : playing ? 'play' : '-';
  if (mode !== pad.mode) { pad.mode = mode; pad.armed = false; padRelease(); pad.navKey = ''; padFocus(null); }   // new screen: wait until every button is let go, so one press never does two things
  if (layer && padMode) {   // show the highlight on the current screen
    const items = padItems(layer);
    if (!pad.ui || !items.includes(pad.ui)) padFocus(padDefault(layer, items)); else if (!pad.ui.classList.contains('padf')) pad.ui.classList.add('padf');
  }
  if (!pad.armed) { if (!bt.some(Boolean)) pad.armed = true; pad.prev = bt; return; }
  if (layer) {
    padRelease();
    const items = padItems(layer);
    let dx = 0, dy = 0;
    if (bt[14] || lx < -0.5) dx = -1; else if (bt[15] || lx > 0.5) dx = 1;
    if (bt[12] || ly < -0.5) dy = -1; else if (bt[13] || ly > 0.5) dy = 1;
    if (dx && dy && !(bt[12] || bt[13] || bt[14] || bt[15])) { if (Math.abs(lx) > Math.abs(ly)) dy = 0; else dx = 0; }
    const nk = dx + ',' + dy;
    if (nk !== pad.navKey) { pad.navKey = nk; pad.navT = now + 380; if (dx || dy) padNav(items, dx, dy); }
    else if ((dx || dy) && now >= pad.navT) { pad.navT = now + 130; padNav(items, dx, dy); }
    if (hit(0) && pad.ui && items.includes(pad.ui) && !pad.ui.matches('input')) {
      const i = items.indexOf(pad.ui); padClick(pad.ui);
      if (padLayer() === layer) { const it2 = padItems(layer); padFocus(it2[i] || it2[0] || null); }   // the buy menu redraws itself after a purchase: keep the highlight on the same spot
    } else if (hit(1)) padBack(layer);
    else if (hit(9)) {
      if (layer.id === 'menu') padClick($('quickPlay'));
      else if (layer.id === 'end') { const b = padShown($('again')) ? $('again') : padShown($('toLobby')) ? $('toLobby') : null; if (b) padClick(b); }
      else padBack(layer);
    }
  } else if (playing) {
    if (hit(9)) { padPause(); pad.prev = bt; return; }
    if (P.alive) {
      const k = 3.3 * S.sens * (camera.fov / S.fov) * dt, c = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.6);
      P.yaw -= c(rx) * k; P.pitch = clamp(P.pitch - c(ry) * k, -1.52, 1.52);
    }
    padKey('KeyW', ly < -0.3); padKey('KeyS', ly > 0.3); padKey('KeyA', lx < -0.3); padKey('KeyD', lx > 0.3);
    if (hit(10)) pad.sprint = !pad.sprint;
    if (ly > -0.3) pad.sprint = false;
    padKey('ShiftLeft', pad.sprint && ly < -0.5);
    const mv = Math.hypot(lx, ly); padKey('KeyX', mv > 0 && mv < 0.55 && !pad.sprint);   // a light push walks silently
    padKey('Space', bt[0]); padKey('KeyC', bt[1]);
    if (hit(7)) { mouse[0] = true; pressed.add('M0'); pad.fire = true; if (!P.alive) GS.spec++; }
    if (up(7) && pad.fire) { mouse[0] = false; pad.fire = false; }
    if (hit(6)) { mouse[2] = true; pressed.add('M2'); pad.aim = true; }
    if (up(6) && pad.aim) { mouse[2] = false; pad.aim = false; }
    if (P.alive) {
      if (hit(2)) { if (useHere) padKey('KeyE', true); else pressed.add('KeyR'); }
      if (!bt[2]) padKey('KeyE', false);
      if (hit(3)) toggleBuy();
      if (hit(4)) cycleWeapon(-1);
      if (hit(5)) cycleWeapon(1);
      if (hit(12)) pressed.add('Digit1'); if (hit(15)) pressed.add('Digit2'); if (hit(13)) pressed.add('Digit3'); if (hit(14)) pressed.add('Digit4');
      if (hit(11)) pressed.add('KeyF');
    }
    if (hit(8)) { $('board').classList.remove('hidden'); pad.board = true; }
    if (up(8) && pad.board) { $('board').classList.add('hidden'); pad.board = false; }
  } else padRelease();
  pad.prev = bt;
}
addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { padMode = false; document.querySelectorAll('.padf').forEach((el) => el.classList.remove('padf')); } }, true);   // a mouse click always means: use the mouse
function padLoop(now) { requestAnimationFrame(padLoop); padStep(now); }
requestAnimationFrame(padLoop);

function updatePlayer(dt) {
  const P = GS.player;
  if (!P.alive) { pressed.clear(); return; }
  const w = curW(P), def = WD[w.id];
  const frozen = GS.state === 'freeze' || GS.paused;
  // slots
  if (pressed.has('Digit1')) equip(P, 'prim');
  if (pressed.has('Digit2')) equip(P, 'sec');
  if (pressed.has('Digit3')) equip(P, 'knife');
  if (pressed.has('Digit4')) equip(P, 'nade');
  if (pressed.has('Digit5')) equip(P, 'shield');
  if (pressed.has('KeyQ') && slotOK(P, P.lastSlot)) equip(P, P.lastSlot);
  if (pressed.has('KeyR') && def.mag) startReload(P);
  if (pressed.has('KeyG') && GS.mode === 'comp' && !MP.on) { if (GS.core.carrier === P && P.slot === 'knife') dropCore(P); else dropCurrent(P); }
  if (pressed.has('KeyF')) VMS.inspect = 1.6;
  const wasSprint = P.sprint;
  P.crouch = !!(keys.KeyC || keys.Tab); P.walk = !!keys.KeyX;   // C or Tab
  // aim down sights: hold right-click, or press V / (in Toggle mode, for trackpads) click right once to switch it on and off
  const canAds = !!def.mag && !def.scope && P.reloadT <= 0 && P.switchT <= 0 && !frozen;
  if (S.ads === 'toggle' && pressed.has('M2')) adsLatch = !adsLatch;
  if (pressed.has('KeyV')) adsLatch = !adsLatch;
  if (pressed.has('KeyZ')) sendPing(P);   // Z = ping the spot you are looking at (your team sees it)
  if (!canAds || ((keys.ShiftLeft || keys.ShiftRight) && keys.KeyW)) adsLatch = false;
  P.ads = canAds && (S.ads === 'toggle' ? adsLatch : (!!mouse[2] || adsLatch));
  P.sprint = !!(keys.ShiftLeft || keys.ShiftRight) && !!keys.KeyW && !P.crouch && !P.ads && !mouse[0] && !P.act;
  if (P.sprint) P.sprintT = GS.time;
  // Krunker-style slide: press C while sprinting
  if ((pressed.has('KeyC') || pressed.has('Tab')) && wasSprint && P.onGround && !(P.slideT > 0) && !frozen) {
    const sp0 = Math.hypot(P.vel.x, P.vel.z) || 1;
    P.slideT = 0.85; P.slideDir = [P.vel.x / sp0, P.vel.z / sp0]; P.slideV = Math.max(sp0, def.speed * 1.3) * 1.4; SFX.land(P.pos);
  }
  if (P.slideT > 0) { P.slideT -= dt; P.crouch = true; P.sprint = false; }
  // edge turning when the browser won't capture the mouse
  if (document.pointerLockElement !== canvas && !DEBUG && !TOUCH && !uiOpen()) {
    const ex = mouseXY[0] / innerWidth, ey = mouseXY[1] / innerHeight, zone = 0.16, k = S.sens * 3.4 * dt * (camera.fov / S.fov);
    if (ex < zone) P.yaw += k * (zone - ex) / zone; else if (ex > 1 - zone) P.yaw -= k * (ex - 1 + zone) / zone;
    if (ey < zone) P.pitch = clamp(P.pitch + k * 0.6 * (zone - ey) / zone, -1.52, 1.52); else if (ey > 1 - zone) P.pitch = clamp(P.pitch - k * 0.6 * (ey - 1 + zone) / zone, -1.52, 1.52);
  }
  // E: plant / defuse / pickup
  const c = GS.core;
  const site = plantSite(P.pos.x, P.pos.z);
  let hint = '';
  if (GS.mode === 'comp' && (GS.state === 'live')) {
    if (P.side === 0 && c.carrier === P && (site === 'a' || site === 'b') && P.onGround) {
      hint = 'Hold E to plant the bomb';
      if (keys.KeyE && !P.act) P.act = { type: 'plant', t: 0, need: 3.2 };
    }
    if (P.side === 1 && c.state === 'planted' && P.pos.distanceTo(c.pos) < 1.8) {
      hint = `Hold E to defuse (${P.kit ? 5 : 10} s)`;
      if (keys.KeyE && !P.act) P.act = { type: 'defuse', t: 0, need: P.kit ? 5 : 10 };
    }
  }
  if (P.act && !keys.KeyE) P.act = null;
  if (!hint && GS.mode === 'comp' && GS.state === 'live' && P.side === 0 && c.carrier === P && !P.act) {   // carrying the bomb but not at a site yet: say so when a site is close
    hint = 'Take the bomb to site A or B, then hold E to plant';
    for (const k of ['a', 'b']) { const s = SITES[k]; if (Math.hypot(P.pos.x - s.center[0] * CS, P.pos.z - s.center[1] * CS) < 24) hint = `Walk into site ${k.toUpperCase()} to plant the bomb`; }
  }
  if (!hint && !P.act) {
    let near = null, nd = 1.8;
    for (const d of GS.drops) { const dd = Math.hypot(d.g.position.x - P.pos.x, d.g.position.z - P.pos.z); if (dd < nd) { nd = dd; near = d; } }
    if (near) {
      const slot = WD[near.w.id].slot;
      if (!P[slot]) takeDrop(P, near);
      else { hint = `E: swap for ${WD[near.w.id].name}`; if (pressed.has('KeyE')) takeDrop(P, near); }
    }
  }
  useHere = !!hint || !!P.act;
  if (!hint && document.pointerLockElement !== canvas && !DEBUG && !padMode && !TOUCH && GS.time % 8 < 4) hint = 'Mouse not captured: click the game (best in Chrome) · or push the cursor to the screen edge to keep turning';
  setHint(P.act ? '' : padMode ? hint.replace(/\bE\b/, 'X') : hint);
  // movement
  let fx = 0, fz = 0;
  if (!frozen && !P.act) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    fx = -Math.sin(P.yaw) * f + Math.cos(P.yaw) * r; fz = -Math.cos(P.yaw) * f - Math.sin(P.yaw) * r;
    const l = Math.hypot(fx, fz); if (l > 0) { fx /= l; fz /= l; }
  }
  let maxSpd = def.speed * (P.sprint ? 1.32 : 1) * (P.walk ? 0.52 : 1) * (P.crouch ? 0.34 : 1) * (P.scoped || P.ads ? 0.62 : 1) * (P.tagT > 0 ? 0.55 : 1) * (shieldUp(P) ? 0.7 : 1);
  if (P.slideT > 0 && !frozen) { fx = P.slideDir[0]; fz = P.slideDir[1]; maxSpd = P.slideV * (0.35 + 0.65 * P.slideT / 0.85); }
  physics(P, dt, fx, fz, maxSpd, keys.Space && !frozen && !P.act);
  if (!P.walk) footsteps(P, dt);
  // firing
  const can = !frozen && P.switchT <= 0 && !P.act && GS.state !== 'over' && GS.time - (P.sprintT || -9) > (def.runGun ? 0.03 : 0.12);
  if (can && def.nade) {
    if (pressed.has('M0') && GS.time >= P.nextFire) throwNade(P, w.id, fwd(P.yaw, P.pitch + 0.08), 19);
    else if (pressed.has('M2') && GS.time >= P.nextFire) throwNade(P, w.id, fwd(P.yaw, P.pitch + 0.15), 9);
  } else if (can && def.melee) {
    if (mouse[0] && GS.time >= P.nextFire) melee(P, false);
    else if (mouse[2] && GS.time >= P.nextFire) melee(P, true);
  } else if (can && (P.reloadT <= 0 || (def.shell && w.mag > 0))) {
    if (mouse[0] && GS.time >= P.nextFire && (def.auto || pressed.has('M0'))) fireWeapon(P);
    if (pressed.has('M2') && def.scope) { P.scoped = (P.scoped + 1) % ((def.zoomLv || 2) + 1); P.rescope = 0; SFX.ui(); }
  }
  if (P.rescope && GS.time >= P.nextFire && P.reloadT <= 0) { P.scoped = P.rescope; P.rescope = 0; }
  pressed.clear();
}
function updateActorTimers(a, dt) {
  a.blindT = Math.max(0, a.blindT - dt); a.protT = Math.max(0, a.protT - dt); a.tagT = Math.max(0, a.tagT - dt);
  a.crouchAmt += ((a.crouch ? 1 : 0) - a.crouchAmt) * Math.min(1, dt * 12);
  a.scopeAge = a.scoped ? (a.scopeAge || 0) + dt : 0;
  if (a.switchT > 0) a.switchT -= dt;
  if (a.burstLeft > 0) {   // the rest of a burst fires by itself
    const bw = curW(a), bd = bw && WD[bw.id];
    if (!bd || !bd.burst || a.reloadT > 0 || a.switchT > 0 || bw.mag <= 0 || a.blindT > 1.5) a.burstLeft = 0;
    else if (GS.time >= a.nextFire && (MP.role !== 'client' || a.isPlayer)) fireWeapon(a, true);
  }
  if (a.reloadT > 0) { a.reloadT -= dt; if (a.reloadT <= 0) { a.reloadT = 0; finishReload(a); } }
  const def = curDef(a);
  if (def.pat && GS.time - a.lastShot > 60 / def.rpm + 0.06) a.rc = Math.max(0, a.rc - def.rec * dt * (1 + a.rc * 0.08));
  // plant / defuse progress
  if (a.act) {
    const c = GS.core;
    a.act.t += dt;
    if (a.act.type === 'plant' && (c.carrier !== a || GS.state !== 'live')) a.act = null;
    else if (a.act.type === 'defuse' && (c.state !== 'planted' || a.pos.distanceTo(c.pos) > 2)) a.act = null;
    if (a.act && a.act.t >= a.act.need && MP.role !== 'client') {
      if (a.act.type === 'plant') {
        c.state = 'planted'; c.carrier = null; c.pos.set(a.pos.x, a.pos.y, a.pos.z); c.site = plantSite(a.pos.x, a.pos.z) || zoneAt(a.pos.x, a.pos.z); c.timer = BOMB_TIME; c.beepT = 0; c.rot = a.yaw; c.plantedAt = GS.time;
        { const fx = -Math.sin(a.yaw) * 0.75, fz = -Math.cos(a.yaw) * 0.75; if (!blocked(a.pos.x + fx, a.pos.z + fz, a.pos.y)) { c.pos.x += fx; c.pos.z += fz; } }   // it lies on the floor just in front of the planter
        addMoney(a, 300, 'plant'); a.obj = (a.obj || 0) + 1; SFX.plant(); SFX.armed(c.pos); if (MP.role === 'host') MPH.event('plant'); banner('BOMB PLANTED', `Site ${c.site.toUpperCase()} · ${BOMB_TIME} seconds`, '#ff9a3d', 2200);
        for (const b of GS.actors) if (b.brain) b.brain.goal = -1;
        feedText(`${a.name} planted the bomb at ${c.site.toUpperCase()}`);
      } else {
        c.state = 'defused'; SFX.defused(); c.rot = c.rot || 0; addMoney(a, 300, 'defuse'); a.obj = (a.obj || 0) + 1; if (MP.role === 'host') MPH.event('defused');
        feedText(`${a.name} defused the bomb!`);
        if (GS.state === 'live') endRound(1, 'defuse');
      }
      a.act = null;
    }
  }
}
// where the bomb is and what its display shows (on the floor, on a carrier's back, in the planter's hands) + when the attackers go
const KEYS = '7355608';   // the code the planter taps in
function bombClock(c) { return '0:' + String(Math.max(0, Math.ceil(c.timer))).padStart(2, '0'); }
function updateCore(dt) {
  const c = GS.core, P = GS.player;
  if (!c || GS.mode !== 'comp' || !P) { bombMesh.visible = false; vmBomb.group.visible = false; return; }
  if (c.state === 'dropped' && MP.role !== 'client') {
    for (const a of GS.actors) if (a.alive && a.side === 0 && Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) < 1.1 && Math.abs(a.pos.y - c.pos.y) < 1.2) {
      c.state = 'carried'; c.carrier = a; GS.fetcher = null; SFX.swap(); if (a.isPlayer) toast('You picked up the BOMB'); break;
    }
  }
  // who is tapping the keypad / cutting wires right now? (your own act is known exactly; other players' only by the flag in the snapshot)
  let planter = null, defuser = null;
  for (const a of GS.actors) {
    if (!a.alive) continue;
    const k = a.act ? a.act.type : a.actVis;
    if (k === 'plant' && c.carrier === a) planter = a; else if (k === 'defuse' && c.state === 'planted') defuser = a;
  }
  const B = BOMB, M = bombMesh, tt = GS.time;
  let show = true, led = false, ledCol = 0xff2a2a, txt = '--:--', col = '#ff2a1a', light = 0;
  if (c.state === 'carried' && c.carrier) {
    const a = c.carrier;
    if (planter) {   // on the floor in front of the planter, the code going in
      M.position.set(a.pos.x - Math.sin(a.yaw) * 0.75, a.pos.y, a.pos.z - Math.cos(a.yaw) * 0.75); M.rotation.set(0, a.yaw, 0, 'YXZ'); M.scale.setScalar(1.15);
      const n = a.act ? Math.floor(Math.min(0.999, a.act.t / a.act.need) * (KEYS.length + 1)) : 3;
      txt = KEYS.slice(0, n) || '-'; col = '#ffb02a'; led = Math.floor(tt * 8) % 2 === 0; ledCol = 0xffb02a;
      show = !a.isPlayer;   // the planter sees it in their hands instead
    } else {         // strapped to the back (the red light blinks slowly)
      M.position.set(a.pos.x + Math.sin(a.yaw) * 0.46, a.pos.y + 1.02 - 0.36 * a.crouchAmt, a.pos.z + Math.cos(a.yaw) * 0.46); M.rotation.set(Math.PI / 2, a.yaw, 0, 'YXZ'); M.scale.setScalar(0.72);
      led = Math.floor(tt * 1.5) % 2 === 0; ledCol = 0xff7a2a;
      show = !a.isPlayer && a.alive;
    }
  } else if (c.state === 'dropped') {
    M.position.set(c.pos.x, c.pos.y, c.pos.z); M.rotation.set(0, c.rot || 0, 0); M.scale.setScalar(1.15);
    led = Math.floor(tt * 2) % 2 === 0; ledCol = 0xff7a2a; light = 2 + Math.sin(tt * 6) * 1.5;
  } else if (c.state === 'planted' || c.state === 'defused') {
    M.position.set(c.pos.x, c.pos.y, c.pos.z); M.rotation.set(0, c.rot || 0, 0); M.scale.setScalar(1.3);
    if (c.state === 'defused') { txt = 'SAFE'; col = '#4cff7a'; led = true; ledCol = 0x4cff7a; }
    else { txt = bombClock(c); col = defuser ? '#ffd04a' : '#ff2a1a'; led = c.beepT > (c.beepI || 1) - 0.1; ledCol = defuser ? 0xffd04a : 0xff2a2a; }
    show = !(defuser && defuser.isPlayer);
  } else show = false;
  M.visible = show;
  if (show) { B.setDisplay(txt, col); B.setLed(led, ledCol); if (c.state === 'dropped') bombLight.intensity = light; }
  // in your hands (first person) while you plant or defuse
  const mine = P.alive && P.act ? P.act : null, V3 = vmBomb.group;
  V3.visible = !!mine && (c.state === 'carried' || c.state === 'planted');
  if (V3.visible) {
    const planting = mine.type === 'plant', t = mine.t, pr = Math.min(0.999, t / mine.need);
    V3.position.set(0.02, -0.27 + Math.sin(tt * 4) * 0.004, -0.72); V3.rotation.set(0.95, 0, 0); V3.scale.setScalar(0.55);
    vmBomb.setDisplay(planting ? (KEYS.slice(0, Math.floor(pr * (KEYS.length + 1))) || '-') : bombClock(c), planting ? '#ffb02a' : '#ffd04a');
    vmBomb.setLed(Math.floor(tt * 8) % 2 === 0, planting ? 0xffb02a : 0xffd04a);
    // the hand taps the keys (plant) or snips the wires (defuse)
    const k = Math.floor(t * 6), press = Math.max(0, Math.sin(t * 6 * Math.PI)), key = k % 12;
    if (planting) vmHand.position.set(((key % 3) - 1) * 0.035, 0.235 - press * 0.03, 0.025 + Math.floor(key / 3) * 0.032 + 0.06);
    else vmHand.position.set(Math.sin(t * 2.2) > 0 ? 0.145 : -0.145, 0.22 - press * 0.02, (Math.floor(t * 1.5) % 3 - 1) * 0.09 + 0.05);
    vmHand.rotation.set(-0.2, 0, 0);
  }
  // execute decision for attackers
  if (NB && GS.state === 'live' && MP.role !== 'client') {
    if (!GS.allIn && (GS.roundT < 38 || (c.carrier && c.carrier.human && c.carrier.alive && plantSite(c.carrier.pos.x, c.carrier.pos.z)))) GS.allIn = true;
    if (!GS.execute && (GS.allIn || rtNow() >= (GS.firstGo || 40))) { GS.execute = true; for (const a of GS.actors) if (a.alive && a.side === 0 && a.brain) a.brain.goal = -1; }
  } else if (GS.state === 'live' && !GS.execute && MP.role !== 'client') {
    const atk = GS.actors.filter((a) => a.alive && a.side === 0 && a.brain && !a.brain.lurk);
    const waiting = atk.filter((a) => a.brain.cur && a.brain.cur.stage && reached(a, a.brain.cur.cell, 3.2)).length;
    const elapsed = GS.time - GS.roundStart - GS.phaseT;
    if ((waiting >= Math.min(3, atk.length) && waiting > 0) || GS.roundT < 62 || (c.carrier && c.carrier.human && c.carrier.alive && plantSite(c.carrier.pos.x, c.carrier.pos.z)) || elapsed > 70 || elapsed > GS.rushAt) {
      GS.execute = true; for (const a of atk) a.brain.goal = -1;
    }
  }
}
function setHint(t) { const h = $('hint'); if (h._t !== t) { h._t = t; h.textContent = t; } }

// ---------------- HUD ----------------
function banner(big, sub = '', color = '#fff', ms = 3000, local = false) {
  if (MP.role === 'host' && !local) MPH.banner(big, sub, color, ms);
  const b = $('banner');
  b.innerHTML = `<div class="big" style="color:${color}">${big}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
  clearTimeout(b._t); b._t = setTimeout(() => (b.innerHTML = ''), ms);
}
function toast(t) { const k = $('killmsg'); k.innerHTML = `<div class="k" style="color:#ffb13d">${t}</div>`; clearTimeout(k._t); k._t = setTimeout(() => (k.innerHTML = ''), 2600); }
function feed(k, v, wid, hs) {
  const f = $('feed'), d = document.createElement('div');
  const nm = (a) => `<span style="color:${SIDE[a.side].css}">${a.isPlayer ? 'You' : a.name}</span>`;
  const wn = WD[wid] ? WD[wid].name : '';
  d.innerHTML = (k && k !== v ? nm(k) : '') + `<span class="w">${wn}</span>` + (hs ? '<span class="hs">◎</span>' : '') + nm(v);
  if ((k && k.isPlayer) || v.isPlayer) d.className = 'me';
  f.prepend(d); while (f.children.length > 6) f.lastChild.remove();
  setTimeout(() => d.remove(), 7000);
}
function feedText(t) { if (MP.role === 'host') MPH.feedTextEvent(t); const f = $('feed'), d = document.createElement('div'); d.textContent = t; d.style.color = '#edbd72'; f.prepend(d); setTimeout(() => d.remove(), 6000); }
function showHit(cls, killed) {
  const h = $('hitm'); h.className = killed ? 'kill' : cls; h.style.transition = 'none'; h.style.opacity = 1;
  requestAnimationFrame(() => { h.style.transition = 'opacity .35s'; h.style.opacity = 0; });
}
function hurtFx(dmg, att, dir) {
  const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = Math.min(1, 0.35 + dmg / 60);
  padRumble(0.7, 0.9, 180);
  requestAnimationFrame(() => { h.style.transition = 'opacity .7s'; h.style.opacity = 0; });
  if (att && att !== GS.player) {
    const P = GS.player, ang = Math.atan2(-(att.pos.x - P.pos.x), -(att.pos.z - P.pos.z));
    const rel = angDiff(P.yaw, ang);
    const i = document.createElement('i'); i.style.transform = `rotate(${-rel}rad)`; $('dmgDir').appendChild(i);
    setTimeout(() => (i.style.opacity = 0), 600); setTimeout(() => i.remove(), 900);
  }
}
const fmtT = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const hudCache = {};
function setText(id, t) { if (hudCache[id] !== t) { hudCache[id] = t; $(id).textContent = t; } }
function setHTML(id, t) { if (hudCache[id] !== t) { hudCache[id] = t; $(id).innerHTML = t; } }
const radar = $('radar'), rc = radar.getContext('2d');
function updateHUD() {
  updateGuide();
  const P = GS.player, c = GS.core;
  const specA = !P.alive ? specTarget() : null;
  const viewA = specA || P;
  // top bar
  if (GS.mode === 'range') {
    setText('scL', GS.score[0]); setText('scR', ''); setHTML('pipL', ''); setHTML('pipR', '');
    setText('timer', fmtT(GS.roundT)); setText('sideTag', `AIM RANGE · ${GS.rangeHS} headshots`);
  } else {
    const ms = mySq(); setText('scL', GS.score[ms]); setText('scR', GS.score[1 - ms]);
    const pip = (sq) => GS.actors.filter((a) => a.squad === sq).map((a) => `<i class="${a.alive ? '' : 'dead'}"></i>`).join('');
    setHTML('pipL', pip(ms)); setHTML('pipR', pip(1 - ms));
    $('sqL').style.color = SIDE[P.side].css; $('sqR').style.color = SIDE[1 - P.side].css;
    $('sqL').style.borderBottomColor = SIDE[P.side].css; $('sqR').style.borderBottomColor = SIDE[1 - P.side].css;
    let tt = GS.mode === 'dm' ? GS.roundT : GS.state === 'freeze' ? GS.phaseT : c.state === 'planted' ? c.timer : GS.roundT;
    if (GS.state === 'end') tt = GS.phaseT;
    setText('timer', fmtT(tt));
    $('timer').classList.toggle('red', GS.mode === 'comp' && c.state === 'planted');
    setText('sideTag', GS.mode === 'dm' ? `DEATHMATCH · first to ${GS.target}` : `${SIDE[P.side].name} (${SIDE[P.side].role.toUpperCase()}) · ROUND ${GS.round} · FIRST TO ${GS.target}${GS.state === 'freeze' ? ' · BUY TIME (B)' : ''}`);
  }
  // money / buy hint
  setText('money', GS.mode === 'comp' ? `$${P.money}` : '');
  setText('buyHint', P.alive && inBuyZone(P) ? 'Press B to buy' : '');
  setText('coreIcon', c && c.carrier === P ? '◆ YOU HAVE THE BOMB' : '');
  // vitals
  setText('hp', Math.ceil(viewA.hp)); setText('ar', Math.ceil(viewA.armor) + (viewA.helmet ? '+H' : ''));
  $('hpBox').classList.toggle('low', viewA.hp <= 25);
  const w = curW(viewA), def = WD[w.id];
  setText('wname', def.name.toUpperCase() + (def.mag ? ' · ' + fireMode(def) : ''));
  if (def.mag) { setText('mag', w.mag); setText('res', `/ ${w.res > 900 ? '∞' : w.res}`); $('ammo').classList.toggle('low', w.mag <= Math.ceil(def.mag * 0.25)); }
  else if (def.nade) { setText('mag', viewA.nades[w.id]); setText('res', ''); $('ammo').classList.remove('low'); }
  else { setText('mag', '—'); setText('res', ''); $('ammo').classList.remove('low'); }
  const inv = [['1', viewA.prim && WD[viewA.prim.id].name, 'prim'], ['2', viewA.sec && WD[viewA.sec.id].name, 'sec'], ['3', 'Combat Knife', 'knife'],
  ['4', hasNade(viewA) ? ['he', 'flash', 'smoke', 'molly'].filter((n) => viewA.nades[n]).map((n) => WD[n].name + (viewA.nades[n] > 1 ? ' x' + viewA.nades[n] : '')).join(' · ') : '', 'nade'], ['5', viewA.shield ? 'Ballistic Shield' : '', 'shield']];
  setHTML('inv', inv.filter((r) => r[1]).map((r) => `<div class="${(viewA.shieldOn ? 'shield' : viewA.slot) === r[2] ? 'on' : ''}"><b>${r[0]}</b>${r[1]}</div>`).join('') + (viewA.kit ? '<div>Defuse kit</div>' : ''));
  // action bar
  const act = viewA.act;
  $('prog').classList.toggle('hidden', !act);
  if (act) { setText('progLbl', act.type === 'plant' ? 'PLANTING BOMB…' : 'DEFUSING BOMB…'); $('progFill').style.width = (act.t / act.need * 100) + '%'; }
  // spectate
  if (!P.alive && GS.mode === 'comp') setText('spec', specA ? `Spectating ${specA.name} · ${Math.ceil(specA.hp)} HP · click to switch` : 'Waiting for next round…');
  else if (!P.alive && GS.mode === 'dm') setText('spec', `Respawning in ${Math.max(0, P.respawnT).toFixed(1)}…`);
  else setText('spec', '');
  drawRadar(viewA); if (mapOpen) drawBigMap(viewA);
}
// Aiming and full-screen combat effects stay at the display refresh rate.
function updateAimHUD() {
  const P = GS.player, def = curDef(P);
  // crosshair
  const xh = $('xh'); const sp = P.alive ? computeSpread(P, def.mag ? def : WD.p9) : 0;
  // every gun keeps the crosshair (snipers too, until they scope in). Aim style "Tighten crosshair" (default): aiming (right-click / Z / LT) pulls it in tight and small with a centre dot.
  // Aim style "Iron sights": the gun slides to the middle and the crosshair hides (guns without iron sights just tighten it)
  const iron = ironSights(P), aim = iron ? 0 : VMS.ads;
  const gap = (S.xhGap + (def.mag && !def.pellets ? Math.min(40, sp * 4) : def.pellets ? 18 : 0)) * (1 - 0.6 * aim), L = Math.max(2, S.xhSize * (1 - 0.45 * aim));
  const hideX = !P.alive || (P.scoped && def.scope) || (iron && P.ads && VMS.ads > 0.7);
  xh.style.display = hideX ? 'none' : '';
  xh.style.setProperty('--xc', S.xhColor);
  const ch = xh.children;
  const dot = S.xhDot === '1' || aim > 0.5;
  const key = `${Math.round(gap * 2)}|${Math.round(L * 2)}|${dot}`;
  if (xh._k !== key) {
    xh._k = key;
    const set = (el, x, y, w2, h2) => { el.style.cssText = `left:${x}px;top:${y}px;width:${w2}px;height:${h2}px`; };
    set(ch[0], -1, -gap - L, 2, L); set(ch[1], -1, gap, 2, L); set(ch[2], -gap - L, -1, L, 2); set(ch[3], gap, -1, L, 2);
    set(ch[4], -1, -1, 2, 2); ch[4].style.display = dot ? '' : 'none';
  }
  // scope + flash + smoke
  $('scope').classList.toggle('hidden', !(P.alive && P.scoped && def.scope));
  $('flash').style.opacity = P.alive ? Math.min(1, P.blindT / 1.2) : 0;
  let sv = 0; const cp = camera.position;
  for (const s of GS.smokes) { const d = Math.hypot(cp.x - s.x, (cp.y - s.y) * 1.2, cp.z - s.z); if (d < s.r) sv = Math.max(sv, clamp((s.r - d) / 1.2, 0, 1) * clamp(s.t / 2, 0, 1)); }
  $('smokeV').style.opacity = sv * 0.95;
}
function drawRadar(viewA) {
  const P = GS.player, s = 2.3;
  const density=Math.min(3,Math.max(2,devicePixelRatio||1)), pixels=Math.round(200*density);
  if(radar.width!==pixels){radar.width=pixels;radar.height=pixels;}
  rc.setTransform(density,0,0,density,0,0);rc.imageSmoothingEnabled=true;rc.imageSmoothingQuality='high';
  rc.clearRect(0, 0, 200, 200);
  rc.save(); rc.beginPath(); rc.arc(100, 100, 98, 0, 7); rc.clip();
  rc.translate(100, 100); rc.rotate(viewA.yaw); rc.scale(s, s); rc.translate(-viewA.pos.x, -viewA.pos.z);
  rc.globalAlpha = 0.9; rc.drawImage(radarImg, 0, 0, W * CS, H * CS); rc.globalAlpha = 1;
  const dot = (x, z, col, r = 1.6) => { rc.fillStyle = col; rc.beginPath(); rc.arc(x, z, r, 0, 7); rc.fill(); rc.strokeStyle = '#000'; rc.lineWidth = 0.4; rc.stroke(); };
  for (const a of GS.actors) {
    if (!a.alive || a === viewA) continue;
    if (a.side === P.side) dot(a.pos.x, a.pos.z, SIDE[a.side].css);
    else if (GS.time - a.spotT < 0.6 || a.dummy) dot(a.pos.x, a.pos.z, '#ff3b3b');
  }
  for (const s2 of GS.smokes) { rc.fillStyle = 'rgba(220,220,225,.6)'; rc.beginPath(); rc.arc(s2.x, s2.z, s2.r, 0, 7); rc.fill(); }
  for (const m of MARKS) { rc.save();rc.translate(m.x,m.z);rc.rotate(-viewA.yaw);rc.fillStyle='#49b9ff';rc.strokeStyle='#e2f5ff';rc.lineWidth=.6;rc.beginPath();rc.moveTo(0,-3.5);rc.lineTo(3,0);rc.lineTo(0,3.5);rc.lineTo(-3,0);rc.closePath();rc.fill();rc.stroke();rc.restore(); }
  const c = GS.core;
  if (c && GS.mode === 'comp' && (P.side === 0 || c.state === 'planted')) {
    const cp = c.state === 'carried' && c.carrier ? c.carrier.pos : c.pos;
    if (c.state !== 'none' && c.state !== 'boom' && c.state !== 'defused') {
      const blink = c.state === 'carried' || Math.floor(GS.time * 3) % 2 === 0, r = c.state === 'planted' ? 3 : 2.3;
      if (blink) { rc.fillStyle = c.state === 'planted' ? '#ff3b3b' : '#edbd72'; rc.fillRect(cp.x - r, cp.z - r * 0.65, r * 2, r * 1.3); rc.fillStyle = '#220'; rc.fillRect(cp.x - r * 0.5, cp.z - r * 0.25, r, r * 0.5); }
      if (c.state === 'planted') { rc.strokeStyle = 'rgba(255,59,59,' + (0.7 - ((GS.time * 1.5) % 1) * 0.7) + ')'; rc.lineWidth = 0.8; rc.beginPath(); rc.arc(cp.x, cp.z, 3 + ((GS.time * 1.5) % 1) * 9, 0, 7); rc.stroke(); }
    }
  }
  rc.restore();
  rc.fillStyle = '#fff'; rc.beginPath(); rc.moveTo(100, 92); rc.lineTo(106, 106); rc.lineTo(100, 103); rc.lineTo(94, 106); rc.closePath(); rc.fill();
}
function specTarget() {
  const mates = GS.actors.filter((a) => a.alive && a.side === GS.player.side && !a.isPlayer);
  if (!mates.length) return null;
  return mates[((GS.spec % mates.length) + mates.length) % mates.length];
}
canvas.addEventListener('click', () => { if (GS.player && !GS.player.alive) GS.spec++; });

// scoreboard
function updateBoard() {
  if ($('board').classList.contains('hidden')) return;
  const P = GS.player;
  const rows = (sq) => GS.actors.filter((a) => a.squad === sq).sort((a, b) => b.kills - a.kills).map((a) =>
    `<tr class="${a.isPlayer ? 'me' : ''} ${a.alive ? '' : 'dead'}"><td>${a.isPlayer ? 'You' : a.name}${GS.core && GS.core.carrier === a && sq === mySq() ? ' ◆' : ''}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.kills ? Math.round(a.hs / a.kills * 100) : 0}%</td><td>${Math.round(a.dmg)}</td><td>${sq === mySq() && GS.mode === 'comp' ? '$' + a.money : ''}</td></tr>`).join('');
  const head = '<tr><th>NAME</th><th>K</th><th>D</th><th>HS</th><th>DMG</th><th></th></tr>', tight = GS.actors.length > 12 ? ' class="tight"' : '';
  setHTML('boardCard', `<div class="tn" style="color:${SIDE[P.side].css}">YOUR SQUAD · ${SIDE[P.side].name} · ${GS.score[mySq()]}</div><table${tight}>${head}${rows(mySq())}</table>` +
    (GS.mode !== 'range' ? `<div class="tn" style="color:${SIDE[1 - P.side].css}">ENEMY · ${SIDE[1 - P.side].name} · ${GS.score[1 - mySq()]}</div><table${tight}>${head}${rows(1 - mySq())}</table>` : ''));
}

// buy menu
const BUY = [['PISTOLS', ['p9', 'tec', 'trio', 'viper', 'duster', 'revolver']], ['SMG / SHOTGUN', ['buzz', 'brute', 'chopper', 'thumper', 'scatter', 'breaker']], ['RIFLES', ['carbine', 'raptor', 'sentinel', 'ghost', 'lmg']], ['SNIPERS', ['ranger', 'dmr', 'longbow']], ['GEAR', ['kevlar', 'helm', 'kit', 'shield']], ['GRENADES', ['he', 'flash', 'smoke', 'molly']]];
// Original lightweight side profiles. Inline SVG inherits each card's purchase-state color.
function buyIcon(id) {
 const pistol='M35 20H111V29H72L65 35H55L50 53H32L39 32H31V24Z';
 const rifle='M12 27L37 21H56V18H104V22H130V25H151V30H103L96 35H77L83 51H69L60 36H49L42 49H31L34 33L12 39Z';
 const shapes={
 p9:pistol, trio:pistol+' M88 17H101V20H88Z', viper:'M28 17H119V30H71L61 37L54 55H32L40 31H28Z', tec:'M45 19H98V25H120V30H82V51H70V32H61L56 51H41L47 29Z',
 revolver:'M25 23H59V18H78V21H124V28H79L72 35H57L51 53H31L39 32H25Z',duster:'M30 25H131V31H62L50 43H27L38 32Z',
 buzz:'M17 28L40 20H105V24H130V30H84V51H71V32H56L49 47H38L41 32H17Z',brute:rifle,chopper:rifle,
 thumper:'M12 30L42 22H89V24H148V29H93V35H56L39 45H14Z',scatter:'M12 29L37 22H145V28H100V34H72L65 49H52L54 33L15 42Z',breaker:rifle+' M110 31H143V36H110Z',
 carbine:rifle,raptor:rifle+' M81 34L88 48L98 53L92 57L81 54L74 36Z',sentinel:rifle+' M63 13H98V17H63Z',ghost:rifle+' M139 22H160V32H139Z',lmg:rifle+' M75 33H99V53H75Z M126 30L119 53H123L130 34L137 53H141L134 30Z',
 ranger:'M10 29L39 23H117V25H157V28H111V33H64L46 41H12Z M65 15H103V21H65Z M73 20H77V24H73Z M93 20H97V24H93Z',
 dmr:rifle+' M63 13H105V19H63Z M70 18H75V22H70Z M94 18H99V22H94Z',
 longbow:'M8 29L34 22H112V24H158V29H111V34H88V43H73V34H57L50 48H39L42 34L8 43Z M61 11H108V19H61Z M70 18H75V23H70Z M96 18H101V23H96Z',
 kevlar:'M62 12L72 8L77 18H89L94 8L104 12L100 28L110 36V55H56V36L66 28Z',helm:'M56 36C56 4 110 4 110 36L116 41H83L77 49H63V41H53Z',kit:'M62 20H103V51H62Z M72 13H93V20H87V18H78V20H72Z',shield:'M59 10H107V42L83 57L59 42Z',
 he:'M73 12H90V21C111 32 101 55 82 55C63 55 55 32 73 21Z M90 12H104V16H90Z',
 flash:'M73 18H94V53H73Z M78 9H90V18H78Z M91 10H104V14H91Z',smoke:'M70 20H98V54H70Z M74 12H94V20H74Z M91 10H104V14H91Z',
 molly:'M78 8H89V25L99 34V55H68V34L78 25Z M82 8L95 3L109 10L102 13L94 8L87 13Z'
 };
 return '<svg class="buy-icon" viewBox="0 0 168 64" aria-hidden="true" focusable="false"><path d="'+(shapes[id]||rifle)+'"/>'+(id==='chopper'?'<circle cx="78" cy="46" r="12"/>':'')+'</svg>';
}

$('buyStats').onclick = () => {
  const visible = $('buyGrid').classList.toggle('show-stats');
  $('buyStats').setAttribute('aria-pressed', String(visible));
};
function renderBuy() {
  const P = GS.player;
  $('buyMoney').textContent = GS.mode === 'comp' ? `$${P.money}` : 'FREE';
  const last = P.buyLog && P.buyLog[P.buyLog.length - 1], un = $('buyUndo');   // (an online guest does not keep the list: the host does, so the button just asks the host)
  un.textContent = last ? 'UNDO · ' + ((WD[last.id] || GEAR[last.id] || {}).name || '') : 'UNDO'; un.disabled = GS.mode !== 'comp' || (MP.role === 'client' ? !inBuyZone(P) : !last);
  $('buyTime').textContent = GS.mode === 'comp' ? (GS.state === 'freeze' ? `buy time ${Math.ceil(GS.phaseT + 20)}s` : `buy time ${Math.max(0, Math.ceil(GS.buyLeft))}s`) : '';
  $('buyGrid').innerHTML = BUY.map(([cat, ids]) => `<div class="cat"><h3>${cat}</h3>${ids.filter(gunOK).map((id) => {
    const d = WD[id] || GEAR[id];
    const own = (WD[id] && !d.nade && P[d.slot] && P[d.slot].id === id) || (id === 'kit' && P.kit) || (id === 'shield' && P.shield) || (id === 'helm' && P.helmet) || (id === 'kevlar' && P.armor >= 100);
    const bar = (l, v) => `<span>${l}</span><i style="width:${Math.max(6, Math.min(100, v))}%"></i>`;
    const bars = WD[id] && d.dmg ? `<div class="bars">${bar('Damage', d.dmg * (d.pellets || 1) / 1.6)}${bar('Fire rate', d.rpm / 9)}${bar('Control', 100 - d.recoil * 14)}${bar('Range', (d.range - 0.5) / 0.5 * 100)}${bar('Mobility', (d.speed - 4.6) / 2.4 * 100)}</div>` : '';
    const mode = WD[id] && d.mag ? `<b class="mode">${fireMode(d)}</b> ` : '';
    return `<button class="item ${own ? 'own' : ''}" data-id="${id}" ${canBuy(P, id) ? '' : 'disabled'}><span class="p">${GS.mode === 'comp' ? '$' + priceOf(P, id) : 'FREE'}</span>${buyIcon(id)}<div class="n">${d.name}</div>${own ? '<span class="owned-label">Owned</span>' : ''}<div class="d">${mode}${d.desc || ''}</div>${bars}</button>`;
  }).join('')}</div>`).join('');
}
$('buyGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.item'); if (!b) return;
  if (MP.role === 'client') { if (canBuy(GS.player, b.dataset.id)) { SFX.buy(); MPH.clientBuy(b.dataset.id); } else SFX.deny(); }
  else if (buy(GS.player, b.dataset.id)) SFX.buy(); else SFX.deny();
  renderBuy();
});
function undoClick() {
  const P = GS.player; if (!P) return;
  if (MP.role === 'client') { if (inBuyZone(P)) { SFX.swap(); MPH.clientUndo(); } else SFX.deny(); }
  else if (undoBuy(P)) SFX.swap(); else SFX.deny();
  renderBuy();
}
$('buyUndo').addEventListener('click', undoClick);
function toggleBuy() {
  const el = $('buy'), P = GS.player;
  if (el.classList.contains('hidden')) {
    if (!P || !P.alive || !inBuyZone(P) || GS.state === 'over' || GS.paused) { if (P && P.alive && GS.mode === 'comp') toast(GS.state === 'live' && GS.buyLeft <= 0 ? 'Buy time is over' : 'Go back to your spawn to buy'); return; }
    renderBuy(); el.classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock();
  } else { el.classList.add('hidden'); lock(); setTimeout(() => { if (!locked && !DEBUG && !softLock && GS.state !== 'menu') $('clickLock').classList.remove('hidden'); }, 300); }
}

// ---------------- big map (M) ----------------
// The whole map. Click an open spot to put your marker there (you only get one: a new click moves it): it stays on your map and radar for the round, and your team gets a ping on it (like Z).
// Click the marker to take it away again. The match keeps running while the map is open, like the buy menu.
const mapC = $('mapC'), mc = mapC.getContext('2d');
function mapScale() { return Math.max(0.5, Math.min((innerWidth * 0.9) / (W * CS), (innerHeight * 0.66) / (H * CS))); }
function toggleMap() {
  const el = $('bigMap'), P = GS.player;
  if (el.classList.contains('hidden')) {
    if (!P || GS.state === 'menu' || GS.state === 'over' || GS.mode === 'range' || GS.paused) return;
    if (!$('buy').classList.contains('hidden')) toggleBuy();
    mapOpen = true; el.classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock();
  } else { mapOpen = false; el.classList.add('hidden'); lock(); setTimeout(() => { if (!locked && !DEBUG && !softLock && GS.state !== 'menu') $('clickLock').classList.remove('hidden'); }, 300); }
}
function drawBigMap(viewA) {
  const P = GS.player, k = mapScale(), w = Math.round(W * CS * k), h = Math.round(H * CS * k);
  const density=Math.min(3,Math.max(2,devicePixelRatio||1)), pw=Math.round(w*density),ph=Math.round(h*density);
  if(mapC.width!==pw||mapC.height!==ph){mapC.width=pw;mapC.height=ph;mapC.style.width=w+'px';mapC.style.height=h+'px';}
  mc.setTransform(density,0,0,density,0,0);mc.imageSmoothingEnabled=true;mc.imageSmoothingQuality='high';
  mc.clearRect(0, 0, w, h); mc.fillStyle = 'rgba(10,14,20,.92)'; mc.fillRect(0, 0, w, h);
  mc.globalAlpha = 0.95; mc.drawImage(radarImg, 0, 0, w, h); mc.globalAlpha = 1;
  const dot = (x, z, col, r) => { mc.fillStyle = col; mc.beginPath(); mc.arc(x * k, z * k, r, 0, 7); mc.fill(); mc.strokeStyle = '#000'; mc.lineWidth = 1.5; mc.stroke(); };
  for (const s2 of GS.smokes) { mc.fillStyle = 'rgba(220,220,225,.55)'; mc.beginPath(); mc.arc(s2.x * k, s2.z * k, s2.r * k, 0, 7); mc.fill(); }
  mc.font = 'bold 12px Arial'; mc.textAlign = 'center';
  for (const a of GS.actors) {
    if (!a.alive || a === P) continue;
    if (a.side === P.side) { dot(a.pos.x, a.pos.z, SIDE[a.side].css, 6); mc.fillStyle = '#fff'; mc.fillText(a.name, a.pos.x * k, a.pos.z * k - 10); }
    else if (GS.time - a.spotT < 0.6 || a.dummy) dot(a.pos.x, a.pos.z, '#ff3b3b', 6);
  }
  const c = GS.core;
  if (c && GS.mode === 'comp' && (P.side === 0 || c.state === 'planted') && c.state !== 'none' && c.state !== 'boom' && c.state !== 'defused') {
    const cp = c.state === 'carried' && c.carrier ? c.carrier.pos : c.pos, bx = cp.x * k, bz = cp.z * k;
    mc.fillStyle = c.state === 'planted' ? '#ff3b3b' : '#edbd72'; mc.fillRect(bx - 9, bz - 6, 18, 12); mc.fillStyle = '#220'; mc.fillRect(bx - 4, bz - 2, 8, 4);
  }
  for (const m of MARKS) {   // blue diamond waypoints with distance
    const mx = m.x * k, mz = m.z * k;
    mc.fillStyle = '#49b9ff'; mc.strokeStyle = '#e2f5ff'; mc.lineWidth = 2; mc.beginPath(); mc.moveTo(mx, mz-12); mc.lineTo(mx+9,mz); mc.lineTo(mx,mz+12); mc.lineTo(mx-9,mz); mc.closePath(); mc.fill(); mc.stroke();
    mc.fillStyle = '#fff'; mc.fillText(Math.round(Math.hypot(m.x - P.pos.x, m.z - P.pos.z)) + 'm', mx, mz + 14);
  }
  const px = P.pos.x * k, pz = P.pos.z * k, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);   // you: a white arrow
  mc.fillStyle = '#fff'; mc.strokeStyle = '#000'; mc.lineWidth = 2; mc.beginPath();
  mc.moveTo(px + fx * 11, pz + fz * 11); mc.lineTo(px - fx * 7 - fz * 7, pz - fz * 7 + fx * 7); mc.lineTo(px - fx * 3, pz - fz * 3); mc.lineTo(px - fx * 7 + fz * 7, pz - fz * 7 - fx * 7); mc.closePath(); mc.fill(); mc.stroke();
}
mapC.addEventListener('mousedown', (e) => {
  e.preventDefault(); const P = GS.player; if (!P) return;
  const r = mapC.getBoundingClientRect(), k = mapScale();
  const x = (e.clientX - r.left - 2) / (r.width - 4) * W * CS, z = (e.clientY - r.top - 2) / (r.height - 4) * H * CS;
  const hit = MARKS.findIndex((m) => Math.hypot(m.x - x, m.z - z) * k < 16);
  if (hit >= 0) { MARKS.splice(hit, 1); SFX.ui(); return; }
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
  if (cx < 0 || cz < 0 || cx >= W || cz >= H || G[cz * W + cx] === '#') { toast('Pick an open spot on the map'); return; }
  MARKS.length = 0;   // one marker at a time: a new one replaces the old one
  MARKS.push({ x, z });
  const pos = V().set(x, hPos(x, z) + 1.4, z);
  if (P.alive) { P.pingT = GS.time; addPing(P, pos, 'here'); if (MP.role === 'host') MPH.pingOut(P, pos, 'here'); else if (MP.role === 'client') MPH.clientPing(pos, 'here'); }
});
$('mapClear').onclick = () => { MARKS.length = 0; SFX.ui(); };
$('mapClose').onclick = () => toggleMap();

// ---------------- camera + viewmodel animation ----------------
const _camT = V();
const DBGCAM = { on: false, pos: V(), look: V(), fov: 50 };
const ironSights = (a) => S.aimStyle === 'iron' && !!GM[curW(a).id] && !!GM[curW(a).id].ads;   // this gun can slide to iron sights (and the player picked that aim style)
function updateCamera(dt) {
  const P = GS.player;
  let view = P;
  if (!P.alive) {
    if (GS.mode === 'comp' && GS.time - GS.deathT > 2.2) view = specTarget() || null;
    else view = null;
  }
  for (const a of GS.actors) if (a.mesh) a.mesh.g.visible = a.alive && a !== view && !a.isPlayer;
  if (view) {
    const def = curDef(view);
    let rp = 0, ry = 0;
    if (view === P && def.pat) { const r = recoilAt(def, P.rc); rp = r[0] * DEG * 0.55; ry = r[1] * DEG * 0.55; }
    camera.position.set(view.pos.x, eyeY(view), view.pos.z);
    camera.rotation.set(view.pitch + rp, view.yaw + ry, 0);
    const zf = view.scoped && def.scope ? (view.scoped === 1 ? 40 : 15) : view.ads ? S.fov / ((GM[curW(view).id] && GM[curW(view).id].ads || [0, 1.2])[1]) : S.fov;
    camera.fov += (zf - camera.fov) * Math.min(1, dt * 20);
  } else {
    // death cam: float above and look at killer
    const k = GS.killer && GS.killer.alive ? GS.killer.pos : P.pos;
    _camT.set(P.pos.x, P.pos.y + 3.2, P.pos.z);
    camera.position.lerp(_camT, Math.min(1, dt * 3));
    camera.lookAt(k.x, k.y + 1.2, k.z);
    camera.fov += (S.fov - camera.fov) * Math.min(1, dt * 8);
  }
  if (GS.shake > 0) { camera.position.x += rand(-1, 1) * GS.shake * 0.15; camera.position.y += rand(-1, 1) * GS.shake * 0.15; GS.shake = Math.max(0, GS.shake - dt * 1.5); }
  if (DEBUG && DBGCAM.on) { camera.position.copy(DBGCAM.pos); camera.lookAt(DBGCAM.look); camera.fov = DBGCAM.fov; }   // ?debug only: a free camera for screenshots
  camera.updateProjectionMatrix();
  setListener(camera.position.x, camera.position.y, camera.position.z, view ? view.yaw : P.yaw);
  // viewmodel
  VMS.sh += ((P.shieldOn && P.shield ? 1 : 0) - VMS.sh) * Math.min(1, dt * 9);   // 0 = lowered out of sight, 1 = held up in front of you
  vmShield.visible = P.alive && shieldUp(P) && VMS.sh > 0.02;
  vmRoot.visible = P.alive && !(P.scoped && curDef(P).scope) && !P.act;
  if (vmShield.visible) {
    const sp0 = Math.hypot(P.vel.x, P.vel.z) * (P.onGround ? 1 : 0.3);
    vmShield.position.set(-0.18 + VMS.swayX * 0.5 + Math.sin(VMS.bob) * 0.008 * Math.min(1, sp0 / 6), -0.13 - (1 - VMS.sh) * 0.6 - Math.abs(Math.cos(VMS.bob)) * 0.01 * Math.min(1, sp0 / 6), -0.5);
  }
  if (!vmCur) return;
  { const lg = GM[curW(P).id]; if (lg && lg.lArm) lg.lArm.visible = !(P.shieldOn && P.shield); }   // one hand holds the shield, so the pistol is held with the other only
  const sp = Math.hypot(P.vel.x, P.vel.z), def = curDef(P);
  VMS.bob += sp * dt * 1.6;
  const bobA = P.onGround ? Math.min(1, sp / 6) : 0;
  VMS.kick = Math.max(0, VMS.kick - dt * 7);
  VMS.swayX *= Math.exp(-dt * 8); VMS.swayY *= Math.exp(-dt * 8);
  VMS.land = Math.max(0, VMS.land - dt * 4); VMS.slash = Math.max(0, VMS.slash - dt * 3.2);
  if (VMS.flashT > 0) { VMS.flashT -= dt; if (VMS.flashT <= 0) vmCur.userData.fl.visible = false; }
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 120);
  const sw = clamp(P.switchT / 0.4, 0, 1);
  const rl = P.reloadT > 0 ? Math.sin(clamp(1 - P.reloadT / (P.reloadMax || def.reload), 0, 1) * Math.PI) : 0;
  let insp = 0; if (VMS.inspect > 0 && P.reloadT <= 0) { VMS.inspect -= dt; insp = 1 - VMS.inspect / 1.6; if (sp > 1 || mouse[0]) VMS.inspect = 0; }
  const knife = def.melee, nade = def.nade, gm = GM[curW(P).id];
  // base pose [x, y, z, yaw, roll, pitch]: pistols angled in toward the crosshair like Krunker, rifles low so you only see barrel + sights
  const POSE = nade ? [0.2, -0.19, -0.38, 0.07, 0, 0] : knife ? [0.12, -0.085, -0.3, 0.2, 0.0, 0.12] : def.slot === 'sec' ? [0.095, -0.12, -0.36, 0.1, 0.04, 0.04] : [0.17, -0.16, -0.42, 0.14, 0, 0.0];
  const bx = POSE[0], by = POSE[1], bz = POSE[2];
  VMS.ads += ((P.ads ? 1 : 0) - VMS.ads) * Math.min(1, dt * 14);
  VMS.spr += ((P.sprint && sp > 3 ? 1 : 0) - VMS.spr) * Math.min(1, dt * 9);
  const A = VMS.ads, Rr = VMS.spr;
  vmRoot.position.set(bx + VMS.swayX + Math.sin(VMS.bob) * 0.012 * bobA + (knife ? 0.04 : 0), by + VMS.swayY - Math.abs(Math.cos(VMS.bob)) * 0.01 * bobA - sw * 0.25 - rl * 0.08 - VMS.land * 0.03 + (P.crouch ? 0.01 : 0), bz + VMS.kick * 0.07);
  vmRoot.rotation.set(POSE[5] + VMS.kick * (def.scope ? 0.25 : 0.1) - rl * 0.6 + (knife || nade ? -VMS.slash * 0.9 : 0), POSE[3] + (insp > 0 ? Math.sin(insp * Math.PI) * 1.1 : 0) + (knife ? VMS.slash * 0.8 : 0), POSE[4] + rl * 0.5 + (insp > 0 ? Math.sin(insp * Math.PI * 2) * 0.35 : 0));
  if (A > 0.001 && ironSights(P)) { // Aim style "Iron sights": slide the gun to the middle of the screen
    vmRoot.position.x += (0 - vmRoot.position.x) * A;
    vmRoot.position.y += (-gm.sy - vmRoot.position.y) * A;
    vmRoot.position.z += (gm.ads[0] + VMS.kick * 0.04 - vmRoot.position.z) * A;
    vmRoot.rotation.y *= 1 - A; vmRoot.rotation.x *= 1 - A * 0.7; vmRoot.rotation.z *= 1 - A;
  }
  if (Rr > 0.001) { vmRoot.position.x += 0.04 * Rr; vmRoot.position.y -= 0.06 * Rr - Math.sin(VMS.bob * 2) * 0.012 * Rr; vmRoot.rotation.y += 0.7 * Rr; vmRoot.rotation.x -= 0.25 * Rr; vmRoot.rotation.z += 0.2 * Rr; }
}

// ---------------- third-person animation ----------------
function animateActors(dt) {
  for (const a of GS.actors) {
    const m = a.mesh; if (!m || !a.alive) continue;
    m.g.position.copy(a.pos); m.g.rotation.y = a.yaw;
    const sp = Math.hypot(a.vel.x, a.vel.z);
    m.phase += sp * dt * 1.9;
    const mv = Math.min(1, sp / 5), sw = Math.sin(m.phase) * 0.55 * mv;
    const th = 0.95 * a.crouchAmt, drop = 0.6 * (1 - Math.cos(th));
    const w = curW(a), sl = WD[w.id].slot;
    const cls = TPC[w.id] || 'rifle', bob = Math.abs(Math.sin(m.phase)) * 0.035 * mv, lean = a.sprint ? -0.09 * mv : 0;
    if (m.lite) { // Lite: straight legs (no knees), crouching just lowers the body
      m.legL.position.y = m.legR.position.y = 0.62 - drop; m.up.position.y = -drop + bob;
      m.legL.scale.y = m.legR.scale.y = (0.62 - drop) / 0.62; // squash the legs so the feet stay on the floor
      m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
      m.arms.rotation.x = a.pitch * 0.8;
    } else {
      m.legL.position.y = m.legR.position.y = 0.62 - drop; m.up.position.y = -drop + bob;
      m.legL.rotation.x = th + sw; m.legR.rotation.x = th - sw;
      m.kneeL.rotation.x = -2 * th - Math.max(0, Math.sin(m.phase + 1.3)) * 0.9 * mv;
      m.kneeR.rotation.x = -2 * th - Math.max(0, Math.sin(m.phase + 1.3 + Math.PI)) * 0.9 * mv;
      m.arms.rotation.x = a.pitch * 0.8; m.head.rotation.x = a.pitch * 0.5;
    }
    m.up.rotation.x += (lean - m.up.rotation.x) * Math.min(1, dt * 8);
    if (m.armsKey !== cls) { m.armsKey = cls; m.armsMesh.geometry = tpArms(a.side, cls, m.lite); m.flash.position.set(...TP_MUZ[cls]); }
    if (m.flashT > 0) { m.flashT -= dt; if (m.flashT <= 0) m.flash.visible = false; }
    if (a.protT > 0) m.up.visible = Math.floor(GS.time * 12) % 2 === 0; else m.up.visible = true;
    if (m.sh) m.sh.visible = shieldUp(a);
  }
  for (const d of GS.drops) { d.t += dt; d.g.rotation.y += dt * 0.8; }
}

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
let nextMenuDraw = 0, nextPauseDraw = 0, nextHUD = 0, nextBoard = 0;
function clientStep(dt) {
  if (GS.state === 'freeze') { const b = Math.ceil(GS.phaseT); GS.phaseT -= dt; if (Math.ceil(GS.phaseT) !== b && b <= 3 && b > 0) SFX.countdown(false); }
  else if (GS.state === 'live') { GS.buyLeft -= dt; if (GS.core.state !== 'planted') GS.roundT -= dt; }
  else if (GS.state === 'end') GS.phaseT -= dt;
  const c = GS.core; if (c.state === 'planted' && GS.state !== 'over') { c.timer -= dt; bombBeep(c, dt); }
  if (GS.state === 'over') return;
  for (const a of GS.actors) if (a.alive) updateActorTimers(a, dt);
  updatePlayer(dt);
  MPH.mirrorTick(dt);
  const P = GS.player;
  if (P.alive && Math.floor(GS.time * 10) !== Math.floor((GS.time - dt) * 10)) for (const e of GS.actors) if (e.alive && e.side !== P.side && canSee(P, e, 0.9)) e.spotT = GS.time;
  updateNades(dt); updateSmokes(dt); updateFires(dt); updateCore(dt);
  MPH.clientTick(dt);
}
function step(dt) {
  GS.time += dt;
  if (MP.role === 'client') { clientStep(dt); return; }
  updateRound(dt);
  if (GS.state === 'over') return;
  for (const a of GS.actors) if (a.alive) updateActorTimers(a, dt);
  updatePlayer(dt);
  for (const a of GS.actors) if (a.alive && a.brain) botUpdate(a, dt);
  for (const a of GS.actors) if (a.alive && a.dummy) botUpdate(a, dt);
  // spotting by the player (for radar)
  const P = GS.player;
  if (P.alive && Math.floor(GS.time * 10) !== Math.floor((GS.time - dt) * 10)) for (const e of GS.actors) if (e.alive && e.side !== P.side && canSee(P, e, 0.9)) e.spotT = GS.time;
  updateNades(dt); updateSmokes(dt); updateFires(dt); updateCore(dt);
  if (MP.role === 'host') MPH.hostTick(dt);
}
renderer.shadowMap.needsUpdate = true;
// One step of the picture-quality ladder (RUNGS above). Nothing here resizes the real canvas or recompiles a shader, so a change is not noticeable.
function applyRung(i) {
  QC.rung = i = Math.max(0, Math.min(RUNGS.length - 1, i)); const r = RUNGS[i];
  const sh = !!r.sh && !LOW;
  if (sh !== QL.shadows) { QL.shadows = sh; sun.castShadow = sh; if (sh) renderer.shadowMap.needsUpdate = true; }
  blitMat.uniforms.fxaa.value = r.fx ? 1 : 0;
  QC.menu = false; setRT(r.s);
  try { localStorage.setItem('cs.q', JSON.stringify({ g: GPU_NAME, l: S.gfx, r: i })); } catch (err) { }   // next time start where this computer ended up
}
function startQuality() {
  let r = QC.rung;
  try { const q = JSON.parse(localStorage.getItem('cs.q') || 'null'); if (q && q.g === GPU_NAME && q.l === S.gfx && q.r >= 0 && q.r < RUNGS.length) r = q.r; } catch (err) { }
  applyRung(r);
}
// Called every frame while playing: two slow seconds in a row = one step down (one slow second if it is really slow); 12 smooth seconds = try one step up (a step that failed once is never tried again).
function qualityTick(rawDt) {
  QC.t += rawDt; QC.n++; QC.since += rawDt;
  if (QC.t < 1) return;
  const fps = QC.n / QC.t; QC.t = 0; QC.n = 0;
  if (QC.cool > 0) { QC.cool--; return; }
  const slow = fps < 55, gpuMs = GPUQ ? GPUQ.ema : -1;
  QC.slow = slow ? QC.slow + 1 : 0;
  QC.smooth = fps >= 57 ? QC.smooth + 1 : 0;
  if (QC.slow >= (fps < 30 ? 1 : 2)) {
    QC.slow = 0;
    if (gpuMs >= 0 && gpuMs < 5) return;   // the graphics chip is not what is slow (the processor is): a smaller picture would not help
    if (QC.rung >= RUNGS.length - 1) return;
    if (QC.climbed === QC.rung) QC.failed.add(QC.rung);   // we had just climbed to this step and it did not hold
    applyRung(QC.rung + (fps < 22 ? 2 : 1)); QC.cool = 3; QC.since = 0; QC.smooth = 0;
  } else if (QC.smooth >= 12 && QC.since > 15 && QC.rung > 0 && !QC.failed.has(QC.rung - 1) && (gpuMs < 0 || gpuMs < 9)) {
    QC.climbed = QC.rung - 1; applyRung(QC.rung - 1); QC.cool = 3; QC.since = 0; QC.smooth = 0;
  } else if (QC.climbed >= 0 && QC.since > 30) QC.climbed = -1;   // it held for 30 s: that step is fine
}
// Compile every shader once, behind the loading screen, for both shadow settings: switching shadows later then never stalls the game.
function prewarmShaders() {
  try {
    const was = sun.castShadow;
    renderer.setRenderTarget(rt);
    if (!LOW) for (const on of [!was, was]) { sun.castShadow = on; renderer.compile(scene, camera); } else renderer.compile(scene, camera);
    renderer.compile(vmScene, vmCam);
    renderer.setRenderTarget(null);
    renderer.compile(blitScene, blitCam);
    sun.castShadow = was;
  } catch (err) { renderer.setRenderTarget(null); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000; last = now;
  const dt = Math.min(0.05, rawDt);
  platform.setPlaying(platformPlaying());
  // Preserve the online host simulation; only solo matches stop while hidden.
  if (document.hidden && !MP.on) return;
  tickSkins();
  fpsAcc += rawDt; fpsN++;
  if (fpsAcc > 0.5) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  if (GS.state === 'menu') {
    const finish = equipped();
    const animated = finish.fx && (finish.fx.shine || finish.fx.spark);
    if (QC.menu && !lobbyDirty && !animated) return;
    if (QC.menu && !lobbyDirty && now < nextMenuDraw) return;
    lobbyDirty = false;

    nextMenuDraw = now + 180;
    if (!QC.menu) { QC.menu = true; if (!LITE) { renderer.setPixelRatio(Math.min(devicePixelRatio, WEAK_GPU ? 1.25 : 1.5)); renderer.setSize(innerWidth, innerHeight, false); } setRT(1); renderer.shadowMap.needsUpdate = QL.shadows; }   // sharp on high-resolution screens   // nearly the full picture: my soldier is on this screen now
    if (MAP.id !== 'sandstone') { setMap('sandstone'); menuSoldierSync(); }   // the menu backdrop is always Sandstone
    menuScene(now / 1000);
    drawFrame(false);
    return;
  }
  if (lobbyDoor) lobbyDoor.visible = false;
  if (QC.menu) { renderer.setPixelRatio(Math.min(devicePixelRatio, 1)); renderer.setSize(innerWidth, innerHeight, false); sun.color.setHex(0xfff6ea); sun.intensity = 1.45; scene.fog.color.setHex(MAP.theme.fog); applyRung(QC.rung); }   // back from the menu: the full picture again
  if (GS.paused && !MP.on) { if (now < nextPauseDraw) return; nextPauseDraw = now + 1000 / 20 - 1; }   // behind the pause screen 20 pictures a second are plenty
  if (camera.near !== 0.05 || scene.fog.near < 20) { camera.near = 0.05; camera.far = LITE ? 125 : 700; scene.fog.near = LITE ? 22 : 28; scene.fog.far = LITE ? 105 : 175; camera.updateProjectionMatrix(); }   // back to the in-game view after the menu
  if ((!GS.paused || MP.on) && GS.state !== 'over') {
    const n = dt > 0.025 ? 2 : 1;
    for (let i = 0; i < n; i++) step(dt / n);
    // SPEED MODE: you are out of a solo round, so skip ahead (a few extra steps every frame, as many as fit in about 9 ms) until the round is over
    if (speedUp()) { const t0 = performance.now(); let k = 0; while (k < 16 && performance.now() - t0 < 9 && speedUp()) { step(Math.min(dt, 0.033)); k++; } }
  }
  const ffNow = speedUp();
  updateSpeedPrompt(ffNow);
  if (ffNow !== ffOn) { ffOn = ffNow; setFastForward(ffNow); }
  updateParts(dt); updateBooms(dt);
  for (const t of tracers) if (t.t > 0) { t.t -= dt; if (t.t <= 0) t.m.visible = false; }
  animateActors(dt);
  updateCamera(dt); updatePings(dt);
  updateAimHUD();
  if (now >= nextHUD) { updateHUD(); nextHUD = now + 49; }
  if (now >= nextBoard) { updateBoard(); nextBoard = now + 99; }
  if (!$('buy').classList.contains('hidden') && Math.random() < 0.1) $('buyTime').textContent = GS.mode === 'comp' ? `buy time ${Math.max(0, Math.ceil((GS.state === 'freeze' ? GS.phaseT : 0) + GS.buyLeft))}s` : '';
  if (!$('buy').classList.contains('hidden') && !inBuyZone(GS.player)) toggleBuy();
  if (QL.shadows && !GS.paused && now >= QL.nextShadow) { renderer.shadowMap.needsUpdate = true; QL.nextShadow = now + (rawDt > .019 ? 125 : 65); }
  if (!GS.paused && !ffNow && rawDt < 0.25 && document.visibilityState === 'visible') qualityTick(rawDt);
  if (WORLD.sky) WORLD.sky.position.copy(camera.position);
  drawFrame((vmRoot.visible || vmBomb.group.visible || vmShield.visible) && GS.player.alive);
}
requestAnimationFrame(frame);

// SPEED MODE: when you have been knocked out of a solo Competitive round, the rest of the round plays at high speed (sound off) until it ends. Space = watch it normally.
let ffOn = false, ffOff = false;
let speedPromptState = '';
function updateSpeedPrompt(active) {
 const eligible = !MP.on && GS.mode === 'comp' && GS.state === 'live' && !GS.paused && GS.player && !GS.player.alive;
 const state = !eligible ? '' : active ? 'fast' : S.speed === 'on' && !ffOff ? 'starting' : 'watch';
 if(state === speedPromptState)return;
 speedPromptState=state; const el=$('ffNote'); el.classList.toggle('hidden',!state);
 if(!state)return;
 const key = padMode ? 'A' : TOUCH ? 'JUMP' : 'SPACE';
 el.innerHTML = state === 'fast' ? '<b>» FAST-FORWARDING THE ROUND</b><span>Get back into the action sooner.</span><small>'+key+' · Watch at normal speed</small>' : state === 'starting' ? '<b>YOU’RE OUT — SKIP THE WAIT</b><span>The rest of this solo round speeds up automatically.</span><small>'+key+' · Stay and watch instead</small>' : '<b>WATCHING YOUR TEAM</b><span>No need to wait out the round.</span><small>'+key+' · Fast-forward to the next round</small>';
}

function speedUp() {
  const P = GS.player;
  return S.speed === 'on' && !ffOff && !MP.on && GS.mode === 'comp' && GS.state === 'live' && !GS.paused && !!P && !P.alive && GS.time - GS.deathT > 1.5;
}

// ---------------- online play helpers ----------------
function startMatchMP(cfg, myIdx, role) {
  MP.on = true; MP.role = role; MP.idx = myIdx; MP.cfg = cfg; MP.nid = 0;
  setMap(cfg.map);
  for (const a of GS.actors) removeSoldier(a);
  GS.actors = []; clearWorld();
  GS.mode = cfg.mode; GS.score = [0, 0]; GS.loss = [0, 0]; GS.round = 0; GS.lastPlan = null;
  GS.target = GS.mode === 'dm' ? lenOf(cfg.length).dm : lenOf(cfg.length).target;
  GS.halfAt = GS.target - 1; GS.maxRounds = 2 * (GS.target - 1);
  const botN = [0, 0];
  cfg.slots.forEach((s, i) => {
    const a = new Actor(String(s.n).slice(0, 12), s.sq, i === myIdx);
    a.idx = i; a.side = s.sq; a.human = !s.bot; a.pid = s.bot ? -1 : (s.pid | 0); a.remote = a.human && i !== myIdx;
    // Clients can render before the host's first loadout arrives. The knife
    // always exists; selecting the initially empty pistol crashes the HUD.
    if (role === 'client') a.slot = 'knife';
    if (s.bot && role === 'host') a.brain = newBrain(a, botN[s.sq]++ % 5);
    GS.actors.push(a);
  });
  GS.player = GS.actors[myIdx];
  for (const a of GS.actors) { makeSoldier(a); a.money = 800; }
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing');
  $('again').classList.add('hidden'); $('toLobby').classList.toggle('hidden', role !== 'host');
  GS.paused = false; resetCore(null); GS.menuMsg = '';
  {   // does this online match count for rank? Competitive only, not set to Unranked by the host, and at least 2 real players (a lone host is just a solo match)
    const humans = cfg.slots.filter((s) => !s.bot), mine = cfg.slots[myIdx];
    GS.rankWhy = cfg.mode !== 'comp' ? '' : cfg.ranked === 'off' ? 'off' : !evenTeams(cfg.t0, cfg.t1) ? 'sizes' : humans.length < 2 ? 'solo' : '';
    GS.rankDone = cfg.mode !== 'comp' || !!GS.rankWhy; GS.rankMates = mine ? humans.filter((s) => s.sq === mine.sq).length - 1 : 0;
  }
  const P = GS.player; P.alive = false; vmRoot.visible = false;
  if (role === 'host') {
    if (GS.mode === 'comp') startRound();
    else { GS.state = 'live'; GS.roundT = lenOf(cfg.length).dmTime; for (const a of GS.actors) dmSpawn(a); banner('DEATHMATCH', `First squad to ${GS.target} eliminations · B = free guns for 10 s after spawn`); }
  } else GS.state = 'freeze';
  lock();
}
function reviveLocal() {
  const P = GS.player; P.buyLog = [];
  P.hp = 100; P.alive = true; P.act = null; P.blindT = 0; P.reloadT = 0; P.switchT = 0; P.rc = 0; P.scoped = 0; P.rescope = 0; P.roundKills = 0; P.crouch = false; P.crouchAmt = 0; P.tagT = 0; P.onGround = true; P.protT = 0;
  if (P.mesh) P.mesh.g.visible = false;
  vmRoot.visible = true; vmRefresh(); sleeveMat.color.setHex(SIDE_SLEEVE[P.side]); GS.deathT = 0; $('scope').classList.add('hidden');
}
function vmRefresh() { vmId = ''; vmSet(); }
function sleeveTint() { sleeveMat.color.setHex(SIDE_SLEEVE[GS.player.side]); }
function hurtLocal(dmg, att, head) {
  const P = GS.player; if (!P || !P.alive) return;
  hurtFx(dmg, att, null);
  if (head && P.helmet) SFX.armorHit(); else SFX.hurt();
  P.pitch += 0.6 * DEG * Math.min(3, dmg / 20);
}
function remoteShotFx(a, wid, o, d) {
  const def = WD[wid]; if (!def) return;
  const oo = Array.isArray(o) ? V().set(+o[0] || 0, +o[1] || 0, +o[2] || 0) : o.clone();
  const dd = Array.isArray(d) ? V().set(+d[0] || 0, +d[1] || 0, +d[2] || 0) : d.clone();
  if (dd.lengthSq() < 0.01) return; dd.normalize();
  const hw = rayWorld(oo, dd, 220), len = hw ? hw.t : 140;
  if (!def.melee) tracer(oo.clone().addScaledVector(dd, 0.8), oo.clone().addScaledVector(dd, len));
  a.lastShot = GS.time;
  if (a.mesh) { a.mesh.flash.visible = true; a.mesh.flashT = 0.05; a.mesh.flash.material.rotation = Math.random() * 6; }
  if (def.melee) SFX.knife(a.pos, false); else if (def.quiet) SFX.suppressed(a.pos, false); else SFX.shot(def.snd, a.pos, false);
  if (MP.role === 'host' && !def.melee) noiseEvent(a.pos, def.quiet ? 22 : 45, a);
}
function netDetonate(id, type, p, owner) {
  for (let i = GS.nades.length - 1; i >= 0; i--) { const n = GS.nades[i]; if (n.id === id) { scene.remove(n.m); n.m.material.dispose(); GS.nades.splice(i, 1); } }
  detonate({ type, x: +p[0] || 0, y: +p[1] || 0, z: +p[2] || 0, owner: owner || GS.player }, true);
}
function netEvent(d) {
  if (d.e === 'boom') { const c = GS.core, p = c.pos.clone().setY(c.pos.y + 0.5); explosionFx(p, true); SFX.boom(p, true); GS.shake = 1.2; bombMesh.visible = false; }
  else if (d.e === 'go') SFX.countdown(true);
  else if (d.e === 'plant') SFX.plant();
  else if (d.e === 'defused') SFX.defused();
}
function botTakeover(a) {
  a.brain = newBrain(a, a.idx % 5); const b = a.brain;
  if (NB && GS.mode === 'comp') { adoptBot(a); return; }
  if (GS.mode === 'comp') {
    b.home = pick(a.side === 1 ? [...SITES.a.holdsDef, ...SITES.b.holdsDef, ...MID_HOLDS] : SITES[GS.plan].holdsAtk); b.homeSite = null;
    b.route = ROUTES[GS.plan][0].slice(); b.plantCell = plantCellFor(GS.plan);
  }
}

// ---------------- pings (Z) ----------------
// Press Z to mark what you are looking at: a spot (cyan), an enemy (red) or the bomb (orange). Your TEAM sees a marker with your name and the distance,
// through walls, for a few seconds (enemies never see it). One ping each; a new one replaces your old one.
const _pgO = new THREE.Vector3(), _pgD = new THREE.Vector3(), _pgC = new THREE.Vector3();
function sendPing(a) {
  if (!a.alive || GS.paused || GS.state === 'over' || GS.state === 'menu' || GS.time - (a.pingT || -9) < PINGS.cd) return;
  const o = eyePos(a, _pgO), d = camera.getWorldDirection(_pgD), hw = rayWorld(o, d, 160), tW = hw ? hw.t : 160;
  let kind = 'here', bestT = tW, pos = null;
  for (const e of GS.actors) if (e.alive && e.side !== a.side) { const h = rayActor(o, d, e, bestT); if (h && h.t < bestT) { bestT = h.t; kind = 'enemy'; pos = chestPos(e, V()).setY(e.pos.y + 1.9); } }
  if (!pos) {
    if (!hw) { if (a.isPlayer) toast('Look at something to ping it'); return; }
    pos = o.clone().addScaledVector(d, Math.max(0.5, tW - 0.15));
    const c = GS.core; if ((c.state === 'dropped' || c.state === 'planted') && pos.distanceTo(c.pos) < 3) { kind = 'bomb'; pos = c.pos.clone().setY(c.pos.y + 0.6); }
  }
  a.pingT = GS.time;
  addPing(a, pos, kind);
  if (MP.role === 'host') MPH.pingOut(a, pos, kind); else if (MP.role === 'client') MPH.clientPing(pos, kind);
}
function addPing(a, p, kind) {
  const me = GS.player; if (!me || !a || (a.side !== me.side && GS.mode !== 'range')) return;   // only your own team sees it
  const old = PINGS.list.findIndex((q) => q.a === a); if (old >= 0) { PINGS.list[old].el.remove(); PINGS.list.splice(old, 1); }
  const el = document.createElement('div'); el.className = 'ping ' + kind;
  el.innerHTML = `<i></i><b>${a === me ? 'YOU' : String(a.name).replace(/[<>&]/g, '')}${kind === 'enemy' ? ' · ENEMY' : kind === 'bomb' ? ' · BOMB' : ''}</b><small></small>`;
  $('pings').appendChild(el);
  PINGS.list.push({ a, p: p.clone ? p.clone() : V().set(p[0], p[1], p[2]), kind, t: 0, el, sm: el.querySelector('small'), dtxt: '' });
  SFX.ping(kind === 'enemy');
}
function clearPings() { for (const q of PINGS.list) q.el.remove(); PINGS.list.length = 0; }
function updatePings(dt) {
  if (!PINGS.list.length) return;
  camera.updateMatrixWorld();
  const W2 = innerWidth, H2 = innerHeight;
  for (let i = PINGS.list.length - 1; i >= 0; i--) {
    const q = PINGS.list[i]; q.t += dt;
    if (q.t > PINGS.life || GS.state === 'menu') { q.el.remove(); PINGS.list.splice(i, 1); continue; }
    const cp = _pgC.copy(q.p).applyMatrix4(camera.matrixWorldInverse), behind = cp.z > 0;
    _pgC.copy(q.p).project(camera);
    let x = behind ? -_pgC.x : _pgC.x, y = behind ? -_pgC.y : _pgC.y;
    let sx = (x * 0.5 + 0.5) * W2, sy = (-y * 0.5 + 0.5) * H2;
    const m = 48, off = behind || sx < m || sx > W2 - m || sy < m || sy > H2 - m;
    if (off) {   // off screen: sit on the edge of the screen, in the direction of the ping
      const cx = W2 / 2, cy = H2 / 2; let dx = sx - cx, dy = sy - cy; if (!dx && !dy) dy = 1;
      const k = Math.min((cx - m) / Math.abs(dx || 1e-6), (cy - m) / Math.abs(dy || 1e-6)); sx = cx + dx * k; sy = cy + dy * k;
    }
    const fade = q.t < 0.15 ? q.t / 0.15 : q.t > PINGS.life - 1 ? PINGS.life - q.t : 1;
    q.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,-50%)`; q.el.style.opacity = (off ? 0.8 : 1) * Math.max(0, fade);
    const dm = Math.round(camera.position.distanceTo(q.p)) + 'm'; if (dm !== q.dtxt) { q.dtxt = dm; q.sm.textContent = dm; }
  }
}

// ---------------- menus ----------------
$('mapSeg').innerHTML = $('onMapSeg').innerHTML = MAP_LIST.map((m) => `<button data-v="${m.id}">${m.name}<small>${m.blurb}</small></button>`).join('');
// team sizes: the Play menu and the online lobby both edit S.tMine / S.tFoe (the lobby calls them the Thugs' and the Ops' size)
const TEAM_PRESETS = [[5, 5], [3, 3], [1, 1], [10, 2], [2, 10], [10, 10]];
function teamBoxHTML(l1, l2) {
  const tz = (k, l) => `<div class="tz"><span>${l}</span><button data-t="${k}" data-d="-1" aria-label="${l} smaller">-</button><b data-v="${k}">5</b><button data-t="${k}" data-d="1" aria-label="${l} bigger">+</button></div>`;
  return `<label>TEAM SIZES <small>(you count as one of your team)</small></label><div class="tzs">${tz('tMine', l1)}${tz('tFoe', l2)}</div>` +
    `<div class="tpre">${TEAM_PRESETS.map(([a, b]) => `<button data-a="${a}" data-b="${b}">${a} v ${b}</button>`).join('')}</div><div class="trk fine"></div>`;
}
$('optTeams').innerHTML = teamBoxHTML('YOUR TEAM', 'ENEMY TEAM'); $('onTeamsOpt').innerHTML = teamBoxHTML('THUGS', 'OPS');
for (const box of [$('optTeams'), $('onTeamsOpt')]) box.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.t) S[b.dataset.t] = teamN(S[b.dataset.t] + +b.dataset.d);
  else if (b.dataset.a) { S.tMine = +b.dataset.a; S.tFoe = +b.dataset.b; }
  else return;
  saveS(); syncSeg(); SFX.ui();
});
function syncSeg() {
  document.querySelectorAll('.seg').forEach((seg) => {
    const k = seg.dataset.k; seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(S[k]) === b.dataset.v));
  });
  const comp = S.mode === 'comp';
  $('optSide').style.display = comp ? '' : 'none'; $('optRank').style.display = comp ? '' : 'none'; $('onRankOpt').style.display = comp ? '' : 'none'; $('optBomb').style.display = $('onBombOpt').style.display = comp ? '' : 'none';
  $('optDiff').style.display = S.mode === 'range' ? 'none' : '';
  $('optLen').style.display = S.mode === 'range' ? 'none' : '';
  $('optSpeed').style.display = comp ? '' : 'none';
  $('optTeams').style.display = S.mode === 'range' ? 'none' : '';
  for (const box of [$('optTeams'), $('onTeamsOpt')]) {
    box.querySelectorAll('[data-v]').forEach((b) => (b.textContent = S[b.dataset.v]));
    box.querySelectorAll('.tpre button').forEach((b) => b.classList.toggle('on', +b.dataset.a === S.tMine && +b.dataset.b === S.tFoe));
    box.querySelectorAll('.tz button').forEach((b) => (b.disabled = S[b.dataset.t] + +b.dataset.d < 1 || S[b.dataset.t] + +b.dataset.d > TEAM_MAX));
  }
  document.querySelectorAll('.trk').forEach((el) => (el.textContent = evenTeams(S.tMine, S.tFoe) ? '' : 'Only 5 v 5 matches count for rank.'));
  const lsm = $('optLen').querySelectorAll('small'), dm = S.mode === 'dm';
  lsm[0].textContent = dm ? 'first to 40' : 'first to 5'; lsm[1].textContent = dm ? 'first to 75' : 'first to 9'; lsm[2].textContent = dm ? 'first to 120' : 'first to 11 · 20 rounds';
  renderRank();
  $('best').textContent = `Record: ${STATS.wins} wins · ${STATS.losses} losses · Aim Range best ${STATS.range}`;
}
document.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  S[seg.dataset.k] = b.dataset.v; if (seg.dataset.k === 'gfx') S.gfxSet = true; saveS(); syncSeg(); initAudio(S.vol); SFX.ui();
  if (seg.dataset.k === 'map') setMap(S.map);
  if (seg.dataset.k === 'gfx' && GS.state === 'menu') { // graphics are chosen when the page loads, so reload now (and drop ?lite / ?pretty from the address)
    const u = new URL(location.href); u.searchParams.delete('lite'); u.searchParams.delete('pretty'); setTimeout(() => location.assign(u.toString()), 200);
  } else if (seg.dataset.k === 'gfx') $('gfxNote').style.display = S.gfx !== GFX_AT_LOAD ? '' : 'none';   // in a match: do not reload now, say when it takes effect
}));
const sliders = [['sSens', 'sens', 'vSens', (v) => v.toFixed(2)], ['sFov', 'fov', 'vFov', (v) => v], ['sVol', 'vol', 'vVol', (v) => Math.round(v * 100) + '%'], ['sXs', 'xhSize', 'vXs', (v) => v], ['sXg', 'xhGap', 'vXg', (v) => v]];
for (const [id, k, vid, f] of sliders) {
  const el = $(id); el.value = S[k]; $(vid).textContent = f(+S[k]);
  el.oninput = () => { S[k] = +el.value; $(vid).textContent = f(S[k]); saveS(); if (k === 'vol') setVolume(S.vol); if (k === 'fov') camera.fov = S.fov; };
}
const XC = ['#4dff7a', '#3df2ff', '#ffe03d', '#ffffff', '#ff5ad1', '#ff4d4d'];
$('sXc').innerHTML = XC.map((c) => `<i style="background:${c}" data-c="${c}" class="${S.xhColor === c ? 'on' : ''}"></i>`).join('');
$('sXc').onclick = (e) => { const c = e.target.dataset.c; if (!c) return; S.xhColor = c; saveS(); [...$('sXc').children].forEach((i) => i.classList.toggle('on', i.dataset.c === c)); };
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('.panel').classList.add('hidden')));
$('openSet').onclick = () => $('setP').classList.remove('hidden');
$('rankBadge').onclick = () => { $('rankList').innerHTML = rankListHTML(); $('rankP').classList.remove('hidden'); };
$('ruGo').onclick = () => { $('rankUp').classList.add('hidden'); $('ruConf').innerHTML = ''; SFX.ui(); };
$('openKeys').onclick = () => $('keysP').classList.remove('hidden');
$('pSet').onclick = () => $('setP').classList.remove('hidden');
$('pKeys').onclick = () => $('keysP').classList.remove('hidden');
$('play').onclick = () => { initAudio(S.vol); startMatch(); };
$('again').onclick = () => { initAudio(S.vol); startMatch(); };
$('resume').onclick = () => { lock(); if (DEBUG || softLock) { GS.paused = false; $('pause').classList.add('hidden'); } };
function toMenu() {
  if (GS.mode === 'comp' && !GS.rankDone && GS.round >= 2 && (GS.state === 'live' || GS.state === 'freeze' || GS.state === 'end')) {   // leaving a ranked match early counts as a loss (also an online one)
    GS.rankDone = true; const r = settleRank('loss', 3, false); GS.menuMsg = `You left a ranked match early: ${r.delta} RP`;
  }
  if (MPH) MPH.leave(); resetToMenu();
}
function resetToMenu() {
  if (S.gfx !== GFX_AT_LOAD) { const u = new URL(location.href); u.searchParams.delete('lite'); u.searchParams.delete('pretty'); location.assign(u.toString()); return; }   // graphics were changed in a match: reload now that it is over
  GS.state = 'menu'; GS.paused = false; finishGuide(); endTraining(); setMusic(true);
  for (const a of GS.actors) removeSoldier(a);
  GS.actors = []; clearWorld(); bombMesh.visible = false; vmBomb.group.visible = false;
  ['hud', 'pause', 'end', 'buy', 'board', 'clickLock', 'bigMap'].forEach((id) => $(id).classList.add('hidden')); mapOpen = false;
  $('scope').classList.add('hidden'); $('flash').style.opacity = 0; $('smokeV').style.opacity = 0;
  $('menu').classList.remove('hidden'); syncSeg(); document.body.classList.remove('playing'); $('again').classList.remove('hidden'); $('toLobby').classList.add('hidden');
  document.exitPointerLock && document.exitPointerLock();
}
$('quit').onclick = toMenu; $('toMenu').onclick = toMenu;
syncSeg();
prewarmShaders();
$('loading').remove();
platform.loaded();
// Keep familiar controls but give the first match a clear, compact path.
const intro = document.createElement('section'); intro.className = 'menu-intro';
const setup = document.createElement('section'); setup.className = 'match-setup';
intro.innerHTML = '<div class="eyebrow">' + GAME_TITLE.toUpperCase() + ' / TOY-SOLDIER SHOOTER</div>';
setup.innerHTML = '<h2 class="setup-heading">MATCH SETUP <span>01 / READY</span></h2>';
const menuBox = $('menuBox');
{ const w = GAME_TITLE.toUpperCase().split(' '), last = w.pop(); menuBox.querySelector('.logo').innerHTML = (w.length ? w.join(' ') + '<br>' : '') + '<span>' + last + '</span>'; }
menuBox.append(intro, setup);
for (const el of [menuBox.querySelector('.logo'), menuBox.querySelector('.tag'), $('launchActions'), $('rankBadge'), $('best'), $('padNote')]) intro.appendChild(el);
for (const id of ['play', 'playOnline', 'openKeys', 'openSet']) $('launchActions').appendChild($(id));
$('play').textContent = 'CUSTOM SOLO MATCH'; $('playOnline').textContent = 'PLAY WITH FRIENDS'; $('openKeys').textContent = 'CONTROLS';
// QUICK PLAY: one click -> a short solo Competitive match vs bots (Thugs/Ops picked at random, simple guns, ranked, hard bots).
const quick = document.createElement('button'); quick.className = 'btn go'; quick.id = 'quickPlay';
quick.innerHTML = '<span><b>QUICK PLAY</b><small>Solo match against bots. Starts right away.</small></span>';
$('launchActions').prepend(quick);
// Simple menu: the match-setup panel stays folded until CUSTOM MATCH is pressed (first press opens it, second press starts).
setup.classList.add('folded');
$('play').textContent = 'CUSTOM MATCH';
$('play').onclick = () => { if (setup.classList.contains('folded')) { setup.classList.remove('folded'); $('play').textContent = 'START CUSTOM MATCH'; return; } initAudio(S.vol); startMatch(); };
if (!TOUCH) { const tr = document.createElement('button'); tr.className = 'btn'; tr.id = 'training'; tr.textContent = 'TRAINING'; tr.onclick = startTraining; $('launchActions').insertBefore(tr, $('openKeys')); }
quick.onclick = () => { Object.assign(S, { mode: 'comp', diff: 'hard', length: 'short', side: 'random', arsenal: 'simple', ranked: 'on', bomb: 'random', speed: 'on', tMine: 5, tFoe: 5 }); { const ids = MAP_LIST.map((m) => m.id); let last = ''; try { last = localStorage.getItem('cs.lastQP') || ''; } catch (e) {} const pool = ids.filter((id) => id !== last); S.map = pick(pool.length ? pool : ids); try { localStorage.setItem('cs.lastQP', S.map); } catch (e) {} }
  syncSeg(); updateBriefing(); initAudio(S.vol); startMatch(); showMapPop(MAP_LIST.find((m) => m.id === S.map).name); };
let mapPop = null;
function showMapPop(name) {
  if (!mapPop) { mapPop = document.createElement('div'); mapPop.id = 'mapPop'; document.body.appendChild(mapPop); }
  mapPop.innerHTML = '<small>QUICK PLAY MAP</small><b></b>'; mapPop.lastChild.textContent = name.toUpperCase(); mapPop.classList.remove('go'); void mapPop.offsetWidth; mapPop.classList.add('go');
}
setup.appendChild(document.querySelector('#menu .seg[data-k="mode"]').closest('.opt'));
const briefing = document.createElement('div'); briefing.className = 'briefing'; briefing.id = 'modeBriefing'; setup.appendChild(briefing);
setup.appendChild($('optDiff'));
const maps = document.createElement('details'); maps.className = 'setup-fold'; maps.innerHTML = '<summary>Location · <b id="mapChoice"></b></summary>'; maps.appendChild($('mapSeg').closest('.opt')); setup.appendChild(maps);
const options = document.createElement('details'); options.className = 'setup-fold'; options.innerHTML = '<summary>Match options · teams, loadout &amp; rules</summary>';
for (const id of ['optSide', 'optRank', 'optBomb', 'optGuns', 'optLen', 'optSpeed', 'optTeams']) options.appendChild($(id)); setup.appendChild(options);
const note = document.createElement('p'); note.className = 'launch-note'; note.textContent = 'Solo matches include bots. No account needed.'; setup.appendChild(note);
menuBox.replaceChildren(intro, setup);
function updateBriefing() {
  const content = S.mode === 'range' ? '<strong>Find your aim.</strong>Hit as many targets as you can in 60 seconds. Try different weapons with B.' : S.mode === 'dm' ? '<strong>Keep moving. Keep scoring.</strong>Eliminate opponents to reach the team score target. Respawn and pick free weapons with B.' : '<strong>One squad. Two bomb sites.</strong>Thugs plant at A or B. Ops defend and defuse. Buy equipment at spawn with B.';
  briefing.innerHTML = content + '<small>' + (TOUCH ? 'Left stick: move · right side: look · FIRE: shoot' : 'WASD: move · mouse: aim · click: fire · E: interact') + '</small>';
  $('mapChoice').textContent = MAP_LIST.find(m => m.id === S.map)?.name || 'Sandstone';
}
document.querySelectorAll('.seg').forEach(el => el.addEventListener('click', updateBriefing)); updateBriefing();
const skinsButton=document.createElement('button');
skinsButton.className='btn';skinsButton.id='openSkins';skinsButton.textContent='SKINS & CRATES';
$('launchActions').appendChild(skinsButton);
const showcaseGun = () => (skinState.showcase && WD[skinState.showcase] && (WD[skinState.showcase].mag || skinState.showcase === 'knife') ? skinState.showcase : 'raptor');
const mutedAccent = (id) => { const ac = new THREE.Color(WD[id].acc || WD[id].col || '#ffb13d'), hsl = {}; ac.getHSL(hsl); ac.setHSL(hsl.h, hsl.s * 0.3, Math.min(hsl.l, 0.3)); return ac.getHex(); };
const MENU_SPOT = { sx: 48.8, sz: 40.25, dx: 0.9239, dz: -0.3827 };   // a Sandstone corner with a brick wall + sky behind (the same spot as the cover art)
let menuActor = null, menuGun = null, menuLights = null, menuDist = 4.9;
function menuSoldierSync() {
  lobbyDirty = true;   // my soldier on the menu: the in-game soldier model, holding my chosen gun with my skin on it
  const side = S.side === 'def' ? 1 : 0, id = showcaseGun(), cls = TPC[id] || 'rifle';

  if (!menuActor || menuActor.side !== side) { if (menuActor) removeSoldier(menuActor); menuActor = new Actor('menu', 0, false); menuActor.side = side; menuActor.alive = true; makeSoldier(menuActor); menuGun = null; }
  if (!menuLights) {   // a warm key light from the front-left and a soft cool rim light from behind, so he stands out from the wall
    menuLights = [new THREE.DirectionalLight(0xffe9cc, 1.25), new THREE.DirectionalLight(0xcfe4ff, 0.9)]; for (const l of menuLights) scene.add(l, l.target);
  }
  if (menuActor.mesh && !menuActor.mesh.g.userData.faceDone && !menuActor.mesh.lite) {   // the face: lighter mask plate, a visor strip and cheek guards instead of one black block
    const mat = new THREE.MeshLambertMaterial({ color: 0x4d525b }), lens = new THREE.MeshLambertMaterial({ color: 0x35546f, emissive: 0x0b1c2c });
    const bit = (w, h, d, x, y, z, mt) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt); q.position.set(x, y, z); menuActor.mesh.head.add(q); };
    bit(0.3, 0.1, 0.03, 0, -0.105, -0.2, mat); bit(0.38, 0.045, 0.03, 0, 0.105, -0.2, lens); bit(0.04, 0.2, 0.03, -0.19, 0, -0.17, mat); bit(0.04, 0.2, 0.03, 0.19, 0, -0.17, mat);
    menuActor.mesh.g.userData.faceDone = true;
  }
  const m = menuActor.mesh; m.armsKey = cls;   if (menuGun) { m.arms.remove(menuGun); menuGun.userData.mesh.geometry.dispose(); }
  const blade = id === 'knife';
  const item = blade ? { knife: skinState.knife || 'combat', finish: equipped() } : { gun: id, finish: equipped() };
  menuGun = displayWeapon(item, mutedAccent(id));
  const { grip, fore } = menuGun.userData;
  const hand = blade ? new THREE.Vector3(.32, -.41, -.19)
    : fore ? new THREE.Vector3(.17, -.19, -.27) : new THREE.Vector3(.23, -.31, -.30);
  menuGun.scale.multiplyScalar(blade ? 1.22 : 1.18);
  menuGun.rotation.order = 'ZXY';
  menuGun.rotation.set(0, blade ? -1.29 : fore ? 1.12 : 1.23, blade ? -.64 : fore ? .34 : .48);
  menuGun.updateMatrix();
  menuGun.position.copy(hand).sub(grip.clone().applyMatrix4(menuGun.matrix));
  menuGun.updateMatrix();
  const previousArms = m.armsMesh.userData.menuPose;
  const support = fore ? fore.clone().applyMatrix4(menuGun.matrix)
    : null;
  const pose = tpMenuArms(side, hand, support);
  m.armsMesh.geometry = pose;
  m.armsMesh.userData.menuPose = pose;
  previousArms?.dispose();
  m.arms.add(menuGun);
  m.armsMesh.userData.origGeo = undefined; outfitSoldier(m.g, null, charMat);   // skins only change the weapon: the soldier's uniform stays the same
}
let lobbyDoor;
function buildLobbyDoor() {
  const {sx, sz, dx, dz} = MENU_SPOT;
  const ground = groundAt(sx, sz);
  const direction = new THREE.Vector3(dx, 0, dz).normalize();
  const origin = new THREE.Vector3(sx - dz * 2.2, ground + 1.8, sz + dx * 2.2);
  WORLD.group.updateMatrixWorld(true);
  const hits = new THREE.Raycaster(origin, direction, 0, 45).intersectObject(WORLD.group, true);
  const hit = hits.find(h => h.face && Math.abs(h.face.normal.clone().transformDirection(h.object.matrixWorld).y) < .1);
  const group = new THREE.Group();
  if (!hit) return group;
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  if (normal.dot(direction) > 0) normal.negate();
  group.position.copy(hit.point).addScaledVector(normal, .035);
  group.position.y = ground;
  group.rotation.y = Math.atan2(normal.x, normal.z);
  // One painted panel. The dark jamb and offset highlights give the inset depth.
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  function rect(x,y,w,h,color) { ctx.fillStyle = color; ctx.fillRect(x,y,w,h); }
  rect(8,8,260,504,'#b3a38a'); rect(18,18,242,494,'#353d40');
  rect(30,32,221,480,'#476878'); rect(36,39,208,466,'#527785');
  for (const y of [65,259]) {
    rect(51,y,179,156,'#375764'); rect(55,y+4,171,149,'#668590');
    rect(58,y+7,165,142,'#507280');
  }
  rect(218,233,14,32,'#30464c'); rect(199,239,28,6,'#aeb6af');
  rect(33,484,214,18,'#445e65');
  ctx.fillStyle = '#f2e9d5'; ctx.globalAlpha = .76;
  ctx.font = 'bold 91px Arial'; ctx.fillText('A',300,218);
  ctx.beginPath(); ctx.moveTo(379,179); ctx.lineTo(427,179); ctx.lineTo(427,163);
  ctx.lineTo(467,190); ctx.lineTo(427,216); ctx.lineTo(427,200); ctx.lineTo(379,200); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i=0;i<210;i++) rect(295+(i*71)%179,145+(i*31)%82,3,1,'#000');
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.8), new THREE.MeshBasicMaterial({map, transparent:true, depthWrite:false, fog:false}));
  panel.position.set(3.4, 1.4, 0); group.add(panel); scene.add(group);
  return group;
}
function menuScene(t) {
  lobbyDoor ??= buildLobbyDoor();
  lobbyDoor.visible = true;
  const a0 = window.__orb ?? 0, fx0 = MENU_SPOT.dx * Math.cos(a0) - MENU_SPOT.dz * Math.sin(a0), fz0 = MENU_SPOT.dx * Math.sin(a0) + MENU_SPOT.dz * Math.cos(a0);
  const sp = { sx: MENU_SPOT.sx, sz: MENU_SPOT.sz, dx: fx0, dz: fz0 }, gy = groundAt(sp.sx, sp.sz), rx = -sp.dz, rz = sp.dx, m = menuActor && menuActor.mesh;   // (the camera can orbit a little round him)
  if (m) {   // idle: breathing, a slow head turn, a tiny sway
    m.up.position.y = 0; m.up.rotation.set(.035, .24, -.025); m.head.rotation.set(-.025, -.24, .025); m.arms.rotation.x = .03;
    m.g.visible = true; m.g.position.set(sp.sx, gy, sp.sz); m.g.rotation.y = Math.atan2(sp.dx, sp.dz);
  }
  const dr = 0, off = -0.05;   // the camera stays still   // a very slow camera drift
  camera.position.set(sp.sx - sp.dx * menuDist + rx * off, gy + 1.15, sp.sz - sp.dz * menuDist + rz * off);
  camera.lookAt(sp.sx + rx * (off + 0.05), gy + 0.9, sp.sz + rz * (off + 0.05));
  if (menuLights) {
    const [key, rim] = menuLights, cx = sp.sx, cz = sp.sz;
    key.visible = rim.visible = true; key.target.position.set(cx, gy + 1, cz); rim.target.position.set(cx, gy + 1, cz);
    key.position.set(cx - sp.dx * 6 - rx * 4, gy + 5, cz - sp.dz * 6 - rz * 4); rim.position.set(cx + sp.dx * 5 + rx * 3, gy + 4, cz + sp.dz * 5 + rz * 3);
  }
  camera.fov = 32; camera.near = 0.05; camera.far = LITE ? 125 : 700; camera.updateProjectionMatrix();
  sun.color.setHex(0xffe5c4); sun.intensity = 1.7; scene.fog.color.setHex(0xd5c5b5);   // golden hour: warm orange light and haze
  scene.fog.near = 5; scene.fog.far = LITE ? 30 : 42;   // a dusty haze: the street behind is soft, the soldier is the sharp thing
  if (WORLD.sky) WORLD.sky.position.copy(camera.position);
}
function stageSync() { menuSoldierSync(); }
const hexOf = (n) => '#' + n.toString(16).padStart(6, '0');
const locker = document.createElement('dialog'); locker.id = 'skinLocker';
locker.innerHTML = `<header><h2>INVENTORY</h2><span class="coinbadge">${COIN}<b class="coin-n">0</b></span><button class="btn" id="closeSkins">Close</button></header>
<nav class="inv-tabs"><button class="on" data-t="inv">MY ITEMS</button><button data-t="crate">SKIN CRATES</button></nav>
<section class="inv-pane" data-p="inv"><div class="inv-left"><h3>Weapon finishes</h3><div class="finish-list"></div><h3>Knives</h3><div class="knife-list"></div></div>
<aside class="inv-side"><canvas id="invStage"></canvas><b id="invName"></b><small id="invRule"></small><button class="btn go" id="invEquip">EQUIP</button><small class="fine">Skins only change how your weapon looks. They never make you stronger.</small></aside></section>
<section class="inv-pane crate-pane hidden" data-p="crate"><div class="crate-stagewrap"><canvas id="crateStage"></canvas><div id="crateResult" class="hidden"></div><div id="crateFlash"></div></div>
<div class="crate-info"><b>SKIN CRATE</b><small>A crate costs ${CRATE_PRICE} ${COIN}. You earn ${COIN} by finishing matches: 60 for a loss, 120 for a win, plus 3 for every elimination. Never real money.</small><button class="btn go" id="openCrate"></button>
<div class="odds"><b>DROP ODDS</b>${Object.values(rarities).map((r) => `<div style="--rc:${hexOf(r.color)}"><i></i><span>${r.name}</span><em>${r.pct}%</em><small>duplicate: +${r.refund} ${COIN}</small></div>`).join('')}</div>
<small class="fine">The white Whiteout skins (Snow White, Frost, Ivory, Ghost, Polar Camo, Pearl) are rarer than the others in their tier. A skin you already own gives coins back instead. Skins and knives are only for looks.</small></div></section>
<small role="status"></small>`;
document.body.appendChild(locker);
const lq = (s) => locker.querySelector(s);
const finishList = lq('.finish-list'), knifeList = lq('.knife-list'), skinStatus = lq('[role=status]');
const invEquip = lq('#invEquip'), crateBtn = lq('#openCrate'), resultEl = lq('#crateResult'), flashEl = lq('#crateFlash');
let pendingReward = false, opening = false, sel = { kind: 'finish', id: skinState.selected };
const previewStage = createPreviewStage(lq('#invStage')), crateStage = createCrateStage(lq('#crateStage'));
function paintKnifeIcon(cx, id) {
  cx.fillStyle = '#2b343c'; cx.fillRect(0, 0, 128, 128);
  const blade = { combat: [[44, 52], [112, 52], [122, 66], [108, 76], [44, 76]], karambit: [[40, 56], [80, 48], [112, 64], [122, 92], [100, 78], [70, 74], [40, 76]], machete: [[40, 50], [118, 48], [124, 58], [116, 80], [40, 76]], dagger: [[44, 56], [84, 52], [124, 64], [84, 76], [44, 72]] }[id];
  cx.fillStyle = '#c5ccd2'; cx.beginPath(); blade.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); cx.fill();
  cx.fillStyle = '#c9a14a'; cx.fillRect(34, 46, 8, 34); cx.fillStyle = '#4a3a2a'; cx.fillRect(6, 53, 28, 20);
}
const itemOf = (it) => (it.kind === 'knife' ? knives.find((k) => k.id === it.id) : finishes.find((f) => f.id === it.id));
const ownedItem = (it) => (it.kind === 'knife' ? knifeOwned(itemOf(it)) : unlocked(itemOf(it)));
const activeItem = (it) => (it.kind === 'knife' ? skinState.knife === it.id : equipped().id === it.id);
function swatch(it) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; cv.setAttribute('aria-hidden', 'true'); const cx = cv.getContext('2d');
  if (it.kind === 'knife') paintKnifeIcon(cx, it.id);
  else drawSkinSwatch(cx, itemOf(it));
  return cv;
}
function drawPreview() {
  const d = itemOf(sel), own = ownedItem(sel), act = activeItem(sel), rar = d.rarity && rarities[d.rarity];
  lq('#invName').textContent = d.name; lq('#invName').style.color = rar ? hexOf(rar.color) : '';
  lq('#invRule').textContent = (rar ? rar.name + ' · ' : '') + (own ? 'You own this.' : d.rule);
  const adOK = sel.kind === 'finish' && platform.canReward;
  invEquip.textContent = act ? 'EQUIPPED' : own ? 'EQUIP' : adOK ? 'WATCH AD TO UNLOCK' : 'LOCKED';
  invEquip.disabled = pendingReward || act || (!own && !adOK);
  if (previewStage) previewStage.setItem(sel.kind === 'knife' ? { knife: sel.id, finish: equipped() } : { gun: showcaseGun(), finish: d }, mutedAccent(showcaseGun()), rar ? rar.color : 0xff8a2a);
}
function card(it) {
  const d = itemOf(it), own = ownedItem(it), act = activeItem(it), rar = d.rarity && rarities[d.rarity];
  const b = document.createElement('button'); b.className = 'inv-card' + (own ? '' : ' locked') + (act ? ' on' : '') + (sel.kind === it.kind && sel.id === it.id ? ' sel' : '');
  if (rar) b.style.setProperty('--rc', hexOf(rar.color));
  const nm = document.createElement('b'), tg = document.createElement('small'); nm.textContent = d.name;
  tg.textContent = act ? 'Equipped' : own ? (rar ? rar.name : 'Owned') : rar ? rar.name + ' · locked' : 'Locked';
  b.append(swatch(it), nm, tg); b.onclick = () => { sel = { kind: it.kind, id: it.id }; drawCollection(); }; return b;
}
function drawCollection() {
  refreshCoins();
  finishList.replaceChildren(...finishes.map((f) => card({ kind: 'finish', id: f.id })));
  knifeList.replaceChildren(...knives.map((k) => card({ kind: 'knife', id: k.id })));
  drawPreview();
  crateBtn.innerHTML = 'OPEN CRATE · ' + CRATE_PRICE + ' ' + COIN; crateBtn.disabled = opening || (skinState.coins | 0) < CRATE_PRICE;
}
invEquip.onclick = async () => {
  if (pendingReward) return;
  if (sel.kind === 'knife') { skinState.knife = sel.id; saveFinish(); setKnifeStyle(sel.id); syncKnifeName(); delete vmModels.knife; delete GM.knife; if (vmId === 'knife') vmId = ''; }
  else {
    const f = itemOf(sel);
    if (!unlocked(f)) {
      pendingReward = true; drawCollection(); const ok = await platform.reward(); pendingReward = false;
      if (!ok) { skinStatus.textContent = 'No reward this time. Try again later.'; drawCollection(); return; }
      skinState.rewarded.push(f.id);
    }
    skinState.selected = f.id; saveFinish();
    for (const [id, model] of Object.entries(GM)) if (WD[id].mag || id === 'knife') applyFinish(model.finishMesh, f, id === 'knife' ? 'knife' : undefined);
  }
  stageSync(); drawCollection(); skinStatus.textContent = itemOf(sel).name + ' equipped.';
};
// ---- crates: coins only (never real money), odds shown, duplicates give coins back ----
const sfxCrate = (ev, n) => {
  if (ev === 'tick') SFX.keypad(null, n);
  else if (ev === 'pop') { SFX.plant(); if (n >= 2) SFX.streak(); flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }
  else if (ev === 'reveal') { SFX.fanfare(true); if (n >= 1) SFX.ping(false); }
};
crateBtn.onclick = () => {
  if (opening || pendingReward) return;
  if ((skinState.coins | 0) < CRATE_PRICE) { skinStatus.textContent = 'Not enough coins. Finish matches to earn more.'; return; }
  initAudio(S.vol);
  const pool = [...finishes.filter((f) => f.rarity).map((f) => ({ f, r: f.rarity, w: f.weight || 1 })), ...knives.filter((k) => k.rarity).map((k) => ({ k, r: k.rarity, w: 1 }))];
  let roll = Math.random() * 100, rar = 'common';
  for (const [id, r] of Object.entries(rarities)) { if (roll < r.pct) { rar = id; break; } roll -= r.pct; }
  const wlist = pool.filter((p) => p.r === rar); let wr = Math.random() * wlist.reduce((a, p) => a + p.w, 0); const prize = wlist.find((p) => (wr -= p.w) < 0) || wlist[0], d = prize.k || prize.f, key = prize.k ? 'knife:' + prize.k.id : prize.f.id;
  const dupe = prize.k ? knifeOwned(prize.k) : unlocked(prize.f), R = rarities[rar];
  addCoins(-CRATE_PRICE); opening = true; crateBtn.disabled = true; resultEl.classList.add('hidden'); skinStatus.textContent = '';
  const done = () => {
    opening = false; let msg;
    if (dupe) { addCoins(R.refund); msg = 'You already own it, so you get ' + R.refund + ' ' + COIN + ' back!'; }
    else { skinState.rewarded.push(key); saveFinish(); msg = 'New item! Find it in MY ITEMS and press Equip.'; }
    resultEl.innerHTML = '<small>' + R.name.toUpperCase() + '</small><b>' + d.name + '</b><span>' + msg + '</span>';
    resultEl.style.setProperty('--rc', hexOf(R.color)); resultEl.classList.remove('hidden'); drawCollection();
  };
  if (crateStage) crateStage.play(prize, R.color, Object.keys(rarities).indexOf(rar), sfxCrate, done); else setTimeout(done, 400);
};
locker.querySelectorAll('.inv-tabs button').forEach((b) => (b.onclick = () => {
  if (opening && b.dataset.t !== 'crate') return;
  if (b.dataset.t === 'crate') { previewStage?.stop(); crateStage?.start(); }
  else { crateStage?.stop(); previewStage?.start(); }
  locker.querySelectorAll('.inv-tabs button').forEach((x) => x.classList.toggle('on', x === b));
  locker.querySelectorAll('.inv-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.p !== b.dataset.t));
  if (b.dataset.t === 'crate' && crateStage && !opening) { crateStage.reset(); resultEl.classList.add('hidden'); }
}));
if (previewStage) {   // drag (mouse or finger) to turn the weapon, wheel / pinch to zoom
  const pc = lq('#invStage'), pts = new Map(); pc.style.touchAction = 'none';
  pc.addEventListener('pointerdown', (e) => { pc.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); previewStage.hold(true); });
  pc.addEventListener('pointermove', (e) => { const p = pts.get(e.pointerId); if (!p) return; if (pts.size === 2) { const [a, b] = [...pts.values()]; const d0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); pts.set(e.pointerId, e); const [c2, d2] = [...pts.values()]; previewStage.zoom(-(Math.hypot(c2.clientX - d2.clientX, c2.clientY - d2.clientY) - d0) * 0.01); } else { previewStage.drag(e.clientX - p.clientX); pts.set(e.pointerId, e); } });
  const up = (e) => { pts.delete(e.pointerId); if (!pts.size) previewStage.hold(false); };
  pc.addEventListener('pointerup', up); pc.addEventListener('pointercancel', up);
  pc.addEventListener('wheel', (e) => { e.preventDefault(); previewStage.zoom(e.deltaY * 0.003); }, { passive: false });
}
function openLocker(tab) { lq('.inv-tabs button[data-t="' + tab + '"]').click(); drawCollection(); skinStatus.textContent = ''; locker.showModal(); }
skinsButton.onclick = () => openLocker('inv');
$('closeSkins').onclick = () => { if (!pendingReward && !opening) locker.close(); };
locker.addEventListener('close', () => { previewStage?.stop(); crateStage?.stop(); });
locker.addEventListener('cancel', (e) => { if (pendingReward || opening) e.preventDefault(); });

// ---- HOME SCREEN: the real Sandstone map is the backdrop, my soldier (the in-game model, with my gun + skin) stands in front of it.
//      One column of buttons on the left, rank + coins small at the top right. (The 3D scene itself is drawn by menuScene() in the main loop.)
{
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
  const home = el('div', 'home'), bar = el('div', 'home-bar'), status = el('div', 'home-status'), col = el('div', 'home-col'), foot = el('div', 'home-foot');
  const coinBadge = el('button', 'coinbadge'); coinBadge.id = 'coinBadge'; coinBadge.innerHTML = COIN + '<b class="coin-n">0</b>'; coinBadge.title = 'Your coins: spend them on skin crates'; coinBadge.onclick = () => openLocker('crate');
  status.append($('rankBadge'), coinBadge);

  // match setup (Play / Maps) lives in a pop-up
  const setupP = el('div', 'panel hidden'); setupP.id = 'setupP';
  const setupCard = el('div', 'card setup-card'); setup.classList.remove('folded'); setupCard.append(setup);
  const srow = el('div', 'row'); srow.style.justifyContent = 'center';
  const startBtn = el('button', 'btn go', 'START MATCH'), closeSetup = el('button', 'btn', 'CLOSE'); srow.append(startBtn, closeSetup); setupCard.append(srow); setupP.append(setupCard); document.body.appendChild(setupP);
  startBtn.onclick = () => { setupP.classList.add('hidden'); initAudio(S.vol); startMatch(); };
  closeSetup.onclick = () => setupP.classList.add('hidden');
  startBtn.addEventListener('click', showFirstGuide);

  // weapons: pick the weapon my soldier holds on the menu (looks only)
  const weaponsP = el('div', 'panel hidden'); weaponsP.id = 'weaponsP';
  const wCard = el('div', 'card'); wCard.style.width = 'min(780px,95vw)';
  wCard.innerHTML = '<h2>WEAPONS</h2><p class="fine" style="margin:6px 0 12px">Pick the weapon your soldier holds on this screen. In a match you buy weapons with B. Skins only change looks, never power.</p><div id="wpnGrid"></div>';
  const wClose = el('button', 'btn', 'CLOSE'); const wRow = el('div', 'row'); wRow.style.justifyContent = 'center'; wRow.append(wClose); wCard.append(wRow); weaponsP.append(wCard); document.body.appendChild(weaponsP);
  const wGrid = wCard.querySelector('#wpnGrid');
  const drawWeapons = () => {
    wGrid.replaceChildren(...Object.keys(WD).filter((id) => id === 'knife' || (WD[id].mag && (WD[id].slot === 'prim' || WD[id].slot === 'sec'))).map((id) => {
      const b = el('button', 'wpn-btn' + (showcaseGun() === id ? ' on' : '')); b.innerHTML = '<b></b><small></small>'; b.firstChild.textContent = WD[id].name; b.lastChild.textContent = (id === 'knife' ? 'Melee' : WD[id].slot === 'prim' ? 'Main gun' : 'Pistol') + (id === 'knife' ? '' : ' · $' + WD[id].price);
      b.onclick = () => { skinState.showcase = id; saveFinish(); stageSync(); drawWeapons(); }; return b;
    }));
  };
  wClose.onclick = () => weaponsP.classList.add('hidden');
  const weaponsBtn = el('button', 'btn', 'WEAPONS'); weaponsBtn.id = 'openWeapons'; weaponsBtn.onclick = () => { drawWeapons(); weaponsP.classList.remove('hidden'); };
  const mapsBtn = el('button', 'btn', 'MAPS'); mapsBtn.id = 'openMaps'; mapsBtn.onclick = () => { maps.open = true; setupP.classList.remove('hidden'); };
  addEventListener('keydown', (e) => { if (e.code === 'Escape') { setupP.classList.add('hidden'); weaponsP.classList.add('hidden'); } });

  // ONE button style for all of these
  $('quickPlay').innerHTML = 'QUICK PLAY';
  $('play').textContent = 'PLAY'; $('play').onclick = () => setupP.classList.remove('hidden');
  skinsButton.textContent = 'SKINS & CRATES'; skinsButton.className = 'btn';
  $('playOnline').textContent = 'FRIENDS'; $('openSet').textContent = 'SETTINGS';
  col.append($('quickPlay'), $('play'), $('playOnline'), skinsButton, weaponsBtn, mapsBtn, $('openSet'));
  bar.append(intro.querySelector('.logo'), col, status);

  const hit = el('button', 'soldier-hit');
  hit.setAttribute('aria-label', 'Customize soldier');
  hit.title = 'Scroll to zoom · Double-click to customize';
  hit.style.touchAction = 'none';
  { const pts = new Map();
    hit.addEventListener('pointerdown', (e) => { hit.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); });
    hit.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const other = [...pts.values()].find(p => p.pointerId !== e.pointerId);
      const previous = pts.get(e.pointerId);
      pts.set(e.pointerId, e);
      if (!other) return;
      const distance = p => Math.hypot(p.clientX - other.clientX, p.clientY - other.clientY);
      menuDist = Math.min(6.5, Math.max(3.4, menuDist - (distance(e) - distance(previous)) * .012));
      lobbyDirty = true;
    });
    const up = e => pts.delete(e.pointerId);
    hit.addEventListener('pointerup', up); hit.addEventListener('pointercancel', up);
    hit.addEventListener('wheel', (e) => { e.preventDefault(); lobbyDirty = true; menuDist = Math.min(6.5, Math.max(3.4, menuDist + e.deltaY * 0.004)); }, { passive: false });
    hit.addEventListener('dblclick', () => openLocker('inv')); }
  const footL = el('div', 'foot-l');
  for (const id of ['training', 'openKeys']) { const b = $(id); if (b) { b.className = 'linkbtn'; footL.append(b); } }
  const footR = el('div', 'foot-r'); footR.append($('best'), $('padNote'));
  foot.append(footL, footR);
  const briefing = el('aside','lobby-brief');
  briefing.append(el('small','','MATCH BRIEF'), el('h2','','Sandstone'), el('p','','Raiders plant the core. Defenders hold the sites.'), col.querySelector('#quickPlay'));
  home.append(bar, briefing, hit, foot); menuBox.replaceChildren(home);
  document.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', () => setTimeout(stageSync, 0)));
  stageSync(); refreshCoins();
}

// The first solo round teaches controls as the player uses them.
const quickGuide = document.createElement('div');
quickGuide.className = 'quick-guide hidden';
document.body.appendChild(quickGuide);
const guideKey = 'cs.fieldGuide2';
let guide = null, guideDone = false;
function finishGuide() {
  if (!guide) return;
  guide = null; guideDone = true; quickGuide.classList.add('hidden');
  try { localStorage.setItem(guideKey, '1'); } catch {}
}
function showFirstGuide() {
  if (GS.state === 'menu' || MP.on || guideDone || !GS.player) return;
  try { if (localStorage.getItem(guideKey)) return; } catch {}
  const p = GS.player;
  guide = {x:p.pos.x,z:p.pos.z,shots:p.shots,step:'',until:0};
  updateGuide();
}
function updateGuide() {
  if (!guide) return;
  const p = GS.player;
  if (!p || !p.alive || GS.state === 'over') { finishGuide(); return; }
  if (GS.paused || uiOpen()) { quickGuide.classList.add('hidden'); return; }
  quickGuide.classList.remove('hidden');
  const objective = GS.mode === 'range' ? 'Hit the practice targets' : GS.mode === 'dm' ? 'Score eliminations for your team' : p.side === 1 ? 'Defend sites A and B' : GS.core.carrier === p ? 'Carry the bomb to A or B' : 'Escort the bomb carrier to A or B';
  let step, control, cue;
  if (GS.state === 'freeze') {step='brief';control='ROUND BRIEF';cue=objective;}
  else if (guide.step === 'objective') { if (GS.time >= guide.until) finishGuide(); return; }
  else if (guide.step !== 'fire' && Math.hypot(p.pos.x-guide.x,p.pos.z-guide.z)<0.8) {step='move';control=padMode?'LEFT STICK':TOUCH?'LEFT STICK':'W A S D';cue='Move out of spawn';}
  else if (p.shots===guide.shots) {step='fire';control=padMode?'RT':TOUCH?'FIRE':'LEFT CLICK';cue='Aim and fire';}
  else {step='objective';control='YOUR OBJECTIVE';cue=objective;guide.until=GS.time+4;}
  if (step===guide.step) return;
  guide.step=step;
  quickGuide.innerHTML='<b>'+control+'</b> '+cue+'<br><u>'+ (TOUCH?'Tap to skip':padMode?'':'H · Skip hints')+'</u>';
}
for (const id of ['play','quickPlay','again']) $(id).addEventListener('click',showFirstGuide);
addEventListener('keydown',e=>{if(e.code==='KeyH') finishGuide();});
quickGuide.addEventListener('pointerdown',finishGuide);

// ---- TRAINING: a short walk-through in the Aim Range. Skip any time with T; no clock. ----
const tut = document.createElement('div'); tut.id = 'tut'; tut.className = 'hidden'; document.body.appendChild(tut);
let tutStep = -1, tutSeen = new Set(), tutLook = 0, tutBase = 0, tutTimer = 0;
const TUT_STEPS = [
  { d: 'Use <b>W A S D</b> to move.', ok: () => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => tutSeen.has(k)) },
  { d: 'Move the <b>mouse</b> to look around and aim.', ok: () => tutLook > 120 },
  { d: '<b>Click</b> to shoot. Hit 3 targets.', ok: () => GS.rangeHits - tutBase >= 3 },
  { d: 'Press <b>R</b> to reload your gun.', ok: () => tutSeen.has('KeyR') },
  { d: 'Press <b>B</b> to open the buy menu. In a match you spend round money on guns and gear. Press B again to close it.', ok: () => tutSeen.has('KeyB') },
  { d: '<b>You are ready!</b> Thugs plant the bomb at site A or B with <b>E</b>, Ops stop them. Press <b>ENTER</b> to start a Quick Play match.', ok: null },
];
function renderTut() {
  if (tutStep < 0) { tut.classList.add('hidden'); return; }
  tut.innerHTML = '<small>TRAINING ' + (tutStep + 1) + ' / ' + TUT_STEPS.length + ' &nbsp;·&nbsp; press T to skip</small>' + TUT_STEPS[tutStep].d;
  tut.classList.remove('hidden');
}
function endTraining() { clearInterval(tutTimer); tutStep = -1; GS.tutorial = false; tut.classList.add('hidden'); }
function startTraining() {
  const m = S.mode; S.mode = 'range'; initAudio(S.vol); startMatch(); S.mode = m;
  GS.tutorial = true; tutStep = 0; tutSeen = new Set(); tutLook = 0; tutBase = 0;
  clearInterval(tutTimer); tutTimer = setInterval(() => {
    const st = TUT_STEPS[tutStep]; if (!GS.tutorial || !st || GS.paused || GS.state !== 'live' || !st.ok || !st.ok()) return;
    SFX.ui(); tutStep++; tutSeen = new Set(); tutLook = 0; tutBase = GS.rangeHits; renderTut();
  }, 200);
  renderTut();
}
addEventListener('keydown', (e) => {
  if (!GS.tutorial) return;
  tutSeen.add(e.code);
  if (e.code === 'KeyT') { endTraining(); quick.click(); }
  else if (e.code === 'Enter' && tutStep === TUT_STEPS.length - 1) { endTraining(); quick.click(); }
});
addEventListener('mousemove', (e) => { if (GS.tutorial) tutLook += Math.abs(e.movementX) + Math.abs(e.movementY); });
// menu music starts with the first click on the page (browsers need a click first)
addEventListener('pointerdown', () => { if (GS.state === 'menu') { initAudio(S.vol); setMusic(true); } });

if (DEBUG) window.__cs = { plantSite, endMatch, RANK, rankInfo, settleRank, rankEndHTML, showRankUp, saveRank, toggleMap, MARKS, shieldUp, buy, damage, undoBuy, gunOK, setNewBots(v) { NB = !!v; }, botTakeover, get NAV() { return NAV; }, DBGCAM, get W() { return W; }, get H() { return H; }, CS, ZONE, MAP_LIST, MP, get MPH() { return MPH; }, renderer, scene, vmScene, vmCam, QC, RUNGS, applyRung, qualityTick, GPUQ, GPU_NAME, WEAK_GPU, drawFrame, blitMat, GS, S, step, startMatch, keys, mouse, pressed, WD, buy, camera, THREE, D, kill, toMenu, throwNade, damage, eyePos, SITES, zoneAt, cellX, cellZ, pad, padStep, padLayer, updateHUD, updateCamera, VMS, ironSights, get padMode() { return padMode; } };

MPH = createOnline({ GS, MP, S, WD, $, rankBadgeHTML, addPing, get worldW() { return W * CS; }, get worldH() { return H * CS; }, MAP_LIST, NAMES, shuffle, pick, angDiff, V3: (x, y, z) => new THREE.Vector3(x, y, z), saveS, syncSeg, initAudio,
  makeSoldier, botTakeover, shotDamage, undoBuy, plantSite, feedText, banner, toast, slotOK, zoneAt, curW, eyePos, chestPos, damage, footsteps, inBuyZone, buy, startMatchMP, resetToMenu, toMenu,
  spawnNade, netDetonate, remoteShotFx, killFx, hurtLocal, roundEndFx, roundBannerLocal, netEvent, endMatch, moneyPop, reviveLocal, vmRefresh, renderBuy, clearWorld, sleeveTint });
