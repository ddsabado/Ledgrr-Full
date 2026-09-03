/**
 * ConnectSheetPage — /connect
 *
 * The user lands here after first login.
 * They paste their Google Sheet URL or ID.
 * We save the sheet_id to user_sheets (tokens already stored by AuthCallbackPage).
 * No second OAuth needed — tokens were captured at login.
 */
import { useState } from 'react'
import { motion } from 'motion/react'
import { Link2, LogOut, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

function extractSheetId(input: string): string | null {
  const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim()
  return null
}

type Status = 'idle' | 'saving' | 'success' | 'error'

export default function ConnectSheetPage() {
  const { user, signOut } = useAuth()
  const [sheetInput, setSheetInput] = useState('')
  const [sheetName, setSheetName]   = useState('')
  const [status, setStatus]         = useState<Status>('idle')
  const [errorMsg, setErrorMsg]     = useState('')

  const handleSave = async () => {
    const sheetId = extractSheetId(sheetInput)
    if (!sheetId) {
      setErrorMsg('Could not find a valid Sheet ID. Paste the full Google Sheets URL or just the ID.')
      setStatus('error')
      return
    }

    setStatus('saving')

    const { error } = await supabase
      .from('user_sheets')
      .update({
        sheet_id:   sheetId,
        sheet_name: sheetName.trim() || sheetId,
      })
      .eq('user_id', user!.id)

    if (error) {
      // Row might not exist yet if provider_refresh_token was missing at callback time
      // Try upsert as fallback
      const { error: upsertError } = await supabase
        .from('user_sheets')
        .upsert({
          user_id:    user!.id,
          sheet_id:   sheetId,
          sheet_name: sheetName.trim() || sheetId,
          // refresh_token will be empty — user will need to re-login for Sheets access
          refresh_token: '',
        }, { onConflict: 'user_id' })

      if (upsertError) {
        setErrorMsg(upsertError.message)
        setStatus('error')
        return
      }
    }

    setStatus('success')
    setTimeout(() => window.location.replace('/dashboard'), 1000)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Connect your Sheet</h1>
            <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md px-2 py-1"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        {/* Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-8 flex flex-col gap-5">

          <p className="text-gray-400 text-sm">
            You already granted Ledgrr access to your Google Sheets during sign-in.
            Just paste the link to the specific sheet you want to track.
          </p>

          <div>
            <label htmlFor="sheet-url" className="block text-sm font-medium text-gray-300 mb-1.5">
              Google Sheet URL or ID
            </label>
            <input
              id="sheet-url"
              type="text"
              value={sheetInput}
              onChange={e => { setSheetInput(e.target.value); setStatus('idle') }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full bg-black border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="sheet-name" className="block text-sm font-medium text-gray-300 mb-1.5">
              Display name <span className="text-gray-600">(optional)</span>
            </label>
            <input
              id="sheet-name"
              type="text"
              value={sheetName}
              onChange={e => setSheetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && sheetInput) handleSave() }}
              placeholder="My Finance Sheet"
              className="w-full bg-black border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>

          {status === 'error' && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Sheet connected! Redirecting…
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!sheetInput || status === 'saving' || status === 'success'}
            className="flex items-center justify-center gap-2 w-full bg-white text-gray-900 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            <Link2 className="w-4 h-4" />
            {status === 'saving' ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>

        {/* Note about sheet access */}
        <p className="text-center text-xs text-gray-700 mt-5 font-mono">
          Make sure the sheet is owned by or shared with <span className="text-gray-500">{user?.email}</span>
        </p>
      </motion.div>
    </div>
  )
}
