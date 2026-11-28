import { useNavigate } from 'react-router-dom'
import { Menu, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * 64px white top bar (Framer Nhw7N27tM): search, notifications bell, "+ Add user".
 * `search` (features/admin/search) and `notifications` (features/notifications) are passed in
 * by the router, because shared layout components never import a feature directly.
 * The search only covers the Admin's own company: its users and departments.
 */
export default function AdminTopBar({ onOpenMenu, search, notifications, addUserSearch = '?create=user' }) {
  const navigate = useNavigate()
  // an Admin with no company yet (2026-11-28) has nobody to add
  const hasCompany = useAuthStore((st) => !!st.user?.company)

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="flex size-[38px] items-center justify-center rounded-lg border outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden"
        >
          <Menu className="size-4" aria-hidden="true" />
        </button>

        {search}
      </div>

      <div className="flex items-center gap-3">
        {notifications}
        {hasCompany && (
          <button
            type="button"
            onClick={() => navigate({ search: addUserSearch })}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add user
          </button>
        )}
      </div>
    </header>
  )
}
