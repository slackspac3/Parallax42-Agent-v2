'use strict';

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function documentEvidenceText(document = {}) {
  return cleanText([
    document.summary,
    document.text,
    document.excerpt,
    ...(Array.isArray(document.signals) ? document.signals : [])
  ].filter(Boolean).join(' '));
}

function evidenceProvenance(document = {}) {
  const sourceType = cleanText(document.sourceType || document.source || document.metadata?.sourceType).toLowerCase();
  const extractionStatus = cleanText(document.extractionStatus || document.metadata?.extractionStatus).toLowerCase();
  if (sourceType === 'chat_message') return 'chat_message';
  const explicit = cleanText(document.provenance).toLowerCase();
  if (['chat_message', 'policy_reference', 'semantic_retrieval', 'demo_fixture', 'uploaded_document', 'submitted_document'].includes(explicit)) return explicit;
  if (/policy|governance_reference|legal_reference/.test(sourceType)) return 'policy_reference';
  if (sourceType === 'semantic_retrieval' || extractionStatus === 'retrieved_chunk') return 'semantic_retrieval';
  if (/fixture/.test(sourceType)) return 'demo_fixture';
  if (document.fileName || document.filename || /parsed|text_extracted|sampled_text|metadata_fallback/.test(extractionStatus)) return 'uploaded_document';
  return 'submitted_document';
}

function isPlaceholderEvidenceText(value = '') {
  const text = cleanText(value);
  if (text.length < 20) return true;
  const compact = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compact || new Set(compact).size < 3) return true;
  return /\b(?:placeholder|dummy content|lorem ipsum|sample (?:document|text)|test (?:document|content))\b/i.test(text)
    || /^(?:document|content|evidence) (?:pending|unavailable|not available)$/i.test(text);
}

function isEvidenceBearingText(value = '') {
  const text = cleanText(value);
  return !isPlaceholderEvidenceText(text) && /\b(?:signed|approved|approval authority|contract|agreement|terms|clause|obligation|policy|procedure|control|assurance|attestation|audit report|soc\s*2|iso\s*27001|dpa|data processing|retention|deletion|subprocessor|certificate|permit|licen[cs]e|classification|screening|mfa|access control|encryption|logging|training|fine[- ]?tuning|human oversight|continuity|bcp|disaster recovery|recovery|exit assistance)\b/i.test(text);
}

function evidenceAssertionState(document = {}) {
  const provenance = evidenceProvenance(document);
  const text = documentEvidenceText(document);
  if (text.includes('?')) {
    return 'requested';
  }
  if (provenance === 'chat_message') {
    if (/\?|^(?:is|are|do|does|did|can|could|would|will|has|have|what|which|where|when|how)\b/i.test(text)) return 'requested';
    if (/\b(?:attached|uploaded|pasted|here is|here are)\b/i.test(text)) return 'provided';
    return 'mentioned';
  }
  if (provenance === 'policy_reference') return 'mentioned';
  if (provenance === 'semantic_retrieval' && isEvidenceBearingText(text)) return 'verified';
  if (isPlaceholderEvidenceText(text)) return 'provided';
  if (/parsed|text_extracted|sampled_text|metadata_fallback/i.test(document.extractionStatus || '')) return 'parsed';
  return 'provided';
}

function normaliseEvidenceDocument(value) {
  const document = typeof value === 'string' ? { text: value } : value && typeof value === 'object' ? { ...value } : {};
  return {
    ...document,
    evidenceId: cleanText(document.evidenceId || document.documentId || ''),
    provenance: evidenceProvenance(document),
    assertionState: evidenceAssertionState(document)
  };
}

function normaliseRetrievalEvidenceDocument(value = {}) {
  const match = value && typeof value === 'object' ? value : { text: value };
  return normaliseEvidenceDocument({
    ...match,
    chunkId: cleanText(match.chunkId || ''),
    evidenceId: cleanText(match.evidenceId || match.documentId || ''),
    title: cleanText(match.title || ''),
    score: Number(match.score || 0),
    text: cleanText(match.text || match.snippet || '').slice(0, 1400),
    metadata: match.metadata && typeof match.metadata === 'object' ? match.metadata : {},
    sourceType: 'semantic_retrieval',
    provenance: 'semantic_retrieval',
    extractionStatus: 'retrieved_chunk'
  });
}

function isUsableEvidenceDocument(document = {}) {
  const provenance = cleanText(document.provenance || evidenceProvenance(document));
  const assertionState = cleanText(document.assertionState || evidenceAssertionState(document));
  const extractionStatus = cleanText(document.extractionStatus || document.metadata?.extractionStatus).toLowerCase();
  return !['chat_message', 'policy_reference'].includes(provenance)
    && !['binary_registered', 'metadata_only'].includes(extractionStatus)
    && ['provided', 'parsed', 'verified'].includes(assertionState)
    && isEvidenceBearingText(documentEvidenceText(document));
}

function isUsableRetrievalEvidenceDocument(document = {}) {
  return isUsableEvidenceDocument(normaliseRetrievalEvidenceDocument(document));
}

module.exports = {
  documentEvidenceText,
  evidenceAssertionState,
  evidenceProvenance,
  isEvidenceBearingText,
  isPlaceholderEvidenceText,
  isUsableRetrievalEvidenceDocument,
  isUsableEvidenceDocument,
  normaliseEvidenceDocument,
  normaliseRetrievalEvidenceDocument
};
