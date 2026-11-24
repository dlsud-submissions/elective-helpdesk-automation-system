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
- `npm run supabase:link`
- `npm run supabase:start`
- `npm run supabase:push:local`
- `npm run supabase:push` (push migrations to the linked remote project; verify the target first)
- `npm run supabase:seed` (run seed SQL on the linked project without resetting; development only)
- `npm run supabase:reset:local` (rebuild from migrations without running the seed)
- `npm run supabase:seed:local` (run seed SQL without resetting; requires migrations first)
- `npm run supabase:reset` (reset the linked remote project; destructive, development project only)

The corresponding VS Code tasks in `.vscode/tasks.json` delegate to these scripts so the team has one canonical command surface.

Remote commands operate on the project selected by `npm run supabase:link`. Confirm the linked project before pushing migrations. The remote seed creates demo accounts with a known password and must never run against production or shared data. The linked reset drops/recreates remote database state from migrations and runs configured seed SQL; never run it against production or shared data.

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
