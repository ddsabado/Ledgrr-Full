import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useId } from "react";

import type { CCAccount, CCTransactionData } from "@/types/transactions";
import { formatCurrency } from "@/utils/currency";
import { useCurrencies } from "@/hooks/useCurrencies";
import {
  getUtilizationBarColor,
  getDueBadgeText,
  getDueBadgeColor,
  getAccountImageUrl,
  getStatementTotal,
} from "./utils";
import TransactionList from "./TransactionList";
import CycleNavigator from "./CycleNavigator";

const PRIVACY_MASK = "••••••";

interface CCCardProps {
  account: CCAccount;
  txData: CCTransactionData | undefined;
  privacyMode: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onViewActivity: () => void;
  cycleView: "statement" | "all";
  onCycleViewChange: (view: "statement" | "all") => void;
  cycleIndex: number;
  onCycleIndexChange: (index: number) => void;
  viewerOpen?: boolean;
  selected?: boolean;
}

const VIEW_TABS: ReadonlyArray<{ id: "statement" | "all"; label: string }> = [
  { id: "statement", label: "By Statement" },
  { id: "all", label: "All Transactions" },
];

export default function CCCard({
  account,
  txData,
  privacyMode,
  isExpanded,
  onToggle,
  onViewActivity,
  cycleView,
  onCycleViewChange,
  cycleIndex,
  onCycleIndexChange,
  viewerOpen = false,
  selected = false,
}: CCCardProps) {
  const detailsId = useId();
  const { data: fxMap } = useCurrencies();
  const showNative = account.currency !== "PHP";

  // Pill selector index: statement = left cell (0), all = right cell (1).
  const selectedIndex = cycleView === "statement" ? 0 : 1;

  // Public URL for the card art stored in the account_images bucket.
  // null when the account has no image filename set.
  const imageUrl = getAccountImageUrl(account.image);

  // PHP-equivalent balance (always shown).
  const phpDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.phpEquivalent, "PHP");

  // Native-currency balance (shown only when not PHP).
  const nativeDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.currentBalance, account.currency);

  // Derive the FX rate from the account's own fields, then compute the
  // credit limit and available credit in PHP so the values stay consistent
  // with phpEquivalent.
  const fxRate =
    account.currentBalance !== 0
      ? account.phpEquivalent / account.currentBalance
      : 1;
  const creditLimitPHP = account.creditLimit * fxRate;
  const availablePHP = Math.max(0, creditLimitPHP - account.phpEquivalent);
  const availableDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(availablePHP, "PHP");

  // Utilization bar: rounded percentage label, width capped at 100%.
  const utilizationPct = Math.round(account.utilization);
  const barWidth = Math.min(100, account.utilization);
  const barColor = getUtilizationBarColor(account.utilization);

  // Statement / due day metadata.
  const statementDayDisplay =
    account.statementDay !== null ? String(account.statementDay) : "—";
  const dueDayDisplay = account.dueDay !== null ? String(account.dueDay) : "—";

  // Amount due (current cycle, PHP).
  const amountDueDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.amountDue, "PHP");
  const isDueActionable =
    account.daysUntilDue !== null && account.daysUntilDue <= 7;
  const dueStatus =
    account.daysUntilDue === null
      ? null
      : account.daysUntilDue < 0
        ? `Overdue by ${Math.abs(account.daysUntilDue)}d`
        : getDueBadgeText(account.daysUntilDue);

  // Cycle navigation state (index 0 = most recent).
  const cycles = txData?.cycles ?? [];
  const activeCycle = cycles[cycleIndex];
  const statementTotal = getStatementTotal(activeCycle?.transactions ?? [], fxMap);
  const statementTotalDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(statementTotal, "PHP");
  const canGoPrevious = cycleIndex < cycles.length - 1; // older
  const canGoNext = cycleIndex > 0; // newer

  return (
    <div
      className={`shrink-0 rounded-lg border bg-surface overflow-hidden ${viewerOpen && selected ? "border-accent ring-1 ring-accent/60" : "border-border"}`}
    >
      {/* The summary and activity actions are siblings: the card never nests
          an interactive control inside its full-width action. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={
          viewerOpen
            ? `Select ${account.name}`
            : `${isExpanded ? "Collapse" : "Expand"} ${account.name} details`
        }
        aria-controls={viewerOpen ? undefined : detailsId}
        aria-expanded={viewerOpen ? undefined : isExpanded}
        aria-pressed={viewerOpen ? selected : undefined}
        className="w-full text-left px-4 py-4 flex flex-col gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset transition-colors hover:bg-surface2"
      >
        {/* Name + due badge + chevron */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted truncate">
              {account.name}
            </span>
            {dueStatus && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${getDueBadgeColor(
                  account.daysUntilDue!,
                )}`}
              >
                {dueStatus}
              </span>
            )}
          </div>
          {!viewerOpen && (
            <ChevronDown
              aria-hidden="true"
              className={`shrink-0 w-4 h-4 text-muted transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>

        {/* Card art */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="h-8 w-14 rounded object-contain object-left"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}

        {/* Current balance remains the leading PHP amount; native currency is
            retained directly beneath it for non-PHP cards. */}
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted">Current balance</span>
          <span className="text-2xl font-bold text-text tabular-nums leading-tight">
            {phpDisplay}
          </span>
          {showNative && (
            <span className="text-xs text-muted tabular-nums mt-0.5">
              Native balance {nativeDisplay}
            </span>
          )}
        </div>

        {/* Utilization progress bar */}
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Utilization % + available credit */}
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="tabular-nums">{utilizationPct}% used</span>
          <span className="tabular-nums">{availableDisplay} limit left</span>
        </div>

        {/* Keep calendar metadata quiet unless the payment is imminent. */}
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 text-xs text-muted">
          <span>
            Statement{" "}
            <b className="text-text font-semibold">{statementDayDisplay}</b> ·
            Due <b className="text-text font-semibold">{dueDayDisplay}</b>
          </span>
        </div>
      </button>

      <div className="border-t border-border px-4 py-3">
        <div
          className={`flex min-h-11 items-center justify-between gap-3 rounded-md px-3 py-2 ${
            isDueActionable ? "bg-surface2" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">Amount due</p>
            <p className="text-sm font-semibold text-text tabular-nums">
              {amountDueDisplay}
              {isDueActionable && dueStatus && (
                <span className="ml-2 text-xs font-medium text-muted">{dueStatus}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onViewActivity}
            aria-current={viewerOpen && selected ? "page" : undefined}
            className="group inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span>{viewerOpen && selected ? "Viewing activity" : "View activity"}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* ─── Expanded panel ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {!viewerOpen && isExpanded && (
          <motion.div
            id={detailsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-border">
              {/* View mode tabs — single persistent highlight that slides
                  horizontally between the two equal-width cells (R6). */}
              <div
                role="tablist"
                aria-label="Transaction view mode"
                className="relative grid grid-cols-2 gap-1 rounded-lg bg-surface2 p-1"
              >
                {/* One always-mounted highlight; only `x` animates (strictly
                    horizontal, no mount/unmount, no opacity fade). Positioned
                    over the left cell and shifted one cell-width right for
                    'all'. */}
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 left-1 rounded-md bg-accent"
                  style={{ width: "calc(50% - 0.375rem)" }}
                  initial={false}
                  animate={{ x: `${selectedIndex * 100}%` }}
                  transition={{
                    type: "tween",
                    duration: 0.22,
                    ease: "easeInOut",
                  }}
                />
                {VIEW_TABS.map((tab) => {
                  const isSelected = cycleView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => onCycleViewChange(tab.id)}
                      className={`relative z-10 min-h-11 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isSelected ? "text-text" : "text-muted hover:text-text"
                      }`}
                    >
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              {cycleView === "statement" ? (
                <div className="flex flex-col gap-2">
                  <CycleNavigator
                    label={activeCycle?.label ?? "—"}
                    onPrevious={() => onCycleIndexChange(cycleIndex + 1)}
                    onNext={() => onCycleIndexChange(cycleIndex - 1)}
                    canGoPrevious={canGoPrevious}
                    canGoNext={canGoNext}
                  />
                  <p className="text-right text-xs tabular-nums text-muted">
                    Total <span className="font-semibold text-text">{statementTotalDisplay}</span>
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={cycleIndex}
                      className="max-h-40 overflow-y-auto overflow-x-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: "easeInOut" }}
                    >
                      {(activeCycle?.transactions.length ?? 0) === 0 ? (
                        <p className="py-6 text-center text-sm text-muted">No transactions.</p>
                      ) : (
                        <TransactionList
                          transactions={activeCycle?.transactions ?? []}
                          privacyMode={privacyMode}
                        />
                      )}
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
                    transition={{ duration: 0.15, ease: "easeInOut" }}
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
  );
}
