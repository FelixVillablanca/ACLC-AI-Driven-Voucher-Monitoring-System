import Pill from '@/components/common/Pill'

const TONES = { issued: 'primary', released: 'warning', cleared: 'success', stale: 'danger', cancelled: 'neutral' }

/** The cheque's status as a coloured pill (Issued / Released / Cleared / Stale / Cancelled). */
export default function ChequeStatusPill({ cheque }) {
  return <Pill tone={TONES[cheque.status] ?? 'neutral'}>{cheque.status_label}</Pill>
}
