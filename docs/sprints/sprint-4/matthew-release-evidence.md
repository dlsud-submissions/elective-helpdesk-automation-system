# Matthew Sta. Ana: Sprint 4 Release-Candidate Evidence

## S4-07 release-candidate decision

This repository state is a **conditional prototype candidate**. It is suitable for a local or hosted demo only after the repository-specific test gates below pass and any unavailable hosted service is disclosed through its fallback.

No unresolved critical security/privacy issue should be treated as accepted: the sprint evidence identifies local chat persistence privacy and live hosted-model coverage as residual risks, and hosted migration/RLS verification remains dependent on Docker/Supabase availability.

## Verification gate

Run date: 2026-11-20.

- `npm run verify:all` passed after `npm run install:all` restored missing workspace dependencies.
- The gate covered repository configuration, client/server typechecks, client/server tests, lint, formatting, and production builds.
- Client: 44 tests passed across 4 files.
- Server: 109 tests passed across 17 files.

Browser journeys require Playwright plus `E2E_BASE_URL` and `E2E_API_URL`; they were not implied passed by unit or integration coverage alone.

## Exercised and residual paths

- Authentication, role-denied access, chat, tickets, escalation, and dashboard behavior are represented in the client/server test suites and Playwright specifications.
- 429/provider failures, timeouts, database failures, validation, and idempotency have targeted unit/integration coverage.
- Live migration reset, RLS database checks, hosted Gemini calls, quota headroom, and cold-start measurements remain environment-dependent.
- The result is not a formal certification or production-readiness claim.
