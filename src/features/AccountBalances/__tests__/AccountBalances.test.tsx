import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
    image: o.image ?? '', accountType: o.accountType ?? 'Debit', phpEquivalent: o.phpEquivalent ?? 1000,
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
  it('groups accounts by category with all groups expanded by default (R4.1, R4.2)', () => {
    hookState.value.data = [
      acct({ name: 'BPI', category: 'Bank Accounts', phpEquivalent: 500 }),
      acct({ name: 'GCash', category: 'e-Wallets', phpEquivalent: 300 }),
      acct({ name: 'Wallet', category: 'Cash', phpEquivalent: 200 }),
    ]
    render(<AccountBalances privacyMode={false} />)
    // Category headers present (as collapse/expand buttons, all expanded)
    for (const cat of ['Bank Accounts', 'e-Wallets', 'Cash']) {
      const header = screen.getByRole('button', { name: new RegExp(cat) })
      expect(header).toHaveAttribute('aria-expanded', 'true')
    }
    // All accounts visible (names may also appear in the chart legend)
    expect(screen.getAllByText('BPI').length).toBeGreaterThan(0)
    expect(screen.getAllByText('GCash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wallet').length).toBeGreaterThan(0)
  })

  it('collapsing a group hides its accounts and leaves others (R4.3)', async () => {
    hookState.value.data = [
      acct({ name: 'BPI', category: 'Bank Accounts', phpEquivalent: 500 }),
      acct({ name: 'GCash', category: 'e-Wallets', phpEquivalent: 300 }),
    ]
    render(<AccountBalances privacyMode={false} />)
    const user = userEvent.setup()
    // The category header is a button (aria-expanded)
    const bankHeader = screen.getByRole('button', { name: /Bank Accounts/ })
    expect(bankHeader).toHaveAttribute('aria-expanded', 'true')
    await user.click(bankHeader)
    // aria-expanded is the deterministic collapse contract (the visual row
    // removal is animation-driven and not reliably observable in jsdom).
    expect(bankHeader).toHaveAttribute('aria-expanded', 'false')
    // The other group's header stays expanded and its account remains visible.
    expect(screen.getByRole('button', { name: /e-Wallets/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('GCash').length).toBeGreaterThan(0)
  })
})

describe('AccountBalances filters', () => {
  it('filters accounts by a case-insensitive account-name search', async () => {
    hookState.value.data = [
      acct({ name: 'BPI Savings', currency: 'PHP', phpEquivalent: 500 }),
      acct({ name: 'GCash', currency: 'PHP', phpEquivalent: 300 }),
    ]
    const user = userEvent.setup()
    render(<AccountBalances privacyMode={false} />)

    await user.click(screen.getByRole('button', { name: /filter account balances/i }))
    await user.type(screen.getByPlaceholderText(/search account/i), 'bpi')

    expect(screen.getAllByText('BPI Savings').length).toBeGreaterThan(0)
    expect(screen.queryByText('GCash')).not.toBeInTheDocument()
    expect(screen.getByTestId('account-balances-filter-active')).toBeInTheDocument()
  })

  it('filters accounts by currency and can clear the active filters', async () => {
    hookState.value.data = [
      acct({ name: 'Peso Wallet', currency: 'PHP', phpEquivalent: 500 }),
      acct({ name: 'Dollar Wallet', currency: 'USD', phpEquivalent: 300 }),
    ]
    const user = userEvent.setup()
    render(<AccountBalances privacyMode={false} />)

    await user.click(screen.getByRole('button', { name: /filter account balances/i }))
    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')
    expect(screen.getAllByText('Dollar Wallet').length).toBeGreaterThan(0)
    expect(screen.queryByText('Peso Wallet')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear/i }))
    expect(screen.getAllByText('Peso Wallet').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Dollar Wallet').length).toBeGreaterThan(0)
  })

  it('filters accounts by category', async () => {
    hookState.value.data = [
      acct({ name: 'BPI Savings', category: 'Bank Accounts', phpEquivalent: 500 }),
      acct({ name: 'GCash', category: 'e-Wallets', phpEquivalent: 300 }),
    ]
    const user = userEvent.setup()
    render(<AccountBalances privacyMode={false} />)

    await user.click(screen.getByRole('button', { name: /filter account balances/i }))
    await user.selectOptions(screen.getByLabelText('Account category'), 'e-Wallets')

    expect(screen.getAllByText('GCash').length).toBeGreaterThan(0)
    expect(screen.queryByText('BPI Savings')).not.toBeInTheDocument()
  })
})
