import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import TransactionList from '@/features/CreditCardUtilization/TransactionList'
import type { RawTransaction } from '@/types/transactions'

const resolveTransactionAmount = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/hooks/useCurrencies', () => ({ useCurrencies: () => ({ data: { PHP: 1 }, isLoading: false, isError: false }) }))
vi.mock('@/services/api', () => ({ resolveTransactionAmount }))


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
    expect(screen.getAllByText('not-a-date')).toHaveLength(2)
  })

  it('renders one labelled divider for each contiguous local calendar-day group', () => {
    render(
      <TransactionList
        transactions={[
          tx({ date: '6/11/2026 13:30:00' }),
          tx({ date: '6/11/2026 08:15:00' }),
          tx({ date: '6/10/2026 18:45:00' }),
          tx({ date: '6/11/2026 07:00:00' }),
        ]}
        privacyMode={false}
      />,
    )

    expect(screen.getAllByLabelText('Transactions for Jun 11, 2026')).toHaveLength(2)
    expect(screen.getByLabelText('Transactions for Jun 10, 2026')).toBeInTheDocument()
  })

  it('starts a new local calendar-day group across adjacent dates and a year boundary', () => {
    render(
      <TransactionList
        transactions={[
          tx({ date: '12/31/2026 23:59:00' }),
          tx({ date: '1/1/2027 00:01:00' }),
        ]}
        privacyMode={false}
      />,
    )

    expect(screen.getByLabelText('Transactions for Dec 31, 2026')).toBeInTheDocument()
    expect(screen.getByLabelText('Transactions for Jan 01, 2027')).toBeInTheDocument()
  })

  it('uses a safe fallback divider for invalid dates without grouping them with valid dates', () => {
    render(
      <TransactionList
        transactions={[
          tx({ date: 'not-a-date' }),
          tx({ date: 'not-a-date' }),
          tx({ date: '6/11/2026 13:30:00' }),
        ]}
        privacyMode={false}
      />,
    )

    expect(screen.getByLabelText('Transactions for not-a-date')).toBeInTheDocument()
    expect(screen.getByLabelText('Transactions for Jun 11, 2026')).toBeInTheDocument()
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

  it('marks an unresolved foreign-currency transaction as FX-estimated', () => {
    render(
      <TransactionList
        transactions={[tx({ currency: 'USD', resolvedAmount: null })]}
        privacyMode={false}
      />,
    )

    expect(screen.getByLabelText('FX-estimated total, pending resolution')).toBeInTheDocument()
  })

  it('explains an FX estimate immediately on hover', async () => {
    const user = userEvent.setup()
    render(
      <TransactionList
        transactions={[tx({ currency: 'USD', resolvedAmount: null })]}
        privacyMode={false}
      />,
    )

    const indicator = screen.getByLabelText('FX-estimated total, pending resolution')
    expect(indicator).toHaveClass('cursor-pointer')

    await user.hover(indicator)
    expect(screen.getByRole('tooltip')).toHaveTextContent('FX-estimated — pending resolution')
  })

  it('opens a resolution dialog from the alert and saves the PHP amount', async () => {
    const user = userEvent.setup()
    const transaction = tx({ key: '42', currency: 'USD', amount: 25, resolvedAmount: null })
    render(<TransactionList transactions={[transaction]} privacyMode={false} />)

    await user.click(screen.getByLabelText('FX-estimated total, pending resolution'))
    expect(screen.getByRole('dialog')).toHaveTextContent('Resolve FX amount')
    await user.type(screen.getByLabelText('Resolved amount (PHP)'), '1450.50')
    await user.click(screen.getByRole('button', { name: 'Save resolved amount' }))

    await waitFor(() => expect(resolveTransactionAmount).toHaveBeenCalledWith('42', 1450.5))
  })

  it('does not mark PHP or resolved foreign-currency transactions as estimated', () => {
    render(
      <TransactionList
        transactions={[
          tx({ currency: 'PHP', resolvedAmount: null }),
          tx({ currency: 'USD', resolvedAmount: 5700 }),
        ]}
        privacyMode={false}
      />,
    )

    expect(screen.queryByLabelText('FX-estimated total, pending resolution')).not.toBeInTheDocument()
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
