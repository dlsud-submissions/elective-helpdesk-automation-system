# Sprint 3 API Contracts: Auth, Chat, Tickets, Analytics

> **Status:** Historical Sprint 3 contract, updated where later implementation changed behavior. See the [current API specification pack](../../deliverables/api-specifications/README.md) for the latest route summary.

All endpoints are served by the Express API (`VITE_API_URL`). JSON field names are camelCase.

## Authentication

- The browser signs in with Supabase Auth (`signInWithPassword`) using only the public URL and anon key.
- Employees can select **Remember me for 30 days**; unchecked employee sessions last for the browser tab, while staff keep the existing persistent session behavior.
- Every API request sends `Authorization: Bearer <Supabase access token>`.
- The API verifies the token with Supabase Auth, then loads the role from `public.profiles`. `user_metadata` is never used for authorization. Identity headers such as `x-user-id` are ignored.
- Client route guards are for UX only. The API enforces every role check.
- Employee self-registration is available through Supabase Auth. Admins create staff accounts through the server API; seeded demo accounts remain fictional and local-only.

## Error shape

Every error response has this shape. Responses from `/api/actions/execute` also keep `"status": "error"` for callers written against the original action contract.

```json
{ "error": "Human-readable, safe message.", "code": "validation_error" }
```

| HTTP | `code`                                       | Meaning                                                                                     |
| :--- | :------------------------------------------- | :------------------------------------------------------------------------------------------ |
| 400  | `validation_error`                           | Invalid input; the message says what to fix                                                 |
| 401  | `unauthorized`                               | Missing, invalid, or expired token (the client returns to sign-in)                          |
| 403  | `profile_not_found`                          | Valid auth user without a `profiles` row                                                    |
| 403  | `forbidden`                                  | Role not allowed                                                                            |
| 404  | `not_found`                                  | Unknown resource, or a resource owned by another user                                       |
| 409  | `conflict`                                   | Ticket changed since the caller loaded it, or idempotency key reused for a different action |
| 409  | `confirmation_required`                      | Action sent without a matching `X-Action-Confirmed` header                                  |
| 413  | `payload_too_large`                          | Request body over 100 KB                                                                    |
| 422  | `needs_clarification` / `validation_error`   | Action proposal is missing fields or is too uncertain                                       |
| 502  | `action_failed`                              | Action could not be persisted; no success is reported                                       |
| 503  | `answer_unavailable` / `service_unavailable` | Answer dependency or database unavailable                                                   |
| 504  | `timeout`                                    | Answer generation exceeded the server timeout (20 s)                                        |
| 500  | `internal_error`                             | Unexpected failure; details are logged server-side only                                     |

## Profile

| Method | Path          | Roles | Response                                                                   |
| :----- | :------------ | :---- | :------------------------------------------------------------------------- |
| GET    | `/api/me`     | any   | `{ profile: { id, displayName, role } }`                                   |
| GET    | `/api/agents` | admin | `{ agents: [{ id, displayName, role }] }`, used by the assignment dropdown |

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

`outcome` values: `answered`, `clarification`, `escalation_suggested`, `ticket_created`, `escalated`, `agent_assigned`. The client treats any other value as an error. Today the answer service (S2-06) returns `answered`, or `escalation_suggested` when context is insufficient. `sourceRefs` is always empty for `escalation_suggested`. For an employee message in a conversation linked to an assigned ticket, the service persists only the user message and returns `outcome: agent_assigned` with `message: null`.

The chat list supports client-side search, unread filtering, and sorting. Active employee conversations poll for new agent replies; a linked, open ticket displays a yes/no resolution prompt below new agent messages. Unread state is maintained separately for employees and agents.

### Other chat endpoints

| Method | Path                              | Response                                                                                                 |
| :----- | :-------------------------------- | :------------------------------------------------------------------------------------------------------- |
| GET    | `/api/conversations`              | `{ conversations: [...] }`, own/assigned only, newest first; each item includes role-specific `isUnread` |
| GET    | `/api/conversations/:id/messages` | `{ conversation, messages: [...] }`, oldest first; 404 if not the owner                                  |
| POST   | `/api/conversations/:id/read`     | Marks the caller's employee or agent unread state as read; returns `204`                                 |
| POST   | `/api/chat/answer`                | S2-06 stateless answer endpoint, now authenticated                                                       |
| GET    | `/api/conversations/archived`     | Employee archived conversation list                                                                      |
| PATCH  | `/api/conversations/:id`          | Rename or archive/restore a conversation                                                                 |
| DELETE | `/api/conversations/:id`          | Soft-delete an authorized conversation                                                                   |

## Knowledge and solution review

| Method | Path                      | Roles         | Behavior                                                       |
| :----- | :------------------------ | :------------ | :------------------------------------------------------------- |
| GET    | `/api/knowledge/search`   | Authenticated | Searches curated knowledge sources.                            |
| GET    | `/api/knowledge/articles` | Admin         | Lists knowledge articles for the admin interface.              |
| POST   | `/api/kb-submissions`     | Agent         | Submits a problem/solution pair for review.                    |
| GET    | `/api/kb-submissions`     | Admin         | Lists submissions, optionally filtered by status.              |
| PATCH  | `/api/kb-submissions/:id` | Admin         | Accepts or denies a submission, optionally with an admin note. |

## Tickets

| Method | Path                                       | Roles       | Notes                                                                                                                                                                            |
| :----- | :----------------------------------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/tickets`                             | any         | Results are scoped to requester for employees, assigned agent for agents, and all tickets for admins                                                                             |
| POST   | `/api/tickets`                             | employee    | `{ title ≤120, description ≤5000, category?, priority?, conversationId? }`; requester comes from the token. Requires an `Idempotency-Key` header; unexpected fields are rejected |
| GET    | `/api/tickets/:id`                         | any         | `{ ticket, audit }`; audit is only returned to agent/admin; 404 for other users' tickets or malformed IDs                                                                        |
| PATCH  | `/api/tickets/:id`                         | agent/admin | `{ status?, isOpen?, assigneeId?, notes?, expectedUpdatedAt? }`                                                                                                                  |
| POST   | `/api/tickets/:id/messages`                | agent/admin | Adds an agent reply to the linked conversation.                                                                                                                                  |
| POST   | `/api/tickets/:id/solution-draft/generate` | agent       | Generates an optional Gemini-backed solution draft.                                                                                                                              |
| POST   | `/api/tickets/:id/solution-draft`          | agent       | Saves an agent-authored solution draft.                                                                                                                                          |

Ticket fields: `id, reference (TCK-n), title, description, category, priority, status, isOpen, requesterId, requesterName, assignedTo, assigneeName, isEscalated, conversationId, escalationSummary, resolvedAt, createdAt, updatedAt`. `status` is `pending`, `in_progress`, or `resolved`; `isOpen` is an independent boolean.

- Agents can update status on their assigned tickets. Admins can update status and assignment. Agents and admins can toggle `isOpen`.
- `assigneeId` must be an agent profile, or `null` to unassign.
- Send the `updatedAt` you loaded as `expectedUpdatedAt`. If the ticket has changed since, the API returns `409 conflict` and the UI asks the user to reload.
- Each change writes an `audit_logs` row (`ticket.created`, `ticket.status_updated`, `ticket.updated`). Tickets created or escalated through `/api/actions/execute` get `ticket.created` / `ticket.escalated` rows from a database trigger (migration `20261118100000_audit_action_tickets.sql`).
- `conversationId` links a ticket to the chat it came from. It must be a conversation the caller owns, otherwise `400 validation_error`.
- `POST /api/tickets/:id/confirm-resolution` is employee-only and requester-scoped. It marks the requester's ticket `resolved` and `isOpen: false`; other employees receive `404`.
- Retrying `POST /api/tickets` with the same `Idempotency-Key` returns the original ticket. The client keeps the key for a retry and rotates it when the form changes.

### My tickets (client)

`/tickets` lists the signed-in user's tickets from `GET /api/tickets` (employees are scoped by the API; agents see assigned tickets). Agents can search, filter and sort their list, and update work status from each ticket card. `/tickets/:id` is a read-only employee detail with status, open/closed state, assignee and the related chat link; it shows no audit or edit controls.

Ticket work statuses are `pending`, `in_progress`, and `resolved`. The separate `isOpen` boolean controls whether a ticket is open or closed and can be changed by agents and admins. Closing a ticket does not change its work status.

## Escalation from chat

The chat UI offers **Talk to a person** on assistant replies. The employee reviews and can edit the summary, then confirms. Only then does the client call:

`POST /api/actions/execute` with headers `Authorization`, `Idempotency-Key`, and `X-Action-Confirmed: escalate_to_human`:

```json
{
  "proposal": {
    "intent": "escalate_to_human",
    "confidence": 1,
    "reason": "The employee asked for a person.",
    "arguments": {
      "title": "≤120 chars",
      "summary": "≤2000 chars",
      "reason": "low_confidence | user_requested_agent"
    }
  },
  "context": { "conversation_id": "uuid" }
}
```

Response `201`: `{ "status": "success", "action": "escalate_to_human", "ticket_id": "uuid", "status_label": "escalated", "queue": "IT-agents" }`. The client then loads `GET /api/tickets/:ticket_id` to show the `TCK-n` reference. A failed call shows an error and "Try again" reuses the same idempotency key, so a retry cannot create a second escalation.

The action route verifies the session through the same verifier as every other route (roles from `public.profiles`). The server redacts credentials and contact data from the title and summary before storing them.

## Analytics (dashboard)

`GET /api/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` (all authenticated roles)

- Defaults to the last 30 days. `to` includes the whole day. Dates are UTC. Maximum range is 366 days.
- Employees receive aggregates for tickets they requested; agents receive aggregates for tickets assigned to them; admins receive system-wide aggregates.
- The dashboard displays current totals by role and does not display date-range metrics.
- The response contains counts only. It includes no ticket text, message content, or requester identity. `assignedTickets`, `openEscalated`, and `openUnassigned` are returned to admins only.

| Metric            | Definition                                                                     |
| :---------------- | :----------------------------------------------------------------------------- |
| `totalTickets`    | Tickets visible to the caller, independent of the date range                   |
| `assignedTickets` | Admin only: all tickets with an agent assignee, regardless of status           |
| `byStatus`        | Current status distribution of tickets visible to the caller                   |
| `openByPriority`  | Priority distribution of visible tickets where `isOpen` is true                |
| `openEscalated`   | Admin only: visible open tickets with `isEscalated = true`                     |
| `openUnassigned`  | Admin only: visible open tickets with no assignee                              |
| `createdInRange`  | Visible tickets whose `createdAt` falls within `[from, to]`                    |
| `resolvedInRange` | Visible tickets whose `resolvedAt` (first move to resolved) falls in the range |

Known limitation: metrics are aggregated in the API over up to 1,000 most recent tickets. Move this to a SQL aggregate before the dataset grows past that size.

## Evidence

- Server: `server/tests/integration/{auth-analytics,chat,tickets,chat-escalation}.integration.test.ts`, `server/tests/unit/auth-tickets-analytics.test.ts`
- Client: `client/tests/integration/{auth,chat,dashboard,escalation-tickets,accessibility}.integration.test.tsx`, `client/tests/unit/{client-logic,escalation-draft}.test.ts`
- E2E (opt-in, needs the seeded local stack): `tests/e2e/{auth,chat,dashboard,escalation,accessibility}.spec.ts`
- Completion record: [S3 completion evidence](./saluta-completion-evidence.md)
