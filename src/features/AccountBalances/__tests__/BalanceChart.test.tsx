import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import BalanceChart from '@/features/AccountBalances/BalanceChart'
import type { AccountBalance } from '@/types/accounts'

function acct(o: Partial<AccountBalance> = {}): AccountBalance {
  return {
    name: o.name ?? 'Cash', category: 'Cash', currency: o.currency ?? 'PHP',
    currentBalance: o.currentBalance ?? 1000, initialBalance: 0, creditLimit: 0,
    statementDay: null, dueDay: null, image: '', accountType: o.accountType ?? 'Debit', phpEquivalent: o.phpEquivalent ?? 1000,
  }
}

describe('BalanceChart empty degrade (R1.3, R1.4)', () => {
  it('renders the placeholder at the reserved height when there are no accounts', () => {
    const { container } = render(<BalanceChart accounts={[]} privacyMode={false} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('No data to display')
    expect(status.className).toMatch(/h-64/)
    // no chart svg rendered
    expect(container.querySelector('.recharts-wrapper')).toBeNull()
  })

  it('renders a chart (no placeholder) when accounts exist', () => {
    render(<BalanceChart accounts={[acct()]} privacyMode={false} />)
    expect(screen.queryByText('No data to display')).not.toBeInTheDocument()
  })
})
