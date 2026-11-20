import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { PATHS } from '@/lib/constants'
import { plural } from '@/lib/formatters'
import AdminAccountsTable from '../components/AdminAccountsTable'
import AdminAccountsToolbar from '../components/AdminAccountsToolbar'
import LockAdminDialog from '../components/LockAdminDialog'
import ResendInvitationDialog from '../components/ResendInvitationDialog'
import ResetAdminPasswordDialog from '../components/ResetAdminPasswordDialog'
import UnlockAdminDialog from '../components/UnlockAdminDialog'
import { useAdminAccounts } from '../hooks/useAdminAccounts'
import { CREATE_ADMIN_SEARCH } from '../utils'

const DIALOGS = {
  resend_invitation: ResendInvitationDialog,
  reset_password: ResetAdminPasswordDialog,
  lock: LockAdminDialog,
  unlock: UnlockAdminDialog,
}

/**
 * Admin accounts page (Framer bxGFPLOVN, the "Admins" tab).
 *
 * The filters live in the ADDRESS (?status=pending&role=admin&q=liza&page=2), so Back,
 * refresh and a shared link all show the same list.
 */
export default function AdminAccountsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status')
  const role = params.get('role')
  const search = params.get('q') ?? ''
  const page = Number(params.get('page')) || 1

  const list = useAdminAccounts({ status, role, search, page })
  const [dialog, setDialog] = useState(null) // { type, account }

  // The box updates as you type; the address (and the server) only after a 300 ms pause
  const [searchText, setSearchText] = useState(search)
  const debouncedSearch = useDebounce(searchText.trim(), 300)

  const update = useCallback(
    (changes) =>
      setParams(
        (p) => {
          Object.entries(changes).forEach(([key, value]) => (value ? p.set(key, String(value)) : p.delete(key)))
          if (!('page' in changes)) p.delete('page') // a new filter starts on page 1
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  useEffect(() => {
    if (debouncedSearch !== search) update({ q: debouncedSearch })
  }, [debouncedSearch, search, update])

  const clearFilters = () => {
    setSearchText('')
    update({ q: null, status: null, role: null })
  }

  const onDialogDone = (message) => {
    setDialog(null)
    toast.success(message) // the list refreshes itself (ADMINS_CHANGED_EVENT)
  }

  const meta = list.meta
  const Dialog = dialog && DIALOGS[dialog.type]

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-caption">
            <Link to={PATHS.SUPERADMIN} className="hover:text-foreground hover:underline">
              Overview
            </Link>
            <span aria-hidden="true">{'  /  '}</span>
            Admin accounts
          </p>
          <h1 className="text-page-title">Admin accounts</h1>
          <p className="text-body text-muted-foreground">
            People who set up companies, departments and users.
            {meta &&
              ` ${plural(meta.total_accounts, 'account', 'accounts')} · ${meta.super_admin_seats.used} of ${meta.super_admin_seats.total} Super Admin seats used.`}
          </p>
        </div>
        <Link
          to={{ search: CREATE_ADMIN_SEARCH }}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add admin
        </Link>
      </div>

      <AdminAccountsToolbar
        searchText={searchText}
        onSearchText={setSearchText}
        status={status}
        onStatus={(value) => update({ status: value })}
        role={role}
        onRole={(value) => update({ role: value })}
        counts={meta?.counts}
      />

      <AdminAccountsTable
        list={list}
        filtered={Boolean(status || role || search)}
        onClearFilters={clearFilters}
        onPage={(next) => update({ page: next > 1 ? next : null })}
        onAction={(type, account) => setDialog({ type, account })}
      />

      <AnimatePresence>
        {Dialog && <Dialog key={dialog.type} account={dialog.account} onCancel={() => setDialog(null)} onDone={onDialogDone} />}
      </AnimatePresence>
    </div>
  )
}
