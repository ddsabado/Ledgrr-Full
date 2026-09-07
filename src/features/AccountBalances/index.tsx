import { motion } from 'motion/react'

import { useAccountBalances } from '@/hooks/useAccountBalances'
import { formatCurrency } from '@/utils/currency'
import AccountRow from './AccountRow'
import BalanceChart, { CHART_COLORS } from './BalanceChart'

const PRIVACY_MASK = '••••••'

interface AccountBalancesProps {
  privacyMode: boolean
}

export default function AccountBalances({ privacyMode }: AccountBalancesProps) {
  const { data, isLoading, isError } = useAccountBalances()

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full">
        <div className="h-3 w-32 bg-surface2 rounded animate-pulse" />
        <div className="h-48 bg-surface2 rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center gap-3">
            <div className="h-3 w-24 bg-surface2 rounded animate-pulse" />
            <div className="h-3 w-16 bg-surface2 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p className="text-sm text-muted text-center">
          Could not load account balances. Please try again later.
        </p>
      </div>
    )
  }

  // ─── Empty ───────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p className="text-sm text-muted text-center">No accounts found.</p>
      </div>
    )
  }

  // ─── Success ─────────────────────────────────────────────────────────────
  const total = data.reduce((sum, a) => sum + a.phpEquivalent, 0)
  const totalDisplay = privacyMode ? PRIVACY_MASK : formatCurrency(total, 'PHP')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeInOut' }}
      className="rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full"
    >
      {/* Heading */}
      <p className="shrink-0 text-xs font-semibold tracking-widest uppercase text-muted">
        Account Balances
      </p>

      {/* Donut chart */}
      <div className="shrink-0">
        <BalanceChart accounts={data} privacyMode={privacyMode} />
      </div>

      {/* Total row */}
      <div className="shrink-0 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-medium text-text">Total</span>
        <span className="text-sm font-semibold text-text tabular-nums">
          {totalDisplay}
        </span>
      </div>

      {/* Account rows — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col divide-y divide-border scrollbar-gutter-stable">
        {data.map((account, i) => {
          const pct = total > 0
            ? ((account.phpEquivalent / total) * 100).toFixed(1)
            : '0.0'
          return (
            <AccountRow
              key={account.name}
              account={account}
              percentage={pct}
              color={CHART_COLORS[i % CHART_COLORS.length]}
              privacyMode={privacyMode}
            />
          )
        })}
      </div>
    </motion.div>
  )
}
