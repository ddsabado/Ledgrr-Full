-- Per-user hashed API keys for the iOS Shortcut endpoints (shortcuts-data / shortcuts-insert).
-- Only the SHA-256 hex hash of each key is stored (never the raw key). RLS-locked to the service role.
create table if not exists public.api_keys (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  token_hash    text        not null,
  label         text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create unique index if not exists api_keys_token_hash_key
  on public.api_keys (token_hash);

-- RLS enabled with NO policies intentionally: anon/authenticated get zero access;
-- only the service role (Edge Functions) can read/write.
alter table public.api_keys enable row level security;;
