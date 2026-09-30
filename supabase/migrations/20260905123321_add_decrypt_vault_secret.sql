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

REVOKE EXECUTE ON FUNCTION public.decrypt_vault_secret(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_vault_secret(uuid) TO service_role;;
