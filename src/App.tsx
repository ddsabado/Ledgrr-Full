import { lazy, Suspense } from 'react'
import { ThemeProvider } from '@/context/ThemeContext'
import DemoPage      from '@/pages/DemoPage'

// /demo never evaluates the client-authenticated application chunk.
const AuthenticatedApp = lazy(() => import('@/pages/AuthenticatedApp'))

function LoadingScreen() {
  return <div className="min-h-screen flex items-center justify-center bg-bg"><div className="w-10 h-10 rounded-full border-4 border-accent border-t-transparent animate-spin" role="status" aria-label="Loading" /></div>
}

export default function App() {
  if (window.location.pathname === '/demo') {
    return <ThemeProvider><DemoPage /></ThemeProvider>
  }

  return (
    <ThemeProvider>
      <Suspense fallback={<LoadingScreen />}>
        <AuthenticatedApp />
      </Suspense>
    </ThemeProvider>
  )
}
