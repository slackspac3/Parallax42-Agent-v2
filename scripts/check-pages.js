'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const required = [
  'public/index.html',
  'public/modules/text.js',
  'public/modules/apiClient.js',
  'public/modules/state.js',
  'public/modules/caseIntelligencePanel.js',
  'public/modules/decisionRoom.js',
  'public/modules/chatUi.js',
  'public/modules/completedRunRegistry.js',
  'public/modules/conversationPayload.js',
  'public/modules/evidenceIndexRestore.js',
  'public/modules/evidenceUploadPolicy.js',
  'public/modules/evidenceUploadUi.js',
  'public/appModules.js',
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
const css = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
for (const asset of [
  'config.js',
  'modules/text.js',
  'modules/apiClient.js',
  'modules/state.js',
  'modules/caseIntelligencePanel.js',
  'modules/decisionRoom.js',
  'modules/chatUi.js',
  'modules/completedRunRegistry.js',
  'modules/conversationPayload.js',
  'modules/evidenceIndexRestore.js',
  'modules/evidenceUploadPolicy.js',
  'modules/evidenceUploadUi.js',
  'appModules.js',
  'app.js',
  'styles.css'
]) {
  if (!html.includes(asset)) {
    throw new Error(`public/index.html does not reference ${asset}`);
  }
}

const navSections = {
  '#run': 'agent',
  '#evidence': 'evidence',
  '#audit': 'audit',
  '#admin': 'admin',
  '#hardening': 'hardening'
};

for (const [href, section] of Object.entries(navSections)) {
  const hrefIndex = html.indexOf(`href="${href}"`);
  if (hrefIndex === -1) {
    throw new Error(`public/index.html is missing topbar link ${href}`);
  }
  const tagStart = html.lastIndexOf('<a ', hrefIndex);
  const tagEnd = html.indexOf('>', hrefIndex);
  const tag = tagStart >= 0 && tagEnd >= 0 ? html.slice(tagStart, tagEnd + 1) : '';
  if (!tag.includes(`data-main-section="${section}"`)) {
    throw new Error(`Topbar link ${href} must declare data-main-section="${section}"`);
  }
}

if (!html.includes('id="chatInputCounter"')) {
  throw new Error('Chat composer must expose a visible character counter.');
}

if (!/id="chatInput"[^>]*maxlength="64000"/.test(html)) {
  throw new Error('Chat composer textarea must declare the client-side character limit.');
}

if (/\.topbar\s+nav\s+a:first-child/.test(css)) {
  throw new Error('Topbar active state must not rely on .topbar nav a:first-child.');
}

for (const section of Object.values(navSections)) {
  const sectionSelectors = {
    agent: 'body[data-main-section="agent"] .command-center',
    evidence: 'body[data-main-section="evidence"] .evidence-board',
    audit: 'body[data-main-section="audit"] .audit-section',
    admin: 'body[data-main-section="admin"] .admin-section',
    hardening: 'body[data-main-section="hardening"] .hardening-section'
  };
  const selector = sectionSelectors[section];
  if (!css.includes(selector)) {
    throw new Error(`Desktop navigation CSS is missing active display rule: ${selector}`);
  }
}

if (!css.includes('body[data-main-section] .command-center')) {
  throw new Error('Desktop navigation CSS must hide inactive workbench sections through data-main-section rules.');
}

if (!css.includes('body[data-workspace-view="output"] .command-center')) {
  throw new Error('Council Output view must have a run-mode-independent workspace display rule.');
}

if (!app.includes('function scheduleLiveCasePreview()')) {
  throw new Error('Live case preview input handling must use a debounced scheduler.');
}

if (/chatInput\?\.\s*addEventListener\('input'[\s\S]{0,120}updateLiveCasePreview\(\)/.test(app)) {
  throw new Error('Live case preview must not run the full preview renderer on every input event.');
}

if (/chatMessagesEl\.innerHTML\s*=\s*chatMessages\.map/.test(app)) {
  throw new Error('Chat messages must not rebuild the full transcript DOM on every render.');
}

if (!app.includes('function readAdminBearerToken()') || !app.includes('window.sessionStorage.setItem(key, value)')) {
  throw new Error('Admin bearer token must use sessionStorage rather than persistent localStorage.');
}

if (/writeStorage\(storageKeys\.adminBearerToken,\s*adminBearerToken/.test(app)) {
  throw new Error('Admin bearer token must not be written through persistent localStorage helpers.');
}

process.stdout.write('GitHub Pages asset check passed.\n');
