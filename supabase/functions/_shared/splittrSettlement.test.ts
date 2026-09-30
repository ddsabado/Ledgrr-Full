import { describe, expect, it } from 'vitest'
import { settlementsForMember, simplifySplittrSettlements } from './splittrSettlement.ts'

const members = [{ id: 'DW8', name: 'DW8' }, { id: 'MEM2', name: 'MEM2' }, { id: 'MEM3', name: 'MEM3' }]
const expenses = [
  { paidByMemberId: 'DW8', amount: 100, shares: [{ memberId: 'DW8', amount: 18.67 }, { memberId: 'MEM2', amount: 29.66 }, { memberId: 'MEM3', amount: 51.67 }] },
  { paidByMemberId: 'MEM2', amount: 100, shares: [{ memberId: 'DW8', amount: 29.66 }, { memberId: 'MEM2', amount: 40.68 }, { memberId: 'MEM3', amount: 29.66 }] },
]

describe('simplifySplittrSettlements', () => {
  it('nets the entire group before deriving selected-member settlements', () => {
    expect(simplifySplittrSettlements(members, expenses)).toEqual([
      { fromMemberId: 'MEM3', toMemberId: 'DW8', amount: 51.67 },
      { fromMemberId: 'MEM3', toMemberId: 'MEM2', amount: 29.66 },
    ])
    expect(settlementsForMember(members, expenses, 'DW8')).toEqual([
      { fromMemberId: 'MEM3', toMemberId: 'DW8', amount: 51.67 },
    ])
  })

  it('uses integer cents to avoid floating-point settlement drift', () => {
    expect(simplifySplittrSettlements(
      [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      [{ paidByMemberId: 'a', amount: 0.3, shares: [{ memberId: 'a', amount: 0.1 }, { memberId: 'b', amount: 0.2 }] }],
    )).toEqual([{ fromMemberId: 'b', toMemberId: 'a', amount: 0.2 }])
  })
})
