import { useLiveQuery } from '@tanstack/react-db'

import { transactionsCollection } from '@/collections/transactions'
import { useAuth } from '@/context/AuthContext'
import type {
  BillingCycle,
  CCTransactionData,
  RawTransaction,
} from '@/types/transactions'

/**
 * Computes the billing cycle boundaries for a given statement day.
 *
 * Index 0 is always the running statement cycle, including before its
 * statement end date. For example, a card with statement day 16 shows
 * Aug 16–Sep 15 on Sep 14, then Sep 16–Oct 15 on Sep 16.
 */
export function computeCycleBoundaries(
  statementDay:  number,
  referenceDate: Date = new Date()
): { cycleStart: Date; cycleEnd: Date } {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  // Ignore the current time: the statement end date is inclusive for the
  // full local calendar day, rather than ending at midnight.
  const referenceDay = new Date(year, month, referenceDate.getDate())

  const cycleEnd = new Date(year, month, statementDay - 1)
  if (cycleEnd < referenceDay) {
    cycleEnd.setMonth(cycleEnd.getMonth() + 1)
  }
  const cycleStart = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, statementDay)

  return { cycleStart, cycleEnd }
}

/**
 * Formats a Date as an ISO date string (YYYY-MM-DD) using local calendar
 * fields (not UTC), so it matches the local-midnight dates produced by
 * computeCycleBoundaries.
 */
function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parses a transaction date string into a Date for comparison against the
 * cycle boundary Dates. Normalizes to local midnight so comparisons are
 * purely date-based. Returns null when the string is empty or unparseable.
 */
function parseDate(raw: string): Date | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

const LABEL_OPTIONS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

/**
 * Builds up to 6 billing cycles for one CC account, starting from the current
 * cycle (index 0 = most recent). For each offset `c` (0..5), the reference
 * date is shifted back by `c` months and passed to computeCycleBoundaries.
 * Transactions falling within `cycleStart <= date <= cycleEnd` are attached to
 * each cycle and sorted newest first.
 *
 * The label uses the format "Aug 25 – Sep 24" via toLocaleDateString.
 * cycleStart / cycleEnd are returned as ISO date strings (YYYY-MM-DD).
 */
export function buildBillingCycles(
  txs:          RawTransaction[],
  statementDay: number
): BillingCycle[] {
  const cycles: BillingCycle[] = []

  for (let c = 0; c < 6; c++) {
    const shiftedRef = new Date()
    shiftedRef.setMonth(shiftedRef.getMonth() - c)

    const { cycleStart, cycleEnd } = computeCycleBoundaries(statementDay, shiftedRef)

    const transactions = txs
      .filter((tx) => {
        const d = parseDate(tx.date)
        if (!d) return false
        return d >= cycleStart && d <= cycleEnd
      })
      .sort((a, b) => {
        const da = parseDate(a.date)?.getTime() ?? 0
        const db = parseDate(b.date)?.getTime() ?? 0
        return db - da
      })

    const label = `${cycleStart.toLocaleDateString('en-US', LABEL_OPTIONS)} – ${cycleEnd.toLocaleDateString('en-US', LABEL_OPTIONS)}`

    cycles.push({
      label,
      cycleStart: toIsoDate(cycleStart),
      cycleEnd:   toIsoDate(cycleEnd),
      transactions,
    })
  }

  return cycles
}


/**
 * Explicitly picks the typed RawTransaction fields from a live-query row,
 * avoiding the spread of TanStack DB internal props ($synced, $origin,
 * $key, $collectionId) — same pattern used in useAccountBalances.ts /
 * useCCAccounts.ts.
 */
function pickTransaction(row: RawTransaction): RawTransaction {
  return {
    key:            row.key,
    date:           row.date,
    account:        row.account,
    amount:         row.amount,
    resolvedAmount: row.resolvedAmount,
    currency:       row.currency,
    targetAccount:  row.targetAccount,
    type:           row.type,
    category:       row.category,
    subcategory:    row.subcategory,
    budget:         row.budget,
    note:           row.note,
  }
}

/**
 * useCCTransactions
 *
 * Reads all raw transaction rows from the single transactionsCollection via
 * useLiveQuery, filters them down to credit-card transactions, and groups the
 * result per account into billing cycles + a flat newest-first list.
 *
 * A row is considered a CC transaction when its `account` is one of the
 * provided CC account names, OR when it is a Transfer whose `targetAccount`
 * is a CC account (a payment / transfer into the card). Split Offset rows
 * are always excluded.
 *
 * Returning null from the useLiveQuery callback when unauthenticated
 * disables the query (status='disabled', data=undefined, isLoading=false).
 */
export function useCCTransactions(
  ccAccounts: Array<{ name: string; statementDay: number | null }>
): {
  data:      Map<string, CCTransactionData>
  isLoading: boolean
  isError:   boolean
} {
  const { session } = useAuth()
  const isAuthenticated = session !== null

  const {
    data:      rows,
    isLoading,
    isError,
  } = useLiveQuery((q) =>
    isAuthenticated ? q.from({ tx: transactionsCollection }) : null
  )

  // Explicitly pick typed fields to avoid spreading TanStack DB internal props
  const allTransactions = (rows ?? []).map(pickTransaction)

  const ccNames = new Set(ccAccounts.map((a) => a.name))

  const ccTxs = allTransactions.filter((row) => {
    if (row.type === 'Split Offset') return false
    if (ccNames.has(row.account)) return true
    if (row.type === 'Transfer' && ccNames.has(row.targetAccount)) return true
    return false
  })

  const data = new Map<string, CCTransactionData>()

  for (const { name, statementDay } of ccAccounts) {
    const txsForAccount = ccTxs.filter(
      (row) =>
        row.account === name ||
        (row.type === 'Transfer' && row.targetAccount === name)
    )

    const cycles: BillingCycle[] =
      statementDay !== null ? buildBillingCycles(txsForAccount, statementDay) : []

    const allTxs = [...txsForAccount].sort((a, b) => {
      const da = new Date(a.date).getTime() || 0
      const db = new Date(b.date).getTime() || 0
      return db - da
    })

    data.set(name, { cycles, allTxs })
  }

  return { data, isLoading, isError }
}
