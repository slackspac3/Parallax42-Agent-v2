"""Subprocess bridge to the existing Node compliance engine."""

from __future__ import annotations

import json
import math
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

from .trace_logger import redact


ROOT = Path(__file__).resolve().parents[1]
BRIDGE_SCRIPT = ROOT / "scripts" / "agentathon_run.js"
DEFAULT_TIMEOUT_SECONDS = 120.0
MAX_TIMEOUT_SECONDS = 300.0
NODE_DECISION_STATUSES = {"ready", "conditionally_ready", "not_ready"}


def _node_contract_failures(payload: Dict[str, Any]) -> list[str]:
    """Return missing or inconsistent authoritative Node policy fields."""

    failures: list[str] = []
    decision = payload.get("decision") if isinstance(payload.get("decision"), dict) else None
    readiness = payload.get("decision_readiness") if isinstance(payload.get("decision_readiness"), dict) else None
    status = decision.get("status") if decision else None
    if status not in NODE_DECISION_STATUSES:
        failures.append("decision.status")
    if not isinstance(payload.get("risk_level"), str) or not payload.get("risk_level", "").strip():
        failures.append("risk_level")
    for field in ("gaps", "required_actions", "control_plan"):
        if not isinstance(payload.get(field), list):
            failures.append(field)
    if readiness is None:
        failures.append("decision_readiness")
    else:
        if not isinstance(readiness.get("approvalEligible"), bool):
            failures.append("decision_readiness.approvalEligible")
        if not isinstance(readiness.get("humanApprovalRequired"), bool):
            failures.append("decision_readiness.humanApprovalRequired")
        if readiness.get("status") != status:
            failures.append("decision_readiness.status")
        if isinstance(readiness.get("approvalEligible"), bool) and readiness.get("approvalEligible") != (status == "ready"):
            failures.append("decision_readiness.approvalEligible_consistency")
    return failures


def _timeout_seconds(request_options: Optional[Dict[str, Any]] = None) -> float:
    configured = os.environ.get("MAX_RUNTIME_SECONDS", str(int(DEFAULT_TIMEOUT_SECONDS)))
    try:
        value = float(configured)
    except (TypeError, ValueError):
        value = DEFAULT_TIMEOUT_SECONDS
    if not math.isfinite(value):
        value = DEFAULT_TIMEOUT_SECONDS
    if request_options and request_options.get("timeout_seconds"):
        try:
            requested = float(request_options["timeout_seconds"])
            if math.isfinite(requested):
                value = min(value, requested)
        except (TypeError, ValueError):
            pass
    return max(1.0, min(value, MAX_TIMEOUT_SECONDS))


def run_node_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    timeout = _timeout_seconds(payload.get("options") if isinstance(payload.get("options"), dict) else None)
    env = os.environ.copy()
    env.setdefault("AGENT_MODE", "local_deterministic")
    env.setdefault("AGENT_RUNTIME", "crewai_dry_run")
    env.setdefault("CREWAI_ENABLE_LIVE_LLM", "0")
    env.setdefault("P42_SKIP_LOCAL_ENV", "1")

    try:
        completed = subprocess.run(
            ["node", str(BRIDGE_SCRIPT)],
            cwd=str(ROOT),
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            timeout=timeout,
            env=env,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "error": {
                "type": "node_bridge_timeout",
                "message": f"Node bridge exceeded {timeout:.0f} seconds.",
                "recoverable": True,
            },
        }
    except FileNotFoundError:
        return {
            "ok": False,
            "error": {
                "type": "node_unavailable",
                "message": "Node.js is not available in this environment.",
                "recoverable": True,
            },
        }
    except Exception as exc:  # pragma: no cover - defensive boundary
        return {
            "ok": False,
            "error": {
                "type": "node_bridge_failed",
                "message": str(redact(str(exc))),
                "recoverable": True,
            },
        }

    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()
    parsed: Dict[str, Any]
    try:
        parsed = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError:
        parsed = {}

    if completed.returncode != 0:
        return {
            "ok": False,
            "error": {
                "type": "node_bridge_exit",
                "message": (parsed.get("error", {}) or {}).get("message")
                or redact(stderr[:600])
                or f"Node bridge exited with code {completed.returncode}.",
                "recoverable": True,
            },
            "node": parsed if parsed else None,
        }

    if not parsed:
        return {
            "ok": False,
            "error": {
                "type": "node_bridge_invalid_json",
                "message": "Node bridge did not return valid JSON.",
                "recoverable": True,
            },
            "stderr": redact(stderr[:600]),
        }

    if parsed.get("ok") is True:
        failures = _node_contract_failures(parsed)
        if failures:
            return {
                "ok": False,
                "error": {
                    "type": "node_bridge_contract_invalid",
                    "message": "Node bridge returned an incomplete or inconsistent policy contract.",
                    "recoverable": False,
                    "fields": failures,
                },
            }

    return redact(parsed)
