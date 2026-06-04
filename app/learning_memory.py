"""Governed learning memory for the Agentathon wrapper.

Learning memory is advisory only. It stores auditable reviewer outcomes and
control patterns; it does not train models, rewrite policy, or own decisions.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from .compass_client import CompassClient, embedding_model_from_env
from .evidence_memory import DEFAULT_COLLECTION, DEFAULT_VECTOR_SIZE, LocalEvidenceMemory, QdrantEvidenceMemory, _int_env, qdrant_env_present, qdrant_provider_requested
from .trace_logger import ROOT, redact


LEARNING_TYPES = {
    "case_outcome",
    "reviewer_feedback",
    "control_pattern",
    "decision_override",
    "evidence_quality_note",
}
SAMPLE_MEMORY_PATH = ROOT / "data" / "sample_learning_memory.json"
LOCAL_JSONL_PATH = ROOT / "data" / "learning_memory.jsonl"
MAX_TEXT = 520


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _snippet(value: Any, limit: int = MAX_TEXT) -> str:
    text = _clean(redact(value))
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


def _as_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        return [item.strip() for item in re.split(r"[,;\n]", value) if item.strip()]
    return []


def _terms(text: str) -> set[str]:
    return {term for term in re.findall(r"[a-z0-9][a-z0-9-]{2,}", text.lower())}


def _score(query: str, text: str) -> float:
    query_terms = _terms(query)
    if not query_terms:
        return 0.0
    haystack = text.lower()
    matched = sum(1 for term in query_terms if term in haystack)
    boost = 0.08 if any(term in haystack for term in ("training", "dpa", "subprocessor", "retention", "cross-border")) else 0.0
    return round(min(0.99, matched / max(1, len(query_terms)) + boost), 4)


@dataclass
class LearningArtifact:
    artifact_type: str = "reviewer_feedback"
    memory_id: str = field(default_factory=lambda: f"learn-{uuid.uuid4().hex[:12]}")
    case_id: str = ""
    workspace_id: str = "agentathon"
    project_id: str = "use-case-21"
    title: str = ""
    original_decision: str = ""
    reviewer_decision: str = ""
    reviewer_notes: str = ""
    added_controls: List[str] = field(default_factory=list)
    rejected_evidence: List[str] = field(default_factory=list)
    missing_evidence: List[str] = field(default_factory=list)
    final_outcome: str = ""
    domains: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    actor: Dict[str, Any] = field(default_factory=lambda: {"mode": "audit", "id": "demo-reviewer"})
    advisory_only: bool = True

    @classmethod
    def from_dict(cls, value: Dict[str, Any]) -> "LearningArtifact":
        artifact_type = str(value.get("type") or value.get("artifact_type") or "reviewer_feedback")
        if artifact_type not in LEARNING_TYPES:
            artifact_type = "reviewer_feedback"
        return cls(
            artifact_type=artifact_type,
            memory_id=_clean(value.get("memoryId") or value.get("memory_id")) or f"learn-{uuid.uuid4().hex[:12]}",
            case_id=_clean(value.get("caseId") or value.get("case_id")),
            workspace_id=_clean(value.get("workspaceId") or value.get("workspace_id")) or "agentathon",
            project_id=_clean(value.get("projectId") or value.get("project_id")) or "use-case-21",
            title=_snippet(value.get("title"), 180),
            original_decision=_clean(value.get("originalDecision") or value.get("original_decision")),
            reviewer_decision=_clean(value.get("reviewerDecision") or value.get("reviewer_decision")),
            reviewer_notes=_snippet(value.get("reviewerNotes") or value.get("reviewer_notes")),
            added_controls=[_snippet(item, 260) for item in _as_list(value.get("addedControls") or value.get("added_controls")) if _clean(item)][:10],
            rejected_evidence=[_snippet(item, 180) for item in _as_list(value.get("rejectedEvidence") or value.get("rejected_evidence")) if _clean(item)][:10],
            missing_evidence=[_snippet(item, 180) for item in _as_list(value.get("missingEvidence") or value.get("missing_evidence")) if _clean(item)][:10],
            final_outcome=_clean(value.get("finalOutcome") or value.get("final_outcome")),
            domains=[_clean(item) for item in _as_list(value.get("domains")) if _clean(item)][:8],
            created_at=_clean(value.get("createdAt") or value.get("created_at")) or datetime.now(timezone.utc).isoformat(),
            actor=value.get("actor") if isinstance(value.get("actor"), dict) else {"mode": "audit", "id": "demo-reviewer"},
            advisory_only=True,
        )

    def payload(self) -> Dict[str, Any]:
        return {
            "type": self.artifact_type,
            "memoryType": "learning_artifact",
            "memoryId": self.memory_id,
            "caseId": self.case_id,
            "workspaceId": self.workspace_id,
            "projectId": self.project_id,
            "title": self.title,
            "originalDecision": self.original_decision,
            "reviewerDecision": self.reviewer_decision,
            "reviewerNotes": self.reviewer_notes,
            "addedControls": list(self.added_controls),
            "rejectedEvidence": list(self.rejected_evidence),
            "missingEvidence": list(self.missing_evidence),
            "finalOutcome": self.final_outcome,
            "domains": list(self.domains),
            "createdAt": self.created_at,
            "actor": {
                "mode": _clean(self.actor.get("mode")) or "audit",
                "id": _snippet(self.actor.get("id") or "demo-reviewer", 120),
            },
            "advisoryOnly": True,
        }

    def searchable_text(self) -> str:
        return " ".join(
            [
                self.title,
                self.case_id,
                self.original_decision,
                self.reviewer_decision,
                self.reviewer_notes,
                self.final_outcome,
                " ".join(self.added_controls),
                " ".join(self.rejected_evidence),
                " ".join(self.missing_evidence),
                " ".join(self.domains),
            ]
        )


def load_seed_artifacts() -> List[LearningArtifact]:
    if not SAMPLE_MEMORY_PATH.exists():
        return []
    try:
        payload = json.loads(SAMPLE_MEMORY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    records = payload.get("artifacts") if isinstance(payload, dict) else payload
    return [LearningArtifact.from_dict(item) for item in records if isinstance(item, dict)]


def build_learning_query(case_facts: Dict[str, Any], missing_evidence: Sequence[str], domains: Sequence[str]) -> str:
    parts = [
        case_facts.get("supplier"),
        case_facts.get("workflow"),
        case_facts.get("geography"),
        case_facts.get("aiUse"),
        " ".join(str(item) for item in case_facts.get("dataCategories", []) if item),
        " ".join(str(item) for item in case_facts.get("riskSignals", []) if item),
        " ".join(str(item) for item in missing_evidence if item),
        " ".join(str(item) for item in domains if item),
    ]
    return _snippet(" ".join(_clean(part) for part in parts if _clean(part)), 1600)


def sanitize_artifact(artifact: LearningArtifact, score: float = 0.0) -> Dict[str, Any]:
    payload = artifact.payload()
    return {
        "score": round(float(score), 4),
        "memoryId": payload["memoryId"],
        "caseId": payload["caseId"],
        "type": payload["type"],
        "title": payload["title"],
        "originalDecision": payload["originalDecision"],
        "reviewerDecision": payload["reviewerDecision"],
        "finalOutcome": payload["finalOutcome"],
        "addedControls": payload["addedControls"],
        "missingEvidence": payload["missingEvidence"],
        "domains": payload["domains"],
        "advisoryOnly": True,
    }


class LocalLearningMemory:
    provider = "local-jsonl"
    durable = False
    configured = False

    def __init__(self, path: Path = LOCAL_JSONL_PATH) -> None:
        self.path = path

    def status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "qdrantConfigured": False,
            "durable": False,
            "path": str(self.path.relative_to(ROOT)),
            "seedPath": str(SAMPLE_MEMORY_PATH.relative_to(ROOT)),
            "advisoryOnly": True,
            "browserEmbeddingsRetained": False,
        }

    def _load_jsonl(self) -> List[LearningArtifact]:
        if not self.path.exists():
            return []
        artifacts: List[LearningArtifact] = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except Exception:
                continue
            if isinstance(value, dict):
                artifacts.append(LearningArtifact.from_dict(value))
        return artifacts

    def artifacts(self) -> List[LearningArtifact]:
        deduped: Dict[str, LearningArtifact] = {}
        for artifact in load_seed_artifacts() + self._load_jsonl():
            deduped[artifact.memory_id] = artifact
        return list(deduped.values())

    def seed_synthetic_learning_memory(self) -> Dict[str, Any]:
        artifacts = load_seed_artifacts()
        return {
            "provider": self.provider,
            "seeded": len(artifacts),
            "advisoryOnly": True,
            "browserEmbeddingsRetained": False,
        }

    def store_feedback(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        artifact = LearningArtifact.from_dict({**payload, "type": payload.get("type") or "reviewer_feedback"})
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(artifact.payload(), sort_keys=True) + "\n")
        return {"provider": self.provider, "stored": True, "artifact": sanitize_artifact(artifact), "advisoryOnly": True}

    def find_similar_cases(
        self,
        case_facts: Dict[str, Any],
        missing_evidence: Sequence[str],
        domains: Sequence[str],
        *,
        limit: int = 5,
    ) -> Dict[str, Any]:
        query = build_learning_query(case_facts, missing_evidence, domains)
        scored: List[Tuple[float, LearningArtifact]] = []
        for artifact in self.artifacts():
            score = _score(query, artifact.searchable_text())
            if score > 0:
                scored.append((score, artifact))
        scored.sort(key=lambda item: item[0], reverse=True)
        return {
            "provider": self.provider,
            "similarCases": [sanitize_artifact(artifact, score) for score, artifact in scored[:limit]],
            "advisoryOnly": True,
            "browserEmbeddingsRetained": False,
        }

    def get_control_suggestions(
        self,
        case_facts: Dict[str, Any],
        missing_evidence: Sequence[str],
        domains: Sequence[str],
        *,
        limit: int = 8,
    ) -> Dict[str, Any]:
        similar = self.find_similar_cases(case_facts, missing_evidence, domains, limit=8)["similarCases"]
        suggestions: List[str] = []
        repeated_gaps: List[str] = []
        for case in similar:
            for control in case.get("addedControls", []):
                if _clean(control).lower() not in {item.lower() for item in suggestions}:
                    suggestions.append(_clean(control))
            for gap in case.get("missingEvidence", []):
                if _clean(gap).lower() not in {item.lower() for item in repeated_gaps}:
                    repeated_gaps.append(_clean(gap))
        return {
            "provider": self.provider,
            "controlSuggestions": suggestions[:limit],
            "repeatedEvidenceGaps": repeated_gaps[:limit],
            "advisoryOnly": True,
            "browserEmbeddingsRetained": False,
        }


class QdrantLearningMemory:
    provider = "qdrant"
    durable = True

    def __init__(self, *, compass_client: Optional[CompassClient] = None, client: Any = None, collection: Optional[str] = None) -> None:
        self.compass = compass_client or CompassClient()
        self.collection = collection or os.environ.get("QDRANT_COLLECTION") or DEFAULT_COLLECTION
        self.vector_size = _int_env("QDRANT_VECTOR_SIZE", DEFAULT_VECTOR_SIZE)
        self._client = client
        self.configured = qdrant_provider_requested() and qdrant_env_present()
        self.local = LocalLearningMemory()

    def status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "qdrantConfigured": bool(self.configured),
            "collection": self.collection,
            "durable": True,
            "embeddingsModel": embedding_model_from_env(),
            "advisoryOnly": True,
            "browserEmbeddingsRetained": False,
        }

    def _qdrant(self) -> QdrantEvidenceMemory:
        return QdrantEvidenceMemory(compass_client=self.compass, client=self._client, collection=self.collection, vector_size=self.vector_size)

    def _imports(self) -> Dict[str, Any]:
        return self._qdrant()._qdrant_imports()

    def _client_instance(self) -> Any:
        qdrant = self._qdrant()
        client = qdrant._get_client()
        self._client = client
        return client

    def _filter(self) -> Any:
        imports = self._imports()
        if imports.get("error"):
            return None
        return imports["Filter"](
            must=[
                imports["FieldCondition"](key="memoryType", match=imports["MatchValue"](value="learning_artifact")),
                imports["FieldCondition"](key="advisoryOnly", match=imports["MatchValue"](value=True)),
            ]
        )

    def seed_synthetic_learning_memory(self) -> Dict[str, Any]:
        artifacts = load_seed_artifacts()
        if not self.configured:
            return {**self.local.seed_synthetic_learning_memory(), "fallbackFrom": "qdrant_not_configured"}
        if not artifacts:
            return {"provider": self.provider, "seeded": 0, "advisoryOnly": True, "browserEmbeddingsRetained": False}
        collection_result = self._qdrant().ensure_collection()
        if not collection_result.get("ok"):
            return {**self.local.seed_synthetic_learning_memory(), "fallbackFrom": collection_result.get("error_type", "qdrant_collection_error")}
        embeddings = self.compass.embed_texts([artifact.searchable_text() for artifact in artifacts])
        if not embeddings.get("ok"):
            return {**self.local.seed_synthetic_learning_memory(), "fallbackFrom": embeddings.get("error_type", "embedding_unavailable")}
        imports = self._imports()
        PointStruct = imports.get("PointStruct")
        points = []
        for artifact, vector in zip(artifacts, embeddings.get("embeddings") or []):
            payload = artifact.payload()
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"learning:{payload['memoryId']}"))
            if PointStruct:
                points.append(PointStruct(id=point_id, vector=vector, payload=payload))
            else:
                points.append({"id": point_id, "vector": vector, "payload": payload})
        try:
            self._client_instance().upsert(collection_name=self.collection, points=points)
            return {
                "provider": self.provider,
                "seeded": len(points),
                "advisoryOnly": True,
                "browserEmbeddingsRetained": False,
            }
        except Exception as exc:
            return {**self.local.seed_synthetic_learning_memory(), "fallbackFrom": exc.__class__.__name__}

    def store_feedback(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        artifact = LearningArtifact.from_dict({**payload, "type": payload.get("type") or "reviewer_feedback"})
        if not self.configured:
            return {**self.local.store_feedback(payload), "fallbackFrom": "qdrant_not_configured"}
        seeded = self.seed_synthetic_learning_memory()
        if seeded.get("provider") != self.provider:
            return {**self.local.store_feedback(payload), "fallbackFrom": seeded.get("fallbackFrom", "qdrant_unavailable")}
        embedding = self.compass.embed_texts([artifact.searchable_text()])
        if not embedding.get("ok"):
            return {**self.local.store_feedback(payload), "fallbackFrom": embedding.get("error_type", "embedding_unavailable")}
        imports = self._imports()
        PointStruct = imports.get("PointStruct")
        payload_data = artifact.payload()
        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"learning:{payload_data['memoryId']}"))
        vector = (embedding.get("embeddings") or [[]])[0]
        point = PointStruct(id=point_id, vector=vector, payload=payload_data) if PointStruct else {"id": point_id, "vector": vector, "payload": payload_data}
        try:
            self._client_instance().upsert(collection_name=self.collection, points=[point])
            return {"provider": self.provider, "stored": True, "artifact": sanitize_artifact(artifact), "advisoryOnly": True}
        except Exception as exc:
            return {**self.local.store_feedback(payload), "fallbackFrom": exc.__class__.__name__}

    def find_similar_cases(
        self,
        case_facts: Dict[str, Any],
        missing_evidence: Sequence[str],
        domains: Sequence[str],
        *,
        limit: int = 5,
    ) -> Dict[str, Any]:
        seeded = self.seed_synthetic_learning_memory()
        if seeded.get("provider") != self.provider:
            local = self.local.find_similar_cases(case_facts, missing_evidence, domains, limit=limit)
            return {**local, "qdrantConfigured": bool(self.configured), "fallbackFrom": seeded.get("fallbackFrom", "qdrant_unavailable")}
        query = build_learning_query(case_facts, missing_evidence, domains)
        embedding = self.compass.embed_texts([query])
        if not embedding.get("ok"):
            local = self.local.find_similar_cases(case_facts, missing_evidence, domains, limit=limit)
            return {**local, "qdrantConfigured": bool(self.configured), "fallbackFrom": embedding.get("error_type", "embedding_unavailable")}
        try:
            query_vector = (embedding.get("embeddings") or [[]])[0]
            client = self._client_instance()
            if hasattr(client, "search"):
                hits = client.search(collection_name=self.collection, query_vector=query_vector, query_filter=self._filter(), limit=limit, with_payload=True)
            else:
                response = client.query_points(collection_name=self.collection, query=query_vector, query_filter=self._filter(), limit=limit, with_payload=True)
                hits = getattr(response, "points", response)
            similar = []
            for hit in hits or []:
                payload = getattr(hit, "payload", None) or (hit.get("payload") if isinstance(hit, dict) else {}) or {}
                score = getattr(hit, "score", None)
                if score is None and isinstance(hit, dict):
                    score = hit.get("score", 0)
                similar.append(sanitize_artifact(LearningArtifact.from_dict(payload), float(score or 0)))
            return {"provider": self.provider, "similarCases": similar, "advisoryOnly": True, "browserEmbeddingsRetained": False}
        except Exception as exc:
            local = self.local.find_similar_cases(case_facts, missing_evidence, domains, limit=limit)
            return {**local, "qdrantConfigured": bool(self.configured), "fallbackFrom": exc.__class__.__name__}

    def get_control_suggestions(
        self,
        case_facts: Dict[str, Any],
        missing_evidence: Sequence[str],
        domains: Sequence[str],
        *,
        limit: int = 8,
    ) -> Dict[str, Any]:
        similar = self.find_similar_cases(case_facts, missing_evidence, domains, limit=8)
        suggestions: List[str] = []
        repeated_gaps: List[str] = []
        for case in similar.get("similarCases", []):
            for control in case.get("addedControls", []):
                if _clean(control).lower() not in {item.lower() for item in suggestions}:
                    suggestions.append(_clean(control))
            for gap in case.get("missingEvidence", []):
                if _clean(gap).lower() not in {item.lower() for item in repeated_gaps}:
                    repeated_gaps.append(_clean(gap))
        return {
            "provider": similar.get("provider", self.provider),
            "controlSuggestions": suggestions[:limit],
            "repeatedEvidenceGaps": repeated_gaps[:limit],
            "advisoryOnly": True,
            "browserEmbeddingsRetained": False,
            **({"fallbackFrom": similar.get("fallbackFrom")} if similar.get("fallbackFrom") else {}),
        }


def get_learning_memory_provider(compass_client: Optional[CompassClient] = None) -> Any:
    if qdrant_provider_requested() and qdrant_env_present():
        provider = QdrantLearningMemory(compass_client=compass_client)
        imports = provider._imports()
        if not imports.get("error"):
            return provider
    return LocalLearningMemory()


def learning_memory_status() -> Dict[str, Any]:
    return get_learning_memory_provider().status()


def seed_synthetic_learning_memory() -> Dict[str, Any]:
    return get_learning_memory_provider().seed_synthetic_learning_memory()


def store_feedback(payload: Dict[str, Any]) -> Dict[str, Any]:
    return get_learning_memory_provider().store_feedback(payload)


def find_similar_cases(
    case_facts: Dict[str, Any],
    missing_evidence: Sequence[str],
    domains: Sequence[str],
    *,
    limit: int = 5,
) -> Dict[str, Any]:
    return get_learning_memory_provider().find_similar_cases(case_facts, missing_evidence, domains, limit=limit)


def get_control_suggestions(
    case_facts: Dict[str, Any],
    missing_evidence: Sequence[str],
    domains: Sequence[str],
    *,
    limit: int = 8,
) -> Dict[str, Any]:
    return get_learning_memory_provider().get_control_suggestions(case_facts, missing_evidence, domains, limit=limit)


def summarize_learning_signals(
    case_facts: Dict[str, Any],
    missing_evidence: Sequence[str],
    domains: Sequence[str],
    *,
    compass_client: Optional[CompassClient] = None,
) -> Dict[str, Any]:
    provider = get_learning_memory_provider(compass_client)
    similar = provider.find_similar_cases(case_facts, missing_evidence, domains, limit=5)
    controls = provider.get_control_suggestions(case_facts, missing_evidence, domains, limit=8)
    similar_cases = similar.get("similarCases", [])
    top_pattern = similar_cases[0].get("title") or similar_cases[0].get("finalOutcome") if similar_cases else ""
    return {
        "provider": controls.get("provider") or similar.get("provider") or provider.provider,
        "qdrantConfigured": bool(similar.get("qdrantConfigured", getattr(provider, "configured", False))),
        "similarCases": similar_cases,
        "controlSuggestions": controls.get("controlSuggestions", []),
        "repeatedEvidenceGaps": controls.get("repeatedEvidenceGaps", []),
        "similar_cases_found": len(similar_cases),
        "topPattern": top_pattern,
        "advisoryOnly": True,
        "note": "Learning memory is advisory. Deterministic policy and current evidence remain authoritative.",
        "browserEmbeddingsRetained": False,
        **({"fallbackFrom": controls.get("fallbackFrom") or similar.get("fallbackFrom")} if (controls.get("fallbackFrom") or similar.get("fallbackFrom")) else {}),
    }

