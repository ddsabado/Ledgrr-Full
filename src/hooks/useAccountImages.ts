import { useQuery } from '@tanstack/react-query'

import { QUERY_KEYS } from '@/constants/queryKeys'
import { getAccountImages } from '@/services/api'

/** Cached list of selectable card-art files in the public account_images bucket. */
export function useAccountImages() {
  return useQuery({
    queryKey: [QUERY_KEYS.accountImages],
    queryFn: getAccountImages,
    staleTime: 5 * 60 * 1000,
  })
}
