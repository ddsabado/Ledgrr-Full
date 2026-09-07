import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'

import type { CCAccount, CCTransactionData } from '@/types/transactions'
import { formatCurrency } from '@/utils/currency'
import {
  getUtilizationBarColor,
  getDueBadgeText,
  getDueBadgeColor,
  getAccountImageUrl,
} from './utils'
import TransactionList from './TransactionList'
import CycleNavigator from './CycleNavigator'

const PRIVACY_MASK = '••••••'

interface CCCardProps {
  account:            CCAccount
  txData:             CCTransactionData | undefined
  privacyMode:        boolean
  isExpanded:         boolean
  onToggle:           () => void
  cycleView:          'statement' | 'all'
  onCycleViewChange:  (view: 'statement' | 'all') => void
  cycleIndex:         number
  onCycleIndexChange: (index: number) => void
}

const VIEW_TABS: ReadonlyArray<{ id: 'statement' | 'all'; label: string }> = [
  { id: 'statement', label: 'By Statement' },
  { id: 'all', label: 'All Transactions' },
]

export default function CCCard({
  account,
  txData,
  privacyMode,
  isExpanded,
  onToggle,
  cycleView,
  onCycleViewChange,
  cycleIndex,
  onCycleIndexChange,
}: CCCardProps) {
  const showNative = account.currency !== 'PHP'

  // Public URL for the card art stored in the account_images bucket.
  // null when the account has no image filename set.
  const imageUrl = getAccountImageUrl(account.image)

  // PHP-equivalent balance (always shown).
  const phpDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.phpEquivalent, 'PHP')

  // Native-currency balance (shown only when not PHP).
  const nativeDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.currentBalance, account.currency)

  // Derive the FX rate from the account's own fields, then compute the
  // credit limit and available credit in PHP so the values stay consistent
  // with phpEquivalent.
  const fxRate =
    account.currentBalance !== 0
      ? account.phpEquivalent / account.currentBalance
      : 1
  const creditLimitPHP = account.creditLimit * fxRate
  const availablePHP = Math.max(0, creditLimitPHP - account.phpEquivalent)
  const availableDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(availablePHP, 'PHP')

  // Utilization bar: rounded percentage label, width capped at 100%.
  const utilizationPct = Math.round(account.utilization)
  const barWidth = Math.min(100, account.utilization)
  const barColor = getUtilizationBarColor(account.utilization)

  // Statement / due day metadata.
  const statementDayDisplay =
    account.statementDay !== null ? String(account.statementDay) : '—'
  const dueDayDisplay = account.dueDay !== null ? String(account.dueDay) : '—'

  // Amount due (current cycle, PHP).
  const amountDueDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.amountDue, 'PHP')

  // Cycle navigation state (index 0 = most recent).
  const cycles = txData?.cycles ?? []
  const activeCycle = cycles[cycleIndex]
  const canGoPrevious = cycleIndex < cycles.length - 1 // older
  const canGoNext = cycleIndex > 0 // newer

  return (
    <div className="shrink-0 rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* ─── Collapsed / header (clickable) ─────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full text-left px-4 py-4 flex flex-col gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset transition-colors hover:bg-gray-800/40"
      >
        {/* Name + due badge + chevron */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 truncate">
              {account.name}
            </span>
            {account.daysUntilDue !== null && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${getDueBadgeColor(
                  account.daysUntilDue,
                )}`}
              >
                {getDueBadgeText(account.daysUntilDue)}
              </span>
            )}
          </div>
          <ChevronDown
            aria-hidden="true"
            className={`shrink-0 w-4 h-4 text-gray-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>

        {/* Card art */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="h-12 w-20 rounded object-contain object-left"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        )}

        {/* Balance (large) */}
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-white tabular-nums leading-tight">
            {phpDisplay}
          </span>
          {showNative && (
            <span className="text-xs text-gray-500 tabular-nums mt-0.5">
              {nativeDisplay}
            </span>
          )}
        </div>

        {/* Utilization progress bar */}
        <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Utilization % + available credit */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="tabular-nums">{utilizationPct}% used</span>
          <span className="tabular-nums">{availableDisplay} limit left</span>
        </div>

        {/* Statement / due day + amount due */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500">
          <span>
            Statement <b className="text-gray-300 font-semibold">{statementDayDisplay}</b> · Due{' '}
            <b className="text-gray-300 font-semibold">{dueDayDisplay}</b>
          </span>
          <span className="tabular-nums">
            <span className="text-gray-600">Amount due </span>
            <span className="text-gray-300 font-semibold">{amountDueDisplay}</span>
          </span>
        </div>
      </button>

      {/* ─── Expanded panel ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-gray-800">
              {/* View mode tabs */}
              <LayoutGroup>
                <div
                  role="tablist"
                  aria-label="Transaction view mode"
                  className="flex items-center gap-1 rounded-lg bg-gray-800/60 p-1"
                >
                  {VIEW_TABS.map((tab) => {
                    const isSelected = cycleView === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => onCycleViewChange(tab.id)}
                        className={`relative flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                          isSelected
                            ? 'text-white'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId={`cc-view-pill-${account.name}`}
                            className="absolute inset-0 rounded-md bg-gray-700"
                            transition={{
                              type: 'spring',
                              stiffness: 300,
                              damping: 28,
                            }}
                          />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
              </LayoutGroup>

              {/* Content */}
              {cycleView === 'statement' ? (
                <div className="flex flex-col gap-2">
                  <CycleNavigator
                    label={activeCycle?.label ?? '—'}
                    onPrevious={() => onCycleIndexChange(cycleIndex + 1)}
                    onNext={() => onCycleIndexChange(cycleIndex - 1)}
                    canGoPrevious={canGoPrevious}
                    canGoNext={canGoNext}
                  />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={cycleIndex}
                      className="max-h-40 overflow-y-auto overflow-x-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                    >
                      <TransactionList
                        transactions={activeCycle?.transactions ?? []}
                        privacyMode={privacyMode}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key="all"
                    className="max-h-40 overflow-y-auto overflow-x-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeInOut' }}
                  >
                    <TransactionList
                      transactions={txData?.allTxs ?? []}
                      privacyMode={privacyMode}
                    />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
