import { Ban, Loader2, Plus } from 'lucide-react'
import { formatDate, plural } from '@/lib/formatters'

/**
 * "Blocked addresses · N" (Framer m80KDanOj): each active block with until when, by whom and how many
 * failed sign-ins led to it; "+ Block one" opens SH8, "Unblock" opens SH9.
 *   blocks: null (loading) | [] | [{ id, ip_address, until, by, automatic, before: { failed } }]
 */
export default function BlockedAddresses({ blocks, error, onBlock, onUnblock }) {
  return (
    <section aria-labelledby="blocked-title" className="flex flex-col gap-2.5 rounded-xl border bg-card px-[18px] py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="blocked-title" className="text-card-title">
          Blocked addresses{blocks ? ` · ${blocks.length}` : ''}
        </h2>
        <button
          type="button"
          onClick={onBlock}
          className="text-auth-link flex items-center gap-1 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Plus className="size-3.5" aria-hidden="true" /> Block one
        </button>
      </div>
      {error && <p className="text-caption text-danger">Couldn’t load the blocked addresses: {error.message}</p>}
      {!blocks && !error && (
        <p className="text-caption flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading…
        </p>
      )}
      {blocks?.length === 0 && <p className="text-caption">No address is blocked.</p>}
      {blocks?.map((b) => (
        <div key={b.id} className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-badge flex items-center gap-1 text-danger">
              <Ban className="size-3.5" aria-hidden="true" /> {b.ip_address}
            </p>
            <p className="text-caption truncate">
              {b.until ? `Until ${formatDate(b.until, 'MMM d')}` : 'Until unblocked'} ·{' '}
              {b.automatic ? 'automatically' : `by ${b.by ?? 'a Super Admin'}`}
              {b.before && ` · ${plural(b.before.failed, 'failed sign-in', 'failed sign-ins')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUnblock(b)}
            className="text-body-strong h-8 shrink-0 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Unblock
          </button>
        </div>
      ))}
    </section>
  )
}
