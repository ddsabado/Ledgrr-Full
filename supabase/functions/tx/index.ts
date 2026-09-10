import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const READ_TIMEOUT_MS = 30_000

export interface NewInstallmentBody {
  name?: string
  totalAmount?: number
  terms?: number
  startDate?: string
  account?: string
  budget?: string
  currency?: string
  statementDay?: number
  transactionTime?: string
}

function formatDate(date: Date, time: string): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${time}`
}

function parseStartDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, month, day, year] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
    ? null
    : date
}

function dayInMonth(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), new Date(year, month + 1, 0).getDate())
}

/** Build monthly transaction rows B:L while keeping column A's sheet formula intact. */
export function buildInstallmentTransactionRows(body: Required<NewInstallmentBody>): string[][] {
  const start = parseStartDate(body.startDate)!
  const statementThisMonth = new Date(
    start.getFullYear(),
    start.getMonth(),
    dayInMonth(start.getFullYear(), start.getMonth(), body.statementDay),
  )
  // Compare calendar dates, rather than instants, so a transaction after the
  // statement day always begins in the following statement cycle.
  const firstStatement = new Date(
    statementThisMonth.getFullYear(),
    statementThisMonth.getMonth() + (start.getDate() > statementThisMonth.getDate() ? 1 : 0),
    1,
  )
  firstStatement.setDate(dayInMonth(firstStatement.getFullYear(), firstStatement.getMonth(), body.statementDay))

  const payment = body.totalAmount / body.terms
  return Array.from({ length: body.terms }, (_, index) => {
    const date = new Date(firstStatement.getFullYear(), firstStatement.getMonth() + index, 1)
    date.setDate(dayInMonth(date.getFullYear(), date.getMonth(), body.statementDay))
    return [
      formatDate(date, body.transactionTime),
      body.account,
      payment.toFixed(2),
      '',
      body.currency,
      '',
      'Expense',
      'Installment',
      '',
      body.budget,
      `${body.name} (${index + 1}/${body.terms})`,
    ]
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })

    let rawBody: NewInstallmentBody
    try {
      rawBody = await req.json() as NewInstallmentBody
    } catch {
      return Response.json({ error: 'Malformed JSON body' }, { status: 400, headers: CORS_HEADERS })
    }

    const body: Required<NewInstallmentBody> = {
      name: rawBody.name?.trim() ?? '',
      totalAmount: Number(rawBody.totalAmount),
      terms: Number(rawBody.terms),
      startDate: rawBody.startDate?.trim() ?? '',
      account: rawBody.account?.trim() ?? '',
      budget: rawBody.budget?.trim() ?? '',
      currency: rawBody.currency?.trim() || 'PHP',
      statementDay: Number(rawBody.statementDay),
      transactionTime: rawBody.transactionTime?.trim() ?? '',
    }
    if (!body.name || !body.account || !body.budget || !parseStartDate(body.startDate) ||
      !Number.isFinite(body.totalAmount) || body.totalAmount <= 0 ||
      !Number.isInteger(body.terms) || body.terms < 1 ||
      !Number.isInteger(body.statementDay) || body.statementDay < 1 || body.statementDay > 31 ||
      !/^\d{2}:\d{2}:\d{2}$/.test(body.transactionTime)) {
      return Response.json({ error: 'Invalid installment details' }, { status: 400, headers: CORS_HEADERS })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUser = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })

    const admin = createClient(supabaseUrl, supabaseServiceRole, { auth: { persistSession: false } })
    const { data: userSheet } = await admin
      .from('user_sheets')
      .select('sheet_id, refresh_token_secret_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!userSheet) return Response.json({ error: 'No sheet connected for this user' }, { status: 404, headers: CORS_HEADERS })

    const { data: refreshToken, error: vaultError } = await admin.rpc('decrypt_vault_secret', { p_id: userSheet.refresh_token_secret_id })
    if (vaultError || !refreshToken) return Response.json({ error: 'Failed to retrieve credentials' }, { status: 500, headers: CORS_HEADERS })

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }),
    })
    if (!tokenRes.ok) return Response.json({ error: 'Failed to exchange token' }, { status: 502, headers: CORS_HEADERS })
    const { access_token: accessToken } = await tokenRes.json() as { access_token: string }

    const ranges = ['Installments!A2:A', 'Transactions!B2:B']
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
    let readRes: Response
    try {
      readRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values:batchGet?${ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&')}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal },
      )
    } catch {
      return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: CORS_HEADERS })
    } finally { clearTimeout(timeout) }
    if (!readRes.ok) return Response.json({ error: 'Failed to read sheet' }, { status: 502, headers: CORS_HEADERS })
    const reads = await readRes.json() as { valueRanges?: { values?: string[][] }[] }
    const installmentNextRow = 2 + (reads.valueRanges?.[0]?.values?.length ?? 0)
    const transactionNextRow = 2 + (reads.valueRanges?.[1]?.values?.length ?? 0)
    const transactionRows = buildInstallmentTransactionRows(body)

    const installmentRange = `Installments!A${installmentNextRow}:H${installmentNextRow}`
    const transactionsRange = `Transactions!B${transactionNextRow}:L${transactionNextRow + transactionRows.length - 1}`
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values:batchUpdate`,
      {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: [
          { range: installmentRange, majorDimension: 'ROWS', values: [[body.name, body.account, body.totalAmount.toFixed(2), body.terms, (body.totalAmount / body.terms).toFixed(2), body.startDate, body.budget, body.currency]] },
          { range: transactionsRange, majorDimension: 'ROWS', values: transactionRows },
        ] }),
      },
    )
    if (!writeRes.ok) return Response.json({ error: 'Failed to write installment' }, { status: 502, headers: CORS_HEADERS })
    return Response.json({ ok: true, tx: transactionRows.length }, { status: 201, headers: CORS_HEADERS })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Unexpected server error' }, { status: 500, headers: CORS_HEADERS })
  }
})
