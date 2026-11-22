import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Lock, Pencil, Plus, Power, RotateCcw, Search, SearchX, Trash2, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import CatalogActionDialog from '../components/CatalogActionDialog'
import CatalogItemModal from '../components/CatalogItemModal'
import { useCatalog } from '../hooks/useCatalog'
import { KINDS, kindOf } from '../utils'

/**
 * Configuration → Categories (code-first 2026-11-22): everything clerks choose from on a voucher,
 * in ONE page with 3 tabs: Voucher categories, Voucher types, Payee types (?tab=…).
 * Only the Admin's company; built-in categories are shown read-only. A used item can't be deleted
 * (rename it, or deactivate a category instead).
 */
export default function CategoriesPage() {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [params, setParams] = useSearchParams()
  const kind = kindOf(params.get('tab'))
  const catalog = useCatalog()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // { item } (null item = add)
  const [acting, setActing] = useState(null) // { item, action }

  const setTab = (key) => {
    setSearch('')
    setParams(
      (p) => {
        if (key === 'categories') p.delete('tab')
        else p.set('tab', key)
        return p
      },
      { replace: true },
    )
  }

  const items = useMemo(() => catalog.lists?.[kind.key] ?? [], [catalog.lists, kind.key])
  const term = search.trim().toLowerCase()
  const shown = useMemo(
    () => (term ? items.filter((i) => `${i.name} ${i.code ?? ''} ${i.description ?? ''}`.toLowerCase().includes(term)) : items),
    [items, term],
  )
  const own = shown.filter((i) => !i.built_in)
  const builtIn = shown.filter((i) => i.built_in)
  const ownTotal = items.filter((i) => !i.built_in).length

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">Categories</h1>
          <p className="text-body text-muted-foreground">
            Everything clerks of {companyName} choose from when they write a voucher, in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ item: null })}
          disabled={catalog.status !== 'success'}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          <Plus className="size-4" aria-hidden="true" /> Add {kind.one}
        </button>
      </div>

      <div role="tablist" aria-label="Lists" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {KINDS.map((k) => {
          const active = k.key === kind.key
          const list = catalog.lists?.[k.key]
          const count = list?.filter((i) => !i.built_in).length
          return (
            <button
              key={k.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(k.key)}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active ? 'border-primary bg-primary-faint ring-[0.5px] ring-primary' : 'hover:border-primary/40',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-primary text-white' : 'bg-primary-soft text-primary',
                )}
              >
                <k.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-body-strong block">{k.tab}</span>
                {list ? (
                  <span className={cn('text-caption block', count === 0 && 'text-warning')}>
                    {count === 0 ? 'None yet' : plural(count, k.one, `${k.one}s`)}
                  </span>
                ) : (
                  <span className="mt-1 block h-3 w-16 animate-pulse rounded bg-muted" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <section aria-label={kind.tab} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="text-caption max-w-xl">{kind.intro}</p>
          {catalog.status === 'success' && items.length > 0 && (
            <div className="flex h-[38px] w-full items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary sm:w-[260px]">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={100}
                placeholder={`Search ${kind.tab.toLowerCase()}…`}
                aria-label={`Search ${kind.tab}`}
                className="text-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        {catalog.status === 'loading' && (
          <div role="status" aria-label="Loading" className="flex flex-col">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b py-3 last:border-b-0">
                <div className="h-3.5 w-1/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-7 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {catalog.status === 'error' && (
          <ErrorState
            title="Couldn't load the lists"
            message={catalog.error.message}
            requestId={catalog.error.requestId}
            onRetry={catalog.reload}
          />
        )}

        {catalog.status === 'success' && items.length === 0 && (
          <EmptyState
            icon={kind.icon}
            title={`No ${kind.tab.toLowerCase()} yet`}
            description={`Clerks need at least one before they can write vouchers. ${kind.intro}`}
            action={
              <button
                type="button"
                onClick={() => setEditing({ item: null })}
                className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Plus className="size-4" aria-hidden="true" /> Add the first {kind.one}
              </button>
            }
          />
        )}

        {catalog.status === 'success' && items.length > 0 && shown.length === 0 && (
          <EmptyState
            icon={SearchX}
            title={`Nothing matches “${search.trim()}”`}
            description="Try another word, or clear the search."
            className="p-6"
          />
        )}

        {catalog.status === 'success' && own.length > 0 && (
          <ItemTable
            kind={kind}
            items={own}
            onEdit={(item) => setEditing({ item })}
            onAct={(item, action) => setActing({ item, action })}
          />
        )}

        {catalog.status === 'success' && kind.details && builtIn.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-table-head flex items-center gap-1.5 pt-2 text-muted-foreground">
              <Lock className="size-3" aria-hidden="true" /> Built-in · every company has these
            </p>
            <ItemTable kind={kind} items={builtIn} readOnly />
          </div>
        )}

        {catalog.status === 'success' && ownTotal > 0 && (
          <p className="text-caption">
            {term ? `${plural(own.length, 'match', 'matches')} of ${ownTotal}` : plural(ownTotal, kind.one, `${kind.one}s`)} · a used one
            can't be deleted
            {kind.details ? '; deactivate it instead' : '; rename it instead'}.
          </p>
        )}
      </section>

      <AnimatePresence>
        {editing && <CatalogItemModal key="edit" kind={kind} item={editing.item} onClose={() => setEditing(null)} />}
        {acting && <CatalogActionDialog key="act" kind={kind} item={acting.item} action={acting.action} onClose={() => setActing(null)} />}
      </AnimatePresence>
    </div>
  )
}

function ItemTable({ kind, items, onEdit, onAct, readOnly = false }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="text-table-head border-b bg-muted text-muted-foreground">
            <th scope="col" className="px-4 py-2.5">
              Name
            </th>
            {kind.details && (
              <th scope="col" className="px-4 py-2.5">
                Code
              </th>
            )}
            <th scope="col" className="px-4 py-2.5 text-right">
              Vouchers
            </th>
            {kind.details && (
              <th scope="col" className="px-4 py-2.5">
                Status
              </th>
            )}
            <th scope="col" className="px-4 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={cn('border-b last:border-b-0', !item.is_active && 'text-muted-foreground')}>
              <td className="px-4 py-3">
                <span className="text-body-strong block">{item.name}</span>
                {item.description && <span className="text-caption block max-w-md truncate">{item.description}</span>}
              </td>
              {kind.details && <td className="text-caption px-4 py-3 font-mono">{item.code ?? '—'}</td>}
              <td className="text-body px-4 py-3 text-right tabular-nums">{formatNumber(item.vouchers_count)}</td>
              {kind.details && (
                <td className="px-4 py-3">
                  {item.is_active ? <Pill tone="success">Active</Pill> : <Pill tone="neutral">Deactivated</Pill>}
                </td>
              )}
              <td className="px-4 py-3">
                {readOnly ? (
                  <span className="text-caption flex justify-end">Read-only</span>
                ) : (
                  <div className="flex items-center justify-end gap-1">
                    <IconButton label={`Edit ${item.name}`} onClick={() => onEdit(item)}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                    {kind.details &&
                      (item.is_active ? (
                        <IconButton
                          label={`Deactivate ${item.name}`}
                          onClick={() => onAct(item, 'deactivate')}
                          className="hover:text-danger"
                        >
                          <Power className="size-4" aria-hidden="true" />
                        </IconButton>
                      ) : (
                        <IconButton
                          label={`Reactivate ${item.name}`}
                          onClick={() => onAct(item, 'reactivate')}
                          className="hover:text-success"
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                        </IconButton>
                      ))}
                    <IconButton
                      label={item.vouchers_count > 0 ? `${item.name} is used by vouchers, so it can't be deleted` : `Delete ${item.name}`}
                      onClick={() => onAct(item, 'delete')}
                      disabled={item.vouchers_count > 0}
                      className="hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IconButton({ label, onClick, disabled = false, className, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}
