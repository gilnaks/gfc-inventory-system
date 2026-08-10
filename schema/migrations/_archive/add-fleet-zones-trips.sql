-- Fleet delivery zones, trips, and automatic geofence-based trip tracking.

-- 1. Zones: circular geofenced areas tied to branch locations.
CREATE TABLE IF NOT EXISTS fleet_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m DOUBLE PRECISION NOT NULL DEFAULT 200,
  is_hq BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_zones_active
  ON fleet_zones (is_active) WHERE is_active = TRUE;

-- 2. Trips: one per delivery run (HQ departure -> stops -> HQ return).
CREATE TABLE IF NOT EXISTS fleet_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE fleet_trips ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fleet_trips_vehicle_status
  ON fleet_trips (vehicle_id, status);

-- 3. Trip legs: each zone entry during a trip.
CREATE TABLE IF NOT EXISTS fleet_trip_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES fleet_trips(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES fleet_zones(id) ON DELETE CASCADE,
  leg_order INT NOT NULL,
  arrived_at TIMESTAMPTZ NOT NULL,
  departed_at TIMESTAMPTZ,
  duration_from_prev_s INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add departed_at if table already exists (idempotent).
DO $$ BEGIN
  ALTER TABLE fleet_trip_legs ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fleet_trip_legs_trip
  ON fleet_trip_legs (trip_id, leg_order);

-- RLS: open access (same pattern as fleet_vehicles).
ALTER TABLE fleet_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on fleet_zones" ON fleet_zones;
CREATE POLICY "Allow all on fleet_zones"
  ON fleet_zones FOR ALL USING (true);

ALTER TABLE fleet_trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on fleet_trips" ON fleet_trips;
CREATE POLICY "Allow all on fleet_trips"
  ON fleet_trips FOR ALL USING (true);

ALTER TABLE fleet_trip_legs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on fleet_trip_legs" ON fleet_trip_legs;
CREATE POLICY "Allow all on fleet_trip_legs"
  ON fleet_trip_legs FOR ALL USING (true);

-- 4. Geofence check: called by trigger on every location ping INSERT.
--    Uses haversine to test if vehicle is inside any active zone, then
--    manages trip / leg lifecycle automatically.
CREATE OR REPLACE FUNCTION check_fleet_geofence()
RETURNS TRIGGER AS $$
DECLARE
  v_zone RECORD;
  v_trip fleet_trips%ROWTYPE;
  v_last_leg RECORD;
  v_dist_m DOUBLE PRECISION;
  v_earth CONSTANT DOUBLE PRECISION := 6371000;
  v_lat_rad DOUBLE PRECISION;
  v_zone_lat_rad DOUBLE PRECISION;
  v_dlat DOUBLE PRECISION;
  v_dlng DOUBLE PRECISION;
  v_a DOUBLE PRECISION;
  v_matched_zone_id UUID := NULL;
  v_matched_is_hq BOOLEAN := FALSE;
  v_prev_arrived TIMESTAMPTZ;
  v_dur_s INT;
  v_next_order INT;
  v_non_hq_count INT;
BEGIN
  -- Find the first active zone the ping falls inside.
  FOR v_zone IN
    SELECT id, lat, lng, radius_m, is_hq
    FROM fleet_zones
    WHERE is_active = TRUE
    ORDER BY is_hq DESC
  LOOP
    v_lat_rad := radians(NEW.lat);
    v_zone_lat_rad := radians(v_zone.lat);
    v_dlat := radians(v_zone.lat - NEW.lat);
    v_dlng := radians(v_zone.lng - NEW.lng);
    v_a := sin(v_dlat / 2) ^ 2
          + cos(v_lat_rad) * cos(v_zone_lat_rad) * sin(v_dlng / 2) ^ 2;
    v_dist_m := 2 * v_earth * asin(sqrt(v_a));

    IF v_dist_m <= v_zone.radius_m THEN
      v_matched_zone_id := v_zone.id;
      v_matched_is_hq := v_zone.is_hq;
      EXIT;
    END IF;
  END LOOP;

  -- Not inside any zone — nothing to do.
  IF v_matched_zone_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find active trip for this vehicle.
  SELECT * INTO v_trip
  FROM fleet_trips
  WHERE vehicle_id = NEW.vehicle_id
    AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1;

  -- Get last leg of active trip (if any).
  IF v_trip.id IS NOT NULL THEN
    SELECT * INTO v_last_leg
    FROM fleet_trip_legs
    WHERE trip_id = v_trip.id
    ORDER BY leg_order DESC
    LIMIT 1;
  END IF;

  -- CASE 1: Vehicle is at HQ, no active trip -> start a new trip.
  IF v_matched_is_hq AND v_trip.id IS NULL THEN
    INSERT INTO fleet_trips (vehicle_id, driver_id, started_at)
    SELECT NEW.vehicle_id, fv.driver_id, COALESCE(NEW.recorded_at, NOW())
    FROM fleet_vehicles fv
    WHERE fv.id = NEW.vehicle_id
    RETURNING * INTO v_trip;

    INSERT INTO fleet_trip_legs (trip_id, zone_id, leg_order, arrived_at, duration_from_prev_s)
    VALUES (v_trip.id, v_matched_zone_id, 0, COALESCE(NEW.recorded_at, NOW()), NULL);

    RETURN NEW;
  END IF;

  -- No active trip and not at HQ — ignore.
  IF v_trip.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Already at this same zone (last leg is same zone) — skip duplicate.
  IF v_last_leg IS NOT NULL AND v_last_leg.zone_id = v_matched_zone_id THEN
    RETURN NEW;
  END IF;

  -- Compute duration from previous leg and mark previous leg's departure.
  v_prev_arrived := NULL;
  v_dur_s := NULL;
  IF v_last_leg IS NOT NULL THEN
    v_prev_arrived := v_last_leg.arrived_at;
    v_dur_s := EXTRACT(EPOCH FROM (COALESCE(NEW.recorded_at, NOW()) - v_prev_arrived))::INT;
    IF v_dur_s < 0 THEN v_dur_s := 0; END IF;

    -- Set departed_at on the previous leg (the truck just left that zone).
    UPDATE fleet_trip_legs
    SET departed_at = COALESCE(NEW.recorded_at, NOW())
    WHERE id = v_last_leg.id
      AND departed_at IS NULL;
  END IF;

  v_next_order := COALESCE(v_last_leg.leg_order, -1) + 1;

  -- Insert the new leg.
  INSERT INTO fleet_trip_legs (trip_id, zone_id, leg_order, arrived_at, duration_from_prev_s)
  VALUES (v_trip.id, v_matched_zone_id, v_next_order, COALESCE(NEW.recorded_at, NOW()), v_dur_s);

  -- CASE 2: Arrived back at HQ with at least one non-HQ stop -> complete trip.
  IF v_matched_is_hq THEN
    SELECT COUNT(*) INTO v_non_hq_count
    FROM fleet_trip_legs tl
    JOIN fleet_zones z ON z.id = tl.zone_id
    WHERE tl.trip_id = v_trip.id
      AND z.is_hq = FALSE;

    IF v_non_hq_count > 0 THEN
      UPDATE fleet_trips
      SET status = 'completed',
          completed_at = COALESCE(NEW.recorded_at, NOW())
      WHERE id = v_trip.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger on ping inserts.
DROP TRIGGER IF EXISTS trg_fleet_geofence_check ON fleet_location_pings;
CREATE TRIGGER trg_fleet_geofence_check
  AFTER INSERT ON fleet_location_pings
  FOR EACH ROW
  EXECUTE FUNCTION check_fleet_geofence();

-- 6. Realtime for new tables.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_zones;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_trips;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_trip_legs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
