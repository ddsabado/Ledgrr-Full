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
