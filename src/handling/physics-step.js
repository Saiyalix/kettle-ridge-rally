  /* ---------- fixed-step physics ---------- */
  const H = 1 / CONFIG.physicsHz;
  let smoothGas = 0;
  function physicsStep() {
    const driving = state === 'running';
    const k = n => keys[n] || tapped[n];
    const tGas = driving && (k('up') || (isTouch && autoGas && !k('down'))) ? 1 : 0;
    smoothGas += clamp(tGas - smoothGas, -H * 14, H * 12);
    inp.throttle = smoothGas < 0.02 ? 0 : smoothGas;
    inp.brake = driving && k('down') ? 1 : 0;
    const keySteer = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
    inp.steer = driving ? (keySteer || (isTouch && tiltMode ? tiltSteer : 0)) : 0;
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

