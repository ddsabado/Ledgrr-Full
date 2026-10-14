import type { AccountBalance, CurrencyData } from '@/types/accounts'
import type { BudgetRow } from '@/features/Budgets/computeBudgets'
import type { DebtReceivableView } from '@/features/DebtsReceivables/computeDebtsReceivables'
import type { MonthResult, YearMonth } from '@/features/InstallmentsRecurring/buildInstallmentMonths'
import type { GroupedPeriods } from '@/features/Transactions/groupTransactions'
import type { CCAccount, CCTransactionData, RawTransaction } from '@/types/transactions'
import type { InstallmentActivityItem } from '@/features/InstallmentsRecurring'
import type { DebtActivityView } from '@/features/DebtsReceivables'

export const demoFxMap: CurrencyData = Object.freeze({ PHP: 1, USD: 58.1 })

export const demoAccounts: AccountBalance[] = [
  { name: 'Everyday Cash', category: 'Cash', currency: 'PHP', currentBalance: 28_450, initialBalance: 0, creditLimit: 0, statementDay: null, dueDay: null, image: '', accountType: 'Cash', phpEquivalent: 28_450 },
  { name: 'Metrobank Savings', category: 'Savings', currency: 'PHP', currentBalance: 126_800, initialBalance: 100_000, creditLimit: 0, statementDay: null, dueDay: null, image: '', accountType: 'Savings', phpEquivalent: 126_800 },
  { name: 'USD Travel Fund', category: 'Savings', currency: 'USD', currentBalance: 640, initialBalance: 500, creditLimit: 0, statementDay: null, dueDay: null, image: '', accountType: 'Savings', phpEquivalent: 37_184 },
]

export const demoCreditCard: CCAccount = {
  name: 'Travel Card', category: 'Credit card', currency: 'PHP', currentBalance: 18_420,
  initialBalance: 0, creditLimit: 50_000, statementDay: 25, dueDay: 30, image: '',
  accountType: 'Credit card', phpEquivalent: 18_420, utilization: 36.84, daysUntilDue: 16,
}

export const demoCreditCards: CCAccount[] = [
  demoCreditCard,
  {
    name: 'Metro Rewards', category: 'Credit card', currency: 'PHP', currentBalance: 7_860,
    initialBalance: 0, creditLimit: 80_000, statementDay: 15, dueDay: 20, image: '',
    accountType: 'Credit card', phpEquivalent: 7_860, utilization: 9.825, daysUntilDue: 11,
  },
]

const demoTransactionRows: RawTransaction[] = [
  { key: 'demo-001', date: '10/12/2026 0:00:00', account: 'Everyday Cash', amount: 1840, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: 'Groceries', subcategory: 'Market', budget: 'October essentials', note: 'Weekend market' },
  { key: 'demo-002', date: '10/11/2026 0:00:00', account: 'Metrobank Savings', amount: 18_000, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Income', category: 'Freelance', subcategory: '', budget: '', note: 'Project payment' },
  { key: 'demo-003', date: '10/10/2026 0:00:00', account: 'Everyday Cash', amount: 2760, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: 'Utilities', subcategory: 'Electricity', budget: 'October essentials', note: 'Meralco' },
  { key: 'demo-004', date: '10/09/2026 0:00:00', account: 'Travel Card', amount: 320, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: 'Dining', subcategory: 'Coffee', budget: 'October essentials', note: 'Coffee shop' },
  { key: 'demo-005', date: '10/07/2026 0:00:00', account: 'Travel Card', amount: 3250, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: 'Technology', subcategory: 'Computer', budget: 'October essentials', note: 'Laptop installment' },
  { key: 'demo-006', date: '10/04/2026 0:00:00', account: 'Travel Card', amount: 1199, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: 'Transport', subcategory: 'Ride share', budget: '', note: 'Airport ride' },
  { key: 'demo-007', date: '09/28/2026 0:00:00', account: 'Travel Card', amount: 5240, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: 'Travel', subcategory: 'Flight', budget: '', note: 'Cebu flight' },
  { key: 'demo-008', date: '10/06/2026 0:00:00', account: 'Metro Rewards', amount: 7860, resolvedAmount: null, currency: 'PHP', targetAccount: '', type: 'Expense', category: 'Home', subcategory: 'Furniture', budget: '', note: 'Desk chair' },
  { key: 'demo-009', date: '10/03/2026 0:00:00', account: 'USD Travel Fund', amount: 85, resolvedAmount: 4938.5, currency: 'USD', targetAccount: '', type: 'Expense', category: 'Travel', subcategory: 'Museum', budget: '', note: 'Museum passes' },
]

/** Complete, local account ledgers for the public read-only activity view. */
export const demoAccountTransactionsByAccount: ReadonlyMap<string, readonly RawTransaction[]> = new Map([
  ['Everyday Cash', [demoTransactionRows[0], demoTransactionRows[2]]],
  ['Metrobank Savings', [demoTransactionRows[1]]],
  ['USD Travel Fund', [demoTransactionRows[8]]],
])

export const demoCreditCardTransactions: CCTransactionData = {
  cycles: [
    { label: 'Sep 26 – Oct 25', cycleStart: '2026-09-26', cycleEnd: '2026-10-25', transactions: [demoTransactionRows[3], demoTransactionRows[4], demoTransactionRows[5], demoTransactionRows[6]] },
    { label: 'Aug 26 – Sep 25', cycleStart: '2026-08-26', cycleEnd: '2026-09-25', transactions: [demoTransactionRows[2]] },
  ],
  allTxs: [demoTransactionRows[3], demoTransactionRows[4], demoTransactionRows[5], demoTransactionRows[6], demoTransactionRows[2]],
}

export const demoMetroRewardsTransactions: CCTransactionData = {
  cycles: [{ label: 'Sep 16 – Oct 15', cycleStart: '2026-09-16', cycleEnd: '2026-10-15', transactions: [demoTransactionRows[7]] }],
  allTxs: [demoTransactionRows[7]],
}

export const demoCreditCardTransactionsByAccount: ReadonlyMap<string, CCTransactionData> = new Map([
  [demoCreditCard.name, demoCreditCardTransactions],
  ['Metro Rewards', demoMetroRewardsTransactions],
])

const octoberPeriods: GroupedPeriods = {
  currentIndex: 0,
  periods: [{
    key: 'Oct 2026', label: 'Oct 2026',
    Income: { Freelance: { total: 18_000, txs: [demoTransactionRows[1]], subcats: {} } },
    Expense: {
      Groceries: { total: 1840, txs: [], subcats: { Market: { total: 1840, txs: [demoTransactionRows[0]] } } },
      Utilities: { total: 2760, txs: [], subcats: { Electricity: { total: 2760, txs: [demoTransactionRows[2]] } } },
      Dining: { total: 320, txs: [], subcats: { Coffee: { total: 320, txs: [demoTransactionRows[3]] } } },
    },
  }],
}

export const demoGroupedTransactions = { month: octoberPeriods, week: octoberPeriods, day: octoberPeriods }

export const demoBudgetRows: BudgetRow[] = [{
  name: 'October essentials', allotted: 30_000, spent: 4920, remaining: 25_080,
  percentage: 16.4, color: 'green', transactions: [demoTransactionRows[0], demoTransactionRows[2], demoTransactionRows[3]], count: 3, currency: 'PHP',
}]

export const demoMonth: YearMonth = { year: 2026, month: 9 }

const demoMonthResult: MonthResult = {
  items: [
    { name: 'Laptop', account: 'Travel Card', amount: 3250, currency: 'PHP', isRecurring: false, iteration: 4, terms: 12 },
    { name: 'Internet', account: 'Everyday Cash', amount: 1799, currency: 'PHP', isRecurring: true, frequency: 'Monthly' },
  ],
  total: 5049, omittedInstallments: 0, omittedRecurring: 0,
}

export function getDemoMonthResult(month: YearMonth): MonthResult {
  return month.year === demoMonth.year && month.month === demoMonth.month
    ? demoMonthResult
    : { items: [], total: 0, omittedInstallments: 0, omittedRecurring: 0 }
}

/** Detail rows intentionally include the metadata exposed by the activity viewer. */
export const demoInstallmentActivityItems: readonly InstallmentActivityItem[] = [
  { key: 'demo-laptop', kind: 'Installment', name: 'Laptop', account: 'Travel Card', amount: 3250, totalAmount: 39_000, currency: 'PHP', startDate: '10/05/2026', terms: '4 of 12 payments', budget: 'October essentials' },
  { key: 'demo-internet', kind: 'Recurring', name: 'Internet', account: 'Everyday Cash', amount: 1799, currency: 'PHP', startDate: '10/01/2026', terms: 'Monthly', budget: 'October essentials' },
  { key: 'demo-insurance', kind: 'Recurring', name: 'Travel insurance', account: 'USD Travel Fund', amount: 24, resolvedAmount: 1394.4, currency: 'USD', startDate: '09/15/2026', terms: 'Monthly', budget: '' },
]

export const demoDebtViews: DebtReceivableView[] = [{
  key: 'demo-dinner', name: 'Jamie', account: 'Everyday Cash', date: '10/08/2026', dateLabel: 'Oct 08', sortTs: new Date(2026, 9, 8).getTime(),
  direction: 'Receivable', currency: 'PHP', totalPhp: 1250, totalNative: 1250, totalEstimated: false,
  participants: [
    { name: 'You', isOwner: true, sharePhp: 0, shareNative: 0, shareEstimated: false, paidPhp: 0, status: 'Paid', hasUnresolvedPayment: false },
    { name: 'Jamie', isOwner: false, sharePhp: 1250, shareNative: 1250, shareEstimated: false, paidPhp: 0, status: 'Pending', hasUnresolvedPayment: false },
  ],
  overallStatus: 'Pending', rawStatus: 'Pending', splittrExpenses: null,
}, {
  key: 'demo-osaka', name: 'Osaka group trip', account: 'Travel Card', date: '10/02/2026', dateLabel: 'Oct 02', sortTs: new Date(2026, 9, 2).getTime(),
  direction: 'Payable', currency: 'PHP', totalPhp: 4380, totalNative: 4380, totalEstimated: false,
  participants: [
    { name: 'You', isOwner: true, sharePhp: 4380, shareNative: 4380, shareEstimated: false, paidPhp: 0, status: 'Pending', hasUnresolvedPayment: false },
    { name: 'Mika', isOwner: false, sharePhp: 2200, shareNative: 2200, shareEstimated: false, paidPhp: 2200, status: 'Paid', hasUnresolvedPayment: false },
    { name: 'Anton', isOwner: false, sharePhp: 2180, shareNative: 2180, shareEstimated: false, paidPhp: 2180, status: 'Paid', hasUnresolvedPayment: false },
  ],
  overallStatus: 'Pending', rawStatus: 'Pending', splittrExpenses: [{
    description: 'Osaka group trip', date: '10/02/2026', amount: 8760, currency: 'PHP', paidBy: 'Mika',
    splits: [{ member: 'You', amount: 4380 }, { member: 'Mika', amount: 2200 }, { member: 'Anton', amount: 2180 }],
    items: [{ description: 'Hotel', splits: [{ member: 'You', amount: 3000 }, { member: 'Mika', amount: 1500 }, { member: 'Anton', amount: 1500 }] }, { description: 'Rail passes', splits: [{ member: 'You', amount: 1380 }, { member: 'Mika', amount: 700 }, { member: 'Anton', amount: 680 }] }],
  }],
}]

/** Normalized read-only records for the demo detail viewer. */
export const demoDebtActivityViews: readonly DebtActivityView[] = demoDebtViews.map((view) => ({
  key: view.key,
  name: view.name,
  account: view.account,
  dateLabel: view.dateLabel,
  direction: view.direction,
  currency: view.currency,
  totalNative: view.totalNative,
  overallStatus: view.overallStatus,
  splittrExpenses: view.splittrExpenses,
  participants: view.participants.map((participant) => ({
    name: participant.name,
    isOwner: participant.isOwner,
    shareNative: participant.shareNative,
    paidPhp: participant.paidPhp,
    status: participant.status,
  })),
}))
