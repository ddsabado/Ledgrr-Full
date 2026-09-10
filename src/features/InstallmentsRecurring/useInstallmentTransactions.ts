import { useCallback, useMemo } from 'react'
import { eq, useLiveQuery } from '@tanstack/react-db'

import { transactionsCollection } from '@/collections/transactions'
import { useAuth } from '@/context/AuthContext'
import type { RawInstallmentRow } from '@/types/installments'
import type { RawTransaction } from '@/types/transactions'
import { parseTerms, type InstallmentItem, type YearMonth } from './buildInstallmentMonths'

const INSTALLMENT_CATEGORY = 'Installment'

export interface InstallmentTransaction extends RawTransaction {
  installmentName: string
  iteration: number
  terms: number
}

function parseInstallmentNote(note: string): { name: string; iteration: number; terms: number } | null {
  const match = note.match(/^(.*) \((\d+)\/(\d+)\)$/)
  if (!match) return null
  const iteration = Number(match[2])
  const terms = Number(match[3])
  if (!match[1] || !Number.isInteger(iteration) || !Number.isInteger(terms) || iteration < 1 || terms < iteration) return null
  return { name: match[1], iteration, terms }
}

function matchInstallment(tx: RawTransaction, installments: RawInstallmentRow[]): InstallmentTransaction | null {
  if (tx.category !== INSTALLMENT_CATEGORY) return null
  const note = parseInstallmentNote(tx.note)
  if (!note) return null
  const knownInstallment = installments.find((item) =>
    item.name === note.name && item.account === tx.account && parseTerms(item.terms) === note.terms,
  )
  return knownInstallment ? { ...tx, installmentName: note.name, iteration: note.iteration, terms: note.terms } : null
}

/** Accepts both legacy date-only cells and Sheets' date-time cell values. */
export function isTransactionInMonth(date: string, target: YearMonth): boolean {
  const match = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?$/)
  return Boolean(match && Number(match[1]) === target.month + 1 && Number(match[3]) === target.year)
}

/** Exact, case-sensitive matching of known Installments against ledger rows. */
export function useInstallmentTransactions(installments: RawInstallmentRow[]) {
  const { session } = useAuth()
  const { data: rows, isLoading, isError } = useLiveQuery((q) =>
    session !== null
      ? q.from({ tx: transactionsCollection }).where(({ tx }) => eq(tx.category, INSTALLMENT_CATEGORY))
      : null,
  )
  const transactions = useMemo(
    () => (rows ?? []).map((row) => matchInstallment(row as RawTransaction, installments)).filter((tx): tx is InstallmentTransaction => tx !== null),
    [installments, rows],
  )
  const getMonthItems = useCallback((target: YearMonth): InstallmentItem[] => transactions
    .filter((tx) => isTransactionInMonth(tx.date, target))
    .map((tx) => ({ name: tx.installmentName, account: tx.account, amount: tx.amount, currency: tx.currency, isRecurring: false, iteration: tx.iteration, terms: tx.terms })), [transactions])

  return { transactions, getMonthItems, isLoading, isError }
}
