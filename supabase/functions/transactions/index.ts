import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// --- Inlined sheet-column constants ---------------------------------------
// Deno cannot import from `src/`, so these mirror src/constants/sheets.ts.
// They MUST be kept in sync with that file (case-sensitive header strings).
const TRANSACTIONS_COLUMNS = Object.freeze({
  TXN_ID:          'Txn ID',
  DATE:            'Date',
  ACCOUNT:         'Account',
  AMOUNT:          'Amount',
  RESOLVED_AMOUNT: 'Resolved Amount',
  CURRENCY:        'Currency',
  TARGET_ACCOUNT:  'Target Account',
  TYPE:            'Transaction Type',
  CATEGORY:        'Category',
  SUBCATEGORY:     'Subcategory',
  BUDGET:          'Budget',
  NOTE:            'Note',
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

/**
 * Raw transaction row — a passthrough of the sheet cells with only light,
 * non-business parsing: numbers are parsed (thousands separators stripped) and
 * blank strings normalized. NO FX resolution, NO phpValue, NO derived flags —
 * the frontend resolves PHP via the currencies collection.
 */
export interface RawTransaction {
  key:            string        // col A — Txn ID
  date:           string        // col B — raw date string
  account:        string        // col C
  amount:         number        // col D — native currency
  resolvedAmount: number | null // col E — null when empty/non-numeric
  currency:       string        // col F
  targetAccount:  string        // col G
  type:           string        // col H — Transaction Type
  category:       string        // col I
  subcategory:    string        // col J
  budget:         string        // col K
  note:           string        // col L
}

/**
 * Maps a Transactions sheet row to a RawTransaction. Returns null when the
 * Txn ID (col A) or Date (col B) is empty, so callers drop blank/incomplete
 * rows. This is structural row-skipping, not business filtering.
 */
export function mapRowToTransaction(
  row:       string[],
  headerMap: Record<string, number>
): RawTransaction | null {
  const get = (col: string): string => (row[headerMap[col] ?? -1] ?? '').trim()

  const key  = get(TRANSACTIONS_COLUMNS.TXN_ID)
  const date = get(TRANSACTIONS_COLUMNS.DATE)
  if (!key || !date) return null

  const amount = parseFloat(get(TRANSACTIONS_COLUMNS.AMOUNT).replace(/,/g, '')) || 0

  const rawResolved    = get(TRANSACTIONS_COLUMNS.RESOLVED_AMOUNT)
  const parsedResolved = parseFloat(rawResolved.replace(/,/g, ''))
  const resolvedAmount = rawResolved !== '' && !isNaN(parsedResolved) ? parsedResolved : null

  return {
    key,
    date,
    account:        get(TRANSACTIONS_COLUMNS.ACCOUNT),
    amount,
    resolvedAmount,
    currency:       get(TRANSACTIONS_COLUMNS.CURRENCY) || 'PHP',
    targetAccount:  get(TRANSACTIONS_COLUMNS.TARGET_ACCOUNT),
    type:           get(TRANSACTIONS_COLUMNS.TYPE),
    category:       get(TRANSACTIONS_COLUMNS.CATEGORY),
    subcategory:    get(TRANSACTIONS_COLUMNS.SUBCATEGORY),
    budget:         get(TRANSACTIONS_COLUMNS.BUDGET),
    note:           get(TRANSACTIONS_COLUMNS.NOTE),
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const cors = { 'Access-Control-Allow-Origin': '*' }

  try {
    // --- Authentication: verify Supabase JWT ---
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

    // --- Look up the user's connected sheet ---
    const { data: userSheet } = await supabaseAdmin
      .from('user_sheets')
      .select('sheet_id, refresh_token_secret_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!userSheet) {
      return Response.json({ error: 'No sheet connected for this user' }, { status: 404, headers: cors })
    }

    // --- Retrieve the Google refresh token from Supabase Vault ---
    const { data: refreshToken, error: vaultError } = await supabaseAdmin.rpc(
      'decrypt_vault_secret', { p_id: userSheet.refresh_token_secret_id }
    )
    if (vaultError || !refreshToken) {
      return Response.json({ error: 'Failed to retrieve credentials' }, { status: 500, headers: cors })
    }

    // --- Exchange the refresh token for a Google access token ---
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

    // --- Read the Transactions tab (A:L) only; no Currency fetch, no FX ---
    const sheetId = userSheet.sheet_id
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
    let transactionsRes: Response
    try {
      transactionsRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Transactions!A:L`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }
      )
    } catch (_e) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    } finally {
      clearTimeout(timeout)
    }
    if (!transactionsRes.ok) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    }

    const values = ((await transactionsRes.json()) as { values?: string[][] }).values ?? []
    if (values.length === 0) {
      return Response.json([], { status: 200, headers: cors })
    }

    // --- Map every row; drop only blank/incomplete rows (no filtering) ---
    const headerMap = buildHeaderMap(values[0])
    const transactions: RawTransaction[] = values
      .slice(1)
      .map((row) => mapRowToTransaction(row, headerMap))
      .filter((tx): tx is RawTransaction => tx !== null)

    return Response.json(transactions, { status: 200, headers: cors })

  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
