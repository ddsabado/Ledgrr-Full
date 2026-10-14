import { ChevronLeft, LockKeyhole } from 'lucide-react'

import { formatCurrency } from '@/utils/currency'
import { formatMonth, type InstallmentItem, type MonthResult, type YearMonth } from './buildInstallmentMonths'

export interface InstallmentsDemoViewerProps {
  privacyMode: boolean
  /** A fixture-only lookup. It is deliberately supplied by the demo shell. */
  getMonthResult: (month: YearMonth) => MonthResult
  initialMonth: YearMonth
  onClose?: () => void
}

/**
 * Read-only activity presentation for the public demo.  This intentionally
 * accepts its complete data path as props, so it cannot initialize an
 * authenticated query, collection, service, or mutation.
 */
export default function InstallmentsDemoViewer({ privacyMode, getMonthResult, initialMonth, onClose }: InstallmentsDemoViewerProps) {
  const result = getMonthResult(initialMonth)
  const mask = (amount: number, currency = 'PHP') => privacyMode ? '••••••' : formatCurrency(amount, currency)

  return <section data-testid="installments-demo-viewer" className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface p-5">
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text">Installments</h2>
          <p className="mt-1 text-sm text-muted">Installments and recurring payments</p>
        </div>
        {onClose && <button type="button" aria-label="Back to installments and recurring payments" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronLeft aria-hidden="true" className="h-4 w-4" /><span>Payments</span></button>}
      </header>

      <p role="status" className="flex shrink-0 items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-muted"><LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 text-warn" />Demo mode — activity is read-only and changes are not saved.</p>

      <p className="shrink-0 text-sm text-muted">Activity for {formatMonth(initialMonth)}</p>

      <div className="flex shrink-0 items-center justify-between border-y border-border py-3"><span className="text-sm font-medium text-muted">Monthly total</span><span className="text-sm font-semibold tabular-nums text-text">{mask(result.total)}</span></div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable">
        {result.items.length === 0 ? <p className="py-8 text-center text-sm text-muted">No installments or recurring payments.</p> : <div className="divide-y divide-border">{result.items.map((item, index) => <ActivityRow key={`${item.name}-${item.account}-${index}`} item={item} mask={mask} />)}</div>}
      </div>
    </div>
  </section>
}

function ActivityRow({ item, mask }: { item: InstallmentItem; mask: (amount: number, currency?: string) => string }) {
  const type = item.isRecurring ? 'Recurring' : 'Installment'
  const terms = item.isRecurring ? item.frequency || 'Monthly' : `${item.iteration}/${item.terms} payments`
  return <article className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-text">{item.name}</p><span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-medium text-muted">{type}</span></div><p className="mt-1 truncate text-xs text-muted">{item.account} · {terms}</p></div><span className="shrink-0 text-right text-sm font-semibold tabular-nums text-text">{mask(item.amount, item.currency)}</span></article>
}
