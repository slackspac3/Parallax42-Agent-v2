'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const {
  assertNonBlankWorkbench,
  assertVisibleText,
  attachBrowserDiagnostics,
  screenshotOnFailure
} = require('./helpers');

const BASE_URL = String(
  process.env.P42_DEPLOYED_BASE_URL
  || process.env.PLAYWRIGHT_DEPLOYED_BASE_URL
  || ''
).replace(/\/+$/, '');

async function main() {
  if (!BASE_URL) {
    process.stdout.write('Deployed smoke skipped. Set P42_DEPLOYED_BASE_URL to test GitHub Pages or Vercel.\n');
    return;
  }

  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS !== '0' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const diagnostics = attachBrowserDiagnostics(page, { baseUrl: BASE_URL });

  try {
    await screenshotOnFailure(page, 'deployed-smoke', async () => {
      for (const hash of ['', '#run', '#evidence', '#audit', '#hardening']) {
        await page.goto(`${BASE_URL}/${hash}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#chatInput', { timeout: 15_000 });
        await assertNonBlankWorkbench(page);
        await assertVisibleText(page, 'body', /Compliance advisor|Intelligence Panel/i);
      }
      await page.locator('#councilOutputTab').click();
      await assertVisibleText(page, '#workflow', /Decision room is empty|Run the council|Executive decision room/i, { timeout: 10_000 });
      assert.equal(await page.evaluate(() => document.body.dataset.workspaceView), 'output');
      diagnostics.assertClean();
    });
  } finally {
    await browser.close();
  }

  process.stdout.write(`Deployed smoke passed for ${BASE_URL}.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
