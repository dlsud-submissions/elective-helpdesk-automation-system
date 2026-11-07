# Sprint 3 API Contracts: Auth, Chat, Tickets, Analytics

> **Status:** Implemented for S3-01, S3-02, S3-03, and S3-06 (owner: Saluta, James). Harvey's S3-04/S3-05 action and escalation work builds on the ticket and chat contracts below.

All endpoints are served by the Express API (`VITE_API_URL`). JSON field names are camelCase.

## Authentication

- The browser signs in with Supabase Auth (`signInWithPassword`) using only the public URL and anon key.
- Every API request sends `Authorization: Bearer <Supabase access token>`.
- The API verifies the token with Supabase Auth, then loads the role from `public.profiles`. `user_metadata` is never used for authorization. Identity headers such as `x-user-id` are ignored.
- Client route guards are for UX only. The API enforces every role check.
- There is no self-registration in the prototype. The local seed creates fictional accounts (see the README).

## Error shape

Every error response has this shape:

```json
{ "error": "Human-readable, safe message.", "code": "validation_error" }
```

| HTTP | `code`                                       | Meaning                                                            |
| :--- | :------------------------------------------- | :----------------------------------------------------------------- |
| 400  | `validation_error`                           | Invalid input; the message says what to fix                        |
| 401  | `unauthorized`                               | Missing, invalid, or expired token (the client returns to sign-in) |
| 403  | `profile_not_found`                          | Valid auth user without a `profiles` row                           |
| 403  | `forbidden`                                  | Role not allowed                                                   |
| 404  | `not_found`                                  | Unknown resource, or a resource owned by another user              |
| 409  | `conflict`                                   | Ticket changed since the caller loaded it                          |
| 503  | `answer_unavailable` / `service_unavailable` | Answer dependency or database unavailable                          |
| 504  | `timeout`                                    | Answer generation exceeded the server timeout (20 s)               |
| 500  | `internal_error`                             | Unexpected failure; details are logged server-side only            |

## Profile

| Method | Path          | Roles       | Response                                                                   |
| :----- | :------------ | :---------- | :------------------------------------------------------------------------- |
| GET    | `/api/me`     | any         | `{ profile: { id, displayName, role } }`                                   |
| GET    | `/api/agents` | agent/admin | `{ agents: [{ id, displayName, role }] }`, used by the assignment dropdown |

## Chat and conversation history

### `POST /api/chat/messages`

Request: `{ "content": "1–2000 chars", "conversationId": "optional uuid" }`

The server answers first, then persists the user and assistant messages together. A failed or timed-out answer stores nothing, so a client retry cannot duplicate the user's message. The client also blocks a second send while one is pending.

Response `201`:

```json
{
  "conversationId": "uuid",
  "conversation": {
    "id": "uuid",
    "title": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "userMessage": {
    "id": "uuid",
    "senderType": "user",
    "content": "...",
    "outcome": null,
    "sourceRefs": [],
    "createdAt": "..."
  },
  "message": {
    "id": "uuid",
    "senderType": "assistant",
    "content": "...",
    "outcome": "answered",
    "sourceRefs": [
      {
        "articleId": "uuid",
        "title": "...",
        "sourceName": "...",
        "excerpt": "...",
        "relevance": 0.82
      }
    ],
    "createdAt": "..."
  },
  "outcome": "answered"
}
```

`outcome` values: `answered`, `clarification`, `escalation_suggested`, `ticket_created`, `escalated`. The client treats any other value as an error. Today the answer service (S2-06) returns `answered`, or `escalation_suggested` when context is insufficient. `sourceRefs` is always empty for `escalation_suggested`.

### Other chat endpoints

| Method | Path                              | Response                                                                |
| :----- | :-------------------------------- | :---------------------------------------------------------------------- |
| GET    | `/api/conversations`              | `{ conversations: [...] }`, own only, newest first                      |
| GET    | `/api/conversations/:id/messages` | `{ conversation, messages: [...] }`, oldest first; 404 if not the owner |
| POST   | `/api/chat/answer`                | S2-06 stateless answer endpoint, now authenticated                      |

## Tickets

| Method | Path               | Roles       | Notes                                                                                     |
| :----- | :----------------- | :---------- | :---------------------------------------------------------------------------------------- |
| GET    | `/api/tickets`     | any         | Employees get their own tickets; agent/admin get all                                      |
| POST   | `/api/tickets`     | any         | `{ title ≤120, description ≤5000, category?, priority? }`; requester comes from the token |
| GET    | `/api/tickets/:id` | any         | `{ ticket, audit }`; audit is only returned to agent/admin; 404 for other users' tickets  |
| PATCH  | `/api/tickets/:id` | agent/admin | `{ status?, assigneeId?, notes?, expectedUpdatedAt? }`                                    |

Ticket fields: `id, reference (TCK-n), title, description, category, priority, status, requesterId, requesterName, assignedTo, assigneeName, isEscalated, conversationId, escalationSummary, resolvedAt, createdAt, updatedAt`.

- Status transitions: `new → open | in_progress`, `open → in_progress | pending | resolved`, `in_progress → pending | resolved`, `pending → open | resolved`, `resolved → closed`.
- `assigneeId` must be an agent/admin profile, or `null` to unassign.
- Send the `updatedAt` you loaded as `expectedUpdatedAt`. If the ticket has changed since, the API returns `409 conflict` and the UI asks the user to reload.
- Each change writes an `audit_logs` row (`ticket.created`, `ticket.status_updated`, `ticket.updated`).

## Analytics (dashboard)

`GET /api/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` (agent/admin only)

- Defaults to the last 30 days. `to` includes the whole day. Dates are UTC. Maximum range is 366 days.
- The response contains counts only. It includes no ticket text, message content, or requester identity.

| Metric            | Definition                                                                           |
| :---------------- | :----------------------------------------------------------------------------------- |
| `totalTickets`    | All tickets currently stored, independent of the date range                          |
| `byStatus`        | Current status distribution of all tickets                                           |
| `openByPriority`  | Priority distribution of open tickets (status not `resolved` or `closed`)            |
| `openEscalated`   | Open tickets with `isEscalated = true`                                               |
| `openUnassigned`  | Open tickets with no assignee                                                        |
| `createdInRange`  | Tickets whose `createdAt` falls within `[from, to]`                                  |
| `resolvedInRange` | Tickets whose `resolvedAt` (first move to resolved/closed) falls within `[from, to]` |

Known limitation: metrics are aggregated in the API over up to 1,000 most recent tickets. Move this to a SQL aggregate before the dataset grows past that size.

## Evidence

- Server: `server/tests/integration/{auth-analytics,chat,tickets}.integration.test.ts`, `server/tests/unit/auth-tickets-analytics.test.ts`
- Client: `client/tests/integration/{auth,chat,dashboard}.integration.test.tsx`, `client/tests/unit/client-logic.test.ts`
- E2E (opt-in, needs the seeded local stack): `tests/e2e/{auth,chat,dashboard}.spec.ts`
