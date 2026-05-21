'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'public', 'styles');
const MANIFEST_PATH = path.join(SOURCE_DIR, 'manifest.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'styles.css');

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (!Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('public/styles/manifest.json must include a non-empty files array.');
  }
  return manifest.files;
}

function buildCss() {
  const files = readManifest();
  const chunks = files.map((file) => {
    const filePath = path.join(SOURCE_DIR, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSS source is missing: public/styles/${file}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  });
  const css = chunks.join('');
  fs.writeFileSync(OUTPUT_PATH, css);
  return { files, bytes: Buffer.byteLength(css) };
}

if (require.main === module) {
  const result = buildCss();
  process.stdout.write(`Built public/styles.css from ${result.files.length} CSS source files (${result.bytes} bytes).\n`);
}

module.exports = { buildCss };

