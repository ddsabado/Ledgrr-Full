import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { queryClient } from '@/lib/queryClient'
import { getRawAccountBalances } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { ACCOUNT_BALANCES_STALE_TIME, ACCOUNT_BALANCES_GC_TIME } from '@/constants/ttl'
import type { RawAccountBalance } from '@/types/accounts'

/**
 * Module-scope TanStack DB collection for raw account balances.
 *
 * queryCollectionOptions syncs the TanStack Query cache into this collection
 * so that useLiveQuery reads are reactive — components re-render whenever
 * the backing query data changes (background refetch, window focus, etc.).
 *
 * queryClient is passed directly here (not from React context) because
 * queryCollectionOptions requires a QueryClient instance at creation time.
 * We export the queryClient from main.tsx for exactly this purpose.
 */
export const accountBalancesCollection = createCollection(
  queryCollectionOptions<RawAccountBalance>({
    queryKey:             [QUERY_KEYS.accountBalances],
    queryFn:              getRawAccountBalances,
    queryClient,
    getKey:               (item) => item.name,
    staleTime:            ACCOUNT_BALANCES_STALE_TIME,
    gcTime:               ACCOUNT_BALANCES_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect:   true,
  })
)
