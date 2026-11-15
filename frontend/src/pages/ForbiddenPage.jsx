import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/lib/constants'

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-display text-danger">403</p>
      <h1 className="text-page-title">No access</h1>
      <p className="text-caption">Your role doesn&apos;t have permission to open this page.</p>
      <Button asChild className="mt-2">
        <Link to={PATHS.HOME}>Go to home</Link>
      </Button>
    </main>
  )
}
