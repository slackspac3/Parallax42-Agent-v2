#!/usr/bin/env python3
"""Focused checks for the Agentathon FastAPI execution layer.

These checks instantiate the orchestrator directly so they do not require a
listening API server or a live Compass key. Live Compass behavior is covered by
mock clients here and by the optional preflight probe when credentials exist.
"""

from __future__ import annotations

import contextlib
import copy
import io
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterator, List


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.agentathon_orchestrator import AgentathonOrchestrator  # noqa: E402
from app.schemas import AgentathonRunRequest  # noqa: E402


class FakeCompassSuccess:
    def __init__(self) -> None:
        self.calls = 0

    def configured(self) -> bool:
        return True

    def model_fast(self) -> str:
        return "mock-fast"

    def model_reasoning(self) -> str:
        return "mock-reasoning"

    def compass_chat_json(self, messages: List[Dict[str, str]], model: str, schema_hint: str, max_tokens: int = 900) -> Dict[str, Any]:
        self.calls += 1
        assert "compliance council draft" in messages[0]["content"].lower()
        return {
            "ok": True,
            "status": "available",
            "model": model,
            "attempts": 1,
            "advisory": {
                "specialist": "Compass Advisory Critic",
                "advisoryOnly": True,
                "assessment": "approve",
                "strongestEvidence": ["Mocked advisory saw security controls."],
                "unresolvedRisks": [],
                "reviewerQuestions": ["Confirm deterministic owner remains final."],
                "recommendedActions": ["Keep human review boundary."],
                "confidence": "high",
                "rationale": "Mocked success intentionally recommends approve to verify it cannot override policy.",
            },
        }


class FakeCompassFailure(FakeCompassSuccess):
    def compass_chat_json(self, messages: List[Dict[str, str]], model: str, schema_hint: str, max_tokens: int = 900) -> Dict[str, Any]:
        self.calls += 1
        return {
            "ok": False,
            "status": "unavailable",
            "model": model,
            "attempts": 1,
            "error_type": "mock_compass_failure",
            "message": "Mocked Compass outage.",
            "recoverable": True,
            "advisory": {
                "specialist": "Compass Advisory Critic",
                "advisoryOnly": True,
                "assessment": "insufficient_evidence",
                "strongestEvidence": [],
                "unresolvedRisks": [],
                "reviewerQuestions": [],
                "recommendedActions": [],
                "confidence": "low",
                "rationale": "Compass unavailable in mock.",
            },
        }


@contextlib.contextmanager
def patched_env(**updates: str) -> Iterator[None]:
    prior = {key: os.environ.get(key) for key in updates}
    try:
        for key, value in updates.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        yield
    finally:
        for key, value in prior.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def load_example(name: str, *, run_id: str, sample_mode: bool) -> Dict[str, Any]:
    payload = json.loads((ROOT / "input_examples" / name).read_text(encoding="utf-8"))
    payload = copy.deepcopy(payload)
    payload["run_id"] = run_id
    payload.setdefault("options", {})["sample_mode"] = sample_mode
    return payload


def run_payload(payload: Dict[str, Any], compass: Any | None = None) -> Dict[str, Any]:
    with contextlib.redirect_stdout(io.StringIO()):
        return AgentathonOrchestrator(compass_client=compass).run(AgentathonRunRequest(**payload))


def event_actions(response: Dict[str, Any]) -> List[str]:
    return [str(event.get("action", "")) for event in response.get("agent_trace", [])]


def assert_base_response(response: Dict[str, Any]) -> None:
    assert response["status"] == "success", response
    assert response["trace_id"], "missing trace_id"
    assert response["log_file"], "missing log_file"
    assert isinstance(response.get("agents"), list) and response["agents"], "missing agents"
    assert isinstance(response.get("agent_trace"), list) and response["agent_trace"], "missing trace"
    assert isinstance(response.get("output"), dict), "missing output"
    assert response["result"] == response["output"], "backward compatibility result alias must match output"
    assert len(response["agent_trace"]) >= 7, "expected at least 7 trace events"
    assert len({event["agent_name"] for event in response["agent_trace"]}) >= 5, "expected at least 5 distinct agents"
    assert sum(1 for event in response["agent_trace"] if event.get("target_agent")) >= 3, "expected at least 3 delegated/targeted events"
    assert any(event["agent_name"] == "Deterministic Decision Owner" for event in response["agent_trace"]), "missing deterministic owner trace"
    assert response["output"]["decision_authority"]["final_owner"] == "Deterministic Decision Owner"
    assert response["output"]["decision_authority"]["llm_advisory_only"] is True


def check_sample_runs() -> List[Dict[str, Any]]:
    responses = []
    with patched_env(SAMPLE_MODE="false", LOG_DIR="./logs", OPENAI_API_KEY=None):
        for index, name in enumerate(("example_1.json", "example_2.json", "example_3.json"), start=1):
            response = run_payload(load_example(name, run_id=f"unit-sample-{index}", sample_mode=True))
            assert_base_response(response)
            assert response["output"]["live_compass"]["status"] == "skipped_sample_mode"
            responses.append(response)

    weak_actions = event_actions(responses[2])
    assert "retry_evidence_search" in weak_actions or any(event.get("status") == "fallback_used" for event in responses[2]["agent_trace"])
    assert any(action.startswith("critique_") for action in weak_actions) or "escalate_human_review" in weak_actions
    assert "apply_deterministic_policy" in event_actions(responses[0])

    signatures = {
        (
            response["output"]["decision"],
            response["output"]["risk_level"],
            tuple(response["output"]["required_actions"]),
        )
        for response in responses
    }
    assert len(signatures) >= 2, "examples should produce materially different outputs"
    assert responses[0]["output"]["required_actions"] != responses[2]["output"]["required_actions"], "example 1 and 3 actions should differ"
    return responses


def check_no_static_output_loading() -> None:
    payload = load_example("example_1.json", run_id="unit-static-output-check", sample_mode=True)
    payload["input"]["query"] = "Minimal malformed synthetic review with no evidence."
    payload["input"]["case"] = {"service_description": "Minimal review request."}
    payload["input"]["evidence"] = []
    with patched_env(SAMPLE_MODE="false", LOG_DIR="./logs", OPENAI_API_KEY=None):
        response = run_payload(payload)
    saved = json.loads((ROOT / "output_examples" / "example_1_output.json").read_text(encoding="utf-8"))
    assert response["run_id"] == "unit-static-output-check"
    assert response["log_file"] == "logs/trace-unit-static-output-check.jsonl"
    assert response["trace_id"] != saved.get("trace_id")
    assert response.get("output") != saved.get("output")


def check_compass_modes() -> None:
    with patched_env(SAMPLE_MODE="false", LOG_DIR="./logs", OPENAI_API_KEY=None):
        success = FakeCompassSuccess()
        response = run_payload(load_example("example_2.json", run_id="unit-compass-success", sample_mode=False), success)
        assert_base_response(response)
        assert success.calls == 1
        assert response["output"]["live_compass"]["status"] == "available"
        assert "live_compass_review" in event_actions(response)
        assert response["output"]["decision"] != "approve", "LLM advisory must not override deterministic rejection"

        failure = FakeCompassFailure()
        response = run_payload(load_example("example_1.json", run_id="unit-compass-failure", sample_mode=False), failure)
        assert_base_response(response)
        assert failure.calls == 1
        assert response["output"]["live_compass"]["status"] == "unavailable"
        assert "compass_advisory_unavailable" in event_actions(response)

        skipped = FakeCompassSuccess()
        response = run_payload(load_example("example_1.json", run_id="unit-compass-skip", sample_mode=True), skipped)
        assert_base_response(response)
        assert skipped.calls == 0
        assert response["output"]["live_compass"]["status"] == "skipped_sample_mode"


def check_trace_collaboration(response: Dict[str, Any]) -> None:
    actions = set(event_actions(response))
    memory_keys = {str(event.get("memory_key", "")) for event in response["agent_trace"]}
    assert "delegate_evidence_search" in actions
    assert "retrieve_precedent" in actions
    assert "apply_deterministic_policy" in actions
    assert any(action.startswith("critique_") for action in actions) or "validate_evidence" in actions
    assert {"caseFacts", "evidenceMatches", "specialistFindings", "decisionDraft", "finalDecision"} & memory_keys
    summary = response["output"]["collaboration_summary"]
    assert summary["delegated_tasks"], "missing delegated task summary"
    assert summary["shared_context_updates"], "missing shared context updates"
    assert summary["final_decision_owner"] == "Deterministic Decision Owner"


def main() -> int:
    responses = check_sample_runs()
    check_trace_collaboration(responses[0])
    check_no_static_output_loading()
    check_compass_modes()
    print("Agentathon wrapper checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
