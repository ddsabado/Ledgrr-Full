import { useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'

function Router() {
  const { session, loading } = useAuth()
  const path = window.location.pathname
  const storedTokens = useRef(false)

  useEffect(() => {
    if (!session || storedTokens.current) return
    const refreshToken = session.provider_refresh_token
    if (!refreshToken) return
    storedTokens.current = true
    fetch(`${SUPABASE_URL}/functions/v1/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_refresh_token: refreshToken }),
    }).catch(err => console.error('sync failed (non-fatal):', err))
  }, [session])

  if (loading) return <LoadingScreen />
  if (path === '/login') return <LoginPage loading={false} error={null} />
  if (!session) {
    if (path !== '/login') window.location.replace('/login')
    return <LoginPage loading={false} error={null} />
  }
  if (path === '/dashboard') return <DashboardPage />
  window.location.replace('/dashboard')
  return null
}

function LoadingScreen() {
  return <div className="min-h-screen flex items-center justify-center bg-bg"><div className="w-10 h-10 rounded-full border-4 border-accent border-t-transparent animate-spin" role="status" aria-label="Loading" /></div>
}

export default function AuthenticatedApp() {
  return <AuthProvider><Router /></AuthProvider>
}
