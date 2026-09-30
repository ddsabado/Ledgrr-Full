export type SettlementMember = { id: string; name: string }
export type SettlementExpense = {
  paidByMemberId: string
  amount: number
  shares: Array<{ memberId: string; amount: number }>
}
export type Settlement = { fromMemberId: string; toMemberId: string; amount: number }

const cents = (amount: number) => Math.round(amount * 100)

/**
 * Simplify all included group expenses at once. Amounts are converted to cents
 * before matching so browser previews and Edge Function writes agree exactly.
 */
export function simplifySplittrSettlements(
  members: SettlementMember[],
  expenses: SettlementExpense[],
): Settlement[] {
  const nets = new Map(members.map((member) => [member.id, 0]))
  for (const expense of expenses) {
    nets.set(expense.paidByMemberId, (nets.get(expense.paidByMemberId) ?? 0) + cents(expense.amount))
    for (const share of expense.shares) nets.set(share.memberId, (nets.get(share.memberId) ?? 0) - cents(share.amount))
  }

  const debtors = [...nets.entries()].filter(([, net]) => net < 0).map(([id, net]) => ({ id, cents: -net })).sort((a, b) => a.id.localeCompare(b.id))
  const creditors = [...nets.entries()].filter(([, net]) => net > 0).map(([id, net]) => ({ id, cents: net })).sort((a, b) => a.id.localeCompare(b.id))
  const settlements: Settlement[] = []
  let debtorIndex = 0
  let creditorIndex = 0
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = Math.min(debtor.cents, creditor.cents)
    settlements.push({ fromMemberId: debtor.id, toMemberId: creditor.id, amount: amount / 100 })
    debtor.cents -= amount
    creditor.cents -= amount
    if (debtor.cents === 0) debtorIndex++
    if (creditor.cents === 0) creditorIndex++
  }
  return settlements
}

export function settlementsForMember(
  members: SettlementMember[],
  expenses: SettlementExpense[],
  memberId: string,
): Settlement[] {
  return simplifySplittrSettlements(members, expenses).filter((settlement) => settlement.fromMemberId === memberId || settlement.toMemberId === memberId)
}
