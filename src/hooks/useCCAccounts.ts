/**
 * useCCAccounts
 *
 * Reads from accountBalancesCollection via useLiveQuery, filtered to
 * Credit Card accounts only, then derives per-card computed fields on
 * the frontend by combining with currency FX rates:
 *   phpEquivalent  = currentBalance * fxRate
 *   creditLimitPHP = creditLimit * fxRate
 *   utilization    = (phpEquivalent / creditLimitPHP) * 100  (clamped ≥ 0)
 *   daysUntilDue   = computeDaysUntilDue(dueDay)
 *
 * The CC filter is frontend-only — the accounts-balances Edge Function
 * returns all accounts; useLiveQuery narrows to category === 'Credit Cards'.
 *
 * Returning null from the useLiveQuery callback when unauthenticated
 * disables the query (status='disabled', data=undefined, isLoading=false).
 */
import { eq, useLiveQuery } from '@tanstack/react-db'

import { accountBalancesCollection } from '@/collections/accountBalances'
import { CREDIT_ACCOUNT_TYPE } from '@/constants/accountTypes'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useAuth } from '@/context/AuthContext'
import type { CCAccount } from '@/types/transactions'

/**
 * Days until the next due date for a credit card.
 *
 * Returns null when `dueDay` is null or ≤ 0. Otherwise builds a target
 * date on the given day of the current month; if that date has already
 * passed, rolls forward one month. Returns the ceil of the day delta.
 */
export function computeDaysUntilDue(dueDay: number | null): number | null {
  if (dueDay === null || dueDay <= 0) return null

  const today = new Date()
  const target = new Date(today.getFullYear(), today.getMonth(), dueDay)

  if (target < today) {
    target.setMonth(target.getMonth() + 1)
  }

  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function useCCAccounts(): {
  data:      CCAccount[]
  isLoading: boolean
  isError:   boolean
} {
  const { session } = useAuth()
  const isAuthenticated = session !== null

  const {
    data:      rawRows,
    isLoading: accountsLoading,
    isError:   accountsError,
  } = useLiveQuery(
    (q) => isAuthenticated
      ? q.from({ account: accountBalancesCollection })
          .where(({ account }) => eq(account.accountType, CREDIT_ACCOUNT_TYPE))
      : null
  )

  const {
    data:      fxMap,
    isLoading: currenciesLoading,
    isError:   currenciesError,
  } = useCurrencies()

  const isLoading = accountsLoading || currenciesLoading
  const isError   = accountsError   || currenciesError

  // Explicitly pick typed fields to avoid spreading TanStack DB internal props
  // ($synced, $origin, $key, $collectionId) into the CCAccount shape
  const data: CCAccount[] = (rawRows ?? []).map((row) => {
    const fxRate         = fxMap[row.currency] ?? 1
    const phpEquivalent  = row.currentBalance * fxRate
    const creditLimitPHP = row.creditLimit * fxRate
    const utilization    = creditLimitPHP > 0
      ? Math.max(0, (phpEquivalent / creditLimitPHP) * 100)
      : 0

    return {
      name:           row.name,
      category:       row.category,
      currency:       row.currency,
      currentBalance: row.currentBalance,
      initialBalance: row.initialBalance,
      creditLimit:    row.creditLimit,
      statementDay:   row.statementDay,
      dueDay:         row.dueDay,
      image:          row.image,
      accountType:    row.accountType,
      phpEquivalent,
      utilization,
      daysUntilDue:   computeDaysUntilDue(row.dueDay),
    }
  })

  if (import.meta.env.DEV) {
    console.log('[TanStack DB] accountBalancesCollection.toArray (CC):', accountBalancesCollection.toArray)
  }

  return { data, isLoading, isError }
}
