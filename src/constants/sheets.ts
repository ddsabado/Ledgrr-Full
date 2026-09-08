/**
 * Accounts sheet column header strings.
 * These must match the actual header row of the Accounts sheet exactly (case-sensitive).
 * The Edge Function resolves column indices from these strings at runtime,
 * so if the sheet header changes, only this file needs updating.
 */
export const ACCOUNTS_COLUMNS = Object.freeze({
  NAME:            'Account',
  CATEGORY:        'Account Category',
  CREDIT_LIMIT:    'Credit Limit',
  INITIAL_BALANCE: 'Init Balance',
  CURRENCY:        'Account Currency',
  BALANCE_PHP:     'Balance (PHP)',
  IMAGE:           'Image',
  STATEMENT_DAY:   'Statement Day',
  DUE_DAY:         'Due Day',
  CURRENT_BALANCE: 'Current Balance',
  METADATA:        'Metadata',
} as const)

export const CURRENCY_COLUMNS = Object.freeze({
  CODE: 'Currency',
  RATE: 'Rate to PHP',
} as const)

export type AccountsColumnKey   = keyof typeof ACCOUNTS_COLUMNS
export type AccountsColumnValue = (typeof ACCOUNTS_COLUMNS)[AccountsColumnKey]


export const TRANSACTIONS_COLUMNS = Object.freeze({
  TXN_ID:          'Txn ID',
  DATE:            'Date',
  ACCOUNT:         'Account',
  AMOUNT:          'Amount',
  RESOLVED_AMOUNT: 'Resolved Amount',
  CURRENCY:        'Currency',
  TARGET_ACCOUNT:  'Target Account',
  TYPE:            'Transaction Type',
  CATEGORY:        'Category',
  SUBCATEGORY:     'Subcategory',
  BUDGET:          'Budget',
  NOTE:            'Note',
} as const)

export type TransactionsColumnKey   = keyof typeof TRANSACTIONS_COLUMNS
export type TransactionsColumnValue = (typeof TRANSACTIONS_COLUMNS)[TransactionsColumnKey]


/**
 * Installments sheet column header strings (tab "Installments", columns A–H).
 * Must match the sheet header row exactly (case-sensitive). The Edge Function
 * inlines a copy of these (Deno cannot import from src/); keep both in sync.
 */
export const INSTALLMENTS_COLUMNS = Object.freeze({
  NAME:         'Installment',
  ACCOUNT:      'Account',
  TOTAL_AMOUNT: 'Total Amount',
  TERMS:        'Terms (in mo.)',
  TERM_PAYMENT: 'Term Payment',
  START_DATE:   'Start Date',
  BUDGET:       'Budget',
  CURRENCY:     'Currency',
} as const)

export type InstallmentsColumnKey   = keyof typeof INSTALLMENTS_COLUMNS
export type InstallmentsColumnValue = (typeof INSTALLMENTS_COLUMNS)[InstallmentsColumnKey]

/**
 * Recurring Payments sheet column header strings (tab "Recurring Payments",
 * columns A–I). Must match the sheet header row exactly (case-sensitive).
 */
export const RECURRING_COLUMNS = Object.freeze({
  NAME:        'Name',
  ACCOUNT:     'Account',
  AMOUNT:      'Amount',
  FREQUENCY:   'Frequency',
  START_DATE:  'Start Date',
  END_DATE:    'End Date',
  CATEGORY:    'Category',
  SUBCATEGORY: 'Subcategory',
  CURRENCY:    'Currency',
} as const)

export type RecurringColumnKey   = keyof typeof RECURRING_COLUMNS
export type RecurringColumnValue = (typeof RECURRING_COLUMNS)[RecurringColumnKey]


/**
 * Budget sheet column header strings (tab "Budget", columns A–C).
 * Must match the sheet header row exactly (case-sensitive). The Edge Function
 * inlines a copy of these (Deno cannot import from src/); keep both in sync.
 */
export const BUDGET_COLUMNS = Object.freeze({
  BUDGET:   'Budget',
  AMOUNT:   'Amount',
  CURRENCY: 'Currency',
} as const)

export type BudgetColumnKey   = keyof typeof BUDGET_COLUMNS
export type BudgetColumnValue = (typeof BUDGET_COLUMNS)[BudgetColumnKey]
