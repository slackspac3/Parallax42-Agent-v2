'use strict';

const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

test('Agentathon wrapper produces collaborative traces and Compass advisory boundaries', () => {
  const python = process.env.PYTHON || 'python';
  const result = spawnSync(python, ['scripts/check_agentathon_wrapper.py'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      SAMPLE_MODE: 'false',
      LOG_DIR: './logs'
    }
  });

  assert.equal(
    result.status,
    0,
    `Python Agentathon wrapper checks failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
  assert.match(result.stdout, /Agentathon wrapper checks passed\./);
});
