(function attachChatUiModule(window) {
  'use strict';

  const text = window.P42ModuleRegistry && window.P42ModuleRegistry.text;
  const cleanText = text ? text.cleanText : function fallbackClean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  };
  const escapeHtml = text && text.escapeHtml ? text.escapeHtml : function fallbackEscape(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  function assistantPreview(value) {
    const clean = cleanText(value);
    if (!clean) return 'I am updating the case draft.';
    return clean
      .replace(/^Got it\s*[—-]\s*/i, '')
      .replace(/\s+So far I have:.*$/i, '')
      .replace(/\s+What I found:.*$/i, '')
      .slice(0, 220);
  }

  function naturalizeAssistantLead(value) {
    const clean = cleanText(value)
      .replace(/^Got it\s*[—-]\s*/i, '')
      .replace(/\s+So far I have:.*$/i, '')
      .replace(/\s+What I found:.*$/i, '')
      .trim();
    if (!clean) return '';
    if (/I understand this as|I’m treating this as|I'm treating this as/i.test(clean)) {
      return clean
        .replace(/^I understand this as\s*:?\s*/i, 'I understand this as ')
        .replace(/^I’m treating this as\s*:?\s*/i, 'I’m treating this as ')
        .replace(/^I'm treating this as\s*:?\s*/i, 'I’m treating this as ')
        .replace(/\ba agreement\b/gi, 'an agreement')
        .replace(/\ba MSA\b/g, 'an MSA')
        .slice(0, 180);
    }
    return clean.slice(0, 180);
  }

  function assistantRawSummary(value) {
    const clean = cleanText(value);
    if (!clean) return 'I am updating the case draft.';
    if (/could not|failed|error/i.test(clean)) return clean;
    if (/I understand this as|I’m treating this as|I'm treating this as/i.test(clean)) {
      return naturalizeAssistantLead(clean) || 'I updated the review context.';
    }
    if (/what i understood|so far i have|next questions?|missing/i.test(clean)) {
      return 'I captured the useful facts and identified the next decision point.';
    }
    if (/ran|decision|approval|blocking|readiness/i.test(clean)) {
      return clean.split(/Next questions?:/i)[0].trim().slice(0, 260);
    }
    const firstSentence = clean.match(/^(.{1,240}?[.!?])\s/)?.[1];
    return firstSentence || clean.slice(0, 240);
  }

  function renderThinkingLoader(message) {
    const isCouncil = /council|workflow|retrieval|execut/i.test(message && message.text || '');
    const steps = isCouncil
      ? [
          ['Thinking', 'Checking case readiness and human approval boundary'],
          ['Retrieving', 'Looking for citation-ready evidence and prior reviewer memory'],
          ['Analysing', 'Running specialist validation across obligations, evidence, controls, and RAI'],
          ['Formulating', 'Preparing the decision room and reviewer handoff']
        ]
      : [
          ['Thinking', 'Reading your message and updating the working case'],
          ['Analysing', 'Extracting owner, geography, data, integrations, evidence, and risk signals'],
          ['Retrieving', 'Checking indexed evidence before asking for anything missing'],
          ['Formulating', 'Choosing one useful next question']
        ];
    return `
      <div class="thinking-loader" aria-label="Advisor is working">
        <div class="thinking-loader-head">
          <span class="thinking-orb" aria-hidden="true"></span>
          <strong>${escapeHtml(isCouncil ? 'Council is working' : 'Advisor is thinking')}</strong>
        </div>
        <div class="thinking-steps">
          ${steps.map(function renderStep(step, index) {
            return `
              <div class="thinking-step" style="--step-index: ${index}">
                <span>${escapeHtml(step[0])}</span>
                <p>${escapeHtml(step[1])}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderAssistantTurn(message, context) {
    const state = context || {};
    if (!state.hasChatContext && !state.lastRunOk && state.chatMessageCount <= 1) {
      return `
        <div class="advisor-response-card advisor-welcome-response">
          <div class="advisor-response-head">
            <strong>What do you need reviewed?</strong>
            <p>Tell me in one or two sentences. Attach evidence now or later.</p>
          </div>
        </div>
      `;
    }
    return `
      <div class="advisor-response-card advisor-natural-response advisor-chat-only">
        <div class="advisor-response-head">
          <strong>${escapeHtml(state.acknowledgement || 'I updated the review context.')}</strong>
        </div>
        <div class="advisor-next-question">
          <span class="eyebrow">${escapeHtml(state.canRun ? 'Ready when you are' : 'Next question')}</span>
          <strong>${escapeHtml(state.canRun ? state.nextBestAction : state.question)}</strong>
          <p>${escapeHtml(state.canRun ? 'I can run the council now; human approval will still remain required.' : 'Short answer is fine. Say “unknown” if it is pending.')}</p>
          <div class="assistant-next">
            ${state.canRun ? '<button type="button" data-chat-action="run-council">Run council</button>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderAssistantHistoryTurn(message) {
    return `
      <div class="advisor-history-bubble">
        <p>${escapeHtml(assistantRawSummary(message && message.text))}</p>
      </div>
    `;
  }

  function chatCouncilActivityForDraft(draft, missingFields, runReadiness) {
    const record = draft || {};
    const missing = Array.isArray(missingFields) ? missingFields : [];
    const readiness = runReadiness || {};
    const missingText = missing.join(' ').toLowerCase();
    const hasOwner = Boolean(cleanText(record.businessUnit));
    const hasGeography = Boolean(cleanText(record.geography));
    const hasEvidence = Boolean(
      (record.documents && record.documents.length)
      || (record.evidenceSignals && record.evidenceSignals.length)
      || (record.retrievalContext && record.retrievalContext.evidenceMatches && record.retrievalContext.evidenceMatches.length)
    );
    const hasRiskSignals = Boolean((record.riskSignals && record.riskSignals.length) || (record.evidenceSignals && record.evidenceSignals.length));
    const runnable = Boolean(readiness.runnable);
    const intakeComplete = hasOwner && hasGeography;
    const obligationComplete = intakeComplete && (hasRiskSignals || hasEvidence || runnable);
    const evidenceActive = intakeComplete && !hasEvidence && /evidence/.test(missingText);
    return [
      {
        label: 'Intake Agent',
        detail: intakeComplete ? 'case scoped' : 'asking next question',
        status: intakeComplete ? 'complete' : 'active'
      },
      {
        label: 'Obligation Mapper',
        detail: hasGeography || hasRiskSignals ? 'domains scoped' : 'waiting for perimeter',
        status: obligationComplete ? 'complete' : intakeComplete ? 'active' : 'queued'
      },
      {
        label: 'Evidence Examiner',
        detail: hasEvidence ? 'evidence signals found' : /evidence/.test(missingText) ? 'needs proof' : 'queued',
        status: hasEvidence ? 'complete' : evidenceActive ? 'active' : 'queued'
      },
      {
        label: 'Risk & Controls',
        detail: runnable ? 'ready for council' : 'waiting for evidence and owner',
        status: runnable ? 'active' : 'queued'
      },
      {
        label: 'Responsible AI',
        detail: 'human approval boundary locked',
        status: 'queued'
      },
      {
        label: 'Audit Packager',
        detail: 'waiting for council output',
        status: 'queued'
      }
    ];
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.chatUi = {
    assistantPreview,
    assistantRawSummary,
    chatCouncilActivityForDraft,
    naturalizeAssistantLead,
    renderAssistantHistoryTurn,
    renderAssistantTurn,
    renderThinkingLoader
  };
})(window);
