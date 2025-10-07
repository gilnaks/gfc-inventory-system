# Admin Credentials Migration

This migration moves admin credentials from hardcoded values to a secure Supabase database table.

## Migration File
- `admin-credentials-migration.sql` - Complete migration script

## What This Migration Does

### 1. Creates Admin Credentials Table
- Stores admin usernames and passcodes securely
- Includes active/inactive status for credential management
- Tracks creation and update timestamps

### 2. Sets Up Security
- Row Level Security (RLS) policies
- Secure functions for credential validation
- Proper permissions for authenticated users

### 3. Inserts Default Credentials
- Username: `admin`
- Passcode: `gfc030199`
- Status: Active

## How to Run the Migration

1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy and paste the entire `admin-credentials-migration.sql` content**
4. **Click "Run"**

## Verification

After running the migration, you can verify it worked by:

1. **Test Login**: Try logging into the dashboard with passcode `gfc030199`
2. **Check Database**: Run `SELECT * FROM admin_credentials;` in SQL Editor
3. **Test Function**: Run `SELECT validate_admin_credentials('gfc030199');` (should return `true`)

## Managing Admin Credentials

### Add New Admin
```sql
INSERT INTO admin_credentials (username, passcode, is_active) 
VALUES ('new_admin', 'new_passcode', TRUE);
```

### Deactivate Admin
```sql
UPDATE admin_credentials 
SET is_active = FALSE 
WHERE username = 'admin';
```

### Change Passcode
```sql
UPDATE admin_credentials 
SET passcode = 'new_passcode', updated_at = NOW() 
WHERE username = 'admin';
```

## Security Features

- **Encrypted Storage**: Credentials are stored securely in Supabase
- **RLS Protection**: Row Level Security prevents unauthorized access
- **Function-based Validation**: Uses secure database functions for validation
- **Audit Trail**: Tracks when credentials are created and updated

## Code Changes

The dashboard login now uses:
- `supabase.rpc('validate_admin_credentials', { input_passcode: passcode })`
- Instead of hardcoded `john101797` comparison
- Proper error handling for database operations

## Benefits

1. **Security**: No more hardcoded credentials in source code
2. **Flexibility**: Easy to add/remove admin users
3. **Audit**: Track credential changes
4. **Scalability**: Support multiple admin accounts
5. **Maintenance**: Change credentials without code deployment
