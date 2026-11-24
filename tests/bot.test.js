// (b) A scripted bot drives every stage with every car. Finish time must sit inside the expected window,
// and the run must stay clean: no spins (past 90°), no rescues, the clock never runs out between checkpoints, limited time off the road.
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
    checks.push({ name: `${key}: clock holds at every checkpoint`, pass: r.minMarginS > 0,
      detail: `tightest ${r.minMarginS.toFixed(1)} s left (${r.margins.map(m => m.toFixed(0)).join(' / ')} s at checkpoints and finish)` });
    checks.push({ name: `${key}: no spins, no rescues`, pass: r.spins === 0 && r.rescues === 0, detail: `spins ${r.spins}, rescues ${r.rescues}` });
  }
  // rule 5: a car listed in expected.json bot.neverFasterThan must not beat the fastest of the cars named there, on any stage
  for (const [car, others] of Object.entries(E.neverFasterThan || {})) for (const stage of [...new Set(runs.map(r => r.stageName))]) {
    const me = runs.find(r => r.stageName === stage && r.car === car), rest = runs.filter(r => r.stageName === stage && others.includes(r.car));
    if (!me || !rest.length) continue;
    const best = rest.reduce((a, b) => b.time < a.time ? b : a);
    checks.push({ name: `${stage}: ${car} is never faster than ${others.join(' / ')}`, pass: me.time >= best.time,
      detail: `${me.time.toFixed(2)} s vs ${best.time.toFixed(2)} s (${best.car}), ${(me.time - best.time >= 0 ? '+' : '') + (me.time - best.time).toFixed(2)} s` });
  }
  return { checks, data: runs };
};
