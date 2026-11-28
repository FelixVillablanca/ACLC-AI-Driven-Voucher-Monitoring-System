import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Loader2, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { refreshUser } from '@/features/auth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { normalizeApiError } from '@/lib/apiError'
import { ACCOUNT_PATHS, ROLES } from '@/lib/constants'
import { formatDate, formatTimeLeft } from '@/lib/formatters'
import { useAuthStore } from '@/stores/useAuthStore'

const PATHS = ACCOUNT_PATHS[ROLES.ADMIN]

/**
 * What an Admin with "No company yet" sees instead of every Admin console page (user decision 2026-11-28).
 * The server answers 403 NO_COMPANY_YET to /admin/* until a Super Admin gives them a company (in + Add company or
 * Edit details); they get a bell notice then. "Check again" reloads their account, and the console opens by itself.
 */
export default function NoCompanyYetPage() {
  usePageTitle('No company yet')
  const [checking, setChecking] = useState(false)
  const deadline = useAuthStore((s) => s.user?.company_deadline)

  const checkAgain = async () => {
    setChecking(true)
    try {
      const user = await refreshUser()
      if (!user?.company) toast('Still no company. You’ll get a notice when a Super Admin assigns one.')
      else toast.success(`You’re the Admin of ${user.company.name} now.`) // the guard shows the console
    } catch (error) {
      toast.error(normalizeApiError(error).message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-5 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Building2 className="size-7" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-page-title">No company yet</h1>
        <p className="text-body text-muted-foreground">
          Your Admin account is ready, but a Super Admin hasn’t given you a company to run yet. Once they do, you’ll get a notice (the bell,
          top right) and this console fills with your company’s departments, users and settings.
        </p>
      </div>

      {deadline && (
        <p role="status" className="text-caption rounded-[10px] bg-warning-soft px-4 py-3 text-foreground">
          <span className="font-medium text-warning">This account is removed {formatTimeLeft(deadline)}</span> (
          {formatDate(deadline, 'MMM d, h:mm a')}) if no company is given by then. Contact your Super Admin if you need it.
        </p>
      )}

      <button
        type="button"
        onClick={checkAgain}
        disabled={checking}
        className="text-auth-button flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
      >
        {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCw className="size-4" aria-hidden="true" />}
        {checking ? 'Checking…' : 'Check again'}
      </button>

      <div className="flex w-full flex-col gap-1 rounded-xl border bg-card px-5 py-4 text-left">
        <p className="text-card-title">Meanwhile, you can</p>
        <ul className="text-body flex flex-col gap-1.5 pt-1">
          <li>
            <Link
              to={PATHS.settings}
              className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Turn on two-step sign-in
            </Link>{' '}
            <span className="text-muted-foreground">to protect your account</span>
          </li>
          <li>
            <Link
              to={PATHS.profile}
              className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Check your profile
            </Link>{' '}
            <span className="text-muted-foreground">(name and personal email)</span>
          </li>
          <li>
            <Link
              to={PATHS.help}
              className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Read Help &amp; support
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
