import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEYS } from '@/constants/queryKeys'
import { submitDebtReceivable, submitDebtReceivablePayment } from '@/services/api'
import type { NewDebtReceivableInput } from '@/types/debtsReceivables'

const invalidatedKeys = [
  QUERY_KEYS.debtsReceivables,
  QUERY_KEYS.transactions,
  QUERY_KEYS.accountBalances,
] as const

function invalidateDebtReceivableQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all(invalidatedKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })))
}

export function useSubmitDebtReceivable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewDebtReceivableInput) => submitDebtReceivable(input),
    onSuccess: () => invalidateDebtReceivableQueries(queryClient),
  })
}

export function useSubmitDebtReceivablePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: submitDebtReceivablePayment,
    onSuccess: () => invalidateDebtReceivableQueries(queryClient),
  })
}
