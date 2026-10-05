import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import type { AccountBalance } from "@/types/accounts";
import type { NewTransactionInput } from "@/types/installments";

interface Props {
  open: boolean;
  cardName: string | null;
  fundingAccounts: AccountBalance[];
  isSubmitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (transaction: NewTransactionInput) => void;
}

const inputClass =
  "w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function today(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Convert the shared picker's local date to the Transactions sheet format. */
function toSheetDate(value: Date): string {
  return format(value, "M/d/yyyy");
}

/** Records a transfer from a non-credit funding account into the selected card. */
export default function CreditCardPaymentDialog({
  open,
  cardName,
  fundingAccounts,
  isSubmitting,
  error,
  onOpenChange,
  onSubmit,
}: Props) {
  const [date, setDate] = useState<Date | undefined>(today);
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);

  const selectedAccount = useMemo(
    () => fundingAccounts.find((account) => account.name === accountName),
    [accountName, fundingAccounts],
  );
  const parsedAmount = Number(amount);
  const isValidAmount = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const validationMessage = !date
    ? "Choose the payment date."
    : !selectedAccount
      ? "Choose the account that will fund this payment."
      : amount.trim() === ""
        ? "Enter a payment amount."
        : !isValidAmount
          ? "Enter an amount greater than zero."
          : null;
  const showValidation = hasTriedSubmit && validationMessage;

  useEffect(() => {
    if (!open) return;
    setDate(today());
    setAccountName(fundingAccounts[0]?.name ?? "");
    setAmount("");
    setHasTriedSubmit(false);
  }, [open, fundingAccounts]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasTriedSubmit(true);
    if (!cardName || !date || validationMessage || !selectedAccount) return;

    onSubmit({
      date: toSheetDate(date),
      account: selectedAccount.name,
      amount: parsedAmount,
      currency: selectedAccount.currency,
      targetAccount: cardName,
      type: "Transfer",
      category: "",
      subcategory: "",
      budget: "",
      note: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
        <DialogHeader>
          <DialogTitle>Pay {cardName ?? "credit card"}</DialogTitle>
          <DialogDescription>
            Record a transfer from one of your non-credit accounts to this card.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="space-y-4">
          <label className="grid gap-1 text-sm font-medium text-muted">
            Payment date
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="Choose payment date"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-muted">
            Pay from
            <select
              required
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              className={inputClass}
            >
              <option value="">Choose an account</option>
              {fundingAccounts.map((account) => (
                <option key={account.name} value={account.name}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-muted">
            Amount {selectedAccount ? `(${selectedAccount.currency})` : ""}
            <input
              required
              autoFocus
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={Boolean(showValidation)}
              aria-describedby={showValidation ? "credit-card-payment-error" : undefined}
              className={inputClass}
            />
          </label>
          {showValidation && (
            <p id="credit-card-payment-error" role="alert" className="text-sm text-danger">
              {validationMessage}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-text">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-text disabled:opacity-50">
              {isSubmitting ? "Recording…" : error ? "Retry payment" : "Record payment"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
