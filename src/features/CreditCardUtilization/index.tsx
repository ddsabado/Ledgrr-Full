import { useState } from 'react'
import { motion } from 'motion/react'

import { useAuth } from '@/context/AuthContext'
import { useCCAccounts } from '@/hooks/useCCAccounts'
import { useCCTransactions } from '@/hooks/useCCTransactions'
import { useCurrencies } from '@/hooks/useCurrencies'
import { resolvePhp } from '@/utils/resolvePhp'
import type { CCAccount } from '@/types/transactions'
import CCCard from './CCCard'

interface CreditCardUtilizationProps {
  privacyMode: boolean
}

export default function CreditCardUtilization({
  privacyMode,
}: CreditCardUtilizationProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [cycleIndex, setCycleIndex] = useState<Record<string, number>>({})
  const [cycleView, setCycleView] = useState<'statement' | 'all'>('statement')

  // Guard: selecting the already-active view is a no-op (R6.6) — prevents a
  // spurious pill transition when the current option is re-clicked.
  const handleCycleViewChange = (view: 'statement' | 'all') => {
    setCycleView((prev) => (prev === view ? prev : view))
  }

  const { session } = useAuth()
  const { data: fxMap } = useCurrencies()

  const {
    data: ccAccounts,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useCCAccounts()

  const {
    data: ccTxData,
    isLoading: txLoading,
    isError: txError,
  } = useCCTransactions(
    ccAccounts.map((a) => ({ name: a.name, statementDay: a.statementDay })),
  )

  const isLoading = accountsLoading || txLoading
  const isError = accountsError || txError

  // ─── Auth guard ───────────────────────────────────────────────────────────
  // When unauthenticated render nothing — no skeleton, no error.
  if (session === null) {
    return null
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full">
        <div className="h-3 w-32 bg-surface2 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-surface2 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p className="text-sm text-muted text-center">
          Could not load credit card data. Please try again later.
        </p>
      </div>
    )
  }

  // ─── Empty ───────────────────────────────────────────────────────────────
  if (ccAccounts.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p className="text-sm text-muted text-center">
          No credit cards found.
        </p>
      </div>
    )
  }

  // ─── Merge amountDue from ccTxData into each account ───────────────────────
  // amountDue = sum of phpValue for non-Payment txs in the current cycle
  // (cycles[0]). A "Payment" tx is one where tx.type === 'Transfer'.
  const merged: CCAccount[] = ccAccounts.map((account) => {
    const cycles = ccTxData.get(account.name)?.cycles ?? []
    const amountDue =
      cycles[0]?.transactions
        .filter((t) => t.type !== 'Transfer')
        .reduce((sum, t) => sum + resolvePhp(t, fxMap), 0) ?? 0
    return { ...account, amountDue }
  })

  // ─── Success ─────────────────────────────────────────────────────────────
  // Sort by daysUntilDue ascending, nulls last.
  const sorted = [...merged].sort((a, b) => {
    if (a.daysUntilDue === null && b.daysUntilDue === null) return 0
    if (a.daysUntilDue === null) return 1
    if (b.daysUntilDue === null) return -1
    return a.daysUntilDue - b.daysUntilDue
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeInOut' }}
      className="rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full"
    >
      {/* Heading */}
      <p className="shrink-0 text-xs font-semibold tracking-widest uppercase text-muted">
        Credit Cards
      </p>

      {/* CC cards — scrollable list; cards keep natural height (shrink-0) so
          expanding one scrolls the list rather than compressing siblings. */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pr-1 scrollbar-gutter-stable">
        {sorted.map((account) => (
          <CCCard
            key={account.name}
            account={account}
            txData={ccTxData.get(account.name)}
            privacyMode={privacyMode}
            isExpanded={expandedCard === account.name}
            onToggle={() =>
              setExpandedCard(
                expandedCard === account.name ? null : account.name,
              )
            }
            cycleView={cycleView}
            onCycleViewChange={handleCycleViewChange}
            cycleIndex={cycleIndex[account.name] ?? 0}
            onCycleIndexChange={(i) =>
              setCycleIndex((prev) => ({ ...prev, [account.name]: i }))
            }
          />
        ))}
      </div>
    </motion.div>
  )
}
