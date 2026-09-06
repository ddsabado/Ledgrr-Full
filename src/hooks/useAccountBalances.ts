/**
 * useAccountBalances
 *
 * Reads from two TanStack DB collections (accountBalancesCollection,
 * currenciesCollection) via useLiveQuery, then derives phpEquivalent
 * on the frontend:
 *   phpEquivalent = currentBalance * fxRate
 *
 * Both collections are backed by queryCollectionOptions, which wires
 * TanStack Query's fetch/cache/background-refetch lifecycle into the
 * TanStack DB store. useLiveQuery provides reactive reads — components
 * re-render automatically whenever either collection's data changes.
 *
 * Returning null from the useLiveQuery callback when unauthenticated
 * disables the query (status='disabled', data=undefined, isLoading=false).
 */
import { useLiveQuery } from '@tanstack/react-db'

import { accountBalancesCollection } from '@/collections/accountBalances'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useAuth } from '@/context/AuthContext'
import type { AccountBalance } from '@/types/accounts'

export function useAccountBalances(): {
  data:      AccountBalance[]
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
  // ($synced, $origin, $key, $collectionId) into the AccountBalance shape
  const data: AccountBalance[] = (rawRows ?? []).map((row) => ({
    name:           row.name,
    category:       row.category,
    currency:       row.currency,
    currentBalance: row.currentBalance,
    initialBalance: row.initialBalance,
    metadata:       row.metadata,
    phpEquivalent:  row.currentBalance * (fxMap[row.currency] ?? 1),
  }))

  if (import.meta.env.DEV) {
    console.log('[TanStack DB] accountBalancesCollection.toArray:', accountBalancesCollection.toArray)
  }

  return { data, isLoading, isError }
}
