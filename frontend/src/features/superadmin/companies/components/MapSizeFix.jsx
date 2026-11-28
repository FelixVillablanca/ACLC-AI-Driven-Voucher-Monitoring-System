import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * Put inside a <MapContainer> that sits in a dialog or side panel. They open with an animation, and Leaflet
 * measures the map while it's still small; once the animation is done, this makes it measure the real size again
 * (otherwise parts of the map stay grey).
 */
export default function MapSizeFix({ delay = 300 }) {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), delay)
    return () => clearTimeout(timer)
  }, [map, delay])
  return null
}
