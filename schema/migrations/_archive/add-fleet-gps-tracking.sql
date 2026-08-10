-- GFC Main fleet GPS: vehicles, location pings, and driver submit RPC.

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plate_number TEXT,
  driver_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL,
  tracking_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_accuracy_m DOUBLE PRECISION,
  last_heading DOUBLE PRECISION,
  last_speed_mps DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add driver_id if table already exists (idempotent).
DO $$ BEGIN
  ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_active
  ON fleet_vehicles (is_active)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS fleet_location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_location_pings_vehicle_recorded
  ON fleet_location_pings (vehicle_id, recorded_at DESC);

ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on fleet_vehicles" ON fleet_vehicles;
CREATE POLICY "Allow all on fleet_vehicles"
  ON fleet_vehicles FOR ALL USING (true);

ALTER TABLE fleet_location_pings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on fleet_location_pings" ON fleet_location_pings;
CREATE POLICY "Allow all on fleet_location_pings"
  ON fleet_location_pings FOR ALL USING (true);

CREATE OR REPLACE FUNCTION submit_fleet_location_ping(
  input_tracking_token UUID,
  input_lat DOUBLE PRECISION,
  input_lng DOUBLE PRECISION,
  input_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  input_heading DOUBLE PRECISION DEFAULT NULL,
  input_speed_mps DOUBLE PRECISION DEFAULT NULL,
  input_recorded_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_vehicle fleet_vehicles%ROWTYPE;
  v_recorded_at TIMESTAMPTZ;
BEGIN
  IF input_tracking_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_token');
  END IF;

  IF input_lat IS NULL OR input_lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_coordinates');
  END IF;

  SELECT * INTO v_vehicle
  FROM fleet_vehicles
  WHERE tracking_token = input_tracking_token
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_inactive_vehicle');
  END IF;

  v_recorded_at := COALESCE(input_recorded_at, NOW());

  INSERT INTO fleet_location_pings (
    vehicle_id,
    lat,
    lng,
    accuracy_m,
    heading,
    speed_mps,
    recorded_at
  ) VALUES (
    v_vehicle.id,
    input_lat,
    input_lng,
    input_accuracy_m,
    input_heading,
    input_speed_mps,
    v_recorded_at
  );

  UPDATE fleet_vehicles
  SET
    last_lat = input_lat,
    last_lng = input_lng,
    last_accuracy_m = input_accuracy_m,
    last_heading = input_heading,
    last_speed_mps = input_speed_mps,
    last_seen_at = v_recorded_at,
    updated_at = NOW()
  WHERE id = v_vehicle.id;

  RETURN jsonb_build_object(
    'ok', true,
    'vehicle_id', v_vehicle.id,
    'vehicle_name', v_vehicle.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_fleet_location_ping(
  UUID,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TIMESTAMPTZ
) TO authenticated, anon;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_vehicles;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_location_pings;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
