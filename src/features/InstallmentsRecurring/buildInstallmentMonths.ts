/**
 * Pure month-evaluation module for the Installments & Recurring dashboard panel.
 *
 * Framework-free, no React, no I/O. Consumes the raw passthrough rows from the
 * two Edge Functions plus a target month, and produces the normalized list of
 * items active in that month with a monthly total. All installment/recurring
 * date parsing, term/frequency handling, amount parsing, active-window math, and
 * graceful degradation live here so the logic can be property-tested.
 */
import type { RawInstallmentRow, RawRecurringRow } from '@/types/installments'

/** A calendar month at month precision. `month` is 0–11 (JS convention). */
export interface YearMonth {
  year:  number
  month: number
}

/** Normalized list entry rendered in the panel (mirrors the SPA InstallmentItem). */
export interface InstallmentItem {
  name:        string
  account:     string
  amount:      number // parsed; 0 when unparseable
  currency:    string
  isRecurring: boolean
  iteration?:  number // installments only — 1-based, 1..terms
  terms?:      number // installments only
  frequency?:  string // recurring only — defaults to "Monthly"
}

/** Result of evaluating one target month. */
export interface MonthResult {
  items:               InstallmentItem[] // sorted by amount DESC
  total:               number            // Σ item.amount
  omittedInstallments: number            // rows dropped for bad start / invalid terms
  omittedRecurring:    number            // rows dropped for bad start
}

// ── Pure helpers (named exports for property tests) ──────────────────────────

/**
 * Strips thousands separators and parses a number. Empty or non-numeric input
 * yields 0. (R6.4, R6.9, R7.4, R7.5, R11.5)
 */
export function parseAmount(raw: string): number {
  if (raw == null) return 0
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (cleaned === '') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

/**
 * Parses an installment Start Date in `M/D/YYYY` (zero-padding tolerant) to a
 * YearMonth. The day component is discarded. Returns null when empty or
 * unparseable. (R6.1, R6.5)
 */
export function parseInstallmentStart(raw: string): YearMonth | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '') return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const month = Number(m[1])
  const year = Number(m[3])
  if (month < 1 || month > 12) return null
  return { year, month: month - 1 }
}

/**
 * Parses a recurring Start/End Date in `MM/YYYY` (any day component ignored) to
 * a YearMonth. Returns null when empty or unparseable. (R7.1, R7.6)
 */
export function parseRecurringMonth(raw: string): YearMonth | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '') return null
  // Accept MM/YYYY, and tolerate an accidental M/D/YYYY by taking month + year.
  const mmYYYY = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmYYYY) {
    const month = Number(mmYYYY[1])
    const year = Number(mmYYYY[2])
    if (month < 1 || month > 12) return null
    return { year, month: month - 1 }
  }
  const mdYYYY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdYYYY) {
    const month = Number(mdYYYY[1])
    const year = Number(mdYYYY[3])
    if (month < 1 || month > 12) return null
    return { year, month: month - 1 }
  }
  return null
}

/**
 * Parses a Terms count formatted as a whole-number decimal (e.g. "5.00" → 5).
 * Returns null when empty, non-numeric, or less than 1. (R6.6, R6.8)
 */
export function parseTerms(raw: string): number | null {
  if (raw == null) return null
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  const t = Math.trunc(n)
  if (t < 1) return null
  return t
}

/** Signed month distance b − a (0 when same month, negative when b precedes a). */
export function monthDiff(a: YearMonth, b: YearMonth): number {
  return (b.year - a.year) * 12 + (b.month - a.month)
}

/** True when `m` is within an installment window [start, start + terms − 1]. */
export function isInstallmentActive(start: YearMonth, terms: number, m: YearMonth): boolean {
  const d = monthDiff(start, m)
  return d >= 0 && d <= terms - 1
}

/**
 * True when `m` ≥ start and, when `end` is provided, `m` ≤ end. A null `end`
 * means ongoing (no upper bound). (R7.1, R7.2, R7.8)
 */
export function isRecurringActive(start: YearMonth, end: YearMonth | null, m: YearMonth): boolean {
  if (monthDiff(start, m) < 0) return false
  if (end === null) return true
  return monthDiff(m, end) >= 0
}

/** Trimmed frequency label, defaulting to "Monthly" when empty. (R7.3) */
export function normalizeFrequency(raw: string): string {
  const s = (raw ?? '').trim()
  return s === '' ? 'Monthly' : s
}

/**
 * Builds the list of items active in `target` from the raw installment and
 * recurring rows, with a monthly total. Never throws; malformed rows are
 * skipped and counted.
 */
export function buildInstallmentMonths(
  installments: RawInstallmentRow[],
  recurring:    RawRecurringRow[],
  target:       YearMonth,
  now:          YearMonth = currentYearMonth(),
): MonthResult {
  const items: InstallmentItem[] = []
  let omittedInstallments = 0
  let omittedRecurring = 0

  for (const row of installments ?? []) {
    const start = parseInstallmentStart(row.startDate)
    const terms = parseTerms(row.terms)
    if (start === null || terms === null) {
      omittedInstallments++
      continue
    }
    if (!isInstallmentActive(start, terms, target)) continue
    items.push({
      name:        row.name,
      account:     row.account,
      amount:      parseAmount(row.termPayment),
      currency:    row.currency,
      isRecurring: false,
      iteration:   monthDiff(start, target) + 1,
      terms,
    })
  }

  for (const row of recurring ?? []) {
    const start = parseRecurringMonth(row.startDate)
    if (start === null) {
      omittedRecurring++
      continue
    }
    // Empty end = ongoing: capped at the current month `now` so the payment
    // appears from its start month through the current month and NOT in future
    // months. A present-but-unparseable end is treated the same way (R7.2, R7.8).
    const rawEnd = (row.endDate ?? '').trim()
    const parsedEnd = rawEnd === '' ? null : parseRecurringMonth(rawEnd)
    const end = parsedEnd ?? now // ongoing / unparseable → cap at current month
    if (!isRecurringActive(start, end, target)) continue
    items.push({
      name:        row.name,
      account:     row.account,
      amount:      parseAmount(row.amount),
      currency:    row.currency,
      isRecurring: true,
      frequency:   normalizeFrequency(row.frequency),
    })
  }

  items.sort((a, b) => b.amount - a.amount)
  const total = items.reduce((sum, i) => sum + i.amount, 0)

  return { items, total, omittedInstallments, omittedRecurring }
}

/** Current calendar month from the local system date. (R8.1) */
export function currentYearMonth(now: Date = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() }
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** Formats a YearMonth as "Mmm YYYY" (e.g. "Sep 2026"). */
export function formatMonth(ym: YearMonth): string {
  return `${MONTHS[ym.month]} ${ym.year}`
}

/** Returns the month `delta` months after `ym` (delta may be negative). */
export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const total = ym.year * 12 + ym.month + delta
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}
