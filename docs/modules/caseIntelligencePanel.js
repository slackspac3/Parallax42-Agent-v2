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

  function contextStrength(draft) {
    const record = draft || {};
    const documents = Array.isArray(record.documents) ? record.documents : [];
    const evidenceSignals = Array.isArray(record.evidenceSignals) ? record.evidenceSignals : [];
    const riskSignals = Array.isArray(record.riskSignals) ? record.riskSignals : [];
    const integrations = Array.isArray(record.integrations) ? record.integrations : [];
    let score = 0;
    if (cleanEvidenceText(record.brief).length > 32) score += 20;
    if (cleanEvidenceText(record.businessUnit)) score += 18;
    if (cleanEvidenceText(record.geography)) score += 16;
    if (riskSignals.length) score += Math.min(18, 8 + riskSignals.length * 4);
    if (integrations.length) score += Math.min(10, integrations.length * 5);
    if (evidenceSignals.length || documents.length) score += Math.min(28, 12 + (evidenceSignals.length + documents.length) * 4);
    if (record.indexedEvidence && record.indexedEvidence.chunkCount) score += Math.min(12, 6 + Math.round(record.indexedEvidence.chunkCount / 8));
    if (record.retrievalContext && Array.isArray(record.retrievalContext.matches) && record.retrievalContext.matches.length) {
      score += Math.min(10, 4 + record.retrievalContext.matches.length);
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
      (source.evidenceSignals && source.evidenceSignals.length)
      || (source.documents && source.documents.length)
      || (source.indexedEvidence && source.indexedEvidence.chunkCount)
      || (result && result.evidenceIds && result.evidenceIds.length)
      || (result && result.citations && result.citations.length)
    )) {
      missing.push('Evidence proof');
    }
    return missing.slice(0, 4);
  }

  function nextBestAction(input) {
    const settings = input || {};
    const result = settings.result || null;
    const readiness = settings.readiness || null;
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
    const docCount = Array.isArray(draft.documents) ? draft.documents.length : 0;
    const uploadedCount = evidence.length;
    const indexed = Number((draft.indexedEvidence && draft.indexedEvidence.chunkCount) || indexMeta.chunkCount || 0);
    const metadataOnly = evidence.filter(function isMetadataOnly(item) {
      return item.extractionStatus === 'binary_registered';
    }).length;
    if (indexed) return `${indexed} citation-ready chunk${indexed === 1 ? '' : 's'}`;
    if (metadataOnly) return `${metadataOnly} metadata-only file${metadataOnly === 1 ? '' : 's'}`;
    if (docCount || uploadedCount) return `${docCount || uploadedCount} evidence item${(docCount || uploadedCount) === 1 ? '' : 's'} captured`;
    return 'No evidence attached yet';
  }

  function compactUiLabel(value, maxLength) {
    const limit = Number(maxLength) || 48;
    const label = cleanEvidenceText(value);
    if (label.length <= limit) return label;
    return `${label.slice(0, Math.max(0, limit - 3)).trim()}...`;
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.caseIntelligencePanel = {
    compactUiLabel,
    contextCopy,
    contextStrength,
    evidenceStatusSummary,
    missingProofItems,
    nextBestAction,
    titleCase,
    unique
  };
})(window);
