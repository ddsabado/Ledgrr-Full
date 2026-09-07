import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { queryClient } from '@/lib/queryClient'
import { getTransactions } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import {
  TRANSACTIONS_STALE_TIME,
  TRANSACTIONS_GC_TIME,
} from '@/constants/ttl'
import type { RawTransaction } from '@/types/transactions'

/**
 * Module-scope TanStack DB collection for raw transactions.
 *
 * The transactions Edge Function returns ALL transactions in a single call
 * with no server-side filtering. This one collection backs a single TanStack
 * Query cache entry; all windowing and credit-card filtering is performed on
 * the frontend via useLiveQuery in the consuming hooks.
 *
 * queryClient is passed directly here (not from React context) because
 * queryCollectionOptions requires a QueryClient instance at creation time.
 */
export const transactionsCollection = createCollection(
  queryCollectionOptions<RawTransaction>({
    queryKey:             [QUERY_KEYS.transactions],
    queryFn:              () => getTransactions(),
    queryClient,
    getKey:               (item) => item.key,
    staleTime:            TRANSACTIONS_STALE_TIME,
    gcTime:               TRANSACTIONS_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect:   true,
  })
)
