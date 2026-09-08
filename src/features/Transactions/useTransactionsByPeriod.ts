import { useMemo } from 'react'
import { useLiveQuery } from '@tanstack/react-db'

import { transactionsCollection } from '@/collections/transactions'
import { useAuth } from '@/context/AuthContext'
import { useCurrencies } from '@/hooks/useCurrencies'
import type { RawTransaction } from '@/types/transactions'
import { groupTransactions, type GroupedPeriods } from './groupTransactions'

/**
 * Explicitly picks the typed RawTransaction fields from a live-query row,
 * avoiding the spread of TanStack DB internal props ($synced, $origin,
 * $key, $collectionId) — same pattern as useCCTransactions.pickTransaction.
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

export interface TransactionsByPeriod {
  /** Precomputed period groupings for each granularity. */
  grouped:   { month: GroupedPeriods; week: GroupedPeriods; day: GroupedPeriods }
  isLoading: boolean
  isError:   boolean
}

const EMPTY_GROUPED: GroupedPeriods = { periods: [], currentIndex: 0 }

/**
 * useTransactionsByPeriod
 *
 * Reads ALL rows from the single transactionsCollection via an unfiltered
 * useLiveQuery (no date `where`) and eagerly groups them into Month / Week /
 * Day period buckets. Because grouping is memoised on `rows`, switching the
 * time-window tab is zero-cost and regrouping only happens when the collection
 * changes (initial load or background refetch). This is the "group all"
 * approach chosen in the design's Reactivity & Invalidation section — a
 * backfilled or same-day transaction self-sorts into the correct bucket on the
 * next reactive emit.
 *
 * Returning null from the useLiveQuery callback when unauthenticated disables
 * the query (status='disabled', data=undefined, isLoading=false), matching
 * useCCTransactions.
 */
export function useTransactionsByPeriod(): TransactionsByPeriod {
  const { session } = useAuth()
  const isAuthenticated = session !== null

  const { data: fxMap, isLoading: fxLoading, isError: fxError } = useCurrencies()

  const { data: rows, isLoading, isError } = useLiveQuery((q) =>
    isAuthenticated ? q.from({ tx: transactionsCollection }) : null,
  )

  const grouped = useMemo(() => {
    if (!rows || rows.length === 0) {
      return { month: EMPTY_GROUPED, week: EMPTY_GROUPED, day: EMPTY_GROUPED }
    }
    const picked = rows.map(pickTransaction)
    return {
      month: groupTransactions(picked, 'month', fxMap),
      week:  groupTransactions(picked, 'week', fxMap),
      day:   groupTransactions(picked, 'day', fxMap),
    }
  }, [rows, fxMap])

  return { grouped, isLoading: isLoading || fxLoading, isError: isError || fxError }
}
