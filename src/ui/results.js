  function showMsg(text, small) {
    if (!text) { elMsg.hidden = true; return; }
    elMsg.hidden = false; elMsg.textContent = text; elMsg.className = 'hud' + (small ? ' small' : '');
  }
  // only the latest split is shown, and it fades out by itself (CSS) after a few seconds
  function renderSplits() {
    elSplits.innerHTML = '';
    if (!splits.length) return;
    const i = splits.length - 1, t = splits[i], li = document.createElement('li');
    const b = best && best.splits && best.splits[i];
    let d = '';
    if (b != null) { const dd = t - b; d = `<span class="d ${dd > 0 ? 'up' : 'down'}">${dd > 0 ? '+' : '−'}${Math.abs(dd).toFixed(2)}</span>`; }
    li.innerHTML = `<span>CP${i + 1} ${fmtTime(t)}</span>${d}`;
    elSplits.appendChild(li);
  }
  function rowsHtml(rows, cols) {
    const fmtGap = (r, lead) => r.time == null ? 'DNF' : r.pos === 1 ? fmtTime(r.time) : '+' + (r.time - lead).toFixed(2);
    const lead = rows[0].time;
    let html = cols === 'stage' ? '<span class="h">#</span><span class="h">Crew</span><span class="h">Time</span><span class="h">Pts</span>' : '<span class="h">#</span><span class="h">Crew</span><span class="h">Points</span><span class="h"></span>';
    rows.forEach((r, k) => {
      const show = k < 10 || r.you; if (!show) return;
      const c = r.you ? ' class="me"' : '';
      if (cols === 'stage') html += `<span${c}>${r.pos || '–'}</span><span${c}>${r.name}</span><span${c}>${fmtGap(r, lead)}</span><span${c}>${r.pts || ''}</span>`;
      else html += `<span${c}>${k + 1}</span><span${c}>${r.name}</span><span${c}>${r.pts}</span><span${c}></span>`;
    });
    return html;
  }
  function showResults(rows, myRow) {
    const champDone = champ && champ.idx >= CHAMP_STAGES - 1;
    if (champ) { rows.forEach(r => { champ.points[r.name] = (champ.points[r.name] || 0) + r.pts; }); champ.results.push({ stage: ST.name, pos: myRow.pos }); }
    let html = '<div class="tbl-title">Stage result</div><div class="classif">' + rowsHtml(rows, 'stage') + '</div>';
    if (champ) {
      const st = standings();
      html += `<div class="tbl-title">${champDone ? 'Final championship standings' : 'Championship standings'}</div><div class="classif">` + rowsHtml(st, 'champ') + '</div>';
      const myRank = st.findIndex(r => r.you) + 1;
      if (champDone) $('bestLine').textContent = myRank === 1 ? `Champion! You won the rally with ${champ.points.You || 0} points.` : `You finished the rally ${ordinal(myRank)} with ${champ.points.You || 0} points. ${st[0].name} won with ${st[0].pts}.`;
      else $('bestLine').textContent += ` You're ${ordinal(myRank)} in the championship and start the next stage ${ordinal(champOrder().indexOf('You') + 1)}.`;
    }
    $('resultTable').innerHTML = ST.practice ? '' : html;
    $('nextBtn').hidden = !(champ && !champDone);
    $('againBtn').hidden = !!(champ && !champDone);
  }
  function finishStage() {
    state = 'finished';
    lastClass = classify(raceTime);
    const me = lastClass.find(r => r.you);
    finishPos = me.pos;
    banner('GOAL!', 'goal', 2.4); elBannerSub(ST.practice ? fmtTime(raceTime) : `${ordinal(finishPos)} on time  ·  ${fmtTime(raceTime)}`);
    cue.goal(); say(finishPos === 1 ? 'Goal! Fastest time!' : 'Goal!', true);
    const isBest = !best || raceTime < best.time;
    const prev = best;
    if (isBest) { best = { time: raceTime, splits: splits.slice() }; try { localStorage.setItem(ST.bestKey, JSON.stringify(best)); } catch (e) { /* storage unavailable */ } }
    const champDone = champ && champ.idx >= CHAMP_STAGES - 1;
    $('resEyebrow').textContent = champ ? (champDone ? `Final stage · ${ST.name}` : `Championship · stage ${champ.idx + 1} of ${CHAMP_STAGES} · ${ST.name}`) : ST.code + ' · ' + ST.name;
    $('resPos').textContent = ordinal(finishPos);
    $('resPos').className = 'big pos' + (finishPos === 1 ? ' p1' : '');
    const lead = lastClass[0];
    $('finalTime').innerHTML = fmtTime(raceTime) + (isBest ? '<span class="pb">BEST</span>' : '') + `<span class="left">${finishPos === 1 ? 'fastest on the stage' : '+' + (raceTime - lead.time).toFixed(2) + ' s to ' + lead.name} · ${me.pts} pts</span>`;
    $('bestLine').textContent = prev ? (isBest ? `Your best time on this stage, ${(prev.time - raceTime).toFixed(2)} s quicker.` : `Your best here is ${fmtTime(best.time)}.`) : 'First time recorded on this stage.';
    if (ST.practice) { $('resPos').textContent = 'Done'; $('resPos').className = 'big pos'; $('finalTime').innerHTML = fmtTime(raceTime) + (isBest ? '<span class="pb">BEST</span>' : '') + '<span class="left">test track · practice only, no points</span>'; }
    showResults(lastClass, me);
    $('againBtn').textContent = ST.practice ? 'Drive again' : 'Race again';
    setTimeout(() => { if (state === 'finished') { $('finishScreen').hidden = false; ($('nextBtn').hidden ? $('againBtn') : $('nextBtn')).focus(); } }, 2400);
  }
  function gameOver() {
    state = 'gameover';
    banner('GAME OVER', 'over', 5); cue.over(); say('Game over. Yeah!', true);
    setTimeout(() => {
      if (state !== 'gameover') return;
      lastClass = classify(null);
      const me = lastClass.find(r => r.you);
      $('resEyebrow').textContent = (champ ? `Championship · stage ${champ.idx + 1} · ${ST.name}` : ST.code + ' · ' + ST.name) + ' · out of time';
      $('resPos').textContent = 'Game over'; $('resPos').className = 'big pos over';
      $('finalTime').innerHTML = `${(Math.min(P[progIdx].s, track.finishS) / 1000).toFixed(2)} km<span class="left">of ${(track.finishS / 1000).toFixed(2)} km · no points</span>`;
      $('bestLine').textContent = 'The clock ran out. Every checkpoint adds time, so carry speed through the corners and keep it on the road.';
      showResults(lastClass, me);
      if (champ) { $('nextBtn').hidden = champ.idx >= CHAMP_STAGES - 1; $('againBtn').hidden = !$('nextBtn').hidden; }
      $('againBtn').textContent = 'Try again';
      $('finishScreen').hidden = false; (!$('nextBtn').hidden ? $('nextBtn') : $('againBtn')).focus();
    }, 2600);
  }

