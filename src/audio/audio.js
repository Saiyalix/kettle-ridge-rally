  /* ---------- audio: everything you hear is synthesized here (no sound files; the only data is the two short Engine B loops) ----------
     Layers (all Web Audio, built on the first tap / key press because phones block sound until then):
       Engine A  "Modelled": EngineDSP (engine-dsp.js) in ONE AudioWorklet (falls back to a ScriptProcessor running the same code).
       Engine B  "Recorded": two looped recordings (engine-samples.js) pitched by rpm and cross-faded, shaped by throttle; the same pops,
                 whine, turbo, shift and exhaust layers sit on top. Chosen in the pause menu, remembered in localStorage.
       Rally:    anti-lag pops and bangs on lift-off, turbo whistle + blow-off / flutter, gearbox whine, dog-box clunk on shifts.
       Surfaces: tyre rumble / roar (tarmac) / spray (gravel, dirt, snow, grass), stones thrown at the underbody, tyre squeal,
                 landings and bumps, impacts (wood, metal, stone), wall scraping, wind.
       World:    crowd murmur, cheers, whistles and air horns near spectators; echo in castle gatehouses, the torii tunnel and the courtyard;
                 one passing rival with Doppler; engine ducks a little and radio clicks play while the co-driver speaks. */
  let audio = null, muted = false;
  const impacts = []; let scrapeLevel = 0;
  const AUDIO_PREFS = (() => {
    let p = {}; try { p = JSON.parse(localStorage.getItem('rallyAudio') || '{}') || {}; } catch (e) { /* storage unavailable */ }
    return { engine: p.engine === 'rec' ? 'rec' : 'model', vol: Object.assign({ master: 1, engine: 1, fx: 1, voice: 1 }, p.vol || {}) };
  })();
  function saveAudioPrefs() { try { localStorage.setItem('rallyAudio', JSON.stringify(AUDIO_PREFS)); } catch (e) { /* ignore */ } }
  const ENGINE_PARAMS = [['rpm', 1000, 0, 15000], ['load', 0, 0, 1], ['cut', 0, 0, 1], ['crackle', 0, 0, 1], ['inside', 0, 0, 1], ['exh', 1, 0, 2], ['mix', 1, 0, 2],
    ['whineHz', 300, 0, 8000], ['whineAmp', 0, 0, 1], ['turboHz', 2000, 0, 12000], ['turboAmp', 0, 0, 1]];
  function engineWorkletSource() {
    const desc = ENGINE_PARAMS.map(p => ({ name: p[0], defaultValue: p[1], minValue: p[2], maxValue: p[3], automationRate: 'k-rate' }));
    return EngineDSP.toString() + '\nregisterProcessor("rr-engine", class extends AudioWorkletProcessor {\n' +
      ' static get parameterDescriptors() { return ' + JSON.stringify(desc) + '; }\n' +
      ' constructor() { super(); this.d = new EngineDSP(sampleRate, 9871); this.p = {}; }\n' +
      ' process(inputs, outputs, params) { const o = outputs[0][0], p = this.p; for (const k in params) p[k] = params[k][0]; this.d.render(o, o.length, p); return true; }\n});';
  }
  const SURF = {          // per surface: tyre roar, low rumble, spray (centre Hz, level), stones thrown
    tarmac: { roar: 1, rum: 0.7, sF: 2200, sG: 0.0, stone: 0 },
    gravel: { roar: 0.12, rum: 0.9, sF: 2700, sG: 0.30, stone: 1 },
    dirt: { roar: 0.22, rum: 1.0, sF: 850, sG: 0.20, stone: 0.25 },
    snow: { roar: 0.06, rum: 0.3, sF: 1300, sG: 0.15, stone: 0 },
    grass: { roar: 0.1, rum: 0.5, sF: 1700, sG: 0.09, stone: 0 },
  };
  function initAudio(opts) {
    if (audio) return audio;
    try {
      const offline = !!(opts && opts.ctx);
      const ctx = offline ? opts.ctx : new (window.AudioContext || window.webkitAudioContext)();
      const sr = ctx.sampleRate, low = () => quality === 'low';
      const master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
      const mix = ctx.createGain(), engBus = ctx.createGain(), fxBus = ctx.createGain();
      engBus.connect(mix); fxBus.connect(mix); mix.connect(master); master.connect(comp);
      const clip = ctx.createWaveShaper(), curve = new Float32Array(1025);      // final soft limiter: nothing gets past 0.95, however many layers pile up
      for (let i = 0; i < 1025; i++) curve[i] = Math.tanh((i - 512) / 512 * 1.4) * 0.95 / Math.tanh(1.4);
      clip.curve = curve; comp.connect(clip); clip.connect(ctx.destination);
      const filt = (type, f, q, g) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (g != null) b.gain.value = g; return b; };
      const gainNode = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
      const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
      const R = mulberry32(4242);
      const nb = ctx.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = R() * 2 - 1;
      const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, R() * 1.9); return s; };

      /* ----- little sounds, drawn once into buffers ----- */
      const mk = (dur, gen) => { const n = Math.max(1, Math.round(dur * sr)), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); gen(d, n); let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); if (pk > 0) for (let i = 0; i < n; i++) d[i] /= pk; const f = Math.min(n, 64); for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f; return b; };
      const bpf = (x, f, q) => {      // constant-gain band-pass, centre f may be a function of the sample index
        const o = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i = 0; i < x.length; i++) {
          const fc = typeof f === 'function' ? f(i / sr) : f, w = 2 * Math.PI * fc / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al, c = -2 * Math.cos(w) / a0, e = (1 - al) / a0, g = al / a0;
          const y = g * x[i] - g * x2 - c * y1 - e * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; o[i] = y;
        }
        return o;
      };
      const wn = n => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = R() * 2 - 1; return a; };
      const lpf = (x, k) => { const o = new Float32Array(x.length); let y = 0; for (let i = 0; i < x.length; i++) { y += (x[i] - y) * k; o[i] = y; } return o; };
      const hpf = (x, k) => { const l = lpf(x, k), o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x[i] - l[i]; return o; };
      const ex = (t, tau) => Math.exp(-t / tau);
      const B = {};
      B.stone = [0, 1, 2, 3].map(k => mk(0.06, (d, n) => { const w = bpf(wn(n), 1700 + k * 900 + R() * 400, 2.2); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = w[i] * ex(t, 0.006) + 0.25 * Math.sin(2 * Math.PI * (240 + k * 40) * t) * ex(t, 0.012); } }));
      B.knock = mk(0.18, (d, n) => { const w = lpf(wn(n), 0.12); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (150 - 400 * t) * t) * ex(t, 0.05) + w[i] * 1.2 * ex(t, 0.02); } });
      B.thump = mk(0.55, (d, n) => { const w = lpf(wn(n), 0.1); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += 2 * Math.PI * Math.max(36, 90 - 120 * t) / sr; d[i] = Math.sin(ph) * ex(t, 0.13) + w[i] * 1.5 * ex(t, 0.06); } });
      B.rattle = mk(0.8, (d, n) => { for (let k = 0; k < 16; k++) { const t0 = Math.pow(R(), 1.6) * 0.65, c = bpf(wn(Math.round(0.05 * sr)), 700 + R() * 1500, 3), a = 0.4 + R() * 0.6; for (let i = 0; i < c.length && i + Math.round(t0 * sr) < n; i++) d[i + Math.round(t0 * sr)] += c[i] * ex(i / sr, 0.012) * a * (1 - t0); } });
      B.metal = mk(0.7, (d, n) => { const w = hpf(wn(n), 0.2); for (let i = 0; i < n; i++) { const t = i / sr; let s = w[i] * ex(t, 0.02) * 0.8 + Math.sin(2 * Math.PI * 95 * t) * ex(t, 0.09); for (const f of [412, 1133, 1764, 2491]) s += 0.35 * Math.sin(2 * Math.PI * f * t + f) * ex(t, 0.1 + 80 / f); d[i] = s; } });
      B.wood = mk(0.35, (d, n) => { const w = lpf(wn(n), 0.15); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (210 - 200 * t) * t) * ex(t, 0.04) + w[i] * 2 * ex(t, 0.015) + (R() * 2 - 1) * ex(t, 0.003) * 0.7; } });
      B.rock = mk(0.45, (d, n) => { const w = bpf(wn(n), 900, 0.8); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 70 * t) * ex(t, 0.1) + w[i] * 2.5 * ex(t, 0.05); } });
      B.clunk = mk(0.22, (d, n) => { const w = lpf(wn(n), 0.2); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (170 - 500 * t) * t) * ex(t, 0.035) + w[i] * 1.4 * ex(t, 0.012) + Math.sin(2 * Math.PI * 1400 * t) * ex(t, 0.004) * 0.5; } });
      B.pssh = mk(0.55, (d, n) => { const w = hpf(wn(n), 0.25); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = w[i] * (1 - Math.exp(-t / 0.004)) * ex(t, 0.16); } });
      B.flutter = mk(0.7, (d, n) => { const w = hpf(wn(n), 0.2); for (let i = 0; i < n; i++) { const t = i / sr, ph = (t * 22) % 1; d[i] = w[i] * Math.exp(-ph * 6) * ex(t, 0.35); } });
      B.bang = mk(0.5, (d, n) => { const w = lpf(wn(n), 0.28), h = hpf(wn(n), 0.3); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = w[i] * 2 * ex(t, 0.05) + Math.sin(2 * Math.PI * 68 * t) * ex(t, 0.07) + h[i] * ex(t, 0.012) + (R() < 0.01 * ex(t, 0.2) * 5 ? (R() - 0.5) * 2 : 0); } });
      B.click = mk(0.05, (d, n) => { const w = bpf(wn(n), 1800, 1.2); for (let i = 0; i < n; i++) d[i] = w[i] * ex(i / sr, 0.006); });
      B.cheer = [0, 1].map(k => mk(1.4, (d, n) => {
        const dur = n / sr, v = new Float32Array(n); let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / sr, f0 = 210 + 60 * Math.sin(Math.PI * t / dur) + k * 40 + 6 * Math.sin(40 * t); ph += 2 * Math.PI * f0 / sr; let s = 0; for (let h = 1; h < 14; h++) s += Math.sin(ph * h) / h; v[i] = s + (R() * 2 - 1) * 0.8; }
        const a = bpf(v, t => 700 + 250 * Math.sin(Math.PI * t / dur), 5), b = bpf(v, t => 1250 + 300 * Math.sin(Math.PI * t / dur), 6);
        for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (a[i] + 0.6 * b[i]) * Math.min(1, t / 0.12) * Math.exp(-Math.max(0, t - 0.4) / 0.45); }
      }));
      B.whistle = mk(0.7, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += 2 * Math.PI * (2900 + 140 * Math.sin(2 * Math.PI * 9 * t)) / sr; d[i] = Math.sin(ph) * Math.min(1, t / 0.02) * (t < 0.5 ? 1 : ex(t - 0.5, 0.08)) + (R() - 0.5) * 0.15; } });
      B.horn = mk(1.1, (d, n) => { const lo = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; let s = 0; for (const f of [311, 369, 466]) { const ph = (t * f * (1 + (f === 369 ? 0.004 : 0))) % 1; s += ph * 2 - 1; } lo[i] = s * Math.min(1, t / 0.05) * (t < 0.8 ? 1 : ex(t - 0.8, 0.08)); } const l = lpf(lo, 0.25); for (let i = 0; i < n; i++) d[i] = l[i]; });
      const play = (b, g, rate = 1, dest = fxBus, pan = 0) => {
        const s = ctx.createBufferSource(), gn = gainNode(g); s.buffer = b; s.playbackRate.value = rate; s.connect(gn);
        let tail = gn;
        if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; gn.connect(p); tail = p; }
        tail.connect(dest); s.onended = () => { try { tail.disconnect(); gn.disconnect(); } catch (e) { /* already gone */ } };
        s.start();
      };

      /* ----- engine ----- */
      const eng = { node: null, proc: null, P: {}, set(k, v) { if (this.node) this.node.parameters.get(k).value = v; else this.P[k] = v; }, kind: 'none' };
      for (const p of ENGINE_PARAMS) eng.P[p[0]] = p[1];
      const engOut = gainNode(1); engOut.connect(engBus);
      const startFallback = () => {
        if (!ctx.createScriptProcessor || eng.proc) return;
        const dsp = new EngineDSP(sr, 9871), proc = ctx.createScriptProcessor(2048, 0, 1);
        proc.onaudioprocess = ev => { const o = ev.outputBuffer.getChannelData(0); dsp.render(o, o.length, eng.P); };
        proc.connect(engOut); eng.proc = proc; eng.kind = 'scriptprocessor';
      };
      let ready = Promise.resolve();
      try {
        if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined' && typeof Blob !== 'undefined' && window.URL && URL.createObjectURL) {
          const url = URL.createObjectURL(new Blob([engineWorkletSource()], { type: 'text/javascript' }));
          ready = ctx.audioWorklet.addModule(url).then(() => {
            eng.node = new AudioWorkletNode(ctx, 'rr-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
            for (const k in eng.P) eng.node.parameters.get(k).value = eng.P[k];
            eng.node.connect(engOut); eng.kind = 'worklet'; URL.revokeObjectURL(url);
          }).catch(() => startFallback());
        } else startFallback();
      } catch (e) { startFallback(); }

      // Engine B: recorded loops (decoded on first use)
      const rec = { ready: false, srcs: [], gains: [], out: null, lp: null };
      function ensureRec() {
        if (rec.ready || rec.failed) return;
        try {
          const S = ENGINE_SAMPLES, ulaw = v => { const y = (v / 127.5) - 1, a = Math.abs(y); return Math.sign(y) * (Math.pow(256, a) - 1) / 255; };
          const lut = new Float32Array(256); for (let i = 0; i < 256; i++) lut[i] = ulaw(i);
          rec.lp = filt('lowpass', 2500, 0.7); const pk = filt('peaking', 120, 0.9, 5), out = gainNode(0);
          chain(rec.lp, pk, out, engBus); rec.out = out;
          for (const L of S.loops) {
            const bin = atob(L.b64), b = ctx.createBuffer(1, L.n, S.sr), d = b.getChannelData(0);
            for (let i = 0; i < L.n; i++) d[i] = lut[bin.charCodeAt(i)];
            const s = ctx.createBufferSource(), g = gainNode(0); s.buffer = b; s.loop = true; s.connect(g); g.connect(rec.lp); s.start();
            rec.srcs.push(s); rec.gains.push(g);
          }
          rec.ready = true;
        } catch (e) { rec.failed = true; }
      }

      /* ----- continuous layers ----- */
      const N = {};
      N.rum = { g: gainNode(0) }; chain(noise(), filt('lowpass', 210, 0.7), N.rum.g, fxBus);
      N.roar = { g: gainNode(0), bp: filt('bandpass', 520, 0.8) }; chain(noise(), N.roar.bp, N.roar.g, fxBus);
      N.spray = { g: gainNode(0), bp: filt('bandpass', 2000, 0.6) }; chain(noise(), N.spray.bp, N.spray.g, fxBus);
      N.squeal = { g: gainNode(0), bp: filt('bandpass', 1050, 16) }; chain(noise(), N.squeal.bp, filt('peaking', 1050, 4, 10), N.squeal.g, fxBus);
      N.scrape = { g: gainNode(0) }; chain(noise(), filt('bandpass', 2900, 2.5), filt('peaking', 4200, 3, 8), N.scrape.g, fxBus);
      N.wind = { g: gainNode(0), bp: filt('bandpass', 400, 0.5) }; chain(noise(), N.wind.bp, N.wind.g, fxBus);
      N.crowd = { g: gainNode(0), bp: filt('bandpass', 1000, 0.6), pan: ctx.createStereoPanner ? ctx.createStereoPanner() : null };
      chain(noise(), N.crowd.bp, N.crowd.g); if (N.crowd.pan) { N.crowd.g.connect(N.crowd.pan); N.crowd.pan.connect(fxBus); } else N.crowd.g.connect(fxBus);

      // a passing rival: one saw + one square through a filter, placed and Doppler-shifted (high quality only, made on demand)
      function ensureRival() {
        if (N.rival) return;
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = gainNode(0), f = filt('lowpass', 1100, 0.8), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = o2.frequency.value = 120;
        const g2 = gainNode(0.5); o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(fxBus); } else g.connect(fxBus);
        o1.start(); o2.start(); N.rival = { o1, o2, g, f, p, id: -1, d: 0 };
      }
      // echo: a generated impulse response, high quality only, made on demand
      function ensureReverb() {
        if (N.rev || !ctx.createConvolver) return;
        const len = Math.round(1.5 * sr), ir = ctx.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let y = 0; for (let i = 0; i < len; i++) { const t = i / sr; y += ((R() * 2 - 1) - y) * (0.8 * Math.exp(-t / 0.3) + 0.12); d[i] = y * Math.exp(-t / 0.33) * 1.6 * Math.min(1, t / 0.004); } }
        const cv = ctx.createConvolver(); cv.buffer = ir; const send = gainNode(0), ret = gainNode(0.9);
        chain(mix, send, cv, ret, master); N.rev = { send };
      }

      // UI beeps and chimes
      function tone(freqs, dur, type = 'square', vol = 0.12, gap = 0) {
        const t0 = ctx.currentTime;
        freqs.forEach((f, k) => {
          const o = ctx.createOscillator(), g = gainNode(0); o.type = type; o.frequency.value = f;
          const st = t0 + k * (dur + gap);
          g.gain.setValueAtTime(vol * 0.8, st); g.gain.exponentialRampToValueAtTime(0.0005, st + dur);
          o.connect(g); g.connect(master); o.start(st); o.stop(st + dur + 0.02);
        });
      }
      audio = { ctx, master, mix, engBus, fxBus, eng, rec, ensureRec, ensureRival, ensureReverb, N, B, play, tone, ready, offline, boost: 0 };
    } catch (e) { audio = null; }
    return audio;
  }
  const cue = {
    beep: () => audio && audio.tone([660], 0.1, 'square', 0.1),
    go: () => audio && audio.tone([1320], 0.35, 'square', 0.11),
    warn: () => audio && audio.tone([1040], 0.07, 'square', 0.08),
    checkpoint: () => audio && audio.tone([880, 1175, 1568], 0.1, 'square', 0.09, 0.01),
    goal: () => audio && audio.tone([523, 659, 784, 1047, 784, 1047], 0.13, 'sawtooth', 0.08, 0.02),
    over: () => audio && audio.tone([392, 330, 262, 196], 0.22, 'sawtooth', 0.09, 0.03),
  };
  // first tap / key press: make the audio context (browsers only allow it then) and wake it up
  (function unlockAudio() {
    const go = () => { try { initAudio(); if (audio && audio.ctx.state === 'suspended') audio.ctx.resume(); } catch (e) { /* no audio on this device */ } };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, go, { passive: true });
  })();
  // pause-menu controls (the buttons live in page/body.html)
  function syncAudioUi() {
    const b = $('engineBtn'); if (b) b.textContent = 'Engine sound: ' + (AUDIO_PREFS.engine === 'rec' ? 'Recorded' : 'Modelled');
    for (const k of ['master', 'engine', 'fx', 'voice']) { const el = $('vol_' + k); if (el) el.value = Math.round(AUDIO_PREFS.vol[k] * 100); }
  }
  function setEngineMode(m) { AUDIO_PREFS.engine = m === 'rec' ? 'rec' : 'model'; saveAudioPrefs(); syncAudioUi(); }
  if ($('engineBtn')) $('engineBtn').addEventListener('click', () => setEngineMode(AUDIO_PREFS.engine === 'rec' ? 'model' : 'rec'));
  for (const k of ['master', 'engine', 'fx', 'voice']) { const el = $('vol_' + k); if (el) el.addEventListener('input', () => { AUDIO_PREFS.vol[k] = clamp(+el.value / 100, 0, 1.5); saveAudioPrefs(); }); }
  syncAudioUi();

  /* ---------- per frame ---------- */
  const GEAR_TEETH = [12.5, 11, 10, 9.2, 8.5];       // whine pitch = engine Hz x this, so each gear has its own note
  let liftWin = 0, prevThr = 0, boost = 0, prevGear = 1, landCool = 0, bumpCool = 0, stoneAcc = 0, cheerCool = 0, whistleCool = 9, popWindow = 0, wasSpeaking = false, resumeCool = 0;
  let prevVy = 0, prevPY = 0, wetNow = 0, flick = 1, flickT = 0, rivalPrevD = 0;
  const wt = { tarmac: 0, gravel: 0, dirt: 0, snow: 0, grass: 0 };
  function locationEcho() {      // 0..1: castle gatehouses, the torii tunnel, the castle courtyard
    let w = 0;
    const gx = car.pos.x, gz = car.pos.z;
    if (castleL) {
      for (const g of castleL.gatehouses) {
        const dx = gx - g.x, dz = gz - g.z, a = Math.abs(dx * Math.sin(g.th) + dz * Math.cos(g.th)), l = Math.abs(-dx * Math.cos(g.th) + dz * Math.sin(g.th));
        w = Math.max(w, clamp(1 - Math.max(0, a - g.depth / 2) / 12, 0, 1) * clamp(1 - Math.max(0, l - g.half) / 6, 0, 1));
      }
      w = Math.max(w, 0.22 * castleCourt(castleL, gx, gz));
    }
    if (ST && ST.toriiTunnel && P && P[progIdx]) { const s = P[progIdx].s, t0 = ST.toriiTunnel[0], t1 = ST.toriiTunnel[1]; w = Math.max(w, 0.7 * clamp(Math.min(s - (t0 - 10), (t1 + 10) - s) / 14, 0, 1)); }
    return w;
  }
  function updateAudio(dt) {
    if (!audio) return;
    const A = audio, ctx = A.ctx, t = ctx.currentTime, N = A.N, V = AUDIO_PREFS.vol, lowQ = quality === 'low';
    const set = (param, v, tc = 0.05) => param.setTargetAtTime(v, t, tc);
    const live = !(muted || state === 'menu' || state === 'paused');
    set(A.master.gain, live ? V.master * 0.9 * (state === 'replay' ? 0.7 : 1) : 0, 0.1);
    if (ctx.state !== 'running' && !A.offline && (resumeCool -= dt) <= 0) { resumeCool = 1; try { ctx.resume(); } catch (e) { /* needs a tap */ } }
    if (!live) { impacts.length = 0; wasSpeaking = false; return; }
    const E = CONFIG.engine, rp = state === 'replay' && replay ? replay : null;
    const sp = car.speed, inside = camMode === 3 ? 1 : camMode === 2 ? 0.6 : 0;
    const speaking = !!(synth && synth.speaking && !muted);

    // ---- what the car is doing (the replay has less data: rebuild it from position and the recorded slide) ----
    let nC = 0, slipAvg = 0, drift = car.drift, hardest = 0; const cnt = { tarmac: 0, gravel: 0, dirt: 0, snow: 0, grass: 0 };
    if (rp) {
      const o = Math.floor(rp.f) * REC; drift = rec[o + 17] > 0;
      const gy = terrain.heightAt(car.pos.x, car.pos.z), vy = dt > 0 ? (car.pos.y - prevPY) / dt : 0;
      if (car.pos.y - gy < 1.5) nC = 4;
      slipAvg = Math.abs(car.beta) * sp * 0.6;
      if (prevVy < -3 && vy > prevVy + 2.5) hardest = Math.min(4, -prevVy * 0.7);
      prevVy = vy; prevPY = car.pos.y;
      if (nC) { const s0 = world.surfaceAt(car.pos.x, car.pos.z); cnt[s0 in cnt ? s0 : 'grass'] = 4; }
    } else {
      for (const w of car.wheels) {
        if (!w.contact) continue; nC++; slipAvg += w.slipSpeed; cnt[w.surface in cnt ? w.surface : 'grass']++;
      }
      if (nC) slipAvg /= nC;
      for (const w of car.wheels) hardest = Math.max(hardest, w.compVel);
    }
    const slipN = clamp(slipAvg / 5, 0, 1), slideV = Math.abs(Math.sin(car.beta)) * sp;
    const use = clamp(car.dbg.gripUse || 0, 0, 1.2), edge = rp ? 0 : clamp((use - 0.72) / 0.28, 0, 1);
    const tyreLoad = Math.max(edge * edge, (drift && nC ? 1 : 0) * clamp(slideV / 6, 0.4, 1), slipN * 0.75) * clamp(sp / 8, 0, 1);
    const nCs = Math.max(1, nC);
    for (const k in wt) wt[k] += (cnt[k] / nCs - wt[k]) * Math.min(1, dt * 8);
    flickT -= dt; if (flickT <= 0) { flick = 0.8 + Math.random() * 0.4; flickT = 0.04; }

    // ---- engine ----
    const thr = car.throttleOut, cutting = car.shiftTimer > 0, rpm = state === 'countdown' ? Math.max(car.rpm, E.idleRpm) : car.rpm;
    const limiter = thr > 0.5 && rpm > E.redlineRpm - 150;
    popWindow = Math.max(0, popWindow - dt); liftWin = Math.max(0, liftWin - dt);
    if (prevThr > 0.5 && thr < 0.15 && rpm > 5500) liftWin = 0.9;      // a real lift from high rpm: the only time the exhaust pops
    const overrun = thr < 0.05 && rpm > 3000 && sp > 4;
    const E_ = A.eng, RB = A.rec, useRec = AUDIO_PREFS.engine === 'rec';
    if (useRec) A.ensureRec();
    const recOn = useRec && RB.ready;
    E_.set('rpm', rpm); E_.set('load', clamp(thr, 0, 1)); E_.set('inside', inside);
    E_.set('cut', cutting ? 1 : limiter ? 0.25 : 0);
    E_.set('crackle', (liftWin > 0 && thr < 0.05 && rpm > 4500 ? 0.03 * clamp((rpm - 4000) / 3000, 0.3, 1) : 0) + (popWindow > 0 ? 0.12 : 0));
    E_.set('exh', recOn ? 0.22 : 1);
    E_.set('mix', 1);
    // turbo builds with throttle and rpm; lifting off vents it
    const want = thr * clamp((rpm - 2400) / 3200, 0, 1);
    boost += (want - boost) * Math.min(1, dt * (want > boost ? 1.8 : 7));
    E_.set('turboHz', 1700 + boost * 3900); E_.set('turboAmp', boost * boost * 0.055);
    const g = car.gear > 0 ? clamp(car.gear, 1, 5) : 0;
    E_.set('whineHz', rpm / 60 * (g ? GEAR_TEETH[g - 1] : 14)); E_.set('whineAmp', (g ? 0.02 : 0.03) * (0.35 + 0.65 * clamp(thr, 0, 1)) * clamp(rpm / 3000, 0, 1));
    if (recOn) {                    // Engine B: pitch the two loops so their pulse rate follows rpm/30, cross-fade, open up with throttle
      const S = ENGINE_SAMPLES, fire = rpm / 30, hi = smoothstep(clamp((rpm - 2400) / 1500, 0, 1));
      const rate0 = fire / S.loops[0].f0, rate1 = fire / S.loops[1].f0;
      RB.srcs[0].playbackRate.setTargetAtTime(rate0, t, 0.03); RB.srcs[1].playbackRate.setTargetAtTime(rate1, t, 0.03);
      set(RB.gains[0].gain, Math.sqrt(1 - hi)); set(RB.gains[1].gain, Math.sqrt(hi));
      set(RB.lp.frequency, (inside ? 0.6 : 1) * (900 + clamp(thr, 0, 1) * 2600 + rpm * 0.35), 0.04);
      set(RB.out.gain, (0.34 + 0.66 * clamp(thr, 0, 1)) * (0.5 + 0.5 * clamp(rpm / 4000, 0, 1)) * 0.55, 0.04);
    } else if (RB.ready) set(RB.out.gain, 0, 0.04);
    // lift-off: blow-off hiss or flutter, and a bang when it happens at revs; shifts: dog-box clunk + a pop on a hard upshift
    if (prevThr > 0.6 && thr < 0.1) {
      if (boost > 0.3) A.play(Math.random() < 0.5 ? A.B.pssh : A.B.flutter, 0.16 * boost, 0.9 + Math.random() * 0.2);
      if (rpm > 5500 && Math.random() < 0.3) A.play(A.B.bang, 0.2 * clamp((rpm - 3500) / 3500, 0.2, 1), 0.85 + Math.random() * 0.3);
    }
    if (car.gear !== prevGear) {
      if (car.gear > 0 && prevGear > 0) {
        A.play(A.B.clunk, 0.4 + (car.gear > prevGear ? 0.1 : 0.2), 0.9 + Math.random() * 0.2);
        if (prevThr > 0.5 && car.gear > prevGear) { if (Math.random() < 0.1) { popWindow = 0.28; A.play(A.B.bang, 0.12, 1.1); } }
      }
      prevGear = car.gear;
    }
    prevThr = thr;

    // ---- surfaces and tyres ----
    let roar = 0, rum = 0, sG = 0, sF = 0, stones = 0;
    for (const k in wt) { const S = SURF[k]; roar += wt[k] * S.roar; rum += wt[k] * S.rum; sG += wt[k] * S.sG; sF += wt[k] * S.sF; stones += wt[k] * S.stone; }
    let sFreq = 0, wsum = 0; for (const k in wt) { const w = wt[k] * SURF[k].sG; sFreq += w * SURF[k].sF; wsum += w; } sFreq = wsum > 1e-4 ? sFreq / wsum : 2000;
    const spd = clamp(sp / 30, 0, 1.4), onGround = nC / 4;
    set(N.rum.g.gain, Math.min(0.085, sp * 0.0017 * rum) * onGround);
    set(N.roar.g.gain, Math.min(0.07, spd * 0.05 * roar * (0.6 + 0.5 * tyreLoad)) * onGround * flick, 0.04);
    set(N.roar.bp.frequency, 380 + sp * 5, 0.1);
    set(N.spray.g.gain, Math.min(0.12, spd * sG * 0.35 * (0.55 + 0.9 * tyreLoad + 0.4 * slipN)) * (lowQ ? 0.8 : 1) * onGround * flick, 0.03);
    set(N.spray.bp.frequency, sFreq * (1 - 0.25 * tyreLoad), 0.05);
    set(N.squeal.g.gain, 0.35 * tyreLoad * tyreLoad * wt.tarmac * onGround, 0.04);
    set(N.squeal.bp.frequency, 980 + 260 * tyreLoad + Math.random() * 40, 0.03);
    scrapeLevel = Math.max(0, scrapeLevel - dt * 6);
    set(N.scrape.g.gain, Math.min(0.16, scrapeLevel * 0.16) * (0.7 + Math.random() * 0.6), 0.02);
    set(N.wind.g.gain, Math.min(0.3, (sp / 45) ** 2 * 0.09) * (inside ? 0.5 : 1), 0.2);
    set(N.wind.bp.frequency, 250 + sp * 9, 0.2);
    // stones against the underbody and arches: more on gravel, a lot more when sliding
    if (stones > 0.05 && nC && sp > 3) {
      stoneAcc += dt * stones * clamp(sp / 8, 0, 1) * (2 + 8 * tyreLoad + 2 * spd) * 0.6 * (lowQ ? 0.5 : 1);
      let n = 0;
      while (stoneAcc >= 1 && n++ < 3) {
        stoneAcc -= 1;
        if (Math.random() < 0.1) A.play(A.B.knock, (0.1 + Math.random() * 0.12) * 0.4, 0.8 + Math.random() * 0.5, A.fxBus, (Math.random() - 0.5) * 0.6);
        else A.play(A.B.stone[(Math.random() * 4) | 0], (0.06 + Math.random() * 0.14 * (0.4 + tyreLoad)) * 0.3, 0.8 + Math.random() * 0.6, A.fxBus, (Math.random() - 0.5) * 0.8);
      }
      if (stoneAcc > 2) stoneAcc = 0;
    } else stoneAcc = 0;
    // suspension bumps, heavy landings
    landCool -= dt; bumpCool -= dt;
    if (hardest > 1.8 && landCool <= 0) {
      const s = Math.min(1, (hardest - 1.4) / 3);
      A.play(A.B.thump, 0.5 * s, 0.9 + Math.random() * 0.2); if (hardest > 2.6) A.play(A.B.rattle, 0.25 * s, 0.9 + Math.random() * 0.2);
      landCool = 0.35; bumpCool = 0.2;
    } else if (hardest > 0.8 && bumpCool <= 0) { A.play(A.B.knock, 0.07 + 0.12 * clamp((hardest - 0.8) / 1, 0, 1), 0.7 + Math.random() * 0.3); bumpCool = 0.22; }
    // impacts: wood for trees and fences, metal for rails and walls (a scrape along it marks those), stone in the castle and for big rocks
    while (impacts.length) {
      const s = impacts.pop(), seg = scrapeLevel > 0.02, castle = ST && ST.theme === 'castle', r = Math.random();
      A.play(A.B.thump, 0.5 * s, 1.1);
      const buf = castle || r < 0.25 ? A.B.rock : seg && r < 0.7 ? A.B.metal : A.B.wood;
      A.play(buf, 0.3 + 0.6 * s, 0.9 + Math.random() * 0.2);
    }

    // ---- world: crowd ----
    let best = 1e9, bx = 0, bz = 0;
    if (typeof crowdClusters !== 'undefined') for (const cl of crowdClusters) { const dx = cl.x - car.pos.x, dz = cl.z - car.pos.z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bx = dx; bz = dz; } }
    const cd = best < 1e8 ? Math.sqrt(best) - 3 : 1e9, lvl = cd < 45 ? Math.pow(1 - Math.max(0, cd) / 45, 1.6) : 0;
    set(N.crowd.g.gain, lvl * 0.12 * (0.7 + Math.random() * 0.6), 0.1);
    set(N.crowd.bp.frequency, 800 + 500 * Math.random(), 0.1);
    const lat = Math.hypot(bx, bz) > 0.1 ? clamp((bx * car.right.x + bz * car.right.z) / Math.hypot(bx, bz), -1, 1) * 0.75 : 0;
    if (N.crowd.pan) set(N.crowd.pan.pan, lat, 0.1);
    cheerCool -= dt; whistleCool -= dt;
    if (lvl > 0.4 && cheerCool <= 0 && sp > 6) { A.play(A.B.cheer[(Math.random() * 2) | 0], 0.3 * lvl, 0.9 + Math.random() * 0.25, A.fxBus, lat); cheerCool = 5 + Math.random() * 6; }
    if (lvl > 0.3 && whistleCool <= 0) { A.play(Math.random() < 0.25 ? A.B.horn : A.B.whistle, 0.09 * lvl, 0.95 + Math.random() * 0.15, A.fxBus, -lat); whistleCool = 9 + Math.random() * 16; }

    A.lvl = lvl;
    // ---- world: a passing rival with Doppler (high quality) ----
    if (!lowQ && !rp && state !== 'countdown') {
      A.ensureRival(); const R_ = N.rival;
      let bd = 80, bi = -1, bdx = 0, bdz = 0;
      for (let i = 0; i < rivals.length; i++) { const r = rivals[i]; if (!r.g.visible) continue; const dx = r.g.position.x - car.pos.x, dz = r.g.position.z - car.pos.z, d = Math.hypot(dx, dz); if (d < bd) { bd = d; bi = i; bdx = dx; bdz = dz; } }
      if (R_) {
        let k = 0, gv = 0;
        if (bi >= 0) {
          const v = rivals[bi].v, rpmR = 2600 + clamp(v / 40, 0, 1) * 4200, vr = R_.id === bi && dt > 0 ? (bd - R_.d) / dt : 0;
          k = 1 / (1 + clamp(vr, -60, 60) / 340); gv = Math.pow(1 - bd / 80, 2) * 0.07;
          set(R_.o1.frequency, rpmR / 30 * k, 0.05); set(R_.o2.frequency, rpmR / 30 * 0.5 * k, 0.05); set(R_.f.frequency, 700 + 600 * (1 - bd / 80), 0.1);
          if (R_.p) set(R_.p.pan, clamp((bdx * car.right.x + bdz * car.right.z) / Math.max(1, bd), -1, 1) * 0.8, 0.05);
        }
        R_.id = bi; R_.d = bd; set(R_.g.gain, gv, 0.06);
      }
    } else if (N.rival) set(N.rival.g.gain, 0, 0.05);

    // ---- echo and the co-driver ----
    if (!lowQ) A.ensureReverb();
    wetNow = lowQ ? 0 : locationEcho();
    if (N.rev) set(N.rev.send.gain, wetNow * 0.7, 0.15);
    if (speaking !== wasSpeaking) { A.play(A.B.click, speaking ? 0.12 : 0.07, speaking ? 1 : 0.8, A.mix); wasSpeaking = speaking; }
    set(A.engBus.gain, V.engine * (speaking ? 0.55 : 1), 0.15);
    set(A.fxBus.gain, V.fx * (speaking ? 0.8 : 1), 0.15);
  }
