import { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, Check, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDismiss } from '@/hooks/useDismiss'
import { useSwitchCompany } from '@/hooks/useSwitchCompany'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'

// one shared empty list: a selector returning a NEW [] each time makes Zustand 5 re-render forever
const NO_COMPANIES = []
/** "Apex Holdings Inc." → "AH" */
function initials(name = '') {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return (
    words
      .slice(0, 2)
      .map((w) => w[0])
      .join('') || '?'
  ).toUpperCase()
}

/**
 * "Working in Apex Holdings Inc. ▾" (Framer LolF6YFo5 top bar). The companies are the ones the user
 * has ACCEPTED access to (from /auth/me). Picking one changes useCompanyStore, which every request
 * sends as X-Company-ID, and then goes back to the dashboard (the page you were on belonged to the old company).
 * `manageSearch` (e.g. "?companies=manage") adds "Join another company…" at the bottom, which opens
 * that window (passed in by the router: shared layout code never imports a feature).
 */
export default function CompanySwitcher({ manageSearch = null }) {
  const [, setParams] = useSearchParams()
  const companies = useAuthStore((s) => s.user?.companies) ?? NO_COMPANIES
  const activeId = useCompanyStore((s) => s.activeCompanyId)
  const switchTo = useSwitchCompany()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, ref, close)

  const active = companies.find((c) => c.id === activeId)
  const many = companies.length > 1

  const pick = (company) => {
    setOpen(false)
    if (!switchTo(company.id)) return
    toast.success(`Now working in ${company.name}`)
  }

  const face = (
    <>
      <span className="text-badge flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary text-white">
        {initials(active?.name)}
      </span>
      <span className="flex min-w-0 flex-col text-left leading-tight">
        <span className="text-caption">Working in</span>
        <span className="text-body-strong truncate">{active?.name ?? 'No company'}</span>
      </span>
      {(many || manageSearch) && (
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      )}
    </>
  )

  const shell = 'flex h-10 max-w-[260px] items-center gap-2.5 rounded-[10px] border bg-primary-faint pr-3 pl-1.5'

  if (!many && !manageSearch) return <div className={shell}>{face}</div>

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(shell, 'outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50')}
      >
        {face}
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Companies"
          className="absolute top-[calc(100%+6px)] left-0 z-30 w-[280px] max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-1.5 shadow-lg"
        >
          {companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={c.id === activeId}
                onClick={() => pick(c)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <span className="text-badge flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary-soft text-primary">
                  {initials(c.name)}
                </span>
                <span className="text-body min-w-0 flex-1 truncate">{c.name}</span>
                {c.id === activeId && <Check className="size-4 text-primary" aria-label="Current" />}
              </button>
            </li>
          ))}
          {manageSearch && (
            <li className="mt-1 border-t pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  const [key, value] = manageSearch.slice(1).split('=')
                  setParams((p) => {
                    p.set(key, value)
                    return p
                  })
                }}
                className="text-body-strong flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-primary outline-none hover:bg-primary-faint focus-visible:bg-primary-faint"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] border border-dashed border-primary/40">
                  <Building2 className="size-4" aria-hidden="true" />
                </span>
                Join another company…
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
