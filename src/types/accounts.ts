/**
 * Raw account row returned by the accounts-balances Edge Function.
 * phpEquivalent is NOT included — it is computed on the frontend
 * by combining this data with the currencies Edge Function response.
 *
 * currentBalance — amount in the account's native currency (sheet column J)
 * initialBalance — sheet column D
 * creditLimit, statementDay, dueDay — credit-card metadata fields.
 */
export interface RawAccountBalance {
  name:           string
  category:       string
  currency:       string        // ISO code: "PHP", "USD", "TWD", etc.
  currentBalance: number        // Native currency amount
  initialBalance: number
  creditLimit:    number        // 0 when not set
  statementDay:   number | null // null when not set
  dueDay:         number | null // null when not set
  image:          string        // filename in the account_images bucket; '' when unset
  accountType:    string        // classification from Account Categories sheet; '' when unmapped
}

/** Payload for creating one Accounts-sheet row through accounts-balances. */
export interface NewCreditCardInput {
  name: string
  creditLimit: number
  initialBalance: number
  currency: string
  image: string
  statementDay: number
  dueDay: number
  metadata?: string
}

/** Command payload for setting a non-credit account's native-currency balance. */
export interface AdjustAccountBalanceInput {
  accountName: string
  targetBalance: number
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
