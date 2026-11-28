import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Download, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDebounce } from '@/hooks/useDebounce'
import AdminAccountsTable from '../components/AdminAccountsTable'
import AdminAccountsToolbar from '../components/AdminAccountsToolbar'
import AdminProfilePanel from '../components/AdminProfilePanel'
import AdminSummaryCards from '../components/AdminSummaryCards'
import AssignCompanyDialog from '../components/AssignCompanyDialog'
import BulkActionDialog from '../components/BulkActionDialog'
import CancelInviteDialog from '../components/CancelInviteDialog'
import DeactivateAccountDialog from '../components/DeactivateAccountDialog'
import EditAdminModal from '../components/EditAdminModal'
import ExportAdminsDialog from '../components/ExportAdminsDialog'
import MakeSuperAdminDialog from '../components/MakeSuperAdminDialog'
import ReactivateAccountDialog from '../components/ReactivateAccountDialog'
import RequireTwoFactorDialog from '../components/RequireTwoFactorDialog'
import ResendInvitationDialog from '../components/ResendInvitationDialog'
import ResetAdminPasswordDialog from '../components/ResetAdminPasswordDialog'
import { useAdminAccounts } from '../hooks/useAdminAccounts'
import { CREATE_ADMIN_SEARCH } from '../utils'

/** ⋯ menu / profile actions that open a confirm dialog. */
const DIALOGS = {
  resend_invitation: ResendInvitationDialog,
  cancel_invitation: CancelInviteDialog,
  reset_password: ResetAdminPasswordDialog,
  require_two_factor: RequireTwoFactorDialog,
  deactivate: DeactivateAccountDialog,
  reactivate: ReactivateAccountDialog,
  assign_company: AssignCompanyDialog,
}

/**
 * The Admins tab (Framer U7glXUOSF) and its click-flows A1–A12.
 *
 * The ADDRESS holds the view, search, sort, page and the open profile
 * (?view=pending&q=liz&sort=name&order=asc&page=2&profile=12), so Back, refresh and a shared
 * link show the same thing. Ticked rows (A6) live only on this page.
 */
export default function AdminAccountsPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view')
  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'last_sign_in'
  const order = params.get('order') ?? 'desc'
  const page = Number(params.get('page')) || 1
  const profileId = Number(params.get('profile')) || null

  const list = useAdminAccounts({
    view,
    search,
    sort: sort === 'last_sign_in' ? undefined : sort,
    order: order === 'desc' ? undefined : order,
    page,
  })
  const [selected, setSelected] = useState(() => new Map()) // id → account (kept across pages)
  const [dialog, setDialog] = useState(null) // { type, account } | { type: 'bulk', action } | { type: 'export' }

  // The box updates as you type; the address (and the server) only after a 300 ms pause
  const [searchText, setSearchText] = useState(search)
  const debouncedSearch = useDebounce(searchText.trim(), 300)

  const update = useCallback(
    (changes, { keepPage = false } = {}) =>
      setParams(
        (p) => {
          Object.entries(changes).forEach(([key, value]) => (value ? p.set(key, String(value)) : p.delete(key)))
          if (!keepPage) p.delete('page') // a new filter starts on page 1
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  useEffect(() => {
    if (debouncedSearch !== search) update({ q: debouncedSearch })
  }, [debouncedSearch, search, update])

  const clearSelection = () => setSelected(new Map())
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else
        next.set(
          id,
          list.accounts.find((a) => a.id === id),
        )
      return next
    })
  const toggleAll = (ids, on) =>
    setSelected((prev) => {
      const next = new Map(prev)
      ids.forEach((id) =>
        on
          ? next.set(
              id,
              list.accounts.find((a) => a.id === id),
            )
          : next.delete(id),
      )
      return next
    })

  const clearFilters = () => {
    setSearchText('')
    update({ q: null, view: null })
  }

  const openProfile = (id) => setParams((p) => (id ? p.set('profile', String(id)) : p.delete('profile'), p))

  const onAction = (type, account) => {
    if (type === 'profile') return openProfile(account.id)
    setDialog({ type, account })
  }

  const closeDialog = () => setDialog(null)
  const onDone = (message) => {
    setDialog(null)
    toast.success(message) // the list, profile and dashboard refresh themselves (ADMINS_CHANGED_EVENT)
  }

  const meta = list.meta
  const seatsLeft = meta ? meta.summary.super_admin_seats.total - meta.summary.super_admin_seats.used : 0
  const Dialog = dialog && DIALOGS[dialog.type]

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">Admins</h1>
          <p className="text-body text-muted-foreground">
            Everyone with setup access to the platform. Only Super Admins can add, change or remove them.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setDialog({ type: 'export' })}
            disabled={!meta}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden="true" /> Export
          </button>
          <Link
            to={{ search: CREATE_ADMIN_SEARCH }}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden="true" /> Add admin
          </Link>
        </div>
      </div>

      <AdminSummaryCards summary={meta?.summary} />

      <AdminAccountsToolbar
        view={view}
        onView={(value) => {
          clearSelection()
          update({ view: value })
        }}
        counts={meta?.views}
        searchText={searchText}
        onSearchText={setSearchText}
        sort={sort}
        order={order}
        onSort={(changes) =>
          update({
            ...changes,
            ...(changes.sort === 'last_sign_in' && { sort: null }),
            ...(changes.order === 'desc' && { order: null }),
          })
        }
      />

      <AdminAccountsTable
        list={list}
        view={view}
        search={search}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onClearSelection={clearSelection}
        onClearSearch={() => {
          setSearchText('')
          update({ q: null })
        }}
        onClearFilters={clearFilters}
        onPage={(next) => update({ page: next > 1 ? next : null }, { keepPage: true })}
        onAction={onAction}
        onBulk={(action) => setDialog({ type: 'bulk', action })}
        seatsLeft={seatsLeft}
      />

      <AdminProfilePanel accountId={profileId} onClose={() => openProfile(null)} onAction={onAction} />

      {dialog?.type === 'edit' && <EditAdminModal account={dialog.account} onClose={closeDialog} />}

      <AnimatePresence>
        {Dialog && <Dialog key={dialog.type} account={dialog.account} onCancel={closeDialog} onDone={onDone} />}

        {dialog?.type === 'make_super_admin' && (
          <MakeSuperAdminDialog
            key="promote"
            account={dialog.account}
            onCancel={closeDialog}
            onDone={onDone}
            onRequireTwoFactor={(account) => setDialog({ type: 'require_two_factor', account })}
          />
        )}

        {dialog?.type === 'bulk' && (
          <BulkActionDialog
            key="bulk"
            action={dialog.action}
            accounts={[...selected.values()].filter(Boolean)}
            onCancel={closeDialog}
            onDone={() => {
              setDialog(null)
              clearSelection()
            }}
          />
        )}

        {dialog?.type === 'export' && meta && (
          <ExportAdminsDialog
            key="export"
            counts={{ all: meta.summary.total_accounts, view: meta.total, selected: selected.size }}
            filters={{ view, search }}
            selectedIds={[...selected.keys()]}
            onCancel={closeDialog}
            onDone={closeDialog}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
