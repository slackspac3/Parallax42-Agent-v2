(function attachCaseIntelligencePanelModule(window) {
  'use strict';

  const text = window.P42ModuleRegistry && window.P42ModuleRegistry.text;
  const cleanText = text ? text.cleanText : function fallbackClean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  };
  const unique = text && text.unique ? text.unique : function fallbackUnique(values) {
    return Array.from(new Set((values || []).map(function normalize(value) {
      return String(value || '').trim();
    }).filter(Boolean)));
  };

  function cleanEvidenceText(value) {
    return String(value || '')
      .replace(/\u0000/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function titleCase(value) {
    return cleanText(value)
      .replaceAll('_', ' ')
      .replace(/\b\w/g, function upper(letter) {
        return letter.toUpperCase();
      })
      .replace(/\bAi\b/g, 'AI')
      .replace(/\bRbac\b/g, 'RBAC');
  }

  function documentAssertionState(document) {
    const record = document || {};
    if (documentEvidenceText(record).includes('?')) return 'requested';
    const explicit = cleanEvidenceText(record.assertionState).toLowerCase();
    if (explicit) return explicit;
    const source = cleanEvidenceText(record.provenance || record.sourceType).toLowerCase();
    const extraction = cleanEvidenceText(record.extractionStatus).toLowerCase();
    if (source === 'chat_message') return 'mentioned';
    if (source === 'semantic_retrieval' || extraction === 'retrieved_chunk') return 'verified';
    if (/parsed|text_extracted|sampled_text|metadata_fallback/.test(extraction)) return 'parsed';
    if ((record.fileName || record.filename) && !/binary_registered|metadata_only/.test(extraction)) return 'provided';
    return 'mentioned';
  }

  function documentEvidenceText(document) {
    const record = document || {};
    return cleanEvidenceText([
      record.summary,
      record.text,
      record.excerpt,
      ...(Array.isArray(record.signals) ? record.signals : [])
    ].filter(Boolean).join(' '));
  }

  function isEvidenceBearingText(value) {
    const evidenceText = cleanEvidenceText(value);
    if (evidenceText.length < 20) return false;
    if (/\b(?:placeholder|dummy content|lorem ipsum|sample (?:document|text)|test (?:document|content))\b/i.test(evidenceText)) return false;
    return /\b(?:signed|approved|approval authority|contract|agreement|terms|clause|obligation|policy|procedure|control|assurance|attestation|audit report|soc\s*2|iso\s*27001|dpa|data processing|retention|deletion|subprocessor|certificate|permit|licen[cs]e|classification|screening|mfa|access control|encryption|logging|training|fine[- ]?tuning|human oversight|continuity|bcp|disaster recovery|recovery|exit assistance)\b/i.test(evidenceText);
  }

  function isUsableEvidenceDocument(document) {
    const record = document || {};
    const source = cleanEvidenceText(record.provenance || record.sourceType).toLowerCase();
    const extraction = cleanEvidenceText(record.extractionStatus).toLowerCase();
    const state = documentAssertionState(record);
    return source !== 'chat_message'
      && source !== 'policy_reference'
      && !/binary_registered|metadata_only/.test(extraction)
      && /^(provided|parsed|verified)$/.test(state)
      && isEvidenceBearingText(documentEvidenceText(record));
  }

  function isUsableRetrievalEvidenceDocument(match) {
    const record = match || {};
    return isUsableEvidenceDocument({
      ...record,
      text: record.text || record.snippet || '',
      sourceType: 'semantic_retrieval',
      provenance: 'semantic_retrieval',
      extractionStatus: 'retrieved_chunk'
    });
  }

  function usableEvidenceCount(draft) {
    const record = draft || {};
    const documents = Array.isArray(record.documents) ? record.documents : [];
    const retrieval = record.retrievalContext || {};
    const matches = Array.isArray(retrieval.matches)
      ? retrieval.matches
      : Array.isArray(retrieval.evidenceMatches) ? retrieval.evidenceMatches : [];
    return Math.max(
      documents.filter(isUsableEvidenceDocument).length,
      matches.filter(isUsableRetrievalEvidenceDocument).length
    );
  }

  function contextStrength(draft) {
    const record = draft || {};
    const documents = Array.isArray(record.documents) ? record.documents : [];
    const riskSignals = Array.isArray(record.riskSignals) ? record.riskSignals : [];
    const integrations = Array.isArray(record.integrations) ? record.integrations : [];
    const hasCaseRequest = Boolean(
      record.caseRequestStarted
      || cleanEvidenceText(record.brief).length > 32
      || cleanEvidenceText(record.businessUnit)
      || cleanEvidenceText(record.geography)
      || riskSignals.length
      || integrations.length
    );
    let score = 0;
    if (cleanEvidenceText(record.brief).length > 32) score += 20;
    if (cleanEvidenceText(record.businessUnit)) score += 18;
    if (cleanEvidenceText(record.geography)) score += 16;
    if (riskSignals.length) score += Math.min(18, 8 + riskSignals.length * 4);
    if (integrations.length) score += Math.min(10, integrations.length * 5);
    const usableEvidence = documents.filter(isUsableEvidenceDocument).length;
    if (hasCaseRequest && usableEvidence) score += Math.min(28, 12 + usableEvidence * 4);
    if (hasCaseRequest && record.indexedEvidence && record.indexedEvidence.chunkCount) score += Math.min(12, 6 + Math.round(record.indexedEvidence.chunkCount / 8));
    const retrievalMatches = record.retrievalContext && Array.isArray(record.retrievalContext.matches)
      ? record.retrievalContext.matches.filter(isUsableRetrievalEvidenceDocument)
      : [];
    if (hasCaseRequest && retrievalMatches.length) {
      score += Math.min(10, 4 + retrievalMatches.length);
    }
    return Math.min(100, score);
  }

  function contextCopy(score) {
    if (score >= 82) return ['Council ready', 'Enough context is present to run the council. Extra evidence will improve citations.'];
    if (score >= 58) return ['Nearly ready', 'A few more specifics or evidence files will make the council output stronger.'];
    if (score >= 32) return ['Building context', 'The advisor has a usable case shape but still needs owner, geography, evidence, or risk detail.'];
    return ['Needs intake', 'Add scope, owner, geography, evidence, and risk signals before running council.'];
  }

  function missingProofItems(input) {
    const settings = input || {};
    const draft = settings.draft || {};
    const result = settings.result || null;
    const readiness = settings.readiness || null;
    if (result && result.ok && Array.isArray(result.gaps) && result.gaps.length) {
      return result.gaps.map(function fromGap(gap) {
        return gap.gap || gap.action || 'Reviewer confirmation required';
      }).slice(0, 4);
    }
    const source = result && result.ok ? { ...draft, ...(result.case || {}) } : draft;
    const blockers = readiness && (readiness.executionBlockers || readiness.advisoryGaps || []);
    if (blockers && blockers.length) return blockers.map(titleCase).slice(0, 4);
    const missing = [];
    if (!cleanEvidenceText(source.businessUnit)) missing.push('Accountable owner');
    if (!cleanEvidenceText(source.geography)) missing.push('Geography');
    if (!(
      usableEvidenceCount(source)
      || (result && result.evidenceIds && result.evidenceIds.length)
      || (result && result.citations && result.citations.length)
    )) {
      missing.push('Evidence proof');
    }
    return missing.slice(0, 4);
  }

  function nextBestAction(input) {
    const settings = input || {};
    const draft = settings.draft || {};
    const result = settings.result || null;
    const readiness = settings.readiness || null;
    if (draft.councilStatus === 'superseded_pending_rerun' || draft.rerunRecommended) {
      return 'Rerun council with the updated case facts.';
    }
    if (result && result.ok) {
      const gaps = Array.isArray(result.gaps) ? result.gaps : [];
      if (gaps.length) return gaps[0].action || 'Assign the blocking gap to a human reviewer.';
      return 'Export the review pack and record the accountable human approval decision.';
    }
    const missing = missingProofItems(settings);
    if (missing.length) return `Add ${missing[0].toLowerCase()} to strengthen the case.`;
    if (readiness && readiness.runnable) return 'Run council to produce the decision room.';
    return 'Describe the supplier, owner, geography, data, integrations, and available evidence.';
  }

  function evidenceStatusSummary(input) {
    const settings = input || {};
    const draft = settings.draft || {};
    const evidence = Array.isArray(settings.uploadedEvidence) ? settings.uploadedEvidence : [];
    const indexMeta = settings.evidenceIndexMeta || {};
    const indexValidation = settings.evidenceIndexValidation || {};
    const docCount = Array.isArray(draft.documents) ? draft.documents.length : 0;
    const usableCount = usableEvidenceCount(draft);
    const retrieval = draft.retrievalContext || {};
    const retrievalCandidates = Array.isArray(retrieval.matches)
      ? retrieval.matches
      : Array.isArray(retrieval.evidenceMatches) ? retrieval.evidenceMatches : [];
    const usableRetrievalCount = retrievalCandidates.filter(isUsableRetrievalEvidenceDocument).length;
    const requestedRetrievalCount = retrievalCandidates.filter(function isRequestedRetrieval(item) {
      return documentAssertionState({
        ...(item || {}),
        text: (item && (item.text || item.snippet)) || '',
        sourceType: 'semantic_retrieval',
        provenance: 'semantic_retrieval',
        extractionStatus: 'retrieved_chunk'
      }) === 'requested';
    }).length;
    const requestedCount = (Array.isArray(draft.documents) ? draft.documents : []).filter(function isRequested(item) {
      return documentAssertionState(item) === 'requested';
    }).length;
    const metadataOnlyDraftCount = (Array.isArray(draft.documents) ? draft.documents : []).filter(function isMetadataOnlyDraft(item) {
      return /binary_registered|metadata_only/.test(cleanEvidenceText(item.extractionStatus).toLowerCase());
    }).length;
    const pendingValidationCount = (Array.isArray(draft.documents) ? draft.documents : []).filter(function isPendingValidation(item) {
      return !/binary_registered|metadata_only/.test(cleanEvidenceText(item.extractionStatus).toLowerCase())
        && /^(provided|parsed|verified)$/.test(documentAssertionState(item))
        && !isUsableEvidenceDocument(item);
    }).length;
    const mentionedCount = Math.max(0, docCount - usableCount - requestedCount - metadataOnlyDraftCount - pendingValidationCount);
    const indexed = Number((draft.indexedEvidence && draft.indexedEvidence.chunkCount) || indexMeta.chunkCount || 0);
    const metadataOnly = Math.max(metadataOnlyDraftCount, evidence.filter(function isMetadataOnly(item) {
      return /binary_registered|metadata_only/.test(cleanEvidenceText(item.extractionStatus).toLowerCase());
    }).length);
    if (indexValidation.status === 'expired') return 'Previous evidence index expired';
    if (indexed && indexValidation.status === 'not_checked') return `${indexed} chunk${indexed === 1 ? '' : 's'} pending validation`;
    if (usableRetrievalCount) return `${usableRetrievalCount} citation-ready match${usableRetrievalCount === 1 ? '' : 'es'}`;
    if (requestedRetrievalCount) return `${requestedRetrievalCount} evidence request${requestedRetrievalCount === 1 ? '' : 's'} retrieved · not verified`;
    if (indexed) return `${indexed} indexed chunk${indexed === 1 ? '' : 's'} · claim validation pending`;
    if (metadataOnly) return `${metadataOnly} metadata-only file${metadataOnly === 1 ? '' : 's'} · not verified`;
    const usableUploads = evidence.filter(isUsableEvidenceDocument).length;
    const usableTotal = Math.max(usableCount, usableUploads);
    if (usableTotal) return `${usableTotal} usable evidence item${usableTotal === 1 ? '' : 's'}`;
    if (requestedCount) return `${requestedCount} evidence request${requestedCount === 1 ? '' : 's'} noted · not verified`;
    if (pendingValidationCount) return `${pendingValidationCount} parsed or attached item${pendingValidationCount === 1 ? '' : 's'} · validation pending`;
    if (mentionedCount || (draft.evidenceSignals && draft.evidenceSignals.length)) {
      const count = mentionedCount || draft.evidenceSignals.length;
      return `${count} evidence mention${count === 1 ? '' : 's'} · not verified`;
    }
    return 'No evidence attached yet';
  }

  function compactUiLabel(value, maxLength) {
    const limit = Number(maxLength) || 48;
    const label = cleanEvidenceText(value);
    if (label.length <= limit) return label;
    return `${label.slice(0, Math.max(0, limit - 1)).trim()}…`;
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.caseIntelligencePanel = {
    compactUiLabel,
    contextCopy,
    contextStrength,
    evidenceStatusSummary,
    isEvidenceBearingText,
    isUsableEvidenceDocument,
    isUsableRetrievalEvidenceDocument,
    missingProofItems,
    nextBestAction,
    titleCase,
    unique,
    usableEvidenceCount
  };
})(window);
