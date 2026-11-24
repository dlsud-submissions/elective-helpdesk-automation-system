# Gemini API Configuration

> **Current use:** Gemini is optional and is called server-side to generate agent ticket-solution drafts. Employee chat answers use the curated local grounded-answer path and do not call Gemini.

## Configuration

The solution generator reads `GEMINI_API_KEY` and `GEMINI_CHAT_MODEL` from the server environment. The model defaults to `gemini-2.5-flash` when no model override is supplied. Configuration placeholders are in [`server/.env.example`](../../server/.env.example).

Never place the API key in `client/.env`, a `VITE_*` variable, the browser bundle, logs, or committed files. The generator is implemented in [`gemini-ticket-solution.ts`](../../server/src/shared/ai/gemini-ticket-solution.ts); persisted drafts record the model used.

## Request and failure behavior

- The server sends ticket title, category, priority, description, and optional escalation summary to the Gemini generate-content endpoint.
- Ticket text is sanitized and treated as untrusted input. The system prompt directs the model not to invent completed actions or request passwords/codes.
- Generation has a 25-second timeout. Missing configuration and upstream failures return a service-unavailable result; provider rate limiting returns a rate-limited result.
- Empty model output is rejected. Generated output is sanitized and capped before being returned or saved.
- Draft generation does not send a reply to the requester or change ticket status; an agent reviews and edits the draft before sending a response.

## Data-use boundary

Only fictional demo/support content may be sent to a provider. Do not send real employee data, credentials, API keys, tickets, or screenshots. The API key and database service-role key remain server-only.

## Validation status

Local integration/unit tests cover provider success, missing configuration, malformed/empty output, timeout, and rate-limit handling. A live hosted key, billing tier, quota, and hosted latency have not been verified by the local QA report. Do not present local tests as hosted Gemini measurements.

The database's optional embedding configuration is described in [Database Design](required/07-database-design.md); it is not part of the current chat-answer path.

---

[System Architecture](required/06-system-architecture.md) · [README](../../README.md)
