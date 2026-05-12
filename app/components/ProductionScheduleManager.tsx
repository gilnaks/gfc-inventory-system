'use client'
import { useState, useEffect } from 'react'
import { supabase, Product } from '../../lib/supabase'
import { X, Plus, Trash2, Calendar, Save, Printer } from 'lucide-react'
import { getPhilippinesDate } from '../../lib/timezone'

interface ProductionScheduleItem {
  schedule_id: string
  product_id: string
  product_name: string
  sku?: string
  brand_name: string
  quantity_required: number
  batch_number: string
  notes?: string
  allow_override: boolean
  printed_count: number
}

interface ProductionScheduleManagerProps {
  onClose: () => void
  theme?: string
}

export function ProductionScheduleManager({ onClose, theme = 'blue' }: ProductionScheduleManagerProps) {
  const [scheduleDate, setScheduleDate] = useState(getPhilippinesDate())
  const [items, setItems] = useState<ProductionScheduleItem[]>([])
  const [allProducts, setAllProducts] = useState<(Product & { brand_name: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [addQuantity, setAddQuantity] = useState('1')
  const [addNotes, setAddNotes] = useState('')
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [printingAllId, setPrintingAllId] = useState<string | null>(null)

  useEffect(() => {
    fetchAllProducts()
    fetchSchedule()
  }, [scheduleDate])

  const fetchAllProducts = async () => {
    if (!scheduleDate) return
    setLoading(true)
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('id, brand_id, name, sku, category, unit, brands(name)')
        .order('name')

      if (error) throw error

      const productsWithBrand = (productsData || []).map((p: any) => ({
        ...p,
        brand_name: p.brands?.name || 'Unknown'
      }))
      setAllProducts(productsWithBrand)
    } catch (err) {
      console.error('Error fetching products:', err)
      alert('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const fetchSchedule = async () => {
    if (!scheduleDate) return
    try {
      const { data: scheduleData, error } = await supabase
        .from('production_schedules')
        .select('id, product_id, quantity_required, batch_number, notes, allow_override')
        .eq('schedule_date', scheduleDate)

      if (error) throw error

      if (!scheduleData || scheduleData.length === 0) {
        setItems([])
        return
      }

      const productIds = scheduleData.map(s => s.product_id)
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, sku, brand_id, brands(name)')
        .in('id', productIds)

      const productMap = new Map((productsData || []).map((p: any) => [
        p.id,
        { name: p.name, sku: p.sku, brand_name: p.brands?.name || 'Unknown' }
      ]))

      const { data: printedData } = await supabase
        .from('production_sticker_logs')
        .select('product_id, schedule_id')
        .eq('manufacture_date', scheduleDate)

      const scheduleItems = scheduleData.map((row: any) => {
        const prod = productMap.get(row.product_id)
        const printed = printedData?.filter((p: any) =>
          p.product_id === row.product_id && (p.schedule_id === row.id || !p.schedule_id)
        ).length || 0
        const batchNum = row.batch_number || `BATCH-${scheduleDate.replace(/-/g, '')}-${(prod?.sku || '').replace(/-/g, '')}`
        return {
          schedule_id: row.id,
          product_id: row.product_id,
          product_name: prod?.name || 'Unknown',
          sku: prod?.sku,
          brand_name: prod?.brand_name || 'Unknown',
          quantity_required: row.quantity_required,
          batch_number: batchNum,
          notes: row.notes,
          allow_override: row.allow_override || false,
          printed_count: printed
        }
      })
      setItems(scheduleItems)
    } catch (err) {
      console.error('Error fetching schedule:', err)
      setItems([])
    }
  }

  const generateBatchNumber = (product: { sku?: string }) => {
    const skuPart = (product.sku || '').replace(/-/g, '')
    return `BATCH-${scheduleDate.replace(/-/g, '')}${skuPart ? '-' + skuPart : ''}`
  }

  const handleAddProduct = async () => {
    const qty = parseInt(addQuantity, 10) || 1
    if (!selectedProduct || qty < 1) return
    const product = allProducts.find(p => p.id === selectedProduct)
    if (!product) return

    const batchNum = generateBatchNumber(product)
    setItems(prev => {
      const existing = prev.find(i => i.product_id === selectedProduct)
      if (existing) {
        return prev.map(i =>
          i.product_id === selectedProduct
            ? { ...i, quantity_required: i.quantity_required + qty, notes: addNotes.trim() || i.notes }
            : i
        )
      }
      return [...prev, {
        schedule_id: '',
        product_id: selectedProduct,
        product_name: product.name || '',
        sku: product.sku,
        brand_name: product.brand_name,
        quantity_required: qty,
        batch_number: batchNum,
        notes: addNotes.trim() || undefined,
        allow_override: false,
        printed_count: 0
      }]
    })
    setSelectedProduct('')
    setAddQuantity('1')
    setAddNotes('')
    setShowAddProduct(false)
  }

  const handleRemoveItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.product_id !== productId))
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setItems(prev => prev.map(i =>
      i.product_id === productId ? { ...i, quantity_required: Math.max(0, quantity) } : i
    ))
  }

  const handleToggleOverride = (productId: string) => {
    setItems(prev => prev.map(i =>
      i.product_id === productId ? { ...i, allow_override: !i.allow_override } : i
    ))
  }

  const handleUpdateNotes = (productId: string, notes: string) => {
    setItems(prev => prev.map(i =>
      i.product_id === productId ? { ...i, notes: notes || undefined } : i
    ))
  }

  const generateSerialNumber = (releaseId: string, manufactureDate: string) => {
    const datePart = manufactureDate.replace(/-/g, '')
    const shortId = releaseId.replace(/-/g, '').slice(0, 8).toUpperCase()
    return `GFC-${datePart}-${shortId}`
  }

  const canPrint = (item: ProductionScheduleItem) => {
    if (item.allow_override) return true
    return item.printed_count < item.quantity_required
  }

  const getRemainingCount = (item: ProductionScheduleItem) => {
    return Math.max(0, item.quantity_required - item.printed_count)
  }

  const handlePrint = async (item: ProductionScheduleItem) => {
    if (!canPrint(item)) return
    setPrintingId(item.product_id)
    try {
      const manufactureDate = getPhilippinesDate()
      const stickerId = crypto.randomUUID()
      const serialNumber = generateSerialNumber(stickerId, manufactureDate)
      const factoryUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/factory?id=${stickerId}`

      const { data: scheduleRow } = await supabase
        .from('production_schedules')
        .select('id')
        .eq('product_id', item.product_id)
        .eq('schedule_date', scheduleDate)
        .single()

      const { error: insertError } = await supabase
        .from('production_sticker_logs')
        .insert({
          id: stickerId,
          product_id: item.product_id,
          schedule_id: scheduleRow?.id,
          batch_number: item.batch_number,
          manufacture_date: manufactureDate,
          serial_number: serialNumber
        })

      if (insertError) throw insertError

      const QRCode = (await import('qrcode')).default
      const qrDataUrl = await QRCode.toDataURL(factoryUrl, { width: 70, margin: 1 })

      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print Sticker</title>
            <style>
              @page { size: 60mm 40mm; margin: 0; }
              * { box-sizing: border-box; }
              body { margin: 0; padding: 0; font-family: sans-serif; }
              .sticker { width: 60mm; height: 40mm; padding: 2mm; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: row; align-items: flex-start; gap: 2mm; }
              .sticker .info { flex: 1; min-width: 0; font-size: 10px; line-height: 1.25; align-self: flex-start; }
              .sticker .name { font-weight: bold; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              .sticker .meta { font-size: 9px; color: #333; overflow: hidden; text-overflow: ellipsis; }
              .sticker .qr-wrap { flex-shrink: 0; align-self: flex-end; margin-top: auto; }
              .sticker img { display: block; width: 70px; height: 70px; }
            </style>
          </head>
          <body>
            <div class="sticker">
              <div class="info">
                <div class="name">${item.product_name}</div>
                <div class="meta">SKU: ${item.sku || '-'}</div>
                <div class="meta">Serial: ${serialNumber}</div>
                <div class="meta">Batch: ${item.batch_number}</div>
                <div class="meta">Mfg: ${manufactureDate}</div>
                ${item.notes ? `<div class="meta">Notes: ${item.notes}</div>` : ''}
              </div>
              <div class="qr-wrap">
                <img src="${qrDataUrl}" width="70" height="70" alt="QR" />
              </div>
            </div>
          </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => { printWindow.print(); printWindow.close() }, 250)
      }
      await fetchSchedule()
    } catch (err) {
      console.error('Error printing:', err)
      alert('Failed to print sticker: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPrintingId(null)
    }
  }

  const handlePrintAll = async (item: ProductionScheduleItem) => {
    const count = getRemainingCount(item)
    if (count <= 0) return
    setPrintingAllId(item.product_id)
    try {
      const manufactureDate = getPhilippinesDate()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''

      const { data: scheduleRow } = await supabase
        .from('production_schedules')
        .select('id')
        .eq('product_id', item.product_id)
        .eq('schedule_date', scheduleDate)
        .single()

      const QRCode = (await import('qrcode')).default
      const stickers: { stickerId: string; qrDataUrl: string; serialNumber: string }[] = []

      for (let i = 0; i < count; i++) {
        const stickerId = crypto.randomUUID()
        const serialNumber = generateSerialNumber(stickerId, manufactureDate)
        const factoryUrl = `${origin}/factory?id=${stickerId}`
        const qrDataUrl = await QRCode.toDataURL(factoryUrl, { width: 70, margin: 1 })
        stickers.push({ stickerId, qrDataUrl, serialNumber })
      }

      for (const { stickerId, serialNumber } of stickers) {
        const { error: insertError } = await supabase
          .from('production_sticker_logs')
          .insert({
            id: stickerId,
            product_id: item.product_id,
            schedule_id: scheduleRow?.id,
            batch_number: item.batch_number,
            manufacture_date: manufactureDate,
            serial_number: serialNumber
          })
        if (insertError) throw insertError
      }

      const stickerHtml = stickers.map(
        ({ qrDataUrl, serialNumber }) => `
          <div class="sticker">
            <div class="info">
              <div class="name">${item.product_name}</div>
              <div class="meta">SKU: ${item.sku || '-'}</div>
              <div class="meta">Serial: ${serialNumber}</div>
              <div class="meta">Batch: ${item.batch_number}</div>
              <div class="meta">Mfg: ${manufactureDate}</div>
              ${item.notes ? `<div class="meta">Notes: ${item.notes}</div>` : ''}
            </div>
            <div class="qr-wrap">
              <img src="${qrDataUrl}" width="70" height="70" alt="QR" />
            </div>
          </div>
        `
      ).join('')

      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print Stickers - ${item.product_name}</title>
            <style>
              @page { size: 60mm 40mm; margin: 0; }
              * { box-sizing: border-box; }
              body { margin: 0; padding: 0; font-family: sans-serif; }
              .sticker { width: 60mm; height: 40mm; padding: 2mm; overflow: hidden; page-break-inside: avoid; page-break-after: always; display: flex; flex-direction: row; align-items: flex-start; gap: 2mm; }
              .sticker:last-child { page-break-after: auto; }
              .sticker .info { flex: 1; min-width: 0; font-size: 10px; line-height: 1.25; align-self: flex-start; }
              .sticker .name { font-weight: bold; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              .sticker .meta { font-size: 9px; color: #333; overflow: hidden; text-overflow: ellipsis; }
              .sticker .qr-wrap { flex-shrink: 0; align-self: flex-end; margin-top: auto; }
              .sticker img { display: block; width: 70px; height: 70px; }
            </style>
          </head>
          <body>${stickerHtml}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => { printWindow.print(); printWindow.close() }, 250)
      }
      await fetchSchedule()
    } catch (err) {
      console.error('Error printing all:', err)
      alert('Failed to print stickers: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPrintingAllId(null)
    }
  }

  const handleSave = async () => {
    if (!scheduleDate) return
    setSaving(true)
    try {
      for (const item of items) {
        const product = allProducts.find(p => p.id === item.product_id)
        const batchNum = item.batch_number || (product ? generateBatchNumber(product) : `BATCH-${scheduleDate.replace(/-/g, '')}`)
        const { error } = await supabase
          .from('production_schedules')
          .upsert({
            product_id: item.product_id,
            schedule_date: scheduleDate,
            quantity_required: item.quantity_required,
            batch_number: batchNum,
            notes: item.notes || null,
            allow_override: item.allow_override
          }, {
            onConflict: 'product_id,schedule_date'
          })

        if (error) throw error
      }

      const { data: existing } = await supabase
        .from('production_schedules')
        .select('id, product_id')
        .eq('schedule_date', scheduleDate)

      if (existing) {
        const toRemove = existing.filter(r => !items.some(i => i.product_id === r.product_id))
        for (const r of toRemove) {
          await supabase.from('production_schedules').delete().eq('id', r.id)
        }
      }

      alert('Production schedule saved successfully!')
      fetchSchedule()
    } catch (err) {
      console.error('Error saving schedule:', err)
      alert('Failed to save schedule: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  const themeClasses = {
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    blue: 'bg-blue-600 hover:bg-blue-700'
  }[theme]

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-6 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Production Schedule
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Scan sticker QR at <a href="/factory" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">/factory</a> to add to production inventory
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Date</label>
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-800">Products to Produce</h3>
          <button
            onClick={() => setShowAddProduct(true)}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg ${themeClasses}`}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>

        {showAddProduct && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <h4 className="font-medium mb-3">Add Product to Schedule</h4>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-gray-600 mb-1">Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select product...</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.brand_name}) - {p.sku || '-'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-16">
                <label className="block text-sm text-gray-600 mb-1">Qty</label>
                <input
                  type="number"
                  min={1}
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="Add any notes..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddProduct} className={`px-4 py-2 text-white rounded-lg ${themeClasses}`}>
                  Add
                </button>
                <button onClick={() => setShowAddProduct(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No products in schedule for {scheduleDate}</p>
            <p className="text-sm mt-1">Click &quot;Add Product&quot; to add items</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Printed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Override</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map(item => {
                  const remaining = getRemainingCount(item)
                  const canPrintThis = canPrint(item) && item.schedule_id
                  return (
                    <tr key={item.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{item.brand_name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.sku || '-'}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          value={item.quantity_required}
                          onChange={(e) => handleUpdateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.printed_count}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleUpdateNotes(item.product_id, e.target.value)}
                          placeholder="Optional notes"
                          className="w-28 px-2 py-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.allow_override}
                            onChange={() => handleToggleOverride(item.product_id)}
                            className="rounded"
                          />
                          <span className="text-xs text-gray-600">Allow override</span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePrint(item)}
                            disabled={!canPrintThis || printingId === item.product_id || printingAllId === item.product_id}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Printer className="h-3 w-3" />
                            Print
                          </button>
                          <button
                            onClick={() => handlePrintAll(item)}
                            disabled={!canPrintThis || remaining <= 0 || printingId === item.product_id || printingAllId === item.product_id}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 disabled:opacity-50 border border-indigo-600"
                          >
                            <Printer className="h-3 w-3" />
                            All ({remaining})
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.product_id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg ${themeClasses} disabled:opacity-50`}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
