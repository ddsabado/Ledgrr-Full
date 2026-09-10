import { createClient } from 'jsr:@supabase/supabase-js@2'

export class SheetContextError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export interface SheetContext {
  sheetId: string
  accessToken: string
}

/** Authenticates the caller and exchanges the user's stored Google token once. */
export async function getSheetContext(authHeader: string | null): Promise<SheetContext> {
  if (!authHeader) throw new SheetContextError(401, 'Unauthorized')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) throw new SheetContextError(401, 'Unauthorized')

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
  const { data: userSheet } = await admin
    .from('user_sheets')
    .select('sheet_id, refresh_token_secret_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!userSheet) throw new SheetContextError(404, 'No sheet connected for this user')
  const { data: refreshToken, error: vaultError } = await admin.rpc(
    'decrypt_vault_secret', { p_id: userSheet.refresh_token_secret_id },
  )
  if (vaultError || !refreshToken) throw new SheetContextError(500, 'Failed to retrieve credentials')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!tokenRes.ok) throw new SheetContextError(502, 'Failed to exchange token')
  const { access_token: accessToken } = await tokenRes.json() as { access_token: string }
  return { sheetId: userSheet.sheet_id, accessToken }
}

export function sheetHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
}
