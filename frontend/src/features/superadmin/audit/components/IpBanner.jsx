import { Ban, ShieldCheck, ShieldX } from 'lucide-react'
import { formatDate, formatTimeAgo, plural } from '@/lib/formatters'

/**
 * AL2: shown when the search is an IP address. What that address did today and a
 * "Block this IP" button, or, when it's already blocked, until when + Unblock.
 *   ip: the server's summary (IpActivity)   onBlock() / onUnblock(block)
 */
export default function IpBanner({ ip, onBlock, onUnblock, unblocking }) {
  if (ip.blocked) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b bg-danger-soft px-4 py-3">
        <ShieldX className="size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-badge text-danger">
            {ip.ip} is blocked {ip.blocked.until ? `until ${formatDate(ip.blocked.until, 'MMM d, h:mm a')}` : 'until someone unblocks it'}
          </p>
          <p className="text-caption">
            “{ip.blocked.reason}”{ip.blocked.by && ` · by ${ip.blocked.by}`} · {plural(ip.blocked.refused_since, 'sign-in', 'sign-ins')}{' '}
            refused since
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUnblock(ip.blocked)}
          disabled={unblocking}
          className="text-body-strong h-[34px] rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {unblocking ? 'Unblocking…' : 'Unblock'}
        </button>
      </div>
    )
  }

  const tried = ip.accounts_tried.length
  if (ip.failed_sign_ins === 0) {
    return (
      <div className="flex items-center gap-3 border-b bg-muted/60 px-4 py-3">
        <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
        <p className="text-caption">
          <span className="text-body-strong text-foreground">{ip.ip}</span> had no failed sign-ins today
          {ip.users_seen_30d.length > 0 && ` · used by ${ip.users_seen_30d.map((u) => u.full_name).join(', ')} in the last 30 days`}.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-warning-soft px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-badge text-warning">
          This IP tried {plural(tried, 'account', 'accounts')} today and failed {plural(ip.failed_sign_ins, 'sign-in', 'sign-ins')}
        </p>
        <p className="text-caption">
          {ip.ip} ·{' '}
          {ip.users_seen_30d.length > 0
            ? `used by ${ip.users_seen_30d.map((u) => u.full_name).join(', ')} in the last 30 days`
            : 'not linked to any user'}
          {ip.first_seen_today && ` · first seen ${formatTimeAgo(ip.first_seen_today)}`}
        </p>
      </div>
      <button
        type="button"
        onClick={onBlock}
        className="text-auth-button flex h-[34px] items-center gap-1.5 rounded-lg bg-danger px-3 text-white outline-none hover:bg-danger/90 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Ban className="size-4" aria-hidden="true" /> Block this IP
      </button>
    </div>
  )
}
