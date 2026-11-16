// Tiny sound effects made with WebAudio (no files needed). Starts after the first key press.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
      // a loop of noise used for rolling and grinding
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const mk = (type, freq) => {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(this.master); src.start();
        return { f, g };
      };
      this.roll = mk('lowpass', 500);
      this.grind = mk('bandpass', 2600);
    } catch (e) { this.ctx = null; }
  }

  tone(f0, f1, dur, type = 'square', vol = 0.06, delay = 0) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  burst(dur, freq, vol) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  ollie() { this.burst(0.07, 1800, 0.25); this.tone(220, 140, 0.08, 'triangle', 0.1); }
  land() { this.tone(120, 55, 0.14, 'sine', 0.25); this.burst(0.09, 500, 0.2); }
  trick() { this.tone(660, 990, 0.1, 'square', 0.04); }
  bank() { [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.05, i * 0.08)); }
  bail() { this.tone(320, 60, 0.55, 'sawtooth', 0.1); this.burst(0.3, 300, 0.25); }
  grindStart() { this.burst(0.12, 3000, 0.2); }

  // called every frame: how loud the rolling / grinding noise is
  update(speed, rolling, grinding) {
    if (!this.ctx || this.muted) { return; }
    const t = this.ctx.currentTime;
    this.roll.g.gain.setTargetAtTime(rolling ? Math.min(0.09, speed * 0.0065) : 0, t, 0.05);
    this.roll.f.frequency.setTargetAtTime(300 + speed * 70, t, 0.05);
    this.grind.g.gain.setTargetAtTime(grinding ? 0.07 : 0, t, 0.04);
  }
  silence() { if (this.ctx) { const t = this.ctx.currentTime; this.roll.g.gain.setTargetAtTime(0, t, 0.05); this.grind.g.gain.setTargetAtTime(0, t, 0.05); } }
}
