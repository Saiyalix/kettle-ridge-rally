// (a) The game loads and starts a stage with no console errors, on a normal desktop window.
'use strict';
const { openGame } = require('./lib/game');

module.exports = async function loadTest({ browser, base, shot }) {
  const checks = [];
  const g = await openGame(browser, base, {});
  checks.push({ name: 'menu loads', pass: true, detail: 'start button enabled' });
  await shot(g.page, 'load-menu.png');
  await g.page.keyboard.press('Enter');                               // Enter = start stage from the menu
  await g.page.waitForTimeout(4500);                                  // countdown
  await g.page.keyboard.down('KeyW'); await g.page.waitForTimeout(3000); await g.page.keyboard.up('KeyW');
  const running = await g.page.evaluate(() => document.body.classList.contains('race-on'));
  checks.push({ name: 'stage starts and drives', pass: running, detail: running ? 'race running after countdown' : 'race did not start' });
  await shot(g.page, 'load-driving.png');
  const errs = g.errors();
  checks.push({ name: 'no console errors', pass: errs.length === 0, detail: errs.length ? errs.slice(0, 5).join(' | ') : '0 errors' });
  // the test probe must still fit into index.html (see tests/lib/game.js)
  const p = await openGame(browser, base, { probe: true });
  const ok = await p.page.evaluate(() => !!window.__probe);
  checks.push({ name: 'test probe attaches', pass: ok && p.errors().length === 0, detail: ok ? 'ok' : 'index.html changed near the end of boot(): update PROBE_ANCHOR in tests/lib/game.js' });
  await g.ctx.close(); await p.ctx.close();
  return checks;
};
