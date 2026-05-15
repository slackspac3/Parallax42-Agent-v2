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


def make_pdf(path: Path, title: str, subtitle: str, blocks: list[tuple[str, str]]) -> None:
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
        make_pdf(path, str(doc["title"]), str(doc["subtitle"]), doc["blocks"])  # type: ignore[arg-type]
        manifest.append(
            {
                "filename": filename,
                "title": doc["title"],
                "tags": doc["tags"],
                "path": str(path.relative_to(ROOT)),
            }
        )

    (OUT_DIR / "manifest.json").write_text(json.dumps({"documents": manifest}, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "README.md").write_text(
        "# Synthetic Compliance Contract PDFs\n\n"
        "These PDFs are generated test fixtures for the Compliance Intelligence Agent. "
        "They contain fictional parties only and are not legal advice.\n\n"
        + "\n".join(f"- `{item['filename']}` - {item['title']}" for item in manifest)
        + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(manifest)} PDFs in {OUT_DIR}")


if __name__ == "__main__":
    main()
