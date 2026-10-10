import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../@/components/ui/dialog'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { queryClient } from '@/lib/queryClient'
import { formatCurrency } from '@/utils/currency'
import { resolveTransactionAmount } from '@/services/api'
import type { RawTransaction } from '@/types/transactions'

const MESSAGE = 'FX-estimated — pending resolution'

interface TooltipPosition {
  left: number
  top: number
}

type ResolvableTransaction = Pick<RawTransaction, 'key' | 'amount' | 'currency' | 'note'>

interface FxEstimatedIndicatorProps {
  /** Supply the ledger row when this estimate can be resolved in Transactions. */
  transaction?: ResolvableTransaction
}

/** Explains an estimate and lets a ledger-backed one be resolved in place. */
export default function FxEstimatedIndicator({ transaction }: FxEstimatedIndicatorProps) {
  const tooltipId = useId()
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resolvedAmount, setResolvedAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const showTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setPosition({ left: rect.left + rect.width / 2, top: rect.top - 6 })
  }

  const openDialog = (event: React.SyntheticEvent) => {
    if (!transaction) return
    event.preventDefault()
    event.stopPropagation()
    setDialogOpen(true)
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!transaction) return
    const amount = Number(resolvedAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    setIsSaving(true)
    setSaveError(false)
    void resolveTransactionAmount(transaction.key, amount)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.transactions] })
        setDialogOpen(false)
        setResolvedAmount('')
      })
      .catch(() => setSaveError(true))
      .finally(() => setIsSaving(false))
  }

  return (
    <>
      <span
        tabIndex={0}
        role={transaction ? 'button' : undefined}
        aria-haspopup={transaction ? 'dialog' : undefined}
        aria-expanded={transaction ? dialogOpen : undefined}
        className="cursor-pointer text-amber-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label="FX-estimated total, pending resolution"
        aria-describedby={position ? tooltipId : undefined}
        onClick={transaction ? openDialog : undefined}
        onKeyDown={(event) => {
          if (transaction && (event.key === 'Enter' || event.key === ' ')) openDialog(event)
        }}
        onPointerEnter={(event) => showTooltip(event.currentTarget)}
        onPointerLeave={() => setPosition(null)}
        onFocus={(event) => showTooltip(event.currentTarget)}
        onBlur={() => setPosition(null)}
      >
        <AlertTriangle aria-hidden="true" className="h-3 w-3" />
      </span>
      {position && createPortal(
        <span id={tooltipId} role="tooltip" className="pointer-events-none fixed z-[100] max-w-xs -translate-x-1/2 -translate-y-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text shadow-lg" style={{ left: position.left, top: position.top }}>
          {MESSAGE}
        </span>,
        document.body,
      )}
      {transaction && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Resolve FX amount</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted">Enter the final PHP amount for {formatCurrency(transaction.amount, transaction.currency)}{transaction.note ? ` · ${transaction.note}` : ''}.</p>
              <label className="grid gap-1 text-xs text-muted">
                Resolved amount (PHP)
                <input autoFocus required min="0.01" step="0.01" inputMode="decimal" type="number" value={resolvedAmount} onChange={(event) => setResolvedAmount(event.target.value)} className="rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
              </label>
              {saveError && <p role="alert" className="text-xs text-danger">Could not resolve this transaction. Please try again.</p>}
              <DialogFooter>
                <button type="button" onClick={() => setDialogOpen(false)} className="rounded-md px-3 py-2 text-sm text-muted hover:text-text">Cancel</button>
                <button type="submit" disabled={isSaving || Number(resolvedAmount) <= 0} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-text disabled:opacity-50">{isSaving ? 'Saving…' : 'Save resolved amount'}</button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
