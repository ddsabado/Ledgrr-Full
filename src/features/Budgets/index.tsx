import { useId, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import FxEstimatedIndicator from '@/components/FxEstimatedIndicator'
import { formatCurrency } from '@/utils/currency'
import { formatCreditCardTransactionDate } from '@/utils/date'
import TransactionNoteTooltip from '@/components/TransactionNoteTooltip'
import MonthNavigator from '@/features/InstallmentsRecurring/MonthNavigator'
import {
  currentYearMonth,
  formatMonth,
  shiftMonth,
  type YearMonth,
} from '@/features/InstallmentsRecurring/buildInstallmentMonths'
import { computeBudgets, resolvePhp, type BudgetRow, type ProgressColor } from './computeBudgets'
import { useBudgets } from './useBudgets'
import { isUnresolvedForeignCurrency } from '@/utils/resolvePhp'
import { useMobileCardSwipe } from '@/hooks/useMobileCardSwipe'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

const PRIVACY_MASK = '••••••'
const TRANSACTION_PAGE_SIZES = [10, 25, 50, 100] as const

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
  const swipeHandlers = useMobileCardSwipe({
    onSwipeLeft: () => changeMonth(1),
    onSwipeRight: () => changeMonth(-1),
  })

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
      {...swipeHandlers}
      data-testid="budgets-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeInOut' }}
      className={`${cardShell} touch-pan-y`}
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
                monthLabel={formatMonth(selectedMonth)}
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
  monthLabel: string
  isExpanded: boolean
  onToggle:   () => void
  mask:       (amount: number, currency?: string) => string
}

function BudgetRowView({ row, fxMap, monthLabel, isExpanded, onToggle, mask }: BudgetRowViewProps) {
  const { name, allotted, spent, remaining, percentage, color, transactions, count, currency } = row
  const rowsPerPageId = useId()
  const [rowsPerPage, setRowsPerPage] = useState<(typeof TRANSACTION_PAGE_SIZES)[number]>(10)
  const transactionSourceKey = `${name}:${monthLabel}:${transactions.map((tx) => tx.key).join('|')}`
  const [pagination, setPagination] = useState({ page: 1, sourceKey: transactionSourceKey })

  // A budget's transaction source changes with its month or matching rows.
  // Reset synchronously so an old page cannot render empty after that change.
  if (pagination.sourceKey !== transactionSourceKey) {
    setPagination({ page: 1, sourceKey: transactionSourceKey })
  }

  const pageCount = Math.max(1, Math.ceil(count / rowsPerPage))
  const page = pagination.sourceKey === transactionSourceKey
    ? Math.min(pagination.page, pageCount)
    : 1
  const paginatedTransactions = transactions.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  )
  const changePage = (nextPage: number) => {
    setPagination({
      page: Math.max(1, Math.min(nextPage, pageCount)),
      sourceKey: transactionSourceKey,
    })
  }
  const changeRowsPerPage = (value: string) => {
    setRowsPerPage(Number(value) as typeof rowsPerPage)
    setPagination({ page: 1, sourceKey: transactionSourceKey })
  }
  const overspent = spent > allotted
  const barWidth = Math.min(percentage, 100)
  const spentDisplay = mask(spent, currency)
  const allottedDisplay = mask(allotted, currency)
  const statusDisplay = overspent
    ? `Over by ${mask(spent - allotted, currency)}`
    : `${mask(remaining, currency)} left`

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${name}: ${spentDisplay} spent of ${allottedDisplay}. ${statusDisplay}. ${count} transaction${count !== 1 ? 's' : ''}.`}
        className="w-full text-left flex flex-col gap-1.5 rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset transition-colors hover:bg-surface2"
      >
        {/* Name + primary spending amount */}
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
          <div className="shrink-0 text-right tabular-nums">
            <div className="text-sm font-semibold text-text">{spentDisplay}</div>
            <div className="mt-0.5 text-xs text-muted">of {allottedDisplay}</div>
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

        {/* One concise status line; bar conveys percentage visually. */}
        <div className="flex items-center justify-between text-xs">
          <span className={`font-medium tabular-nums ${TEXT_COLOR[color]}`}>
            {statusDisplay}
          </span>
          {!isExpanded && (
            <span className="text-muted">
              {count} transaction{count !== 1 ? 's' : ''}
            </span>
          )}
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
            <div className="flex flex-col gap-2" role="region" aria-label={`${name} transactions for ${monthLabel}`}>
              {count === 0 ? (
                <p className="py-3 text-xs text-center text-muted">
                  No transactions for {monthLabel}.
                </p>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto overflow-x-hidden pr-1 scrollbar-gutter-stable">
                    <div className="flex flex-col divide-y divide-border">
                      <p className="py-2 text-xs font-medium text-muted">
                        {count} transaction{count !== 1 ? 's' : ''} in {monthLabel}
                      </p>
                      {paginatedTransactions.map((tx) => (
                        <div key={tx.key} className="flex items-start justify-between py-2 gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text truncate">
                              {tx.category}
                              {tx.subcategory ? ` · ${tx.subcategory}` : ''}
                            </p>
                            <p className="mt-0.5 text-xs text-muted truncate">
                              {formatCreditCardTransactionDate(tx.date)} · {tx.account}
                            </p>
                            {tx.note && <TransactionNoteTooltip note={tx.note} />}
                          </div>
                          <div className="flex flex-col items-end shrink-0 text-right">
                            <div className="flex items-center gap-1">
                              {isUnresolvedForeignCurrency(tx.currency, tx.resolvedAmount) && (
                                <FxEstimatedIndicator transaction={tx} />
                              )}
                              <span className="text-sm font-medium tabular-nums text-text">
                                {mask(resolvePhp(tx, fxMap), 'PHP')}
                              </span>
                            </div>
                            {tx.currency !== 'PHP' && (
                              <span className="text-xs text-muted tabular-nums mt-0.5">
                                {mask(tx.amount, tx.currency)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted" htmlFor={rowsPerPageId}>
                      Rows per page
                      <select
                        id={rowsPerPageId}
                        aria-label="Rows per page"
                        value={rowsPerPage}
                        onChange={(event) => changeRowsPerPage(event.target.value)}
                        className="min-h-9 rounded-md border border-border bg-surface2 px-1.5 text-xs text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {TRANSACTION_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </label>
                    <Pagination aria-label={`${name} transaction pagination`} className="mx-0 w-auto">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious text={false} disabled={page === 1} onClick={() => changePage(page - 1)} />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext text={false} disabled={page === pageCount} onClick={() => changePage(page + 1)} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
