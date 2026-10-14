import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ListFilter, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { DateRangePicker } from '@/components/ui/date-range-picker'
import TransactionList from '@/features/CreditCardUtilization/TransactionList'
import type { AccountBalance } from '@/types/accounts'
import type { RawTransaction } from '@/types/transactions'
import { formatCurrency } from '@/utils/currency'

export interface AccountActivityViewerProps {
  account: AccountBalance
  transactions: RawTransaction[]
  privacyMode: boolean
  onClose?: () => void
}

/**
 * The structural shell is deliberately data-source-free.  Both the live
 * account viewer and its fixture-backed counterpart use it so that demo mode
 * cannot silently drift into a different activity screen.
 */
export function AccountActivityViewerShell({ children, as: Component = 'section', ...props }: { children: React.ReactNode; as?: React.ElementType } & Record<string, unknown>) {
  return <Component {...props} data-testid="account-activity-viewer" className="h-full min-h-0 max-h-none overflow-x-hidden overflow-y-hidden rounded-xl border border-border bg-surface p-5 flex flex-col gap-3 lg:h-full">{children}</Component>
}

interface Filters { minAmount?: string; maxAmount?: string; range?: DateRange; type?: string; note?: string }

const PAGE_SIZES = [10, 25, 50, 100] as const
const mask = '••••••'

function filterTransactions(rows: RawTransaction[], filters: Filters) {
  const minimum = filters.minAmount === '' || filters.minAmount === undefined ? undefined : Number(filters.minAmount)
  const maximum = filters.maxAmount === '' || filters.maxAmount === undefined ? undefined : Number(filters.maxAmount)
  const note = filters.note?.trim().toLowerCase()
  const start = filters.range?.from && new Date(filters.range.from.getFullYear(), filters.range.from.getMonth(), filters.range.from.getDate()).getTime()
  const endDate = filters.range?.to ?? filters.range?.from
  const end = endDate && new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime()
  return rows.filter((tx) => {
    const timestamp = new Date(tx.date).getTime()
    return !(minimum !== undefined && tx.amount < minimum)
      && !(maximum !== undefined && tx.amount > maximum)
      && !(start && (Number.isNaN(timestamp) || timestamp < start))
      && !(end && (Number.isNaN(timestamp) || timestamp > end))
      && !(filters.type && tx.type !== filters.type)
      && (!note || tx.note.toLowerCase().includes(note))
  })
}

/** Fixture-driven, read-only account activity presentation. */
export default function AccountActivityViewer({ account, transactions: source, privacyMode, onClose }: AccountActivityViewerProps) {
  const [filters, setFilters] = useState<Filters>({})
  const [rowsPerPage, setRowsPerPage] = useState<(typeof PAGE_SIZES)[number]>(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const transactions = useMemo(() => filterTransactions(source, filters).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [source, filters])
  const types = useMemo(() => Array.from(new Set(source.map((tx) => tx.type).filter(Boolean))).sort(), [source])
  const active = Object.values(filters).some(Boolean)
  const pageCount = Math.max(1, Math.ceil(transactions.length / rowsPerPage))
  const page = Math.min(currentPage, pageCount)
  const visible = transactions.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  useEffect(() => setCurrentPage(1), [account.name, filters, rowsPerPage])
  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }))
  const clear = () => setFilters({})
  const balance = privacyMode ? mask : formatCurrency(account.phpEquivalent, 'PHP')
  const native = account.currency !== 'PHP' ? (privacyMode ? mask : formatCurrency(account.currentBalance, account.currency)) : null

  return <AccountActivityViewerShell>
    <header className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold tracking-tight text-text truncate">{account.name}</h2>
        <div aria-label="Account summary" className="mt-2 border-t border-border pt-2 text-xs leading-5">
          <div className="flex items-end justify-between gap-4"><span className="font-medium tabular-nums text-text">{balance}</span>{native && <span className="text-muted tabular-nums">{native}</span>}</div>
          <p className="mt-1 text-muted">{account.category} · {account.currency} · {transactions.length} transaction{transactions.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 self-start">
        {onClose && <button type="button" aria-label="Back to account balances" onClick={onClose} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Balances</button>}
        <button type="button" aria-label="Filter transactions" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ListFilter className="h-4 w-4" aria-hidden="true" />Filters</button>
      </div>
    </header>
    <p role="status" className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">Demo mode — account activity is read-only and changes are not saved.</p>
    {filtersOpen && <div className="shrink-0 grid gap-2 border-b border-border pb-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-xs text-muted">Min amount<input type="number" value={filters.minAmount ?? ''} onChange={(event) => set({ minAmount: event.target.value })} className="mt-1 w-full min-h-10 rounded-md border border-border bg-surface2 px-2 text-sm text-text" /></label>
      <label className="text-xs text-muted">Max amount<input type="number" value={filters.maxAmount ?? ''} onChange={(event) => set({ maxAmount: event.target.value })} className="mt-1 w-full min-h-10 rounded-md border border-border bg-surface2 px-2 text-sm text-text" /></label>
      <label className="text-xs text-muted">Date range<DateRangePicker value={filters.range} onChange={(range) => set({ range })} /></label>
      <label className="text-xs text-muted">Type<select value={filters.type ?? ''} onChange={(event) => set({ type: event.target.value || undefined })} className="mt-1 w-full min-h-10 rounded-md border border-border bg-surface2 px-2 text-sm text-text"><option value="">Any</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="text-xs text-muted">Note<input value={filters.note ?? ''} onChange={(event) => set({ note: event.target.value })} className="mt-1 w-full min-h-10 rounded-md border border-border bg-surface2 px-2 text-sm text-text" placeholder="Search notes" /></label>
      {active && <button type="button" onClick={clear} className="justify-self-start text-xs text-muted underline hover:text-text"><X className="mr-1 inline h-3 w-3" />Clear filters</button>}
    </div>}
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-gutter-stable">
      {transactions.length ? <TransactionList transactions={visible} privacyMode={privacyMode} accountName={account.name} /> : <p className="py-8 text-center text-sm text-muted">{active ? 'No transactions match these filters.' : 'This account has no transactions yet.'}</p>}
    </div>
    {transactions.length > 0 && <footer className="shrink-0 flex items-center justify-between gap-3 border-t border-border pt-3">
      <label className="text-xs text-muted">Rows per page <select aria-label="Rows per page" value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value) as typeof rowsPerPage)} className="ml-1 min-h-10 rounded-md border border-border bg-surface2 px-2 text-text">{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
      <div className="flex gap-1"><button type="button" aria-label="Go to previous page" disabled={page === 1} onClick={() => setCurrentPage(page - 1)} className="min-h-10 min-w-10 rounded-md text-muted hover:bg-surface2 disabled:opacity-40"><ChevronLeft className="mx-auto h-4 w-4" /></button><button type="button" aria-label="Go to next page" disabled={page === pageCount} onClick={() => setCurrentPage(page + 1)} className="min-h-10 min-w-10 rounded-md text-muted hover:bg-surface2 disabled:opacity-40"><ChevronRight className="mx-auto h-4 w-4" /></button></div>
    </footer>}
  </AccountActivityViewerShell>
}
