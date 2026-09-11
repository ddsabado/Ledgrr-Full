/**
 * Debts & Receivables dashboard panel and Split Bill entry point.
 *
 * Lists every D&R record in both directions (Receivable + Payable), sorted
 * chronologically by date (records with no parseable date sort last, keeping
 * their relative sheet order). Each record shows the transaction name,
 * "Mmm dd" date, account, a PHP-resolved total (native secondary for foreign
 * currency), and an overall Settled/Pending badge. Participants are hidden
 * until the record is expanded. All amounts honor privacyMode. Derivation
 * lives entirely in computeDebtsReceivables; this component only renders the
 * view models.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, AlertTriangle, ChevronDown, PanelLeftOpen, PanelTopOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { formatCurrency } from '@/utils/currency'
import {
  computeDebtsReceivables,
  type Direction,
  type DebtReceivableView,
  type ParticipantView,
} from './computeDebtsReceivables'
import { useDebtsReceivables } from './useDebtsReceivables'
import DebtsReceivablesFilter, { type DRFilters } from './DebtsReceivablesFilter'

const PRIVACY_MASK = '••••••'

interface DebtsReceivablesProps {
  privacyMode: boolean
  viewerOpen?: boolean
  onToggleViewer?: () => void
  selectedRecord?: string | null
  onSelectRecord?: (key: string) => void
}

export default function DebtsReceivables({ privacyMode, viewerOpen = false, onToggleViewer = () => {}, selectedRecord = null, onSelectRecord = () => {} }: DebtsReceivablesProps) {
  const { rows, fxMap, isLoading, isError } = useDebtsReceivables()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filters, setFilters] = useState<DRFilters>({})

  const views = useMemo(() => {
    const computed = computeDebtsReceivables(rows, fxMap)
    // Newest → oldest. Undated records sort last while keeping their original
    // relative order (stable sort via original index tiebreak).
    return computed
      .map((view, index) => ({ view, index }))
      .sort((a, b) => {
        const ta = a.view.sortTs
        const tb = b.view.sortTs
        if (ta === null && tb === null) return a.index - b.index
        if (ta === null) return 1
        if (tb === null) return -1
        return tb - ta || a.index - b.index
      })
      .map(({ view }) => view)
  }, [rows, fxMap])

  // Distinct accounts present (for the account filter options).
  const accountOptions = useMemo(
    () => Array.from(new Set(views.map((v) => v.account).filter((a) => a !== ''))).sort(),
    [views],
  )

  // Apply active filters with AND semantics. Date range compares the parsed
  // sortTs; undated records are excluded while a date filter is active.
  const filteredViews = useMemo(() => {
    const name = filters.name?.trim().toLowerCase()
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime()
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
    const fromTs = filters.range?.from ? startOfDay(filters.range.from) : null
    // No explicit `to` → treat as a single-day range on `from`.
    const toTs = filters.range?.to
      ? endOfDay(filters.range.to)
      : (filters.range?.from ? endOfDay(filters.range.from) : null)
    return views.filter((v) => {
      if (name && !v.name.toLowerCase().includes(name)) return false
      if (filters.status && v.overallStatus !== filters.status && v.rawStatus !== filters.status) return false
      if (filters.account && v.account !== filters.account) return false
      if (fromTs != null) {
        if (v.sortTs == null) return false
        if (v.sortTs < fromTs) return false
        if (toTs != null && v.sortTs > toTs) return false
      }
      return true
    })
  }, [views, filters])

  // Keep a valid selection when filters/data change, and choose the first
  // visible record as soon as the viewer opens.
  const activeRecord = filteredViews.some((view) => view.key === selectedRecord)
    ? selectedRecord
    : (filteredViews[0]?.key ?? null)
  useEffect(() => {
    if (viewerOpen && activeRecord && activeRecord !== selectedRecord) onSelectRecord(activeRecord)
  }, [activeRecord, onSelectRecord, selectedRecord, viewerOpen])
  useEffect(() => {
    if (viewerOpen) setExpanded(null)
  }, [viewerOpen])


  const mask = (amount: number, currency = 'PHP') =>
    privacyMode ? PRIVACY_MASK : formatCurrency(amount, currency)

  const cardShell =
    `rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden lg:max-h-none lg:h-full ${viewerOpen ? 'h-full max-h-none' : 'max-h-[calc(100vh-8rem)]'}`

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cardShell}>
        <div className="h-3 w-32 bg-surface2 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-40 bg-surface2 rounded animate-pulse" />
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
          Debts &amp; Receivables
        </p>
        <p className="text-sm text-danger text-center" role="alert">
          Failed to load debts &amp; receivables data.
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
      {/* Heading + filter */}
      <div className="shrink-0 flex items-center justify-between gap-2">
        <p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">
          Debts &amp; Receivables
        </p>
        <div className="flex items-center gap-2">
          <DebtsReceivablesFilter
            filters={filters}
            onChange={setFilters}
            accounts={accountOptions}
          />
          <motion.button type="button" aria-label={viewerOpen ? 'Close debts and receivables viewer' : 'Open debts and receivables viewer'} onClick={onToggleViewer} animate={{ rotate: viewerOpen ? 180 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><PanelTopOpen aria-hidden="true" className="h-4 w-4 lg:hidden" /><PanelLeftOpen aria-hidden="true" className="hidden h-4 w-4 lg:block" /></motion.button>
        </div>
      </div>

      {views.length === 0 ? (
        <p className="flex-1 py-6 px-2 text-sm text-center text-muted">
          No records.
        </p>
      ) : filteredViews.length === 0 ? (
        <p className="flex-1 py-6 px-2 text-sm text-center text-muted">
          No matching records.
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-gutter-stable">
          <div
            data-testid="debts-receivables-list"
            className="flex flex-col gap-4"
          >
            {filteredViews.map((view) => (
              <RecordView
                key={view.key}
                view={view}
                mask={mask}
                isExpanded={!viewerOpen && expanded === view.key}
                selected={viewerOpen && activeRecord === view.key}
                viewerOpen={viewerOpen}
                onToggle={() => viewerOpen
                  ? onSelectRecord(view.key)
                  : setExpanded((prev) => (prev === view.key ? null : view.key))}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

interface RecordViewProps {
  view:       DebtReceivableView
  mask:       (amount: number, currency?: string) => string
  isExpanded: boolean
  selected: boolean
  viewerOpen: boolean
  onToggle:   () => void
}

function RecordView({ view, mask, isExpanded, selected, viewerOpen, onToggle }: RecordViewProps) {
  const {
    name, account, dateLabel, direction, currency,
    totalPhp, totalNative, totalEstimated, participants, overallStatus, rawStatus,
  } = view

  const meta = [dateLabel, account].filter((s) => s !== '').join(' · ')
  const isSettled = overallStatus === 'Settled'
  const isForeign = currency !== 'PHP'

  return (
    <div data-testid="dr-record" className={`flex flex-col gap-2 pb-4 border-b border-border last:border-b-0 last:pb-0 ${selected ? 'rounded-lg ring-1 ring-accent bg-accent/10' : ''}`}>
      {/* Record header — click to expand/collapse participants */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={viewerOpen ? undefined : isExpanded}
        aria-pressed={selected || undefined}
        className="w-full text-left flex flex-col gap-2 rounded-lg p-1 -m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset transition-colors hover:bg-surface2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-1.5 min-w-0">
            {!viewerOpen && <ChevronDown aria-hidden="true" className={`shrink-0 w-3.5 h-3.5 mt-0.5 text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />}
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">{name}</p>
              {meta !== '' && (
                <p className="text-xs text-muted truncate mt-0.5">{meta}</p>
              )}
              <p className="text-[11px] uppercase tracking-widest text-muted mt-0.5">{direction}</p>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 text-right">
            <div className="flex items-center gap-1">
              {totalEstimated && (
                <span
                  className="text-amber-500"
                  title="FX-estimated — pending resolution"
                  aria-label="FX-estimated total, pending resolution"
                >
                  <AlertTriangle aria-hidden="true" className="w-3 h-3" />
                </span>
              )}
              <span className="text-sm font-medium tabular-nums text-text">
                {mask(totalPhp, 'PHP')}
              </span>
            </div>
            {isForeign && (
              <span className="text-xs text-muted tabular-nums mt-0.5">
                {mask(totalNative, currency)}
              </span>
            )}
          </div>
        </div>

        {/* Overall status badge + raw status */}
        <div className="flex items-center gap-2 pl-5">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              isSettled ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'
            }`}
          >
            {isSettled && <Check aria-hidden="true" className="w-3 h-3" />}
            {overallStatus}
          </span>
          {rawStatus !== '' && rawStatus !== overallStatus && (
            <span className="text-[11px] text-muted">{rawStatus}</span>
          )}
        </div>
      </button>

      {/* Participant rows — revealed only when expanded */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex flex-col gap-1.5 pl-5 pt-1">
              {participants.map((p, i) => (
                <ParticipantRow key={`${p.name}#${i}`} p={p} direction={direction} currency={currency} mask={mask} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ParticipantRowProps {
  p:        ParticipantView
  direction: Direction
  currency: string
  mask:     (amount: number, currency?: string) => string
}

function ParticipantRow({ p, direction, currency, mask }: ParticipantRowProps) {
  const { name, isOwner, sharePhp, shareNative, shareEstimated, paidPhp, status, hasUnresolvedPayment } = p
  const isForeign = currency !== 'PHP'
  const hideStatus = direction === 'Receivable' && isOwner || direction === 'Payable' && !isOwner
  const displayStatus = hideStatus ? null : status

  const statusClass =
    hideStatus ? 'text-muted'
    : displayStatus === 'Paid' ? 'text-green-500'
    : displayStatus === 'Partial' ? 'text-amber-500'
    : 'text-muted'

  return (
    <div data-testid="dr-participant" className="flex items-start justify-between gap-3 text-xs">
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-text truncate">
          {name}{isOwner ? ' (me)' : ''}
        </span>
        {hasUnresolvedPayment && (
          <span
            className="text-amber-500 shrink-0"
            title="Payment currency has no available FX rate"
            aria-label="Unresolved payment — missing FX rate"
          >
            <AlertTriangle aria-hidden="true" className="w-3 h-3" />
          </span>
        )}
      </div>
      <div className="flex flex-col items-end shrink-0 text-right">
        <div className="flex items-center gap-1">
          {shareEstimated && (
            <span
              className="text-amber-500"
              title="FX-estimated — pending resolution"
              aria-label="FX-estimated share, pending resolution"
            >
              <AlertTriangle aria-hidden="true" className="w-3 h-3" />
            </span>
          )}
          <span className={`tabular-nums ${statusClass}`}>
            {!hideStatus && displayStatus === 'Paid' && (
              <Check aria-hidden="true" className="inline w-3 h-3 mr-0.5 align-[-1px]" />
            )}
            {mask(sharePhp, 'PHP')}
          </span>
        </div>
        {isForeign && (
          <span className="text-muted tabular-nums mt-0.5">
            {mask(shareNative, currency)}
          </span>
        )}
        {displayStatus === 'Partial' && (
          <span className="text-amber-500 tabular-nums mt-0.5">
            ({mask(paidPhp, 'PHP')} of {mask(sharePhp, 'PHP')})
          </span>
        )}
      </div>
    </div>
  )
}
