'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const required = [
  'public/index.html',
  'public/app.js',
  'public/config.js',
  'public/styles.css',
  'public/.nojekyll'
];

for (const file of required) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    throw new Error(`Missing Pages asset: ${file}`);
  }
}

const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
for (const asset of ['config.js', 'app.js', 'styles.css']) {
  if (!html.includes(asset)) {
    throw new Error(`public/index.html does not reference ${asset}`);
  }
}

process.stdout.write('GitHub Pages asset check passed.\n');
