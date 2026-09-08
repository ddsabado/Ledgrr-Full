import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { RawTransaction } from '@/types/transactions'
import type { GroupedPeriods, PeriodBucket } from '@/features/Transactions/groupTransactions'
import type { TransactionsByPeriod } from '@/features/Transactions/useTransactionsByPeriod'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const authState: { session: unknown } = { session: { user: { id: 'u1' } } }
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

const hookState: { value: TransactionsByPeriod } = {
  value: { grouped: emptyGrouped(), isLoading: false, isError: false },
}
vi.mock('@/features/Transactions/useTransactionsByPeriod', () => ({
  useTransactionsByPeriod: () => hookState.value,
}))

import Transactions from '@/features/Transactions'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function emptyGrouped(): TransactionsByPeriod['grouped'] {
  const empty: GroupedPeriods = { periods: [], currentIndex: 0 }
  return { month: empty, week: empty, day: empty }
}

let seq = 0
function tx(o: Partial<RawTransaction> = {}): RawTransaction {
  seq += 1
  return {
    key: o.key ?? `T${seq}`, date: o.date ?? '6/11/2026 0:00:00', account: o.account ?? 'Cash',
    amount: o.amount ?? 100, resolvedAmount: o.resolvedAmount ?? null, currency: o.currency ?? 'PHP',
    targetAccount: o.targetAccount ?? '', type: o.type ?? 'Expense', category: o.category ?? 'Food',
    subcategory: o.subcategory ?? '', budget: o.budget ?? '', note: o.note ?? '',
  }
}

/** One month bucket with Food (Groceries subcat + direct) and Transport. */
function monthBucket(): PeriodBucket {
  return {
    key: 'Jun 2026',
    label: 'Jun 2026',
    Expense: {
      Food: {
        total: 150,
        txs: [tx({ key: 'd1', category: 'Food', amount: 50, note: 'snack' })],
        subcats: {
          Groceries: { total: 100, txs: [tx({ key: 's1', category: 'Food', subcategory: 'Groceries', amount: 100 })] },
        },
      },
      Transport: { total: 80, txs: [tx({ key: 't1', category: 'Transport', amount: 80 })], subcats: {} },
    },
    Income: {
      Salary: { total: 5000, txs: [tx({ key: 'i1', category: 'Salary', type: 'Income', amount: 5000 })], subcats: {} },
    },
  }
}

function groupedWithMonth(): TransactionsByPeriod['grouped'] {
  const g = emptyGrouped()
  g.month = { periods: [monthBucket()], currentIndex: 0 }
  return g
}

beforeEach(() => {
  seq = 0
  authState.session = { user: { id: 'u1' } }
  hookState.value = { grouped: groupedWithMonth(), isLoading: false, isError: false }
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Transactions panel', () => {
  it('renders nothing when unauthenticated', () => {
    authState.session = null
    const { container } = render(<Transactions privacyMode={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the loading skeleton', () => {
    hookState.value = { grouped: emptyGrouped(), isLoading: true, isError: false }
    render(<Transactions privacyMode={false} />)
    expect(screen.queryByText('Transactions by Period')).not.toBeInTheDocument()
  })

  it('shows the error state', () => {
    hookState.value = { grouped: emptyGrouped(), isLoading: false, isError: true }
    render(<Transactions privacyMode={false} />)
    expect(screen.getByText(/could not load transactions/i)).toBeInTheDocument()
  })

  it('renders categories sorted by total with the period total', () => {
    render(<Transactions privacyMode={false} />)
    expect(screen.getByText('Transactions by Period')).toBeInTheDocument()
    // Food (150) before Transport (80)
    const cats = screen.getAllByRole('button').filter((b) => /Food|Transport/.test(b.textContent ?? ''))
    expect(cats[0].textContent).toContain('Food')
    // Period total 230 shown
    expect(screen.getByText(/₱230\.00/)).toBeInTheDocument()
  })

  it('drills category → subcategories (incl. direct group) → transactions and back', async () => {
    const user = userEvent.setup()
    render(<Transactions privacyMode={false} />)

    await user.click(screen.getByRole('button', { name: /Food/ }))
    // Groceries subcat + "Food (direct)" synthetic group
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Food (direct)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Groceries/ }))
    // Leaf transaction row shows account
    expect(screen.getAllByText(/Cash/).length).toBeGreaterThan(0)

    // The back control is labelled with the current detail (subcategory) and a
    // chevron; clicking it returns to the subcategory list.
    const backBtn = screen.getByRole('button', { name: /Groceries/ })
    await user.click(backBtn)
    expect(screen.getByText('Food (direct)')).toBeInTheDocument()
  })

  it('drills straight to transactions when a category has no subcategories', async () => {
    const user = userEvent.setup()
    render(<Transactions privacyMode={false} />)
    await user.click(screen.getByRole('button', { name: /Transport/ }))
    // No subcategory list — goes straight to the transaction row (account visible)
    expect(screen.getAllByText(/Cash/).length).toBeGreaterThan(0)
  })

  it('switches flow to Income and shows income categories', async () => {
    const user = userEvent.setup()
    render(<Transactions privacyMode={false} />)
    await user.click(screen.getByRole('tab', { name: 'Income' }))
    expect(screen.getByRole('button', { name: /Salary/ })).toBeInTheDocument()
  })

  it('masks all amounts in privacy mode', () => {
    render(<Transactions privacyMode={true} />)
    expect(screen.getAllByText('••••••').length).toBeGreaterThan(0)
    expect(screen.queryByText(/₱230\.00/)).not.toBeInTheDocument()
  })

  it('exposes period and flow tablists', () => {
    render(<Transactions privacyMode={false} />)
    expect(screen.getByRole('tab', { name: 'Month' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Week' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Day' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Expense' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Income' })).toBeInTheDocument()
  })

  it('renders the category donut legend for the active breakdown', () => {
    render(<Transactions privacyMode={false} />)
    // Category names appear in both the list and the donut legend.
    expect(screen.getAllByText('Food').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Transport').length).toBeGreaterThanOrEqual(1)
  })
})
