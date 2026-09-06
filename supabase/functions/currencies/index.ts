import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CURRENCY_COLUMNS = Object.freeze({
  CODE: 'Currency',
  RATE: 'Rate to PHP',
} as const)

export function buildHeaderMap(headers: string[]): Record<string, number> {
  return headers.reduce((map, header, index) => {
    map[header.trim()] = index
    return map
  }, {} as Record<string, number>)
}

/**
 * Builds an FX map from Currency sheet rows.
 * Always includes PHP: 1 as the base.
 * Returns { "USD": 56.2, "TWD": 1.7, "PHP": 1, ... }
 */
export function buildFxMap(
  rows:      string[][],
  headerMap: Record<string, number>
): Record<string, number> {
  const fxMap: Record<string, number> = { PHP: 1 }
  for (const row of rows) {
    const code = row[headerMap[CURRENCY_COLUMNS.CODE] ?? -1]?.trim()
    const rate = parseFloat(row[headerMap[CURRENCY_COLUMNS.RATE] ?? -1]?.replace(/,/g, '') ?? '')
    if (code && !isNaN(rate) && rate > 0) {
      fxMap[code] = rate
    }
  }
  return fxMap
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const cors = { 'Access-Control-Allow-Origin': '*' }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

    const supabaseUrl         = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon        = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false },
    })

    const { data: userSheet } = await supabaseAdmin
      .from('user_sheets')
      .select('sheet_id, refresh_token_secret_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!userSheet) {
      return Response.json({ error: 'No sheet connected for this user' }, { status: 404, headers: cors })
    }

    const { data: refreshToken, error: vaultError } = await supabaseAdmin.rpc(
      'decrypt_vault_secret', { p_id: userSheet.refresh_token_secret_id }
    )
    if (vaultError || !refreshToken) {
      return Response.json({ error: 'Failed to retrieve credentials' }, { status: 500, headers: cors })
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    })
    if (!tokenRes.ok) {
      return Response.json({ error: 'Failed to exchange token' }, { status: 502, headers: cors })
    }
    const { access_token: accessToken } = await tokenRes.json() as { access_token: string }

    const currencyRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/Currency!A:B`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!currencyRes.ok) {
      return Response.json({ error: 'Failed to read currency data' }, { status: 502, headers: cors })
    }

    const currencyValues = ((await currencyRes.json()) as { values?: string[][] }).values ?? []

    if (currencyValues.length === 0) {
      return Response.json({ PHP: 1 }, { status: 200, headers: cors })
    }

    const headerMap = buildHeaderMap(currencyValues[0])
    const fxMap     = buildFxMap(currencyValues.slice(1), headerMap)

    return Response.json(fxMap, { status: 200, headers: cors })

  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
