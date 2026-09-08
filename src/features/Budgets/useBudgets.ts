/**
 * Reads the budgets collection and the EXISTING transactions collection via
 * useLiveQuery, expressing the transaction-type + non-empty-budget filter
 * IN THE QUERY (consistent with useAccountBalances). Month membership and the
 * per-budget name match are applied downstream in computeBudgets, because the
 * raw transaction date is an M/D/YYYY string with no queryable comparable
 * column. Returns raw rows for the pure derivation module.
 */
import { and, eq, not, or, useLiveQuery } from '@tanstack/react-db'

import { budgetsCollection } from '@/collections/budgets'
import { transactionsCollection } from '@/collections/transactions'
import { useAuth } from '@/context/AuthContext'
import { useCurrencies } from '@/hooks/useCurrencies'
import type { RawBudgetRow } from '@/types/budgets'
import type { RawTransaction } from '@/types/transactions'
import type { CurrencyData } from '@/types/accounts'

/** Field-picker to avoid spreading TanStack DB internal props onto RawTransaction. */
function pickTransaction(row: RawTransaction): RawTransaction {
  return {
    key:            row.key,
    date:           row.date,
    account:        row.account,
    amount:         row.amount,
    resolvedAmount: row.resolvedAmount,
    currency:       row.currency,
    targetAccount:  row.targetAccount,
    type:           row.type,
    category:       row.category,
    subcategory:    row.subcategory,
    budget:         row.budget,
    note:           row.note,
  }
}

export function useBudgets(): {
  budgets:      RawBudgetRow[]
  candidateTxs: RawTransaction[]
  fxMap:        CurrencyData
  isLoading:    boolean
  isError:      boolean
} {
  const { session } = useAuth()
  const isAuthenticated = session !== null

  const { data: fxMap, isLoading: fxLoading, isError: fxError } = useCurrencies()

  const {
    data:      budgetRows,
    isLoading: bLoading,
    isError:   bError,
  } = useLiveQuery((q) =>
    isAuthenticated ? q.from({ b: budgetsCollection }) : null
  )

  // In-query filter: type ∈ {Expense, Split Offset} AND budget is non-empty.
  // Month membership is NOT expressed here (raw date has no comparable column);
  // it is applied in computeBudgets.
  const {
    data:      txRows,
    isLoading: tLoading,
    isError:   tError,
  } = useLiveQuery((q) =>
    isAuthenticated
      ? q.from({ tx: transactionsCollection })
          .where(({ tx }) =>
            and(
              or(eq(tx.type, 'Expense'), eq(tx.type, 'Split Offset')),
              not(eq(tx.budget, '')),
            ),
          )
      : null
  )

  const budgets: RawBudgetRow[] = (budgetRows ?? []).map((r) => {
    const row = r as RawBudgetRow
    return {
      name:     row.name,
      amount:   row.amount,
      currency: row.currency,
    }
  })

  const candidateTxs: RawTransaction[] = (txRows ?? []).map((r) => pickTransaction(r as RawTransaction))

  return {
    budgets,
    candidateTxs,
    fxMap,
    isLoading: bLoading || tLoading || fxLoading,
    isError:   bError || tError || fxError,
  }
}
