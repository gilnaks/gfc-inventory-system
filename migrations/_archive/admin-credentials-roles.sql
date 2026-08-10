-- Admin / guest roles on admin_credentials (replaces hardcoded passcodes in app code).
-- Run in Supabase SQL Editor after admin-credentials-migration.sql.

-- =============================================
-- 1. ROLE COLUMN
-- =============================================

ALTER TABLE admin_credentials
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE admin_credentials
  DROP CONSTRAINT IF EXISTS admin_credentials_role_check;

ALTER TABLE admin_credentials
  ADD CONSTRAINT admin_credentials_role_check
  CHECK (role IN ('admin', 'guest'));

-- Existing rows default to admin
UPDATE admin_credentials
SET role = 'admin'
WHERE role IS NULL OR role NOT IN ('admin', 'guest');

-- =============================================
-- 2. SEED ADMIN + GUEST (adjust passcodes in Supabase as needed)
-- =============================================

INSERT INTO admin_credentials (username, passcode, role, is_active)
VALUES ('admin', 'gfc030199', 'admin', TRUE)
ON CONFLICT (username) DO UPDATE SET
  role = 'admin',
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO admin_credentials (username, passcode, role, is_active)
VALUES ('guest', '030199', 'guest', TRUE)
ON CONFLICT (username) DO UPDATE SET
  role = 'guest',
  is_active = TRUE,
  updated_at = NOW();

-- =============================================
-- 3. RPC: LOGIN (returns username + role, or NULL)
-- =============================================

-- Return type changed (TEXT -> JSONB) — must drop before recreate
DROP FUNCTION IF EXISTS authenticate_dashboard_passcode(TEXT);

CREATE OR REPLACE FUNCTION authenticate_dashboard_passcode(input_passcode TEXT)
RETURNS JSONB AS $$
DECLARE
  found_role TEXT;
  found_username TEXT;
BEGIN
  IF input_passcode IS NULL OR btrim(input_passcode) = '' THEN
    RETURN NULL;
  END IF;

  SELECT ac.username, ac.role
  INTO found_username, found_role
  FROM admin_credentials ac
  WHERE ac.passcode = btrim(input_passcode)
    AND ac.is_active = TRUE
  LIMIT 1;

  IF found_role IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'username', found_username,
    'role', found_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. RPC: ADMIN-ONLY ACTIONS (edit/delete confirmations)
-- =============================================

CREATE OR REPLACE FUNCTION validate_admin_passcode(input_passcode TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF input_passcode IS NULL OR btrim(input_passcode) = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM admin_credentials
    WHERE passcode = btrim(input_passcode)
      AND is_active = TRUE
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backward-compatible alias (admin role only — guest passcodes return FALSE)
CREATE OR REPLACE FUNCTION validate_admin_credentials(input_passcode TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN validate_admin_passcode(input_passcode);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. LIST CREDENTIALS (no passcodes exposed)
-- =============================================

-- Return type changed (added role) — must drop before recreate
DROP FUNCTION IF EXISTS get_admin_credentials();

CREATE OR REPLACE FUNCTION get_admin_credentials()
RETURNS TABLE(username VARCHAR, role TEXT, is_active BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT ac.username, ac.role, ac.is_active
  FROM admin_credentials ac
  WHERE ac.is_active = TRUE
  ORDER BY ac.role, ac.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. GRANTS
-- =============================================

GRANT EXECUTE ON FUNCTION authenticate_dashboard_passcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION authenticate_dashboard_passcode(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_admin_passcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_admin_passcode(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_admin_credentials(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_admin_credentials(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_admin_credentials() TO authenticated;

-- =============================================
-- 7. VERIFICATION
-- =============================================

-- SELECT authenticate_dashboard_passcode('gfc030199');  -- {"username":"admin","role":"admin"}
-- SELECT authenticate_dashboard_passcode('030199');     -- {"username":"guest","role":"guest"}
-- SELECT validate_admin_passcode('030199');             -- false
-- SELECT validate_admin_passcode('gfc030199');          -- true
-- SELECT username, role, is_active FROM admin_credentials ORDER BY role;
