  /* ---------- engine DSP: a physically modelled 4-cylinder turbo rally engine (audio) ----------
     One self-contained class. It touches nothing outside itself, because its source text (EngineDSP.toString()) is also sent to the
     AudioWorklet. Keep it that way: no outer variables, no helpers from the page.
     How it makes a car noise:
       1. Crank phase runs at rpm/120 cycles per second; 4 cylinders fire at 0, 90, 180, 270 degrees of the 720-degree cycle.
       2. Each firing is a short pressure pulse (fast rise, quick fall), a little different per cylinder and per firing, harder under load.
       3. The pulse train goes into the "exhaust": two feedback delay lines (comb filters) with damping. The long one is the pipe
          (inverting reflection at the open end, so only odd harmonics of its resonance ring: the hollow "tube" tone). The short one
          is the muffler / resonator (a metallic edge). Pipe length is fixed, so the resonances stay put while the rpm moves,
          which is what makes a recognisable engine rather than a buzzing note.
       4. Throttle opens the output low-pass (open throttle = bright, closed = muffled) and a body resonance adds the boom.
       5. Intake roar: noise that pulses with each firing. Valve-train ticks. Straight-cut gearbox whine. Turbo whistle.
       6. Overrun (throttle closed at revs): anti-lag pops and crackles are injected into the pipe, so they ring like real bangs.
     render(out, n, P) fills n samples. P (block constants, set from the game each frame):
       rpm, load 0..1, cut 0..1 (ignition cut: shifts, limiter), crackle 0..1 (pop chance per firing), inside 0..1 (cockpit mix),
       exh (exhaust level), mix (all other layers), whineHz, whineAmp, turboHz, turboAmp */
  class EngineDSP {
    constructor(sr, seed) {
      this.sr = sr; this.seed = (seed || 12345) | 0;
      this.rpm = 1000; this.load = 0; this.inside = 0; this.cut = 0; this.exh = 1; this.mix = 1;
      this.kR = 1 - Math.exp(-1 / (0.010 * sr)); this.kL = 1 - Math.exp(-1 / (0.035 * sr)); this.kS = 1 - Math.exp(-1 / (0.12 * sr));
      this.cyc = 0; this.slot = -1;
      this.eD = 0; this.eA = 0;                                   // firing pulse: difference of two decaying states
      this.dD = Math.exp(-1 / (0.0016 * sr)); this.dA = Math.exp(-1 / (0.00028 * sr));
      this.cylAmp = [1.0, 0.8, 0.93, 0.74]; this.cylBias = [0, 0.0004, -0.0003, 0.0007];
      this.n1 = Math.round(0.0071 * sr); this.n2 = Math.round(0.00205 * sr);       // pipe (7.1 ms ~ 1.2 m of tube round trip) and muffler (2 ms)
      this.b1 = new Float32Array(this.n1 + 2); this.b2 = new Float32Array(this.n2 + 2); this.i1 = 0; this.i2 = 0;
      this.l1 = 0; this.l2 = 0;                                   // damping low-pass states inside the loops
      this.popA = 0; this.popD = 0.99; this.popLP = 0; this.burst = 0; this.burstT = 0; this.crack = 0; this.big = 0;
      this.nLP1 = 0; this.nLP2 = 0; this.iLP = 0; this.iHP = 0; this.tick = 0; this.tickHP = 0;
      this.oLP1 = 0; this.oLP2 = 0; this.inLP = 0; this.dc = 0; this.dc2 = 0;
      this.wPh = 0; this.tPh = 0; this.wF = 300; this.tF = 2000; this.wA = 0; this.tA = 0;
      this.bq = this.peak(sr, 105, 1.0, 6);                       // body / muffler boom
      this.bq2 = this.peak(sr, 260, 1.4, 3);
      this.pk = 0;
    }
    // RBJ peaking filter coefficients + state, as a plain object
    peak(sr, f, q, db) {
      const A = Math.pow(10, db / 40), w = 2 * Math.PI * f / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w);
      const a0 = 1 + al / A;
      return { b0: (1 + al * A) / a0, b1: -2 * c / a0, b2: (1 - al * A) / a0, a1: -2 * c / a0, a2: (1 - al / A) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
    }
    rnd() { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x; return (x >>> 0) / 4294967296; }
    startPop(strength) {
      this.popA = strength * (0.5 + this.rnd());
      this.big = strength > 1.2 ? 1 : 0;
      this.popD = Math.exp(-1 / ((this.big ? 0.03 + this.rnd() * 0.03 : 0.004 + this.rnd() * 0.012) * this.sr));
      this.crack = 1;
      if (!this.burst && this.rnd() < 0.15) { this.burst = 1 + ((this.rnd() * 3) | 0); this.burstT = (0.015 + this.rnd() * 0.05) * this.sr; }
    }
    fire(P) {
      const s = this.slot, L = this.load;
      let a;
      if (this.rnd() < this.cut) a = 0.03;                        // ignition cut: nearly nothing
      else a = this.cylAmp[s] * (0.88 + this.rnd() * 0.24) * (0.17 + 0.83 * Math.pow(L, 0.75));
      a *= this.exh;                                              // Engine B turns the firing pulses down; pops and crackle stay
      this.eD += a; this.eA += a * (1 + this.cylBias[s] * 300);
      this.tick = 0.6 + this.rnd() * 0.4;
      if (P.crackle > 0 && this.rnd() < P.crackle) this.startPop(this.rnd() < 0.03 ? 1.5 : 0.4);
    }
    render(out, n, P) {
      const sr = this.sr, TAU = 2 * Math.PI;
      const rpmT = P.rpm, loadT = P.load, insT = P.inside || 0;
      const exhG = P.exh == null ? 1 : P.exh, mixG = P.mix == null ? 1 : P.mix;
      const rn = Math.min(1, rpmT / 7400);
      const bright = 0.04 + 0.30 * this.load + 0.18 * rn;       // output low-pass coefficient base (one-pole)
      const g1 = -0.55, g2 = 0.38;
      for (let i = 0; i < n; i++) {
        this.rpm += (rpmT - this.rpm) * this.kR; this.load += (loadT - this.load) * this.kL;
        this.inside += (insT - this.inside) * this.kS; this.cut += ((P.cut || 0) - this.cut) * 0.02;
        this.wF += (P.whineHz - this.wF) * 0.002; this.wA += ((P.whineAmp || 0) - this.wA) * 0.001;
        this.tF += (P.turboHz - this.tF) * 0.002; this.tA += ((P.turboAmp || 0) - this.tA) * 0.001;
        this.exh += (exhG - this.exh) * 0.002; this.mix += (mixG - this.mix) * 0.002;
        this.cyc += this.rpm / 120 / sr; if (this.cyc >= 1) this.cyc -= 1;
        const sl = (this.cyc * 4) | 0;
        if (sl !== this.slot) { this.slot = sl; this.fire(P); }
        this.eD *= this.dD; this.eA *= this.dA;
        let u = this.eD - this.eA;                                 // the firing pulse train
        const white = this.rnd() * 2 - 1;
        // combustion hiss rides on the pulse when the throttle is open
        u += white * Math.max(0, u) * 0.35 * this.load;
        // pops and crackle (overrun): injected into the pipe so they ring in it
        let direct = 0;
        if (this.burst > 0 && --this.burstT <= 0) { this.burst--; this.burstT = (0.02 + this.rnd() * 0.05) * sr; this.startPop(0.5); }
        if (this.popA > 0.001) {
          this.popA *= this.popD;
          this.popLP += (white - this.popLP) * (this.big ? 0.25 : 0.5);
          const bang = this.popLP * this.popA * 3.8 * 0.6;
          u += bang; direct += this.crack * white * this.popA * this.popA * (this.big ? 1.0 : 1.2);
        } else this.crack = 0;
        // exhaust pipe (inverting, damped) then muffler (non-inverting, damped)
        const i1 = this.i1, i2 = this.i2;
        let r = this.b1[i1]; this.l1 += (r - this.l1) * 0.55;
        const y1 = u + g1 * this.l1; this.b1[i1] = y1; this.i1 = i1 + 1 >= this.n1 ? 0 : i1 + 1;
        let r2 = this.b2[i2]; this.l2 += (r2 - this.l2) * 0.5;
        const y2 = y1 + g2 * this.l2; this.b2[i2] = y2; this.i2 = i2 + 1 >= this.n2 ? 0 : i2 + 1;
        let ex = 0.55 * u + 0.45 * y2;
        // body resonances
        let b = this.bq, v = b.b0 * ex + b.b1 * b.x1 + b.b2 * b.x2 - b.a1 * b.y1 - b.a2 * b.y2; b.x2 = b.x1; b.x1 = ex; b.y2 = b.y1; b.y1 = v;
        b = this.bq2; ex = b.b0 * v + b.b1 * b.x1 + b.b2 * b.x2 - b.a1 * b.y1 - b.a2 * b.y2; b.x2 = b.x1; b.x1 = v; b.y2 = b.y1; b.y1 = ex;
        // throttle opens the tone; two poles = a gentle muffler roll-off
        this.oLP1 += (ex - this.oLP1) * bright; this.oLP2 += (this.oLP1 - this.oLP2) * (bright * 1.3 > 0.9 ? 0.9 : bright * 1.3);
        let exh = this.oLP2 * 2.2 + direct * 0.5 * (0.5 + 0.5 * this.load) * (1 - 0.65 * this.inside);
        // cockpit: the exhaust arrives muffled through the bulkhead
        this.inLP += (exh - this.inLP) * 0.05; exh += (this.inLP * 0.8 - exh) * this.inside * 0.75;
        this.dc += (exh - this.dc) * 0.003; exh -= this.dc;        // block DC from the unipolar pulses
        // intake roar: band-limited noise, pulsing with the firings, loud on open throttle
        this.nLP1 += (white - this.nLP1) * (0.10 + 0.25 * rn); this.nLP2 += (this.nLP1 - this.nLP2) * 0.02;
        const band = this.nLP1 - this.nLP2;
        const pulse = 0.55 + 0.45 * Math.min(1, this.eD);
        const intake = band * pulse * (0.10 + 0.90 * this.load) * (0.1 + rn * rn * 1.3) * (0.7 + 1.9 * this.inside);
        // valve-train / injector tick (only really audible in the cockpit)
        this.tick *= 0.985; this.tickHP += (white - this.tickHP) * 0.6;
        const tk = (white - this.tickHP) * this.tick * this.tick * 0.05 * (0.3 + rn) * (0.4 + 2.5 * this.inside);
        // gearbox whine (straight-cut gears) and turbo
        this.wPh += TAU * this.wF / sr; if (this.wPh > TAU) this.wPh -= TAU;
        this.tPh += TAU * this.tF / sr; if (this.tPh > TAU) this.tPh -= TAU;
        const whine = (Math.sin(this.wPh) + 0.45 * Math.sin(this.wPh * 2) + 0.18 * Math.sin(this.wPh * 3)) * this.wA * (0.3 + 1.8 * this.inside);
        const turbo = (Math.sin(this.tPh) * 0.8 + band * 6 * this.tA * 8 + Math.sin(this.tPh * 1.5) * 0.15) * this.tA * (0.6 + 1.2 * this.inside);
        let o = exh * 0.62 + (intake + tk + whine + turbo) * this.mix;
        out[i] = Math.tanh(o * 1.25) * 0.8;
      }
    }
  }
