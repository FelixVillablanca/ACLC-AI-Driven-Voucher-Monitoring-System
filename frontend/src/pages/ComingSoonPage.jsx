import { Construction } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'

/** TEMPORARY stand-in for screens not built yet. Delete once every route has a real page. */
export default function ComingSoonPage({ title = 'Coming soon', description, className = 'min-h-screen' }) {
  return (
    <main className={cn('flex items-center justify-center p-6', className)}>
      <EmptyState icon={Construction} title={title} description={description} />
    </main>
  )
}
