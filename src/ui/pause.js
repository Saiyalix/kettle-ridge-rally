  /* ---------- pause menu, quick restart, graphics quality ---------- */
  let pausedFrom = null;
  // test switch: ?gfx=pc (or ?gfx=high) = desktop graphics on a phone; never saved. ?fps=1 = FPS counter only.
  const URLQ = new URLSearchParams(location.search), GFX_PC = /^(pc|high)$/i.test(URLQ.get('gfx') || ''), SHOW_FPS = GFX_PC || URLQ.get('fps') === '1';
  try { const q = localStorage.getItem('rallyQuality'); quality = q ? (q === 'low' ? 'low' : 'high') : (isTouch ? 'low' : 'high'); } catch (e) { /* ignore */ }
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
  function setQuality(q) {
    quality = q; if (!GFX_PC) try { localStorage.setItem('rallyQuality', q); } catch (e) { /* ignore */ }
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

