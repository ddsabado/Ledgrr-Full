import { motion } from 'motion/react'
import { LogIn } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Logo / brand */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Ledgrr</h1>
          <p className="text-gray-400 text-sm">Finance tracking, powered by your Google Sheet.</p>
        </div>

        {/* Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-8 flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Sign in</h2>
            <p className="text-gray-500 text-sm mt-1">
              Use your Google account to get started.
            </p>
          </div>

          <button
            onClick={signInWithGoogle}
            className="flex items-center justify-center gap-3 w-full bg-white text-gray-900 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            {/* Google "G" icon */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-xs text-gray-600 text-center">
            By signing in, you agree to allow Ledgrr to access your Google account for authentication.
          </p>
        </div>

        {/* Spike note */}
        <p className="text-center text-xs text-gray-700 mt-6 font-mono">
          spike / proof of concept
        </p>
      </motion.div>

      <LogIn className="hidden" />
    </div>
  )
}
