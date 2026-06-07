#!/usr/bin/env python3
"""Agentathon submission preflight checks.

The script is intentionally dependency-light so it can run before the API
server is started. Optional modes exercise the real FastAPI wrapper, npm QA,
Compass configuration, and Docker when those tools are available.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[1]
PLACEHOLDER_RE = re.compile(r"(replace|placeholder|dummy|example|your-|<|>|^$)", re.I)
TOKEN_RE = re.compile(r"(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{12,}")
ASSIGNMENT_RE = re.compile(r"(?m)^[^\S\r\n]*(OPENAI_API_KEY|COMPASS_API_KEY|QDRANT_API_KEY)[^\S\r\n]*=[^\S\r\n]*([^\s\"']*)")
BEARER_RE = re.compile(r"Authorization\s*:\s*Bearer\s+([A-Za-z0-9._~+/=-]{12,})", re.I)
API_KEY_LITERAL_RE = re.compile(r"\bapi[_-]?key\b[\"']?\s*[:=]\s*[\"']([^\"'\s]{12,})[\"']", re.I)
TEXT_EXTENSIONS = {
    ".js",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".py",
    ".json",
    ".jsonl",
    ".md",
    ".txt",
    ".yml",
    ".yaml",
    ".html",
    ".css",
    ".sh",
    ".env",
    ".example",
}
COLLABORATION_ACTIONS = (
    "delegate",
    "delegated_task",
    "critique",
    "validate",
    "validation",
    "retry",
    "revise",
    "escalate",
    "challenge",
    "fallback_used",
    "package",
)


@dataclass
class CheckResult:
    name: str
    status: str
    details: str


@dataclass
class Preflight:
    results: List[CheckResult] = field(default_factory=list)

    def add(self, name: str, status: str, details: str) -> None:
        self.results.append(CheckResult(name=name, status=status, details=details))

    @property
    def passed(self) -> bool:
        return not any(result.status == "FAIL" for result in self.results)

    def summary(self) -> Dict[str, Any]:
        counts: Dict[str, int] = {}
        for result in self.results:
            counts[result.status] = counts.get(result.status, 0) + 1
        return {
            "status": "PASS" if self.passed else "FAIL",
            "counts": counts,
            "checks": [result.__dict__ for result in self.results],
        }


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def clean_detail(value: str, limit: int = 180) -> str:
    text = " ".join(str(value or "").split())
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


def is_placeholder(value: str) -> bool:
    return bool(PLACEHOLDER_RE.search(str(value or "").strip()))


def http_json(url: str, *, method: str = "GET", payload: Optional[Dict[str, Any]] = None, timeout: float = 10) -> Tuple[int, Any]:
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        return response.status, json.loads(body) if body else {}


def wait_for_health(base_url: str, timeout_seconds: float = 30) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            status, body = http_json(f"{base_url}/health", timeout=2)
            if status == 200 and body.get("ok"):
                return True
        except Exception:
            time.sleep(0.5)
    return False


def run_command(command: List[str], *, timeout: float = 900, env: Optional[Dict[str, str]] = None) -> Tuple[int, str, str]:
    completed = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        env=env,
        check=False,
    )
    return completed.returncode, completed.stdout, completed.stderr


def check_required_files(pf: Preflight) -> None:
    required = [
        "run.py",
        "requirements.txt",
        "metadata.json",
        ".env.example",
        "README.md",
        "Dockerfile",
        "app",
        "scripts",
        "input_examples",
        "output_examples",
        "logs",
    ]
    missing = [item for item in required if not (ROOT / item).exists()]
    pf.add("Required files", "FAIL" if missing else "PASS", f"Missing: {', '.join(missing)}" if missing else "All required files/directories exist.")


def check_metadata(pf: Preflight) -> None:
    path = ROOT / "metadata.json"
    try:
        metadata = read_json(path)
    except Exception as exc:
        pf.add("metadata.json", "FAIL", f"Invalid JSON: {exc}")
        return

    failures: List[str] = []
    use_case = metadata.get("use_case_id")
    try:
        use_case_number = int(str(use_case))
        if use_case_number < 1 or use_case_number > 25:
            failures.append("use_case_id must be 1..25")
    except (TypeError, ValueError):
        failures.append("use_case_id must be a string or number from 1 to 25")

    agents = metadata.get("agents")
    if not isinstance(agents, list) or len(agents) < 2:
        failures.append("agents must contain at least 2 agents")
    else:
        for index, agent in enumerate(agents, start=1):
            if not isinstance(agent, dict) or not agent.get("name") or not agent.get("role"):
                failures.append(f"agent {index} missing name or role")

    tools = metadata.get("tools_used")
    tool_names: List[str] = []
    if isinstance(tools, list):
        for tool in tools:
            if isinstance(tool, dict):
                tool_names.append(str(tool.get("name", "")).lower())
            else:
                tool_names.append(str(tool).lower())
    if not tool_names or not any(name in {"compass-api", "openai-compatible-api"} for name in tool_names):
        failures.append("tools_used must include compass-api or openai-compatible-api")

    if not metadata.get("data_sources"):
        failures.append("data_sources missing")
    if metadata.get("output_type") not in {"text", "dashboard", "video"}:
        failures.append("output_type must be text, dashboard, or video")

    pf.add(
        "metadata.json",
        "FAIL" if failures else "PASS",
        "; ".join(failures) if failures else f"use_case_id={use_case}, agents={len(agents)}, tools={len(tool_names)}",
    )


def check_env_example(pf: Preflight) -> None:
    path = ROOT / ".env.example"
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    failures: List[str] = []
    warnings: List[str] = []
    if not re.search(r"^OPENAI_API_KEY=", text, re.M):
        failures.append("OPENAI_API_KEY missing")
    else:
        match = re.search(r"^OPENAI_API_KEY=(.*)$", text, re.M)
        if match and not is_placeholder(match.group(1)):
            failures.append("OPENAI_API_KEY is not a placeholder")
    if not re.search(r"^OPENAI_BASE_URL=https://compass\.core42\.ai/v1$", text, re.M):
        failures.append("active OPENAI_BASE_URL must use the official Agentathon template https://compass.core42.ai/v1")
    if "OPENAI_BASE_URL=https://api.core42.ai/v1" not in text:
        failures.append("alternate OPENAI_BASE_URL=https://api.core42.ai/v1 must be visible")
    if not re.search(r"^(MODEL_FAST|COMPASS_CHAT_MODEL|AGENT_MODEL)=", text, re.M):
        failures.append("fast/chat model variable missing")
    if not re.search(r"^(MODEL_REASONING|COMPASS_REASONING_MODEL|REASONING_MODEL)=", text, re.M):
        failures.append("reasoning model variable missing")
    if not re.search(r"^(EMBEDDING_MODEL|COMPASS_EMBEDDING_MODEL)=", text, re.M):
        failures.append("embedding model variable missing")
    if not re.search(r"^SAMPLE_MODE=", text, re.M):
        failures.append("SAMPLE_MODE missing")
    if not re.search(r"^REQUIRE_COMPASS=", text, re.M):
        failures.append("REQUIRE_COMPASS missing")

    for key, value in ASSIGNMENT_RE.findall(text):
        if value and not is_placeholder(value):
            failures.append(f"{key} has non-placeholder value")
    if TOKEN_RE.search(text):
        failures.append("token-like sk- value found in .env.example")

    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8") if (ROOT / ".gitignore").exists() else ""
    if not re.search(r"(^|\n)\.env(\n|$)", gitignore):
        failures.append(".env is not ignored by .gitignore")
    if not re.search(r"(^|\n)\.env\.\*(\n|$)", gitignore):
        warnings.append(".env.* ignore rule not found")
    if "!.env.example" not in gitignore:
        warnings.append(".env.example allowlist rule not found")

    status = "FAIL" if failures else "WARN" if warnings else "PASS"
    details = "; ".join(failures or warnings) or "Compass placeholders, model variables, SAMPLE_MODE, REQUIRE_COMPASS, and .env ignore rules are present."
    pf.add(".env.example", status, details)


def example_has_query(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    input_payload = payload.get("input")
    if isinstance(input_payload, str) and input_payload.strip():
        return True
    if isinstance(input_payload, dict):
        if isinstance(input_payload.get("query"), str) and input_payload["query"].strip():
            return True
        if isinstance(input_payload.get("case"), dict):
            case = input_payload["case"]
            return any(case.get(key) for key in ("query", "description", "service_description", "serviceDescription"))
    return any(payload.get(key) for key in ("prompt", "message", "caseDraft"))


def looks_confidential(payload: Any) -> List[str]:
    text = json.dumps(payload, ensure_ascii=False)
    findings: List[str] = []
    patterns = {
        "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        "phone": r"\b\+?\d[\d\s().-]{8,}\d\b",
        "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
        "medical_record": r"\b(MRN|medical record)\s*[:#]?\s*\d{4,}\b",
        "credit_card": r"\b(?:\d[ -]*?){13,16}\b",
    }
    for label, pattern in patterns.items():
        if re.search(pattern, text, re.I):
            findings.append(label)
    return findings


def check_input_examples(pf: Preflight) -> None:
    directory = ROOT / "input_examples"
    files = sorted(directory.glob("*.json"))
    failures: List[str] = []
    warnings: List[str] = []
    if len(files) < 3:
        failures.append(f"expected at least 3 JSON files, found {len(files)}")
    for path in files:
        try:
            payload = read_json(path)
        except Exception as exc:
            failures.append(f"{rel(path)} invalid JSON: {exc}")
            continue
        if not example_has_query(payload):
            failures.append(f"{rel(path)} missing input.query or accepted request shape")
        confidential = looks_confidential(payload)
        if confidential:
            warnings.append(f"{rel(path)} possible confidential pattern(s): {', '.join(confidential)}")
    status = "FAIL" if failures else "WARN" if warnings else "PASS"
    pf.add("input_examples", status, "; ".join(failures or warnings) or f"{len(files)} JSON examples parse and include accepted input shapes.")


def check_output_examples(pf: Preflight) -> None:
    directory = ROOT / "output_examples"
    files = sorted(directory.glob("example_*_output.json"))
    if not files:
        files = sorted(directory.glob("*.json"))
    failures: List[str] = []
    warnings: List[str] = []
    payload_texts: List[str] = []
    if len(files) < 3:
        failures.append(f"expected at least 3 JSON files, found {len(files)}")
    for path in files:
        try:
            payload = read_json(path)
            payload_texts.append(json.dumps(payload, sort_keys=True))
        except Exception as exc:
            failures.append(f"{rel(path)} invalid JSON: {exc}")
            continue
        if not isinstance(payload, dict):
            failures.append(f"{rel(path)} is not a JSON object")
            continue
        if "status" not in payload:
            failures.append(f"{rel(path)} missing status")
        if "output" not in payload and "result" not in payload:
            failures.append(f"{rel(path)} missing output/result")
        if "agents" not in payload and "agent_trace" not in payload and "agents_used" not in payload:
            failures.append(f"{rel(path)} missing agents/agent_trace")
        if ("trace_id" not in payload and "log_file" not in payload) and ("agent_trace" in payload):
            failures.append(f"{rel(path)} missing trace_id/log_file")
        failures.extend(check_output_trace_reference(path, payload))
    if len(set(payload_texts)) <= 1 and len(payload_texts) >= 3:
        failures.append("output examples are identical")
    status = "FAIL" if failures else "WARN" if warnings else "PASS"
    pf.add(
        "output_examples",
        status,
        "; ".join(failures or warnings) or f"{len(files)} JSON outputs parse, are not identical, and trace/log references match.",
    )


def check_output_trace_reference(path: Path, payload: Dict[str, Any]) -> List[str]:
    failures: List[str] = []
    log_file = str(payload.get("log_file") or "").strip()
    trace_id = str(payload.get("trace_id") or "").strip()
    if not log_file:
        failures.append(f"{rel(path)} missing log_file")
        return failures
    log_path = ROOT / log_file
    try:
        log_path.relative_to(ROOT)
    except ValueError:
        failures.append(f"{rel(path)} log_file points outside repo")
        return failures
    if not log_path.exists():
        failures.append(f"{rel(path)} log_file missing: {log_file}")
        return failures
    events, parse_failures = parse_jsonl(log_path)
    failures.extend(parse_failures)
    if trace_id:
        trace_ids = {str(event.get("trace_id")) for event in events if event.get("trace_id")}
        if trace_ids and trace_id not in trace_ids:
            failures.append(f"{rel(path)} trace_id does not match {log_file}")
        elif not trace_ids:
            failures.append(f"{log_file} has no trace_id values to match {rel(path)}")
    return failures


def parse_jsonl(path: Path) -> Tuple[List[Dict[str, Any]], List[str]]:
    events: List[Dict[str, Any]] = []
    failures: List[str] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
            if isinstance(value, dict):
                events.append(value)
        except Exception as exc:
            failures.append(f"{rel(path)}:{line_number} invalid JSONL: {exc}")
    return events, failures


def check_logs(pf: Preflight) -> None:
    directory = ROOT / "logs"
    failures: List[str] = []
    warnings: List[str] = []
    if not directory.exists():
        pf.add("logs", "FAIL", "logs/ directory is missing")
        return
    files = sorted(directory.glob("*.jsonl"))
    if not files:
        failures.append("no .jsonl files found")
    all_trace_events: List[Dict[str, Any]] = []
    for path in files:
        events, parse_failures = parse_jsonl(path)
        failures.extend(parse_failures)
        all_trace_events.extend([event for event in events if event.get("agent_name")])
    agent_names = {str(event.get("agent_name")) for event in all_trace_events if event.get("agent_name")}
    has_target = any(event.get("target_agent") for event in all_trace_events)
    actions = [str(event.get("action", "")).lower() for event in all_trace_events]
    has_collaboration = any(any(keyword in action for keyword in COLLABORATION_ACTIONS) for action in actions)
    shared_context_keys = {
        "casefacts",
        "evidencematches",
        "missingevidence",
        "specialistfindings",
        "precedents",
        "compassadvisory",
        "decisiondraft",
        "requiredactions",
        "humanreviewrequired",
        "finaldecision",
        "retrievalcontext",
        "learningcontext",
    }
    has_shared_context = any(str(event.get("memory_key", "")).lower() in shared_context_keys for event in all_trace_events)
    if len(agent_names) < 2:
        failures.append("fewer than 2 distinct agent_name values in trace logs")
    if not has_target:
        failures.append("no target_agent values found in trace logs")
    if not has_collaboration:
        failures.append("no collaboration action found in trace logs")
    if not has_shared_context:
        failures.append("no shared context memory_key found in trace logs")
    if len(set(actions)) <= 1 and len(actions) > 1:
        warnings.append("trace actions look generic or identical")
    status = "FAIL" if failures else "WARN" if warnings else "PASS"
    details = "; ".join(failures or warnings) or f"{len(files)} JSONL file(s) parse; {len(agent_names)} distinct trace agents found."
    pf.add("logs", status, details)


def git_files() -> List[Path]:
    commands = [["git", "ls-files"], ["git", "ls-files", "--others", "--exclude-standard"]]
    files: List[Path] = []
    for command in commands:
        try:
            completed = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)
        except Exception:
            continue
        if completed.returncode != 0:
            continue
        for line in completed.stdout.splitlines():
            path = ROOT / line
            if path.is_file() and path not in files:
                files.append(path)
    if files:
        return files
    return [path for path in ROOT.rglob("*") if path.is_file() and ".git" not in path.parts and "node_modules" not in path.parts]


def should_scan_file(path: Path) -> bool:
    if any(part in {".git", "node_modules", ".venv", "venv", "__pycache__"} for part in path.parts):
        return False
    if path.suffix.lower() in {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2"}:
        return False
    return path.suffix.lower() in TEXT_EXTENSIONS or path.name in {".env.example", ".gitignore", "Dockerfile"}


def check_secret_scan(pf: Preflight) -> None:
    failures: List[str] = []
    scanned = 0
    for path in git_files():
        if not should_scan_file(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        scanned += 1
        is_env_example = path.name == ".env.example"
        if TOKEN_RE.search(text):
            failures.append(f"{rel(path)} contains token-like sk- value")
        for key, value in ASSIGNMENT_RE.findall(text):
            if is_env_example and is_placeholder(value):
                continue
            if not is_placeholder(value):
                failures.append(f"{rel(path)} contains non-placeholder {key}")
        for match in BEARER_RE.findall(text):
            if not is_placeholder(match):
                failures.append(f"{rel(path)} contains literal Authorization: Bearer value")
        for match in API_KEY_LITERAL_RE.findall(text):
            if not is_placeholder(match) and match.lower() not in {"true", "false", "configured"}:
                failures.append(f"{rel(path)} contains suspicious api_key literal")
    unique_failures = sorted(set(failures))
    pf.add("Secret scan", "FAIL" if unique_failures else "PASS", "; ".join(unique_failures[:8]) if unique_failures else f"Scanned {scanned} source/example files; no obvious secrets found.")


def check_static_data_size(pf: Preflight) -> None:
    data_dir = ROOT / "data"
    if not data_dir.exists():
        pf.add("Static data size", "PASS", "No data/ directory present.")
        return
    total = 0
    for path in data_dir.rglob("*"):
        if path.is_file():
            total += path.stat().st_size
    limit = 500 * 1024 * 1024
    status = "FAIL" if total > limit else "PASS"
    pf.add("Static data size", status, f"data/ size is {total / (1024 * 1024):.1f} MB; limit is 500 MB.")


def run_api_smoke(pf: Preflight) -> None:
    started = time.monotonic()
    env = os.environ.copy()
    env.setdefault("PORT", "8000")
    env.setdefault("LOG_DIR", "./logs")
    env.setdefault("SAMPLE_MODE", "true")
    env.setdefault("OPENAI_BASE_URL", "https://compass.core42.ai/v1")
    env.setdefault("OPENAI_API_KEY", "dummy")
    env.setdefault("P42_VECTOR_STORE_PROVIDER", "local")
    env["PYTHONUNBUFFERED"] = "1"
    process = subprocess.Popen(
        [sys.executable, "run.py"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        if not wait_for_health("http://127.0.0.1:8000", timeout_seconds=35):
            stderr = ""
            try:
                _, stderr = process.communicate(timeout=1)
            except subprocess.TimeoutExpired:
                pass
            pf.add("API smoke", "FAIL", f"Server did not become healthy. {clean_detail(stderr)}")
            return
        payload = read_json(ROOT / "input_examples" / "example_1.json")
        run_started = time.monotonic()
        status, body = http_json("http://127.0.0.1:8000/run", method="POST", payload=payload, timeout=900)
        runtime = time.monotonic() - run_started
        if status != 200:
            pf.add("API smoke", "FAIL", f"/run returned HTTP {status}")
            return
        if not isinstance(body, dict):
            pf.add("API smoke", "FAIL", "/run response was not a JSON object")
            return
        response_status = body.get("status")
        structured_error = response_status == "error" and isinstance(body.get("error"), dict)
        has_trace_ref = bool(body.get("trace_id") or body.get("log_file") or body.get("agent_trace"))
        if response_status != "success" and not structured_error:
            pf.add("API smoke", "FAIL", f"/run returned unstructured status: {response_status}")
            return
        if not has_trace_ref:
            pf.add("API smoke", "FAIL", "/run response missing trace/log reference")
            return
        if runtime > 900:
            pf.add("API smoke", "FAIL", f"/run runtime exceeded 900 seconds: {runtime:.1f}s")
            return
        pf.add("API smoke", "PASS", f"/health and /run passed in {time.monotonic() - started:.2f}s; status={response_status}.")
    except Exception as exc:
        pf.add("API smoke", "FAIL", f"API smoke failed: {exc.__class__.__name__}: {clean_detail(str(exc))}")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=8)


def run_npm_qa(pf: Preflight) -> None:
    try:
        code, stdout, stderr = run_command(["npm", "run", "qa"], timeout=1200)
    except Exception as exc:
        pf.add("npm run qa", "FAIL", f"Unable to run npm QA: {exc}")
        return
    detail = clean_detail((stdout + "\n" + stderr).splitlines()[-1] if (stdout or stderr) else "")
    pf.add("npm run qa", "PASS" if code == 0 else "FAIL", detail or f"exit={code}")


def run_compass_doctor(pf: Preflight, *, strict: bool = False) -> None:
    command = [sys.executable, "scripts/compass_doctor.py", "--json"]
    if strict:
        command.append("--strict")
    try:
        code, stdout, stderr = run_command(command, timeout=120)
    except Exception as exc:
        pf.add("Compass doctor", "FAIL" if strict else "WARN", f"Unable to run compass_doctor.py: {exc.__class__.__name__}")
        return

    payload: Dict[str, Any] = {}
    decoder = json.JSONDecoder()
    stripped = stdout.lstrip()
    if stripped:
        try:
            payload, _ = decoder.raw_decode(stripped)
        except Exception:
            payload = {}
    status = str(payload.get("status") or ("FAIL" if code else "PASS"))
    doctor = payload.get("doctor") if isinstance(payload.get("doctor"), dict) else {}
    message = clean_detail(str(doctor.get("message") or payload.get("message") or stderr or "Compass doctor completed."))
    if status == "PASS":
        pf.add("Compass doctor", "PASS", message)
    elif status == "SKIPPED":
        pf.add("Compass doctor", "FAIL" if strict else "SKIP", message)
    else:
        pf.add("Compass doctor", "FAIL" if strict else "WARN", message)


def run_qdrant_smoke(pf: Preflight, *, strict: bool = False) -> None:
    command = [sys.executable, "scripts/qdrant_smoke.py", "--json"]
    try:
        code, stdout, stderr = run_command(command, timeout=180)
    except Exception as exc:
        pf.add("Qdrant smoke", "FAIL" if strict else "WARN", f"Unable to run qdrant_smoke.py: {exc.__class__.__name__}")
        return

    payload: Dict[str, Any] = {}
    decoder = json.JSONDecoder()
    stripped = stdout.lstrip()
    if stripped:
        try:
            payload, _ = decoder.raw_decode(stripped)
        except Exception:
            payload = {}
    status = str(payload.get("status") or ("FAIL" if code else "PASS"))
    smoke = payload.get("qdrant_smoke") if isinstance(payload.get("qdrant_smoke"), dict) else {}
    details = clean_detail(
        str(
            smoke.get("reason")
            or smoke.get("message")
            or f"provider={smoke.get('provider', 'unknown')} collection={smoke.get('collection', '')} matches={smoke.get('matchCount', 0)}"
            or stderr
        )
    )
    if status == "PASS":
        pf.add("Qdrant smoke", "PASS", details)
    elif status == "SKIPPED":
        pf.add("Qdrant smoke", "FAIL" if strict else "SKIP", details)
    else:
        pf.add("Qdrant smoke", "FAIL" if strict else "WARN", details or "Qdrant smoke failed.")


def run_docker_smoke(pf: Preflight) -> None:
    docker = shutil.which("docker")
    if not docker:
        pf.add("Docker smoke", "SKIP", "Docker CLI is not installed in this environment.")
        return
    image = "parallax42-agentathon-preflight"
    container = f"parallax42-agentathon-preflight-{os.getpid()}"
    try:
        code, stdout, stderr = run_command([docker, "build", "-t", image, "."], timeout=1200)
        if code != 0:
            pf.add("Docker smoke", "FAIL", f"docker build failed: {clean_detail(stderr or stdout)}")
            return
        run_cmd = [
            docker,
            "run",
            "-d",
            "--name",
            container,
            "-p",
            "8000:8000",
            "-e",
            "SAMPLE_MODE=true",
            "-e",
            "OPENAI_API_KEY=dummy",
            "-e",
            "OPENAI_BASE_URL=https://compass.core42.ai/v1",
            "-e",
            "P42_VECTOR_STORE_PROVIDER=local",
            image,
        ]
        code, stdout, stderr = run_command(run_cmd, timeout=120)
        if code != 0:
            pf.add("Docker smoke", "FAIL", f"docker run failed: {clean_detail(stderr or stdout)}")
            return
        if not wait_for_health("http://127.0.0.1:8000", timeout_seconds=45):
            pf.add("Docker smoke", "FAIL", "Docker container did not become healthy.")
            return
        payload = read_json(ROOT / "input_examples" / "example_1.json")
        status, body = http_json("http://127.0.0.1:8000/run", method="POST", payload=payload, timeout=900)
        if status == 200 and isinstance(body, dict) and body.get("status") in {"success", "error"}:
            pf.add("Docker smoke", "PASS", "docker build, /health, and /run completed.")
        else:
            pf.add("Docker smoke", "FAIL", f"Docker /run response invalid: HTTP {status}")
    except Exception as exc:
        pf.add("Docker smoke", "FAIL", f"Docker smoke failed: {exc.__class__.__name__}: {clean_detail(str(exc))}")
    finally:
        subprocess.run([docker, "rm", "-f", container], cwd=ROOT, text=True, capture_output=True, check=False)


def docker_local_status(pf: Preflight) -> str:
    for result in pf.results:
        if result.name == "Docker smoke":
            if result.status == "PASS":
                return "PASS"
            if result.status == "SKIP" and "not installed" in result.details.lower():
                return "SKIPPED_DOCKER_CLI_MISSING"
            return "FAIL"
    return "SKIPPED_DOCKER_NOT_REQUESTED"


def print_table(results: Iterable[CheckResult]) -> None:
    rows = list(results)
    name_width = max([len("Check"), *(len(row.name) for row in rows)])
    status_width = max([len("Status"), *(len(row.status) for row in rows)])
    print(f"{'Check'.ljust(name_width)}  {'Status'.ljust(status_width)}  Details")
    print(f"{'-' * name_width}  {'-' * status_width}  {'-' * 60}")
    for row in rows:
        print(f"{row.name.ljust(name_width)}  {row.status.ljust(status_width)}  {row.details}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Agentathon submission preflight checks.")
    parser.add_argument("--run-api", action="store_true", help="Start python run.py and smoke-test /health and /run.")
    parser.add_argument("--npm-qa", action="store_true", help="Run npm run qa.")
    parser.add_argument("--compass-probe", action="store_true", help="Run Compass doctor for backward-compatible live probe behavior.")
    parser.add_argument("--compass-doctor", action="store_true", help="Run scripts/compass_doctor.py diagnostics.")
    parser.add_argument("--strict-compass", action="store_true", help="Fail if Compass env/probe is absent or unsuccessful.")
    parser.add_argument("--qdrant-smoke", action="store_true", help="Run scripts/qdrant_smoke.py diagnostics.")
    parser.add_argument("--strict-qdrant", action="store_true", help="Fail if Qdrant env/smoke is absent or unsuccessful.")
    parser.add_argument("--docker", action="store_true", help="Run Docker build/container smoke test if docker CLI is available.")
    parser.add_argument("--json", action="store_true", help="Emit JSON summary before the final machine-readable line.")
    args = parser.parse_args()

    pf = Preflight()
    check_required_files(pf)
    check_metadata(pf)
    check_env_example(pf)
    check_input_examples(pf)
    check_output_examples(pf)
    check_logs(pf)
    check_secret_scan(pf)
    check_static_data_size(pf)

    if args.run_api:
        run_api_smoke(pf)
    if args.npm_qa:
        run_npm_qa(pf)
    if args.compass_probe or args.compass_doctor or args.strict_compass:
        run_compass_doctor(pf, strict=args.strict_compass)
    if args.qdrant_smoke or args.strict_qdrant:
        run_qdrant_smoke(pf, strict=args.strict_qdrant)
    if args.docker:
        run_docker_smoke(pf)

    print_table(pf.results)
    if args.json:
        print(json.dumps(pf.summary(), indent=2, sort_keys=True))
    if args.docker:
        print(f"DOCKER_LOCAL={docker_local_status(pf)}")
    status = "PASS" if pf.passed else "FAIL"
    print(f"AGENTATHON_PREFLIGHT={status}")
    return 0 if pf.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
