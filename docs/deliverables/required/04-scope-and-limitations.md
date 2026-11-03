# 4. Scope & Limitations

> **Scope note:** The final included features should be confirmed by the team and instructor. The items below are proposed draft boundaries.

## Included in the Proposed Prototype

- Employee-facing chat interface for IT questions.
- Curated knowledge base of fictional IT support procedures.
- RAG-based retrieval and AI responses grounded in retrieved content, with citations or source titles where feasible.
- Ticket creation, listing, status updates, and escalation to a human support queue.
- Basic admin views for knowledge-base management and support metrics.
- Controlled function calling for explicitly allowlisted actions.
- User sign-in through Supabase Auth, with application profiles linked to `auth.users`.
- Input validation, role-based authorization for protected operations, audit events, and basic prompt-injection defenses.
- Automated tests for API endpoints, business logic, and key UI behavior.

## Excluded or Limited in the Initial Prototype

- Connection to a real corporate Active Directory, identity provider, or production ServiceNow/Jira instance unless access is explicitly provided.
- Real password changes, account provisioning, or software installation on employee devices. These are simulated or represented by safe demo workflows unless an approved test integration is available.
- Guaranteed resolution of every support issue, or fully autonomous handling of sensitive requests.
- Training a custom foundation model. The project uses the hosted Gemini API for chat and embeddings; the selected chat model is `gemini-2.5-flash` and the embedding model is `gemini-embedding-001` (1536 dimensions); see [Gemini API Configuration](08-gemini-configuration.md).
- Production-grade uptime, enterprise-scale load, and compliance certification.
- Use of real employee personal data or secrets in prompts, logs, or demo datasets.
- Dependence on a third-party hosted API means quota limits and availability are outside the team's control; only fictional data may be sent under the free-tier terms.

## To Confirm

- Final scope and acceptance criteria agreed by all four members.
- Whether Jira, ServiceNow, n8n, or another integration will be available; otherwise use a clearly labelled simulation.
- Whether Gemini API free-tier quota is sufficient for development and demo day.

---

[← Objectives](03-objectives.md) · [README](../../README.md) · Next: [Technologies](05-technologies.md)
