-- Public wrapper function for Vault decryption from Edge Functions via supabase-js .rpc()
-- supabase-js .rpc() only resolves functions in the public schema,
-- so we can't call vault.decrypted_secrets directly.
-- This wrapper is SECURITY DEFINER (run as postgres) and restricted to service_role only.

CREATE OR REPLACE FUNCTION public.decrypt_vault_secret(
  p_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
   WHERE id = p_id;
  RETURN v_secret;
END;
$$;

-- Restrict to service_role only — not callable by anon or authenticated
REVOKE EXECUTE ON FUNCTION public.decrypt_vault_secret(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_vault_secret(uuid) TO service_role;
