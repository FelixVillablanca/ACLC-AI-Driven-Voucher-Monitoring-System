import { useState } from 'react'
import { Loader2, Pencil, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { updateProfile } from '../api'
import { buttonClass } from '../utils'
import { AccountCard, DetailRow } from './AccountPageShell'
import PasswordField from './PasswordField'

const FIELDS = ['first_name', 'last_name', 'personal_email']

/**
 * My profile → Personal details: shown as a list, "Edit" turns it into a form.
 * Only changed fields are sent, with what the screen showed (`was`), so a change made in another
 * tab isn't overwritten (409 → reload). Changing the personal email asks for the password,
 * because password-reset links go there.
 */
export default function PersonalDetailsCard({ account, onSaved, onStale }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const start = () => {
    setForm(Object.fromEntries(FIELDS.map((f) => [f, account[f] ?? ''])))
    setPassword('')
    setErrors({})
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setForm(null)
  }

  const changes = form
    ? Object.fromEntries(FIELDS.filter((f) => form[f].trim() !== (account[f] ?? '')).map((f) => [f, form[f].trim()]))
    : {}
  const changedCount = Object.keys(changes).length
  const emailChanged = 'personal_email' in changes
  const needsPersonalEmail = account.role === 'admin' || account.role === 'super_admin'

  const save = async (e) => {
    e.preventDefault()
    const local = {}
    if ('first_name' in changes && !changes.first_name) local.first_name = 'Enter your first name.'
    if ('last_name' in changes && !changes.last_name) local.last_name = 'Enter your last name.'
    if (emailChanged && needsPersonalEmail && !changes.personal_email) local.personal_email = 'Enter your personal email.'
    if (emailChanged && !password) local.current_password = 'Type your password to change your personal email.'
    if (Object.keys(local).length) return setErrors(local)

    setSaving(true)
    setErrors({})
    try {
      const was = Object.fromEntries(Object.keys(changes).map((f) => [f, account[f] ?? '']))
      const fresh = await updateProfile({ changes, was, currentPassword: emailChanged ? password : null })
      onSaved(fresh)
      setEditing(false)
      setForm(null)
      toast.success(changedCount === 1 ? 'Your profile was updated.' : `${changedCount} details were updated.`)
    } catch (error) {
      if (error.code === 'PROFILE_CHANGED') {
        toast.error(error.message)
        setEditing(false)
        onStale()
      } else if (error.errors) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0]])))
      } else {
        toast.error(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <AccountCard
        title="Personal details"
        description="Your name and where we send password-reset links."
        icon={UserRound}
        actions={
          <button type="button" onClick={start} className={buttonClass.secondary}>
            <Pencil className="size-4" aria-hidden="true" /> Edit
          </button>
        }
      >
        <dl>
          <DetailRow label="First name">{account.first_name}</DetailRow>
          <DetailRow label="Last name">{account.last_name}</DetailRow>
          <DetailRow label="Personal email" hint="Only for password-reset and invitation links. It’s never shown to other users.">
            {account.personal_email || <span className="text-muted-foreground">Not set</span>}
          </DetailRow>
        </dl>
      </AccountCard>
    )
  }

  const field = (name) => ({
    id: `profile-${name}`,
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `profile-${name}-error` : undefined,
    disabled: saving,
    className: inputClass,
  })

  return (
    <AccountCard title="Edit personal details" description="Only the fields you change are saved." icon={UserRound}>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldShell id="profile-first_name" label="First name" required error={errors.first_name}>
            <input {...field('first_name')} autoComplete="given-name" maxLength={100} />
          </FieldShell>
          <FieldShell id="profile-last_name" label="Last name" required error={errors.last_name}>
            <input {...field('last_name')} autoComplete="family-name" maxLength={100} />
          </FieldShell>
        </div>
        <FieldShell
          id="profile-personal_email"
          label="Personal email"
          required={needsPersonalEmail}
          error={errors.personal_email}
          hint="Your own inbox (e.g. Gmail). Password-reset links go here."
        >
          <input {...field('personal_email')} type="email" autoComplete="email" maxLength={255} />
        </FieldShell>

        {emailChanged && (
          <div className="flex flex-col gap-3 rounded-[10px] border border-warning/25 bg-warning-soft px-3.5 py-3">
            <p className="text-caption text-warning">
              Your next password-reset link will go to the new address
              {needsPersonalEmail ? ', and the Super Admins are told about the change' : ''}. Type your password to confirm it’s you.
            </p>
            <PasswordField
              id="profile-current_password"
              label="Your password"
              value={password}
              onChange={setPassword}
              error={errors.current_password}
              autoComplete="current-password"
              disabled={saving}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          <span className="text-caption mr-auto">
            {changedCount === 0 ? 'No changes yet' : `${changedCount} ${changedCount === 1 ? 'change' : 'changes'}`}
          </span>
          <button type="button" onClick={cancel} disabled={saving} className={buttonClass.secondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving || changedCount === 0} className={buttonClass.primary}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Save changes
          </button>
        </div>
      </form>
    </AccountCard>
  )
}
