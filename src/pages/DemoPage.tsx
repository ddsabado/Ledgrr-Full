import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'

import ThemeSwitcher from '@/components/ThemeSwitcher'
import { NAV_TOGGLE_CLASS, NAV_TOGGLE_TEXT_CLASS } from '@/components/navToggle'
import { AccountBalancesCard } from '@/features/AccountBalances'
import AccountViewer from '@/features/AccountBalances/AccountViewer'
import { BudgetsCard } from '@/features/Budgets'
import CreditCardUtilizationCard from '@/features/CreditCardUtilization/CreditCardUtilizationCard'
import CreditCardViewer from '@/features/CreditCardUtilization/CreditCardViewer'
import { DebtsReceivablesCard } from '@/features/DebtsReceivables'
import DebtsandReceivablesViewer from '@/features/DebtsReceivables/DebtsandReceivablesViewer'
import { InstallmentsRecurringCard } from '@/features/InstallmentsRecurring'
import InstallmentsViewer from '@/features/InstallmentsRecurring/InstallmentsViewer'
import { TransactionsCard } from '@/features/Transactions'
import {
  demoAccounts,
  demoAccountTransactionsByAccount,
  demoBudgetRows,
  demoCreditCards,
  demoCreditCardTransactionsByAccount,
  demoDebtViews,
  demoFxMap,
  demoGroupedTransactions,
  demoInstallmentActivityItems,
  demoMonth,
  getDemoMonthResult,
} from '@/demo/fixtures'

type Viewer = 'account' | 'credit-card' | 'installments' | 'debts' | null
const MOBILE_QUERY = '(max-width: 1023px)'

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.(MOBILE_QUERY).matches ?? false)

  useEffect(() => {
    const query = window.matchMedia?.(MOBILE_QUERY)
    if (!query) return
    const update = () => setIsMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return isMobile
}

/** Public, deliberately read-only dashboard backed only by local fixtures. */
export default function DemoPage() {
  const [privacyMode, setPrivacyMode] = useState(false)
  const [activeViewer, setActiveViewer] = useState<Viewer>(null)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [selectedCreditCard, setSelectedCreditCard] = useState<string | null>(null)
  const [selectedDebtRecord, setSelectedDebtRecord] = useState<string | null>(null)
  const [unavailableAction, setUnavailableAction] = useState<string | null>(null)
  const isMobileViewport = useMobileViewport()
  const reduceMotion = useReducedMotion()
  const viewerTransition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const }
  const closeViewer = () => setActiveViewer(null)
  const toggleViewer = (viewer: Exclude<Viewer, null>) => setActiveViewer((current) => current === viewer ? null : viewer)
  const reportUnavailable = (action: string) => setUnavailableAction(`${action} is unavailable in the read-only demo.`)

  const viewer = activeViewer === 'account' && selectedAccount ? (
    <AccountViewer accountName={selectedAccount} privacyMode={privacyMode} onClose={closeViewer} readOnly fixture={{ account: demoAccounts.find((account) => account.name === selectedAccount) ?? demoAccounts[0], transactions: [...(demoAccountTransactionsByAccount.get(selectedAccount) ?? [])] }} />
  ) : activeViewer === 'credit-card' && selectedCreditCard ? (
    <CreditCardViewer accountName={selectedCreditCard} privacyMode={privacyMode} onClose={closeViewer} onSelectCard={setSelectedCreditCard} readOnly fixture={{ accounts: demoCreditCards, transactionsByAccount: new Map(demoCreditCardTransactionsByAccount), fxMap: demoFxMap }} />
  ) : activeViewer === 'installments' ? (
    <InstallmentsViewer privacyMode={privacyMode} onClose={closeViewer} readOnly fixture={{ items: demoInstallmentActivityItems }} />
  ) : activeViewer === 'debts' ? (
    <DebtsandReceivablesViewer privacyMode={privacyMode} selectedRecord={selectedDebtRecord} onClose={closeViewer} readOnly fixture={{ views: demoDebtViews, accounts: [...demoAccounts, ...demoCreditCards].map((account) => account.name) }} />
  ) : null
  const mobileDetailViewerOpen = isMobileViewport && viewer !== null

  return (
    <div className="h-screen overflow-hidden bg-bg flex flex-col">
      <nav role="navigation" className="shrink-0 bg-bg border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="font-display font-bold tracking-tight">Ledgrr</h1>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden text-sm text-muted sm:block">Demo account</span>
          <span className="hidden items-center gap-1.5 text-xs text-warn sm:inline-flex" role="status"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />Changes are not saved</span>
          <ThemeSwitcher />
          <button type="button" onClick={() => setPrivacyMode((current) => !current)} aria-label={privacyMode ? 'Show amounts' : 'Hide amounts'} className={NAV_TOGGLE_CLASS}>
            {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <a href="/login" className={NAV_TOGGLE_TEXT_CLASS}>Exit demo</a>
        </div>
      </nav>

      <main className={`relative flex-1 min-h-0 px-4 sm:px-6 py-6 lg:overflow-hidden ${mobileDetailViewerOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div className="mx-auto mb-4 flex items-center gap-2 text-sm text-muted lg:hidden" role="status"><LockKeyhole className="h-4 w-4 text-warn" aria-hidden="true" />Demo mode — changes are not saved</div>
        {unavailableAction && <p role="status" className="mx-auto mb-4 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">{unavailableAction}</p>}
        <motion.div
          animate={isMobileViewport ? { x: mobileDetailViewerOpen ? '-110%' : 0 } : { x: 0 }}
          transition={isMobileViewport ? viewerTransition : { duration: 0 }}
          className="mx-auto flex flex-col gap-6 lg:h-full lg:flex-row lg:overflow-x-auto lg:overflow-y-hidden lg:items-stretch scrollbar-gutter-stable"
        >
          <section aria-label="Account Balances" className={activeViewer === 'account' && !isMobileViewport ? 'flex min-h-0 shrink-0 gap-6 lg:w-[59.5rem]' : 'shrink-0 lg:w-[24rem]'}>
            <div className="min-h-0 shrink-0 lg:w-[24rem]"><AccountBalancesCard accounts={demoAccounts} privacyMode={privacyMode} viewerOpen={activeViewer === 'account'} selectedAccount={selectedAccount} onSelectAccount={setSelectedAccount} onToggleViewer={() => toggleViewer('account')} /></div>
            {!isMobileViewport && activeViewer === 'account' && <motion.div initial={reduceMotion ? false : { x: '-75%' }} animate={{ x: 0 }} transition={viewerTransition} className="min-h-0 shrink-0 lg:w-[34rem]">{viewer}</motion.div>}
          </section>
          <section aria-label="Credit Cards" className={activeViewer === 'credit-card' && !isMobileViewport ? 'flex min-h-0 shrink-0 gap-6 lg:w-[59.5rem]' : 'shrink-0 lg:w-[24rem]'}>
            <div className="min-h-0 shrink-0 lg:w-[24rem]"><CreditCardUtilizationCard accounts={demoCreditCards} transactionsByAccount={demoCreditCardTransactionsByAccount} fxMap={demoFxMap} privacyMode={privacyMode} viewerOpen={activeViewer === 'credit-card'} selectedCard={selectedCreditCard} onSelectCard={setSelectedCreditCard} onToggleViewer={() => toggleViewer('credit-card')} onAddCreditCard={() => reportUnavailable('Adding credit cards')} onPay={() => reportUnavailable('Payments')} /></div>
            {!isMobileViewport && activeViewer === 'credit-card' && <motion.div initial={reduceMotion ? false : { x: '-75%' }} animate={{ x: 0 }} transition={viewerTransition} className="min-h-0 shrink-0 lg:w-[34rem]">{viewer}</motion.div>}
          </section>
          <section aria-label="Transactions by Period" className="shrink-0 lg:w-[24rem]"><TransactionsCard grouped={demoGroupedTransactions} fxMap={demoFxMap} privacyMode={privacyMode} /></section>
          <section aria-label="Budgets" className="shrink-0 lg:w-[24rem]"><BudgetsCard rows={demoBudgetRows} fxMap={demoFxMap} privacyMode={privacyMode} selectedMonth={demoMonth} onMonthChange={() => {}} /></section>
          <section aria-label="Installments and Recurring" className={activeViewer === 'installments' && !isMobileViewport ? 'flex min-h-0 shrink-0 gap-6 lg:w-[59.5rem]' : 'shrink-0 lg:w-[24rem]'}>
            <div className="min-h-0 shrink-0 lg:w-[24rem]"><InstallmentsRecurringCard privacyMode={privacyMode} initialMonth={demoMonth} getMonthResult={getDemoMonthResult} viewerOpen={activeViewer === 'installments'} onToggleViewer={() => toggleViewer('installments')} /></div>
            {!isMobileViewport && activeViewer === 'installments' && <motion.div initial={reduceMotion ? false : { x: '-75%' }} animate={{ x: 0 }} transition={viewerTransition} className="min-h-0 shrink-0 lg:w-[34rem]">{viewer}</motion.div>}
          </section>
          <section aria-label="Debts and Receivables" className={activeViewer === 'debts' && !isMobileViewport ? 'flex min-h-0 shrink-0 gap-6 lg:w-[59.5rem]' : 'shrink-0 lg:w-[24rem]'}>
            <div className="min-h-0 shrink-0 lg:w-[24rem]"><DebtsReceivablesCard privacyMode={privacyMode} views={demoDebtViews} viewerOpen={activeViewer === 'debts'} selectedRecord={selectedDebtRecord} onSelectRecord={setSelectedDebtRecord} onToggleViewer={() => toggleViewer('debts')} /></div>
            {!isMobileViewport && activeViewer === 'debts' && <motion.div initial={reduceMotion ? false : { x: '-75%' }} animate={{ x: 0 }} transition={viewerTransition} className="min-h-0 shrink-0 lg:w-[34rem]">{viewer}</motion.div>}
          </section>
        </motion.div>
        <AnimatePresence initial={false}>
          {isMobileViewport && viewer && <motion.div key={activeViewer} initial={reduceMotion ? false : { x: '100%' }} animate={{ x: 0 }} exit={reduceMotion ? { opacity: 0 } : { x: '100%' }} transition={viewerTransition} className="fixed inset-x-4 top-20 bottom-6 z-50 min-h-0 sm:inset-x-6">{viewer}</motion.div>}
        </AnimatePresence>
      </main>
    </div>
  )
}
