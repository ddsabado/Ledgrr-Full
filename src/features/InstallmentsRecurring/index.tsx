import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { PanelLeftOpen, PanelTopOpen } from 'lucide-react'

import FxEstimatedIndicator from '@/components/FxEstimatedIndicator'
import { formatCurrency } from '@/utils/currency'
import MonthNavigator from './MonthNavigator'
import InstallmentDonut from './InstallmentDonut'
import ChartPlaceholder from '@/components/ChartPlaceholder'
import { useInstallmentsRecurring } from './useInstallmentsRecurring'
import { useInstallmentTransactions } from './useInstallmentTransactions'
import { isUnresolvedForeignCurrency } from '@/utils/resolvePhp'
import {
  buildInstallmentMonths,
  currentYearMonth,
  formatMonth,
  shiftMonth,
  type YearMonth,
} from './buildInstallmentMonths'

const PRIVACY_MASK = '••••••'

interface InstallmentsRecurringProps {
  privacyMode: boolean
  viewerOpen?: boolean
  onToggleViewer?: () => void
}

export default function InstallmentsRecurring({
  privacyMode,
  viewerOpen = false,
  onToggleViewer = () => {},
}: InstallmentsRecurringProps) {
  const { installments, recurring, isLoading, isError } = useInstallmentsRecurring()
  const { getMonthItems, isLoading: transactionsLoading, isError: transactionsError } = useInstallmentTransactions(installments)
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(() => currentYearMonth())
  const reduceMotion = useReducedMotion()

  const result = useMemo(() => {
    const recurringResult = buildInstallmentMonths([], recurring, selectedMonth)
    const items = [...getMonthItems(selectedMonth), ...recurringResult.items]
      .sort((a, b) => b.amount - a.amount)
    return { ...recurringResult, items, total: items.reduce((sum, item) => sum + item.amount, 0) }
  }, [getMonthItems, recurring, selectedMonth])

  const mask = (amount: number, currency = 'PHP') =>
    privacyMode ? PRIVACY_MASK : formatCurrency(amount, currency)

  const cardShell = `rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden lg:max-h-none lg:h-full ${viewerOpen ? 'h-full max-h-none' : 'max-h-[calc(100vh-8rem)]'}`

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading || transactionsLoading) {
    return (
      <div className={cardShell}>
        <div className="h-3 w-40 bg-surface2 rounded animate-pulse" />
        <div className="h-48 bg-surface2 rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center gap-3">
            <div className="h-3 w-28 bg-surface2 rounded animate-pulse" />
            <div className="h-3 w-16 bg-surface2 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  const chartItems = result.items.map((item) => ({ name: item.name, amount: item.amount }))

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeInOut' }}
      className={cardShell}
    >
      {/* Heading */}
      <div className="shrink-0 flex items-center justify-between gap-2">
        <p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">
          Installments &amp; Recurring
        </p>
        <motion.button
          type="button"
          aria-label={viewerOpen ? 'Close installments viewer' : 'Open installments viewer'}
          onClick={onToggleViewer}
          animate={{ rotate: viewerOpen ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
          className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelTopOpen aria-hidden="true" className="h-4 w-4 lg:hidden" />
          <PanelLeftOpen aria-hidden="true" className="hidden h-4 w-4 lg:block" />
        </motion.button>
      </div>

      {/* Error line — retains whatever data is available (R9.5) */}
      {(isError || transactionsError) && (
        <p className="shrink-0 text-xs text-danger" role="alert">
          Some data could not be loaded. Showing what is available.
        </p>
      )}

      {/* Chart — the slot is ALWAYS rendered at the chart's height so a month
          with no items does not snap the layout: the donut shows when there
          are items, else a same-height placeholder. */}
      <div className={`shrink-0 ${viewerOpen ? 'hidden lg:block' : ''}`}>
        {result.items.length > 0 ? (
          <InstallmentDonut items={chartItems} privacyMode={privacyMode} />
        ) : (
          <ChartPlaceholder height="h-56" />
        )}
      </div>

      {/* Month navigator */}
      <MonthNavigator
        label={formatMonth(selectedMonth)}
        onPrevious={() => setSelectedMonth((m) => shiftMonth(m, -1))}
        onNext={() => setSelectedMonth((m) => shiftMonth(m, 1))}
      />

      {/* Monthly total */}
      <div className="shrink-0 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-medium text-muted">Monthly total</span>
        <span className="text-sm font-semibold text-text tabular-nums">
          {mask(result.total)}
        </span>
      </div>

      {/* List — the only scroll region; keyed motion.div fades in per month */}
      <div className="flex-1 min-h-0 overflow-y-auto pl-2 pr-1 py-1 scrollbar-gutter-stable">
        <motion.div
          key={`${selectedMonth.year}-${selectedMonth.month}`}
          data-testid="ir-list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className="flex flex-col divide-y divide-border px-1"
        >
          {result.items.length === 0 ? (
            <p className="py-6 px-2 text-sm text-center text-muted">
              No installments or recurring payments for this month.
            </p>
          ) : (
            result.items.map((item, i) => (
              <button key={`${item.name}-${i}`} type="button" onClick={onToggleViewer} className="w-full flex items-start justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset">
                {/* Left: name with the account on its own line underneath */}
                <div className="min-w-0">
                  <p className="text-sm text-text truncate">{item.name}</p>
                  <p className="text-xs text-muted truncate mt-0.5">{item.account}</p>
                </div>

                {/* Right: amount + currency, with metadata underneath */}
                <div className="flex flex-col items-end shrink-0 text-right">
                  <div className="flex items-center gap-1">
                    {isUnresolvedForeignCurrency(item.currency, item.resolvedAmount) && (
                      <FxEstimatedIndicator transaction={item.transactionId ? { key: item.transactionId, amount: item.amount, currency: item.currency, note: item.name } : undefined} />
                    )}
                    <span className="text-sm font-medium tabular-nums text-text">
                      {mask(item.amount, item.currency)}
                    </span>
                  </div>
                  <span className="text-xs text-muted tabular-nums mt-0.5">
                    {item.isRecurring
                      ? item.frequency
                      : `${item.iteration}/${item.terms}`}
                  </span>
                </div>
              </button>
            ))
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
