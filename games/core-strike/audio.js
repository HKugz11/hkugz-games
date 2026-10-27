// Synthesised sound effects with simple distance + stereo panning.
let AC = null, master = null, noiseBuf = null;
const L = { x: 0, y: 0, z: 0, yaw: 0 };
let vol = 0.7;

export function initAudio(v) {
  if (v !== undefined) vol = v;
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  master = AC.createGain();
  master.gain.value = vol;
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { vol = v; if (master) master.gain.value = v; }
export function setListener(x, y, z, yaw) { L.x = x; L.y = y; L.z = z; L.yaw = yaw; }

function bus(pos, base = 1, range = 9) {
  let g = base, pan = 0, dist = 0;
  if (pos) {
    const dx = pos.x - L.x, dy = (pos.y || 0) - L.y, dz = pos.z - L.z;
    dist = Math.hypot(dx, dy, dz);
    g = base / (1 + Math.pow(dist / range, 1.5));
    if (dist > 0.5) pan = Math.max(-0.85, Math.min(0.85, (dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / dist));
  }
  if (g < 0.004) return null;
  const gn = AC.createGain(); gn.gain.value = g;
  const p = AC.createStereoPanner(); p.pan.value = pan;
  gn.connect(p); p.connect(master);
  gn.dist = dist;
  return gn;
}
function noise(dest, t, dur, freq, type = 'lowpass', q = 0.8, v = 1, attack = 0.002) {
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
}
function tone(dest, t, f1, f2, dur, type = 'sine', v = 1, attack = 0.003) {
  const o = AC.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
const ok = () => AC && AC.state === 'running';

export const SFX = {
  shot(snd, pos, me) {
    if (!ok()) return;
    const b = bus(me ? null : pos, me ? 0.55 : 0.9, 14); if (!b) return;
    const t = AC.currentTime, [f, d, th] = snd;
    const far = 1 / (1 + b.dist / 35);
    noise(b, t, d, f * (0.4 + 0.6 * far), 'lowpass', 0.7, 0.9);
    noise(b, t, d * 0.35, 5200 * far + 600, 'bandpass', 0.9, 0.35 * far);
    tone(b, t, 150 * th, 42, 0.09 + 0.06 * th, 'sine', 0.75 * Math.min(th, 1.4));
    if (me) noise(b, t + 0.012, 0.05, 7000, 'highpass', 0.5, 0.12);
  },
  suppressed(pos, me) {
    if (!ok()) return;
    const b = bus(me ? null : pos, me ? 0.5 : 0.7, 9); if (!b) return;
    const t = AC.currentTime;
    noise(b, t, 0.09, 1600, 'bandpass', 1.2, 0.8);
    tone(b, t, 220, 70, 0.06, 'triangle', 0.35);
  },
  step(pos, loud, surface = 0) {
    if (!ok()) return;
    const b = bus(pos, loud * 0.5, 6); if (!b) return;
    const t = AC.currentTime;
    noise(b, t, 0.07, 500 + surface * 300 + Math.random() * 200, 'bandpass', 1.5, 0.9);
    noise(b, t + 0.012, 0.04, 2400, 'bandpass', 2, 0.2);
  },
  land(pos) { if (!ok()) return; const b = bus(pos, 0.5, 6); if (!b) return; noise(b, AC.currentTime, 0.12, 380, 'lowpass', 1, 1); },
  hit() { if (!ok()) return; const b = bus(null, 0.35); tone(b, AC.currentTime, 1700, 1500, 0.05, 'square', 0.25); },
  head() {
    if (!ok()) return; const b = bus(null, 0.45); const t = AC.currentTime;
    tone(b, t, 2650, 2600, 0.32, 'triangle', 0.5); tone(b, t, 3980, 3900, 0.22, 'sine', 0.25);
  },
  kill() { if (!ok()) return; const b = bus(null, 0.35); const t = AC.currentTime; tone(b, t, 660, 660, 0.09, 'square', 0.3); tone(b, t + 0.08, 990, 990, 0.16, 'square', 0.3); },
  pop(pos) {
    if (!ok()) return; const b = bus(pos, 0.8, 10); if (!b) return; const t = AC.currentTime;
    noise(b, t, 0.25, 1800, 'bandpass', 0.6, 0.8); tone(b, t, 520, 1300, 0.18, 'triangle', 0.35);
    for (let i = 0; i < 4; i++) tone(b, t + 0.05 + i * 0.04, 1800 + Math.random() * 1500, 900, 0.06, 'sine', 0.12);
  },
  hurt() { if (!ok()) return; const b = bus(null, 0.45); noise(b, AC.currentTime, 0.18, 300, 'lowpass', 1, 1); },
  armorHit() { if (!ok()) return; const b = bus(null, 0.3); tone(b, AC.currentTime, 900, 500, 0.12, 'triangle', 0.4); },
  reload(part) {
    if (!ok()) return; const b = bus(null, 0.3); const t = AC.currentTime;
    if (part === 0) { noise(b, t, 0.05, 2600, 'bandpass', 3, 0.8); tone(b, t, 400, 300, 0.05, 'square', 0.15); }
    else { noise(b, t, 0.04, 3600, 'bandpass', 4, 0.9); noise(b, t + 0.07, 0.05, 2000, 'bandpass', 3, 0.8); }
  },
  dry() { if (!ok()) return; const b = bus(null, 0.3); noise(b, AC.currentTime, 0.03, 4000, 'bandpass', 5, 0.8); },
  swap() { if (!ok()) return; const b = bus(null, 0.25); noise(b, AC.currentTime, 0.08, 3000, 'bandpass', 2, 0.6); },
  knife(pos, me) { if (!ok()) return; const b = bus(me ? null : pos, 0.35, 6); if (!b) return; noise(b, AC.currentTime, 0.16, 5000, 'highpass', 0.7, 0.5, 0.05); },
  bounce(pos) { if (!ok()) return; const b = bus(pos, 0.45, 7); if (!b) return; tone(b, AC.currentTime, 1300, 900, 0.06, 'triangle', 0.4); },
  pin() { if (!ok()) return; const b = bus(null, 0.3); tone(b, AC.currentTime, 2400, 2200, 0.05, 'square', 0.15); },
  boom(pos, big) {
    if (!ok()) return; const b = bus(pos, big ? 2 : 1.3, big ? 40 : 18); if (!b) return; const t = AC.currentTime;
    noise(b, t, big ? 2.6 : 1.1, big ? 420 : 700, 'lowpass', 0.6, 1);
    tone(b, t, big ? 70 : 110, 28, big ? 1.6 : 0.6, 'sine', 1);
    noise(b, t, 0.2, 3000, 'bandpass', 0.8, 0.4);
  },
  flashbang(pos) {
    if (!ok()) return; const b = bus(pos, 1.2, 16); if (!b) return; const t = AC.currentTime;
    noise(b, t, 0.4, 5000, 'highpass', 0.5, 0.9); tone(b, t, 180, 60, 0.3, 'sine', 0.6);
  },
  ring(sec) { if (!ok()) return; const b = bus(null, 0.08); tone(b, AC.currentTime, 3100, 3000, sec, 'sine', 0.5, 0.05); },
  smoke(pos) { if (!ok()) return; const b = bus(pos, 0.9, 10); if (!b) return; noise(b, AC.currentTime, 2.2, 1200, 'bandpass', 0.4, 0.5, 0.15); },
  beep(pos, urgency = 0) { if (!ok()) return; const b = bus(pos, 0.6 + 0.3 * urgency, 20 + 14 * urgency); if (!b) return; const f = 1450 + 650 * urgency; tone(b, AC.currentTime, f, f, 0.09, 'square', 0.35); },
  keypad(pos, i = 0) { if (!ok()) return; const b = bus(pos, 0.3, 9); if (!b) return; const f = 1500 + (i % 4) * 160; tone(b, AC.currentTime, f, f, 0.035, 'square', 0.3); },   // one key press on the bomb
  armed(pos) { if (!ok()) return; const b = bus(pos, 0.8, 36); if (!b) return; const t = AC.currentTime; tone(b, t, 330, 330, 0.16, 'square', 0.3); tone(b, t + 0.2, 330, 330, 0.16, 'square', 0.3); tone(b, t + 0.4, 220, 160, 0.5, 'sawtooth', 0.25); noise(b, t + 0.4, 0.3, 700, 'lowpass', 0.7, 0.4); },   // the bomb is armed
  snip(pos) { if (!ok()) return; const b = bus(pos, 0.4, 9); if (!b) return; const t = AC.currentTime; noise(b, t, 0.05, 6000, 'highpass', 1, 0.8); tone(b, t, 2400, 1800, 0.04, 'triangle', 0.25); },   // cutting a wire while defusing
  plant() { if (!ok()) return; const b = bus(null, 0.6); const t = AC.currentTime; [880, 1175, 1568].forEach((f, i) => tone(b, t + i * 0.12, f, f, 0.18, 'square', 0.22)); },
  defused() { if (!ok()) return; const b = bus(null, 0.6); const t = AC.currentTime; [1568, 1175, 880, 660].forEach((f, i) => tone(b, t + i * 0.1, f, f, 0.16, 'triangle', 0.35)); },
  tick(pos) { if (!ok()) return; const b = bus(pos, 0.25, 6); if (!b) return; noise(b, AC.currentTime, 0.03, 3000, 'bandpass', 6, 0.7); },
  buy() { if (!ok()) return; const b = bus(null, 0.3); const t = AC.currentTime; tone(b, t, 1046, 1046, 0.06, 'sine', 0.4); tone(b, t + 0.06, 1568, 1568, 0.1, 'sine', 0.4); },
  deny() { if (!ok()) return; const b = bus(null, 0.3); tone(b, AC.currentTime, 220, 180, 0.15, 'square', 0.2); },
  ui() { if (!ok()) return; const b = bus(null, 0.2); tone(b, AC.currentTime, 1200, 1200, 0.04, 'sine', 0.4); },
  fanfare(win) {
    if (!ok()) return; const b = bus(null, 0.5); const t = AC.currentTime;
    const notes = win ? [523, 659, 784, 1046] : [392, 349, 311, 262];
    notes.forEach((f, i) => { tone(b, t + i * 0.13, f, f, 0.32, 'triangle', 0.45); tone(b, t + i * 0.13, f / 2, f / 2, 0.32, 'sine', 0.3); });
  },
  countdown(last) { if (!ok()) return; const b = bus(null, 0.3); const f = last ? 1320 : 880; tone(b, AC.currentTime, f, f, 0.12, 'sine', 0.5); },
  streak() { if (!ok()) return; const b = bus(null, 0.45); const t = AC.currentTime; [784, 988, 1175, 1568].forEach((f, i) => tone(b, t + i * 0.06, f, f, 0.14, 'square', 0.18)); },
};
