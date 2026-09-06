/**
 * Raw account row returned by the accounts-balances Edge Function.
 * phpEquivalent is NOT included — it is computed on the frontend
 * by combining this data with the currencies Edge Function response.
 *
 * currentBalance — amount in the account's native currency (sheet column J)
 * initialBalance — sheet column D
 */
export interface RawAccountBalance {
  name:           string
  category:       string
  currency:       string   // ISO code: "PHP", "USD", "TWD", etc.
  currentBalance: number   // Native currency amount
  initialBalance: number
  metadata:       string
}

/**
 * FX rate map returned by the currencies Edge Function.
 * Keys are ISO currency codes; values are rates relative to PHP.
 * PHP is always present with a value of 1.
 *
 * Example: { PHP: 1, USD: 56.2, TWD: 1.7 }
 */
export type CurrencyData = Record<string, number>

/**
 * Fully-resolved account balance used by the UI.
 * Computed on the frontend from RawAccountBalance + CurrencyData.
 *
 * phpEquivalent = currentBalance * fxRate
 * For PHP accounts: phpEquivalent === currentBalance
 */
export interface AccountBalance extends RawAccountBalance {
  phpEquivalent: number   // PHP value — used for totals, chart, and sorting
}

/** Full accounts-balances Edge Function response shape */
export type RawAccountBalancesData = RawAccountBalance[]

/** Shape consumed by the UI after frontend FX computation */
export type AccountBalancesData = AccountBalance[]
