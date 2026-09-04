import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockAuth, mockSession, mockUser } from '@/test/mocks/supabase'
import { AuthProvider } from '@/context/AuthContext'
import DashboardPage from '@/pages/DashboardPage'

function renderDashboard() {
  return render(
    <AuthProvider>
      <DashboardPage />
    </AuthProvider>
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

  it('renders the placeholder text', () => {
    renderDashboard()
    expect(screen.getByText(/dashboard coming soon/i)).toBeInTheDocument()
  })

  it('renders the user email in nav', async () => {
    renderDashboard()
    // Email appears after session resolves
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

  it('has a fixed nav with correct structure', () => {
    renderDashboard()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
