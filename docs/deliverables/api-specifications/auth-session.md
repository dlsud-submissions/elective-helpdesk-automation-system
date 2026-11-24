# Auth and Profile Contract

> Status: Current API surface; Supabase Auth handles browser sign-in and session lifecycle.

## Browser authentication

The client uses Supabase Auth for sign-in, sign-up, session restoration, and sign-out. It sends the access token to protected Express endpoints. The server verifies the token and reads the authoritative role and account state from `public.profiles`; client metadata and route guards do not grant permissions.

## Express endpoints

| Method and path                         | Access        | Behavior                                                                                          |
| :-------------------------------------- | :------------ | :------------------------------------------------------------------------------------------------ |
| `GET /api/me`                           | Authenticated | Returns the current user's trusted profile, role, account status, suspension end, and ban reason. |
| `PATCH /api/me/profile`                 | Authenticated | Updates the caller's display name. The server accepts 1–120 trimmed characters.                   |
| `GET /api/admin/users`                  | Admin         | Lists profile and auth-account details.                                                           |
| `POST /api/admin/users`                 | Admin         | Creates an agent or admin account.                                                                |
| `PATCH /api/admin/users/:userId/status` | Admin         | Suspends, bans, or restores another account; an admin cannot change their own status.             |
| `GET /api/agents`                       | Admin         | Lists agent profiles for assignment controls.                                                     |

Supabase Auth account administration and service-role operations remain server-side. The API rejects unauthenticated callers and applies role checks independently of the visible UI.
