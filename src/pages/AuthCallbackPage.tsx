/**
 * AuthCallbackPage — /auth/callback
 *
 * Supabase redirects here after Google OAuth login.
 * supabase-js automatically exchanges the code for a session via PKCE.
 *
 * We can't rely on onAuthStateChange('SIGNED_IN') here because supabase-js
 * may process the session from the URL before our listener attaches.
 * Instead we poll getSession() until it resolves, then handle the redirect.
 */
import { useEffect, useRef } from 'react'
import { Loader } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const handle = async () => {
      // Wait up to 10s for supabase-js to exchange the code and populate the session
      let session = null
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession()
        if (data.session) { session = data.session; break }
        await new Promise(r => setTimeout(r, 500))
      }

      if (!session) {
        // Fallback: something went wrong, send back to login
        window.location.replace('/')
        return
      }

      const userId               = session.user.id
      const providerRefreshToken = session.provider_refresh_token ?? null
      const providerToken        = session.provider_token          ?? null

      // Check if user already has a connected sheet (sheet_id set)
      const { data: existing } = await supabase
        .from('user_sheets')
        .select('id, sheet_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing?.sheet_id) {
        // Returning user with sheet connected — refresh tokens if we got new ones
        if (providerRefreshToken) {
          await supabase
            .from('user_sheets')
            .update({
              refresh_token: providerRefreshToken,
              access_token:  providerToken,
              token_expiry:  null,
            })
            .eq('user_id', userId)
        }
        window.location.replace('/dashboard')
        return
      }

      // New user — store tokens and create their spreadsheet automatically
      if (providerRefreshToken) {
        await supabase
          .from('user_sheets')
          .upsert(
            {
              user_id:       userId,
              sheet_id:      '',
              refresh_token: providerRefreshToken,
              access_token:  providerToken,
              token_expiry:  null,
            },
            { onConflict: 'user_id' }
          )

        // Create spreadsheet via Edge Function
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

        await fetch(`${supabaseUrl}/functions/v1/sheets-create`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentSession?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
        })
      }

      window.location.replace('/dashboard')
    }

    handle()
  }, [])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader className="w-6 h-6 animate-spin" />
        <p className="text-sm">Completing sign-in…</p>
      </div>
    </div>
  )
}
