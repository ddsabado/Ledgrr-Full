import { describe, expect, it } from 'vitest'
import { buildSplittrImportRows } from './settlementRows.ts'
import type { Group } from './validateGroup.ts'

const group: Group = {
  id: 'global-netting', name: 'Global netting', baseCurrency: 'PHP',
  members: [{ id: 'DW8', name: 'DW8' }, { id: 'MEM2', name: 'MEM2' }, { id: 'MEM3', name: 'MEM3' }],
  expenses: [
    { id: 'dw8-paid', description: 'Hotel', amount: 100, currency: 'PHP', date: '9/30/2026', paidByMemberId: 'DW8', shares: [{ memberId: 'DW8', amount: 18.67 }, { memberId: 'MEM2', amount: 29.66 }, { memberId: 'MEM3', amount: 51.67 }] },
    { id: 'mem2-paid', description: 'Dinner', amount: 100, currency: 'PHP', date: '9/30/2026', paidByMemberId: 'MEM2', shares: [{ memberId: 'DW8', amount: 29.66 }, { memberId: 'MEM2', amount: 40.68 }, { memberId: 'MEM3', amount: 29.66 }] },
  ],
}

describe('buildSplittrImportRows', () => {
  it('writes only the selected member’s globally simplified receipt', () => {
    const rows = buildSplittrImportRows({
      group, memberId: 'DW8', settledAccount: 'Cash', debtRow: 2, transactionRow: 2,
      selected: [
        { expenseId: 'dw8-paid', account: 'Card', category: 'Travel', subcategory: '', budget: '' },
        { expenseId: 'mem2-paid', account: null, category: null, subcategory: '', budget: '' },
      ],
    })
    const receipts = rows.flatMap((row) => row.values).filter((values) => values[10]?.startsWith('Splittr receipt'))
    expect(receipts).toEqual([expect.arrayContaining(['51.67', 'Income', 'Receivables', 'Splittr receipt from MEM3: Global netting'])])
    expect(rows.flatMap((row) => row.values).some((values) => values.join(' ').includes('MEM2'))).toBe(false)
  })

  it('records a payment when the selected member is the debtor', () => {
    const rows = buildSplittrImportRows({
      group, memberId: 'MEM3', settledAccount: 'Cash', debtRow: 2, transactionRow: 2,
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
