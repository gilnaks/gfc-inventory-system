'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Brand } from '../../lib/supabase'
import { Plus, Trash2, Save, Edit3, X, Check, X as CloseIcon } from 'lucide-react'
import { Modal } from './Modal'

interface DSIRPredefinedItem {
  id?: string
  brand_id: string
  category: 'sales' | 'materials' | 'denominations'
  name: string
  price?: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

interface DSIRItemManagerModalProps {
  isOpen: boolean
  onClose: () => void
  selectedBrand: Brand
  theme: string
}

export function DSIRItemManagerModal({ isOpen, onClose, selectedBrand, theme }: DSIRItemManagerModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeCategory, setActiveCategory] = useState<'sales' | 'materials' | 'denominations'>('sales')
  
  // Items by category
  const [salesItems, setSalesItems] = useState<DSIRPredefinedItem[]>([])
  const [materialsItems, setMaterialsItems] = useState<DSIRPredefinedItem[]>([])
  const [denominationsItems, setDenominationsItems] = useState<DSIRPredefinedItem[]>([])
  
  // Editing state
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'name' | 'price' | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')

  const categories = [
    { key: 'sales', label: 'Sales Items', items: salesItems, setItems: setSalesItems },
    { key: 'materials', label: 'Materials/Supplies', items: materialsItems, setItems: setMaterialsItems },
    { key: 'denominations', label: 'Cash Denominations', items: denominationsItems, setItems: setDenominationsItems }
  ] as const

  useEffect(() => {
    if (isOpen && selectedBrand.id) {
      loadItems()
    }
  }, [isOpen, selectedBrand.id])

  const loadItems = async () => {
    if (!selectedBrand.id) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('dsir_predefined_items')
        .select('*')
        .eq('brand_id', selectedBrand.id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      // Group items by category
      const sales = data?.filter(item => item.category === 'sales') || []
      const materials = data?.filter(item => item.category === 'materials') || []
      const denominations = data?.filter(item => item.category === 'denominations') || []

      setSalesItems(sales)
      setMaterialsItems(materials)
      setDenominationsItems(denominations)
    } catch (error) {
      console.error('Error loading items:', error)
      setError('Failed to load predefined items')
    } finally {
      setLoading(false)
    }
  }

  const saveItem = async (item: DSIRPredefinedItem) => {
    setSaving(true)
    try {
      if (item.id) {
        // Update existing item
        const { error } = await supabase
          .from('dsir_predefined_items')
          .update({
            name: item.name,
            price: item.price || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)

        if (error) throw error
      } else {
        // Create new item
        const { error } = await supabase
          .from('dsir_predefined_items')
          .insert({
            brand_id: selectedBrand.id,
            category: item.category,
            name: item.name,
            price: item.price || 0,
            is_active: true
          })

        if (error) throw error
      }

      await loadItems()
      setSuccess('Item saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error saving item:', error)
      setError('Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('dsir_predefined_items')
        .update({ is_active: false })
        .eq('id', itemId)

      if (error) throw error

      await loadItems()
      setSuccess('Item deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error deleting item:', error)
      setError('Failed to delete item')
    } finally {
      setSaving(false)
    }
  }

  const addNewItem = async () => {
    if (!newItemName.trim()) return

    const newItem: DSIRPredefinedItem = {
      brand_id: selectedBrand.id,
      category: activeCategory,
      name: newItemName.trim(),
      price: activeCategory === 'sales' ? (parseFloat(newItemPrice) || 0) : 0,
      is_active: true
    }

    await saveItem(newItem)
    setNewItemName('')
    setNewItemPrice('')
  }

  const startEditing = (itemId: string, field: 'name' | 'price', currentValue: string | number) => {
    setEditingItem(itemId)
    setEditingField(field)
    setEditingValue(currentValue.toString())
  }

  const cancelEditing = () => {
    setEditingItem(null)
    setEditingField(null)
    setEditingValue('')
  }

  const saveEditing = async (item: DSIRPredefinedItem) => {
    const updatedItem = { 
      ...item, 
      [editingField!]: editingField === 'price' ? parseFloat(editingValue) || 0 : editingValue.trim() 
    }
    await saveItem(updatedItem)
    setEditingItem(null)
    setEditingField(null)
    setEditingValue('')
  }

  const getThemeColors = () => {
    switch (theme) {
      case 'green':
        return {
          primary: 'bg-green-600 hover:bg-green-700',
          secondary: 'bg-green-100 text-green-800',
          border: 'border-green-300',
          focus: 'focus:ring-green-500 focus:border-green-500'
        }
      case 'red':
        return {
          primary: 'bg-red-600 hover:bg-red-700',
          secondary: 'bg-red-100 text-red-800',
          border: 'border-red-300',
          focus: 'focus:ring-red-500 focus:border-red-500'
        }
      case 'yellow':
        return {
          primary: 'bg-yellow-600 hover:bg-yellow-700',
          secondary: 'bg-yellow-100 text-yellow-800',
          border: 'border-yellow-300',
          focus: 'focus:ring-yellow-500 focus:border-yellow-500'
        }
      default:
        return {
          primary: 'bg-blue-600 hover:bg-blue-700',
          secondary: 'bg-blue-100 text-blue-800',
          border: 'border-blue-300',
          focus: 'focus:ring-blue-500 focus:border-blue-500'
        }
    }
  }

  const colors = getThemeColors()

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} align="center" backdropClassName="bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">DSIR Predefined Items</h2>
            <p className="text-gray-600">Manage predefined items for Daily Sales & Inventory Reports</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading predefined items...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {categories.map((category) => (
                    <button
                      key={category.key}
                      onClick={() => setActiveCategory(category.key)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeCategory === category.key
                          ? theme === 'green' ? 'border-green-500 text-green-600' :
                            theme === 'red' ? 'border-red-500 text-red-600' :
                            theme === 'yellow' ? 'border-yellow-500 text-yellow-600' :
                            'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {category.label} ({category.items.length})
                    </button>
                  ))}
                </nav>
              </div>

              {/* Add New Item */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex space-x-4">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={`Add new ${categories.find(c => c.key === activeCategory)?.label.toLowerCase()}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                  />
                  {activeCategory === 'sales' && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="Price"
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                    />
                  )}
                  <button
                    onClick={addNewItem}
                    disabled={!newItemName.trim() || saving}
                    className={`flex items-center space-x-2 px-4 py-2 ${colors.primary} text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {categories.find(c => c.key === activeCategory)?.label}
                  </h3>
                  
                  {categories.find(c => c.key === activeCategory)?.items.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No items found. Add some items to get started.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categories.find(c => c.key === activeCategory)?.items.map((item) => (
                        <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          {editingItem === item.id ? (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <input
                                  type={editingField === 'price' ? 'number' : 'text'}
                                  step={editingField === 'price' ? '0.01' : undefined}
                                  min={editingField === 'price' ? '0' : undefined}
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  onKeyPress={(e) => e.key === 'Enter' && saveEditing(item)}
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEditing(item)}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="text-gray-600 hover:text-gray-800"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-900 font-medium">{item.name}</span>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => startEditing(item.id!, 'name', item.name)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Edit name"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteItem(item.id!)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Delete item"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              {item.category === 'sales' && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">
                                    ₱{(item.price || 0).toFixed(2)}
                                  </span>
                                  <button
                                    onClick={() => startEditing(item.id!, 'price', item.price || 0)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Edit price"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800">{success}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
