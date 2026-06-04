#!/usr/bin/env python3
"""Smoke-test Agentathon Qdrant evidence memory.

This script indexes and searches one synthetic evidence snippet. It never logs
embeddings or raw API keys.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.compass_client import CompassClient, normalize_openai_base_url  # noqa: E402
from app.evidence_memory import QdrantEvidenceMemory, build_retrieval_query, chunks_from_evidence_items  # noqa: E402
from app.trace_logger import redact  # noqa: E402


def _configured_env() -> Dict[str, Any]:
    provider = os.environ.get("P42_VECTOR_STORE_PROVIDER", "local").strip().lower()
    base_info = normalize_openai_base_url(os.environ.get("OPENAI_BASE_URL"))
    missing = []
    if provider != "qdrant":
        missing.append("P42_VECTOR_STORE_PROVIDER=qdrant")
    if not os.environ.get("QDRANT_URL"):
        missing.append("QDRANT_URL")
    if not os.environ.get("OPENAI_API_KEY"):
        missing.append("OPENAI_API_KEY")
    if not os.environ.get("OPENAI_BASE_URL"):
        missing.append("OPENAI_BASE_URL")
    if not base_info.get("ok"):
        missing.append("valid OPENAI_BASE_URL")
    return {"provider": provider, "base_info": base_info, "missing": missing}


def run_smoke() -> Dict[str, Any]:
    env_status = _configured_env()
    if env_status["missing"]:
        return {
            "status": "SKIPPED",
            "reason": "Missing required env for live Qdrant/Compass embedding smoke: " + ", ".join(env_status["missing"]),
            "provider": env_status["provider"],
            "collection": os.environ.get("QDRANT_COLLECTION", "p42_compliance_evidence"),
            "qdrantConfigured": False,
        }

    case_id = "agentathon-qdrant-smoke"
    evidence = [
        {
            "id": "smoke-evidence-001",
            "title": "Synthetic model-training and subprocessor evidence",
            "text": (
                "The vendor is prohibited from using customer data for model training. "
                "The DPA lists subprocessors and a 30-day deletion SLA."
            ),
            "source": "sample",
            "tags": ["smoke-test", "synthetic"],
        }
    ]
    chunks = chunks_from_evidence_items(evidence, case_id=case_id, workspace_id="agentathon", project_id="qdrant-smoke")
    provider = QdrantEvidenceMemory(compass_client=CompassClient(timeout_seconds=30, retries=1))
    index_result = provider.index(chunks)
    if not index_result.get("indexedChunkCount"):
        return {
            "status": "FAIL",
            "provider": provider.provider,
            "collection": provider.collection,
            "indexedChunkCount": index_result.get("indexedChunkCount", 0),
            "matchCount": 0,
            "error_type": index_result.get("error_type", "qdrant_index_failed"),
            "message": index_result.get("message", "Qdrant index did not write chunks."),
        }

    query = build_retrieval_query(
        {"supplier": "Synthetic Smoke Vendor", "workflow": "model training exclusion and subprocessors"},
        ["model-training exclusion", "subprocessor register"],
        ["privacy", "ai-governance"],
    )
    search_result = provider.search(query, case_id=case_id, workspace_id="agentathon", project_id="qdrant-smoke", limit=3)
    matches = search_result.get("matches") if isinstance(search_result.get("matches"), list) else []
    if not matches:
        return {
            "status": "FAIL",
            "provider": provider.provider,
            "collection": provider.collection,
            "indexedChunkCount": index_result.get("indexedChunkCount", 0),
            "matchCount": 0,
            "error_type": search_result.get("error_type", "qdrant_search_no_matches"),
            "message": search_result.get("message", "Qdrant search returned no matches."),
        }
    return {
        "status": "PASS",
        "provider": provider.provider,
        "collection": provider.collection,
        "indexedChunkCount": index_result.get("indexedChunkCount", 0),
        "matchCount": len(matches),
        "browserEmbeddingsRetained": False,
    }


def print_human(summary: Dict[str, Any]) -> None:
    status = summary.get("status", "FAIL")
    print(f"Provider: {summary.get('provider', 'unknown')}")
    print(f"Collection: {summary.get('collection', '')}")
    if summary.get("reason"):
        print(f"Reason: {summary['reason']}")
    if summary.get("error_type"):
        print(f"Error: {summary.get('error_type')} {summary.get('message', '')}")
    if status == "PASS":
        print(f"Indexed chunks: {summary.get('indexedChunkCount', 0)}")
        print(f"Match count: {summary.get('matchCount', 0)}")
    print(f"QDRANT_SMOKE={status}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke-test Agentathon Qdrant RAG evidence memory.")
    parser.add_argument("--json", action="store_true", help="Emit JSON summary.")
    args = parser.parse_args()
    summary = redact(run_smoke())
    if args.json:
        print(json.dumps({"status": summary.get("status", "FAIL"), "qdrant_smoke": summary}, indent=2, sort_keys=True))
    else:
        print_human(summary)
    status = summary.get("status")
    return 1 if status == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
