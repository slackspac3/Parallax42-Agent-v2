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

  function isFlowingProse(value) {
    const clean = cleanText(value);
    return clean.length >= 12
      && /[.!?]/.test(clean)
      && !/^(next questions?:|gateway fallback:|smart intake unavailable\b)/i.test(clean);
  }

  function isNaturalResponseCandidate(value) {
    const clean = cleanText(value);
    return clean.length >= 12
      && /[.!?]/.test(clean)
      && !/^(next questions?:|gateway fallback:|smart intake unavailable\b|smart intake degraded\b)/i.test(clean);
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
    const steps = Array.isArray(message && message.thinkingSteps) && message.thinkingSteps.length
      ? message.thinkingSteps
      : isCouncil
      ? [
          ['Thinking', 'Checking case readiness and human approval boundary'],
          ['Retrieving', 'Looking for citation-ready evidence and prior reviewer memory'],
          ['Analysing', 'Running specialist validation across obligations, evidence, controls, and RAI'],
          ['Formulating', 'Preparing the decision room and reviewer handoff']
        ]
      : [
          ['Working', 'Reading your message and updating the working case'],
          ['Checking context', 'Reviewing case facts, evidence metadata, and the current question'],
          ['Still working', 'Waiting for the intake response from the API'],
          ['Preparing reply', 'The request is still in progress']
        ];
    const visibleSteps = steps;
    const activeIndex = Math.max(0, Math.min(visibleSteps.length - 1, Number(message && message.thinkingStepIndex || 0)));
    const activeStep = visibleSteps[activeIndex] || visibleSteps[0] || [];
    const attemptLabel = cleanText(message && message.attemptLabel);
    const elapsed = Number(message && message.elapsedSeconds || 0);
    const startedAt = Number(message && message.startedAt || Date.now());
    return `
      <div class="thinking-loader" data-start-time="${escapeHtml(String(startedAt))}" aria-label="Advisor is working">
        <div class="thinking-loader-head">
          <span class="thinking-orb" aria-hidden="true"></span>
          <div class="thinking-loader-copy">
            <strong>${escapeHtml(message && message.phaseTitle || activeStep[0] || activeStep.label || (isCouncil ? 'Council is working' : 'Advisor is thinking'))}</strong>
            <p>${escapeHtml(message && message.phaseDetail || activeStep[1] || activeStep.detail || '')}${elapsed ? ` <span class="thinking-elapsed">(${escapeHtml(String(elapsed))}s...)</span>` : ''}</p>
          </div>
          ${attemptLabel ? `<span class="thinking-attempt-pill">${escapeHtml(attemptLabel)}</span>` : ''}
        </div>
        <div class="thinking-steps">
          ${visibleSteps.map(function renderStep(step, index) {
            const label = Array.isArray(step) ? step[0] : step.label;
            const detail = Array.isArray(step) ? step[1] : step.detail;
            const tone = Array.isArray(step) ? '' : cleanText(step.tone);
            return `
              <div class="thinking-step ${tone ? `is-${escapeHtml(tone)}` : ''} ${index === activeIndex ? 'is-active' : ''} ${index < activeIndex ? 'is-complete' : ''}" style="--step-index: ${index}">
                <span>${escapeHtml(label)}</span>
                <p>${escapeHtml(detail)}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function hintChipsForQuestion(question) {
    const clean = cleanText(question).toLowerCase();
    if (!clean) return [];
    if (/geograph|jurisdiction|perimeter|region|where/i.test(clean)) {
      return ['UAE and India', 'Global / all jurisdictions', 'Not known yet'];
    }
    if (/owner|business unit|workflow owner|accountable|internally/i.test(clean)) {
      return ['Technology Risk owns it', 'Finance owns it', 'Not known yet'];
    }
    if (/evidence|proof|document|source|upload|agreement|contract|clause/i.test(clean)) {
      return ['I have a signed agreement', 'Evidence is pending', 'Not available yet'];
    }
    if (/focus|scope|prioriti|checked/i.test(clean)) {
      return ['All material risks', 'Privacy and data protection', 'Access controls'];
    }
    return ['I am not sure yet', 'Use the uploaded document', 'Ask me the next question'];
  }

  function normalizeHintChip(chip) {
    if (typeof chip === 'string') {
      const label = cleanText(chip);
      return label ? { label, prompt: label } : null;
    }
    if (!chip || typeof chip !== 'object') return null;
    const label = cleanText(chip.label || chip.prompt || chip.action);
    const action = cleanText(chip.action);
    const prompt = chip.prompt === undefined || chip.prompt === null ? label : String(chip.prompt);
    if (!label || (!action && !cleanText(prompt))) return null;
    return { label, action, prompt };
  }

  function renderAssistantHintChips(chips = []) {
    const normalized = chips.map(normalizeHintChip).filter(Boolean).slice(0, 3);
    if (!normalized.length) return '';
    return `
      <div class="advisor-hint-chips">
        ${normalized.map((chip) => chip.action
          ? `<button type="button" data-chat-action="${escapeHtml(chip.action)}">${escapeHtml(chip.label)}</button>`
          : `<button type="button" data-hint-chip="${escapeHtml(chip.prompt)}">${escapeHtml(chip.label)}</button>`
        ).join('')}
      </div>
    `;
  }

  function hasActionChip(chips = [], action = '') {
    return chips.some((chip) => cleanText(normalizeHintChip(chip)?.action) === action);
  }

  function renderSmartIntakeDegraded(state = {}) {
    if (!state.smartIntakeDegraded) return '';
    const heading = state.smartIntakeDiagnostic ? 'Smart intake fallback' : 'Smart intake degraded';
    const fallback = state.smartIntakeDiagnostic
      ? 'Smart intake used deterministic fallback for this turn because the live advisory response could not be parsed.'
      : 'Compass is busy, so deterministic intake handled this turn.';
    return `
      <div class="advisor-degraded-note">
        <strong>${escapeHtml(heading)}</strong>
        <p>${escapeHtml(state.degradedMessage || fallback)}</p>
      </div>
    `;
  }

  function normalizeStructuredProse(value = '') {
    return cleanText(value)
      .replace(/\s+(\d{1,2})[).]\s+/g, '\n\n$1. ')
      .replace(/\s+-\s+(Risks|What to check\/require|What to check|What to require|Signals|Missing evidence|Required actions|Controls to require):\s*/gi, '\n$1:\n')
      .replace(/\s+[•]\s+/g, '\n- ')
      .replace(/\s+-\s+/g, '\n- ')
      .replace(/\s+(Risks|What to check\/require|What to check|What to require|Signals|Missing evidence|Required actions|Controls to require):\s*/gi, '\n$1:\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function shouldUseStructuredProse(value = '') {
    const clean = cleanText(value);
    if (clean.length < 520) return false;
    const numbered = (clean.match(/\b\d{1,2}[).]\s+[A-Z]/g) || []).length;
    const bullets = (clean.match(/\s(?:-|•)\s+/g) || []).length;
    const labels = (clean.match(/\b(?:Risks|What to check\/require|What to check|Required actions|Missing evidence):/gi) || []).length;
    return numbered >= 2 || bullets >= 3 || labels >= 2;
  }

  function sectionPartsFromStructuredProse(value = '') {
    const normalized = normalizeStructuredProse(value);
    if (!normalized) return [];
    const rawParts = normalized.split(/\n+/).map((part) => part.trim()).filter(Boolean);
    const parts = [];
    for (const part of rawParts) {
      const heading = part.match(/^(\d{1,2})\.\s+(.+)$/);
      if (heading) {
        parts.push({ type: 'heading', index: heading[1], text: heading[2] });
      } else if (/^[-•]\s+/.test(part)) {
        parts.push({ type: 'bullet', text: part.replace(/^[-•]\s+/, '') });
      } else if (/^[A-Z][A-Za-z /-]{2,44}:$/.test(part)) {
        parts.push({ type: 'label', text: part.replace(/:$/, '') });
      } else {
        parts.push({ type: 'paragraph', text: part });
      }
    }
    return parts;
  }

  function renderAssistantProse(value = '') {
    if (!shouldUseStructuredProse(value)) {
      return `<p>${escapeHtml(value)}</p>`;
    }
    const parts = sectionPartsFromStructuredProse(value);
    if (!parts.length) return `<p>${escapeHtml(value)}</p>`;

    const output = [];
    let current = null;
    const closeList = () => {
      if (current && current.listOpen) {
        output.push('</ul>');
        current.listOpen = false;
      }
    };
    const closeSection = () => {
      if (current) {
        closeList();
        output.push('</section>');
        current = null;
      }
    };

    for (const part of parts) {
      if (part.type === 'heading') {
        closeSection();
        current = { listOpen: false };
        output.push(`
          <section class="advisor-prose-section">
            <h4><span>${escapeHtml(part.index)}</span>${escapeHtml(part.text)}</h4>
        `);
      } else if (part.type === 'bullet') {
        if (!current) {
          current = { listOpen: false };
          output.push('<section class="advisor-prose-section is-implicit">');
        }
        if (!current.listOpen) {
          output.push('<ul>');
          current.listOpen = true;
        }
        output.push(`<li>${escapeHtml(part.text)}</li>`);
      } else if (part.type === 'label') {
        if (!current) {
          current = { listOpen: false };
          output.push('<section class="advisor-prose-section is-implicit">');
        }
        closeList();
        output.push(`<strong class="advisor-prose-label">${escapeHtml(part.text)}</strong>`);
      } else {
        if (current) {
          closeList();
          output.push(`<p>${escapeHtml(part.text)}</p>`);
        } else {
          output.push(`<p>${escapeHtml(part.text)}</p>`);
        }
      }
    }
    closeSection();
    return output.join('');
  }

  function renderAssistantTurn(message, context) {
    const state = context || {};
    if (state.smartIntakeUnavailable) {
      return `
        <div class="advisor-response-card advisor-system-warning">
          <div class="advisor-response-head">
            <strong>Smart intake unavailable</strong>
            <p>${escapeHtml(state.unavailableMessage || 'Compass gateway is not configured — smart intake is unavailable. Contact your administrator.')}</p>
          </div>
        </div>
      `;
    }
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
    const responseText = cleanText(state.responseText || state.acknowledgement || 'I updated the review context.');
    const proseText = String((message && message.text) || state.responseText || '');
    const suppliedChips = state.isLatest && Array.isArray(state.hintChips) && state.hintChips.length ? state.hintChips : [];
    const runChipSupplied = hasActionChip(suppliedChips, 'run-council');
    const questionText = cleanText(state.question);
    const responseIncludesQuestion = questionText
      && responseText.toLowerCase().includes(questionText.toLowerCase().slice(0, Math.min(80, questionText.length)));
    if (isFlowingProse(proseText) || (state.preferNaturalResponse && isNaturalResponseCandidate(proseText))) {
      return `
        <div class="advisor-response-card advisor-natural-response advisor-chat-only">
          ${renderSmartIntakeDegraded(state)}
          <div class="advisor-prose-response">
            ${renderAssistantProse(proseText)}
          </div>
          ${!state.canRun && questionText && !responseIncludesQuestion ? `
            <div class="advisor-next-question">
              <span class="eyebrow">Next question</span>
              <strong>${escapeHtml(questionText)}</strong>
              <p>Short answer is fine. Say “unknown” if it is pending.</p>
            </div>
          ` : ''}
          ${state.canRun && !runChipSupplied ? `
            <div class="assistant-next">
              <button type="button" data-chat-action="run-council">Run council</button>
            </div>
          ` : ''}
          ${renderAssistantHintChips(suppliedChips)}
        </div>
      `;
    }
    const chips = suppliedChips.length ? suppliedChips : state.canRun || responseIncludesQuestion ? [] : hintChipsForQuestion(questionText);
    return `
      <div class="advisor-response-card advisor-natural-response advisor-chat-only">
        ${renderSmartIntakeDegraded(state)}
        <div class="advisor-response-head">
          <p class="advisor-natural-copy">${escapeHtml(responseText)}</p>
          ${message && message.retryNote ? `<small class="intake-retry-note">${escapeHtml(message.retryNote)}</small>` : ''}
        </div>
        ${state.canRun || (!responseIncludesQuestion && questionText) ? `
          <div class="advisor-next-question">
            <span class="eyebrow">${escapeHtml(state.canRun ? 'Ready when you are' : 'Next question')}</span>
            <strong>${escapeHtml(state.canRun ? state.nextBestAction : questionText)}</strong>
            <p>${escapeHtml(state.canRun ? 'I can run the council now; human approval will still remain required.' : 'Short answer is fine. Say “unknown” if it is pending.')}</p>
            <div class="assistant-next">
              ${state.canRun && !hasActionChip(chips, 'run-council') ? '<button type="button" data-chat-action="run-council">Run council</button>' : ''}
            </div>
          </div>
        ` : ''}
        ${renderAssistantHintChips(chips)}
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
    isFlowingProse,
    isNaturalResponseCandidate,
    naturalizeAssistantLead,
    renderAssistantHistoryTurn,
    renderAssistantTurn,
    renderThinkingLoader
  };
})(window);
