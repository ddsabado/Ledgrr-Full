import type { RawTransaction } from '@/types/transactions'
import TransactionNoteTooltip from '@/components/TransactionNoteTooltip'
import { formatCurrency } from '@/utils/currency'
import { formatCreditCardTransactionDate } from '@/utils/date'
import { resolvePhp } from '@/utils/resolvePhp'
import { useCurrencies } from '@/hooks/useCurrencies'

const PRIVACY_MASK = '••••••'

interface TransactionListProps {
  transactions: RawTransaction[]
  privacyMode:  boolean
}

export default function TransactionList({ transactions, privacyMode }: TransactionListProps) {
  const { data: fxMap } = useCurrencies()
  return (
    <ul className="flex flex-col divide-y divide-border">
      {transactions.map((tx) => {
        // A payment is a Transfer INTO the card.
        const isPayment = tx.type === 'Transfer'

        const showNative = tx.currency !== 'PHP'

        const phpDisplay = privacyMode
          ? PRIVACY_MASK
          : formatCurrency(resolvePhp(tx, fxMap), 'PHP')

        const nativeDisplay = privacyMode
          ? PRIVACY_MASK
          : formatCurrency(tx.amount, tx.currency)

        return (
          <li key={tx.key} className="flex items-start justify-between py-2 gap-3">
            {/* Left: compact date/time + optional note */}
            <div className="min-w-0">
              <p className="text-xs text-muted truncate">
                {formatCreditCardTransactionDate(tx.date)}
              </p>
              {tx.note && (
                <TransactionNoteTooltip note={tx.note} />
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
