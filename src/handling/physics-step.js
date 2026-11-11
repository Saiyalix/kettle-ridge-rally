  /* ---------- fixed-step physics ---------- */
  const H = 1 / CONFIG.physicsHz;
  // pedal state: smoothed gas (0–1), smoothed tilt (°), auto-gas lift left (s), how long the brake has been held (s)
  const pedals = { gas: 0, tilt: 0, lift: 0, brakeS: 0 };
  // gas pedal: a key or auto gas eases the throttle in and out instead of slamming it
  function gasStep(target, dt, pp = pedals) {
    pp.gas += clamp(target - pp.gas, -dt * 14, dt * 12);
    return pp.gas < 0.02 ? 0 : pp.gas;
  }
  // Phone tilt -> steering (CONFIG.arcade.phone): smoothed, a dead zone, gentle around the centre, full lock at tiltFull °.
  // Any part steering goes to the car as it is; keys are always 0 or full.
  function tiltToSteer(deg, dt, pp = pedals) {
    const P = CONFIG.arcade.phone;
    pp.tilt += (deg - pp.tilt) * Math.min(1, dt / P.tiltSmooth);
    const x = clamp((Math.abs(pp.tilt) - P.tiltDead) / (P.tiltFull - P.tiltDead), 0, 1);
    return Math.sign(pp.tilt) * x * (1 - P.tiltCurve + P.tiltCurve * x);
  }
  // Auto gas: the gas stays down unless you brake. A quick brake tap or the handbrake also lifts it for a moment,
  // like a driver on keys would, so the weight goes forward and the tail swings (rule 2). true = gas down.
  function autoGasOn(brakeKey, hbKey, dt, pp = pedals) {
    const P = CONFIG.arcade.phone;
    if (brakeKey) pp.brakeS += dt;
    else if (pp.brakeS > 0) { if (pp.brakeS <= P.tapS) pp.lift = Math.max(pp.lift, P.brakeLift); pp.brakeS = 0; }
    if (hbKey) pp.lift = Math.max(pp.lift, P.handbrakeLift); else pp.lift = Math.max(0, pp.lift - dt);
    return !brakeKey && !hbKey && pp.lift <= 0;
  }
  function physicsStep() {
    const driving = state === 'running';
    const k = n => keys[n] || tapped[n];
    const phoneGas = isTouch && autoGas && autoGasOn(k('down'), k('hb'), H);
    const tGas = driving && (k('up') || phoneGas) ? 1 : 0;
    inp.throttle = gasStep(tGas, H);
    inp.brake = driving && k('down') ? 1 : 0;
    const keySteer = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
    const tiltSteer = isTouch && tiltMode ? tiltToSteer(tiltDeg, H) : 0;
    inp.steer = driving ? (keySteer || tiltSteer) : 0;
    inp.handbrake = driving && !!k('hb');
    for (const t in tapped) tapped[t] = false;
    car.prevPos.copy(car.pos); car.prevQ.copy(car.q);
    if (state === 'finished' || state === 'gameover') { inp.throttle = 0; inp.steer = 0; inp.brake = car.vForward > 1 ? 0.5 : 0; }
    car.step(H, inp, world);
    collideObstacles();
    if (state !== 'menu') { updateRivals(H, raceTime); collideRivals(); }
    if (driving) {
      raceTime += H;
      timeLeft -= H;
      if (timeLeft <= 0) { timeLeft = 0; gameOver(); }
    }
    updateProgress();
    if ((state === 'running' || state === 'finished' || state === 'gameover') && (recTick++ & 1) === 0) recordFrame();
  }

