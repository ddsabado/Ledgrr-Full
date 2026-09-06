import { supabase, SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase'
import type { RawAccountBalancesData, CurrencyData } from '@/types/accounts'

export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'AuthError'
  }
}

/** Shared header builder for authenticated Edge Function calls */
async function buildHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    apikey:        SUPABASE_KEY,
  }
}

/** Handles non-2xx responses uniformly */
function assertOk(res: Response, label: string): void {
  if (res.status === 401) throw new AuthError()
  if (!res.ok) throw new Error(`Failed to load ${label} (${res.status})`)
}

/**
 * Fetches raw account rows from the accounts-balances Edge Function.
 * Does NOT include phpEquivalent — call getCurrencies separately
 * and compute phpEquivalent on the frontend.
 */
export async function getRawAccountBalances(): Promise<RawAccountBalancesData> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/accounts-balances`, {
    method: 'GET',
    headers,
  })
  assertOk(res, 'account balances')
  return res.json() as Promise<RawAccountBalancesData>
}

/**
 * Fetches FX rates from the currencies Edge Function.
 * Returns a map of ISO currency code → rate relative to PHP.
 * PHP is always present with value 1.
 */
export async function getCurrencies(): Promise<CurrencyData> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/currencies`, {
    method: 'GET',
    headers,
  })
  assertOk(res, 'currencies')
  return res.json() as Promise<CurrencyData>
}
