import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getSheetContext, sheetHeaders, SheetContextError } from '../_shared/sheetContext.ts'
import { sortTransactionsByDate } from '../_shared/sortTransactions.ts'

/**
 * Command endpoint for creating a split bill.
 * It writes one Debts and Receivables row and, for Receivables ("I Paid"),
 * the matching Expense and Split Offset transaction rows in one Sheets batch.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Participant { name: string; share: number }
interface SplitBillInput {
  name: string; account: string; date: string; totalAmount: number; participants: Participant[]
  splitBy: 'Exact' | 'Percent'; category: string; subcategory: string; budget: string
  direction: 'Receivable' | 'Payable'; currency: string
}

interface PaymentInput {
  name: string
  date: string
  /** Original D&R row account; payment account may be different. */
  recordAccount?: string
  account: string
  direction: 'Receivable' | 'Payable'
  participantName: string
  paymentDate: string
  amount: number
  category?: string
  subcategory?: string
  budget?: string
  currency?: string
}

const response = (body: unknown, status: number) => Response.json(body, { status, headers: CORS_HEADERS })

function parseDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]))
  return date.getFullYear() === Number(match[3]) && date.getMonth() === Number(match[1]) - 1 && date.getDate() === Number(match[2]) ? date : null
}

/** Compares Sheets-rendered dates independent of zero-padding/time suffixes. */
function dateKey(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/)
  if (!match) return trimmed.toLowerCase()
  return `${match[3]}-${String(Number(match[1])).padStart(2, '0')}-${String(Number(match[2])).padStart(2, '0')}`
}

function textKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function actualShares(input: SplitBillInput): number[] {
  return input.participants.map((participant) => input.splitBy === 'Percent'
    ? Math.round(input.totalAmount * participant.share / 100 * 100) / 100
    : participant.share)
}

function transactionRows(input: SplitBillInput, shares: number[]): string[][] {
  if (input.direction !== 'Receivable') return []
  const date = input.date.trim()
  const othersTotal = input.totalAmount - shares[0]
  const rows: string[][] = [[date, input.account.trim(), input.totalAmount.toFixed(2), '', input.currency.trim(), '', 'Expense', input.category.trim(), input.subcategory.trim(), input.budget.trim(), `Split: ${input.name.trim()}`]]
  if (othersTotal > 0) rows.push([date, input.account.trim(), (-othersTotal).toFixed(2), '', input.currency.trim(), '', 'Split Offset', input.category.trim(), input.subcategory.trim(), input.budget.trim(), `Split offset: ${input.name.trim()}`])
  return rows
}

function parsePaid(raw: string): Map<string, { amount: number; currency: string }[]> {
  const paid = new Map<string, { amount: number; currency: string }[]>()
  for (const entry of raw.split(';').map((item) => item.trim()).filter(Boolean)) {
    const [name, amount, currency] = entry.split(':')
    if (!name) continue
    const list = paid.get(name) ?? []
    if (amount === undefined) list.push({ amount: Number.POSITIVE_INFINITY, currency: 'PHP' })
    else if (Number.isFinite(Number(amount))) list.push({ amount: Number(amount), currency: currency?.trim() || 'PHP' })
    paid.set(name, list)
  }
  return paid
}

function paidText(paid: Map<string, { amount: number; currency: string }[]>): string {
  return [...paid.entries()].map(([name, values]) => {
    const byCurrency = new Map<string, number>()
    for (const value of values) {
      if (!Number.isFinite(value.amount)) continue
      byCurrency.set(value.currency, (byCurrency.get(value.currency) ?? 0) + value.amount)
    }
    const serialized = [...byCurrency.entries()].map(([currency, amount]) => `${name}:${amount.toFixed(2)}:${currency}`)
    return serialized.length ? serialized.join(';') : name
  }).filter(Boolean).join(';')
}

async function handlePayment(req: Request, input: PaymentInput) {
  const valid = input && typeof input.name === 'string' && input.name.trim() !== '' &&
    typeof input.date === 'string' && input.date.trim() !== '' && typeof input.account === 'string' &&
    input.account.trim() !== '' && (input.direction === 'Receivable' || input.direction === 'Payable') &&
    typeof input.participantName === 'string' && input.participantName.trim() !== '' &&
    typeof input.paymentDate === 'string' && parseDate(input.paymentDate) !== null &&
    Number.isFinite(input.amount) && input.amount > 0
  if (!valid) return response({ error: 'Invalid payment details' }, 400)

  const { sheetId, accessToken } = await getSheetContext(req.headers.get('Authorization'))
  const ranges = ['Debts and Receivables!A2:N', 'Transactions!B2:B']
  const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&')}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) })
  if (!readRes.ok) return response({ error: 'Failed to read sheet' }, 502)
  const read = await readRes.json() as { valueRanges?: { values?: string[][] }[] }
  const drRows = read.valueRanges?.[0]?.values ?? []
  const rowIndex = drRows.findIndex((row) =>
    textKey(row[0] ?? '') === textKey(input.name) && (!input.recordAccount || textKey(row[1] ?? '') === textKey(input.recordAccount)) &&
    dateKey(row[2] ?? '') === dateKey(input.date) && textKey(row[11] ?? '') === textKey(input.direction)
  )
  if (rowIndex < 0) return response({ error: 'Debt or receivable record not found' }, 404)
  const row = drRows[rowIndex]
  const participants = (row[4] ?? '').split(';').map((item) => item.trim()).filter(Boolean)
  if (!participants.includes(input.participantName.trim())) return response({ error: 'Participant not found' }, 400)
  const shares = (row[6] ?? '').split(';').map((item) => Number(item.trim()) || 0)
  const paid = parsePaid(row[9] ?? '')
  const existing = paid.get(input.participantName.trim()) ?? []
  existing.push({ amount: input.amount, currency: input.currency?.trim() || row[12]?.trim() || 'PHP' })
  paid.set(input.participantName.trim(), existing)
  const settled = input.direction === 'Payable' || participants.slice(1).every((participant) => {
    const index = participants.indexOf(participant)
    const owed = shares[index] ?? 0
    const total = (paid.get(participant) ?? []).reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : owed), 0)
    return total >= owed
  })
  const firstTxRow = 2 + (read.valueRanges?.[1]?.values?.length ?? 0)
  const txType = input.direction === 'Payable' ? 'Expense' : 'Income'
  const txCategory = input.direction === 'Payable' ? (input.category?.trim() || row[7]?.trim() || '') : 'Receivables'
  const note = input.direction === 'Payable'
    ? `Paid ${input.participantName.trim()}: ${input.name.trim()}`
    : `Received from ${input.participantName.trim()}: ${input.name.trim()}`
  const storedSubcategory = row[8]?.trim() || ''
  const fallbackSubcategory = storedSubcategory.startsWith('splittr-expenses:v1:') ? '' : storedSubcategory
  const txRow = [input.paymentDate.trim(), input.account.trim(), Math.abs(input.amount).toFixed(2), '', input.currency?.trim() || row[12]?.trim() || 'PHP', '', txType, txCategory, input.subcategory?.trim() || fallbackSubcategory, input.budget?.trim() || '', note]
  const data: Array<{ range: string; majorDimension: string; values: string[][] }> = [
    { range: `Debts and Receivables!J${rowIndex + 2}:K${rowIndex + 2}`, majorDimension: 'ROWS', values: [[paidText(paid), settled ? 'Settled' : 'Pending']] },
    { range: `Transactions!B${firstTxRow}:L${firstTxRow}`, majorDimension: 'ROWS', values: [txRow] },
  ]
  const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, { method: 'POST', headers: sheetHeaders(accessToken), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) })
  if (!writeRes.ok) return response({ error: 'Failed to record payment' }, 502)
  try {
    await sortTransactionsByDate(accessToken, sheetId)
  } catch {
    return response({ error: 'Payment recorded but failed to sort transactions' }, 502)
  }
  return response({ ok: true, settled, tx: 1 }, 201)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  try {
    const url = new URL(req.url)
    if (url.searchParams.has('pay')) {
      let payment: PaymentInput
      try { payment = await req.json() as PaymentInput } catch { return response({ error: 'Malformed JSON body' }, 400) }
      return await handlePayment(req, payment)
    }
    let input: SplitBillInput
    try { input = await req.json() as SplitBillInput } catch { return response({ error: 'Malformed JSON body' }, 400) }
    const participants = input?.participants ?? []
    const sharesTotal = participants.reduce((sum, participant) => sum + Number(participant.share), 0)
    const expected = input?.splitBy === 'Percent' ? 100 : Number(input?.totalAmount)
    const valid = input && typeof input.name === 'string' && input.name.trim() !== '' && typeof input.account === 'string' &&
      (input.direction === 'Payable' || input.account.trim() !== '') &&
      parseDate(input.date) !== null && Number.isFinite(input.totalAmount) && input.totalAmount > 0 &&
      (input.direction === 'Receivable' || input.direction === 'Payable') && (input.splitBy === 'Exact' || input.splitBy === 'Percent') &&
      typeof input.currency === 'string' && input.currency.trim() !== '' && typeof input.category === 'string' && input.category.trim() !== '' &&
      typeof input.subcategory === 'string' && typeof input.budget === 'string' && participants.length >= 2 &&
      participants.every((participant) => typeof participant.name === 'string' && participant.name.trim() !== '' && Number.isFinite(participant.share) && participant.share > 0) &&
      Math.abs(sharesTotal - expected) <= 0.01
    if (!valid) return response({ error: 'Invalid split bill details' }, 400)

    const { sheetId, accessToken } = await getSheetContext(req.headers.get('Authorization'))
    const ranges = ['Debts and Receivables!A2:A', 'Transactions!B2:B']
    const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&')}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) })
    if (!readRes.ok) return response({ error: 'Failed to read sheet' }, 502)
    const read = await readRes.json() as { valueRanges?: { values?: string[][] }[] }
    const drRows = read.valueRanges?.[0]?.values ?? []
    const firstDrRow = 2 + drRows.length
    const firstTxRow = 2 + (read.valueRanges?.[1]?.values?.length ?? 0)
    const shares = actualShares(input)
    const participantsText = participants.map((participant) => participant.name.trim()).join(';')
    const amountsText = shares.map((share) => share.toFixed(2)).join(';')
    const data: Array<{ range: string; majorDimension: string; values: string[][] }> = [
      { range: `Debts and Receivables!A${firstDrRow}:N${firstDrRow}`, majorDimension: 'ROWS', values: [[input.name.trim(), input.account.trim(), input.date.trim(), input.totalAmount.toFixed(2), participantsText, input.splitBy, amountsText, input.category.trim(), input.subcategory.trim(), '', 'Pending', input.direction, input.currency.trim(), '']] },
    ]
    const txRows = transactionRows(input, shares)
    if (txRows.length > 0) data.push({ range: `Transactions!B${firstTxRow}:L${firstTxRow + txRows.length - 1}`, majorDimension: 'ROWS', values: txRows })
    const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, { method: 'POST', headers: sheetHeaders(accessToken), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) })
    if (!writeRes.ok) return response({ error: 'Failed to write split bill' }, 502)
    if (txRows.length > 0) {
      try {
        await sortTransactionsByDate(accessToken, sheetId)
      } catch {
        return response({ error: 'Split bill inserted but failed to sort transactions' }, 502)
      }
    }
    return response({ ok: true, tx: txRows.length }, 201)
  } catch (error) {
    if (error instanceof SheetContextError) return response({ error: error.message }, error.status)
    console.error('Unexpected error:', error)
    return response({ error: 'Unexpected server error' }, 500)
  }
})
