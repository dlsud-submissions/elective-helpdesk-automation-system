# API Specifications

This directory contains the Sprint 3 handoff contracts for the next implementation phase. These documents capture the approved request and response shapes that the frontend and backend should agree on before chat, auth, ticket, and action work begins.

## Contract pack

- [Auth session contract](./auth-session.md) — signed-in session, role lookup, and logout behavior.
- [Grounded answer contract](./chat-answer.md) — employee question flow, citations, uncertainty, and escalation handling.
- [Ticket service contract](./tickets.md) — creation, listing, detail retrieval, and status transitions.
- [Allowlisted action contract](./allowlisted-actions.md) — safe action proposals and backend validation rules.

## Working rules

- The backend remains the single source of truth for auth, authorization, and action execution.
- Browser code must never receive a Gemini key, privileged database credentials, or raw database details.
- Source references are included only when retrieved knowledge supports the answer.
- Unsupported or low-confidence outcomes return a controlled uncertainty or escalation result.
- All contracts below are intended as implementation-ready guidance for Sprint 3 and should be treated as the canonical interface contract unless a follow-up review explicitly changes them.
