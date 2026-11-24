# 5. Technologies

| Component         | Technology                                              | Current use                                                                                               |
| :---------------- | :------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------- |
| Frontend          | React, TypeScript, Vite                                 | Employee, agent, and admin application in `client/`.                                                      |
| Backend           | Node.js, Express, TypeScript                            | Authenticated API, validation, authorization, ticket, conversation, and knowledge workflows in `server/`. |
| Authentication    | Supabase Auth                                           | Sign-in, sign-up, session handling, and staff account administration.                                     |
| Database          | Supabase PostgreSQL                                     | Profiles, tickets, conversations, messages, knowledge, audit records, submissions, and drafts.            |
| Authorization     | Trusted `profiles` role plus PostgreSQL RLS             | Server-side role checks are authoritative; client route guards are for navigation only.                   |
| Knowledge answers | Curated local knowledge set and grounded-answer adapter | Answers cite relevant source material or return insufficient-context status.                              |
| Solution drafts   | Google Gemini API, optional                             | Server-side generation of agent ticket-solution drafts. The API key is never sent to the browser.         |
| Testing           | Vitest, Testing Library, Playwright                     | Client/server unit and integration suites, plus browser E2E coverage.                                     |
| Local services    | Supabase CLI and Docker                                 | Local database, migrations, and fictional seed data.                                                      |

## Configuration and secrets

The root `package.json` defines workspace scripts for development, tests, builds, typechecks, linting, formatting, and local Supabase operations. See [Development Workflow](../development-workflow.md) for the current command surface.

Client configuration is public by design. Only the Supabase URL, publishable/anon key, and API origin belong in `client/.env`; Vite exposes every `VITE_*` value in the browser bundle. Server-only credentials such as `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` belong in `server/.env` or the server provider's secret store and must never be committed or exposed to the client.

## Deployment notes

The repository includes Vercel and Render configuration, but this documentation does not claim that hosted services, domains, migrations, or production checks are currently provisioned. Set CORS to explicit trusted origins and verify environment-specific migrations and RLS before using any hosted environment. Free-tier limits, provider quotas, and cold starts remain outside local test evidence.

## Limitations

- The current chat answer path uses the curated local knowledge set; it does not establish hosted Gemini chat quality or latency.
- Gemini is optional for ticket-solution drafting and requires a server-side key.
- Embedding/vector-search configuration is present for knowledge ingestion, but current chat retrieval behavior is documented in the root README and should not be confused with a hosted evaluation.
- The prototype uses fictional data and is not certified or connected to enterprise identity or ITSM systems.

---

[← Scope & Limitations](04-scope-and-limitations.md) · [README](../../README.md) · Next: [System Architecture](06-system-architecture.md)
