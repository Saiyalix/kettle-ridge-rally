// Ghost (src/tracks/ghost.js): a run is saved on the device, the next run of the same stage + car plays it back,
// the save stays small, and the bot's time does not change because a ghost is there.
'use strict';
const { openGame } = require('./lib/game');

module.exports = async function ghostTest({ browser, base }) {
  const checks = [], g = await openGame(browser, base, { probe: true });
  await g.page.evaluate(() => window.__probe.loadStage(0));
  const r1 = await g.page.evaluate(() => window.__probe.driveStage(0));
  const i1 = await g.page.evaluate(() => window.__probe.ghostInfo());
  const r2 = await g.page.evaluate(() => window.__probe.driveStage(0));       // second run, with the ghost loaded
  const i2 = await g.page.evaluate(() => window.__probe.ghostInfo());
  const errs = g.errors(); await g.ctx.close();
  checks.push({ name: 'ghost: run 1 is saved on the device', pass: i1.loaded && i1.savedChars > 1000, detail: `${i1.savedChars} chars, ${i1.n} samples` });
  checks.push({ name: 'ghost: save is small (≤ 90 KB)', pass: i1.savedChars > 0 && i1.savedChars <= 90000, detail: `${(i1.savedChars / 1024).toFixed(1)} KB for a ${r1.time.toFixed(0)} s stage` });
  checks.push({ name: 'ghost: holds the run (time, route end)', pass: i1.loaded && Math.abs(i1.t - r1.time) < 0.01 && i1.endS > i1.finishS - 25, detail: `time ${i1.t} vs ${r1.time.toFixed(2)}; last sample ${i1.endS && i1.endS.toFixed(0)} m of ${i1.finishS && i1.finishS.toFixed(0)} m` });
  checks.push({ name: 'ghost: plays back on run 2 at the recorded place', pass: i2.loaded && i2.visible && i2.posErr < 0.5 && i2.hiddenWhenOff, detail: `visible ${i2.visible}, off by ${i2.posErr && i2.posErr.toFixed(2)} m, hides when switched off ${i2.hiddenWhenOff}` });
  checks.push({ name: 'ghost: bot time unchanged with a ghost present', pass: Math.abs(r2.time - r1.time) < 0.05 && r2.finished, detail: `${r1.time.toFixed(2)} s -> ${r2.time.toFixed(2)} s` });
  checks.push({ name: 'ghost: no console errors', pass: errs.length === 0, detail: errs.join(' | ') || 'none' });
  return { checks, data: { r1: r1.time, r2: r2.time, i1, i2 } };
};
