import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { format } from "date-fns";

import CreditCardPaymentDialog from "../CreditCardPaymentDialog";
import type { AccountBalance } from "@/types/accounts";

const accounts: AccountBalance[] = [
  {
    name: "Cash", category: "Cash", currency: "PHP", currentBalance: 500,
    initialBalance: 0, creditLimit: 0, statementDay: null, dueDay: null,
    image: "", accountType: "Debit", phpEquivalent: 500,
  },
  {
    name: "USD Wallet", category: "Wallet", currency: "USD", currentBalance: 20,
    initialBalance: 0, creditLimit: 0, statementDay: null, dueDay: null,
    image: "", accountType: "Debit", phpEquivalent: 1100,
  },
];

function renderDialog(overrides: Partial<ComponentProps<typeof CreditCardPaymentDialog>> = {}) {
  const onSubmit = vi.fn();
  render(
    <CreditCardPaymentDialog
      open
      cardName="Visa"
      fundingAccounts={accounts}
      isSubmitting={false}
      error={null}
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return onSubmit;
}

describe("CreditCardPaymentDialog", () => {
  it("defaults the date to today and builds a transfer using the funding account currency", async () => {
    const user = userEvent.setup();
    const onSubmit = renderDialog();

    const localToday = new Date();
    const expectedDate = `${localToday.getMonth() + 1}/${localToday.getDate()}/${localToday.getFullYear()}`;
    expect(screen.getByRole("button", { name: "Select date" })).toHaveTextContent(
      format(localToday, "LLL dd, y"),
    );
    await user.selectOptions(screen.getByLabelText("Pay from"), "USD Wallet");
    await user.type(screen.getByLabelText(/Amount/), "12.5");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(onSubmit).toHaveBeenCalledWith({
      date: expectedDate,
      account: "USD Wallet",
      amount: 12.5,
      currency: "USD",
      targetAccount: "Visa",
      type: "Transfer",
      category: "",
      subcategory: "",
      budget: "",
      note: "",
    });
  });

  it("keeps invalid input and explains how to correct a non-positive amount", async () => {
    const user = userEvent.setup();
    const onSubmit = renderDialog();
    const amount = screen.getByLabelText(/Amount/);

    await user.type(amount, "0");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount greater than zero");
    expect(amount).toHaveValue(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves entered values and offers a retry after a recording error", async () => {
    const user = userEvent.setup();
    renderDialog({ error: "Could not record this payment. Check your connection and try again." });
    const amount = screen.getByLabelText(/Amount/);

    await user.type(amount, "100");

    expect(screen.getByRole("alert")).toHaveTextContent("Check your connection and try again");
    expect(screen.getByRole("button", { name: "Retry payment" })).toBeEnabled();
    expect(amount).toHaveValue(100);
  });
});
