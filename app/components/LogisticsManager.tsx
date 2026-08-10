'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, Clock, Truck, Package, Plus, X, Edit, Trash2, ChevronLeft, ChevronRight, Sun, Moon, ArrowUpDown, ArrowDown, ArrowUp, Ship } from 'lucide-react'
import { formatPhilippinesDateTime, toPhilippinesDateString } from '../../lib/timezone'

interface LogisticsAssignment {
  id: string
  order_id: string
  date: string
  time_slot: 'morning' | 'afternoon'
  status: 'scheduled' | 'in_transit' | 'delivered' | 'cancelled'
  notes?: string
  created_at: string
  updated_at: string
  order?: {
    id: string
    customer_name: string
    total_amount: number
    delivery_type: 'delivery' | 'pickup' | 'none' | 'shipment'
    created_at: string
    brand_id: string
    brand?: {
      name: string
    }
    location?: {
      name: string
      is_remote?: boolean
    }
  }
}

function isRemoteStoreLocation(location?: { is_remote?: boolean } | null): boolean {
  return !!location?.is_remote
}

interface LogisticsManagerProps {
  selectedBrand: any | null
  theme?: string
}

type LogisticsAssignmentCardSkeleton = {
  locationWidth: string
  dateWidth: string
  height: string
}

type LogisticsDaySkeletonPattern = {
  minHeight: string
  morning: LogisticsAssignmentCardSkeleton[]
  afternoon: LogisticsAssignmentCardSkeleton[]
}

const LOGISTICS_DAY_SKELETON_PATTERNS: LogisticsDaySkeletonPattern[] = [
  { minHeight: 'min-h-[120px]', morning: [], afternoon: [] },
  {
    minHeight: 'min-h-[132px]',
    morning: [{ locationWidth: 'max-w-[4rem]', dateWidth: 'w-10', height: 'h-9' }],
    afternoon: [],
  },
  {
    minHeight: 'min-h-[132px]',
    morning: [],
    afternoon: [{ locationWidth: 'max-w-[5.5rem]', dateWidth: 'w-12', height: 'h-10' }],
  },
  {
    minHeight: 'min-h-[156px]',
    morning: [{ locationWidth: 'max-w-[5rem]', dateWidth: 'w-11', height: 'h-10' }],
    afternoon: [{ locationWidth: 'max-w-[3.5rem]', dateWidth: 'w-10', height: 'h-8' }],
  },
  {
    minHeight: 'min-h-[168px]',
    morning: [
      { locationWidth: 'max-w-[4.5rem]', dateWidth: 'w-10', height: 'h-9' },
      { locationWidth: 'max-w-[6rem]', dateWidth: 'w-12', height: 'h-10' },
    ],
    afternoon: [],
  },
  {
    minHeight: 'min-h-[168px]',
    morning: [],
    afternoon: [
      { locationWidth: 'max-w-[4rem]', dateWidth: 'w-11', height: 'h-9' },
      { locationWidth: 'max-w-[5rem]', dateWidth: 'w-10', height: 'h-8' },
    ],
  },
  {
    minHeight: 'min-h-[188px]',
    morning: [{ locationWidth: 'max-w-[6rem]', dateWidth: 'w-14', height: 'h-11' }],
    afternoon: [
      { locationWidth: 'max-w-[4rem]', dateWidth: 'w-10', height: 'h-9' },
      { locationWidth: 'max-w-[5.5rem]', dateWidth: 'w-12', height: 'h-10' },
    ],
  },
  {
    minHeight: 'min-h-[188px]',
    morning: [
      { locationWidth: 'max-w-[3.5rem]', dateWidth: 'w-10', height: 'h-8' },
      { locationWidth: 'max-w-[5rem]', dateWidth: 'w-11', height: 'h-10' },
    ],
    afternoon: [{ locationWidth: 'max-w-[4.5rem]', dateWidth: 'w-12', height: 'h-9' }],
  },
  {
    minHeight: 'min-h-[144px]',
    morning: [{ locationWidth: 'max-w-[5.5rem]', dateWidth: 'w-12', height: 'h-10' }],
    afternoon: [],
  },
  {
    minHeight: 'min-h-[176px]',
    morning: [{ locationWidth: 'max-w-[4rem]', dateWidth: 'w-10', height: 'h-9' }],
    afternoon: [{ locationWidth: 'max-w-[6rem]', dateWidth: 'w-14', height: 'h-11' }],
  },
]

function LogisticsAssignmentCardSkeletonBlock({
  card,
}: {
  card: LogisticsAssignmentCardSkeleton
}) {
  return (
    <div className={`rounded bg-gray-200 p-1 animate-pulse ${card.height}`}>
      <div className={`h-3 rounded bg-gray-300 ${card.locationWidth}`} />
      <div className={`mt-1 h-2 rounded bg-gray-300 ${card.dateWidth}`} />
    </div>
  )
}

function LogisticsSlotSkeleton({
  labelWidth,
  cards,
}: {
  labelWidth: string
  cards: LogisticsAssignmentCardSkeleton[]
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <div className={`h-3 rounded bg-gray-200 animate-pulse ${labelWidth}`} />
        <div className="h-3 w-3 rounded bg-gray-200 animate-pulse" />
      </div>
      {cards.length > 0 ? (
        <div className="space-y-1">
          {cards.map((card, index) => (
            <LogisticsAssignmentCardSkeletonBlock key={index} card={card} />
          ))}
        </div>
      ) : (
        <div className="h-6 rounded bg-gray-100 animate-pulse" />
      )}
    </div>
  )
}

function LogisticsCalendarDaySkeleton({ dayIndex }: { dayIndex: number }) {
  const pattern =
    LOGISTICS_DAY_SKELETON_PATTERNS[dayIndex % LOGISTICS_DAY_SKELETON_PATTERNS.length]
  const dayNumberWidth = dayIndex % 3 === 0 ? 'w-5' : dayIndex % 3 === 1 ? 'w-4' : 'w-6'
  const morningLabelWidth = dayIndex % 2 === 0 ? 'w-14' : 'w-12'
  const afternoonLabelWidth = dayIndex % 2 === 0 ? 'w-16' : 'w-14'

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-2 ${pattern.minHeight}`}
    >
      <div className={`mb-2 h-4 rounded bg-gray-200 animate-pulse ${dayNumberWidth}`} />
      <LogisticsSlotSkeleton labelWidth={morningLabelWidth} cards={pattern.morning} />
      <LogisticsSlotSkeleton labelWidth={afternoonLabelWidth} cards={pattern.afternoon} />
    </div>
  )
}

export function LogisticsManager({ selectedBrand, theme = 'blue' }: LogisticsManagerProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [assignments, setAssignments] = useState<LogisticsAssignment[]>([])
  const [availableOrders, setAvailableOrders] = useState<any[]>([])
  const [showOrderPopup, setShowOrderPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<'morning' | 'afternoon'>('morning')
  const [loading, setLoading] = useState(false)
  const [sortByDeliveryType, setSortByDeliveryType] = useState<'all' | 'delivery' | 'pickup'>('all')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (selectedBrand) {
      fetchAssignments()
      fetchAvailableOrders()
    }
  }, [selectedBrand, currentDate])

  const fetchAssignments = async () => {
    if (!selectedBrand) return

    setLoading(true)
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from('logistics_assignments')
        .select(`
          *,
           order:customer_orders(
             id,
             customer_name,
             total_amount,
             delivery_type,
             created_at,
             brand_id,
             brand:brands(name),
             location:locations(name, is_remote)
           )
        `)
        .gte('date', toPhilippinesDateString(startOfMonth))
        .lte('date', toPhilippinesDateString(endOfMonth))
        .order('date', { ascending: true })

      if (error) {
        console.error('Error fetching assignments:', error)
        return
      }

      setAssignments(data || [])
    } catch (error) {
      console.error('Error fetching assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableOrders = async () => {
    if (!selectedBrand) return

    try {
      const { data, error } = await supabase
        .from('customer_orders')
         .select(`
           id,
           customer_name,
           total_amount,
           delivery_type,
           status,
           created_at,
           brand_id,
           brand:brands(name),
           location:locations(name, is_remote)
         `)
        .eq('brand_id', selectedBrand.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching orders:', error)
        return
      }

      console.log('Fetched orders:', data)
      setAvailableOrders(data || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    }
  }

  const handleCreateAssignment = async (orderId: string, date: string, timeSlot: 'morning' | 'afternoon') => {
    try {
      const { data, error } = await supabase
        .from('logistics_assignments')
        .insert({
          order_id: orderId,
          date: date,
          time_slot: timeSlot,
          status: 'scheduled',
          notes: null
        })
        .select(`
          *,
          order:customer_orders(
            *,
            location:locations(name),
            brand:brands(name)
          )
        `)

      if (error) {
        console.error('Error creating assignment:', error)
        return
      }

      // Optimistic UI update - add the new assignment to state immediately
      if (data && data[0]) {
        setAssignments(prev => [...prev, data[0]])
      }
    } catch (error) {
      console.error('Error creating assignment:', error)
    }
  }

  const handleUpdateAssignmentStatus = async (assignmentId: string, newStatus: 'scheduled' | 'in_transit' | 'delivered' | 'cancelled') => {
    // Optimistic UI update - update status immediately
    const previousAssignments = assignments
    setAssignments(prev => prev.map(a => 
      a.id === assignmentId ? { ...a, status: newStatus } : a
    ))

    try {
      const { error } = await supabase
        .from('logistics_assignments')
        .update({ status: newStatus })
        .eq('id', assignmentId)

      if (error) {
        console.error('Error updating assignment:', error)
        // Revert optimistic update on error
        setAssignments(previousAssignments)
        return
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
      // Revert optimistic update on error
      setAssignments(previousAssignments)
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    // Optimistic UI update - remove assignment immediately
    const previousAssignments = assignments
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))

    try {
      const { error } = await supabase
        .from('logistics_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) {
        console.error('Error deleting assignment:', error)
        // Revert optimistic update on error
        setAssignments(previousAssignments)
        return
      }
    } catch (error) {
      console.error('Error deleting assignment:', error)
      // Revert optimistic update on error
      setAssignments(previousAssignments)
    }
  }

  const getAssignmentsForDate = useCallback((date: string, timeSlot: 'morning' | 'afternoon') => {
    let filteredAssignments = assignments.filter(
      assignment => assignment.date === date && assignment.time_slot === timeSlot
    )

    // Filter by delivery type
    if (sortByDeliveryType !== 'all') {
      filteredAssignments = filteredAssignments.filter(assignment => 
        assignment.order?.delivery_type === sortByDeliveryType
      )
    }

    // Sort by delivery type
    filteredAssignments.sort((a, b) => {
      const aType = a.order?.delivery_type || 'delivery'
      const bType = b.order?.delivery_type || 'delivery'
      
      if (sortOrder === 'asc') {
        return aType.localeCompare(bType)
      } else {
        return bType.localeCompare(aType)
      }
    })

    return filteredAssignments
  }, [assignments, sortByDeliveryType, sortOrder])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'in_transit':
        return 'bg-yellow-100 text-yellow-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Independent color mapping for calendar assignments
  const getCalendarBrandColor = useCallback((brandId: string, brandName?: string) => {
    // Custom brand color mapping - same base color for both time slots
    const brandColorMap: { [key: string]: { morning: string; afternoon: string } } = {
      'mychoice': {
        morning: 'bg-green-100 border-green-400 border-l-4',
        afternoon: 'bg-green-100 border-green-400 border-l-4'
      },
      'mang sorbetes': {
        morning: 'bg-yellow-100 border-yellow-400 border-l-4',
        afternoon: 'bg-yellow-100 border-yellow-400 border-l-4'
      },
      'gelatofilipino': {
        morning: 'bg-red-100 border-red-400 border-l-4',
        afternoon: 'bg-red-100 border-red-400 border-l-4'
      }
    }
    
    // Check for exact brand name match first
    const brandKey = brandName?.toLowerCase()
    if (brandKey && brandColorMap[brandKey]) {
      console.log(`Brand: ${brandName} -> Custom color`)
      return brandColorMap[brandKey]
    }
    
    // Fallback to hash-based color for unknown brands
    const identifier = brandName || brandId
    let hash = 0
    for (let i = 0; i < identifier.length; i++) {
      hash = ((hash << 5) - hash + identifier.charCodeAt(i)) & 0xffffffff
    }
    
    const colorIndex = Math.abs(hash) % 3 // Only use 3 colors for fallback
    
    console.log(`Brand: ${brandName || brandId} -> Hash color (index: ${colorIndex})`)
    
    switch (colorIndex) {
      case 0: return {
        morning: 'bg-blue-100 border-blue-400 border-l-4',
        afternoon: 'bg-blue-100 border-blue-400 border-l-4'
      }
      case 1: return {
        morning: 'bg-purple-100 border-purple-400 border-l-4',
        afternoon: 'bg-purple-100 border-purple-400 border-l-4'
      }
      case 2: return {
        morning: 'bg-gray-100 border-gray-400 border-l-4',
        afternoon: 'bg-gray-100 border-gray-400 border-l-4'
      }
      default: return {
        morning: 'bg-gray-100 border-gray-400 border-l-4',
        afternoon: 'bg-gray-100 border-gray-400 border-l-4'
      }
    }
  }, [])

  // Color for popup orders (uses current theme)
  const popupBrandColor = useMemo(() => {
    const currentTheme = theme || ''
    if (currentTheme === 'green') return {
      morning: 'bg-green-100 border-green-400',
      afternoon: 'bg-emerald-100 border-emerald-400'
    }
    if (currentTheme === 'red') return {
      morning: 'bg-red-100 border-red-400',
      afternoon: 'bg-pink-100 border-pink-400'
    }
    if (currentTheme === 'yellow') return {
      morning: 'bg-yellow-100 border-yellow-400',
      afternoon: 'bg-amber-100 border-amber-400'
    }
    if (currentTheme === 'blue') return {
      morning: 'bg-blue-100 border-blue-400',
      afternoon: 'bg-cyan-100 border-cyan-400'
    }
    if (currentTheme === 'purple') return {
      morning: 'bg-purple-100 border-purple-400',
      afternoon: 'bg-violet-100 border-violet-400'
    }
    return {
      morning: 'bg-gray-100 border-gray-400',
      afternoon: 'bg-slate-100 border-slate-400'
    }
  }, [theme])

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }, [currentDate])

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const openOrderPopup = (event: React.MouseEvent, date: string, timeSlot: 'morning' | 'afternoon') => {
    setSelectedDate(date)
    setSelectedTimeSlot(timeSlot)
    setPopupPosition({ x: event.clientX, y: event.clientY })
    setShowOrderPopup(true)
    // No need to refresh assignments here - they're already loaded and this causes flickering
  }

  const formatDate = (date: Date) => {
    return toPhilippinesDateString(date)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return toPhilippinesDateString(date) === toPhilippinesDateString(today)
  }

  const isPastDate = (date: Date) => {
    const today = new Date()
    const todayStr = toPhilippinesDateString(today)
    const dateStr = toPhilippinesDateString(date)
    return dateStr < todayStr
  }

  const isUpcomingDate = (date: Date) => {
    const today = new Date()
    const todayStr = toPhilippinesDateString(today)
    const dateStr = toPhilippinesDateString(date)
    return dateStr > todayStr
  }

  const isYesterday = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    return toPhilippinesDateString(date) === toPhilippinesDateString(yesterday)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Logistics</h1>
          <p className="text-sm text-gray-600">Schedule and manage order deliveries</p>
        </div>
        
        {/* Delivery Type Indicator and Sorting */}
        <div className="flex items-center space-x-4">
          {/* Delivery Type Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <select
              value={sortByDeliveryType}
              onChange={(e) => setSortByDeliveryType(e.target.value as 'all' | 'delivery' | 'pickup')}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
            </select>
          </div>
          
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50 rounded-lg">
                {day}
              </div>
            ))}
            
            {/* Skeleton days */}
            {[...Array(35)].map((_, idx) => (
              <LogisticsCalendarDaySkeleton key={idx} dayIndex={idx} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50 rounded-lg">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {daysInMonth.map((date, index) => {
            if (!date) {
              return <div key={index} className="p-3"></div>
            }

             const dateString = formatDate(date)
             const morningAssignments = getAssignmentsForDate(dateString, 'morning')
             const afternoonAssignments = getAssignmentsForDate(dateString, 'afternoon')
             const isCurrentDay = isToday(date)
             const isPast = isPastDate(date)
             const isYesterdayDate = isYesterday(date)
             const isUpcoming = isUpcomingDate(date)

            return (
              <div
                key={index}
                className={`p-2 border rounded-lg min-h-[120px] ${
                  isPast && !isYesterdayDate ? 'bg-gray-100 border-gray-300 opacity-60' :
                  isYesterdayDate ? 'bg-gray-100 border-gray-300 opacity-75' :
                  isCurrentDay ? 'bg-blue-50 border border-blue-500 ring-2 ring-blue-300 shadow-md' :
                  isUpcoming ? 'bg-white border-gray-300' : 'bg-white border-gray-200'
                }`}
              >
                <div className="text-sm font-medium text-gray-900 mb-2">
                  {date.getDate()}
                </div>
                
                {/* Morning Slot */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Sun className="h-3 w-3 text-yellow-500" />
                      <span className="text-xs text-gray-500">Morning</span>
                    </div>
                     <button
                       onClick={(e) => (!isPast || isYesterdayDate) && openOrderPopup(e, dateString, 'morning')}
                       disabled={isPast && !isYesterdayDate}
                       className={`text-xs ${
                         isPast && !isYesterdayDate
                           ? 'text-gray-400 cursor-not-allowed' 
                           : 'text-blue-600 hover:text-blue-800'
                       }`}
                     >
                       <Plus className="h-3 w-3 text-gray-600" />
                     </button>
                  </div>
                   <div className="space-y-1">
                     {morningAssignments.map(assignment => {
                       const isRemote = isRemoteStoreLocation(assignment.order?.location)
                       const brandColors = getCalendarBrandColor(
                         assignment.order?.brand_id || '',
                         assignment.order?.brand?.name
                       )
                       return (
                         <div
                           key={assignment.id}
                           className={`text-xs p-1 ${brandColors.morning} rounded flex flex-col group relative ${
                             isRemote ? 'border-l-4 border-l-purple-500' : 'border-l-2'
                           }`}
                         >
                         <div className="font-medium text-gray-900 truncate">{assignment.order?.location?.name}</div>
                         <div className="flex items-center justify-between mt-1">
                           <div className="text-gray-600 text-xs">{assignment.order?.created_at ? new Date(assignment.order.created_at).toLocaleDateString() : 'No Date'}</div>
                           <div className="flex items-center gap-0.5">
                             {isRemote ? (
                               <span title="Remote store / shipment">
                                 <Ship className="h-3 w-3 text-purple-600" />
                               </span>
                             ) : (
                               assignment.order?.delivery_type === 'pickup' && (
                                 <Package className="h-3 w-3 text-orange-600" />
                               )
                             )}
                             <button
                               onClick={() => handleDeleteAssignment(assignment.id)}
                               className="p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                               title="Remove assignment"
                             >
                               <X className="h-3 w-3" />
                             </button>
                           </div>
                         </div>
                       </div>
                       )
                     })}
                   </div>
                </div>

                {/* Afternoon Slot */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Moon className="h-3 w-3 text-blue-500" />
                      <span className="text-xs text-gray-500">Afternoon</span>
                    </div>
                     <button
                       onClick={(e) => (!isPast || isYesterdayDate) && openOrderPopup(e, dateString, 'afternoon')}
                       disabled={isPast && !isYesterdayDate}
                       className={`text-xs ${
                         isPast && !isYesterdayDate
                           ? 'text-gray-400 cursor-not-allowed' 
                           : 'text-blue-600 hover:text-blue-800'
                       }`}
                     >
                       <Plus className="h-3 w-3 text-gray-600" />
                     </button>
                  </div>
                   <div className="space-y-1">
                     {afternoonAssignments.map(assignment => {
                       const isRemote = isRemoteStoreLocation(assignment.order?.location)
                       const brandColors = getCalendarBrandColor(
                         assignment.order?.brand_id || '',
                         assignment.order?.brand?.name
                       )
                       return (
                         <div
                           key={assignment.id}
                           className={`text-xs p-1 ${brandColors.afternoon} rounded flex flex-col group relative ${
                             isRemote ? 'border-l-4 border-l-purple-500' : 'border-l-2'
                           }`}
                         >
                           <div className="font-medium text-gray-900 truncate">{assignment.order?.location?.name}</div>
                           <div className="flex items-center justify-between mt-1">
                             <div className="text-gray-600 text-xs">{assignment.order?.created_at ? new Date(assignment.order.created_at).toLocaleDateString() : 'No Date'}</div>
                             <div className="flex items-center gap-0.5">
                               {isRemote ? (
                                 <span title="Remote store / shipment">
                                   <Ship className="h-3 w-3 text-purple-600" />
                                 </span>
                               ) : (
                                 assignment.order?.delivery_type === 'pickup' && (
                                   <Package className="h-3 w-3 text-orange-600" />
                                 )
                               )}
                               <button
                                 onClick={() => handleDeleteAssignment(assignment.id)}
                                 className="p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                 title="Remove assignment"
                               >
                                 <X className="h-3 w-3" />
                               </button>
                             </div>
                           </div>
                         </div>
                       )
                     })}
                   </div>
                </div>
              </div>
            )
          })}
          </div>
        )}
      </div>

      {/* Order Selection Popup */}
      {showOrderPopup && (
        <div className="fixed inset-0 z-50" onClick={() => setShowOrderPopup(false)}>
          <div 
            className="absolute bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm max-h-80 overflow-y-auto"
            style={{
              left: Math.min(popupPosition.x, window.innerWidth - 320),
              top: Math.min(popupPosition.y, window.innerHeight - 200)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Select Order - {selectedTimeSlot === 'morning' ? 'Morning' : 'Afternoon'}
              </h3>
              <button
                onClick={() => setShowOrderPopup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              {(() => {
                // Filter out all scheduled orders (not just current date/time slot)
                const assignedOrderIds = assignments.map(assignment => assignment.order_id)
                
                const unassignedOrders = availableOrders.filter(order => !assignedOrderIds.includes(order.id))
                
                console.log('Available orders:', availableOrders)
                console.log('All assignments:', assignments)
                console.log('Assigned order IDs:', assignedOrderIds)
                console.log('Unassigned orders:', unassignedOrders)
                console.log('Selected brand:', selectedBrand)
                
                return unassignedOrders.length === 0 ? (
                  <p className="text-sm text-gray-500">No available orders</p>
                ) : (
                  unassignedOrders.map(order => {
                    const isRemote = isRemoteStoreLocation(order.location)
                    return (
                    <button
                      key={order.id}
                      onClick={() => {
                        handleCreateAssignment(order.id, selectedDate, selectedTimeSlot)
                        setShowOrderPopup(false)
                      }}
                      className={`w-full text-left p-2 hover:bg-gray-100 rounded border border-gray-200 ${
                        isRemote ? 'border-l-4 border-l-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {order.location?.name}
                          </span>
                          {isRemote ? (
                            <span title="Remote store / shipment">
                              <Ship className="h-4 w-4 text-purple-600" />
                            </span>
                          ) : (
                            order.delivery_type === 'pickup' && (
                              <Package className="h-4 w-4 text-orange-600" />
                            )
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          (() => {
                            const currentTheme = theme || ''
                            
                            if (currentTheme === 'green') return 'bg-green-100 text-green-800'
                            if (currentTheme === 'red') return 'bg-red-100 text-red-800'
                            if (currentTheme === 'yellow') return 'bg-yellow-100 text-yellow-800'
                            if (currentTheme === 'blue') return 'bg-blue-100 text-blue-800'
                            if (currentTheme === 'purple') return 'bg-purple-100 text-purple-800'
                            return 'bg-gray-100 text-gray-800'
                          })()
                        }`}>
                          {order.brand?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'No Date'} - #{order.id.slice(-8)}
                      </div>
                    </button>
                    )
                  })
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
