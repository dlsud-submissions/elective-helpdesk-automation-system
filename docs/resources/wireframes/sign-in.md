# W-01 Sign-in

> Status: Low-fidelity wireframe for review. Endpoints are proposed, not implemented.

Roles: signed-out visitors · Journeys: J1–J6 · Matrix: CI-01

## Default (signed out)

```text
+--------------------------------------------------+
|                                                  |
|               [AI-HAS] IT Helpdesk               |
|                                                  |
|   Sign in to get IT help                         |
|                                                  |
|   Work email                                     |
|   [ dana.cruz@example.test                  ]    |
|                                                  |
|   Password                                       |
|   [ ••••••••••                         ] [Show]  |
|                                                  |
|   [            Sign in            ]              |
|                                                  |
|   Prototype only. Use the fictional test         |
|   accounts provided by the team.                 |
+--------------------------------------------------+
```

## States

| State            | Display                                                                                                 |
| :--------------- | :------------------------------------------------------------------------------------------------------ |
| Validation error | Field message under the input, for example "Enter your work email." Focus moves to the first error.     |
| Submitting       | Button shows "Signing in…" and is disabled; inputs stay editable after failure.                         |
| Auth failure     | `role="alert"` banner: "Email or password is incorrect." It does not reveal whether the account exists. |
| No profile       | Signed in but no `profiles` row: "Your account is not set up for the helpdesk yet. Contact IT."         |
| Success          | Redirect to the remembered route, or the role's home screen.                                            |

## Data and actions

| Action           | Interface (proposed)                                    | Data used                    |
| :--------------- | :------------------------------------------------------ | :--------------------------- |
| Sign in          | Supabase Auth client, `signInWithPassword` (no Express) | `email`, `password`          |
| Load own profile | `GET /api/me` with the Supabase access token            | `id`, `display_name`, `role` |
| Sign out         | Supabase Auth client, `signOut`                         | none                         |

Only the public Supabase URL and publishable key are used in the browser. No service-role key or Gemini key is ever involved in this screen.

## Responsive and accessibility

- Card is centered and capped at about 24rem; on mobile it fills the width with a 16px gutter.
- Inputs use `autocomplete="email"` and `autocomplete="current-password"`.
- The Show button toggles password visibility and updates its own label ("Show password" / "Hide password").

---

[← Wireframe index](README.md) · Next: [W-02 Employee chat](employee-chat.md)
