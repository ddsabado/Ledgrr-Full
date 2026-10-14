import { useEffect, useMemo, useState } from 'react'
import { Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import FxEstimatedIndicator from '@/components/FxEstimatedIndicator'
import { formatCurrency } from '@/utils/currency'
import type { DebtReceivableView } from './computeDebtsReceivables'
import DebtsReceivablesFilter, { type DRFilters } from './DebtsReceivablesFilter'

const PRIVACY_MASK = '••••••'

export interface DebtsReceivablesCardProps { privacyMode: boolean; views: DebtReceivableView[]; isLoading?: boolean; isError?: boolean; viewerOpen?: boolean; onToggleViewer?: () => void; selectedRecord?: string | null; onSelectRecord?: (key: string) => void }

/** Presentational dashboard card. Filtering and selected-record reconciliation are local UI state. */
export function DebtsReceivablesCard({ privacyMode, views, isLoading = false, isError = false, viewerOpen = false, onToggleViewer, selectedRecord = null, onSelectRecord = () => {} }: DebtsReceivablesCardProps) {
  const hasViewerToggle = Boolean(onToggleViewer)
  const toggleViewer = onToggleViewer ?? (() => {})
  const reduceMotion = useReducedMotion()
  const [filters, setFilters] = useState<DRFilters>({})
  const accountOptions = useMemo(() => Array.from(new Set(views.map((v) => v.account).filter((a) => a !== ''))).sort(), [views])
  const filteredViews = useMemo(() => {
    const name = filters.name?.trim().toLowerCase()
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime()
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
    const fromTs = filters.range?.from ? startOfDay(filters.range.from) : null
    const toTs = filters.range?.to ? endOfDay(filters.range.to) : filters.range?.from ? endOfDay(filters.range.from) : null
    return views.filter((v) => {
      if (name && !v.name.toLowerCase().includes(name)) return false
      if (filters.status && v.overallStatus !== filters.status && v.rawStatus !== filters.status) return false
      if (filters.account && v.account !== filters.account) return false
      if (fromTs != null && (v.sortTs == null || v.sortTs < fromTs || (toTs != null && v.sortTs > toTs))) return false
      return true
    })
  }, [views, filters])
  const activeRecord = filteredViews.some((view) => view.key === selectedRecord) ? selectedRecord : (filteredViews[0]?.key ?? null)
  useEffect(() => { if (viewerOpen && activeRecord && activeRecord !== selectedRecord) onSelectRecord(activeRecord) }, [activeRecord, onSelectRecord, selectedRecord, viewerOpen])
  const mask = (amount: number, currency = 'PHP') => privacyMode ? PRIVACY_MASK : formatCurrency(amount, currency)
  const cardShell = `rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden lg:max-h-none lg:h-full ${viewerOpen ? 'h-full max-h-none' : 'max-h-[calc(100vh-8rem)]'}`
  if (isLoading) return <div className={cardShell}><div className="h-3 w-32 bg-surface2 rounded animate-pulse" />{[1, 2, 3].map((i) => <div key={i} className="flex flex-col gap-2"><div className="h-3 w-40 bg-surface2 rounded animate-pulse" /><div className="h-3 w-full bg-surface2 rounded animate-pulse" /></div>)}</div>
  if (isError) return <div className={cardShell}><p className="shrink-0 font-display text-xs font-semibold tracking-widest uppercase text-muted">Debts &amp; Receivables</p><p className="text-sm text-danger text-center" role="alert">Failed to load debts &amp; receivables data.</p></div>
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: 'easeInOut' }} className={cardShell}>
    <div className="shrink-0 flex items-center justify-between gap-2"><p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Debts &amp; Receivables</p><div className="flex items-center gap-2"><DebtsReceivablesFilter filters={filters} onChange={setFilters} accounts={accountOptions} /><motion.button type="button" aria-label={viewerOpen ? 'Close debts and receivables viewer' : 'Open debts and receivables viewer'} title={viewerOpen ? 'Close debts and receivables viewer' : 'Open debts and receivables viewer'} onClick={toggleViewer} className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><motion.span animate={{ rotate: viewerOpen ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }} className="flex">{viewerOpen ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />}</motion.span><span className="flex min-w-0"><AnimatePresence initial={false} mode="wait"><motion.span key={viewerOpen ? 'close-activity' : 'view-activity'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeInOut' }} className="flex items-center whitespace-nowrap">{viewerOpen ? 'Close activity' : 'View activity'}</motion.span></AnimatePresence></span></motion.button></div></div>
    {views.length === 0 ? <p className="flex-1 py-6 px-2 text-sm text-center text-muted">No records.</p> : filteredViews.length === 0 ? <p className="flex-1 py-6 px-2 text-sm text-center text-muted">No matching records.</p> : <div className="flex-1 min-h-0 overflow-y-auto px-1 py-1 scrollbar-gutter-stable"><div data-testid="debts-receivables-list" className="flex flex-col gap-4">{filteredViews.map((view) => <RecordView key={view.key} view={view} mask={mask} selected={viewerOpen && activeRecord === view.key} onToggle={() => { if (viewerOpen) { if (activeRecord === view.key) toggleViewer(); else onSelectRecord(view.key) } else if (hasViewerToggle) { onSelectRecord(view.key); toggleViewer() } }} />)}</div></div>}
  </motion.div>
}

function RecordView({ view, mask, selected, onToggle }: { view: DebtReceivableView; mask: (amount: number, currency?: string) => string; selected: boolean; onToggle: () => void }) {
  const meta = [view.dateLabel, view.account, view.direction].filter((s) => s !== '').join(' · ')
  const isSettled = view.overallStatus === 'Settled'
  const isForeign = view.currency !== 'PHP'
  return <div data-testid="dr-record" className={`flex flex-col border-b border-border hover:bg-surface2 pb-0 last:border-b-0 ${selected ? 'rounded-lg ring-1 ring-accent bg-accent/10' : ''}`}><button type="button" onClick={onToggle} aria-pressed={selected || undefined} className="w-full text-left flex flex-col gap-2 rounded-lg px-2 pt-2 pb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset transition-colors hover:bg-surface2"><div className="flex items-start justify-between gap-3"><div className="flex items-start min-w-0"><div className="min-w-0"><p className="text-sm font-medium text-text truncate">{view.name}</p>{meta !== '' && <p className="text-xs text-muted truncate mt-0.5">{meta}</p>}</div></div><div className="flex flex-col items-end shrink-0 text-right"><div className="flex items-center gap-1">{view.totalEstimated && <FxEstimatedIndicator />}<span className="text-sm font-medium tabular-nums text-text">{mask(view.totalPhp, 'PHP')}</span></div>{isForeign && <span className="text-xs text-muted tabular-nums mt-0.5">{mask(view.totalNative, view.currency)}</span>}</div></div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isSettled ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>{isSettled && <Check aria-hidden="true" className="w-3 h-3" />}{view.overallStatus}</span>{view.rawStatus !== '' && view.rawStatus !== view.overallStatus && <span className="text-[11px] text-muted">{view.rawStatus}</span>}</div></button></div>
}
