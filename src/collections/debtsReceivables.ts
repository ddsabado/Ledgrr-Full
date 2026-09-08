import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { queryClient } from '@/lib/queryClient'
import { getDebtsReceivables } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import {
  DEBTS_RECEIVABLES_STALE_TIME,
  DEBTS_RECEIVABLES_GC_TIME,
} from '@/constants/ttl'
import type { RawDebtReceivableRow } from '@/types/debtsReceivables'

/**
 * Module-scope TanStack DB collection for raw Debts & Receivables rows.
 *
 * The debtsandreceivables Edge Function returns ALL rows in a single call with
 * no server-side computation or filtering. All parsing, PHP resolution, and
 * status derivation happen on the frontend via computeDebtsReceivables.
 *
 * Rows have no unique id column, so the key composes identifying field values
 * to stay unique within a fetch.
 */
export const debtsReceivablesCollection = createCollection(
  queryCollectionOptions<RawDebtReceivableRow>({
    queryKey:             [QUERY_KEYS.debtsReceivables],
    queryFn:              () => getDebtsReceivables(),
    queryClient,
    getKey:               (item) =>
      `${item.name}#${item.date}#${item.direction}#${item.participants}#${item.totalAmount}`,
    staleTime:            DEBTS_RECEIVABLES_STALE_TIME,
    gcTime:               DEBTS_RECEIVABLES_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect:   true,
  })
)
