import { useRouteError } from 'react-router-dom'
import ErrorState from '@/components/common/ErrorState'

/** Shown when a page fails to load or crashes inside the router. */
export default function RouteErrorPage() {
  const error = useRouteError()
  console.error('Route error:', error)

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ErrorState
        title="This page couldn't be opened"
        message="Something went wrong while loading this page. Reloading usually fixes it."
        onRetry={() => window.location.reload()}
      />
    </main>
  )
}
