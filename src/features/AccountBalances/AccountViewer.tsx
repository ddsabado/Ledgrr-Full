import { useState } from 'react'
import { ListFilter, Wrench, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { useAccountBalances } from '@/hooks/useAccountBalances'
import { adjustAccountBalance } from '@/services/api'
import TransactionList from '@/features/CreditCardUtilization/TransactionList'
import AdjustBalanceDialog from './AdjustBalanceDialog'
import { useAccountTransactions, type AccountTransactionFilters } from './useAccountTransactions'

interface AccountViewerProps { accountName: string; privacyMode: boolean }

export default function AccountViewer({ accountName, privacyMode }: AccountViewerProps) {
  const [filters, setFilters] = useState<AccountTransactionFilters>({})
  const [adjustOpen, setAdjustOpen] = useState(false)
  const { transactions, types, isLoading, isError } = useAccountTransactions(accountName, filters)
  const { data: accounts } = useAccountBalances()
  const queryClient = useQueryClient()
  const account = accounts.find((item) => item.name === accountName)
  const adjustment = useMutation({
    mutationFn: (targetBalance: number) => adjustAccountBalance({ accountName, targetBalance }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.accountBalances] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.transactions] }),
      ])
      setAdjustOpen(false)
    },
  })
  const reduceMotion = useReducedMotion()
  const active = Object.values(filters).some((value) => Boolean(value))
  const set = (patch: Partial<AccountTransactionFilters>) => setFilters((current) => ({ ...current, ...patch }))

  return (
    <motion.section layout transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }} className="h-full rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-none lg:h-full">
      <header className="shrink-0 flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-text truncate">{accountName}</h2>
        <div className="flex items-center gap-1">
          {account && <button type="button" aria-label="Adjust balance" onClick={() => { adjustment.reset(); setAdjustOpen(true) }} className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Wrench aria-hidden="true" className="h-4 w-4" /></button>}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Filter transactions" className="relative rounded-md p-1 text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <ListFilter aria-hidden="true" className="h-4 w-4" />
                {active && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex max-h-[70vh] w-72 flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Transaction filters</span>
              {active && <button type="button" onClick={() => setFilters({})} className="flex items-center gap-1 text-xs text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X className="h-3 w-3" />Clear</button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">Min amount<input type="number" inputMode="decimal" value={filters.minAmount ?? ''} onChange={(e) => set({ minAmount: e.target.value })} className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text" /></label>
              <label className="flex flex-col gap-1 text-xs text-muted">Max amount<input type="number" inputMode="decimal" value={filters.maxAmount ?? ''} onChange={(e) => set({ maxAmount: e.target.value })} className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text" /></label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted">Date range<DateRangePicker value={filters.range} onChange={(range) => set({ range })} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Type<select value={filters.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })} className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text"><option value="">Any</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Note<input type="search" value={filters.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Search notes" className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text placeholder:text-muted" /></label>
            </PopoverContent>
          </Popover>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-gutter-stable">
        {isLoading && <p className="py-8 text-center text-sm text-muted">Loading transactions…</p>}
        {isError && <p className="py-8 text-center text-sm text-muted">Could not load transactions. Please try again later.</p>}
        {!isLoading && !isError && transactions.length === 0 && <p className="py-8 text-center text-sm text-muted">No matching transactions.</p>}
        {!isLoading && !isError && transactions.length > 0 && <TransactionList transactions={transactions} privacyMode={privacyMode} accountName={accountName} />}
      </div>
      {account && <AdjustBalanceDialog open={adjustOpen} accountName={account.name} currency={account.currency} currentBalance={account.currentBalance} isSubmitting={adjustment.isPending} error={adjustment.error instanceof Error ? adjustment.error.message : adjustment.error ? 'Could not adjust the balance.' : null} onOpenChange={setAdjustOpen} onSubmit={(targetBalance) => adjustment.mutate(targetBalance)} />}
    </motion.section>
  )
}
