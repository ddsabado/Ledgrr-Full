import type { AccountBalance } from '@/types/accounts'
import { formatCurrency } from '@/utils/currency'

const PRIVACY_MASK = '••••••'

interface AccountRowProps {
  account:     AccountBalance
  percentage:  string
  color:       string
  privacyMode: boolean
}

export default function AccountRow({ account, percentage, color, privacyMode }: AccountRowProps) {
  // PHP display (always shown)
  const phpDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.phpEquivalent, 'PHP')

  // Native currency display — only shown when account is not PHP
  const showNative = account.currency !== 'PHP'
  const nativeDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.currentBalance, account.currency)

  return (
    <div className="flex items-start justify-between py-2 gap-3">
      {/* Left: color-coded percentage (doubles as the color indicator, like the
          Transactions category list) + account name. */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-xs font-semibold tabular-nums min-w-[3rem] shrink-0"
          style={{ color }}
        >
          {privacyMode ? PRIVACY_MASK : `${percentage}%`}
        </span>
        <span className="text-sm text-text truncate">{account.name}</span>
      </div>

      {/* Right: balances */}
      <div className="flex flex-col items-end shrink-0 text-right">
        <span className="text-sm text-text font-medium tabular-nums">
          {phpDisplay}
        </span>
        {showNative && (
          <span className="text-xs text-muted tabular-nums mt-0.5">
            {nativeDisplay}
          </span>
        )}
      </div>
    </div>
  )
}
