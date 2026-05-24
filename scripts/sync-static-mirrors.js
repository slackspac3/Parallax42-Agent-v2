'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const assets = [
  'index.html',
  'modules/text.js',
  'modules/apiClient.js',
  'modules/state.js',
  'modules/caseIntelligencePanel.js',
  'modules/decisionRoom.js',
  'modules/chatUi.js',
  'modules/evidenceUploadPolicy.js',
  'modules/evidenceUploadUi.js',
  'appModules.js',
  'app.js',
  'styles.css',
  'config.js'
];
const mirrors = [ROOT, path.join(ROOT, 'docs')];

for (const asset of assets) {
  const source = path.join(ROOT, 'public', asset);
  for (const dir of mirrors) {
    fs.mkdirSync(path.dirname(path.join(dir, asset)), { recursive: true });
    fs.copyFileSync(source, path.join(dir, asset));
  }
}

process.stdout.write(`Synced ${assets.length} static frontend assets to repo root and docs/ mirrors.\n`);
