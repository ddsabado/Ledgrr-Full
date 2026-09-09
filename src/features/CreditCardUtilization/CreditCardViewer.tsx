import { useEffect, useMemo, useState } from "react";
import { ListFilter, X } from "lucide-react";
import { motion, LayoutGroup, useReducedMotion } from "motion/react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCCAccounts } from "@/hooks/useCCAccounts";
import { useCCTransactions } from "@/hooks/useCCTransactions";
import TransactionList from "./TransactionList";
import CycleNavigator from "./CycleNavigator";
import {
  filterTransactions,
  type AccountTransactionFilters,
} from "@/features/AccountBalances/useAccountTransactions";

interface CreditCardViewerProps {
  accountName: string;
  privacyMode: boolean;
}
type ViewMode = "statement" | "all";

export default function CreditCardViewer({
  accountName,
  privacyMode,
}: CreditCardViewerProps) {
  const [view, setView] = useState<ViewMode>("statement");
  const [cycleIndex, setCycleIndex] = useState(0);
  const [filters, setFilters] = useState<AccountTransactionFilters>({});
  const reduceMotion = useReducedMotion();
  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useCCAccounts();
  const {
    data,
    isLoading: transactionsLoading,
    isError: transactionsError,
  } = useCCTransactions(
    accounts.map((account) => ({
      name: account.name,
      statementDay: account.statementDay,
    })),
  );
  const txData = data.get(accountName);
  const types = useMemo(
    () =>
      Array.from(
        new Set((txData?.allTxs ?? []).map((tx) => tx.type).filter(Boolean)),
      ).sort(),
    [txData],
  );
  const cycles = txData?.cycles ?? [];
  const activeCycle = cycles[cycleIndex];
  const source =
    view === "statement"
      ? (activeCycle?.transactions ?? [])
      : (txData?.allTxs ?? []);
  const transactions = useMemo(
    () => filterTransactions(source, filters),
    [filters, source],
  );
  const active = Object.values(filters).some(Boolean);
  const set = (patch: Partial<AccountTransactionFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));
  const isLoading = accountsLoading || transactionsLoading;
  const isError = accountsError || transactionsError;

  useEffect(() => {
    setCycleIndex(0);
  }, [accountName]);

  return (
    <motion.section
      layout
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 260, damping: 30 }
      }
      className="h-full rounded-xl border border-border bg-surface p-5 flex flex-col gap-4 min-h-0 overflow-hidden"
    >
      <header className="shrink-0 flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-text truncate">
          {accountName}
        </h2>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Filter transactions"
              className="relative rounded-md p-1 text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ListFilter className="h-4 w-4" />
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="flex max-h-[70vh] w-72 flex-col gap-3 overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-semibold tracking-widest uppercase text-muted">
                Transaction filters
              </span>
              {active && (
                <button
                  type="button"
                  onClick={() => setFilters({})}
                  className="flex items-center gap-1 text-xs text-muted hover:text-text"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Min amount
                <input
                  type="number"
                  value={filters.minAmount ?? ""}
                  onChange={(e) => set({ minAmount: e.target.value })}
                  className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Max amount
                <input
                  type="number"
                  value={filters.maxAmount ?? ""}
                  onChange={(e) => set({ maxAmount: e.target.value })}
                  className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Date range
              <DateRangePicker
                value={filters.range}
                onChange={(range) => set({ range })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Type
              <select
                value={filters.type ?? ""}
                onChange={(e) => set({ type: e.target.value || undefined })}
                className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">Any</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Note
              <input
                type="search"
                value={filters.note ?? ""}
                onChange={(e) => set({ note: e.target.value })}
                placeholder="Search notes"
                className="rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
          </PopoverContent>
        </Popover>
      </header>
      <LayoutGroup>
        <div
          role="tablist"
          aria-label="Credit-card transaction view"
          className="relative grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-surface2 p-1"
        >
          {(["statement", "all"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={view === mode}
              onClick={() => setView(mode)}
              className={`relative rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${view === mode ? "text-text" : "text-muted hover:text-text"}`}
            >
              {view === mode && (
                <motion.span
                  layoutId="credit-card-view-tab"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 360, damping: 30 }
                  }
                  className="absolute inset-0 rounded-md bg-accent"
                />
              )}
              {
                <span className="relative">
                  {mode === "statement" ? "By Statement" : "All Transactions"}
                </span>
              }
            </button>
          ))}
        </div>
      </LayoutGroup>
      {view === "statement" && (
        <CycleNavigator
          label={activeCycle?.label ?? "—"}
          onPrevious={() =>
            setCycleIndex((index) =>
              Math.min(index + 1, Math.max(0, cycles.length - 1)),
            )
          }
          onNext={() => setCycleIndex((index) => Math.max(0, index - 1))}
          canGoPrevious={cycleIndex < cycles.length - 1}
          canGoNext={cycleIndex > 0}
        />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-gutter-stable">
        {isLoading && (
          <p className="py-8 text-center text-sm text-muted">
            Loading transactions…
          </p>
        )}
        {isError && (
          <p className="py-8 text-center text-sm text-muted">
            Could not load transactions. Please try again later.
          </p>
        )}
        {!isLoading && !isError && transactions.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            No matching transactions.
          </p>
        )}
        {!isLoading && !isError && transactions.length > 0 && (
          <TransactionList
            transactions={transactions}
            privacyMode={privacyMode}
            accountName={accountName}
          />
        )}
      </div>
    </motion.section>
  );
}
