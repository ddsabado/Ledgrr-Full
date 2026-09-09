import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import {
  NAV_TOGGLE_CLASS,
  NAV_TOGGLE_TEXT_CLASS,
  NAV_TOGGLE_HOVER,
  NAV_TOGGLE_TAP,
  NAV_ICON_SWAP,
} from "@/components/navToggle";
import AccountBalances from "@/features/AccountBalances";
import AccountViewer from "@/features/AccountBalances/AccountViewer";
import CreditCardUtilization from "@/features/CreditCardUtilization";
import Transactions from "@/features/Transactions";
import InstallmentsRecurring from "@/features/InstallmentsRecurring";
import Budgets from "@/features/Budgets";
import DebtsReceivables from "@/features/DebtsReceivables";

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [privacyMode, setPrivacyMode] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const layoutTransition = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 30 };

  return (
    <div className="h-screen overflow-hidden bg-bg flex flex-col">
      {/* Nav */}
      <nav
        role="navigation"
        className="shrink-0 bg-bg border-b border-border px-6 py-4 flex items-center justify-between"
      >
        <h1 className="font-display text-text font-bold tracking-tight">
          Ledgrr
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-muted text-sm hidden sm:block">
            {user?.email}
          </span>

          <ThemeSwitcher />

          {/* Privacy mode toggle — hover/press scale + rotating icon swap (SPA-matched) */}
          <motion.button
            onClick={() => setPrivacyMode((p) => !p)}
            aria-label={privacyMode ? "Show amounts" : "Hide amounts"}
            whileHover={NAV_TOGGLE_HOVER}
            whileTap={NAV_TOGGLE_TAP}
            className={NAV_TOGGLE_CLASS}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={privacyMode ? "hidden" : "visible"}
                {...NAV_ICON_SWAP}
                className="block"
              >
                {privacyMode ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>

          <motion.button
            onClick={signOut}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={NAV_TOGGLE_TEXT_CLASS}
          >
            Sign out
          </motion.button>
        </div>
      </nav>

      {/* Main content — panels keep a comfortable fixed width and the row
          scrolls horizontally on lg+ (overflowing to the right) rather than
          compressing. On < lg screens the panels stack in a single column. */}
      <main className="flex-1 min-h-0 lg:overflow-hidden overflow-y-auto px-4 sm:px-6 py-6">
        <LayoutGroup id="dashboard-cards">
          <div className={`mx-auto flex flex-col gap-6 lg:h-full lg:flex-row lg:overflow-x-auto lg:items-stretch scrollbar-gutter-stable ${viewerOpen ? 'h-full' : ''}`}>
            <div className={viewerOpen ? "flex h-full shrink-0 flex-col gap-6 lg:contents" : "contents"}>
              <motion.div layout transition={layoutTransition} className={viewerOpen ? "basis-1/3 shrink-0 min-h-0 lg:basis-auto lg:w-[24rem] lg:shrink-0" : "lg:w-[24rem] lg:shrink-0"}>
                <AccountBalances
                  privacyMode={privacyMode}
                  viewerOpen={viewerOpen}
                  selectedAccount={selectedAccount}
                  onSelectAccount={setSelectedAccount}
                  onToggleViewer={() => setViewerOpen((open) => !open)}
                />
              </motion.div>
              <AnimatePresence initial={false} mode="popLayout">
                {viewerOpen && selectedAccount && (
                  <motion.div
                    key="account-viewer"
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={layoutTransition}
                    className="flex-1 min-h-0 lg:flex-none lg:w-[34rem] lg:shrink-0"
                  >
                    <AccountViewer accountName={selectedAccount} privacyMode={privacyMode} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {[
              <CreditCardUtilization key="credit" privacyMode={privacyMode} />,
              <Transactions key="transactions" privacyMode={privacyMode} />,
              <Budgets key="budgets" privacyMode={privacyMode} />,
              <InstallmentsRecurring key="installments" privacyMode={privacyMode} />,
              <DebtsReceivables key="debts" privacyMode={privacyMode} />,
            ].map((card) => (
              <motion.div key={card.key} layout transition={layoutTransition} className="shrink-0 lg:w-[24rem]">{card}</motion.div>
            ))}
          </div>
        </LayoutGroup>
      </main>
    </div>
  );
}
