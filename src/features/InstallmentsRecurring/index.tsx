import { useMemo, useState } from 'react'
import { motion } from 'motion/react'

import { formatCurrency } from '@/utils/currency'
import MonthNavigator from './MonthNavigator'
import InstallmentDonut from './InstallmentDonut'
import ChartPlaceholder from '@/components/ChartPlaceholder'
import { useInstallmentsRecurring } from './useInstallmentsRecurring'
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
}

export default function InstallmentsRecurring({ privacyMode }: InstallmentsRecurringProps) {
  const { installments, recurring, isLoading, isError } = useInstallmentsRecurring()
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(() => currentYearMonth())

  const result = useMemo(
    () => buildInstallmentMonths(installments, recurring, selectedMonth),
    [installments, recurring, selectedMonth],
  )

  const mask = (amount: number, currency = 'PHP') =>
    privacyMode ? PRIVACY_MASK : formatCurrency(amount, currency)

  const cardShell =
    'rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full'

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeInOut' }}
      className={cardShell}
    >
      {/* Heading */}
      <p className="shrink-0 text-xs font-semibold tracking-widest uppercase text-muted">
        Installments &amp; Recurring
      </p>

      {/* Error line — retains whatever data is available (R9.5) */}
      {isError && (
        <p className="shrink-0 text-xs text-danger" role="alert">
          Some data could not be loaded. Showing what is available.
        </p>
      )}

      {/* Chart — the slot is ALWAYS rendered at the chart's height so a month
          with no items does not snap the layout: the donut shows when there
          are items, else a same-height placeholder. */}
      <div className="shrink-0">
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
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-gutter-stable">
        <motion.div
          key={`${selectedMonth.year}-${selectedMonth.month}`}
          data-testid="ir-list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className="flex flex-col divide-y divide-border"
        >
          {result.items.length === 0 ? (
            <p className="py-6 px-2 text-sm text-center text-muted">
              No installments or recurring payments for this month.
            </p>
          ) : (
            result.items.map((item, i) => (
              <div key={`${item.name}-${i}`} className="flex items-start justify-between py-2 gap-3">
                {/* Left: name with the account on its own line underneath */}
                <div className="min-w-0">
                  <p className="text-sm text-text truncate">{item.name}</p>
                  <p className="text-xs text-muted truncate mt-0.5">{item.account}</p>
                </div>

                {/* Right: amount + currency, with metadata underneath */}
                <div className="flex flex-col items-end shrink-0 text-right">
                  <span className="text-sm font-medium tabular-nums text-text">
                    {mask(item.amount, item.currency)}
                  </span>
                  <span className="text-xs text-muted tabular-nums mt-0.5">
                    {item.isRecurring
                      ? item.frequency
                      : `${item.iteration}/${item.terms}`}
                  </span>
                </div>
              </div>
            ))
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
