import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { queryClient } from '@/lib/queryClient'
import { getInstallments } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import {
  INSTALLMENTS_STALE_TIME,
  INSTALLMENTS_GC_TIME,
} from '@/constants/ttl'
import type { RawInstallmentRow } from '@/types/installments'

/**
 * Module-scope TanStack DB collection for raw installment rows.
 *
 * The installments Edge Function returns ALL rows in a single call with no
 * server-side filtering. This collection backs one TanStack Query cache entry;
 * all month evaluation is performed on the frontend via buildInstallmentMonths.
 *
 * Installment rows have no unique id column, so the key is composed from
 * identifying fields plus the row index to guarantee uniqueness within a fetch.
 */
export const installmentsCollection = createCollection(
  queryCollectionOptions<RawInstallmentRow>({
    queryKey:             [QUERY_KEYS.installments],
    queryFn:              () => getInstallments(),
    queryClient,
    getKey:               (item) =>
      [item.name, item.account, item.totalAmount, item.terms, item.termPayment, item.startDate, item.budget, item.currency].join('#'),
    staleTime:            INSTALLMENTS_STALE_TIME,
    gcTime:               INSTALLMENTS_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect:   true,
  })
)
