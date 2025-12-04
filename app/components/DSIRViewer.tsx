'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'

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
  big_cup_sales?: number
  small_cup_sales?: number
  water_sales?: number
  ml_500_sales?: number
  choco_coated_sales?: number
  status: 'draft' | 'submitted' | 'reviewed'
  notes: string
  created_at: string
  updated_at: string
  location?: {
    name: string
    brand?: {
    name: string
    }
  }
}

interface SalesInventoryItem {
  id: string
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
  id: string
  flavor: string
  beginning: number
  arrival: number
  pull_out: number
  new_inventory: number
  ending: number
  sold: number
  price: number
  sales: number
}

interface MaterialsInventoryItem {
  id: string
  material_name: string
  beginning: number
  arrival: number
  pull_out: number
  ending: number
  used: number
  price: number
  cost: number
}

interface DiscountItem {
  id: string
  name: string
  id_type: 'senior' | 'pwd' | ''
  id_no: string
  order_type: string
  order_amount: number
  discount_amount: number
}

interface ExpenseItem {
  id: string
  expense_type: string
  amount: number
  description: string
}

interface SalesReconItem {
  id: string
  denomination: string
  quantity: number
  amount: number
}

interface DSIRViewerProps {
  report: DSIRReport
  onReportUpdate?: (report: DSIRReport) => void
  currentStaffName?: string
  onReportSubmitted?: () => void
  showEditButton?: boolean
  showDiscrepancyColumns?: boolean
  showSalesDiscrepancyColumns?: boolean
  showIceCreamDiscrepancyColumns?: boolean
  showMaterialsDiscrepancyColumns?: boolean
}

export function DSIRViewer({ 
  report, 
  onReportUpdate, 
  currentStaffName, 
  onReportSubmitted, 
  showEditButton = false, 
  showDiscrepancyColumns = false,
  showSalesDiscrepancyColumns,
  showIceCreamDiscrepancyColumns,
  showMaterialsDiscrepancyColumns
}: DSIRViewerProps) {
  // Determine which discrepancy columns to show
  // If specific props are provided, use them; otherwise fall back to the general showDiscrepancyColumns
  const showSalesDiff = showSalesDiscrepancyColumns !== undefined ? showSalesDiscrepancyColumns : showDiscrepancyColumns
  const showIceCreamDiff = showIceCreamDiscrepancyColumns !== undefined ? showIceCreamDiscrepancyColumns : showDiscrepancyColumns
  const showMaterialsDiff = showMaterialsDiscrepancyColumns !== undefined ? showMaterialsDiscrepancyColumns : showDiscrepancyColumns

  const [loading, setLoading] = useState(true)
  const [salesInventory, setSalesInventory] = useState<SalesInventoryItem[]>([])
  const [iceCreamInventory, setIceCreamInventory] = useState<IceCreamInventoryItem[]>([])
  const [materialsInventory, setMaterialsInventory] = useState<MaterialsInventoryItem[]>([])
  const [discounts, setDiscounts] = useState<DiscountItem[]>([])
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [salesRecon, setSalesRecon] = useState<SalesReconItem[]>([])

  // Predefined items - loaded from database
  const [predefinedSalesItems, setPredefinedSalesItems] = useState<Array<{name: string, price: number | null}>>([])
  const [predefinedIceCreamFlavors, setPredefinedIceCreamFlavors] = useState<Array<{name: string, price: number | null}>>([])
  const [predefinedMaterials, setPredefinedMaterials] = useState<Array<{name: string, price: number | null}>>([])
  const [predefinedDenominations, setPredefinedDenominations] = useState<Array<{name: string, price: number | null}>>([])

  // Previous day inventory for discrepancy calculation
  const [previousDaySales, setPreviousDaySales] = useState<any[]>([])
  const [previousDayIceCream, setPreviousDayIceCream] = useState<any[]>([])
  const [previousDayMaterials, setPreviousDayMaterials] = useState<any[]>([])
  const [loadingPreviousDay, setLoadingPreviousDay] = useState(false)

  // Form state management
  const [formData, setFormData] = useState<any>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Legacy editing state (keeping for compatibility with existing UI)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null)
  const isSwitchingFields = useRef<boolean>(false)

  // Check if report is read-only (submitted or reviewed)
  const isReadOnly = report?.status === 'submitted' || report?.status === 'reviewed'

  // Check if sales reconciliation has any values
  const hasSalesReconData = () => {
    // Check existing data from database
    const hasExistingData = salesRecon.some(item => 
      item.quantity && typeof item.quantity === 'number' && item.quantity > 0
    )
    
    // Check form data for any sales recon entries with quantity > 0
    const hasFormData = Object.keys(formData).some(key => {
      if (!key.startsWith('salesrecon-') || !key.includes('-quantity')) {
        return false
      }
      
      const value = formData[key]
      // Explicitly check if the value is a meaningful number > 0
      if (!value || value === '' || value === '0') {
        return false
      }
      
      const numValue = parseInt(value)
      return !isNaN(numValue) && numValue > 0
    })
    
    return hasExistingData || hasFormData
  }

  // Helper function to get cell styling based on read-only status
  const getCellClassName = () => {
    return `text-center min-h-[24px] flex items-center justify-center ${
      isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-100'
    }`
  }

  // Helper function to handle cell clicks
  const handleCellClick = (e: React.MouseEvent, fieldId: string, currentValue: any) => {
    if (isReadOnly) return
    e.preventDefault()
    e.stopPropagation()
    startEditing(fieldId, currentValue)
  }

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingField) {
      if (editingField === 'header-notes' && textareaRef.current) {
        textareaRef.current.focus()
        // Position cursor at the end of the text
        const length = textareaRef.current.value.length
        textareaRef.current.setSelectionRange(length, length)
      } else if (inputRef.current) {
      // Just focus, don't select text to avoid interference
      inputRef.current.focus()
      }
    }
  }, [editingField])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Helper function to handle save on Tab key
  const handleKeyDown = (fieldId: string, e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      saveEditing(fieldId)
    }
  }

  // Auto-save after delay
  useEffect(() => {
    if (editingField && editingValue !== '') {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      // Set new timeout for auto-save - DISABLED to fix unfocus issue
      // saveTimeoutRef.current = setTimeout(() => {
      //   saveEditing(editingField)
      // }, 2000) // Auto-save after 2 seconds of inactivity
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [editingValue, editingField])

  const loadSalesInventory = useCallback(async () => {
    if (!report?.id) return
    
    const { data } = await supabase
      .from('dsir_sales_inventory')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setSalesInventory(data)
    }
  }, [report])

  const loadIceCreamInventory = useCallback(async () => {
    if (!report?.id) return
    
    const { data } = await supabase
      .from('dsir_ice_cream_inventory')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setIceCreamInventory(data)
    }
  }, [report])

  const loadMaterialsInventory = useCallback(async () => {
    if (!report?.id) return
    
    const { data } = await supabase
      .from('dsir_materials_inventory')
        .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setMaterialsInventory(data)
    }
  }, [report])

  const loadPreviousDayInventory = useCallback(async () => {
    if (!report?.id || !report?.location_id) return
    
    setLoadingPreviousDay(true)
    try {
      // Calculate previous day date
      const reportDate = new Date(report.report_date)
      const previousDay = new Date(reportDate)
      previousDay.setDate(previousDay.getDate() - 1)
      const previousDayStr = previousDay.toISOString().split('T')[0]

      // Find the previous day's DSIR report for the same location
      const { data: previousReport } = await supabase
        .from('dsir_reports')
        .select('id')
        .eq('location_id', report.location_id)
        .eq('report_date', previousDayStr)
        .eq('status', 'submitted')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (previousReport) {
        // Load previous day's ending inventory
        const [salesData, iceCreamData, materialsData] = await Promise.all([
          supabase
            .from('dsir_sales_inventory')
            .select('item_name, ending_inventory')
            .eq('dsir_report_id', previousReport.id),
          supabase
            .from('dsir_ice_cream_inventory')
            .select('flavor, ending')
            .eq('dsir_report_id', previousReport.id),
          supabase
            .from('dsir_materials_inventory')
            .select('material_name, ending')
            .eq('dsir_report_id', previousReport.id)
        ])

        setPreviousDaySales(salesData.data || [])
        setPreviousDayIceCream(iceCreamData.data || [])
        setPreviousDayMaterials(materialsData.data || [])
      }
    } catch (error) {
      console.error('Error loading previous day inventory:', error)
    } finally {
      setLoadingPreviousDay(false)
    }
  }, [report])

  const loadDiscounts = useCallback(async () => {
    if (!report?.id) return
    
    console.log('loadDiscounts called for report:', report.id)
    const { data } = await supabase
      .from('dsir_discounts')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    console.log('Discounts data from DB:', data)
    if (data) {
      // Map old field names to new field names for backward compatibility
      const mappedData = data.map(item => ({
        id: item.id,
        name: item.name || item.customer_name || item.discount_type || '',
        id_type: item.id_type || 'pwd',
        id_no: item.id_no || item.id_number || '',
        order_type: item.order_type || '',
        order_amount: item.order_amount || 0,
        discount_amount: item.discount_amount || 0
      }))
      
      console.log('Mapped discounts data:', mappedData)
      
        setDiscounts(mappedData)
    }
  }, [report])

  const deleteDiscount = async (discountId: string) => {
    if (!discountId) return
    
    try {
      // If it's a new/unsaved item (starts with 'new-'), just remove from local state
      if (discountId.startsWith('new-')) {
        setDiscounts(prev => prev.filter(discount => discount.id !== discountId))
        
        // Remove all form data entries for this discount
        const newFormData = { ...formData }
        Object.keys(newFormData).forEach(key => {
          if (key.startsWith(`discounts-${discountId}-`)) {
            delete newFormData[key]
          }
        })
        setFormData(newFormData)
        return
      }

      // If it's an existing item, delete from database
      const { error } = await supabase
        .from('dsir_discounts')
        .delete()
        .eq('id', discountId)

      if (error) throw error

      // Remove all form data entries for this discount
      const newFormData = { ...formData }
      Object.keys(newFormData).forEach(key => {
        if (key.startsWith(`discounts-${discountId}-`)) {
          delete newFormData[key]
        }
      })
      setFormData(newFormData)

      // Reload discounts to update the UI
      await loadDiscounts()
      
      console.log('Successfully deleted discount:', discountId)
    } catch (error) {
      console.error('Error deleting discount:', error)
      alert('Error deleting discount. Please try again.')
    }
  }

  const addNewDiscountRow = () => {
    // Add a new empty discount item to the local state
    const newDiscount = {
      id: `new-${Date.now()}`,
      name: '',
      id_type: '' as 'senior' | 'pwd' | '',
      id_no: '',
      order_type: '',
      order_amount: 0,
      discount_amount: 0
    }
    setDiscounts(prev => [...prev, newDiscount])
  }

  const addNewExpenseRow = () => {
    // Add a new empty expense item to the local state
    const newExpense = {
      id: `new-${Date.now()}`,
      expense_type: '',
      amount: 0,
      description: ''
    }
    setExpenses(prev => [...prev, newExpense])
  }

  const deleteExpense = async (expenseId: string) => {
    if (!expenseId) return
    
    try {
      // If it's a new/unsaved item (starts with 'new-'), just remove from local state
      if (expenseId.startsWith('new-')) {
        setExpenses(prev => prev.filter(expense => expense.id !== expenseId))
        
        // Remove all form data entries for this expense
        const newFormData = { ...formData }
        Object.keys(newFormData).forEach(key => {
          if (key.startsWith(`expenses-${expenseId}-`)) {
            delete newFormData[key]
          }
        })
        setFormData(newFormData)
        return
      }

      // If it's an existing item, delete from database
      const { error } = await supabase
        .from('dsir_expenses')
        .delete()
        .eq('id', expenseId)

      if (error) throw error

      // Remove all form data entries for this expense
      const newFormData = { ...formData }
      Object.keys(newFormData).forEach(key => {
        if (key.startsWith(`expenses-${expenseId}-`)) {
          delete newFormData[key]
        }
      })
      setFormData(newFormData)

      // Reload expenses to update the UI
      await loadExpenses()
      
      console.log('Successfully deleted expense:', expenseId)
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('Error deleting expense. Please try again.')
    }
  }

  const loadExpenses = useCallback(async () => {
    if (!report?.id) return
    
    const { data } = await supabase
      .from('dsir_expenses')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setExpenses(data)
    }
  }, [report])

  const loadSalesRecon = useCallback(async () => {
    if (!report?.id) return
    
    const { data } = await supabase
      .from('dsir_sales_recon')
      .select('*')
      .eq('dsir_report_id', report.id)
      .order('created_at')

    if (data) {
      setSalesRecon(data)
    }
  }, [report])

  // Custom sorting function for alphanumeric items
  const sortAlphanumeric = (a: string, b: string) => {
    // Split strings into parts (letters and numbers)
    const aParts = a.match(/([a-zA-Z]+)|(\d+)/g) || []
    const bParts = b.match(/([a-zA-Z]+)|(\d+)/g) || []
    
    const maxLength = Math.max(aParts.length, bParts.length)
    
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || ''
      const bPart = bParts[i] || ''
      
      // If both parts are numbers, compare numerically
      if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
        const aNum = parseInt(aPart)
        const bNum = parseInt(bPart)
        if (aNum !== bNum) return aNum - bNum
      }
      // If both parts are letters, compare alphabetically
      else if (/^[a-zA-Z]+$/.test(aPart) && /^[a-zA-Z]+$/.test(bPart)) {
        if (aPart !== bPart) return aPart.localeCompare(bPart)
      }
      // If one is number and one is letter, letters come first
      else if (/^\d+$/.test(aPart) && /^[a-zA-Z]+$/.test(bPart)) {
        return 1 // number comes after letter
      }
      else if (/^[a-zA-Z]+$/.test(aPart) && /^\d+$/.test(bPart)) {
        return -1 // letter comes before number
      }
      // Fallback to string comparison
      else {
        if (aPart !== bPart) return aPart.localeCompare(bPart)
      }
    }
    
    return 0
  }

  const loadPredefinedItems = useCallback(async () => {
    try {
      // Get brand ID from report location
      if (!(report?.location as any)?.brand_id) return

      const { data, error } = await supabase
        .from('dsir_predefined_items')
        .select('category, name, price, show_in_local, show_in_remote')
        .eq('brand_id', (report?.location as any)?.brand_id)
        .eq('is_active', true)

      if (error) throw error

      // Determine if this is a remote location
      const isRemoteLocation = (report?.location as any)?.is_remote || false
      
      // Filter items based on location type (local vs remote)
      const filterByLocation = (item: any) => {
        if (isRemoteLocation) {
          return item.show_in_remote !== false // Show if explicitly enabled or null (default true)
        } else {
          return item.show_in_local !== false // Show if explicitly enabled or null (default true)
        }
      }

      // Group items by category and sort them
      const sales = (data?.filter(item => item.category === 'sales' && filterByLocation(item)) || [])
        .sort((a, b) => sortAlphanumeric(a.name, b.name))
      const iceCream = (data?.filter(item => item.category === 'ice_cream' && filterByLocation(item)) || [])
        .sort((a, b) => sortAlphanumeric(a.name, b.name))
      const materials = (data?.filter(item => item.category === 'materials' && filterByLocation(item)) || [])
        .sort((a, b) => sortAlphanumeric(a.name, b.name))
      const denominations = (data?.filter(item => item.category === 'denominations' && filterByLocation(item)) || [])
        .sort((a, b) => sortAlphanumeric(a.name, b.name))

      setPredefinedSalesItems(sales)
      setPredefinedIceCreamFlavors(iceCream)
      setPredefinedMaterials(materials)
      setPredefinedDenominations(denominations)
    } catch (error) {
      console.error('Error loading predefined items:', error)
      // Fallback to default items if database fails
      setPredefinedSalesItems([
        {name: 'BIG CUP', price: 90}, {name: 'SMALL CUP', price: 80}, {name: 'WATER', price: 0}, 
        {name: 'CHOCO-COATED', price: 0}, {name: '500ML', price: 0}, {name: '1 PAN', price: 500}
      ])
      setPredefinedIceCreamFlavors([
        {name: 'BUBBLEGUM', price: null}, {name: 'COOKIE BITS', price: null}, {name: 'COOKIE MON', price: null}, 
        {name: 'COFFEE', price: null}, {name: 'CHOCOLATE', price: null}, {name: 'DURIAN', price: null}, 
        {name: 'MANGO', price: null}, {name: 'MELON', price: null}, {name: 'MATCHA', price: null}, 
        {name: 'STRAWBERRY', price: null}, {name: 'UBE', price: null}, {name: 'UBE QUEZO', price: null}, {name: 'UNICORN', price: null}
      ])
      setPredefinedMaterials([
        {name: 'DSR FORM', price: null}, {name: 'SPOONS', price: null}, {name: 'TISSUE', price: null}, 
        {name: 'GLOVES', price: null}, {name: 'TRASHBAG', price: null}, {name: 'SOAP', price: null}, {name: 'POPSICLE STICKS', price: null}
      ])
      setPredefinedDenominations([
        {name: '1,000', price: null}, {name: '500', price: null}, {name: '200', price: null}, {name: '100', price: null}, 
        {name: '50', price: null}, {name: '20', price: null}, {name: 'COINS', price: null}, {name: 'GCASH', price: null}
      ])
    }
  }, [report])

  const loadReportData = useCallback(async () => {
    if (!report?.id) return
    
    setLoading(true)
    try {
      await Promise.all([
        loadSalesInventory(),
        loadIceCreamInventory(),
        loadMaterialsInventory(),
        loadDiscounts(),
        loadExpenses(),
        loadSalesRecon(),
        loadPredefinedItems(),
        loadPreviousDayInventory()
      ])
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }, [report, loadSalesInventory, loadIceCreamInventory, loadMaterialsInventory, loadDiscounts, loadExpenses, loadSalesRecon, loadPredefinedItems, loadPreviousDayInventory])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  const getItemValue = (items: any[], itemName: string, field: string) => {
    const item = items.find(i => i.item_name === itemName || i.flavor === itemName || i.material_name === itemName)
    if (!item) return ''
    const value = item[field]
    // Return empty string if value is null, undefined, or empty (but allow 0)
    if (value === null || value === undefined || value === '') {
      return ''
    }
    return value
  }

  const getItemValueForEditing = (items: any[], itemName: string, field: string) => {
    const item = items.find(i => i.item_name === itemName || i.flavor === itemName || i.material_name === itemName)
    console.log('getItemValueForEditing:', { itemName, field, item, itemsLength: items.length })
    if (!item) return ''
    // Return the actual value for editing (including 0)
    const value = item[field] !== null && item[field] !== undefined ? item[field] : ''
    console.log('getItemValueForEditing result:', value)
    return value
  }

  const getDiscountValue = (index: number, field: string) => {
    const discount = discounts[index]
    return discount ? discount[field] || '' : ''
  }

  const getExpenseValue = (index: number, field: string) => {
    const expense = expenses[index]
    return expense ? expense[field] || '' : ''
  }

  const getSalesReconValue = (denomination: string, field: string) => {
    const item = salesRecon.find(i => i.denomination === denomination)
    const itemId = item?.id || `new-${predefinedDenominations.findIndex(d => d.name === denomination)}`
    const value = getDisplayValue(`salesrecon-${itemId}-${field}`, item ? item[field] || '' : '')
    // Return empty string for 0 or empty values to show empty fields by default
    return value === 0 || value === '' ? '' : value
  }

  // Computed field functions
  const getNewInventory = (item: any, itemId: string) => {
    // Use form data if available, otherwise use item data
    const beg = parseInt(getDisplayValue(`sales-${itemId}-beginning_inventory`, item?.beginning_inventory) || '0') || 0
    const arrival = parseInt(getDisplayValue(`sales-${itemId}-arrival`, item?.arrival) || '0') || 0
    const pullOut = parseInt(getDisplayValue(`sales-${itemId}-pull_out`, item?.pull_out) || '0') || 0
    return beg + arrival - pullOut
  }

  const getSold = (item: any, itemId: string) => {
    const newInv = getNewInventory(item, itemId)
    const endInvValue = getDisplayValue(`sales-${itemId}-ending_inventory`, item?.ending_inventory)
    
    // Only calculate sold if ending inventory is actually provided (not blank/empty)
    if (endInvValue === '' || endInvValue === null || endInvValue === undefined) {
      return 0 // Don't calculate sold if ending inventory is blank
    }
    
    const endInv = parseInt(endInvValue || '0') || 0
    
    // If ending inventory is 0, it means sold out, so sold = new inventory (absolute value)
    if (endInv === 0) {
      return newInv
    }
    
    return newInv - endInv
  }

  const getSales = (item: any, itemId: string, predefinedPrice?: number | null) => {
    const sold = getSold(item, itemId)
    
    // Return empty string if SOLD is 0
    if (sold === 0) {
      return ''
    }
    
    // If predefined price is null or undefined, return empty string
    if (predefinedPrice === null || predefinedPrice === undefined) {
      return ''
    }
    
    const price = predefinedPrice || parseFloat(item?.price?.toString() || '0') || 0
    return sold * price
  }

  const getTotalInventory = () => {
    return predefinedIceCreamFlavors.reduce((sum, flavorObj, index) => {
      const item = iceCreamInventory.find(i => i.flavor === flavorObj.name)
      const itemId = item?.id || `new-${index}`
      
      // Calculate ending inventory: beg + arrival - pull_out
      const beg = parseInt(getDisplayValue(`icecream-${itemId}-beginning`, item?.beginning) || '0') || 0
      const arrival = parseInt(getDisplayValue(`icecream-${itemId}-arrival`, item?.arrival) || '0') || 0
      const pullOut = parseInt(getDisplayValue(`icecream-${itemId}-pull_out`, item?.pull_out) || '0') || 0
      const calculatedEnd = beg + arrival - pullOut
      
      return sum + calculatedEnd
    }, 0)
  }

  const getGrossSales = () => {
    return predefinedSalesItems.reduce((sum, itemObj, index) => {
      const item = salesInventory.find(i => i.item_name === itemObj.name)
      const itemId = item?.id || `new-${index}`
      
      // Get sold quantity from formData or database
      const sold = parseInt(getDisplayValue(`sales-${itemId}-sold`, getSold(item, itemId)) || '0') || 0
      const price = itemObj.price || 0
      const sales = sold * price
      
      return sum + sales
    }, 0)
  }
  
  const getProductSales = (productName: string) => {
    return predefinedSalesItems.reduce((sum, itemObj, index) => {
      const item = salesInventory.find(i => i.item_name === itemObj.name)
      const itemId = item?.id || `new-${index}`
      
      // Check if item name matches the product we're looking for
      const itemName = (itemObj.name || '').toString().toUpperCase().trim()
      const searchName = productName.toUpperCase()
      
      if (itemName.includes(searchName)) {
        const sold = parseInt(getDisplayValue(`sales-${itemId}-sold`, getSold(item, itemId)) || '0') || 0
        const price = itemObj.price || 0
        const sales = sold * price
        return sum + sales
      }
      
      return sum
    }, 0)
  }
  
  const getBigCupSales = () => {
    return predefinedSalesItems.reduce((sum, itemObj, index) => {
      const item = salesInventory.find(i => i.item_name === itemObj.name)
      const itemId = item?.id || `new-${index}`
      const itemName = (itemObj.name || '').toString().toUpperCase().trim()
      
      if ((itemName.includes('BIG') && itemName.includes('CUP')) || itemName === 'BIGCUP' || itemName === 'BIG CUP') {
        const sold = parseInt(getDisplayValue(`sales-${itemId}-sold`, getSold(item, itemId)) || '0') || 0
        const price = itemObj.price || 0
        return sum + (sold * price)
      }
      return sum
    }, 0)
  }
  
  const getSmallCupSales = () => {
    return predefinedSalesItems.reduce((sum, itemObj, index) => {
      const item = salesInventory.find(i => i.item_name === itemObj.name)
      const itemId = item?.id || `new-${index}`
      const itemName = (itemObj.name || '').toString().toUpperCase().trim()
      
      if ((itemName.includes('SMALL') && itemName.includes('CUP')) || itemName === 'SMALLCUP' || itemName === 'SMALL CUP') {
        const sold = parseInt(getDisplayValue(`sales-${itemId}-sold`, getSold(item, itemId)) || '0') || 0
        const price = itemObj.price || 0
        return sum + (sold * price)
      }
      return sum
    }, 0)
  }
  
  const getWaterSales = () => {
    return predefinedSalesItems.reduce((sum, itemObj, index) => {
      const item = salesInventory.find(i => i.item_name === itemObj.name)
      const itemId = item?.id || `new-${index}`
      const itemName = (itemObj.name || '').toString().toUpperCase().trim()
      
      if (itemName.includes('WATER') || itemName === 'WATER') {
        const sold = parseInt(getDisplayValue(`sales-${itemId}-sold`, getSold(item, itemId)) || '0') || 0
        const price = itemObj.price || 0
        return sum + (sold * price)
      }
      return sum
    }, 0)
  }
  
  const get500MLSales = () => {
    return predefinedSalesItems.reduce((sum, itemObj, index) => {
      const item = salesInventory.find(i => i.item_name === itemObj.name)
      const itemId = item?.id || `new-${index}`
      const itemName = (itemObj.name || '').toString().toUpperCase().trim()
      
      if (itemName.includes('500') || itemName.includes('500ML') || itemName.includes('500 ML')) {
        const sold = parseInt(getDisplayValue(`sales-${itemId}-sold`, getSold(item, itemId)) || '0') || 0
        const price = itemObj.price || 0
        return sum + (sold * price)
      }
      return sum
    }, 0)
  }
  
  const getChocoCoatedSales = () => {
    return predefinedSalesItems.reduce((sum, itemObj, index) => {
      const item = salesInventory.find(i => i.item_name === itemObj.name)
      const itemId = item?.id || `new-${index}`
      const itemName = (itemObj.name || '').toString().toUpperCase().trim()
      
      if (itemName.includes('CHOCO') || itemName.includes('CHOCOLATE') || itemName.includes('COATED')) {
        const sold = parseInt(getDisplayValue(`sales-${itemId}-sold`, getSold(item, itemId)) || '0') || 0
        const price = itemObj.price || 0
        return sum + (sold * price)
      }
      return sum
    }, 0)
  }

  const getTotalDiscounts = () => {
    return discounts.reduce((sum, item, index) => {
      const itemId = item?.id || `new-${index}`
      const orderAmount = parseFloat(getDisplayValue(`discounts-${itemId}-order_amount`, item?.order_amount)?.toString() || '0') || 0
      const discountAmount = orderAmount * 0.2 // 20% discount
      return sum + discountAmount
    }, 0)
  }

  const getTotalExpenses = () => {
    return expenses.reduce((sum, item, index) => {
      const itemId = item?.id || `new-${index}`
      const amount = parseFloat(getDisplayValue(`expenses-${itemId}-amount`, item?.amount)?.toString() || '0') || 0
      return sum + amount
    }, 0)
  }

  const getNetSales = () => {
    return getGrossSales() - getTotalDiscounts() - getTotalExpenses()
  }

  const getTotalCash = () => {
    return predefinedDenominations.reduce((sum, denomObj, index) => {
      const item = salesRecon.find(i => i.denomination === denomObj.name)
      const itemId = item?.id || `new-${index}`
      const quantity = parseInt(getDisplayValue(`salesrecon-${itemId}-quantity`, item?.quantity || 0) || '0') || 0
      const amount = getSalesReconAmount(denomObj.name, quantity)
      return sum + amount
    }, 0)
  }

  const getDiscrepancy = () => {
    return getTotalCash() - getNetSales()
  }

  const getDiscrepancyColor = () => {
    const discrepancy = getDiscrepancy()
    if (discrepancy > 0) {
      return 'text-yellow-600' // Over - yellow
    } else if (discrepancy < 0) {
      return 'text-red-600' // Lacking - red
    } else {
      return 'text-black' // Equal - black
    }
  }

  // Helper functions for inventory discrepancies
  const getPreviousDayEnding = (inventoryType: 'sales' | 'icecream' | 'materials', itemName: string) => {
    switch (inventoryType) {
      case 'sales':
        const salesItem = previousDaySales.find(item => item.item_name === itemName)
        return salesItem?.ending_inventory || 0
      case 'icecream':
        const iceCreamItem = previousDayIceCream.find(item => item.flavor === itemName)
        return iceCreamItem?.ending || 0
      case 'materials':
        const materialItem = previousDayMaterials.find(item => item.material_name === itemName)
        return materialItem?.ending || 0
      default:
        return 0
    }
  }

  const getCurrentDayBeginning = (inventoryType: 'sales' | 'icecream' | 'materials', itemName: string) => {
    switch (inventoryType) {
      case 'sales':
        const salesItem = salesInventory.find(item => item.item_name === itemName)
        return salesItem?.beginning_inventory || 0
      case 'icecream':
        const iceCreamItem = iceCreamInventory.find(item => item.flavor === itemName)
        return iceCreamItem?.beginning || 0
      case 'materials':
        const materialItem = materialsInventory.find(item => item.material_name === itemName)
        return materialItem?.beginning || 0
      default:
        return 0
    }
  }

  const getInventoryDiscrepancy = (inventoryType: 'sales' | 'icecream' | 'materials', itemName: string) => {
    const previousEnding = getPreviousDayEnding(inventoryType, itemName)
    const currentBeginning = getCurrentDayBeginning(inventoryType, itemName)
    return currentBeginning - previousEnding
  }

  const getInventoryDiscrepancyColor = (discrepancy: number) => {
    if (discrepancy > 0) {
      return 'text-red-600' // More than expected - red
    } else if (discrepancy < 0) {
      return 'text-yellow-600' // Less than expected - yellow
    } else {
      return 'text-green-600' // Perfect match - green
    }
  }

  const getDenominationValue = (denominationName: string) => {
    // Convert denomination name to numeric value
    switch (denominationName) {
      case '1,000': return 1000
      case '500': return 500
      case '200': return 200
      case '100': return 100
      case '50': return 50
      case '20': return 20
      case 'COINS': return 1 // Assume coins are counted as individual units
      case 'GCASH': return 0 // GCASH doesn't have a physical denomination value
      default: return 0
    }
  }

  const getSalesReconAmount = (denominationName: string, quantity: number) => {
    const denominationValue = getDenominationValue(denominationName)
    
    // For non-number denominations (COINS, GCASH, etc.), return the quantity itself as the amount
    if (denominationValue === 0 && !['1,000', '500', '200', '100', '50', '20'].includes(denominationName)) {
      return quantity
    }
    
    return denominationValue * quantity
  }

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount
    return `₱${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Get brand-specific order options
  const getOrderOptions = () => {
    const options = predefinedSalesItems
      .filter(item => item.price !== null && item.price !== undefined)
      .map(item => ({
        value: `${item.name} - ${formatCurrency(item.price || 0)}`,
        label: `${item.name} - ${formatCurrency(item.price || 0)}`,
        price: item.price || 0
      }))
    return options
  }

  // Editing functions
  const startEditing = (fieldId: string, currentValue: any) => {
    console.log('startEditing called:', fieldId, 'currentValue:', currentValue, 'isReadOnly:', isReadOnly)
    // Don't allow editing if report is read-only
    if (isReadOnly) {
      console.log('Editing blocked - report is read-only')
      return
    }

    // If we're switching from one field to another, save the previous field to form data
    if (editingField && editingField !== fieldId) {
      // Save the previous field to form data
      updateFormData(editingField, editingValue)
      isSwitchingFields.current = true
    }
    
    setEditingField(fieldId)
    // Use form data if available, otherwise use current value
    const valueToUse = formData[fieldId] !== undefined ? formData[fieldId] : (currentValue?.toString() || '')
    setEditingValue(valueToUse)
    
    // Reset the switching flag after a very short delay
    setTimeout(() => {
      isSwitchingFields.current = false
    }, 50) // Reduced to 50ms for snappier response
  }

  const cancelEditing = () => {
    // Clear any pending debounced saves
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
    }
    setEditingField(null)
    setEditingValue('')
  }

  const debouncedSave = (fieldId: string) => {
    // Clear existing timeout
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
    }
    
    // Set new timeout for debounced save - much shorter delay
    debouncedSaveRef.current = setTimeout(() => {
      // Only save if we're still editing the same field
      if (editingField === fieldId) {
        saveEditing(fieldId)
      }
    }, 50) // Reduced to 50ms for snappier response
  }

  const handleBlur = (fieldId: string) => {
    // If we're switching fields, don't save (the previous field was already saved in startEditing)
    if (isSwitchingFields.current) {
      return
    }
    
    // Save to form data instead of auto-saving to database
    setTimeout(() => {
      // Only save if we're still editing the same field and not switching
      if (editingField === fieldId && !isSwitchingFields.current) {
        updateFormData(fieldId, editingValue)
        setEditingField(null)
        setEditingValue('')
      }
    }, 25) // Reduced to 25ms for much snappier response
  }

  const saveEditingWithValue = async (fieldId: string, value: string) => {
    try {
      console.log('saveEditingWithValue called:', fieldId, 'value:', value)
      // Parse field ID to determine what to update
      let section, itemIndex, field
      
      if (fieldId.startsWith('sales-new-') || fieldId.startsWith('icecream-new-') || 
          fieldId.startsWith('materials-new-') || fieldId.startsWith('discounts-new-') || 
          fieldId.startsWith('expenses-new-') || fieldId.startsWith('salesrecon-new-')) {
        // Format: sales-new-0-beginning_inventory
        const parts = fieldId.split('-')
        section = parts[0]
        itemIndex = `${parts[1]}-${parts[2]}` // "new-0"
        field = parts.slice(3).join('-') // "beginning_inventory"
      } else {
        // Format: sales-uuid-ending_inventory (UUID contains hyphens)
        // Find the last hyphen to separate the field name
        const lastHyphenIndex = fieldId.lastIndexOf('-')
        const beforeLastHyphen = fieldId.substring(0, lastHyphenIndex)
        field = fieldId.substring(lastHyphenIndex + 1) // Everything after last hyphen
        
        // Find the first hyphen to get section
        const firstHyphenIndex = beforeLastHyphen.indexOf('-')
        section = beforeLastHyphen.substring(0, firstHyphenIndex)
        itemIndex = beforeLastHyphen.substring(firstHyphenIndex + 1) // Everything between first and last hyphen
      }
      
      // Determine if this field should be numeric based on the field name
      const isNumericField = ['beginning_inventory', 'arrival', 'pull_out', 'ending_inventory', 'quantity', 'amount', 'order_amount', 'beginning', 'ending'].includes(field)
      
      const processedValue = value === '' ? (isNumericField ? 0 : '') : (isNaN(Number(value)) ? value : Number(value))
      console.log('Processed value:', processedValue, 'isNumericField:', isNumericField)
      
      // Get the table name based on section
      const tableMap: { [key: string]: string } = {
        'sales': 'dsir_sales_inventory',
        'icecream': 'dsir_ice_cream_inventory', 
        'materials': 'dsir_materials_inventory',
        'discounts': 'dsir_discounts',
        'expenses': 'dsir_expenses',
        'salesrecon': 'dsir_sales_reconciliation'
      }
      
      const tableName = tableMap[section]
      if (!tableName) {
        throw new Error(`Unknown section: ${section}`)
      }
      
      console.log('Using table:', tableName)
      
      // Check if this is a new item or existing item
      if (itemIndex.startsWith('new-')) {
        // Create new item
        const itemIndexNum = parseInt(itemIndex.split('-')[1])
        let itemName = ''
        
        if (section === 'sales') {
          itemName = predefinedSalesItems[itemIndexNum]?.name || ''
        } else if (section === 'icecream') {
          itemName = predefinedIceCreamFlavors[itemIndexNum]?.name || ''
        } else if (section === 'materials') {
          itemName = predefinedMaterials[itemIndexNum]?.name || ''
        } else if (section === 'salesrecon') {
          itemName = predefinedDenominations[itemIndexNum]?.name || ''
        }
        
        // Create the insert object based on the table structure
        let insertData: any = {
          dsir_report_id: report.id,
          [field]: processedValue
        }
        
        // For discounts, ensure all required fields are provided
        if (section === 'discounts') {
          insertData.name = insertData.name || ''
          insertData.id_type = insertData.id_type || 'pwd'
          insertData.id_no = insertData.id_no || ''
          insertData.order_amount = insertData.order_amount || 0
        }
        
        // Add the name field based on the table
        if (section === 'sales') {
          insertData.item_name = itemName
        } else if (section === 'icecream') {
          insertData.flavor = itemName
        } else if (section === 'materials') {
          insertData.material_name = itemName
        } else if (section === 'salesrecon') {
          insertData.denomination = itemName
          // For sales reconciliation, compute the amount based on quantity and denomination
          if (field === 'quantity') {
            const computedAmount = getSalesReconAmount(itemName, Number(processedValue) || 0)
            insertData.amount = computedAmount
          }
        } else if (section === 'discounts') {
          // For discounts, handle order_type specially to also set order_amount
          if (field === 'order_type') {
            const selectedOption = getOrderOptions().find(opt => opt.value === value)
            const orderAmount = selectedOption?.price || 0
            console.log('Setting order_amount for insert:', orderAmount, 'selectedOption:', selectedOption, 'value:', value)
            insertData.order_amount = orderAmount
            // discount_amount is a generated column, don't set it manually
          }
        }
        
        console.log('Inserting data:', insertData)
        const { error } = await supabase
          .from(tableName)
          .insert(insertData)

        if (error) throw error
      } else {
        // Update existing item
        let updateData: any = { [field]: processedValue }
        
        // For sales reconciliation, if quantity is updated, also update the computed amount
        if (section === 'salesrecon' && field === 'quantity') {
          const item = salesRecon.find(i => i.id === itemIndex)
          if (item) {
            const computedAmount = getSalesReconAmount(item.denomination || '', Number(processedValue) || 0)
            updateData.amount = computedAmount
          }
        }
        
        // For discounts, handle order_type specially to also set order_amount
        if (section === 'discounts' && field === 'order_type') {
          const selectedOption = getOrderOptions().find(opt => opt.value === value)
          const orderAmount = selectedOption?.price || 0
          console.log('Setting order_amount for update:', orderAmount, 'selectedOption:', selectedOption, 'value:', value)
          updateData.order_amount = orderAmount
          // discount_amount is a generated column, don't set it manually
        }
        
        console.log('Updating data:', updateData)
        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('dsir_report_id', report.id)
          .eq('id', itemIndex)

        if (error) throw error
      }

      // Reload only the specific section that was updated
      if (section === 'discounts') {
        console.log('Reloading discounts after save...')
        await loadDiscounts()
        console.log('Discounts reloaded')
      } else if (section === 'sales') {
        await loadSalesInventory()
      } else if (section === 'icecream') {
        await loadIceCreamInventory()
      } else if (section === 'materials') {
        await loadMaterialsInventory()
      } else if (section === 'expenses') {
        await loadExpenses()
      } else if (section === 'salesrecon') {
        await loadSalesRecon()
      }

      setEditingField(null)
      setEditingValue('')
    } catch (error) {
      console.error('Error saving field:', error)
      alert('Error saving changes. Please try again.')
    }
  }

  const saveEditing = async (fieldId: string) => {
    try {
      // Prevent saving if we're already editing a different field
      if (editingField && editingField !== fieldId) {
        return
      }
      // Parse field ID to determine what to update
      let section, itemIndex, field
      
      if (fieldId.startsWith('header-')) {
        // Format: header-notes
        section = 'header'
        itemIndex = ''
        field = fieldId.substring(7) // Everything after 'header-'
      } else if (fieldId.startsWith('sales-new-') || fieldId.startsWith('icecream-new-') || 
          fieldId.startsWith('materials-new-') || fieldId.startsWith('discounts-new-') || 
          fieldId.startsWith('expenses-new-') || fieldId.startsWith('salesrecon-new-')) {
        // Format: sales-new-0-beginning_inventory
        const parts = fieldId.split('-')
        section = parts[0]
        itemIndex = `${parts[1]}-${parts[2]}` // "new-0"
        field = parts.slice(3).join('-') // "beginning_inventory"
      } else {
        // Format: sales-uuid-ending_inventory (UUID contains hyphens)
        // Find the last hyphen to separate the field name
        const lastHyphenIndex = fieldId.lastIndexOf('-')
        const beforeLastHyphen = fieldId.substring(0, lastHyphenIndex)
        field = fieldId.substring(lastHyphenIndex + 1) // Everything after last hyphen
        
        // Find the first hyphen to get section
        const firstHyphenIndex = beforeLastHyphen.indexOf('-')
        section = beforeLastHyphen.substring(0, firstHyphenIndex)
        itemIndex = beforeLastHyphen.substring(firstHyphenIndex + 1) // Everything between first and last hyphen
      }
      
      if (section === 'header') {
        // Update main report fields
        console.log('Updating header field:', field, 'value:', editingValue)
        const { error } = await supabase
          .from('dsir_reports')
          .update({ [field]: editingValue })
          .eq('id', report.id)

        if (error) {
          console.error('Error updating header field:', error)
          throw error
        }

        console.log('Header field updated successfully')

        // Update local state
        if (onReportUpdate) {
          onReportUpdate({
            ...report,
            [field]: editingValue
          })
        }
      } else {
        // Update section items
        const tableMap: { [key: string]: string } = {
          'sales': 'dsir_sales_inventory',
          'icecream': 'dsir_ice_cream_inventory',
          'materials': 'dsir_materials_inventory',
          'discounts': 'dsir_discounts',
          'expenses': 'dsir_expenses',
          'salesrecon': 'dsir_sales_recon'
        }

        const tableName = tableMap[section]
        if (tableName && itemIndex !== undefined) {
          if (itemIndex.startsWith('new-')) {
            // Create new item - need to get the item name from the predefined items
            const itemIndexNum = parseInt(itemIndex.split('-')[1])
            let itemName = ''
            
            // Get the item name based on the section and index
            if (section === 'sales') {
              itemName = predefinedSalesItems[itemIndexNum]?.name || ''
            } else if (section === 'icecream') {
              itemName = predefinedIceCreamFlavors[itemIndexNum]?.name || ''
            } else if (section === 'materials') {
              itemName = predefinedMaterials[itemIndexNum]?.name || ''
            } else if (section === 'salesrecon') {
              itemName = predefinedDenominations[itemIndexNum]?.name || ''
            }
            
            // Create the insert object based on the table structure
            // Determine if this field should be numeric based on the field name
            const isNumericField = ['beginning_inventory', 'arrival', 'pull_out', 'ending_inventory', 'quantity', 'amount', 'order_amount', 'beginning', 'ending'].includes(field)
            
            let insertData: any = {
              dsir_report_id: report.id,
              [field]: editingValue === '' ? (isNumericField ? 0 : '') : (isNaN(Number(editingValue)) ? editingValue : Number(editingValue))
            }
            
            // For discounts, ensure all required fields are provided
            if (section === 'discounts') {
              insertData.name = insertData.name || ''
              insertData.id_type = insertData.id_type || 'pwd'
              insertData.order_amount = insertData.order_amount || 0
            }
            
            // Add the name field based on the table
            if (section === 'sales') {
              insertData.item_name = itemName
            } else if (section === 'icecream') {
              insertData.flavor = itemName
            } else if (section === 'materials') {
              insertData.material_name = itemName
            } else if (section === 'salesrecon') {
              insertData.denomination = itemName
              // For sales reconciliation, compute the amount based on quantity and denomination
              if (field === 'quantity') {
                const computedAmount = getSalesReconAmount(itemName, Number(editingValue) || 0)
                insertData.amount = computedAmount
              }
            } else if (section === 'discounts') {
              // For discounts, handle order_type specially to also set order_amount
              if (field === 'order_type') {
                const selectedOption = getOrderOptions().find(opt => opt.value === editingValue)
                const orderAmount = selectedOption?.price || 0
                console.log('Setting order_amount for insert:', orderAmount, 'selectedOption:', selectedOption, 'editingValue:', editingValue)
                insertData.order_amount = orderAmount
                // discount_amount is a generated column, don't set it manually
              }
            }
            
            const { error } = await supabase
              .from(tableName)
              .insert(insertData)

            if (error) throw error
          } else {
            // Update existing item
            // Determine if this field should be numeric based on the field name
            const isNumericField = ['beginning_inventory', 'arrival', 'pull_out', 'ending_inventory', 'quantity', 'amount', 'order_amount', 'beginning', 'ending'].includes(field)
            
            let updateData: any = { [field]: editingValue === '' ? (isNumericField ? 0 : '') : (isNaN(Number(editingValue)) ? editingValue : Number(editingValue)) }
            
            // For sales reconciliation, if quantity is updated, also update the computed amount
            if (section === 'salesrecon' && field === 'quantity') {
              const item = salesRecon.find(i => i.id === itemIndex)
              if (item) {
                const computedAmount = getSalesReconAmount(item.denomination || '', Number(editingValue) || 0)
                updateData.amount = computedAmount
              }
            }
            
            // For discounts, handle order_type specially to also set order_amount
            if (section === 'discounts' && field === 'order_type') {
              const selectedOption = getOrderOptions().find(opt => opt.value === editingValue)
              const orderAmount = selectedOption?.price || 0
              console.log('Setting order_amount for update:', orderAmount, 'selectedOption:', selectedOption, 'editingValue:', editingValue)
              updateData.order_amount = orderAmount
              // discount_amount is a generated column, don't set it manually
            }
            
            const { error } = await supabase
              .from(tableName)
              .update(updateData)
              .eq('dsir_report_id', report.id)
              .eq('id', itemIndex)

            if (error) throw error
          }

          // Reload only the specific section that was updated
          if (section === 'discounts') {
            console.log('Reloading discounts after save...')
            await loadDiscounts()
            console.log('Discounts reloaded')
          } else if (section === 'sales') {
            await loadSalesInventory()
          } else if (section === 'icecream') {
            await loadIceCreamInventory()
          } else if (section === 'materials') {
            await loadMaterialsInventory()
          } else if (section === 'expenses') {
            await loadExpenses()
          } else if (section === 'salesrecon') {
            await loadSalesRecon()
          }
        }
      }

      setEditingField(null)
      setEditingValue('')
    } catch (error) {
      console.error('Error saving field:', error)
      alert('Error saving changes. Please try again.')
    }
  }

  // Save editing without clearing the editing state (used when switching fields)
  const saveEditingWithoutClearing = async (fieldId: string) => {
    try {
      // Prevent saving if we're already editing a different field
      if (editingField && editingField !== fieldId) {
        return
      }
      // Parse field ID to determine what to update
      let section, itemIndex, field
      
      if (fieldId.startsWith('header-')) {
        // Format: header-notes
        section = 'header'
        itemIndex = ''
        field = fieldId.substring(7) // Everything after 'header-'
      } else if (fieldId.startsWith('sales-new-') || fieldId.startsWith('icecream-new-') || 
          fieldId.startsWith('materials-new-') || fieldId.startsWith('discounts-new-') || 
          fieldId.startsWith('expenses-new-') || fieldId.startsWith('salesrecon-new-')) {
        // Format: sales-new-0-beginning_inventory
        const parts = fieldId.split('-')
        section = parts[0]
        itemIndex = `${parts[1]}-${parts[2]}` // "new-0"
        field = parts.slice(3).join('-') // "beginning_inventory"
      } else {
        // Format: sales-uuid-ending_inventory (UUID contains hyphens)
        // Find the last hyphen to separate the field name
        const lastHyphenIndex = fieldId.lastIndexOf('-')
        const beforeLastHyphen = fieldId.substring(0, lastHyphenIndex)
        field = fieldId.substring(lastHyphenIndex + 1) // Everything after last hyphen
        
        // Find the first hyphen to get section
        const firstHyphenIndex = beforeLastHyphen.indexOf('-')
        section = beforeLastHyphen.substring(0, firstHyphenIndex)
        itemIndex = beforeLastHyphen.substring(firstHyphenIndex + 1) // Everything between first and last hyphen
      }
      
      if (section === 'header') {
        // Update main report fields
        console.log('Updating header field:', field, 'value:', editingValue)
        const { error } = await supabase
        .from('dsir_reports')
          .update({ [field]: editingValue })
          .eq('id', report.id)

        if (error) {
          console.error('Error updating header field:', error)
          throw error
        }

        console.log('Header field updated successfully')

        // Update local state
        if (onReportUpdate) {
          onReportUpdate({
            ...report,
            [field]: editingValue
          })
        }
      } else {
        // Update section items
        const tableMap: { [key: string]: string } = {
          'sales': 'dsir_sales_inventory',
          'icecream': 'dsir_ice_cream_inventory',
          'materials': 'dsir_materials_inventory',
          'discounts': 'dsir_discounts',
          'expenses': 'dsir_expenses',
          'salesrecon': 'dsir_sales_recon'
        }

        const tableName = tableMap[section]
        if (!tableName) {
          throw new Error(`Unknown section: ${section}`)
        }

        // Determine if this field should be numeric based on the field name
        const isNumericField = ['beginning_inventory', 'arrival', 'pull_out', 'ending_inventory', 'quantity', 'amount', 'order_amount', 'beginning', 'ending'].includes(field)
        
        let processedValue
        if (editingValue === '') {
          if (isNumericField) {
            if (field === 'ending_inventory') {
              // Set ending_inventory to null when empty
              processedValue = null
            } else {
              processedValue = 0
            }
          } else {
            processedValue = ''
          }
        } else {
          processedValue = isNaN(Number(editingValue)) ? editingValue : Number(editingValue)
        }

        // Get the item name for the name field
        let itemName = ''
        if (field === 'name') {
          if (section === 'sales') {
            itemName = predefinedSalesItems[parseInt(itemIndex.replace('new-', ''))]?.name || ''
          } else if (section === 'icecream') {
            itemName = predefinedIceCreamFlavors[parseInt(itemIndex.replace('new-', ''))]?.name || ''
          } else if (section === 'materials') {
            itemName = predefinedMaterials[parseInt(itemIndex.replace('new-', ''))]?.name || ''
          } else if (section === 'salesrecon') {
            itemName = predefinedDenominations[parseInt(itemIndex.replace('new-', ''))]?.name || ''
          }
        }
        
        // Create the insert object based on the table structure
        let insertData: any = {
          dsir_report_id: report.id,
          [field]: processedValue
        }
        
        // For discounts, ensure all required fields are provided
        if (section === 'discounts') {
          insertData.name = insertData.name || ''
          insertData.id_type = insertData.id_type || 'pwd'
          insertData.id_no = insertData.id_no || ''
          insertData.order_amount = insertData.order_amount || 0
        }
        
        // Add the name field based on the table
        if (section === 'sales') {
          insertData.item_name = itemName
        } else if (section === 'icecream') {
          insertData.item_name = itemName
        } else if (section === 'materials') {
          insertData.item_name = itemName
        } else if (section === 'salesrecon') {
          insertData.denomination = itemName
        }

        if (itemIndex.startsWith('new-')) {
          // Insert new item
          const { error } = await supabase
            .from(tableName)
            .insert(insertData)

          if (error) throw error

          // Reload the appropriate section
          if (section === 'sales') {
            await loadSalesInventory()
          } else if (section === 'icecream') {
            await loadIceCreamInventory()
          } else if (section === 'materials') {
            await loadMaterialsInventory()
          } else if (section === 'discounts') {
            await loadDiscounts()
          } else if (section === 'expenses') {
            await loadExpenses()
          } else if (section === 'salesrecon') {
            await loadSalesRecon()
          }
        } else {
          // Update existing item
          const { error } = await supabase
            .from(tableName)
            .update({ [field]: processedValue })
            .eq('dsir_report_id', report.id)
            .eq('id', itemIndex)

          if (error) throw error

          // Reload the appropriate section
          if (section === 'sales') {
            await loadSalesInventory()
          } else if (section === 'icecream') {
            await loadIceCreamInventory()
          } else if (section === 'materials') {
            await loadMaterialsInventory()
          } else if (section === 'discounts') {
            await loadDiscounts()
          } else if (section === 'expenses') {
            await loadExpenses()
          } else if (section === 'salesrecon') {
            await loadSalesRecon()
          }
        }
      }
      // Note: We don't clear editing state here - that's the key difference
    } catch (error) {
      console.error('Error saving field:', error)
      alert('Error saving changes. Please try again.')
    }
  }

  // Form handling functions
  const updateFormData = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }))
    setHasUnsavedChanges(true)
  }

  // Helper function to get display value (form data takes precedence)
  const getDisplayValue = (fieldId: string, originalValue: any) => {
    // If currently editing this field, show the editing value
    if (editingField === fieldId) {
      return editingValue
    }
    // If we have form data for this field, show that
    if (formData[fieldId] !== undefined) {
      return formData[fieldId]
    }
    // Otherwise show the original value (allow 0 to display)
    if (originalValue === null || originalValue === undefined) {
      return ''
    }
    return originalValue.toString()
  }

  const saveDraft = async (showSuccessMessage = true) => {
    if (!report?.id) {
      console.error('Cannot save: No report ID')
      return
    }
    
    setSaving(true)
    try {
      // Verify the report exists before attempting to save
      const { data: reportCheck, error: reportError } = await supabase
        .from('dsir_reports')
        .select('id')
        .eq('id', report.id)
        .single()
      
      if (reportError || !reportCheck) {
        throw new Error('Report not found in database. Please refresh the page and try again.')
      }
      
      console.log('Saving draft with data:', formData)
      
      // Process all form data and save to database
      const headerUpdates: any = {}
      const salesUpdates: any[] = []
      const iceCreamUpdates: any[] = []
      const materialsUpdates: any[] = []
      const discountUpdates: any[] = []
      const expenseUpdates: any[] = []
      const salesReconUpdates: any[] = []
      
      // Process form data by field ID
      Object.entries(formData).forEach(([fieldId, value]) => {
        // Define numeric fields that should convert empty strings to 0
        const numericFields = ['beginning_inventory', 'arrival', 'pull_out', 'ending_inventory', 'quantity', 'amount', 'order_amount', 'beginning', 'ending']
        
        // Process value based on field type
        let processedValue
        if (value === '') {
          if (numericFields.some(field => fieldId.includes(field))) {
            if (fieldId.includes('ending_inventory')) {
              // Set ending_inventory to null when empty
              processedValue = null
            } else {
              processedValue = 0
            }
          } else {
            processedValue = ''
          }
        } else {
          processedValue = isNaN(Number(value)) ? value : Number(value)
        }
        
        if (fieldId.startsWith('header-')) {
          // Header fields
          const field = fieldId.substring(7) // Remove 'header-' prefix
          headerUpdates[field] = processedValue
        } else if (fieldId.startsWith('sales-')) {
          // Sales inventory fields - format: sales-new-0-beginning_inventory or sales-uuid-beginning_inventory
          // Use a more specific regex that handles UUIDs properly
          const match = fieldId.match(/^sales-(.+)-([^-]+)$/)
          if (match) {
            const itemId = match[1] // "new-0" or full UUID
            const field = match[2]  // "beginning_inventory"
            
            // Debug logging
            console.log('Sales field parsing:', { fieldId, itemId, field, value, processedValue })
            
            // Only add to updates if the value is meaningful (not 0, null, or undefined)
            // We still include it for tracking but will validate later
            let item = salesUpdates.find(u => u.itemId === itemId)
            if (!item) {
              item = { itemId, updates: {} }
              salesUpdates.push(item)
            }
            item.updates[field] = processedValue
          }
        } else if (fieldId.startsWith('icecream-')) {
          // Ice cream inventory fields - format: icecream-new-0-beginning_inventory
          const match = fieldId.match(/^icecream-(.+)-([^-]+)$/)
          if (match) {
            const itemId = match[1] // "new-0" or full UUID
            const field = match[2]  // "beginning_inventory"
            
            let item = iceCreamUpdates.find(u => u.itemId === itemId)
            if (!item) {
              item = { itemId, updates: {} }
              iceCreamUpdates.push(item)
            }
            item.updates[field] = processedValue
          }
        } else if (fieldId.startsWith('materials-')) {
          // Materials inventory fields - format: materials-new-0-beginning
          const match = fieldId.match(/^materials-(.+)-([^-]+)$/)
          if (match) {
            const itemId = match[1] // "new-0" or full UUID
            const field = match[2]  // "beginning"
            
            let item = materialsUpdates.find(u => u.itemId === itemId)
            if (!item) {
              item = { itemId, updates: {} }
              materialsUpdates.push(item)
            }
            item.updates[field] = processedValue
          }
        } else if (fieldId.startsWith('discounts-')) {
          // Discount fields - format: discounts-new-0-name
          const match = fieldId.match(/^discounts-(.+)-([^-]+)$/)
          if (match) {
            const itemId = match[1] // "new-0" or full UUID
            const field = match[2]  // "name"
            
            // Check if this discount still exists in the local state
            const discountExists = discounts.some(d => d.id === itemId)
            
            // Only process if this field has been edited (has form data) AND the item still exists
            if (formData[fieldId] !== undefined && discountExists) {
              let item = discountUpdates.find(u => u.itemId === itemId)
              if (!item) {
                item = { itemId, updates: {} }
                discountUpdates.push(item)
              }
              item.updates[field] = processedValue
            }
          }
        } else if (fieldId.startsWith('expenses-')) {
          // Expense fields - format: expenses-new-0-amount
          const match = fieldId.match(/^expenses-(.+)-([^-]+)$/)
          if (match) {
            const itemId = match[1] // "new-0" or full UUID
            const field = match[2]  // "amount"
            
            // Check if this expense still exists in the local state
            const expenseExists = expenses.some(e => e.id === itemId)
            
            // Only process if this field has been edited (has form data) AND the item still exists
            if (formData[fieldId] !== undefined && expenseExists) {
              let item = expenseUpdates.find(u => u.itemId === itemId)
              if (!item) {
                item = { itemId, updates: {} }
                expenseUpdates.push(item)
              }
              item.updates[field] = processedValue
            }
          }
        } else if (fieldId.startsWith('salesrecon-')) {
          // Sales recon fields - format: salesrecon-new-0-quantity
          const match = fieldId.match(/^salesrecon-(.+)-([^-]+)$/)
          if (match) {
            const itemId = match[1] // "new-0" or full UUID
            const field = match[2]  // "quantity"
            
            let item = salesReconUpdates.find(u => u.itemId === itemId)
            if (!item) {
              item = { itemId, updates: {} }
              salesReconUpdates.push(item)
            }
            item.updates[field] = processedValue
          }
        }
      })
      
      // Save header updates
      if (Object.keys(headerUpdates).length > 0) {
        const { error } = await supabase
          .from('dsir_reports')
          .update(headerUpdates)
        .eq('id', report.id)

        if (error) throw error
      }
      
      // Save sales inventory updates
      for (const item of salesUpdates) {
        // For existing records (UUID itemIds), skip hasData validation
        // Any update to an existing record is meaningful (including changing values to 0)
        const isExistingRecord = !item.itemId.startsWith('new-')
        
        if (!isExistingRecord) {
          // Only validate for new records
          // Skip if all fields are empty, null, undefined, or 0
          // EXCEPT: Allow rows where ending_inventory is explicitly 0 (everything sold)
          const hasData = Object.entries(item.updates).some(([key, value]) => {
            if (key === 'ending_inventory') {
              // ending_inventory can be 0 - check if it's explicitly set
              return value !== undefined && value !== null && value !== ''
            }
            return value !== undefined && 
                   value !== null && 
                   value !== '' && 
                   typeof value === 'number' && 
                   value > 0
          })
          
          if (!hasData) {
            console.log('Skipping sales item - no meaningful data (all zeros or empty):', item)
            continue
          }
        }
        
        console.log('Processing sales item:', item)
        if (item.itemId.startsWith('new-')) {
          // Insert new item - extract index from itemId (e.g., "new-0" -> 0)
          const itemIndex = parseInt(item.itemId.replace('new-', ''))
          const itemName = predefinedSalesItems[itemIndex]?.name
          
          // Check if this item already exists for this report to prevent duplicates
          const existingItem = salesInventory.find(i => i.item_name === itemName)
          if (!existingItem) {
            // Filter out zero and null values - only include fields with meaningful data
            // EXCEPT ending_inventory which can be 0 (meaning everything was sold)
            const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
              if (key === 'ending_inventory') {
                // Always include ending_inventory even if it's 0
                if (value !== undefined && value !== null && value !== '') {
                  acc[key] = value
                }
              } else if (value !== undefined && value !== null && value !== '' && value !== 0) {
                acc[key] = value
              }
              return acc
            }, {} as any)
            
            const insertData = {
              dsir_report_id: report.id,
              item_name: itemName,
              ...filteredUpdates
            }
            console.log('Inserting sales data:', insertData)
            console.log('Ending inventory value being inserted:', insertData.ending_inventory, 'Type:', typeof insertData.ending_inventory)
            console.log('All fields in insertData:', Object.keys(insertData))
            const { error } = await supabase
              .from('dsir_sales_inventory')
              .insert(insertData)
            if (error) throw error
          } else {
            // Update existing item instead of inserting duplicate
            // For updates to existing records, allow all values including 0
            // Only filter out undefined, null, and empty string
            const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
              if (value !== undefined && value !== null && value !== '') {
                acc[key] = value
              }
              return acc
            }, {} as any)
            
            console.log('Updating sales item:', existingItem.id, 'with data:', filteredUpdates)
            console.log('Ending inventory value being updated:', filteredUpdates.ending_inventory, 'Type:', typeof filteredUpdates.ending_inventory)
            
            // Only update if there's something to update
            if (Object.keys(filteredUpdates).length > 0) {
              const { error } = await supabase
                .from('dsir_sales_inventory')
                .update(filteredUpdates)
                .eq('id', existingItem.id)
              if (error) throw error
            }
          }
        } else {
          // Update existing item
          // For updates to existing records, allow all values including 0
          // Only filter out undefined, null, and empty string
          const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              acc[key] = value
            }
            return acc
          }, {} as any)
          
          console.log('Updating sales item:', item.itemId, 'with data:', filteredUpdates)
          console.log('Ending inventory value being updated:', filteredUpdates.ending_inventory, 'Type:', typeof filteredUpdates.ending_inventory)
          
          // Only update if there's something to update
          if (Object.keys(filteredUpdates).length > 0) {
            const { error } = await supabase
              .from('dsir_sales_inventory')
              .update(filteredUpdates)
              .eq('id', item.itemId)
            if (error) throw error
          }
        }
      }
      
      // Save ice cream inventory updates
      for (const item of iceCreamUpdates) {
        // For existing records (UUID itemIds), skip hasData validation
        // Any update to an existing record is meaningful (including changing values to 0)
        const isExistingRecord = !item.itemId.startsWith('new-')
        
        if (!isExistingRecord) {
          // Only validate for new records
          // Skip if all fields are empty, null, undefined, or 0
          // EXCEPT: Allow rows where ending is explicitly 0 (all ice cream sold)
          const hasData = Object.entries(item.updates).some(([key, value]) => {
            if (key === 'ending') {
              // ending can be 0 - check if it's explicitly set
              return value !== undefined && value !== null && value !== ''
            }
            return value !== undefined && 
                   value !== null && 
                   value !== '' && 
                   typeof value === 'number' && 
                   value > 0
          })
          
          if (!hasData) {
            console.log('Skipping ice cream item - no meaningful data (all zeros or empty):', item)
            continue
          }
        }
        
        // Always recalculate ending value when any of the components change
        if (item.updates.beginning !== undefined || item.updates.arrival !== undefined || item.updates.pull_out !== undefined) {
          // Get existing values from database or use updated values
          const existingItem = iceCreamInventory.find(i => 
            i.id === item.itemId || 
            (item.itemId.startsWith('new-') && i.flavor === predefinedIceCreamFlavors[parseInt(item.itemId.replace('new-', ''))]?.name)
          )
          
          const beginning = item.updates.beginning !== undefined ? item.updates.beginning : (existingItem?.beginning || 0)
          const arrival = item.updates.arrival !== undefined ? item.updates.arrival : (existingItem?.arrival || 0)
          const pullOut = item.updates.pull_out !== undefined ? item.updates.pull_out : (existingItem?.pull_out || 0)
          
          item.updates.ending = beginning + arrival - pullOut
        }
        
        if (item.itemId.startsWith('new-')) {
          // Insert new item - extract index from itemId (e.g., "new-0" -> 0)
          const itemIndex = parseInt(item.itemId.replace('new-', ''))
          const flavorName = predefinedIceCreamFlavors[itemIndex]?.name
          
          // Check if this flavor already exists for this report to prevent duplicates
          const existingItem = iceCreamInventory.find(i => i.flavor === flavorName)
          if (!existingItem) {
            // Filter out zero and null values
            // EXCEPT ending which can be 0 (meaning all ice cream was sold)
            const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
              if (key === 'ending') {
                // Always include ending even if it's 0
                if (value !== undefined && value !== null && value !== '') {
                  acc[key] = value
                }
              } else if (value !== undefined && value !== null && value !== '' && value !== 0) {
                acc[key] = value
              }
              return acc
            }, {} as any)
            
            const insertData = {
              dsir_report_id: report.id,
              flavor: flavorName,
              ...filteredUpdates
            }
            const { error } = await supabase
              .from('dsir_ice_cream_inventory')
              .insert(insertData)
            if (error) throw error
          } else {
            // Update existing item instead of inserting duplicate
            // For updates to existing records, allow all values including 0
            // Only filter out undefined, null, and empty string
            const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
              if (value !== undefined && value !== null && value !== '') {
                acc[key] = value
              }
              return acc
            }, {} as any)
            
            if (Object.keys(filteredUpdates).length > 0) {
              const { error } = await supabase
                .from('dsir_ice_cream_inventory')
                .update(filteredUpdates)
                .eq('id', existingItem.id)
              if (error) throw error
            }
          }
        } else {
          // For updates to existing records, allow all values including 0
          // Only filter out undefined, null, and empty string
          const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              acc[key] = value
            }
            return acc
          }, {} as any)
          
          if (Object.keys(filteredUpdates).length > 0) {
            const { error } = await supabase
              .from('dsir_ice_cream_inventory')
              .update(filteredUpdates)
              .eq('id', item.itemId)
            if (error) throw error
          }
        }
      }
      
      // Save materials inventory updates
      for (const item of materialsUpdates) {
        // For existing records (UUID itemIds), skip hasData validation
        // Any update to an existing record is meaningful (including changing values to 0)
        const isExistingRecord = !item.itemId.startsWith('new-')
        
        if (!isExistingRecord) {
          // Only validate for new records
          // Skip if all fields are empty, null, undefined, or 0
          // EXCEPT: Allow rows where ending is explicitly 0 (all materials used)
          const hasData = Object.entries(item.updates).some(([key, value]) => {
            if (key === 'ending') {
              // ending can be 0 - check if it's explicitly set
              return value !== undefined && value !== null && value !== ''
            }
            return value !== undefined && 
                   value !== null && 
                   value !== '' && 
                   typeof value === 'number' && 
                   value > 0
          })
          
          if (!hasData) {
            console.log('Skipping materials item - no meaningful data (all zeros or empty):', item)
            continue
          }
        }
        
        // Always recalculate ending value when any of the components change
        if (item.updates.beginning !== undefined || item.updates.arrival !== undefined || item.updates.pull_out !== undefined) {
          // Get existing values from database or use updated values
          const existingItem = materialsInventory.find(i => 
            i.id === item.itemId || 
            (item.itemId.startsWith('new-') && i.material_name === predefinedMaterials[parseInt(item.itemId.replace('new-', ''))]?.name)
          )
          
          const beginning = item.updates.beginning !== undefined ? item.updates.beginning : (existingItem?.beginning || 0)
          const arrival = item.updates.arrival !== undefined ? item.updates.arrival : (existingItem?.arrival || 0)
          const pullOut = item.updates.pull_out !== undefined ? item.updates.pull_out : (existingItem?.pull_out || 0)
          
          item.updates.ending = beginning + arrival - pullOut
        }
        
        if (item.itemId.startsWith('new-')) {
          // Insert new item - extract index from itemId (e.g., "new-0" -> 0)
          const itemIndex = parseInt(item.itemId.replace('new-', ''))
          const materialName = predefinedMaterials[itemIndex]?.name
          
          // Check if this material already exists for this report to prevent duplicates
          const existingItem = materialsInventory.find(i => i.material_name === materialName)
          if (!existingItem) {
            // Filter out zero and null values
            // EXCEPT ending which can be 0 (meaning all materials were used)
            const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
              if (key === 'ending') {
                // Always include ending even if it's 0
                if (value !== undefined && value !== null && value !== '') {
                  acc[key] = value
                }
              } else if (value !== undefined && value !== null && value !== '' && value !== 0) {
                acc[key] = value
              }
              return acc
            }, {} as any)
            
            const insertData = {
              dsir_report_id: report.id,
              material_name: materialName,
              ...filteredUpdates
            }
            const { error } = await supabase
              .from('dsir_materials_inventory')
              .insert(insertData)
            if (error) throw error
          } else {
            // Update existing item instead of inserting duplicate
            // For updates to existing records, allow all values including 0
            // Only filter out undefined, null, and empty string
            const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
              if (value !== undefined && value !== null && value !== '') {
                acc[key] = value
              }
              return acc
            }, {} as any)
            
            if (Object.keys(filteredUpdates).length > 0) {
              const { error } = await supabase
                .from('dsir_materials_inventory')
                .update(filteredUpdates)
                .eq('id', existingItem.id)
              if (error) throw error
            }
          }
        } else {
          // For updates to existing records, allow all values including 0
          // Only filter out undefined, null, and empty string
          const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              acc[key] = value
            }
            return acc
          }, {} as any)
          
          if (Object.keys(filteredUpdates).length > 0) {
            const { error } = await supabase
              .from('dsir_materials_inventory')
              .update(filteredUpdates)
              .eq('id', item.itemId)
            if (error) throw error
          }
        }
      }
      
      // Save discount updates
      for (const item of discountUpdates) {
        // Skip if all fields are empty, null, undefined, or 0
        // For discounts, check if there's any meaningful data (name, id_no, or order_amount > 0)
        const hasData = (
          (item.updates.name && item.updates.name.toString().trim() !== '') ||
          (item.updates.id_no && item.updates.id_no.toString().trim() !== '') ||
          (typeof item.updates.order_amount === 'number' && item.updates.order_amount > 0)
        )
        
        if (!hasData) {
          console.log('Skipping discount item - no meaningful data (all empty or zero):', item)
          continue
        }
        
        if (item.itemId.startsWith('new-')) {
          const insertData = {
            dsir_report_id: report.id,
            name: item.updates.name || '',
            id_type: item.updates.id_type || 'pwd',
            id_no: item.updates.id_no || '',
            order_type: item.updates.order_type || '',
            order_amount: item.updates.order_amount || 0
          }
          console.log('Inserting discount data:', insertData)
          const { error } = await supabase
            .from('dsir_discounts')
            .insert(insertData)
          if (error) throw error
        } else {
          // For updates, ensure required fields are present
          const updateData = {
            ...item.updates,
            name: item.updates.name || '',
            id_type: item.updates.id_type || 'pwd',
            id_no: item.updates.id_no || '',
            order_type: item.updates.order_type || '',
            order_amount: item.updates.order_amount || 0
          }
          console.log('Updating discount data:', updateData)
          const { error } = await supabase
            .from('dsir_discounts')
            .update(updateData)
            .eq('id', item.itemId)
          if (error) throw error
        }
      }
      
      // Save expense updates
      for (const item of expenseUpdates) {
        // Skip if all fields are empty, null, undefined, or 0
        // For expenses, check if there's any meaningful data (expense_type or amount > 0)
        const hasData = (
          (item.updates.expense_type && item.updates.expense_type.toString().trim() !== '') ||
          (typeof item.updates.amount === 'number' && item.updates.amount > 0)
        )
        
        if (!hasData) {
          console.log('Skipping expense item - no meaningful data (all empty or zero):', item)
          continue
        }
        
        if (item.itemId.startsWith('new-')) {
          const insertData = {
            dsir_report_id: report.id,
            ...item.updates
          }
          const { error } = await supabase
            .from('dsir_expenses')
            .insert(insertData)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('dsir_expenses')
            .update(item.updates)
            .eq('id', item.itemId)
          if (error) throw error
        }
      }
      
      // Save sales recon updates
      for (const item of salesReconUpdates) {
        // For existing records (UUID itemIds), skip hasData validation
        // Any update to an existing record is meaningful (including changing values to 0)
        const isExistingRecord = !item.itemId.startsWith('new-')
        
        if (!isExistingRecord) {
          // Only validate for new records
          // Skip if all fields are empty, null, undefined, or 0
          const hasData = Object.values(item.updates).some(value => 
            value !== undefined && 
            value !== null && 
            value !== '' && 
            typeof value === 'number' && 
            value > 0
          )
          
          if (!hasData) {
            console.log('Skipping sales recon item - no meaningful data (all zeros or empty):', item)
            continue
          }
        }
        
        if (item.itemId.startsWith('new-')) {
          // Get the denomination name from the predefined denominations array
          const itemIndex = parseInt(item.itemId.replace('new-', ''))
          const denominationName = predefinedDenominations[itemIndex]?.name || ''
          
          // Check if this denomination already exists for this report to prevent duplicates
          const existingItem = salesRecon.find(i => i.denomination === denominationName)
          if (!existingItem) {
            // Filter out zero and null values
            const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
              if (value !== undefined && value !== null && value !== '' && value !== 0) {
                acc[key] = value
              }
              return acc
            }, {} as any)
            
            const insertData = {
              dsir_report_id: report.id,
              denomination: denominationName,
              ...filteredUpdates
            }
            const { error } = await supabase
              .from('dsir_sales_recon')
              .insert(insertData)
            if (error) throw error
          } else {
            // Update existing item instead of inserting duplicate
            // For updates to existing records, allow all values including 0
            // Only filter out undefined, null, and empty string
            const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
              if (value !== undefined && value !== null && value !== '') {
                acc[key] = value
              }
              return acc
            }, {} as any)
            
            if (Object.keys(filteredUpdates).length > 0) {
              const { error } = await supabase
                .from('dsir_sales_recon')
                .update(filteredUpdates)
                .eq('id', existingItem.id)
              if (error) throw error
            }
          }
        } else {
          // For updates to existing records, allow all values including 0
          // Only filter out undefined, null, and empty string
          const filteredUpdates = Object.entries(item.updates).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              acc[key] = value
            }
            return acc
          }, {} as any)
          
          if (Object.keys(filteredUpdates).length > 0) {
            const { error } = await supabase
              .from('dsir_sales_recon')
              .update(filteredUpdates)
              .eq('id', item.itemId)
            if (error) throw error
          }
        }
      }
      
      // Reload all data to reflect changes
      await loadReportData()
      
      setHasUnsavedChanges(false)
      if (showSuccessMessage) {
        alert('Draft saved successfully!')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Error saving draft. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const submitReport = async () => {
    if (!report?.id) return
    
    setSubmitting(true)
    try {
      // First save the draft (without showing success message)
      await saveDraft(false)
      
      // Calculate final values
      const grossSales = getGrossSales()
      const totalDiscounts = getTotalDiscounts()
      const totalExpenses = getTotalExpenses()
      const netSales = getNetSales()
      const totalCash = getTotalCash()
      const discrepancy = getDiscrepancy()
      
      // Calculate product-specific sales
      const bigCupSales = getBigCupSales()
      const smallCupSales = getSmallCupSales()
      const waterSales = getWaterSales()
      const ml500Sales = get500MLSales()
      const chocoCoatedSales = getChocoCoatedSales()
      
      // Then submit the report with calculated values
      const { error } = await supabase
        .from('dsir_reports')
        .update({
          status: 'submitted',
          gross_sales: grossSales,
          total_discounts: totalDiscounts,
          total_expenses: totalExpenses,
          net_sales: netSales,
          total_cash: totalCash,
          discrepancy: discrepancy,
          big_cup_sales: bigCupSales,
          small_cup_sales: smallCupSales,
          water_sales: waterSales,
          ml_500_sales: ml500Sales,
          choco_coated_sales: chocoCoatedSales
        })
        .eq('id', report.id)

      if (error) throw error

      // Update local state
      if (onReportUpdate) {
        onReportUpdate({
          ...report,
          status: 'submitted',
          gross_sales: grossSales,
          total_discounts: totalDiscounts,
          total_expenses: totalExpenses,
          net_sales: netSales,
          total_cash: totalCash,
          discrepancy: discrepancy,
          big_cup_sales: bigCupSales,
          small_cup_sales: smallCupSales,
          water_sales: waterSales,
          ml_500_sales: ml500Sales,
          choco_coated_sales: chocoCoatedSales
        })
      }

        if (onReportSubmitted) {
          onReportSubmitted()
        }

      alert('Report submitted successfully!')
    } catch (error) {
      console.error('Error submitting report:', error)
      alert('Error submitting report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalCash = salesRecon.reduce((sum, item) => sum + (item.amount || 0), 0)
  const totalDiscounts = discounts.reduce((sum, item) => sum + (item.discount_amount || 0), 0)
  const totalExpenses = expenses.reduce((sum, item) => sum + (item.amount || 0), 0)


  if (loading || !report) {
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
    <div className="bg-white px-1 py-1 sm:p-4 md:p-6 lg:p-8 max-w-full mx-auto">
      <style jsx>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      {/* Read-Only Banner */}
      {isReadOnly && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Read-Only Mode:</strong> This report has been {report?.status === 'submitted' ? 'submitted' : 'reviewed'} and cannot be edited.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-4 sm:mb-8">
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-black mb-2 leading-tight">DAILY SALES & INVENTORY REPORT</h1>
        <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 mb-3 sm:mb-4 md:mb-6 leading-tight">
          {report?.location?.brand?.name} • {report?.location?.name}
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <div className="text-left">
            <div className="text-xs sm:text-sm font-semibold text-black">DATE:</div>
            <div className="border-b border-black h-5 sm:h-6 flex items-center justify-center text-xs sm:text-sm">
              {report.report_date ? new Date(report.report_date).toLocaleDateString() : ''}
            </div>
        </div>
          <div className="text-left">
            <div className="text-xs sm:text-sm font-semibold text-black">INITIAL:</div>
            {editingField === 'header-initial' ? (
              <input
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={() => handleBlur('header-initial')}
                onKeyPress={(e) => e.key === 'Enter' && saveEditing('header-initial')}
                className="w-full border-b border-black h-5 sm:h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs sm:text-sm"
                style={{minWidth: 0, maxWidth: '100%', boxSizing: 'border-box'}}
                autoFocus
                ref={inputRef}
              />
            ) : (
              <div 
                className={`border-b border-black h-5 sm:h-6 flex items-center justify-center text-xs sm:text-sm ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-100'}`}
                onClick={(e) => handleCellClick(e, 'header-initial', report?.initial)}
              >
                {report?.initial || ''}
              </div>
            )}
      </div>
          <div className="text-left">
            <div className="text-xs sm:text-sm font-semibold text-black">STORE HRS:</div>
            {editingField === 'header-store_hours' ? (
              <input
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={() => handleBlur('header-store_hours')}
                onKeyPress={(e) => e.key === 'Enter' && saveEditing('header-store_hours')}
                className="w-full border-b border-black h-5 sm:h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs sm:text-sm"
                style={{minWidth: 0, maxWidth: '100%', boxSizing: 'border-box'}}
                autoFocus
                ref={inputRef}
              />
            ) : (
              <div 
                className={`border-b border-black h-5 sm:h-6 flex items-center justify-center text-xs sm:text-sm ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-100'}`}
                onClick={(e) => handleCellClick(e, 'header-store_hours', report?.store_hours)}
              >
                {report?.store_hours || ''}
          </div>
            )}
          </div>
          <div className="text-left">
            <div className="text-xs sm:text-sm font-semibold text-black">STAFF:</div>
            <div className="border-b border-black h-5 sm:h-6 flex items-center justify-center text-xs sm:text-sm">{currentStaffName || report?.staff_name || ''}</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sales Inventory - Full Width on Desktop */}
        <div className="lg:col-span-12 space-y-4">
          {/* Section A: Sales Inventory */}
          <div className="border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black">
              <span className="font-bold text-sm">A. SALES INVENTORY</span>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[800px]" style={{tableLayout: 'fixed'}}>
                <thead>
                  <tr className="border-b border-black">
                    <th className="border-r border-black px-1 py-1 text-left font-semibold sticky left-0 bg-gray-50 z-10 w-24 break-words">ITEM</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-12">BEG INV</th>
                    {showSalesDiff && (
                      <th className="border-r border-black px-1 py-1 text-center font-semibold w-10">DIFF</th>
                    )}
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-12">ARRIVAL</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-12">PULL-OUT</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-12">NEW INV</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-12">END INV</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-14">SOLD</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-14">PRICE</th>
                    <th className="px-1 py-1 text-center font-semibold w-14">SALES</th>
                </tr>
              </thead>
                <tbody>
                  {predefinedSalesItems.map((itemObj, itemIndex) => {
                    const item = salesInventory.find(i => i.item_name === itemObj.name)
                    const itemId = item?.id || `new-${itemIndex}`
                    
                    return (
                    <tr key={itemObj.name} className="border-b border-gray-300">
                        <td className="border-r border-black px-1 py-1 sticky left-0 bg-white z-10 w-24 break-words">{itemObj.name}</td>
                        <td className="border-r border-black px-1 py-1 text-center w-12">
                          {editingField === `sales-${itemId}-beginning_inventory` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`sales-${itemId}-beginning_inventory`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`sales-${itemId}-beginning_inventory`)}
                              onKeyDown={(e) => handleKeyDown(`sales-${itemId}-beginning_inventory`, e)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(salesInventory, itemObj.name, 'beginning_inventory')
                                  handleCellClick(e, `sales-${itemId}-beginning_inventory`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`sales-${itemId}-beginning_inventory`, getItemValue(salesInventory, itemObj.name, 'beginning_inventory'))}
                              </div>
                          )}
                        </td>
                        {showSalesDiff && (
                          <td className="border-r border-black px-1 py-1 text-center w-10">
                            <div className="text-xs">
                              {(() => {
                                const discrepancy = getInventoryDiscrepancy('sales', itemObj.name)
                                const color = getInventoryDiscrepancyColor(discrepancy)
                                return discrepancy !== 0 ? (
                                  <span className={color}>
                                    {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )
                              })()}
                            </div>
                          </td>
                        )}
                        <td className="border-r border-black px-1 py-1 text-center w-12">
                          {editingField === `sales-${itemId}-arrival` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`sales-${itemId}-arrival`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`sales-${itemId}-arrival`)}
                              onKeyDown={(e) => handleKeyDown(`sales-${itemId}-arrival`, e)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(salesInventory, itemObj.name, 'arrival')
                                  handleCellClick(e, `sales-${itemId}-arrival`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`sales-${itemId}-arrival`, getItemValue(salesInventory, itemObj.name, 'arrival'))}
                              </div>
                          )}
                        </td>
                        <td className="border-r border-black px-1 py-1 text-center w-12">
                          {editingField === `sales-${itemId}-pull_out` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`sales-${itemId}-pull_out`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`sales-${itemId}-pull_out`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(salesInventory, itemObj.name, 'pull_out')
                                  handleCellClick(e, `sales-${itemId}-pull_out`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`sales-${itemId}-pull_out`, getItemValue(salesInventory, itemObj.name, 'pull_out'))}
                              </div>
                          )}
                        </td>
                          <td className="border-r border-black px-1 py-1 text-center w-12 bg-gray-200">
                            <div className={`text-center font-medium ${getNewInventory(item, itemId) < 0 ? 'text-red-600' : ''}`}>
                              {getNewInventory(item, itemId)}
                          </div>
                        </td>
                        <td className="border-r border-black px-1 py-1 text-center w-12">
                          {editingField === `sales-${itemId}-ending_inventory` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`sales-${itemId}-ending_inventory`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`sales-${itemId}-ending_inventory`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(salesInventory, itemObj.name, 'ending_inventory')
                                  handleCellClick(e, `sales-${itemId}-ending_inventory`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`sales-${itemId}-ending_inventory`, getItemValue(salesInventory, itemObj.name, 'ending_inventory'))}
                              </div>
                          )}
                        </td>
                          <td className="border-r border-black px-1 py-1 text-center w-14 bg-gray-200">
                            <div className={`text-center font-medium ${getSold(item, itemId) < 0 ? 'text-red-600' : ''}`}>
                              {getSold(item, itemId)}
                          </div>
                        </td>
                        <td className="border-r border-black px-1 py-1 text-center w-14 bg-gray-50">
                          <div className="text-center">
                            {formatCurrency(itemObj.price || 0)}
                          </div>
                        </td>
                        <td className="px-1 py-1 text-center w-14 bg-gray-200">
                          <div className={`text-center font-medium ${(() => {
                            const salesValue = getSales(item, itemId, itemObj.price);
                            return salesValue !== '' && typeof salesValue === 'number' && salesValue < 0 ? 'text-red-600' : '';
                          })()}`}>
                            {getSales(item, itemId, itemObj.price) === '' ? '' : formatCurrency(getSales(item, itemId, itemObj.price))}
                          </div>
                        </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
                      </div>

        {/* Sales Summary - Mobile View (hidden on desktop) */}
        <div className="lg:hidden">
          <div className="border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black">
              <span className="font-bold text-sm">SALES SUMMARY</span>
                    </div>
            <div className="p-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-semibold">GROSS SALES</span>
                <div className={`border-b border-black w-32 text-center ${getGrossSales() < 0 ? 'text-red-600' : ''}`}>{formatCurrency(getGrossSales())}</div>
                    </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">LESS: DISCOUNTS</span>
                <div className="border-b border-black w-32 text-center">{formatCurrency(getTotalDiscounts())}</div>
                    </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">LESS: EXPENSES</span>
                <div className="border-b border-black w-32 text-center">{formatCurrency(getTotalExpenses())}</div>
                    </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">NET SALES</span>
                <div className={`border-b border-black w-32 text-center ${getNetSales() < 0 ? 'text-red-600' : ''}`}>{formatCurrency(getNetSales())}</div>
                    </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout for Other Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-4">
          {/* Section B: Ice Cream Inventory */}
          <div className="border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black">
              <span className="font-bold text-sm">B. ICE CREAM INVENTORY</span>
                      </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{tableLayout: 'fixed'}}>
                <thead>
                  <tr className="border-b border-black">
                    <th className="border-r border-black px-1 py-1 text-left font-semibold sticky left-0 bg-gray-50 z-10 w-28 break-words">FLAVOR</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-10">BEG</th>
                    {showIceCreamDiff && (
                      <th className="border-r border-black px-1 py-1 text-center font-semibold w-8">DIFF</th>
                    )}
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-10">(+)</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-10">(-)</th>
                    <th className="px-1 py-1 text-center font-semibold w-10">END</th>
                  </tr>
                </thead>
                <tbody>
                  {predefinedIceCreamFlavors.map((flavorObj, flavorIndex) => {
                    const item = iceCreamInventory.find(i => i.flavor === flavorObj.name)
                    const itemId = item?.id || `new-${flavorIndex}`
                    
                    return (
                    <tr key={flavorObj.name} className="border-b border-gray-300">
                        <td className="border-r border-black px-1 py-1 sticky left-0 bg-white z-10 w-28 break-words">{flavorObj.name}</td>
                        <td className="border-r border-black px-1 py-1 text-center w-10">
                          {editingField === `icecream-${itemId}-beginning` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`icecream-${itemId}-beginning`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`icecream-${itemId}-beginning`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(iceCreamInventory, flavorObj.name, 'beginning')
                                  handleCellClick(e, `icecream-${itemId}-beginning`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`icecream-${itemId}-beginning`, getItemValue(iceCreamInventory, flavorObj.name, 'beginning'))}
                              </div>
                          )}
                        </td>
                        {showIceCreamDiff && (
                          <td className="border-r border-black px-1 py-1 text-center w-8">
                            <div className="text-xs">
                              {(() => {
                                const discrepancy = getInventoryDiscrepancy('icecream', flavorObj.name)
                                const color = getInventoryDiscrepancyColor(discrepancy)
                                return discrepancy !== 0 ? (
                                  <span className={color}>
                                    {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )
                              })()}
                            </div>
                          </td>
                        )}
                        <td className="border-r border-black px-1 py-1 text-center w-10">
                          {editingField === `icecream-${itemId}-arrival` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`icecream-${itemId}-arrival`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`icecream-${itemId}-arrival`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(iceCreamInventory, flavorObj.name, 'arrival')
                                  handleCellClick(e, `icecream-${itemId}-arrival`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`icecream-${itemId}-arrival`, getItemValue(iceCreamInventory, flavorObj.name, 'arrival'))}
                              </div>
                          )}
                        </td>
                        <td className="border-r border-black px-1 py-1 text-center w-10">
                          {editingField === `icecream-${itemId}-pull_out` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`icecream-${itemId}-pull_out`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`icecream-${itemId}-pull_out`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(iceCreamInventory, flavorObj.name, 'pull_out')
                                  handleCellClick(e, `icecream-${itemId}-pull_out`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`icecream-${itemId}-pull_out`, getItemValue(iceCreamInventory, flavorObj.name, 'pull_out'))}
                              </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center w-10 bg-gray-200">
                          <div className="text-center font-medium">
                            {(() => {
                              const beg = parseInt(getDisplayValue(`icecream-${itemId}-beginning`, getItemValue(iceCreamInventory, flavorObj.name, 'beginning')) || '0') || 0
                              const arrival = parseInt(getDisplayValue(`icecream-${itemId}-arrival`, getItemValue(iceCreamInventory, flavorObj.name, 'arrival')) || '0') || 0
                              const pullOut = parseInt(getDisplayValue(`icecream-${itemId}-pull_out`, getItemValue(iceCreamInventory, flavorObj.name, 'pull_out')) || '0') || 0
                              const calculatedEnd = beg + arrival - pullOut
                              // Show 0 or positive values, hide only if all inputs are empty/0
                              if (beg === 0 && arrival === 0 && pullOut === 0) return ''
                              return <span className={calculatedEnd < 0 ? 'text-red-600' : ''}>{calculatedEnd}</span>
                            })()}
                              </div>
                        </td>
                  </tr>
                    )
                  })}
                  <tr className="border-t-2 border-black font-semibold">
                    <td className="border-r border-black px-1 py-1 text-right bg-gray-50">TOTAL INVENTORY</td>
                    <td className="border-r border-black px-1 py-1 text-center bg-gray-50"></td>
                    <td className="border-r border-black px-1 py-1 text-center bg-gray-50"></td>
                    <td className="border-r border-black px-1 py-1 text-center bg-gray-50"></td>
                    <td className="px-1 py-1 text-center bg-gray-50">{getTotalInventory()}</td>
                  </tr>
              </tbody>
            </table>
          </div>
      </div>

          {/* Section C: Materials/Supplies Inventory */}
          <div className="border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black">
              <span className="font-bold text-sm">C. MATERIAL/SUPPLIES INVENTORY</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{tableLayout: 'fixed'}}>
                <thead>
                  <tr className="border-b border-black">
                    <th className="border-r border-black px-1 py-1 text-left font-semibold sticky left-0 bg-gray-50 z-10 w-32 break-words">ITEM</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-10">BEG</th>
                    {showMaterialsDiff && (
                      <th className="border-r border-black px-1 py-1 text-center font-semibold w-8">DIFF</th>
                    )}
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-10">(+)</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-10">(-)</th>
                    <th className="px-1 py-1 text-center font-semibold w-10 bg-gray-200">END</th>
                  </tr>
                </thead>
                <tbody>
                  {predefinedMaterials.map((materialObj, materialIndex) => {
                    const item = materialsInventory.find(i => i.material_name === materialObj.name)
                    const itemId = item?.id || `new-${materialIndex}`
                    
                    return (
                    <tr key={materialObj.name} className="border-b border-gray-300">
                        <td className="border-r border-black px-1 py-1 sticky left-0 bg-white z-10 w-32 break-words">{materialObj.name}</td>
                        <td className="border-r border-black px-1 py-1 text-center w-10">
                          {editingField === `materials-${itemId}-beginning` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`materials-${itemId}-beginning`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`materials-${itemId}-beginning`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(materialsInventory, materialObj.name, 'beginning')
                                  handleCellClick(e, `materials-${itemId}-beginning`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`materials-${itemId}-beginning`, getItemValue(materialsInventory, materialObj.name, 'beginning'))}
                              </div>
                          )}
                        </td>
                        {showMaterialsDiff && (
                          <td className="border-r border-black px-1 py-1 text-center w-8">
                            <div className="text-xs">
                              {(() => {
                                const discrepancy = getInventoryDiscrepancy('materials', materialObj.name)
                                const color = getInventoryDiscrepancyColor(discrepancy)
                                return discrepancy !== 0 ? (
                                  <span className={color}>
                                    {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )
                              })()}
                            </div>
                          </td>
                        )}
                        <td className="border-r border-black px-1 py-1 text-center w-10">
                          {editingField === `materials-${itemId}-arrival` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`materials-${itemId}-arrival`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`materials-${itemId}-arrival`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(materialsInventory, materialObj.name, 'arrival')
                                  handleCellClick(e, `materials-${itemId}-arrival`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`materials-${itemId}-arrival`, getItemValue(materialsInventory, materialObj.name, 'arrival'))}
                              </div>
                          )}
                        </td>
                        <td className="border-r border-black px-1 py-1 text-center w-10">
                          {editingField === `materials-${itemId}-pull_out` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`materials-${itemId}-pull_out`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`materials-${itemId}-pull_out`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                              <div 
                                className={getCellClassName()}
                                onClick={(e) => {
                                  const currentValue = getItemValueForEditing(materialsInventory, materialObj.name, 'pull_out')
                                  handleCellClick(e, `materials-${itemId}-pull_out`, currentValue || '')
                                }}
                                style={{minHeight: '24px'}}
                              >
                                {getDisplayValue(`materials-${itemId}-pull_out`, getItemValue(materialsInventory, materialObj.name, 'pull_out'))}
                              </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center w-10 bg-gray-200">
                          <div className="text-center font-medium">
                            {(() => {
                              const beg = parseInt(getDisplayValue(`materials-${itemId}-beginning`, getItemValue(materialsInventory, materialObj.name, 'beginning')) || '0') || 0
                              const arrival = parseInt(getDisplayValue(`materials-${itemId}-arrival`, getItemValue(materialsInventory, materialObj.name, 'arrival')) || '0') || 0
                              const pullOut = parseInt(getDisplayValue(`materials-${itemId}-pull_out`, getItemValue(materialsInventory, materialObj.name, 'pull_out')) || '0') || 0
                              const calculatedEnd = beg + arrival - pullOut
                              // Show 0 or positive/negative values, hide only if all inputs are empty/0
                              if (beg === 0 && arrival === 0 && pullOut === 0) return ''
                              return <span className={calculatedEnd < 0 ? 'text-red-600' : ''}>{calculatedEnd}</span>
                            })()}
                          </div>
                        </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
                </div>
              </div>

          {/* Section D: Discounts */}
          <div className="border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black flex justify-between items-center">
              <span className="font-bold text-sm">D. DISCOUNTS</span>
              {!isReadOnly && (
                <button
                  onClick={addNewDiscountRow}
                  className="text-xs bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-800"
                >
                  + Add Discount
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{tableLayout: 'fixed'}}>
                <thead>
                  <tr className="border-b border-black">
                    <th className="border-r border-black px-1 py-1 text-left font-semibold sticky left-0 bg-gray-50 z-10 w-32 break-words">NAME</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-16">ID TYPE</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-16">ID NO.</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-16">ORDER</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-20">DISC AMT</th>
                    <th className="px-1 py-1 text-center font-semibold w-12">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                        No discount entries yet. Click 'Add Discount' to add one.
                      </td>
                    </tr>
                  ) : (
                    discounts.map((discount, index) => {
                      const itemId = discount?.id || `new-${index}`
                    
                    return (
                    <tr key={index} className="border-b border-gray-300">
                        <td className="border-r border-black px-1 py-1 sticky left-0 bg-white z-10 w-20 break-words">
                          {editingField === `discounts-${itemId}-name` && !isReadOnly ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => handleBlur(`discounts-${itemId}-name`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`discounts-${itemId}-name`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                            <div 
                              className={getCellClassName()}
                              onClick={(e) => handleCellClick(e, `discounts-${itemId}-name`, getDiscountValue(index, 'name'))}
                              style={{minHeight: '24px'}}
                            >
                              {getDisplayValue(`discounts-${itemId}-name`, getDiscountValue(index, 'name')) || ''}
                            </div>
                          )}
                        </td>
                        <td className="border-r border-black px-1 py-1 text-center w-16">
                          {editingField === `discounts-${itemId}-id_type` && !isReadOnly ? (
                            <select
                              value={editingValue}
                              onChange={(e) => {
                                setEditingValue(e.target.value)
                                updateFormData(`discounts-${itemId}-id_type`, e.target.value)
                              }}
                              onBlur={() => handleBlur(`discounts-${itemId}-id_type`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{minWidth: 0, maxWidth: '100%', boxSizing: 'border-box'}}
                              autoFocus
                              ref={selectRef}
                            >
                              <option value="">Select</option>
                              <option value="pwd">PWD</option>
                              <option value="senior">Senior</option>
                            </select>
                          ) : (
                            <div 
                              className={getCellClassName()}
                              onClick={(e) => handleCellClick(e, `discounts-${itemId}-id_type`, getDiscountValue(index, 'id_type'))}
                              style={{minHeight: '24px'}}
                            >
                              {getDisplayValue(`discounts-${itemId}-id_type`, getDiscountValue(index, 'id_type')) || ''}
                            </div>
                          )}
                        </td>
                        <td className="border-r border-black px-1 py-1 text-center w-16">
                          {editingField === `discounts-${itemId}-id_no` && !isReadOnly ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => handleBlur(`discounts-${itemId}-id_no`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`discounts-${itemId}-id_no`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{minWidth: 0, maxWidth: '100%', boxSizing: 'border-box'}}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                            <div 
                              className={getCellClassName()}
                              onClick={(e) => handleCellClick(e, `discounts-${itemId}-id_no`, getDiscountValue(index, 'id_no'))}
                              style={{minHeight: '24px'}}
                            >
                              {getDisplayValue(`discounts-${itemId}-id_no`, getDiscountValue(index, 'id_no')) || ''}
                            </div>
                          )}
                        </td>
                        <td className="border-r border-black px-1 py-1 text-center w-16">
                          {editingField === `discounts-${itemId}-order_type` && !isReadOnly ? (
                            <select
                              value={editingValue}
                              onChange={(e) => {
                                const selectedValue = e.target.value
                                console.log('Order dropdown onChange triggered:', selectedValue)
                                setEditingValue(selectedValue)
                                // Update form data instead of saving directly
                                updateFormData(`discounts-${itemId}-order_type`, selectedValue)
                                
                                // Also update order_amount based on selected option
                                const selectedOption = getOrderOptions().find(opt => opt.value === selectedValue)
                                if (selectedOption) {
                                  updateFormData(`discounts-${itemId}-order_amount`, selectedOption.price)
                                }
                              }}
                              onBlur={() => handleBlur(`discounts-${itemId}-order_type`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{minWidth: 0, maxWidth: '100%', boxSizing: 'border-box'}}
                              autoFocus
                              ref={selectRef}
                            >
                              <option value="">Select</option>
                              {getOrderOptions().map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          ) : (
                            <div 
                              className={getCellClassName()}
                              onClick={(e) => handleCellClick(e, `discounts-${itemId}-order_type`, getDiscountValue(index, 'order_type'))}
                            >
                              {getDisplayValue(`discounts-${itemId}-order_type`, getDiscountValue(index, 'order_type')) || ''}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center w-20 bg-gray-50">
                          <div className="text-center">
                            {(() => {
                              // Get order amount from form data or discount data
                              const orderAmount = getDisplayValue(`discounts-${itemId}-order_amount`, getDiscountValue(index, 'order_amount')) || 0
                              const discountAmount = Number(orderAmount) * 0.2
                              return formatCurrency(discountAmount)
                            })()}
                          </div>
                        </td>
                        <td className="px-1 py-1 text-center w-12">
                          {isReadOnly ? (
                            <span className="text-gray-400 text-xs">-</span>
                          ) : discount.id && discount.id !== 'new-0' ? (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                deleteDiscount(discount.id)
                              }}
                              className="text-red-600 hover:text-red-800 text-xs px-1 py-1"
                              title="Delete discount"
                            >
                              ✕
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                      )
                    })
                  )}
                  <tr className="border-t-2 border-black font-semibold">
                    <td colSpan={4} className="border-r border-black px-1 py-1 text-right">TOTAL DISCOUNT</td>
                    <td className="px-1 py-1 text-center">{formatCurrency(getTotalDiscounts())}</td>
                  </tr>
                </tbody>
              </table>
                  </div>
                  </div>
                </div>

        {/* Right Column */}
          <div className="lg:col-span-5 space-y-4">
          {/* Sales Summary - Desktop View (hidden on mobile) */}
          <div className="hidden lg:block border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black">
              <span className="font-bold text-sm">SALES SUMMARY</span>
                    </div>
            <div className="p-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-semibold">GROSS SALES</span>
                <div className={`border-b border-black w-32 text-center ${getGrossSales() < 0 ? 'text-red-600' : ''}`}>{formatCurrency(getGrossSales())}</div>
                    </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">LESS: DISCOUNTS</span>
                <div className="border-b border-black w-32 text-center">{formatCurrency(getTotalDiscounts())}</div>
                    </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">LESS: EXPENSES</span>
                <div className="border-b border-black w-32 text-center">{formatCurrency(getTotalExpenses())}</div>
                    </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">NET SALES</span>
                <div className={`border-b border-black w-32 text-center ${getNetSales() < 0 ? 'text-red-600' : ''}`}>{formatCurrency(getNetSales())}</div>
                    </div>
            </div>
          </div>

          {/* Section E: Expenses */}
          <div className="border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black flex justify-between items-center">
              <span className="font-bold text-sm">E. EXPENSES</span>
              {!isReadOnly && (
                <button
                  onClick={addNewExpenseRow}
                  className="text-xs bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-800"
                >
                  + Add Expense
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{tableLayout: 'fixed'}}>
                <thead>
                  <tr className="border-b border-black">
                    <th className="border-r border-black px-1 py-1 text-left font-semibold sticky left-0 bg-gray-50 z-10 w-32 break-words">PARTICULARS</th>
                    <th className="px-1 py-1 text-center font-semibold w-16">AMOUNT</th>
                    <th className="px-1 py-1 text-center font-semibold w-12">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-gray-500">
                        No expense entries yet. Click 'Add Expense' to add one.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense, index) => {
                    const itemId = expense?.id || `new-${index}`
                    
                    return (
                    <tr key={index} className="border-b border-gray-300">
                        <td className="border-r border-black px-1 py-1 sticky left-0 bg-white z-10 w-32 break-words">
                          {editingField === `expenses-${itemId}-expense_type` && !isReadOnly ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => handleBlur(`expenses-${itemId}-expense_type`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`expenses-${itemId}-expense_type`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                            <div 
                              className={getCellClassName()}
                              onClick={(e) => handleCellClick(e, `expenses-${itemId}-expense_type`, getExpenseValue(index, 'expense_type'))}
                              style={{minHeight: '24px'}}
                            >
                              {getDisplayValue(`expenses-${itemId}-expense_type`, getExpenseValue(index, 'expense_type')) || ''}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center w-16">
                          {editingField === `expenses-${itemId}-amount` && !isReadOnly ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseFloat(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`expenses-${itemId}-amount`)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditing(`expenses-${itemId}-amount`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                            <div 
                              className={getCellClassName()}
                              onClick={(e) => handleCellClick(e, `expenses-${itemId}-amount`, getExpenseValue(index, 'amount'))}
                              style={{minHeight: '24px'}}
                            >
                              {getDisplayValue(`expenses-${itemId}-amount`, getExpenseValue(index, 'amount')) ? formatCurrency(getDisplayValue(`expenses-${itemId}-amount`, getExpenseValue(index, 'amount'))) : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center w-12">
                          {isReadOnly ? (
                            <span className="text-gray-400 text-xs">-</span>
                          ) : expense.id && expense.id !== 'new-0' ? (
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="text-red-600 hover:text-red-800 text-xs px-1 py-1"
                              title="Delete expense"
                            >
                              ✕
                            </button>
                          ) : (
                            <button
                              onClick={() => deleteExpense(itemId)}
                              className="text-red-600 hover:text-red-800 text-xs px-1 py-1"
                              title="Delete expense"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                    </tr>
                    )
                  })
                  )}
                  <tr className="border-t-2 border-black font-semibold">
                    <td className="border-r border-black px-1 py-1 text-right">TOTAL EXPENSE</td>
                    <td className="px-1 py-1 text-center">₱{getTotalExpenses().toFixed(2)}</td>
                    <td className="px-1 py-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section F: Sales Reconciliation */}
          <div className="border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black">
              <span className="font-bold text-sm">F. SALES RECON</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{tableLayout: 'fixed'}}>
                <thead>
                  <tr className="border-b border-black">
                    <th className="border-r border-black px-1 py-1 text-left font-semibold sticky left-0 bg-gray-50 z-10 w-32 break-words">DENO</th>
                    <th className="border-r border-black px-1 py-1 text-center font-semibold w-16">QTY</th>
                    <th className="px-1 py-1 text-center font-semibold w-20">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {predefinedDenominations
                    .sort((a, b) => {
                      // Sort by denomination value in descending order
                      const aValue = getDenominationValue(a.name)
                      const bValue = getDenominationValue(b.name)
                      
                      // If both are 0 (non-number denominations), sort alphabetically
                      if (aValue === 0 && bValue === 0) {
                        return a.name.localeCompare(b.name)
                      }
                      
                      // Sort by value in descending order
                      return bValue - aValue
                    })
                    .map((denomObj, denomIndex) => {
                    const item = salesRecon.find(i => i.denomination === denomObj.name)
                    const itemId = item?.id || `new-${denomIndex}`
                    
                    return (
                    <tr key={denomObj.name} className="border-b border-gray-300">
                        <td className="border-r border-black px-1 py-1 sticky left-0 bg-white z-10 w-32 break-words">{denomObj.name}</td>
                        <td className="border-r border-black px-1 py-1 text-center w-16">
                          {editingField === `salesrecon-${itemId}-quantity` ? (
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0)
                                setEditingValue(value.toString())
                              }}
                              onBlur={() => handleBlur(`salesrecon-${itemId}-quantity`)}
                              onKeyPress={(e) => e.key === 'Enter' && handleBlur(`salesrecon-${itemId}-quantity`)}
                              className="w-full h-6 text-center bg-transparent focus:outline-none border-0 p-0 m-0 text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                minWidth: 0, 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                WebkitAppearance: 'none', 
                                MozAppearance: 'textfield',
                                appearance: 'none'
                              }}
                              autoFocus
                              ref={inputRef}
                            />
                          ) : (
                            <div 
                              className={getCellClassName()}
                              onClick={(e) => handleCellClick(e, `salesrecon-${itemId}-quantity`, getDisplayValue(`salesrecon-${itemId}-quantity`, getSalesReconValue(denomObj.name, 'quantity')) || '')}
                              style={{minHeight: '24px'}}
                            >
                              {getDisplayValue(`salesrecon-${itemId}-quantity`, getSalesReconValue(denomObj.name, 'quantity')) || ''}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-center bg-gray-200">
                          <div className="text-center font-medium">
                            {formatCurrency(getSalesReconAmount(denomObj.name, parseInt(getDisplayValue(`salesrecon-${itemId}-quantity`, getSalesReconValue(denomObj.name, 'quantity')) || '0') || 0))}
                          </div>
                        </td>
                    </tr>
                    )
                  })}
                  <tr className="border-t-2 border-black font-semibold">
                    <td className="border-r border-black px-1 py-1 text-right w-32">TOTAL CASH</td>
                    <td className="border-r border-black px-1 py-1 w-16"></td>
                    <td className="px-1 py-1 text-center w-20">{formatCurrency(getTotalCash())}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="border-r border-black px-1 py-1 text-right w-32">LESS: NET SALES</td>
                    <td className="border-r border-black px-1 py-1 w-16"></td>
                    <td className="px-1 py-1 text-center w-20">{formatCurrency(getNetSales())}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="border-r border-black px-1 py-1 text-right w-32">DISCREPANCY</td>
                    <td className="border-r border-black px-1 py-1 w-16"></td>
                    <td className={`px-1 py-1 text-center w-20 font-semibold ${getDiscrepancyColor()}`}>{formatCurrency(getDiscrepancy())}</td>
                  </tr>
                </tbody>
              </table>
                  </div>
              </div>

          {/* Notes Section */}
          <div className="border border-black">
            <div className="bg-gray-100 px-2 py-1 border-b border-black">
              <span className="font-bold text-sm">NOTES:</span>
              </div>
            <div className="p-2 h-32">
              {editingField === 'header-notes' ? (
                <textarea
                  ref={textareaRef}
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => handleBlur('header-notes')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault()
                      handleBlur('header-notes')
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditingField(null)
                      setEditingValue('')
                    }
                  }}
                  className="w-full h-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-0 focus:border-gray-300 resize-none"
                  placeholder="Enter notes..."
                />
              ) : (
                <div 
                  className="text-xs text-gray-600 whitespace-pre-wrap cursor-pointer hover:bg-gray-100 min-h-[100px] p-1 rounded"
                  onClick={() => startEditing('header-notes', getDisplayValue('header-notes', report?.notes || ''))}
                >
                  {getDisplayValue('header-notes', report?.notes || '') || 'Click to add notes...'}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons Section */}
          {report?.status === 'draft' && (
            <div className="border border-black">
              <div className="bg-gray-100 px-2 py-1 border-b border-black">
                <span className="font-bold text-sm">ACTIONS</span>
              </div>
              <div className="p-4 text-center space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => saveDraft(true)}
                    disabled={saving || !hasUnsavedChanges}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                <button
                  onClick={submitReport}
                    disabled={submitting || saving || !hasSalesReconData()}
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
                </div>
                {hasUnsavedChanges && (
                  <p className="text-xs text-orange-600 font-medium">
                    You have unsaved changes. Please save your draft before submitting.
                  </p>
                )}
                {!hasSalesReconData() && (
                  <p className="text-xs text-red-600 font-medium">
                    Sales reconciliation required before submission.
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-2">
                  Once submitted, this report cannot be edited
                </p>
              </div>
            </div>
          )}

          {/* Status Display for Submitted Reports */}
          {report?.status === 'submitted' && (
            <div className="border border-black">
              <div className="bg-green-100 px-2 py-1 border-b border-black">
                <span className="font-bold text-sm text-green-800">REPORT STATUS</span>
              </div>
              <div className="p-4 text-center">
                <div className="text-green-600 font-medium mb-2">✓ Report Submitted</div>
                <p className="text-xs text-gray-600">
                  {showEditButton 
                    ? 'This report has been submitted but can be edited' 
                    : 'This report has been submitted and cannot be edited'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Status Display for Reviewed Reports */}
          {report?.status === 'reviewed' && (
            <div className="border border-black">
              <div className="bg-blue-100 px-2 py-1 border-b border-black">
                <span className="font-bold text-sm text-blue-800">REPORT STATUS</span>
              </div>
              <div className="p-4 text-center">
                <div className="text-blue-600 font-medium mb-2">✓ Report Reviewed</div>
                <p className="text-xs text-gray-600">
                  {showEditButton 
                    ? 'This report has been reviewed but can be edited' 
                    : 'This report has been reviewed and cannot be edited'
                  }
                </p>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}