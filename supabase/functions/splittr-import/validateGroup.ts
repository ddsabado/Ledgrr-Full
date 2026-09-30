export type Member = { id: string; name: string }
export type Expense = { id: string; description: string; amount: number; currency: string; date: string; paidByMemberId: string; shares: { memberId: string; amount: number }[] }
export type Group = { id: string; name: string; members: Member[]; expenses: Expense[] }

function text(value: unknown, max = 160): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null
}
function amount(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null
}
function date(value: unknown): string {
  const valueText = text(value, 40) ?? ''
  const parsed = new Date(valueText)
  return Number.isNaN(parsed.valueOf()) ? new Date().toLocaleDateString('en-US') : `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }

/** Converts only the bounded, display-safe subset of Splittr's Group JSON. */
export function validateGroup(payload: unknown): Group | null {
  const root = object(payload); const raw = object(root?.group) ?? root
  if (!raw) return null
  const id = text(raw.id ?? raw.groupId, 120), name = text(raw.name ?? raw.title, 160)
  const members = list(raw.members ?? raw.participants).map(object).map((m) => ({ id: text(m?.id ?? m?.memberId, 120), name: text(m?.name ?? m?.displayName, 160) })).filter((m): m is Member => !!m.id && !!m.name)
  if (!id || !name || members.length < 2 || new Set(members.map((m) => m.id)).size !== members.length) return null
  const memberIds = new Set(members.map((m) => m.id))
  const expenses: Expense[] = []
  for (const value of list(raw.expenses)) {
    const e = object(value); if (!e) continue
    const expenseId = text(e.id ?? e.expenseId, 120), description = text(e.description ?? e.name ?? e.title, 160)
    // Splittr returns base values for both the expense and each split. Older exports use the fallbacks.
    const total = amount(e.baseAmount ?? e.originalAmount ?? e.amount ?? e.total ?? e.totalAmount)
    const paidBy = text(e.payerId ?? e.paidByMemberId ?? e.paidBy ?? object(e.payer)?.id, 120)
    const currency = text(e.originalCurrency ?? e.currency, 12) ?? 'PHP'
    const shares = list(e.splits ?? e.shares ?? e.split ?? e.participants).map(object).map((s) => ({ memberId: text(s?.memberId ?? s?.userId ?? s?.id ?? object(s?.member)?.id, 120), amount: amount(s?.amountBase ?? s?.amount ?? s?.share ?? s?.owed) })).filter((s): s is { memberId: string; amount: number } => !!s.memberId && !!s.amount && memberIds.has(s.memberId))
    if (!expenseId || !description || !total || !paidBy || !memberIds.has(paidBy) || !shares.length || Math.abs(shares.reduce((sum, s) => sum + s.amount, 0) - total) > 0.02) continue
    expenses.push({ id: expenseId, description, amount: total, currency, date: date(e.date ?? e.createdAt), paidByMemberId: paidBy, shares })
  }
  if (new Set(expenses.map((e) => e.id)).size !== expenses.length) return null
  return { id, name, members, expenses }
}
