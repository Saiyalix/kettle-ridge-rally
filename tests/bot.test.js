// (b) A scripted bot drives every stage with both cars. Finish time must sit inside the expected window,
// and the run must stay clean: no spins, no rescues, no unrequested drifts, limited time off the road.
'use strict';
const { openGame } = require('./lib/game');

module.exports = async function botTest({ browser, base, expected, record }) {
  const checks = [], E = expected.bot, runs = [];
  const probe = await openGame(browser, base, { probe: true });
  const { stageCount, carCount } = await probe.page.evaluate(() => ({ stageCount: window.__probe.stageCount, carCount: window.__probe.carCount }));
  await probe.ctx.close();
  for (let s = 0; s < stageCount; s++) for (let c = 0; c < carCount; c++) {
    const g = await openGame(browser, base, { probe: true });          // fresh page per run: repeatable numbers
    await g.page.evaluate(i => window.__probe.loadStage(i), s);
    const r = await g.page.evaluate(c => window.__probe.driveStage(c), c);
    const errs = g.errors(); await g.ctx.close();
    runs.push(r);
    const key = `${r.stageName} / ${r.car}`, ref = E.times[key];
    const lo = ref ? ref * (1 - E.windowPct / 100) : null, hi = ref ? ref * (1 + E.windowPct / 100) : null;
    const t = r.time.toFixed(2);
    checks.push({ name: `${key}: finishes`, pass: r.finished && errs.length === 0, detail: r.finished ? `${t} s` : `did not finish (${errs.join(' | ') || 'timed out'})` });
    if (!record) checks.push({ name: `${key}: time in window`, pass: ref != null && r.time >= lo && r.time <= hi,
      detail: ref ? `${t} s, expected ${lo.toFixed(1)}–${hi.toFixed(1)} s (${ref} ±${E.windowPct}%)` : 'no expected time recorded' });
    checks.push({ name: `${key}: beats the stage clock`, pass: r.time < r.clock, detail: `${t} s of ${r.clock} s` });
    checks.push({ name: `${key}: off road ≤ ${E.maxOffRoadS} s`, pass: r.offRoadS <= E.maxOffRoadS, detail: `${r.offRoadS.toFixed(1)} s` });
    checks.push({ name: `${key}: clean run`, pass: r.spins === 0 && r.rescues === 0 && r.unrequestedDrifts === 0,
      detail: `spins ${r.spins}, rescues ${r.rescues}, unrequested drifts ${r.unrequestedDrifts}` });
  }
  return { checks, data: runs };
};
