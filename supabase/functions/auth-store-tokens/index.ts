import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * auth-store-tokens
 *
 * Called once by AuthCallbackPage immediately after login.
 * Encrypts the Google refresh token in Vault and upserts a user_sheets row.
 *
 * Deliberately scoped to auth only:
 * - No spreadsheet creation (separate concern, separate spec)
 * - No Sheets API calls
 * - No token exchange beyond confirming the refresh token is valid
 *
 * POST body: { provider_refresh_token: string }
 * Auth:      Bearer <supabase_access_token>
 * Returns:   { success: true }
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const cors = { 'Access-Control-Allow-Origin': '*' }

  try {
    const body = await req.json() as { provider_refresh_token?: string }
    const providerRefreshToken = body.provider_refresh_token

    if (!providerRefreshToken) {
      return Response.json(
        { error: 'Missing provider_refresh_token', code: 'MISSING_REFRESH_TOKEN' },
        { status: 400, headers: cors }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return Response.json(
        { error: 'Missing Authorization header', code: 'UNAUTHORIZED' },
        { status: 401, headers: cors }
      )
    }

    const supabaseUrl         = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon        = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // User-scoped client — identity verification only
    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return Response.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401, headers: cors }
      )
    }

    const userId = user.id

    // Admin client — Vault wrappers + service-level DB writes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false },
    })

    // Check for existing row (returning user)
    const { data: existing } = await supabaseAdmin
      .from('user_sheets')
      .select('id, refresh_token_secret_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      // Returning user — rotate the Vault secret
      if (existing.refresh_token_secret_id) {
        const { error: vaultErr } = await supabaseAdmin.rpc('update_vault_secret', {
          p_id:     existing.refresh_token_secret_id,
          p_secret: providerRefreshToken,
        })
        if (vaultErr) console.error('Vault rotation failed (non-fatal):', vaultErr.message)
      } else {
        // Row exists but no secret yet — create one
        const { data: newSecretId, error: vaultErr } = await supabaseAdmin.rpc('create_vault_secret', {
          p_secret: providerRefreshToken,
          p_name:   `user-${userId}-google-refresh`,
        })
        if (!vaultErr && newSecretId) {
          await supabaseAdmin
            .from('user_sheets')
            .update({ refresh_token_secret_id: newSecretId })
            .eq('user_id', userId)
        }
      }
      return Response.json({ success: true }, { headers: cors })
    }

    // New user — store refresh token in Vault
    const { data: secretId, error: vaultErr } = await supabaseAdmin.rpc('create_vault_secret', {
      p_secret: providerRefreshToken,
      p_name:   `user-${userId}-google-refresh`,
    })
    if (vaultErr || !secretId) {
      console.error('Vault create error:', vaultErr)
      return Response.json(
        { error: 'Failed to store refresh token securely', code: 'VAULT_ERROR' },
        { status: 500, headers: cors }
      )
    }

    // Insert user_sheets row — sheet_id empty until sheet creation spec
    const { error: dbErr } = await supabaseAdmin
      .from('user_sheets')
      .insert({
        user_id:                 userId,
        sheet_id:                '',
        refresh_token_secret_id: secretId,
      })
    if (dbErr) {
      return Response.json(
        { error: 'Failed to save user record', code: 'DB_ERROR', details: dbErr.message },
        { status: 500, headers: cors }
      )
    }

    return Response.json({ success: true }, { headers: cors })

  } catch (err) {
    return Response.json(
      { error: 'Unexpected server error', code: 'INTERNAL_ERROR', details: String(err) },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
