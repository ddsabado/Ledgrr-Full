import { useAuth } from '@/context/AuthContext'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useTransactionsByPeriod } from './useTransactionsByPeriod'
import { TransactionsCard } from './TransactionsCard'

interface TransactionsProps {
  privacyMode: boolean
}

/** Authenticated data wrapper for the Transactions by Period presentation card. */
export default function Transactions({ privacyMode }: TransactionsProps) {
  const { session } = useAuth()
  const { data: fxMap } = useCurrencies()
  const { grouped, isLoading, isError } = useTransactionsByPeriod()

  if (session === null) return null

  const cardShell =
    'rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full'

  if (isLoading) {
    return <div className={cardShell}><div className="h-3 w-40 bg-surface2 rounded animate-pulse" /><div className="h-9 bg-surface2 rounded-lg animate-pulse" />{[1, 2, 3, 4].map((i) => <div key={i} className="flex justify-between items-center gap-3"><div className="h-3 w-28 bg-surface2 rounded animate-pulse" /><div className="h-3 w-16 bg-surface2 rounded animate-pulse" /></div>)}</div>
  }
  if (isError) {
    return <div className="rounded-xl bg-surface border border-border p-5"><p className="text-sm text-muted text-center">Could not load transactions. Please try again later.</p></div>
  }

  return <TransactionsCard grouped={grouped} fxMap={fxMap} privacyMode={privacyMode} />
}

export { TransactionsCard } from './TransactionsCard'
