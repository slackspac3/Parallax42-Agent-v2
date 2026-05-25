'use strict';

const KB = 1024;
const MB = 1024 * KB;

function parseByteLimit(name, fallback) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(b|kb|kib|mb|mib)?$/i);
  if (!match) return fallback;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  const unit = String(match[2] || 'b').toLowerCase();
  const multiplier = unit === 'mb' || unit === 'mib'
    ? MB
    : unit === 'kb' || unit === 'kib'
      ? KB
      : 1;
  return Math.floor(value * multiplier);
}

const CONVERSATION_BODY_LIMIT_BYTES = parseByteLimit('CONVERSATION_BODY_LIMIT_BYTES', 8 * MB);
const EVIDENCE_INDEX_BODY_LIMIT_BYTES = parseByteLimit('EVIDENCE_INDEX_BODY_LIMIT_BYTES', 15 * MB);
const EVIDENCE_SEARCH_BODY_LIMIT_BYTES = parseByteLimit('EVIDENCE_SEARCH_BODY_LIMIT_BYTES', 4 * MB);
const REVIEW_PACK_BODY_LIMIT_BYTES = parseByteLimit('REVIEW_PACK_BODY_LIMIT_BYTES', 8 * MB);
const STANDARD_RUN_BODY_LIMIT_BYTES = parseByteLimit('STANDARD_RUN_BODY_LIMIT_BYTES', 8 * MB);
const ADMIN_BODY_LIMIT_BYTES = parseByteLimit('ADMIN_BODY_LIMIT_BYTES', 512 * KB);
const EVIDENCE_UPLOAD_MAX_FILE_BYTES = parseByteLimit('EVIDENCE_UPLOAD_MAX_FILE_BYTES', 30 * MB);
const EVIDENCE_UPLOAD_MAX_BATCH_BYTES = parseByteLimit('EVIDENCE_UPLOAD_MAX_BATCH_BYTES', 90 * MB);
const EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES = parseByteLimit('EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES', MB);

function operationalRequestSettings() {
  return {
    requestLimits: {
      conversation: CONVERSATION_BODY_LIMIT_BYTES,
      evidenceIndex: EVIDENCE_INDEX_BODY_LIMIT_BYTES,
      evidenceSearch: EVIDENCE_SEARCH_BODY_LIMIT_BYTES,
      reviewPack: REVIEW_PACK_BODY_LIMIT_BYTES,
      standardRun: STANDARD_RUN_BODY_LIMIT_BYTES,
      admin: ADMIN_BODY_LIMIT_BYTES
    },
    uploadTargetLimits: {
      maxFileBytes: EVIDENCE_UPLOAD_MAX_FILE_BYTES,
      maxBatchBytes: EVIDENCE_UPLOAD_MAX_BATCH_BYTES,
      chunkSizeBytes: EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES
    }
  };
}

module.exports = {
  ADMIN_BODY_LIMIT_BYTES,
  CONVERSATION_BODY_LIMIT_BYTES,
  EVIDENCE_UPLOAD_CHUNK_SIZE_BYTES,
  EVIDENCE_UPLOAD_MAX_BATCH_BYTES,
  EVIDENCE_UPLOAD_MAX_FILE_BYTES,
  EVIDENCE_INDEX_BODY_LIMIT_BYTES,
  EVIDENCE_SEARCH_BODY_LIMIT_BYTES,
  REVIEW_PACK_BODY_LIMIT_BYTES,
  STANDARD_RUN_BODY_LIMIT_BYTES,
  operationalRequestSettings,
  parseByteLimit
};
