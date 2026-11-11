// (e) Graphics quality on phones: default High, saved choice wins, automatic drop to Low when the frame rate stays low.
// The container has no GPU, so slow frames are faked: window.__fakeFrameMs (read by autoQualityTick in src/ui/pause.js) replaces the measured frame time.
'use strict';
const { openGame } = require('./lib/game');

module.exports = async function gfxTest({ browser, base, expected }) {
  const checks = [], V = expected.mobile.viewport;
  const phone = (extra) => openGame(browser, base, Object.assign({ viewport: V, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, extra));
  const q = (g) => g.page.evaluate(() => { const b = document.getElementById('qualityBtn'); return { label: b.textContent, saved: localStorage.getItem('rallyQualityV2'), banner: document.getElementById('banner').hidden ? '' : document.getElementById('banner').textContent }; });
  // start and wait until the countdown is over (the message shows GO, then clears); the software renderer is slow, so wait on the game, not on a clock
  const startRace = async (g) => { await g.page.tap('#startBtn'); await g.page.waitForFunction(() => document.getElementById('msg').textContent === 'GO', null, { timeout: 90000, polling: 100 }); await g.page.waitForFunction(() => document.getElementById('msg').hidden, null, { timeout: 30000, polling: 100 }); };
  const pauseLabel = async (g) => { await g.page.keyboard.press('Escape'); const r = await q(g); await g.page.keyboard.press('Escape'); return r; };

  // 1. default on a phone = High; fast frames never drop it
  let g = await phone({});
  await startRace(g);
  await g.page.evaluate(() => { window.__fakeFrameMs = 12; });
  await g.page.waitForTimeout(9000);
  let r = await pauseLabel(g);
  checks.push({ name: 'phone default is High and stays High with fast frames', pass: r.label === 'Graphics: High' && !r.saved, detail: `${r.label}, saved=${r.saved}` });

  // 2. slow frames (60 ms) for >3 s while driving: drops to Low once, saves it, shows the toast
  await g.page.evaluate(() => { window.__fakeFrameMs = 60; });
  await g.page.waitForTimeout(2000);
  r = await q(g);
  checks.push({ name: 'auto-drop waits (no drop after 2 s of slow frames)', pass: r.label.endsWith('High') && !r.saved, detail: r.label });
  await g.page.waitForFunction(() => localStorage.getItem('rallyQualityV2') === 'low', null, { timeout: 40000, polling: 200 }).catch(() => {});   // 4 s warm-up after the last pause + 3 s of slow frames
  r = await q(g);
  checks.push({ name: 'auto-drop: slow frames for 3+ s switch to Low, saved, toast shown', pass: r.saved === 'low' && /Graphics set to Low/.test(r.banner), detail: `saved=${r.saved}, banner="${r.banner}"` });
  r = await pauseLabel(g);
  checks.push({ name: 'pause menu shows Graphics: Low after the drop', pass: r.label === 'Graphics: Low', detail: r.label });
  await g.page.evaluate(() => { window.__fakeFrameMs = 12; });
  await g.page.waitForTimeout(5000);
  r = await q(g);
  checks.push({ name: 'never switches back up by itself', pass: r.saved === 'low' && r.label === 'Graphics: Low', detail: r.label });
  await g.ctx.close();

  // 3. saved Low wins on the next start; saved High wins too (no drop would be needed to test that, only the label)
  g = await phone({ storage: { rallyQualityV2: 'low' } });
  r = await pauseLabel(g);
  checks.push({ name: 'saved Low is used on the next start', pass: r.label === 'Graphics: Low', detail: r.label });
  await g.ctx.close();
  g = await phone({ storage: { rallyQuality: 'low' } });
  r = await pauseLabel(g);
  checks.push({ name: 'old automatic "low" from earlier versions does not count as a choice on phones', pass: r.label === 'Graphics: High', detail: r.label });
  await g.ctx.close();

  // 4. loading and countdown never count: slow frames before the GO do not drop it
  g = await phone({});
  await g.page.evaluate(() => { window.__fakeFrameMs = 60; });
  await g.page.tap('#startBtn');
  await g.page.waitForTimeout(3000);
  r = await q(g);
  checks.push({ name: 'slow frames in menu / countdown do not drop to Low', pass: !r.saved, detail: `saved=${r.saved}` });
  await g.ctx.close();

  // 5. ?gfx=pc: always High, never dropped, never saved, FPS counter visible
  g = await phone({ query: 'gfx=pc' });
  await g.page.evaluate(() => { window.__fakeFrameMs = 60; });
  await startRace(g);
  await g.page.waitForTimeout(7000);
  r = await pauseLabel(g);
  const fps = await g.page.evaluate(() => !document.getElementById('fpsBox').hidden);
  checks.push({ name: '?gfx=pc keeps High with slow frames, not saved, FPS counter on', pass: r.label === 'Graphics: High' && !r.saved && fps, detail: `${r.label}, saved=${r.saved}, fps box ${fps}` });
  await g.ctx.close();

  // 6. the pause menu (with the Graphics button) fits the 800x360 screen
  g = await phone({});
  await startRace(g);
  await g.page.keyboard.press('Escape');
  const box = await g.page.evaluate(() => { const b = document.getElementById('qualityBtn').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  checks.push({ name: 'pause menu: Graphics button on screen and at least 40 px high', pass: box.x >= 0 && box.y >= 0 && box.x + box.w <= V.width && box.y + box.h <= V.height && box.h >= 40, detail: `${box.w.toFixed(0)}x${box.h.toFixed(0)} at ${box.x.toFixed(0)},${box.y.toFixed(0)}` });
  await g.ctx.close();
  return checks;
};
