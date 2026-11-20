# Sprint 5 Release and Defense Checklist

## S5-01 deployment configuration

Supported demonstration modes:

1. Local Docker/Compose plus Supabase local stack.
2. Deployed Vercel frontend with Render backend and hosted Supabase when those accounts and secrets are available.

Server-only runtime settings are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`, and `EMBEDDING_DIMENSIONS`. Never configure the Gemini key or service-role key in Vercel or `client/.env`.

Frontend settings are limited to `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL`. The API `/health` endpoint is the release smoke-check for liveness; add migration/database readiness checks only from server-only infrastructure tooling.

Demo fallback:

- Stop or mark Gemini unavailable by omitting hosted credentials or forcing the provider dependency to fail.
- Demonstrate controlled chat uncertainty/503 behavior and no fabricated citations.
- Demonstrate ticket creation, escalation, and role-denied paths against local Supabase fixtures.
- Do not expose workstation ports or browser-facing privileged keys during the fallback.

## S5-03 final evidence inputs

A final report must list actual commands and dates rather than inferred results. Required evidence includes:

- Repository verification result.
- Client/server unit and integration tests.
- E2E run environment and Playwright result.
- Security and RAG suites.
- Performance and timeout suite.
- Accessibility and responsive review status.
- Hosted migration/RLS and Gemini measurements when available.

## S5-05 speaker outline

1. Problem, users, and objectives.
2. Architecture and trust boundaries.
3. Grounded RAG and citation behavior.
4. Ticket, escalation, and allowlisted automation boundaries.
5. Implementation and role-aware UI.
6. Test/evaluation evidence and limitations.
7. Deployment/fallback and conclusion.

Use `docs/deliverables/mockups/index.html` and factual screenshots captured against the final local release. Do not add credentials or real personal data to slides.

## S5-06 rehearsal gate

- Time the complete walkthrough within the assigned defense slot.
- Practice the normal local/hosted demo and Gemini outage fallback.
- Confirm every participant can explain authentication, RLS, grounding, audit, and automation safety boundaries.
- Record the release commit and any known blockers.
- Run `npm run verify:all` and the relevant Playwright suite before submission.
