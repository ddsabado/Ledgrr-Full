import { describe, expect, it } from 'vitest'
import { validateGroup } from './validateGroup.ts'

describe('validateGroup', () => {
  it('preserves a provided time in the Sheets-compatible date format', () => {
    const group = validateGroup({ id: 'timed', name: 'Timed group', baseCurrency: 'PHP', members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], expenses: [{ id: 'expense', description: 'Taxi', baseAmount: 20, payerId: 'a', date: '2026-09-29T10:35:00', splits: [{ memberId: 'a', amountBase: 10 }, { memberId: 'b', amountBase: 10 }] }] })
    expect(group?.expenses[0].date).toBe('9/29/2026 10:35:00')
  })

  it('uses receipt-item splits when Splittr supplies them', () => {
    const group = validateGroup({ id: 'items', name: 'Itemized group', baseCurrency: 'PHP', members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], expenses: [{ id: 'expense', description: 'Dinner', baseAmount: 100, payerId: 'a', splits: [{ memberId: 'a', amountBase: 50 }, { memberId: 'b', amountBase: 50 }], items: [{ id: 'item-a', description: 'Pizza', splits: [{ memberId: 'a', amountBase: 20 }, { memberId: 'b', amountBase: 80 }] }] }] })
    expect(group?.expenses[0].shares).toEqual([{ memberId: 'a', amount: 20 }, { memberId: 'b', amount: 80 }])
    expect(group?.expenses[0].items).toEqual([{ description: 'Pizza', shares: [{ memberId: 'a', amount: 20 }, { memberId: 'b', amount: 80 }] }])
  })

  it('keeps every valid expense from Splittr’s current group payload in the preview', () => {
    const group = validateGroup({
      id: 'trip-2026',
      name: 'Weekend trip', baseCurrency: 'PHP',
      members: [{ id: 'maria', name: 'Maria' }, { id: 'noah', name: 'Noah' }],
      expenses: [
        { id: 'hotel', description: 'Hotel', baseAmount: 240, originalAmount: 200, originalCurrency: 'USD', payerId: 'maria', date: '2026-09-20', splits: [{ memberId: 'maria', amountBase: 120 }, { memberId: 'noah', amountBase: 120 }] },
        { id: 'dinner', description: 'Dinner', originalAmount: 80, originalCurrency: 'EUR', payerId: 'noah', date: '2026-09-21', splits: [{ memberId: 'maria', amountBase: 40 }, { memberId: 'noah', amountBase: 40 }] },
      ],
    })

    expect(group?.expenses).toHaveLength(2)
    expect(group?.expenses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hotel', amount: 240, currency: 'PHP', paidByMemberId: 'maria', shares: [{ memberId: 'maria', amount: 120 }, { memberId: 'noah', amount: 120 }] }),
      expect.objectContaining({ id: 'dinner', amount: 80, currency: 'PHP', paidByMemberId: 'noah', shares: [{ memberId: 'maria', amount: 40 }, { memberId: 'noah', amount: 40 }] }),
    ]))
  })

  it('retains compatibility with the previous expense and share fields', () => {
    const group = validateGroup({
      id: 'legacy', name: 'Legacy group', members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      expenses: [{ id: 'expense', description: 'Taxi', amount: 20, currency: 'PHP', paidByMemberId: 'a', shares: [{ memberId: 'a', amount: 10 }, { memberId: 'b', amount: 10 }] }],
    })

    expect(group?.expenses).toHaveLength(1)
  })

  it('retains zero-value member splits so participant identities stay aligned', () => {
    const group = validateGroup({ id: 'zero', name: 'Zero share', baseCurrency: 'PHP', members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], expenses: [{ id: 'e', description: 'Meal', baseAmount: 10, payerId: 'a', splits: [{ memberId: 'a', amountBase: 10 }, { memberId: 'b', amountBase: 0 }] }] })
    expect(group?.expenses[0].shares).toEqual([{ memberId: 'a', amount: 10 }, { memberId: 'b', amount: 0 }])
  })
})
