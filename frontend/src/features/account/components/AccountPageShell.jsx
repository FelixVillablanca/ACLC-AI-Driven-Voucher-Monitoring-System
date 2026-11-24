import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { ACCOUNT_TABS, accountLinks } from '../utils'

/**
 * The frame around every account page (no Framer frame: built code-first with the design tokens).
 * Header (title + one line) and a tab row with the 5 account pages, so people can move between
 * them without opening the account menu again. The active tab has the Primary underline,
 * like the Super Admin top nav.
 */
export default function AccountPageShell({ title, description, actions, children }) {
  const role = useAuthStore((s) => s.user?.role)
  const links = accountLinks(role)

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-6 sm:px-7">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-nav-section text-muted-foreground">Your account</p>
            <h1 className="text-page-title">{title}</h1>
            {description && <p className="text-body text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        <nav aria-label="Account pages" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-5">
            {ACCOUNT_TABS.filter((tab) => links[tab.key]).map((tab) => (
              <li key={tab.key}>
                <NavLink
                  to={links[tab.key]}
                  end
                  className={({ isActive }) =>
                    cn(
                      'text-body-strong -mb-px flex h-10 items-center border-b-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {children}
    </div>
  )
}

/** A white card with a title row (14px radius, 1px border), used by every account page. */
export function AccountCard({ title, description, icon: Icon, actions, className, children }) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-xl border bg-card px-5 py-[18px]', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden="true">
                <Icon className="size-[18px]" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-card-title">{title}</h2>
              {description && <p className="text-caption mt-0.5">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** One "label → value" line in a details list. */
export function DetailRow({ label, children, hint }) {
  return (
    <div className="grid gap-1 border-t py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-caption">{label}</dt>
      <dd className="text-body min-w-0 break-words">
        {children}
        {hint && <p className="text-caption mt-0.5">{hint}</p>}
      </dd>
    </div>
  )
}
