  /* ---------- audio: synthesized 4-cylinder turbo engine, tyres, wind, impacts ---------- */
  let audio = null, muted = false;
  const AP = { rpm: 1000, throttle: 0, limiter: false, crackle: 0 };   // values the engine synth reads
  const impacts = []; let scrapeLevel = 0;
  function initAudio() {
    if (audio) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const sr = ctx.sampleRate;
      const master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
      master.connect(comp); comp.connect(ctx.destination);
      const nb = ctx.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, Math.random() * 1.9); return s; };
      const filt = (type, f, q, g) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (g != null) b.gain.value = g; return b; };
      const gainNode = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
      const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };

      // Engine: each cylinder fires an exhaust pressure pulse. Four firings per two crank revolutions,
      // with slightly different strength per cylinder, gives the uneven burble at idle and a hard rasp at high rpm.
      const proc = ctx.createScriptProcessor(1024, 0, 1);
      const cylAmp = [1.0, 0.82, 0.95, 0.78];
      let cyc = 0, slot = -1, rpmS = 1000, thrS = 0, fireT = 1, fireA = 0, popT = 1, popA = 0, nA = 0, nB = 0, dc = 0;
      proc.onaudioprocess = ev => {
        const out = ev.outputBuffer.getChannelData(0);
        for (let i = 0; i < out.length; i++) {
          rpmS += (AP.rpm - rpmS) * 0.0012;
          thrS += (AP.throttle - thrS) * 0.0015;
          const cycHz = rpmS / 120;
          cyc += cycHz / sr; if (cyc >= 1) cyc -= 1;
          const sl = (cyc * 4) | 0;
          if (sl !== slot) {
            slot = sl; fireT = 0;
            const cut = AP.limiter && Math.random() < 0.55;                                 // rev limiter fuel cut
            fireA = cut ? 0.06 : cylAmp[slot] * (0.86 + Math.random() * 0.28) * (0.32 + 0.68 * thrS);
            if (AP.crackle > 0 && Math.random() < AP.crackle) { popT = 0; popA = 0.5 + Math.random(); }  // overrun pops
          }
          fireT += 1 / sr; popT += 1 / sr;
          const k = cycHz * 4 / 0.3;
          const n = Math.random() * 2 - 1;
          nA += (n - nA) * 0.35; nB += (n - nB) * 0.04;
          let s = fireA * (Math.exp(-fireT * k) - Math.exp(-fireT * k * 5)) * 2.4;
          s += fireA * nA * Math.exp(-fireT * k * 1.3) * (0.16 + 0.5 * thrS);
          if (popT < 0.09) s += popA * (nA * 1.3 + nB * 2.5) * Math.exp(-popT * 40);
          dc += (s - dc) * 0.002; s -= dc;
          out[i] = Math.tanh(s * 1.9) * 0.7;
        }
      };
      const engLP = filt('lowpass', 1500, 0.8), engGain = gainNode(0.5);
      chain(proc, filt('highpass', 38, 0.7), filt('peaking', 115, 0.9, 7), filt('peaking', 420, 1.3, 3), engLP, engGain, master);
      // Induction roar and turbo
      const intakeBP = filt('bandpass', 900, 1.8), intakeGain = gainNode(0);
      chain(noise(), intakeBP, intakeGain, master);
      const whistle = ctx.createOscillator(); whistle.type = 'sine'; whistle.frequency.value = 2000; whistle.start();
      const whistleGain = gainNode(0); chain(whistle, whistleGain, master);
      const bovGain = gainNode(0); chain(noise(), filt('bandpass', 2300, 0.9), bovGain, master);
      // Tyres and wind
      const rollGain = gainNode(0); chain(noise(), filt('lowpass', 220, 0.7), rollGain, master);
      const crunchBP = filt('bandpass', 1700, 0.7), crunchGain = gainNode(0); chain(noise(), crunchBP, crunchGain, master);
      const slideBP = filt('bandpass', 900, 0.9), slideGain = gainNode(0); chain(noise(), slideBP, slideGain, master);      // loose-surface slide: a deeper rushing hiss
      const scrapeGain = gainNode(0); chain(noise(), filt('bandpass', 2900, 2.5), filt('peaking', 4200, 3, 8), scrapeGain, master);
      const snowGain = gainNode(0); chain(noise(), filt('bandpass', 650, 1.1), snowGain, master);
      const squealBP = filt('bandpass', 1080, 16), squealGain = gainNode(0); chain(noise(), squealBP, filt('peaking', 1080, 4, 10), squealGain, master);
      const windGain = gainNode(0); chain(noise(), filt('lowpass', 620, 0.6), windGain, master);

      function sfx(kind, strength) {
        const t = ctx.currentTime, g = gainNode(0), o = ctx.createOscillator(), ng = gainNode(0), nsrc = noise();
        o.type = 'sine';
        const lp = filt('lowpass', kind === 'hit' ? 1100 : kind === 'shift' ? 700 : 320, 0.7);
        if (kind === 'shift') { o.frequency.value = 90; g.gain.setValueAtTime(0.06 * strength, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06); ng.gain.setValueAtTime(0.08 * strength, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.05); }
        else { o.frequency.setValueAtTime(kind === 'hit' ? 70 : 85, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
          g.gain.setValueAtTime(0.6 * strength, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
          ng.gain.setValueAtTime((kind === 'hit' ? 0.7 : 0.35) * strength, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + (kind === 'hit' ? 0.4 : 0.18)); }
        chain(o, g, master); chain(nsrc, lp, ng, master);
        o.start(t); o.stop(t + 0.5); nsrc.stop(t + 0.5);
      }
      // short synth cues: checkpoint chime, countdown beeps, low-time warning, goal fanfare, game over
      function tone(freqs, dur, type = 'square', vol = 0.12, gap = 0) {
        const t0 = ctx.currentTime;
        freqs.forEach((f, k) => {
          const o = ctx.createOscillator(), g = gainNode(0); o.type = type; o.frequency.value = f;
          const st = t0 + k * (dur + gap);
          g.gain.setValueAtTime(vol, st); g.gain.exponentialRampToValueAtTime(0.0005, st + dur);
          o.connect(g); g.connect(master); o.start(st); o.stop(st + dur + 0.02);
        });
      }
      audio = { ctx, master, engLP, engGain, tone, intakeBP, intakeGain, whistle, whistleGain, bovGain, rollGain, crunchGain, crunchBP, slideGain, slideBP, scrapeGain, snowGain, squealGain, squealBP, windGain, sfx };
    } catch (e) { audio = null; }
  }
  const cue = {
    beep: () => audio && audio.tone([660], 0.12, 'square', 0.1),
    go: () => audio && audio.tone([1320], 0.35, 'square', 0.12),
    warn: () => audio && audio.tone([1040], 0.08, 'square', 0.09),
    checkpoint: () => audio && audio.tone([880, 1175, 1568], 0.11, 'square', 0.1, 0.01),
    goal: () => audio && audio.tone([523, 659, 784, 1047, 784, 1047], 0.13, 'sawtooth', 0.09, 0.02),
    over: () => audio && audio.tone([392, 330, 262, 196], 0.22, 'sawtooth', 0.1, 0.03),
  };
  let prevThr = 0, boost = 0, prevGear = 1, landCool = 0;
  function updateAudio(dt) {
    if (!audio) return;
    const A = audio, t = A.ctx.currentTime, E = CONFIG.engine;
    const set = (param, v, tc = 0.05) => param.setTargetAtTime(v, t, tc);
    set(A.master.gain, muted || state === 'menu' || state === 'paused' ? 0 : state === 'replay' ? 0.6 : 0.9, 0.12);
    const thr = car.shiftTimer > 0 ? 0 : car.throttleOut;
    AP.rpm = car.rpm; AP.throttle = thr;
    AP.limiter = thr > 0.5 && car.rpm > E.redlineRpm - 150;
    AP.crackle = thr < 0.05 && car.rpm > 3300 ? 0.04 * car.rpm / 7000 : 0;
    const inside = camMode === 3;
    // turbo boost builds with throttle and rpm; lifting off vents it through the blow-off valve
    const want = thr * clamp((car.rpm - 2400) / 3200, 0, 1);
    boost += (want - boost) * Math.min(1, dt * (want > boost ? 1.8 : 7));
    if (prevThr > 0.6 && thr < 0.1 && boost > 0.3) {
      A.bovGain.gain.cancelScheduledValues(t); A.bovGain.gain.setValueAtTime(0.16 * boost, t); A.bovGain.gain.exponentialRampToValueAtTime(0.0005, t + 0.45);
    }
    prevThr = thr;
    set(A.engLP.frequency, (inside ? 0.55 : 1) * (650 + thr * 2600 + car.rpm * 0.3));
    set(A.engGain.gain, (inside ? 0.8 : 1) * (0.48 + thr * 0.3));
    set(A.intakeBP.frequency, 400 + car.rpm * 0.35);
    set(A.intakeGain.gain, (inside ? 0.07 : 0.035) * thr * car.rpm / E.redlineRpm);
    set(A.whistle.frequency, 1700 + boost * 3900);
    set(A.whistleGain.gain, boost * boost * (inside ? 0.022 : 0.014));
    // tyres: rolling rumble everywhere; on tarmac a squeal that starts as the tyres near their limit and
    // screams in a slide; on loose surfaces the crunch thickens into a rushing hiss as the car slides
    let tarmac = 0, loose = 0, snow = 0, nC = 0, roll = 0;
    for (const w of car.wheels) {
      if (!w.contact) continue; nC++;
      const v = Math.abs(w.vLong);
      if (w.surface === 'tarmac') tarmac++;
      else if (w.surface === 'snow') snow += v;
      else loose += v * (w.surface === 'grass' ? 0.6 : 1);
      roll += v;
    }
    const sp = car.speed, use = clamp(car.dbg.gripUse || 0, 0, 1.2), slideV = Math.abs(Math.sin(car.beta)) * sp;
    const drift = car.drift && nC ? 1 : 0;
    const edge = clamp((use - 0.72) / 0.28, 0, 1);                           // 0 below 72% grip, 1 at the limit
    const tyreLoad = Math.max(edge * edge, drift * clamp(slideV / 6, 0.4, 1)) * clamp(sp / 8, 0, 1);
    set(A.rollGain.gain, nC ? Math.min(0.22, sp * 0.0045) * nC / 4 : 0);
    set(A.squealGain.gain, 0.1 * tyreLoad * tarmac / 4, 0.04);
    set(A.squealBP.frequency, 980 + 260 * tyreLoad + Math.random() * 40, 0.03);
    set(A.crunchGain.gain, Math.min(0.3, loose * 0.0032) * (0.6 + Math.random() * 0.8), 0.02);
    set(A.crunchBP.frequency, 1700 - 500 * tyreLoad, 0.05);
    set(A.slideGain.gain, (nC ? (1 - tarmac / Math.max(1, nC)) : 0) * Math.min(0.26, tyreLoad * (0.08 + slideV * 0.02)) * (0.75 + Math.random() * 0.5), 0.03);
    set(A.snowGain.gain, Math.min(0.28, snow * 0.0035 * (1 + tyreLoad)) * (0.7 + Math.random() * 0.6), 0.03);
    scrapeLevel = Math.max(0, scrapeLevel - dt * 6);
    set(A.scrapeGain.gain, Math.min(0.16, scrapeLevel * 0.16) * (0.7 + Math.random() * 0.6), 0.02);
    set(A.windGain.gain, Math.min(0.28, (sp / 45) ** 2 * 0.14) * (inside ? 0.55 : 1), 0.2);
    // landing thumps, gear changes, impacts
    landCool -= dt;
    let hardest = 0; for (const w of car.wheels) hardest = Math.max(hardest, w.compVel);
    if (hardest > 1.8 && landCool <= 0 && state !== 'menu') { A.sfx('thump', Math.min(1, (hardest - 1.4) / 3)); landCool = 0.35; }
    if (car.gear !== prevGear) { if (car.gear > 0 && prevGear > 0) A.sfx('shift', 1); prevGear = car.gear; }
    while (impacts.length) A.sfx('hit', impacts.pop());
  }

