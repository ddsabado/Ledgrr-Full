import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

describe('TransactionRows — date formatting (R4.2)', () => {
  it('formats a parseable date as Mmm/dd | hh:mm AM/PM', () => {
    render(
      <TransactionRows
        transactions={[tx({ date: '6/11/2026 13:30:00' })]}
        mask={mask}
        privacyMode={false}
      />,
    )
    expect(screen.getByText('Jun 11 | 01:30 PM')).toBeInTheDocument()
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
})
