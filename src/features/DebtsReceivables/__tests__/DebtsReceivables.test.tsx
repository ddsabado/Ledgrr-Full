import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { RawDebtReceivableRow } from '@/types/debtsReceivables'
import type { CurrencyData } from '@/types/accounts'

// ─── Mock the hook ───────────────────────────────────────────────────────────
const FX: CurrencyData = { PHP: 1, JPY: 0.4013862, USD: 62.72 }
const hookState: {
  value: { rows: RawDebtReceivableRow[]; fxMap: CurrencyData; isLoading: boolean; isError: boolean }
} = { value: { rows: [], fxMap: FX, isLoading: false, isError: false } }

vi.mock('@/features/DebtsReceivables/useDebtsReceivables', () => ({
  useDebtsReceivables: () => hookState.value,
}))

import DebtsReceivables from '@/features/DebtsReceivables'

// ─── Fixtures ────────────────────────────────────────────────────────────────
function row(o: Partial<RawDebtReceivableRow> = {}): RawDebtReceivableRow {
  return {
    name:             o.name ?? 'Dinner',
    account:          o.account ?? 'Cash',
    date:             o.date ?? '6/2/2026',
    totalAmount:      o.totalAmount ?? '1000',
    participants:     o.participants ?? 'Me;Tw8',
    splitBy:          o.splitBy ?? 'Amount',
    amounts:          o.amounts ?? '500;500',
    category:         o.category ?? 'Food',
    subcategory:      o.subcategory ?? '',
    paidParticipants: o.paidParticipants ?? '',
    status:           o.status ?? 'Pending',
    direction:        o.direction ?? 'Receivable',
    currency:         o.currency ?? 'PHP',
    resolvedAmount:   o.resolvedAmount ?? '',
  }
}

/** Expand the first (or named) record so its participants render. */
async function expandRecord(name?: string) {
  const user = userEvent.setup()
  const btn = name
    ? screen.getByRole('button', { name: new RegExp(name) })
    : screen.getAllByRole('button')[0]
  await user.click(btn)
  return user
}

beforeEach(() => {
  hookState.value = { rows: [], fxMap: FX, isLoading: false, isError: false }
})

describe('DebtsReceivables panel', () => {
  it('renders the title (R6.1)', () => {
    render(<DebtsReceivables privacyMode={false} />)
    expect(screen.getByText('Debts & Receivables')).toBeInTheDocument()
  })

  it('lists records in both directions (R6.2)', () => {
    hookState.value.rows = [
      row({ name: 'Owed to me', direction: 'Receivable' }),
      row({ name: 'I owe them', direction: 'Payable' }),
    ]
    render(<DebtsReceivables privacyMode={false} />)
    const list = within(screen.getByTestId('debts-receivables-list'))
    expect(list.getByText('Owed to me')).toBeInTheDocument()
    expect(list.getByText('I owe them')).toBeInTheDocument()
    expect(list.getByText('Receivable')).toBeInTheDocument()
    expect(list.getByText('Payable')).toBeInTheDocument()
    expect(screen.getAllByTestId('dr-record')).toHaveLength(2)
  })

  it('sorts records chronologically (oldest first); undated last', () => {
    hookState.value.rows = [
      row({ name: 'Later', date: '8/31/2026' }),
      row({ name: 'Undated', date: 'not-a-date' }),
      row({ name: 'Earlier', date: '6/2/2026' }),
      row({ name: 'Middle', date: '7/3/2026' }),
    ]
    render(<DebtsReceivables privacyMode={false} />)
    const recs = screen.getAllByTestId('dr-record')
    const names = recs.map((r) => within(r).getByText(/Later|Undated|Earlier|Middle/).textContent)
    expect(names).toEqual(['Earlier', 'Middle', 'Later', 'Undated'])
  })

  it('collapses participants by default; expands on click; collapses again on second click', async () => {
    hookState.value.rows = [row({ participants: 'Me;Tw8', amounts: '500;500' })]
    render(<DebtsReceivables privacyMode={false} />)
    // collapsed by default
    expect(screen.queryAllByTestId('dr-participant')).toHaveLength(0)
    const btn = screen.getAllByRole('button')[0]
    expect(btn).toHaveAttribute('aria-expanded', 'false')

    const user = userEvent.setup()
    await user.click(btn)
    expect(screen.getAllByTestId('dr-participant')).toHaveLength(2)
    expect(btn).toHaveAttribute('aria-expanded', 'true')

    await user.click(btn)
    // aria-expanded flips immediately; the exit animation then removes the rows
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryAllByTestId('dr-participant')).toHaveLength(0))
  })

  it('shows name, "Mmm dd" date and account; omits blank account (R6.3, R8.1)', () => {
    hookState.value.rows = [row({ name: 'Trip', date: '6/2/2026', account: '' })]
    render(<DebtsReceivables privacyMode={false} />)
    const list = within(screen.getByTestId('debts-receivables-list'))
    expect(list.getByText('Trip')).toBeInTheDocument()
    expect(list.getByText('Jun 02')).toBeInTheDocument()
    // account blank -> not joined with a separator
    expect(list.queryByText(/·\s*$/)).not.toBeInTheDocument()
  })

  it('shows raw date when unparseable and omits when empty (R6.4, R8.7)', () => {
    hookState.value.rows = [row({ name: 'Bad', date: 'not-a-date', account: 'Cash' })]
    render(<DebtsReceivables privacyMode={false} />)
    const list = within(screen.getByTestId('debts-receivables-list'))
    expect(list.getByText(/not-a-date/)).toBeInTheDocument()
  })

  it('foreign record shows PHP primary + native secondary; estimate indicator when unresolved (R4.6, R7.2, R7.3, R8.5)', () => {
    hookState.value.rows = [
      row({ name: 'JP', currency: 'JPY', totalAmount: '8940', resolvedAmount: '', amounts: '8940;0', participants: 'Me;Tw8' }),
    ]
    render(<DebtsReceivables privacyMode={false} />)
    const list = within(screen.getByTestId('debts-receivables-list'))
    // native JPY secondary present on the (always-visible) total row
    expect(list.getAllByText(/¥/).length).toBeGreaterThan(0)
    // pending/estimate indicator present on the total
    expect(list.getByLabelText(/FX-estimated total/)).toBeInTheDocument()
  })

  it('participant rows show shares; Paid shows check; owner labeled "(me)" (R6.5, R6.6, R6.8)', async () => {
    hookState.value.rows = [
      row({ participants: 'Me;Tw8', amounts: '500;500', paidParticipants: 'Tw8:500' }),
    ]
    render(<DebtsReceivables privacyMode={false} />)
    await expandRecord()
    const parts = screen.getAllByTestId('dr-participant')
    expect(parts).toHaveLength(2)
    expect(within(parts[0]).getByText(/Me \(me\)/)).toBeInTheDocument()
    // Tw8 fully paid -> ensure not labeled "(me)"
    expect(within(parts[1]).queryByText(/\(me\)/)).not.toBeInTheDocument()
  })

  it('Partial participant shows paid-of-share (R5.2)', async () => {
    hookState.value.rows = [
      row({ participants: 'Me;Tw8', amounts: '500;500', paidParticipants: 'Tw8:200' }),
    ]
    render(<DebtsReceivables privacyMode={false} />)
    await expandRecord()
    const parts = screen.getAllByTestId('dr-participant')
    expect(within(parts[1]).getByText(/of/)).toBeInTheDocument()
  })

  it('unresolved-payment indicator when a participant pays in a currency with no rate (R5.6, R7.5)', async () => {
    hookState.value.rows = [
      row({ participants: 'Me;Tw8', amounts: '500;500', paidParticipants: 'Tw8:100:XXX' }),
    ]
    render(<DebtsReceivables privacyMode={false} />)
    await expandRecord()
    expect(screen.getByLabelText(/Unresolved payment/)).toBeInTheDocument()
  })

  it('overall status is indicated (R6.7)', () => {
    hookState.value.rows = [
      row({ participants: 'Me;Tw8', amounts: '500;500', paidParticipants: 'Tw8:500' }),
    ]
    render(<DebtsReceivables privacyMode={false} />)
    expect(screen.getByText('Settled')).toBeInTheDocument()
  })

  it('privacy on masks amounts (total + expanded shares); off shows formatted values (R6.9)', async () => {
    hookState.value.rows = [
      row({ currency: 'JPY', totalAmount: '8940', resolvedAmount: '3600', amounts: '8940;0', paidParticipants: '' }),
    ]
    const { rerender } = render(<DebtsReceivables privacyMode={true} />)
    // total is masked even while collapsed
    let list = within(screen.getByTestId('debts-receivables-list'))
    expect(list.getAllByText('••••••').length).toBeGreaterThan(0)
    expect(list.queryByText(/3,600/)).not.toBeInTheDocument()
    // expand and confirm shares are also masked
    await expandRecord()
    expect(within(screen.getByTestId('debts-receivables-list')).getAllByText('••••••').length).toBeGreaterThan(1)

    rerender(<DebtsReceivables privacyMode={false} />)
    list = within(screen.getByTestId('debts-receivables-list'))
    expect(list.queryByText('••••••')).not.toBeInTheDocument()
    expect(list.getByText(/3,600/)).toBeInTheDocument()
  })

  it('loading state shows loader only, no list/empty/error (R6.11)', () => {
    hookState.value.isLoading = true
    render(<DebtsReceivables privacyMode={false} />)
    expect(screen.queryByTestId('debts-receivables-list')).not.toBeInTheDocument()
    expect(screen.queryByText('No records.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('empty views show "No records." only (R6.12)', () => {
    hookState.value.rows = []
    render(<DebtsReceivables privacyMode={false} />)
    expect(screen.getByText('No records.')).toBeInTheDocument()
    expect(screen.queryByTestId('debts-receivables-list')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('error state shows error line only (R6.13)', () => {
    hookState.value.isError = true
    render(<DebtsReceivables privacyMode={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Failed to load debts & receivables data/)
    expect(screen.queryByTestId('debts-receivables-list')).not.toBeInTheDocument()
    expect(screen.queryByText('No records.')).not.toBeInTheDocument()
  })
})
