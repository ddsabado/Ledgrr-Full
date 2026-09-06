import { useLiveQuery } from '@tanstack/react-db'

import { currenciesCollection } from '@/collections/currencies'
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

  const { data: rows, isLoading, isError } = useLiveQuery(
    (q) => isAuthenticated
      ? q.from({ currency: currenciesCollection })
      : null
  )

  // Reconstruct the map from collection rows: [{ code, rate }] → { PHP: 1, USD: 56.2 }
  const data: CurrencyData = rows?.length
    ? Object.fromEntries(rows.map(({ code, rate }) => [code, rate]))
    : PHP_ONLY

  if (import.meta.env.DEV) {
    console.log('[TanStack DB] currenciesCollection.toArray:', currenciesCollection.toArray)
  }

  return { data, isLoading, isError }
}
