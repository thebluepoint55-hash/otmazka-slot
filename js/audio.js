/* Звуки Отмазино: всё синтезируется на лету через Web Audio, без файлов. */
window.Sound = (() => {
  let ctx = null, master = null, noiseBuf = null, on = true, lastTick = 0;
  try { on = localStorage.getItem('otm-sound') !== 'off'; } catch (e) { /* приватный режим */ }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, f, t, dur, peak, fEnd, out) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    env(g, t, 0.004, peak, dur);
    o.connect(g).connect(out || master);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(t, dur, peak, type, f, q, fEnd) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q || 1;
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    env(g, t, 0.002, peak, dur);
    s.connect(fl).connect(g).connect(master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  const S = {
    tick(t) { noise(t, 0.016, 0.22, 'bandpass', 3400, 5); tone('square', 1900, t, 0.01, 0.025); },
    clack(t) { noise(t, 0.08, 0.6, 'lowpass', 1500); tone('sine', 160, t, 0.16, 0.7, 52); tone('square', 640, t, 0.02, 0.06); },
    tock(t) { tone('sine', 300, t, 0.06, 0.25, 180); noise(t, 0.02, 0.15, 'bandpass', 2000, 3); },
    boing(t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.38);
      lfo.frequency.value = 22; lg.gain.value = 24; lfo.connect(lg).connect(o.frequency);
      env(g, t, 0.01, 0.16, 0.38);
      o.connect(g).connect(master);
      o.start(t); lfo.start(t); o.stop(t + 0.45); lfo.stop(t + 0.45);
    },
    thunk(t, o) { const v = o.soft ? 0.45 : 0.8; tone('sine', 125, t, 0.2, v, 46); noise(t, 0.035, v * 0.5, 'lowpass', 2600); tone('triangle', 460, t, 0.05, 0.1, 220); },
    coin(t, o) {
      const p = (o.pitch || 1) * (0.94 + Math.random() * 0.12), v = o.vol || 1;
      tone('triangle', 1568 * p, t, 0.05, 0.08 * v);
      tone('sine', 2093 * p, t + 0.004, 0.36, 0.16 * v);
      tone('sine', 2637 * p * 1.007, t + 0.006, 0.52, 0.11 * v);
      tone('sine', 4186 * p * 1.012, t + 0.004, 0.2, 0.05 * v);
    },
    fanfare(t) {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093];
      notes.forEach((f, i) => { tone('square', f, t + i * 0.075, 0.12, 0.05); tone('triangle', f, t + i * 0.075, 0.2, 0.12); });
      const c = t + notes.length * 0.075 + 0.04;
      [523.25, 659.25, 783.99, 1046.5].forEach(f => { tone('triangle', f, c, 1.1, 0.1); tone('square', f * 1.003, c, 0.7, 0.025); });
      for (let i = 0; i < 6; i++) S.coin(c + 0.05 + i * 0.09, { pitch: 1 + i * 0.04, vol: 0.7 });
    },
    print(t) {
      for (let i = 0; i < 5; i++) {
        noise(t + i * 0.045, 0.03, 0.14, 'bandpass', 900 + i * 60, 2);
        tone('sawtooth', 92, t + i * 0.045, 0.035, 0.04);
      }
    },
    whoosh(t) { noise(t, 0.3, 0.32, 'bandpass', 380, 1.4, 3400); tone('sine', 520, t + 0.08, 0.14, 0.08, 980); },
    ding(t) { tone('sine', 1318.5, t, 0.7, 0.22); tone('sine', 1975.5, t + 0.1, 0.8, 0.18); tone('triangle', 2637, t + 0.1, 0.25, 0.04); },
    pop(t) { tone('sine', 520, t, 0.08, 0.22, 880); },
    type(t) { noise(t, 0.014, 0.16, 'highpass', 2600); tone('square', 1200 + Math.random() * 300, t, 0.008, 0.015); },
    buzz(t) { tone('sawtooth', 110, t, 0.28, 0.12); tone('sawtooth', 116.5, t, 0.28, 0.1); },
    chaching(t) { S.coin(t, { pitch: 0.85 }); S.coin(t + 0.12, { pitch: 1.1 }); tone('triangle', 2637, t + 0.12, 0.6, 0.08); }
  };

  return {
    get on() { return on; },
    unlock() { if (on) ensure(); },
    toggle() {
      on = !on;
      try { localStorage.setItem('otm-sound', on ? 'on' : 'off'); } catch (e) { /* пусто */ }
      if (on) { ensure(); this.play('pop'); }
      return on;
    },
    play(name, opt) {
      if (!on) return;
      const ua = navigator.userActivation;
      if (!ctx && ua && !ua.hasBeenActive) return;
      if (!ensure()) return;
      const now = ctx.currentTime;
      if (name === 'tick') { if (now - lastTick < 0.038) return; lastTick = now; }
      S[name] && S[name](now + 0.005, opt || {});
    }
  };
})();
