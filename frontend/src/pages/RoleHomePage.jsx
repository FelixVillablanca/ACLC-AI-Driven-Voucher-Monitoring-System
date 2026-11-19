import { useState } from 'react'
import { Construction, Loader2, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { signOut } from '@/features/auth'
import { ROLE_LABELS } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'

/**
 * TEMPORARY landing page for the clerk / officer / supervisor areas
 * (/clerk, /officer, /supervisor) until their dashboards are designed in Framer.
 * Shows who is signed in and in which company, and lets them sign out.
 */
export default function RoleHomePage() {
  const user = useAuthStore((s) => s.user)
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const company = user?.companies?.find((c) => c.id === activeCompanyId)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      toast.error(`Couldn't sign out: ${error.message}`)
      setSigningOut(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary-soft">
          <Construction className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-page-title">{ROLE_LABELS[user?.role]} dashboard</h1>
          <p className="text-caption mt-1">Coming soon. This screen is built from its own Framer frame.</p>
        </div>

        <dl className="grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border bg-muted p-4 text-left">
          <dt className="text-caption">Signed in as</dt>
          <dd className="text-body-strong truncate">{user?.full_name}</dd>
          <dt className="text-caption">Email</dt>
          <dd className="text-body truncate">{user?.email}</dd>
          <dt className="text-caption">Company</dt>
          <dd className="text-body truncate">{company?.name ?? '-'}</dd>
        </dl>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-body-strong flex h-[38px] items-center gap-2 rounded-lg border bg-card px-4 text-danger outline-none hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {signingOut ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </main>
  )
}
