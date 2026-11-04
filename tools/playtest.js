#!/usr/bin/env node
/*
  Kettle Ridge Rally automated playtest.

  What it does
    1. Serves the repo on a local port and opens index.html?test in headless Chromium.
    2. Fails on any JavaScript error or console error.
    3. HANDLING: an autopilot drives every stage at the fixed physics rate (same input, same result) and records
       stage time, top speed, time off the road, drift time, average slide angle, spins and rescues.
    4. PERFORMANCE: the autopilot drives each stage in real time, once as a desktop (1280x720) and once as a
       mid-range phone (landscape, touch, CPU slowed 4x). Records frame rate and how long each frame's work takes.
    5. Screenshots of the menu and every stage for both, in tools/results/.
    6. Compares everything with tools/baseline.json and prints a summary (also tools/results/summary.md).

  Usage
    node tools/playtest.js                  full run
    node tools/playtest.js --quick          handling sims + one desktop screenshot (about 1 minute)
    node tools/playtest.js --stage 2        only stage index 2 (0-based)
    node tools/playtest.js --save-baseline  full run, then store the numbers as the new baseline

  Exit code 1 = a hard failure (errors, a stage the autopilot cannot finish). Warnings do not fail the run.

  Note on frame rate: headless Chromium renders WebGL in software (SwiftShader), so fps here is far below what a
  real GPU gets. Use it to compare against the baseline (did a change make things slower?), not as a device number.
  Real-device checks: open the game with the F1 debug overlay on a phone.
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'results');
const BASELINE = path.join(__dirname, 'baseline.json');
const argv = process.argv.slice(2);
const QUICK = argv.includes('--quick');
const SAVE = argv.includes('--save-baseline');
const ONLY = argv.includes('--stage') ? Number(argv[argv.indexOf('--stage') + 1]) : null;
const REALTIME_SECONDS = QUICK ? 4 : 10;

// Targets from the project brief. Measured on real hardware; here they are reported for reference.
const TARGET_FPS = { desktop: 60, phone: 30 };
// Thresholds against the baseline that count as a regression warning
const WARN = { timePct: 3, offRoadS: 2, workPct: 25 };

const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, cpuSlowdown: 1 },
  phone: { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, cpuSlowdown: 4 },
};

const THREE_LOCAL = path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js');

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

async function openGame(browser, base, profileName) {
  const P = PROFILES[profileName];
  const ctx = await browser.newContext({ viewport: P.viewport, deviceScaleFactor: P.deviceScaleFactor, isMobile: !!P.isMobile, hasTouch: !!P.hasTouch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_FAILED|net::/i.test(m.text())) errors.push('console: ' + m.text()); });
  // Serve three.js from node_modules when available (CDNs may be blocked in CI); skip web fonts (the CSS has fallbacks)
  await page.route(/three(\.min)?\.js(\?.*)?$/, route => {
    if (/^http:\/\/127\.0\.0\.1/.test(route.request().url())) return route.continue();
    if (fs.existsSync(THREE_LOCAL)) return route.fulfill({ path: THREE_LOCAL, contentType: 'text/javascript' });
    return route.continue();
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  // Seeded Math.random, so rival times (and any contact with rivals) repeat run to run
  await page.addInitScript(() => {
    let a = 12345;
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    try { localStorage.clear(); } catch (e) { /* ignore */ }
  });
  if (P.cpuSlowdown > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpuSlowdown });
  }
  await page.goto(base + '/index.html?test');
  await page.waitForFunction(() => window.__rally && window.__rally.ready(), null, { timeout: 120000 });
  return { ctx, page, errors };
}

const loadStage = (page, i) => page.evaluate(async i => { await window.__rally.loadStage(i); while (!window.__rally.ready()) await new Promise(r => setTimeout(r, 50)); }, i);

function stats(arr) {
  if (!arr.length) return { avg: 0, p95: 0, worst: 0 };
  const s = [...arr].sort((a, b) => a - b), avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { avg, p95: s[Math.floor(s.length * 0.95)], worst: s[s.length - 1] };
}

async function realtime(page, profileName, stageIdx, shotName) {
  await loadStage(page, stageIdx);
  await page.evaluate(() => { const T = window.__rally; T.frameMs.length = 0; T.workMs.length = 0; T.bot = true; T.start(); });
  // Screenshot once the car is properly under way (game time, which runs slower than real time at low fps)
  await page.waitForFunction(() => window.__rally.snapshot().raceTime > 5, null, { timeout: 90000 }).catch(() => {});
  await page.evaluate(() => { const T = window.__rally; T.frameMs.length = 0; T.workMs.length = 0; });
  await page.screenshot({ path: path.join(OUT, shotName) });
  await page.waitForTimeout(REALTIME_SECONDS * 1000);
  const r = await page.evaluate(() => { const T = window.__rally; T.bot = false; const out = { frameMs: T.frameMs.slice(5), workMs: T.workMs.slice(5), snap: T.snapshot() }; T.menu(); return out; });
  const f = stats(r.frameMs), w = stats(r.workMs);
  return { profile: profileName, stage: stageIdx, stageName: r.snap.stageName, frames: r.frameMs.length, fps: f.avg ? 1000 / f.avg : 0,
    frameP95Ms: f.p95, worstFrameMs: f.worst, workAvgMs: w.avg, workP95Ms: w.p95, quality: r.snap.quality, distance: r.snap.s, screenshot: shotName };
}

// CPU budget per frame (work ms) before a warning: phone = CPU slowed 4x, ~33 ms frame at 30 fps, leave room for the GPU
const WORK_BUDGET_MS = { desktop: 8, phone: 25 };

const fmt = (v, d = 1) => (v == null || !isFinite(v) ? '–' : Number(v).toFixed(d));
const delta = (now, was, d = 1, unit = '') => (was == null ? '' : ` (${now - was >= 0 ? '+' : ''}${(now - was).toFixed(d)}${unit})`);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const result = { date: new Date().toISOString(), quick: QUICK, handling: [], performance: [], errors: [], failures: [], warnings: [] };
  const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;

  try {
    // ---------- desktop: menu, handling sims, real-time runs ----------
    const D = await openGame(browser, base, 'desktop');
    const n = await D.page.evaluate(() => window.__rally.stageCount);
    const stages = ONLY != null ? [ONLY] : [...Array(n).keys()];
    await D.page.screenshot({ path: path.join(OUT, 'desktop-menu.png') });
    for (const i of stages) {
      await loadStage(D.page, i);
      const r = await D.page.evaluate(() => window.__rally.simRun(400));
      result.handling.push(r);
      process.stdout.write(`handling  ${r.stageName.padEnd(14)} ${fmt(r.time, 2)} s  (clock allows ${r.timeBudget} s)\n`);
    }
    for (const i of QUICK ? [stages[0]] : stages) {
      const r = await realtime(D.page, 'desktop', i, `desktop-stage${i + 1}.png`);
      result.performance.push(r);
      process.stdout.write(`perf      desktop ${r.stageName.padEnd(14)} ${fmt(r.fps, 0)} fps\n`);
    }
    result.errors.push(...D.errors.map(e => 'desktop ' + e));
    await D.ctx.close();

    // ---------- phone ----------
    if (!QUICK) {
      const M = await openGame(browser, base, 'phone');
      await M.page.screenshot({ path: path.join(OUT, 'phone-menu.png') });
      for (const i of stages) {
        const r = await realtime(M.page, 'phone', i, `phone-stage${i + 1}.png`);
        result.performance.push(r);
        process.stdout.write(`perf      phone   ${r.stageName.padEnd(14)} ${fmt(r.fps, 0)} fps\n`);
      }
      result.errors.push(...M.errors.map(e => 'phone ' + e));
      await M.ctx.close();
    }
  } catch (e) {
    result.failures.push('playtest crashed: ' + (e && e.stack || e));
  }
  await browser.close();
  server.close();

  // ---------- checks ----------
  if (result.errors.length) result.failures.push(`${result.errors.length} JavaScript error(s) in the page`);
  for (const h of result.handling) {
    if (h.timedOut) result.failures.push(`${h.stageName}: autopilot did not reach the finish`);
    else if (h.time > h.timeBudget) result.warnings.push(`${h.stageName}: autopilot time ${fmt(h.time)} s is over the clock (${h.timeBudget} s): the stage may now be too hard`);
    if (h.rescues > 0) result.warnings.push(`${h.stageName}: autopilot needed ${h.rescues} rescue(s)`);
    const b = baseline && baseline.handling.find(x => x.stage === h.stage);
    if (b) {
      const pct = (h.time - b.time) / b.time * 100;
      if (Math.abs(pct) > WARN.timePct) result.warnings.push(`${h.stageName}: stage time changed ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs baseline (intended?)`);
      if (h.offRoadS - b.offRoadS > WARN.offRoadS) result.warnings.push(`${h.stageName}: ${fmt(h.offRoadS - b.offRoadS)} s more off the road than baseline`);
      if (h.spins > b.spins) result.warnings.push(`${h.stageName}: ${h.spins} spin(s), baseline had ${b.spins}`);
    }
  }
  for (const p of result.performance) {
    if (p.workAvgMs > WORK_BUDGET_MS[p.profile]) result.warnings.push(`${p.profile} ${p.stageName}: frame work ${p.workAvgMs.toFixed(1)} ms is over the ${WORK_BUDGET_MS[p.profile]} ms budget`);
    const b = baseline && baseline.performance.find(x => x.stage === p.stage && x.profile === p.profile);
    if (b && b.workAvgMs > 0 && !QUICK) {          // quick runs sample too few frames to compare timing
      const pct = (p.workAvgMs - b.workAvgMs) / b.workAvgMs * 100;
      if (pct > WARN.workPct) result.warnings.push(`${p.profile} ${p.stageName}: frame work ${pct.toFixed(0)}% slower than baseline`);
    }
  }

  // ---------- summary ----------
  const L = [];
  L.push(`# Playtest ${result.date.slice(0, 16).replace('T', ' ')}${QUICK ? ' (quick)' : ''}`, '');
  L.push(result.failures.length ? `**FAILED:** ${result.failures.join('; ')}` : '**PASSED**', '');
  L.push('## Handling (autopilot, fixed step)', '', '| Stage | Time s | Clock s | Top km/h | Off road s | Drift s | Avg slide ° | Spins | Rescues |', '|---|---|---|---|---|---|---|---|---|');
  for (const h of result.handling) {
    const b = baseline && baseline.handling.find(x => x.stage === h.stage);
    L.push(`| ${h.stageName} | ${fmt(h.time, 2)}${b ? delta(h.time, b.time, 2) : ''} | ${h.timeBudget} | ${fmt(h.maxKmh, 0)} | ${fmt(h.offRoadS)}${b ? delta(h.offRoadS, b.offRoadS) : ''} | ${fmt(h.driftS)} | ${fmt(h.avgSlideDeg)} | ${h.spins} | ${h.rescues} |`);
  }
  L.push('', '## Performance', '',
    `Work = CPU milliseconds per frame (game logic + draw calls). That is the number to watch: the phone runs with the CPU slowed 4x,`,
    `so its work must stay well under ${(1000 / TARGET_FPS.phone).toFixed(0)} ms for ${TARGET_FPS.phone} fps; desktop under ${(1000 / TARGET_FPS.desktop / 2).toFixed(0)} ms for ${TARGET_FPS.desktop} fps.`,
    `fps here is software rendering (no GPU) and frames are capped at 100 ms, so it is only meaningful on a machine with a GPU.`, '',
    '| Device | Stage | fps | p95 frame ms | Work avg ms | Work p95 ms | Quality |', '|---|---|---|---|---|---|---|');
  for (const p of result.performance) {
    const b = baseline && baseline.performance.find(x => x.stage === p.stage && x.profile === p.profile);
    L.push(`| ${p.profile} | ${p.stageName} | ${fmt(p.fps, 0)}${b ? delta(p.fps, b.fps, 0) : ''} | ${fmt(p.frameP95Ms)} | ${fmt(p.workAvgMs)}${b ? delta(p.workAvgMs, b.workAvgMs, 1) : ''} | ${fmt(p.workP95Ms)} | ${p.quality} |`);
  }
  if (result.warnings.length) L.push('', '## Warnings', '', ...result.warnings.map(w => '- ' + w));
  if (result.errors.length) L.push('', '## Page errors', '', ...result.errors.slice(0, 30).map(e => '- `' + e.replace(/`/g, "'") + '`'));
  L.push('', `Screenshots: tools/results/*.png${baseline ? `. Baseline from ${baseline.date.slice(0, 10)}.` : '. No baseline yet: run with --save-baseline.'}`);
  const md = L.join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, 'summary.md'), md);
  fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify(result, null, 2));
  process.stdout.write('\n' + md);

  if (SAVE) {
    if (result.failures.length) process.stdout.write('\nNot saving the baseline: the run failed.\n');
    else if (QUICK || ONLY != null) process.stdout.write('\nNot saving the baseline: run the full playtest for that.\n');
    else {
      const slim = { date: result.date, handling: result.handling.map(({ splits, ...h }) => h), performance: result.performance };
      fs.writeFileSync(BASELINE, JSON.stringify(slim, null, 2) + '\n');
      process.stdout.write('\nBaseline saved to tools/baseline.json\n');
    }
  }
  process.exit(result.failures.length ? 1 : 0);
})();
