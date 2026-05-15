#!/usr/bin/env python3
"""Generate synthetic contract PDFs for Compliance Intelligence Agent testing.

The PDFs are intentionally text-based and dependency-free so the local browser
and backend evidence extractors can read the contract language without OCR.
"""

from __future__ import annotations

import json
import textwrap
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "test-fixtures" / "compliance-documents"
PAGE_W = 612
PAGE_H = 792
MARGIN_X = 52
TOP_Y = 742
BOTTOM_Y = 54


def pdf_escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", " ")
        .replace("\n", " ")
    )


def ascii_clean(value: str) -> str:
    replacements = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "-",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    return value.encode("ascii", "ignore").decode("ascii")


@dataclass
class Style:
    font: str
    size: int
    leading: int
    before: int = 0
    after: int = 0
    indent: int = 0
    color: str = "0.86 0.90 0.88"


STYLES = {
    "title": Style("F2", 20, 23, before=4, after=12, color="0.08 0.55 0.43"),
    "subtitle": Style("F1", 11, 15, after=14, color="0.28 0.34 0.32"),
    "meta": Style("F3", 8, 11, after=6, color="0.28 0.34 0.32"),
    "heading": Style("F2", 12, 15, before=12, after=5, color="0.02 0.42 0.33"),
    "subheading": Style("F2", 10, 13, before=7, after=3, color="0.12 0.20 0.18"),
    "body": Style("F1", 9, 12, after=3, color="0.05 0.08 0.07"),
    "bullet": Style("F1", 9, 12, after=2, indent=14, color="0.05 0.08 0.07"),
    "table": Style("F3", 7, 10, after=1, color="0.05 0.08 0.07"),
}


def wrap_lines(text: str, style: Style) -> list[str]:
    max_chars = max(28, int((PAGE_W - (2 * MARGIN_X) - style.indent) / (style.size * 0.52)))
    return textwrap.wrap(ascii_clean(text), width=max_chars) or [""]


def text_cmd(x: int, y: int, style: Style, text: str) -> str:
    return f"BT {style.color} rg /{style.font} {style.size} Tf {x} {y} Td ({pdf_escape(text)}) Tj ET\n"


def line_cmd(x1: int, y1: int, x2: int, y2: int, width: float = 0.6) -> str:
    return f"q 0.70 0.76 0.73 RG {width} w {x1} {y1} m {x2} {y2} l S Q\n"


def paginate(title: str, subtitle: str, blocks: list[tuple[str, str]]) -> list[str]:
    pages: list[list[str]] = [[]]
    y = TOP_Y

    def new_page() -> None:
        nonlocal y
        pages.append([])
        y = TOP_Y

    def add(kind: str, text: str) -> None:
        nonlocal y
        style = STYLES[kind]
        lines = wrap_lines(text, style)
        needed = style.before + (len(lines) * style.leading) + style.after
        if y - needed < BOTTOM_Y and y < TOP_Y - 40:
            new_page()
        y -= style.before
        for index, line in enumerate(lines):
            prefix = "- " if kind == "bullet" and index == 0 else "  " if kind == "bullet" else ""
            pages[-1].append(text_cmd(MARGIN_X + style.indent, y, style, prefix + line))
            y -= style.leading
        y -= style.after
        if kind in {"title", "heading"}:
            pages[-1].append(line_cmd(MARGIN_X, y + 3, PAGE_W - MARGIN_X, y + 3))

    add("title", title)
    add("subtitle", subtitle)
    add("meta", "Synthetic legal-style test document for agent evaluation. Not legal advice. No real parties.")
    for kind, text in blocks:
        add(kind, text)

    total = len(pages)
    page_streams: list[str] = []
    for idx, commands in enumerate(pages, start=1):
        footer_style = STYLES["meta"]
        header_style = STYLES["meta"]
        commands[:0] = [
            f"q 1 1 1 rg 0 0 {PAGE_W} {PAGE_H} re f Q\n",
            text_cmd(MARGIN_X, PAGE_H - 28, header_style, title[:88]),
            line_cmd(MARGIN_X, PAGE_H - 38, PAGE_W - MARGIN_X, PAGE_H - 38, 0.4),
        ]
        commands.append(line_cmd(MARGIN_X, 42, PAGE_W - MARGIN_X, 42, 0.4))
        commands.append(text_cmd(MARGIN_X, 28, footer_style, f"Synthetic test fixture - Page {idx} of {total}"))
        page_streams.append("".join(commands))
    return page_streams


def make_pdf(path: Path, title: str, subtitle: str, blocks: list[tuple[str, str]]) -> int:
    page_streams = paginate(title, subtitle, blocks)
    objects: list[bytes | None] = [
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
        None,
    ]
    page_ids: list[int] = []
    for stream in page_streams:
        raw = stream.encode("latin-1", "replace")
        content_id = len(objects) + 1
        objects.append(b"<< /Length %d >>\nstream\n" % len(raw) + raw + b"endstream")
        page_id = len(objects) + 1
        page_ids.append(page_id)
        page_obj = (
            f"<< /Type /Page /Parent 4 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Resources << /Font << /F1 1 0 R /F2 2 0 R /F3 3 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        ).encode("latin-1")
        objects.append(page_obj)

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    objects[3] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("latin-1")
    catalog_id = len(objects) + 1
    objects.append(f"<< /Type /Catalog /Pages 4 0 R >>".encode("latin-1"))

    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for obj_id, obj in enumerate(objects, start=1):
        assert obj is not None
        offsets.append(len(output))
        output.extend(f"{obj_id} 0 obj\n".encode("ascii"))
        output.extend(obj)
        output.extend(b"\nendobj\n")
    xref_offset = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.extend(b"0000000000 65535 f\n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n\n".encode("ascii"))
    output.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    path.write_bytes(output)
    return len(page_streams)


def common_security_blocks() -> list[tuple[str, str]]:
    return [
        ("heading", "Security Controls"),
        ("bullet", "Provider shall maintain ISO 27001 or SOC 2 Type II controls, annual penetration testing, vulnerability remediation tracking, endpoint hardening, and centralized logging."),
        ("bullet", "Provider shall enforce least privilege, MFA, named accounts, privileged access review, break-glass controls, and quarterly access recertification."),
        ("bullet", "Provider shall encrypt data in transit using TLS 1.2 or higher and encrypt data at rest using a recognized key management service."),
        ("bullet", "Provider shall notify Customer of confirmed security incidents without undue delay and no later than 48 hours after confirmation."),
        ("heading", "Audit, Evidence, And Records"),
        ("bullet", "Provider shall preserve audit logs, integration logs, access approvals, configuration changes, incident tickets, and data export records for at least 18 months."),
        ("bullet", "Customer may request security attestations, remediation summaries, subprocessor lists, continuity evidence, and access reports during onboarding and annual review."),
    ]


REFERENCE_BASIS = [
    {
        "name": "GOV.UK Model Services Contract",
        "url": "https://www.gov.uk/government/collections/model-services-contract",
        "used_for": "complex services structure, schedules, service levels, exit management, security schedule patterns",
    },
    {
        "name": "ICO controller and processor contract guidance",
        "url": "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/",
        "used_for": "processor instructions, confidentiality, subprocessors, assistance, deletion, audit, breach support",
    },
    {
        "name": "European Commission controller-processor SCCs and transfer SCC overview",
        "url": "https://commission.europa.eu/publications/standard-contractual-clauses-controllers-and-processors-eueea_en",
        "used_for": "SCC-style annexes, processing description, technical measures, transfer safeguards",
    },
    {
        "name": "BIS Export Administration Regulations and advanced computing end-use controls",
        "url": "https://www.bis.gov/entity-list",
        "used_for": "classification, license analysis, end-use, end-user, restricted-party, re-export, transfer controls",
    },
    {
        "name": "NIST SP 800-161 Rev. 1 Cybersecurity Supply Chain Risk Management",
        "url": "https://csrc.nist.gov/pubs/sp/800/161/r1/upd1/final",
        "used_for": "supplier assurance, provenance, counterfeit/tamper controls, ongoing monitoring, acquisition evidence",
    },
    {
        "name": "NIST SP 800-53 Rev. 5 security and privacy control families",
        "url": "https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final",
        "used_for": "access control, audit, incident response, contingency planning, acquisition, privacy, supply-chain controls",
    },
    {
        "name": "NIST AI Risk Management Framework",
        "url": "https://www.nist.gov/itl/ai-risk-management-framework",
        "used_for": "AI governance, human oversight, testing, documentation, transparency, monitoring, risk management",
    },
    {
        "name": "Cloud Security Alliance Cloud Controls Matrix",
        "url": "https://cloudsecurityalliance.org/research/cloud-controls-matrix",
        "used_for": "cloud shared responsibility, identity, logging, data security, resilience, vendor assurance domains",
    },
]


PROFILES = {
    "01_enterprise_saas_master_services_agreement.pdf": {
        "family": "Enterprise SaaS",
        "provider": "VectorCloud Systems Inc.",
        "customer": "Northstar Retail Holdings",
        "service": "workflow automation, supplier analytics, CRM reporting, case management, and AI-assisted summaries",
        "data": "customer identifiers, employee contacts, purchase orders, supplier due diligence records, support tickets, and transaction metadata",
        "critical_assets": "tenant configuration, customer evidence records, identity federation, API tokens, and supplier risk workflows",
        "regulatory_focus": "privacy, AI governance, cloud security, business continuity, financial reporting, third-party risk",
        "missing_items": "signed DPA, model-training exclusion, continuity plan, subprocessor schedule, production access approval",
        "domain": "saas",
    },
    "02_data_processing_addendum_and_cross_border_terms.pdf": {
        "family": "Data Processing Addendum",
        "provider": "Apex DataWorks Ltd.",
        "customer": "Riverstone Operations Group",
        "service": "HR, CRM, support, supplier, marketing, and analytics processing under documented instructions",
        "data": "employee records, CRM notes, campaign events, supplier questionnaires, support narratives, and analytics metadata",
        "critical_assets": "processing instructions, subprocessor chain, transfer safeguards, deletion records, and data subject request queues",
        "regulatory_focus": "controller-processor duties, transfer impact assessment, subprocessors, retention, deletion, breach support",
        "missing_items": "final transfer impact assessment, subprocessor objection workflow, retention table, deletion certificate process",
        "domain": "privacy",
    },
    "03_ai_accelerator_chip_import_export_control_agreement.pdf": {
        "family": "AI Accelerator Import And Export Control",
        "provider": "HelioChip Logistics Ltd.",
        "customer": "Meridian Research Compute",
        "service": "procurement, import, warehousing, delivery, firmware support, and chain-of-custody control for AI accelerator hardware",
        "data": "export classifications, serial numbers, firmware versions, import records, operator contacts, data center locations, and support logs",
        "critical_assets": "controlled integrated circuits, firmware packages, remote support access, delivery sites, and end-use files",
        "regulatory_focus": "export controls, sanctions screening, end-use and end-user controls, physical security, technical risk, re-export restrictions",
        "missing_items": "final classification, license analysis, end-use certificate, import permit, delivery-site approval, remote support runbook",
        "domain": "export",
    },
    "04_managed_platform_integration_services_agreement.pdf": {
        "family": "Managed Platform Integration Services",
        "provider": "OmniBridge Services LLC",
        "customer": "Summit Core Enterprises",
        "service": "managed integration across ERP, HRIS, CRM, ITSM, collaboration, warehouse, and reporting platforms",
        "data": "finance approvals, supplier bank changes, HR attributes, CRM case narratives, API payloads, logs, and privileged session metadata",
        "critical_assets": "integration middleware, secrets, ERP workflows, privileged accounts, runbooks, field mappings, and release pipelines",
        "regulatory_focus": "segregation of duties, privileged access, system integration risk, finance controls, data protection, continuity, exit",
        "missing_items": "privileged access approval, data processing addendum, continuity evidence, release-control signoff, secrets rotation plan",
        "domain": "integration",
    },
    "05_media_buying_and_audience_analytics_order_form.pdf": {
        "family": "Media Buying And Audience Analytics",
        "provider": "CivicMedia Analytics",
        "customer": "Northline Consumer Brands",
        "service": "campaign activation, audience matching, consented segmentation, media buying, attribution, creative approval, and analytics reporting",
        "data": "hashed emails, consent flags, CRM segments, suppression lists, campaign events, geography, clickstream data, and spend metrics",
        "critical_assets": "audience lists, consent records, ad accounts, pixels, suppression logic, media partner destinations, and attribution reports",
        "regulatory_focus": "privacy, consent, audience activation, marketing automation, data minimization, suppression, partner governance",
        "missing_items": "DPA, subprocessor schedule, audience-retention table, upload approval workflow, media partner destination review",
        "domain": "marketing",
    },
    "06_cloud_ai_model_services_statement_of_work.pdf": {
        "family": "Cloud AI Model Services",
        "provider": "Aster Cognitive Cloud",
        "customer": "Praxis Knowledge Services",
        "service": "private assistant, retrieval, document intelligence, policy question answering, meeting summaries, and compliance evidence extraction",
        "data": "contracts, policies, supplier questionnaires, tickets, architecture notes, meeting notes, approver names, and access logs",
        "critical_assets": "retrieval indexes, prompts, responses, model gateways, embeddings, connectors, human review queues, and safety logs",
        "regulatory_focus": "responsible AI, privacy, prompt injection, retrieval quality, auditability, human oversight, security monitoring",
        "missing_items": "independent robustness results, final RAI assessment, retention approval, data owner approval, model rollback plan",
        "domain": "ai",
    },
}


COMMON_CLAUSES = [
    ("Definitions And Interpretation", "define controlled terms, service boundary, covered affiliates, data classes, evidence artifacts, and approval gates"),
    ("Order Of Precedence", "resolve conflicts between the order form, schedules, security annex, DPA, support policies, and statements of work"),
    ("Statement Of Work Controls", "require every work package to identify scope, owners, data, systems, locations, subcontractors, acceptance tests, and blockers"),
    ("Governance Board", "establish operational, legal, security, privacy, finance, and compliance reviewers with documented decision rights"),
    ("Onboarding Gate", "block production use until risk classification, architecture review, data owner approval, security review, and contract signoff are complete"),
    ("Service Description", "state what the provider may do, what it may not do, and which activities need a separate change order"),
    ("Customer Responsibilities", "identify required approvals, access provisioning, data-quality responsibilities, and evidence response timelines"),
    ("Provider Responsibilities", "require professional care, trained personnel, documented controls, subcontractor oversight, and audit cooperation"),
    ("Regulatory Change", "require impact assessment, control updates, pricing discussion, and implementation plan when law or regulator guidance changes"),
    ("Policies And Standards", "bind the provider to security, privacy, AI, procurement, continuity, records, and acceptable-use policies supplied by customer"),
    ("Personnel And Background Screening", "require appropriate screening, role-based training, confidentiality obligations, and access removal at exit"),
    ("Conflicts Of Interest", "require disclosure of conflicting customers, incentives, related-party arrangements, and independence impairments"),
    ("Subcontracting", "require approval for material subcontractors, flow-down clauses, evidence rights, and termination support"),
    ("Change Control", "require risk assessment before changing scope, location, subprocessors, integrations, data classes, AI use, or access model"),
    ("Fees And Invoicing Controls", "align billing events to accepted deliverables, usage reports, rate cards, credits, and disputed invoice procedures"),
    ("Service Levels", "define uptime, response, restoration, data delivery, support, reporting, and incident communication measures"),
    ("Service Credits", "state credits do not replace corrective actions, regulatory duties, or termination rights for chronic failure"),
    ("Acceptance Testing", "require functional, security, privacy, continuity, integration, and reporting tests before production acceptance"),
    ("Documentation", "require architecture diagrams, runbooks, integration inventory, data maps, control matrix, and evidence pack maintenance"),
    ("Records Retention", "preserve approvals, logs, exports, support records, change records, audit evidence, and decision files for defined periods"),
    ("Audit Rights", "permit questionnaire, evidence review, independent assurance report, interview, remediation tracking, and targeted audit"),
    ("Incident Management", "define security, privacy, continuity, physical, export, payment, and data-quality incidents with severity levels"),
    ("Notification", "require prompt notices, factual updates, root cause, containment, legal hold, communications approval, and corrective plan"),
    ("Remediation", "require tracked corrective actions, owners, deadlines, residual risk acceptance, and executive escalation for overdue blockers"),
    ("Business Continuity", "require continuity plan, disaster recovery plan, tabletop test, restoration evidence, manual workaround, and dependency mapping"),
    ("Exit Management", "require transition plan, data export, knowledge transfer, secrets rotation, subcontractor disengagement, and deletion certification"),
    ("Termination Rights", "allow termination for uncured breach, security failure, regulatory prohibition, chronic SLA failure, or unresolved approval blocker"),
    ("Liability Allocation", "separate ordinary commercial liability from confidentiality, data protection, security, fraud, wilful misconduct, and IP claims"),
    ("Insurance", "require technology E&O, cyber, crime, professional liability, transit/warehouse coverage where relevant, and evidence of renewal"),
    ("Confidentiality", "cover business, technical, pricing, architecture, security, data, model, and investigation information with survival terms"),
    ("Intellectual Property", "separate background IP, deliverables, configurations, customer data, trained artifacts, documentation, and feedback"),
    ("Open Source And Third-Party Components", "require inventory, license compliance, vulnerability management, provenance, and replacement rights"),
    ("Publicity Restrictions", "prohibit public use of customer name, data, logo, case study, benchmark, or regulator discussion without written approval"),
    ("Dispute Escalation", "require operational escalation, executive escalation, interim performance, evidence preservation, and venue selection"),
    ("Regulator Cooperation", "require assistance for supervisory authority inquiries, audits, information requests, breach notifications, and remediation evidence"),
]


CONTROL_CATALOG = [
    ("Identity And Access", "named accounts, MFA, least privilege, joiner-mover-leaver workflow, and quarterly recertification"),
    ("Privileged Access", "ticketed elevation, time limits, session recording, command logging, approval evidence, and emergency break-glass review"),
    ("Authentication", "SSO, certificate or key rotation, conditional access, device posture, and credential vaulting"),
    ("Authorization", "role definitions, segregation of duties, service account ownership, API scope limits, and customer revocation rights"),
    ("Encryption", "TLS for transit, encryption at rest, key ownership, key rotation, and secure backup encryption"),
    ("Logging", "admin activity, API calls, data exports, model calls, configuration changes, and failed access attempts"),
    ("Monitoring", "alert thresholds, SIEM export, anomaly detection, health checks, and operational dashboards"),
    ("Vulnerability Management", "scanning, severity rules, patch timelines, exception approval, and retest evidence"),
    ("Secure Development", "secure SDLC, code review, dependency scanning, branch protection, secrets scanning, and release approval"),
    ("Penetration Testing", "annual testing, scope approval, remediation evidence, executive summary, and retest letter"),
    ("Network Security", "segmentation, private connectivity where available, firewall rules, allowlists, and egress control"),
    ("Endpoint Security", "managed devices, EDR, disk encryption, patching, removable media restrictions, and lost-device handling"),
    ("Cloud Configuration", "baseline hardening, configuration drift, infrastructure-as-code review, and tenant isolation verification"),
    ("Data Classification", "classification labels, handling rules, field mapping, retention rules, and data owner signoff"),
    ("Data Minimization", "purpose limitation, field reduction, sampling controls, masking, and prohibited-data scanning"),
    ("Data Retention", "retention schedule, legal hold, deletion queue, backup retirement, and deletion certificate"),
    ("Data Transfer", "approved locations, transfer safeguards, encryption, access controls, and destination inventory"),
    ("Subprocessor Oversight", "due diligence, flow-down terms, change notice, objection right, and annual review"),
    ("Incident Response", "playbooks, severity taxonomy, containment, forensic preservation, and communication approval"),
    ("Continuity", "RTO/RPO, tabletop test, alternate processing, dependency mapping, and restoration evidence"),
    ("Exit", "export format, assistance period, knowledge transfer, data deletion, and transition governance"),
    ("Audit Evidence", "control owner, evidence artifact, refresh cadence, reviewer, deficiency handling, and evidence ID"),
    ("Responsible AI", "intended use, prohibited use, human approval, testing, monitoring, and unsupported certainty controls"),
    ("Model Data Use", "training opt-in, fine-tuning prohibition, prompt/output retention, service improvement controls, and deletion"),
    ("Integration Governance", "system owner, data owner, API scopes, field mapping, failure handling, and rollback"),
    ("Financial Controls", "approval authority, segregation of duties, payment-change controls, reconciliation, and exception reporting"),
    ("Supplier Risk", "criticality, dependency, concentration risk, ownership, subcontractor risk, and remediation tracking"),
    ("Physical Security", "facility access, visitor logs, chain of custody, asset tracking, and environmental controls"),
    ("Export Controls", "classification, license analysis, sanctions screening, end-use, end-user, re-export, and transfer restrictions"),
    ("Marketing Consent", "lawful basis, consent source, suppression, audience upload approval, data partner review, and deletion"),
]


DOMAIN_CONTROLS = {
    "saas": [
        ("Tenant Isolation", "logical isolation, tenant-specific keys where available, cross-tenant test evidence, and incident escalation"),
        ("SaaS Configuration", "configuration baseline, admin change approval, feature release notice, and customer-controlled settings"),
        ("AI Summary Controls", "citation requirement, human review, no automatic approval, prompt retention limits, and model-use disclosure"),
        ("CRM And ITSM Integrations", "scoped API roles, webhook signing, retry queue, failure notification, and data reconciliation"),
        ("Usage Reporting", "user counts, API calls, evidence volume, billing reconciliation, and suspicious activity review"),
    ],
    "privacy": [
        ("Processing Instructions", "documented instructions, unlawful-instruction notice, purpose limitation, and instruction change logs"),
        ("Data Subject Rights", "locate, export, rectify, restrict, delete, and object support with response timelines"),
        ("Breach Assistance", "facts, categories, approximate data subjects, mitigation, regulator support, and communications approval"),
        ("Transfer Impact", "destination, access law assessment, supplementary measures, onward transfer, and reassessment cadence"),
        ("Processor Return And Deletion", "active deletion, backup aging, certification, legal hold exceptions, and audit samples"),
    ],
    "export": [
        ("Classification And License Analysis", "ECCN or equivalent classification, manufacturer evidence, license exceptions, counsel review, and hold points"),
        ("End Use And End User", "use case, data center location, operator population, prohibited applications, and certification refresh"),
        ("Restricted Party Screening", "customer, affiliate, forwarder, broker, consignee, financing party, and support personnel screening"),
        ("Chain Of Custody", "serial reconciliation, tamper evidence, bonded warehouse control, delivery photographs, and discrepancy investigation"),
        ("Firmware And Remote Access", "ticket approval, named personnel, MFA, session recording, customer observation, and support-window expiry"),
    ],
    "integration": [
        ("Integration Inventory", "source, target, owner, data class, transfer frequency, API scope, secrets owner, and failure handler"),
        ("Segregation Of Duties", "payment authority, release approval, change execution, monitoring, and exception ownership separation"),
        ("Secrets Management", "vaulting, rotation, emergency access, environment separation, and retirement at exit"),
        ("Data Mapping", "field classification, transformation, masking, validation, replay handling, and reconciliation"),
        ("Release Management", "change window, rollback, test results, approvals, stakeholder notice, and post-release monitoring"),
    ],
    "marketing": [
        ("Audience Source Governance", "consent source, lawful basis, suppression, expiration, upload approver, and partner destination"),
        ("Media Account Access", "named user access, MFA, spending authority, account ownership, and revocation"),
        ("Pixel And Tag Controls", "approval, purpose, destination, retention, data minimization, and periodic removal review"),
        ("Campaign Reporting", "spend, impressions, conversion, audience source, suppression, retention, and variance explanation"),
        ("Partner Governance", "media partner list, data sharing restrictions, independent retargeting prohibition, and deletion confirmation"),
    ],
    "ai": [
        ("AI System Card", "intended use, users, prohibited use, model family, retrieval scope, limitations, and fallback behavior"),
        ("Prompt Injection Testing", "malicious instructions, data exfiltration, tool abuse, citation spoofing, and unsafe recommendation tests"),
        ("Retrieval Quality", "index source, freshness, permission trimming, citation quality, confidence indicators, and stale-content handling"),
        ("Human Oversight", "approval boundary, escalation queues, reviewer role, override record, and no autonomous high-impact decision"),
        ("Model Operations", "versioning, rollback, gateway logging, rate limits, retention, redaction, and incident response"),
    ],
}


def clause_blocks(profile: dict[str, str], clauses: list[tuple[str, str]], start: int = 1) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    for idx, (title, obligation) in enumerate(clauses, start=start):
        blocks.extend(
            [
                ("subheading", f"{idx}. {title}"),
                (
                    "body",
                    f"For {profile['family']}, {profile['provider']} shall {obligation}. The obligation applies to "
                    f"{profile['service']} and to all records concerning {profile['critical_assets']}.",
                ),
                (
                    "bullet",
                    f"Required evidence: owner, approval date, artifact ID, renewal date, exception status, and reviewer for {title.lower()}.",
                ),
                (
                    "bullet",
                    f"Approval blocker: unresolved gaps affecting {profile['missing_items']} must remain visible in the risk register until accepted by Customer.",
                ),
                (
                    "table",
                    f"Clause {idx:02d} | Area: {title} | Customer: {profile['customer']} | Provider: {profile['provider']} | Evidence cadence: onboarding and annual refresh",
                ),
            ]
        )
    return blocks


def control_blocks(profile: dict[str, str], controls: list[tuple[str, str]], prefix: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    for idx, (control, evidence) in enumerate(controls, start=1):
        blocks.extend(
            [
                ("subheading", f"{prefix}-{idx:02d} {control}"),
                (
                    "body",
                    f"The parties assign {control.lower()} as a control family for {profile['regulatory_focus']}. "
                    f"Provider must operate the control for {profile['service']} and retain evidence covering {evidence}.",
                ),
                (
                    "bullet",
                    f"Testing procedure: sample the latest production configuration, one recent change, one access approval, one exception, and one renewal artifact.",
                ),
                (
                    "bullet",
                    f"Failure mode: if evidence is stale, incomplete, or inconsistent with {profile['data']}, the control is treated as not operating for approval purposes.",
                ),
                (
                    "table",
                    f"{prefix}-{idx:02d} | Control: {control} | Evidence: {evidence} | Blocker if missing: yes for high-risk or regulated processing",
                ),
            ]
        )
    return blocks


def evidence_matrix(profile: dict[str, str]) -> list[tuple[str, str]]:
    artifact_families = [
        "contract approval", "risk assessment", "data map", "system architecture", "integration inventory",
        "security assurance", "access approval", "privileged access review", "change record", "incident playbook",
        "continuity test", "exit plan", "subcontractor review", "retention schedule", "deletion certificate",
        "service level report", "availability report", "support ticket sample", "audit log export", "training record",
        "policy exception", "threat model", "vulnerability report", "penetration test summary", "remediation plan",
        "business owner signoff", "legal approval", "privacy approval", "security approval", "finance approval",
    ]
    blocks = [("heading", "Schedule F - Evidence Acceptance Matrix")]
    for idx, artifact in enumerate(artifact_families, start=1):
        blocks.append(
            (
                "table",
                f"EVID-{idx:03d} | Artifact: {artifact} | Applies to: {profile['family']} | Minimum fields: owner, date, source system, reviewer, finding status, renewal cadence",
            )
        )
        blocks.append(
            (
                "table",
                f"EVID-{idx:03d}A | Acceptance rule: artifact must address {profile['critical_assets']} and must not contradict the stated scope for {profile['service']}.",
            )
        )
        blocks.append(
            (
                "table",
                f"EVID-{idx:03d}B | Blocking rule: if artifact is absent, expired, unsigned, or limited to a non-production environment, the approval status remains conditional.",
            )
        )
    return blocks


def source_blocks() -> list[tuple[str, str]]:
    blocks = [("heading", "Reference Basis For Synthetic Fixture")]
    blocks.append(
        (
            "body",
            "This fixture is original synthetic text. It uses public legal, regulatory, security, cloud, export-control, and AI governance sources only as structural reference points. It is not legal advice and is not a copy of any source template.",
        )
    )
    for source in REFERENCE_BASIS:
        blocks.append(("table", f"Reference | {source['name']} | Applied for: {source['used_for']} | {source['url']}"))
    return blocks


def long_form_blocks(doc: dict[str, object]) -> list[tuple[str, str]]:
    profile = PROFILES[str(doc["filename"])]
    domain = profile["domain"]
    domain_controls = DOMAIN_CONTROLS[str(domain)]
    blocks: list[tuple[str, str]] = []
    blocks.extend(source_blocks())
    blocks.extend(
        [
            ("heading", "Schedule A - Commercial And Governance Terms"),
            (
                "body",
                f"This schedule converts the business request into a production-ready contract package for {profile['service']}. "
                f"The parties acknowledge the primary regulated focus as {profile['regulatory_focus']}.",
            ),
        ]
    )
    blocks.extend(clause_blocks(profile, COMMON_CLAUSES, start=1))
    blocks.extend(
        [
            ("heading", "Schedule B - Security, Privacy, Operational, And Supply-Chain Control Matrix"),
            (
                "body",
                f"The following controls are written as test evidence for an enterprise compliance agent. Each row should be parsed as a possible obligation, blocker, owner action, or evidence requirement for {profile['family']}.",
            ),
        ]
    )
    blocks.extend(control_blocks(profile, CONTROL_CATALOG, "CTRL"))
    blocks.extend(
        [
            ("heading", f"Schedule C - Domain-Specific Requirements For {profile['family']}"),
            (
                "body",
                f"These clauses are intentionally specific to {profile['family']} and should trigger specialized reasoning rather than generic vendor-risk handling.",
            ),
        ]
    )
    blocks.extend(control_blocks(profile, domain_controls, "DOM"))
    blocks.extend(
        [
            ("heading", "Schedule D - Operational Runbook And Scenario Tests"),
            (
                "body",
                f"Provider shall maintain a runbook for normal operations, failed operations, emergency operations, and exit operations involving {profile['critical_assets']}.",
            ),
        ]
    )
    scenario_names = [
        "new production launch", "material subprocessor change", "privileged support request", "suspected data leakage",
        "regional outage", "billing dispute", "regulatory inquiry", "failed access review", "expired assurance report",
        "unapproved integration", "customer exit", "security incident", "privacy incident", "change rollback",
        "evidence challenge", "policy exception", "critical vulnerability", "unsupported component", "operator departure",
        "service-level breach", "data deletion request", "audit sample failure", "dependency concentration issue",
        "cross-border transfer review", "third-party destination review",
    ]
    for idx, scenario in enumerate(scenario_names, start=1):
        blocks.extend(
            [
                ("subheading", f"D.{idx} Scenario - {titleCaseLike(scenario)}"),
                (
                    "body",
                    f"If a {scenario} occurs, Provider shall open a tracked record, identify the affected service boundary, assess impact to {profile['data']}, assign owner and deadline, and preserve evidence for audit review.",
                ),
                (
                    "bullet",
                    f"Required decision output: continue, pause, remediate, escalate, or exit. The decision must reference current evidence and any gap affecting {profile['missing_items']}.",
                ),
                (
                    "table",
                    f"SCN-{idx:02d} | Trigger: {scenario} | Evidence: ticket, owner, chronology, impact, control response, closure approval | Reviewer: customer control owner",
                ),
            ]
        )
    blocks.extend(evidence_matrix(profile))
    blocks.extend(
        [
            ("heading", "Schedule G - Known Gaps And Approval Conditions"),
            (
                "body",
                f"As of the synthetic effective date, the following items are intentionally incomplete to test blocker detection: {profile['missing_items']}. No production approval may be inferred from partial evidence.",
            ),
        ]
    )
    for idx, gap in enumerate(profile["missing_items"].split(", "), start=1):
        blocks.extend(
            [
                ("subheading", f"G.{idx} Open Item - {titleCaseLike(gap)}"),
                (
                    "body",
                    f"The open item '{gap}' remains a blocking or conditional approval factor until a named owner supplies final evidence, legal and security review are complete, and the residual risk decision is recorded.",
                ),
                ("bullet", "Agent expectation: classify the gap, map the affected domain, state the missing artifact, and recommend the next owner action."),
            ]
        )
    return blocks


def titleCaseLike(value: str) -> str:
    return " ".join(part.capitalize() for part in value.replace("-", " ").split())


DOCS: list[dict[str, object]] = [
    {
        "filename": "01_enterprise_saas_master_services_agreement.pdf",
        "title": "Enterprise SaaS Master Services Agreement",
        "subtitle": "VectorCloud Systems Inc. and Northstar Retail Holdings - analytics, workflow automation, CRM, and identity integrations",
        "tags": ["saas", "msa", "privacy", "ai", "azure-ad", "salesforce", "servicenow", "snowflake"],
        "blocks": [
            ("heading", "Parties And Scope"),
            ("body", "This Master Services Agreement is entered into between VectorCloud Systems Inc., a Delaware corporation, and Northstar Retail Holdings, a regional retail and logistics group. The services include hosted workflow automation, supplier analytics, marketing operations reporting, case management, and configurable AI-assisted summaries."),
            ("body", "The platform will integrate with Microsoft Entra ID, Microsoft 365, Salesforce CRM, ServiceNow vendor risk, Snowflake, SFTP drops, and a customer-managed SIEM. Provider will not receive direct payment card numbers but may process transaction metadata, customer identifiers, employee contact data, purchase order details, support tickets, and supplier due diligence records."),
            ("heading", "Subscription Services"),
            ("bullet", "Provider shall deliver multi-tenant SaaS access with logical tenant isolation, regional hosting in Ireland and the United States, and configurable data retention periods."),
            ("bullet", "Provider may use AI-assisted case summaries only inside the customer tenant. Customer content shall not be used to train foundation models, improve shared models, or create external benchmarks."),
            ("bullet", "Provider shall support SAML 2.0 SSO, SCIM provisioning, IP allowlisting, API keys with rotation, webhook signing, and role-based access control."),
            ("heading", "Commercial Terms"),
            ("body", "The initial term is 36 months. Fees are based on named users, API events, and retained evidence volume. Production use may not start until security onboarding, privacy review, and integration approval are completed."),
            ("body", "Provider shall not materially change subprocessors, hosting regions, retention settings, or AI data-use terms without 60 days prior notice and customer opportunity to object."),
            ("heading", "Data Protection And Privacy"),
            ("bullet", "A signed Data Processing Addendum is incorporated by reference. Provider is a processor for customer personal data and a controller only for billing, account, and fraud-prevention records."),
            ("bullet", "Personal data categories include business contact data, customer loyalty identifiers, employee names, approver emails, device identifiers, ticket narratives, and supplier contacts."),
            ("bullet", "Provider shall delete or return customer data within 45 days after termination, except for immutable security logs retained for compliance and dispute defense."),
            ("bullet", "Provider shall maintain subprocessor due diligence, cross-border transfer safeguards, and documented retention schedules."),
            *common_security_blocks(),
            ("heading", "Continuity And Exit"),
            ("bullet", "Provider shall maintain business continuity and disaster recovery plans with annual tabletop testing and target recovery time objective of 12 hours for the production control plane."),
            ("bullet", "Provider shall provide reasonable exit assistance for 90 days, including export of audit logs, evidence attachments, configuration metadata, and integration mappings in CSV or JSON format."),
            ("heading", "Approval Gate"),
            ("body", "This agreement is not sufficient for go-live without a completed access approval record, DPA confirmation, security assurance packet, and integration architecture review."),
        ],
    },
    {
        "filename": "02_data_processing_addendum_and_cross_border_terms.pdf",
        "title": "Data Processing Addendum And Cross-Border Transfer Terms",
        "subtitle": "Apex DataWorks Ltd. processor terms for HR, CRM, marketing, support, and analytics data",
        "tags": ["dpa", "privacy", "subprocessors", "retention", "transfer"],
        "blocks": [
            ("heading", "Processing Roles"),
            ("body", "Customer acts as controller for personal data submitted to the services. Apex DataWorks Ltd. acts as processor except for account administration, billing, security monitoring, sanctions screening, and legal compliance records where it acts as independent controller."),
            ("heading", "Categories Of Data"),
            ("bullet", "Employee data: names, work email, department, manager, role, location, approval authority, support ticket text, access logs, and training completion records."),
            ("bullet", "Customer and prospect data: names, email addresses, phone numbers, CRM opportunity notes, campaign membership, website interaction events, consent status, and customer support history."),
            ("bullet", "Supplier data: vendor contacts, tax identifiers, onboarding questionnaires, insurance certificates, audit findings, beneficial ownership declarations, and contract metadata."),
            ("bullet", "Sensitive data is not expected, but free-text ticket fields may accidentally include health, financial, or government identifier data. Provider must apply detection, redaction, and escalation procedures."),
            ("heading", "Processor Obligations"),
            ("bullet", "Provider shall process personal data only on documented instructions and shall immediately notify Customer if an instruction appears unlawful."),
            ("bullet", "Provider shall ensure personnel confidentiality, minimum necessary access, background checks for privileged operators, and annual privacy training."),
            ("bullet", "Provider shall support data subject requests by locating, exporting, deleting, or restricting personal data within 15 business days of a verified request."),
            ("heading", "Subprocessors"),
            ("body", "Provider may use the subprocessors listed in Schedule 2 for hosting, logging, support, backup, and email delivery. Provider must provide 30 days prior notice before adding or replacing a material subprocessor. Customer may object on reasonable privacy, security, or regulatory grounds."),
            ("table", "Schedule 2: Cloud hosting - Ireland and United States - infrastructure operations - encrypted storage and compute."),
            ("table", "Schedule 2: Support desk - European Union - customer support tickets - access by named support staff only."),
            ("table", "Schedule 2: Email delivery - United States - transactional notifications - no message body analytics."),
            ("heading", "Cross-Border Transfers"),
            ("body", "For transfers from jurisdictions requiring safeguards, the parties incorporate the applicable standard contractual clauses, UK addendum where applicable, and transfer impact assessment controls. Provider shall not transfer regulated data to a restricted jurisdiction without prior written approval."),
            ("heading", "Security Measures"),
            ("bullet", "Encryption at rest and in transit, vulnerability management, malware protection, centralized logging, production change control, and incident response playbooks are mandatory."),
            ("bullet", "Privileged access requires ticketed approval, time-bound elevation, MFA, session logging, and manager review."),
            ("heading", "Deletion And Return"),
            ("body", "Upon termination or written instruction, Provider shall return data in JSON, CSV, and native attachment format, then delete active systems within 45 days and backups within 180 days. Provider shall certify deletion except for records retained by law."),
            ("heading", "AI And Automated Processing"),
            ("body", "Customer personal data shall not be used for model training, fine-tuning, benchmark generation, or service improvement without a separate signed opt-in. Automated summaries remain assistive and may not be treated as final employment, credit, healthcare, or legal determinations."),
        ],
    },
    {
        "filename": "03_ai_accelerator_chip_import_export_control_agreement.pdf",
        "title": "AI Accelerator Chip Import And Export Control Agreement",
        "subtitle": "HelioChip Logistics Ltd. and Meridian Research Compute - controlled AI accelerator procurement, import, re-export, and end-use restrictions",
        "tags": ["export-control", "ai-chip", "import", "sanctions", "third-party-risk", "technical-risk"],
        "blocks": [
            ("heading", "Transaction Overview"),
            ("body", "HelioChip Logistics Ltd. will source, import, warehouse, configure, and deliver AI accelerator hardware, high-bandwidth interconnects, firmware packages, and management software for Meridian Research Compute. The shipment may include items classified under export control regimes applicable to advanced computing, semiconductor manufacturing, encryption, and high-performance AI workloads."),
            ("body", "No party may ship, re-export, transfer, lend, resell, virtualize, colocate, or make available the controlled items to any restricted party, embargoed destination, prohibited end use, or military-intelligence end user without written authorization and any required government license."),
            ("heading", "Export Classification And Licensing"),
            ("bullet", "Supplier shall provide export classification numbers, harmonized tariff codes, country of origin, license exception analysis, encryption classification, and supporting manufacturer certifications before purchase order release."),
            ("bullet", "Potential classifications may include advanced computing controls, encryption controls, and related software controls. Final classification must be confirmed by the manufacturer or qualified export counsel."),
            ("bullet", "Importer of record shall verify whether import permits, re-export licenses, end-user statements, or strategic goods approvals are required for each destination and deployment site."),
            ("heading", "End Use And End User Certification"),
            ("bullet", "Customer represents that the items will be used for internal research, model inference, secure analytics, and workload testing in approved data center locations only."),
            ("bullet", "Items shall not be used for nuclear, missile, chemical, biological, military command, surveillance targeting, weapons design, or restricted military-intelligence applications."),
            ("bullet", "Customer shall maintain asset inventory, deployment site records, operator logs, model workload categories, and access records for at least seven years."),
            ("heading", "Sanctions And Restricted Party Screening"),
            ("body", "Before each shipment, Supplier shall screen Customer, affiliates, freight forwarders, brokers, consignees, data center operators, financing parties, and known end users against applicable sanctions, denied party, unverified, military end user, and export restriction lists."),
            ("body", "A positive or unresolved screening hit is a shipment blocker. The parties must document disposition, counsel review, and approval before release."),
            ("heading", "Data, Firmware, And Remote Access"),
            ("bullet", "Supplier may receive device serial numbers, firmware versions, data center rack locations, network diagrams, import documents, operator contact data, and support logs."),
            ("bullet", "Supplier remote access for firmware support requires ticketed approval, time limits, named personnel, MFA, session recording, and customer observation where feasible."),
            ("bullet", "No production model weights, datasets, prompts, customer personal data, or inference outputs shall be transferred to Supplier unless covered by a separate security and data processing agreement."),
            ("heading", "Customs, Chain Of Custody, And Physical Security"),
            ("bullet", "Supplier shall maintain tamper-evident packaging, serial number reconciliation, bonded warehouse controls, delivery photographs, and chain-of-custody logs."),
            ("bullet", "Lost, stolen, diverted, substituted, or delayed shipments must be reported within 24 hours with an incident record and corrective action plan."),
            ("heading", "Audit Rights"),
            ("body", "Customer may audit classification records, screening records, shipping documents, import permits, chain-of-custody evidence, and end-use certification files. Supplier shall preserve transaction records for seven years or longer if required by law."),
            ("heading", "Blocking Conditions"),
            ("bullet", "No purchase order may be released without export classification, sanctions screening, end-use certification, delivery location approval, and importer-of-record confirmation."),
            ("bullet", "No support access may start without privileged access approval, firmware integrity evidence, and a documented support window."),
        ],
    },
    {
        "filename": "04_managed_platform_integration_services_agreement.pdf",
        "title": "Managed Platform Integration Services Agreement",
        "subtitle": "OmniBridge Services LLC implementation and managed operations across ERP, HRIS, CRM, ITSM, collaboration, and data platforms",
        "tags": ["service-provider", "integrations", "erp", "workday", "servicenow", "sharepoint", "privileged-access"],
        "blocks": [
            ("heading", "Services"),
            ("body", "OmniBridge Services LLC will design, implement, and operate integrations across Oracle ERP, SAP S/4HANA, Workday, ServiceNow, Salesforce, Microsoft 365, SharePoint, Power BI, Snowflake, Databricks, Jira, Okta, and customer-managed SFTP gateways."),
            ("body", "The provider will build API connectors, data mappings, workflow automations, reconciliation reports, exception queues, and support dashboards. Some integrations will move regulated data between finance, HR, procurement, customer support, and compliance systems."),
            ("heading", "Data Categories"),
            ("bullet", "Finance: invoice metadata, payment approval status, supplier bank change requests, purchase orders, budget codes, ledger extracts, tax records, and audit evidence."),
            ("bullet", "HR: employee identifiers, work email, manager, department, job title, location, onboarding status, and access request history."),
            ("bullet", "Customer operations: CRM notes, support case narratives, account identifiers, service entitlements, project milestones, and renewal data."),
            ("bullet", "Technical data: API tokens, integration logs, webhook payloads, IP addresses, device identifiers, error traces, and privileged session metadata."),
            ("heading", "Access Model"),
            ("body", "Provider requests temporary administrator access to ERP, ServiceNow, SharePoint, and integration middleware during implementation. Customer has not yet provided final privileged access approval, named account mapping, or production change-control signoff."),
            ("bullet", "All provider access must be named user access. Shared accounts, unmanaged API keys, and standing admin rights are prohibited unless separately approved as an exception."),
            ("bullet", "Provider shall use customer-approved bastion or PAM tooling, time-bound elevation, ticket references, session recording, and monthly access review."),
            ("heading", "Deliverables"),
            ("bullet", "Integration inventory with system owner, data owner, source, target, data categories, transfer frequency, encryption method, and failure handling."),
            ("bullet", "Data mapping workbook showing field-level classification, transformation rules, retention needs, and exception routing."),
            ("bullet", "Runbook for monitoring, incident response, rollback, replay, data correction, and integration shutdown."),
            ("bullet", "Control evidence pack including access approvals, architecture diagrams, test results, dependency list, continuity plan, and exit procedure."),
            ("heading", "Regulatory And Control Requirements"),
            ("body", "Provider shall preserve segregation of duties in finance workflows, prevent unsupported payment authority changes, and route high-risk exceptions to customer finance control owners. Provider shall not approve its own changes or bypass customer release management."),
            ("body", "Provider shall not copy production data into development or offshore support environments without masking, approval, and data owner signoff."),
            *common_security_blocks(),
            ("heading", "Continuity And Exit"),
            ("body", "Provider shall support customer continuity planning by documenting failover, manual processing workarounds, data replay, queue draining, and integration disablement. Exit assistance must include connector source code handover, secrets rotation support, and knowledge transfer."),
            ("heading", "Open Items"),
            ("bullet", "Privileged access approval is not complete."),
            ("bullet", "Final data processing addendum is pending legal execution."),
            ("bullet", "Business continuity test evidence has not been supplied."),
        ],
    },
    {
        "filename": "05_media_buying_and_audience_analytics_order_form.pdf",
        "title": "Media Buying And Audience Analytics Order Form",
        "subtitle": "CivicMedia Analytics platform order for campaign activation, consented audiences, CRM sync, and measurement reporting",
        "tags": ["marketing", "audience-data", "crm", "media-buying", "consent", "analytics"],
        "blocks": [
            ("heading", "Order Scope"),
            ("body", "CivicMedia Analytics will provide campaign planning, audience segmentation, media buying workflow, consented audience activation, attribution dashboards, creative approval routing, and post-campaign analytics for customer brands and corporate communications teams."),
            ("heading", "Integrations"),
            ("bullet", "CRM integration with Salesforce and Dynamics for account segmentation, consent status, sales stage, campaign membership, and suppression lists."),
            ("bullet", "Marketing automation integration with HubSpot or Adobe Marketo for email engagement, form submissions, landing page events, and consent updates."),
            ("bullet", "Data warehouse integration with Snowflake or BigQuery for aggregated performance data, hashed audience identifiers, and BI reporting."),
            ("bullet", "Media platform integrations with search, social, programmatic display, and measurement partners through customer-approved accounts only."),
            ("heading", "Data Use Restrictions"),
            ("bullet", "No sensitive categories, children's data, government identifiers, precise health data, or employee disciplinary data may be uploaded."),
            ("bullet", "Audience lists must be consented, sourced from approved systems, and accompanied by retention and suppression rules."),
            ("bullet", "Provider may process hashed email addresses, device identifiers, campaign events, clickstream data, lead source, geography, language, and ad exposure metadata."),
            ("bullet", "Provider shall not sell, enrich, commingle, or independently retarget customer audience data."),
            ("heading", "AI And Optimization"),
            ("body", "Provider may use automated bidding, anomaly detection, budget pacing, and creative fatigue alerts. Provider shall not use customer audience data to train shared audience models or external lookalike models without a separate written opt-in."),
            ("heading", "Reporting And Controls"),
            ("bullet", "Provider shall produce campaign reports showing spend, impressions, clicks, conversions, budget variance, audience sources, suppression logic, and data retention status."),
            ("bullet", "Provider shall maintain approval workflow evidence for campaign launch, audience upload, creative approval, landing page approval, and budget change approvals."),
            ("heading", "Privacy And Consent"),
            ("body", "Customer remains responsible for consent capture and lawful basis. Provider must enforce suppression lists, retention limits, opt-out propagation, and deletion instructions within 10 business days."),
            ("body", "No fully executed DPA is attached to this order form. This order form may not be used for production audience activation until the DPA, subprocessor schedule, cross-border transfer terms, and data retention schedule are complete."),
            ("heading", "Security And Access"),
            ("bullet", "Provider access to media accounts and CRM systems must use named accounts, MFA, least privilege, and customer-controlled revocation."),
            ("bullet", "Provider shall not create new ad accounts, pixels, tags, or data destinations without written customer approval."),
            ("heading", "Known Gaps"),
            ("bullet", "DPA is not attached."),
            ("bullet", "Subprocessor list is pending."),
            ("bullet", "Data retention schedule is in draft."),
            ("bullet", "Audience upload approval workflow is not yet configured."),
        ],
    },
    {
        "filename": "06_cloud_ai_model_services_statement_of_work.pdf",
        "title": "Cloud AI Model Services Statement Of Work",
        "subtitle": "Aster Cognitive Cloud conversational assistant, document intelligence, retrieval, and model operations services",
        "tags": ["ai-service", "llm", "model-governance", "document-intelligence", "responsible-ai", "azure"],
        "blocks": [
            ("heading", "Project Description"),
            ("body", "Aster Cognitive Cloud will configure a private conversational assistant for enterprise knowledge retrieval, policy question answering, document triage, meeting summary generation, and compliance evidence extraction. The assistant will connect to SharePoint, Microsoft Teams exports, ServiceNow knowledge articles, Jira issues, Confluence spaces, Azure AI Search, and a customer data lake."),
            ("heading", "Data And Content"),
            ("bullet", "Input data may include policies, procedures, contracts, supplier questionnaires, meeting notes, service tickets, architecture diagrams, audit findings, and selected email exports."),
            ("bullet", "Personal data may appear in documents, including employee names, email addresses, phone numbers, job titles, issue narratives, approver names, and access logs."),
            ("bullet", "Highly confidential data, secrets, credentials, private keys, health records, and payment card data must be excluded from indexing unless separately approved."),
            ("heading", "Model And Data-Use Commitments"),
            ("bullet", "Customer content shall not be used to train, fine-tune, improve, benchmark, or evaluate shared provider models unless a separate opt-in is executed."),
            ("bullet", "Provider may use customer prompts and outputs only for tenant operations, abuse monitoring, troubleshooting, and quality review approved by customer."),
            ("bullet", "Provider shall support prompt and response logging controls, retention limits, redaction, and export of model interaction records."),
            ("heading", "Responsible AI Controls"),
            ("bullet", "Provider shall document intended use, prohibited use, evaluation plan, human review boundary, fallback behavior, hallucination mitigation, and bias-sensitive data handling."),
            ("bullet", "Provider shall implement retrieval citations, confidence notices, no automatic approval for high-impact decisions, and escalation for legal, HR, finance, safety, or regulated advice."),
            ("bullet", "Provider shall run scenario-based tests for prompt injection, data exfiltration attempts, unsupported certainty, privacy leakage, and unsafe action recommendations."),
            ("heading", "Security Architecture"),
            ("body", "The service will use customer-managed identity provider SSO, tenant-scoped retrieval indexes, private network connectivity where available, key rotation, encrypted storage, API audit logs, and administrative access reviews."),
            ("heading", "Integrations"),
            ("bullet", "Microsoft Entra ID for authentication and group mapping."),
            ("bullet", "SharePoint and Teams exports for document retrieval."),
            ("bullet", "ServiceNow and Jira for ticket knowledge retrieval."),
            ("bullet", "Azure AI Search or approved equivalent for vector and keyword retrieval."),
            ("bullet", "SIEM export for audit logs and security monitoring."),
            ("heading", "Operational Requirements"),
            ("bullet", "Provider shall provide uptime target of 99.5 percent for the assistant API after production acceptance."),
            ("bullet", "Provider shall support incident response, safety rollback, model version rollback, blocked prompt categories, and emergency kill switch."),
            ("heading", "Open Preconditions"),
            ("bullet", "Independent bias and robustness test results are not attached."),
            ("bullet", "Final RAI assessment is pending customer approval."),
            ("bullet", "Production data retention period is still subject to privacy approval."),
            ("bullet", "No go-live may occur until human approval, security signoff, and data owner approval are recorded."),
        ],
    },
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for doc in DOCS:
        filename = str(doc["filename"])
        path = OUT_DIR / filename
        blocks = [*doc["blocks"], *long_form_blocks(doc)]  # type: ignore[list-item]
        page_count = make_pdf(path, str(doc["title"]), str(doc["subtitle"]), blocks)  # type: ignore[arg-type]
        if page_count < 20:
            raise RuntimeError(f"{filename} generated only {page_count} pages; expected at least 20")
        manifest.append(
            {
                "filename": filename,
                "title": doc["title"],
                "tags": doc["tags"],
                "pages": page_count,
                "path": str(path.relative_to(ROOT)),
            }
        )

    (OUT_DIR / "manifest.json").write_text(
        json.dumps(
            {
                "minimumPagesPerPdf": 20,
                "documents": manifest,
                "referenceBasis": REFERENCE_BASIS,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (OUT_DIR / "README.md").write_text(
        "# Synthetic Compliance Contract PDFs\n\n"
        "These PDFs are generated test fixtures for the Compliance Intelligence Agent. "
        "They contain fictional parties only and are not legal advice. Each generated PDF is "
        "at least 20 pages and includes long-form schedules, control matrices, evidence "
        "acceptance rules, and intentionally unresolved approval blockers.\n\n"
        "## Documents\n\n"
        + "\n".join(f"- `{item['filename']}` - {item['title']} ({item['pages']} pages)" for item in manifest)
        + "\n\n## Public Reference Basis\n\n"
        + "\n".join(f"- {item['name']}: {item['url']}" for item in REFERENCE_BASIS)
        + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(manifest)} PDFs in {OUT_DIR}")


if __name__ == "__main__":
    main()
