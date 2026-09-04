# Login Flow

Comprehensive reference for how authentication works in Ledgrr — what happens at each step, which tokens are in play, and how every login scenario is handled.

---

## Overview

Ledgrr uses two separate authentication systems that work together:

| System | Purpose | Managed by |
|---|---|---|
| **Supabase Auth** | Identifies the user to the app | `supabase-js` (automatic) |
| **Google OAuth** | Grants access to the user's Google Sheet | App code + Edge Function |

These are not the same thing. Signing into Supabase does not give the app Google Sheets access — both must be granted in the same OAuth consent.

---

## Tokens Reference

| Token | Issued by | Lifetime | Stored where | Visible in browser? |
|---|---|---|---|---|
| Supabase JWT (`access_token`) | Supabase Auth | 1 hour | `localStorage` (supabase-js) | Yes — in localStorage |
| Supabase refresh token | Supabase Auth | Long-lived | `localStorage` (supabase-js) | Yes — in localStorage |
| Google access token (`provider_token`) | Google OAuth | 1 hour | Browser memory only (session object) | Briefly after login |
| Google refresh token (`provider_refresh_token`) | Google OAuth | Until revoked | Supabase Vault (encrypted) | Briefly in network payload |
| Vault secret ID (`refresh_token_secret_id`) | Supabase Vault | Permanent | `user_sheets` table | No |

---

## Routes

| Path | Access | What renders |
|---|---|---|
| `/login` | Public | `LoginPage` |
| `/dashboard` | Protected | `DashboardPage` (redirects to `/login` if no session) |
| `/` | Any | Redirects to `/dashboard` if session, `/login` if not |

There is no `/auth/callback` route. Supabase redirects directly to `/dashboard` after Google consent.

---

## First-Time Login Flow

A new user who has never signed in before.

```
1. User visits /login
   → LoginPage renders
   → Full-screen spinner while session state resolves (AuthProvider on mount)
   → No session found → Google sign-in button displayed

2. User clicks the Google sign-in button
   → signInWithGoogle() called in AuthContext
   → supabase.auth.signInWithOAuth({
       provider: 'google',
       redirectTo: '<origin>/dashboard',
       scopes: 'https://www.googleapis.com/auth/spreadsheets',
       queryParams: { access_type: 'offline', prompt: 'consent' }
     })
   → Browser redirected to Google consent screen

3. Google consent screen
   → User sees: "Ledgrr wants to access your Google Account"
   → Scopes shown: identity (email, profile) + Google Sheets
   → User clicks "Allow"

4. Google → Supabase Auth callback
   → Google redirects to:
     https://<supabase-project>.supabase.co/auth/v1/callback?code=AUTH_CODE
   → Supabase Auth performs PKCE exchange server-side:
       sends: code + code_verifier + client_secret → Google
       receives: Google access_token + refresh_token + Supabase session
   → Supabase stores provider tokens in the session
   → Supabase redirects browser to: <origin>/dashboard

5. Browser lands on /dashboard
   → supabase-js initialises (createClient runs)
   → Detects ?code= or session fragment in URL
   → Completes session internally
   → Fires onAuthStateChange('SIGNED_IN', session)
   → AuthContext sets session state
   → loading = false
   → Router renders DashboardPage

6. Background token storage (App.tsx useEffect)
   → session.provider_refresh_token is present ← only available now
   → POST /functions/v1/auth-store-tokens
       headers: { Authorization: Bearer <supabase_jwt> }
       body: { provider_refresh_token }

7. Edge Function: auth-store-tokens
   → Verifies Supabase JWT → resolves user_id
   → Calls public.create_vault_secret(provider_refresh_token)
       → encrypted in Supabase Vault (AES-256)
       → returns secret_id (UUID)
   → Inserts user_sheets row:
       { user_id, sheet_id: '', refresh_token_secret_id: secret_id }
   → Returns { success: true }
   → Google refresh token discarded from memory

8. User is on /dashboard
   → Empty dashboard placeholder displayed
   → Supabase session active
   → Google refresh token safely in Vault
   → Google access token in browser memory (session.provider_token) — will be gone on next session refresh
```

---

## Returning User Login Flow

A user who has signed in before and has an existing `user_sheets` row.

```
1. User visits /login (or any route)
   → AuthProvider mounts → getSession() called
   → supabase-js restores session from localStorage
   → Session found → loading = false
   → Router redirects to /dashboard immediately
   → LoginPage never shown

   OR if session expired:

2. Session has expired (Supabase JWT > 1 hour old)
   → supabase-js auto-refreshes using Supabase refresh token
   → New Supabase JWT issued
   → provider_refresh_token is NOT in the refreshed session (only available at first login)
   → No auth-store-tokens call (no provider_refresh_token present)
   → User continues to /dashboard normally

   OR if session gone (localStorage cleared, different device):

3. No session in localStorage
   → Same as first-time login flow
   → Google consent screen shown (prompt=consent forces new refresh token issuance)
   → auth-store-tokens rotates the existing Vault secret with new refresh token
```

---

## Returning User — Token Rotation

When a returning user goes through the full login flow again (e.g. on a new device or after clearing storage), the `auth-store-tokens` Edge Function handles rotating the Vault secret:

```
auth-store-tokens receives provider_refresh_token for user with existing row
  → Checks user_sheets: row exists AND refresh_token_secret_id is set
  → Calls public.update_vault_secret(existing_secret_id, new_refresh_token)
      → Vault updates the encrypted value in place
      → secret_id UUID remains the same
  → Returns { success: true }
  → Old refresh token overwritten — only new token is stored
```

---

## Sign Out Flow

```
1. User clicks "Sign out" on dashboard
   → signOut() called in AuthContext
   → supabase.auth.signOut()
       → Supabase session invalidated
       → localStorage cleared (supabase-js removes session tokens)
       → onAuthStateChange('SIGNED_OUT', null) fired
       → AuthContext sets session = null

2. Router re-evaluates
   → session is null → loading is false
   → path is /dashboard → redirects to /login
   → LoginPage displayed

Note: Google refresh token remains in Vault. It is NOT revoked on sign out.
      Revoking requires an explicit disconnect flow (future spec).
```

---

## Session Restoration on Page Reload

```
1. User refreshes browser on /dashboard
   → AuthProvider mounts → getSession() called
   → supabase-js reads session from localStorage
   → If valid: session restored → Dashboard rendered
   → If expired: supabase-js uses Supabase refresh token → new JWT issued → session restored
   → If no session: redirect to /login

Note: provider_refresh_token is NOT available in a restored session.
      It is only present immediately after Google OAuth consent.
      The Google refresh token is safely in Vault and only used by Edge Functions.
```

---

## PKCE Flow (How the Code Exchange Works)

Ledgrr uses PKCE (Proof Key for Code Exchange) — the recommended OAuth 2.0 flow for browser apps. `flowType: 'pkce'` is set explicitly on the Supabase client.

```
Before redirect to Google:
  supabase-js generates:
    code_verifier  → random string, kept in memory/sessionStorage
    code_challenge → SHA-256(code_verifier), sent to Google

During OAuth:
  Google stores code_challenge with the auth code

On callback:
  Supabase Auth sends:
    code + code_verifier → Google token endpoint
  Google verifies:
    SHA-256(code_verifier) === stored code_challenge ✓
  Google returns tokens to Supabase (server-side)

Why this is safe:
  Even if someone intercepts the ?code= in the URL,
  they cannot exchange it without the code_verifier
  which only the legitimate browser session holds.
```

---

## What the Browser Holds

At any point in time, the browser has access to:

```
✓ Supabase JWT (localStorage)              — authenticates user to Ledgrr
✓ Supabase refresh token (localStorage)   — renews Supabase JWT (managed by supabase-js)
✓ Google access token (memory, briefly)   — in session.provider_token after login only
✗ Google refresh token                    — never in browser after auth-store-tokens completes
✗ Vault secret ID                         — never sent to browser
```

---

## What Lives in the Database

```
user_sheets table:
  user_id                  → links to auth.users
  sheet_id                 → Google Spreadsheet ID (empty until sheet creation spec)
  sheet_name               → display name
  refresh_token_secret_id  → UUID pointing to vault.secrets (encrypted refresh token)

vault.secrets (Supabase Vault):
  Encrypted Google refresh token — accessible only via service_role
  Decrypted only inside Edge Functions — never returned to browser
```

---

## Error Scenarios

### User denies Google consent

```
Google redirects to /dashboard with #error=access_denied in URL fragment
→ supabase-js detects the error
→ onAuthStateChange fires with null session
→ Router redirects to /login
→ Currently: no explicit error message shown to user (future improvement)
```

### auth-store-tokens fails (VAULT_ERROR)

```
Edge Function cannot write to Vault
→ Returns { error, code: 'VAULT_ERROR' }
→ App.tsx catch block: console.error (non-fatal)
→ User reaches /dashboard but Google refresh token is not stored
→ Sheets API calls will fail until user signs out and back in
→ Currently: silent failure (future improvement: show reconnect prompt)
```

### auth-store-tokens fails (DB_ERROR)

```
Vault write succeeded but user_sheets insert failed
→ Vault secret is orphaned (no row points to it)
→ User reaches /dashboard but has no user_sheets row
→ Currently: silent failure (future improvement: retry or cleanup)
```

### Session expired mid-session

```
Supabase JWT expires (1 hour)
→ supabase-js auto-refreshes using Supabase refresh token
→ New JWT issued transparently
→ No action required from user
→ provider_refresh_token is NOT in the refreshed session (expected)
→ No re-trigger of auth-store-tokens
```

### Different device / cleared storage

```
User opens app on new device
→ No localStorage session
→ Full login flow from step 1
→ prompt=consent forces Google to issue a new refresh token
→ auth-store-tokens rotates Vault secret with new token
```

---

## Key Design Decisions

**No `/auth/callback` page**
`redirectTo` points directly to `/dashboard`. `supabase-js` handles the PKCE session exchange automatically on page load. The dashboard URL is clean from the user's perspective.

**Background token storage**
`auth-store-tokens` is called in a `useEffect` in `App.tsx` after `session` is set. This is fire-and-forget (`catch` only logs). The user sees the dashboard immediately without waiting for Vault storage to complete.

**`prompt: consent` on every login**
Forces Google to re-issue a refresh token on every login, even for returning users. Without this, Google only issues a refresh token on the first consent and subsequent logins would not include `provider_refresh_token` in the session.

**`access_type: offline`**
Required to receive a `provider_refresh_token` from Google at all. Without this, only a short-lived `provider_token` (access token) is returned.

**Vault over plain text**
Google refresh tokens grant long-term access to a user's Google Sheets. Storing them plain text in the DB would mean a DB compromise exposes all users' sheets. Vault encrypts at rest using AES-256 — a DB compromise only yields UUIDs.

**`storedTokens` ref prevents double-call**
`useRef(false)` in `App.tsx` ensures `auth-store-tokens` is called at most once per app lifecycle, even if `session` changes multiple times (e.g. token refresh).

---

## Files Involved

| File | Role |
|---|---|
| `src/lib/supabase.ts` | Supabase client, `flowType: 'pkce'` configured |
| `src/context/AuthContext.tsx` | Session state, `signInWithGoogle`, `signOut` |
| `src/App.tsx` | Router, auth gate, background `auth-store-tokens` call |
| `src/pages/LoginPage.tsx` | Login UI |
| `src/pages/DashboardPage.tsx` | Protected page (empty shell) |
| `supabase/functions/auth-store-tokens/index.ts` | Vault encryption, user_sheets upsert |
| `supabase/migrations/20260903_migrate_user_sheets_to_vault.sql` | user_sheets schema |
| `supabase/migrations/20260903_add_vault_helper_functions.sql` | Vault RPC wrappers |
