# W-05 to W-08 Agent and Admin Views

> Status: Low-fidelity wireframes for review. Endpoints are proposed, not implemented.

Roles: agent (W-05, W-06), admin (all) · Journeys: J3, J4, J5, J6 · Matrix: E2E-03, E2E-04, E2E-05, SI-05

## W-05 Agent ticket queue

```text
Desktop: list and detail side by side
+-----------------------------------+--------------------------------+
| Ticket queue                      |  TCK-2049 (see W-06)           |
| [Search...      ] Status [Open v] |                                |
| [ ] Escalated only  [x] Unassigned|                                |
+-----------------------------------+                                |
| > TCK-2049  [Escalated] High      |                                |
|   VPN drops on home network       |                                |
|   Dana Cruz · 5 min ago           |                                |
|                                   |                                |
|   TCK-2048  [Open] Medium         |                                |
|   Wi-Fi disconnects               |                                |
|   Dana Cruz · Oct 28              |                                |
|                                   |                                |
|   TCK-2045  [In progress] Low     |                                |
|   Request for second monitor      |                                |
|   Lee Santos · Oct 27 · You       |                                |
+-----------------------------------+--------------------------------+
```

| State   | Display                                                        |
| :------ | :------------------------------------------------------------- |
| Loading | Skeleton list.                                                 |
| Empty   | "No tickets match these filters." with a Clear filters button. |
| Error   | Inline alert with Retry.                                       |

Escalated tickets sort first, then by priority, then by age.

## W-06 Agent ticket detail

```text
+--------------------------------------------------------------+
| TCK-2049  VPN drops on home network   [Escalated]  High      |
| Requester: Dana Cruz · Category: Network · Opened 10:15      |
+--------------------------------------------------------------+
| Escalation summary (AI-generated, check before acting)       |
| | Reason: User requested agent                              |
| | Symptoms: VPN disconnects every 10–15 min on home Wi-Fi.  |
| | Tried: KB-121 reconnect steps, router restart.            |
| | Sources: KB-121 VPN troubleshooting                       |
| | Missing: VPN client version.                              |
|                                                              |
| [View full conversation]                                     |
|                                                              |
| Status   [In progress v]   Assigned to [Me v]   [Save]       |
|                                                              |
| (✓) Saved. Status changed to In progress.                    |
+--------------------------------------------------------------+
```

| State      | Notes                                                                                          |
| :--------- | :--------------------------------------------------------------------------------------------- |
| Saving     | Save disabled and shows "Saving…".                                                             |
| Saved      | Confirmation only after the API responds; the queue row updates.                               |
| Conflict   | "This ticket was updated by someone else. Reload to see changes." (another agent saved first). |
| Denied     | 403: "You don't have permission to update this ticket." Values revert. (SI-05)                 |
| No summary | Ticket not from chat: summary panel is hidden and the description is shown instead.            |

The escalation summary must not contain passwords, keys, or unnecessary personal data (E2E-04). It is labelled as AI-generated so agents verify it.

## W-07 Admin knowledge base

```text
+--------------------------------------------------------------+
| Knowledge base                               [New article]   |
| [Search...          ] Category [All v]  Show [All v]         |
+--------------------------------------------------------------+
| ID      Title                          Category   Published  |
| KB-104  Connecting to office Wi-Fi     Network    [x] Yes    |
| KB-117  Restarting a network adapter   Network    [x] Yes    |
| KB-121  VPN troubleshooting            Network    [x] Yes    |
| KB-130  Requesting new hardware        Hardware   [ ] Draft  |
+--------------------------------------------------------------+

Article editor
+--------------------------------------------------------------+
| Title *        [ Requesting new hardware                  ]  |
| Category *     [ Hardware v ]   Source name [ IT Policy v2 ] |
| Body *                                                       |
| [ ...                                                     ]  |
| [x] Published (available to the assistant after indexing)    |
|                                        [Cancel]  [Save]      |
| (i) Saving re-indexes this article for search.               |
+--------------------------------------------------------------+
```

States: loading, empty ("No articles yet"), validation errors on required fields, save success, save failure, and "Indexing…" after save until the API confirms the article is searchable.

## W-08 Admin support metrics

```text
+--------------------------------------------------------------+
| Support metrics                     Range [Last 7 days v]    |
+--------------------------------------------------------------+
| +-----------+ +-----------+ +-----------+ +-----------+      |
| | Questions | | Answered  | | Tickets   | | Escalated |      |
| |    142    | | in chat   | | opened    | |    9      |      |
| |           | |   61%     | |    37     | |           |      |
| +-----------+ +-----------+ +-----------+ +-----------+      |
|                                                              |
| Tickets by status          Top knowledge sources             |
| Open         ███████  14   KB-104 Wi-Fi           31 cites   |
| In progress  ████      8   KB-121 VPN             22 cites   |
| Resolved     ██████   12   KB-117 Adapter         15 cites   |
| Closed       █         3                                     |
+--------------------------------------------------------------+
```

Each chart has a text table alternative for screen readers. Empty range shows "No activity in this period."

## Data and actions

| Screen | Action                 | Interface (proposed)                                                       | Data used by UI                                                                                                        |
| :----- | :--------------------- | :------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| W-05   | List queue             | `GET /api/tickets?status=&assigned=&escalated=&q=`                         | `tickets[]`: `id`, `summary`, `status`, `priority`, `escalated`, `requester.display_name`, `assigned_to`, `updated_at` |
| W-06   | Ticket detail          | `GET /api/tickets/:id`                                                     | ticket fields, `escalation` (`reason`, `summary`, `source_refs[]`), `conversation_id`                                  |
| W-06   | Update status/assignee | `PATCH /api/tickets/:id`                                                   | request: `status`, `assigned_to`, `updated_at` (for conflict check); response: updated ticket                          |
| W-06   | View conversation      | `GET /api/conversations/:id/messages`                                      | `messages[]`                                                                                                           |
| W-07   | List/edit articles     | `GET /api/knowledge/articles`, `POST`, `PATCH /api/knowledge/articles/:id` | `id`, `title`, `category`, `source_name`, `body`, `is_published`, `updated_at`, `index_status`                         |
| W-08   | Metrics                | `GET /api/metrics/summary?range=7d`                                        | `questions`, `answered_rate`, `tickets_opened`, `escalations`, `by_status{}`, `top_sources[]`                          |

Every agent/admin write must be authorized by the API using `profiles.role` and recorded as an audit event. Hiding a button in the UI is only a convenience.

## Responsive and accessibility

- W-05 on tablet/mobile: the list is full width; selecting a ticket navigates to W-06 as its own page with a Back link.
- Filters are real form controls with labels; the result count is announced politely after filtering.
- Metric cards use text, not color alone; bar charts include the numeric value next to each bar.
- The published checkbox in W-07 has a label that names the article, for example "Published: VPN troubleshooting".

---

[← W-03/W-04 Tickets](employee-tickets.md) · [Wireframe index](README.md) · Next: [Static mockup](../mockups/index.html)
