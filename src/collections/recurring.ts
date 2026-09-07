import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { queryClient } from '@/lib/queryClient'
import { getRecurring } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import {
  RECURRING_STALE_TIME,
  RECURRING_GC_TIME,
} from '@/constants/ttl'
import type { RawRecurringRow } from '@/types/installments'

/**
 * Module-scope TanStack DB collection for raw recurring payment rows.
 *
 * Thin passthrough from the recurring Edge Function; all month evaluation is on
 * the frontend. Rows have no unique id, so the key composes identifying fields
 * plus the row index.
 */
export const recurringCollection = createCollection(
  queryCollectionOptions<RawRecurringRow>({
    queryKey:             [QUERY_KEYS.recurring],
    queryFn:              () => getRecurring(),
    queryClient,
    getKey:               (item) =>
      [item.name, item.account, item.amount, item.frequency, item.startDate, item.endDate, item.category, item.subcategory, item.currency].join('#'),
    staleTime:            RECURRING_STALE_TIME,
    gcTime:               RECURRING_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect:   true,
  })
)
