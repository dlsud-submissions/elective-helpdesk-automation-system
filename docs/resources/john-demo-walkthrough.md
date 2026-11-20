# Fictional Demo Data and Walkthrough

This script uses the local Supabase stack and only fictional demo records. It is intended for a rehearsed local demonstration, not production. The seed provisions three accounts with a shared known password; never apply it to a production project or reuse these credentials elsewhere.

## Reset and start

From the repository root, with Docker running:

```bash
npm install
npm run env:create
npm run supabase:start
# Set the local Supabase URL and keys printed by the CLI in the untracked env files:
# server/.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# client/.env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL=http://localhost:3001
npm run supabase:reset:local
npm run dev
```

`supabase:reset:local` resets the local database, applies migrations, and runs `supabase/seed.sql`. Repeat it before each rehearsal to restore the same accounts, knowledge, messages, and sample tickets. This is destructive to the local database; do not point it at a shared or production project. Confirm services are healthy at `http://localhost:3001/health` and the UI is available at `http://localhost:5173`.

Seeded sign-in accounts (all local-only, fictional; password for each is `Password123!`):

| Account                  | Role     | Landing page                      |
| :----------------------- | :------- | :-------------------------------- |
| `dana.cruz@example.test` | Employee | Chat                              |
| `lee.agent@example.test` | Agent    | Ticket queue                      |
| `ari.admin@example.test` | Admin    | Ticket queue; dashboard available |

Never put these sample credentials in hosted configuration, screenshots, submissions visible outside the team, or real environments. Do not seed a hosted project.

## Walkthrough (approximately 6 minutes)

| Time      | Presenter action                                                                                          | Expected result                                                                                                                                                                                                        |
| :-------- | :-------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:45 | Sign in as Dana and ask “How do I reset MFA after losing my phone?”                                       | A supported answer appears with the “MFA reset procedures” source. Explain that this local path uses deterministic seeded retrieval; hosted Gemini behavior is not being demonstrated.                                 |
| 0:45–1:30 | Ask “How do I change my payroll bank details?”                                                            | The assistant states that no approved procedure was found and offers safe next steps rather than instructions.                                                                                                         |
| 1:30–2:30 | Choose “Talk to a person,” review the fictional summary, and send it to an agent.                         | A ticket reference and confirmation appear; the ticket is linked to the conversation.                                                                                                                                  |
| 2:30–3:30 | Open “My tickets,” then sign out and sign in as Lee.                                                      | Dana can see the new ticket. Lee can find it in the agent queue, inspect the escalation summary, and safely update its status/assignment.                                                                              |
| 3:30–4:15 | Sign out and sign in as Ari; open Dashboard.                                                              | Admin-only metrics render. As Dana, direct navigation to `/dashboard` shows access denied (the automated E2E suite also checks this).                                                                                  |
| 4:15–5:00 | Demonstrate a safe-denial case using the automated role boundary check: try staff-only analytics as Dana. | The API denies the employee request with 403; client-side navigation controls are not treated as authorization.                                                                                                        |
| 5:00–6:00 | Describe reset and contingency plan.                                                                      | Local database reset restores the fictional demo state. If Gemini/hosting/network is unavailable, use the local deterministic answer path and disclose the environment limitation; do not claim a hosted-model result. |

The app's deterministic local chat adapter is not Gemini-backed. Do not claim that a prompt-injection attempt in a retrieved record was exercised through a live model in this walkthrough; the separate local security tests cover injection handling in the implemented deterministic path.

## Rehearsal and regression check

With the seeded stack running:

```bash
npx playwright install chromium
$env:E2E_BASE_URL = 'http://localhost:5173'
$env:E2E_API_URL = 'http://localhost:3001'
npm run test:e2e -- --grep "repeatable fictional demo seed"
```

The Playwright spec signs in as each seeded role and checks the cited answer, seeded escalated queue item, and admin dashboard. To run the broader core chat/escalation journeys, use:

```bash
npm run test:e2e -- tests/e2e/chat.spec.ts tests/e2e/escalation.spec.ts tests/e2e/dashboard.spec.ts
```

If browser automation is unavailable, demonstrate only after manually confirming the health endpoint and the same expected UI results. Never expose a local workstation by opening inbound network access; use the supported hosted environment only after its owner validates configuration and secrets.
