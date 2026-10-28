# Work Breakdown Structure (WBS)

> Status: Draft for Sprint 1 review. This deliverable-based WBS tracks the prototype plan for AI-HAS and distinguishes implemented repository setup from product work that remains scheduled for Sprint 2.

## Purpose and scope

The WBS organizes the project around reviewable deliverables rather than only activities. It is traceable to the project objectives, architecture, scope, and timeline and separates:

- completed foundational repository and tooling work
- planning/documentation work completed in Sprint 1
- planned implementation work deferred to Sprint 2 onward
- simulated or excluded work intentionally not implemented in the prototype

## WBS ID conventions

- Prefix `WBS-` for deliverable IDs
- Stable IDs remain unchanged across the sprint plan and references
- `API` or `No API` is recorded for each deliverable to identify exposure or integration behavior

## Deliverables summary

| WBS ID | Deliverable                                    | Owner                                                     | Dependencies                   | Target sprint | API surface               | Evidence / acceptance summary                                                                                                       |
| :----- | :--------------------------------------------- | :-------------------------------------------------------- | :----------------------------- | :------------ | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| WBS-01 | Project objectives and scope alignment         | All team members                                          | None                           | S1            | No API                    | Scope and role boundaries agreed; prototype boundary documented in the objectives and scope docs.                                   |
| WBS-02 | Repository and tooling foundation              | Sta. Ana, Matthew                                         | WBS-01                         | S1            | No API                    | GitHub workflow, package scripts, Compose setup, and repo validation in place; app implementation remains deferred.                 |
| WBS-03 | Frontend and backend environment configuration | Sta. Ana, Matthew                                         | WBS-02                         | S1            | No API                    | Vite/Express project roots, environment placeholders, provider config, and local workflow documented.                               |
| WBS-04 | Data model and auth profile plan               | Rullan, Harvey; review: Sta. Ana, Matthew                 | WBS-01                         | S1            | No API                    | `profiles` linked to `auth.users`, role ownership, and RLS boundaries documented without schema implementation.                     |
| WBS-05 | Supabase project and CLI configuration         | Rullan, Harvey; review: Sta. Ana, Matthew                 | WBS-02, WBS-04                 | S1            | No API                    | Supabase access, pgvector, and migration/reset workflow planned; no schema migration created in Sprint 1.                           |
| WBS-06 | Deployment configuration for client and API    | Saluta, James; Rullan, Harvey; support: Sta. Ana, Matthew | WBS-02, WBS-03                 | S1            | No API                    | Vercel and Render configuration names and provider boundaries documented; secrets remain outside source control.                    |
| WBS-07 | AI access and model contract                   | Reganit, John; support: Rullan, Harvey                    | WBS-01, WBS-02                 | S1            | No API                    | Gemini access reviewed server-side; model IDs and free-tier constraints recorded.                                                   |
| WBS-08 | Employee, agent, and admin user journeys       | All team members                                          | WBS-01                         | S1            | No API                    | Agreed prototype journeys documented and later reflected in wireframes and API contracts.                                           |
| WBS-09 | UI wireframes and static mockup                | Saluta, James                                             | WBS-08                         | S1            | No API                    | UI states and actions documented in design-only artifacts; no React source created.                                                 |
| WBS-10 | RAG and prompt taxonomy                        | Reganit, John                                             | WBS-07, WBS-08                 | S1            | No API                    | Grounded-answer, intent/action, and escalation prompt contracts documented with fictional examples.                                 |
| WBS-11 | WBS deliverable inventory and traceability     | Sta. Ana, Matthew                                         | WBS-01, WBS-08                 | S1            | No API                    | This document is the traceability backbone for all remaining planning artifacts.                                                    |
| WBS-12 | API contract set for all WBS deliverables      | Rullan, Harvey; reviewers: Saluta, James, Reganit, John   | WBS-04, WBS-08, WBS-10, WBS-11 | S1            | API proposed only         | Marked as proposed contract definitions; expected server-side endpoints are documented but not implemented.                         |
| WBS-13 | Allowlisted action and escalation workflow     | Rullan, Harvey; contributor: Reganit, John                | WBS-10, WBS-12                 | S1            | API proposed only         | Backend validation, missing-field handling, and failure/duplicate behavior documented; no executable workflow handlers in Sprint 1. |
| WBS-14 | Integration and E2E test matrix                | Sta. Ana, Matthew; case owners: all team members          | WBS-11, WBS-12, WBS-13         | S1            | API and UI proposed       | Matrix records planned cases and marks unimplemented work as `Failing` until evidence exists.                                       |
| WBS-15 | Sprint 1 review and Sprint 2 handoff           | Sta. Ana, Matthew; contributors: all team members         | All S1 deliverables            | S1            | No API                    | Review record records completed repo setup, deferred implementation, and ranked Sprint 2 work items.                                |
| WBS-16 | Core backend and RAG implementation            | Rullan, Harvey; Reganit, John                             | WBS-04, WBS-05, WBS-07, WBS-12 | S2            | API + database + RAG      | Sprint 2 implementation begins after the approved design and contract boundary is accepted.                                         |
| WBS-17 | Client chat, ticket, and role-aware UI         | Saluta, James                                             | WBS-06, WBS-09, WBS-12         | S2            | API + frontend            | Frontend implementation follows approved UI states and API contract boundaries.                                                     |
| WBS-18 | QA hardening and evaluation                    | Sta. Ana, Matthew; contributors: all team members         | WBS-14, WBS-16, WBS-17         | S4            | API + frontend + workflow | Regression, security, prompt safety, and operational tests executed after implementation.                                           |
| WBS-19 | Final deployment and defense readiness         | Sta. Ana, Matthew; service owners: all team members       | WBS-06, WBS-16, WBS-17, WBS-18 | S5            | API + frontend + hosting  | Final release configuration, project documentation, and defense package prepared.                                                   |

## Traceability to objectives

### Objective 1: responsive employee chat and admin dashboard

- Covered by WBS-08, WBS-09, WBS-17
- UI design states include sign-in, empty/loading, error, cited-answer, ticket-created, and escalation outcomes

### Objective 2: Express API for tickets, knowledge, AI, and analytics

- Covered by WBS-03, WBS-04, WBS-12, WBS-16
- API design remains proposed and not implemented until Sprint 2

### Objective 3: Supabase Auth and PostgreSQL persistence

- Covered by WBS-04, WBS-05, WBS-16
- Profile link to `auth.users` and role ownership are documented as authoritative design decisions

### Objective 4: RAG with grounded answers and references

- Covered by WBS-07, WBS-10, WBS-16
- Sources and uncertainty behavior remain in the backend control boundary

### Objective 5: allowlisted function calling and safe workflow automation

- Covered by WBS-10, WBS-13, WBS-16
- The LLM proposes actions; backend validation and execution remain authoritative

### Objective 6: testing and evaluation coverage

- Covered by WBS-14, WBS-18
- Planned matrix cases are intentionally documented as `Failing` until execution evidence exists

## Excluded or simulated scope

The following items are explicitly excluded or simulated in the Sprint 1 planning boundary and are not part of the current product implementation:

- real identity governance and enterprise SSO integration
- privileged production actions such as software provisioning or account changes
- direct external system automation beyond documented test webhook or simulation flows
- production deployment smoke tests before Sprint 2 implementation exists
- any application source under `client/src/` or `server/src/` during Sprint 1

## Completion evidence

Sprint 1 completion for the WBS is validated by the presence of this document, its traceability to objectives, and the review record in the Sprint 1 handoff. The artifact is used as the canonical planning backbone for the API specifications and the testing matrix.

---

[Back to development workflow](../resources/development-workflow.md) · [Sprint 1 task plan](../sprints/sprint-1/tasks.md)
