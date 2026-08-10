'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Download,
  MapPin,
  Navigation,
  Pencil,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Square,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  createFleetVehicle,
  createFleetZone,
  deleteFleetTrip,
  deleteFleetZone,
  formatDurationSeconds,
  formatFleetLastSeen,
  getFleetTrackingUrl,
  groupFleetTrailPings,
  isFleetVehicleOnline,
  legDwellSeconds,
  legTravelStagnant,
  loadFleetTripPings,
  loadFleetTrips,
  loadFleetVehicles,
  loadFleetZones,
  pingIncrementSeconds,
  pingsInTimeRange,
  startFleetTrip,
  stopFleetTrip,
  tripTotalDurationSeconds,
  updateFleetVehicle,
  updateFleetZone,
  type FleetLocationPing,
  type FleetTrip,
  type FleetVehicle,
  type FleetZone,
} from '../../lib/fleet-tracking'
import { Modal } from './Modal'
import type { FleetMapVehicle } from './FleetMap'

const FleetMap = dynamic(
  () => import('./FleetMap').then((mod) => ({ default: mod.FleetMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
        Loading map…
      </div>
    ),
  }
)

type SidebarTab = 'trucks' | 'zones' | 'trips'
type LocationOption = { id: string; name: string; franchisee?: string | null }

interface FleetTrackingManagerProps {
  canManage?: boolean
}

export function FleetTrackingManager({ canManage = true }: FleetTrackingManagerProps) {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [trailsByVehicleId, setTrailsByVehicleId] = useState<Record<string, FleetLocationPing[]>>({})
  const [zones, setZones] = useState<FleetZone[]>([])
  const [trips, setTrips] = useState<FleetTrip[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [pingHighlight, setPingHighlight] = useState<{ lat: number; lng: number } | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('trucks')

  // Truck modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [qrVehicle, setQrVehicle] = useState<FleetVehicle | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newPlate, setNewPlate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Zone modals
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [editingZone, setEditingZone] = useState<FleetZone | null>(null)
  const [zoneName, setZoneName] = useState('')
  const [zoneLat, setZoneLat] = useState('')
  const [zoneLng, setZoneLng] = useState('')
  const [zoneRadius, setZoneRadius] = useState(200)
  const [zoneIsHq, setZoneIsHq] = useState(false)
  const [zoneLocationId, setZoneLocationId] = useState<string>('')
  const [pickingZoneLocation, setPickingZoneLocation] = useState(false)

  // Trip filters
  const [tripVehicleFilter, setTripVehicleFilter] = useState<string>('')
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null)
  const [tripPingsByTripId, setTripPingsByTripId] = useState<Record<string, FleetLocationPing[]>>({})
  const [expandedPingSections, setExpandedPingSections] = useState<Set<string>>(new Set())

  const [viewingTripId, setViewingTripId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [vehicleRows, zoneRows, tripRows] = await Promise.all([
        loadFleetVehicles(),
        loadFleetZones(),
        loadFleetTrips(),
      ])
      setVehicles(vehicleRows)
      setZones(zoneRows)
      setTrips(tripRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fleet data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const tripId = expandedTripId || viewingTripId
    if (!viewingTripId) {
      setTrailsByVehicleId({})
    }
    if (!tripId) return
    const trip = trips.find((t) => t.id === tripId)
    if (!trip) return

    let cancelled = false
    void (async () => {
      try {
        const pings = await loadFleetTripPings(trip)
        if (cancelled) return
        setTripPingsByTripId((prev) => ({ ...prev, [tripId]: pings }))
        if (viewingTripId === tripId) {
          setTrailsByVehicleId(groupFleetTrailPings(pings))
        }
      } catch {
        // non-critical
      }
    })()
    return () => { cancelled = true }
  }, [expandedTripId, viewingTripId, trips])

  const loadLocations = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('locations')
        .select('id, name, franchisee')
        .order('name', { ascending: true })
      setLocations((data || []) as LocationOption[])
    } catch {
      // non-critical
    }
  }, [])


  useEffect(() => {
    void refresh()
    void loadLocations()
  }, [refresh, loadLocations])

  useEffect(() => {
    const channel = supabase
      .channel('fleet-tracking-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_vehicles' }, () => { void refresh() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fleet_location_pings' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_zones' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_trips' }, () => { void refresh() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fleet_trip_legs' }, () => { void refresh() })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [refresh])

  const mapVehicles: FleetMapVehicle[] = useMemo(
    () => vehicles.map((vehicle, index) => ({ ...vehicle, colorIndex: index })),
    [vehicles]
  )

  const filteredTrips = useMemo(() => {
    if (!tripVehicleFilter) return trips
    return trips.filter((t) => t.vehicle_id === tripVehicleFilter)
  }, [trips, tripVehicleFilter])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!pickingZoneLocation) return
    setZoneLat(lat.toFixed(6))
    setZoneLng(lng.toFixed(6))
    setPickingZoneLocation(false)
    setShowZoneModal(true)
  }, [pickingZoneLocation])

  const previewPin = useMemo(() => {
    const lat = parseFloat(zoneLat)
    const lng = parseFloat(zoneLng)
    if ((showZoneModal || pickingZoneLocation) && !isNaN(lat) && !isNaN(lng)) return { lat, lng }
    return null
  }, [showZoneModal, pickingZoneLocation, zoneLat, zoneLng])

  // ---- Truck handlers ----

  const handleSelectVehicle = (vehicle: FleetVehicle) => {
    setSelectedVehicleId(vehicle.id)
    if (vehicle.last_lat != null && vehicle.last_lng != null) {
      setMapFocus({ lat: vehicle.last_lat, lng: vehicle.last_lng, zoom: 15 })
    }
  }

  const handleCopyLink = async (vehicle: FleetVehicle) => {
    const url = getFleetTrackingUrl(vehicle.tracking_token)
    try {
      await navigator.clipboard.writeText(url)
      alert('Tracking link copied.')
    } catch {
      prompt('Copy this tracking link:', url)
    }
  }

  const handleShowQr = async (vehicle: FleetVehicle) => {
    setQrVehicle(vehicle)
    setQrDataUrl(null)
    try {
      const QRCode = (await import('qrcode')).default
      const url = await QRCode.toDataURL(getFleetTrackingUrl(vehicle.tracking_token), { width: 280, margin: 1 })
      setQrDataUrl(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate QR code')
      setQrVehicle(null)
    }
  }

  const handleCreateVehicle = async () => {
    if (!newName.trim()) { alert('Enter a truck name.'); return }
    setSaving(true)
    try {
      await createFleetVehicle({ name: newName, plate_number: newPlate, notes: newNotes })
      setShowAddModal(false)
      setNewName(''); setNewPlate(''); setNewNotes('')
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add truck')
    } finally { setSaving(false) }
  }

  const handleToggleActive = async (vehicle: FleetVehicle) => {
    if (!confirm(vehicle.is_active
      ? `Deactivate ${vehicle.name}? Drivers will not be able to share location.`
      : `Reactivate ${vehicle.name}?`
    )) return
    try {
      await updateFleetVehicle(vehicle.id, { is_active: !vehicle.is_active })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update truck')
    }
  }

  // ---- Zone handlers ----

  const openZoneModal = (zone?: FleetZone) => {
    if (zone) {
      setEditingZone(zone)
      setZoneName(zone.name)
      setZoneLat(String(zone.lat))
      setZoneLng(String(zone.lng))
      setZoneRadius(zone.radius_m)
      setZoneIsHq(zone.is_hq)
      setZoneLocationId(zone.location_id || '')
    } else {
      setEditingZone(null)
      setZoneName('')
      setZoneLat('')
      setZoneLng('')
      setZoneRadius(200)
      setZoneIsHq(false)
      setZoneLocationId('')
    }
    setShowZoneModal(true)
  }

  const handleSaveZone = async () => {
    const lat = parseFloat(zoneLat)
    const lng = parseFloat(zoneLng)
    if (!zoneName.trim()) { alert('Enter a zone name.'); return }
    if (isNaN(lat) || isNaN(lng)) { alert('Enter valid latitude and longitude.'); return }

    setSaving(true)
    try {
      if (editingZone) {
        await updateFleetZone(editingZone.id, {
          name: zoneName,
          location_id: zoneLocationId || null,
          lat, lng,
          radius_m: zoneRadius,
          is_hq: zoneIsHq,
        })
      } else {
        await createFleetZone({
          name: zoneName,
          location_id: zoneLocationId || null,
          lat, lng,
          radius_m: zoneRadius,
          is_hq: zoneIsHq,
        })
      }
      setShowZoneModal(false)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save zone')
    } finally { setSaving(false) }
  }

  const handleDeleteZone = async (zone: FleetZone) => {
    if (!confirm(`Delete zone "${zone.name}"? Trip history referencing this zone will also be removed.`)) return
    try {
      await deleteFleetZone(zone.id)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete zone')
    }
  }

  const handleToggleZoneActive = async (zone: FleetZone) => {
    try {
      await updateFleetZone(zone.id, { is_active: !zone.is_active })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update zone')
    }
  }

  const handleFocusZone = (zone: FleetZone) => {
    setMapFocus({ lat: zone.lat, lng: zone.lng, zoom: 16 })
  }

  // ---- Trip handlers ----

  const handleStartTrip = async (vehicleId: string) => {
    try {
      await startFleetTrip(vehicleId)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start trip')
    }
  }

  const handleStopTrip = async (tripId: string) => {
    if (!confirm('End this trip? It will be marked as completed.')) return
    try {
      await stopFleetTrip(tripId)
      if (viewingTripId === tripId) setViewingTripId(null)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to stop trip')
    }
  }

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm('Delete this trip and all its legs? This cannot be undone.')) return
    try {
      await deleteFleetTrip(tripId)
      if (viewingTripId === tripId) setViewingTripId(null)
      if (expandedTripId === tripId) setExpandedTripId(null)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete trip')
    }
  }

  const handleViewTrip = (tripId: string) => {
    if (viewingTripId === tripId) {
      setViewingTripId(null)
    } else {
      setViewingTripId(tripId)
      const trip = trips.find((t) => t.id === tripId)
      if (trip) {
        const legs = trip.legs || []
        if (legs.length > 0) {
          const firstLeg = legs[0]
          if (firstLeg.zone) {
            const zone = zones.find((z) => z.id === firstLeg.zone_id)
            if (zone) setMapFocus({ lat: zone.lat, lng: zone.lng, zoom: 13 })
          }
        }
      }
    }
    setExpandedTripId(viewingTripId === tripId ? null : tripId)
  }

  const togglePingSection = (key: string) => {
    setExpandedPingSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleFocusPing = (lat: number, lng: number, tripId: string) => {
    setMapFocus({ lat, lng, zoom: 17 })
    setPingHighlight({ lat, lng })
    if (viewingTripId !== tripId) {
      setViewingTripId(tripId)
      setExpandedTripId(tripId)
    }
  }

  const renderPingLog = (tripId: string, sectionKey: string, pings: FleetLocationPing[], label: string) => {
    if (pings.length === 0) return null
    const key = `${tripId}:${sectionKey}`
    const isOpen = expandedPingSections.has(key)
    return (
      <div className="mt-1 mb-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); togglePingSection(key) }}
          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
        >
          {isOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />}
          <span className="font-medium">{label}</span>
          <span className="text-gray-400">({pings.length})</span>
        </button>
        {isOpen ? (
          <div className="mt-1 overflow-hidden rounded border border-gray-200 bg-gray-50">
            <div className="grid grid-cols-[3.5rem_4.25rem_1fr] gap-x-2 border-b border-gray-200 bg-gray-100/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
              <span>Δ</span>
              <span>Time</span>
              <span>Location</span>
            </div>
            <div className="max-h-40 divide-y divide-gray-100 overflow-y-auto">
              {pings.map((ping, pi) => {
                const prev = pi > 0 ? pings[pi - 1] : null
                const inc = pingIncrementSeconds(prev, ping)
                const time = new Date(ping.recorded_at).toLocaleTimeString('en-PH', {
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit',
                })
                const isHighlighted = pingHighlight
                  && Math.abs(pingHighlight.lat - ping.lat) < 0.00001
                  && Math.abs(pingHighlight.lng - ping.lng) < 0.00001
                return (
                  <div
                    key={ping.id}
                    className={`grid grid-cols-[3.5rem_4.25rem_1fr] gap-x-2 px-2 py-1.5 text-[10px] items-center ${isHighlighted ? 'bg-blue-50' : ''}`}
                  >
                    <span className="tabular-nums text-gray-400">
                      {inc != null ? `+${formatDurationSeconds(inc)}` : '—'}
                    </span>
                    <span className="tabular-nums text-gray-600 whitespace-nowrap">{time}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFocusPing(ping.lat, ping.lng, tripId)
                      }}
                      className="min-w-0 truncate text-left font-mono text-blue-600 hover:text-blue-800 hover:underline"
                      title="Show on map"
                    >
                      {ping.lat.toFixed(5)}, {ping.lng.toFixed(5)}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // ---- Render ----

  const tabBtn = (tab: SidebarTab, label: string) => (
    <button
      type="button"
      onClick={() => setSidebarTab(tab)}
      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded ${
        sidebarTab === tab
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Fleet GPS
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Live truck positions, delivery zones, and trip tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/fleet-driver/gfc-fleet-driver.apk?v=1.1.0"
            download="gfc-fleet-driver.apk"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Driver app (APK)
          </a>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add truck
              </button>
              <button
                type="button"
                onClick={() => openZoneModal()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                <Plus className="h-4 w-4" />
                Add zone
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Sidebar */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex gap-1 p-2 border-b border-gray-200">
            {tabBtn('trucks', `Trucks (${vehicles.length})`)}
            {tabBtn('zones', `Zones (${zones.length})`)}
            {tabBtn('trips', `Trips (${trips.length})`)}
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {/* === TRUCKS TAB === */}
            {sidebarTab === 'trucks' && (
              <div className="divide-y divide-gray-100">
                {loading ? (
                  <p className="px-3 py-6 text-sm text-gray-500">Loading trucks…</p>
                ) : vehicles.length === 0 ? (
                  <p className="px-3 py-6 text-sm text-gray-500">No trucks yet.</p>
                ) : (
                  vehicles.map((vehicle) => {
                    const online = isFleetVehicleOnline(vehicle.last_seen_at)
                    const selected = selectedVehicleId === vehicle.id
                    return (
                      <div key={vehicle.id} className={`px-3 py-3 ${selected ? 'bg-blue-50' : ''}`}>
                        <button type="button" onClick={() => handleSelectVehicle(vehicle)} className="w-full text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900">{vehicle.name}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              !vehicle.is_active ? 'bg-gray-100 text-gray-500'
                                : online ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                !vehicle.is_active ? 'bg-gray-400' : online ? 'bg-green-500' : 'bg-amber-500'
                              }`} />
                              {!vehicle.is_active ? 'Inactive' : online ? 'Online' : 'Stale'}
                            </span>
                          </div>
                          {vehicle.plate_number ? <p className="mt-0.5 text-xs text-gray-500">{vehicle.plate_number}</p> : null}
                          {vehicle.driver ? <p className="mt-0.5 text-xs text-gray-500">Driver: {vehicle.driver.full_name}</p> : null}
                          <p className="mt-1 text-xs text-gray-500">Last seen: {formatFleetLastSeen(vehicle.last_seen_at)}</p>
                        </button>
                        {canManage ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => void handleCopyLink(vehicle)}
                              className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50">
                              <Copy className="h-3 w-3" /> Link
                            </button>
                            <button type="button" onClick={() => void handleShowQr(vehicle)}
                              className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50">
                              <QrCode className="h-3 w-3" /> QR
                            </button>
                            <button type="button" onClick={() => void handleToggleActive(vehicle)}
                              className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50">
                              {vehicle.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* === ZONES TAB === */}
            {sidebarTab === 'zones' && (
              <div className="divide-y divide-gray-100">
                {zones.length === 0 ? (
                  <p className="px-3 py-6 text-sm text-gray-500">No zones yet. Add a zone to start tracking trips.</p>
                ) : (
                  zones.map((zone) => (
                    <div key={zone.id} className="px-3 py-3">
                      <button type="button" onClick={() => handleFocusZone(zone)} className="w-full text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900 flex items-center gap-1.5">
                            {zone.is_hq ? (
                              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" title="HQ" />
                            ) : (
                              <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-500" />
                            )}
                            {zone.name}
                          </span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            zone.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {zone.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {zone.location?.name ? (
                          <p className="mt-0.5 text-xs text-gray-500">{zone.location.name}{zone.location.franchisee ? ` (${zone.location.franchisee})` : ''}</p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-gray-500">
                          {zone.lat.toFixed(5)}, {zone.lng.toFixed(5)} · {zone.radius_m}m radius
                          {zone.is_hq ? ' · HQ' : ''}
                        </p>
                      </button>
                      {canManage ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => openZoneModal(zone)}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50">
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button type="button" onClick={() => void handleToggleZoneActive(zone)}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50">
                            {zone.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" onClick={() => void handleDeleteZone(zone)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* === TRIPS TAB === */}
            {sidebarTab === 'trips' && (
              <div>
                <div className="px-3 py-2 border-b border-gray-100 space-y-2">
                  <select
                    value={tripVehicleFilter}
                    onChange={(e) => setTripVehicleFilter(e.target.value)}
                    className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
                  >
                    <option value="">All trucks</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  {canManage && tripVehicleFilter ? (
                    <button
                      type="button"
                      onClick={() => void handleStartTrip(tripVehicleFilter)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <Play className="h-3 w-3" />
                      Start new trip for {vehicles.find((v) => v.id === tripVehicleFilter)?.name || 'truck'}
                    </button>
                  ) : null}
                </div>
                <div className="divide-y divide-gray-100">
                  {filteredTrips.length === 0 ? (
                    <p className="px-3 py-6 text-sm text-gray-500">No trips recorded yet.{tripVehicleFilter ? ' Select a truck above and start one.' : ''}</p>
                  ) : (
                    filteredTrips.map((trip) => {
                      const expanded = expandedTripId === trip.id
                      const isViewing = viewingTripId === trip.id
                      const legs = trip.legs || []
                      const tripPings = tripPingsByTripId[trip.id] || []
                      const totalDur = tripTotalDurationSeconds(legs)
                      const isActive = trip.status === 'in_progress'
                      return (
                        <div key={trip.id} className={`px-3 py-2 ${isViewing ? 'bg-blue-50' : ''}`}>
                          <button
                            type="button"
                            onClick={() => handleViewTrip(trip.id)}
                            className="w-full text-left flex items-start gap-2"
                          >
                            {expanded ? <ChevronDown className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {trip.vehicle?.name || 'Truck'}
                                  {trip.driver ? (
                                    <span className="font-normal text-gray-500"> · {trip.driver.full_name}</span>
                                  ) : null}
                                </span>
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                  isActive ? 'bg-blue-100 text-blue-800'
                                    : trip.status === 'cancelled' ? 'bg-gray-100 text-gray-600'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {isActive ? 'In progress' : trip.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {(() => {
                                  const d = new Date(trip.started_at)
                                  const now = new Date()
                                  const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
                                  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
                                  return isToday ? `Today, ${time}` : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                })()}
                                {' · '}{legs.length} stop{legs.length !== 1 ? 's' : ''}
                                {totalDur > 0 ? ` · ${formatDurationSeconds(totalDur)}` : ''}
                              </p>
                            </div>
                          </button>

                          {expanded ? (
                            <div className="ml-4 mt-2 border-l-2 border-gray-200 pl-3">
                              {legs.length > 0 ? (
                                <div className="space-y-2 mb-2">
                                  {legs.map((leg, i) => {
                                    const nextLeg = i < legs.length - 1 ? legs[i + 1] : null
                                    const prevLeg = i > 0 ? legs[i - 1] : null
                                    const dwell = legDwellSeconds(leg, nextLeg)
                                    const stagnantTravel = legTravelStagnant(leg)
                                    const travelPings = prevLeg && leg.duration_from_prev_s != null
                                      ? pingsInTimeRange(
                                          tripPings,
                                          prevLeg.departed_at || prevLeg.arrived_at,
                                          leg.arrived_at
                                        )
                                      : []
                                    const dwellEnd = leg.departed_at
                                      || nextLeg?.arrived_at
                                      || (isActive && !nextLeg ? new Date().toISOString() : null)
                                    const dwellPings = dwellEnd
                                      ? pingsInTimeRange(tripPings, leg.arrived_at, dwellEnd)
                                      : []
                                    return (
                                      <div key={leg.id} className="space-y-1">
                                        {leg.duration_from_prev_s != null ? (
                                          <div className="space-y-0.5">
                                            <div className={`flex items-center gap-1.5 text-[10px] ${stagnantTravel ? 'font-medium text-amber-600' : 'text-gray-500'}`}>
                                              {stagnantTravel ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" /> : null}
                                              <span>{formatDurationSeconds(leg.duration_from_prev_s)} travel{stagnantTravel ? ' — unusually long' : ''}</span>
                                            </div>
                                            {renderPingLog(trip.id, `travel:${leg.id}`, travelPings, 'GPS log')}
                                          </div>
                                        ) : null}
                                        <div className="flex gap-2">
                                          <div className="flex w-3 shrink-0 justify-center pt-0.5">
                                            {leg.zone?.is_hq ? (
                                              <Circle className="h-3 w-3 text-red-500 fill-red-500" />
                                            ) : (
                                              <Navigation className="h-3 w-3 text-purple-500" />
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                              <span className="text-xs font-medium text-gray-800">
                                                {leg.zone?.name || 'Unknown zone'}
                                              </span>
                                              <span className="text-[10px] text-gray-400 tabular-nums">
                                                {new Date(leg.arrived_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                                              </span>
                                              {dwell != null ? (
                                                <span className="text-[10px] text-blue-600">
                                                  stayed {formatDurationSeconds(dwell)}
                                                </span>
                                              ) : !nextLeg && isActive ? (
                                                <span className="text-[10px] text-blue-600">currently here</span>
                                              ) : null}
                                            </div>
                                            {renderPingLog(trip.id, `dwell:${leg.id}`, dwellPings, 'At zone')}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 mb-2">No stops recorded yet.</p>
                              )}

                              {canManage ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {isActive ? (
                                    <button type="button" onClick={() => void handleStopTrip(trip.id)}
                                      className="inline-flex items-center gap-1 rounded border border-amber-200 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-50">
                                      <Square className="h-3 w-3" /> End trip
                                    </button>
                                  ) : null}
                                  <button type="button" onClick={() => void handleDeleteTrip(trip.id)}
                                    className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50">
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="relative z-0 isolate min-h-[420px] h-[min(70vh,560px)] overflow-hidden rounded-lg border border-gray-200 bg-white p-1">
          {pickingZoneLocation ? (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
              <span>Click on the map to set zone location</span>
              <button
                type="button"
                onClick={() => { setPickingZoneLocation(false); setShowZoneModal(true) }}
                className="rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30"
              >
                Cancel
              </button>
            </div>
          ) : null}
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading map…</div>
          ) : (
            <FleetMap
              vehicles={mapVehicles}
              trailsByVehicleId={viewingTripId ? trailsByVehicleId : {}}
              selectedVehicleId={selectedVehicleId}
              focus={mapFocus}
              zones={zones}
              highlightPin={pingHighlight}
              onMapClick={pickingZoneLocation ? handleMapClick : undefined}
              pickingLocation={pickingZoneLocation}
              previewPin={previewPin}
              previewRadius={previewPin ? zoneRadius : undefined}
            />
          )}
        </div>
      </div>

      {/* === ADD TRUCK MODAL === */}
      {showAddModal ? (
        <Modal onClose={() => setShowAddModal(false)} align="center" zIndex={1000}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add truck</h3>
              <button type="button" onClick={() => setShowAddModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-gray-700">Name</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Truck 1" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Plate number (optional)</span>
                <input value={newPlate} onChange={(e) => setNewPlate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="ABC 1234" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Notes (optional)</span>
                <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">Cancel</button>
              <button type="button" disabled={saving} onClick={() => void handleCreateVehicle()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add truck'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* === QR MODAL === */}
      {qrVehicle ? (
        <Modal onClose={() => setQrVehicle(null)} align="center" zIndex={1000}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl text-center">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{qrVehicle.name}</h3>
              <button type="button" onClick={() => setQrVehicle(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <p className="mb-3 text-sm text-gray-600">Scan with the GFC Fleet app (recommended) or open in a browser.</p>
            <p className="mb-3 text-xs text-gray-500">
              Install the driver app from the Fleet tab first. On Android, allow location &quot;All the time&quot; when prompted.
            </p>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR code for ${qrVehicle.name}`} className="mx-auto" />
            ) : (
              <p className="text-sm text-gray-500">Generating QR…</p>
            )}
            <button type="button" onClick={() => void handleCopyLink(qrVehicle)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Copy className="h-4 w-4" /> Copy link
            </button>
          </div>
        </Modal>
      ) : null}

      {/* === ZONE MODAL === */}
      {showZoneModal ? (
        <Modal onClose={() => setShowZoneModal(false)} align="center" zIndex={1000}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingZone ? 'Edit zone' : 'Add zone'}</h3>
              <button type="button" onClick={() => setShowZoneModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-gray-700">Zone name</span>
                <input value={zoneName} onChange={(e) => setZoneName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. HQ, Branch Cebu" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Linked branch (optional)</span>
                <select value={zoneLocationId} onChange={(e) => setZoneLocationId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}{loc.franchisee ? ` (${loc.franchisee})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">Location</span>
                  <button
                    type="button"
                    onClick={() => { setShowZoneModal(false); setPickingZoneLocation(true) }}
                    className="inline-flex items-center gap-1 rounded bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-200"
                  >
                    <MapPin className="h-3 w-3" />
                    {zoneLat && zoneLng ? 'Re-pick from map' : 'Pick from map'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="text-gray-500 text-xs">Latitude</span>
                    <input value={zoneLat} onChange={(e) => setZoneLat(e.target.value)} type="number" step="any"
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="10.3157" />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-500 text-xs">Longitude</span>
                    <input value={zoneLng} onChange={(e) => setZoneLng(e.target.value)} type="number" step="any"
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="123.8854" />
                  </label>
                </div>
                {zoneLat && zoneLng ? (
                  <p className="mt-1 text-xs text-green-600">
                    Pin set at {parseFloat(zoneLat).toFixed(5)}, {parseFloat(zoneLng).toFixed(5)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    Click &quot;Pick from map&quot; and click on the fleet map, or type coordinates manually.
                  </p>
                )}
              </div>
              <label className="block text-sm">
                <span className="text-gray-700">Radius: {zoneRadius}m</span>
                <input type="range" min={50} max={1000} step={10} value={zoneRadius}
                  onChange={(e) => setZoneRadius(Number(e.target.value))}
                  className="mt-1 w-full" />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>50m</span><span>500m</span><span>1000m</span>
                </div>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={zoneIsHq} onChange={(e) => setZoneIsHq(e.target.checked)}
                  className="rounded border-gray-300" />
                <span className="text-gray-700">This is the HQ (headquarters / starting point)</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowZoneModal(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">Cancel</button>
              <button type="button" disabled={saving} onClick={() => void handleSaveZone()}
                className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Saving…' : editingZone ? 'Save changes' : 'Add zone'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" />
        Click a trip to view its path on the map. Online = seen within 30 seconds. Zones auto-track trip durations.
      </p>
    </div>
  )
}
