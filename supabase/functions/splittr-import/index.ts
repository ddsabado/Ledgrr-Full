import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getSheetContext, sheetHeaders, SheetContextError } from '../_shared/sheetContext.ts'
import { sortTransactionsByDate } from '../_shared/sortTransactions.ts'
import { validateGroup as parseGroup, type Group } from './validateGroup.ts'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const API_ORIGIN = 'https://ddsabado-splittr.vercel.app'
const FETCH_TIMEOUT_MS = 10_000
const MAX_SPLITTR_RESPONSE_BYTES = 1_000_000
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS })

function text(value: unknown, max = 160): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null
}
function date(value: unknown): string {
  const valueText = text(value, 40) ?? ''
  const parsed = new Date(valueText)
  return Number.isNaN(parsed.valueOf()) ? new Date().toLocaleDateString('en-US') : `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}
/** Accept only a URL on the known public site, or an opaque share token. */
function shareToken(value: unknown): string | null {
  const raw = text(value, 512)
  if (!raw) return null
  if (/^[A-Za-z0-9_-]{20,40}$/.test(raw)) return raw
  try {
    const url = new URL(raw)
    if (url.origin !== API_ORIGIN) return null
    const match = url.pathname.match(/(?:group-shares|groups?\/share)\/([A-Za-z0-9_-]{20,40})\/?$/)
    return match?.[1] ?? null
  } catch { return null }
}
function object(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }
export function validateGroup(payload: unknown): Group | null { return parseGroup(payload) }
async function fetchGroup(share: unknown): Promise<Group | Response> {
  const token = shareToken(share); if (!token) return json({ error: 'Enter a valid Splittr share URL or token.' }, 400)
  let response: Response
  try { response = await fetch(`${API_ORIGIN}/api/group-shares/${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json' } }) }
  catch { return json({ error: 'Splittr is unavailable. Please try again.' }, 502) }
  if (response.status === 404) {
    const payload = await response.json().catch(() => null) as { code?: unknown } | null
    const code = payload?.code === 'GROUP_CACHE_UNAVAILABLE' ? 'GROUP_CACHE_UNAVAILABLE' : 'SHARE_LINK_UNAVAILABLE'
    return json({ error: code === 'GROUP_CACHE_UNAVAILABLE' ? 'Splittr group data is temporarily unavailable.' : 'That Splittr share was not found.', code }, 404)
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    return json({ error: 'Splittr is rate limiting requests. Please try again shortly.', code: 'RATE_LIMITED', retryAfter: retryAfter && /^\d{1,4}$/.test(retryAfter) ? Number(retryAfter) : undefined }, 429)
  }
  if (!response.ok) return json({ error: 'Splittr could not provide this group.' }, 502)
  const declaredLength = Number(response.headers.get('Content-Length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SPLITTR_RESPONSE_BYTES) return json({ error: 'Splittr returned too much data.' }, 502)
  const reader = response.body?.getReader()
  if (!reader) return json({ error: 'Splittr returned an empty response.' }, 502)
  const chunks: Uint8Array[] = []; let received = 0
  while (true) {
    const next = await reader.read(); if (next.done) break
    received += next.value.byteLength
    if (received > MAX_SPLITTR_RESPONSE_BYTES) { await reader.cancel(); return json({ error: 'Splittr returned too much data.' }, 502) }
    chunks.push(next.value)
  }
  const bytes = new Uint8Array(received); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const payload = (() => { try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown } catch { return null } })()
  const group = validateGroup(payload)
  return group ?? json({ error: 'Splittr returned an unsupported group.' }, 422)
}
async function userId(authHeader: string | null): Promise<string | Response> {
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error } = await client.auth.getUser()
  return error || !user ? json({ error: 'Unauthorized' }, 401) : user.id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const body = await req.json() as Record<string, unknown>
    const groupOrResponse = await fetchGroup(body.share)
    if (groupOrResponse instanceof Response) return groupOrResponse
    const group = groupOrResponse
    const caller = await userId(req.headers.get('Authorization')); if (caller instanceof Response) return caller
    if (body.action === 'preview') {
      return json({ group })
    }
    if (body.action !== 'import') return json({ error: 'Invalid action' }, 400)
    const memberId = text(body.memberId, 120); const requested = list(body.expenses)
    if (!memberId || !group.members.some((m) => m.id === memberId) || requested.length === 0 || requested.length > 100) return json({ error: 'Select a member and at least one expense.' }, 400)
    if (text(body.groupId, 120) !== group.id) return json({ error: 'The selected group no longer matches this share link.' }, 400)
    const selected = requested.map(object).map((value) => ({ expenseId: text(value?.expenseId, 120), account: text(value?.account, 160), category: text(value?.category, 160), subcategory: text(value?.subcategory, 160) ?? '', budget: text(value?.budget, 160) ?? '' }))
    const settledAccount = text(body.settledAccount, 160)
    if (selected.some((v) => !v.expenseId) || new Set(selected.map((v) => v.expenseId)).size !== selected.length) return json({ error: 'Selected expenses are invalid.' }, 400)
    const byId = new Map(group.expenses.map((expense) => [expense.id, expense]))
    if (selected.some((s) => !byId.get(s.expenseId))) return json({ error: 'An expense no longer exists in this group.' }, 400)
    if (selected.some((s) => byId.get(s.expenseId)?.paidByMemberId === memberId && (!s.account || !s.category))) return json({ error: 'Every expense paid by the selected member needs an account and category.' }, 400)
    const context = await getSheetContext(req.headers.get('Authorization'))
    const read = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${context.sheetId}/values:batchGet?ranges=${encodeURIComponent('Debts and Receivables!A2:A')}&ranges=${encodeURIComponent('Transactions!B2:B')}`, { headers: { Authorization: `Bearer ${context.accessToken}` }, signal: AbortSignal.timeout(30_000) })
    if (!read.ok) return json({ error: 'Failed to read finance sheet.' }, 502)
    const values = await read.json() as { valueRanges?: { values?: string[][] }[] }; let drRow = 2 + (values.valueRanges?.[0]?.values?.length ?? 0); let txRow = 2 + (values.valueRanges?.[1]?.values?.length ?? 0)
    const data: Array<{ range: string; majorDimension: string; values: string[][] }> = []
    const member = group.members.find((m) => m.id === memberId)!
    const balances = new Map<string, number>()
    const metadata = new Map<string, { date: string; account: string; category: string; subcategory: string; budget: string }>()
    for (const item of selected) {
      const expense = byId.get(item.expenseId)!; const myShare = expense.shares.find((share) => share.memberId === memberId)?.amount ?? 0
      if (expense.paidByMemberId === memberId) {
        const otherTotal = expense.shares.filter((share) => share.memberId !== memberId).reduce((sum, share) => sum + share.amount, 0)
        data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[expense.date, item.account!, expense.amount.toFixed(2), '', group.baseCurrency, '', 'Expense', item.category!, item.subcategory, item.budget, `Splittr import: ${group.name}`]] }); txRow++
        if (otherTotal > 0) { data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[expense.date, item.account!, (-otherTotal).toFixed(2), '', group.baseCurrency, '', 'Split Offset', item.category!, item.subcategory, item.budget, `Splittr offset: ${group.name}`]] }); txRow++ }
        for (const share of expense.shares.filter((share) => share.memberId !== memberId && share.amount > 0)) balances.set(share.memberId, (balances.get(share.memberId) ?? 0) + share.amount)
      } else if (myShare > 0) {
        balances.set(expense.paidByMemberId, (balances.get(expense.paidByMemberId) ?? 0) - myShare)
      }
      for (const share of expense.shares) if (share.memberId !== memberId && !metadata.has(share.memberId)) metadata.set(share.memberId, { date: expense.date, account: item.account!, category: item.category!, subcategory: item.subcategory, budget: item.budget })
    }
    for (const [counterpartyId, balance] of balances) {
      if (Math.abs(balance) < 0.005) continue
      const counterparty = group.members.find((m) => m.id === counterpartyId)!; const details = metadata.get(counterpartyId)!
      const direction = balance > 0 ? 'Receivable' : 'Payable'; const amount = Math.abs(balance)
      const shares = direction === 'Receivable' ? [0, amount] : [amount, 0]
      const paid = settledAccount ? `${direction === 'Receivable' ? counterparty.name : member.name}:${amount.toFixed(2)}:${group.baseCurrency}` : ''
      const status = settledAccount ? 'Settled' : 'Pending'
      data.push({ range: `Debts and Receivables!A${drRow}:N${drRow++}`, majorDimension: 'ROWS', values: [[`Splittr: ${group.name} — ${counterparty.name}`, direction === 'Receivable' ? details.account : '', details.date, amount.toFixed(2), `${member.name};${counterparty.name}`, 'Exact', shares.map((share) => share.toFixed(2)).join(';'), details.category, details.subcategory, paid, status, direction, group.baseCurrency, '']] })
      if (settledAccount) { const type = direction === 'Receivable' ? 'Income' : 'Expense'; const category = direction === 'Receivable' ? 'Receivables' : 'Payables'; const note = direction === 'Receivable' ? `Splittr receipt from ${counterparty.name}: ${group.name}` : `Splittr payment to ${counterparty.name}: ${group.name}`; data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[details.date, settledAccount, amount.toFixed(2), '', group.baseCurrency, '', type, category, '', '', note]] }); txRow++ }
    }
    const write = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${context.sheetId}/values:batchUpdate`, { method: 'POST', headers: sheetHeaders(context.accessToken), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) })
    if (!write.ok) return json({ error: 'The import was reserved but the finance sheet could not be written.' }, 502)
    await sortTransactionsByDate(context.accessToken, context.sheetId).catch(() => undefined)
    return json({ imported: selected.map((item) => item.expenseId!) }, 201)
  } catch (error) {
    if (error instanceof SheetContextError) return json({ error: error.message }, error.status)
    console.error('Splittr import failed')
    return json({ error: 'Unexpected server error' }, 500)
  }
})
