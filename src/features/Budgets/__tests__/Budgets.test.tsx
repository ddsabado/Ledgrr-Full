import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { RawBudgetRow } from '@/types/budgets'
import type { RawTransaction } from '@/types/transactions'
import type { CurrencyData } from '@/types/accounts'

// ─── Mock the hook ───────────────────────────────────────────────────────────
const FX: CurrencyData = { PHP: 1, JPY: 0.4013862, USD: 62.72 }
const hookState: {
  value: { budgets: RawBudgetRow[]; candidateTxs: RawTransaction[]; fxMap: CurrencyData; isLoading: boolean; isError: boolean }
} = { value: { budgets: [], candidateTxs: [], fxMap: FX, isLoading: false, isError: false } }

vi.mock('@/features/Budgets/useBudgets', () => ({
  useBudgets: () => hookState.value,
}))

import Budgets from '@/features/Budgets'

// ─── Fixtures ────────────────────────────────────────────────────────────────
function budget(o: Partial<RawBudgetRow> = {}): RawBudgetRow {
  return { name: o.name ?? 'Needs', amount: o.amount ?? '18,000', currency: o.currency ?? 'PHP' }
}
let seq = 0
function tx(o: Partial<RawTransaction> = {}): RawTransaction {
  seq += 1
  return {
    key: o.key ?? `T${seq}`, date: o.date ?? '6/11/2026 0:00:00', account: o.account ?? 'Chinabank CC',
    amount: o.amount ?? 100, resolvedAmount: o.resolvedAmount ?? null, currency: o.currency ?? 'PHP',
    targetAccount: o.targetAccount ?? '', type: o.type ?? 'Expense', category: o.category ?? 'Food',
    subcategory: o.subcategory ?? '', budget: o.budget ?? 'Needs', note: o.note ?? '',
  }
}

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 5, 15)) // Jun 15 2026
  hookState.value = { budgets: [], candidateTxs: [], fxMap: FX, isLoading: false, isError: false }
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Budgets panel', () => {
  it('changes months when swiping anywhere on the card on mobile', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    render(<Budgets privacyMode={false} />)
    const list = screen.getByTestId('budgets-list')

    fireEvent.touchStart(list, { touches: [{ clientX: 220, clientY: 100 }] })
    fireEvent.touchMove(list, { touches: [{ clientX: 120, clientY: 104 }] })
    fireEvent.touchEnd(list, { changedTouches: [{ clientX: 120, clientY: 104 }] })

    expect(screen.getByText('Jul 2026')).toBeInTheDocument()
  })

  it('renders the title and defaults to the current month (R5.1, R5.2, R5.3)', () => {
    render(<Budgets privacyMode={false} />)
    expect(screen.getByText('Budgets')).toBeInTheDocument()
    expect(screen.getByText('Jun 2026')).toBeInTheDocument()
  })

  it('renders a budget row with name, spent/allotted, %, count (R5.4, R4.6)', () => {
    hookState.value.budgets = [budget({ name: 'Needs', amount: '18,000' })]
    hookState.value.candidateTxs = [
      tx({ budget: 'Needs', amount: 9000, currency: 'PHP', resolvedAmount: null, date: '6/2/2026 0:00:00' }),
    ]
    render(<Budgets privacyMode={false} />)
    const list = within(screen.getByTestId('budgets-list'))
    expect(list.getByText('Needs')).toBeInTheDocument()
    expect(list.getByText('₱9,000.00')).toBeInTheDocument()
    expect(list.getByText('of ₱18,000.00')).toBeInTheDocument()
    expect(list.getByText('1 transaction')).toBeInTheDocument()
    expect(list.getByText(/₱9,000\.00 left/)).toBeInTheDocument()
  })

  it('shows "Over by" and red color when overspent (R5.6, R4.4)', () => {
    hookState.value.budgets = [budget({ name: 'Sink', amount: '1,000' })]
    hookState.value.candidateTxs = [tx({ budget: 'Sink', amount: 1500, currency: 'PHP', resolvedAmount: null, date: '6/1/2026 0:00:00' })]
    render(<Budgets privacyMode={false} />)
    const list = within(screen.getByTestId('budgets-list'))
    expect(list.getByText(/Over by ₱500\.00/)).toBeInTheDocument()
    const status = list.getByText(/Over by ₱500\.00/)
    expect(status.className).toMatch(/text-red-500/)
  })

  it('expands to reveal transactions and collapses; one at a time (R5.7, R5.8, R5.9, R5.10)', () => {
    hookState.value.budgets = [budget({ name: 'Needs', amount: '18,000' }), budget({ name: 'Sink', amount: '5,000' })]
    hookState.value.candidateTxs = [
      tx({ budget: 'Needs', amount: 500, currency: 'PHP', resolvedAmount: null, date: '6/2/2026 0:00:00', note: 'Lunch order', category: 'Food', subcategory: 'Grab Food', account: 'Chinabank CC' }),
      tx({ budget: 'Sink', amount: 200, currency: 'PHP', resolvedAmount: null, date: '6/3/2026 0:00:00', note: 'Coffee' }),
    ]
    render(<Budgets privacyMode={false} />)
    const needsBtn = screen.getByRole('button', { name: /Needs/ })
    const sinkBtn = screen.getByRole('button', { name: /Sink/ })

    // expand Needs
    fireEvent.click(needsBtn)
    expect(needsBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('1 transaction in Jun 2026')).toBeInTheDocument()
    expect(screen.getByText(/Lunch order/)).toBeInTheDocument()
    expect(screen.getByText((_, element) =>
      element?.tagName === 'P' && element.textContent?.includes('Food · Grab Food') === true,
    )).toBeInTheDocument()
    expect(screen.getByText('Jun 02 12:00 AM · Chinabank CC')).toBeInTheDocument()

    // expand Sink → Needs collapses (one-at-a-time, verified via aria-expanded)
    fireEvent.click(sinkBtn)
    expect(sinkBtn).toHaveAttribute('aria-expanded', 'true')
    expect(needsBtn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/Coffee/)).toBeInTheDocument()

    // collapse Sink
    fireEvent.click(sinkBtn)
    expect(sinkBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the full note immediately on hover with a pointer cursor', async () => {
    const note = 'A full budget transaction note shown in the tooltip.'
    hookState.value.budgets = [budget({ name: 'Needs' })]
    hookState.value.candidateTxs = [tx({ budget: 'Needs', note })]
    render(<Budgets privacyMode={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Needs/ }))

    const user = userEvent.setup()
    const noteElement = screen.getByText(note)
    expect(noteElement).toHaveClass('cursor-pointer')
    await user.hover(noteElement)
    expect(screen.getByRole('tooltip')).toHaveTextContent(note)
  })

  it('shows the native cross-currency amount for non-PHP transactions in the expander', () => {
    hookState.value.budgets = [budget({ name: 'Travel', amount: '10000' })]
    hookState.value.candidateTxs = [
      // JPY expense: native 8940 JPY → PHP = 8940 * 0.4013862 ≈ ₱3,588.39 via fxMap
      tx({ budget: 'Travel', type: 'Expense', amount: 8940, currency: 'JPY', resolvedAmount: null, date: '6/2/2026 0:00:00', note: 'Hikiniku' }),
      // PHP expense: no native line
      tx({ budget: 'Travel', type: 'Expense', amount: 500, currency: 'PHP', resolvedAmount: null, date: '6/3/2026 0:00:00', note: 'Local' }),
    ]
    render(<Budgets privacyMode={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Travel/ }))
    // PHP primary amount for the JPY row = 8940 * 0.4013862 ≈ 3,588.39
    expect(screen.getByText(/₱3,588\.39/)).toBeInTheDocument()
    // native JPY secondary line (¥ symbol) — proves cross-currency display
    expect(screen.getByText(/¥8,940/)).toBeInTheDocument()
    expect(screen.getByLabelText('FX-estimated total, pending resolution')).toBeInTheDocument()
    // PHP row shows its PHP amount and no ¥ native line
    expect(screen.getByText(/₱500\.00/)).toBeInTheDocument()
  })

  it('expanding a budget with no transactions shows the empty message (R5.14, R7.3)', () => {
    hookState.value.budgets = [budget({ name: 'Travel', amount: '10000' })]
    hookState.value.candidateTxs = [] // no matching txs
    render(<Budgets privacyMode={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Travel/ }))
    expect(screen.getByText(/no transactions for jun 2026/i)).toBeInTheDocument()
  })

  it('masks amounts under privacy mode (R5.12)', () => {
    hookState.value.budgets = [budget({ name: 'Needs', amount: '18,000' })]
    hookState.value.candidateTxs = [tx({ budget: 'Needs', amount: 9000, currency: 'PHP', resolvedAmount: null, date: '6/2/2026 0:00:00' })]
    render(<Budgets privacyMode={true} />)
    const list = within(screen.getByTestId('budgets-list'))
    // Primary spent amount, supporting allotted amount, and remaining status are all masked.
    expect(list.getByText('••••••')).toBeInTheDocument()
    expect(list.getByText('of ••••••')).toBeInTheDocument()
    expect(list.getByText(/•••••• left/)).toBeInTheDocument()
    expect(list.queryByText(/₱9,000/)).not.toBeInTheDocument()
  })

  it('navigates months, recomputes, and collapses expanded rows (R6.1-R6.4)', () => {
    hookState.value.budgets = [budget({ name: 'Needs', amount: '18,000' })]
    hookState.value.candidateTxs = [tx({ budget: 'Needs', amount: 9000, currency: 'PHP', resolvedAmount: null, date: '6/2/2026 0:00:00' })]
    render(<Budgets privacyMode={false} />)
    // expand in Jun
    fireEvent.click(screen.getByRole('button', { name: /Needs/ }))
    expect(screen.getByRole('button', { name: /Needs: ₱9,000\.00 spent of ₱18,000\.00/ })).toBeInTheDocument()
    // next → Jul: no txs → 0.0%, expander collapsed
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByText('Jul 2026')).toBeInTheDocument()
    const list = within(screen.getByTestId('budgets-list'))
    expect(list.getByText('₱0.00')).toBeInTheDocument()
    expect(list.getByText('of ₱18,000.00')).toBeInTheDocument()
    expect(list.getByText('0 transactions')).toBeInTheDocument()
  })

  it('shows empty state when there are no budgets (R7.1)', () => {
    render(<Budgets privacyMode={false} />)
    expect(screen.getByText(/no budgets configured/i)).toBeInTheDocument()
  })

  it('shows a loading indicator while loading (R7.6)', () => {
    hookState.value.isLoading = true
    const { container } = render(<Budgets privacyMode={false} />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByTestId('budgets-list')).not.toBeInTheDocument()
  })

  it('shows an error message on failure (R7.7)', () => {
    hookState.value.isError = true
    render(<Budgets privacyMode={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load budget data/i)
    expect(screen.queryByTestId('budgets-list')).not.toBeInTheDocument()
  })
})
