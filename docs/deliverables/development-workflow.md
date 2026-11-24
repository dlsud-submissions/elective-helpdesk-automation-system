# Development Workflow and Repository Setup

This document records the Sprint 1 repository and local-tooling decisions for Harbor Tickets. Its statements about future application work are historical planning notes; the current command surface is in the root `package.json` and README.

## Repository layout (current)

- Root configuration files: `.gitignore`, `package.json`, `compose.yaml`; workspace environment templates: `client/.env.example`, `server/.env.example`
- Client application: `client/` (React + TypeScript + Vite)
- Server application: `server/` (Express + TypeScript)
- GitHub automation: `.github/`
- Local editor commands: `.vscode/tasks.json`
- Project docs: `docs/`

The original Sprint 1 plan deferred application source to Sprint 2; that implementation is now present. Current product scope and test commands are summarized in the root README.

## Required tools

- Node.js 22+
- npm 10+
- Docker Engine / Docker Desktop with Compose
- GitHub access with PR review enabled
- Supabase CLI for local migration and reset workflows (Sprint 2)

## Environment placeholders

Workspace examples in `client/.env.example` and `server/.env.example` define the current client and server settings, including optional Gemini placeholders:

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
| `npm run supabase:link`        | hosted | Choose the hosted project to link from an interactive list.                                        |
| `npm run supabase:start`       | local  | Start the local stack (requires Docker). `supabase:stop` and `supabase:status` are also available. |
| `npm run supabase:push:local`  | local  | Apply pending migrations to the local Docker database.                                             |
| `npm run supabase:push`        | linked | Apply pending migrations to the currently linked remote project. Verify the target first.          |
| `npm run supabase:seed`        | linked | Run `supabase/seed.sql` without resetting. Development project only; push migrations first.        |
| `npm run supabase:reset:local` | local  | Rebuild the local database from migrations without running `supabase/seed.sql`.                    |
| `npm run supabase:seed:local`  | local  | Run `supabase/seed.sql` without resetting; requires migrations to be applied first.                |
| `npm run supabase:reset`       | linked | **Destructive:** reset the linked remote database, apply migrations, and run configured seed SQL.  |

`supabase:link` opens the CLI project picker in an interactive terminal. To skip the picker, pass the **project ref**: `npm run supabase:link -- --project-ref <ref>`. The ref is the 20-lowercase-letter Project ID from Dashboard → Project Settings → General, not the project name.

The seed creates fictional accounts with the known password `Password123!`. Only run it against a development project, never production. Remote commands use the project selected by `supabase:link`; check the linked project before every operation. `supabase:seed` runs the seed SQL without resetting, but still creates accounts with a known password and must never target production or shared data. In particular, `supabase:reset` is destructive and must only be used with a disposable development project. Use the local Docker database for routine development.

## Docker and Compose

The root `compose.yaml` configures the current client and server services and keeps environment variables explicit. It does not inject secrets into image layers. Server-side Gemini access, when configured, uses runtime environment variables and outbound HTTPS.

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
