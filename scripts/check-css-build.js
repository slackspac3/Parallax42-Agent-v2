'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildCss } = require('./build-css');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'public', 'styles.css');

const before = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
const result = buildCss();
const after = fs.readFileSync(OUTPUT_PATH, 'utf8');

if (before !== after) {
  fs.writeFileSync(OUTPUT_PATH, before);
  throw new Error('public/styles.css is out of date. Run npm run build:css and sync mirrors.');
}

process.stdout.write(`CSS build check passed for ${result.files.length} source files.\n`);

