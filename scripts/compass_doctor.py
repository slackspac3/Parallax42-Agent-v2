#!/usr/bin/env python3
"""Diagnose the official Compass OpenAI-compatible Agentathon path."""

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
from app.trace_logger import redact  # noqa: E402


def key_summary(value: str) -> str:
    if not value:
        return "missing"
    if len(value) <= 8:
        return "[redacted]"
    return f"{value[:4]}...[redacted]...{value[-4:]}"


def build_summary(result: Dict[str, Any], *, strict: bool) -> Dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    base_info = normalize_openai_base_url(os.environ.get("OPENAI_BASE_URL"))
    raw_base_present = bool(os.environ.get("OPENAI_BASE_URL"))
    missing_env = not api_key or not raw_base_present
    status = "PASS" if result.get("ok") else "FAIL"
    if missing_env and not strict:
        status = "SKIPPED"
    summary = {
        "status": status,
        "strict": strict,
        "api_key": key_summary(api_key),
        "openai_base_url_raw_present": raw_base_present,
        "normalized_base_url": base_info.get("normalized"),
        "base_url_official": bool(base_info.get("official")),
        "base_url_accepted_direct": bool(base_info.get("accepted_direct")),
        "provider_variant": base_info.get("provider_variant", "custom_openai_compatible"),
        "base_url_warnings": base_info.get("warnings", []),
        "base_url_errors": base_info.get("errors", []),
        "doctor": result,
    }
    if missing_env and not strict:
        missing = []
        if not api_key:
            missing.append("OPENAI_API_KEY")
        if not raw_base_present:
            missing.append("OPENAI_BASE_URL")
        summary["message"] = (
            f"{' and '.join(missing)} not exported; skipped in non-strict mode. "
            "OPENAI_BASE_URL not exported; using default only for normalization, not a live proof."
            if not raw_base_present
            else f"{' and '.join(missing)} not exported; skipped in non-strict mode."
        )
    return redact(summary)


def print_human(summary: Dict[str, Any]) -> None:
    doctor = summary.get("doctor", {})
    print(f"OPENAI_API_KEY: {summary.get('api_key')}")
    print(f"OPENAI_BASE_URL raw present: {summary.get('openai_base_url_raw_present')}")
    print(f"OPENAI_BASE_URL normalized: {summary.get('normalized_base_url')}")
    print(f"OPENAI_BASE_URL official Agentathon Compass template: {summary.get('base_url_official')}")
    print(f"OPENAI_BASE_URL accepted direct Compass base: {summary.get('base_url_accepted_direct')}")
    print(f"Provider variant: {summary.get('provider_variant')}")
    if summary.get("base_url_warnings"):
        print(f"Base URL warnings: {'; '.join(summary['base_url_warnings'])}")
    if summary.get("base_url_errors"):
        print(f"Base URL errors: {'; '.join(summary['base_url_errors'])}")
    print(f"Configured: {doctor.get('configured')}")
    print(f"DNS OK: {doctor.get('dns_ok')}")
    models = doctor.get("models_endpoint", {})
    if models.get("url"):
        print(f"Models endpoint URL: {models.get('url')}")
    print(
        "Models endpoint: "
        f"attempted={models.get('attempted')} ok={models.get('ok')} "
        f"status={models.get('status_code')} json={models.get('json')} "
        f"content_type={models.get('content_type')}"
    )
    if models.get("body_type") == "html":
        print("Received HTML, likely wrong OPENAI_BASE_URL or gateway URL.")
        if models.get("body_snippet"):
            print(f"Models HTML snippet: {models.get('body_snippet')}")
    chat = doctor.get("chat_completion", {})
    if chat.get("url"):
        print(f"Chat endpoint URL: {chat.get('url')}")
    print(
        "Chat completion: "
        f"attempted={chat.get('attempted')} ok={chat.get('ok')} "
        f"status={chat.get('status_code')} json={chat.get('json')} "
        f"content_type={chat.get('content_type')}"
    )
    if chat.get("body_type") == "html":
        print("Received HTML, likely wrong OPENAI_BASE_URL or gateway URL.")
        if chat.get("body_snippet"):
            print(f"Chat HTML snippet: {chat.get('body_snippet')}")
    if models.get("body_type") == "html" or chat.get("body_type") == "html":
        print("Suggestion: If HTML is returned from /models, the key/base URL may be routing to a portal or proxy instead of the OpenAI-compatible Compass API.")
    if doctor.get("error_type"):
        print(f"Error type: {doctor.get('error_type')}")
    if doctor.get("message") or summary.get("message"):
        print(f"Message: {doctor.get('message') or summary.get('message')}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose Compass OpenAI-compatible configuration.")
    parser.add_argument("--json", action="store_true", help="Print JSON summary.")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero if env is missing or diagnostics fail.")
    parser.add_argument("--skip-chat", action="store_true", help="Only check /models.")
    parser.add_argument("--skip-models", action="store_true", help="Only check /chat/completions.")
    args = parser.parse_args()

    missing_env = not os.environ.get("OPENAI_API_KEY") or not os.environ.get("OPENAI_BASE_URL")
    if missing_env:
        base_info = normalize_openai_base_url(os.environ.get("OPENAI_BASE_URL"))
        result: Dict[str, Any] = {
            "ok": False,
            "live_compass_verified": False,
            "configured": False,
            "provider_mode": "direct",
            "provider": "official_compass_openai_compatible",
            "base_url": base_info.get("normalized"),
            "base_url_host": base_info.get("host", ""),
            "base_url_official": bool(base_info.get("official")),
            "base_url_accepted_direct": bool(base_info.get("accepted_direct")),
            "provider_variant": base_info.get("provider_variant", "custom_openai_compatible"),
            "openai_base_url_raw_present": bool(os.environ.get("OPENAI_BASE_URL")),
            "base_url_warnings": base_info.get("warnings", []),
            "base_url_errors": base_info.get("errors", []),
            "api_key_configured": bool(os.environ.get("OPENAI_API_KEY")),
            "model": os.environ.get("MODEL_FAST") or os.environ.get("COMPASS_CHAT_MODEL") or os.environ.get("AGENT_MODEL") or "gpt-4.1",
            "reasoning_model": os.environ.get("MODEL_REASONING") or os.environ.get("COMPASS_REASONING_MODEL") or os.environ.get("REASONING_MODEL") or "gpt-5.1",
            "sample_mode": str(os.environ.get("SAMPLE_MODE", "false")).lower() in {"1", "true", "yes", "on"},
            "dns_ok": False,
            "models_endpoint": {
                "attempted": False,
                "ok": False,
                "json": False,
                "status_code": None,
                "content_type": "",
                "url": f"{base_info.get('normalized')}/models",
            },
            "chat_completion": {
                "attempted": False,
                "ok": False,
                "json": False,
                "status_code": None,
                "content_type": "",
                "url": f"{base_info.get('normalized')}/chat/completions",
            },
            "models_json": False,
            "chat_json": False,
            "error_type": "missing_env",
            "message": "OPENAI_API_KEY and OPENAI_BASE_URL are required for live Compass diagnostics.",
        }
    else:
        client = CompassClient(timeout_seconds=20, retries=0)
        result = client.doctor(skip_models=args.skip_models, skip_chat=args.skip_chat)
    summary = build_summary(result, strict=args.strict)

    if args.json:
        print(json.dumps(summary, indent=2, sort_keys=True))
    else:
        print_human(summary)
    print(f"COMPASS_DOCTOR={summary['status']}")
    return 1 if args.strict and summary["status"] != "PASS" else 0


if __name__ == "__main__":
    raise SystemExit(main())
