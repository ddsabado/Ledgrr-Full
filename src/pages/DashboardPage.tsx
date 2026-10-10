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
  const [accountReturning, setAccountReturning] = useState(false);
  const [focusedDesktopViewer, setFocusedDesktopViewer] = useState<
    "account" | "credit-card" | "installments" | "debts" | null
  >(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [creditCardViewerOpen, setCreditCardViewerOpen] = useState(false);
  const [creditCardReturning, setCreditCardReturning] = useState(false);
  const [selectedCreditCard, setSelectedCreditCard] = useState<string | null>(
    null,
  );
  const [installmentsViewerOpen, setInstallmentsViewerOpen] = useState(false);
  const [installmentsReturning, setInstallmentsReturning] = useState(false);
  const [debtsViewerOpen, setDebtsViewerOpen] = useState(false);
  const [debtsReturning, setDebtsReturning] = useState(false);
  const [selectedDebtRecord, setSelectedDebtRecord] = useState<string | null>(
    null,
  );
  const reduceMotion = useReducedMotion();
  const isMobileViewport = useMobileViewport();
  const mainRef = useRef<HTMLElement>(null);
  const dashboardCardsRef = useRef<HTMLDivElement>(null);
  const accountBalancesRef = useRef<HTMLDivElement>(null);
  const creditCardsRef = useRef<HTMLDivElement>(null);
  const installmentsRef = useRef<HTMLDivElement>(null);
  const debtsRef = useRef<HTMLDivElement>(null);
  const restoreCreditCardPosition = useRef(false);
  const restoreInstallmentsPosition = useRef(false);
  const restoreDebtsPosition = useRef(false);
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 30 };
  const mobileSlideTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };
  // Desktop viewers keep their own, slightly longer slide so the horizontal
  // dashboard lane remains legible without changing the mobile baseline.
  const desktopViewerTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const };
  // A desktop source card is 24rem wide with a 1.5rem lane gap, while its
  // viewer is 34rem. Moving the viewer 75% left aligns it over the source
  // card before it travels into its adjacent resting place.
  const desktopViewerOrigin = { x: "-75%" };
  const mobileViewerOpen =
    viewerOpen ||
    creditCardViewerOpen ||
    creditCardReturning ||
    installmentsViewerOpen ||
    installmentsReturning ||
    debtsViewerOpen ||
    debtsReturning;
  const mobileDetailViewerOpen =
    isMobileViewport &&
    (
      viewerOpen ||
      creditCardViewerOpen ||
      creditCardReturning ||
      installmentsViewerOpen ||
      installmentsReturning ||
      debtsViewerOpen ||
      debtsReturning
    );
  const toggleAccountViewer = () => {
    setViewerOpen((open) => {
      if (open && !isMobileViewport) {
        setAccountReturning(true);
        setFocusedDesktopViewer(null);
      } else if (!isMobileViewport) {
        setFocusedDesktopViewer("account");
      }
      return !open;
    });
  };

  const finishAccountReturn = () => {
    if (accountReturning) setAccountReturning(false);
  };

  const toggleCreditCardViewer = () => {
    setCreditCardViewerOpen((open) => {
      if (open && !isMobileViewport) {
        setCreditCardReturning(true);
        setFocusedDesktopViewer(null);
      } else if (!isMobileViewport) {
        setFocusedDesktopViewer("credit-card");
      }
      return !open;
    });
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
    restorePosition(
      installmentsReturning,
      restoreInstallmentsPosition,
      installmentsRef,
    );
    restorePosition(debtsReturning, restoreDebtsPosition, debtsRef);
  }, [creditCardReturning, debtsReturning, installmentsReturning, isMobileViewport]);

  useLayoutEffect(() => {
    if (isMobileViewport) return;

    const activeLane = focusedDesktopViewer === "account" && viewerOpen
      ? accountBalancesRef.current
      : focusedDesktopViewer === "credit-card" && creditCardViewerOpen
        ? creditCardsRef.current
        : focusedDesktopViewer === "installments" && installmentsViewerOpen
          ? installmentsRef.current
          : focusedDesktopViewer === "debts" && debtsViewerOpen
            ? debtsRef.current
            : null;
    const dashboardCards = dashboardCardsRef.current;
    if (!activeLane || !dashboardCards) return;

    const frame = requestAnimationFrame(() => {
      // The detail panel is rendered in the same horizontal lane as its card.
      // Center the pair when it fits; otherwise anchor its original card at the
      // left edge so the viewer begins immediately beside it.
      const laneLeft = activeLane.offsetLeft;
      const laneWidth = activeLane.offsetWidth;
      const visibleWidth = dashboardCards.clientWidth;
      const maxScrollLeft = dashboardCards.scrollWidth - visibleWidth;
      const targetScrollLeft = laneWidth <= visibleWidth
        ? laneLeft - (visibleWidth - laneWidth) / 2
        : laneLeft;
      const scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

      if (typeof dashboardCards.scrollTo === "function") {
        dashboardCards.scrollTo({
          left: scrollLeft,
          behavior: reduceMotion ? "auto" : "smooth",
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [
    creditCardViewerOpen,
    debtsViewerOpen,
    focusedDesktopViewer,
    installmentsViewerOpen,
    isMobileViewport,
    reduceMotion,
    viewerOpen,
  ]);

  const toggleInstallmentsViewer = () => {
    setInstallmentsViewerOpen((open) => {
      if (open && !isMobileViewport) {
        setInstallmentsReturning(true);
        setFocusedDesktopViewer(null);
      } else if (!isMobileViewport) {
        setFocusedDesktopViewer("installments");
      }
      return !open;
    });
  };

  const finishInstallmentsReturn = () => {
    if (installmentsReturning) {
      setInstallmentsReturning(false);
    }
  };

  const toggleDebtsViewer = () => {
    setDebtsViewerOpen((open) => {
      if (open && !isMobileViewport) {
        setDebtsReturning(true);
        setFocusedDesktopViewer(null);
      } else if (!isMobileViewport) {
        setFocusedDesktopViewer("debts");
      }
      return !open;
    });
  };

  const finishDebtsReturn = () => {
    if (debtsReturning) {
      setDebtsReturning(false);
    }
  };

  const finishMobileViewerReturn = () => {
    finishCreditCardReturn();
    finishInstallmentsReturn();
    finishDebtsReturn();
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
          <motion.div
            ref={dashboardCardsRef}
            // Move past the viewport edge so the outgoing card plate never
            // visually touches the incoming viewer.
            animate={isMobileViewport ? { x: mobileDetailViewerOpen ? "-110%" : 0 } : { x: 0 }}
            transition={
              isMobileViewport
                ? mobileSlideTransition
                : { duration: 0 }
            }
            className="mx-auto flex flex-col gap-6 lg:h-full lg:flex-row lg:overflow-x-auto lg:items-stretch scrollbar-gutter-stable"
          >
            <div
              ref={accountBalancesRef}
              className={
                !isMobileViewport && (viewerOpen || accountReturning)
                  ? "relative h-full min-h-0 flex-none lg:flex lg:w-[59.5rem] lg:shrink-0 lg:gap-6 lg:overflow-hidden"
                  : "relative lg:contents"
              }
            >
              <motion.div
                layout={!isMobileViewport}
                animate={{ x: 0 }}
                transition={
                  isMobileViewport
                    ? mobileSlideTransition
                    : layoutTransition
                }
                className={
                  viewerOpen
                    ? "h-full min-h-0 lg:relative lg:z-10 lg:w-[24rem] lg:shrink-0"
                    : "lg:relative lg:z-10 lg:w-[24rem] lg:shrink-0"
                }
              >
                <AccountBalances
                  privacyMode={privacyMode}
                  viewerOpen={!isMobileViewport && viewerOpen}
                  selectedAccount={selectedAccount}
                  onSelectAccount={setSelectedAccount}
                  onToggleViewer={toggleAccountViewer}
                />
              </motion.div>
              <AnimatePresence
                initial={false}
                mode="popLayout"
                onExitComplete={finishAccountReturn}
              >
                {viewerOpen && selectedAccount && !isMobileViewport && (
                  <motion.div
                    key="account-viewer"
                    layout={false}
                    initial={
                      reduceMotion
                        ? false
                        : isMobileViewport
                          ? { x: "200%" }
                          : desktopViewerOrigin
                    }
                    animate={isMobileViewport ? { x: "100%" } : { x: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : isMobileViewport
                          ? { x: "200%" }
                          : { x: "-105%" }
                    }
                    transition={isMobileViewport ? mobileSlideTransition : desktopViewerTransition}
                    className="absolute inset-0 z-10 h-full min-h-0 lg:static lg:z-0 lg:h-full lg:flex-none lg:w-[34rem] lg:shrink-0"
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
                !isMobileViewport && (creditCardViewerOpen || creditCardReturning)
                  ? "relative h-full min-h-0 flex-none lg:flex lg:w-[59.5rem] lg:shrink-0 lg:gap-6 lg:overflow-hidden"
                  : "relative lg:contents"
              }
            >
              <motion.div
                layout={!isMobileViewport}
                animate={{ x: 0 }}
                transition={
                  isMobileViewport
                    ? mobileSlideTransition
                    : layoutTransition
                }
                className={
                  creditCardViewerOpen || creditCardReturning
                    ? "h-full min-h-0 lg:relative lg:z-10 lg:w-[24rem] lg:shrink-0"
                    : "lg:relative lg:z-10 lg:w-[24rem] lg:shrink-0"
                }
              >
                <CreditCardUtilization
                  privacyMode={privacyMode}
                  viewerOpen={!isMobileViewport && creditCardViewerOpen}
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
                {creditCardViewerOpen && selectedCreditCard && !isMobileViewport && (
                  <motion.div
                    key="credit-card-viewer"
                    layout={false}
                    initial={
                      reduceMotion
                        ? false
                        : isMobileViewport
                          ? { x: "200%" }
                          : desktopViewerOrigin
                    }
                    animate={isMobileViewport ? { x: "100%" } : { x: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : isMobileViewport
                          ? { x: "200%" }
                          : { x: "-105%" }
                    }
                    transition={isMobileViewport ? mobileSlideTransition : desktopViewerTransition}
                    className="absolute inset-0 z-10 min-h-0 lg:static lg:z-0 lg:flex-none lg:w-[34rem] lg:shrink-0"
                  >
                    <CreditCardViewer
                      accountName={selectedCreditCard}
                      privacyMode={privacyMode}
                      onClose={toggleCreditCardViewer}
                      onSelectCard={setSelectedCreditCard}
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
                // The mobile dashboard moves as one plate. Per-card layout
                // animation here makes cards visibly reassemble after a
                // viewer closes.
                layout={!isMobileViewport}
                transition={layoutTransition}
                className="shrink-0 lg:w-[24rem]"
              >
                {card}
              </motion.div>
            ))}
            <div
              ref={installmentsRef}
              className={
                !isMobileViewport && (installmentsViewerOpen || installmentsReturning)
                    ? "absolute inset-x-4 top-6 z-10 min-h-0 flex-none sm:inset-x-6 lg:relative lg:inset-auto lg:z-auto lg:flex lg:h-full lg:w-[59.5rem] lg:shrink-0 lg:gap-6 lg:overflow-hidden"
                    : "relative lg:contents"
              }
            >
              <motion.div
                layout={!isMobileViewport}
                animate={{ x: 0 }}
                transition={
                  isMobileViewport
                    ? mobileSlideTransition
                    : layoutTransition
                }
                className={
                  !isMobileViewport && (installmentsViewerOpen || installmentsReturning)
                    ? "h-full min-h-0 lg:relative lg:z-10 lg:w-[24rem] lg:shrink-0"
                    : "lg:relative lg:z-10 lg:w-[24rem] lg:shrink-0"
                }
              >
                <InstallmentsRecurring
                  privacyMode={privacyMode}
                  viewerOpen={!isMobileViewport && installmentsViewerOpen}
                  onToggleViewer={toggleInstallmentsViewer}
                />
              </motion.div>
              <AnimatePresence
                initial={false}
                mode="popLayout"
                onExitComplete={finishInstallmentsReturn}
              >
                {installmentsViewerOpen && !isMobileViewport && (
                  <motion.div
                    key="installments-viewer"
                    layout={false}
                    initial={
                      reduceMotion
                        ? false
                        : isMobileViewport
                          ? { x: "200%" }
                          : desktopViewerOrigin
                    }
                    animate={isMobileViewport ? { x: "100%" } : { x: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : isMobileViewport
                          ? { x: "200%" }
                          : { x: "-105%" }
                    }
                    transition={isMobileViewport ? mobileSlideTransition : desktopViewerTransition}
                    className="absolute inset-0 z-10 min-h-0 lg:static lg:z-0 lg:flex-none lg:w-[34rem] lg:shrink-0"
                  >
                    <InstallmentsViewer
                      privacyMode={privacyMode}
                      onClose={toggleInstallmentsViewer}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div
              ref={debtsRef}
              className={
                !isMobileViewport && (debtsViewerOpen || debtsReturning)
                    ? "absolute inset-x-4 top-6 z-10 min-h-0 flex-none sm:inset-x-6 lg:relative lg:inset-auto lg:z-auto lg:flex lg:h-full lg:w-[59.5rem] lg:shrink-0 lg:gap-6 lg:overflow-hidden"
                    : "relative lg:contents"
              }
            >
              <motion.div
                layout={!isMobileViewport}
                animate={{ x: 0 }}
                transition={
                  isMobileViewport
                    ? mobileSlideTransition
                    : layoutTransition
                }
                className={
                  !isMobileViewport && (debtsViewerOpen || debtsReturning)
                    ? "h-full min-h-0 lg:relative lg:z-10 lg:w-[24rem] lg:shrink-0"
                    : "lg:relative lg:z-10 lg:w-[24rem] lg:shrink-0"
                }
              >
                <DebtsReceivables
                  privacyMode={privacyMode}
                  viewerOpen={!isMobileViewport && debtsViewerOpen}
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
                {debtsViewerOpen && !isMobileViewport && (
                  <motion.div
                    key="debts-receivables-viewer"
                    layout={false}
                    initial={
                      reduceMotion
                        ? false
                        : isMobileViewport
                          ? { x: "200%" }
                          : desktopViewerOrigin
                    }
                    animate={isMobileViewport ? { x: "100%" } : { x: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : isMobileViewport
                          ? { x: "200%" }
                          : { x: "-105%" }
                    }
                    transition={isMobileViewport ? mobileSlideTransition : desktopViewerTransition}
                    className="absolute inset-0 z-10 min-h-0 lg:static lg:z-0 lg:flex-none lg:w-[34rem] lg:shrink-0"
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
          </motion.div>
        </LayoutGroup>
        <AnimatePresence initial={false} onExitComplete={finishMobileViewerReturn}>
            {isMobileViewport && viewerOpen && selectedAccount && (
              <motion.div
                key="mobile-account-viewer"
                initial={reduceMotion ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                transition={mobileSlideTransition}
                className="fixed inset-x-4 top-20 bottom-6 z-50 min-h-0 sm:inset-x-6"
              >
                <AccountViewer
                  accountName={selectedAccount}
                  privacyMode={privacyMode}
                  onClose={toggleAccountViewer}
                />
              </motion.div>
            )}
            {isMobileViewport && creditCardViewerOpen && selectedCreditCard && (
              <motion.div
                key="mobile-credit-card-viewer"
                initial={reduceMotion ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                transition={mobileSlideTransition}
                className="fixed inset-x-4 top-20 bottom-6 z-50 min-h-0 sm:inset-x-6"
              >
                <CreditCardViewer
                  accountName={selectedCreditCard}
                  privacyMode={privacyMode}
                  onClose={toggleCreditCardViewer}
                  onSelectCard={setSelectedCreditCard}
                />
              </motion.div>
            )}
            {isMobileViewport && installmentsViewerOpen && (
              <motion.div
                key="mobile-installments-viewer"
                initial={reduceMotion ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                transition={mobileSlideTransition}
                className="fixed inset-x-4 top-20 bottom-6 z-50 min-h-0 sm:inset-x-6"
              >
                <InstallmentsViewer
                  privacyMode={privacyMode}
                  onClose={toggleInstallmentsViewer}
                />
              </motion.div>
            )}
            {isMobileViewport && debtsViewerOpen && (
              <motion.div
                key="mobile-debts-receivables-viewer"
                initial={reduceMotion ? false : { x: "100%" }}
                animate={{ x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                transition={mobileSlideTransition}
                className="fixed inset-x-4 top-20 bottom-6 z-50 min-h-0 sm:inset-x-6"
              >
                <DebtsandReceivablesViewer
                  privacyMode={privacyMode}
                  selectedRecord={selectedDebtRecord}
                  onClose={toggleDebtsViewer}
                />
              </motion.div>
            )}
        </AnimatePresence>
      </main>
    </div>
  );
}
