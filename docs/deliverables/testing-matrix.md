# Testing Matrix

This matrix describes the implemented Harbor Tickets test surface. Test results are environment- and revision-specific; use `npm run verify:all` for the local CI gate and the Sprint 5 QA report for recorded evidence and caveats.

| Area                     | Coverage                                                                                 | Location / command                                                 |
| :----------------------- | :--------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| Client unit              | Queue filtering, state and API helpers                                                   | `client/tests/unit/`; `npm run test:client`                        |
| Client integration       | Auth, chat, accessibility, dashboards, tickets, and escalation workflows                 | `client/tests/integration/`; `npm run test:client`                 |
| Server unit              | Auth, tickets, analytics, validation, and service behavior                               | `server/tests/unit/`; `npm run test:server`                        |
| Server integration       | Auth and role boundaries, chat/conversation persistence, tickets, actions, and analytics | `server/tests/integration/`; `npm run test:server`                 |
| Security and RAG         | Prompt safety, retrieval behavior, and guarded workflows                                 | `server/tests/security/`, `server/tests/rag/`                      |
| Performance / resilience | Bounded service behavior and timeout cases                                               | `npm run test:performance`                                         |
| Browser E2E              | Sign-in, chat, tickets/escalation, dashboard, accessibility, and seeded demo             | `tests/e2e/`; requires configured `E2E_BASE_URL` and `E2E_API_URL` |
| Static checks            | TypeScript, lint, formatting, and production builds                                      | `npm run verify:all`                                               |

The system uses fictional data. E2E tests require an available application and seeded database; hosted Gemini performance, deployment configuration, and hosted migration/RLS checks are not inferred from local test results.

---

[Development Workflow](development-workflow.md) · [Sprint 5 QA Report](../sprints/sprint-5/final-qa-report.md)
