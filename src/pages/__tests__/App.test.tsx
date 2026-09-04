import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { mockAuth, mockSession, mockSessionNoProviderToken } from '@/test/mocks/supabase'
import App from '@/App'

// Mock window.location.replace
const mockReplace = vi.fn()
Object.defineProperty(window, 'location', {
  value: { ...window.location, replace: mockReplace, pathname: '/' },
  writable: true,
})

// Mock fetch for auth-store-tokens call
const mockFetch = vi.fn().mockResolvedValue({
  ok:     true,
  status: 201,
  json:   async () => { throw new Error('No body') },
})
vi.stubGlobal('fetch', mockFetch)

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, status: 201, json: async () => { throw new Error('No body') } })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  afterEach(() => {
    window.location.pathname = '/'
  })

  it('shows full-screen spinner while session is loading', () => {
    mockAuth.getSession.mockReturnValue(new Promise(() => {})) // never resolves
    render(<App />)
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
  })

  it('shows LoginPage when not authenticated on /login', async () => {
    window.location.pathname = '/login'
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /ledgrr/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows LoginPage when not authenticated on unknown route', async () => {
    window.location.pathname = '/'
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    })
  })

  it('shows DashboardPage when authenticated on /dashboard', async () => {
    window.location.pathname = '/dashboard'
    mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/dashboard coming soon/i)).toBeInTheDocument()
    })
  })

  it('redirects authenticated user from / to /dashboard', async () => {
    window.location.pathname = '/'
    mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    render(<App />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('calls sync when provider_refresh_token is present', async () => {
    window.location.pathname = '/dashboard'
    mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    render(<App />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sync'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('provider_refresh_token'),
        })
      )
    })
  })

  it('does not call sync when provider_refresh_token is absent', async () => {
    window.location.pathname = '/dashboard'
    mockAuth.getSession.mockResolvedValue({
      data: { session: mockSessionNoProviderToken },
      error: null,
    })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/dashboard coming soon/i)).toBeInTheDocument()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('only calls auth-store-tokens once per session', async () => {
    window.location.pathname = '/dashboard'
    mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    const { rerender } = render(<App />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    rerender(<App />)
    // Still only called once
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
