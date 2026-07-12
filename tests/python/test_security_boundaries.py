from __future__ import annotations

import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.agentathon_orchestrator import AgentathonOrchestrator
from app.evidence_memory import QdrantEvidenceMemory, _evidence_point_id
from app.learning_memory import (
    LocalLearningMemory,
    QdrantLearningMemory,
    _learning_point_id,
    load_seed_artifacts,
)
from app.main import app
from app.node_bridge import DEFAULT_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS, _node_contract_failures, _timeout_seconds
from app.trace_logger import TraceLogger, safe_run_id


class FakeMatchValue:
    def __init__(self, value):
        self.value = value


class FakeFieldCondition:
    def __init__(self, key, match):
        self.key = key
        self.match = match


class FakeFilter:
    def __init__(self, must):
        self.must = must


class FilterableEvidenceMemory(QdrantEvidenceMemory):
    def _qdrant_imports(self):
        return {
            "FieldCondition": FakeFieldCondition,
            "Filter": FakeFilter,
            "MatchValue": FakeMatchValue,
        }


class FilterableLearningMemory(QdrantLearningMemory):
    def _imports(self):
        return {
            "FieldCondition": FakeFieldCondition,
            "Filter": FakeFilter,
            "MatchValue": FakeMatchValue,
        }


def filter_values(qdrant_filter):
    return {condition.key: condition.match.value for condition in qdrant_filter.must}


class NamespaceIsolationTests(unittest.TestCase):
    def test_evidence_ids_and_filters_include_complete_namespace(self):
        payload = {
            "workspaceId": "workspace-a",
            "projectId": "project-a",
            "caseId": "case-1",
            "documentId": "doc-1",
            "evidenceId": "evidence-1",
            "chunkIndex": 0,
        }
        original = _evidence_point_id(payload)
        self.assertNotEqual(original, _evidence_point_id({**payload, "workspaceId": "workspace-b"}))
        self.assertNotEqual(original, _evidence_point_id({**payload, "projectId": "project-b"}))
        self.assertNotEqual(original, _evidence_point_id({**payload, "caseId": "case-2"}))

        provider = FilterableEvidenceMemory()
        values = filter_values(
            provider._filter(case_id="case-1", workspace_id="workspace-a", project_id="project-a")
        )
        self.assertEqual(
            values,
            {
                "type": "evidence_chunk",
                "workspaceId": "workspace-a",
                "projectId": "project-a",
                "caseId": "case-1",
            },
        )

    def test_learning_ids_filters_and_local_reads_are_namespace_scoped(self):
        payload = {"memoryId": "shared-id", "workspaceId": "workspace-a", "projectId": "project-a"}
        original = _learning_point_id(payload)
        self.assertNotEqual(original, _learning_point_id({**payload, "workspaceId": "workspace-b"}))
        self.assertNotEqual(original, _learning_point_id({**payload, "projectId": "project-b"}))

        qdrant = FilterableLearningMemory(
            workspace_id="workspace-a",
            project_id="project-a",
            sample_mode=False,
        )
        self.assertEqual(
            filter_values(qdrant._filter()),
            {
                "memoryType": "learning_artifact",
                "advisoryOnly": True,
                "workspaceId": "workspace-a",
                "projectId": "project-a",
            },
        )

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "learning.jsonl"
            tenant_a = LocalLearningMemory(
                path,
                workspace_id="workspace-a",
                project_id="project-a",
                sample_mode=False,
            )
            tenant_b = LocalLearningMemory(
                path,
                workspace_id="workspace-b",
                project_id="project-a",
                sample_mode=False,
            )
            tenant_a.store_feedback(
                {
                    "memoryId": "shared-id",
                    "caseId": "case-a",
                    "workspaceId": "attacker-selected",
                    "title": "Retention control alpha",
                    "missingEvidence": ["retention schedule"],
                }
            )
            tenant_b.store_feedback(
                {
                    "memoryId": "shared-id",
                    "caseId": "case-b",
                    "title": "Retention control beta",
                    "missingEvidence": ["retention schedule"],
                }
            )

            a_cases = tenant_a.find_similar_cases({}, ["retention schedule"], ["privacy"])["similarCases"]
            b_cases = tenant_b.find_similar_cases({}, ["retention schedule"], ["privacy"])["similarCases"]
            self.assertEqual([item["caseId"] for item in a_cases], ["case-a"])
            self.assertEqual([item["caseId"] for item in b_cases], ["case-b"])
            first_record = json.loads(path.read_text(encoding="utf-8").splitlines()[0])
            self.assertEqual(first_record["workspaceId"], "workspace-a")

    def test_orchestrator_prefers_server_scope_over_request_scope(self):
        identifiers = AgentathonOrchestrator()._case_identifiers(
            {
                "input": {
                    "case": {
                        "case_id": "case-1",
                        "workspace_id": "attacker-workspace",
                        "project_id": "attacker-project",
                    }
                }
            },
            "run-1",
            scope={"workspaceId": "server-workspace", "projectId": "server-project"},
        )
        self.assertEqual(identifiers["workspaceId"], "server-workspace")
        self.assertEqual(identifiers["projectId"], "server-project")


class AuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.base_env = {
            "P42_AUTH_MODE": "audit",
            "P42_DEMO_BEARER_TOKEN": "unit-reviewer-token",
            "P42_DEMO_ACTOR_ID": "reviewer-1",
            "P42_DEMO_WORKSPACE_ID": "server-workspace",
            "P42_DEMO_PROJECT_ID": "server-project",
            "SAMPLE_MODE": "false",
        }

    def test_feedback_requires_authenticated_reviewer_or_admin(self):
        with patch.dict(os.environ, {**self.base_env, "P42_DEMO_ROLES": "compliance_reviewer"}, clear=False):
            response = self.client.post("/learning/feedback", json={"caseId": "case-1"})
            self.assertEqual(response.status_code, 401)

        with patch.dict(os.environ, {**self.base_env, "P42_DEMO_ROLES": "read_only"}, clear=False):
            response = self.client.post(
                "/learning/feedback",
                headers={"Authorization": "Bearer unit-reviewer-token"},
                json={"caseId": "case-1"},
            )
            self.assertEqual(response.status_code, 403)

    def test_feedback_uses_server_scope_and_authenticated_actor(self):
        with patch.dict(os.environ, {**self.base_env, "P42_DEMO_ROLES": "compliance_reviewer"}, clear=False):
            with patch("app.main.store_feedback", return_value={"stored": True}) as store:
                response = self.client.post(
                    "/learning/feedback",
                    headers={"Authorization": "Bearer unit-reviewer-token"},
                    json={
                        "caseId": "case-1",
                        "workspaceId": "attacker-workspace",
                        "projectId": "attacker-project",
                    },
                )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(store.call_args.kwargs["workspace_id"], "server-workspace")
        self.assertEqual(store.call_args.kwargs["project_id"], "server-project")
        self.assertEqual(store.call_args.kwargs["actor"]["id"], "reviewer-1")

    def test_learning_reads_ignore_client_selected_namespace(self):
        with patch.dict(os.environ, self.base_env, clear=False):
            with patch("app.main.find_similar_cases", return_value={"similarCases": []}) as find:
                response = self.client.post(
                    "/learning/similar-cases",
                    json={
                        "workspaceId": "attacker-workspace",
                        "projectId": "attacker-project",
                        "caseFacts": {},
                    },
                )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(find.call_args.kwargs["workspace_id"], "server-workspace")
        self.assertEqual(find.call_args.kwargs["project_id"], "server-project")

    def test_logs_require_auditor_and_never_expose_filenames(self):
        with patch.dict(os.environ, {**self.base_env, "P42_DEMO_ROLES": "read_only"}, clear=False):
            self.assertEqual(self.client.get("/logs").status_code, 401)
            forbidden = self.client.get(
                "/logs",
                headers={"Authorization": "Bearer unit-reviewer-token"},
            )
            self.assertEqual(forbidden.status_code, 403)

        with patch.dict(os.environ, {**self.base_env, "P42_DEMO_ROLES": "auditor"}, clear=False):
            response = self.client.get(
                "/logs",
                headers={"Authorization": "Bearer unit-reviewer-token"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["entries"], [])
        self.assertNotIn("file", response.text.lower())
        self.assertEqual(response.headers["cache-control"], "private, no-store")


class TraceAndRuntimeTests(unittest.TestCase):
    def test_repeated_run_ids_never_truncate_or_reuse_trace_file(self):
        with tempfile.TemporaryDirectory() as directory:
            with contextlib.redirect_stdout(io.StringIO()):
                first = TraceLogger("same-run", "same-trace", log_dir=directory)
                first.log(agent_name="first", action="created")
            first_contents = first.path.read_text(encoding="utf-8")

            second = TraceLogger("same-run", "same-trace", log_dir=directory)
            self.assertNotEqual(first.path, second.path)
            self.assertEqual(first.path.read_text(encoding="utf-8"), first_contents)
            self.assertEqual(second.path.read_text(encoding="utf-8"), "")

        self.assertNotEqual(safe_run_id(None), safe_run_id(None))

    def test_node_timeout_is_finite_and_cannot_exceed_hard_cap(self):
        with patch.dict(os.environ, {"MAX_RUNTIME_SECONDS": "999"}, clear=False):
            self.assertEqual(_timeout_seconds(), MAX_TIMEOUT_SECONDS)
        with patch.dict(os.environ, {"MAX_RUNTIME_SECONDS": "nan"}, clear=False):
            self.assertEqual(_timeout_seconds(), DEFAULT_TIMEOUT_SECONDS)
        with patch.dict(os.environ, {"MAX_RUNTIME_SECONDS": "200"}, clear=False):
            self.assertEqual(_timeout_seconds({"timeout_seconds": 5}), 5)
            self.assertEqual(_timeout_seconds({"timeout_seconds": 999}), 200)

    def test_node_policy_contract_rejects_incomplete_or_inconsistent_success(self):
        valid = {
            "ok": True,
            "risk_level": "high",
            "decision": {"status": "conditionally_ready"},
            "gaps": [],
            "required_actions": [],
            "control_plan": [],
            "decision_readiness": {
                "status": "conditionally_ready",
                "approvalEligible": False,
                "humanApprovalRequired": True,
            },
        }
        self.assertEqual(_node_contract_failures(valid), [])
        self.assertIn("decision_readiness", _node_contract_failures({"ok": True, "decision": {"status": "ready"}}))
        contradictory = {
            **valid,
            "decision": {"status": "ready"},
            "decision_readiness": {
                **valid["decision_readiness"],
                "status": "ready",
                "approvalEligible": False,
            },
        }
        self.assertIn("decision_readiness.approvalEligible_consistency", _node_contract_failures(contradictory))

    def test_run_route_offloads_sync_orchestrator_with_server_scope(self):
        offload = AsyncMock(
            return_value={
                "status": "error",
                "error": {"type": "test_boundary", "message": "expected test response"},
            }
        )
        env = {
            "P42_AUTH_MODE": "audit",
            "P42_DEMO_WORKSPACE_ID": "",
            "P42_DEMO_PROJECT_ID": "",
            "P42_WORKSPACE_ID": "server-workspace",
            "P42_PROJECT_ID": "server-project",
        }
        with patch.dict(os.environ, env, clear=False), patch("app.main.run_in_threadpool", offload):
            response = TestClient(app).post(
                "/run",
                json={
                    "run_id": "run-1",
                    "input": {
                        "workspace_id": "attacker-workspace",
                        "project_id": "attacker-project",
                    },
                },
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            offload.await_args.args[2],
            {"workspaceId": "server-workspace", "projectId": "server-project"},
        )


class SampleModeTests(unittest.TestCase):
    def test_synthetic_learning_references_require_explicit_sample_mode(self):
        self.assertEqual(load_seed_artifacts(sample_mode=False), [])
        self.assertGreater(len(load_seed_artifacts(sample_mode=True)), 0)

    def test_sample_references_are_separate_from_case_evidence(self):
        orchestrator = AgentathonOrchestrator()
        payload = {"input": {}}
        node_result = {"citations": [], "gaps": [], "evidence_quality": {}}
        case_facts = {"workflow": "AI vendor review", "dataCategories": ["customer data"]}
        identifiers = {
            "caseId": "case-1",
            "workspaceId": "workspace-a",
            "projectId": "project-a",
        }
        with patch.dict(os.environ, {"P42_VECTOR_STORE_PROVIDER": "local", "SAMPLE_MODE": "false"}, clear=False):
            live = orchestrator._evidence_context(
                payload,
                node_result,
                case_facts,
                identifiers=identifiers,
                sample_mode=False,
            )
            sample = orchestrator._evidence_context(
                payload,
                node_result,
                case_facts,
                identifiers=identifiers,
                sample_mode=True,
            )

        self.assertNotIn("sampleReferences", live["retrieval_context"])
        references = sample["retrieval_context"]["sampleReferences"]
        self.assertTrue(references)
        self.assertTrue(all(item["referenceType"] == "sample_reference" for item in references))
        self.assertTrue(all(item["source"] == "sample-reference" for item in references))
        self.assertFalse(any(match.get("source") == "sample-reference" for match in sample["matches"]))


if __name__ == "__main__":
    unittest.main()
