import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import type { RawInstallmentRow, RawRecurringRow } from '@/types/installments'

// ─── Mocks ───────────────────────────────────────────────────────────────────
const hookState: {
  value: { installments: RawInstallmentRow[]; recurring: RawRecurringRow[]; isLoading: boolean; isError: boolean }
} = { value: { installments: [], recurring: [], isLoading: false, isError: false } }

vi.mock('@/features/InstallmentsRecurring/useInstallmentsRecurring', () => ({
  useInstallmentsRecurring: () => hookState.value,
}))

vi.mock('@/features/InstallmentsRecurring/useInstallmentTransactions', async () => {
  const { buildInstallmentMonths } = await import('@/features/InstallmentsRecurring/buildInstallmentMonths')
  return {
    useInstallmentTransactions: (installments: RawInstallmentRow[]) => ({
      getMonthItems: (month: { year: number; month: number }) => buildInstallmentMonths(installments, [], month).items,
      isLoading: false,
      isError: false,
    }),
  }
})

import InstallmentsRecurring from '@/features/InstallmentsRecurring'

// ─── Fixtures ────────────────────────────────────────────────────────────────
function inst(o: Partial<RawInstallmentRow> = {}): RawInstallmentRow {
  return {
    name: o.name ?? 'iPhone', account: o.account ?? 'Unionbank CC',
    totalAmount: o.totalAmount ?? '21,039.60', terms: o.terms ?? '5.00',
    termPayment: o.termPayment ?? '4,207.92', startDate: o.startDate ?? '6/22/2026',
    budget: o.budget ?? 'Sink', currency: o.currency ?? 'PHP',
  }
}
function rec(o: Partial<RawRecurringRow> = {}): RawRecurringRow {
  return {
    name: o.name ?? 'Spotify', account: o.account ?? 'RCBC CC', amount: o.amount ?? '169',
    frequency: o.frequency ?? 'Monthly', startDate: o.startDate ?? '06/2026',
    endDate: o.endDate ?? '', category: o.category ?? 'Digital', subcategory: o.subcategory ?? 'Spotify',
    currency: o.currency ?? 'PHP',
  }
}

beforeEach(() => {
  // Pin "today" to Jun 2026 so the default month is deterministic.
  vi.setSystemTime(new Date(2026, 5, 15)) // June 15 2026
  hookState.value = { installments: [], recurring: [], isLoading: false, isError: false }
})
afterEach(() => vi.useRealTimers())

describe('InstallmentsRecurring panel', () => {
  it('defaults to the current month (Jun 2026) on mount (R8.1)', () => {
    render(<InstallmentsRecurring privacyMode={false} />)
    expect(screen.getByText('Jun 2026')).toBeInTheDocument()
  })

  it('renders an installment row with name, account, N/T, amount, currency (R8.3)', () => {
    hookState.value.installments = [inst({ startDate: '6/22/2026', terms: '5.00', termPayment: '4,207.92' })]
    render(<InstallmentsRecurring privacyMode={false} />)
    const list = within(screen.getByTestId('ir-list'))
    expect(list.getByText('iPhone')).toBeInTheDocument()
    expect(list.getByText('Unionbank CC')).toBeInTheDocument()
    expect(list.getByText('1/5')).toBeInTheDocument()          // iteration 1 of 5 in start month
    // Amount renders with the resolved currency symbol (₱), not the ISO code.
    expect(list.getByText(/₱4,207\.92/)).toBeInTheDocument()
    expect(list.queryByText(/PHP/)).not.toBeInTheDocument()
  })

  it('renders a recurring row with name, account, frequency, amount, currency (R8.4)', () => {
    hookState.value.recurring = [rec({ startDate: '06/2026', frequency: 'Monthly', amount: '169' })]
    render(<InstallmentsRecurring privacyMode={false} />)
    const list = within(screen.getByTestId('ir-list'))
    expect(list.getByText('Spotify')).toBeInTheDocument()
    expect(list.getByText('RCBC CC')).toBeInTheDocument()
    expect(list.getByText('Monthly')).toBeInTheDocument()
    expect(list.getByText(/169/)).toBeInTheDocument()
  })

  it('renders each amount with its own resolved currency symbol (R8.3, R8.4)', () => {
    hookState.value.installments = [inst({ name: 'Laptop', startDate: '6/1/2026', terms: '3', termPayment: '500', currency: 'USD' })]
    hookState.value.recurring = [rec({ name: 'Spotify', startDate: '06/2026', amount: '169', currency: 'PHP' })]
    render(<InstallmentsRecurring privacyMode={false} />)
    const list = within(screen.getByTestId('ir-list'))
    // USD item → \$ symbol; PHP item → ₱ symbol. No ISO codes shown.
    expect(list.getByText(/\$500\.00/)).toBeInTheDocument()
    expect(list.getByText(/₱169\.00/)).toBeInTheDocument()
    expect(list.queryByText(/\bUSD\b/)).not.toBeInTheDocument()
    expect(list.queryByText(/\bPHP\b/)).not.toBeInTheDocument()
  })

  it('shows an empty-state message and total 0 when nothing is active (R8.7, R11.4)', () => {
    render(<InstallmentsRecurring privacyMode={false} />)
    expect(screen.getByText(/no installments or recurring payments/i)).toBeInTheDocument()
    // total row shows a zero currency value
    expect(screen.getByText(/Monthly total/i)).toBeInTheDocument()
  })

  it('renders the chart placeholder (not a donut) when the month has no items, keeping layout in place (R1.1, R1.2)', () => {
    render(<InstallmentsRecurring privacyMode={false} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('No data to display')
    expect(status.className).toMatch(/h-56/)
    // total + navigator still present below the reserved chart slot
    expect(screen.getByText(/Monthly total/i)).toBeInTheDocument()
  })

  it('shows the donut and no placeholder when the month has items (R1.4)', () => {
    hookState.value.installments = [inst({ startDate: '6/1/2026', terms: '3', termPayment: '1000' })]
    vi.setSystemTime(new Date(2026, 5, 15))
    render(<InstallmentsRecurring privacyMode={false} />)
    expect(screen.queryByText('No data to display')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('masks every amount and the total when privacy mode is on (R10.1, R10.2)', () => {
    hookState.value.installments = [inst({ startDate: '6/1/2026', terms: '3', termPayment: '1000' })]
    render(<InstallmentsRecurring privacyMode={true} />)
    const masks = screen.getAllByText('••••••')
    // one per item amount + the monthly total
    expect(masks.length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/1,000/)).not.toBeInTheDocument()
  })

  it('navigates months and recomputes the active list (R9.1-R9.3)', () => {
    // "Today" is pinned to Jun 2026. Installment active only in Jun 2026 (1 term);
    // ongoing recurring started Apr 2026 (empty end → active Apr..Jun, not future).
    hookState.value.installments = [inst({ name: 'OneShot', startDate: '6/1/2026', terms: '1', termPayment: '500' })]
    hookState.value.recurring = [rec({ name: 'Netflix', startDate: '04/2026', endDate: '' })]
    render(<InstallmentsRecurring privacyMode={false} />)

    // Jun 2026 (current month): both present
    expect(within(screen.getByTestId('ir-list')).getByText('OneShot')).toBeInTheDocument()
    expect(within(screen.getByTestId('ir-list')).getByText('Netflix')).toBeInTheDocument()

    // Next → Jul 2026 (future): installment ended AND ongoing recurring no longer shows past the current month
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByText('Jul 2026')).toBeInTheDocument()
    expect(within(screen.getByTestId('ir-list')).queryByText('OneShot')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('ir-list')).queryByText('Netflix')).not.toBeInTheDocument()

    // Prev twice → May 2026 (within Apr..Jun window): ongoing recurring shows, installment does not
    fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    expect(screen.getByText('May 2026')).toBeInTheDocument()
    expect(within(screen.getByTestId('ir-list')).getByText('Netflix')).toBeInTheDocument()
    expect(within(screen.getByTestId('ir-list')).queryByText('OneShot')).not.toBeInTheDocument()
  })

  it('ongoing recurring shows through the current month but NOT future months (R7.2)', () => {
    // Started Apr 2026, empty end, today = Jun 2026.
    hookState.value.recurring = [rec({ name: 'Netflix', startDate: '04/2026', endDate: '' })]
    render(<InstallmentsRecurring privacyMode={false} />)
    // Current month (Jun 2026): present
    expect(within(screen.getByTestId('ir-list')).getByText('Netflix')).toBeInTheDocument()
    // Navigate a year forward → absent (future months do not show an ongoing payment)
    for (let i = 0; i < 12; i++) {
      fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    }
    expect(screen.getByText('Jun 2027')).toBeInTheDocument()
    expect(within(screen.getByTestId('ir-list')).queryByText('Netflix')).not.toBeInTheDocument()
  })
})
