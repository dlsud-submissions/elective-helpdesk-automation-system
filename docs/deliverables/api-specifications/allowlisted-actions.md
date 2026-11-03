# Allowlisted Action Contract

> Status: Sprint 1 planning document only. The backend is documented here but not implemented in source code during this sprint.

## Purpose

This document defines the system's approved action names, required payload fields, and the server-side validation rules that must be enforced before any action is executed. The frontend and the LLM may propose actions, but the backend remains authoritative.

## Action catalog

### 1. `create_ticket`

**Trigger:** The user reports a problem or asks to open a support case.

**Required input:**

```json
{
  "action": "create_ticket",
  "user_id": "employee-123",
  "category": "hardware",
  "summary": "Laptop cannot connect to the company Wi-Fi",
  "priority": "medium",
  "description": "User reports repeated disconnects after recent VPN client update."
}
```

**Validation rules:**

- `user_id` must match an authenticated user profile.
- `category` must be one of the approved ticket categories.
- `summary` and `description` must be non-empty strings.
- `priority` must be one of the supported values such as `low`, `medium`, or `high`.
- The backend must create the ticket record and return an ID only after persistence succeeds.

**Success response example:**

```json
{
  "status": "success",
  "action": "create_ticket",
  "ticket_id": "TCK-2048",
  "status_label": "open"
}
```

### 2. `escalate_to_human`

**Trigger:** The user asks for a live agent, the model is uncertain, or the request cannot be resolved by approved documentation.

**Required input:**

```json
{
  "action": "escalate_to_human",
  "user_id": "employee-123",
  "conversation_id": "conv-42",
  "reason": "low_confidence",
  "summary": "User cannot resolve Wi-Fi connectivity issue; no approved troubleshooting steps matched."
}
```

**Validation rules:**

- `user_id` must be a recognized authenticated user.
- `conversation_id` must exist or be created in the current session.
- `reason` must be a supported escalation cause such as `low_confidence`, `policy_gap`, or `user_requested_agent`.
- `summary` must clearly describe the issue and any relevant context.
- The action must queue or create a human-agent follow-up instead of claiming the issue is resolved.

**Success response example:**

```json
{
  "status": "success",
  "action": "escalate_to_human",
  "escalation_id": "ESC-17",
  "queue": "IT-agents"
}
```

### 3. `request_clarification`

**Trigger:** Required details are absent or the request is ambiguous.

**Required input:**

```json
{
  "action": "request_clarification",
  "conversation_id": "conv-42",
  "field_names": ["device_type", "error_message"],
  "question": "Please share the affected device type and the exact error text."
}
```

**Validation rules:**

- No privileged or write action is executed.
- `field_names` and `question` must be present if clarification is required.
- The system should not mark the request as resolved or successful.

**Success response example:**

```json
{
  "status": "pending",
  "action": "request_clarification",
  "message": "Please share the affected device type and the exact error text."
}
```

### 4. `send_test_notification` (approved demo-only integration)

**Trigger:** Demonstration of a safe notification or test webhook only when explicitly approved.

**Required input:**

```json
{
  "action": "send_test_notification",
  "channel": "slack",
  "message": "New IT ticket assigned to the queue",
  "ticket_id": "TCK-2048"
}
```

**Validation rules:**

- Integration must be allowlisted and approved for demo testing.
- `channel` must be one of the approved test channels.
- `ticket_id` and `message` must be non-empty.
- The operation is best-effort and must fail safely if the integration is unavailable.

**Failure response example:**

```json
{
  "status": "error",
  "action": "send_test_notification",
  "error_code": "integration_unavailable",
  "message": "The notification could not be sent. The ticket was still created, but the external integration failed."
}
```

## Shared validation rules

- The backend validates every action before execution.
- The frontend never sends privileged or real credentials to the browser.
- Unsupported actions are rejected with an explanatory error or a safe clarification prompt.
- All write operations should be recorded in an audit event including the action name, initiator, timestamp, and outcome.
- Duplicate requests should be compared against an existing ticket or escalation record and prevented where feasible.

## Security boundary

This action contract is intentionally limited to simulated or explicitly approved demo flows. Real admin actions such as password resets, role changes, or production provisioning must be excluded unless a separate security review approves the integration.

---

[← Workflow Automation](../../10-workflow-automation.md)
