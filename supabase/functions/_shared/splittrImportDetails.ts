export type SplittrExpenseDetail = {
  description: string
  date: string
  amount: number
  currency: string
  paidBy: string
  splits: Array<{ member: string; amount: number }>
  items?: Array<{ description: string; splits: Array<{ member: string; amount: number }> }>
}

const PREFIX = 'splittr-expenses:v1:'

export function serializeSplittrExpenseDetails(expenses: SplittrExpenseDetail[]): string {
  return `${PREFIX}${JSON.stringify(expenses)}`
}

export function parseSplittrExpenseDetails(value: string): SplittrExpenseDetail[] | null {
  if (!value.startsWith(PREFIX)) return null
  try {
    const parsed = JSON.parse(value.slice(PREFIX.length))
    if (!Array.isArray(parsed)) return null
    return parsed.every((expense) => expense && typeof expense === 'object' && typeof expense.description === 'string' && typeof expense.date === 'string' && Number.isFinite(expense.amount) && typeof expense.currency === 'string' && typeof expense.paidBy === 'string' && Array.isArray(expense.splits) && expense.splits.every((split: unknown) => split && typeof split === 'object' && typeof (split as { member?: unknown }).member === 'string' && Number.isFinite((split as { amount?: unknown }).amount)) && (expense.items === undefined || Array.isArray(expense.items) && expense.items.every((item: unknown) => item && typeof item === 'object' && typeof (item as { description?: unknown }).description === 'string' && Array.isArray((item as { splits?: unknown }).splits)))) ? parsed as SplittrExpenseDetail[] : null
  } catch {
    return null
  }
}
