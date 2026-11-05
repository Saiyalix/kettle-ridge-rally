  /* ---------- debug overlay (F1): frame timing and what the car is doing ---------- */
  let quality = 'high';
  let debugOn = false; try { debugOn = localStorage.getItem('rallyDebug') === 'on'; } catch (e) { /* ignore */ }
  const dbgEl = $('debug'), dbgText = $('dbgText'), dbgCv = $('dbgGraph'), dbgG = dbgCv.getContext('2d');
  const frameTimes = new Float32Array(180); let ftIdx = 0, dbgTextTimer = 0, fpsAvg = 60, lowFpsTime = 0, lowFpsWarned = false;
  function toggleDebug() { debugOn = !debugOn; dbgEl.hidden = !debugOn; try { localStorage.setItem('rallyDebug', debugOn ? 'on' : 'off'); } catch (e) { /* ignore */ } updatePauseLabels(); }
  function updateDebug(dtReal, steps) {
    frameTimes[ftIdx] = dtReal * 1000; ftIdx = (ftIdx + 1) % frameTimes.length;
    fpsAvg += (1 / Math.max(dtReal, 1e-3) - fpsAvg) * 0.05;
    // gentle nudge when the frame rate is too low to drive well
    if (state === 'running' && quality === 'high' && fpsAvg < 40) { lowFpsTime += dtReal; if (lowFpsTime > 5 && !lowFpsWarned) { lowFpsWarned = true; banner('LOW FRAME RATE', 'ext', 3); elBannerSub('Press Esc and switch graphics to Low'); } } else lowFpsTime = 0;
    if (!debugOn) return;
    const W = dbgCv.width, Hh = dbgCv.height;
    dbgG.clearRect(0, 0, W, Hh);
    dbgG.fillStyle = 'rgba(255,255,255,.12)'; for (const ms of [16.7, 33.3]) { const y = Hh - ms / 50 * Hh; dbgG.fillRect(0, y, W, 1); }
    for (let k = 0; k < frameTimes.length; k++) {
      const v = frameTimes[(ftIdx + k) % frameTimes.length], h = Math.min(Hh, v / 50 * Hh);
      dbgG.fillStyle = v > 33.3 ? '#ff4a3a' : v > 20 ? '#ffd21f' : '#5fd38a'; dbgG.fillRect(k * (W / frameTimes.length), Hh - h, W / frameTimes.length, h);
    }
    dbgTextTimer -= dtReal; if (dbgTextTimer > 0) return; dbgTextTimer = 0.1;
    let worst = 0; for (const v of frameTimes) worst = Math.max(worst, v);
    const d = car.dbg, surf = (car.wheels.find(w => w.contact) || {}).surface || 'air';
    dbgText.textContent =
      `FPS ${fpsAvg.toFixed(0)}  worst frame ${worst.toFixed(1)} ms  steps/frame ${steps}  render ${Math.round(rtColor.width)}×${Math.round(rtColor.height)}\n` +
      `speed ${(car.speed * 3.6).toFixed(0)} km/h   slide ${(car.beta * 57.3).toFixed(1)}°   ${d.drift ? 'DRIFT' : 'grip'}   surface ${surf}\n` +
      `steer key ${inp.steer > 0 ? 'R' : inp.steer < 0 ? 'L' : '-'}  wheel ${(car.steerIn * 100).toFixed(0)}%   throttle ${(inp.throttle * 100).toFixed(0)}%  brake ${inp.brake ? 'ON' : '-'}  handbrake ${inp.handbrake ? 'ON' : '-'}\n` +
      `rotation ${(d.yawNow * 57.3).toFixed(0)}°/s  wanted ${(d.yawT * 57.3).toFixed(0)}°/s   grip in use ${(d.gripUse * 100).toFixed(0)}%   engine pull ${(d.traction * 100).toFixed(0)}%\n` +
      `gear ${car.gear}  rpm ${car.rpm.toFixed(0)}   wheels on ground ${car.wheels.filter(w => w.contact).length}/4   distance ${P[progIdx].s.toFixed(0)} m`;
  }

  /* ---------- run recording and replay viewer ---------- */
  // Every run is recorded at 60 Hz: pose, speed, slide, inputs. After the run, "Watch replay" plays it back
  // with pause, frame stepping, slow motion and the telemetry for that moment.
  const REC = 22;   // floats per frame
  let rec = [], recTick = 0, replay = null;
  function recordFrame() {
    rec.push(car.pos.x, car.pos.y, car.pos.z, car.q.x, car.q.y, car.q.z, car.q.w, car.steer, car.speed, car.vForward, car.beta, car.rpm, car.gear,
      inp.steer, inp.throttle, inp.brake, inp.handbrake ? 1 : 0, car.dbg.drift ? 1 : 0, raceTime, P[progIdx].s, car.throttleOut, progIdx);
  }
  function startReplay() {
    if (rec.length < REC * 30) return;
    replay = { prevState: state, f: 0, playing: true, speed: 1, n: rec.length / REC, acc: 0 };
    state = 'replay';
    $('finishScreen').hidden = true; elBanner.hidden = true; showMsg('', false);
    $('replayBar').hidden = false; document.body.classList.add('replay-mode');
    if (synth) synth.cancel();
    applyReplayFrame();
  }
  function stopReplay() {
    if (!replay) return;
    state = replay.prevState; replay = null;
    $('replayBar').hidden = true; document.body.classList.remove('replay-mode');
    $('finishScreen').hidden = false;
  }
  function replayKey(code) {
    if (code === 'Escape' || code === 'Enter') stopReplay();
    else if (code === 'Space') replay.playing = !replay.playing;
    else if (code === 'ArrowLeft') { replay.playing = false; replay.f = Math.max(0, replay.f - 1); applyReplayFrame(); }
    else if (code === 'ArrowRight') { replay.playing = false; replay.f = Math.min(replay.n - 1, replay.f + 1); applyReplayFrame(); }
    else if (code === 'ArrowUp') replay.speed = Math.min(2, replay.speed * 2);
    else if (code === 'ArrowDown') replay.speed = Math.max(0.125, replay.speed / 2);
    else if (code === 'KeyC') camMode = (camMode + 1) % CAM_MODES;
    else if (code === 'Home') { replay.f = 0; applyReplayFrame(); }
  }
  function applyReplayFrame() {
    const o = Math.floor(replay.f) * REC, r = rec;
    car.prevPos.copy(car.pos); car.prevQ.copy(car.q);
    car.pos.set(r[o], r[o + 1], r[o + 2]); car.q.set(r[o + 3], r[o + 4], r[o + 5], r[o + 6]);
    car.steer = r[o + 7]; car.speed = r[o + 8]; car.vForward = r[o + 9]; car.beta = r[o + 10]; car.rpm = r[o + 11]; car.gear = r[o + 12];
    car.throttleOut = r[o + 20]; progIdx = r[o + 21] | 0;
    car.fwd.set(0, 0, 1).applyQuaternion(car.q); car.up.set(0, 1, 0).applyQuaternion(car.q); car.right.crossVectors(car.fwd, car.up);
    car.vel.copy(car.fwd).multiplyScalar(car.vForward);
    for (const w of car.wheels) { w.omega = car.vForward / CONFIG.wheels.radius; w.spin += w.omega / 60; w.slipSpeed = Math.abs(car.beta) * car.speed * 0.6; w.vLong = car.vForward; }
    updateRivals(0, r[o + 18]);
    const t = r[o + 18], steer = r[o + 13];
    $('rpTime').textContent = fmtTime(t) + '  ·  ' + (replay.playing ? (replay.speed === 1 ? 'playing' : replay.speed + '× speed') : 'paused');
    $('rpFill').style.width = (replay.f / (replay.n - 1) * 100).toFixed(1) + '%';
    $('rpTele').textContent = `${(car.speed * 3.6).toFixed(0)} km/h · slide ${(car.beta * 57.3).toFixed(0)}° · ${r[o + 17] ? 'DRIFT' : 'grip'} · ${(r[o + 19]).toFixed(0)} m`;
    $('rpL').classList.toggle('on', steer < 0); $('rpR').classList.toggle('on', steer > 0);
    $('rpGas').style.width = (r[o + 14] * 100).toFixed(0) + '%'; $('rpBrake').classList.toggle('on', r[o + 15] > 0); $('rpHb').classList.toggle('on', r[o + 16] > 0);
  }
  function stepReplay(dt) {
    if (!replay.playing) return;
    replay.f += dt * 60 * replay.speed;
    if (replay.f >= replay.n - 1) { replay.f = replay.n - 1; replay.playing = false; }
    applyReplayFrame();
  }

