import { useMemo } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import type { DateRange } from 'react-day-picker'

import { transactionsCollection } from '@/collections/transactions'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { useAuth } from '@/context/AuthContext'
import { queryClient } from '@/lib/queryClient'
import type { RawTransaction } from '@/types/transactions'

export interface AccountTransactionFilters {
  minAmount?: string
  maxAmount?: string
  range?: DateRange
  type?: string
  note?: string
}

export function filterTransactions(transactions: RawTransaction[], filters: AccountTransactionFilters): RawTransaction[] {
  const minimum = filters.minAmount === '' || filters.minAmount === undefined ? undefined : Number(filters.minAmount)
  const maximum = filters.maxAmount === '' || filters.maxAmount === undefined ? undefined : Number(filters.maxAmount)
  const note = filters.note?.trim().toLowerCase()
  return transactions.filter((tx) => {
    const date = new Date(tx.date)
    const start = filters.range?.from
      ? new Date(filters.range.from.getFullYear(), filters.range.from.getMonth(), filters.range.from.getDate()).getTime()
      : null
    const endDate = filters.range?.to ?? filters.range?.from
    const end = endDate
      ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime()
      : null
    if (minimum !== undefined && tx.amount < minimum) return false
    if (maximum !== undefined && tx.amount > maximum) return false
    if (start !== null && (Number.isNaN(date.getTime()) || date.getTime() < start)) return false
    if (end !== null && (Number.isNaN(date.getTime()) || date.getTime() > end)) return false
    if (filters.type && tx.type !== filters.type) return false
    return !note || tx.note.toLowerCase().includes(note)
  })
}

function pick(row: RawTransaction): RawTransaction {
  return { key: row.key, date: row.date, account: row.account, amount: row.amount, resolvedAmount: row.resolvedAmount, currency: row.currency, targetAccount: row.targetAccount, type: row.type, category: row.category, subcategory: row.subcategory, budget: row.budget, note: row.note }
}

/** Reads only the selected account from the shared transaction collection. */
export function useAccountTransactions(accountName: string, filters: AccountTransactionFilters) {
  const { session } = useAuth()
  const { data: rows, isLoading, isError } = useLiveQuery((q) =>
    session && accountName
      ? q.from({ tx: transactionsCollection })
      : null,
  )

  const transactions = useMemo(() => {
    const normaliseAccountName = (name: string) => name.trim().toLocaleLowerCase()
    const selectedAccount = normaliseAccountName(accountName)
    const accountTransactions = (rows ?? []).map(pick).filter((tx) => {
      // Transfer-in rows belong to the target account even though their source
      // account is stored in `account`, matching the credit-card viewer.
      const isSourceAccount = normaliseAccountName(tx.account) === selectedAccount
      const isTransferTarget = tx.type.trim().toLocaleLowerCase() === 'transfer'
        && normaliseAccountName(tx.targetAccount) === selectedAccount
      if (!isSourceAccount && !isTransferTarget) return false
      return true
    })
    return filterTransactions(accountTransactions, filters).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [accountName, filters, rows])

  const types = useMemo(() => Array.from(new Set((rows ?? []).map((row) => row.type).filter(Boolean))).sort(), [rows])
  // useLiveQuery automatically follows collection updates but does not expose a
  // refetch action. The underlying collection is backed by this query key, so
  // refetching it is a scoped and safe retry for the current account view.
  const retry = () => queryClient.refetchQueries({ queryKey: [QUERY_KEYS.transactions] })
  return { transactions, types, isLoading, isError, retry }
}
