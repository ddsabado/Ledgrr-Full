import { useEffect, useState } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../@/components/ui/dialog'

interface AdjustBalanceDialogProps {
  open: boolean
  accountName: string
  currency: string
  currentBalance: number
  isSubmitting: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (targetBalance: number) => void
}

export default function AdjustBalanceDialog({ open, accountName, currency, currentBalance, isSubmitting, error, onOpenChange, onSubmit }: AdjustBalanceDialogProps) {
  const [targetBalance, setTargetBalance] = useState('')
  const target = Number(targetBalance)
  const isValid = targetBalance.trim() !== '' && Number.isFinite(target)

  useEffect(() => {
    if (open) setTargetBalance(String(currentBalance))
  }, [open, currentBalance])

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isValid) onSubmit(target)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust balance</DialogTitle>
          <DialogDescription>Set the current balance for {accountName}. This records an Adjustment transaction.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="grid gap-1 text-xs text-muted">
            Target balance ({currency})
            <input
              autoFocus
              required
              type="number"
              inputMode="decimal"
              step="any"
              value={targetBalance}
              onChange={(event) => setTargetBalance(event.target.value)}
              className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-md px-3 py-2 text-sm text-muted hover:text-text">Cancel</button>
            <button type="submit" disabled={isSubmitting || !isValid} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-text disabled:opacity-50">
              {isSubmitting ? 'Adjusting…' : 'Adjust balance'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
