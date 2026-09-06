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
