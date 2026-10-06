import { describe, expect, it } from 'vitest'

import { adjustmentTransactionRow, formatAdjustmentTimestamp, isAdjustBalanceInput } from '../../../../supabase/functions/accounts-balances/adjustBalance'
import { adjustedCurrentBalanceFormula, currentBalanceFormula } from '../../../../supabase/functions/accounts-balances/formulas'

describe('account balance adjustment helpers', () => {
  it('keeps the pre-feature formula for credit cards and scopes Adjustment to adjusted accounts', () => {
    const creditFormula = currentBalanceFormula(7)
    expect(creditFormula).toBe('=D7+SUMPRODUCT((Transactions!C2:C=A7)*(Transactions!H2:H="Expense")*Transactions!D2:D*IFERROR(VLOOKUP(Transactions!F2:F,Currency!$A:$B,2,0),1)/IFERROR(VLOOKUP(E7,Currency!$A:$B,2,0),1))+SUMPRODUCT((Transactions!C2:C=A7)*(Transactions!H2:H="Transfer")*Transactions!D2:D*IFERROR(VLOOKUP(Transactions!F2:F,Currency!$A:$B,2,0),1)/IFERROR(VLOOKUP(E7,Currency!$A:$B,2,0),1))-SUMPRODUCT((Transactions!G2:G=A7)*(Transactions!H2:H="Transfer")*Transactions!D2:D*IFERROR(VLOOKUP(Transactions!F2:F,Currency!$A:$B,2,0),1)/IFERROR(VLOOKUP(E7,Currency!$A:$B,2,0),1))')
    expect(adjustedCurrentBalanceFormula(7)).toContain('Transactions!H2:H="Adjustment"')
  })

  it('only accepts a named finite target and writes the signed B:L adjustment row', () => {
    expect(isAdjustBalanceInput({ accountName: 'Cash', targetBalance: 125 })).toBe(true)
    expect(isAdjustBalanceInput({ accountName: '', targetBalance: 125 })).toBe(false)
    expect(isAdjustBalanceInput({ accountName: 'Cash', targetBalance: Number.POSITIVE_INFINITY })).toBe(false)
    expect(adjustmentTransactionRow('9/19/2026 20:34:00', 'Cash', 'PHP', -25, 75)).toEqual([
      '9/19/2026 20:34:00', 'Cash', '-25', '', 'PHP', '', 'Adjustment', 'Adjustment', '', '', 'Manual adjustment: 75',
    ])
  })

  it('formats adjustment timestamps in Manila sheet time', () => {
    expect(formatAdjustmentTimestamp(new Date('2026-09-19T12:34:00.000Z'))).toBe('9/19/2026 20:34:00')
  })
})
