'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PLAYWRIGHT_PORT || 3137);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForHttp(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function startServerIfNeeded() {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    await waitForHttp(`${BASE_URL}/api/health`);
    return null;
  }

  fs.mkdirSync(path.join(ROOT, 'output', 'playwright'), { recursive: true });

  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      P42_ADMIN_FEATURE_CONFIG_PATH: path.join(ROOT, 'output', 'playwright', 'admin-feature-flags.json'),
      P42_AUTH_MODE: 'audit',
      P42_FEATURE_COMPASS_EMBEDDINGS: '0',
      P42_FEATURE_COMPASS_LLM_CALLS: '0',
      P42_FEATURE_LIVE_ADVISORY_SPECIALISTS: '0',
      P42_FEATURE_LIVE_CREWAI: '0'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    await waitForHttp(`${BASE_URL}/api/health`);
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`Unable to start local server: ${error.message}\n${output}`);
  }
  return child;
}

async function stopServer(child) {
  if (!child) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    wait(2000)
  ]);
}

async function sendMessage(page, message) {
  const input = page.locator('#chatInput');
  await input.fill(message);
  await input.press('Enter');
}

async function main() {
  const server = await startServerIfNeeded();
  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS !== '0' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#chatInput');

    await page.locator('#chatInput').fill('First line');
    await page.locator('#chatInput').press('Shift+Enter');
    await page.keyboard.type('second line');
    assert.match(await page.locator('#chatInput').inputValue(), /First line\nsecond line/);
    await page.locator('#chatInput').fill('');

    await sendMessage(page, 'I have a request to outsource payroll to a third party');
    await page.waitForFunction(() => document.querySelector('#chatMessages')?.textContent.includes('Compass gateway is not configured'), null, { timeout: 10_000 });

    const firstReply = await page.locator('#chatMessages').textContent();
    assert.match(firstReply, /Compass gateway is not configured/i);
    assert.match(firstReply, /smart intake is unavailable/i);

    await page.locator('#startNewCase').click();
    await page.waitForFunction(() => (document.querySelector('#caseIntelReadiness')?.textContent || '').trim() === '0%', null, { timeout: 10_000 });

    const resetText = await page.locator('#chatMessages').textContent();
    assert.match(resetText, /What do you need reviewed/i);
    assert.equal((await page.locator('#chatInput').inputValue()).trim(), '');
  } finally {
    await browser.close();
    await stopServer(server);
  }

  process.stdout.write('Playwright advisor smoke test passed.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
