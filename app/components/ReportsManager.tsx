'use client'
import { useState, useEffect } from 'react'
import { supabase, Brand } from '../../lib/supabase'
import { FileText, Download, Calendar, TrendingUp, Package, ShoppingCart, Users, DollarSign, BarChart3 } from 'lucide-react'
import { getPhilippinesDate } from '../../lib/timezone'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useBrands } from '../contexts/BrandsContext'

interface ReportsManagerProps {
  selectedBrand?: Brand | null
  theme?: string
}

export function ReportsManager({ selectedBrand: propSelectedBrand, theme = 'blue' }: ReportsManagerProps) {
  const { brands, loading: brandsLoading } = useBrands()
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState<string>('')
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
  const [dateRangePreset, setDateRangePreset] = useState<string>('7days')
  
  // Options for filters
  const [branches, setBranches] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

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
    // Set default date range to last 7 days
    const end = getPhilippinesDate()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
    const start = startDate.toISOString().split('T')[0]
    setDateRange({ start, end })
    loadFilterOptions()
    // Clear report data when brand changes
    setReportData(null)
    setError('')
  }, [selectedBrand])

  useEffect(() => {
    // Clear report data when report type changes
    setReportData(null)
    setError('')
    // Clear filters when switching report types
    setSelectedBranch('')
    setSelectedCategory('')
    setSelectedStaff('')
    setSelectedLocation('')
    setSelectedCompanyOwned('')
    // Reset brand to prop brand when switching away from staff performance
    if (reportType !== 'staff' && propSelectedBrand) {
      setSelectedBrand(propSelectedBrand)
    }
  }, [reportType, propSelectedBrand])

  const setDateRangePresetValue = (preset: string) => {
    setDateRangePreset(preset)
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
      case 'custom':
        // Don't change dates for custom, just mark as custom
        return
      default:
        startDate.setDate(startDate.getDate() - 30)
    }
    
    const start = startDate.toISOString().split('T')[0]
    setDateRange({ start, end })
  }

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange({ ...dateRange, [field]: value })
    setDateRangePreset('custom')
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

  // Sales Report - filters: date range, branch
  const generateSalesReport = async () => {
    if (!selectedBrand) return

    let query = supabase
      .from('customer_orders')
      .select(`
        *,
        location:locations(*),
        order_details(
          *,
          product:products(*)
        )
      `)
      .in('status', ['paid', 'complete', 'fulfilled'])
      .eq('brand_id', selectedBrand.id)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59')
      .order('created_at', { ascending: false })

    const { data: orders, error } = await query

    if (error) throw error

    // Filter by branch if selected
    let filteredOrders = orders || []
    if (selectedBranch) {
      filteredOrders = filteredOrders.filter(order => order.location?.id === selectedBranch)
    }

    const totalSales = filteredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    const totalOrders = filteredOrders.length
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // Prepare daily sales data for line graph
    const dailySales = filteredOrders.reduce((acc: any, order) => {
      const date = new Date(order.created_at).toLocaleDateString()
      acc[date] = (acc[date] || 0) + (order.total_amount || 0)
      return acc
    }, {})
    const dailySalesData = Object.entries(dailySales)
      .map(([date, sales]) => ({ date, sales: Number(sales) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Prepare sales by location for bar graph
    const salesByLocation = filteredOrders.reduce((acc: any, order) => {
      const locName = order.location?.name || 'Unknown'
      acc[locName] = (acc[locName] || 0) + (order.total_amount || 0)
      return acc
    }, {})
    const salesByLocationData = Object.entries(salesByLocation)
      .map(([name, sales]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, sales: Number(sales) }))
      .sort((a, b) => b.sales - a.sales)

    // Prepare table data
    const tableData = filteredOrders.map(order => ({
      date: new Date(order.created_at).toLocaleDateString(),
      location: order.location?.name || 'N/A',
      amount: order.total_amount || 0
    }))

    setReportData({
      type: 'Sales Report',
      period: `${dateRange.start} to ${dateRange.end}`,
      summary: {
        totalSales,
        totalOrders,
        averageOrderValue
      },
      dailySalesData,
      salesByLocationData,
      tableData
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

    // Filter by brand (if selected, otherwise show all brands)
    let filteredReports = selectedBrand 
      ? reports?.filter(report => report.location?.brand_id === selectedBrand.id) || []
      : reports || []

    // Filter by staff if selected
    if (selectedStaff) {
      filteredReports = filteredReports.filter(report => report.staff_registration_id === selectedStaff)
    }

    // Filter by location if selected
    if (selectedLocation) {
      filteredReports = filteredReports.filter(report => report.location_id === selectedLocation)
    }

    // Group by staff and calculate averages and totals
    const staffPerformance: { [key: string]: { staffName: string, sales: number[], totalGrossSales: number } } = {}

    filteredReports.forEach(report => {
      const staffId = report.staff_registration_id
      const staffName = report.staff_name || report.staff_registration?.full_name || 'Unknown'
      const sales = parseFloat(report.gross_sales || 0)

      if (!staffPerformance[staffId]) {
        staffPerformance[staffId] = {
          staffName,
          sales: [],
          totalGrossSales: 0
        }
      }

      staffPerformance[staffId].sales.push(sales)
      staffPerformance[staffId].totalGrossSales += sales
    })

    // Calculate average sales and get staff IDs for payroll calculation
    const staffIds = Object.keys(staffPerformance)
    let totalPayroll = 0
    const staffPayrollMap: { [staffId: string]: number } = {}
    const staffHoursMap: { [staffId: string]: number } = {}

    // Calculate payroll and working hours for each staff member
    if (staffIds.length > 0) {
      // Get location IDs for the selected brand (or all locations if no brand selected)
      let brandLocationIds: string[] = []
      if (selectedBrand) {
        const { data: brandLocations } = await supabase
          .from('locations')
          .select('id')
          .eq('brand_id', selectedBrand.id)
        brandLocationIds = brandLocations?.map(loc => loc.id) || []
      }

      let scheduleQuery = supabase
        .from('staff_schedules')
        .select(`
          *,
          staff:staff_registrations(hourly_rate),
          location:locations(brand_id)
        `)
        .in('staff_registration_id', staffIds)
        .gte('schedule_date', dateRange.start)
        .lte('schedule_date', dateRange.end)
        .eq('is_absent', false)

      // Only filter by location if a brand is selected
      if (selectedBrand && brandLocationIds.length > 0) {
        scheduleQuery = scheduleQuery.in('location_id', brandLocationIds)
      }

      const { data: schedules, error: scheduleError } = await scheduleQuery

      if (!scheduleError && schedules) {
        // Initialize maps
        staffIds.forEach(id => {
          staffPayrollMap[id] = 0
          staffHoursMap[id] = 0
        })

        // Calculate payroll and hours from schedules
        schedules.forEach(schedule => {
          const staffId = schedule.staff_registration_id
          const hours = parseFloat(schedule.hours || 0)
          const hourlyRate = parseFloat(schedule.staff?.hourly_rate || 0)
          const dayType = schedule.day_type || 'default'
          
          // Add to total working hours
          staffHoursMap[staffId] = (staffHoursMap[staffId] || 0) + hours
          
          let pay = 0
          if (dayType === 'regular-holiday') {
            // Double pay for regular holidays
            pay = hours * hourlyRate * 2
          } else if (dayType === 'special-holiday') {
            // Special holiday pay (usually 1.3x)
            pay = hours * hourlyRate * 1.3
          } else {
            // Regular pay
            pay = hours * hourlyRate
          }
          
          staffPayrollMap[staffId] = (staffPayrollMap[staffId] || 0) + pay
          totalPayroll += pay
        })

        // Get deductions and refunds
        const { data: deductionsData } = await supabase
          .from('payroll_deductions_refunds')
          .select('*')
          .in('staff_id', staffIds)
          .gte('week_start_date', dateRange.start)
          .lte('week_end_date', dateRange.end)

        if (deductionsData) {
          deductionsData.forEach(deduction => {
            const staffId = deduction.staff_id
            const totalDeductions = 
              parseFloat(deduction.utilities || 0) +
              parseFloat(deduction.shortages || 0) +
              parseFloat(deduction.cash_advances || 0) +
              parseFloat(deduction.penalties || 0) +
              parseFloat(deduction.others || 0)
            const refunds = parseFloat(deduction.refunds || 0)
            const netAdjustment = refunds - totalDeductions
            
            staffPayrollMap[staffId] = (staffPayrollMap[staffId] || 0) + netAdjustment
            totalPayroll += netAdjustment
          })
        }
      }
    }

    // Calculate average sales and include totals
    const staffAverages = Object.entries(staffPerformance).map(([staffId, data]) => {
      const avgSales = data.sales.length > 0 
        ? data.sales.reduce((sum, s) => sum + s, 0) / data.sales.length 
        : 0

      return {
        staffId,
        staffName: data.staffName,
        averageSales: avgSales,
        totalGrossSales: data.totalGrossSales,
        totalPayroll: staffPayrollMap[staffId] || 0,
        totalWorkingHours: staffHoursMap[staffId] || 0,
        totalReports: data.sales.length
      }
    }).sort((a, b) => b.totalGrossSales - a.totalGrossSales)

    // Prepare line graph data - sales over time by staff (show all staff)
    const salesOverTime: { [date: string]: { [staffId: string]: number } } = {}
    filteredReports.forEach(report => {
      const date = report.report_date
      const staffId = report.staff_registration_id
      const sales = parseFloat(report.gross_sales || 0)

      if (!salesOverTime[date]) {
        salesOverTime[date] = {}
      }
      salesOverTime[date][staffId] = (salesOverTime[date][staffId] || 0) + sales
    })

    // Get all unique staff names for the graph
    const allStaffNames = Object.values(staffPerformance).map(s => s.staffName)
    
    const lineGraphData = Object.entries(salesOverTime)
      .map(([date, staffSales]) => {
        const dataPoint: any = { date }
        // Include all staff in the graph, even if they have 0 sales for that date
        allStaffNames.forEach(staffName => {
          const staffId = Object.keys(staffPerformance).find(id => staffPerformance[id].staffName === staffName)
          dataPoint[staffName] = staffId ? (staffSales[staffId] || 0) : 0
        })
        return dataPoint
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate total gross sales
    const totalGrossSales = filteredReports.reduce((sum, report) => {
      return sum + (parseFloat(report.gross_sales || 0))
    }, 0)

    const totalAverageSales = staffAverages.length > 0
      ? staffAverages.reduce((sum, s) => sum + s.averageSales, 0) / staffAverages.length
      : 0

    setReportData({
      type: 'Staff Performance Report',
      period: `${dateRange.start} to ${dateRange.end}`,
      summary: {
        totalStaff: staffAverages.length,
        averageSales: totalAverageSales,
        totalGrossSales: totalGrossSales,
        totalPayroll: totalPayroll
      },
      lineGraphData,
      tableData: staffAverages.map(s => ({
        staffName: s.staffName,
        averageSales: s.averageSales,
        totalGrossSales: s.totalGrossSales,
        totalPayroll: s.totalPayroll,
        totalWorkingHours: s.totalWorkingHours
      }))
    })
  }

  // Branch Performance Report (DSIR) - filters: location, date range
  const generateBranchPerformanceReport = async () => {
    if (!selectedBrand) return

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

    // Fetch customer orders for quantity data
    let ordersQuery = supabase
      .from('customer_orders')
      .select(`
        id,
        created_at,
        location_id,
        location:locations(company_owned),
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
    Object.keys(quantityByDate).forEach(date => allDates.add(date))

    const lineGraphData = Array.from(allDates)
      .map(date => ({
        date,
        grossSales: Number(salesOverTime[date] || 0),
        [categoryKey]: quantityByDate[date] || 0,
        categoryLabel // Store label for graph rendering
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate total quantity for the selected category
    const totalQuantity = Object.values(quantityByDate).reduce((sum, qty) => sum + qty, 0)
    
    // Calculate sales per unit (total gross sales / total quantity)
    const salesPerUnit = totalQuantity > 0 ? totalGrossSales / totalQuantity : 0

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
    
    if (orders) {
      orders.forEach(order => {
        const locName = filteredReports.find(r => r.location_id === order.location_id)?.location?.name || 'Unknown'
        
        if (!pansByLocation[locName]) {
          pansByLocation[locName] = 0
        }

        if (order.order_details && Array.isArray(order.order_details)) {
          order.order_details.forEach((detail: any) => {
            const category = detail.products?.category?.toLowerCase().trim() || ''
            const quantity = parseInt(detail.quantity) || 0

            if (category === targetCategory) {
              pansByLocation[locName] += quantity
            }
          })
        }
      })
    }

    const pansPieGraphData = Object.entries(pansByLocation)
      .map(([name, quantity]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value: Number(quantity)
      }))
      .sort((a, b) => b.value - a.value)

    setReportData({
      type: 'Branch Performance Report (DSIR)',
      period: `${dateRange.start} to ${dateRange.end}`,
      summary: {
        totalGrossSales,
        totalReports: filteredReports.length,
        totalQuantity,
        salesPerUnit,
        categoryLabel // Store for display in summary
      },
      lineGraphData,
      pieGraphData,
      pansPieGraphData, // Add pans pie graph data
      tableData: filteredReports.map(r => ({
        date: r.report_date,
        location: r.location?.name || 'N/A',
        grossSales: parseFloat(r.gross_sales || 0)
      })),
      categoryKey, // Store for conditional rendering
      categoryLabel // Store for display
    })
  }

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
        displayKey = `Total ${reportData.summary.categoryLabel} Quantity`
        displayValue = typeof value === 'number' ? value.toLocaleString() : String(value)
      } else if (key === 'salesPerUnit') {
        displayKey = `Sales Per Pan`
        displayValue = typeof value === 'number' ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value)
      } else if (typeof value === 'number') {
        displayValue = (key.includes('Sales') || key.includes('Amount') || key.includes('Value') || key.includes('Payroll') || key.includes('Per')) 
          ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
          : value.toLocaleString()
      } else {
        displayValue = String(value)
      }
      
      csv += `${displayKey},${displayValue}\n`
    })
    csv += '\n'

    // Add detailed data
    if (reportData.tableData) {
      csv += 'Data\n'
      if (reportData.type === 'Sales Report') {
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
        csv += 'Staff Name,Average Sales,Total Gross Sales,Total Payroll,Total Working Hours\n'
        reportData.tableData.forEach((row: any) => {
          csv += `${row.staffName},${row.averageSales.toFixed(2)},${row.totalGrossSales.toFixed(2)},${row.totalPayroll.toFixed(2)},${row.totalWorkingHours.toFixed(1)}\n`
        })
      } else if (reportData.type === 'Branch Performance Report (DSIR)') {
        csv += 'Date,Location,Gross Sales\n'
        reportData.tableData.forEach((row: any) => {
          csv += `${row.date},${row.location},${row.grossSales}\n`
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-600">Generate comprehensive reports from your data</p>
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
            <div className="font-medium text-sm">Sales Report</div>
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

          {/* Sales Report Filters */}
          {reportType === 'sales' && (
            <div className="flex-shrink-0 min-w-[150px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
        </div>
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
              <div className="flex-shrink-0 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Ownership</label>
                <select
                  value={selectedCompanyOwned}
                  onChange={(e) => setSelectedCompanyOwned(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">Company Owned</option>
                  <option value="false">Franchise</option>
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
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Summary */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(reportData.summary).map(([key, value]) => {
                // Skip categoryLabel as it's just metadata
                if (key === 'categoryLabel') return null
                
                let displayKey = key.replace(/([A-Z])/g, ' $1').trim()
                let displayValue: string = ''
                
                // Format display key and value based on the field
                if (key === 'totalQuantity' && reportData.summary.categoryLabel) {
                  displayKey = `Total ${reportData.summary.categoryLabel} Quantity`
                  displayValue = typeof value === 'number' ? value.toLocaleString() : String(value)
                } else if (key === 'salesPerUnit') {
                  displayKey = `Sales Per Pan`
                  displayValue = typeof value === 'number' ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value)
                } else if (typeof value === 'number') {
                  displayValue = (key.includes('Sales') || key.includes('Amount') || key.includes('Value') || key.includes('Payroll') || key.includes('Per')) 
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
          {reportData.type === 'Sales Report' && (
            <div className="mb-6 space-y-6">
              {reportData.dailySalesData && reportData.dailySalesData.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Sales Over Time (Line Graph)</h3>
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
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Sales by Location (Bar Graph)</h3>
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
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Product Performance (Bar Graph)</h3>
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
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Product Distribution (Pie Graph)</h3>
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
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Average Sales Over Time (Line Graph)</h3>
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
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Gross Sales & Product Quantities Over Time (Line Graph)</h3>
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
                        label={{ value: 'Gross Sales (₱)', angle: -90, position: 'insideLeft' }}
                      />
                      <YAxis 
                        yAxisId="quantity"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.toLocaleString()}
                        label={{ 
                          value: reportData.categoryLabel ? `${reportData.categoryLabel} Quantity` : 'Quantity', 
                          angle: 90, 
                          position: 'insideRight' 
                        }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => {
                          if (name === 'Gross Sales') {
                            return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                      {reportData.categoryKey && reportData.categoryLabel && (
                        <Line 
                          yAxisId="quantity"
                          type="monotone" 
                          dataKey={reportData.categoryKey} 
                          stroke={
                            reportData.categoryKey === 'iceCream' ? '#10b981' :
                            reportData.categoryKey === 'gelato' ? '#f59e0b' :
                            '#ef4444'
                          }
                          strokeWidth={2} 
                          name={reportData.categoryLabel} 
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportData.pieGraphData && reportData.pieGraphData.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Sales by Location (Pie Graph)</h3>
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
                      {reportData.categoryLabel ? `${reportData.categoryLabel} Pans by Location (Pie Graph)` : 'Pans by Location (Pie Graph)'}
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

          {/* Detailed Data Table */}
          {reportData.tableData && reportData.tableData.length > 0 && (
          <div className="overflow-x-auto">
              <h3 className="text-md font-semibold text-gray-900 mb-3">Data</h3>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                    {reportData.type === 'Sales Report' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </>
                  )}
                    {reportData.type === 'Product Performance Report' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </>
                  )}
                    {reportData.type === 'Staff Performance Report' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average Sales</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Gross Sales</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Payroll</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Working Hours</th>
                    </>
                  )}
                    {reportData.type === 'Branch Performance Report (DSIR)' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Sales</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.tableData.slice(0, 50).map((row: any, index: number) => (
                    <tr key={index}>
                      {reportData.type === 'Sales Report' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.location}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </>
                      )}
                      {reportData.type === 'Product Performance Report' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.productName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Number(row.quantity).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </>
                      )}
                      {reportData.type === 'Staff Performance Report' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.staffName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{Number(row.averageSales).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{Number(row.totalGrossSales).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{Number(row.totalPayroll).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Number(row.totalWorkingHours).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                        </>
                      )}
                      {reportData.type === 'Branch Performance Report (DSIR)' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.location}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{Number(row.grossSales).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </>
                      )}
                  </tr>
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
