import { useAuth } from '@/context/AuthContext'

export default function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav role="navigation" className="fixed top-0 left-0 right-0 z-20 bg-black border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold tracking-tight">Ledgrr</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm hidden sm:block">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md px-2 py-1"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Placeholder content */}
      <main className="pt-24 flex flex-col items-center justify-center min-h-screen gap-2 text-center px-4">
        <p className="text-gray-400 font-medium">Dashboard coming soon.</p>
        <p className="text-gray-700 text-sm">{user?.email}</p>
      </main>
    </div>
  )
}
