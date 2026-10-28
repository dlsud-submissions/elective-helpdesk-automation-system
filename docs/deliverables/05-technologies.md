# 5. Technologies

| Component           | Proposed Technology                                 | Purpose / Notes                                                                                                                                                                                                                                                                                                                  |
| :------------------ | :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend            | React + TypeScript + Vite                           | Chat interface, ticket views, knowledge-base screens, and admin dashboard.                                                                                                                                                                                                                                                       |
| Backend             | Node.js + Express.js + TypeScript                   | REST API, validation, business rules, authorization, RAG orchestration, and webhook handlers.                                                                                                                                                                                                                                    |
| Database            | Supabase PostgreSQL (Free Plan for prototype)       | Stores tickets, profiles, conversations, and audit logs; subject to free-tier quotas.                                                                                                                                                                                                                                            |
| Authentication      | Supabase Auth                                       | Handles sign-in and manages the built-in `auth.users` table. Application profiles and roles live in a linked `profiles` table.                                                                                                                                                                                                   |
| Vector search       | Supabase PostgreSQL + pgvector                      | Stores and searches document embeddings in the same database. pgvector is open-source and does not require a separate paid vector database; Supabase resource limits still apply.                                                                                                                                                |
| LLM / model runtime | Google Gemini API (hosted) — `gemini-2.5-flash`     | Called server-side from Express through the provider adapter in `server/src/shared/ai/`. The API key is supplied through server-only `GEMINI_API_KEY`; the chat model ID comes from `GEMINI_CHAT_MODEL`. Free-tier use has rate limits and data-use terms that may allow Google to use submitted data; send fictional data only. |
| Embeddings          | `gemini-embedding-001` (1536 dimensions)            | Generates document and query embeddings through the Gemini API using `GEMINI_EMBEDDING_MODEL`. Use the same model for indexing and retrieval; the recorded output dimension is `EMBEDDING_DIMENSIONS=1536`, matching the pgvector column. See [Gemini API Configuration](08-gemini-configuration.md).                            |
| Automation          | Express action handlers + webhooks; optional n8n    | Executes allowlisted actions and demonstrates notifications or external integrations.                                                                                                                                                                                                                                            |
| Testing             | Vitest; API integration-test tooling to be selected | Unit tests and integration tests for business rules and API behavior.                                                                                                                                                                                                                                                            |
| Deployment          | Vercel + Render                                     | Vercel hosts the React frontend; Render hosts the Express API and reaches Gemini over outbound HTTPS. Set `GEMINI_API_KEY` only in Render provider settings, never in Vercel/client configuration. Free tiers have usage limits and Render services may sleep when idle.                                                         |
| Version control     | GitHub                                              | Source control, collaboration, and deployment integration.                                                                                                                                                                                                                                                                       |

## Vercel frontend project plan

Owner: Saluta, James (S1-07) · support: Sta. Ana, Matthew

The Vercel project hosts the Vite client from the `client/` workspace of the monorepo. The repository-tracked build settings live in [`client/vercel.json`](../../client/vercel.json) so they are reviewed in pull requests; the dashboard holds only the Git connection and environment variables.

| Setting                    | Value                                                                                                                       |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| Git repository             | `dlsud-submissions/elective-helpdesk-automation-system`                                                                     |
| Project name               | `ai-has-web` (production URL `https://ai-has-web.vercel.app` if the name is available)                                      |
| Root Directory             | `client`                                                                                                                    |
| Include files outside root | Enabled (Vercel default). Required because `package-lock.json` and the npm workspace definition are at the repository root. |
| Framework preset           | Vite (`framework` in `client/vercel.json`)                                                                                  |
| Install command            | Vercel default. With the npm workspace it installs from the repository root lockfile.                                       |
| Build command              | `npm run build` (runs `tsc -b && vite build` in `client/`)                                                                  |
| Output directory           | `dist`                                                                                                                      |
| SPA routing                | All paths rewrite to `/index.html` so client-side routes load on refresh.                                                   |
| Node.js version            | 22.x, matching the root `engines` field and CI                                                                              |
| Production branch          | `main`                                                                                                                      |
| Preview deployments        | Every pull request and every push to a non-production branch, including `dev`                                               |

### Client environment variables

Vite inlines every `VITE_*` variable into the public JavaScript bundle, so only values that are safe for any visitor to read may be set here. Names match [`client/.env.example`](../../client/.env.example).

| Variable                 | Production                                                | Preview                | Notes                                                     |
| :----------------------- | :-------------------------------------------------------- | :--------------------- | :-------------------------------------------------------- |
| `VITE_API_URL`           | Render API origin, e.g. `https://ai-has-api.onrender.com` | Same Render API origin | No trailing slash. Only one Render service is planned.    |
| `VITE_SUPABASE_URL`      | Supabase project URL                                      | Same project URL       | Public value.                                             |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable (anon) key                           | Same key               | Public by design; data is protected by RLS, not this key. |

**Never set in Vercel:** `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `SUPABASE_SERVICE_ROLE_KEY`, or any other server variable from `server/.env.example`. Those belong only in Render. Adding a `VITE_` prefix to a secret would publish it.

### CORS coordination with Render

`server/src/config/cors.ts` matches origins exactly, so a wildcard such as `https://*.vercel.app` does **not** work and would be too broad. Render's `CORS_ALLOWED_ORIGINS` should list:

- the production origin, e.g. `https://ai-has-web.vercel.app`
- the stable `dev` branch alias, `https://ai-has-web-git-dev-<team-slug>.vercel.app`, for shared preview testing
- `http://localhost:5173` only in local `.env` files, not in Render

Per-commit preview URLs change on every push and are not allowlisted; test API calls from the `dev` alias or locally.

### Status and remaining steps

| Item                                         | Status                                                             | Owner          | Next action                                                                                                        |
| :------------------------------------------- | :----------------------------------------------------------------- | :------------- | :----------------------------------------------------------------------------------------------------------------- |
| Build settings recorded in the repository    | Done (`client/vercel.json`, this section)                          | Saluta, James  | Review in PR.                                                                                                      |
| Create project and connect GitHub repository | Pending: needs Vercel access to the `dlsud-submissions` GitHub org | Saluta, James  | Install the Vercel GitHub app for the org (an org owner may need to approve), then import with the settings above. |
| Environment variables                        | Pending: needs Render URL and Supabase project                     | Saluta, James  | Add the three `VITE_*` names for Production and Preview after S1-06 and S1-08 provide the values.                  |
| Production domain in Render CORS             | Pending                                                            | Rullan, Harvey | Add the confirmed Vercel origins to `CORS_ALLOWED_ORIGINS` in Render.                                              |
| Build and deployment smoke test              | Deferred to Sprint 2                                               | Saluta, James  | Confirm the first preview builds, routes refresh correctly, and the client reaches `/api/health`.                  |
| Plan limits                                  | Recorded                                                           | Saluta, James  | Hobby plan is for non-commercial use with build and bandwidth limits; enough for the prototype and demo.           |

## Render backend service plan

The backend service should be configured in Render before Sprint 2 app code is added, even though the Express source is intentionally deferred during Sprint 1. The planned setting is a single Node.js 20 service that points to the repository and runs the future Express API once the server workspace exists.

| Setting                      | Proposed Sprint 1 value                                                                                                                                           |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository path              | `dlsud-submissions/elective-helpdesk-automation-system`                                                                                                           |
| Service name                 | `ai-has-api`                                                                                                                                                      |
| Runtime                      | Node.js 20                                                                                                                                                        |
| Build command                | `npm ci --prefix server`                                                                                                                                          |
| Start command                | `npm --prefix server run start`                                                                                                                                   |
| Health check path            | `/api/health`                                                                                                                                                     |
| Allowed browser origins      | `https://*.vercel.app` and the eventual production Vercel project domain                                                                                          |
| Server environment variables | `PORT`, `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Secret handling              | Store only in Render provider settings; never commit values to Git or browser config                                                                              |

### Render guardrails

- The service is created for the repo root, not for a temporary standalone app folder; the server workspace is expected to live under `server/` in Sprint 2.
- The health endpoint should return a lightweight JSON success payload once the Express API is added; do not require a production deployment check during Sprint 1 because there is no application source yet.
- Any Vercel frontend domain must be allowlisted in the backend CORS policy. Keep the backend origin list explicit and do not use a wildcard for production credentialed requests.
- `GEMINI_API_KEY` remains in Render only; it must never be exposed in client or Vercel environment variables.
- Free-tier quotas, cold starts, and service sleep behavior should be documented in the final demo plan; if the instance sleeps, the app should fail gracefully or recover on the next request.

## Notes

- React, Express.js, Supabase, the Gemini API, Vercel, and Render are the team's preferred choices.
- Supabase pgvector is recommended because it is an open-source PostgreSQL extension and can be used without buying a separate vector database. The Supabase Free Plan has project and resource quotas, so this is not unlimited hosting. Vercel Hobby and Render free services also have limits.

> **Important deployment caveat:** Render can call the hosted Gemini API, so no model host is needed. Remaining risks include free-tier quota/rate limits, API latency, and Render free-instance cold starts (spin-down after idle, with wake-up time that may be roughly a minute). Keep the Gemini API key server-side only.

## Open Decisions

- Whether Supabase pgvector is acceptable for the RAG requirement or a separate vector database is expected.
- Whether free-tier quota is sufficient for development, testing, and demo day, or billing should be enabled.
- Confirm Vercel frontend and Render backend deployment configuration, and whether Docker is mandatory for the final submission.

---

[← Scope & Limitations](04-scope-and-limitations.md) · [README](../../README.md) · Next: [System Architecture](06-system-architecture.md)
