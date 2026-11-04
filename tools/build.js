#!/usr/bin/env node
/*
  Builds index.html from the files in src/, in the order listed in src/parts.txt.

    node tools/build.js            write index.html
    node tools/build.js --check    only check: exit 1 if index.html is not what src/ builds (someone edited
                                   index.html directly, or forgot to build after editing src/)
    node tools/build.js --where N  which src file and line is line N of index.html (for error messages)

  Rule: edit files in src/, then build, then commit src/ and index.html together.
  GitHub Pages serves index.html, so the live game is always the built file.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');

function readParts() {
  return fs.readFileSync(path.join(SRC, 'parts.txt'), 'utf8').split('\n')
    .map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
}

function build() {
  const parts = readParts();
  const seen = new Set();
  const chunks = parts.map(p => {
    if (seen.has(p)) throw new Error(`src/parts.txt lists ${p} twice`);
    seen.add(p);
    const f = path.join(SRC, p);
    if (!fs.existsSync(f)) throw new Error(`src/parts.txt lists ${p}, but src/${p} does not exist`);
    return { part: p, text: fs.readFileSync(f, 'utf8') };
  });
  const listed = new Set(parts);
  const unlisted = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name), rel = path.relative(SRC, full).split(path.sep).join('/');
    if (e.isDirectory()) walk(full); else if (rel !== 'parts.txt' && rel !== 'README.md' && !listed.has(rel)) unlisted.push(rel);
  } })(SRC);
  if (unlisted.length) throw new Error(`files in src/ not listed in src/parts.txt: ${unlisted.join(', ')}`);
  for (const c of chunks) if (c.text.length && !c.text.endsWith('\n') && c !== chunks[chunks.length - 1])
    throw new Error(`src/${c.part} must end with a newline`);
  const html = chunks.map(c => c.text).join('');
  // the game's script must still be valid JavaScript once glued together
  const m = html.match(/<script>\n([\s\S]*)<\/script>\s*<\/body>/);
  if (!m) throw new Error('could not find the main <script> block in the built page');
  try { new vm.Script(m[1], { filename: 'main-script' }); }
  catch (e) {
    const ln = Number(((e.stack || '').match(/main-script:(\d+)/) || [])[1]);
    const before = html.slice(0, m.index + '<script>\n'.length).split('\n').length - 1;    // lines before the script body
    const at = ln ? ' at ' + locate(chunks, before + ln) : '';
    throw new Error(`the glued script is not valid JavaScript${at}: ${e.message}\n` + (e.stack || '').split('\n').slice(1, 3).join('\n'));
  }
  return { html, chunks };
}

function where(n) { return locate(build().chunks, n); }

function locate(chunks, n) {
  let line = 1;
  for (const c of chunks) {
    const count = c.text.split('\n').length - 1;
    if (n < line + count) return `index.html line ${n} = src/${c.part} line ${n - line + 1}`;
    line += count;
  }
  return `index.html has only ${line - 1} lines`;
}

const args = process.argv.slice(2);
try {
  if (args[0] === '--where') { console.log(where(Number(args[1]))); process.exit(0); }
  const { html, chunks } = build();
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (args.includes('--check')) {
    if (current === html) { console.log(`index.html is up to date (${chunks.length} parts)`); process.exit(0); }
    const a = current.split('\n'), b = html.split('\n');
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.log(`index.html is NOT what src/ builds. First difference at line ${i + 1}: ${where(i + 1)}`);
    console.log('Fix: edit the file in src/ (never index.html directly), then run: node tools/build.js');
    process.exit(1);
  }
  fs.writeFileSync(OUT, html);
  console.log(`built index.html from ${chunks.length} parts (${html.length} bytes)${current === html ? ', unchanged' : ''}`);
} catch (e) {
  console.error('BUILD FAILED: ' + e.message);
  process.exit(1);
}
