// (e) index.html is exactly what src/ builds, and the glued script is valid JavaScript.
// Catches: editing index.html directly, or editing src/ and forgetting `node tools/build.js`.
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async function buildTest() {
  const script = path.join(__dirname, '..', 'tools', 'build.js');
  try {
    const out = execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    return [{ name: 'index.html matches src/', pass: true, detail: out.trim() }];
  } catch (e) {
    return [{ name: 'index.html matches src/', pass: false, detail: ((e.stdout || '') + (e.stderr || '')).trim().replace(/\n/g, ' ') }];
  }
};
