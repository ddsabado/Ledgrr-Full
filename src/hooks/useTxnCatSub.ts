import { useLiveQuery } from '@tanstack/react-db'

import { txnCatSubCollection } from '@/collections/txnCatSub'
import { useAuth } from '@/context/AuthContext'
import type { TxnCategory } from '@/types/txnCatSub'

export function useTxnCatSub(): {
  categories: TxnCategory[]
  isLoading: boolean
  isError: boolean
} {
  const { session } = useAuth()
  const { data, isLoading, isError } = useLiveQuery((q) => session ? q.from({ taxonomy: txnCatSubCollection }) : null)
  return { categories: (data ?? []) as TxnCategory[], isLoading, isError }
}
