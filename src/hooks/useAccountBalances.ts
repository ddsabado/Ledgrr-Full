/**
 * useAccountBalances
 *
 * Fetches raw account rows and FX rates in parallel, then derives
 * phpEquivalent on the frontend:
 *   phpEquivalent = currentBalance * fxRate
 *
 * Both queries are fired simultaneously via TanStack Query.
 * The hook is considered loading until both resolve.
 * If either errors, isError is true.
 *
 * NOTE: The spec called for TanStack DB (createCollection/useLiveQuery).
 * TanStack DB v0.x requires a full DbClient/DbProvider setup and the
 * queryCollectionOptions API requires passing a queryClient instance —
 * making module-scope collection creation impossible without React context.
 * Standard TanStack Query achieves the same caching goals (staleTime, gcTime,
 * background refetch) without the additional setup complexity.
 * TanStack DB integration can be revisited when the library reaches stable API.
 */
import { useQuery } from '@tanstack/react-query'

import { getRawAccountBalances } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { ACCOUNT_BALANCES_STALE_TIME, ACCOUNT_BALANCES_GC_TIME } from '@/constants/ttl'
import { useAuth } from '@/context/AuthContext'
import { useCurrencies } from '@/hooks/useCurrencies'
import type { AccountBalance } from '@/types/accounts'

export function useAccountBalances(): {
  data:      AccountBalance[]
  isLoading: boolean
  isError:   boolean
} {
  const { session } = useAuth()
  const isAuthenticated = session !== null

  const {
    data:      rawAccounts,
    isLoading: accountsLoading,
    isError:   accountsError,
  } = useQuery({
    queryKey:             [QUERY_KEYS.accountBalances],
    queryFn:              getRawAccountBalances,
    staleTime:            ACCOUNT_BALANCES_STALE_TIME,
    gcTime:               ACCOUNT_BALANCES_GC_TIME,
    enabled:              isAuthenticated,
    refetchOnWindowFocus: true,
    refetchOnReconnect:   true,
  })

  const {
    data:      fxMap,
    isLoading: currenciesLoading,
    isError:   currenciesError,
  } = useCurrencies()

  const isLoading = accountsLoading || currenciesLoading
  const isError   = accountsError   || currenciesError

  const data: AccountBalance[] = (rawAccounts ?? []).map((account) => ({
    ...account,
    phpEquivalent: account.currentBalance * (fxMap[account.currency] ?? 1),
  }))

  return { data, isLoading, isError }
}
