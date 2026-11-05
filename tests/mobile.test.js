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
  checks.push({ name: 'phone: no console errors', pass: errs.length === 0, detail: errs.length ? errs.slice(0, 5).join(' | ') : '0 errors' });
  await g.ctx.close();
  return checks;
};
