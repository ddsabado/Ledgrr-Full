import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AccountBalance } from '@/types/accounts'
import type { RawTransaction } from '@/types/transactions'

vi.mock('@/features/CreditCardUtilization/TransactionList', () => ({
  default: ({ transactions }: { transactions: RawTransaction[] }) => <p data-testid="fixture-account-activity">{transactions.map((transaction) => transaction.note).join(', ')}</p>,
}))

import AccountActivityViewer from '../AccountActivityViewer'

const account: AccountBalance = { name: 'Fixture Cash', category: 'Cash', currency: 'PHP', currentBalance: 100, initialBalance: 0, creditLimit: 0, statementDay: null, dueDay: null, image: '', accountType: 'Cash', phpEquivalent: 100 }
const transactions: RawTransaction[] = [{ key: 'fixture-account-transaction', date: '2026-10-12', account: 'Fixture Cash', amount: 45, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: 'Food', subcategory: '', budget: '', note: 'Fixture groceries' }]

describe('AccountActivityViewer', () => {
  it('renders fixture activity without an authenticated data source', () => {
    render(<AccountActivityViewer account={account} transactions={transactions} privacyMode={false} />)

    expect(screen.getByTestId('account-activity-viewer')).toHaveClass('rounded-xl', 'border', 'bg-surface', 'p-5', 'flex', 'flex-col', 'gap-3')
    expect(screen.getByTestId('fixture-account-activity')).toHaveTextContent('Fixture groceries')
    expect(screen.getByText(/demo mode.*read-only/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Account summary')).toHaveTextContent('Cash · PHP')
    expect(screen.getByRole('button', { name: 'Filter transactions' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Adjust balance' })).not.toBeInTheDocument()
  })
})
