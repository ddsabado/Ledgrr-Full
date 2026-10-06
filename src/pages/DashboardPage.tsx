import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useReducedMotion,
} from "motion/react";
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
import CreditCardViewer from "@/features/CreditCardUtilization/CreditCardViewer";
import Transactions from "@/features/Transactions";
import InstallmentsRecurring from "@/features/InstallmentsRecurring";
import InstallmentsViewer from "@/features/InstallmentsRecurring/InstallmentsViewer";
import Budgets from "@/features/Budgets";
import DebtsReceivables from "@/features/DebtsReceivables";
import DebtsandReceivablesViewer from "@/features/DebtsReceivables/DebtsandReceivablesViewer";

const MOBILE_QUERY = "(max-width: 1023px)";

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return isMobile;
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [privacyMode, setPrivacyMode] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [creditCardViewerOpen, setCreditCardViewerOpen] = useState(false);
  const [creditCardReturning, setCreditCardReturning] = useState(false);
  const [selectedCreditCard, setSelectedCreditCard] = useState<string | null>(
    null,
  );
  const [installmentsViewerOpen, setInstallmentsViewerOpen] = useState(false);
  const [debtsViewerOpen, setDebtsViewerOpen] = useState(false);
  const [debtsReturning, setDebtsReturning] = useState(false);
  const [debtsViewerHeight, setDebtsViewerHeight] = useState<number | null>(null);
  const [selectedDebtRecord, setSelectedDebtRecord] = useState<string | null>(
    null,
  );
  const reduceMotion = useReducedMotion();
  const isMobileViewport = useMobileViewport();
  const mainRef = useRef<HTMLElement>(null);
  const creditCardsRef = useRef<HTMLDivElement>(null);
  const debtsRef = useRef<HTMLDivElement>(null);
  const debtsCardRef = useRef<HTMLDivElement>(null);
  const restoreCreditCardPosition = useRef(false);
  const restoreDebtsPosition = useRef(false);
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 30 };
  const mobileSlideTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };
  const mobileViewerOpen =
    viewerOpen ||
    creditCardViewerOpen ||
    creditCardReturning ||
    installmentsViewerOpen ||
    debtsViewerOpen ||
    debtsReturning;
  const toggleAccountViewer = () => setViewerOpen((open) => !open);

  const toggleCreditCardViewer = () => {
    if (creditCardViewerOpen) {
      // Keep this lane active until the outgoing viewer has slid away.
      restoreCreditCardPosition.current = true;
      setCreditCardReturning(true);
      setCreditCardViewerOpen(false);
      return;
    }

    setCreditCardViewerOpen(true);
  };

  const finishCreditCardReturn = () => {
    if (creditCardReturning) setCreditCardReturning(false);
  };

  useLayoutEffect(() => {
    if (!isMobileViewport || !mainRef.current) return;

    const restorePosition = (
      returning: boolean,
      shouldRestore: React.MutableRefObject<boolean>,
      lane: React.RefObject<HTMLDivElement | null>,
    ) => {
      if (returning || !shouldRestore.current || !lane.current) return;

      // Restore the normal stack before paint so returning to a detail lane
      // never exposes an unrelated card or visibly scrolls the dashboard.
      const main = mainRef.current;
      if (!main) return;
      const cardTop = lane.current.getBoundingClientRect().top;
      const mainTop = main.getBoundingClientRect().top;
      const paddingTop = Number.parseFloat(getComputedStyle(main).paddingTop) || 0;
      main.scrollTop += cardTop - mainTop - paddingTop;
      shouldRestore.current = false;
    };

    restorePosition(
      creditCardReturning,
      restoreCreditCardPosition,
      creditCardsRef,
    );
    restorePosition(debtsReturning, restoreDebtsPosition, debtsRef);
  }, [creditCardReturning, debtsReturning, isMobileViewport]);

  const toggleInstallmentsViewer = () => {
    setInstallmentsViewerOpen((open) => !open);
  };

  const toggleDebtsViewer = () => {
    if (debtsViewerOpen) {
      // Keep the source lane mounted until its viewer finishes sliding away.
      restoreDebtsPosition.current = true;
      setDebtsReturning(true);
      setDebtsViewerOpen(false);
      return;
    }

    // Preserve the source card's height for the mobile detail lane. This
    // prevents the viewer from growing taller than the card it replaces.
    if (isMobileViewport && debtsCardRef.current) {
      setDebtsViewerHeight(debtsCardRef.current.getBoundingClientRect().height);
    }
    setDebtsViewerOpen(true);
  };

  const finishDebtsReturn = () => {
    if (debtsReturning) {
      setDebtsReturning(false);
      setDebtsViewerHeight(null);
    }
  };

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
      <main ref={mainRef} className={`relative flex-1 min-h-0 px-4 sm:px-6 py-6 lg:overflow-hidden ${mobileViewerOpen ? "overflow-hidden" : "overflow-y-auto"}`}>
        <LayoutGroup id="dashboard-cards">
          <div
            className={`mx-auto flex flex-col gap-6 lg:h-full lg:flex-row lg:overflow-x-auto lg:items-stretch scrollbar-gutter-stable ${mobileViewerOpen ? "h-full" : ""} ${mobileViewerOpen ? "overflow-hidden" : ""}`}
          >
            <div
              className={
                creditCardViewerOpen || creditCardReturning || debtsViewerOpen || debtsReturning
                  ? "hidden lg:contents"
                  : viewerOpen
                  ? "relative h-full min-h-0 flex-none lg:flex lg:shrink-0 lg:gap-6"
                  : "relative lg:contents"
              }
            >
              <motion.div
                layout={!isMobileViewport}
                animate={isMobileViewport ? { x: viewerOpen ? "-100%" : 0 } : { x: 0 }}
                transition={
                  isMobileViewport
                    ? mobileSlideTransition
                    : layoutTransition
                }
                className={
                  viewerOpen
                    ? "h-full min-h-0 lg:w-[24rem] lg:shrink-0"
                    : "lg:w-[24rem] lg:shrink-0"
                }
              >
                <AccountBalances
                  privacyMode={privacyMode}
                  viewerOpen={viewerOpen}
                  selectedAccount={selectedAccount}
                  onSelectAccount={setSelectedAccount}
                  onToggleViewer={toggleAccountViewer}
                />
              </motion.div>
              <AnimatePresence initial={false} mode="popLayout">
                {viewerOpen && selectedAccount && (
                  <motion.div
                    key="account-viewer"
                    layout={!isMobileViewport}
                    initial={
                      reduceMotion
                        ? false
                        : isMobileViewport
                          ? { x: "100%" }
                          : { opacity: 0, y: -8 }
                    }
                    animate={isMobileViewport ? { x: 0 } : { opacity: 1, y: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : isMobileViewport
                          ? { x: "100%" }
                          : { opacity: 0, y: -8 }
                    }
                    transition={isMobileViewport ? mobileSlideTransition : layoutTransition}
                    className="absolute inset-0 z-10 h-full min-h-0 lg:static lg:h-full lg:flex-none lg:w-[34rem] lg:shrink-0"
                  >
                    <AccountViewer
                      accountName={selectedAccount}
                      privacyMode={privacyMode}
                      onClose={toggleAccountViewer}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div
              ref={creditCardsRef}
              className={
                viewerOpen || debtsViewerOpen || debtsReturning
                  ? "hidden lg:contents"
                  : creditCardViewerOpen || creditCardReturning
                  ? "relative h-full min-h-0 flex-none lg:flex lg:shrink-0 lg:gap-6"
                  : "relative lg:contents"
              }
            >
              <motion.div
                layout={!isMobileViewport}
                animate={isMobileViewport ? { x: creditCardViewerOpen ? "-100%" : 0 } : { x: 0 }}
                transition={
                  isMobileViewport
                    ? mobileSlideTransition
                    : layoutTransition
                }
                className={
                  creditCardViewerOpen || creditCardReturning
                    ? "h-full min-h-0 lg:w-[24rem] lg:shrink-0"
                    : "lg:w-[24rem] lg:shrink-0"
                }
              >
                <CreditCardUtilization
                  privacyMode={privacyMode}
                  viewerOpen={creditCardViewerOpen}
                  selectedCard={selectedCreditCard}
                  onSelectCard={setSelectedCreditCard}
                  onToggleViewer={toggleCreditCardViewer}
                />
              </motion.div>
              <AnimatePresence
                initial={false}
                mode="popLayout"
                onExitComplete={finishCreditCardReturn}
              >
                {creditCardViewerOpen && selectedCreditCard && (
                  <motion.div
                    key="credit-card-viewer"
                    layout={!isMobileViewport}
                    initial={
                      reduceMotion
                        ? false
                        : isMobileViewport
                          ? { x: "100%" }
                          : { opacity: 0, y: -8 }
                    }
                    animate={isMobileViewport ? { x: 0 } : { opacity: 1, y: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : isMobileViewport
                          ? { x: "100%" }
                          : { opacity: 0, y: -8 }
                    }
                    transition={isMobileViewport ? mobileSlideTransition : layoutTransition}
                    className="absolute inset-0 z-10 min-h-0 lg:static lg:flex-none lg:w-[34rem] lg:shrink-0"
                  >
                    <CreditCardViewer
                      accountName={selectedCreditCard}
                      privacyMode={privacyMode}
                      onClose={toggleCreditCardViewer}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {[
              <Transactions key="transactions" privacyMode={privacyMode} />,
              <Budgets key="budgets" privacyMode={privacyMode} />,
            ].map((card) => (
              <motion.div
                key={card.key}
                layout
                transition={layoutTransition}
                className={`${debtsViewerOpen || debtsReturning ? "hidden lg:block" : ""} shrink-0 lg:w-[24rem]`}
              >
                {card}
              </motion.div>
            ))}
            <div
              className={
                debtsViewerOpen || debtsReturning
                  ? "hidden lg:contents"
                  : installmentsViewerOpen
                  ? "flex h-full shrink-0 flex-col gap-6 lg:flex-row"
                  : "contents"
              }
            >
              <motion.div
                layout
                transition={layoutTransition}
                className={
                  installmentsViewerOpen
                    ? "basis-[45%] shrink-0 min-h-0 lg:basis-auto lg:w-[24rem] lg:shrink-0"
                    : "lg:w-[24rem] lg:shrink-0"
                }
              >
                <InstallmentsRecurring
                  privacyMode={privacyMode}
                  viewerOpen={installmentsViewerOpen}
                  onToggleViewer={toggleInstallmentsViewer}
                />
              </motion.div>
              <AnimatePresence initial={false} mode="popLayout">
                {installmentsViewerOpen && (
                  <motion.div
                    key="installments-viewer"
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={layoutTransition}
                    className="flex-1 min-h-0 lg:flex-none lg:w-[34rem] lg:shrink-0"
                  >
                    <InstallmentsViewer privacyMode={privacyMode} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div
              ref={debtsRef}
              className={
                viewerOpen || creditCardViewerOpen || creditCardReturning
                  ? "hidden lg:contents"
                  : debtsViewerOpen || debtsReturning
                    ? "absolute inset-x-4 top-6 z-10 min-h-0 flex-none overflow-hidden sm:inset-x-6 lg:relative lg:inset-auto lg:z-auto lg:flex lg:h-full lg:shrink-0 lg:gap-6 lg:overflow-visible"
                    : "relative lg:contents"
              }
              style={
                isMobileViewport && debtsViewerHeight !== null
                  ? { height: debtsViewerHeight }
                  : undefined
              }
            >
              <motion.div
                ref={debtsCardRef}
                layout={!isMobileViewport}
                animate={isMobileViewport ? { x: debtsViewerOpen ? "-100%" : 0 } : { x: 0 }}
                transition={
                  isMobileViewport
                    ? mobileSlideTransition
                    : layoutTransition
                }
                className={
                  debtsViewerOpen || debtsReturning
                    ? "h-full min-h-0 lg:w-[24rem] lg:shrink-0"
                    : "lg:w-[24rem] lg:shrink-0"
                }
              >
                <DebtsReceivables
                  privacyMode={privacyMode}
                  viewerOpen={debtsViewerOpen}
                  selectedRecord={selectedDebtRecord}
                  onSelectRecord={setSelectedDebtRecord}
                  onToggleViewer={toggleDebtsViewer}
                />
              </motion.div>
              <AnimatePresence
                initial={false}
                mode="popLayout"
                onExitComplete={finishDebtsReturn}
              >
                {debtsViewerOpen && (
                  <motion.div
                    key="debts-receivables-viewer"
                    layout={!isMobileViewport}
                    initial={
                      reduceMotion
                        ? false
                        : isMobileViewport
                          ? { x: "100%" }
                          : { opacity: 0, y: -8 }
                    }
                    animate={isMobileViewport ? { x: 0 } : { opacity: 1, y: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : isMobileViewport
                          ? { x: "100%" }
                          : { opacity: 0, y: -8 }
                    }
                    transition={isMobileViewport ? mobileSlideTransition : layoutTransition}
                    className="absolute inset-0 z-10 min-h-0 lg:static lg:flex-none lg:w-[34rem] lg:shrink-0"
                  >
                    <DebtsandReceivablesViewer
                      privacyMode={privacyMode}
                      selectedRecord={selectedDebtRecord}
                      onClose={toggleDebtsViewer}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </LayoutGroup>
      </main>
    </div>
  );
}
