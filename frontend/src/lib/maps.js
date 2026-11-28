import L from 'leaflet'

/**
 * Shared bits for maps (OpenStreetMap + Leaflet, 2026-11-28: free, no key or card).
 * The address search goes through our server (features/superadmin/companies/api.js), not from here.
 */

/** Map pictures ("tiles"). OpenStreetMap's own servers are fine for light use; they ask for the credit line below. */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Where a map starts when nothing is pinned yet: the whole Philippines. */
export const DEFAULT_CENTER = [12.8797, 121.774]
export const DEFAULT_ZOOM = 5
export const PINNED_ZOOM = 17

/** Any { lat, lng } (numbers or strings) → numbers rounded to 7 decimals, what the database keeps. */
export function toLatLng({ lat, lng }) {
  const round = (n) => Math.round(Number(n) * 1e7) / 1e7
  return { lat: round(lat), lng: round(lng) }
}

/** Links that open the spot in OpenStreetMap or Google Maps (neither needs a key). */
export const openStreetMapLink = ({ lat, lng }) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${PINNED_ZOOM}/${lat}/${lng}`
export const googleMapsLink = ({ lat, lng }) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

/**
 * The pin, drawn with our Primary colour. (Leaflet's default pin images don't survive the Vite build, so
 * this one is plain SVG.) The tip of the pin sits exactly on the spot.
 */
export const pinIcon = L.divIcon({
  className: 'text-primary',
  html: `<svg width="32" height="42" viewBox="0 0 32 42" aria-hidden="true" style="filter: drop-shadow(0 2px 3px rgba(15,23,42,.35))">
    <path fill="currentColor" d="M16 0C7.2 0 0 7 0 15.7 0 27.5 16 42 16 42s16-14.5 16-26.3C32 7 24.8 0 16 0Z"/>
    <circle cx="16" cy="15.5" r="6" fill="white"/></svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
})
