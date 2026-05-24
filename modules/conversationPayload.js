(function attachConversationPayloadModule(window) {
  'use strict';

  const registry = window.P42ModuleRegistry || {};
  const text = registry.text || {};
  const cleanText = text.cleanText || function fallbackCleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  };
  const unique = text.unique || function fallbackUnique(values) {
    return Array.from(new Set((values || []).map(function normalize(value) {
      return String(value || '').trim();
    }).filter(Boolean)));
  };

  const MAX_DOCUMENT_TEXT_CHARS = 1000;
  const MAX_SUMMARY_CHARS = 1000;
  const MAX_BRIEF_CHARS = 5000;
  const MAX_MEMORY_CHARS = 3000;
  const MAX_LIST_ITEMS = 50;
  const RAW_TEXT_FIELDS = ['text', 'rawText', 'content', 'fullText', 'extractedText', 'ocrText', 'body'];

  function capText(value, maxLength) {
    const clean = cleanText(value || '');
    if (!clean) return '';
    return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
  }

  function copyString(target, key, value, maxLength) {
    const clean = capText(value, maxLength || MAX_SUMMARY_CHARS);
    if (clean) target[key] = clean;
  }

  function copyNumber(target, key, value) {
    if (value === undefined || value === null || value === '') return;
    const number = Number(value);
    if (Number.isFinite(number)) target[key] = number;
  }

  function copyBoolean(target, key, value) {
    if (typeof value === 'boolean') target[key] = value;
  }

  function sanitizeStringList(values, maxItems) {
    return unique(Array.isArray(values) ? values : []).slice(0, maxItems || MAX_LIST_ITEMS);
  }

  function sanitizeDictionary(value, maxLength) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.entries(value).reduce(function build(accumulator, entry) {
      const key = cleanText(entry[0]);
      const item = entry[1];
      if (!key) return accumulator;
      if (typeof item === 'boolean' || typeof item === 'number') {
        accumulator[key] = item;
      } else if (Array.isArray(item)) {
        accumulator[key] = sanitizeStringList(item, 20);
      } else if (item && typeof item === 'object') {
        accumulator[key] = sanitizeDictionary(item, maxLength);
      } else {
        const clean = capText(item, maxLength || MAX_SUMMARY_CHARS);
        if (clean) accumulator[key] = clean;
      }
      return accumulator;
    }, {});
  }

  function firstValue(item, keys) {
    for (const key of keys) {
      if (item && item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key];
    }
    return '';
  }

  function sanitizeIndexedEvidence(index = {}) {
    if (!index || typeof index !== 'object') return null;
    const next = {};
    copyString(next, 'caseId', firstValue(index, ['caseId', 'case_id']), 160);
    copyString(next, 'model', index.model, 160);
    copyString(next, 'storage', index.storage, 160);
    copyString(next, 'provider', index.provider, 160);
    copyString(next, 'updatedAt', index.updatedAt, 80);
    copyNumber(next, 'chunkCount', firstValue(index, ['chunkCount', 'chunk_count']));
    const evidenceIds = sanitizeStringList(index.evidenceIds || index.evidence_ids, MAX_LIST_ITEMS);
    const chunkIds = sanitizeStringList(index.chunkIds || index.chunk_ids, MAX_LIST_ITEMS);
    if (evidenceIds.length) next.evidenceIds = evidenceIds;
    if (chunkIds.length) next.chunkIds = chunkIds;
    copyBoolean(next, 'browserEmbeddingsRetained', index.browserEmbeddingsRetained);
    return Object.keys(next).length ? next : null;
  }

  function sanitizeReferenceItem(item = {}) {
    if (!item || typeof item !== 'object') return {};
    const next = {};
    [
      ['evidenceId', ['evidenceId', 'evidence_id']],
      ['chunkId', ['chunkId', 'chunk_id']],
      ['caseId', ['caseId', 'case_id']],
      ['title', ['title', 'fileName', 'file_name', 'name']],
      ['source', ['source', 'sourceType', 'source_type']],
      ['status', ['status', 'extractionStatus', 'extraction_status']]
    ].forEach(function copy(entry) {
      copyString(next, entry[0], firstValue(item, entry[1]), 240);
    });
    copyNumber(next, 'score', item.score);
    copyString(next, 'summary', item.summary, MAX_SUMMARY_CHARS);
    copyString(next, 'excerpt', firstValue(item, ['excerpt', 'snippet', 'matchedText', 'matched_text']), MAX_SUMMARY_CHARS);
    copyString(next, 'text', item.text, MAX_DOCUMENT_TEXT_CHARS);
    const signals = sanitizeStringList(item.signals, 20);
    if (signals.length) next.signals = signals;
    return next;
  }

  function sanitizeRetrievalContext(context = {}) {
    if (!context || typeof context !== 'object') return null;
    const next = {};
    copyString(next, 'query', context.query, 1000);
    copyString(next, 'model', context.model || context.governanceReferenceModel, 160);
    copyNumber(next, 'chunkCount', context.chunkCount);
    copyNumber(next, 'matchCount', context.matchCount);
    [
      ['matches', context.matches],
      ['evidenceMatches', context.evidenceMatches],
      ['governanceReferences', context.governanceReferences],
      ['similarCases', context.similarCases]
    ].forEach(function copyList(entry) {
      const values = Array.isArray(entry[1]) ? entry[1].map(sanitizeReferenceItem).filter(function hasValue(item) {
        return Object.keys(item).length;
      }).slice(0, 12) : [];
      if (values.length) next[entry[0]] = values;
    });
    if (context.learningSuggestions && typeof context.learningSuggestions === 'object') {
      next.learningSuggestions = sanitizeDictionary(context.learningSuggestions, MAX_SUMMARY_CHARS);
    }
    return Object.keys(next).length ? next : null;
  }

  function sanitizeDocumentForConversation(document = {}, options = {}) {
    if (!document || typeof document !== 'object') return {};
    const includeCappedText = options.includeCappedText !== false;
    const next = {};
    [
      ['evidenceId', ['evidenceId', 'evidence_id', 'documentId', 'document_id', 'id']],
      ['documentId', ['documentId', 'document_id']],
      ['title', ['title', 'fileName', 'file_name', 'name']],
      ['fileName', ['fileName', 'file_name', 'name']],
      ['sourceType', ['sourceType', 'source_type', 'mimeType', 'mime_type']],
      ['extractionStatus', ['extractionStatus', 'extraction_status']],
      ['indexStatus', ['indexStatus', 'index_status']],
      ['documentType', ['documentType', 'document_type']],
      ['mimeType', ['mimeType', 'mime_type']],
      ['parserProvider', ['parserProvider', 'provider_name', 'provider']]
    ].forEach(function copy(entry) {
      copyString(next, entry[0], firstValue(document, entry[1]), 240);
    });
    copyNumber(next, 'sizeBytes', firstValue(document, ['sizeBytes', 'file_size_bytes', 'size']));
    copyString(next, 'summary', document.summary || document.semanticParse?.semantic_summary || document.semantic_parse?.semantic_summary, MAX_SUMMARY_CHARS);
    copyString(next, 'excerpt', firstValue(document, ['excerpt', 'snippet']), MAX_SUMMARY_CHARS);
    copyString(next, 'snippet', document.snippet, MAX_SUMMARY_CHARS);
    if (includeCappedText) {
      RAW_TEXT_FIELDS.forEach(function copyRawField(field) {
        if (document[field] !== undefined && document[field] !== null) {
          copyString(next, field, document[field], MAX_DOCUMENT_TEXT_CHARS);
        }
      });
    }
    const signals = sanitizeStringList(document.signals, 30);
    const documentEvidenceIds = sanitizeStringList(document.documentEvidenceIds || document.document_evidence_ids, MAX_LIST_ITEMS);
    const indexedChunkIds = sanitizeStringList(document.indexedChunkIds || document.indexed_chunk_ids || document.chunkIds || document.chunk_ids, MAX_LIST_ITEMS);
    if (signals.length) next.signals = signals;
    if (documentEvidenceIds.length) next.documentEvidenceIds = documentEvidenceIds;
    if (indexedChunkIds.length) next.indexedChunkIds = indexedChunkIds;
    return next;
  }

  function sanitizeUploadedEvidenceForConversationPayload(items = []) {
    return (Array.isArray(items) ? items : []).map(function sanitize(item) {
      const doc = sanitizeDocumentForConversation(item, { includeCappedText: false });
      const next = {};
      [
        'evidenceId',
        'title',
        'fileName',
        'sizeBytes',
        'extractionStatus',
        'documentType',
        'summary',
        'excerpt',
        'signals',
        'indexedChunkIds'
      ].forEach(function copy(key) {
        if (doc[key] !== undefined && doc[key] !== null && (!(Array.isArray(doc[key])) || doc[key].length)) {
          next[key] = doc[key];
        }
      });
      return next;
    });
  }

  function sanitizeDraftForConversationPayload(draft = {}) {
    if (!draft || typeof draft !== 'object') return {};
    const next = {};
    [
      ['caseId', 160],
      ['supplierName', 300],
      ['businessUnit', 300],
      ['geography', 300],
      ['brief', MAX_BRIEF_CHARS],
      ['serviceDescription', MAX_BRIEF_CHARS],
      ['activeQuestion', 1000],
      ['currentEventType', 120],
      ['conversationSummary', MAX_MEMORY_CHARS],
      ['memorySummary', MAX_MEMORY_CHARS]
    ].forEach(function copy(entry) {
      copyString(next, entry[0], draft[entry[0]], entry[1]);
    });
    ['caseRequestStarted', 'smartIntakeUnavailable', 'smartIntakeDegraded'].forEach(function copy(key) {
      copyBoolean(next, key, draft[key]);
    });
    [
      ['integrations', 30],
      ['evidenceSignals', 60],
      ['riskSignals', 60],
      ['knownGaps', 60],
      ['questions', 20],
      ['askedQuestions', 40]
    ].forEach(function copy(entry) {
      const values = sanitizeStringList(draft[entry[0]], entry[1]);
      if (values.length) next[entry[0]] = values;
    });
    if (draft.recentlyAnsweredFields) next.recentlyAnsweredFields = sanitizeDictionary(draft.recentlyAnsweredFields, 120);
    if (draft.documentContext) next.documentContext = sanitizeDictionary(draft.documentContext, MAX_SUMMARY_CHARS);
    if (draft.llmIntake) next.llmIntake = sanitizeDictionary(draft.llmIntake, MAX_SUMMARY_CHARS);
    if (draft.intakeAssessment) next.intakeAssessment = sanitizeDictionary(draft.intakeAssessment, MAX_SUMMARY_CHARS);
    const indexedEvidence = sanitizeIndexedEvidence(draft.indexedEvidence);
    const retrievalContext = sanitizeRetrievalContext(draft.retrievalContext);
    if (indexedEvidence) next.indexedEvidence = indexedEvidence;
    if (retrievalContext) next.retrievalContext = retrievalContext;
    if (Array.isArray(draft.documents)) {
      next.documents = draft.documents.map(function sanitize(document) {
        return sanitizeDocumentForConversation(document, { includeCappedText: true });
      }).filter(function hasDocument(document) {
        return Object.keys(document).length;
      }).slice(0, 40);
    } else {
      next.documents = [];
    }
    return next;
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.conversationPayload = {
    MAX_DOCUMENT_TEXT_CHARS,
    sanitizeDocumentForConversation,
    sanitizeDraftForConversationPayload,
    sanitizeUploadedEvidenceForConversationPayload
  };
})(window);
