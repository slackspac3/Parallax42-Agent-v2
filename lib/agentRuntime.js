'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { runComplianceAgent } = require('./complianceAgent');

const ROOT = path.resolve(__dirname, '..');
const FLOW_SCRIPT = path.join(ROOT, 'crewai_adapter', 'compliance_flow.py');
const DEFAULT_RUNTIME = 'crewai_flow';
const LIVE_LLM_RUNTIMES = new Set(['crewai_llm', 'crewai_live_llm', 'crewai_flow_llm']);

const FLOW_STAGES = [
  ['intake', 'load_case', 'compliance_orchestrator', 'case_loaded'],
  ['obligations', 'map_obligations', 'regulatory_obligation_mapper', 'domains_scanned'],
  ['evidence', 'examine_evidence', 'evidence_examiner', 'evidence_mapped'],
  ['controls', 'recommend_controls', 'risk_control_analyst', 'controls_recommended'],
  ['rai_review', 'review_responsible_ai', 'responsible_ai_reviewer', 'output_review_completed'],
  ['audit_pack', 'package_audit_brief', 'audit_packager', 'output_review_completed']
];

function requestedRuntime(options = {}) {
  return String(options.runtime || process.env.AGENT_RUNTIME || DEFAULT_RUNTIME).trim().toLowerCase();
}

function runtimeEvent(payload = {}) {
  return {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    agent: 'runtime_router',
    eventType: 'runtime_selected',
    parentEventId: '',
    payload
  };
}

function jsFlowManifest(input = {}, source = 'js_static') {
  return {
    mode: 'crewai_flow_dry_run',
    framework: 'CrewAI Flow',
    primary_runtime: true,
    live_crewai: false,
    manifestSource: source,
    input: 'node_runtime',
    caseId: input.caseId || '',
    state_schema: {
      case: 'original normalized compliance case',
      workPlan: 'triage and domain scope',
      obligations: 'mapped obligations and applicability',
      evidenceReview: 'supported and missing evidence',
      controlPlan: 'controls, blockers, owners, remediation',
      responsibleAiReview: 'approval boundary and safety checks',
      auditBrief: 'final decision package'
    },
    flow: {
      class: 'ComplianceIntelligenceFlow',
      entrypoint: 'kickoff',
      control_model: 'start/listen state machine',
      human_approval_required: true,
      deterministic_fallback: true,
      stages: FLOW_STAGES.map(([id, method, agent, expectedTraceEvent], index) => ({
        id,
        method,
        agent,
        expectedTraceEvent,
        kind: index === 0 ? 'start' : 'listen'
      }))
    },
    secrets_required_for_dry_run: false
  };
}

function liveLlmConfig() {
  const providerKeys = [
    'CREWAI_LLM_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'AZURE_API_KEY'
  ];
  const providerEnv = providerKeys.find((key) => Boolean(process.env[key])) || '';
  return {
    enabled: /^(1|true|yes|on)$/i.test(String(process.env.CREWAI_ENABLE_LIVE_LLM || '')),
    model: process.env.CREWAI_LLM_MODEL || process.env.OPENAI_MODEL_NAME || process.env.MODEL || 'gpt-5.1',
    baseUrlConfigured: Boolean(process.env.CREWAI_LLM_BASE_URL || process.env.OPENAI_API_BASE || process.env.OPENAI_BASE_URL),
    providerEnv,
    apiKeyConfigured: Boolean(providerEnv)
  };
}

function runPythonFlow(input, { live = false, llm = false } = {}) {
  const modeArg = llm ? '--live-llm' : live ? '--live-flow' : '--dry-run';
  const args = [FLOW_SCRIPT, modeArg, '--input', '-'];
  const result = spawnSync('python3', args, {
    cwd: ROOT,
    input: JSON.stringify(input || {}),
    encoding: 'utf8',
    timeout: llm ? 180000 : 15000,
    maxBuffer: llm ? 4 * 1024 * 1024 : 1024 * 1024
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `CrewAI Flow exited ${result.status}`).trim());
  }
  return JSON.parse(result.stdout);
}

function resolveCrewAIFlow(input, { live = false, llm = false } = {}) {
  try {
    const manifest = runPythonFlow(input, { live, llm });
    return {
      manifest,
      source: llm ? 'python_live_llm' : live ? 'python_crewai_live_flow' : 'python_dry_run',
      degraded: false
    };
  } catch (error) {
    if (live || llm) {
      return {
        manifest: jsFlowManifest(input, 'js_static_after_live_flow_failure'),
        source: 'js_static',
        degraded: true,
        error: error instanceof Error ? error.message : String(error || 'Unknown error')
      };
    }
    return {
      manifest: jsFlowManifest(input, 'js_static_after_python_unavailable'),
      source: 'js_static',
      degraded: false,
      error: error instanceof Error ? error.message : String(error || 'Unknown error')
    };
  }
}

function attachRuntime(result, runtime) {
  const output = result;
  output.mode = runtime.actualMode;
  output.runtime = runtime;
  output.orchestration = {
    framework: 'CrewAI Flow',
    primaryRuntime: runtime.actualRuntime.startsWith('crewai_'),
    manifestSource: runtime.manifestSource,
    flow: runtime.flowManifest?.flow || null,
    stateSchema: runtime.flowManifest?.state_schema || null,
    liveLlm: runtime.llm || null,
    llmOutput: runtime.llmOutput || null,
    humanApprovalRequired: true,
    deterministicDecisionEngine: true
  };
  output.trace = [
    runtimeEvent({
      requestedRuntime: runtime.requestedRuntime,
      actualRuntime: runtime.actualRuntime,
      actualMode: runtime.actualMode,
      manifestSource: runtime.manifestSource,
      degraded: runtime.degraded,
      fallbackReason: runtime.fallbackReason || ''
    }),
    ...(Array.isArray(output.trace) ? output.trace : [])
  ];
  return output;
}

function runAgentWithRuntime(input = {}, options = {}) {
  const runtime = requestedRuntime(options);
  if (runtime === 'deterministic' || runtime === 'local_deterministic') {
    const result = runComplianceAgent(input, { mode: options.mode || 'local_deterministic' });
    return attachRuntime(result, {
      requestedRuntime: runtime,
      actualRuntime: 'deterministic',
      actualMode: result.mode,
      manifestSource: 'none',
      degraded: false,
      flowManifest: null
    });
  }

  const wantsLiveFlow = runtime === 'crewai_live' || runtime === 'crewai_flow_live';
  const wantsLiveLlm = LIVE_LLM_RUNTIMES.has(runtime);
  const flow = resolveCrewAIFlow(input, { live: wantsLiveFlow, llm: wantsLiveLlm });
  const actualRuntime = wantsLiveLlm && !flow.degraded
    ? 'crewai_llm_live'
    : wantsLiveFlow && !flow.degraded
      ? 'crewai_flow_live'
      : 'crewai_flow_dry_run';
  const result = runComplianceAgent(input, {
    mode: options.mode || actualRuntime
  });

  return attachRuntime(result, {
    requestedRuntime: runtime,
    actualRuntime,
    actualMode: actualRuntime,
    manifestSource: flow.source,
    degraded: flow.degraded,
    fallbackReason: flow.degraded ? flow.error : '',
    flowManifest: flow.manifest,
    llm: wantsLiveLlm ? {
      requested: true,
      ...liveLlmConfig(),
      outputAvailable: !flow.degraded && Boolean(flow.manifest?.crewOutput)
    } : {
      requested: false,
      ...liveLlmConfig(),
      outputAvailable: false
    },
    llmOutput: flow.manifest?.crewOutput || null
  });
}

function runtimeHealth() {
  const configured = requestedRuntime();
  const flow = resolveCrewAIFlow({ caseId: 'health-check' }, { live: false });
  const llm = liveLlmConfig();
  return {
    configuredRuntime: configured,
    defaultRuntime: DEFAULT_RUNTIME,
    crewaiFlowDryRunAvailable: Boolean(flow.manifest),
    crewaiManifestSource: flow.source,
    crewaiFlowDegraded: flow.degraded,
    crewaiLlmCallsEnabled: llm.enabled,
    crewaiLlmModel: llm.model,
    crewaiLlmProviderEnv: llm.providerEnv,
    crewaiLlmApiKeyConfigured: llm.apiKeyConfigured,
    crewaiLlmBaseUrlConfigured: llm.baseUrlConfigured,
    deterministicFallbackAvailable: true,
    optionalLiveCrewAI: 'install requirements-crewai.txt and set AGENT_RUNTIME=crewai_live',
    optionalLiveLlm: 'install requirements-crewai.txt, set CREWAI_ENABLE_LIVE_LLM=1, configure provider credentials, and set AGENT_RUNTIME=crewai_llm'
  };
}

module.exports = {
  DEFAULT_RUNTIME,
  jsFlowManifest,
  requestedRuntime,
  runAgentWithRuntime,
  runtimeHealth
};
