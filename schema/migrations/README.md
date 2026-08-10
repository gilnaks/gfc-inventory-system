# Schema migrations

## Source of truth

For **fresh installs**, run [`../canonical-schema.sql`](../canonical-schema.sql). It is idempotent and includes all tables, functions, triggers, indexes, and RLS policies the app uses.

## This folder

| Location | Purpose |
|----------|---------|
| `*.sql` (root) | **Active incremental migrations** — run once on existing databases that predate canonical updates |
| `_archive/` | Migrations already folded into `canonical-schema.sql` (kept for history) |

## Active migrations

| File | When to run |
|------|-------------|
| `split-inventory-variance-shrinkage.sql` | One-time **data** migration on existing DBs: splits 5910/5920 COA accounts and updates voucher settings. Schema columns already exist in canonical. |
| `fix-fleet-geofence-jitter.sql` | Run on live DBs using fleet tracking: updates `check_fleet_geofence()` to coalesce brief GPS jitter legs and cleans existing duplicate same-zone stops. |

## Archived migrations

All other SQL files in `_archive/` have been consolidated into `canonical-schema.sql`. Do not run them on fresh installs.

## Older migrations

Legacy migrations from before the canonical consolidation live in [`../../migrations/_archive/`](../../migrations/_archive/).
