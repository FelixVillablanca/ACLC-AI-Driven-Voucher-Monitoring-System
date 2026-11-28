import { Fragment } from 'react'
import { ChevronDown, ChevronRight, Flag, Settings2 } from 'lucide-react'
import { formatDate, formatInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { TONE_PILL } from '../utils'
import WhatChanged from '@/components/common/WhatChanged'

/**
 * The log table (Framer EJ0asP2ZH): Time ↓ · Who · Action (+ amber ⚑) · Record · Company · IP · ›.
 * Clicking a row opens it in place (Primary Faint) with "What changed", request ID and browser;
 * "Open details" there (or ›) opens the AL7 side panel.
 *   highlightIp: the searched IP is shown in red (AL2)
 */
export default function AuditTable({ entries, expandedId, onToggle, onOpen, highlightIp }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse">
        <thead>
          <tr className="text-table-head h-10 border-b bg-muted text-left text-muted-foreground">
            <th scope="col" className="w-[96px] pl-4 font-semibold">
              Time ↓
            </th>
            <th scope="col" className="px-3 font-semibold">
              Who
            </th>
            <th scope="col" className="w-[210px] px-3 font-semibold">
              Action
            </th>
            <th scope="col" className="px-3 font-semibold">
              Record
            </th>
            <th scope="col" className="w-[170px] px-3 font-semibold">
              Company
            </th>
            <th scope="col" className="w-[112px] px-3 font-semibold">
              IP address
            </th>
            <th scope="col" className="w-10 pr-4">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const open = expandedId === e.id
            return (
              <Fragment key={e.id}>
                <tr
                  onClick={() => onToggle(e.id)}
                  className={cn(
                    'cursor-pointer border-b align-middle hover:bg-muted/60',
                    open && 'bg-primary-faint hover:bg-primary-faint',
                  )}
                >
                  <td className="py-3 pl-4">
                    <p className="text-body-strong">{formatDate(e.at, 'h:mm a')}</p>
                    <p className="text-caption">{formatDate(e.at, 'MMM d')}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Who who={e.who} />
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('text-badge rounded-full px-2 py-0.5 whitespace-nowrap', TONE_PILL[e.action.tone])}>
                        {e.action.label}
                      </span>
                      {e.action.sensitive && <Flag className="size-3.5 shrink-0 text-warning" aria-label="Sensitive" />}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-3 py-3">
                    <p className="text-body truncate" title={e.record.title}>
                      {e.record.title}
                    </p>
                    {e.record.subtitle && <p className="text-caption truncate">{e.record.subtitle}</p>}
                  </td>
                  <td className="px-3 py-3">
                    {e.company ? <span className="text-body">{e.company.name}</span> : <span className="text-caption">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    {e.ip ? (
                      <span
                        className={e.ip === highlightIp ? 'text-badge rounded-full bg-danger-soft px-2 py-0.5 text-danger' : 'text-caption'}
                      >
                        {e.ip}
                      </span>
                    ) : (
                      <span className="text-caption">—</span>
                    )}
                  </td>
                  <td className="pr-4 text-right">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onOpen(e.id)
                      }}
                      aria-label={`Open details of ${e.action.label}`}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {open ? (
                        <ChevronDown className="size-4 text-primary" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr className="border-b bg-primary-faint">
                    <td colSpan={7} className="px-4 pb-4">
                      <div className="ml-[96px] flex flex-col gap-3 rounded-[10px] border bg-card px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-table-head text-muted-foreground">What changed</span>
                          <span className="text-caption">
                            {[e.request_id && `Request ID ${e.request_id}`, e.browser].filter(Boolean).join(' · ') ||
                              'No request details recorded'}
                          </span>
                        </div>
                        <WhatChanged changes={e.changes} />
                        {e.note && (
                          <p className="text-caption flex items-start gap-1.5">
                            <Flag className="mt-0.5 size-3 shrink-0 text-warning" aria-hidden="true" /> Sensitive: {e.note}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpen(e.id)}
                          className="text-auth-link self-start rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          Open details →
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Who({ who }) {
  if (who.kind === 'unknown') {
    return (
      <span className="flex items-center gap-2.5">
        <span
          className="text-badge flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
          aria-hidden="true"
        >
          ?
        </span>
        <span>
          <span className="text-body-strong block">Unknown</span>
          <span className="text-caption">{who.role}</span>
        </span>
      </span>
    )
  }
  if (who.kind === 'system') {
    return (
      <span className="flex items-center gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <Settings2 className="size-4" />
        </span>
        <span>
          <span className="text-body-strong block">System</span>
          <span className="text-caption">{who.role}</span>
        </span>
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'text-badge flex size-8 shrink-0 items-center justify-center rounded-full',
          who.is_you ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary',
        )}
      >
        {formatInitials(who)}
      </span>
      <span className="min-w-0">
        <span className="text-body-strong block truncate">
          {who.name}
          {who.is_you && ' (you)'}
        </span>
        <span className="text-caption">{who.role ?? '—'}</span>
      </span>
    </span>
  )
}
