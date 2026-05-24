(function attachEvidenceIndexRestoreModule(window) {
  'use strict';

  const EXPIRED_INDEX_WARNING = 'Previous evidence index expired; re-upload evidence for semantic retrieval.';

  function numeric(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function hasCaseId(meta = {}) {
    return Boolean(meta && typeof meta === 'object' && meta.caseId);
  }

  function validationCounts(response = {}) {
    const matches = Array.isArray(response.matches) ? response.matches : [];
    const index = response.index && typeof response.index === 'object' ? response.index : {};
    const hasIndex = Boolean(response.index && typeof response.index === 'object');
    const chunkCount = numeric(index.chunkCount ?? index.chunk_count ?? response.chunkCount ?? response.chunk_count, 0);
    return { chunkCount, hasIndex, matchCount: matches.length };
  }

  function evidenceIndexValidationStatus(meta = {}, response = null) {
    if (!hasCaseId(meta)) {
      return {
        status: 'not_checked',
        detail: 'No restored evidence index metadata is present.'
      };
    }
    if (!response || typeof response !== 'object') {
      return {
        status: 'not_checked',
        detail: 'Restored evidence metadata has not been validated yet.'
      };
    }
    const counts = validationCounts(response);
    if (counts.hasIndex && counts.chunkCount === 0 && counts.matchCount === 0) {
      return {
        status: 'expired',
        detail: EXPIRED_INDEX_WARNING,
        chunkCount: 0,
        matchCount: 0
      };
    }
    if (!counts.hasIndex && counts.matchCount === 0) {
      return {
        status: 'not_checked',
        detail: 'Evidence index validation did not return server index metadata.',
        chunkCount: 0,
        matchCount: 0
      };
    }
    return {
      status: 'valid',
      detail: `${counts.chunkCount || 'Server-side'} evidence chunk${counts.chunkCount === 1 ? '' : 's'} available for semantic retrieval.`,
      chunkCount: counts.chunkCount,
      matchCount: counts.matchCount
    };
  }

  function reconcileRestoredEvidenceIndexValidation({ meta = {}, draft = {}, response = null } = {}) {
    const validation = evidenceIndexValidationStatus(meta, response);
    if (validation.status !== 'expired') {
      return {
        validation,
        evidenceIndexMeta: meta || {},
        chatCaseDraft: draft || {},
        shouldClearStorage: false,
        warning: ''
      };
    }
    const nextDraft = { ...(draft || {}) };
    delete nextDraft.indexedEvidence;
    return {
      validation,
      evidenceIndexMeta: {},
      chatCaseDraft: nextDraft,
      shouldClearStorage: true,
      warning: EXPIRED_INDEX_WARNING
    };
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.evidenceIndexRestore = {
    EXPIRED_INDEX_WARNING,
    evidenceIndexValidationStatus,
    reconcileRestoredEvidenceIndexValidation
  };
})(window);
