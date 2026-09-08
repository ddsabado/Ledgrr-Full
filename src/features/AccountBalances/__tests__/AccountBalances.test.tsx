import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { AccountBalance } from '@/types/accounts'

// ─── Mock the data hook ───────────────────────────────────────────────────────
const hookState: {
  value: { data: AccountBalance[]; isLoading: boolean; isError: boolean }
} = { value: { data: [], isLoading: false, isError: false } }

vi.mock('@/hooks/useAccountBalances', () => ({
  useAccountBalances: () => hookState.value,
}))

import AccountBalances from '@/features/AccountBalances'

function acct(o: Partial<AccountBalance> = {}): AccountBalance {
  return {
    name: o.name ?? 'Cash', category: o.category ?? 'Cash', currency: o.currency ?? 'PHP',
    currentBalance: o.currentBalance ?? 1000, initialBalance: o.initialBalance ?? 0,
    creditLimit: o.creditLimit ?? 0, statementDay: o.statementDay ?? null, dueDay: o.dueDay ?? null,
    image: o.image ?? '', phpEquivalent: o.phpEquivalent ?? 1000,
  }
}

beforeEach(() => {
  hookState.value = { data: [], isLoading: false, isError: false }
})

describe('AccountBalances — percentage masking (R3)', () => {
  it('masks the percentage in privacy mode and shows it when off (R3.1, R3.2)', () => {
    hookState.value.data = [
      acct({ name: 'A', phpEquivalent: 700 }),
      acct({ name: 'B', phpEquivalent: 300 }),
    ]
    const { rerender } = render(<AccountBalances privacyMode={true} />)
    // percentages masked (no "70.0%"/"30.0%")
    expect(screen.queryByText(/70\.0%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/30\.0%/)).not.toBeInTheDocument()
    // masks present
    expect(screen.getAllByText('••••••').length).toBeGreaterThan(0)

    rerender(<AccountBalances privacyMode={false} />)
    expect(screen.getByText('70.0%')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
  })

  it('renders the percentage as a color-coded indicator (color applied to the % text)', () => {
    hookState.value.data = [acct({ name: 'A', phpEquivalent: 1000 })]
    render(<AccountBalances privacyMode={false} />)
    const pct = screen.getByText('100.0%')
    // The percentage carries an inline color (doubles as the color indicator).
    expect(pct.getAttribute('style') ?? '').toMatch(/color/)
  })
})
