import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  user:    User | null
  loading: boolean
  signInWithGoogle:       () => Promise<void>
  signInWithGoogleReauth: () => Promise<void>
  signOut:                () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Normal sign-in — no prompt: consent.
   * First login: Google shows consent screen, issues refresh_token.
   * Subsequent logins: Google signs in silently, no refresh_token in session.
   * auth-store-tokens only called when provider_refresh_token is present (first login).
   */
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: 'https://www.googleapis.com/auth/spreadsheets',
        queryParams: {
          access_type: 'offline', // required to receive refresh_token on first consent
        },
      },
    })
  }

  /**
   * Reauth sign-in — forces consent screen with prompt: consent.
   * Used ONLY when the stored refresh token is expired or revoked (invalid_grant).
   * This re-issues a fresh refresh_token and rotates the Vault secret.
   * Triggered by the frontend when a Sheets Edge Function returns REAUTH_REQUIRED.
   */
  const signInWithGoogleReauth = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: 'https://www.googleapis.com/auth/spreadsheets',
        queryParams: {
          access_type: 'offline',
          prompt:      'consent', // force re-issue of refresh_token
        },
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user:                   session?.user ?? null,
        loading,
        signInWithGoogle,
        signInWithGoogleReauth,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
