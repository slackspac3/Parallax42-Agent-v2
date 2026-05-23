'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'public', 'styles.css');

if (!fs.existsSync(OUTPUT_PATH)) {
  throw new Error('public/styles.css is missing.');
}

const css = fs.readFileSync(OUTPUT_PATH, 'utf8');
if (!css.trim()) {
  throw new Error('public/styles.css is empty.');
}

if (/^(<<<<<<<|=======|>>>>>>>) /m.test(css)) {
  throw new Error('public/styles.css contains unresolved merge conflict markers.');
}

const requiredSelectors = [
  '.advisor-response-card',
  '.thinking-loader',
  '.evidence-pipeline',
  '.decision-room-shell',
  '.quality-rubric-panel',
  '.agent-loop-panel',
  '.admin-status-card'
];
const missing = requiredSelectors.filter((selector) => !css.includes(selector));
if (missing.length) {
  throw new Error(`public/styles.css is missing required selector(s): ${missing.join(', ')}`);
}

process.stdout.write(`CSS source check passed for public/styles.css (${css.length} bytes).\n`);
