import { useEffect, useState } from 'react'
import { getBackup } from '../api'

const ASK_EVERY_MS = 3000

/**
 * POLLING: asks the server about one backup every 3 seconds until it has finished.
 *   backup: the latest answer (starts with what we already know)
 *   checkFailed: the last check couldn't reach the server (we keep trying)
 *   waitingSeconds: how long it has been waiting for the worker (0 once it runs)
 * Stops by itself once the backup succeeded or failed, or when the dialog closes.
 */
export function useBackupProgress(initial) {
  const [backup, setBackup] = useState(initial)
  const [checkFailed, setCheckFailed] = useState(false)
  const [checkedAt, setCheckedAt] = useState(() => Date.now())
  const finished = backup.status === 'succeeded' || backup.status === 'failed'

  useEffect(() => {
    if (finished) return
    const timer = setInterval(() => {
      getBackup(backup.id)
        .then((latest) => {
          setBackup(latest)
          setCheckFailed(false)
        })
        .catch(() => setCheckFailed(true))
        .finally(() => setCheckedAt(Date.now()))
    }, ASK_EVERY_MS)
    return () => clearInterval(timer)
  }, [backup.id, finished])

  const waitingSeconds =
    backup.status === 'queued' && backup.created_at ? Math.max(0, (checkedAt - new Date(backup.created_at).getTime()) / 1000) : 0

  return { backup, finished, checkFailed, waitingSeconds }
}
