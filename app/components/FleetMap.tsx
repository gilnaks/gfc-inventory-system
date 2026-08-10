'use client'

import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { FleetLocationPing, FleetVehicle, FleetZone } from '../../lib/fleet-tracking'
import { fleetTrailColor } from '../../lib/fleet-tracking'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER: [number, number] = [10.3157, 123.8854]
/** Furthest zoom-out / pan: 20 km from HQ (or default center if no HQ zone). */
const MAX_VIEW_RADIUS_KM = 20

function boundsForRadiusKm(lat: number, lng: number, radiusKm: number): L.LatLngBounds {
  const latDelta = radiusKm / 111
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.abs(cosLat)))
  return L.latLngBounds(
    [lat - latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta]
  )
}

const truckIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:9999px;border:2px solid white;background:#2563eb;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:9999px;border:3px solid #7c3aed;background:#ede9fe;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const pingHighlightIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:9999px;border:3px solid #ea580c;background:#ffedd5;box-shadow:0 2px 6px rgba(0,0,0,.45)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function MapFocus({
  focus,
}: {
  focus: { lat: number; lng: number; zoom?: number } | null
}) {
  const map = useMap()

  useEffect(() => {
    if (!focus) return
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? 14, { duration: 0.6 })
  }, [focus, map])

  return null
}

/** Cap zoom-out to ~20 km around HQ; expand pan bounds so they match the max-zoom viewport. */
function MapHqViewLimit({
  origin,
}: {
  origin: { lat: number; lng: number }
}) {
  const map = useMap()

  useEffect(() => {
    const apply = () => {
      const contentBounds = boundsForRadiusKm(origin.lat, origin.lng, MAX_VIEW_RADIUS_KM)
      const minZoom = Math.max(1, map.getBoundsZoom(contentBounds, false))
      map.setMinZoom(minZoom)

      const prevCenter = map.getCenter()
      const prevZoom = map.getZoom()

      // At minZoom the viewport is often wider/taller than the 20 km square, so Leaflet
      // maxBounds must cover that viewport or pan rubber-bands against max zoom-out.
      map.setView([origin.lat, origin.lng], minZoom, { animate: false })
      const viewAtMinZoom = map.getBounds()
      const panBounds = L.latLngBounds(
        contentBounds.getSouthWest(),
        contentBounds.getNorthEast()
      )
      panBounds.extend(viewAtMinZoom.getSouthWest())
      panBounds.extend(viewAtMinZoom.getNorthEast())
      map.setMaxBounds(panBounds.pad(0.01))
      map.options.maxBoundsViscosity = 1

      const restoreZoom = Math.max(prevZoom, minZoom)
      if (panBounds.contains(prevCenter)) {
        map.setView(prevCenter, restoreZoom, { animate: false })
      } else {
        map.setView([origin.lat, origin.lng], restoreZoom, { animate: false })
      }
    }

    apply()
    map.on('resize', apply)
    return () => {
      map.off('resize', apply)
    }
  }, [map, origin.lat, origin.lng])

  return null
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export type FleetMapVehicle = FleetVehicle & { colorIndex: number }

export function FleetMap({
  vehicles,
  trailsByVehicleId = {},
  selectedVehicleId = null,
  focus,
  zones = [],
  onMapClick,
  pickingLocation = false,
  previewPin,
  previewRadius,
  highlightPin,
}: {
  vehicles: FleetMapVehicle[]
  /** Historical trip path lines (shown when a trip is selected). */
  trailsByVehicleId?: Record<string, FleetLocationPing[]>
  selectedVehicleId?: string | null
  focus: { lat: number; lng: number; zoom?: number } | null
  zones?: FleetZone[]
  onMapClick?: (lat: number, lng: number) => void
  pickingLocation?: boolean
  previewPin?: { lat: number; lng: number } | null
  previewRadius?: number
  highlightPin?: { lat: number; lng: number } | null
}) {
  const positioned = useMemo(
    () =>
      vehicles.filter(
        (v) => v.last_lat != null && v.last_lng != null && v.is_active
      ),
    [vehicles]
  )

  const hqOrigin = useMemo(() => {
    const hq = zones.find((z) => z.is_active && z.is_hq)
    if (hq) return { lat: hq.lat, lng: hq.lng }
    return { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }
  }, [zones])

  const center = useMemo<[number, number]>(() => {
    if (focus) return [focus.lat, focus.lng]
    if (positioned.length > 0) {
      return [positioned[0].last_lat as number, positioned[0].last_lng as number]
    }
    return [hqOrigin.lat, hqOrigin.lng]
  }, [focus, positioned, hqOrigin.lat, hqOrigin.lng])

  const zoom = focus ? focus.zoom ?? 14 : positioned.length > 0 ? 12 : 11

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`fleet-map-container h-full w-full rounded-lg ${pickingLocation ? 'cursor-crosshair' : ''}`}
      scrollWheelZoom
      attributionControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapHqViewLimit origin={hqOrigin} />
      <MapFocus focus={focus} />
      {onMapClick ? <MapClickHandler onClick={onMapClick} /> : null}

      {zones.filter((z) => z.is_active).map((zone) => (
        <Circle
          key={`zone-${zone.id}`}
          center={[zone.lat, zone.lng]}
          radius={zone.radius_m}
          pathOptions={{
            color: zone.is_hq ? '#dc2626' : '#7c3aed',
            fillColor: zone.is_hq ? '#dc2626' : '#7c3aed',
            fillOpacity: 0.12,
            weight: 2,
            opacity: 0.6,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent={false}>
            <span className="text-xs font-medium">
              {zone.is_hq ? '🏭 ' : '📍 '}
              {zone.name}
              {zone.location?.name ? ` — ${zone.location.name}` : ''}
              {` (${zone.radius_m}m)`}
            </span>
          </Tooltip>
        </Circle>
      ))}

      {previewPin ? (
        <>
          <Marker position={[previewPin.lat, previewPin.lng]} icon={pinIcon} />
          {previewRadius ? (
            <Circle
              center={[previewPin.lat, previewPin.lng]}
              radius={previewRadius}
              pathOptions={{
                color: '#7c3aed',
                fillColor: '#7c3aed',
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '6 4',
              }}
            />
          ) : null}
        </>
      ) : null}

      {highlightPin ? (
        <Marker position={[highlightPin.lat, highlightPin.lng]} icon={pingHighlightIcon} />
      ) : null}

      {Object.entries(trailsByVehicleId).map(([vehicleId, trail]) => {
        if (trail.length < 2) return null
        const vehicle = vehicles.find((v) => v.id === vehicleId)
        const color = fleetTrailColor(vehicle?.colorIndex ?? 0)
        const points = trail.map((p) => [p.lat, p.lng] as [number, number])
        return (
          <Polyline
            key={`trail-${vehicleId}`}
            positions={points}
            pathOptions={{
              color,
              weight: selectedVehicleId === vehicleId ? 5 : 4,
              opacity: selectedVehicleId === vehicleId ? 0.95 : 0.85,
            }}
          />
        )
      })}

      {positioned.map((vehicle) => (
        <Marker
          key={vehicle.id}
          position={[vehicle.last_lat as number, vehicle.last_lng as number]}
          icon={truckIcon}
        />
      ))}
    </MapContainer>
  )
}
