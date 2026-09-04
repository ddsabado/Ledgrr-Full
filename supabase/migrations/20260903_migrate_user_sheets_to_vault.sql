-- Migrate user_sheets from spike schema (plain text tokens) to production schema (Vault)
-- Removes: refresh_token, access_token, token_expiry
-- Adds:    refresh_token_secret_id (UUID → vault.secrets)

ALTER TABLE public.user_sheets
  DROP COLUMN IF EXISTS refresh_token,
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS token_expiry;

ALTER TABLE public.user_sheets
  ALTER COLUMN sheet_id SET DEFAULT '';

ALTER TABLE public.user_sheets
  ADD COLUMN IF NOT EXISTS refresh_token_secret_id uuid;

-- Recreate RLS policies
DROP POLICY IF EXISTS "Users can view their own sheet"   ON public.user_sheets;
DROP POLICY IF EXISTS "Users can insert their own sheet" ON public.user_sheets;
DROP POLICY IF EXISTS "Users can update their own sheet" ON public.user_sheets;
DROP POLICY IF EXISTS "Users can delete their own sheet" ON public.user_sheets;

CREATE POLICY "select own" ON public.user_sheets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "insert own" ON public.user_sheets
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "update own" ON public.user_sheets
  FOR UPDATE TO authenticated
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "delete own" ON public.user_sheets
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
