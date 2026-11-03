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
- `npm run supabase:link`
- `npm run supabase:push`
- `npm run supabase:reset`
- `npm run supabase:seed`

The corresponding VS Code tasks in `.vscode/tasks.json` delegate to these scripts so the team has one canonical command surface.

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
