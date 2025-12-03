# Purchase Order to Raw Materials Integration

## Overview
This integration enables purchase orders to automatically update raw materials inventory when deliveries are received. When you record a delivery receipt for a purchase order, the system will automatically increase the stock levels of the linked raw materials.

## Changes Made

### 1. Database Schema Changes
**File:** `migrations/add-material-link-to-po-items.sql`

- Added `material_id` column to `purchase_order_items` table to link PO items to raw materials
- Created trigger `create_material_movement_from_delivery()` that automatically:
  - Creates material stock movements when delivery receipt items are recorded
  - Updates raw materials inventory using the existing stock movement system
  - Links the movement to the delivery receipt for full traceability

### 2. TypeScript Type Updates
**File:** `lib/supabase.ts`

- Added `material_id?: string` to `PurchaseOrderItem` type
- Added `material?: RawMaterial` to include material details when loading PO items

### 3. UI Enhancements
**File:** `app/components/PurchasingManager.tsx`

#### Purchase Order Creation:
- **Material Selection:** When creating/editing a purchase order, items added from the supplier catalog are now automatically linked to raw materials
- **Visual Indicator:** PO items linked to materials display a green "🔗 Linked to Inventory" badge
- **Data Loading:** Purchase orders now load with full material details for linked items
- **Catalog Integration:** The supplier catalog properly tracks which materials have been added using `material_id` instead of just description matching

#### Delivery Recording:
- **Enhanced Delivery Modal:** Shows all PO items in a table format
- **Quantity Input:** Each item has an input field for quantity received (defaults to ordered quantity)
- **Visual Feedback:** Items with 🔗 icon indicate they will update inventory
- **Item Notes:** Optional notes field per item for recording condition or issues
- **Smart Validation:** Modal validates that at least one item has quantity > 0
- **Automatic Updates:** Creates delivery_receipt_items records that trigger inventory updates

## How It Works

### Creating a Purchase Order with Material Links

1. **Select a Supplier:** When creating a PO, select a supplier that has raw materials in the catalog
2. **Use Catalog:** Click the "Catalog" button to see available materials from that supplier
3. **Add Materials:** Click on materials in the catalog to add them to the PO
   - These items will be automatically linked to the raw material
   - They'll show a green "🔗 Linked to Inventory" badge
   - The description will be read-only (since it's linked)
4. **Manual Items:** You can still add items manually that aren't linked to materials
   - These won't update inventory automatically
   - Useful for one-time purchases or items not tracked in inventory

### Recording a Delivery

1. **Find the PO:** Go to the purchase order you want to record a delivery for
2. **Click "Record Delivery":** This opens the delivery modal
3. **Enter Delivery Details:**
   - Delivery date
   - Who received it
   - Condition (good, damaged, partial, incomplete)
   - Any notes or inspection notes
4. **Enter Item Quantities:**
   - The modal shows all PO items in a table
   - Each item defaults to the full ordered quantity
   - Adjust quantities received as needed (e.g., for partial deliveries)
   - Items with 🔗 icon will update inventory automatically
   - Add optional notes per item if needed
5. **Save:** When you save the delivery, the system will:
   - Record the delivery receipt header
   - Create delivery receipt items with quantities
   - **Automatically create material stock movements** for all linked items
   - **Update raw materials inventory** with the received quantities
   - Update PO item quantities received
   - Update PO status to "delivered"
   - Create full audit trail linking back to the PO and delivery receipt
   - Show success message confirming inventory was updated

### Tracking Stock Movements

- Go to the **Raw Materials** section
- Click on any material to view its **Stock History**
- You'll see movements with:
  - Reference type: "delivery_receipt"
  - Reference number: The delivery receipt number
  - Notes: Includes the PO number and delivery details
  - Quantity received and unit cost
  - Running balance showing stock after each movement

## Database Migration

To apply this integration to your database:

```bash
# Run the migration SQL file in your Supabase SQL editor
# File: migrations/add-material-link-to-po-items.sql
```

Or copy the SQL content and run it in Supabase dashboard → SQL Editor.

## Benefits

1. **Automatic Inventory Updates:** No manual entry needed when materials arrive
2. **Full Traceability:** Every stock movement is linked back to the purchase order and delivery receipt
3. **Accurate Stock Levels:** Real-time updates ensure inventory counts are always current
4. **Cost Tracking:** Material costs are automatically updated based on purchase prices
5. **Audit Trail:** Complete history of all movements with who received, when, and from which PO
6. **Flexible:** Can still create PO items that aren't tracked in inventory for one-off purchases

## Example Workflow

```
1. Supplier has "Sugar 50kg" in raw materials catalog
   ↓
2. Create PO → Select supplier → Add "Sugar 50kg" from catalog
   → Item is linked to raw material (material_id set)
   ↓
3. Goods arrive → Record Delivery → Enter details
   ↓
4. System automatically:
   - Creates stock movement (type: 'in')
   - Increases "Sugar 50kg" current_stock
   - Updates unit_cost if different
   - Records who received and when
   ↓
5. Raw materials inventory is now updated!
   - Can see stock increase in Raw Materials section
   - Can view movement history
   - Low stock alerts update automatically
```

## Notes

- Only PO items linked to raw materials will update inventory
- Manual PO items (not from catalog) won't affect inventory
- Material costs are updated to match the PO unit price when received
- All movements are auditable through the material stock movements table
- The existing trigger system handles all stock calculations automatically

## Testing

Build completed successfully ✓
- No TypeScript errors
- No linting errors
- All routes compiled successfully

To test the full integration:
1. Ensure you have raw materials set up with supplier links
2. Create a purchase order using materials from the catalog
3. Record a delivery for that PO (enter quantities for items)
4. Check the raw materials inventory to see the stock increase
5. View the stock movement history to see the delivery record

## Troubleshooting

### Materials not updating after delivery?

**Check these points:**

1. **Did you run the migration?** 
   - File: `migrations/add-material-link-to-po-items.sql`
   - Must be run in Supabase SQL Editor before this feature works

2. **Are PO items linked to materials?**
   - When creating PO, use the "Catalog" button to add items
   - Look for green "🔗 Linked to Inventory" badge on items
   - Only linked items will update inventory

3. **Did you enter quantities in delivery modal?**
   - The new delivery modal shows a table of items
   - Each item needs a quantity_received > 0
   - Default is the full ordered quantity

4. **Check delivery_receipt_items table:**
   ```sql
   SELECT * FROM delivery_receipt_items 
   ORDER BY created_at DESC LIMIT 10;
   ```
   - Should have records when deliveries are recorded
   - These records trigger the inventory updates

5. **Check material_stock_movements:**
   ```sql
   SELECT * FROM material_stock_movements 
   WHERE reference_type = 'delivery_receipt'
   ORDER BY created_at DESC LIMIT 10;
   ```
   - Should see movements created automatically
   - Check the notes field for PO/DR references

6. **Was the PO created with old code?**
   - POs created before this update won't have material_id links
   - Solution: Edit the PO and re-add items from catalog

