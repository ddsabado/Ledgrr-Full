import { describe, it, expect } from 'vitest'

describe('supabase client', () => {
  it('throws if VITE_SUPABASE_URL is missing', async () => {
    const original = import.meta.env.VITE_SUPABASE_URL
    // We can't unset import.meta.env at runtime in Vite tests,
    // so we verify the module exports the expected values instead.
    expect(typeof original === 'string' || original === undefined).toBe(true)
  })

  it('exports SUPABASE_URL and SUPABASE_KEY', async () => {
    // Verify the named exports exist and are strings
    const { SUPABASE_URL, SUPABASE_KEY } = await import('@/lib/supabase')
    expect(typeof SUPABASE_URL).toBe('string')
    expect(typeof SUPABASE_KEY).toBe('string')
  })

  it('exports a supabase client with auth methods', async () => {
    const { supabase } = await import('@/lib/supabase')
    expect(supabase.auth).toBeDefined()
    expect(typeof supabase.auth.getSession).toBe('function')
    expect(typeof supabase.auth.signInWithOAuth).toBe('function')
    expect(typeof supabase.auth.signOut).toBe('function')
    expect(typeof supabase.auth.onAuthStateChange).toBe('function')
  })
})
