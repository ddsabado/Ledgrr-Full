/**
 * Reads the debtsReceivablesCollection and the FX map (useCurrencies) via
 * useLiveQuery, returning raw rows for the pure derivation module. The panel
 * lists ALL rows in both directions, so there is NO in-query filtering. The
 * live query is disabled when unauthenticated (callback returns null), mirroring
 * useBudgets.
 */
import { useLiveQuery } from '@tanstack/react-db'

import { debtsReceivablesCollection } from '@/collections/debtsReceivables'
import { useAuth } from '@/context/AuthContext'
import { useCurrencies } from '@/hooks/useCurrencies'
import type { RawDebtReceivableRow } from '@/types/debtsReceivables'
import type { CurrencyData } from '@/types/accounts'

/** Field-picker to avoid spreading TanStack DB internal props onto RawDebtReceivableRow. */
function pickRow(row: RawDebtReceivableRow): RawDebtReceivableRow {
  return {
    name:             row.name,
    account:          row.account,
    date:             row.date,
    totalAmount:      row.totalAmount,
    participants:     row.participants,
    splitBy:          row.splitBy,
    amounts:          row.amounts,
    category:         row.category,
    subcategory:      row.subcategory,
    paidParticipants: row.paidParticipants,
    status:           row.status,
    direction:        row.direction,
    currency:         row.currency,
    resolvedAmount:   row.resolvedAmount,
  }
}

export function useDebtsReceivables(): {
  rows:      RawDebtReceivableRow[]
  fxMap:     CurrencyData
  isLoading: boolean
  isError:   boolean
} {
  const { session } = useAuth()
  const isAuthenticated = session !== null

  const { data: fxMap, isLoading: fxLoading, isError: fxError } = useCurrencies()

  const {
    data:      drRows,
    isLoading: dLoading,
    isError:   dError,
  } = useLiveQuery((q) =>
    isAuthenticated ? q.from({ dr: debtsReceivablesCollection }) : null
  )

  const rows: RawDebtReceivableRow[] = (drRows ?? []).map((r) => pickRow(r as RawDebtReceivableRow))

  return {
    rows,
    fxMap,
    isLoading: dLoading || fxLoading,
    isError:   dError || fxError,
  }
}
