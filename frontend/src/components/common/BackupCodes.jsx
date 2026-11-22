import { Copy, Download } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * The 8 two-step backup codes with Copy and Download .txt.
 * Shared by the sign-in setup (features/auth RecoveryCodesPanel) and Account settings
 * (turn on two-step, make new backup codes).
 */
export default function BackupCodes({ codes, email }) {
  const text = `Backup codes for ${email}\nAI-Driven Voucher Monitoring System\nEach code works once.\n\n${codes.join('\n')}\n`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      toast.success('Backup codes copied')
    } catch {
      toast.error('Couldn’t copy. Select the codes and copy them by hand.')
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: 'voucher-system-backup-codes.txt' })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul
        className="grid grid-cols-2 gap-2 rounded-[10px] border bg-muted p-3.5 font-mono text-sm text-foreground"
        aria-label="Backup codes"
      >
        {codes.map((code) => (
          <li key={code} className="text-center tracking-wide">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="text-body-strong flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Copy className="size-4" aria-hidden="true" /> Copy
        </button>
        <button
          type="button"
          onClick={download}
          className="text-body-strong flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Download className="size-4" aria-hidden="true" /> Download .txt
        </button>
      </div>
    </div>
  )
}
