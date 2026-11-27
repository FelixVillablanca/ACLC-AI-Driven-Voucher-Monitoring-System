import { cn } from '@/lib/utils'

/** ‹ Prev 1 2 3 … 12 Next › */
export default function Pager({ page, last, onPage }) {
  const pages = [...new Set([1, page - 1, page, page + 1, last])].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)
  const btn =
    'text-body-strong h-8 min-w-8 rounded-lg px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50'
  return (
    <nav aria-label="Pages" className="flex items-center gap-1">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(btn, 'border bg-card hover:bg-muted')}>
        ‹ Prev
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - pages[i - 1] > 1 && <span className="text-caption px-1">…</span>}
          <button
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page ? 'bg-primary-soft text-primary' : 'hover:bg-muted')}
          >
            {p}
          </button>
        </span>
      ))}
      <button type="button" disabled={page >= last} onClick={() => onPage(page + 1)} className={cn(btn, 'border bg-card hover:bg-muted')}>
        Next ›
      </button>
    </nav>
  )
}
