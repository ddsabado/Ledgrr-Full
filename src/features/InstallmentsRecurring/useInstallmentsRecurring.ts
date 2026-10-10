/**
 * Reads the installments and recurring collections via useLiveQuery and returns
 * the raw rows plus combined loading/error state. All month evaluation is done
 * by the caller via buildInstallmentMonths.
 */
import { useLiveQuery } from '@tanstack/react-db'

import { installmentsCollection } from '@/collections/installments'
import { recurringCollection } from '@/collections/recurring'
import { useAuth } from '@/context/AuthContext'
import type { RawInstallmentRow, RawRecurringRow } from '@/types/installments'

export function useInstallmentsRecurring(): {
  installments: RawInstallmentRow[]
  recurring:    RawRecurringRow[]
  isLoading:    boolean
  isError:      boolean
} {
  const { session } = useAuth()
  const isAuthenticated = session !== null

  const {
    data:      instRows,
    isLoading: instLoading,
    isError:   instError,
  } = useLiveQuery((q) =>
    isAuthenticated ? q.from({ i: installmentsCollection }) : null
  )

  const {
    data:      recRows,
    isLoading: recLoading,
    isError:   recError,
  } = useLiveQuery((q) =>
    isAuthenticated ? q.from({ r: recurringCollection }) : null
  )

  const installments: RawInstallmentRow[] = (instRows ?? []).map((row: RawInstallmentRow) => ({
    name:        row.name,
    account:     row.account,
    totalAmount: row.totalAmount,
    terms:       row.terms,
    termPayment: row.termPayment,
    startDate:   row.startDate,
    budget:      row.budget,
    currency:    row.currency,
  }))

  const recurring: RawRecurringRow[] = (recRows ?? []).map((row: RawRecurringRow) => ({
    name:        row.name,
    account:     row.account,
    amount:      row.amount,
    frequency:   row.frequency,
    startDate:   row.startDate,
    endDate:     row.endDate,
    category:    row.category,
    subcategory: row.subcategory,
    currency:    row.currency,
  }))

  return {
    installments,
    recurring,
    isLoading: instLoading || recLoading,
    isError:   instError || recError,
  }
}
