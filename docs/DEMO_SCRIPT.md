# Watch The Agent Work Demo Script

## Goal

Record a short demo that proves the agent is production-oriented and audit-aware.

## Flow

1. Open the cockpit.
2. Run the high-risk AI SaaS sample case.
3. Show the decision: `Do not approve yet` or conditional approval depending on evidence.
4. Show domain scan:
   - AI and model governance
   - privacy and data governance
   - technical risk
   - third-party compliance
   - continuity if critical-service terms are present
5. Show blocking gaps:
   - missing DPA
   - unclear model-training data use
   - missing continuity/exit evidence
6. Show evidence IDs and trace events.
7. Open `/api/audit/recent` to show persisted audit record.
8. Open `/api/benchmarks` to show benchmark proof.
9. Open CrewAI dry-run output:

```bash
python3 crewai_adapter/compliance_crew.py --dry-run
```

10. Close with the linked live Parallax42 backend and Compass gateway health checks.

## Talk Track

This agent does not replace human approval. It standardizes the compliance review path, retrieves and names evidence, identifies missing controls, blocks unsupported approvals, and produces an audit-ready decision brief.
