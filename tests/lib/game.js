// Shared helpers: serve the repo locally, open the game in headless Chromium, collect errors.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const THREE_LOCAL = path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js');
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

const launch = () => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

// opts: { probe: bool, viewport, isMobile, hasTouch, deviceScaleFactor }
async function openGame(browser, base, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, deviceScaleFactor: opts.deviceScaleFactor || 1, isMobile: !!opts.isMobile, hasTouch: !!opts.hasTouch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  // three.js: the same r128 release from node_modules when installed (cloud sessions block some CDNs).
  await page.route(/cdnjs\.cloudflare\.com\/.*three.*\.js/, route => fs.existsSync(THREE_LOCAL) ? route.fulfill({ path: THREE_LOCAL, contentType: 'text/javascript' }) : route.continue());
  // web fonts are cosmetic and often blocked in the cloud; the CSS has fallbacks
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.goto(base + '/index.html' + (opts.probe ? '?probe' : ''));
  // the game builds stage 1 on load; ready when the menu's start button is enabled
  await page.waitForFunction(() => { const b = document.getElementById('startBtn'); return b && !b.disabled; }, null, { timeout: 120000 });
  // font/cdn failures we caused ourselves are not game errors
  const ours = /fonts\.(googleapis|gstatic)|ERR_FAILED|net::ERR/;
  return { ctx, page, errors: () => errors.filter(e => !ours.test(e)) };
}

module.exports = { ROOT, startServer, launch, openGame };
