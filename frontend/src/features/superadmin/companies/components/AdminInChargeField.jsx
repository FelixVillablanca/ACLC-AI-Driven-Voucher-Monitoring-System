import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2, RotateCw } from 'lucide-react'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { normalizeApiError } from '@/lib/apiError'
import { formatTimeLeft } from '@/lib/formatters'
import { listUnassignedAdmins } from '../api'

/**
 * "+ Add company": the optional Admin in charge (user request 2026-11-28). Only Admins with NO company yet are
 * listed (Add admin can leave the company empty); picking one makes them this company's Admin when it's saved.
 * `value` = admin id as a string ('' = none). `reloadKey` changes → the list loads again (e.g. after a 409).
 */
export default function AdminInChargeField({ value, onChange, error, disabled, reloadKey = 0 }) {
  const [state, setState] = useState({ status: 'loading', admins: [], error: null })

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', admins: await listUnassignedAdmins(), error: null })
    } catch (err) {
      setState({ status: 'error', admins: [], error: normalizeApiError(err).message })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    listUnassignedAdmins()
      .then((admins) => !cancelled && setState({ status: 'ready', admins, error: null }))
      .catch((err) => !cancelled && setState({ status: 'error', admins: [], error: normalizeApiError(err).message }))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // the picked Admin disappeared from the list (given a company elsewhere): clear the choice
  useEffect(() => {
    if (state.status === 'ready' && value && !state.admins.some((a) => String(a.id) === value)) onChange('')
  }, [state, value, onChange])

  const picked = state.admins.find((a) => String(a.id) === value)
  const hint =
    state.status === 'loading'
      ? 'Loading Admins without a company…'
      : state.status === 'ready' && state.admins.length === 0
        ? 'Every Admin already has a company. You can add its Admin after saving.'
        : picked
          ? `${picked.full_name} will run this company${picked.status === 'pending' ? ' (they haven’t set their password yet)' : ''}.`
          : 'Optional. Only Admins with no company yet are listed.'

  return (
    <FieldShell id="company-admin_id" label="Admin in charge" error={error} hint={state.status === 'error' ? undefined : hint}>
      {state.status === 'error' ? (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2">
          <p className="text-caption flex-1 text-danger">Couldn’t load the Admins: {state.error}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: 'loading', admins: [], error: null })
              load()
            }}
            className="text-body-strong flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <RotateCw className="size-3.5" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : (
        <div className="relative">
          <select
            id="company-admin_id"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || state.status !== 'ready' || state.admins.length === 0}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'company-admin_id-error' : undefined}
            className={`${inputClass} appearance-none pr-9`}
          >
            <option value="">
              {state.status === 'ready' && state.admins.length === 0 ? 'No Admins without a company' : 'None for now'}
            </option>
            {state.admins.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.full_name} · {a.email}
                {a.status === 'pending' ? ' (pending)' : ''}
                {a.removed_at ? ` · removed ${formatTimeLeft(a.removed_at)}` : ''}
              </option>
            ))}
          </select>
          {state.status === 'loading' ? (
            <Loader2
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </FieldShell>
  )
}
