import type { RawAccountBalance } from '@/types/accounts'

/**
 * Raw transaction row as returned by the `transactions` Edge Function.
 * The Edge Function is a pure passthrough — it returns the raw sheet cells with
 * no FX resolution. The frontend resolves the PHP value via resolvePhp() using
 * the currencies collection. Column letters refer to the
 * Transactions sheet.
 */
export interface RawTransaction {
  key:            string        // col A — Txn ID
  date:           string        // col B — raw date string
  account:        string        // col C
  amount:         number        // col D — native currency
  resolvedAmount: number | null // col E — null when empty/non-numeric
  currency:       string        // col F
  targetAccount:  string        // col G — empty string if blank
  type:           string        // col H — Transaction Type
  category:       string        // col I
  subcategory:    string        // col J — empty string if blank
  budget:         string        // col K — empty string if blank
  note:           string        // col L — empty string if blank
}

/**
 * A single billing cycle for one CC account.
 * cycleStart and cycleEnd are ISO date strings (YYYY-MM-DD).
 */
export interface BillingCycle {
  label:        string          // e.g. "Aug 25 – Sep 24"
  cycleStart:   string          // ISO date
  cycleEnd:     string          // ISO date
  transactions: RawTransaction[]
}

/**
 * Per-card structured data returned by useCCTransactions.
 */
export interface CCTransactionData {
  cycles: BillingCycle[]        // up to 6, index 0 = most recent
  allTxs: RawTransaction[]      // all txs for this card, newest first
}

/**
 * Derived CC account record with computed fields. Returned by useCCAccounts.
 */
export interface CCAccount extends RawAccountBalance {
  phpEquivalent: number
  utilization:   number         // 0–100+ (clamped to 0 minimum)
  daysUntilDue:  number | null  // null when dueDay is null or ≤ 0
  amountDue:     number         // sum of non-payment PHP values in latest completed cycle
}
