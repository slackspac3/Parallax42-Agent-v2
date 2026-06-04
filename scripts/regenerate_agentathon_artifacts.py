#!/usr/bin/env python3
"""Regenerate Agentathon output examples and matching trace logs."""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.agentathon_orchestrator import AgentathonOrchestrator  # noqa: E402
from app.compass_client import DEFAULT_BASE_URL  # noqa: E402
from app.schemas import AgentathonRunRequest  # noqa: E402


EXAMPLES = [
    ("example_1", ROOT / "input_examples" / "example_1.json", ROOT / "output_examples" / "example_1_output.json", ROOT / "logs" / "example_1_trace.jsonl"),
    ("example_2", ROOT / "input_examples" / "example_2.json", ROOT / "output_examples" / "example_2_output.json", ROOT / "logs" / "example_2_trace.jsonl"),
    ("example_3", ROOT / "input_examples" / "example_3.json", ROOT / "output_examples" / "example_3_output.json", ROOT / "logs" / "example_3_trace.jsonl"),
]


def _truthy(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def live_compass_explicit() -> bool:
    return bool(
        os.environ.get("OPENAI_API_KEY")
        and os.environ.get("OPENAI_BASE_URL")
        and not _truthy(os.environ.get("SAMPLE_MODE", "false"))
    )


def prepare_environment(*, force_sample: bool) -> str:
    mode = "live_compass" if live_compass_explicit() and not force_sample else "sample"
    if mode == "sample":
        os.environ["SAMPLE_MODE"] = "true"
        os.environ.setdefault("OPENAI_API_KEY", "dummy")
        os.environ.setdefault("OPENAI_BASE_URL", DEFAULT_BASE_URL)
    os.environ.setdefault("LOG_DIR", "./logs")
    os.environ.setdefault("P42_VECTOR_STORE_PROVIDER", "local")
    return mode


def load_example(path: Path, *, sample_mode: bool) -> Dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    options = payload.setdefault("options", {})
    if not isinstance(options, dict):
        payload["options"] = {}
        options = payload["options"]
    if sample_mode:
        options["sample_mode"] = True
    return payload


def update_log_reference(response: Dict[str, Any], stable_log: Path) -> None:
    relative_log = f"logs/{stable_log.name}"
    response["log_file"] = relative_log
    output = response.get("output") if isinstance(response.get("output"), dict) else {}
    result = response.get("result") if isinstance(response.get("result"), dict) else output
    for container in (output, result):
        artifacts = container.get("artifacts") if isinstance(container.get("artifacts"), list) else []
        for artifact in artifacts:
            if isinstance(artifact, dict) and artifact.get("type") == "trace_log":
                artifact["path"] = relative_log


def trace_ids_in_log(path: Path) -> List[str]:
    trace_ids: List[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        event = json.loads(line)
        trace_id = event.get("trace_id") if isinstance(event, dict) else None
        if trace_id and trace_id not in trace_ids:
            trace_ids.append(str(trace_id))
    return trace_ids


def regenerate(*, force_sample: bool) -> Dict[str, Any]:
    mode = prepare_environment(force_sample=force_sample)
    sample_mode = mode == "sample"
    (ROOT / "logs").mkdir(exist_ok=True)
    (ROOT / "output_examples").mkdir(exist_ok=True)

    orchestrator = AgentathonOrchestrator()
    results: List[Dict[str, Any]] = []
    for name, input_path, output_path, stable_log in EXAMPLES:
        payload = load_example(input_path, sample_mode=sample_mode)
        with contextlib.redirect_stdout(io.StringIO()):
            response = orchestrator.run(AgentathonRunRequest(**payload))
        if response.get("status") != "success":
            raise RuntimeError(f"{name} returned status={response.get('status')}")
        runtime_log = ROOT / str(response.get("log_file", ""))
        if not runtime_log.exists():
            raise RuntimeError(f"{name} runtime log missing: {response.get('log_file')}")
        shutil.copyfile(runtime_log, stable_log)
        update_log_reference(response, stable_log)
        output_path.write_text(json.dumps(response, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        trace_ids = trace_ids_in_log(stable_log)
        if response.get("trace_id") not in trace_ids:
            raise RuntimeError(f"{name} trace_id does not match {stable_log}")
        results.append(
            {
                "example": name,
                "status": response.get("status"),
                "decision": response.get("output", {}).get("decision"),
                "risk_level": response.get("output", {}).get("risk_level"),
                "trace_id": response.get("trace_id"),
                "log_file": response.get("log_file"),
                "trace_events": len(response.get("agent_trace") or []),
            }
        )

    shutil.copyfile(EXAMPLES[0][3], ROOT / "logs" / "demo_trace.jsonl")
    return {"status": "PASS", "mode": mode, "results": results}


def main() -> int:
    parser = argparse.ArgumentParser(description="Regenerate Agentathon output examples and matching logs.")
    parser.add_argument("--force-sample", action="store_true", help="Force SAMPLE_MODE=true even if live Compass env is present.")
    parser.add_argument("--json", action="store_true", help="Print JSON summary.")
    args = parser.parse_args()

    try:
        summary = regenerate(force_sample=args.force_sample)
    except Exception as exc:
        summary = {"status": "FAIL", "error_type": exc.__class__.__name__, "message": str(exc)}

    if args.json:
        print(json.dumps(summary, indent=2, sort_keys=True))
    else:
        print(f"Artifact mode: {summary.get('mode', 'unknown')}")
        for result in summary.get("results", []):
            print(
                f"{result['example']}: decision={result['decision']} risk={result['risk_level']} "
                f"trace_id={result['trace_id']} log_file={result['log_file']} events={result['trace_events']}"
            )
        if summary.get("status") != "PASS":
            print(f"Error: {summary.get('error_type')} {summary.get('message')}")
    print(f"ARTIFACT_REGEN={summary['status']}")
    return 0 if summary["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
