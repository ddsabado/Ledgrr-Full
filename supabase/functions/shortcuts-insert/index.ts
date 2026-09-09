import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// --- Inlined sheet constants ----------------------------------------------
// Deno cannot import from `src/`, so these mirror src/constants/sheets.ts.
// They MUST be kept in sync with that file (case-sensitive header strings).

/** Sheet tab names (A1-notation ranges are built from these). */
const SHEET_TABS = Object.freeze({
  TRANSACTIONS:      'Transactions',
  TXN_CATEGORIES:    'Txn_Categories',
  TXN_SUBCATEGORIES: 'Txn_Subcategories',
} as const)

/** Transactions tab column header strings (mirror of TRANSACTIONS_COLUMNS). */
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// --- Pure helpers (named exports for unit testing) -------------------------

/**
 * SHA-256 hex of a UTF-8 string, lowercase. Web Crypto, no deps.
 * Output is exactly 64 lowercase hex chars (each byte zero-padded to 2 digits).
 * Matches the operator recipe: `printf '%s' "$RAW_KEY" | openssl dgst -sha256 -hex`.
 */
export async function sha256Hex(raw: string): Promise<string> {
  const bytes  = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Result of the API-key authentication decision. Discriminated on `ok`.
 * On success carries the authenticated `userId` and matched `keyId`.
 * On failure carries the HTTP status the shell should return.
 */
export type AuthResult =
  | { ok: true;  userId: string; keyId: string }
  | { ok: false; status: 401 | 404; error: string }

/**
 * Pure decision function over already-fetched rows. Contains NO I/O.
 * The shell reads the header, hashes it, and performs the DB selects,
 * then calls this to decide the HTTP outcome.
 *   - rawKeyPresent === false      -> 401 (missing/empty X-API-Key)   (R1.2)
 *   - keyRow == null               -> 401 (hash matches no row)       (R1.4)
 *   - keyRow.revoked_at != null    -> 401 (key revoked)               (R1.5)
 *   - sheetRow == null             -> 404 (no user_sheets row)        (R1.8)
 *   - else                         -> ok, userId + keyId              (R1.6)
 */
export function decideAuth(
  rawKeyPresent: boolean,
  keyRow:   { id: string; user_id: string; revoked_at: string | null } | null,
  sheetRow: { sheet_id: string } | null,
): AuthResult {
  if (!rawKeyPresent) {
    return { ok: false, status: 401, error: 'missing api key' }
  }
  if (keyRow == null) {
    return { ok: false, status: 401, error: 'unknown api key' }
  }
  if (keyRow.revoked_at != null) {
    return { ok: false, status: 401, error: 'revoked api key' }
  }
  if (sheetRow == null) {
    return { ok: false, status: 404, error: 'no sheets access' }
  }
  return { ok: true, userId: keyRow.user_id, keyId: keyRow.id }
}

/**
 * Formats a Date as `M/D/YYYY` in local time, with NO zero-padding on the
 * month or day (e.g. `3/9/2026`, not `03/09/2026`). Year is the full 4-digit
 * year. Pure — no I/O. (R5.3)
 */
export function formatDateMDY(d: Date): string {
  const month = d.getMonth() + 1
  const day   = d.getDate()
  const year  = d.getFullYear()
  return `${month}/${day}/${year}`
}

/** Trimmed value of a sheet cell at `idx`, or '' when absent. */
function cell(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}

/**
 * Pure port of the legacy Ledgrr-Service `resolveBudget` (Code.js:717). (R7)
 * Resolves the Budget cell value for a transaction, following the Expense
 * precedence chain. Contains NO I/O; comparisons are whitespace-trimmed and
 * the returned budget is the trimmed non-empty col C value.
 *   - returns '' unless type === 'Expense'                          (R7.2)
 *   - subcategory budget: subRow col A === subcategory AND
 *     col B === category AND col C non-empty -> col C               (R7.3)
 *   - else category budget: catRow col A === category AND
 *     col C non-empty -> col C                                      (R7.4)
 *   - else ''                                                       (R7.5)
 * subRows = Txn_Subcategories!A2:C ([Subcategory, Category, Budget]).
 * catRows = Txn_Categories!A2:C   ([Category, Type, Budget]).
 */
export function resolveBudget(
  type: string,
  category: string,
  subcategory: string,
  subRows: string[][],
  catRows: string[][],
): string {
  if (type.trim() !== 'Expense') return ''

  const cat = category.trim()
  const sub = subcategory.trim()

  if (sub !== '') {
    for (const row of subRows) {
      if (cell(row, 0) === sub && cell(row, 1) === cat) {
        const budget = cell(row, 2)
        if (budget !== '') return budget
        break
      }
    }
  }

  for (const row of catRows) {
    if (cell(row, 0) === cat) {
      const budget = cell(row, 2)
      if (budget !== '') return budget
      break
    }
  }

  return ''
}

/**
 * Result of validating an incoming `resolved_amount`. Discriminated on `ok`.
 * On success carries the value to write into the Resolved Amount slot: either
 * '' (base currency / absent) or a positive finite number. On failure carries
 * an error string; the shell maps this to a 400 with NO append. (R8)
 */
export type ResolvedAmountResult =
  | { ok: true;  value: string | number } // '' or a positive finite number
  | { ok: false; error: string }

/**
 * Pure port of the legacy Ledgrr-Service `validateResolvedAmount_`. (R8)
 * Precedence (checked in this exact order):
 *   1. absent/empty/null/undefined -> { ok:true, value:'' }         (R8.1)
 *      ('' after String(x).trim() === '' counts as absent)
 *   2. currency === 'PHP' (trimmed, base currency) -> { ok:true, value:'' }
 *      (any supplied amount is ignored)                             (R8.2)
 *   3. non-PHP & provided: parse via Number(); if positive finite
 *      (> 0 and Number.isFinite) -> { ok:true, value:<number> }     (R8.3)
 *   4. non-PHP & provided but not positive finite -> { ok:false }   (R8.4)
 *
 * NOTE: matches legacy behavior exactly — uses `Number(resolvedAmount)` with
 * NO comma stripping, so a string like '18,000' becomes NaN and fails (R8.4).
 * Pure — no I/O.
 */
export function validateResolvedAmount(
  resolvedAmount: string | number | null | undefined,
  currency: string,
): ResolvedAmountResult {
  // 1. absent/empty/null/undefined -> ''
  if (resolvedAmount == null || String(resolvedAmount).trim() === '') {
    return { ok: true, value: '' }
  }

  // 2. base currency PHP -> ignore any supplied amount, write ''
  if (currency.trim() === 'PHP') {
    return { ok: true, value: '' }
  }

  // 3/4. non-PHP & provided: must be a positive finite number (no comma strip)
  const parsed = Number(resolvedAmount)
  if (Number.isFinite(parsed) && parsed > 0) {
    return { ok: true, value: parsed }
  }

  return { ok: false, error: 'invalid resolved amount' }
}

/**
 * Incoming insert request body. All fields optional. (R5)
 * `date` defaults to today (M/D/YYYY) when absent/empty; `currency` defaults
 * to 'PHP' when absent/empty. No `sheet_id` field is honored (R5.2) — it is
 * never read by `buildInsertRow`.
 */
export interface InsertBody {
  date?:            string
  account?:         string
  amount?:          string | number
  currency?:        string
  target_account?:  string
  type?:            string
  category?:        string
  subcategory?:     string
  note?:            string
  resolved_amount?: string | number | null
}

/** Stringifies a body field: '' when absent/null/undefined, else String(v). */
function str(v: string | number | null | undefined): string {
  return v == null ? '' : String(v)
}

/**
 * Builds the exactly-11 B->L values for values:append. Pure — no I/O. (R5.6, R6.1)
 * Order: [Date, Account, Amount, ResolvedAmount, Currency,
 *         TargetAccount, Type, Category, Subcategory, Budget, Note].
 * Rules:
 *   - Date: body.date if non-empty, else formatDateMDY(new Date())      (R5.3)
 *   - Currency: body.currency if non-empty, else 'PHP'                  (R5.4)
 *   - Amount: String(body.amount) or '' when absent
 *   - ResolvedAmount slot: the passed `resolvedAmount` arg stringified
 *     (may be '' or a number)
 *   - Budget slot: the passed `budget` arg
 *   - Account/TargetAccount/Type/Category/Subcategory/Note: '' when absent
 * NEVER emits a col-A (Txn ID) value and NEVER reads body.sheet_id;
 * the returned array is ALWAYS exactly length 11. (R5.2, R6.1)
 */
export function buildInsertRow(
  body: InsertBody,
  budget: string,
  resolvedAmount: string | number,
): string[] {
  const date =
    body.date != null && String(body.date).trim() !== ''
      ? String(body.date)
      : formatDateMDY(new Date())

  const currency =
    body.currency != null && String(body.currency).trim() !== ''
      ? String(body.currency)
      : 'PHP'

  return [
    date,                        // B  Date
    str(body.account),           // C  Account
    str(body.amount),            // D  Amount
    str(resolvedAmount),         // E  Resolved Amount
    currency,                    // F  Currency
    str(body.target_account),    // G  Target Account
    str(body.type),              // H  Transaction Type
    str(body.category),          // I  Category
    str(body.subcategory),       // J  Subcategory
    budget,                      // K  Budget
    str(body.note),              // L  Note
  ]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const cors = { 'Access-Control-Allow-Origin': '*' }

  // Silence unused-constant lint (kept in sync with src/constants/sheets.ts).
  void TRANSACTIONS_COLUMNS

  // Only POST is accepted; anything else is a method error.
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
  }

  try {
    // --- Authentication: verify per-user API key (X-API-Key) ---
    const rawKey = req.headers.get('X-API-Key')

    const supabaseUrl         = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false },
    })

    // Look up the api_keys row by hash (only when a raw key was supplied).
    let keyRow:
      | { id: string; user_id: string; revoked_at: string | null }
      | null = null
    if (rawKey != null && rawKey.trim() !== '') {
      const hash = await sha256Hex(rawKey)
      const { data } = await supabaseAdmin
        .from('api_keys')
        .select('id, user_id, revoked_at')
        .eq('token_hash', hash)
        .maybeSingle()
      keyRow = data ?? null
    }

    // Look up the user's connected sheet only when a (non-revoked) key matched.
    let sheetRow: { sheet_id: string; refresh_token_secret_id: string } | null = null
    if (keyRow != null && keyRow.revoked_at == null) {
      const { data } = await supabaseAdmin
        .from('user_sheets')
        .select('sheet_id, refresh_token_secret_id')
        .eq('user_id', keyRow.user_id)
        .maybeSingle()
      sheetRow = data ?? null
    }

    const auth = decideAuth(
      Boolean(rawKey?.trim()),
      keyRow,
      sheetRow == null ? null : { sheet_id: sheetRow.sheet_id },
    )
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status, headers: cors })
    }

    // Fire-and-continue: stamp last_used_at (do not block on failure). (R1.9)
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', auth.keyId)
      .then(() => {}, () => {})

    // --- Parse the request body (400 on malformed JSON) ---
    let body: InsertBody
    try {
      body = (await req.json()) as InsertBody
    } catch (_e) {
      return Response.json({ error: 'Malformed JSON body' }, { status: 400, headers: cors })
    }

    // --- Validate resolved_amount before any Sheets I/O (400 on failure) ---
    const resolved = validateResolvedAmount(body.resolved_amount, body.currency ?? 'PHP')
    if (!resolved.ok) {
      return Response.json({ error: resolved.error }, { status: 400, headers: cors })
    }

    // sheet_id resolves ONLY from user_sheets; any body.sheet_id is ignored. (R5.2)
    const sheetId = sheetRow!.sheet_id

    // --- Retrieve the Google refresh token from Supabase Vault ---
    const { data: refreshToken, error: vaultError } = await supabaseAdmin.rpc(
      'decrypt_vault_secret', { p_id: sheetRow!.refresh_token_secret_id }
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

    // --- Read budget lookup ranges + the Date column (to find the next empty
    //     row) in a single batchGet. Column B (Date) is the table's spine; its
    //     populated length tells us where to write next. ---
    const subRange  = `${SHEET_TABS.TXN_SUBCATEGORIES}!A2:C`
    const catRange  = `${SHEET_TABS.TXN_CATEGORIES}!A2:C`
    const dateRange = `${SHEET_TABS.TRANSACTIONS}!B2:B`
    const batchGetUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet` +
      `?ranges=${encodeURIComponent(subRange)}` +
      `&ranges=${encodeURIComponent(catRange)}` +
      `&ranges=${encodeURIComponent(dateRange)}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
    let batchRes: Response
    try {
      batchRes = await fetch(batchGetUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal:  controller.signal,
      })
    } catch (_e) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    } finally {
      clearTimeout(timeout)
    }
    if (!batchRes.ok) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    }

    const batch = (await batchRes.json()) as { valueRanges?: { values?: string[][] }[] }
    const ranges = batch.valueRanges ?? []
    const subRows:  string[][] = ranges[0]?.values ?? []
    const catRows:  string[][] = ranges[1]?.values ?? []
    const dateRows: string[][] = ranges[2]?.values ?? []

    // --- Resolve budget + build the exactly-11 B->L row ---
    const budget = resolveBudget(
      body.type ?? '',
      body.category ?? '',
      body.subcategory ?? '',
      subRows,
      catRows,
    )
    const row = buildInsertRow(body, budget, resolved.value)

    // --- Compute the next empty row from the Date column's populated length. ---
    // dateRows are B2..Bn (data rows, header excluded), so the next free sheet
    // row is 2 + dateRows.length. We write B{n}:L{n} with values:update — NOT
    // values:append. `append` treats the range as a table locator and writes
    // from the table's first column (A), which would clobber the Txn ID spill
    // formula and shift every value one cell left. A targeted update at an
    // explicit B:L range guarantees correct column placement and never touches
    // column A, letting the SEQUENCE formula assign the new Txn ID.
    const nextRow    = 2 + dateRows.length
    const writeRange = `${SHEET_TABS.TRANSACTIONS}!B${nextRow}:L${nextRow}`
    const updateUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
      `/values/${encodeURIComponent(writeRange)}` +
      `?valueInputOption=USER_ENTERED`

    const updateRes = await fetch(updateUrl, {
      method:  'PUT',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range:          writeRange,
        majorDimension: 'ROWS',
        values:         [row],
      }),
    })
    if (!updateRes.ok) {
      return Response.json({ error: 'Failed to write row' }, { status: 502, headers: cors })
    }

    return Response.json({ ok: true }, { status: 201, headers: cors })

  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
