import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { formatCurrency } from '@/utils/currency'
import { parseTxDate } from '@/features/Transactions/groupTransactions'
import MonthNavigator from '@/features/InstallmentsRecurring/MonthNavigator'
import {
  currentYearMonth,
  formatMonth,
  shiftMonth,
  type YearMonth,
} from '@/features/InstallmentsRecurring/buildInstallmentMonths'
import { computeBudgets, resolvePhp, type BudgetRow, type ProgressColor } from './computeBudgets'
import { useBudgets } from './useBudgets'

const PRIVACY_MASK = '••••••'

const BAR_COLOR: Record<ProgressColor, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red:   'bg-red-500',
}
const TEXT_COLOR: Record<ProgressColor, string> = {
  green: 'text-green-500',
  amber: 'text-amber-500',
  red:   'text-red-500',
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** Short "Mmm DD" label for a transaction date, falling back to the raw string. */
function shortDate(raw: string): string {
  const d = parseTxDate(raw)
  if (!d) return raw
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

interface BudgetsProps {
  privacyMode: boolean
}

export default function Budgets({ privacyMode }: BudgetsProps) {
  const { budgets, candidateTxs, fxMap, isLoading, isError } = useBudgets()
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(() => currentYearMonth())
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(
    () => computeBudgets(budgets, candidateTxs, selectedMonth, fxMap),
    [budgets, candidateTxs, selectedMonth, fxMap],
  )

  const mask = (amount: number, currency = 'PHP') =>
    privacyMode ? PRIVACY_MASK : formatCurrency(amount, currency)

  const changeMonth = (delta: number) => {
    setSelectedMonth((m) => shiftMonth(m, delta))
    setExpanded(null) // collapse on month change (R6.4)
  }

  const cardShell =
    'rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full'

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cardShell}>
        <div className="h-3 w-24 bg-surface2 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-32 bg-surface2 rounded animate-pulse" />
            <div className="h-3 w-full bg-surface2 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className={cardShell}>
        <p className="shrink-0 font-display text-xs font-semibold tracking-widest uppercase text-muted">
          Budgets
        </p>
        <p className="text-sm text-danger text-center" role="alert">
          Failed to load budget data.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeInOut' }}
      className={cardShell}
    >
      {/* Heading */}
      <p className="shrink-0 font-display text-xs font-semibold tracking-widest uppercase text-muted">
        Budgets
      </p>

      {/* Month navigator */}
      <MonthNavigator
        label={formatMonth(selectedMonth)}
        onPrevious={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
      />

      {/* Budget list */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-gutter-stable">
        <motion.div
          key={`${selectedMonth.year}-${selectedMonth.month}`}
          data-testid="budgets-list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className="flex flex-col gap-4"
        >
          {rows.length === 0 ? (
            <p className="py-6 px-2 text-sm text-center text-muted">
              No budgets configured.
            </p>
          ) : (
            rows.map((row) => (
              <BudgetRowView
                key={row.name}
                row={row}
                fxMap={fxMap}
                isExpanded={expanded === row.name}
                onToggle={() =>
                  setExpanded((prev) => (prev === row.name ? null : row.name))
                }
                mask={mask}
              />
            ))
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

interface BudgetRowViewProps {
  row:        BudgetRow
  fxMap:      import('@/types/accounts').CurrencyData
  isExpanded: boolean
  onToggle:   () => void
  mask:       (amount: number, currency?: string) => string
}

function BudgetRowView({ row, fxMap, isExpanded, onToggle, mask }: BudgetRowViewProps) {
  const { name, allotted, spent, remaining, percentage, color, transactions, count, currency } = row
  const overspent = spent > allotted
  const barWidth = Math.min(percentage, 100)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full text-left flex flex-col gap-1.5 rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset transition-colors hover:bg-surface2"
      >
        {/* Name + spent/allotted + remaining/over */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <ChevronDown
              aria-hidden="true"
              className={`shrink-0 w-3.5 h-3.5 text-muted transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
            <span className="text-sm font-medium text-text truncate">{name}</span>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm text-muted tabular-nums">
              {mask(spent, currency)} / {mask(allotted, currency)}
            </div>
            <div className="text-xs tabular-nums text-muted">
              {overspent
                ? `Over by ${mask(spent - allotted, currency)}`
                : `${mask(remaining, currency)} left`}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 rounded-full bg-surface2 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${BAR_COLOR[color]}`}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ type: 'tween', duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Percentage + transaction count */}
        <div className="flex items-center justify-between text-xs">
          <span className={`tabular-nums ${TEXT_COLOR[color]}`}>
            {percentage.toFixed(1)}%
          </span>
          <span className="text-muted tabular-nums">
            {count} transaction{count !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {/* Expanded transaction list */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pl-5 pr-1 flex flex-col divide-y divide-border">
              {count === 0 ? (
                <p className="py-3 text-xs text-center text-muted">
                  No transactions for this month.
                </p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.key} className="flex items-start justify-between py-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-text truncate">
                        <span className="text-muted">{shortDate(tx.date)}</span>
                        {'  '}
                        {tx.note || 'No note'}
                      </p>
                      <p className="text-xs text-muted truncate mt-0.5">
                        {tx.category}
                        {tx.subcategory ? ` · ${tx.subcategory}` : ''} · {tx.account}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 text-right">
                      <span className="text-sm font-medium tabular-nums text-text">
                        {mask(resolvePhp(tx, fxMap), 'PHP')}
                      </span>
                      {tx.currency !== 'PHP' && (
                        <span className="text-xs text-muted tabular-nums mt-0.5">
                          {mask(tx.amount, tx.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
