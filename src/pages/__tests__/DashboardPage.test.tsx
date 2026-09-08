import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockAuth, mockSession, mockUser } from '@/test/mocks/supabase'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import DashboardPage from '@/pages/DashboardPage'

// Mock useAccountBalances so DashboardPage tests don't depend on the fetch pipeline
vi.mock('@/hooks/useAccountBalances', () => ({
  useAccountBalances: () => ({ data: [], isLoading: false, isError: false }),
}))

// Mock the CC hooks so the CreditCardUtilization panel renders its empty state
// without touching the transactions fetch/collection pipeline
vi.mock('@/hooks/useCCAccounts', () => ({
  useCCAccounts: () => ({ data: [], isLoading: false, isError: false }),
}))
vi.mock('@/hooks/useCCTransactions', () => ({
  useCCTransactions: () => ({ data: new Map(), isLoading: false, isError: false }),
}))

// Mock the Transactions panel hook so DashboardPage tests don't touch the
// transactions live-query pipeline
// Mock the Debts & Receivables hook so DashboardPage tests render the panel
// with a deterministic record (no live-query/fetch pipeline)
vi.mock('@/features/DebtsReceivables/useDebtsReceivables', () => ({
  useDebtsReceivables: () => ({
    rows: [
      {
        name: 'Dinner', account: 'Cash', date: '6/2/2026', totalAmount: '1000',
        participants: 'Me;Tw8', splitBy: 'Amount', amounts: '500;500', category: 'Food',
        subcategory: '', paidParticipants: '', status: 'Pending', direction: 'Receivable',
        currency: 'PHP', resolvedAmount: '',
      },
    ],
    fxMap: { PHP: 1 },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/features/Transactions/useTransactionsByPeriod', () => {
  const empty = { periods: [], currentIndex: 0 }
  return {
    useTransactionsByPeriod: () => ({
      grouped: { month: empty, week: empty, day: empty },
      isLoading: false,
      isError: false,
    }),
  }
})

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <DashboardPage />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('renders the Ledgrr brand in nav', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: /ledgrr/i })).toBeInTheDocument()
  })

  it('renders AccountBalances card (empty state)', () => {
    renderDashboard()
    expect(screen.getByText(/no accounts found/i)).toBeInTheDocument()
  })

  it('renders the user email in nav', async () => {
    renderDashboard()
    const emails = await screen.findAllByText(mockUser.email!)
    expect(emails.length).toBeGreaterThan(0)
  })

  it('renders sign out button', () => {
    renderDashboard()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('calls signOut when sign out button is clicked', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await user.click(screen.getByRole('button', { name: /sign out/i }))
    expect(mockAuth.signOut).toHaveBeenCalled()
  })

  it('renders privacy mode toggle button', () => {
    renderDashboard()
    expect(screen.getByRole('button', { name: /hide amounts/i })).toBeInTheDocument()
  })

  it('has a fixed nav with correct structure', () => {
    renderDashboard()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
  it('renders the Debts & Receivables panel', () => {
    renderDashboard()
    expect(screen.getByText('Debts & Receivables')).toBeInTheDocument()
    expect(screen.getByTestId('debts-receivables-list')).toBeInTheDocument()
  })

  it('toggling privacy masks the Debts & Receivables amounts', async () => {
    const user = userEvent.setup()
    renderDashboard()
    // amounts visible initially
    expect(screen.queryByText('••••••')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /hide amounts/i }))
    expect(screen.getAllByText('••••••').length).toBeGreaterThan(0)
  })
})
