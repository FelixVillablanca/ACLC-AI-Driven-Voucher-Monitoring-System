import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Building2, CheckCircle2, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalShell from '@/components/common/ModalShell'
import { useAuthStore } from '@/stores/useAuthStore'
import { createDepartment } from '../api'
import { DEPARTMENTS_CHANGED_EVENT } from '../utils'
import DepartmentForm from './DepartmentForm'

/**
 * "Add department" (Quick actions, code-first 2026-11-22). Opens on any admin page with ?create=department.
 * The department always goes into the Admin's own company (shown, not chosen).
 */
export default function AddDepartmentModal() {
  const [params, setParams] = useSearchParams()
  const open = params.get('create') === 'department'

  const close = useCallback(
    () =>
      setParams(
        (p) => {
          p.delete('create')
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  return <AnimatePresence>{open && <Window onClose={close} />}</AnimatePresence>
}

function Window({ onClose }) {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [created, setCreated] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const [dirty, setDirty] = useState(false)

  const onCreated = (department) => {
    setCreated(department)
    setDirty(false)
    toast.success(`${department.name} was added to ${companyName}.`)
    window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED_EVENT))
  }

  return (
    <ModalShell
      title={created ? 'Department added' : 'Add department'}
      subtitle={
        created ? `It's ready in ${companyName}. You can add people to it when you create users.` : `A new department in ${companyName}.`
      }
      width={600}
      onClose={onClose}
      keepOpenOnBackdrop={dirty && !created}
    >
      {created ? (
        <CreatedView
          department={created}
          onAnother={() => {
            setCreated(null)
            setFormKey((k) => k + 1)
          }}
          onDone={onClose}
        />
      ) : (
        <AddForm key={formKey} companyName={companyName} onCancel={onClose} onCreated={onCreated} onDirtyChange={setDirty} />
      )}
    </ModalShell>
  )
}

function AddForm({ companyName, onCancel, onCreated, onDirtyChange }) {
  return (
    <DepartmentForm
      note={
        <div className="flex items-center gap-2.5 rounded-[10px] border bg-muted px-3.5 py-2.5">
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-caption">
            Company: <span className="font-medium text-foreground">{companyName}</span> (departments are always added to your company)
          </p>
        </div>
      }
      submitLabel="Add department"
      busyLabel="Adding…"
      onSubmit={async (values) => onCreated(await createDepartment(values))}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  )
}

function CreatedView({ department, onAnother, onDone }) {
  return (
    <>
      <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border bg-success-soft/50 px-4 py-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Layers className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-card-title truncate">
              {department.name} <span className="text-caption font-mono">{department.code}</span>
            </p>
            <p className="text-caption truncate">{department.head ? `Head: ${department.head.full_name}` : 'No head yet'}</p>
          </div>
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
        </div>
        {department.description && <p className="text-caption">{department.description}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onAnother}
          className="text-body-strong mr-auto h-[38px] rounded-lg px-2 text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Add another department
        </button>
        <button
          type="button"
          onClick={onDone}
          autoFocus
          className="text-auth-button h-[38px] rounded-lg bg-primary px-[18px] text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Done
        </button>
      </div>
    </>
  )
}
