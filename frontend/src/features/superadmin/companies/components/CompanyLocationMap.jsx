import { useState } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { ExternalLink, MapPin, TriangleAlert } from 'lucide-react'
import { googleMapsLink, openStreetMapLink, pinIcon, TILE_ATTRIBUTION, TILE_URL } from '@/lib/maps'
import MapSizeFix from './MapSizeFix'

/**
 * The company's pin in the side panel (Overview tab), read-only (OpenStreetMap + Leaflet).
 * `location` = { latitude, longitude, place_id } as the API sends it (DECIMAL strings).
 */
export default function CompanyLocationMap({ location, name }) {
  const spot = { lat: Number(location.latitude), lng: Number(location.longitude) }
  const [tilesFailed, setTilesFailed] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-[10px] border">
        <MapContainer
          center={[spot.lat, spot.lng]}
          zoom={16}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          className="z-0 h-[180px] w-full bg-muted"
          aria-label={`Map showing where ${name} is`}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} eventHandlers={{ tileerror: () => setTilesFailed(true) }} />
          <MapSizeFix />
          <Marker position={[spot.lat, spot.lng]} icon={pinIcon} title={name} keyboard={false} />
        </MapContainer>
      </div>
      {tilesFailed && (
        <p className="text-caption flex items-center gap-1.5 text-warning">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" /> Some map pictures couldn’t load.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-caption tabular-nums">
          {spot.lat.toFixed(6)}, {spot.lng.toFixed(6)}
        </span>
        <a
          href={googleMapsLink(spot)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-auth-link ml-auto flex items-center gap-1 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Google Maps <ExternalLink className="size-3" aria-hidden="true" />
        </a>
        <a
          href={openStreetMapLink(spot)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-auth-link flex items-center gap-1 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          OpenStreetMap <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}
