# Purchase Order System - Quick Start Guide

## 🚀 Setup (5 minutes)

### Step 1: Run Database Migration

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file `migrations/complete-purchasing-migration.sql`
4. Copy all contents
5. Paste into Supabase SQL Editor
6. Click **Run**

✅ This creates:
- 14 tables (PO, suppliers, inventory, payments, etc.)
- 2 views (stock status, PO summary)
- 6 automated functions
- Sample suppliers (Nutriasia, Manila Trading Co., Global Supplies Inc.)
- Indexes for performance

**Safe to run multiple times!** - Won't break existing data.

### Step 2: Verify Installation

Run this query in Supabase SQL Editor to check:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
  'suppliers', 
  'purchase_orders', 
  'purchase_order_items',
  'po_payments',
  'delivery_receipts',
  'raw_materials',
  'material_stock_movements'
)
ORDER BY table_name;
```

You should see 14+ tables listed.

### Step 3: Access the System

1. Go to your application dashboard
2. Select a brand (e.g., Mychoice)
3. Navigate to the **Purchase Orders** tab
4. You're ready to go! 🎉

## 📝 Quick Test Workflow

### Test 1: Create Your First PO (2 minutes)

1. **Click "+ Create PO"**

2. **Fill in the form:**
   - **Supplier**: Select "Nutriasia"
   - **Order Date**: Today's date
   - **Expected Delivery**: 7 days from now
   - **Purchasing Agent**: Your name

3. **Payment Info:**
   - **Payment Timing**: "After Delivery"
   - **Payment Method**: "Bank Transfer"
   - **Terms**: "30 days after delivery"

4. **Add Items:**
   - Click "+ Add Item"
   - **Product**: "Coconut Oil"
   - **Quantity**: 30
   - **Unit**: "bottles"
   - **Unit Price**: 2200.00
   - See total: ₱66,000.00

5. **Click "Create PO"**

✅ Your first PO is created!

### Test 2: Complete the Workflow (3 minutes)

**Step 1: Submit for Approval**
- Find your PO in the list
- Click "Submit for Approval"
- Status changes to "Pending Approval"

**Step 2: Approve**
- Click "Approve"
- Status changes to "Approved"

**Step 3: Confirm Order**
- Click "Confirm Order"
- Status changes to "Order Confirmed"

**Step 4: Mark In Transit**
- Click "Mark In Transit"
- Status changes to "In Transit"

**Step 5: Record Delivery**
- Click "Record Delivery"
- **Delivery Date**: Today
- **Received By**: Your name
- **Condition**: Good
- **Notes**: "All items received in good condition"
- Click "Record Delivery"
- Status changes to "Delivered"

**Step 6: Record Payment**
- Click "Add Payment"
- **Payment Date**: Today
- **Type**: Full
- **Method**: Bank Transfer
- **Amount**: ₱66,000.00 (auto-filled)
- **Reference**: "TRF-2025001"
- Click "Record Payment"
- Balance becomes ₱0.00

**Step 7: Close PO**
- Click "Close PO"
- Status changes to "Closed"

🎉 **Congratulations!** You've completed a full PO lifecycle!

## 💡 Common Scenarios

### Scenario A: Payment Before Delivery

1. Create PO
2. Set **Payment Timing** to "Before Delivery"
3. Submit → Approve
4. Click "Add Payment" (before confirming order)
5. Record payment with proof
6. Confirm Order → In Transit → Delivered → Close

### Scenario B: Partial Payments

1. Create PO with total ₱100,000
2. Set **Payment Timing** to "Partial"
3. Submit → Approve
4. Record Payment #1: ₱50,000 (advance)
5. Confirm Order → In Transit → Delivered
6. Record Payment #2: ₱50,000 (final)
7. Close PO

### Scenario C: Multiple Items

1. Create PO
2. Click "+ Add Item" multiple times:
   - Item 1: Coconut Oil, 30 bottles, ₱2,200
   - Item 2: Palm Oil, 20 gallons, ₱1,500
   - Item 3: Vegetable Oil, 50 liters, ₱800
3. See automatic total calculation
4. Complete workflow normally

### Scenario D: Damaged Delivery

1. Follow workflow until delivery
2. When recording delivery:
   - **Condition**: Select "Damaged"
   - **Inspection Notes**: "3 bottles broken during transit"
3. Document with photos (attachment support)
4. Process partial payment or request replacement

## 🎯 Pro Tips

### Managing Suppliers

- Add suppliers with complete bank details upfront
- Set realistic payment terms
- Keep supplier contacts updated
- Use notes field for special instructions

### Creating POs

- Always fill in expected delivery date
- Be specific with product descriptions
- Use consistent units (pcs, boxes, liters, kg)
- Add notes for special requirements
- Attach quotations when available

### Tracking Payments

- Always get reference numbers for bank transfers
- Keep proof of payment (upload attachments)
- Record partial payments immediately
- Match payment dates with bank statements

### Managing Deliveries

- Inspect items immediately upon arrival
- Document any discrepancies
- Get receiver's full name
- Note any quality issues
- Update PO status promptly

## 🔍 Finding Information

### Search POs:
- Type PO number in search box
- Type supplier name to find all their POs
- Use status filter for specific stages

### View History:
- All status changes are automatically logged
- Check payment history in Payments tab
- Review delivery records in Deliveries tab

### Reports (Coming Soon):
- Total purchase by supplier
- Outstanding payments
- Delivery performance
- Monthly purchase summary

## ⚠️ Important Notes

### Status Flow Rules:
- Can't skip statuses (must follow workflow)
- Can edit POs only in "Draft" status
- Can't delete POs with payments/deliveries
- Payment required before "Confirm Order" if timing is "Before Delivery"

### Financial Controls:
- Balance automatically calculated
- Can't overpay (amount > balance)
- Can't close PO with outstanding balance
- All amounts support 2 decimal places

### Best Practices:
1. **Always verify supplier details** before creating PO
2. **Document everything** - use notes and attachments
3. **Update status promptly** - keep workflow current
4. **Record payments immediately** - for accurate balance tracking
5. **Inspect deliveries thoroughly** - note any issues

## 🆘 Troubleshooting

### Can't create PO?
- ✅ Check if brand is selected
- ✅ Verify supplier exists and is active
- ✅ Ensure at least one item added
- ✅ Fill all required fields (marked with *)

### Payment not updating balance?
- ✅ Check amount is correct
- ✅ Verify payment was saved (check Payments tab)
- ✅ Refresh the page
- ✅ Database triggers should auto-update (check console for errors)

### Can't see certain buttons?
- ✅ Buttons appear based on PO status
- ✅ Check you're on the correct status
- ✅ Some actions require conditions (e.g., balance = 0)

### Calculations wrong?
- ✅ Verify unit prices have 2 decimals
- ✅ Check quantities are correct
- ✅ Refresh the page
- ✅ Database has auto-calculation triggers

## 📞 Next Steps

### Ready for Production?

Before going live:
1. ✅ Test all workflows
2. ✅ Add your actual suppliers
3. ✅ Train your team
4. ✅ Set up backup procedures
5. ✅ Configure user permissions (RLS policies)
6. ✅ Enable email notifications (optional)

### Want More Features?

Check `PURCHASING_SYSTEM_README.md` for:
- Future enhancement roadmap
- Technical details
- Advanced configurations
- API integration options

### Need Help?

- Review full documentation: `PURCHASING_SYSTEM_README.md`
- Check database migration: `migrations/complete-purchasing-migration.sql`
- Inspect component code: `app/components/PurchasingManager.tsx`
- Test with sample data first

---

**You're all set!** 🚀

This system handles the complete PO lifecycle from creation to closure, with proper payment and delivery tracking. It follows industry standards and includes all the features from your original requirements plus enhancements.

Start with the test workflow above, then adapt to your specific business processes. The system is flexible and can handle various purchasing scenarios.

Happy purchasing! 💼

