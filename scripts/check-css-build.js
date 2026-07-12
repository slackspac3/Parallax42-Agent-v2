'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'public', 'styles.css');
const OVERRIDE_PATH = path.join(ROOT, 'public', 'styles', '24-working-demo-qa.css');
const INDEX_PATH = path.join(ROOT, 'public', 'index.html');

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

if (!fs.existsSync(OVERRIDE_PATH) || !fs.readFileSync(OVERRIDE_PATH, 'utf8').includes('body[data-workspace-view="output"] .command-center')) {
  throw new Error('Working-demo CSS overrides are missing the responsive output grid guard.');
}
if (!fs.readFileSync(INDEX_PATH, 'utf8').includes('styles/24-working-demo-qa.css')) {
  throw new Error('public/index.html must load the working-demo CSS overrides.');
}

process.stdout.write(`CSS source check passed for public/styles.css and working-demo overrides (${css.length} canonical bytes).\n`);
