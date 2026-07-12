"""FastAPI API surface expected by the Agentathon evaluator."""

from __future__ import annotations

import json
import os
import shutil
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from .agentathon_orchestrator import AgentathonOrchestrator, USE_CASE_ID
from .auth import AuthContext, request_auth_context, require_audit_reader, require_learning_reviewer
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


def _sample_mode_enabled() -> bool:
    return os.environ.get("SAMPLE_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}


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
async def learning_feedback(
    payload: Dict[str, Any],
    context: AuthContext = Depends(require_learning_reviewer),
) -> Dict[str, Any]:
    result = store_feedback(
        payload,
        workspace_id=context.workspace_id,
        project_id=context.project_id,
        actor=context.actor(),
        sample_mode=_sample_mode_enabled(),
    )
    return redact({"ok": bool(result.get("stored")), "auth": {"mode": context.mode}, "result": result})


@app.post("/learning/similar-cases")
async def learning_similar_cases(
    payload: Dict[str, Any],
    context: AuthContext = Depends(request_auth_context),
) -> Dict[str, Any]:
    case_facts = payload.get("caseFacts") if isinstance(payload.get("caseFacts"), dict) else payload.get("case") if isinstance(payload.get("case"), dict) else {}
    missing = payload.get("missingEvidence") if isinstance(payload.get("missingEvidence"), list) else []
    domains = payload.get("domains") if isinstance(payload.get("domains"), list) else []
    result = find_similar_cases(
        case_facts,
        missing,
        domains,
        limit=max(1, min(int(payload.get("limit") or 5), 25)),
        workspace_id=context.workspace_id,
        project_id=context.project_id,
        sample_mode=_sample_mode_enabled(),
    )
    return redact({"ok": True, "auth": {"mode": context.mode}, "result": result})


@app.post("/learning/control-suggestions")
async def learning_control_suggestions(
    payload: Dict[str, Any],
    context: AuthContext = Depends(request_auth_context),
) -> Dict[str, Any]:
    case_facts = payload.get("caseFacts") if isinstance(payload.get("caseFacts"), dict) else payload.get("case") if isinstance(payload.get("case"), dict) else {}
    missing = payload.get("missingEvidence") if isinstance(payload.get("missingEvidence"), list) else []
    domains = payload.get("domains") if isinstance(payload.get("domains"), list) else []
    result = get_control_suggestions(
        case_facts,
        missing,
        domains,
        limit=max(1, min(int(payload.get("limit") or 8), 25)),
        workspace_id=context.workspace_id,
        project_id=context.project_id,
        sample_mode=_sample_mode_enabled(),
    )
    return redact({"ok": True, "auth": {"mode": context.mode}, "result": result})


@app.get("/logs")
async def logs(
    _context: AuthContext = Depends(require_audit_reader),
) -> JSONResponse:
    return JSONResponse(
        content={"ok": True, "entries": [], "detail": "Detailed trace records are not exposed over HTTP."},
        headers={"Cache-Control": "private, no-store"},
    )


@app.get("/compass/probe")
async def compass_probe() -> Dict[str, Any]:
    return redact(compass.probe())


@app.post("/run", response_model=AgentathonRunResponse)
async def run(
    request: AgentathonRunRequest,
    context: AuthContext = Depends(request_auth_context),
):
    response = await run_in_threadpool(orchestrator.run, request, context.scope())
    if response.get("status") == "error":
        return JSONResponse(status_code=502, content=redact(response))
    return redact(response)
