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

const CURRENCY_COLUMNS = Object.freeze({
  CODE: 'Currency',
  RATE: 'Rate to PHP',
} as const)

// --- Pure helper functions (named exports for unit testing) ----------------

/**
 * Builds a header-name → column-index map from a sheet's first row.
 * Same implementation as accounts-balances / currencies.
 */
export function buildHeaderMap(headers: string[]): Record<string, number> {
  return headers.reduce((map, header, index) => {
    map[header.trim()] = index
    return map
  }, {} as Record<string, number>)
}

/**
 * Builds an FX map from Currency sheet rows.
 * Always includes PHP: 1 as the base, so an empty `rows` array yields { PHP: 1 }.
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

/**
 * Resolves a transaction's PHP value (mirrors resolvePHP_ in Code.js).
 * - PHP passthrough: returns the raw amount.
 * - Determined path: returns resolvedAmount when it is a finite number.
 * - FX fallback: raw * fx[currency] (rate 1 when currency absent from map).
 *
 * This is per-row currency enrichment, not filtering — the frontend relies
 * on phpValue being present so it never needs per-transaction FX rates.
 */
export function resolvePHP(
  rawAmount:      number,
  currency:       string,
  resolvedAmount: unknown,
  fx:             Record<string, number>
): number {
  const raw = Number(rawAmount) || 0
  const ccy = currency || 'PHP'
  if (ccy === 'PHP') return raw
  const resolved = Number(resolvedAmount)
  if (resolvedAmount !== '' && resolvedAmount != null && Number.isFinite(resolved)) {
    return resolved
  }
  return raw * (fx[ccy] ?? 1)
}

/**
 * True when a transaction's PHP value is "determined" (mirrors isDetermined_ in Code.js):
 * the currency is non-PHP AND resolvedAmount is a finite number (not "" or null).
 */
export function isDetermined(currency: string, resolvedAmount: unknown): boolean {
  if ((currency || 'PHP') === 'PHP') return false
  const resolved = Number(resolvedAmount)
  return resolvedAmount !== '' && resolvedAmount != null && Number.isFinite(resolved)
}

/**
 * Raw transaction row as returned by this function.
 * `phpValue` is computed server-side via resolvePHP so the frontend never
 * needs per-transaction FX rates. Column letters refer to the Transactions sheet.
 */
interface RawTransaction {
  key:            string        // col A — Txn ID
  date:           string        // col B — raw date string
  account:        string        // col C
  amount:         number        // col D — native currency
  resolvedAmount: number | null // col E — null when empty/non-numeric
  currency:       string        // col F
  targetAccount:  string        // col G — empty string if blank
  type:           string        // col H — Transaction Type
  category:       string        // col I
  subcategory:    string        // col J — empty string if blank
  note:           string        // col L — empty string if blank
  determined:     boolean
  phpValue:       number
}

/**
 * Maps a Transactions sheet row to a RawTransaction.
 * Returns null when the Txn ID (col A) is empty or the date (col B) is empty,
 * so callers can filter out blank/incomplete rows.
 */
export function mapRowToTransaction(
  row:       string[],
  headerMap: Record<string, number>,
  fxMap:     Record<string, number>
): RawTransaction | null {
  const get = (col: string): string => (row[headerMap[col] ?? -1] ?? '').trim()

  const key  = get(TRANSACTIONS_COLUMNS.TXN_ID)
  const date = get(TRANSACTIONS_COLUMNS.DATE)
  if (!key || !date) return null

  const amount = parseFloat(get(TRANSACTIONS_COLUMNS.AMOUNT).replace(/,/g, '')) || 0

  const rawResolved      = get(TRANSACTIONS_COLUMNS.RESOLVED_AMOUNT)
  const parsedResolved   = parseFloat(rawResolved.replace(/,/g, ''))
  const resolvedAmount   = rawResolved !== '' && !isNaN(parsedResolved) ? parsedResolved : null

  const currency = get(TRANSACTIONS_COLUMNS.CURRENCY) || 'PHP'

  return {
    key,
    date,
    account:        get(TRANSACTIONS_COLUMNS.ACCOUNT),
    amount,
    resolvedAmount,
    currency,
    targetAccount:  get(TRANSACTIONS_COLUMNS.TARGET_ACCOUNT),
    type:           get(TRANSACTIONS_COLUMNS.TYPE),
    category:       get(TRANSACTIONS_COLUMNS.CATEGORY),
    subcategory:    get(TRANSACTIONS_COLUMNS.SUBCATEGORY),
    note:           get(TRANSACTIONS_COLUMNS.NOTE),
    determined:     isDetermined(currency, resolvedAmount),
    phpValue:       resolvePHP(amount, currency, resolvedAmount, fxMap),
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
    // --- Authentication: verify Supabase JWT (same pattern as accounts-balances) ---
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

    // Admin client for Vault decryption and user_sheets lookup.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false },
    })

    // --- Look up the user's connected sheet (same pattern as accounts-balances) ---
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

    // --- Fetch ALL transactions and currency rates (no filtering) ---
    const sheetId = userSheet.sheet_id
    const fetchSheet = (range: string) =>
      fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

    const [transactionsRes, currencyRes] = await Promise.all([
      fetchSheet('Transactions!A:L'),
      fetchSheet('Currency!A:B'),
    ])
    if (!transactionsRes.ok || !currencyRes.ok) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    }

    const transactionValues = ((await transactionsRes.json()) as { values?: string[][] }).values ?? []
    const currencyValues     = ((await currencyRes.json()) as { values?: string[][] }).values ?? []

    if (transactionValues.length === 0) {
      return Response.json([], { status: 200, headers: cors })
    }

    // --- Build FX map from the Currency sheet (per-row enrichment, not filtering) ---
    const fxMap = currencyValues.length > 0
      ? buildFxMap(currencyValues.slice(1), buildHeaderMap(currencyValues[0]))
      : { PHP: 1 }

    // --- Map every transaction row; drop only blank/incomplete rows ---
    const headerMap = buildHeaderMap(transactionValues[0])

    const transactions: RawTransaction[] = transactionValues
      .slice(1)
      .map((row) => mapRowToTransaction(row, headerMap, fxMap))
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
