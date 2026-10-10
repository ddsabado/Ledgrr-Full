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
  ACCOUNTS:          'Accounts',
  TXN_TYPE:          'Txn_Type',
  CURRENCY:          'Currency',
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
 * Unwrapped rows for each batchGet valueRange used by shortcuts-data.
 * Column layout is documented per field (0-based indices).
 */
export interface TabValues {
  categories:    string[][] // Txn_Categories!A2:D  [Category, Type, Budget, hidden_shortcut]
  subcategories: string[][] // Txn_Subcategories!A2:C [Subcategory, Category, Budget]
  accounts:      string[][] // Accounts!A2:K         [Account, Account Category, ..., Metadata@idx10]
  types:         string[][] // Txn_Type!A2:B         [Type, hidden_shortcut]
  currencies:    string[][] // Currency!A2:A         [Currency]
}

/** The shortcuts-data HTTP 200 response object. */
export interface ShortcutsData {
  transaction_categories: Record<string, string[]>
  accounts:               Record<string, string[]>
  acct_meta:              Record<string, string>
  transactionTypes:       string[]
  currencies:             string[]
}

/**
 * True when the category row's col D (hidden_shortcut, idx 3) equals '1'
 * after trimming. (R4.2) Non-'1' values (incl. '', '0', '01', '1.0', ' 1 ')
 * are classified via `String(v).trim() === '1'`.
 */
export function isHiddenCategory(row: string[]): boolean {
  return String(row[3] ?? '').trim() === '1'
}

/**
 * True when the Txn_Type row's col B (hidden_shortcut, idx 1) equals '1'
 * after trimming. (R4) Same `String(v).trim() === '1'` rule as categories.
 */
export function isHiddenType(row: string[]): boolean {
  return String(row[1] ?? '').trim() === '1'
}

/**
 * Assembles the full shortcuts-data response object from batchGet tab values.
 * Pure — no network. (R3, R4)
 *   - transaction_categories: non-hidden category (col A) -> subcategory names
 *     (subRow col A) whose col B equals the category; [] when none.  (R3.2–3.4, R4.1–4.3)
 *   - accounts: account (col A) grouped by account category (col B).  (R3.5)
 *   - acct_meta: account (col A) -> metadata (col K, idx 10), only when non-empty. (R3.6)
 *   - transactionTypes: non-empty col-A values, excluding hidden types (col B).
 *   - currencies: non-empty col-A values.                            (R3.7, R3.8)
 */
export function buildShortcutsData(tabs: TabValues): ShortcutsData {
  const cell = (row: string[], idx: number): string => (row[idx] ?? '').trim()

  // transaction_categories (hidden categories omitted entirely).
  const transaction_categories: Record<string, string[]> = {}
  for (const row of tabs.categories) {
    if (isHiddenCategory(row)) continue
    const category = cell(row, 0)
    if (!category) continue
    const subs = tabs.subcategories
      .filter((sub) => cell(sub, 1) === category)
      .map((sub) => cell(sub, 0))
      .filter((name) => name !== '')
    transaction_categories[category] = subs
  }

  // accounts grouped by account category; acct_meta from non-empty col K.
  const accounts: Record<string, string[]> = {}
  const acct_meta: Record<string, string> = {}
  for (const row of tabs.accounts) {
    const account = cell(row, 0)
    if (!account) continue
    const group = cell(row, 1)
    if (!(group in accounts)) accounts[group] = []
    accounts[group].push(account)

    const meta = cell(row, 10)
    if (meta !== '') acct_meta[account] = meta
  }

  // transactionTypes: non-empty col-A values, excluding hidden types (col B).
  const transactionTypes = tabs.types
    .filter((row) => !isHiddenType(row))
    .map((row) => cell(row, 0))
    .filter((v) => v !== '')
  // currencies: non-empty col-A values.
  const currencies = tabs.currencies.map((row) => cell(row, 0)).filter((v) => v !== '')

  return { transaction_categories, accounts, acct_meta, transactionTypes, currencies }
}

/** The five reference-data ranges read in a single batchGet, in request order. */
const BATCH_GET_RANGES = [
  `${SHEET_TABS.TXN_CATEGORIES}!A2:D`,    // categories    [Category, Type, Budget, hidden_shortcut]
  `${SHEET_TABS.TXN_SUBCATEGORIES}!A2:C`, // subcategories [Subcategory, Category, Budget]
  `${SHEET_TABS.ACCOUNTS}!A2:K`,          // accounts      [Account, Account Category, ..., Metadata@10]
  `${SHEET_TABS.TXN_TYPE}!A2:B`,          // types         [Type, hidden_shortcut]
  `${SHEET_TABS.CURRENCY}!A2:A`,          // currencies    [Currency]
] as const

// TRANSACTIONS_COLUMNS is retained for parity with the other functions and to
// keep the inlined sheet constants complete; shortcuts-data reads reference
// tabs only and does not index Transactions columns directly.
void TRANSACTIONS_COLUMNS

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const cors = { 'Access-Control-Allow-Origin': '*' }

  // Read-only reference-data endpoint: only GET is accepted.
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
  }

  try {
    // --- Authentication: hashed API key in X-API-Key header ---
    const rawKey = req.headers.get('X-API-Key') ?? ''

    const supabaseUrl         = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false },
    })

    // Only look up the key when a non-empty header is present. Never log the
    // raw key or its hash.
    const rawKeyPresent = Boolean(rawKey && rawKey.trim())

    let keyRow: { id: string; user_id: string; revoked_at: string | null } | null = null
    let sheetRow: { sheet_id: string; refresh_token_secret_id: string } | null = null

    if (rawKeyPresent) {
      const hash = await sha256Hex(rawKey)
      const { data: keyData } = await supabaseAdmin
        .from('api_keys')
        .select('id, user_id, revoked_at')
        .eq('token_hash', hash)
        .maybeSingle()
      keyRow = keyData ?? null

      if (keyRow) {
        const { data: sheetData } = await supabaseAdmin
          .from('user_sheets')
          .select('sheet_id, refresh_token_secret_id')
          .eq('user_id', keyRow.user_id)
          .maybeSingle()
        sheetRow = sheetData ?? null
      }
    }

    const auth = decideAuth(rawKeyPresent, keyRow, sheetRow)
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status, headers: cors })
    }

    // --- Fire-and-continue: bump last_used_at; do not block on failure ---
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', auth.keyId)
      .then(() => {}, () => {})

    // sheetRow is guaranteed non-null here (decideAuth returned ok).
    const { sheet_id: sheetId, refresh_token_secret_id: refreshTokenSecretId } = sheetRow!

    // --- Retrieve the Google refresh token from Supabase Vault ---
    const { data: refreshToken, error: vaultError } = await supabaseAdmin.rpc(
      'decrypt_vault_secret', { p_id: refreshTokenSecretId }
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

    // --- Single batchGet for all reference ranges, under READ_TIMEOUT_MS ---
    const rangesQuery = BATCH_GET_RANGES
      .map((range) => `ranges=${encodeURIComponent(range)}`)
      .join('&')
    const batchGetUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${rangesQuery}`

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

    // --- Unwrap valueRanges (preserves request order) into TabValues ---
    const { valueRanges = [] } = (await batchRes.json()) as {
      valueRanges?: { values?: string[][] }[]
    }
    const at = (i: number): string[][] => valueRanges[i]?.values ?? []
    const tabs: TabValues = {
      categories:    at(0),
      subcategories: at(1),
      accounts:      at(2),
      types:         at(3),
      currencies:    at(4),
    }

    const result = buildShortcutsData(tabs)
    return Response.json(result, { status: 200, headers: cors })

  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
