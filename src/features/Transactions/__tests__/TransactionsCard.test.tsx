import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TransactionsCard } from '@/features/Transactions/TransactionsCard'
import type { GroupedPeriods, PeriodBucket } from '@/features/Transactions/groupTransactions'
import type { RawTransaction } from '@/types/transactions'

const tx: RawTransaction = {
  key: 'fixture-food', date: '6/11/2026 0:00:00', account: 'Cash', amount: 125,
  resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense',
  category: 'Food', subcategory: '', budget: '', note: '',
}
const bucket: PeriodBucket = {
  key: 'Jun 2026', label: 'Jun 2026',
  Expense: { Food: { total: 125, txs: [tx], subcats: {} } },
  Income: {},
}
const empty: GroupedPeriods = { periods: [], currentIndex: 0 }

describe('TransactionsCard fixture props', () => {
  it('renders supplied grouped data and retains local category drill-down', () => {
    render(<TransactionsCard grouped={{ month: { periods: [bucket], currentIndex: 0 }, week: empty, day: empty }} fxMap={{ PHP: 1 }} privacyMode={false} />)

    expect(screen.getAllByText('₱125.00')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /Food/ }))
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Food/ })).toBeInTheDocument()
  })
})
