import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { ExternalLink, Loader2, MapPin, Search, TriangleAlert } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { normalizeApiError } from '@/lib/apiError'
import { DEFAULT_CENTER, DEFAULT_ZOOM, googleMapsLink, pinIcon, PINNED_ZOOM, TILE_ATTRIBUTION, TILE_URL, toLatLng } from '@/lib/maps'
import { cn } from '@/lib/utils'
import { reversePlace, searchPlaces } from '../api'
import MapSizeFix from './MapSizeFix'

/** Shorter addresses ("Pasig") are too vague to pin by themselves. */
const MIN_ADDRESS_LENGTH = 8
/** Wait this long after the last key press before looking the typed address up (the free search allows 1 a second). */
const TYPING_PAUSE_MS = 1500

const searchProblem = (error) => {
  const { status, message } = normalizeApiError(error)
  if (status === 429) return 'Too many searches in a minute. Wait a moment, or place the pin on the map by hand.'
  return status === 503 ? message : 'The search didn’t work. Try again, or place the pin on the map by hand.'
}

/**
 * "+ Add company" location (user request 2026-11-28; OpenStreetMap + Leaflet, chosen over Google Maps: no card or key).
 *  - search a place (Enter or the Search button) → pick a result → the pin drops there and the Address field fills in
 *  - click the map or drag the pin → the Address field gets the nearest address
 *  - type a full address in the Address field → after a short pause the pin moves there by itself
 * `pin` = { lat, lng, placeId } | null. `onAddressFromMap(text)` writes the Address field.
 * Searches go through our server (/superadmin/places/*), never straight from the browser.
 */
export default function LocationPicker({ address, pin, disabled, onPinChange, onAddressFromMap }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState({ status: 'idle', results: [], error: null }) // idle | searching | done | error
  const [note, setNote] = useState(null) // { tone: 'success' | 'warning' | 'muted' | 'busy', text }
  const [view, setView] = useState(null) // { center, zoom, n }: where the map should move to
  const [tilesFailed, setTilesFailed] = useState(false)

  const fromMapRef = useRef(null) // the address text the MAP wrote, so it isn't looked up again
  const latest = useRef({ onPinChange, onAddressFromMap })
  useEffect(() => {
    latest.current = { onPinChange, onAddressFromMap }
  })

  const moveTo = (spot, zoom = PINNED_ZOOM) => setView((v) => ({ center: [spot.lat, spot.lng], zoom, n: (v?.n ?? 0) + 1 }))

  const fillAddress = (text) => {
    if (!text) return
    fromMapRef.current = text
    latest.current.onAddressFromMap(text)
  }

  // ---------------------------------------------------------------- search box
  const runSearch = async () => {
    const text = query.trim()
    if (text.length < 3) {
      setSearch({ status: 'error', results: [], error: 'Type at least 3 letters.' })
      return
    }
    setSearch({ status: 'searching', results: [], error: null })
    try {
      setSearch({ status: 'done', results: await searchPlaces(text), error: null })
    } catch (error) {
      setSearch({ status: 'error', results: [], error: searchProblem(error) })
    }
  }

  const choose = (place) => {
    const spot = toLatLng({ lat: place.latitude, lng: place.longitude })
    onPinChange({ ...spot, placeId: place.place_id })
    fillAddress(place.label)
    moveTo(spot)
    setSearch({ status: 'idle', results: [], error: null })
    setNote({ tone: 'success', text: 'Pinned from the search. The address was filled in: check it and edit it if needed.' })
  }

  // ---------------------------------------------------------------- click / drag → nearest address
  const placeByHand = async (latLng) => {
    if (disabled) return
    const spot = toLatLng(latLng)
    onPinChange({ ...spot, placeId: null })
    setNote({ tone: 'busy', text: 'Pinned. Looking up the address of this spot…' })
    try {
      const place = await reversePlace(spot)
      if (place?.label) {
        fillAddress(place.label)
        setNote({ tone: 'success', text: 'Pinned. The address was filled in from the map: check it and edit it if needed.' })
      } else {
        setNote({ tone: 'warning', text: 'Pinned, but no address was found for this spot. Type it in the Address field.' })
      }
    } catch (error) {
      setNote({ tone: 'warning', text: `Pinned. ${searchProblem(error)}` })
    }
  }

  // ---------------------------------------------------------------- typed address → pin, after a pause
  const typed = useDebounce((address ?? '').trim(), TYPING_PAUSE_MS)

  useEffect(() => {
    if (typed.length < MIN_ADDRESS_LENGTH || typed === fromMapRef.current) return undefined
    let stale = false
    searchPlaces(typed)
      .then((results) => {
        if (stale) return
        const best = results[0]
        if (!best) {
          setNote({ tone: 'warning', text: 'This address wasn’t found on the map. Search for a nearby place or click the map instead.' })
          return
        }
        const spot = toLatLng({ lat: best.latitude, lng: best.longitude })
        latest.current.onPinChange({ ...spot, placeId: best.place_id })
        setView((v) => ({ center: [spot.lat, spot.lng], zoom: PINNED_ZOOM, n: (v?.n ?? 0) + 1 }))
        setNote({ tone: 'success', text: 'Pinned from the address you typed. Drag the pin if it’s not the exact spot.' })
      })
      .catch((error) => !stale && setNote({ tone: 'warning', text: searchProblem(error) }))
    return () => {
      stale = true
    }
  }, [typed])

  const removePin = () => {
    onPinChange(null)
    setNote({ tone: 'muted', text: 'Pin removed. The address text is kept.' })
  }

  const searching = search.status === 'searching'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-label">Location on the map</p>
        <p className="text-caption">Optional</p>
      </div>

      {/* search: Enter must search, not submit the whole form */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  runSearch()
                } else if (e.key === 'Escape' && search.results.length) {
                  e.stopPropagation() // close the results, not the whole dialog
                  setSearch({ status: 'idle', results: [], error: null })
                }
              }}
              disabled={disabled}
              maxLength={200}
              aria-label="Search for a place or an address"
              placeholder="Search a place, e.g. SM Megamall, Mandaluyong"
              className="text-body h-10 w-full rounded-lg border bg-card pr-3 pl-9 outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={runSearch}
            disabled={disabled || searching}
            className="text-body-strong flex h-10 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {searching && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {(search.status === 'done' || search.status === 'error') && (
          <div className="absolute inset-x-0 top-full z-[1000] mt-1 overflow-hidden rounded-[10px] border bg-card shadow-lg">
            {search.status === 'error' ? (
              <p role="alert" className="text-caption flex items-start gap-1.5 px-3.5 py-3 text-danger">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {search.error}
              </p>
            ) : search.results.length === 0 ? (
              <p className="text-caption px-3.5 py-3">
                Nothing found. Try a shorter search (a building, street or city), or click the map to place the pin.
              </p>
            ) : (
              <ul aria-label="Search results">
                {search.results.map((place) => (
                  <li key={`${place.place_id}-${place.latitude}-${place.longitude}`}>
                    <button
                      type="button"
                      onClick={() => choose(place)}
                      className="flex w-full items-start gap-2.5 border-b px-3.5 py-2.5 text-left outline-none last:border-b-0 hover:bg-primary-faint focus-visible:bg-primary-faint"
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="text-body block">{place.label}</span>
                        {place.kind && <span className="text-caption block capitalize">{place.kind}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setSearch({ status: 'idle', results: [], error: null })}
              className="text-caption w-full border-t bg-muted px-3.5 py-2 text-left outline-none hover:text-foreground focus-visible:text-foreground"
            >
              Close
            </button>
          </div>
        )}
      </div>

      <div className={cn('relative overflow-hidden rounded-[10px] border', disabled && 'pointer-events-none opacity-70')}>
        <MapContainer
          center={pin ? [pin.lat, pin.lng] : DEFAULT_CENTER}
          zoom={pin ? PINNED_ZOOM : DEFAULT_ZOOM}
          scrollWheelZoom={false}
          className="z-0 h-[260px] w-full bg-muted"
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} eventHandlers={{ tileerror: () => setTilesFailed(true) }} />
          <MapSizeFix />
          <MoveTo view={view} />
          <ClickToPin onPick={placeByHand} />
          {pin && (
            <Marker
              position={[pin.lat, pin.lng]}
              icon={pinIcon}
              draggable={!disabled}
              title="Company location (drag to move)"
              eventHandlers={{ dragend: (e) => placeByHand(e.target.getLatLng()) }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-caption">Search above, click the map, or type the full address: the pin follows. Drag the pin to fine-tune it.</p>

      {tilesFailed && (
        <p role="status" className="text-caption flex items-start gap-1.5 text-warning">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          Some map pictures couldn’t load. Check the internet connection; the address text still saves.
        </p>
      )}

      {note && (
        <p
          role="status"
          className={cn(
            'text-caption flex items-start gap-1.5',
            note.tone === 'success' && 'text-success',
            note.tone === 'warning' && 'text-warning',
          )}
        >
          {note.tone === 'warning' && <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />}
          {note.tone === 'busy' && <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" aria-hidden="true" />}
          {note.text}
        </p>
      )}

      {pin && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-primary-faint px-3.5 py-2.5">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-body-strong tabular-nums">
            {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
          </span>
          <a
            href={googleMapsLink(pin)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-auth-link flex items-center gap-1 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Open in Google Maps <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={removePin}
            disabled={disabled}
            className="text-body-strong ml-auto rounded px-1 text-muted-foreground outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            Remove pin
          </button>
        </div>
      )}
    </div>
  )
}

/** Moves the map when a search or a typed address placed the pin (a click doesn't move it). */
function MoveTo({ view }) {
  const map = useMap()
  useEffect(() => {
    if (view) map.flyTo(view.center, view.zoom, { duration: 0.8 })
  }, [map, view])
  return null
}

function ClickToPin({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng) })
  return null
}
