/* Звуки и музыка Отмазино: всё синтезируется на лету через Web Audio, без файлов. */
window.Sound = (() => {
  let ctx = null, master = null, noiseBuf = null, on = true, musicOn = true, lastTick = 0;
  try {
    on = localStorage.getItem('otm-sound') !== 'off';
    musicOn = localStorage.getItem('otm-music') !== 'off';
  } catch (e) { /* приватный режим */ }

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
  function noise(t, dur, peak, type, f, q, fEnd, out) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q || 1;
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    env(g, t, 0.002, peak, dur);
    s.connect(fl).connect(g).connect(out || master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------- фоновая музыка: свинговый лаунж игрового зала ----------
     Петля 8 тактов, 132 bpm: Cmaj7 Am7 Dm7 G7 | Em7 A7 Dm7 G7.
     Бас шагает четвертями, электропиано играет комп на свинговых долях,
     щётки и ride, мелодия на вибрафоне, вдали перезвон автоматов.
     Планировщик ставит ноты с запасом вперёд, поэтому темп ровный даже при нагрузке. */
  const Music = (() => {
    const BPM = 132, B = 60 / BPM, LEVEL = 0.34, SW = 0.67;
    const PROG = [
      { r: 36, q: 'maj', v: [64, 67, 71, 74] },
      { r: 33, q: 'min', v: [60, 64, 67, 69] },
      { r: 38, q: 'min', v: [60, 62, 65, 69] },
      { r: 43, q: 'dom', v: [59, 62, 65, 67] },
      { r: 40, q: 'min', v: [62, 64, 67, 71] },
      { r: 33, q: 'dom', v: [61, 64, 67, 69] },
      { r: 38, q: 'min', v: [60, 62, 65, 69] },
      { r: 43, q: 'dom', v: [59, 62, 65, 67] }
    ];
    /* мелодия: [midi, доля, длительность в долях] */
    const MEL = [
      [[76, 0, 1], [79, 1, 0.67], [81, 1 + SW, 1.33], [79, 3, 1]],
      [[76, 0, 2], [72, 2 + SW, 1.33]],
      [[77, 0, 1], [76, 1, 0.67], [74, 1 + SW, 1.33], [72, 3, 1]],
      [[71, 0, 2], [74, 2, 0.67], [77, 2 + SW, 1.33]],
      [[79, 0, 1.5], [76, 1 + SW, 1.33], [74, 3, 1]],
      [[73, 0, 1], [76, 1, 0.67], [79, 1 + SW, 1.33], [81, 3, 1]],
      [[77, 0, 2], [74, 2, 1], [72, 3, 1]],
      [[71, 0, 1], [74, 1, 1], [79, 2, 2]]
    ];
    let bus = null, duckG = null, timer = 0, nextBar = 0, bar = 0, playing = false;

    function bass(m, t) {
      const f = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 700;
      env(g, t, 0.012, 0.5, 0.42);
      g.connect(lp).connect(bus);
      [[f, 'sine', 1], [f * 2, 'triangle', 0.25]].forEach(([fr, type, k]) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = fr; og.gain.value = k;
        o.connect(og).connect(g); o.start(t); o.stop(t + 0.5);
      });
    }
    /* электропиано: FM-колокольчик с затухающей модуляцией */
    function ep(m, t, dur, vel) {
      const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      car.type = 'sine'; car.frequency.value = f;
      mod.type = 'sine'; mod.frequency.value = f;
      mg.gain.setValueAtTime(f * 1.1, t); mg.gain.exponentialRampToValueAtTime(f * 0.06, t + 0.35);
      mod.connect(mg).connect(car.frequency);
      env(g, t, 0.006, vel, dur);
      car.connect(g).connect(bus);
      car.start(t); mod.start(t); car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
    }
    /* вибрафон: основной тон, 4-я гармоника и тремоло */
    function vib(m, t, dur) {
      const f = mtof(m), g = ctx.createGain(), trem = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      env(g, t, 0.005, 0.2, dur + 0.5);
      trem.gain.value = 0.8; lfo.frequency.value = 5.5; lg.gain.value = 0.2;
      lfo.connect(lg).connect(trem.gain);
      g.connect(trem).connect(bus);
      [[f, 1], [f * 4, 0.12]].forEach(([fr, k]) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sine'; o.frequency.value = fr; og.gain.value = k;
        o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.6);
      });
      lfo.start(t); lfo.stop(t + dur + 0.6);
    }
    /* далёкий автомат в зале: короткий восходящий перезвон */
    function chime(t) {
      const base = [84, 88, 91, 96][Math.floor(Math.random() * 4)];
      [0, 4, 7, 12].forEach((iv, i) => tone('sine', mtof(base + iv), t + i * 0.06, 0.25, 0.035, null, bus));
    }
    function scheduleBar(i, t0) {
      const c = PROG[i], nx = PROG[(i + 1) % PROG.length];
      const third = c.q === 'min' ? 3 : 4;
      /* бас: тоника, терция, квинта, хроматический подход к следующей тонике */
      [c.r, c.r + third, c.r + 7, nx.r + (Math.random() < 0.5 ? -1 : 1)].forEach((m, k) => bass(m, t0 + k * B));
      /* комп в ритме чарльстона: на раз и на свинговое «и» после двух */
      const hits = i % 2 ? [[0, 0.5, 0.05], [1 + SW, 1.2, 0.045], [3 + SW, 0.3, 0.03]] : [[0, 0.5, 0.05], [1 + SW, 1.2, 0.045]];
      hits.forEach(([beat, dur, vel]) => c.v.forEach(m => ep(m, t0 + beat * B, dur * B, vel)));
      /* барабаны: свинговый ride, щётки на 2 и 4, мягкая бочка на 1 и 3 */
      [0, 1, 1 + SW, 2, 3, 3 + SW].forEach(beat => noise(t0 + beat * B, 0.06, beat % 1 ? 0.03 : 0.05, 'highpass', 7500, 0.7, null, bus));
      [1, 3].forEach(beat => noise(t0 + beat * B, 0.16, 0.05, 'bandpass', 1900, 0.7, null, bus));
      [0, 2].forEach(beat => tone('sine', 72, t0 + beat * B, 0.16, 0.22, 44, bus));
      MEL[i].forEach(([m, beat, d]) => vib(m, t0 + beat * B, d * B));
      if (Math.random() < 0.35) chime(t0 + (1 + Math.random() * 2) * B);
    }
    function tick() {
      while (nextBar < ctx.currentTime + 1.4) {
        scheduleBar(bar, nextBar);
        nextBar += 4 * B;
        bar = (bar + 1) % PROG.length;
      }
    }
    return {
      start() {
        if (playing || !ctx) return;
        playing = true;
        duckG = ctx.createGain(); duckG.gain.value = 1;
        bus = ctx.createGain(); bus.gain.value = 0.0001;
        bus.connect(duckG).connect(master);
        bus.gain.setTargetAtTime(LEVEL, ctx.currentTime, 0.6);
        nextBar = ctx.currentTime + 0.1; bar = 0;
        tick(); timer = setInterval(tick, 250);
      },
      stop() {
        if (!playing) return;
        playing = false; clearInterval(timer);
        const old = bus, oldDuck = duckG;
        old.gain.cancelScheduledValues(ctx.currentTime);
        old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
        setTimeout(() => oldDuck.disconnect(), 1800);
      },
      duck(ms, level) {
        if (!playing) return;
        const t = ctx.currentTime, g = duckG.gain;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(level, t, 0.06);
        g.setTargetAtTime(1, t + ms / 1000, 0.5);
      }
    };
  })();

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
      Music.duck(3200, 0.25);
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
    win(t) {
      S.chaching(t);
      [783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => tone('triangle', f, t + 0.15 + i * 0.09, 0.4, 0.12));
    },
    fail(t) {
      /* грустный тромбон: четыре ноты вниз, последняя с вибрато; музыку на это время глушим */
      Music.duck(2900, 0.12);
      const notes = [392, 370, 349.2, 329.6];
      notes.forEach((f, i) => {
        const at = t + i * 0.42, dur = i === 3 ? 1.1 : 0.36;
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.02, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.08);
        if (i === 3) {
          const lfo = ctx.createOscillator(), lg = ctx.createGain();
          lfo.frequency.value = 6; lg.gain.value = 9; lfo.connect(lg).connect(o.frequency);
          lfo.start(at); lfo.stop(at + dur + 0.05);
        }
        lp.type = 'lowpass'; lp.frequency.value = 1100;
        env(g, at, 0.04, 0.16, dur);
        o.connect(lp).connect(g).connect(master);
        o.start(at); o.stop(at + dur + 0.1);
      });
    },
    chaching(t) { S.coin(t, { pitch: 0.85 }); S.coin(t + 0.12, { pitch: 1.1 }); tone('triangle', 2637, t + 0.12, 0.6, 0.08); }
  };

  const syncMusic = () => { if (on && musicOn && ctx) Music.start(); else Music.stop(); };
  return {
    get on() { return on; },
    get music() { return musicOn; },
    unlock() {
      if (!on) return;
      ensure();
      syncMusic();
    },
    toggle() {
      on = !on;
      try { localStorage.setItem('otm-sound', on ? 'on' : 'off'); } catch (e) { /* пусто */ }
      if (on) { ensure(); this.play('pop'); }
      syncMusic();
      return on;
    },
    toggleMusic() {
      musicOn = !musicOn;
      try { localStorage.setItem('otm-music', musicOn ? 'on' : 'off'); } catch (e) { /* пусто */ }
      if (musicOn && on) ensure();
      syncMusic();
      return musicOn;
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
