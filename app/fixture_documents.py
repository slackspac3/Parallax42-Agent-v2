"""Safe synthetic fixture document support for Agentathon demo runs.

Only generated PDFs under test-fixtures/compliance-documents are eligible. This
module intentionally does not provide arbitrary filesystem or URL reading.
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = ROOT / "test-fixtures" / "compliance-documents"
MANIFEST_PATH = FIXTURE_DIR / "manifest.json"
GOLDEN_MATRIX_PATH = FIXTURE_DIR / "golden_matrix.json"


class FixtureDocumentError(ValueError):
    """Raised for unsupported or unsafe fixture references."""


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _load_json(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _manifest() -> Dict[str, Any]:
    return _load_json(MANIFEST_PATH)


def _golden_matrix() -> Dict[str, Any]:
    return _load_json(GOLDEN_MATRIX_PATH)


def listSupportedFixtureDocuments() -> List[Dict[str, Any]]:
    """Return sanitized manifest entries for supported fixture PDFs."""

    documents = _manifest().get("documents")
    if not isinstance(documents, list):
        return []
    return [copy.deepcopy(item) for item in documents if isinstance(item, dict) and _clean(item.get("filename"))]


def _fixture_by_filename() -> Dict[str, Dict[str, Any]]:
    return {item["filename"]: item for item in listSupportedFixtureDocuments()}


def getFixtureDocumentByFilename(filename: str) -> Dict[str, Any] | None:
    return copy.deepcopy(_fixture_by_filename().get(Path(str(filename or "")).name))


def getFixtureExpectedProfile(filename: str) -> Dict[str, Any] | None:
    target = Path(str(filename or "")).name
    fixtures = _golden_matrix().get("fixtures")
    if not isinstance(fixtures, list):
        return None
    for fixture in fixtures:
        if isinstance(fixture, dict) and fixture.get("filename") == target:
            return copy.deepcopy(fixture)
    return None


def _looks_like_forbidden_url(value: str) -> bool:
    lowered = value.lower()
    if "://" in lowered or lowered.startswith(("http:", "https:")):
        return True
    return any(token in lowered for token in ("railway.app", "railway.com", "vercel.app", "vercel.com", "dashboard"))


def safeResolveFixturePath(pathOrFilename: str) -> Path:
    """Resolve a fixture filename/path while rejecting traversal and URLs."""

    raw = _clean(pathOrFilename)
    if not raw:
        raise FixtureDocumentError("fixture reference is empty")
    if _looks_like_forbidden_url(raw):
        raise FixtureDocumentError("fixture reference must be a local generated fixture filename, not a hosted URL")
    parsed = urlparse(raw)
    if parsed.scheme or parsed.netloc:
        raise FixtureDocumentError("fixture reference must not be a URL")

    supported = _fixture_by_filename()
    filename = Path(raw).name
    if filename not in supported:
        raise FixtureDocumentError(f"unsupported fixture document: {filename}")
    manifest_path = _clean(supported[filename].get("path")) or filename
    candidate = Path(raw)
    if candidate.is_absolute():
        resolved = candidate.resolve()
    elif str(candidate).replace("\\", "/").startswith("test-fixtures/compliance-documents/"):
        resolved = (ROOT / candidate).resolve()
    elif raw == filename:
        resolved = (FIXTURE_DIR / filename).resolve()
    else:
        resolved = (FIXTURE_DIR / filename).resolve()
    expected = (ROOT / manifest_path).resolve()
    if resolved != expected:
        raise FixtureDocumentError("fixture reference did not resolve to its generated manifest path")
    if not str(resolved).startswith(str(FIXTURE_DIR.resolve()) + "/"):
        raise FixtureDocumentError("fixture reference escaped the fixture directory")
    if not resolved.exists():
        raise FixtureDocumentError(f"fixture file not found: {filename}")
    return resolved


def _decode_pdf_string(value: str) -> str:
    out: List[str] = []
    index = 0
    while index < len(value):
        char = value[index]
        if char == "\\" and index + 1 < len(value):
            nxt = value[index + 1]
            if nxt in "\\()":
                out.append(nxt)
                index += 2
                continue
            if nxt == "n":
                out.append("\n")
                index += 2
                continue
            if nxt == "r":
                out.append("\r")
                index += 2
                continue
            if nxt == "t":
                out.append("\t")
                index += 2
                continue
        out.append(char)
        index += 1
    return "".join(out)


def _extract_text_from_generated_pdf(path: Path) -> str:
    raw = path.read_bytes().decode("latin-1", "ignore")
    chunks: List[str] = []
    # The generated fixtures write one literal text object per rendered line:
    # BT ... Td (escaped text) Tj ET. That keeps extraction dependency-light.
    for match in re.finditer(r"\((?:\\.|[^\\()])*\)\s*Tj", raw):
        token = match.group(0)
        value = token[1 : token.rfind(")")]
        text = _clean(_decode_pdf_string(value))
        if text:
            chunks.append(text)
    return "\n".join(chunks)


def _profile_text(document: Dict[str, Any], profile: Dict[str, Any] | None) -> str:
    profile = profile or {}
    parts = [
        document.get("title"),
        profile.get("serviceSummary"),
        f"Provider: {profile.get('provider') or profile.get('supplier')}",
        f"Domain: {profile.get('domain')}",
        "Risk domains: " + ", ".join(profile.get("expectedRiskDomains") or document.get("tags") or []),
        "Missing evidence: " + ", ".join(profile.get("expectedMissingEvidence") or []),
        "Required actions: " + ", ".join(profile.get("expectedRequiredActionKeywords") or []),
    ]
    return "\n".join(_clean(part) for part in parts if _clean(part))


def extractFixtureDocument(pathOrFilename: str) -> Dict[str, Any]:
    """Extract text for a supported generated fixture, falling back to profile metadata."""

    path = safeResolveFixturePath(pathOrFilename)
    document = getFixtureDocumentByFilename(path.name) or {"filename": path.name, "title": path.name, "tags": []}
    profile = getFixtureExpectedProfile(path.name)
    text = ""
    status = "failed"
    try:
        text = _extract_text_from_generated_pdf(path)
        status = "text_extracted" if len(text) >= 200 else "metadata_fallback"
    except Exception:
        status = "metadata_fallback"
    if status != "text_extracted":
        text = _profile_text(document, profile)
    return {
        "filename": document.get("filename") or path.name,
        "title": document.get("title") or path.name,
        "tags": document.get("tags") if isinstance(document.get("tags"), list) else [],
        "pages": int(document.get("pages") or 0),
        "text": text,
        "extractionStatus": status,
        "source": "fixture_pdf",
        "path": document.get("path") or f"test-fixtures/compliance-documents/{path.name}",
        "expectedProfile": profile or {},
    }


def _fixture_target_agent(profile: Dict[str, Any]) -> str:
    domains = " ".join(profile.get("expectedRiskDomains") or [profile.get("domain", "")]).lower()
    if any(token in domains for token in ("privacy", "retention", "subprocessor", "transfer", "consent")):
        return "Privacy Specialist"
    if any(token in domains for token in ("ai", "model", "responsible")):
        return "Responsible AI Specialist"
    return "Security Specialist"


def fixture_documents_from_payload(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    input_payload = payload.get("input") if isinstance(payload.get("input"), dict) else {}
    raw_documents = input_payload.get("documents")
    if not isinstance(raw_documents, list):
        return [], []
    extracted: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []
    for raw in raw_documents:
        if not isinstance(raw, dict):
            continue
        reference = _clean(raw.get("filename") or raw.get("path") or raw.get("fileName"))
        if not reference:
            continue
        try:
            extracted.append(extractFixtureDocument(reference))
        except FixtureDocumentError as exc:
            if Path(reference).name in _fixture_by_filename() or "test-fixtures/compliance-documents" in reference:
                rejected.append({"reference": reference, "error": str(exc)})
    return extracted, rejected


def enrich_payload_with_fixture_documents(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Return a payload copy with fixture PDFs converted into evidence artifacts."""

    enriched = copy.deepcopy(payload)
    input_payload = enriched.setdefault("input", {})
    if not isinstance(input_payload, dict):
        enriched["input"] = input_payload = {}
    extracted, rejected = fixture_documents_from_payload(enriched)
    if not extracted and not rejected:
        return enriched, {
            "documents_used": [],
            "detected_domain": "",
            "extraction_status": "",
            "expected_profile_match": False,
            "matched_risk_domains": [],
            "matched_missing_evidence": [],
            "rejected": [],
        }

    existing_documents = input_payload.get("documents") if isinstance(input_payload.get("documents"), list) else []
    replaced_documents: List[Any] = []
    extracted_by_filename = {item["filename"]: item for item in extracted}
    for raw in existing_documents:
        if isinstance(raw, dict):
            reference = _clean(raw.get("filename") or raw.get("path") or raw.get("fileName"))
            filename = Path(reference).name if reference else ""
            fixture = extracted_by_filename.get(filename)
            if fixture:
                profile = fixture.get("expectedProfile") if isinstance(fixture.get("expectedProfile"), dict) else {}
                text = fixture.get("text", "")
                replaced_documents.append(
                    {
                        **raw,
                        "id": raw.get("id") or raw.get("evidenceId") or f"fixture-{fixture['filename']}",
                        "evidenceId": raw.get("evidenceId") or f"FIXTURE-{fixture['filename'].split('_', 1)[0]}",
                        "title": fixture["title"],
                        "filename": fixture["filename"],
                        "fileName": fixture["filename"],
                        "source": "fixture_pdf",
                        "sourceType": "fixture_pdf",
                        "text": text,
                        "summary": _clean(profile.get("serviceSummary") or text[:700]),
                        "excerpt": _clean(text[:700]),
                        "extractionStatus": fixture["extractionStatus"],
                        "documentType": profile.get("domain") or "fixture_contract",
                        "signals": list(dict.fromkeys((profile.get("expectedRiskDomains") or []) + (fixture.get("tags") or []))),
                        "fixtureProfile": profile,
                    }
                )
                continue
        replaced_documents.append(raw)
    input_payload["documents"] = replaced_documents

    profiles = [item.get("expectedProfile") for item in extracted if isinstance(item.get("expectedProfile"), dict)]
    matched_domains = list(dict.fromkeys(domain for profile in profiles for domain in profile.get("expectedRiskDomains", [])))
    matched_missing = list(dict.fromkeys(item for profile in profiles for item in profile.get("expectedMissingEvidence", [])))
    detected_domain = _clean(profiles[0].get("domain")) if profiles else ""
    analysis = {
        "documents_used": [
            {
                "filename": item["filename"],
                "title": item["title"],
                "pages": item.get("pages", 0),
                "extractionStatus": item["extractionStatus"],
                "source": "fixture_pdf",
            }
            for item in extracted
        ],
        "detected_domain": detected_domain,
        "extraction_status": extracted[0]["extractionStatus"] if extracted else "",
        "expected_profile_match": bool(profiles),
        "matched_risk_domains": matched_domains,
        "matched_missing_evidence": matched_missing,
        "target_agent": _fixture_target_agent(profiles[0]) if profiles else "Evidence Retrieval Agent",
        "rejected": rejected,
    }
    input_payload["_fixture_document_analysis"] = analysis
    return enriched, analysis
