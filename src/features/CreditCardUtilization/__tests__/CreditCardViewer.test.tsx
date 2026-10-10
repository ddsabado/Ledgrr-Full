import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RawTransaction } from "@/types/transactions";

import CreditCardViewer from "../CreditCardViewer";

const hookState = vi.hoisted(() => ({
  accounts: [] as Array<{ name: string; statementDay: number | null }>,
  transactions: new Map<string, { cycles: []; allTxs: RawTransaction[] }>(),
}));

vi.mock("@/hooks/useCCAccounts", () => ({
  useCCAccounts: () => ({ data: hookState.accounts, isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useCCTransactions", () => ({
  useCCTransactions: () => ({ data: hookState.transactions, isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useCurrencies", () => ({
  useCurrencies: () => ({ data: { PHP: 1 }, isLoading: false, isError: false }),
}));

vi.mock("../TransactionList", () => ({
  default: ({ transactions }: { transactions: RawTransaction[] }) => (
    <div data-testid="transaction-list">{transactions.map((transaction) => transaction.key).join(",")}</div>
  ),
}));

describe("CreditCardViewer", () => {
  it("returns to the credit-card list through the mobile back control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <CreditCardViewer
        accountName="Visa"
        privacyMode={false}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Back to credit cards" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("paginates card transactions and resets when the page size changes", async () => {
    hookState.accounts = [{ name: "Visa", statementDay: 16 }];
    const transactions: RawTransaction[] = Array.from({ length: 26 }, (_, index) => ({
      key: `transaction-${index + 1}`,
      date: "2026-10-11",
      account: "Visa",
      amount: index + 1,
      resolvedAmount: index + 1,
      currency: "PHP",
      targetAccount: "",
      type: "Expense",
      category: "Food",
      subcategory: "",
      budget: "",
      note: "",
    }));
    hookState.transactions = new Map([["Visa", { cycles: [], allTxs: transactions }]]);
    const user = userEvent.setup();

    render(<CreditCardViewer accountName="Visa" privacyMode={false} />);

    await user.click(screen.getByRole("tab", { name: "All Transactions" }));
    const previous = screen.getByRole("button", { name: "Go to previous page" });
    const next = screen.getByRole("button", { name: "Go to next page" });
    await waitFor(() => expect(screen.getByTestId("transaction-list")).toHaveTextContent("transaction-25"));
    expect(screen.getByTestId("transaction-list")).not.toHaveTextContent("transaction-26");
    expect(previous).toBeDisabled();

    await user.click(next);
    await waitFor(() => expect(screen.getByTestId("transaction-list")).toHaveTextContent("transaction-26"));
    expect(next).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Rows per page"), "10");
    await waitFor(() => expect(screen.getByTestId("transaction-list")).toHaveTextContent("transaction-10"));
    expect(screen.getByTestId("transaction-list")).not.toHaveTextContent("transaction-11");
    expect(previous).toBeDisabled();
  });

  it("loads the selected card's activity from the mobile card control", async () => {
    hookState.accounts = [
      { name: "Visa", statementDay: 16 },
      { name: "Mastercard", statementDay: 20 },
    ];
    hookState.transactions = new Map([
      ["Visa", { cycles: [], allTxs: [{
        key: "visa-transaction", date: "2026-10-11", account: "Visa", amount: 1,
        resolvedAmount: 1, currency: "PHP", targetAccount: "", type: "Expense",
        category: "Food", subcategory: "", budget: "", note: "",
      }] }],
      ["Mastercard", { cycles: [], allTxs: [{
        key: "mastercard-transaction", date: "2026-10-11", account: "Mastercard", amount: 2,
        resolvedAmount: 2, currency: "PHP", targetAccount: "", type: "Expense",
        category: "Food", subcategory: "", budget: "", note: "",
      }] }],
    ]);
    const user = userEvent.setup();

    function ViewerWithCardSelection() {
      const [accountName, setAccountName] = useState("Visa");
      return <CreditCardViewer accountName={accountName} privacyMode={false} onSelectCard={setAccountName} />;
    }

    render(<ViewerWithCardSelection />);

    await user.selectOptions(screen.getByLabelText("Selected credit card"), "Mastercard");
    expect(screen.getByLabelText("Selected credit card")).toHaveValue("Mastercard");
    await user.click(screen.getByRole("tab", { name: "All Transactions" }));
    await waitFor(() => expect(screen.getByTestId("transaction-list")).toHaveTextContent("mastercard-transaction"));
    expect(screen.getByTestId("transaction-list")).not.toHaveTextContent("visa-transaction");
  });
});
