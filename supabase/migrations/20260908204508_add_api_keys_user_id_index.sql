-- Covering index for the api_keys.user_id foreign key (clears unindexed_foreign_keys lint).
create index if not exists api_keys_user_id_idx on public.api_keys (user_id);;
