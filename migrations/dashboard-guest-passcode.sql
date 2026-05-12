-- Guest dashboard access: same RPC as admin (`validate_admin_credentials`).
-- Run after admin-credentials-migration.sql.

CREATE OR REPLACE FUNCTION validate_admin_credentials(input_passcode TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF input_passcode = '030199' THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM admin_credentials
    WHERE passcode = input_passcode
      AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SELECT validate_admin_credentials('030199'); -- Should return TRUE
