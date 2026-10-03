import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, PanelTopClose, PanelTopOpen } from "lucide-react";

import { useAccountBalances } from "@/hooks/useAccountBalances";
import { formatCurrency } from "@/utils/currency";
import type { AccountBalance } from "@/types/accounts";
import AccountRow from "./AccountRow";
import BalanceChart, { chartColor } from "./BalanceChart";
import AccountBalancesFilter, {
  type AccountBalanceFilters,
} from "./AccountBalancesFilter";
import { NAV_TOGGLE_HOVER, NAV_TOGGLE_TAP } from "@/components/navToggle";
import { useMobileCardSwipe } from "@/hooks/useMobileCardSwipe";

const PRIVACY_MASK = "••••••";

interface AccountBalancesProps {
  privacyMode: boolean;
  viewerOpen?: boolean;
  selectedAccount?: string | null;
  onSelectAccount?: (name: string) => void;
  onToggleViewer?: () => void;
}

export default function AccountBalances({
  privacyMode,
  viewerOpen = false,
  selectedAccount = null,
  onSelectAccount = () => {},
  onToggleViewer = () => {},
}: AccountBalancesProps) {
  const { data, isLoading, isError } = useAccountBalances();
  // Collapsed category names; empty set = all groups expanded (default).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [filters, setFilters] = useState<AccountBalanceFilters>({});
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const accountListRef = useRef<HTMLDivElement>(null);
  const toggleGroup = (cat: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  // Hooks must run unconditionally BEFORE any early return (Rules of Hooks).
  const currencyOptions = useMemo(
    () =>
      Array.from(
        new Set(data.map((account) => account.currency).filter(Boolean)),
      ).sort(),
    [data],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          data.map((account) => account.category.trim() || "Uncategorized"),
        ),
      ).sort(),
    [data],
  );
  const filteredAccounts = useMemo(() => {
    const name = filters.name?.trim().toLowerCase();
    return data.filter((account) => {
      if (name && !account.name.toLowerCase().includes(name)) return false;
      if (filters.currency && account.currency !== filters.currency)
        return false;
      if (
        filters.category &&
        (account.category.trim() || "Uncategorized") !== filters.category
      )
        return false;
      return true;
    });
  }, [data, filters]);
  const total = filteredAccounts.reduce(
    (sum, account) => sum + account.phpEquivalent,
    0,
  );
  const activeFilterCount = [
    filters.name?.trim(),
    filters.currency,
    filters.category,
  ].filter(Boolean).length;
  const reduceMotion = useReducedMotion();
  const swipeHandlers = useMobileCardSwipe({
    enabled: viewerOpen,
    onSwipeRight: onToggleViewer,
  });
  // Keep category order stable, but make large groups easy to scan: their
  // largest PHP-equivalent balances are always first. The global index remains
  // attached so chart colors stay consistent with the unmodified chart input.
  const groups = useMemo(() => {
    const order: string[] = [];
    const byCat = new Map<
      string,
      { account: AccountBalance; index: number }[]
    >();
    filteredAccounts.forEach((account, index) => {
      const cat = account.category?.trim() || "Uncategorized";
      if (!byCat.has(cat)) {
        byCat.set(cat, []);
        order.push(cat);
      }
      byCat.get(cat)!.push({ account, index });
    });
    return order.map(
      (cat) =>
        [
          cat,
          byCat
            .get(cat)!
            .slice()
            .sort(
              (left, right) =>
                right.account.phpEquivalent - left.account.phpEquivalent ||
                left.account.name.localeCompare(right.account.name),
            ),
        ] as const,
    );
  }, [filteredAccounts]);

  useEffect(() => {
    if (!scrollTarget) return;

    const account = filteredAccounts.find(({ name }) => name === scrollTarget);
    if (!account) {
      setScrollTarget(null);
      return;
    }

    const category = account.category?.trim() || "Uncategorized";
    if (collapsed.has(category)) {
      setCollapsed((previous) => {
        const next = new Set(previous);
        next.delete(category);
        return next;
      });
      return;
    }

    const frame = requestAnimationFrame(() => {
      const row = Array.from(
        accountListRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
      ).find((element) => element.getAttribute("aria-label") === `View activity for ${scrollTarget}`);
      row?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
      });
      setScrollTarget(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [collapsed, filteredAccounts, reduceMotion, scrollTarget]);

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div aria-busy="true" className="rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full">
        <p role="status" aria-live="polite" className="sr-only">Loading account balances.</p>
        <div className="h-3 w-32 bg-surface2 rounded animate-pulse" />
        <div className="h-48 bg-surface2 rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center gap-3">
            <div className="h-3 w-24 bg-surface2 rounded animate-pulse" />
            <div className="h-3 w-16 bg-surface2 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p role="alert" className="text-sm text-muted text-center">
          Could not load account balances. Please try again later.
        </p>
      </div>
    );
  }

  // ─── Empty ───────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p role="status" className="text-sm text-muted text-center">No accounts found.</p>
      </div>
    );
  }

  // ─── Success ─────────────────────────────────────────────────────────────
  const totalDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(total, "PHP");
  const toggleViewer = () => {
    if (!viewerOpen && filteredAccounts[0])
      onSelectAccount(filteredAccounts[0].name);
    onToggleViewer();
  };
  const selectAccount = (name: string, scrollToRow = false) => {
    if (scrollToRow) setScrollTarget(name);
    if (viewerOpen && selectedAccount === name) {
      onToggleViewer();
      return;
    }
    onSelectAccount(name);
    if (!viewerOpen) onToggleViewer();
  };

  return (
    <motion.div
      {...swipeHandlers}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className={`rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-x-hidden overflow-y-hidden touch-pan-y lg:max-h-none lg:h-full ${viewerOpen ? 'h-full max-h-none' : 'max-h-[calc(100vh-8rem)]'}`}
    >
      {/* Heading + filter */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 lg:flex-nowrap">
        <div className="flex min-w-0 basis-full items-center gap-2 lg:flex-1 lg:basis-auto">
          <p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">
            Account Balances
          </p>
          <p aria-live="polite" aria-atomic="true" className="sr-only">
            {filteredAccounts.length} of {data.length} account{data.length === 1 ? "" : "s"} shown{activeFilterCount ? `. ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active.` : ". No filters active."}{viewerOpen && selectedAccount ? ` Selected account: ${selectedAccount}.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <AccountBalancesFilter
            filters={filters}
            onChange={setFilters}
            currencies={currencyOptions}
            categories={categoryOptions}
          />
          <motion.button
            type="button"
            aria-label={
              viewerOpen ? "Close account activity" : "View account activity"
            }
            title={viewerOpen ? "Close account activity" : "View account activity"}
            onClick={toggleViewer}
            whileHover={NAV_TOGGLE_HOVER}
            whileTap={NAV_TOGGLE_TAP}
            className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <motion.span
              animate={{ rotate: viewerOpen ? 180 : 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 30 }
              }
              className="flex"
            >
              {viewerOpen ? (
                <>
                <PanelTopClose aria-hidden="true" className="h-4 w-4 lg:hidden" />
                <PanelLeftClose aria-hidden="true" className="hidden h-4 w-4 lg:block" />
                </>
              ) : (
                <>
                <PanelTopOpen aria-hidden="true" className="h-4 w-4 lg:hidden" />
                <PanelLeftOpen aria-hidden="true" className="hidden h-4 w-4 lg:block" />
                </>
              )}
            </motion.span>
            <span className="flex min-w-0">
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={viewerOpen ? "close-activity" : "view-activity"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeInOut" }}
                  className="flex items-center whitespace-nowrap"
                >
                  {viewerOpen ? "Close activity" : "View activity"}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.button>
        </div>
      </div>
      {viewerOpen && (
        <p data-swipe-affordance className="-mt-2 text-xs text-muted lg:hidden">
          Swipe right to close activity.
        </p>
      )}

      {/* Donut chart */}
      <div className={`shrink-0 ${viewerOpen ? 'hidden lg:block' : ''}`}>
        <BalanceChart
          accounts={filteredAccounts}
          privacyMode={privacyMode}
          selectedAccount={viewerOpen ? selectedAccount : null}
          onSelectAccount={(name) => selectAccount(name, true)}
          emptyLabel="No matching accounts to chart"
        />
      </div>

      {/* Total row */}
      <div className="shrink-0 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-medium text-text">Total</span>
        <span className="text-sm font-semibold text-text tabular-nums">
          {totalDisplay}
        </span>
      </div>

      {/* Account groups — scrollable; grouped by category, expanded by default */}
      <div ref={accountListRef} data-swipe-exclude className="flex-1 min-h-0 overflow-y-auto px-1 py-1 flex flex-col gap-2 scrollbar-gutter-stable">
        {groups.length === 0 ? (
          <p role="status" aria-live="polite" className="flex-1 py-6 px-2 text-center text-sm text-muted">
            No matching accounts.
          </p>
        ) : (
          groups.map(([category, items], groupIndex) => {
            const isCollapsed = collapsed.has(category);
            const groupId = `account-balance-group-${groupIndex}`;
            return (
              <div key={category} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleGroup(category)}
                  aria-expanded={!isCollapsed}
                  aria-controls={groupId}
                  className="w-full min-h-11 flex items-center gap-1.5 px-1 py-2 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset transition-colors hover:bg-surface2"
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={`shrink-0 w-3.5 h-3.5 text-muted transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                  <span className="min-w-0 truncate font-display text-xs font-semibold tracking-widest uppercase text-muted">
                    {category}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        type: "tween",
                        duration: 0.2,
                        ease: "easeInOut",
                      }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        id={groupId}
                        role="listbox"
                        aria-label="Account balances"
                        className="flex flex-col divide-y divide-border px-1"
                      >
                        {items.map(({ account, index }) => {
                          const pct =
                            total > 0
                              ? ((account.phpEquivalent / total) * 100).toFixed(
                                  1,
                                )
                              : "0.0";
                          return (
                            <AccountRow
                              key={account.name}
                              account={account}
                              percentage={pct}
                              color={chartColor(index, filteredAccounts.length)}
                              privacyMode={privacyMode}
                              selected={
                                viewerOpen && selectedAccount === account.name
                              }
                              onSelect={() => selectAccount(account.name)}
                            />
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
