-- Coalesce GPS jitter: stop duplicate trip legs for the same zone when the
-- vehicle briefly registers in another zone (< 2 min) then returns.

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
  v_prev_leg RECORD;
  v_brief_dwell_s INT;
  v_min_zone_dwell_s CONSTANT INT := 120;
BEGIN
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

  IF v_matched_zone_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_trip
  FROM fleet_trips
  WHERE vehicle_id = NEW.vehicle_id
    AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_trip.id IS NOT NULL THEN
    SELECT * INTO v_last_leg
    FROM fleet_trip_legs
    WHERE trip_id = v_trip.id
    ORDER BY leg_order DESC
    LIMIT 1;
  END IF;

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

  IF v_trip.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_last_leg IS NOT NULL AND v_last_leg.zone_id = v_matched_zone_id THEN
    IF v_last_leg.departed_at IS NOT NULL THEN
      UPDATE fleet_trip_legs
      SET departed_at = NULL
      WHERE id = v_last_leg.id;
    END IF;
    RETURN NEW;
  END IF;

  IF v_last_leg IS NOT NULL AND v_last_leg.zone_id != v_matched_zone_id THEN
    v_brief_dwell_s := EXTRACT(EPOCH FROM (
      COALESCE(NEW.recorded_at, NOW()) - v_last_leg.arrived_at
    ))::INT;
    IF v_brief_dwell_s >= 0 AND v_brief_dwell_s < v_min_zone_dwell_s THEN
      SELECT * INTO v_prev_leg
      FROM fleet_trip_legs
      WHERE trip_id = v_trip.id
        AND leg_order = v_last_leg.leg_order - 1;

      IF v_prev_leg IS NOT NULL AND v_prev_leg.zone_id = v_matched_zone_id THEN
        DELETE FROM fleet_trip_legs WHERE id = v_last_leg.id;
        UPDATE fleet_trip_legs
        SET departed_at = NULL
        WHERE id = v_prev_leg.id;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  v_prev_arrived := NULL;
  v_dur_s := NULL;
  IF v_last_leg IS NOT NULL THEN
    v_prev_arrived := v_last_leg.arrived_at;
    v_dur_s := EXTRACT(EPOCH FROM (COALESCE(NEW.recorded_at, NOW()) - v_prev_arrived))::INT;
    IF v_dur_s < 0 THEN v_dur_s := 0; END IF;

    UPDATE fleet_trip_legs
    SET departed_at = COALESCE(NEW.recorded_at, NOW())
    WHERE id = v_last_leg.id
      AND departed_at IS NULL;
  END IF;

  v_next_order := COALESCE(v_last_leg.leg_order, -1) + 1;

  INSERT INTO fleet_trip_legs (trip_id, zone_id, leg_order, arrived_at, duration_from_prev_s)
  VALUES (v_trip.id, v_matched_zone_id, v_next_order, COALESCE(NEW.recorded_at, NOW()), v_dur_s);

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

-- Optional one-time cleanup for trips already affected by jitter (runs until stable).
DO $$
DECLARE
  v_deleted INT;
BEGIN
  LOOP
    WITH jitter_middle AS (
      SELECT
        mid.id AS middle_id,
        prev.id AS prev_id,
        next.id AS next_id
      FROM fleet_trip_legs mid
      JOIN fleet_trip_legs prev
        ON prev.trip_id = mid.trip_id AND prev.leg_order = mid.leg_order - 1
      JOIN fleet_trip_legs next
        ON next.trip_id = mid.trip_id AND next.leg_order = mid.leg_order + 1
      WHERE prev.zone_id = next.zone_id
        AND mid.zone_id != prev.zone_id
        AND EXTRACT(EPOCH FROM (COALESCE(mid.departed_at, next.arrived_at) - mid.arrived_at)) < 120
    ),
    cleared AS (
      UPDATE fleet_trip_legs tl
      SET departed_at = NULL
      FROM jitter_middle jm
      WHERE tl.id = jm.prev_id
        AND tl.departed_at IS NOT NULL
      RETURNING tl.id
    ),
    removed AS (
      DELETE FROM fleet_trip_legs
      WHERE id IN (
        SELECT middle_id FROM jitter_middle
        UNION
        SELECT next_id FROM jitter_middle
      )
      RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted FROM removed;

    EXIT WHEN v_deleted = 0;
  END LOOP;
END $$;
