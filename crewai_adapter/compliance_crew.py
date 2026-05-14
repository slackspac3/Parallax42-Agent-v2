"""Optional CrewAI orchestration for the Compliance Intelligence Agent.

Dry-run mode intentionally does not import CrewAI so the repository remains
runnable without optional Python dependencies.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = Path(__file__).resolve().parent / "config"
DEFAULT_INPUT = ROOT / "examples" / "high_risk_ai_saas_case.json"


def load_yaml(path: Path) -> dict[str, Any]:
    try:
        import yaml  # type: ignore
    except Exception:
        return _minimal_yaml(path)
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def _minimal_yaml(path: Path) -> dict[str, Any]:
    """Small fallback parser for this repo's simple mapping-based YAML files."""

    data: dict[str, Any] = {}
    current_key = ""
    current_field = ""
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        if not raw_line.startswith(" ") and raw_line.endswith(":"):
            current_key = raw_line[:-1].strip()
            current_field = ""
            data[current_key] = {}
            continue
        if current_key and raw_line.startswith("  ") and ":" in raw_line:
            field, value = raw_line.strip().split(":", 1)
            current_field = field.strip()
            data[current_key][current_field] = value.strip().strip('"')
            continue
        if current_key and current_field and raw_line.startswith("    "):
            data[current_key][current_field] = (
                f"{data[current_key].get(current_field, '')} {raw_line.strip()}"
            ).strip()
    return data


def load_case(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def dry_run_manifest(input_path: Path) -> dict[str, Any]:
    agents = load_yaml(CONFIG_DIR / "agents.yaml")
    tasks = load_yaml(CONFIG_DIR / "tasks.yaml")
    return {
        "mode": "dry_run",
        "input": str(input_path.relative_to(ROOT)) if input_path.is_relative_to(ROOT) else str(input_path),
        "agent_count": len(agents),
        "task_count": len(tasks),
        "process": "sequential",
        "agents": [
            {
                "key": key,
                "role": value.get("role", ""),
                "goal": value.get("goal", ""),
            }
            for key, value in agents.items()
        ],
        "tasks": [
            {
                "key": key,
                "agent": value.get("agent", ""),
                "expected_output": value.get("expected_output", ""),
            }
            for key, value in tasks.items()
        ],
        "human_approval_required": True,
        "secrets_required": False,
    }


def run_live_crewai(input_path: Path) -> Any:
    try:
        from crewai import Agent, Crew, Process, Task  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "CrewAI is not installed. Run `python -m pip install -r requirements-crewai.txt` first."
        ) from exc

    agents_config = load_yaml(CONFIG_DIR / "agents.yaml")
    tasks_config = load_yaml(CONFIG_DIR / "tasks.yaml")
    case = load_case(input_path)

    agents = {
        key: Agent(
            role=config.get("role", key),
            goal=config.get("goal", ""),
            backstory=config.get("backstory", ""),
            allow_delegation=False,
            verbose=True,
        )
        for key, config in agents_config.items()
    }

    tasks = []
    for key, config in tasks_config.items():
        agent_key = config.get("agent", "")
        if agent_key not in agents:
            raise RuntimeError(f"Task {key} references unknown agent {agent_key}")
        tasks.append(
            Task(
                description=f"{config.get('description', '')}\n\nCase input:\n{json.dumps(case, indent=2)}",
                expected_output=config.get("expected_output", ""),
                agent=agents[agent_key],
            )
        )

    crew = Crew(
        agents=list(agents.values()),
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff(inputs={"case": case})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Path to compliance case JSON.")
    parser.add_argument("--dry-run", action="store_true", help="Print crew manifest without importing CrewAI.")
    parser.add_argument("--live-crewai", action="store_true", help="Run with CrewAI installed and configured.")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    if args.live_crewai:
        result = run_live_crewai(input_path)
        print(result)
        return 0

    manifest = dry_run_manifest(input_path)
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
