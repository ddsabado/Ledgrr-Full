import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { queryClient } from '@/lib/queryClient'
import { getTxnCategories } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { TXN_CAT_SUB_GC_TIME, TXN_CAT_SUB_STALE_TIME } from '@/constants/ttl'
import type { TxnCategory } from '@/types/txnCatSub'

/** TanStack DB collection backed by the consolidated transaction taxonomy endpoint. */
export const txnCatSubCollection = createCollection(
  queryCollectionOptions<TxnCategory>({
    queryKey: [QUERY_KEYS.txnCatSub],
    queryFn: () => getTxnCategories(),
    queryClient,
    getKey: (item) => item.category,
    staleTime: TXN_CAT_SUB_STALE_TIME,
    gcTime: TXN_CAT_SUB_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  }),
)
