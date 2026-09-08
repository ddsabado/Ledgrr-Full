import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ACCOUNTS_COLUMNS = Object.freeze({
  NAME:            'Account',
  CATEGORY:        'Account Category',
  CREDIT_LIMIT:    'Credit Limit',
  INITIAL_BALANCE: 'Init Balance',
  CURRENCY:        'Account Currency',
  BALANCE_PHP:     'Balance (PHP)',
  IMAGE:           'Image',
  STATEMENT_DAY:   'Statement Day',
  DUE_DAY:         'Due Day',
  CURRENT_BALANCE: 'Current Balance',
  METADATA:        'Metadata',
} as const)

/**
 * Raw account row as returned by this function.
 * phpEquivalent is NOT computed here — the frontend derives it
 * by combining this data with the /functions/v1/currencies response.
 */
interface RawAccountBalance {
  name:           string
  category:       string
  currency:       string        // ISO code: "PHP", "USD", "TWD", etc.
  currentBalance: number        // Native currency amount — sheet column J
  initialBalance: number        // Sheet column D
  creditLimit:    number        // 0 when empty or non-numeric
  statementDay:   number | null // null when empty or non-integer
  dueDay:         number | null // null when empty or non-integer
  image:          string        // filename in the account_images bucket; '' when unset
  accountType:    string        // looked up from Account Categories sheet; '' when unmapped
}

export function buildHeaderMap(headers: string[]): Record<string, number> {
  return headers.reduce((map, header, index) => {
    map[header.trim()] = index
    return map
  }, {} as Record<string, number>)
}

export function mapRowToAccount(
  row:            string[],
  headerMap:      Record<string, number>,
  categoryToType: Record<string, string> = {}
): RawAccountBalance | null {
  const get    = (col: string): string => row[headerMap[col] ?? -1] ?? ''
  const getNum = (col: string): number => parseFloat(get(col).replace(/,/g, '')) || 0
  const getNullableInt = (col: string): number | null => {
    const raw = get(col).replace(/,/g, '')
    const n   = parseInt(raw, 10)
    return raw && !isNaN(n) ? n : null
  }

  const name = get(ACCOUNTS_COLUMNS.NAME)
  if (!name) return null

  return {
    name,
    category:       get(ACCOUNTS_COLUMNS.CATEGORY),
    currency:       get(ACCOUNTS_COLUMNS.CURRENCY) || 'PHP',
    currentBalance: getNum(ACCOUNTS_COLUMNS.CURRENT_BALANCE),
    initialBalance: getNum(ACCOUNTS_COLUMNS.INITIAL_BALANCE),
    creditLimit:    getNum(ACCOUNTS_COLUMNS.CREDIT_LIMIT),
    statementDay:   getNullableInt(ACCOUNTS_COLUMNS.STATEMENT_DAY),
    dueDay:         getNullableInt(ACCOUNTS_COLUMNS.DUE_DAY),
    image:          get(ACCOUNTS_COLUMNS.IMAGE).trim(),
    accountType:    categoryToType[get(ACCOUNTS_COLUMNS.CATEGORY).trim()] ?? '',
  }
}

/** Builds a category -> Account Type map from the Account Categories sheet. */
export function buildCategoryTypeMap(values: string[][]): Record<string, string> {
  if (!values || values.length === 0) return {}
  const headerMap = buildHeaderMap(values[0])
  const catIdx  = headerMap['Account Category'] ?? headerMap['Category'] ?? 0
  const typeIdx = headerMap['Account Type'] ?? headerMap['Type'] ?? 1
  const map: Record<string, string> = {}
  for (const row of values.slice(1)) {
    const cat = (row[catIdx] ?? '').trim()
    if (cat) map[cat] = (row[typeIdx] ?? '').trim()
  }
  return map
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

    const accountsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/Accounts!A:K`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!accountsRes.ok) {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: cors })
    }

    const accountValues = ((await accountsRes.json()) as { values?: string[][] }).values ?? []

    if (accountValues.length === 0) return Response.json([], { status: 200, headers: cors })

    // Read the Account Categories lookup to enrich each account with its type.
    // A failure/empty result yields an empty map (blank accountType) — never
    // fails the function or drops accounts.
    let categoryToType: Record<string, string> = {}
    try {
      const catRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent('Account Categories!A:B')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (catRes.ok) {
        const catValues = ((await catRes.json()) as { values?: string[][] }).values ?? []
        categoryToType = buildCategoryTypeMap(catValues)
      }
    } catch (_e) {
      categoryToType = {}
    }

    const headerMap = buildHeaderMap(accountValues[0])

    const accounts: RawAccountBalance[] = accountValues
      .slice(1)
      .map((row) => mapRowToAccount(row, headerMap, categoryToType))
      .filter((acc): acc is RawAccountBalance => acc !== null)

    return Response.json(accounts, { status: 200, headers: cors })

  } catch (err) {
    console.error('Unexpected error:', err)
    return Response.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
