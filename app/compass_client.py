"""Compass/OpenAI-compatible advisory client and diagnostics."""

from __future__ import annotations

import json
import os
import socket
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx

from .trace_logger import redact


CURRENT_DOCS_BASE_URL = "https://api.core42.ai/v1"
LEGACY_AGENTATHON_BASE_URL = "https://compass.core42.ai/v1"
DEFAULT_BASE_URL = CURRENT_DOCS_BASE_URL
ACCEPTED_DIRECT_BASE_URLS = {CURRENT_DOCS_BASE_URL, LEGACY_AGENTATHON_BASE_URL}
DEFAULT_FAST_MODEL = "gpt-4.1"
DEFAULT_REASONING_MODEL = "gpt-5.1"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large"
HTML_SNIPPET_LIMIT = 220


def truthy(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _safe_snippet(value: str, limit: int = HTML_SNIPPET_LIMIT) -> str:
    text = _clean(redact(value))
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


def _looks_html(text: str) -> bool:
    prefix = text.lstrip()[:120].lower()
    return prefix.startswith("<!doctype html") or prefix.startswith("<html") or "<html" in prefix


def normalize_openai_base_url(raw_url: Optional[str]) -> Dict[str, Any]:
    """Normalize and classify the OpenAI-compatible Compass base URL.

    Returns a dictionary rather than raising so callers can surface structured
    diagnostics without leaking environment values or crashing the evaluator.
    """

    raw = _clean(raw_url) or DEFAULT_BASE_URL
    normalized = raw.rstrip("/")
    warnings: List[str] = []
    errors: List[str] = []
    parsed = urlparse(normalized)

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return {
            "ok": False,
            "raw": raw,
            "normalized": normalized,
            "host": parsed.netloc,
            "warnings": warnings,
            "errors": ["OPENAI_BASE_URL must be an absolute http(s) URL."],
        }

    host = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    provider_variant = "custom_openai_compatible"
    if host == "api.core42.ai":
        if not path:
            normalized = f"{parsed.scheme}://{parsed.netloc}/v1"
            warnings.append("OPENAI_BASE_URL was normalized to include /v1 for the documented Core42 Compass API.")
        elif path == "/v1":
            normalized = f"{parsed.scheme}://{parsed.netloc}/v1"
        else:
            errors.append("Documented Core42 Compass OPENAI_BASE_URL must be https://api.core42.ai/v1.")
        provider_variant = "core42_docs"
    elif host == "compass.core42.ai":
        if not path:
            normalized = f"{parsed.scheme}://{parsed.netloc}/v1"
            warnings.append("OPENAI_BASE_URL was normalized to include /v1 for the legacy Agentathon Compass host.")
        elif path == "/v1":
            normalized = f"{parsed.scheme}://{parsed.netloc}/v1"
        else:
            errors.append("Legacy Agentathon Compass OPENAI_BASE_URL must be https://compass.core42.ai/v1.")
        warnings.append(
            "https://compass.core42.ai/v1 is treated as a legacy Agentathon prompt-era host. "
            "Current Core42 API documentation points to https://api.core42.ai/v1."
        )
        provider_variant = "legacy_agentathon_prompt"
    elif "g42.genai.works" in host or "academy.genai.works" in host:
        errors.append("OPENAI_BASE_URL points to a GenAI frontend page, not the official Compass OpenAI-compatible /v1 endpoint.")
    elif "vercel.app" in host or "parallax42-compass-gateway" in host:
        warnings.append(
            "OPENAI_BASE_URL appears to be a gateway/frontend URL. The Agentathon wrapper expects the official direct Compass /v1 endpoint unless this URL is explicitly OpenAI-compatible."
        )
        if not path.endswith("/v1"):
            warnings.append("Gateway URL does not end in /v1; verify it exposes /chat/completions and /models directly.")
    elif not path.endswith("/v1"):
        warnings.append("OPENAI_BASE_URL does not end in /v1; verify it is OpenAI-compatible and will not produce /v1/v1 paths.")

    if normalized.endswith("/v1/v1"):
        errors.append("OPENAI_BASE_URL resolves to /v1/v1; remove the duplicate /v1.")

    normalized = normalized.rstrip("/")
    return {
        "ok": not errors,
        "raw": raw,
        "normalized": normalized,
        "host": urlparse(normalized).netloc,
        "official": normalized == CURRENT_DOCS_BASE_URL,
        "accepted_direct": normalized in ACCEPTED_DIRECT_BASE_URLS,
        "provider_variant": provider_variant,
        "warnings": warnings,
        "errors": errors,
    }


def model_fast_from_env() -> str:
    return (
        os.environ.get("MODEL_FAST")
        or os.environ.get("COMPASS_CHAT_MODEL")
        or os.environ.get("AGENT_MODEL")
        or DEFAULT_FAST_MODEL
    )


def model_reasoning_from_env() -> str:
    return (
        os.environ.get("MODEL_REASONING")
        or os.environ.get("COMPASS_REASONING_MODEL")
        or os.environ.get("REASONING_MODEL")
        or DEFAULT_REASONING_MODEL
    )


def embedding_model_from_env() -> str:
    return os.environ.get("EMBEDDING_MODEL") or os.environ.get("COMPASS_EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL


class CompassClient:
    def __init__(self, timeout_seconds: float = 25, retries: int = 1) -> None:
        self.timeout_seconds = timeout_seconds
        self.retries = max(0, int(retries))

    @property
    def base_url_info(self) -> Dict[str, Any]:
        return normalize_openai_base_url(os.environ.get("OPENAI_BASE_URL"))

    @property
    def base_url(self) -> str:
        return str(self.base_url_info["normalized"])

    @property
    def api_key(self) -> str:
        return os.environ.get("OPENAI_API_KEY") or ""

    def model_fast(self) -> str:
        return model_fast_from_env()

    def model_reasoning(self) -> str:
        return model_reasoning_from_env()

    def embedding_model(self) -> str:
        return embedding_model_from_env()

    def configured(self) -> bool:
        return bool(self.api_key and self.base_url_info.get("ok"))

    def unavailable(self, error_type: str, message: str, *, model: Optional[str] = None, attempts: int = 0) -> Dict[str, Any]:
        return {
            "ok": False,
            "status": "unavailable",
            "model": model or self.model_reasoning(),
            "attempts": attempts,
            "error_type": error_type,
            "message": _safe_snippet(message, 400),
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

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }

    def embed_texts(self, texts: List[str], model: Optional[str] = None) -> Dict[str, Any]:
        """Embed texts through the same OpenAI-compatible Compass boundary.

        The returned structure intentionally contains vectors only for
        server-side callers. API responses must not forward the embeddings.
        """

        selected_model = model or self.embedding_model()
        base_info = self.base_url_info
        cleaned_texts = [_clean(text)[:8000] for text in texts if _clean(text)]
        if not cleaned_texts:
            return {
                "ok": True,
                "status": "available",
                "model": selected_model,
                "embeddings": [],
                "count": 0,
            }
        if not base_info.get("ok"):
            return {
                "ok": False,
                "status": "unavailable",
                "model": selected_model,
                "error_type": "invalid_base_url",
                "message": _safe_snippet("; ".join(base_info.get("errors", [])), 400),
                "recoverable": True,
            }
        if not self.api_key:
            return {
                "ok": False,
                "status": "unavailable",
                "model": selected_model,
                "error_type": "missing_api_key",
                "message": "OPENAI_API_KEY is not configured.",
                "recoverable": True,
            }

        last_error = ""
        attempts = 0
        for attempt in range(self.retries + 1):
            attempts += 1
            try:
                response = httpx.post(
                    f"{self.base_url}/embeddings",
                    headers=self._headers(),
                    json={"model": selected_model, "input": cleaned_texts},
                    timeout=self.timeout_seconds,
                )
                if response.status_code >= 400:
                    last_error = f"HTTP {response.status_code}"
                    if _looks_html(response.text):
                        last_error = "html_response"
                    if attempt < self.retries:
                        continue
                    break
                if _looks_html(response.text):
                    last_error = "html_response"
                    if attempt < self.retries:
                        continue
                    break
                try:
                    payload = response.json()
                except ValueError:
                    last_error = "non_json_response"
                    if attempt < self.retries:
                        continue
                    break
                data = payload.get("data") if isinstance(payload, dict) else None
                if not isinstance(data, list):
                    last_error = "invalid_embedding_response"
                    if attempt < self.retries:
                        continue
                    break
                embeddings = []
                for item in data:
                    vector = item.get("embedding") if isinstance(item, dict) else None
                    if not isinstance(vector, list) or not vector:
                        last_error = "invalid_embedding_vector"
                        break
                    embeddings.append(vector)
                if len(embeddings) == len(cleaned_texts):
                    return {
                        "ok": True,
                        "status": "available",
                        "model": selected_model,
                        "attempts": attempts,
                        "count": len(embeddings),
                        "embeddings": embeddings,
                    }
                if attempt < self.retries:
                    continue
            except Exception as exc:  # pragma: no cover - network boundary
                last_error = exc.__class__.__name__
            if attempt < self.retries:
                continue

        return {
            "ok": False,
            "status": "unavailable",
            "model": selected_model,
            "attempts": attempts,
            "error_type": "embedding_unavailable",
            "message": _safe_snippet(last_error or "Compass embeddings failed.", 400),
            "recoverable": True,
        }

    def doctor(self, *, skip_models: bool = False, skip_chat: bool = False) -> Dict[str, Any]:
        """Run OpenAI-compatible diagnostics without exposing credentials."""

        base_info = self.base_url_info
        result: Dict[str, Any] = {
            "ok": False,
            "live_compass_verified": False,
            "configured": bool(self.api_key and base_info.get("ok")),
            "provider_mode": "direct",
            "provider": "official_compass_openai_compatible",
            "base_url": base_info["normalized"],
            "base_url_host": base_info.get("host", ""),
            "base_url_official": bool(base_info.get("official")),
            "base_url_accepted_direct": bool(base_info.get("accepted_direct")),
            "provider_variant": base_info.get("provider_variant", "custom_openai_compatible"),
            "openai_base_url_raw_present": bool(os.environ.get("OPENAI_BASE_URL")),
            "base_url_warnings": base_info.get("warnings", []),
            "base_url_errors": base_info.get("errors", []),
            "api_key_configured": bool(self.api_key),
            "model": self.model_fast(),
            "reasoning_model": self.model_reasoning(),
            "sample_mode": truthy(os.environ.get("SAMPLE_MODE", "false")),
            "models_endpoint": {
                "attempted": False,
                "ok": False,
                "json": False,
                "status_code": None,
                "content_type": "",
                "url": f"{base_info['normalized']}/models",
            },
            "chat_completion": {
                "attempted": False,
                "ok": False,
                "json": False,
                "status_code": None,
                "content_type": "",
                "url": f"{base_info['normalized']}/chat/completions",
            },
            "models_json": False,
            "chat_json": False,
            "error_type": "",
            "message": "",
        }

        if base_info.get("host"):
            try:
                socket.getaddrinfo(str(base_info["host"]).split(":")[0], None)
                result["dns_ok"] = True
            except Exception as exc:
                result["dns_ok"] = False
                result["dns_error_type"] = exc.__class__.__name__
        else:
            result["dns_ok"] = False

        if not base_info.get("ok"):
            result.update({"error_type": "invalid_base_url", "message": "; ".join(base_info.get("errors", []))})
            return redact(result)
        if not self.api_key:
            result.update({"error_type": "missing_api_key", "message": "OPENAI_API_KEY is not configured."})
            return redact(result)

        models_ok = True if skip_models else self._doctor_models(result)
        chat_ok = True if skip_chat else self._doctor_chat(result)
        result["models_json"] = bool(result.get("models_endpoint", {}).get("json"))
        result["chat_json"] = bool(result.get("chat_completion", {}).get("json"))
        result["ok"] = bool(models_ok and chat_ok)
        result["live_compass_verified"] = bool(result["ok"])
        if result["ok"]:
            result["message"] = "Compass OpenAI-compatible diagnostics passed."
        elif not result.get("error_type"):
            result["error_type"] = "compass_doctor_failed"
            result["message"] = "Compass diagnostics failed."
        return redact(result)

    def _doctor_models(self, result: Dict[str, Any]) -> bool:
        endpoint = result["models_endpoint"]
        endpoint["attempted"] = True
        try:
            response = httpx.get(f"{self.base_url}/models", headers=self._headers(), timeout=self.timeout_seconds)
            endpoint["status_code"] = response.status_code
            endpoint["content_type"] = response.headers.get("content-type", "")
            body_text = response.text
            if _looks_html(body_text):
                endpoint["body_type"] = "html"
                endpoint["body_snippet"] = _safe_snippet(body_text)
                result["error_type"] = "html_models_response"
                result["message"] = (
                    "Received HTML from /models. The key/base URL may be routing to a portal or proxy "
                    "instead of the OpenAI-compatible Compass API."
                )
                return False
            try:
                payload = response.json()
                endpoint["json"] = True
                endpoint["openai_shape"] = isinstance(payload, dict) and (
                    isinstance(payload.get("data"), list) or payload.get("object") in {"list", "model"}
                )
            except ValueError:
                endpoint["body_snippet"] = _safe_snippet(body_text)
                result["error_type"] = "non_json_models_response"
                result["message"] = "Compass /models returned a non-JSON response."
                return False
            endpoint["ok"] = bool(200 <= response.status_code < 300 and endpoint.get("openai_shape"))
            if not endpoint["ok"]:
                result["error_type"] = "invalid_models_response"
                result["message"] = f"Compass /models HTTP {response.status_code} did not return a recognized OpenAI-compatible model list."
            return bool(endpoint["ok"])
        except Exception as exc:  # pragma: no cover - network boundary
            result["error_type"] = "models_probe_error"
            result["message"] = f"Compass /models probe failed: {exc.__class__.__name__}"
            return False

    def _doctor_chat(self, result: Dict[str, Any]) -> bool:
        endpoint = result["chat_completion"]
        endpoint["attempted"] = True
        body = {
            "model": self.model_fast(),
            "messages": [{"role": "user", "content": "Reply with the single word OK."}],
            "temperature": 0,
            "max_tokens": 8,
        }
        try:
            response = httpx.post(f"{self.base_url}/chat/completions", headers=self._headers(), json=body, timeout=self.timeout_seconds)
            endpoint["status_code"] = response.status_code
            endpoint["content_type"] = response.headers.get("content-type", "")
            body_text = response.text
            if _looks_html(body_text):
                endpoint["body_type"] = "html"
                endpoint["body_snippet"] = _safe_snippet(body_text)
                result["error_type"] = "html_chat_response"
                result["message"] = (
                    "Received HTML from /chat/completions. The path/base URL/proxy may not expose the "
                    "OpenAI-compatible Compass chat route."
                )
                return False
            try:
                payload = response.json()
                endpoint["json"] = True
            except ValueError:
                endpoint["body_snippet"] = _safe_snippet(body_text)
                result["error_type"] = "non_json_chat_response"
                result["message"] = "Compass /chat/completions returned a non-JSON response."
                return False
            content = self._extract_content(payload)
            endpoint["has_content"] = bool(content)
            endpoint["ok"] = bool(200 <= response.status_code < 300 and content)
            if not endpoint["ok"]:
                endpoint["body_snippet"] = _safe_snippet(body_text)
                result["error_type"] = "invalid_chat_response"
                result["message"] = f"Compass /chat/completions HTTP {response.status_code} did not return choices[0].message.content."
            return bool(endpoint["ok"])
        except Exception as exc:  # pragma: no cover - network boundary
            result["error_type"] = "chat_probe_error"
            result["message"] = f"Compass /chat/completions probe failed: {exc.__class__.__name__}"
            return False

    def probe(self) -> Dict[str, Any]:
        return self.doctor()

    def compass_chat_json(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        schema_hint: str = "",
        max_tokens: int = 900,
    ) -> Dict[str, Any]:
        selected_model = model or self.model_reasoning()
        base_info = self.base_url_info
        if not base_info.get("ok"):
            return self.unavailable("invalid_base_url", "; ".join(base_info.get("errors", [])), model=selected_model)
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
                    headers=self._headers(),
                    json=body,
                    timeout=self.timeout_seconds,
                )
                if response.status_code >= 400:
                    last_error = f"HTTP {response.status_code}"
                    if _looks_html(response.text):
                        last_error = "html_response"
                    if attempt < self.retries:
                        continue
                    break
                if _looks_html(response.text):
                    last_error = "html_response"
                    if attempt < self.retries:
                        continue
                    break
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
