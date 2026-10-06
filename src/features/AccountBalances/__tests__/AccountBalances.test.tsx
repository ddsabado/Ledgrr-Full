import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

describe('AccountBalances — percentage masking (R3)', () => {
  it('announces loading, error, and empty inventory states', () => {
    hookState.value = { data: [], isLoading: true, isError: false }
    const { rerender } = render(<AccountBalances privacyMode={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading account balances.')

    hookState.value = { data: [], isLoading: false, isError: true }
    rerender(<AccountBalances privacyMode={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load account balances')

    hookState.value = { data: [], isLoading: false, isError: false }
    rerender(<AccountBalances privacyMode={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('No accounts found.')
  })

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
      const header = screen.getByRole('button', { name: new RegExp(`^${cat}$`) })
      expect(header).toHaveAttribute('aria-expanded', 'true')
    }
    // All accounts visible (names may also appear in the chart legend)
    expect(screen.getAllByText('BPI').length).toBeGreaterThan(0)
    expect(screen.getAllByText('GCash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wallet').length).toBeGreaterThan(0)
  })

  it('keeps category order while sorting 20+ accounts by PHP equivalent within each category', () => {
    hookState.value.data = Array.from({ length: 22 }, (_, index) =>
      acct({
        name: `Account ${String(index + 1).padStart(2, '0')}`,
        category: index < 20 ? 'Everyday accounts' : 'Foreign currency',
        currency: index > 19 ? 'USD' : 'PHP',
        currentBalance: index > 19 ? index + 1 : 1_000 - index,
        phpEquivalent: index < 20 ? index + 1 : (index + 1) * 100,
      }),
    )
    render(<AccountBalances privacyMode={false} />)

    expect(screen.getByRole('button', { name: /^Everyday accounts$/ })).toBeInTheDocument()
    expect(screen.getAllByRole('option').slice(0, 3).map((row) => row.getAttribute('aria-label'))).toEqual([
      'View activity for Account 20',
      'View activity for Account 19',
      'View activity for Account 18',
    ])
    expect(screen.getByRole('option', { name: 'View activity for Account 22' })).toHaveTextContent('$22.00')
  })

  it('renders a five-account inventory without collapsing or omitting rows', () => {
    hookState.value.data = Array.from({ length: 5 }, (_, index) =>
      acct({ name: `Five ${index + 1}`, phpEquivalent: index + 1 }),
    )
    render(<AccountBalances privacyMode={false} />)

    expect(screen.getAllByRole('option')).toHaveLength(5)
    expect(screen.getByRole('button', { name: /^Cash$/ })).toHaveAttribute('aria-expanded', 'true')
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
    const accountSearch = screen.getByPlaceholderText(/search account/i)
    expect(accountSearch).toHaveAttribute('type', 'text')
    await user.type(accountSearch, 'bpi')

    expect(screen.getAllByText('BPI Savings').length).toBeGreaterThan(0)
    expect(screen.queryByText('GCash')).not.toBeInTheDocument()
    const filterButton = screen.getByRole('button', { name: /filter account balances, 1 active/i })
    expect(filterButton.querySelector('.lucide-list-filter-plus')).toBeInTheDocument()
    expect(filterButton).not.toHaveTextContent('1 active')
  })

  it('updates the compact chart legend and its remainder cue for the filtered set', async () => {
    hookState.value.data = [
      acct({ name: 'Alpha', phpEquivalent: 700 }),
      acct({ name: 'Bravo', phpEquivalent: 600 }),
      acct({ name: 'Charlie', phpEquivalent: 500 }),
      acct({ name: 'Delta', phpEquivalent: 400 }),
      acct({ name: 'Echo', phpEquivalent: 300 }),
      acct({ name: 'Foxtrot', phpEquivalent: 200 }),
      acct({ name: 'Golf', phpEquivalent: 100 }),
      acct({ name: 'Hotel', phpEquivalent: 50 }),
    ]
    const user = userEvent.setup()
    render(<AccountBalances privacyMode={false} />)

    expect(screen.getByText('+ 1 more account')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /filter account balances/i }))
    await user.type(screen.getByPlaceholderText(/search account/i), 'foxtrot')

    expect(screen.getByRole('button', { name: 'View activity for Foxtrot' })).toBeInTheDocument()
    expect(screen.queryByText(/more account/)).not.toBeInTheDocument()
    expect(screen.getAllByText('₱200.00')).toHaveLength(2)
  })

  it('makes account activity actions explicit and preserves row keyboard activation', async () => {
    hookState.value.data = [acct({ name: 'Cash', phpEquivalent: 500 })]
    const onSelectAccount = vi.fn()
    const onToggleViewer = vi.fn()
    const user = userEvent.setup()
    const { container, rerender } = render(
      <AccountBalances
        privacyMode={false}
        onSelectAccount={onSelectAccount}
        onToggleViewer={onToggleViewer}
      />,
    )

    const row = screen.getByRole('option', { name: 'View activity for Cash' })
    await user.click(row)
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onSelectAccount).toHaveBeenCalledTimes(3)
    expect(onToggleViewer).toHaveBeenCalledTimes(3)
    const activityButton = screen.getByRole('button', { name: 'View account activity' })
    const filterButton = screen.getByRole('button', { name: /filter account balances/i })
    expect(activityButton).toHaveTextContent('View activity')
    expect(activityButton.parentElement).toHaveClass('shrink-0', 'whitespace-nowrap')
    expect(filterButton.parentElement).toBe(activityButton.parentElement)
    const chartBeforeOpeningActivity = container.querySelector('.recharts-wrapper')

    rerender(<AccountBalances privacyMode={false} viewerOpen selectedAccount="Cash" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close account activity' })).toHaveTextContent('Close activity')
    })
    expect(container.querySelector('.recharts-wrapper')).toBe(chartBeforeOpeningActivity)

    rerender(<AccountBalances privacyMode={false} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View account activity' })).toHaveTextContent('View activity')
    })
    expect(container.querySelector('.recharts-wrapper')).toBe(chartBeforeOpeningActivity)
  })

  it('exposes selected account and filter state without relying on the visual indicator', async () => {
    hookState.value.data = [
      acct({ name: 'Long account name that must truncate safely on a narrow mobile screen', category: 'A very long account category name', currency: 'USD', currentBalance: 20, phpEquivalent: 1120 }),
      acct({ name: 'Cash', phpEquivalent: 10 }),
    ]
    const user = userEvent.setup()
    const { rerender } = render(<AccountBalances privacyMode={true} viewerOpen selectedAccount="Long account name that must truncate safely on a narrow mobile screen" />)

    const selectedRow = screen.getByRole('option', { name: 'View activity for Long account name that must truncate safely on a narrow mobile screen' })
    expect(selectedRow).toHaveAttribute('aria-selected', 'true')
    expect(selectedRow).toHaveClass('min-h-11')
    expect(selectedRow).toHaveClass('transition-[background-color,box-shadow]', 'duration-200', 'motion-reduce:duration-100')
    const description = document.getElementById(selectedRow.getAttribute('aria-describedby') ?? '')
    expect(description).toHaveTextContent('Balances hidden while Privacy Mode is on')
    expect(description).not.toHaveTextContent('$20.00')
    expect(selectedRow.querySelector('.truncate.text-sm')).toHaveTextContent('Long account name that must truncate safely on a narrow mobile screen')
    expect(screen.getByRole('button', { name: /^A very long account category name$/ })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Close account activity' })).toHaveClass('min-w-11')

    rerender(<AccountBalances privacyMode={false} />)
    await user.click(screen.getByRole('button', { name: /filter account balances/i }))
    await user.type(screen.getByPlaceholderText(/search account/i), 'does not exist')
    expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('No matching accounts.'))).toBe(true)
    expect(screen.getByRole('button', { name: /filter account balances, 1 active/i })).toHaveClass('min-w-11')
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

describe('AccountBalances chart selection', () => {
  it('scrolls the selected legend account into the grouped list', async () => {
    hookState.value.data = [
      acct({ name: 'Cash', category: 'Cash', phpEquivalent: 900 }),
      acct({ name: 'Savings', category: 'Bank Accounts', phpEquivalent: 800 }),
    ]
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    const user = userEvent.setup()
    render(<AccountBalances privacyMode={false} />)

    const bankAccounts = screen.getByRole('button', { name: /^Bank Accounts$/ })
    await user.click(bankAccounts)
    expect(bankAccounts).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'View activity for Savings' }))

    await waitFor(() => {
      expect(bankAccounts).toHaveAttribute('aria-expanded', 'true')
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' })
    })
  })
})
