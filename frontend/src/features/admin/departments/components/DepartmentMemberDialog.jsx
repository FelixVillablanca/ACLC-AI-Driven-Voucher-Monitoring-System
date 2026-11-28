import { useState } from 'react'
import { Crown, UserMinus } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { clearDepartmentHead, removeFromDepartment, setDepartmentHead } from '../api'
import { announceDepartmentsChanged } from '../utils'

/**
 * Confirm one change to a person in the department side panel (2026-11-28):
 *   'make_head'   → they become the ONE head (replaces the current head, who stays a member)
 *   'remove_head' → the department has no head; they stay a member
 *   'remove'      → they leave the department (and stop being its head)
 * department: { id, name, head: { id, full_name } | null }, person: { id, full_name }
 */
export default function DepartmentMemberDialog({ type, department, person, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const otherHead = department.head && department.head.id !== person.id ? department.head : null

  const copy = {
    make_head: {
      title: `Make ${person.full_name} the head of ${department.name}?`,
      confirm: otherHead ? `Replace ${otherHead.full_name}` : 'Make head',
      icon: { icon: Crown, tone: 'warning' },
      tone: 'primary',
      body: otherHead
        ? `A department has one head. ${otherHead.full_name} stops being the head and stays a member.`
        : `${person.full_name} becomes the department’s head.`,
      run: () => setDepartmentHead(department.id, person.id, Boolean(otherHead)),
      done: `${person.full_name} is the head of ${department.name} now.`,
    },
    remove_head: {
      title: `Remove ${person.full_name} as head?`,
      confirm: 'Remove as head',
      icon: { icon: Crown, tone: 'warning' },
      tone: 'warning',
      body: `${department.name} will have no head. ${person.full_name} stays a member of it.`,
      run: () => clearDepartmentHead(department.id),
      done: `${department.name} has no head now.`,
    },
    remove: {
      title: `Remove ${person.full_name} from ${department.name}?`,
      confirm: 'Remove from department',
      icon: { icon: UserMinus, tone: 'danger' },
      tone: 'danger',
      body:
        department.head?.id === person.id
          ? `They’re its head, so ${department.name} will have no head. Their account, vouchers and history aren’t touched; they just have no department.`
          : 'Their account, vouchers and history aren’t touched; they just have no department until you add them to one.',
      run: () => removeFromDepartment(department.id, person.id),
      done: `${person.full_name} was removed from ${department.name}.`,
    },
  }[type]

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await copy.run()
      announceDepartmentsChanged()
      toast.success(copy.done)
      onClose()
    } catch (err) {
      setBusy(false)
      setError(err)
      if (err.status === 409) announceDepartmentsChanged() // someone else changed it: show the latest
    }
  }

  return (
    <ConfirmDialog
      title={copy.title}
      confirmLabel={copy.confirm}
      icon={copy.icon}
      tone={copy.tone}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <p>{copy.body}</p>
    </ConfirmDialog>
  )
}
