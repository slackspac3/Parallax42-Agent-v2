"""Small HTTP service for running the optional CrewAI adapter remotely.

The main Parallax42 app is a Node/Vercel application. This service is intended
for a Python-capable backend host, such as the DigitalOcean droplet, so live
CrewAI work can run without requiring Python inside Vercel functions.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from compliance_flow import flow_manifest, load_case_input, run_live_flow, run_live_llm_review  # noqa: E402


MAX_BODY_BYTES = int(os.getenv("P42_CREWAI_SERVICE_MAX_BODY_BYTES", str(2_000_000)))


def clean_text(value: Any = "") -> str:
    return " ".join(str(value or "").split())


def truthy(value: Any = "") -> bool:
    return clean_text(value).lower() in {"1", "true", "yes", "on"}


def service_token() -> str:
    return clean_text(os.getenv("P42_CREWAI_SERVICE_TOKEN") or os.getenv("CREWAI_SERVICE_TOKEN"))


def authorized(headers: Any) -> bool:
    token = service_token()
    if not token:
        return False
    auth = clean_text(headers.get("authorization", ""))
    explicit = clean_text(headers.get("x-p42-crewai-token", ""))
    return auth == f"Bearer {token}" or explicit == token


def safe_llm_config() -> dict[str, Any]:
    return {
        "enabled": truthy(os.getenv("CREWAI_ENABLE_LIVE_LLM")),
        "model": os.getenv("CREWAI_LLM_MODEL") or os.getenv("OPENAI_MODEL_NAME") or os.getenv("MODEL") or "gpt-5.1",
        "base_url_configured": bool(os.getenv("CREWAI_LLM_BASE_URL") or os.getenv("OPENAI_API_BASE") or os.getenv("OPENAI_BASE_URL")),
        "api_key_configured": bool(
            os.getenv("CREWAI_LLM_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or os.getenv("ANTHROPIC_API_KEY")
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("AZURE_API_KEY")
        ),
    }


def dependency_status() -> dict[str, Any]:
    try:
        import crewai  # type: ignore

        return {
            "crewaiInstalled": True,
            "crewaiVersion": getattr(crewai, "__version__", "unknown"),
        }
    except Exception as exc:
        return {
            "crewaiInstalled": False,
            "error": str(exc),
        }


def service_health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "parallax42-crewai-service",
        "framework": "CrewAI",
        "authRequired": True,
        "tokenConfigured": bool(service_token()),
        "dependency": dependency_status(),
        "llm": safe_llm_config(),
        "humanApprovalRequired": True,
        "deterministicDecisionOwner": True,
    }


def read_case_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    case = payload.get("case") or payload.get("caseDraft") or payload.get("input") or payload
    if not isinstance(case, dict):
        raise ValueError("Request body must include a case object.")
    return case


def run_crewai_payload(payload: dict[str, Any]) -> dict[str, Any]:
    mode = clean_text(payload.get("mode") or "live-llm").lower()
    case = read_case_from_payload(payload)
    input_label = clean_text(payload.get("inputLabel") or "remote_http")
    if mode in {"dry-run", "dry_run", "manifest"}:
        return flow_manifest(case, input_label, live_crewai=False)
    if mode in {"live-flow", "live_flow", "flow"}:
        return run_live_flow(case, input_label)
    if mode in {"live-llm", "live_llm", "llm", "crewai_llm"}:
        return run_live_llm_review(case, input_label)
    raise ValueError(f"Unsupported CrewAI service mode: {mode}")


class CrewAIHandler(BaseHTTPRequestHandler):
    server_version = "Parallax42CrewAI/1.0"

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, indent=2, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") == "/health":
            self._send_json(200, service_health())
            return
        self._send_json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/run":
            self._send_json(404, {"ok": False, "error": "not_found"})
            return
        if not authorized(self.headers):
            self._send_json(401, {"ok": False, "error": "unauthorized"})
            return
        try:
            length = int(self.headers.get("content-length") or "0")
            if length > MAX_BODY_BYTES:
                self._send_json(413, {"ok": False, "error": "request_too_large"})
                return
            raw = self.rfile.read(length).decode("utf-8")
            payload = json.loads(raw or "{}")
            result = run_crewai_payload(payload)
            self._send_json(200, {"ok": True, "result": result})
        except Exception as exc:  # pragma: no cover - service safety boundary
            detail = str(exc)
            body: dict[str, Any] = {
                "ok": False,
                "error": "crewai_run_failed",
                "detail": detail,
            }
            if truthy(os.getenv("P42_CREWAI_SERVICE_DEBUG")):
                body["traceback"] = traceback.format_exc()
            self._send_json(500, body)

    def log_message(self, fmt: str, *args: Any) -> None:
        if truthy(os.getenv("P42_CREWAI_SERVICE_ACCESS_LOG")):
            super().log_message(fmt, *args)


def main() -> int:
    host = os.getenv("P42_CREWAI_SERVICE_HOST", "127.0.0.1")
    port = int(os.getenv("P42_CREWAI_SERVICE_PORT", "8010"))
    server = ThreadingHTTPServer((host, port), CrewAIHandler)
    print(f"Parallax42 CrewAI service listening on http://{host}:{port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
