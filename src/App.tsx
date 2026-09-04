import { useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase'

import LoginPage     from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'

/**
 * Routes:
 *   /login      → LoginPage  (public)
 *   /dashboard  → DashboardPage (protected)
 *   /           → redirect based on session
 *
 * No /auth/callback page — redirectTo points directly to /dashboard.
 * supabase-js handles the PKCE session exchange automatically on /dashboard load.
 * auth-store-tokens is called once in the background after the first login.
 */
function Router() {
  const { session, loading } = useAuth()
  const path = window.location.pathname
  const storedTokens = useRef(false)

  // After login, store the provider_refresh_token once in the background.
  // Only runs if provider_refresh_token is present (first login or prompt=consent re-login).
  useEffect(() => {
    if (!session || storedTokens.current) return
    const refreshToken = session.provider_refresh_token
    if (!refreshToken) return

    storedTokens.current = true

    fetch(`${SUPABASE_URL}/functions/v1/auth-store-tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey:         SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider_refresh_token: refreshToken }),
    }).catch(err => console.error('auth-store-tokens failed (non-fatal):', err))
  }, [session])

  // Full-screen spinner while session state is unknown
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div
          className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  // /login — always public
  if (path === '/login') return <LoginPage loading={false} error={null} />

  // Not signed in → login
  if (!session) {
    // Redirect any protected path to /login
    if (path !== '/login') window.location.replace('/login')
    return <LoginPage loading={false} error={null} />
  }

  // Authenticated
  if (path === '/dashboard') return <DashboardPage />

  // Default: go to dashboard
  window.location.replace('/dashboard')
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}
