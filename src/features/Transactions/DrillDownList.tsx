import { ChevronRight } from 'lucide-react'
import FxEstimatedIndicator from '@/components/FxEstimatedIndicator'

import type { RawTransaction } from '@/types/transactions'
import { formatCreditCardTransactionDate } from '@/utils/date'
import TransactionNoteTooltip from '@/components/TransactionNoteTooltip'
import { type CategoryData, signedAmount } from './groupTransactions'
import { useCurrencies } from '@/hooks/useCurrencies'
import { isUnresolvedForeignCurrency } from '@/utils/resolvePhp'

type MaskFn = (amount: number) => string

// ─── Categories ──────────────────────────────────────────────────────────────

interface CategoriesListProps {
  categories:      Array<[string, CategoryData]>
  total:           number
  mask:            MaskFn
  onCategoryClick: (category: string) => void
  /** Maps category name → hex color (aligned with the donut slices). */
  colorOf:         (category: string) => string
}

export function CategoriesList({
  categories,
  total,
  mask,
  onCategoryClick,
  colorOf,
}: CategoriesListProps) {
  if (categories.length === 0) {
    return (
      <p className="py-6 px-2 text-sm text-center text-muted">
        No transactions for this period.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {categories.map(([name, cat]) => {
        const pct = total > 0 ? ((cat.total / total) * 100).toFixed(1) : '0.0'
        return (
          <li key={name}>
            <button
              type="button"
              onClick={() => onCategoryClick(name)}
              className="w-full flex items-center gap-2 py-2.5 px-1 text-left rounded-md hover:bg-surface2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            >
              <span
                className="text-xs font-semibold tabular-nums min-w-[3rem]"
                style={{ color: colorOf(name) }}
              >
                {pct}%
              </span>
              <span className="flex-1 flex items-center gap-1.5 text-sm text-text truncate">
                {name}
                <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-muted shrink-0" />
              </span>
              <span className="text-sm font-medium tabular-nums text-text">
                {mask(cat.total)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Subcategories ─────────────────────────────────────────────────────────

interface SubcategoriesListProps {
  category:           string
  catData:            CategoryData
  mask:               MaskFn
  onSubcategoryClick: (subcategory: string) => void
  /** The parent category's color — all subcategory percentages inherit it. */
  color:              string
}

/** Sentinel label for transactions posted directly to a category. */
export const directLabel = (category: string) => `${category} (direct)`

export function SubcategoriesList({
  category,
  catData,
  mask,
  onSubcategoryClick,
  color,
}: SubcategoriesListProps) {
  const subcats: Array<[string, { total: number; txs: RawTransaction[] }]> =
    Object.entries(catData.subcats).sort((a, b) => b[1].total - a[1].total)

  const { data: fxMap } = useCurrencies()
  // Surface direct-to-category transactions as a synthetic group (SPA parity).
  if (catData.txs.length > 0) {
    const directTotal = catData.txs.reduce((sum, tx) => sum + signedAmount(tx, fxMap), 0)
    subcats.push([directLabel(category), { total: directTotal, txs: catData.txs }])
  }

  const catTotal = catData.total

  return (
    <ul className="flex flex-col divide-y divide-border">
      {subcats.map(([name, sub]) => {
        const pct = catTotal > 0 ? ((sub.total / catTotal) * 100).toFixed(1) : '0.0'
        return (
          <li key={name}>
            <button
              type="button"
              onClick={() => onSubcategoryClick(name)}
              className="w-full flex items-center gap-2 py-2.5 px-1 text-left rounded-md hover:bg-surface2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            >
              <span
                className="text-xs font-semibold tabular-nums min-w-[3rem]"
                style={{ color }}
              >
                {pct}%
              </span>
              <span className="flex-1 flex items-center gap-1.5 text-sm text-text truncate">
                {name}
                <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-muted shrink-0" />
              </span>
              <span className="text-sm font-medium tabular-nums text-text">
                {mask(sub.total)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Transactions ──────────────────────────────────────────────────────────

interface TransactionRowsProps {
  transactions: RawTransaction[]
  mask:         MaskFn
  privacyMode:  boolean
}

const PRIVACY_MASK = '••••••'

/**
 * Leaf list of individual transactions, reusing the CC TransactionList visual
 * language (date · account, optional note, PHP amount + native amount).
 */
export function TransactionRows({ transactions, mask, privacyMode }: TransactionRowsProps) {
  const { data: fxMap } = useCurrencies()
  if (transactions.length === 0) {
    return (
      <p className="py-6 px-2 text-sm text-center text-muted">No transactions.</p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {transactions.map((tx) => {
        const currency = (tx.currency || 'PHP').trim() || 'PHP'
        const showNative = currency !== 'PHP'
        const isFxEstimated = isUnresolvedForeignCurrency(currency, tx.resolvedAmount)
        const nativeDisplay = privacyMode
          ? PRIVACY_MASK
          : new Intl.NumberFormat('en-PH', {
              style: 'currency',
              currency,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(tx.amount)

        return (
          <li key={tx.key} className="flex items-start justify-between py-2 gap-3">
            <div className="min-w-0">
              <p className="text-sm text-text truncate">
                <span className="text-xs text-muted">{formatCreditCardTransactionDate(tx.date)}</span>
                <span className="text-muted"> · </span>
                {tx.account}
              </p>
              {tx.note && (
                <TransactionNoteTooltip note={tx.note} />
              )}
            </div>
            <div className="flex flex-col items-end shrink-0 text-right">
              <div className="flex items-center gap-1">
                {isFxEstimated && (
                  <FxEstimatedIndicator transaction={tx} />
                )}
                <span className="text-sm font-medium tabular-nums text-text">
                  {mask(signedAmount(tx, fxMap))}
                </span>
              </div>
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
