'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACT_DIR = path.join(ROOT, 'output', 'playwright');

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

async function startServerIfNeeded({ port, baseUrl, env = {} } = {}) {
  if (baseUrl) {
    await waitForHttp(`${baseUrl.replace(/\/$/, '')}/api/health`);
    return null;
  }

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
      P42_ADMIN_FEATURE_CONFIG_PATH: path.join(ARTIFACT_DIR, `admin-feature-flags-${port}.json`),
      P42_AUTH_MODE: env.P42_AUTH_MODE || 'audit'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    await waitForHttp(`http://127.0.0.1:${port}/api/health`);
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

function attachBrowserDiagnostics(page, { baseUrl = '' } = {}) {
  const failures = [];
  const base = baseUrl.replace(/\/$/, '');

  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(`console error: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    failures.push(`page error: ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (base && url.startsWith(base)) {
      failures.push(`request failed: ${request.method()} ${url} ${request.failure()?.errorText || ''}`.trim());
    }
  });

  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (base && url.startsWith(base) && /\/api\//.test(url) && status >= 400) {
      failures.push(`api response ${status}: ${url}`);
    }
  });

  return {
    failures,
    assertClean() {
      assert.deepEqual(failures, []);
    }
  };
}

async function screenshotOnFailure(page, name, fn) {
  try {
    return await fn();
  } catch (error) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
    try {
      await page.screenshot({ path: filePath, fullPage: true });
      error.message = `${error.message}\nScreenshot: ${filePath}`;
    } catch {
      // Preserve the original assertion failure if screenshot capture also fails.
    }
    throw error;
  }
}

async function assertVisibleText(page, selector, pattern, options = {}) {
  await page.waitForFunction(({ selector: query, pattern: source, flags }) => {
    const node = document.querySelector(query);
    return Boolean(node && new RegExp(source, flags).test(node.textContent || ''));
  }, {
    selector,
    pattern: pattern.source,
    flags: pattern.flags
  }, { timeout: options.timeout || 10_000 });
}

async function assertNonBlankWorkbench(page) {
  const metrics = await page.evaluate(() => {
    const selectors = ['.workbench', '.case-panel', '.decision-rail', '#chatInput'];
    return selectors.map((selector) => {
      const node = document.querySelector(selector);
      if (!node) return { selector, exists: false };
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        selector,
        exists: true,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity)
      };
    });
  });
  for (const metric of metrics) {
    assert.equal(metric.exists, true, `${metric.selector} should exist`);
    assert.notEqual(metric.display, 'none', `${metric.selector} should be displayed`);
    assert.notEqual(metric.visibility, 'hidden', `${metric.selector} should be visible`);
    assert.ok(metric.opacity > 0, `${metric.selector} should not be transparent`);
    assert.ok(metric.width > 40, `${metric.selector} should have layout width`);
    assert.ok(metric.height > 30, `${metric.selector} should have layout height`);
  }
}

async function assertFirstViewportLayout(page) {
  const result = await page.evaluate(() => {
    function box(selector) {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        selector,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    }
    const chat = box('.chat-form');
    const rail = box('.decision-rail');
    const transcript = box('#chatMessages');
    const input = box('#chatInput');
    const suggestions = box('.chat-suggestions');
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return { chat, rail, transcript, input, suggestions, viewport };
  });

  assert.ok(result.chat, 'chat composer should exist');
  assert.ok(result.rail, 'right intelligence rail should exist');
  assert.ok(result.transcript, 'chat transcript should exist');
  assert.ok(result.input, 'chat input should exist');
  assert.ok(result.input.width >= 360, 'chat input should be usable on desktop');
  assert.ok(result.input.height <= 120, 'chat input should stay compact on desktop');
  assert.ok(result.chat.top < result.viewport.height * 0.74, 'composer should be visible without scanning a large empty middle area');
  assert.ok(result.rail.left >= result.chat.right || result.chat.right <= result.rail.left + 8, 'chat composer should not overlap the right rail');
  if (result.suggestions) {
    assert.ok(result.suggestions.bottom <= result.chat.top || result.suggestions.bottom <= result.transcript.top + 8, 'prompt cards should sit above the active work surface');
  }
}

async function assertResponsiveWorkspace(page, { width, height = 900 } = {}) {
  await page.setViewportSize({ width, height });
  await page.waitForFunction(() => document.readyState === 'complete' || document.readyState === 'interactive');
  const result = await page.evaluate(() => {
    const selectors = ['.command-center', '.evidence-board', '.audit-section', '.admin-section', '.hardening-section'];
    const visible = selectors.filter((selector) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      activeSection: document.body.dataset.mainSection,
      chatInputWidth: document.querySelector('#chatInput')?.getBoundingClientRect().width || 0,
      visible
    };
  });
  assert.ok(result.documentWidth <= result.innerWidth + 1, `document should not overflow horizontally at ${width}px (${result.documentWidth}px wide)`);
  assert.ok(result.bodyWidth <= result.innerWidth + 1, `body should not overflow horizontally at ${width}px (${result.bodyWidth}px wide)`);
  assert.equal(result.visible.length, 1, `exactly one primary section should be visible at ${width}px: ${result.visible.join(', ')}`);
  if (result.activeSection === 'agent' && result.chatInputWidth) {
    assert.ok(result.chatInputWidth >= Math.min(300, width - 80), `chat input should remain usable at ${width}px (${result.chatInputWidth}px wide)`);
  }
  return result;
}

module.exports = {
  ARTIFACT_DIR,
  ROOT,
  assertFirstViewportLayout,
  assertNonBlankWorkbench,
  assertResponsiveWorkspace,
  assertVisibleText,
  attachBrowserDiagnostics,
  screenshotOnFailure,
  startServerIfNeeded,
  stopServer,
  wait,
  waitForHttp
};
