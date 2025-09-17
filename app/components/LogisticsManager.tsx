'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, Clock, Truck, Package, Plus, X, Edit, Trash2, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react'
import { formatPhilippinesDateTime } from '../../lib/timezone'

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
    delivery_type: 'delivery' | 'pickup'
    created_at: string
    brand_id: string
    brand?: {
      name: string
    }
    location?: {
      name: string
    }
  }
}

interface LogisticsManagerProps {
  selectedBrand: any | null
  theme?: string
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
             location:locations(name)
           )
        `)
        .gte('date', startOfMonth.toISOString().split('T')[0])
        .lte('date', endOfMonth.toISOString().split('T')[0])
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
           location:locations(name)
         `)
        .eq('brand_id', selectedBrand.id)
        .in('status', ['pending', 'approved', 'released', 'paid'])
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
        .select()

      if (error) {
        console.error('Error creating assignment:', error)
        return
      }

      // Refresh assignments
      await fetchAssignments()
    } catch (error) {
      console.error('Error creating assignment:', error)
    }
  }

  const handleUpdateAssignmentStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('logistics_assignments')
        .update({ status: newStatus })
        .eq('id', assignmentId)

      if (error) {
        console.error('Error updating assignment:', error)
        return
      }

      await fetchAssignments()
    } catch (error) {
      console.error('Error updating assignment:', error)
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    try {
      const { error } = await supabase
        .from('logistics_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) {
        console.error('Error deleting assignment:', error)
        return
      }

      await fetchAssignments()
    } catch (error) {
      console.error('Error deleting assignment:', error)
    }
  }

  const getAssignmentsForDate = (date: string, timeSlot: 'morning' | 'afternoon') => {
    return assignments.filter(
      assignment => assignment.date === date && assignment.time_slot === timeSlot
    )
  }

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
  const getCalendarBrandColor = (brandId: string, brandName?: string) => {
    // Custom brand color mapping - same base color for both time slots
    const brandColorMap: { [key: string]: { morning: string; afternoon: string } } = {
      'mychoice': {
        morning: 'bg-green-100 border-green-400',
        afternoon: 'bg-green-100 border-green-400 border-l-4'
      },
      'mang sorbetes': {
        morning: 'bg-yellow-100 border-yellow-400',
        afternoon: 'bg-yellow-100 border-yellow-400 border-l-4'
      },
      'gelatofilipino': {
        morning: 'bg-red-100 border-red-400',
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
        morning: 'bg-blue-100 border-blue-400',
        afternoon: 'bg-blue-100 border-blue-400 border-l-4'
      }
      case 1: return {
        morning: 'bg-purple-100 border-purple-400',
        afternoon: 'bg-purple-100 border-purple-400 border-l-4'
      }
      case 2: return {
        morning: 'bg-gray-100 border-gray-400',
        afternoon: 'bg-gray-100 border-gray-400 border-l-4'
      }
      default: return {
        morning: 'bg-gray-100 border-gray-400',
        afternoon: 'bg-gray-100 border-gray-400 border-l-4'
      }
    }
  }

  // Color for popup orders (uses current theme)
  const getPopupBrandColor = () => {
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
  }

  const getDaysInMonth = () => {
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
  }

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

  const openOrderPopup = async (event: React.MouseEvent, date: string, timeSlot: 'morning' | 'afternoon') => {
    setSelectedDate(date)
    setSelectedTimeSlot(timeSlot)
    setPopupPosition({ x: event.clientX, y: event.clientY })
    // Refresh assignments before showing popup to ensure we have latest data
    await fetchAssignments()
    setShowOrderPopup(true)
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate < today
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Logistics Manager</h3>
          <p className="text-gray-600">Schedule and manage order deliveries</p>
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
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50 rounded-lg">
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {getDaysInMonth().map((date, index) => {
            if (!date) {
              return <div key={index} className="p-3"></div>
            }

             const dateString = formatDate(date)
             const morningAssignments = getAssignmentsForDate(dateString, 'morning')
             const afternoonAssignments = getAssignmentsForDate(dateString, 'afternoon')
             const isCurrentDay = isToday(date)
             const isPast = isPastDate(date)

            return (
              <div
                key={index}
                className={`p-2 border rounded-lg min-h-[120px] ${
                  isPast ? 'bg-gray-100 border-gray-300 opacity-60' :
                  isCurrentDay ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
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
                       onClick={(e) => !isPast && openOrderPopup(e, dateString, 'morning')}
                       disabled={isPast}
                       className={`text-xs ${
                         isPast 
                           ? 'text-gray-400 cursor-not-allowed' 
                           : 'text-blue-600 hover:text-blue-800'
                       }`}
                     >
                       <Plus className="h-3 w-3 text-gray-600" />
                     </button>
                  </div>
                   <div className="space-y-1">
                     {morningAssignments.map(assignment => {
                       const brandColors = getCalendarBrandColor(assignment.order?.brand_id || '', assignment.order?.brand?.name)
                       return (
                         <div
                           key={assignment.id}
                           className={`text-xs p-1 ${brandColors.morning} rounded border-l-2 flex items-center justify-between group`}
                         >
                         <div className="flex-1 min-w-0">
                           <div className="font-medium truncate">{assignment.order?.location?.name}</div>
                           <div className="text-gray-600">{assignment.order?.created_at ? new Date(assignment.order.created_at).toLocaleDateString() : 'No Date'}</div>
                         </div>
                         <button
                           onClick={() => handleDeleteAssignment(assignment.id)}
                           className="ml-1 p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                           title="Remove assignment"
                         >
                           <X className="h-3 w-3" />
                         </button>
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
                       onClick={(e) => !isPast && openOrderPopup(e, dateString, 'afternoon')}
                       disabled={isPast}
                       className={`text-xs ${
                         isPast 
                           ? 'text-gray-400 cursor-not-allowed' 
                           : 'text-blue-600 hover:text-blue-800'
                       }`}
                     >
                       <Plus className="h-3 w-3 text-gray-600" />
                     </button>
                  </div>
                   <div className="space-y-1">
                     {afternoonAssignments.map(assignment => {
                       const brandColors = getCalendarBrandColor(assignment.order?.brand_id || '', assignment.order?.brand?.name)
                       return (
                         <div
                           key={assignment.id}
                           className={`text-xs p-1 ${brandColors.afternoon} rounded border-l-2 flex items-center justify-between group`}
                         >
                           <div className="flex-1 min-w-0">
                             <div className="font-medium truncate">{assignment.order?.location?.name}</div>
                             <div className="text-gray-600">{assignment.order?.created_at ? new Date(assignment.order.created_at).toLocaleDateString() : 'No Date'}</div>
                           </div>
                           <button
                             onClick={() => handleDeleteAssignment(assignment.id)}
                             className="ml-1 p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                             title="Remove assignment"
                           >
                             <X className="h-3 w-3" />
                           </button>
                         </div>
                       )
                     })}
                   </div>
                </div>
              </div>
            )
          })}
        </div>
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
                  unassignedOrders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => {
                        handleCreateAssignment(order.id, selectedDate, selectedTimeSlot)
                        setShowOrderPopup(false)
                      }}
                      className="w-full text-left p-2 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-gray-900">
                          {order.location?.name}
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
                  ))
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
