import type { RawTransaction } from '@/types/transactions'
import { formatCurrency } from '@/utils/currency'
import { formatTransactionDate } from '@/utils/date'

const PRIVACY_MASK = '••••••'

interface TransactionListProps {
  transactions: RawTransaction[]
  privacyMode:  boolean
}

export default function TransactionList({ transactions, privacyMode }: TransactionListProps) {
  return (
    <ul className="flex flex-col divide-y divide-border">
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
              <p className="text-sm text-text truncate">
                <span className="text-muted">{formatTransactionDate(tx.date)}</span>
                {label && (
                  <>
                    <span className="text-muted"> · </span>
                    {label}
                  </>
                )}
              </p>
              {tx.note && (
                <p className="text-xs text-muted truncate mt-0.5">{tx.note}</p>
              )}
            </div>

            {/* Right: PHP amount + optional native amount */}
            <div className="flex flex-col items-end shrink-0 text-right">
              <span
                className={`text-sm font-medium tabular-nums ${
                  isPayment ? 'text-success' : 'text-text'
                }`}
              >
                {phpDisplay}
              </span>
              {showNative && (
                <span className="text-xs text-muted tabular-nums mt-0.5">
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
