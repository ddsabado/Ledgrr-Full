/**
 * Transactions-only endpoint.
 * Appends caller-provided rows to Transactions!B:L and never writes to any
 * account, installment, or recurring-payment sheet.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TransactionInput {
  date: string
  account: string
  amount: number
  currency: string
  targetAccount: string
  type: string
  category: string
  subcategory: string
  budget: string
  note: string
}

interface TxBody { transactions?: TransactionInput[] }

function isTransaction(value: unknown): value is TransactionInput {
  if (!value || typeof value !== 'object') return false
  const tx = value as Record<string, unknown>
  return typeof tx.date === 'string' && tx.date.trim() !== '' &&
    typeof tx.account === 'string' && tx.account.trim() !== '' &&
    typeof tx.amount === 'number' && Number.isFinite(tx.amount) && tx.amount > 0 &&
    typeof tx.currency === 'string' && tx.currency.trim() !== '' &&
    typeof tx.targetAccount === 'string' && typeof tx.type === 'string' && tx.type.trim() !== '' &&
    typeof tx.category === 'string' && tx.category.trim() !== '' && typeof tx.subcategory === 'string' &&
    typeof tx.budget === 'string' && typeof tx.note === 'string'
}

/** Converts transport objects to Transactions-sheet columns B:L. */
export function toTransactionRows(transactions: TransactionInput[]): string[][] {
  return transactions.map((tx) => [
    tx.date.trim(), tx.account.trim(), tx.amount.toFixed(2), '', tx.currency.trim(),
    tx.targetAccount.trim(), tx.type.trim(), tx.category.trim(), tx.subcategory.trim(),
    tx.budget.trim(), tx.note.trim(),
  ])
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    let body: TxBody
    try { body = await req.json() as TxBody } catch {
      return Response.json({ error: 'Malformed JSON body' }, { status: 400, headers: CORS_HEADERS })
    }
    const transactions = body.transactions
    if (!Array.isArray(transactions) || transactions.length === 0 || !transactions.every(isTransaction)) {
      return Response.json({ error: 'Invalid transaction rows' }, { status: 400, headers: CORS_HEADERS })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUser = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })

    const admin = createClient(supabaseUrl, supabaseServiceRole, { auth: { persistSession: false } })
    const { data: userSheet } = await admin
      .from('user_sheets')
      .select('sheet_id, refresh_token_secret_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!userSheet) return Response.json({ error: 'No sheet connected for this user' }, { status: 404, headers: CORS_HEADERS })
    const { data: refreshToken, error: vaultError } = await admin.rpc('decrypt_vault_secret', { p_id: userSheet.refresh_token_secret_id })
    if (vaultError || !refreshToken) return Response.json({ error: 'Failed to retrieve credentials' }, { status: 500, headers: CORS_HEADERS })

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }),
    })
    if (!tokenRes.ok) return Response.json({ error: 'Failed to exchange token' }, { status: 502, headers: CORS_HEADERS })
    const { access_token: accessToken } = await tokenRes.json() as { access_token: string }
    // `values.append` detects the whole logical table and can start at its
    // first column (A), even when passed B:L. Read the populated B column and
    // update an explicit B:L range instead, preserving the Txn ID formula in A.
    const existingRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent('Transactions!B2:B')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!existingRes.ok) return Response.json({ error: 'Failed to read transactions' }, { status: 502, headers: CORS_HEADERS })
    const existing = await existingRes.json() as { values?: string[][] }
    const firstOpenRow = 2 + (existing.values?.length ?? 0)
    const lastRow = firstOpenRow + transactions.length - 1
    const writeRange = `Transactions!B${firstOpenRow}:L${lastRow}`
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${userSheet.sheet_id}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ majorDimension: 'ROWS', values: toTransactionRows(transactions) }),
      },
    )
    if (!writeRes.ok) return Response.json({ error: 'Failed to write transactions' }, { status: 502, headers: CORS_HEADERS })
    return Response.json({ ok: true, tx: transactions.length }, { status: 201, headers: CORS_HEADERS })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Unexpected server error' }, { status: 500, headers: CORS_HEADERS })
  }
})
