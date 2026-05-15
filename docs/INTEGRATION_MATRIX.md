# Integration Matrix

| Integration | Current State | Target For Submission |
| --- | --- | --- |
| Parallax42 FastAPI backend | Live endpoint exists and Vercel relay is allowlisted for browser-safe demo calls. | Link as production deployment evidence and capture health proof. |
| Compass gateway | Live health confirms configured model/key/token presence. | Show one safe smoke test and explain boundary. |
| GitHub Pages UI | Static cockpit has runtime controls for local, relay, and live-backend focus modes. | Use as "Watch the Agent Work" entry point or record from it. |
| Vercel Functions | API handlers exist for health, readiness, benchmark, agent run, audit, and backend relay. | Deploy and point Pages `public/config.js` at the Vercel URL. |
| OCR/document parsing | Available in Parallax42 backend. | Demonstrate PDF/DOCX evidence intake. |
| Coupa/ServiceNow/Dynamics/GRC/SharePoint/SAP/Ariba/Oracle/Workday | Normalization API documented in Parallax42, with local sample payloads under `examples/integrations/`. | Add screenshots and live replay evidence. |
| Microsoft Entra ID | Roadmap only. | Implement or clearly mark as planned enterprise hardening. |
| PostgreSQL | Optional/scaffolded in Parallax42; this repo uses JSONL plus Vercel `/tmp` fallback. | Enable for durable run/audit records. |
| Qdrant/vector memory | Server-side vector-store boundary implemented with local-file demo fallback and Qdrant-compatible production configuration. | Configure managed vector DB credentials for enterprise retention and multi-instance Vercel deployments. |
| AI assurance portal | Separate repo. | Use for Responsible AI benchmark evidence. |

## Priority Order

1. Live Parallax42 backend and demo proof.
2. Durable run/audit persistence.
3. Entra-ready RBAC.
4. Benchmark and Responsible AI report export.
5. Integration examples for role-relevant enterprise systems.
