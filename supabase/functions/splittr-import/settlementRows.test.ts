import { describe, expect, it } from 'vitest'
import { buildSplittrImportRows } from './settlementRows.ts'
import type { Group } from './validateGroup.ts'
import { parseSplittrExpenseDetails } from '../_shared/splittrImportDetails.ts'

const group: Group = {
  id: 'global-netting', name: 'Global netting', baseCurrency: 'PHP',
  members: [{ id: 'DW8', name: 'DW8' }, { id: 'MEM2', name: 'MEM2' }, { id: 'MEM3', name: 'MEM3' }],
  expenses: [
    { id: 'dw8-paid', description: 'Hotel', amount: 100, currency: 'PHP', date: '9/30/2026', paidByMemberId: 'DW8', shares: [{ memberId: 'DW8', amount: 18.67 }, { memberId: 'MEM2', amount: 29.66 }, { memberId: 'MEM3', amount: 51.67 }] },
    { id: 'mem2-paid', description: 'Dinner', amount: 100, currency: 'PHP', date: '9/30/2026', paidByMemberId: 'MEM2', shares: [{ memberId: 'DW8', amount: 29.66 }, { memberId: 'MEM2', amount: 40.68 }, { memberId: 'MEM3', amount: 29.66 }] },
  ],
}

describe('buildSplittrImportRows', () => {
  it('writes the selected member expense without a Split Offset and preserves its metadata', () => {
    const rows = buildSplittrImportRows({
      group, memberId: 'DW8', settledAccount: 'Cash', settlementDate: '2026-10-02', debtRow: 2, transactionRow: 2,
      selected: [
        { expenseId: 'dw8-paid', account: 'Card', category: 'Travel', subcategory: '', budget: '' },
        { expenseId: 'mem2-paid', account: null, category: null, subcategory: '', budget: '' },
      ],
    })
    const receipts = rows.flatMap((row) => row.values).filter((values) => values[10]?.startsWith('Splittr receipt'))
    const transactionRows = rows.flatMap((row) => row.values).filter((values) => values[10]?.startsWith('Splittr'))
    expect(transactionRows).toEqual(expect.arrayContaining([
      ['9/30/2026', 'Card', '100.00', '', 'PHP', '', 'Expense', 'Travel', '', '', 'Splittr import: Hotel'],
    ]))
    expect(transactionRows).not.toEqual(expect.arrayContaining([
      expect.arrayContaining(['Split Offset']),
      expect.arrayContaining(['Splittr offset: Hotel']),
    ]))
    expect(receipts).toEqual([expect.arrayContaining(['51.67', 'Income', 'Receivables', 'Splittr receipt from MEM3: Global netting'])])
    expect(rows.flatMap((row) => row.values).filter((values) => values[10]?.startsWith('Splittr receipt')).every((values) => values[0] === '10/2/2026')).toBe(true)
    expect(rows.flatMap((row) => row.values).filter((values) => values[0]?.startsWith('Splittr:')).every((values) => values[2] === '10/2/2026')).toBe(true)
    const debtRows = rows.filter((row) => row.range.startsWith('Debts and Receivables!'))
    expect(debtRows).toHaveLength(1)
    expect(debtRows[0].values[0][1]).toBe('Cash')
    expect(debtRows[0].values[0][7]).toEqual('')
    expect(debtRows[0].values[0][8]).toEqual('')
    expect(parseSplittrExpenseDetails(debtRows[0].values[0][5])).toEqual(expect.arrayContaining([
      expect.objectContaining({ description: 'Hotel', paidBy: 'DW8' }),
      expect.objectContaining({ description: 'Dinner', paidBy: 'MEM2' }),
    ]))
  })

  it('records a payment when the selected member is the debtor', () => {
    const rows = buildSplittrImportRows({
      group, memberId: 'MEM3', settledAccount: 'Cash', settlementDate: '2026-10-02', debtRow: 2, transactionRow: 2,
      selected: [
        { expenseId: 'dw8-paid', account: null, category: null, subcategory: '', budget: '' },
        { expenseId: 'mem2-paid', account: null, category: null, subcategory: '', budget: '' },
      ],
    })
    const payments = rows.flatMap((row) => row.values).filter((values) => values[10]?.startsWith('Splittr payment'))
    expect(payments).toEqual(expect.arrayContaining([
      expect.arrayContaining(['51.67', 'Expense', 'Payables', 'Splittr payment to DW8: Global netting']),
      expect.arrayContaining(['29.66', 'Expense', 'Payables', 'Splittr payment to MEM2: Global netting']),
    ]))
  })
})
