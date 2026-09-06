import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { queryClient } from '@/lib/queryClient'
import { getCurrencies } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { CURRENCIES_STALE_TIME, CURRENCIES_GC_TIME } from '@/constants/ttl'
import type { CurrencyData } from '@/types/accounts'

/**
 * Internal row shape stored in the collection.
 * The currencies Edge Function returns Record<string, number> (a map), but
 * TanStack DB collections store arrays of objects. We normalise via `select`
 * and reconstruct the map in useCurrencies.
 */
export interface CurrencyRow {
  code: string   // ISO currency code, e.g. "PHP", "USD"
  rate: number   // Rate relative to PHP
}

/**
 * Module-scope TanStack DB collection for FX rates.
 *
 * queryFn returns CurrencyData (Record<string,number>).
 * select converts it to CurrencyRow[] so TanStack DB can store rows with keys.
 */
export const currenciesCollection = createCollection(
  queryCollectionOptions({
    queryKey:             [QUERY_KEYS.currencies] as const,
    queryFn:              getCurrencies,
    queryClient,
    getKey:               (item: CurrencyRow) => item.code,
    select:               (data: CurrencyData): CurrencyRow[] =>
      Object.entries(data).map(([code, rate]) => ({ code, rate })),
    staleTime:            CURRENCIES_STALE_TIME,
    gcTime:               CURRENCIES_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect:   true,
  })
)
