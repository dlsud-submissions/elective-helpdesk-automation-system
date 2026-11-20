# James Saluta: S4-06 Accessibility and Responsive Regression Evidence

> **Recorded:** November 18, 2026.
> **Screens reviewed:** sign-in, chat (composer, messages, citations, ticket and escalation forms), My tickets, ticket queue and detail, dashboard, and the denied, error, loading and empty states.
> **Viewports:** desktop 1280 px, Pixel 7 (412 px) and 320 px minimum width (`body { min-width: 320px }`).
> **Method:** a code and CSS review of every `.tsx` file and `styles.css`, calculated colour contrast, and automated regression tests. No screen-reader session with real assistive technology was run.

## Already compliant (kept)

- **Page basics:** `lang="en"`, a zoomable viewport, a skip link to `#main`, a labelled main nav, and `aria-current` on the active link.
- **Focus and motion:** a global `:focus-visible` ring (4.0–4.7:1) with no `outline: none`; the spinner respects `prefers-reduced-motion`.
- **Sign-in:** labelled fields, `aria-invalid` and `aria-describedby` on errors, and focus moved to the first invalid field or to the auth alert.
- **Status shown as text:** status, escalation and uncertainty badges always carry words, never colour alone.
- **Dashboard tables:** captions and `th scope`.
- **Text contrast:** all body text passes 4.5:1. Muted text is 6.1:1 on the background; primary links are 6.0:1.

## Defects found and fixed

| Severity | Defect                                                                                                                                  | Fix                                                                                                                           | Regression check                                                       |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| High     | Every tab title was "Helpdesk API Check".                                                                                               | `useDocumentTitle` sets a unique title per screen ("Chat · IT Helpdesk", …).                                                  | `accessibility.integration.test.tsx`; `e2e/accessibility.spec.ts`      |
| High     | Focus stayed on the nav link after navigation, so screen-reader users got no context.                                                   | `AppShell` focuses the new page's `h1` when the section changes.                                                              | same                                                                   |
| High     | The composer textarea and Send button were `disabled` while sending, which dropped keyboard focus to `<body>`.                          | The field is never disabled; Send uses `aria-disabled`; focus returns to the field.                                           | `accessibility…` and `chat.integration.test.tsx`                       |
| High     | On mobile, opening a ticket hid the focused row and focus was lost.                                                                     | Ticket heading is focused after each load; Back returns focus to the row; the arrow is `aria-hidden`.                         | `e2e/accessibility.spec.ts`                                            |
| High     | Form-control borders were 1.38:1 (WCAG 1.4.11 needs 3:1).                                                                               | `--color-input-border: #6b7a76` (about 4.5:1 on white, 4.2:1 on the background).                                              | Calculated                                                             |
| High     | Long URLs and unbroken strings overflowed at 320 px; `1fr` grid columns could not shrink.                                               | `overflow-wrap: anywhere` on message, source, ticket and alert text; `minmax(0, 1fr)` columns; `min-width: 0` on flex inputs. | `e2e/accessibility.spec.ts` (no horizontal scroll, desktop and mobile) |
| Medium   | The chat sidebar appeared below the chat on mobile but came first in tab order (WCAG 1.3.2/2.4.3).                                      | Sidebar moved after the chat in the DOM; CSS grid areas keep it on the left on wide screens.                                  | `accessibility.integration.test.tsx`                                   |
| Medium   | The chat log was a polite live region, so loading history read every message aloud, and the typing status was nested inside it.         | Log has `aria-live="off"`; one persistent status region announces "Checking…" and "Assistant replied with N sources."         | same                                                                   |
| Medium   | Ticket, escalation and dashboard errors were not linked to their fields.                                                                | `aria-invalid`, `aria-describedby` and focus on the first invalid field.                                                      | `escalation-tickets…`, `accessibility…`                                |
| Medium   | Opening the ticket form, cancelling it or succeeding lost focus.                                                                        | Focus goes to the form heading on open, the composer on cancel, and the confirmation on success.                              | `escalation-tickets.integration.test.tsx`                              |
| Medium   | The secret warning did not take focus, and "Edit message" removed the focused button.                                                   | Warning is focused; Edit returns focus to the field.                                                                          | `accessibility.integration.test.tsx`                                   |
| Medium   | Ticket Save was disabled after saving, which lost focus; "Reload ticket" also lost focus.                                               | `aria-disabled`; the heading is focused after a reload.                                                                       | Code review                                                            |
| Medium   | Queue filter changes updated the list silently.                                                                                         | A status region announces "N tickets shown."                                                                                  | `accessibility.integration.test.tsx`                                   |
| Medium   | Pending-message meta text was 3.26:1 because of `opacity: .75`.                                                                         | A dashed border plus the "sending" / "not sent" text replaces the opacity.                                                    | Calculated                                                             |
| Low      | Source `<summary>` had an `aria-label` that replaced its visible text (WCAG 2.5.3).                                                     | Removed; the visible marker, title and source are the accessible name.                                                        | `accessibility.integration.test.tsx`                                   |
| Low      | Show/Hide password announced "Hide password, pressed".                                                                                  | `aria-pressed` removed; the label carries the state.                                                                          | Code review                                                            |
| Low      | Heading levels skipped (`h1` to `h3`); `DeniedState` added a second `h1` inside panels; loading screens had no `h1`.                    | Forms use `h2`; a hidden "Messages" `h2`; `DeniedState headingLevel`; hidden `h1` on session screens.                         | Code review                                                            |
| Low      | Over-limit message length was shown only in red; the selected ticket row and badges vanished in forced-colours mode.                    | Text "Too long: remove N characters."; a `forced-colors` outline and badge borders.                                           | Code review                                                            |
| Low      | Conversation titles were truncated with no way to read the full text; `.visually-hidden` was incomplete; layout used `100vh` on mobile. | `title` attribute, full clip pattern, `100dvh` fallback, and `scroll-padding-bottom` under the sticky composer.               | Code review                                                            |

## Accepted limitations (not release blockers)

- **No real screen-reader run.** The checks are automated (jsdom and Testing Library) and opt-in Playwright specs. An NVDA or VoiceOver pass on the critical journeys is recommended during S4-07.
- **No automated axe scan.** Neither `axe-core` nor `@axe-core/playwright` is installed. Adding an axe check to the E2E suite is a Sprint 5 follow-up.
- **No `h1` in mobile ticket detail.** The queue `h1` is hidden there. Focus moves to the ticket heading (`h2`), which is announced.
- **Citation markers are plain text.** The `[n]` markers in answers are not linked to their sources; the numbered source list sits directly below the answer.
- **No accessibility lint rules.** `eslint-plugin-jsx-a11y` is not configured.
- **E2E not run on this machine.** It has no Docker or local Supabase and no Playwright browsers. `tests/e2e/accessibility.spec.ts` must be run by S4-07 against the seeded stack in both Playwright projects.

## Verification

- `npm test`: client 65 tests (including 8 accessibility regressions and 7 escalation and My tickets tests); server 117 tests. All passed.
- `npm run typecheck`, `npm run lint`: passed.
