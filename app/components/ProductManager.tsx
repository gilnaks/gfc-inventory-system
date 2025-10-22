'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, Product, Brand } from '../../lib/supabase'
import { Plus, Edit, Trash2, Save, X, CheckCircle } from 'lucide-react'
import { getPhilippinesDate } from '../../lib/timezone'

interface ProductManagerProps {
  selectedBrand: Brand | null
  theme?: string
}

export function ProductManager({ selectedBrand, theme = 'blue' }: ProductManagerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    category: '',
    unit: 'pcs',
    price: 0,
    initial_stock: 0,
    production: 0,
    released: 0,
    reserved: 0
  })
  const [categories, setCategories] = useState<string[]>([])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [fetchTimeout, setFetchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (selectedBrand) {
      // Clear any existing timeout
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
      }
      
      // Set a new timeout to debounce the request
      const timeout = setTimeout(() => {
        fetchProducts()
      }, 100) // 100ms debounce
      
      setFetchTimeout(timeout)
    }
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
      }
      if (updateTimeout) {
        clearTimeout(updateTimeout)
      }
    }
  }, [selectedBrand])

  // Realtime subscription for products changes
  useEffect(() => {
    if (!selectedBrand) return

    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products',
          filter: `brand_id=eq.${selectedBrand.id}`
        },
        (payload) => {
          console.log('Products realtime update:', payload)
          
          // Only refetch if we're not currently editing
          // This prevents the realtime update from overwriting local edits
          if (!editingProduct) {
            fetchProducts()
          } else {
            console.log('Skipping realtime refetch - currently editing product')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedBrand, editingProduct])

  useEffect(() => {
    // Extract unique categories from products
    const uniqueCategories = Array.from(new Set(products
      .map(p => p.category)
      .filter(cat => cat && cat.trim() !== '')
    )).sort()
    setCategories(uniqueCategories)
  }, [products])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showCategoryDropdown && !target.closest('.category-dropdown')) {
        setShowCategoryDropdown(false)
      }
    }

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCategoryDropdown])

  const getBrandPrefix = (brandSlug: string) => {
    switch (brandSlug) {
      case 'gelatofilipino':
        return 'GF-'
      case 'mychoice':
        return 'MC-'
      case 'mang-sorbetes':
        return 'MS-'
      default:
        return 'PR-'
    }
  }

  const generateNextSKU = useCallback(async (brandId: string) => {
    if (!selectedBrand) return ''

    try {
      // Use a more efficient query to get the highest SKU number
      const prefix = getBrandPrefix(selectedBrand.slug)
      
      // Query only SKUs that start with our prefix, ordered by SKU descending
      const { data, error } = await supabase
        .from('products')
        .select('sku')
        .eq('brand_id', brandId)
        .not('sku', 'is', null)
        .like('sku', `${prefix}%`)
        .order('sku', { ascending: false })
        .limit(1) // Only get the highest one

      if (error) {
        console.error('Error fetching products for SKU generation:', error)
        return prefix + '001'
      }

      let maxNumber = 0

      // Find the highest number in the returned SKU
      if (data && data.length > 0) {
        const sku = data[0].sku
        if (sku && sku.startsWith(prefix)) {
          const numberPart = sku.substring(prefix.length)
          const number = parseInt(numberPart)
          if (!isNaN(number)) {
            maxNumber = number
          }
        }
      }

      // Generate next SKU
      const nextNumber = maxNumber + 1
      return prefix + nextNumber.toString().padStart(3, '0')
    } catch (error) {
      console.error('Error generating SKU:', error)
      return getBrandPrefix(selectedBrand.slug) + '001'
    }
  }, [selectedBrand])

  const fetchProducts = async () => {
    if (!selectedBrand) return
    
    setLoading(true)
    
    try {
      console.log('Fetching products for brand:', selectedBrand.name)
      
      // Query products directly instead of using the view for better performance
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          brand_id,
          name,
          sku,
          category,
          unit,
          price,
          initial_stock,
          production,
          released,
          reserved,
          created_at,
          updated_at
        `)
        .eq('brand_id', selectedBrand.id)
        .order('name')
      
      if (error) {
        console.error('Error fetching products:', error)
        alert('Failed to load products. Please try refreshing the page.')
        return
      }
      
      if (data) {
        console.log('Products fetched successfully:', data.length, 'items')
        
        // Calculate computed fields on the client side for better performance
        const productsWithCalculations = data.map(product => ({
          ...product,
          product_name: product.name,
          brand_name: selectedBrand.name,
          brand_slug: selectedBrand.slug,
          final_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0),
          available_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0) - (product.reserved || 0)
        }))
        
        setProducts(productsWithCalculations)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('Failed to load products. Please check your internet connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Memoized grouped products calculation
  const groupedProducts = useMemo(() => {
    const grouped = products.reduce((acc, product) => {
      const category = product.category || 'Uncategorized'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(product)
      return acc
    }, {} as Record<string, Product[]>)
    
    // Sort categories alphabetically, with 'Uncategorized' last
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })
    
    return sortedCategories.map(category => ({
      category,
      products: grouped[category]
    }))
  }, [products])

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBrand) return

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            brand_id: selectedBrand.id,
            name: newProduct.name,
            sku: newProduct.sku || null,
            category: newProduct.category || null,
            unit: newProduct.unit,
            price: newProduct.price,
            initial_stock: newProduct.initial_stock,
            production: newProduct.production,
            released: newProduct.released,
            reserved: newProduct.reserved
          }
        ])
        .select()

      if (error) {
        console.error('Error adding product:', error)
        alert('Error adding product: ' + error.message)
        return
      }

      if (data && data[0]) {
        // Optimistic UI update - add the new product to state immediately
        const newProductData = data[0]
        const computedProduct = {
          ...newProductData,
          product_id: newProductData.id,
          product_name: newProductData.name,
          final_stock: (newProductData.initial_stock || 0) + (newProductData.production || 0) - (newProductData.released || 0),
          available_stock: (newProductData.initial_stock || 0) + (newProductData.production || 0) - (newProductData.released || 0) - (newProductData.reserved || 0)
        }
        setProducts(prev => [...prev, computedProduct])
        setNewProduct({ name: '', sku: '', category: '', unit: 'pcs', price: 0, initial_stock: 0, production: 0, released: 0, reserved: 0 })
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Error adding product:', error)
      alert('Error adding product')
    }
  }

  const handleUpdateProduct = useCallback(async (product: Product) => {
    // Clear any existing timeout
    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }
    
    // Debounce the update to prevent excessive API calls
    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .update({
            name: product.name,
            sku: product.sku,
            category: product.category,
            unit: product.unit,
            price: product.price,
            initial_stock: product.initial_stock,
            production: product.production,
            released: product.released,
            reserved: product.reserved
          })
          .eq('id', product.id)
          .select()

        if (error) {
          console.error('Error updating product:', error)
          alert('Error updating product: ' + error.message)
          return
        }

        if (data) {
          // Update local state immediately for better UX
          setProducts(prev => prev.map(p => 
            p.id === product.id 
              ? {
                  ...p,
                  ...product,
                  product_name: product.name,
                  final_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0),
                  available_stock: (product.initial_stock || 0) + (product.production || 0) - (product.released || 0) - (product.reserved || 0)
                }
              : p
          ))
          setEditingProduct(null)
        }
      } catch (error) {
        console.error('Error updating product:', error)
        alert('Error updating product')
      }
    }, 500) // 500ms debounce
    
    setUpdateTimeout(timeout)
  }, [updateTimeout])

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    // Optimistic UI update - remove product immediately
    const previousProducts = products
    setProducts(products.filter(p => (p.product_id || p.id) !== productId))

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) {
        console.error('Error deleting product:', error)
        alert('Error deleting product: ' + error.message)
        // Revert optimistic update on error
        setProducts(previousProducts)
        return
      }

      console.log('Product deleted successfully')
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Error deleting product')
      // Revert optimistic update on error
      setProducts(previousProducts)
    }
  }

  const handleFinalizeStock = async () => {
    if (!selectedBrand) return

    // Require password
    const password = prompt('Please enter Wendy\'s birthdate to finalize stock:')
    if (password !== '030199') {
      alert('Invalid birthdate. Stock finalization cancelled.')
      return
    }

    if (!confirm('Are you sure you want to finalize the stock? This will add production to initial stock and reset production for all products.')) {
      return
    }

    try {
      // First, get all products for the current brand
      const { data: allProducts, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', selectedBrand.id)

      if (fetchError) {
        console.error('Error fetching products:', fetchError)
        alert('Error fetching products for finalization')
        return
      }

      if (!allProducts || allProducts.length === 0) {
        alert('No products found to finalize')
        return
      }

      // Create daily summary record first
      const { data: summaryData, error: summaryError } = await supabase
        .from('daily_stock_summaries')
        .insert({
          brand_id: selectedBrand.id,
          date: getPhilippinesDate(), // YYYY-MM-DD format in Philippines timezone
          total_production: allProducts.reduce((sum, p) => sum + (p.production || 0), 0),
          total_released: allProducts.reduce((sum, p) => sum + (p.released || 0), 0),
          total_final_stock: allProducts.reduce((sum, p) => sum + (p.initial_stock || 0) + (p.production || 0), 0)
        })
        .select()
        .single()

      if (summaryError) {
        console.error('Error creating daily summary:', summaryError)
        alert('Error creating daily summary')
        return
      }

      // Optimistic UI update - update all products immediately
      const previousProducts = products
      setProducts(prevProducts => prevProducts.map(p => {
        const newInitialStock = (p.initial_stock || 0) + (p.production || 0)
        return {
          ...p,
          initial_stock: newInitialStock,
          production: 0,
          final_stock: newInitialStock - (p.released || 0),
          available_stock: newInitialStock - (p.released || 0) - (p.reserved || 0)
        }
      }))

      // Update all products in parallel
      const updatePromises = allProducts.map(async (product) => {
        const newInitialStock = (product.initial_stock || 0) + (product.production || 0)
        
        const { error: updateError } = await supabase
          .from('products')
          .update({
            initial_stock: newInitialStock,
            production: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id)

        if (updateError) {
          console.error(`Error updating product ${product.name}:`, updateError)
          throw new Error(`Failed to update product ${product.name}`)
        }
      })

      const results = await Promise.allSettled(updatePromises)
      const failed = results.filter(r => r.status === 'rejected')
      
      if (failed.length > 0) {
        alert(`Failed to update ${failed.length} product(s). Stock finalization incomplete.`)
        // Revert optimistic update on error
        setProducts(previousProducts)
        return
      }

      alert('Stock finalized successfully! Production has been added to initial stock.')
      
    } catch (error) {
      console.error('Error finalizing stock:', error)
      alert('Error finalizing stock')
    }
  }

  if (!selectedBrand) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Please select a brand to manage products</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Products & Inventory
          </h1>
          <p className="text-sm text-gray-600">
            Manage products and inventory for {selectedBrand.name}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleFinalizeStock}
            className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
              theme === 'green' ? 'bg-orange-600 hover:bg-orange-700' :
              theme === 'red' ? 'bg-orange-600 hover:bg-orange-700' :
              theme === 'yellow' ? 'bg-orange-600 hover:bg-orange-700' :
              'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            <span>Finalize Stock</span>
          </button>
          <button
            onClick={async () => {
              const nextSKU = await generateNextSKU(selectedBrand.id)
              setNewProduct({
                ...newProduct,
                sku: nextSKU
              })
              setShowAddForm(true)
            }}
            className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
              theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
              theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
              theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
              'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Product</h3>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewProduct({ name: '', sku: '', category: '', unit: 'pcs', price: 0, initial_stock: 0, production: 0, released: 0, reserved: 0 })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKU (Auto-generated)
                  </label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                    placeholder="Auto-generated SKU"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    SKU format: {getBrandPrefix(selectedBrand.slug)}XXX (e.g., {getBrandPrefix(selectedBrand.slug)}001)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <div className="relative category-dropdown">
                    <input
                      type="text"
                      value={newProduct.category}
                      onChange={(e) => {
                        setNewProduct({...newProduct, category: e.target.value})
                        setShowCategoryDropdown(true)
                      }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter or select category"
                    />
                    {showCategoryDropdown && categories.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {categories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setNewProduct({...newProduct, category})
                              setShowCategoryDropdown(false)
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-900"
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Initial Stock, Unit, and Price in same row */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.initial_stock}
                      onChange={(e) => setNewProduct({...newProduct, initial_stock: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="pans">Pans</option>
                      <option value="pcs">Pieces</option>
                      <option value="gallons">Gallons</option>
                      <option value="liters">Liters</option>
                      <option value="kg">Kilograms</option>
                      <option value="boxes">Boxes</option>
                      <option value="bags">Bags</option>
                      <option value="g">Grams</option>
                      <option value="bottles">Bottles</option>
                      <option value="packs">Packs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (₱)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setNewProduct({ name: '', sku: '', category: '', unit: 'pcs', price: 0, initial_stock: 0, production: 0, released: 0, reserved: 0 })
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
                    theme === 'green' ? 'bg-green-600 hover:bg-green-700' :
                    theme === 'red' ? 'bg-red-600 hover:bg-red-700' :
                    theme === 'yellow' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Save className="h-4 w-4" />
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products List */}
      {loading ? (
        <div className="space-y-6">
          {/* Skeleton for each category */}
          {[...Array(2)].map((_, categoryIndex) => (
            <div key={categoryIndex} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              {/* Category header skeleton */}
              <div className="bg-gray-50 px-6 py-3 border-b">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-48"></div>
                </div>
              </div>
              
              {/* Table skeleton */}
              <div>
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[...Array(11)].map((_, i) => (
                        <th key={i} className="px-6 py-3 text-left">
                          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[...Array(3)].map((_, rowIndex) => (
                      <tr key={rowIndex}>
                        {[...Array(11)].map((_, cellIndex) => (
                          <td key={cellIndex} className="px-6 py-2 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No products found for {selectedBrand.name}</p>
          <p className="text-sm">Click "Add Product" to create your first product</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedProducts.map(({ category, products: categoryProducts }) => (
            <div key={category} className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 ease-in-out">
              <div className="bg-gray-50 px-6 py-3 border-b hover:bg-gray-100 transition-colors duration-200 ease-in-out">
                <h3 className="text-lg font-medium text-gray-900">
                  {category} ({categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Initial Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Prod
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Rel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Final Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Res
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Available
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categoryProducts.map((product) => (
                  <tr key={product.product_id || product.id} className="hover:bg-blue-100">
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="text"
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                          className="w-full max-w-44 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        product.product_name || product.name
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="text"
                          value={editingProduct.sku || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                          className="w-full max-w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        product.sku || '-'
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <select
                          value={editingProduct.unit}
                          onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                          className="w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="pans">Pans</option>
                          <option value="pcs">Pieces</option>
                          <option value="gallons">Gallons</option>
                          <option value="liters">Liters</option>
                          <option value="kg">Kilograms</option>
                          <option value="boxes">Boxes</option>
                          <option value="bags">Bags</option>
                          <option value="g">Grams</option>
                          <option value="bottles">Bottles</option>
                          <option value="packs">Packs</option>
                        </select>
                      ) : (
                        product.unit
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-green-600">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingProduct.price === 0 ? '' : editingProduct.price || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0})}
                          className="w-full max-w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        `₱${(product.price || 0).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.initial_stock === 0 ? '' : editingProduct.initial_stock || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, initial_stock: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.initial_stock || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.production === 0 ? '' : editingProduct.production || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, production: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.production || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.released === 0 ? '' : editingProduct.released || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, released: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.released || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-semibold text-purple-600">
                      {editingProduct?.id === (product.product_id || product.id)
                        ? (editingProduct.initial_stock || 0) + (editingProduct.production || 0) - (editingProduct.released || 0)
                        : product.final_stock || 0
                      }
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingProduct?.id === (product.product_id || product.id) ? (
                        <input
                          type="number"
                          min="0"
                          value={editingProduct.reserved === 0 ? '' : editingProduct.reserved || ''}
                          onChange={(e) => setEditingProduct({...editingProduct, reserved: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                          className="w-full max-w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      ) : (
                        product.reserved || 0
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-semibold text-emerald-600">
                      {editingProduct?.id === (product.product_id || product.id)
                        ? ((editingProduct.initial_stock || 0) + (editingProduct.production || 0) - (editingProduct.released || 0)) - (editingProduct.reserved || 0)
                        : product.available_stock || 0
                      }
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        {editingProduct?.id === (product.product_id || product.id) ? (
                          <>
                            <button
                              onClick={() => handleUpdateProduct(editingProduct)}
                              className={`p-1 rounded ${
                                theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                                theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                                theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                                'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                              }`}
                              title="Save"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingProduct(null)}
                              className="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingProduct({
                                ...product, 
                                id: product.product_id || product.id,
                                name: product.product_name || product.name
                              })}
                              className={`p-1 rounded ${
                                theme === 'green' ? 'text-green-600 hover:text-green-900 hover:bg-green-100' :
                                theme === 'red' ? 'text-red-600 hover:text-red-900 hover:bg-red-100' :
                                theme === 'yellow' ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-100' :
                                'text-blue-600 hover:text-blue-900 hover:bg-blue-100'
                              }`}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.product_id || product.id)}
                              className="p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-100"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
