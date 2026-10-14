import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccountBalance } from '@/types/accounts'
import type { RawTransaction } from '@/types/transactions'

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
  transactions: RawTransaction[]; types: string[]; isLoading: boolean; isError: boolean; retry: ReturnType<typeof vi.fn>
} = { transactions: [], types: ['Adjustment', 'Expense'], isLoading: false, isError: false, retry: vi.fn() }

vi.mock('@/hooks/useAccountBalances', () => ({
  useAccountBalances: () => ({ data: [account, pesoAccount], isLoading: false, isError: false }),
}))
vi.mock('../useAccountTransactions', () => ({
  useAccountTransactions: () => transactionState,
  filterTransactions: (transactions: RawTransaction[], filters: { type?: string; note?: string }) => transactions.filter((transaction) => (!filters.type || transaction.type === filters.type) && (!filters.note || transaction.note.toLowerCase().includes(filters.note.toLowerCase()))),
}))
vi.mock('@/features/CreditCardUtilization/TransactionList', () => ({
  default: ({ transactions }: { transactions: RawTransaction[] }) => <div data-testid="transaction-list">{transactions.map((transaction) => transaction.key).join(',')}</div>,
}))

import AccountViewer from '../AccountViewer'

function renderViewer(privacyMode = false, accountName = 'USD Wallet', onClose?: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}><AccountViewer accountName={accountName} privacyMode={privacyMode} onClose={onClose} /></QueryClientProvider>),
  }
}

describe('AccountViewer context', () => {
  beforeEach(() => {
    transactionState.transactions = []
    transactionState.isLoading = false
    transactionState.isError = false
    transactionState.retry.mockReset()
  })

  it('renders injected fixture data without a query provider and disables balance mutations', () => {
    render(<AccountViewer accountName="USD Wallet" privacyMode={false} fixture={{ account, transactions: [{ key: 'fixture', date: '2026-10-01', account: 'USD Wallet', amount: 10, resolvedAmount: 10, currency: 'USD', targetAccount: '', type: 'Expense', category: 'Food', subcategory: '', budget: '', note: 'Fixture groceries' }] }} />)
    expect(screen.getByRole('heading', { name: 'USD Wallet' })).toBeInTheDocument()
    expect(screen.getByTestId('transaction-list')).toHaveTextContent('fixture')
    expect(screen.getByRole('button', { name: 'Adjust balance' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('disabled')
  })

  it('shows the selected account’s compact balance, currency, category, and visible count', () => {
    renderViewer()

    expect(screen.getByRole('heading', { name: 'USD Wallet' })).toBeInTheDocument()
    expect(screen.getByTestId('account-activity-viewer')).toHaveClass('rounded-xl', 'border', 'bg-surface', 'p-5', 'flex', 'flex-col', 'gap-3')
    expect(screen.getByText('₱1,120.00')).toBeInTheDocument()
    expect(screen.getByText('$20.00')).toHaveClass('shrink-0', 'text-xs', 'tabular-nums', 'text-muted')
    expect(screen.queryByText('PHP equivalent')).not.toBeInTheDocument()
    expect(screen.queryByText('Native · USD')).not.toBeInTheDocument()
    const summary = screen.getByLabelText('Account summary')
    expect(summary).toHaveTextContent('e-Wallets · USD')
    expect(summary).toHaveTextContent('0 transactions')
    expect(summary).not.toHaveClass('grid', 'sm:flex')
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
    expect(screen.getByLabelText('Account summary')).toHaveTextContent('0 transactions')
    expect(screen.getByLabelText('Account summary')).not.toHaveTextContent('match the active filters')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(screen.getAllByText(/Type: Adjustment/)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Filter transactions, 1 active' }).querySelector('.lucide-list-filter-plus')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('This account has no transactions yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter transactions' }).querySelector('.lucide-list-filter')).toBeInTheDocument()
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

  it('provides a touch-sized return control when used as a mobile screen', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderViewer(false, 'USD Wallet', onClose)

    const back = screen.getByRole('button', { name: 'Back to account balances' })
    expect(back).toHaveClass('-ml-2', 'min-h-11', 'min-w-11', 'lg:hidden')
    expect(back.parentElement).toHaveClass('w-full', 'justify-between', 'sm:w-auto', 'sm:justify-end')
    await user.click(back)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('paginates filtered transactions with the shadcn icons-only controls and configurable rows per page', async () => {
    transactionState.transactions = Array.from({ length: 26 }, (_, index) => ({
      key: `transaction-${index + 1}`,
      date: '2026-10-11',
      account: 'USD Wallet',
      amount: index + 1,
      resolvedAmount: index + 1,
      currency: 'PHP',
      targetAccount: '',
      type: 'Expense',
      category: 'Food',
      subcategory: '',
      budget: '',
      note: '',
    }))
    const user = userEvent.setup()
    renderViewer()

    const previous = screen.getByRole('button', { name: 'Go to previous page' })
    const next = screen.getByRole('button', { name: 'Go to next page' })
    expect(screen.getByLabelText('Account summary')).toHaveTextContent('26 transactions')
    expect(screen.getByTestId('transaction-list')).toHaveTextContent('transaction-25')
    expect(screen.getByTestId('transaction-list')).not.toHaveTextContent('transaction-26')
    expect(previous).toBeDisabled()
    expect(next).toBeEnabled()

    await user.click(next)
    await waitFor(() => expect(screen.getByTestId('transaction-list')).toHaveTextContent('transaction-26'))
    expect(next).toBeDisabled()
    expect(screen.getByTestId('transaction-list').parentElement).toHaveAttribute('data-page', '2')

    await user.click(screen.getByRole('button', { name: 'Rows per page' }))
    await user.click(screen.getByRole('option', { name: '10' }))
    await waitFor(() => expect(screen.getByTestId('transaction-list')).toHaveTextContent('transaction-10'))
    expect(screen.getByTestId('transaction-list')).not.toHaveTextContent('transaction-11')
    expect(previous).toBeDisabled()
    expect(screen.getByTestId('transaction-list').parentElement).toHaveAttribute('data-page', '1')
  })
})
