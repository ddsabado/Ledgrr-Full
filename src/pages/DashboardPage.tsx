import { useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { LogOut, RefreshCw, Link2, TableProperties, AlertCircle, PenLine, CheckCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

interface SheetState {
  status: 'loading' | 'no-sheet' | 'loaded' | 'error'
  values: string[][]
  range: string
  sheetId: string
  error?: string
}

interface SheetsResponse {
  values?: string[][]
  range?: string
  sheet_id?: string
  error?: string
}

const DEFAULT_RANGE = 'Sheet1!A1:J50'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [rangeInput, setRangeInput] = useState(DEFAULT_RANGE)
  const [sheet, setSheet] = useState<SheetState>({ status: 'loading', values: [], range: '', sheetId: '' })
  const [refreshing, setRefreshing] = useState(false)

  const fetchSheetData = useCallback(async (range: string) => {
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setSheet(s => ({ ...s, status: 'error', error: 'Session expired. Sign in again.' }))
        return
      }

      const url = `${SUPABASE_URL}/functions/v1/sheets-read?range=${encodeURIComponent(range)}`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_KEY,
        },
      })

      const json = await res.json() as SheetsResponse

      if (!res.ok || json.error) {
        if (res.status === 404) {
          setSheet({ status: 'no-sheet', values: [], range: '', sheetId: '' })
        } else {
          setSheet(s => ({ ...s, status: 'error', error: json.error ?? 'Unknown error' }))
        }
        return
      }

      setSheet({
        status:  'loaded',
        values:  json.values  ?? [],
        range:   json.range   ?? range,
        sheetId: json.sheet_id ?? '',
      })
    } catch (err) {
      setSheet(s => ({ ...s, status: 'error', error: String(err) }))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchSheetData(DEFAULT_RANGE)
  }, [fetchSheetData])

  const headers = sheet.values[0] ?? []
  const rows    = sheet.values.slice(1)

  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-20 bg-black border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-lg tracking-tight">Ledgrr</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm hidden sm:block">{user?.email}</span>
          <a
            href="/connect"
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Re-connect
          </a>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Range control */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 mb-8"
        >
          <div className="flex-1">
            <label htmlFor="range" className="block text-xs text-gray-500 mb-1 font-mono tracking-widest uppercase">
              Sheet Range
            </label>
            <input
              id="range"
              type="text"
              value={rangeInput}
              onChange={e => setRangeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchSheetData(rangeInput) }}
              placeholder="Sheet1!A1:Z100"
              className="w-full bg-gray-950 border border-gray-800 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-600 transition-colors font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => fetchSheetData(rangeInput)}
              disabled={refreshing}
              className="flex items-center gap-2 bg-white text-gray-900 font-medium py-2.5 px-5 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Loading…' : 'Fetch'}
            </button>
          </div>
        </motion.div>

        {/* States */}
        {sheet.status === 'loading' && (
          <div className="flex items-center justify-center h-48 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading sheet data…
          </div>
        )}

        {sheet.status === 'no-sheet' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-64 text-center gap-4"
          >
            <TableProperties className="w-10 h-10 text-gray-700" />
            <p className="text-gray-400 font-medium">No sheet connected yet</p>
            <p className="text-gray-600 text-sm">Link your Google Sheet to start seeing your data here.</p>
            <a
              href="/connect"
              className="mt-2 bg-white text-gray-900 font-medium py-2.5 px-6 rounded-xl hover:bg-gray-100 transition-colors text-sm"
            >
              Connect a sheet
            </a>
          </motion.div>
        )}

        {sheet.status === 'error' && (
          <div className="flex items-start gap-3 bg-red-400/10 border border-red-400/20 rounded-xl p-5 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Failed to load sheet data</p>
              <p className="text-red-400/70 mt-1">{sheet.error}</p>
            </div>
          </div>
        )}

        {sheet.status === 'loaded' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Meta */}
            <p className="text-xs text-gray-600 font-mono mb-4">
              {sheet.sheetId} · {sheet.range} · {rows.length} rows
            </p>

            {sheet.values.length === 0 ? (
              <div className="text-gray-600 text-sm text-center py-16">
                No data found in range <span className="font-mono text-gray-500">{rangeInput}</span>.
                Check your sheet tab name and range.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-950">
                      {headers.map((h, i) => (
                        <th
                          key={i}
                          className="text-left text-gray-400 font-medium px-4 py-3 whitespace-nowrap font-mono text-xs tracking-wide"
                        >
                          {h || <span className="text-gray-700">col {i + 1}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-gray-900 hover:bg-gray-950/60 transition-colors"
                      >
                        {headers.map((_, ci) => (
                          <td key={ci} className="px-4 py-2.5 text-gray-300 whitespace-nowrap">
                            {row[ci] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
        <WriteTestPanel />
      </main>
    </div>
  )
}


function WriteTestPanel() {
  const [writeRange, setWriteRange]   = useState('Sheet1!A1')
  const [writeValue, setWriteValue]   = useState('hello from Ledgrr')
  const [writeStatus, setWriteStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [writeError, setWriteError]   = useState('')

  const handleWrite = async () => {
    setWriteStatus('saving')
    setWriteError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setWriteStatus('error'); setWriteError('No session'); return }

    const url = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/sheets-write`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey:         import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range:  writeRange,
        values: [[writeValue]],
      }),
    })

    const json = await res.json() as { success?: boolean; updatedCells?: number; error?: string }
    if (!res.ok || json.error) {
      setWriteStatus('error')
      setWriteError(json.error ?? 'Write failed')
    } else {
      setWriteStatus('ok')
      setTimeout(() => setWriteStatus('idle'), 2000)
    }
  }

  return (
    <div className="mt-10 border-t border-gray-900 pt-8">
      <p className="text-xs text-gray-600 font-mono tracking-widest uppercase mb-4">Write Test</p>
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <input
          type="text"
          value={writeRange}
          onChange={e => setWriteRange(e.target.value)}
          placeholder="Sheet1!A1"
          className="bg-gray-950 border border-gray-800 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-600 font-mono w-40"
        />
        <input
          type="text"
          value={writeValue}
          onChange={e => setWriteValue(e.target.value)}
          placeholder="value to write"
          className="flex-1 bg-gray-950 border border-gray-800 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-600"
        />
        <button
          onClick={handleWrite}
          disabled={writeStatus === 'saving'}
          className="flex items-center gap-2 bg-white text-gray-900 font-medium py-2.5 px-5 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm shrink-0"
        >
          {writeStatus === 'saving' ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : writeStatus === 'ok' ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <PenLine className="w-4 h-4" />
          )}
          {writeStatus === 'saving' ? 'Writing…' : writeStatus === 'ok' ? 'Written!' : 'Write'}
        </button>
      </div>
      {writeStatus === 'error' && (
        <div className="flex items-center gap-2 text-red-400 text-sm mt-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {writeError}
        </div>
      )}
    </div>
  )
}
