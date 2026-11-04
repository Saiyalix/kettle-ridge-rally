  /* ---------- main menu: stage cards over a live preview of the selected stage ---------- */
  let menuSel = 0;
  const SURF_CHIP = { tarmac: ['Tarmac', '#7d848a'], gravel: ['Gravel', '#c49a62'], snow: ['Snow', '#e8eef4'], dirt: ['Dirt', '#a8754a'] };
  const stageLen = st => { let L = 0; for (const g of st.segments) L += g[0] === 'S' ? g[1] : g[1] * D2R * g[2]; return L - st.runoff; };
  function renderMenu() {
    const list = $('stageList');
    if (!list.children.length) STAGES.forEach((st, i) => {
      const b = document.createElement('button');
      b.className = 'stage-card'; b.type = 'button'; b.setAttribute('role', 'option'); b.dataset.i = i;
      const chips = [...new Set(st.surfaceChanges.map(c => c[1]))].map(k => `<i style="--c:${SURF_CHIP[k][1]}">${SURF_CHIP[k][0]}</i>`).join('');
      b.innerHTML = `<span class="sc-code">${st.code}</span><span class="sc-name">${st.name}</span>` +
        `<span class="sc-meta">${st.place} · ${(stageLen(st) / 1000).toFixed(2)} km</span><span class="sc-surf">${chips}</span><span class="sc-best"></span>`;
      b.addEventListener('click', () => pickStage(i));
      b.addEventListener('dblclick', () => { pickStage(i); startStage(); });
      list.appendChild(b);
    });
    [...list.children].forEach((b, i) => {
      b.setAttribute('aria-selected', i === menuSel ? 'true' : 'false');
      const bt = loadBest(STAGES[i]);
      b.querySelector('.sc-best').textContent = bt ? 'Best ' + fmtTime(bt.time) : 'No time yet';
    });
    $('stageBlurb').textContent = STAGES[menuSel].blurb;
    const cp = $('carPick');
    if (!cp.children.length) CONFIG.cars.forEach((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'car-chip'; b.setAttribute('role', 'radio');
      b.innerHTML = `<span class="swatch" style="--a:#${c.paint.toString(16).padStart(6, '0')};--b:#${c.stripe.toString(16).padStart(6, '0')}"></span>${c.name}`;
      b.addEventListener('click', () => { CONFIG.carIndex = i; try { localStorage.setItem('rallyCar', c.id); } catch (e) { /* ignore */ } applyLivery(); renderMenu(); });
      cp.appendChild(b);
    });
    [...cp.children].forEach((b, i) => b.setAttribute('aria-checked', i === CONFIG.carIndex ? 'true' : 'false'));
    $('carBlurb').textContent = CONFIG.cars[CONFIG.carIndex].blurb;
    $('voiceToggle').checked = voiceOn;
  }
  function pickStage(i) {
    if (loading) return;
    menuSel = i; renderMenu();
    const b = $('stageList').children[i]; if (b && document.activeElement !== b && document.activeElement && document.activeElement.classList.contains('stage-card')) b.focus();
    loadStage(i);
  }
  function setMenuBusy(on) {
    $('startBtn').disabled = on; $('champBtn').disabled = on;
    $('menuStatus').textContent = on ? 'Building stage…' : '';
  }
  function onStageLoaded() {
    best = loadBest(ST);
    $('stageLbl').textContent = ST.code + ' · ' + ST.name;
    computeCurvature();
    calibrateRivals();
    placeAt(startS);
    for (let k = 0; k < 120; k++) physicsStep();   // let the suspension settle
    setupRivals(null);
    renderMenu();
  }

