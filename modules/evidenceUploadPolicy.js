(function attachEvidenceUploadPolicyModule(window) {
  'use strict';

  const maxEvidenceFileBytes = 30 * 1024 * 1024;
  const maxEvidenceBatchBytes = 90 * 1024 * 1024;
  const defaultUploadChunkBytes = 1024 * 1024;

  function formatBytes(bytes = 0) {
    const value = Number(bytes || 0);
    if (value >= 1024 * 1024) return `${Math.round(value / (1024 * 1024))} MB`;
    if (value >= 1024) return `${Math.round(value / 1024)} KB`;
    return `${value} B`;
  }

  function normalizeFiles(files = []) {
    return Array.from(files || []).filter(Boolean);
  }

  function validateEvidenceFileSelection(files = [], options = {}) {
    const selected = normalizeFiles(files);
    const fileLimit = Number(options.maxFileBytes || maxEvidenceFileBytes);
    const batchLimit = Number(options.maxBatchBytes || maxEvidenceBatchBytes);
    const oversized = selected.find((file) => Number(file.size || 0) > fileLimit);
    if (oversized) {
      return {
        ok: false,
        reason: 'file_too_large',
        message: `${oversized.name || 'Selected file'} is ${formatBytes(oversized.size)}. Evidence uploads are limited to 30 MB per file max.`
      };
    }
    const totalBytes = selected.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalBytes > batchLimit) {
      return {
        ok: false,
        reason: 'batch_too_large',
        message: `Selected evidence totals ${formatBytes(totalBytes)}. Upload up to 90 MB per batch.`
      };
    }
    return { ok: true, files: selected, totalBytes };
  }

  function uploadChunkCount(fileSize = 0, chunkSize = defaultUploadChunkBytes) {
    const bytes = Math.max(0, Number(fileSize || 0));
    const size = Math.max(1, Number(chunkSize || defaultUploadChunkBytes));
    return Math.max(1, Math.ceil(bytes / size));
  }

  async function sha256File(file) {
    if (!window.crypto?.subtle?.digest) {
      throw new Error('SHA-256 hashing is unavailable in this browser.');
    }
    const hash = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async function buildUploadInitFiles(files = [], options = {}) {
    const hashFile = typeof options.hashFile === 'function' ? options.hashFile : sha256File;
    const selected = normalizeFiles(files);
    const output = [];
    for (const file of selected) {
      output.push({
        file_name: file.name,
        content_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
        sha256: await hashFile(file)
      });
    }
    return output;
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.evidenceUploadPolicy = {
    buildUploadInitFiles,
    defaultUploadChunkBytes,
    formatBytes,
    maxEvidenceBatchBytes,
    maxEvidenceFileBytes,
    sha256File,
    uploadChunkCount,
    validateEvidenceFileSelection
  };
})(window);
