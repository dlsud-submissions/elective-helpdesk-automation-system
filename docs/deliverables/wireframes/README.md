# UI Wireframes

> Status: Low-fidelity design reference. The implementation is the source of truth; these screens do not describe every later-added control or state. Current routes and API behavior are documented in the root README and API specification pack.

Owner: Saluta, James · WBS: [WBS-09](../work-breakdown-structure.md) · Next step: [static mockup (S1-12)](../mockups/README.md)

## Contents

| ID   | Screen                                               | Roles           | File                                       |
| :--- | :--------------------------------------------------- | :-------------- | :----------------------------------------- |
| W-00 | App shell, navigation, and global states             | All             | This page                                  |
| W-01 | Sign-in / registration                               | Signed out      | [sign-in.md](sign-in.md)                   |
| W-02 | Employee chat (ask, cited answer, clarify, escalate) | Employee        | [employee-chat.md](employee-chat.md)       |
| W-03 | New ticket form                                      | Employee        | [employee-tickets.md](employee-tickets.md) |
| W-04 | My tickets list and ticket status detail             | Employee        | [employee-tickets.md](employee-tickets.md) |
| W-05 | Agent ticket list and admin ticket queue             | Agent, admin    | [agent-admin.md](agent-admin.md)           |
| W-06 | Ticket detail, assignment, replies, and drafts       | Agent, admin    | [agent-admin.md](agent-admin.md)           |
| W-07 | Admin knowledge base and solution review             | Admin           | [agent-admin.md](agent-admin.md)           |
| W-08 | Role-scoped dashboard                                | All             | [agent-admin.md](agent-admin.md)           |
| —    | Archive, settings, and user administration           | Employee, admin | Implemented screens; see root README       |

## User journeys covered

These follow the first-demo journeys in the [WBS (WBS-08)](../work-breakdown-structure.md) and the [testing matrix](../testing-matrix.md).

| Journey                                         | Screens             | Matrix cases        |
| :---------------------------------------------- | :------------------ | :------------------ |
| J1. Employee asks a question, gets cited answer | W-01 → W-02         | CI-01–CI-03, E2E-01 |
| J2. Unresolved question becomes a ticket        | W-02 → W-03 → W-04  | CI-04, E2E-02       |
| J3. Employee asks for a human agent             | W-02 → W-04 → W-06  | E2E-04              |
| J4. Agent works and resolves a queued ticket    | W-05 → W-06         | E2E-03              |
| J5. Admin maintains knowledge and checks usage  | W-07, W-08          | n/a (admin views)   |
| J6. Role misuse is rejected                     | Any → access denied | SI-05, E2E-05       |

## W-00 App shell

The shell is shared across roles; navigation changes with the trusted profile returned by `GET /api/me`. The role never comes from user-editable Supabase metadata.

```text
Desktop (>= 1024px)
+----------------------------------------------------------------------+
| [Harbor Tickets]                           Dana Cruz (Employee) [v]  |
+-------------+--------------------------------------------------------+
| > Ask IT    |                                                        |
|   My tickets|                 <active screen>                        |
|   New ticket|                                                        |
|             |                                                        |
| ----------- |                                                        |
| (agent)     |                                                        |
|   Queue     |                                                        |
| (admin)     |                                                        |
|   Knowledge |                                                        |
|   Metrics   |                                                        |
+-------------+--------------------------------------------------------+

Mobile (< 768px)
+--------------------------------+
| [=]  Harbor Tickets    [DC]    |   [=] opens the nav as a drawer
+--------------------------------+
|                                |
|        <active screen>         |
|                                |
+--------------------------------+
```

| Element      | Behavior                                                                                                       |
| :----------- | :------------------------------------------------------------------------------------------------------------- |
| Brand        | Displays Harbor Tickets. Role-aware navigation exposes only the routes intended for the current role.          |
| Navigation   | Items are rendered only for allowed roles. Hidden items are not a security control; the API still checks role. |
| Account menu | Shows display name and role; contains Sign out.                                                                |
| Skip link    | First focusable element: "Skip to main content".                                                               |

### Global states

| State             | Trigger                                  | Display                                                                                       |
| :---------------- | :--------------------------------------- | :-------------------------------------------------------------------------------------------- |
| Signed out        | No Supabase session                      | Redirect to W-01; remember the requested route.                                               |
| Session expired   | API returns 401                          | Inline banner "Your session expired. Sign in again." with a button; unsent chat text is kept. |
| Access denied     | API returns 403 or route not allowed     | Full-panel message "You do not have access to this page." and a link to the role's home.      |
| Service waking up | Request exceeds ~5 s (Render cold start) | "The helpdesk service is starting. This can take up to a minute." with a spinner.             |
| Network/API error | 5xx or network failure                   | Inline error with Retry; never shows a success message for the failed action.                 |
| Not found         | Unknown route or ticket ID               | "We couldn't find that page or ticket."                                                       |

## Responsive behavior

| Breakpoint     | Layout                                                                                                  |
| :------------- | :------------------------------------------------------------------------------------------------------ |
| `< 768px`      | Single column. Nav becomes a drawer. Tables become stacked cards. Chat composer is pinned to bottom.    |
| `768px–1023px` | Persistent sidebar. Agent ticket detail opens as its own page with a Back link instead of a side panel. |
| `>= 1024px`    | Persistent sidebar. Agent queue shows list and detail side by side.                                     |

Minimum supported width is 320px. Text uses relative units so it can be zoomed to 200% without horizontal scrolling.

## Accessibility notes (apply to every screen)

- Semantic landmarks: `header`, `nav`, `main`; one `h1` per screen.
- All controls are reachable and operable by keyboard in visual order; focus is always visible.
- On route change, focus moves to the screen heading.
- New assistant messages are announced through an `aria-live="polite"` region; errors use `role="alert"`.
- Form fields have visible labels; validation messages are linked with `aria-describedby` and summarised at the top of the form.
- Status is never conveyed by color alone: status badges include text (for example, "Open", "Escalated").
- Color contrast meets WCAG 2.1 AA (4.5:1 for body text).
- Source citations are real links or buttons with descriptive text, not "click here".

## Data and API conventions

- All data shown in wireframes and mockups is fictional.
- Ticket status values proposed for the UI: `open`, `in_progress`, `resolved`, `closed`.
- Ticket priority values: `low`, `medium`, `high` (from the [allowlisted action contract](../api-specifications/allowlisted-actions.md)).
- Ticket categories proposed for the UI: `account_access`, `hardware`, `network`, `software`, `other`. The approved list is still open in the action contract.
- Escalation reasons: `low_confidence`, `policy_gap`, `user_requested_agent`.

The standalone account settings, archive, and user administration pages were added after these initial wireframes. See the app routes and integration tests for their current behavior.

---

[Back to Sprint 1 tasks](../../sprints/sprint-1/tasks.md) · [Static mockup](../mockups/index.html)
