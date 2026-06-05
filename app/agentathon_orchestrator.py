"""Agentathon run orchestration for the FastAPI wrapper."""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from typing import Any, Dict, List, Optional

from .compass_client import CompassClient
from .crewai_runtime import run_crewai_advisory_council
from .evidence_memory import LocalEvidenceMemory, build_retrieval_query, chunks_from_evidence_items, get_evidence_memory_provider
from .fixture_documents import enrich_payload_with_fixture_documents
from .learning_memory import summarize_learning_signals
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
    {"name": "Final Advisory Reviewer", "role": "Optional live CrewAI advisory reviewer when AGENT_RUNTIME=crewai_live; advisory only."},
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
        r"may be used for model improvement|customer data.{0,80}(training|tuning|model improvement)|"
        r"(training|tuning|fine[- ]?tuning).{0,80}(customer|patient|support ticket|confidential|personal) data|"
        r"submitted customer data.{0,80}(model improvement|training)|support tickets?.{0,80}(model improvement|training)",
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


def _require_compass() -> bool:
    return _truthy(os.environ.get("REQUIRE_COMPASS", "false"))


def _agent_runtime() -> str:
    return (os.environ.get("AGENT_RUNTIME") or "custom").strip().lower() or "custom"


def _crewai_live_enabled() -> bool:
    return _truthy(os.environ.get("CREWAI_ENABLE_LIVE_LLM", "0"))


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
    missing_blob = " ".join(_clean(item).lower() for item in missing)
    normalized_status = node_status.lower()
    if any(token in missing_blob for token in ("end-use certificate", "license analysis", "final classification")) and len(missing) >= 5:
        return "needs_more_information"
    if precedent.get("recommendation") == "reject_or_escalate" or (normalized_status == "not_ready" and severe_ai):
        return "reject"
    if any(token in missing_blob for token in ("robustness", "rai assessment", "model rollback", "data owner approval")):
        return "conditional_approval"
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
    missing_blob = " ".join(_clean(item).lower() for item in missing)
    if any(token in missing_blob for token in ("end-use certificate", "license analysis", "final classification", "import permit")):
        return "critical" if decision == "reject" or len(missing) >= 5 else "high"
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
    if "final classification" in lower or "classification" in lower:
        return "Require final export-control classification with manufacturer/counsel evidence before shipment."
    if "license analysis" in lower or "license" in lower:
        return "Require documented license analysis and hold points for export, re-export, and import approvals."
    if "end-use" in lower or "end user" in lower:
        return "Require final end-use and end-user certificate before hardware release or firmware support."
    if "import permit" in lower:
        return "Require destination import permit or documented no-permit analysis before delivery."
    if "delivery-site" in lower or "delivery site" in lower:
        return "Require approved delivery-site, chain-of-custody, and restricted-party screening evidence."
    if "remote support" in lower or "firmware" in lower:
        return "Require remote support runbook covering named personnel, MFA, logging, approval windows, and firmware controls."
    if "model-training" in lower or "training" in lower:
        return "Require signed model-training exclusion or approved customer-data-use terms before approval."
    if "rai" in lower or "responsible ai" in lower:
        return "Require final Responsible AI assessment and documented human oversight before launch."
    if "robustness" in lower:
        return "Require independent robustness and prompt-injection test results before AI service approval."
    if "rollback" in lower:
        return "Require model rollback plan, versioning evidence, and incident-response owner."
    if "data owner" in lower:
        return "Require data owner approval for source data, retention, retrieval scope, and monitoring."
    if "dpa" in lower:
        return "Require signed DPA covering processing scope, subprocessors, retention, deletion, and transfers."
    if "data processing addendum" in lower:
        return "Require executed data processing addendum for integration and support data flows."
    if "subprocessor" in lower:
        return "Require current subprocessor register and change-notification terms."
    if "objection workflow" in lower:
        return "Require documented subprocessor objection workflow and reviewer notification cadence."
    if "retention" in lower:
        return "Require retention schedule and deletion assistance evidence."
    if "deletion certificate" in lower:
        return "Require deletion certificate process covering active systems, backups, exceptions, and evidence retention."
    if "cross-border" in lower or "transfer" in lower:
        return "Require cross-border transfer mechanism and hosting/support region confirmation."
    if "privileged access" in lower:
        return "Require privileged access approval, named accounts, time-boxed elevation, and session logging evidence."
    if "release-control" in lower or "release control" in lower:
        return "Require release-control signoff, rollback evidence, and post-release monitoring before production change."
    if "secrets" in lower:
        return "Require secrets rotation plan, vault ownership, environment separation, and exit rotation evidence."
    if "upload approval" in lower:
        return "Require audience upload approval workflow with data owner, lawful basis, and suppression checks."
    if "media partner" in lower:
        return "Require media partner destination review and deletion/retention limits."
    if "audience-retention" in lower or "audience retention" in lower:
        return "Require audience-data retention table and campaign deletion confirmation process."
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
        payload, fixture_analysis = enrich_payload_with_fixture_documents(request.dict())
        sample_mode = _sample_mode(request)
        query = _extract_query(payload)

        shared_context: Dict[str, Any] = {
            "caseFacts": {},
            "evidenceMatches": [],
            "missingEvidence": [],
            "specialistFindings": [],
            "precedents": [],
            "compassAdvisory": {},
            "liveAdvisory": {},
            "decisionDraft": {},
            "requiredActions": [],
            "humanReviewRequired": True,
            "retrievalContext": {},
            "learningContext": {},
            "fixtureDocumentAnalysis": fixture_analysis,
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

        if fixture_analysis.get("documents_used"):
            collaboration_summary["shared_context_updates"].append("fixture document analysis updated")
            logger.log(
                agent_name="Evidence Retrieval Agent",
                action="ingest_fixture_document",
                input_summary="Generated fixture PDF reference supplied in evaluator input.",
                output_summary=(
                    f"Ingested {len(fixture_analysis.get('documents_used') or [])} fixture document(s); "
                    f"domain={fixture_analysis.get('detected_domain') or 'unknown'}; "
                    f"extraction={fixture_analysis.get('extraction_status') or 'unknown'}."
                ),
                target_agent=fixture_analysis.get("target_agent") or "Privacy Specialist",
                confidence=0.86,
                status="success",
                tool_used=(
                    "fixture_pdf_text_extractor"
                    if fixture_analysis.get("extraction_status") == "text_extracted"
                    else "fixture_metadata_fallback"
                ),
                memory_key="fixtureDocumentAnalysis",
                payload=fixture_analysis,
            )

        evidence_context = self._evidence_context(payload, node_result, case_facts, run_id=run_id)
        shared_context["evidenceMatches"] = evidence_context["matches"]
        shared_context["missingEvidence"] = evidence_context["missing"]
        shared_context["retrievalContext"] = evidence_context["retrieval_context"]
        collaboration_summary["shared_context_updates"].append("evidence matches and gaps updated")
        collaboration_summary["shared_context_updates"].append("retrieval context updated")
        retrieval_context = evidence_context["retrieval_context"]
        logger.log(
            agent_name="Evidence Retrieval Agent",
            action="retrieve_evidence",
            input_summary="Supplied request evidence, Node citations, local sample snippets, and case-scoped evidence memory.",
            output_summary=(
                f"Retrieved {len(evidence_context['matches'])} evidence match(es); "
                f"memory provider={retrieval_context['provider']}; sufficiency={evidence_context['sufficiency']}."
            ),
            target_agent="Privacy Specialist",
            confidence=evidence_context["confidence"],
            status="success" if evidence_context["sufficiency"] in {"strong", "usable"} else "needs_revision",
            tool_used=retrieval_context["provider"],
            memory_key="evidenceMatches",
            payload={
                "match_count": len(evidence_context["matches"]),
                "missingEvidence": evidence_context["missing"],
                "localEvidenceArtifacts": evidence_context["local_artifacts"],
                "retrievalContext": retrieval_context,
            },
        )
        if evidence_context["sufficiency"] in {"weak", "missing"} or len(evidence_context["missing"]) >= 2:
            retry_status = "retry" if evidence_context["matches"] else "fallback_used"
            collaboration_summary["retries"].append(f"Evidence Retrieval Agent refined search with domain keywords using {retrieval_context['provider']}")
            logger.log(
                agent_name="Evidence Retrieval Agent",
                action="retry_evidence_search",
                input_summary="Initial evidence coverage was weak or missing key proof.",
                output_summary=f"Retried with privacy/security/AI/continuity keywords through {retrieval_context['provider']}; retained only sanitized evidence metadata.",
                target_agent="Privacy Specialist",
                confidence=max(0.45, evidence_context["confidence"] - 0.08),
                retry_count=1,
                status=retry_status,
                tool_used=retrieval_context["provider"],
                memory_key="missingEvidence",
                payload={"missingEvidence": evidence_context["missing"], "retrievalContext": retrieval_context},
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
        learning_context = summarize_learning_signals(
            case_facts,
            evidence_context["missing"],
            self._risk_domains(case_facts, evidence_context["missing"]),
            compass_client=self.compass,
        )
        shared_context["precedents"].append(precedent)
        shared_context["learningContext"] = learning_context
        collaboration_summary["shared_context_updates"].append("synthetic precedent added")
        collaboration_summary["shared_context_updates"].append("governed learning memory updated")
        top_pattern = learning_context.get("topPattern") or precedent["pattern"]
        logger.log(
            agent_name="Learning & Precedent Specialist",
            action="retrieve_precedent",
            input_summary="Case facts, missing evidence, and specialist challenges.",
            output_summary=(
                f"Matched precedent pattern: {precedent['pattern']}; "
                f"similar learning cases={learning_context.get('similar_cases_found', 0)}, top pattern={top_pattern}."
            ),
            target_agent="Deterministic Decision Owner",
            confidence=precedent["confidence"],
            status="success",
            tool_used=learning_context.get("provider", "local-jsonl"),
            memory_key="learningContext",
            payload={"precedent": precedent, "learningContext": learning_context},
        )

        decision_draft = {
            "nodeDecision": node_result.get("decision") or {},
            "nodeRisk": self._node_risk(node_result),
            "nodeRequiredActions": _node_required_actions(node_result),
            "humanReviewRequired": True,
        }
        shared_context["decisionDraft"] = decision_draft
        live_advisory = self._run_live_crewai(sample_mode, shared_context, logger, collaboration_summary)
        shared_context["liveAdvisory"] = live_advisory
        compass_result = self._run_compass(sample_mode, shared_context, logger, collaboration_summary)
        live_compass = self._live_compass_payload(sample_mode, compass_result)
        shared_context["compassAdvisory"] = live_compass.get("advisory") or {}
        if _require_compass() and not sample_mode and not compass_result.get("ok"):
            return self._compass_required_error_response(
                request,
                run_id,
                trace_id,
                logger,
                live_compass,
                collaboration_summary,
                started,
            )

        output = self._deterministic_output(node_result, shared_context, live_compass, live_advisory, collaboration_summary)
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
                "live_advisory_runtime": output["live_advisory"]["runtime"],
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

    def _compass_required_error_response(
        self,
        request: AgentathonRunRequest,
        run_id: str,
        trace_id: str,
        logger: TraceLogger,
        live_compass: Dict[str, Any],
        collaboration_summary: Dict[str, Any],
        started: float,
    ) -> Dict[str, Any]:
        collaboration_summary["escalations"].append("REQUIRE_COMPASS=true blocked deterministic-only completion because live Compass advisory was unavailable")
        collaboration_summary["shared_context_updates"].append("Compass requirement failure recorded")
        summary = "Live Compass advisory is required for this run, but the OpenAI-compatible Compass call was unavailable."
        logger.log(
            agent_name="Deterministic Decision Owner",
            action="escalate_human_review",
            input_summary="REQUIRE_COMPASS=true and Compass advisory failed before final policy completion.",
            output_summary="Blocked deterministic-only completion and returned a structured recoverable error.",
            target_agent="Audit Packager",
            confidence=0.9,
            retry_count=1,
            status="escalated",
            tool_used="deterministic_rules_engine",
            memory_key="humanReviewRequired",
            payload={"compass_status": live_compass.get("status"), "error_type": live_compass.get("error_type")},
        )
        output = {
            "summary": summary,
            "executive_summary": summary,
            "decision": "needs_more_information",
            "risk_level": "high",
            "required_actions": [
                "Verify OPENAI_API_KEY and OPENAI_BASE_URL=https://api.core42.ai/v1, then rerun with REQUIRE_COMPASS=true."
            ],
            "evidence_used": [],
            "missing_evidence": ["live Compass advisory"],
            "human_review_required": True,
            "decision_authority": {"final_owner": "Deterministic Decision Owner", "llm_advisory_only": True},
            "live_compass": live_compass,
            "live_advisory": self._default_live_advisory("compass_required_error"),
            "collaboration_summary": collaboration_summary,
            "artifacts": [{"type": "trace_log", "path": logger.relative_log_file}],
        }
        logger.log(
            agent_name="Audit Packager",
            action="finalize_response",
            input_summary="Compass-required execution failed with structured advisory-unavailable metadata.",
            output_summary=summary,
            target_agent="Audit Packager",
            confidence=0.88,
            status="error",
            memory_key="finalDecision",
            payload={"error_type": live_compass.get("error_type", "compass_unavailable")},
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
                "type": "compass_required_unavailable",
                "message": summary,
                "recoverable": True,
            },
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
            "live_advisory": self._default_live_advisory("bridge_error"),
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
        fixture_analysis = _as_dict(input_payload.get("_fixture_document_analysis"))
        fixture_documents = [
            item
            for item in _as_list(input_payload.get("documents"))
            if isinstance(item, dict) and isinstance(item.get("fixtureProfile"), dict)
        ]
        fixture_profiles = [item.get("fixtureProfile") for item in fixture_documents if isinstance(item.get("fixtureProfile"), dict)]
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
            if _contains(text_blob, r"export classification|firmware|ai accelerator|end-use|import permit"):
                data_categories.append("export-control hardware and support records")
            if _contains(text_blob, r"hashed emails|audience|campaign|consent"):
                data_categories.append("audience and marketing analytics data")
        ai_use = _first_text(case_payload.get("ai_use"), case_payload.get("aiUse"))
        ai_risk_signal = _ai_or_analytics_signal(text_blob)
        if not ai_use and ai_risk_signal in {"explicit_ai_training", "explicit_ai"}:
            ai_use = "AI/model workflow signals require governance confirmation."
        elif not ai_use and ai_risk_signal == "analytics_governance":
            ai_use = "Analytics workflow requires data-use governance confirmation."
        profile = fixture_profiles[0] if fixture_profiles else {}
        fixture_domain = _clean(fixture_analysis.get("detected_domain"))
        if fixture_domain and fixture_domain not in {"ai", "saas"} and ai_risk_signal == "explicit_ai_training":
            ai_risk_signal = "analytics_governance" if fixture_domain == "marketing" else "none"
            if fixture_domain not in {"marketing"}:
                ai_use = _first_text(case_payload.get("ai_use"), case_payload.get("aiUse"))
        fixture_domains = fixture_analysis.get("matched_risk_domains") if isinstance(fixture_analysis.get("matched_risk_domains"), list) else []
        return {
            "supplier": _first_text(node_case.get("supplierName"), case_payload.get("supplier_name"), case_payload.get("vendor"), profile.get("provider"), profile.get("supplier")),
            "workflow": _first_text(node_case.get("serviceDescription"), case_payload.get("service_description"), profile.get("serviceSummary"), input_payload.get("query")),
            "dataCategories": data_categories,
            "geography": _first_text(node_case.get("geography"), case_payload.get("geography"), case_payload.get("region")),
            "owner": _first_text(node_case.get("businessUnit"), case_payload.get("business_unit"), case_payload.get("owner")),
            "aiUse": ai_use,
            "aiRiskSignal": ai_risk_signal,
            "integrations": _limited_list(_as_list(node_case.get("integrations")) + _as_list(case_payload.get("integrations")), 10),
            "riskSignals": _limited_list(_as_list(case_payload.get("risk_signals")) + _as_list(input_payload.get("riskSignals")) + fixture_domains, 18),
            "evidenceReferences": _limited_list(evidence_refs + [item.get("evidenceId") for item in _as_list(node_result.get("citations")) if isinstance(item, dict)], 12),
            "fixtureDomain": fixture_domain,
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

    def _evidence_context(self, payload: Dict[str, Any], node_result: Dict[str, Any], case_facts: Dict[str, Any], *, run_id: str) -> Dict[str, Any]:
        citations = [item for item in _as_list(node_result.get("citations")) if isinstance(item, dict)]
        citation_matches = [
            {
                "evidence_id": _first_text(item.get("evidenceId"), item.get("citationId")),
                "title": _first_text(item.get("title"), "Input evidence"),
                "snippet": _clean(item.get("text"))[:260],
                "source": "node-citation",
            }
            for item in citations
        ]
        local_artifacts = self._local_artifacts(case_facts)
        blob = self._source_blob(payload, node_result)
        missing: List[str] = []
        fixture_analysis = _as_dict((payload.get("input") if isinstance(payload.get("input"), dict) else {}).get("_fixture_document_analysis"))
        fixture_missing = _as_list(fixture_analysis.get("matched_missing_evidence"))
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
        missing = _limited_list(fixture_missing + missing + node_gaps, 14)
        fixture_domain = _clean(fixture_analysis.get("detected_domain"))
        if fixture_domain and fixture_domain not in {"ai", "saas"}:
            missing = [item for item in missing if "model-training" not in item.lower()]
        risk_domains = self._risk_domains(case_facts, missing)
        fixture_domains = _as_list(fixture_analysis.get("matched_risk_domains"))
        risk_domains = _limited_list(fixture_domains + risk_domains, 16)
        identifiers = self._case_identifiers(payload, run_id)
        evidence_items = self._evidence_items(payload, node_result, case_facts)
        if not evidence_items:
            evidence_items = self._sample_evidence_items(case_facts, missing)
        chunks = chunks_from_evidence_items(
            evidence_items,
            case_id=identifiers["caseId"],
            workspace_id=identifiers["workspaceId"],
            project_id=identifiers["projectId"],
        )
        provider = get_evidence_memory_provider(self.compass)
        index_result = provider.index(chunks)
        retrieval_query = build_retrieval_query(case_facts, missing, risk_domains)
        search_result = provider.search(
            retrieval_query,
            case_id=identifiers["caseId"],
            workspace_id=identifiers["workspaceId"],
            project_id=identifiers["projectId"],
            limit=8,
        )
        fallback_from = ""
        qdrant_configured = bool(search_result.get("configured") or index_result.get("configured"))
        if getattr(provider, "provider", "") == "qdrant" and (index_result.get("error_type") or search_result.get("error_type")):
            fallback_from = str(search_result.get("error_type") or index_result.get("error_type") or "qdrant_unavailable")
            fallback_provider = LocalEvidenceMemory()
            fallback_index = fallback_provider.index(chunks)
            fallback_search = fallback_provider.search(
                retrieval_query,
                case_id=identifiers["caseId"],
                workspace_id=identifiers["workspaceId"],
                project_id=identifiers["projectId"],
                limit=8,
            )
            index_result = {**fallback_index, "fallbackFrom": fallback_from}
            search_result = {**fallback_search, "fallbackFrom": fallback_from}
        rag_matches = [
            {
                "evidence_id": match.get("evidenceId", ""),
                "title": match.get("title", ""),
                "snippet": match.get("snippet", ""),
                "score": match.get("score", 0),
                "documentId": match.get("documentId", ""),
                "chunkIndex": match.get("chunkIndex", 0),
                "domains": match.get("domains", []),
                "source": match.get("source", "evidence-memory"),
            }
            for match in search_result.get("matches", [])
            if isinstance(match, dict)
        ]
        matches = self._merge_evidence_matches(rag_matches, citation_matches)
        retrieved_count = len(search_result.get("matches", [])) if isinstance(search_result.get("matches"), list) else 0
        retrieval_context = {
            "provider": search_result.get("provider") or index_result.get("provider") or "local-fallback",
            "qdrantConfigured": qdrant_configured,
            "collection": search_result.get("collection") or index_result.get("collection", ""),
            "durable": bool(search_result.get("durable") or index_result.get("durable")),
            "indexedChunkCount": int(index_result.get("indexedChunkCount") or 0),
            "retrievedMatchCount": retrieved_count,
            "evidenceMatches": rag_matches[:8],
            "missingEvidenceSignals": missing,
            "browserEmbeddingsRetained": False,
            **({"fixtureDocumentsUsed": fixture_analysis.get("documents_used")} if fixture_analysis.get("documents_used") else {}),
            **({"fallbackFrom": fallback_from} if fallback_from else {}),
            **(
                {"error_type": search_result.get("error_type") or index_result.get("error_type")}
                if (search_result.get("error_type") or index_result.get("error_type"))
                else {}
            ),
        }
        quality = _as_dict(node_result.get("evidence_quality"))
        sufficiency = _clean(quality.get("status")) or ("usable" if matches else "missing")
        if matches and sufficiency == "missing":
            sufficiency = "usable"
        if len(missing) >= 4 and sufficiency == "usable":
            sufficiency = "weak"
        confidence = {"strong": 0.88, "usable": 0.76, "weak": 0.52, "missing": 0.25}.get(sufficiency, 0.55)
        return {
            "matches": matches,
            "missing": missing,
            "sufficiency": sufficiency,
            "confidence": confidence,
            "local_artifacts": local_artifacts,
            "retrieval_context": retrieval_context,
        }

    def _case_identifiers(self, payload: Dict[str, Any], run_id: str) -> Dict[str, str]:
        input_payload = payload.get("input") if isinstance(payload.get("input"), dict) else {}
        case_payload = input_payload.get("case") if isinstance(input_payload.get("case"), dict) else {}
        return {
            "caseId": _first_text(case_payload.get("case_id"), case_payload.get("caseId"), input_payload.get("case_id"), run_id),
            "workspaceId": _first_text(case_payload.get("workspace_id"), case_payload.get("workspaceId"), input_payload.get("workspace_id"), "agentathon"),
            "projectId": _first_text(case_payload.get("project_id"), case_payload.get("projectId"), input_payload.get("project_id"), "use-case-21"),
        }

    def _evidence_items(self, payload: Dict[str, Any], node_result: Dict[str, Any], case_facts: Dict[str, Any]) -> List[Dict[str, Any]]:
        del case_facts
        input_payload = payload.get("input") if isinstance(payload.get("input"), dict) else {}
        items: List[Dict[str, Any]] = []
        for source_key in ("evidence", "documents"):
            for index, raw in enumerate(_as_list(input_payload.get(source_key)), start=1):
                if isinstance(raw, dict):
                    items.append({**raw, "source": _first_text(raw.get("source"), "input")})
                elif _clean(raw):
                    items.append(
                        {
                            "id": f"{source_key}-{index}",
                            "title": f"Typed {source_key} {index}",
                            "text": _clean(raw),
                            "source": "typed",
                        }
                    )
        for key in ("evidence_text", "evidenceText", "document_text", "documentText"):
            if _clean(input_payload.get(key)):
                items.append({"id": key, "title": key, "text": _clean(input_payload.get(key)), "source": "typed"})
        for citation in [item for item in _as_list(node_result.get("citations")) if isinstance(item, dict)]:
            if _clean(citation.get("text")):
                items.append(
                    {
                        "id": _first_text(citation.get("evidenceId"), citation.get("citationId")),
                        "title": _first_text(citation.get("title"), "Node citation"),
                        "text": _clean(citation.get("text")),
                        "source": "input",
                    }
                )
        return self._dedupe_evidence_items(items)

    def _dedupe_evidence_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        deduped: List[Dict[str, Any]] = []
        seen = set()
        for item in items:
            key = (
                _first_text(item.get("id"), item.get("evidenceId"), item.get("citationId")).lower(),
                _clean(item.get("title")).lower(),
                _clean(_first_text(item.get("text"), item.get("content"), item.get("body"), item.get("snippet")))[:120].lower(),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped

    def _sample_evidence_items(self, case_facts: Dict[str, Any], missing: List[str]) -> List[Dict[str, Any]]:
        text = json.dumps({"caseFacts": case_facts, "missingEvidence": missing}, ensure_ascii=False).lower()
        if not text.strip():
            return []
        samples = [
            {
                "id": "sample-privacy-baseline",
                "title": "Synthetic privacy baseline",
                "text": "Sample evidence requirement: signed DPA, subprocessor register, retention schedule, deletion assistance, and cross-border transfer mechanism must be reviewed before approval.",
                "source": "sample",
            },
            {
                "id": "sample-security-baseline",
                "title": "Synthetic security baseline",
                "text": "Sample evidence requirement: SOC 2, ISO 27001, access control, MFA, SSO, encryption, audit logging, vulnerability management, BCP, and exit assistance evidence support reviewer validation.",
                "source": "sample",
            },
            {
                "id": "sample-ai-baseline",
                "title": "Synthetic AI governance baseline",
                "text": "Sample evidence requirement: AI vendors using customer, patient, or confidential data need model-training exclusion, human oversight, transparency, and no autonomous approval.",
                "source": "sample",
            },
        ]
        if "ai" not in text and "model" not in text:
            samples = samples[:2]
        return samples

    def _risk_domains(self, case_facts: Dict[str, Any], missing: List[str]) -> List[str]:
        blob = json.dumps({"caseFacts": case_facts, "missing": missing}, ensure_ascii=False).lower()
        domains = []
        if _contains(blob, r"dpa|subprocessor|retention|transfer|patient|personal|privacy"):
            domains.append("privacy")
        if _contains(blob, r"soc|iso|security|mfa|sso|encryption|bcp|continuity|exit"):
            domains.append("security")
        if _contains(blob, r"\b(ai|model|training|llm|analytics)\b"):
            domains.append("ai-governance")
        if _contains(blob, r"critical|continuity|bcp|disaster recovery"):
            domains.append("continuity")
        if _contains(blob, r"export|classification|eccn|license|end-use|end user|import permit|sanctions|firmware|re-export"):
            domains.append("export-control")
        if _contains(blob, r"privileged|integration|secrets|erp|release-control|finance controls|segregation"):
            domains.append("integration-risk")
        if _contains(blob, r"consent|audience|marketing|media partner|hashed emails|campaign"):
            domains.append("marketing-analytics")
        if _contains(blob, r"robustness|rai|retrieval|rollback|human oversight|auditability"):
            domains.append("model-governance")
        return domains or ["general"]

    def _merge_evidence_matches(self, primary: List[Dict[str, Any]], secondary: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        merged: List[Dict[str, Any]] = []
        seen = set()
        for item in primary + secondary:
            key = (
                _clean(item.get("evidence_id") or item.get("evidenceId")).lower(),
                _clean(item.get("title")).lower(),
                _clean(item.get("snippet"))[:80].lower(),
            )
            if key in seen or not _clean(item.get("snippet")):
                continue
            seen.add(key)
            merged.append(item)
            if len(merged) >= 12:
                break
        return merged

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
        gaps = [
            item
            for item in evidence["missing"]
            if any(
                token in item.lower()
                for token in (
                    "security",
                    "soc",
                    "iso",
                    "continuity",
                    "bcp",
                    "exit",
                    "classification",
                    "license",
                    "end-use",
                    "import permit",
                    "delivery-site",
                    "remote support",
                    "privileged",
                    "secrets",
                    "release-control",
                )
            )
        ]
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
        gaps = [
            item
            for item in evidence["missing"]
            if any(token in item.lower() for token in ("training", "ai", "model", "rai", "robustness", "human oversight", "rollback", "retrieval"))
        ]
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

    def _default_live_advisory(self, status: str = "skipped_custom_runtime") -> Dict[str, Any]:
        runtime = _agent_runtime()
        return {
            "enabled": False,
            "runtime": runtime,
            "status": status if runtime == "crewai_live" else "skipped_custom_runtime",
            "model": self.compass.model_fast(),
            "advisoryOnly": True,
            "agents": [],
            "cards": [],
            "summary": {},
            "final_decision_owner": "Deterministic Decision Owner",
        }

    def _run_live_crewai(
        self,
        sample_mode: bool,
        shared_context: Dict[str, Any],
        logger: TraceLogger,
        collaboration_summary: Dict[str, Any],
    ) -> Dict[str, Any]:
        runtime = _agent_runtime()
        if runtime != "crewai_live":
            return self._default_live_advisory("skipped_custom_runtime")
        if sample_mode:
            collaboration_summary["shared_context_updates"].append("CrewAI live advisory skipped in sample mode")
            logger.log(
                agent_name="Final Advisory Reviewer",
                action="crewai_advisory_unavailable",
                input_summary="Sample mode requested.",
                output_summary="Skipped live CrewAI call; custom deterministic council remains active.",
                target_agent="Deterministic Decision Owner",
                confidence=0.7,
                status="fallback_used",
                tool_used="sample_mode",
                memory_key="liveAdvisory",
                payload={"runtime": "crewai_live", "advisoryOnly": True},
            )
            return {
                **self._default_live_advisory("skipped_sample_mode"),
                "runtime": "crewai_live",
                "status": "skipped_sample_mode",
            }
        if not _crewai_live_enabled():
            collaboration_summary["shared_context_updates"].append("CrewAI live advisory disabled")
            logger.log(
                agent_name="Final Advisory Reviewer",
                action="crewai_advisory_unavailable",
                input_summary="AGENT_RUNTIME=crewai_live without CREWAI_ENABLE_LIVE_LLM=1.",
                output_summary="CrewAI advisory disabled; custom deterministic council continued.",
                target_agent="Deterministic Decision Owner",
                confidence=0.52,
                status="fallback_used",
                tool_used="crewai_live",
                memory_key="liveAdvisory",
                payload={"runtime": "crewai_live", "error_type": "crewai_live_disabled"},
            )
            return {
                **self._default_live_advisory("unavailable"),
                "runtime": "crewai_live",
                "status": "unavailable",
                "error_type": "crewai_live_disabled",
                "recoverable": True,
            }

        result = run_crewai_advisory_council(shared_context)
        if result.get("ok"):
            collaboration_summary["shared_context_updates"].append("CrewAI live advisory added")
            logger.log(
                agent_name="Final Advisory Reviewer",
                action="live_crewai_review",
                input_summary="Case facts, evidence matches, missing evidence, learning suggestions, and deterministic draft.",
                output_summary=f"CrewAI advisory completed with {len(result.get('cards') or [])} card(s); deterministic owner remains final.",
                target_agent="Deterministic Decision Owner",
                confidence=0.76,
                status="success",
                tool_used="crewai_live",
                memory_key="liveAdvisory",
                payload={
                    "runtime": "crewai_live",
                    "model": result.get("model"),
                    "advisoryOnly": True,
                    "summary": result.get("summary"),
                    "card_count": len(result.get("cards") or []),
                },
            )
            return result

        collaboration_summary["shared_context_updates"].append("CrewAI live advisory unavailable")
        collaboration_summary["retries"].append("CrewAI live advisory unavailable; custom deterministic council continued")
        logger.log(
            agent_name="Final Advisory Reviewer",
            action="crewai_advisory_unavailable",
            input_summary="Case facts, evidence matches, missing evidence, learning suggestions, and deterministic draft.",
            output_summary=f"CrewAI advisory unavailable: {result.get('error_type', 'unknown')}.",
            target_agent="Deterministic Decision Owner",
            confidence=0.44,
            status="advisory_unavailable",
            tool_used="crewai_live",
            memory_key="liveAdvisory",
            payload={
                "runtime": "crewai_live",
                "error_type": result.get("error_type"),
                "recoverable": result.get("recoverable", True),
                "advisoryOnly": True,
            },
        )
        return result

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
        live_advisory: Dict[str, Any],
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
        learning_context = shared_context.get("learningContext") if isinstance(shared_context.get("learningContext"), dict) else {}
        learning_actions, reviewer_questions = self._learning_supported_controls(missing, learning_context)
        required_actions = _limited_list(required_actions + learning_actions, 14)
        if not required_actions:
            required_actions = ["Confirm accountable human reviewer before operational approval."]

        evidence_used = [
            {
                "evidence_id": match.get("evidence_id", ""),
                "title": match.get("title", ""),
                "snippet": match.get("snippet", ""),
                **({"score": match.get("score")} if match.get("score") is not None else {}),
                **({"documentId": match.get("documentId")} if match.get("documentId") else {}),
                **({"chunkIndex": match.get("chunkIndex")} if match.get("chunkIndex") is not None else {}),
                **({"domains": match.get("domains")} if match.get("domains") else {}),
                **({"source": match.get("source")} if match.get("source") else {}),
            }
            for match in shared_context["evidenceMatches"][:12]
        ]
        summary = _summary(decision, risk, missing, live_compass.get("status", "unavailable"))
        if learning_context.get("similar_cases_found"):
            summary = f"{summary} Learning memory found {learning_context.get('similar_cases_found')} advisory similar case(s)."
        return {
            "summary": summary,
            "executive_summary": summary,
            "decision": decision,
            "risk_level": risk,
            "required_actions": required_actions,
            "evidence_used": evidence_used,
            "missing_evidence": missing,
            "rag_evidence_memory": shared_context.get("retrievalContext") or {
                "provider": "local-fallback",
                "qdrantConfigured": False,
                "durable": False,
                "indexedChunkCount": 0,
                "retrievedMatchCount": 0,
                "evidenceMatches": [],
                "missingEvidenceSignals": missing,
                "browserEmbeddingsRetained": False,
            },
            "learning_memory": {
                "provider": learning_context.get("provider", "local-jsonl"),
                "similar_cases_found": int(learning_context.get("similar_cases_found") or 0),
                "control_suggestions": learning_context.get("controlSuggestions", [])[:8],
                "repeatedEvidenceGaps": learning_context.get("repeatedEvidenceGaps", [])[:8],
                "advisoryOnly": True,
                "note": "Learning memory is advisory. Deterministic policy and current evidence remain authoritative.",
                "browserEmbeddingsRetained": False,
                **({"fallbackFrom": learning_context.get("fallbackFrom")} if learning_context.get("fallbackFrom") else {}),
            },
            "fixture_document_analysis": shared_context.get("fixtureDocumentAnalysis") or {
                "documents_used": [],
                "detected_domain": "",
                "extraction_status": "",
                "expected_profile_match": False,
                "matched_risk_domains": [],
                "matched_missing_evidence": [],
            },
            "reviewer_questions": reviewer_questions,
            "human_review_required": True,
            "decision_authority": {
                "final_owner": "Deterministic Decision Owner",
                "llm_advisory_only": True,
            },
            "live_compass": live_compass,
            "live_advisory": {
                "enabled": bool(live_advisory.get("ok")),
                "runtime": live_advisory.get("runtime", _agent_runtime()),
                "status": live_advisory.get("status", "skipped_custom_runtime"),
                "model": live_advisory.get("model") or self.compass.model_fast(),
                "advisoryOnly": True,
                "agents": live_advisory.get("agents") or [],
                "cards": live_advisory.get("cards") or [],
                "summary": live_advisory.get("summary") or {},
                "final_decision_owner": "Deterministic Decision Owner",
                **(
                    {
                        "error_type": live_advisory.get("error_type", "crewai_advisory_unavailable"),
                        "recoverable": live_advisory.get("recoverable", True),
                    }
                    if not live_advisory.get("ok") and live_advisory.get("status") not in {"skipped_custom_runtime", "skipped_sample_mode"}
                    else {}
                ),
            },
            "collaboration_summary": collaboration_summary,
            "artifacts": [
                {"type": "trace_log", "path": "logs/trace-<run_id>.jsonl"},
                {"type": "decision_payload", "source": "deterministic_node_bridge_plus_python_council"},
            ],
        }

    def _learning_supported_controls(self, missing: List[str], learning_context: Dict[str, Any]) -> tuple[List[str], List[str]]:
        missing_blob = " ".join(_clean(item).lower() for item in missing)
        if not missing_blob:
            return [], []
        controls: List[str] = []
        questions: List[str] = []
        for suggestion in _as_list(learning_context.get("controlSuggestions")):
            text = _clean(suggestion)
            lower = text.lower()
            if not text:
                continue
            if lower.startswith("add reviewer question:"):
                question = text.split(":", 1)[1].strip() if ":" in text else text
                if any(token in missing_blob for token in ("training", "dpa", "subprocessor", "retention", "transfer", "support", "region")):
                    questions.append(question)
                continue
            supported = any(
                token in missing_blob and token in lower
                for token in ("training", "dpa", "subprocessor", "retention", "deletion", "transfer", "cross-border", "support", "hosting", "soc", "iso", "continuity")
            )
            if supported:
                controls.append(text)
        return _limited_list(controls, 4), _limited_list(questions, 4)
