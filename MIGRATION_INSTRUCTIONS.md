# 🚨 IMPORTANT - Run Migrations First!

## The purchasing tables don't exist yet in your Supabase database.

You're getting errors because the app is trying to access tables that haven't been created.

## ✅ Fix: Run the Migration (2 minutes)

### Step 1: Run Main Migration

1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy ALL contents of:** `migrations/complete-purchasing-migration.sql`
4. **Paste into SQL Editor**
5. **Click RUN**
6. **Wait for "Success" message**

### Step 2: Verify Installation

Run this query to check:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'suppliers', 
  'purchase_orders',
  'delivery_receipts',
  'raw_materials'
)
ORDER BY table_name;
```

You should see 4 tables listed.

### Step 3: Refresh Your App

1. Refresh the browser (F5)
2. Go to Purchasing tab
3. ✅ Everything should work now!

## 📋 What Gets Created

The migration creates:
- ✅ 14 tables (suppliers, POs, deliveries, inventory, etc.)
- ✅ All foreign key relationships
- ✅ Indexes for performance
- ✅ Automated triggers
- ✅ Views for reporting
- ✅ Sample suppliers

## ⚠️ Common Mistakes

**❌ Don't:**
- Skip running the migration
- Run partial SQL
- Run in wrong database

**✅ Do:**
- Run complete migration file
- Wait for success confirmation
- Verify tables exist
- Then test the app

## 🆘 Still Having Issues?

### Error: "Function update_updated_at_column does not exist"

**Solution:** Run `complete-schema.sql` first (the main app schema), then run the purchasing migration.

### Error: "Relation brands does not exist"

**Solution:** The purchasing system requires the main app schema. Run `complete-schema.sql` first.

### Error: "Permission denied"

**Solution:** Make sure you're logged into Supabase and have admin access.

## ✅ Quick Checklist

- [ ] Opened Supabase Dashboard
- [ ] Went to SQL Editor
- [ ] Copied `migrations/complete-purchasing-migration.sql`
- [ ] Pasted in SQL Editor
- [ ] Clicked RUN
- [ ] Saw "Success" message
- [ ] Verified tables exist
- [ ] Refreshed app
- [ ] Tested creating a PO

---

**After running the migration, deliveries will work perfectly!**

The error you're seeing is expected when tables don't exist. Once you run the migration, all features will work. 🚀

