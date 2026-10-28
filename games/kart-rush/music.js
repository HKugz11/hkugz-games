// KART RUSH - music: a tiny synth band (bass, arpeggio, drums) that plays through the game's own audio graph. Every track has its own style. Nothing is downloaded.
import { audio, S2, save, rng, rnd } from './core.js?v=3';

const STYLES = {
  menu:   { bpm: 104, root: 55.0, scale: [0, 2, 4, 7, 9, 11, 14], prog: [0, 5, 7, 5], seed: 3, arp: 'sine', kick: 'half', hat: 'soft' },
  sunny:  { bpm: 132, root: 65.4, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 7, 4], seed: 11, arp: 'triangle', kick: 'four', hat: 'off' },
  neon:   { bpm: 126, root: 55.0, scale: [0, 3, 5, 7, 10, 12, 15], prog: [0, 0, 8, 10], seed: 23, arp: 'square', kick: 'four', hat: 'sixteen' },
  frost:  { bpm: 116, root: 61.7, scale: [0, 2, 3, 7, 9, 12, 14], prog: [0, 3, 5, 7], seed: 37, arp: 'sine', kick: 'half', hat: 'soft' },
  canyon: { bpm: 140, root: 58.3, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 1, 0, 7], seed: 51, arp: 'sawtooth', kick: 'four', hat: 'off' },
  lava:   { bpm: 150, root: 49.0, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3], seed: 67, arp: 'sawtooth', kick: 'drive', hat: 'sixteen' },
  cosmic: { bpm: 134, root: 65.4, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 7, 5, 3], seed: 83, arp: 'triangle', kick: 'four', hat: 'sixteen' },
};
let st = null, step = 0, nextT = 0, timer = 0, mg = null, nz = null, cur = '';
const vol = () => S2.music * .26;
export function setMusicVol(v) { S2.music = v; save('music', v); const { AC } = audio(); if (mg && AC) mg.gain.setTargetAtTime(vol(), AC.currentTime, .1); }
export function startMusic(id) {
  const { AC, master } = audio(); if (!AC || !master) return; if (cur === id && timer) return; stopMusic(true); cur = id; st = STYLES[id] || STYLES.menu;
  if (!nz) { nz = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = nz.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  mg = AC.createGain(); mg.gain.value = 0; mg.connect(master); mg.gain.linearRampToValueAtTime(vol(), AC.currentTime + 1.2);
  st.pats = []; for (let b = 0; b < 4; b++) { const R = rng(st.seed * 7 + b * 13), p = []; for (let i = 0; i < 16; i++) p.push(i % 2 === 0 || R() < .3 ? [0, 2, 4, 2, 5, 4, 2, 0, 6, 4, 2, 4][((i >> 1) + Math.floor(R() * 3) + b) % 12] : -1); st.pats.push(p); }
  step = 0; nextT = AC.currentTime + .15; timer = setInterval(tick, 90);
}
export function stopMusic(quick) {
  clearInterval(timer); timer = 0; cur = ''; const { AC } = audio(); if (!mg || !AC) { mg = null; return; } const g = mg; mg = null;
  g.gain.cancelScheduledValues(AC.currentTime); g.gain.setValueAtTime(g.gain.value, AC.currentTime); g.gain.linearRampToValueAtTime(0, AC.currentTime + (quick ? .15 : .8)); setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 1000);
}
function tick() { const { AC } = audio(); if (!AC || !st || !mg) return; while (nextT < AC.currentTime + .45) { play(step, nextT); nextT += 60 / st.bpm / 4; step = (step + 1) % 64; } }
function osc(t, f, dur, type, v, lp) {
  const { AC } = audio(), o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  let out = o; if (lp) { const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); out = fl; } out.connect(g); g.connect(mg); o.start(t); o.stop(t + dur + .03);
}
function noise(t, dur, v, hp, bp) {
  const { AC } = audio(), s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = nz; fl.type = bp ? 'bandpass' : 'highpass'; fl.frequency.value = bp || hp || 6000; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl); fl.connect(g); g.connect(mg); s.start(t, Math.random() * .5, dur + .02);
}
function kick(t) { const { AC } = audio(), o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .22); o.connect(g); g.connect(mg); o.start(t); o.stop(t + .25); }
const hz = (root, semi) => root * Math.pow(2, semi / 12);
function play(n, t) {
  const bar = n >> 4, i = n & 15, chord = st.prog[bar], root = hz(st.root, chord);
  // drums
  const k = st.kick; if ((k === 'four' && i % 4 === 0) || (k === 'half' && (i === 0 || i === 8)) || (k === 'drive' && (i % 4 === 0 || i === 10))) kick(t);
  if (i === 4 || i === 12) noise(t, .13, .3, 0, 1900);
  if (st.hat === 'sixteen' ? true : st.hat === 'soft' ? i % 4 === 2 : i % 8 === 4) noise(t, i % 4 === 2 ? .09 : .04, i % 4 === 2 ? .16 : .07, 7500);
  // bass
  if (i % 4 === 0 || i === 10 || (st.kick === 'drive' && i % 2 === 0)) osc(t, root * (i === 10 ? 2 : 1), .22, 'sawtooth', .34, 420);
  // arpeggio over the chord
  const d = st.pats[bar % 4][i]; if (d >= 0) { const sc = st.scale, semi = sc[d % sc.length] + 12 * Math.floor(d / sc.length); osc(t, hz(root * 4, semi), .16, st.arp, .13, 2600); }
  // a soft pad on the first beat of each bar
  if (i === 0) { osc(t, root * 2, 60 / st.bpm * 3.6, 'triangle', .1); osc(t, hz(root * 2, st.scale[2]), 60 / st.bpm * 3.6, 'triangle', .07); }
}
