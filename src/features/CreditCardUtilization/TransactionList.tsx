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
  /** When present, transfer direction is calculated relative to this account. */
  accountName?: string
}

export default function TransactionList({ transactions, privacyMode, accountName }: TransactionListProps) {
  const { data: fxMap } = useCurrencies()
  return (
    <ul className="flex flex-col divide-y divide-border">
      {transactions.map((tx) => {
        // The account viewer can show both ends of a transfer. Credit-card
        // callers retain their existing payment treatment when no account is supplied.
        const isTransferIn = tx.type === 'Transfer' && accountName !== undefined && tx.targetAccount === accountName
        const isTransferOut = tx.type === 'Transfer' && accountName !== undefined && tx.account === accountName && !isTransferIn
        const amountTone = isTransferIn || (accountName === undefined && tx.type === 'Transfer')
          ? 'text-success'
          : isTransferOut
            ? 'text-danger'
            : 'text-text'

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
                  amountTone
                }`}
              >
                {phpDisplay}
              </span>
              {showNative && (
                <span className={`text-xs tabular-nums mt-0.5 ${isTransferIn ? 'text-success' : isTransferOut ? 'text-danger' : 'text-muted'}`}>
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
