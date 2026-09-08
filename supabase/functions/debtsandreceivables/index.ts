import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// --- Inlined sheet-column constants ---------------------------------------
// Deno cannot import from `src/`, so these mirror src/constants/sheets.ts
// (DEBTS_RECEIVABLES_COLUMNS). Keep both in sync (case-sensitive header
// strings). Column N "Resolved Amount" is the schema addition for this feature.
const DEBTS_RECEIVABLES_COLUMNS = Object.freeze({
  TRANSACTION_NAME:  'Transaction Name',
  ACCOUNT:           'Account',
  DATE:              'Date',
  TOTAL_AMOUNT:      'Total Amount',
  PARTICIPANTS:      'Participants',
  SPLIT_BY:          'Split By',
  AMOUNTS:           'Amounts',
  CATEGORY:          'Category',
  SUBCATEGORY:       'Subcategory',
  PAID_PARTICIPANTS: 'Paid Participants',
  STATUS:            'Status',
  DIRECTION:         'Direction',
  CURRENCY:          'Currency',
  RESOLVED_AMOUNT:   'Resolved Amount',
} as const)

/** Timeout budget for the Google Sheets read. */
const READ_TIMEOUT_MS = 10_000

/** Builds a header-name → column-index map from a sheet's first row. */
export function buildHeaderMap(headers: string[]): Record<string, number> {
  return headers.reduce((map, header, index) => {
    map[header.trim()] = index
    return map
  }, {} as Record<string, number>)
}

/** Raw Debts & Receivables row — every field a trimmed string, no parsing. */
export interface RawDebtReceivableRow {
  name:             string
  account:          string
  date:             string
  totalAmount:      string
  participants:     string
  splitBy:          string
  amounts:          string
  category:         string
  subcategory:      string
  paidParticipants: string
  status:           string
  direction:        string
  currency:         string
  resolvedAmount:   string
}

/**
 * Maps a Debts & Receivables sheet row to a RawDebtReceivableRow by header
 * name. Returns null when every mapped field is empty (a fully-blank row), so
 * callers can drop blanks while preserving order. No computation, no filtering.
 */
export function mapRowToDebtReceivable(
  row: string[], headerMap: Record<string, number>
): RawDebtReceivableRow | null {
  const get = (col: string): string => (row[headerMap[col] ?? -1] ?? '').trim()
  const mapped: RawDebtReceivableRow = {
    name:             get(DEBTS_RECEIVABLES_COLUMNS.TRANSACTION_NAME),
    account:          get(DEBTS_RECEIVABLES_COLUMNS.ACCOUNT),
    date:             get(DEBTS_RECEIVABLES_COLUMNS.DATE),
    totalAmount:      get(DEBTS_RECEIVABLES_COLUMNS.TOTAL_AMOUNT),
    participants:     get(DEBTS_RECEIVABLES_COLUMNS.PARTICIPANTS),
    splitBy:          get(DEBTS_RECEIVABLES_COLUMNS.SPLIT_BY),
    amounts:          get(DEBTS_RECEIVABLES_COLUMNS.AMOUNTS),
    category:         get(DEBTS_RECEIVABLES_COLUMNS.CATEGORY),
    subcategory:      get(DEBTS_RECEIVABLES_COLUMNS.SUBCATEGORY),
    paidParticipants: get(DEBTS_RECEIVABLES_COLUMNS.PAID_PARTICIPANTS),
    status:           get(DEBTS_RECEIVABLES_COLUMNS.STATUS),
    direction:        get(DEBTS_RECEIVABLES_COLUMNS.DIRECTION),
    currency:         get(DEBTS_RECEIVABLES_COLUMNS.CURRENCY),
    resolvedAmount:   get(DEBTS_RECEIVABLES_COLUMNS.RESOLVED_AMOUNT),
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

    // --- Read the Debts and Receivables tab (A:N); raw passthrough ---
    // The tab name contains spaces, so the range must be percent-encoded.
    const sheetId = userSheet.sheet_id
    const range = encodeURIComponent('Debts and Receivables!A:N')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
    let drRes: Response
    try {
      drRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }
      )
    } catch (_e) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    } finally {
      clearTimeout(timeout)
    }
    if (!drRes.ok) {
      // A 404 from Sheets (missing tab/resource) maps to 404; other failures to 502.
      const status = drRes.status === 404 ? 404 : 502
      return Response.json({ error: 'Failed to read sheet' }, { status, headers: cors })
    }

    const values = ((await drRes.json()) as { values?: string[][] }).values ?? []
    if (values.length === 0) {
      return Response.json([], { status: 200, headers: cors })
    }

    const headerMap = buildHeaderMap(values[0])
    const rows: RawDebtReceivableRow[] = values
      .slice(1)
      .map((row) => mapRowToDebtReceivable(row, headerMap))
      .filter((r): r is RawDebtReceivableRow => r !== null)

    return Response.json(rows, { status: 200, headers: cors })

  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
