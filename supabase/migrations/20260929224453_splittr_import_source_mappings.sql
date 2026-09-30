-- One-time Splittr imports.  The unique source identity is claimed before a
-- Sheet write, so a retry can never create a second finance record.
create table if not exists public.splittr_import_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id text not null,
  expense_id text not null,
  imported_at timestamptz not null default now(),
  result jsonb not null default '{}'::jsonb,
  unique (user_id, group_id, expense_id)
);

alter table public.splittr_import_sources enable row level security;

create policy "users can view their own Splittr imports"
  on public.splittr_import_sources for select to authenticated
  using ((select auth.uid()) = user_id);

-- This index also supports user deletion and the import history dashboard.
create index if not exists splittr_import_sources_user_imported_idx
  on public.splittr_import_sources (user_id, imported_at desc);
