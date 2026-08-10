-- Expand dashboard roles: developer, accounting_manager, procurement_manager, production_manager.
-- All non-guest roles have admin-level tab access; validate_admin_passcode accepts any non-guest role.

ALTER TABLE admin_credentials
  DROP CONSTRAINT IF EXISTS admin_credentials_role_check;

ALTER TABLE admin_credentials
  ADD CONSTRAINT admin_credentials_role_check
  CHECK (
    role IN (
      'admin',
      'guest',
      'developer',
      'accounting_manager',
      'procurement_manager',
      'production_manager'
    )
  );

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
      AND role <> 'guest'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example seeds (adjust passcodes in Supabase before use):
-- INSERT INTO admin_credentials (username, passcode, role, is_active)
-- VALUES
--   ('developer', '000001', 'developer', TRUE),
--   ('acct_mgr', '000002', 'accounting_manager', TRUE),
--   ('proc_mgr', '000003', 'procurement_manager', TRUE),
--   ('prod_mgr', '000004', 'production_manager', TRUE)
-- ON CONFLICT (username) DO UPDATE SET
--   role = EXCLUDED.role,
--   passcode = EXCLUDED.passcode,
--   is_active = EXCLUDED.is_active,
--   updated_at = NOW();

-- Return all dashboard users (including inactive) for the credentials modal.
CREATE OR REPLACE FUNCTION get_admin_credentials()
RETURNS TABLE(username VARCHAR, role TEXT, is_active BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT ac.username, ac.role, ac.is_active
  FROM admin_credentials ac
  ORDER BY ac.role, ac.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow passcode-authenticated dashboard (anon) to list usernames and roles.
GRANT EXECUTE ON FUNCTION get_admin_credentials() TO authenticated, anon;
