  /* ---------- per-frame visuals and HUD ---------- */
  let lastHud = {}, callAhead = 120, mmTick = 0;
  function setText(el, key, v) { if (lastHud[key] !== v) { lastHud[key] = v; el.textContent = v; } }

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
      if (w.contact) wheelFx(dt, i, w);                  // trails per surface (art/effects.js)
    });
    updateParticles(dt); updateDamage(dt);

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
    ghostFrame();   // tracks/ghost.js: ghost car + gap line
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
        if (n.s > s - 4 && n.s - s < showAhead + (n.lead || 0)) { note = n; then = track.notes[i + 1]; break; }   // n.lead: tight corners are called earlier (tracks)
        if (n.s - s >= showAhead + 60) break;
      }
    }
    if (note) {
      elPace.hidden = false;
      setText(elPaceText, 'pt', note.text);
      const dist = Math.max(0, Math.round((note.s - s) / 10) * 10);
      setText(elPaceSub, 'ps', dist > 0 ? dist + ' m' : 'now');
      const thenText = then && then.s - note.s < 70 + (then.lead || 0) ? 'into ' + then.text.toLowerCase() : '';
      setText(elPaceThen, 'pth', thenText);
      elPace.classList.toggle('tight', !!note.tight);
      const ak = note.kind === 'jump' ? 'jump' : note.kind === 'hairpin' ? 'h' + note.dir : note.dir;
      if (lastHud.ak !== ak) { lastHud.ak = ak; elArrow.setAttribute('d', ARROWS[ak]); $('paceArrowBack').setAttribute('d', ARROWS[ak]); }
      if (state === 'running' && note !== lastNote && note.s - s < callAhead + (note.lead || 0)) { lastNote = note; say(note.text.replace(', careful!', '. Careful!')); }
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

