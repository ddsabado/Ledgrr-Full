import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import TransactionList from '@/features/CreditCardUtilization/TransactionList'
import type { RawTransaction } from '@/types/transactions'
vi.mock('@/hooks/useCurrencies', () => ({ useCurrencies: () => ({ data: { PHP: 1 }, isLoading: false, isError: false }) }))


let seq = 0
function tx(overrides: Partial<RawTransaction> = {}): RawTransaction {
  seq += 1
  return {
    key:            overrides.key ?? `T${seq}`,
    date:           overrides.date ?? '6/11/2026 13:30:00',
    account:        overrides.account ?? 'Card',
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

describe('CC TransactionList — date formatting', () => {
  it('formats a parseable date as Mmm dd hh:mm AM/PM in smaller metadata text', () => {
    render(
      <TransactionList
        transactions={[tx({ date: '6/11/2026 13:30:00' })]}
        privacyMode={false}
      />,
    )
    const date = screen.getByText('Jun 11 01:30 PM')
    expect(date).toBeInTheDocument()
    expect(date).toHaveClass('text-xs')
  })

  it('passes an unparseable date through unchanged', () => {
    render(
      <TransactionList
        transactions={[tx({ date: 'not-a-date' })]}
        privacyMode={false}
      />,
    )
    expect(screen.getByText('not-a-date')).toBeInTheDocument()
  })

  it('does not render transaction category or subcategory', () => {
    render(
      <TransactionList
        transactions={[tx({ category: 'Food', subcategory: 'Dining' })]}
        privacyMode={false}
      />,
    )
    expect(screen.queryByText('Food')).not.toBeInTheDocument()
    expect(screen.queryByText('Dining')).not.toBeInTheDocument()
  })

  it('shows the full note immediately on hover and keeps the pointer cursor', async () => {
    const note = 'This is the full transaction note shown when the row is truncated.'
    const user = userEvent.setup()
    render(
      <TransactionList
        transactions={[tx({ note })]}
        privacyMode={false}
      />,
    )
    const noteElement = screen.getByText(note)
    expect(noteElement).toHaveClass('cursor-pointer')

    await user.hover(noteElement)
    expect(screen.getByRole('tooltip')).toHaveTextContent(note)
  })
})
