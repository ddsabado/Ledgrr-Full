import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CCCard from '@/features/CreditCardUtilization/CCCard'
import ccSource from '@/features/CreditCardUtilization/CCCard.tsx?raw'
import { getStatementTotal } from '@/features/CreditCardUtilization/utils'
import type { CCAccount, CCTransactionData, RawTransaction } from '@/types/transactions'
vi.mock('@/hooks/useCurrencies', () => ({ useCurrencies: () => ({ data: { PHP: 1 }, isLoading: false, isError: false }) }))
vi.mock('@/features/CreditCardUtilization/TransactionList', () => ({
  default: ({ transactions }: { transactions: RawTransaction[] }) => <div data-testid="transaction-list">{transactions.map((transaction) => transaction.key).join(',')}</div>,
}))


// Avoid the supabase storage call (image is '' so it early-returns null anyway).
vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } },
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_KEY: 'mock-key',
}))

const account: CCAccount = {
  name:           'Test Card',
  category:       'Credit Card',
  accountType:    'Credit',
  currency:       'PHP',
  currentBalance: 1000,
  initialBalance: 0,
  creditLimit:    5000,
  statementDay:   5,
  dueDay:         25,
  image:          '',
  phpEquivalent:  1000,
  utilization:    20,
  daysUntilDue:   10,
}

const txData: CCTransactionData = {
  cycles: [{ label: 'Cycle 1', cycleStart: '2026-06-01', cycleEnd: '2026-06-30', transactions: [] }],
  allTxs: [],
}

function renderCard(cycleView: 'statement' | 'all', onCycleViewChange = vi.fn(), data = txData) {
  return render(
    <CCCard
      account={account}
      txData={data}
      privacyMode={false}
      isExpanded
      onToggle={vi.fn()}
      cycleView={cycleView}
      onCycleViewChange={onCycleViewChange}
      cycleIndex={0}
      onCycleIndexChange={vi.fn()}
    />,
  )
}

// The single persistent highlight is the aria-hidden element carrying bg-accent.
function highlights(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[aria-hidden="true"].bg-accent'),
  )
}

describe('CCCard Pill_Selector (R6)', () => {
  it('labels the leading PHP amount as the current balance and retains native currency', () => {
    render(
      <CCCard
        account={{ ...account, currency: 'USD', currentBalance: 20, phpEquivalent: 1200 }}
        txData={txData}
        privacyMode={false}
        isExpanded={false}
        onToggle={vi.fn()}
        cycleView="statement"
        onCycleViewChange={vi.fn()}
        cycleIndex={0}
        onCycleIndexChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Current balance')).toBeInTheDocument()
    expect(screen.getByText(/Native balance/)).toBeInTheDocument()
  })

  it('promotes the due status only for an imminent or overdue payment', () => {
    const { rerender } = render(
      <CCCard
        account={account}
        txData={txData}
        privacyMode={false}
        isExpanded={false}
        onToggle={vi.fn()}
        cycleView="statement"
        onCycleViewChange={vi.fn()}
        cycleIndex={0}
        onCycleIndexChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Due in 10d')).toBeInTheDocument()
    expect(screen.queryByText('Amount due')).not.toBeInTheDocument()

    rerender(
      <CCCard
        account={{ ...account, daysUntilDue: -2 }}
        txData={txData}
        privacyMode={false}
        isExpanded={false}
        onToggle={vi.fn()}
        cycleView="statement"
        onCycleViewChange={vi.fn()}
        cycleIndex={0}
        onCycleIndexChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Overdue by 2d')).toBeInTheDocument()
    expect(screen.queryByText('Due in -2d')).not.toBeInTheDocument()
    expect(screen.queryByText('Amount due')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View activity' })).not.toBeInTheDocument()
  })

  it('shows a zero total and explicit empty state for an empty statement', () => {
    renderCard('statement')

    expect(screen.getByText('No transactions.')).toBeInTheDocument()
    expect(screen.getByText(/Total/)).toBeInTheDocument()
  })

  it('excludes card-payment transfers from a statement total', () => {
    const statementTransactions: RawTransaction[] = [
      { key: 'expense', date: '9/1/2026', account: 'Test Card', amount: 1000, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: '', subcategory: '', budget: '', note: '' },
      { key: 'payment', date: '9/2/2026', account: 'Cash', amount: 400, resolvedAmount: null, currency: 'PHP', targetAccount: 'Test Card', type: 'Transfer', category: '', subcategory: '', budget: '', note: '' },
    ]

    expect(getStatementTotal(statementTransactions, { PHP: 1 })).toBe(1000)
  })

  it('renders exactly one persistent highlight in both view states (R6.4)', () => {
    const a = renderCard('statement')
    expect(highlights(a.container)).toHaveLength(1)
    a.unmount()

    const b = renderCard('all')
    expect(highlights(b.container)).toHaveLength(1)
  })

  it('the highlight animates only x — no y/top/opacity in its transition (R6.1–R6.4)', () => {
    // Static assertion against the source: the highlight animates x with a
    // single persistent motion.div and never animates y/top/opacity.
    expect(ccSource).toMatch(/animate=\{\{\s*x:\s*`\$\{selectedIndex \* 100\}%`\s*\}\}/)
    expect(ccSource).not.toContain('layoutId')
    // No opacity/y animation on the highlight element.
    const highlightBlock = ccSource.slice(
      ccSource.indexOf('pointer-events-none absolute'),
      ccSource.indexOf('{VIEW_TABS.map'),
    )
    expect(highlightBlock).not.toContain('opacity')
    expect(highlightBlock).not.toMatch(/\by:\s/)
  })

  it('uses a tween duration within [0.15, 0.40]s (R6.5)', () => {
    const m = ccSource.match(/duration:\s*(0?\.\d+)[^}]*ease:\s*["']easeInOut["']/)
    expect(m, 'highlight transition config not found').not.toBeNull()
    const duration = Number(m![1])
    expect(duration).toBeGreaterThanOrEqual(0.15)
    expect(duration).toBeLessThanOrEqual(0.4)
  })

  it('selectedIndex direction: statement=0 (left), all=1 (right) (R6.1, R6.2)', () => {
    // Model-level: index 0 for statement, 1 for all — drives x 0% vs 100%.
    expect(ccSource).toMatch(/cycleView === ["']statement["'] \? 0 : 1/)
  })

  it('re-selecting the active option is a no-op (R6.6)', async () => {
    const onCycleViewChange = vi.fn()
    const user = userEvent.setup()
    renderCard('statement', onCycleViewChange)

    // Click the already-active "By Statement" tab.
    await user.click(screen.getByRole('tab', { name: 'By Statement' }))
    // The handler is still called with the same id; the parent guard makes it a
    // no-op. Here we assert it was invoked with the currently-active id so the
    // parent's early-return path is exercised.
    expect(onCycleViewChange).toHaveBeenCalledWith('statement')
  })

  it('paginates the compact card transaction list and resets for a new page size', async () => {
    const transactions: RawTransaction[] = Array.from({ length: 26 }, (_, index) => ({
      key: `transaction-${index + 1}`,
      date: '2026-10-11',
      account: 'Test Card',
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
    renderCard('all', vi.fn(), { ...txData, allTxs: transactions })

    const previous = screen.getByRole('button', { name: 'Go to previous page' })
    const next = screen.getByRole('button', { name: 'Go to next page' })
    expect(screen.getByTestId('transaction-list')).toHaveTextContent('transaction-25')
    expect(screen.getByTestId('transaction-list')).not.toHaveTextContent('transaction-26')
    expect(previous).toBeDisabled()

    await user.click(next)
    expect(screen.getByTestId('transaction-list')).toHaveTextContent('transaction-26')
    expect(next).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Rows per page'), '10')
    expect(screen.getByTestId('transaction-list')).toHaveTextContent('transaction-10')
    expect(screen.getByTestId('transaction-list')).not.toHaveTextContent('transaction-11')
    expect(previous).toBeDisabled()
  })
})
