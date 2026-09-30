import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { useAccountBalances } from '@/hooks/useAccountBalances'
import { useCCAccounts } from '@/hooks/useCCAccounts'
import { useDebtsReceivables } from './useDebtsReceivables'
import { computeDebtsReceivables, type DebtReceivableView, type ParticipantView } from './computeDebtsReceivables'
import SplitBillDialog from './SplitBillDialog'
import { submitDebtReceivablePayment } from '@/services/api'
import { useSubmitDebtReceivablePayment } from '@/hooks/useDebtReceivableMutations'
import { formatCurrency } from '@/utils/currency'
import type { SplittrExpenseDetail } from '../../../supabase/functions/_shared/splittrImportDetails'

interface Props { privacyMode: boolean; selectedRecord?: string | null }
function today() { return new Date() }
function sheetDate(date: Date) { return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}` }

export default function DebtsandReceivablesViewer({ privacyMode, selectedRecord }: Props) {
  const reduceMotion = useReducedMotion()
  const [newOpen, setNewOpen] = useState(false)
  const { rows, fxMap, isLoading, isError } = useDebtsReceivables()
  const views = useMemo(() => computeDebtsReceivables(rows, fxMap), [fxMap, rows])
  const selected = views.find((view) => view.key === selectedRecord) ?? views[0]
  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 }
  return <motion.section layout transition={transition} className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
    <header className="shrink-0 flex items-center justify-between gap-3">
      <p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Debts &amp; Receivables</p>
      <button type="button" onClick={() => setNewOpen(true)} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-accent/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">New</button>
    </header>
    <SplitBillDialog open={newOpen} onOpenChange={setNewOpen} />
    {isLoading && <p className="py-8 text-center text-sm text-muted">Loading debts &amp; receivables…</p>}
    {isError && <p role="alert" className="py-8 text-center text-sm text-danger">Could not load debts &amp; receivables.</p>}
    {!isLoading && !isError && !selected && <p className="py-8 text-center text-sm text-muted">No records.</p>}
    {!isLoading && !isError && selected && <RecordDetails view={selected} privacyMode={privacyMode} />}
  </motion.section>
}

function RecordDetails({ view, privacyMode }: { view: DebtReceivableView; privacyMode: boolean }) {
  const { data: debitAccounts } = useAccountBalances()
  const { data: creditAccounts } = useCCAccounts()
  const accounts = useMemo(() => [...debitAccounts, ...creditAccounts].map((account) => account.name).sort(), [creditAccounts, debitAccounts])
  const [payment, setPayment] = useState<ParticipantView | null>(null)
  const mask = (amount: number, currency = 'PHP') => privacyMode ? '••••••' : formatCurrency(amount, currency)
  const mutation = useSubmitDebtReceivablePayment()
  const actionLabel = view.direction === 'Payable' ? 'Payment done?' : 'Payment received?'
  return <>
    <header className="shrink-0 flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-display text-xl font-semibold tracking-tight text-text truncate">{view.name}</h2><p className="mt-1 text-xs text-muted">{view.dateLabel} · {view.account} · {view.direction}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${view.overallStatus === 'Settled' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>{view.overallStatus}</span></header>
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-gutter-stable space-y-4">
      <div className="rounded-lg border border-border bg-surface2 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted">Total</span><span className="text-lg font-semibold tabular-nums text-text">{mask(view.totalNative, view.currency)}</span></div></div>
      <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-muted">Participants</p>{view.participants.map((participant) => { const hideStatus = view.direction === 'Receivable' && participant.isOwner || view.direction === 'Payable' && !participant.isOwner; const displayStatus = hideStatus ? null : participant.status; const isPaid = displayStatus === 'Paid'; const canPay = view.direction === 'Payable' ? participant.isOwner : !participant.isOwner; return <div key={participant.name} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><div className="min-w-0"><p className={`truncate text-sm ${isPaid ? 'text-green-500' : 'text-text'}`}>{participant.name}{participant.isOwner ? ' (me)' : ''}{!hideStatus && isPaid && <Check aria-hidden="true" className="ml-1 inline h-3 w-3" />}</p>{!hideStatus && <p className="text-xs text-muted">{displayStatus}{participant.paidPhp > 0 && !isPaid ? ` · paid ${mask(participant.paidPhp)}` : ''}</p>}</div><div className="flex shrink-0 items-center gap-2"><span className="text-sm tabular-nums text-muted">{mask(participant.shareNative, view.currency)}</span>{canPay && !isPaid && <button type="button" onClick={() => setPayment(participant)} className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">{actionLabel}</button>}</div></div> })}</div>
      {view.splittrExpenses && <SplittrExpenseDetails expenses={view.splittrExpenses} mask={mask} />}
    </div>
    <PaymentDialog view={view} participant={payment} accounts={accounts} open={payment !== null} submitting={mutation.isPending} onClose={() => setPayment(null)} onSubmit={(input) => mutation.mutate(input, { onSuccess: () => setPayment(null) })} />
  </>
}

function SplittrExpenseDetails({ expenses, mask }: { expenses: SplittrExpenseDetail[]; mask: (amount: number, currency?: string) => string }) {
  return <section className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-muted">Imported Splittr expenses</p><div className="divide-y divide-border overflow-hidden rounded-lg border border-border">{expenses.map((expense, index) => <div key={`${expense.date}-${expense.description}-${index}`} className="space-y-1.5 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm text-text">{expense.description || 'Untitled expense'}</p><p className="text-xs text-muted">{expense.date} · Paid by {expense.paidBy}</p></div><span className="shrink-0 text-sm tabular-nums text-text">{mask(expense.amount, expense.currency)}</span></div>{expense.items?.length ? <ul className="space-y-1 text-xs text-muted">{expense.items.map((item, itemIndex) => <li key={`${item.description}-${itemIndex}`}><span className="text-text">{item.description}</span> · Split: {item.splits.map((split) => `${split.member} ${mask(split.amount, expense.currency)}`).join(' · ')}</li>)}</ul> : <p className="text-xs text-muted">Split: {expense.splits.map((split) => `${split.member} ${mask(split.amount, expense.currency)}`).join(' · ')}</p>}</div>)}</div></section>
}

function PaymentDialog({ view, participant, accounts, open, submitting, onClose, onSubmit }: { view: DebtReceivableView; participant: ParticipantView | null; accounts: string[]; open: boolean; submitting: boolean; onClose: () => void; onSubmit: (input: Parameters<typeof submitDebtReceivablePayment>[0]) => void }) {
  const [date, setDate] = useState(today)
  const [account, setAccount] = useState(view.account)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setAccount(view.account)
    setAmount(participant ? String(participant.shareNative) : '')
    setError('')
  }, [participant, view.account])
  const submit = (event: React.FormEvent) => { event.preventDefault(); const numeric = Number(amount); if (!participant || !date || !account || !Number.isFinite(numeric) || numeric <= 0) { setError('Complete the payment details'); return }; setError(''); onSubmit({ name: view.name, date: view.date, recordAccount: view.account, account, direction: view.direction, participantName: participant.name, paymentDate: sheetDate(date), amount: numeric, category: view.direction === 'Payable' ? '' : 'Receivables', currency: view.currency }) }
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>{view.direction === 'Payable' ? 'Record payment' : 'Record payment received'}</DialogTitle></DialogHeader>{participant && <form onSubmit={submit} className="space-y-4"><p className="text-sm text-muted">{view.direction === 'Payable' ? `You paid → ${view.name}` : `${participant.name} → ${view.name}`}</p><label className="grid gap-1 text-xs text-muted">Payment date<DatePicker value={date} onChange={(value) => value && setDate(value)} /></label><label className="grid gap-1 text-xs text-muted">{view.direction === 'Payable' ? 'Account paid from' : 'Account received to'}<select value={account} onChange={(event) => setAccount(event.target.value)} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="">Select account</option>{accounts.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-1 text-xs text-muted">{view.direction === 'Payable' ? 'Amount paid' : 'Amount received'}<input autoFocus type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" /></label>{error && <p role="alert" className="text-xs text-danger">{error}</p>}<DialogFooter><button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-muted hover:text-text">Cancel</button><button type="submit" disabled={submitting} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-text disabled:opacity-50">{submitting ? 'Saving…' : view.direction === 'Payable' ? 'Confirm payment' : 'Confirm receipt'}</button></DialogFooter></form>}</DialogContent></Dialog>
}
