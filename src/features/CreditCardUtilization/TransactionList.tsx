import { Fragment } from 'react'
import type { RawTransaction } from '@/types/transactions'
import FxEstimatedIndicator from '@/components/FxEstimatedIndicator'
import TransactionNoteTooltip from '@/components/TransactionNoteTooltip'
import { formatCurrency } from '@/utils/currency'
import { formatCreditCardTransactionDate, getLocalCalendarDay } from '@/utils/date'
import { isUnresolvedForeignCurrency, resolvePhp } from '@/utils/resolvePhp'
import type { CurrencyData } from '@/types/accounts'

const PRIVACY_MASK = '••••••'

export interface TransactionListProps {
  transactions: RawTransaction[]
  privacyMode:  boolean
  /** FX rates are supplied by the owning card; this list never fetches data. */
  fxMap?: CurrencyData
  /** When present, transfer direction is calculated relative to this account. */
  accountName?: string
}

export default function TransactionList({ transactions, privacyMode, fxMap = { PHP: 1 }, accountName }: TransactionListProps) {
  let previousDayKey: string | undefined

  return (
    <ul className="flex flex-col">
      {transactions.map((tx) => {
        const calendarDay = getLocalCalendarDay(tx.date)
        const startsNewDay = calendarDay.key !== previousDayKey
        previousDayKey = calendarDay.key

        // The account viewer can show both ends of a transfer. Credit-card
        // callers retain their existing payment treatment when no account is supplied.
        const isTransferIn = tx.type === 'Transfer' && accountName !== undefined && tx.targetAccount === accountName
        const isTransferOut = tx.type === 'Transfer' && accountName !== undefined && tx.account === accountName && !isTransferIn
        const amountTone = isTransferIn || (accountName === undefined && tx.type === 'Transfer')
          ? 'text-success'
          : isTransferOut
            ? 'text-danger'
            : 'text-text'

        const currency = (tx.currency || 'PHP').trim() || 'PHP'
        const showNative = currency !== 'PHP'
        const isFxEstimated = isUnresolvedForeignCurrency(currency, tx.resolvedAmount)

        const phpDisplay = privacyMode
          ? PRIVACY_MASK
          : formatCurrency(resolvePhp(tx, fxMap), 'PHP')

        const nativeDisplay = privacyMode
          ? PRIVACY_MASK
          : formatCurrency(tx.amount, currency)

        return (
          <Fragment key={tx.key}>
            {startsNewDay && (
              <li
                aria-label={`Transactions for ${calendarDay.label}`}
                className="flex items-center gap-3 pb-2 pt-5 first:pt-1"
              >
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
                {calendarDay.dateTime ? (
                  <time
                    dateTime={calendarDay.dateTime}
                    className="shrink-0 font-display text-xs font-semibold uppercase tracking-widest text-muted"
                  >
                    {calendarDay.label}
                  </time>
                ) : (
                  <span className="shrink-0 font-display text-xs font-semibold uppercase tracking-widest text-muted">
                    {calendarDay.label}
                  </span>
                )}
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </li>
            )}
            <li className={`flex items-start justify-between gap-3 py-2 ${startsNewDay ? '' : 'border-t border-border'}`}>
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
                <div className="flex items-center gap-1">
                  {isFxEstimated && (
                    <FxEstimatedIndicator transaction={tx} />
                  )}
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      amountTone
                    }`}
                  >
                    {phpDisplay}
                  </span>
                </div>
                {showNative && (
                  <span className={`text-xs tabular-nums mt-0.5 ${isTransferIn ? 'text-success' : isTransferOut ? 'text-danger' : 'text-muted'}`}>
                    {nativeDisplay}
                  </span>
                )}
              </div>
            </li>
          </Fragment>
        )
      })}
    </ul>
  )
}
