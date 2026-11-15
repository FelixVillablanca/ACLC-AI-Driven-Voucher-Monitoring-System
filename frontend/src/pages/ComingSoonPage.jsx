import { Construction } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'

/** TEMPORARY stand-in for screens not built yet. Delete once every route has a real page. */
export default function ComingSoonPage({ title = 'Coming soon', description }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <EmptyState icon={Construction} title={title} description={description} />
    </main>
  )
}
