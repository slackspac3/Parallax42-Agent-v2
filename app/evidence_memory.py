"""Evidence memory providers for Agentathon RAG retrieval.

The Agentathon wrapper must never expose vectors or require Qdrant in local
sample mode. This module keeps Qdrant optional and returns only citation-safe
payload fields to callers.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from .compass_client import CompassClient, embedding_model_from_env
from .trace_logger import redact


DEFAULT_COLLECTION = "p42_compliance_evidence"
DEFAULT_VECTOR_SIZE = 3072
DEFAULT_CHUNK_SIZE = 900
DEFAULT_CHUNK_OVERLAP = 120
MAX_SNIPPET_CHARS = 520


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _truthy(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, ""))
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


def _snippet(value: Any, limit: int = MAX_SNIPPET_CHARS) -> str:
    text = _clean(redact(value))
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


def qdrant_provider_requested() -> bool:
    return os.environ.get("P42_VECTOR_STORE_PROVIDER", "local").strip().lower() == "qdrant"


def qdrant_env_present() -> bool:
    return bool(os.environ.get("QDRANT_URL"))


@dataclass
class EvidenceChunk:
    case_id: str
    workspace_id: str
    project_id: str
    document_id: str
    evidence_id: str
    title: str
    source: str
    chunk_index: int
    snippet: str
    domains: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def payload(self) -> Dict[str, Any]:
        return {
            "type": "evidence_chunk",
            "caseId": self.case_id,
            "workspaceId": self.workspace_id,
            "projectId": self.project_id,
            "documentId": self.document_id,
            "evidenceId": self.evidence_id,
            "title": self.title,
            "source": self.source,
            "chunkIndex": self.chunk_index,
            "snippet": _snippet(self.snippet),
            "domains": list(self.domains),
            "tags": list(self.tags),
            "createdAt": self.created_at,
        }


def chunk_text(text: str, chunk_size: Optional[int] = None, overlap: Optional[int] = None) -> List[str]:
    """Split text into stable overlapping chunks by character budget."""

    cleaned = _clean(text)
    if not cleaned:
        return []
    size = max(20, int(chunk_size or _int_env("RAG_CHUNK_SIZE", DEFAULT_CHUNK_SIZE)))
    overlap_size = max(0, int(overlap if overlap is not None else _int_env("RAG_CHUNK_OVERLAP", DEFAULT_CHUNK_OVERLAP)))
    if overlap_size >= size:
        overlap_size = max(0, size // 4)

    chunks: List[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + size)
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start = max(end - overlap_size, start + 1)
    return chunks


def classify_evidence_domains(text: str) -> List[str]:
    haystack = _clean(text).lower()
    patterns: List[Tuple[str, Sequence[str]]] = [
        (
            "privacy",
            (
                "dpa",
                "data processing",
                "personal data",
                "pii",
                "patient",
                "retention",
                "deletion",
                "subprocessor",
                "cross-border",
                "transfer",
                "hosting region",
            ),
        ),
        (
            "security",
            (
                "soc 2",
                "iso 27001",
                "mfa",
                "sso",
                "encryption",
                "audit log",
                "vulnerability",
                "access control",
                "penetration test",
            ),
        ),
        (
            "ai-governance",
            (
                "ai",
                "llm",
                "machine learning",
                "model training",
                "model improvement",
                "training exclusion",
                "automated",
                "classifier",
                "human oversight",
            ),
        ),
        (
            "continuity",
            (
                "business continuity",
                "bcp",
                "disaster recovery",
                "backup",
                "exit assistance",
                "resilience",
            ),
        ),
    ]
    domains = [domain for domain, tokens in patterns if any(token in haystack for token in tokens)]
    return domains or ["general"]


def build_retrieval_query(case_facts: Dict[str, Any], missing_evidence: Sequence[str], risk_domains: Sequence[str]) -> str:
    parts = [
        case_facts.get("supplier"),
        case_facts.get("workflow"),
        case_facts.get("geography"),
        case_facts.get("aiUse"),
        " ".join(str(item) for item in case_facts.get("dataCategories", []) if item),
        " ".join(str(item) for item in risk_domains if item),
        " ".join(str(item) for item in missing_evidence if item),
        "DPA subprocessors retention deletion SOC 2 ISO access encryption model training exclusion human oversight cross-border transfer",
    ]
    return _snippet(" ".join(_clean(part) for part in parts if _clean(part)), 1400)


def _score_terms(query: str, text: str) -> float:
    query_terms = {term for term in re.findall(r"[a-z0-9][a-z0-9-]{2,}", query.lower())}
    text_lower = text.lower()
    if not query_terms or not text_lower:
        return 0.0
    matched = sum(1 for term in query_terms if term in text_lower)
    density = matched / max(1, len(query_terms))
    domain_boost = 0.08 if any(term in text_lower for term in ("dpa", "soc", "subprocessor", "training", "retention")) else 0.0
    return round(min(0.99, density + domain_boost), 4)


def _sanitize_match(payload: Dict[str, Any], score: float) -> Dict[str, Any]:
    return {
        "score": round(float(score), 4),
        "snippet": _snippet(payload.get("snippet")),
        "title": _snippet(payload.get("title"), 180),
        "documentId": _clean(payload.get("documentId")),
        "evidenceId": _clean(payload.get("evidenceId")),
        "chunkIndex": int(payload.get("chunkIndex") or 0),
        "domains": [str(item) for item in payload.get("domains", []) if str(item).strip()][:6],
        "source": _clean(payload.get("source")),
    }


def _valid_scope(case_id: str, workspace_id: str, project_id: str) -> bool:
    return all(_clean(value) for value in (case_id, workspace_id, project_id))


def _evidence_point_id(payload: Dict[str, Any]) -> str:
    """Return a stable ID that cannot collide across tenant namespaces."""

    identity = [
        _clean(payload.get("workspaceId")),
        _clean(payload.get("projectId")),
        _clean(payload.get("caseId")),
        _clean(payload.get("documentId")),
        _clean(payload.get("evidenceId")),
        int(payload.get("chunkIndex") or 0),
    ]
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"evidence:{json.dumps(identity, separators=(',', ':'))}"))


class LocalEvidenceMemory:
    provider = "local-fallback"
    durable = False
    configured = False

    def __init__(self) -> None:
        self.chunks: List[EvidenceChunk] = []
        self.collection = DEFAULT_COLLECTION

    def status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "qdrantConfigured": False,
            "collection": self.collection,
            "durable": False,
            "embeddingsModel": embedding_model_from_env(),
            "browserEmbeddingsRetained": False,
        }

    def index(self, chunks: Sequence[EvidenceChunk]) -> Dict[str, Any]:
        if any(not _valid_scope(chunk.case_id, chunk.workspace_id, chunk.project_id) for chunk in chunks):
            return {
                "provider": self.provider,
                "configured": False,
                "durable": False,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "error_type": "invalid_scope",
                "browserEmbeddingsRetained": False,
            }
        self.chunks = list(chunks)
        return {
            "provider": self.provider,
            "configured": False,
            "durable": False,
            "collection": self.collection,
            "indexedChunkCount": len(self.chunks),
            "browserEmbeddingsRetained": False,
        }

    def search(
        self,
        query: str,
        *,
        case_id: str,
        workspace_id: str = "",
        project_id: str = "",
        limit: int = 8,
        allow_workspace_fallback: bool = False,
    ) -> Dict[str, Any]:
        del allow_workspace_fallback
        if not _valid_scope(case_id, workspace_id, project_id):
            return {
                "provider": self.provider,
                "configured": False,
                "durable": False,
                "collection": self.collection,
                "indexedChunkCount": len(self.chunks),
                "matches": [],
                "error_type": "invalid_scope",
                "browserEmbeddingsRetained": False,
            }
        scored: List[Tuple[float, EvidenceChunk]] = []
        for chunk in self.chunks:
            if (
                chunk.case_id != case_id
                or chunk.workspace_id != workspace_id
                or chunk.project_id != project_id
            ):
                continue
            text = f"{chunk.title} {chunk.snippet} {' '.join(chunk.domains)} {' '.join(chunk.tags)}"
            score = _score_terms(query, text)
            if score > 0:
                scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        matches = [_sanitize_match(chunk.payload(), score) for score, chunk in scored[:limit]]
        return {
            "provider": self.provider,
            "configured": False,
            "durable": False,
            "collection": self.collection,
            "indexedChunkCount": len(self.chunks),
            "matches": matches,
            "browserEmbeddingsRetained": False,
        }


class QdrantEvidenceMemory:
    provider = "qdrant"
    durable = True

    def __init__(
        self,
        *,
        compass_client: Optional[CompassClient] = None,
        client: Any = None,
        collection: Optional[str] = None,
        vector_size: Optional[int] = None,
    ) -> None:
        self.compass = compass_client or CompassClient()
        self.collection = collection or os.environ.get("QDRANT_COLLECTION") or DEFAULT_COLLECTION
        self.vector_size = int(vector_size or _int_env("QDRANT_VECTOR_SIZE", DEFAULT_VECTOR_SIZE))
        self._client = client
        self.configured = qdrant_provider_requested() and qdrant_env_present()

    def status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "qdrantConfigured": bool(self.configured),
            "collection": self.collection,
            "durable": True,
            "embeddingsModel": embedding_model_from_env(),
            "browserEmbeddingsRetained": False,
        }

    def _qdrant_imports(self) -> Dict[str, Any]:
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, PointStruct, VectorParams

            return {
                "QdrantClient": QdrantClient,
                "Distance": Distance,
                "FieldCondition": FieldCondition,
                "Filter": Filter,
                "MatchValue": MatchValue,
                "PointStruct": PointStruct,
                "VectorParams": VectorParams,
            }
        except Exception as exc:
            return {"error": exc}

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        imports = self._qdrant_imports()
        if imports.get("error"):
            raise RuntimeError(f"qdrant_client_unavailable:{imports['error'].__class__.__name__}")
        self._client = imports["QdrantClient"](
            url=os.environ.get("QDRANT_URL"),
            api_key=os.environ.get("QDRANT_API_KEY") or None,
            timeout=30,
        )
        return self._client

    def ensure_collection(self) -> Dict[str, Any]:
        imports = self._qdrant_imports()
        if imports.get("error") and self._client is None:
            return {"ok": False, "error_type": "qdrant_client_unavailable", "message": imports["error"].__class__.__name__}
        try:
            client = self._get_client()
            exists = False
            if hasattr(client, "collection_exists"):
                exists = bool(client.collection_exists(self.collection))
            else:
                try:
                    client.get_collection(self.collection)
                    exists = True
                except Exception:
                    exists = False
            if not exists:
                VectorParams = imports.get("VectorParams")
                Distance = imports.get("Distance")
                vectors_config = VectorParams(size=self.vector_size, distance=Distance.COSINE) if VectorParams and Distance else {"size": self.vector_size, "distance": "Cosine"}
                client.create_collection(collection_name=self.collection, vectors_config=vectors_config)
            return {"ok": True, "collection": self.collection}
        except Exception as exc:
            return {"ok": False, "error_type": "qdrant_collection_error", "message": exc.__class__.__name__}

    def _filter(self, *, case_id: str, workspace_id: str, project_id: str) -> Any:
        imports = self._qdrant_imports()
        if imports.get("error"):
            return None
        return imports["Filter"](
            must=[
                imports["FieldCondition"](key="type", match=imports["MatchValue"](value="evidence_chunk")),
                imports["FieldCondition"](key="workspaceId", match=imports["MatchValue"](value=workspace_id)),
                imports["FieldCondition"](key="projectId", match=imports["MatchValue"](value=project_id)),
                imports["FieldCondition"](key="caseId", match=imports["MatchValue"](value=case_id)),
            ]
        )

    def index(self, chunks: Sequence[EvidenceChunk]) -> Dict[str, Any]:
        if not self.configured:
            return {
                "provider": self.provider,
                "configured": False,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "error_type": "qdrant_not_configured",
                "browserEmbeddingsRetained": False,
            }
        if not chunks:
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "browserEmbeddingsRetained": False,
            }
        if any(not _valid_scope(chunk.case_id, chunk.workspace_id, chunk.project_id) for chunk in chunks):
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "error_type": "invalid_scope",
                "browserEmbeddingsRetained": False,
            }
        collection_result = self.ensure_collection()
        if not collection_result.get("ok"):
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "error_type": collection_result.get("error_type", "qdrant_collection_error"),
                "message": _snippet(collection_result.get("message")),
                "browserEmbeddingsRetained": False,
            }
        embedding_result = self.compass.embed_texts([chunk.snippet for chunk in chunks])
        if not embedding_result.get("ok"):
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "error_type": embedding_result.get("error_type", "embedding_unavailable"),
                "message": _snippet(embedding_result.get("message")),
                "browserEmbeddingsRetained": False,
            }

        embeddings = embedding_result.get("embeddings") or []
        imports = self._qdrant_imports()
        PointStruct = imports.get("PointStruct")
        points = []
        for chunk, vector in zip(chunks, embeddings):
            payload = chunk.payload()
            point_id = _evidence_point_id(payload)
            if PointStruct:
                points.append(PointStruct(id=point_id, vector=vector, payload=payload))
            else:
                points.append({"id": point_id, "vector": vector, "payload": payload})
        try:
            self._get_client().upsert(collection_name=self.collection, points=points)
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": len(points),
                "browserEmbeddingsRetained": False,
            }
        except Exception as exc:
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "error_type": "qdrant_upsert_error",
                "message": exc.__class__.__name__,
                "browserEmbeddingsRetained": False,
            }

    def search(
        self,
        query: str,
        *,
        case_id: str,
        workspace_id: str = "",
        project_id: str = "",
        limit: int = 8,
        allow_workspace_fallback: bool = False,
    ) -> Dict[str, Any]:
        del allow_workspace_fallback
        if not _valid_scope(case_id, workspace_id, project_id):
            return {
                "provider": self.provider,
                "configured": bool(self.configured),
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "matches": [],
                "error_type": "invalid_scope",
                "browserEmbeddingsRetained": False,
            }
        if not self.configured:
            return {
                "provider": self.provider,
                "configured": False,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "matches": [],
                "error_type": "qdrant_not_configured",
                "browserEmbeddingsRetained": False,
            }
        embedding_result = self.compass.embed_texts([query])
        if not embedding_result.get("ok"):
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "matches": [],
                "error_type": embedding_result.get("error_type", "embedding_unavailable"),
                "message": _snippet(embedding_result.get("message")),
                "browserEmbeddingsRetained": False,
            }
        query_vector = (embedding_result.get("embeddings") or [[]])[0]
        try:
            client = self._get_client()
            query_filter = self._filter(
                case_id=case_id,
                workspace_id=workspace_id,
                project_id=project_id,
            )
            if hasattr(client, "search"):
                raw_hits = client.search(
                    collection_name=self.collection,
                    query_vector=query_vector,
                    query_filter=query_filter,
                    limit=limit,
                    with_payload=True,
                )
            else:
                response = client.query_points(
                    collection_name=self.collection,
                    query=query_vector,
                    query_filter=query_filter,
                    limit=limit,
                    with_payload=True,
                )
                raw_hits = getattr(response, "points", response)
            matches = []
            for hit in raw_hits or []:
                payload = getattr(hit, "payload", None) or (hit.get("payload") if isinstance(hit, dict) else {}) or {}
                if (
                    _clean(payload.get("caseId")) != case_id
                    or _clean(payload.get("workspaceId")) != workspace_id
                    or _clean(payload.get("projectId")) != project_id
                ):
                    continue
                score = getattr(hit, "score", None)
                if score is None and isinstance(hit, dict):
                    score = hit.get("score", 0)
                matches.append(_sanitize_match(payload, float(score or 0)))
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "matches": matches,
                "browserEmbeddingsRetained": False,
            }
        except Exception as exc:
            return {
                "provider": self.provider,
                "configured": True,
                "durable": True,
                "collection": self.collection,
                "indexedChunkCount": 0,
                "matches": [],
                "error_type": "qdrant_search_error",
                "message": exc.__class__.__name__,
                "browserEmbeddingsRetained": False,
            }


def get_evidence_memory_provider(compass_client: Optional[CompassClient] = None) -> Any:
    if qdrant_provider_requested() and qdrant_env_present():
        provider = QdrantEvidenceMemory(compass_client=compass_client)
        imports = provider._qdrant_imports()
        if not imports.get("error"):
            return provider
    return LocalEvidenceMemory()


def evidence_memory_status() -> Dict[str, Any]:
    provider = get_evidence_memory_provider()
    return provider.status()


def chunks_from_evidence_items(
    evidence_items: Iterable[Dict[str, Any]],
    *,
    case_id: str,
    workspace_id: str = "",
    project_id: str = "",
    chunk_size: Optional[int] = None,
    overlap: Optional[int] = None,
) -> List[EvidenceChunk]:
    case_id = _clean(case_id)
    workspace_id = _clean(workspace_id)
    project_id = _clean(project_id)
    if not _valid_scope(case_id, workspace_id, project_id):
        return []
    chunks: List[EvidenceChunk] = []
    for item_index, item in enumerate(evidence_items):
        text = _first_present(item, "text", "content", "body", "snippet", "description")
        if not text:
            continue
        document_id = _first_present(item, "documentId", "document_id", "id", "name") or f"doc-{item_index + 1}"
        evidence_id = _first_present(item, "evidenceId", "evidence_id", "id", "citationId") or f"ev-{item_index + 1}"
        title = _first_present(item, "title", "name", "source") or "Input evidence"
        source = _first_present(item, "source") or "input"
        tags = [str(tag) for tag in item.get("tags", []) if str(tag).strip()] if isinstance(item.get("tags"), list) else []
        for chunk_index, chunk in enumerate(chunk_text(text, chunk_size, overlap)):
            chunks.append(
                EvidenceChunk(
                    case_id=case_id,
                    workspace_id=workspace_id,
                    project_id=project_id,
                    document_id=document_id,
                    evidence_id=evidence_id,
                    title=title,
                    source=source,
                    chunk_index=chunk_index,
                    snippet=chunk,
                    domains=classify_evidence_domains(f"{title} {chunk}"),
                    tags=tags,
                )
            )
    return chunks


def _first_present(item: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = item.get(key)
        if _clean(value):
            return _clean(value)
    return ""
