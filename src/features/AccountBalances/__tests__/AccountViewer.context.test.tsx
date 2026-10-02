import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccountBalance } from '@/types/accounts'

const account = {
  name: 'USD Wallet', category: 'e-Wallets', currency: 'USD', currentBalance: 20,
  initialBalance: 0, creditLimit: 0, statementDay: null, dueDay: null,
  image: '', accountType: 'Debit', phpEquivalent: 1_120,
} satisfies AccountBalance
const pesoAccount = {
  name: 'Peso Wallet', category: 'Cash', currency: 'PHP', currentBalance: 600,
  initialBalance: 0, creditLimit: 0, statementDay: null, dueDay: null,
  image: '', accountType: 'Debit', phpEquivalent: 600,
} satisfies AccountBalance

const transactionState: {
  transactions: []; types: string[]; isLoading: boolean; isError: boolean; retry: ReturnType<typeof vi.fn>
} = { transactions: [], types: ['Adjustment', 'Expense'], isLoading: false, isError: false, retry: vi.fn() }

vi.mock('@/hooks/useAccountBalances', () => ({
  useAccountBalances: () => ({ data: [account, pesoAccount], isLoading: false, isError: false }),
}))
vi.mock('../useAccountTransactions', () => ({
  useAccountTransactions: () => transactionState,
}))
vi.mock('@/features/CreditCardUtilization/TransactionList', () => ({ default: () => <div>Transaction list</div> }))

import AccountViewer from '../AccountViewer'

function renderViewer(privacyMode = false, accountName = 'USD Wallet') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}><AccountViewer accountName={accountName} privacyMode={privacyMode} /></QueryClientProvider>),
  }
}

describe('AccountViewer context', () => {
  beforeEach(() => {
    transactionState.transactions = []
    transactionState.isLoading = false
    transactionState.isError = false
    transactionState.retry.mockReset()
  })

  it('shows the selected account’s compact balance, currency, category, and visible count', () => {
    renderViewer()

    expect(screen.getByRole('heading', { name: 'USD Wallet' })).toBeInTheDocument()
    expect(screen.getByText('₱1,120.00')).toBeInTheDocument()
    expect(screen.getByText('$20.00')).toBeInTheDocument()
    expect(screen.getByLabelText('Account summary')).toHaveTextContent('e-Wallets · USD')
    expect(screen.getByLabelText('Account summary')).toHaveTextContent('0 transactions in this account')
    expect(screen.getByText('This account has no transactions yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adjust balance' })).toHaveClass('min-h-11', 'min-w-11')
    expect(screen.getByRole('button', { name: 'Filter transactions' })).toHaveClass('min-h-11', 'min-w-11')
  })

  it('explains an empty filtered result and clears filters in place', async () => {
    const user = userEvent.setup()
    renderViewer()

    await user.click(screen.getByRole('button', { name: 'Filter transactions' }))
    await user.selectOptions(screen.getByLabelText('Type'), 'Adjustment')

    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument()
    expect(screen.getByText('0 results')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(screen.getAllByText(/Type: Adjustment/)).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('This account has no transactions yet.')).toBeInTheDocument()
  })

  it('masks every balance in privacy mode and provides a scoped query retry on failure', async () => {
    transactionState.isError = true
    const user = userEvent.setup()
    renderViewer(true)

    expect(screen.getByLabelText('Account summary')).toHaveTextContent('••••••')
    expect(screen.getByLabelText('Account summary')).not.toHaveTextContent('₱1,120.00')
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this account’s transactions')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(transactionState.retry).toHaveBeenCalledOnce()
  })

  it('transitions to the newly selected account context without replacing the viewer shell', async () => {
    const { queryClient, rerender } = renderViewer()

    rerender(<QueryClientProvider client={queryClient}><AccountViewer accountName="Peso Wallet" privacyMode={false} /></QueryClientProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Peso Wallet' })).toBeInTheDocument())
    expect(screen.getByText('₱600.00')).toBeInTheDocument()
    expect(screen.getByLabelText('Account summary')).toHaveTextContent('Cash · PHP')
    expect(screen.queryByText('$20.00')).not.toBeInTheDocument()
  })
})
