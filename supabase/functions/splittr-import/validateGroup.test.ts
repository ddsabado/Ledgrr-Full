import { describe, expect, it } from 'vitest'
import { validateGroup } from './validateGroup.ts'

describe('validateGroup', () => {
  it('keeps every valid expense from Splittr’s current group payload in the preview', () => {
    const group = validateGroup({
      id: 'trip-2026',
      name: 'Weekend trip',
      members: [{ id: 'maria', name: 'Maria' }, { id: 'noah', name: 'Noah' }],
      expenses: [
        { id: 'hotel', description: 'Hotel', baseAmount: 240, originalAmount: 200, originalCurrency: 'USD', payerId: 'maria', date: '2026-09-20', splits: [{ memberId: 'maria', amountBase: 120 }, { memberId: 'noah', amountBase: 120 }] },
        { id: 'dinner', description: 'Dinner', originalAmount: 80, originalCurrency: 'EUR', payerId: 'noah', date: '2026-09-21', splits: [{ memberId: 'maria', amountBase: 40 }, { memberId: 'noah', amountBase: 40 }] },
      ],
    })

    expect(group?.expenses).toHaveLength(2)
    expect(group?.expenses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hotel', amount: 240, currency: 'USD', paidByMemberId: 'maria', shares: [{ memberId: 'maria', amount: 120 }, { memberId: 'noah', amount: 120 }] }),
      expect.objectContaining({ id: 'dinner', amount: 80, currency: 'EUR', paidByMemberId: 'noah', shares: [{ memberId: 'maria', amount: 40 }, { memberId: 'noah', amount: 40 }] }),
    ]))
  })

  it('retains compatibility with the previous expense and share fields', () => {
    const group = validateGroup({
      id: 'legacy', name: 'Legacy group', members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      expenses: [{ id: 'expense', description: 'Taxi', amount: 20, currency: 'PHP', paidByMemberId: 'a', shares: [{ memberId: 'a', amount: 10 }, { memberId: 'b', amount: 10 }] }],
    })

    expect(group?.expenses).toHaveLength(1)
  })
})
