import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useId, useState } from "react";

import type { CCAccount, CCTransactionData } from "@/types/transactions";
import type { CurrencyData } from "@/types/accounts";
import { formatCurrency } from "@/utils/currency";
import {
  getUtilizationBarColor,
  getDueBadgeText,
  getDueBadgeColor,
  getStatementTotal,
} from "./utils";
import TransactionList from "./TransactionList";
import CycleNavigator from "./CycleNavigator";

const PRIVACY_MASK = "••••••";

export interface CCCardProps {
  account: CCAccount;
  txData: CCTransactionData | undefined;
  /** Current FX rates, provided by the data-owning wrapper. */
  fxMap?: CurrencyData;
  /** Public card-art URL, or null when this account has no image. */
  imageUrl?: string | null;
  privacyMode: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  cycleView: "statement" | "all";
  onCycleViewChange: (view: "statement" | "all") => void;
  cycleIndex: number;
  onCycleIndexChange: (index: number) => void;
  onPay?: () => void;
  viewerOpen?: boolean;
  selected?: boolean;
}

const VIEW_TABS: ReadonlyArray<{ id: "statement" | "all"; label: string }> = [
  { id: "statement", label: "By Statement" },
  { id: "all", label: "All Transactions" },
];

const TRANSACTION_PAGE_SIZES = [10, 25, 50, 100] as const;

export default function CCCard({
  account,
  txData,
  fxMap = { PHP: 1 },
  imageUrl = null,
  privacyMode,
  isExpanded,
  onToggle,
  cycleView,
  onCycleViewChange,
  cycleIndex,
  onCycleIndexChange,
  onPay = () => {},
  viewerOpen = false,
  selected = false,
}: CCCardProps) {
  const detailsId = useId();
  const showNative = account.currency !== "PHP";

  // Pill selector index: statement = left cell (0), all = right cell (1).
  const selectedIndex = cycleView === "statement" ? 0 : 1;

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
  const sourceTransactions = cycleView === "statement"
    ? activeCycle?.transactions ?? []
    : txData?.allTxs ?? [];
  const sourceKey = `${account.name}:${cycleView}:${cycleIndex}:${sourceTransactions.length}`;
  const [rowsPerPage, setRowsPerPage] = useState<(typeof TRANSACTION_PAGE_SIZES)[number]>(25);
  const [pagination, setPagination] = useState({ page: 1, sourceKey });

  // Reset synchronously when the parent selects another card, view, or
  // statement cycle. This avoids a one-render stale page when the source
  // changes, while keeping page state local to this compact card.
  if (pagination.sourceKey !== sourceKey) {
    setPagination({ page: 1, sourceKey });
  }

  const pageCount = Math.max(1, Math.ceil(sourceTransactions.length / rowsPerPage));
  const page = pagination.sourceKey === sourceKey
    ? Math.min(pagination.page, pageCount)
    : 1;
  const paginatedTransactions = sourceTransactions.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );
  const changePage = (nextPage: number) => setPagination({ page: nextPage, sourceKey });
  const changeRowsPerPage = (value: string) => {
    setRowsPerPage(Number(value) as typeof rowsPerPage);
    setPagination({ page: 1, sourceKey });
  };

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

      </button>

      {/* Kept outside the summary action so paying never creates a nested button. */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
        <button
          type="button"
          onClick={onPay}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Pay
        </button>
        <p className="text-right text-xs text-muted">
          Statement <b className="font-semibold text-text">{statementDayDisplay}</b> · Due{" "}
          <b className="font-semibold text-text">{dueDayDisplay}</b>
        </p>
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
            <div className="px-4 pb-4 pt-2 flex flex-col gap-3 border-t border-border">
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
                      className={`relative z-10 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
                      {sourceTransactions.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted">No transactions.</p>
                      ) : (
                        <TransactionList
                          transactions={paginatedTransactions}
                          privacyMode={privacyMode}
                          fxMap={fxMap}
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
                    <TransactionList transactions={paginatedTransactions} privacyMode={privacyMode} fxMap={fxMap} />
                  </motion.div>
                </AnimatePresence>
              )}
              {sourceTransactions.length > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted" htmlFor={`${detailsId}-rows-per-page`}>
                    Rows per page
                    <select
                      id={`${detailsId}-rows-per-page`}
                      aria-label="Rows per page"
                      value={rowsPerPage}
                      onChange={(event) => changeRowsPerPage(event.target.value)}
                      className="min-h-9 rounded-md border border-border bg-surface2 px-1.5 text-xs text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {TRANSACTION_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                  <nav aria-label="Transaction pagination">
                    <ul className="flex items-center gap-1">
                      <li>
                        <button
                          type="button"
                          aria-label="Go to previous page"
                          title="Go to previous page"
                          disabled={page === 1}
                          onClick={() => changePage(page - 1)}
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
                        >
                          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          aria-label="Go to next page"
                          title="Go to next page"
                          disabled={page === pageCount}
                          onClick={() => changePage(page + 1)}
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
                        >
                          <ChevronRight aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
