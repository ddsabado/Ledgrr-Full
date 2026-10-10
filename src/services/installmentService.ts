import { submitInstallment, submitRecurring } from '@/services/api'
import type { NewInstallmentInput, NewRecurringInput, NewTransactionInput } from '@/types/installments'

function parseStartDate(value: string): Date {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) throw new Error('Invalid installment transaction date')
  return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]))
}

function dayInMonth(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), new Date(year, month + 1, 0).getDate())
}

function formatTransactionDate(date: Date, time: string): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${time}`
}

/**
 * Creates the scheduled transaction rows for an installment. This is kept in
 * the orchestration layer so /tx remains a general Transactions-only endpoint.
 */
export function buildInstallmentTransactions(input: NewInstallmentInput): NewTransactionInput[] {
  const start = parseStartDate(input.startDate)
  const statementThisMonth = new Date(
    start.getFullYear(),
    start.getMonth(),
    dayInMonth(start.getFullYear(), start.getMonth(), input.statementDay),
  )
  const firstMonthOffset = start.getDate() > statementThisMonth.getDate() ? 1 : 0
  const firstStatement = new Date(start.getFullYear(), start.getMonth() + firstMonthOffset, 1)
  firstStatement.setDate(dayInMonth(firstStatement.getFullYear(), firstStatement.getMonth(), input.statementDay))
  const amount = input.totalAmount / input.terms

  return Array.from({ length: input.terms }, (_, index) => {
    const date = new Date(firstStatement.getFullYear(), firstStatement.getMonth() + index, 1)
    date.setDate(dayInMonth(date.getFullYear(), date.getMonth(), input.statementDay))
    return {
      date: formatTransactionDate(date, input.transactionTime),
      account: input.account,
      amount,
      currency: input.currency,
      targetAccount: '',
      type: 'Expense',
      category: 'Installment',
      subcategory: '',
      budget: input.budget,
      note: `${input.name} (${index + 1}/${input.terms})`,
    }
  })
}

/** Uses the dedicated command endpoint for one authenticated Sheets batch. */
export async function createInstallment(input: NewInstallmentInput): Promise<void> {
  await submitInstallment(input)
}

/** Uses the dedicated recurring-payment command endpoint. */
export async function createRecurring(input: NewRecurringInput): Promise<void> {
  await submitRecurring(input)
}
