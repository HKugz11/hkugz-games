// audio.js - every sound is made from noise and beeps in code (no sound files). The browser only allows sound after the
// first click, so start() is called from a button. One master volume + a mute switch controls everything.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.vol = 0.8; this.nextBubble = 1; this.nextBreath = 2; this.nextBeep = 0; this.nextThump = 0; this.thumpNote = 0; this.t = 0; this.ready = false; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    // a couple of seconds of soft "brown" noise, looped, is the base of the ocean sound
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 6; }
    this.noise = buf;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.vol; this.master.connect(ctx.destination);
    const loop = (type, freq, q = 0.7) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return { f, g };
    };
    this.under = loop('lowpass', 300);       // the deep "whooommm" of being underwater
    this.waves = loop('bandpass', 700, 0.5);  // waves slapping, heard above the water
    // the scary shark heartbeat/music goes through its own filter
    this.dread = ctx.createGain(); this.dread.gain.value = 0; this.dread.connect(this.master);
    this.ready = true;
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.03); }
  setVolume(v) { this.vol = v; if (this.master && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03); }

  // ---------------------------------------------------------------- building blocks
  burst(dur, freq, gain, type = 'lowpass', q = 1, to = 0, delay = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay, src = ctx.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.03, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  tone(freq, dur, gain, type = 'sine', slide = 0, delay = 0, dest = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------------- one-shot sounds
  bubble() { const f = 300 + Math.random() * 700; this.tone(f, 0.12, 0.08 + Math.random() * 0.05, 'sine', f * 0.9); }
  bubbles(n = 4) { for (let i = 0; i < n; i++) { const f = 350 + Math.random() * 600; this.tone(f, 0.1, 0.09, 'sine', f * 0.8, i * 0.06 + Math.random() * 0.05); } }
  splash() { this.burst(0.9, 1400, 0.5, 'lowpass', 0.8, 300); this.burst(0.5, 3000, 0.25, 'bandpass', 1, 800); this.bubbles(6); }
  net() { this.burst(0.28, 400, 0.4, 'bandpass', 1.5, 1800); }
  netMiss() { this.tone(300, 0.2, 0.12, 'triangle', -120); }
  catchFish(rarity = 0) {
    const base = [523, 587, 659, 784, 988][rarity] || 523;
    this.tone(base, 0.14, 0.2, 'triangle'); this.tone(base * 1.5, 0.28, 0.2, 'triangle', 0, 0.09);
    if (rarity >= 3) this.tone(base * 2, 0.4, 0.14, 'sine', 0, 0.18);
    this.bubbles(3);
  }
  discover() { [523, 659, 784, 1047, 1319].forEach((f, i) => { this.tone(f, 0.35, 0.18, 'triangle', 0, i * 0.09); this.tone(f * 2, 0.25, 0.06, 'sine', 0, i * 0.09 + 0.02); }); }
  kaching() {   // a cash register: bell + a shower of coins
    this.tone(1319, 0.7, 0.18, 'sine'); this.tone(1760, 0.6, 0.12, 'sine', 0, 0.01); this.tone(2637, 0.4, 0.07, 'sine', 0, 0.02);
    this.burst(0.05, 5000, 0.3, 'highpass');
    for (let i = 0; i < 5; i++) this.tone(2200 + Math.random() * 1500, 0.12, 0.07, 'triangle', 0, 0.2 + i * 0.07);
  }
  click() { this.tone(660, 0.05, 0.1, 'triangle'); }
  tick() { this.tone(1500, 0.03, 0.04, 'sine'); }
  deny() { this.tone(220, 0.18, 0.15, 'square', -60); }
  buy() { this.kaching(); }
  spear() { this.burst(0.3, 3000, 0.45, 'bandpass', 1, 500); this.tone(160, 0.12, 0.2, 'triangle', -80); }
  reload() { this.tone(900, 0.04, 0.1, 'square'); this.tone(1200, 0.05, 0.1, 'square', 0, 0.06); }
  stun() { this.tone(900, 0.5, 0.16, 'sawtooth', -700); this.tone(1300, 0.4, 0.1, 'square', -900, 0.05); this.burst(0.4, 4000, 0.2, 'highpass'); }
  bite() { this.burst(0.35, 600, 0.9, 'lowpass', 1, 150); this.tone(110, 0.4, 0.5, 'sine', -60); this.tone(70, 0.5, 0.4, 'sawtooth', -30, 0.02); }
  warnSting() { for (const f of [932, 988, 1397]) this.tone(f, 0.9, 0.09, 'sawtooth', f * 0.02, 0, this.dread); this.tone(70, 0.9, 0.35, 'sine'); }
  repel() { this.burst(0.8, 600, 0.35, 'bandpass', 2, 3000); this.tone(500, 0.6, 0.12, 'triangle', 600); }
  blackout() { this.tone(300, 1.6, 0.3, 'sine', -250); this.burst(1.5, 400, 0.4, 'lowpass', 1, 80); }
  gull() { const t = [0, 0.14, 0.3]; t.forEach((d, i) => this.tone(1500 + i * 150, 0.22, 0.05, 'triangle', -400, d)); }
  zone() { this.tone(392, 0.3, 0.12, 'triangle'); this.tone(523, 0.5, 0.12, 'triangle', 0, 0.2); }
  beep() { this.tone(880, 0.09, 0.2, 'square'); }
  cold() { this.tone(200, 0.5, 0.18, 'triangle', 60); this.burst(0.5, 3000, 0.15, 'highpass'); }

  // ---------------------------------------------------------------- the always-on sounds
  // st = { under, depth, speed01, air01, lowAir, active, sharkNear (0..1), sharkChase }
  update(dt, st) {
    if (!this.ready) return;
    this.t += dt;
    const ctx = this.ctx, now = ctx.currentTime;
    const on = st.active;
    this.under.g.gain.setTargetAtTime(on && st.under ? 0.5 : 0, now, 0.25);
    this.under.f.frequency.setTargetAtTime(Math.max(90, 420 - st.depth * 1.1) + st.speed01 * 150, now, 0.3);
    this.waves.g.gain.setTargetAtTime(on && !st.under ? 0.12 : 0, now, 0.25);
    if (on && st.under) {
      this.nextBubble -= dt; if (this.nextBubble <= 0) { this.nextBubble = 0.35 + Math.random() * 1.5; this.bubble(); }
    } else if (on && !st.under) {
      this.nextBubble -= dt; if (this.nextBubble <= 0) { this.nextBubble = 7 + Math.random() * 9; this.gull(); }
    }
    // breathing through the regulator, a bit faster when swimming hard
    if (on && st.under && st.diving) {
      this.nextBreath -= dt;
      if (this.nextBreath <= 0) {
        this.nextBreath = 3.1 - st.speed01 * 1.1;
        this.burst(0.5, 2600, 0.09, 'bandpass', 0.8, 1400);
        this.bubbles(2 + Math.floor(Math.random() * 3));
      }
    }
    // low air: an anxious beep that speeds up
    if (on && st.diving && st.lowAir) {
      this.nextBeep -= dt;
      if (this.nextBeep <= 0) { this.nextBeep = 0.25 + 0.7 * Math.max(0, st.air01 / 0.25); this.beep(); }
    } else this.nextBeep = 0;
    // sharks: a low "dum ... dum" that speeds up as they get closer, and a harsh drone when chased
    const near = on && st.diving ? st.sharkNear : 0;
    this.dread.gain.setTargetAtTime(near > 0.02 ? 1 : 0, now, 0.1);
    if (near > 0.02) {
      this.nextThump -= dt;
      if (this.nextThump <= 0) {
        this.nextThump = 1.15 - 0.8 * near;
        const f = this.thumpNote++ % 2 ? 43.65 : 41.2;
        this.tone(f * 2, 0.5, 0.5 * near + 0.1, 'sawtooth', 0, 0, this.dread);
        this.tone(f, 0.55, 0.7 * near + 0.1, 'sine', 0, 0, this.dread);
        if (st.sharkChase) this.tone(f * 16 + (this.thumpNote % 2) * 14, 0.28, 0.08 * near, 'sawtooth', 0, 0.03, this.dread);
      }
    }
  }
}
