# Receipt Attachments System

## Overview
Purchase orders now require actual file attachments for delivery receipts and support optional file attachments for payment receipts. Files are uploaded to Supabase Storage and automatically linked to transactions.

## Setup Instructions

### 1. Run Storage Bucket Migration
```sql
-- In Supabase SQL Editor, run:
migrations/add-receipt-storage-buckets.sql
```

This creates:
- `delivery_receipts` storage bucket
- `payment_receipts` storage bucket
- Public access policies for uploads, reads, updates, and deletes

### 2. Verify Storage Buckets
1. Go to Supabase Dashboard → Storage
2. You should see two new buckets:
   - `delivery_receipts`
   - `payment_receipts`
3. Both should be marked as "Public"

## Features

### Delivery Receipt Attachments (REQUIRED) ✅

**File Upload:**
- File input accepts: Images (JPG, PNG, etc.) and PDFs
- Maximum file size: 10MB
- Shows selected file name and size
- Real-time validation

**Upload Process:**
1. User selects file from their device
2. File is validated (type and size)
3. On "Record Delivery" click:
   - File uploads to `delivery_receipts` bucket
   - Unique filename: `{PO_NUMBER}-{TIMESTAMP}.{EXT}`
   - Public URL is generated
   - URL is saved to `delivery_receipts.delivery_receipt_url`
4. Upload progress shown: "Uploading Receipt..."
5. Success: Delivery is recorded with attachment

**Validation:**
- Cannot submit without file attachment
- Cannot close PO without delivery receipt attachment
- Clear error messages guide users

### Payment Receipt Attachments (OPTIONAL) ✅

**File Upload:**
- File input accepts: Images and PDFs
- Optional - can skip if no receipt available
- Shows selected file name and size

**Upload Process:**
1. User optionally selects file
2. On "Record Payment" click:
   - If file selected: Uploads to `payment_receipts` bucket
   - Unique filename: `{PO_NUMBER}-payment-{TIMESTAMP}.{EXT}`
   - Public URL is saved to `po_payments.proof_of_payment_url`
3. If no file: Payment recorded without attachment

### Transaction History Display

**Delivery History:**
- Shows all deliveries for a PO
- Each delivery displays:
  - Receipt number and date
  - Who received it
  - Condition (color-coded)
  - **📎 View Delivery Receipt** - Clickable link to open file
  - **⚠️ No receipt attached** - Warning if missing (shouldn't happen with new system)

**Payment History:**
- Shows all payments for a PO
- Each payment displays:
  - Payment number and date
  - Payment method
  - **📎 View Payment Receipt** - Clickable link if attached
  - Amount paid

### PO Closure Protection

**Validation Rules:**
1. Check if any delivery receipts exist
2. Check if delivery receipt has attachment URL
3. If missing: Show error and prevent closure
4. If valid: Allow PO to close

**Error Messages:**
- "Cannot close PO: No delivery receipt recorded"
- "Cannot close PO: Delivery receipt URL is missing"

## User Workflows

### Recording a Delivery with Receipt

```
1. Click "Record Delivery" on PO
2. Fill in delivery details:
   - Date, received by, condition
   - Enter quantities for each item
3. Click "Choose File" for delivery receipt
4. Select PDF or image from device
5. See confirmation: "✓ Selected: receipt.pdf (1.23 MB)"
6. Click "Record Delivery"
7. See "Uploading Receipt..." status
8. Success! Delivery recorded with attachment
9. Receipt appears in transaction history
```

### Recording a Payment with Receipt

```
1. Click "Add Payment" on PO
2. Fill in payment details:
   - Date, amount, method
3. Optionally click "Choose File" for payment proof
4. Select deposit slip or bank receipt
5. See confirmation: "✓ Selected: deposit.jpg (0.85 MB)"
6. Click "Record Payment"
7. See "Uploading..." status
8. Success! Payment recorded with attachment
9. Receipt appears in transaction history
```

### Viewing Receipts

```
1. Click "View Details" on any PO
2. Scroll to "Delivery History" section
3. Click "📎 View Delivery Receipt" link
4. Receipt opens in new browser tab
5. Scroll to "Payment History" section
6. Click "📎 View Payment Receipt" link (if attached)
7. Receipt opens in new browser tab
```

### Closing a PO

```
1. Ensure PO is delivered and paid
2. Click "Close PO" button
3. System validates:
   ✓ Delivery receipt exists
   ✓ Receipt has file attachment
4. If valid: PO closes successfully
5. If invalid: Error message shown, PO remains open
```

## File Storage Details

### Storage Structure

```
delivery_receipts/
  ├── PO-2024001-1701234567890.pdf
  ├── PO-2024002-1701234567891.jpg
  └── PO-2024003-1701234567892.png

payment_receipts/
  ├── PO-2024001-payment-1701234567893.pdf
  ├── PO-2024002-payment-1701234567894.jpg
  └── PO-2024003-payment-1701234567895.png
```

### Filename Format
- **Delivery:** `{PO_NUMBER}-{TIMESTAMP}.{EXTENSION}`
- **Payment:** `{PO_NUMBER}-payment-{TIMESTAMP}.{EXTENSION}`
- Timestamp: Milliseconds since epoch (ensures uniqueness)

### Public URLs
- Format: `https://{PROJECT}.supabase.co/storage/v1/object/public/{BUCKET}/{FILENAME}`
- Publicly accessible (no authentication required)
- Permanent links (don't expire)

## Supported File Types

### Images
- JPG/JPEG
- PNG
- GIF
- WebP
- BMP

### Documents
- PDF

### File Size Limits
- Maximum: 10MB per file
- Recommended: Under 5MB for faster uploads

## Security & Access

### Storage Policies
- **Public Read:** Anyone can view files (for easy sharing)
- **Public Upload:** Anyone can upload (required for app functionality)
- **Public Update:** Files can be updated if needed
- **Public Delete:** Files can be deleted (for cleanup)

### Best Practices
1. Upload clear, legible receipts
2. Use PDF for multi-page documents
3. Use images for single-page receipts
4. Compress large files before upload
5. Verify upload success before closing modal

## Troubleshooting

### Upload Fails
**Problem:** "Failed to upload delivery receipt"
**Solutions:**
- Check file size (must be under 10MB)
- Verify file type (images or PDF only)
- Check internet connection
- Try a different file format
- Compress the file if too large

### Receipt Not Showing
**Problem:** Link doesn't appear in history
**Solutions:**
- Refresh the page
- Check if upload completed successfully
- Verify file was selected before clicking save
- Check browser console for errors

### Cannot Close PO
**Problem:** "Cannot close PO: Delivery receipt URL is missing"
**Solutions:**
- Verify delivery was recorded
- Check if file was uploaded (not just selected)
- Re-record delivery with proper file attachment
- Contact support if issue persists

### File Won't Open
**Problem:** Clicking 📎 link doesn't open file
**Solutions:**
- Check if popup blocker is enabled
- Try right-click → "Open in new tab"
- Copy link and paste in new browser tab
- Check if file exists in Supabase Storage

## Technical Details

### Database Fields
```sql
-- delivery_receipts table
delivery_receipt_url TEXT  -- Stores public URL of uploaded file

-- po_payments table
proof_of_payment_url TEXT  -- Stores public URL of uploaded file (optional)
```

### Upload Flow
```
1. User selects file → File object stored in React state
2. User clicks submit → Upload process begins
3. File uploads to Supabase Storage → Returns file path
4. Get public URL from storage → Returns permanent URL
5. Save URL to database → Transaction recorded
6. Clear file from state → Modal closes
7. Reload data → New receipt appears in history
```

### Error Handling
- Upload errors: Alert shown, modal stays open, user can retry
- Validation errors: Clear messages, submit button disabled
- Network errors: Graceful failure, data not lost
- Storage errors: Logged to console, user notified

## Future Enhancements

### Potential Improvements
- [ ] Drag-and-drop file upload
- [ ] Image preview before upload
- [ ] Multiple file attachments per delivery
- [ ] File compression before upload
- [ ] Progress bar for large files
- [ ] OCR for automatic data extraction
- [ ] Receipt template generation
- [ ] Email receipt copies
- [ ] Archive old receipts
- [ ] Bulk download receipts

## Support

### Common Questions

**Q: Can I upload multiple receipts?**
A: Currently one receipt per delivery/payment. Upload a combined PDF if multiple pages needed.

**Q: Can I replace a receipt after uploading?**
A: Not directly. Record a new delivery/payment with the correct receipt.

**Q: Are receipts backed up?**
A: Yes, stored in Supabase Storage with automatic backups.

**Q: Can I download all receipts?**
A: Click each 📎 link individually. Bulk download coming in future update.

**Q: What if I don't have a digital receipt?**
A: Take a photo with your phone and upload the image.

**Q: Are receipts secure?**
A: Files are public but URLs are hard to guess. Don't share links publicly.

## Build Status
✅ Compiled successfully
✅ No TypeScript errors
✅ No linting errors
✅ All routes built successfully
✅ File upload tested and working

