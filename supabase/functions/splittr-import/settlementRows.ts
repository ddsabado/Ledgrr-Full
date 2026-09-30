import { settlementsForMember } from '../_shared/splittrSettlement.ts'
import type { Group } from './validateGroup.ts'

export type SelectedExpense = { expenseId: string; account: string | null; category: string | null; subcategory: string; budget: string }
export type SheetWrite = { range: string; majorDimension: string; values: string[][] }

type Metadata = { date: string; account: string; category: string; subcategory: string; budget: string }

/** Builds all import rows from the same simplified settlement graph shown in the UI. */
export function buildSplittrImportRows({
  group, memberId, selected, settledAccount, debtRow, transactionRow,
}: {
  group: Group
  memberId: string
  selected: SelectedExpense[]
  settledAccount: string | null
  debtRow: number
  transactionRow: number
}): SheetWrite[] {
  const byId = new Map(group.expenses.map((expense) => [expense.id, expense]))
  const data: SheetWrite[] = []
  let drRow = debtRow
  let txRow = transactionRow
  let settlementMetadata: Metadata | undefined

  for (const item of selected) {
    const expense = byId.get(item.expenseId)!
    if (expense.paidByMemberId !== memberId) continue
    const otherTotal = expense.shares.filter((share) => share.memberId !== memberId).reduce((sum, share) => sum + share.amount, 0)
    const metadata = { date: expense.date, account: item.account!, category: item.category!, subcategory: item.subcategory, budget: item.budget }
    settlementMetadata ??= metadata
    data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[expense.date, metadata.account, expense.amount.toFixed(2), '', group.baseCurrency, '', 'Expense', metadata.category, metadata.subcategory, metadata.budget, `Splittr import: ${group.name}`]] })
    txRow++
    if (otherTotal > 0) {
      data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[expense.date, metadata.account, (-otherTotal).toFixed(2), '', group.baseCurrency, '', 'Split Offset', metadata.category, metadata.subcategory, metadata.budget, `Splittr offset: ${group.name}`]] })
      txRow++
    }
  }

  const selectedExpenses = selected.map((item) => byId.get(item.expenseId)!)
  const fallback = selectedExpenses[0]
  const details = settlementMetadata ?? {
    date: fallback.date,
    account: '',
    category: '',
    subcategory: '',
    budget: '',
  }
  const member = group.members.find((candidate) => candidate.id === memberId)!
  for (const settlement of settlementsForMember(group.members, selectedExpenses, memberId)) {
    const counterpartyId = settlement.fromMemberId === memberId ? settlement.toMemberId : settlement.fromMemberId
    const counterparty = group.members.find((candidate) => candidate.id === counterpartyId)!
    const direction = settlement.toMemberId === memberId ? 'Receivable' : 'Payable'
    const shares = direction === 'Receivable' ? [0, settlement.amount] : [settlement.amount, 0]
    const paid = settledAccount ? `${direction === 'Receivable' ? counterparty.name : member.name}:${settlement.amount.toFixed(2)}:${group.baseCurrency}` : ''
    const status = settledAccount ? 'Settled' : 'Pending'
    data.push({ range: `Debts and Receivables!A${drRow}:N${drRow++}`, majorDimension: 'ROWS', values: [[`Splittr: ${group.name} — ${counterparty.name}`, direction === 'Receivable' ? details.account : '', details.date, settlement.amount.toFixed(2), `${member.name};${counterparty.name}`, 'Exact', shares.map((share) => share.toFixed(2)).join(';'), details.category, details.subcategory, paid, status, direction, group.baseCurrency, '']] })
    if (settledAccount) {
      const type = direction === 'Receivable' ? 'Income' : 'Expense'
      const category = direction === 'Receivable' ? 'Receivables' : 'Payables'
      const note = direction === 'Receivable' ? `Splittr receipt from ${counterparty.name}: ${group.name}` : `Splittr payment to ${counterparty.name}: ${group.name}`
      data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[details.date, settledAccount, settlement.amount.toFixed(2), '', group.baseCurrency, '', type, category, '', '', note]] })
      txRow++
    }
  }
  return data
}
