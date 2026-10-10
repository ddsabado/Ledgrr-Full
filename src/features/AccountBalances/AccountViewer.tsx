import { useEffect, useState } from 'react'
import { ChevronLeft, ListFilter, ListFilterPlus, Wrench, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { useAccountBalances } from '@/hooks/useAccountBalances'
import { AdjustAccountBalanceError, adjustAccountBalance } from '@/services/api'
import { formatCurrency } from '@/utils/currency'
import TransactionList from '@/features/CreditCardUtilization/TransactionList'
import AdjustBalanceDialog from './AdjustBalanceDialog'
import { useAccountTransactions, type AccountTransactionFilters } from './useAccountTransactions'

interface AccountViewerProps {
  accountName: string
  privacyMode: boolean
  onClose?: () => void
}

const PRIVACY_MASK = '••••••'
const TRANSACTION_PAGE_SIZES = [10, 25, 50, 100] as const

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

export default function AccountViewer({ accountName, privacyMode, onClose }: AccountViewerProps) {
  const [filters, setFilters] = useState<AccountTransactionFilters>({})
  const [rowsPerPage, setRowsPerPage] = useState<(typeof TRANSACTION_PAGE_SIZES)[number]>(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageDirection, setPageDirection] = useState<1 | -1>(1)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustmentNotice, setAdjustmentNotice] = useState<string | null>(null)
  const { transactions, types, isLoading, isError, retry } = useAccountTransactions(accountName, filters)
  const { data: accounts } = useAccountBalances()
  const queryClient = useQueryClient()
  const account = accounts.find((item) => item.name === accountName)

  useEffect(() => {
    if (!adjustmentNotice) return
    const timeoutId = window.setTimeout(() => setAdjustmentNotice(null), 5_000)
    return () => window.clearTimeout(timeoutId)
  }, [adjustmentNotice])

  useEffect(() => {
    setCurrentPage(1)
  }, [accountName, filters, rowsPerPage])

  const adjustment = useMutation({
    mutationFn: (targetBalance: number) => adjustAccountBalance({ accountName, targetBalance }),
    onSuccess: async (_data, targetBalance) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.accountBalances] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.transactions] }),
      ])
      setAdjustOpen(false)
      const delta = targetBalance - (account?.currentBalance ?? targetBalance)
      setAdjustmentNotice(privacyMode
        ? 'Adjustment transaction recorded. The balance change is hidden while Privacy Mode is on.'
        : `Adjustment transaction recorded: ${delta >= 0 ? '+' : '−'}${formatCurrency(Math.abs(delta), account?.currency ?? 'PHP')}.`)
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
  const set = (patch: Partial<AccountTransactionFilters>) => {
    setPageDirection(-1)
    setCurrentPage(1)
    setFilters((current) => ({ ...current, ...patch }))
  }
  const resultLabel = isLoading
    ? 'Loading transactions'
    : isError
      ? 'Transaction results could not be loaded'
      : `${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`
  const summaryBalance = account ? (privacyMode ? PRIVACY_MASK : formatCurrency(account.phpEquivalent, 'PHP')) : null
  const nativeBalance = account && account.currency !== 'PHP'
    ? (privacyMode ? PRIVACY_MASK : formatCurrency(account.currentBalance, account.currency))
    : null
  const filterDescription = describeFilters(filters, privacyMode)
  const pageCount = Math.max(1, Math.ceil(transactions.length / rowsPerPage))
  const page = Math.min(currentPage, pageCount)
  const paginatedTransactions = transactions.slice((page - 1) * rowsPerPage, page * rowsPerPage)
  const pageVariants = {
    enter: (direction: number) => reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, x: direction * 20, filter: 'blur(2px)' },
    center: { opacity: 1, x: 0, filter: 'blur(0px)' },
    exit: (direction: number) => reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, x: direction * -12, filter: 'blur(1px)' },
  }
  const changePage = (nextPage: number) => {
    setPageDirection(nextPage > page ? 1 : -1)
    setCurrentPage(nextPage)
  }
  const changeRowsPerPage = (value: string) => {
    setPageDirection(-1)
    setCurrentPage(1)
    setRowsPerPage(Number(value) as typeof rowsPerPage)
  }
  const clearFilters = () => {
    setPageDirection(-1)
    setCurrentPage(1)
    setFilters({})
  }

  return (
    <motion.section layout transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }} className="h-full min-h-0 max-h-none overflow-x-hidden overflow-y-hidden rounded-xl border border-border bg-surface p-5 flex flex-col gap-3 lg:h-full">
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
          {account && <div aria-label="Account summary" className="mt-2 border-t border-border pt-2 text-xs leading-5">
            <div className="flex items-end justify-between gap-4">
              <span className="min-w-0 font-medium tabular-nums text-text">{summaryBalance}</span>
              {nativeBalance && <span className="shrink-0 text-xs tabular-nums text-muted">{nativeBalance}</span>}
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 text-muted"><span className="min-w-0 break-words">{account.category} · {account.currency}</span><span aria-hidden="true">•</span><span>{resultLabel}</span></div>
          </div>}
          <p aria-live="polite" aria-atomic="true" className="sr-only">{resultLabel}{active ? `. Filters active: ${filterDescription}` : ''}</p>
        </div>
        <div className="flex w-full shrink-0 items-center justify-between gap-2 self-start sm:w-auto sm:justify-end">
          {onClose && <button type="button" aria-label="Back to account balances" onClick={onClose} className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"><ChevronLeft aria-hidden="true" className="h-4 w-4" /><span>Balances</span></button>}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {account && <button type="button" aria-label="Adjust balance" title="Adjust balance" onClick={() => { adjustment.reset(); setAdjustOpen(true) }} className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Wrench aria-hidden="true" className="h-4 w-4" /><span>Adjust balance</span></button>}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={active ? `Filter transactions, ${activeCount} active` : 'Filter transactions'} title="Filter transactions" className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {active
                  ? <ListFilterPlus aria-hidden="true" className="h-4 w-4" />
                  : <ListFilter aria-hidden="true" className="h-4 w-4" />}
                <span>Filters</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex max-h-[70vh] w-72 flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Transaction filters</span>
              {active && <button type="button" onClick={clearFilters} className="flex min-h-11 items-center gap-1 rounded px-1 text-xs text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X aria-hidden="true" className="h-3 w-3" />Clear</button>}
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
        </div>
      </header>
      {active && <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border pb-3 text-xs text-muted">
        <p className="min-w-0"><span className="font-medium text-text">{transactions.length} result{transactions.length === 1 ? '' : 's'}</span><span> · {filterDescription}</span></p>
        <button type="button" onClick={clearFilters} className="shrink-0 rounded px-1 py-1 font-medium text-text underline decoration-muted underline-offset-2 transition-colors hover:decoration-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">Clear filters</button>
      </div>}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-gutter-stable">
        {adjustmentNotice && <div role="status" aria-live="polite" className="mb-2 grid grid-cols-[minmax(0,1fr)_1.5rem] items-start gap-2 rounded-md border border-success/30 bg-success/10 p-2 text-sm text-success"><p className="min-w-0 leading-6">{adjustmentNotice}</p><button type="button" aria-label="Dismiss adjustment notice" onClick={() => setAdjustmentNotice(null)} className="inline-flex h-6 w-6 items-center justify-center text-success/70 transition-colors hover:text-success focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X aria-hidden="true" className="h-3 w-3" /></button></div>}
        {isLoading && <p role="status" aria-live="polite" className="py-8 text-center text-sm text-muted">Loading transactions…</p>}
        {isError && <div role="alert" className="py-8 text-center text-sm text-muted"><p>We couldn’t load this account’s transactions. Your account summary is still available.</p>{retry && <button type="button" onClick={() => void retry()} className="mt-3 min-h-11 rounded-md border border-border px-3 text-sm font-medium text-text transition-colors hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">Retry</button>}</div>}
        {!isLoading && !isError && transactions.length === 0 && <p className="py-8 text-center text-sm text-muted">{active ? 'No transactions match these filters.' : 'This account has no transactions yet.'}</p>}
        {!isLoading && !isError && transactions.length > 0 && <AnimatePresence initial={false} mode="wait" custom={pageDirection}>
          <motion.div
            key={`${accountName}-${page}-${rowsPerPage}`}
            data-page={page}
            custom={pageDirection}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <TransactionList transactions={paginatedTransactions} privacyMode={privacyMode} accountName={accountName} />
          </motion.div>
        </AnimatePresence>}
      </div>
      {!isLoading && !isError && transactions.length > 0 && <div className="shrink-0 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-4">
          <Field className="w-fit items-center" orientation="horizontal">
            <FieldLabel htmlFor="select-rows-per-page">Rows per page</FieldLabel>
            <Select value={String(rowsPerPage)} onValueChange={changeRowsPerPage}>
              <SelectTrigger aria-label="Rows per page" className="w-20" id="select-rows-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  {TRANSACTION_PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Pagination aria-label="Transaction pagination" className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious text={false} disabled={page === 1} onClick={() => changePage(page - 1)} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext text={false} disabled={page === pageCount} onClick={() => changePage(page + 1)} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>}
      </motion.div>
      </AnimatePresence>
      {account && <AdjustBalanceDialog open={adjustOpen} accountName={account.name} currency={account.currency} currentBalance={account.currentBalance} isSubmitting={adjustment.isPending} error={adjustmentError} canRetry={canRetryAdjustment} onOpenChange={setAdjustOpen} onSubmit={(targetBalance) => adjustment.mutate(targetBalance)} />}
    </motion.section>
  )
}
