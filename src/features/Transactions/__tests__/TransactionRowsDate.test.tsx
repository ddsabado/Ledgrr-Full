import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TransactionRows } from '@/features/Transactions/DrillDownList'
import type { RawTransaction } from '@/types/transactions'


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
        fxMap={{ PHP: 1 }}
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
        fxMap={{ PHP: 1 }}
      />,
    )
    expect(screen.getAllByText('garbage-date')).toHaveLength(2)
  })

  it('renders one accessible divider for each contiguous valid local day', () => {
    render(
      <TransactionRows
        transactions={[
          tx({ date: '6/11/2026 13:30:00' }),
          tx({ date: '6/11/2026 08:15:00' }),
          tx({ date: '6/10/2026 18:45:00' }),
          tx({ date: '6/11/2026 07:00:00' }),
        ]}
        mask={mask}
        privacyMode={false}
        fxMap={{ PHP: 1 }}
      />,
    )

    expect(screen.getAllByLabelText('Transactions for Jun 11, 2026')).toHaveLength(2)
    expect(screen.getByLabelText('Transactions for Jun 10, 2026')).toBeInTheDocument()
  })

  it('starts new groups across adjacent days and a year boundary', () => {
    render(
      <TransactionRows
        transactions={[
          tx({ date: '12/31/2026 23:59:00' }),
          tx({ date: '1/1/2027 00:01:00' }),
        ]}
        mask={mask}
        privacyMode={false}
        fxMap={{ PHP: 1 }}
      />,
    )

    expect(screen.getByLabelText('Transactions for Dec 31, 2026')).toBeInTheDocument()
    expect(screen.getByLabelText('Transactions for Jan 01, 2027')).toBeInTheDocument()
  })

  it('keeps invalid and empty dates in distinct fallback groups', () => {
    render(
      <TransactionRows
        transactions={[
          tx({ date: 'not-a-date' }),
          tx({ date: 'not-a-date' }),
          tx({ date: '' }),
          tx({ date: '6/11/2026 13:30:00' }),
        ]}
        mask={mask}
        privacyMode={false}
        fxMap={{ PHP: 1 }}
      />,
    )

    expect(screen.getAllByLabelText('Transactions for not-a-date')).toHaveLength(2)
    expect(screen.getByLabelText('Transactions for Invalid date')).toBeInTheDocument()
    expect(screen.getByLabelText('Transactions for Jun 11, 2026')).toBeInTheDocument()
  })

  it('marks an unresolved foreign-currency transaction as FX-estimated', () => {
    render(
      <TransactionRows
        transactions={[tx({ currency: 'USD', resolvedAmount: null })]}
        mask={mask}
        privacyMode={false}
        fxMap={{ PHP: 1 }}
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
        fxMap={{ PHP: 1 }}
      />,
    )
    const noteElement = screen.getByText(note)
    expect(noteElement).toHaveClass('cursor-pointer')
    await user.hover(noteElement)
    expect(screen.getByRole('tooltip')).toHaveTextContent(note)
  })
})
