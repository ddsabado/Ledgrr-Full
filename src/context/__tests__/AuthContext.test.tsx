import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockAuth, mockSession, mockUser } from '@/test/mocks/supabase'

// Must be imported after mock setup
import { AuthProvider, useAuth } from '@/context/AuthContext'

// Helper: renders a component that exposes auth context values
function AuthConsumer() {
  const { session, user, loading, signInWithGoogle, signInWithGoogleReauth, signOut } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user-email">{user?.email ?? 'none'}</span>
      <span data-testid="session">{session ? 'has-session' : 'no-session'}</span>
      <button onClick={signInWithGoogle}>sign-in</button>
      <button onClick={signInWithGoogleReauth}>reauth</button>
      <button onClick={signOut}>sign-out</button>
    </div>
  )
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('starts in loading state', () => {
    // getSession hasn't resolved yet
    mockAuth.getSession.mockReturnValue(new Promise(() => {}))
    renderWithAuth()
    expect(screen.getByTestId('loading').textContent).toBe('true')
  })

  it('resolves session on mount', async () => {
    renderWithAuth()
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('user-email').textContent).toBe(mockUser.email)
    expect(screen.getByTestId('session').textContent).toBe('has-session')
  })

  it('shows no session when unauthenticated', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    renderWithAuth()
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('user-email').textContent).toBe('none')
    expect(screen.getByTestId('session').textContent).toBe('no-session')
  })

  it('calls signInWithOAuth with correct provider and scopes', async () => {
    const user = userEvent.setup()
    renderWithAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    await user.click(screen.getByText('sign-in'))

    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          scopes: 'https://www.googleapis.com/auth/spreadsheets',
          queryParams: expect.objectContaining({
            access_type: 'offline',
          }),
        }),
      })
    )
  })

  it('normal signInWithGoogle does NOT include prompt: consent', async () => {
    const user = userEvent.setup()
    renderWithAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    await user.click(screen.getByText('sign-in'))

    const callArgs = mockAuth.signInWithOAuth.mock.calls[0][0]
    expect(callArgs.options.queryParams?.prompt).toBeUndefined()
  })

  it('signInWithGoogleReauth includes prompt: consent', async () => {
    const user = userEvent.setup()
    renderWithAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    await user.click(screen.getByText('reauth'))

    const callArgs = mockAuth.signInWithOAuth.mock.calls[0][0]
    expect(callArgs.options.queryParams.prompt).toBe('consent')
  })

  it('redirectTo points to /dashboard', async () => {
    const user = userEvent.setup()
    renderWithAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    await user.click(screen.getByText('sign-in'))

    const callArgs = mockAuth.signInWithOAuth.mock.calls[0][0]
    expect(callArgs.options.redirectTo).toContain('/dashboard')
  })

  it('calls signOut on logout', async () => {
    const user = userEvent.setup()
    renderWithAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    await user.click(screen.getByText('sign-out'))

    expect(mockAuth.signOut).toHaveBeenCalled()
  })

  it('updates session when onAuthStateChange fires', async () => {
    let authChangeCallback: ((event: string, session: unknown) => void) | null = null

    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    renderWithAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('session').textContent).toBe('no-session')

    // Simulate SIGNED_IN event
    act(() => {
      authChangeCallback?.('SIGNED_IN', mockSession)
    })

    await waitFor(() => {
      expect(screen.getByTestId('session').textContent).toBe('has-session')
    })
  })

  it('clears session when onAuthStateChange fires SIGNED_OUT', async () => {
    let authChangeCallback: ((event: string, session: unknown) => void) | null = null

    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    renderWithAuth()
    await waitFor(() => expect(screen.getByTestId('session').textContent).toBe('has-session'))

    act(() => {
      authChangeCallback?.('SIGNED_OUT', null)
    })

    await waitFor(() => {
      expect(screen.getByTestId('session').textContent).toBe('no-session')
    })
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within AuthProvider')
    consoleSpy.mockRestore()
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    const unsubscribeMock = vi.fn()
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    })

    const { unmount } = renderWithAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    unmount()
    expect(unsubscribeMock).toHaveBeenCalled()
  })
})
