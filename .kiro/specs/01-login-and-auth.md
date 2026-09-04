# Spec 01 — Login and Authentication

## Goal

Implement the login page and authentication mechanism for Ledgrr. After this spec is complete, a user can:

1. Land on the login page
2. Sign in with Google (single consent: identity + Sheets access)
3. Be redirected to an empty dashboard placeholder

This is the foundation all other features depend on. No dashboard features are built here — just auth gate + empty shell.

---

## Reference Documents

- `.kiro/docs/login-session-and-user-authentication-specs.md` — full auth architecture, token security model, edge function specs

---

## Visual Design Reference

Replicate the Ledgrr-SPA login screen (`/Users/dwightsabado/Desktop/Dev/Ledgrr-SPA/src/components/LoginScreen.tsx`) with the following adaptations for the new stack:

**Layout:**
- Full-screen centered: `min-h-screen flex items-center justify-center`
- Background: `#000` (black — existing `html, body` rule in `index.css` covers this)
- Card: `max-w-sm w-full rounded-2xl p-8 flex flex-col items-center gap-6`
- Card background: `bg-gray-950` border `border border-gray-800`

**Card contents (top to bottom):**
1. `h1` — "Ledgrr" — `text-2xl font-bold tracking-tight text-white`
2. `p` — "Sign in to access your dashboard" — `text-sm text-gray-400`
3. Horizontal divider — `w-full h-px bg-gray-800`
4. Google sign-in button area:
   - While loading: `animate-spin` ring, `w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent`
   - Default: custom Google button (see below)
5. Error message: `text-sm text-red-400 text-center` with `role="alert"`

**Google button** — since we're using `supabase.auth.signInWithOAuth` (not `@react-oauth/google`), render a custom button that matches the SPA's circular icon style:
- Circular white button with Google "G" SVG icon
- `w-12 h-12 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors shadow-md`
- On click: call `signInWithGoogle()` from AuthContext

**No entrance animations** — the SPA has none on the login card. Keep it static.

---

## Tech Stack (already installed)

- React 19 + TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- `@supabase/supabase-js` — auth client
- `lucide-react` — icons only if needed
- `motion/react` — not used on login screen per design reference
- Fonts: Inter (already in `index.css`)

---

## Routes

| Path | Component | Auth |
|---|---|---|
| `/` | Redirects based on session | Public |
| `/auth/callback` | `AuthCallbackPage` | Public (mid-auth) |
| `/dashboard` | `DashboardPage` (empty shell) | Protected |

Simple client-side routing via `window.location.pathname` — no router library needed at this stage (consistent with spike approach).

---

## Files to Create / Modify

```
src/
  lib/
    supabase.ts              — already exists, no changes needed
  context/
    AuthContext.tsx          — rewrite (see spec below)
  pages/
    LoginPage.tsx            — new
    AuthCallbackPage.tsx     — rewrite (see spec below)
    DashboardPage.tsx        — new (empty shell only)
  App.tsx                    — rewrite (see spec below)
  main.tsx                   — no changes needed
  index.css                  — no changes needed

supabase/
  functions/
    auth-store-tokens/
      index.ts               — new Edge Function

supabase/
  migrations/
    YYYYMMDD_create_user_sheets.sql  — new migration
```

---

## Task 1 — Database Migration

Create `user_sheets` table per the auth spec schema.

```sql
create table public.user_sheets (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  sheet_id                text not null default '',
  sheet_name              text,
  refresh_token_secret_id uuid,   -- null until store-tokens completes
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id)
);

alter table public.user_sheets enable row level security;

-- Policies: users see and modify only their own row
create policy "select own" on public.user_sheets for select
  to authenticated using ((select auth.uid()) = user_id);

create policy "insert own" on public.user_sheets for insert
  to authenticated with check ((select auth.uid()) = user_id);

create policy "update own" on public.user_sheets for update
  to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own" on public.user_sheets for delete
  to authenticated using ((select auth.uid()) = user_id);

-- Auto-update updated_at
create function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end; $$;

create trigger user_sheets_updated_at
  before update on public.user_sheets
  for each row execute function public.set_updated_at();
```

**Columns intentionally absent:** `access_token`, `token_expiry`, `refresh_token` (plain text). Only `refresh_token_secret_id` (Vault UUID) is stored.

---

## Task 2 — Edge Function: `auth-store-tokens`

**Trigger:** Called by `AuthCallbackPage` immediately after login.

**What it does:**
1. Verifies Supabase JWT → resolves `user_id`
2. Receives `provider_refresh_token` from request body
3. Stores it encrypted in Supabase Vault → gets back `secret_id`
4. Exchanges refresh token for Google access token (in memory only)
5. Calls `POST https://sheets.googleapis.com/v4/spreadsheets` to create a new spreadsheet titled "Ledgrr — Finance Tracker"
6. Upserts `user_sheets` row with `{ user_id, sheet_id, sheet_name, refresh_token_secret_id }`
7. If row already exists (returning user): rotates the Vault secret
8. Returns `{ sheet_id, sheet_url }` — no Google tokens

**Required Edge Function secrets:**
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

**Vault usage:**
```typescript
// Store (new user)
const { data } = await supabaseAdmin.rpc('vault.create_secret', {
  secret: provider_refresh_token,
  name: `user-${userId}-google-refresh`
})
const secretId = data // UUID

// Rotate (returning user)
await supabaseAdmin.rpc('vault.update_secret', {
  id: existingSecretId,
  secret: provider_refresh_token
})
```

**Error handling:**
- If Vault storage fails → return 500, do not proceed
- If spreadsheet creation fails → return 500, do not upsert `user_sheets`
  (first-time user gets a clear error, can retry by signing in again)
- If returning user's token rotation fails → log, but still redirect to dashboard
  (non-fatal: old token still works until it's revoked)

---

## Task 3 — AuthContext

**File:** `src/context/AuthContext.tsx`

```typescript
interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}
```

**`signInWithGoogle()`:**
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
})
```

**Session management:**
- On mount: `supabase.auth.getSession()` to restore existing session
- Subscribe to `onAuthStateChange` for live updates
- `loading: true` until first `getSession()` resolves

**What AuthContext does NOT do:**
- Does not store or expose Google tokens
- Does not store `sheet_id` — that lives in app-level state or a separate context

---

## Task 4 — LoginPage

**File:** `src/pages/LoginPage.tsx`

**Behaviour:**
- Renders the login card (see visual design section above)
- `loading` prop controls spinner vs button display
- `error` prop renders the inline error message
- On button click: calls `signInWithGoogle()` from `useAuth()`
- Button is disabled while `loading` is true

**Props (passed from App.tsx):**
```typescript
interface LoginPageProps {
  loading: boolean
  error: string | null
}
```

**Accessibility:**
- Error paragraph has `role="alert"`
- Google button has `aria-label="Sign in with Google"`
- Spinner has `role="status"` and `aria-label="Signing in"`

---

## Task 5 — AuthCallbackPage

**File:** `src/pages/AuthCallbackPage.tsx`

This is the most critical page — it bridges Supabase's OAuth callback with our token storage.

**Behaviour:**
1. Poll `supabase.auth.getSession()` until session resolves (up to 10s, 500ms intervals) — same pattern as spike, proven to work
2. Extract `session.provider_refresh_token`
3. If no `provider_refresh_token`:
   - Show error: "Sign-in completed but Sheets access was not granted. Please try again."
   - Provide a "Try again" link back to `/`
4. If `provider_refresh_token` present:
   - POST to `/functions/v1/auth-store-tokens` with `{ provider_refresh_token }`
   - Show "Setting up your account…" during this call
   - On success: `window.location.replace('/dashboard')`
   - On error: show error message with "Try again" link

**States:**
```
'exchanging'  → spinner + "Completing sign-in…"
'setting-up'  → spinner + "Setting up your account…"
'success'     → check icon + "All set! Redirecting…"
'error'       → error icon + message + "Try again" link
```

**Note:** `provider_refresh_token` is only available in `session` on this page, immediately after login. It is passed directly to the Edge Function and is not stored in React state beyond this call.

---

## Task 6 — DashboardPage (empty shell)

**File:** `src/pages/DashboardPage.tsx`

Minimal — just proves auth gate works. No data fetching.

```tsx
// Renders:
// - Fixed nav: "Ledgrr" wordmark left, user email + sign out right
// - Main content: centered placeholder
//   "Dashboard coming soon."
//   user's email address below it
```

**Nav:**
- `fixed top-0 left-0 right-0 z-20 bg-black border-b border-gray-800 px-6 py-4`
- Left: `<h1>Ledgrr</h1>` — `text-white font-bold`
- Right: `<span>{user.email}</span>` + Sign out button (calls `signOut()`)

---

## Task 7 — App.tsx (auth gate + routing)

**File:** `src/App.tsx`

Three render states, matching the SPA pattern:

```
1. Session loading (initial mount, unknown state)
   → Full-screen spinner

2. Not authenticated
   → <LoginPage loading={false} error={loginError} />
   
3. Authenticated
   → Route to correct page
```

**Routing:**
```typescript
const path = window.location.pathname

if (path === '/auth/callback') return <AuthCallbackPage />
if (!session)                  return <LoginPage loading={loading} error={loginError} />
if (path === '/dashboard')     return <DashboardPage />

// Default: redirect to dashboard if session exists
window.location.replace('/dashboard')
return null
```

**`loginError` state** lives in `App.tsx`, passed down to `LoginPage` as a prop — matches SPA pattern. Set it if `signInWithGoogle()` throws (unlikely with OAuth redirect, but guard against it).

---

## Acceptance Criteria

- [ ] Fresh visit to `/` with no session → login page renders
- [ ] Click "Sign in with Google" → Google consent screen opens (one consent: identity + Sheets)
- [ ] After consent → `/auth/callback` shows "Completing sign-in…" then "Setting up your account…"
- [ ] After setup → redirects to `/dashboard`
- [ ] `user_sheets` row exists in DB with `sheet_id` and `refresh_token_secret_id` set
- [ ] A new "Ledgrr — Finance Tracker" spreadsheet exists in user's Google Drive
- [ ] Google tokens are never visible in browser DevTools (Network, Application, Console)
- [ ] Page reload on `/dashboard` → session restored, stays on dashboard (no re-login)
- [ ] Sign out → returns to login page, session cleared
- [ ] Returning user sign-in → goes directly to dashboard (no duplicate sheet created)

---

## Out of Scope for This Spec

- Dashboard data (transactions, accounts, budgets)
- Sheets read/write from the real app
- Disconnect / revocation flow
- Error recovery UI beyond "try again"
- Any theming beyond the default dark (black) theme
- Mobile nav, pull-to-refresh, privacy mode
