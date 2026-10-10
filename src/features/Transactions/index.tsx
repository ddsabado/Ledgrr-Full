import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { motion, LayoutGroup, useReducedMotion } from 'motion/react'

import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/utils/currency'
import { useTransactionsByPeriod } from './useTransactionsByPeriod'
import { useCurrencies } from '@/hooks/useCurrencies'
import { findPeriodIndexForSwitch, signedAmount, type PeriodMode } from './groupTransactions'
import PeriodNavigator from './PeriodNavigator'
import { useMobileCardSwipe } from './useMobileCardSwipe'
import CategoryDonut from './CategoryDonut'
import ChartPlaceholder from '@/components/ChartPlaceholder'
import { chartColor } from '@/features/AccountBalances/BalanceChart'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  CategoriesList,
  SubcategoriesList,
  TransactionRows,
  directLabel,
} from './DrillDownList'

const PRIVACY_MASK = '••••••'
const TRANSACTION_PAGE_SIZES = [10, 25, 50, 100] as const

type FlowType = 'Expense' | 'Income'
type DrillView = 'categories' | 'subcategories' | 'transactions'

interface ViewState {
  type:         DrillView
  category?:    string
  subcategory?: string
}

const PERIOD_TABS: ReadonlyArray<{ id: PeriodMode; label: string }> = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
]

const FLOW_TABS: ReadonlyArray<{ id: FlowType; label: string }> = [
  { id: 'Expense', label: 'Expense' },
  { id: 'Income', label: 'Income' },
]

interface TransactionsProps {
  privacyMode: boolean
}

export default function Transactions({ privacyMode }: TransactionsProps) {
  const { session } = useAuth()
  const { data: fxMap } = useCurrencies()
  const { grouped, isLoading, isError } = useTransactionsByPeriod()

  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [periodIdx, setPeriodIdx] = useState<number>(-1) // -1 = uninitialised
  const [flow, setFlow] = useState<FlowType>('Expense')
  const [view, setView] = useState<ViewState>({ type: 'categories' })
  const [rowsPerPage, setRowsPerPage] = useState<(typeof TRANSACTION_PAGE_SIZES)[number]>(10)
  const [currentPage, setCurrentPage] = useState(1)
  const reducedMotion = useReducedMotion() ?? false

  const active = grouped[periodMode]
  const periods = active.periods

  // Initialise / re-sync the period index to the current period when the data
  // (and therefore currentIndex) changes for the active mode.
  useEffect(() => {
    setPeriodIdx(active.currentIndex)
  }, [active.currentIndex])

  const safeIdx = Math.max(0, Math.min(periodIdx, periods.length - 1))
  const currentPeriod = periods[safeIdx]

  const typeData = currentPeriod?.[flow] ?? {}
  const categories = useMemo(
    () => Object.entries(typeData).sort((a, b) => b[1].total - a[1].total),
    [typeData],
  )
  const periodTotal = categories.reduce((sum, [, cat]) => sum + cat.total, 0)

  // Stable category → colour map, aligned with the donut slice order (sorted
  // category index → chartColor). Subcategory percentages inherit their
  // parent category's colour when drilled in.
  const colorByCategory = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(([name], i) => {
      map.set(name, chartColor(i, categories.length))
    })
    return map
  }, [categories])
  const colorOf = (name: string) => colorByCategory.get(name) ?? chartColor(0, 1)

  const mask = (amount: number) => (privacyMode ? PRIVACY_MASK : formatCurrency(amount, 'PHP'))

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handlePeriodModeChange = (mode: PeriodMode) => {
    if (mode === periodMode) return
    const newPeriods = grouped[mode].periods
    const newIdx = findPeriodIndexForSwitch(periods, safeIdx, newPeriods, periodMode, mode)
    setPeriodMode(mode)
    setPeriodIdx(newIdx)
    setView({ type: 'categories' })
  }

  const handleFlowChange = (next: FlowType) => {
    if (next === flow) return
    setFlow(next)
    setView({ type: 'categories' })
  }

  const goToPeriod = (idx: number) => {
    setPeriodIdx(idx)
    setView({ type: 'categories' })
  }

  const canGoPrevious = safeIdx > 0
  const canGoNext = safeIdx < periods.length - 1
  const goToPreviousPeriod = () => goToPeriod(Math.max(0, safeIdx - 1))
  const goToNextPeriod = () => goToPeriod(Math.min(periods.length - 1, safeIdx + 1))
  const periodSwipe = useMobileCardSwipe({
    enabled: view.type === 'categories' && periods.length > 1,
    reducedMotion,
    canGoPrevious,
    canGoNext,
    onPrevious: goToPreviousPeriod,
    onNext: goToNextPeriod,
  })
  const { feedback: swipeFeedback, ...periodSwipeHandlers } = periodSwipe
  const swipeContentOffset =
    swipeFeedback === 'previous' ? -12 : swipeFeedback === 'next' ? 12 : 0

  const handleCategoryClick = (category: string) => {
    const hasSubcats = Object.keys(typeData[category]?.subcats ?? {}).length > 0
    setView(
      hasSubcats
        ? { type: 'subcategories', category }
        : { type: 'transactions', category },
    )
  }

  const handleSubcategoryClick = (subcategory: string) => {
    setView({ type: 'transactions', category: view.category, subcategory })
  }

  const back = () => {
    if (view.type === 'transactions' && view.subcategory) {
      setView({ type: 'subcategories', category: view.category })
    } else {
      setView({ type: 'categories' })
    }
  }

  // Detail-view total and transactions for the active drill level.
  const { detailTotal, detailTxs } = useMemo(() => {
    if (view.type === 'subcategories' && view.category) {
      return { detailTotal: typeData[view.category]?.total ?? 0, detailTxs: [] }
    }
    if (view.type === 'transactions' && view.category) {
      const cat = typeData[view.category]
      if (!cat) return { detailTotal: 0, detailTxs: [] }
      if (view.subcategory) {
        if (view.subcategory === directLabel(view.category)) {
          const txs = cat.txs
          return { detailTotal: txs.reduce((s, t) => s + signedAmount(t, fxMap), 0), detailTxs: txs }
        }
        const sub = cat.subcats[view.subcategory]
        return { detailTotal: sub?.total ?? 0, detailTxs: sub?.txs ?? [] }
      }
      // Category with no subcategories → direct txs.
      return { detailTotal: cat.total, detailTxs: cat.txs }
    }
    return { detailTotal: 0, detailTxs: [] }
  }, [view, typeData])

  // A page belongs to one period/flow/drill-down source. Reset it whenever
  // that source changes so users never land on a stale or empty page.
  const transactionSourceKey = `${periodMode}-${currentPeriod?.key ?? ''}-${flow}-${view.type}-${view.category ?? ''}-${view.subcategory ?? ''}`
  useEffect(() => {
    setCurrentPage(1)
  }, [transactionSourceKey, rowsPerPage])

  const transactionPageCount = Math.max(1, Math.ceil(detailTxs.length / rowsPerPage))
  const transactionPage = Math.min(currentPage, transactionPageCount)
  const paginatedDetailTxs = detailTxs.slice(
    (transactionPage - 1) * rowsPerPage,
    transactionPage * rowsPerPage,
  )
  const changeTransactionPage = (nextPage: number) => {
    setCurrentPage(Math.max(1, Math.min(nextPage, transactionPageCount)))
  }

  // ─── Auth guard ───────────────────────────────────────────────────────────
  if (session === null) return null

  const cardShell =
    'rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full'

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cardShell}>
        <div className="h-3 w-40 bg-surface2 rounded animate-pulse" />
        <div className="h-9 bg-surface2 rounded-lg animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between items-center gap-3">
            <div className="h-3 w-28 bg-surface2 rounded animate-pulse" />
            <div className="h-3 w-16 bg-surface2 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p className="text-sm text-muted text-center">
          Could not load transactions. Please try again later.
        </p>
      </div>
    )
  }

  const detailLabel =
    view.type === 'subcategories'
      ? view.category
      : view.subcategory ?? view.category

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeInOut' }}
      className={cardShell}
      data-testid="transactions-card"
      {...periodSwipeHandlers}
    >
      {/* Header — matches the responsive dashboard-card header rhythm. */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 lg:flex-nowrap">
        <div className="flex min-w-0 basis-full items-center gap-2 lg:flex-1 lg:basis-auto">
          <p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">
            Transactions by Period
          </p>
        </div>
      </header>

      {/* Time-window tabs */}
      <LayoutGroup>
        <div
          role="tablist"
          aria-label="Time window"
          className="shrink-0 flex items-center gap-1 rounded-lg bg-surface2 p-1"
        >
          {PERIOD_TABS.map((tab) => {
            const isSelected = periodMode === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handlePeriodModeChange(tab.id)}
                className={`relative flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected ? 'text-text' : 'text-muted hover:text-text'
                }`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="tx-period-pill"
                    className="absolute inset-0 rounded-md bg-accent"
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </LayoutGroup>

      {/* Period navigator */}
      <PeriodNavigator
        label={currentPeriod?.label ?? '—'}
        onPrevious={goToPreviousPeriod}
        onNext={goToNextPeriod}
        canGoPrevious={canGoPrevious}
        canGoNext={canGoNext}
      />

      {/* Flow tabs */}
      <LayoutGroup>
        <div
          role="tablist"
          aria-label="Flow type"
          className="shrink-0 mx-auto flex items-center gap-1 rounded-lg bg-surface2 p-1"
        >
          {FLOW_TABS.map((tab) => {
            const isSelected = flow === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleFlowChange(tab.id)}
                className={`relative rounded-md px-5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected ? 'text-text' : 'text-muted hover:text-text'
                }`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="tx-flow-pill"
                    className="absolute inset-0 rounded-md bg-accent"
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </LayoutGroup>

      {/* Category donut — reflects the active period + flow breakdown. Fixed
          (non-scrolling). The slot is ALWAYS rendered at the chart's height so
          switching to an empty period/flow does not snap the layout: the donut
          shows when there are categories, else a same-height placeholder. */}
      <div className="shrink-0">
        {categories.length > 0 ? (
          <CategoryDonut
            categories={categories.map(([name, cat]) => [name, cat.total])}
            privacyMode={privacyMode}
          />
        ) : (
          <ChartPlaceholder height="h-56" />
        )}
      </div>

      {/* Back + Total row */}
      <div className="shrink-0 flex items-center justify-between border-t border-border pt-3 min-h-[1.75rem]">
        {view.type !== 'categories' ? (
          <button
            type="button"
            onClick={back}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
          >
            <ChevronLeft className="w-4 h-4" />
            {detailLabel}
          </button>
        ) : (
          <span className="text-sm font-medium text-text">Total</span>
        )}
        <span className="text-sm font-semibold text-text tabular-nums">
          {mask(view.type === 'categories' ? periodTotal : detailTotal)}
        </span>
      </div>

      {/* Drill-down list — the only scroll region. Keyed motion.div remounts on
          each view change for a clean fade-in (no AnimatePresence: exits don't
          resolve in jsdom and would leave stale nodes mounted). */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-gutter-stable">
        <motion.div
          key={`${periodMode}-${currentPeriod?.key ?? ''}-${flow}-${view.type}-${view.category ?? ''}-${view.subcategory ?? ''}`}
          initial={{
            opacity: 0,
            x: reducedMotion ? 0 : swipeContentOffset,
            filter: reducedMotion ? 'none' : 'blur(2px)',
          }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          data-testid="transactions-content"
          data-swipe-feedback={swipeFeedback ?? undefined}
        >
          {view.type === 'categories' && (
            <CategoriesList
              categories={categories}
              total={periodTotal}
              mask={mask}
              onCategoryClick={handleCategoryClick}
              colorOf={colorOf}
            />
          )}

          {view.type === 'subcategories' && view.category && typeData[view.category] && (
            <SubcategoriesList
              category={view.category}
              catData={typeData[view.category]}
              mask={mask}
              onSubcategoryClick={handleSubcategoryClick}
              color={colorOf(view.category)}
            />
          )}

          {view.type === 'transactions' && (
            <TransactionRows
              transactions={paginatedDetailTxs}
              mask={mask}
              privacyMode={privacyMode}
            />
          )}
        </motion.div>
      </div>

      {view.type === 'transactions' && detailTxs.length > 0 && (
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border pt-3">
          <label className="flex items-center gap-1.5 text-xs text-muted" htmlFor="transactions-rows-per-page">
            Rows per page
            <select
              id="transactions-rows-per-page"
              aria-label="Rows per page"
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value) as typeof rowsPerPage)}
              className="min-h-9 rounded-md border border-border bg-surface2 px-1.5 text-xs text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {TRANSACTION_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <Pagination aria-label="Transaction pagination" className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  text={false}
                  disabled={transactionPage === 1}
                  onClick={() => changeTransactionPage(transactionPage - 1)}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  text={false}
                  disabled={transactionPage === transactionPageCount}
                  onClick={() => changeTransactionPage(transactionPage + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </motion.div>
  )
}
