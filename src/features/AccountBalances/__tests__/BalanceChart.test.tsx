import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import BalanceChart, { MAX_LEGEND_ACCOUNTS } from '@/features/AccountBalances/BalanceChart'
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

describe('BalanceChart compact legend', () => {
  const accounts = [
    acct({ name: 'Small', phpEquivalent: 100 }),
    acct({ name: 'Largest', phpEquivalent: 900 }),
    acct({ name: 'Second', phpEquivalent: 800 }),
    acct({ name: 'Third', phpEquivalent: 700 }),
    acct({ name: 'Fourth', phpEquivalent: 600 }),
    acct({ name: 'Fifth', phpEquivalent: 500 }),
    acct({ name: 'Sixth', phpEquivalent: 400 }),
    acct({ name: 'Seventh', phpEquivalent: 300 }),
    acct({ name: 'Hidden', phpEquivalent: 200 }),
    acct({ name: 'Smallest', phpEquivalent: 100 }),
  ]

  it('renders only the largest accounts in its legend and identifies the remainder', () => {
    render(<BalanceChart accounts={accounts} privacyMode={false} />)

    expect(MAX_LEGEND_ACCOUNTS).toBe(7)
    expect(screen.getByRole('button', { name: 'View activity for Largest' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View activity for Seventh' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View activity for Small' })).not.toBeInTheDocument()
    expect(screen.getByText(`+ ${accounts.length - MAX_LEGEND_ACCOUNTS} more accounts`)).toBeInTheDocument()
  })

  it('uses legend selection without exposing money in privacy mode', async () => {
    const onSelectAccount = vi.fn()
    const user = userEvent.setup()
    render(<BalanceChart accounts={accounts} privacyMode selectedAccount="Largest" onSelectAccount={onSelectAccount} />)

    const largest = screen.getByRole('button', { name: 'View activity for Largest' })
    expect(largest).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/₱/)).not.toBeInTheDocument()
    await user.click(largest)
    expect(onSelectAccount).toHaveBeenCalledWith('Largest')
  })

  it('uses the supplied empty treatment for a filtered-out chart', () => {
    render(<BalanceChart accounts={[]} privacyMode={false} emptyLabel="No matching accounts to chart" />)
    expect(screen.getByRole('status')).toHaveTextContent('No matching accounts to chart')
  })
})
