#!/usr/bin/env python3
"""Run the generated fixture PDF demo matrix through the actual /run council."""

from __future__ import annotations

import contextlib
import io
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.agentathon_orchestrator import AgentathonOrchestrator  # noqa: E402
from app.schemas import AgentathonRunRequest  # noqa: E402


MATRIX_PATH = ROOT / "test-fixtures" / "compliance-documents" / "golden_matrix.json"
OUTPUT_DIR = ROOT / "output_examples"
LOG_DIR = ROOT / "logs"

INPUT_BY_FILENAME = {
    "01_enterprise_saas_master_services_agreement.pdf": "fixture_saas_msa.json",
    "02_data_processing_addendum_and_cross_border_terms.pdf": "fixture_dpa_cross_border.json",
    "03_ai_accelerator_chip_import_export_control_agreement.pdf": "fixture_ai_accelerator_export.json",
    "04_managed_platform_integration_services_agreement.pdf": "fixture_managed_integration.json",
    "05_media_buying_and_audience_analytics_order_form.pdf": "fixture_media_analytics.json",
    "06_cloud_ai_model_services_statement_of_work.pdf": "fixture_cloud_ai_sow.json",
}

ARTIFACT_STEM_BY_FILENAME = {
    "01_enterprise_saas_master_services_agreement.pdf": "fixture_saas_msa",
    "02_data_processing_addendum_and_cross_border_terms.pdf": "fixture_dpa_cross_border",
    "03_ai_accelerator_chip_import_export_control_agreement.pdf": "fixture_ai_accelerator_export",
    "04_managed_platform_integration_services_agreement.pdf": "fixture_managed_integration",
    "05_media_buying_and_audience_analytics_order_form.pdf": "fixture_media_analytics",
    "06_cloud_ai_model_services_statement_of_work.pdf": "fixture_cloud_ai_sow",
}

RISK_ORDER = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def slug_for(filename: str) -> str:
    return Path(filename).stem.replace("_", "-").replace("01-", "").replace("02-", "")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def blob(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True).lower()


def no_raw_vectors(value: Any) -> bool:
    forbidden = {"embedding", "embeddings", "vector", "vectors", "query_vector"}
    if isinstance(value, dict):
        for key, item in value.items():
            if str(key).lower() in forbidden:
                return False
            if not no_raw_vectors(item):
                return False
    elif isinstance(value, list):
        if len(value) > 8 and all(isinstance(item, (float, int)) for item in value):
            return False
        return all(no_raw_vectors(item) for item in value)
    return True


def count_terms(text: str, terms: Iterable[str]) -> int:
    return sum(1 for term in terms if str(term).lower() in text)


def decisions_allowed(profile: Dict[str, Any]) -> List[str]:
    value = profile.get("expectedDecisionBand")
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        return [value]
    return []


def assert_fixture_response(profile: Dict[str, Any], response: Dict[str, Any]) -> List[str]:
    failures: List[str] = []
    output = response.get("output") if isinstance(response.get("output"), dict) else {}
    trace = response.get("agent_trace") if isinstance(response.get("agent_trace"), list) else []
    text = blob(output)
    trace_actions = {str(event.get("action", "")) for event in trace if isinstance(event, dict)}
    trace_agents = {str(event.get("agent_name", "")) for event in trace if isinstance(event, dict)}
    expected_domains = profile.get("expectedRiskDomains") if isinstance(profile.get("expectedRiskDomains"), list) else []
    expected_missing = profile.get("expectedMissingEvidence") if isinstance(profile.get("expectedMissingEvidence"), list) else []
    expected_actions = profile.get("expectedRequiredActionKeywords") if isinstance(profile.get("expectedRequiredActionKeywords"), list) else []

    if response.get("status") != "success":
        failures.append(f"status was {response.get('status')}")
    if output.get("human_review_required") is not profile.get("humanReviewRequiredExpected"):
        failures.append("human_review_required did not match expected boundary")
    allowed = decisions_allowed(profile)
    if allowed and output.get("decision") not in allowed:
        failures.append(f"decision {output.get('decision')} not in {allowed}")
    if RISK_ORDER.get(str(output.get("risk_level")), 0) < RISK_ORDER.get(str(profile.get("expectedMinimumRisk")), 0):
        failures.append(f"risk {output.get('risk_level')} below expected {profile.get('expectedMinimumRisk')}")
    min_domains = min(3, max(1, len(expected_domains)))
    if count_terms(text, expected_domains) < min_domains:
        failures.append(f"fewer than {min_domains} expected risk domains found")
    min_missing = min(3, max(1, len(expected_missing)))
    if count_terms(text, expected_missing) < min_missing:
        failures.append(f"fewer than {min_missing} expected missing evidence terms found")
    min_actions = min(2, max(1, len(expected_actions)))
    if count_terms(text, expected_actions) < min_actions:
        failures.append(f"fewer than {min_actions} required action keywords found")
    if "delegate_evidence_search" not in trace_actions:
        failures.append("trace missing delegation")
    if "ingest_fixture_document" not in trace_actions or "retrieve_evidence" not in trace_actions:
        failures.append("trace missing fixture ingest/retrieval")
    if not any(action.startswith("critique_") or action == "validate_evidence" for action in trace_actions):
        failures.append("trace missing specialist critique/validation")
    if "Deterministic Decision Owner" not in trace_agents or "apply_deterministic_policy" not in trace_actions:
        failures.append("trace missing deterministic owner")
    if "Audit Packager" not in trace_agents or "package_audit_trace" not in trace_actions:
        failures.append("trace missing audit packager")
    if not no_raw_vectors(response):
        failures.append("raw embedding/vector leaked")
    fixture_analysis = output.get("fixture_document_analysis") if isinstance(output.get("fixture_document_analysis"), dict) else {}
    if not fixture_analysis.get("documents_used"):
        failures.append("output missing fixture_document_analysis.documents_used")
    return failures


def run_fixture(profile: Dict[str, Any], orchestrator: AgentathonOrchestrator) -> Dict[str, Any]:
    input_name = INPUT_BY_FILENAME[profile["filename"]]
    payload = load_json(ROOT / "input_examples" / input_name)
    payload["run_id"] = f"fixture-{Path(profile['filename']).stem}"
    payload.setdefault("options", {})["sample_mode"] = True
    with contextlib.redirect_stdout(io.StringIO()):
        return orchestrator.run(AgentathonRunRequest(**payload))


def write_artifacts(profile: Dict[str, Any], response: Dict[str, Any]) -> None:
    stem = ARTIFACT_STEM_BY_FILENAME[profile["filename"]]
    output_path = OUTPUT_DIR / f"{stem}_output.json"
    trace_path = LOG_DIR / f"{stem}_trace.jsonl"
    original_log = ROOT / str(response.get("log_file", ""))
    if original_log.exists():
        shutil.copyfile(original_log, trace_path)
    response["log_file"] = f"logs/{trace_path.name}"
    output_path.write_text(json.dumps(response, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    os.environ.setdefault("SAMPLE_MODE", "true")
    os.environ.setdefault("P42_VECTOR_STORE_PROVIDER", "local")
    os.environ.setdefault("LOG_DIR", "./logs")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    fixtures = load_json(MATRIX_PATH).get("fixtures")
    if not isinstance(fixtures, list) or len(fixtures) != 6:
        print("FIXTURE_DEMO_MATRIX=FAIL")
        print("Expected six fixture profiles in golden_matrix.json.")
        return 1

    failures: List[str] = []
    summaries: List[str] = []
    orchestrator = AgentathonOrchestrator()
    for profile in fixtures:
        response = run_fixture(profile, orchestrator)
        fixture_failures = assert_fixture_response(profile, response)
        write_artifacts(profile, response)
        output = response.get("output", {})
        summaries.append(
            f"{profile['filename']}: decision={output.get('decision')} risk={output.get('risk_level')} "
            f"actions={len(output.get('required_actions') or [])} trace_events={len(response.get('agent_trace') or [])}"
        )
        failures.extend([f"{profile['filename']}: {failure}" for failure in fixture_failures])

    for line in summaries:
        print(line)
    if failures:
        print("FIXTURE_DEMO_MATRIX=FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("FIXTURE_DEMO_MATRIX=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
