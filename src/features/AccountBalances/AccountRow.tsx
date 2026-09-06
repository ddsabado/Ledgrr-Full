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
      {/* Left: swatch + name */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="text-sm text-gray-300 truncate">{account.name}</span>
      </div>

      {/* Right: percentage + balances */}
      <div className="flex items-center gap-3 shrink-0 text-right">
        <span className="text-xs text-gray-600 font-mono w-10 text-right">
          {percentage}%
        </span>
        <div className="flex flex-col items-end">
          <span className="text-sm text-white font-medium tabular-nums">
            {phpDisplay}
          </span>
          {showNative && (
            <span className="text-xs text-gray-500 tabular-nums mt-0.5">
              {nativeDisplay}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
