# Login, Session, and User Authentication Specs

## Overview

Ledgrr is a multi-user personal finance tracker where each user owns their own Google Sheet as the data store. Authentication serves two purposes:

1. **Identity** — who is this user (handled by Supabase Auth)
2. **Sheet access** — permission to read/write the user's Google Sheet on their behalf (handled by Google OAuth + server-side token management)

These are deliberately kept separate. Supabase Auth handles identity. Google OAuth handles Sheets access. The browser never holds a Google credential at any point.

---

## Actors and Boundaries

| Actor | What it holds | What it never holds |
|---|---|---|
| Browser (React) | Supabase JWT (in memory via supabase-js) | Google access token, Google refresh token |
| Edge Functions | Google access token (in memory, per-invocation only) | Nothing persisted |
| Supabase DB | Google refresh token secret ID (a UUID pointer to Vault) | Google tokens in plain text |
| Supabase Vault | Google refresh token (AES-256 encrypted) | — |

---

## Authentication Flow

### First-time Login

```
1. User clicks "Sign in with Google"

2. supabase.auth.signInWithOAuth({
     provider: 'google',
     scopes: 'https://www.googleapis.com/auth/spreadsheets',
     queryParams: { access_type: 'offline', prompt: 'consent' }
   })
   → Redirects to Google consent screen
   → User grants: identity (openid, email, profile) + Sheets read/write

3. Google redirects to: https://<supabase-project>.supabase.co/auth/v1/callback
   → Supabase exchanges the code, creates a session
   → Redirects to: <app-origin>/auth/callback
     with session data including provider_refresh_token

4. AuthCallbackPage (React) calls POST /functions/v1/auth/store-tokens
   Body: { provider_refresh_token }  (only this, extracted from session)
   Auth: Supabase JWT

5. store-tokens Edge Function:
   a. Verifies Supabase JWT → resolves user_id
   b. Encrypts refresh_token via Supabase Vault
      → vault.create_secret(refresh_token) → returns secret_id (UUID)
   c. Creates a new Google Spreadsheet via Sheets API
      (access_token obtained by exchanging the refresh_token — in memory only)
   d. Stores in user_sheets:
        user_id, sheet_id, sheet_name, refresh_token_secret_id
   e. Returns: { sheet_id, sheet_url }
      (no Google tokens returned to browser)

6. React stores sheet_id in app state, redirects to /dashboard
```

### Returning User Login

```
1. User clicks "Sign in with Google"
   → Same OAuth flow, but Google may not re-issue a refresh_token
     if the user already consented (prompt=consent forces re-issue)

2. AuthCallbackPage calls POST /functions/v1/auth/store-tokens
   → Edge Function checks: does user_sheets row already exist?
   → If yes: update refresh_token_secret_id (rotate the secret in Vault)
   → If no: treat as first-time login

3. Redirect to /dashboard
```

### Session Restoration (Page Reload)

```
1. supabase-js auto-restores the Supabase session from memory/storage
2. App calls GET /functions/v1/user/sheet-info with Supabase JWT
3. Edge Function returns: { sheet_id, sheet_name }
   (no Google tokens involved)
4. App is ready — all Sheets calls go through Edge Functions on demand
```

---

## Session Model

### Supabase Session (Identity)

- Managed entirely by `supabase-js`
- Stored in memory (default) — gone on tab close
- JWT expiry: 1 hour, auto-refreshed by supabase-js using its own refresh token
- The browser uses this JWT as the sole credential to authenticate to Ledgrr's Edge Functions
- Edge Functions verify this JWT using `supabase.auth.getUser()` with the anon key

### Google Session (Sheets Access)

- No client-side session — the browser has no Google credential at any time
- Each Edge Function invocation that needs Sheets access:
  1. Reads `refresh_token_secret_id` from `user_sheets`
  2. Decrypts the refresh token from Vault
  3. Exchanges it with Google for a fresh access token (in memory)
  4. Uses the access token to call the Sheets API
  5. Discards the access token — it is never stored, never returned
- Access token lifetime: 1 hour (irrelevant since it's never persisted)
- Refresh token lifetime: until revoked or ~6 months of inactivity

---

## Token Security Model

### What the browser can access

```
✓ Supabase JWT                — authenticates user to Ledgrr
✓ sheet_id                    — the spreadsheet ID (not sensitive)
✓ sheet data (rows/values)    — returned by Edge Functions
✗ Google access token         — never sent to browser
✗ Google refresh token        — never sent to browser
✗ Vault secret ID             — never sent to browser
```

### Threat model

| Threat | Impact | Mitigation |
|---|---|---|
| XSS steals React state | Attacker gets Supabase JWT only — 1hr TTL, no Google access | Short-lived JWT, no Google tokens in state |
| Supabase DB compromised | Attacker gets `refresh_token_secret_id` (UUID) — useless without Vault key | Vault encryption key not in DB |
| Supabase Vault compromised | Attacker gets encrypted refresh tokens — needs Vault master key too | Vault key managed by Supabase infrastructure |
| Man-in-the-middle | Intercepts Supabase JWT | HTTPS only, JWT is short-lived |
| Refresh token leaked | Full Sheets access until revoked | User can revoke at myaccount.google.com |

---

## Database Schema

```sql
-- Stores per-user Google Sheet connection and token reference
create table public.user_sheets (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  sheet_id                text not null,
  sheet_name              text,
  refresh_token_secret_id uuid not null,   -- points to vault.secrets row
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id)
);

-- RLS: users can only access their own row
alter table public.user_sheets enable row level security;

create policy "select own row" on public.user_sheets
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own row" on public.user_sheets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own row" on public.user_sheets
  for update to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own row" on public.user_sheets
  for delete to authenticated
  using ((select auth.uid()) = user_id);
```

**Not stored in DB:**
- `access_token` — never persisted anywhere
- `token_expiry` — not needed, access token is fetched fresh per request
- `refresh_token` — stored only in Vault, referenced by UUID

---

## Edge Functions

### `POST /functions/v1/auth/store-tokens`

Called once after login by `AuthCallbackPage`.

```
Input:  { provider_refresh_token: string }  (from Supabase session, browser-side only briefly)
Auth:   Supabase JWT (Bearer)

Steps:
  1. Verify JWT → get user_id
  2. Encrypt refresh_token via vault.create_secret()
  3. Exchange refresh_token for access_token (in memory)
  4. Create Google Spreadsheet via Sheets API
  5. Upsert user_sheets row
  6. Discard access_token

Output: { sheet_id: string, sheet_url: string }
```

### `GET /functions/v1/sheets/read?range=Sheet1!A1:Z100`

```
Input:  range (query param)
Auth:   Supabase JWT (Bearer)

Steps:
  1. Verify JWT → get user_id
  2. Fetch refresh_token_secret_id from user_sheets
  3. Decrypt refresh_token from Vault
  4. Exchange for access_token (in memory)
  5. Call GET sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}
  6. Discard access_token

Output: { values: string[][], range: string, sheet_id: string }
```

### `POST /functions/v1/sheets/write`

```
Input:  { range: string, values: string[][] }
Auth:   Supabase JWT (Bearer)

Steps:  Same as sheets/read, but calls PUT on Sheets API

Output: { success: true, updatedRows: number, updatedCells: number }
```

### `GET /functions/v1/user/sheet-info`

Lightweight — returns sheet metadata for app init, no Sheets API call needed.

```
Input:  none
Auth:   Supabase JWT (Bearer)

Steps:
  1. Verify JWT → get user_id
  2. Fetch sheet_id, sheet_name from user_sheets

Output: { sheet_id: string, sheet_name: string }
```

---

## GCP OAuth Configuration

**Required scopes (one consent, covers both identity and Sheets):**
```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/spreadsheets
```

`spreadsheets` is the minimal scope for both read and write. No Drive scope needed — the Sheets API can create spreadsheets without it.

**Authorized redirect URIs:**
```
https://<supabase-project>.supabase.co/auth/v1/callback   ← Supabase handles code exchange
```

**Token settings:**
- `access_type: offline` — required to receive a refresh_token
- `prompt: consent` — forces Google to re-issue refresh_token on every login (ensures tokens stay fresh)

---

## React App State

```typescript
// What React holds — nothing sensitive
interface AppState {
  supabaseSession: Session | null   // managed by supabase-js
  user: User | null                 // from Supabase session
  sheetId: string | null            // from /user/sheet-info on mount
  sheetName: string | null
  // sheet data, UI state, etc.
}

// What React never holds
// ✗ access_token
// ✗ refresh_token
// ✗ refresh_token_secret_id
```

---

## Auth Pages and Routing

| Route | Purpose | Auth required |
|---|---|---|
| `/` | Redirect based on session state | No |
| `/auth/callback` | Handles Supabase redirect, calls store-tokens, redirects | No (mid-auth) |
| `/dashboard` | Main app | Yes |

The `/connect` page from the spike is **removed** — sheet creation is automatic on first login, users never manually connect a sheet.

---

## Disconnect / Revocation

When a user wants to disconnect their Google account:

1. User triggers "Disconnect Google Sheets" in settings
2. Frontend calls `DELETE /functions/v1/user/sheet`
3. Edge Function:
   - Calls `https://oauth2.googleapis.com/revoke?token=<refresh_token>` — revokes at Google
   - Deletes the Vault secret
   - Deletes the `user_sheets` row
4. User's Ledgrr data is gone, Google access is revoked

The user's Supabase auth account remains — they can reconnect a new sheet by signing in again.

---

## What Was Proven in the Spike

The spike (`Ledgrr-Fulll` current codebase) proved:

- ✓ Single Google OAuth consent covers both login and Sheets access
- ✓ `provider_refresh_token` is available in the Supabase session after login
- ✓ Refresh tokens can be exchanged server-side for access tokens
- ✓ Sheets API read works with a valid access token
- ✓ Sheets API write works with a valid access token
- ✓ Sheets API create works — new spreadsheet created in user's Drive
- ✓ Multi-user isolation works via RLS on `user_sheets`
- ✓ Token refresh flow works when access token expires

**What the spike did not implement (to be built in real app):**
- Supabase Vault encryption for refresh tokens
- Server-side only token handling (spike briefly exposes `provider_refresh_token` in browser)
- Revocation / disconnect flow
- Error recovery if sheet creation fails mid-login
