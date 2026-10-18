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
- Training a custom foundation model. The project uses an Ollama-served language model.
- Production-grade uptime, enterprise-scale load, and compliance certification.
- Use of real employee personal data or secrets in prompts, logs, or demo datasets.

## To Confirm

- Final scope and acceptance criteria agreed by all four members.
- Whether Jira, ServiceNow, n8n, or another integration will be available; otherwise use a clearly labelled simulation.

---

[← Objectives](03-objectives.md) · [README](../README.md) · Next: [Technologies](05-technologies.md)
