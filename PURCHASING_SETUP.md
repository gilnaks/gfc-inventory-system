# Purchase Order System - Complete Setup Guide

## 🚀 One-Step Installation

### Run the Migration

1. **Open Supabase Dashboard** → SQL Editor
2. **Open file:** `migrations/complete-purchasing-migration.sql`
3. **Copy all contents**
4. **Paste into SQL Editor**
5. **Click "Run"** ✅

That's it! Your entire purchasing system is ready.

**✅ Safe to run multiple times** - The migration includes existence checks and won't duplicate data or break existing tables.

## ✅ What Gets Installed

### 📦 **14 Tables:**
1. **suppliers** - Supplier database
2. **purchase_requisitions** - Internal requests (PR system)
3. **purchase_requisition_items** - PR line items
4. **quotations** - Supplier quotes (RFQ ready)
5. **quotation_items** - Quote line items
6. **purchase_orders** - Main PO system
7. **purchase_order_items** - PO line items
8. **po_payments** - Payment tracking
9. **delivery_receipts** - Delivery tracking
10. **delivery_receipt_items** - Delivery line items
11. **po_status_history** - Complete audit trail
12. **raw_materials** - Materials inventory
13. **material_stock_movements** - Stock in/out history
14. **material_stock_alerts** - Low stock alerts

### 📊 **2 Views:**
1. **materials_stock_view** - Inventory with status
2. **po_summary_view** - PO overview

### ⚙️ **6 Automated Functions:**
1. Auto-calculate PO totals
2. Auto-update payment balances
3. Auto-track received quantities
4. Auto-log status changes
5. Auto-update material stock
6. Auto-generate stock alerts

### 🗂️ **Sample Data:**
- 3 sample suppliers (Nutriasia, Manila Trading, Global Supplies)

## 🎯 System Features

### **Tab 1: Purchase Orders**
Complete PO lifecycle management:
- Create POs with multiple items
- Submit for approval
- Approve/reject workflow
- Track payments (before/after delivery)
- Confirm orders with suppliers
- Monitor shipment (in transit)
- Record deliveries
- Close completed POs

**Statuses:**
`Draft → Pending Approval → Approved → Order Confirmed → In Transit → Delivered → Paid → Closed`

### **Tab 2: Requisitions**
Internal purchase request system:
- Create PRs with items
- Submit for approval
- Approve requisitions
- Convert approved PRs to POs
- Track which PRs became POs

**Statuses:**
`Draft → Submitted → Approved → Converted`

### **Tab 3: Suppliers**
Supplier database:
- Add/edit suppliers
- Contact information
- Payment terms
- Bank details
- Active/inactive status

### **Tab 4: Payments**
Payment tracking:
- Record payments against POs
- Track payment methods (cash/check/transfer)
- Payment types (advance/partial/full/final)
- Proof of payment attachments
- Payment history

### **Tab 5: Deliveries**
Delivery management:
- Record delivery receipts
- Track delivery dates
- Inspection notes
- Condition tracking (good/damaged/partial)
- Received by tracking

### **Tab 6: Inventory**
Raw materials tracking:
- Add materials with stock levels
- Set minimum stock for alerts
- Track current stock
- Stock value calculations
- Stock in/out movements
- Complete movement history
- Low stock alerts

## 📋 Quick Test (5 minutes)

### Test 1: Create a Supplier
1. Go to **Suppliers** tab
2. Click "+ Add Supplier"
3. Fill in: Name: "Test Supplier", Phone: "123-456"
4. Save ✓

### Test 2: Create a Material
1. Go to **Inventory** tab
2. Click "+ Add Material"
3. Fill in:
   - Material: "Coconut Oil"
   - Unit: "liters"
   - Unit Cost: 2200
   - Minimum: 50
   - Initial: 100
4. Save ✓

### Test 3: Create a Purchase Requisition
1. Go to **Requisitions** tab
2. Click "+ Create Requisition"
3. Fill in:
   - Requested By: Your name
   - Add Item: Coconut Oil, 30 liters
4. Create ✓
5. Click "Submit" → "Approve" ✓

### Test 4: Convert PR to PO
1. Click "Create PO" on approved PR
2. Select supplier: "Test Supplier"
3. Review items (auto-loaded from PR)
4. Create PO ✓

### Test 5: Complete PO Workflow
1. Find your PO
2. Click "Submit for Approval" → "Approve"
3. Click "Confirm Order"
4. Click "Mark In Transit"
5. Click "Record Delivery"
   - Received by: Your name
   - Condition: Good
6. Click "Add Payment"
   - Amount: (full balance)
   - Method: Bank Transfer
7. Click "Close PO" ✓

### Test 6: Record Stock Movement
1. Go to **Inventory** tab
2. Click "Stock In/Out" on Coconut Oil
3. Select "Stock In"
4. Quantity: 30 (from delivery)
5. Reference: Your PO number
6. Record ✓
7. Click "History" to see movement log

## 🔄 Complete Workflow Diagram

```
┌─────────────────┐
│  1. Requisition │ (Internal Request)
└────────┬────────┘
         ↓
┌─────────────────┐
│   2. Approval   │ (Management Reviews)
└────────┬────────┘
         ↓
┌─────────────────┐
│ 3. Convert to PO│ (Select Supplier)
└────────┬────────┘
         ↓
┌─────────────────┐
│  4. PO Approval │ (Final Sign-off)
└────────┬────────┘
         ↓
┌─────────────────┐
│  5. Payment     │ (If before delivery)
└────────┬────────┘
         ↓
┌─────────────────┐
│ 6. Order Confirm│ (Send to Supplier)
└────────┬────────┘
         ↓
┌─────────────────┐
│  7. In Transit  │ (Shipping)
└────────┬────────┘
         ↓
┌─────────────────┐
│  8. Delivered   │ (Record Receipt)
└────────┬────────┘
         ↓
┌─────────────────┐
│  9. Update Inv  │ (Stock In Materials)
└────────┬────────┘
         ↓
┌─────────────────┐
│ 10. Payment     │ (If after delivery)
└────────┬────────┘
         ↓
┌─────────────────┐
│  11. Close PO   │ (Complete)
└─────────────────┘
```

## 📊 Key Metrics Tracked

### Purchase Orders:
- Total amount
- Paid amount
- Balance remaining
- Item count
- Status history

### Payments:
- Payment history
- Payment methods used
- Total paid per supplier
- Outstanding balances

### Inventory:
- Current stock levels
- Stock value
- Total stock in
- Total stock out
- Average cost
- Low stock alerts

### Deliveries:
- Delivery dates
- Received quantities
- Condition assessments
- Inspection notes

## ⚠️ Important Notes

### Before Going Live:

1. **Backup your data** before running migrations
2. **Test thoroughly** with sample data
3. **Train your team** on the workflow
4. **Set up user permissions** (customize RLS policies)
5. **Configure alerts** (optional email notifications)

### Database Requirements:

- ✅ Supabase project (free tier works)
- ✅ `brands` table must exist (from main schema)
- ✅ `update_updated_at_column()` function must exist

### Data Integrity:

- Foreign keys prevent orphaned records
- Constraints ensure valid status values
- Triggers maintain data consistency
- RLS policies control access

## 🔧 Customization

### Change Status Values:
Edit the CHECK constraints in the schema (lines with `CONSTRAINT` and `CHECK`)

### Add Email Alerts:
Create a function to send emails when:
- PO needs approval
- Stock is low
- Payment is due

### Add Approval Levels:
Create an `approvals` table with workflow steps

### Integrate with Products:
Link `raw_materials` to your `products` table for BOM (Bill of Materials)

## 📞 Support

### Troubleshooting:

**Tables not created?**
- Check Supabase SQL Editor for errors
- Ensure `brands` table exists first
- Run `complete-schema.sql` first if needed

**Can't insert data?**
- Check RLS policies are created
- Verify foreign key references exist
- Check constraint violations in error message

**Calculations not working?**
- Verify triggers are created
- Check function exists: `update_updated_at_column()`
- Refresh the page

### Getting Help:

1. Check error messages in browser console (F12)
2. Review Supabase logs in dashboard
3. Verify table structures with: `\d table_name`
4. Test with sample data first

## 🎉 You're Done!

Your complete purchasing system is now installed and ready to use:

✅ **Suppliers** - Manage vendor database
✅ **Requisitions** - Internal purchase requests
✅ **Purchase Orders** - Full PO lifecycle
✅ **Payments** - Track all transactions
✅ **Deliveries** - Monitor shipments
✅ **Inventory** - Raw materials tracking

Access it by selecting a brand and going to the **Purchasing** tab in your dashboard.

---

**Need more features?** Check `PURCHASING_SYSTEM_README.md` for the complete documentation and roadmap.

**Start testing!** Follow the 5-minute test workflow above to verify everything works.

