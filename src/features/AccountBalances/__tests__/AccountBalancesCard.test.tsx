import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccountBalance } from "@/types/accounts";

const useAccountBalances = vi.fn();
vi.mock("@/hooks/useAccountBalances", () => ({ useAccountBalances }));

import AccountBalancesCard from "../AccountBalancesCard";

const accounts: AccountBalance[] = [
  {
    name: "Demo checking",
    category: "Cash",
    currency: "PHP",
    currentBalance: 1250,
    initialBalance: 0,
    creditLimit: 0,
    statementDay: null,
    dueDay: null,
    image: "",
    accountType: "Debit",
    phpEquivalent: 1250,
  },
];

describe("AccountBalancesCard", () => {
  it("renders fixture inventory without invoking the account-balance data hook", () => {
    render(<AccountBalancesCard accounts={accounts} privacyMode={false} />);

    expect(screen.getByRole("option", { name: "View activity for Demo checking" })).toBeInTheDocument();
    expect(screen.getAllByText("₱1,250.00")).toHaveLength(2);
    expect(useAccountBalances).not.toHaveBeenCalled();
  });
});
