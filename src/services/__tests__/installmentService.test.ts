import { describe, expect, it } from 'vitest'

import { buildInstallmentTransactions } from '@/services/installmentService'

describe('buildInstallmentTransactions', () => {
  it('starts after the statement day in the following statement cycle', () => {
    const transactions = buildInstallmentTransactions({
      kind: 'installment',
      name: 'Laptop',
      totalAmount: 3000,
      terms: 3,
      startDate: '9/25/2026',
      account: 'HSBC CC',
      budget: 'Gadgets',
      currency: 'PHP',
      statementDay: 23,
      transactionTime: '00:00:00',
    })

    expect(transactions).toEqual([
      expect.objectContaining({ date: '10/23/2026 00:00:00', amount: 1000, note: 'Laptop (1/3)' }),
      expect.objectContaining({ date: '11/23/2026 00:00:00', amount: 1000, note: 'Laptop (2/3)' }),
      expect.objectContaining({ date: '12/23/2026 00:00:00', amount: 1000, note: 'Laptop (3/3)' }),
    ])
  })
})
