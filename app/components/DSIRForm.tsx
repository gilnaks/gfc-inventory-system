'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Save, Calculator, AlertCircle } from 'lucide-react'
import { 
  SalesInventorySection, 
  IceCreamInventorySection, 
  MaterialsInventorySection, 
  DiscountsSection, 
  ExpensesSection, 
  SalesReconSection 
} from './DSIRSections'

interface DSIRReport {
  id: string
  location_id: string
  staff_registration_id: string
  report_date: string
  store_hours: string
  staff_name: string
  initial: string
  gross_sales: number
  total_discounts: number
  total_expenses: number
  net_sales: number
  total_cash: number
  discrepancy: number
  status: 'draft' | 'submitted' | 'reviewed'
  notes: string
  created_at: string
  updated_at: string
  location?: {
    id: string
    name: string
    brand_id: string
    franchisee?: string
    contact_number?: string
    company_owned?: boolean
  }
}

interface SalesInventoryItem {
  id?: string
  item_name: string
  beginning_inventory: number
  arrival: number
  pull_out: number
  new_inventory: number
  ending_inventory: number
  sold: number
  price: number
  sales: number
}

interface IceCreamInventoryItem {
  id?: string
  flavor: string
  beginning: number
  production_500ml: number
  additions: number
  ending: number
}

interface MaterialsInventoryItem {
  id?: string
  item_name: string
  beginning: number
  arrival: number
  ending: number
}

interface DiscountItem {
  id?: string
  name: string
  id_type: 'senior' | 'pwd'
  id_no: string
  attach_url: string
  order_type: 'mychoice' | 'gelatofilipino' | 'mang-sorbetes'
  order_amount: number
  discount_amount: number
}

interface ExpenseItem {
  id?: string
  particulars: string
  amount: number
}

interface SalesReconItem {
  id?: string
  denomination: string
  quantity: number
  amount: number
}

interface DSIRFormProps {
  report: DSIRReport
  onReportUpdate: (report: DSIRReport) => void
}

export function DSIRForm({ report, onReportUpdate }: DSIRFormProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form data
  const [formData, setFormData] = useState({
    store_hours: report.store_hours || '',
    initial: report.initial || '',
    notes: report.notes || ''
  })

  // Section data
  const [salesInventory, setSalesInventory] = useState<SalesInventoryItem[]>([])
  const [iceCreamInventory, setIceCreamInventory] = useState<IceCreamInventoryItem[]>([])
  const [materialsInventory, setMaterialsInventory] = useState<MaterialsInventoryItem[]>([])
  const [discounts, setDiscounts] = useState<DiscountItem[]>([])
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [salesRecon, setSalesRecon] = useState<SalesReconItem[]>([])

  // Predefined items - loaded from database
  const [predefinedSalesItems, setPredefinedSalesItems] = useState<Array<{name: string, price: number}>>([])
  const [predefinedIceCreamFlavors, setPredefinedIceCreamFlavors] = useState<string[]>([])
  const [predefinedMaterials, setPredefinedMaterials] = useState<string[]>([])
  const [predefinedDenominations, setPredefinedDenominations] = useState<{name: string, value: number}[]>([])

  useEffect(() => {
    loadReportData()
    loadPredefinedItems()
  }, [report.id])

  const loadReportData = async () => {
    setLoading(true)
    try {
      // Load all section data
      await Promise.all([
        loadSalesInventory(),
        loadIceCreamInventory(),
        loadMaterialsInventory(),
        loadDiscounts(),
        loadExpenses(),
        loadSalesRecon()
      ])
    } catch (error) {
      console.error('Error loading report data:', error)
      setError('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const loadPredefinedItems = async () => {
    try {
      // Get brand ID from report location
      if (!report.location?.brand_id) return

      const { data, error } = await supabase
        .from('dsir_predefined_items')
        .select('category, name, price')
        .eq('brand_id', report.location.brand_id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      // Group items by category
      const sales = data?.filter(item => item.category === 'sales').map(item => ({
        name: item.name,
        price: item.price || 0
      })) || []
      const iceCream = data?.filter(item => item.category === 'ice_cream').map(item => item.name) || []
      const materials = data?.filter(item => item.category === 'materials').map(item => item.name) || []
      const denominations = data?.filter(item => item.category === 'denominations').map(item => ({
        name: item.name,
        value: ['1,000', '500', '200', '100', '50', '20'].includes(item.name) 
          ? parseInt(item.name.replace(',', '')) 
          : 0
      })) || []

      setPredefinedSalesItems(sales)
      setPredefinedIceCreamFlavors(iceCream)
      setPredefinedMaterials(materials)
      setPredefinedDenominations(denominations)
    } catch (error) {
      console.error('Error loading predefined items:', error)
      // Fallback to default items if database fails
      setPredefinedSalesItems([
        { name: 'BIG CUP', price: 90 },
        { name: 'SMALL CUP', price: 80 },
        { name: 'WATER', price: 0 },
        { name: 'CHOCO-COATED', price: 0 },
        { name: '500ML', price: 0 },
        { name: '1 PAN', price: 500 }
      ])
      setPredefinedIceCreamFlavors(['BUBBLEGUM', 'COOKIE BITS', 'COOKIE MON', 'COFFEE', 'CHOCOLATE', 'DURIAN', 'MANGO', 'MELON', 'MATCHA', 'STRAWBERRY', 'UBE', 'UBE QUEZO', 'UNICORN'])
      setPredefinedMaterials(['DSR FORM', 'SPOONS', 'TISSUE', 'GLOVES', 'TRASHBAG', 'SOAP', 'POPSICLE STICKS'])
      setPredefinedDenominations([
        { name: '1,000', value: 1000 },
        { name: '500', value: 500 },
        { name: '200', value: 200 },
        { name: '100', value: 100 },
        { name: '50', value: 50 },
        { name: '20', value: 20 },
        { name: 'COINS', value: 0 },
        { name: 'GCASH', value: 0 }
      ])
    }
  }

  const loadSalesInventory = async () => {
    const { data } = await supabase
      .from('dsir_sales_inventory')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setSalesInventory(data)
    }
  }

  const loadIceCreamInventory = async () => {
    const { data } = await supabase
      .from('dsir_ice_cream_inventory')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setIceCreamInventory(data)
    }
  }

  const loadMaterialsInventory = async () => {
    const { data } = await supabase
      .from('dsir_materials_inventory')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setMaterialsInventory(data)
    }
  }

  const loadDiscounts = async () => {
    const { data } = await supabase
      .from('dsir_discounts')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      // Map old field names to new field names for backward compatibility
      const mappedData = data.map(item => ({
        id: item.id,
        name: item.name || item.customer_name || '',
        id_type: item.id_type || 'pwd',
        id_no: item.id_no || '',
        attach_url: item.attach_url || '',
        order_type: item.order_type || 'mychoice',
        order_amount: item.order_amount || 0,
        discount_amount: item.discount_amount || 0
      }))
      console.log('Loaded discount data:', mappedData)
      setDiscounts(mappedData)
    }
  }

  const loadExpenses = async () => {
    const { data } = await supabase
      .from('dsir_expenses')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setExpenses(data)
    }
  }

  const loadSalesRecon = async () => {
    const { data } = await supabase
      .from('dsir_sales_recon')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setSalesRecon(data)
    }
  }

  const saveReport = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Update main report
      const { error: reportError } = await supabase
        .from('dsir_reports')
        .update({
          store_hours: formData.store_hours,
          initial: formData.initial,
          notes: formData.notes,
          status: 'draft'
        })
        .eq('id', report.id)

      if (reportError) throw reportError

      // Refresh report data
      const { data: updatedReport } = await supabase
        .from('dsir_reports')
        .select('*')
        .eq('id', report.id)
        .single()

      if (updatedReport) {
        onReportUpdate(updatedReport)
        setSuccess('Report saved successfully!')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error saving report:', error)
      setError('Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  const submitReport = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: reportError } = await supabase
        .from('dsir_reports')
        .update({
          store_hours: formData.store_hours,
          initial: formData.initial,
          notes: formData.notes,
          status: 'submitted'
        })
        .eq('id', report.id)

      if (reportError) throw reportError

      // Refresh report data
      const { data: updatedReport } = await supabase
        .from('dsir_reports')
        .select('*')
        .eq('id', report.id)
        .single()

      if (updatedReport) {
        onReportUpdate(updatedReport)
        setSuccess('Report submitted successfully!')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (error) {
      console.error('Error submitting report:', error)
      setError('Failed to submit report')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">DAILY SALES REPORTS</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DATE</label>
            <input
              type="date"
              value={report.report_date}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">STORE HRS</label>
            <input
              type="text"
              value={formData.store_hours}
              onChange={(e) => setFormData({...formData, store_hours: e.target.value})}
              placeholder="e.g., 8:00 AM - 8:00 PM"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">INITIAL</label>
            <input
              type="text"
              value={formData.initial}
              onChange={(e) => setFormData({...formData, initial: e.target.value})}
              placeholder="Staff initial"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

      </div>

      {/* Section A: Sales Inventory */}
      <SalesInventorySection
        items={salesInventory}
        onItemsChange={setSalesInventory}
        predefinedItems={predefinedSalesItems.map(item => item.name)}
        reportId={report.id}
      />

      {/* Section B: Ice Cream Inventory */}
      <IceCreamInventorySection
        items={iceCreamInventory}
        onItemsChange={setIceCreamInventory}
        predefinedFlavors={predefinedIceCreamFlavors}
        reportId={report.id}
      />

      {/* Section C: Materials/Supplies Inventory */}
      <MaterialsInventorySection
        items={materialsInventory}
        onItemsChange={setMaterialsInventory}
        predefinedItems={predefinedMaterials}
        reportId={report.id}
      />

      {/* Section D: Discounts */}
      <DiscountsSection
        items={discounts}
        onItemsChange={setDiscounts}
        reportId={report.id}
        orderOptions={predefinedSalesItems
          .filter(item => item.price && item.price > 0)
          .map(item => ({
            value: `${item.name} - ₱${item.price.toFixed(2)}`,
            label: `${item.name} - ₱${item.price.toFixed(2)}`,
            price: item.price
          }))
        }
      />

      {/* Section E: Expenses */}
      <ExpensesSection
        items={expenses}
        onItemsChange={setExpenses}
        reportId={report.id}
      />

      {/* Section F: Sales Reconciliation */}
      <SalesReconSection
        items={salesRecon}
        onItemsChange={setSalesRecon}
        predefinedDenominations={predefinedDenominations}
        reportId={report.id}
        netSales={report.net_sales}
      />

      {/* Summary Calculations */}
      <SummarySection report={report} />

      {/* Notes Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">NOTES</h3>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Additional notes or observations..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <button
              onClick={saveReport}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Draft'}</span>
            </button>
            
            <button
              onClick={submitReport}
              disabled={saving || report.status === 'submitted'}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <Calculator className="h-4 w-4" />
              <span>{saving ? 'Submitting...' : 'Submit Report'}</span>
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-600">Status: <span className="font-medium">{report.status.toUpperCase()}</span></p>
            <p className="text-sm text-gray-500">Last updated: {new Date(report.updated_at).toLocaleString()}</p>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mt-4 flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-center space-x-2 text-green-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{success}</span>
          </div>
        )}
      </div>
    </div>
  )
}


function SummarySection({ report }: { report: DSIRReport }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Calculations</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GROSS SALES</label>
          <input
            type="number"
            value={report.gross_sales}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LESS: DISCOUNTS</label>
          <input
            type="number"
            value={report.total_discounts}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LESS: EXPENSES</label>
          <input
            type="number"
            value={report.total_expenses}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NET SALES</label>
          <input
            type="number"
            value={report.net_sales}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>
      </div>
    </div>
  )
}
