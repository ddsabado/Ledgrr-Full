import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import AccountBalances from '@/features/AccountBalances'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [privacyMode, setPrivacyMode] = useState(false)

  return (
    <div className="h-screen overflow-hidden bg-black flex flex-col">
      {/* Nav */}
      <nav
        role="navigation"
        className="shrink-0 bg-black border-b border-gray-800 px-6 py-4 flex items-center justify-between"
      >
        <h1 className="text-white font-bold tracking-tight">Ledgrr</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm hidden sm:block">{user?.email}</span>

          {/* Privacy mode toggle */}
          <button
            onClick={() => setPrivacyMode((p) => !p)}
            aria-label={privacyMode ? 'Show amounts' : 'Hide amounts'}
            className="text-gray-500 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md p-1"
          >
            {privacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md px-2 py-1"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content — fills remaining viewport height, no vertical scroll */}
      <main className="flex-1 overflow-hidden px-4 sm:px-6 py-6 max-w-md mx-auto w-full">
        <AccountBalances privacyMode={privacyMode} />
      </main>
    </div>
  )
}
