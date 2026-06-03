# Admin Credentials

Dashboard login and sensitive actions use the `admin_credentials` table in Supabase — not hardcoded passcodes in the app.

## Roles

| Role | Purpose |
|------|---------|
| `admin` | Full dashboard access; passcode works for edit/delete confirmations |
| `guest` | Limited dashboard (products, orders, branches, logistics, DSIR view); cannot use admin-only confirmations |

Each row has `username`, `passcode`, `role`, and `is_active`.

## Migrations

1. **New database:** run `admin-credentials-migration.sql`
2. **Existing database:** run `migrations/admin-credentials-roles.sql` (adds `role`, seeds `guest`, updates RPCs)

Do **not** use `migrations/dashboard-guest-passcode.sql` — it is deprecated.

## Default seed (change in Supabase as needed)

| Username | Role | Example passcode |
|----------|------|------------------|
| `admin` | admin | `gfc030199` |
| `guest` | guest | `030199` |

## RPCs

| Function | Returns | Use |
|----------|---------|-----|
| `authenticate_dashboard_passcode(passcode)` | `{"username","role"}` or NULL | Dashboard login |
| `validate_admin_passcode(passcode)` | boolean | Edit/delete password modal (admin only) |
| `validate_admin_credentials(passcode)` | boolean | Alias for `validate_admin_passcode` |

## App code

- Login: `lib/admin-auth.ts` → `authenticateDashboardPasscode()`
- Confirmations: `validateAdminPassword()` (admin role only)
- Session: `localStorage.dashboard_role` = `admin` | `guest`

## Manage credentials in SQL

```sql
-- Change admin passcode
UPDATE admin_credentials
SET passcode = 'new_passcode', updated_at = NOW()
WHERE username = 'admin';

-- Change guest passcode
UPDATE admin_credentials
SET passcode = 'new_guest_code', updated_at = NOW()
WHERE username = 'guest';

-- Deactivate guest login
UPDATE admin_credentials SET is_active = FALSE WHERE username = 'guest';
```

## Verification

```sql
SELECT username, role, is_active FROM admin_credentials ORDER BY role;
SELECT authenticate_dashboard_passcode('gfc030199');  -- admin
SELECT authenticate_dashboard_passcode('030199');     -- guest
SELECT validate_admin_passcode('030199');             -- false
SELECT validate_admin_passcode('gfc030199');          -- true
```
