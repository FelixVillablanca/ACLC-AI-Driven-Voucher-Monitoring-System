import { useNavigate } from 'react-router-dom'
import { Menu, Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * 64px white top bar (Framer Nhw7N27tM): search, notifications bell, "+ Add user".
 * `notifications` is the bell (features/notifications), passed in by the router,
 * because shared layout components never import a feature directly.
 * Search comes with the list pages, so for now it says so (a toast).
 */
export default function AdminTopBar({ onOpenMenu, notifications, addUserSearch = '?create=user' }) {
  const navigate = useNavigate()

  const handleSearch = (event) => {
    event.preventDefault()
    toast('Search will work once the Companies, Users and Departments pages are built.', { id: 'search' })
  }

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

        <form role="search" onSubmit={handleSearch} className="hidden md:block">
          <label className="flex h-[38px] w-[360px] max-w-full items-center gap-2.5 rounded-lg border bg-muted px-3 focus-within:border-primary focus-within:bg-card">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Search</span>
            <input
              type="search"
              placeholder="Search companies, users, departments…"
              className="text-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
        </form>
      </div>

      <div className="flex items-center gap-3">
        {notifications}
        <button
          type="button"
          onClick={() => navigate({ search: addUserSearch })}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add user
        </button>
      </div>
    </header>
  )
}
