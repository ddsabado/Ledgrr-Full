import { useAccountBalances } from "@/hooks/useAccountBalances";
import AccountBalancesCard from "./AccountBalancesCard";

export interface AccountBalancesProps {
  privacyMode: boolean;
  viewerOpen?: boolean;
  selectedAccount?: string | null;
  onSelectAccount?: (name: string) => void;
  onToggleViewer?: () => void;
}

/** Authenticated data wrapper for the Account Balances card. */
export default function AccountBalances({
  privacyMode,
  viewerOpen = false,
  selectedAccount = null,
  onSelectAccount = () => {},
  onToggleViewer = () => {},
}: AccountBalancesProps) {
  const { data, isLoading, isError } = useAccountBalances();

  if (isLoading) {
    return (
      <div aria-busy="true" className="rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden max-h-[calc(100vh-8rem)] lg:max-h-none lg:h-full">
        <p role="status" aria-live="polite" className="sr-only">Loading account balances.</p>
        <div className="h-3 w-32 bg-surface2 rounded animate-pulse" />
        <div className="h-48 bg-surface2 rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center gap-3">
            <div className="h-3 w-24 bg-surface2 rounded animate-pulse" />
            <div className="h-3 w-16 bg-surface2 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5">
        <p role="alert" className="text-sm text-muted text-center">
          Could not load account balances. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <AccountBalancesCard
      accounts={data}
      privacyMode={privacyMode}
      viewerOpen={viewerOpen}
      selectedAccount={selectedAccount}
      onSelectAccount={onSelectAccount}
      onToggleViewer={onToggleViewer}
    />
  );
}

export { default as AccountBalancesCard } from "./AccountBalancesCard";
