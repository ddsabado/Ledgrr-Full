import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sortTransactionsByDate } from '../_shared/sortTransactions.ts'
import { adjustmentTransactionRow, formatAdjustmentTimestamp, isAdjustBalanceInput, type AdjustBalanceInput } from './adjustBalance.ts'
import { adjustedCurrentBalanceFormula, currentBalanceFormula } from './formulas.ts'

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

interface NewCreditCardInput {
  name?: unknown
  creditLimit?: unknown
  initialBalance?: unknown
  currency?: unknown
  image?: unknown
  statementDay?: unknown
  dueDay?: unknown
  metadata?: unknown
}

interface ValidCreditCardInput {
  name: string
  creditLimit: number
  initialBalance: number
  currency: string
  image: string
  statementDay: number
  dueDay: number
  metadata?: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isDay(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 31
}

function isNewCreditCardInput(value: unknown): value is ValidCreditCardInput {
  if (!value || typeof value !== 'object') return false
  const input = value as NewCreditCardInput
  return typeof input.name === 'string' && input.name.trim() !== '' &&
    isFiniteNumber(input.creditLimit) && input.creditLimit >= 0 &&
    isFiniteNumber(input.initialBalance) &&
    typeof input.currency === 'string' && input.currency.trim() !== '' &&
    typeof input.image === 'string' &&
    isDay(input.statementDay) && isDay(input.dueDay) &&
    (input.metadata === undefined || typeof input.metadata === 'string')
}

/** Converts the validated UI payload to the Accounts sheet's A:K order. */
export function toAccountRow(input: ValidCreditCardInput, category: string, row: number): string[] {
  return [
    input.name.trim(), category, input.creditLimit.toFixed(2),
    input.initialBalance.toFixed(2), input.currency.trim(), '',
    input.image.trim(), String(input.statementDay), String(input.dueDay),
    currentBalanceFormula(row), input.metadata?.trim() ?? '',
  ]
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
  // UNFORMATTED_VALUE returns numbers for balances and limits. Normalize each
  // cell here so the parsing below handles both numeric and text sheet cells.
  const get    = (col: string): string => String(row[headerMap[col] ?? -1] ?? '')
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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS })
  }
  const action = new URL(req.url).searchParams.get('action')
  if (action !== null && !(req.method === 'GET' && action === 'images') && !(req.method === 'POST' && action === 'adjust-balance')) {
    return Response.json({ error: 'Unknown action' }, { status: 400, headers: CORS_HEADERS })
  }

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

    if (action === 'images') {
      const bucket = supabaseAdmin.storage.from('account_images')
      const listFolder = async (path = ''): Promise<string[]> => {
        const { data, error } = await bucket.list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
        if (error) throw new Error('Failed to list account images')
        const entries = await Promise.all((data ?? []).map((item) =>
          item.metadata ? Promise.resolve([`${path}${item.name}`]) : listFolder(`${path}${item.name}/`),
        ))
        return entries.flat()
      }
      return Response.json(await listFolder(), { status: 200, headers: CORS_HEADERS })
    }

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

    if (req.method === 'POST') {
      let input: NewCreditCardInput | AdjustBalanceInput
      try { input = await req.json() as NewCreditCardInput } catch {
        return Response.json({ error: 'Malformed JSON body' }, { status: 400, headers: cors })
      }

      if (action === 'adjust-balance') {
        if (!isAdjustBalanceInput(input)) {
          return Response.json({ error: 'Invalid balance adjustment' }, { status: 400, headers: cors })
        }
        const accountsRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/Accounts!A:K?valueRenderOption=UNFORMATTED_VALUE`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        if (!accountsRes.ok) return Response.json({ error: 'Failed to read accounts' }, { status: 502, headers: cors })
        const accountValues = ((await accountsRes.json()) as { values?: string[][] }).values ?? []
        if (accountValues.length < 2) return Response.json({ error: 'Account not found' }, { status: 404, headers: cors })

        const categoriesRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent('Account Categories!A:B')}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        if (!categoriesRes.ok) return Response.json({ error: 'Failed to read account categories' }, { status: 502, headers: cors })
        const categoryValues = ((await categoriesRes.json()) as { values?: string[][] }).values ?? []
        const categoryToType = buildCategoryTypeMap(categoryValues)
        const headerMap = buildHeaderMap(accountValues[0])
        const accountIndex = accountValues.slice(1).findIndex((row) => row[headerMap[ACCOUNTS_COLUMNS.NAME] ?? -1]?.trim() === input.accountName.trim())
        if (accountIndex === -1) return Response.json({ error: 'Account not found' }, { status: 404, headers: cors })
        const accountRow = accountValues[accountIndex + 1]
        const account = mapRowToAccount(accountRow, headerMap, categoryToType)
        if (!account) return Response.json({ error: 'Account not found' }, { status: 404, headers: cors })
        if (account.accountType.trim().toLowerCase() === 'credit') {
          return Response.json({ error: 'Credit-card balances cannot be adjusted' }, { status: 400, headers: cors })
        }
        const delta = input.targetBalance - account.currentBalance
        if (!Number.isFinite(delta) || delta === 0) {
          return Response.json({ error: 'Target balance must differ from the current balance' }, { status: 400, headers: cors })
        }

        const existingRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent('Transactions!B2:B')}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        if (!existingRes.ok) return Response.json({ error: 'Failed to read transactions' }, { status: 502, headers: cors })
        const existing = await existingRes.json() as { values?: string[][] }
        const transactionRow = 2 + (existing.values?.length ?? 0)
        const date = formatAdjustmentTimestamp(new Date())
        const accountSheetRow = accountIndex + 2
        // Install the adjustment-aware formula first. If it fails, no financial
        // row has been written; if the following append fails, this formula is
        // still equivalent until a future Adjustment row exists.
        const formulaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent(`Accounts!J${accountSheetRow}`)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[adjustedCurrentBalanceFormula(accountSheetRow)]] }),
          },
        )
        if (!formulaRes.ok) return Response.json({ error: 'Failed to update account balance formula' }, { status: 502, headers: cors })
        const adjustmentRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent(`Transactions!B${transactionRow}:L${transactionRow}`)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ majorDimension: 'ROWS', values: [adjustmentTransactionRow(date, account.name, account.currency, delta, input.targetBalance)] }),
          },
        )
        if (!adjustmentRes.ok) return Response.json({ error: 'Failed to write adjustment' }, { status: 502, headers: cors })
        let sortWarning = false
        try {
          await sortTransactionsByDate(accessToken, userSheet.sheet_id)
        } catch (error) {
          // The adjustment is already persisted and its formula is correct.
          // Return success so the client refreshes its stale balance and rows;
          // sorting is a non-financial presentation concern that can recover
          // on the next transaction write.
          console.error('Adjustment recorded but failed to sort transactions:', error)
          sortWarning = true
        }
        return Response.json({ ok: true, sortWarning }, { status: 201, headers: CORS_HEADERS })
      }

      if (!isNewCreditCardInput(input)) {
        return Response.json({ error: 'Invalid credit card details' }, { status: 400, headers: cors })
      }

      const categoriesRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent('Account Categories!A:B')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!categoriesRes.ok) return Response.json({ error: 'Failed to read account categories' }, { status: 502, headers: cors })
      const categoryValues = ((await categoriesRes.json()) as { values?: string[][] }).values ?? []
      const creditCategory = Object.entries(buildCategoryTypeMap(categoryValues)).find(([, type]) => type === 'Credit')?.[0]
      if (!creditCategory) return Response.json({ error: 'No credit-card account category is configured' }, { status: 422, headers: cors })

      const namesRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent('Accounts!A2:A')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!namesRes.ok) return Response.json({ error: 'Failed to read accounts' }, { status: 502, headers: cors })
      const { values = [] } = await namesRes.json() as { values?: string[][] }
      if (values.some((row) => row[0]?.trim() === input.name.trim())) {
        return Response.json({ error: 'An account with this name already exists' }, { status: 409, headers: cors })
      }

      const row = values.length + 2
      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent(`Accounts!A${row}:K${row}`)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ majorDimension: 'ROWS', values: [toAccountRow(input, creditCategory, row)] }),
        },
      )
      if (!writeRes.ok) return Response.json({ error: 'Failed to create credit card' }, { status: 502, headers: cors })
      return new Response(null, { status: 201, headers: CORS_HEADERS })
    }

    const accountsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/Accounts!A:K?valueRenderOption=UNFORMATTED_VALUE`,
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
