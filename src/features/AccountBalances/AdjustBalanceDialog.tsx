import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../@/components/ui/dialog'
import { formatCurrency } from '@/utils/currency'

interface AdjustBalanceDialogProps {
  open: boolean
  accountName: string
  currency: string
  currentBalance: number
  isSubmitting: boolean
  error: string | null
  canRetry: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (targetBalance: number) => void
}

export default function AdjustBalanceDialog({ open, accountName, currency, currentBalance, isSubmitting, error, canRetry, onOpenChange, onSubmit }: AdjustBalanceDialogProps) {
  const [targetBalance, setTargetBalance] = useState('')
  const [hasTriedToSubmit, setHasTriedToSubmit] = useState(false)
  const target = Number(targetBalance)
  const inputIsEmpty = targetBalance.trim() === ''
  const isFiniteTarget = !inputIsEmpty && Number.isFinite(target)
  const isUnchanged = isFiniteTarget && target === currentBalance
  const isValid = isFiniteTarget && !isUnchanged
  const validationMessage = inputIsEmpty
    ? 'Enter a new target balance.'
    : !isFiniteTarget
      ? 'Invalid input.'
      : isUnchanged
        ? 'Enter a balance different from the current balance.'
        : null
  const showValidation = hasTriedToSubmit && validationMessage
  const delta = target - currentBalance
  const deltaLabel = `${delta > 0 ? '+' : '−'}${formatCurrency(Math.abs(delta), currency)} ${currency}`
  const inputErrorId = 'adjust-balance-target-error'

  useEffect(() => {
    if (open) {
      setTargetBalance('')
      setHasTriedToSubmit(false)
    }
  }, [open])

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setHasTriedToSubmit(true)
    if (isValid) onSubmit(target)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
        <DialogHeader>
          <DialogTitle>Adjust balance</DialogTitle>
          <DialogDescription className="max-w-[42ch] leading-6">Set the current balance for {accountName}.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="space-y-5">
          <label className="grid gap-1.5 text-sm font-medium leading-5 text-muted">
            Target balance ({currency})
            <input
              autoFocus
              aria-describedby={showValidation ? inputErrorId : undefined}
              aria-invalid={Boolean(showValidation)}
              type="text"
              inputMode="decimal"
              maxLength={20}
              value={targetBalance}
              onChange={(event) => {
                setTargetBalance(event.target.value)
                setHasTriedToSubmit(true)
              }}
              className="w-full min-w-0 overflow-hidden rounded-md border border-border bg-surface2 px-3 py-2 text-right text-sm leading-5 tabular-nums text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          {showValidation && <p id={inputErrorId} role="alert" className="text-sm leading-5 text-danger">{validationMessage}</p>}
          {isValid && (
            <section aria-label="Adjustment preview" className="rounded-md border border-border bg-surface2 p-3">
              <p className="font-display text-xs font-semibold tracking-wide text-muted">Adjustment preview · {currency}</p>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm leading-5 tabular-nums">
                <dt className="text-muted">Current balance</dt><dd className="min-w-0 break-all text-right text-text">{formatCurrency(currentBalance, currency)}</dd>
                <dt className="text-muted">New target balance</dt><dd className="min-w-0 break-all text-right text-text">{formatCurrency(target, currency)}</dd>
                <dt className="font-medium text-text">Adjustment delta</dt><dd className={`min-w-0 break-all text-right font-semibold ${delta > 0 ? 'text-success' : 'text-danger'}`}>{deltaLabel}</dd>
              </dl>
            </section>
          )}
          {error && <p role="alert" className="text-sm leading-5 text-danger">{error}</p>}
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-text">Cancel</button>
            <button type="submit" disabled={isSubmitting} aria-label={isSubmitting ? 'Adjusting balance' : undefined} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-text disabled:opacity-50">
              {isSubmitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : error && canRetry ? 'Retry adjustment' : 'Adjust balance'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
