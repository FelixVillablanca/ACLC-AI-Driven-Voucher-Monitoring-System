import { useState } from 'react'
import { Lock } from 'lucide-react'
import IconInput from './IconInput'

/** Password field with a Show / Hide toggle (Framer: "🔒 •••••••• Show"). */
export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false)

  return (
    <IconInput
      icon={Lock}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
      {...props}
    />
  )
}
