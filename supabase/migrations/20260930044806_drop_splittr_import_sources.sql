-- Historical creation migration remains for already-applied environments.
-- This follow-up migration removes the retired one-time import reservation table.
drop table if exists public.splittr_import_sources;
