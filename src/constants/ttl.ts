/** 15 minutes — account balances change only when transactions are added */
export const ACCOUNT_BALANCES_STALE_TIME = 15 * 60 * 1000

/** 30 minutes — keep unused cache for half an hour */
export const ACCOUNT_BALANCES_GC_TIME = 30 * 60 * 1000

/** 60 minutes — FX rates change infrequently */
export const CURRENCIES_STALE_TIME = 60 * 60 * 1000

/** 120 minutes — keep FX cache for two hours */
export const CURRENCIES_GC_TIME = 120 * 60 * 1000


/** 5 minutes — transactions change frequently as new ones are added */
export const TRANSACTIONS_STALE_TIME = 5 * 60 * 1000

/** 10 minutes — keep the transactions cache for ten minutes */
export const TRANSACTIONS_GC_TIME = 10 * 60 * 1000

/** 5 minutes — installments change infrequently but may be added */
export const INSTALLMENTS_STALE_TIME = 5 * 60 * 1000

/** 10 minutes — keep the installments cache for ten minutes */
export const INSTALLMENTS_GC_TIME = 10 * 60 * 1000

/** 5 minutes — recurring payments change infrequently but may be added */
export const RECURRING_STALE_TIME = 5 * 60 * 1000

/** 10 minutes — keep the recurring payments cache for ten minutes */
export const RECURRING_GC_TIME = 10 * 60 * 1000

/** 5 minutes — budgets change infrequently but may be edited */
export const BUDGETS_STALE_TIME = 5 * 60 * 1000

/** 10 minutes — keep the budgets cache for ten minutes */
export const BUDGETS_GC_TIME = 10 * 60 * 1000
