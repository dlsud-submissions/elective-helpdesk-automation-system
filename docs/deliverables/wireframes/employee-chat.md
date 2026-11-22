# W-02 Employee Chat

> Status: Low-fidelity wireframe for review. Endpoints are proposed, not implemented.

Roles: employee (agents and admins may also use it) · Journeys: J1, J2, J3 · Matrix: CI-01, CI-02, CI-03, E2E-01, E2E-04, REG-02

## Empty state

```text
+--------------------------------------------------------------+
| Ask IT                                        [New chat]     |
+--------------------------------------------------------------+
|                                                              |
|     How can we help?                                         |
|     Answers come from approved IT procedures and list        |
|     their sources. You can ask for a person at any time.     |
|                                                              |
|     Try:  [How do I connect to the office Wi-Fi?]            |
|           [My VPN keeps disconnecting]                       |
|           [How do I reset my password?]                      |
|                                                              |
+--------------------------------------------------------------+
| [ Describe your IT issue...                        ] [Send]  |
| Don't share passwords or secret codes.  [Talk to a person]   |
+--------------------------------------------------------------+
```

## Cited answer

```text
+--------------------------------------------------------------+
|                         You  10:02                           |
|          My laptop won't connect to the office Wi-Fi.  |     |
|                                                              |
| Assistant  10:02                                             |
| | Try these steps:                                           |
| | 1. Forget the "Corp-Office" network and reconnect.         |
| | 2. Sign in with your work account when prompted. [1]       |
| | 3. If it still fails, restart the network adapter. [2]     |
| |                                                            |
| | Sources                                                    |
| |  [1] KB-104 Connecting to office Wi-Fi                     |
| |  [2] KB-117 Restarting a network adapter                   |
| |                                                            |
| | Did this solve it?  [Yes] [No, create a ticket]            |
| |                     [Talk to a person]                     |
+--------------------------------------------------------------+
```

Selecting a source opens a side panel (bottom sheet on mobile) showing the article title, category, last updated date, and the excerpt that was used.

## Other states

```text
Loading (after Send)                 Uncertain answer
+-------------------------------+    +-------------------------------+
| Assistant                     |    | Assistant                     |
| | ● ● ●  Checking approved    |    | | I couldn't find an approved |
| |        IT procedures...     |    | | procedure for this, so I    |
+-------------------------------+    | | can't confirm an answer.    |
| [ disabled input    ] [....]  |    | | [Create a ticket]           |
+-------------------------------+    | | [Talk to a person]          |
                                     +-------------------------------+

Clarification needed                 Escalated
+-------------------------------+    +-------------------------------+
| Assistant                     |    | (i) Sent to the IT team       |
| | Which device is affected,   |    |  Ticket TCK-2049 · Escalated  |
| | and what is the exact error |    |  An agent will continue from  |
| | message?                    |    |  this conversation.           |
| | Needed: device type, error  |    |  [View ticket]                |
+-------------------------------+    +-------------------------------+

Error (API failure or Gemini 429)
+--------------------------------------------------------------+
| (!) We couldn't get an answer right now. Your message was    |
|     not lost.   [Retry]   [Create a ticket instead]          |
+--------------------------------------------------------------+
```

| State           | Trigger                            | Notes                                                                                    |
| :-------------- | :--------------------------------- | :--------------------------------------------------------------------------------------- |
| Empty           | New conversation                   | Suggested prompts fill the input; they do not send automatically.                        |
| Validation      | Send with empty or over-limit text | "Type a question first." / "Keep messages under 2,000 characters." Nothing is sent.      |
| Loading         | Request in flight                  | Input and Send disabled; typing indicator announced once via the live region.            |
| Cited answer    | `outcome: answered`                | Numbered citations map to the Sources list.                                              |
| Uncertain       | `outcome: escalation_suggested`    | No steps are invented; offers ticket or person.                                          |
| Clarification   | `outcome: clarification`           | Shows the requested fields; the original request stays pending.                          |
| Escalated       | Escalation succeeded               | Shows ticket/escalation ID and queue. Only shown after the API confirms persistence.     |
| Error           | 4xx/5xx, timeout, or upstream 429  | Never shows a success state. Retry re-sends the same message.                            |
| Possible secret | Text looks like a password or key  | Warning before sending: "This looks like a password. Remove it before sending." (REG-04) |

## Data and actions

| Action              | Interface (proposed)                                     | Request                                           | Response used by UI                                                                                                                  |
| :------------------ | :------------------------------------------------------- | :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------- |
| Send question       | `POST /api/chat/messages`                                | `conversation_id?`, `content`                     | `conversation_id`, `message.id`, `message.content`, `message.source_refs[]` (`article_id`, `title`, `excerpt`), `outcome`, `fields?` |
| Load conversation   | `GET /api/conversations/:id/messages`                    | none                                              | `messages[]` with `sender_type`, `content`, `created_at`, `source_refs`                                                              |
| Open source         | `GET /api/knowledge/articles/:id`                        | none                                              | `title`, `category`, `updated_at`, `body` excerpt                                                                                    |
| Talk to a person    | `POST /api/escalations`                                  | `conversation_id`, `reason: user_requested_agent` | `escalation_id`, `ticket_id`, `queue`, `status`                                                                                      |
| No, create a ticket | Navigate to W-03 with the conversation summary prefilled | n/a                                               | n/a                                                                                                                                  |

`outcome` values the UI must handle: `answered`, `clarification`, `escalation_suggested`, `ticket_created`, `escalated`. Any unknown value is treated as an error.

The browser never calls Gemini directly. The model can only propose actions; the UI shows an action result only from the API response.

## Responsive and accessibility

- Mobile: composer is pinned to the bottom; the "Talk to a person" button stays visible above the keyboard.
- Message list is a `log` region (`role="log"`, `aria-live="polite"`).
- Enter sends, Shift+Enter adds a new line; the Send button is also keyboard-reachable.
- Citation markers `[1]` are links to the matching source entry, with labels like "Source 1: KB-104 Connecting to office Wi-Fi".

---

[← W-01 Sign-in](sign-in.md) · [Wireframe index](README.md) · Next: [W-03/W-04 Tickets](employee-tickets.md)
