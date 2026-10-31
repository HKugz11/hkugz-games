// Sound made from noise and beeps: no sound files. Starts only after the first click (browsers insist on that).
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.vol = 0.7; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 6; }
    this.noise = buf;
    this.master = ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(ctx.destination);
    const mk = (type, freq) => { const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.master); src.start(); return { f, g }; };
    this.eng = mk('lowpass', 200); this.wind = mk('highpass', 500);
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  update(thrustFrac, q, rho, paused) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, on = this.on && !paused;
    this.eng.g.gain.setTargetAtTime(on ? Math.min(1, thrustFrac) * 0.9 * Math.min(1, 0.25 + rho * 3) : 0, t, 0.08);
    this.eng.f.frequency.setTargetAtTime(110 + 600 * thrustFrac, t, 0.1);
    this.wind.g.gain.setTargetAtTime(on ? Math.min(0.5, q / 40000) : 0, t, 0.2);
  }
  burst(dur, freq, gain, type = 'lowpass') {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); src.stop(ctx.currentTime + dur + 0.05);
  }
  tone(freq, dur, gain, type = 'square', slide = 0) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }
  boom(size = 1) { this.burst(0.9 + size * 0.3, 380, Math.min(2, 0.8 + size * 0.3)); this.tone(70, 0.5, 0.6, 'sine', -40); }
  stage() { this.tone(180, 0.09, 0.25, 'square', -80); this.burst(0.25, 1400, 0.3, 'bandpass'); }
  chute() { this.burst(0.7, 700, 0.5, 'bandpass'); }
  click() { this.tone(660, 0.05, 0.12, 'triangle'); }
  good() { this.tone(523, 0.12, 0.2, 'triangle'); setTimeout(() => this.tone(784, 0.2, 0.2, 'triangle'), 110); }
  touch() { this.burst(0.35, 300, 0.5); }
}
