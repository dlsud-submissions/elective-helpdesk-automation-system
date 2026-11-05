# Ticket Service Contract

> Status: Sprint 3 contract baseline for employee ticket creation and agent follow-up.

## Purpose

This contract defines the expected authenticated ticket API for the helpdesk workflow. The request identity is derived from the active server session, not from a client-supplied user ID.

## Endpoints

### 1. `GET /api/tickets`

Returns an authorized list of tickets for the current user role.

#### Success response: `200 OK`

```json
{
  "tickets": [
    {
      "id": "TCK-2048",
      "title": "VPN disconnects after update",
      "status": "open",
      "priority": "medium",
      "category": "network",
      "createdAt": "2026-11-03T09:10:00.000Z",
      "updatedAt": "2026-11-03T09:10:00.000Z"
    }
  ]
}
```

#### Errors

- `401 Unauthorized` — no valid active session
- `403 Forbidden` — the user is not allowed to view this ticket set

### 2. `POST /api/tickets`

Creates a new ticket using the current authenticated user context.

#### Request body

```json
{
  "title": "VPN disconnects after update",
  "description": "The VPN client disconnects after the latest update and cannot reconnect.",
  "category": "network",
  "priority": "medium"
}
```

#### Success response: `201 Created`

```json
{
  "id": "TCK-2048",
  "title": "VPN disconnects after update",
  "status": "open",
  "priority": "medium",
  "category": "network",
  "createdAt": "2026-11-03T09:10:00.000Z",
  "updatedAt": "2026-11-03T09:10:00.000Z"
}
```

#### Validation errors

- `400 Bad Request` — missing or malformed required fields
- `413 Payload Too Large` — oversized description or invalid structure

### 3. `GET /api/tickets/:id`

Returns the details for a single ticket, restricted to authorized users.

#### Success response: `200 OK`

```json
{
  "id": "TCK-2048",
  "title": "VPN disconnects after update",
  "description": "The VPN client disconnects after the latest update and cannot reconnect.",
  "status": "open",
  "priority": "medium",
  "category": "network",
  "requesterId": "8f5b1a7e-6b0b-4d94-8d76-5f8dd62f8822",
  "createdAt": "2026-11-03T09:10:00.000Z",
  "updatedAt": "2026-11-03T09:10:00.000Z"
}
```

### 4. `PATCH /api/tickets/:id/status`

Applies a valid status transition and records the audit event.

#### Request body

```json
{
  "status": "in_progress",
  "assigneeId": "agent-123"
}
```

#### Success response: `200 OK`

```json
{
  "id": "TCK-2048",
  "status": "in_progress",
  "assigneeId": "agent-123",
  "updatedAt": "2026-11-03T09:20:00.000Z"
}
```

#### Invalid transitions

- `400 Bad Request` — attempted status change is not allowed
- `403 Forbidden` — caller lacks permission to update this ticket

## Response rules

- Ticket creation and update actions must use the authenticated session context, not a caller-supplied user ID.
- Status transitions must follow the documented allowlist and must not permit unsupported flows.
- Significant mutations must generate an audit record without exposing secrets or unnecessary personal data.
- Returned IDs and timestamps must be stable and deterministic enough for frontend state handling.
