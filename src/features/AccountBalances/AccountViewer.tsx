import { useState } from 'react'
import { ListFilter, Wrench, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { useAccountBalances } from '@/hooks/useAccountBalances'
import { AdjustAccountBalanceError, adjustAccountBalance } from '@/services/api'
import { formatCurrency } from '@/utils/currency'
import TransactionList from '@/features/CreditCardUtilization/TransactionList'
import AdjustBalanceDialog from './AdjustBalanceDialog'
import { useAccountTransactions, type AccountTransactionFilters } from './useAccountTransactions'

interface AccountViewerProps { accountName: string; privacyMode: boolean }

const PRIVACY_MASK = '••••••'

function describeFilters(filters: AccountTransactionFilters, privacyMode: boolean): string {
  const details: string[] = []
  if (filters.type) details.push(`Type: ${filters.type}`)
  if (filters.note?.trim()) details.push(`Note: “${filters.note.trim()}”`)
  if (filters.minAmount || filters.maxAmount) details.push(privacyMode ? 'Amount range active' : `Amount: ${filters.minAmount || 'any'}–${filters.maxAmount || 'any'}`)
  if (filters.range?.from) {
    const formatDate = (date: Date) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    details.push(filters.range.to ? `Dates: ${formatDate(filters.range.from)}–${formatDate(filters.range.to)}` : `Date: ${formatDate(filters.range.from)}`)
  }
  return details.join(' · ')
}

export default function AccountViewer({ accountName, privacyMode }: AccountViewerProps) {
  const [filters, setFilters] = useState<AccountTransactionFilters>({})
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustmentNotice, setAdjustmentNotice] = useState<string | null>(null)
  const { transactions, types, isLoading, isError, retry } = useAccountTransactions(accountName, filters)
  const { data: accounts } = useAccountBalances()
  const queryClient = useQueryClient()
  const account = accounts.find((item) => item.name === accountName)
  const adjustment = useMutation({
    mutationFn: (targetBalance: number) => adjustAccountBalance({ accountName, targetBalance }),
    onSuccess: async (_data, targetBalance) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.accountBalances] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.transactions] }),
      ])
      setAdjustOpen(false)
      setFilters((current) => ({ ...current, type: 'Adjustment' }))
      const delta = targetBalance - (account?.currentBalance ?? targetBalance)
      setAdjustmentNotice(privacyMode
        ? 'Adjustment transaction recorded. The balance change is hidden while Privacy Mode is on. Showing Adjustment transactions.'
        : `Adjustment transaction recorded: ${delta >= 0 ? '+' : '−'}${formatCurrency(Math.abs(delta), account?.currency ?? 'PHP')}. Showing Adjustment transactions.`)
    },
  })
  const canRetryAdjustment = adjustment.error instanceof AdjustAccountBalanceError
  const adjustmentError = adjustment.error
    ? canRetryAdjustment
      ? 'We couldn’t record this adjustment. No balance change was recorded. Check your connection and retry.'
      : 'We couldn’t confirm whether this adjustment was recorded. Check the Adjustment transactions before trying again.'
    : null
  const reduceMotion = useReducedMotion()
  const active = Object.values(filters).some((value) => Boolean(value))
  const activeCount = Object.values(filters).filter((value) => Boolean(value)).length
  const set = (patch: Partial<AccountTransactionFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const resultLabel = isLoading
    ? 'Loading transactions'
    : isError
      ? 'Transaction results could not be loaded'
      : `${transactions.length} transaction${transactions.length === 1 ? '' : 's'} ${active ? 'match the active filters' : 'in this account'}`
  const summaryBalance = account ? (privacyMode ? PRIVACY_MASK : formatCurrency(account.phpEquivalent, 'PHP')) : null
  const nativeBalance = account && account.currency !== 'PHP'
    ? (privacyMode ? PRIVACY_MASK : formatCurrency(account.currentBalance, account.currency))
    : null
  const filterDescription = describeFilters(filters, privacyMode)

  return (
    <motion.section layout transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }} className="h-full min-h-0 max-h-none overflow-hidden rounded-xl border border-border bg-surface p-5 flex flex-col gap-3 lg:h-full">
      <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={accountName}
        initial={reduceMotion ? false : { opacity: 0, y: 6, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : -3, filter: reduceMotion ? 'blur(0px)' : 'blur(1px)', transition: { duration: reduceMotion ? 0 : 0.11, ease: 'easeIn' } }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
      <header className="sticky top-0 z-10 -mx-1 shrink-0 bg-surface px-1 pb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-text truncate">{accountName}</h2>
          {account && <dl aria-label="Account summary" className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 gap-y-1 border-t border-border pt-2 text-xs leading-5 sm:flex sm:flex-wrap sm:items-end sm:gap-x-5">
            <div className="min-w-0"><dt className="text-muted">PHP equivalent</dt><dd className="font-medium tabular-nums text-text">{summaryBalance}</dd></div>
            {nativeBalance && <div className="text-right sm:text-left"><dt className="text-muted">Native · {account.currency}</dt><dd className="font-medium tabular-nums text-text">{nativeBalance}</dd></div>}
            <div className="col-span-2 flex flex-wrap gap-x-2 text-muted sm:col-span-1"><dt className="sr-only">Account details</dt><dd>{account.category} · {account.currency}</dd><span aria-hidden="true">•</span><dt className="sr-only">Visible result count</dt><dd>{resultLabel}</dd></div>
          </dl>}
          <p aria-live="polite" aria-atomic="true" className="sr-only">{resultLabel}{active ? `. Filters active: ${filterDescription}` : ''}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1 self-start">
          {account && <button type="button" aria-label="Adjust balance" title="Adjust balance" onClick={() => { adjustment.reset(); setAdjustOpen(true) }} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Wrench aria-hidden="true" className="h-4 w-4" /><span>Adjust balance</span></button>}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={active ? `Filter transactions, ${activeCount} active` : 'Filter transactions'} title="Filter transactions" className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <ListFilter aria-hidden="true" className="h-4 w-4" />
                <span>Filters</span>
                {active && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-text">{activeCount} active</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex max-h-[70vh] w-72 flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Transaction filters</span>
              {active && <button type="button" onClick={() => setFilters({})} className="flex min-h-11 items-center gap-1 rounded px-1 text-xs text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X aria-hidden="true" className="h-3 w-3" />Clear</button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">Min amount<input type="number" inputMode="decimal" value={filters.minAmount ?? ''} onChange={(e) => set({ minAmount: e.target.value })} className="min-h-11 rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" /></label>
              <label className="flex flex-col gap-1 text-xs text-muted">Max amount<input type="number" inputMode="decimal" value={filters.maxAmount ?? ''} onChange={(e) => set({ maxAmount: e.target.value })} className="min-h-11 rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" /></label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted">Date range<DateRangePicker value={filters.range} onChange={(range) => set({ range })} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Type<select value={filters.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })} className="min-h-11 rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><option value="">Any</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Note<input type="text" value={filters.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Search notes" className="min-h-11 rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" /></label>
            </PopoverContent>
          </Popover>
        </div>
      </header>
      {active && <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border pb-3 text-xs text-muted">
        <p className="min-w-0"><span className="font-medium text-text">{transactions.length} result{transactions.length === 1 ? '' : 's'}</span><span> · {filterDescription}</span></p>
        <button type="button" onClick={() => setFilters({})} className="shrink-0 rounded px-1 py-1 font-medium text-text underline decoration-muted underline-offset-2 transition-colors hover:decoration-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">Clear filters</button>
      </div>}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-gutter-stable">
        {adjustmentNotice && <p role="status" aria-live="polite" className="mb-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{adjustmentNotice}</p>}
        {isLoading && <p role="status" aria-live="polite" className="py-8 text-center text-sm text-muted">Loading transactions…</p>}
        {isError && <div role="alert" className="py-8 text-center text-sm text-muted"><p>We couldn’t load this account’s transactions. Your account summary is still available.</p>{retry && <button type="button" onClick={() => void retry()} className="mt-3 min-h-11 rounded-md border border-border px-3 text-sm font-medium text-text transition-colors hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">Retry</button>}</div>}
        {!isLoading && !isError && transactions.length === 0 && <p className="py-8 text-center text-sm text-muted">{active ? 'No transactions match these filters.' : 'This account has no transactions yet.'}</p>}
        {!isLoading && !isError && transactions.length > 0 && <TransactionList transactions={transactions} privacyMode={privacyMode} accountName={accountName} />}
      </div>
      </motion.div>
      </AnimatePresence>
      {account && <AdjustBalanceDialog open={adjustOpen} accountName={account.name} currency={account.currency} currentBalance={account.currentBalance} isSubmitting={adjustment.isPending} error={adjustmentError} canRetry={canRetryAdjustment} onOpenChange={setAdjustOpen} onSubmit={(targetBalance) => adjustment.mutate(targetBalance)} />}
    </motion.section>
  )
}
