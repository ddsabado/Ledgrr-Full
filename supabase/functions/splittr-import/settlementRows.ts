import { settlementsForMember } from '../_shared/splittrSettlement.ts'
import { serializeSplittrExpenseDetails } from '../_shared/splittrImportDetails.ts'
import type { Group } from './validateGroup.ts'

export type SelectedExpense = { expenseId: string; account: string | null; category: string | null; subcategory: string; budget: string }
export type SheetWrite = { range: string; majorDimension: string; values: string[][] }

type Metadata = { date: string; account: string; category: string; subcategory: string; budget: string }
const sheetDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${Number(match[2])}/${Number(match[3])}/${match[1]}` : value
}

/** Builds all import rows from the same simplified settlement graph shown in the UI. */
export function buildSplittrImportRows({
  group, memberId, selected, settledAccount, settlementDate, debtRow, transactionRow,
}: {
  group: Group
  memberId: string
  selected: SelectedExpense[]
  settledAccount: string | null
  settlementDate: string | null
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
    data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[expense.date, metadata.account, expense.amount.toFixed(2), '', group.baseCurrency, '', 'Expense', metadata.category, metadata.subcategory, metadata.budget, `Splittr import: ${expense.description}`]] })
    txRow++
    if (otherTotal > 0) {
      data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[expense.date, metadata.account, (-otherTotal).toFixed(2), '', group.baseCurrency, '', 'Split Offset', metadata.category, metadata.subcategory, metadata.budget, `Splittr offset: ${expense.description}`]] })
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
  const settlements = settlementsForMember(group.members, selectedExpenses, memberId)
  if (settlements.length) {
    const direction = settlements[0].toMemberId === memberId ? 'Receivable' : 'Payable'
    const counterparties = settlements.map((settlement) => {
      const counterpartyId = settlement.fromMemberId === memberId ? settlement.toMemberId : settlement.fromMemberId
      return { settlement, member: group.members.find((candidate) => candidate.id === counterpartyId)! }
    })
    const total = counterparties.reduce((sum, { settlement }) => sum + settlement.amount, 0)
    const paid = settledAccount
      ? direction === 'Receivable'
        ? counterparties.map(({ settlement, member: counterparty }) => `${counterparty.name}:${settlement.amount.toFixed(2)}:${group.baseCurrency}`).join(';')
        : `${member.name}:${total.toFixed(2)}:${group.baseCurrency}`
      : ''
    const detailsPayload = serializeSplittrExpenseDetails(selectedExpenses.map((expense) => ({
      description: expense.description,
      date: expense.date,
      amount: expense.amount,
      currency: expense.currency,
      paidBy: group.members.find((candidate) => candidate.id === expense.paidByMemberId)?.name ?? expense.paidByMemberId,
      splits: expense.shares.map((share) => ({ member: group.members.find((candidate) => candidate.id === share.memberId)?.name ?? share.memberId, amount: share.amount })),
      items: expense.items?.map((item) => ({ description: item.description, splits: item.shares.map((share) => ({ member: group.members.find((candidate) => candidate.id === share.memberId)?.name ?? share.memberId, amount: share.amount })) })),
    })))
    const settlementRowDate = settledAccount ? sheetDate(settlementDate!) : details.date
    const amounts = direction === 'Receivable'
      ? [0, ...counterparties.map(({ settlement }) => settlement.amount)]
      : [total, ...counterparties.map(({ settlement }) => settlement.amount)]
    const debtAccount = settledAccount ?? (direction === 'Receivable' ? details.account : '')
    data.push({ range: `Debts and Receivables!A${drRow}:N${drRow++}`, majorDimension: 'ROWS', values: [[`Splittr: ${group.name}`, debtAccount, settlementRowDate, total.toFixed(2), `${member.name};${counterparties.map(({ member: counterparty }) => counterparty.name).join(';')}`, detailsPayload, amounts.map((amount) => amount.toFixed(2)).join(';'), '', '', paid, settledAccount ? 'Settled' : 'Pending', direction, group.baseCurrency, '']] })
    for (const { settlement, member: counterparty } of counterparties) {
    if (settledAccount) {
      const type = direction === 'Receivable' ? 'Income' : 'Expense'
      const category = direction === 'Receivable' ? 'Receivables' : 'Payables'
      const note = direction === 'Receivable' ? `Splittr receipt from ${counterparty.name}: ${group.name}` : `Splittr payment to ${counterparty.name}: ${group.name}`
      data.push({ range: `Transactions!B${txRow}:L${txRow}`, majorDimension: 'ROWS', values: [[settlementRowDate, settledAccount, settlement.amount.toFixed(2), '', group.baseCurrency, '', type, category, '', '', note]] })
      txRow++
    }
    }
  }
  return data
}
