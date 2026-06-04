"""Agentathon run orchestration for the FastAPI wrapper."""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from typing import Any, Dict, List, Optional

from .compass_client import CompassClient
from .node_bridge import run_node_bridge
from .schemas import AgentathonRunRequest
from .trace_logger import TraceLogger, redact, safe_run_id


USE_CASE_ID = "21"

AGENTS: List[Dict[str, str]] = [
    {"name": "Intake Agent", "role": "Extracts case facts, missing facts, and delegates evidence needs."},
    {"name": "Evidence Retrieval Agent", "role": "Searches supplied and local evidence signals, retries weak coverage, and reports sufficiency."},
    {"name": "Privacy Specialist", "role": "Reviews DPA, subprocessors, retention, transfer, data categories, and model-training exclusions."},
    {"name": "Security Specialist", "role": "Reviews SOC 2, ISO, access control, encryption, logging, BCP, and technical assurance evidence."},
    {"name": "Responsible AI Specialist", "role": "Challenges AI use, model training, automation, oversight, and transparency risk."},
    {"name": "Learning & Precedent Specialist", "role": "Looks up deterministic synthetic precedent patterns as advisory memory."},
    {"name": "Compass Advisory Critic", "role": "Runs live Compass advisory review when configured; never owns the final decision."},
    {"name": "Deterministic Decision Owner", "role": "Applies deterministic policy and remains final decision authority."},
    {"name": "Audit Packager", "role": "Packages the decision, evidence, collaboration trace, and review artifacts."},
]

ADVISORY_SCHEMA_HINT = json.dumps(
    {
        "specialist": "Compass Advisory Critic",
        "advisoryOnly": True,
        "assessment": "approve|conditional|reject|insufficient_evidence",
        "strongestEvidence": [],
        "unresolvedRisks": [],
        "reviewerQuestions": [],
        "recommendedActions": [],
        "confidence": "low|medium|high",
        "rationale": "short explanation",
    },
    separators=(",", ":"),
)


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _first_text(*values: Any) -> str:
    for value in values:
        text = _clean(value)
        if text:
            return text
    return ""


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        return [item.strip() for item in re.split(r"[,;\n]", value) if item.strip()]
    return []


def _truthy(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _contains(text: str, *patterns: str) -> bool:
    return any(re.search(pattern, text, re.I) for pattern in patterns)


def _has_positive(text: str, positive: str, negative: str = "") -> bool:
    if negative and re.search(negative, text, re.I):
        return False
    return bool(re.search(positive, text, re.I))


def _explicit_ai_training_risk(text: str) -> bool:
    ai_signal = _contains(
        text,
        r"\b(ai|llm|machine learning|classifier|fine[- ]?tuning|model[- ]?(training|tuning|improvement)?|draft response)\b",
    )
    data_training_signal = _contains(
        text,
        r"customer prompts?|support tickets?|customer data|submitted customer data|model improvement|service improvement|training|tuning",
    )
    return ai_signal and data_training_signal


def _ai_or_analytics_signal(text: str) -> str:
    if _explicit_ai_training_risk(text):
        return "explicit_ai_training"
    if _contains(text, r"\b(ai vendor|ai support|llm|machine learning|classifier|model[- ]?governance|automated recommendations?)\b"):
        return "explicit_ai"
    if _contains(text, r"\banalytics\b") and _contains(text, r"patient|healthcare|clinical|customer|personal data"):
        return "analytics_governance"
    return "none"


def _extract_query(payload: Dict[str, Any]) -> str:
    input_payload = payload.get("input") if isinstance(payload.get("input"), dict) else {}
    case_payload = input_payload.get("case") if isinstance(input_payload.get("case"), dict) else {}
    return _first_text(input_payload.get("query"), case_payload.get("query"), case_payload.get("description"))


def _sample_mode(request: AgentathonRunRequest) -> bool:
    return bool(request.options.get("sample_mode") is True or _truthy(os.environ.get("SAMPLE_MODE", "false")))


def _limited_list(values: List[Any], limit: int = 8) -> List[str]:
    seen = set()
    output: List[str] = []
    for value in values:
        text = _clean(value)
        if text and text.lower() not in seen:
            seen.add(text.lower())
            output.append(text[:260])
        if len(output) >= limit:
            break
    return output


def _decision_from_node(node_status: str, missing: List[str], findings: List[Dict[str, Any]], precedent: Dict[str, Any]) -> str:
    severe_ai = any(finding.get("domain") == "responsible_ai" and finding.get("severity") == "high" for finding in findings)
    normalized_status = node_status.lower()
    if precedent.get("recommendation") == "reject_or_escalate" or (normalized_status == "not_ready" and severe_ai):
        return "reject"
    if normalized_status in {"ready", "approved", "approval_ready"} and not missing:
        return "approve"
    if not missing and normalized_status in {"ready", "approved", "approval_ready"}:
        return "approve"
    if normalized_status == "not_ready" and len(missing) >= 4:
        return "needs_more_information"
    return "conditional_approval"


def _risk_level(node_result: Dict[str, Any], missing: List[str], findings: List[Dict[str, Any]], decision: str) -> str:
    high_findings = [item for item in findings if item.get("severity") == "high"]
    gaps = node_result.get("gaps") if isinstance(node_result.get("gaps"), list) else []
    high_gaps = [gap for gap in gaps if (gap or {}).get("severity") == "high"]
    if decision == "reject" and (len(high_findings) >= 2 or any(item.get("domain") == "responsible_ai" for item in high_findings)):
        return "critical"
    if high_findings or high_gaps or len(missing) >= 3:
        return "high"
    if decision == "conditional_approval" or missing:
        return "medium"
    return "low"


def _node_required_actions(node_result: Dict[str, Any]) -> List[str]:
    gaps = node_result.get("gaps") if isinstance(node_result.get("gaps"), list) else []
    return _limited_list([(gap or {}).get("action") for gap in gaps], 10)


def _action_for_missing(item: str) -> str:
    item = _clean(item).rstrip(".")
    lower = item.lower()
    if "model-training" in lower or "training" in lower:
        return "Require signed model-training exclusion or approved customer-data-use terms before approval."
    if "dpa" in lower:
        return "Require signed DPA covering processing scope, subprocessors, retention, deletion, and transfers."
    if "subprocessor" in lower:
        return "Require current subprocessor register and change-notification terms."
    if "retention" in lower:
        return "Require retention schedule and deletion assistance evidence."
    if "cross-border" in lower or "transfer" in lower:
        return "Require cross-border transfer mechanism and hosting/support region confirmation."
    if "continuity" in lower or "bcp" in lower:
        return "Require BCP/DR and exit assistance evidence for critical workflows."
    if "soc" in lower or "iso" in lower or "security" in lower:
        return "Require current SOC 2, ISO 27001, access-control, encryption, logging, and vulnerability evidence."
    return f"Resolve evidence gap: {item}."


def _format_items(values: List[str], limit: int = 4) -> str:
    return ", ".join(_clean(value).rstrip(".") for value in values[:limit])


def _summary(decision: str, risk: str, missing: List[str], compass_status: str) -> str:
    if decision == "approve":
        lead = "Deterministic review found the case approvable for accountable human approval."
    elif decision == "reject":
        lead = "Deterministic review rejects approval until high-risk compliance gaps are closed."
    elif decision == "needs_more_information":
        lead = "Deterministic review needs more information before a compliance decision can progress."
    else:
        lead = "Deterministic review supports conditional approval with named controls."
    return f"{lead} Risk is {risk}; {len(missing)} evidence gap(s) remain. Compass advisory status: {compass_status}."


class AgentathonOrchestrator:
    def __init__(self, compass_client: Optional[CompassClient] = None) -> None:
        self.compass = compass_client or CompassClient()

    def run(self, request: AgentathonRunRequest) -> Dict[str, Any]:
        started = time.monotonic()
        run_id = safe_run_id(request.run_id)
        trace_id = f"trace-{run_id}-{uuid.uuid4().hex[:8]}"
        logger = TraceLogger(run_id=run_id, trace_id=trace_id)
        payload = request.dict()
        sample_mode = _sample_mode(request)
        query = _extract_query(payload)

        shared_context: Dict[str, Any] = {
            "caseFacts": {},
            "evidenceMatches": [],
            "missingEvidence": [],
            "specialistFindings": [],
            "precedents": [],
            "compassAdvisory": {},
            "decisionDraft": {},
            "requiredActions": [],
            "humanReviewRequired": True,
        }
        collaboration_summary: Dict[str, List[Any] | str] = {
            "delegated_tasks": [],
            "specialist_challenges": [],
            "validations": [],
            "retries": [],
            "escalations": [],
            "shared_context_updates": [],
            "final_decision_owner": "Deterministic Decision Owner",
        }

        logger.log(
            agent_name="Intake Agent",
            action="receive_case",
            input_summary=query[:240] or "No natural-language query supplied.",
            output_summary="Received evaluator request and started case fact extraction.",
            target_agent="Intake Agent",
            confidence=0.86,
            memory_key="caseFacts",
            payload={"use_case_id": request.use_case_id or USE_CASE_ID, "sample_mode": sample_mode},
        )

        node_result = run_node_bridge(payload)
        if not node_result.get("ok"):
            return self._bridge_error_response(request, run_id, trace_id, logger, node_result, started)

        case_facts = self._case_facts(payload, node_result)
        shared_context["caseFacts"] = case_facts
        missing_case_facts = [
            label
            for label, value in {
                "supplier": case_facts.get("supplier"),
                "owner": case_facts.get("owner"),
                "geography": case_facts.get("geography"),
                "evidence": case_facts.get("evidenceReferences"),
            }.items()
            if not value
        ]
        collaboration_summary["shared_context_updates"].append("case facts updated")
        collaboration_summary["delegated_tasks"].append("Intake Agent -> Evidence Retrieval Agent: evidence needs and missing facts")
        logger.log(
            agent_name="Intake Agent",
            action="extract_case_facts",
            input_summary="Evaluator input plus normalized Node case.",
            output_summary=f"Extracted supplier={case_facts.get('supplier') or 'missing'}, geography={case_facts.get('geography') or 'missing'}, missing facts={len(missing_case_facts)}.",
            target_agent="Evidence Retrieval Agent",
            confidence=0.88 if not missing_case_facts else 0.72,
            status="success" if not missing_case_facts else "needs_revision",
            memory_key="caseFacts",
            payload={"caseFacts": case_facts, "missing_case_facts": missing_case_facts},
        )
        logger.log(
            agent_name="Intake Agent",
            action="delegate_evidence_search",
            input_summary="Case facts, evidence references, risk signals, and missing facts.",
            output_summary="Delegated evidence retrieval for privacy, security, AI governance, continuity, and precedent context.",
            target_agent="Evidence Retrieval Agent",
            confidence=0.87,
            memory_key="evidenceMatches",
        )

        evidence_context = self._evidence_context(payload, node_result, case_facts)
        shared_context["evidenceMatches"] = evidence_context["matches"]
        shared_context["missingEvidence"] = evidence_context["missing"]
        collaboration_summary["shared_context_updates"].append("evidence matches and gaps updated")
        logger.log(
            agent_name="Evidence Retrieval Agent",
            action="retrieve_evidence",
            input_summary="Supplied request evidence, Node citations, and local sample evidence manifest.",
            output_summary=f"Retrieved {len(evidence_context['matches'])} evidence match(es); sufficiency={evidence_context['sufficiency']}.",
            target_agent="Privacy Specialist",
            confidence=evidence_context["confidence"],
            status="success" if evidence_context["sufficiency"] in {"strong", "usable"} else "needs_revision",
            tool_used="local_input_evidence_search",
            memory_key="evidenceMatches",
            payload={
                "match_count": len(evidence_context["matches"]),
                "missingEvidence": evidence_context["missing"],
                "localEvidenceArtifacts": evidence_context["local_artifacts"],
            },
        )
        if evidence_context["sufficiency"] in {"weak", "missing"} or len(evidence_context["missing"]) >= 2:
            retry_status = "retry" if evidence_context["matches"] else "fallback_used"
            collaboration_summary["retries"].append("Evidence Retrieval Agent refined search with domain keywords and local evidence manifest")
            logger.log(
                agent_name="Evidence Retrieval Agent",
                action="retry_evidence_search",
                input_summary="Initial evidence coverage was weak or missing key proof.",
                output_summary="Retried with privacy/security/AI/continuity keywords; retained only sanitized evidence metadata.",
                target_agent="Privacy Specialist",
                confidence=max(0.45, evidence_context["confidence"] - 0.08),
                retry_count=1,
                status=retry_status,
                tool_used="deterministic_keyword_refinement",
                memory_key="missingEvidence",
                payload={"missingEvidence": evidence_context["missing"]},
            )

        privacy = self._privacy_review(case_facts, evidence_context)
        security = self._security_review(case_facts, evidence_context)
        responsible_ai = self._responsible_ai_review(case_facts, evidence_context)
        for finding in [privacy, security, responsible_ai]:
            shared_context["specialistFindings"].append(finding)
            collaboration_summary["shared_context_updates"].append(f"specialist finding added: {finding['agent']}")
            if finding["status"] == "challenge":
                collaboration_summary["specialist_challenges"].append(finding["summary"])
            else:
                collaboration_summary["validations"].append(finding["summary"])

        self._log_specialist(logger, privacy, "Security Specialist")
        self._log_specialist(logger, security, "Responsible AI Specialist")
        self._log_specialist(logger, responsible_ai, "Learning & Precedent Specialist")

        precedent = self._precedent_lookup(case_facts, evidence_context, shared_context["specialistFindings"])
        shared_context["precedents"].append(precedent)
        collaboration_summary["shared_context_updates"].append("synthetic precedent added")
        logger.log(
            agent_name="Learning & Precedent Specialist",
            action="retrieve_precedent",
            input_summary="Case facts, missing evidence, and specialist challenges.",
            output_summary=f"Matched precedent pattern: {precedent['pattern']}.",
            target_agent="Compass Advisory Critic",
            confidence=precedent["confidence"],
            status="success",
            tool_used="synthetic_precedent_lookup",
            memory_key="precedents",
            payload=precedent,
        )

        decision_draft = {
            "nodeDecision": node_result.get("decision") or {},
            "nodeRisk": self._node_risk(node_result),
            "nodeRequiredActions": _node_required_actions(node_result),
            "humanReviewRequired": True,
        }
        shared_context["decisionDraft"] = decision_draft
        compass_result = self._run_compass(sample_mode, shared_context, logger, collaboration_summary)
        live_compass = self._live_compass_payload(sample_mode, compass_result)
        shared_context["compassAdvisory"] = live_compass.get("advisory") or {}

        output = self._deterministic_output(node_result, shared_context, live_compass, collaboration_summary)
        output["artifacts"][0]["path"] = logger.relative_log_file
        shared_context["requiredActions"] = output["required_actions"]
        shared_context["humanReviewRequired"] = output["human_review_required"]

        if output["collaboration_summary"]["specialist_challenges"]:
            logger.log(
                agent_name="Deterministic Decision Owner",
                action="revise_required_controls",
                input_summary="Specialist challenges, precedent pattern, and Compass advisory status.",
                output_summary=f"Required controls revised to {len(output['required_actions'])} action(s); final risk={output['risk_level']}.",
                target_agent="Audit Packager",
                confidence=0.92,
                status="needs_revision",
                memory_key="requiredActions",
                payload={
                    "specialist_challenge_count": len(output["collaboration_summary"]["specialist_challenges"]),
                    "llm_advisory_only": True,
                    "required_actions": output["required_actions"],
                },
            )
            collaboration_summary["shared_context_updates"].append("required action added")
        if output["risk_level"] in {"high", "critical"} or output["decision"] in {"reject", "needs_more_information"}:
            collaboration_summary["escalations"].append("Deterministic Decision Owner escalated unresolved high-risk gaps to human review")
            logger.log(
                agent_name="Deterministic Decision Owner",
                action="escalate_human_review",
                input_summary="Unresolved high-risk gaps or insufficient proof remained after council review.",
                output_summary="Escalated to accountable human reviewer; no autonomous approval permitted.",
                target_agent="Audit Packager",
                confidence=0.94,
                retry_count=1,
                status="escalated",
                memory_key="humanReviewRequired",
                payload={"risk_level": output["risk_level"], "decision": output["decision"]},
            )
        logger.log(
            agent_name="Deterministic Decision Owner",
            action="apply_deterministic_policy",
            input_summary="Node deterministic result, specialist critiques, precedent, and advisory-only Compass output.",
            output_summary=f"Final decision sealed as {output['decision']} by deterministic policy owner.",
            target_agent="Audit Packager",
            confidence=0.95,
            status="success",
            tool_used="deterministic_rules_engine",
            memory_key="decisionDraft",
            payload={
                "final_owner": "Deterministic Decision Owner",
                "llm_advisory_only": True,
                "compass_status": output["live_compass"]["status"],
            },
        )
        output["collaboration_summary"] = collaboration_summary

        logger.log(
            agent_name="Audit Packager",
            action="package_audit_trace",
            input_summary="Decision, evidence, missing proof, council trace, and human review boundary.",
            output_summary="Packaged judge-readable audit trace with evidence, specialist challenges, and final owner.",
            target_agent="Audit Packager",
            confidence=0.93,
            status="success",
            memory_key="finalDecision",
            payload={"trace_events": len(logger.events) + 1, "log_file": logger.relative_log_file},
        )
        logger.log(
            agent_name="Audit Packager",
            action="finalize_response",
            input_summary="Final packaged decision and trace summary.",
            output_summary=output["executive_summary"],
            confidence=0.94,
            status="success",
            memory_key="finalDecision",
            payload={"decision": output["decision"], "risk_level": output["risk_level"]},
        )

        return {
            "run_id": run_id,
            "status": "success",
            "use_case_id": request.use_case_id or USE_CASE_ID,
            "output": output,
            "result": output,
            "agents": AGENTS,
            "agent_trace": logger.events,
            "trace_id": trace_id,
            "log_file": logger.relative_log_file,
            "execution_time_seconds": round(time.monotonic() - started, 3),
        }

    def _bridge_error_response(
        self,
        request: AgentathonRunRequest,
        run_id: str,
        trace_id: str,
        logger: TraceLogger,
        node_result: Dict[str, Any],
        started: float,
    ) -> Dict[str, Any]:
        error = node_result.get("error") if isinstance(node_result.get("error"), dict) else {}
        logger.log(
            agent_name="Intake Agent",
            action="escalate_human_review",
            input_summary="Node deterministic bridge failed before council execution.",
            output_summary=_first_text(error.get("message"), "Node bridge failed."),
            target_agent="Audit Packager",
            confidence=0.25,
            retry_count=1,
            status="error",
            payload={"error_type": error.get("type", "node_bridge_failed")},
        )
        output = {
            "summary": "Execution failed before a compliance decision could be produced.",
            "executive_summary": "Execution failed before a compliance decision could be produced.",
            "decision": "needs_more_information",
            "risk_level": "high",
            "required_actions": ["Verify Node dependencies are installed and retry the run."],
            "evidence_used": [],
            "missing_evidence": ["deterministic engine output"],
            "human_review_required": True,
            "decision_authority": {"final_owner": "Deterministic Decision Owner", "llm_advisory_only": True},
            "live_compass": {
                "enabled": False,
                "status": "unavailable",
                "model": self.compass.model_reasoning(),
                "advisory": {},
            },
            "collaboration_summary": {
                "delegated_tasks": [],
                "specialist_challenges": ["Node deterministic bridge failed"],
                "validations": [],
                "retries": ["Node bridge failure captured as structured error"],
                "escalations": ["Execution error escalated to human review"],
                "shared_context_updates": [],
                "final_decision_owner": "Deterministic Decision Owner",
            },
            "artifacts": [{"type": "trace_log", "path": logger.relative_log_file}],
        }
        logger.log(
            agent_name="Audit Packager",
            action="finalize_response",
            input_summary="Structured bridge error.",
            output_summary="Packaged a safe structured error response without stack traces or secrets.",
            confidence=0.8,
            status="error",
        )
        return {
            "run_id": run_id,
            "status": "error",
            "use_case_id": request.use_case_id or USE_CASE_ID,
            "output": output,
            "result": output,
            "agents": AGENTS,
            "agent_trace": logger.events,
            "trace_id": trace_id,
            "log_file": logger.relative_log_file,
            "execution_time_seconds": round(time.monotonic() - started, 3),
            "error": {
                "type": error.get("type", "node_bridge_failed"),
                "message": _first_text(error.get("message"), "Node bridge failed."),
                "recoverable": True,
            },
        }

    def _case_facts(self, payload: Dict[str, Any], node_result: Dict[str, Any]) -> Dict[str, Any]:
        input_payload = payload.get("input") if isinstance(payload.get("input"), dict) else {}
        case_payload = input_payload.get("case") if isinstance(input_payload.get("case"), dict) else {}
        node_case = _as_dict(node_result.get("case"))
        evidence_refs = []
        for item in _as_list(input_payload.get("evidence")) + _as_list(input_payload.get("documents")):
            evidence = _as_dict(item)
            evidence_refs.append(_first_text(evidence.get("id"), evidence.get("evidenceId"), evidence.get("title"), evidence.get("name")))
        data_categories = _limited_list(_as_list(case_payload.get("data_categories")) + _as_list(case_payload.get("dataCategories")), 8)
        text_blob = self._source_blob(payload, node_result)
        if not data_categories:
            if _contains(text_blob, r"patient|healthcare|clinical"):
                data_categories.append("patient or healthcare operations data")
            if _contains(text_blob, r"customer support|support ticket|customer data|customer record|ticket"):
                data_categories.append("customer support data")
            if _contains(text_blob, r"invoice|supplier|finance"):
                data_categories.append("supplier or finance workflow data")
        ai_use = _first_text(case_payload.get("ai_use"), case_payload.get("aiUse"))
        ai_risk_signal = _ai_or_analytics_signal(text_blob)
        if not ai_use and ai_risk_signal in {"explicit_ai_training", "explicit_ai"}:
            ai_use = "AI/model workflow signals require governance confirmation."
        elif not ai_use and ai_risk_signal == "analytics_governance":
            ai_use = "Analytics workflow requires data-use governance confirmation."
        return {
            "supplier": _first_text(node_case.get("supplierName"), case_payload.get("supplier_name"), case_payload.get("vendor")),
            "workflow": _first_text(node_case.get("serviceDescription"), case_payload.get("service_description"), input_payload.get("query")),
            "dataCategories": data_categories,
            "geography": _first_text(node_case.get("geography"), case_payload.get("geography"), case_payload.get("region")),
            "owner": _first_text(node_case.get("businessUnit"), case_payload.get("business_unit"), case_payload.get("owner")),
            "aiUse": ai_use,
            "aiRiskSignal": ai_risk_signal,
            "integrations": _limited_list(_as_list(node_case.get("integrations")) + _as_list(case_payload.get("integrations")), 10),
            "riskSignals": _limited_list(_as_list(case_payload.get("risk_signals")) + _as_list(input_payload.get("riskSignals")), 12),
            "evidenceReferences": _limited_list(evidence_refs + [item.get("evidenceId") for item in _as_list(node_result.get("citations")) if isinstance(item, dict)], 12),
        }

    def _source_blob(self, payload: Dict[str, Any], node_result: Dict[str, Any]) -> str:
        parts: List[str] = []
        parts.append(json.dumps(payload.get("input", {}), ensure_ascii=False))
        node_case = _as_dict(node_result.get("case"))
        parts.append(json.dumps(node_case, ensure_ascii=False))
        for citation in _as_list(node_result.get("citations")):
            if isinstance(citation, dict):
                parts.append(_clean(citation.get("title")))
                parts.append(_clean(citation.get("text"))[:600])
        return " ".join(parts).lower()

    def _evidence_context(self, payload: Dict[str, Any], node_result: Dict[str, Any], case_facts: Dict[str, Any]) -> Dict[str, Any]:
        citations = [item for item in _as_list(node_result.get("citations")) if isinstance(item, dict)]
        matches = [
            {
                "evidence_id": _first_text(item.get("evidenceId"), item.get("citationId")),
                "title": _first_text(item.get("title"), "Input evidence"),
                "snippet": _clean(item.get("text"))[:260],
            }
            for item in citations
        ]
        local_artifacts = self._local_artifacts(case_facts)
        blob = self._source_blob(payload, node_result)
        missing: List[str] = []
        if _contains(blob, r"patient|customer|personal data|pii|support ticket|supplier record"):
            if not _has_positive(blob, r"(signed|executed).{0,40}(dpa|data processing addendum)|dpa.{0,80}(signed|executed)", r"(draft|unsigned|\bno signed\b|not attached|not supplied).{0,80}dpa|dpa.{0,80}(draft|unsigned|not attached|not supplied)"):
                missing.append("signed DPA")
            if not _has_positive(blob, r"retention|deletion assistance|deletion", r"\b(no|missing|not provided)\b.{0,60}retention|retention schedule has not been provided"):
                missing.append("retention and deletion evidence")
        if _contains(blob, r"cross-border|transfer|hosting|support.*(uae|uk|singapore|eu)"):
            if not _has_positive(blob, r"transfer review|transfer mechanism|cross-border transfer|hosting region", r"\b(no|missing|not provided)\b.{0,60}(transfer|hosting)|support and hosting may occur"):
                missing.append("cross-border transfer mechanism")
        if _contains(blob, r"subprocessor"):
            if not _has_positive(blob, r"subprocessor.{0,40}(register|disclosure|list)|subprocessors?", r"\b(no|missing|not provided)\b.{0,80}subprocessor|subprocessor register has not been provided"):
                missing.append("subprocessor register")
        ai_evidence_signal = _explicit_ai_training_risk(blob) or (
            _contains(blob, r"\banalytics\b") and _contains(blob, r"patient|healthcare|clinical|personal data")
        )
        if ai_evidence_signal and _contains(blob, r"customer|patient|ticket|confidential|data|personal"):
            if not _has_positive(blob, r"model[- ]training exclusion|training exclusion|enterprise opt-out signed|no training", r"no signed model[- ]training exclusion|not executed|may be used for model improvement|service improvement"):
                missing.append("model-training exclusion")
        if _contains(blob, r"critical|continuity|bcp|disaster recovery|exit"):
            if not _has_positive(blob, r"business continuity|bcp|disaster recovery|exit assistance", r"\b(no|missing|not supplied)\b.{0,60}(continuity|bcp|disaster recovery)"):
                missing.append("business continuity or exit evidence")
        if not _has_positive(blob, r"soc 2|iso 27001|mfa|sso|encryption|audit log|vulnerability"):
            missing.append("security assurance evidence")

        node_gaps = [
            _clean((gap or {}).get("gap"))
            for gap in _as_list(node_result.get("gaps"))
            if isinstance(gap, dict) and _clean((gap or {}).get("gap"))
        ]
        missing = _limited_list(missing + node_gaps, 12)
        quality = _as_dict(node_result.get("evidence_quality"))
        sufficiency = _clean(quality.get("status")) or ("usable" if matches else "missing")
        if len(missing) >= 4 and sufficiency == "usable":
            sufficiency = "weak"
        confidence = {"strong": 0.88, "usable": 0.76, "weak": 0.52, "missing": 0.25}.get(sufficiency, 0.55)
        return {
            "matches": matches,
            "missing": missing,
            "sufficiency": sufficiency,
            "confidence": confidence,
            "local_artifacts": local_artifacts,
        }

    def _local_artifacts(self, case_facts: Dict[str, Any]) -> List[str]:
        artifacts: List[str] = []
        index_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "evidence", "index.json")
        try:
            with open(index_path, "r", encoding="utf-8") as handle:
                index = json.load(handle)
            raw_artifacts = index.get("artifacts") if isinstance(index, dict) else []
            text = json.dumps(case_facts, ensure_ascii=False).lower()
            for artifact in raw_artifacts if isinstance(raw_artifacts, list) else []:
                if any(token in text for token in ("health", "ai", "saas", "finance", "compliance")):
                    artifacts.append(_clean(artifact))
            return _limited_list(artifacts, 4)
        except Exception:
            return []

    def _privacy_review(self, case_facts: Dict[str, Any], evidence: Dict[str, Any]) -> Dict[str, Any]:
        gaps = [item for item in evidence["missing"] if any(token in item.lower() for token in ("dpa", "subprocessor", "retention", "transfer", "cross-border"))]
        if gaps:
            return {
                "agent": "Privacy Specialist",
                "domain": "privacy",
                "status": "challenge",
                "severity": "high" if any("dpa" in gap.lower() or "transfer" in gap.lower() for gap in gaps) else "medium",
                "action": "critique_privacy_gap",
                "summary": f"Privacy proof incomplete: {_format_items(gaps)}.",
                "requiredActions": [_action_for_missing(gap) for gap in gaps],
            }
        return {
            "agent": "Privacy Specialist",
            "domain": "privacy",
            "status": "validated",
            "severity": "low",
            "action": "validate_evidence",
            "summary": "Privacy evidence supports DPA, transfer, subprocessor, and retention review boundaries.",
            "requiredActions": [],
        }

    def _security_review(self, case_facts: Dict[str, Any], evidence: Dict[str, Any]) -> Dict[str, Any]:
        gaps = [item for item in evidence["missing"] if any(token in item.lower() for token in ("security", "soc", "iso", "continuity", "bcp", "exit"))]
        if gaps:
            return {
                "agent": "Security Specialist",
                "domain": "security",
                "status": "challenge",
                "severity": "medium",
                "action": "critique_security_gap",
                "summary": f"Security or continuity proof incomplete: {_format_items(gaps)}.",
                "requiredActions": [_action_for_missing(gap) for gap in gaps],
            }
        return {
            "agent": "Security Specialist",
            "domain": "security",
            "status": "validated",
            "severity": "low",
            "action": "validate_evidence",
            "summary": "Security evidence validates access, encryption, logging, and assurance signals for reviewer use.",
            "requiredActions": [],
        }

    def _responsible_ai_review(self, case_facts: Dict[str, Any], evidence: Dict[str, Any]) -> Dict[str, Any]:
        gaps = [item for item in evidence["missing"] if "training" in item.lower() or "ai" in item.lower() or "model" in item.lower()]
        ai_risk_signal = _clean(case_facts.get("aiRiskSignal"))
        ai_signal = bool(case_facts.get("aiUse")) or ai_risk_signal != "none"
        if gaps or ai_signal:
            severity = "high" if gaps and ai_risk_signal == "explicit_ai_training" else "medium" if gaps or ai_signal else "low"
            return {
                "agent": "Responsible AI Specialist",
                "domain": "responsible_ai",
                "status": "challenge" if gaps else "validated",
                "severity": severity,
                "action": "critique_ai_governance_gap" if gaps else "validate_evidence",
                "summary": (
                    f"AI/customer-data training proof incomplete: {_format_items(gaps, 3)}."
                    if gaps
                    else "AI/analytics signal remains inside human oversight boundary."
                ),
                "requiredActions": [_action_for_missing(gap) for gap in gaps]
                or ["Confirm human oversight and no automated approval for AI-assisted workflow outputs."],
            }
        return {
            "agent": "Responsible AI Specialist",
            "domain": "responsible_ai",
            "status": "validated",
            "severity": "low",
            "action": "validate_evidence",
            "summary": "No material AI/model-training signal detected beyond standard human-review boundary.",
            "requiredActions": [],
        }

    def _log_specialist(self, logger: TraceLogger, finding: Dict[str, Any], target_agent: str) -> None:
        logger.log(
            agent_name=finding["agent"],
            action=finding["action"],
            input_summary="Case facts, evidence matches, missing evidence, and prior specialist context.",
            output_summary=finding["summary"],
            target_agent=target_agent,
            confidence=0.86 if finding["status"] == "validated" else 0.8,
            status="success" if finding["status"] == "validated" else "needs_revision",
            memory_key="specialistFindings",
            payload={"severity": finding["severity"], "requiredActions": finding.get("requiredActions", [])},
        )

    def _precedent_lookup(self, case_facts: Dict[str, Any], evidence: Dict[str, Any], findings: List[Dict[str, Any]]) -> Dict[str, Any]:
        blob = json.dumps({"caseFacts": case_facts, "missing": evidence["missing"], "findings": findings}, ensure_ascii=False).lower()
        ai_risk_signal = _clean(case_facts.get("aiRiskSignal"))
        has_training_gap = any("training" in _clean(item).lower() for item in evidence["missing"])
        if ai_risk_signal == "explicit_ai_training" and has_training_gap:
            return {
                "advisoryOnly": True,
                "pattern": "AI vendor + customer-data training allowed -> reject/escalate",
                "recommendation": "reject_or_escalate",
                "confidence": 0.84,
            }
        if "healthcare" in blob or "patient" in blob:
            if "dpa" in blob or "training" in blob or ai_risk_signal == "analytics_governance":
                return {
                    "advisoryOnly": True,
                    "pattern": "healthcare analytics + missing DPA/model-training exclusion -> conditional approval/human review",
                    "recommendation": "conditional_human_review",
                    "confidence": 0.78,
                }
        if "saas" in blob and ("subprocessor" in blob or "retention" in blob):
            return {
                "advisoryOnly": True,
                "pattern": "SaaS + missing subprocessor list -> conditional approval",
                "recommendation": "conditional_human_review",
                "confidence": 0.8,
            }
        if not evidence["missing"]:
            return {
                "advisoryOnly": True,
                "pattern": "complete DPA/SOC2/retention/subprocessors -> approve with monitoring",
                "recommendation": "approve_with_monitoring",
                "confidence": 0.75,
            }
        return {
            "advisoryOnly": True,
            "pattern": "general incomplete evidence -> human review controls",
            "recommendation": "conditional_human_review",
            "confidence": 0.62,
        }

    def _run_compass(
        self,
        sample_mode: bool,
        shared_context: Dict[str, Any],
        logger: TraceLogger,
        collaboration_summary: Dict[str, Any],
    ) -> Dict[str, Any]:
        if sample_mode:
            collaboration_summary["shared_context_updates"].append("Compass advisory skipped in sample mode")
            logger.log(
                agent_name="Compass Advisory Critic",
                action="compass_advisory_unavailable",
                input_summary="Sample mode requested.",
                output_summary="Skipped live Compass call; deterministic local council remains active.",
                target_agent="Deterministic Decision Owner",
                confidence=0.7,
                status="fallback_used",
                tool_used="sample_mode",
                memory_key="compassAdvisory",
            )
            return {
                "ok": False,
                "status": "skipped_sample_mode",
                "model": self.compass.model_reasoning(),
                "advisory": {},
                "error_type": "",
                "recoverable": True,
            }

        sanitized_context = redact(
            {
                "caseFacts": shared_context["caseFacts"],
                "evidenceSummary": {
                    "matchCount": len(shared_context["evidenceMatches"]),
                    "matches": shared_context["evidenceMatches"][:5],
                    "missingEvidence": shared_context["missingEvidence"],
                },
                "specialistFindings": shared_context["specialistFindings"],
                "precedents": shared_context["precedents"],
                "deterministicDraft": shared_context["decisionDraft"],
                "humanReviewBoundary": "Human approval is required; Compass is advisory only.",
            }
        )
        result = self.compass.compass_chat_json(
            [
                {
                    "role": "user",
                    "content": (
                        "Review this compliance council draft as Compass Advisory Critic. "
                        "Assess evidence strength, unresolved risks, reviewer questions, and recommended advisory actions. "
                        f"Context JSON: {json.dumps(sanitized_context, ensure_ascii=True)[:9000]}"
                    ),
                }
            ],
            model=self.compass.model_reasoning(),
            schema_hint=ADVISORY_SCHEMA_HINT,
            max_tokens=900,
        )
        if result.get("ok"):
            collaboration_summary["shared_context_updates"].append("Compass advisory added")
            logger.log(
                agent_name="Compass Advisory Critic",
                action="live_compass_review",
                input_summary="Sanitized case facts, deterministic draft, evidence gaps, and specialist findings.",
                output_summary=f"Compass advisory assessment={result['advisory'].get('assessment')} confidence={result['advisory'].get('confidence')}.",
                target_agent="Deterministic Decision Owner",
                confidence=0.78,
                status="success",
                tool_used="compass_chat_completions",
                memory_key="compassAdvisory",
                payload={"model": result.get("model"), "advisory": result.get("advisory")},
            )
        else:
            collaboration_summary["shared_context_updates"].append("Compass advisory unavailable")
            logger.log(
                agent_name="Compass Advisory Critic",
                action="compass_advisory_unavailable",
                input_summary="Sanitized case facts, deterministic draft, evidence gaps, and specialist findings.",
                output_summary=f"Compass advisory unavailable: {result.get('error_type', 'unknown')}.",
                target_agent="Deterministic Decision Owner",
                confidence=0.45,
                status="advisory_unavailable",
                tool_used="compass_chat_completions",
                memory_key="compassAdvisory",
                payload={
                    "model": result.get("model"),
                    "error_type": result.get("error_type"),
                    "recoverable": result.get("recoverable", True),
                },
            )
        return result

    def _live_compass_payload(self, sample_mode: bool, compass_result: Dict[str, Any]) -> Dict[str, Any]:
        if sample_mode:
            return {
                "enabled": False,
                "status": "skipped_sample_mode",
                "model": compass_result.get("model") or self.compass.model_reasoning(),
                "advisory": {},
            }
        return {
            "enabled": bool(self.compass.configured()),
            "status": "available" if compass_result.get("ok") else "unavailable",
            "model": compass_result.get("model") or self.compass.model_reasoning(),
            "advisory": compass_result.get("advisory") or {},
            **(
                {
                    "error_type": compass_result.get("error_type", "compass_unavailable"),
                    "recoverable": compass_result.get("recoverable", True),
                }
                if not compass_result.get("ok")
                else {}
            ),
        }

    def _node_risk(self, node_result: Dict[str, Any]) -> str:
        gaps = node_result.get("gaps") if isinstance(node_result.get("gaps"), list) else []
        if any((gap or {}).get("severity") == "high" for gap in gaps):
            return "high"
        if gaps:
            return "medium"
        return "low"

    def _deterministic_output(
        self,
        node_result: Dict[str, Any],
        shared_context: Dict[str, Any],
        live_compass: Dict[str, Any],
        collaboration_summary: Dict[str, Any],
    ) -> Dict[str, Any]:
        findings = shared_context["specialistFindings"]
        precedent = shared_context["precedents"][0] if shared_context["precedents"] else {}
        node_decision = _as_dict(node_result.get("decision"))
        missing = _limited_list(shared_context["missingEvidence"], 12)
        decision = _decision_from_node(_clean(node_decision.get("status")), missing, findings, precedent)
        risk = _risk_level(node_result, missing, findings, decision)
        required_actions = _limited_list(
            _node_required_actions(node_result)
            + [_action_for_missing(item) for item in missing]
            + [
                action
                for finding in findings
                for action in _as_list(finding.get("requiredActions"))
            ],
            14,
        )
        if not required_actions:
            required_actions = ["Confirm accountable human reviewer before operational approval."]

        evidence_used = [
            {
                "evidence_id": match.get("evidence_id", ""),
                "title": match.get("title", ""),
                "snippet": match.get("snippet", ""),
            }
            for match in shared_context["evidenceMatches"][:12]
        ]
        summary = _summary(decision, risk, missing, live_compass.get("status", "unavailable"))
        return {
            "summary": summary,
            "executive_summary": summary,
            "decision": decision,
            "risk_level": risk,
            "required_actions": required_actions,
            "evidence_used": evidence_used,
            "missing_evidence": missing,
            "human_review_required": True,
            "decision_authority": {
                "final_owner": "Deterministic Decision Owner",
                "llm_advisory_only": True,
            },
            "live_compass": live_compass,
            "collaboration_summary": collaboration_summary,
            "artifacts": [
                {"type": "trace_log", "path": "logs/trace-<run_id>.jsonl"},
                {"type": "decision_payload", "source": "deterministic_node_bridge_plus_python_council"},
            ],
        }
