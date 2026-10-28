# Testing Matrix

> Status: Sprint 1 documentation artifact only. The matrix records planned tests for the AI-HAS prototype and marks unimplemented work as `Failing` until execution evidence exists.

## Test matrix conventions

- This matrix is a planning and review artifact for Sprint 1; product test execution begins in Sprint 2.
- Status values are limited to `Pass`, `Failing`, `Blocked`, and `Not run`.
- Planned product work remains `Failing` until there is execution evidence to support a different state.
- The matrix is grouped by the repository test boundaries required by the Sprint 1 plan:
  - Client Integration: `client/tests/integration/`
  - Server Integration: `server/tests/integration/`
  - E2E: `tests/e2e/`
  - Regression: `tests/regression/`

## Client Integration tests

| Test ID | Scenario                                                   | Related deliverable    | Preconditions / test data                             | Expected outcome                                                 | Owner         | Status  | Evidence / notes                                                 |
| :------ | :--------------------------------------------------------- | :--------------------- | :---------------------------------------------------- | :--------------------------------------------------------------- | :------------ | :------ | :--------------------------------------------------------------- |
| CI-01   | Employee loads sign-in state and empty chat experience     | WBS-09, WBS-17         | Signed-out employee session; empty conversation state | Empty-state message and sign-in call to action render correctly  | Saluta, James | Failing | UI mockup is designed; React implementation deferred to Sprint 2 |
| CI-02   | Employee submits a valid support question from the chat UI | WBS-09, WBS-17, WBS-12 | Fictional user session and valid request payload      | Input validates and request is prepared for the backend contract | Saluta, James | Failing | Requires API and frontend implementation                         |
| CI-03   | Chat UI renders grounded answer with citations             | WBS-09, WBS-10, WBS-17 | Mock response contains source references              | Citation title and URL/source metadata display as expected       | Saluta, James | Failing | Requires RAG and frontend integration                            |
| CI-04   | Ticket form validation rejects incomplete fields           | WBS-09, WBS-12         | Empty or malformed ticket payload                     | Validation states display without submitting a ticket            | Saluta, James | Failing | Planned for Sprint 2 implementation                              |

## Server Integration tests

| Test ID | Scenario                                                  | Related deliverable    | Preconditions / test data                             | Expected outcome                                                      | Owner          | Status  | Evidence / notes                                                    |
| :------ | :-------------------------------------------------------- | :--------------------- | :---------------------------------------------------- | :-------------------------------------------------------------------- | :------------- | :------ | :------------------------------------------------------------------ |
| SI-01   | Auth middleware denies unauthenticated chat requests      | WBS-04, WBS-12         | No JWT or invalid token                               | Request fails with controlled auth error and no data mutation         | Rullan, Harvey | Failing | Policy and route contract documented; no Express implementation yet |
| SI-02   | Authenticated employee requests a grounded answer         | WBS-10, WBS-12, WBS-16 | Valid employee profile and fictional knowledge chunks | 200 response contains answer plus source metadata                     | Reganit, John  | Failing | Requires RAG pipeline and backend implementation                    |
| SI-03   | Backend rejects unsupported or malformed action proposals | WBS-10, WBS-13         | Invalid action payload or missing required arguments  | Backend returns validation error and does not claim action completion | Rullan, Harvey | Failing | Action contract documented but not implemented                      |
| SI-04   | Ticket creation endpoint validates required fields        | WBS-12, WBS-13         | Missing title or description                          | Validation error with clear remediation guidance                      | Rullan, Harvey | Failing | Planned for Sprint 2 implementation                                 |
| SI-05   | Agent or admin role denies unauthorized ticket action     | WBS-04, WBS-12         | Lower-privilege profile attempts admin-only action    | 403 or equivalent rejection with audit event                          | Rullan, Harvey | Failing | Policy boundary planned but not executed                            |
| SI-06   | Escalation workflow records the summary safely            | WBS-13                 | Fictional conversation with missing details           | Escalation summary omits secrets and captures next steps              | Reganit, John  | Failing | Documentation-only until Sprint 2 implementation                    |

## E2E tests

| Test ID | Scenario                                                       | Related deliverable            | Preconditions / test data                                         | Expected outcome                                                             | Owner             | Status  | Evidence / notes                               |
| :------ | :------------------------------------------------------------- | :----------------------------- | :---------------------------------------------------------------- | :--------------------------------------------------------------------------- | :---------------- | :------ | :--------------------------------------------- |
| E2E-01  | Employee asks a knowledge question and receives a cited answer | WBS-08, WBS-10, WBS-12, WBS-17 | Fictional employee, signed-in session, approved knowledge article | Answer is grounded, cites source, and shows user-friendly result             | Sta. Ana, Matthew | Failing | End-to-end flow is in Sprint 2 scope           |
| E2E-02  | Employee creates a ticket after an unresolved help request     | WBS-08, WBS-12, WBS-13, WBS-17 | Valid employee request and required ticket fields                 | Ticket ID is returned and status appears in the UI                           | Sta. Ana, Matthew | Failing | Product workflow direction is documented only  |
| E2E-03  | Agent reviews and resolves a queued ticket                     | WBS-08, WBS-12, WBS-17         | Agent role and created ticket in the queue                        | Agent can view status and update the ticket                                  | Saluta, James     | Failing | Deferred to Sprint 2–3 implementation          |
| E2E-04  | Employee-to-agent escalation protects sensitive details        | WBS-10, WBS-13                 | Escalation with an issue that needs human support                 | Summary is sent to the agent without private credentials or unnecessary data | Reganit, John     | Failing | Safety contract is documented but not executed |
| E2E-05  | Role misuse is rejected through the full user flow             | WBS-04, WBS-12, WBS-17         | Employee tries an admin operation                                 | UI and API reject the action and record the denial                           | Sta. Ana, Matthew | Failing | No implementation yet                          |

## Regression tests

| Test ID | Scenario                                                                        | Related deliverable    | Preconditions / test data                                          | Expected outcome                                                   | Owner             | Status  | Evidence / notes                                                         |
| :------ | :------------------------------------------------------------------------------ | :--------------------- | :----------------------------------------------------------------- | :----------------------------------------------------------------- | :---------------- | :------ | :----------------------------------------------------------------------- |
| REG-01  | Duplicate ticket creation attempt does not double-submit                        | WBS-13, WBS-12         | Duplicate operation request on same payload                        | System prevents duplicate action and notes the reason              | Rullan, Harvey    | Failing | Allowed workflow and failure handling are documented only                |
| REG-02  | Gemini rate-limit or timeout path fails safely                                  | WBS-07, WBS-10, WBS-13 | Simulated 429 or timeout condition                                 | User sees a safe response; no false success state is reported      | Reganit, John     | Failing | Requires backend resilience and model contract enforcement               |
| REG-03  | Unknown or low-confidence request routes to escalation, not a fabricated answer | WBS-10, WBS-13         | Unsupported issue or insufficient retrieval context                | System refuses to fabricate and promotes escalation                | Reganit, John     | Failing | Prompt safety contract is documented but not executed                    |
| REG-04  | Secret leakage is blocked from responses and logs                               | WBS-13, WBS-10         | Request includes sensitive tokens or credentials in fictional data | System sanitizes or rejects the payload before response generation | Sta. Ana, Matthew | Failing | Security requirements are documented for implementation in later sprints |

## Coverage summary

This matrix intentionally covers the required prototype surface areas:

- authentication and role boundaries
- API validation and error handling
- ticket creation and status handling
- grounded answers and citation references
- escalation and allowlisted workflow safety
- complete employee-to-agent journeys
- denial paths and fault-tolerance expectations

The matrix is used as the planning baseline for Sprint 2 implementation and later execution. It is not evidence of completed product tests.

---

[Back to development workflow](../resources/development-workflow.md) · [Sprint 1 task plan](../sprints/sprint-1/tasks.md)
