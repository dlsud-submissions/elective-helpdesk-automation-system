# elective-helpdesk-automation-system

**AI-Powered Enterprise Helpdesk & Workflow Automation System (AI-HAS)**
Capstone project for _Applied Generative AI for IT Solution Development_.

AI-HAS is a web-based IT helpdesk prototype that combines Retrieval-Augmented Generation (RAG), controlled function calling, and webhook-based automation to answer routine IT questions, manage tickets, and escalate to human agents.

**Team:** Sta. Ana, Matthew E. · Rullan, Harvey · Saluta, James · Reganit, John

## Documentation

| #   | Document                                                | Description                              |
| :-- | :------------------------------------------------------ | :--------------------------------------- |
| 1   | [Project Overview](docs/01-project-overview.md)         | What AI-HAS is, target users, and intent |
| 2   | [Problem Statement](docs/02-problem-statement.md)       | The problem and why AI is appropriate    |
| 3   | [Objectives](docs/03-objectives.md)                     | General and specific objectives          |
| 4   | [Scope & Limitations](docs/04-scope-and-limitations.md) | Included and excluded features           |
| 5   | [Technologies](docs/05-technologies.md)                 | Proposed stack and deployment caveats    |
| 6   | [System Architecture](docs/06-system-architecture.md)   | Architecture and request-flow diagrams   |
| 7   | [Database Design](docs/07-database-design.md)           | ERD and entity tables                    |
| 9   | [AI Prompt Design](docs/09-ai-prompt-design.md)         | Draft prompts and expected outputs       |
| 10  | [Workflow Automation](docs/10-workflow-automation.md)   | Automation flow and guardrails           |
| 11  | [Timeline](docs/11-timeline.md)                         | Sprint-based schedule (broad draft)      |
| 12  | [Team Roles](docs/12-team-roles.md)                     | Member roles and responsibilities        |

### Local setup

Requires Node 22+ and Docker. The Supabase CLI is installed as a dev dependency.

```bash
npm install
npm run env:create            # creates client/.env and server/.env from the examples
npm run supabase:start        # prints the local API URL, anon key, and service_role key
npm run supabase:reset:local  # applies supabase/migrations/ in order, then supabase/seed.sql
```

To work with the hosted project instead, run `npm run supabase:login` once, then `npm run supabase:link`. The link script reads the project ref from `SUPABASE_URL` in `server/.env`. See [Supabase CLI](docs/deliverables/development-workflow.md#supabase-cli) for every script and its target.

Copy the values printed by `npm run supabase:start` into the untracked env files:

- `server/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never in the client)
- `client/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL=http://localhost:3001`

Then run `npm run dev` and open <http://localhost:5173>. The seed creates **fictional local-only** accounts (password `Password123!`):

| Email                    | Role     | Lands on     |
| :----------------------- | :------- | :----------- |
| `dana.cruz@example.test` | employee | Chat         |
| `lee.agent@example.test` | agent    | Ticket queue |
| `ari.admin@example.test` | admin    | Ticket queue |

Roles come from `public.profiles`, never from user-editable auth metadata. API contracts, error codes, and dashboard metric definitions are in [Sprint 3 API contracts](docs/sprints/sprint-3/api-contracts.md).

### Tests

```bash
npm run verify:all   # repo checks, typecheck, unit + integration tests, lint, format, build
npm run test:e2e     # Playwright; skipped unless E2E_BASE_URL is set
```

To run the browser E2E suite against the seeded local stack started above:

```bash
npx playwright install chromium
E2E_BASE_URL=http://localhost:5173 E2E_API_URL=http://localhost:3001 npm run test:e2e
```

### Not yet written

- 8. UI Mockups
- 13. Testing
- 14. Final Deliverables

Section numbers match the course documentation template, so gaps are intentional.

## Status

Documentation is a **draft for team review**. Details, scope, and test results are provisional.
