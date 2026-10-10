import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getSheetContext, SheetContextError } from '../_shared/sheetContext.ts'

/**
 * Read-only transaction taxonomy endpoint.
 * Reads Txn_Categories and Txn_Subcategories, maps their category relationship,
 * and returns one consolidated category list for frontend dropdowns.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface TxnCategory {
  category: string
  type: string
  budget: string
  subcategories: string[]
}

export function mapCategoryRows(categories: string[][], subcategories: string[][]): TxnCategory[] {
  const subsByCategory = new Map<string, string[]>()
  for (const row of subcategories) {
    const subcategory = (row[0] ?? '').trim()
    const category = (row[1] ?? '').trim()
    if (!subcategory || !category) continue
    const values = subsByCategory.get(category) ?? []
    if (!values.includes(subcategory)) values.push(subcategory)
    subsByCategory.set(category, values)
  }
  const seen = new Set<string>()
  return categories
    .filter((row) => String(row[3] ?? '').trim() !== '1')
    .map((row) => ({ category: (row[0] ?? '').trim(), type: (row[1] ?? '').trim(), budget: (row[2] ?? '').trim(), subcategories: subsByCategory.get((row[0] ?? '').trim()) ?? [] }))
    .filter((row) => row.category && !seen.has(row.category) && (seen.add(row.category), true))
}

const response = (body: unknown, status: number) => Response.json(body, { status, headers: CORS_HEADERS })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'GET') return response({ error: 'Method not allowed' }, 405)
  try {
    const { sheetId, accessToken } = await getSheetContext(req.headers.get('Authorization'))
    const ranges = ['Txn_Categories!A2:D', 'Txn_Subcategories!A2:C']
    const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&')}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) })
    if (!readRes.ok) return response({ error: 'Failed to read transaction taxonomy' }, 502)
    const read = await readRes.json() as { valueRanges?: { values?: string[][] }[] }
    return response(mapCategoryRows(read.valueRanges?.[0]?.values ?? [], read.valueRanges?.[1]?.values ?? []), 200)
  } catch (error) {
    if (error instanceof SheetContextError) return response({ error: error.message }, error.status)
    console.error('Unexpected error:', error)
    return response({ error: 'Unexpected server error' }, 500)
  }
})
