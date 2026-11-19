/**
 * Turns ANY failed request into the same simple shape, so screens never
 * have to dig through Axios internals:
 *
 *   error.message    "Text to show the user"
 *   error.code       "VALIDATION_FAILED" | "NOT_FOUND" | "NETWORK_ERROR" | ...
 *   error.status     422, 404, 0 (0 = server unreachable)
 *   error.errors     { field: ["problem"] }  (form errors only)
 *   error.requestId  tracking number to quote when reporting a bug
 */
export class ApiError extends Error {
  constructor({ message, code, status, errors = null, requestId = null }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.errors = errors
    this.requestId = requestId
  }
}

export function normalizeApiError(error) {
  if (error instanceof ApiError) return error

  // The server answered with an error (4xx / 5xx)
  if (error?.response) {
    const { status, data, headers } = error.response
    return new ApiError({
      status,
      message: data?.message || 'Something went wrong. Please try again.',
      code: data?.code || `HTTP_${status}`,
      errors: data?.errors || null,
      requestId: data?.request_id || headers?.['x-request-id'] || null,
    })
  }

  // The request was sent but no answer came back (server off, no internet)
  if (error?.request) {
    return new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: "Can't reach the server. Check your connection and try again.",
    })
  }

  // A bug in our own code before the request was even sent
  return new ApiError({
    status: 0,
    code: 'CLIENT_ERROR',
    message: error?.message || 'Unexpected error.',
  })
}

/**
 * Puts the server's form errors (422) under the matching inputs of a
 * react-hook-form form. Returns true if any field error was applied.
 *
 *   catch (err) { if (!applyFieldErrors(err, setError)) toast.error(err.message) }
 */
export function applyFieldErrors(error, setError) {
  if (!error?.errors) return false
  const applied = new Set()
  Object.entries(error.errors).forEach(([field, messages]) => {
    // List errors like "company_ids.1" belong to the "company_ids" field
    const name = field.split('.')[0]
    if (applied.has(name)) return
    applied.add(name)
    setError(name, { type: 'server', message: messages[0] }, { shouldFocus: applied.size === 1 })
  })
  return true
}
