import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CreditCardUtilizationCard } from "../CreditCardUtilizationCard";
import cardSource from "../CreditCardUtilizationCard.tsx?raw";
import type { CCAccount } from "@/types/transactions";

vi.mock("../TransactionList", () => ({
  default: () => <div data-testid="credit-card-transactions" />,
}));

const account: CCAccount = {
  name: "Fixture Visa",
  category: "Credit Cards",
  accountType: "Credit",
  currency: "PHP",
  currentBalance: 1000,
  initialBalance: 0,
  creditLimit: 5000,
  statementDay: 5,
  dueDay: 25,
  image: "fixture-card.png",
  phpEquivalent: 1000,
  utilization: 20,
  daysUntilDue: 3,
};

describe("CreditCardUtilizationCard", () => {
  it("renders static fixture props without data hooks and forwards dashboard actions", async () => {
    const user = userEvent.setup();
    const onAddCreditCard = vi.fn();
    const onPay = vi.fn();
    const onToggleViewer = vi.fn();
    const onSelectCard = vi.fn();
    const { container } = render(
      <CreditCardUtilizationCard
        accounts={[account]}
        transactionsByAccount={new Map()}
        fxMap={{ PHP: 1 }}
        imageUrls={{ [account.name]: "https://example.test/fixture-card.png" }}
        privacyMode={false}
        onAddCreditCard={onAddCreditCard}
        onPay={onPay}
        onToggleViewer={onToggleViewer}
        onSelectCard={onSelectCard}
      />,
    );

    expect(screen.getByText("Fixture Visa")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.test/fixture-card.png");
    await user.click(screen.getByRole("button", { name: "Add credit card" }));
    await user.click(screen.getByRole("button", { name: "Pay" }));
    await user.click(screen.getByRole("button", { name: "View credit card activity" }));
    expect(onAddCreditCard).toHaveBeenCalledOnce();
    expect(onPay).toHaveBeenCalledWith(account);
    expect(onSelectCard).toHaveBeenCalledWith(account.name);
    expect(onToggleViewer).toHaveBeenCalledOnce();
  });

  it("keeps the exported presentation component free of data, auth, storage, and mutation imports", () => {
    expect(cardSource).not.toMatch(/useCurrencies|useAuth|getAccountImageUrl|supabase|services\/|collections\/|useCCAccounts|useCCTransactions/);
  });
});
