import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ListFilter, Plus, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { Button } from '../../../@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../../@/components/ui/popover'
import FxEstimatedIndicator from '@/components/FxEstimatedIndicator'
import { formatCurrency } from '@/utils/currency'
import { isUnresolvedForeignCurrency } from '@/utils/resolvePhp'

export interface InstallmentActivityItem {
  key: string; name: string; account: string; amount: number; currency: string
  kind: 'Installment' | 'Recurring'; startDate?: string; terms?: string; budget?: string
  totalAmount?: number; resolvedAmount?: number | null
}

export interface InstallmentsViewerCardProps {
  privacyMode: boolean; items: readonly InstallmentActivityItem[]; onClose?: () => void
  isLoading?: boolean; isError?: boolean; readOnly?: boolean; onNew?: () => void; notice?: ReactNode
}

type ItemTypeFilter = 'any' | 'installment' | 'recurring'
type SortOrder = 'newest' | 'oldest'

function startDateTimestamp(value: string | undefined): number {
  if (!value) return 0
  const parts = value.split('/').map(Number)
  if (parts.length === 3) return new Date(parts[2], parts[0] - 1, parts[1]).getTime()
  if (parts.length === 2) return new Date(parts[1], parts[0] - 1, 1).getTime()
  return 0
}

/** Shared activity presentation. Fixture callers keep it read-only; the dashboard supplies mutations. */
export function InstallmentsViewerCard({ privacyMode, items, onClose, isLoading = false, isError = false, readOnly = true, onNew, notice }: InstallmentsViewerCardProps) {
  const reduceMotion = useReducedMotion()
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('any')
  const [nameFilter, setNameFilter] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const filterActive = itemTypeFilter !== 'any' || Boolean(nameFilter.trim()) || sortOrder !== 'newest'
  const filteredItems = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase()
    const direction = sortOrder === 'newest' ? -1 : 1
    return [...items].filter((item) => itemTypeFilter === 'any' || item.kind.toLowerCase() === itemTypeFilter)
      .filter((item) => !normalizedName || item.name.toLowerCase().includes(normalizedName))
      .sort((a, b) => direction * (startDateTimestamp(a.startDate) - startDateTimestamp(b.startDate)))
  }, [items, itemTypeFilter, nameFilter, sortOrder])
  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 }
  const mask = (amount: number, currency: string) => privacyMode ? '••••••' : formatCurrency(amount, currency)

  return <motion.section layout transition={transition} className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface p-5"><div className="flex h-full min-h-0 flex-col gap-4">
    <header className="flex shrink-0 items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold tracking-tight text-text">Installments</h2><p className="mt-1 text-sm text-muted">Installments and recurring payments</p></div><div className="flex items-center gap-2">
      {onClose && <button type="button" aria-label="Back to installments and recurring payments" onClick={onClose} className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"><ChevronLeft aria-hidden="true" className="h-4 w-4" /><span>Payments</span></button>}
      <Popover><PopoverTrigger asChild><button type="button" aria-label="Filter installments and recurring payments" className="relative rounded-md p-1 text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ListFilter aria-hidden="true" className="h-4 w-4" />{filterActive && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />}</button></PopoverTrigger><PopoverContent align="end" className="flex w-64 flex-col gap-3 bg-surface p-3"><div className="flex items-center justify-between"><span className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Filters</span>{filterActive && <button type="button" onClick={() => { setItemTypeFilter('any'); setNameFilter(''); setSortOrder('newest') }} className="flex items-center gap-1 rounded text-xs text-muted transition-colors hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X aria-hidden="true" className="h-3 w-3" /> Clear</button>}</div><label className="grid gap-1 text-xs text-muted">Type<select value={itemTypeFilter} onChange={(event) => setItemTypeFilter(event.target.value as ItemTypeFilter)} className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="any">Any</option><option value="installment">Installments</option><option value="recurring">Recurring</option></select></label><label className="grid gap-1 text-xs text-muted">Name<input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Search name" className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" /></label><label className="grid gap-1 text-xs text-muted">Sort by transaction date<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="newest">Most recent</option><option value="oldest">Oldest</option></select></label></PopoverContent></Popover>
      {!readOnly && <Button type="button" size="sm" onClick={onNew}><Plus aria-hidden="true" /> New</Button>}
    </div></header>
    {readOnly && <p role="status" className="shrink-0 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">Demo mode — activity is read-only and changes are not saved.</p>}
    {notice}{isError && <p role="alert" className="shrink-0 text-sm text-danger">Some installment data could not be loaded.</p>}
    <motion.div layout transition={transition} className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable">{isLoading && <p className="py-8 text-center text-sm text-muted">Loading installments…</p>}{!isLoading && filteredItems.length === 0 && <p className="py-8 text-center text-sm text-muted">No matching installments or recurring payments.</p>}{!isLoading && filteredItems.length > 0 && <div className="divide-y divide-border">{filteredItems.map((item) => <article key={item.key} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-text">{item.name}</p><span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-medium text-muted">{item.kind}</span></div>{item.startDate && <p className="mt-1 truncate text-xs text-muted">Transaction date: {item.startDate}</p>}<p className="mt-0.5 truncate text-xs text-muted">{item.account}{item.terms ? ` · ${item.terms}` : ''}</p><p className="mt-0.5 truncate text-xs text-muted">Budget: {item.budget || '—'}</p></div><div className="flex shrink-0 flex-col items-end text-right"><div className="flex items-center gap-1">{isUnresolvedForeignCurrency(item.currency, item.resolvedAmount ?? null) && <FxEstimatedIndicator />}<span className="text-sm font-semibold tabular-nums text-text">{mask(item.amount, item.currency)}</span></div>{item.totalAmount !== undefined && <span className="mt-0.5 text-xs tabular-nums text-muted">Total: {mask(item.totalAmount, item.currency)}</span>}</div></article>)}</div>}</motion.div>
  </div></motion.section>
}
