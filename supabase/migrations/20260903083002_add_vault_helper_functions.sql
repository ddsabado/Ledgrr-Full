
-- Public wrapper functions so Edge Functions can call Vault via supabase-js .rpc()
-- Both are SECURITY DEFINER so they run as the owner (postgres) which has vault access
-- Restricted to service_role only — not callable by anon or authenticated

CREATE OR REPLACE FUNCTION public.create_vault_secret(
  p_secret      text,
  p_name        text DEFAULT NULL,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vault_secret(
  p_id     uuid,
  p_secret text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM vault.update_secret(p_id, p_secret);
END;
$$;

-- Revoke from all roles by default, then grant only to service_role
REVOKE EXECUTE ON FUNCTION public.create_vault_secret(text, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_vault_secret(uuid, text)       FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_vault_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(uuid, text)       TO service_role;
;
