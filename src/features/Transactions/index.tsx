import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { motion, LayoutGroup } from 'motion/react'

import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/utils/currency'
import { useTransactionsByPeriod } from './useTransactionsByPeriod'
import { useCurrencies } from '@/hooks/useCurrencies'
import { findPeriodIndexForSwitch, signedAmount, type PeriodMode } from './groupTransactions'
import PeriodNavigator from './PeriodNavigator'
import CategoryDonut from './CategoryDonut'
import { CHART_COLORS } from '@/features/AccountBalances/BalanceChart'
import {
  CategoriesList,
  SubcategoriesList,
  TransactionRows,
  directLabel,
} from './DrillDownList'

const PRIVACY_MASK = '••••••'

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
  // category index → CHART_COLORS). Subcategory percentages inherit their
  // parent category's colour when drilled in.
  const colorByCategory = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(([name], i) => {
      map.set(name, CHART_COLORS[i % CHART_COLORS.length])
    })
    return map
  }, [categories])
  const colorOf = (name: string) => colorByCategory.get(name) ?? CHART_COLORS[0]

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
      transition={{ duration: 0.15, ease: 'easeInOut' }}
      className={cardShell}
    >
      {/* Heading */}
      <p className="shrink-0 text-xs font-semibold tracking-widest uppercase text-muted">
        Transactions by Period
      </p>

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
        onPrevious={() => goToPeriod(Math.max(0, safeIdx - 1))}
        onNext={() => goToPeriod(Math.min(periods.length - 1, safeIdx + 1))}
        canGoPrevious={safeIdx > 0}
        canGoNext={safeIdx < periods.length - 1}
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
          (non-scrolling); hidden when there are no categories. */}
      {categories.length > 0 && (
        <div className="shrink-0">
          <CategoryDonut
            categories={categories.map(([name, cat]) => [name, cat.total])}
            privacyMode={privacyMode}
          />
        </div>
      )}

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
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
              transactions={detailTxs}
              mask={mask}
              privacyMode={privacyMode}
            />
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
