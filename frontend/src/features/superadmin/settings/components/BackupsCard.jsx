import { Link } from 'react-router-dom'
import { Database } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import LockedValue from './LockedValue'
import SettingRow from './SettingRow'
import SettingsCard from './SettingsCard'

/**
 * Data & backups (in the section list, no design for its card yet): READ-ONLY, because these
 * come from the server's configuration (config/backup.php, .env), not from this page.
 */
export default function BackupsCard({ backups }) {
  return (
    <SettingsCard
      id="backups"
      icon={Database}
      tone="success"
      title="Data & backups"
      caption="Set in the server’s configuration. Shown here so you know what runs."
    >
      <SettingRow id="backup-time" title="Nightly backup" caption="A full copy of the database, every night.">
        <LockedValue>Every day at {backups?.nightly_at ?? '—'}</LockedValue>
      </SettingRow>
      <SettingRow id="backup-keep" title="Backups kept" caption="Older copies are deleted automatically.">
        <LockedValue>Newest {backups?.keep ?? '—'}</LockedValue>
      </SettingRow>
      <p className="text-caption border-t px-5 py-3">
        Need one now? Use <span className="text-body-strong text-foreground">Run backup</span> on the{' '}
        <Link to={PATHS.SUPERADMIN} className="rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
          Overview
        </Link>
        .
      </p>
    </SettingsCard>
  )
}
