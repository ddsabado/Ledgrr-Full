/**
 * Pure budget-derivation module for the Budgets dashboard panel.
 *
 * Framework-free, no React, no I/O. Consumes the raw budget rows plus the
 * candidate transactions and a target month, and produces the normalized
 * per-budget rows with spent/remaining/percentage/color. All amount parsing,
 * Expense/Split-Offset spend netting, divide-by-zero handling, and color-coding
 * live here so the logic can be property-tested.
 */
import type { RawTransaction } from '@/types/transactions'
import type { RawBudgetRow } from '@/types/budgets'
import { parseTxDate } from '@/features/Transactions/groupTransactions'
import type { YearMonth } from '@/features/InstallmentsRecurring/buildInstallmentMonths'
import type { CurrencyData } from '@/types/accounts'
import { resolvePhp } from '@/utils/resolvePhp'

export { resolvePhp }

/** Color band for a budget's progress bar + percentage. */
export type ProgressColor = 'green' | 'amber' | 'red'

/** Sentinel percentage for an overspent zero-allotment budget. Finite, > 100. */
export const ZERO_ALLOTMENT_OVERSPENT_PCT = 999.9

/** Normalized list entry rendered per budget in the panel. */
export interface BudgetRow {
  name:         string
  allotted:     number           // parsed from col B; >= 0, 0 when unparseable
  spent:        number           // netted Expense/Split-Offset sum for the month
  remaining:    number           // allotted - spent (may be negative)
  percentage:   number           // finite; see divide-by-zero rules
  color:        ProgressColor
  transactions: RawTransaction[] // this budget's month transactions (for the expander)
  count:        number           // transactions.length
  currency:     string           // col C; defaults 'PHP' when blank
}

// ── Pure helpers (named exports for property tests) ──────────────────────────

/**
 * Parses the allotted amount from the "Amount" column: strips thousands
 * separators, trims; empty/whitespace/non-numeric → 0; never negative.
 * (R3.1, R3.2, R7.4)
 */
export function parseAllotted(raw: string): number {
  if (raw == null) return 0
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (cleaned === '') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/**
 * True when a transaction counts toward `budgetName` for the target month:
 * Transaction Type is exactly `Expense` or `Split Offset`, the trimmed Budget is
 * non-empty and exactly equals the name (case-sensitive), and the parsed Date
 * falls in the target month. (R3.3, R7.5)
 */
export function isBudgetTransaction(
  tx: RawTransaction, budgetName: string, target: YearMonth
): boolean {
  const type = tx.type.trim()
  if (type !== 'Expense' && type !== 'Split Offset') return false
  if (tx.budget.trim() === '') return false
  if (tx.budget !== budgetName) return false
  const d = parseTxDate(tx.date)
  if (!d) return false
  return d.getFullYear() === target.year && d.getMonth() === target.month
}


/**
 * Sums PHP spend over a budget's matching transactions using resolvePhp, so a
 * negative Split Offset (negative native amount → negative PHP) nets the spend
 * down. The empty set yields 0. (R3.4, R3.5, R3.6)
 */
export function computeSpent(txs: RawTransaction[], fxMap: CurrencyData): number {
  return txs.reduce((sum, tx) => sum + resolvePhp(tx, fxMap), 0)
}

/** allotted − spent; may be negative when overspent. (R3.7) */
export function computeRemaining(allotted: number, spent: number): number {
  return allotted - spent
}

/**
 * Utilization percentage, always finite (never Infinity/NaN):
 *   allotted > 0            → (spent / allotted) * 100        (R3.8)
 *   allotted = 0, spent = 0 → 0                               (R3.9)
 *   allotted = 0, spent > 0 → ZERO_ALLOTMENT_OVERSPENT_PCT    (R3.10)
 */
export function computePercentage(allotted: number, spent: number): number {
  if (allotted > 0) {
    const pct = (spent / allotted) * 100
    // Guard against overflow to Infinity for extreme spent/allotted ratios
    // (e.g. a denormalized allotted): always return a finite value.
    return Number.isFinite(pct) ? pct : ZERO_ALLOTMENT_OVERSPENT_PCT
  }
  if (spent > 0) return ZERO_ALLOTMENT_OVERSPENT_PCT
  return 0
}

/**
 * Color band. Overspend (spent > allotted) forces red regardless of %.
 *   spent > allotted               → 'red'   (R4.4, precedence)
 *   pct > 100                      → 'red'   (R4.3)
 *   80 <= pct <= 100 (not over)    → 'amber' (R4.2)
 *   pct < 80 (not over)            → 'green' (R4.1)
 */
export function progressColor(pct: number, spent: number, allotted: number): ProgressColor {
  if (spent > allotted) return 'red'
  if (pct > 100) return 'red'
  if (pct >= 80) return 'amber'
  return 'green'
}

/** Progress-bar fill width as a percent of the track, capped at 100. (R4.5) */
export function barWidthPct(pct: number): number {
  return Math.min(pct, 100)
}

/** Assembles one BudgetRow from a raw budget row + all candidate transactions for the month. */
export function computeBudgetRow(
  budget: RawBudgetRow, candidateTxs: RawTransaction[], target: YearMonth, fxMap: CurrencyData
): BudgetRow {
  const allotted = parseAllotted(budget.amount)
  const transactions = (candidateTxs ?? []).filter((tx) =>
    isBudgetTransaction(tx, budget.name, target),
  )
  const spent = computeSpent(transactions, fxMap)
  const remaining = computeRemaining(allotted, spent)
  const percentage = computePercentage(allotted, spent)
  const color = progressColor(percentage, spent, allotted)
  return {
    name: budget.name,
    allotted,
    spent,
    remaining,
    percentage,
    color,
    transactions,
    count: transactions.length,
    currency: budget.currency.trim() || 'PHP',
  }
}

/** Assembles the full list — one BudgetRow per budget, in sheet order. Never throws. */
export function computeBudgets(
  budgets: RawBudgetRow[], candidateTxs: RawTransaction[], target: YearMonth,
  fxMap: CurrencyData = { PHP: 1 }
): BudgetRow[] {
  return (budgets ?? []).map((b) => computeBudgetRow(b, candidateTxs ?? [], target, fxMap ?? { PHP: 1 }))
}
