import { useQuery } from '@tanstack/react-query'

import { getCurrencies } from '@/services/api'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { CURRENCIES_STALE_TIME, CURRENCIES_GC_TIME } from '@/constants/ttl'
import { useAuth } from '@/context/AuthContext'
import type { CurrencyData } from '@/types/accounts'

/** PHP is the base currency — always present as a fallback */
const PHP_ONLY: CurrencyData = { PHP: 1 }

export function useCurrencies(): {
  data:      CurrencyData
  isLoading: boolean
  isError:   boolean
} {
  const { session } = useAuth()
  const isAuthenticated = session !== null

  const { data, isLoading, isError } = useQuery({
    queryKey:             [QUERY_KEYS.currencies],
    queryFn:              getCurrencies,
    staleTime:            CURRENCIES_STALE_TIME,
    gcTime:               CURRENCIES_GC_TIME,
    enabled:              isAuthenticated,
    refetchOnWindowFocus: false,   // FX rates don't change on every focus
    refetchOnReconnect:   true,
  })

  return {
    data:      data ?? PHP_ONLY,
    isLoading,
    isError,
  }
}
