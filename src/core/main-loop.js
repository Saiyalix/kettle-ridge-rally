  /* ---------- main loop ---------- */
  try { const saved = localStorage.getItem('rallyCar'); const k = CONFIG.cars.findIndex(c => c.id === saved); if (k >= 0) CONFIG.carIndex = k; } catch (e) { /* ignore */ }
  applyLivery();
  document.body.classList.add('menu-mode');
  renderMenu();
  let last = performance.now(), acc = 0;
  dbgEl.hidden = !debugOn;
  if (quality === 'low') setQuality('low');
  let raceOn = null;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (SHOW_FPS) fpsTick(now);
    const on = state === 'running' || state === 'countdown';                 // on-screen controls only while racing
    if (on !== raceOn) { raceOn = on; document.body.classList.toggle('race-on', on); }
    if (state === 'countdown') {
      countdown -= dt;
      if (countdown > 0.6) { const n = Math.ceil(countdown - 0.6); showMsg(String(n), false); if (n !== lastBeep) { lastBeep = n; cue.beep(); } }
      else if (countdown > 0) showMsg('GO', false);
      if (countdown <= 0.6 && state === 'countdown') { state = 'running'; cue.go(); }
    } else if (state === 'running' && countdown > -0.6) {
      countdown -= dt; if (countdown <= 0 && elMsg.textContent === 'GO') showMsg('', false);
    }
    if (!track) { requestAnimationFrame(frame); return; }
    let steps = 0;
    if (state === 'replay') { stepReplay(dt); updateViewPose(1); }
    else if (state === 'paused') { updateViewPose(1); }
    else {
      acc += dt;
      while (acc >= H && steps < 12) { physicsStep(); acc -= H; steps++; }
      if (steps >= 12) acc = 0;
      updateViewPose(clamp(acc / H, 0, 1));
    }
    updateDebug(dt, steps);
    updateCamera(dt);
    updateVisuals(dt);
    clouds.position.set(camera.position.x, 0, camera.position.z);
    renderFrame(dt);
    requestAnimationFrame(frame);
  }
  loadStage(0).then(() => requestAnimationFrame(frame));
}
