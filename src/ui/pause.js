  /* ---------- pause menu, quick restart, graphics quality ---------- */
  let pausedFrom = null;
  // ?gfx=pc (or ?gfx=high) = high graphics for this visit only, never saved, no auto-drop. ?fps=1 = FPS counter only.
  const URLQ = new URLSearchParams(location.search), GFX_PC = /^(pc|high)$/i.test(URLQ.get('gfx') || ''), SHOW_FPS = GFX_PC || URLQ.get('fps') === '1';
  // Default: high everywhere (phones too). A saved choice wins ('rallyQualityV2': what the player picked, or what the auto-drop saved).
  // The old key 'rallyQuality' is only read on non-touch devices: the old code saved 'low' on every phone by itself, so it says nothing about a choice.
  try { const q = localStorage.getItem('rallyQualityV2') || (isTouch ? null : localStorage.getItem('rallyQuality')); quality = q === 'low' ? 'low' : 'high'; } catch (e) { /* ignore */ }
  if (GFX_PC) quality = 'high';
  function togglePause() {
    if (state === 'paused') { state = pausedFrom; pausedFrom = null; $('pauseMenu').hidden = true; canvas.focus(); return; }
    pausedFrom = state; state = 'paused'; for (const kk in keys) keys[kk] = false;
    if (synth) synth.cancel();
    updatePauseLabels(); $('pauseMenu').hidden = false; $('resumeBtn').focus();
  }
  function updatePauseLabels() {
    $('qualityBtn').textContent = 'Graphics: ' + (quality === 'high' ? 'High' : 'Low');
    $('debugBtn').textContent = 'Debug overlay: ' + (debugOn ? 'On' : 'Off');
  }
  function setQuality(q, save = true) {
    quality = q; if (save && !GFX_PC) try { localStorage.setItem('rallyQualityV2', q); } catch (e) { /* ignore */ }
    renderer.shadowMap.enabled = q === 'high'; sun.castShadow = q === 'high';
    scene.traverse(o => { if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) m.needsUpdate = true; });
    resize(); updatePauseLabels();
  }
  function quickRestart() {
    $('pauseMenu').hidden = true; pausedFrom = null;
    startStage(raceOrder); countdown = 2.6;        // short countdown when you restart
  }
  $('resumeBtn').addEventListener('click', togglePause);
  $('restartBtn').addEventListener('click', quickRestart);
  $('qualityBtn').addEventListener('click', () => setQuality(quality === 'high' ? 'low' : 'high'));
  $('debugBtn').addEventListener('click', toggleDebug);
  $('quitBtn').addEventListener('click', () => { $('pauseMenu').hidden = true; pausedFrom = null; goMenu(); });
  $('replayBtn').addEventListener('click', startReplay);
  [['rpPlay', 'Space'], ['rpSlow', 'ArrowDown'], ['rpFast', 'ArrowUp'], ['rpCam', 'KeyC'], ['rpBack', 'Escape']].forEach(([id, code]) => $(id).addEventListener('click', () => { if (state === 'replay') replayKey(code); }));


  /* ---------- automatic fallback: high -> low once if the frame rate stays too low, and the FPS counter ---------- */
  // Thresholds: smoothed frame time over AUTO_GFX.ms (under 25 fps) for AUTO_GFX.holdS seconds in a row, only while driving
  // and after AUTO_GFX.warmS seconds of driving (loading, countdown, shader compile hitches never count).
  // Never switches back up by itself. Off with ?gfx=pc or ?autogfx=0.
  const AUTO_GFX = { ms: 40, holdS: 3, warmS: 4, on: !GFX_PC && URLQ.get('autogfx') !== '0' };
  let agSmooth = 16.7, agSlowS = 0, agRunS = 0, agPrev = 0;
  function autoQualityTick(dtCapped, fakeMs) {
    const nowMs = performance.now(), wall = agPrev ? Math.min(1, (nowMs - agPrev) / 1000) : dtCapped; agPrev = nowMs;   // wall-clock: the game's own dt is capped at 0.1 s, which would stretch the timers when frames are very slow
    const dtReal = wall, ms = fakeMs || wall * 1000;
    if (state !== 'running' || countdown > -0.6) { agSlowS = 0; agRunS = 0; return; }   // not driving (menu, loading, countdown, pause, replay)
    agRunS += dtReal;
    agSmooth += (ms - agSmooth) * 0.05;
    if (!AUTO_GFX.on || quality !== 'high' || agRunS < AUTO_GFX.warmS) { agSlowS = 0; return; }
    agSlowS = agSmooth > AUTO_GFX.ms ? agSlowS + dtReal : 0;
    if (agSlowS >= AUTO_GFX.holdS) {
      setQuality('low'); agSlowS = 0;
      banner('Graphics set to Low', '', 4.5); elBannerSub('for smoother play. Change it in Pause');
    }
  }
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
    fpsBox.textContent = (GFX_PC ? 'PC graphics (' + quality + ')  ' : 'gfx ' + quality + '  ') + fpsSm.toFixed(0) + ' fps  1% low ' + low.toFixed(0) +
      '  |  DPR ' + (window.devicePixelRatio || 1).toFixed(2) + '  render ' + rtColor.width + 'x' + rtColor.height + '  screen ' + innerWidth + 'x' + innerHeight;
  }
