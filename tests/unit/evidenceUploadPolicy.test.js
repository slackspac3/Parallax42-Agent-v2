'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEvidenceUploadPolicy() {
  const window = {
    crypto: webcrypto,
    P42ModuleRegistry: {}
  };
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'evidenceUploadPolicy.js'), 'utf8');
  vm.runInNewContext(source, { window, Uint8Array });
  return window.P42ModuleRegistry.evidenceUploadPolicy;
}

function fakeFile({ name = 'evidence.pdf', type = 'application/pdf', size = 0, text = '' } = {}) {
  return {
    name,
    type,
    size,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer
  };
}

test('evidence upload policy rejects files above 30 MB', () => {
  const policy = loadEvidenceUploadPolicy();
  const file = fakeFile({ name: 'large.pdf', size: (31 * 1024 * 1024) });

  const result = policy.validateEvidenceFileSelection([file]);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'file_too_large');
  assert.match(result.message, /30 MB per file max/i);
});

test('evidence upload policy accepts a 30 MB file', () => {
  const policy = loadEvidenceUploadPolicy();
  const file = fakeFile({ name: 'accepted.pdf', size: (30 * 1024 * 1024) });

  const result = policy.validateEvidenceFileSelection([file]);

  assert.equal(result.ok, true);
  assert.equal(result.totalBytes, 30 * 1024 * 1024);
});

test('evidence upload policy populates SHA-256 in upload init file payload', async () => {
  const policy = loadEvidenceUploadPolicy();
  const file = fakeFile({ name: 'note.txt', type: 'text/plain', size: 11, text: 'hello world' });

  const payload = await policy.buildUploadInitFiles([file]);

  assert.equal(payload.length, 1);
  assert.equal(payload[0].file_name, 'note.txt');
  assert.equal(payload[0].content_type, 'text/plain');
  assert.equal(payload[0].file_size_bytes, 11);
  assert.equal(payload[0].sha256, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
});

test('evidence upload policy computes upload chunk counts', () => {
  const policy = loadEvidenceUploadPolicy();

  assert.equal(policy.uploadChunkCount(30 * 1024 * 1024, 1024 * 1024), 30);
  assert.equal(policy.uploadChunkCount((30 * 1024 * 1024) + 1, 1024 * 1024), 31);
  assert.equal(policy.uploadChunkCount(0, 1024 * 1024), 1);
});
