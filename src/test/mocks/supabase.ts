/**
 * Supabase client mock
 * Provides controllable stubs for all supabase-js auth methods used in the app.
 */
import { vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'

export const mockUser: User = {
  id:                     '97861035-6d70-4839-92d0-a74b52b65f67',
  email:                  'test@example.com',
  app_metadata:           { provider: 'google', providers: ['google'] },
  user_metadata:          { full_name: 'Test User', avatar_url: '' },
  aud:                    'authenticated',
  created_at:             '2026-01-01T00:00:00Z',
  updated_at:             '2026-01-01T00:00:00Z',
  role:                   'authenticated',
  confirmed_at:           '2026-01-01T00:00:00Z',
  email_confirmed_at:     '2026-01-01T00:00:00Z',
  phone:                  '',
  last_sign_in_at:        '2026-01-01T00:00:00Z',
  identities:             [],
  factors:                [],
}

export const mockSession: Session = {
  access_token:          'mock-supabase-access-token',
  refresh_token:         'mock-supabase-refresh-token',
  expires_in:            3600,
  expires_at:            Date.now() / 1000 + 3600,
  token_type:            'bearer',
  user:                  mockUser,
  provider_token:        'mock-google-access-token',
  provider_refresh_token: 'mock-google-refresh-token',
}

export const mockSessionNoProviderToken: Session = {
  ...mockSession,
  provider_token:         null,
  provider_refresh_token: null,
}

// Controllable auth mock — tests can override these
export const mockAuth = {
  getSession:          vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
  onAuthStateChange:   vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  signInWithOAuth:     vi.fn().mockResolvedValue({ data: {}, error: null }),
  signOut:             vi.fn().mockResolvedValue({ error: null }),
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockAuth,
  },
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_KEY: 'mock-key',
}))
