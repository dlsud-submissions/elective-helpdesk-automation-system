# API Specifications

This directory documents the implemented Harbor Tickets API surface and its security boundaries. Route behavior is owned by the server implementation; update these notes alongside API changes.

## Contract pack

- [Auth and profile contract](./auth-session.md) — Supabase Auth, profile lookup, user administration, and account status.
- [Chat and conversation contract](./chat-answer.md) — grounded answers, persisted history, and conversation management.
- [Ticket service contract](./tickets.md) — role-scoped tickets, replies, solution drafts, and updates.
- [Knowledge and submission contract](./knowledge-and-submissions.md) — article search and the agent/admin solution-review workflow.
- [Allowlisted action contract](./allowlisted-actions.md) — safe action proposals and backend validation rules.

## Working rules

- The backend remains the single source of truth for auth, authorization, and action execution.
- Browser code must never receive a Gemini key, privileged database credentials, or raw database details.
- Source references are included only when retrieved knowledge supports the answer.
- Unsupported or low-confidence outcomes return a controlled uncertainty or escalation result.
- Contracts are concise documentation, not a substitute for server validation and tests. The server's runtime schemas, services, and route tests are authoritative.
