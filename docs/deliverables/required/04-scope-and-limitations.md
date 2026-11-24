# 4. Scope & Limitations

> **Status:** This scope describes the implemented prototype. Deployment and hosted-service claims remain environment-dependent.

## Included

- Employee landing, sign-in/sign-up, profile settings, and chat interface for IT questions.
- Curated knowledge base of fictional IT support procedures.
- Grounded chat answers with source references and safe insufficient-context responses.
- Conversation history and rename, archive, restore, and delete operations.
- Ticket creation, requester views, agent assignment and status changes, linked agent replies, and human escalation.
- Agent-generated ticket solution drafts, with optional Gemini generation and persistent draft history.
- Agent-submitted knowledge pairs reviewed through an admin accept/deny queue.
- Admin knowledge-article management, account creation/status management, and operational dashboards.
- Supabase Auth, trusted application profiles, role-based API authorization, RLS, and audit records.
- Automated client, server, integration, security, and browser E2E test suites.

## Excluded or Limited in the Initial Prototype

- Connection to a real corporate Active Directory, identity provider, or production ServiceNow/Jira instance unless access is explicitly provided.
- Real password changes, account provisioning, or software installation on employee devices. These are simulated or represented by safe demo workflows unless an approved test integration is available.
- Guaranteed resolution of every support issue, or fully autonomous handling of sensitive requests.
- Training a custom foundation model. Gemini use is optional and server-side for ticket-solution drafts; chat answers currently use the local grounded-answer implementation.
- Production-grade uptime, enterprise-scale load, and compliance certification.
- Use of real employee personal data or secrets in prompts, logs, or demo datasets.
- Dependence on a third-party hosted API means quota limits and availability are outside the team's control; only fictional data may be sent under the free-tier terms.

## Limitations

- No production identity-directory, ServiceNow, Jira, or device-management integration is included.
- Chat retrieval and answer generation are bounded to the curated local knowledge set; they are not a hosted-model RAG measurement.
- Gemini quota and availability affect only workflows that invoke the configured provider, including optional solution drafting.
- E2E, hosted migration, RLS, latency, and quota evidence depends on the corresponding infrastructure being available.

---

[← Objectives](03-objectives.md) · [README](../../README.md) · Next: [Technologies](05-technologies.md)
