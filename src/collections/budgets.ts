import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { queryClient } from '@/lib/queryClient'
import { getBudgets } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import {
  BUDGETS_STALE_TIME,
  BUDGETS_GC_TIME,
} from '@/constants/ttl'
import type { RawBudgetRow } from '@/types/budgets'

/**
 * Module-scope TanStack DB collection for raw budget rows.
 *
 * The budgets Edge Function returns ALL rows in a single call with no
 * server-side computation or filtering. All spent/remaining/percentage
 * derivation happens on the frontend via computeBudgets.
 *
 * Budget rows have no unique id column, so the key composes the identifying
 * field values plus the row index to guarantee uniqueness within a fetch even
 * when two budgets share identical field values.
 */
export const budgetsCollection = createCollection(
  queryCollectionOptions<RawBudgetRow>({
    queryKey:             [QUERY_KEYS.budgets],
    queryFn:              () => getBudgets(),
    queryClient,
    getKey:               (item) => `${item.name}#${item.amount}#${item.currency}`,
    staleTime:            BUDGETS_STALE_TIME,
    gcTime:               BUDGETS_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect:   true,
  })
)
