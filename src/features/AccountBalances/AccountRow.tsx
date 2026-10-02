import type { AccountBalance } from "@/types/accounts";
import { formatCurrency } from "@/utils/currency";
import { ChevronRight } from "lucide-react";

const PRIVACY_MASK = "••••••";

interface AccountRowProps {
  account: AccountBalance;
  percentage: string;
  color: string;
  privacyMode: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export default function AccountRow({
  account,
  percentage,
  color,
  privacyMode,
  selected = false,
  onSelect,
}: AccountRowProps) {
  // PHP display (always shown)
  const phpDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.phpEquivalent, "PHP");

  // Native currency display — only shown when account is not PHP
  const showNative = account.currency !== "PHP";
  const nativeDisplay = privacyMode
    ? PRIVACY_MASK
    : formatCurrency(account.currentBalance, account.currency);

  return (
    <div
      role="option"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
      aria-selected={selected}
      aria-label={`View activity for ${account.name}`}
      title={`View activity for ${account.name}`}
      className={`group flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? "bg-accent ring-1 ring-accent/60" : "hover:bg-surface2"
      }`}
    >
      {/* Left: color-coded percentage (doubles as the color indicator, like the
          Transactions category list) + account name. */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-xs font-semibold tabular-nums min-w-[3rem] shrink-0"
          style={{ color }}
        >
          {privacyMode ? PRIVACY_MASK : `${percentage}%`}
        </span>
        <span className="text-sm text-text truncate">{account.name}</span>
      </div>

      {/* Right: balances */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex flex-col items-end text-right">
        <span className="text-sm text-text font-medium tabular-nums">
          {phpDisplay}
        </span>
        {showNative && (
          <span className="text-xs text-muted tabular-nums mt-0.5">
            {nativeDisplay}
          </span>
        )}
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted" aria-hidden="true">
          <span>View</span>
          <ChevronRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
      </div>
    </div>
  );
}
