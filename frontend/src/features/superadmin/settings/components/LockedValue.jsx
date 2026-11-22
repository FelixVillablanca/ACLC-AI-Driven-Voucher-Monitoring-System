import { Lock } from 'lucide-react'

/** A built-in rule that can't be changed: "🔒 Never allowed" in a Muted box (30px tall). */
export default function LockedValue({ children }) {
  return (
    <span className="text-caption inline-flex h-[30px] items-center gap-1.5 rounded-lg border bg-muted px-2.5">
      <Lock className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  )
}
