import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getSheetContext, sheetHeaders, SheetContextError } from '../_shared/sheetContext.ts'

/**
 * Command endpoint for creating a recurring payment.
 * Authenticates once and writes one Recurring Payments row with an explicit
 * range, while enforcing the case-sensitive name idempotency rule server-side.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
interface RecurringInput {
  name: string; account: string; amount: number; frequency: string; startDate: string; endDate: string
  category: string; subcategory: string; currency: string
}
const response = (body: unknown, status: number) => Response.json(body, { status, headers: CORS_HEADERS })
const month = (value: unknown) => typeof value === 'string' && /^\d{1,2}\/\d{4}$/.test(value.trim())

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  try {
    let input: RecurringInput
    try { input = await req.json() as RecurringInput } catch { return response({ error: 'Malformed JSON body' }, 400) }
    const valid = input && typeof input.name === 'string' && input.name.trim() !== '' && typeof input.account === 'string' && input.account.trim() !== '' &&
      typeof input.currency === 'string' && input.currency.trim() !== '' && typeof input.frequency === 'string' && input.frequency.trim() !== '' &&
      typeof input.category === 'string' && input.category.trim() !== '' && month(input.startDate) && (input.endDate === '' || month(input.endDate)) &&
      Number.isFinite(input.amount) && input.amount > 0 && typeof input.subcategory === 'string'
    if (!valid) return response({ error: 'Invalid recurring payment details' }, 400)

    const { sheetId, accessToken } = await getSheetContext(req.headers.get('Authorization'))
    const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Recurring Payments!A2:A')}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) })
    if (!readRes.ok) return response({ error: 'Failed to read sheet' }, 502)
    const rows = ((await readRes.json()) as { values?: string[][] }).values ?? []
    if (rows.some((row) => row[0] === input.name.trim())) return response({ error: 'A recurring payment with this exact name already exists.' }, 409)
    const row = 2 + rows.length
    const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: 'POST', headers: sheetHeaders(accessToken), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: [{ range: `Recurring Payments!A${row}:I${row}`, majorDimension: 'ROWS', values: [[input.name.trim(), input.account.trim(), input.amount.toFixed(2), input.frequency.trim(), input.startDate.trim(), input.endDate.trim(), input.category.trim(), input.subcategory.trim(), input.currency.trim()]] }] }),
    })
    if (!writeRes.ok) return response({ error: 'Failed to write recurring payment' }, 502)
    return response({ ok: true }, 201)
  } catch (error) {
    if (error instanceof SheetContextError) return response({ error: error.message }, error.status)
    console.error('Unexpected error:', error)
    return response({ error: 'Unexpected server error' }, 500)
  }
})
