"""CrewAI Flow adapter for the Compliance Intelligence Agent.

The default dry-run mode intentionally avoids importing CrewAI so API demos,
CI, and evidence capture remain stable without optional Python dependencies.
When CrewAI is installed, --live-flow validates the same state machine through
CrewAI's Flow decorators.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from compliance_crew import CONFIG_DIR, DEFAULT_INPUT, ROOT, dry_run_manifest, load_case, load_yaml


FLOW_STAGES = [
    {
        "id": "intake",
        "method": "load_case",
        "task": "triage_case",
        "agent": "compliance_orchestrator",
        "expectedTraceEvent": "case_loaded",
        "kind": "start",
    },
    {
        "id": "obligations",
        "method": "map_obligations",
        "task": "map_obligations",
        "agent": "regulatory_obligation_mapper",
        "expectedTraceEvent": "domains_scanned",
        "kind": "listen",
    },
    {
        "id": "evidence",
        "method": "examine_evidence",
        "task": "examine_evidence",
        "agent": "evidence_examiner",
        "expectedTraceEvent": "evidence_mapped",
        "kind": "listen",
    },
    {
        "id": "controls",
        "method": "recommend_controls",
        "task": "recommend_controls",
        "agent": "risk_control_analyst",
        "expectedTraceEvent": "controls_recommended",
        "kind": "listen",
    },
    {
        "id": "rai_review",
        "method": "review_responsible_ai",
        "task": "review_responsible_ai",
        "agent": "responsible_ai_reviewer",
        "expectedTraceEvent": "output_review_completed",
        "kind": "listen",
    },
    {
        "id": "audit_pack",
        "method": "package_audit_brief",
        "task": "package_audit_brief",
        "agent": "audit_packager",
        "expectedTraceEvent": "output_review_completed",
        "kind": "listen",
    },
]


def _relative(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def load_case_input(path: Path | None) -> tuple[dict[str, Any], str]:
    if path is None:
        raw = sys.stdin.read()
        return json.loads(raw or "{}"), "stdin"
    return load_case(path), _relative(path)


def flow_manifest(case: dict[str, Any], input_label: str, *, live_crewai: bool) -> dict[str, Any]:
    agents = load_yaml(CONFIG_DIR / "agents.yaml")
    tasks = load_yaml(CONFIG_DIR / "tasks.yaml")
    crew = dry_run_manifest(DEFAULT_INPUT)
    return {
        "mode": "crewai_flow_live" if live_crewai else "crewai_flow_dry_run",
        "framework": "CrewAI Flow",
        "primary_runtime": True,
        "live_crewai": live_crewai,
        "input": input_label,
        "caseId": case.get("caseId") or "",
        "state_schema": {
            "case": "original normalized compliance case",
            "workPlan": "triage and domain scope",
            "obligations": "mapped obligations and applicability",
            "evidenceReview": "supported and missing evidence",
            "controlPlan": "controls, blockers, owners, remediation",
            "responsibleAiReview": "approval boundary and safety checks",
            "auditBrief": "final decision package",
        },
        "flow": {
            "class": "ComplianceIntelligenceFlow",
            "entrypoint": "kickoff",
            "control_model": "start/listen state machine",
            "human_approval_required": True,
            "deterministic_fallback": True,
            "stages": [
                {
                    **stage,
                    "role": agents.get(stage["agent"], {}).get("role", stage["agent"]),
                    "expected_output": tasks.get(stage["task"], {}).get("expected_output", ""),
                }
                for stage in FLOW_STAGES
            ],
        },
        "crew": crew,
        "secrets_required_for_dry_run": False,
    }


def truthy_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def llm_config() -> dict[str, Any]:
    model = (
        os.getenv("CREWAI_LLM_MODEL")
        or os.getenv("OPENAI_MODEL_NAME")
        or os.getenv("MODEL")
        or "gpt-5.1"
    )
    base_url = (
        os.getenv("CREWAI_LLM_BASE_URL")
        or os.getenv("OPENAI_API_BASE")
        or os.getenv("OPENAI_BASE_URL")
        or ""
    )
    api_key = (
        os.getenv("CREWAI_LLM_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or os.getenv("ANTHROPIC_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("AZURE_API_KEY")
        or ""
    )
    return {
        "enabled": truthy_env("CREWAI_ENABLE_LIVE_LLM"),
        "model": model,
        "base_url_configured": bool(base_url),
        "api_key_configured": bool(api_key),
        "temperature": float(os.getenv("CREWAI_LLM_TEMPERATURE", "0.1")),
        "timeout": float(os.getenv("CREWAI_LLM_TIMEOUT", "120")),
        "max_tokens": int(os.getenv("CREWAI_LLM_MAX_TOKENS", "1800")),
        "provider_env": configured_provider_env(),
    }


def configured_provider_env() -> str:
    for key in [
        "CREWAI_LLM_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "AZURE_API_KEY",
    ]:
        if os.getenv(key):
            return key
    return ""


def build_llm() -> Any:
    try:
        from crewai import LLM  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "CrewAI is not installed. Run `python -m pip install -r requirements-crewai.txt` first."
        ) from exc

    config = llm_config()
    if not config["enabled"]:
        raise RuntimeError("Live CrewAI LLM calls are disabled. Set CREWAI_ENABLE_LIVE_LLM=1 to enable them.")
    if not config["api_key_configured"]:
        raise RuntimeError("No provider API key is configured for live CrewAI LLM calls.")

    kwargs: dict[str, Any] = {
        "model": config["model"],
        "temperature": config["temperature"],
        "timeout": config["timeout"],
        "max_tokens": config["max_tokens"],
        "response_format": {"type": "json_object"},
    }
    base_url = os.getenv("CREWAI_LLM_BASE_URL") or os.getenv("OPENAI_API_BASE") or os.getenv("OPENAI_BASE_URL")
    api_key = os.getenv("CREWAI_LLM_API_KEY") or os.getenv("OPENAI_API_KEY")
    if base_url:
        kwargs["base_url"] = base_url
    if api_key:
        kwargs["api_key"] = api_key
    return LLM(**kwargs)


def parse_jsonish(value: str) -> Any:
    text = (value or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            return None
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None
    return None


def jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(item) for item in value]
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return jsonable(model_dump())
    as_dict = getattr(value, "dict", None)
    if callable(as_dict):
        return jsonable(as_dict())
    if hasattr(value, "__dict__"):
        return jsonable(vars(value))
    return str(value)


def output_to_payload(output: Any) -> dict[str, Any]:
    raw = str(getattr(output, "raw", output))
    task_outputs = []
    for item in getattr(output, "tasks_output", []) or []:
        item_raw = str(getattr(item, "raw", item))
        task_outputs.append({
            "agent": getattr(getattr(item, "agent", None), "role", "") or "",
            "description": str(getattr(item, "description", "") or "")[:500],
            "raw": item_raw,
            "json": parse_jsonish(item_raw),
        })
    return {
        "raw": raw,
        "json": jsonable(getattr(output, "json_dict", None)) or parse_jsonish(raw),
        "tasks": task_outputs,
        "token_usage": jsonable(getattr(output, "token_usage", None)),
    }


def live_llm_system_note() -> str:
    return (
        "Return strict JSON only. Do not approve the case automatically. "
        "Treat your output as specialist analysis for a human reviewer and deterministic guardrail engine. "
        "Name missing evidence, uncertainty, and required human approvals."
    )


def run_live_llm_review(case: dict[str, Any], input_label: str) -> dict[str, Any]:
    try:
        from crewai import Agent, Crew, Process, Task  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "CrewAI is not installed. Run `python -m pip install -r requirements-crewai.txt` first."
        ) from exc

    llm = build_llm()
    agents_config = load_yaml(CONFIG_DIR / "agents.yaml")
    tasks_config = load_yaml(CONFIG_DIR / "tasks.yaml")
    agents = {
        key: Agent(
            role=config.get("role", key),
            goal=config.get("goal", ""),
            backstory=f"{config.get('backstory', '')}\n\n{live_llm_system_note()}",
            allow_delegation=False,
            verbose=truthy_env("CREWAI_VERBOSE"),
            llm=llm,
            max_iter=int(os.getenv("CREWAI_AGENT_MAX_ITER", "2")),
            max_execution_time=int(os.getenv("CREWAI_AGENT_MAX_SECONDS", "120")),
        )
        for key, config in agents_config.items()
    }

    tasks = []
    for key, config in tasks_config.items():
        agent_key = config.get("agent", "")
        if agent_key not in agents:
            raise RuntimeError(f"Task {key} references unknown agent {agent_key}")
        tasks.append(Task(
            description=(
                f"{config.get('description', '')}\n\n"
                f"{live_llm_system_note()}\n\n"
                f"Case input:\n{json.dumps(case, indent=2)}"
            ),
            expected_output=f"{config.get('expected_output', '')}\nReturn valid JSON only.",
            agent=agents[agent_key],
        ))

    crew = Crew(
        agents=list(agents.values()),
        tasks=tasks,
        process=Process.sequential,
        verbose=truthy_env("CREWAI_VERBOSE"),
    )
    output = crew.kickoff(inputs={"case": case})
    config = llm_config()
    return {
        "mode": "crewai_llm_live",
        "framework": "CrewAI",
        "input": input_label,
        "llm": {
            "enabled": True,
            "model": config["model"],
            "base_url_configured": config["base_url_configured"],
            "provider_env": config["provider_env"],
            "temperature": config["temperature"],
            "max_tokens": config["max_tokens"],
        },
        "crewOutput": output_to_payload(output),
        "flow": flow_manifest(case, input_label, live_crewai=True)["flow"],
        "human_approval_required": True,
        "deterministic_guardrail_required": True,
    }


def run_live_flow(case: dict[str, Any], input_label: str) -> dict[str, Any]:
    try:
        from crewai.flow.flow import Flow, listen, start  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "CrewAI Flow is not installed. Run `python -m pip install -r requirements-crewai.txt` first."
        ) from exc

    class ComplianceIntelligenceFlow(Flow):  # type: ignore[misc]
        @start()
        def load_case(self) -> dict[str, Any]:
            self.state["case"] = case
            self.state["stage"] = "intake"
            return {"stage": "intake", "caseId": case.get("caseId", "")}

        @listen(load_case)
        def map_obligations(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "obligations"
            return {"stage": "obligations", "agent": "regulatory_obligation_mapper"}

        @listen(map_obligations)
        def examine_evidence(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "evidence"
            return {"stage": "evidence", "agent": "evidence_examiner"}

        @listen(examine_evidence)
        def recommend_controls(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "controls"
            return {"stage": "controls", "agent": "risk_control_analyst"}

        @listen(recommend_controls)
        def review_responsible_ai(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "rai_review"
            return {"stage": "rai_review", "agent": "responsible_ai_reviewer"}

        @listen(review_responsible_ai)
        def package_audit_brief(self, _: dict[str, Any]) -> dict[str, Any]:
            self.state["stage"] = "audit_pack"
            return flow_manifest(case, input_label, live_crewai=True)

    flow = ComplianceIntelligenceFlow()
    result = flow.kickoff()
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Path to compliance case JSON, or '-' for stdin.")
    parser.add_argument("--dry-run", action="store_true", help="Print Flow manifest without importing CrewAI.")
    parser.add_argument("--live-flow", action="store_true", help="Execute the Flow state machine with CrewAI installed.")
    parser.add_argument("--live-llm", action="store_true", help="Run CrewAI agents with configured live LLM calls.")
    args = parser.parse_args()

    input_path = None if args.input == "-" else Path(args.input).expanduser().resolve()
    case, input_label = load_case_input(input_path)

    if args.live_llm:
        payload = run_live_llm_review(case, input_label)
    elif args.live_flow:
        payload = run_live_flow(case, input_label)
    else:
        payload = flow_manifest(case, input_label, live_crewai=False)

    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
