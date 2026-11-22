import { normalizeApiError } from '@/lib/apiError'

/**
 * Turns an Axios answer fetched with { responseType: 'blob', validateStatus: () => true } into a
 * downloaded file, and returns the file name (from the server's Content-Disposition header).
 *
 * An error answer arrives as a Blob too, so it's read back as JSON first and thrown as the usual
 * ApiError ({ message, code, errors, status, requestId }): the dialog can then show it.
 */
export async function saveDownload(response, fallbackName) {
  if (response.status >= 400) {
    let data = null
    try {
      data = JSON.parse(await response.data.text())
    } catch {
      // not JSON: the generic message is used
    }
    throw normalizeApiError({ response: { status: response.status, data, headers: response.headers } })
  }

  const name = /filename="([^"]+)"/.exec(response.headers['content-disposition'] ?? '')?.[1] ?? fallbackName
  const url = URL.createObjectURL(response.data)
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  URL.revokeObjectURL(url)
  return name
}
