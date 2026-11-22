import { ArrowRight } from 'lucide-react'

/**
 * The "What changed" list: one line per field, old value (red) → new value (green).
 * A field with no old value was set for the first time ("—").
 *   changes: [{ field, old, new }]
 */
export default function WhatChanged({ changes }) {
  if (!changes?.length) return <p className="text-caption">No field values were recorded for this event.</p>
  return (
    <dl className="flex flex-col gap-2">
      {changes.map((c) => (
        <div key={c.field} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <dt className="text-body-strong w-28 shrink-0 break-words">{c.field}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
            {c.old != null ? (
              <span className="text-badge rounded-md bg-danger-soft px-2 py-0.5 break-all text-danger">{c.old}</span>
            ) : (
              <span className="text-caption">—</span>
            )}
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="changed to" />
            {c.new != null ? (
              <span className="text-badge rounded-md bg-success-soft px-2 py-0.5 break-all text-success">{c.new}</span>
            ) : (
              <span className="text-caption">removed</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
