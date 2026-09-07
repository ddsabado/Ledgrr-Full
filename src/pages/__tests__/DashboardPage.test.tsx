import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockAuth, mockSession, mockUser } from '@/test/mocks/supabase'
import { AuthProvider } from '@/context/AuthContext'
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

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DashboardPage />
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
})
