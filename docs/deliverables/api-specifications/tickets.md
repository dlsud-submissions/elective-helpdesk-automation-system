# Ticket Service Contract

> Status: Current routes are implemented in `server/src/features/tickets/`.

Ticket requester identity is derived from the verified caller, not from a client-supplied user ID. The API enforces role and ownership rules on every request.

| Method and path                                       | Access         | Behavior                                                                                                         |
| :---------------------------------------------------- | :------------- | :--------------------------------------------------------------------------------------------------------------- |
| `GET /api/tickets`                                    | Authenticated  | Lists tickets visible to the caller's role and assignment/requester scope.                                       |
| `POST /api/tickets`                                   | Employee       | Creates a ticket linked to the requester and optionally to a conversation. Requires an `Idempotency-Key` header. |
| `GET /api/tickets/:ticketId`                          | Authenticated  | Returns a ticket only when the caller is authorized to view it.                                                  |
| `PATCH /api/tickets/:ticketId`                        | Agent or admin | Applies allowed ticket updates; assignment authority is restricted to admins.                                    |
| `POST /api/tickets/:ticketId/messages`                | Agent or admin | Adds an agent reply to the linked conversation.                                                                  |
| `POST /api/tickets/:ticketId/solution-draft/generate` | Agent          | Requests an optional server-side generated solution draft for an authorized ticket.                              |
| `POST /api/tickets/:ticketId/solution-draft`          | Agent          | Persists an agent-authored solution draft.                                                                       |

Ticket fields and legal state transitions are validated by the server. Creation uses authenticated requester context and idempotency protection. Invalid input returns a controlled client error; unauthorized operations are rejected by server-side role and ticket-scope checks.

For action proposals outside these direct ticket routes, see [Allowlisted Actions](allowlisted-actions.md). For the UI, see the [agent/admin wireframes](../wireframes/agent-admin.md).
