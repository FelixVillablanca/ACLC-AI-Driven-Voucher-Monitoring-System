import { TriangleAlert } from 'lucide-react'

/** The red box for an error that doesn't belong to one field (with the reference number). */
export default function AuthAlert({ error }) {
  if (!error) return null
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger-soft p-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <div>
        <p className="text-body-strong text-danger">{error.message}</p>
        {error.requestId && <p className="text-caption mt-0.5">Reference: {error.requestId}</p>}
      </div>
    </div>
  )
}
