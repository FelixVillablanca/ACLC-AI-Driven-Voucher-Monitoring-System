import { useState } from 'react'
import toast from 'react-hot-toast'
import ModalShell from '@/components/common/ModalShell'
import { getDepartment, updateDepartment } from '../api'
import { announceDepartmentsChanged } from '../utils'
import DepartmentForm from './DepartmentForm'

const FIELD_NAMES = { name: 'name', code: 'code', description: 'description', head_user_id: 'head' }

/**
 * "Edit department". Opened from a row or the side panel; render it inside <AnimatePresence>.
 * It sends the `updated_at` the form was opened with: if another Admin saved the department
 * meanwhile, the server answers 409 and the form reloads with their version (nothing is overwritten).
 */
export default function EditDepartmentModal({ department: initial, onClose }) {
  const [department, setDepartment] = useState(initial)
  const [version, setVersion] = useState(0) // a new version = the form restarts with the latest values
  const [conflict, setConflict] = useState(null)
  const [dirty, setDirty] = useState(false)

  const save = async (values) => {
    setConflict(null)
    try {
      const { changed } = await updateDepartment(department.id, values, department.updated_at)
      announceDepartmentsChanged()
      toast.success(
        changed.length === 0
          ? 'Nothing to save: no changes.'
          : `${values.name} saved (${changed.map((f) => FIELD_NAMES[f] ?? f).join(', ')} changed).`,
      )
      onClose()
    } catch (error) {
      if (error.code !== 'DEPARTMENT_CHANGED') throw error // 422 under the fields / other errors in the red box
      // Someone else saved it: load their version and show why the form changed
      try {
        setDepartment(await getDepartment(department.id))
        setVersion((v) => v + 1)
      } catch {
        // keep the old values; the message below still explains
      }
      setConflict(error)
    }
  }

  return (
    <ModalShell
      title="Edit department"
      subtitle={`${initial.name} · ${initial.code}`}
      width={600}
      onClose={onClose}
      keepOpenOnBackdrop={dirty}
    >
      <DepartmentForm
        key={version}
        initial={department}
        currentHead={department.head}
        formError={conflict}
        submitLabel="Save changes"
        busyLabel="Saving…"
        onSubmit={save}
        onCancel={onClose}
        onDirtyChange={setDirty}
      />
    </ModalShell>
  )
}
