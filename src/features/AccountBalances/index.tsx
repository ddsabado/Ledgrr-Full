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
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 flex flex-col gap-4">
        <div className="h-3 w-32 bg-gray-800 rounded animate-pulse" />
        <div className="h-48 bg-gray-800 rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center gap-3">
            <div className="h-3 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-16 bg-gray-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <p className="text-sm text-gray-500 text-center">
          Could not load account balances. Please try again later.
        </p>
      </div>
    )
  }

  // ─── Empty ───────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <p className="text-sm text-gray-500 text-center">No accounts found.</p>
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
      className="rounded-xl bg-gray-900 border border-gray-800 p-5 flex flex-col gap-4 h-full"
    >
      {/* Heading */}
      <p className="shrink-0 text-xs font-semibold tracking-widest uppercase text-gray-500">
        Account Balances
      </p>

      {/* Donut chart */}
      <div className="shrink-0">
        <BalanceChart accounts={data} />
      </div>

      {/* Total row */}
      <div className="shrink-0 flex items-center justify-between border-t border-gray-800 pt-3">
        <span className="text-sm font-medium text-gray-300">Total</span>
        <span className="text-sm font-semibold text-white tabular-nums">
          {totalDisplay}
        </span>
      </div>

      {/* Account rows — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col divide-y divide-gray-800 scrollbar-gutter-stable">
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
