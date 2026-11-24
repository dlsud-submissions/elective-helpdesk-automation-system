# Allowlisted Action Contract

> Status: Current contract for `POST /api/actions/execute`. The endpoint validates a caller-supplied proposal; it does not call an LLM or infer an action from chat.

## Request

Every request requires a valid bearer token. The request body contains a `proposal` object and may contain a `context` object:

```json
{
  "proposal": {
    "intent": "create_ticket",
    "confidence": 0.9,
    "arguments": {
      "title": "Laptop cannot connect",
      "description": "The demo device cannot join Wi-Fi.",
      "category": "network",
      "priority": "medium"
    },
    "reason": "The employee reported a network issue."
  },
  "context": {
    "conversation_id": "88888888-8888-4888-8888-888888888888"
  }
}
```

`proposal` must contain only `intent`, `confidence` (0 through 1), `arguments`, and `reason`. Extra keys and unsupported intents are rejected. `context.conversation_id` is optional and, when supplied, must be a UUID.

For writes (`create_ticket`, `escalate_to_human`, and `send_test_notification`), include:

- `X-Action-Confirmed: <intent>` to explicitly confirm the proposed action.
- `Idempotency-Key: <unique-key>` to safely identify retries.

Clarification, knowledge-question, and unsupported outcomes return before write confirmation is required.

## Supported intents

| Intent                   | Required arguments                                                | Authorization and behavior                                                                                                                                                                                    |
| :----------------------- | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_ticket`          | `title`, `description`, `category`, `priority`                    | Employee only. Persists a ticket using the authenticated user's ID; supported categories are `hardware`, `software`, `network`, `account`, and `other`; priorities are `low`, `medium`, and `high`.           |
| `escalate_to_human`      | `title`, `summary`, `reason`                                      | Employee only. Persists an escalation ticket and returns its queue outcome. Supported reasons are `low_confidence`, `policy_gap`, and `user_requested_agent`.                                                 |
| `send_test_notification` | `channel`, `message`, and either `ticket_id` or `conversation_id` | Agent or admin only. `channel` must be `simulation`; execution is rejected unless `ENABLE_TEST_NOTIFICATION_SIMULATION=true`. It records a simulated notification and does not send an external notification. |
| `request_clarification`  | `field_names`, `question`                                         | Returns a pending clarification response without persisting an action. A valid conversation ID is required in `context`.                                                                                      |
| `knowledge_question`     | None                                                              | Returns `not_actionable`; questions should use the chat API.                                                                                                                                                  |
| `unsupported`            | Optional `missing_fields`                                         | Returns an unsupported outcome without executing a write.                                                                                                                                                     |

The authenticated profile determines identity and role. A proposal cannot select another requester or override server authorization. User-provided text is sanitized before storage.

## Outcomes and failures

- Missing required fields return HTTP 422 with `status: "needs_clarification"` and the missing field names.
- A proposal confidence below `0.5` returns a clarification result rather than executing a write.
- Missing or mismatched confirmation returns HTTP 409; an invalid/missing idempotency key returns HTTP 400.
- Invalid proposals return HTTP 400, unauthenticated requests HTTP 401, and unauthorized or disabled simulation actions HTTP 403.
- Persistence failures return a controlled error and do not claim a successful action or return a success ID.
- Successful ticket/escalation/simulation writes return HTTP 201 with the persisted ticket/run identifier and status.

This contract describes validation and execution boundaries, not model behavior. Any caller or UI proposing an action must obtain clear user intent and confirmation; backend validation remains authoritative.

---

[Workflow Automation](../required/10-workflow-automation.md) · [API Specifications](README.md)
