import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { demoCreditCard, demoCreditCardTransactionsByAccount, demoFxMap } from '@/demo/fixtures'
import type { RawTransaction } from '@/types/transactions'

vi.mock('../TransactionList', () => ({
  default: ({ transactions }: { transactions: RawTransaction[] }) => <p data-testid="fixture-card-activity">{transactions.map((transaction) => transaction.note).join(', ')}</p>,
}))

import CreditCardActivityViewer from '../CreditCardActivityViewer'

describe('CreditCardActivityViewer', () => {
  it('renders fixture statement activity without a network-backed hook', () => {
    render(<CreditCardActivityViewer accounts={[demoCreditCard]} transactionsByAccount={demoCreditCardTransactionsByAccount} fxMap={demoFxMap} accountName={demoCreditCard.name} privacyMode={false} />)

    expect(screen.getByTestId('credit-card-activity-viewer')).toHaveClass('rounded-xl', 'border', 'bg-surface', 'p-5', 'flex', 'flex-col', 'gap-4')
    expect(screen.getByTestId('fixture-card-activity')).toHaveTextContent('Meralco')
    expect(screen.getByText(/demo mode.*read-only/i)).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Credit-card transaction view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter transactions' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /pay|add credit card/i })).not.toBeInTheDocument()
  })
})
