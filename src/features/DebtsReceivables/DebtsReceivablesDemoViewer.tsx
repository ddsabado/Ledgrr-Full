import { ChevronLeft, Check, LockKeyhole } from 'lucide-react'

import { formatCurrency } from '@/utils/currency'

export interface DemoDebtParticipant {
  name: string
  isOwner: boolean
  shareNative: number
  paidPhp: number
  status: 'Paid' | 'Partial' | 'Pending'
}

export interface DemoDebtReceivableView {
  key: string
  name: string
  account: string
  dateLabel: string
  direction: 'Receivable' | 'Payable'
  currency: string
  totalNative: number
  overallStatus: 'Settled' | 'Pending'
  participants: DemoDebtParticipant[]
}

export interface DebtsReceivablesDemoViewerProps {
  privacyMode: boolean
  views: readonly DemoDebtReceivableView[]
  selectedRecord?: string | null
  onSelectRecord?: (key: string) => void
  onClose?: () => void
}

/** Read-only detail presentation for normalized fixture views. */
export default function DebtsReceivablesDemoViewer({ privacyMode, views, selectedRecord, onSelectRecord, onClose }: DebtsReceivablesDemoViewerProps) {
  const selected = views.find((view) => view.key === selectedRecord) ?? views[0]
  const mask = (amount: number, currency = 'PHP') => privacyMode ? '••••••' : formatCurrency(amount, currency)

  return <section data-testid="debts-demo-viewer" className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface p-5">
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex shrink-0 items-center justify-between gap-3"><p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Debts &amp; Receivables</p>{onClose && <button type="button" aria-label="Back to debts and receivables" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ChevronLeft aria-hidden="true" className="h-4 w-4" /><span>Debts</span></button>}</header>
      <p role="status" className="flex shrink-0 items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-muted"><LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 text-warn" />Demo mode — payments and imports are unavailable.</p>
      {views.length > 1 && <nav aria-label="Debt records" className="flex shrink-0 gap-2 overflow-x-auto">{views.map((view) => <button key={view.key} type="button" onClick={() => onSelectRecord?.(view.key)} aria-pressed={selected?.key === view.key} className={`rounded-md px-2 py-1 text-xs ${selected?.key === view.key ? 'bg-accent/15 text-text' : 'text-muted hover:bg-surface2'}`}>{view.name}</button>)}</nav>}
      {!selected ? <p className="py-8 text-center text-sm text-muted">No records.</p> : <RecordDetails view={selected} mask={mask} />}
    </div>
  </section>
}

function RecordDetails({ view, mask }: { view: DemoDebtReceivableView; mask: (amount: number, currency?: string) => string }) {
  const settled = view.overallStatus === 'Settled'
  return <><header className="shrink-0 flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-display text-xl font-semibold tracking-tight text-text">{view.name}</h2><p className="mt-1 text-xs text-muted">{view.dateLabel} · {view.account} · {view.direction}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${settled ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>{view.overallStatus}</span></header><div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-gutter-stable"><div className="rounded-lg border border-border bg-surface2 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted">Total</span><span className="text-lg font-semibold tabular-nums text-text">{mask(view.totalNative, view.currency)}</span></div></div><section className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-muted">Participants</p>{view.participants.map((participant) => <div key={participant.name} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><div className="min-w-0"><p className={`truncate text-sm ${participant.status === 'Paid' ? 'text-green-500' : 'text-text'}`}>{participant.name}{participant.isOwner ? ' (me)' : ''}{participant.status === 'Paid' && <Check aria-hidden="true" className="ml-1 inline h-3 w-3" />}</p><p className="text-xs text-muted">{participant.status}{participant.paidPhp > 0 && participant.status !== 'Paid' ? ` · paid ${mask(participant.paidPhp)}` : ''}</p></div><div className="flex shrink-0 items-center gap-2"><span className="text-sm tabular-nums text-muted">{mask(participant.shareNative, view.currency)}</span>{participant.status !== 'Paid' && <button type="button" disabled title="Demo mode — payments are unavailable" className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted opacity-60">{view.direction === 'Payable' ? 'Record payment' : 'Record receipt'}</button>}</div></div>)}</section></div></>
}
