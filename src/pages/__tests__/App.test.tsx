import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockAuth, mockSession, mockSessionNoProviderToken } from '@/test/mocks/supabase'
import App from '@/App'

const mockReplace = vi.fn()
Object.defineProperty(window, 'location', {
  value: { ...window.location, replace: mockReplace, pathname: '/' },
  writable: true,
})

const mockFetch = vi.fn((url: unknown) => {
  if (typeof url === 'string' && url.includes('accounts-balances')) {
    return Promise.resolve({ ok: true, status: 200, json: async () => [] })
  }
  return Promise.resolve({ ok: true, status: 201, json: async () => { throw new Error('No body') } })
})
vi.stubGlobal('fetch', mockFetch)

vi.mock('@/hooks/useAccountBalances', () => ({
  useAccountBalances: () => ({ data: [], isLoading: false, isError: false }),
}))

vi.mock('@/pages/DashboardPage', () => ({
  default: () => <nav role="navigation"><h1>Ledgrr</h1></nav>,
}))

const isSyncCall = (args: unknown[]) =>
  typeof args[0] === 'string' && (args[0] as string).includes('/sync')

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  afterEach(() => {
    window.location.pathname = '/'
  })

  it('shows full-screen spinner while session is loading', () => {
    mockAuth.getSession.mockReturnValue(new Promise(() => {}))
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

  it('renders the public demo without reading or creating an auth session', () => {
    window.location.pathname = '/demo'
    render(<App />)

    expect(screen.getByLabelText('Account Balances')).toBeInTheDocument()
    expect(screen.getByLabelText('Credit Cards')).toBeInTheDocument()
    expect(screen.getByLabelText('Transactions by Period')).toBeInTheDocument()
    expect(screen.getByLabelText('Budgets')).toBeInTheDocument()
    expect(screen.getByLabelText('Installments and Recurring')).toBeInTheDocument()
    expect(screen.getByLabelText('Debts and Receivables')).toBeInTheDocument()
    expect(screen.getByText(/demo mode — changes are not saved/i)).toBeInTheDocument()
    expect(screen.getAllByText('Everyday Cash').length).toBeGreaterThan(0)
    expect(mockAuth.getSession).not.toHaveBeenCalled()
    expect(mockAuth.onAuthStateChange).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('opens every demo activity view from its local dashboard controls and returns to the dashboard', () => {
    window.location.pathname = '/demo'
    render(<App />)

    fireEvent.click(screen.getByRole('option', { name: 'View activity for Everyday Cash' }))
    expect(screen.getByRole('heading', { name: 'Everyday Cash' })).toBeInTheDocument()
    expect(screen.getByText('Weekend market')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to account balances' }))

    fireEvent.click(screen.getByRole('button', { name: 'View credit card activity' }))
    expect(screen.getByLabelText('Selected credit card')).toHaveValue('Metro Rewards')
    fireEvent.change(screen.getByLabelText('Selected credit card'), { target: { value: 'Travel Card' } })
    expect(screen.getByText('Coffee shop')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to credit cards' }))

    fireEvent.click(screen.getByRole('button', { name: 'Open installments viewer' }))
    expect(screen.getAllByText('Laptop').length).toBeGreaterThan(1)
    expect(screen.getByText(/activity is read-only/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to installments and recurring payments' }))

    fireEvent.click(screen.getByRole('button', { name: 'Open debts and receivables viewer' }))
    expect(screen.getByRole('heading', { name: 'Jamie' })).toBeInTheDocument()
    expect(screen.getByText(/payments and imports are disabled/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to debts and receivables' }))

    expect(screen.getByLabelText('Account Balances')).toBeInTheDocument()
    expect(mockAuth.getSession).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
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
      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /ledgrr/i })).toBeInTheDocument()
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
      const syncCall = mockFetch.mock.calls.find(isSyncCall)
      expect(syncCall).toBeDefined()
      expect((syncCall as unknown[])[1]).toMatchObject({
        method: 'POST',
        body: expect.stringContaining('provider_refresh_token'),
      })
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
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
    expect(mockFetch.mock.calls.find(isSyncCall)).toBeUndefined()
  })

  it('only calls sync once per session', async () => {
    window.location.pathname = '/dashboard'
    mockAuth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    const { rerender } = render(<App />)
    await waitFor(() => {
      expect(mockFetch.mock.calls.filter(isSyncCall)).toHaveLength(1)
    })
    rerender(<App />)
    expect(mockFetch.mock.calls.filter(isSyncCall)).toHaveLength(1)
  })
})
