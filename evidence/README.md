# Evidence Artifacts

Run:

```bash
npm run capture:evidence
```

Generated artifacts:

| File | Contents |
| --- | --- |
| `index.json` | Evidence manifest and summary. |
| `live-health.json` | Parallax42 backend and Compass gateway health snapshots. |
| `benchmark-report.json` | Local benchmark report. |
| `readiness.json` | Submission readiness inventory. |
| `sample-agent-run.json` | Sample compliance case decision, gaps, evidence IDs, and trace. |

Do not place secrets, raw customer documents, or private uploads in this directory.
