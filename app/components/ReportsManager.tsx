'use client'
import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase, Brand } from '../../lib/supabase'
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Printer,
} from 'lucide-react'
import { getPhilippinesDate } from '../../lib/timezone'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useBrands } from '../contexts/BrandsContext'
import { fetchCategorySortOrdersForBrand } from '../../lib/product-bom-component'
import {
  buildOrderSalesReport,
  formatOrderSalesMatrixCell,
  formatOrderSalesMoney,
  type OrderSalesReportData,
} from '../../lib/order-sales-report'
import { openOrderSalesReportPrintWindow } from '../../lib/print-order-sales-report'
import { openBranchPerformanceReportPrintWindow } from '../../lib/print-branch-performance-report'
import { openProductPerformanceReportPrintWindow } from '../../lib/print-product-performance-report'
import { openStaffPerformanceReportPrintWindow } from '../../lib/print-staff-performance-report'
import { getBrandHighlightClasses } from '../../lib/brand-colors'

interface ReportsManagerProps {
  selectedBrand?: Brand | null
  theme?: string
  currentUsername?: string
  currentRoleLabel?: string
}

function calendarDaysInRange(start: string, end: string): number {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0
  return Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1)
}

function weeksInDateRange(start: string, end: string): number {
  return calendarDaysInRange(start, end) / 7
}

function avgWeeklyFromPeriod(quantity: number, weeksInPeriod: number): number {
  if (weeksInPeriod <= 0 || quantity <= 0) return 0
  return quantity / weeksInPeriod
}

function getMonthDateRange(yearMonth: string): { start: string; end: string } {
  const [yearPart, monthPart] = yearMonth.split('-')
  const year = parseInt(yearPart, 10)
  const month = parseInt(monthPart, 10)
  if (!year || !month || month < 1 || month > 12) {
    return { start: '', end: '' }
  }
  const start = `${yearMonth}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function normalizeDsirItemName(name: string) {
  return (name || '').toUpperCase().trim()
}

function isBigCupItem(itemName: string) {
  const name = normalizeDsirItemName(itemName)
  return (name.includes('BIG') && name.includes('CUP')) || name === 'BIGCUP' || name === 'BIG CUP'
}

function isSmallCupItem(itemName: string) {
  const name = normalizeDsirItemName(itemName)
  return (name.includes('SMALL') && name.includes('CUP')) || name === 'SMALLCUP' || name === 'SMALL CUP'
}

function isTakeawayItem(itemName: string) {
  const name = normalizeDsirItemName(itemName)
  return (
    name.includes('TAKEAWAY') ||
    name.includes('TAKE AWAY') ||
    name.includes('TAKE-AWAY') ||
    name.includes('TAKEOUT') ||
    name.includes('TAKE OUT')
  )
}

function isWaterItem(itemName: string) {
  const name = normalizeDsirItemName(itemName)
  return name.includes('WATER')
}

function is500MlItem(itemName: string) {
  const name = normalizeDsirItemName(itemName)
  return name.includes('500')
}

function isChocoCoatedItem(itemName: string) {
  const name = normalizeDsirItemName(itemName)
  return name.includes('CHOCO') || name.includes('CHOCOLATE') || name.includes('COATED')
}

type DsirItemSold = { itemName: string; quantity: number }

type DsirSoldCategoryQtys = {
  bigCup: number
  smallCup: number
  takeaway: number
  water: number
  ml500: number
  choco: number
}

function emptySoldCategoryQtys(): DsirSoldCategoryQtys {
  return { bigCup: 0, smallCup: 0, takeaway: 0, water: 0, ml500: 0, choco: 0 }
}

function addSoldToCategoryQtys(
  qtys: DsirSoldCategoryQtys,
  itemName: string,
  quantity: number
) {
  if (quantity <= 0) return
  if (isBigCupItem(itemName)) qtys.bigCup += quantity
  else if (isSmallCupItem(itemName)) qtys.smallCup += quantity
  else if (isTakeawayItem(itemName)) qtys.takeaway += quantity
  else if (isWaterItem(itemName)) qtys.water += quantity
  else if (is500MlItem(itemName)) qtys.ml500 += quantity
  else if (isChocoCoatedItem(itemName)) qtys.choco += quantity
}

type DsirSalesInventoryRow = {
  item_name?: string
  sold?: number | string | null
  sales?: number | string | null
  beginning_inventory?: number | string | null
  arrival?: number | string | null
  pull_out?: number | string | null
  ending_inventory?: number | string | null
  new_inventory?: number | string | null
}

function summarizeInventorySold(
  inventory: DsirSalesInventoryRow[],
  priceByName: Map<string, number>
): { items: DsirItemSold[]; qtys: DsirSoldCategoryQtys } {
  const qtyByItem = new Map<string, number>()
  const qtys = emptySoldCategoryQtys()
  inventory.forEach((item) => {
    const itemName = (item.item_name || '').trim() || 'Unknown'
    const quantity = getCupSoldQuantity(item, priceByName)
    if (quantity <= 0) return
    qtyByItem.set(itemName, (qtyByItem.get(itemName) || 0) + quantity)
    addSoldToCategoryQtys(qtys, itemName, quantity)
  })
  const items = Array.from(qtyByItem.entries())
    .map(([itemName, quantity]) => ({ itemName, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.itemName.localeCompare(b.itemName))
  return { items, qtys }
}

function getCupSoldQuantityFromInventory(item: DsirSalesInventoryRow) {
  const endInvValue = item.ending_inventory
  if (endInvValue === '' || endInvValue === null || endInvValue === undefined) {
    return 0
  }

  const beg = parseInt(String(item.beginning_inventory)) || 0
  const arrival = parseInt(String(item.arrival)) || 0
  const pullOut = parseInt(String(item.pull_out)) || 0
  const newInv = item.new_inventory != null && item.new_inventory !== ''
    ? parseInt(String(item.new_inventory)) || 0
    : beg + arrival - pullOut
  const endInv = parseInt(String(endInvValue)) || 0

  if (endInv === 0) return Math.max(0, newInv)
  return Math.max(0, newInv - endInv)
}

function getQuantityFromSalesAmount(salesAmount: number, price: number) {
  if (salesAmount <= 0 || price <= 0) return 0
  return Math.round(salesAmount / price)
}

function getCupCategoryPrice(
  cupType: 'big' | 'small',
  predefinedSales: Array<{ name: string; price: number }>
) {
  const items = predefinedSales.filter(item =>
    cupType === 'big' ? isBigCupItem(item.name) : isSmallCupItem(item.name)
  )
  const prices = items
    .map(item => parseFloat(String(item.price)) || 0)
    .filter(price => price > 0)
  return prices[0] || 0
}

function getCupSoldQuantity(
  item: DsirSalesInventoryRow,
  priceByName: Map<string, number>
) {
  const fromInventory = getCupSoldQuantityFromInventory(item)
  if (fromInventory > 0) return fromInventory

  const predefinedPrice = priceByName.get(normalizeDsirItemName(item.item_name || '')) || 0
  const rowSales = parseFloat(String(item.sales)) || 0
  if (rowSales > 0 && predefinedPrice > 0) {
    return Math.round(rowSales / predefinedPrice)
  }

  const storedSold = parseInt(String(item.sold)) || 0
  if (storedSold > 0) return storedSold

  return 0
}

export function ReportsManager({
  selectedBrand: propSelectedBrand,
  theme = 'blue',
  currentUsername = '',
  currentRoleLabel = '',
}: ReportsManagerProps) {
  const { brands, loading: brandsLoading } = useBrands()
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState<string>('branch')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [reportData, setReportData] = useState<any>(null)
  const [error, setError] = useState('')

  // Brand selection - use local state, initialize from prop
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(propSelectedBrand || null)
  
  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [selectedCompanyOwned, setSelectedCompanyOwned] = useState<string>('') // '' = all, 'true' = company owned, 'false' = franchise
  const [dateRangePreset, setDateRangePreset] = useState<string>('30days')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getPhilippinesDate().slice(0, 7))
  const [expandedSalesLocations, setExpandedSalesLocations] = useState<Record<string, boolean>>({})
  const [expandedStaffRows, setExpandedStaffRows] = useState<Record<string, boolean>>({})
  const [expandedDsirRows, setExpandedDsirRows] = useState<Record<string, boolean>>({})
  
  // Options for filters
  const [branches, setBranches] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const reportAutoRunRef = useRef<string | null>(null)

  // Update local brand state when prop changes
  useEffect(() => {
    if (propSelectedBrand) {
      setSelectedBrand(propSelectedBrand)
    } else if (brands.length > 0 && !selectedBrand) {
      // If no prop brand, use first available brand
      setSelectedBrand(brands[0])
    }
  }, [propSelectedBrand, brands])

  useEffect(() => {
    // Default date range to last 30 days for branch performance
    const end = getPhilippinesDate()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    const start = startDate.toISOString().split('T')[0]
    setDateRange({ start, end })
    setDateRangePreset('30days')
    loadFilterOptions()
    setReportData(null)
    setError('')
    reportAutoRunRef.current = null
    setSelectedBranch('')
    setSelectedCategory('')
    setSelectedStaff('')
    setSelectedLocation('')
    setSelectedCompanyOwned('true')
  }, [selectedBrand])

  useEffect(() => {
    // Reset to last 30 days and clear results when report type changes
    const end = getPhilippinesDate()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    const start = startDate.toISOString().split('T')[0]
    setDateRange({ start, end })
    setDateRangePreset('30days')
    setSelectedMonth('')
    setReportData(null)
    setError('')
    reportAutoRunRef.current = null
    // Clear filters when switching report types
    setSelectedBranch('')
    setSelectedCategory('')
    setSelectedStaff('')
    setSelectedLocation('')
    // Set ownership default for reports that use it
    if (reportType === 'branch' || reportType === 'sales') {
      setSelectedCompanyOwned('true')
    } else {
      setSelectedCompanyOwned('')
    }
    // Reset brand to prop brand when switching away from staff performance
    if (reportType !== 'staff' && propSelectedBrand) {
      setSelectedBrand(propSelectedBrand)
    }
  }, [reportType, propSelectedBrand])

  const setDateRangeToMonth = (yearMonth: string) => {
    setSelectedMonth(yearMonth)
    setDateRangePreset('month')
    reportAutoRunRef.current = null
    const { start, end } = getMonthDateRange(yearMonth)
    if (start && end) {
      setDateRange({ start, end })
    }
  }

  const setDateRangePresetValue = (preset: string) => {
    setDateRangePreset(preset)
    reportAutoRunRef.current = null

    if (preset === 'month') {
      setDateRangeToMonth(selectedMonth)
      return
    }

    if (preset === 'custom') {
      return
    }

    const end = getPhilippinesDate()
    const startDate = new Date()
    
    switch (preset) {
      case '7days':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30days':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '365days':
        startDate.setDate(startDate.getDate() - 365)
        break
      default:
        startDate.setDate(startDate.getDate() - 30)
    }
    
    const start = startDate.toISOString().split('T')[0]
    setDateRange({ start, end })
  }

  const handleMonthChange = (yearMonth: string) => {
    setDateRangeToMonth(yearMonth)
  }

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange({ ...dateRange, [field]: value })
    setDateRangePreset('custom')
    reportAutoRunRef.current = null
  }

  const loadFilterOptions = async () => {
    try {
      // Load branches/locations - filter by brand if selected, otherwise load all
      let locationQuery = supabase
        .from('locations')
        .select('*')
        .order('name')
      
      if (selectedBrand) {
        locationQuery = locationQuery.eq('brand_id', selectedBrand.id)
      }
      
      const { data: locs } = await locationQuery
      setLocations(locs || [])
      setBranches(locs || [])

      // Load categories from products - only show ice cream, gelato, and sorbetes
      let productQuery = supabase
        .from('products')
        .select('category')
        .not('category', 'is', null)
      
      if (selectedBrand) {
        productQuery = productQuery.eq('brand_id', selectedBrand.id)
      }
      
      const { data: products } = await productQuery
      const allowedCategories = ['ice cream', 'gelato', 'sorbetes']
      const productCategories = products?.map(p => (p.category || '').toLowerCase().trim()).filter(Boolean) || []
      const uniqueCategories = allowedCategories.filter(cat => 
        productCategories.some(pc => pc === cat.toLowerCase())
      )
      setCategories(uniqueCategories)

      // Load staff - always load all staff (not filtered by brand)
      const { data: staff } = await supabase
        .from('staff_registrations')
        .select('*')
        .order('full_name')
      setStaffList(staff || [])
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  const generateReport = async () => {
    if (!reportType) {
      setError('Please select a report type')
      return
    }

    if (!dateRange.start || !dateRange.end) {
      setError('Please select a date range')
      return
    }

    setLoading(true)
    setError('')
    setReportData(null)

    try {
      switch (reportType) {
        case 'sales':
          await generateSalesReport()
          break
        case 'product':
          await generateProductPerformanceReport()
          break
        case 'staff':
          await generateStaffPerformanceReport()
          break
        case 'branch':
          await generateBranchPerformanceReport()
          break
        default:
          setError('Invalid report type')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      setError('Failed to generate report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Order Sales Report - filters: date range, branch
  const generateSalesReport = async () => {
    if (!selectedBrand) return

    const [ordersRes, categorySortOrders] = await Promise.all([
      supabase
        .from('customer_orders')
        .select(`
          *,
          location:locations(*),
          order_details(
            quantity,
            unit_price,
            products:products(id, name, sku, unit, category)
          )
        `)
        .in('status', ['paid', 'complete', 'fulfilled'])
        .eq('brand_id', selectedBrand.id)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + 'T23:59:59')
        .order('created_at', { ascending: false }),
      fetchCategorySortOrdersForBrand(selectedBrand.id).catch(() => ({} as Record<string, number>)),
    ])

    if (ordersRes.error) throw ordersRes.error

    // Filter by branch if selected
    let filteredOrders = ordersRes.data || []
    if (selectedBranch) {
      filteredOrders = filteredOrders.filter((order) => order.location?.id === selectedBranch)
    }

    // Filter by company owned if selected
    if (selectedCompanyOwned === 'true') {
      filteredOrders = filteredOrders.filter((order) => order.location?.company_owned === true)
    } else if (selectedCompanyOwned === 'false') {
      filteredOrders = filteredOrders.filter((order) => order.location?.company_owned === false)
    }

    const totalSales = filteredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    const totalOrders = filteredOrders.length
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // Prepare daily sales data for line graph
    const dailySales = filteredOrders.reduce((acc: Record<string, number>, order) => {
      const date = new Date(order.created_at).toLocaleDateString()
      acc[date] = (acc[date] || 0) + (order.total_amount || 0)
      return acc
    }, {})
    const dailySalesData = Object.entries(dailySales)
      .map(([date, sales]) => ({ date, sales: Number(sales) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Prepare sales by location for bar graph
    const salesByLocation = filteredOrders.reduce((acc: Record<string, number>, order) => {
      const locName = order.location?.name || 'Unknown'
      acc[locName] = (acc[locName] || 0) + (order.total_amount || 0)
      return acc
    }, {})
    const salesByLocationData = Object.entries(salesByLocation)
      .map(([name, sales]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        sales: Number(sales),
      }))
      .sort((a, b) => b.sales - a.sales)

    const orderSales = buildOrderSalesReport(filteredOrders, categorySortOrders, {
      // Show AR columns for franchise-only and mixed (All); hide for company-owned only.
      includeFranchiseReceivables: selectedCompanyOwned !== 'true',
    })

    const filterParts: string[] = []
    if (selectedBranch) {
      const branchName = branches.find((b) => b.id === selectedBranch)?.name
      if (branchName) filterParts.push(`Branch: ${branchName}`)
    }
    if (selectedCompanyOwned === 'true') filterParts.push('Company-owned only')
    else if (selectedCompanyOwned === 'false') filterParts.push('Franchise only')

    setExpandedSalesLocations({})
    setReportData({
      type: 'Order Sales Report',
      period: `${dateRange.start} to ${dateRange.end}`,
      filterNote: filterParts.join(' · '),
      summary: {
        totalSales,
        totalOrders,
        averageOrderValue,
      },
      dailySalesData,
      salesByLocationData,
      orderSales,
      tableData: orderSales.summaryRows.map((row) => ({
        location: row.locationName,
        amount: row.locationTotal,
      })),
    })
  }

  // Product Performance Report - filters: category
  const generateProductPerformanceReport = async () => {
    if (!selectedBrand) return

    // First, get all products
    let productQuery = supabase
      .from('products')
      .select('*')
      .eq('brand_id', selectedBrand.id)

    if (selectedCategory) {
      productQuery = productQuery.eq('category', selectedCategory)
    }

    const { data: products, error: productsError } = await productQuery.order('name')

    if (productsError) throw productsError

    // Filter to only include ice cream, gelato, and sorbetes
    const allowedCategories = ['ice cream', 'gelato', 'sorbetes']
    let filteredProducts = products || []
    
    // Filter to only allowed categories
    filteredProducts = products?.filter(p => {
      const category = (p.category || '').toLowerCase().trim()
      // If category is selected, match that category, otherwise show all allowed categories
      if (selectedCategory) {
        const selectedCatLower = selectedCategory.toLowerCase().trim()
        return category === selectedCatLower && allowedCategories.includes(category)
      }
      return allowedCategories.includes(category)
    }) || []

    // Get all completed orders with order details
    const { data: orders, error: ordersError } = await supabase
      .from('customer_orders')
      .select(`
        *,
        order_details(
          *,
          product:products(*)
        )
      `)
      .in('status', ['paid', 'complete', 'fulfilled'])
      .eq('brand_id', selectedBrand.id)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59')

    if (ordersError) throw ordersError

    // Calculate quantity sold from order history for each product
    const productQuantities: { [productId: string]: { quantity: number, amount: number } } = {}

    orders?.forEach((order: any) => {
      order.order_details?.forEach((detail: any) => {
        const productId = detail.product_id
        const quantity = detail.quantity || 0
        const unitPrice = detail.unit_price || 0
        const amount = quantity * unitPrice

        if (!productQuantities[productId]) {
          productQuantities[productId] = { quantity: 0, amount: 0 }
        }
        productQuantities[productId].quantity += quantity
        productQuantities[productId].amount += amount
      })
    })

    // Map products with quantities from order history
    const productsWithMetrics = filteredProducts.map(p => {
      const orderData = productQuantities[p.id] || { quantity: 0, amount: 0 }
      return {
        ...p,
        quantity: orderData.quantity,
        amount: orderData.amount
      }
    })

    const totalQuantity = productsWithMetrics.reduce((sum, p) => sum + p.quantity, 0)
    const totalAmount = productsWithMetrics.reduce((sum, p) => sum + p.amount, 0)

    // Prepare bar graph data
    const barGraphData = productsWithMetrics
      .map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        quantity: p.quantity,
        amount: p.amount
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20)

    // Prepare pie graph data
    const pieGraphData = productsWithMetrics
      .map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        value: p.quantity
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    setReportData({
      type: 'Product Performance Report',
      period: `${dateRange.start} to ${dateRange.end}`,
      filterNote: selectedCategory ? `Category: ${selectedCategory}` : '',
      summary: {
        totalQuantity,
        totalAmount
      },
      barGraphData,
      pieGraphData,
      tableData: productsWithMetrics.map(p => ({
        productName: p.name,
        quantity: p.quantity,
        amount: p.amount
      }))
    })
  }

  // Staff Performance Report - filters: staff name, location
  const generateStaffPerformanceReport = async () => {
    let query = supabase
      .from('dsir_reports')
      .select(`
        *,
        location:locations(*),
        staff_registration:staff_registrations(*)
      `)
      .eq('status', 'submitted')
      .gte('report_date', dateRange.start)
      .lte('report_date', dateRange.end)

    const { data: reports, error } = await query.order('report_date', { ascending: false })

    if (error) throw error

    let filteredReports = selectedBrand
      ? reports?.filter((report) => report.location?.brand_id === selectedBrand.id) || []
      : reports || []

    if (selectedStaff) {
      filteredReports = filteredReports.filter(
        (report) => report.staff_registration_id === selectedStaff
      )
    }

    if (selectedLocation) {
      filteredReports = filteredReports.filter((report) => report.location_id === selectedLocation)
    }

    type DailyRow = {
      date: string
      locationName: string
      hours: number
      dayType: string
      sales: number
      bigCupQty: number
      smallCupQty: number
      takeawayQty: number
      waterQty: number
      ml500Qty: number
      chocoQty: number
      itemsSold: DsirItemSold[]
    }

    type DsirDayDetail = {
      sales: number
      bigCupQty: number
      smallCupQty: number
      takeawayQty: number
      waterQty: number
      ml500Qty: number
      chocoQty: number
      itemsSold: DsirItemSold[]
    }

    type StaffAgg = {
      staffName: string
      sales: number[]
      totalGrossSales: number
      salesByDate: Record<string, number>
      detailByDateLocation: Record<string, DsirDayDetail>
      detailByDate: Record<string, DsirDayDetail>
      workingDays: Set<string>
      dsirDays: Set<string>
      totalWorkingHours: number
      regularPay: number
      overtimePay: number
      doublePay: number
      specialPay: number
      incentivePay: number
      totalDeductions: number
      refunds: number
      netPay: number
      payFromRunLines: boolean
      bigCupQty: number
      smallCupQty: number
      takeawayQty: number
      waterQty: number
      ml500Qty: number
      chocoQty: number
      dailyBreakdown: DailyRow[]
    }

    const staffPerformance: Record<string, StaffAgg> = {}

    const ensureStaff = (staffId: string, staffName: string): StaffAgg => {
      if (!staffPerformance[staffId]) {
        staffPerformance[staffId] = {
          staffName,
          sales: [],
          totalGrossSales: 0,
          salesByDate: {},
          detailByDateLocation: {},
          detailByDate: {},
          workingDays: new Set(),
          dsirDays: new Set(),
          totalWorkingHours: 0,
          regularPay: 0,
          overtimePay: 0,
          doublePay: 0,
          specialPay: 0,
          incentivePay: 0,
          totalDeductions: 0,
          refunds: 0,
          netPay: 0,
          payFromRunLines: false,
          bigCupQty: 0,
          smallCupQty: 0,
          takeawayQty: 0,
          waterQty: 0,
          ml500Qty: 0,
          chocoQty: 0,
          dailyBreakdown: [],
        }
      }
      return staffPerformance[staffId]
    }

    const mergeDayDetail = (target: DsirDayDetail | undefined, source: DsirDayDetail): DsirDayDetail => {
      if (!target) return { ...source, itemsSold: [...source.itemsSold] }
      const itemMap = new Map<string, number>()
      target.itemsSold.forEach((i) => itemMap.set(i.itemName, i.quantity))
      source.itemsSold.forEach((i) =>
        itemMap.set(i.itemName, (itemMap.get(i.itemName) || 0) + i.quantity)
      )
      return {
        sales: target.sales + source.sales,
        bigCupQty: target.bigCupQty + source.bigCupQty,
        smallCupQty: target.smallCupQty + source.smallCupQty,
        takeawayQty: target.takeawayQty + source.takeawayQty,
        waterQty: target.waterQty + source.waterQty,
        ml500Qty: target.ml500Qty + source.ml500Qty,
        chocoQty: target.chocoQty + source.chocoQty,
        itemsSold: Array.from(itemMap.entries())
          .map(([itemName, quantity]) => ({ itemName, quantity }))
          .sort((a, b) => b.quantity - a.quantity || a.itemName.localeCompare(b.itemName)),
      }
    }

    const predefinedPriceByName = new Map<string, number>()
    if (selectedBrand) {
      const { data: predefinedItemsData } = await supabase
        .from('dsir_predefined_items')
        .select('name, price')
        .eq('brand_id', selectedBrand.id)
        .eq('category', 'sales')
        .eq('is_active', true)
      ;(predefinedItemsData || []).forEach((item) => {
        predefinedPriceByName.set(
          normalizeDsirItemName(item.name),
          parseFloat(String(item.price)) || 0
        )
      })
    }

    const reportIds = filteredReports.map((r) => r.id).filter(Boolean)
    const salesInventoryByReport: Record<string, DsirSalesInventoryRow[]> = {}
    if (reportIds.length > 0) {
      const { data: salesInventoryData } = await supabase
        .from('dsir_sales_inventory')
        .select(
          'dsir_report_id, item_name, sold, sales, price, beginning_inventory, arrival, pull_out, ending_inventory, new_inventory'
        )
        .in('dsir_report_id', reportIds)
      ;(salesInventoryData || []).forEach((item: any) => {
        if (!salesInventoryByReport[item.dsir_report_id]) {
          salesInventoryByReport[item.dsir_report_id] = []
        }
        salesInventoryByReport[item.dsir_report_id].push(item)
      })
    }

    filteredReports.forEach((report) => {
      const staffId = report.staff_registration_id
      const staffName =
        report.staff_name || report.staff_registration?.full_name || 'Unknown'
      const sales = parseFloat(report.gross_sales || 0)
      const date = report.report_date
      const locationId = report.location_id || 'unknown'
      const { items, qtys } = summarizeInventorySold(
        salesInventoryByReport[report.id] || [],
        predefinedPriceByName
      )
      const dayDetail: DsirDayDetail = {
        sales,
        bigCupQty: qtys.bigCup,
        smallCupQty: qtys.smallCup,
        takeawayQty: qtys.takeaway,
        waterQty: qtys.water,
        ml500Qty: qtys.ml500,
        chocoQty: qtys.choco,
        itemsSold: items,
      }
      const agg = ensureStaff(staffId, staffName)
      agg.sales.push(sales)
      agg.totalGrossSales += sales
      agg.dsirDays.add(date)
      agg.salesByDate[date] = (agg.salesByDate[date] || 0) + sales
      agg.bigCupQty += qtys.bigCup
      agg.smallCupQty += qtys.smallCup
      agg.takeawayQty += qtys.takeaway
      agg.waterQty += qtys.water
      agg.ml500Qty += qtys.ml500
      agg.chocoQty += qtys.choco
      const locKey = `${date}|${locationId}`
      agg.detailByDateLocation[locKey] = mergeDayDetail(
        agg.detailByDateLocation[locKey],
        dayDetail
      )
      agg.detailByDate[date] = mergeDayDetail(agg.detailByDate[date], dayDetail)
    })

    let brandLocationIds: string[] = []
    if (selectedBrand) {
      const { data: brandLocations } = await supabase
        .from('locations')
        .select('id')
        .eq('brand_id', selectedBrand.id)
      brandLocationIds = brandLocations?.map((loc) => loc.id) || []
    }

    let scheduleQuery = supabase
      .from('staff_schedules')
      .select(`
        *,
        staff:staff_registrations(id, full_name, hourly_rate),
        location:locations(id, name, brand_id)
      `)
      .gte('schedule_date', dateRange.start)
      .lte('schedule_date', dateRange.end)
      .eq('is_absent', false)

    const dsirStaffIds = Object.keys(staffPerformance)
    if (selectedStaff) {
      scheduleQuery = scheduleQuery.eq('staff_registration_id', selectedStaff)
    } else if (dsirStaffIds.length > 0) {
      scheduleQuery = scheduleQuery.in('staff_registration_id', dsirStaffIds)
    }

    if (selectedLocation) {
      scheduleQuery = scheduleQuery.eq('location_id', selectedLocation)
    } else if (selectedBrand && brandLocationIds.length > 0) {
      scheduleQuery = scheduleQuery.in('location_id', brandLocationIds)
    }

    const { data: schedules, error: scheduleError } =
      selectedStaff || dsirStaffIds.length > 0
        ? await scheduleQuery
        : { data: [] as any[], error: null }

    if (!scheduleError && schedules) {
      // Fallback pay from schedules (overwritten by run lines when present)
      schedules.forEach((schedule) => {
        const staffId = schedule.staff_registration_id
        const staffName = schedule.staff?.full_name || 'Unknown'
        const agg = ensureStaff(staffId, staffName)
        const hours = parseFloat(schedule.hours || 0)
        const hourlyRate = parseFloat(schedule.staff?.hourly_rate || 0)
        const dayType = schedule.day_type || 'default'
        const date = schedule.schedule_date

        agg.workingDays.add(date)
        agg.totalWorkingHours += hours

        if (!agg.payFromRunLines) {
          if (dayType === 'regular-holiday') {
            const pay = hours * hourlyRate * 2
            agg.doublePay += pay
            agg.netPay += pay
          } else if (dayType === 'special-holiday') {
            const pay = hours * hourlyRate * 1.3
            agg.specialPay += pay
            agg.netPay += pay
          } else {
            const pay = hours * hourlyRate
            agg.regularPay += pay
            agg.netPay += pay
          }
        }

        const locKey = `${date}|${schedule.location_id || 'unknown'}`
        const detail =
          agg.detailByDateLocation[locKey] ||
          agg.detailByDate[date] || {
            sales: agg.salesByDate[date] || 0,
            bigCupQty: 0,
            smallCupQty: 0,
            takeawayQty: 0,
            waterQty: 0,
            ml500Qty: 0,
            chocoQty: 0,
            itemsSold: [],
          }

        agg.dailyBreakdown.push({
          date,
          locationName: schedule.location?.name || 'Unknown',
          hours,
          dayType,
          sales: detail.sales,
          bigCupQty: detail.bigCupQty,
          smallCupQty: detail.smallCupQty,
          takeawayQty: detail.takeawayQty,
          waterQty: detail.waterQty,
          ml500Qty: detail.ml500Qty,
          chocoQty: detail.chocoQty,
          itemsSold: detail.itemsSold,
        })
      })

      const staffIds = Object.keys(staffPerformance)
      if (staffIds.length > 0) {
        const { data: deductionsData } = await supabase
          .from('payroll_deductions_refunds')
          .select('*')
          .in('staff_id', staffIds)
          .gte('week_start_date', dateRange.start)
          .lte('week_end_date', dateRange.end)

        if (deductionsData) {
          deductionsData.forEach((deduction) => {
            const agg = staffPerformance[deduction.staff_id]
            if (!agg || agg.payFromRunLines) return
            const totalDeductions =
              parseFloat(deduction.utilities || 0) +
              parseFloat(deduction.shortages || 0) +
              parseFloat(deduction.cash_advances || 0) +
              parseFloat(deduction.penalties || 0) +
              parseFloat(deduction.others || 0)
            const refunds = parseFloat(deduction.refunds || 0)
            agg.totalDeductions += totalDeductions
            agg.refunds += refunds
            agg.netPay += refunds - totalDeductions
          })
        }

        const { data: finalizedRuns } = await supabase
          .from('payroll_runs')
          .select('id')
          .gte('week_end_date', dateRange.start)
          .lte('week_start_date', dateRange.end)
          .in('status', ['calculated', 'approved', 'accrued', 'paid'])

        if (finalizedRuns?.length) {
          const runIds = finalizedRuns.map((r) => r.id)
          const { data: runLines } = await supabase
            .from('payroll_run_lines')
            .select(
              'staff_id, total_hours, regular_hours, overtime_hours, double_pay_hours, special_pay_hours, regular_pay, overtime_pay, double_pay, special_pay, incentive_pay, total_deductions, refunds, net_pay'
            )
            .in('payroll_run_id', runIds)
            .in('staff_id', staffIds)

          if (runLines?.length) {
            const touched = new Set<string>()
            runLines.forEach((line) => {
              const staffId = line.staff_id
              const agg = staffPerformance[staffId]
              if (!agg) return
              if (!touched.has(staffId)) {
                touched.add(staffId)
                agg.payFromRunLines = true
                agg.regularPay = 0
                agg.overtimePay = 0
                agg.doublePay = 0
                agg.specialPay = 0
                agg.incentivePay = 0
                agg.totalDeductions = 0
                agg.refunds = 0
                agg.netPay = 0
                agg.totalWorkingHours = 0
              }
              agg.totalWorkingHours += parseFloat(String(line.total_hours || 0))
              agg.regularPay += parseFloat(String(line.regular_pay || 0))
              agg.overtimePay += parseFloat(String(line.overtime_pay || 0))
              agg.doublePay += parseFloat(String(line.double_pay || 0))
              agg.specialPay += parseFloat(String(line.special_pay || 0))
              agg.incentivePay += parseFloat(String(line.incentive_pay || 0))
              agg.totalDeductions += parseFloat(String(line.total_deductions || 0))
              agg.refunds += parseFloat(String(line.refunds || 0))
              agg.netPay += parseFloat(String(line.net_pay || 0))
            })
          }
        }
      }
    }

    // Sort daily breakdowns and attach sales for days with DSIR but no schedule entry
    Object.values(staffPerformance).forEach((agg) => {
      const scheduledDates = new Set(agg.dailyBreakdown.map((d) => d.date))
      Object.entries(agg.detailByDate).forEach(([date, detail]) => {
        if (!scheduledDates.has(date) && detail.sales > 0) {
          agg.dailyBreakdown.push({
            date,
            locationName: '—',
            hours: 0,
            dayType: 'default',
            sales: detail.sales,
            bigCupQty: detail.bigCupQty,
            smallCupQty: detail.smallCupQty,
            takeawayQty: detail.takeawayQty,
            waterQty: detail.waterQty,
            ml500Qty: detail.ml500Qty,
            chocoQty: detail.chocoQty,
            itemsSold: detail.itemsSold,
          })
        }
      })
      agg.dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date))
    })

    const staffAverages = Object.entries(staffPerformance)
      .map(([staffId, data]) => {
        const avgSales =
          data.sales.length > 0
            ? data.sales.reduce((sum, s) => sum + s, 0) / data.sales.length
            : 0
        return {
          staffId,
          staffName: data.staffName,
          averageSales: avgSales,
          totalGrossSales: data.totalGrossSales,
          workingDays: data.workingDays.size,
          dsirDays: data.dsirDays.size,
          totalWorkingHours: data.totalWorkingHours,
          regularPay: data.regularPay,
          overtimePay: data.overtimePay,
          doublePay: data.doublePay,
          specialPay: data.specialPay,
          incentivePay: data.incentivePay,
          totalDeductions: data.totalDeductions,
          refunds: data.refunds,
          totalPayroll: data.netPay,
          bigCupQty: data.bigCupQty,
          smallCupQty: data.smallCupQty,
          takeawayQty: data.takeawayQty,
          waterQty: data.waterQty,
          ml500Qty: data.ml500Qty,
          chocoQty: data.chocoQty,
          dailyBreakdown: data.dailyBreakdown,
          totalReports: data.sales.length,
        }
      })
      .sort((a, b) => b.totalGrossSales - a.totalGrossSales)

    const salesOverTime: { [date: string]: { [staffId: string]: number } } = {}
    filteredReports.forEach((report) => {
      const date = report.report_date
      const staffId = report.staff_registration_id
      const sales = parseFloat(report.gross_sales || 0)
      if (!salesOverTime[date]) salesOverTime[date] = {}
      salesOverTime[date][staffId] = (salesOverTime[date][staffId] || 0) + sales
    })

    const allStaffNames = Object.values(staffPerformance).map((s) => s.staffName)
    const lineGraphData = Object.entries(salesOverTime)
      .map(([date, staffSales]) => {
        const dataPoint: Record<string, string | number> = { date }
        allStaffNames.forEach((staffName) => {
          const staffId = Object.keys(staffPerformance).find(
            (id) => staffPerformance[id].staffName === staffName
          )
          dataPoint[staffName] = staffId ? staffSales[staffId] || 0 : 0
        })
        return dataPoint
      })
      .sort((a, b) => new Date(String(a.date)).getTime() - new Date(String(b.date)).getTime())

    const totalGrossSales = staffAverages.reduce((sum, s) => sum + s.totalGrossSales, 0)
    const totalPayroll = staffAverages.reduce((sum, s) => sum + s.totalPayroll, 0)
    const totalAverageSales =
      staffAverages.length > 0
        ? staffAverages.reduce((sum, s) => sum + s.averageSales, 0) / staffAverages.length
        : 0

    setExpandedStaffRows({})
    setReportData({
      type: 'Staff Performance Report',
      period: `${dateRange.start} to ${dateRange.end}`,
      filterNote: [
        selectedStaff
          ? `Staff: ${staffList.find((s) => s.id === selectedStaff)?.full_name || selectedStaff}`
          : '',
        selectedLocation
          ? `Location: ${locations.find((l) => l.id === selectedLocation)?.name || selectedLocation}`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      summary: {
        totalStaff: staffAverages.length,
        averageSales: totalAverageSales,
        totalGrossSales,
        totalPayroll,
        totalDoublePay: staffAverages.reduce((sum, s) => sum + s.doublePay, 0),
        totalSpecialPay: staffAverages.reduce((sum, s) => sum + s.specialPay, 0),
        totalOvertimePay: staffAverages.reduce((sum, s) => sum + s.overtimePay, 0),
        totalIncentivePay: staffAverages.reduce((sum, s) => sum + s.incentivePay, 0),
        totalDeductions: staffAverages.reduce((sum, s) => sum + s.totalDeductions, 0),
        totalRefunds: staffAverages.reduce((sum, s) => sum + s.refunds, 0),
        totalBigCups: staffAverages.reduce((sum, s) => sum + s.bigCupQty, 0),
        totalSmallCups: staffAverages.reduce((sum, s) => sum + s.smallCupQty, 0),
        totalTakeaway: staffAverages.reduce((sum, s) => sum + s.takeawayQty, 0),
        totalWater: staffAverages.reduce((sum, s) => sum + s.waterQty, 0),
      },
      lineGraphData,
      tableData: staffAverages.map((s) => ({
        staffId: s.staffId,
        staffName: s.staffName,
        averageSales: s.averageSales,
        totalGrossSales: s.totalGrossSales,
        workingDays: s.workingDays,
        dsirDays: s.dsirDays,
        totalWorkingHours: s.totalWorkingHours,
        regularPay: s.regularPay,
        overtimePay: s.overtimePay,
        doublePay: s.doublePay,
        specialPay: s.specialPay,
        incentivePay: s.incentivePay,
        totalDeductions: s.totalDeductions,
        refunds: s.refunds,
        totalPayroll: s.totalPayroll,
        bigCupQty: s.bigCupQty,
        smallCupQty: s.smallCupQty,
        takeawayQty: s.takeawayQty,
        waterQty: s.waterQty,
        ml500Qty: s.ml500Qty,
        chocoQty: s.chocoQty,
        dailyBreakdown: s.dailyBreakdown,
      })),
    })
  }

  // Branch Performance Report (DSIR) - filters: location, date range
  const generateBranchPerformanceReport = async () => {
    if (!selectedBrand) return

    const { data: predefinedItemsData, error: predefinedItemsError } = await supabase
      .from('dsir_predefined_items')
      .select('name, price')
      .eq('brand_id', selectedBrand.id)
      .eq('category', 'sales')
      .eq('is_active', true)

    if (predefinedItemsError) {
      console.error('Error fetching DSIR predefined sales items:', predefinedItemsError)
    }

    const predefinedSalesItems = (predefinedItemsData || []).map(item => ({
      name: item.name,
      price: parseFloat(String(item.price)) || 0,
    }))
    const predefinedPriceByName = new Map<string, number>()
    predefinedSalesItems.forEach(item => {
      predefinedPriceByName.set(normalizeDsirItemName(item.name), item.price)
    })

    let query = supabase
      .from('dsir_reports')
      .select(`
        *,
        location:locations(*),
        staff_registration:staff_registrations(*)
      `)
      .eq('status', 'submitted')
      .gte('report_date', dateRange.start)
      .lte('report_date', dateRange.end)
      .order('report_date', { ascending: false })

    const { data: reports, error } = await query

    if (error) throw error

    // Filter by brand
    let filteredReports = reports?.filter(report => report.location?.brand_id === selectedBrand.id) || []

    // Filter by location if selected
    if (selectedLocation) {
      filteredReports = filteredReports.filter(report => report.location_id === selectedLocation)
    }

    // Filter by company owned if selected
    if (selectedCompanyOwned === 'true') {
      filteredReports = filteredReports.filter(report => report.location?.company_owned === true)
    } else if (selectedCompanyOwned === 'false') {
      filteredReports = filteredReports.filter(report => report.location?.company_owned === false)
    }

    const totalGrossSales = filteredReports.reduce((sum, r) => sum + (parseFloat(r.gross_sales) || 0), 0)
    const totalNetSales = filteredReports.reduce((sum, r) => sum + (parseFloat(r.net_sales) || 0), 0)
    const totalBigCupSales = filteredReports.reduce((sum, r) => sum + (parseFloat(r.big_cup_sales) || 0), 0)
    const totalSmallCupSales = filteredReports.reduce((sum, r) => sum + (parseFloat(r.small_cup_sales) || 0), 0)

    const bigCupQtyByDate: { [date: string]: number } = {}
    const smallCupQtyByDate: { [date: string]: number } = {}
    let totalBigCupQuantity = 0
    let totalSmallCupQuantity = 0
    const itemSoldTotals = new Map<string, number>()
    const dailyDsirRows: Array<{
      id: string
      date: string
      location: string
      grossSales: number
      bigCupQty: number
      smallCupQty: number
      takeawayQty: number
      waterQty: number
      ml500Qty: number
      chocoQty: number
      itemsSold: DsirItemSold[]
    }> = []

    const branchMetrics: Record<string, {
      locationId: string
      location: string
      grossSales: number
      netSales: number
      bigCupSales: number
      smallCupSales: number
      bigCupQuantity: number
      smallCupQuantity: number
      reportCount: number
      reportDates: Set<string>
    }> = {}

    const getOrCreateBranch = (locationId: string, locationName: string) => {
      if (!branchMetrics[locationId]) {
        branchMetrics[locationId] = {
          locationId,
          location: locationName,
          grossSales: 0,
          netSales: 0,
          bigCupSales: 0,
          smallCupSales: 0,
          bigCupQuantity: 0,
          smallCupQuantity: 0,
          reportCount: 0,
          reportDates: new Set(),
        }
      }
      return branchMetrics[locationId]
    }

    const overallReportDates = new Set<string>()

    const reportIds = filteredReports.map(report => report.id)
    const salesInventoryByReport: Record<string, Array<{
      item_name: string
      sold?: number | string | null
      sales?: number | string | null
      price?: number | string | null
      beginning_inventory?: number | string | null
      arrival?: number | string | null
      pull_out?: number | string | null
      ending_inventory?: number | string | null
      new_inventory?: number | string | null
    }>> = {}

    if (reportIds.length > 0) {
      const { data: salesInventoryData, error: salesInventoryError } = await supabase
        .from('dsir_sales_inventory')
        .select('dsir_report_id, item_name, sold, sales, price, beginning_inventory, arrival, pull_out, ending_inventory, new_inventory')
        .in('dsir_report_id', reportIds)

      if (salesInventoryError) {
        console.error('Error fetching sales inventory:', salesInventoryError)
      } else {
        ;(salesInventoryData || []).forEach(item => {
          if (!salesInventoryByReport[item.dsir_report_id]) {
            salesInventoryByReport[item.dsir_report_id] = []
          }
          salesInventoryByReport[item.dsir_report_id].push(item)
        })
      }
    }

    filteredReports.forEach(report => {
      const date = report.report_date
      if (!bigCupQtyByDate[date]) bigCupQtyByDate[date] = 0
      if (!smallCupQtyByDate[date]) smallCupQtyByDate[date] = 0

      const inventory = salesInventoryByReport[report.id] || []
      const { items, qtys } = summarizeInventorySold(inventory, predefinedPriceByName)
      let reportBigQty = qtys.bigCup
      let reportSmallQty = qtys.smallCup

      items.forEach((item) => {
        itemSoldTotals.set(item.itemName, (itemSoldTotals.get(item.itemName) || 0) + item.quantity)
      })

      const bigCupSales = parseFloat(report.big_cup_sales) || 0
      const smallCupSales = parseFloat(report.small_cup_sales) || 0

      if (reportBigQty === 0 && bigCupSales > 0) {
        reportBigQty = getQuantityFromSalesAmount(
          bigCupSales,
          getCupCategoryPrice('big', predefinedSalesItems)
        )
      }
      if (reportSmallQty === 0 && smallCupSales > 0) {
        reportSmallQty = getQuantityFromSalesAmount(
          smallCupSales,
          getCupCategoryPrice('small', predefinedSalesItems)
        )
      }

      bigCupQtyByDate[date] += reportBigQty
      smallCupQtyByDate[date] += reportSmallQty
      totalBigCupQuantity += reportBigQty
      totalSmallCupQuantity += reportSmallQty

      const locId = report.location_id || 'unknown'
      const locName = report.location?.name || 'Unknown'
      const branch = getOrCreateBranch(locId, locName)
      overallReportDates.add(date)
      branch.reportDates.add(date)
      branch.grossSales += parseFloat(report.gross_sales) || 0
      branch.netSales += parseFloat(report.net_sales) || 0
      branch.bigCupSales += bigCupSales
      branch.smallCupSales += smallCupSales
      branch.bigCupQuantity += reportBigQty
      branch.smallCupQuantity += reportSmallQty
      branch.reportCount += 1

      dailyDsirRows.push({
        id: report.id,
        date,
        location: locName,
        grossSales: parseFloat(report.gross_sales || 0),
        bigCupQty: reportBigQty,
        smallCupQty: reportSmallQty,
        takeawayQty: qtys.takeaway,
        waterQty: qtys.water,
        ml500Qty: qtys.ml500,
        chocoQty: qtys.choco,
        itemsSold: items,
      })
    })

    // Fetch customer orders for quantity data
    let ordersQuery = supabase
      .from('customer_orders')
      .select(`
        id,
        created_at,
        location_id,
        location:locations(name, company_owned),
        order_details(
          quantity,
          products:products(category)
        )
      `)
      .eq('brand_id', selectedBrand.id)
      .in('status', ['paid', 'complete', 'fulfilled'])
      .gte('created_at', dateRange.start + 'T00:00:00')
      .lte('created_at', dateRange.end + 'T23:59:59')

    // Filter by location if selected
    if (selectedLocation) {
      ordersQuery = ordersQuery.eq('location_id', selectedLocation)
    }

    const { data: ordersData, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
    }

    // Filter orders by company owned if selected
    let orders = ordersData || []
    if (selectedCompanyOwned === 'true') {
      orders = orders.filter((order: any) => order.location?.company_owned === true)
    } else if (selectedCompanyOwned === 'false') {
      orders = orders.filter((order: any) => order.location?.company_owned === false)
    }

    // Prepare line graph data - gross sales over time
    const salesOverTime = filteredReports.reduce((acc: any, report) => {
      const date = report.report_date
      acc[date] = (acc[date] || 0) + (parseFloat(report.gross_sales) || 0)
      return acc
    }, {})
    
    // Prepare net sales over time
    const netSalesOverTime = filteredReports.reduce((acc: any, report) => {
      const date = report.report_date
      acc[date] = (acc[date] || 0) + (parseFloat(report.net_sales) || 0)
      return acc
    }, {})
    
    // Prepare big cup and small cup sales over time
    const bigCupSalesOverTime = filteredReports.reduce((acc: any, report) => {
      const date = report.report_date
      acc[date] = (acc[date] || 0) + (parseFloat(report.big_cup_sales) || 0)
      return acc
    }, {})
    
    const smallCupSalesOverTime = filteredReports.reduce((acc: any, report) => {
      const date = report.report_date
      acc[date] = (acc[date] || 0) + (parseFloat(report.small_cup_sales) || 0)
      return acc
    }, {})

    // Determine which category to show based on brand
    const brandSlug = selectedBrand.slug?.toLowerCase() || selectedBrand.name?.toLowerCase() || ''
    let targetCategory = ''
    let categoryKey = ''
    let categoryLabel = ''
    
    if (brandSlug === 'mychoice' || brandSlug.includes('mychoice')) {
      targetCategory = 'ice cream'
      categoryKey = 'iceCream'
      categoryLabel = 'Ice Cream'
    } else if (brandSlug === 'gelatofilipino' || brandSlug.includes('gelatofilipino')) {
      targetCategory = 'gelato'
      categoryKey = 'gelato'
      categoryLabel = 'Gelato'
    } else if (brandSlug === 'mang-sorbetes' || brandSlug === 'mang sorbetes' || brandSlug.includes('sorbetes')) {
      targetCategory = 'sorbetes'
      categoryKey = 'sorbetes'
      categoryLabel = 'Sorbetes'
    }

    // Prepare quantity data by date for the target category only
    const quantityByDate: { [date: string]: number } = {}
    
    if (orders && targetCategory) {
      orders.forEach(order => {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0]
        
        if (!quantityByDate[orderDate]) {
          quantityByDate[orderDate] = 0
        }

        if (order.order_details && Array.isArray(order.order_details)) {
          order.order_details.forEach((detail: any) => {
            const category = detail.products?.category?.toLowerCase().trim() || ''
            const quantity = parseInt(detail.quantity) || 0

            if (category === targetCategory) {
              quantityByDate[orderDate] += quantity
            }
          })
        }
      })
    }

    // Combine sales and quantity data by date
    const allDates = new Set<string>()
    Object.keys(salesOverTime).forEach(date => allDates.add(date))
    Object.keys(netSalesOverTime).forEach(date => allDates.add(date))
    Object.keys(quantityByDate).forEach(date => allDates.add(date))
    Object.keys(bigCupSalesOverTime).forEach(date => allDates.add(date))
    Object.keys(smallCupSalesOverTime).forEach(date => allDates.add(date))
    Object.keys(bigCupQtyByDate).forEach(date => allDates.add(date))
    Object.keys(smallCupQtyByDate).forEach(date => allDates.add(date))

    const lineGraphData = Array.from(allDates)
      .map(date => ({
        date,
        grossSales: Number(salesOverTime[date] || 0),
        netSales: Number(netSalesOverTime[date] || 0),
        bigCupSales: Number(bigCupSalesOverTime[date] || 0),
        smallCupSales: Number(smallCupSalesOverTime[date] || 0),
        bigCupQuantity: bigCupQtyByDate[date] || 0,
        smallCupQuantity: smallCupQtyByDate[date] || 0,
        [categoryKey]: quantityByDate[date] || 0,
        categoryLabel // Store label for graph rendering
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate total quantity for the selected category
    const totalQuantity = Object.values(quantityByDate).reduce((sum, qty) => sum + qty, 0)
    
    // Calculate sales per unit (big cups + small cups sales / total quantity)
    const totalCupSales = totalBigCupSales + totalSmallCupSales
    const salesPerUnit = totalQuantity > 0 ? totalCupSales / totalQuantity : 0
    const periodDays = calendarDaysInRange(dateRange.start, dateRange.end)
    const weeksInPeriod = weeksInDateRange(dateRange.start, dateRange.end)
    const dsirReportDays = overallReportDates.size
    const avgWeeklyCups = avgWeeklyFromPeriod(totalBigCupQuantity + totalSmallCupQuantity, weeksInPeriod)
    const avgWeeklyBigCups = avgWeeklyFromPeriod(totalBigCupQuantity, weeksInPeriod)
    const avgWeeklySmallCups = avgWeeklyFromPeriod(totalSmallCupQuantity, weeksInPeriod)

    const locationNameById = new Map<string, string>()
    locations.forEach(loc => locationNameById.set(loc.id, loc.name))
    filteredReports.forEach(r => {
      if (r.location_id && r.location?.name) {
        locationNameById.set(r.location_id, r.location.name)
      }
    })
    orders.forEach((order: any) => {
      if (order.location_id && order.location?.name) {
        locationNameById.set(order.location_id, order.location.name)
      }
    })

    const pansByLocationId: Record<string, number> = {}
    if (orders && targetCategory) {
      orders.forEach((order: any) => {
        const locId = order.location_id
        if (!locId) return
        if (!pansByLocationId[locId]) pansByLocationId[locId] = 0

        if (order.order_details && Array.isArray(order.order_details)) {
          order.order_details.forEach((detail: any) => {
            const category = detail.products?.category?.toLowerCase().trim() || ''
            const quantity = parseInt(detail.quantity) || 0
            if (category === targetCategory) {
              pansByLocationId[locId] += quantity
            }
          })
        }
      })
    }

    const branchBreakdownData = Object.values(branchMetrics)
      .map(b => {
        const totalCups = b.bigCupQuantity + b.smallCupQuantity
        const pans = pansByLocationId[b.locationId] || 0
        const cupSales = b.bigCupSales + b.smallCupSales
        const reportDays = b.reportDates.size
        return {
          location: b.location,
          grossSales: b.grossSales,
          netSales: b.netSales,
          bigCupQuantity: b.bigCupQuantity,
          smallCupQuantity: b.smallCupQuantity,
          totalCups,
          dsirReportDays: reportDays,
          avgWeeklyBigCups: avgWeeklyFromPeriod(b.bigCupQuantity, weeksInPeriod),
          avgWeeklySmallCups: avgWeeklyFromPeriod(b.smallCupQuantity, weeksInPeriod),
          pansDelivered: pans,
          salesPerPan: pans > 0 ? cupSales / pans : 0,
          reportCount: b.reportCount,
        }
      })
      .sort((a, b) => b.grossSales - a.grossSales)

    // Prepare pie graph data - sales by location
    const salesByLocation = filteredReports.reduce((acc: any, report) => {
      const locName = report.location?.name || 'Unknown'
      acc[locName] = (acc[locName] || 0) + (parseFloat(report.gross_sales) || 0)
      return acc
    }, {})
    const pieGraphData = Object.entries(salesByLocation)
      .map(([name, sales]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value: Number(sales)
      }))
      .sort((a, b) => b.value - a.value)

    // Prepare pie graph data - pans by location
    const pansByLocation: { [location: string]: number } = {}

    Object.entries(pansByLocationId).forEach(([locId, quantity]) => {
      const locName = locationNameById.get(locId) || 'Unknown'
      pansByLocation[locName] = (pansByLocation[locName] || 0) + quantity
    })

    const pansPieGraphData = Object.entries(pansByLocation)
      .map(([name, quantity]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value: Number(quantity)
      }))
      .sort((a, b) => b.value - a.value)

    setExpandedDsirRows({})
    setReportData({
      type: 'Branch Performance Report (DSIR)',
      period: `${dateRange.start} to ${dateRange.end}`,
      filterNote: selectedLocation
        ? `Location: ${locations.find((l) => l.id === selectedLocation)?.name || selectedLocation}`
        : '',
      summary: {
        totalGrossSales,
        totalNetSales,
        totalBigCupSales,
        totalSmallCupSales,
        totalBigCupQuantity,
        totalSmallCupQuantity,
        totalReports: filteredReports.length,
        totalQuantity,
        salesPerUnit,
        periodDays,
        weeksInPeriod,
        dsirReportDays,
        avgWeeklyCups,
        avgWeeklyBigCups,
        avgWeeklySmallCups,
        categoryLabel // Store for display in summary
      },
      lineGraphData,
      pieGraphData,
      pansPieGraphData,
      branchBreakdownData,
      itemSoldSummary: Array.from(itemSoldTotals.entries())
        .map(([itemName, quantity]) => ({ itemName, quantity }))
        .sort((a, b) => b.quantity - a.quantity || a.itemName.localeCompare(b.itemName)),
      tableData: dailyDsirRows.sort((a, b) => {
        const byDate = String(b.date).localeCompare(String(a.date))
        if (byDate !== 0) return byDate
        return String(a.location).localeCompare(String(b.location))
      }),
      categoryKey, // Store for conditional rendering
      categoryLabel // Store for display
    })
  }

  useEffect(() => {
    if (!dateRange.start || !dateRange.end) return
    if (reportType !== 'staff' && !selectedBrand?.id) return

    const runKey = [
      reportType,
      selectedBrand?.id || 'all',
      dateRange.start,
      dateRange.end,
      selectedLocation,
      selectedCompanyOwned,
      selectedBranch,
      selectedCategory,
      selectedStaff,
    ].join('|')
    if (reportAutoRunRef.current === runKey) return
    reportAutoRunRef.current = runKey

    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        switch (reportType) {
          case 'sales':
            await generateSalesReport()
            break
          case 'product':
            await generateProductPerformanceReport()
            break
          case 'staff':
            await generateStaffPerformanceReport()
            break
          case 'branch':
            await generateBranchPerformanceReport()
            break
          default:
            break
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error auto-generating report:', err)
          setError('Failed to generate report. Please try again.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [
    reportType,
    selectedBrand?.id,
    dateRange.start,
    dateRange.end,
    selectedLocation,
    selectedCompanyOwned,
    selectedBranch,
    selectedCategory,
    selectedStaff,
  ])

  const exportToCSV = () => {
    if (!reportData) return

    let csv = ''
    csv += `${reportData.type}\n`
    csv += `Period: ${reportData.period}\n\n`
    csv += 'Summary\n'
    Object.entries(reportData.summary).forEach(([key, value]) => {
      // Skip categoryLabel as it's just metadata
      if (key === 'categoryLabel') return
      
      let displayKey = key.replace(/([A-Z])/g, ' $1').trim()
      let displayValue = value
      
      // Format display key and value based on the field
      if (key === 'totalQuantity' && reportData.summary.categoryLabel) {
        displayKey = `Total ${reportData.summary.categoryLabel} Delivered`
        displayValue = typeof value === 'number' ? value.toLocaleString() : String(value)
      } else if (key === 'salesPerUnit' && reportData.type === 'Branch Performance Report (DSIR)') {
        displayKey = `Sales Per Pan`
        displayValue = typeof value === 'number' ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value)
      } else if (key === 'totalNetSales' && reportData.type === 'Branch Performance Report (DSIR)') {
        displayKey = `Net Sales`
        displayValue = typeof value === 'number' ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value)
      } else if (key === 'totalBigCupSales' && reportData.type === 'Branch Performance Report (DSIR)') {
        displayKey = `Big Cup Sales`
        displayValue = typeof value === 'number' ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value)
      } else if (key === 'totalSmallCupSales' && reportData.type === 'Branch Performance Report (DSIR)') {
        displayKey = `Small Cup Sales`
        displayValue = typeof value === 'number' ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value)
      } else if (key === 'totalBigCupQuantity' && reportData.type === 'Branch Performance Report (DSIR)') {
        displayKey = `Big Cups Sold`
        displayValue = typeof value === 'number' ? value.toLocaleString() : String(value)
      } else if (key === 'totalSmallCupQuantity' && reportData.type === 'Branch Performance Report (DSIR)') {
        displayKey = `Small Cups Sold`
        displayValue = typeof value === 'number' ? value.toLocaleString() : String(value)
      } else if (key === 'avgWeeklyCups' && reportData.type === 'Branch Performance Report (DSIR)') {
        return
      } else if (key === 'avgWeeklyBigCups' && reportData.type === 'Branch Performance Report (DSIR)') {
        displayKey = `Avg Weekly Big Cups Sold`
        displayValue = typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(value)
      } else if (key === 'avgWeeklySmallCups' && reportData.type === 'Branch Performance Report (DSIR)') {
        displayKey = `Avg Weekly Small Cups Sold`
        displayValue = typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(value)
      } else if (key === 'periodDays' || key === 'weeksInPeriod' || key === 'dsirReportDays') {
        return
      } else if (typeof value === 'number') {
        displayValue =
          key.includes('Sales') ||
          key.includes('Amount') ||
          key.includes('Value') ||
          key.includes('Payroll') ||
          key.includes('Pay') ||
          key.includes('Deduction') ||
          key.includes('Refund') ||
          key.includes('Per')
            ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : value.toLocaleString()
      } else {
        displayValue = String(value)
      }
      
      csv += `${displayKey},${displayValue}\n`
    })
    csv += '\n'

    // Add detailed data
    if (reportData.type === 'Order Sales Report' && reportData.orderSales) {
      const sales: OrderSalesReportData = reportData.orderSales
      const franchiseCols = sales.includeFranchiseReceivables
      csv += 'Summary by Location\n'
      csv +=
        [
          'Location',
          ...sales.categories,
          'Total',
          ...(franchiseCols ? ['Discount', 'Payable', 'Paid Amt', 'Balance'] : []),
        ].join(',') + '\n'
      sales.summaryRows.forEach((row) => {
        const cells = sales.categories.map((c) => row.amountsByCategory[c] || 0)
        const franchise = franchiseCols
          ? [
              row.franchise?.discount || 0,
              row.franchise?.payable || 0,
              row.franchise?.paidAmt || 0,
              row.franchise?.balance || 0,
            ]
          : []
        csv += [row.locationName, ...cells, row.locationTotal, ...franchise].join(',') + '\n'
      })
      csv +=
        [
          'TOTAL',
          ...sales.categories.map((c) => sales.categoryTotals[c] || 0),
          sales.grandTotal,
          ...(franchiseCols
            ? [
                sales.franchiseTotals?.discount || 0,
                sales.franchiseTotals?.payable || 0,
                sales.franchiseTotals?.paidAmt || 0,
                sales.franchiseTotals?.balance || 0,
              ]
            : []),
        ].join(',') + '\n\n'

      csv += 'Location Detail\n'
      csv += 'Location,Category,SKU,Product,Quantity,Amount\n'
      sales.locations.forEach((loc) => {
        loc.categories.forEach((cat) => {
          cat.products.forEach((p) => {
            const safeName = `"${(p.name || '').replace(/"/g, '""')}"`
            const safeSku = `"${(p.sku || '').replace(/"/g, '""')}"`
            csv += `${loc.locationName},${cat.name},${safeSku},${safeName},${p.qty},${p.amount}\n`
          })
        })
      })
    } else if (reportData.tableData) {
      csv += 'Data\n'
      if (reportData.type === 'Order Sales Report') {
        csv += 'Date,Location,Amount\n'
        reportData.tableData.forEach((row: any) => {
          csv += `${row.date},${row.location},${row.amount}\n`
        })
      } else if (reportData.type === 'Product Performance Report') {
        csv += 'Product Name,Quantity,Amount\n'
        reportData.tableData.forEach((row: any) => {
          csv += `${row.productName},${row.quantity},${row.amount}\n`
        })
      } else if (reportData.type === 'Staff Performance Report') {
        csv +=
          'Staff Name,Working Days,DSIR Days,Hours,Average Sales,Total Gross Sales,Big Cups,Small Cups,Takeaway,Water,500ml,Choco,Regular Pay,OT Pay,Double Pay,Special Pay,Incentive,Deductions,Refunds,Net Pay\n'
        reportData.tableData.forEach((row: any) => {
          csv += `${row.staffName},${row.workingDays || 0},${row.dsirDays || 0},${Number(row.totalWorkingHours || 0).toFixed(1)},${Number(row.averageSales || 0).toFixed(2)},${Number(row.totalGrossSales || 0).toFixed(2)},${row.bigCupQty || 0},${row.smallCupQty || 0},${row.takeawayQty || 0},${row.waterQty || 0},${row.ml500Qty || 0},${row.chocoQty || 0},${Number(row.regularPay || 0).toFixed(2)},${Number(row.overtimePay || 0).toFixed(2)},${Number(row.doublePay || 0).toFixed(2)},${Number(row.specialPay || 0).toFixed(2)},${Number(row.incentivePay || 0).toFixed(2)},${Number(row.totalDeductions || 0).toFixed(2)},${Number(row.refunds || 0).toFixed(2)},${Number(row.totalPayroll || 0).toFixed(2)}\n`
        })
        csv += '\nWorking Days Breakdown\n'
        csv +=
          'Staff Name,Date,Location,Day Type,Hours,DSIR Sales,Big Cups,Small Cups,Takeaway,Water,500ml,Choco,Items Sold\n'
        reportData.tableData.forEach((row: any) => {
          ;(row.dailyBreakdown || []).forEach((day: any) => {
            const dayType =
              day.dayType === 'regular-holiday'
                ? 'Double'
                : day.dayType === 'special-holiday'
                  ? 'Special'
                  : 'Regular'
            const items =
              (day.itemsSold || [])
                .map((i: any) => `${i.itemName}:${i.quantity}`)
                .join('; ') || ''
            csv += `${row.staffName},${day.date},${day.locationName},${dayType},${Number(day.hours || 0).toFixed(1)},${Number(day.sales || 0).toFixed(2)},${day.bigCupQty || 0},${day.smallCupQty || 0},${day.takeawayQty || 0},${day.waterQty || 0},${day.ml500Qty || 0},${day.chocoQty || 0},"${items}"\n`
          })
        })
      } else if (reportData.type === 'Branch Performance Report (DSIR)') {
        if (reportData.itemSoldSummary?.length) {
          csv += 'Items Sold (Period)\n'
          csv += 'Item,Quantity Sold\n'
          reportData.itemSoldSummary.forEach((row: any) => {
            csv += `${row.itemName},${row.quantity}\n`
          })
          csv += '\n'
        }
        if (reportData.branchBreakdownData?.length) {
          csv += 'Branch Breakdown\n'
          csv += 'Location,Gross Sales,Net Sales,Big Cups,Small Cups,Total Cups,DSIR Days,Avg Weekly Big Cups,Avg Weekly Small Cups,Pans Delivered,Sales Per Pan,DSIR Submissions\n'
          reportData.branchBreakdownData.forEach((row: any) => {
            csv += `${row.location},${row.grossSales.toFixed(2)},${row.netSales.toFixed(2)},${row.bigCupQuantity},${row.smallCupQuantity},${row.totalCups},${row.dsirReportDays},${row.avgWeeklyBigCups.toFixed(1)},${row.avgWeeklySmallCups.toFixed(1)},${row.pansDelivered},${row.salesPerPan.toFixed(2)},${row.reportCount}\n`
          })
          csv += '\n'
        }
        csv += 'Daily DSIR Data\n'
        csv +=
          'Date,Location,Gross Sales,Big Cups,Small Cups,Takeaway,Water,500ml,Choco,Items Sold\n'
        reportData.tableData.forEach((row: any) => {
          const items =
            (row.itemsSold || [])
              .map((i: any) => `${i.itemName}:${i.quantity}`)
              .join('; ') || ''
          csv += `${row.date},${row.location},${row.grossSales},${row.bigCupQty || 0},${row.smallCupQty || 0},${row.takeawayQty || 0},${row.waterQty || 0},${row.ml500Qty || 0},${row.chocoQty || 0},"${items}"\n`
        })
      }
    }

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportData.type.replace(/\s+/g, '_')}_${dateRange.start}_to_${dateRange.end}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const exportOrderSalesPdf = () => {
    if (!reportData?.orderSales || reportData.type !== 'Order Sales Report') return
    const opened = openOrderSalesReportPrintWindow({
      brandName: selectedBrand?.name || 'Brand',
      periodLabel: reportData.period,
      filterNote: reportData.filterNote || '',
      generatedByUsername: currentUsername,
      generatedByRole: currentRoleLabel,
      report: reportData.orderSales as OrderSalesReportData,
    })
    if (!opened) {
      setError('Pop-up blocked. Allow pop-ups to export the PDF.')
    }
  }

  const exportBranchPerformancePdf = () => {
    if (reportData?.type !== 'Branch Performance Report (DSIR)') return
    const opened = openBranchPerformanceReportPrintWindow({
      brandName: selectedBrand?.name || 'Brand',
      periodLabel: reportData.period,
      filterNote: reportData.filterNote || '',
      generatedByUsername: currentUsername,
      generatedByRole: currentRoleLabel,
      summary: {
        totalGrossSales: Number(reportData.summary?.totalGrossSales) || 0,
        totalNetSales: Number(reportData.summary?.totalNetSales) || 0,
        totalBigCupSales: Number(reportData.summary?.totalBigCupSales) || 0,
        totalSmallCupSales: Number(reportData.summary?.totalSmallCupSales) || 0,
        totalBigCupQuantity: Number(reportData.summary?.totalBigCupQuantity) || 0,
        totalSmallCupQuantity: Number(reportData.summary?.totalSmallCupQuantity) || 0,
        totalReports: Number(reportData.summary?.totalReports) || 0,
        totalQuantity: Number(reportData.summary?.totalQuantity) || 0,
        salesPerUnit: Number(reportData.summary?.salesPerUnit) || 0,
        periodDays: Number(reportData.summary?.periodDays) || 0,
        weeksInPeriod: Number(reportData.summary?.weeksInPeriod) || 0,
        dsirReportDays: Number(reportData.summary?.dsirReportDays) || 0,
        avgWeeklyBigCups: Number(reportData.summary?.avgWeeklyBigCups) || 0,
        avgWeeklySmallCups: Number(reportData.summary?.avgWeeklySmallCups) || 0,
        categoryLabel: reportData.summary?.categoryLabel || reportData.categoryLabel,
      },
      branchBreakdown: reportData.branchBreakdownData || [],
      itemSoldSummary: reportData.itemSoldSummary || [],
      dailyRows: (reportData.tableData || []).map(
        (row: {
          date: string
          location: string
          grossSales: number
          bigCupQty?: number
          smallCupQty?: number
          takeawayQty?: number
          waterQty?: number
          ml500Qty?: number
          chocoQty?: number
          itemsSold?: Array<{ itemName: string; quantity: number }>
        }) => ({
          date: row.date,
          location: row.location,
          grossSales: Number(row.grossSales) || 0,
          bigCupQty: Number(row.bigCupQty) || 0,
          smallCupQty: Number(row.smallCupQty) || 0,
          takeawayQty: Number(row.takeawayQty) || 0,
          waterQty: Number(row.waterQty) || 0,
          ml500Qty: Number(row.ml500Qty) || 0,
          chocoQty: Number(row.chocoQty) || 0,
          itemsSold: (row.itemsSold || []).map((i) => ({
            itemName: i.itemName,
            quantity: Number(i.quantity) || 0,
          })),
        })
      ),
    })
    if (!opened) {
      setError('Pop-up blocked. Allow pop-ups to export the PDF.')
    }
  }

  const exportProductPerformancePdf = () => {
    if (reportData?.type !== 'Product Performance Report') return
    const opened = openProductPerformanceReportPrintWindow({
      brandName: selectedBrand?.name || 'Brand',
      periodLabel: reportData.period,
      filterNote: reportData.filterNote || '',
      generatedByUsername: currentUsername,
      generatedByRole: currentRoleLabel,
      totalQuantity: Number(reportData.summary?.totalQuantity) || 0,
      totalAmount: Number(reportData.summary?.totalAmount) || 0,
      rows: (reportData.tableData || []).map(
        (row: { productName: string; quantity: number; amount: number }) => ({
          productName: row.productName,
          quantity: Number(row.quantity) || 0,
          amount: Number(row.amount) || 0,
        })
      ),
    })
    if (!opened) {
      setError('Pop-up blocked. Allow pop-ups to export the PDF.')
    }
  }

  const exportStaffPerformancePdf = () => {
    if (reportData?.type !== 'Staff Performance Report') return
    const opened = openStaffPerformanceReportPrintWindow({
      brandName: selectedBrand?.name || 'Brand',
      periodLabel: reportData.period,
      filterNote: reportData.filterNote || '',
      generatedByUsername: currentUsername,
      generatedByRole: currentRoleLabel,
      totalStaff: Number(reportData.summary?.totalStaff) || 0,
      averageSales: Number(reportData.summary?.averageSales) || 0,
      totalGrossSales: Number(reportData.summary?.totalGrossSales) || 0,
      totalPayroll: Number(reportData.summary?.totalPayroll) || 0,
      totalDoublePay: Number(reportData.summary?.totalDoublePay) || 0,
      totalSpecialPay: Number(reportData.summary?.totalSpecialPay) || 0,
      totalOvertimePay: Number(reportData.summary?.totalOvertimePay) || 0,
      totalIncentivePay: Number(reportData.summary?.totalIncentivePay) || 0,
      totalDeductions: Number(reportData.summary?.totalDeductions) || 0,
      totalRefunds: Number(reportData.summary?.totalRefunds) || 0,
      rows: (reportData.tableData || []).map(
        (row: {
          staffName: string
          averageSales: number
          totalGrossSales: number
          workingDays?: number
          dsirDays?: number
          totalWorkingHours: number
          regularPay?: number
          overtimePay?: number
          doublePay?: number
          specialPay?: number
          incentivePay?: number
          totalDeductions?: number
          refunds?: number
          totalPayroll: number
          bigCupQty?: number
          smallCupQty?: number
          takeawayQty?: number
          waterQty?: number
          ml500Qty?: number
          chocoQty?: number
          dailyBreakdown?: Array<{
            date: string
            locationName: string
            hours: number
            dayType: string
            sales: number
            bigCupQty?: number
            smallCupQty?: number
            takeawayQty?: number
            waterQty?: number
            ml500Qty?: number
            chocoQty?: number
            itemsSold?: Array<{ itemName: string; quantity: number }>
          }>
        }) => ({
          staffName: row.staffName,
          averageSales: Number(row.averageSales) || 0,
          totalGrossSales: Number(row.totalGrossSales) || 0,
          workingDays: Number(row.workingDays) || 0,
          dsirDays: Number(row.dsirDays) || 0,
          totalWorkingHours: Number(row.totalWorkingHours) || 0,
          regularPay: Number(row.regularPay) || 0,
          overtimePay: Number(row.overtimePay) || 0,
          doublePay: Number(row.doublePay) || 0,
          specialPay: Number(row.specialPay) || 0,
          incentivePay: Number(row.incentivePay) || 0,
          totalDeductions: Number(row.totalDeductions) || 0,
          refunds: Number(row.refunds) || 0,
          totalPayroll: Number(row.totalPayroll) || 0,
          bigCupQty: Number(row.bigCupQty) || 0,
          smallCupQty: Number(row.smallCupQty) || 0,
          takeawayQty: Number(row.takeawayQty) || 0,
          waterQty: Number(row.waterQty) || 0,
          ml500Qty: Number(row.ml500Qty) || 0,
          chocoQty: Number(row.chocoQty) || 0,
          dailyBreakdown: (row.dailyBreakdown || []).map((d) => ({
            date: d.date,
            locationName: d.locationName,
            hours: Number(d.hours) || 0,
            dayType: d.dayType || 'default',
            sales: Number(d.sales) || 0,
            bigCupQty: Number(d.bigCupQty) || 0,
            smallCupQty: Number(d.smallCupQty) || 0,
            takeawayQty: Number(d.takeawayQty) || 0,
            waterQty: Number(d.waterQty) || 0,
            ml500Qty: Number(d.ml500Qty) || 0,
            chocoQty: Number(d.chocoQty) || 0,
            itemsSold: (d.itemsSold || []).map((i) => ({
              itemName: i.itemName,
              quantity: Number(i.quantity) || 0,
            })),
          })),
        })
      ),
    })
    if (!opened) {
      setError('Pop-up blocked. Allow pop-ups to export the PDF.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-600">View sales, product, staff, and branch performance reports</p>
      </div>

      {/* Report Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Report Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => setReportType('sales')}
            className={`p-4 border-2 rounded-lg text-left transition-colors ${
              reportType === 'sales'
                ? theme === 'green' ? 'border-green-500 bg-green-50' :
                  theme === 'red' ? 'border-red-500 bg-red-50' :
                  theme === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <DollarSign className={`h-6 w-6 mb-2 ${reportType === 'sales' ? 'text-blue-600' : 'text-gray-400'}`} />
            <div className="font-medium text-sm">Order Sales Report</div>
          </button>
          <button
            onClick={() => setReportType('product')}
            className={`p-4 border-2 rounded-lg text-left transition-colors ${
              reportType === 'product'
                ? theme === 'green' ? 'border-green-500 bg-green-50' :
                  theme === 'red' ? 'border-red-500 bg-red-50' :
                  theme === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Package className={`h-6 w-6 mb-2 ${reportType === 'product' ? 'text-blue-600' : 'text-gray-400'}`} />
            <div className="font-medium text-sm">Product Performance</div>
          </button>
          <button
            onClick={() => setReportType('staff')}
            className={`p-4 border-2 rounded-lg text-left transition-colors ${
              reportType === 'staff'
                ? theme === 'green' ? 'border-green-500 bg-green-50' :
                  theme === 'red' ? 'border-red-500 bg-red-50' :
                  theme === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Users className={`h-6 w-6 mb-2 ${reportType === 'staff' ? 'text-blue-600' : 'text-gray-400'}`} />
            <div className="font-medium text-sm">Staff Performance</div>
          </button>
          <button
            onClick={() => setReportType('branch')}
            className={`p-4 border-2 rounded-lg text-left transition-colors ${
              reportType === 'branch'
                ? theme === 'green' ? 'border-green-500 bg-green-50' :
                  theme === 'red' ? 'border-red-500 bg-red-50' :
                  theme === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <BarChart3 className={`h-6 w-6 mb-2 ${reportType === 'branch' ? 'text-blue-600' : 'text-gray-400'}`} />
            <div className="font-medium text-sm">Branch Performance</div>
          </button>
        </div>

        {/* Date Range Presets */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          <div className="flex flex-wrap gap-2 mb-3">
          <button
              type="button"
              onClick={() => setDateRangePresetValue('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRangePreset === '7days'
                  ? theme === 'green' ? 'bg-green-600 text-white' :
                    theme === 'red' ? 'bg-red-600 text-white' :
                    theme === 'yellow' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 7 Days
          </button>
          <button
              type="button"
              onClick={() => setDateRangePresetValue('30days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRangePreset === '30days'
                  ? theme === 'green' ? 'bg-green-600 text-white' :
                    theme === 'red' ? 'bg-red-600 text-white' :
                    theme === 'yellow' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setDateRangePresetValue('365days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRangePreset === '365days'
                  ? theme === 'green' ? 'bg-green-600 text-white' :
                    theme === 'red' ? 'bg-red-600 text-white' :
                    theme === 'yellow' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 365 Days
            </button>
            <button
              type="button"
              onClick={() => setDateRangePresetValue('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRangePreset === 'month'
                  ? theme === 'green' ? 'bg-green-600 text-white' :
                    theme === 'red' ? 'bg-red-600 text-white' :
                    theme === 'yellow' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              By Month
            </button>
            <button
              type="button"
              onClick={() => setDateRangePresetValue('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRangePreset === 'custom'
                  ? theme === 'green' ? 'bg-green-600 text-white' :
                    theme === 'red' ? 'bg-red-600 text-white' :
                    theme === 'yellow' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Custom Range
          </button>
          </div>
          {dateRangePreset === 'month' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700" htmlFor="report-month-picker">
                Month
              </label>
              <input
                id="report-month-picker"
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-xs text-gray-500">
                {dateRange.start && dateRange.end
                  ? `${dateRange.start} to ${dateRange.end}`
                  : 'Select a month'}
              </span>
            </div>
          )}
        </div>

        {/* Filters - Single Row */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          {/* Date Range Inputs - always shown */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Order Sales Report Filters */}
          {reportType === 'sales' && (
            <>
              <div className="flex-shrink-0 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Ownership</label>
                <select
                  value={selectedCompanyOwned}
                  onChange={(e) => {
                    setSelectedCompanyOwned(e.target.value)
                    setSelectedBranch('') // Reset branch when ownership changes
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">Company Owned</option>
                  <option value="false">Franchise</option>
                </select>
              </div>
              <div className="flex-shrink-0 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Branches</option>
                  {branches
                    .filter(branch => {
                      if (selectedCompanyOwned === '') return true
                      if (selectedCompanyOwned === 'true') return branch.company_owned === true
                      if (selectedCompanyOwned === 'false') return branch.company_owned === false
                      return true
                    })
                    .map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))
                  }
                </select>
              </div>
            </>
          )}

          {/* Product Performance Filters */}
          {reportType === 'product' && (
            <div className="flex-shrink-0 min-w-[150px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {/* Staff Performance Filters */}
          {reportType === 'staff' && (
            <>
              <div className="flex-shrink-0 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
                <select
                  value={selectedBrand?.id || 'all'}
                  onChange={(e) => {
                    if (e.target.value === 'all') {
                      setSelectedBrand(null)
                    } else {
                      const brand = brands.find(b => b.id === e.target.value)
                      if (brand) {
                        setSelectedBrand(brand)
                      }
                    }
                    // Clear report data when brand changes
                    setReportData(null)
                    setError('')
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  disabled={brandsLoading}
                >
                  {brandsLoading ? (
                    <option>Loading...</option>
                  ) : (
                    <>
                      <option value="all">All Brands</option>
                      {brands.map(brand => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div className="flex-shrink-0 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Staff Name</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Staff</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-shrink-0 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Branch Performance Filters */}
          {reportType === 'branch' && (
            <>
              <div className="flex-shrink-0 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Ownership</label>
                <select
                  value={selectedCompanyOwned}
                  onChange={(e) => {
                    setSelectedCompanyOwned(e.target.value)
                    setSelectedLocation('') // Reset location when ownership changes
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">Company Owned</option>
                  <option value="false">Franchise</option>
                </select>
              </div>
              <div className="flex-shrink-0 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Locations</option>
                  {locations
                    .filter(loc => {
                      if (selectedCompanyOwned === '') return true // Show all if "All" is selected
                      if (selectedCompanyOwned === 'true') return loc.company_owned === true
                      if (selectedCompanyOwned === 'false') return loc.company_owned === false
                      return true
                    })
                    .map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))
                  }
                </select>
              </div>
            </>
          )}

        {/* Generate Button */}
          <div className="flex-shrink-0">
        <button
          onClick={generateReport}
          disabled={loading || !reportType}
              className={`px-4 py-1.5 text-sm text-white rounded-lg transition-colors ${
            theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
            theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
            theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
            'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 whitespace-nowrap`}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4" />
              <span>Generate Report</span>
            </>
          )}
        </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{reportData.type}</h2>
              <p className="text-sm text-gray-600">Period: {reportData.period}</p>
              {reportData.filterNote ? (
                <p className="text-xs text-gray-500 mt-0.5">{reportData.filterNote}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {reportData.type === 'Order Sales Report' && reportData.orderSales ? (
                <button
                  type="button"
                  onClick={exportOrderSalesPdf}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  <span>Export PDF</span>
                </button>
              ) : null}
              {reportData.type === 'Branch Performance Report (DSIR)' ? (
                <button
                  type="button"
                  onClick={exportBranchPerformancePdf}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  <span>Export PDF</span>
                </button>
              ) : null}
              {reportData.type === 'Product Performance Report' ? (
                <button
                  type="button"
                  onClick={exportProductPerformancePdf}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  <span>Export PDF</span>
                </button>
              ) : null}
              {reportData.type === 'Staff Performance Report' ? (
                <button
                  type="button"
                  onClick={exportStaffPerformancePdf}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  <span>Export PDF</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={exportToCSV}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Summary</h3>
            
            {/* Branch Performance Report - Custom Layout */}
            {reportData.type === 'Branch Performance Report (DSIR)' && (
              <>
                {/* Main Metrics Row */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Gross Sales</p>
                    <p className="text-xl font-semibold text-gray-900">
                      ₱{reportData.summary.totalGrossSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Net Sales</p>
                    <p className="text-xl font-semibold text-gray-900">
                      ₱{reportData.summary.totalNetSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total DSIR Reports</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {reportData.summary.totalReports?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">
                      {reportData.summary.categoryLabel ? `Total ${reportData.summary.categoryLabel} Delivered` : 'Total Quantity'}
                    </p>
                    <p className="text-xl font-semibold text-gray-900">
                      {reportData.summary.totalQuantity?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>
                
                {/* Cup Sales Row */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">Big Cup Sales</p>
                    <p className="text-xl font-semibold text-gray-900">
                      ₱{reportData.summary.totalBigCupSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {reportData.summary.totalBigCupQuantity?.toLocaleString() || '0'} cups sold
                      {reportData.summary.avgWeeklyBigCups != null && reportData.summary.periodDays > 0 ? (
                        <span className="block">
                          {reportData.summary.avgWeeklyBigCups.toLocaleString(undefined, { maximumFractionDigits: 1 })} avg/week
                          <span className="text-xs text-gray-400"> · {reportData.summary.periodDays}-day period</span>
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">Small Cup Sales</p>
                    <p className="text-xl font-semibold text-gray-900">
                      ₱{reportData.summary.totalSmallCupSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {reportData.summary.totalSmallCupQuantity?.toLocaleString() || '0'} cups sold
                      {reportData.summary.avgWeeklySmallCups != null && reportData.summary.periodDays > 0 ? (
                        <span className="block">
                          {reportData.summary.avgWeeklySmallCups.toLocaleString(undefined, { maximumFractionDigits: 1 })} avg/week
                          <span className="text-xs text-gray-400"> · {reportData.summary.periodDays}-day period</span>
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600 mb-1">Sales Per Pan</p>
                    <p className="text-xl font-semibold text-gray-900">
                      ₱{reportData.summary.salesPerUnit?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </p>
                    {reportData.summary.totalQuantity > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {reportData.summary.totalQuantity.toLocaleString()} {reportData.summary.categoryLabel?.toLowerCase() || 'pan'} delivered
                      </p>
                    )}
                  </div>
                </div>

                {reportData.branchBreakdownData && reportData.branchBreakdownData.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Branch Breakdown</h4>
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross Sales</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Big Cups</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg/Wk Big</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Small Cups</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg/Wk Small</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            {reportData.summary.categoryLabel ? `${reportData.summary.categoryLabel} Pans` : 'Pans'}
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Sales / Pan</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">DSIR Days</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.branchBreakdownData.map((row: any, index: number) => (
                          <tr key={index}>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">{row.location}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">
                              ₱{Number(row.grossSales).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">{Number(row.bigCupQuantity).toLocaleString()}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">
                              {Number(row.avgWeeklyBigCups).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">{Number(row.smallCupQuantity).toLocaleString()}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">
                              {Number(row.avgWeeklySmallCups).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">{Number(row.pansDelivered).toLocaleString()}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">
                              ₱{Number(row.salesPerPan).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">{Number(row.dsirReportDays).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {reportData.itemSoldSummary && reportData.itemSoldSummary.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Items Sold</h4>
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Item
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Qty Sold
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.itemSoldSummary.map(
                          (row: { itemName: string; quantity: number }, index: number) => (
                            <tr key={`${row.itemName}-${index}`}>
                              <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                                {row.itemName}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900 tabular-nums">
                                {Number(row.quantity).toLocaleString()}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            
            {/* Other Summary Items */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(reportData.summary).map(([key, value]) => {
                // Skip these as they're in their own row for branch performance
                if (reportData.type === 'Branch Performance Report (DSIR)' && 
                    (key === 'categoryLabel' || key === 'totalGrossSales' || key === 'totalNetSales' || key === 'totalBigCupSales' || key === 'totalSmallCupSales' || key === 'totalBigCupQuantity' || key === 'totalSmallCupQuantity' || key === 'salesPerUnit' || key === 'totalReports' || key === 'totalQuantity' || key === 'periodDays' || key === 'weeksInPeriod' || key === 'dsirReportDays' || key === 'avgWeeklyCups' || key === 'avgWeeklyBigCups' || key === 'avgWeeklySmallCups')) return null
                
                let displayKey = key.replace(/([A-Z])/g, ' $1').trim()
                let displayValue: string = ''
                
                // Format display key and value based on the field
                if (key === 'totalQuantity' && reportData.summary.categoryLabel) {
                  displayKey = `Total ${reportData.summary.categoryLabel} Quantity`
                  displayValue = typeof value === 'number' ? value.toLocaleString() : String(value)
                } else if (typeof value === 'number') {
                  displayValue =
                    key.includes('Sales') ||
                    key.includes('Amount') ||
                    key.includes('Value') ||
                    key.includes('Payroll') ||
                    key.includes('Pay') ||
                    key.includes('Deduction') ||
                    key.includes('Refund') ||
                    key.includes('Per')
                      ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : value.toLocaleString()
                } else {
                  displayValue = String(value)
                }
                
                return (
                <div key={key} className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">{displayKey}</p>
                    <p className="text-xl font-semibold text-gray-900">{displayValue}</p>
                </div>
                )
              })}
            </div>
          </div>

          {/* Charts */}
          {reportData.type === 'Order Sales Report' && (
            <div className="mb-6 space-y-6">
              {reportData.dailySalesData && reportData.dailySalesData.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Sales Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={reportData.dailySalesData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: any) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        labelStyle={{ color: '#000' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="Sales" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {reportData.salesByLocationData && reportData.salesByLocationData.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Sales by Location</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.salesByLocationData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={100}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: any) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        labelStyle={{ color: '#000' }}
                      />
                      <Legend />
                      <Bar dataKey="sales" fill="#3b82f6" name="Sales" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {reportData.type === 'Product Performance Report' && (
            <div className="mb-6 space-y-6">
              {reportData.barGraphData && reportData.barGraphData.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Product Performance</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={reportData.barGraphData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.toLocaleString()}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={140}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => {
                          if (name === 'Amount') {
                            return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          }
                          return value.toLocaleString()
                        }}
                        labelStyle={{ color: '#000' }}
                      />
                      <Legend />
                      <Bar dataKey="quantity" fill="#3b82f6" name="Quantity" />
                      <Bar dataKey="amount" fill="#10b981" name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {reportData.pieGraphData && reportData.pieGraphData.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Product Distribution</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={reportData.pieGraphData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => {
                          if (percent < 0.05) return '' // Hide labels for slices < 5%
                          return `${name}: ${(percent * 100).toFixed(0)}%`
                        }}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {reportData.pieGraphData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => value.toLocaleString()}
                        labelStyle={{ color: '#000' }}
                      />
                      <Legend 
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry: any) => `${value} (${((entry.payload.value / reportData.pieGraphData.reduce((sum: number, item: any) => sum + item.value, 0)) * 100).toFixed(1)}%)`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
            </div>
              )}
          </div>
          )}

          {reportData.type === 'Staff Performance Report' && (
            <div className="mb-6">
              {reportData.lineGraphData && reportData.lineGraphData.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Average Sales Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={reportData.lineGraphData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: any) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        labelStyle={{ color: '#000' }}
                      />
                      <Legend />
                      {Object.keys(reportData.lineGraphData[0] || {}).filter(key => key !== 'date').map((staffName, index) => (
                        <Line 
                          key={staffName} 
                          type="monotone" 
                          dataKey={staffName} 
                          stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} 
                          strokeWidth={2} 
                          name={staffName} 
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {reportData.type === 'Branch Performance Report (DSIR)' && (
            <div className="mb-6 space-y-6">
              {reportData.lineGraphData && reportData.lineGraphData.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Sales Breakdown & Product Quantities Over Time</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={reportData.lineGraphData} margin={{ top: 5, right: 50, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        yAxisId="sales"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                        label={{ value: 'Sales (₱)', angle: -90, position: 'insideLeft' }}
                      />
                      <YAxis 
                        yAxisId="quantity"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.toLocaleString()}
                        label={{ 
                          value: reportData.categoryLabel ? `${reportData.categoryLabel} Delivered` : 'Quantity', 
                          angle: 90, 
                          position: 'insideRight' 
                        }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => {
                          if (name === 'Gross Sales' || name === 'Net Sales' || name === 'Big Cup Sales' || name === 'Small Cup Sales') {
                            return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          }
                          if (name === 'Big Cups Sold' || name === 'Small Cups Sold') {
                            return `${Number(value).toLocaleString()} cups`
                          }
                          return `${Number(value).toLocaleString()} units`
                        }}
                        labelStyle={{ color: '#000' }}
                      />
                      <Legend />
                      <Line 
                        yAxisId="sales"
                        type="monotone" 
                        dataKey="grossSales" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        name="Gross Sales" 
                      />
                      <Line 
                        yAxisId="sales"
                        type="monotone" 
                        dataKey="netSales" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        name="Net Sales" 
                      />
                      <Line 
                        yAxisId="sales"
                        type="monotone" 
                        dataKey="bigCupSales" 
                        stroke="#8b5cf6" 
                        strokeWidth={2} 
                        name="Big Cup Sales" 
                      />
                      <Line 
                        yAxisId="sales"
                        type="monotone" 
                        dataKey="smallCupSales" 
                        stroke="#ec4899" 
                        strokeWidth={2} 
                        name="Small Cup Sales" 
                      />
                      <Line 
                        yAxisId="quantity"
                        type="monotone" 
                        dataKey="bigCupQuantity" 
                        stroke="#6366f1" 
                        strokeWidth={2} 
                        strokeDasharray="5 5"
                        name="Big Cups Sold" 
                      />
                      <Line 
                        yAxisId="quantity"
                        type="monotone" 
                        dataKey="smallCupQuantity" 
                        stroke="#d946ef" 
                        strokeWidth={2} 
                        strokeDasharray="5 5"
                        name="Small Cups Sold" 
                      />
                      {reportData.categoryKey && reportData.categoryLabel && (
                        <Line 
                          yAxisId="quantity"
                          type="monotone" 
                          dataKey={reportData.categoryKey} 
                          stroke={
                            reportData.categoryKey === 'iceCream' ? '#f59e0b' :
                            reportData.categoryKey === 'gelato' ? '#06b6d4' :
                            '#ef4444'
                          }
                          strokeWidth={2} 
                          name={`${reportData.categoryLabel} Delivered`} 
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportData.pieGraphData && reportData.pieGraphData.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Sales by Location</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={reportData.pieGraphData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => {
                            if (percent < 0.05) return '' // Hide labels for slices < 5%
                            return `${name}: ${(percent * 100).toFixed(0)}%`
                          }}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportData.pieGraphData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          labelStyle={{ color: '#000' }}
                        />
                        <Legend 
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value, entry: any) => {
                            const total = reportData.pieGraphData.reduce((sum: number, item: any) => sum + item.value, 0)
                            return `${value} (${((entry.payload.value / total) * 100).toFixed(1)}%)`
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {reportData.pansPieGraphData && reportData.pansPieGraphData.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 mb-3">
                      {reportData.categoryLabel ? `${reportData.categoryLabel} Pans by Location` : 'Pans by Location'}
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={reportData.pansPieGraphData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => {
                            if (percent < 0.05) return '' // Hide labels for slices < 5%
                            return `${name}: ${(percent * 100).toFixed(0)}%`
                          }}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportData.pansPieGraphData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => `${Number(value).toLocaleString()} pans`}
                          labelStyle={{ color: '#000' }}
                        />
                        <Legend 
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value, entry: any) => {
                            const total = reportData.pansPieGraphData.reduce((sum: number, item: any) => sum + item.value, 0)
                            return `${value} (${((entry.payload.value / total) * 100).toFixed(1)}%)`
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Sales — summary matrix + location detail */}
          {reportData.type === 'Order Sales Report' && reportData.orderSales && (
            <div className="space-y-8">
              {(() => {
                const sales = reportData.orderSales as OrderSalesReportData
                const brandAccent = getBrandHighlightClasses(selectedBrand?.name)
                return (
                  <>
                    <div className="overflow-x-auto">
                      <h3 className="text-md font-semibold text-gray-900 mb-3">Summary by Location</h3>
                      {sales.summaryRows.length === 0 ? (
                        <p className="text-sm text-gray-500">No sales in this period.</p>
                      ) : (
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead>
                            <tr className={brandAccent.row}>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">
                                Location
                              </th>
                              {sales.categories.map((cat) => (
                                <th
                                  key={cat}
                                  className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                                >
                                  {cat}
                                </th>
                              ))}
                              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">
                                Total
                              </th>
                              {sales.includeFranchiseReceivables ? (
                                <>
                                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                                    Discount
                                  </th>
                                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                                    Payable
                                  </th>
                                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                                    Paid Amt
                                  </th>
                                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                                    Balance
                                  </th>
                                </>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {sales.summaryRows.map((row) => (
                              <tr key={row.locationId} className="hover:bg-gray-50">
                                <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                                  {row.locationName}
                                </td>
                                {sales.categories.map((cat) => {
                                  const amount = row.amountsByCategory[cat] || 0
                                  const cell = formatOrderSalesMatrixCell(amount)
                                  return (
                                    <td
                                      key={cat}
                                      className="px-4 py-2.5 text-right text-gray-900 tabular-nums whitespace-nowrap"
                                    >
                                      {cell || <span className="text-gray-300">—</span>}
                                    </td>
                                  )
                                })}
                                <td className="px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                                  {formatOrderSalesMoney(row.locationTotal)}
                                </td>
                                {sales.includeFranchiseReceivables ? (
                                  <>
                                    <td className="px-4 py-2.5 text-right text-gray-900 tabular-nums whitespace-nowrap">
                                      {formatOrderSalesMatrixCell(row.franchise?.discount || 0) || (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-gray-900 tabular-nums whitespace-nowrap">
                                      {formatOrderSalesMoney(row.franchise?.payable || 0)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-gray-900 tabular-nums whitespace-nowrap">
                                      {formatOrderSalesMatrixCell(row.franchise?.paidAmt || 0) || (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                                      {formatOrderSalesMoney(row.franchise?.balance || 0)}
                                    </td>
                                  </>
                                ) : null}
                              </tr>
                            ))}
                            <tr className="bg-gray-50 border-t-2 border-gray-900">
                              <td className="px-4 py-2.5 font-bold text-gray-900">TOTAL</td>
                              {sales.categories.map((cat) => (
                                <td
                                  key={cat}
                                  className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap"
                                >
                                  {formatOrderSalesMoney(sales.categoryTotals[cat] || 0)}
                                </td>
                              ))}
                              <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                {formatOrderSalesMoney(sales.grandTotal)}
                              </td>
                              {sales.includeFranchiseReceivables ? (
                                <>
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                    {formatOrderSalesMoney(sales.franchiseTotals?.discount || 0)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                    {formatOrderSalesMoney(sales.franchiseTotals?.payable || 0)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                    {formatOrderSalesMoney(sales.franchiseTotals?.paidAmt || 0)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                    {formatOrderSalesMoney(sales.franchiseTotals?.balance || 0)}
                                  </td>
                                </>
                              ) : null}
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-md font-semibold text-gray-900">Location Detail</h3>
                      <p className="text-sm text-gray-600">
                        Expand a location to see category totals broken down by product.
                      </p>
                      {sales.locations.length === 0 ? (
                        <p className="text-sm text-gray-500">No location detail available.</p>
                      ) : (
                        <div className="space-y-2 border border-gray-200 rounded-lg divide-y divide-gray-200 overflow-hidden">
                          {sales.locations.map((loc) => {
                            const open = !!expandedSalesLocations[loc.locationId]
                            return (
                              <div key={loc.locationId} className="bg-white">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSalesLocations((prev) => ({
                                      ...prev,
                                      [loc.locationId]: !prev[loc.locationId],
                                    }))
                                  }
                                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                >
                                  <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                                    {open ? (
                                      <ChevronDown className={`h-4 w-4 ${brandAccent.icon}`} />
                                    ) : (
                                      <ChevronRight className={`h-4 w-4 ${brandAccent.icon}`} />
                                    )}
                                    {loc.locationName}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900 tabular-nums">
                                    ₱{formatOrderSalesMoney(loc.locationTotal)}
                                  </span>
                                </button>
                                {open ? (
                                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100 bg-gray-50/60">
                                    {loc.categories.map((cat) => (
                                      <div key={cat.name} className="pt-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className={`text-sm font-semibold ${brandAccent.accent}`}>
                                            {cat.name}
                                          </h4>
                                          <span className="text-xs text-gray-600 tabular-nums">
                                            Qty {cat.qty.toLocaleString()} · ₱
                                            {formatOrderSalesMoney(cat.amount)}
                                          </span>
                                        </div>
                                        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                                          <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50">
                                              <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  SKU
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Product
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                  Qty
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                  Amount
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                              {cat.products.map((p) => (
                                                <tr key={p.productId}>
                                                  <td className="px-3 py-1.5 text-gray-500 font-mono text-xs whitespace-nowrap">
                                                    {p.sku || '—'}
                                                  </td>
                                                  <td className="px-3 py-1.5 text-gray-900">{p.name}</td>
                                                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                    {p.qty.toLocaleString()}
                                                  </td>
                                                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                    ₱{formatOrderSalesMoney(p.amount)}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Detailed Data Table (non–Order Sales) */}
          {reportData.type !== 'Order Sales Report' &&
            reportData.tableData &&
            reportData.tableData.length > 0 && (
          <div className="overflow-x-auto">
              <h3 className="text-md font-semibold text-gray-900 mb-3">Data</h3>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                    {reportData.type === 'Product Performance Report' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </>
                  )}
                    {reportData.type === 'Staff Performance Report' && (
                      <>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Sales</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Sales</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Regular</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Double</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Special</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Incentive</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Refunds</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                    </>
                  )}
                    {reportData.type === 'Branch Performance Report (DSIR)' && (
                    <>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Sales</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Big</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Small</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Takeaway</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Water</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">500ml</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Choco</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.tableData.slice(0, 50).map((row: any, index: number) => (
                    reportData.type === 'Staff Performance Report' ? (
                      (() => {
                        const rowKey = String(row.staffId || row.staffName || index)
                        const open = !!expandedStaffRows[rowKey]
                        const money = (n: number) =>
                          `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        const dayTypeLabel = (dayType: string) =>
                          dayType === 'regular-holiday'
                            ? 'Double'
                            : dayType === 'special-holiday'
                              ? 'Special'
                              : 'Regular'
                        return (
                          <Fragment key={rowKey}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-3 py-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedStaffRows((prev) => ({
                                      ...prev,
                                      [rowKey]: !prev[rowKey],
                                    }))
                                  }
                                  className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                                  aria-label={open ? 'Collapse working days' : 'Expand working days'}
                                >
                                  {open ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {row.staffName}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {Number(row.workingDays || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {Number(row.totalWorkingHours || 0).toLocaleString(undefined, {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.averageSales)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.totalGrossSales)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.regularPay)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.overtimePay)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.doublePay)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.specialPay)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.incentivePay)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.totalDeductions)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.refunds)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900 tabular-nums">
                                {money(row.totalPayroll)}
                              </td>
                            </tr>
                            {open && (
                              <tr className="bg-gray-50/80">
                                <td colSpan={14} className="px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                    Working days · sold items by day
                                    <span className="ml-2 font-normal normal-case tracking-normal text-gray-400">
                                      Totals: Big {Number(row.bigCupQty || 0).toLocaleString()} · Small{' '}
                                      {Number(row.smallCupQty || 0).toLocaleString()} · Takeaway{' '}
                                      {Number(row.takeawayQty || 0).toLocaleString()} · Water{' '}
                                      {Number(row.waterQty || 0).toLocaleString()}
                                    </span>
                                  </p>
                                  {(row.dailyBreakdown || []).length === 0 ? (
                                    <p className="text-sm text-gray-500">No schedule days in this period.</p>
                                  ) : (
                                    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                              Date
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                              Location
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                              Day Type
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              Hours
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              Sales
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              Big
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              Small
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              Takeaway
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              Water
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              500ml
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              Choco
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                              All Items
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {(row.dailyBreakdown || []).map((day: any, dayIdx: number) => (
                                            <tr key={`${rowKey}-day-${dayIdx}`}>
                                              <td className="px-3 py-1.5 text-gray-900 whitespace-nowrap">
                                                {day.date}
                                              </td>
                                              <td className="px-3 py-1.5 text-gray-900 whitespace-nowrap">
                                                {day.locationName}
                                              </td>
                                              <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                                                {dayTypeLabel(day.dayType)}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {Number(day.hours || 0).toLocaleString(undefined, {
                                                  minimumFractionDigits: 1,
                                                  maximumFractionDigits: 1,
                                                })}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {money(day.sales)}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {Number(day.bigCupQty || 0).toLocaleString()}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {Number(day.smallCupQty || 0).toLocaleString()}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {Number(day.takeawayQty || 0).toLocaleString()}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {Number(day.waterQty || 0).toLocaleString()}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {Number(day.ml500Qty || 0).toLocaleString()}
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {Number(day.chocoQty || 0).toLocaleString()}
                                              </td>
                                              <td className="px-3 py-1.5 text-gray-700 text-xs">
                                                {(day.itemsSold || []).length === 0
                                                  ? '—'
                                                  : (day.itemsSold || [])
                                                      .map(
                                                        (i: any) =>
                                                          `${i.itemName} (${Number(i.quantity || 0).toLocaleString()})`
                                                      )
                                                      .join(', ')}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })()
                    ) : reportData.type === 'Branch Performance Report (DSIR)' ? (
                      (() => {
                        const rowKey = String(row.id || `${row.date}-${row.location}-${index}`)
                        const open = !!expandedDsirRows[rowKey]
                        const money = (n: number) =>
                          `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        return (
                          <Fragment key={rowKey}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-3 py-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDsirRows((prev) => ({
                                      ...prev,
                                      [rowKey]: !prev[rowKey],
                                    }))
                                  }
                                  className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                                  aria-label={open ? 'Collapse items sold' : 'Expand items sold'}
                                >
                                  {open ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                                {row.location}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {money(row.grossSales)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {Number(row.bigCupQty || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {Number(row.smallCupQty || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {Number(row.takeawayQty || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {Number(row.waterQty || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {Number(row.ml500Qty || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900 tabular-nums">
                                {Number(row.chocoQty || 0).toLocaleString()}
                              </td>
                            </tr>
                            {open && (
                              <tr className="bg-gray-50/80">
                                <td colSpan={10} className="px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                    Items sold
                                  </p>
                                  {(row.itemsSold || []).length === 0 ? (
                                    <p className="text-sm text-gray-500">No item quantities for this DSIR.</p>
                                  ) : (
                                    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                              Item
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                              Qty Sold
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {(row.itemsSold || []).map((item: any, itemIdx: number) => (
                                            <tr key={`${rowKey}-item-${itemIdx}`}>
                                              <td className="px-3 py-1.5 text-gray-900">{item.itemName}</td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                                                {Number(item.quantity || 0).toLocaleString()}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })()
                    ) : (
                    <tr key={index}>
                      {reportData.type === 'Product Performance Report' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.productName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Number(row.quantity).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </>
                      )}
                  </tr>
                    )
                ))}
              </tbody>
            </table>
              {reportData.tableData.length > 50 && (
            <p className="mt-4 text-sm text-gray-600 text-center">
              Showing first 50 records. Export to CSV to see all data.
            </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
