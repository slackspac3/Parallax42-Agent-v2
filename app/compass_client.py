"""Compass/OpenAI-compatible advisory client."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx

from .trace_logger import redact


DEFAULT_BASE_URL = "https://compass.core42.ai/v1"
DEFAULT_FAST_MODEL = "gpt-4.1"
DEFAULT_REASONING_MODEL = "gpt-5.1"


def truthy(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


class CompassClient:
    def __init__(self, timeout_seconds: float = 25, retries: int = 1) -> None:
        self.timeout_seconds = timeout_seconds
        self.retries = max(0, int(retries))

    @property
    def base_url(self) -> str:
        return (os.environ.get("OPENAI_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")

    @property
    def api_key(self) -> str:
        return os.environ.get("OPENAI_API_KEY") or ""

    def model_fast(self) -> str:
        return (
            os.environ.get("MODEL_FAST")
            or os.environ.get("COMPASS_CHAT_MODEL")
            or os.environ.get("AGENT_MODEL")
            or DEFAULT_FAST_MODEL
        )

    def model_reasoning(self) -> str:
        return (
            os.environ.get("MODEL_REASONING")
            or os.environ.get("COMPASS_REASONING_MODEL")
            or os.environ.get("REASONING_MODEL")
            or DEFAULT_REASONING_MODEL
        )

    def configured(self) -> bool:
        return bool(self.api_key and self.base_url)

    def unavailable(self, error_type: str, message: str, *, model: Optional[str] = None, attempts: int = 0) -> Dict[str, Any]:
        return {
            "ok": False,
            "status": "unavailable",
            "model": model or self.model_reasoning(),
            "attempts": attempts,
            "error_type": error_type,
            "message": _clean(str(redact(message)))[:400],
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
                "rationale": "Compass advisory was unavailable; deterministic policy remains final authority.",
            },
        }

    def probe(self) -> Dict[str, Any]:
        live_probe = truthy(os.environ.get("COMPASS_PROBE_LIVE", "0"))
        result: Dict[str, Any] = {
            "ok": True,
            "provider": "openai_compatible_compass",
            "base_url_configured": bool(self.base_url),
            "base_url_host": urlparse(self.base_url).netloc or "unconfigured",
            "api_key_configured": bool(self.api_key),
            "chat_model": self.model_fast(),
            "reasoning_model": self.model_reasoning(),
            "live_call_performed": False,
            "live_llm_enabled": truthy(os.environ.get("CREWAI_ENABLE_LIVE_LLM", "0")),
            "sample_mode": truthy(os.environ.get("SAMPLE_MODE", "false")),
        }
        if not live_probe:
            result["message"] = "Configuration-only probe; set COMPASS_PROBE_LIVE=1 to verify /models."
            return result
        if not self.api_key:
            result.update({"ok": False, "message": "OPENAI_API_KEY is not configured."})
            return result
        try:
            response = httpx.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=self.timeout_seconds,
            )
            result["live_call_performed"] = True
            result["status_code"] = response.status_code
            try:
                response.json()
                result["ok"] = 200 <= response.status_code < 300
                result["message"] = "Compass /models probe returned JSON without exposing credentials."
            except ValueError:
                result["ok"] = False
                result["message"] = "Compass /models probe returned a non-JSON response."
        except Exception as exc:  # pragma: no cover - network optional
            result.update(
                {
                    "ok": False,
                    "live_call_performed": True,
                    "message": f"Compass probe failed: {exc.__class__.__name__}",
                }
            )
        return redact(result)

    def compass_chat_json(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        schema_hint: str = "",
        max_tokens: int = 900,
    ) -> Dict[str, Any]:
        selected_model = model or self.model_reasoning()
        if not self.api_key:
            return self.unavailable("missing_api_key", "OPENAI_API_KEY is not configured.", model=selected_model)

        strict_messages = [
            {
                "role": "system",
                "content": (
                    "Return strict JSON only. Do not include markdown. "
                    "Never claim final decision authority; you are advisory only."
                ),
            },
            *messages,
        ]
        if schema_hint:
            strict_messages.append({"role": "system", "content": f"JSON schema hint: {schema_hint}"})

        last_error = ""
        attempts = 0
        repair_attempted = False
        for attempt in range(self.retries + 1):
            attempts += 1
            try:
                body = {
                    "model": selected_model,
                    "messages": strict_messages,
                    "temperature": 0,
                    "max_tokens": max_tokens,
                    "response_format": {"type": "json_object"},
                }
                response = httpx.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                try:
                    response_json = response.json()
                except ValueError:
                    last_error = "non_json_response"
                    if attempt < self.retries:
                        continue
                    break
                content = self._extract_content(response_json)
                parsed = self._parse_json(content)
                if parsed is not None:
                    advisory = self._normalize_advisory(parsed)
                    return {
                        "ok": True,
                        "status": "available",
                        "model": selected_model,
                        "attempts": attempts,
                        "advisory": advisory,
                    }
                last_error = "Compass response was not valid JSON."
                if not repair_attempted:
                    repair_attempted = True
                    strict_messages.append(
                        {
                            "role": "user",
                            "content": (
                                "Repair your prior answer into strict JSON matching the schema. "
                                f"Prior answer prefix: {content[:600]}"
                            ),
                        }
                    )
                    continue
            except httpx.HTTPStatusError as exc:
                last_error = f"HTTP {exc.response.status_code}"
            except Exception as exc:  # pragma: no cover - defensive network boundary
                last_error = exc.__class__.__name__
            if attempt < self.retries:
                continue

        return self.unavailable("compass_chat_failed", last_error or "Compass advisory failed.", model=selected_model, attempts=attempts)

    def _extract_content(self, response_json: Dict[str, Any]) -> str:
        choices = response_json.get("choices") if isinstance(response_json, dict) else None
        if isinstance(choices, list) and choices:
            message = choices[0].get("message") or {}
            content = message.get("content")
            if isinstance(content, list):
                parts = []
                for item in content:
                    if isinstance(item, dict):
                        parts.append(_clean(item.get("text") or item.get("content")))
                    else:
                        parts.append(_clean(item))
                return "\n".join(part for part in parts if part)
            return _clean(content)
        return _clean(response_json.get("output_text") or response_json.get("content") or "")

    def _parse_json(self, content: str) -> Optional[Dict[str, Any]]:
        if not content:
            return None
        try:
            value = json.loads(content)
            return value if isinstance(value, dict) else None
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start >= 0 and end > start:
                try:
                    value = json.loads(content[start : end + 1])
                    return value if isinstance(value, dict) else None
                except json.JSONDecodeError:
                    return None
        return None

    def _normalize_advisory(self, value: Dict[str, Any]) -> Dict[str, Any]:
        def list_of_text(key: str) -> List[str]:
            raw = value.get(key)
            if isinstance(raw, list):
                return [_clean(item) for item in raw if _clean(item)][:8]
            text = _clean(raw)
            return [text] if text else []

        assessment = _clean(value.get("assessment")).lower()
        if assessment not in {"approve", "conditional", "reject", "insufficient_evidence"}:
            assessment = "insufficient_evidence"
        confidence = _clean(value.get("confidence")).lower()
        if confidence not in {"low", "medium", "high"}:
            confidence = "low"
        return redact(
            {
                "specialist": _clean(value.get("specialist")) or "Compass Advisory Critic",
                "advisoryOnly": True,
                "assessment": assessment,
                "strongestEvidence": list_of_text("strongestEvidence"),
                "unresolvedRisks": list_of_text("unresolvedRisks"),
                "reviewerQuestions": list_of_text("reviewerQuestions"),
                "recommendedActions": list_of_text("recommendedActions"),
                "confidence": confidence,
                "rationale": _clean(value.get("rationale"))[:700],
            }
        )
