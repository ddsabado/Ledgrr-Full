import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useCCAccounts } from "@/hooks/useCCAccounts";
import { useAccountBalances } from "@/hooks/useAccountBalances";
import { useCCTransactions } from "@/hooks/useCCTransactions";
import { useCurrencies } from "@/hooks/useCurrencies";
import { useAccountImages } from "@/hooks/useAccountImages";
import type { NewCreditCardInput } from "@/types/accounts";
import { createCreditCard, insertTransactions } from "@/services/api";
import { queryClient } from "@/lib/queryClient";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { NAV_TOGGLE_HOVER, NAV_TOGGLE_TAP } from "@/components/navToggle";
import CCCard from "./CCCard";
import NewCreditCardDialog from "./NewCreditCardDialog";
import CreditCardPaymentDialog from "./CreditCardPaymentDialog";
import type { NewTransactionInput } from "@/types/installments";

interface CreditCardUtilizationProps {
  privacyMode: boolean;
  viewerOpen?: boolean;
  selectedCard?: string | null;
  onSelectCard?: (name: string) => void;
  onToggleViewer?: () => void;
}

export default function CreditCardUtilization({
  privacyMode,
  viewerOpen = false,
  selectedCard = null,
  onSelectCard = () => {},
  onToggleViewer = () => {},
}: CreditCardUtilizationProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [cycleIndex, setCycleIndex] = useState<Record<string, number>>({});
  const [cycleView, setCycleView] = useState<"statement" | "all">("statement");
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentCardName, setPaymentCardName] = useState<string | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  // Guard: selecting the already-active view is a no-op (R6.6) — prevents a
  // spurious pill transition when the current option is re-clicked.
  const handleCycleViewChange = (view: "statement" | "all") => {
    setCycleView((prev) => (prev === view ? prev : view));
  };

  const { session } = useAuth();
  const { data: fxMap } = useCurrencies();
  const { data: fundingAccounts } = useAccountBalances();

  const {
    data: ccAccounts,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useCCAccounts();

  const {
    data: ccTxData,
    isLoading: txLoading,
    isError: txError,
  } = useCCTransactions(
    ccAccounts.map((a) => ({ name: a.name, statementDay: a.statementDay })),
  );

  const isLoading = accountsLoading || txLoading;
  const isError = accountsError || txError;
  const currencies = useMemo(() => Object.keys(fxMap).sort(), [fxMap]);
  const { data: accountImages = [], isLoading: imagesLoading, error: imagesError } = useAccountImages();

  // ─── Auth guard ───────────────────────────────────────────────────────────
  // When unauthenticated render nothing — no skeleton, no error.
  if (session === null) {
    return null;
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full">
        <div className="h-3 w-32 bg-surface2 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-surface2 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p className="text-sm text-muted text-center">
          Could not load credit card data. Please try again later.
        </p>
      </div>
    );
  }

  // ─── Success ─────────────────────────────────────────────────────────────
  // Sort by daysUntilDue ascending, nulls last.
  const sorted = [...ccAccounts].sort((a, b) => {
    if (a.daysUntilDue === null && b.daysUntilDue === null) return 0;
    if (a.daysUntilDue === null) return 1;
    if (b.daysUntilDue === null) return -1;
    return a.daysUntilDue - b.daysUntilDue;
  });
  const toggleViewer = () => {
    if (!viewerOpen && sorted[0]) onSelectCard(sorted[0].name);
    setExpandedCard(null);
    onToggleViewer();
  };

  const submitNewCard = (input: NewCreditCardInput) => {
    setIsSubmitting(true);
    setSubmitError(null);
    void createCreditCard(input)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.accountBalances] });
        setNewCardOpen(false);
      })
      .catch((error: unknown) => setSubmitError(error instanceof Error ? error.message : "Could not add the credit card."))
      .finally(() => setIsSubmitting(false));
  };

  const submitPayment = (transaction: NewTransactionInput) => {
    setIsPaymentSubmitting(true);
    setPaymentError(null);
    void insertTransactions([transaction])
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.transactions] }),
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.accountBalances] }),
        ]);
        setPaymentCardName(null);
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Please check your connection and try again.";
        setPaymentError(`Could not record this payment. ${detail}`);
      })
      .finally(() => setIsPaymentSubmitting(false));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className={`rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden lg:max-h-none lg:h-full ${viewerOpen ? "h-full max-h-none" : "max-h-[calc(100vh-8rem)]"}`}
    >
      <div className="shrink-0 flex items-center justify-between gap-2">
        <p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">
          Credit Cards
        </p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Add credit card" onClick={() => { setSubmitError(null); setNewCardOpen(true); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Settings aria-hidden="true" className="h-4 w-4" />
          </button>
          <motion.button
            type="button"
            aria-label={viewerOpen ? "Close credit card activity" : "View credit card activity"}
            title={viewerOpen ? "Close credit card activity" : "View credit card activity"}
            onClick={toggleViewer}
            whileHover={NAV_TOGGLE_HOVER}
            whileTap={NAV_TOGGLE_TAP}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
              ) : (
                <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
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
      {/* CC cards — scrollable list; cards keep natural height (shrink-0) so
          expanding one scrolls the list rather than compressing siblings. */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pr-1 scrollbar-gutter-stable">
        {sorted.length === 0 ? <p className="py-6 text-center text-sm text-muted">No credit cards found.</p> : sorted.map((account) => (
          <CCCard
            key={account.name}
            account={account}
            txData={ccTxData.get(account.name)}
            privacyMode={privacyMode}
            isExpanded={expandedCard === account.name}
            onToggle={() =>
              viewerOpen
                ? onSelectCard(account.name)
                : setExpandedCard(
                    expandedCard === account.name ? null : account.name,
                  )
            }
            viewerOpen={viewerOpen}
            selected={selectedCard === account.name}
            cycleView={cycleView}
            onCycleViewChange={handleCycleViewChange}
            cycleIndex={cycleIndex[account.name] ?? 0}
            onCycleIndexChange={(i) =>
              setCycleIndex((prev) => ({ ...prev, [account.name]: i }))
            }
            onPay={() => {
              setPaymentError(null);
              setPaymentCardName(account.name);
            }}
          />
        ))}
      </div>
      <NewCreditCardDialog open={newCardOpen} onOpenChange={setNewCardOpen} currencies={currencies} images={accountImages} imagesLoading={imagesLoading} imageError={imagesError ? 'Could not load account images.' : null} isSubmitting={isSubmitting} error={submitError} onSubmit={submitNewCard} />
      <CreditCardPaymentDialog
        open={paymentCardName !== null}
        cardName={paymentCardName}
        fundingAccounts={fundingAccounts}
        isSubmitting={isPaymentSubmitting}
        error={paymentError}
        onOpenChange={(open) => {
          if (!open && !isPaymentSubmitting) setPaymentCardName(null);
        }}
        onSubmit={submitPayment}
      />
    </motion.div>
  );
}
