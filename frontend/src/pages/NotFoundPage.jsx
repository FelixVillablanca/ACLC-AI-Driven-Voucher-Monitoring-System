import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/lib/constants'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-display text-primary">404</p>
      <h1 className="text-page-title">Page not found</h1>
      <p className="text-caption">The page you are looking for doesn&apos;t exist or was moved.</p>
      <Button asChild className="mt-2">
        <Link to={PATHS.HOME}>Go to home</Link>
      </Button>
    </main>
  )
}
