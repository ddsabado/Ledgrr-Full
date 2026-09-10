import { describe, expect, it } from 'vitest'

import { isTransactionInMonth } from '@/features/InstallmentsRecurring/useInstallmentTransactions'

describe('isTransactionInMonth', () => {
  const august2026 = { year: 2026, month: 7 }

  it.each([
    '8/22/2026',
    '8/22/2026 0:00:00',
    '08/22/2026 00:00:00',
    '08/22/2026 14:01:00',
  ])('accepts a Sheets transaction date of %s', (date) => {
    expect(isTransactionInMonth(date, august2026)).toBe(true)
  })

  it('does not match a different month', () => {
    expect(isTransactionInMonth('9/22/2026 00:00:00', august2026)).toBe(false)
  })
})
