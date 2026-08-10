import { supabase } from './supabase'
import { formatPhilippinesDateTime } from './timezone'

export const FLEET_TRAIL_HOURS = 4
export const FLEET_ONLINE_THRESHOLD_MS = 30 * 1000
export const FLEET_PING_MIN_INTERVAL_MS = 30_000
export const FLEET_PING_MIN_MOVE_METERS = 50

export type FleetVehicle = {
  id: string
  name: string
  plate_number?: string | null
  driver_id?: string | null
  tracking_token: string
  is_active: boolean
  notes?: string | null
  last_lat?: number | null
  last_lng?: number | null
  last_accuracy_m?: number | null
  last_heading?: number | null
  last_speed_mps?: number | null
  last_seen_at?: string | null
  created_at?: string
  updated_at?: string
  driver?: { id: string; full_name: string; staff_code: string } | null
}

export type FleetLocationPing = {
  id: string
  vehicle_id: string
  lat: number
  lng: number
  accuracy_m?: number | null
  heading?: number | null
  speed_mps?: number | null
  recorded_at: string
}

export const FLEET_TRAIL_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#ea580c',
  '#059669',
  '#db2777',
  '#0891b2',
  '#ca8a04',
  '#4f46e5',
] as const

export function fleetTrailColor(index: number): string {
  return FLEET_TRAIL_COLORS[index % FLEET_TRAIL_COLORS.length]
}

export function getFleetTrackingUrl(trackingToken: string): string {
  if (typeof window === 'undefined') {
    return `/fleet/track/${trackingToken}`
  }
  return `${window.location.origin}/fleet/track/${trackingToken}`
}

export function isFleetVehicleOnline(lastSeenAt?: string | null, nowMs = Date.now()): boolean {
  if (!lastSeenAt) return false
  const seen = new Date(lastSeenAt).getTime()
  if (Number.isNaN(seen)) return false
  return nowMs - seen <= FLEET_ONLINE_THRESHOLD_MS
}

export function formatFleetLastSeen(lastSeenAt?: string | null): string {
  if (!lastSeenAt) return 'Never'
  return formatPhilippinesDateTime(lastSeenAt)
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadius = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

export function fleetTrailSinceIso(now = new Date()): string {
  return new Date(now.getTime() - FLEET_TRAIL_HOURS * 60 * 60 * 1000).toISOString()
}

export async function loadFleetVehicles(): Promise<FleetVehicle[]> {
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .select('*, driver:staff_registrations(id, full_name, staff_code)')
    .order('name', { ascending: true })

  if (error) throw error
  return (data || []) as FleetVehicle[]
}

export async function loadFleetVehicleByToken(token: string): Promise<FleetVehicle | null> {
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .select('*')
    .eq('tracking_token', token)
    .maybeSingle()

  if (error) throw error
  return (data as FleetVehicle | null) || null
}

export async function loadFleetTrailPings(vehicleIds: string[]): Promise<FleetLocationPing[]> {
  if (vehicleIds.length === 0) return []

  const since = fleetTrailSinceIso()
  const { data, error } = await supabase
    .from('fleet_location_pings')
    .select('id, vehicle_id, lat, lng, accuracy_m, heading, speed_mps, recorded_at')
    .in('vehicle_id', vehicleIds)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })

  if (error) throw error
  return (data || []) as FleetLocationPing[]
}

export type CreateFleetVehicleInput = {
  name: string
  plate_number?: string
  driver_id?: string | null
  notes?: string
}

export async function createFleetVehicle(input: CreateFleetVehicleInput): Promise<FleetVehicle> {
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .insert({
      name: input.name.trim(),
      plate_number: input.plate_number?.trim() || null,
      driver_id: input.driver_id || null,
      notes: input.notes?.trim() || null,
      is_active: true,
    })
    .select('*, driver:staff_registrations(id, full_name, staff_code)')
    .single()

  if (error) throw error
  return data as FleetVehicle
}

export async function updateFleetVehicle(
  id: string,
  patch: Partial<Pick<FleetVehicle, 'name' | 'plate_number' | 'driver_id' | 'notes' | 'is_active'>>
): Promise<FleetVehicle> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.plate_number !== undefined) payload.plate_number = patch.plate_number?.trim() || null
  if (patch.driver_id !== undefined) payload.driver_id = patch.driver_id || null
  if (patch.notes !== undefined) payload.notes = patch.notes?.trim() || null
  if (patch.is_active !== undefined) payload.is_active = patch.is_active

  const { data, error } = await supabase
    .from('fleet_vehicles')
    .update(payload)
    .eq('id', id)
    .select('*, driver:staff_registrations(id, full_name, staff_code)')
    .single()

  if (error) throw error
  return data as FleetVehicle
}

export type SubmitFleetPingResult =
  | { ok: true; vehicle_id: string; vehicle_name: string }
  | { ok: false; error: string }

export async function submitFleetLocationPing(params: {
  trackingToken: string
  lat: number
  lng: number
  accuracyM?: number | null
  heading?: number | null
  speedMps?: number | null
  recordedAt?: string
}): Promise<SubmitFleetPingResult> {
  const { data, error } = await supabase.rpc('submit_fleet_location_ping', {
    input_tracking_token: params.trackingToken,
    input_lat: params.lat,
    input_lng: params.lng,
    input_accuracy_m: params.accuracyM ?? null,
    input_heading: params.heading ?? null,
    input_speed_mps: params.speedMps ?? null,
    input_recorded_at: params.recordedAt ?? null,
  })

  if (error) throw error

  const result = data as SubmitFleetPingResult | null
  if (!result) return { ok: false, error: 'empty_response' }
  return result
}

export function shouldSendFleetPing(
  lastSentAtMs: number | null,
  lastLat: number | null,
  lastLng: number | null,
  nextLat: number,
  nextLng: number,
  nowMs = Date.now()
): boolean {
  if (lastSentAtMs == null) return true
  if (nowMs - lastSentAtMs >= FLEET_PING_MIN_INTERVAL_MS) return true
  if (lastLat == null || lastLng == null) return true
  return haversineMeters(lastLat, lastLng, nextLat, nextLng) >= FLEET_PING_MIN_MOVE_METERS
}

export function groupFleetTrailPings(
  pings: FleetLocationPing[]
): Record<string, FleetLocationPing[]> {
  const grouped: Record<string, FleetLocationPing[]> = {}
  for (const ping of pings) {
    if (!grouped[ping.vehicle_id]) grouped[ping.vehicle_id] = []
    grouped[ping.vehicle_id].push(ping)
  }
  return grouped
}

// =============================================
// FLEET ZONES
// =============================================

export type FleetZone = {
  id: string
  name: string
  location_id?: string | null
  lat: number
  lng: number
  radius_m: number
  is_hq: boolean
  is_active: boolean
  created_at?: string
  updated_at?: string
  location?: { id: string; name: string; franchisee?: string | null } | null
}

export type CreateFleetZoneInput = {
  name: string
  location_id?: string | null
  lat: number
  lng: number
  radius_m?: number
  is_hq?: boolean
}

export async function loadFleetZones(): Promise<FleetZone[]> {
  const { data, error } = await supabase
    .from('fleet_zones')
    .select('*, location:locations(id, name, franchisee)')
    .order('is_hq', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw error
  return (data || []) as FleetZone[]
}

export async function createFleetZone(input: CreateFleetZoneInput): Promise<FleetZone> {
  const { data, error } = await supabase
    .from('fleet_zones')
    .insert({
      name: input.name.trim(),
      location_id: input.location_id || null,
      lat: input.lat,
      lng: input.lng,
      radius_m: input.radius_m ?? 200,
      is_hq: input.is_hq ?? false,
      is_active: true,
    })
    .select('*, location:locations(id, name, franchisee)')
    .single()

  if (error) throw error
  return data as FleetZone
}

export async function updateFleetZone(
  id: string,
  patch: Partial<Pick<FleetZone, 'name' | 'location_id' | 'lat' | 'lng' | 'radius_m' | 'is_hq' | 'is_active'>>
): Promise<FleetZone> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.location_id !== undefined) payload.location_id = patch.location_id || null
  if (patch.lat !== undefined) payload.lat = patch.lat
  if (patch.lng !== undefined) payload.lng = patch.lng
  if (patch.radius_m !== undefined) payload.radius_m = patch.radius_m
  if (patch.is_hq !== undefined) payload.is_hq = patch.is_hq
  if (patch.is_active !== undefined) payload.is_active = patch.is_active

  const { data, error } = await supabase
    .from('fleet_zones')
    .update(payload)
    .eq('id', id)
    .select('*, location:locations(id, name, franchisee)')
    .single()

  if (error) throw error
  return data as FleetZone
}

export async function deleteFleetZone(id: string): Promise<void> {
  const { error } = await supabase.from('fleet_zones').delete().eq('id', id)
  if (error) throw error
}

// =============================================
// FLEET TRIPS
// =============================================

export type FleetTrip = {
  id: string
  vehicle_id: string
  driver_id?: string | null
  status: 'in_progress' | 'completed' | 'cancelled'
  started_at: string
  completed_at?: string | null
  created_at?: string
  legs?: FleetTripLeg[]
  vehicle?: Pick<FleetVehicle, 'id' | 'name' | 'plate_number'> | null
  driver?: { id: string; full_name: string; staff_code: string } | null
}

export type FleetTripLeg = {
  id: string
  trip_id: string
  zone_id: string
  leg_order: number
  arrived_at: string
  departed_at?: string | null
  duration_from_prev_s?: number | null
  created_at?: string
  zone?: Pick<FleetZone, 'id' | 'name' | 'is_hq'> | null
}

export const FLEET_STAGNANT_THRESHOLD_S = 30 * 60

export function legDwellSeconds(leg: FleetTripLeg, nextLeg?: FleetTripLeg | null): number | null {
  const end = leg.departed_at || nextLeg?.arrived_at
  if (!end) return null
  const s = Math.round((new Date(end).getTime() - new Date(leg.arrived_at).getTime()) / 1000)
  return s >= 0 ? s : null
}

export function legTravelStagnant(leg: FleetTripLeg): boolean {
  if (leg.duration_from_prev_s == null) return false
  return leg.duration_from_prev_s >= FLEET_STAGNANT_THRESHOLD_S
}

export function pingsInTimeRange(
  pings: FleetLocationPing[],
  startIso: string,
  endIso: string
): FleetLocationPing[] {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return []
  return pings.filter((p) => {
    const t = new Date(p.recorded_at).getTime()
    return t >= start && t <= end
  })
}

export function pingIncrementSeconds(
  prev: FleetLocationPing | null,
  ping: FleetLocationPing
): number | null {
  if (!prev) return null
  const s = Math.round((new Date(ping.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000)
  return s >= 0 ? s : null
}

export async function loadFleetTripPings(trip: FleetTrip): Promise<FleetLocationPing[]> {
  const legs = trip.legs || []
  const since = legs.length > 0 ? legs[0].arrived_at : trip.started_at
  const until = trip.completed_at || new Date().toISOString()
  const { data, error } = await supabase
    .from('fleet_location_pings')
    .select('id, vehicle_id, lat, lng, accuracy_m, heading, speed_mps, recorded_at')
    .eq('vehicle_id', trip.vehicle_id)
    .gte('recorded_at', since)
    .lte('recorded_at', until)
    .order('recorded_at', { ascending: true })

  if (error) throw error
  return (data || []) as FleetLocationPing[]
}

export async function loadFleetTrips(opts?: {
  vehicleId?: string
  since?: string
  status?: string
}): Promise<FleetTrip[]> {
  let query = supabase
    .from('fleet_trips')
    .select('*, vehicle:fleet_vehicles(id, name, plate_number), driver:staff_registrations(id, full_name, staff_code), legs:fleet_trip_legs(*, zone:fleet_zones(id, name, is_hq))')
    .order('started_at', { ascending: false })
    .limit(50)

  if (opts?.vehicleId) query = query.eq('vehicle_id', opts.vehicleId)
  if (opts?.status) query = query.eq('status', opts.status)
  if (opts?.since) query = query.gte('started_at', opts.since)

  const { data, error } = await query
  if (error) throw error

  const trips = (data || []) as FleetTrip[]
  for (const trip of trips) {
    if (trip.legs) {
      trip.legs.sort((a, b) => a.leg_order - b.leg_order)
    }
  }
  return trips
}

export async function startFleetTrip(vehicleId: string): Promise<FleetTrip> {
  const { data: vehicle } = await supabase
    .from('fleet_vehicles')
    .select('driver_id')
    .eq('id', vehicleId)
    .maybeSingle()

  const { data, error } = await supabase
    .from('fleet_trips')
    .insert({
      vehicle_id: vehicleId,
      driver_id: vehicle?.driver_id || null,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select('*, vehicle:fleet_vehicles(id, name, plate_number), driver:staff_registrations(id, full_name, staff_code), legs:fleet_trip_legs(*, zone:fleet_zones(id, name, is_hq))')
    .single()

  if (error) throw error
  return data as FleetTrip
}

export async function stopFleetTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from('fleet_trips')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', tripId)

  if (error) throw error
}

export async function deleteFleetTrip(tripId: string): Promise<void> {
  const { error: legsError } = await supabase
    .from('fleet_trip_legs')
    .delete()
    .eq('trip_id', tripId)
  if (legsError) throw legsError

  const { error } = await supabase
    .from('fleet_trips')
    .delete()
    .eq('id', tripId)
  if (error) throw error
}

export async function loadFleetTripLegs(tripId: string): Promise<FleetTripLeg[]> {
  const { data, error } = await supabase
    .from('fleet_trip_legs')
    .select('*, zone:fleet_zones(id, name, is_hq)')
    .eq('trip_id', tripId)
    .order('leg_order', { ascending: true })

  if (error) throw error
  return (data || []) as FleetTripLeg[]
}

export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`
}

export function tripTotalDurationSeconds(legs: FleetTripLeg[]): number {
  let total = 0
  for (const leg of legs) {
    if (leg.duration_from_prev_s != null && leg.duration_from_prev_s > 0) {
      total += leg.duration_from_prev_s
    }
  }
  return total
}
