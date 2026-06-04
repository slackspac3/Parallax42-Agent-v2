"""Optional live CrewAI advisory runtime for the Agentathon wrapper.

This module intentionally does not import CrewAI at module import time. The
default custom orchestrator and Docker image must stay runnable without the
optional CrewAI dependency.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import time
from typing import Any, Dict, List

from .compass_client import model_fast_from_env, normalize_openai_base_url
from .trace_logger import redact


CREWAI_ADVISORY_AGENTS: List[Dict[str, str]] = [
    {
        "name": "Privacy Specialist",
        "role": "Advisory review of privacy, DPA, retention, subprocessors, transfers, and data-use gaps.",
    },
    {
        "name": "Security Specialist",
        "role": "Advisory review of SOC 2, ISO, identity, access, encryption, logging, continuity, and technical assurance.",
    },
    {
        "name": "Responsible AI Specialist",
        "role": "Advisory review of model-training ambiguity, customer-data use, automation, oversight, and transparency.",
    },
    {
        "name": "Learning & Precedent Specialist",
        "role": "Advisory review of governed learning signals and prior synthetic reviewer patterns.",
    },
    {
        "name": "Final Advisory Reviewer",
        "role": "Critiques specialist advisory outputs and summarizes reviewer questions without changing the deterministic decision.",
    },
]


def _truthy(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _safe_snippet(value: Any, limit: int = 420) -> str:
    text = _clean(redact(value))
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


def _parse_jsonish(value: Any) -> Any:
    text = _clean(value)
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.I | re.S)
    if fenced:
        try:
            return json.loads(fenced.group(1).strip())
        except Exception:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None
    return None


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return _jsonable(model_dump())
    as_dict = getattr(value, "dict", None)
    if callable(as_dict):
        return _jsonable(as_dict())
    if hasattr(value, "__dict__"):
        return _jsonable(vars(value))
    return str(value)


def crewai_dependency_status() -> Dict[str, Any]:
    installed = importlib.util.find_spec("crewai") is not None
    return {
        "dependency": "crewai",
        "installed": installed,
        "required_for_default": False,
        "install_file": "requirements-crewai.txt",
        "note": "CrewAI is imported lazily only when AGENT_RUNTIME=crewai_live and CREWAI_ENABLE_LIVE_LLM=1.",
    }


def crewai_runtime_status() -> Dict[str, Any]:
    runtime = os.environ.get("AGENT_RUNTIME", "custom").strip().lower() or "custom"
    base_info = normalize_openai_base_url(os.environ.get("OPENAI_BASE_URL"))
    return redact(
        {
            "runtime": runtime,
            "enabled": runtime == "crewai_live" and _truthy(os.environ.get("CREWAI_ENABLE_LIVE_LLM")),
            "live_llm_enabled": _truthy(os.environ.get("CREWAI_ENABLE_LIVE_LLM")),
            "model": model_fast_from_env(),
            "base_url": base_info.get("normalized"),
            "base_url_valid": bool(base_info.get("ok")),
            "api_key_configured": bool(os.environ.get("OPENAI_API_KEY")),
            "dependency": crewai_dependency_status(),
            "advisoryOnly": True,
            "final_decision_owner": "Deterministic Decision Owner",
        }
    )


def _unavailable(error_type: str, message: str, *, model: str | None = None, elapsed: float = 0.0) -> Dict[str, Any]:
    return {
        "ok": False,
        "status": "unavailable",
        "runtime": "crewai_live",
        "model": model or model_fast_from_env(),
        "advisoryOnly": True,
        "agents": CREWAI_ADVISORY_AGENTS,
        "cards": [],
        "summary": {
            "assessment": "advisory_unavailable",
            "rationale": "CrewAI advisory was unavailable; deterministic policy remains final authority.",
            "reviewerQuestions": [],
            "recommendedActions": [],
        },
        "error_type": error_type,
        "message": _safe_snippet(message),
        "recoverable": True,
        "execution_time_seconds": round(elapsed, 3),
    }


def _compact_context(shared_context: Dict[str, Any]) -> Dict[str, Any]:
    evidence = shared_context.get("evidenceMatches") if isinstance(shared_context.get("evidenceMatches"), list) else []
    learning = shared_context.get("learningContext") if isinstance(shared_context.get("learningContext"), dict) else {}
    return redact(
        {
            "caseFacts": shared_context.get("caseFacts") or {},
            "evidenceMatches": [
                {
                    "title": item.get("title", ""),
                    "snippet": _safe_snippet(item.get("snippet", ""), 260),
                    "domains": item.get("domains", []),
                    "source": item.get("source", ""),
                }
                for item in evidence[:6]
                if isinstance(item, dict)
            ],
            "missingEvidence": shared_context.get("missingEvidence") or [],
            "specialistFindings": shared_context.get("specialistFindings") or [],
            "learningSuggestions": {
                "provider": learning.get("provider", ""),
                "similar_cases_found": learning.get("similar_cases_found", 0),
                "controlSuggestions": (learning.get("controlSuggestions") or [])[:6],
                "repeatedEvidenceGaps": (learning.get("repeatedEvidenceGaps") or [])[:6],
                "advisoryOnly": True,
            },
            "deterministicDraft": shared_context.get("decisionDraft") or {},
            "decisionBoundary": {
                "finalOwner": "Deterministic Decision Owner",
                "crewAiAdvisoryOnly": True,
                "humanApprovalRequired": True,
            },
        }
    )


def _strict_json_instruction(agent_name: str) -> str:
    return (
        f"You are {agent_name}. Return strict compact JSON only with keys: "
        "specialist, advisoryOnly, assessment, findings, unresolvedRisks, reviewerQuestions, "
        "recommendedActions, confidence, rationale. advisoryOnly must be true. "
        "Do not approve, reject, or override the deterministic decision."
    )


def _task_card_from_output(item: Any) -> Dict[str, Any]:
    raw = _clean(getattr(item, "raw", item))
    agent = _clean(getattr(getattr(item, "agent", None), "role", "")) or _clean(getattr(item, "agent", ""))
    parsed = _jsonable(getattr(item, "json_dict", None)) or _parse_jsonish(raw) or {}
    if not isinstance(parsed, dict):
        parsed = {"rationale": _safe_snippet(raw, 260)}
    specialist = _clean(parsed.get("specialist")) or agent or "CrewAI Advisory Specialist"
    parsed["specialist"] = specialist
    parsed["advisoryOnly"] = True
    return {
        "specialist": specialist,
        "advisoryOnly": True,
        "assessment": _clean(parsed.get("assessment")) or "advisory",
        "findings": parsed.get("findings") if isinstance(parsed.get("findings"), list) else [],
        "unresolvedRisks": parsed.get("unresolvedRisks") if isinstance(parsed.get("unresolvedRisks"), list) else [],
        "reviewerQuestions": parsed.get("reviewerQuestions") if isinstance(parsed.get("reviewerQuestions"), list) else [],
        "recommendedActions": parsed.get("recommendedActions") if isinstance(parsed.get("recommendedActions"), list) else [],
        "confidence": _clean(parsed.get("confidence")) or "low",
        "rationale": _safe_snippet(parsed.get("rationale") or raw, 360),
    }


def _cards_from_crewai_output(output: Any) -> List[Dict[str, Any]]:
    cards = []
    for item in getattr(output, "tasks_output", []) or []:
        cards.append(_task_card_from_output(item))
    if cards:
        return cards
    parsed = _jsonable(getattr(output, "json_dict", None)) or _parse_jsonish(getattr(output, "raw", output)) or {}
    if isinstance(parsed, dict):
        parsed["advisoryOnly"] = True
        return [_task_card_from_output(parsed)]
    return []


def _summary_from_cards(cards: List[Dict[str, Any]]) -> Dict[str, Any]:
    reviewer = next((card for card in reversed(cards) if card.get("specialist") == "Final Advisory Reviewer"), cards[-1] if cards else {})
    questions: List[str] = []
    actions: List[str] = []
    risks: List[str] = []
    for card in cards:
        questions.extend([_safe_snippet(item, 180) for item in card.get("reviewerQuestions", []) if _clean(item)])
        actions.extend([_safe_snippet(item, 180) for item in card.get("recommendedActions", []) if _clean(item)])
        risks.extend([_safe_snippet(item, 180) for item in card.get("unresolvedRisks", []) if _clean(item)])
    return {
        "assessment": _clean(reviewer.get("assessment")) or "advisory",
        "rationale": _safe_snippet(reviewer.get("rationale") or "CrewAI advisory completed; deterministic policy remains final authority."),
        "reviewerQuestions": list(dict.fromkeys(questions))[:8],
        "recommendedActions": list(dict.fromkeys(actions))[:8],
        "unresolvedRisks": list(dict.fromkeys(risks))[:8],
        "specialistCardCount": len(cards),
    }


def run_crewai_advisory_council(shared_context: Dict[str, Any]) -> Dict[str, Any]:
    """Run the optional live CrewAI council and return advisory-only JSON."""

    started = time.monotonic()
    runtime = os.environ.get("AGENT_RUNTIME", "custom").strip().lower() or "custom"
    model = model_fast_from_env()
    if runtime != "crewai_live":
        return {
            "ok": False,
            "status": "skipped_custom_runtime",
            "runtime": runtime,
            "model": model,
            "advisoryOnly": True,
            "agents": CREWAI_ADVISORY_AGENTS,
            "cards": [],
            "summary": {},
        }
    if not _truthy(os.environ.get("CREWAI_ENABLE_LIVE_LLM")):
        return _unavailable("crewai_live_disabled", "Set CREWAI_ENABLE_LIVE_LLM=1 to enable live CrewAI.", model=model)
    if not os.environ.get("OPENAI_API_KEY"):
        return _unavailable("missing_api_key", "OPENAI_API_KEY is not configured for live CrewAI.", model=model)
    base_info = normalize_openai_base_url(os.environ.get("OPENAI_BASE_URL"))
    if not base_info.get("ok"):
        return _unavailable("invalid_base_url", "; ".join(base_info.get("errors", [])), model=model)

    try:
        from crewai import Agent, Crew, LLM, Process, Task  # type: ignore
    except Exception as exc:
        return _unavailable(
            "crewai_dependency_missing",
            f"CrewAI is not installed or could not be imported: {exc.__class__.__name__}. Install requirements-crewai.txt only for live validation.",
            model=model,
            elapsed=time.monotonic() - started,
        )

    try:
        llm_kwargs: Dict[str, Any] = {
            "model": model,
            "base_url": base_info["normalized"],
            "api_key": os.environ.get("OPENAI_API_KEY"),
            "temperature": float(os.environ.get("CREWAI_LLM_TEMPERATURE", "0.1")),
            "timeout": float(os.environ.get("CREWAI_LLM_TIMEOUT", "75")),
            "max_tokens": int(os.environ.get("CREWAI_LLM_MAX_TOKENS", "900")),
            "response_format": {"type": "json_object"},
        }
        try:
            llm = LLM(**llm_kwargs)
        except TypeError:
            llm_kwargs.pop("response_format", None)
            llm = LLM(**llm_kwargs)

        context_json = json.dumps(_compact_context(shared_context), ensure_ascii=True, separators=(",", ":"))[:9000]
        max_iter = int(os.environ.get("CREWAI_AGENT_MAX_ITER", "1"))
        max_seconds = int(os.environ.get("CREWAI_AGENT_MAX_SECONDS", "75"))
        verbose = _truthy(os.environ.get("CREWAI_VERBOSE"))
        agents = {
            item["name"]: Agent(
                role=item["name"],
                goal=item["role"],
                backstory=f"{item['role']} {_strict_json_instruction(item['name'])}",
                allow_delegation=False,
                verbose=verbose,
                llm=llm,
                max_iter=max_iter,
                max_execution_time=max_seconds,
            )
            for item in CREWAI_ADVISORY_AGENTS
        }
        tasks = []
        for item in CREWAI_ADVISORY_AGENTS:
            name = item["name"]
            focus = (
                "Critique all prior specialist outputs and return the final advisory summary."
                if name == "Final Advisory Reviewer"
                else f"Review only the {name} domain and identify advisory risks, questions, and actions."
            )
            tasks.append(
                Task(
                    description=(
                        f"{focus}\n{_strict_json_instruction(name)}\n"
                        f"Sanitized compliance context JSON:\n{context_json}"
                    ),
                    expected_output="Strict JSON object only. advisoryOnly must be true. Max 6 array items per key.",
                    agent=agents[name],
                )
            )

        crew = Crew(agents=list(agents.values()), tasks=tasks, process=Process.sequential, verbose=verbose)
        output = crew.kickoff(inputs={"context": context_json})
        cards = _cards_from_crewai_output(output)
        return redact(
            {
                "ok": True,
                "status": "available",
                "runtime": "crewai_live",
                "model": model,
                "advisoryOnly": True,
                "agents": CREWAI_ADVISORY_AGENTS,
                "cards": cards,
                "summary": _summary_from_cards(cards),
                "execution_time_seconds": round(time.monotonic() - started, 3),
            }
        )
    except Exception as exc:
        return _unavailable(
            "crewai_runtime_error",
            f"{exc.__class__.__name__}: {exc}",
            model=model,
            elapsed=time.monotonic() - started,
        )
