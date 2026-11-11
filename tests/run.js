#!/usr/bin/env node
/*
  Kettle Ridge Rally QA test kit. Runs headless (Playwright + Chromium) and prints PASS / FAIL per check.

    node tests/run.js                 all tests
    node tests/run.js handling bot    only these (build, load, bot, handling, mobile)
    node tests/run.js bot --record    store the bot's current times as the expected times (intended changes only)

  Results: tests/results/report.md (also printed), results.json, screenshots.
  Status: PASS, FAIL, or KNOWN (fails, but listed in expected.json "knownIssues"; does not block).
  Exit code 1 if anything is FAIL.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { startServer, launch } = require('./lib/game');

const ALL = ['build', 'load', 'bot', 'handling', 'mobile'];
const args = process.argv.slice(2);
const RECORD = args.includes('--record');
const picked = args.filter(a => ALL.includes(a));
const which = picked.length ? picked : ALL;
const EXPECTED_FILE = path.join(__dirname, 'expected.json');
const OUT = path.join(__dirname, 'results');
const expected = JSON.parse(fs.readFileSync(EXPECTED_FILE, 'utf8'));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { force: true });
  const { server, base } = await startServer();
  const browser = await launch();
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
  const sections = [], data = {};
  const t0 = Date.now();
  for (const name of which) {
    const t = Date.now();
    process.stdout.write(`running ${name}…\n`);
    let checks;
    try {
      const res = await require(`./${name}.test.js`)({ browser, base, expected, record: RECORD, shot });
      checks = Array.isArray(res) ? res : res.checks;
      if (!Array.isArray(res)) data[name] = res.data;
    } catch (e) {
      checks = [{ name: `${name} test ran`, pass: false, detail: String(e && e.message || e).split('\n')[0] }];
    }
    for (const c of checks) {
      const known = expected.knownIssues && expected.knownIssues[c.name];
      c.status = c.pass ? 'PASS' : known ? 'KNOWN' : 'FAIL';
      if (c.pass && known) c.detail += ' (listed as a known issue but passes now: remove it from expected.json)';
      if (known && !c.pass) c.detail += ` — known issue: ${known}`;
    }
    sections.push({ name, checks, seconds: (Date.now() - t) / 1000 });
  }
  await browser.close(); server.close();

  if (RECORD && data.bot) {
    expected.bot.times = Object.fromEntries(data.bot.map(r => [`${r.stageName} / ${r.car}`, Math.round(r.time * 100) / 100]));
    fs.writeFileSync(EXPECTED_FILE, JSON.stringify(expected, null, 2) + '\n');
    process.stdout.write('Recorded bot times in tests/expected.json\n');
  }

  const all = sections.flatMap(s => s.checks);
  const n = st => all.filter(c => c.status === st).length;
  const verdict = n('FAIL') ? 'FAIL' : 'PASS';
  const L = [`# QA report: ${verdict}`, '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${n('PASS')} pass · ${n('FAIL')} fail · ${n('KNOWN')} known issue(s) · ${((Date.now() - t0) / 1000).toFixed(0)} s`, ''];
  for (const s of sections) {
    L.push(`## ${s.name} (${s.seconds.toFixed(0)} s)`, '', '| | Check | Result |', '|---|---|---|');
    for (const c of s.checks) L.push(`| ${c.status} | ${c.name} | ${String(c.detail).replace(/\|/g, '/')} |`);
    L.push('');
  }
  if (data.bot) {
    L.push('## Bot runs', '', '| Stage / car | Time s | Clock s | Tightest clock margin s | Off road s | Spins | Rescues | Top km/h |', '|---|---|---|---|---|---|---|---|');
    for (const r of data.bot) L.push(`| ${r.stageName} / ${r.car} | ${r.time.toFixed(2)} | ${r.clock} | ${r.minMarginS == null ? '–' : r.minMarginS.toFixed(1)} | ${r.offRoadS.toFixed(1)} | ${r.spins} | ${r.rescues} | ${r.maxKmh.toFixed(0)} |`);
    L.push('');
  }
  if (data.handling) {
    const f = (v, d = 1) => v == null ? '–' : v.toFixed(d);
    L.push('## Skid pad: held key', '', '| Car | Surface | km/h | Slide ° | First swing-out ° | Wound on ms | Back under 5° s | Overshoot ° |', '|---|---|---|---|---|---|---|---|');
    for (const r of data.handling.filter(r => r.mode === 'held')) L.push(`| ${r.car} | ${r.surface} | ${r.kmh} | ${f(r.slideDeg)} | ${f(r.swingDeg)} | ${f(r.wheelMs, 0)} | ${f(r.recoverS, 2)} | ${f(r.overshootDeg)} |`);
    L.push('', '## Skid pad: spin test and handbrake', '', '| Car | Test | Surface | km/h | Max slide ° | Seconds past 45° | 90° turned at s |', '|---|---|---|---|---|---|---|');
    for (const r of data.handling.filter(r => r.mode === 'spin' || r.mode === 'handbrake')) L.push(`| ${r.car} | ${r.mode}${r.autoGas ? ' (auto gas)' : ''} | ${r.surface} | ${r.kmh} | ${f(r.maxDeg, 0)} | ${f(r.over45S, 2)} | ${f(r.t90, 2)} |`);
    L.push('', '## Skid pad: phone tilt', '', '| Car | Surface | km/h | Tilt % | Steering | Slide ° | Wobble ° | First swing-out ° | Back under 5° s |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of data.handling.filter(r => r.mode === 'tilt')) L.push(`| ${r.car} | ${r.surface} | ${r.kmh} | ${r.pct} | ${f(r.steer, 2)} | ${f(r.slideDeg)} | ${f(r.wobbleDeg)} | ${f(r.swingDeg)} | ${f(r.recoverS, 2)} |`);
    L.push('', '## Skid pad: phone auto gas, right button held', '', '| Car | Surface | km/h | Brake tap | Slide before ° | Peak after ° | Turned in 1.5 s ° | Seconds past 45° |', '|---|---|---|---|---|---|---|---|');
    for (const r of data.handling.filter(r => r.mode === 'autogas')) L.push(`| ${r.car} | ${r.surface} | ${r.kmh} | ${r.tap ? 'yes' : 'no'} | ${f(r.slideDeg)} | ${f(r.tapPeakDeg)} | ${f(r.turnDeg)} | ${f(r.over45S, 2)} |`);
    L.push('');
  }
  L.push('Screenshots: tests/results/*.png');
  const md = L.join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ verdict, sections, data }, null, 2));
  process.stdout.write('\n' + md);
  process.exit(verdict === 'FAIL' ? 1 : 0);
})();
