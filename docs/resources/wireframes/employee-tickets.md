# W-03 New Ticket and W-04 My Tickets

> Status: Low-fidelity wireframes for review. Endpoints are proposed, not implemented.

Roles: employee · Journeys: J2, J3 · Matrix: CI-04, E2E-02

## W-03 New ticket form

```text
+--------------------------------------------------------------+
| New ticket                                                   |
+--------------------------------------------------------------+
| (!) Fix 2 fields before submitting:                          |
|     - Short summary   - Category                             |
|                                                              |
| Short summary *                                              |
| [                                                     ]      |
|  Enter a short summary of the issue.                         |
|                                                              |
| Category *                     Priority *                    |
| [ Select a category  v]        (•) Low ( ) Medium ( ) High   |
|  Choose a category.                                          |
|                                                              |
| Description *                                                |
| [ Laptop disconnects from Wi-Fi every few minutes since    ] |
| [ the VPN client update on Monday.                         ] |
|                                                              |
| (i) Created from your chat on Oct 28. The conversation is    |
|     attached so the agent can see what you already tried.    |
|                                                              |
| Don't include passwords or secret codes.                     |
|                                   [Cancel]  [Submit ticket]  |
+--------------------------------------------------------------+
```

## W-03 Success

```text
+--------------------------------------------------------------+
| (✓) Ticket TCK-2048 created                                  |
|     Status: Open · Priority: Medium                          |
|     You'll see updates in My tickets.                        |
|     [View ticket]  [Back to chat]                            |
+--------------------------------------------------------------+
```

| State      | Notes                                                                                                         |
| :--------- | :------------------------------------------------------------------------------------------------------------ |
| Prefilled  | Opened from chat: summary and description are prefilled from the conversation and stay editable.              |
| Validation | Client-side checks for required fields and length; the API's validation errors are mapped to the same fields. |
| Submitting | Button shows "Submitting…" and is disabled to prevent duplicate tickets.                                      |
| Success    | Shown only after the API returns a `ticket_id`.                                                               |
| Failure    | "The ticket was not created. Try again." Form values are kept.                                                |

## W-04 My tickets list

```text
+--------------------------------------------------------------+
| My tickets                                   [New ticket]    |
| Status: [All v]                                              |
+--------------------------------------------------------------+
| ID        Summary                      Status       Updated  |
| TCK-2049  VPN drops on home network    [Escalated]  10:15    |
| TCK-2048  Wi-Fi disconnects            [Open]       Oct 28   |
| TCK-2031  Printer on 3F not found      [Resolved]   Oct 21   |
+--------------------------------------------------------------+

Mobile: each row becomes a card
+------------------------------+
| TCK-2049        [Escalated]  |
| VPN drops on home network    |
| Updated 10:15                |
+------------------------------+
```

| State   | Display                                                                     |
| :------ | :-------------------------------------------------------------------------- |
| Loading | Three skeleton rows.                                                        |
| Empty   | "You have no tickets. Ask IT first; many issues are solved in chat." + link |
| Error   | Inline alert with Retry.                                                    |

## W-04 Ticket status detail

```text
+--------------------------------------------------------------+
| < My tickets                                                 |
| TCK-2048  Wi-Fi disconnects               [Open]  Medium     |
+--------------------------------------------------------------+
| Category: Network       Assigned to: Not assigned yet        |
|                                                              |
| Description                                                  |
| Laptop disconnects from Wi-Fi every few minutes...           |
|                                                              |
| Status history                                               |
|  ● Open          Oct 28 10:05  Created from chat             |
|  ○ In progress   —                                           |
|  ○ Resolved      —                                           |
|                                                              |
| Related chat: [View conversation]                            |
+--------------------------------------------------------------+
```

Employees can view their own tickets only. They cannot change status or assignment in the prototype.

## Data and actions

| Action          | Interface (proposed)                    | Request                                                              | Response used by UI                                                                                                          |
| :-------------- | :-------------------------------------- | :------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| Create ticket   | `POST /api/tickets`                     | `summary`, `category`, `priority`, `description`, `conversation_id?` | `ticket_id`, `status`, `priority`, `created_at`                                                                              |
| List my tickets | `GET /api/tickets?requester=me&status=` | query filters                                                        | `tickets[]` with `id`, `summary`, `status`, `priority`, `updated_at`, `escalated`                                            |
| Ticket detail   | `GET /api/tickets/:id`                  | none                                                                 | `id`, `summary`, `description`, `category`, `priority`, `status`, `assigned_to.display_name`, `history[]`, `conversation_id` |

`user_id` is never sent from the browser; the API derives the requester from the verified token. A request for another user's ticket returns 404 or 403 and shows the "not found" or "access denied" state.

## Responsive and accessibility

- The error summary at the top of the form is focusable and receives focus on failed submit.
- Priority uses a radio group inside a `fieldset` with a `legend`.
- The ticket table uses `th scope="col"`; on mobile, cards keep the same reading order.
- Status history is an ordered list; future steps are marked "not reached" in text.

---

[← W-02 Employee chat](employee-chat.md) · [Wireframe index](README.md) · Next: [W-05–W-08 Agent and admin](agent-admin.md)
