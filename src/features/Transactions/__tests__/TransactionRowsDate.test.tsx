import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TransactionRows } from '@/features/Transactions/DrillDownList'
import type { RawTransaction } from '@/types/transactions'
vi.mock('@/hooks/useCurrencies', () => ({ useCurrencies: () => ({ data: { PHP: 1 }, isLoading: false, isError: false }) }))


let seq = 0
function tx(overrides: Partial<RawTransaction> = {}): RawTransaction {
  seq += 1
  return {
    key:            overrides.key ?? `T${seq}`,
    date:           overrides.date ?? '6/11/2026 13:30:00',
    account:        overrides.account ?? 'Cash',
    amount:         overrides.amount ?? 100,
    resolvedAmount: overrides.resolvedAmount ?? null,
    currency:       overrides.currency ?? 'PHP',
    targetAccount:  overrides.targetAccount ?? '',
    type:           overrides.type ?? 'Expense',
    category:       overrides.category ?? 'Food',
    subcategory:    overrides.subcategory ?? '',
    budget:         overrides.budget ?? '',
    note:           overrides.note ?? '',
  }
}

const mask = (n: number) => String(n)

describe('TransactionRows — date formatting and notes', () => {
  it('formats a parseable date as Mmm dd hh:mm AM/PM while keeping the account', () => {
    render(
      <TransactionRows
        transactions={[tx({ date: '6/11/2026 13:30:00' })]}
        mask={mask}
        privacyMode={false}
      />,
    )
    expect(screen.getByText('Jun 11 01:30 PM')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })

  it('passes an unparseable date through unchanged', () => {
    render(
      <TransactionRows
        transactions={[tx({ date: 'garbage-date' })]}
        mask={mask}
        privacyMode={false}
      />,
    )
    expect(screen.getByText('garbage-date')).toBeInTheDocument()
  })

  it('marks an unresolved foreign-currency transaction as FX-estimated', () => {
    render(
      <TransactionRows
        transactions={[tx({ currency: 'USD', resolvedAmount: null })]}
        mask={mask}
        privacyMode={false}
      />,
    )

    expect(screen.getByLabelText('FX-estimated total, pending resolution')).toBeInTheDocument()
  })

  it('shows the full note immediately on hover with a pointer cursor', async () => {
    const note = 'Full transaction note shown in the tooltip.'
    const user = userEvent.setup()
    render(
      <TransactionRows
        transactions={[tx({ note })]}
        mask={mask}
        privacyMode={false}
      />,
    )
    const noteElement = screen.getByText(note)
    expect(noteElement).toHaveClass('cursor-pointer')
    await user.hover(noteElement)
    expect(screen.getByRole('tooltip')).toHaveTextContent(note)
  })
})
