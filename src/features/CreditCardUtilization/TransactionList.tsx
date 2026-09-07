import type { RawTransaction } from '@/types/transactions'
import { formatCurrency } from '@/utils/currency'

const PRIVACY_MASK = '••••••'

interface TransactionListProps {
  transactions: RawTransaction[]
  privacyMode:  boolean
}

export default function TransactionList({ transactions, privacyMode }: TransactionListProps) {
  return (
    <ul className="flex flex-col divide-y divide-gray-800">
      {transactions.map((tx) => {
        // A payment is a Transfer INTO the card.
        const isPayment = tx.type === 'Transfer'

        // Primary label line: date · category[· subcategory], or "Payment".
        const label = isPayment
          ? 'Payment'
          : [tx.category, tx.subcategory].filter(Boolean).join(' · ')

        const showNative = tx.currency !== 'PHP'

        const phpDisplay = privacyMode
          ? PRIVACY_MASK
          : formatCurrency(tx.phpValue, 'PHP')

        const nativeDisplay = privacyMode
          ? PRIVACY_MASK
          : formatCurrency(tx.amount, tx.currency)

        return (
          <li key={tx.key} className="flex items-start justify-between py-2 gap-3">
            {/* Left: date/category label + optional note */}
            <div className="min-w-0">
              <p className="text-sm text-gray-300 truncate">
                <span className="text-gray-500">{tx.date}</span>
                {label && (
                  <>
                    <span className="text-gray-600"> · </span>
                    {label}
                  </>
                )}
              </p>
              {tx.note && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{tx.note}</p>
              )}
            </div>

            {/* Right: PHP amount + optional native amount */}
            <div className="flex flex-col items-end shrink-0 text-right">
              <span
                className={`text-sm font-medium tabular-nums ${
                  isPayment ? 'text-green-400' : 'text-gray-300'
                }`}
              >
                {phpDisplay}
              </span>
              {showNative && (
                <span className="text-xs text-gray-500 tabular-nums mt-0.5">
                  {nativeDisplay}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
