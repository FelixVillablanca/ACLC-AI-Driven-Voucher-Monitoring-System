import { useCallback, useEffect, useState } from 'react'
import { getNextEmployeeId } from '../api'

/**
 * The read-only Employee ID preview: { status, employeeId, reload }.
 * It's only a preview: the server assigns the real ID when the user is saved,
 * so if this request fails the form still works (the field just says "Assigned automatically").
 */
export function useNextEmployeeId() {
  const [state, setState] = useState({ status: 'loading', employeeId: null })

  const load = useCallback(
    () =>
      getNextEmployeeId()
        .then((employeeId) => setState({ status: 'success', employeeId }))
        .catch(() => setState({ status: 'error', employeeId: null })),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  return { ...state, reload: load }
}
