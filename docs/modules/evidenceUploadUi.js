(function attachEvidenceUploadModule(window) {
  'use strict';

  const text = window.P42ModuleRegistry && window.P42ModuleRegistry.text;
  const cleanText = text ? text.cleanText : function fallbackClean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  };
  const humanize = text ? text.humanize : function fallbackHumanize(value) {
    return cleanText(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, function upper(letter) {
      return letter.toUpperCase();
    });
  };
  const escapeHtml = text && text.escapeHtml ? text.escapeHtml : function fallbackEscape(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  function fileExtension(fileName) {
    const parts = String(fileName || '').toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
  }

  function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function cleanEvidenceText(value) {
    return String(value || '')
      .replace(/\u0000/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function summarizeEvidenceText(textValue, maxLength) {
    const clean = cleanEvidenceText(textValue);
    const limit = Number(maxLength) || 720;
    if (!clean) return 'No extractable text was detected.';
    return clean.length > limit ? `${clean.slice(0, limit).trim()}...` : clean;
  }

  function detectEvidenceSignals(textValue, patterns) {
    const source = cleanEvidenceText(textValue);
    return (patterns || [])
      .filter(function matchesPattern(entry) {
        const pattern = entry && entry[1];
        return pattern && pattern.test(source);
      })
      .map(function toLabel(entry) {
        return entry[0];
      });
  }

  function pipelineStepStatus(stepId, phase, steps) {
    const pipelineSteps = steps || [];
    const normalizedPhase = normalizeEvidencePhase(phase);
    const phaseIndex = pipelineSteps.findIndex(function findPhase(step) {
      return step.id === normalizedPhase;
    });
    const stepIndex = pipelineSteps.findIndex(function findStep(step) {
      return step.id === stepId;
    });
    if (normalizedPhase === 'error') return stepIndex <= pipelineSteps.length - 2 ? 'error' : 'queued';
    if (stepIndex < phaseIndex) return 'complete';
    if (stepIndex === phaseIndex) return 'active';
    return 'queued';
  }

  function normalizeEvidencePhase(phase) {
    const value = cleanText(phase).toLowerCase();
    if (/fail|error/.test(value)) return 'error';
    if (/ready|complete|citation|indexed/.test(value)) return 'ready';
    if (/embed|index|vector|retrieval/.test(value)) return 'embed';
    if (/parse|ocr|extract|clause|semantic/.test(value)) return 'parse';
    if (/upload|stream|register/.test(value)) return 'upload';
    return 'queue';
  }

  function inferredPhase(settings) {
    const explicit = normalizeEvidencePhase(settings.phase);
    if (settings.phase && explicit !== 'queue') return explicit;
    const files = Array.from(settings.files || []);
    const first = files.find(Boolean) || {};
    const status = cleanText([
      first.vectorStatus,
      first.indexingStatus,
      first.indexStatus,
      first.extractionStatus,
      first.status,
      settings.state
    ].join(' ')).toLowerCase();
    if (/fail|error/.test(status)) return 'error';
    if (/citation|indexed|ready/.test(status)) return 'ready';
    if (/embedding|vector|indexing/.test(status)) return 'embed';
    if (/backend_parsed|text_extracted|sampled_text|parsed|ocr|extract/.test(status)) return 'parse';
    if (/uploaded|binary_registered|metadata|attached|registered/.test(status)) return 'upload';
    return explicit;
  }

  function elapsedLabel(settings) {
    const startedAt = Number(settings.startedAt || 0);
    const elapsedMs = Number(settings.elapsedMs || 0) || (startedAt ? Date.now() - startedAt : 0);
    if (!elapsedMs || elapsedMs < 1000) return '';
    const seconds = Math.max(1, Math.round(elapsedMs / 1000));
    if (seconds < 90) return `${seconds}s elapsed`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s elapsed`;
  }

  function renderEvidencePipelineStatus(target, options) {
    const node = target || null;
    if (!node) return;
    const settings = options || {};
    const steps = settings.steps || [];
    const phase = inferredPhase(settings);
    const boundedProgress = Math.max(4, Math.min(100, Math.round(Number(settings.progress) || 4)));
    const visibleFiles = Array.from(settings.files || []).slice(0, 3);
    const state = settings.state || 'working';
    const elapsed = elapsedLabel(settings);
    node.dataset.state = state;
    node.classList.add('has-pipeline');
    node.innerHTML = `
      <div class="evidence-pipeline is-${escapeHtml(state)}">
        <div class="pipeline-head">
          <div class="pipeline-orb" aria-hidden="true"><span></span></div>
          <div>
            <strong>${escapeHtml(settings.title || 'Evidence pipeline')}</strong>
            <p>${escapeHtml(settings.detail || 'Preparing evidence.')}</p>
          </div>
          <b>${escapeHtml(settings.metric || `${boundedProgress}%`)}</b>
        </div>
        <div class="pipeline-rail" aria-hidden="true">
          <span style="--agent-lane: 0"></span>
          <span style="--agent-lane: 1"></span>
          <span style="--agent-lane: 2"></span>
        </div>
        <div class="pipeline-meter" aria-hidden="true">
          <span style="width: ${boundedProgress}%"></span>
        </div>
        <div class="pipeline-steps" aria-label="Evidence processing progress">
          ${steps.map(function renderStep(step) {
            return `
              <span class="is-${escapeHtml(pipelineStepStatus(step.id, phase, steps))}">
                <i></i>${escapeHtml(step.label)}
              </span>
            `;
          }).join('')}
        </div>
        ${visibleFiles.length ? `
          <div class="pipeline-files">
            ${visibleFiles.map(function renderFile(file) {
              return `<span>${escapeHtml(file.name || file.fileName || file.title || 'Evidence file')}</span>`;
            }).join('')}
          </div>
        ` : ''}
        <div class="pipeline-telemetry" aria-hidden="true">
          <span>parser session</span>
          <span>clause map</span>
          <span>embedding index</span>
          <span>citation memory</span>
          ${elapsed ? `<span>${escapeHtml(elapsed)}</span>` : ''}
        </div>
      </div>
    `;
  }

  function evidenceStatusLabel(item) {
    const record = item || {};
    if (record.indexStatus === 'indexed') return 'citation-ready';
    if (record.extractionStatus === 'backend_parsed' || record.extractionStatus === 'text_extracted' || record.extractionStatus === 'sampled_text') return 'parsed';
    if (record.extractionStatus === 'binary_registered') return 'metadata-only';
    if (record.extractionStatus) return humanize(record.extractionStatus);
    if (Array.isArray(record.signals) && record.signals.length) return record.signals.slice(0, 2).join(', ');
    return record.fileName ? 'metadata-only' : 'attached';
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.evidenceUploadUi = {
    cleanEvidenceText,
    detectEvidenceSignals,
    evidenceStatusLabel,
    fileExtension,
    formatBytes,
    normalizeEvidencePhase,
    pipelineStepStatus,
    renderEvidencePipelineStatus,
    summarizeEvidenceText
  };
})(window);
