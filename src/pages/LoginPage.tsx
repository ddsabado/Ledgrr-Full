import { useAuth } from '@/context/AuthContext'

interface LoginPageProps {
  loading: boolean
  error:   string | null
}

export default function LoginPage({ loading, error }: LoginPageProps) {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6 bg-surface border border-border">

        {/* Heading */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Ledgrr
          </h1>
          <p className="text-sm text-muted">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-border" />

        <a
          href="/demo"
          className="w-full rounded-lg border border-border bg-surface2 px-4 py-3 text-center text-sm font-medium text-text transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Try demo account
        </a>

        {/* Google sign-in button area */}
        <div className="flex flex-col items-center gap-3 w-full">
          {loading ? (
            <div
              className="w-10 h-10 rounded-full border-4 border-accent border-t-transparent animate-spin"
              role="status"
              aria-label="Signing in"
            />
          ) : (
            <button
              onClick={signInWithGoogle}
              aria-label="Sign in with Google"
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors duration-150 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {/* Google "G" mark */}
              <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
              </svg>
            </button>
          )}

          {error && (
            <p className="text-sm text-danger text-center" role="alert">
              {error}
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
