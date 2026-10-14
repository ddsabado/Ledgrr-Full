import { useMemo, useState } from 'react'

import { currentYearMonth, shiftMonth, type YearMonth } from '@/features/InstallmentsRecurring/buildInstallmentMonths'
import { computeBudgets } from './computeBudgets'
import { useBudgets } from './useBudgets'
import { BudgetsCard } from './BudgetsCard'

interface BudgetsProps {
  privacyMode: boolean
}

/** Data wrapper for the prop-driven Budgets presentation card. */
export default function Budgets({ privacyMode }: BudgetsProps) {
  const { budgets, candidateTxs, fxMap, isLoading, isError } = useBudgets()
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(() => currentYearMonth())
  const rows = useMemo(
    () => computeBudgets(budgets, candidateTxs, selectedMonth, fxMap),
    [budgets, candidateTxs, selectedMonth, fxMap],
  )
  const changeMonth = (delta: number) => setSelectedMonth((month) => shiftMonth(month, delta))
  const cardShell =
    'rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full'

  if (isLoading) {
    return <div className={cardShell}><div className="h-3 w-24 bg-surface2 rounded animate-pulse" />{[1, 2, 3].map((i) => <div key={i} className="flex flex-col gap-2"><div className="h-3 w-32 bg-surface2 rounded animate-pulse" /><div className="h-3 w-full bg-surface2 rounded animate-pulse" /></div>)}</div>
  }
  if (isError) {
    return <div className={cardShell}><p className="shrink-0 font-display text-xs font-semibold tracking-widest uppercase text-muted">Budgets</p><p className="text-sm text-danger text-center" role="alert">Failed to load budget data.</p></div>
  }

  return <BudgetsCard rows={rows} fxMap={fxMap} privacyMode={privacyMode} selectedMonth={selectedMonth} onMonthChange={changeMonth} />
}

export { BudgetsCard } from './BudgetsCard'
