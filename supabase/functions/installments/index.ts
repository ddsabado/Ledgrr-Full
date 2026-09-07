import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// --- Inlined sheet-column constants ---------------------------------------
// Deno cannot import from `src/`, so these mirror src/constants/sheets.ts
// (INSTALLMENTS_COLUMNS). Keep both in sync (case-sensitive header strings).
const INSTALLMENTS_COLUMNS = Object.freeze({
  NAME:         'Installment',
  ACCOUNT:      'Account',
  TOTAL_AMOUNT: 'Total Amount',
  TERMS:        'Terms (in mo.)',
  TERM_PAYMENT: 'Term Payment',
  START_DATE:   'Start Date',
  BUDGET:       'Budget',
  CURRENCY:     'Currency',
} as const)

/** Timeout budget for the Google Sheets read. */
const READ_TIMEOUT_MS = 10_000

// --- Pure helpers (named exports for unit testing) -------------------------

/** Builds a header-name → column-index map from a sheet's first row. */
export function buildHeaderMap(headers: string[]): Record<string, number> {
  return headers.reduce((map, header, index) => {
    map[header.trim()] = index
    return map
  }, {} as Record<string, number>)
}

/** Raw installment row — every field a trimmed string, no parsing. */
export interface RawInstallmentRow {
  name:        string
  account:     string
  totalAmount: string
  terms:       string
  termPayment: string
  startDate:   string
  budget:      string
  currency:    string
}

/**
 * Maps an Installments sheet row to a RawInstallmentRow by header name.
 * Returns null when every mapped field is empty (a fully-blank row), so callers
 * can drop blanks while preserving order. No month filtering, no coercion.
 */
export function mapRowToInstallment(
  row: string[], headerMap: Record<string, number>
): RawInstallmentRow | null {
  const get = (col: string): string => (row[headerMap[col] ?? -1] ?? '').trim()
  const mapped: RawInstallmentRow = {
    name:        get(INSTALLMENTS_COLUMNS.NAME),
    account:     get(INSTALLMENTS_COLUMNS.ACCOUNT),
    totalAmount: get(INSTALLMENTS_COLUMNS.TOTAL_AMOUNT),
    terms:       get(INSTALLMENTS_COLUMNS.TERMS),
    termPayment: get(INSTALLMENTS_COLUMNS.TERM_PAYMENT),
    startDate:   get(INSTALLMENTS_COLUMNS.START_DATE),
    budget:      get(INSTALLMENTS_COLUMNS.BUDGET),
    currency:    get(INSTALLMENTS_COLUMNS.CURRENCY),
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

    // --- Read the Installments tab (A:H) with a timeout budget; raw passthrough ---
    const sheetId = userSheet.sheet_id
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
    let installmentsRes: Response
    try {
      installmentsRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Installments!A:H`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }
      )
    } catch (_e) {
      // Abort/timeout or network failure → upstream read failure.
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    } finally {
      clearTimeout(timeout)
    }
    if (!installmentsRes.ok) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    }

    const values = ((await installmentsRes.json()) as { values?: string[][] }).values ?? []
    if (values.length === 0) {
      return Response.json([], { status: 200, headers: cors })
    }

    const headerMap = buildHeaderMap(values[0])
    const rows: RawInstallmentRow[] = values
      .slice(1)
      .map((row) => mapRowToInstallment(row, headerMap))
      .filter((r): r is RawInstallmentRow => r !== null)

    return Response.json(rows, { status: 200, headers: cors })

  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
