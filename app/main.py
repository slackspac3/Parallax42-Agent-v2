"""FastAPI API surface expected by the Agentathon evaluator."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .agentathon_orchestrator import AgentathonOrchestrator, USE_CASE_ID
from .compass_client import CompassClient
from .crewai_runtime import crewai_runtime_status
from .evidence_memory import evidence_memory_status
from .learning_memory import find_similar_cases, get_control_suggestions, learning_memory_status, store_feedback
from .schemas import AgentathonRunRequest, AgentathonRunResponse
from .trace_logger import ROOT, redact


load_dotenv(ROOT / ".env", override=False)
load_dotenv(ROOT / ".env.local", override=False)

app = FastAPI(
    title="Parallax42 Agentathon Wrapper",
    version="1.0.0",
    description="Evaluator-facing FastAPI wrapper for the existing Node compliance agent.",
)
orchestrator = AgentathonOrchestrator()
compass = CompassClient()


def _log_dir() -> Path:
    requested = Path(os.environ.get("LOG_DIR", "./logs"))
    path = requested if requested.is_absolute() else ROOT / requested
    path.mkdir(parents=True, exist_ok=True)
    return path


def _metadata() -> Dict[str, Any]:
    try:
        return json.loads((ROOT / "metadata.json").read_text(encoding="utf-8"))
    except Exception as exc:
        return {
            "name": "Parallax42 Compliance Intelligence Agent",
            "use_case_id": USE_CASE_ID,
            "entrypoint": "run.py",
            "metadata_error": exc.__class__.__name__,
        }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": {
                "type": "validation_error",
                "message": "Request body did not match the Agentathon /run schema.",
                "details": redact(exc.errors()),
            },
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(_request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": {
                "type": exc.__class__.__name__,
                "message": "Unexpected server error. See the structured trace log for run-level details.",
                "recoverable": True,
            },
        },
    )


@app.get("/health")
async def health() -> Dict[str, Any]:
    crewai_status = crewai_runtime_status()
    return {
        "ok": True,
        "service": "parallax42-agentathon-wrapper",
        "use_case_id": USE_CASE_ID,
        "runtime": "fastapi_node_bridge",
        "host": "0.0.0.0",
        "port": int(os.environ.get("PORT", "8000")),
        "node_available": bool(shutil.which("node")),
        "log_dir": "logs",
        "live_crewai": bool(crewai_status.get("enabled")),
        "crewai_runtime": crewai_status,
        "rbac_enforced": os.environ.get("P42_AUTH_MODE", "audit") == "enforced",
        "evidence_memory": evidence_memory_status(),
        "learning_memory": learning_memory_status(),
    }


@app.get("/metadata")
async def metadata() -> Dict[str, Any]:
    payload = _metadata()
    payload["evidence_memory"] = evidence_memory_status()
    payload["learning_memory"] = learning_memory_status()
    payload["crewai_runtime"] = crewai_runtime_status()
    return redact(payload)


@app.get("/evidence/memory/status")
async def evidence_memory_status_endpoint() -> Dict[str, Any]:
    return redact({"ok": True, "evidence_memory": evidence_memory_status()})


@app.get("/learning/memory/status")
async def learning_memory_status_endpoint() -> Dict[str, Any]:
    return redact({"ok": True, "learning_memory": learning_memory_status()})


@app.post("/learning/feedback")
async def learning_feedback(payload: Dict[str, Any]) -> Dict[str, Any]:
    result = store_feedback(payload)
    return redact({"ok": bool(result.get("stored")), "auth": {"mode": os.environ.get("P42_AUTH_MODE", "audit")}, "result": result})


@app.post("/learning/similar-cases")
async def learning_similar_cases(payload: Dict[str, Any]) -> Dict[str, Any]:
    case_facts = payload.get("caseFacts") if isinstance(payload.get("caseFacts"), dict) else payload.get("case") if isinstance(payload.get("case"), dict) else {}
    missing = payload.get("missingEvidence") if isinstance(payload.get("missingEvidence"), list) else []
    domains = payload.get("domains") if isinstance(payload.get("domains"), list) else []
    result = find_similar_cases(case_facts, missing, domains, limit=int(payload.get("limit") or 5))
    return redact({"ok": True, "auth": {"mode": os.environ.get("P42_AUTH_MODE", "audit")}, "result": result})


@app.post("/learning/control-suggestions")
async def learning_control_suggestions(payload: Dict[str, Any]) -> Dict[str, Any]:
    case_facts = payload.get("caseFacts") if isinstance(payload.get("caseFacts"), dict) else payload.get("case") if isinstance(payload.get("case"), dict) else {}
    missing = payload.get("missingEvidence") if isinstance(payload.get("missingEvidence"), list) else []
    domains = payload.get("domains") if isinstance(payload.get("domains"), list) else []
    result = get_control_suggestions(case_facts, missing, domains, limit=int(payload.get("limit") or 8))
    return redact({"ok": True, "auth": {"mode": os.environ.get("P42_AUTH_MODE", "audit")}, "result": result})


@app.get("/logs")
async def logs() -> Dict[str, Any]:
    entries = []
    for path in sorted(_log_dir().glob("*.jsonl"), key=lambda item: item.stat().st_mtime, reverse=True)[:25]:
        entries.append(
            {
                "file": f"logs/{path.name}",
                "bytes": path.stat().st_size,
                "modified_epoch_seconds": int(path.stat().st_mtime),
            }
        )
    return {"ok": True, "log_dir": "logs", "entries": entries}


@app.get("/compass/probe")
async def compass_probe() -> Dict[str, Any]:
    return redact(compass.probe())


@app.post("/run", response_model=AgentathonRunResponse)
async def run(request: AgentathonRunRequest):
    response = orchestrator.run(request)
    if response.get("status") == "error":
        return JSONResponse(status_code=502, content=redact(response))
    return redact(response)
