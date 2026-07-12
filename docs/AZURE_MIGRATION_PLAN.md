# Parallax42 Agent v2 — Azure Migration Plan

**Plan date:** 2026-07-12

**Status:** proposed migration path; no Azure infrastructure is currently declared in this repository.
**Objective:** move the working demo to Azure without rewriting the product, preserve rollback at every stateful cutover, and add enterprise controls only when their requirement is real.

## Decision summary

Use a two-profile path:

1. **Azure demo parity:** containerize the existing Node product API and deploy it to Azure Container Apps while retaining the working Railway PostgreSQL/Qdrant and shared Compass gateway. Keep the static UI simple. This proves runtime parity with the smallest stateful blast radius.
2. **Production target:** Azure Front Door Premium + WAF serves a Storage static website and routes `/api/*` through API Management to an internal Container Apps environment. PostgreSQL Flexible Server is the system of record; Blob stores canonical documents and immutable audit exports; Azure AI Search becomes a derived vector index; Key Vault and managed identities replace application-held Azure credentials.

Do not port each Vercel function to Azure Functions. The routes share state, long-lived product logic, and calls that can approach or exceed normal request windows. One Node container around the existing `server.js` is simpler and easier to compare with Vercel. Azure Static Web Apps linked APIs also have a 45-second maximum request duration and do not support network-isolated backends, so they are not the selected production API boundary. [Azure Static Web Apps API support](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview)

Keep the shared Compass gateway and external parser initially. Azure hosting alone does not make those data flows Azure-resident; migrate them only when residency, vendor-exit, or reliability requirements justify the work.

## Outcomes and non-goals

### Required outcomes

- Same user behavior and policy output as the current Vercel deployment before any service substitution.
- Immutable, repeatable builds and environment promotion through GitHub OIDC.
- No public database, vector, audit, or secret endpoint.
- Tenant-derived authorization at every business-data read/write boundary.
- Durable case/run/review/audit records with tested backup and restore.
- Observable model, parser, retrieval, and policy calls without logging case content or credentials.
- Explicit canary, rollback, data cutover, and decommission gates.

### Non-goals for the first migration

- Rewriting the vanilla frontend or Node business logic.
- Introducing AKS.
- Replacing Compass or the parser before compute parity.
- Deploying the Python evaluator in the customer request path.
- Replacing Qdrant until canonical source documents and a shadow-query evaluation exist.
- Adding APIM or multi-region topology to a low-risk demo that does not require them.

## As-built baseline

| Capability | Current implementation | Important constraint |
|---|---|---|
| Static UI | `public/`, deployed on Vercel and GitHub Pages; root/docs mirrors exist | Multiple copied artifacts can drift; shared Pages origin is not appropriate for privileged enterprise tokens |
| Product API | Node 24/CommonJS Vercel handlers plus local `server.js` | Vercel and server route parity must be verified, not assumed |
| Evaluator | FastAPI container spawning Node through a bridge | It is separate from the product API and should remain CI/non-production initially |
| Case/session/quota state | PostgreSQL through the generic JSONB `p42_records` store | Runtime table creation is not a migration system; tenant isolation is application-only |
| Vector retrieval | Railway Qdrant REST | Stale generations/model mixing and score thresholds must be fixed before migration |
| Canonical evidence | Upload text/chunks are processed and indexed; no complete durable original-document store | A search index cannot be the system of record |
| Model access | Shared Vercel Compass gateway, named client token | Provider key remains at gateway; traffic leaves Azure after migration |
| Audit | Actor-derived workspace/project PostgreSQL hash chains with chain-head row locking; JSONL only for explicit local/test fallback | Durable/scoped foundation is implemented, but no immutable/WORM export, restore proof, versioned migration, or atomic coupling to critical business writes |
| Auth | Demo sessions/pilot tokens and route roles | Entra SSO, memberships, app roles, and Conditional Access are absent |
| Configuration | Vercel/Railway environment variables; some `/tmp` flags | Replica-local feature controls and rate limits will diverge |
| Delivery | GitHub Actions for QA/Pages; Vercel deployment outside workflow | No Azure IaC, registry, OIDC deployment, or promotion workflow exists |

The seven deep-review P0 findings in [DEEP_CODE_REVIEW.md](DEEP_CODE_REVIEW.md) are remediated and full local QA is green. Security finding P42-SEC-002 and the residual enterprise gates remain open. A no-traffic, synthetic-data compute shadow may begin after CI and deployment verification. User or pilot traffic still requires the Phase 0 and Phase 2 exit gates, including identity/membership/RLS, immutable audit export/business-write coupling, retention, admission control, and restore proof; moving code to Azure does not satisfy them.

## Target profiles

### Profile A — minimum working demo

```text
Browser
  -> Azure Container Apps ingress
       -> Node product container (serves public/ and /api)
            -> existing Railway PostgreSQL
            -> existing Railway Qdrant
            -> existing Compass gateway
            -> existing parser only when explicitly enabled

GitHub Actions -> OIDC -> ACR -> Container Apps revision
Container Apps -> OpenTelemetry -> Application Insights
```

This profile is deliberately small. One container origin avoids CORS and static-host coordination while validating Node runtime, environment, health probes, outbound connectivity, revisions, and rollback. Container Apps supports immutable revisions, traffic splitting, and health probes, making it a suitable parity target without AKS. [Container Apps revisions](https://learn.microsoft.com/en-us/azure/container-apps/revisions), [traffic splitting](https://learn.microsoft.com/en-us/azure/container-apps/traffic-splitting), [health probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)

Use it initially only as a no-traffic or synthetic-data parity environment. It can support a noncritical pilot only after the Phase 0 and Phase 2 release gates are satisfied, including P42-SEC-002, deployed workflow proof, identity/membership scope, immutable audit export/business coupling, retention, admission control, and restore evidence. External state remains outside Azure, and it is not an enterprise network architecture.

### Profile B — selected production target

```text
Users
  -> Azure Front Door Premium + WAF
       -> "/" -> Storage static website through Private Link
       -> "/api/*" -> API Management Standard v2 through Private Link
                         -> internal Container Apps: Node product API
                              -> PostgreSQL Flexible Server (private endpoint)
                              -> Blob Storage (private endpoint)
                              -> Azure AI Search (private endpoint)
                              -> Key Vault through managed identity
                              -> Compass gateway through controlled egress
                              -> parser service only when approved

GitHub Actions
  -> OIDC federation
  -> Azure Container Registry
  -> immutable Container Apps revision
  -> smoke + canary
  -> traffic promotion / revision rollback

OpenTelemetry
  -> Application Insights + Log Analytics (sanitized operations telemetry)

Compliance audit
  -> transactional PostgreSQL event ledger
  -> periodic hash-chained export
  -> immutable Blob container
```

Front Door Premium supports Private Link origins for Storage static websites, API Management, and Container Apps. Static Web Apps is not a supported Private Link origin for Front Door, which is why Storage is selected for the production static tier. [Front Door Private Link origins](https://learn.microsoft.com/en-us/azure/frontdoor/private-link), [Storage static-site origin](https://learn.microsoft.com/en-us/azure/frontdoor/how-to-enable-private-link-storage-static-website), [Front Door WAF](https://learn.microsoft.com/en-us/azure/frontdoor/web-application-firewall)

APIM is a production governance layer, not a day-one demo dependency. The selected topology uses **API Management Standard v2** with an inbound private endpoint from Front Door and outbound virtual-network integration to the internal Container Apps environment. It can validate Entra tokens, enforce route-specific quotas, inject correlation data, and apply managed identity policies, while the Node service must still authorize business resources. Confirm Standard v2 and Private Link availability in the selected region before Phase 3. [APIM authentication and authorization](https://learn.microsoft.com/en-us/azure/api-management/authentication-authorization-overview), [validate-jwt policy](https://learn.microsoft.com/en-us/azure/api-management/validate-jwt-policy), [APIM managed identity](https://learn.microsoft.com/en-us/azure/API-management/api-management-howto-use-managed-service-identity)

## Service mapping

| Current | Initial Azure step | Production target | Migration rule |
|---|---|---|---|
| Vercel/Pages static UI | Serve from Node parity container or public Storage | Storage static website behind Front Door | Deploy only `public/`; retain old origin until DNS rollback window closes |
| Vercel Node functions | One Node Container App | Internal Node Container App behind APIM | Preserve route contracts; do not refactor into individual Functions |
| FastAPI evaluator | CI-only | Optional internal/non-prod Container App or job | Never let it reinterpret the product decision |
| Railway PostgreSQL | Keep during compute shadow | PostgreSQL Flexible Server | Add versioned migrations and restore tests before copy |
| Railway Qdrant | Keep during compute/data cutover | Azure AI Search derived index | Dual-index and shadow-query; never perform a blind endpoint swap |
| Upload processing | Keep parser boundary | Blob canonical object + async parser job where required | Store original/hash/manifest before indexing |
| PostgreSQL audit chains | Preserve during compute shadow | Versioned PostgreSQL ledger + immutable Blob export | Keep tenant chain ordering/hashes; add WORM sealing and critical business-write coupling rather than replacing the current foundation |
| Vercel secrets | Environment values in parity | Key Vault references + managed identity | Product keeps only the Compass client token, never provider key |
| Demo auth | Preserve for public demo | Entra SPA/API registrations + app roles + memberships | Separate public demo and enterprise tenant modes |
| In-memory rate limit | Keep only as defense in depth | APIM/edge distributed quotas + app budgets | Key by authenticated tenant/actor/operation, not spoofable IP alone |
| Console/JSON logs | OTel SDK in shadow | Application Insights/Log Analytics | Allowlist attributes; exclude evidence text, prompts, tokens, vectors |
| GitHub/Vercel deploy | OIDC to ACR/Container Apps | environment promotion with approvals | No long-lived Azure client secret |

## Application changes required before Azure

### 1. Establish one product server

- Add a minimal production Dockerfile for the Node product around `server.js`.
- Add a non-root runtime user, a narrow `COPY`, a pinned Node base-image digest, and read-only root filesystem where compatible.
- Keep `/livez` process-only and cheap.
- Make `/readyz` strict, cached, and non-billable: database connection, selected vector provider, configuration validity, and gateway authentication metadata—not a chat completion.
- Run the same API contract and deployed E2E suite against Vercel and the container.

### 2. Add versioned database migrations

Replace request-time `CREATE TABLE IF NOT EXISTS` with one migration command that records schema versions. Before production Azure cutover, introduce explicit tables or equivalent constrained records for:

- organizations, workspaces, projects, memberships, and roles;
- cases and optimistic versions;
- immutable case runs;
- reviewer decisions and structured conditions;
- evidence objects, hashes, chunk manifests, and verification state;
- audit event sequence/hash/tenant fields;
- quotas/budgets and feature configuration.

Use managed identity/Entra authentication where supported by the chosen operational model, or a short-lived/rotated database secret from Key Vault. Enable PostgreSQL private networking and least-privilege application roles.

### 3. Make Blob the canonical document boundary

For each upload store:

- tenant/workspace/project/case IDs derived from the actor;
- opaque object ID and content hash;
- original filename only as metadata after sanitization;
- media type, byte length, upload actor/time, retention class;
- parser version/status and derived chunk-manifest version;
- malware/content-validation status where required;
- deletion/hold status.

The browser should upload through a short-lived, object-specific mechanism or the authenticated API; it should never receive a storage account key. Parser jobs read the object and write a versioned derived manifest. Search stores only derived content and identifiers.

### 4. Productionize the current audit ledger

The current implementation already establishes the minimum ledger primitive: workspace/project-scoped PostgreSQL chain heads/events, `SELECT ... FOR UPDATE` serialization, parameterized inserts, scoped verification/reads, and fail-closed hosted writes. Treat the schema created at runtime as a migration input, not the final Azure migration mechanism.

Preserve the implemented immutable `(workspaceId, projectId)` chain key; use a separate platform chain for cross-workspace administration. Maintain one `audit_chain_heads` row per workspace/project chain. An append transaction must lock that row with `SELECT ... FOR UPDATE`, allocate the next chain-local sequence, hash the canonical event with the locked prior hash, insert under a unique `(chainId, sequence)` constraint, update the head, and commit. A rollback must roll back the event and head together. A database sequence alone is insufficient because concurrent transactions could otherwise fork the same prior hash or commit out of order.

Residual work: append the audit event in the same database transaction as the critical case/review change when both live in PostgreSQL. Today the audit event/head transaction is internally atomic but separate from the business mutation. For operations spanning Blob/Search/external services, use a transactional outbox plus an idempotency key and record requested/completed/failed events; do not claim atomicity across services. Verification must start from a known genesis/seal and reject gaps, duplicate sequence numbers, hash mismatches, or events assigned to the wrong chain.

A scheduled job exports only committed contiguous ranges as hash-chained JSONL to a Blob container with an immutable WORM retention policy. Each export manifest records chain ID, start/end sequence, prior/start/end hashes, event count, schema version, Blob content hash, and seal time. A platform manifest can seal the set of workspace heads without serializing every tenant through one global append lock. Application Insights remains operational telemetry and must not be presented as the authoritative compliance audit.

Azure Blob supports soft delete/version protection and immutable retention. [Blob soft delete](https://learn.microsoft.com/en-us/azure/storage/blobs/soft-delete-blob-overview), [immutable Blob storage](https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview)

### 5. Externalize replica-sensitive controls

- Move feature flags out of `/tmp` into an approved configuration store or PostgreSQL.
- Move tenant/model budgets and quotas to transactional or distributed storage.
- Make feature changes versioned and audited.
- Keep emergency disable switches independently operable from the application release.

## Azure AI Search migration

Azure AI Search is not a drop-in Qdrant replacement. Preserve the existing evidence-store interface and add one provider branch using REST/fetch first; do not introduce a large SDK abstraction until it earns its cost.

### Initial index shape

| Field | Type/use |
|---|---|
| `chunkId` | Stable key |
| `workspaceId`, `projectId`, `caseId` | Filterable tenant scope; mandatory prefilter |
| `documentId`, `manifestVersion`, `chunkOrdinal` | Filterable provenance and generation |
| `memoryType` | Evidence/governance/learning separation; preferably separate indexes when lifecycle differs |
| `domains`, `tags`, `controlIds` | Filterable collections |
| `title`, `content` | Searchable sanitized text |
| `contentVector` | 3,072 dimensions for current `text-embedding-3-large` output |
| `embeddingProvider`, `embeddingModel`, `embeddingVersion` | Filterable compatibility metadata |
| `contentHash`, `updatedAt`, `active` | Replacement, freshness, and active-generation filtering |

Vector fields are not the tenant filter; metadata fields must be filterable and applied before vector evaluation. Azure AI Search supports vector/hybrid queries and metadata filtering. [Vector search overview](https://learn.microsoft.com/en-us/azure/search/vector-search-overview), [vector filters](https://learn.microsoft.com/en-us/azure/search/vector-search-filters)

### Migration procedure

1. Fix current Qdrant generation, model, purpose, and score semantics.
2. Persist canonical source documents and chunk manifests in Blob/PostgreSQL.
3. Create a versioned Azure Search index and an alias; never reuse a schema-incompatible index.
4. Backfill from canonical manifests, not from untrusted search results.
5. Validate counts, hashes, tenant filters, deletes, and model dimensions.
6. Dual-write new generations to Qdrant and Search.
7. Shadow-read a versioned evaluation corpus; compare citation correctness, top-k recall, contradiction retrieval, latency, and cost.
8. Calibrate a minimum relevance threshold and record rejected-low-score counts.
9. Move a small canary workspace to Search.
10. Switch the alias/read provider only after the acceptance window; keep Qdrant read-only for rollback.

Search indexes are not automatically synchronized across regions; multi-region replication is an application/indexer responsibility. [Azure AI Search multi-region guidance](https://learn.microsoft.com/en-us/azure/search/search-multi-region)

## Identity and authorization

### Public demo

Keep randomized, hashed, short-lived demo sessions with strict quotas and synthetic data only. Do not let public demo identity share an enterprise workspace, audit scope, or storage container. Prefer a unique origin rather than a shared GitHub Pages origin.

### Enterprise deployment

1. Register a browser SPA and separate product API in Entra ID.
2. Define application roles such as reviewer, approver, auditor, and administrator. [Entra app roles](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps)
3. Treat Entra tenant/object/group claims as identity input, not automatic business membership.
4. Resolve an authenticated principal through the application's organization/workspace membership table.
5. APIM validates signature, issuer, audience, lifetime, and required route scopes/roles.
6. Node repeats token validation and authorizes the requested resource/operation.
7. Use Conditional Access and access reviews at the tenant layer; log role/membership changes to the durable audit ledger.

JWT production startup must fail if issuer, audience, and tenant constraints are missing. Never accept workspace/project identifiers from the request as authorization scope.

## Network and secret design

- Front Door Premium is the only public edge; use WAF managed rules in detection during tuning, then prevention.
- Front Door creates a managed Private Link connection to the **Gateway** subresource of APIM Standard v2. Approve that connection, use the APIM gateway hostname as the origin host header, then disable APIM public network access. Do not mix public and private origins in the same Front Door origin group. [Front Door to APIM Private Link](https://learn.microsoft.com/en-us/azure/frontdoor/standard-premium/how-to-enable-private-link-apim), [APIM inbound private endpoints](https://learn.microsoft.com/en-us/azure/api-management/private-endpoint)
- Give APIM outbound integration a dedicated subnet in the same region/subscription, delegated to `Microsoft.Web/serverFarms`, with an NSG. Microsoft documents `/27` minimum and `/24` recommended; size from expected scale rather than taking the minimum by default. Allow only required APIM dependencies and TCP 443 to the internal product API. [APIM outbound VNet integration](https://learn.microsoft.com/en-us/azure/api-management/integrate-vnet-outbound)
- Put the internal Container Apps environment in its own infrastructure subnet. Link private DNS so APIM resolves the Container Apps internal FQDN to its private ingress; test resolution and TLS/SNI from the APIM integration path before disabling alternate access.
- Put PostgreSQL, Blob, AI Search, Key Vault, and any operator-only private endpoints in a dedicated private-endpoint subnet with their required private DNS zones linked to the workload VNet. ACR uses its supported private/managed-identity pull path.
- Route APIM and Container Apps egress through the approved route/firewall design. NSGs/UDRs must preserve Azure platform dependencies, DNS, health probes, and the explicitly allowlisted Compass/parser destinations. [APIM virtual-network options](https://learn.microsoft.com/en-us/azure/api-management/virtual-network-concepts)
- Container Apps uses managed identity for ACR pull, Key Vault access, and Azure resource calls. [Container Apps managed identity](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity), [Container Apps secrets](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
- Route outbound Compass/parser traffic through a controlled egress path with DNS/host allowlisting and logging of destination/status only.
- Keep the Compass named client token in Key Vault; the upstream provider key remains in the shared gateway.
- Enable Key Vault soft delete, purge protection, least-privilege RBAC, alerts, and rotation. [Key Vault authentication](https://learn.microsoft.com/en-us/azure/key-vault/general/authentication), [Key Vault hardening](https://learn.microsoft.com/en-us/azure/key-vault/general/secure-key-vault)

Do not forward the user's bearer token to the parser or gateway. Use a service credential or a deliberate on-behalf-of flow with the correct audience.

## Observability and privacy

Instrument Node first and Python only if it is deployed. Use OpenTelemetry with Application Insights for:

- request/correlation/tenant pseudonymous IDs;
- route and operation class;
- actual runtime/provider/model and fallback status;
- dependency latency/status/retry/circuit-breaker state;
- retrieval provider, result count, accepted/rejected score bands;
- policy version and immutable decision hash;
- token usage and estimated budget units;
- queue/concurrency/timeout metrics;
- deployment revision and schema/index generation.

Do not export document text, prompt bodies, retrieved passages, raw model output, bearer tokens, secret values, personal data, or vectors. Use explicit attribute allowlists and sample only after redaction. [Azure Monitor OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable), [Container Apps OpenTelemetry agents](https://learn.microsoft.com/en-us/azure/container-apps/opentelemetry-agents)

Suggested initial service-level indicators:

- successful nonfallback chat/council rate;
- p50/p95/p99 user-action latency;
- stale-version and policy-invariant error rate;
- grounded citation resolution rate;
- cross-tenant denial count;
- model calls/tokens per user action;
- retrieval zero-result/low-score rate;
- audit append/export lag;
- readiness dependency failures;
- deployment rollback rate.

## Delivery and infrastructure as code

### Repository additions

Use one IaC language—Bicep is the lowest-friction Azure-native choice here—and one deployment workflow. Suggested layout:

```text
infra/
  main.bicep
  modules/
    network.bicep
    container-apps.bicep
    postgres.bicep
    storage.bicep
    search.bicep
    key-vault.bicep
    monitor.bicep
    edge-apim.bicep
  environments/
    demo.bicepparam
    staging.bicepparam
    production.bicepparam
scripts/
  migrate-postgres.*
  backfill-search.*
  verify-cutover.*
.github/workflows/
  azure-validate.yml
  azure-deploy.yml
```

Do not create empty modules in advance. Add each module in the phase that deploys it.

### Supply chain and promotion

1. Protect `main`; require QA, security, parity, and review.
2. Pin Actions to commit SHAs.
3. Federate GitHub environments to Azure using OIDC; do not store a client secret. [GitHub OIDC to Azure](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure)
4. Build once, produce an SBOM/provenance record, scan, push an immutable digest to ACR.
5. Deploy the same digest to staging, create a new Container Apps revision, run smoke/E2E.
6. Send a small canary percentage, observe, then promote.
7. Roll back by traffic shift to the prior healthy revision; never rebuild the rollback artifact.

Container Apps has GitHub deployment guidance, but keep the workflow explicit enough to preserve validation and promotion gates. [Deploy Container Apps with GitHub Actions](https://learn.microsoft.com/en-us/azure/container-apps/github-actions)

## Migration phases

| Phase | Work | Exit criteria | Rollback |
|---|---|---|---|
| 0. Containment and decisions | Validate the implemented decision-integrity, actor-scope, public-log, workflow-version, and Node-authority fixes; separately close the still-open FastAPI auth/probe/sample-mode and other security findings; choose region/data classes/SLO/RTO/RPO; inventory dependencies; back up PostgreSQL/Qdrant | Full adversarial/parity/tenant E2E and CI green; deployment verified; no anonymous sensitive/cost route; architecture decision record approved. Immutable audit export/business-write coupling remain explicit blockers to user traffic. | No production change |
| 1. Azure compute shadow | Add Node container, ACR, Key Vault, Monitor, staging Container Apps, OIDC deploy, probes; use Railway/Qdrant/Compass; synthetic data and zero user traffic only | Vercel/container API contract and deployed workflow parity; load/cost baseline; revision rollback exercised | Keep traffic on Vercel; deactivate revision |
| 2. Durable Azure state/audit | Convert runtime schema creation to migrations, move PostgreSQL, preserve serialized tenant audit chains, add Blob canonical objects, business/audit coupling or outbox, and immutable export | Backup/restore drill; counts/hashes; hostile-tenant tests; concurrent append/business rollback/export verification; audit chain survives restore; WORM policy proven before pilot/user traffic. | Retain Railway snapshot; restore old connection config after bounded write pause |
| 3. Edge and identity | Add Storage static site, Front Door/WAF, APIM, Entra apps/roles/membership resolution, private network | Token/role/CORS/WAF tests; custom domains; public demo isolated; DNS rollback tested | Low TTL; restore old DNS/API base and retain Vercel/Pages endpoints |
| 4. Vector shadow/cutover | Add Search provider/index/alias, backfill, dual-index, shadow-read and canary | Grounded citation and retrieval corpus meets thresholds; tenant/delete/model tests pass | Switch provider/alias back to Qdrant; keep collection through acceptance window |
| 5. Optional service migration | Move parser and/or Compass gateway only for approved residency/vendor/reliability need | Data-flow assessment, provider parity, budget and failure drills | Keep current services and configuration ready |
| 6. Resilience/decommission | Enable selected HA/geo tier, restore/failover drills, alerts, WAF prevention; retire old services after sign-off | Two successful restore/failover exercises; business/security/data-owner approval | Preserve old infra/backups until the agreed rollback period expires |

## PostgreSQL data migration runbook

The existing JSONB model is portable, but migrate only after versioned migrations and retention/tenant constraints exist.

### Offline cutover (preferred until downtime requires more)

1. Validate source/target PostgreSQL versions, extensions, collation, timezone, roles, network, and storage capacity.
2. Restore a recent production backup into staging; run migrations and the entire QA/E2E suite.
3. Record source counts, tenant counts, latest versions, and canonical hashes by record kind.
4. Lower DNS/config change lead time and announce a bounded write window.
5. Put the product in read-only maintenance mode; drain active runs/jobs.
6. Take final logical dump/restore or use the approved Azure migration service.
7. Apply migrations once; verify counts, hashes, constraints, representative tenants, and audit sequence.
8. Switch only the staging/canary revision to Azure PostgreSQL.
9. Run create/chat/council/follow-up/review/export plus malicious-tenant tests.
10. Promote traffic gradually and monitor errors/lag/locks/connections.
11. Keep Railway read-only and preserve its snapshot through the rollback window.

Microsoft documents PostgreSQL dump/restore and migration-service practices. [Dump and restore](https://learn.microsoft.com/en-us/azure/postgresql/migrate/how-to-migrate-using-dump-and-restore), [migration service best practices](https://learn.microsoft.com/en-us/azure/postgresql/migrate/migration-service/best-practices-migration-service-postgresql)

### Online migration

Use logical replication or Azure Database Migration Service only if the approved downtime cannot accommodate the offline procedure. Define a single write authority, monitor replication lag, quiesce writes for final catch-up, and prohibit bidirectional writes. Online complexity is not justified for the current demo by default.

### Database rollback

Rollback is safe only before irreversible divergent writes. During the rollback window either:

- keep the old source read-only and replay an audited delta back through an approved procedure; or
- declare Azure the write authority and fix forward.

Never point users alternately at two writable databases. Record the exact cutoff sequence/time and every post-cutover mutation.

## Recovery and availability choices

These are planning objectives, not Azure guarantees. Measure them through restore and failover drills, and confirm service availability in the chosen region.

| Tier | Topology | Planning objective | Suitable for |
|---|---|---|---|
| Demo/baseline | Single region, one or more Container App revisions, PostgreSQL without HA, one Search replica, protected Blob | RTO ≤8h; RPO ≤24h | Synthetic demo; noncritical pilot only after Phase 0 and Phase 2 release gates |
| Regional production | Multiple app replicas, zone-redundant PostgreSQL HA, a billable Search tier with at least three replicas for query + indexing SLA, ZRS/GZRS Blob, Front Door/APIM | RTO ≤1h; target zero committed PostgreSQL data loss for zonal HA failover | Approved regional production |
| Critical multi-region | Two regional app/API/Search deployments, Front Door health routing, cross-region PostgreSQL replica, geo-redundant Blob, application-managed dual index | Provisional RTO 30–60m; database RPO depends on measured replica lag | Only when business impact justifies cost/operations |
| Backup-only regional recovery | Geo-redundant PostgreSQL backup and IaC redeploy | RTO minutes to hours; use Microsoft's documented backup RPO for the selected configuration and verify in drills | Lower-cost regional disaster recovery |

PostgreSQL Flexible Server supports zone-redundant HA with synchronous standby behavior, while backup/geo-recovery has different RTO/RPO characteristics. [PostgreSQL HA](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-high-availability), [PostgreSQL reliability](https://learn.microsoft.com/en-us/azure/reliability/reliability-azure-database-postgresql), [backup and restore](https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore)

Azure AI Search resilience depends on replicas and client retry: two or more replicas satisfy the query-only SLA, while three or more are required for the query-plus-indexing SLA used by this application. Cross-region indexes require a custom synchronization plan. [Azure AI Search reliability](https://learn.microsoft.com/en-us/azure/reliability/reliability-ai-search)

Choose Blob ZRS/GZRS/RA-GZRS according to the approved tier and understand that asynchronous geo-replication can lose the latest writes. [Azure Storage redundancy](https://learn.microsoft.com/en-us/azure/storage/common/storage-redundancy)

## Cutover checklist

### Go/no-go inputs

- [ ] P0 remediation suite and live workflow verified on the release revision; residual production security gates separately accepted/closed.
- [ ] Region, residency, service availability, quotas, and cost ceiling approved.
- [ ] IaC plan reviewed; drift check clean.
- [ ] Artifact digest/SBOM/scans approved.
- [ ] Database and Blob restore completed in a clean environment.
- [ ] Qdrant/Search shadow evaluation meets agreed groundedness/latency thresholds if vector cutover is included.
- [ ] Entra roles/memberships and break-glass access tested if identity cutover is included.
- [ ] WAF/APIM rules tested without exposing admin/probe/log routes.
- [ ] External Compass/parser egress and data-processing boundary approved.
- [ ] Synthetic canary case completes the true interaction workflow.
- [ ] Rollback owner, command/config, decision deadline, and communication channel named.

### Immediate verification

- `/livez` and `/readyz` reflect real state without billable probes.
- create session/case, multi-turn intake, upload, retrieval, council, follow-up, rerun, structured review, export;
- policy hash matches baseline fixtures;
- all citations resolve to tenant-owned immutable sources;
- tenant A/B hostile identifier tests fail closed;
- actual runtime/model/fallback trace is truthful;
- audit event and immutable export link are present;
- no sensitive body appears in Application Insights;
- p95 latency, model call count, database connections, error rate, and cost are within budget.

### Rollback triggers

- any cross-tenant or authorization anomaly;
- policy hash/parity mismatch;
- evidence/citation integrity regression;
- stale-version or failed primary interaction above threshold;
- audit append/export gap;
- sustained dependency/latency/error/cost breach;
- database replication/cutover validation mismatch.

## Cost controls

Pricing changes by region and tier, so calculate current estimates in the Azure Pricing Calculator during Phase 0 rather than hard-coding a stale total here. Enforce technical guardrails regardless of estimate:

- scale demo Container Apps to zero where latency permits; set replica maximums;
- keep APIM/Front Door Premium out of the minimum demo unless required;
- cap model calls/tokens per actor/workspace/action in durable storage;
- cap parser job bytes/concurrency/time;
- use log sampling/retention after privacy filtering;
- set Search replicas/partitions from measured workload;
- configure budgets and alerts by environment/service/tag;
- tag every resource with environment, owner, cost center, data class, and expiry;
- schedule nonproduction shutdown/cleanup and orphan detection.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Vercel handlers and `server.js` diverge | One contract/E2E suite targets both; make the container route map authoritative after parity |
| PostgreSQL audit is durable but not enterprise-complete | Preserve locked workspace/project chain heads and unique sequences; add versioned migrations, business-write coupling/outbox, WORM exports, and restore/seal verification before enterprise scale-out |
| Feature flags/rate limits differ per replica | External durable config and APIM/transactional budgets |
| Search semantics differ from Qdrant | Versioned adapter, canonical backfill, shadow metrics, canary, alias rollback |
| No durable original upload store | Blob becomes source of record before search migration |
| Long parser/model calls exceed request limits | Honest deadlines; asynchronous job boundary for long document work |
| Entra changes browser/session behavior | Keep public demo mode separate; stage membership/app-role migration |
| Compass remains outside Azure | Document egress and DPA/residency; migrate only with an explicit requirement |
| Telemetry leaks case content | Attribute allowlist, redaction tests, sampling, restricted retention/access |
| Runtime DDL/drift causes cutover failure | One migration command and restore rehearsal |
| Region lacks required tier/private feature | Confirm official regional availability and quotas before committing architecture |
| Overbuilding the demo | Profile A first; add each Profile B service only at its phase gate |

## Ownership

Assign named people before Phase 0 exit:

| Role | Accountable for |
|---|---|
| Product owner | Demo/production scope, acceptable downtime, release acceptance |
| Security owner | threat model, Entra/WAF/APIM, secrets, pen test, residual risk |
| Data owner/DPO | classification, residency, retention, parser/Compass processing approval |
| Platform owner | IaC, networking, registry, deployment, monitoring, cost |
| Database owner | migrations, copy, validation, backup/restore/failover |
| Search/evaluation owner | corpus, groundedness/recall thresholds, dual-index cutover |
| Compliance/audit owner | audit schema, immutable retention, evidence and reviewer semantics |
| Incident commander | cutover go/no-go, rollback, communications |

## Completion criteria

Azure migration is complete only when:

- the selected profile is deployed entirely from reviewed IaC and an immutable build;
- the true user workflow and policy parity tests pass on the production origin;
- tenant, evidence, review-pack, and audit integrity gates pass;
- backup/restore and revision rollback have been exercised twice;
- the service inventory, data-flow diagram, access model, retention, on-call, alerting, cost budget, and incident runbooks are owned;
- old Vercel/Railway/Pages resources and credentials are removed only after the approved rollback window;
- the [documentation map](README.md), [architecture](../ARCHITECTURE.md), [security assessment](../security_best_practices_report.md), and deployment runbooks match the deployed state.

## Official Microsoft references

- [Azure Container Apps overview](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Container Apps reliability](https://learn.microsoft.com/en-us/azure/reliability/reliability-container-apps)
- [Container Apps jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs)
- [APIM policy reference](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-policies)
- [Azure Front Door Private Link](https://learn.microsoft.com/en-us/azure/frontdoor/private-link)
- [Azure AI Search vector overview](https://learn.microsoft.com/en-us/azure/search/vector-search-overview)
- [PostgreSQL Flexible Server HA](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-high-availability)
- [Azure Key Vault hardening](https://learn.microsoft.com/en-us/azure/key-vault/general/secure-key-vault)
- [Azure Monitor OpenTelemetry configuration](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-configuration)
