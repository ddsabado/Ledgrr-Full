import { useCallback } from 'react'

import { buildInstallmentMonths, type YearMonth } from './buildInstallmentMonths'
import { InstallmentsRecurringCard } from './InstallmentsRecurringCard'
import { useInstallmentTransactions } from './useInstallmentTransactions'
import { useInstallmentsRecurring } from './useInstallmentsRecurring'

interface InstallmentsRecurringProps { privacyMode: boolean; viewerOpen?: boolean; onToggleViewer?: () => void }

/** Authenticated data wrapper for the presentational InstallmentsRecurringCard. */
export default function InstallmentsRecurring({ privacyMode, viewerOpen = false, onToggleViewer = () => {} }: InstallmentsRecurringProps) {
  const { installments, recurring, isLoading, isError } = useInstallmentsRecurring()
  const { getMonthItems, isLoading: transactionsLoading, isError: transactionsError } = useInstallmentTransactions(installments)
  const getMonthResult = useCallback((month: YearMonth) => {
    const recurringResult = buildInstallmentMonths([], recurring, month)
    const items = [...getMonthItems(month), ...recurringResult.items].sort((a, b) => b.amount - a.amount)
    return { ...recurringResult, items, total: items.reduce((sum, item) => sum + item.amount, 0) }
  }, [getMonthItems, recurring])
  return <InstallmentsRecurringCard privacyMode={privacyMode} viewerOpen={viewerOpen} onToggleViewer={onToggleViewer} isLoading={isLoading || transactionsLoading} isError={isError || transactionsError} getMonthResult={getMonthResult} />
}

export { InstallmentsRecurringCard } from './InstallmentsRecurringCard'
export { InstallmentsViewerCard, type InstallmentActivityItem, type InstallmentsViewerCardProps } from './InstallmentsViewerCard'
