/**
 * Pure derivation module for the Debts & Receivables dashboard panel.
 *
 * Framework-free, no React, no I/O. Consumes the raw passthrough rows plus the
 * currencies FX map and produces normalized per-record views: parsed
 * participants/shares, PHP-resolved totals and shares (reusing the shared
 * resolvePhp rule), a per-participant paid map (Name:amount[:CCY] / legacy
 * bare Name), and per-participant + overall payment status. Isolated so it can
 * be property-tested and reused by a future insert-via-UI feature.
 */
import type { RawDebtReceivableRow } from '@/types/debtsReceivables'
import type { RawTransaction } from '@/types/transactions'
import type { CurrencyData } from '@/types/accounts'
import { resolvePhp } from '@/utils/resolvePhp'
import { parseTxDate } from '@/features/Transactions/groupTransactions'
import { parseSplittrExpenseDetails, type SplittrExpenseDetail } from '../../../supabase/functions/_shared/splittrImportDetails'

export type Direction = 'Receivable' | 'Payable'
export type ParticipantStatus = 'Paid' | 'Partial' | 'Pending'
export type OverallStatus = 'Settled' | 'Pending'

/** Aggregated paid state for one participant, keyed by currency. */
export interface PaidAggregate {
  perCurrency: Record<string, number> // currency code → summed native amount
  fullyPaid:   boolean                // true when a legacy bare-name entry was seen
}

/** Normalized participant entry rendered in the panel. */
export interface ParticipantView {
  name:                 string
  isOwner:              boolean
  sharePhp:             number
  shareNative:          number
  shareEstimated:       boolean
  paidPhp:              number
  status:               ParticipantStatus
  hasUnresolvedPayment: boolean
}

/** Normalized record rendered in the panel. */
export interface DebtReceivableView {
  key:            string
  name:           string
  account:        string
  date:           string
  dateLabel:      string          // "Mmm dd", raw when unparseable, '' when blank
  sortTs:         number | null   // parsed date epoch ms for chronological sort; null when blank/unparseable
  direction:      Direction
  currency:       string
  totalPhp:       number
  totalNative:    number
  totalEstimated: boolean
  participants:   ParticipantView[]
  overallStatus:  OverallStatus
  rawStatus:      string          // col K
  splittrExpenses: SplittrExpenseDetail[] | null
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

// ── Pure helpers (named exports for property tests) ──────────────────────────

/** Strip thousands separators; empty/whitespace/NaN → 0. */
export function parseNumber(raw: string): number {
  if (raw == null) return 0
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (cleaned === '') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

/** Split col E on ';', trim, drop empty; [0] is the owner. */
export function parseParticipants(raw: string): string[] {
  return (raw ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

/** Split col G on ';', trim, parseNumber each (kept positionally). */
export function parseAmounts(raw: string): number[] {
  const segments = (raw ?? '').split(';')
  // Drop trailing empty-only segments that arise from a trailing delimiter,
  // but keep interior positions aligned with participants.
  return segments.map((s) => parseNumber(s))
}

/** Pair participants with amounts positionally; missing amount → 0; extra amounts ignored. */
export function zipShares(
  participants: string[], amounts: number[]
): { name: string; share: number }[] {
  return participants.map((name, i) => ({ name, share: amounts[i] ?? 0 }))
}

/**
 * Parse col J into a per-participant PaidAggregate.
 *   'Name:amount'      → { PHP: amount }
 *   'Name:amount:CCY'  → { CCY: amount }
 *   'Name'   (no colon)→ fullyPaid
 *   colon but bad amount → ignored
 * Same-currency amounts sum; differing currencies stay separate. Never throws.
 */
export function parsePaidParticipants(raw: string): Map<string, PaidAggregate> {
  const map = new Map<string, PaidAggregate>()
  const entries = (raw ?? '').split(';').map((e) => e.trim()).filter((e) => e !== '')

  const ensure = (name: string): PaidAggregate => {
    let agg = map.get(name)
    if (!agg) {
      agg = { perCurrency: {}, fullyPaid: false }
      map.set(name, agg)
    }
    return agg
  }

  for (const entry of entries) {
    const parts = entry.split(':')
    if (parts.length === 1) {
      // Legacy bare name → fully paid.
      const name = parts[0].trim()
      if (name) ensure(name).fullyPaid = true
      continue
    }
    const name = parts[0].trim()
    if (!name) continue
    const rawAmount = (parts[1] ?? '').trim()
    if (rawAmount === '') continue
    const amount = Number(rawAmount.replace(/,/g, ''))
    if (!Number.isFinite(amount)) continue // malformed amount → skip
    const currency = (parts[2] ?? '').trim() || 'PHP'
    const agg = ensure(name)
    agg.perCurrency[currency] = (agg.perCurrency[currency] ?? 0) + amount
  }

  return map
}

/** Adapter that reuses resolvePhp without duplicating the rule. */
function phpOf(
  amount: number, currency: string, resolvedAmount: number | null, fxMap: CurrencyData
): number {
  return resolvePhp({ currency, amount, resolvedAmount } as RawTransaction, fxMap)
}

/** True when currency is non-PHP AND resolvedAmount is not finite (FX-estimated → pending). */
export function isEstimated(currency: string, resolvedAmount: number | null): boolean {
  const ccy = (currency || 'PHP').trim() || 'PHP'
  if (ccy === 'PHP') return false
  return !(resolvedAmount != null && Number.isFinite(resolvedAmount))
}

/** True when currency is PHP, or the FX map has a finite rate for it. */
export function rateAvailable(currency: string, fxMap: CurrencyData): boolean {
  const ccy = (currency || 'PHP').trim() || 'PHP'
  if (ccy === 'PHP') return true
  const rate = fxMap[ccy]
  return Number.isFinite(rate)
}

/**
 * Resolve a participant's PaidAggregate to a total PHP amount.
 * PHP passes through; non-PHP amounts are FX-estimated (resolvedAmount null).
 * A non-PHP currency with no available rate is EXCLUDED and flagged.
 * A legacy fullyPaid entry resolves to paidPhp = share.
 */
export function resolvePaidToPhp(
  agg: PaidAggregate | undefined, share: number, fxMap: CurrencyData
): { paidPhp: number; hasUnresolvedPayment: boolean } {
  if (!agg) return { paidPhp: 0, hasUnresolvedPayment: false }
  if (agg.fullyPaid) return { paidPhp: share, hasUnresolvedPayment: false }

  let paidPhp = 0
  let hasUnresolvedPayment = false
  for (const [currency, amount] of Object.entries(agg.perCurrency)) {
    if (!rateAvailable(currency, fxMap)) {
      hasUnresolvedPayment = true
      continue
    }
    paidPhp += phpOf(amount, currency, null, fxMap)
  }
  return { paidPhp, hasUnresolvedPayment }
}

/**
 * Per-participant status.
 *   fullyPaid            → Paid (legacy override)
 *   share <= 0           → Paid (nothing owed — trivially settled)
 *   paidPhp <= 0         → Pending
 *   paidPhp >= share     → Paid
 *   0 < paidPhp < share  → Partial
 */
export function participantStatus(
  paidPhp: number, share: number, fullyPaid: boolean
): ParticipantStatus {
  if (fullyPaid) return 'Paid'
  if (share <= 0) return 'Paid'          // owes nothing → settled
  if (paidPhp <= 0) return 'Pending'
  if (paidPhp >= share) return 'Paid'
  return 'Partial'
}

/** Overall Settled iff every NON-OWNER participant is Paid; else Pending. */
export function overallStatus(participants: ParticipantView[]): OverallStatus {
  const nonOwners = participants.filter((p) => !p.isOwner)
  if (nonOwners.length === 0) return 'Settled'
  return nonOwners.every((p) => p.status === 'Paid') ? 'Settled' : 'Pending'
}

/** "Mmm dd" via parseTxDate; raw string when unparseable; '' when blank. */
export function shortDate(raw: string): string {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return ''
  const d = parseTxDate(trimmed)
  if (!d) return trimmed
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

/** Parsed date as epoch ms for chronological sorting; null when blank/unparseable. */
export function dateSortTs(raw: string): number | null {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return null
  const d = parseTxDate(trimmed)
  return d ? d.getTime() : null
}

function normalizeDirection(raw: string): Direction {
  return raw.trim().toLowerCase() === 'payable' ? 'Payable' : 'Receivable'
}

/** Assembles one DebtReceivableView. Never throws (best-effort on bad data). */
export function computeDebtReceivableRow(
  row: RawDebtReceivableRow, index: number, fxMap: CurrencyData
): DebtReceivableView {
  const currency = (row.currency || 'PHP').trim() || 'PHP'
  const totalNative = parseNumber(row.totalAmount)
  const resolvedRaw = (row.resolvedAmount ?? '').trim()
  const resolvedAmount = resolvedRaw === '' ? null : parseNumber(resolvedRaw)

  const totalPhp = phpOf(totalNative, currency, resolvedAmount, fxMap)
  const totalEstimated = isEstimated(currency, resolvedAmount)

  const names = parseParticipants(row.participants)
  const amounts = parseAmounts(row.amounts)
  const shares = zipShares(names, amounts)
  const paidMap = parsePaidParticipants(row.paidParticipants)

  const participants: ParticipantView[] = shares.map(({ name, share }, i) => {
    // Shares inherit the row currency and have no per-share resolved amount.
    const sharePhp = phpOf(share, currency, null, fxMap)
    const shareEstimated = isEstimated(currency, null)
    const agg = paidMap.get(name)
    const { paidPhp, hasUnresolvedPayment } = resolvePaidToPhp(agg, sharePhp, fxMap)
    const status = participantStatus(paidPhp, sharePhp, agg?.fullyPaid ?? false)
    return {
      name,
      isOwner: i === 0,
      sharePhp,
      shareNative: share,
      shareEstimated,
      paidPhp,
      status,
      hasUnresolvedPayment,
    }
  })

  return {
    key:            `${row.name}#${row.date}#${row.direction}#${index}`,
    name:           row.name,
    account:        row.account,
    date:           row.date,
    dateLabel:      shortDate(row.date),
    sortTs:         dateSortTs(row.date),
    direction:      normalizeDirection(row.direction),
    currency,
    totalPhp,
    totalNative,
    totalEstimated,
    participants,
    // A persisted Settled status is authoritative (especially for Payable
    // rows, where paying the owner settles the whole record). Fall back to
    // participant derivation for Pending/legacy status cells.
    overallStatus:  row.status.trim().toLowerCase() === 'settled'
      ? 'Settled'
      : overallStatus(participants),
    rawStatus:      row.status,
    splittrExpenses: parseSplittrExpenseDetails(row.splitBy) ?? parseSplittrExpenseDetails(row.subcategory),
  }
}

/** Maps all rows in sheet order (both directions). Skips only rows that throw. Never throws. */
export function computeDebtsReceivables(
  rows: RawDebtReceivableRow[], fxMap: CurrencyData = { PHP: 1 }
): DebtReceivableView[] {
  const out: DebtReceivableView[] = []
  ;(rows ?? []).forEach((row, index) => {
    try {
      out.push(computeDebtReceivableRow(row, index, fxMap ?? { PHP: 1 }))
    } catch {
      // Best-effort: skip only the offending row, keep the rest.
    }
  })
  return out
}
