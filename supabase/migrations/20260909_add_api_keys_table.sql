-- Per-user hashed API keys for the iOS Shortcut endpoints (shortcuts-data / shortcuts-insert).
-- An iOS Shortcut cannot complete the interactive Google OAuth flow the web app uses, so the
-- caller authenticates with a per-user API key sent in the X-API-Key header instead of a JWT.
-- SECURITY: only the SHA-256 hex hash of each key (token_hash) is ever stored here — never the
-- raw key. The raw key exists only in the operator's terminal and the Shortcut itself.
-- Keys are issued MANUALLY by the operator this iteration (no in-app UI): generate a raw key,
-- compute its SHA-256 hex hash, and insert the hash + target user_id here.
-- The table is RLS-locked so that only the service role (used by the Edge Functions) can read
-- or write it; anon/authenticated clients have no access.

create table if not exists public.api_keys (
  id            uuid        primary key default gen_random_uuid(),
  -- FK to auth.users: deleting a user removes their keys automatically (ON DELETE CASCADE).
  user_id       uuid        not null references auth.users(id) on delete cascade,
  -- SHA-256 hex of the raw key (lowercase). Never the raw key. Unique across all users.
  token_hash    text        not null,
  label         text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  -- Soft-revoke marker: auth rejects any row where this is non-null. Rows are never hard-deleted
  -- on revoke, preserving last_used_at history.
  revoked_at    timestamptz
);

-- Unique constraint on token_hash. Doubles as the auth lookup index — the Edge Function selects
-- `where token_hash = $hash`, an index-covered equality lookup.
create unique index if not exists api_keys_token_hash_key
  on public.api_keys (token_hash);

-- Enable RLS with NO policies, intentionally. This grants anon/authenticated clients ZERO access;
-- only the service role (which bypasses RLS) — i.e. the Edge Functions — can read/write this table.
-- Do NOT add any `create policy` statements here.
alter table public.api_keys enable row level security;

-- Covering index for the user_id foreign key (avoids the unindexed-FK linter finding).
-- The hot auth path looks up by token_hash (indexed above); user_id is used on the
-- rare admin/cascade path, but the index keeps FK operations efficient.
create index if not exists api_keys_user_id_idx on public.api_keys (user_id);
