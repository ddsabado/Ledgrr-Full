export const QUERY_KEYS = Object.freeze({
  accountBalances: 'accountBalances',
  accountImages:   'accountImages',
  currencies:      'currencies',
  transactions:    'transactions',
  installments:    'installments',
  recurring:       'recurring',
  budgets:         'budgets',
  debtsReceivables: 'debtsReceivables',
  txnCatSub:        'txnCatSub',
} as const)

// Keep the dashboard refresh intentionally scoped to the data displayed in its
// panels. Supporting caches such as account images and transaction taxonomy
// should retain their normal cache lifecycle.
export const DASHBOARD_REFRESH_QUERY_KEYS = Object.freeze([
  QUERY_KEYS.accountBalances,
  QUERY_KEYS.transactions,
  QUERY_KEYS.currencies,
  QUERY_KEYS.budgets,
  QUERY_KEYS.installments,
  QUERY_KEYS.recurring,
  QUERY_KEYS.debtsReceivables,
] as const)
