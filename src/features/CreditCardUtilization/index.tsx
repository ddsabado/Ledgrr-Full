import { useMemo, useState } from "react";

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
import NewCreditCardDialog from "./NewCreditCardDialog";
import CreditCardPaymentDialog from "./CreditCardPaymentDialog";
import CreditCardUtilizationCard from "./CreditCardUtilizationCard";
import { getAccountImageUrl } from "./utils";
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
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentCardName, setPaymentCardName] = useState<string | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
  const imageUrls = useMemo(
    () => Object.fromEntries(ccAccounts.map((account) => [account.name, getAccountImageUrl(account.image)])),
    [ccAccounts],
  );
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
    <>
      <CreditCardUtilizationCard
        accounts={ccAccounts}
        transactionsByAccount={ccTxData}
        fxMap={fxMap}
        imageUrls={imageUrls}
        privacyMode={privacyMode}
        viewerOpen={viewerOpen}
        selectedCard={selectedCard}
        onSelectCard={onSelectCard}
        onToggleViewer={onToggleViewer}
        onAddCreditCard={() => { setSubmitError(null); setNewCardOpen(true); }}
        onPay={(account) => { setPaymentError(null); setPaymentCardName(account.name); }}
      />
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
    </>
  );
}
