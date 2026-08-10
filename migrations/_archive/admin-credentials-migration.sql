-- Admin Credentials Migration
-- Run this migration to store admin credentials in Supabase instead of hardcoding

-- =============================================
-- 1. CREATE ADMIN CREDENTIALS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS admin_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  passcode VARCHAR(20) NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'guest')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. INSERT DEFAULT ADMIN CREDENTIALS
-- =============================================

INSERT INTO admin_credentials (username, passcode, is_active) 
VALUES ('admin', 'gfc030199', TRUE)
ON CONFLICT (username) DO UPDATE SET
  passcode = EXCLUDED.passcode,
  updated_at = NOW();

-- =============================================
-- 3. CREATE FUNCTION TO VALIDATE ADMIN CREDENTIALS
-- =============================================

CREATE OR REPLACE FUNCTION validate_admin_credentials(input_passcode TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_credentials 
    WHERE passcode = input_passcode 
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. CREATE FUNCTION TO GET ADMIN CREDENTIALS
-- =============================================

CREATE OR REPLACE FUNCTION get_admin_credentials()
RETURNS TABLE(username VARCHAR, is_active BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT ac.username, ac.is_active
  FROM admin_credentials ac
  WHERE ac.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. SET UP ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on admin_credentials table
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read admin credentials
CREATE POLICY "Allow authenticated users to read admin credentials" ON admin_credentials
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy to allow service role to manage admin credentials
CREATE POLICY "Allow service role to manage admin credentials" ON admin_credentials
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- 6. GRANT PERMISSIONS
-- =============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION authenticate_dashboard_passcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION authenticate_dashboard_passcode(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_admin_passcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_admin_passcode(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_admin_credentials(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_admin_credentials(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_admin_credentials() TO authenticated;

-- Grant select on admin_credentials table
GRANT SELECT ON admin_credentials TO authenticated;
GRANT SELECT ON admin_credentials TO anon;

-- =============================================
-- 7. CREATE INDEX FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_admin_credentials_passcode ON admin_credentials(passcode);
CREATE INDEX IF NOT EXISTS idx_admin_credentials_active ON admin_credentials(is_active) WHERE is_active = TRUE;

-- =============================================
-- 8. VERIFICATION QUERIES
-- =============================================

-- Test the validation function
-- SELECT authenticate_dashboard_passcode('gfc030199'); -- 'admin'
-- SELECT authenticate_dashboard_passcode('030199');    -- 'guest'
-- SELECT validate_admin_passcode('030199');              -- FALSE
-- SELECT validate_admin_passcode('gfc030199');           -- TRUE

-- View all admin credentials
-- SELECT * FROM admin_credentials;
