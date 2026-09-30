import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_KEY: 'publishable-key',
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jwt' } } }) } },
}))

import { importSplittrExpenses, previewSplittrGroup } from '@/services/splittrImport'

describe('Splittr import client', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('sends the share only to the authenticated Edge Function preview', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ group: {} })))
    await previewSplittrGroup('share-token')
    expect(fetchMock).toHaveBeenCalledWith('https://project.supabase.co/functions/v1/splittr-import', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer jwt' }), body: JSON.stringify({ action: 'preview', share: 'share-token' }),
    }))
  })

  it('returns a safe server error to the review flow', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Splittr is unavailable.' }), { status: 502 }))
    await expect(importSplittrExpenses({ share: 'share-token', groupId: 'g1', memberId: 'm1', expenses: [] })).rejects.toThrow('Splittr is unavailable.')
  })
})
