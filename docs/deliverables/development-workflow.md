# Development Workflow and Repository Setup

This document captures the Sprint 1 repository and local-tooling decisions for the elective helpdesk platform. The application source is intentionally deferred until Sprint 2; this repo currently contains the planning and automation stub files required to support the upcoming implementation.

## Repository layout

- Root configuration files: `.gitignore`, `.env.example`, `package.json`, `compose.yaml`
- Future client app: `client/` (expected Vite + React workspace)
- Future server app: `server/` (expected Express + TypeScript workspace)
- GitHub automation: `.github/`
- Local editor commands: `.vscode/tasks.json`
- Project docs: `docs/`

No application source should be created under `client/src/` or `server/src/` during Sprint 1. Those directory paths are reserved for Sprint 2 implementation.

## Required tools

- Node.js 20 LTS
- npm 10+
- Docker Engine / Docker Desktop with Compose
- GitHub access with PR review enabled
- Supabase CLI for local migration and reset workflows (Sprint 2)

## Environment placeholders

The root `.env.example` contains only the required Gemini placeholders:

- `GEMINI_API_KEY`
- `GEMINI_CHAT_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `EMBEDDING_DIMENSIONS`

Actual secrets remain in local untracked `.env` files and provider-managed configuration (for example, Render for the server). Nothing sensitive is committed to the repository.

## Commands

The root `package.json` defines the initial command contract for the team:

- `npm run install:all`
- `npm run start:all`
- `npm run start:client`
- `npm run start:server`
- `npm run format:fix` / `npm run format:check`
- `npm run lint:fix` / `npm run lint:check`
- `npm run test:client:watch`
- `npm run test:server:watch`
- `npm run verify:all`
- `npm run test:e2e`

The corresponding VS Code tasks in `.vscode/tasks.json` delegate to these scripts so the team has one canonical command surface.

### Supabase CLI

The Supabase CLI (v3) is a pinned dev dependency, so a global install isn't needed. In CLI v3, `db push`, `db reset`, and `db query` target the **local** database unless `--remote` is passed. The scripts below make the target explicit.

| Script                         | Target | What it does                                                                                       |
| :----------------------------- | :----- | :------------------------------------------------------------------------------------------------- |
| `npm run supabase:login`       | hosted | Sign in to the CLI (browser flow). Run once per machine.                                           |
| `npm run supabase:logout`      | hosted | Remove the CLI access token from this machine.                                                     |
| `npm run supabase:link`        | hosted | Link to the hosted project (see below).                                                            |
| `npm run supabase:push:dry`    | hosted | List migrations that would be applied to the linked project.                                       |
| `npm run supabase:push`        | hosted | Apply pending migrations to the linked project (asks for confirmation).                            |
| `npm run supabase:reset`       | hosted | **Destructive:** wipe and rebuild the linked database from migrations. Never seeds.                |
| `npm run supabase:start`       | local  | Start the local stack (requires Docker). `supabase:stop` and `supabase:status` are also available. |
| `npm run supabase:reset:local` | local  | Rebuild the local database from migrations plus `supabase/seed.sql`.                               |
| `npm run supabase:seed`        | local  | Re-run `supabase/seed.sql` against the local database (idempotent).                                |

`supabase:link` needs the **project ref**: the 20-lowercase-letter Project ID from Dashboard → Project Settings → General, which is also the subdomain of `https://<ref>.supabase.co`. It is not the project name. The script reads the ref from `npm run supabase:link -- <ref>`, then `SUPABASE_PROJECT_REF`, then `SUPABASE_URL` in `server/.env`, and it rejects values that are not refs.

The seed creates fictional accounts with a known password, so it is only ever run locally. The remote reset uses `--no-seed`.

## Docker and Compose

The root `compose.yaml` configures a local development layout for future client and server services and keeps the environment variables explicit. It does not inject secrets into image layers. The app containers rely on runtime environment variables and outbound HTTPS access to the hosted Gemini API.

Supabase local services remain the responsibility of the Supabase CLI workflow rather than Docker Compose. This keeps the local database stack consistent with the project's long-term database design.

## CI and PR expectations

- `.github/workflows/ci.yml` provides a lightweight repository validation job.
- `.github/PULL_REQUEST_TEMPLATE.md` standardizes review notes and validation checks.
- The project should use GitHub branch protection and required checks once the final check names are stable.

## Deferred work

The following actions remain intentionally pending Sprint 2 so the team does not create placeholder application code during Sprint 1:

- App scaffolding under `client/src/` and `server/src/`
- Vite/Express implementation files
- Database schema migrations and seed files
- Real app build, smoke-test, or deployment verification
