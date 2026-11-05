# Auth Session Contract

> Status: Sprint 3 contract baseline for role-aware chat and dashboard work.

## Purpose

This contract defines the expected employee/admin session flow in the Express API and the browser client. The frontend authenticates through Supabase Auth, while the backend checks the session token and loads the profile/role record from the application database before allowing access to protected routes.

## Endpoints

### 1. `GET /api/auth/session`

Returns the current session state for the authenticated user.

#### Success response: `200 OK`

```json
{
  "authenticated": true,
  "user": {
    "id": "8f5b1a7e-6b0b-4d94-8d76-5f8dd62f8822",
    "email": "employee@example.com",
    "role": "employee",
    "displayName": "Sam Employee"
  },
  "expiresAt": "2026-11-03T18:00:00.000Z"
}
```

#### Signed-out response: `200 OK`

```json
{
  "authenticated": false,
  "user": null
}
```

#### Errors

- `401 Unauthorized` — invalid or expired session token
- `500 Internal Server Error` — unexpected auth/profile lookup failure

### 2. `POST /api/auth/sign-out`

Ends the current authenticated session.

#### Success response: `200 OK`

```json
{
  "success": true,
  "message": "Signed out successfully."
}
```

#### Errors

- `401 Unauthorized` — no active session to revoke
- `500 Internal Server Error` — sign-out failed at the provider boundary

## Authorization rules

- The frontend may send the session token via an HTTP cookie or Authorization header, as defined by the server contract.
- The backend must validate the session and refresh role data from the trusted `profiles` table.
- Client-side route guards are not the authorization boundary; the API remains authoritative.
- Employees may not access agent or admin routes through direct navigation or direct API requests.

## Security requirements

- No browser bundle may include a privileged Supabase service-role key.
- The backend must never trust user-supplied role data from the client.
- `auth.users` remains managed by Supabase Auth; the server reads role and profile metadata from the application profile records only.
