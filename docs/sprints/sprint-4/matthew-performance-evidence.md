# Matthew Sta. Ana: Sprint 4 Resilience Evidence

## S4-05 scope

The API chat path has a 20-second answer timeout by default and a 504 `timeout` response for stalled provider work. Answer dependencies and database persistence failures return controlled 503/502-class outcomes instead of provider details or stack traces. Ticket and action retries use persisted idempotency keys; the chat path returns no partial history when answer generation fails.

The environment variable set for hosted configuration is documented in `server/.env.example`. The chat timeout and provider behavior are exercised locally with injected dependencies and do not require a hosted Gemini secret.

## Repeatable checks

- `server/tests/performance/resilience.test.ts` runs five 15 ms stalled-work samples, verifies each produces a 504 timeout code, and verifies fast successful work resolves normally.
- `server/tests/integration/chat.integration.test.ts` verifies the timeout and dependency-failure HTTP contracts and that failed answers persist no partial messages.
- `server/tests/integration/knowledge-adapters.integration.test.ts` verifies Gemini-style 429 retry behavior and redacts provider details.

## Local result

Run date: 2026-11-20.

- `npm test --workspace @elective-helpdesk/server -- tests/performance/resilience.test.ts` — passed, 2 tests.
- The timeout suite completed in 114 ms, including five bounded stalled-work samples and one successful fast result. This is a local unit/sample observation, not a production latency benchmark.

## Hosted and cold-start limitations

No live Gemini, hosted Supabase, Render, or Vercel network sample was available in this workspace. Therefore model IDs, hosted network conditions, quota tier, HTTP 429 frequency, and Render cold-start duration remain unmeasured and are not claimed here. For demo contingency, rely on the scripted fallback and controlled 503/timeout responses rather than an assumption that hosted infrastructure is warm or available.
