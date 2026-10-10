import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CreditCardViewer from "../CreditCardViewer";

vi.mock("@/hooks/useCCAccounts", () => ({
  useCCAccounts: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useCCTransactions", () => ({
  useCCTransactions: () => ({ data: new Map(), isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useCurrencies", () => ({
  useCurrencies: () => ({ data: { PHP: 1 }, isLoading: false, isError: false }),
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
});
