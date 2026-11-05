  /* ---------- sun and lens flare ---------- */
  const flareEl = document.getElementById('flare'), flareParts = [...flareEl.children], _sunV = new THREE.Vector3(), _sunDir = new THREE.Vector3();
  function updateFlare() {
    _sunDir.copy(sunOffset).normalize();
    _sunV.copy(camera.position).addScaledVector(_sunDir, 1000).project(camera);
    let vis = _sunV.z < 1 && Math.abs(_sunV.x) < 1.2 && Math.abs(_sunV.y) < 1.2 && state !== 'menu' && camMode !== 3;
    if (vis) for (let k = 1; k <= 10 && vis; k++) {            // hidden behind a hill?
      const d = k * 28, x = camera.position.x + _sunDir.x * d, z = camera.position.z + _sunDir.z * d;
      if (terrain.heightAt(x, z) + 6 > camera.position.y + _sunDir.y * d) vis = false;
    }
    flareEl.style.opacity = vis ? String(clamp(1.3 - Math.hypot(_sunV.x, _sunV.y) * 0.8, 0, 1)) : '0';
    if (!vis) return;
    const W = window.innerWidth, Hh = window.innerHeight, sx = (_sunV.x * 0.5 + 0.5) * W, sy = (-_sunV.y * 0.5 + 0.5) * Hh;
    [0, 0.45, 0.8, 1.25, 1.7].forEach((t, k) => { const x = sx + (W / 2 - sx) * t * 1.0, y = sy + (Hh / 2 - sy) * t * 1.0; flareParts[k].style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`; });
  }

  /* ---------- analog rev counter: small 220 px canvas (drawn in 440-unit space), redrawn only when the needle moves ---------- */
  const tacho = document.getElementById('tacho'), tg = tacho.getContext('2d');
  let tachoNeedle = 0, tachoDrawn = -1e9;
  function drawTacho(rpm) {
    tachoNeedle += (rpm - tachoNeedle) * 0.35;
    if (Math.abs(tachoNeedle - tachoDrawn) < 25) return;       // nothing visible changed: skip the redraw
    tachoDrawn = tachoNeedle;
    const W = 440, cx = 220, cy = 220, R = 204, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, val = clamp(tachoNeedle / 9000, 0, 1);
    tg.setTransform(tacho.width / W, 0, 0, tacho.width / W, 0, 0);
    tg.clearRect(0, 0, W, W);
    tg.lineCap = 'butt';
    tg.fillStyle = 'rgba(8,14,34,.62)'; tg.beginPath(); tg.arc(cx, cy, R, 0, 7); tg.fill();        // dark face
    tg.strokeStyle = '#e53935'; tg.lineWidth = 18; tg.beginPath(); tg.arc(cx, cy, R - 12, a0 + (a1 - a0) * (7000 / 9000), a1); tg.stroke();   // red zone
    const grd = tg.createLinearGradient(0, W, W, 0); grd.addColorStop(0, '#ffe24a'); grd.addColorStop(1, '#ff7a1a');
    tg.strokeStyle = grd; tg.lineWidth = 26; tg.beginPath(); tg.arc(cx, cy, R - 48, a0, a0 + (a1 - a0) * val); tg.stroke();   // lit arc up to the needle
    tg.font = 'italic 52px "Russo One", "Arial Black", sans-serif'; tg.textAlign = 'center'; tg.textBaseline = 'middle';
    for (let k = 0; k <= 9; k++) {
      const a = a0 + (a1 - a0) * k / 9;
      tg.strokeStyle = k >= 7 ? '#ff5a4a' : '#ffffff'; tg.lineWidth = 8; tg.beginPath(); tg.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); tg.lineTo(cx + Math.cos(a) * (R - 28), cy + Math.sin(a) * (R - 28)); tg.stroke();
      if (k % 2 === 0) { tg.fillStyle = k >= 7 ? '#ff6a5a' : '#ffffff'; tg.fillText(String(k), cx + Math.cos(a) * (R - 92), cy + Math.sin(a) * (R - 92)); }
    }
    const a = a0 + (a1 - a0) * val;
    tg.strokeStyle = '#0d1216'; tg.lineWidth = 20; tg.beginPath(); tg.moveTo(cx, cy); tg.lineTo(cx + Math.cos(a) * (R - 20), cy + Math.sin(a) * (R - 20)); tg.stroke();
    tg.strokeStyle = '#ff2d2d'; tg.lineWidth = 11; tg.beginPath(); tg.moveTo(cx, cy); tg.lineTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22)); tg.stroke();
    tg.fillStyle = '#0d1216'; tg.beginPath(); tg.arc(cx, cy, 20, 0, 7); tg.fill();
  }

  /* ---------- minimap canvas ---------- */
  const mm = document.getElementById('minimap'), mg = mm.getContext('2d');

  /* ---------- HUD refs ---------- */
  const $ = id => document.getElementById(id);
  const elTime = $('time'), elSplits = $('splits'), elSpeed = $('speed'), elGear = $('gear'), elSurf = $('surf'), elRpmNum = $('rpmNum');
  const elPace = $('pace'), elPaceText = $('paceText'), elPaceSub = $('paceSub'), elPaceThen = $('paceThen'), elArrow = $('paceArrow');
  const elMsg = $('msg'), elProg = $('progFill'), elKeys = $('keys');
  const elPos = $('pos'), elClock = $('timeLeft'), elClockBox = $('clock'), elBanner = $('banner');
  const rpmEl = $('rpm');
  const rpmCells = [];

  const ARROWS = {
    L: 'M34 40 V22 a8 8 0 0 0 -8 -8 H12 M19 7 L12 14 L19 21',
    R: 'M14 40 V22 a8 8 0 0 1 8 -8 H36 M29 7 L36 14 L29 21',
    hL: 'M32 42 V18 a10 10 0 0 0 -20 0 V30 M6 24 L12 31 L18 24',
    hR: 'M16 42 V18 a10 10 0 0 1 20 0 V30 M30 24 L36 31 L42 24',
    jump: 'M4 38 H14 L24 18 L34 38 H44 M24 6 V12',
  };

