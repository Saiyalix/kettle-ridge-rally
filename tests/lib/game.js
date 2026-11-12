// Shared helpers: serve the repo locally, open the game in headless Chromium, collect errors.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const NM = path.join(ROOT, 'node_modules');
const THREE_R128_LOCAL = path.join(NM, 'three-r128', 'build', 'three.min.js');   // the classic global-THREE build (npm alias of three@0.128.0)
const THREE_NEW_VERSION = JSON.parse(fs.readFileSync(path.join(NM, 'three', 'package.json'), 'utf8')).version;
const PROBE = fs.readFileSync(path.join(__dirname, 'probe.js'), 'utf8');
// The probe is added to a temporary copy of index.html just before this line, inside boot(), so it can
// see the game's internals. index.html itself is never changed by the tests.
const PROBE_ANCHOR = '  loadStage(0).then(() => requestAnimationFrame(frame));';

function startServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    let body = fs.readFileSync(file);
    if (rel === 'index.html' && url.searchParams.has('probe')) {
      const html = body.toString('utf8');
      if (!html.includes(PROBE_ANCHOR)) { res.writeHead(500); res.end('probe anchor not found in index.html'); return; }
      body = Buffer.from(html.replace(PROBE_ANCHOR, PROBE + '\n' + PROBE_ANCHOR));
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

// Slow-machine patience. Only WAITING is scaled; no check or threshold depends on it.
// Software GL uses every core, so on a busy cloud box (load average 12-20 on 4 cores) page loads and screenshots
// can take minutes. SLOW=<n> sets the factor by hand; otherwise it follows the 1-minute load average per core
// (1 when idle, up to 4 when the machine is badly overloaded).
const CORES = Math.max(1, os.cpus().length);
const SLOW = Number(process.env.SLOW) > 0 ? Number(process.env.SLOW) : Math.min(4, Math.max(1, os.loadavg()[0] / CORES));
const BASE_TIMEOUT = 120000;                                    // goto, screenshot, every default wait: 120 s (Playwright's default is 30 s)
const patience = ms => Math.round(ms * SLOW);                   // scale a wait you wrote by hand (waitForFunction timeouts)

const launch = () => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

// opts: { probe: bool, query: 'gfx=pc', storage: { key: value } (localStorage set before the game starts), viewport, isMobile, hasTouch, deviceScaleFactor }
async function openGame(browser, base, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, deviceScaleFactor: opts.deviceScaleFactor || 1, isMobile: !!opts.isMobile, hasTouch: !!opts.hasTouch });
  const page = await ctx.newPage();
  page.setDefaultTimeout(patience(BASE_TIMEOUT)); page.setDefaultNavigationTimeout(patience(BASE_TIMEOUT));   // goto, screenshot, click...
  const errors = [];
  page.on('pageerror', e => errors.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  // three.js is always served from node_modules (cloud sessions block the CDNs).
  // 1) classic r128 from cdnjs -> node_modules/three-r128
  await page.route(/cdnjs\.cloudflare\.com\/.*three.*\.js/, route => fs.existsSync(THREE_R128_LOCAL) ? route.fulfill({ path: THREE_R128_LOCAL, contentType: 'text/javascript' }) : route.continue());
  // 2) modern three (ES modules) from jsdelivr / unpkg: .../three@<version>/<build|examples/jsm>/... -> node_modules/three/<same path>
  await page.route(/\/\/(cdn\.jsdelivr\.net\/npm|unpkg\.com)\/three@/, route => {
    const m = /three@([^/]+)\/((?:build|examples\/jsm)\/[^?#]+)/.exec(route.request().url());
    const fail = msg => { errors.push('console error: TEST KIT: ' + msg); return route.abort(); };
    if (!m) return fail('unrecognised three.js URL ' + route.request().url() + ' (use .../three@<version>/build/... or .../examples/jsm/...)');
    if (m[1] !== THREE_NEW_VERSION) return fail(`game asks for three@${m[1]} but node_modules has ${THREE_NEW_VERSION}; update package.json and the game together`);
    const file = path.join(NM, 'three', m[2]);
    if (!file.startsWith(path.join(NM, 'three') + path.sep) || !fs.existsSync(file)) return fail('file not in installed three: ' + m[2]);
    return route.fulfill({ path: file, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } });
  });
  // web fonts are cosmetic and often blocked in the cloud; the CSS has fallbacks
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  if (opts.storage) await page.addInitScript(o => { try { for (const k in o) localStorage.setItem(k, o[k]); } catch (e) { /* ignore */ } }, opts.storage);   // after the clear above
  await page.goto(base + '/index.html' + (opts.probe ? '?probe' : opts.query ? '?' + opts.query : ''));
  // the game builds stage 1 on load; ready when the menu's start button is enabled
  await page.waitForFunction(() => { const b = document.getElementById('startBtn'); return b && !b.disabled; }, null, { timeout: patience(180000) });
  // font/cdn failures we caused ourselves are not game errors
  const ours = /fonts\.(googleapis|gstatic)|ERR_FAILED|net::ERR/;
  return { ctx, page, errors: () => errors.filter(e => !ours.test(e)) };
}

// A browser that relaunches itself. If Chromium crashed or hung (browser.isConnected() false, or the group
// forced a restart), the next newContext() starts a fresh one, so one dead browser fails one group, not all.
function resilientBrowser() {
  let b = null, starting = null;
  const ensure = async () => {
    if (b && b.isConnected()) return b;
    if (b) { try { await b.close(); } catch (e) { /* already dead */ } b = null; }
    return starting || (starting = launch().then(nb => { b = nb; starting = null; return nb; }, e => { starting = null; throw e; }));
  };
  return {
    newContext: async (...a) => (await ensure()).newContext(...a),
    restart: async () => { if (b) { const old = b; b = null; try { await Promise.race([old.close(), new Promise(r => setTimeout(r, 15000))]); } catch (e) { /* ignore */ } try { old.process() && old.process().kill('SIGKILL'); } catch (e) { /* ignore */ } } },
    close: async () => { if (b) { try { await b.close(); } catch (e) { /* ignore */ } b = null; } },
  };
}

module.exports = { ROOT, startServer, launch, openGame, resilientBrowser, patience, SLOW };
