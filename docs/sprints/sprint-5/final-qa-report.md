# Final QA and AI Evaluation Report

Run date: 2026-11-20

This report is a historical snapshot. Changes made after this date, including the current Harbor Tickets feature set, are not covered by its results.

## Verification command

`npm run verify:all` passed after a successful `npm run install:all`.

| Check                    | Result  | Evidence                                                                  |
| :----------------------- | :------ | :------------------------------------------------------------------------ |
| Repository configuration | Passed  | Required files and env-secret scan passed.                                |
| Client typecheck         | Passed  | `tsc -b --pretty false` passed.                                           |
| Server typecheck         | Passed  | `tsc --noEmit` passed.                                                    |
| Client tests             | Passed  | 44 tests across 4 files.                                                  |
| Server tests             | Passed  | 109 tests across 17 files.                                                |
| Client/server lint       | Passed  | Both ESLint workspaces passed.                                            |
| Format check             | Passed  | Prettier check passed.                                                    |
| Client build             | Passed  | Vite production build passed; one 528 KB chunk-size warning remains.      |
| Server build             | Passed  | tsup production build passed.                                             |
| Performance resilience   | Passed  | 2 focused performance tests passed.                                       |
| Playwright E2E           | Not run | Requires `E2E_BASE_URL` and `E2E_API_URL` plus seeded app infrastructure. |

## Security and RAG evidence

- Prompt-injection, malformed-output, privacy, and uncertainty cases are covered by `server/tests/security/sprint-4-adversarial.test.ts` and the RAG evaluation suite.
- Database and role boundaries, API validation, 429/provider failures, and idempotency have integration/unit coverage.
- Live hosted Gemini retrieval and generation are not represented by this local report.

## AI and latency limitations

- Chat answers use the local grounded-answer implementation and do not call Gemini.
- Gemini model ID and latency for optional ticket-solution drafting: not measured in this workspace.
- Gemini embedding model ID: not measured in this workspace.
- Network conditions/quota tier: not measured.
- Cold-start duration: not measured.
- Server timeout behavior was covered by local resilience tests; it does not represent hosted Gemini chat performance.
- The local RAG suite uses deterministic fictional seed data and must not be interpreted as hosted-model performance.

## Known residual risks

- Docker/Supabase local migration and RLS checks remain environment-dependent.
- Browser E2E is configured but was not run in this local verification state.
- Chat message persistence privacy should be reviewed before any real personal-data use.
- The 528 KB client bundle-size warning is non-blocking for the prototype but may be optimized later.
- Dependency installation reported 13 npm audit findings; this report makes no claim that the prototype is formally certified secure.
