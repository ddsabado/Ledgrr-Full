import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";

import type { CurrencyData } from "@/types/accounts";
import type { CCAccount, CCTransactionData } from "@/types/transactions";
import { NAV_TOGGLE_HOVER, NAV_TOGGLE_TAP } from "@/components/navToggle";
import CCCard from "./CCCard";

export interface CreditCardUtilizationCardProps {
  /** Credit-card accounts and activity already resolved by the caller. */
  accounts: CCAccount[];
  transactionsByAccount: ReadonlyMap<string, CCTransactionData>;
  /** FX data is intentionally caller-owned so this component is demo-safe. */
  fxMap: CurrencyData;
  /** Maps an account name to its already-resolved public card-art URL. */
  imageUrls?: Readonly<Record<string, string | null | undefined>>;
  privacyMode: boolean;
  viewerOpen?: boolean;
  selectedCard?: string | null;
  onSelectCard?: (name: string) => void;
  onToggleViewer?: () => void;
  onAddCreditCard?: () => void;
  onPay?: (account: CCAccount) => void;
}

/**
 * Data-source-free Credit Cards dashboard card.
 *
 * The authenticated feature supplies accounts, FX rates, and public image URLs;
 * this component owns only compact-card interaction state. It is safe to render
 * from static demo fixtures because it contains no auth, query, storage, or
 * mutation dependencies.
 */
export function CreditCardUtilizationCard({
  accounts,
  transactionsByAccount,
  fxMap,
  imageUrls = {},
  privacyMode,
  viewerOpen = false,
  selectedCard = null,
  onSelectCard = () => {},
  onToggleViewer = () => {},
  onAddCreditCard = () => {},
  onPay = () => {},
}: CreditCardUtilizationCardProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [cycleIndex, setCycleIndex] = useState<Record<string, number>>({});
  const [cycleView, setCycleView] = useState<"statement" | "all">("statement");
  const reduceMotion = useReducedMotion();
  const sorted = [...accounts].sort((a, b) => {
    if (a.daysUntilDue === null && b.daysUntilDue === null) return 0;
    if (a.daysUntilDue === null) return 1;
    if (b.daysUntilDue === null) return -1;
    return a.daysUntilDue - b.daysUntilDue;
  });
  const handleCycleViewChange = (view: "statement" | "all") => {
    setCycleView((previous) => (previous === view ? previous : view));
  };
  const toggleViewer = () => {
    if (!viewerOpen && sorted[0]) onSelectCard(sorted[0].name);
    setExpandedCard(null);
    onToggleViewer();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className={`rounded-xl bg-surface border border-border p-5 flex flex-col gap-4 min-h-0 overflow-hidden lg:max-h-none lg:h-full ${viewerOpen ? "h-full max-h-none" : "max-h-[calc(100vh-8rem)]"}`}
    >
      <div className="shrink-0 flex items-center justify-between gap-2">
        <p className="font-display text-xs font-semibold tracking-widest uppercase text-muted">Credit Cards</p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Add credit card" onClick={onAddCreditCard} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Settings aria-hidden="true" className="h-4 w-4" />
          </button>
          <motion.button type="button" aria-label={viewerOpen ? "Close credit card activity" : "View credit card activity"} title={viewerOpen ? "Close credit card activity" : "View credit card activity"} onClick={toggleViewer} whileHover={NAV_TOGGLE_HOVER} whileTap={NAV_TOGGLE_TAP} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <motion.span animate={{ rotate: viewerOpen ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }} className="flex">
              {viewerOpen ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />}
            </motion.span>
            <span className="flex min-w-0"><AnimatePresence initial={false} mode="wait"><motion.span key={viewerOpen ? "close-activity" : "view-activity"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeInOut" }} className="flex items-center whitespace-nowrap">{viewerOpen ? "Close activity" : "View activity"}</motion.span></AnimatePresence></span>
          </motion.button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pr-1 scrollbar-gutter-stable">
        {sorted.length === 0 ? <p className="py-6 text-center text-sm text-muted">No credit cards found.</p> : sorted.map((account) => (
          <CCCard key={account.name} account={account} txData={transactionsByAccount.get(account.name)} fxMap={fxMap} imageUrl={imageUrls[account.name]} privacyMode={privacyMode} isExpanded={expandedCard === account.name}
            onToggle={() => viewerOpen ? onSelectCard(account.name) : setExpandedCard(expandedCard === account.name ? null : account.name)} viewerOpen={viewerOpen} selected={selectedCard === account.name} cycleView={cycleView} onCycleViewChange={handleCycleViewChange} cycleIndex={cycleIndex[account.name] ?? 0} onCycleIndexChange={(index) => setCycleIndex((previous) => ({ ...previous, [account.name]: index }))} onPay={() => onPay(account)} />
        ))}
      </div>
    </motion.div>
  );
}

export default CreditCardUtilizationCard;
