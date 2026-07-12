'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'public', 'styles.css');
const OVERRIDE_PATH = path.join(ROOT, 'public', 'styles', '24-working-demo-qa.css');

function buildCss() {
  // public/styles.css predates the optional fragments and contains selectors
  // the legacy concatenator never captured. Treat it as canonical so running
  // the build command cannot silently remove production UI rules.
  const files = [OUTPUT_PATH, OVERRIDE_PATH];
  files.forEach((filePath) => {
    if (!fs.existsSync(filePath) || !fs.readFileSync(filePath, 'utf8').trim()) {
      throw new Error(`CSS source is missing or empty: ${path.relative(ROOT, filePath)}`);
    }
  });
  return {
    files: files.map((filePath) => path.relative(ROOT, filePath)),
    bytes: files.reduce((total, filePath) => total + fs.statSync(filePath).size, 0)
  };
}

if (require.main === module) {
  const result = buildCss();
  process.stdout.write(`Validated ${result.files.join(' + ')} (${result.bytes} bytes); no CSS was overwritten.\n`);
}

module.exports = { buildCss };
