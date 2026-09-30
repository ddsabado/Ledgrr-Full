
-- user_sheets: stores each user's connected Google Sheet and OAuth tokens
create table if not exists public.user_sheets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  sheet_id       text not null,
  sheet_name     text,
  refresh_token  text not null,
  access_token   text,
  token_expiry   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id)  -- one sheet per user for now (spike)
);

-- RLS: users can only see and modify their own row
alter table public.user_sheets enable row level security;

create policy "Users can view their own sheet"
  on public.user_sheets for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "Users can insert their own sheet"
  on public.user_sheets for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "Users can update their own sheet"
  on public.user_sheets for update
  to authenticated
  using  ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "Users can delete their own sheet"
  on public.user_sheets for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_sheets_updated_at
  before update on public.user_sheets
  for each row execute function public.set_updated_at();
;
