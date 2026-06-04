"""Per-run JSONL trace logging with stdout mirroring."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parents[1]
SENSITIVE_KEY_RE = re.compile(r"(api[_-]?key|token|secret|password|authorization|bearer)", re.I)
RUN_ID_RE = re.compile(r"[^A-Za-z0-9_.-]+")
SAFE_STATUS_KEYS = {
    "api_key_configured",
    "base_url_configured",
    "secrets_required",
    "secrets_required_for_dry_run",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def safe_run_id(value: Optional[str]) -> str:
    cleaned = RUN_ID_RE.sub("-", str(value or "").strip()).strip(".-")
    return cleaned[:96] or f"eval-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"


def _sensitive_env_values() -> List[str]:
    values: List[str] = []
    for key, value in os.environ.items():
        if value and len(value) >= 8 and SENSITIVE_KEY_RE.search(key):
            values.append(value)
    return values


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: Dict[str, Any] = {}
        for key, item in value.items():
            normalized_key = str(key).lower()
            is_safe_status = normalized_key in SAFE_STATUS_KEYS or (
                normalized_key.endswith("_configured") and isinstance(item, bool)
            )
            if SENSITIVE_KEY_RE.search(str(key)) and not is_safe_status:
                redacted[str(key)] = "[redacted]"
            else:
                redacted[str(key)] = redact(item)
        return redacted
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, str):
        text = value
        for secret in _sensitive_env_values():
            text = text.replace(secret, "[redacted]")
        text = re.sub(r"(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{12,}", "[redacted]", text)
        text = re.sub(r"Bearer\s+[A-Za-z0-9._~+/=-]{12,}", "Bearer [redacted]", text, flags=re.I)
        return text
    return value


class TraceLogger:
    def __init__(self, run_id: str, trace_id: str, log_dir: Optional[str] = None) -> None:
        self.run_id = safe_run_id(run_id)
        self.trace_id = trace_id
        requested_dir = Path(log_dir or os.environ.get("LOG_DIR", "./logs"))
        self.log_dir = requested_dir if requested_dir.is_absolute() else ROOT / requested_dir
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.relative_log_file = f"logs/trace-{self.run_id}.jsonl"
        self.path = self.log_dir / f"trace-{self.run_id}.jsonl"
        self.events: List[Dict[str, Any]] = []
        self.path.write_text("", encoding="utf-8")

    def log(
        self,
        *,
        agent_name: str,
        action: str,
        input_summary: str = "",
        output_summary: str = "",
        target_agent: str = "",
        confidence: float = 0.0,
        retry_count: int = 0,
        status: str = "success",
        tool_used: str = "",
        memory_key: str = "",
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        event = {
            "timestamp": utc_now(),
            "trace_id": self.trace_id,
            "run_id": self.run_id,
            "agent_name": agent_name,
            "action": action,
            "input_summary": input_summary,
            "output_summary": output_summary,
            "target_agent": target_agent,
            "confidence": round(float(confidence or 0), 3),
            "retry_count": int(retry_count or 0),
            "status": status,
            "tool_used": tool_used,
            "memory_key": memory_key,
            "payload": redact(payload or {}),
        }
        event = redact(event)
        self.events.append(event)
        line = json.dumps(event, ensure_ascii=True, separators=(",", ":"))
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(f"{line}\n")
        print(line, flush=True)
        return event
