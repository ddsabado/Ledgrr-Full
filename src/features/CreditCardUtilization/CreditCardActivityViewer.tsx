import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ListFilter, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { DateRangePicker } from '@/components/ui/date-range-picker'
import TransactionList from './TransactionList'
import CycleNavigator from './CycleNavigator'
import type { CurrencyData } from '@/types/accounts'
import type { CCAccount, CCTransactionData, RawTransaction } from '@/types/transactions'
import { formatCurrency } from '@/utils/currency'
import { resolvePhp } from '@/utils/resolvePhp'

export interface CreditCardActivityViewerProps {
  accounts: CCAccount[]
  transactionsByAccount: ReadonlyMap<string, CCTransactionData>
  fxMap: CurrencyData
  accountName: string
  privacyMode: boolean
  onClose?: () => void
  onSelectCard?: (name: string) => void
}

/** Data-source-free shell shared with the authenticated card-activity view. */
export function CreditCardActivityViewerShell({ children, as: Component = 'section', ...props }: { children: React.ReactNode; as?: React.ElementType } & Record<string, unknown>) {
  return <Component {...props} data-testid="credit-card-activity-viewer" className="h-full rounded-xl border border-border bg-surface p-5 flex flex-col gap-4 min-h-0 overflow-hidden">{children}</Component>
}

interface Filters { minAmount?: string; maxAmount?: string; range?: DateRange; type?: string; note?: string }
type View = 'statement' | 'all'
const PAGE_SIZES = [10, 25, 50, 100] as const

function filterRows(rows: RawTransaction[], filters: Filters) {
  const minimum = filters.minAmount === '' || filters.minAmount === undefined ? undefined : Number(filters.minAmount)
  const maximum = filters.maxAmount === '' || filters.maxAmount === undefined ? undefined : Number(filters.maxAmount)
  const note = filters.note?.trim().toLowerCase()
  const start = filters.range?.from && new Date(filters.range.from.getFullYear(), filters.range.from.getMonth(), filters.range.from.getDate()).getTime()
  const lastDate = filters.range?.to ?? filters.range?.from
  const end = lastDate && new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate(), 23, 59, 59, 999).getTime()
  return rows.filter((tx) => {
    const time = new Date(tx.date).getTime()
    return !(minimum !== undefined && tx.amount < minimum) && !(maximum !== undefined && tx.amount > maximum)
      && !(start && (Number.isNaN(time) || time < start)) && !(end && (Number.isNaN(time) || time > end))
      && !(filters.type && tx.type !== filters.type) && (!note || tx.note.toLowerCase().includes(note))
  })
}

/** Fixture-driven, read-only credit-card activity presentation. */
export default function CreditCardActivityViewer({ accounts, transactionsByAccount, fxMap, accountName, privacyMode, onClose, onSelectCard }: CreditCardActivityViewerProps) {
  const [view, setView] = useState<View>('statement')
  const [cycleIndex, setCycleIndex] = useState(0)
  const [filters, setFilters] = useState<Filters>({})
  const [rowsPerPage, setRowsPerPage] = useState<(typeof PAGE_SIZES)[number]>(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const txData = transactionsByAccount.get(accountName)
  const cycles = txData?.cycles ?? []
  const activeCycle = cycles[cycleIndex]
  const source = view === 'statement' ? activeCycle?.transactions ?? [] : txData?.allTxs ?? []
  const transactions = useMemo(() => filterRows(source, filters), [source, filters])
  const types = useMemo(() => Array.from(new Set((txData?.allTxs ?? []).map((tx) => tx.type).filter(Boolean))).sort(), [txData])
  const active = Object.values(filters).some(Boolean)
  const pageCount = Math.max(1, Math.ceil(transactions.length / rowsPerPage))
  const page = Math.min(currentPage, pageCount)
  const visible = transactions.slice((page - 1) * rowsPerPage, page * rowsPerPage)
  const statementTotal = (activeCycle?.transactions ?? []).filter((tx) => tx.type !== 'Transfer').reduce((sum, tx) => sum + resolvePhp(tx, fxMap), 0)

  useEffect(() => { setCycleIndex(0); setCurrentPage(1) }, [accountName])
  useEffect(() => setCurrentPage(1), [view, cycleIndex, filters, rowsPerPage])
  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }))
  const selectCard = (name: string) => { if (name !== accountName) onSelectCard?.(name) }

  return <CreditCardActivityViewerShell>
    <header className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><p className="text-xs font-medium text-muted">Card activity</p>
        <label className="sr-only" htmlFor="demo-credit-card-activity-card">Selected credit card</label>
        <select id="demo-credit-card-activity-card" aria-label="Selected credit card" value={accountName} onChange={(event) => selectCard(event.target.value)} className="mt-1 block min-h-11 max-w-full bg-transparent pr-2 font-display text-xl font-semibold tracking-tight text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">{accounts.map((account) => <option key={account.name} value={account.name}>{account.name}</option>)}</select>
      </div>
      <div className="flex items-center gap-1 self-start">
        {onClose && <button type="button" aria-label="Back to credit cards" onClick={onClose} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronLeft className="h-4 w-4" />Cards</button>}
        <button type="button" aria-label="Filter transactions" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ListFilter className="h-4 w-4" />Filters</button>
      </div>
    </header>
    <p role="status" className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">Demo mode — card activity is read-only and changes are not saved.</p>
    {filtersOpen && <div className="shrink-0 grid gap-2 border-b border-border pb-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-xs text-muted">Min amount<input type="number" value={filters.minAmount ?? ''} onChange={(event) => set({ minAmount: event.target.value })} className="mt-1 w-full min-h-10 rounded-md border border-border bg-surface2 px-2 text-sm text-text" /></label>
      <label className="text-xs text-muted">Max amount<input type="number" value={filters.maxAmount ?? ''} onChange={(event) => set({ maxAmount: event.target.value })} className="mt-1 w-full min-h-10 rounded-md border border-border bg-surface2 px-2 text-sm text-text" /></label>
      <label className="text-xs text-muted">Date range<DateRangePicker value={filters.range} onChange={(range) => set({ range })} /></label>
      <label className="text-xs text-muted">Type<select value={filters.type ?? ''} onChange={(event) => set({ type: event.target.value || undefined })} className="mt-1 w-full min-h-10 rounded-md border border-border bg-surface2 px-2 text-sm text-text"><option value="">Any</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="text-xs text-muted">Note<input value={filters.note ?? ''} onChange={(event) => set({ note: event.target.value })} className="mt-1 w-full min-h-10 rounded-md border border-border bg-surface2 px-2 text-sm text-text" placeholder="Search notes" /></label>
      {active && <button type="button" onClick={() => setFilters({})} className="justify-self-start text-xs text-muted underline hover:text-text"><X className="mr-1 inline h-3 w-3" />Clear filters</button>}
    </div>}
    <div role="tablist" aria-label="Credit-card transaction view" className="grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-surface2 p-1"><button type="button" role="tab" aria-selected={view === 'statement'} onClick={() => setView('statement')} className={`min-h-11 rounded-md text-xs font-medium ${view === 'statement' ? 'bg-accent text-text' : 'text-muted hover:text-text'}`}>By Statement</button><button type="button" role="tab" aria-selected={view === 'all'} onClick={() => setView('all')} className={`min-h-11 rounded-md text-xs font-medium ${view === 'all' ? 'bg-accent text-text' : 'text-muted hover:text-text'}`}>All Transactions</button></div>
    {view === 'statement' && <div className="shrink-0"><CycleNavigator label={activeCycle?.label ?? '—'} onPrevious={() => setCycleIndex((index) => Math.min(index + 1, Math.max(0, cycles.length - 1)))} onNext={() => setCycleIndex((index) => Math.max(0, index - 1))} canGoPrevious={cycleIndex < cycles.length - 1} canGoNext={cycleIndex > 0} /><p className="text-right text-xs tabular-nums text-muted">Total {privacyMode ? '••••••' : formatCurrency(statementTotal, 'PHP')}</p></div>}
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-gutter-stable">{transactions.length ? <TransactionList transactions={visible} privacyMode={privacyMode} fxMap={fxMap} accountName={accountName} /> : <p className="py-8 text-center text-sm text-muted">{active ? 'No matching transactions.' : 'No transactions.'}</p>}</div>
    {transactions.length > 0 && <footer className="shrink-0 flex items-center justify-between gap-3 border-t border-border pt-3"><label className="text-xs text-muted">Rows per page <select aria-label="Rows per page" value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value) as typeof rowsPerPage)} className="ml-1 min-h-10 rounded-md border border-border bg-surface2 px-2 text-text">{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label><div className="flex gap-1"><button type="button" aria-label="Go to previous page" disabled={page === 1} onClick={() => setCurrentPage(page - 1)} className="min-h-10 min-w-10 rounded-md text-muted hover:bg-surface2 disabled:opacity-40"><ChevronLeft className="mx-auto h-4 w-4" /></button><button type="button" aria-label="Go to next page" disabled={page === pageCount} onClick={() => setCurrentPage(page + 1)} className="min-h-10 min-w-10 rounded-md text-muted hover:bg-surface2 disabled:opacity-40"><ChevronRight className="mx-auto h-4 w-4" /></button></div></footer>}
  </CreditCardActivityViewerShell>
}
