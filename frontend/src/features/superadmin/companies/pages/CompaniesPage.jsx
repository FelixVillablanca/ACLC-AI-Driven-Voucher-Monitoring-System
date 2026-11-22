import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Building2, Download, Plus, SearchX } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { useDebounce } from '@/hooks/useDebounce'
import { plural } from '@/lib/formatters'
import AddCompanyModal from '../components/AddCompanyModal'
import CompaniesTable from '../components/CompaniesTable'
import CompaniesToolbar from '../components/CompaniesToolbar'
import CompanyCard from '../components/CompanyCard'
import CompanyPanel from '../components/CompanyPanel'
import CompanySummaryCards from '../components/CompanySummaryCards'
import ExportCompaniesDialog from '../components/ExportCompaniesDialog'
import ReactivateCompanyDialog from '../components/ReactivateCompanyDialog'
import SuspendCompanyDialog from '../components/SuspendCompanyDialog'
import { useCompanies } from '../hooks/useCompanies'
import { addAdminSearch } from '../utils'

const DIALOGS = { suspend: SuspendCompanyDialog, reactivate: ReactivateCompanyDialog }

/**
 * The Super Admin's Companies tab (Framer vnNFYExpX) with C2 search, C3 sort, C4 list view,
 * C5 Suspended view, C6 Suspend, C7 Reactivate, C1 Export and C8 the company side panel ("Open").
 *
 * The ADDRESS holds the view, search, sort, layout and page
 * (?view=suspended&q=north&sort=users&first=1&layout=list&page=2), and the open side panel
 * (?company=12), so Back, refresh and a shared link show the same thing.
 *
 * "+ Add company" (code-first 2026-11-22) opens with ?create=company. After saving, "Add its admin"
 * opens Add admin (?create=admin&for={id}) with the new company already chosen.
 */
export default function CompaniesPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view')
  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'name'
  const suspendedFirst = params.get('first') === '1'
  const layout = params.get('layout') === 'list' ? 'list' : 'grid'
  const page = Number(params.get('page')) || 1
  const openId = Number(params.get('company')) || null
  const adding = params.get('create') === 'company'

  const list = useCompanies({ view, search, sort: sort === 'name' ? undefined : sort, suspendedFirst, page })
  const [dialog, setDialog] = useState(null) // { type: 'suspend' | 'reactivate', company }
  const [exporting, setExporting] = useState(false)

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

  const clearSearch = () => {
    setSearchText('')
    update({ q: null })
  }
  const clearFilters = () => {
    setSearchText('')
    update({ q: null, view: null })
  }

  // Open Add admin (a modal on every Super Admin page) with this company already chosen
  const addAdminFor = useCallback(
    (company) =>
      setParams(
        (p) => {
          new URLSearchParams(addAdminSearch(company.id)).forEach((value, key) => p.set(key, value))
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  const onAction = (type, company) => {
    if (type === 'add-admin') {
      addAdminFor(company)
      return
    }
    if (type === 'open') {
      update({ company: company.id }, { keepPage: true })
      return
    }
    setDialog({ type, company })
  }

  const closePanel = useCallback(() => update({ company: null }, { keepPage: true }), [update])
  const openAdd = () => update({ create: 'company' }, { keepPage: true })
  const closeAdd = useCallback(() => update({ create: null }, { keepPage: true }), [update])

  const onDone = (message, warning) => {
    setDialog(null)
    toast.success(message)
    if (warning) toast.error(warning, { duration: 8000 })
  }

  const meta = list.meta
  const companies = list.companies
  const Dialog = dialog && DIALOGS[dialog.type]

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">Companies</h1>
          <p className="text-body text-muted-foreground">
            Every organisation on the platform. You can suspend or reactivate a whole company.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setExporting(true)}
            disabled={!meta?.summary}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden="true" /> Export list
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden="true" /> Add company
          </button>
        </div>
      </div>

      <CompanySummaryCards summary={meta?.summary} />

      <CompaniesToolbar
        view={view}
        onView={(value) => update({ view: value })}
        counts={meta?.views}
        searchText={searchText}
        onSearchText={setSearchText}
        sort={sort}
        suspendedFirst={suspendedFirst}
        onSort={(changes) =>
          update({
            ...('sort' in changes && { sort: changes.sort === 'name' ? null : changes.sort }),
            ...('suspendedFirst' in changes && { first: changes.suspendedFirst ? 1 : null }),
          })
        }
        layout={layout}
        onLayout={(value) => update({ layout: value === 'list' ? 'list' : null }, { keepPage: true })}
      />

      {list.status === 'loading' && <CompaniesSkeleton layout={layout} />}

      {list.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the companies"
            message={list.error.message}
            requestId={list.error.requestId}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.status === 'success' && companies.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={search || view ? SearchX : Building2}
            title={
              search
                ? `No company matches “${search}”`
                : view === 'suspended'
                  ? 'No suspended companies'
                  : view
                    ? 'No companies in this view'
                    : 'No companies yet'
            }
            description={
              search
                ? 'Try another name or city, or show every company.'
                : view === 'suspended'
                  ? 'Every company on the platform is active.'
                  : 'Add the first company, then give it an Admin.'
            }
            action={
              search || view ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Show all companies
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openAdd}
                  className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Plus className="size-4" aria-hidden="true" /> Add company
                </button>
              )
            }
          />
        </div>
      )}

      {list.status === 'success' &&
        companies.length > 0 &&
        (layout === 'list' ? (
          <CompaniesTable companies={companies} onAction={onAction} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {companies.map((company) => (
              <CompanyCard key={company.id} company={company} onAction={onAction} />
            ))}
          </div>
        ))}

      {list.status === 'success' && meta && meta.total > 0 && (
        <div className="text-caption flex flex-wrap items-center justify-between gap-2">
          <p>
            {search ? (
              <>
                {plural(meta.total, 'result', 'results')} for “{search}” ·{' '}
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Clear search
                </button>
              </>
            ) : view ? (
              <>
                Showing {plural(meta.total, 'company', 'companies')} ·{' '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Show all
                </button>
              </>
            ) : (
              `Showing ${meta.from}–${meta.to} of ${meta.total}`
            )}
          </p>
          {meta.last_page > 1 && (
            <nav aria-label="Pages" className="flex items-center gap-2">
              <PagerButton disabled={meta.current_page <= 1} onClick={() => update({ page: meta.current_page - 1 > 1 ? meta.current_page - 1 : null }, { keepPage: true })}>
                ‹ Previous
              </PagerButton>
              <span aria-current="page">
                Page {meta.current_page} of {meta.last_page}
              </span>
              <PagerButton disabled={meta.current_page >= meta.last_page} onClick={() => update({ page: meta.current_page + 1 }, { keepPage: true })}>
                Next ›
              </PagerButton>
            </nav>
          )}
        </div>
      )}

      <CompanyPanel companyId={openId} onClose={closePanel} onAction={onAction} />
      <AddCompanyModal open={adding} onClose={closeAdd} onAddAdmin={addAdminFor} />

      <AnimatePresence>
        {Dialog && <Dialog key={dialog.type} company={dialog.company} onCancel={() => setDialog(null)} onDone={onDone} />}
        {exporting && (
          <ExportCompaniesDialog
            key="export"
            summary={meta?.summary}
            search={search}
            searchCount={search ? meta?.views?.all : undefined}
            sort={sort}
            suspendedFirst={suspendedFirst}
            onCancel={() => setExporting(false)}
            onDone={(message) => {
              setExporting(false)
              toast.success(message)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function PagerButton({ disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/** Grey placeholders shaped like the cards (or table rows) while the list loads. */
function CompaniesSkeleton({ layout }) {
  if (layout === 'list') {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-[18px]" aria-busy="true" aria-label="Loading companies">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="size-[34px] animate-pulse rounded-lg bg-border/70" />
            <div className="h-3.5 w-48 animate-pulse rounded bg-border/70" />
            <div className="ml-auto h-3.5 w-24 animate-pulse rounded bg-border/70" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading companies">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-3.5 rounded-xl border bg-card px-[18px] py-4">
          <div className="flex items-center gap-3">
            <div className="size-11 animate-pulse rounded-[10px] bg-border/70" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3.5 w-40 animate-pulse rounded bg-border/70" />
              <div className="h-3 w-28 animate-pulse rounded bg-border/70" />
            </div>
          </div>
          <div className="h-[52px] animate-pulse rounded-[10px] bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-border/70" />
        </div>
      ))}
    </div>
  )
}
