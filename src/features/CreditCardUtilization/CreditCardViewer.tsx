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
import { CreditCardActivityViewerShell } from "./CreditCardActivityViewer";
import type { CCAccount, CCTransactionData, RawTransaction } from "@/types/transactions";
import type { CurrencyData } from "@/types/accounts";

interface CreditCardViewerProps {
  accountName: string;
  privacyMode: boolean;
  onClose?: () => void;
  onSelectCard?: (name: string) => void;
  fixture?: { accounts: CCAccount[]; transactionsByAccount: Map<string, CCTransactionData>; fxMap: CurrencyData };
  readOnly?: boolean;
}
type ViewMode = "statement" | "all";
type ContentTransition =
  | { kind: "card" }
  | { kind: "page"; direction: 1 | -1 };

const TRANSACTION_PAGE_SIZES = [10, 25, 50, 100] as const;

export default function CreditCardViewer(props: CreditCardViewerProps) {
  if (props.fixture) return <FixtureCreditCardViewer {...props} fixture={props.fixture} />;
  return <LiveCreditCardViewer {...props} />;
}

function LiveCreditCardViewer({
  accountName,
  privacyMode,
  onClose,
  onSelectCard,
}: CreditCardViewerProps) {
  const [view, setView] = useState<ViewMode>("statement");
  const [cycleIndex, setCycleIndex] = useState(0);
  const [filters, setFilters] = useState<AccountTransactionFilters>({});
  const [rowsPerPage, setRowsPerPage] = useState<(typeof TRANSACTION_PAGE_SIZES)[number]>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [contentTransition, setContentTransition] = useState<ContentTransition>({
    kind: "page",
    direction: 1,
  });
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
    setContentTransition({ kind: "page", direction: -1 });
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
    enter: (transition: ContentTransition) => {
      if (reduceMotion) return { opacity: 0 };
      if (transition.kind === "card") {
        return { opacity: 0, scale: 0.985, filter: "blur(3px)" };
      }
      return { opacity: 0, x: transition.direction * 20, filter: "blur(2px)" };
    },
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (transition: ContentTransition) => {
      if (reduceMotion) return { opacity: 0 };
      if (transition.kind === "card") {
        return { opacity: 0, scale: 0.995, filter: "blur(1px)" };
      }
      return { opacity: 0, x: transition.direction * -12, filter: "blur(1px)" };
    },
  };
  const changePage = (nextPage: number) => {
    const direction = nextPage > page ? 1 : -1;
    setContentTransition({ kind: "page", direction });
    setCurrentPage(nextPage);
  };
  const changeRowsPerPage = (event: ChangeEvent<HTMLSelectElement>) => {
    setContentTransition({ kind: "page", direction: -1 });
    setCurrentPage(1);
    setRowsPerPage(Number(event.target.value) as typeof rowsPerPage);
  };
  const clearFilters = () => {
    setContentTransition({ kind: "page", direction: -1 });
    setCurrentPage(1);
    setFilters({});
  };
  const selectCard = (name: string) => {
    if (name === accountName) return;
    setContentTransition({ kind: "card" });
    onSelectCard?.(name);
  };

  useEffect(() => {
    setCycleIndex(0);
  }, [accountName]);

  useEffect(() => {
    setCurrentPage(1);
  }, [accountName, cycleIndex, rowsPerPage, view]);

  return (
    <CreditCardActivityViewerShell
      as={motion.section}
      layout
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 260, damping: 30 }
      }
    >
      <header className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">Card activity</p>
          <h2 className="hidden font-display text-xl font-semibold tracking-tight text-text truncate lg:block">
            {accountName}
          </h2>
          <label className="sr-only" htmlFor="credit-card-activity-card">
            Selected credit card
          </label>
          <select
            id="credit-card-activity-card"
            aria-label="Selected credit card"
            value={accountName}
            onChange={(event) => selectCard(event.target.value)}
            className="block min-h-11 max-w-full bg-transparent pr-2 font-display text-xl font-semibold tracking-tight text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            {accounts.map((account) => (
              <option key={account.name} value={account.name}>
                {account.name}
              </option>
            ))}
          </select>
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
                setContentTransition({ kind: "page", direction: -1 });
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
            onPrevious={() => {
              setContentTransition({ kind: "page", direction: 1 });
              setCycleIndex((index) =>
                Math.min(index + 1, Math.max(0, cycles.length - 1)),
              );
            }}
            onNext={() => {
              setContentTransition({ kind: "page", direction: -1 });
              setCycleIndex((index) => Math.max(0, index - 1));
            }}
            canGoPrevious={cycleIndex < cycles.length - 1}
            canGoNext={cycleIndex > 0}
          />
          <p className="text-right text-xs tabular-nums text-muted">
            Total {privacyMode ? "••••••" : formatCurrency(statementTotal, "PHP")}
          </p>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto scrollbar-gutter-stable">
        <AnimatePresence initial={false} mode="wait" custom={contentTransition}>
          <motion.div
            key={`${accountName}-${view}-${cycleIndex}-${page}-${rowsPerPage}`}
            data-page={page}
            custom={contentTransition}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
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
              <TransactionList
                transactions={paginatedTransactions}
                privacyMode={privacyMode}
                fxMap={fxMap}
                accountName={accountName}
              />
            )}
          </motion.div>
        </AnimatePresence>
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
    </CreditCardActivityViewerShell>
  );
}

/** Local fixture path: it deliberately never initializes account or transaction hooks. */
function FixtureCreditCardViewer({ accountName, privacyMode, onClose, onSelectCard, fixture }: CreditCardViewerProps & { fixture: { accounts: CCAccount[]; transactionsByAccount: Map<string, CCTransactionData>; fxMap: CurrencyData } }) {
  const [view, setView] = useState<ViewMode>("statement");
  const [filters, setFilters] = useState<AccountTransactionFilters>({});
  const [cycleIndex, setCycleIndex] = useState(0);
  const data = fixture.transactionsByAccount.get(accountName);
  const cycles = data?.cycles ?? [];
  const cycle = cycles[cycleIndex];
  const source = view === "statement" ? cycle?.transactions ?? [] : data?.allTxs ?? [];
  const transactions = filterTransactions(source, filters);
  const types = Array.from(new Set(source.map((transaction) => transaction.type).filter(Boolean))).sort();
  return <CreditCardActivityViewerShell>
    <header className="shrink-0 flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted">Card activity</p><h2 className="font-display text-xl font-semibold tracking-tight text-text">{accountName}</h2><select aria-label="Selected credit card" value={accountName} onChange={(event) => onSelectCard?.(event.target.value)} className="sr-only">{fixture.accounts.map((account) => <option key={account.name}>{account.name}</option>)}</select></div>{onClose && <button type="button" aria-label="Back to credit cards" onClick={onClose} className="min-h-11 px-2 text-xs text-muted">Cards</button>}</header>
    <p role="status" className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">Demo mode — card activity is read-only and changes are not saved.</p>
    <div role="tablist" aria-label="Credit-card transaction view" className="grid grid-cols-2 gap-1 rounded-lg bg-surface2 p-1">{(["statement", "all"] as const).map((mode) => <button key={mode} type="button" role="tab" aria-selected={view === mode} onClick={() => setView(mode)} className="min-h-11 rounded-md text-xs">{mode === "statement" ? "By Statement" : "All Transactions"}</button>)}</div>
    {view === "statement" && <div className="flex items-center justify-between text-xs text-muted"><CycleNavigator label={cycle?.label ?? "—"} onPrevious={() => setCycleIndex((value) => Math.min(value + 1, Math.max(0, cycles.length - 1)))} onNext={() => setCycleIndex((value) => Math.max(0, value - 1))} canGoPrevious={cycleIndex < cycles.length - 1} canGoNext={cycleIndex > 0} /><span>Total {privacyMode ? "••••••" : formatCurrency(getStatementTotal(cycle?.transactions ?? [], fixture.fxMap), "PHP")}</span></div>}
    <Popover><PopoverTrigger asChild><button type="button" aria-label="Filter transactions" className="min-h-11 text-xs text-muted">Filters</button></PopoverTrigger><PopoverContent><label className="text-xs text-muted">Type<select value={filters.type ?? ""} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value || undefined }))}><option value="">Any</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label><label className="ml-2 text-xs text-muted">Note<input value={filters.note ?? ""} onChange={(event) => setFilters((current) => ({ ...current, note: event.target.value }))} /></label></PopoverContent></Popover>
    <div className="flex-1 min-h-0 overflow-y-auto">{transactions.length ? <TransactionList transactions={transactions as RawTransaction[]} privacyMode={privacyMode} fxMap={fixture.fxMap} accountName={accountName} /> : <p className="py-8 text-center text-sm text-muted">No matching transactions.</p>}</div>
  </CreditCardActivityViewerShell>;
}
