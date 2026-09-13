import { supabase, SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase'
import type { RawAccountBalancesData, CurrencyData, NewCreditCardInput } from '@/types/accounts'
import type { RawTransaction } from '@/types/transactions'
import type { NewInstallmentInput, NewRecurringInput, NewTransactionInput, RawInstallmentRow, RawRecurringRow } from '@/types/installments'
import type { RawBudgetRow } from '@/types/budgets'
import type { RawDebtReceivableRow } from '@/types/debtsReceivables'
import type { NewDebtReceivableInput } from '@/types/debtsReceivables'
import type { TxnCategory } from '@/types/txnCatSub'

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

/** Creates one credit-card account in the connected user's Accounts sheet. */
export async function createCreditCard(input: NewCreditCardInput): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/accounts-balances`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  assertOk(res, 'credit card')
}

/** Lists selectable card-art filenames via the authenticated Accounts endpoint. */
export async function getAccountImages(): Promise<string[]> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/accounts-balances?action=images`, {
    method: 'GET',
    headers,
  })
  assertOk(res, 'account images')
  return res.json() as Promise<string[]>
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

/** Writes one Installments-sheet row. */
export async function insertInstallment(input: NewInstallmentInput): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/installments`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  assertOk(res, 'installment')
}

/** Writes one Recurring Payments-sheet row. */
export async function insertRecurring(input: NewRecurringInput): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/recurring`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  assertOk(res, 'recurring payment')
}

/** Runs the dedicated installment command (one auth/token exchange and one Sheets batch). */
export async function submitInstallment(input: NewInstallmentInput): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/installments-submit`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  assertOk(res, 'installment')
}

/** Runs the dedicated recurring-payment command endpoint. */
export async function submitRecurring(input: NewRecurringInput): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/recurring-submit`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  assertOk(res, 'recurring payment')
}

/** Creates a split-bill D&R row and any immediate Transactions rows. */
export async function submitDebtReceivable(input: NewDebtReceivableInput): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/debtsandreceivables-submit`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  assertOk(res, 'split bill')
}

/** Records one payment against a D&R participant and appends its transaction. */
export async function submitDebtReceivablePayment(input: {
  name: string
  date: string
  recordAccount?: string
  account: string
  direction: 'Receivable' | 'Payable'
  participantName: string
  paymentDate: string
  amount: number
  category?: string
  subcategory?: string
  budget?: string
  currency?: string
}): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/debtsandreceivables-submit?pay`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  assertOk(res, 'D&R payment')
}

/** Appends one or more rows to the Transactions sheet. */
export async function insertTransactions(transactions: NewTransactionInput[]): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/tx`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions }),
  })
  assertOk(res, 'transactions')
}

/** Stores the final PHP amount for one existing foreign-currency transaction. */
export async function resolveTransactionAmount(transactionId: string, resolvedAmount: number): Promise<void> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/tx?action=resolveamount`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId, resolvedAmount }),
  })
  assertOk(res, 'transaction amount resolution')
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

/** Fetches the consolidated transaction category/subcategory taxonomy. */
export async function getTxnCategories(): Promise<TxnCategory[]> {
  const headers = await buildHeaders()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/txn-cat-sub`, { method: 'GET', headers })
  assertOk(res, 'transaction categories')
  return res.json() as Promise<TxnCategory[]>
}
