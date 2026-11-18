# Harvey Rullan: Sprint 4 API Hardening Evidence

## S4-01: Authentication and authorization boundaries

- Knowledge search now requires the same verified Supabase session middleware as the other employee API routes.
- Agent/admin-only endpoints continue to enforce role checks server-side.
- RLS remains enabled by the existing migrations for application tables; the action migration now alters the existing ticket and automation tables instead of trying to recreate them.
- Added integration coverage for denied unauthenticated knowledge access.

## S4-03: API validation, failures, audit, and retries

- Chat message requests reject non-object bodies, unexpected fields, and malformed conversation UUIDs before repository access.
- Ticket create/update requests reject non-object bodies and unsupported fields. Caller identity fields remain ignored on ticket creation and are never trusted.
- Direct ticket creation requires an idempotency key, enforces requester-scoped uniqueness in the database, and returns the original ticket on retry. The client preserves the key for a retry and rotates it when ticket content changes.
- Knowledge search rejects missing, blank, and over-limit queries; provider errors return a stable 503 response without provider details.
- The action migration now aligns its RPCs with the existing core schema: created action tickets use supported statuses, escalations are represented by the existing `is_escalated` flag, and automation outcomes use the schema's `succeeded` status. The API adapter maps that stored status to its stable `success` response.
- Action create/escalation/simulation requests retain database-backed idempotency and outcome recording.

## Verification

- `npm test -- --reporter=dot` in `server/` — passed, 107 tests across 16 files.
- `npm run typecheck` in `server/` — passed.
- `npm run lint` in `server/` — passed.
- `npm run build` in `server/` — passed.
- `npm run test:run -- tests/unit/client-logic.test.ts` in `client/` — passed, 17 tests.
- Client typecheck, lint, and production build — passed.
- `supabase status` — not available for local database verification because the Docker Desktop engine is not running. No remote database was modified; a local migration reset remains unverified.

The local migration reset and database-level RLS check are release gates and must be run when Docker is available.
