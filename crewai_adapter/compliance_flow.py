"""CrewAI Flow adapter for the Compliance Intelligence Agent.

The default dry-run mode intentionally avoids importing CrewAI so API demos,
CI, and evidence capture remain stable without optional Python dependencies.
When CrewAI is installed, --live-flow validates the same state machine through
CrewAI's Flow decorators.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from compliance_crew import CONFIG_DIR, DEFAULT_INPUT, ROOT, dry_run_manifest, load_case, load_yaml


FLOW_STAGES = [
    {
        "id": "intake",
        "method": "load_case",
        "task": "triage_case",
        "agent": "compliance_orchestrator",
        "expectedTraceEvent": "case_loaded",
        "kind": "start",
    },
    {
        "id": "obligations",
        "method": "map_obligations",
        "task": "map_obligations",
        "agent": "regulatory_obligation_mapper",
        "expectedTraceEvent": "domains_scanned",
        "kind": "listen",
    },
    {
        "id": "evidence",
        "method": "examine_evidence",
        "task": "examine_evidence",
        "agent": "evidence_examiner",
        "expectedTraceEvent": "evidence_mapped",
        "kind": "listen",
    },
    {
        "id": "controls",
        "method": "recommend_controls",
        "task": "recommend_controls",
        "agent": "risk_control_analyst",
        "expectedTraceEvent": "controls_recommended",
        "kind": "listen",
    },
    {
        "id": "rai_review",
        "method": "review_responsible_ai",
        "task": "review_responsible_ai",
        "agent": "responsible_ai_reviewer",
        "expectedTraceEvent": "output_review_completed",
        "kind": "listen",
    },
    {
        "id": "audit_pack",
        "method": "package_audit_brief",
        "task": "package_audit_brief",
        "agent": "audit_packager",
        "expectedTraceEvent": "output_review_completed",
        "kind": "listen",
    },
]


def _relative(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def load_case_input(path: Path | None) -> tuple[dict[str, Any], str]:
    if path is None:
        raw = sys.stdin.read()
        return json.loads(raw or "{}"), "stdin"
    return load_case(path), _relative(path)


def flow_manifest(case: dict[str, Any], input_label: str, *, live_crewai: bool) -> dict[str, Any]:
    agents = load_yaml(CONFIG_DIR / "agents.yaml")
    tasks = load_yaml(CONFIG_DIR / "tasks.yaml")
    crew = dry_run_manifest(DEFAULT_INPUT)
    return {
        "mode": "crewai_flow_live" if live_crewai else "crewai_flow_dry_run",
        "framework": "CrewAI Flow",
        "primary_runtime": True,
        "live_crewai": live_crewai,
        "input": input_label,
        "caseId": case.get("caseId") or "",
        "state_schema": {
            "case": "original normalized compliance case",
            "workPlan": "triage and domain scope",
            "obligations": "mapped obligations and applicability",
            "evidenceReview": "supported and missing evidence",
            "controlPlan": "controls, blockers, owners, remediation",
            "responsibleAiReview": "approval boundary and safety checks",
            "auditBrief": "final decision package",
        },
        "flow": {
            "class": "ComplianceIntelligenceFlow",
            "entrypoint": "kickoff",
            "control_model": "start/listen state machine",
            "human_approval_required": True,
            "deterministic_fallback": True,
            "stages": [
                {
                    **stage,
                    "role": agents.get(stage["agent"], {}).get("role", stage["agent"]),
                    "expected_output": tasks.get(stage["task"], {}).get("expected_output", ""),
                }
                for stage in FLOW_STAGES
            ],
        },
        "crew": crew,
        "secrets_required_for_dry_run": False,
    }


def run_live_flow(case: dict[str, Any], input_label: str) -> dict[str, Any]:
    try:
        from crewai.flow.flow import Flow, listen, start  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "CrewAI Flow is not installed. Run `python -m pip install -r requirements-crewai.txt` first."
        ) from exc

    class ComplianceIntelligenceFlow(Flow):  # type: ignore[misc]
        @start()
        def load_case(self) -> dict[str, Any]:
            self.state["case"] = case
            self.state["stage"] = "intake"
            return {"stage": "intake", "caseId": case.get("caseId", "")}

        @listen(load_case)
        def map_obligations(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "obligations"
            return {"stage": "obligations", "agent": "regulatory_obligation_mapper"}

        @listen(map_obligations)
        def examine_evidence(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "evidence"
            return {"stage": "evidence", "agent": "evidence_examiner"}

        @listen(examine_evidence)
        def recommend_controls(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "controls"
            return {"stage": "controls", "agent": "risk_control_analyst"}

        @listen(recommend_controls)
        def review_responsible_ai(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "rai_review"
            return {"stage": "rai_review", "agent": "responsible_ai_reviewer"}

        @listen(review_responsible_ai)
        def package_audit_brief(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "audit_pack"
            return flow_manifest(case, input_label, live_crewai=True)

    flow = ComplianceIntelligenceFlow()
    result = flow.kickoff()
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Path to compliance case JSON, or '-' for stdin.")
    parser.add_argument("--dry-run", action="store_true", help="Print Flow manifest without importing CrewAI.")
    parser.add_argument("--live-flow", action="store_true", help="Execute the Flow state machine with CrewAI installed.")
    args = parser.parse_args()

    input_path = None if args.input == "-" else Path(args.input).expanduser().resolve()
    case, input_label = load_case_input(input_path)

    if args.live_flow:
        payload = run_live_flow(case, input_label)
    else:
        payload = flow_manifest(case, input_label, live_crewai=False)

    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
