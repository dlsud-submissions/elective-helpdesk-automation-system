# W-05 to W-08 Agent and Admin Views

> Status: Reflects the implemented Sprint 3–5 UI. Agent views are accessed via `/chat` and `/tickets`; admin views via `/queue`, `/admin/users`, and `/admin/kb-articles`.

Roles: agent (W-05, W-06, W-06b), admin (W-07, W-07b, W-08) · Journeys: J3, J4, J5, J6 · Matrix: E2E-03, E2E-04, E2E-05, SI-05

---

## W-05 Agent — My Tickets page (`/tickets`)

Agents see only tickets assigned to them. Each ticket row may show an **Open in chat** link when the ticket has a linked conversation and is not yet resolved/closed.

```text
My Tickets
+--------------------------------------------------------------+
| > TCK-2005  [Open] Medium                                    |
|   What is included in laptop onboarding?                     |
|   Dana Cruz · 10:48 AM                        [Open in chat] |
|                                                              |
| > TCK-2003  [Resolved] Low                                   |
|   Request for second monitor                                 |
|   Dana Cruz · Nov 19                                         |
+--------------------------------------------------------------+
```

Clicking a ticket row opens **W-06 Ticket Detail** (status-only panel, no reply form).

---

## W-06 Agent — Ticket detail (`/tickets/:id`, agent view)

Agents can only change status here. Sending replies to the employee is done via Chat (W-06b).

```text
← Back to dashboard
TCK-2005 · Medium priority
What is included in laptop onboarding?
Requester: Dana Cruz · Category: general · Opened 11/24/2026, 10:48:58 AM
[Open]

Description
Reported in chat: What is included in laptop onboarding?

Status
[ Open ▾ ]   [Save]
```

| State    | Notes                                      |
| :------- | :----------------------------------------- |
| Saving   | Save button disabled, shows "Saving…".     |
| Saved    | Confirmation alert after API responds.     |
| Conflict | "Updated by someone else. Reload." (SI-05) |

---

## W-06b Agent — Chat page (`/chat/:conversationId`)

Agents arrive here via the **Open in chat** link on My Tickets or the Queue page. The agent sees the full conversation history and can reply to the employee. Sending a message does **not** resolve the ticket; status changes happen in W-06.

```text
Ask IT
+--------------------------------------------------------------+
| TCK-2005 · medium priority · open                            |
| What is included in laptop onboarding?                       |
| Reported in chat: What is included in laptop onboarding?     |
|                             [Mark ticket as resolved]        |
+--------------------------------------------------------------+

                                      Employee 10:48 AM
                                      What is included in laptop onboarding?

Harbor 10:48 AM
Based on approved helpdesk guidance, Laptop onboarding checklist…
[1] Laptop onboarding checklist · Endpoint Support SOP

Ticket details 10:49 AM
Ticket TCK-2005 assigned to Lee Santos.
Title: What is included in laptop onboarding?
Category: general  Priority: medium
Description: Reported in chat: What is included in laptop onboarding?

                                           You 11:37 AM
                                           Hello! Laptop onboarding includes…

+--------------------------------------------------------------+
| Reply to requester                                           |
| Message                                                      |
| ┌──────────────────────────────────────────────────────┐    |
| │                                                      │    |
| └──────────────────────────────────────────────────────┘    |
|                                              [✦] [💾] [Send]|
+--------------------------------------------------------------+
```

- **Agent's own messages** appear on the right side labelled "You".
- **Employee messages** appear on the left labelled "Employee".
- **Harbor AI messages** appear on the left with the Harbor logo and "Harbor".
- **System messages** (ticket assignment details) appear as a neutral info block.
- **✦ icon** = Generate with Gemini (icon-only button, no label). Opens a draft in the message box.
- **💾 icon** = Save response to database. Submits the current draft as a KB pair for admin review.
- **Send** = Sends message to employee. Does **not** mark the ticket resolved.
- **Mark ticket as resolved** = Changes ticket status to `resolved` via the API.

| State      | Notes                                                                |
| :--------- | :------------------------------------------------------------------- |
| Sending    | Send button disabled; shows "Sending…".                              |
| Sent       | Message appears in conversation; reply box clears.                   |
| Generating | Gemini icon shows spinner; textarea populated with draft on success. |
| KB saved   | 💾 button shows "Saved ✓"; awaits admin review in Solutions queue.   |
| Error      | Inline alert with error message.                                     |

---

## W-07 Admin — Queue page (`/queue`)

The Queue page has two subtabs: **Tickets** and **Solutions**.

### W-07a Tickets subtab (`/queue` or `/queue?tab=tickets`)

```text
Queue
[ Tickets ]  [ Solutions ]
+--------------------------------------------------------------+
| Status [Active ▾]  Assigned [All assignees ▾]               |
| Created from [date]  Created to [date]                       |
+--------------------------------------------------------------+
| > TCK-2005  [Escalated]  [Open]  Medium                      |
|   What is included in laptop onboarding?                     |
|   Dana Cruz · 5 min ago · Lee Santos                         |
|                                                              |
| > TCK-2003  [Resolved]  Low                                  |
|   Request for second monitor                                 |
|   Dana Cruz · Nov 19 · Lee Santos                            |
+--------------------------------------------------------------+
                   (ticket detail opens in split panel →)
```

Clicking a ticket opens the ticket detail in a right split panel (same `TicketDetail` component as agent view but admin can also reassign).

### W-07b Solutions subtab (`/queue?tab=solutions`)

Lists agent-submitted problem → solution pairs with status `pending`, awaiting admin accept or deny.

```text
Queue
[ Tickets ]  [ Solutions ]
+--------------------------------------------------------------+
| Review agent-submitted problem → solution pairs              |
| before they are saved to the knowledge base.                 |
+--------------------------------------------------------------+
| Submitted by Lee Santos · 11/24/2026, 11:37:02 AM · TCK-2005|
|                                                              |
| Employee problem                                             |
| Reported in chat: What is included in laptop onboarding?    |
|                                                              |
| Agent solution                                              |
| Hello! Laptop onboarding includes…                          |
|                                                              |
| Admin note (optional)  [________________________]           |
|                                                             |
| [Accept]  [Deny]                                            |
+--------------------------------------------------------------+
```

| State    | Notes                                        |
| :------- | :------------------------------------------- |
| No items | "No pending submissions."                    |
| Saving   | Accept/Deny buttons disabled, "Saving…".     |
| Accepted | Row disappears; pair visible in KB Articles. |
| Denied   | Row disappears; pair marked denied.          |

---

## W-08 Admin — Knowledge Base (`/admin/kb-articles`)

Shows **all** knowledge: seeded articles from `knowledge_articles` (Supabase) and accepted agent submissions from `kb_submissions`. Badges show the source type. Admin can also create new pairs directly (auto-accepted).

```text
Knowledge Base                                        [+ New]
All problem → solution knowledge used by Harbor…

+--------------------------------------------------------------+
| [Seeded]  IT Security Handbook · account-access             |
| Problem / Title                                              |
| Password reset after lockout                                 |
| Solution                                                     |
| To reset a locked account, verify the user identity…        |
+--------------------------------------------------------------+
| [Agent submission]  Lee Santos · 11/24/2026, 11:37 AM       |
| Problem / Title                                              |
| What is included in laptop onboarding?                       |
| Solution                                                     |
| Hello! Laptop onboarding includes…                          |
+--------------------------------------------------------------+
```

**New pair form** (inline, toggled by [+ New]):

```text
New KB pair
Employee problem / question
[ textarea ]
Solution
[ textarea ]
[Save]  [Cancel]
```

Admin-created pairs are auto-accepted (no queue step).

| State      | Notes                                        |
| :--------- | :------------------------------------------- |
| Loading    | "Loading knowledge base…" spinner.           |
| Empty      | "No articles yet. Accept submissions…"       |
| Saved      | New pair appears at top of list immediately. |
| Form error | "Both fields are required."                  |

---

## W-09 Admin — Users (`/admin/users`)

Manage user accounts and roles. Existing behavior unchanged.

---

## W-10 Admin — Dashboard (`/dashboard`)

Operational metrics. Shared with agents (agent sees own metrics, admin sees all). Existing behavior unchanged.

---

## Data and actions

| Screen | Action                   | Endpoint                                                                  | Notes                                                           |
| :----- | :----------------------- | :------------------------------------------------------------------------ | :-------------------------------------------------------------- |
| W-06   | Update ticket status     | `PATCH /api/tickets/:id`                                                  | Agents only change status here; no reply form in ticket detail. |
| W-06b  | Send agent message       | `POST /api/tickets/:id/reply`                                             | Adds `agent` message to conversation. Does not resolve ticket.  |
| W-06b  | Generate Gemini draft    | `POST /api/tickets/:id/solution`                                          | Returns draft text; populates reply textarea.                   |
| W-06b  | Save to KB queue         | `POST /api/kb-submissions`                                                | Submits (problem, solution) pair for admin review.              |
| W-06b  | Mark ticket resolved     | `PATCH /api/tickets/:id` `{status: "resolved"}`                           | Resolves the linked ticket.                                     |
| W-07a  | List/filter tickets      | `GET /api/tickets`                                                        | Admin sees all tickets; agent sees only assigned.               |
| W-07b  | List pending submissions | `GET /api/kb-submissions?status=pending`                                  | Admin-only.                                                     |
| W-07b  | Accept / deny submission | `PATCH /api/kb-submissions/:id`                                           | `{status: "accepted" \| "denied", adminNote?}`                  |
| W-08   | List all KB articles     | `GET /api/knowledge/articles` + `GET /api/kb-submissions?status=accepted` | Combined view: seeded articles + accepted submissions.          |
| W-08   | Create new KB pair       | `POST /api/kb-submissions` then `PATCH` to accept                         | Admin creates and immediately auto-accepts.                     |

---

## Responsive and accessibility

- W-07a on tablet/mobile: list is full width; selecting a ticket navigates to the detail as its own view with a Back link.
- Subtabs (Tickets / Solutions) use `role="tablist"` / `role="tab"` / `role="tabpanel"`.
- Agent message bubble: right-aligned with "You" label when the viewing user is the sender.
- Employee message bubble: left-aligned with "Employee" label (agent view) or "You" label (employee view).
- Filters are real `<select>` and `<input type="date">` elements with visible labels; result count announced politely after filter change.
- Metric cards use text, not color alone.

---

[← W-03/W-04 Tickets](employee-tickets.md) · [Wireframe index](README.md) · Next: [Static mockup](../mockups/index.html)
