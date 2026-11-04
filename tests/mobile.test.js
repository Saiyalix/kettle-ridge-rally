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
  const need = ['.tc-steer#1', '.tc-steer#2', '.tc-brake', '.tc-hb'];
  const missing = need.filter(n => !touch.find(r => r.name === n));
  checks.push({ name: 'race: touch controls present', pass: missing.length === 0 && touch.filter(r => r.name.startsWith('.tc-mini')).length === 3,
    detail: missing.length ? 'missing ' + missing.join(', ') : touch.map(r => r.name).join(', ') });
  const off = touch.filter(r => !inside(r)).map(r => r.name);
  checks.push({ name: 'race: touch controls on screen', pass: off.length === 0, detail: off.length ? off.join(', ') : 'ok' });
  const small = touch.filter(r => Math.min(r.w, r.h) < expected.mobile.minTouchPx).map(r => `${r.name} ${r.w.toFixed(0)}x${r.h.toFixed(0)}`);
  checks.push({ name: `race: touch targets ≥ ${expected.mobile.minTouchPx} px`, pass: small.length === 0, detail: small.length ? small.join(', ') : 'ok' });
  const to = pairs(touch);
  checks.push({ name: 'race: touch controls do not overlap each other', pass: to.length === 0, detail: to.length ? to.join(', ') : 'ok' });
  const hud = await rectsOf(g.page, ['#timing', '#clock', '#mapwrap', '#dash']);
  const th = []; for (const a of touch) for (const b of hud) if (overlap(a, b)) th.push(`${a.name} × ${b.name}`);
  checks.push({ name: 'race: touch controls do not overlap the HUD', pass: th.length === 0, detail: th.length ? th.join(', ') : 'ok' });
  const errs = g.errors();
  checks.push({ name: 'phone: no console errors', pass: errs.length === 0, detail: errs.length ? errs.slice(0, 5).join(' | ') : '0 errors' });
  await g.ctx.close();
  return checks;
};
