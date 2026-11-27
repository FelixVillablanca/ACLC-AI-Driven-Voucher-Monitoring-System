import { useEffect, useState } from 'react'
import { LifeBuoy, Mail } from 'lucide-react'
import { getSupportContacts } from '../api'

/** "Still need help?": the real people who get your message (your company's Admins). */
export default function StillNeedHelp({ onContact }) {
  const [contacts, setContacts] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    getSupportContacts()
      .then((c) => alive && setContacts(c))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  return (
    <section
      className="flex w-full flex-col gap-2.5 rounded-xl border bg-card p-[18px] lg:w-[300px] lg:shrink-0"
      aria-labelledby="need-help"
    >
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-4 text-primary" aria-hidden="true" />
        <h2 id="need-help" className="text-card-title">
          Still need help?
        </h2>
      </div>
      <p className="text-caption">
        {contacts ? `Your message goes to the Admin of ${contacts.company}.` : 'Your message goes to your company’s Admin.'}
      </p>
      {!contacts && !failed && (
        <div className="flex -space-x-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <span key={i} className="size-9 animate-pulse rounded-full bg-muted ring-2 ring-card" />
          ))}
        </div>
      )}
      {contacts?.admins.length > 0 && <AdminFaces admins={contacts.admins} />}
      {contacts && contacts.admins.length === 0 && <p className="text-caption text-warning">{contacts.company} has no active Admin yet.</p>}
      {failed && <p className="text-caption">Couldn’t load your Admin’s name. You can still send a message.</p>}
      <button
        type="button"
        onClick={onContact}
        className="text-auth-button mt-1 flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Mail className="size-4" aria-hidden="true" /> Contact support
      </button>
    </section>
  )
}

const MAX_FACES = 4

/**
 * The Admins as overlapping profile circles (initials), no email addresses. Hover / focus a circle
 * for the name; screen readers hear the whole list. More than 4 → "+N".
 */
function AdminFaces({ admins }) {
  const shown = admins.slice(0, MAX_FACES)
  const extra = admins.length - shown.length
  const names = admins.map((a) => a.name)

  return (
    <ul className="flex items-center -space-x-2" aria-label={`Admins: ${names.join(', ')}`}>
      {shown.map((a) => (
        <li key={a.email}>
          <span
            title={a.name}
            tabIndex={0}
            className="text-badge flex size-9 items-center justify-center rounded-full bg-primary text-white ring-2 ring-card outline-none focus-visible:ring-primary-soft"
          >
            {a.name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase()}
          </span>
        </li>
      ))}
      {extra > 0 && (
        <li>
          <span
            title={names.slice(MAX_FACES).join(', ')}
            className="text-badge flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary ring-2 ring-card"
          >
            +{extra}
          </span>
        </li>
      )}
    </ul>
  )
}
