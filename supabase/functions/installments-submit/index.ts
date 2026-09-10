import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getSheetContext, sheetHeaders, SheetContextError } from '../_shared/sheetContext.ts'

/**
 * Command endpoint for creating an installment.
 * Authenticates once and atomically writes the Installments row plus its
 * scheduled Transactions rows in one Google Sheets batchUpdate request.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InstallmentInput {
  name: string; totalAmount: number; terms: number; startDate: string; account: string
  budget: string; currency: string; statementDay: number; transactionTime: string
}

function parseDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]))
  return date.getFullYear() === Number(match[3]) && date.getMonth() === Number(match[1]) - 1 && date.getDate() === Number(match[2]) ? date : null
}

function dayInMonth(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), new Date(year, month + 1, 0).getDate())
}

function transactionRows(input: InstallmentInput): string[][] {
  const start = parseDate(input.startDate)!
  const statement = new Date(start.getFullYear(), start.getMonth(), dayInMonth(start.getFullYear(), start.getMonth(), input.statementDay))
  const first = new Date(start.getFullYear(), start.getMonth() + (start.getDate() > statement.getDate() ? 1 : 0), 1)
  first.setDate(dayInMonth(first.getFullYear(), first.getMonth(), input.statementDay))
  const amount = input.totalAmount / input.terms
  return Array.from({ length: input.terms }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth() + index, 1)
    date.setDate(dayInMonth(date.getFullYear(), date.getMonth(), input.statementDay))
    return [
      `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${input.transactionTime}`,
      input.account, amount.toFixed(2), '', input.currency, '', 'Expense', 'Installment', '', input.budget,
      `${input.name} (${index + 1}/${input.terms})`,
    ]
  })
}

const response = (body: unknown, status: number) => Response.json(body, { status, headers: CORS_HEADERS })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  try {
    let input: InstallmentInput
    try { input = await req.json() as InstallmentInput } catch { return response({ error: 'Malformed JSON body' }, 400) }
    const valid = input && typeof input.name === 'string' && input.name.trim() !== '' && typeof input.account === 'string' && input.account.trim() !== '' &&
      typeof input.budget === 'string' && input.budget.trim() !== '' && typeof input.currency === 'string' && input.currency.trim() !== '' &&
      parseDate(input.startDate) !== null && Number.isFinite(input.totalAmount) && input.totalAmount > 0 && Number.isInteger(input.terms) && input.terms >= 1 &&
      Number.isInteger(input.statementDay) && input.statementDay >= 1 && input.statementDay <= 31 && /^\d{2}:\d{2}:\d{2}$/.test(input.transactionTime)
    if (!valid) return response({ error: 'Invalid installment details' }, 400)

    const { sheetId, accessToken } = await getSheetContext(req.headers.get('Authorization'))
    const ranges = ['Installments!A2:B', 'Transactions!B2:B']
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&')}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) },
    )
    if (!readRes.ok) return response({ error: 'Failed to read sheet' }, 502)
    const read = await readRes.json() as { valueRanges?: { values?: string[][] }[] }
    const installmentRows = read.valueRanges?.[0]?.values ?? []
    const firstInstallmentRow = 2 + installmentRows.length
    if (installmentRows.some((row) => row[0] === input.name.trim() && row[1] === input.account.trim())) {
      return response({ error: 'An installment with this exact name and account already exists.' }, 409)
    }
    const firstTransactionRow = 2 + (read.valueRanges?.[1]?.values?.length ?? 0)
    const txRows = transactionRows(input)
    const data = [
      { range: `Installments!A${firstInstallmentRow}:H${firstInstallmentRow}`, majorDimension: 'ROWS', values: [[input.name.trim(), input.account.trim(), input.totalAmount.toFixed(2), input.terms, (input.totalAmount / input.terms).toFixed(2), input.startDate.trim(), input.budget.trim(), input.currency.trim()]] },
      { range: `Transactions!B${firstTransactionRow}:L${firstTransactionRow + txRows.length - 1}`, majorDimension: 'ROWS', values: txRows },
    ]
    const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: 'POST', headers: sheetHeaders(accessToken), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    })
    if (!writeRes.ok) return response({ error: 'Failed to write installment' }, 502)
    return response({ ok: true, tx: txRows.length }, 201)
  } catch (error) {
    if (error instanceof SheetContextError) return response({ error: error.message }, error.status)
    console.error('Unexpected error:', error)
    return response({ error: 'Unexpected server error' }, 500)
  }
})
