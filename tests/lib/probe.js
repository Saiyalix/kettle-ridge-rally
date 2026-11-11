  /* ---- QA probe: added by tests/lib/game.js to a temporary copy of index.html (never to the real file) ---- */
  window.__probe = (() => {
    // Autopilot: aims at a point down the road and picks a speed from the curvature ahead, pressing the same
    // keys a player would (gas, brake, left, right; never the handbrake). Fixed on purpose: if its time
    // changes, the game changed, not the bot.
    function botKeys() {
      const p = P[progIdx], v = car.speed,
        // aim by the direction the car is travelling (not the nose): in a slide the nose points inside the corner
        th = v > 5 ? Math.atan2(car.vel.x, car.vel.z) : Math.atan2(car.fwd.x, car.fwd.z);
      const t = P[Math.min(P.length - 1, progIdx + Math.round((5 + v * 0.45) / track.step))];
      let err = Math.atan2(t.x - car.pos.x, t.z - car.pos.z) - th;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      let km = 0; const reach = Math.round((12 + v * 1.6) / track.step);
      for (let j = progIdx; j < Math.min(P.length, progIdx + reach); j++) km = Math.max(km, Math.abs(curvS[j]));
      const SA = CONFIG.arcade.surfaces[p.surface] || CONFIG.arcade.surfaces.gravel;
      const target = km > 1e-4 ? Math.sqrt(SA.maxG * 9.81 * 0.85 / km) : 99;
      keys.left = err > 0.035; keys.right = err < -0.035;      // heading angle grows towards the car's left
      keys.up = v < target; keys.down = v > target + 4; keys.hb = false;
    }
    const lateral = () => { const p = P[progIdx]; return (car.pos.x - p.x) * -Math.cos(p.th) + (car.pos.z - p.z) * Math.sin(p.th); };

    // Drive the loaded stage start to finish at the fixed physics rate, synchronously (no frames run in between).
    // Random numbers (rival pace, contact kicks) come from a seeded generator, so a run repeats exactly.
    // Results depend a little on what ran earlier in the same page (state the game keeps between runs),
    // so the tests open a fresh page for every stage + car run. Same sequence, same numbers.
    function driveStage(carIndex, maxSeconds = 400) {
      const sysRandom = Math.random;
      Math.random = mulberry32(1000 + stageIdx * 10 + carIndex);
      const prevCar = CONFIG.carIndex; CONFIG.carIndex = carIndex;
      const out = { stage: stageIdx, stageName: ST.name, car: CONFIG.cars[carIndex].name, offRoadS: 0, driftS: 0,
        maxKmh: 0, maxHeldSlideDeg: 0, spins: 0, rescues: 0, timedOut: false };
      try {
        for (const r of rivals) r.dust = 0;                       // rival dust draws random numbers: same start every run
        champ = null; startStage(null); state = 'running'; countdown = -1; timeLeft = 1e9;
        let goodS = startS, stuck = 0, spun = false;
        while (state === 'running') {
          botKeys(); physicsStep();
          const lat = Math.abs(lateral()), sl = Math.abs(car.beta * 57.2958);
          if (lat > half + 0.5) out.offRoadS += H; else if (car.grounded > 0) goodS = P[progIdx].s;
          if (car.drift) out.driftS += H;
          if (!car.drift && car.grounded >= 0.5 && car.speed > 8) out.maxHeldSlideDeg = Math.max(out.maxHeldSlideDeg, sl);
          out.maxKmh = Math.max(out.maxKmh, car.speed * 3.6);
          if (sl > 90 && !spun) { out.spins++; spun = true; } else if (sl < 30) spun = false;
          stuck = (car.speed < 1.5 || car.up.y < 0.35 || lat > half + 8) ? stuck + H : 0;
          if (stuck > 2.5 || car.pos.y < P[progIdx].y - 6) { placeAt(Math.max(startS, goodS - 4), 8); out.rescues++; stuck = 0; }
          if (raceTime > maxSeconds) { out.timedOut = true; state = 'gameover'; }
        }
        out.time = raceTime;
        out.finished = !out.timedOut && P[progIdx].s >= track.finishS - 1;
        out.clock = ST.timeStart + ST.timeExt.reduce((a, b) => a + b, 0);
        // seconds left on the stage clock when each checkpoint (and the finish) was reached, before its bonus time is added
        let allowed = ST.timeStart; out.margins = [];
        splits.forEach((t, i) => { out.margins.push(allowed - t); allowed += ST.timeExt[i]; });
        out.margins.push(allowed - out.time);
        out.minMarginS = Math.min(...out.margins);
      } finally {
        for (const k in keys) keys[k] = false;
        Math.random = sysRandom; CONFIG.carIndex = prevCar;
        goMenu(); applyLivery();
      }
      return out;
    }
    async function loadStageAndWait(i) {
      await loadStage(i);
      while (loading || stageIdx !== i) await new Promise(r => setTimeout(r, 50));
    }
    return { Car, CONFIG, tiltToSteer, autoGasOn, gasStep, /* phone controls (src/handling/physics-step.js), for the skid pad */ driveStage, loadStage: loadStageAndWait, stageCount: STAGES.filter(s => !s.practice).length,   /* practice stages (Test Track) are last and are not bot-tested */ carCount: CONFIG.cars.length };
  })();
