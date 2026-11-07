  /* ---------- game state ---------- */
  let state = 'menu', raceTime = 0, countdown = 0, progIdx = 0, nextCp = 0, splits = [], lastCpS = 0, stuckTimer = 0, camMode = 0;
  let best = null, fallTimer = 0;
  const startS = 6;
  const loadBest = (st) => { try { return JSON.parse(localStorage.getItem(st.bestKey) || 'null'); } catch (e) { return null; } };
  // arcade state
  let lastBeep = 9, timeLeft = 0, raceOrder = null, finishPos = FIELD, lastClass = null, champ = null, bannerTimer = 0, lastWarn = 99, lastNote = null;
  const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

  /* Co-driver voice: the browser's own speech synthesis reads the pace notes (V toggles it) */
  const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  let voiceOn = true, voice = null;
  try { voiceOn = localStorage.getItem('rallyVoice') !== 'off'; } catch (e) { /* storage unavailable */ }
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    voice = vs.find(v => /en-GB/i.test(v.lang) && /daniel|george|arthur|male/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  if (synth) { pickVoice(); try { synth.addEventListener('voiceschanged', pickVoice); } catch (e) { /* older browsers */ } }
  function say(text, urgent) {
    if (!synth || !voiceOn || muted) return;
    try {
      if (urgent) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 1.12; u.pitch = 0.92; u.volume = 1;
      synth.speak(u);
    } catch (e) { /* speech not available */ }
  }
  function setVoice(on) { voiceOn = on; $('voiceToggle').checked = on; try { localStorage.setItem('rallyVoice', on ? 'on' : 'off'); } catch (e) { /* ignore */ } if (!on && synth) synth.cancel(); }
  function banner(text, kind, secs = 1.6) { elBanner.innerHTML = ''; elBanner.append(text); elBanner.className = 'hud ' + (kind || ''); elBanner.hidden = false; bannerTimer = secs; }
  function elBannerSub(text) { const sp = document.createElement('span'); sp.className = 'sub'; sp.textContent = text; elBanner.appendChild(sp); }

  function placeAt(s, speed = 0) {
    const i = clamp(Math.round(s / track.step), 0, P.length - 2), p = P[i];
    car.reset(p.x, terrain.heightAt(p.x, p.z) + 0.75, p.z, p.th);
    if (speed > 0) { car.vel.set(Math.sin(p.th) * speed, 0, Math.cos(p.th) * speed); for (const w of car.wheels) w.omega = speed / CONFIG.wheels.radius; }
    progIdx = i; fallTimer = 0; stuckTimer = 0; lastGoodS = p.s;
    camInit = false; rallyDir.set(Math.sin(p.th), 0, Math.cos(p.th));    // snap the camera
  }
  function resetToCheckpoint() { placeAt(lastCpS === 0 ? startS : lastCpS + 2); showMsg('', false); }
  // Quick rescue: a short fade, then back on the road just behind the last spot where you were on it,
  // rolling at a sensible speed so you lose a second or two rather than the whole section
  let lastGoodS = 0, lastGoodSpeed = 0, rescueAt = null, rescueTimer = 0;
  const fadeEl = $('fade');
  function rescue(back, keepSpeed) {
    if (rescueAt) return;
    rescueAt = { s: Math.max(startS, lastGoodS - back), v: keepSpeed ? clamp(lastGoodSpeed * 0.6, 0, 14) : 0 };
    rescueTimer = 0.2; fadeEl.classList.add('on');
  }
  function stepRescue(dt) {
    if (!rescueAt) return;
    rescueTimer -= dt;
    if (rescueTimer <= 0) { placeAt(rescueAt.s, rescueAt.v); rescueAt = null; fadeEl.classList.remove('on'); showMsg('', false); }
  }
  function startStage(order) {
    if (loading || !track) return;
    raceOrder = ST.practice ? ['You'] : order || defaultOrder();       // practice stage: no other crews
    initAudio(); if (audio && audio.ctx.state === 'suspended') audio.ctx.resume();
    $('menu').hidden = true; $('finishScreen').hidden = true; document.body.classList.remove('menu-mode');
    placeAt(startS); raceTime = 0; nextCp = 0; splits = []; lastCpS = 0; countdown = 3.6; lastBeep = 9;
    timeLeft = ST.timeStart; lastWarn = 99; lastNote = null; elBanner.hidden = true;
    rec = []; recTick = 0; $('pauseMenu').hidden = true;
    setupRivals(raceOrder);
    state = 'countdown'; renderSplits();
    const slot = raceOrder.indexOf('You') + 1;
    showMsg('', false); banner(ST.practice ? 'START' : `START  #${slot}`, 'ext', 3.2);
    elBannerSub(ST.practice ? 'Test track: no clock, no rivals' : `${slot - 1} crews ahead of you on the road, one every ${START_GAP} s`);
    canvas.focus();
  }
  function goMenu() {
    state = 'menu'; showMsg('', false); champ = null; elBanner.hidden = true;
    $('pauseMenu').hidden = true; $('replayBar').hidden = true; document.body.classList.remove('replay-mode'); replay = null; pausedFrom = null;
    if (synth) synth.cancel();
    $('finishScreen').hidden = true; $('menu').hidden = false; document.body.classList.add('menu-mode');
    placeAt(startS); raceTime = 0; splits = []; renderSplits();
    setupRivals(null);
    renderMenu();
    const sel = document.querySelector('.stage-card[aria-selected="true"]'); if (sel) sel.focus();
  }
  function startChampionship() {
    if (loading) return;
    champ = { idx: 0, points: {}, results: [] };
    menuSel = 0;
    loadStage(0).then(() => startStage(null));
  }
  function nextChampStage() {
    if (!champ || loading) return;
    champ.idx++; menuSel = champ.idx;
    $('finishScreen').hidden = true;
    loadStage(champ.idx).then(() => startStage(champOrder()));
  }
  // championship start order: the leader on points starts first
  function champOrder() {
    const names = ['You', ...rivals.map(r => r.name)];
    return names.sort((a, b) => (champ.points[b] || 0) - (champ.points[a] || 0) || (a === 'You' ? 7.5 : DRIVERS.indexOf(a)) - (b === 'You' ? 7.5 : DRIVERS.indexOf(b)));
  }
  function standings() {
    return ['You', ...rivals.map(r => r.name)].map(n => ({ name: n, pts: champ.points[n] || 0, you: n === 'You' })).sort((a, b) => b.pts - a.pts);
  }
  $('startBtn').addEventListener('click', () => { champ = null; startStage(null); });
  $('champBtn').addEventListener('click', startChampionship);
  $('againBtn').addEventListener('click', () => startStage(raceOrder));
  $('nextBtn').addEventListener('click', nextChampStage);
  $('menuBtn').addEventListener('click', goMenu);
  $('voiceToggle').addEventListener('change', e => setVoice(e.target.checked));

