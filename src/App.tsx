import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

import LoginPage        from '@/pages/LoginPage'
import AuthCallbackPage from '@/pages/AuthCallbackPage'
import ConnectSheetPage from '@/pages/ConnectSheetPage'
import DashboardPage    from '@/pages/DashboardPage'

/**
 * Routing
 *
 * /                 → redirect based on auth + sheet status
 * /auth/callback    → Supabase completes login, stores tokens, redirects
 * /connect          → user enters their sheet ID (post-login, first time)
 * /dashboard        → main app, reads sheet data
 */

function Spinner() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
    </div>
  )
}

function Router() {
  const { session, loading } = useAuth()
  const [hasSheet, setHasSheet] = useState<boolean | null>(null)
  const path = window.location.pathname

  useEffect(() => {
    if (!session) { setHasSheet(null); return }
    supabase
      .from('user_sheets')
      .select('sheet_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      // sheet_id may be empty string if user is mid-onboarding (tokens stored, no sheet yet)
      .then(({ data }) => setHasSheet(!!(data?.sheet_id && data.sheet_id !== '')))
  }, [session])

  if (loading) return <Spinner />

  // Auth callback — always accessible
  if (path === '/auth/callback') return <AuthCallbackPage />

  // Not signed in → login
  if (!session) return <LoginPage />

  // Authenticated routes
  if (path === '/connect')   return <ConnectSheetPage />
  if (path === '/dashboard') return hasSheet === null ? <Spinner /> : <DashboardPage />

  // Root or unknown — redirect based on whether sheet is connected
  if (hasSheet === null) return <Spinner />

  window.location.replace(hasSheet ? '/dashboard' : '/connect')
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}
