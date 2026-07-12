(function attachDecisionRoomModule(window) {
  'use strict';

  const registry = window.P42ModuleRegistry || {};
  const text = registry.text || {};
  const componentAttributes = registry.appState?.componentAttributes || function fallbackComponentAttributes(slot, state) {
    return `data-slot="${slot}" data-state="${state}"`;
  };
  const cleanText = text.cleanText || function fallbackClean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  };
  const escapeHtml = text.escapeHtml || function fallbackEscape(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };
  const humanize = text.humanize || function fallbackHumanize(value) {
    return cleanText(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, function upper(letter) {
      return letter.toUpperCase();
    });
  };
  const unique = text.unique || function fallbackUnique(values) {
    return Array.from(new Set((values || []).map(function normalize(value) {
      return String(value || '').trim();
    }).filter(Boolean)));
  };

  function summarizeText(value, maxLength) {
    const limit = Number(maxLength) || 220;
    const clean = cleanText(value);
    if (!clean) return 'Evidence attached without extracted text.';
    return clean.length > limit ? `${clean.slice(0, Math.max(0, limit - 1)).trim()}…` : clean;
  }

  function evidenceDocuments(result) {
    return Array.isArray(result && result.case && result.case.documents) ? result.case.documents : [];
  }

  function summarizeRunForDecisionRoom(result) {
    const run = result || {};
    const gaps = Array.isArray(run.gaps) ? run.gaps : [];
    const citations = Array.isArray(run.citations) ? run.citations : [];
    const evidenceIds = Array.isArray(run.evidenceIds) ? run.evidenceIds : [];
    const recommendation = cleanText(run.decision && (run.decision.recommendation || run.decision.status));
    return {
      headline: /not approve|not ready|blocked/i.test(recommendation)
        ? 'Do not approve yet'
        : /conditional|human approval|ready/i.test(recommendation) ? 'Ready for human review' : recommendation || 'Review required',
      readinessPercent: Math.max(0, Math.min(100, Math.round(Number(run.decision && run.decision.readinessScore || 0) * 100))),
      gapCount: gaps.length,
      citationCount: citations.length,
      evidenceCount: evidenceIds.length,
      evidenceQuality: humanize(run.evidenceQuality && run.evidenceQuality.status || 'not scored'),
      humanApprovalRequired: run.decision?.humanApprovalRequired !== false
    };
  }

  function businessDecisionTone(result) {
    const status = String(result?.decision?.status || '').toLowerCase();
    const recommendation = String(result?.decision?.recommendation || '').toLowerCase();
    if (/do not|block|reject|not approve/.test(recommendation) || status === 'not_ready') return 'danger';
    if (/conditional|human approval|review/.test(recommendation) || status === 'conditional') return 'warning';
    return 'success';
  }

  function businessDecisionHeadline(result) {
    const evidenceQuality = String(result?.evidenceQuality?.status || '').toLowerCase();
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const recommendation = result?.decision?.recommendation || 'Council output ready';
    if (!gaps.length && (evidenceQuality === 'weak' || evidenceQuality === 'missing')) return 'Ready for review, evidence weak';
    if (/human approval/i.test(recommendation)) return 'Ready for human approval';
    if (/conditional/i.test(recommendation)) return 'Conditional path available';
    if (/do not|not approve|block/i.test(recommendation)) return 'Do not proceed yet';
    return recommendation;
  }

  function businessDecisionSummary(result) {
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const evidenceQuality = result?.evidenceQuality || {};
    const readiness = Math.round(Number(result?.decision?.readinessScore || 0) * 100);
    if (gaps.length) {
      return `${gaps.length} blocking item${gaps.length === 1 ? '' : 's'} must be closed before approval. Evidence confidence is ${humanize(evidenceQuality.status || 'not scored')} and the case is ${readiness}% ready.`;
    }
    if (evidenceQuality.status === 'weak' || evidenceQuality.status === 'missing') {
      return `No blocking gaps remain, but evidence confidence is ${humanize(evidenceQuality.status)}. A reviewer should request stronger source documents before recording approval.`;
    }
    return `No blocking gaps remain in the current evidence set. The case is ${readiness}% ready and still requires accountable human approval before operational use.`;
  }

  function humanApprovalRequired(result) {
    if (typeof result?.humanApprovalRequired === 'boolean') return result.humanApprovalRequired;
    if (typeof result?.decision?.humanApprovalRequired === 'boolean') return result.decision.humanApprovalRequired;
    if (typeof result?.orchestration?.humanApprovalRequired === 'boolean') return result.orchestration.humanApprovalRequired;
    return true;
  }

  function businessWhyItems(result) {
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const domains = Array.isArray(result?.domains) ? result.domains : [];
    const citations = Array.isArray(result?.citations) ? result.citations : [];
    const evidenceQuality = result?.evidenceQuality || {};
    const retrieval = result?.retrievalAudit || result?.retrievalContext || {};
    const readiness = Math.round(Number(result?.decision?.readinessScore || 0) * 100);
    const items = [];
    items.push(`The deterministic compliance engine scored the case at ${readiness}% readiness and kept the outcome inside a human approval boundary.`);
    if (gaps.length) {
      items.push(`${gaps.length} blocking item${gaps.length === 1 ? '' : 's'} remained open after risk and control mapping.`);
    } else {
      items.push('No blocking control gap remained after deterministic risk mapping, but accountable approval is still required.');
    }
    if (citations.length || retrieval.matchCount || retrieval.matches?.length) {
      const count = citations.length || retrieval.matchCount || retrieval.matches.length;
      items.push(`${count} evidence citation or retrieved chunk${count === 1 ? '' : 's'} supported the review.`);
    } else {
      items.push('No citation-ready evidence changed the outcome; the council relied on typed context and attached metadata.');
    }
    items.push(`Evidence confidence is ${humanize(evidenceQuality.status || 'not scored')}; reviewers must verify source documents before sign-off.`);
    if (domains.length) {
      items.push(`${domains.length} compliance domain${domains.length === 1 ? '' : 's'} were mapped into the decision.`);
    }
    return unique(items).slice(0, 5);
  }

  function businessReviewerActions(result) {
    const readiness = result?.decisionReadiness || {};
    const evidenceQuality = result?.evidenceQuality || {};
    const controls = Array.isArray(readiness.requiredControls) ? readiness.requiredControls.filter(Boolean) : [];
    if (controls.length) return controls.slice(0, 12);
    if (evidenceQuality.status === 'weak' || evidenceQuality.status === 'missing') {
      return [
        'Attach stronger source evidence before approval, such as signed contract schedules, DPA, SOC report, and continuity plan.',
        'Confirm the accountable human approver and approval authority.',
        'Record the approval decision against this case ID only after evidence review.'
      ];
    }
    return [
      'Confirm the accountable human approver and approval authority.',
      'Record the approval decision against this case ID.',
      'Schedule evidence revalidation before production renewal or material scope change.'
    ];
  }

  function humanReviewReasons(result) {
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const evidenceQuality = String(result?.evidenceQuality?.status || '').toLowerCase();
    const decisionReadiness = result?.decisionReadiness || {};
    const reasons = [];
    if (humanApprovalRequired(result)) {
      reasons.push('The council never grants operational approval automatically.');
    }
    if (gaps.length) {
      reasons.push(`${gaps.length} blocking item${gaps.length === 1 ? '' : 's'} must be reviewed and assigned before approval.`);
    }
    if (['missing', 'weak', 'not scored'].includes(evidenceQuality || 'not scored')) {
      reasons.push(`Evidence confidence is ${humanize(evidenceQuality || 'not scored')}; a reviewer must confirm source documents.`);
    }
    if (decisionReadiness.approvalEligible === false) {
      reasons.push('The deterministic engine marked the case as not approval-eligible without reviewer action.');
    }
    if (!reasons.length) {
      reasons.push('A named human owner must confirm scope, evidence, and risk acceptance before use.');
    }
    return unique(reasons).slice(0, 4);
  }

  function riskSummaryItems(result) {
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    if (gaps.length) {
      return gaps.slice(0, 12).map(function mapGap(gap) {
        return {
          label: gap.gap || 'Blocking risk',
          severity: gap.severity || 'review',
          detail: gap.action || 'Reviewer action required before approval.'
        };
      });
    }
    const domains = Array.isArray(result?.domains) ? result.domains : [];
    return domains
      .filter(function isRelevant(domain) {
        return /applicable|needs|confirmation/i.test(domain.status || '');
      })
      .slice(0, 5)
      .map(function mapDomain(domain) {
        return {
          label: domain.label || 'Mapped obligation',
          severity: humanize(domain.status || 'mapped'),
          detail: domain.obligations?.[0] || 'Mapped by the obligation mapper with no blocking gap returned.'
        };
      });
  }

  function evidenceUsedItems(result) {
    const citations = Array.isArray(result?.citations) ? result.citations : [];
    const documents = evidenceDocuments(result);
    const source = citations.length ? citations : documents;
    return source.slice(0, 6).map(function mapEvidence(doc, index) {
      const title = doc.title || doc.fileName || doc.sourceTitle || doc.documentTitle || `Evidence ${index + 1}`;
      return {
        id: doc.evidenceId || doc.sourceEvidenceId || doc.citationId || `DOC-${String(index + 1).padStart(2, '0')}`,
        title,
        detail: summarizeText(doc.text || doc.excerpt || doc.summary || 'Evidence attached without extracted text.', 220),
        signals: Array.isArray(doc.signals) && doc.signals.length
          ? doc.signals.slice(0, 4).join(', ')
          : doc.score ? `retrieval score ${Number(doc.score || 0).toFixed(2)}` : humanize(doc.extractionStatus || doc.sourceType || 'attached')
      };
    });
  }

  function evidenceDocumentName(doc, index) {
    return cleanText(doc?.title || doc?.fileName || doc?.sourceTitle || doc?.documentTitle || '') || `Evidence document ${index + 1}`;
  }

  function evidenceNamesForTimeline(result, limit) {
    const citations = Array.isArray(result?.citations) ? result.citations : [];
    const documents = evidenceDocuments(result);
    const source = citations.length ? citations : documents;
    return unique(source.map(evidenceDocumentName)).slice(0, limit || 2);
  }

  function timelineAction(type, label, detail) {
    return { type, label, detail };
  }

  function buildSpecialistTimeline(result) {
    const domains = Array.isArray(result?.domains) ? result.domains : [];
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const evidenceIds = Array.isArray(result?.evidenceIds) ? result.evidenceIds : [];
    const citations = Array.isArray(result?.citations) ? result.citations : [];
    const documents = evidenceDocuments(result);
    const trace = Array.isArray(result?.trace) ? result.trace : [];
    const evidenceQuality = result?.evidenceQuality || {};
    const retrieval = result?.retrievalAudit || result?.retrievalContext || {};
    const approvalRequired = humanApprovalRequired(result);
    const topEvidenceNames = evidenceNamesForTimeline(result, 2);
    const namedEvidence = topEvidenceNames.length
      ? topEvidenceNames.join(topEvidenceNames.length === 2 ? ' and ' : ', ')
      : 'the attached evidence set';
    return [
      {
        name: 'Intake Agent',
        reviewed: `${result?.case?.supplierName || 'Case'} · ${result?.case?.businessUnit || 'owner pending'} · ${result?.case?.geography || 'geography pending'}`,
        found: `Built a normalized case brief with ${(result?.case?.integrations || []).length} integration${(result?.case?.integrations || []).length === 1 ? '' : 's'}.`,
        action: result?.case?.businessUnit && result?.case?.geography
          ? timelineAction('validated', 'Validated intake', 'Scope, owner, and geography were present enough to continue.')
          : timelineAction('escalated', 'Escalated missing intake', 'Owner or geography remained weak and must be confirmed.'),
        handoff: 'Handed normalized case context to the Obligation Mapper.'
      },
      {
        name: 'Obligation Mapper',
        reviewed: `${domains.length} compliance domain${domains.length === 1 ? '' : 's'} across the supplied scope.`,
        found: `${domains.filter((domain) => /applicable/i.test(domain.status || '')).length} applicable domain${domains.filter((domain) => /applicable/i.test(domain.status || '')).length === 1 ? '' : 's'} and ${domains.filter((domain) => /confirmation|needs/i.test(domain.status || '')).length} confirmation item${domains.filter((domain) => /confirmation|needs/i.test(domain.status || '')).length === 1 ? '' : 's'}.`,
        action: domains.some((domain) => /confirmation|needs/i.test(domain.status || ''))
          ? timelineAction('challenged', 'Challenged scope', 'Some obligations need owner or evidence confirmation.')
          : timelineAction('validated', 'Validated obligation map', 'Applicable domains were mapped without scope blockers.'),
        handoff: 'Sent obligation requirements and evidence needs to the Evidence Examiner.'
      },
      {
        name: 'Evidence Examiner',
        reviewed: `${namedEvidence} against the obligation set, citation requirements, and reviewer proof needs.`,
        found: topEvidenceNames.length
          ? `Matched ${namedEvidence} with ${humanize(evidenceQuality.status || 'unscored')} evidence quality.`
          : `${evidenceIds.length} evidence reference${evidenceIds.length === 1 ? '' : 's'} linked with ${humanize(evidenceQuality.status || 'unscored')} evidence quality.`,
        action: /missing|weak/i.test(evidenceQuality.status || '')
          ? timelineAction('challenged', 'Challenged evidence strength', 'The decision stays review-bound until stronger proof is confirmed.')
          : timelineAction('validated', 'Validated evidence set', 'Evidence was sufficient for deterministic council analysis.'),
        handoff: 'Passed supported and missing evidence to the Risk & Controls Analyst.'
      },
      {
        name: 'Risk & Controls Analyst',
        reviewed: `${gaps.length} blocking gap${gaps.length === 1 ? '' : 's'} and mapped domain risk.`,
        found: gaps.length
          ? `${gaps.length} required control/action item${gaps.length === 1 ? '' : 's'} must be closed.`
          : 'No blocking gap remained after deterministic control mapping.',
        action: gaps.length
          ? timelineAction('escalated', 'Escalated controls', 'Blocking gaps were converted into owner actions.')
          : timelineAction('validated', 'Validated controls', 'No control blocker changed the final recommendation.'),
        handoff: 'Sent the controlled decision package to the Responsible AI Reviewer.'
      },
      {
        name: 'Responsible AI Reviewer',
        reviewed: 'Decision language, unsupported certainty, and the human approval boundary.',
        found: approvalRequired
          ? 'Human review remained required before any operational use.'
          : 'No human approval flag was returned; this should be treated as a configuration risk.',
        action: approvalRequired
          ? timelineAction('changed', 'Enforced no auto-approval', 'The output is framed as reviewer-ready, not self-approving.')
          : timelineAction('challenged', 'Approval boundary missing', 'Reviewer should block use until the approval boundary is restored.'),
        handoff: 'Passed the reviewed output to the Audit Packager.'
      },
      {
        name: 'Audit Packager',
        reviewed: `${trace.length} trace event${trace.length === 1 ? '' : 's'}, runtime metadata, ${namedEvidence}, and export fields.`,
        found: 'Decision memo, trace, evidence, and reviewer actions are ready for export.',
        action: timelineAction('validated', 'Packaged audit trail', 'The package preserves deterministic trace and raw JSON for inspection.'),
        handoff: 'Ready for human reviewer inspection and PDF export.'
      }
    ];
  }

  function hasOwner(result) {
    return Boolean(cleanText(result?.case?.businessUnit || result?.case?.owner || result?.businessUnit));
  }

  function hasGeography(result) {
    return Boolean(cleanText(result?.case?.geography || result?.geography));
  }

  function hasEvidence(result) {
    return Boolean(
      (Array.isArray(result?.evidenceIds) && result.evidenceIds.length)
      || (Array.isArray(result?.citations) && result.citations.length)
      || evidenceDocuments(result).length
    );
  }

  function hasActionableControls(result) {
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const controls = Array.isArray(result?.decisionReadiness?.requiredControls) ? result.decisionReadiness.requiredControls : [];
    return Boolean(controls.length || gaps.some(function hasAction(gap) {
      return cleanText(gap.action || gap.gap);
    }));
  }

  function qualityRubricForResult(result) {
    const readiness = Number(result?.decision?.readinessScore || 0);
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const domains = Array.isArray(result?.domains) ? result.domains : [];
    const citations = Array.isArray(result?.citations) ? result.citations : [];
    const evidenceQualityScore = Number(result?.evidenceQuality?.score || 0);
    const dimensions = [
      {
        name: 'Accuracy',
        score: [hasOwner(result) && hasGeography(result), hasEvidence(result), citations.length > 0 || evidenceQualityScore >= 0.6].filter(Boolean).length,
        evidence: hasEvidence(result) ? 'Case facts and evidence can be checked by a reviewer.' : 'Reviewer should request source evidence before relying on the pack.'
      },
      {
        name: 'Appropriateness',
        score: [humanApprovalRequired(result), domains.length > 0, result?.controls?.noAutomaticApproval !== false].filter(Boolean).length,
        evidence: 'The recommendation stays inside deterministic decisioning and human approval.'
      },
      {
        name: 'Actionability',
        score: [hasActionableControls(result), gaps.length === 0 || gaps.every(function gapHasAction(gap) { return cleanText(gap.action || gap.gap); }), readiness >= 0.66].filter(Boolean).length,
        evidence: gaps.length ? 'Open gaps are converted into reviewer actions.' : 'Reviewer can confirm approval boundary and evidence sufficiency.'
      }
    ];
    const totalScore = dimensions.reduce(function sum(total, item) {
      return total + item.score;
    }, 0);
    return {
      totalScore,
      threshold: 7,
      outcome: totalScore >= 7 ? 'reviewer-ready' : 'ask human before relying',
      dimensions
    };
  }

  function stopConditionsForResult(result) {
    const rubric = qualityRubricForResult(result);
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const stops = [];
    if (humanApprovalRequired(result)) stops.push('Human approval is required before operational use.');
    if (rubric.totalScore < rubric.threshold) stops.push(`Council quality is ${rubric.totalScore}/9, below the ${rubric.threshold}/9 reviewer-ready threshold.`);
    if (!hasOwner(result)) stops.push('Accountable owner is missing or weak.');
    if (!hasGeography(result)) stops.push('Geography or regulatory perimeter is missing or weak.');
    if (!hasEvidence(result)) stops.push('Citation-ready evidence is missing.');
    if (gaps.length) stops.push(`${gaps.length} unresolved gap${gaps.length === 1 ? '' : 's'} require reviewer disposition.`);
    return unique(stops).slice(0, 8);
  }

  function agenticPairingsForResult(result) {
    const domains = Array.isArray(result?.domains) ? result.domains : [];
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const citations = Array.isArray(result?.citations) ? result.citations : [];
    return [
      {
        pairing: 'Planner + Doer',
        agents: 'Intake Agent + Case Builder',
        output: hasOwner(result) || hasGeography(result)
          ? 'Structured the case without guessing missing facts.'
          : 'Kept missing owner/geography visible instead of filling them silently.',
        boundary: 'No ownership or approval is inferred without support.'
      },
      {
        pairing: 'Proposer + Critic',
        agents: 'Obligation Mapper + Risk & Controls Analyst',
        output: gaps.length ? 'Challenged weak obligations and produced reviewer actions.' : `${domains.length} domains mapped with no blocking control gap.`,
        boundary: 'Can challenge or escalate, but cannot approve.'
      },
      {
        pairing: 'Context-Packer + Actor',
        agents: 'Evidence Examiner + Deterministic Council',
        output: citations.length ? `${citations.length} citation${citations.length === 1 ? '' : 's'} packed into the decision record.` : 'Marked the decision as context-led and evidence-limited.',
        boundary: 'Evidence snippets support review; embeddings stay server-side.'
      },
      {
        pairing: 'Evidence-Weaver + Synthesizer',
        agents: 'Evidence Examiner + Audit Packager',
        output: 'Synthesized decision memo, risks, evidence, actions, and trace.',
        boundary: 'Produces a reviewer artifact, not operational approval.'
      }
    ];
  }

  function agentLoopSpecForResult(result) {
    const rubric = qualityRubricForResult(result);
    return {
      autonomy: {
        level: 'L2 governed loop with stops',
        rationale: 'The council can loop through intake, retrieval, mapping, and packaging, but stops at evidence gaps, low score, or human approval.'
      },
      goal: 'Prepare a human-review-ready compliance decision pack with cited evidence, explicit gaps, and no automated approval.',
      plan: [
        'Normalize the user request into a working case.',
        'Inspect uploaded evidence and retrieve safe citations before asking for more context.',
        'Map obligations and controls with deterministic logic.',
        'Challenge weak evidence or missing owner context.',
        'Package the decision, actions, rubric, and audit trace for a human reviewer.'
      ],
      memory: [
        { lane: 'Scratchpad', kept: 'Current case draft, active question, latest intent, and missing facts.' },
        { lane: 'Episodic log', kept: 'Audit trace, evidence IDs, decision events, and reviewer feedback.' },
        { lane: 'Reusable knowledge', kept: 'Reference intelligence, prior reviewer patterns, and control suggestions.' }
      ],
      tools: [
        { name: 'Conversation intake', failMode: 'Signal smart-intake outage and preserve deterministic case building.' },
        { name: 'Evidence retrieval', failMode: 'Continue metadata-only and disclose the limitation.' },
        { name: 'Deterministic council', failMode: 'Never auto-approve; ask a human when proof is weak.' },
        { name: 'Governed learning memory', failMode: 'Advisory only; no model training or silent decision changes.' },
        { name: 'Audit packager', failMode: 'Keep visible decision output even if export fails.' }
      ],
      rubric,
      stopConditions: stopConditionsForResult(result),
      guardrails: [
        'No automatic approval.',
        'Do not invent evidence.',
        'Advisory LLM output cannot override deterministic decisioning.',
        'Ask a human when quality is below 7/9 or required proof is missing.'
      ]
    };
  }

  function businessOutcomeHtml(result, context) {
    const settings = context || {};
    const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
    const evidenceIds = Array.isArray(result?.evidenceIds) ? result.evidenceIds : [];
    const citations = Array.isArray(result?.citations) ? result.citations : [];
    const evidenceQuality = result?.evidenceQuality || {};
    const retrieval = result?.retrievalAudit || result?.retrievalContext || {};
    const documentImpact = result?.documentEvidenceImpact || {};
    const llmOutput = result?.orchestration?.llmOutput || result?.runtime?.llmOutput || null;
    const evidenceMatches = Array.isArray(settings.evidenceMatches) ? settings.evidenceMatches : [];
    const learning = settings.learning || { similarCases: [], suggestions: null };
    const advisorySpecialists = Array.isArray(settings.advisorySpecialists) ? settings.advisorySpecialists : [];
    const memoryProviderLabel = settings.memoryProviderLabel || 'local-file fallback';
    const tone = businessDecisionTone(result);
    const readiness = Math.round(Number(result?.decision?.readinessScore || 0) * 100);
    const riskItems = riskSummaryItems(result);
    const evidenceItems = evidenceUsedItems(result);
    const reviewerActions = businessReviewerActions(result);
    const whyItems = businessWhyItems(result);
    const timeline = buildSpecialistTimeline(result);
    const pairings = agenticPairingsForResult(result);
    const loopSpec = agentLoopSpecForResult(result);
    const rubric = loopSpec.rubric;
    const approvalRequired = humanApprovalRequired(result);
    const advisorySummary = cleanText(llmOutput?.summary || '');
    const executiveBridge = advisorySummary || businessDecisionSummary(result);
    const primaryDocumentTitle = cleanText(result?.case?.documents?.[0]?.title || result?.case?.documents?.[0]?.fileName || '');
    const primaryDocumentDisplay = primaryDocumentTitle
      ? humanize(primaryDocumentTitle.replace(/\.[a-z0-9]+$/i, '').replace(/^\d+\s*/, ''))
      : '';
    const supplierName = cleanText(result?.case?.supplierName || '');
    const caseReviewed = primaryDocumentDisplay && !supplierName.toLowerCase().includes(primaryDocumentDisplay.toLowerCase())
      ? `${supplierName || 'Current case'} · ${primaryDocumentDisplay}`
      : supplierName || primaryDocumentDisplay || 'Current case';
    return `
      <section class="business-summary council-report decision-room-shell ${tone}">
        <article class="decision-room-hero report-section">
          <div class="decision-room-kicker">
            <span class="eyebrow">Executive decision room</span>
            <b>${escapeHtml(approvalRequired ? 'Human approval required' : 'Reviewer confirmation required')}</b>
          </div>
          <div class="decision-room-hero-grid">
            <div class="business-hero">
              <h2>${escapeHtml(businessDecisionHeadline(result))}</h2>
              <p>${escapeHtml(businessDecisionSummary(result))}</p>
              <p class="decision-room-action-note" ${componentAttributes('decision-action-note', 'ready')}>Use the command bar above to export the review pack, continue the case, or rerun the council. No operational approval is granted.</p>
            </div>
            <aside class="decision-owner-card">
              <span>Recommendation owner</span>
              <strong>Deterministic compliance engine</strong>
              <p>The accountable human reviewer remains the approval owner. Advisory specialists, retrieval memory, and reviewer learning cannot override the deterministic recommendation.</p>
            </aside>
          </div>
          <div class="human-boundary">
            <div><span>Case reviewed</span><strong>${escapeHtml(caseReviewed)}</strong></div>
            <div><span>Human approval</span><strong>${escapeHtml(approvalRequired ? 'Required' : 'Review required')}</strong></div>
            <div><span>Approval mode</span><strong>No auto-approval</strong></div>
            <div><span>Reviewer focus</span><strong>${escapeHtml(gaps.length ? `${gaps.length} required action${gaps.length === 1 ? '' : 's'}` : 'Confirm accountable owner')}</strong></div>
            <ul>${humanReviewReasons(result).map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
          </div>
        </article>
        <article class="report-section council-ai-summary">
          <span class="eyebrow">${escapeHtml(advisorySummary ? 'AI-assisted summary - advisory only' : 'Decision summary')}</span>
          <p data-council-summary-text>${escapeHtml(executiveBridge)}</p>
        </article>
        <div class="decision-metrics" aria-label="Decision metrics">
          <article><span>Readiness</span><strong>${escapeHtml(readiness)}%</strong></article>
          <article><span>Blocking items</span><strong>${escapeHtml(gaps.length)}</strong></article>
          <article><span>Evidence IDs</span><strong>${escapeHtml(evidenceIds.length)}</strong></article>
          <article><span>Confidence</span><strong>${escapeHtml(humanize(evidenceQuality.status || 'not scored'))}</strong></article>
        </div>
        <article class="report-section quality-rubric-panel">
          <div class="report-section-header">
            <div>
              <span class="eyebrow">Council Quality Rubric</span>
              <p>Judge-visible 0-9 score for accuracy, appropriateness, and actionability. Scores below 7 stop at human review.</p>
            </div>
            <strong class="quality-score">${escapeHtml(rubric.totalScore)}/9</strong>
          </div>
          <div class="quality-rubric-grid">
            ${rubric.dimensions.map((item) => `
              <div>
                <span>${escapeHtml(item.name)}</span>
                <strong>${escapeHtml(item.score)}/${escapeHtml(item.max || 3)}</strong>
                <p>${escapeHtml(item.evidence)}</p>
              </div>
            `).join('')}
          </div>
        </article>
        <article class="report-section stop-reasons-panel">
          <span class="eyebrow">Stop Conditions And Human Boundary</span>
          <ul>${loopSpec.stopConditions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </article>
        <article class="report-section required-actions-panel reviewer-handoff-panel">
          <div class="report-section-header">
            <div>
              <span class="eyebrow">Required Reviewer Actions</span>
              <p>What the accountable human reviewer must confirm before this can move toward operational approval.</p>
            </div>
          </div>
          <div class="reviewer-action-table" role="table" aria-label="Required reviewer actions">
            <div role="row" class="reviewer-action-head">
              <span role="columnheader">Action</span>
              <span role="columnheader">Owner</span>
              <span role="columnheader">Status</span>
            </div>
            ${reviewerActions.map((action) => `
              <div role="row">
                <strong role="cell">${escapeHtml(action)}</strong>
                <span role="cell">${escapeHtml(result?.case?.businessUnit || 'Accountable reviewer')}</span>
                <em role="cell">Needs human confirmation</em>
              </div>
            `).join('')}
          </div>
        </article>
        <article class="report-section risk-summary-panel">
          <span class="eyebrow">Top Risks</span>
          <div class="risk-list">
            ${riskItems.length ? riskItems.map((item, index) => `
              <div>
                <span class="${/high|critical|escalated/i.test(item.severity) ? 'status-danger' : 'status-warning'}">${escapeHtml(item.severity)}</span>
                <strong>${escapeHtml(item.label)}</strong>
                <p>${escapeHtml(item.detail)}</p>
                ${index < 3 ? `<small data-gap-remediation-index="${escapeHtml(index)}">Suggested action: ${escapeHtml(item.detail)}</small>` : ''}
              </div>
            `).join('') : '<div><span class="status-ready">clear</span><strong>No blocking risk returned</strong><p>The current evidence set did not produce a blocking gap, but human review remains required.</p></div>'}
          </div>
        </article>
        <article class="report-section evidence-used-panel">
          <div class="report-section-header">
            <div>
              <span class="eyebrow">Evidence Quality And Sources</span>
              <p>${escapeHtml(documentImpact.summary || `${citations.length} citation${citations.length === 1 ? '' : 's'} mapped into the decision.`)}</p>
            </div>
            <div class="evidence-pill-row">
              <span>${escapeHtml(citations.length)} citation${citations.length === 1 ? '' : 's'}</span>
              <span>${escapeHtml(retrieval.matchCount || retrieval.matches?.length || 0)} retrieved chunk${(retrieval.matchCount || retrieval.matches?.length || 0) === 1 ? '' : 's'}</span>
              <span>${escapeHtml(evidenceQuality.score ?? 'n/a')} score</span>
            </div>
          </div>
          <div class="evidence-used-list">
            ${evidenceItems.length ? evidenceItems.map((item) => `
              <div>
                <span>${escapeHtml(item.signals || 'source evidence')}</span>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.detail)}</p>
                <small>Reviewer reference: ${escapeHtml(item.id)}</small>
              </div>
            `).join('') : '<div><span>none</span><strong>No evidence attached</strong><p>The decision used case context only. Attach source documents before approval.</p><small>human review required</small></div>'}
          </div>
        </article>
        <details class="report-section agent-findings-panel">
          <summary>
            <span class="eyebrow">Specialist Collaboration Trace</span>
            <strong>Deterministic specialist validation</strong>
            <small>Collapsed by default. Open to inspect reviewed inputs, findings, challenges, and handoffs.</small>
          </summary>
          <p class="timeline-disclosure">Visible specialist validation, not live autonomous debate. Each step records what it reviewed and how it changed or validated the handoff.</p>
          <div class="pairing-grid">
            ${pairings.map((pair) => `
              <div class="pairing-card">
                <span>${escapeHtml(pair.pairing)}</span>
                <strong>${escapeHtml(pair.agents)}</strong>
                <p>${escapeHtml(pair.output)}</p>
                <small>${escapeHtml(pair.boundary)}</small>
              </div>
            `).join('')}
          </div>
          <div class="agent-finding-grid">
            ${timeline.map((item) => `
              <div class="is-${escapeHtml(item.action.type)}">
                <span>${escapeHtml(item.action.label)}</span>
                <strong>${escapeHtml(item.name)}</strong>
                <p>${escapeHtml(item.found)}</p>
                <small>${escapeHtml(item.handoff)}</small>
              </div>
            `).join('')}
          </div>
        </details>
        <article class="report-section why-decision-panel">
          <span class="eyebrow">Executive Rationale</span>
          <ol>${whyItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
        </article>
        <article class="report-section learning-feedback-panel">
          <div class="report-section-header">
            <div>
              <span class="eyebrow">Governed Learning Feedback</span>
              <p>Capture the human reviewer outcome as advisory memory for future similar cases. This does not train a model or change this decision.</p>
            </div>
          </div>
          <form class="learning-feedback-form" data-learning-feedback-form>
            <label><span>Reviewer outcome</span><select name="reviewerDecision"><option value="Request remediation">Request remediation</option><option value="Conditional approval">Conditional approval</option><option value="Reject">Reject</option><option value="Approve after controls">Approve after controls</option></select></label>
            <label><span>Reviewer notes</span><textarea name="reviewerNotes" rows="3" autocomplete="off" placeholder="Example: require signed DPA, transfer basis, access approval, and exit support…"></textarea></label>
            <div class="learning-feedback-grid">
              <label><span>Controls added</span><input name="addedControls" autocomplete="off" placeholder="Example: signed DPA, transfer assessment…"></label>
              <label><span>Missing evidence</span><input name="missingEvidence" autocomplete="off" placeholder="Example: import permit, end-use certificate…"></label>
            </div>
            <div class="learning-feedback-actions">
              <button type="submit">Save governed memory</button>
              <small data-learning-feedback-status role="status" aria-live="polite">Stored as reviewer memory only.</small>
            </div>
          </form>
        </article>
        <details class="advanced-council-details">
          <summary>Advanced retrieval, learning, advisory, and audit trace</summary>
          <article class="report-section agent-loop-panel">
            <div class="report-section-header">
              <div>
                <span class="eyebrow">Agent Loop Spec</span>
                <p>${escapeHtml(loopSpec.goal)}</p>
              </div>
              <strong>${escapeHtml(loopSpec.autonomy.level)}</strong>
            </div>
            <div class="loop-spec-grid">
              <div>
                <span>Plan</span>
                <ol>${loopSpec.plan.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
              </div>
              <div>
                <span>Tool fail modes</span>
                <ol>${loopSpec.tools.map((tool) => `<li><b>${escapeHtml(tool.name)}:</b> ${escapeHtml(tool.failMode)}</li>`).join('')}</ol>
              </div>
              <div>
                <span>Guardrails</span>
                <ol>${loopSpec.guardrails.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
              </div>
            </div>
            <div class="memory-lanes">
              ${loopSpec.memory.map((lane) => `
                <div>
                  <span>${escapeHtml(lane.lane)}</span>
                  <strong>${escapeHtml(lane.kept)}</strong>
                </div>
              `).join('')}
            </div>
          </article>
          <article class="report-section memory-panel">
            <span class="eyebrow">RAG Evidence Memory</span>
            <p class="timeline-disclosure">Server-side retrieval only. The browser receives citations and snippets, never raw embeddings.</p>
            <div class="memory-card-grid">
              <div><span>Provider</span><strong>${escapeHtml(result?.retrievalAudit?.provider || retrieval.provider || result?.retrievalContext?.provider || memoryProviderLabel)}</strong></div>
              <div><span>Indexed chunks</span><strong>${escapeHtml(retrieval.chunkCount || result?.retrievalAudit?.chunkCount || settings.indexedChunkCount || 0)}</strong></div>
              <div><span>Retrieved matches</span><strong>${escapeHtml(evidenceMatches.length || retrieval.matchCount || 0)}</strong></div>
            </div>
            <div class="memory-evidence-list">
              ${evidenceMatches.length ? evidenceMatches.slice(0, 4).map((match) => `
                <div>
                  <span>${escapeHtml(match.evidenceId || 'evidence')} · ${escapeHtml(Number(match.score || 0).toFixed(2))}</span>
                  <strong>${escapeHtml(match.title || 'Retrieved evidence')}</strong>
                  <p>${escapeHtml(match.snippet || match.text || '')}</p>
                </div>
              `).join('') : '<div><span>no matches</span><strong>No RAG citations retrieved</strong><p>The decision used typed and attached case context only.</p></div>'}
            </div>
          </article>
          <article class="report-section memory-panel">
            <span class="eyebrow">Governed Learning Memory</span>
            <p class="timeline-disclosure">Advisory precedent memory only; this is not autonomous model training and does not alter the deterministic decision.</p>
            <div class="memory-card-grid">
              <div><span>Similar cases</span><strong>${escapeHtml((learning.similarCases || []).length)}</strong></div>
              <div><span>Reviewer patterns</span><strong>${escapeHtml(learning.suggestions?.sourceMemoryIds?.length || 0)}</strong></div>
              <div><span>Control suggestions</span><strong>${escapeHtml(learning.suggestions?.commonControlsReviewersAdded?.length || 0)}</strong></div>
            </div>
            <div class="memory-evidence-list">
              ${(learning.similarCases || []).length ? learning.similarCases.slice(0, 4).map((item) => `
                <div>
                  <span>${escapeHtml(item.artifactType || 'memory')} · ${escapeHtml(item.createdAt || '')}</span>
                  <strong>${escapeHtml(item.finalOutcome || item.reviewerDecision || item.caseId || 'Prior reviewer memory')}</strong>
                  <p>${escapeHtml(item.reviewerNotes || item.missingEvidence?.join(', ') || 'Governed reviewer memory attached as advisory context.')}</p>
                </div>
              `).join('') : '<div><span>no precedents</span><strong>No similar cases found</strong><p>The council did not receive governed learning precedents for this run.</p></div>'}
              ${learning.suggestions?.commonControlsReviewersAdded?.length ? `
                <div>
                  <span>control suggestions</span>
                  <strong>${escapeHtml(learning.suggestions.commonControlsReviewersAdded.slice(0, 3).map((item) => item.control).join(', '))}</strong>
                  <p>Suggested for reviewer consideration only.</p>
                </div>
              ` : ''}
            </div>
          </article>
          <article class="report-section advisory-specialists-panel">
            <span class="eyebrow">Advisory Specialists</span>
            <p class="timeline-disclosure">Live LLM specialists are advisory only when configured. The deterministic compliance engine owns the recommendation; the accountable human owns approval.</p>
            <div class="advisory-card-grid">
              ${advisorySpecialists.length ? advisorySpecialists.map((specialist) => `
                <div class="${specialist.advisoryUnavailable ? 'is-unavailable' : ''}">
                  <span>${escapeHtml(specialist.advisoryUnavailable ? 'unavailable' : 'advisory only')}</span>
                  <strong>${escapeHtml(specialist.specialist || 'Advisory specialist')}</strong>
                  <p>${escapeHtml(specialist.assessment || 'No advisory assessment returned.')}</p>
                  ${specialist.recommendedActions?.length ? `<small>${escapeHtml(specialist.recommendedActions.slice(0, 2).join(' · '))}</small>` : ''}
                </div>
              `).join('') : '<div><span>not requested</span><strong>Advisory specialists inactive</strong><p>Enable Compass token, CREWAI_ENABLE_LIVE_LLM=1, and AGENT_RUNTIME=crewai_llm to attach advisory specialists.</p></div>'}
            </div>
          </article>
          <article class="report-section council-timeline-panel">
            <span class="eyebrow">Agent Collaboration Timeline</span>
            <p class="timeline-disclosure">Deterministic council trace / specialist validation. This is not a live multi-agent debate.</p>
            <div class="council-timeline">
              ${timeline.map((item, index) => `
                <div class="timeline-item is-${escapeHtml(item.action.type)}">
                  <b>${String(index + 1).padStart(2, '0')}</b>
                  <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <dl>
                      <dt>Reviewed</dt><dd>${escapeHtml(item.reviewed)}</dd>
                      <dt>Found</dt><dd>${escapeHtml(item.found)}</dd>
                      <dt>${escapeHtml(humanize(item.action.type))}</dt><dd><span>${escapeHtml(item.action.label)}:</span> ${escapeHtml(item.action.detail)}</dd>
                      <dt>Handoff</dt><dd>${escapeHtml(item.handoff)}</dd>
                    </dl>
                  </div>
                </div>
              `).join('')}
            </div>
          </article>
          ${llmOutput?.summary ? `<div class="advisory-note"><span class="eyebrow">Advisory council summary</span><p>${escapeHtml(llmOutput.summary)}</p></div>` : ''}
        </details>
      </section>
    `;
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  const existingCaseIntelligence = window.P42ModuleRegistry.caseIntelligencePanel || {};
  window.P42ModuleRegistry.decisionRoom = {
    buildSpecialistTimeline,
    agenticPairingsForResult,
    agentLoopSpecForResult,
    businessDecisionHeadline,
    businessDecisionSummary,
    businessDecisionTone,
    businessOutcomeHtml,
    businessReviewerActions,
    businessWhyItems,
    evidenceDocuments,
    evidenceUsedItems,
    humanApprovalRequired,
    humanReviewReasons,
    qualityRubricForResult,
    riskSummaryItems,
    summarizeRunForDecisionRoom
  };
  window.P42ModuleRegistry.caseIntelligencePanel = {
    ...existingCaseIntelligence,
    summarizeRunForDecisionRoom
  };
})(window);
