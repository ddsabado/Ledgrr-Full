import { supabase, SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase'
import type { SplittrImportResult, SplittrImportSelection, SplittrPreview } from '@/types/splittr'

async function headers(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token ?? ''}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }
}

async function request<T>(body: unknown): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/splittr-import`, { method: 'POST', headers: await headers(), body: JSON.stringify(body) })
  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(payload.error || 'Splittr import failed')
  return payload
}

/** The raw share URL/token is sent only to the authenticated Edge Function. */
export const previewSplittrGroup = (share: string) => request<SplittrPreview>({ action: 'preview', share })
export const importSplittrExpenses = (selection: SplittrImportSelection) => request<SplittrImportResult>({ action: 'import', ...selection })
