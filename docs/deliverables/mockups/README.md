# Static UI Mockup (S1-12)

> Status: Sprint 1 design artifact. Plain HTML, CSS, and vanilla JavaScript with no framework, build step, or backend. It is separate from the React client in `client/` and is not application source.

Owner: Saluta, James · WBS: [WBS-09](../work-breakdown-structure.md) · Built from: [wireframes (S1-11)](../wireframes/README.md)

## Open the mockup

Open `docs/resources/mockups/index.html` directly in a browser (double-click it, or drag it into a browser window). No server or install step is needed.

Sign in with one of the fictional test accounts listed on the sign-in screen; any password is accepted:

| Role     | Account                   | Home screen   |
| :------- | :------------------------ | :------------ |
| Employee | `dana.cruz@example.test`  | Ask IT (chat) |
| Agent    | `alex.tan@example.test`   | Ticket queue  |
| Admin    | `mika.reyes@example.test` | Metrics       |

## What is simulated

Everything. A purple banner at the top of every screen says so, and confirmation messages carry a **Simulated** tag. Data lives in memory and resets on reload. Nothing is sent to a server, Supabase, or Gemini.

Open **Mockup controls** in the banner to:

- **View as** another role without signing out.
- Choose what the **next simulated API call** does: succeed, be slow (Render cold start), fail with a server error, or be denied (403). It resets to "Succeeds" after one call.
- **Show empty lists** to see empty states.

## Review script

| Wireframe | Try this                                                                                                     | States shown                                  |
| :-------- | :----------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| W-01      | Submit the sign-in form empty, then with an unknown email, then with a test account.                         | Validation, auth failure, loading, success    |
| W-02      | Ask "How do I connect to the office Wi-Fi?" and open a source.                                               | Loading, cited answer, source panel           |
| W-02      | Ask "My VPN keeps disconnecting", then answer "Windows laptop, error 809".                                   | Clarification, then cited answer              |
| W-02      | Ask "How do I reset my password?"                                                                            | Uncertain answer with ticket/person options   |
| W-02      | Type "my password is hunter2" and send.                                                                      | Secret warning; message not sent              |
| W-02      | Set the next call to "Fails", ask anything, then Retry.                                                      | Error with retry; no false success            |
| W-02      | Click "Talk to a person" twice.                                                                              | Escalation created, then duplicate prevented  |
| W-03      | Choose "No, create a ticket" after an answer; clear a field and submit.                                      | Prefill, error summary, submitting, created   |
| W-04      | Open My tickets, filter by status, open a ticket.                                                            | Loading skeleton, list, empty, status history |
| W-05/W-06 | As the agent, filter the queue, open TCK-2049, change status and assignee, save. Repeat with "Denied (403)". | Escalation summary, saved, permission denied  |
| W-07      | As the admin, edit an article or create one with an empty title.                                             | Validation, saving, indexing, saved           |
| W-08      | As the admin, open Metrics; toggle "Show empty lists".                                                       | Metric cards, text-backed bar tables, empty   |
| Any       | As the employee, open `#/queue` in the address bar.                                                          | Access denied                                 |

Resize the window below 768px to see the drawer navigation, stacked table cards, and single-panel agent queue. Every control is reachable with Tab, and focus moves to each screen's heading on navigation.

## Files

| File                     | Purpose                                                  |
| :----------------------- | :------------------------------------------------------- |
| [index.html](index.html) | App shell, simulation banner, navigation, source dialog  |
| [styles.css](styles.css) | Layout, components, responsive rules, focus styles       |
| [script.js](script.js)   | Fictional data, hash routing, views, simulated API calls |

---

[← Wireframes](../wireframes/README.md) · [Back to Sprint 1 tasks](../../sprints/sprint-1/tasks.md)
