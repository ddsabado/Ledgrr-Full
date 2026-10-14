import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

import Transactions, { TransactionsCard } from '@/features/Transactions'

const FX = { PHP: 1 }

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

function groupedWithPeriods(): TransactionsByPeriod['grouped'] {
  const september = { ...monthBucket(), key: 'Sep 2026', label: 'Sep 2026' }
  const october = { ...monthBucket(), key: 'Oct 2026', label: 'Oct 2026' }
  const month = { periods: [september, october], currentIndex: 1 }
  const empty: GroupedPeriods = { periods: [], currentIndex: 0 }
  return { month, week: empty, day: empty }
}

function groupedWithPaginatedTransactions(): TransactionsByPeriod['grouped'] {
  const transactions = Array.from({ length: 12 }, (_, index) => tx({
    key: `page-${index + 1}`,
    category: 'Food',
    amount: index + 1,
    note: `Page transaction ${index + 1}`,
  }))
  const bucket: PeriodBucket = {
    key: 'Jun 2026',
    label: 'Jun 2026',
    Expense: {
      Food: {
        total: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
        txs: transactions,
        subcats: {},
      },
    },
    Income: {},
  }
  const empty: GroupedPeriods = { periods: [], currentIndex: 0 }
  return { month: { periods: [bucket], currentIndex: 0 }, week: empty, day: empty }
}

function stubMatchMedia({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : mobile,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })))
}

function swipe(card: HTMLElement, fromX: number, toX: number) {
  fireEvent.touchStart(card, { touches: [{ clientX: fromX, clientY: 100 }] })
  fireEvent.touchMove(card, { touches: [{ clientX: toX, clientY: 104 }] })
  fireEvent.touchEnd(card, { changedTouches: [{ clientX: toX, clientY: 104 }] })
}

beforeEach(() => {
  seq = 0
  authState.session = { user: { id: 'u1' } }
  hookState.value = { grouped: groupedWithMonth(), isLoading: false, isError: false }
  vi.unstubAllGlobals()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Transactions panel', () => {
  it('renders fixture props without the authenticated data wrapper', async () => {
    const user = userEvent.setup()
    render(<TransactionsCard grouped={groupedWithMonth()} fxMap={FX} privacyMode={false} />)

    expect(screen.getByText('Transactions by Period')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Income' }))
    expect(screen.getByRole('button', { name: /Salary/ })).toBeInTheDocument()
  })

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

  it('paginates drill-down transactions and resets at the selected source boundary', async () => {
    const user = userEvent.setup()
    hookState.value = { grouped: groupedWithPaginatedTransactions(), isLoading: false, isError: false }
    render(<Transactions privacyMode={false} />)

    await user.click(screen.getByRole('button', { name: /Food/ }))
    expect(screen.getByText('Page transaction 1')).toBeInTheDocument()
    expect(screen.queryByText('Page transaction 11')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Go to next page' }))
    expect(screen.queryByText('Page transaction 1')).not.toBeInTheDocument()
    expect(screen.getByText('Page transaction 11')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Food/ }))
    await user.click(screen.getByRole('button', { name: /Food/ }))
    expect(screen.getByText('Page transaction 1')).toBeInTheDocument()
    expect(screen.queryByText('Page transaction 11')).not.toBeInTheDocument()
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

  it('renders the chart placeholder (not a donut) when the period has no categories (R1.1, R1.2)', () => {
    // Empty grouped data -> zero categories -> reserved placeholder slot.
    hookState.value = { grouped: emptyGrouped(), isLoading: false, isError: false }
    render(<Transactions privacyMode={false} />)
    // Placeholder present at the reserved chart height
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('No data to display')
    expect(status.className).toMatch(/h-56/)
    // Total row still renders (layout below the chart is intact)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('shows the donut and no placeholder when categories exist (R1.4)', () => {
    render(<Transactions privacyMode={false} />)
    expect(screen.queryByText('No data to display')).not.toBeInTheDocument()
  })

  it('keeps period boundaries as no-ops for mobile swipes', () => {
    stubMatchMedia({ mobile: true, reducedMotion: false })
    hookState.value = { grouped: groupedWithPeriods(), isLoading: false, isError: false }
    render(<Transactions privacyMode={false} />)
    const card = screen.getByTestId('transactions-card')

    // At the latest period, a left swipe cannot advance further.
    swipe(card, 220, 140)
    expect(screen.getByText('Oct 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()

    swipe(card, 140, 220)
    expect(screen.getByText('Sep 2026')).toBeInTheDocument()
    // At the earliest period, another right swipe likewise does nothing.
    swipe(card, 140, 220)
    expect(screen.getByText('Sep 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous period' })).toBeDisabled()
  })

  it('changes periods without motion feedback when reduced motion is preferred', () => {
    stubMatchMedia({ mobile: true, reducedMotion: true })
    hookState.value = { grouped: groupedWithPeriods(), isLoading: false, isError: false }
    render(<Transactions privacyMode={false} />)
    const card = screen.getByTestId('transactions-card')

    swipe(card, 140, 220)

    expect(screen.getByText('Sep 2026')).toBeInTheDocument()
    expect(screen.getByTestId('transactions-content')).not.toHaveAttribute('data-swipe-feedback')
  })

  it('gives successful non-reduced-motion swipes restrained directional feedback', () => {
    stubMatchMedia({ mobile: true, reducedMotion: false })
    hookState.value = { grouped: groupedWithPeriods(), isLoading: false, isError: false }
    render(<Transactions privacyMode={false} />)
    const card = screen.getByTestId('transactions-card')

    swipe(card, 140, 220)

    expect(screen.getByTestId('transactions-content')).toHaveAttribute('data-swipe-feedback', 'previous')
  })
})
