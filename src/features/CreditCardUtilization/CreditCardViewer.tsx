import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ChevronLeft, ChevronRight, ListFilter, X } from "lucide-react";
import { AnimatePresence, motion, LayoutGroup, useReducedMotion } from "motion/react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCCAccounts } from "@/hooks/useCCAccounts";
import { useCCTransactions } from "@/hooks/useCCTransactions";
import { useCurrencies } from "@/hooks/useCurrencies";
import { formatCurrency } from "@/utils/currency";
import TransactionList from "./TransactionList";
import CycleNavigator from "./CycleNavigator";
import { getStatementTotal } from "./utils";
import {
  filterTransactions,
  type AccountTransactionFilters,
} from "@/features/AccountBalances/useAccountTransactions";

interface CreditCardViewerProps {
  accountName: string;
  privacyMode: boolean;
  onClose?: () => void;
}
type ViewMode = "statement" | "all";

const TRANSACTION_PAGE_SIZES = [10, 25, 50, 100] as const;

export default function CreditCardViewer({
  accountName,
  privacyMode,
  onClose,
}: CreditCardViewerProps) {
  const [view, setView] = useState<ViewMode>("statement");
  const [cycleIndex, setCycleIndex] = useState(0);
  const [filters, setFilters] = useState<AccountTransactionFilters>({});
  const [rowsPerPage, setRowsPerPage] = useState<(typeof TRANSACTION_PAGE_SIZES)[number]>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  const { data: fxMap } = useCurrencies();
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
  const statementTotal = getStatementTotal(activeCycle?.transactions ?? [], fxMap);
  const source =
    view === "statement"
      ? (activeCycle?.transactions ?? [])
      : (txData?.allTxs ?? []);
  const transactions = useMemo(
    () => filterTransactions(source, filters),
    [filters, source],
  );
  const active = Object.values(filters).some(Boolean);
  const set = (patch: Partial<AccountTransactionFilters>) => {
    setPageDirection(-1);
    setCurrentPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  };
  const isLoading = accountsLoading || transactionsLoading;
  const isError = accountsError || transactionsError;
  const pageCount = Math.max(1, Math.ceil(transactions.length / rowsPerPage));
  const page = Math.min(currentPage, pageCount);
  const paginatedTransactions = transactions.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );
  const pageVariants = {
    enter: (direction: number) =>
      reduceMotion
        ? { opacity: 0 }
        : { opacity: 0, x: direction * 20, filter: "blur(2px)" },
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (direction: number) =>
      reduceMotion
        ? { opacity: 0 }
        : { opacity: 0, x: direction * -12, filter: "blur(1px)" },
  };
  const changePage = (nextPage: number) => {
    setPageDirection(nextPage > page ? 1 : -1);
    setCurrentPage(nextPage);
  };
  const changeRowsPerPage = (event: ChangeEvent<HTMLSelectElement>) => {
    setPageDirection(-1);
    setCurrentPage(1);
    setRowsPerPage(Number(event.target.value) as typeof rowsPerPage);
  };
  const clearFilters = () => {
    setPageDirection(-1);
    setCurrentPage(1);
    setFilters({});
  };

  useEffect(() => {
    setCycleIndex(0);
  }, [accountName]);

  useEffect(() => {
    setPageDirection(-1);
    setCurrentPage(1);
  }, [accountName, cycleIndex, rowsPerPage, view]);

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
      <header className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">Card activity</p>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text truncate">
            {accountName}
          </h2>
        </div>
        <div className="flex w-full shrink-0 items-center justify-between gap-2 self-start sm:w-auto sm:justify-end">
          {onClose && (
            <button
              type="button"
              aria-label="Back to credit cards"
              onClick={onClose}
              className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              <span>Cards</span>
            </button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Filter transactions"
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                  onClick={clearFilters}
                  className="inline-flex min-h-11 items-center gap-1 px-2 text-xs text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        </div>
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
              onClick={() => {
                setPageDirection(-1);
                setCurrentPage(1);
                setView(mode);
              }}
              className={`relative min-h-11 rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${view === mode ? "text-text" : "text-muted hover:text-text"}`}
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
        <div className="flex flex-col gap-1">
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
          <p className="text-right text-xs tabular-nums text-muted">
            Total {privacyMode ? "••••••" : formatCurrency(statementTotal, "PHP")}
          </p>
        </div>
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
            {view === "statement" && (activeCycle?.transactions.length ?? 0) === 0
              ? "No transactions."
              : "No matching transactions."}
          </p>
        )}
        {!isLoading && !isError && transactions.length > 0 && (
          <AnimatePresence initial={false} mode="wait" custom={pageDirection}>
            <motion.div
              key={`${accountName}-${view}-${cycleIndex}-${page}-${rowsPerPage}`}
              data-page={page}
              custom={pageDirection}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduceMotion ? { duration: 0.12 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <TransactionList
                transactions={paginatedTransactions}
                privacyMode={privacyMode}
                accountName={accountName}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      {!isLoading && !isError && transactions.length > 0 && (
        <div className="shrink-0 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-muted" htmlFor="credit-card-rows-per-page">
              Rows per page
              <select
                id="credit-card-rows-per-page"
                aria-label="Rows per page"
                value={rowsPerPage}
                onChange={changeRowsPerPage}
                className="min-h-11 rounded-md border border-border bg-surface2 px-2 text-sm text-text transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {TRANSACTION_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
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
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
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
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
                  >
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      )}
    </motion.section>
  );
}
