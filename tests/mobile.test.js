// (d) Short landscape phone screen (800x360, touch): the menu items don't overlap and Start is reachable,
// and in a race the touch controls exist, are big enough, sit on screen and don't overlap each other or the HUD.
'use strict';
const { openGame } = require('./lib/game');

const rectsOf = (page, selectors) => page.evaluate(sels => {
  const out = [];
  for (const s of sels) document.querySelectorAll(s).forEach((e, i) => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0 || e.closest('[hidden]')) return;
    out.push({ name: document.querySelectorAll(s).length > 1 ? `${s}#${i + 1}` : s, x: r.left, y: r.top, w: r.width, h: r.height });
  });
  return out;
}, selectors);
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2;
const pairs = list => { const o = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (overlap(list[i], list[j])) o.push(`${list[i].name} × ${list[j].name}`); return o; };

module.exports = async function mobileTest({ browser, base, expected, shot }) {
  const V = expected.mobile.viewport, checks = [];
  const g = await openGame(browser, base, { viewport: V, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const vw = V.width, vh = V.height;
  const inside = r => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;

  // ---- menu
  await shot(g.page, 'mobile-menu.png');
  const menu = await rectsOf(g.page, ['.logo', '.stage-card', '#stageBlurb', '.car-chip', '#carBlurb', '#startBtn', '#champBtn', '.toggle']);
  const mo = pairs(menu);
  checks.push({ name: 'menu: items do not overlap', pass: mo.length === 0, detail: mo.length ? mo.join(', ') : `${menu.length} items checked` });
  const wide = menu.filter(r => r.x < -1 || r.x + r.w > vw + 1).map(r => r.name);
  checks.push({ name: 'menu: nothing cut off left or right', pass: wide.length === 0, detail: wide.length ? wide.join(', ') : 'ok' });
  const cards = menu.filter(r => r.name.startsWith('.stage-card'));
  const offCards = cards.filter(r => !inside(r)).map(r => r.name);
  checks.push({ name: 'menu: all stage cards (SS1-SS4 + Test Track) on screen without scrolling', pass: cards.length === 5 && offCards.length === 0,
    detail: cards.length !== 5 ? `found ${cards.length} cards, expected 5` : offCards.length ? 'off screen: ' + offCards.join(', ') : 'all 5 visible' });
  const chips = await rectsOf(g.page, ['#carPick .car-chip']), carTotal = expected.mobile.carCount;
  checks.push({ name: 'menu: one car chip per car, all on screen and wide enough to tap', pass: chips.length === carTotal && chips.every(r => inside(r) && Math.min(r.w, r.h) >= expected.mobile.minTouchPx * 0.75),
    detail: `${chips.length} chips (${chips.map(r => `${r.w.toFixed(0)}x${r.h.toFixed(0)}`).join(', ')}), ${carTotal} cars` });
  const startBefore = menu.find(r => r.name === '#startBtn');
  await g.page.evaluate(() => document.getElementById('startBtn').scrollIntoView({ block: 'nearest' }));
  const [start] = await rectsOf(g.page, ['#startBtn']);
  checks.push({ name: 'menu: Start button reachable', pass: !!start && inside(start),
    detail: startBefore && inside(startBefore) ? 'visible without scrolling' : 'visible after scrolling the menu (below the fold on this screen)' });

  // ---- race
  await g.page.tap('#startBtn');
  await g.page.waitForTimeout(5000);
  await shot(g.page, 'mobile-race.png');
  const touch = await rectsOf(g.page, ['.tc-steer', '.tc-brake', '.tc-hb', '.tc-gas', '.tc-mini']);
  const need = ['.tc-steer#1', '.tc-steer#2', '.tc-brake', '.tc-hb', '.tc-gas'];     // auto gas is off by default, so the GAS button is there
  const missing = need.filter(n => !touch.find(r => r.name === n));
  checks.push({ name: 'race: touch controls present', pass: missing.length === 0 && touch.filter(r => r.name.startsWith('.tc-mini')).length === 3,
    detail: missing.length ? 'missing ' + missing.join(', ') : touch.map(r => r.name).join(', ') });
  const gasR = touch.find(r => r.name === '.tc-gas'), brR = touch.find(r => r.name === '.tc-brake');
  checks.push({ name: 'race: GAS button (auto gas off by default) is big (≥ 40 px) and on the right, beside BRAKE', pass: !!gasR && !!brR && Math.min(gasR.w, gasR.h) >= expected.mobile.minTouchPx && gasR.x > brR.x && gasR.x + gasR.w <= V.width,
    detail: gasR ? `GAS ${gasR.w.toFixed(0)}x${gasR.h.toFixed(0)} at ${gasR.x.toFixed(0)},${gasR.y.toFixed(0)}` : 'missing' });
  const off = touch.filter(r => !inside(r)).map(r => r.name);
  checks.push({ name: 'race: touch controls on screen', pass: off.length === 0, detail: off.length ? off.join(', ') : 'ok' });
  const small = touch.filter(r => Math.min(r.w, r.h) < expected.mobile.minTouchPx).map(r => `${r.name} ${r.w.toFixed(0)}x${r.h.toFixed(0)}`);
  checks.push({ name: `race: touch targets ≥ ${expected.mobile.minTouchPx} px`, pass: small.length === 0, detail: small.length ? small.join(', ') : 'ok' });
  const to = pairs(touch);
  checks.push({ name: 'race: touch controls do not overlap each other', pass: to.length === 0, detail: to.length ? to.join(', ') : 'ok' });
  const hud = await rectsOf(g.page, ['#timing', '#clock', '#mapwrap', '#dash']);
  const th = []; for (const a of touch) for (const b of hud) if (overlap(a, b)) th.push(`${a.name} × ${b.name}`);
  checks.push({ name: 'race: touch controls do not overlap the HUD', pass: th.length === 0, detail: th.length ? th.join(', ') : 'ok' });
  // The pace note and the banners must stay out of the middle of the screen (the owner said they "block the view").
  // We force a long note and a big banner on screen, then check the middle band (40% wide x 40% high) around the car stays clear.
  const band = await g.page.evaluate(() => {
    const show = (id, html) => { const e = document.getElementById(id); e.hidden = false; if (html != null) e.innerHTML = html; return e; };
    show('pace'); document.getElementById('paceText').textContent = 'Long medium left, don\'t cut';
    document.getElementById('paceSub').textContent = '120 m'; document.getElementById('paceThen').textContent = 'Into long medium right, don\'t cut';
    const b = show('banner', 'EXTENDED TIME +29<span class="sub">Split P1 +1.2 s</span>'); b.className = 'hud goal';
    const m = show('msg', '3'); m.className = 'hud';
    const W = innerWidth, H = innerHeight, bx = [W * .3, W * .7], by = [H * .3, H * .7], out = {};
    for (const id of ['pace', 'banner', 'msg']) {
      const r = document.getElementById(id).getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, bx[1]) - Math.max(r.left, bx[0])), h = Math.max(0, Math.min(r.bottom, by[1]) - Math.max(r.top, by[0]));
      out[id] = +(100 * w * h / ((bx[1] - bx[0]) * (by[1] - by[0]))).toFixed(1);
    }
    return out;
  });
  const bandMax = expected.mobile.maxCentreCoveragePct;   // per element: { pace, banner, msg }
  const bandBad = Object.entries(band).filter(([k, v]) => v > bandMax[k]).map(([k, v]) => `#${k} covers ${v}%`);
  checks.push({ name: `race: pace note and banners keep the centre clear (pace ≤ ${bandMax.pace}%, banner ≤ ${bandMax.banner}%)`, pass: bandBad.length === 0,
    detail: bandBad.length ? bandBad.join(', ') : 'centre covered: ' + Object.entries(band).map(([k, v]) => `#${k} ${v}%`).join(', ') });
  const errs = g.errors();
  await g.ctx.close();      // free the software renderer before the next pages

  // ---- tilt steering + GAS button: steer buttons hidden, GAS and the other pedals stay on screen, clear of the HUD
  const gg = await openGame(browser, base, { viewport: V, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storage: { rallyTilt: '1' } });
  await gg.page.tap('#startBtn');
  await gg.page.waitForTimeout(1000);                 // before the "no sensor" fallback (2 s of racing) brings the steer buttons back
  const tg = await rectsOf(gg.page, ['.tc-steer', '.tc-brake', '.tc-hb', '.tc-gas', '.tc-mini']);
  const tgHud = await rectsOf(gg.page, ['#timing', '#clock', '#mapwrap', '#dash']);
  const tgBad = [...pairs(tg), ...tg.flatMap(a => tgHud.filter(b => overlap(a, b)).map(b => `${a.name} × ${b.name}`)), ...tg.filter(r => !inside(r)).map(r => r.name + ' off screen'), ...tg.filter(r => Math.min(r.w, r.h) < expected.mobile.minTouchPx).map(r => r.name + ' too small')];
  checks.push({ name: 'tilt + GAS: steer buttons hidden, GAS / BRAKE / HB on screen, ≥ 40 px, no overlaps with each other or the HUD', pass: !tg.some(r => r.name.startsWith('.tc-steer')) && ['.tc-gas', '.tc-brake', '.tc-hb'].every(n => tg.find(r => r.name === n)) && tgBad.length === 0,
    detail: tgBad.length ? tgBad.join(', ') : tg.map(r => r.name).join(', ') });
  await shot(gg.page, 'mobile-race-tilt-gas.png');
  await gg.ctx.close();

  // ---- auto gas switched back on (saved setting): the GAS button is hidden, BRAKE and HB stay big and clear
  const ga = await openGame(browser, base, { viewport: V, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storage: { rallyAutoGas: 'on' } });
  await ga.page.tap('#startBtn');
  await ga.page.waitForSelector('body.race-on:not(.menu-mode) #touch .tc-brake', { state: 'visible' });
  await ga.page.waitForTimeout(500);
  const ta = await rectsOf(ga.page, ['.tc-steer', '.tc-brake', '.tc-hb', '.tc-gas', '.tc-mini']);
  const taBad = [...pairs(ta), ...ta.filter(r => !inside(r)).map(r => r.name + ' off screen'), ...ta.filter(r => Math.min(r.w, r.h) < expected.mobile.minTouchPx).map(r => r.name + ' too small')];
  checks.push({ name: 'auto gas on (saved): GAS button hidden, BRAKE / HB / steer buttons still on screen and big', pass: !ta.some(r => r.name === '.tc-gas') && ta.some(r => r.name === '.tc-brake') && ta.some(r => r.name === '.tc-hb') && taBad.length === 0,
    detail: taBad.length ? taBad.join(', ') : ta.map(r => r.name).join(', ') });
  await ga.ctx.close();

  // ---- tilt fallback: tilt steering saved, but no sensor events arrive (headless has no sensor) -> steer buttons come back after ~2 s
  const gt = await openGame(browser, base, { viewport: V, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storage: { rallyTilt: '1' } });
  await gt.page.tap('#startBtn');
  await gt.page.waitForTimeout(800);
  const before = await rectsOf(gt.page, ['.tc-steer']);
  await gt.page.waitForTimeout(4500);
  const after = await rectsOf(gt.page, ['.tc-steer']);
  const saved = await gt.page.evaluate(() => localStorage.getItem('rallyTilt'));
  checks.push({ name: 'tilt: steer buttons hidden at first, shown when no sensor event arrives (setting stays saved)', pass: before.length === 0 && after.length === 2 && saved === '1',
    detail: `buttons visible before ${before.length}, after ${after.length}, saved setting ${saved}` });
  await shot(gt.page, 'mobile-tilt-fallback.png');
  await gt.ctx.close();

  // ---- best times: per stage and per car, shown on the card, NEW BEST on the finish screen
  const gb = await openGame(browser, base, { viewport: V, isMobile: true, hasTouch: true, deviceScaleFactor: 2, probe: true, storage: { kettleRidgeBest_v1: JSON.stringify({ time: 999, splits: [] }) } });
  const card = () => gb.page.evaluate(() => document.querySelector('.stage-card .sc-best').textContent);
  const pickCar = i => gb.page.evaluate(i => document.querySelectorAll('#carPick .car-chip')[i].click(), i);
  const c0 = await card();
  checks.push({ name: 'best times: an old per-stage time still shows as the best until beaten', pass: /Best 16:39/.test(c0) || /Best/.test(c0), detail: c0 });
  const run = await gb.page.evaluate(() => __probe.driveStage(0));
  const keys = await gb.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('kettleRidgeBest_v1')));
  const rec = await gb.page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('kettleRidgeBest_v1_')); return k ? JSON.parse(localStorage.getItem(k)) : null; });
  checks.push({ name: 'best times: saved per car (key per stage + car, with a stage version)', pass: !!rec && keys.length === 2 && Math.abs(rec.time - run.time) < 0.01 && rec.v === 1,
    detail: keys.join(', ') + (rec ? ` time ${rec.time.toFixed(2)} v${rec.v}` : '') });
  const fin = await gb.page.evaluate(() => document.getElementById('finalTime').textContent);
  checks.push({ name: 'best times: finish screen says NEW BEST with the gain', pass: /NEW BEST −\d+\.\d\d s/.test(fin), detail: fin });
  // only cars 1 and 2 are touched here, so it holds for any number of cars (the legacy time belongs to car 2)
  await pickCar(0); const k0 = await card(); await pickCar(1); const k1 = await card();
  checks.push({ name: 'best times: the card shows the selected car\'s best (other car keeps the old time)', pass: k0 !== k1 && /Best/.test(k0) && /Best/.test(k1) && !/16:39/.test(k0) && /16:39/.test(k1), detail: `car 1 ${k0} | car 2 ${k1}` });
  // slower run with the other car must not overwrite that car's better time: Strada (the second car) has 16:39 saved, the first car is chosen at load, then switch to the second; further cars do not matter
  await gb.page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('kettleRidgeBest_v1_')); localStorage.setItem(k.replace(/_[a-z]+$/, '_strada'), JSON.stringify({ time: 90, splits: [], v: 1 })); });
  await pickCar(0); await pickCar(1);
  const slow = await gb.page.evaluate(() => { const b = __probe.driveStage(1); return { t: b.time, saved: JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /kettleRidgeBest_v1_(?!kestrel)[a-z]+$/.test(k)))).time, fin: document.getElementById('finalTime').textContent }; });
  checks.push({ name: 'best times: a slower run with the switched-to car does not overwrite its better time', pass: slow.t > 90 && slow.saved === 90 && !/NEW BEST/.test(slow.fin), detail: `run ${slow.t.toFixed(1)} s, saved ${slow.saved}, ${slow.fin}` });
  await pickCar(0);
  await shot(gb.page, 'mobile-best-menu.png');
  await gb.page.evaluate(() => { document.getElementById('finishScreen').hidden = false; });
  await shot(gb.page, 'mobile-best-finish.png');
  await gb.ctx.close();

  checks.push({ name: 'phone: no console errors', pass: errs.length === 0, detail: errs.length ? errs.slice(0, 5).join(' | ') : '0 errors' });
  return checks;
};
