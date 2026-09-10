/**
 * Recurring Payments sheet endpoint.
 * GET reads recurring rows; POST writes only a single Recurring Payments row.
 * Use recurring-submit for the command-oriented UI submission path.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// --- Inlined sheet-column constants ---------------------------------------
// Deno cannot import from `src/`, so these mirror src/constants/sheets.ts
// (RECURRING_COLUMNS). Keep both in sync (case-sensitive header strings).
const RECURRING_COLUMNS = Object.freeze({
  NAME:        'Name',
  ACCOUNT:     'Account',
  AMOUNT:      'Amount',
  FREQUENCY:   'Frequency',
  START_DATE:  'Start Date',
  END_DATE:    'End Date',
  CATEGORY:    'Category',
  SUBCATEGORY: 'Subcategory',
  CURRENCY:    'Currency',
} as const)

/** Timeout budget for the Google Sheets read. */
const READ_TIMEOUT_MS = 30_000

// --- Pure helpers (named exports for unit testing) -------------------------

/** Builds a header-name → column-index map from a sheet's first row. */
export function buildHeaderMap(headers: string[]): Record<string, number> {
  return headers.reduce((map, header, index) => {
    map[header.trim()] = index
    return map
  }, {} as Record<string, number>)
}

/** Raw recurring payment row — every field a trimmed string, no parsing. */
export interface RawRecurringRow {
  name:        string
  account:     string
  amount:      string
  frequency:   string
  startDate:   string
  endDate:     string
  category:    string
  subcategory: string
  currency:    string
}

/**
 * Maps a Recurring Payments sheet row to a RawRecurringRow by header name.
 * Returns null when every mapped field is empty (a fully-blank row). No month
 * filtering, no coercion.
 */
export function mapRowToRecurring(
  row: string[], headerMap: Record<string, number>
): RawRecurringRow | null {
  const get = (col: string): string => (row[headerMap[col] ?? -1] ?? '').trim()
  const mapped: RawRecurringRow = {
    name:        get(RECURRING_COLUMNS.NAME),
    account:     get(RECURRING_COLUMNS.ACCOUNT),
    amount:      get(RECURRING_COLUMNS.AMOUNT),
    frequency:   get(RECURRING_COLUMNS.FREQUENCY),
    startDate:   get(RECURRING_COLUMNS.START_DATE),
    endDate:     get(RECURRING_COLUMNS.END_DATE),
    category:    get(RECURRING_COLUMNS.CATEGORY),
    subcategory: get(RECURRING_COLUMNS.SUBCATEGORY),
    currency:    get(RECURRING_COLUMNS.CURRENCY),
  }
  const allEmpty = Object.values(mapped).every((v) => v === '')
  return allEmpty ? null : mapped
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS })
  }

  const cors = { 'Access-Control-Allow-Origin': '*' }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

    let insert: Record<string, unknown> | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        insert = body && typeof body === 'object' ? body as Record<string, unknown> : null
      } catch {
        return Response.json({ error: 'Malformed JSON body' }, { status: 400, headers: cors })
      }
      const month = (value: unknown) => typeof value === 'string' && /^\d{1,2}\/\d{4}$/.test(value.trim())
      const valid = insert && typeof insert.name === 'string' && insert.name.trim() !== '' &&
        typeof insert.account === 'string' && insert.account.trim() !== '' &&
        typeof insert.currency === 'string' && insert.currency.trim() !== '' &&
        typeof insert.frequency === 'string' && insert.frequency.trim() !== '' &&
        typeof insert.category === 'string' && insert.category.trim() !== '' && month(insert.startDate) &&
        (insert.endDate === '' || month(insert.endDate)) && typeof insert.amount === 'number' &&
        Number.isFinite(insert.amount) && insert.amount > 0 && typeof insert.subcategory === 'string'
      if (!valid) return Response.json({ error: 'Invalid recurring payment details' }, { status: 400, headers: cors })
    }

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

    if (insert) {
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent('Recurring Payments!A:I')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            majorDimension: 'ROWS',
            values: [[
              (insert.name as string).trim(), (insert.account as string).trim(), (insert.amount as number).toFixed(2),
              (insert.frequency as string).trim(), (insert.startDate as string).trim(), (insert.endDate as string).trim(),
              (insert.category as string).trim(), (insert.subcategory as string).trim(), (insert.currency as string).trim(),
            ]],
          }),
        },
      )
      if (!appendRes.ok) return Response.json({ error: 'Failed to write recurring payment' }, { status: 502, headers: cors })
      return Response.json({ ok: true }, { status: 201, headers: cors })
    }

    // --- Read the Recurring Payments tab (A:I) with a timeout budget; raw passthrough ---
    const sheetId = userSheet.sheet_id
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
    let recurringRes: Response
    try {
      recurringRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Recurring Payments')}!A:I`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }
      )
    } catch (_e) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    } finally {
      clearTimeout(timeout)
    }
    if (!recurringRes.ok) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    }

    const values = ((await recurringRes.json()) as { values?: string[][] }).values ?? []
    if (values.length === 0) {
      return Response.json([], { status: 200, headers: cors })
    }

    const headerMap = buildHeaderMap(values[0])
    const rows: RawRecurringRow[] = values
      .slice(1)
      .map((row) => mapRowToRecurring(row, headerMap))
      .filter((r): r is RawRecurringRow => r !== null)

    return Response.json(rows, { status: 200, headers: cors })

  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
