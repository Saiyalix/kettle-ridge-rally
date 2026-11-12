  /* ---------- input ---------- */
  const keys = {};
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'hb' };
  const tapped = {};          // a key pressed and released between two physics steps still counts once
  window.addEventListener('keydown', e => {
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; if (!e.repeat) tapped[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (e.code === 'F1' || e.code === 'Backquote') { e.preventDefault(); if (!e.repeat) toggleDebug(); return; }
    if (e.code === 'Backspace') { e.preventDefault(); if (!e.repeat && state !== 'menu' && state !== 'replay' && !loading) quickRestart(); return; }
    if (state === 'replay') { e.preventDefault(); if (!e.repeat || e.code === 'ArrowLeft' || e.code === 'ArrowRight') replayKey(e.code); return; }
    if (e.repeat) return;
    if ((e.code === 'Escape' || e.code === 'KeyP') && (state === 'running' || state === 'countdown' || state === 'paused')) { togglePause(); return; }
    if (state === 'menu') {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') pickStage((menuSel + STAGES.length - 1) % STAGES.length);
      if (e.code === 'ArrowDown' || e.code === 'KeyS') pickStage((menuSel + 1) % STAGES.length);
    }
    if (e.code === 'KeyR' && (state === 'running')) rescue(2, false);
    if (e.code === 'KeyC') camMode = (camMode + 1) % CAM_MODES;
    if (e.code === 'KeyM') { muted = !muted; if (muted && synth) synth.cancel(); }
    if (e.code === 'KeyV') setVoice(!voiceOn);
    if (e.code === 'Escape' && (state === 'finished' || state === 'gameover')) goMenu();
    if (e.code === 'Enter') {
      if (state === 'menu' && document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      if (state === 'menu') { champ = null; startStage(null); }
      else if ((state === 'finished' || state === 'gameover') && !$('finishScreen').hidden && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) { if (!$('nextBtn').hidden) nextChampStage(); else startStage(raceOrder); }
    }
  });
  window.addEventListener('keyup', e => { if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; e.preventDefault(); } });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const inp = { throttle: 0, brake: 0, steer: 0, handbrake: false };

  /* ---------- touch controls (phones, tablets) ----------
     Left thumb steers with two big buttons, right thumb has gas, brake and handbrake. A thumb can roll from
     one button to its neighbour (left to right, gas to brake) without lifting. GAS = full throttle while held, let go to lift (the default).
     Auto gas is an option (pause menu): it keeps the throttle down unless you brake and hides the GAS button.
     Tilt steering is optional: the phone's gravity sensor gives analogue steering. */
  const isTouch = !!((window.matchMedia && matchMedia('(pointer: coarse)').matches) || (('ontouchstart' in window) && navigator.maxTouchPoints > 0));
  let autoGas = false, tiltMode = 0, tiltDeg = 0, tiltZero = null;       // tiltMode: 0 buttons, 1 tilt, 2 tilt reversed
                                                                          // tiltDeg: phone turned like a wheel, ° from centre (+ = right); physicsStep makes it steering
  // default off (the GAS button). Only an explicit saved 'on' (the player switched it on) keeps auto gas.
  try { autoGas = localStorage.getItem('rallyAutoGas') === 'on'; tiltMode = +(localStorage.getItem('rallyTilt') || 0) || 0; } catch (e) { /* ignore */ }
  function touchLabels() {
    document.body.classList.toggle('autogas', isTouch && autoGas);
    document.body.classList.toggle('tilt', isTouch && tiltMode > 0);
    const g = 'Auto gas: ' + (autoGas ? 'On' : 'Off'), t = 'Steering: ' + ['Buttons', 'Tilt', 'Tilt (reversed)'][tiltMode];
    for (const id of ['autoGasBtn', 'autoGasBtn2']) $(id).textContent = g;
    for (const id of ['tiltBtn', 'tiltBtn2']) $(id).textContent = t;
  }
  function toggleAutoGas() { autoGas = !autoGas; try { localStorage.setItem('rallyAutoGas', autoGas ? 'on' : 'off'); } catch (e) { /* ignore */ } touchLabels(); }
  function cycleTilt() {
    tiltMode = (tiltMode + 1) % 3; tiltZero = null;
    try { localStorage.setItem('rallyTilt', String(tiltMode)); } catch (e) { /* ignore */ }
    tiltSeen = false; tiltWait = 0; document.body.classList.remove('tilt-off');
    if (tiltMode && window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().then(r => { if (r !== 'granted') tiltFail(); }).catch(tiltFail);
    touchLabels();
  }
  // No working tilt sensor (none, or permission refused): show the steer buttons again and say so. The saved setting stays.
  let tiltSeen = false, tiltWait = 0;
  function tiltFail() {
    if (!isTouch || !tiltMode || tiltSeen || document.body.classList.contains('tilt-off')) return;
    document.body.classList.add('tilt-off');
    banner('Tilt not available', '', 4.5); elBannerSub('using buttons');
  }
  setInterval(() => {                                   // 2 s of racing (countdown included) with no usable sensor reading
    if (!isTouch || !tiltMode || tiltSeen) return;
    if (state === 'countdown' || state === 'running') { tiltWait += 0.25; if (tiltWait >= 2) tiltFail(); }
  }, 250);
  if (isTouch) {
    document.body.classList.add('touch');
    const pad = $('touch'), held = new Map();                // finger -> key it is holding
    const group = k => (k === 'left' || k === 'right') ? 'steer' : 'pedal';
    const paint = () => { for (const b of pad.querySelectorAll('[data-key]')) b.classList.toggle('on', !!keys[b.dataset.key]); };
    const setKey = (id, key) => {
      const prev = held.get(id);
      if (prev === key) return;
      if (prev) { held.delete(id); if (![...held.values()].includes(prev)) keys[prev] = false; }
      if (key) { held.set(id, key); if (!keys[key]) tapped[key] = true; keys[key] = true; }
      paint();
    };
    const keyAt = (x, y) => { const el = document.elementFromPoint(x, y); const b = el && el.closest ? el.closest('[data-key]') : null; return b ? b.dataset.key : null; };
    pad.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-key]'); if (!b) return;
      e.preventDefault();
      try { b.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
      setKey(e.pointerId, b.dataset.key);
    });
    window.addEventListener('pointermove', e => {
      if (!held.has(e.pointerId)) return;
      const k = keyAt(e.clientX, e.clientY);
      if (k && group(k) === group(held.get(e.pointerId))) setKey(e.pointerId, k);   // rolling the thumb onto the neighbour
    }, { passive: true });
    const end = e => { if (held.has(e.pointerId)) setKey(e.pointerId, null); };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    window.addEventListener('blur', () => { held.clear(); paint(); });
    pad.addEventListener('contextmenu', e => e.preventDefault());
    $('tcPause').addEventListener('click', () => { if (state === 'running' || state === 'countdown' || state === 'paused') togglePause(); });
    $('tcCam').addEventListener('click', () => { camMode = (camMode + 1) % CAM_MODES; });
    $('tcReset').addEventListener('click', () => { if (state === 'running') rescue(2, false); });
    // tilt: how far the phone is turned like a steering wheel, from the gravity direction across the screen.
    // Measured against the screen's up-down axis too, so it reads the same whether the phone is held upright or
    // leaned back (until it is nearly flat). Dead zone, range and smoothing: CONFIG.arcade.phone, in physicsStep.
    window.addEventListener('devicemotion', e => {
      const a = e.accelerationIncludingGravity; if (!a || a.x == null || a.y == null) return;
      tiltSeen = true;
      const ang = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
      const sx = ang === 90 ? -a.y : (ang === 270 || ang === -90) ? a.y : ang === 180 ? -a.x : a.x;   // gravity along the screen's left-right axis
      const sy = ang === 90 ? a.x : (ang === 270 || ang === -90) ? -a.x : ang === 180 ? -a.y : a.y;   // ...and along its up-down axis
      const deg = Math.atan2(-sx, Math.max(Math.abs(sy), 4.9)) / D2R;
      // re-centre: during the countdown the centre follows how the phone is held (up to 12° off level)
      if (tiltZero === null) tiltZero = 0;
      if (state === 'countdown') tiltZero += (clamp(deg, -12, 12) - tiltZero) * 0.05;
      tiltDeg = (deg - tiltZero) * (tiltMode === 2 ? -1 : 1);
    });
  }
  for (const id of ['autoGasBtn', 'autoGasBtn2']) $(id).addEventListener('click', toggleAutoGas);
  for (const id of ['tiltBtn', 'tiltBtn2']) $(id).addEventListener('click', cycleTilt);
  $('fsBtn').addEventListener('click', () => {
    const el = document.documentElement;
    const done = () => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); };
    try {
      const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
      if (r && r.then) r.then(done).catch(() => { $('fsBtn').textContent = 'Full screen: open the page in its own tab'; });
      else done();
    } catch (e) { $('fsBtn').textContent = 'Full screen: open the page in its own tab'; }
  });
  touchLabels();

