  /* ---------- per-frame visuals and HUD ---------- */
  let lastHud = {}, callAhead = 120, mmTick = 0;
  function setText(el, key, v) { if (lastHud[key] !== v) { lastHud[key] = v; el.textContent = v; } }

  /* FPS counter: smoothed fps and the 1 % low (the slowest 1 % of frames) over the last ~10 s; text refreshed 2x a second */
  const fpsBox = $('fpsBox'), fpsDt = [], fpsT = [];
  let fpsPrev = 0, fpsSm = 0, fpsTxt = 0;
  if (SHOW_FPS) fpsBox.hidden = false;
  function fpsTick(now) {
    if (fpsPrev) {
      const d = now - fpsPrev; fpsDt.push(d); fpsT.push(now);
      while (fpsT.length && now - fpsT[0] > 10000) { fpsT.shift(); fpsDt.shift(); }
      fpsSm = fpsSm ? fpsSm * 0.95 + (1000 / d) * 0.05 : 1000 / d;
    }
    fpsPrev = now;
    if (now - fpsTxt < 500 || fpsDt.length < 5) return;
    fpsTxt = now;
    const s = fpsDt.slice().sort((a, b) => b - a), low = 1000 / s[Math.floor(s.length * 0.01)];
    const dpr = window.devicePixelRatio || 1, rw = rtColor.width, rh = rtColor.height;
    fpsBox.textContent = (GFX_PC ? 'PC graphics (' + quality + ')  ' : 'gfx ' + quality + '  ') + fpsSm.toFixed(0) + ' fps  1% low ' + low.toFixed(0) +
      '  |  DPR ' + dpr.toFixed(2) + '  render ' + rw + 'x' + rh + '  screen ' + innerWidth + 'x' + innerHeight;
  }
  function updateVisuals(dt) {
    carGroup.position.copy(vPos); carGroup.quaternion.copy(vQ);
    // visual weight (handling): the body leans, dips and squats on its wheels (car.vis, from the physics); level in replays
    const vb = state === 'replay' ? null : car.vis;
    bodyRoot.rotation.set(vb ? vb.pitch : 0, 0, vb ? vb.roll : 0); bodyRoot.position.y = vb ? vb.heave : 0;
    car.wheels.forEach((w, i) => {
      const wm = wheelMeshes[i];
      wm.steerG.position.set(w.local.x, w.local.y - w.susp, w.local.z);
      wm.steerG.rotation.y = w.front ? -car.steer : 0;
      wm.spinG.rotation.x = w.spin;
      // dust from loose surfaces
      if (!w.contact) return;
      const surf = CONFIG.surfaces[w.surface];
      if (!surf.dust) return;
      // dust grows with the slide; the rears also throw gravel chips out behind and to the outside of the slide
      const slide = Math.abs(Math.sin(car.beta)) * car.speed;
      const intensity = Math.min(1, Math.abs(w.vLong) * 0.022 + w.slipSpeed * 0.07 + slide * 0.04);
      const sideX = car.right.x * Math.sign(car.beta), sideZ = car.right.z * Math.sign(car.beta);   // the way the car is sliding
      emitAcc[i] += dt * intensity * 70;
      while (emitAcc[i] > 1) {
        emitAcc[i] -= 1;
        const jx = (Math.random() - 0.5) * 0.4, jz = (Math.random() - 0.5) * 0.4, thr = slide * 0.18;
        const c = surf.dust, k = 0.9 + Math.random() * 0.15;
        emit(w.point.x + jx, w.point.y + 0.15, w.point.z + jz,
          -car.vel.x * 0.15 + sideX * thr + (Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 1.2 + slide * 0.04, -car.vel.z * 0.15 + sideZ * thr + (Math.random() - 0.5) * 1.5,
          [c[0] * k, c[1] * k, c[2] * k], 0.6 + intensity * 0.8 + slide * 0.03, 0.9 + Math.random() * 0.9 + slide * 0.04);
      }
      if (!w.front && w.surface !== 'snow' && quality !== 'low') {
        const roost = Math.max(0, w.slipSpeed - 2.5) + slide * 0.5;
        chipAcc[i] += dt * Math.min(40, roost * 3.2);
        while (chipAcc[i] > 1) {
          chipAcc[i] -= 1;
          const c = surf.dust, k = 0.45 + Math.random() * 0.2, back = 3 + Math.random() * 3 + roost * 0.25;
          emit(w.point.x, w.point.y + 0.1, w.point.z,
            car.vel.x * 0.55 - car.fwd.x * back + sideX * (1 + Math.random() * 2.5) * (slide > 2 ? 1 : 0.3) + (Math.random() - 0.5) * 2,
            1.6 + Math.random() * 3.2,
            car.vel.z * 0.55 - car.fwd.z * back + sideZ * (1 + Math.random() * 2.5) * (slide > 2 ? 1 : 0.3) + (Math.random() - 0.5) * 2,
            [c[0] * k, c[1] * k, c[2] * k], 0.1 + Math.random() * 0.08, 0.45 + Math.random() * 0.3, 2);
        }
      }
    });
    updateParticles(dt);

    sun.position.copy(car.pos).add(sunOffset); sun.target.position.copy(car.pos);
    updateFlare();
    sky.position.copy(camera.position);

    // HUD
    const s = P[progIdx].s;
    setText(elTime, 't', fmtTime(raceTime));
    if (state !== 'menu') {
      const onStage = state === 'running' && P[progIdx].s > startS + 15;
      const pos = state === 'finished' ? finishPos : onStage || state === 'gameover' ? racePosition() : (raceOrder ? raceOrder.indexOf('You') + 1 : 8);
      setText(elPos, 'pos', ST.practice ? '-' : String(pos));
      const tl = Math.max(0, timeLeft);
      setText(elClock, 'clk', ST.practice ? '--' : state === 'countdown' ? String(ST.timeStart) : String(Math.ceil(tl - 1e-6)));
      elClockBox.classList.toggle('low', state === 'running' && tl < 10);
      if (state === 'running' && tl < 10 && Math.ceil(tl) !== lastWarn) { lastWarn = Math.ceil(tl); cue.warn(); }
    }
    if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0 && state !== 'gameover') elBanner.hidden = true; }
    setText(elSpeed, 'v', String(Math.round(Math.abs(car.vForward) * 3.6)));
    setText(elGear, 'g', car.gear < 0 ? 'R' : String(car.gear));
    const wsurf = car.wheels.find(w => w.contact);
    setText(elSurf, 'sf', wsurf ? CONFIG.surfaces[wsurf.surface].label : 'Airborne');
    setText(elRpmNum, 'rn', Math.round(car.rpm / 100) * 100 + ' rpm');
    drawTacho(car.rpm);
    // START-GOAL progress bar (updates only when it moves by half a percent) and the keyboard help (first 8 s only)
    const prog = Math.round(clamp((s - startS) / (track.finishS - startS), 0, 1) * 200);
    if (lastHud.pg !== prog) { lastHud.pg = prog; elProg.style.width = (prog / 2) + '%'; }
    const helpOn = state === 'countdown' || (state === 'running' && raceTime < 8);
    if (lastHud.kh !== helpOn) { lastHud.kh = helpOn; elKeys.classList.toggle('gone', !helpOn); }

    // pace notes
    // calls are timed by speed: about 3.4 s before the corner (60–175 m), so there is always time to react
    let note = null, then = null;
    callAhead += (clamp(Math.max(0, car.vForward) * 3.4, 60, 175) - callAhead) * Math.min(1, dt * 2);
    const showAhead = callAhead + 15;
    if (state === 'running') {
      for (let i = 0; i < track.notes.length; i++) {
        const n = track.notes[i];
        if (n.s > s - 4 && n.s - s < showAhead) { note = n; then = track.notes[i + 1]; break; }
        if (n.s - s >= showAhead) break;
      }
    }
    if (note) {
      elPace.hidden = false;
      setText(elPaceText, 'pt', note.text);
      const dist = Math.max(0, Math.round((note.s - s) / 10) * 10);
      setText(elPaceSub, 'ps', dist > 0 ? dist + ' m' : 'now');
      const thenText = then && then.s - note.s < 70 ? 'into ' + then.text.toLowerCase() : '';
      setText(elPaceThen, 'pth', thenText);
      const ak = note.kind === 'jump' ? 'jump' : note.kind === 'hairpin' ? 'h' + note.dir : note.dir;
      if (lastHud.ak !== ak) { lastHud.ak = ak; elArrow.setAttribute('d', ARROWS[ak]); $('paceArrowBack').setAttribute('d', ARROWS[ak]); }
      if (state === 'running' && note !== lastNote && note.s - s < callAhead) { lastNote = note; say(note.text.replace(', careful!', '. Careful!')); }
    } else elPace.hidden = true;

    // minimap
    // on phones (low quality) the minimap is redrawn every other frame
    if (quality !== 'low' || !(mmTick++ & 1)) {
      mg.clearRect(0, 0, 340, 340);
      mg.drawImage(mmBase, 0, 0);
      const mx = mmX(car.pos.x), my = mmY(car.pos.z);
      const ang = Math.atan2(car.fwd.x, car.fwd.z);
      mg.save(); mg.translate(mx, my); mg.rotate(ang + Math.PI);
      mg.fillStyle = '#ffffff'; mg.strokeStyle = '#0d1216'; mg.lineWidth = 3;
      mg.beginPath(); mg.moveTo(0, -13); mg.lineTo(9, 10); mg.lineTo(0, 5); mg.lineTo(-9, 10); mg.closePath(); mg.stroke(); mg.fill();
      mg.restore();
    }

    updateCockpit();
    updateAudio(dt);

    // stuck / flipped hint
    if (state === 'running') {
      const dRoad = terrain.distAt(car.pos.x, car.pos.z), dropBelow = P[progIdx].y - car.pos.y;
      if (dRoad < half + 0.4 && car.grounded > 0 && car.up.y > 0.8 && Math.abs(dropBelow) < 2) { lastGoodS = P[progIdx].s; lastGoodSpeed = Math.max(0, car.vForward); }
      if (dropBelow > 4.5 && dRoad > half - 0.5) fallTimer += dt; else fallTimer = 0;     // went over the edge
      if (car.up.y < 0.35 || (car.speed < 1 && dRoad > half + 6 && !keys.up)) stuckTimer += dt; else stuckTimer = 0;
      stepRescue(dt);
      if (fallTimer > 0.9) rescue(4, true);
      else if (fallTimer > 0.25) showMsg('Over the edge!', true);
      else if (stuckTimer > 1.1 && car.up.y < 0.35) rescue(0, false);
      else if (stuckTimer > 0.4 && car.up.y < 0.35) showMsg('Flipped! Back on the road…', true);
      else if (stuckTimer > 1.2) showMsg(isTouch ? 'Tap ↺ to get back on the road' : 'Press R to get back on the road', true);
      else if (elMsg.classList.contains('small')) showMsg('', false);
    }
  }

