import { useState } from 'react'
import { Power, RotateCcw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { deleteCatalogItem, setCategoryActive } from '../api'
import { announceCatalogChanged } from '../utils'

/**
 * Delete / deactivate / reactivate confirm for one item. `action` = 'delete' | 'deactivate' | 'reactivate'.
 * Delete is only offered for unused items; if a voucher started using it meanwhile, the server
 * answers 409 CATALOG_IN_USE and the message says what to do instead. Render inside <AnimatePresence>.
 */
export default function CatalogActionDialog({ kind, item, action, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const look = {
    delete: {
      icon: { icon: Trash2, tone: 'danger' },
      title: `Delete “${item.name}”?`,
      label: `Delete ${kind.one}`,
      tone: 'danger',
      lines: ['It disappears from the list clerks choose from.', 'No voucher uses it, so nothing else changes.', "This can't be undone."],
      done: `“${item.name}” was deleted.`,
    },
    deactivate: {
      icon: { icon: Power, tone: 'warning' },
      title: `Deactivate “${item.name}”?`,
      label: 'Deactivate category',
      tone: 'danger',
      lines: [
        "Clerks can't choose it for new vouchers.",
        item.vouchers_count > 0 ? `The ${item.vouchers_count} vouchers that use it keep it.` : 'No voucher uses it yet.',
        'You can reactivate it any time.',
      ],
      done: `“${item.name}” was deactivated.`,
    },
    reactivate: {
      icon: { icon: RotateCcw, tone: 'success' },
      title: `Reactivate “${item.name}”?`,
      label: 'Reactivate category',
      tone: 'primary',
      lines: ['Clerks can choose it for new vouchers again.'],
      done: `“${item.name}” is active again.`,
    },
  }[action]

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      if (action === 'delete') await deleteCatalogItem(kind.key, item.id)
      else await setCategoryActive(item.id, action === 'reactivate')
      announceCatalogChanged()
      toast.success(look.done)
      onClose()
    } catch (err) {
      if (err.status === 409 || err.status === 404) announceCatalogChanged() // the list was out of date
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      icon={look.icon}
      title={look.title}
      description={item.code ? `${kind.tab} · ${item.code}` : kind.tab}
      confirmLabel={look.label}
      tone={look.tone}
      width={460}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <ul className="text-caption flex flex-col gap-1.5 rounded-[10px] bg-muted px-3.5 py-3 text-foreground">
        {look.lines.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </ConfirmDialog>
  )
}
