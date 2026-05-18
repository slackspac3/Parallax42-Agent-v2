'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const assets = ['index.html', 'app.js', 'styles.css', 'config.js'];
const mirrors = [
  { label: 'repo root', dir: ROOT },
  { label: 'docs/', dir: path.join(ROOT, 'docs') }
];

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read ${path.relative(ROOT, filePath)}: ${error.message}`);
  }
}

const failures = [];

for (const asset of assets) {
  const canonicalPath = path.join(ROOT, 'public', asset);
  const canonical = readFile(canonicalPath);

  for (const mirror of mirrors) {
    const mirrorPath = path.join(mirror.dir, asset);
    if (!fs.existsSync(mirrorPath)) {
      failures.push(`${mirror.label} is missing ${asset}`);
      continue;
    }

    const mirrored = readFile(mirrorPath);
    if (mirrored !== canonical) {
      failures.push(`${path.relative(ROOT, mirrorPath)} differs from public/${asset}`);
    }
  }
}

if (failures.length) {
  throw new Error([
    'Static frontend mirrors are out of sync.',
    'public/ is the canonical source. Keep repo-root and docs/ mirrors byte-for-byte identical before shipping.',
    ...failures.map((failure) => `- ${failure}`)
  ].join('\n'));
}

process.stdout.write('Static frontend mirror check passed.\n');
