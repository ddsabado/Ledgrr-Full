import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
import CreditCardUtilization from "@/features/CreditCardUtilization";
import Transactions from "@/features/Transactions";
import InstallmentsRecurring from "@/features/InstallmentsRecurring";
import Budgets from "@/features/Budgets";
import DebtsReceivables from "@/features/DebtsReceivables";

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [privacyMode, setPrivacyMode] = useState(false);

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
      <main className="flex-1 lg:overflow-hidden overflow-y-auto px-4 sm:px-6 py-6">
        <div className="lg:h-full mx-auto flex flex-col gap-6 lg:flex-row lg:overflow-x-auto lg:items-stretch scrollbar-gutter-stable [&>*]:lg:w-[24rem] [&>*]:lg:shrink-0">
          <AccountBalances privacyMode={privacyMode} />
          <CreditCardUtilization privacyMode={privacyMode} />
          <Transactions privacyMode={privacyMode} />
          <Budgets privacyMode={privacyMode} />
          <InstallmentsRecurring privacyMode={privacyMode} />
          <DebtsReceivables privacyMode={privacyMode} />
        </div>
      </main>
    </div>
  );
}
