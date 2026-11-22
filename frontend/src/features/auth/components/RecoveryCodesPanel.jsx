import { useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import BackupCodes from '@/components/common/BackupCodes'

/**
 * After setting up two-step sign-in: the 8 backup codes, shown ONCE.
 * "Continue" stays off until they confirm they saved them.
 */
export default function RecoveryCodesPanel({ codes, email, onContinue }) {
  const [saved, setSaved] = useState(false)

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <h1 id="login-heading" className="text-auth-heading">
          Two-step sign-in is on
        </h1>
        <p className="text-body text-muted-foreground">
          Save these backup codes somewhere safe (not on the same phone). If you lose your phone, each code lets you sign in once. You won’t
          see them again.
        </p>
      </div>

      <BackupCodes codes={codes} email={email} />

      <label className="text-body flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={`flex size-[18px] shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 ${saved ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}
        >
          {saved && <Check className="size-3" strokeWidth={3} />}
        </span>
        I saved my backup codes
      </label>

      <button
        type="button"
        onClick={onContinue}
        disabled={!saved}
        className="text-auth-button flex h-[46px] w-full items-center justify-center rounded-[10px] bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Continue
      </button>
    </div>
  )
}
