'use client'
import { useState, useEffect } from 'react'
import { supabase, Brand, Supplier, PurchaseOrder, PurchaseOrderItem, POPayment, DeliveryReceipt, PurchaseRequisition, RawMaterial, MaterialStockMovement } from '../../lib/supabase'

interface PurchasingManagerProps {
  selectedBrand?: Brand | null
  theme?: string
}

type Tab = 'suppliers' | 'requisitions' | 'purchase_orders' | 'transactions' | 'raw_materials'

type POFormData = {
  supplier_id: string
  order_date: string
  expected_delivery_date: string
  purchasing_agent: string
  payment_terms: string
  payment_method: 'cash' | 'check' | 'bank_transfer'
  payment_timing: 'before_delivery' | 'after_delivery' | 'partial'
  delivery_address: string
  delivery_contact: string
  delivery_phone: string
  notes: string
}

export function PurchasingManager({ selectedBrand, theme = 'blue' }: PurchasingManagerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('raw_materials')
  
  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  
  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [showPOModal, setShowPOModal] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [poItems, setPOItems] = useState<Partial<PurchaseOrderItem>[]>([])
  const [supplierCatalog, setSupplierCatalog] = useState<RawMaterial[]>([])
  
  // Payments state
  const [payments, setPayments] = useState<POPayment[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<PurchaseOrder | null>(null)
  
  // Deliveries state
  const [deliveries, setDeliveries] = useState<DeliveryReceipt[]>([])
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [selectedPOForDelivery, setSelectedPOForDelivery] = useState<PurchaseOrder | null>(null)
  
  // PO Details Modal state
  const [showPODetailsModal, setShowPODetailsModal] = useState(false)
  const [selectedPOForDetails, setSelectedPOForDetails] = useState<PurchaseOrder | null>(null)
  
  // Purchase Requisitions state
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([])
  const [showPRModal, setShowPRModal] = useState(false)
  const [convertingPR, setConvertingPR] = useState<PurchaseRequisition | null>(null)
  const [showConvertPRModal, setShowConvertPRModal] = useState(false)
  
  // Raw Materials Inventory state
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)
  const [showStockMovementModal, setShowStockMovementModal] = useState(false)
  const [selectedMaterialForMovement, setSelectedMaterialForMovement] = useState<RawMaterial | null>(null)
  const [showMovementHistory, setShowMovementHistory] = useState(false)
  const [selectedMaterialForHistory, setSelectedMaterialForHistory] = useState<RawMaterial | null>(null)
  const [movementHistory, setMovementHistory] = useState<MaterialStockMovement[]>([])
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  useEffect(() => {
    loadSuppliers()
    if (selectedBrand) {
      loadPurchaseOrders()
      loadPayments()
      loadDeliveries()
      loadRequisitions()
      loadRawMaterials()
    }
  }, [selectedBrand])
  
  // =============================================
  // LOAD DATA FUNCTIONS
  // =============================================
  
  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name')
    if (data) setSuppliers(data)
  }
  
  const loadPurchaseOrders = async () => {
    if (!selectedBrand) return
    
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(*),
        items:purchase_order_items(*, material:raw_materials(*)),
        payments:po_payments(*)
      `)
      .eq('brand_id', selectedBrand.id)
      .order('created_at', { ascending: false })
    
    if (data) setPurchaseOrders(data as PurchaseOrder[])
  }
  
  const loadPayments = async () => {
    if (!selectedBrand) return
    
    const { data, error } = await supabase
      .from('po_payments')
      .select(`
        *,
        purchase_order:purchase_orders(po_number, supplier:suppliers(name))
      `)
      .order('payment_date', { ascending: false })
    
    if (data) setPayments(data as POPayment[])
  }
  
  const loadDeliveries = async () => {
    if (!selectedBrand) return
    
    // Get all PO IDs for this brand first
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('id, po_number, supplier_id')
      .eq('brand_id', selectedBrand.id)
    
    if (!pos || pos.length === 0) {
      setDeliveries([])
      return
    }
    
    const poIds = pos.map(p => p.id)
    
    // Get deliveries without nested relationships
    const { data: deliveriesData, error } = await supabase
      .from('delivery_receipts')
      .select('*')
      .in('po_id', poIds)
      .order('delivery_date', { ascending: false })
    
    if (error) {
      console.error('Error loading deliveries:', error)
      return
    }
    
    if (!deliveriesData || deliveriesData.length === 0) {
      setDeliveries([])
      return
    }
    
    // Get suppliers
    const supplierIds = pos.map(p => p.supplier_id).filter(Boolean)
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('id', supplierIds)
    
    // Manually join the data
    const deliveriesWithDetails = deliveriesData.map(delivery => {
      const po = pos.find(p => p.id === delivery.po_id)
      const supplier = suppliers?.find(s => s.id === po?.supplier_id)
      
      return {
        ...delivery,
        purchase_order: {
          po_number: po?.po_number || '',
          supplier: {
            name: supplier?.name || ''
          }
        }
      }
    })
    
    setDeliveries(deliveriesWithDetails as any)
  }
  
  const loadRequisitions = async () => {
    if (!selectedBrand) return
    
    const { data, error } = await supabase
      .from('purchase_requisitions')
      .select('*')
      .eq('brand_id', selectedBrand.id)
      .order('created_at', { ascending: false })
    
    if (data) setRequisitions(data)
  }
  
  const loadRawMaterials = async () => {
    if (!selectedBrand) return
    
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*, supplier:suppliers(*)')
      .eq('brand_id', selectedBrand.id)
      .order('material_name')
    
    if (data) setRawMaterials(data as RawMaterial[])
  }
  
  const loadMovementHistory = async (materialId: string) => {
    const { data, error } = await supabase
      .from('material_stock_movements')
      .select('*')
      .eq('material_id', materialId)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (data) setMovementHistory(data)
  }
  
  // =============================================
  // VIEW PO DETAILS FUNCTION
  // =============================================
  
  const viewPODetails = async (poId: string) => {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(*), items:purchase_order_items(*), payments:po_payments(*)')
      .eq('id', poId)
      .single()
    
    if (po) {
      setSelectedPOForDetails(po as PurchaseOrder)
      setShowPODetailsModal(true)
    }
  }
  
  // =============================================
  // PRINT FUNCTIONS
  // =============================================
  
  const printPO = (po: PurchaseOrder) => {
    const printWindow = window.open('', '', 'width=800,height=600')
    if (!printWindow) return
    
    const itemsTable = po.items?.map((item, index) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${item.product_description}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.unit}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₱${item.unit_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">₱${(item.quantity * item.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
      </tr>
    `).join('') || ''
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order - ${po.po_number}</title>
        <style>
          @media print {
            @page { margin: 0.5cm; }
            body { margin: 0; }
            .print-button { display: none; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #1f2937;
            padding: 15px;
            max-width: 210mm;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #000;
          }
          .company-info {
            flex: 1;
          }
          .company-name {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .doc-info {
            text-align: right;
          }
          .doc-title {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .po-number {
            font-size: 14px;
            font-weight: 600;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
          }
          .info-section {
            background: #f9fafb;
            padding: 10px;
            border-radius: 4px;
          }
          .section-title {
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 6px;
          }
          .info-line {
            display: flex;
            margin-bottom: 3px;
            font-size: 11px;
          }
          .info-label {
            min-width: 90px;
            color: #6b7280;
          }
          .info-value {
            font-weight: 500;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          thead {
            background: #f3f4f6;
          }
          th {
            padding: 8px 6px;
            text-align: left;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            border-bottom: 2px solid #d1d5db;
          }
          td {
            padding: 6px;
            font-size: 11px;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 2px dashed #d1d5db;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 11px;
          }
          .grand-total {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            background: #f3f4f6;
            border-radius: 4px;
            margin-top: 8px;
          }
          .grand-total-label {
            font-weight: 700;
            font-size: 13px;
          }
          .grand-total-amount {
            font-weight: 700;
            font-size: 16px;
          }
          .signatures {
            display: flex;
            gap: 40px;
            margin-top: 30px;
          }
          .signature-box {
            flex: 1;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 30px;
            padding-top: 4px;
            font-size: 10px;
          }
          .signature-label {
            font-size: 9px;
            color: #6b7280;
            text-transform: uppercase;
            margin-top: 2px;
          }
          .print-button {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .print-button:hover { background: #1d4ed8; }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            font-size: 9px;
            color: #9ca3af;
          }
        </style>
      </head>
      <body>
        <button class="print-button" onclick="window.print()">Print</button>
        
        <div class="header">
          <div class="company-info">
            <div class="company-name">GILNAKS FOOD CORPORATION</div>
          </div>
          <div class="doc-info">
            <div class="doc-title">PURCHASE ORDER</div>
            <div class="po-number">${po.po_number}</div>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-section">
            <div class="section-title">Purchase Order Details</div>
            <div class="info-line">
              <span class="info-label">Order Date:</span>
              <span class="info-value">${new Date(po.order_date).toLocaleDateString()}</span>
            </div>
            <div class="info-line">
              <span class="info-label">Expected:</span>
              <span class="info-value">${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'TBD'}</span>
            </div>
            <div class="info-line">
              <span class="info-label">Prepared by:</span>
              <span class="info-value">${po.purchasing_agent}</span>
            </div>
            ${po.approved_by ? `
            <div class="info-line">
              <span class="info-label">Approved by:</span>
              <span class="info-value">${po.approved_by}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="info-section">
            <div class="section-title">Payment Information</div>
            <div class="info-line">
              <span class="info-label">Terms:</span>
              <span class="info-value">${po.payment_terms || 'Net 30 days'}</span>
            </div>
            <div class="info-line">
              <span class="info-label">Method:</span>
              <span class="info-value">${po.payment_method?.replace('_', ' ') || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-section">
            <div class="section-title">Supplier</div>
            <div class="info-line">
              <span class="info-label">Name:</span>
              <span class="info-value" style="font-weight: 600;">${po.supplier?.name || ''}</span>
            </div>
            ${po.supplier?.contact_person ? `
            <div class="info-line">
              <span class="info-label">Contact:</span>
              <span class="info-value">${po.supplier.contact_person}</span>
            </div>
            ` : ''}
            ${po.supplier?.phone ? `
            <div class="info-line">
              <span class="info-label">Phone:</span>
              <span class="info-value">${po.supplier.phone}</span>
            </div>
            ` : ''}
            ${po.supplier?.address ? `
            <div class="info-line">
              <span class="info-label">Address:</span>
              <span class="info-value">${po.supplier.address}</span>
            </div>
            ` : ''}
          </div>
          
          ${po.delivery_address ? `
          <div class="info-section">
            <div class="section-title">Delivery Information</div>
            <div class="info-line">
              <span class="info-label">Address:</span>
              <span class="info-value">${po.delivery_address}</span>
            </div>
            ${po.delivery_contact ? `
            <div class="info-line">
              <span class="info-label">Contact:</span>
              <span class="info-value">${po.delivery_contact}</span>
            </div>
            ` : ''}
            ${po.delivery_phone ? `
            <div class="info-line">
              <span class="info-label">Phone:</span>
              <span class="info-value">${po.delivery_phone}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Product Description</th>
              <th style="width: 60px;" class="text-center">Qty</th>
              <th style="width: 50px;" class="text-center">Unit</th>
              <th style="width: 100px;" class="text-right">Unit Price</th>
              <th style="width: 110px;" class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTable}
          </tbody>
        </table>
        
        <div class="totals">
          ${po.tax_amount > 0 ? `
          <div class="total-row">
            <span style="color: #6b7280;">Subtotal</span>
            <span style="font-weight: 600;">₱${po.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div class="total-row">
            <span style="color: #6b7280;">Tax</span>
            <span style="font-weight: 600;">₱${po.tax_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          ` : ''}
          <div class="grand-total">
            <span class="grand-total-label">TOTAL AMOUNT</span>
            <span class="grand-total-amount">₱${po.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
        
        ${po.notes ? `
        <div class="info-section" style="margin-top: 15px;">
          <div class="section-title">Notes</div>
          <div style="font-size: 11px; line-height: 1.5;">${po.notes}</div>
        </div>
        ` : ''}
        
        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line">${po.purchasing_agent || ''}</div>
            <div class="signature-label">Prepared by</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">${po.approved_by || ''}</div>
            <div class="signature-label">Approved by</div>
            ${po.approved_date ? `<div class="signature-label">${new Date(po.approved_date).toLocaleDateString()}</div>` : ''}
          </div>
        </div>
        
        <div class="footer">
          Generated on ${new Date().toLocaleString()}
        </div>
      </body>
      </html>
    `
    
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }
  
  // =============================================
  // SUPPLIER CRUD FUNCTIONS
  // =============================================
  
  const saveSupplier = async (supplier: Partial<Supplier>) => {
    if (editingSupplier) {
      const { error } = await supabase
        .from('suppliers')
        .update(supplier)
        .eq('id', editingSupplier.id)
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert([supplier])
    }
    
    setShowSupplierModal(false)
    setEditingSupplier(null)
    loadSuppliers()
  }
  
  const deleteSupplier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return
    
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
    
    loadSuppliers()
  }
  
  // =============================================
  // PURCHASE ORDER FUNCTIONS
  // =============================================
  
  const generatePONumber = () => {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const random = Math.floor(Math.random() * 9000) + 1000
    return `PO-${year}${random}`
  }
  
  const savePurchaseOrder = async (poData: Partial<POFormData>) => {
    if (!selectedBrand) return
    
    if (editingPO) {
      // Update existing PO
      const { error } = await supabase
        .from('purchase_orders')
        .update(poData)
        .eq('id', editingPO.id)
      
      // Update items
      if (poItems.length > 0) {
        // Delete existing items
        await supabase
          .from('purchase_order_items')
          .delete()
          .eq('po_id', editingPO.id)
        
        // Insert new items
        const itemsToInsert = poItems.map(item => ({
          ...item,
          unit_price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) || 0 : item.unit_price,
          material_id: item.material_id || null,
          po_id: editingPO.id
        }))
        await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert)
      }
    } else {
      // Create new PO - Clean up empty strings to null for optional fields
      const po = {
        supplier_id: poData.supplier_id,
        brand_id: selectedBrand.id,
        po_number: generatePONumber(),
        order_date: poData.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: poData.expected_delivery_date || null,
        purchasing_agent: poData.purchasing_agent,
        payment_terms: poData.payment_terms || null,
        payment_method: poData.payment_method || 'bank_transfer',
        payment_timing: poData.payment_timing || 'after_delivery',
        delivery_address: poData.delivery_address || null,
        delivery_contact: poData.delivery_contact || null,
        delivery_phone: poData.delivery_phone || null,
        notes: poData.notes || null,
        status: 'draft',
        subtotal: 0,
        tax_amount: 0,
        total_amount: 0,
        paid_amount: 0,
        balance_amount: 0
      }
      
      console.log('Creating PO with data:', po)
      
      const { data: newPO, error } = await supabase
        .from('purchase_orders')
        .insert([po])
        .select()
        .single()
      
      if (error) {
        console.error('Error creating PO:', error)
        alert(`Error creating PO: ${error.message}`)
        return
      }
      
      console.log('PO created successfully:', newPO)
      
      if (newPO && poItems.length > 0) {
        const itemsToInsert = poItems.map(item => ({
          product_description: item.product_description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) || 0 : item.unit_price,
          notes: item.notes || null,
          material_id: item.material_id || null,
          po_id: newPO.id
        }))
        
        console.log('Inserting items:', itemsToInsert)
        
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert)
        
        if (itemsError) {
          console.error('Error inserting items:', itemsError)
          alert(`Error adding items: ${itemsError.message}`)
        }
      }
    }
    
    setShowPOModal(false)
    setEditingPO(null)
    setPOItems([])
    loadPurchaseOrders()
  }
  
  const updatePOStatus = async (poId: string, newStatus: string) => {
    // If closing PO, check if delivery receipt exists
    if (newStatus === 'closed') {
      const { data: deliveries } = await supabase
        .from('delivery_receipts')
        .select('id, delivery_receipt_url')
        .eq('po_id', poId)
      
      if (!deliveries || deliveries.length === 0) {
        alert('Cannot close PO: No delivery receipt recorded.\n\nPlease record a delivery first.')
        return
      }
      
      const hasReceipt = deliveries.some(d => d.delivery_receipt_url && d.delivery_receipt_url.trim() !== '')
      if (!hasReceipt) {
        alert('Cannot close PO: Delivery receipt URL is missing.\n\nPlease add the delivery receipt attachment before closing.')
        return
      }
    }
    
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: newStatus })
      .eq('id', poId)
    
    if (error) {
      alert(`Error updating PO status: ${error.message}`)
      return
    }
    
    loadPurchaseOrders()
  }
  
  const deletePurchaseOrder = async (id: string, poNumber: string) => {
    if (!confirm(`Delete PO ${poNumber}?\n\nThis will permanently delete:\n• Purchase order\n• All items\n• Payment records\n• Delivery receipts\n• Status history\n\nThis cannot be undone.`)) return
    
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id)
    
    if (error) {
      alert(`Error deleting PO: ${error.message}`)
    } else {
      loadPurchaseOrders()
    }
  }
  
  // =============================================
  // PAYMENT FUNCTIONS
  // =============================================
  
  const generatePaymentNumber = () => {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const random = Math.floor(Math.random() * 9000) + 1000
    return `PAY-${year}${random}`
  }
  
  const savePayment = async (paymentData: Partial<POPayment>) => {
    if (!selectedPOForPayment) return
    
    const payment = {
      ...paymentData,
      po_id: selectedPOForPayment.id,
      payment_number: generatePaymentNumber()
    }
    
    const { error } = await supabase
      .from('po_payments')
      .insert([payment])
    
    setShowPaymentModal(false)
    setSelectedPOForPayment(null)
    loadPayments()
    loadPurchaseOrders()
  }
  
  // =============================================
  // DELIVERY FUNCTIONS
  // =============================================
  
  const generateDeliveryNumber = () => {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const random = Math.floor(Math.random() * 9000) + 1000
    return `DR-${year}${random}`
  }
  
  const saveDelivery = async (
    deliveryData: Partial<DeliveryReceipt>, 
    items: Array<{po_item_id: string, quantity_received: number, notes?: string}>
  ) => {
    if (!selectedPOForDelivery) return
    
    const delivery = {
      po_id: selectedPOForDelivery.id,
      receipt_number: generateDeliveryNumber(),
      delivery_date: deliveryData.delivery_date || new Date().toISOString().split('T')[0],
      received_by: deliveryData.received_by || '',
      condition: deliveryData.condition || 'good',
      notes: deliveryData.notes || null,
      inspection_notes: deliveryData.inspection_notes || null,
      delivery_receipt_url: deliveryData.delivery_receipt_url || null
    }
    
    console.log('Creating delivery:', delivery)
    console.log('Delivery items:', items)
    
    // Insert delivery receipt and get the ID
    const { data: newDelivery, error } = await supabase
      .from('delivery_receipts')
      .insert([delivery])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating delivery:', error)
      alert(`Error recording delivery: ${error.message}`)
      return
    }
    
    // Insert delivery receipt items
    if (newDelivery && items.length > 0) {
      const deliveryItems = items.map(item => ({
        delivery_receipt_id: newDelivery.id,
        po_item_id: item.po_item_id,
        quantity_received: item.quantity_received,
        notes: item.notes || null
      }))
      
      console.log('Creating delivery items:', deliveryItems)
      
      const { error: itemsError } = await supabase
        .from('delivery_receipt_items')
        .insert(deliveryItems)
      
      if (itemsError) {
        console.error('Error creating delivery items:', itemsError)
        alert(`Error recording delivery items: ${itemsError.message}`)
        return
      }
      
      console.log('✅ Delivery items created successfully - material stock should update automatically')
    }
    
    // Update PO status to delivered if not already
    if (selectedPOForDelivery.status !== 'delivered') {
      await updatePOStatus(selectedPOForDelivery.id, 'delivered')
    }
    
    setShowDeliveryModal(false)
    setSelectedPOForDelivery(null)
    loadDeliveries()
    loadPurchaseOrders()
    loadRawMaterials() // Reload materials to see updated stock
    
    alert('✅ Delivery recorded successfully! Raw materials inventory has been updated.')
  }
  
  // =============================================
  // FILTER FUNCTIONS
  // =============================================
  
  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter
    const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          po.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })
  
  // =============================================
  // STATUS BADGE FUNCTION
  // =============================================
  
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      draft: { color: 'gray', label: 'Draft' },
      pending_approval: { color: 'yellow', label: 'Pending Approval' },
      approved: { color: 'blue', label: 'Approved' },
      order_confirmed: { color: 'indigo', label: 'Order Confirmed' },
      in_transit: { color: 'purple', label: 'In Transit' },
      delivered: { color: 'green', label: 'Delivered' },
      paid: { color: 'teal', label: 'Paid' },
      closed: { color: 'gray', label: 'Closed' },
      cancelled: { color: 'red', label: 'Cancelled' }
    }
    
    const config = statusConfig[status] || { color: 'gray', label: status }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${config.color}-100 text-${config.color}-800`}>
        {config.label}
      </span>
    )
  }
  
  // =============================================
  // RENDER FUNCTIONS
  // =============================================
  
  if (!selectedBrand) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-600">Manage purchase orders and supplier transactions</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-500 text-center py-8">Please select a brand to manage purchase orders</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Procurement</h1>
        <p className="text-sm text-gray-600">Track raw materials, manage suppliers and purchase orders</p>
      </div>
      
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('raw_materials')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'raw_materials'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Raw Materials
            </button>
            <button
              onClick={() => setActiveTab('purchase_orders')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'purchase_orders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Purchase Orders
            </button>
            <button
              onClick={() => setActiveTab('requisitions')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'requisitions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Requisitions
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'suppliers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Suppliers
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transactions
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="p-6">
          {/* PURCHASE ORDERS TAB */}
          {activeTab === 'purchase_orders' && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex justify-between items-center gap-4">
                <div className="flex gap-4 flex-1">
                  <input
                    type="text"
                    placeholder="Search PO number or supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="order_confirmed">Order Confirmed</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="paid">Paid</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    setEditingPO(null)
                    setPOItems([])
                    setShowPOModal(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Create PO
                </button>
              </div>
              
              {/* PO List */}
              <div className="space-y-3">
                {filteredPurchaseOrders.map((po) => (
                  <div key={po.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{po.po_number}</h3>
                          {getStatusBadge(po.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                          <div>
                            <span className="text-gray-500">Supplier:</span>
                            <span className="ml-2 font-medium">{po.supplier?.name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Order Date:</span>
                            <span className="ml-2">{new Date(po.order_date).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total Amount:</span>
                            <span className="ml-2 font-medium">₱{po.total_amount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Balance:</span>
                            <span className="ml-2 font-medium text-red-600">₱{po.balance_amount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Payment:</span>
                            <span className="ml-2">{po.payment_timing.replace('_', ' ')}</span>
                          </div>
                          {po.expected_delivery_date && (
                            <div>
                              <span className="text-gray-500">Expected:</span>
                              <span className="ml-2">{new Date(po.expected_delivery_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {/* Print Button - Available for approved onwards */}
                        {['approved', 'order_confirmed', 'in_transit', 'delivered', 'paid', 'closed'].includes(po.status) && (
                          <button
                            onClick={() => printPO(po)}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Print
                          </button>
                        )}
                        
                        {/* Status Actions */}
                        {po.status === 'draft' && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'pending_approval')}
                            className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                            Submit for Approval
                          </button>
                        )}
                        {po.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => updatePOStatus(po.id, 'approved')}
                              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updatePOStatus(po.id, 'draft')}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {po.status === 'approved' && (
                          <>
                            {po.payment_timing === 'before_delivery' && po.balance_amount > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedPOForPayment(po)
                                  setShowPaymentModal(true)
                                }}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                Add Payment
                              </button>
                            )}
                            <button
                              onClick={() => updatePOStatus(po.id, 'order_confirmed')}
                              className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                            >
                              Confirm Order
                            </button>
                          </>
                        )}
                        {po.status === 'order_confirmed' && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'in_transit')}
                            className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          >
                            Mark In Transit
                          </button>
                        )}
                        {po.status === 'in_transit' && (
                          <button
                            onClick={() => {
                              setSelectedPOForDelivery(po)
                              setShowDeliveryModal(true)
                            }}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Record Delivery
                          </button>
                        )}
                        {po.status === 'delivered' && po.payment_timing === 'after_delivery' && po.balance_amount > 0 && (
                          <button
                            onClick={() => {
                              setSelectedPOForPayment(po)
                              setShowPaymentModal(true)
                            }}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Add Payment
                          </button>
                        )}
                        {(po.status === 'delivered' || po.status === 'paid') && po.balance_amount === 0 && (
                          <button
                            onClick={() => updatePOStatus(po.id, 'closed')}
                            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Close PO
                          </button>
                        )}
                        
                        {/* Edit/Delete */}
                        {po.status === 'draft' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingPO(po)
                                setPOItems(po.items || [])
                                setShowPOModal(true)
                              }}
                              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deletePurchaseOrder(po.id, po.po_number)}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        
                        {/* Delete for closed/cancelled */}
                        {(po.status === 'closed' || po.status === 'cancelled') && (
                          <button
                            onClick={() => deletePurchaseOrder(po.id, po.po_number)}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Items Preview */}
                    {po.items && po.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-2">Items ({po.items.length}):</p>
                        <div className="space-y-1">
                          {po.items.slice(0, 3).map((item) => (
                            <div key={item.id} className="text-xs text-gray-600 flex justify-between">
                              <span>{item.product_description}</span>
                              <span>{item.quantity} {item.unit} × ₱{item.unit_price.toLocaleString()}</span>
                            </div>
                          ))}
                          {po.items.length > 3 && (
                            <p className="text-xs text-gray-400">+{po.items.length - 3} more items</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {filteredPurchaseOrders.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No purchase orders found</p>
                    <p className="text-sm mt-1">Create your first purchase order to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* SUPPLIERS TAB */}
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Suppliers</h2>
                <button
                  onClick={() => {
                    setEditingSupplier(null)
                    setShowSupplierModal(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Add Supplier
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suppliers.map((supplier) => {
                  // Count products for this supplier
                  const productCount = rawMaterials.filter(m => m.supplier_id === supplier.id).length
                  
                  return (
                  <div key={supplier.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{supplier.name}</h3>
                          {productCount > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                              {productCount} product{productCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {supplier.contact_person && (
                          <p className="text-sm text-gray-600">{supplier.contact_person}</p>
                        )}
                          <div className="mt-2 space-y-1 text-sm">
                            {supplier.phone && (
                              <p className="text-gray-600 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {supplier.phone}
                              </p>
                            )}
                            {supplier.email && (
                              <p className="text-gray-600 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {supplier.email}
                              </p>
                            )}
                            {supplier.payment_terms && (
                              <p className="text-gray-600 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                {supplier.payment_terms}
                              </p>
                            )}
                          </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingSupplier(supplier)
                            setShowSupplierModal(true)
                          }}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteSupplier(supplier.id)}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* TRANSACTIONS TAB */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Transaction History</h2>
              <p className="text-xs text-gray-500">Payments and deliveries grouped by supplier</p>
              
              <div className="space-y-3">
                {/* Group by Supplier */}
                {(() => {
                  // Create supplier groups
                  const supplierGroups: { [key: string]: { name: string; pos: { [key: string]: { poNumber: string; payments: any[]; deliveries: any[] } } } } = {}
                  
                  // Group payments by supplier and PO
                  payments.forEach((payment: any) => {
                    const supplierId = payment.purchase_order?.supplier?.id || 'unknown'
                    const supplierName = payment.purchase_order?.supplier?.name || 'Unknown Supplier'
                    const poId = payment.po_id
                    const poNumber = payment.purchase_order?.po_number || 'N/A'
                    
                    if (!supplierGroups[supplierId]) {
                      supplierGroups[supplierId] = { name: supplierName, pos: {} }
                    }
                    if (!supplierGroups[supplierId].pos[poId]) {
                      supplierGroups[supplierId].pos[poId] = { poNumber, payments: [], deliveries: [] }
                    }
                    supplierGroups[supplierId].pos[poId].payments.push(payment)
                  })
                  
                  // Group deliveries by supplier and PO
                  deliveries.forEach((delivery: any) => {
                    const supplierId = delivery.purchase_order?.supplier?.id || 'unknown'
                    const supplierName = delivery.purchase_order?.supplier?.name || 'Unknown Supplier'
                    const poId = delivery.po_id
                    const poNumber = delivery.purchase_order?.po_number || 'N/A'
                    
                    if (!supplierGroups[supplierId]) {
                      supplierGroups[supplierId] = { name: supplierName, pos: {} }
                    }
                    if (!supplierGroups[supplierId].pos[poId]) {
                      supplierGroups[supplierId].pos[poId] = { poNumber, payments: [], deliveries: [] }
                    }
                    supplierGroups[supplierId].pos[poId].deliveries.push(delivery)
                  })
                  
                  return Object.entries(supplierGroups).map(([supplierId, supplier]) => (
                    <div key={supplierId} className="border border-gray-200 rounded-lg bg-white">
                      {/* Supplier Header */}
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                        <h3 className="font-semibold text-lg text-gray-900">{supplier.name}</h3>
                        <p className="text-xs text-gray-500">{Object.keys(supplier.pos).length} PO{Object.keys(supplier.pos).length !== 1 ? 's' : ''}</p>
                      </div>
                      
                      {/* POs under this supplier */}
                      <div className="p-4 space-y-3">
                        {Object.entries(supplier.pos).map(([poId, poData]) => (
                          <div key={poId} className="border border-gray-200 rounded-md p-3">
                            {/* PO Number and View Button */}
                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                              <h4 className="font-semibold text-gray-900">{poData.poNumber}</h4>
                              <button
                                onClick={() => viewPODetails(poId)}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                View PO
                              </button>
                            </div>
                            
                            {/* Payments and Deliveries Side by Side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              {/* Payments */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                  Payments ({poData.payments.length})
                                </h5>
                                {poData.payments.length > 0 ? (
                                  <div className="space-y-1.5">
                                      {poData.payments.map((payment: any) => (
                                        <div key={payment.id} className="bg-green-50 border border-green-200 rounded p-2">
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <p className="text-xs font-medium">{payment.payment_number}</p>
                                              <p className="text-xs text-gray-600">{new Date(payment.payment_date).toLocaleDateString()}</p>
                                              <p className="text-xs text-gray-600">{payment.payment_method}</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-sm font-bold text-green-600">₱{payment.amount.toLocaleString()}</p>
                                              {payment.proof_of_payment_url && (
                                                <a
                                                  href={payment.proof_of_payment_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                  Payment Receipt
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">No payments</p>
                                )}
                              </div>
                              
                              {/* Deliveries */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  Deliveries ({poData.deliveries.length})
                                </h5>
                                {poData.deliveries.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {poData.deliveries.map((delivery: any) => (
                                      <div key={delivery.id} className="bg-blue-50 border border-blue-200 rounded p-2">
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                            <p className="text-xs font-medium">{delivery.receipt_number}</p>
                                            <p className="text-xs text-gray-600">{new Date(delivery.delivery_date).toLocaleDateString()}</p>
                                            <p className="text-xs text-gray-600">By: {delivery.received_by}</p>
                                          </div>
                                          <div className="text-right">
                                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                              delivery.condition === 'good' ? 'bg-green-100 text-green-800' :
                                              delivery.condition === 'damaged' ? 'bg-red-100 text-red-800' :
                                              delivery.condition === 'incomplete' ? 'bg-orange-100 text-orange-800' :
                                              'bg-yellow-100 text-yellow-800'
                                            }`}>
                                              {delivery.condition === 'good' ? 'Complete' : delivery.condition}
                                            </span>
                                            {delivery.delivery_receipt_url && (
                                              <a
                                                href={delivery.delivery_receipt_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                              >
                                                Delivery Receipt
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">No deliveries</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
                
                {payments.length === 0 && deliveries.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No transactions recorded yet</p>
                    <p className="text-sm mt-1">Payments and deliveries will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* REQUISITIONS TAB */}
          {activeTab === 'requisitions' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Purchase Requisitions</h2>
                <button
                  onClick={() => setShowPRModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Create Requisition
                </button>
              </div>
              
              <div className="space-y-3">
                {requisitions.map((pr) => (
                  <div key={pr.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{pr.pr_number}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            pr.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                            pr.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                            pr.status === 'approved' ? 'bg-green-100 text-green-800' :
                            pr.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {pr.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                          <div>
                            <span className="text-gray-500">Requested by:</span>
                            <span className="ml-2 font-medium">{pr.requested_by}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Request Date:</span>
                            <span className="ml-2">{new Date(pr.request_date).toLocaleDateString()}</span>
                          </div>
                          {pr.department && (
                            <div>
                              <span className="text-gray-500">Department:</span>
                              <span className="ml-2">{pr.department}</span>
                            </div>
                          )}
                          {pr.required_date && (
                            <div>
                              <span className="text-gray-500">Required by:</span>
                              <span className="ml-2">{new Date(pr.required_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {pr.purpose && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Purpose:</span>
                              <span className="ml-2">{pr.purpose}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {pr.status === 'draft' && (
                          <button
                            onClick={async () => {
                              await supabase
                                .from('purchase_requisitions')
                                .update({ status: 'submitted' })
                                .eq('id', pr.id)
                              loadRequisitions()
                            }}
                            className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                            Submit
                          </button>
                        )}
                        {pr.status === 'submitted' && (
                          <button
                            onClick={async () => {
                              await supabase
                                .from('purchase_requisitions')
                                .update({ status: 'approved' })
                                .eq('id', pr.id)
                              loadRequisitions()
                            }}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Approve
                          </button>
                        )}
                        {pr.status === 'approved' && (
                          <button
                            onClick={async () => {
                              // Load PR items
                              const { data: items } = await supabase
                                .from('purchase_requisition_items')
                                .select('*')
                                .eq('pr_id', pr.id)
                              
                              if (items && items.length > 0) {
                                // Convert PR items to PO items format
                                const poItems = items.map(item => ({
                                  product_description: item.product_description,
                                  quantity: item.quantity,
                                  unit: item.unit,
                                  unit_price: item.estimated_price || 0
                                }))
                                
                                setConvertingPR(pr)
                                setPOItems(poItems)
                                setShowConvertPRModal(true)
                              } else {
                                alert('No items found in this requisition')
                              }
                            }}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Create PO
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {requisitions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No requisitions found</p>
                    <p className="text-sm mt-1">Create your first purchase requisition to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* RAW MATERIALS TAB */}
          {activeTab === 'raw_materials' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">Raw Materials Inventory</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Track purchased materials and stock levels</p>
                </div>
                <button
                  onClick={() => {
                    setEditingMaterial(null)
                    setShowMaterialModal(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Material
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rawMaterials.map((material) => {
                  const stockStatus = 
                    material.current_stock <= 0 ? 'out' :
                    material.current_stock <= material.minimum_stock ? 'low' : 'normal'
                  
                  return (
                    <div key={material.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{material.material_name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {material.category && (
                              <span className="text-xs text-gray-500">{material.category}</span>
                            )}
                            {material.supplier && (
                              <span className="text-xs text-purple-600">• {material.supplier.name}</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          stockStatus === 'out' ? 'bg-red-100 text-red-800' :
                          stockStatus === 'low' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {stockStatus === 'out' ? 'Out of Stock' :
                           stockStatus === 'low' ? 'Low Stock' : 'In Stock'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Current Stock:</span>
                          <span className="font-semibold">{material.current_stock} {material.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Minimum Level:</span>
                          <span>{material.minimum_stock} {material.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Unit Cost:</span>
                          <span>₱{material.unit_cost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-600">Stock Value:</span>
                          <span className="font-semibold text-blue-600">
                            ₱{(material.current_stock * material.unit_cost).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedMaterialForMovement(material)
                            setShowStockMovementModal(true)
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Stock In/Out
                        </button>
                        <button
                          onClick={async () => {
                            setSelectedMaterialForHistory(material)
                            await loadMovementHistory(material.id)
                            setShowMovementHistory(true)
                          }}
                          className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                        >
                          History
                        </button>
                        <button
                          onClick={() => {
                            setEditingMaterial(material)
                            setShowMaterialModal(true)
                          }}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete "${material.material_name}"?\n\nThis will also delete all stock movement history.`)) return
                            
                            const { error } = await supabase
                              .from('raw_materials')
                              .delete()
                              .eq('id', material.id)
                            
                            if (error) {
                              alert(`Error deleting material: ${error.message}`)
                            } else {
                              loadRawMaterials()
                            }
                          }}
                          className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {rawMaterials.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-gray-500">No materials added yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add your first raw material to start tracking</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {showPOModal && (
        <POModal
          po={editingPO}
          items={poItems}
          setItems={setPOItems}
          suppliers={suppliers}
          brandId={selectedBrand?.id || ''}
          onSave={savePurchaseOrder}
          onClose={() => {
            setShowPOModal(false)
            setEditingPO(null)
            setPOItems([])
          }}
        />
      )}
      
      {showSupplierModal && (
        <SupplierModal
          supplier={editingSupplier}
          brandId={selectedBrand?.id || ''}
          onSave={saveSupplier}
          onClose={() => {
            setShowSupplierModal(false)
            setEditingSupplier(null)
          }}
        />
      )}
      
      {showPaymentModal && selectedPOForPayment && (
        <PaymentModal
          po={selectedPOForPayment}
          onSave={savePayment}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedPOForPayment(null)
          }}
        />
      )}
      
      {showDeliveryModal && selectedPOForDelivery && (
        <DeliveryModal
          po={selectedPOForDelivery}
          onSave={saveDelivery}
          onClose={() => {
            setShowDeliveryModal(false)
            setSelectedPOForDelivery(null)
          }}
        />
      )}
      
      {showPRModal && (
        <PRModal
          brandId={selectedBrand?.id || ''}
          onSave={async (prData) => {
            // Generate PR number
            const date = new Date()
            const year = date.getFullYear().toString().slice(-2)
            const random = Math.floor(Math.random() * 9000) + 1000
            const pr_number = `PR-${year}${random}`
            
            // Separate items from pr data
            const { items, ...prFields } = prData
            
            const pr = {
              pr_number,
              brand_id: selectedBrand?.id,
              requested_by: prFields.requested_by,
              department: prFields.department || null,
              request_date: new Date().toISOString().split('T')[0],
              required_date: prFields.required_date || null,
              purpose: prFields.purpose || null,
              notes: prFields.notes || null,
              status: 'draft'
            }
            
            console.log('Creating PR:', pr)
            
            const { data: newPR, error } = await supabase
              .from('purchase_requisitions')
              .insert([pr])
              .select()
              .single()
            
            if (error) {
              console.error('Error creating PR:', error)
              alert(`Error creating PR: ${error.message}`)
              return
            }
            
            // Insert PR items
            if (newPR && items && items.length > 0) {
              const itemsToInsert = items.map((item: any) => ({
                pr_id: newPR.id,
                product_description: item.product_description,
                quantity: item.quantity,
                unit: item.unit,
                estimated_price: typeof item.estimated_price === 'string' ? parseFloat(item.estimated_price) || null : item.estimated_price || null,
                notes: item.notes || null
              }))
              
              console.log('Inserting PR items:', itemsToInsert)
              
              const { error: itemsError } = await supabase
                .from('purchase_requisition_items')
                .insert(itemsToInsert)
              
              if (itemsError) {
                console.error('Error inserting PR items:', itemsError)
                alert(`Error adding items: ${itemsError.message}`)
              }
            }
            
            setShowPRModal(false)
            loadRequisitions()
            alert(`Requisition ${pr_number} created successfully!`)
          }}
          onClose={() => setShowPRModal(false)}
        />
      )}
      
      {showConvertPRModal && convertingPR && (
        <ConvertPRtoPOModal
          pr={convertingPR}
          items={poItems}
          setItems={setPOItems}
          suppliers={suppliers}
          brandId={selectedBrand?.id || ''}
          onSave={async (poData) => {
            if (!selectedBrand) return
            
            const po = {
              ...poData,
              brand_id: selectedBrand.id,
              pr_id: convertingPR.id,
              po_number: generatePONumber(),
              status: 'draft',
              subtotal: 0,
              tax_amount: 0,
              total_amount: 0,
              paid_amount: 0,
              balance_amount: 0
            }
            
            console.log('Creating PO from PR:', po)
            
            const { data: newPO, error } = await supabase
              .from('purchase_orders')
              .insert([po])
              .select()
              .single()
            
            if (error) {
              console.error('Error creating PO:', error)
              alert(`Error creating PO: ${error.message}`)
              return
            }
            
            if (newPO && poItems.length > 0) {
              const itemsToInsert = poItems.map(item => ({
                product_description: item.product_description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) || 0 : item.unit_price,
                notes: item.notes || null,
                material_id: item.material_id || null,
                po_id: newPO.id
              }))
              
              console.log('Inserting PO items:', itemsToInsert)
              
              const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(itemsToInsert)
              
              if (itemsError) {
                console.error('Error inserting items:', itemsError)
                alert(`Error adding items: ${itemsError.message}`)
                return
              }
            }
            
            // Update PR status to converted
            await supabase
              .from('purchase_requisitions')
              .update({ status: 'converted' })
              .eq('id', convertingPR.id)
            
            setShowConvertPRModal(false)
            setConvertingPR(null)
            setPOItems([])
            loadPurchaseOrders()
            loadRequisitions()
            alert(`PO ${newPO.po_number} created successfully from ${convertingPR.pr_number}!`)
          }}
          onClose={() => {
            setShowConvertPRModal(false)
            setConvertingPR(null)
            setPOItems([])
          }}
        />
      )}
      
      {showMaterialModal && (
        <MaterialModal
          material={editingMaterial}
          brandId={selectedBrand?.id || ''}
          suppliers={suppliers}
          onSave={async (materialData) => {
            // Parse string values to numbers
            const dataToSave = {
              ...materialData,
              unit_cost: typeof materialData.unit_cost === 'string' ? parseFloat(materialData.unit_cost) || 0 : materialData.unit_cost,
              minimum_stock: typeof materialData.minimum_stock === 'string' ? parseFloat(materialData.minimum_stock) || 0 : materialData.minimum_stock,
              current_stock: typeof materialData.current_stock === 'string' ? parseFloat(materialData.current_stock) || 0 : materialData.current_stock
            }
            
            if (editingMaterial) {
              const { error } = await supabase
                .from('raw_materials')
                .update(dataToSave)
                .eq('id', editingMaterial.id)
              
              if (error) {
                alert(`Error updating material: ${error.message}`)
                return
              }
            } else {
              const { error } = await supabase
                .from('raw_materials')
                .insert([{ ...dataToSave, brand_id: selectedBrand?.id }])
              
              if (error) {
                alert(`Error adding material: ${error.message}`)
                return
              }
            }
            
            setShowMaterialModal(false)
            setEditingMaterial(null)
            loadRawMaterials()
          }}
          onClose={() => {
            setShowMaterialModal(false)
            setEditingMaterial(null)
          }}
        />
      )}
      
      {showStockMovementModal && selectedMaterialForMovement && (
        <StockMovementModal
          material={selectedMaterialForMovement}
          onSave={async (movementData) => {
            const { error } = await supabase
              .from('material_stock_movements')
              .insert([{ ...movementData, material_id: selectedMaterialForMovement.id }])
            
            if (error) {
              alert(`Error recording movement: ${error.message}`)
              return
            }
            
            setShowStockMovementModal(false)
            setSelectedMaterialForMovement(null)
            loadRawMaterials()
          }}
          onClose={() => {
            setShowStockMovementModal(false)
            setSelectedMaterialForMovement(null)
          }}
        />
      )}
      
      {showMovementHistory && selectedMaterialForHistory && (
        <MovementHistoryModal
          material={selectedMaterialForHistory}
          movements={movementHistory}
          onClose={() => {
            setShowMovementHistory(false)
            setSelectedMaterialForHistory(null)
            setMovementHistory([])
          }}
        />
      )}
      
      {showPODetailsModal && selectedPOForDetails && (
        <PODetailsModal
          po={selectedPOForDetails}
          onClose={() => {
            setShowPODetailsModal(false)
            setSelectedPOForDetails(null)
          }}
        />
      )}
    </div>
  )
}

// =============================================
// SUPPLIER MODAL
// =============================================

function SupplierModal({ supplier, brandId, onSave, onClose }: {
  supplier: Supplier | null
  brandId: string
  onSave: (supplier: Partial<Supplier>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    payment_terms: supplier?.payment_terms || '',
    bank_name: supplier?.bank_name || '',
    bank_account_number: supplier?.bank_account_number || '',
    bank_account_name: supplier?.bank_account_name || '',
    notes: supplier?.notes || '',
    is_active: supplier?.is_active ?? true
  })
  
  const [supplierProducts, setSupplierProducts] = useState<RawMaterial[]>([])
  const [showProducts, setShowProducts] = useState(false)
  
  useEffect(() => {
    if (supplier?.id) {
      loadSupplierProducts()
    }
  }, [supplier?.id])
  
  const loadSupplierProducts = async () => {
    if (!supplier?.id) return
    const { data } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('brand_id', brandId)
      .eq('supplier_id', supplier.id)
      .eq('is_active', true)
      .order('material_name')
    
    if (data) setSupplierProducts(data)
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">
            {supplier ? 'Edit Supplier' : 'Add Supplier'}
          </h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Supplier Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Bank Name</label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Account Number</label>
              <input
                type="text"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Account Name</label>
              <input
                type="text"
                value={formData.bank_account_name}
                onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            <div className="col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
            
            {/* Supplier Products List */}
            {supplier && supplierProducts.length > 0 && (
              <div className="col-span-2">
                <button
                  onClick={() => setShowProducts(!showProducts)}
                  type="button"
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm flex items-center justify-between"
                >
                  <span>Products from this Supplier ({supplierProducts.length})</span>
                  <span>{showProducts ? '▼' : '▶'}</span>
                </button>
                
                {showProducts && (
                  <div className="mt-3 border border-gray-200 rounded-md p-3 bg-gray-50 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {supplierProducts.map((product) => (
                        <div key={product.id} className="bg-white border border-gray-200 rounded p-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{product.material_name}</p>
                              {product.category && (
                                <p className="text-xs text-gray-500">{product.category}</p>
                              )}
                            </div>
                            <div className="text-right ml-3">
                              <p className="font-semibold text-sm">₱{product.unit_cost.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">per {product.unit}</p>
                            </div>
                          </div>
                          {product.current_stock > 0 && (
                            <p className="text-xs text-gray-500 mt-1">Current stock: {product.current_stock} {product.unit}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Supplier
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// PO MODAL
// =============================================

function POModal({ po, items, setItems, suppliers, onSave, onClose, brandId }: {
  po: PurchaseOrder | null
  items: Partial<PurchaseOrderItem>[]
  setItems: (items: Partial<PurchaseOrderItem>[]) => void
  suppliers: Supplier[]
  onSave: (poData: Partial<POFormData>) => void
  onClose: () => void
  brandId: string
}) {
  const [formData, setFormData] = useState<Partial<POFormData>>({
    supplier_id: po?.supplier_id || '',
    order_date: po?.order_date || new Date().toISOString().split('T')[0],
    expected_delivery_date: po?.expected_delivery_date || '',
    purchasing_agent: po?.purchasing_agent || '',
    payment_terms: po?.payment_terms || '',
    payment_method: po?.payment_method || 'bank_transfer',
    payment_timing: po?.payment_timing || 'after_delivery',
    delivery_address: po?.delivery_address || '',
    delivery_contact: po?.delivery_contact || '',
    delivery_phone: po?.delivery_phone || '',
    notes: po?.notes || ''
  })
  
  const [catalog, setCatalog] = useState<RawMaterial[]>([])
  const [showCatalog, setShowCatalog] = useState(false)
  
  // Load supplier catalog when supplier changes
  useEffect(() => {
    if (formData.supplier_id) {
      loadSupplierCatalog(formData.supplier_id)
    } else {
      setCatalog([])
    }
  }, [formData.supplier_id])
  
  const loadSupplierCatalog = async (supplierId: string) => {
    const { data } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('brand_id', brandId)
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .order('material_name')
    
    if (data) setCatalog(data)
  }
  
  const addFromCatalog = (material: RawMaterial) => {
    // Check if item already exists
    const exists = items.some(item => 
      item.product_description === material.material_name && item.material_id === material.id
    )
    
    if (exists) {
      alert(`"${material.material_name}" is already in the order`)
      return
    }
    
    const newItem: Partial<PurchaseOrderItem> = {
      product_description: material.material_name,
      quantity: 1,
      unit: material.unit,
      unit_price: material.unit_cost,
      material_id: material.id,
      material: material
    }
    setItems([...items, newItem])
  }
  
  // Validate if all items have required data
  const areItemsValid = items.length > 0 && items.every(item => 
    item.product_description && 
    item.product_description.trim() !== '' &&
    item.quantity && 
    item.quantity > 0 &&
    item.unit && 
    item.unit.trim() !== '' &&
    item.unit_price !== undefined && 
    item.unit_price >= 0
  )
  
  // Check if form is valid
  const isFormValid = 
    formData.supplier_id && 
    formData.supplier_id.trim() !== '' &&
    formData.purchasing_agent && 
    formData.purchasing_agent.trim() !== '' &&
    areItemsValid
  
  const addItem = () => {
    setItems([...items, { product_description: '', quantity: 1, unit: 'pcs', unit_price: '' as any }])
  }
  
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">
            {po ? `Edit PO - ${po.po_number}` : 'Create Purchase Order'}
          </h2>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="font-medium mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Supplier *
                  {!formData.supplier_id && <span className="text-red-500 text-xs ml-1">(required)</span>}
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    !formData.supplier_id 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'focus:ring-blue-500'
                  }`}
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.filter(s => s.is_active).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Purchasing Agent *
                  {!formData.purchasing_agent && <span className="text-red-500 text-xs ml-1">(required)</span>}
                </label>
                <input
                  type="text"
                  value={formData.purchasing_agent}
                  onChange={(e) => setFormData({ ...formData, purchasing_agent: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    !formData.purchasing_agent 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'focus:ring-blue-500'
                  }`}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Order Date *</label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Expected Delivery</label>
                <input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          {/* Payment Information */}
          <div>
            <h3 className="font-medium mb-3">Payment Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms</label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => {
                    const terms = e.target.value
                    setFormData({ 
                      ...formData, 
                      payment_terms: terms,
                      payment_timing: terms.includes('upon order') || terms.includes('before') ? 'before_delivery' : 
                                      terms.includes('COD') || terms.includes('delivery') ? 'after_delivery' : 
                                      'after_delivery'
                    })
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Terms</option>
                  <option value="Cash on delivery (COD)">Cash on delivery (COD)</option>
                  <option value="Payment upon order">Payment upon order</option>
                  <option value="Payment before delivery">Payment before delivery</option>
                  <option value="15 days after delivery">15 days after delivery</option>
                  <option value="30 days after delivery">30 days after delivery</option>
                  <option value="45 days after delivery">45 days after delivery</option>
                  <option value="60 days after delivery">60 days after delivery</option>
                  <option value="90 days after delivery">90 days after delivery</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Delivery Information */}
          <div>
            <h3 className="font-medium mb-3">Delivery Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Delivery Address</label>
                <textarea
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.delivery_contact}
                  onChange={(e) => setFormData({ ...formData, delivery_contact: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={formData.delivery_phone}
                  onChange={(e) => setFormData({ ...formData, delivery_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Order Items</h3>
                {!areItemsValid && items.length === 0 && (
                  <p className="text-xs text-red-500 mt-0.5">Add at least one item</p>
                )}
                {!areItemsValid && items.length > 0 && (
                  <p className="text-xs text-red-500 mt-0.5">Complete all item details</p>
                )}
              </div>
              <div className="flex gap-2">
                {catalog.length > 0 && (
                  <button
                    onClick={() => setShowCatalog(!showCatalog)}
                    className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    {showCatalog ? 'Hide Catalog' : `Catalog (${catalog.length})`}
                  </button>
                )}
                <button
                  onClick={addItem}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Item
                </button>
              </div>
            </div>
            
            {/* Supplier Catalog */}
            {showCatalog && catalog.length > 0 && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3">
                <p className="text-xs text-gray-600 mb-2">Click to add from catalog:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {catalog.map((material) => {
                    const alreadyAdded = items.some(item => 
                      item.material_id === material.id
                    )
                    return (
                    <button
                      key={material.id}
                      onClick={() => addFromCatalog(material)}
                      disabled={alreadyAdded}
                      className={`w-full text-left border rounded px-3 py-2 ${
                        alreadyAdded 
                          ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed' 
                          : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{material.material_name}</span>
                          {material.category && (
                            <span className="text-xs text-gray-500 ml-2">• {material.category}</span>
                          )}
                          {alreadyAdded && (
                            <span className="text-xs text-green-600 ml-2">✓ Added</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          {material.current_stock > 0 && (
                            <span>{material.current_stock} {material.unit}</span>
                          )}
                          <span className="font-semibold">₱{material.unit_cost.toLocaleString()}/{material.unit}</span>
                        </div>
                      </div>
                    </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Items List */}
            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-500">No items added</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Item" above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-50 border border-gray-200 rounded-md p-3"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                        {item.material_id && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">🔗 Linked to Inventory</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-gray-400 hover:text-red-600 text-lg leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* Item Fields - Single Row */}
                    <div className="grid grid-cols-12 gap-2">
                      {/* Product Description */}
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-600 mb-1">
                          Product
                        </label>
                        <input
                          type="text"
                          value={item.product_description}
                          onChange={(e) => updateItem(index, 'product_description', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${
                            item.material_id ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          readOnly={!!item.material_id}
                          required
                        />
                      </div>
                      
                      {/* Quantity */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      
                      {/* Unit */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${
                            (item as any).fromCatalog ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          readOnly={(item as any).fromCatalog}
                          required
                        />
                      </div>
                      
                      {/* Unit Price */}
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₱</span>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                            className={`w-full pl-6 pr-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${
                              (item as any).fromCatalog ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                            }`}
                            placeholder="0.00"
                            readOnly={(item as any).fromCatalog}
                            min="0"
                            step="0.01"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Item Total */}
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-xs text-gray-500">Subtotal</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₱{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Grand Total */}
            {items.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Total</p>
                    <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₱{items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isFormValid 
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isFormValid}
            title={
              !isFormValid 
                ? 'Please fill in supplier, purchasing agent, and add at least one valid item' 
                : ''
            }
          >
            {po ? 'Update PO' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// PAYMENT MODAL
// =============================================

function PaymentModal({ po, onSave, onClose }: {
  po: PurchaseOrder
  onSave: (payment: Partial<POPayment>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState<Partial<POPayment>>({
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'full',
    payment_method: po.payment_method || 'bank_transfer',
    amount: po.balance_amount,
    check_number: '',
    bank_name: '',
    reference_number: '',
    proof_of_payment_url: '',
    notes: ''
  })
  
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Record Payment</h2>
          <p className="text-sm text-gray-600 mt-1">PO: {po.po_number} - {po.supplier?.name}</p>
          <p className="text-sm font-medium mt-2">Balance: ₱{po.balance_amount.toLocaleString()}</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date *</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Payment Type *</label>
              <select
                value={formData.payment_type}
                onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="advance">Advance</option>
                <option value="partial">Partial</option>
                <option value="full">Full</option>
                <option value="final">Final</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method *</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Amount *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max={po.balance_amount}
                step="0.01"
                required
              />
            </div>
          </div>
          
          {formData.payment_method === 'check' && (
            <div>
              <label className="block text-sm font-medium mb-1">Check Number</label>
              <input
                type="text"
                value={formData.check_number}
                onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          
          {formData.payment_method === 'bank_transfer' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference Number</label>
                <input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Receipt/Proof Attachment
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-gray-50 focus:outline-none file:mr-3 file:py-2.5 file:px-4 file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800"
            />
            <p className="mt-1 text-xs text-gray-500">Deposit slip, bank receipt, or payment proof • PDF or image • Max 10MB</p>
            {receiptFile && (
              <div className="mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{receiptFile.name}</p>
                <p className="text-xs text-gray-500">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (uploading) return
              
              try {
                setUploading(true)
                let paymentData = { ...formData }
                
                // Upload file if selected
                if (receiptFile) {
                  const fileExt = receiptFile.name.split('.').pop()
                  const fileName = `${po.po_number}-payment-${Date.now()}.${fileExt}`
                  
                  const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('payment_receipts')
                    .upload(fileName, receiptFile)
                  
                  if (uploadError) {
                    throw uploadError
                  }
                  
                  // Get public URL
                  const { data: urlData } = supabase.storage
                    .from('payment_receipts')
                    .getPublicUrl(fileName)
                  
                  paymentData.proof_of_payment_url = urlData.publicUrl
                }
                
                onSave(paymentData)
              } catch (error) {
                console.error('Error uploading payment receipt:', error)
                alert('Failed to upload payment receipt. Please try again.')
                setUploading(false)
              }
            }}
            className={`px-4 py-2 rounded-lg ${
              !uploading && formData.amount && formData.amount > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!formData.amount || formData.amount <= 0 || uploading}
          >
            {uploading ? 'Uploading...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// DELIVERY MODAL
// =============================================

function DeliveryModal({ po, onSave, onClose }: {
  po: PurchaseOrder
  onSave: (delivery: Partial<DeliveryReceipt>, items: Array<{po_item_id: string, quantity_received: number, notes?: string}>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState<Partial<DeliveryReceipt>>({
    delivery_date: new Date().toISOString().split('T')[0],
    received_by: '',
    condition: 'good',
    notes: '',
    inspection_notes: '',
    delivery_receipt_url: ''
  })
  
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // Initialize delivery items with PO items
  const [deliveryItems, setDeliveryItems] = useState<Array<{
    po_item_id: string
    product_description: string
    ordered_quantity: number
    quantity_received: number
    unit: string
    notes: string
    material_id?: string
  }>>(
    (po.items || []).map(item => ({
      po_item_id: item.id,
      product_description: item.product_description,
      ordered_quantity: item.quantity,
      quantity_received: item.quantity, // Default to full quantity
      unit: item.unit,
      notes: '',
      material_id: item.material_id
    }))
  )
  
  const updateDeliveryItem = (index: number, field: string, value: any) => {
    const newItems = [...deliveryItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setDeliveryItems(newItems)
  }
  
  const hasValidItems = deliveryItems.some(item => item.quantity_received > 0)
  const isFormValid = formData.received_by && formData.received_by.trim() !== '' && 
                      hasValidItems && 
                      receiptFile !== null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Record Delivery</h2>
          <p className="text-sm text-gray-600 mt-1">PO: {po.po_number} - {po.supplier?.name}</p>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium mb-1">Delivery Date *</label>
            <input
              type="date"
              value={formData.delivery_date}
              onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Received By *
                {!formData.received_by && <span className="text-red-500 text-xs ml-1">(required)</span>}
              </label>
              <input
                type="text"
                value={formData.received_by}
                onChange={(e) => setFormData({ ...formData, received_by: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  !formData.received_by 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'focus:ring-blue-500'
                }`}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Condition *</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="good">Complete</option>
                <option value="damaged">Damaged</option>
                <option value="partial">Partial</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add any inspection notes or general comments..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Receipt Attachment *
              {!receiptFile && <span className="text-red-500 text-xs ml-1">(required)</span>}
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-gray-50 focus:outline-none file:mr-3 file:py-2.5 file:px-4 file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800"
              required
            />
            <p className="mt-1 text-xs text-gray-500">PDF or image • Max 10MB</p>
            {receiptFile && (
              <div className="mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{receiptFile.name}</p>
                <p className="text-xs text-gray-500">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>
          
          {/* Items Section */}
          <div>
            <label className="block text-sm font-medium mb-2">Items Delivered</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-700">Item</th>
                    <th className="text-center p-2 font-medium text-gray-700 w-24">Ordered</th>
                    <th className="text-center p-2 font-medium text-gray-700 w-32">Received</th>
                    <th className="text-left p-2 font-medium text-gray-700 w-32">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryItems.map((item, index) => (
                    <tr key={item.po_item_id} className="border-b border-gray-200 last:border-0">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <span>{item.product_description}</span>
                          {item.material_id && (
                            <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">🔗</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center text-gray-600">
                        {item.ordered_quantity} {item.unit}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          max={item.ordered_quantity}
                          step="0.01"
                          value={item.quantity_received}
                          onChange={(e) => updateDeliveryItem(index, 'quantity_received', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateDeliveryItem(index, 'notes', e.target.value)}
                          placeholder="Optional"
                          className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              💡 Items with 🔗 will automatically update raw materials inventory
            </p>
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!receiptFile || uploading) return
              
              try {
                setUploading(true)
                
                // Upload file to Supabase storage
                const fileExt = receiptFile.name.split('.').pop()
                const fileName = `${po.po_number}-${Date.now()}.${fileExt}`
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('delivery_receipts')
                  .upload(fileName, receiptFile)
                
                if (uploadError) {
                  throw uploadError
                }
                
                // Get public URL
                const { data: urlData } = supabase.storage
                  .from('delivery_receipts')
                  .getPublicUrl(fileName)
                
                // Add URL to form data
                const deliveryData = {
                  ...formData,
                  delivery_receipt_url: urlData.publicUrl
                }
                
                const itemsToSave = deliveryItems
                  .filter(item => item.quantity_received > 0)
                  .map(item => ({
                    po_item_id: item.po_item_id,
                    quantity_received: item.quantity_received,
                    notes: item.notes || undefined
                  }))
                
                onSave(deliveryData, itemsToSave)
              } catch (error) {
                console.error('Error uploading receipt:', error)
                alert('Failed to upload delivery receipt. Please try again.')
                setUploading(false)
              }
            }}
            className={`px-4 py-2 rounded-lg ${
              isFormValid && !uploading
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isFormValid || uploading}
            title={
              !formData.received_by ? 'Please enter who received the delivery' : 
              !hasValidItems ? 'Please enter quantities received' :
              !receiptFile ? 'Please attach delivery receipt' :
              uploading ? 'Uploading...' :
              ''
            }
          >
            {uploading ? 'Uploading Receipt...' : 'Record Delivery'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// PURCHASE REQUISITION MODAL
// =============================================

function PRModal({ brandId, onSave, onClose }: {
  brandId: string
  onSave: (prData: any) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    requested_by: '',
    department: '',
    required_date: '',
    purpose: '',
    notes: ''
  })
  
  const [items, setItems] = useState<Array<{
    product_description: string
    quantity: number
    unit: string
    estimated_price: number | string
    notes: string
  }>>([])
  
  const addItem = () => {
    setItems([...items, { product_description: '', quantity: 1, unit: 'pcs', estimated_price: '', notes: '' }])
  }
  
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }
  
  const isValid = formData.requested_by.trim() !== '' && items.length > 0 && 
    items.every(item => item.product_description.trim() !== '' && item.quantity > 0)
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">Create Purchase Requisition</h2>
          <p className="text-sm text-gray-600 mt-1">Submit a request for purchase</p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="font-medium mb-3">Requisition Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Requested By *
                  {!formData.requested_by && <span className="text-red-500 text-xs ml-1">(required)</span>}
                </label>
                <input
                  type="text"
                  value={formData.requested_by}
                  onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    !formData.requested_by 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'focus:ring-blue-500'
                  }`}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Required Date</label>
                <input
                  type="date"
                  value={formData.required_date}
                  onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Purpose</label>
                <textarea
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>
          </div>
          
          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Requested Items</h3>
                {items.length === 0 && (
                  <p className="text-xs text-red-500 mt-0.5">Add at least one item</p>
                )}
              </div>
              <button
                onClick={addItem}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Add Item
              </button>
            </div>
            
            {/* Items List */}
            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-500">No items added</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Item" above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-50 border border-gray-200 rounded-md p-3"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          className="text-gray-400 hover:text-red-600 text-lg leading-none"
                          title="Remove"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    
                    {/* Item Fields - Single Row */}
                    <div className="grid grid-cols-12 gap-2">
                      {/* Product Description */}
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-600 mb-1">
                          Product
                        </label>
                        <input
                          type="text"
                          value={item.product_description}
                          onChange={(e) => updateItem(index, 'product_description', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                      
                      {/* Quantity */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      
                      {/* Unit */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                      
                      {/* Estimated Price */}
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Est. Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₱</span>
                          <input
                            type="number"
                            value={item.estimated_price}
                            onChange={(e) => updateItem(index, 'estimated_price', e.target.value)}
                            className="w-full pl-6 pr-2 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Summary */}
            {items.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Estimated Total</p>
                    <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₱{items.reduce((sum, item) => {
                      const price = typeof item.estimated_price === 'string' ? parseFloat(item.estimated_price) || 0 : item.estimated_price || 0
                      return sum + ((item.quantity || 0) * price)
                    }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...formData, items: items })}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isValid 
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isValid}
            title={!isValid ? 'Please fill in requestor name and add at least one valid item' : ''}
          >
            Create Requisition
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// CONVERT PR TO PO MODAL
// =============================================

function ConvertPRtoPOModal({ pr, items, setItems, suppliers, brandId, onSave, onClose }: {
  pr: PurchaseRequisition
  items: Partial<PurchaseOrderItem>[]
  setItems: (items: Partial<PurchaseOrderItem>[]) => void
  suppliers: Supplier[]
  brandId: string
  onSave: (poData: Partial<POFormData>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState<Partial<POFormData>>({
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: pr.required_date || '',
    purchasing_agent: pr.requested_by,
    payment_terms: '',
    payment_method: 'bank_transfer',
    payment_timing: 'after_delivery',
    delivery_address: '',
    delivery_contact: '',
    delivery_phone: '',
    notes: pr.purpose || ''
  })
  
  const [catalog, setCatalog] = useState<RawMaterial[]>([])
  const [showCatalog, setShowCatalog] = useState(false)
  
  useEffect(() => {
    if (formData.supplier_id) {
      loadSupplierCatalog(formData.supplier_id)
    } else {
      setCatalog([])
    }
  }, [formData.supplier_id])
  
  const loadSupplierCatalog = async (supplierId: string) => {
    const { data } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('brand_id', brandId)
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .order('material_name')
    
    if (data) setCatalog(data)
  }
  
  const addFromCatalog = (material: RawMaterial) => {
    // Check if item already exists
    const exists = items.some(item => 
      item.material_id === material.id
    )
    
    if (exists) {
      alert(`"${material.material_name}" is already in the order`)
      return
    }
    
    const newItem: Partial<PurchaseOrderItem> = {
      product_description: material.material_name,
      quantity: 1,
      unit: material.unit,
      unit_price: material.unit_cost,
      material_id: material.id,
      material: material
    }
    setItems([...items, newItem])
  }
  
  const addItem = () => {
    setItems([...items, { product_description: '', quantity: 1, unit: 'pcs', unit_price: '' as any }])
  }
  
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }
  
  const areItemsValid = items.length > 0 && items.every(item => 
    item.product_description && 
    item.product_description.trim() !== '' &&
    item.quantity && 
    item.quantity > 0 &&
    item.unit && 
    item.unit.trim() !== '' &&
    item.unit_price !== undefined && 
    item.unit_price >= 0
  )
  
  const isFormValid = 
    formData.supplier_id && 
    formData.supplier_id.trim() !== '' &&
    formData.purchasing_agent && 
    formData.purchasing_agent.trim() !== '' &&
    areItemsValid
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">Create PO from Requisition</h2>
          <p className="text-sm text-gray-600 mt-1">Converting {pr.pr_number} to Purchase Order</p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* PR Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-medium text-gray-900 mb-2">Requisition Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">PR Number:</span>
                <span className="ml-2 font-medium">{pr.pr_number}</span>
              </div>
              <div>
                <span className="text-gray-600">Requested by:</span>
                <span className="ml-2 font-medium">{pr.requested_by}</span>
              </div>
              {pr.department && (
                <div>
                  <span className="text-gray-600">Department:</span>
                  <span className="ml-2 font-medium">{pr.department}</span>
                </div>
              )}
              {pr.required_date && (
                <div>
                  <span className="text-gray-600">Required by:</span>
                  <span className="ml-2 font-medium">{new Date(pr.required_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Supplier Selection */}
          <div>
            <h3 className="font-medium mb-3">Purchase Order Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Supplier *
                  {!formData.supplier_id && <span className="text-red-500 text-xs ml-1">(required)</span>}
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    !formData.supplier_id 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'focus:ring-blue-500'
                  }`}
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.filter(s => s.is_active).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Order Date</label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Expected Delivery</label>
                <input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms</label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => {
                    const terms = e.target.value
                    setFormData({ 
                      ...formData, 
                      payment_terms: terms,
                      payment_timing: terms.includes('upon order') || terms.includes('before') ? 'before_delivery' : 
                                      terms.includes('COD') || terms.includes('delivery') ? 'after_delivery' : 
                                      'after_delivery'
                    })
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Terms</option>
                  <option value="Cash on delivery (COD)">Cash on delivery (COD)</option>
                  <option value="Payment upon order">Payment upon order</option>
                  <option value="Payment before delivery">Payment before delivery</option>
                  <option value="15 days after delivery">15 days after delivery</option>
                  <option value="30 days after delivery">30 days after delivery</option>
                  <option value="45 days after delivery">45 days after delivery</option>
                  <option value="60 days after delivery">60 days after delivery</option>
                  <option value="90 days after delivery">90 days after delivery</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Items from PR */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Order Items</h3>
                <p className="text-xs text-gray-500 mt-0.5">Review and adjust prices from requisition</p>
              </div>
              <div className="flex gap-2">
                {catalog.length > 0 && (
                  <button
                    onClick={() => setShowCatalog(!showCatalog)}
                    type="button"
                    className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    {showCatalog ? 'Hide Catalog' : `Catalog (${catalog.length})`}
                  </button>
                )}
                <button
                  onClick={addItem}
                  type="button"
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Add Item
                </button>
              </div>
            </div>
            
            {/* Supplier Catalog */}
            {showCatalog && catalog.length > 0 && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3">
                <p className="text-xs text-gray-600 mb-2">Click to add from catalog:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {catalog.map((material) => {
                    const alreadyAdded = items.some(item => 
                      item.material_id === material.id
                    )
                    return (
                    <button
                      key={material.id}
                      onClick={() => addFromCatalog(material)}
                      type="button"
                      disabled={alreadyAdded}
                      className={`w-full text-left border rounded px-3 py-2 ${
                        alreadyAdded 
                          ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed' 
                          : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{material.material_name}</span>
                          {material.category && (
                            <span className="text-xs text-gray-500 ml-2">• {material.category}</span>
                          )}
                          {alreadyAdded && (
                            <span className="text-xs text-green-600 ml-2">✓ Added</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          {material.current_stock > 0 && (
                            <span>{material.current_stock} {material.unit}</span>
                          )}
                          <span className="font-semibold">₱{material.unit_cost.toLocaleString()}/{material.unit}</span>
                        </div>
                      </div>
                    </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      {(item as any).fromCatalog && (
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Catalog</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-gray-400 hover:text-red-600 text-lg leading-none"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <label className="block text-xs text-gray-600 mb-1">Product</label>
                      <input
                        type="text"
                        value={item.product_description}
                        onChange={(e) => updateItem(index, 'product_description', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${
                          (item as any).fromCatalog ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                        }`}
                        readOnly={(item as any).fromCatalog}
                        required
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Qty</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Unit</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${
                          (item as any).fromCatalog ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                        }`}
                        readOnly={(item as any).fromCatalog}
                        required
                      />
                    </div>
                    
                    <div className="col-span-3">
                      <label className="block text-xs text-gray-600 mb-1">Price</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₱</span>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value))}
                          className={`w-full pl-6 pr-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${
                            (item as any).fromCatalog ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                          }`}
                          readOnly={(item as any).fromCatalog}
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs text-gray-500">Subtotal</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ₱{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {items.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Total</p>
                    <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₱{items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isFormValid 
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isFormValid}
            title={!isFormValid ? 'Please select supplier and ensure all items are valid' : ''}
          >
            Create Purchase Order
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// MATERIAL MODAL
// =============================================

function MaterialModal({ material, brandId, suppliers, onSave, onClose }: {
  material: RawMaterial | null
  brandId: string
  suppliers: Supplier[]
  onSave: (material: Partial<RawMaterial>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    supplier_id: material?.supplier_id || '',
    material_name: material?.material_name || '',
    sku: material?.sku || '',
    category: material?.category || '',
    unit: material?.unit || 'kg',
    unit_cost: material?.unit_cost || ('' as any),
    minimum_stock: material?.minimum_stock || ('' as any),
    current_stock: material?.current_stock || ('' as any),
    notes: material?.notes || '',
    is_active: material?.is_active ?? true
  })
  
  const isValid = formData.material_name.trim() !== '' && formData.unit.trim() !== ''
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            {material ? 'Edit Material' : 'Add Material'}
          </h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                Material Name *
              </label>
              <input
                type="text"
                value={formData.material_name}
                onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Preferred Supplier</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Supplier / General</option>
                {suppliers.filter(s => s.is_active).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Link this material to a supplier for quick PO creation</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Unit *</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="kg, liters, pieces"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Unit Cost (₱)</label>
              <input
                type="number"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Minimum Stock Level</label>
              <input
                type="number"
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                placeholder="0"
                step="0.01"
              />
            </div>
            
            {!material && (
              <div>
                <label className="block text-sm font-medium mb-1">Initial Stock</label>
                  <input
                  type="number"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  placeholder="0"
                  step="0.01"
                />
              </div>
            )}
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            <div className="col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className={`px-4 py-2 rounded-lg ${
              isValid 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isValid}
          >
            {material ? 'Update Material' : 'Add Material'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// STOCK MOVEMENT MODAL
// =============================================

function StockMovementModal({ material, onSave, onClose }: {
  material: RawMaterial
  onSave: (movement: Partial<MaterialStockMovement>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    movement_type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: '' as any,
    unit_cost: material.unit_cost,
    reference_type: '',
    reference_number: '',
    notes: '',
    movement_date: new Date().toISOString().split('T')[0],
    created_by: ''
  })
  
  // For adjustment, allow any non-zero quantity (positive or negative)
  // For in/out, require positive quantity
  const quantityNum = typeof formData.quantity === 'string' ? parseFloat(formData.quantity) || 0 : formData.quantity
  const isValid = formData.movement_type === 'adjustment' 
    ? quantityNum !== 0 
    : quantityNum > 0
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Stock Movement</h2>
          <p className="text-sm text-gray-600 mt-1">{material.material_name}</p>
          <p className="text-xs text-gray-500">Current Stock: {material.current_stock} {material.unit}</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Movement Type *</label>
            <select
              value={formData.movement_type}
              onChange={(e) => setFormData({ ...formData, movement_type: e.target.value as any, quantity: 0 })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="in">Stock In (Purchase/Receipt)</option>
              <option value="out">Stock Out (Usage/Consumption)</option>
              <option value="adjustment">Adjustment (+ to add, - to subtract)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Quantity * ({material.unit})
              {formData.movement_type === 'adjustment' && (
                <span className="text-xs text-gray-500 ml-2">(Use negative for decrease, positive for increase)</span>
              )}
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={formData.movement_type === 'adjustment' ? undefined : "0"}
              step="0.01"
              placeholder="Enter quantity"
              required
            />
          </div>
          
          {formData.movement_type === 'in' && (
            <div>
              <label className="block text-sm font-medium mb-1">Unit Cost (₱)</label>
              <input
                type="number"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">Movement Date</label>
            <input
              type="date"
              value={formData.movement_date}
              onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Reference Number</label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="PO number, batch number, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Reason for movement, additional details..."
            />
          </div>
          
          {quantityNum !== 0 && (
            <div className={`border rounded-md p-3 ${
              formData.movement_type === 'in' || (formData.movement_type === 'adjustment' && quantityNum > 0)
                ? 'bg-green-50 border-green-200'
                : 'bg-orange-50 border-orange-200'
            }`}>
              <p className="text-sm font-medium text-gray-700">
                New Stock After Movement:
              </p>
              <p className={`text-lg font-bold ${
                formData.movement_type === 'in' || (formData.movement_type === 'adjustment' && quantityNum > 0)
                  ? 'text-green-600'
                  : 'text-orange-600'
              }`}>
                {formData.movement_type === 'in' 
                  ? material.current_stock + quantityNum
                  : formData.movement_type === 'out'
                  ? material.current_stock - quantityNum
                  : material.current_stock + quantityNum
                } {material.unit}
              </p>
              {formData.movement_type === 'adjustment' && (
                <p className="text-xs text-gray-600 mt-1">
                  {quantityNum > 0 
                    ? `+${quantityNum} ${material.unit} (increase)`
                    : `${quantityNum} ${material.unit} (decrease)`
                  }
                </p>
              )}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...formData, quantity: quantityNum })}
            className={`px-4 py-2 rounded-lg ${
              isValid 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isValid}
          >
            Record Movement
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// MOVEMENT HISTORY MODAL
// =============================================

function MovementHistoryModal({ material, movements, onClose }: {
  material: RawMaterial
  movements: MaterialStockMovement[]
  onClose: () => void
}) {
  // Calculate statistics
  const totalStockIn = movements.filter(m => m.movement_type === 'in').reduce((sum, m) => sum + m.quantity, 0)
  const totalStockOut = movements.filter(m => m.movement_type === 'out').reduce((sum, m) => sum + m.quantity, 0)
  const totalAdjustments = movements.filter(m => m.movement_type === 'adjustment').reduce((sum, m) => sum + m.quantity, 0)
  const totalValue = movements.filter(m => m.movement_type === 'in' && m.unit_cost).reduce((sum, m) => sum + (m.quantity * (m.unit_cost || 0)), 0)
  const avgCost = totalStockIn > 0 ? totalValue / totalStockIn : 0
  
  // Calculate running balance
  const movementsWithBalance = movements.map((movement, index) => {
    const previousMovements = movements.slice(index + 1)
    let balance = material.current_stock
    
    previousMovements.forEach(m => {
      if (m.movement_type === 'in') {
        balance -= m.quantity
      } else if (m.movement_type === 'out') {
        balance += m.quantity
      } else {
        balance -= m.quantity
      }
    })
    
    if (movement.movement_type === 'in') {
      balance -= movement.quantity
    } else if (movement.movement_type === 'out') {
      balance += movement.quantity
    } else {
      balance -= movement.quantity
    }
    
    return {
      ...movement,
      balanceBefore: balance,
      balanceAfter: movement.movement_type === 'in' 
        ? balance + movement.quantity
        : movement.movement_type === 'out'
        ? balance - movement.quantity
        : balance + movement.quantity
    }
  })
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-md max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Movement History</h2>
              <p className="text-sm text-gray-600 mt-1">{material.material_name}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>SKU: {material.sku || 'N/A'}</span>
                <span>Category: {material.category || 'N/A'}</span>
                <span>Current: {material.current_stock} {material.unit}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="p-4 bg-white border-b">
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Stock In</p>
              <p className="text-lg font-bold text-green-600">+{totalStockIn.toFixed(1)}</p>
              <p className="text-xs text-gray-500">{material.unit}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Stock Out</p>
              <p className="text-lg font-bold text-red-600">-{totalStockOut.toFixed(1)}</p>
              <p className="text-xs text-gray-500">{material.unit}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Net Change</p>
              <p className="text-lg font-bold text-gray-900">
                {(totalStockIn - totalStockOut + totalAdjustments).toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">{material.unit}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Total Value</p>
              <p className="text-lg font-bold text-blue-600">₱{totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              <p className="text-xs text-gray-500">purchased</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Avg Cost</p>
              <p className="text-lg font-bold text-gray-900">₱{avgCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              <p className="text-xs text-gray-500">per {material.unit}</p>
            </div>
          </div>
        </div>
        
        {/* Movement List */}
        <div className="flex-1 overflow-y-auto p-6">
          {movements.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-gray-500">No movement history</p>
              <p className="text-xs text-gray-400 mt-1">Transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movementsWithBalance.map((movement, index) => (
                <div 
                  key={movement.id} 
                  className="bg-gray-50 border border-gray-200 rounded-md p-3 hover:bg-gray-100 transition-colors"
                >
                  {/* Row 1: Type, Date, Quantity */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        movement.movement_type === 'in' ? 'bg-green-600 text-white' :
                        movement.movement_type === 'out' ? 'bg-red-600 text-white' :
                        'bg-blue-600 text-white'
                      }`}>
                        {movement.movement_type === 'in' ? 'IN' :
                         movement.movement_type === 'out' ? 'OUT' :
                         'ADJ'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(movement.movement_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                      {movement.reference_number && (
                        <span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-300">
                          {movement.reference_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`text-base font-bold ${
                          movement.movement_type === 'in' ? 'text-green-600' :
                          movement.movement_type === 'out' ? 'text-red-600' :
                          'text-blue-600'
                        }`}>
                          {movement.movement_type === 'in' ? '+' : movement.movement_type === 'out' ? '-' : '±'}
                          {movement.quantity} {material.unit}
                        </span>
                        {movement.unit_cost && movement.movement_type === 'in' && (
                          <div className="text-xs text-gray-600">
                            ₱{movement.unit_cost.toLocaleString()} × {movement.quantity} = ₱{(movement.quantity * movement.unit_cost).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Row 2: Details */}
                  {(movement.notes || movement.reference_type || movement.created_by) && (
                    <div className="text-xs text-gray-600 mb-2 flex gap-4">
                      {movement.reference_type && (
                        <span>Type: {movement.reference_type}</span>
                      )}
                      {movement.created_by && (
                        <span>By: {movement.created_by}</span>
                      )}
                      {movement.notes && (
                        <span className="flex-1">"{movement.notes}"</span>
                      )}
                    </div>
                  )}
                  
                  {/* Row 3: Balance */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Balance:</span>
                      <span className="font-medium text-gray-700">{movement.balanceBefore.toFixed(2)}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-bold text-gray-900">{movement.balanceAfter.toFixed(2)}</span>
                      <span className="text-gray-500">{material.unit}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(movement.created_at || '').toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {movements.length} total movement{movements.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// PO DETAILS MODAL
// =============================================

function PODetailsModal({ po, onClose }: {
  po: PurchaseOrder
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-gray-50 sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold">{po.po_number}</h2>
              <p className="text-sm text-gray-600 mt-1">{po.supplier?.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and Key Info */}
          <div className="flex items-center justify-between">
            <div>
              <span className={`px-3 py-1 text-sm font-medium rounded ${
                po.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                po.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                po.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                po.status === 'order_confirmed' ? 'bg-indigo-100 text-indigo-800' :
                po.status === 'in_transit' ? 'bg-purple-100 text-purple-800' :
                po.status === 'delivered' ? 'bg-green-100 text-green-800' :
                po.status === 'paid' ? 'bg-teal-100 text-teal-800' :
                po.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {po.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">₱{po.total_amount.toLocaleString()}</p>
              {po.balance_amount > 0 && (
                <p className="text-sm text-red-600">Balance: ₱{po.balance_amount.toLocaleString()}</p>
              )}
            </div>
          </div>
          
          {/* PO Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Order Date</p>
              <p className="font-medium">{new Date(po.order_date).toLocaleDateString()}</p>
            </div>
            {po.expected_delivery_date && (
              <div>
                <p className="text-gray-500">Expected Delivery</p>
                <p className="font-medium">{new Date(po.expected_delivery_date).toLocaleDateString()}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Purchasing Agent</p>
              <p className="font-medium">{po.purchasing_agent}</p>
            </div>
            {po.approved_by && (
              <div>
                <p className="text-gray-500">Approved By</p>
                <p className="font-medium">{po.approved_by}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Payment Terms</p>
              <p className="font-medium">{po.payment_terms || 'Net 30 days'}</p>
            </div>
            <div>
              <p className="text-gray-500">Payment Method</p>
              <p className="font-medium">{po.payment_method?.replace('_', ' ') || 'N/A'}</p>
            </div>
          </div>
          
          {/* Supplier Details */}
          {po.supplier && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h3 className="font-medium mb-2">Supplier Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="font-medium">{po.supplier.name}</p>
                </div>
                {po.supplier.contact_person && (
                  <div>
                    <p className="text-gray-500">Contact Person</p>
                    <p className="font-medium">{po.supplier.contact_person}</p>
                  </div>
                )}
                {po.supplier.phone && (
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium">{po.supplier.phone}</p>
                  </div>
                )}
                {po.supplier.email && (
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium">{po.supplier.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Items */}
          <div>
            <h3 className="font-medium mb-3">Order Items</h3>
            <div className="space-y-2">
              {po.items?.map((item, index) => (
                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product_description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.quantity} {item.unit} × ₱{item.unit_price.toLocaleString()}
                      </p>
                    </div>
                    <p className="font-semibold">₱{(item.quantity * item.unit_price).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
              <div className="flex justify-between items-center">
                <p className="font-medium">Total</p>
                <p className="text-xl font-bold">₱{po.total_amount.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          {/* Delivery History */}
          {po.id && (
            <DeliveryHistorySection poId={po.id} />
          )}
          
          {/* Payment History */}
          {po.payments && po.payments.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Payment History</h3>
              <div className="space-y-2">
                {po.payments.map((payment) => (
                  <div key={payment.id} className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{payment.payment_number}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(payment.payment_date).toLocaleDateString()} - {payment.payment_method}
                        </p>
                        {payment.proof_of_payment_url && (
                          <a 
                            href={payment.proof_of_payment_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            📎 View Payment Receipt
                          </a>
                        )}
                      </div>
                      <p className="font-bold text-green-600">₱{payment.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="font-bold">₱{po.paid_amount.toLocaleString()}</span>
                  </div>
                  {po.balance_amount > 0 && (
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-600">Balance:</span>
                      <span className="font-bold text-red-600">₱{po.balance_amount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Notes */}
          {po.notes && (
            <div>
              <h3 className="font-medium mb-2">Notes</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
                {po.notes}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// DELIVERY HISTORY SECTION
// =============================================

function DeliveryHistorySection({ poId }: { poId: string }) {
  const [deliveries, setDeliveries] = useState<DeliveryReceipt[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadDeliveries()
  }, [poId])
  
  const loadDeliveries = async () => {
    const { data } = await supabase
      .from('delivery_receipts')
      .select('*')
      .eq('po_id', poId)
      .order('delivery_date', { ascending: false })
    
    if (data) setDeliveries(data)
    setLoading(false)
  }
  
  if (loading) return <div className="text-sm text-gray-500">Loading deliveries...</div>
  if (deliveries.length === 0) return null
  
  return (
    <div>
      <h3 className="font-medium mb-3">Delivery History</h3>
      <div className="space-y-2">
        {deliveries.map((delivery) => (
          <div key={delivery.id} className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm">{delivery.receipt_number}</p>
                <p className="text-xs text-gray-600">
                  {new Date(delivery.delivery_date).toLocaleDateString()} - Received by {delivery.received_by}
                </p>
                <p className="text-xs text-gray-600">
                  Condition: <span className={`font-medium ${
                    delivery.condition === 'good' ? 'text-green-600' :
                    delivery.condition === 'damaged' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>{delivery.condition === 'good' ? 'Complete' : delivery.condition}</span>
                </p>
                {delivery.delivery_receipt_url && (
                  <a 
                    href={delivery.delivery_receipt_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    📎 View Delivery Receipt
                  </a>
                )}
                {!delivery.delivery_receipt_url && (
                  <span className="text-xs text-red-500 mt-1 inline-block">
                    ⚠️ No receipt attached
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
