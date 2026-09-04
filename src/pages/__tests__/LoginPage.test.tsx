import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockAuth } from '@/test/mocks/supabase'
import { AuthProvider } from '@/context/AuthContext'
import LoginPage from '@/pages/LoginPage'

function renderLoginPage(props = { loading: false, error: null as string | null }) {
  return render(
    <AuthProvider>
      <LoginPage {...props} />
    </AuthProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('renders the Ledgrr brand name', () => {
    renderLoginPage()
    expect(screen.getByRole('heading', { name: /ledgrr/i })).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    renderLoginPage()
    expect(screen.getByText(/sign in to access your dashboard/i)).toBeInTheDocument()
  })

  it('renders the Google sign-in button', () => {
    renderLoginPage()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('calls signInWithGoogle when button is clicked', async () => {
    const user = userEvent.setup()
    renderLoginPage()
    await user.click(screen.getByRole('button', { name: /sign in with google/i }))
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    )
  })

  it('shows spinner instead of button when loading', () => {
    renderLoginPage({ loading: true, error: null })
    expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows error message when error prop is set', () => {
    renderLoginPage({ loading: false, error: 'Login failed. Please try again.' })
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.textContent).toBe('Login failed. Please try again.')
  })

  it('does not show error when error prop is null', () => {
    renderLoginPage({ loading: false, error: null })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Google button is accessible with aria-label', () => {
    renderLoginPage()
    expect(
      screen.getByRole('button', { name: /sign in with google/i })
    ).toBeInTheDocument()
  })

  it('spinner has accessible role and label', () => {
    renderLoginPage({ loading: true, error: null })
    const spinner = screen.getByRole('status')
    expect(spinner).toHaveAttribute('aria-label', 'Signing in')
  })
})
