'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Calculator } from 'lucide-react'

// Section A: Sales Inventory Component
export function SalesInventorySection({ 
  items, 
  onItemsChange, 
  predefinedItems, 
  reportId 
}: {
  items: any[]
  onItemsChange: (items: any[]) => void
  predefinedItems: string[]
  reportId: string
}) {
  const [loading, setLoading] = useState(false)

  const addItem = () => {
    const newItem = {
      item_name: '',
      beginning_inventory: 0,
      arrival: 0,
      pull_out: 0,
      new_inventory: 0,
      ending_inventory: 0,
      sold: 0,
      price: 0,
      sales: 0
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (index: number, field: string, value: any) => {
    console.log(`🔍 DEBUG: updateItem called - field: "${field}", value: "${value}", index: ${index}`)
    
    const updatedItems = [...items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    console.log(`🔍 DEBUG: Before calculations - item:`, {
      beginning: updatedItems[index].beginning_inventory,
      arrival: updatedItems[index].arrival,
      pullOut: updatedItems[index].pull_out,
      ending: updatedItems[index].ending_inventory,
      sold: updatedItems[index].sold,
      sales: updatedItems[index].sales
    })
    
    // Calculate new_inventory and ending_inventory
    if (field === 'beginning_inventory' || field === 'arrival' || field === 'pull_out') {
      console.log(`🔍 DEBUG: Calculating new_inventory and ending_inventory for field: ${field}`)
      const beg = updatedItems[index].beginning_inventory || 0
      const arrival = updatedItems[index].arrival || 0
      const pullOut = updatedItems[index].pull_out || 0
      updatedItems[index].new_inventory = beg + arrival
      console.log(`🔍 DEBUG: New inventory calculated: ${beg} + ${arrival} = ${updatedItems[index].new_inventory}`)
      
      // Only auto-calculate ending_inventory if it hasn't been manually set and is currently blank
      if (updatedItems[index].ending_inventory === '' || updatedItems[index].ending_inventory === null || updatedItems[index].ending_inventory === undefined) {
        updatedItems[index].ending_inventory = beg + arrival - pullOut
        console.log(`🔍 DEBUG: Auto-calculated ending inventory: ${beg} + ${arrival} - ${pullOut} = ${updatedItems[index].ending_inventory}`)
      } else {
        console.log(`🔍 DEBUG: Not auto-calculating ending inventory because it's already set: ${updatedItems[index].ending_inventory}`)
      }
    }
    
    // Calculate sold and sales ONLY when ending_inventory field is directly modified by user
    if (field === 'ending_inventory') {
      console.log(`🔍 DEBUG: Calculating sold because ending_inventory field was modified`)
      const beg = updatedItems[index].beginning_inventory || 0
      const arrival = updatedItems[index].arrival || 0
      const pullOut = updatedItems[index].pull_out || 0
      const ending = updatedItems[index].ending_inventory
      
      console.log(`🔍 DEBUG: Values for sold calculation - beg: ${beg}, arrival: ${arrival}, pullOut: ${pullOut}, ending: ${ending}`)
      
      // Only calculate sold if ending_inventory is actually provided (not blank/empty)
      if (ending !== '' && ending !== null && ending !== undefined) {
        const sold = beg + arrival - pullOut - (ending || 0)
        updatedItems[index].sold = sold
        updatedItems[index].sales = sold * (updatedItems[index].price || 0)
        console.log(`🔍 DEBUG: Calculated sold: ${sold}, sales: ${updatedItems[index].sales}`)
      } else {
        // If ending_inventory is blank, don't calculate sold
        updatedItems[index].sold = 0
        updatedItems[index].sales = 0
        console.log(`🔍 DEBUG: Ending inventory is blank, setting sold to 0`)
      }
    } else {
      console.log(`🔍 DEBUG: Field "${field}" is not ending_inventory, so NOT calculating sold`)
    }
    
    if (field === 'price') {
      console.log(`🔍 DEBUG: Updating sales based on price change`)
      const sold = updatedItems[index].sold || 0
      updatedItems[index].sales = sold * value
      console.log(`🔍 DEBUG: New sales: ${sold} * ${value} = ${updatedItems[index].sales}`)
    }

    console.log(`🔍 DEBUG: After calculations - item:`, {
      beginning: updatedItems[index].beginning_inventory,
      arrival: updatedItems[index].arrival,
      pullOut: updatedItems[index].pull_out,
      ending: updatedItems[index].ending_inventory,
      sold: updatedItems[index].sold,
      sales: updatedItems[index].sales
    })

    onItemsChange(updatedItems)
  }

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index)
    onItemsChange(updatedItems)
  }

  const saveItem = async (item: any, index: number) => {
    if (!item.item_name.trim()) return

    setLoading(true)
    try {
      if (item.id) {
        // Update existing item
        const { error } = await supabase
          .from('dsir_sales_inventory')
          .update({
            item_name: item.item_name,
            beginning_inventory: item.beginning_inventory,
            arrival: item.arrival,
            pull_out: item.pull_out,
            new_inventory: item.new_inventory,
            ending_inventory: item.ending_inventory,
            sold: item.sold,
            price: item.price,
            sales: item.sales
          })
          .eq('id', item.id)

        if (error) throw error
      } else {
        // Create new item
        const { data, error } = await supabase
          .from('dsir_sales_inventory')
          .insert({
            dsir_report_id: reportId,
            item_name: item.item_name,
            beginning_inventory: item.beginning_inventory,
            arrival: item.arrival,
            pull_out: item.pull_out,
            new_inventory: item.new_inventory,
            ending_inventory: item.ending_inventory,
            sold: item.sold,
            price: item.price,
            sales: item.sales
          })
          .select()
          .single()

        if (error) throw error

        // Update the item with the new ID
        const updatedItems = [...items]
        updatedItems[index] = { ...updatedItems[index], id: data.id }
        onItemsChange(updatedItems)
      }
    } catch (error) {
      console.error('Error saving sales inventory item:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Section A: SALES INVENTORY</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ITEM</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BEG INV</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ARRIVAL</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PULL-OUT</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NEW INV</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">END INV</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SOLD</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRICE</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SALES</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <select
                    value={item.item_name}
                    onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select item</option>
                    {predefinedItems.map((predefinedItem) => (
                      <option key={predefinedItem} value={predefinedItem}>
                        {predefinedItem}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.beginning_inventory}
                    onChange={(e) => updateItem(index, 'beginning_inventory', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.arrival}
                    onChange={(e) => updateItem(index, 'arrival', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.pull_out}
                    onChange={(e) => updateItem(index, 'pull_out', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.new_inventory}
                    onChange={(e) => updateItem(index, 'ending', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.ending_inventory || ''}
                    onChange={(e) => updateItem(index, 'ending_inventory', e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Enter ending inventory"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.sold}
                    readOnly
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.sales}
                    readOnly
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => saveItem(item, index)}
                      disabled={loading || !item.item_name.trim()}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                    >
                      <Calculator className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addItem}
        className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        <span>Add Item</span>
      </button>
    </div>
  )
}

// Section B: Ice Cream Inventory Component
export function IceCreamInventorySection({ 
  items, 
  onItemsChange, 
  predefinedFlavors, 
  reportId 
}: {
  items: any[]
  onItemsChange: (items: any[]) => void
  predefinedFlavors: string[]
  reportId: string
}) {
  const [loading, setLoading] = useState(false)

  const addItem = () => {
    const newItem = {
      flavor: '',
      beginning: 0,
      arrival: 0,
      pull_out: 0,
      ending: 0
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    console.log(`🍦 Ice Cream updateItem - field: ${field}, value: ${value}, index: ${index}`)
    console.log(`🍦 Current item before calculation:`, updatedItems[index])
    
    // Calculate ending inventory ONLY if ending field hasn't been manually set
    if (field === 'beginning' || field === 'arrival' || field === 'pull_out') {
      const beg = updatedItems[index].beginning || 0
      const arrival = updatedItems[index].arrival || 0
      const pullOut = updatedItems[index].pull_out || 0
      
      console.log(`🍦 Calculation values - beg: ${beg}, arrival: ${arrival}, pullOut: ${pullOut}`)
      console.log(`🍦 Current ending value: ${updatedItems[index].ending}`)
      
      // Only auto-calculate ending if it hasn't been manually set and is currently 0 or empty
      if (updatedItems[index].ending === 0 || updatedItems[index].ending === '' || updatedItems[index].ending === null || updatedItems[index].ending === undefined) {
        const newEnding = beg + arrival - pullOut
        updatedItems[index].ending = newEnding
        console.log(`🍦 Auto-calculated new ending: ${newEnding}`)
      } else {
        console.log(`🍦 Not auto-calculating - ending already set to: ${updatedItems[index].ending}`)
      }
    }

    console.log(`🍦 Final item after calculation:`, updatedItems[index])
    onItemsChange(updatedItems)
  }

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index)
    onItemsChange(updatedItems)
  }

  const saveItem = async (item: any, index: number) => {
    if (!item.flavor.trim()) return

    console.log(`🍦 Saving ice cream item:`, item)
    console.log(`🍦 Item values - beginning: ${item.beginning}, arrival: ${item.arrival}, pull_out: ${item.pull_out}, ending: ${item.ending}`)

    setLoading(true)
    try {
      if (item.id) {
        console.log(`🍦 Updating existing item with ID: ${item.id}`)
        const { error } = await supabase
          .from('dsir_ice_cream_inventory')
          .update({
            flavor: item.flavor,
            beginning: item.beginning,
            arrival: item.arrival,
            pull_out: item.pull_out,
            ending: item.ending
          })
          .eq('id', item.id)

        if (error) throw error
        console.log(`🍦 Successfully updated item`)
      } else {
        console.log(`🍦 Inserting new item`)
        const { data, error } = await supabase
          .from('dsir_ice_cream_inventory')
          .insert({
            dsir_report_id: reportId,
            flavor: item.flavor,
            beginning: item.beginning,
            arrival: item.arrival,
            pull_out: item.pull_out,
            ending: item.ending
          })
          .select()
          .single()

        if (error) throw error
        console.log(`🍦 Successfully inserted item with ID: ${data.id}`)

        const updatedItems = [...items]
        updatedItems[index] = { ...updatedItems[index], id: data.id }
        onItemsChange(updatedItems)
      }
    } catch (error) {
      console.error('Error saving ice cream inventory item:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Section B: ICE CREAM INVENTORY</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FLAVOR</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BEG</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">(+)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">(-)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">END</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <select
                    value={item.flavor}
                    onChange={(e) => updateItem(index, 'flavor', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select flavor</option>
                    {predefinedFlavors.map((flavor) => (
                      <option key={flavor} value={flavor}>
                        {flavor}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.beginning}
                    onChange={(e) => updateItem(index, 'beginning', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.arrival}
                    onChange={(e) => updateItem(index, 'arrival', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.pull_out}
                    onChange={(e) => updateItem(index, 'pull_out', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.ending}
                    onChange={(e) => updateItem(index, 'ending', parseInt(e.target.value) || 0)}
                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50 ${item.ending < 0 ? 'text-red-600' : ''}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => saveItem(item, index)}
                      disabled={loading || !item.flavor.trim()}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                    >
                      <Calculator className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addItem}
        className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        <span>Add Flavor</span>
      </button>
    </div>
  )
}

// Section C: Materials/Supplies Inventory Component
export function MaterialsInventorySection({ 
  items, 
  onItemsChange, 
  predefinedItems, 
  reportId 
}: {
  items: any[]
  onItemsChange: (items: any[]) => void
  predefinedItems: string[]
  reportId: string
}) {
  const [loading, setLoading] = useState(false)

  const addItem = () => {
    const newItem = {
      item_name: '',
      beginning: 0,
      arrival: 0,
      pull_out: 0,
      ending: 0
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    // Auto-calculate ending when beginning, arrival, or pull_out changes
    if (field === 'beginning' || field === 'arrival' || field === 'pull_out') {
      const beg = updatedItems[index].beginning || 0
      const arrival = updatedItems[index].arrival || 0
      const pullOut = updatedItems[index].pull_out || 0
      updatedItems[index].ending = beg + arrival - pullOut
    }

    onItemsChange(updatedItems)
  }

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index)
    onItemsChange(updatedItems)
  }

  const saveItem = async (item: any, index: number) => {
    if (!item.item_name.trim()) return

    setLoading(true)
    try {
      if (item.id) {
        const { error } = await supabase
          .from('dsir_materials_inventory')
          .update({
            item_name: item.item_name,
            beginning: item.beginning,
            arrival: item.arrival,
            pull_out: item.pull_out,
            ending: item.ending
          })
          .eq('id', item.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('dsir_materials_inventory')
          .insert({
            dsir_report_id: reportId,
            item_name: item.item_name,
            beginning: item.beginning,
            arrival: item.arrival,
            pull_out: item.pull_out,
            ending: item.ending
          })
          .select()
          .single()

        if (error) throw error

        const updatedItems = [...items]
        updatedItems[index] = { ...updatedItems[index], id: data.id }
        onItemsChange(updatedItems)
      }
    } catch (error) {
      console.error('Error saving materials inventory item:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Section C: MATERIAL/SUPPLIES INVENTORY</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ITEM</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BEG</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">(+)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">(-)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">END</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <select
                    value={item.item_name}
                    onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select item</option>
                    {predefinedItems.map((predefinedItem) => (
                      <option key={predefinedItem} value={predefinedItem}>
                        {predefinedItem}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.beginning}
                    onChange={(e) => updateItem(index, 'beginning', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.arrival}
                    onChange={(e) => updateItem(index, 'arrival', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.pull_out || 0}
                    onChange={(e) => updateItem(index, 'pull_out', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className={`px-2 py-1 bg-gray-50 rounded text-sm font-medium text-center ${(item.ending || 0) < 0 ? 'text-red-600' : ''}`}>
                    {item.ending || 0}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => saveItem(item, index)}
                      disabled={loading || !item.item_name.trim()}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                    >
                      <Calculator className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addItem}
        className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        <span>Add Item</span>
      </button>
    </div>
  )
}

// Section D: Discounts Component
export function DiscountsSection({ 
  items, 
  onItemsChange, 
  reportId,
  orderOptions = []
}: {
  items: any[]
  onItemsChange: (items: any[]) => void
  reportId: string
  orderOptions?: Array<{ value: string; label: string; price: number }>
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  const addItem = () => {
    const newItem = {
      name: '',
      id_type: 'pwd' as 'senior' | 'pwd',
      id_no: '',
      order_type: '',
      order_amount: 0,
      discount_amount: 0
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items]
    const currentItem = { ...updatedItems[index] }
    
    // Update the field
    currentItem[field] = value
    
    // Handle order type selection
    if (field === 'order_type') {
      const selectedOption = orderOptions.find(opt => opt.value === value)
      
      if (selectedOption) {
        currentItem.order_type = selectedOption.value
        currentItem.order_amount = selectedOption.price
        currentItem.discount_amount = selectedOption.price * 0.2 // 20% discount
      } else {
        currentItem.order_type = ''
        currentItem.order_amount = 0
        currentItem.discount_amount = 0
      }
    }
    
    // Update the item in the array
    updatedItems[index] = currentItem
    onItemsChange(updatedItems)
  }

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index)
    onItemsChange(updatedItems)
  }

  const saveItem = async (item: any, index: number) => {
    if (!item.name?.trim() || !item.id_no?.trim() || !item.order_type) {
      alert('Please fill in all required fields: Name, ID Number, and Order Type')
      return
    }

    setSaving(item.id || `new-${index}`)
    setLoading(true)

    try {
      const discountData = {
        name: item.name.trim(),
        id_type: item.id_type,
        id_no: item.id_no.trim(),
        order_type: item.order_type,
        order_amount: item.order_amount,
        discount_amount: item.discount_amount
      }

      if (item.id) {
        // Update existing item
        const { error } = await supabase
          .from('dsir_discounts')
          .update(discountData)
          .eq('id', item.id)

        if (error) throw error
      } else {
        // Insert new item
        const { data, error } = await supabase
          .from('dsir_discounts')
          .insert({
            dsir_report_id: reportId,
            ...discountData
          })
          .select()
          .single()

        if (error) throw error

        // Update local state with the new ID
        const updatedItems = [...items]
        updatedItems[index] = { ...updatedItems[index], id: data.id }
        onItemsChange(updatedItems)
      }
    } catch (error) {
      console.error('Error saving discount item:', error)
      alert('Failed to save discount item. Please try again.')
    } finally {
      setLoading(false)
      setSaving(null)
    }
  }

  const deleteItem = async (item: any, index: number) => {
    if (!item.id) {
      // If it's a new item without ID, just remove from local state
      removeItem(index)
      return
    }

    if (!confirm('Are you sure you want to delete this discount entry?')) {
      return
    }

    setSaving(item.id)
    setLoading(true)

    try {
      const { error } = await supabase
        .from('dsir_discounts')
        .delete()
        .eq('id', item.id)

      if (error) throw error

      // Remove from local state
      removeItem(index)
    } catch (error) {
      console.error('Error deleting discount item:', error)
      alert('Failed to delete discount item. Please try again.')
    } finally {
      setLoading(false)
      setSaving(null)
    }
  }

  const isItemValid = (item: any) => {
    return item.name?.trim() && item.id_no?.trim() && item.order_type
  }

  const totalDiscount = items.reduce((total, item) => total + (item.discount_amount || 0), 0)
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Section D: DISCOUNTS</h3>
        <button
          onClick={addItem}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          <span>Add Discount</span>
        </button>
      </div>
      
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No discount entries yet.</p>
          <p className="text-sm">Click "Add Discount" to add one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAME</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID NO.</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ORDER TYPE</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ORDER AMOUNT</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DISCOUNT (20%)</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={item.id || `new-${index}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.name || ''}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Customer name"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.id_no || ''}
                      onChange={(e) => updateItem(index, 'id_no', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ID number"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.order_type || ''}
                      onChange={(e) => updateItem(index, 'order_type', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select order type</option>
                      {orderOptions.map((option, optIndex) => (
                        <option key={optIndex} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium text-gray-900">
                      ₱{item.order_amount || 0}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium text-blue-600">
                      ₱{(item.discount_amount || 0).toFixed(2)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => saveItem(item, index)}
                        disabled={loading || saving === (item.id || `new-${index}`) || !isItemValid(item)}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isItemValid(item) ? 'Save discount entry' : 'Fill in all required fields'}
                      >
                        {saving === (item.id || `new-${index}`) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        ) : (
                          <Calculator className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteItem(item, index)}
                        disabled={loading || saving === (item.id || `new-${index}`)}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete discount entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Total Discount Calculation */}
      {items.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-700">TOTAL DISCOUNT</span>
            <span className="text-xl font-bold text-blue-600">
              ₱{totalDiscount.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Section E: Expenses Component
export function ExpensesSection({ 
  items, 
  onItemsChange, 
  reportId 
}: {
  items: any[]
  onItemsChange: (items: any[]) => void
  reportId: string
}) {
  const [loading, setLoading] = useState(false)

  const addItem = () => {
    const newItem = {
      particulars: '',
      amount: 0
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    onItemsChange(updatedItems)
  }

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index)
    onItemsChange(updatedItems)
  }

  const saveItem = async (item: any, index: number) => {
    if (!item.particulars.trim()) return

    setLoading(true)
    try {
      if (item.id) {
        const { error } = await supabase
          .from('dsir_expenses')
          .update({
            particulars: item.particulars,
            amount: item.amount
          })
          .eq('id', item.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('dsir_expenses')
          .insert({
            dsir_report_id: reportId,
            particulars: item.particulars,
            amount: item.amount
          })
          .select()
          .single()

        if (error) throw error

        const updatedItems = [...items]
        updatedItems[index] = { ...updatedItems[index], id: data.id }
        onItemsChange(updatedItems)
      }
    } catch (error) {
      console.error('Error saving expense item:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Section E: EXPENSES</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PARTICULARS</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AMOUNT</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.particulars}
                    onChange={(e) => updateItem(index, 'particulars', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Expense description"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => saveItem(item, index)}
                      disabled={loading || !item.particulars.trim()}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                    >
                      <Calculator className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addItem}
        className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        <span>Add Expense</span>
      </button>
    </div>
  )
}

// Section F: Sales Reconciliation Component
export function SalesReconSection({ 
  items, 
  onItemsChange, 
  predefinedDenominations, 
  reportId, 
  netSales 
}: {
  items: any[]
  onItemsChange: (items: any[]) => void
  predefinedDenominations: any[]
  reportId: string
  netSales: number
}) {
  const [loading, setLoading] = useState(false)

  const addItem = () => {
    const newItem = {
      denomination: '',
      quantity: 0,
      amount: 0
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    // Calculate amount based on denomination and quantity
    if (field === 'denomination' || field === 'quantity') {
      const denomination = updatedItems[index].denomination
      const quantity = updatedItems[index].quantity || 0
      const denominationValue = predefinedDenominations.find(d => d.name === denomination)?.value || 0
      updatedItems[index].amount = denominationValue * quantity
    }

    onItemsChange(updatedItems)
  }

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index)
    onItemsChange(updatedItems)
  }

  const saveItem = async (item: any, index: number) => {
    if (!item.denomination.trim()) return

    setLoading(true)
    try {
      if (item.id) {
        const { error } = await supabase
          .from('dsir_sales_recon')
          .update({
            denomination: item.denomination,
            quantity: item.quantity,
            amount: item.amount
          })
          .eq('id', item.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('dsir_sales_recon')
          .insert({
            dsir_report_id: reportId,
            denomination: item.denomination,
            quantity: item.quantity,
            amount: item.amount
          })
          .select()
          .single()

        if (error) throw error

        const updatedItems = [...items]
        updatedItems[index] = { ...updatedItems[index], id: data.id }
        onItemsChange(updatedItems)
      }
    } catch (error) {
      console.error('Error saving sales recon item:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalCash = items.reduce((sum, item) => sum + (item.amount || 0), 0)
  const discrepancy = totalCash - netSales

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Section F: SALES RECON</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DENO</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QTY</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AMOUNT</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <select
                    value={item.denomination}
                    onChange={(e) => updateItem(index, 'denomination', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select denomination</option>
                    {predefinedDenominations.map((denom) => (
                      <option key={denom.name} value={denom.name}>
                        {denom.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => updateItem(index, 'ending', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => saveItem(item, index)}
                      disabled={loading || !item.denomination.trim()}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                    >
                      <Calculator className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">TOTAL CASH</label>
          <input
            type="number"
            value={totalCash}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LESS: NET SALES</label>
          <input
            type="number"
            value={netSales}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">DISCREPANCY</label>
          <input
            type="number"
            value={discrepancy}
            disabled
            className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 ${
              discrepancy === 0 ? 'text-green-600' : 
              discrepancy > 0 ? 'text-blue-600' : 'text-red-600'
            }`}
          />
        </div>
      </div>

      <button
        onClick={addItem}
        className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        <span>Add Denomination</span>
      </button>
    </div>
  )
}
