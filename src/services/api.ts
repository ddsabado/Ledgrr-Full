import { supabase, SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase'
import type { RawAccountBalancesData, CurrencyData } from '@/types/accounts'
import type { RawTransaction } from '@/types/transactions'
import type { NewInstallmentInput, RawInstallmentRow, RawRecurringRow } from '@/types/installments'
import type { RawBudgetRow } from '@/types/budgets'
import type { RawDebtReceivableRow } from '@/types/debtsReceivables'

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

/**
 * Fetches ALL raw transaction rows from the transactions Edge Function.
 * The Edge Function performs no filtering — it returns every non-blank
 * transaction row with phpValue computed server-side. All windowing and
 * credit-card filtering happens on the frontend via TanStack DB live queries.
 */
export async function getTransactions(): Promise<RawTransaction[]> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/transactions`, {
    method: 'GET',
    headers,
  })
  assertOk(res, 'transactions')
  return res.json() as Promise<RawTransaction[]>
}

/**
 * Fetches ALL raw installment rows from the installments Edge Function.
 * The Edge Function is a thin passthrough — no parsing, no filtering. All
 * month evaluation happens on the frontend via buildInstallmentMonths.
 */
export async function getInstallments(): Promise<RawInstallmentRow[]> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/installments`, {
    method: 'GET',
    headers,
  })
  assertOk(res, 'installments')
  return res.json() as Promise<RawInstallmentRow[]>
}

/**
 * Fetches ALL raw recurring payment rows from the recurring Edge Function.
 * Thin passthrough — no parsing, no filtering; frontend evaluates months.
 */
export async function getRecurring(): Promise<RawRecurringRow[]> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/recurring`, {
    method: 'GET',
    headers,
  })
  assertOk(res, 'recurring payments')
  return res.json() as Promise<RawRecurringRow[]>
}

/** Writes one Installments row and all evaluated monthly Transaction rows. */
export async function createInstallment(input: NewInstallmentInput): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/tx`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  assertOk(res, 'installment')
}

/**
 * Fetches ALL raw budget rows from the budgets Edge Function.
 * Thin passthrough — no computation, no filtering; the frontend derives
 * spent/remaining/percentage per month via computeBudgets.
 */
export async function getBudgets(): Promise<RawBudgetRow[]> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/budgets`, {
    method: 'GET',
    headers,
  })
  assertOk(res, 'budgets')
  return res.json() as Promise<RawBudgetRow[]>
}

/**
 * Fetches ALL raw Debts & Receivables rows from the debtsandreceivables Edge
 * Function. Thin passthrough — no computation, no filtering; the frontend
 * parses, resolves PHP, and derives status via computeDebtsReceivables.
 */
export async function getDebtsReceivables(): Promise<RawDebtReceivableRow[]> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/debtsandreceivables`, {
    method: 'GET',
    headers,
  })
  assertOk(res, 'debts & receivables')
  return res.json() as Promise<RawDebtReceivableRow[]>
}
