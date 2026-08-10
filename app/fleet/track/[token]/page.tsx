'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapPin, Radio, AlertCircle } from 'lucide-react'
import {
  formatFleetLastSeen,
  loadFleetVehicleByToken,
  shouldSendFleetPing,
  submitFleetLocationPing,
  type FleetVehicle,
} from '../../../../lib/fleet-tracking'
import { formatPhilippinesDateTime } from '../../../../lib/timezone'

type ShareStatus = 'loading' | 'ready' | 'sharing' | 'paused' | 'error' | 'inactive'

export default function FleetTrackPage({ params }: { params: { token: string } }) {
  const token = params.token
  const [vehicle, setVehicle] = useState<FleetVehicle | null>(null)
  const [status, setStatus] = useState<ShareStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [lastSentAt, setLastSentAt] = useState<string | null>(null)
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSentMsRef = useRef<number | null>(null)
  const lastSentCoordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const sendingRef = useRef(false)

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const sendPing = useCallback(
    async (position: GeolocationPosition) => {
      if (sendingRef.current) return

      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const nowMs = Date.now()

      if (
        !shouldSendFleetPing(
          lastSentMsRef.current,
          lastSentCoordsRef.current?.lat ?? null,
          lastSentCoordsRef.current?.lng ?? null,
          lat,
          lng,
          nowMs
        )
      ) {
        return
      }

      sendingRef.current = true
      try {
        const result = await submitFleetLocationPing({
          trackingToken: token,
          lat,
          lng,
          accuracyM: position.coords.accuracy,
          heading: position.coords.heading ?? null,
          speedMps: position.coords.speed ?? null,
          recordedAt: new Date(position.timestamp).toISOString(),
        })

        if (!result.ok) {
          const errCode = 'error' in result ? result.error : 'unknown'
          setStatus('error')
          setError(
            errCode === 'invalid_or_inactive_vehicle'
              ? 'This truck link is inactive or invalid.'
              : 'Could not send location.'
          )
          stopWatch()
          return
        }

        lastSentMsRef.current = nowMs
        lastSentCoordsRef.current = { lat, lng }
        setLastSentAt(new Date().toISOString())
        setLastCoords({ lat, lng })
        setStatus('sharing')
        setError(null)
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to send location.')
      } finally {
        sendingRef.current = false
      }
    },
    [stopWatch, token]
  )

  const startWatch = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error')
      setError('GPS is not supported on this device.')
      return
    }

    stopWatch()
    setStatus('ready')
    setError(null)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void sendPing(position)
      },
      (geoError) => {
        setStatus('error')
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError('Location permission denied. Allow GPS access to share your position.')
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setError('GPS position unavailable. Try moving to an open area.')
        } else {
          setError('Could not read GPS. Please try again.')
        }
        stopWatch()
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 20_000,
      }
    )
  }, [sendPing, stopWatch])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const row = await loadFleetVehicleByToken(token)
        if (cancelled) return
        if (!row || !row.is_active) {
          setVehicle(row)
          setStatus('inactive')
          return
        }
        setVehicle(row)
        setStatus('ready')
        startWatch()
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof Error ? err.message : 'Failed to load truck.')
        }
      }
    })()

    return () => {
      cancelled = true
      stopWatch()
    }
  }, [startWatch, stopWatch, token])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopWatch()
        if (status === 'sharing' || status === 'ready') setStatus('paused')
      } else if (vehicle?.is_active && status !== 'inactive' && status !== 'error') {
        startWatch()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [startWatch, status, stopWatch, vehicle?.is_active])

  const statusLabel =
    status === 'sharing'
      ? 'Sharing location'
      : status === 'paused'
        ? 'Paused (tab in background)'
        : status === 'ready'
          ? 'Waiting for GPS…'
          : status === 'loading'
            ? 'Loading…'
            : status === 'inactive'
              ? 'Link inactive'
              : 'Not sharing'

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-blue-100 p-2 text-blue-700">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">GFC Fleet Tracker</h1>
            <p className="text-sm text-gray-600">
              {vehicle?.name || 'Truck'}
              {vehicle?.plate_number ? ` · ${vehicle.plate_number}` : ''}
            </p>
          </div>
        </div>

        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            status === 'sharing'
              ? 'border-green-200 bg-green-50 text-green-800'
              : status === 'error' || status === 'inactive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {status === 'sharing' ? (
            <Radio className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusLabel}</span>
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <dl className="space-y-2 text-sm text-gray-700">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Last sent</dt>
            <dd>{lastSentAt ? formatPhilippinesDateTime(lastSentAt) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Coordinates</dt>
            <dd className="tabular-nums">
              {lastCoords ? `${lastCoords.lat.toFixed(5)}, ${lastCoords.lng.toFixed(5)}` : '—'}
            </dd>
          </div>
          {vehicle?.last_seen_at ? (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Server last seen</dt>
              <dd>{formatFleetLastSeen(vehicle.last_seen_at)}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-gray-500">
          For background GPS while driving, install the GFC Fleet Android app from your dispatcher.
          This browser page only works while it stays open. Location is sent about every 30 seconds or
          when you move significantly. Switching apps pauses sharing here.
        </p>

        {status === 'paused' || status === 'error' ? (
          <button
            type="button"
            onClick={startWatch}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Resume sharing
          </button>
        ) : null}
      </div>
    </div>
  )
}
