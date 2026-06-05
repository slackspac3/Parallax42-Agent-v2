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
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Iterator, List
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.agentathon_orchestrator import AgentathonOrchestrator  # noqa: E402
from app.compass_client import CompassClient, normalize_openai_base_url  # noqa: E402
from app.evidence_memory import (  # noqa: E402
    EvidenceChunk,
    LocalEvidenceMemory,
    QdrantEvidenceMemory,
    chunk_text,
    chunks_from_evidence_items,
    get_evidence_memory_provider,
)
from app.fixture_documents import (  # noqa: E402
    FixtureDocumentError,
    extractFixtureDocument,
    getFixtureExpectedProfile,
    listSupportedFixtureDocuments,
    safeResolveFixturePath,
)
from app.learning_memory import LocalLearningMemory, load_seed_artifacts, summarize_learning_signals  # noqa: E402
from app.schemas import AgentathonRunRequest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class FakeCompassSuccess:
    def __init__(self) -> None:
        self.calls = 0

    def configured(self) -> bool:
        return True

    def model_fast(self) -> str:
        return "mock-fast"

    def model_reasoning(self) -> str:
        return "mock-reasoning"

    def embed_texts(self, texts: List[str], model: str | None = None) -> Dict[str, Any]:
        del model
        return {
            "ok": True,
            "status": "available",
            "model": "mock-embedding",
            "embeddings": [[0.1, 0.2, 0.3] for _ in texts],
            "count": len(texts),
        }

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


class FakeCompassHtml405(FakeCompassFailure):
    def compass_chat_json(self, messages: List[Dict[str, str]], model: str, schema_hint: str, max_tokens: int = 900) -> Dict[str, Any]:
        result = super().compass_chat_json(messages, model, schema_hint, max_tokens)
        result["error_type"] = "HTTP 405"
        result["message"] = "Received HTML or 405 from mocked wrong endpoint."
        return result


class FakeHttpxResponse:
    def __init__(self, status_code: int, text: str, headers: Dict[str, str] | None = None, json_payload: Any = None) -> None:
        self.status_code = status_code
        self.text = text
        self.headers = headers or {}
        self._json_payload = json_payload

    def json(self) -> Any:
        if self._json_payload is not None:
            return self._json_payload
        return json.loads(self.text)


class FakeMatchValue:
    def __init__(self, value: Any) -> None:
        self.value = value


class FakeFieldCondition:
    def __init__(self, key: str, match: FakeMatchValue) -> None:
        self.key = key
        self.match = match


class FakeFilter:
    def __init__(self, must: List[FakeFieldCondition]) -> None:
        self.must = must


class FakePointStruct:
    def __init__(self, id: str, vector: List[float], payload: Dict[str, Any]) -> None:
        self.id = id
        self.vector = vector
        self.payload = payload


class FakeVectorParams:
    def __init__(self, size: int, distance: str) -> None:
        self.size = size
        self.distance = distance


class FakeDistance:
    COSINE = "Cosine"


class FakeQdrantHit:
    def __init__(self, payload: Dict[str, Any], score: float = 0.91) -> None:
        self.payload = payload
        self.score = score


class FakeQdrantClient:
    def __init__(self) -> None:
        self.points: List[FakePointStruct] = []
        self.created_collection = ""
        self.last_filter: Any = None

    def collection_exists(self, collection: str) -> bool:
        return bool(self.created_collection == collection)

    def create_collection(self, collection_name: str, vectors_config: Any) -> None:
        assert vectors_config.size == 3
        self.created_collection = collection_name

    def upsert(self, collection_name: str, points: List[FakePointStruct]) -> None:
        assert collection_name
        for point in points:
            assert "embedding" not in point.payload
            assert "vector" not in point.payload
            assert point.payload["type"] == "evidence_chunk"
        self.points.extend(points)

    def search(self, collection_name: str, query_vector: List[float], query_filter: Any, limit: int, with_payload: bool) -> List[FakeQdrantHit]:
        del collection_name, query_vector, with_payload
        self.last_filter = query_filter
        filters = {condition.key: condition.match.value for condition in query_filter.must}
        assert filters["type"] == "evidence_chunk"
        assert filters["caseId"] == "case-123"
        return [FakeQdrantHit(point.payload) for point in self.points if point.payload["caseId"] == "case-123"][:limit]


class FakeQdrantMemory(QdrantEvidenceMemory):
    def _qdrant_imports(self) -> Dict[str, Any]:
        return {
            "Distance": FakeDistance,
            "FieldCondition": FakeFieldCondition,
            "Filter": FakeFilter,
            "MatchValue": FakeMatchValue,
            "PointStruct": FakePointStruct,
            "VectorParams": FakeVectorParams,
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


def assert_no_raw_vectors(value: Any) -> None:
    forbidden_keys = {"embedding", "embeddings", "vector", "vectors", "query_vector"}
    if isinstance(value, dict):
        for key, item in value.items():
            assert str(key).lower() not in forbidden_keys, f"raw vector key leaked: {key}"
            assert_no_raw_vectors(item)
    elif isinstance(value, list):
        if len(value) > 8 and all(isinstance(item, (float, int)) for item in value):
            raise AssertionError("raw numeric vector leaked")
        for item in value:
            assert_no_raw_vectors(item)


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
    rag = response["output"].get("rag_evidence_memory")
    assert isinstance(rag, dict), "missing rag_evidence_memory"
    assert rag.get("browserEmbeddingsRetained") is False, "browser must not retain embeddings"
    learning = response["output"].get("learning_memory")
    assert isinstance(learning, dict), "missing learning_memory"
    assert learning.get("advisoryOnly") is True, "learning memory must be advisory only"
    assert learning.get("browserEmbeddingsRetained") is False, "learning output must not retain embeddings"
    live_advisory = response["output"].get("live_advisory")
    assert isinstance(live_advisory, dict), "missing live_advisory"
    assert live_advisory.get("advisoryOnly") is True, "live advisory must be advisory only"
    assert live_advisory.get("final_decision_owner") == "Deterministic Decision Owner"
    assert any(event["agent_name"] == "Evidence Retrieval Agent" and event.get("tool_used") for event in response["agent_trace"]), "missing evidence memory tool trace"
    assert any(event["agent_name"] == "Learning & Precedent Specialist" and event.get("memory_key") == "learningContext" for event in response["agent_trace"]), "missing learning memory trace"
    assert_no_raw_vectors(response)


def check_sample_runs() -> List[Dict[str, Any]]:
    responses = []
    with patched_env(SAMPLE_MODE="false", REQUIRE_COMPASS="false", LOG_DIR="./logs", OPENAI_API_KEY=None, OPENAI_BASE_URL=None, P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, QDRANT_API_KEY=None, AGENT_RUNTIME="custom", CREWAI_ENABLE_LIVE_LLM="0"):
        for index, name in enumerate(("example_1.json", "example_2.json", "example_3.json"), start=1):
            response = run_payload(load_example(name, run_id=f"unit-sample-{index}", sample_mode=True))
            assert_base_response(response)
            assert response["output"]["live_compass"]["status"] == "skipped_sample_mode"
            assert response["output"]["live_advisory"]["status"] == "skipped_custom_runtime"
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
    with patched_env(SAMPLE_MODE="false", REQUIRE_COMPASS="false", LOG_DIR="./logs", OPENAI_API_KEY=None, OPENAI_BASE_URL=None, P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, QDRANT_API_KEY=None, AGENT_RUNTIME="custom", CREWAI_ENABLE_LIVE_LLM="0"):
        response = run_payload(payload)
    saved = json.loads((ROOT / "output_examples" / "example_1_output.json").read_text(encoding="utf-8"))
    assert response["run_id"] == "unit-static-output-check"
    assert response["log_file"] == "logs/trace-unit-static-output-check.jsonl"
    assert response["trace_id"] != saved.get("trace_id")
    assert response.get("output") != saved.get("output")


def check_compass_modes() -> None:
    with patched_env(SAMPLE_MODE="false", REQUIRE_COMPASS="false", LOG_DIR="./logs", OPENAI_API_KEY=None, OPENAI_BASE_URL=None, P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, QDRANT_API_KEY=None, AGENT_RUNTIME="custom", CREWAI_ENABLE_LIVE_LLM="0"):
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

        html_405 = FakeCompassHtml405()
        response = run_payload(load_example("example_1.json", run_id="unit-compass-html-405", sample_mode=False), html_405)
        assert_base_response(response)
        assert html_405.calls == 1
        assert response["output"]["live_compass"]["status"] == "unavailable"
        assert response["output"]["decision"] == "conditional_approval"


def check_require_compass() -> None:
    with patched_env(SAMPLE_MODE="false", REQUIRE_COMPASS="true", LOG_DIR="./logs", OPENAI_API_KEY=None, OPENAI_BASE_URL=None, P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, QDRANT_API_KEY=None, AGENT_RUNTIME="custom", CREWAI_ENABLE_LIVE_LLM="0"):
        failure = FakeCompassFailure()
        response = run_payload(load_example("example_1.json", run_id="unit-require-compass", sample_mode=False), failure)
        assert response["status"] == "error"
        assert response["error"]["type"] == "compass_required_unavailable"
        assert response["trace_id"]
        assert response["log_file"]
        assert response["output"]["live_compass"]["status"] == "unavailable"
        assert "compass_advisory_unavailable" in event_actions(response)
    os.environ.pop("REQUIRE_COMPASS", None)


def fake_crewai_success(shared_context: Dict[str, Any]) -> Dict[str, Any]:
    assert shared_context.get("decisionDraft"), "CrewAI advisory should receive deterministic draft"
    assert shared_context.get("learningContext"), "CrewAI advisory should receive learning context"
    return {
        "ok": True,
        "status": "available",
        "runtime": "crewai_live",
        "model": "mock-fast",
        "advisoryOnly": True,
        "agents": [
            {"name": "Privacy Specialist", "role": "mock"},
            {"name": "Final Advisory Reviewer", "role": "mock"},
        ],
        "cards": [
            {
                "specialist": "Privacy Specialist",
                "advisoryOnly": True,
                "assessment": "conditional",
                "findings": ["Mocked privacy issue."],
                "unresolvedRisks": ["Mocked DPA question."],
                "reviewerQuestions": ["Confirm DPA is signed."],
                "recommendedActions": ["Keep deterministic controls."],
                "confidence": "medium",
                "rationale": "Mocked CrewAI specialist card.",
            },
            {
                "specialist": "Final Advisory Reviewer",
                "advisoryOnly": True,
                "assessment": "approve",
                "findings": ["Attempts approve to verify guardrail."],
                "unresolvedRisks": [],
                "reviewerQuestions": ["Confirm deterministic owner remains final."],
                "recommendedActions": [],
                "confidence": "high",
                "rationale": "Mocked approval advisory cannot override deterministic policy.",
            },
        ],
        "summary": {
            "assessment": "approve",
            "rationale": "Mocked approval advisory cannot override deterministic policy.",
            "reviewerQuestions": ["Confirm deterministic owner remains final."],
            "recommendedActions": [],
            "specialistCardCount": 2,
        },
    }


def fake_crewai_failure(shared_context: Dict[str, Any]) -> Dict[str, Any]:
    assert shared_context.get("decisionDraft"), "CrewAI advisory should receive deterministic draft before failing"
    return {
        "ok": False,
        "status": "unavailable",
        "runtime": "crewai_live",
        "model": "mock-fast",
        "advisoryOnly": True,
        "agents": [],
        "cards": [],
        "summary": {},
        "error_type": "mock_crewai_failure",
        "message": "Mocked CrewAI outage.",
        "recoverable": True,
    }


def check_crewai_runtime_modes() -> None:
    with patched_env(SAMPLE_MODE="false", REQUIRE_COMPASS="false", LOG_DIR="./logs", OPENAI_API_KEY=None, OPENAI_BASE_URL=None, P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, QDRANT_API_KEY=None, AGENT_RUNTIME="custom", CREWAI_ENABLE_LIVE_LLM="1"):
        with patch("app.agentathon_orchestrator.run_crewai_advisory_council", side_effect=AssertionError("default runtime must not call CrewAI")):
            response = run_payload(load_example("example_1.json", run_id="unit-crewai-default", sample_mode=False), FakeCompassFailure())
        assert_base_response(response)
        assert response["output"]["live_advisory"]["runtime"] == "custom"
        assert response["output"]["live_advisory"]["status"] == "skipped_custom_runtime"

    with patched_env(SAMPLE_MODE="false", REQUIRE_COMPASS="false", LOG_DIR="./logs", OPENAI_API_KEY="placeholder", OPENAI_BASE_URL="https://api.core42.ai/v1", P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, QDRANT_API_KEY=None, AGENT_RUNTIME="crewai_live", CREWAI_ENABLE_LIVE_LLM="1"):
        with patch("app.agentathon_orchestrator.run_crewai_advisory_council", side_effect=fake_crewai_success):
            response = run_payload(load_example("example_2.json", run_id="unit-crewai-success", sample_mode=False), FakeCompassFailure())
        assert_base_response(response)
        assert response["output"]["live_advisory"]["runtime"] == "crewai_live"
        assert response["output"]["live_advisory"]["status"] == "available"
        assert response["output"]["live_advisory"]["cards"], "mock CrewAI cards should be attached"
        assert "live_crewai_review" in event_actions(response)
        assert response["output"]["decision"] == "reject", "CrewAI advisory must not override deterministic rejection"

        with patch("app.agentathon_orchestrator.run_crewai_advisory_council", side_effect=fake_crewai_failure):
            response = run_payload(load_example("example_1.json", run_id="unit-crewai-failure", sample_mode=False), FakeCompassFailure())
        assert_base_response(response)
        assert response["output"]["live_advisory"]["runtime"] == "crewai_live"
        assert response["output"]["live_advisory"]["status"] == "unavailable"
        assert response["output"]["live_advisory"]["error_type"] == "mock_crewai_failure"
        assert "crewai_advisory_unavailable" in event_actions(response)

    with patched_env(SAMPLE_MODE="false", REQUIRE_COMPASS="false", LOG_DIR="./logs", OPENAI_API_KEY="placeholder", OPENAI_BASE_URL="https://api.core42.ai/v1", P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, QDRANT_API_KEY=None, AGENT_RUNTIME="crewai_live", CREWAI_ENABLE_LIVE_LLM="0"):
        with patch("app.agentathon_orchestrator.run_crewai_advisory_council", side_effect=AssertionError("disabled CrewAI must not call live runtime")):
            response = run_payload(load_example("example_1.json", run_id="unit-crewai-disabled", sample_mode=False), FakeCompassFailure())
        assert_base_response(response)
        assert response["output"]["live_advisory"]["runtime"] == "crewai_live"
        assert response["output"]["live_advisory"]["status"] == "unavailable"
        assert response["output"]["live_advisory"]["error_type"] == "crewai_live_disabled"


def check_base_url_normalization() -> None:
    current = normalize_openai_base_url("https://api.core42.ai/v1")
    assert current["normalized"] == "https://api.core42.ai/v1"
    assert current["official"] is True
    assert current["accepted_direct"] is True
    assert normalize_openai_base_url("https://api.core42.ai/v1/")["normalized"] == "https://api.core42.ai/v1"
    normalized_root = normalize_openai_base_url("https://api.core42.ai")
    assert normalized_root["normalized"] == "https://api.core42.ai/v1"
    assert normalized_root["warnings"], "expected /v1 normalization warning"
    legacy = normalize_openai_base_url("https://compass.core42.ai/v1")
    assert legacy["normalized"] == "https://compass.core42.ai/v1"
    assert legacy["official"] is False
    assert legacy["accepted_direct"] is True
    assert legacy["provider_variant"] == "legacy_agentathon_prompt"
    assert normalize_openai_base_url("not a url")["ok"] is False
    frontend = normalize_openai_base_url("https://g42.genai.works")
    assert frontend["ok"] is False
    assert "frontend" in frontend["errors"][0].lower()


def check_compass_doctor_html_detection() -> None:
    html = "<!doctype html><html><body>Compass landing page</body></html>"
    with patched_env(OPENAI_API_KEY="test-secret-key", OPENAI_BASE_URL="https://api.core42.ai/v1"):
        with patch("app.compass_client.socket.getaddrinfo", return_value=[]):
            with patch("app.compass_client.httpx.get", return_value=FakeHttpxResponse(200, html, {"content-type": "text/html"})):
                with patch("app.compass_client.httpx.post", return_value=FakeHttpxResponse(405, json.dumps({"error": "method"}), {"content-type": "application/json"})):
                    result = CompassClient(timeout_seconds=1, retries=0).doctor(skip_chat=True)
    assert result["ok"] is False
    assert result["models_endpoint"]["body_type"] == "html"
    assert result["error_type"] == "html_models_response"
    assert "Received HTML" in result["message"]


def check_compass_probe_endpoint() -> None:
    from app.main import app

    client = TestClient(app)
    with patched_env(OPENAI_API_KEY=None, OPENAI_BASE_URL=None, SAMPLE_MODE="true"):
        with patch("app.compass_client.socket.getaddrinfo", return_value=[]):
            response = client.get("/compass/probe")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["sample_mode"] is True
    assert body["error_type"] == "missing_api_key"

    secret = "secret-token-for-redaction-123456"
    with patched_env(OPENAI_API_KEY=secret, OPENAI_BASE_URL="https://api.core42.ai/v1", SAMPLE_MODE="true"):
        with patch("app.compass_client.socket.getaddrinfo", return_value=[]):
            with patch("app.compass_client.httpx.get", side_effect=RuntimeError(secret)):
                with patch("app.compass_client.httpx.post", side_effect=RuntimeError(secret)):
                    response = client.get("/compass/probe")
    assert response.status_code == 200
    text = json.dumps(response.json())
    assert secret not in text
    assert response.json()["sample_mode"] is True


def check_evidence_memory_components() -> None:
    chunks = chunk_text("alpha beta gamma delta epsilon zeta eta theta iota", chunk_size=22, overlap=6)
    assert len(chunks) >= 3
    assert chunks[0][-6:].strip() in chunks[1], "expected stable overlapping chunks"

    local = LocalEvidenceMemory()
    evidence_chunks = chunks_from_evidence_items(
        [
            {
                "id": "ev-privacy",
                "title": "DPA and model-training evidence",
                "text": "Signed DPA prohibits customer data model training and lists subprocessors with retention.",
            },
            {"id": "ev-security", "title": "SOC2", "text": "SOC 2 Type II, MFA, SSO, encryption, and audit logging are in place."},
        ],
        case_id="case-123",
        workspace_id="agentathon",
        project_id="unit",
    )
    local.index(evidence_chunks)
    search = local.search("model training exclusion subprocessors", case_id="case-123")
    assert search["provider"] == "local-fallback"
    assert search["matches"], "local fallback should return relevant snippets"
    assert search["matches"][0]["snippet"]
    assert search["browserEmbeddingsRetained"] is False

    with patched_env(P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None):
        assert get_evidence_memory_provider(FakeCompassSuccess()).provider == "local-fallback"

    fake_client = FakeQdrantClient()
    with patched_env(P42_VECTOR_STORE_PROVIDER="qdrant", QDRANT_URL="https://qdrant.example", QDRANT_API_KEY="placeholder", OPENAI_API_KEY="placeholder", OPENAI_BASE_URL="https://api.core42.ai/v1"):
        provider = FakeQdrantMemory(compass_client=FakeCompassSuccess(), client=fake_client, collection="unit_collection", vector_size=3)
        index_result = provider.index(evidence_chunks)
        assert index_result["indexedChunkCount"] == len(evidence_chunks)
        assert fake_client.points, "fake Qdrant upsert should receive points"
        assert all("embedding" not in point.payload for point in fake_client.points)
        result = provider.search("DPA model training", case_id="case-123", limit=2)
        assert result["matches"], "fake Qdrant search should return matches"
        filters = {condition.key: condition.match.value for condition in fake_client.last_filter.must}
        assert filters == {"type": "evidence_chunk", "caseId": "case-123"}


def check_learning_memory_components() -> None:
    with patched_env(P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, OPENAI_API_KEY=None, OPENAI_BASE_URL=None):
        seeds = load_seed_artifacts()
        assert len(seeds) >= 5, "synthetic learning memory seed should load"
        assert all(seed.advisory_only is True for seed in seeds)

        memory = LocalLearningMemory()
        seed_result = memory.seed_synthetic_learning_memory()
        assert seed_result["seeded"] >= 5
        healthcare = memory.find_similar_cases(
            {
                "workflow": "Healthcare analytics dashboard for patient operations data.",
                "dataCategories": ["limited patient operations data"],
                "geography": "UAE",
                "aiUse": "Analytics workflow requires data-use governance confirmation.",
            },
            ["model-training exclusion"],
            ["privacy", "ai-governance", "healthcare"],
        )
        assert healthcare["provider"] == "local-jsonl"
        assert healthcare["similarCases"], "expected healthcare learning precedent"
        assert any("healthcare" in json.dumps(case).lower() for case in healthcare["similarCases"])
        assert all(case["advisoryOnly"] is True for case in healthcare["similarCases"])

        ai_summary = summarize_learning_signals(
            {
                "workflow": "AI support-ticket classifier using customer support tickets.",
                "dataCategories": ["customer support data"],
                "aiUse": "Classifier suggests draft responses.",
            },
            ["model-training exclusion", "signed DPA"],
            ["ai-governance", "privacy"],
        )
        text = json.dumps(ai_summary).lower()
        assert "model-training" in text or "customer-data training" in text
        assert ai_summary["advisoryOnly"] is True
        assert ai_summary["provider"] == "local-jsonl"
        assert ai_summary["browserEmbeddingsRetained"] is False


def check_fixture_document_components() -> None:
    documents = listSupportedFixtureDocuments()
    assert len(documents) == 6, "expected six generated fixture PDFs"
    saas = getFixtureExpectedProfile("01_enterprise_saas_master_services_agreement.pdf")
    assert saas and saas["domain"] == "saas"
    resolved = safeResolveFixturePath("01_enterprise_saas_master_services_agreement.pdf")
    assert resolved.name == "01_enterprise_saas_master_services_agreement.pdf"
    try:
        safeResolveFixturePath("../metadata.json")
    except FixtureDocumentError:
        pass
    else:
        raise AssertionError("path traversal fixture lookup should be rejected")
    try:
        safeResolveFixturePath("https://vercel.com/dashboard/example")
    except FixtureDocumentError:
        pass
    else:
        raise AssertionError("hosted dashboard URL should be rejected as fixture path")
    extracted = extractFixtureDocument("03_ai_accelerator_chip_import_export_control_agreement.pdf")
    assert extracted["extractionStatus"] in {"text_extracted", "metadata_fallback"}
    text = json.dumps(extracted).lower()
    assert "export" in text and "end-use" in text


def check_fixture_run_behavior() -> None:
    payload = {
        "run_id": "unit-fixture-cloud-ai",
        "use_case_id": "21",
        "input": {
            "query": "Can we approve this? The prompt is vague, use the uploaded fixture.",
            "documents": [{"filename": "06_cloud_ai_model_services_statement_of_work.pdf"}],
        },
        "options": {"sample_mode": True, "max_iterations": 3},
    }
    with patched_env(SAMPLE_MODE="false", REQUIRE_COMPASS="false", LOG_DIR="./logs", OPENAI_API_KEY=None, OPENAI_BASE_URL=None, P42_VECTOR_STORE_PROVIDER="local", QDRANT_URL=None, QDRANT_API_KEY=None, AGENT_RUNTIME="custom", CREWAI_ENABLE_LIVE_LLM="0"):
        response = run_payload(payload)
    assert_base_response(response)
    output = response["output"]
    fixture_analysis = output.get("fixture_document_analysis")
    assert isinstance(fixture_analysis, dict) and fixture_analysis["documents_used"], "missing fixture document analysis"
    assert fixture_analysis["detected_domain"] == "ai"
    assert "ingest_fixture_document" in event_actions(response)
    assert output["rag_evidence_memory"]["provider"] == "local-fallback"
    assert output["rag_evidence_memory"]["browserEmbeddingsRetained"] is False
    assert any("Aster Cognitive Cloud" in json.dumps(value) for value in [output, response.get("agent_trace", [])])
    assert_no_raw_vectors(response)

    unknown_payload = copy.deepcopy(payload)
    unknown_payload["run_id"] = "unit-fixture-unknown"
    unknown_payload["input"]["documents"] = [{"filename": "not_a_supported_fixture.pdf"}]
    response = run_payload(unknown_payload)
    assert_base_response(response)
    assert response["output"]["fixture_document_analysis"]["documents_used"] == []


def check_qdrant_smoke_skip() -> None:
    env = os.environ.copy()
    env.pop("QDRANT_URL", None)
    env.pop("QDRANT_API_KEY", None)
    env.pop("OPENAI_API_KEY", None)
    env.pop("OPENAI_BASE_URL", None)
    env["P42_VECTOR_STORE_PROVIDER"] = "local"
    completed = subprocess.run(
        [sys.executable, "scripts/qdrant_smoke.py"],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    assert completed.returncode == 0
    assert "QDRANT_SMOKE=SKIPPED" in completed.stdout


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
    check_base_url_normalization()
    check_compass_doctor_html_detection()
    check_compass_probe_endpoint()
    check_evidence_memory_components()
    check_learning_memory_components()
    check_fixture_document_components()
    check_fixture_run_behavior()
    check_qdrant_smoke_skip()
    responses = check_sample_runs()
    check_trace_collaboration(responses[0])
    check_no_static_output_loading()
    check_compass_modes()
    check_require_compass()
    check_crewai_runtime_modes()
    print("Agentathon wrapper checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
